import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Check partida exists and is in borrador status
    const { data: partida, error: partidaError } = await supabase
      .from("partidas")
      .select("id, status")
      .eq("id", id)
      .single();

    if (partidaError || !partida) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    if (partida.status !== "borrador") {
      return NextResponse.json(
        { error: "Solo se pueden modificar items de una partida en estado borrador" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: "Se requiere un array de items" }, { status: 400 });
    }

    // Validate each item's dispatch_quantity against available quantities
    // Available = item.quantity - already dispatched in OTHER partidas (excluding this one)
    for (const item of items) {
      if (!item.dispatch_quantity || item.dispatch_quantity <= 0) {
        return NextResponse.json(
          { error: "dispatch_quantity debe ser mayor a 0" },
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

      // Get sum of dispatched quantity in OTHER partidas (excluding this one)
      const { data: dispatched } = await supabase
        .from("partida_items")
        .select("dispatch_quantity")
        .eq("invoice_item_id", item.invoice_item_id)
        .neq("partida_id", id);

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

    // Delete existing partida_items for this partida
    const { error: deleteError } = await supabase
      .from("partida_items")
      .delete()
      .eq("partida_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new items (if any)
    if (items.length > 0) {
      const partidaItems = items.map((item: { invoice_item_id: string; dispatch_quantity: number }) => ({
        partida_id: id,
        invoice_item_id: item.invoice_item_id,
        dispatch_quantity: item.dispatch_quantity,
      }));

      const { data: insertedItems, error: insertError } = await supabase
        .from("partida_items")
        .insert(partidaItems)
        .select("*, invoice_item:invoice_items(*)");

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      return NextResponse.json(insertedItems);
    }

    return NextResponse.json([]);
  } catch (error) {
    console.error("Partida items replace error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
