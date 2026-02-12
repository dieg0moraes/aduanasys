-- ============================================
-- Campo: country_code en invoices
-- Código numérico DUA del país de origen de la factura
-- ============================================

ALTER TABLE invoices ADD COLUMN country_code INTEGER;
