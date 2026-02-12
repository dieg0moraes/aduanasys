"use client";

import { useState, FormEvent } from "react";
import {
  Search,
  Loader2,
  BookOpen,
  Hash,
  Database,
  FileText,
  Brain,
  Tag,
} from "lucide-react";

interface NCMResult {
  id: string;
  ncm_code: string;
  description: string;
  section: string;
  chapter: string;
  similarity: number;
  match_type: "catalog" | "fulltext" | "trigram" | "semantic" | "exact";
  source: string;
  provider_description?: string;
  customs_description?: string;
  sku?: string;
}

interface SearchResponse {
  results: NCMResult[];
  query: string;
  expanded_query?: string;
  method: string;
  sources?: { catalog: number; fulltext: number; trigram: number; semantic: number };
}

const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Database; color: string; bg: string; label: string }
> = {
  catalog: {
    icon: Database,
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
    label: "Catálogo",
  },
  fulltext: {
    icon: FileText,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
    label: "Full-text",
  },
  trigram: {
    icon: Search,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    label: "Soft match",
  },
  semantic: {
    icon: Brain,
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    label: "Semántica",
  },
  exact: {
    icon: Tag,
    color: "text-gray-700",
    bg: "bg-gray-50 border-gray-200",
    label: "Código exacto",
  },
};

export default function NCMPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NCMResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedQuery, setExpandedQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sources, setSources] = useState<SearchResponse["sources"]>();

  async function handleSearch(e?: FormEvent) {
    e?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setExpandedQuery("");
    setSources(undefined);

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
    if (score >= 0.9) return "bg-green-100 text-green-700";
    if (score >= 0.8) return "bg-emerald-100 text-emerald-700";
    if (score >= 0.6) return "bg-yellow-100 text-yellow-700";
    return "bg-orange-100 text-orange-700";
  }

  function getSourceBadge(matchType: string) {
    const config = SOURCE_CONFIG[matchType] || SOURCE_CONFIG.semantic;
    const Icon = config.icon;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.color}`}
      >
        <Icon size={12} />
        {config.label}
      </span>
    );
  }

  function renderDescription(description: string) {
    const parts = description.split(" > ");
    if (parts.length === 1) {
      return <p className="text-sm text-gray-700">{description}</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {parts.map((part, idx) => (
          <span key={idx} className="flex items-center gap-1.5">
            <span
              className={`text-sm ${
                idx === parts.length - 1
                  ? "text-gray-900 font-medium"
                  : "text-gray-500"
              }`}
            >
              {part.trim()}
            </span>
            {idx < parts.length - 1 && (
              <span className="text-gray-300 text-xs">&rsaquo;</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <BookOpen size={28} className="text-[#2E86C1]" />
          Búsqueda de Códigos NCM
        </h1>
        <p className="text-sm text-gray-500">
          Buscá códigos NCM por descripción del producto, código numérico, o
          nombre de un producto ya clasificado.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Ej: 'mouse inalámbrico', 'telas de algodón', 'LATTAFA' o '6204'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] disabled:bg-gray-50 disabled:text-gray-400"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-[#2E86C1] text-white rounded-lg font-medium hover:bg-[#2874A6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

      {/* Search Info */}
      {!loading && hasSearched && (expandedQuery || sources) && (
        <div className="mb-6 space-y-3 max-w-4xl">
          {expandedQuery && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">
                Búsqueda interpretada como:
              </p>
              <p className="text-sm text-blue-700 italic">
                &ldquo;{expandedQuery}&rdquo;
              </p>
            </div>
          )}
          {sources && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span>Fuentes:</span>
              {sources.catalog > 0 && (
                <span className="flex items-center gap-1">
                  <Database size={12} className="text-purple-500" />
                  {sources.catalog} catálogo
                </span>
              )}
              {sources.fulltext > 0 && (
                <span className="flex items-center gap-1">
                  <FileText size={12} className="text-emerald-500" />
                  {sources.fulltext} full-text
                </span>
              )}
              {sources.trigram > 0 && (
                <span className="flex items-center gap-1">
                  <Search size={12} className="text-amber-500" />
                  {sources.trigram} soft match
                </span>
              )}
              {sources.semantic > 0 && (
                <span className="flex items-center gap-1">
                  <Brain size={12} className="text-blue-500" />
                  {sources.semantic} semántica
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Initial State */}
      {!loading && !hasSearched && (
        <div className="text-center py-20">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">
            Escribí una descripción de producto y presioná{" "}
            <strong>Buscar</strong> o <strong>Enter</strong>
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-[#2E86C1]" />
          <p className="text-sm text-gray-500">
            Buscando en catálogo, texto y semántica...
          </p>
        </div>
      )}

      {/* No Results */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center py-20">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No se encontraron resultados</p>
          <p className="text-xs text-gray-400 mt-2">
            Probá con otros términos o un código NCM directo
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {results.length} resultado{results.length !== 1 ? "s" : ""}
          </p>

          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={`${result.match_type}-${result.id}`}
                className="bg-white rounded-lg border border-gray-200 hover:border-[#2E86C1]/30 hover:shadow-sm transition-all p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
                      <Hash size={18} className="text-[#2E86C1]" />
                    </div>
                    <div>
                      <span className="font-mono text-lg font-bold text-gray-900">
                        {result.ncm_code}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        Cap. {result.chapter}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getSourceBadge(result.match_type)}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${getSimilarityColor(
                        result.similarity
                      )}`}
                    >
                      {Math.round(result.similarity * 100)}%
                    </span>
                  </div>
                </div>

                <div className="ml-14">
                  {renderDescription(result.description)}

                  {/* Info extra del catálogo */}
                  {result.match_type === "catalog" && (
                    <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                      {result.sku && <p>SKU: {result.sku}</p>}
                      {result.provider_description && (
                        <p>Proveedor: {result.provider_description}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
