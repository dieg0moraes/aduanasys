"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { formatDate, truncate } from "@/lib/utils";

function ConfidenceBar({ totalItems, autoClassified }: { totalItems: number; autoClassified: number }) {
  if (totalItems === 0) return null;
  const pct = Math.round((autoClassified / totalItems) * 100);
  const barColor =
    pct >= 80 ? "bg-[#16A34A]" : pct >= 50 ? "bg-[#F59E0B]" : "bg-[#DC2626]";

  return (
    <div className="flex items-center gap-2">
      <div className="bg-gray-100 rounded-full h-1.5 w-16 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-[#71717A] tabular-nums">{pct}%</span>
    </div>
  );
}

const TAB_FILTERS: { key: InvoiceStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "processing", label: "Procesando" },
  { key: "review", label: "En Revisión" },
  { key: "approved", label: "Aprobadas" },
];

export function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InvoiceStatus | "all">("all");

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from("invoices")
      .select("*, provider:providers(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching invoices:", error);
    } else {
      setInvoices((data as unknown as Invoice[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-0">
      {/* Status Tabs */}
      <div className="flex items-center border-b border-[#E4E4E7]">
        <div className="flex items-center gap-0">
          {TAB_FILTERS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-3 text-sm transition-colors relative ${
                filter === tab.key
                  ? "text-[#2563EB] font-medium"
                  : "text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              {tab.label}
              {filter === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2563EB] rounded-t" />
              )}
            </button>
          ))}
        </div>
        <button
          onClick={fetchInvoices}
          className="ml-auto p-2 rounded-lg hover:bg-gray-100 text-[#71717A]"
          title="Actualizar"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-[#71717A]">
            <FileText className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="text-lg font-medium">No hay facturas</p>
            <p className="text-sm mt-1">
              Subí tu primera factura para comenzar
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E4E4E7]">
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3 pl-2">
                    Factura
                  </th>
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3">
                    Proveedor
                  </th>
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3">
                    Fecha
                  </th>
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3">
                    Ítems
                  </th>
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3">
                    Confianza
                  </th>
                  <th className="text-left text-xs font-medium text-[#71717A] uppercase tracking-wide pb-3">
                    Estado
                  </th>
                  <th className="pb-3">
                    <span className="sr-only">Ir</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-[#E4E4E7] last:border-b-0 hover:bg-[#FAFAFA] transition-colors group"
                  >
                    <td className="py-3 pl-2">
                      <Link
                        href={`/facturas/${invoice.id}`}
                        className="flex items-center gap-2 min-w-0"
                      >
                        <FileText
                          className="text-[#2563EB] flex-shrink-0"
                          size={18}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-[#18181B] truncate text-sm">
                            {truncate(invoice.file_name, 40)}
                          </p>
                          {invoice.invoice_number && (
                            <p className="font-mono text-xs text-[#71717A]">
                              #{invoice.invoice_number}
                            </p>
                          )}
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 text-sm text-[#52525B]">
                      {invoice.provider
                        ? (invoice.provider as unknown as { name: string }).name
                        : "—"}
                    </td>
                    <td className="py-3 text-sm text-[#52525B] whitespace-nowrap">
                      {invoice.invoice_date
                        ? formatDate(invoice.invoice_date)
                        : formatDate(invoice.created_at)}
                    </td>
                    <td className="py-3 text-sm text-[#52525B]">
                      {invoice.total_items > 0 ? invoice.total_items : "—"}
                    </td>
                    <td className="py-3">
                      <ConfidenceBar
                        totalItems={invoice.total_items}
                        autoClassified={invoice.items_auto_classified}
                      />
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[invoice.status]
                        }`}
                      >
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-2">
                      <Link
                        href={`/facturas/${invoice.id}`}
                        className="text-gray-400 group-hover:text-[#2563EB] transition-colors"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
