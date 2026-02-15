"use client";

import { useState } from "react";
import { X, Loader2, Search } from "lucide-react";

interface NuevoProductoModalProps {
  providerId?: string;
  providerName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NuevoProductoModal({ providerId, providerName, onClose, onSaved }: NuevoProductoModalProps) {
  // Form state
  const [sku, setSku] = useState("");
  const [providerDescription, setProviderDescription] = useState("");
  const [internalDescription, setInternalDescription] = useState("");
  const [customsDescription, setCustomsDescription] = useState("");
  const [ncmCode, setNcmCode] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !providerDescription.trim()) {
      setError("SKU y descripción comercial son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          sku: sku.trim(),
          provider_description: providerDescription.trim(),
          internal_description: internalDescription.trim() || undefined,
          customs_description: customsDescription.trim() || undefined,
          ncm_code: ncmCode.trim() || undefined,
          country_of_origin: countryOfOrigin.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Error al guardar.");
        setSaving(false);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Error de red.");
      setSaving(false);
    }
  };

  // Render a modal overlay
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-xl w-[520px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E4E4E7]">
          <h2 className="text-lg font-semibold text-[#18181B]">Nuevo Producto</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F4F4F5] rounded text-[#A1A1AA]">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Provider (read-only if pre-selected) */}
          {providerName && (
            <div>
              <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Proveedor</label>
              <p className="mt-1 text-sm text-[#18181B] font-medium">{providerName}</p>
            </div>
          )}

          {/* SKU */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">SKU *</label>
            <input type="text" value={sku} onChange={(e) => setSku(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Código SKU" />
          </div>

          {/* Descripción comercial */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Descripción comercial *</label>
            <input type="text" value={providerDescription} onChange={(e) => setProviderDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Descripción del proveedor" />
          </div>

          {/* Descripción interna */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Descripción interna</label>
            <input type="text" value={internalDescription} onChange={(e) => setInternalDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Descripción interna" />
          </div>

          {/* Descripción aduanera */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Descripción aduanera</label>
            <input type="text" value={customsDescription} onChange={(e) => setCustomsDescription(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="Descripción para aduana" />
          </div>

          {/* NCM Code */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Código NCM</label>
            <input type="text" value={ncmCode} onChange={(e) => setNcmCode(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="0000.00.00" />
          </div>

          {/* País de origen */}
          <div>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">País de origen</label>
            <input type="text" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              placeholder="País de origen" />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Guardando..." : "Guardar Producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
