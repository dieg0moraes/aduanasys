-- Migration: Add clients and despachos tables
-- Run manually in Supabase SQL Editor

CREATE TYPE despacho_status AS ENUM ('abierto', 'en_proceso', 'despachado', 'cerrado');

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  cuit VARCHAR(13),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

ALTER TABLE invoices ADD COLUMN despacho_id UUID REFERENCES despachos(id) ON DELETE SET NULL;

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_despachos_client ON despachos(client_id);
CREATE INDEX idx_despachos_status ON despachos(status);
CREATE INDEX idx_despachos_created ON despachos(created_at DESC);
CREATE INDEX idx_despachos_reference ON despachos(reference);
CREATE INDEX idx_invoices_despacho ON invoices(despacho_id);

CREATE TRIGGER trigger_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_despachos_updated_at BEFORE UPDATE ON despachos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE despachos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users full access" ON clients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON despachos FOR ALL USING (auth.role() = 'authenticated');
