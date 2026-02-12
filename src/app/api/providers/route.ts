import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

/**
 * GET /api/providers?search=...
 *
 * Lista proveedores con cantidad de productos en catálogo y facturas procesadas.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";

  try {
    // Obtener proveedores
    let query = supabase
      .from("providers")
      .select("id, name, country, created_at")
      .order("name");

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data: providers, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({ providers: [] });
    }

    // Para cada proveedor, contar productos en catálogo y facturas
    const providerIds = providers.map((p) => p.id);

    const [catalogCounts, invoiceCounts] = await Promise.all([
      supabase
        .from("product_catalog")
        .select("provider_id")
        .in("provider_id", providerIds),
      supabase
        .from("invoices")
        .select("provider_id")
        .in("provider_id", providerIds),
    ]);

    // Contar por provider_id
    const catalogMap = new Map<string, number>();
    const invoiceMap = new Map<string, number>();

    for (const row of catalogCounts.data || []) {
      catalogMap.set(row.provider_id, (catalogMap.get(row.provider_id) || 0) + 1);
    }
    for (const row of invoiceCounts.data || []) {
      invoiceMap.set(row.provider_id, (invoiceMap.get(row.provider_id) || 0) + 1);
    }

    const result = providers.map((p) => ({
      ...p,
      product_count: catalogMap.get(p.id) || 0,
      invoice_count: invoiceMap.get(p.id) || 0,
    }));

    return NextResponse.json({ providers: result });
  } catch (error) {
    console.error("Providers list error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
