-- ============================================
-- Campo: internal_description
-- Descripción interna que usa el despachante para identificar la mercadería
-- ============================================

ALTER TABLE invoice_items ADD COLUMN internal_description TEXT;
ALTER TABLE product_catalog ADD COLUMN internal_description TEXT;
