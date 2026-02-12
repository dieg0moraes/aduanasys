/**
 * Servicio de búsqueda NCM multi-capa.
 *
 * Capas:
 *   1. Catálogo de productos (exact SKU + fulltext)
 *   2. Full-text search en NCM (tsvector + stemming español)
 *   3. Trigram similarity (fuzzy/soft match)
 *   4. Búsqueda semántica (OpenAI embeddings + query expansion)
 *
 * Uso interno:
 *   import { searchNCM } from "@/lib/ncm-search";
 *   const { results, expandedQuery } = await searchNCM(supabase, "mouse inalámbrico");
 */

import { generateEmbedding, generateEmbeddings } from "@/lib/embeddings";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfidenceLevel, ClassificationSource } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface NCMSearchResult {
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

export interface NCMSearchResponse {
  results: NCMSearchResult[];
  query: string;
  expanded_query: string;
  method: "exact_code" | "multi";
  sources: {
    catalog: number;
    fulltext: number;
    trigram: number;
    semantic: number;
  };
}

export interface NCMSearchOptions {
  limit?: number;
  threshold?: number;
  /** Saltar query expansion (ej: si la descripción ya es técnica/aduanera) */
  skipExpansion?: boolean;
}

// ---------------------------------------------------------------------------
// Scores mínimos por capa
// ---------------------------------------------------------------------------

const MIN_SCORES: Record<string, number> = {
  catalog: 0.0,
  fulltext: 0.0,
  trigram: 0.40,
  semantic: 0.30,
};

// ---------------------------------------------------------------------------
// Anthropic client (lazy init para no fallar si no hay API key en import)
// ---------------------------------------------------------------------------

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _anthropic;
}

// ---------------------------------------------------------------------------
// Query expansion con Claude Haiku
// ---------------------------------------------------------------------------

export async function expandQuery(query: string): Promise<string> {
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Sos un clasificador aduanero NCM del Mercosur.
Traducí el producto a la descripción que usaría el nomenclador NCM.

REGLAS:
- UNA sola frase, máximo 12 palabras
- Clasificá la CATEGORÍA del producto en terminología aduanera (ej: "mouse" → "unidad de entrada para máquinas de procesamiento de datos")
- NO agregues atributos técnicos específicos que no estén en el texto (ej: no decir "LCD" si no lo menciona)
- NO uses listas, sinónimos ni explicaciones
- Respondé SOLO con la frase

Ejemplos:
- "mouse inalámbrico" → "Unidad de entrada inalámbrica para máquinas de procesamiento de datos"
- "televisor 50 pulgadas" → "Aparato receptor de televisión de 50 pulgadas"
- "perfume Chanel" → "Perfume, extracto de perfumería"
- "tornillos de acero" → "Tornillos de acero, de hierro o acero"
- "cable USB" → "Cable eléctrico para transmisión de datos"
- "ibuprofeno 400mg" → "Medicamento que contiene ibuprofeno, dosificado para venta al por menor"
- "muñeca Barbie" → "Muñecas y muñecos, juguetes que representen figuras humanas"
- "alcohol en gel" → "Desinfectante a base de alcohol, preparación para higiene"

Producto: "${query}"`,
        },
      ],
    });

    const expanded =
      response.content[0].type === "text" ? response.content[0].text : query;
    console.log(`[NCM Search] Query expansion: "${query}" → "${expanded}"`);
    return expanded;
  } catch (err) {
    console.warn("[NCM Search] Query expansion falló:", err);
    return query;
  }
}

// ---------------------------------------------------------------------------
// Capa 1: Catálogo de productos
// ---------------------------------------------------------------------------

async function searchCatalog(
  supabase: SupabaseClient,
  query: string
): Promise<NCMSearchResult[]> {
  const { data, error } = await supabase.rpc("search_catalog_fulltext", {
    search_query: query,
    match_count: 5,
  });

  if (error || !data) {
    const { data: fallback } = await supabase
      .from("product_catalog")
      .select("id, sku, provider_description, customs_description, ncm_code")
      .or(
        `sku.ilike.%${query}%,provider_description.ilike.%${query}%,customs_description.ilike.%${query}%`
      )
      .not("ncm_code", "is", null)
      .limit(5);

    if (!fallback || fallback.length === 0) return [];

    return fallback.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      ncm_code: (item.ncm_code as string) || "",
      description:
        (item.customs_description as string) ||
        (item.provider_description as string) ||
        "",
      section: "",
      chapter: ((item.ncm_code as string) || "").substring(0, 2),
      similarity: 1.0,
      match_type: "catalog" as const,
      source: "Catálogo",
      provider_description: item.provider_description as string,
      customs_description: item.customs_description as string,
      sku: item.sku as string,
    }));
  }

  return data.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    ncm_code: (item.ncm_code as string) || "",
    description:
      (item.customs_description as string) ||
      (item.provider_description as string) ||
      "",
    section: "",
    chapter: ((item.ncm_code as string) || "").substring(0, 2),
    similarity: 1.0,
    match_type: "catalog" as const,
    source: "Catálogo",
    provider_description: item.provider_description as string,
    customs_description: item.customs_description as string,
    sku: item.sku as string,
  }));
}

// ---------------------------------------------------------------------------
// Capa 2: Full-text search en NCM
// ---------------------------------------------------------------------------

async function searchNCMFulltext(
  supabase: SupabaseClient,
  query: string,
  expandedQuery?: string
): Promise<NCMSearchResult[]> {
  const { data, error } = await supabase.rpc("search_ncm_fulltext", {
    search_query: query,
    match_count: 5,
  });

  let allData = !error && data ? data : [];

  if (expandedQuery && expandedQuery !== query) {
    const { data: expandedData, error: expandedErr } = await supabase.rpc(
      "search_ncm_fulltext",
      { search_query: expandedQuery, match_count: 5 }
    );
    if (!expandedErr && expandedData) {
      const seen = new Map<string, Record<string, unknown>>();
      for (const item of [...allData, ...expandedData]) {
        const code = item.ncm_code as string;
        const existing = seen.get(code);
        if (!existing || (item.rank as number) > (existing.rank as number)) {
          seen.set(code, item);
        }
      }
      allData = Array.from(seen.values());
    }
  }

  if (allData.length === 0) return [];

  const maxRank = Math.max(
    ...allData.map((r: Record<string, unknown>) => r.rank as number)
  );

  return allData.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    ncm_code: item.ncm_code as string,
    description: item.description as string,
    section: (item.section as string) || "",
    chapter: (item.chapter as string) || "",
    similarity:
      maxRank > 0
        ? 0.85 + 0.15 * ((item.rank as number) / maxRank)
        : 0.9,
    match_type: "fulltext" as const,
    source: "Full-text",
  }));
}

// ---------------------------------------------------------------------------
// Capa 3: Trigram similarity
// ---------------------------------------------------------------------------

async function searchNCMTrigram(
  supabase: SupabaseClient,
  query: string
): Promise<NCMSearchResult[]> {
  const { data, error } = await supabase.rpc("search_ncm_trigram", {
    search_query: query,
    match_threshold: MIN_SCORES.trigram,
    match_count: 5,
  });

  if (error || !data || data.length === 0) return [];

  return data.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    ncm_code: item.ncm_code as string,
    description: item.description as string,
    section: (item.section as string) || "",
    chapter: (item.chapter as string) || "",
    similarity: item.sim as number,
    match_type: "trigram" as const,
    source: "Soft match",
  }));
}

// ---------------------------------------------------------------------------
// Capa 4: Búsqueda semántica
// ---------------------------------------------------------------------------

async function searchNCMSemantic(
  supabase: SupabaseClient,
  expandedQuery: string,
  threshold: number
): Promise<NCMSearchResult[]> {
  const queryEmbedding = await generateEmbedding(expandedQuery);

  const { data, error } = await supabase.rpc("search_ncm", {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: 10,
  });

  if (error || !data) {
    console.error("Error búsqueda semántica:", error);
    return [];
  }

  const raw = data as Array<Record<string, unknown>>;

  let filtered = raw;
  if (raw.length >= 2) {
    const top = raw[0].similarity as number;
    filtered = raw.filter(
      (r) => (top - (r.similarity as number)) <= 0.02
    );
    if (filtered.length === 0) filtered = [raw[0]];
    if (filtered.length > 5) filtered = filtered.slice(0, 5);
  }

  return filtered.map((r) => ({
    id: r.id as string,
    ncm_code: r.ncm_code as string,
    description: r.description as string,
    section: (r.section as string) || "",
    chapter: (r.chapter as string) || "",
    similarity: r.similarity as number,
    match_type: "semantic" as const,
    source: "Semántica",
  }));
}

// ---------------------------------------------------------------------------
// Combinar resultados con scores ponderados
// ---------------------------------------------------------------------------

function combineResults(
  catalog: NCMSearchResult[],
  fulltext: NCMSearchResult[],
  trigram: NCMSearchResult[],
  semantic: NCMSearchResult[]
): NCMSearchResult[] {
  const seen = new Map<string, NCMSearchResult>();

  const sourceBonus: Record<string, number> = {
    catalog: 0.10,
    fulltext: 0.03,
    semantic: 0.01,
    trigram: 0.00,
  };

  const allResults = [
    ...catalog,
    ...fulltext,
    ...trigram,
    ...semantic,
  ].filter((r) => r.similarity >= (MIN_SCORES[r.match_type] || 0));

  for (const r of allResults) {
    const effectiveScore = r.similarity + (sourceBonus[r.match_type] || 0);
    const existing = seen.get(r.ncm_code);

    if (!existing) {
      seen.set(r.ncm_code, r);
    } else {
      const existingEffective =
        existing.similarity + (sourceBonus[existing.match_type] || 0);
      if (effectiveScore > existingEffective) {
        seen.set(r.ncm_code, r);
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const scoreA = a.similarity + (sourceBonus[a.match_type] || 0);
    const scoreB = b.similarity + (sourceBonus[b.match_type] || 0);
    return scoreB - scoreA;
  });
}

// ---------------------------------------------------------------------------
// Función principal — API pública del servicio
// ---------------------------------------------------------------------------

export async function searchNCM(
  supabase: SupabaseClient,
  query: string,
  options: NCMSearchOptions = {}
): Promise<NCMSearchResponse> {
  const { limit = 10, threshold = 0.5, skipExpansion = false } = options;
  const trimmedQuery = query.trim();

  // Búsqueda exacta por código NCM
  if (/^\d{2,4}[\.\d]*$/.test(trimmedQuery)) {
    const { data: exactMatches } = await supabase
      .from("ncm_nomenclator")
      .select("id, ncm_code, description, section, chapter")
      .ilike("ncm_code", `${trimmedQuery}%`)
      .limit(limit);

    if (exactMatches && exactMatches.length > 0) {
      return {
        results: exactMatches.map((m) => ({
          ...m,
          similarity: 1.0,
          match_type: "exact" as const,
          source: "Código NCM",
        })),
        query: trimmedQuery,
        expanded_query: trimmedQuery,
        method: "exact_code",
        sources: { catalog: 0, fulltext: 0, trigram: 0, semantic: 0 },
      };
    }
  }

  // Expandir query
  const expandedQuery = skipExpansion
    ? trimmedQuery
    : await expandQuery(trimmedQuery);

  // Ejecutar las 4 capas en paralelo
  const [catalogResults, fulltextResults, trigramResults, semanticResults] =
    await Promise.all([
      searchCatalog(supabase, trimmedQuery),
      searchNCMFulltext(supabase, trimmedQuery, expandedQuery),
      searchNCMTrigram(supabase, trimmedQuery),
      searchNCMSemantic(supabase, expandedQuery, threshold),
    ]);

  const results = combineResults(
    catalogResults,
    fulltextResults,
    trigramResults,
    semanticResults
  ).slice(0, limit);

  return {
    results,
    query: trimmedQuery,
    expanded_query: expandedQuery,
    method: "multi",
    sources: {
      catalog: catalogResults.length,
      fulltext: fulltextResults.length,
      trigram: trigramResults.length,
      semantic: semanticResults.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Clasificación batch para facturas
// ---------------------------------------------------------------------------

export interface InvoiceItemInput {
  index: number;
  sku: string | null;
  original_description: string;
  suggested_customs_description: string | null;
  suggested_ncm_code: string | null;
}

export interface InvoiceItemClassification {
  ncm_code: string | null;
  customs_description: string | null;
  confidence_level: ConfidenceLevel;
  classification_source: ClassificationSource;
}

/**
 * Clasifica todos los items de una factura en batch optimizado.
 *
 * Flujo:
 *   1. Batch catalog lookup — 1 query para traer todos los SKUs del proveedor
 *   2. Para items sin match:
 *      a. Batch query expansion — 1 llamada a Haiku con todos los items juntos
 *      b. Batch embeddings — 1 llamada a OpenAI con todos los textos
 *      c. Por cada item: fulltext + trigram + semantic (queries rápidas a Supabase)
 */
export async function classifyInvoiceItems(
  supabase: SupabaseClient,
  items: InvoiceItemInput[],
  providerId: string | null
): Promise<InvoiceItemClassification[]> {
  const results: InvoiceItemClassification[] = items.map((item) => ({
    ncm_code: item.suggested_ncm_code,
    customs_description: item.suggested_customs_description,
    confidence_level: "low" as ConfidenceLevel,
    classification_source: "llm_rag" as ClassificationSource,
  }));

  // =========================================================================
  // Paso 1: Batch catalog lookup (1 sola query)
  // =========================================================================
  const skusToLookup = items
    .map((item, i) => ({ sku: item.sku, index: i }))
    .filter((x) => x.sku && providerId);

  if (skusToLookup.length > 0 && providerId) {
    const skuList = skusToLookup.map((x) => x.sku!);
    const { data: catalogMatches } = await supabase
      .from("product_catalog")
      .select("sku, customs_description, ncm_code, id, times_used")
      .eq("provider_id", providerId)
      .in("sku", skuList);

    if (catalogMatches) {
      const catalogMap = new Map(
        catalogMatches.map((m: Record<string, unknown>) => [m.sku as string, m])
      );

      for (const { sku, index } of skusToLookup) {
        const match = catalogMap.get(sku!);
        if (match) {
          results[index] = {
            ncm_code: match.ncm_code as string,
            customs_description: match.customs_description as string,
            confidence_level: "high",
            classification_source: "exact_match",
          };

          // Actualizar times_used en background (no bloquear)
          supabase
            .from("product_catalog")
            .update({
              times_used: ((match.times_used as number) || 0) + 1,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", match.id as string)
            .then(() => {});
        }
      }
    }
  }

  // =========================================================================
  // Paso 2: Identificar items que necesitan búsqueda NCM
  // =========================================================================
  const unresolvedItems = items
    .map((item, i) => ({ item, index: i }))
    .filter((x) => results[x.index].classification_source !== "exact_match");

  if (unresolvedItems.length === 0) {
    console.log("[Classify] Todos los items matchearon en catálogo");
    return results;
  }

  console.log(
    `[Classify] ${items.length - unresolvedItems.length} catálogo, ${unresolvedItems.length} pendientes de búsqueda NCM`
  );

  // =========================================================================
  // Paso 3: Batch query expansion (1 llamada a Haiku para todos)
  // =========================================================================
  const descriptions = unresolvedItems.map(
    (x) => x.item.original_description || x.item.suggested_customs_description || ""
  );

  let expandedQueries: string[];
  try {
    expandedQueries = await batchExpandQueries(descriptions);
  } catch {
    expandedQueries = descriptions;
  }

  // =========================================================================
  // Paso 4: Batch embeddings (1 llamada a OpenAI para todos)
  // =========================================================================
  let embeddings: number[][];
  try {
    embeddings = await generateEmbeddings(expandedQueries);
  } catch (err) {
    console.warn("[Classify] Error generando embeddings batch:", err);
    embeddings = [];
  }

  // =========================================================================
  // Paso 5: Para cada item pendiente, buscar con fulltext + trigram + semantic
  // Las queries a Supabase son rápidas (~5ms cada una)
  // =========================================================================
  await Promise.all(
    unresolvedItems.map(async ({ item, index }, batchIdx) => {
      const query = descriptions[batchIdx];
      const expanded = expandedQueries[batchIdx] || query;

      if (!query) return;

      // Fulltext + trigram en paralelo (no necesitan embedding)
      const [fulltextResults, trigramResults] = await Promise.all([
        searchNCMFulltext(supabase, query, expanded),
        searchNCMTrigram(supabase, query),
      ]);

      // Semantic con el embedding pre-generado
      let semanticResults: NCMSearchResult[] = [];
      if (embeddings[batchIdx]) {
        const { data } = await supabase.rpc("search_ncm", {
          query_embedding: embeddings[batchIdx],
          match_threshold: 0.3,
          match_count: 5,
        });

        if (data) {
          const raw = data as Array<Record<string, unknown>>;
          let filtered = raw;
          if (raw.length >= 2) {
            const top = raw[0].similarity as number;
            filtered = raw.filter(
              (r) => (top - (r.similarity as number)) <= 0.02
            );
            if (filtered.length === 0) filtered = [raw[0]];
            if (filtered.length > 5) filtered = filtered.slice(0, 5);
          }
          semanticResults = filtered.map((r) => ({
            id: r.id as string,
            ncm_code: r.ncm_code as string,
            description: r.description as string,
            section: (r.section as string) || "",
            chapter: (r.chapter as string) || "",
            similarity: r.similarity as number,
            match_type: "semantic" as const,
            source: "Semántica",
          }));
        }
      }

      // Combinar resultados
      const combined = combineResults(
        [], // sin catálogo (ya lo chequeamos en paso 1)
        fulltextResults,
        trigramResults,
        semanticResults
      );

      if (combined.length > 0) {
        const top = combined[0];
        const currentNCM = results[index].ncm_code;

        if (top.similarity >= 0.65 || !currentNCM) {
          results[index] = {
            ncm_code: top.ncm_code,
            customs_description:
              results[index].customs_description || top.description,
            confidence_level:
              top.similarity >= 0.85
                ? "high"
                : top.similarity >= 0.65
                  ? "medium"
                  : "low",
            classification_source: "semantic",
          };
        } else if (currentNCM) {
          // Claude sugirió algo — verificar si la búsqueda confirma el capítulo
          const cleanCode = currentNCM.replace(/\./g, "");
          const confirmed = combined.some((r) =>
            r.ncm_code.startsWith(cleanCode.substring(0, 4))
          );
          results[index].confidence_level = confirmed ? "medium" : "low";
        }
      }

      // Fallback: si Claude sugirió NCM y no mejoró nada → medium
      if (
        results[index].classification_source === "llm_rag" &&
        results[index].ncm_code &&
        results[index].confidence_level === "low"
      ) {
        results[index].confidence_level = "medium";
      }
    })
  );

  return results;
}

// ---------------------------------------------------------------------------
// Batch query expansion — 1 sola llamada a Haiku para N items
// ---------------------------------------------------------------------------

async function batchExpandQueries(descriptions: string[]): Promise<string[]> {
  if (descriptions.length === 0) return [];

  // Si es un solo item, usar expandQuery normal
  if (descriptions.length === 1) {
    const expanded = await expandQuery(descriptions[0]);
    return [expanded];
  }

  try {
    const anthropic = getAnthropic();
    const numberedList = descriptions
      .map((d, i) => `${i + 1}. "${d}"`)
      .join("\n");

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Sos un clasificador aduanero NCM del Mercosur.
Para cada producto, generá UNA frase corta (máx 12 palabras) con la descripción que usaría el nomenclador NCM.

REGLAS:
- Clasificá la CATEGORÍA en terminología aduanera
- NO agregues atributos que no estén en el texto
- Respondé SOLO con la lista numerada, una línea por producto

Productos:
${numberedList}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parsear respuesta: "1. Descripción\n2. Descripción\n..."
    const lines = text.split("\n").filter((l) => l.trim());
    const expanded: string[] = [];

    for (let i = 0; i < descriptions.length; i++) {
      const line = lines.find((l) => l.match(new RegExp(`^${i + 1}[\\.\\)]\\s*`)));
      if (line) {
        expanded.push(line.replace(/^\d+[\.\)]\s*[""]?/, "").replace(/[""]?\s*$/, "").trim());
      } else {
        expanded.push(descriptions[i]); // fallback al original
      }
    }

    console.log(
      `[Classify] Batch query expansion: ${descriptions.length} items expandidos en 1 llamada`
    );
    return expanded;
  } catch (err) {
    console.warn("[Classify] Batch expansion falló, usando originales:", err);
    return descriptions;
  }
}
