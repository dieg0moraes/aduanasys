-- ============================================
-- Habilitar Realtime para la tabla invoices
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Agregar la tabla invoices a la publicación de Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
