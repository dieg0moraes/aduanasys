import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase-server";
import { extractInvoiceData } from "@/lib/claude";
import { getClaudeMediaType } from "@/lib/utils";
import { classifyInvoiceItems } from "@/lib/ncm-search";
import type { InvoiceItemInput } from "@/lib/ncm-search";

// Timeout máximo de la función (en segundos).
// Hobby: máx 60s, Pro: máx 300s. Vercel lo capea al límite del plan.
export const maxDuration = 300;

/**
 * Parsea fecha extraída por Claude a formato ISO (YYYY-MM-DD).
 * Soporta: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY.
 */
function parseInvoiceDate(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Ya es ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY o DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const day = d.padStart(2, "0");
    const month = m.padStart(2, "0");
    // Si el primer número es > 12, es seguro que es día (DD/MM/YYYY)
    if (parseInt(d) > 12) return `${y}-${month}-${day}`;
    // Si el segundo número es > 12, es MM/DD/YYYY
    if (parseInt(m) > 12) return `${y}-${day}-${month}`;
    // Ambiguo: asumir DD/MM/YYYY (formato latinoamericano)
    return `${y}-${month}-${day}`;
  }

  // Intentar parsear como Date nativo
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

/**
 * Procesamiento en background.
 * La función no se await-ea: se lanza y el endpoint responde inmediatamente.
 * Usa createServiceClient() porque cookies() no está disponible fuera del request.
 */
async function processInvoiceInBackground(id: string) {
  const supabase = createServiceClient();

  try {
    // 1. Obtener la factura
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Factura no encontrada");
    }

    // 2. Descargar el archivo desde Storage
    const fileName = invoice.file_url.split("/").pop();
    if (!fileName) {
      throw new Error("No se pudo obtener el nombre del archivo");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("invoices")
      .download(fileName);

    if (downloadError || !fileData) {
      throw new Error(
        "Error al descargar archivo: " + (downloadError?.message || "Unknown")
      );
    }

    // 3. Preparar archivo para extracción
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");

    // Determinar media type
    let mimeType = "application/pdf";
    const ext = invoice.file_name.toLowerCase().split(".").pop();
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "png") mimeType = "image/png";
    else if (ext === "webp") mimeType = "image/webp";

    const mediaType = getClaudeMediaType(mimeType);
    const isPdf = mediaType === "application/pdf";

    // 4. Extraer datos: pasar el buffer del PDF para extracción de texto
    const extraction = await extractInvoiceData(
      base64,
      mediaType,
      isPdf ? buffer : null
    );

    // 5. Buscar o crear proveedor
    let providerId: string | null = null;
    let providerCountry: string | null = null;
    if (extraction.provider_name) {
      const { data: existingProvider } = await supabase
        .from("providers")
        .select("id, country")
        .ilike("name", extraction.provider_name)
        .limit(1)
        .single();

      if (existingProvider) {
        providerId = existingProvider.id;
        providerCountry = existingProvider.country || null;
      } else {
        const { data: newProvider } = await supabase
          .from("providers")
          .insert({
            name: extraction.provider_name,
            country: null,
            metadata: {},
          })
          .select("id")
          .single();

        if (newProvider) {
          providerId = newProvider.id;
        }
      }
    }

    // 7. Clasificar NCM en batch (catálogo → expansion → embeddings → búsqueda)
    const classificationInputs: InvoiceItemInput[] = extraction.items.map(
      (item, i) => ({
        index: i,
        sku: item.sku,
        original_description: item.original_description,
        suggested_customs_description: item.suggested_customs_description,
        suggested_ncm_code: item.suggested_ncm_code,
      })
    );

    const classifications = await classifyInvoiceItems(
      supabase,
      classificationInputs,
      providerId
    );

    const itemsToInsert = extraction.items.map((item, i) => ({
      invoice_id: id,
      line_number: item.line_number,
      sku: item.sku,
      original_description: item.original_description,
      customs_description:
        classifications[i].customs_description ||
        item.suggested_customs_description,
      ncm_code: classifications[i].ncm_code,
      quantity: item.quantity,
      unit_of_measure: item.unit_of_measure,
      unit_price: item.unit_price,
      total_price: item.total_price,
      currency: item.currency || extraction.currency || "USD",
      country_of_origin: item.country_of_origin || providerCountry,
      confidence_level: classifications[i].confidence_level,
      classification_source: classifications[i].classification_source,
      was_corrected: false,
      corrected_at: null,
      original_ncm_suggestion: item.suggested_ncm_code,
      metadata: {},
    }));

    // 9. Insertar ítems
    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemsToInsert);

    if (itemsError) {
      throw new Error("Error al guardar ítems: " + itemsError.message);
    }

    // 10. Actualizar factura como lista para revisión
    const exactMatches = itemsToInsert.filter(
      (i) => i.classification_source === "exact_match"
    ).length;
    const semanticMatches = itemsToInsert.filter(
      (i) => i.classification_source === "semantic"
    ).length;

    const { error: statusError } = await supabase
      .from("invoices")
      .update({
        status: "review",
        provider_id: providerId,
        total_items: itemsToInsert.length,
        items_auto_classified: exactMatches + semanticMatches,
        raw_extraction: extraction as unknown as Record<string, unknown>,
        processing_error: null,
        invoice_date: parseInvoiceDate(extraction.invoice_date) || null,
        invoice_number: extraction.invoice_number || null,
      })
      .eq("id", id);

    if (statusError) {
      console.error(`❌ Error actualizando factura ${id} a review:`, statusError);
    }

    console.log(
      `✅ Factura ${id} procesada: ${itemsToInsert.length} ítems (${exactMatches} catálogo, ${semanticMatches} semántica, ${itemsToInsert.length - exactMatches - semanticMatches} LLM)`
    );
  } catch (error) {
    console.error(`❌ Error procesando factura ${id}:`, error);

    const supabase = createServiceClient();
    await supabase
      .from("invoices")
      .update({
        status: "uploaded",
        processing_error:
          error instanceof Error ? error.message : "Error desconocido",
      })
      .eq("id", id);
  }
}

/**
 * POST /api/invoices/[id]/process
 * Lanza el procesamiento en background y responde inmediatamente.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar que la factura existe
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, status")
    .eq("id", id)
    .single();

  if (error || !invoice) {
    return NextResponse.json(
      { error: "Factura no encontrada" },
      { status: 404 }
    );
  }

  if (invoice.status === "processing") {
    return NextResponse.json(
      { error: "La factura ya está siendo procesada" },
      { status: 409 }
    );
  }

  // Marcar como procesando inmediatamente
  await supabase
    .from("invoices")
    .update({ status: "processing", processing_error: null })
    .eq("id", id);

  // Lanzar procesamiento en background con after() —
  // Vercel mantiene la función viva hasta que la promesa resuelva
  after(
    processInvoiceInBackground(id).catch((err) => {
      console.error("Background processing failed:", err);
    })
  );

  // Responder inmediatamente
  return NextResponse.json({ success: true, status: "processing" });
}
