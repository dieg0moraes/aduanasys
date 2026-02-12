"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  Loader2,
  X,
  Check,
  ChevronRight,
  Database,
  FileText,
  Brain,
  Tag,
} from "lucide-react";

interface NCMResult {
  ncm_code: string;
  description: string;
  similarity: number;
  match_type: string;
  source: string;
}

interface NCMPickerProps {
  /** NCM code actual */
  value: string | null;
  /** Descripción del producto (se usa como query inicial) */
  productDescription?: string;
  /** Fuente de clasificación actual */
  classificationSource?: string;
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
};

const SOURCE_COLORS: Record<string, string> = {
  catalog: "text-purple-600 bg-purple-50",
  fulltext: "text-emerald-600 bg-emerald-50",
  trigram: "text-amber-600 bg-amber-50",
  semantic: "text-blue-600 bg-blue-50",
  exact: "text-gray-600 bg-gray-50",
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
  onSelect,
  onClose,
}: NCMPickerProps) {
  const [query, setQuery] = useState(productDescription || "");
  const [results, setResults] = useState<NCMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input al abrir
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Cerrar con click afuera
  useEffect(() => {
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
  }, [onClose]);

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

  return (
    <div
      ref={containerRef}
      className="absolute z-50 top-full left-0 mt-1 w-[560px] bg-white rounded-xl border border-gray-200 shadow-xl"
    >
      {/* Header con NCM actual */}
      <div className="p-3 border-b bg-gray-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">NCM actual:</span>
            {value ? (
              <span className="font-mono text-sm font-medium text-gray-800">
                {formatNCM(value)}
              </span>
            ) : (
              <span className="text-sm text-gray-400 italic">Sin asignar</span>
            )}
            {classificationSource && (
              <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded">
                {SOURCE_LABELS[classificationSource] || classificationSource}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 rounded text-gray-400"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="p-3 border-b">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por producto o código NCM..."
            className="w-full pl-9 pr-20 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E86C1] focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium bg-[#2E86C1] text-white rounded-md hover:bg-[#2471A3] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              "Buscar"
            )}
          </button>
        </div>
        {expandedQuery && expandedQuery !== query && (
          <p className="text-xs text-gray-400 mt-1.5 pl-1">
            Interpretado como:{" "}
            <span className="text-blue-500 italic">&ldquo;{expandedQuery}&rdquo;</span>
          </p>
        )}
      </form>

      {/* Results */}
      <div className="max-h-[320px] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            <span className="text-sm">Buscando...</span>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-8 text-gray-400">
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
              SOURCE_COLORS[result.match_type] || "text-gray-600 bg-gray-50";
            const isCurrentNCM =
              value && result.ncm_code.replace(/\./g, "") === value.replace(/\./g, "");

            return (
              <button
                key={`${result.ncm_code}-${idx}`}
                onClick={() => onSelect(result.ncm_code, result.description)}
                className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-blue-50/50 transition-colors flex items-start gap-3 group ${
                  isCurrentNCM ? "bg-green-50/50" : ""
                }`}
              >
                {/* NCM code */}
                <div className="flex-shrink-0 w-24">
                  <span className="font-mono text-sm font-medium text-gray-800">
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

                {/* Description */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-snug">
                    {truncateDesc(result.description)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Similitud: {(result.similarity * 100).toFixed(0)}%
                  </p>
                </div>

                {/* Selection indicator */}
                <div className="flex-shrink-0 self-center">
                  {isCurrentNCM ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-blue-500"
                    />
                  )}
                </div>
              </button>
            );
          })}
      </div>

      {/* Manual input footer */}
      <div className="p-3 border-t bg-gray-50 rounded-b-xl">
        <ManualNCMInput
          onSelect={(code) => onSelect(code, "")}
        />
      </div>
    </div>
  );
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
      <span className="text-xs text-gray-500">Ingresar código:</span>
      <input
        type="text"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="0000.00.00"
        className="flex-1 px-2 py-1 text-sm font-mono border rounded focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
      />
      <button
        type="submit"
        disabled={!manualCode.trim()}
        className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
      >
        Asignar
      </button>
    </form>
  );
}
