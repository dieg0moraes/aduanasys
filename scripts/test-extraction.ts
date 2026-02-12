/**
 * Script de diagnóstico: prueba la extracción de Claude Vision
 * con dos facturas de formatos distintos.
 *
 * Uso: npx tsx scripts/test-extraction.ts
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
- line_number (empezando en 1)
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

async function testPdf(filePath: string) {
  const name = filePath.split("/").pop()!;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`PROBANDO: ${name}`);
  console.log(`${"=".repeat(70)}`);

  // 1. Leer archivo
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  console.log(`Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);

  // 2. Verificar pdf-lib
  try {
    const doc = await PDFDocument.load(buffer);
    console.log(`pdf-lib: OK (${doc.getPageCount()} páginas)`);
  } catch (err: any) {
    console.log(`pdf-lib: FALLO - ${err.message}`);
  }

  // 3. Llamar a Claude Vision
  console.log(`\nLlamando a Claude Vision...`);
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    // 4. Mostrar respuesta cruda
    const textContent = response.content.find((c) => c.type === "text");
    const rawText = textContent?.type === "text" ? textContent.text : "(sin texto)";

    console.log(`\nStop reason: ${response.stop_reason}`);
    console.log(`Tokens usados: input=${response.usage.input_tokens}, output=${response.usage.output_tokens}`);
    console.log(`\n--- RESPUESTA CRUDA DE CLAUDE ---`);
    console.log(rawText);
    console.log(`--- FIN RESPUESTA ---`);

    // 5. Intentar parsear
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    try {
      const parsed = JSON.parse(cleaned);
      const items = Array.isArray(parsed) ? parsed : parsed?.items || [];
      console.log(`\nParseado OK: ${items.length} ítems extraídos`);
      for (const item of items) {
        console.log(`  - [${item.sku || "sin-sku"}] ${item.original_description?.substring(0, 60)} | qty=${item.quantity} | $${item.total_price}`);
      }
    } catch (parseErr: any) {
      console.log(`\nPARSE FALLÓ: ${parseErr.message}`);
      console.log(`Primeros 200 chars: ${cleaned.substring(0, 200)}`);
    }
  } catch (apiErr: any) {
    console.log(`\nAPI ERROR: ${apiErr.message}`);
    if (apiErr.status) console.log(`Status: ${apiErr.status}`);
    if (apiErr.error) console.log(`Detail: ${JSON.stringify(apiErr.error)}`);
  }
}

async function main() {
  const files = [
    // Factura que funciona (Fushiyuan → DT IMPORTACIONES)
    "/Volumes/Extreme SSD/aduanafiles/04_facturas_comerciales/DT_IMPORTACIONES/Fushiyuan_Plastic/JC24-064.pdf",
    // Factura que falla (Cookies Industries → ALGORTA)
    "/Volumes/Extreme SSD/aduanafiles/04_facturas_comerciales/ALGORTA/Cookies_Industries/001-016-0000395.pdf",
  ];

  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.log(`ARCHIVO NO ENCONTRADO: ${f}`);
      continue;
    }
    await testPdf(f);
    // Pequeña pausa entre llamadas
    await new Promise((r) => setTimeout(r, 5000));
  }
}

main().catch(console.error);
