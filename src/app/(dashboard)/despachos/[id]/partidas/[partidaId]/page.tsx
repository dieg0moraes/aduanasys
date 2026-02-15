"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
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
} from "@/lib/types";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusStepper } from "@/components/ui/status-stepper";

// Status transition map: which status comes next
const NEXT_STATUS: Partial<Record<PartidaStatus, PartidaStatus>> = {
  borrador: "presentada",
  presentada: "despachada",
};

const NEXT_STATUS_LABELS: Partial<Record<PartidaStatus, string>> = {
  borrador: "Marcar como Presentada",
  presentada: "Marcar como Despachada",
};

// Map partida status to StatusBadge color
const STATUS_BADGE_COLOR: Record<PartidaStatus, "gray" | "blue" | "success"> = {
  borrador: "gray",
  presentada: "blue",
  despachada: "success",
};

// Ordered statuses for stepper
const PARTIDA_STEPPER_STATUSES: PartidaStatus[] = [
  "borrador",
  "presentada",
  "despachada",
];

function getStepperSteps(currentStatus: PartidaStatus) {
  const currentIndex = PARTIDA_STEPPER_STATUSES.indexOf(currentStatus);
  return PARTIDA_STEPPER_STATUSES.map((s, i) => ({
    label: PARTIDA_STATUS_LABELS[s],
    status: i < currentIndex ? "completed" as const : i === currentIndex ? "current" as const : "pending" as const,
  }));
}

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
        <p className="text-[#71717A]">Partida no encontrada</p>
      </div>
    );
  }

  const currency = items[0]?.invoice_item?.currency || "USD";

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: "Despachos", href: "/despachos" },
            { label: `DES-${despachoId.slice(0, 8)}`, href: `/despachos/${despachoId}` },
            { label: partida.reference || "Partida" },
          ]}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#18181B]">
            Partida {partida.reference}
          </h1>
          <StatusBadge
            label={PARTIDA_STATUS_LABELS[partida.status]}
            color={STATUS_BADGE_COLOR[partida.status]}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Export DUA */}
          <button
            onClick={handleExportDUA}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {exporting ? "Exportando..." : "Exportar DUA"}
          </button>

          {/* Editar (status transition) */}
          {NEXT_STATUS[partida.status] && (
            <button
              onClick={handleStatusTransition}
              disabled={changingStatus}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#18181B] hover:bg-[#FAFAFA] disabled:opacity-50 transition-colors"
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
              className="p-2 rounded-lg border border-[#E4E4E7] text-[#DC2626] hover:bg-red-50 hover:border-red-200 transition-colors"
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
              className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-6">
        <div className="grid grid-cols-3 gap-6">
          {/* Factura */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Factura
            </label>
            {partida.invoice ? (
              <p className="text-sm text-[#18181B] mt-1">
                {partida.invoice.file_name}
                {partida.invoice.provider && (
                  <span className="text-[#71717A]">
                    {" "}
                    - {(partida.invoice.provider as { name: string }).name}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-[#A1A1AA] italic mt-1">Sin factura</p>
            )}
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Fecha
            </label>
            {isBorrador && editingDate ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
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
                  className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-[#18181B]">
                  {partida.date ? (
                    new Date(partida.date + "T12:00:00").toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  ) : (
                    <span className="text-[#A1A1AA] italic">Sin fecha</span>
                  )}
                </p>
                {isBorrador && (
                  <button
                    onClick={() => setEditingDate(true)}
                    className="p-1 rounded text-[#A1A1AA] hover:text-[#71717A]"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Notas
            </label>
            {isBorrador && editingNotes ? (
              <div className="flex items-start gap-2 mt-1">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1 min-h-[60px]"
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
                    className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#FAFAFA]"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 mt-1">
                <p className="text-sm text-[#18181B] whitespace-pre-wrap">
                  {partida.notes || (
                    <span className="text-[#A1A1AA] italic">Sin notas</span>
                  )}
                </p>
                {isBorrador && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="p-1 rounded text-[#A1A1AA] hover:text-[#71717A] shrink-0"
                  >
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reference inline edit (shown below grid when borrador) */}
        {isBorrador && editingReference && (
          <div className="mt-4 pt-4 border-t border-[#E4E4E7]">
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Referencia
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] flex-1"
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
                className="p-1.5 rounded-lg border border-[#E4E4E7] text-[#71717A] hover:bg-[#FAFAFA]"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Stepper */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-6">
        <StatusStepper steps={getStepperSteps(partida.status)} />
      </div>

      {/* Items table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#18181B] mb-3">
          Items ({items.length})
        </h2>

        {items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-[#E4E4E7]">
            <Package size={40} className="mx-auto text-[#D4D4D8] mb-3" />
            <p className="text-[#71717A] text-sm">
              Esta partida no tiene items
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    SKU
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    Descripcion
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    NCM
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    Cant. Despacho
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    Precio Unit.
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-[#71717A] uppercase tracking-wide">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E4E7]">
                {items.map((pItem: PartidaItem) => {
                  const item = pItem.invoice_item;
                  const value = calculateValue(pItem);

                  return (
                    <tr key={pItem.id} className="hover:bg-[#FAFAFA]">
                      {/* Line number */}
                      <td className="px-3 py-2.5 text-[#71717A]">
                        {item?.line_number ?? "\u2014"}
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-2.5 text-[#18181B] font-mono text-xs">
                        {item?.sku || "\u2014"}
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2.5 text-[#52525B] max-w-[300px]">
                        <span
                          className="block truncate"
                          title={item?.original_description}
                        >
                          {item?.original_description
                            ? item.original_description.length > 60
                              ? `${item.original_description.slice(0, 60)}...`
                              : item.original_description
                            : "\u2014"}
                        </span>
                      </td>

                      {/* NCM code */}
                      <td className="px-3 py-2.5">
                        {item?.ncm_code ? (
                          <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                            {item.ncm_code}
                          </span>
                        ) : (
                          <span className="text-[#A1A1AA]">{"\u2014"}</span>
                        )}
                      </td>

                      {/* Dispatch quantity */}
                      <td className="px-3 py-2.5 text-right text-[#18181B] tabular-nums">
                        {pItem.dispatch_quantity}
                      </td>

                      {/* Unit price */}
                      <td className="px-3 py-2.5 text-right text-[#18181B] tabular-nums">
                        {item?.unit_price != null
                          ? formatCurrency(item.unit_price, item.currency)
                          : "\u2014"}
                      </td>

                      {/* Calculated value */}
                      <td className="px-3 py-2.5 text-right text-[#18181B] font-semibold tabular-nums">
                        {value != null
                          ? formatCurrency(value, item?.currency || currency)
                          : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Footer totals */}
              <tfoot>
                <tr className="border-t border-[#E4E4E7] bg-[#FAFAFA] font-bold text-[#18181B]">
                  <td
                    colSpan={4}
                    className="px-3 py-2.5 text-right text-xs uppercase tracking-wide"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {items.reduce(
                      (sum: number, pi: PartidaItem) =>
                        sum + pi.dispatch_quantity,
                      0
                    )}
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 text-right tabular-nums">
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
      <div className="text-xs text-[#A1A1AA] mt-4">
        Creada: {formatDate(partida.created_at)}
        {partida.updated_at && ` \u00B7 Actualizada: ${formatDate(partida.updated_at)}`}
      </div>
    </div>
  );
}
