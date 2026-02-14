# Partidas Parciales (Despacho Parcial de Facturas)

## Problema

Cuando se carga una factura con todos los items, no siempre se quieren despachar todos al mismo tiempo. El cliente necesita poder hacer envios parciales (partidas) con subsets de items o cantidades parciales de un item, y llevar control de que se despacho y que queda pendiente.

## Modelo de datos

### Tablas nuevas

```sql
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
```

### Relaciones

- Despacho 1:N Partidas
- Partida N:1 Factura (una partida siempre es de una sola factura)
- Partida 1:N Partida Items
- Partida Item N:1 Invoice Item
- Un invoice_item puede aparecer en varias partidas (con cantidades parciales)

### Validacion

`SUM(dispatch_quantity)` de todas las partidas de un invoice_item no debe superar la `quantity` original del item. Se valida en la app al crear/editar partida_items.

## Flujo de usuario

1. Cargan factura completa al despacho (flujo existente)
2. Desde la vista del despacho, crean una partida eligiendo una factura
3. En la pantalla de creacion, ven todos los items de la factura con:
   - Cantidad total
   - Cantidad ya despachada en otras partidas
   - Cantidad disponible
   - Checkbox para incluir + input numerico para cantidad (default = disponible)
4. Guardan la partida (estado: borrador)
5. Exportan el DUA de esa partida (Excel solo con items seleccionados)
6. Cambian estado: borrador -> presentada -> despachada
7. Crean otra partida con los items restantes cuando corresponda

## Export DUA por partida

- Endpoint: `GET /api/partidas/[id]/export-dua`
- Mismas columnas que el DUA actual (MERCADERIA, CANTIDAD, VALOR, UNIDAD, NCM, ORIGEN, DESCRIPCION DNA, ITEM)
- Solo incluye items de la partida con dispatch_quantity
- VALOR se recalcula proporcionalmente: `(dispatch_quantity / quantity) * total_price`
- ORIGEN usa country_of_origin de cada item
- El export por factura completa sigue existiendo

## UI

### Vista despacho (`/despachos/[id]`)

En la seccion de facturas vinculadas:
- Estado de despacho por factura: "Sin partidas", "Parcial (2/5 items)", "Completa"
- Boton "+ Nueva Partida" por factura
- Lista de partidas existentes con referencia, fecha, estado, cantidad de items

### Creacion de partida (`/despachos/[id]/partidas/nueva?invoice=xxx`)

- Header: referencia (auto "P-001"), fecha, notas
- Tabla de items de la factura con checkboxes + input de cantidad
- Muestra cantidad disponible (total - ya despachado)
- Boton "Crear Partida"

### Vista de partida (`/despachos/[id]/partidas/[partidaId]`)

- Datos editables (en borrador): referencia, fecha, notas
- Tabla de items con cantidades
- Boton "Exportar DUA"
- Cambio de estado: borrador -> presentada -> despachada

### Vista factura (`/facturas/[id]`)

- Columna "Despachado" en items table con progreso (ej: "50/100")
- Indicador general de progreso

## Archivos

### Nuevos

- `supabase/add-partidas.sql`
- `src/app/api/partidas/route.ts`
- `src/app/api/partidas/[id]/route.ts`
- `src/app/api/partidas/[id]/items/route.ts`
- `src/app/api/partidas/[id]/export-dua/route.ts`
- `src/app/(dashboard)/despachos/[id]/partidas/nueva/page.tsx`
- `src/app/(dashboard)/despachos/[id]/partidas/[partidaId]/page.tsx`

### Modificar

- `src/lib/types.ts` — interfaces Partida, PartidaItem, PartidaStatus
- `src/app/(dashboard)/despachos/[id]/page.tsx` — seccion partidas
- `src/app/(dashboard)/facturas/[id]/page.tsx` — progreso despacho
- `src/components/invoice/items-table.tsx` — columna "Despachado"
