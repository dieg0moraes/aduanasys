"use client";

import { useState, Fragment } from "react";
import type { InvoiceItem, ConfidenceLevel, ClassificationSource } from "@/lib/types";
import { CONFIDENCE_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { NCMPicker } from "./ncm-picker";
import { COUNTRIES } from "@/lib/countries";
import {
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Pencil,
  Search as SearchIcon,
  Check,
  X,
  ChevronDown,
  Globe,
} from "lucide-react";

interface ItemsTableProps {
  items: InvoiceItem[];
  onItemUpdate?: (itemId: string, updates: Partial<InvoiceItem>) => void;
  editable?: boolean;
  dispatchStatus?: Record<string, { dispatched_quantity: number; partidas: { id: string; reference: string; status: string; quantity: number }[] }>;
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
    <div className="flex items-center gap-1.5">
      {icons[level]}
      <span className="text-xs text-gray-600 font-medium">
        {CONFIDENCE_LABELS[level]}
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
  dispatchStatus,
}: ItemsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    customs_description: "",
    internal_description: "",
    country_of_origin: "",
  });
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [ncmPickerItem, setNcmPickerItem] = useState<string | null>(null);
  const [ncmAnchorEl, setNcmAnchorEl] = useState<HTMLElement | null>(null);

  const expandRow = (item: InvoiceItem) => {
    if (!editable) return;
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    setEditValues({
      customs_description: item.customs_description || "",
      internal_description: item.internal_description || "",
      country_of_origin: item.country_of_origin || "",
    });
    setCountrySearch("");
    setShowCountryDropdown(false);
  };

  const saveExpanded = (itemId: string) => {
    if (!onItemUpdate) return;
    onItemUpdate(itemId, {
      customs_description: editValues.customs_description,
      internal_description: editValues.internal_description,
      country_of_origin: editValues.country_of_origin || null,
      was_corrected: true,
    });
    setExpandedId(null);
  };

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        String(c.code).includes(countrySearch)
      )
    : COUNTRIES;

  const handleNCMSelect = (itemId: string, ncmCode: string, description: string) => {
    if (!onItemUpdate) return;
    const updates: Partial<InvoiceItem> = {
      ncm_code: ncmCode,
      was_corrected: true,
      classification_source: "manual",
    };
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
    <>
    {ncmPickerItem && (() => {
      const pickerItem = items.find((i) => i.id === ncmPickerItem);
      if (!pickerItem) return null;
      return (
        <NCMPicker
          value={pickerItem.ncm_code}
          productDescription={pickerItem.original_description}
          classificationSource={pickerItem.classification_source}
          anchorEl={ncmAnchorEl}
          onSelect={(code, desc) =>
            handleNCMSelect(pickerItem.id, code, desc)
          }
          onClose={() => {
            setNcmPickerItem(null);
            setNcmAnchorEl(null);
          }}
        />
      );
    })()}
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
            <th className="px-3 py-3 text-left font-medium text-gray-600">
              Desc. Interna
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600 w-36">
              NCM
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-16">
              Cant.
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-24">
              Total
            </th>
            <th className="px-3 py-3 text-left font-medium text-gray-600 w-28">
              Origen
            </th>
            <th className="px-3 py-3 text-right font-medium text-gray-600 w-24">
              Despachado
            </th>
            <th className="px-3 py-3 text-center font-medium text-gray-600 w-28">
              Confianza
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b transition-colors ${
                    isExpanded
                      ? "bg-blue-50/50"
                      : item.was_corrected
                        ? "bg-blue-50/30 hover:bg-blue-50/50"
                        : item.confidence_level === "low"
                          ? "bg-red-50/20 hover:bg-red-50/40"
                          : "hover:bg-gray-50/50"
                  } ${editable ? "cursor-pointer" : ""}`}
                  onClick={() => expandRow(item)}
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
                  <td className="px-3 py-2.5 text-gray-700 max-w-xs">
                    <span className="line-clamp-2">
                      {item.customs_description || (
                        <span className="text-gray-400 italic">Sin descripción</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 max-w-xs">
                    <span className="line-clamp-2">
                      {item.internal_description || (
                        <span className="text-gray-400">—</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div
                      className={`flex items-center gap-1.5 ${
                        editable ? "group" : ""
                      }`}
                      onClick={(e) => {
                        if (!editable) return;
                        e.stopPropagation();
                        if (ncmPickerItem === item.id) {
                          setNcmPickerItem(null);
                          setNcmAnchorEl(null);
                        } else {
                          setNcmPickerItem(item.id);
                          setNcmAnchorEl(e.currentTarget as HTMLElement);
                        }
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
                  <td className="px-3 py-2.5 text-right font-medium text-gray-900">
                    {formatCurrency(item.total_price, item.currency)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    {item.country_of_origin || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {dispatchStatus && dispatchStatus[item.id] && dispatchStatus[item.id].dispatched_quantity > 0 ? (
                      <span className={`font-medium ${
                        dispatchStatus[item.id].dispatched_quantity >= (item.quantity || 0)
                          ? "text-green-600"
                          : "text-amber-600"
                      }`}>
                        {dispatchStatus[item.id].dispatched_quantity} / {item.quantity || 0}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <ConfidenceBadge
                        level={item.confidence_level}
                        source={item.classification_source}
                      />
                      {editable && (
                        <ChevronDown
                          size={14}
                          className={`text-gray-400 transition-transform ml-1 ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <tr className="border-b bg-blue-50/30">
                    <td colSpan={11} className="px-4 py-4">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Descripción Aduanera
                            </label>
                            <textarea
                              value={editValues.customs_description}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  customs_description: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[60px] resize-y"
                              placeholder="Descripción para aduana"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Descripción Interna
                            </label>
                            <textarea
                              value={editValues.internal_description}
                              onChange={(e) =>
                                setEditValues((v) => ({
                                  ...v,
                                  internal_description: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1] min-h-[60px] resize-y"
                              placeholder="Descripción interna (uso propio)"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveExpanded(item.id);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E86C1] text-white text-sm font-medium hover:bg-[#2574A9] transition-colors"
                          >
                            <Check size={14} />
                            Guardar
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(null);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm text-gray-600 hover:bg-white transition-colors"
                          >
                            <X size={14} />
                            Cancelar
                          </button>
                          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
                            <span>
                              P. Unit: {formatCurrency(item.unit_price, item.currency)}
                            </span>
                            <div className="relative">
                              <label className="text-xs text-gray-500 mr-1">Origen:</label>
                              {showCountryDropdown ? (
                                <span className="inline-block relative">
                                  <input
                                    type="text"
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    placeholder="Buscar país..."
                                    className="w-44 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setShowCountryDropdown(false);
                                        setCountrySearch("");
                                      }
                                    }}
                                  />
                                  <div
                                    className="fixed inset-0 z-[9]"
                                    onClick={(e) => { e.stopPropagation(); setShowCountryDropdown(false); setCountrySearch(""); }}
                                  />
                                  <div className="absolute z-10 mt-1 right-0 w-56 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {editValues.country_of_origin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditValues((v) => ({ ...v, country_of_origin: "" }));
                                          setShowCountryDropdown(false);
                                          setCountrySearch("");
                                        }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 border-b"
                                      >
                                        Quitar país
                                      </button>
                                    )}
                                    {filteredCountries.map((c) => (
                                      <button
                                        key={c.code}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditValues((v) => ({ ...v, country_of_origin: c.name }));
                                          setShowCountryDropdown(false);
                                          setCountrySearch("");
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#EBF5FB] ${
                                          editValues.country_of_origin === c.name ? "bg-blue-50 font-medium" : ""
                                        }`}
                                      >
                                        <span className="text-gray-400 font-mono mr-1.5">{c.code}</span>
                                        {c.name}
                                      </button>
                                    ))}
                                    {filteredCountries.length === 0 && (
                                      <p className="px-3 py-1.5 text-xs text-gray-400">Sin resultados</p>
                                    )}
                                  </div>
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowCountryDropdown(true); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-gray-50 transition-colors"
                                >
                                  <Globe size={11} className="text-gray-400" />
                                  {editValues.country_of_origin || <span className="text-gray-400">Seleccionar</span>}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

