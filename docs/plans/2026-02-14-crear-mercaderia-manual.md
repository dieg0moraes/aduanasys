# Crear Mercadería Manual — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to manually create products in the catalog without going through an invoice, via a modal form in the Mercadería tab.

**Architecture:** Add a POST handler to the existing `/api/catalog` route. In the frontend, add a "Nueva Mercadería" button and modal form to `mercaderia-search.tsx`. The modal includes a provider selector (with create new), required fields (SKU, description), and optional fields (NCM, flags, etc.). On save, POST to API, close modal, refresh results.

**Tech Stack:** Next.js 16, React 19, Supabase, Tailwind CSS, lucide-react

---

### Task 1: Add POST endpoint to catalog API

**Files:**
- Modify: `src/app/api/catalog/route.ts`

**Step 1: Add POST handler**

Add a `POST` export after the existing GET handler. It creates a new product in `product_catalog`.

```typescript
/**
 * POST /api/catalog
 * Crea un nuevo producto en el catálogo.
 * Body: { provider_id, sku, provider_description, customs_description?, ncm_code?, ... }
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.provider_id) {
      return NextResponse.json({ error: "Proveedor es obligatorio" }, { status: 400 });
    }
    if (!body.sku || !body.sku.trim()) {
      return NextResponse.json({ error: "SKU es obligatorio" }, { status: 400 });
    }
    if (!body.provider_description || !body.provider_description.trim()) {
      return NextResponse.json({ error: "Descripción del proveedor es obligatoria" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("product_catalog")
      .insert({
        provider_id: body.provider_id,
        sku: body.sku.trim(),
        provider_description: body.provider_description.trim(),
        customs_description: body.customs_description?.trim() || "",
        internal_description: body.internal_description?.trim() || null,
        ncm_code: body.ncm_code?.trim() || "",
        latu: body.latu ?? null,
        imesi: body.imesi ?? null,
        exonera_iva: body.exonera_iva ?? null,
        apertura: body.apertura ?? null,
        times_used: 0,
        last_used_at: new Date().toISOString(),
      })
      .select("*, provider:providers(id, name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU para este proveedor" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Catalog create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/app/api/catalog/route.ts
git commit -m "feat: add POST endpoint for manual product creation in catalog"
```

---

### Task 2: Add "Nueva Mercadería" button and modal to MercaderiaSearch

**Files:**
- Modify: `src/components/catalog/mercaderia-search.tsx`

This is the main task. It adds a button next to the search bar and a modal form for creating a new product.

**Step 1: Add imports**

Add `Plus`, `X`, and `Building2` to the lucide-react imports (line 4-13). The existing imports already have `Search`, `Loader2`, `Filter`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `Users`, `Package`.

**Step 2: Add modal state**

In the `MercaderiaSearch` component, after the `expandedId` state (line 188), add:

```typescript
  // Create product modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newProduct, setNewProduct] = useState({
    provider_id: "",
    sku: "",
    provider_description: "",
    customs_description: "",
    internal_description: "",
    ncm_code: "",
    latu: null as boolean | null,
    imesi: null as boolean | null,
    exonera_iva: null as boolean | null,
    apertura: null as number | null,
  });

  // Provider search for modal
  const [modalProviderSearch, setModalProviderSearch] = useState("");
  const [modalProviders, setModalProviders] = useState<ProviderOption[]>([]);
  const [loadingModalProviders, setLoadingModalProviders] = useState(false);
  const [showModalProviderDropdown, setShowModalProviderDropdown] = useState(false);
  const [selectedProviderName, setSelectedProviderName] = useState("");
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
```

**Step 3: Add provider fetch for modal and create handlers**

After the `toggleExpand` function (line 277), add:

```typescript
  // Fetch providers for create modal
  useEffect(() => {
    if (!showModalProviderDropdown) return;

    const timer = setTimeout(async () => {
      setLoadingModalProviders(true);
      try {
        const params = new URLSearchParams();
        if (modalProviderSearch.trim()) params.set("search", modalProviderSearch.trim());
        const res = await fetch(`/api/providers?${params}`);
        if (res.ok) {
          const data = await res.json();
          setModalProviders(data.providers || []);
        }
      } catch {
        // ignore
      }
      setLoadingModalProviders(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [showModalProviderDropdown, modalProviderSearch]);

  const handleCreateProviderInModal = async () => {
    if (!newProviderName.trim()) return;
    setCreatingProvider(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProviderName.trim() }),
      });
      if (res.ok) {
        const provider = await res.json();
        setNewProduct((p) => ({ ...p, provider_id: provider.id }));
        setSelectedProviderName(provider.name);
        setShowModalProviderDropdown(false);
        setNewProviderName("");
        setModalProviderSearch("");
      }
    } catch {
      // ignore
    }
    setCreatingProvider(false);
  };

  const resetCreateForm = () => {
    setNewProduct({
      provider_id: "",
      sku: "",
      provider_description: "",
      customs_description: "",
      internal_description: "",
      ncm_code: "",
      latu: null,
      imesi: null,
      exonera_iva: null,
      apertura: null,
    });
    setSelectedProviderName("");
    setCreateError("");
  };

  const handleCreateProduct = async () => {
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        setShowCreateModal(false);
        resetCreateForm();
        fetchItems();
      } else {
        const err = await res.json();
        setCreateError(err.error || "Error al crear producto");
      }
    } catch {
      setCreateError("Error de conexión");
    }
    setCreating(false);
  };
```

**Step 4: Add "Nueva Mercadería" button**

In the JSX, in the search bar div (line 282), add a button AFTER the "Filtros" button (after line 306):

```tsx
        <button
          onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574A9] transition-colors"
        >
          <Plus size={14} />
          Nueva
        </button>
```

**Step 5: Add modal JSX**

At the very end of the component's return, just before the closing `</div>` (line 522), add the modal:

```tsx
      {/* Create product modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white rounded-t-xl">
              <h2 className="font-semibold text-gray-900">Nueva Mercadería</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {createError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {createError}
                </div>
              )}

              {/* Provider selector */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Proveedor <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  {showModalProviderDropdown ? (
                    <div>
                      <input
                        type="text"
                        value={modalProviderSearch}
                        onChange={(e) => setModalProviderSearch(e.target.value)}
                        placeholder="Buscar proveedor..."
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setShowModalProviderDropdown(false);
                            setModalProviderSearch("");
                          }
                        }}
                      />
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {loadingModalProviders ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 size={14} className="animate-spin text-[#2E86C1]" />
                          </div>
                        ) : (
                          <>
                            {modalProviders.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  setNewProduct((prev) => ({ ...prev, provider_id: p.id }));
                                  setSelectedProviderName(p.name);
                                  setShowModalProviderDropdown(false);
                                  setModalProviderSearch("");
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EBF5FB] ${
                                  newProduct.provider_id === p.id ? "bg-blue-50 font-medium" : ""
                                }`}
                              >
                                {p.name}
                              </button>
                            ))}
                            {modalProviders.length === 0 && modalProviderSearch.trim() && (
                              <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                            )}
                          </>
                        )}
                        {/* Create new provider */}
                        <div className="border-t px-3 py-2">
                          <p className="text-xs text-gray-400 mb-1.5">Crear nuevo proveedor</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newProviderName}
                              onChange={(e) => setNewProviderName(e.target.value)}
                              placeholder="Nombre"
                              className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateProviderInModal();
                              }}
                            />
                            <button
                              onClick={handleCreateProviderInModal}
                              disabled={creatingProvider || !newProviderName.trim()}
                              className="px-2 py-1 rounded bg-[#2E86C1] text-white text-xs font-medium hover:bg-[#2574A9] disabled:opacity-50"
                            >
                              {creatingProvider ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowModalProviderDropdown(true)}
                      className="flex items-center gap-2 w-full px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 text-left"
                    >
                      <Building2 size={14} className="text-gray-400" />
                      {selectedProviderName ? (
                        <span className="text-gray-900">{selectedProviderName}</span>
                      ) : (
                        <span className="text-gray-400">Seleccionar proveedor</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  SKU <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct((p) => ({ ...p, sku: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  placeholder="Código del producto"
                />
              </div>

              {/* Provider description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Descripción del proveedor <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={newProduct.provider_description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, provider_description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[60px] resize-y"
                  placeholder="Descripción tal como aparece en la factura"
                />
              </div>

              {/* Customs description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Descripción aduanera
                </label>
                <textarea
                  value={newProduct.customs_description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, customs_description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[60px] resize-y"
                  placeholder="Descripción para aduana"
                />
              </div>

              {/* Internal description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Descripción interna
                </label>
                <textarea
                  value={newProduct.internal_description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, internal_description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[60px] resize-y"
                  placeholder="Descripción para uso interno"
                />
              </div>

              {/* NCM */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  NCM
                </label>
                <input
                  type="text"
                  value={newProduct.ncm_code}
                  onChange={(e) => setNewProduct((p) => ({ ...p, ncm_code: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  placeholder="Ej: 6204.62.00.00"
                />
              </div>

              {/* Flags row */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">LATU</label>
                  <select
                    value={newProduct.latu === null ? "" : newProduct.latu ? "true" : "false"}
                    onChange={(e) => setNewProduct((p) => ({ ...p, latu: e.target.value === "" ? null : e.target.value === "true" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    <option value="">—</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">IMESI</label>
                  <select
                    value={newProduct.imesi === null ? "" : newProduct.imesi ? "true" : "false"}
                    onChange={(e) => setNewProduct((p) => ({ ...p, imesi: e.target.value === "" ? null : e.target.value === "true" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    <option value="">—</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Exonera IVA</label>
                  <select
                    value={newProduct.exonera_iva === null ? "" : newProduct.exonera_iva ? "true" : "false"}
                    onChange={(e) => setNewProduct((p) => ({ ...p, exonera_iva: e.target.value === "" ? null : e.target.value === "true" }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  >
                    <option value="">—</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Apertura</label>
                  <input
                    type="number"
                    value={newProduct.apertura ?? ""}
                    onChange={(e) => setNewProduct((p) => ({ ...p, apertura: e.target.value === "" ? null : Number(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    placeholder="—"
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 p-4 border-t sticky bottom-0 bg-white rounded-b-xl">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateProduct}
                disabled={creating || !newProduct.provider_id || !newProduct.sku.trim() || !newProduct.provider_description.trim()}
                className="px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574A9] disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Crear producto
              </button>
            </div>
          </div>
        </div>
      )}
```

**Step 6: Verify build**

Run: `npm run build`
Expected: Build passes

**Step 7: Manual verification**

1. Open `/catalogo` → Mercadería tab
2. See "Nueva" button next to Filtros
3. Click → modal opens with form
4. Select proveedor, fill SKU + description → "Crear producto"
5. Product appears in search results
6. Try creating duplicate (same provider + SKU) → shows error
7. Try creating without required fields → button stays disabled

**Step 8: Commit**

```bash
git add src/components/catalog/mercaderia-search.tsx
git commit -m "feat: add manual product creation modal in mercaderia search"
```

---

### Task 3: Final verification

**Step 1: Full build**

Run: `npm run build`
Expected: Build passes clean

**Step 2: Lint**

Run: `npm run lint`
Expected: No new errors from our changes
