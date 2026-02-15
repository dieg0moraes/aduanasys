-- ============================================
-- AduanaSys - Consolidated Initial Migration
-- Combines all schema files into a single migration
-- for local Supabase development.
-- ============================================

-- ===========================================
-- 1. Extensions
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ===========================================
-- 2. Enum Types
-- ===========================================
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

CREATE TYPE despacho_status AS ENUM (
  'abierto',
  'en_proceso',
  'despachado',
  'cerrado'
);

CREATE TYPE document_type AS ENUM (
  'bl',
  'packing_list',
  'certificado_origen',
  'seguro',
  'permiso',
  'dua',
  'otro'
);

CREATE TYPE partida_status AS ENUM ('borrador', 'presentada', 'despachada');

-- ===========================================
-- 3. Tables
-- ===========================================

-- Providers
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  cuit VARCHAR(13),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Despachos
CREATE TABLE despachos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  customs_code VARCHAR(100),
  status despacho_status NOT NULL DEFAULT 'abierto',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices (includes despacho_id from add-clients-despachos + country_code from add-invoice-country)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  despacho_id UUID REFERENCES despachos(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  file_type file_type NOT NULL DEFAULT 'pdf_digital',
  status invoice_status NOT NULL DEFAULT 'uploaded',
  total_items INTEGER DEFAULT 0,
  items_auto_classified INTEGER DEFAULT 0,
  items_manually_corrected INTEGER DEFAULT 0,
  raw_extraction JSONB DEFAULT '{}',
  processing_error TEXT,
  country_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice Items (includes internal_description from add-internal-description)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  sku VARCHAR(255),
  original_description TEXT NOT NULL,
  customs_description TEXT,
  internal_description TEXT,
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

-- Product Catalog (includes internal_description, latu, imesi, exonera_iva, apertura, search_vector)
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  sku VARCHAR(255),
  provider_description TEXT NOT NULL,
  customs_description TEXT NOT NULL,
  internal_description TEXT,
  ncm_code VARCHAR(14) NOT NULL,
  latu BOOLEAN DEFAULT NULL,
  imesi BOOLEAN DEFAULT NULL,
  exonera_iva BOOLEAN DEFAULT NULL,
  apertura NUMERIC DEFAULT NULL,
  embedding VECTOR(1536),
  search_vector TSVECTOR,
  times_used INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider_id, sku)
);

-- NCM Nomenclator (includes search_vector)
CREATE TABLE ncm_nomenclator (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ncm_code VARCHAR(14) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  section VARCHAR(10),
  chapter VARCHAR(10),
  notes TEXT,
  embedding VECTOR(1536),
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Despacho Documents
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

-- Partidas (partial dispatches)
CREATE TABLE partidas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference VARCHAR(100) NOT NULL,
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  status partida_status NOT NULL DEFAULT 'borrador',
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partida Items
CREATE TABLE partida_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES invoice_items(id) ON DELETE RESTRICT,
  dispatch_quantity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partida_id, invoice_item_id)
);

-- ===========================================
-- 4. Indexes
-- ===========================================

-- Invoices
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_provider ON invoices(provider_id);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX idx_invoices_despacho ON invoices(despacho_id);

-- Invoice Items
CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_items_confidence ON invoice_items(confidence_level);

-- Product Catalog
CREATE INDEX idx_catalog_provider ON product_catalog(provider_id);
CREATE INDEX idx_catalog_sku ON product_catalog(provider_id, sku);
CREATE INDEX idx_catalog_ncm ON product_catalog(ncm_code);

-- NCM Nomenclator
-- Clients
CREATE INDEX idx_clients_name ON clients(name);

-- Despachos
CREATE INDEX idx_despachos_client ON despachos(client_id);
CREATE INDEX idx_despachos_status ON despachos(status);
CREATE INDEX idx_despachos_created ON despachos(created_at DESC);
CREATE INDEX idx_despachos_reference ON despachos(reference);

-- Despacho Documents
CREATE INDEX idx_despacho_docs_despacho ON despacho_documents(despacho_id);
CREATE INDEX idx_despacho_docs_type ON despacho_documents(document_type);

-- Partidas
CREATE INDEX idx_partidas_despacho ON partidas(despacho_id);
CREATE INDEX idx_partidas_invoice ON partidas(invoice_id);
CREATE INDEX idx_partidas_status ON partidas(status);
CREATE INDEX idx_partida_items_partida ON partida_items(partida_id);
CREATE INDEX idx_partida_items_invoice_item ON partida_items(invoice_item_id);

-- HNSW vector indexes for semantic search
CREATE INDEX idx_ncm_embedding ON ncm_nomenclator
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_catalog_embedding ON product_catalog
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- GIN indexes for full-text search
CREATE INDEX idx_ncm_search_vector ON ncm_nomenclator USING gin(search_vector);
CREATE INDEX idx_catalog_search_vector ON product_catalog USING gin(search_vector);

-- GIN indexes for trigram similarity
CREATE INDEX idx_ncm_description_trgm ON ncm_nomenclator USING gin(description gin_trgm_ops);
CREATE INDEX idx_catalog_desc_trgm ON product_catalog USING gin(provider_description gin_trgm_ops);

-- ===========================================
-- 5. RPC Functions
-- ===========================================

-- Semantic search on product_catalog
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

-- Semantic search on ncm_nomenclator
CREATE OR REPLACE FUNCTION search_ncm(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.30,
  match_count INT DEFAULT 10
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

-- Full-text search on ncm_nomenclator
CREATE OR REPLACE FUNCTION search_ncm_fulltext(
  search_query TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  ncm_code VARCHAR,
  description TEXT,
  section VARCHAR,
  chapter VARCHAR,
  rank FLOAT
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
    ts_rank_cd(n.search_vector, query)::FLOAT AS rank
  FROM ncm_nomenclator n,
       plainto_tsquery('spanish', search_query) query
  WHERE n.search_vector @@ query
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- Trigram similarity search on ncm_nomenclator
CREATE OR REPLACE FUNCTION search_ncm_trigram(
  search_query TEXT,
  match_threshold FLOAT DEFAULT 0.15,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  ncm_code VARCHAR,
  description TEXT,
  section VARCHAR,
  chapter VARCHAR,
  sim FLOAT
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
    similarity(n.description, search_query)::FLOAT AS sim
  FROM ncm_nomenclator n
  WHERE similarity(n.description, search_query) > match_threshold
  ORDER BY sim DESC
  LIMIT match_count;
END;
$$;

-- Full-text search on product_catalog
CREATE OR REPLACE FUNCTION search_catalog_fulltext(
  search_query TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  provider_id UUID,
  sku VARCHAR,
  provider_description TEXT,
  customs_description TEXT,
  ncm_code VARCHAR,
  rank FLOAT
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
    ts_rank_cd(pc.search_vector, query)::FLOAT AS rank
  FROM product_catalog pc,
       plainto_tsquery('spanish', search_query) query
  WHERE pc.search_vector @@ query
    AND pc.ncm_code IS NOT NULL
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;

-- ===========================================
-- 6. Triggers
-- ===========================================

-- Auto-update updated_at on row changes
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

CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_despachos_updated_at
  BEFORE UPDATE ON despachos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_despacho_docs_updated_at
  BEFORE UPDATE ON despacho_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_partidas_updated_at
  BEFORE UPDATE ON partidas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update search_vector on ncm_nomenclator
CREATE OR REPLACE FUNCTION ncm_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish', coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ncm_search_vector
  BEFORE INSERT OR UPDATE ON ncm_nomenclator
  FOR EACH ROW EXECUTE FUNCTION ncm_search_vector_trigger();

-- Auto-update search_vector on product_catalog
CREATE OR REPLACE FUNCTION catalog_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.provider_description, '') || ' ' ||
    coalesce(NEW.customs_description, '') || ' ' ||
    coalesce(NEW.sku, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_catalog_search_vector
  BEFORE INSERT OR UPDATE ON product_catalog
  FOR EACH ROW EXECUTE FUNCTION catalog_search_vector_trigger();

-- ===========================================
-- 7. Row Level Security
-- ===========================================

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncm_nomenclator ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE despachos ENABLE ROW LEVEL SECURITY;
ALTER TABLE despacho_documents ENABLE ROW LEVEL SECURITY;

-- Local dev: allow both authenticated and anon roles
CREATE POLICY "Full access" ON providers
  FOR ALL USING (true);

CREATE POLICY "Full access" ON invoices
  FOR ALL USING (true);

CREATE POLICY "Full access" ON invoice_items
  FOR ALL USING (true);

CREATE POLICY "Full access" ON product_catalog
  FOR ALL USING (true);

CREATE POLICY "Full access" ON ncm_nomenclator
  FOR ALL USING (true);

CREATE POLICY "Full access" ON clients
  FOR ALL USING (true);

CREATE POLICY "Full access" ON despachos
  FOR ALL USING (true);

CREATE POLICY "Full access" ON despacho_documents
  FOR ALL USING (true);

ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access" ON partidas
  FOR ALL USING (true);

CREATE POLICY "Full access" ON partida_items
  FOR ALL USING (true);

-- Storage policies: allow all access for local dev
CREATE POLICY "Allow all uploads"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all reads"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all deletes"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (true);
