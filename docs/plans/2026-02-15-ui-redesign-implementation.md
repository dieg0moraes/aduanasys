# AduanaSys UI Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the AduanaSys UI from the current functional-but-dated interface to a modern Swiss/clean SaaS aesthetic matching the designs in `aduana.pen`.

**Architecture:** Evolutionary redesign — keep existing page structure, API routes, and data models. Replace inline color values with CSS custom properties (design tokens). Build reusable UI components. Restyle screens one by one. Add new Dashboard page and Despacho notes feature. Only DB change: `despacho_notes` table.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Supabase, TypeScript, lucide-react icons

**Design reference:** `docs/plans/2026-02-15-ui-redesign-design.md` and `aduana.pen` (Pencil design file)

---

## Phase 1: Foundation — Design Tokens, Components, Navigation

### Task 1: Add design tokens as CSS custom properties

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add CSS custom properties to globals.css**

Add inside `:root` (or create one) in `globals.css`:

```css
:root {
  /* Backgrounds */
  --color-bg-primary: #FFFFFF;
  --color-bg-surface: #FAFAFA;
  --color-bg-highlight: #EFF6FF;
  --color-bg-sidebar: #1B2A4A;

  /* Text */
  --color-text-primary: #18181B;
  --color-text-secondary: #71717A;
  --color-text-tertiary: #A1A1AA;
  --color-text-on-accent: #FFFFFF;
  --color-text-on-sidebar: #FFFFFF;
  --color-text-sidebar-muted: rgba(255,255,255,0.5);

  /* Accent */
  --color-accent-primary: #2563EB;
  --color-accent-light: #DBEAFE;

  /* Status */
  --color-status-success: #16A34A;
  --color-status-success-light: #F0FDF4;
  --color-status-warning: #F59E0B;
  --color-status-warning-light: #FFFBEB;
  --color-status-error: #DC2626;
  --color-status-error-light: #FEF2F2;

  /* Borders */
  --color-border-default: #E4E4E7;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Font */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add design tokens as CSS custom properties for UI redesign"
```

---

### Task 2: Replace old color values across the codebase

**Files:**
- Modify: All files in `src/components/` and `src/app/(dashboard)/` that reference `#2E86C1`, `#1B4F72`, `#2574A9`, `#154360`, `#EBF5FB`

**Step 1: Find and replace old primary blue**

Search and replace across all `.tsx` files:
- `#2E86C1` → `var(--color-accent-primary)` (in Tailwind: replace with `text-[#2563EB]` or use `text-[var(--color-accent-primary)]`)
- `#1B4F72` → `var(--color-bg-sidebar)` (sidebar bg)
- `#2574A9` / `#2471A3` → hover variants of accent
- `#154360` → darker sidebar hover
- `#EBF5FB` → `var(--color-bg-highlight)`

Since Tailwind 4 uses CSS natively, the simplest approach is to replace hex literals:
- `bg-[#2E86C1]` → `bg-[#2563EB]`
- `bg-[#1B4F72]` → `bg-[#1B2A4A]`
- `text-[#2E86C1]` → `text-[#2563EB]`
- `focus:ring-[#2E86C1]` → `focus:ring-[#2563EB]`
- `hover:bg-[#2574A9]` → `hover:bg-[#1D4ED8]`
- `hover:bg-[#2471A3]` → `hover:bg-[#1D4ED8]`
- `bg-[#1B4F72]` → `bg-[#1B2A4A]`
- `hover:bg-[#154360]` → `hover:bg-[#162240]`

**Step 2: Verify the app still works**

Run: `npm run dev`
Navigate to each page and visually verify colors changed.

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: update color palette to new design system (#2563EB accent, #1B2A4A sidebar)"
```

---

### Task 3: Update sidebar navigation order and styling

**Files:**
- Modify: `src/components/ui/sidebar.tsx`

**Step 1: Read current sidebar implementation**

Read `src/components/ui/sidebar.tsx` to understand the current nav structure.

**Step 2: Update navigation order and items**

The nav items must be reordered to: Dashboard > Despachos > Facturas > Catálogo > NCM

Update the nav items array/list to this order:
1. `Dashboard` — icon: `LayoutDashboard` — path: `/`
2. `Despachos` — icon: `Package` — path: `/despachos` (or `/clientes/[id]` if despachos are nested — check current routing)
3. `Facturas` — icon: `FileText` — path: `/facturas`
4. `Catálogo` — icon: `BookOpen` — path: `/catalogo`
5. `NCM` — icon: `Search` — path: `/ncm`

**Step 3: Update active state styling**

Change active nav item style from `bg-white/15` to use the accent blue:
- Active: `bg-[#2563EB]/20 text-white` with left border or similar accent indicator
- Idle: `text-white/70 hover:bg-white/10`

**Step 4: Verify navigation works**

Run: `npm run dev`
Click through all nav items, verify correct highlighting and routing.

**Step 5: Commit**

```bash
git add src/components/ui/sidebar.tsx
git commit -m "feat: reorder sidebar nav (Dashboard > Despachos > Facturas > Catálogo > NCM) and update active state styling"
```

---

### Task 4: Create reusable StatusBadge component

**Files:**
- Create: `src/components/ui/status-badge.tsx`

**Step 1: Create the component**

```tsx
interface StatusBadgeProps {
  label: string;
  color: "success" | "warning" | "error" | "blue" | "gray";
}

const COLOR_MAP = {
  success: { dot: "bg-[#16A34A]", text: "text-[#16A34A]" },
  warning: { dot: "bg-[#F59E0B]", text: "text-[#F59E0B]" },
  error: { dot: "bg-[#DC2626]", text: "text-[#DC2626]" },
  blue: { dot: "bg-[#2563EB]", text: "text-[#2563EB]" },
  gray: { dot: "bg-[#A1A1AA]", text: "text-[#71717A]" },
};

export function StatusBadge({ label, color }: StatusBadgeProps) {
  const c = COLOR_MAP[color];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      <span className={`text-xs font-medium ${c.text}`}>{label}</span>
    </span>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Passes

**Step 3: Commit**

```bash
git add src/components/ui/status-badge.tsx
git commit -m "feat: create reusable StatusBadge component (dot + label)"
```

---

### Task 5: Create reusable KPICard component

**Files:**
- Create: `src/components/ui/kpi-card.tsx`

**Step 1: Create the component**

```tsx
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: { value: string; positive: boolean };
  icon?: LucideIcon;
}

export function KPICard({ label, value, trend, icon: Icon }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 flex-1">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
          {label}
        </span>
        {Icon && <Icon size={18} className="text-[#A1A1AA]" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-[#18181B]">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              trend.positive
                ? "bg-[#F0FDF4] text-[#16A34A]"
                : "bg-[#FEF2F2] text-[#DC2626]"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/ui/kpi-card.tsx
git commit -m "feat: create reusable KPICard component with trend badge"
```

---

### Task 6: Create Breadcrumb component

**Files:**
- Create: `src/components/ui/breadcrumb.tsx`

**Step 1: Create the component**

```tsx
import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-[#A1A1AA]">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              className="text-[#2563EB] font-medium hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-[#71717A] font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/ui/breadcrumb.tsx
git commit -m "feat: create Breadcrumb navigation component"
```

---

### Task 7: Create StatusStepper component

**Files:**
- Create: `src/components/ui/status-stepper.tsx`

**Step 1: Create the component**

```tsx
interface Step {
  label: string;
  status: "completed" | "current" | "pending";
}

interface StatusStepperProps {
  steps: Step[];
}

export function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            {step.status === "completed" ? (
              <div className="w-8 h-8 rounded-full bg-[#16A34A] flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            ) : step.status === "current" ? (
              <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-[#E4E4E7]" />
            )}
            <span className={`text-xs font-medium ${
              step.status === "current" ? "text-[#2563EB]" :
              step.status === "completed" ? "text-[#16A34A]" : "text-[#A1A1AA]"
            }`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 ${
              step.status === "completed" ? "bg-[#16A34A]" : "bg-[#E4E4E7]"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/ui/status-stepper.tsx
git commit -m "feat: create StatusStepper component for lifecycle progress display"
```

---

## Phase 2: Restyle Existing Screens

### Task 8: Restyle Facturas List page

**Files:**
- Modify: `src/app/(dashboard)/facturas/page.tsx`
- Modify: `src/components/invoice/invoice-list.tsx`
- Modify: `src/components/invoice/upload-zone.tsx`

**Step 1: Read current implementations**

Read all three files to understand the current structure.

**Step 2: Add status filter tabs to invoice list**

In `invoice-list.tsx`, add horizontal tabs above the table:
- Tabs: Todas | Procesando | En Revisión | Aprobadas
- Active tab: blue text + blue bottom border
- Inactive: gray text, no border
- Filter the invoice list based on selected tab

**Step 3: Add confidence progress bars to table**

Replace text-only confidence display with colored progress bars:
- High: green bar
- Medium: amber bar
- Low: red bar
- Show percentage next to bar

**Step 4: Convert upload to modal**

Wrap `UploadZone` in a modal dialog triggered by a "Subir Factura" button.
- Modal: centered overlay with backdrop
- Dashed blue border drag zone
- File selected state: green tinted row
- Footer: Cancelar + "Subir y Procesar"

**Step 5: Update page styling**

Apply new design tokens: `bg-[#FAFAFA]` page background, white cards with `border border-[#E4E4E7] rounded-xl`.

**Step 6: Verify all functionality still works**

Run: `npm run dev`
Test: Upload an invoice, filter by status, verify confidence bars show.

Run: `npm run build`

**Step 7: Commit**

```bash
git add src/app/(dashboard)/facturas/page.tsx src/components/invoice/invoice-list.tsx src/components/invoice/upload-zone.tsx
git commit -m "feat: restyle Facturas list with status tabs, confidence bars, upload modal"
```

---

### Task 9: Restyle Factura Detail page

**Files:**
- Modify: `src/app/(dashboard)/facturas/[id]/page.tsx`
- Modify: `src/components/invoice/items-table.tsx`

**Step 1: Read current implementations**

Read both files.

**Step 2: Add breadcrumb navigation**

Add `<Breadcrumb items={[{label: "Facturas", href: "/facturas"}, {label: invoice.file_name}]} />` at the top of the page.

**Step 3: Add status stepper**

Add `<StatusStepper>` below the breadcrumb showing invoice lifecycle:
- Steps: Subida, Procesada, En Revisión, Aprobada
- Map current `invoice.status` to step states

**Step 4: Add summary KPI cards**

Add a row of `<KPICard>` components showing:
- Total items, Clasificados %, Confianza promedio, Pendientes de revisión
- Calculate from the items array

**Step 5: Add Partidas widget**

Add a compact horizontal card between KPIs and items table:
- Icon, "Partidas" title, count badge, inline references (P-001, P-002), "Ver todas" link, "+ Crear Partida" button
- Fetch partidas from `/api/partidas?despacho_id=X` (check if despacho_id is available on the invoice)

**Step 6: Update items table styling**

In `items-table.tsx`:
- NCM codes as colored pills (green=high, amber=medium, red=low confidence)
- Inline editing panel with blue left border
- Update color scheme to new design tokens

**Step 7: Verify all functionality**

Run: `npm run dev`
Test: Navigate to a factura, verify stepper, KPIs, partidas widget, inline editing.

Run: `npm run build`

**Step 8: Commit**

```bash
git add src/app/(dashboard)/facturas/[id]/page.tsx src/components/invoice/items-table.tsx
git commit -m "feat: restyle Factura Detail with stepper, KPIs, partidas widget, colored NCM pills"
```

---

### Task 10: Restyle Despacho Detail with tabs

**Files:**
- Modify: `src/app/(dashboard)/despachos/[id]/page.tsx`

**Step 1: Read current implementation**

Read the file — it currently has all sections stacked vertically.

**Step 2: Create tab navigation**

Add a horizontal tab bar with 4 tabs: Facturas (count) | Partidas (count) | Documentos (count) | Notas (count).
- Active tab: blue text + blue bottom border
- Store active tab in React state

**Step 3: Render tab content conditionally**

- **Facturas tab:** Keep existing facturas table, add "Vincular Factura" and "Subir Factura" buttons
- **Partidas tab:** Keep existing partidas table, add "Crear Partida" button, show reference as blue link, status as `<StatusBadge>`
- **Documentos tab:** Keep existing documents section, add file icon + size, type badges (DUA blue, Certificado green, Packing List amber), download/delete icon buttons
- **Notas tab:** See Task 12

**Step 4: Update header and info card styling**

- Breadcrumb: Client > Despacho number
- Header: title + `<StatusBadge>` + action buttons
- DUA and reference fields in a horizontal row card

**Step 5: Verify all tabs work**

Run: `npm run dev`
Test: Switch between all tabs, verify data loads, upload documents, link invoices.

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/app/(dashboard)/despachos/[id]/page.tsx
git commit -m "feat: convert Despacho Detail sections to tabbed layout with styled tabs"
```

---

### Task 11: Restyle NCM Search page

**Files:**
- Modify: `src/app/(dashboard)/ncm/page.tsx`

**Step 1: Read current implementation**

**Step 2: Update search bar styling**

- Prominent blue accent border on focus
- Larger input with search icon inside
- Search button aligned right

**Step 3: Update results with expandable rows**

- Each result: clickable row that expands/collapses
- Collapsed: layer indicator dot + NCM code pill + truncated description + similarity %
- Expanded: full description, hierarchy breadcrumb (if available), exclusion warnings, copy button
- Layer colors: catalog=green, fulltext=blue, trigram=amber, semantic=purple

**Step 4: Add layer legend**

Small legend in the results header showing dot colors and their meanings.

**Step 5: Verify search works**

Run: `npm run dev`
Test: Search for a product, verify results expand/collapse, layer dots show correctly.

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/app/(dashboard)/ncm/page.tsx
git commit -m "feat: restyle NCM Search with expandable results, layer indicators, and legend"
```

---

### Task 12: Restyle NCM Picker modal

**Files:**
- Modify: `src/components/invoice/ncm-picker.tsx`

**Step 1: Read current implementation**

**Step 2: Update to match new design**

- Update colors to new accent (#2563EB)
- Add expandable rows with chevron (ChevronDown/ChevronRight)
- Show hierarchy breadcrumb in expanded view
- Show exclusion warnings with amber AlertTriangle icon
- Add "Seleccionar este código" button in expanded view
- Manual input footer styling update

**Step 3: Verify picker works**

Run: `npm run dev`
Navigate to a factura detail, click an NCM code to open picker, search, expand a result, select.

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/invoice/ncm-picker.tsx
git commit -m "feat: restyle NCM Picker with expandable rows, hierarchy, and exclusion warnings"
```

---

### Task 13: Restyle Catálogo pages

**Files:**
- Modify: `src/app/(dashboard)/catalogo/page.tsx`
- Modify: `src/app/(dashboard)/catalogo/[providerId]/page.tsx`
- Modify: `src/components/catalog/mercaderia-search.tsx`

**Step 1: Read current implementations**

**Step 2: Update Proveedores tab**

- Provider rows: avatar circle + name, country, product count, invoice count, chevron
- Pagination with "Showing X of Y" pattern

**Step 3: Update Mercadería tab**

In `mercaderia-search.tsx`:
- Expandable product cards (two-line collapsed, structured expanded)
- Collapsed: Line 1 (SKU badge + description), Line 2 (avatar+provider, País, Usado count). Right: NCM pill + chevron
- Expanded (blue left border): descriptions (Aduanera + Interna), flag pills (LATU purple, IMESI orange, Exonera IVA green, Apertura blue), importers mini-table
- Add "+ Nuevo Producto" button triggering modal
- Result count display

**Step 4: Update Provider Detail**

- Breadcrumb: Catálogo > Provider name
- Provider info card with avatar, metrics, edit/add buttons
- Product table with colored NCM pills

**Step 5: Verify all catalogo functionality**

Run: `npm run dev`
Test: Browse providers, search mercadería, expand cards, view provider detail.

Run: `npm run build`

**Step 6: Commit**

```bash
git add src/app/(dashboard)/catalogo/page.tsx src/app/(dashboard)/catalogo/[providerId]/page.tsx src/components/catalog/mercaderia-search.tsx
git commit -m "feat: restyle Catálogo with expandable product cards, flags, and improved provider detail"
```

---

## Phase 3: New Features

### Task 14: Create Dashboard page

**Files:**
- Modify: `src/app/(dashboard)/page.tsx` (replace current client list with dashboard)
- Create: `src/app/api/dashboard/stats/route.ts`

**Step 1: Create dashboard stats API route**

```typescript
// src/app/api/dashboard/stats/route.ts
import { createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerClient();

  // Facturas en proceso
  const { count: processingCount } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .in("status", ["processing", "review"]);

  // Despachos activos (invoices with despacho_id, not exported)
  const { count: despachosCount } = await supabase
    .from("despachos")
    .select("*", { count: "exact", head: true })
    .neq("status", "completed");

  // Items pendientes
  const { count: pendingItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true })
    .eq("confidence_level", "low");

  // Tasa de precisión (items with high confidence / total)
  const { count: totalItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true });
  const { count: highConfItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true })
    .eq("confidence_level", "high");

  const precision = totalItems ? Math.round(((highConfItems || 0) / totalItems) * 100) : 0;

  // Recent invoices
  const { data: recentInvoices } = await supabase
    .from("invoices")
    .select("*, provider:providers(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Alerts: low confidence items in review invoices
  const { data: alerts } = await supabase
    .from("invoice_items")
    .select("*, invoice:invoices(file_name, status)")
    .eq("confidence_level", "low")
    .limit(5);

  return NextResponse.json({
    kpis: {
      facturas_en_proceso: processingCount || 0,
      despachos_activos: despachosCount || 0,
      items_pendientes: pendingItems || 0,
      tasa_precision: precision,
    },
    recent_invoices: recentInvoices || [],
    alerts: alerts || [],
  });
}
```

**Step 2: Build the Dashboard page**

Replace contents of `src/app/(dashboard)/page.tsx` with:
- KPI row using `<KPICard>` (4 cards)
- Two-column layout below:
  - Left: Alerts section (items needing attention) + Activity feed (recent invoice updates)
  - Right: Recent invoices table + Top providers by volume
- Fetch data from `/api/dashboard/stats`

**Step 3: Verify dashboard loads**

Run: `npm run dev`
Navigate to `/`, verify KPIs show, alerts load, recent invoices display.

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/page.tsx src/app/api/dashboard/stats/route.ts
git commit -m "feat: create Dashboard with KPIs, alerts, recent invoices, and activity feed"
```

---

### Task 15: Add Notas feature to Despacho Detail

**Files:**
- Create: `supabase/add-despacho-notes.sql`
- Create: `src/app/api/despachos/[id]/notes/route.ts`
- Modify: `src/app/(dashboard)/despachos/[id]/page.tsx`

**Step 1: Create SQL migration**

```sql
-- supabase/add-despacho-notes.sql
CREATE TABLE despacho_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL DEFAULT 'Usuario',
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despacho_notes_despacho_id ON despacho_notes(despacho_id);
```

Run this SQL in Supabase SQL Editor manually.

**Step 2: Create API route for notes**

```typescript
// src/app/api/despachos/[id]/notes/route.ts
import { createServerClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("despacho_notes")
    .select("*")
    .eq("despacho_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from("despacho_notes")
    .insert({
      despacho_id: params.id,
      author_name: body.author_name || "Usuario",
      note_text: body.note_text,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

**Step 3: Add Notas tab content to Despacho Detail page**

In the Notas tab of `despachos/[id]/page.tsx`:
- Add note form: textarea + "Agregar" button with send icon
- Notes list: chronological, each with author avatar (colored circle + initials), name, timestamp, note body
- Fetch from `/api/despachos/${id}/notes`
- POST new notes, refetch list after adding

**Step 4: Verify notes feature**

Run: `npm run dev`
Navigate to a despacho, click Notas tab, add a note, verify it appears.

Run: `npm run build`

**Step 5: Commit**

```bash
git add supabase/add-despacho-notes.sql src/app/api/despachos/[id]/notes/route.ts src/app/(dashboard)/despachos/[id]/page.tsx
git commit -m "feat: add Notas journal feature to Despacho Detail (new DB table + API + UI)"
```

---

### Task 16: Restyle Nueva Partida page

**Files:**
- Modify: `src/app/(dashboard)/despachos/[id]/partidas/nueva/page.tsx`

**Step 1: Read current implementation**

**Step 2: Update styling to match design**

- Add breadcrumb: Despachos > DES-XXXX > Nueva Partida
- Header: title + source invoice name + provider name
- Form card: 3-column row (Referencia, Fecha, Notas) with rounded-xl border
- Items table: checkbox, #, SKU, Descripción, NCM pills, Cantidad, Despachado (amber), Disponible (green), Cant. Partida (blue input when selected)
- Selected rows: `bg-blue-50/30` tint
- Disabled rows: `opacity-60 bg-gray-50`
- Footer: selection summary badge + "Crear Partida" primary button

**Step 3: Update colors to new design tokens**

Replace all `#2E86C1` references with `#2563EB`.

**Step 4: Verify functionality**

Run: `npm run dev`
Navigate to a despacho, create a partida, select items, change quantities, submit.

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/app/(dashboard)/despachos/[id]/partidas/nueva/page.tsx
git commit -m "feat: restyle Nueva Partida with breadcrumb, colored status columns, and updated design"
```

---

### Task 17: Restyle Partida Detail page

**Files:**
- Modify: `src/app/(dashboard)/despachos/[id]/partidas/[partidaId]/page.tsx`

**Step 1: Read current implementation**

**Step 2: Update styling to match design**

- Breadcrumb: Despachos > DES-XXXX > P-001
- Header: "Partida P-001" + `<StatusBadge>` + Exportar DUA / Editar buttons
- Info card: invoice reference, date, notes
- `<StatusStepper>` with steps: Borrador > Presentada > Despachada
- Items table: #, SKU, Descripción, NCM pills, Cantidad, Precio Unit., Valor
- Totals row at bottom

**Step 3: Verify functionality**

Run: `npm run dev`

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/app/(dashboard)/despachos/[id]/partidas/[partidaId]/page.tsx
git commit -m "feat: restyle Partida Detail with stepper, info card, and items table"
```

---

### Task 18: Create Nuevo Producto modal

**Files:**
- Create: `src/components/catalog/nuevo-producto-modal.tsx`
- Modify: `src/app/(dashboard)/catalogo/[providerId]/page.tsx`
- Modify: `src/components/catalog/mercaderia-search.tsx`

**Step 1: Create the modal component**

Form fields: Proveedor (selector), SKU, Descripción comercial, Descripción interna, Descripción aduanera, Código NCM (with search trigger), País de origen.
Footer: Cancelar + Guardar Producto.
POST to `/api/catalog`.

**Step 2: Add trigger in Provider Detail and Mercadería search**

- Provider Detail: "Agregar Producto" button opens modal with provider pre-selected
- Mercadería: "+ Nuevo Producto" button opens modal

**Step 3: Verify modal works**

Run: `npm run dev`
Open modal from both locations, fill form, save, verify product appears.

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/components/catalog/nuevo-producto-modal.tsx src/app/(dashboard)/catalogo/[providerId]/page.tsx src/components/catalog/mercaderia-search.tsx
git commit -m "feat: create Nuevo Producto modal for adding products to catalog"
```

---

## Phase 4: Polish

### Task 19: Final visual consistency pass

**Files:**
- All page and component files

**Step 1: Audit all screens for consistency**

Go through each screen in the browser and verify:
- Consistent card pattern: `bg-white rounded-xl border border-[#E4E4E7]`
- Consistent text colors: primary `#18181B`, secondary `#71717A`, tertiary `#A1A1AA`
- Consistent spacing: `p-5` for cards, `gap-4` between sections
- All status badges use `<StatusBadge>`
- All breadcrumbs use `<Breadcrumb>`
- Font: Inter everywhere (check `globals.css` font import)

**Step 2: Fix any inconsistencies found**

**Step 3: Run final build**

Run: `npm run build`
Run: `npm run lint`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: visual consistency pass — normalize cards, colors, spacing across all screens"
```

---

## Summary

| Phase | Tasks | Estimated Effort |
|-------|-------|-----------------|
| 1. Foundation | Tasks 1-7 | 2-3 days |
| 2. Restyle Existing | Tasks 8-13 | 5-6 days |
| 3. New Features | Tasks 14-18 | 5-6 days |
| 4. Polish | Task 19 | 1-2 days |
| **Total** | **19 tasks** | **~3-4 weeks** |
