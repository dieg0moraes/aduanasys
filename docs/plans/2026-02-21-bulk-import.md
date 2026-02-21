# Bulk Merchandise Import — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the despachante to import products in bulk from an Excel file into the product catalog.

**Architecture:** Client-side Excel parsing with SheetJS (already installed as `xlsx`), preview table with validation/duplicate detection, and a new `POST /api/catalog/import` endpoint that handles bulk insert/upsert with async embedding generation.

**Tech Stack:** Next.js App Router, SheetJS (`xlsx` ^0.18.5, already installed), Supabase, OpenAI embeddings via `generateEmbeddings()`.

---

### Task 1: Excel Parser Utility

**Files:**
- Create: `src/lib/excel-import.ts`

**Step 1: Create the parser module**

This module handles parsing an Excel file buffer into typed rows, validating each row, and generating a template file for download.

```ts
import * as XLSX from "xlsx";
import { COUNTRIES, getCountryByCode, findCountryByName } from "@/lib/countries";

export interface ImportRow {
  rowNumber: number;
  sku: string;
  provider_description: string;
  customs_description: string;
  internal_description: string;
  ncm_code: string;
  country_of_origin: string;
  apertura: number | null;
  status: "ok" | "error" | "warning" | "duplicate";
  errors: string[];
  warnings: string[];
  action: "create" | "update" | "skip";
  selected: boolean;
}

const TEMPLATE_HEADERS = [
  "SKU",
  "Descripción Comercial",
  "Descripción Aduanera",
  "Descripción Interna",
  "NCM",
  "País de Origen",
  "Apertura",
];

export function parseExcelBuffer(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sku = String(row["SKU"] ?? "").trim();
    const provDesc = String(row["Descripción Comercial"] ?? "").trim();
    const custDesc = String(row["Descripción Aduanera"] ?? "").trim();
    const intDesc = String(row["Descripción Interna"] ?? "").trim();
    const ncm = String(row["NCM"] ?? "").trim();
    const countryRaw = String(row["País de Origen"] ?? "").trim();
    const aperturaRaw = row["Apertura"];

    // Validate required fields
    if (!sku) errors.push("SKU es obligatorio");
    if (!provDesc) errors.push("Descripción Comercial es obligatoria");

    // Validate NCM format if provided
    if (ncm && !/^\d{4}(\.\d{2}(\.\d{2})?)?$/.test(ncm)) {
      errors.push("Formato NCM inválido");
    }

    // Resolve country
    let country = "";
    if (countryRaw) {
      const asNumber = Number(countryRaw);
      if (!isNaN(asNumber) && String(asNumber) === countryRaw) {
        const found = getCountryByCode(asNumber);
        if (found) {
          country = found.name;
        } else {
          warnings.push(`Código de país ${countryRaw} no reconocido`);
        }
      } else {
        const found = findCountryByName(countryRaw);
        if (found) {
          country = found.name;
        } else {
          warnings.push(`País "${countryRaw}" no reconocido`);
          country = countryRaw; // Keep as-is
        }
      }
    }

    // Parse apertura
    let apertura: number | null = null;
    if (aperturaRaw !== "" && aperturaRaw != null) {
      const num = Number(aperturaRaw);
      if (!isNaN(num)) {
        apertura = num;
      } else {
        warnings.push("Apertura debe ser un número");
      }
    }

    const status = errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "ok";

    return {
      rowNumber: idx + 2, // Excel rows are 1-indexed + header
      sku,
      provider_description: provDesc,
      customs_description: custDesc,
      internal_description: intDesc,
      ncm_code: ncm,
      country_of_origin: country,
      apertura,
      status,
      errors,
      warnings,
      action: "create",
      selected: status !== "error",
    };
  });
}

export function generateTemplate(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // SKU
    { wch: 35 }, // Desc Comercial
    { wch: 35 }, // Desc Aduanera
    { wch: 30 }, // Desc Interna
    { wch: 14 }, // NCM
    { wch: 20 }, // País
    { wch: 10 }, // Apertura
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mercadería");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
```

**Step 2: Commit**

```bash
git add src/lib/excel-import.ts
git commit -m "feat: add Excel parser utility for bulk catalog import"
```

---

### Task 2: Bulk Import API Endpoint

**Files:**
- Create: `src/app/api/catalog/import/route.ts`
- Reference: `src/app/api/catalog/route.ts` (POST handler pattern)
- Reference: `src/app/api/invoices/[id]/approve/route.ts` (upsert + embedding pattern)
- Reference: `src/lib/embeddings.ts` (`generateEmbeddings`)

**Step 1: Create the API route**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { generateEmbeddings } from "@/lib/embeddings";

interface BulkItem {
  sku: string;
  provider_description: string;
  customs_description?: string;
  internal_description?: string;
  ncm_code?: string;
  country_of_origin?: string;
  apertura?: number | null;
  action: "create" | "update" | "skip";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { provider_id, items } = await request.json() as {
      provider_id: string;
      items: BulkItem[];
    };

    if (!provider_id) {
      return NextResponse.json({ error: "provider_id es obligatorio" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items es obligatorio y debe tener al menos un elemento" }, { status: 400 });
    }

    // Verify provider exists
    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .eq("id", provider_id)
      .single();
    if (!provider) {
      return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: { sku: string; error: string }[] = [];

    // Separate items by action
    const toCreate = items.filter((i) => i.action === "create");
    const toUpdate = items.filter((i) => i.action === "update");
    skipped = items.filter((i) => i.action === "skip").length;

    // Build rows for insert
    const insertRows = toCreate.map((item) => ({
      provider_id,
      sku: item.sku,
      provider_description: item.provider_description,
      customs_description: item.customs_description || item.provider_description,
      internal_description: item.internal_description || null,
      ncm_code: item.ncm_code || "",
      country_of_origin: item.country_of_origin || null,
      apertura: item.apertura ?? null,
      times_used: 0,
      last_used_at: now,
    }));

    // Insert new products
    if (insertRows.length > 0) {
      const { data: inserted, error: insertErr } = await supabase
        .from("product_catalog")
        .insert(insertRows)
        .select("id, sku");

      if (insertErr) {
        // If batch insert fails, try one by one to identify which ones fail
        for (const row of insertRows) {
          const { error: singleErr } = await supabase
            .from("product_catalog")
            .insert(row);
          if (singleErr) {
            errors.push({ sku: row.sku, error: singleErr.message });
          } else {
            created++;
          }
        }
      } else {
        created = inserted?.length ?? 0;
      }
    }

    // Update existing products (upsert)
    for (const item of toUpdate) {
      const updateData: Record<string, unknown> = {
        provider_description: item.provider_description,
        updated_at: now,
      };
      if (item.customs_description) updateData.customs_description = item.customs_description;
      if (item.internal_description) updateData.internal_description = item.internal_description;
      if (item.ncm_code) updateData.ncm_code = item.ncm_code;
      if (item.country_of_origin) updateData.country_of_origin = item.country_of_origin;
      if (item.apertura != null) updateData.apertura = item.apertura;

      const { error: updateErr } = await supabase
        .from("product_catalog")
        .update(updateData)
        .eq("provider_id", provider_id)
        .eq("sku", item.sku);

      if (updateErr) {
        errors.push({ sku: item.sku, error: updateErr.message });
      } else {
        updated++;
      }
    }

    // Fire-and-forget: generate embeddings for all created/updated items
    const allItems = [...toCreate, ...toUpdate].filter((i) => i.sku);
    if (allItems.length > 0) {
      generateEmbeddingsAsync(supabase, provider_id, allItems).catch((err) =>
        console.error("Embedding generation error:", err)
      );
    }

    return NextResponse.json({ created, updated, skipped, errors });
  } catch (error) {
    console.error("Bulk import error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function generateEmbeddingsAsync(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  providerId: string,
  items: BulkItem[]
) {
  const texts = items.map(
    (i) => `${i.sku} | ${i.provider_description} | ${i.customs_description || i.provider_description} | NCM ${i.ncm_code || ""}`
  );

  try {
    const embeddings = await generateEmbeddings(texts);

    for (let i = 0; i < items.length; i++) {
      if (embeddings[i]) {
        await supabase
          .from("product_catalog")
          .update({ embedding: JSON.stringify(embeddings[i]) })
          .eq("provider_id", providerId)
          .eq("sku", items[i].sku);
      }
    }
  } catch (err) {
    console.error("Failed to generate embeddings for bulk import:", err);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/catalog/import/route.ts
git commit -m "feat: add POST /api/catalog/import bulk endpoint"
```

---

### Task 3: Import Page — Stepper + Step 1 (Provider)

**Files:**
- Create: `src/app/(dashboard)/catalogo/importar/page.tsx`
- Reference: `src/components/catalog/nuevo-producto-modal.tsx` (provider combobox pattern)
- Reference: `src/lib/countries.ts` (searchCountries)

**Step 1: Create the import page with stepper and provider step**

Create `src/app/(dashboard)/catalogo/importar/page.tsx` with:

- `"use client"` directive
- Stepper component with 3 steps: "Proveedor", "Archivo", "Revisión"
- Step 1: Provider combobox (same pattern as NuevoProductoModal — search input, dropdown with existing providers, "Crear" option)
- `useSearchParams()` to check for `?provider=ID` — if present, pre-select and skip to step 2
- Breadcrumb: `Catálogo > Importar Mercadería`
- "Siguiente" button to advance to step 2 (disabled until provider selected)
- Visual: stepper with circles + lines, active step highlighted in blue

The page manages all state at the top level: `step`, `providerId`, `providerName`, `parsedRows`, `loading`, `result`.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/catalogo/importar/page.tsx
git commit -m "feat: import page with stepper and provider selection step"
```

---

### Task 4: Import Page — Step 2 (Upload + Parse)

**Files:**
- Modify: `src/app/(dashboard)/catalogo/importar/page.tsx`

**Step 1: Add Step 2 UI**

Add to the import page:

- Drop zone for Excel files (`.xlsx`, `.xls`) — styled like upload-zone but simpler (no forwardRef needed, just local state)
- "Descargar template" link that calls `generateTemplate()` from `excel-import.ts` and triggers a browser download
- On file drop/select: read file as `ArrayBuffer`, call `parseExcelBuffer()`, store result in state
- After parsing, check for duplicates against existing catalog via `GET /api/catalog?provider_id=X` — mark matching SKUs as `status: "duplicate"`
- Auto-advance to step 3 after successful parse
- Error state: if file has no valid rows, show error message and stay on step 2

**Step 2: Commit**

```bash
git add src/app/(dashboard)/catalogo/importar/page.tsx
git commit -m "feat: import page step 2 — file upload and Excel parsing"
```

---

### Task 5: Import Page — Step 3 (Preview Table + Submit)

**Files:**
- Modify: `src/app/(dashboard)/catalogo/importar/page.tsx`

**Step 1: Add Step 3 UI**

Add to the import page:

- Summary header: `48 productos · 3 duplicados · 1 error`
- Table with columns: checkbox, #, SKU, Desc. Comercial, Desc. Aduanera, Desc. Interna, NCM, País, Apertura, Estado
- Status pills per row:
  - Error: `bg-[#FEF2F2] text-[#DC2626]` — tooltip/expand with error messages
  - Warning: `bg-[#FFFBEB] text-[#D97706]`
  - Duplicate: `bg-[#EFF6FF] text-[#2563EB]` — with "Actualizar" / "Saltar" toggle buttons
  - OK: no pill
- Checkbox per row (pre-checked for OK/warning/duplicate, unchecked for errors)
- "Seleccionar todos / ninguno" checkbox in header
- Duplicate rows: toggle between `action: "update"` and `action: "skip"` — default to "skip"
- Click row to edit inline (same subtle input style as mercaderia-search edit mode)
- "Cargar X productos" button at bottom — X = count of selected, non-error rows
- On submit: POST to `/api/catalog/import` with `provider_id` and filtered items array
- During submit: progress indicator, disable button
- After submit: show result summary card (N creados, N actualizados, N saltados, N errores) with "Volver al catálogo" link

**Step 2: Commit**

```bash
git add src/app/(dashboard)/catalogo/importar/page.tsx
git commit -m "feat: import page step 3 — preview table and bulk submit"
```

---

### Task 6: Add "Importar Excel" Buttons

**Files:**
- Modify: `src/components/catalog/mercaderia-search.tsx` — add button next to "Nuevo Producto"
- Modify: `src/app/(dashboard)/catalogo/[providerId]/page.tsx` — add button next to "Agregar Producto"

**Step 1: Add import button to mercaderia-search**

In `mercaderia-search.tsx`, next to the existing "Nuevo Producto" button, add:

```tsx
<Link
  href="/catalogo/importar"
  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] transition-colors"
>
  <Upload size={14} />
  Importar Excel
</Link>
```

Import `Upload` from `lucide-react` and `Link` from `next/link`.

**Step 2: Add import button to provider page**

In `catalogo/[providerId]/page.tsx`, next to "Agregar Producto" button, add:

```tsx
<Link
  href={`/catalogo/importar?provider=${providerId}`}
  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] transition-colors"
>
  <Upload size={14} />
  Importar Excel
</Link>
```

This passes the provider ID as query param so step 1 is skipped.

**Step 3: Commit**

```bash
git add src/components/catalog/mercaderia-search.tsx src/app/(dashboard)/catalogo/[providerId]/page.tsx
git commit -m "feat: add 'Importar Excel' buttons to catalog views"
```

---

### Task 7: Build Verification + Final Commit

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build, no errors.

**Step 2: Manual smoke test**

1. Navigate to `/catalogo` → tab Mercadería → click "Importar Excel" → verify page loads with stepper
2. Select a provider → advance to step 2
3. Download template → verify it's a valid .xlsx with correct headers
4. Fill template with sample data → upload → verify preview table
5. Mark duplicates as update/skip → click "Cargar" → verify products appear in catalog
6. Navigate from `/catalogo/[providerId]` → "Importar Excel" → verify provider is pre-selected

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke test"
```
