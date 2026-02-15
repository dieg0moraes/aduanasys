# Fecha y Número de Factura — Diseño

## Problema

Claude extrae `invoice_date` e `invoice_number` del PDF y los guarda en `raw_extraction` (JSONB), pero no tienen columnas dedicadas en la DB ni se muestran en la UI. El único dato temporal visible es `created_at` (fecha de subida al sistema), no la fecha impresa en la factura.

## Solución

### DB

Agregar dos columnas a `invoices`:
- `invoice_date` (DATE, nullable) — fecha impresa en la factura comercial
- `invoice_number` (VARCHAR(100), nullable) — número de factura

### Procesamiento

En `src/app/api/invoices/[id]/process/route.ts`, al guardar los resultados de la extracción, copiar `invoice_date` e `invoice_number` de la extracción a las nuevas columnas.

### UI — Detalle de factura

En `src/app/(dashboard)/facturas/[id]/page.tsx`, agregar un card con los dos campos:
- `invoice_number` — input text, editable en estados `uploaded`/`review`
- `invoice_date` — input type date, editable en estados `uploaded`/`review`
- Se guardan con PATCH a `/api/invoices/[id]`
- En estados `approved`/`exported` se muestran como solo lectura

Ubicación: junto al card de proveedor y país de origen.

### UI — Lista de facturas

En `src/components/invoice/invoice-list.tsx`:
- Mostrar `invoice_number` junto al nombre del archivo
- Mostrar `invoice_date` además de `created_at`

## Fuente de datos

- Extracción: `HEADER_PROMPT` en `src/lib/claude.ts` ya extrae `invoice_date` e `invoice_number`
- Tipo: `ExtractionResult` en `src/lib/types.ts` ya incluye ambos campos

## Lo que NO cambia

- El prompt de Claude (ya extrae estos campos)
- `raw_extraction` sigue guardando todo el JSON
- La lógica de clasificación NCM
- El tipo `ExtractionResult`

## Archivos

### DB
- Migración SQL: `ALTER TABLE invoices ADD COLUMN invoice_date DATE, ADD COLUMN invoice_number VARCHAR(100)`

### Modificar
- `src/lib/types.ts` — Agregar `invoice_date` e `invoice_number` a la interfaz `Invoice`
- `src/app/api/invoices/[id]/process/route.ts` — Guardar los campos extraídos en las nuevas columnas
- `src/app/(dashboard)/facturas/[id]/page.tsx` — Mostrar y editar los campos
- `src/components/invoice/invoice-list.tsx` — Mostrar en la lista
