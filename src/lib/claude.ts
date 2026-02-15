// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument } from "pdf-lib";
import type { ExtractionResult, ExtractedItem } from "./types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT_TEXT = `Sos un experto en comercio exterior y despacho aduanero.
Extraé TODOS los ítems de este fragmento de factura comercial.

Para cada ítem devolvé:
- line_number (empezando en {START_LINE})
- sku (código/referencia del producto, null si no tiene)
- original_description (exacta como aparece)
- suggested_customs_description (simplificada para aduana)
- suggested_ncm_code (código NCM si podés inferirlo, sino null)
- quantity, unit_of_measure, unit_price, total_price
- currency (USD, EUR, CNY, etc.)
- country_of_origin (si se menciona, sino null)

REGLAS:
- Extraé TODOS los ítems, no omitas ninguno
- Precios numéricos sin símbolos de moneda
- Si un campo no existe, usá null
- Respondé ÚNICAMENTE con un JSON array, sin markdown: [{ ... }, { ... }]`;

const HEADER_PROMPT = `Extraé SOLO la información general de esta factura (NO los ítems):
- provider_name: nombre del proveedor/exportador
- invoice_number: número de factura
- invoice_date: fecha
- currency: moneda principal

Respondé ÚNICAMENTE con JSON: {"provider_name":"...","invoice_number":"...","invoice_date":"...","currency":"..."}`;

const EXTRACTION_PROMPT_VISION = EXTRACTION_PROMPT_TEXT;

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
type MediaType = ImageMediaType | "application/pdf";

interface PageContent {
  pageNumber: number;
  text: string | null; // null = no se pudo extraer texto (escaneado)
  imageBase64: string | null; // base64 de la página como imagen (para Vision)
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Intenta parsear JSON, con recuperación de truncamiento
 */
function safeParseJson(jsonStr: string): any | null {
  let cleaned = jsonStr.trim();

  // Remover markdown wrappers
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Intento directo
  try {
    return JSON.parse(cleaned);
  } catch {
    // Intentar reparar
  }

  // Reparación de JSON truncado
  let attempt = cleaned;

  // Cerrar strings abiertos
  const quoteCount = (attempt.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) attempt += '"';

  // Cerrar key sin value
  if (attempt.match(/:\s*$/)) attempt += "null";

  // Contar y cerrar brackets/braces
  let braces = 0, brackets = 0, inString = false;
  for (let i = 0; i < attempt.length; i++) {
    const ch = attempt[i];
    if (ch === '"' && (i === 0 || attempt[i - 1] !== "\\")) { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") braces++;
      else if (ch === "}") braces--;
      else if (ch === "[") brackets++;
      else if (ch === "]") brackets--;
    }
  }

  attempt = attempt.replace(/,\s*$/, "");
  while (brackets > 0) { attempt += "]"; brackets--; }
  while (braces > 0) { attempt += "}"; braces--; }

  try {
    return JSON.parse(attempt);
  } catch {
    return null;
  }
}

/**
 * Llama a Haiku con texto plano para extraer ítems de una página
 */
async function extractItemsFromText(
  text: string,
  startLine: number
): Promise<ExtractedItem[]> {
  const prompt = EXTRACTION_PROMPT_TEXT.replace("{START_LINE}", String(startLine));

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `${prompt}\n\n--- TEXTO DE LA FACTURA ---\n${text}`,
      },
    ],
  });

  const textContent = response.content.find((c: any) => c.type === "text");
  if (!textContent || textContent.type !== "text") return [];

  const parsed = safeParseJson(textContent.text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.items && Array.isArray(parsed.items)) return parsed.items;
  return [];
}

/**
 * Llama a Haiku/Sonnet con Vision para una página escaneada
 */
async function extractItemsFromImage(
  imageBase64: string,
  mediaType: MediaType,
  startLine: number
): Promise<ExtractedItem[]> {
  const prompt = EXTRACTION_PROMPT_VISION.replace("{START_LINE}", String(startLine));
  const isPdf = mediaType === "application/pdf";

  const fileContent = isPdf
    ? {
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: imageBase64 },
      }
    : {
        type: "image" as const,
        source: { type: "base64" as const, media_type: mediaType as ImageMediaType, data: imageBase64 },
      };

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [fileContent, { type: "text", text: prompt }],
      },
    ],
  });

  const textContent = response.content.find((c: any) => c.type === "text");
  if (!textContent || textContent.type !== "text") return [];

  const parsed = safeParseJson(textContent.text);
  if (Array.isArray(parsed)) return parsed;
  if (parsed?.items && Array.isArray(parsed.items)) return parsed.items;
  return [];
}

/**
 * Extrae header info (proveedor, número, fecha) de la primera página
 */
async function extractHeader(
  content: string | { base64: string; mediaType: MediaType }
): Promise<{ provider_name: string | null; invoice_number: string | null; invoice_date: string | null; currency: string }> {
  const defaultHeader = { provider_name: null, invoice_number: null, invoice_date: null, currency: "USD" };

  try {
    let messages: any[];

    if (typeof content === "string") {
      messages = [{ role: "user", content: `${HEADER_PROMPT}\n\n--- FACTURA ---\n${content}` }];
    } else {
      const isPdf = content.mediaType === "application/pdf";
      const fileContent = isPdf
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: content.base64 } }
        : { type: "image", source: { type: "base64", media_type: content.mediaType, data: content.base64 } };

      messages = [{ role: "user", content: [fileContent, { type: "text", text: HEADER_PROMPT }] }];
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages,
    });

    const textContent = response.content.find((c: any) => c.type === "text");
    if (!textContent || textContent.type !== "text") return defaultHeader;

    const parsed = safeParseJson(textContent.text);
    return parsed || defaultHeader;
  } catch (err) {
    console.error("Error extracting header:", err);
    return defaultHeader;
  }
}

// ---------------------------------------------------------------------------
// Función principal: procesa PDF por páginas en paralelo
// ---------------------------------------------------------------------------

/**
 * Divide un PDF en páginas individuales usando pdf-lib (puro JS, sin workers).
 * Devuelve cada página como un PDF base64 independiente.
 */
async function splitPdfPages(
  pdfBuffer: Buffer
): Promise<string[]> {
  try {
    const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();

    if (totalPages <= 1) {
      // Una sola página: devolver el PDF original en base64
      return [pdfBuffer.toString("base64")];
    }

    console.log(`Dividiendo PDF en ${totalPages} páginas...`);

    // Crear un PDF por cada página
    const pagePromises = Array.from({ length: totalPages }, async (_, i) => {
      const singlePageDoc = await PDFDocument.create();
      const [copiedPage] = await singlePageDoc.copyPages(srcDoc, [i]);
      singlePageDoc.addPage(copiedPage);
      const pdfBytes = await singlePageDoc.save();
      return Buffer.from(pdfBytes).toString("base64");
    });

    return Promise.all(pagePromises);
  } catch (err) {
    console.error("pdf-lib split error:", err);
    return [];
  }
}

/**
 * Espera N milisegundos.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Procesa un array de tareas en lotes con pausa entre ellos.
 * Esto evita reventar el rate limit de la API.
 */
async function processInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number,
  delayMs: number
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);

    // Pausa entre lotes (no después del último)
    if (i + batchSize < tasks.length) {
      console.log(`  Lote ${Math.floor(i / batchSize) + 1} completado. Esperando ${delayMs / 1000}s antes del siguiente...`);
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * Punto de entrada principal.
 * Estrategia:
 *   1. Si es PDF multi-página → splitear con pdf-lib → mandar cada página a Haiku Vision en lotes de 2
 *   2. Si es PDF de 1 página → una sola llamada a Haiku Vision
 *   3. Si es imagen → una sola llamada a Haiku Vision
 *   4. Header se extrae con la primera página del primer lote
 */
export async function extractInvoiceData(
  fileBase64: string,
  mediaType: MediaType,
  pdfBuffer?: Buffer | null
): Promise<ExtractionResult> {
  const isPdf = mediaType === "application/pdf";

  // --- CASO 1: Imagen suelta ---
  if (!isPdf) {
    const [header, items] = await Promise.all([
      extractHeader({ base64: fileBase64, mediaType }),
      extractItemsFromImage(fileBase64, mediaType, 1),
    ]);
    return { ...header, items };
  }

  // --- CASO 2: PDF ---
  const pageCount = pdfBuffer
    ? (await PDFDocument.load(pdfBuffer, { ignoreEncryption: true })).getPageCount()
    : 1;

  // Detectar si el PDF está encriptado
  let isEncrypted = false;
  if (pdfBuffer) {
    try {
      await PDFDocument.load(pdfBuffer);
    } catch {
      isEncrypted = true;
    }
  }

  console.log(`PDF de ${pageCount} página(s).${isEncrypted ? " [ENCRIPTADO]" : ""}`);

  // PDFs cortos (≤5 páginas) o encriptados: enviar completo a Claude.
  // Los PDFs encriptados no se pueden splitear (las páginas quedan en blanco).
  if (pageCount <= 5 || isEncrypted) {
    const reason = isEncrypted ? "encriptado" : `≤5 páginas`;
    console.log(`  Procesando PDF completo (${reason}, ${pageCount} páginas) en una sola llamada...`);
    const [header, items] = await Promise.all([
      extractHeader({ base64: fileBase64, mediaType: "application/pdf" }),
      extractItemsFromImage(fileBase64, "application/pdf", 1),
    ]);
    console.log(`Extracción completada: ${items.length} ítems${isEncrypted ? " (flujo PDF encriptado)" : ""}`);
    return { ...header, items: items.map((item, i) => ({ ...item, line_number: i + 1 })) };
  }

  // PDFs largos (>5 páginas): splitear por página con pausa entre cada una
  const pageBase64s = pdfBuffer
    ? await splitPdfPages(pdfBuffer)
    : [fileBase64];

  // Extraer header de la primera página
  const header = await extractHeader({
    base64: pageBase64s[0],
    mediaType: "application/pdf",
  });

  const DELAY_BETWEEN_PAGES_MS = 30_000;
  const pageResults: ExtractedItem[][] = [];

  for (let i = 0; i < pageBase64s.length; i++) {
    console.log(`  Procesando página ${i + 1} de ${pageBase64s.length}...`);
    const items = await extractItemsFromImage(
      pageBase64s[i],
      "application/pdf",
      i * 100 + 1
    );
    pageResults.push(items);
    console.log(`  Página ${i + 1}: ${items.length} ítems extraídos.`);

    if (i < pageBase64s.length - 1) {
      console.log(`  Esperando ${DELAY_BETWEEN_PAGES_MS / 1000}s antes de la siguiente página...`);
      await sleep(DELAY_BETWEEN_PAGES_MS);
    }
  }

  // Combinar y renumerar ítems secuencialmente
  const allItems: ExtractedItem[] = [];
  for (const pageItems of pageResults) {
    for (const item of pageItems) {
      allItems.push({ ...item, line_number: allItems.length + 1 });
    }
  }

  console.log(`Extracción completada: ${allItems.length} ítems de ${pageBase64s.length} páginas`);
  return { ...header, items: allItems };
}
