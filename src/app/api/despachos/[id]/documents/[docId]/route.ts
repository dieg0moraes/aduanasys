import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, docId } = await params;

    const { data: doc, error } = await supabase
      .from("despacho_documents")
      .select("file_url, file_name")
      .eq("id", docId)
      .eq("despacho_id", id)
      .single();

    if (error || !doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Extract storage path from file_url
    const match = doc.file_url.match(/\/documents\/(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const storagePath = match[1];

    // Generate signed URL (5 min expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 300);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Error al generar URL de descarga" },
        { status: 500 }
      );
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id, docId } = await params;

    // Get document to find storage path
    const { data: doc, error: fetchError } = await supabase
      .from("despacho_documents")
      .select("file_url")
      .eq("id", docId)
      .eq("despacho_id", id)
      .single();

    if (fetchError || !doc) {
      return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
    }

    // Delete from storage
    const match = doc.file_url.match(/\/documents\/(.+)$/);
    if (match) {
      await supabase.storage.from("documents").remove([match[1]]);
    }

    // Delete DB record
    const { error } = await supabase
      .from("despacho_documents")
      .delete()
      .eq("id", docId)
      .eq("despacho_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Document delete error:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
