# Crear Mercadería Manual en Catálogo — Diseño

## Problema

Hoy la única forma de agregar productos al catálogo es procesando y aprobando una factura. A veces se necesita cargar mercadería directamente sin tener una factura.

## Solución

Agregar un botón "Nueva Mercadería" en la pestaña Mercadería de `/catalogo` que abre un modal con formulario de creación.

## Formulario

Campos:
- **Proveedor** (obligatorio) — dropdown con búsqueda + crear nuevo (mismo patrón que en facturas)
- **SKU** (obligatorio) — texto
- **Descripción del proveedor** (obligatorio) — texto
- **Descripción aduanera** (opcional) — textarea
- **Descripción interna** (opcional) — textarea
- **NCM** (opcional) — texto con búsqueda NCM (reutilizar NCM picker)
- **País de origen** (opcional) — selector de país
- **LATU** (opcional) — Sí/No/—
- **IMESI** (opcional) — Sí/No/—
- **Exonera IVA** (opcional) — Sí/No/—
- **Apertura** (opcional) — número

## Backend

POST a `/api/catalog` que inserta en `product_catalog`. Valida que no exista `(provider_id, sku)` duplicado (unique constraint, retorna 409).

## UI

Modal sobre la pestaña Mercadería para mantener el contexto de búsqueda. Al guardar exitosamente, cierra el modal y refresca los resultados.

## Lo que NO cambia

- El flujo de aprobación de facturas sigue alimentando el catálogo
- La estructura de `product_catalog` no cambia
- Los productos creados manualmente son idénticos a los de facturas

## Archivos

### Nuevo
- Nada (se reutiliza `/api/catalog` agregando POST)

### Modificar
- `src/app/api/catalog/route.ts` — agregar POST handler
- `src/components/catalog/mercaderia-search.tsx` — agregar botón + modal de creación
