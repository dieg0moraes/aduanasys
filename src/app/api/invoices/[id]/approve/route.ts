import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { generateEmbeddings } from "@/lib/embeddings";

/**
 * POST /api/invoices/[id]/approve
 *
 * Aprueba una factura y guarda/actualiza los ítems en product_catalog
 * con embeddings generados, cerrando el feedback loop:
 *
 * 1. Upsert al catálogo con descripción aduanera + NCM corregido
 * 2. Genera embeddings para cada producto → habilita match semántico en catálogo
 * 3. La próxima factura del mismo proveedor matchea automáticamente (exact o semántico)
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

  try {
    // 1. Obtener factura + ítems en paralelo
    const [invoiceResult, itemsResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, status, provider_id")
        .eq("id", id)
        .single(),
      supabase
        .from("invoice_items")
        .select(
          "sku, original_description, customs_description, ncm_code, was_corrected"
        )
        .eq("invoice_id", id),
    ]);

    if (invoiceResult.error || !invoiceResult.data) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    const invoice = invoiceResult.data;

    if (invoice.status !== "review" && invoice.status !== "approved") {
      return NextResponse.json(
        { error: "La factura debe estar en estado 'review' para aprobar" },
        { status: 400 }
      );
    }

    if (itemsResult.error || !itemsResult.data) {
      return NextResponse.json(
        { error: "Error al obtener ítems" },
        { status: 500 }
      );
    }

    const items = itemsResult.data;
    let catalogCount = 0;

    // 2. Upsert batch al catálogo con embeddings
    if (invoice.provider_id) {
      const now = new Date().toISOString();

      // Filtrar ítems válidos y deduplicar por SKU (quedarse con el último)
      const skuMap = new Map<
        string,
        {
          provider_id: string;
          sku: string;
          provider_description: string;
          customs_description: string;
          ncm_code: string;
          times_used: number;
          last_used_at: string;
        }
      >();

      for (const item of items) {
        if (!item.sku || !item.customs_description || !item.ncm_code) continue;

        skuMap.set(item.sku, {
          provider_id: invoice.provider_id,
          sku: item.sku,
          provider_description: item.original_description,
          customs_description: item.customs_description,
          ncm_code: item.ncm_code,
          times_used: 1,
          last_used_at: now,
        });
      }

      const catalogRows = Array.from(skuMap.values());
      catalogCount = catalogRows.length;

      if (catalogRows.length > 0) {
        // Generar embeddings para los productos del catálogo
        // Texto: SKU + descripción del proveedor + aduanera + NCM
        const textsForEmbedding = catalogRows.map(
          (row) =>
            `${row.sku} | ${row.provider_description} | ${row.customs_description} | NCM ${row.ncm_code}`
        );

        let embeddings: number[][] | null = null;
        try {
          embeddings = await generateEmbeddings(textsForEmbedding);
          console.log(
            `[Approve] Generados ${embeddings.length} embeddings para catálogo`
          );
        } catch (err) {
          console.warn("[Approve] Error generando embeddings:", err);
          // No bloquear la aprobación si falla el embedding
        }

        // Agregar embeddings a los rows si se generaron
        const rowsWithEmbeddings = catalogRows.map((row, i) => ({
          ...row,
          ...(embeddings && embeddings[i]
            ? { embedding: embeddings[i] }
            : {}),
        }));

        // Upsert con onConflict en (provider_id, sku)
        const { error: upsertError } = await supabase
          .from("product_catalog")
          .upsert(rowsWithEmbeddings, {
            onConflict: "provider_id,sku",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error("Error en upsert del catálogo:", upsertError);
        }
      }
    }

    // 3. Actualizar factura como aprobada
    const correctedCount = items.filter((i) => i.was_corrected).length;

    await supabase
      .from("invoices")
      .update({
        status: "approved",
        items_manually_corrected: correctedCount,
      })
      .eq("id", id);

    console.log(
      `✅ Factura ${id} aprobada. ${catalogCount} productos sincronizados al catálogo (con embeddings).`
    );

    return NextResponse.json({
      success: true,
      catalog_synced: catalogCount,
      total_items: items.length,
      corrected: correctedCount,
    });
  } catch (error) {
    console.error("Error al aprobar factura:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
