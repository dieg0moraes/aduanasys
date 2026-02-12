import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("file_url, file_name")
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Extraer path relativo al bucket desde file_url
    const match = invoice.file_url.match(/\/invoices\/(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
    }

    const storagePath = match[1];

    // Generar signed URL con 5 minutos de expiración
    const { data: signedData, error: signedError } = await supabase.storage
      .from("invoices")
      .createSignedUrl(storagePath, 300);

    if (signedError || !signedData?.signedUrl) {
      return NextResponse.json(
        { error: "Error al generar URL de descarga" },
        { status: 500 }
      );
    }

    // Redirigir a la signed URL
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
