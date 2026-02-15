"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Loader2,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Brain,
  Tag,
  GitBranch,
  AlertTriangle,
} from "lucide-react";

interface NCMResult {
  ncm_code: string;
  description: string;
  similarity: number;
  match_type: string;
  source: string;
  hierarchy_path?: string[];
  exclusions?: { rule_id: string; letter: string | null; description: string; target_codes: string[] }[];
}

interface NCMPickerProps {
  /** NCM code actual */
  value: string | null;
  /** Descripción del producto (se usa como query inicial) */
  productDescription?: string;
  /** Fuente de clasificación actual */
  classificationSource?: string;
  /** Elemento ancla para posicionar el picker (usa portal + fixed) */
  anchorEl?: HTMLElement | null;
  /** Callback al seleccionar un NCM */
  onSelect: (ncmCode: string, description: string) => void;
  /** Callback al cerrar sin seleccionar */
  onClose: () => void;
}

const SOURCE_ICONS: Record<string, typeof Database> = {
  catalog: Database,
  fulltext: FileText,
  trigram: Search,
  semantic: Brain,
  exact: Tag,
  graph: GitBranch,
};

const SOURCE_COLORS: Record<string, string> = {
  catalog: "text-[#16A34A] bg-[#F0FDF4]",
  fulltext: "text-[#2563EB] bg-[#EFF6FF]",
  trigram: "text-[#F59E0B] bg-[#FFFBEB]",
  semantic: "text-[#9333EA] bg-[#F5F3FF]",
  exact: "text-[#71717A] bg-[#F4F4F5]",
  graph: "text-[#0891B2] bg-[#ECFEFF]",
};

const SOURCE_LABELS: Record<string, string> = {
  exact_match: "Match exacto en catálogo",
  semantic: "Búsqueda semántica",
  llm_rag: "Sugerencia de IA",
  manual: "Asignado manualmente",
};

export function NCMPicker({
  value,
  productDescription,
  classificationSource,
  anchorEl,
  onSelect,
  onClose,
}: NCMPickerProps) {
  const [query, setQuery] = useState(productDescription || "");
  const [results, setResults] = useState<NCMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const usePortal = !!anchorEl;

  // Focus input al abrir
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Cerrar con click afuera (solo en modo no-portal; en portal el backdrop maneja esto)
  useEffect(() => {
    if (usePortal) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, usePortal]);

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const doSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setExpandedIdx(null);
    try {
      const res = await fetch("/api/ncm/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 8, threshold: 0.3 }),
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setExpandedQuery(data.expanded_query || null);
      }
    } catch (err) {
      console.error("NCM search error:", err);
    }
    setLoading(false);
  }, []);

  // Buscar automáticamente con la descripción del producto al abrir
  useEffect(() => {
    if (productDescription) {
      doSearch(productDescription);
    }
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  const formatNCM = (code: string) => {
    const clean = code.replace(/\./g, "");
    if (clean.length === 8) {
      return `${clean.slice(0, 4)}.${clean.slice(4, 6)}.${clean.slice(6, 8)}`;
    }
    return code;
  };

  const truncateDesc = (desc: string, max: number = 120) => {
    if (desc.length <= max) return desc;
    return desc.slice(0, max) + "...";
  };

  const pickerInner = (
    <div
      ref={containerRef}
      className={`${
        usePortal
          ? "w-[620px] max-h-[80vh] flex flex-col"
          : "absolute top-full left-0 mt-1 w-[560px]"
      } bg-white rounded-xl border border-[#E4E4E7] shadow-xl`}
    >
      {/* Header con NCM actual */}
      <div className="p-3 border-b bg-[#FAFAFA] rounded-t-xl flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#71717A]">NCM actual:</span>
            {value ? (
              <span className="font-mono text-sm font-medium text-[#18181B]">
                {formatNCM(value)}
              </span>
            ) : (
              <span className="text-sm text-[#A1A1AA] italic">Sin asignar</span>
            )}
            {classificationSource && (
              <span className="text-xs text-[#A1A1AA] px-1.5 py-0.5 bg-[#F4F4F5] rounded">
                {SOURCE_LABELS[classificationSource] || classificationSource}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#E4E4E7] rounded text-[#A1A1AA]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="p-3 border-b flex-shrink-0">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por producto o código NCM..."
            className="w-full pl-9 pr-20 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium bg-[#2563EB] text-white rounded-md hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              "Buscar"
            )}
          </button>
        </div>
        {expandedQuery && expandedQuery !== query && (
          <p className="text-xs text-[#A1A1AA] mt-1.5 pl-1">
            Interpretado como:{" "}
            <span className="text-blue-500 italic">&ldquo;{expandedQuery}&rdquo;</span>
          </p>
        )}
      </form>

      {/* Results */}
      <div className={`${usePortal ? "flex-1 min-h-0" : "max-h-[380px]"} overflow-y-auto`}>
        {loading && (
          <div className="flex items-center justify-center py-8 text-[#A1A1AA]">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">Buscando...</span>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-8 text-[#A1A1AA]">
            <p className="text-sm">No se encontraron resultados.</p>
            <p className="text-xs mt-1">
              Intentá con otros términos o ingresá el código directamente.
            </p>
          </div>
        )}

        {!loading &&
          results.map((result, idx) => {
            const Icon = SOURCE_ICONS[result.match_type] || Tag;
            const colorClass =
              SOURCE_COLORS[result.match_type] || "text-[#71717A] bg-[#FAFAFA]";
            const isCurrentNCM =
              value && result.ncm_code.replace(/\./g, "") === value.replace(/\./g, "");
            const isExpanded = expandedIdx === idx;

            return (
              <div
                key={`${result.ncm_code}-${idx}`}
                className={`border-b last:border-b-0 ${isCurrentNCM ? "bg-green-50/30" : ""}`}
              >
                {/* Row compacta — click expande/colapsa */}
                <button
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50/50 transition-colors flex items-start gap-3 group"
                >
                  {/* Chevron */}
                  <div className="flex-shrink-0 mt-0.5 text-[#A1A1AA] group-hover:text-[#71717A]">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {/* NCM code + source badge */}
                  <div className="flex-shrink-0 w-24">
                    <span className="font-mono text-sm font-medium text-[#18181B]">
                      {formatNCM(result.ncm_code)}
                    </span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${colorClass}`}
                      >
                        <Icon size={10} />
                        {result.source}
                      </span>
                    </div>
                  </div>

                  {/* Description (truncated) + similarity */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#18181B] leading-snug">
                      {truncateDesc(result.description, isExpanded ? 300 : 80)}
                    </p>
                    <p className="text-xs text-[#A1A1AA] mt-0.5">
                      Similitud: {(result.similarity * 100).toFixed(0)}%
                      {result.exclusions && result.exclusions.length > 0 && (
                        <span className="ml-2 text-amber-500">
                          <AlertTriangle size={10} className="inline -mt-0.5" /> {result.exclusions.length} exclusión{result.exclusions.length > 1 ? "es" : ""}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Current indicator */}
                  {isCurrentNCM && (
                    <div className="flex-shrink-0 self-center">
                      <Check size={14} className="text-green-500" />
                    </div>
                  )}
                </button>

                {/* Panel expandido */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 ml-[38px] space-y-2">
                    {/* Descripción completa */}
                    <p className="text-sm text-[#18181B] leading-relaxed">
                      {result.description}
                    </p>

                    {/* Hierarchy breadcrumb */}
                    {result.hierarchy_path && result.hierarchy_path.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-xs text-cyan-700 bg-cyan-50 rounded-md px-2.5 py-1.5">
                        <GitBranch size={12} className="text-cyan-400 flex-shrink-0" />
                        {result.hierarchy_path.map((seg, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 && <span className="text-cyan-300">&rsaquo;</span>}
                            <span>{seg.replace(/^(Section|Chapter|Heading|Item|Sección|Capítulo|Partida|Subpartida):\s*/, "")}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Exclusiones detalladas */}
                    {result.exclusions && result.exclusions.length > 0 && (
                      <div className="space-y-1">
                        {result.exclusions.map((exc, i) => (
                          <div
                            key={exc.rule_id || i}
                            className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5"
                          >
                            <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                            <span>
                              {exc.letter && <strong className="mr-1">({exc.letter})</strong>}
                              {exc.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Info catálogo */}
                    {result.match_type === "catalog" && (result as NCMResult & { sku?: string; provider_description?: string }).sku && (
                      <p className="text-xs text-[#A1A1AA]">
                        SKU: {(result as NCMResult & { sku?: string }).sku}
                      </p>
                    )}

                    {/* Botón seleccionar */}
                    <button
                      onClick={() => onSelect(result.ncm_code, result.description)}
                      className={`w-full mt-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isCurrentNCM
                          ? "bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7]"
                          : "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                      }`}
                    >
                      {isCurrentNCM ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <Check size={12} /> NCM actual
                        </span>
                      ) : (
                        "Seleccionar este código"
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Manual input footer */}
      <div className="p-3 border-t bg-[#FAFAFA] rounded-b-xl flex-shrink-0">
        <ManualNCMInput
          onSelect={(code) => onSelect(code, "")}
        />
      </div>
    </div>
  );

  if (usePortal) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {pickerInner}
      </div>,
      document.body
    );
  }
  return pickerInner;
}

/** Input manual para cuando el usuario sabe el código exacto */
function ManualNCMInput({
  onSelect,
}: {
  onSelect: (code: string) => void;
}) {
  const [manualCode, setManualCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onSelect(manualCode.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <span className="text-xs text-[#71717A]">Ingresar código:</span>
      <input
        type="text"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="0000.00.00"
        className="flex-1 px-2 py-1 text-sm font-mono border rounded focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
      />
      <button
        type="submit"
        disabled={!manualCode.trim()}
        className="px-2 py-1 text-xs font-medium bg-[#E4E4E7] text-[#18181B] rounded hover:bg-[#D4D4D8] disabled:opacity-50"
      >
        Asignar
      </button>
    </form>
  );
}
