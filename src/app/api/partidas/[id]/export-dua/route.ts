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

    // Fetch partida with joined invoice data
    const { data: partida, error: partidaError } = await supabase
      .from("partidas")
      .select("*, invoice:invoices(id, file_name, country_code)")
      .eq("id", id)
      .single();

    if (partidaError || !partida) {
      return NextResponse.json({ error: "Partida no encontrada" }, { status: 404 });
    }

    // Fetch partida items with joined invoice_items
    const { data: items, error: itemsError } = await supabase
      .from("partida_items")
      .select("*, invoice_item:invoice_items(*)")
      .eq("partida_id", id);

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
    for (const pItem of items || []) {
      const item = pItem.invoice_item;
      if (!item) continue;

      // Recalculate value proportionally: (dispatch_quantity / item.quantity) * item.total_price
      let valor: number | string = "";
      if (item.quantity && item.quantity > 0 && item.total_price != null) {
        valor = (pItem.dispatch_quantity / item.quantity) * item.total_price;
        valor = Math.round(valor * 100) / 100;
      }

      sheet.addRow({
        mercaderia: item.internal_description || "",
        cantidad: pItem.dispatch_quantity,
        valor,
        unidad: matchUnitToDUA(item.unit_of_measure),
        ncm: item.ncm_code || "",
        origen: item.country_of_origin ?? "",
        descripcion_dna: item.customs_description || "",
        item: item.line_number,
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Build filename: DUA_P-{reference}_{invoice_filename}.xlsx
    const invoice = partida.invoice as { file_name?: string } | null;
    const invoiceBaseName = invoice?.file_name
      ?.replace(/\.[^.]+$/, "")
      ?.replace(/[^a-zA-Z0-9_-]/g, "_") || "factura";
    const reference = partida.reference?.replace(/[^a-zA-Z0-9_-]/g, "_") || "partida";
    const fileName = `DUA_P-${reference}_${invoiceBaseName}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("Export DUA partida error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
