"use client";

import { useState, Fragment } from "react";
import type { InvoiceItem, ClassificationSource } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { NCMPicker } from "./ncm-picker";
import { COUNTRIES } from "@/lib/countries";
import {
  Search as SearchIcon,
  X,
  ChevronDown,
} from "lucide-react";

interface ItemsTableProps {
  items: InvoiceItem[];
  onItemUpdate?: (itemId: string, updates: Partial<InvoiceItem>) => void;
  editable?: boolean;
  dispatchStatus?: Record<string, { dispatched_quantity: number; partidas: { id: string; reference: string; status: string; quantity: number }[] }>;
}

const CONFIDENCE_DOT: Record<string, string> = {
  high: "bg-[#16A34A]",
  medium: "bg-[#F59E0B]",
  low: "bg-[#DC2626]",
};

const CONFIDENCE_TEXT: Record<string, string> = {
  high: "text-[#16A34A]",
  medium: "text-[#F59E0B]",
  low: "text-[#DC2626]",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const NCM_PILL_STYLES: Record<string, string> = {
  high: "bg-[#EFF6FF] text-[#2563EB]",
  medium: "bg-[#FFFBEB] text-[#F59E0B]",
  low: "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]",
};

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

  const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) =>
        stripAccents(c.name.toLowerCase()).includes(stripAccents(countrySearch.toLowerCase())) ||
        String(c.code).includes(countrySearch)
      )
    : COUNTRIES;

  const handleNCMSelect = (itemId: string, ncmCode: string, description: string) => {
    if (!onItemUpdate) return;
    const updates: Partial<InvoiceItem> = {
      ncm_code: ncmCode,
      was_corrected: true,
      classification_source: "manual" as ClassificationSource,
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
      <div className="text-center py-8 text-[#71717A]">
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
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[#FAFAFA] h-10">
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-10">#</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-[100px]">SKU</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A]">Descripción Original</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-[120px]">NCM</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-[60px]">Cant.</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-[90px]">Precio U.</th>
            <th className="px-4 text-left text-xs font-semibold text-[#71717A] w-[100px]">Confianza</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isLow = item.confidence_level === "low" || !item.ncm_code;
            return (
              <Fragment key={item.id}>
                <tr
                  className={`h-12 border-t border-[#E4E4E7] transition-colors ${
                    isExpanded
                      ? "bg-[#EFF6FF]"
                      : isLow
                        ? "bg-[#FEF2F2] hover:bg-[#FEE2E2]"
                        : "hover:bg-[#FAFAFA]"
                  } ${editable ? "cursor-pointer" : ""}`}
                  onClick={() => expandRow(item)}
                >
                  <td className="px-4 text-[#A1A1AA]">{item.line_number}</td>
                  <td className="px-4 font-medium text-[#18181B]">{item.sku || "—"}</td>
                  <td className="px-4 text-[#18181B]">
                    <span className="line-clamp-1">{item.original_description}</span>
                  </td>
                  <td className="px-4">
                    <div
                      className={`flex items-center gap-1 ${editable ? "group" : ""}`}
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
                      {item.ncm_code ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold font-mono ${NCM_PILL_STYLES[item.confidence_level] || NCM_PILL_STYLES.low}`}>
                          {item.ncm_code}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]">
                          Pendiente
                        </span>
                      )}
                      {editable && (
                        <SearchIcon size={14} className="text-[#A1A1AA] opacity-0 group-hover:opacity-100 shrink-0" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 text-[#71717A]">{item.quantity ?? "—"}</td>
                  <td className="px-4 text-[#71717A]">
                    {formatCurrency(item.unit_price, item.currency)}
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${CONFIDENCE_DOT[item.confidence_level] || CONFIDENCE_DOT.low}`} />
                      <span className={`text-xs font-semibold ${CONFIDENCE_TEXT[item.confidence_level] || CONFIDENCE_TEXT.low}`}>
                        {CONFIDENCE_LABEL[item.confidence_level] || "Baja"}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Expanded edit panel — matches Pencil design */}
                {isExpanded && (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <div className="bg-[#EFF6FF] border-t border-[#E4E4E7] border-l-[3px] border-l-[#2563EB] px-5 py-4 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#2563EB]">
                            Editando Item #{item.line_number}{item.sku ? ` · SKU: ${item.sku}` : ""}
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                            className="text-[#A1A1AA] hover:text-[#71717A]"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* Two text fields side by side */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-[#71717A] mb-1.5">
                              Descripción Aduanera
                            </label>
                            <textarea
                              value={editValues.customs_description}
                              onChange={(e) => setEditValues((v) => ({ ...v, customs_description: e.target.value }))}
                              className="w-full h-16 px-3 py-2 bg-white border border-[#E4E4E7] rounded-lg text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                              placeholder="Descripción para aduana"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#71717A] mb-1.5">
                              Descripción Interna
                            </label>
                            <textarea
                              value={editValues.internal_description}
                              onChange={(e) => setEditValues((v) => ({ ...v, internal_description: e.target.value }))}
                              className="w-full h-16 px-3 py-2 bg-white border border-[#E4E4E7] rounded-lg text-sm text-[#18181B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
                              placeholder="Descripción interna (uso propio)"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>

                        {/* Bottom row: País de Origen + spacer + buttons */}
                        <div className="flex items-end gap-4">
                          {/* País de Origen */}
                          <div className="w-[200px]">
                            <label className="block text-xs font-semibold text-[#71717A] mb-1.5">
                              País de Origen
                            </label>
                            <div className="relative">
                              {showCountryDropdown ? (
                                <div>
                                  <input
                                    type="text"
                                    value={countrySearch}
                                    onChange={(e) => setCountrySearch(e.target.value)}
                                    placeholder="Buscar país..."
                                    className="w-full h-10 px-3 bg-white border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") { setShowCountryDropdown(false); setCountrySearch(""); }
                                    }}
                                  />
                                  <div className="fixed inset-0 z-[9]" onClick={(e) => { e.stopPropagation(); setShowCountryDropdown(false); setCountrySearch(""); }} />
                                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                    {editValues.country_of_origin && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setEditValues((v) => ({ ...v, country_of_origin: "" })); setShowCountryDropdown(false); setCountrySearch(""); }}
                                        className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 border-b"
                                      >
                                        Quitar país
                                      </button>
                                    )}
                                    {filteredCountries.map((c) => (
                                      <button
                                        key={c.code}
                                        onClick={(e) => { e.stopPropagation(); setEditValues((v) => ({ ...v, country_of_origin: c.name })); setShowCountryDropdown(false); setCountrySearch(""); }}
                                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#EFF6FF] ${editValues.country_of_origin === c.name ? "bg-blue-50 font-medium" : ""}`}
                                      >
                                        <span className="text-[#A1A1AA] font-mono mr-1.5">{c.code}</span>{c.name}
                                      </button>
                                    ))}
                                    {filteredCountries.length === 0 && <p className="px-3 py-2 text-xs text-[#A1A1AA]">Sin resultados</p>}
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowCountryDropdown(true); }}
                                  className="w-full h-10 px-3 bg-white border border-[#E4E4E7] rounded-lg text-sm flex items-center justify-between hover:bg-[#FAFAFA]"
                                >
                                  <span className={editValues.country_of_origin ? "text-[#18181B]" : "text-[#A1A1AA]"}>
                                    {editValues.country_of_origin || "Seleccionar"}
                                  </span>
                                  <ChevronDown size={14} className="text-[#A1A1AA]" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Spacer */}
                          <div className="flex-1" />

                          {/* Action buttons */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                              className="h-9 px-3.5 rounded-lg border border-[#E4E4E7] bg-white text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA]"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); saveExpanded(item.id); }}
                              className="h-9 px-3.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8]"
                            >
                              Guardar
                            </button>
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
