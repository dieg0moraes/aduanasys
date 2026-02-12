import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { matchUnitToDUA } from "@/lib/units";
import ExcelJS from "exceljs";

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

    // Fetch invoice with country_code
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, file_name, country_code")
      .eq("id", id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Fetch items ordered by line_number
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("line_number");

    if (itemsError) {
      return NextResponse.json({ error: "Error al obtener ítems" }, { status: 500 });
    }

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Hoja1");

    // Define columns matching the DUA template
    sheet.columns = [
      { header: "MERCADERIA", key: "mercaderia", width: 30 },
      { header: "CANTIDAD", key: "cantidad", width: 12 },
      { header: "VALOR", key: "valor", width: 14 },
      { header: "UNIDAD COMERCIAL", key: "unidad", width: 18 },
      { header: "NCM", key: "ncm", width: 18 },
      { header: "ORIGEN", key: "origen", width: 10 },
      { header: "DESCRIPCION DNA", key: "descripcion_dna", width: 40 },
      { header: "ITEM", key: "item", width: 8 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: "center" };

    // Add item rows
    const countryCode = invoice.country_code ?? "";

    for (const item of items || []) {
      sheet.addRow({
        mercaderia: item.internal_description || "",
        cantidad: item.quantity ?? "",
        valor: item.total_price ?? "",
        unidad: matchUnitToDUA(item.unit_of_measure),
        ncm: item.ncm_code || "",
        origen: countryCode,
        descripcion_dna: item.customs_description || "",
        item: item.line_number,
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Build filename
    const baseName = invoice.file_name
      ?.replace(/\.[^.]+$/, "")
      ?.replace(/[^a-zA-Z0-9_-]/g, "_") || "factura";
    const fileName = `DUA_${baseName}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Export DUA error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
