# Editar Proveedor de Factura — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to change the provider assigned to an invoice (before approval) and move individual catalog products between providers.

**Architecture:** Two independent UI features that share a provider search/select dropdown pattern. Part 1 adds a provider selector to the invoice detail page (reuses the country selector pattern already there). Part 2 adds a "Mover" button per product in the catalog provider detail page. Backend changes are minimal: add POST to providers API and add `provider_id` to catalog PATCH allowed fields.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, Tailwind CSS, lucide-react

---

### Task 1: Add POST endpoint to providers API

**Files:**
- Modify: `src/app/api/providers/route.ts`

**Step 1: Add POST handler**

Add a `POST` export to the existing file that creates a new provider given a `name`. This is needed for the "Crear nuevo" option in the provider selector.

```typescript
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 });
    }

    // Check if provider with same name already exists (case-insensitive)
    const { data: existing } = await supabase
      .from("providers")
      .select("id, name")
      .ilike("name", name.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(existing[0]);
    }

    const { data, error } = await supabase
      .from("providers")
      .insert({ name: name.trim() })
      .select("id, name, country, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Provider create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes with no errors

**Step 3: Commit**

```bash
git add src/app/api/providers/route.ts
git commit -m "feat: add POST endpoint for creating providers"
```

---

### Task 2: Add `provider_id` to catalog PATCH allowed fields

**Files:**
- Modify: `src/app/api/catalog/route.ts`

**Step 1: Add `provider_id` to the allowedUpdates whitelist**

In the PATCH handler (around line 113-126), add `provider_id` to the whitelist. Also add a check for unique constraint violation (`(provider_id, sku)`) and return a descriptive error.

In the PATCH handler, after the existing `allowedUpdates` construction (after line 126), add:

```typescript
    if (updates.provider_id !== undefined)
      allowedUpdates.provider_id = updates.provider_id;
```

Also wrap the update call to catch unique constraint violations. Replace the existing update + error handling block (lines 130-143) with:

```typescript
    console.log("[Catalog PATCH] id:", id, "updates:", allowedUpdates);

    const { data, error } = await supabase
      .from("product_catalog")
      .update(allowedUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Catalog PATCH] Error:", error);
      // Unique constraint violation (provider_id + sku)
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un producto con ese SKU para el proveedor destino" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[Catalog PATCH] Success, updated row:", data?.id);
    return NextResponse.json(data);
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build passes with no errors

**Step 3: Commit**

```bash
git add src/app/api/catalog/route.ts
git commit -m "feat: allow provider_id update in catalog PATCH with conflict detection"
```

---

### Task 3: Add provider selector to invoice detail page

**Files:**
- Modify: `src/app/(dashboard)/facturas/[id]/page.tsx`

This is the largest task. It adds a provider selector dropdown (same pattern as the country selector already on this page) that lets the user change or assign the invoice's provider.

**Step 1: Add state variables**

After the country selector state variables (line 45), add:

```typescript
  // Provider selector
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
```

**Step 2: Add provider fetch function**

After the `filteredCountries` computation (line 149), add:

```typescript
  // Fetch providers when dropdown opens or search changes
  useEffect(() => {
    if (!showProviderDropdown) return;

    const timer = setTimeout(async () => {
      setLoadingProviders(true);
      try {
        const params = new URLSearchParams();
        if (providerSearch.trim()) params.set("search", providerSearch.trim());
        const res = await fetch(`/api/providers?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
        }
      } catch {
        // ignore
      }
      setLoadingProviders(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [showProviderDropdown, providerSearch]);

  const handleProviderSelect = async (providerId: string | null) => {
    setSavingProvider(true);
    setShowProviderDropdown(false);
    setProviderSearch("");
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: providerId }),
    });
    if (res.ok) {
      // Refetch invoice to get the joined provider data
      await fetchInvoice();
    }
    setSavingProvider(false);
  };

  const handleCreateProvider = async () => {
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
        // Assign the new provider to this invoice
        await handleProviderSelect(provider.id);
        setNewProviderName("");
      }
    } catch {
      // ignore
    }
    setCreatingProvider(false);
  };

  const canEditProvider = invoice?.status === "uploaded" || invoice?.status === "review";
```

**Step 3: Add provider selector UI**

In the JSX, add a new card between the header actions `</div>` and the `{/* Error */}` section (after line 412, before line 414). This goes right below the header, before the error banner.

Add a provider selector card similar to the country selector card:

```tsx
      {/* Provider selector */}
      {canEditProvider && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-gray-400 shrink-0" />
            <label className="text-sm font-medium text-gray-700 shrink-0">
              Proveedor
            </label>
            <div className="relative flex-1 max-w-sm">
              {showProviderDropdown ? (
                <div>
                  <input
                    type="text"
                    value={providerSearch}
                    onChange={(e) => setProviderSearch(e.target.value)}
                    placeholder="Buscar proveedor..."
                    className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setShowProviderDropdown(false);
                        setProviderSearch("");
                      }
                    }}
                  />
                  <div
                    className="fixed inset-0 z-[9]"
                    onClick={() => { setShowProviderDropdown(false); setProviderSearch(""); }}
                  />
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {invoice?.provider_id && (
                      <button
                        onClick={() => handleProviderSelect(null)}
                        className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 border-b"
                      >
                        Quitar proveedor
                      </button>
                    )}
                    {loadingProviders ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 size={16} className="animate-spin text-[#2E86C1]" />
                      </div>
                    ) : (
                      <>
                        {providers.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleProviderSelect(p.id)}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EBF5FB] ${
                              invoice?.provider_id === p.id ? "bg-blue-50 font-medium" : ""
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
                        {providers.length === 0 && providerSearch.trim() && (
                          <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                        )}
                      </>
                    )}
                    {/* Create new */}
                    <div className="border-t px-3 py-2">
                      <p className="text-xs text-gray-400 mb-1.5">Crear nuevo proveedor</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newProviderName}
                          onChange={(e) => setNewProviderName(e.target.value)}
                          placeholder="Nombre del proveedor"
                          className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateProvider();
                          }}
                        />
                        <button
                          onClick={handleCreateProvider}
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
                  onClick={() => setShowProviderDropdown(true)}
                  className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition-colors w-full text-left"
                >
                  {savingProvider ? (
                    <Loader2 size={14} className="animate-spin text-[#2E86C1]" />
                  ) : invoice?.provider?.name ? (
                    <span className="text-gray-900">{invoice.provider.name}</span>
                  ) : (
                    <span className="text-gray-400">Sin proveedor asignado</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider display (when not editable) */}
      {!canEditProvider && invoice?.provider?.name && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center gap-3">
            <Building2 size={16} className="text-gray-400 shrink-0" />
            <label className="text-sm font-medium text-gray-700 shrink-0">
              Proveedor
            </label>
            <span className="text-sm text-gray-900">{invoice.provider.name}</span>
          </div>
        </div>
      )}
```

Note: `Building2` needs to be added to the lucide-react imports at the top of the file. It's already imported in the catalog page but not in this file. Add `Building2` to the import list on line 8.

**Step 4: Verify build**

Run: `npm run build`
Expected: Build passes with no errors

**Step 5: Manual verification**

1. Open a factura in status "uploaded" or "review"
2. See provider selector card below header
3. Click to open dropdown → see list of providers
4. Select a provider → verify it saves
5. Type in "Crear nuevo" section → create provider → verify it assigns
6. Open a factura in status "approved" → see provider as read-only text (not editable)

**Step 6: Commit**

```bash
git add src/app/(dashboard)/facturas/[id]/page.tsx
git commit -m "feat: add provider selector to invoice detail page"
```

---

### Task 4: Add "Mover a otro proveedor" to catalog detail page

**Files:**
- Modify: `src/app/(dashboard)/catalogo/[providerId]/page.tsx`

This adds a "Mover" button in each product's expanded edit panel that opens a provider selector dropdown and moves the product via PATCH.

**Step 1: Add state variables**

After the `showInvoices` state (line 72), add:

```typescript
  // Move product
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveProviderSearch, setMoveProviderSearch] = useState("");
  const [moveProviders, setMoveProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingMoveProviders, setLoadingMoveProviders] = useState(false);
  const [movingInProgress, setMovingInProgress] = useState(false);
```

**Step 2: Add provider fetch and move functions**

After the `deleteItem` function (line 218), add:

```typescript
  // Fetch providers for move dropdown
  useEffect(() => {
    if (!movingId) return;

    const timer = setTimeout(async () => {
      setLoadingMoveProviders(true);
      try {
        const params = new URLSearchParams();
        if (moveProviderSearch.trim()) params.set("search", moveProviderSearch.trim());
        const res = await fetch(`/api/providers?${params}`);
        if (res.ok) {
          const data = await res.json();
          // Exclude current provider
          setMoveProviders(
            (data.providers || []).filter((p: { id: string }) => p.id !== providerId)
          );
        }
      } catch {
        // ignore
      }
      setLoadingMoveProviders(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [movingId, moveProviderSearch, providerId]);

  const handleMoveProduct = async (itemId: string, targetProviderId: string, targetProviderName: string) => {
    if (!confirm(`¿Mover este producto al proveedor "${targetProviderName}"?`)) return;

    setMovingInProgress(true);
    try {
      const response = await fetch("/api/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId, provider_id: targetProviderId }),
      });

      if (response.ok) {
        // Remove from current list
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.filter((item) => item.id !== itemId),
            total: prev.total - 1,
          };
        });
        setMovingId(null);
        setMoveProviderSearch("");
      } else {
        const err = await response.json();
        alert(err.error || "Error al mover producto");
      }
    } catch {
      alert("Error de conexión");
    }
    setMovingInProgress(false);
  };
```

**Step 3: Add "Mover" button in the expanded edit panel**

In the expanded edit panel's Actions section (around line 558-585), add a "Mover" button after the "Cancelar" button. Also add the move dropdown panel below the actions.

After the `cancelEdit` button (line 583) and before the closing `</div>` of the actions section (line 585), add:

```tsx
                                <div className="ml-auto relative">
                                  {movingId === item.id ? (
                                    <div>
                                      <div
                                        className="fixed inset-0 z-[9]"
                                        onClick={(e) => { e.stopPropagation(); setMovingId(null); setMoveProviderSearch(""); }}
                                      />
                                      <div className="absolute bottom-full right-0 mb-1 w-64 bg-white border rounded-lg shadow-lg z-10">
                                        <div className="p-2 border-b">
                                          <input
                                            type="text"
                                            value={moveProviderSearch}
                                            onChange={(e) => setMoveProviderSearch(e.target.value)}
                                            placeholder="Buscar proveedor destino..."
                                            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                            onKeyDown={(e) => {
                                              if (e.key === "Escape") {
                                                setMovingId(null);
                                                setMoveProviderSearch("");
                                              }
                                            }}
                                          />
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                          {loadingMoveProviders ? (
                                            <div className="flex items-center justify-center py-3">
                                              <Loader2 size={14} className="animate-spin text-[#2E86C1]" />
                                            </div>
                                          ) : moveProviders.length === 0 ? (
                                            <p className="px-3 py-2 text-sm text-gray-400">Sin proveedores disponibles</p>
                                          ) : (
                                            moveProviders.map((p) => (
                                              <button
                                                key={p.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleMoveProduct(item.id, p.id, p.name);
                                                }}
                                                disabled={movingInProgress}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-[#EBF5FB] disabled:opacity-50"
                                              >
                                                {p.name}
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setMovingId(item.id);
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white transition-colors"
                                    >
                                      <ArrowLeft size={14} className="rotate-180" />
                                      Mover
                                    </button>
                                  )}
                                </div>
```

Note: `ArrowLeft` is already imported. We'll use it rotated 180° as a "move right" icon.

**Step 4: Verify build**

Run: `npm run build`
Expected: Build passes with no errors

**Step 5: Manual verification**

1. Open `/catalogo`, click a provider with products
2. Expand a product row (click on it)
3. See "Mover" button at the right of the actions row
4. Click "Mover" → dropdown opens above with provider search
5. Select a target provider → confirmation dialog → product disappears from current list
6. Navigate to the target provider → confirm product is there
7. Try to move a product with a conflicting SKU → should show error message

**Step 6: Commit**

```bash
git add src/app/(dashboard)/catalogo/[providerId]/page.tsx
git commit -m "feat: add move product to different provider in catalog"
```

---

### Task 5: Final verification

**Step 1: Full build check**

Run: `npm run build`
Expected: Build passes with all 4 changed files compiling correctly.

**Step 2: Lint check**

Run: `npm run lint`
Expected: No errors

**Step 3: End-to-end manual test**

1. Upload a new invoice (status "uploaded") → provider selector shows "Sin proveedor asignado"
2. Process the invoice → provider gets auto-assigned
3. Change provider to a different one via selector → saves correctly
4. Create a new provider inline → creates and assigns
5. Approve the invoice → provider becomes read-only
6. Go to catalog → expand a product → "Mover" to another provider → works
7. Try moving product that would create duplicate (provider_id, sku) → shows error
