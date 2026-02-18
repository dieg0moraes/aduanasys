"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  Pencil,
  ChevronRight,
  X,
  Package,
} from "lucide-react";
import type { Client, Despacho } from "@/lib/types";
import { DESPACHO_STATUS_LABELS } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { KPICard } from "@/components/ui/kpi-card";

const STATUS_COLOR_MAP: Record<string, "success" | "warning" | "error" | "blue" | "gray"> = {
  abierto: "blue",
  en_proceso: "warning",
  despachado: "success",
  cerrado: "gray",
};

export default function ClientDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [client, setClient] = useState<Client | null>(null);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDespachos, setLoadingDespachos] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Active tab
  const [activeTab, setActiveTab] = useState<"despachos" | "facturas" | "notas">("despachos");

  // Edit client
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCuit, setEditCuit] = useState("");
  const [saving, setSaving] = useState(false);

  // New despacho
  const [showForm, setShowForm] = useState(false);
  const [newReference, setNewReference] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClient = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}`);
    if (res.ok) {
      const data = await res.json();
      setClient(data);
      setEditName(data.name);
      setEditCuit(data.cuit || "");
    }
    setLoading(false);
  }, [id]);

  const fetchDespachos = useCallback(async () => {
    setLoadingDespachos(true);
    const params = new URLSearchParams({ client_id: id });
    if (debouncedSearch) params.set("search", debouncedSearch);

    const res = await fetch(`/api/despachos?${params}`);
    if (res.ok) {
      setDespachos(await res.json());
    }
    setLoadingDespachos(false);
  }, [id, debouncedSearch]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  useEffect(() => {
    fetchDespachos();
  }, [fetchDespachos]);

  const handleSaveClient = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), cuit: editCuit.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setClient({ ...client!, ...data });
      setEditing(false);
    }
    setSaving(false);
  };

  const handleDeleteClient = async () => {
    setDeleting(true);
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/clientes");
    } else {
      const err = await res.json();
      alert(err.error || "Error al eliminar el cliente");
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleCreateDespacho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReference.trim()) return;
    setCreating(true);
    const res = await fetch("/api/despachos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference: newReference.trim(),
        client_id: id,
        notes: newNotes.trim() || null,
      }),
    });
    if (res.ok) {
      setNewReference("");
      setNewNotes("");
      setShowForm(false);
      fetchDespachos();
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#2563EB]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#71717A]">Cliente no encontrado</p>
      </div>
    );
  }

  const invoiceCount = despachos.reduce((sum, d) => sum + (d.invoice_count ?? d.invoices?.length ?? 0), 0);
  const lastDespacho = despachos.length > 0 ? despachos[0] : null;

  return (
    <div className="p-6 xl:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm mb-6">
        <button onClick={() => router.push("/clientes")} className="text-[#2563EB] font-medium hover:underline">
          Clientes
        </button>
        <span className="text-[#A1A1AA]">/</span>
        <span className="text-[#71717A] font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          {editing ? (
            <div className="flex items-center gap-3">
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  placeholder="Nombre"
                />
                <input
                  type="text"
                  value={editCuit}
                  onChange={(e) => setEditCuit(e.target.value)}
                  className="px-3 py-1.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] block"
                  placeholder="CUIT (opcional)"
                />
              </div>
              <button
                onClick={handleSaveClient}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditName(client.name);
                  setEditCuit(client.cuit || "");
                }}
                className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-[22px] font-bold text-[#18181B]">{client.name}</h1>
                <StatusBadge
                  label={(client.despacho_count ?? 0) > 0 ? "Activo" : "Inactivo"}
                  color={(client.despacho_count ?? 0) > 0 ? "success" : "gray"}
                />
              </div>
              <p className="text-sm text-[#71717A] mt-1">
                {client.cuit ? `CUIT: ${client.cuit} · ` : ""}Creado {formatDate(client.created_at)}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#E4E4E7] text-sm font-medium text-[#71717A] hover:bg-[#FAFAFA] transition-colors"
            >
              <Pencil size={16} />
              Editar
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border border-[#DC2626] text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
            >
              <Trash2 size={16} />
              Eliminar
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-[#FEF2F2] border border-[#DC2626]/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-[#DC2626]">
            ¿Estás seguro de que querés eliminar este cliente? Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDeleteClient}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-[#DC2626] text-white text-sm font-medium hover:bg-[#B91C1C] disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="Despachos" value={despachos.length} trend={{ value: `+${despachos.length}`, positive: true }} />
        <KPICard label="Facturas" value={invoiceCount} trend={{ value: `+${invoiceCount}`, positive: true }} />
        <KPICard
          label="En Revisión"
          value={despachos.filter((d) => d.status === "en_proceso" || d.status === "abierto").length}
        />
        <KPICard
          label="Último Despacho"
          value={lastDespacho ? formatDate(lastDespacho.created_at) : "—"}
        />
      </div>

      {/* Info fields */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div>
          <label className="block text-xs font-semibold text-[#71717A] mb-1.5">CUIT</label>
          <div className="h-10 px-3 bg-white border border-[#E4E4E7] rounded-lg flex items-center text-sm font-medium text-[#18181B]">
            {client.cuit || "—"}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#71717A] mb-1.5">Fecha de Creación</label>
          <div className="h-10 px-3 bg-white border border-[#E4E4E7] rounded-lg flex items-center text-sm text-[#18181B]">
            {formatDate(client.created_at)}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#71717A] mb-1.5">Última Actualización</label>
          <div className="h-10 px-3 bg-white border border-[#E4E4E7] rounded-lg flex items-center text-sm text-[#18181B]">
            {formatDate(client.updated_at)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b-2 border-[#E4E4E7] mb-6">
        {(["despachos", "facturas", "notas"] as const).map((tab) => {
          const labels = { despachos: `Despachos (${despachos.length})`, facturas: `Facturas (${invoiceCount})`, notas: "Notas" };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[#2563EB] font-semibold border-b-2 border-[#2563EB] -mb-[2px]"
                  : "text-[#71717A] hover:text-[#18181B]"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Tab content: Despachos */}
      {activeTab === "despachos" && (
        <>
          {/* Tab header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-[#18181B]">Despachos del cliente</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 h-9 px-3.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={16} />
              Nuevo Despacho
            </button>
          </div>

          {/* New despacho form */}
          {showForm && (
            <form onSubmit={handleCreateDespacho} className="bg-white rounded-xl border border-[#E4E4E7] p-5 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#71717A] mb-1.5">Referencia *</label>
                  <input
                    type="text"
                    placeholder="Referencia del despacho"
                    value={newReference}
                    onChange={(e) => setNewReference(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#71717A] mb-1.5">Notas</label>
                  <input
                    type="text"
                    placeholder="Notas (opcional)"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={creating || !newReference.trim()}
                  className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  Crear Despacho
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setNewReference(""); setNewNotes(""); }}
                  className="px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Search */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por referencia o DUA..."
                className="w-full pl-9 pr-4 py-2.5 border border-[#E4E4E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
              />
            </div>
          </div>

          {/* Despachos table */}
          {loadingDespachos ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#2563EB]" />
            </div>
          ) : despachos.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
              <Package size={40} className="mx-auto text-[#A1A1AA] mb-3" />
              <p className="text-[#71717A]">
                {debouncedSearch
                  ? "No se encontraron despachos con esos filtros"
                  : "Este cliente no tiene despachos todavía"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#71717A]">Referencia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] w-[140px]">DUA</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] w-[80px]">Facturas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] w-[120px]">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] w-[120px]">Estado</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E4E7]">
                  {despachos.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => router.push(`/despachos/${d.id}?from=cliente&client_id=${id}`)}
                      className="hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-[#18181B]">
                        {d.reference || `DES-${d.id.slice(0, 8)}`}
                      </td>
                      <td className="px-4 py-3 text-[#71717A] font-mono text-xs">
                        {d.customs_code || "—"}
                      </td>
                      <td className="px-4 py-3 text-[#71717A]">
                        {d.invoice_count ?? d.invoices?.length ?? 0}
                      </td>
                      <td className="px-4 py-3 text-[#71717A]">
                        {d.created_at ? formatDate(d.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={DESPACHO_STATUS_LABELS[d.status] || d.status}
                          color={STATUS_COLOR_MAP[d.status] || "gray"}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#A1A1AA]">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab content: Facturas (placeholder) */}
      {activeTab === "facturas" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
          <p className="text-[#71717A]">Las facturas del cliente se muestran dentro de cada despacho.</p>
        </div>
      )}

      {/* Tab content: Notas (placeholder) */}
      {activeTab === "notas" && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-12 text-center">
          <p className="text-[#71717A]">Las notas del cliente estarán disponibles próximamente.</p>
        </div>
      )}
    </div>
  );
}
