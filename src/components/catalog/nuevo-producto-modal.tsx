"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, Plus, Building2 } from "lucide-react";
import { searchCountries } from "@/lib/countries";

function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <div>
      <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">País de origen</label>
      <div className="relative mt-1">
        <input
          type="text"
          value={open ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
            onChange("");
          }}
          onFocus={() => { setOpen(true); setSearch(value); }}
          placeholder="Buscar país..."
          className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        />
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-[#E4E4E7] rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {searchCountries(search).slice(0, 20).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.name);
                  setSearch(c.name);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#EFF6FF]"
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NuevoProductoModalProps {
  providerId?: string;
  providerName?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function NuevoProductoModal({ providerId, providerName, onClose, onSaved }: NuevoProductoModalProps) {
  // Form state
  const [selectedProviderId, setSelectedProviderId] = useState(providerId || "");
  const [sku, setSku] = useState("");
  const [providerDescription, setProviderDescription] = useState("");
  const [internalDescription, setInternalDescription] = useState("");
  const [customsDescription, setCustomsDescription] = useState("");
  const [ncmCode, setNcmCode] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Provider combobox
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [selectedProviderName, setSelectedProviderName] = useState(providerName || "");
  const [creatingProvider, setCreatingProvider] = useState(false);
  // Country selector for new provider
  const [newProviderCountry, setNewProviderCountry] = useState("");
  const [countrySearchText, setCountrySearchText] = useState("");
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Fetch providers with debounced search
  useEffect(() => {
    if (providerId) return; // Skip if provider is pre-assigned
    if (!showProviderDropdown) return;

    const timer = setTimeout(async () => {
      setLoadingProviders(true);
      try {
        const params = new URLSearchParams();
        if (providerSearch.trim()) params.set("search", providerSearch.trim());
        const res = await fetch(`/api/providers?${params}`);
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers || []);
        }
      } catch {
        // ignore
      }
      setLoadingProviders(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [providerId, showProviderDropdown, providerSearch]);

  const handleCreateProvider = async () => {
    if (!providerSearch.trim()) return;
    setCreatingProvider(true);
    try {
      const body: { name: string; country?: string } = { name: providerSearch.trim() };
      if (newProviderCountry) body.country = newProviderCountry;
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const provider = await res.json();
        setSelectedProviderId(provider.id);
        setSelectedProviderName(provider.name);
        setShowProviderDropdown(false);
        setProviderSearch("");
        setNewProviderCountry("");
        setCountrySearchText("");
      }
    } catch {
      // ignore
    }
    setCreatingProvider(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId) {
      setError("Seleccioná un proveedor.");
      return;
    }
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
          provider_id: selectedProviderId,
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
          {/* Provider */}
          {providerName ? (
            <div>
              <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Proveedor</label>
              <p className="mt-1 text-sm text-[#18181B] font-medium">{providerName}</p>
            </div>
          ) : (
            <div>
              <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Proveedor *</label>
              <div className="relative mt-1">
                {showProviderDropdown ? (
                  <div>
                    <input
                      type="text"
                      value={providerSearch}
                      onChange={(e) => setProviderSearch(e.target.value)}
                      placeholder="Buscar o escribir nombre de proveedor..."
                      className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setShowProviderDropdown(false);
                          setProviderSearch("");
                        }
                      }}
                    />
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#E4E4E7] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {loadingProviders ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 size={14} className="animate-spin text-[#2563EB]" />
                        </div>
                      ) : (
                        <>
                          {providers.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setSelectedProviderId(p.id);
                                setSelectedProviderName(p.name);
                                setShowProviderDropdown(false);
                                setProviderSearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] ${
                                selectedProviderId === p.id ? "bg-[#EFF6FF] font-medium" : ""
                              }`}
                            >
                              {p.name}
                            </button>
                          ))}
                          {/* Create new provider option */}
                          {providerSearch.trim() && (
                            <button
                              type="button"
                              onClick={handleCreateProvider}
                              disabled={creatingProvider}
                              className="w-full text-left px-3 py-2 text-sm border-t border-[#E4E4E7] hover:bg-[#EFF6FF] flex items-center gap-2 text-[#2563EB] font-medium"
                            >
                              {creatingProvider ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Plus size={14} />
                              )}
                              Crear &ldquo;{providerSearch.trim()}&rdquo;
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowProviderDropdown(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm hover:bg-[#FAFAFA] text-left"
                  >
                    <Building2 size={14} className="text-[#A1A1AA]" />
                    {selectedProviderName ? (
                      <span className="text-[#18181B]">{selectedProviderName}</span>
                    ) : (
                      <span className="text-[#A1A1AA]">Seleccionar proveedor</span>
                    )}
                  </button>
                )}
              </div>
              {/* Country selector - shown when typing a name to create a new provider */}
              {showProviderDropdown && providerSearch.trim() && (
                <div className="mt-2">
                  <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">País del proveedor</label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={countrySearchText}
                      onChange={(e) => {
                        setCountrySearchText(e.target.value);
                        setShowCountryDropdown(true);
                        setNewProviderCountry("");
                      }}
                      onFocus={() => setShowCountryDropdown(true)}
                      placeholder={newProviderCountry || "Buscar país..."}
                      className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                    {showCountryDropdown && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-[#E4E4E7] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {searchCountries(countrySearchText).slice(0, 20).map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setNewProviderCountry(c.name);
                              setCountrySearchText(c.name);
                              setShowCountryDropdown(false);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#EFF6FF]"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
          <CountrySelect value={countryOfOrigin} onChange={setCountryOfOrigin} />

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
