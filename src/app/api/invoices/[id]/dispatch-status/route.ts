import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Fetch all invoice_items for this invoice (just the IDs and quantities)
    const { data: invoiceItems, error: itemsError } = await supabase
      .from("invoice_items")
      .select("id, quantity")
      .eq("invoice_id", id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!invoiceItems || invoiceItems.length === 0) {
      return NextResponse.json({ dispatch_status: {} });
    }

    const itemIds = invoiceItems.map((item) => item.id);

    // 2. Query partida_items for those invoice_item_ids
    const { data: partidaItems, error: partidaError } = await supabase
      .from("partida_items")
      .select("invoice_item_id, dispatch_quantity, partida:partidas(id, reference, status)")
      .in("invoice_item_id", itemIds);

    if (partidaError) {
      return NextResponse.json({ error: partidaError.message }, { status: 500 });
    }

    // 3. Group by invoice_item_id and sum dispatch_quantity
    const dispatchStatus: Record<
      string,
      {
        dispatched_quantity: number;
        partidas: { id: string; reference: string; status: string; quantity: number }[];
      }
    > = {};

    // Initialize all items with zero dispatched
    for (const item of invoiceItems) {
      dispatchStatus[item.id] = {
        dispatched_quantity: 0,
        partidas: [],
      };
    }

    // Aggregate partida_items
    for (const pi of partidaItems || []) {
      const itemId = pi.invoice_item_id;
      if (!dispatchStatus[itemId]) continue;

      dispatchStatus[itemId].dispatched_quantity += pi.dispatch_quantity;

      // partida comes as a joined object
      const partida = pi.partida as unknown as {
        id: string;
        reference: string;
        status: string;
      } | null;

      if (partida) {
        dispatchStatus[itemId].partidas.push({
          id: partida.id,
          reference: partida.reference,
          status: partida.status,
          quantity: pi.dispatch_quantity,
        });
      }
    }

    return NextResponse.json({ dispatch_status: dispatchStatus });
  } catch (error) {
    console.error("Dispatch status error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
