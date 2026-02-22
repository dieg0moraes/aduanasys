"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Upload,
  Download,
  Loader2,
  Plus,
  Building2,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ArrowLeft,
} from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { parseExcelBuffer, generateTemplate } from "@/lib/excel-import";
import type { ImportRow } from "@/lib/excel-import";

// ============================================
// Stepper
// ============================================

const STEPS = ["Proveedor", "Archivo", "Revisión"] as const;

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-12 h-0.5 ${
                  done ? "bg-[#2563EB]" : "bg-[#E4E4E7]"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  done
                    ? "bg-[#2563EB] text-white"
                    : active
                    ? "bg-[#2563EB] text-white"
                    : "bg-[#F4F4F5] text-[#A1A1AA]"
                }`}
              >
                {done ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span
                className={`text-xs font-medium ${
                  active ? "text-[#2563EB]" : done ? "text-[#18181B]" : "text-[#A1A1AA]"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function ImportarPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-[#2563EB]" /></div>}>
      <ImportarPageContent />
    </Suspense>
  );
}

function ImportarPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const presetProviderId = searchParams.get("provider") || "";

  const [step, setStep] = useState(0);

  // --- Provider state ---
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  // --- File / parse state ---
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Submit state ---
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  // =====================
  // Auto-advance from URL param
  // =====================
  useEffect(() => {
    if (!presetProviderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/providers?search=`);
        if (!res.ok) return;
        const data = await res.json();
        const match = (data.providers || []).find(
          (p: { id: string }) => p.id === presetProviderId
        );
        if (match) {
          setProviderId(match.id);
          setProviderName(match.name);
          setStep(1);
        }
      } catch {
        // ignore
      }
    })();
  }, [presetProviderId]);

  // =====================
  // Provider search
  // =====================
  useEffect(() => {
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
  }, [showProviderDropdown, providerSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProviderDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCreateProvider = async () => {
    if (!providerSearch.trim()) return;
    setCreatingProvider(true);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: providerSearch.trim() }),
      });
      if (res.ok) {
        const provider = await res.json();
        setProviderId(provider.id);
        setProviderName(provider.name);
        setShowProviderDropdown(false);
        setProviderSearch("");
      }
    } catch {
      // ignore
    }
    setCreatingProvider(false);
  };

  // =====================
  // File handling
  // =====================
  const handleFile = useCallback(
    async (file: File) => {
      setParseError(null);
      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseExcelBuffer(buffer);

        if (parsed.length === 0) {
          setParseError(
            "El archivo no contiene filas válidas. Verificá que tenga los encabezados correctos."
          );
          return;
        }

        // Check duplicates against existing catalog
        let existingSkus = new Set<string>();
        try {
          const res = await fetch(
            `/api/catalog?provider_id=${providerId}&limit=9999`
          );
          if (res.ok) {
            const data = await res.json();
            existingSkus = new Set(
              (data.items || [])
                .map((p: { sku: string | null }) => p.sku?.toUpperCase())
                .filter(Boolean)
            );
          }
        } catch {
          // continue without duplicate check
        }

        const updatedRows = parsed.map((row) => {
          if (
            row.status !== "error" &&
            row.sku &&
            existingSkus.has(row.sku.toUpperCase()) &&
            row.status !== "duplicate" // already marked as in-file duplicate
          ) {
            return {
              ...row,
              status: "duplicate" as const,
              action: "skip" as const,
              warnings: [...row.warnings, "SKU ya existe en el catálogo"],
            };
          }
          return row;
        });

        setRows(updatedRows);
        setStep(2);
      } catch {
        setParseError("Error al leer el archivo. Asegurate de que sea un archivo Excel válido.");
      }
    },
    [providerId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDownloadTemplate = () => {
    const buffer = generateTemplate();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_mercaderia.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  // =====================
  // Row selection
  // =====================
  const toggleRow = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index && r.status !== "error" ? { ...r, selected: !r.selected } : r
      )
    );
  };

  const toggleAll = () => {
    const selectableRows = rows.filter((r) => r.status !== "error");
    const allSelected = selectableRows.every((r) => r.selected);
    setRows((prev) =>
      prev.map((r) =>
        r.status !== "error" ? { ...r, selected: !allSelected } : r
      )
    );
  };

  const toggleDuplicateAction = (index: number) => {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index || r.status !== "duplicate") return r;
        return {
          ...r,
          action: r.action === "skip" ? ("update" as const) : ("skip" as const),
          selected: r.action === "skip", // selecting if switching to update
        };
      })
    );
  };

  // =====================
  // Submit
  // =====================
  const selectedRows = rows.filter((r) => r.selected && r.status !== "error");

  const handleSubmit = async () => {
    if (selectedRows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          items: selectedRows.map((r) => ({
            sku: r.sku,
            provider_description: r.provider_description,
            customs_description: r.customs_description || undefined,
            internal_description: r.internal_description || undefined,
            ncm_code: r.ncm_code || undefined,
            country_of_origin: r.country_of_origin || undefined,
            apertura: r.apertura ?? undefined,
            action: r.action,
          })),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      } else {
        const data = await res.json();
        setResult({ created: 0, updated: 0, skipped: 0, errors: [data.error || "Error del servidor"] });
      }
    } catch {
      setResult({ created: 0, updated: 0, skipped: 0, errors: ["Error de red"] });
    }
    setSubmitting(false);
  };

  // =====================
  // Counts
  // =====================
  const counts = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    errors: rows.filter((r) => r.status === "error").length,
    warnings: rows.filter((r) => r.status === "warning").length,
    duplicates: rows.filter((r) => r.status === "duplicate").length,
  };

  // =====================
  // Render
  // =====================
  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "Catálogo", href: "/catalogo" },
          { label: "Importar Mercadería" },
        ]}
      />

      <h1 className="text-2xl font-bold text-[#18181B] mt-4 mb-6">
        Importar Mercadería
      </h1>

      {/* Stepper */}
      <div className="mb-8">
        <Stepper current={step} />
      </div>

      {/* ===================== STEP 0: Provider ===================== */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 max-w-lg mx-auto">
          <h2 className="text-lg font-semibold text-[#18181B] mb-4">
            Seleccioná un proveedor
          </h2>

          <div ref={providerDropdownRef}>
            <label className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
              Proveedor *
            </label>
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
                        <Loader2
                          size={14}
                          className="animate-spin text-[#2563EB]"
                        />
                      </div>
                    ) : (
                      <>
                        {providers.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setProviderId(p.id);
                              setProviderName(p.name);
                              setShowProviderDropdown(false);
                              setProviderSearch("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#EFF6FF] ${
                              providerId === p.id
                                ? "bg-[#EFF6FF] font-medium"
                                : ""
                            }`}
                          >
                            {p.name}
                          </button>
                        ))}
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
                  {providerName ? (
                    <span className="text-[#18181B]">{providerName}</span>
                  ) : (
                    <span className="text-[#A1A1AA]">
                      Seleccionar proveedor
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              disabled={!providerId}
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===================== STEP 1: File Upload ===================== */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 max-w-lg mx-auto">
          <h2 className="text-lg font-semibold text-[#18181B] mb-1">
            Subir archivo Excel
          </h2>
          <p className="text-sm text-[#71717A] mb-4">
            Proveedor: <span className="font-medium text-[#18181B]">{providerName}</span>
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragging
                ? "border-[#2563EB] bg-[#EFF6FF]"
                : "border-[#E4E4E7] hover:border-[#A1A1AA]"
            }`}
          >
            <Upload
              size={32}
              className={dragging ? "text-[#2563EB]" : "text-[#A1A1AA]"}
            />
            <p className="text-sm text-[#71717A] text-center">
              Arrastrá tu archivo Excel o hacé click para seleccionar
            </p>
            <p className="text-xs text-[#A1A1AA]">.xlsx, .xls</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>

          {parseError && (
            <div className="mt-4 p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg flex items-start gap-2">
              <AlertCircle size={16} className="text-[#DC2626] mt-0.5 shrink-0" />
              <p className="text-sm text-[#DC2626]">{parseError}</p>
            </div>
          )}

          {/* Template download */}
          <button
            onClick={handleDownloadTemplate}
            className="mt-4 flex items-center gap-2 text-sm text-[#2563EB] hover:underline"
          >
            <Download size={14} />
            Descargar template
          </button>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(0)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
          </div>
        </div>
      )}

      {/* ===================== STEP 2: Preview ===================== */}
      {step === 2 && !result && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-[#18181B]">
                {counts.total} productos
              </span>
              {counts.duplicates > 0 && (
                <span className="text-[#2563EB]">
                  {counts.duplicates} duplicados
                </span>
              )}
              {counts.errors > 0 && (
                <span className="text-[#DC2626]">
                  {counts.errors} errores
                </span>
              )}
              {counts.warnings > 0 && (
                <span className="text-[#D97706]">
                  {counts.warnings} advertencias
                </span>
              )}
            </div>
            <p className="text-sm text-[#71717A]">
              Proveedor: <span className="font-medium text-[#18181B]">{providerName}</span>
            </p>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E4E4E7] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                    <th className="px-3 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={
                          rows.filter((r) => r.status !== "error").length > 0 &&
                          rows
                            .filter((r) => r.status !== "error")
                            .every((r) => r.selected)
                        }
                        onChange={toggleAll}
                        className="rounded border-[#D4D4D8]"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      Fila
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      SKU
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      Desc. Comercial
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      Desc. Aduanera
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      NCM
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      País
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      Apertura
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-[#71717A] uppercase tracking-wide">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-[#F4F4F5] ${
                        row.status === "error" ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={row.status === "error"}
                          onChange={() => toggleRow(i)}
                          className="rounded border-[#D4D4D8]"
                        />
                      </td>
                      <td className="px-3 py-2 text-[#71717A]">
                        {row.rowNumber}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.sku || "-"}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {row.provider_description || "-"}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">
                        {row.customs_description || "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.ncm_code || "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.country_of_origin || "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.apertura ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill row={row} onToggleDuplicate={() => toggleDuplicateAction(i)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setRows([]);
                setStep(1);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E4E4E7] text-sm text-[#71717A] hover:bg-[#FAFAFA]"
            >
              <ChevronLeft size={16} />
              Volver
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting
                ? "Importando..."
                : `Cargar ${selectedRows.length} productos`}
            </button>
          </div>
        </div>
      )}

      {/* ===================== Result ===================== */}
      {result && (
        <div className="bg-white rounded-xl border border-[#E4E4E7] p-6 max-w-lg mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#F0FDF4] flex items-center justify-center mx-auto">
            <CheckCircle2 size={24} className="text-[#16A34A]" />
          </div>
          <h2 className="text-lg font-semibold text-[#18181B]">
            Importación finalizada
          </h2>

          <div className="grid grid-cols-2 gap-3 text-sm max-w-xs mx-auto">
            <div className="bg-[#F0FDF4] rounded-lg p-3">
              <p className="text-2xl font-bold text-[#16A34A]">{result.created}</p>
              <p className="text-[#71717A]">Creados</p>
            </div>
            <div className="bg-[#EFF6FF] rounded-lg p-3">
              <p className="text-2xl font-bold text-[#2563EB]">{result.updated}</p>
              <p className="text-[#71717A]">Actualizados</p>
            </div>
            <div className="bg-[#F4F4F5] rounded-lg p-3">
              <p className="text-2xl font-bold text-[#71717A]">{result.skipped}</p>
              <p className="text-[#71717A]">Saltados</p>
            </div>
            <div className="bg-[#FEF2F2] rounded-lg p-3">
              <p className="text-2xl font-bold text-[#DC2626]">
                {result.errors.length}
              </p>
              <p className="text-[#71717A]">Errores</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="text-left bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3 text-sm text-[#DC2626] space-y-1">
              {result.errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push(providerId ? `/catalogo/${providerId}` : "/catalogo")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8]"
          >
            <ArrowLeft size={14} />
            Volver al catálogo
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// StatusPill sub-component
// ============================================

function StatusPill({
  row,
  onToggleDuplicate,
}: {
  row: ImportRow;
  onToggleDuplicate: () => void;
}) {
  if (row.status === "error") {
    return (
      <div>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">
          Error
        </span>
        {row.errors.length > 0 && (
          <p className="text-xs text-[#DC2626] mt-0.5">{row.errors[0]}</p>
        )}
      </div>
    );
  }
  if (row.status === "warning") {
    return (
      <div>
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
          Advertencia
        </span>
        {row.warnings.length > 0 && (
          <p className="text-xs text-[#D97706] mt-0.5">{row.warnings[0]}</p>
        )}
      </div>
    );
  }
  if (row.status === "duplicate") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
          Duplicado
        </span>
        <button
          type="button"
          onClick={onToggleDuplicate}
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            row.action === "update"
              ? "bg-[#2563EB] text-white"
              : "bg-[#F4F4F5] text-[#71717A] hover:bg-[#E4E4E7]"
          }`}
        >
          {row.action === "update" ? "Actualizar" : "Saltar"}
        </button>
      </div>
    );
  }
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F0FDF4] text-[#16A34A]">
      OK
    </span>
  );
}
