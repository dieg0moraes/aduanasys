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

export type DespachoStatus = "abierto" | "en_proceso" | "despachado" | "cerrado";

export type DocumentType = 'bl' | 'packing_list' | 'certificado_origen' | 'seguro' | 'permiso' | 'dua' | 'otro';

export type PartidaStatus = "borrador" | "presentada" | "despachada";

export interface Client {
  id: string;
  name: string;
  cuit: string | null;
  created_at: string;
  updated_at: string;
  // Aggregated
  despacho_count?: number;
}

export interface Despacho {
  id: string;
  reference: string;
  client_id: string;
  customs_code: string | null;
  status: DespachoStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  client?: Client | null;
  invoices?: Invoice[];
  invoice_count?: number;
}

export interface Partida {
  id: string;
  reference: string;
  despacho_id: string;
  invoice_id: string;
  status: PartidaStatus;
  date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  invoice?: Invoice | null;
  items?: PartidaItem[];
  item_count?: number;
}

export interface PartidaItem {
  id: string;
  partida_id: string;
  invoice_item_id: string;
  dispatch_quantity: number;
  created_at: string;
  // Joined
  invoice_item?: InvoiceItem | null;
}

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
  country_code: number | null;
  created_at: string;
  despacho_id: string | null;
  updated_at: string;
  // Joined
  provider?: Provider | null;
  despacho?: Despacho | null;
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
  internal_description: string | null;
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
  latu: boolean | null;
  imesi: boolean | null;
  exonera_iva: boolean | null;
  apertura: number | null;
  internal_description: string | null;
  embedding: number[] | null;
  times_used: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export interface DespachoDocument {
  id: string;
  despacho_id: string;
  document_type: DocumentType;
  label: string | null;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  notes: string | null;
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
        Insert: Omit<Invoice, "id" | "created_at" | "updated_at" | "provider" | "despacho">;
        Update: Partial<
          Omit<Invoice, "id" | "created_at" | "updated_at" | "provider" | "despacho">
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
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at" | "despacho_count">;
        Update: Partial<Omit<Client, "id" | "created_at" | "updated_at" | "despacho_count">>;
      };
      despachos: {
        Row: Despacho;
        Insert: Omit<Despacho, "id" | "created_at" | "updated_at" | "client" | "invoices" | "invoice_count">;
        Update: Partial<Omit<Despacho, "id" | "created_at" | "updated_at" | "client" | "invoices" | "invoice_count">>;
      };
      despacho_documents: {
        Row: DespachoDocument;
        Insert: Omit<DespachoDocument, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DespachoDocument, "id" | "created_at" | "updated_at">>;
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

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bl: 'BL/AWB',
  packing_list: 'Packing List',
  certificado_origen: 'Certificado de Origen',
  seguro: 'Seguro',
  permiso: 'Permiso',
  dua: 'DUA',
  otro: 'Otro',
};

export const DOCUMENT_TYPE_COLORS: Record<DocumentType, string> = {
  bl: 'bg-blue-100 text-blue-700',
  packing_list: 'bg-emerald-100 text-emerald-700',
  certificado_origen: 'bg-orange-100 text-orange-700',
  seguro: 'bg-purple-100 text-purple-700',
  permiso: 'bg-pink-100 text-pink-700',
  dua: 'bg-indigo-100 text-indigo-700',
  otro: 'bg-gray-100 text-gray-700',
};

export const DESPACHO_STATUS_LABELS: Record<DespachoStatus, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  despachado: "Despachado",
  cerrado: "Cerrado",
};

export const DESPACHO_STATUS_COLORS: Record<DespachoStatus, string> = {
  abierto: "bg-blue-100 text-blue-700",
  en_proceso: "bg-yellow-100 text-yellow-700",
  despachado: "bg-green-100 text-green-700",
  cerrado: "bg-gray-100 text-gray-700",
};

export const PARTIDA_STATUS_LABELS: Record<PartidaStatus, string> = {
  borrador: "Borrador",
  presentada: "Presentada",
  despachada: "Despachada",
};

export const PARTIDA_STATUS_COLORS: Record<PartidaStatus, string> = {
  borrador: "bg-gray-100 text-gray-700",
  presentada: "bg-blue-100 text-blue-700",
  despachada: "bg-green-100 text-green-700",
};
