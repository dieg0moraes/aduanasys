-- ============================================
-- Tabla: despacho_documents
-- Documentos asociados a despachos (BL, Packing List, etc.)
-- ============================================

CREATE TYPE document_type AS ENUM (
  'bl', 'packing_list', 'certificado_origen',
  'seguro', 'permiso', 'dua', 'otro'
);

CREATE TABLE despacho_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  label VARCHAR(255),
  file_name VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despacho_docs_despacho ON despacho_documents(despacho_id);
CREATE INDEX idx_despacho_docs_type ON despacho_documents(document_type);

CREATE TRIGGER trigger_despacho_docs_updated_at
  BEFORE UPDATE ON despacho_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE despacho_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access"
  ON despacho_documents FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- Storage bucket: documents
-- ============================================

-- Crear bucket (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para usuarios autenticados
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can read documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'documents');
