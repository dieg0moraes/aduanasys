# Búsqueda de Mercadería — Diseño

## Problema

El cliente necesita buscar mercadería en la base y ver qué proveedores la traen y qué clientes (importadores) la importaron. Hoy la información existe pero está dispersa: hay que navegar proveedor por proveedor en el catálogo.

## Solución

Agregar una vista "Mercadería" dentro de la página de Catálogo (`/catalogo`) con:
- Barra de búsqueda rápida (tipo Google)
- Filtros avanzados colapsables (proveedor, NCM, cliente)
- Resultados como cards expandibles

## Fuente de datos

Solo `product_catalog` (datos aprobados y curados). Para obtener importadores se cruza:
- `product_catalog` → `providers` (proveedor directo)
- `product_catalog` → `invoice_items` (SKU + provider_id match) → `invoices` → `despachos` → `clients` (importadores)

## UI

### Navegación

Dos tabs en `/catalogo`:
1. **Proveedores** — vista actual (lista de proveedores con conteo de productos)
2. **Mercadería** — nueva vista de búsqueda

### Búsqueda

- Campo de texto busca en: `sku`, `provider_description`, `customs_description`, `internal_description`, `ncm_code`
- Usa `ilike` con patterns (ya hay índices trigram)
- Filtros avanzados (colapsables): proveedor (dropdown), NCM (text input), cliente (dropdown)
- Paginación

### Card de resultado

**Cerrado (una fila):**
- SKU, descripción del proveedor (truncada), NCM, nombre del proveedor, veces usado

**Expandido:**
- Descripción aduanera completa
- Descripción interna
- País de origen del proveedor
- Flags: LATU, IMESI, Exonera IVA, Apertura
- **Sección "Proveedores":** nombre, país
- **Sección "Importadores":** nombre del cliente, CUIT, referencia del despacho, fecha factura, cantidad

## Modelo de datos

No requiere cambios en la DB. Todo se resuelve con queries existentes + joins.

### Query principal (búsqueda)

```sql
SELECT pc.*, p.name AS provider_name, p.country AS provider_country
FROM product_catalog pc
LEFT JOIN providers p ON pc.provider_id = p.id
WHERE (
  pc.sku ILIKE '%query%'
  OR pc.provider_description ILIKE '%query%'
  OR pc.customs_description ILIKE '%query%'
  OR pc.internal_description ILIKE '%query%'
  OR pc.ncm_code ILIKE '%query%'
)
ORDER BY pc.times_used DESC, pc.last_used_at DESC
LIMIT 50 OFFSET 0
```

### Query de importadores (al expandir un card)

```sql
SELECT DISTINCT
  c.id, c.name, c.cuit,
  d.reference AS despacho_ref,
  inv.file_name,
  inv.created_at AS invoice_date,
  ii.quantity,
  ii.total_price,
  ii.currency
FROM invoice_items ii
JOIN invoices inv ON ii.invoice_id = inv.id
LEFT JOIN despachos d ON inv.despacho_id = d.id
LEFT JOIN clients c ON d.client_id = c.id
WHERE ii.sku = '<sku>'
  AND inv.provider_id = '<provider_id>'
ORDER BY inv.created_at DESC
```

## Archivos

### Nuevos
- `src/app/api/catalog/search/route.ts` — API de búsqueda con filtros
- `src/app/api/catalog/[id]/importers/route.ts` — API de importadores de un producto

### Modificar
- `src/app/(dashboard)/catalogo/page.tsx` — Agregar tabs y vista de mercadería
