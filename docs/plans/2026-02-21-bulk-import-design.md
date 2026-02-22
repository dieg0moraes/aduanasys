# Carga Masiva de Mercadería — Design Doc

## Resumen

Página dedicada para importar productos al catálogo desde un archivo Excel. El despachante selecciona un proveedor, sube un Excel con formato fijo, revisa los datos en una tabla de preview, y confirma la carga.

## Flujo

**Ruta:** `/catalogo/importar`

**Acceso:** Botón "Importar Excel" en la vista de Mercadería y en la vista de proveedor.

**3 pasos con stepper visual:**

1. **Proveedor** — Seleccionar o crear proveedor (combobox existente). Si se accede desde `/catalogo/[providerId]` con query param `?provider=ID`, se pre-selecciona y salta al paso 2.
2. **Archivo** — Upload de Excel (.xlsx/.xls) con drag-and-drop. Link para descargar template vacío. Parseo client-side con SheetJS.
3. **Preview y carga** — Tabla con todas las filas parseadas, estados por fila, edición inline, y confirmación de carga.

**Breadcrumb:** `Catálogo > Importar Mercadería`

## Template Excel

7 columnas con headers fijos:

| SKU* | Descripción Comercial* | Descripción Aduanera | Descripción Interna | NCM | País de Origen | Apertura |
|------|----------------------|---------------------|--------------------|----|---------------|----------|

- SKU y Descripción Comercial son obligatorios.
- Apertura acepta un número o vacío.
- País de Origen acepta código numérico DUA (ej: 156) o nombre (ej: "China"). Se detecta automáticamente y se guarda como nombre. Si no matchea, se marca como warning.
- LATU, IMESI, y Exonera IVA se excluyen por ahora (iteración futura).

## Parseo y validación

**Client-side** con SheetJS (`xlsx` package). El archivo no se envía al server — se parsea en el browser y se envía JSON al API.

**Estados por fila:**

- **OK** — Fila válida, lista para cargar. Sin indicador visual.
- **Error** (pill rojo) — Bloquea la fila: SKU vacío, descripción comercial vacía, NCM con formato inválido.
- **Warning** (pill amarillo) — No bloquea: país no reconocido, campos opcionales vacíos.
- **Duplicado** (pill azul) — SKU ya existe para ese proveedor. Dos acciones: "Actualizar" o "Saltar".

## Preview (Paso 3)

- Header con resumen: `48 productos · 3 duplicados · 1 error`
- Tabla con las 7 columnas + columna de estado + checkbox de exclusión
- Click en fila para editar inline (inputs sutiles, mismo estilo que mercadería)
- Checkbox por fila para excluir del lote. "Seleccionar todos / ninguno" en header.
- Botón "Cargar X productos" (X = filas válidas no excluidas)

## API

### `POST /api/catalog/bulk`

**Request:**
```json
{
  "provider_id": "uuid",
  "items": [
    {
      "sku": "ABC-123",
      "provider_description": "Motor eléctrico 220V",
      "customs_description": "Motor eléctrico de corriente alterna",
      "internal_description": "Motor línea industrial",
      "ncm_code": "8501.10.00",
      "country_of_origin": "China",
      "apertura": 12,
      "action": "create" | "update" | "skip"
    }
  ]
}
```

**Response:**
```json
{
  "created": 45,
  "updated": 3,
  "skipped": 2,
  "errors": []
}
```

- `action: "create"` → insert normal
- `action: "update"` → upsert por `provider_id + sku`
- `action: "skip"` → se ignora

**Sin cambios al schema de DB.** Usa `product_catalog` existente.

## Embeddings

Los embeddings se generan async después del insert (fire-and-forget). Mismo patrón que el procesamiento de facturas. El usuario no espera — ve el resumen de carga al instante.

## Dependencias

- **SheetJS (`xlsx`)** — parseo de Excel client-side + generación de template
- No se requieren nuevas tablas ni migraciones
