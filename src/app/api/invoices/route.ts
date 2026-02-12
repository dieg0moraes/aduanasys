import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { detectFileType } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No se proporcionó un archivo" },
        { status: 400 }
      );
    }

    // 1. Subir archivo a Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: storageError } = await supabase.storage
      .from("invoices")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
      });

    if (storageError) {
      console.error("Storage error:", storageError);
      return NextResponse.json(
        { error: "Error al subir el archivo: " + storageError.message },
        { status: 500 }
      );
    }

    // 2. Obtener URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from("invoices").getPublicUrl(fileName);

    // 3. Detectar tipo de archivo
    const fileType = detectFileType(file.name, file.type);

    // 4. Crear registro en la base de datos
    const { data: invoice, error: dbError } = await supabase
      .from("invoices")
      .insert({
        file_url: publicUrl,
        file_name: file.name,
        file_type: fileType,
        status: "uploaded",
        total_items: 0,
        items_auto_classified: 0,
        items_manually_corrected: 0,
        raw_extraction: {},
        processing_error: null,
        provider_id: null,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json(
        { error: "Error al crear registro: " + dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("invoices")
      .select("*, provider:providers(*)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
