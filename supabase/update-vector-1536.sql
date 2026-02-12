-- ============================================
-- Migrar columnas de embedding de VECTOR(768) a VECTOR(1536)
-- para usar OpenAI text-embedding-3-small
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Borrar índices vectoriales existentes
DROP INDEX IF EXISTS idx_catalog_embedding;
DROP INDEX IF EXISTS idx_ncm_embedding;

-- 2. Borrar funciones que referencian dimensión anterior
DROP FUNCTION IF EXISTS search_product_catalog;
DROP FUNCTION IF EXISTS search_ncm;

-- 3. Limpiar embeddings viejos (dimensión incompatible)
UPDATE product_catalog SET embedding = NULL;
UPDATE ncm_nomenclator SET embedding = NULL;

-- 4. Cambiar columnas de embedding a 1536 dimensiones
ALTER TABLE product_catalog ALTER COLUMN embedding TYPE VECTOR(1536);
ALTER TABLE ncm_nomenclator ALTER COLUMN embedding TYPE VECTOR(1536);

-- 5. Recrear índices vectoriales con 1536 dimensiones
-- Usamos HNSW en vez de IVFFlat — mejor para datasets <100k filas
CREATE INDEX idx_ncm_embedding ON ncm_nomenclator
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_catalog_embedding ON product_catalog
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 6. Recrear función de búsqueda en catálogo
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

-- 7. Recrear función de búsqueda en NCM
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
