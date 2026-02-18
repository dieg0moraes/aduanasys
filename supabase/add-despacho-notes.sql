CREATE TABLE despacho_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  despacho_id UUID NOT NULL REFERENCES despachos(id) ON DELETE CASCADE,
  author_name VARCHAR(255) NOT NULL DEFAULT 'Usuario',
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despacho_notes_despacho_id ON despacho_notes(despacho_id);
