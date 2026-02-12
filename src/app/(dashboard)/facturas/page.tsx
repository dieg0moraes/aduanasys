"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadZone } from "@/components/invoice/upload-zone";
import { InvoiceList } from "@/components/invoice/invoice-list";

function FacturasContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const showUpload = searchParams.get("action") === "upload";
  const despachoId = searchParams.get("despacho_id");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (despachoId) {
        formData.append("despacho_id", despachoId);
      }

      const response = await fetch("/api/invoices", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al subir la factura");
      }

      const data = await response.json();
      if (despachoId) {
        router.push(`/despachos/${despachoId}`);
      } else {
        router.push(`/facturas/${data.id}`);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Error desconocido"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturas</h1>
          <p className="text-gray-500 mt-1">
            {showUpload
              ? "Subí una factura para procesarla"
              : "Listado de facturas procesadas"}
          </p>
        </div>
        {!showUpload && (
          <button
            onClick={() => router.push("/facturas?action=upload")}
            className="px-4 py-2 rounded-lg bg-[#1B4F72] text-white text-sm font-medium hover:bg-[#154360] transition-colors"
          >
            + Nueva Factura
          </button>
        )}
      </div>

      {showUpload && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Subir Factura
          </h2>
          <UploadZone onUpload={handleUpload} isUploading={isUploading} />
          {uploadError && (
            <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
              {uploadError}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border p-6">
        <InvoiceList />
      </div>
    </div>
  );
}

export default function FacturasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-4" />
            <div className="h-4 bg-gray-100 rounded w-72" />
          </div>
        </div>
      }
    >
      <FacturasContent />
    </Suspense>
  );
}
