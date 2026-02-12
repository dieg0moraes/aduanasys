// @ts-nocheck
/**
 * Script de evaluación de calidad de búsqueda NCM.
 *
 * Prueba diferentes queries contra el endpoint y evalúa:
 * 1. Si el NCM correcto aparece en los resultados
 * 2. En qué posición aparece
 * 3. Qué capa lo encontró (catálogo, fulltext, trigram, semántica)
 * 4. Si la query expansion ayudó o perjudicó
 *
 * Uso: npx tsx scripts/eval-search.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";

// ---------------------------------------------------------------------------
// Set de pruebas: producto real → NCM esperado (capítulo al menos)
// ---------------------------------------------------------------------------

interface TestCase {
  query: string;
  expected_ncm: string; // Código NCM esperado (puede ser parcial: "3303" matchea "3303.00.xx")
  expected_chapter: string;
  category: string;
}

const TEST_CASES: TestCase[] = [
  // --- Electrónica / Tecnología ---
  { query: "mouse inalámbrico", expected_ncm: "8471.60", expected_chapter: "84", category: "Electrónica" },
  { query: "teclado mecánico RGB", expected_ncm: "8471.60", expected_chapter: "84", category: "Electrónica" },
  { query: "monitor LED 27 pulgadas", expected_ncm: "8528", expected_chapter: "85", category: "Electrónica" },
  { query: "television 50 pulgadas", expected_ncm: "8528.7", expected_chapter: "85", category: "Electrónica" },
  { query: "cable USB tipo C", expected_ncm: "8544", expected_chapter: "85", category: "Electrónica" },
  { query: "auriculares bluetooth", expected_ncm: "8518", expected_chapter: "85", category: "Electrónica" },
  { query: "cargador de celular", expected_ncm: "8504", expected_chapter: "85", category: "Electrónica" },
  { query: "notebook Lenovo 15 pulgadas", expected_ncm: "8471.30", expected_chapter: "84", category: "Electrónica" },

  // --- Cosmética / Perfumería ---
  { query: "LATTAFA THARWAH SILVER 3.4 EDP M", expected_ncm: "3303", expected_chapter: "33", category: "Cosmética" },
  { query: "perfume importado 100ml", expected_ncm: "3303", expected_chapter: "33", category: "Cosmética" },
  { query: "crema hidratante facial", expected_ncm: "3304", expected_chapter: "33", category: "Cosmética" },
  { query: "shampoo anticaída 400ml", expected_ncm: "3305", expected_chapter: "33", category: "Cosmética" },

  // --- Textiles ---
  { query: "telas de algodón", expected_ncm: "5208", expected_chapter: "52", category: "Textiles" },
  { query: "remeras de poliéster", expected_ncm: "6109", expected_chapter: "61", category: "Textiles" },
  { query: "jean de hombre", expected_ncm: "6203", expected_chapter: "62", category: "Textiles" },
  { query: "zapatillas deportivas", expected_ncm: "6404", expected_chapter: "64", category: "Textiles" },

  // --- Alimentos ---
  { query: "aceite de oliva virgen extra", expected_ncm: "1509", expected_chapter: "15", category: "Alimentos" },
  { query: "chocolate con leche", expected_ncm: "1806", expected_chapter: "18", category: "Alimentos" },
  { query: "yerba mate 1kg", expected_ncm: "0903", expected_chapter: "09", category: "Alimentos" },
  { query: "vino tinto Malbec", expected_ncm: "2204", expected_chapter: "22", category: "Alimentos" },

  // --- Ferretería / Industrial ---
  { query: "tornillos de acero inoxidable", expected_ncm: "7318", expected_chapter: "73", category: "Ferretería" },
  { query: "tubo de PVC 110mm", expected_ncm: "3917", expected_chapter: "39", category: "Ferretería" },
  { query: "pintura latex interior 20 litros", expected_ncm: "3209", expected_chapter: "32", category: "Ferretería" },

  // --- Automotriz ---
  { query: "neumáticos para auto R16", expected_ncm: "4011", expected_chapter: "40", category: "Automotriz" },
  { query: "batería de auto 12V", expected_ncm: "8507", expected_chapter: "85", category: "Automotriz" },
  { query: "aceite de motor 5W30", expected_ncm: "2710", expected_chapter: "27", category: "Automotriz" },

  // --- Farmacia ---
  { query: "ibuprofeno 400mg comprimidos", expected_ncm: "3004", expected_chapter: "30", category: "Farmacia" },
  { query: "alcohol en gel 500ml", expected_ncm: "3808", expected_chapter: "38", category: "Farmacia" },

  // --- Juguetes ---
  { query: "muñeca Barbie", expected_ncm: "9503", expected_chapter: "95", category: "Juguetes" },
  { query: "pelota de fútbol", expected_ncm: "9506", expected_chapter: "95", category: "Juguetes" },
];

// ---------------------------------------------------------------------------
// Ejecutar búsqueda
// ---------------------------------------------------------------------------

interface SearchResult {
  ncm_code: string;
  description: string;
  similarity: number;
  match_type: string;
  source: string;
}

interface SearchResponse {
  results: SearchResult[];
  expanded_query?: string;
  sources?: Record<string, number>;
}

async function search(query: string): Promise<SearchResponse> {
  const res = await fetch(`${BASE_URL}/api/ncm/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 10, threshold: 0.3 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Evaluar
// ---------------------------------------------------------------------------

function matchesExpected(ncmCode: string, expectedNcm: string): boolean {
  const clean = ncmCode.replace(/\./g, "");
  const expected = expectedNcm.replace(/\./g, "");
  return clean.startsWith(expected);
}

function matchesChapter(ncmCode: string, expectedChapter: string): boolean {
  const chapter = ncmCode.replace(/\./g, "").substring(0, 2);
  return chapter === expectedChapter.padStart(2, "0");
}

async function main() {
  console.log("🧪 Evaluación de calidad de búsqueda NCM");
  console.log("=".repeat(80));
  console.log(`   ${TEST_CASES.length} casos de prueba\n`);

  let exactHits = 0;       // NCM exacto en resultados
  let chapterHits = 0;     // Al menos capítulo correcto
  let misses = 0;          // Ni capítulo correcto
  let totalResults = 0;

  const sourceStats: Record<string, { total: number; correct: number }> = {};
  const categoryStats: Record<string, { total: number; exact: number; chapter: number; miss: number }> = {};
  const expansionStats = { helped: 0, neutral: 0, hurt: 0 };

  const failures: Array<{
    query: string;
    expected: string;
    got: string;
    expanded: string;
    topResults: string[];
  }> = [];

  for (const test of TEST_CASES) {
    try {
      const data = await search(test.query);
      const results = data.results || [];
      totalResults += results.length;

      // Inicializar categoría
      if (!categoryStats[test.category]) {
        categoryStats[test.category] = { total: 0, exact: 0, chapter: 0, miss: 0 };
      }
      categoryStats[test.category].total++;

      // Buscar el NCM esperado en los resultados
      const exactMatch = results.findIndex((r) => matchesExpected(r.ncm_code, test.expected_ncm));
      const chapterMatch = results.findIndex((r) => matchesChapter(r.ncm_code, test.expected_chapter));

      // Estadísticas por fuente
      for (const r of results) {
        if (!sourceStats[r.match_type]) sourceStats[r.match_type] = { total: 0, correct: 0 };
        sourceStats[r.match_type].total++;
        if (matchesChapter(r.ncm_code, test.expected_chapter)) {
          sourceStats[r.match_type].correct++;
        }
      }

      // Evaluar resultado
      let status: string;
      if (exactMatch >= 0) {
        exactHits++;
        categoryStats[test.category].exact++;
        status = `✅ NCM exacto en pos ${exactMatch + 1} [${results[exactMatch].match_type}]`;
      } else if (chapterMatch >= 0) {
        chapterHits++;
        categoryStats[test.category].chapter++;
        status = `🟡 Cap. correcto en pos ${chapterMatch + 1} (${results[chapterMatch].ncm_code}) [${results[chapterMatch].match_type}]`;
      } else {
        misses++;
        categoryStats[test.category].miss++;
        status = `❌ MISS`;
        failures.push({
          query: test.query,
          expected: `${test.expected_ncm} (cap ${test.expected_chapter})`,
          got: results.length > 0 ? `${results[0].ncm_code} (cap ${results[0].ncm_code.substring(0, 2)})` : "sin resultados",
          expanded: data.expanded_query || "",
          topResults: results.slice(0, 3).map((r) => `${r.ncm_code} ${r.match_type} ${(r.similarity * 100).toFixed(0)}% "${r.description.substring(0, 50)}"`),
        });
      }

      // Evaluar si la expansion ayudó
      // Si el primer resultado correcto vino de semántica, la expansion fue necesaria
      // Si vino de fulltext/trigram, no fue necesaria
      const firstCorrectIdx = exactMatch >= 0 ? exactMatch : chapterMatch;
      if (firstCorrectIdx >= 0) {
        const source = results[firstCorrectIdx].match_type;
        if (source === "semantic" || source === "classifier") expansionStats.helped++;
        else expansionStats.neutral++;
      } else {
        // Si no encontró nada, la expansion no ayudó
        if (data.expanded_query && data.expanded_query !== test.query) {
          expansionStats.hurt++;
        }
      }

      const expandedInfo = data.expanded_query ? ` → "${data.expanded_query}"` : "";
      const sourcesInfo = data.sources
        ? ` [cat:${data.sources.catalog || 0} ft:${data.sources.fulltext || 0} tri:${data.sources.trigram || 0} sem:${data.sources.semantic || 0} cls:${data.sources.classifier || 0}]`
        : "";

      console.log(`${status}`);
      console.log(`   Query: "${test.query}"${expandedInfo}`);
      console.log(`   Esperado: ${test.expected_ncm}${sourcesInfo}\n`);

    } catch (err) {
      console.log(`❌ ERROR: "${test.query}" → ${(err as Error).message}\n`);
      misses++;
    }
  }

  // ---------------------------------------------------------------------------
  // Resumen
  // ---------------------------------------------------------------------------

  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMEN");
  console.log("=".repeat(80));

  const total = TEST_CASES.length;
  console.log(`\n📈 Precisión general:`);
  console.log(`   NCM exacto:        ${exactHits}/${total} (${((exactHits / total) * 100).toFixed(0)}%)`);
  console.log(`   Capítulo correcto:  ${chapterHits}/${total} (${((chapterHits / total) * 100).toFixed(0)}%)`);
  console.log(`   Miss total:         ${misses}/${total} (${((misses / total) * 100).toFixed(0)}%)`);
  console.log(`   → Acierto total:    ${exactHits + chapterHits}/${total} (${(((exactHits + chapterHits) / total) * 100).toFixed(0)}%)`);

  console.log(`\n📦 Por categoría:`);
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const accuracy = ((stats.exact + stats.chapter) / stats.total * 100).toFixed(0);
    console.log(`   ${cat.padEnd(15)} ${accuracy}% (${stats.exact} exactos, ${stats.chapter} cap., ${stats.miss} miss de ${stats.total})`);
  }

  console.log(`\n🔍 Por fuente de búsqueda:`);
  for (const [source, stats] of Object.entries(sourceStats)) {
    const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : "N/A";
    console.log(`   ${source.padEnd(12)} ${stats.total} resultados, ${stats.correct} correctos (${accuracy}%)`);
  }

  console.log(`\n🧠 Query expansion (Claude Haiku):`);
  console.log(`   Ayudó (semántica fue la que encontró): ${expansionStats.helped}`);
  console.log(`   Neutral (otra capa encontró primero):  ${expansionStats.neutral}`);
  console.log(`   No ayudó (miss total):                 ${expansionStats.hurt}`);

  if (failures.length > 0) {
    console.log(`\n❌ Fallos detallados:`);
    for (const f of failures) {
      console.log(`\n   Query: "${f.query}"`);
      console.log(`   Esperado: ${f.expected}`);
      console.log(`   Obtuvo: ${f.got}`);
      if (f.expanded) console.log(`   Expansion: "${f.expanded}"`);
      console.log(`   Top 3:`);
      for (const r of f.topResults) {
        console.log(`     - ${r}`);
      }
    }
  }

  console.log(`\n${"=".repeat(80)}`);
}

main().catch(console.error);
