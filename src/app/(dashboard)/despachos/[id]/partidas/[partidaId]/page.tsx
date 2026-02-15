"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Check,
  X,
  Pencil,
  Download,
  Package,
} from "lucide-react";
import type { Partida, PartidaItem, PartidaStatus } from "@/lib/types";
import {
  PARTIDA_STATUS_LABELS,
  PARTIDA_STATUS_COLORS,
} from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";

// Status transition map: which status comes next
const NEXT_STATUS: Partial<Record<PartidaStatus, PartidaStatus>> = {
  borrador: "presentada",
  presentada: "despachada",
};

const NEXT_STATUS_LABELS: Partial<Record<PartidaStatus, string>> = {
  borrador: "Marcar como Presentada",
  presentada: "Marcar como Despachada",
};

export default function PartidaDetailPage() {
  const router = useRouter();
  const { id: despachoId, partidaId } = useParams<{
    id: string;
    partidaId: string;
  }>();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit reference
  const [editingReference, setEditingReference] = useState(false);
  const [reference, setReference] = useState("");
  const [savingReference, setSavingReference] = useState(false);

  // Edit date
  const [editingDate, setEditingDate] = useState(false);
  const [date, setDate] = useState("");
  const [savingDate, setSavingDate] = useState(false);

  // Edit notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Status transition
  const [changingStatus, setChangingStatus] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);

  const fetchPartida = useCallback(async () => {
    const res = await fetch(`/api/partidas/${partidaId}`);
    if (res.ok) {
      const data = await res.json();
      setPartida(data);
      setReference(data.reference || "");
      setDate(data.date || "");
      setNotes(data.notes || "");
    }
    setLoading(false);
  }, [partidaId]);

  useEffect(() => {
    fetchPartida();
  }, [fetchPartida]);

  // --- Save handlers ---

  const handleSaveReference = async () => {
    setSavingReference(true);
    const res = await fetch(`/api/partidas/${partidaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: reference.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setPartida((prev) => (prev ? { ...prev, reference: data.reference } : prev));
      setEditingReference(false);
    }
    setSavingReference(false);
  };

  const handleSaveDate = async () => {
    setSavingDate(true);
    const res = await fetch(`/api/partidas/${partidaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: date || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setPartida((prev) => (prev ? { ...prev, date: data.date } : prev));
      setEditingDate(false);
    }
    setSavingDate(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const res = await fetch(`/api/partidas/${partidaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setPartida((prev) => (prev ? { ...prev, notes: data.notes } : prev));
      setEditingNotes(false);
    }
    setSavingNotes(false);
  };

  // --- Status transition ---

  const handleStatusTransition = async () => {
    if (!partida) return;
    const next = NEXT_STATUS[partida.status];
    if (!next) return;

    setChangingStatus(true);
    const res = await fetch(`/api/partidas/${partidaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setPartida((prev) =>
        prev ? { ...prev, status: data.status } : prev
      );
    }
    setChangingStatus(false);
  };

  // --- Delete ---

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/partidas/${partidaId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push(`/despachos/${despachoId}`);
    } else {
      const err = await res.json();
      alert(err.error || "Error al eliminar");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // --- Export DUA ---

  const handleExportDUA = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/partidas/${partidaId}/export-dua`);
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        let fileName = "DUA.xlsx";
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match) fileName = match[1];
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const err = await res.json();
        alert(err.error || "Error al exportar DUA");
      }
    } catch {
      alert("Error de red al exportar DUA");
    }
    setExporting(false);
  };

  // --- Helpers ---

  const calculateValue = (pItem: PartidaItem): number | null => {
    const item = pItem.invoice_item;
    if (!item) return null;
    if (
      item.quantity != null &&
      item.quantity > 0 &&
      item.total_price != null
    ) {
      return (pItem.dispatch_quantity / item.quantity) * item.total_price;
    }
    return null;
  };

  const isBorrador = partida?.status === "borrador";
  const items = partida?.items || [];

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!partida) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Partida no encontrada</p>
      </div>
    );
  }

  const currency = items[0]?.invoice_item?.currency || "USD";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <button
        onClick={() => router.push(`/despachos/${despachoId}`)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={16} />
        Volver al despacho
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {partida.reference}
          </h1>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              PARTIDA_STATUS_COLORS[partida.status]
            }`}
          >
            {PARTIDA_STATUS_LABELS[partida.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Export DUA */}
          <button
            onClick={handleExportDUA}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {exporting ? "Exportando..." : "Exportar DUA"}
          </button>

          {/* Status transition */}
          {NEXT_STATUS[partida.status] && (
            <button
              onClick={handleStatusTransition}
              disabled={changingStatus}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {changingStatus && (
                <Loader2 size={16} className="animate-spin" />
              )}
              {NEXT_STATUS_LABELS[partida.status]}
            </button>
          )}

          {/* Delete (only borrador) */}
          {isBorrador && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-lg border text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
              title="Eliminar partida"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-700">
            ¿Eliminar esta partida? Esta accion no se puede deshacer.
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
        {/* Invoice info (read-only) */}
        {partida.invoice && (
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Factura
            </label>
            <p className="text-sm text-gray-900 mt-1">
              {partida.invoice.file_name}
              {partida.invoice.provider && (
                <span className="text-gray-500">
                  {" "}
                  - {(partida.invoice.provider as { name: string }).name}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Reference (inline edit when borrador) */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Referencia
          </label>
          {isBorrador && editingReference ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
                placeholder="P-001"
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
                onClick={() => {
                  setEditingReference(false);
                  setReference(partida.reference || "");
                }}
                className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-900">
                {partida.reference || (
                  <span className="text-gray-400 italic">Sin referencia</span>
                )}
              </p>
              {isBorrador && (
                <button
                  onClick={() => setEditingReference(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Date (inline edit when borrador) */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Fecha
          </label>
          {isBorrador && editingDate ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
                autoFocus
              />
              <button
                onClick={handleSaveDate}
                disabled={savingDate}
                className="p-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setEditingDate(false);
                  setDate(partida.date || "");
                }}
                className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-900">
                {partida.date ? (
                  new Date(partida.date + "T12:00:00").toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                ) : (
                  <span className="text-gray-400 italic">Sin fecha</span>
                )}
              </p>
              {isBorrador && (
                <button
                  onClick={() => setEditingDate(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notes (inline edit when borrador) */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Notas
          </label>
          {isBorrador && editingNotes ? (
            <div className="flex items-start gap-2 mt-1">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1 min-h-[60px]"
                placeholder="Notas de la partida"
                autoFocus
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="p-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => {
                    setEditingNotes(false);
                    setNotes(partida.notes || "");
                  }}
                  className="p-1.5 rounded-lg border text-gray-500 hover:bg-gray-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 mt-1">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">
                {partida.notes || (
                  <span className="text-gray-400 italic">Sin notas</span>
                )}
              </p>
              {isBorrador && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Items ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              Esta partida no tiene items
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    SKU
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Descripcion
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    NCM
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Cant. Despacho
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Precio Unit.
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((pItem: PartidaItem) => {
                  const item = pItem.invoice_item;
                  const value = calculateValue(pItem);

                  return (
                    <tr key={pItem.id} className="hover:bg-gray-50">
                      {/* Line number */}
                      <td className="px-3 py-2.5 text-gray-500">
                        {item?.line_number ?? "—"}
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-2.5 text-gray-900 font-mono text-xs">
                        {item?.sku || "—"}
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2.5 text-gray-700 max-w-[300px]">
                        <span
                          className="block truncate"
                          title={item?.original_description}
                        >
                          {item?.original_description
                            ? item.original_description.length > 60
                              ? `${item.original_description.slice(0, 60)}...`
                              : item.original_description
                            : "—"}
                        </span>
                      </td>

                      {/* NCM code */}
                      <td className="px-3 py-2.5 text-gray-900 font-mono text-xs">
                        {item?.ncm_code || "—"}
                      </td>

                      {/* Dispatch quantity */}
                      <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                        {pItem.dispatch_quantity}
                      </td>

                      {/* Unit price */}
                      <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                        {item?.unit_price != null
                          ? formatCurrency(item.unit_price, item.currency)
                          : "—"}
                      </td>

                      {/* Calculated value */}
                      <td className="px-3 py-2.5 text-right text-gray-900 font-medium tabular-nums">
                        {value != null
                          ? formatCurrency(value, item?.currency || currency)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td
                    colSpan={4}
                    className="px-3 py-2.5 text-right text-xs text-gray-500 uppercase tracking-wide"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                    {items.reduce(
                      (sum: number, pi: PartidaItem) =>
                        sum + pi.dispatch_quantity,
                      0
                    )}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                    {formatCurrency(
                      items.reduce((sum: number, pi: PartidaItem) => {
                        const v = calculateValue(pi);
                        return sum + (v ?? 0);
                      }, 0),
                      currency
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-400 mt-4">
        Creada: {formatDate(partida.created_at)}
        {partida.updated_at && ` · Actualizada: ${formatDate(partida.updated_at)}`}
      </div>
    </div>
  );
}
