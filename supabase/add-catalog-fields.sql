-- Migration: Add LATU, IMESI, exonera_iva, apertura fields to product_catalog
-- Run manually in Supabase SQL Editor

ALTER TABLE product_catalog ADD COLUMN latu BOOLEAN DEFAULT NULL;
ALTER TABLE product_catalog ADD COLUMN imesi BOOLEAN DEFAULT NULL;
ALTER TABLE product_catalog ADD COLUMN exonera_iva BOOLEAN DEFAULT NULL;
ALTER TABLE product_catalog ADD COLUMN apertura NUMERIC DEFAULT NULL;
