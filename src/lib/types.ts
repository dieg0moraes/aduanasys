// ============================================
// Tipos TypeScript para AduanaSys
// ============================================

// --- Database types (matching Supabase schema) ---

export type InvoiceStatus =
  | "uploaded"
  | "processing"
  | "review"
  | "approved"
  | "exported";

export type FileType = "pdf_scan" | "pdf_digital" | "image" | "excel";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ClassificationSource =
  | "exact_match"
  | "semantic"
  | "llm_rag"
  | "manual";

export interface Provider {
  id: string;
  name: string;
  country: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  provider_id: string | null;
  file_url: string;
  file_name: string;
  file_type: FileType;
  status: InvoiceStatus;
  total_items: number;
  items_auto_classified: number;
  items_manually_corrected: number;
  raw_extraction: Record<string, unknown>;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  provider?: Provider | null;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  line_number: number;
  sku: string | null;
  original_description: string;
  customs_description: string | null;
  ncm_code: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  country_of_origin: string | null;
  confidence_level: ConfidenceLevel;
  classification_source: ClassificationSource;
  was_corrected: boolean;
  corrected_at: string | null;
  original_ncm_suggestion: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProductCatalog {
  id: string;
  provider_id: string | null;
  sku: string | null;
  provider_description: string;
  customs_description: string;
  ncm_code: string;
  embedding: number[] | null;
  times_used: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface NcmNomenclator {
  id: string;
  ncm_code: string;
  description: string;
  section: string | null;
  chapter: string | null;
  notes: string | null;
  embedding: number[] | null;
  created_at: string;
}

// --- Supabase Database interface ---

export interface Database {
  public: {
    Tables: {
      providers: {
        Row: Provider;
        Insert: Omit<Provider, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Provider, "id" | "created_at" | "updated_at">>;
      };
      invoices: {
        Row: Invoice;
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at" | "provider">;
        Update: Partial<
          Omit<Invoice, "id" | "created_at" | "updated_at" | "provider">
        >;
      };
      invoice_items: {
        Row: InvoiceItem;
        Insert: Omit<InvoiceItem, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<InvoiceItem, "id" | "created_at" | "updated_at">
        >;
      };
      product_catalog: {
        Row: ProductCatalog;
        Insert: Omit<ProductCatalog, "id" | "created_at" | "updated_at">;
        Update: Partial<
          Omit<ProductCatalog, "id" | "created_at" | "updated_at">
        >;
      };
      ncm_nomenclator: {
        Row: NcmNomenclator;
        Insert: Omit<NcmNomenclator, "id" | "created_at">;
        Update: Partial<Omit<NcmNomenclator, "id" | "created_at">>;
      };
    };
  };
}

// --- API Response types ---

export interface ExtractedItem {
  line_number: number;
  sku: string | null;
  original_description: string;
  suggested_customs_description: string | null;
  suggested_ncm_code: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string;
  country_of_origin: string | null;
}

export interface ExtractionResult {
  provider_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  currency: string;
  items: ExtractedItem[];
}

// --- UI types ---

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  uploaded: "Subida",
  processing: "Procesando",
  review: "En revisión",
  approved: "Aprobada",
  exported: "Exportada",
};

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  exported: "bg-purple-100 text-purple-700",
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};
