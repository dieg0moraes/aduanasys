"use client";

import { useState, useCallback, useRef, useImperativeHandle, useEffect, forwardRef } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  onFileChange?: (hasFile: boolean) => void;
}

export interface UploadZoneHandle {
  triggerUpload: () => Promise<void>;
  hasFile: boolean;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
];

export const UploadZone = forwardRef<UploadZoneHandle, UploadZoneProps>(
  function UploadZone({ onUpload, isUploading, onFileChange }, ref) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = useCallback((file: File): boolean => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(
          "Formato no soportado. Usá PDF, imágenes (JPG, PNG) o Excel (XLSX, CSV)."
        );
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError("El archivo es demasiado grande. Máximo 50MB.");
        return false;
      }
      setError(null);
      return true;
    }, []);

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && validateFile(file)) {
          setSelectedFile(file);
        }
      },
      [validateFile]
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        setSelectedFile(file);
      }
    };

    const handleUpload = async () => {
      if (!selectedFile) return;
      await onUpload(selectedFile);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    };

    const clearFile = () => {
      setSelectedFile(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    };

    useImperativeHandle(ref, () => ({
      triggerUpload: handleUpload,
      hasFile: !!selectedFile,
    }));

    // Notify parent of file selection changes
    useEffect(() => {
      onFileChange?.(!!selectedFile);
    }, [selectedFile, onFileChange]);

    return (
      <div className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-[#2563EB] bg-[#EFF6FF]"
              : selectedFile
              ? "border-green-300 bg-green-50"
              : "border-gray-300 hover:border-[#2563EB] hover:bg-[#EFF6FF]/50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          {selectedFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-3">
                <FileText className="text-green-600" size={32} />
                <div className="text-left">
                  <p className="font-medium text-gray-900">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                  className="ml-4 p-1 rounded-full hover:bg-gray-200"
                >
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="mx-auto text-gray-400" size={40} />
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Arrastrá la factura acá
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  o hacé click para seleccionar un archivo
                </p>
              </div>
              <p className="text-xs text-gray-400">
                PDF, JPG, PNG, XLSX, CSV — Máximo 50MB
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {isUploading && (
          <div className="flex items-center justify-center gap-2 text-sm text-[#71717A]">
            <Loader2 size={16} className="animate-spin" />
            Procesando factura...
          </div>
        )}
      </div>
    );
  }
);
