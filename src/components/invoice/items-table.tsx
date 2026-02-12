"use client";

import { useState } from "react";
import type { InvoiceItem, ConfidenceLevel, ClassificationSource } from "@/lib/types";
import { CONFIDENCE_COLORS, CONFIDENCE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { NCMPicker } from "./ncm-picker";
import {
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Pencil,
  Search as SearchIcon,
} from "lucide-react";

interface ItemsTableProps {
  items: InvoiceItem[];
  onItemUpdate?: (itemId: string, updates: Partial<InvoiceItem>) => void;
  editable?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  exact_match: "Catálogo",
  semantic: "Semántica",
  llm_rag: "IA",
  manual: "Manual",
};

const SOURCE_STYLES: Record<string, string> = {
  exact_match: "bg-purple-50 text-purple-700 border-purple-200",
  semantic: "bg-blue-50 text-blue-700 border-blue-200",
  llm_rag: "bg-amber-50 text-amber-700 border-amber-200",
  manual: "bg-gray-50 text-gray-700 border-gray-200",
};

function ConfidenceBadge({ level, source }: { level: ConfidenceLevel; source: ClassificationSource }) {
  const icons = {
    high: <CheckCircle size={13} className="text-green-500" />,
    medium: <AlertTriangle size={13} className="text-yellow-500" />,
    low: <HelpCircle size={13} className="text-red-500" />,
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="flex items-center gap-1"
        title={`Confianza: ${CONFIDENCE_LABELS[level]}`}
      >
        {icons[level]}
        <span className="text-xs text-gray-600 font-medium">
          {CONFIDENCE_LABELS[level]}
        </span>
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border ${SOURCE_STYLES[source] || SOURCE_STYLES.manual}`}
      >
        {SOURCE_LABELS[source] || source}
      </span>
    </div>
  );
}

export function ItemsTable({
  items,
  onItemUpdate,
  editable = false,
}: ItemsTableProps) {
  const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [ncmPickerItem, setNcmPickerItem] = useState<string | null>(null);

  const startEdit = (itemId: string, field: string, currentValue: string) => {
    if (!editable) return;
    setEditingCell({ itemId, field });
    setEditValue(currentValue || "");
  };

  const saveEdit = () => {
    if (!editingCell || !onItemUpdate) return;
    onItemUpdate(editingCell.itemId, {
      [editingCell.field]: editValue,
      was_corrected: true,
    } as Partial<InvoiceItem>);
    setEditingCell(null);
    setEditValue("");
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  const isEditing = (itemId: string, field: string) =>
    editingCell?.itemId === itemId && editingCell?.field === field;

  const handleNCMSelect = (itemId: string, ncmCode: string, description: string) => {
    if (!onItemUpdate) return;
    const updates: Partial<InvoiceItem> = {
      ncm_code: ncmCode,
      was_corrected: true,
      classification_source: "manual",
    };
    // Si el item no tiene descripción aduanera y la búsqueda devolvió una, usarla
    const item = items.find((i) => i.id === itemId);
    if (description && item && !item.customs_description) {
      updates.customs_description = description;
    }
    onItemUpdate(itemId, updates);
    setNcmPickerItem(null);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No se encontraron ítems en esta factura.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-3 py-3 text-left font-medium text-gray-600 w-10">
              #
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600 w-24">
              SKU
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600">
              Descripción Original
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600">
              Desc. Aduanera
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600 w-36">
              NCM
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-16">
              Cant.
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-24">
              P. Unit.
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-24">
              Total
            </th>
            <th className="px-3 py-3 text-center font-medium text-gray-600 w-24">
              Confianza
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`border-b transition-colors ${
                item.was_corrected
                  ? "bg-blue-50/30 hover:bg-blue-50/50"
                  : item.confidence_level === "low"
                    ? "bg-red-50/20 hover:bg-red-50/40"
                    : "hover:bg-gray-50/50"
              }`}
            >
              <td className="px-3 py-2.5 text-gray-400">
                {item.line_number}
              </td>
              <td className="px-3 py-2.5 font-mono text-xs text-gray-600">
                {item.sku || "-"}
              </td>
              <td className="px-3 py-2.5 text-gray-700 max-w-xs">
                <span className="line-clamp-2">
                  {item.original_description}
                </span>
              </td>
              {/* Desc. Aduanera — editable inline */}
              <td
                className={`px-3 py-2.5 max-w-xs ${
                  editable
                    ? "cursor-pointer hover:bg-blue-50 rounded group"
                    : ""
                }`}
                onClick={() =>
                  startEdit(
                    item.id,
                    "customs_description",
                    item.customs_description || ""
                  )
                }
              >
                {isEditing(item.id, "customs_description") ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-700 line-clamp-2 flex-1">
                      {item.customs_description || (
                        <span className="text-gray-400 italic">
                          Sin descripción
                        </span>
                      )}
                    </span>
                    {editable && (
                      <Pencil
                        size={12}
                        className="text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      />
                    )}
                  </div>
                )}
              </td>
              {/* NCM — con picker */}
              <td className="px-3 py-2.5 relative">
                {ncmPickerItem === item.id ? (
                  <NCMPicker
                    value={item.ncm_code}
                    productDescription={item.original_description}
                    classificationSource={item.classification_source}
                    onSelect={(code, desc) =>
                      handleNCMSelect(item.id, code, desc)
                    }
                    onClose={() => setNcmPickerItem(null)}
                  />
                ) : null}
                <div
                  className={`flex items-center gap-1.5 ${
                    editable ? "cursor-pointer group" : ""
                  }`}
                  onClick={() => {
                    if (!editable) return;
                    setNcmPickerItem(
                      ncmPickerItem === item.id ? null : item.id
                    );
                  }}
                >
                  <span
                    className={`font-mono text-xs ${
                      item.ncm_code
                        ? "text-gray-800 font-medium"
                        : "text-red-400 italic"
                    }`}
                  >
                    {item.ncm_code || "Pendiente"}
                  </span>
                  {editable && (
                    <SearchIcon
                      size={12}
                      className="text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0"
                    />
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-700">
                {item.quantity ?? "-"}
                {item.unit_of_measure && (
                  <span className="text-xs text-gray-400 ml-1">
                    {item.unit_of_measure}
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-right text-gray-700">
                {formatCurrency(item.unit_price, item.currency)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                {formatCurrency(item.total_price, item.currency)}
              </td>
              <td className="px-3 py-2.5 text-center">
                <ConfidenceBadge
                  level={item.confidence_level}
                  source={item.classification_source}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
