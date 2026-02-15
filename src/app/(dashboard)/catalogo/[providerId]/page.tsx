"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Building2,
  FileText,
  ChevronDown,
  Package,
  Pencil,
  Plus,
} from "lucide-react";
import type { Invoice } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface CatalogItem {
  id: string;
  sku: string;
  provider_description: string;
  customs_description: string;
  ncm_code: string;
  latu: boolean | null;
  imesi: boolean | null;
  exonera_iva: boolean | null;
  apertura: number | null;
  internal_description: string | null;
  times_used: number;
  last_used_at: string;
  provider: { id: string; name: string } | null;
}

interface CatalogResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ProviderInfo {
  id: string;
  name: string;
  country: string | null;
  product_count: number;
  invoice_count: number;
}

const AVATAR_COLORS = [
  "bg-[#2563EB] text-white",
  "bg-[#9333EA] text-white",
  "bg-[#EA580C] text-white",
  "bg-[#16A34A] text-white",
  "bg-[#DC2626] text-white",
  "bg-[#0891B2] text-white",
  "bg-[#D97706] text-white",
  "bg-[#7C3AED] text-white",
  "bg-[#059669] text-white",
  "bg-[#E11D48] text-white",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getNcmPillClasses(timesUsed: number): string {
  if (timesUsed >= 3) {
    return "bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]";
  } else if (timesUsed >= 1) {
    return "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]";
  }
  return "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]";
}

export default function ProviderCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.providerId as string;

  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    customs_description: "",
    ncm_code: "",
    latu: null as boolean | null,
    imesi: null as boolean | null,
    exonera_iva: null as boolean | null,
    apertura: null as number | null,
    internal_description: "",
  });
  const [saving, setSaving] = useState(false);

  // Provider invoices
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [showInvoices, setShowInvoices] = useState(false);

  // Move product
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveProviderSearch, setMoveProviderSearch] = useState("");
  const [moveProviders, setMoveProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingMoveProviders, setLoadingMoveProviders] = useState(false);
  const [movingInProgress, setMovingInProgress] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
        provider_id: providerId,
      });
      if (search) params.set("search", search);

      const response = await fetch(`/api/catalog?${params}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error("Error fetching catalog:", err);
    }
    setLoading(false);
  }, [search, page, providerId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Fetch provider info
  useEffect(() => {
    const fetchProviderInfo = async () => {
      try {
        const response = await fetch(`/api/providers?search=`);
        if (response.ok) {
          const data = await response.json();
          const provider = data.providers.find(
            (p: { id: string }) => p.id === providerId
          );
          if (provider) {
            setProviderInfo(provider);
          }
        }
      } catch {
        // ignore
      }
    };

    fetchProviderInfo();
  }, [providerId]);

  // Fetch invoices for this provider
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await fetch("/api/invoices");
        if (response.ok) {
          const all: Invoice[] = await response.json();
          setInvoices(all.filter((inv) => inv.provider_id === providerId));
        }
      } catch {
        // ignore
      }
      setLoadingInvoices(false);
    };
    fetchInvoices();
  }, [providerId]);

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditValues({
      customs_description: item.customs_description,
      ncm_code: item.ncm_code,
      latu: item.latu,
      imesi: item.imesi,
      exonera_iva: item.exonera_iva,
      apertura: item.apertura,
      internal_description: item.internal_description || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ customs_description: "", ncm_code: "", latu: null, imesi: null, exonera_iva: null, apertura: null, internal_description: "" });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setSaving(true);

    try {
      const response = await fetch("/api/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...editValues }),
      });

      if (response.ok) {
        const updatedData = await response.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === editingId ? { ...item, ...updatedData } : item
            ),
          };
        });
        setEditingId(null);
      } else {
        const err = await response.json();
        console.error("Error updating catalog:", err);
        alert(`Error al guardar: ${err.error || "Error desconocido"}`);
      }
    } catch (err) {
      console.error("Error saving:", err);
      alert("Error de conexión al guardar");
    }
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    if (!confirm("¿Eliminar este producto del catálogo?")) return;

    try {
      const response = await fetch(`/api/catalog?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchCatalog();
      }
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

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

  const providerName = providerInfo?.name || "Proveedor";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: "Catálogo", href: "/catalogo" },
            { label: providerName },
          ]}
        />
      </div>

      {/* Provider info card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-semibold ${getAvatarColor(providerName)}`}
          >
            {providerName.charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">
              {providerName}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              {providerInfo?.country && (
                <span>{providerInfo.country}</span>
              )}
              <div className="flex items-center gap-1.5">
                <Package size={14} className="text-gray-400" />
                <span>{data?.total ?? 0} productos</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText size={14} className="text-gray-400" />
                <span>{providerInfo?.invoice_count ?? 0} facturas</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={14} />
              Agregar Producto
            </button>
          </div>
        </div>
      </div>

      {/* Invoices collapsible */}
      <div className="mb-6">
        <button
          onClick={() => setShowInvoices(!showInvoices)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
        >
          <FileText size={16} className="text-gray-400" />
          Facturas ({loadingInvoices ? "..." : invoices.length})
          <ChevronDown size={14} className={`transition-transform ${showInvoices ? "rotate-180" : ""}`} />
        </button>
        {showInvoices && (
          <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7] mb-2">
            {loadingInvoices ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-[#2563EB]" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">
                No hay facturas asociadas a este proveedor
              </p>
            ) : (
              invoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => router.push(`/facturas/${inv.id}`)}
                  className="flex items-center justify-between w-full p-3 hover:bg-gray-50 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {inv.file_name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(inv.created_at)}
                        {inv.total_items > 0 && ` · ${inv.total_items} items`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      STATUS_COLORS[inv.status]
                    }`}
                  >
                    {STATUS_LABELS[inv.status]}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Buscar por SKU, descripción o NCM..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E4E4E7] text-left">
                <th className="px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Descripción Original
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Desc. Aduanera
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Desc. Interna
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">NCM</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Usos
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2
                      size={24}
                      className="animate-spin text-[#2563EB] mx-auto"
                    />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {search
                      ? "No se encontraron productos con esa búsqueda."
                      : "Este proveedor no tiene productos en el catálogo todavía."}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => {
                  const isExpanded = editingId === item.id;
                  return (
                    <Fragment key={item.id}>
                      <tr
                        className={`border-b border-[#E4E4E7] last:border-b-0 cursor-pointer transition-colors ${
                          isExpanded ? "bg-blue-50/50" : "hover:bg-[#FAFAFA]"
                        }`}
                        onClick={() => {
                          if (isExpanded) {
                            cancelEdit();
                          } else {
                            startEdit(item);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {item.sku}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                          {item.provider_description}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                          {item.customs_description}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                          {item.internal_description || <span className="text-gray-400">--</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono ${getNcmPillClasses(item.times_used)}`}>
                            {item.ncm_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                            {item.times_used}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <ChevronDown
                              size={14}
                              className={`text-gray-400 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteItem(item.id);
                              }}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded edit panel */}
                      {isExpanded && (
                        <tr className="border-b border-[#E4E4E7] bg-blue-50/30">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="space-y-4">
                              {/* Row 1: descriptions */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Descripción Aduanera
                                  </label>
                                  <textarea
                                    value={editValues.customs_description}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        customs_description: e.target.value,
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px] resize-y"
                                    placeholder="Descripción para aduana"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Descripción Interna
                                  </label>
                                  <textarea
                                    value={editValues.internal_description}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        internal_description: e.target.value,
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] min-h-[60px] resize-y"
                                    placeholder="Descripción interna (uso propio)"
                                  />
                                </div>
                              </div>

                              {/* Row 2: NCM + flags */}
                              <div className="grid grid-cols-5 gap-4">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    NCM
                                  </label>
                                  <input
                                    type="text"
                                    value={editValues.ncm_code}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        ncm_code: e.target.value,
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    LATU
                                  </label>
                                  <select
                                    value={editValues.latu === null ? "" : editValues.latu ? "true" : "false"}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        latu: e.target.value === "" ? null : e.target.value === "true",
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  >
                                    <option value="">--</option>
                                    <option value="true">Si</option>
                                    <option value="false">No</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    IMESI
                                  </label>
                                  <select
                                    value={editValues.imesi === null ? "" : editValues.imesi ? "true" : "false"}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        imesi: e.target.value === "" ? null : e.target.value === "true",
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  >
                                    <option value="">--</option>
                                    <option value="true">Si</option>
                                    <option value="false">No</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Exonera IVA
                                  </label>
                                  <select
                                    value={editValues.exonera_iva === null ? "" : editValues.exonera_iva ? "true" : "false"}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        exonera_iva: e.target.value === "" ? null : e.target.value === "true",
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  >
                                    <option value="">--</option>
                                    <option value="true">Si</option>
                                    <option value="false">No</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Apertura
                                  </label>
                                  <input
                                    type="number"
                                    value={editValues.apertura ?? ""}
                                    onChange={(e) =>
                                      setEditValues((v) => ({
                                        ...v,
                                        apertura: e.target.value === "" ? null : Number(e.target.value),
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                    placeholder="--"
                                  />
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveEdit();
                                  }}
                                  disabled={saving}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
                                >
                                  {saving ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Check size={14} />
                                  )}
                                  Guardar
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEdit();
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white transition-colors"
                                >
                                  <X size={14} />
                                  Cancelar
                                </button>
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
                                            className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
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
                                              <Loader2 size={14} className="animate-spin text-[#2563EB]" />
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
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] disabled:opacity-50"
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
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#E4E4E7] bg-[#FAFAFA]">
            <span className="text-xs text-gray-500">
              Página {data.page} de {data.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data.totalPages, p + 1))
                }
                disabled={page >= data.totalPages}
                className="p-1.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
