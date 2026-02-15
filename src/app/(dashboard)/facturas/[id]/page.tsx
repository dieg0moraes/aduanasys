"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Download,
  CheckCircle,
  RefreshCw,
  Trash2,
  Globe,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ItemsTable } from "@/components/invoice/items-table";
import { COUNTRIES, getCountryName } from "@/lib/countries";

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
  const [deleting, setDeleting] = useState(false);
  const [approveResult, setApproveResult] = useState<{
    catalog_synced: number;
    total_items: number;
  } | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<Record<string, { dispatched_quantity: number; partidas: { id: string; reference: string; status: string; quantity: number }[] }>>({});

  // Country selector
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [savingCountry, setSavingCountry] = useState(false);

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

    // Fetch dispatch status
    const dispatchRes = await fetch(`/api/invoices/${invoiceId}/dispatch-status`);
    if (dispatchRes.ok) {
      const dispatchData = await dispatchRes.json();
      setDispatchStatus(dispatchData.dispatch_status || {});
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

  const handleCountrySelect = async (code: number | null) => {
    setSavingCountry(true);
    setShowCountryDropdown(false);
    setCountrySearch("");
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country_code: code }),
    });
    if (res.ok) {
      setInvoice((prev) => prev ? { ...prev, country_code: code } : null);
    }
    setSavingCountry(false);
  };

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        String(c.code).includes(countrySearch)
      )
    : COUNTRIES;

  const handleDelete = async () => {
    if (!window.confirm("¿Estás seguro de que querés eliminar esta factura? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push(
          invoice?.despacho_id
            ? `/despachos/${invoice.despacho_id}`
            : "/facturas"
        );
      } else {
        const data = await response.json();
        alert(data.error || "Error al eliminar la factura");
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("Error al eliminar la factura");
    }
    setDeleting(false);
  };

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
      const updatedItem = items.find((i) => i.id === itemId);
      const merged = updatedItem ? { ...updatedItem, ...updates } : null;

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, ...updates, was_corrected: true }
            : item
        )
      );

      // Sync to catalog if invoice is approved and item has sku + provider
      if (invoice?.status === "approved" && invoice.provider_id && merged?.sku) {
        const catalogUpdates: Record<string, unknown> = {};
        if (updates.customs_description !== undefined) catalogUpdates.customs_description = updates.customs_description;
        if (updates.internal_description !== undefined) catalogUpdates.internal_description = updates.internal_description;
        if (updates.ncm_code !== undefined) catalogUpdates.ncm_code = updates.ncm_code;

        if (Object.keys(catalogUpdates).length > 0) {
          const { error: catalogError } = await supabase
            .from("product_catalog")
            .update(catalogUpdates)
            .eq("provider_id", invoice.provider_id)
            .eq("sku", merged.sku);

          if (catalogError) {
            console.error("Error syncing to catalog:", catalogError);
          }
        }
      }
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
          onClick={() =>
            router.push(
              invoice.despacho_id
                ? `/despachos/${invoice.despacho_id}`
                : "/facturas"
            )
          }
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
          <a
            href={`/api/invoices/${invoiceId}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          >
            <Download size={16} />
            Descargar
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 flex items-center gap-2"
          >
            {deleting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Eliminar
              </>
            )}
          </button>
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
          {invoice.status === "review" && (
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
          )}
          {isEditable && (
            <a
              href={`/api/invoices/${invoiceId}/export-dua`}
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 flex items-center gap-2 text-gray-700"
            >
              <Download size={16} />
              Exportar DUA
            </a>
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

      {/* Country of origin */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-gray-400 shrink-0" />
          <label className="text-sm font-medium text-gray-700 shrink-0">
            País de origen
          </label>
          <div className="relative flex-1 max-w-xs">
            {showCountryDropdown ? (
              <div>
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Buscar país..."
                  className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setShowCountryDropdown(false);
                      setCountrySearch("");
                    }
                  }}
                />
                <div
                  className="fixed inset-0 z-[9]"
                  onClick={() => { setShowCountryDropdown(false); setCountrySearch(""); }}
                />
                <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {invoice?.country_code && (
                    <button
                      onClick={() => handleCountrySelect(null)}
                      className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 border-b"
                    >
                      Quitar país
                    </button>
                  )}
                  {filteredCountries.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleCountrySelect(c.code)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EBF5FB] ${
                        invoice?.country_code === c.code ? "bg-blue-50 font-medium" : ""
                      }`}
                    >
                      <span className="text-gray-400 font-mono mr-2">{c.code}</span>
                      {c.name}
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">Sin resultados</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCountryDropdown(true)}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition-colors w-full text-left"
              >
                {savingCountry ? (
                  <Loader2 size={14} className="animate-spin text-[#2E86C1]" />
                ) : invoice?.country_code ? (
                  <>
                    <span className="text-gray-400 font-mono">{invoice.country_code}</span>
                    <span className="text-gray-900">{getCountryName(invoice.country_code)}</span>
                  </>
                ) : (
                  <span className="text-gray-400">Seleccionar país</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

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
          dispatchStatus={dispatchStatus}
        />
      </div>
    </div>
  );
}
