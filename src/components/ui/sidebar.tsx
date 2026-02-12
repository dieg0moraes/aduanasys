"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Upload, BarChart3, Database, Settings, BookOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/facturas?action=upload", label: "Subir Factura", icon: Upload },
  { href: "/catalogo", label: "Catálogo", icon: Database },
  { href: "/ncm", label: "NCM", icon: BookOpen },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#1B4F72] text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">AduanaSys</h1>
        <p className="text-xs text-blue-200 mt-1">Despachos de Aduana</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const baseHref = item.href.split("?")[0];
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(baseHref) &&
                !item.href.includes("action=upload");
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white/15 text-white font-medium"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-blue-200 text-center">MVP v0.1.0</p>
      </div>
    </aside>
  );
}
