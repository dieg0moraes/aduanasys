"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Package,
  AlertCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { InvoiceStatus } from "@/lib/types";

interface DashboardStats {
  kpis: {
    facturas_en_proceso: number;
    despachos_activos: number;
    items_pendientes: number;
    tasa_precision: number;
  };
  recent_invoices: Array<{
    id: string;
    file_name: string;
    status: InvoiceStatus;
    created_at: string;
    provider?: { name: string } | null;
  }>;
  alerts: Array<{
    id: string;
    description: string;
    confidence_level: string;
    invoice_id: string;
    invoice?: { file_name: string; status: string } | null;
  }>;
}

const STATUS_BADGE_MAP: Record<
  InvoiceStatus,
  { label: string; color: "success" | "warning" | "error" | "blue" | "gray" }
> = {
  uploaded: { label: "Subida", color: "gray" },
  processing: { label: "Procesando", color: "blue" },
  review: { label: "En revisión", color: "warning" },
  approved: { label: "Aprobada", color: "success" },
  exported: { label: "Exportada", color: "success" },
};

const CONFIDENCE_BADGE_MAP: Record<
  string,
  { label: string; color: "success" | "warning" | "error" | "blue" | "gray" }
> = {
  high: { label: "Alta", color: "success" },
  medium: { label: "Media", color: "warning" },
  low: { label: "Baja", color: "error" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#2563EB]" />
      </div>
    );
  }

  const kpis = stats?.kpis;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-[#18181B]">Dashboard</h1>

      {/* KPI Row */}
      <div className="flex gap-4">
        <KPICard
          label="Facturas en Proceso"
          value={kpis?.facturas_en_proceso ?? 0}
          icon={FileText}
        />
        <KPICard
          label="Despachos Activos"
          value={kpis?.despachos_activos ?? 0}
          icon={Package}
        />
        <KPICard
          label="Items Pendientes"
          value={kpis?.items_pendientes ?? 0}
          icon={AlertCircle}
        />
        <KPICard
          label="Tasa de Precisión"
          value={`${kpis?.tasa_precision ?? 0}%`}
          icon={TrendingUp}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Alertas */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-5">
          <h2 className="text-sm font-semibold text-[#18181B] mb-4">
            Alertas
          </h2>
          {!stats?.alerts?.length ? (
            <p className="text-sm text-[#71717A] py-4">
              Sin alertas pendientes
            </p>
          ) : (
            <div className="space-y-3">
              {stats.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-3 py-2 border-b border-[#F4F4F5] last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#18181B] truncate">
                      {alert.invoice?.file_name ?? "Factura"}
                    </p>
                    <p className="text-xs text-[#71717A] truncate">
                      {alert.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      label={
                        CONFIDENCE_BADGE_MAP[alert.confidence_level]?.label ??
                        alert.confidence_level
                      }
                      color={
                        CONFIDENCE_BADGE_MAP[alert.confidence_level]?.color ??
                        "gray"
                      }
                    />
                    <Link
                      href={`/facturas/${alert.invoice_id}`}
                      className="text-xs text-[#2563EB] hover:underline whitespace-nowrap"
                    >
                      Ver factura
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Facturas Recientes */}
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-5">
          <h2 className="text-sm font-semibold text-[#18181B] mb-4">
            Facturas Recientes
          </h2>
          {!stats?.recent_invoices?.length ? (
            <p className="text-sm text-[#71717A] py-4">
              No hay facturas recientes
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#71717A] border-b border-[#F4F4F5]">
                  <th className="text-left pb-2 font-medium">Factura</th>
                  <th className="text-left pb-2 font-medium">Proveedor</th>
                  <th className="text-left pb-2 font-medium">Fecha</th>
                  <th className="text-left pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_invoices.map((inv) => {
                  const badge = STATUS_BADGE_MAP[inv.status] ?? {
                    label: inv.status,
                    color: "gray" as const,
                  };
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-[#F4F4F5] last:border-0"
                    >
                      <td className="py-2.5">
                        <Link
                          href={`/facturas/${inv.id}`}
                          className="text-[#2563EB] hover:underline truncate block max-w-[160px]"
                        >
                          {inv.file_name}
                        </Link>
                      </td>
                      <td className="py-2.5 text-[#71717A]">
                        {inv.provider?.name ?? "-"}
                      </td>
                      <td className="py-2.5 text-[#71717A]">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge label={badge.label} color={badge.color} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
