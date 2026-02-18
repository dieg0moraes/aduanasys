"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { X, Upload, Loader2 } from "lucide-react";
import { UploadZone } from "@/components/invoice/upload-zone";
import type { UploadZoneHandle } from "@/components/invoice/upload-zone";
import { InvoiceList } from "@/components/invoice/invoice-list";

function UploadModal({
  open,
  onClose,
  despachoId,
}: {
  open: boolean;
  onClose: () => void;
  despachoId: string | null;
}) {
  const router = useRouter();
  const uploadRef = useRef<UploadZoneHandle>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);

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
      onClose();
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

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isUploading) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, isUploading]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isUploading) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl p-6 w-[480px] max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[#18181B]">
            Subir Factura
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 rounded-lg hover:bg-[#F4F4F5] text-[#71717A] disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Upload zone */}
        <UploadZone
          ref={uploadRef}
          onUpload={handleUpload}
          isUploading={isUploading}
          onFileChange={setHasFile}
        />

        {uploadError && (
          <div className="mt-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm">
            {uploadError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#E4E4E7]">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[#52525B] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => uploadRef.current?.triggerUpload()}
            disabled={isUploading || !hasFile}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <Upload size={16} />
                Subir y Procesar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function FacturasContent() {
  const searchParams = useSearchParams();
  const despachoId = searchParams.get("despacho_id");
  const [showModal, setShowModal] = useState(
    searchParams.get("action") === "upload"
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Facturas</h1>
          <p className="text-[#71717A] mt-1">
            Listado de facturas procesadas
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-[#1D4ED8] transition-colors flex items-center gap-2"
        >
          <Upload size={16} />
          Subir Factura
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E4E4E7] p-6">
        <InvoiceList />
      </div>

      <UploadModal
        open={showModal}
        onClose={handleCloseModal}
        despachoId={despachoId}
      />
    </div>
  );
}

export default function FacturasPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-[#E4E4E7] rounded w-48 mb-4" />
            <div className="h-4 bg-[#F4F4F5] rounded w-72" />
          </div>
        </div>
      }
    >
      <FacturasContent />
    </Suspense>
  );
}
