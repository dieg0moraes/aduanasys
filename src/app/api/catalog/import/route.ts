import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { generateEmbeddings } from "@/lib/embeddings";

interface ImportItem {
  sku: string;
  provider_description: string;
  customs_description?: string;
  internal_description?: string;
  ncm_code?: string;
  country_of_origin?: string;
  apertura?: number;
  action: "create" | "update" | "skip";
}

interface ImportRequest {
  provider_id: string;
  items: ImportItem[];
}

/**
 * Genera embeddings para los items importados y actualiza el catálogo.
 * Se ejecuta fire-and-forget para no bloquear la respuesta.
 */
async function generateAndSaveEmbeddings(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  providerId: string,
  items: ImportItem[]
) {
  const relevantItems = items.filter((item) => item.action !== "skip");
  if (relevantItems.length === 0) return;

  const texts = relevantItems.map((item) => {
    const customs = item.customs_description?.trim() || item.provider_description;
    return `${item.sku} | ${item.provider_description} | ${customs} | NCM ${item.ncm_code || ""}`;
  });

  const embeddings = await generateEmbeddings(texts);

  // Update each product's embedding by provider_id + sku
  await Promise.all(
    relevantItems.map((item, index) =>
      supabase
        .from("product_catalog")
        .update({ embedding: JSON.stringify(embeddings[index]) })
        .eq("provider_id", providerId)
        .eq("sku", item.sku)
    )
  );
}

/**
 * POST /api/catalog/import
 *
 * Importación masiva de productos al catálogo.
 * Soporta acciones: create, update, skip por item.
 * Genera embeddings de forma asíncrona (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body: ImportRequest = await request.json();

    // Validar provider_id
    if (!body.provider_id) {
      return NextResponse.json(
        { error: "provider_id es obligatorio" },
        { status: 400 }
      );
    }

    // Validar que el proveedor existe
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("id", body.provider_id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Proveedor no encontrado" },
        { status: 404 }
      );
    }

    // Validar items
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items debe ser un array no vacío" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Separar items por acción
    const toCreate = body.items.filter((item) => item.action === "create");
    const toUpdate = body.items.filter((item) => item.action === "update");
    const toSkip = body.items.filter((item) => item.action === "skip");

    skipped = toSkip.length;

    // --- CREATE: intentar batch insert, fallback a uno por uno ---
    if (toCreate.length > 0) {
      const insertRows = toCreate.map((item) => ({
        provider_id: body.provider_id,
        sku: item.sku,
        provider_description: item.provider_description,
        customs_description:
          item.customs_description?.trim() || item.provider_description,
        internal_description: item.internal_description?.trim() || null,
        ncm_code: item.ncm_code?.trim() || "",
        country_of_origin: item.country_of_origin?.trim() || null,
        apertura: item.apertura ?? null,
        times_used: 0,
        last_used_at: now,
      }));

      const { error: batchError } = await supabase
        .from("product_catalog")
        .insert(insertRows);

      if (batchError) {
        // Fallback: insertar uno por uno para identificar cuáles fallan
        for (let i = 0; i < insertRows.length; i++) {
          const { error: singleError } = await supabase
            .from("product_catalog")
            .insert(insertRows[i]);

          if (singleError) {
            errors.push(
              `Error creando SKU "${toCreate[i].sku}": ${singleError.message}`
            );
          } else {
            created++;
          }
        }
      } else {
        created = toCreate.length;
      }
    }

    // --- UPDATE: actualizar por provider_id + sku ---
    for (const item of toUpdate) {
      const updateData: Record<string, unknown> = {};

      if (item.provider_description !== undefined)
        updateData.provider_description = item.provider_description;
      if (item.customs_description !== undefined)
        updateData.customs_description =
          item.customs_description.trim() || item.provider_description;
      if (item.internal_description !== undefined)
        updateData.internal_description =
          item.internal_description.trim() || null;
      if (item.ncm_code !== undefined)
        updateData.ncm_code = item.ncm_code.trim() || "";
      if (item.country_of_origin !== undefined)
        updateData.country_of_origin = item.country_of_origin.trim() || null;
      if (item.apertura !== undefined) updateData.apertura = item.apertura;

      const { error: updateError } = await supabase
        .from("product_catalog")
        .update(updateData)
        .eq("provider_id", body.provider_id)
        .eq("sku", item.sku);

      if (updateError) {
        errors.push(
          `Error actualizando SKU "${item.sku}": ${updateError.message}`
        );
      } else {
        updated++;
      }
    }

    // --- Fire-and-forget: generar embeddings ---
    generateAndSaveEmbeddings(supabase, body.provider_id, body.items).catch(
      (err) => {
        console.error("[Catalog Import] Error generando embeddings:", err);
      }
    );

    return NextResponse.json({ created, updated, skipped, errors });
  } catch (error) {
    console.error("Catalog import error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
