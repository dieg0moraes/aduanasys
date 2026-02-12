"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Download,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ItemsTable } from "@/components/invoice/items-table";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approveResult, setApproveResult] = useState<{
    catalog_synced: number;
    total_items: number;
  } | null>(null);

  const fetchInvoice = async () => {
    const { data: invoiceData, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, provider:providers(*)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError) {
      console.error("Error fetching invoice:", invoiceError);
      return;
    }

    setInvoice(invoiceData as unknown as Invoice);

    const { data: itemsData, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("line_number");

    if (!itemsError) {
      setItems((itemsData as unknown as InvoiceItem[]) || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Supabase Realtime: escuchar cambios en la factura mientras se procesa
  useEffect(() => {
    if (invoice?.status !== "processing") return;

    const channel = supabase
      .channel(`invoice-${invoiceId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "invoices",
          filter: `id=eq.${invoiceId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as Invoice;
          // Cuando el status cambia de "processing" a otro, refrescar todo
          if (updated.status !== "processing") {
            fetchInvoice();
          }
        }
      )
      .subscribe();

    // Fallback: polling cada 10s por si Realtime falla
    const fallback = setInterval(() => {
      fetchInvoice();
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.status]);

  const handleProcess = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/process`, {
        method: "POST",
      });
      if (response.ok) {
        // El backend responde inmediatamente y procesa en background.
        // Actualizamos el estado local para que el Realtime se suscriba.
        setInvoice((prev) =>
          prev ? { ...prev, status: "processing", processing_error: null } : null
        );
      } else {
        const data = await response.json();
        console.error("Error al iniciar procesamiento:", data.error);
      }
    } catch (err) {
      console.error("Error processing:", err);
    }
    setProcessing(false);
  };

  const handleItemUpdate = async (
    itemId: string,
    updates: Partial<InvoiceItem>
  ) => {
    setSaving(true);

    const { error } = await supabase
      .from("invoice_items")
      .update({
        ...updates,
        was_corrected: true,
        corrected_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (!error) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, ...updates, was_corrected: true }
            : item
        )
      );
    }
    setSaving(false);
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        setInvoice((prev) => (prev ? { ...prev, status: "approved" } : null));
        setApproveResult({
          catalog_synced: data.catalog_synced,
          total_items: data.total_items,
        });
      } else {
        const data = await response.json();
        console.error("Error al aprobar:", data.error);
      }
    } catch (err) {
      console.error("Error al aprobar:", err);
    }
    setApproving(false);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#2E86C1]" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <p className="text-gray-500">Factura no encontrada.</p>
      </div>
    );
  }

  const isEditable =
    invoice.status === "review" || invoice.status === "approved";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/facturas")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">
            {invoice.file_name}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                STATUS_COLORS[invoice.status]
              }`}
            >
              {STATUS_LABELS[invoice.status]}
            </span>
            <span>{formatDate(invoice.created_at)}</span>
            <span>{items.length} ítems</span>
            {saving && (
              <span className="text-blue-600 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Guardando...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "uploaded" && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2471A3] disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <RefreshCw size={16} />
                  Procesar con IA
                </>
              )}
            </button>
          )}
          {invoice.status === "processing" && (
            <div className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Procesando factura...
            </div>
          )}
          {isEditable && invoice.status === "review" && (
            <>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {approving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Aprobando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Aprobar
                  </>
                )}
              </button>
              <button className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <Download size={16} />
                Exportar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {invoice.processing_error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm font-medium">
            Error de procesamiento
          </p>
          <p className="text-red-600 text-sm mt-1">
            {invoice.processing_error}
          </p>
        </div>
      )}

      {/* Feedback loop result */}
      {approveResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 text-sm font-medium">
            Factura aprobada — Catálogo actualizado
          </p>
          <p className="text-green-600 text-sm mt-1">
            {approveResult.catalog_synced > 0
              ? `${approveResult.catalog_synced} de ${approveResult.total_items} productos sincronizados al catálogo. La próxima factura de este proveedor matcheará automáticamente.`
              : "No se actualizó el catálogo (los ítems no tienen SKU o NCM asignado)."}
          </p>
        </div>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Total ítems</p>
            <p className="text-2xl font-bold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Confianza Alta</p>
            <p className="text-2xl font-bold text-green-600">
              {items.filter((i) => i.confidence_level === "high").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Confianza Media</p>
            <p className="text-2xl font-bold text-yellow-600">
              {items.filter((i) => i.confidence_level === "medium").length}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-sm text-gray-500">Requiere Revisión</p>
            <p className="text-2xl font-bold text-red-600">
              {items.filter((i) => i.confidence_level === "low").length}
            </p>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-900">Ítems de la Factura</h2>
          {isEditable && (
            <p className="text-xs text-gray-500 mt-1">
              Hacé click en Descripción Aduanera o NCM para editar. Los cambios
              se guardan automáticamente.
            </p>
          )}
        </div>
        <ItemsTable
          items={items}
          onItemUpdate={handleItemUpdate}
          editable={isEditable}
        />
      </div>
    </div>
  );
}
