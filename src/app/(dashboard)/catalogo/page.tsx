"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Loader2,
  Package,
  Building2,
  FileText,
  ChevronRight,
} from "lucide-react";
import MercaderiaSearch from "@/components/catalog/mercaderia-search";

interface Provider {
  id: string;
  name: string;
  country: string | null;
  created_at: string;
  product_count: number;
  invoice_count: number;
}

const AVATAR_COLORS = [
  "bg-[#2563EB] text-white",
  "bg-[#9333EA] text-white",
  "bg-[#EA580C] text-white",
  "bg-[#16A34A] text-white",
  "bg-[#DC2626] text-white",
  "bg-[#0891B2] text-white",
  "bg-[#D97706] text-white",
  "bg-[#7C3AED] text-white",
  "bg-[#059669] text-white",
  "bg-[#E11D48] text-white",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CatalogoPage() {
  const [activeTab, setActiveTab] = useState<"proveedores" | "mercaderia">("proveedores");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);

        const response = await fetch(`/api/providers?${params}`);
        if (response.ok) {
          const data = await response.json();
          setProviders(data.providers);
        }
      } catch (err) {
        console.error("Error fetching providers:", err);
      }
      setLoading(false);
    };

    fetchProviders();
  }, [search]);

  const totalProducts = providers.reduce((sum, p) => sum + p.product_count, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Package size={24} className="text-[#2563EB]" />
          Catálogo de Productos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {activeTab === "proveedores"
            ? "Seleccioná un proveedor para ver y editar sus productos. El catálogo se construye automáticamente con cada factura aprobada."
            : "Buscá productos en todo el catálogo por SKU, descripción, NCM o proveedor."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab("proveedores")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "proveedores"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Proveedores
        </button>
        <button
          onClick={() => setActiveTab("mercaderia")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "mercaderia"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Mercadería
        </button>
      </div>

      {/* Proveedores tab */}
      {activeTab === "proveedores" && (
        <>
          {/* Search + Stats */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Buscar proveedor..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB]"
              />
            </div>
            <div className="text-sm text-gray-500 whitespace-nowrap">
              {providers.length} proveedor{providers.length !== 1 ? "es" : ""} · {totalProducts} producto{totalProducts !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Provider list */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-[#2563EB]" />
              </div>
            ) : providers.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                {search
                  ? "No se encontraron proveedores con esa búsqueda."
                  : "No hay proveedores todavía. Procesá y aprobá facturas para que aparezcan acá."}
              </div>
            ) : (
              <>
                <div className="divide-y divide-[#E4E4E7]">
                  {providers.map((provider) => (
                    <Link
                      key={provider.id}
                      href={`/catalogo/${provider.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA] transition-colors group"
                    >
                      {/* Avatar circle */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${getAvatarColor(provider.name)}`}
                      >
                        {provider.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Name + country */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 group-hover:text-[#2563EB] transition-colors">
                          {provider.name}
                        </h3>
                        {provider.country && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {provider.country}
                          </p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5" title="Productos en catálogo">
                          <Package size={14} className="text-gray-400" />
                          <span className="font-medium">{provider.product_count}</span>
                          <span className="text-xs text-gray-400">productos</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Facturas procesadas">
                          <FileText size={14} className="text-gray-400" />
                          <span className="font-medium">{provider.invoice_count}</span>
                          <span className="text-xs text-gray-400">facturas</span>
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight
                        size={16}
                        className="text-gray-300 group-hover:text-[#2563EB] transition-colors flex-shrink-0"
                      />
                    </Link>
                  ))}
                </div>

                {/* Pagination info */}
                <div className="px-5 py-3 border-t border-[#E4E4E7] bg-[#FAFAFA]">
                  <span className="text-xs text-gray-500">
                    Mostrando {providers.length} de {providers.length} proveedores
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Mercadería tab */}
      {activeTab === "mercaderia" && <MercaderiaSearch />}
    </div>
  );
}
