/**
 * Script de diagnóstico para PDFs problemáticos.
 * Verifica: encriptación, split de páginas, extracción con Claude.
 * Incluye simulación del flujo propuesto: encriptado → completo, sino → split.
 *
 * Uso: npx tsx scripts/debug-pdf.ts <path-al-pdf>
 */
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import * as fs from "fs";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const EXTRACTION_PROMPT = `Sos un experto en comercio exterior y despacho aduanero.
Extraé TODOS los ítems de este fragmento de factura comercial.

Para cada ítem devolvé:
- line_number, sku, original_description, suggested_customs_description
- suggested_ncm_code, quantity, unit_of_measure, unit_price, total_price
- currency, country_of_origin

Respondé ÚNICAMENTE con un JSON array: [{ ... }]`;

interface ExtractResult {
  items: any[];
  inputTokens: number;
  outputTokens: number;
}

async function extractFromPdf(base64: string): Promise<ExtractResult> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const text = response.content.find((c) => c.type === "text");
  const raw = text?.type === "text" ? text.text : "";

  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    const items = Array.isArray(parsed) ? parsed : parsed?.items || [];
    return { items, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  } catch {
    console.log(`    Parse falló. Respuesta (200 chars): ${cleaned.substring(0, 200)}`);
    return { items: [], inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
  }
}

async function main() {
  const filePath =
    process.argv[2] ||
    "/Users/diegomoraes/Documents/aduanafiles/aduanafiles/04_facturas_comerciales/DT_IMPORTACIONES/Cia_El_Coati/00010-00000083.pdf";

  if (!fs.existsSync(filePath)) {
    console.error(`Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const name = path.basename(filePath);

  console.log(`\n${"=".repeat(70)}`);
  console.log(`DIAGNÓSTICO: ${name}`);
  console.log(`Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
  console.log(`${"=".repeat(70)}`);

  // 1. Detectar encriptación
  console.log(`\n--- TEST 1: Detectar encriptación ---`);
  let isEncrypted = false;
  try {
    const doc = await PDFDocument.load(buffer);
    console.log(`✅ NO encriptado — ${doc.getPageCount()} páginas`);
  } catch {
    isEncrypted = true;
    console.log(`🔒 PDF ENCRIPTADO`);
  }

  // 2. Contar páginas
  let pageCount = 0;
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
    console.log(`   Páginas: ${pageCount}`);
  } catch (err: any) {
    console.log(`   No se pudo cargar ni con ignoreEncryption: ${err.message}`);
  }

  // 3. Split de páginas (solo si no encriptado)
  const splitPages: string[] = [];
  if (!isEncrypted && pageCount > 0) {
    console.log(`\n--- TEST 2: Split de páginas ---`);
    try {
      const srcDoc = await PDFDocument.load(buffer);
      for (let i = 0; i < Math.min(pageCount, 3); i++) {
        const singleDoc = await PDFDocument.create();
        const [copied] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(copied);
        const bytes = await singleDoc.save();
        splitPages.push(Buffer.from(bytes).toString("base64"));
        console.log(`  Página ${i + 1}: ${(bytes.length / 1024).toFixed(1)} KB`);
      }
      console.log(`✅ Split OK`);
    } catch (err: any) {
      console.log(`❌ Split FALLO — ${err.message}`);
    }
  } else if (isEncrypted) {
    console.log(`\n--- TEST 2: Split de páginas ---`);
    console.log(`⏭️  SKIP — PDF encriptado, split produce páginas en blanco`);
  }

  // 4. Simulación del flujo propuesto
  console.log(`\n${"=".repeat(70)}`);
  console.log(`SIMULACIÓN DEL FLUJO PROPUESTO`);
  console.log(`${"=".repeat(70)}`);

  if (isEncrypted) {
    // Encriptado → mandar completo
    console.log(`\n🔒 Encriptado → enviando PDF completo a Claude...`);
    try {
      const result = await extractFromPdf(base64);
      console.log(`   Tokens: input=${result.inputTokens}, output=${result.outputTokens}`);
      console.log(`   ✅ ${result.items.length} ítems extraídos`);
      for (const item of result.items.slice(0, 5)) {
        console.log(`   - [${item.sku || "sin-sku"}] ${(item.original_description || "").substring(0, 60)}`);
      }
      if (result.items.length > 5) console.log(`   ... y ${result.items.length - 5} más`);
    } catch (err: any) {
      console.log(`   ❌ API error: ${err.message}`);
    }
  } else if (pageCount <= 5) {
    // No encriptado, corto → mandar completo
    console.log(`\n📄 No encriptado, ≤5 páginas → enviando PDF completo a Claude...`);
    try {
      const result = await extractFromPdf(base64);
      console.log(`   Tokens: input=${result.inputTokens}, output=${result.outputTokens}`);
      console.log(`   ✅ ${result.items.length} ítems extraídos`);
      for (const item of result.items.slice(0, 5)) {
        console.log(`   - [${item.sku || "sin-sku"}] ${(item.original_description || "").substring(0, 60)}`);
      }
      if (result.items.length > 5) console.log(`   ... y ${result.items.length - 5} más`);
    } catch (err: any) {
      console.log(`   ❌ API error: ${err.message}`);
    }
  } else {
    // No encriptado, largo → split por página
    console.log(`\n📑 No encriptado, ${pageCount} páginas → split por página...`);
    let totalItems = 0;
    const maxTestPages = Math.min(splitPages.length, 3);
    for (let i = 0; i < maxTestPages; i++) {
      console.log(`\n   Página ${i + 1}:`);
      try {
        const result = await extractFromPdf(splitPages[i]);
        console.log(`   Tokens: input=${result.inputTokens}, output=${result.outputTokens}`);
        console.log(`   ✅ ${result.items.length} ítems`);
        totalItems += result.items.length;
        for (const item of result.items.slice(0, 3)) {
          console.log(`   - [${item.sku || "sin-sku"}] ${(item.original_description || "").substring(0, 60)}`);
        }
      } catch (err: any) {
        console.log(`   ❌ API error: ${err.message}`);
      }
      if (i < maxTestPages - 1) {
        console.log(`   Esperando 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    console.log(`\n   Total de las ${maxTestPages} páginas testeadas: ${totalItems} ítems`);
    if (pageCount > maxTestPages) {
      console.log(`   (${pageCount - maxTestPages} páginas restantes no testeadas)`);
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`RESULTADO: ${isEncrypted ? "PDF encriptado → usar flujo completo" : pageCount <= 5 ? "PDF corto → usar flujo completo" : "PDF largo no encriptado → usar split"}`);
  console.log(`${"=".repeat(70)}\n`);
}

main().catch(console.error);
