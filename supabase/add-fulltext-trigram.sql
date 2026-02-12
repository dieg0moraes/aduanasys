-- ============================================
-- Agregar Full-Text Search + Trigram Similarity
-- para búsqueda multi-capa estilo MercadoLibre
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- 1. Habilitar extensión pg_trgm para fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Agregar columna tsvector para full-text search con stemming español
ALTER TABLE ncm_nomenclator ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 3. Poblar la columna search_vector con configuración en español
-- Esto permite que "perfume" matchee con "perfumes", "algodón" con "algodon", etc.
UPDATE ncm_nomenclator
SET search_vector = to_tsvector('spanish', coalesce(description, ''));

-- 4. Crear índice GIN para full-text search (rápido)
CREATE INDEX IF NOT EXISTS idx_ncm_search_vector
  ON ncm_nomenclator USING gin(search_vector);

-- 5. Crear índice GIN para trigram similarity (fuzzy match)
CREATE INDEX IF NOT EXISTS idx_ncm_description_trgm
  ON ncm_nomenclator USING gin(description gin_trgm_ops);

-- 6. Trigger para auto-actualizar tsvector en INSERT/UPDATE
CREATE OR REPLACE FUNCTION ncm_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish', coalesce(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ncm_search_vector ON ncm_nomenclator;
CREATE TRIGGER trg_ncm_search_vector
  BEFORE INSERT OR UPDATE ON ncm_nomenclator
  FOR EACH ROW EXECUTE FUNCTION ncm_search_vector_trigger();

-- 7. Función RPC: Full-text search con ranking
-- Usa stemming español: "perfume" matchea "perfumes", "televisor" matchea "televisores"
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

-- 8. Función RPC: Trigram similarity (fuzzy/soft match)
-- Encuentra matches parciales y con typos: "algdon" matchea "algodón"
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

-- 9. Hacer lo mismo para product_catalog
ALTER TABLE product_catalog ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE product_catalog
SET search_vector = to_tsvector('spanish',
  coalesce(provider_description, '') || ' ' ||
  coalesce(customs_description, '') || ' ' ||
  coalesce(sku, '')
);

CREATE INDEX IF NOT EXISTS idx_catalog_search_vector
  ON product_catalog USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_catalog_desc_trgm
  ON product_catalog USING gin(provider_description gin_trgm_ops);

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

DROP TRIGGER IF EXISTS trg_catalog_search_vector ON product_catalog;
CREATE TRIGGER trg_catalog_search_vector
  BEFORE INSERT OR UPDATE ON product_catalog
  FOR EACH ROW EXECUTE FUNCTION catalog_search_vector_trigger();

-- 10. Función RPC: búsqueda en catálogo con full-text
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
