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
      .from("despachos")
      .select("*, client:clients(*), invoices(*, provider:providers(*))")
      .eq("id", id)
      .order("created_at", { ascending: false, referencedTable: "invoices" })
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Despacho fetch error:", error);
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
    const updates: Record<string, unknown> = {};

    if (body.reference !== undefined) updates.reference = body.reference.trim();
    if (body.client_id !== undefined) updates.client_id = body.client_id;
    if (body.customs_code !== undefined) updates.customs_code = body.customs_code?.trim() || null;
    if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
    if (body.status !== undefined) updates.status = body.status;

    const { data, error } = await supabase
      .from("despachos")
      .update(updates)
      .eq("id", id)
      .select("*, client:clients(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Despacho update error:", error);
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

    // Clean up document files from storage
    const { data: docs } = await supabase
      .from("despacho_documents")
      .select("file_url")
      .eq("despacho_id", id);

    if (docs && docs.length > 0) {
      const paths = docs
        .map((d) => d.file_url.match(/\/documents\/(.+)$/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => m[1]);
      if (paths.length > 0) {
        await supabase.storage.from("documents").remove(paths);
      }
    }

    // Desvincular facturas primero (set despacho_id = null)
    await supabase
      .from("invoices")
      .update({ despacho_id: null })
      .eq("despacho_id", id);

    // DB records in despacho_documents are deleted by CASCADE
    const { error } = await supabase
      .from("despachos")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Despacho delete error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
