"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Package, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/utils";
import type { Despacho } from "@/lib/types";
import { DESPACHO_STATUS_LABELS } from "@/lib/types";

const STATUS_COLOR_MAP: Record<string, "success" | "warning" | "error" | "blue" | "gray"> = {
  abierto: "blue",
  en_proceso: "warning",
  despachado: "success",
  cerrado: "gray",
};

export default function DespachosPage() {
  const router = useRouter();
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchDespachos = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await fetch(`/api/despachos?${params}`);
    if (res.ok) {
      setDespachos(await res.json());
    }
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchDespachos();
  }, [fetchDespachos]);

  return (
    <div className="p-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Despachos</h1>
          <p className="text-sm text-[#71717A] mt-1">
            {despachos.length} despacho{despachos.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por referencia, DUA o cliente..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#2563EB]" />
        </div>
      ) : despachos.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
          <Package size={40} className="mx-auto text-[#A1A1AA] mb-3" />
          <p className="text-[#71717A]">No se encontraron despachos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  Referencia
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  DUA
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  Facturas
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E4E7]">
              {despachos.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/despachos/${d.id}`)}
                  className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#18181B]">
                    {d.reference || `DES-${d.id.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-3 text-[#71717A]">
                    {d.client?.name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#71717A] font-mono text-xs">
                    {d.customs_code || "—"}
                  </td>
                  <td className="px-4 py-3 text-[#71717A]">
                    {d.invoice_count ?? d.invoices?.length ?? 0}
                  </td>
                  <td className="px-4 py-3 text-[#71717A]">
                    {d.created_at ? formatDate(d.created_at) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      label={DESPACHO_STATUS_LABELS[d.status] || d.status}
                      color={STATUS_COLOR_MAP[d.status] || "gray"}
                    />
                  </td>
                  <td className="px-4 py-3 text-[#A1A1AA]">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
