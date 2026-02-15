import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const { data: partida, error: partidaError } = await supabase
      .from("partidas")
      .select("*, invoice:invoices(id, file_name, country_code, provider:providers(name))")
      .eq("id", id)
      .single();

    if (partidaError) {
      return NextResponse.json({ error: partidaError.message }, { status: 404 });
    }

    const { data: items, error: itemsError } = await supabase
      .from("partida_items")
      .select("*, invoice_item:invoice_items(*)")
      .eq("partida_id", id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ ...partida, items: items || [] });
  } catch (error) {
    console.error("Partida fetch error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
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
    const body = await request.json();

    // Fetch current partida to check status
    const { data: current, error: fetchError } = await supabase
      .from("partidas")
      .select("status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    // Status transitions are always allowed
    if (body.status !== undefined) {
      updates.status = body.status;
    }

    // Other fields only editable when status is 'borrador'
    if (current.status === "borrador") {
      if (body.reference !== undefined) updates.reference = body.reference.trim();
      if (body.date !== undefined) updates.date = body.date || null;
      if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    } else {
      // If trying to update non-status fields on a non-borrador partida, reject
      if (body.reference !== undefined || body.date !== undefined || body.notes !== undefined) {
        return NextResponse.json(
          { error: "Solo se puede editar una partida en estado borrador" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("partidas")
      .update(updates)
      .eq("id", id)
      .select("*, invoice:invoices(id, file_name, country_code, provider:providers(name))")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Partida update error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // CASCADE will delete partida_items automatically
    const { error } = await supabase
      .from("partidas")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Partida delete error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
