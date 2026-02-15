import { createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createServerClient();

  // Facturas en proceso
  const { count: processingCount } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .in("status", ["processing", "review"]);

  // Despachos activos
  const { count: despachosCount } = await supabase
    .from("despachos")
    .select("*", { count: "exact", head: true })
    .neq("status", "completed");

  // Items pendientes (low confidence)
  const { count: pendingItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true })
    .eq("confidence_level", "low");

  // Tasa de precisión
  const { count: totalItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true });
  const { count: highConfItems } = await supabase
    .from("invoice_items")
    .select("*", { count: "exact", head: true })
    .eq("confidence_level", "high");

  const precision = totalItems
    ? Math.round(((highConfItems || 0) / totalItems) * 100)
    : 0;

  // Recent invoices
  const { data: recentInvoices } = await supabase
    .from("invoices")
    .select("*, provider:providers(name)")
    .order("created_at", { ascending: false })
    .limit(5);

  // Alerts: low confidence items
  const { data: alerts } = await supabase
    .from("invoice_items")
    .select("*, invoice:invoices(file_name, status)")
    .eq("confidence_level", "low")
    .limit(5);

  return NextResponse.json({
    kpis: {
      facturas_en_proceso: processingCount || 0,
      despachos_activos: despachosCount || 0,
      items_pendientes: pendingItems || 0,
      tasa_precision: precision,
    },
    recent_invoices: recentInvoices || [],
    alerts: alerts || [],
  });
}
