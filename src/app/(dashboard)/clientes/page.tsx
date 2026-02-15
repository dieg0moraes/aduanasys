"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Users, ChevronRight, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Client } from "@/lib/types";

const AVATAR_COLORS = [
  "bg-[#2563EB]", "bg-[#9333EA]", "bg-[#16A34A]", "bg-[#EA580C]",
  "bg-[#0891B2]", "bg-[#DC2626]", "bg-[#CA8A04]", "bg-[#4F46E5]",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ClientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // New client form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCuit, setNewCuit] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/clients?${params}`);
    if (res.ok) setClients(await res.json());
    setLoading(false);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), cuit: newCuit.trim() || null }),
    });
    if (res.ok) {
      setNewName("");
      setNewCuit("");
      setShowForm(false);
      fetchClients();
    }
    setCreating(false);
  };

  return (
    <div className="p-6 xl:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Clientes</h1>
          <p className="text-sm text-[#71717A] mt-1">
            {clients.length} cliente{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={16} />
          Nuevo Cliente
        </button>
      </div>

      {/* New client form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">Nombre *</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">CUIT</label>
              <input
                type="text"
                value={newCuit}
                onChange={(e) => setNewCuit(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                placeholder="XX-XXXXXXXX-X"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-2"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Crear
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[#2563EB]" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
          <Users size={40} className="mx-auto text-[#A1A1AA] mb-3" />
          <p className="text-[#71717A]">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E4E4E7] divide-y divide-[#E4E4E7]">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => router.push(`/clientes/${client.id}`)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#FAFAFA] transition-colors text-left"
            >
              <div className={`w-10 h-10 rounded-full ${getAvatarColor(client.name)} flex items-center justify-center text-white font-semibold text-sm`}>
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#18181B]">{client.name}</p>
                {client.cuit && (
                  <p className="text-xs text-[#A1A1AA] font-mono">{client.cuit}</p>
                )}
              </div>
              <div className="text-right mr-4">
                <p className="text-sm font-medium text-[#18181B]">
                  {client.despacho_count ?? 0}
                </p>
                <p className="text-xs text-[#A1A1AA]">despachos</p>
              </div>
              <ChevronRight size={16} className="text-[#A1A1AA]" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
