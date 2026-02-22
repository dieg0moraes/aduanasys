-- Migration: Add country_of_origin to product_catalog
ALTER TABLE product_catalog ADD COLUMN country_of_origin VARCHAR(100) DEFAULT NULL;
