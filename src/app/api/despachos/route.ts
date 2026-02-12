import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const clientId = request.nextUrl.searchParams.get("client_id");
    const search = request.nextUrl.searchParams.get("search") || "";
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    let query = supabase
      .from("despachos")
      .select("*, client:clients(*), invoices(count)")
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    if (search) {
      query = query.or(`reference.ilike.%${search}%,customs_code.ilike.%${search}%`);
    }

    if (from) {
      query = query.gte("created_at", from);
    }

    if (to) {
      query = query.lte("created_at", `${to}T23:59:59.999Z`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const despachos = (data || []).map((d: Record<string, unknown>) => ({
      ...d,
      invoice_count: Array.isArray(d.invoices) && d.invoices.length > 0
        ? (d.invoices[0] as { count: number }).count
        : 0,
      invoices: undefined,
    }));

    return NextResponse.json(despachos);
  } catch (error) {
    console.error("Despachos fetch error:", error);
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
    const { reference, client_id, notes } = body;

    if (!reference || !reference.trim()) {
      return NextResponse.json({ error: "La referencia es obligatoria" }, { status: 400 });
    }

    if (!client_id) {
      return NextResponse.json({ error: "El cliente es obligatorio" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("despachos")
      .insert({
        reference: reference.trim(),
        client_id,
        notes: notes?.trim() || null,
        status: "abierto",
      })
      .select("*, client:clients(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Despacho create error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
