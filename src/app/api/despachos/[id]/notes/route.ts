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

    const { data, error } = await supabase
      .from("despacho_notes")
      .select("*")
      .eq("despacho_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Despacho notes fetch error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(
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

    const { author_name, note_text } = body;

    if (!note_text || !note_text.trim()) {
      return NextResponse.json({ error: "El texto de la nota es requerido" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("despacho_notes")
      .insert({
        despacho_id: id,
        author_name: author_name?.trim() || "Usuario",
        note_text: note_text.trim(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Despacho note create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
