import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Get the catalog entry to know provider_id and sku
    const { data: product, error: productError } = await supabase
      .from("product_catalog")
      .select("provider_id, sku")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    if (!product.sku || !product.provider_id) {
      return NextResponse.json({ importers: [] });
    }

    // Find invoice_items with matching SKU from invoices of same provider
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select(`
        quantity, total_price, currency,
        invoice:invoices!inner(
          id, file_name, created_at, provider_id,
          despacho:despachos(
            id, reference,
            client:clients(id, name, cuit)
          )
        )
      `)
      .eq("sku", product.sku)
      .eq("invoice.provider_id", product.provider_id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // Group by client, aggregate import history
    const clientMap = new Map<string, {
      client_id: string;
      client_name: string;
      client_cuit: string | null;
      imports: {
        despacho_ref: string | null;
        invoice_file: string;
        invoice_date: string;
        quantity: number | null;
        total_price: number | null;
        currency: string;
      }[];
    }>();

    for (const item of items || []) {
      const inv = item.invoice as unknown as {
        id: string;
        file_name: string;
        created_at: string;
        provider_id: string;
        despacho: {
          id: string;
          reference: string;
          client: { id: string; name: string; cuit: string | null } | null;
        } | null;
      };
      const despacho = inv?.despacho;
      const client = despacho?.client;

      const clientId = client?.id || "sin-cliente";
      const clientName = client?.name || "Sin cliente asignado";

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          client_id: clientId,
          client_name: clientName,
          client_cuit: client?.cuit || null,
          imports: [],
        });
      }

      clientMap.get(clientId)!.imports.push({
        despacho_ref: despacho?.reference || null,
        invoice_file: inv.file_name,
        invoice_date: inv.created_at,
        quantity: item.quantity,
        total_price: item.total_price,
        currency: item.currency,
      });
    }

    // Sort imports by date descending within each client
    for (const imp of clientMap.values()) {
      imp.imports.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());
    }

    return NextResponse.json({
      importers: Array.from(clientMap.values()),
    });
  } catch (error) {
    console.error("Importers fetch error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
