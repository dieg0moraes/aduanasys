// @ts-nocheck
/**
 * Script de ingesta del nomenclador NCM a Supabase.
 *
 * 1. Lee el CSV generado por el extractor Python
 * 2. Genera embeddings con OpenAI text-embedding-3-small (1536d)
 * 3. Inserta todo en la tabla ncm_nomenclator de Supabase
 *
 * Uso:
 *   npx tsx scripts/ingest-ncm.ts          # solo inserta faltantes
 *   npx tsx scripts/ingest-ncm.ts --force  # re-ingesta completa
 *
 * Prerequisitos:
 *   - Ejecutar supabase/update-vector-1536.sql en Supabase
 *   - El CSV ya debe existir en data/ncm_nomenclator.csv
 *   - OPENAI_API_KEY en .env.local
 *
 * Costo estimado: ~10,433 entries × ~20 tokens/entry = ~208k tokens
 *   → $0.02 / 1M tokens × 0.208M = ~$0.004 (prácticamente gratis)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
import OpenAI from "openai";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const CSV_PATH = "data/ncm_nomenclator.csv";
const EMBEDDING_BATCH_SIZE = 100; // Bajo para respetar TPM limit de free tier (40k TPM)
const DB_BATCH_SIZE = 200;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

interface NcmEntry {
  ncm_code: string;
  description: string;
  full_description: string;
  chapter: string;
  aec: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCSV(path: string): NcmEntry[] {
  const content = readFileSync(path, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  const header = lines[0].split(",");

  const idx = {
    ncm_code: header.indexOf("ncm_code"),
    description: header.indexOf("description"),
    full_description: header.indexOf("full_description"),
    chapter: header.indexOf("chapter"),
    aec: header.indexOf("aec"),
  };

  const entries: NcmEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 5) continue;
    entries.push({
      ncm_code: fields[idx.ncm_code]?.trim() || "",
      description: fields[idx.description]?.trim() || "",
      full_description: fields[idx.full_description]?.trim() || "",
      chapter: fields[idx.chapter]?.trim() || "",
      aec: fields[idx.aec]?.trim() || "",
    });
  }
  return entries.filter((e) => e.ncm_code && e.full_description);
}

// ---------------------------------------------------------------------------
// Embeddings con OpenAI (batch nativo — mucho más rápido)
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / EMBEDDING_BATCH_SIZE);

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    // Retry con backoff si nos pega el rate limit
    let retries = 0;
    while (true) {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch,
        });

        for (const item of response.data) {
          allEmbeddings.push(item.embedding);
        }

        console.log(`   Batch ${batchNum}/${totalBatches} (${allEmbeddings.length}/${texts.length} embeddings)`);
        break;
      } catch (err: any) {
        if (err?.status === 429 && retries < 5) {
          retries++;
          const waitSec = Math.min(retries * 15, 65); // 15s, 30s, 45s, 60s, 65s
          console.log(`   ⏳ Rate limit — esperando ${waitSec}s (intento ${retries}/5)...`);
          await sleep(waitSec * 1000);
        } else {
          throw err;
        }
      }
    }

    // Pequeña pausa entre batches para no saturar TPM
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await sleep(2000);
    }
  }

  return allEmbeddings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Verificar API key
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY no está configurada en .env.local");
    process.exit(1);
  }

  // 1. Leer CSV
  console.log("📖 Leyendo CSV...");
  const entries = parseCSV(CSV_PATH);
  console.log(`   ${entries.length} entradas NCM`);

  // 2. Modo de operación: --force para re-ingesta completa
  const forceMode = process.argv.includes("--force");

  if (forceMode) {
    console.log("\n🗑️  Modo --force: limpiando tabla ncm_nomenclator...");
    const { error: delErr } = await supabase
      .from("ncm_nomenclator")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) console.warn("   Aviso:", delErr.message);
    console.log("   Tabla limpiada");
  }

  // 3. Consultar qué NCM ya existen en la base
  console.log("\n🔍 Consultando entradas existentes...");
  const { data: existing } = await supabase
    .from("ncm_nomenclator")
    .select("ncm_code");
  const existingCodes = new Set((existing || []).map((e: any) => e.ncm_code));
  console.log(`   ${existingCodes.size} entradas ya existen en la base`);

  // 4. Filtrar solo las que faltan
  const missing = forceMode ? entries : entries.filter((e) => !existingCodes.has(e.ncm_code));
  if (missing.length === 0) {
    console.log("\n✅ Todas las entradas ya están en la base. Nada que hacer.");
    return;
  }
  console.log(`   ${missing.length} entradas a procesar`);

  // 5. Generar embeddings en batches grandes (OpenAI batch nativo)
  console.log(`\n🧠 Generando embeddings con OpenAI text-embedding-3-small...`);
  console.log(`   (${missing.length} textos en batches de ${EMBEDDING_BATCH_SIZE})`);
  const embStartTime = Date.now();

  const texts = missing.map((e) => e.full_description);
  const embeddings = await generateBatchEmbeddings(texts);

  const embTime = ((Date.now() - embStartTime) / 1000).toFixed(1);
  console.log(`   ✅ ${embeddings.length} embeddings generados en ${embTime}s`);

  // Costo estimado
  const estimatedTokens = texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0);
  const estimatedCost = (estimatedTokens / 1_000_000) * 0.02;
  console.log(`   💰 Costo estimado: ~$${estimatedCost.toFixed(4)} (${estimatedTokens.toLocaleString()} tokens)`);

  // 6. Insertar en Supabase en batches
  console.log(`\n📦 Insertando en Supabase (batches de ${DB_BATCH_SIZE})...`);
  const dbStartTime = Date.now();
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < missing.length; i += DB_BATCH_SIZE) {
    const batchEntries = missing.slice(i, i + DB_BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + DB_BATCH_SIZE);

    const rows = batchEntries.map((entry, j) => ({
      ncm_code: entry.ncm_code,
      description: entry.full_description,
      section: "",
      chapter: entry.chapter,
      notes: entry.aec ? `AEC: ${entry.aec}` : null,
      embedding: batchEmbeddings[j],
    }));

    const { error: insertErr } = await supabase
      .from("ncm_nomenclator")
      .upsert(rows, { onConflict: "ncm_code" });

    if (insertErr) {
      console.error(`   ❌ Error batch ${i}:`, insertErr.message);
      errors += rows.length;
    } else {
      inserted += rows.length;
    }

    // Progress
    const processed = Math.min(i + DB_BATCH_SIZE, missing.length);
    if (processed % 1000 === 0 || processed === missing.length) {
      const elapsed = ((Date.now() - dbStartTime) / 1000).toFixed(0);
      console.log(
        `   ${processed}/${missing.length} (${elapsed}s transcurridos, ${inserted} insertados)`
      );
    }
  }

  const totalTime = ((Date.now() - embStartTime) / 1000).toFixed(1);
  console.log(`\n✅ Ingesta completada en ${totalTime}s:`);
  console.log(`   ${inserted} entradas insertadas`);
  console.log(`   ${errors} errores`);
  console.log(`   💰 Costo: ~$${estimatedCost.toFixed(4)}`);
}

main().catch(console.error);
