import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

// Vincular factura al despacho
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
    const { invoice_id } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: "invoice_id es obligatorio" }, { status: 400 });
    }

    // Verificar que el despacho existe
    const { data: despacho, error: despachoError } = await supabase
      .from("despachos")
      .select("id")
      .eq("id", id)
      .single();

    if (despachoError || !despacho) {
      return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({ despacho_id: id })
      .eq("id", invoice_id)
      .select("*, provider:providers(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Link invoice error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

// Desvincular factura del despacho
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await params; // consume params
    const invoiceId = request.nextUrl.searchParams.get("invoice_id");

    if (!invoiceId) {
      return NextResponse.json({ error: "invoice_id es obligatorio" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({ despacho_id: null })
      .eq("id", invoiceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Unlink invoice error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
