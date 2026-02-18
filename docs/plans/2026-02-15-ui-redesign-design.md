# AduanaSys UI Redesign - Design Document

**Date:** 2026-02-15
**Design file:** `aduana.pen` (Pencil)
**Target user:** Despachante aduanero (customs agent professional)
**Style:** Modern, clean SaaS (Linear/Notion inspired)

## Design Decisions

- **Approach:** Evolutionary redesign - keep page structure, reorganize nav, improve each screen
- **Navigation:** Reorganized priority order: Dashboard > Despachos > Facturas > Catalogo > NCM
- **Visual system:** Swiss/clean - stroke-based containers, single blue accent (#2563EB), no shadows, Inter font
- **Layout:** Fixed 260px dark sidebar + fluid main content area

## Design System

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | #2563EB | Primary actions, active states, links |
| `bg-sidebar` | #1B2A4A | Sidebar background |
| `bg-surface` | #FAFAFA | Page background |
| `bg-primary` | #FFFFFF | Cards, inputs |
| `text-primary` | #18181B | Headings, body text |
| `text-secondary` | #71717A | Labels, metadata |
| `status-success` | #16A34A | High confidence, approved |
| `status-warning` | #F59E0B | Medium confidence, pending |
| `status-error` | #DC2626 | Low confidence, errors |

### Reusable Components
- **NavItem/Default** - Sidebar nav item (icon + label, idle state)
- **NavItem/Active** - Sidebar nav item (accent background, active state)
- **KPICard** - Metric card with label, value, and trend badge
- **StatusBadge** - Colored dot + text for status display
- **AlertItem** - Alert row with icon, title, meta, and timestamp

## Screens

### 1. Dashboard (`/`)
- **KPI row:** Facturas en Proceso, Despachos Activos, Items Pendientes, Tasa de Precisión
- **Two-column layout:**
  - Left: Alerts section (items requiring attention) + Activity feed
  - Right: Recent invoices table + Top providers by volume
- Alerts include: pending NCM classifications, low-confidence items, unmatched products

### 2. Facturas List (`/facturas`)
- **Filters:** Status tabs (Todas/Procesando/En Revision/Aprobadas) + search bar
- **Table columns:** Factura, Proveedor, Fecha, Items, Confianza (colored progress bar), Estado (badge), Acciones
- **Upload button:** Top-right, opens drag-and-drop modal
- **Pagination:** Bottom with page count

### 3. Factura Detail (`/facturas/[id]`)
- **Breadcrumb:** Facturas > INV-2024-0847
- **Status stepper:** Subida > Procesada > En Revision > Aprobada (horizontal progress)
- **Info card:** Editable invoice info (provider, date, currency, country) with inline edit
- **Summary KPIs:** Total items, classified %, average confidence, pending review
- **Partidas widget:** Compact horizontal card below KPIs showing: icon, "Partidas" title, count badge, inline partida references, "Ver todas" link, "+ Crear Partida" button
- **Items table:** Description, NCM code (colored pill), confidence %, source, country, actions
- **Inline editing panel:** Expands below row with blue left border, edit fields for customs/internal description, country selector, save/cancel

### 4. Despacho Detail (`/despachos/[id]`)
- **Header:** Despacho number + status badge + action buttons (Exportar, Eliminar)
- **Info fields:** DUA number (editable), reference
- **Tabs:** Facturas (count) | Partidas (count) | Documentos (count) | Notas (count)

#### 4a. Tab: Facturas
- **Header:** "Facturas vinculadas" + "Vincular Factura" button + "Subir Factura" primary button
- **Table columns:** Factura (number + filename), Proveedor, Fecha, Estado (StatusBadge), Acciones (ir a Factura, unlink)

#### 4b. Tab: Partidas
- **Header:** "Partidas del despacho" + "Crear Partida" primary button
- **Table columns:** Referencia (blue link P-001), Factura (number + filename), Fecha, Items (count), Estado (StatusBadge: Presentada blue, Despachada green), Acciones (Ver button)

#### 4c. Tab: Documentos
- **Header:** "Documentos adjuntos" + "Subir Documento" primary button
- **Table columns:** Documento (file icon + name + size), Tipo (colored pill badges: DUA blue, Certificado green, Packing List amber), Notas, Fecha, Acciones (download + delete icons)

#### 4d. Tab: Notas
- **Add note form:** Card with textarea placeholder + "Agregar" button with send icon
- **Notes journal:** Chronological list, each note shows:
  - Author avatar (colored circle with initials), author name, timestamp
  - Note text body
  - Separated by subtle borders

### 5a. Catalogo — Proveedores (`/catalogo`)
- **Tabs:** Proveedores (active) / Mercaderia
- **Search bar:** Filter by provider name
- **Provider table:** Vertical list with columns: Proveedor (avatar + name), País, Productos, Facturas, action chevron
- **Pagination:** Page numbers with count

### 5b. Catalogo — Mercadería (`/catalogo` tab Mercadería)
- **Tabs:** Proveedores / Mercadería (active)
- **Search bar:** "Buscar por SKU, descripción, NCM..." + Filtros toggle button + "+ Nuevo Producto" button
- **Advanced filters (collapsible):** Proveedor (dropdown), NCM prefix, Cliente (dropdown)
- **Result count:** "48 productos encontrados"
- **Product cards (expandable):**
  - **Collapsed:** SKU badge, provider description, NCM code pill (color-coded by confidence), provider name, times used count, chevron
  - **Expanded (blue border):** Descripción aduanera, descripción interna, flags row (LATU purple, IMESI orange, Exonera IVA green, Apertura blue), importers section (client name, despacho, date, quantity)
- **Pagination:** Page numbers with count

### 6. Provider Detail (`/catalogo/[providerId]`)
- **Breadcrumb:** Catalogo > Provider name
- **Provider info card:** Avatar, name, country, product count, invoice count, edit/add buttons
- **Search:** Filter products by SKU or description
- **Product table columns:** SKU, Descripción, NCM (colored pill), Desc. Aduanera, Desc. Interna, edit action
- **Pagination:** Bottom with count

### 7. NCM Search (`/ncm`)
- **Search bar:** Prominent with blue accent border + search button
- **AI expansion card:** Shows Claude-expanded query terms (blue info card)
- **Results list:** Each result shows:
  - Layer indicator dot (green=catalog, blue=fulltext, yellow=trigram, purple=semantic)
  - NCM code pill
  - Full description + chapter/section metadata
  - Confidence percentage (color-coded)
  - Copy action
- **Layer legend:** Top-right of results header

### 8. Nueva Partida (`/despachos/[id]/partidas/nueva`)
- **Breadcrumb:** Despachos > DES-2024-045 > Nueva Partida
- **Header:** Title + source invoice file name + provider name
- **Form card:** 3-column row with Referencia (auto P-001), Fecha (date picker), Notas (text)
- **Items table:** Selectable items from the source invoice
  - **Columns:** Checkbox, #, SKU, Descripción, NCM (colored pill), Cantidad, Despachado (amber), Disponible (green), Cant. Partida (editable input)
  - **Selected rows:** Blue tint background, filled checkbox, blue-bordered input with quantity
  - **Unselected rows:** Empty checkbox, gray input showing 0
  - **Disabled rows (fully dispatched):** Reduced opacity, "0" available, input shows "—"
- **Footer:** Selection summary badge ("3 items seleccionados") + units count + Cancelar / Crear Partida buttons

### 9. Partida Detail (`/despachos/[id]/partidas/[partidaId]`)
- **Breadcrumb:** Despachos > DES-2024-045 > P-001
- **Header:** "Partida P-001" + StatusBadge (Presentada) + action buttons (Exportar DUA, Editar)
- **Info card:** Factura reference, fecha, notas
- **Status stepper:** Borrador (completed, green check) > Presentada (current, blue dot) > Despachada (pending, gray outline)
- **Items table:** Columns: #, SKU, Descripción, NCM (blue pills), Cantidad, Precio Unit., Valor (bold)
- **Totals row:** Bottom row with bold "Total: $9,144.00"

## Modals

### NCM Picker (`/facturas/[id]` inline)
- **Header:** Current NCM code + classification source badge + close button
- **Search:** Input with AI expansion indicator ("Interpretado como: ...")
- **Results:** Expandable rows with:
  - Layer indicator dot (green=catalog, blue=fulltext, yellow=trigram, purple=semantic)
  - NCM code pill, description, similarity %
  - Expanded: full description, hierarchy breadcrumb, exclusion warnings, "Seleccionar" button
- **Footer:** Manual code input for direct entry

### Subir Factura (`/facturas` → modal)
- **Trigger:** "Subir Factura" button on Facturas list screen
- **Drag-and-drop zone:** Dashed blue border, cloud upload icon, "Arrastrá la factura acá" + "o hacé click para seleccionar un archivo"
- **File types:** PDF, JPG, PNG, XLSX, CSV — Máximo 50MB
- **Selected file state:** Green tinted row showing file icon, name, size, remove button
- **Footer:** Cancelar + "Subir y Procesar" primary button

### Nuevo Producto (`/catalogo/[providerId]`)
- **Fields:** Proveedor (selector), SKU, Descripción comercial, Descripción interna, Descripción aduanera, Código NCM (with search trigger), País de origen
- **Footer:** Cancelar + Guardar Producto buttons

## Key UX Improvements Over Current Implementation

1. **Dashboard:** New screen - gives immediate operational overview instead of landing on client list
2. **Navigation reorder:** Despachos promoted above Facturas (primary workflow)
3. **Confidence visualization:** Colored bars and percentages instead of text-only
4. **NCM layer transparency:** Color-coded search layers so user understands classification source
5. **Inline editing:** Edit items without navigating away from the table
6. **Status stepper:** Clear visual progress through invoice lifecycle
7. **Notes section:** Added to Despachos for operational journal keeping
8. **Partidas widget:** Compact card in Factura Detail for quick access to linked partidas
9. **NCM Picker redesign:** Expandable results with hierarchy, exclusions, and layer indicators
10. **Nuevo Producto modal:** Dedicated form for adding products to provider catalog
