"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Building2,
} from "lucide-react";

interface CatalogItem {
  id: string;
  sku: string;
  provider_description: string;
  customs_description: string;
  ncm_code: string;
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

export default function ProviderCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.providerId as string;

  const [providerName, setProviderName] = useState<string>("");
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    customs_description: "",
    ncm_code: "",
  });
  const [saving, setSaving] = useState(false);

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

        // Obtener nombre del proveedor del primer item
        if (result.items.length > 0 && result.items[0].provider?.name) {
          setProviderName(result.items[0].provider.name);
        }
      }
    } catch (err) {
      console.error("Error fetching catalog:", err);
    }
    setLoading(false);
  }, [search, page, providerId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Si no tenemos nombre del proveedor (catálogo vacío), buscarlo directo
  useEffect(() => {
    if (providerName) return;

    const fetchProviderName = async () => {
      try {
        const response = await fetch(`/api/providers?search=`);
        if (response.ok) {
          const data = await response.json();
          const provider = data.providers.find(
            (p: { id: string }) => p.id === providerId
          );
          if (provider) setProviderName(provider.name);
        }
      } catch {
        // ignore
      }
    };

    fetchProviderName();
  }, [providerId, providerName]);

  const startEdit = (item: CatalogItem) => {
    setEditingId(item.id);
    setEditValues({
      customs_description: item.customs_description,
      ncm_code: item.ncm_code,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ customs_description: "", ncm_code: "" });
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
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((item) =>
              item.id === editingId ? { ...item, ...editValues } : item
            ),
          };
        });
        setEditingId(null);
      }
    } catch (err) {
      console.error("Error saving:", err);
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/catalogo")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-lg bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
          <Building2 size={20} className="text-[#2E86C1]" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {providerName || "Proveedor"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} producto${data.total !== 1 ? "s" : ""} en catálogo` : "Cargando..."}
          </p>
        </div>
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
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left">
                <th className="px-4 py-3 font-medium text-gray-600">SKU</th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Descripción Original
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Desc. Aduanera
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">NCM</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-center">
                  Usos
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Loader2
                      size={24}
                      className="animate-spin text-[#2E86C1] mx-auto"
                    />
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {search
                      ? "No se encontraron productos con esa búsqueda."
                      : "Este proveedor no tiene productos en el catálogo todavía."}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {item.provider_description}
                    </td>

                    {/* Desc. Aduanera - editable */}
                    <td className="px-4 py-3">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editValues.customs_description}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              customs_description: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                        />
                      ) : (
                        <span className="text-gray-700">
                          {item.customs_description}
                        </span>
                      )}
                    </td>

                    {/* NCM - editable */}
                    <td className="px-4 py-3">
                      {editingId === item.id ? (
                        <input
                          type="text"
                          value={editValues.ncm_code}
                          onChange={(e) =>
                            setEditValues((v) => ({
                              ...v,
                              ncm_code: e.target.value,
                            }))
                          }
                          className="w-24 px-2 py-1 border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                        />
                      ) : (
                        <span className="font-mono text-xs text-gray-600">
                          {item.ncm_code}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        {item.times_used}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editingId === item.id ? (
                          <>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600"
                              title="Guardar"
                            >
                              {saving ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(item)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                              title="Editar"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
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
