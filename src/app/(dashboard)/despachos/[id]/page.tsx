"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Loader2,
  Trash2,
  FileText,
  Plus,
  Upload,
  Unlink,
  X,
  Check,
  Pencil,
  Download,
  Paperclip,
  Package,
  FileDown,
  MessageSquare,
} from "lucide-react";
import type { Despacho, Invoice, DespachoDocument, DocumentType, Partida, DespachoStatus } from "@/lib/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DESPACHO_STATUS_LABELS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
  PARTIDA_STATUS_LABELS,
  PARTIDA_STATUS_COLORS,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

type TabKey = "facturas" | "partidas" | "documentos" | "notas";

const DESPACHO_STATUS_TO_BADGE_COLOR: Record<DespachoStatus, "success" | "warning" | "error" | "blue" | "gray"> = {
  abierto: "blue",
  en_proceso: "warning",
  despachado: "success",
  cerrado: "gray",
};

export default function DespachoDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [despacho, setDespacho] = useState<Despacho | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("facturas");

  // Edit customs code
  const [editingCode, setEditingCode] = useState(false);
  const [customsCode, setCustomsCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

  // Edit reference
  const [editingReference, setEditingReference] = useState(false);
  const [reference, setReference] = useState("");
  const [savingReference, setSavingReference] = useState(false);

  // Edit notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Link invoice modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<Invoice[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Partidas
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loadingPartidas, setLoadingPartidas] = useState(true);

  // Documents
  const [documents, setDocuments] = useState<DespachoDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<DocumentType>("bl");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDespacho = useCallback(async () => {
    const res = await fetch(`/api/despachos/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDespacho(data);
      setCustomsCode(data.customs_code || "");
      setReference(data.reference || "");
      setNotes(data.notes || "");
    }
    setLoading(false);
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    const res = await fetch(`/api/despachos/${id}/documents`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data);
    }
    setLoadingDocs(false);
  }, [id]);

  const fetchPartidas = useCallback(async () => {
    const res = await fetch(`/api/partidas?despacho_id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setPartidas(data);
    }
    setLoadingPartidas(false);
  }, [id]);

  useEffect(() => {
    fetchDespacho();
    fetchDocuments();
    fetchPartidas();
  }, [fetchDespacho, fetchDocuments, fetchPartidas]);

  const fetchAvailableInvoices = async () => {
    setLoadingAvailable(true);
    const res = await fetch("/api/invoices");
    if (res.ok) {
      const data: Invoice[] = await res.json();
      setAvailableInvoices(data.filter((inv) => !inv.despacho_id));
    }
    setLoadingAvailable(false);
  };

  const handleSaveCustomsCode = async () => {
    setSavingCode(true);
    const res = await fetch(`/api/despachos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customs_code: customsCode.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setDespacho({ ...despacho!, customs_code: data.customs_code });
      setEditingCode(false);
    }
    setSavingCode(false);
  };

  const handleSaveReference = async () => {
    setSavingReference(true);
    const res = await fetch(`/api/despachos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: reference.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setDespacho({ ...despacho!, reference: data.reference });
      setEditingReference(false);
    }
    setSavingReference(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const res = await fetch(`/api/despachos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setDespacho({ ...despacho!, notes: data.notes });
      setEditingNotes(false);
    }
    setSavingNotes(false);
  };

  const handleLinkInvoice = async (invoiceId: string) => {
    setLinking(invoiceId);
    const res = await fetch(`/api/despachos/${id}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    if (res.ok) {
      setShowLinkModal(false);
      fetchDespacho();
    }
    setLinking(null);
  };

  const handleUnlinkInvoice = async (invoiceId: string) => {
    const res = await fetch(`/api/despachos/${id}/invoices?invoice_id=${invoiceId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      fetchDespacho();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/despachos/${id}`, { method: "DELETE" });
    if (res.ok && despacho) {
      router.push(`/clientes/${despacho.client_id}`);
    } else {
      const err = await res.json();
      alert(err.error || "Error al eliminar");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleUploadDocument = async () => {
    if (!uploadFile) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("document_type", uploadDocType);
    if (uploadDocType === "otro" && uploadLabel.trim()) {
      formData.append("label", uploadLabel.trim());
    }
    if (uploadNotes.trim()) {
      formData.append("notes", uploadNotes.trim());
    }

    const res = await fetch(`/api/despachos/${id}/documents`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setShowUploadForm(false);
      setUploadDocType("bl");
      setUploadLabel("");
      setUploadNotes("");
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchDocuments();
    } else {
      const err = await res.json();
      alert(err.error || "Error al subir documento");
    }
    setUploading(false);
  };

  const handleDeleteDocument = async (docId: string) => {
    setDeletingDoc(docId);
    const res = await fetch(`/api/despachos/${id}/documents/${docId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    }
    setDeletingDoc(null);
    setConfirmDeleteDoc(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!despacho) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Despacho no encontrado</p>
      </div>
    );
  }

  const invoices = despacho.invoices || [];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "facturas", label: "Facturas", count: invoices.length },
    { key: "partidas", label: "Partidas", count: partidas.length },
    { key: "documentos", label: "Documentos", count: documents.length },
    { key: "notas", label: "Notas", count: 0 },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: despacho.client?.name || "Cliente", href: `/clientes/${despacho.client_id}` },
          { label: despacho.reference || `DES-${id.slice(0, 8)}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#18181B]">
            {despacho.reference || `DES-${id.slice(0, 8)}`}
          </h1>
          <StatusBadge
            label={DESPACHO_STATUS_LABELS[despacho.status]}
            color={DESPACHO_STATUS_TO_BADGE_COLOR[despacho.status]}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {/* TODO: export */}}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#18181B] hover:bg-[#F4F4F5] transition-colors"
          >
            <FileDown size={16} />
            Exportar
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#DC2626] hover:bg-red-50 hover:border-red-200 transition-colors"
          >
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-700">
            Eliminar este despacho? Las facturas vinculadas quedaran sin despacho asignado.
          </p>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Info card - DUA and Reference as horizontal editable fields */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* DUA */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              DUA
            </label>
            {editingCode ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={customsCode}
                  onChange={(e) => setCustomsCode(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
                  placeholder="Numero de DUA"
                  autoFocus
                />
                <button
                  onClick={handleSaveCustomsCode}
                  disabled={savingCode}
                  className="p-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => { setEditingCode(false); setCustomsCode(despacho.customs_code || ""); }}
                  className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-[#18181B]">
                  {despacho.customs_code || <span className="text-[#A1A1AA] italic">Sin asignar</span>}
                </p>
                <button
                  onClick={() => setEditingCode(true)}
                  className="p-1 rounded text-[#A1A1AA] hover:text-[#71717A]"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Reference */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Referencia
            </label>
            {editingReference ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
                  placeholder="Referencia del despacho"
                  autoFocus
                />
                <button
                  onClick={handleSaveReference}
                  disabled={savingReference}
                  className="p-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => { setEditingReference(false); setReference(despacho.reference || ""); }}
                  className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-[#18181B]">
                  {despacho.reference || <span className="text-[#A1A1AA] italic">Sin referencia</span>}
                </p>
                <button
                  onClick={() => setEditingReference(true)}
                  className="p-1 rounded text-[#A1A1AA] hover:text-[#71717A]"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-[#E4E4E7]">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm transition-colors ${
                activeTab === tab.key
                  ? "text-[#2563EB] border-b-2 border-[#2563EB] font-medium"
                  : "text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              {tab.label} ({tab.key === "notas" ? "0" : tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "facturas" && (
        <div>
          {/* Actions row */}
          <div className="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={() => {
                setShowLinkModal(true);
                fetchAvailableInvoices();
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#18181B] hover:bg-[#F4F4F5] transition-colors"
            >
              <Plus size={16} />
              Vincular Factura
            </button>
            <button
              onClick={() => router.push(`/facturas?action=upload&despacho_id=${id}`)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
            >
              <Upload size={16} />
              Subir Factura
            </button>
          </div>

          {invoices.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-[#E4E4E7]">
              <FileText size={40} className="mx-auto text-[#D4D4D8] mb-3" />
              <p className="text-[#71717A] text-sm">
                No hay facturas vinculadas a este despacho
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7]">
              {invoices.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 hover:bg-[#F4F4F5]"
                >
                  <button
                    onClick={() => router.push(`/facturas/${invoice.id}`)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <FileText size={18} className="text-[#A1A1AA] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-[#18181B] truncate">
                        {invoice.file_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {invoice.provider && (
                          <span className="text-xs text-[#71717A]">
                            {invoice.provider.name}
                          </span>
                        )}
                        <span className="text-xs text-[#A1A1AA]">
                          {formatDate(invoice.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_COLORS[invoice.status]
                      }`}
                    >
                      {STATUS_LABELS[invoice.status]}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/despachos/${id}/partidas/nueva?invoice=${invoice.id}`);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                      title="Crear partida desde esta factura"
                    >
                      <Plus size={14} />
                      Partida
                    </button>
                    <button
                      onClick={() => handleUnlinkInvoice(invoice.id)}
                      className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                      title="Desvincular factura"
                    >
                      <Unlink size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "partidas" && (
        <div>
          {/* Actions row */}
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => router.push(`/despachos/${id}/partidas/nueva`)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={16} />
              Crear Partida
            </button>
          </div>

          {loadingPartidas ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
            </div>
          ) : partidas.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-[#E4E4E7]">
              <Package size={40} className="mx-auto text-[#D4D4D8] mb-3" />
              <p className="text-[#71717A] text-sm">
                No hay partidas creadas para este despacho
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7]">
              {partidas.map((partida) => (
                <div
                  key={partida.id}
                  onClick={() => router.push(`/despachos/${id}/partidas/${partida.id}`)}
                  className="flex items-center justify-between p-4 hover:bg-[#F4F4F5] cursor-pointer"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Package size={18} className="text-[#A1A1AA] shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-[#2563EB] truncate hover:underline">
                        {partida.reference}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {partida.invoice?.file_name && (
                          <span className="text-xs text-[#71717A] truncate">
                            {partida.invoice.file_name}
                          </span>
                        )}
                        {partida.date && (
                          <span className="text-xs text-[#A1A1AA]">
                            {formatDate(partida.date)}
                          </span>
                        )}
                        {typeof partida.item_count === "number" && (
                          <span className="text-xs text-[#A1A1AA]">
                            {partida.item_count} {partida.item_count === 1 ? "item" : "items"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <StatusBadge
                    label={PARTIDA_STATUS_LABELS[partida.status]}
                    color={
                      partida.status === "borrador"
                        ? "gray"
                        : partida.status === "presentada"
                        ? "blue"
                        : "success"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "documentos" && (
        <div>
          {/* Actions row */}
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
            >
              <Upload size={16} />
              Subir Documento
            </button>
          </div>

          {/* Upload form (inline) */}
          {showUploadForm && (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#18181B] mb-1">
                    Tipo de documento
                  </label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                    className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                {uploadDocType === "otro" && (
                  <div>
                    <label className="block text-sm font-medium text-[#18181B] mb-1">
                      Etiqueta
                    </label>
                    <input
                      type="text"
                      value={uploadLabel}
                      onChange={(e) => setUploadLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      placeholder="Nombre del documento"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18181B] mb-1">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="Notas sobre el documento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#18181B] mb-1">
                  Archivo
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-[#71717A] file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#EFF6FF] file:text-[#2563EB] hover:file:bg-[#DBEAFE]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleUploadDocument}
                  disabled={!uploadFile || uploading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
                >
                  {uploading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploading ? "Subiendo..." : "Subir"}
                </button>
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadFile(null);
                    setUploadDocType("bl");
                    setUploadLabel("");
                    setUploadNotes("");
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#F4F4F5] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Documents list */}
          {loadingDocs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-[#E4E4E7]">
              <Paperclip size={40} className="mx-auto text-[#D4D4D8] mb-3" />
              <p className="text-[#71717A] text-sm">
                No hay documentos adjuntos a este despacho
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7]">
              {documents.map((doc) => {
                // Map document types to specific badge colors
                const docTypeBadgeClass =
                  doc.document_type === "dua"
                    ? "bg-[#DBEAFE] text-[#2563EB]"
                    : doc.document_type === "certificado_origen"
                    ? "bg-[#F0FDF4] text-[#16A34A]"
                    : doc.document_type === "packing_list"
                    ? "bg-[#FFFBEB] text-[#F59E0B]"
                    : DOCUMENT_TYPE_COLORS[doc.document_type];

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 hover:bg-[#F4F4F5]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText size={18} className="text-[#A1A1AA] shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/despachos/${id}/documents/${doc.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[#18181B] truncate hover:text-[#2563EB] transition-colors"
                          >
                            {doc.file_name}
                          </a>
                          {(doc as DespachoDocument & { file_size?: number }).file_size && (
                            <span className="text-xs text-[#A1A1AA]">
                              {Math.round(((doc as DespachoDocument & { file_size?: number }).file_size! / 1024))} KB
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${docTypeBadgeClass}`}
                          >
                            {doc.document_type === "otro" && doc.label
                              ? doc.label
                              : DOCUMENT_TYPE_LABELS[doc.document_type]}
                          </span>
                          {doc.notes && (
                            <span className="text-xs text-[#71717A] truncate max-w-[200px]">
                              {doc.notes}
                            </span>
                          )}
                          <span className="text-xs text-[#A1A1AA]">
                            {formatDate(doc.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`/api/despachos/${id}/documents/${doc.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
                        title="Descargar"
                      >
                        <Download size={16} />
                      </a>
                      {confirmDeleteDoc === doc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            disabled={deletingDoc === doc.id}
                            className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            title="Confirmar eliminacion"
                          >
                            {deletingDoc === doc.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteDoc(null)}
                            className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#F4F4F5]"
                            title="Cancelar"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteDoc(doc.id)}
                          className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Eliminar documento"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "notas" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
          <MessageSquare size={40} className="mx-auto text-[#D4D4D8] mb-3" />
          <p className="text-[#71717A] text-sm font-medium">Proximamente</p>
          <p className="text-[#A1A1AA] text-xs mt-1">
            La seccion de notas estara disponible en una proxima actualizacion.
          </p>
        </div>
      )}

      {/* Link invoice modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-[#E4E4E7]">
              <h3 className="font-semibold text-[#18181B]">Vincular Factura</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded-lg hover:bg-[#F4F4F5]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#2563EB]" />
                </div>
              ) : availableInvoices.length === 0 ? (
                <p className="text-[#71717A] text-center py-8 text-sm">
                  No hay facturas disponibles para vincular
                </p>
              ) : (
                <div className="space-y-2">
                  {availableInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => handleLinkInvoice(inv.id)}
                      disabled={linking === inv.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-[#E4E4E7] hover:border-[#2563EB] hover:bg-[#EFF6FF]/30 transition-all text-left disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-[#18181B] text-sm truncate">
                          {inv.file_name}
                        </p>
                        <p className="text-xs text-[#71717A] mt-0.5">
                          {inv.provider?.name || "Sin proveedor"} · {formatDate(inv.created_at)}
                        </p>
                      </div>
                      {linking === inv.id ? (
                        <Loader2 size={16} className="animate-spin text-[#2563EB] shrink-0" />
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[inv.status]}`}>
                          {STATUS_LABELS[inv.status]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
