"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ChevronRight, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { formatDate, truncate } from "@/lib/utils";

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

  const statusFilters: (InvoiceStatus | "all")[] = [
    "all",
    "uploaded",
    "processing",
    "review",
    "approved",
    "exported",
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === s
                ? "bg-[#1B4F72] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "Todas" : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={fetchInvoices}
          className="ml-auto p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Actualizar"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border p-4 animate-pulse"
            >
              <div className="h-5 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="mx-auto mb-3 text-gray-300" size={48} />
          <p className="text-lg font-medium">No hay facturas</p>
          <p className="text-sm mt-1">
            Subí tu primera factura para comenzar
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/facturas/${invoice.id}`}
              className="block bg-white rounded-xl border hover:border-[#2E86C1] hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText
                    className="text-[#2E86C1] flex-shrink-0"
                    size={20}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {truncate(invoice.file_name, 50)}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      {invoice.provider && (
                        <span>
                          {
                            (
                              invoice.provider as unknown as { name: string }
                            ).name
                          }
                        </span>
                      )}
                      <span>{formatDate(invoice.created_at)}</span>
                      {invoice.total_items > 0 && (
                        <span>{invoice.total_items} ítems</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[invoice.status]
                    }`}
                  >
                    {STATUS_LABELS[invoice.status]}
                  </span>
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
