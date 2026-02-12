"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface DashboardStats {
  total: number;
  processing: number;
  review: number;
  approved: number;
  exported: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    processing: 0,
    review: 0,
    approved: 0,
    exported: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from("invoices")
        .select("status");

      if (!error && data) {
        setStats({
          total: data.length,
          processing: data.filter((i) => i.status === "processing").length,
          review: data.filter((i) => i.status === "review").length,
          approved: data.filter((i) => i.status === "approved").length,
          exported: data.filter((i) => i.status === "exported").length,
        });
      }
      setLoading(false);
    }
    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Total Facturas",
      value: stats.total,
      icon: FileText,
      color: "bg-blue-50 text-blue-700",
      iconColor: "text-blue-500",
    },
    {
      label: "Procesando",
      value: stats.processing,
      icon: Clock,
      color: "bg-yellow-50 text-yellow-700",
      iconColor: "text-yellow-500",
    },
    {
      label: "En Revisión",
      value: stats.review,
      icon: AlertCircle,
      color: "bg-orange-50 text-orange-700",
      iconColor: "text-orange-500",
    },
    {
      label: "Aprobadas",
      value: stats.approved,
      icon: CheckCircle,
      color: "bg-green-50 text-green-700",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Resumen del sistema de procesamiento de facturas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold mt-1 text-gray-900">
                    {loading ? "-" : card.value}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.color}`}>
                  <Icon size={24} className={card.iconColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Acciones Rápidas
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/facturas?action=upload"
            className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-[#2E86C1] bg-[#EBF5FB]/50 hover:bg-[#EBF5FB] transition-colors"
          >
            <div className="p-3 bg-[#2E86C1] rounded-xl">
              <Upload size={24} className="text-white" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Subir Factura</p>
              <p className="text-sm text-gray-500">
                Cargá una nueva factura para procesar
              </p>
            </div>
          </Link>
          <Link
            href="/facturas"
            className="flex items-center gap-4 p-4 rounded-xl border hover:border-[#2E86C1] hover:bg-gray-50 transition-colors"
          >
            <div className="p-3 bg-gray-100 rounded-xl">
              <FileText size={24} className="text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Ver Facturas</p>
              <p className="text-sm text-gray-500">
                Revisá las facturas procesadas
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
