"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  Download,
  CheckCircle,
  RefreshCw,
  Trash2,
  Plus,
  Layers,
  CircleCheck,
  TriangleAlert,
  FileSpreadsheet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Invoice, InvoiceItem, Partida } from "@/lib/types";
import { STATUS_LABELS, PARTIDA_STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { ItemsTable } from "@/components/invoice/items-table";
import { COUNTRIES, getCountryName } from "@/lib/countries";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusStepper } from "@/components/ui/status-stepper";
import { StatusBadge } from "@/components/ui/status-badge";

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
  const [partidas, setPartidas] = useState<Partida[]>([]);

  // Country selector
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [savingCountry, setSavingCountry] = useState(false);

  // Provider selector
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");

  // Invoice date/number editing
  const [editingInvoiceDate, setEditingInvoiceDate] = useState<string>("");
  const [editingInvoiceNumber, setEditingInvoiceNumber] = useState<string>("");
  const [savingInvoiceFields, setSavingInvoiceFields] = useState(false);

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

    const inv = invoiceData as unknown as Invoice;
    setInvoice(inv);
    setEditingInvoiceDate(inv.invoice_date || "");
    setEditingInvoiceNumber(inv.invoice_number || "");

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

    // Fetch partidas for this invoice
    const partidasRes = await fetch(`/api/partidas?invoice_id=${invoiceId}`);
    if (partidasRes.ok) {
      const partidasData = await partidasRes.json();
      setPartidas(partidasData || []);
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

  const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) =>
        stripAccents(c.name.toLowerCase()).includes(stripAccents(countrySearch.toLowerCase())) ||
        String(c.code).includes(countrySearch)
      )
    : COUNTRIES;

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
        await handleProviderSelect(provider.id);
        setNewProviderName("");
      }
    } catch {
      // ignore
    }
    setCreatingProvider(false);
  };

  const canEditProvider = invoice?.status === "uploaded" || invoice?.status === "review";

  const handleSaveInvoiceField = async (field: "invoice_date" | "invoice_number", value: string) => {
    setSavingInvoiceFields(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    if (res.ok) {
      setInvoice((prev) => prev ? { ...prev, [field]: value || null } : null);
    }
    setSavingInvoiceFields(false);
  };

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
      <div className="p-6 xl:p-8">
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#2563EB]" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6 xl:p-8">
        <p className="text-[#71717A]">Factura no encontrada.</p>
      </div>
    );
  }

  const isEditable =
    invoice.status === "review" || invoice.status === "approved";

  // Status stepper logic
  const getStatusSteps = () => {
    const stepDefs = [
      { label: "Subida" },
      { label: "Procesada" },
      { label: "En Revisión" },
      { label: "Aprobada" },
    ];
    const statusIndex: Record<string, number> = {
      uploaded: 0,
      processing: 1,
      review: 2,
      approved: 4,
      exported: 4,
    };
    const currentIdx = statusIndex[invoice.status] ?? 0;
    return stepDefs.map((s, i) => ({
      label: s.label,
      status: (i < currentIdx ? "completed" : i === currentIdx ? "current" : "pending") as "completed" | "current" | "pending",
    }));
  };

  // Summary calculations
  const totalItems = items.length;
  const highCount = items.filter((i) => i.confidence_level === "high").length;
  const mediumCount = items.filter((i) => i.confidence_level === "medium").length;
  const lowCount = items.filter((i) => !i.ncm_code || i.confidence_level === "low").length;

  const STATUS_BADGE_COLOR: Record<string, "success" | "warning" | "error" | "blue" | "gray"> = {
    uploaded: "gray",
    processing: "blue",
    review: "warning",
    approved: "success",
    exported: "success",
  };

  return (
    <div className="p-6 xl:p-8">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb items={[
          ...(invoice.despacho_id
            ? [
                { label: "Despachos", href: "/despachos" },
                { label: invoice.despacho?.reference || `DES-${invoice.despacho_id.slice(0, 8)}`, href: `/despachos/${invoice.despacho_id}` },
              ]
            : [{ label: "Facturas", href: "/facturas" }]
          ),
          { label: invoice.invoice_number || invoice.file_name || "Factura" },
        ]} />
      </div>

      {/* Header — matches Pencil design */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#18181B] tracking-tight">
              {invoice.invoice_number || invoice.file_name}
            </h1>
            <StatusBadge label={STATUS_LABELS[invoice.status]} color={STATUS_BADGE_COLOR[invoice.status] || "gray"} />
          </div>
          <p className="text-sm text-[#71717A] mt-1">
            {invoice.file_name} · Subida el {formatDate(invoice.created_at)}
            {saving && (
              <span className="text-[#2563EB] ml-3 inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Guardando...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/invoices/${invoiceId}/download`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-4 rounded-lg border border-[#E4E4E7] text-sm font-medium hover:bg-[#FAFAFA] flex items-center gap-2 text-[#71717A]"
          >
            <Download size={18} />
            Descargar
          </a>
          {invoice.status === "uploaded" && (
            <button
              onClick={handleProcess}
              disabled={processing}
              className="h-10 px-4 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <><Loader2 size={18} className="animate-spin" /> Procesando...</>
              ) : (
                <><RefreshCw size={18} /> Procesar con IA</>
              )}
            </button>
          )}
          {invoice.status === "processing" && (
            <div className="h-10 px-4 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Procesando factura...
            </div>
          )}
          {invoice.status === "review" && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="h-10 px-4 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] disabled:opacity-50 flex items-center gap-2"
            >
              {approving ? (
                <><Loader2 size={18} className="animate-spin" /> Aprobando...</>
              ) : (
                <><CheckCircle size={18} /> Aprobar</>
              )}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="h-10 px-3 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:text-red-600 hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
            title="Eliminar factura"
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        </div>
      </div>

      {/* Status Stepper */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-6">
        <StatusStepper steps={getStatusSteps()} />
      </div>

      {/* Error */}
      {invoice.processing_error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 text-sm font-medium">Error de procesamiento</p>
          <p className="text-red-600 text-sm mt-1">{invoice.processing_error}</p>
        </div>
      )}

      {/* Feedback loop result */}
      {approveResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-green-700 text-sm font-medium">Factura aprobada — Catálogo actualizado</p>
          <p className="text-green-600 text-sm mt-1">
            {approveResult.catalog_synced > 0
              ? `${approveResult.catalog_synced} de ${approveResult.total_items} productos sincronizados al catálogo.`
              : "No se actualizó el catálogo (los ítems no tienen SKU o NCM asignado)."}
          </p>
        </div>
      )}

      {/* Info Row: card + summary column (matches Pencil design) */}
      <div className="flex gap-5 mb-6">
        {/* Info card with 4 fields in a row */}
        <div className="flex-1 bg-white rounded-xl border border-[#E4E4E7] p-6">
          <h2 className="text-base font-semibold text-[#18181B] mb-5">Información de Factura</h2>
          <div className="grid grid-cols-4 gap-5">
            {/* Proveedor */}
            <div>
              <label className="text-xs font-semibold text-[#71717A] block mb-1.5">Proveedor</label>
              <div className="relative">
                {showProviderDropdown ? (
                  <div>
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Buscar proveedor..."
                      className="w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setShowProviderDropdown(false); setProviderSearch(""); }
                      }}
                    />
                    <div className="fixed inset-0 z-[9]" onClick={() => { setShowProviderDropdown(false); setProviderSearch(""); }} />
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {invoice?.provider_id && (
                        <button onClick={() => handleProviderSelect(null)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 border-b">
                          Quitar proveedor
                        </button>
                      )}
                      {loadingProviders ? (
                        <div className="flex items-center justify-center py-3"><Loader2 size={16} className="animate-spin text-[#2563EB]" /></div>
                      ) : (
                        <>
                          {providers.map((p) => (
                            <button key={p.id} onClick={() => handleProviderSelect(p.id)}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] ${invoice?.provider_id === p.id ? "bg-blue-50 font-medium" : ""}`}>
                              {p.name}
                            </button>
                          ))}
                          {providers.length === 0 && providerSearch.trim() && (
                            <p className="px-3 py-2 text-sm text-[#A1A1AA]">Sin resultados</p>
                          )}
                        </>
                      )}
                      <div className="border-t px-3 py-2">
                        <p className="text-xs text-[#A1A1AA] mb-1.5">Crear nuevo</p>
                        <div className="flex gap-2">
                          <input type="text" value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)}
                            placeholder="Nombre" className="flex-1 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateProvider(); }} />
                          <button onClick={handleCreateProvider} disabled={creatingProvider || !newProviderName.trim()}
                            className="px-2 py-1 rounded bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] disabled:opacity-50">
                            {creatingProvider ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={canEditProvider ? () => setShowProviderDropdown(true) : undefined}
                    className={`w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm text-left flex items-center ${canEditProvider ? "hover:bg-[#FAFAFA] cursor-pointer" : "cursor-default"}`}
                  >
                    {savingProvider ? (
                      <Loader2 size={14} className="animate-spin text-[#2563EB]" />
                    ) : invoice?.provider?.name ? (
                      <span className="text-[#18181B]">{invoice.provider.name}</span>
                    ) : (
                      <span className="text-[#A1A1AA]">—</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Nro. Factura */}
            <div>
              <label className="text-xs font-semibold text-[#71717A] block mb-1.5">Nro. Factura</label>
              {canEditProvider ? (
                <input
                  type="text"
                  value={editingInvoiceNumber}
                  onChange={(e) => setEditingInvoiceNumber(e.target.value)}
                  onBlur={() => handleSaveInvoiceField("invoice_number", editingInvoiceNumber)}
                  placeholder="Sin número"
                  className="w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              ) : (
                <div className="h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm flex items-center text-[#18181B]">
                  {invoice?.invoice_number || "—"}
                </div>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label className="text-xs font-semibold text-[#71717A] block mb-1.5">Fecha</label>
              {canEditProvider ? (
                <input
                  type="date"
                  value={editingInvoiceDate}
                  onChange={(e) => { setEditingInvoiceDate(e.target.value); handleSaveInvoiceField("invoice_date", e.target.value); }}
                  className="w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              ) : (
                <div className="h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm flex items-center text-[#18181B]">
                  {invoice?.invoice_date ? formatDate(invoice.invoice_date) : "—"}
                </div>
              )}
            </div>

            {/* País de Origen */}
            <div>
              <label className="text-xs font-semibold text-[#71717A] block mb-1.5">País de Origen</label>
              <div className="relative">
                {showCountryDropdown ? (
                  <div>
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Buscar país..."
                      className="w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Escape") { setShowCountryDropdown(false); setCountrySearch(""); } }}
                    />
                    <div className="fixed inset-0 z-[9]" onClick={() => { setShowCountryDropdown(false); setCountrySearch(""); }} />
                    <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {invoice?.country_code && (
                        <button onClick={() => handleCountrySelect(null)} className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 border-b">
                          Quitar país
                        </button>
                      )}
                      {filteredCountries.map((c) => (
                        <button key={c.code} onClick={() => handleCountrySelect(c.code)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] ${invoice?.country_code === c.code ? "bg-blue-50 font-medium" : ""}`}>
                          <span className="text-[#A1A1AA] font-mono mr-2">{c.code}</span>{c.name}
                        </button>
                      ))}
                      {filteredCountries.length === 0 && <p className="px-3 py-2 text-sm text-[#A1A1AA]">Sin resultados</p>}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCountryDropdown(true)}
                    className="w-full h-10 px-3 border border-[#E4E4E7] rounded-lg text-sm text-left flex items-center justify-between hover:bg-[#FAFAFA]"
                  >
                    {savingCountry ? (
                      <Loader2 size={14} className="animate-spin text-[#2563EB]" />
                    ) : invoice?.country_code ? (
                      <span className="text-[#18181B]">{getCountryName(invoice.country_code)}</span>
                    ) : (
                      <span className="text-[#A1A1AA]">Seleccionar</span>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          {savingInvoiceFields && (
            <div className="mt-2"><Loader2 size={14} className="animate-spin text-[#2563EB]" /></div>
          )}
        </div>

        {/* Summary column (right side) */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          {/* Total items */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-[#E4E4E7] p-4">
            <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
              <Layers size={20} className="text-[#2563EB]" />
            </div>
            <div>
              <p className="text-base font-bold text-[#18181B]">{totalItems} items</p>
              <p className="text-xs text-[#71717A]">Total items</p>
            </div>
          </div>
          {/* High confidence */}
          <div className="flex items-center gap-3 rounded-xl border border-[#16A34A] bg-[#F0FDF4] p-4">
            <div className="w-10 h-10 rounded-lg bg-[#16A34A] flex items-center justify-center">
              <CircleCheck size={20} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-[#16A34A]">{highCount} alta</p>
              <p className="text-xs text-[#16A34A]">Confianza alta</p>
            </div>
          </div>
          {/* Needs review */}
          {(mediumCount > 0 || lowCount > 0) && (
            <div className="flex items-center gap-3 rounded-xl border border-[#F59E0B] bg-[#FFFBEB] p-4">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center">
                <TriangleAlert size={20} className="text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-[#F59E0B]">{mediumCount} media · {lowCount} baja</p>
                <p className="text-xs text-[#F59E0B]">Requieren revisión</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Partidas bar (horizontal, matches Pencil) */}
      {invoice.despacho_id && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] h-14 flex items-center justify-between px-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-[#18181B]">Partidas</span>
            <span className="w-[22px] h-[22px] rounded-full bg-[#2563EB] text-white text-[11px] font-semibold flex items-center justify-center">
              {partidas.length}
            </span>
            {partidas.length > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <div className="w-px h-5 bg-[#E4E4E7]" />
                {partidas.slice(0, 3).map((p, i) => (
                  <span key={p.id} className="text-xs text-[#71717A]">
                    {i > 0 && <span className="mx-1 text-[#A1A1AA]">·</span>}
                    {p.reference} · {PARTIDA_STATUS_LABELS[p.status]}
                  </span>
                ))}
                {partidas.length > 3 && <span className="text-xs text-[#A1A1AA]">+{partidas.length - 3} más</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {partidas.length > 0 && (
              <button
                onClick={() => router.push(`/despachos/${invoice.despacho_id}`)}
                className="text-xs font-medium text-[#2563EB] hover:underline"
              >
                Ver todas
              </button>
            )}
            <button
              onClick={() => router.push(`/despachos/${invoice.despacho_id}/partidas/nueva?invoice=${invoiceId}`)}
              className="h-8 px-3 rounded-lg bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1D4ED8] flex items-center gap-1.5"
            >
              <Plus size={12} />
              Crear Partida
            </button>
          </div>
        </div>
      )}

      {/* Items header with action buttons (matches Pencil) */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[#18181B]">Items de la Factura</h2>
        <div className="flex items-center gap-2">
          {isEditable && (
            <a
              href={`/api/invoices/${invoiceId}/export-dua`}
              className="h-9 px-3 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] flex items-center gap-2"
            >
              <FileSpreadsheet size={16} />
              Exportar DUA
            </a>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-x-auto">
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
