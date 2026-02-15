"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Loader2,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Package,
  Plus,
  X,
  Building2,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

// --- Types ---

interface ProviderOption {
  id: string;
  name: string;
}

interface ClientOption {
  id: string;
  name: string;
  cuit: string | null;
}

interface CatalogItem {
  id: string;
  sku: string | null;
  provider_description: string;
  customs_description: string;
  internal_description: string | null;
  ncm_code: string;
  times_used: number;
  latu: boolean | null;
  imesi: boolean | null;
  exonera_iva: boolean | null;
  apertura: number | null;
  provider: { id: string; name: string } | null;
}

interface ImportRecord {
  despacho_ref: string | null;
  invoice_file: string;
  invoice_date: string;
  quantity: number | null;
  total_price: number | null;
  currency: string;
}

interface Importer {
  client_id: string;
  client_name: string;
  client_cuit: string | null;
  imports: ImportRecord[];
}

// --- ImportersSection sub-component ---

function ImportersSection({ productId }: { productId: string }) {
  const [importers, setImporters] = useState<Importer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImporters = async () => {
      try {
        const res = await fetch(`/api/catalog/${productId}/importers`);
        if (res.ok) {
          const data = await res.json();
          setImporters(data.importers || []);
        }
      } catch (err) {
        console.error("Error fetching importers:", err);
      }
      setLoading(false);
    };
    fetchImporters();
  }, [productId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        Cargando importadores...
      </div>
    );
  }

  if (importers.length === 0) {
    return (
      <div className="py-4 text-sm text-gray-400 text-center">
        No se encontraron importaciones para este producto.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <Users size={12} />
        Importadores
      </div>
      {importers.map((imp) => (
        <div
          key={imp.client_id}
          className="bg-gray-50 rounded-lg border border-gray-100 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium text-gray-900">
                {imp.client_name}
              </span>
              {imp.client_cuit && (
                <span className="ml-2 text-xs text-gray-400">
                  CUIT: {imp.client_cuit}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              {imp.imports.length} importacion{imp.imports.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="text-left py-1 pr-3 font-medium">Despacho</th>
                  <th className="text-left py-1 pr-3 font-medium">Factura</th>
                  <th className="text-left py-1 pr-3 font-medium">Fecha</th>
                  <th className="text-right py-1 pr-3 font-medium">Cantidad</th>
                  <th className="text-right py-1 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {imp.imports.map((rec, idx) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-600">
                      {rec.despacho_ref || "-"}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-600 max-w-[150px] truncate">
                      {rec.invoice_file}
                    </td>
                    <td className="py-1.5 pr-3 text-gray-500">
                      {formatDate(rec.invoice_date)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-gray-600">
                      {rec.quantity ?? "-"}
                    </td>
                    <td className="py-1.5 text-right text-gray-600">
                      {formatCurrency(rec.total_price, rec.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main MercaderiaSearch component ---

export default function MercaderiaSearch() {
  // Search & filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [ncmFilter, setNcmFilter] = useState("");
  const [clientId, setClientId] = useState("");

  // Filter options
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);

  // Results
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);

  // Expanded cards
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [provRes, clientRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/clients"),
        ]);
        if (provRes.ok) {
          const data = await provRes.json();
          setProviders(
            (data.providers || []).map((p: ProviderOption) => ({
              id: p.id,
              name: p.name,
            }))
          );
        }
        if (clientRes.ok) {
          const data = await clientRes.json();
          setClients(
            (Array.isArray(data) ? data : []).map((c: ClientOption) => ({
              id: c.id,
              name: c.name,
              cuit: c.cuit,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching filter options:", err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch catalog items
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (providerId) params.set("provider_id", providerId);
      if (clientId) params.set("client_id", clientId);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/catalog?${params}`);
      if (res.ok) {
        const data = await res.json();
        let filtered = data.items || [];

        // Client-side NCM prefix filter
        if (ncmFilter.trim()) {
          filtered = filtered.filter((item: CatalogItem) =>
            item.ncm_code?.startsWith(ncmFilter.trim())
          );
        }

        setItems(filtered);
        setTotal(ncmFilter.trim() ? filtered.length : data.total || 0);
        setTotalPages(ncmFilter.trim() ? 1 : data.totalPages || 0);
      }
    } catch (err) {
      console.error("Error fetching catalog:", err);
    }
    setLoading(false);
  }, [search, providerId, clientId, ncmFilter, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [providerId, clientId, ncmFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

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

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción, NCM..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showFilters
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
          }`}
        >
          <Filter size={14} />
          Filtros
        </button>
        <button
          onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={14} />
          Nueva
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Proveedor
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Todos</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              NCM (prefijo)
            </label>
            <input
              type="text"
              placeholder="Ej: 6204"
              value={ncmFilter}
              onChange={(e) => setNcmFilter(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Cliente
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500 mb-3">
        {loading ? (
          "Buscando..."
        ) : (
          <>
            {total} producto{total !== 1 ? "s" : ""} encontrado
            {total !== 1 ? "s" : ""}
          </>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#2563EB]" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Package size={32} className="mx-auto mb-2 text-gray-300" />
            {search || providerId || clientId || ncmFilter
              ? "No se encontraron productos con esos filtros."
              : "No hay productos en el catálogo todavía."}
          </div>
        ) : (
          items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border hover:border-gray-300 transition-colors"
              >
                {/* Closed card header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  {/* SKU badge */}
                  {item.sku && (
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-[11px] font-mono text-gray-600 flex-shrink-0">
                      {item.sku}
                    </span>
                  )}

                  {/* Provider description */}
                  <span className="flex-1 text-sm text-gray-900 truncate min-w-0">
                    {item.provider_description}
                  </span>

                  {/* NCM code */}
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-[11px] font-mono text-[#2563EB] flex-shrink-0">
                    {item.ncm_code}
                  </span>

                  {/* Provider name */}
                  {item.provider && (
                    <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:inline">
                      {item.provider.name}
                    </span>
                  )}

                  {/* Times used */}
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                    {item.times_used}x
                  </span>

                  {/* Chevron */}
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 flex-shrink-0 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    {/* Descriptions */}
                    <div className="space-y-2 mb-3">
                      {item.customs_description && (
                        <div>
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                            Descripción aduanera
                          </span>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {item.customs_description}
                          </p>
                        </div>
                      )}
                      {item.internal_description && (
                        <div>
                          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                            Descripción interna
                          </span>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {item.internal_description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.latu && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700">
                          LATU
                        </span>
                      )}
                      {item.imesi && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700">
                          IMESI
                        </span>
                      )}
                      {item.exonera_iva && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          Exonera IVA
                        </span>
                      )}
                      {item.apertura != null && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                          Apertura: {item.apertura}
                        </span>
                      )}
                    </div>

                    {/* Importers section */}
                    <ImportersSection productId={item.id} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
            <ChevronRight size={14} />
          </button>
        </div>
      )}

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
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                            <Loader2 size={14} className="animate-spin text-[#2563EB]" />
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
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] ${
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
                              className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCreateProviderInModal();
                              }}
                            />
                            <button
                              onClick={handleCreateProviderInModal}
                              disabled={creatingProvider || !newProviderName.trim()}
                              className="px-2 py-1 rounded bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
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
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="Código del producto"
                />
              </div>

              {/* Provider description */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Descripción del proveedor
                </label>
                <textarea
                  value={newProduct.provider_description}
                  onChange={(e) => setNewProduct((p) => ({ ...p, provider_description: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px] resize-y"
                  placeholder="Descripción del producto"
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
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px] resize-y"
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
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px] resize-y"
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
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                disabled={creating || !newProduct.provider_id || !newProduct.sku.trim()}
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Crear producto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
