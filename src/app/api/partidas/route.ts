import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const despachoId = request.nextUrl.searchParams.get("despacho_id");
    if (!despachoId) {
      return NextResponse.json({ error: "despacho_id es obligatorio" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("partidas")
      .select("*, invoice:invoices(id, file_name, provider:providers(name))")
      .eq("despacho_id", despachoId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Count items for each partida
    const partidas = await Promise.all(
      (data || []).map(async (p: Record<string, unknown>) => {
        const { count } = await supabase
          .from("partida_items")
          .select("*", { count: "exact", head: true })
          .eq("partida_id", p.id as string);

        return {
          ...p,
          item_count: count || 0,
        };
      })
    );

    return NextResponse.json(partidas);
  } catch (error) {
    console.error("Partidas fetch error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { despacho_id, invoice_id, reference, date, notes, items } = body;

    if (!despacho_id) {
      return NextResponse.json({ error: "despacho_id es obligatorio" }, { status: 400 });
    }

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id es obligatorio" }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Se requiere al menos un item" }, { status: 400 });
    }

    // Auto-generate reference if not provided
    let finalReference = reference?.trim();
    if (!finalReference) {
      const { count } = await supabase
        .from("partidas")
        .select("*", { count: "exact", head: true })
        .eq("despacho_id", despacho_id);

      finalReference = `P-${String((count || 0) + 1).padStart(3, "0")}`;
    }

    // Validate each item
    for (const item of items) {
      if (!item.dispatch_quantity || item.dispatch_quantity <= 0) {
        return NextResponse.json(
          { error: `dispatch_quantity debe ser mayor a 0` },
          { status: 400 }
        );
      }

      // Get the invoice item's total quantity
      const { data: invoiceItem, error: itemError } = await supabase
        .from("invoice_items")
        .select("quantity")
        .eq("id", item.invoice_item_id)
        .single();

      if (itemError || !invoiceItem) {
        return NextResponse.json(
          { error: `Item de factura ${item.invoice_item_id} no encontrado` },
          { status: 400 }
        );
      }

      // Get sum of already dispatched quantity for this invoice_item
      const { data: dispatched } = await supabase
        .from("partida_items")
        .select("dispatch_quantity")
        .eq("invoice_item_id", item.invoice_item_id);

      const alreadyDispatched = (dispatched || []).reduce(
        (sum: number, d: { dispatch_quantity: number }) => sum + d.dispatch_quantity,
        0
      );

      if (alreadyDispatched + item.dispatch_quantity > (invoiceItem.quantity || 0)) {
        return NextResponse.json(
          {
            error: `Cantidad excede lo disponible para item ${item.invoice_item_id}. Disponible: ${(invoiceItem.quantity || 0) - alreadyDispatched}, solicitado: ${item.dispatch_quantity}`,
          },
          { status: 400 }
        );
      }
    }

    // Insert partida
    const { data: partida, error: partidaError } = await supabase
      .from("partidas")
      .insert({
        reference: finalReference,
        despacho_id,
        invoice_id,
        date: date || null,
        notes: notes?.trim() || null,
        status: "borrador",
      })
      .select("*, invoice:invoices(id, file_name, provider:providers(name))")
      .single();

    if (partidaError) {
      return NextResponse.json({ error: partidaError.message }, { status: 500 });
    }

    // Insert partida items
    const partidaItems = items.map((item: { invoice_item_id: string; dispatch_quantity: number }) => ({
      partida_id: partida.id,
      invoice_item_id: item.invoice_item_id,
      dispatch_quantity: item.dispatch_quantity,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from("partida_items")
      .insert(partidaItems)
      .select("*, invoice_item:invoice_items(*)");

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json(
      { ...partida, items: insertedItems, item_count: insertedItems?.length || 0 },
      { status: 201 }
    );
  } catch (error) {
    console.error("Partida create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
