"use client";

import { useState, FormEvent } from "react";
import {
  Search,
  Loader2,
  BookOpen,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";

interface NCMResult {
  id: string;
  ncm_code: string;
  description: string;
  section: string;
  chapter: string;
  similarity: number;
  match_type: "catalog" | "fulltext" | "trigram" | "semantic" | "exact" | "graph";
  source: string;
  provider_description?: string;
  customs_description?: string;
  sku?: string;
  hierarchy_path?: string[];
  exclusions?: { rule_id: string; letter: string | null; description: string; target_codes: string[] }[];
}

interface SearchResponse {
  results: NCMResult[];
  query: string;
  expanded_query?: string;
  method: string;
  sources?: { catalog: number; fulltext: number; trigram: number; semantic: number; graph: number };
}

const LAYER_CONFIG: Record<string, { dotColor: string; label: string }> = {
  catalog: { dotColor: "bg-[#16A34A]", label: "Catalogo" },
  fulltext: { dotColor: "bg-[#2563EB]", label: "Full-text" },
  trigram: { dotColor: "bg-[#F59E0B]", label: "Soft match" },
  semantic: { dotColor: "bg-[#9333EA]", label: "Semantica" },
  exact: { dotColor: "bg-gray-500", label: "Exacto" },
  graph: { dotColor: "bg-cyan-500", label: "Grafo" },
};

export default function NCMPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NCMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sources, setSources] = useState<SearchResponse["sources"]>();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // clipboard not available
    }
  }

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setExpandedQuery("");
    setSources(undefined);
    setExpandedRows(new Set());

    try {
      const response = await fetch("/api/ncm/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, limit: 10, threshold: 0.5 }),
      });

      if (response.ok) {
        const data: SearchResponse = await response.json();
        setResults(data.results);
        setExpandedQuery(data.expanded_query || "");
        setSources(data.sources);
      }
    } catch (err) {
      console.error("Error searching NCM:", err);
    }

    setLoading(false);
  }

  function getSimilarityColor(score: number) {
    const pct = score * 100;
    if (pct >= 80) return "text-[#16A34A]";
    if (pct >= 50) return "text-[#F59E0B]";
    return "text-red-500";
  }

  function getSimilarityBg(score: number) {
    const pct = score * 100;
    if (pct >= 80) return "bg-green-50";
    if (pct >= 50) return "bg-amber-50";
    return "bg-red-50";
  }

  function getLayerDot(matchType: string) {
    const config = LAYER_CONFIG[matchType] || LAYER_CONFIG.semantic;
    return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${config.dotColor}`} />;
  }

  function truncateDescription(desc: string, maxLen: number = 80) {
    if (desc.length <= maxLen) return desc;
    return desc.slice(0, maxLen).trimEnd() + "...";
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#18181B] flex items-center gap-2 mb-2">
          <BookOpen size={28} className="text-[#2563EB]" />
          Busqueda de Codigos NCM
        </h1>
        <p className="text-sm text-[#71717A]">
          Busca codigos NCM por descripcion del producto, codigo numerico, o
          nombre de un producto ya clasificado.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 mb-6">
        <form onSubmit={handleSearch}>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#A1A1AA]"
              />
              <input
                type="text"
                placeholder="Ej: 'mouse inalambrico', 'telas de algodon', 'LATTAFA' o '6204'"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="w-full pl-12 pr-4 py-3.5 rounded-lg border border-[#E4E4E7] text-base text-[#18181B] placeholder:text-[#A1A1AA] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition-shadow"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-[#2563EB] text-white rounded-md px-4 py-2 font-medium hover:bg-[#1D4ED8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search size={18} />
                  Buscar
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* AI Expansion Card */}
      {!loading && hasSearched && expandedQuery && expandedQuery !== query.trim() && (
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-lg p-3 mb-6">
          <p className="text-sm text-[#3B82F6]">
            Interpretado como: <em className="text-[#1D4ED8]">&ldquo;{expandedQuery}&rdquo;</em>
          </p>
        </div>
      )}

      {/* Initial State */}
      {!loading && !hasSearched && (
        <div className="text-center py-20">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-[#71717A]">
            Escribi una descripcion de producto y presiona{" "}
            <strong>Buscar</strong> o <strong>Enter</strong>
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-[#2563EB]" />
          <p className="text-sm text-[#71717A]">
            Buscando en catalogo, texto, semantica y grafo...
          </p>
        </div>
      )}

      {/* No Results */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-20">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-[#71717A]">No se encontraron resultados</p>
          <p className="text-xs text-[#A1A1AA] mt-2">
            Proba con otros terminos o un codigo NCM directo
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E4E4E7]">
          {/* Results Header with Legend */}
          <div className="px-5 py-4 border-b border-[#E4E4E7] flex items-center justify-between">
            <p className="text-sm text-[#71717A]">
              {results.length} resultado{results.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-4 text-xs text-[#71717A]">
              {Object.entries(LAYER_CONFIG)
                .filter(([key]) => {
                  // Only show layers that appear in results
                  return results.some((r) => r.match_type === key);
                })
                .map(([key, config]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${config.dotColor}`} />
                    {config.label}
                  </span>
                ))}
            </div>
          </div>

          {/* Result Rows */}
          <div className="divide-y divide-[#E4E4E7]">
            {results.map((result) => {
              const rowKey = `${result.match_type}-${result.id}`;
              const isExpanded = expandedRows.has(rowKey);
              const similarityPct = Math.round(result.similarity * 100);

              return (
                <div key={rowKey}>
                  {/* Collapsed Row */}
                  <button
                    type="button"
                    onClick={() => toggleRow(rowKey)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFA] transition-colors text-left"
                  >
                    {/* Expand/Collapse Icon */}
                    {isExpanded ? (
                      <ChevronDown size={16} className="text-[#A1A1AA] flex-shrink-0" />
                    ) : (
                      <ChevronRight size={16} className="text-[#A1A1AA] flex-shrink-0" />
                    )}

                    {/* Layer Dot */}
                    {getLayerDot(result.match_type)}

                    {/* NCM Code Pill */}
                    <span className="font-mono text-sm font-medium bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                      {result.ncm_code}
                    </span>

                    {/* Truncated Description */}
                    <span className="text-sm text-[#52525B] truncate flex-1 min-w-0">
                      {truncateDescription(result.description, 90)}
                    </span>

                    {/* Similarity Percentage */}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${getSimilarityBg(result.similarity)} ${getSimilarityColor(result.similarity)}`}
                    >
                      {similarityPct}%
                    </span>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pl-16 space-y-3 bg-[#FAFAFA]">
                      {/* Full Description */}
                      <div>
                        <p className="text-xs font-medium text-[#71717A] mb-1">Descripcion completa</p>
                        <p className="text-sm text-[#18181B]">{result.description}</p>
                      </div>

                      {/* Hierarchy Breadcrumb */}
                      {result.hierarchy_path && result.hierarchy_path.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-[#71717A] mb-1">Jerarquia</p>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-[#52525B]">
                            {result.hierarchy_path.map((seg, i) => {
                              const label = seg
                                .replace(/^(Section|Chapter|Heading|Item|Sección|Capítulo|Partida|Subpartida):\s*/, "")
                                .split(" - ")[0];
                              return (
                                <span key={i} className="flex items-center gap-1">
                                  {i > 0 && <span className="text-[#D4D4D8]">&rsaquo;</span>}
                                  <span>{label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Exclusion Warnings */}
                      {result.exclusions && result.exclusions.length > 0 && (
                        <div className="space-y-1.5">
                          {result.exclusions.map((exc, i) => (
                            <div
                              key={exc.rule_id || i}
                              className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5"
                            >
                              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                              <span>{exc.description}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Catalog Extra Info */}
                      {result.match_type === "catalog" && (
                        <div className="text-xs text-[#71717A] space-y-0.5">
                          {result.sku && <p>SKU: {result.sku}</p>}
                          {result.provider_description && (
                            <p>Proveedor: {result.provider_description}</p>
                          )}
                        </div>
                      )}

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(result.ncm_code)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors mt-1"
                      >
                        {copiedCode === result.ncm_code ? (
                          <>
                            <Check size={14} />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
