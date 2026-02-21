"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  Upload,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import { NuevoProductoModal } from "@/components/catalog/nuevo-producto-modal";

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
  provider: { id: string; name: string; country?: string | null } | null;
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

// --- NCM confidence color helper ---

function getNcmPillClasses(timesUsed: number): string {
  if (timesUsed >= 3) {
    // High confidence - green
    return "bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]";
  } else if (timesUsed >= 1) {
    // Medium confidence - amber
    return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
  }
  // Low confidence - red
  return "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]";
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
      <div className="flex items-center gap-2 py-4 text-sm text-[#A1A1AA]">
        <Loader2 size={14} className="animate-spin" />
        Cargando importadores...
      </div>
    );
  }

  if (importers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-[#71717A] uppercase tracking-wide">
        <Users size={12} />
        Importadores
      </div>
      {importers.map((imp) => (
        <div
          key={imp.client_id}
          className="bg-[#FAFAFA] rounded-lg border border-[#F4F4F5] p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-sm font-medium text-[#18181B]">
                {imp.client_name}
              </span>
              {imp.client_cuit && (
                <span className="ml-2 text-xs text-[#A1A1AA]">
                  CUIT: {imp.client_cuit}
                </span>
              )}
            </div>
            <span className="text-xs text-[#A1A1AA]">
              {imp.imports.length} importacion{imp.imports.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#A1A1AA] border-b border-[#E4E4E7]">
                  <th className="text-left py-1 pr-3 font-medium">Cliente</th>
                  <th className="text-left py-1 pr-3 font-medium">Despacho</th>
                  <th className="text-left py-1 pr-3 font-medium">Fecha</th>
                  <th className="text-right py-1 pr-3 font-medium">Cantidad</th>
                  <th className="text-right py-1 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {imp.imports.map((rec, idx) => (
                  <tr key={idx} className="border-b border-[#F4F4F5] last:border-0">
                    <td className="py-1.5 pr-3 text-[#71717A]">
                      {imp.client_name}
                    </td>
                    <td className="py-1.5 pr-3 text-[#71717A]">
                      {rec.despacho_ref || "-"}
                    </td>
                    <td className="py-1.5 pr-3 text-[#71717A]">
                      {formatDate(rec.invoice_date)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-[#71717A]">
                      {rec.quantity ?? "-"}
                    </td>
                    <td className="py-1.5 text-right text-[#71717A]">
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


  return (
    <div>
      {/* Search bar + actions */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]"
          />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción, NCM..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-[#E4E4E7] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            showFilters
              ? "bg-[#2563EB] text-white border-[#2563EB]"
              : "bg-white text-[#71717A] border-[#E4E4E7] hover:border-[#A1A1AA]"
          }`}
        >
          <Filter size={14} />
          Filtros
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={14} />
          Nuevo Producto
        </button>
        <Link
          href="/catalogo/importar"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] transition-colors"
        >
          <Upload size={14} />
          Importar Excel
        </Link>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 p-4 bg-[#FAFAFA] rounded-lg border border-[#F4F4F5]">
          <div>
            <label className="block text-xs font-medium text-[#71717A] mb-1">
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
            <label className="block text-xs font-medium text-[#71717A] mb-1">
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
            <label className="block text-xs font-medium text-[#71717A] mb-1">
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
      <div className="text-sm text-[#71717A] mb-3">
        {loading ? (
          "Buscando..."
        ) : (
          <>{total} productos encontrados</>
        )}
      </div>

      {/* Results list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#2563EB]" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-[#A1A1AA]">
            <Package size={32} className="mx-auto mb-2 text-[#A1A1AA]" />
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
                className={`bg-white rounded-xl border border-[#E4E4E7] transition-colors ${
                  isExpanded
                    ? "border-l-3 border-l-[#2563EB]"
                    : "hover:border-[#E4E4E7]"
                }`}
              >
                {/* Collapsed card header */}
                <button
                  onClick={() => toggleExpand(item.id)}
                  className="w-full text-left"
                >
                  {/* Line 1: SKU + description + NCM pill + chevron */}
                  <div className="flex items-center gap-3 px-4 pt-3 pb-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {item.sku && (
                        <span className="bg-[#F4F4F5] px-2 py-0.5 rounded text-xs font-mono text-[#71717A] flex-shrink-0">
                          {item.sku}
                        </span>
                      )}
                      <span className="text-sm text-[#18181B] truncate min-w-0">
                        {item.provider_description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono flex-shrink-0 ${getNcmPillClasses(item.times_used)}`}
                      >
                        {item.ncm_code}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-[#A1A1AA] transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Line 2: provider name, country, times used */}
                  <div className="flex items-center gap-3 px-4 pb-3 text-xs text-[#A1A1AA]">
                    {item.provider && (
                      <span>{item.provider.name}</span>
                    )}
                    {item.provider?.country && (
                      <>
                        <span className="text-[#A1A1AA]">·</span>
                        <span>{item.provider.country}</span>
                      </>
                    )}
                    <span className="text-[#A1A1AA]">·</span>
                    <span>{item.times_used} uso{item.times_used !== 1 ? "s" : ""}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[#F4F4F5] pt-3">
                    {/* Descriptions */}
                    <div className="space-y-2 mb-3">
                      {item.customs_description && (
                        <div>
                          <span className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                            Descripción aduanera
                          </span>
                          <p className="text-sm text-[#18181B] mt-0.5">
                            {item.customs_description}
                          </p>
                        </div>
                      )}
                      {item.internal_description && (
                        <div>
                          <span className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">
                            Descripción interna
                          </span>
                          <p className="text-sm text-[#18181B] mt-0.5">
                            {item.internal_description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Flag pills */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {item.latu && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F3FF] text-[#9333EA]">
                          LATU
                        </span>
                      )}
                      {item.imesi && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF7ED] text-[#EA580C]">
                          IMESI
                        </span>
                      )}
                      {item.exonera_iva && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F0FDF4] text-[#16A34A]">
                          Exonera IVA
                        </span>
                      )}
                      {item.apertura != null && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF6FF] text-[#2563EB]">
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
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} />
            Anterior
          </button>
          <span className="text-sm text-[#71717A]">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Siguiente
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Create product modal */}
      {showCreateModal && (
        <NuevoProductoModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => { setShowCreateModal(false); fetchItems(); }}
        />
      )}
    </div>
  );
}
