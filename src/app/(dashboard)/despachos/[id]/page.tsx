"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
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
} from "lucide-react";
import type { Despacho, Invoice, DespachoDocument, DocumentType } from "@/lib/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";

const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];

export default function DespachoDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [despacho, setDespacho] = useState<Despacho | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit customs code
  const [editingCode, setEditingCode] = useState(false);
  const [customsCode, setCustomsCode] = useState("");
  const [savingCode, setSavingCode] = useState(false);

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

  useEffect(() => {
    fetchDespacho();
    fetchDocuments();
  }, [fetchDespacho, fetchDocuments]);

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
        <Loader2 size={32} className="animate-spin text-[#2E86C1]" />
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push(`/clientes/${despacho.client_id}`)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        Volver a {despacho.client?.name || "Cliente"}
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{despacho.reference}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cliente: {despacho.client?.name || "—"} · Creado: {formatDate(despacho.created_at)}
          </p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 rounded-lg border text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
          title="Eliminar despacho"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-700">
            ¿Eliminar este despacho? Las facturas vinculadas quedarán sin despacho asignado.
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

      {/* Info card */}
      <div className="bg-white rounded-xl border p-5 mb-6 space-y-4">
        {/* Customs code */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            DUA
          </label>
          {editingCode ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={customsCode}
                onChange={(e) => setCustomsCode(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] flex-1"
                placeholder="Número de DUA"
                autoFocus
              />
              <button
                onClick={handleSaveCustomsCode}
                disabled={savingCode}
                className="p-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2574A9] disabled:opacity-50"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => { setEditingCode(false); setCustomsCode(despacho.customs_code || ""); }}
                className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-900">
                {despacho.customs_code || <span className="text-gray-400 italic">Sin asignar</span>}
              </p>
              <button
                onClick={() => setEditingCode(true)}
                className="p-1 rounded text-gray-400 hover:text-gray-600"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Notas
          </label>
          {editingNotes ? (
            <div className="flex items-start gap-2 mt-1">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] flex-1 min-h-[60px]"
                placeholder="Notas del despacho"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="p-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2574A9] disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => { setEditingNotes(false); setNotes(despacho.notes || ""); }}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 mt-1">
              <p className="text-sm text-gray-900">
                {despacho.notes || <span className="text-gray-400 italic">Sin notas</span>}
              </p>
              <button
                onClick={() => setEditingNotes(true)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 shrink-0"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Facturas section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Facturas ({invoices.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowLinkModal(true);
              fetchAvailableInvoices();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus size={16} />
            Vincular Factura
          </button>
          <button
            onClick={() => router.push(`/facturas?action=upload&despacho_id=${id}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1B4F72] text-white text-sm font-medium hover:bg-[#154360] transition-colors"
          >
            <Upload size={16} />
            Subir Factura
          </button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <FileText size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            No hay facturas vinculadas a este despacho
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {invoices.map((invoice: Invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <button
                onClick={() => router.push(`/facturas/${invoice.id}`)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <FileText size={18} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {invoice.file_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {invoice.provider && (
                      <span className="text-xs text-gray-500">
                        {invoice.provider.name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
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
                  onClick={() => handleUnlinkInvoice(invoice.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Desvincular factura"
                >
                  <Unlink size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents section */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          Documentos ({documents.length})
        </h2>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1B4F72] text-white text-sm font-medium hover:bg-[#154360] transition-colors"
        >
          <Upload size={16} />
          Subir Documento
        </button>
      </div>

      {/* Upload form (inline) */}
      {showUploadForm && (
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de documento
              </label>
              <select
                value={uploadDocType}
                onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etiqueta
                </label>
                <input
                  type="text"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                  placeholder="Nombre del documento"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <input
              type="text"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
              placeholder="Notas sobre el documento"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Archivo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#EBF5FB] file:text-[#2E86C1] hover:file:bg-[#D6EAF8]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleUploadDocument}
              disabled={!uploadFile || uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574A9] disabled:opacity-50 transition-colors"
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
              className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      {loadingDocs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[#2E86C1]" />
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Paperclip size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">
            No hay documentos adjuntos a este despacho
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Paperclip size={18} className="text-gray-400 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/despachos/${id}/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-gray-900 truncate hover:text-[#2E86C1] transition-colors"
                    >
                      {doc.file_name}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        DOCUMENT_TYPE_COLORS[doc.document_type]
                      }`}
                    >
                      {doc.document_type === "otro" && doc.label
                        ? doc.label
                        : DOCUMENT_TYPE_LABELS[doc.document_type]}
                    </span>
                    {doc.notes && (
                      <span className="text-xs text-gray-500 truncate max-w-[200px]">
                        {doc.notes}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {formatDate(doc.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/despachos/${id}/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#2E86C1] hover:bg-[#EBF5FB] transition-colors"
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
                      title="Confirmar eliminación"
                    >
                      {deletingDoc === doc.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteDoc(null)}
                      className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
                      title="Cancelar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteDoc(doc.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Eliminar documento"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link invoice modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">Vincular Factura</h3>
              <button
                onClick={() => setShowLinkModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#2E86C1]" />
                </div>
              ) : availableInvoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  No hay facturas disponibles para vincular
                </p>
              ) : (
                <div className="space-y-2">
                  {availableInvoices.map((inv) => (
                    <button
                      key={inv.id}
                      onClick={() => handleLinkInvoice(inv.id)}
                      disabled={linking === inv.id}
                      className="w-full flex items-center justify-between p-3 rounded-lg border hover:border-[#2E86C1] hover:bg-[#EBF5FB]/30 transition-all text-left disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {inv.file_name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {inv.provider?.name || "Sin proveedor"} · {formatDate(inv.created_at)}
                        </p>
                      </div>
                      {linking === inv.id ? (
                        <Loader2 size={16} className="animate-spin text-[#2E86C1] shrink-0" />
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
