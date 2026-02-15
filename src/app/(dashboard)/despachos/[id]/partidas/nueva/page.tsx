"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { InvoiceItem, Invoice } from "@/lib/types";

interface DispatchInfo {
  dispatched_quantity: number;
  partidas: {
    id: string;
    reference: string;
    status: string;
    quantity: number;
  }[];
}

interface ItemRow {
  item: InvoiceItem;
  checked: boolean;
  dispatchQuantity: number;
  dispatched: number;
  available: number;
}

export default function NuevaPartidaPage() {
  const router = useRouter();
  const { id: despachoId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("invoice");

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState("");

  const fetchData = useCallback(async () => {
    if (!invoiceId) {
      setError("No se especificó la factura.");
      setLoading(false);
      return;
    }

    try {
      // Fetch invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*, provider:providers(*)")
        .eq("id", invoiceId)
        .single();

      if (invoiceError || !invoiceData) {
        setError("Factura no encontrada.");
        setLoading(false);
        return;
      }

      setInvoice(invoiceData as unknown as Invoice);

      // Fetch invoice items
      const { data: itemsData, error: itemsError } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("line_number");

      if (itemsError) {
        setError("Error al cargar items de la factura.");
        setLoading(false);
        return;
      }

      const items = (itemsData as unknown as InvoiceItem[]) || [];

      // Fetch dispatch status
      const res = await fetch(`/api/invoices/${invoiceId}/dispatch-status`);
      let dispatchStatus: Record<string, DispatchInfo> = {};
      if (res.ok) {
        const data = await res.json();
        dispatchStatus = data.dispatch_status || {};
      }

      // Build item rows
      const rows: ItemRow[] = items.map((item) => {
        const status = dispatchStatus[item.id];
        const dispatched = status?.dispatched_quantity || 0;
        const totalQty = item.quantity || 0;
        const available = Math.max(0, totalQty - dispatched);

        return {
          item,
          checked: available > 0,
          dispatchQuantity: available,
          dispatched,
          available,
        };
      });

      setItemRows(rows);

      // Auto-generate reference
      const countRes = await fetch(
        `/api/partidas?despacho_id=${despachoId}`
      );
      if (countRes.ok) {
        const partidas = await countRes.json();
        const nextNum = (partidas?.length || 0) + 1;
        setReference(`P-${String(nextNum).padStart(3, "0")}`);
      } else {
        setReference("P-001");
      }
    } catch {
      setError("Error al cargar datos.");
    }

    setLoading(false);
  }, [invoiceId, despachoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleItem = (index: number) => {
    setItemRows((prev) =>
      prev.map((row, i) => {
        if (i !== index || row.available === 0) return row;
        return {
          ...row,
          checked: !row.checked,
          dispatchQuantity: !row.checked ? row.available : 0,
        };
      })
    );
  };

  const handleQuantityChange = (index: number, value: number) => {
    setItemRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const clamped = Math.max(0, Math.min(value, row.available));
        return {
          ...row,
          dispatchQuantity: clamped,
          checked: clamped > 0,
        };
      })
    );
  };

  const selectedItems = itemRows.filter(
    (row) => row.checked && row.dispatchQuantity > 0
  );

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      setError("Seleccione al menos un item.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/partidas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          despacho_id: despachoId,
          invoice_id: invoiceId,
          reference: reference.trim() || undefined,
          date: date || undefined,
          notes: notes.trim() || undefined,
          items: selectedItems.map((row) => ({
            invoice_item_id: row.item.id,
            dispatch_quantity: row.dispatchQuantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al crear la partida.");
        setSubmitting(false);
        return;
      }

      const partida = await res.json();
      router.push(
        `/despachos/${despachoId}/partidas/${partida.id}`
      );
    } catch {
      setError("Error de red al crear la partida.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#2E86C1]" />
      </div>
    );
  }

  if (!invoiceId) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">
          No se especificó la factura para crear la partida.
        </p>
      </div>
    );
  }

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nueva Partida</h1>
        {invoice && (
          <p className="text-sm text-gray-500 mt-1">
            Factura: {invoice.file_name}
            {invoice.provider && ` - ${invoice.provider.name}`}
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form fields */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Referencia
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
              placeholder="P-001"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Notas
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[36px]"
              placeholder="Notas opcionales..."
              rows={1}
            />
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Items de la factura ({itemRows.length})
        </h2>

        {itemRows.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">
              La factura no tiene items
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2.5 text-left w-10">
                    <span className="sr-only">Seleccionar</span>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    #
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    SKU
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Descripcion
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Cantidad
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Despachado
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Disponible
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Cant. Partida
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itemRows.map((row, index) => {
                  const isDisabled = row.available === 0;

                  return (
                    <tr
                      key={row.item.id}
                      className={`${
                        isDisabled
                          ? "bg-gray-50 opacity-60"
                          : row.checked
                          ? "bg-blue-50/30"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={row.checked}
                          disabled={isDisabled}
                          onChange={() => handleToggleItem(index)}
                          className="rounded border-gray-300 text-[#2E86C1] focus:ring-[#2E86C1] disabled:opacity-50"
                        />
                      </td>

                      {/* Line number */}
                      <td className="px-3 py-2.5 text-gray-500">
                        {row.item.line_number}
                      </td>

                      {/* SKU */}
                      <td className="px-3 py-2.5 text-gray-900 font-mono text-xs">
                        {row.item.sku || "—"}
                      </td>

                      {/* Description */}
                      <td className="px-3 py-2.5 text-gray-700 max-w-[300px]">
                        <span
                          className="block truncate"
                          title={row.item.original_description}
                        >
                          {row.item.original_description.length > 60
                            ? `${row.item.original_description.slice(0, 60)}...`
                            : row.item.original_description}
                        </span>
                      </td>

                      {/* Total quantity */}
                      <td className="px-3 py-2.5 text-right text-gray-900 tabular-nums">
                        {row.item.quantity ?? 0}
                      </td>

                      {/* Already dispatched */}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.dispatched > 0 ? (
                          <span className="text-amber-600 font-medium">
                            {row.dispatched}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* Available */}
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.available > 0 ? (
                          <span className="text-green-600 font-medium">
                            {row.available}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* Dispatch quantity input */}
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          max={row.available}
                          value={row.dispatchQuantity}
                          disabled={isDisabled}
                          onChange={(e) =>
                            handleQuantityChange(
                              index,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 px-2 py-1 border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#2E86C1] disabled:bg-gray-100 disabled:text-gray-400 tabular-nums"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary + Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}{" "}
          seleccionado{selectedItems.length !== 1 ? "s" : ""} &middot;{" "}
          {selectedItems.reduce((sum, r) => sum + r.dispatchQuantity, 0)}{" "}
          unidades a despachar
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/despachos/${despachoId}`)}
            className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574A9] disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Package size={16} />
            )}
            {submitting ? "Creando..." : "Crear Partida"}
          </button>
        </div>
      </div>
    </div>
  );
}
