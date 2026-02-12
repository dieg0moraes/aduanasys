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

interface Provider {
  id: string;
  name: string;
  country: string | null;
  created_at: string;
  product_count: number;
  invoice_count: number;
}

export default function CatalogoPage() {
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
          <Package size={24} className="text-[#2E86C1]" />
          Catálogo de Productos
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Seleccioná un proveedor para ver y editar sus productos. El catálogo
          se construye automáticamente con cada factura aprobada.
        </p>
      </div>

      {/* Search + Stats */}
      <div className="flex items-center gap-4 mb-6">
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
            className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
          />
        </div>
        <div className="text-sm text-gray-500 whitespace-nowrap">
          {providers.length} proveedor{providers.length !== 1 ? "es" : ""} · {totalProducts} producto{totalProducts !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Provider list */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-[#2E86C1]" />
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {search
              ? "No se encontraron proveedores con esa búsqueda."
              : "No hay proveedores todavía. Procesá y aprobá facturas para que aparezcan acá."}
          </div>
        ) : (
          providers.map((provider) => (
            <Link
              key={provider.id}
              href={`/catalogo/${provider.id}`}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border hover:border-[#2E86C1]/30 hover:shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
                <Building2 size={20} className="text-[#2E86C1]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 group-hover:text-[#2E86C1] transition-colors">
                  {provider.name}
                </h3>
                {provider.country && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {provider.country}
                  </p>
                )}
              </div>
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
              <ChevronRight
                size={16}
                className="text-gray-300 group-hover:text-[#2E86C1] transition-colors"
              />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
