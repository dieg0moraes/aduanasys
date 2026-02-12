-- ============================================
-- AduanaSys MVP - Schema de Base de Datos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Enum types
CREATE TYPE invoice_status AS ENUM (
  'uploaded',
  'processing',
  'review',
  'approved',
  'exported'
);

CREATE TYPE file_type AS ENUM (
  'pdf_scan',
  'pdf_digital',
  'image',
  'excel'
);

CREATE TYPE confidence_level AS ENUM (
  'high',
  'medium',
  'low'
);

CREATE TYPE classification_source AS ENUM (
  'exact_match',
  'semantic',
  'llm_rag',
  'manual'
);

-- 3. Tabla de Proveedores
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de Facturas
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_type file_type NOT NULL DEFAULT 'pdf_digital',
  status invoice_status NOT NULL DEFAULT 'uploaded',
  total_items INTEGER DEFAULT 0,
  items_auto_classified INTEGER DEFAULT 0,
  items_manually_corrected INTEGER DEFAULT 0,
  raw_extraction JSONB DEFAULT '{}',
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla de Ítems de Factura
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  sku VARCHAR(255),
  original_description TEXT NOT NULL,
  customs_description TEXT,
  ncm_code VARCHAR(14),
  quantity DECIMAL(15, 4),
  unit_of_measure VARCHAR(50),
  unit_price DECIMAL(15, 4),
  total_price DECIMAL(15, 4),
  currency VARCHAR(10) DEFAULT 'USD',
  country_of_origin VARCHAR(100),
  confidence_level confidence_level DEFAULT 'low',
  classification_source classification_source DEFAULT 'manual',
  was_corrected BOOLEAN DEFAULT FALSE,
  corrected_at TIMESTAMPTZ,
  original_ncm_suggestion VARCHAR(14),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Catálogo de Productos (Base de conocimiento + Feedback Loop)
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  sku VARCHAR(255),
  provider_description TEXT NOT NULL,
  customs_description TEXT NOT NULL,
  ncm_code VARCHAR(14) NOT NULL,
  embedding VECTOR(1536),
  times_used INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un SKU por proveedor es único
  UNIQUE(provider_id, sku)
);

-- 7. Tabla del Nomenclador NCM (para RAG)
CREATE TABLE ncm_nomenclator (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ncm_code VARCHAR(14) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  section VARCHAR(10),
  chapter VARCHAR(10),
  notes TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Índices
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_provider ON invoices(provider_id);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);

CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_items_confidence ON invoice_items(confidence_level);

CREATE INDEX idx_catalog_provider ON product_catalog(provider_id);
CREATE INDEX idx_catalog_sku ON product_catalog(provider_id, sku);
CREATE INDEX idx_catalog_ncm ON product_catalog(ncm_code);

CREATE INDEX idx_ncm_code ON ncm_nomenclator(ncm_code);

-- 9. Índices vectoriales para búsqueda semántica
CREATE INDEX idx_catalog_embedding ON product_catalog
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_ncm_embedding ON ncm_nomenclator
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 10. Función para búsqueda semántica en el catálogo
CREATE OR REPLACE FUNCTION search_product_catalog(
  query_embedding VECTOR(1536),
  match_provider_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.78,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  provider_id UUID,
  sku VARCHAR,
  provider_description TEXT,
  customs_description TEXT,
  ncm_code VARCHAR,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.provider_id,
    pc.sku,
    pc.provider_description,
    pc.customs_description,
    pc.ncm_code,
    1 - (pc.embedding <=> query_embedding) AS similarity
  FROM product_catalog pc
  WHERE
    (match_provider_id IS NULL OR pc.provider_id = match_provider_id)
    AND 1 - (pc.embedding <=> query_embedding) > match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 11. Función para búsqueda semántica en el NCM
CREATE OR REPLACE FUNCTION search_ncm(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.70,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  ncm_code VARCHAR,
  description TEXT,
  section VARCHAR,
  chapter VARCHAR,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.ncm_code,
    n.description,
    n.section,
    n.chapter,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM ncm_nomenclator n
  WHERE 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 12. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_catalog_updated_at
  BEFORE UPDATE ON product_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 13. RLS (Row Level Security) - Básico para MVP
-- Habilitar RLS en todas las tablas
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncm_nomenclator ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para MVP (ajustar en producción)
-- Permite acceso completo a usuarios autenticados
CREATE POLICY "Authenticated users full access" ON providers
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON invoices
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON invoice_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON product_catalog
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access" ON ncm_nomenclator
  FOR ALL USING (auth.role() = 'authenticated');

-- 14. Storage bucket para facturas
-- NOTA: Crear manualmente en Supabase Dashboard:
-- Storage > New Bucket > "invoices" (público: no)
-- O ejecutar desde la API de Supabase

-- 15. Datos iniciales de ejemplo (opcional)
-- INSERT INTO providers (name, country) VALUES
--   ('Ejemplo Electronics Co.', 'China'),
--   ('Sample Import Ltd.', 'USA');
