# Búsqueda de Mercadería — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Mercadería" tab to the Catálogo page with full-text search across the product catalog, expandable result cards showing providers and importers (clients), and optional advanced filters.

**Architecture:** New API endpoint for importers data (joins invoice_items → invoices → despachos → clients). Modify existing catalog page to add tabs. The existing `/api/catalog` GET endpoint already supports search + provider filter + pagination — reuse it. Add `client_id` filter support to the catalog API.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), Tailwind CSS, lucide-react icons.

---

### Task 1: Add importers API endpoint

**Files:**
- Create: `src/app/api/catalog/[id]/importers/route.ts`

**Step 1: Create the endpoint**

`GET /api/catalog/{productId}/importers` — returns clients who imported this product.

Given a `product_catalog` entry (which has `provider_id` and `sku`), find all `invoice_items` with matching SKU from invoices of the same provider, then join to get despacho and client info.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get the catalog entry to know provider_id and sku
    const { data: product, error: productError } = await supabase
      .from("product_catalog")
      .select("provider_id, sku")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (!product.sku || !product.provider_id) {
      return NextResponse.json({ importers: [] });
    }

    // Find invoice_items with matching SKU from invoices of same provider
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select(`
        quantity, total_price, currency,
        invoice:invoices!inner(
          id, file_name, created_at, provider_id,
          despacho:despachos(
            id, reference,
            client:clients(id, name, cuit)
          )
        )
      `)
      .eq("sku", product.sku)
      .eq("invoice.provider_id", product.provider_id)
      .order("invoice(created_at)", { ascending: false });

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Group by client, aggregate import history
    const clientMap = new Map<string, {
      client_id: string;
      client_name: string;
      client_cuit: string | null;
      imports: {
        despacho_ref: string | null;
        invoice_file: string;
        invoice_date: string;
        quantity: number | null;
        total_price: number | null;
        currency: string;
      }[];
    }>();

    for (const item of items || []) {
      const inv = item.invoice as any;
      const despacho = inv?.despacho as any;
      const client = despacho?.client as any;

      const clientId = client?.id || "sin-cliente";
      const clientName = client?.name || "Sin cliente asignado";

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client_id: clientId,
          client_name: clientName,
          client_cuit: client?.cuit || null,
          imports: [],
        });
      }

      clientMap.get(clientId)!.imports.push({
        despacho_ref: despacho?.reference || null,
        invoice_file: inv.file_name,
        invoice_date: inv.created_at,
        quantity: item.quantity,
        total_price: item.total_price,
        currency: item.currency,
      });
    }

    return NextResponse.json({
      importers: Array.from(clientMap.values()),
    });
  } catch (error) {
    console.error("Importers fetch error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

**Step 2: Build to verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/app/api/catalog/[id]/importers/
git commit -m "add importers API for catalog products"
```

---

### Task 2: Add client_id filter to catalog API

**Files:**
- Modify: `src/app/api/catalog/route.ts`

**Step 1: Add client_id filter**

After the existing `provider_id` filter (line 31-33), add a `client_id` filter. This requires a subquery: find provider_ids from invoices linked to despachos of this client, then filter catalog by those providers.

```typescript
// After provider_id filter
const clientId = searchParams.get("client_id") || "";

if (clientId) {
  // Find provider_ids from invoices linked to this client's despachos
  const { data: clientInvoices } = await supabase
    .from("invoices")
    .select("provider_id, despacho:despachos!inner(client_id)")
    .eq("despacho.client_id", clientId)
    .not("provider_id", "is", null);

  const providerIds = [...new Set((clientInvoices || []).map((inv: any) => inv.provider_id).filter(Boolean))];

  if (providerIds.length > 0) {
    query = query.in("provider_id", providerIds);
  } else {
    // No invoices for this client, return empty
    return NextResponse.json({ items: [], total: 0, page, limit, totalPages: 0 });
  }
}
```

**Step 2: Build, commit**

```bash
npm run build
git add src/app/api/catalog/route.ts
git commit -m "add client_id filter to catalog API"
```

---

### Task 3: Refactor catálogo page with tabs

**Files:**
- Modify: `src/app/(dashboard)/catalogo/page.tsx`

**Step 1: Add tab state and UI**

Add a tab switcher at the top: "Proveedores" (current view) and "Mercadería" (new view). The existing provider list becomes the content of the "Proveedores" tab.

Tab UI: two buttons below the header, styled as pills/segments.

```tsx
const [activeTab, setActiveTab] = useState<"proveedores" | "mercaderia">("proveedores");
```

Tab buttons:
```tsx
<div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6">
  <button
    onClick={() => setActiveTab("proveedores")}
    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      activeTab === "proveedores"
        ? "bg-white text-gray-900 shadow-sm"
        : "text-gray-500 hover:text-gray-700"
    }`}
  >
    Proveedores
  </button>
  <button
    onClick={() => setActiveTab("mercaderia")}
    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
      activeTab === "mercaderia"
        ? "bg-white text-gray-900 shadow-sm"
        : "text-gray-500 hover:text-gray-700"
    }`}
  >
    Mercadería
  </button>
</div>
```

Wrap the existing provider list in `{activeTab === "proveedores" && (...)}`.

For the "mercadería" tab, render a placeholder for now: `{activeTab === "mercaderia" && <MercaderiaSearch />}`.

**Step 2: Extract provider list into its own section**

Move the search input, stats, and provider list into a conditional block for the "proveedores" tab. The header stays outside (shared).

**Step 3: Build, commit**

```bash
npm run build
git add "src/app/(dashboard)/catalogo/page.tsx"
git commit -m "add tabs to catalogo page"
```

---

### Task 4: Build MercaderiaSearch component

**Files:**
- Create: `src/components/catalog/mercaderia-search.tsx`

**Step 1: Create the component**

"use client" component. Structure:

1. **Search bar** — text input with search icon, debounced 400ms
2. **Advanced filters toggle** — "Filtros" button that expands/collapses filter section
3. **Filters section** (collapsible):
   - Proveedor: dropdown (fetch from `/api/providers`)
   - NCM: text input
   - Cliente: dropdown (fetch from `/api/clients`)
4. **Results list** — fetch from `/api/catalog?search=...&provider_id=...&page=...`
5. **Pagination** — simple prev/next with page count
6. **Empty/loading states**

Each result is a card (details in Task 5).

```typescript
interface MercaderiaSearchProps {}

export function MercaderiaSearch({}: MercaderiaSearchProps) {
  // Search
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterProvider, setFilterProvider] = useState("");
  const [filterNcm, setFilterNcm] = useState("");
  const [filterClient, setFilterClient] = useState("");

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  // Dropdown data
  const [providers, setProviders] = useState<{id: string; name: string}[]>([]);
  const [clients, setClients] = useState<{id: string; name: string}[]>([]);

  // Expanded card
  const [expandedId, setExpandedId] = useState<string | null>(null);
```

Fetch results:
```typescript
useEffect(() => {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (filterProvider) params.set("provider_id", filterProvider);
  if (filterClient) params.set("client_id", filterClient);
  params.set("page", String(page));
  params.set("limit", "20");

  setLoading(true);
  fetch(`/api/catalog?${params}`)
    .then(res => res.json())
    .then(data => {
      setResults(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    })
    .finally(() => setLoading(false));
}, [search, filterProvider, filterClient, page]);
```

NCM filter: applied client-side on results (filter `results` where `ncm_code` starts with `filterNcm`), since the API already does ilike on search.

**Step 2: Search bar UI**

```tsx
<div className="relative">
  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
  <input
    type="text"
    placeholder="Buscar por SKU, descripción, NCM..."
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
    className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
  />
</div>
```

**Step 3: Filters UI** (collapsible section)

```tsx
<button
  onClick={() => setShowFilters(!showFilters)}
  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
>
  <Filter size={14} />
  Filtros
  <ChevronDown size={14} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
</button>

{showFilters && (
  <div className="grid grid-cols-3 gap-4 mt-3 p-4 bg-gray-50 rounded-lg">
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Proveedor</label>
      <select value={filterProvider} onChange={...} className="w-full px-3 py-2 border rounded-lg text-sm">
        <option value="">Todos</option>
        {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
    <div>
      <label>NCM</label>
      <input type="text" placeholder="Ej: 8471" value={filterNcm} onChange={...} />
    </div>
    <div>
      <label>Cliente</label>
      <select value={filterClient} onChange={...}>
        <option value="">Todos</option>
        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  </div>
)}
```

**Step 4: Build, commit**

```bash
npm run build
git add src/components/catalog/mercaderia-search.tsx
git commit -m "add MercaderiaSearch component with filters"
```

---

### Task 5: Add expandable result cards

**Files:**
- Modify: `src/components/catalog/mercaderia-search.tsx`

**Step 1: Closed card**

Each result shows:
- SKU (monospace, small)
- Provider description (truncated)
- NCM code (mono, badge-like)
- Provider name (small, gray)
- Times used (small counter)
- Chevron icon to expand

```tsx
<div
  key={item.id}
  className="bg-white rounded-xl border hover:border-[#2E86C1]/30 transition-all"
>
  <button
    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
    className="w-full text-left p-4 flex items-center gap-4"
  >
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-3">
        {item.sku && <span className="font-mono text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.sku}</span>}
        <span className="text-sm text-gray-900 truncate">{item.provider_description}</span>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <span className="font-mono text-xs text-[#2E86C1] font-medium">{item.ncm_code}</span>
        <span className="text-xs text-gray-400">{item.provider?.name}</span>
      </div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-xs text-gray-400">{item.times_used}x</span>
      <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedId === item.id ? "rotate-180" : ""}`} />
    </div>
  </button>
```

**Step 2: Expanded section**

When expanded, show:
1. Full descriptions (customs, internal)
2. Flags (LATU, IMESI, Exonera IVA, Apertura)
3. Provider info (name, country)
4. Importers section — fetch from `/api/catalog/{id}/importers` on expand

```tsx
{expandedId === item.id && (
  <div className="border-t px-4 pb-4 pt-3 space-y-4">
    {/* Descriptions */}
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-medium text-gray-500">Descripción Aduanera</p>
        <p className="text-sm text-gray-700 mt-0.5">{item.customs_description || "—"}</p>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">Descripción Interna</p>
        <p className="text-sm text-gray-700 mt-0.5">{item.internal_description || "—"}</p>
      </div>
    </div>

    {/* Flags */}
    <div className="flex items-center gap-3">
      {item.latu && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">LATU</span>}
      {item.imesi && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">IMESI</span>}
      {item.exonera_iva && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">Exonera IVA</span>}
      {item.apertura != null && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">Apertura: {item.apertura}</span>}
    </div>

    {/* Importers (loaded on expand) */}
    <ImportersSection productId={item.id} />
  </div>
)}
```

**Step 3: ImportersSection sub-component**

Fetches `/api/catalog/{id}/importers` on mount. Shows:
- Loading spinner while fetching
- "Sin importaciones registradas" if empty
- Table grouped by client: client name, CUIT, then sub-rows with despacho ref, fecha, cantidad, valor

```tsx
function ImportersSection({ productId }: { productId: string }) {
  const [importers, setImporters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/catalog/${productId}/importers`)
      .then(res => res.json())
      .then(data => setImporters(data.importers || []))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) return <Loader2 size={16} className="animate-spin text-[#2E86C1]" />;
  if (importers.length === 0) return <p className="text-xs text-gray-400">Sin importaciones registradas</p>;

  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-2">Importadores</p>
      <div className="space-y-3">
        {importers.map(imp => (
          <div key={imp.client_id} className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-900">{imp.client_name}</span>
              {imp.client_cuit && <span className="text-xs text-gray-400">CUIT: {imp.client_cuit}</span>}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="text-left font-medium pb-1">Despacho</th>
                  <th className="text-left font-medium pb-1">Factura</th>
                  <th className="text-left font-medium pb-1">Fecha</th>
                  <th className="text-right font-medium pb-1">Cantidad</th>
                  <th className="text-right font-medium pb-1">Valor</th>
                </tr>
              </thead>
              <tbody>
                {imp.imports.map((row, i) => (
                  <tr key={i} className="text-gray-600">
                    <td className="py-0.5">{row.despacho_ref || "—"}</td>
                    <td className="py-0.5 truncate max-w-[150px]">{row.invoice_file}</td>
                    <td className="py-0.5">{formatDate(row.invoice_date)}</td>
                    <td className="py-0.5 text-right">{row.quantity ?? "—"}</td>
                    <td className="py-0.5 text-right">{formatCurrency(row.total_price, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 4: Build, commit**

```bash
npm run build
git add src/components/catalog/mercaderia-search.tsx
git commit -m "add expandable cards with importers to mercaderia search"
```

---

### Task 6: Wire MercaderiaSearch into catálogo page

**Files:**
- Modify: `src/app/(dashboard)/catalogo/page.tsx`

**Step 1: Import and render**

Import `MercaderiaSearch` from `@/components/catalog/mercaderia-search` and render it in the "mercaderia" tab.

```tsx
import { MercaderiaSearch } from "@/components/catalog/mercaderia-search";

// In the render, after providers tab:
{activeTab === "mercaderia" && <MercaderiaSearch />}
```

**Step 2: Update subtitle**

Change the subtitle text to be tab-aware:
- Proveedores tab: current text
- Mercadería tab: "Buscá productos por SKU, descripción o NCM. Expandí un resultado para ver proveedores e importadores."

**Step 3: Build, commit**

```bash
npm run build
git add "src/app/(dashboard)/catalogo/page.tsx"
git commit -m "wire MercaderiaSearch component into catalogo page"
```

---

### Task 7: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Manual testing checklist**

1. Go to `/catalogo` → see "Proveedores" and "Mercadería" tabs
2. Click "Mercadería" → search bar appears
3. Type a product description → results appear (debounced)
4. Click "Filtros" → filter section expands with proveedor, NCM, cliente dropdowns
5. Select a proveedor filter → results filter to that provider
6. Select a cliente filter → results filter to products imported by that client
7. Click a result card → expands showing descriptions, flags, importers
8. Importers section shows client name, CUIT, import history table
9. Switch back to "Proveedores" tab → existing functionality works unchanged

**Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "busqueda mercaderia feature complete"
```
