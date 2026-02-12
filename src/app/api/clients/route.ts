import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const search = request.nextUrl.searchParams.get("search") || "";

    let query = supabase
      .from("clients")
      .select("*, despachos(count)")
      .order("name", { ascending: true });

    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const clients = (data || []).map((c: Record<string, unknown>) => ({
      ...c,
      despacho_count: Array.isArray(c.despachos) && c.despachos.length > 0
        ? (c.despachos[0] as { count: number }).count
        : 0,
      despachos: undefined,
    }));

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Clients fetch error:", error);
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
    const { name, cuit } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({ name: name.trim(), cuit: cuit?.trim() || null })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Client create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
