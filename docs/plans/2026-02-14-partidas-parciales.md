# Partidas Parciales — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to create partial dispatches (partidas) from invoice items, selecting specific items and quantities for each shipment, with DUA export per partida and progress tracking.

**Architecture:** New `partidas` and `partida_items` tables linked to despachos and invoice_items. CRUD API routes. New pages for creating/viewing partidas. Modified despacho and invoice pages show dispatch progress.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), ExcelJS, Tailwind CSS, lucide-react icons.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/add-partidas.sql`

**Step 1: Write the migration SQL**

```sql
-- Migration: Add partidas (partial dispatch) tables
-- Run manually in Supabase SQL Editor

CREATE TYPE partida_status AS ENUM ('borrador', 'presentada', 'despachada');

CREATE TABLE partidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(100) NOT NULL,
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  status partida_status NOT NULL DEFAULT 'borrador',
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE partida_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES invoice_items(id) ON DELETE RESTRICT,
  dispatch_quantity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partida_id, invoice_item_id)
);

CREATE INDEX idx_partidas_despacho ON partidas(despacho_id);
CREATE INDEX idx_partidas_invoice ON partidas(invoice_id);
CREATE INDEX idx_partidas_status ON partidas(status);
CREATE INDEX idx_partida_items_partida ON partida_items(partida_id);
CREATE INDEX idx_partida_items_invoice_item ON partida_items(invoice_item_id);

CREATE TRIGGER trigger_partidas_updated_at BEFORE UPDATE ON partidas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON partidas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON partida_items FOR ALL USING (auth.role() = 'authenticated');
```

**Step 2: Run in Supabase SQL Editor**

Apply the migration manually in the Supabase dashboard SQL Editor.

**Step 3: Commit**

```bash
git add supabase/add-partidas.sql
git commit -m "add partidas migration for partial dispatch"
```

---

### Task 2: TypeScript types

**Files:**
- Modify: `src/lib/types.ts` (after line 26, and after line 293)

**Step 1: Add types after the existing type definitions (line 26)**

After `export type DocumentType = ...` add:

```typescript
export type PartidaStatus = "borrador" | "presentada" | "despachada";
```

**Step 2: Add interfaces after the Despacho interface (after line 51)**

```typescript
export interface Partida {
  id: string;
  reference: string;
  despacho_id: string;
  invoice_id: string;
  status: PartidaStatus;
  date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  invoice?: Invoice | null;
  items?: PartidaItem[];
  item_count?: number;
}

export interface PartidaItem {
  id: string;
  partida_id: string;
  invoice_item_id: string;
  dispatch_quantity: number;
  created_at: string;
  // Joined
  invoice_item?: InvoiceItem | null;
}
```

**Step 3: Add labels and colors at the end of the file (after line 293)**

```typescript
export const PARTIDA_STATUS_LABELS: Record<PartidaStatus, string> = {
  borrador: "Borrador",
  presentada: "Presentada",
  despachada: "Despachada",
};

export const PARTIDA_STATUS_COLORS: Record<PartidaStatus, string> = {
  borrador: "bg-gray-100 text-gray-700",
  presentada: "bg-blue-100 text-blue-700",
  despachada: "bg-green-100 text-green-700",
};
```

**Step 4: Build to verify**

Run: `npm run build`
Expected: Compiles successfully.

**Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "add Partida and PartidaItem types"
```

---

### Task 3: Partidas CRUD API

**Files:**
- Create: `src/app/api/partidas/route.ts`
- Create: `src/app/api/partidas/[id]/route.ts`
- Create: `src/app/api/partidas/[id]/items/route.ts`

**Step 1: Create `src/app/api/partidas/route.ts`**

Handles listing partidas by despacho and creating new ones.

- **GET** `?despacho_id=xxx` — returns partidas for a despacho with item counts
- **POST** `{despacho_id, invoice_id, reference, date?, notes?, items: [{invoice_item_id, dispatch_quantity}]}` — creates partida + items in one call

Follow the same auth pattern as `src/app/api/despachos/route.ts`: `createServerClient()`, check `user`, return 401 if not authenticated.

For POST, validate that `SUM(dispatch_quantity)` for each invoice_item across all partidas does not exceed the item's `quantity`. Query existing partida_items for the same invoice_item_ids to compute already-dispatched quantities.

Auto-generate `reference` if not provided: count existing partidas for that despacho and use `P-{count+1}` format (e.g. "P-001", "P-002").

**Step 2: Create `src/app/api/partidas/[id]/route.ts`**

- **GET** — returns partida with its items and joined invoice_items data
- **PATCH** `{reference?, date?, notes?, status?}` — update partida fields (only if status is 'borrador' for reference/date/notes; status transitions always allowed)
- **DELETE** — delete partida (cascade deletes partida_items)

Follow the same pattern as `src/app/api/despachos/[id]/route.ts` for auth and param handling.

**Step 3: Create `src/app/api/partidas/[id]/items/route.ts`**

- **PUT** `{items: [{invoice_item_id, dispatch_quantity}]}` — replaces all items for the partida (delete existing + insert new). Only when status = 'borrador'.

Validate dispatch_quantity does not exceed available quantity (total - already dispatched in OTHER partidas).

**Step 4: Build to verify**

Run: `npm run build`
Expected: Compiles with all three new API routes.

**Step 5: Commit**

```bash
git add src/app/api/partidas/
git commit -m "add partidas CRUD API routes"
```

---

### Task 4: Export DUA per partida

**Files:**
- Create: `src/app/api/partidas/[id]/export-dua/route.ts`

**Step 1: Create the export route**

Reuse the same Excel structure from `src/app/api/invoices/[id]/export-dua/route.ts` (same columns, same header styling, same `matchUnitToDUA` from `src/lib/units.ts`).

Differences:
- Fetch partida + partida_items + joined invoice_items
- Fetch the invoice for `country_code` and `file_name`
- Only include items that are in the partida
- Use `dispatch_quantity` for CANTIDAD column
- Recalculate VALOR: `(dispatch_quantity / item.quantity) * item.total_price`
- Use item-level `country_of_origin` for ORIGEN column (instead of invoice-level `country_code`)
- Filename: `DUA_P-{reference}_{invoice_filename}.xlsx`

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/partidas/[id]/export-dua/
git commit -m "add DUA export per partida"
```

---

### Task 5: API to get dispatch progress for invoice items

**Files:**
- Create: `src/app/api/invoices/[id]/dispatch-status/route.ts`

**Step 1: Create the dispatch status endpoint**

**GET** — returns dispatch progress for all items of an invoice:

```typescript
// Query: for each invoice_item, sum dispatch_quantity across all partida_items
const { data } = await supabase
  .from("partida_items")
  .select("invoice_item_id, dispatch_quantity, partida:partidas(id, reference, status)")
  .in("invoice_item_id", itemIds);

// Build response: { [invoice_item_id]: { dispatched: number, partidas: [{id, reference, status, quantity}] } }
```

Response shape:
```json
{
  "dispatch_status": {
    "<item_id>": {
      "dispatched_quantity": 50,
      "partidas": [
        {"id": "...", "reference": "P-001", "status": "presentada", "quantity": 30},
        {"id": "...", "reference": "P-002", "status": "borrador", "quantity": 20}
      ]
    }
  }
}
```

**Step 2: Build, commit**

```bash
git add src/app/api/invoices/[id]/dispatch-status/
git commit -m "add dispatch status API for invoice items"
```

---

### Task 6: Create partida page

**Files:**
- Create: `src/app/(dashboard)/despachos/[id]/partidas/nueva/page.tsx`

**Step 1: Build the page**

This is a "use client" page. URL: `/despachos/{despachoId}/partidas/nueva?invoice={invoiceId}`

Structure:
1. **Header:** Back button to despacho, title "Nueva Partida"
2. **Form fields:** reference (auto-generated, editable), date (date input), notes (textarea)
3. **Items table:** Fetch invoice items from `/api/invoices/{invoiceId}` and dispatch status from `/api/invoices/{invoiceId}/dispatch-status`

For each item show:
- Checkbox (checked by default if available quantity > 0)
- Line number, SKU, description (original_description truncated)
- Total quantity, already dispatched, available (`quantity - dispatched`)
- Input for dispatch quantity (default = available, max = available, min = 0)
- Disabled if available = 0

4. **Footer:** "Crear Partida" button + "Cancelar"

On submit: POST to `/api/partidas` with `{despacho_id, invoice_id, reference, date, notes, items}`. On success redirect to the partida detail page.

Use the same styling patterns as the despacho detail page: `bg-white rounded-xl border p-*`, `text-sm`, button colors `#2E86C1` / `#1B4F72`.

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/despachos/[id]/partidas/nueva/"
git commit -m "add create partida page with item selection"
```

---

### Task 7: Partida detail page

**Files:**
- Create: `src/app/(dashboard)/despachos/[id]/partidas/[partidaId]/page.tsx`

**Step 1: Build the page**

"use client" page. Fetches partida from `GET /api/partidas/{partidaId}`.

Sections:
1. **Header:** Back to despacho, partida reference, status badge (use `PARTIDA_STATUS_LABELS/COLORS`)
2. **Editable fields** (only when status = 'borrador'):
   - Reference (inline edit, same pattern as customs_code in despacho page)
   - Date (date input)
   - Notes (textarea)
3. **Items table:** Shows partida items with dispatch_quantity, joined invoice_item data (description, NCM, unit_price)
   - Calculated value column: `(dispatch_quantity / item.quantity) * item.total_price`
4. **Actions:**
   - "Exportar DUA" button → links to `/api/partidas/{id}/export-dua`
   - Status transitions: borrador → presentada → despachada (simple button)
   - Delete partida (with confirmation, only in borrador)

**Step 2: Build, commit**

```bash
git add "src/app/(dashboard)/despachos/[id]/partidas/[partidaId]/"
git commit -m "add partida detail page"
```

---

### Task 8: Update despacho detail page with partidas section

**Files:**
- Modify: `src/app/(dashboard)/despachos/[id]/page.tsx`

**Step 1: Add partidas state and fetch**

Add state for partidas. Fetch from `GET /api/partidas?despacho_id={id}` on mount (alongside existing fetchDespacho and fetchDocuments).

**Step 2: Enhance the invoices section (lines 379-459)**

For each invoice in the list, show:
- Existing info (filename, provider, date, status badge)
- NEW: Dispatch progress badge: "Sin partidas" / "Parcial (2/5)" / "Completa"
- NEW: Button "+ Partida" → navigates to `/despachos/{id}/partidas/nueva?invoice={invoiceId}`

Compute dispatch progress by comparing invoice item quantities against partida_items for that invoice.

**Step 3: Add partidas list section (after invoices, before documents)**

New section "Partidas ({count})" showing a table/list of partidas:
- Reference, factura name, date, status badge, item count
- Click navigates to partida detail page
- Grouped or sorted by factura

**Step 4: Build, commit**

```bash
git add "src/app/(dashboard)/despachos/[id]/page.tsx"
git commit -m "add partidas section to despacho page"
```

---

### Task 9: Show dispatch progress in invoice detail

**Files:**
- Modify: `src/app/(dashboard)/facturas/[id]/page.tsx`
- Modify: `src/components/invoice/items-table.tsx`

**Step 1: Fetch dispatch status in invoice detail page**

After fetching items, call `GET /api/invoices/{id}/dispatch-status` and pass the result to `ItemsTable` as a new prop `dispatchStatus`.

**Step 2: Add "Despachado" column to items-table.tsx**

In `ItemsTableProps`, add optional `dispatchStatus` prop.

Add a column header "Despachado" in `<thead>` (after "Origen", before "Confianza").

In each row, show dispatch progress: `dispatched / total` or a small progress indicator. If no dispatch data, show "—".

Update `colSpan` in the expanded edit panel accordingly.

**Step 3: Add summary in invoice detail page**

If the invoice has any dispatched items, show a summary card: "Despacho: X/Y items despachados" with a link to the despacho.

**Step 4: Build, commit**

```bash
git add src/components/invoice/items-table.tsx "src/app/(dashboard)/facturas/[id]/page.tsx"
git commit -m "show dispatch progress in invoice and items table"
```

---

### Task 10: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Manual testing checklist**

1. Run migration in Supabase
2. Open a despacho with linked invoices
3. Click "+ Partida" on a factura → create partida page opens
4. Select items with quantities → create partida
5. View partida detail → verify items and calculated values
6. Export DUA from partida → verify Excel has only selected items with correct quantities/values
7. Create second partida → verify available quantities decreased
8. Check invoice detail → "Despachado" column shows progress
9. Change partida status borrador → presentada → despachada
10. Verify full invoice export still works (all items)

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "partidas parciales feature complete"
```
