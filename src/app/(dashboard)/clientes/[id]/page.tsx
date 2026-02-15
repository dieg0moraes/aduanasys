"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  FileText,
  Calendar,
  X,
} from "lucide-react";
import type { Client, Despacho } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    const res = await fetch(`/api/despachos?${params}`);
    if (res.ok) {
      setDespachos(await res.json());
    }
    setLoadingDespachos(false);
  }, [id, debouncedSearch, dateFrom, dateTo]);

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
      router.push("/");
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-1 text-sm text-[#71717A] hover:text-[#18181B] mb-4"
        >
          <ArrowLeft size={16} />
          Volver a Clientes
        </button>

        <div className="flex items-center justify-between">
          <div>
            {editing ? (
              <div className="flex items-center gap-3">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    placeholder="Nombre"
                  />
                  <input
                    type="text"
                    value={editCuit}
                    onChange={(e) => setEditCuit(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] block"
                    placeholder="CUIT (opcional)"
                  />
                </div>
                <button
                  onClick={handleSaveClient}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-sm hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(client.name);
                    setEditCuit(client.cuit || "");
                  }}
                  className="px-3 py-1.5 rounded-lg border text-sm text-[#71717A] hover:bg-[#FAFAFA]"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-[#18181B]">{client.name}</h1>
                {client.cuit && (
                  <p className="text-sm text-[#71717A] mt-1">CUIT: {client.cuit}</p>
                )}
              </div>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="p-2 rounded-lg border text-[#71717A] hover:bg-[#FAFAFA] hover:text-[#18181B] transition-colors"
                title="Editar cliente"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg border text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                title="Eliminar cliente"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-700">
            ¿Estás seguro de que querés eliminar este cliente? Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleDeleteClient}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 rounded-lg border text-sm text-[#71717A] hover:bg-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#18181B]">Despachos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B2A4A] text-white text-sm font-medium hover:bg-[#162240] transition-colors"
        >
          <Plus size={16} />
          Nuevo Despacho
        </button>
      </div>

      {/* New despacho form */}
      {showForm && (
        <form onSubmit={handleCreateDespacho} className="bg-white rounded-xl border border-[#E4E4E7] p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="Referencia del despacho"
            value={newReference}
            onChange={(e) => setNewReference(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
            autoFocus
          />
          <input
            type="text"
            placeholder="Notas (opcional)"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating || !newReference.trim()}
              className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : "Crear Despacho"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setNewReference(""); setNewNotes(""); }}
              className="px-4 py-2 rounded-lg border text-sm text-[#71717A] hover:bg-[#FAFAFA]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]" />
          <input
            type="text"
            placeholder="Buscar por referencia o DUA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-[#A1A1AA]" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            placeholder="Desde"
          />
          <span className="text-[#A1A1AA] text-sm">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            placeholder="Hasta"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#71717A] hover:bg-[#F4F4F5]"
              title="Limpiar fechas"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Despachos list */}
      {loadingDespachos ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-[#2563EB]" />
        </div>
      ) : despachos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-[#E4E4E7]">
          <FileText size={48} className="mx-auto text-[#A1A1AA] mb-4" />
          <p className="text-[#71717A]">
            {debouncedSearch || dateFrom || dateTo
              ? "No se encontraron despachos con esos filtros"
              : "Este cliente no tiene despachos todavía"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {despachos.map((despacho) => (
            <button
              key={despacho.id}
              onClick={() => router.push(`/despachos/${despacho.id}`)}
              className="w-full bg-white rounded-xl border border-[#E4E4E7] p-5 text-left hover:border-[#2563EB] hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[#18181B]">{despacho.reference}</p>
                  {despacho.customs_code && (
                    <p className="text-sm text-[#71717A] mt-0.5">
                      DUA: {despacho.customs_code}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-[#A1A1AA]">
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {despacho.invoice_count === 1
                        ? "1 factura"
                        : `${despacho.invoice_count || 0} facturas`}
                    </span>
                    <span>{formatDate(despacho.created_at)}</span>
                  </div>
                </div>
                {despacho.notes && (
                  <p className="text-xs text-[#A1A1AA] max-w-[200px] truncate">{despacho.notes}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
