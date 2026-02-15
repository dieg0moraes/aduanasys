-- Migration: Add partidas (partial dispatch) tables
-- Run manually in Supabase SQL Editor

CREATE TYPE partida_status AS ENUM ('borrador', 'presentada', 'despachada');

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

CREATE TABLE partida_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partida_id UUID NOT NULL REFERENCES partidas(id) ON DELETE CASCADE,
  invoice_item_id UUID NOT NULL REFERENCES invoice_items(id) ON DELETE RESTRICT,
  dispatch_quantity NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partida_id, invoice_item_id)
);

CREATE INDEX idx_partidas_despacho ON partidas(despacho_id);
CREATE INDEX idx_partidas_invoice ON partidas(invoice_id);
CREATE INDEX idx_partidas_status ON partidas(status);
CREATE INDEX idx_partida_items_partida ON partida_items(partida_id);
CREATE INDEX idx_partida_items_invoice_item ON partida_items(invoice_item_id);

CREATE TRIGGER trigger_partidas_updated_at BEFORE UPDATE ON partidas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE partida_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON partidas FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON partida_items FOR ALL USING (auth.role() = 'authenticated');
