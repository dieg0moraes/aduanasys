# Editar Proveedor de Factura — Diseño

## Problema

Cuando Claude Vision extrae una factura, a veces el nombre del proveedor no se detecta correctamente, generando un proveedor duplicado o incorrecto. Actualmente no hay forma de corregir el proveedor asignado a una factura antes de aprobarla, ni de mover productos entre proveedores en el catálogo.

## Solución

Dos funcionalidades:

### Parte 1: Selector de proveedor en factura

En la página de detalle de factura (`/facturas/[id]`), agregar un selector editable de proveedor:

- **Cuándo:** Solo en estados `uploaded` y `review` (antes de aprobar)
- **UI:** Dropdown con búsqueda (reutiliza patrón del selector de país que ya existe en la misma página)
- **Opciones:** Lista de proveedores existentes + opción "Crear nuevo"
- **Al cambiar:** PATCH a `/api/invoices/[id]` con nuevo `provider_id`
- **Crear nuevo:** Input para nombre, POST a `/api/providers`, luego asigna el nuevo proveedor

### Parte 2: Mover productos en catálogo

En la página de detalle del proveedor (`/catalogo/[providerId]`), agregar botón para mover un producto individual a otro proveedor:

- **UI:** Botón "Mover" por producto → dropdown de proveedores destino
- **Al mover:** PATCH a `/api/catalog` con nuevo `provider_id`
- **Validación:** Si ya existe `(provider_id, sku)` en destino, avisar y no permitir (constraint unique)

## Fuente de datos

- Proveedores: `GET /api/providers?search=...` (ya existe)
- Actualizar factura: `PATCH /api/invoices/[id]` con `{ provider_id }` (ya acepta cualquier campo)
- Actualizar catálogo: `PATCH /api/catalog` (agregar soporte para `provider_id`)

## UI

### Selector en factura

Ubicación: Debajo del nombre del archivo, junto al selector de país existente.

- Campo muestra: nombre del proveedor actual o "Sin proveedor"
- Click → dropdown con input de búsqueda
- Lista de proveedores filtrada (misma API `/api/providers?search=...`)
- Opción fija al final: "+ Crear nuevo proveedor"
- Si elige crear nuevo → input inline para nombre → POST → asigna

### Mover producto en catálogo

- En cada fila expandida de producto, botón "Mover a otro proveedor"
- Click → dropdown de proveedores (mismo patrón de búsqueda)
- Confirmación antes de ejecutar
- Si hay conflicto de unique constraint → mostrar error descriptivo

## Archivos

### Modificar
- `src/app/(dashboard)/facturas/[id]/page.tsx` — Agregar selector de proveedor
- `src/app/(dashboard)/catalogo/[providerId]/page.tsx` — Agregar botón mover producto
- `src/app/api/catalog/route.ts` — Soporte para cambiar `provider_id` en PATCH

### Nuevo
- `src/app/api/providers/route.ts` — Agregar POST para crear proveedor (si no existe)
