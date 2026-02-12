# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AduanaSys is a customs clearance automation system (Automatización de Despachos) built with Next.js 16 App Router. It processes commercial invoices using AI to extract line items and classify them with NCM (Mercosur Nomenclature) codes. The system learns from approved invoices to improve future classifications.

## Commands

```bash
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

Scripts (run with `npx tsx`):
```bash
npx tsx scripts/ingest-ncm.ts   # Bulk import NCM nomenclator from data/ncm_nomenclator.csv
npx tsx scripts/eval-search.ts  # Evaluate search quality across layers
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project connection
- `ANTHROPIC_API_KEY` — Claude API (extraction + query expansion)
- `OPENAI_API_KEY` — OpenAI embeddings (text-embedding-3-small, 1536 dims)

## Architecture

### Tech Stack
- **Framework:** Next.js 16 with App Router, React 19, TypeScript
- **Styling:** Tailwind CSS 4 via PostCSS
- **Database:** Supabase (PostgreSQL + pgVector + Realtime)
- **AI:** Anthropic Claude Haiku 4.5 (extraction/expansion), OpenAI embeddings (1536-dim)
- **PDF:** pdf-lib for splitting, Claude Vision for OCR
- **Path alias:** `@/*` → `./src/*`

### Core Workflow

```
Upload invoice (PDF/image/Excel)
  → Claude Vision extracts header + line items
  → Multi-layer NCM classification per item
  → User reviews & corrects items
  → Approval upserts items to product_catalog with embeddings
  → Future invoices from same provider classify faster (feedback loop)
```

### Multi-Layer NCM Search (`src/lib/ncm-search.ts`)

This is the central classification engine. For each item, it runs 4 search layers in order:

1. **Catalog match** — exact SKU + provider lookup in `product_catalog` (high confidence)
2. **Full-text** — Spanish-stemmed tsvector search on `ncm_nomenclator`
3. **Trigram** — fuzzy matching for typos (e.g. "algdon" → "algodón")
4. **Semantic** — cosine similarity on pgVector embeddings

Query expansion uses Claude Haiku to convert commercial product names into customs terminology before layers 2-4.

### Invoice Processing Pipeline (`src/app/api/invoices/[id]/process/route.ts`)

Processing runs async (fire-and-forget from the API route). The flow:
1. Downloads file from Supabase Storage
2. Extracts with Claude Vision (images) or Claude Haiku (text PDFs)
3. PDFs are split page-by-page with 30s delays between pages for rate limiting
4. Classifies items via `classifyInvoiceItems()` which batches: 1 catalog query, 1 Haiku expansion call, 1 OpenAI embeddings call, then parallel per-item searches
5. Inserts `invoice_items` and updates invoice status to `"review"`

Client receives updates via Supabase Realtime subscriptions (with 10s polling fallback).

### Database Schema (`supabase/`)

5 core tables:
- **`providers`** — vendor/exporter info
- **`invoices`** — status lifecycle: `uploaded → processing → review → approved → exported`
- **`invoice_items`** — line items with NCM codes, confidence levels, classification sources
- **`product_catalog`** — learned products from approvals (unique on `provider_id + sku`), has vector embeddings
- **`ncm_nomenclator`** — full Mercosur NCM code database with tsvector, trigram indexes, and vector embeddings

Key Supabase RPC functions: `search_ncm()` (vector), `search_ncm_fulltext()`, `search_ncm_trigram()`, `search_product_catalog()` (vector), `search_catalog_fulltext()`.

Schema files are applied manually — there is no automated migration runner.

### Route Structure

**Pages** (all `"use client"` components):
- `/` — Dashboard with invoice stats
- `/facturas` — Invoice list with status filters + upload modal
- `/facturas/[id]` — Invoice detail: items table, process/approve/export actions
- `/catalogo` — Provider list with product counts
- `/catalogo/[providerId]` — Provider's product catalog (paginated, editable)
- `/ncm` — Standalone NCM search interface

**API Routes** (`src/app/api/`):
- `invoices/` — CRUD + `[id]/process` (async AI processing) + `[id]/approve` (catalog sync)
- `ncm/search` — Multi-layer NCM search (POST and GET)
- `catalog/` — Product catalog CRUD with pagination
- `providers/` — Provider listing with counts

### Key Libraries (`src/lib/`)

- `supabase.ts` — Browser client (`supabase`) and server factory (`createServerClient()`)
- `types.ts` — All TypeScript interfaces, enums, and UI label/color mappings
- `claude.ts` — `extractInvoiceData()` handles images and multi-page PDFs
- `embeddings.ts` — `generateEmbedding()` / `generateEmbeddings()` wrappers for OpenAI
- `ncm-search.ts` — `searchNCM()` (single query) and `classifyInvoiceItems()` (batch)
- `utils.ts` — `cn()`, `detectFileType()`, `formatDate()`/`formatCurrency()` (es-AR locale)

### UI Components (`src/components/`)

- `ui/sidebar.tsx` — Fixed left sidebar navigation (dark blue #1B4F72)
- `invoice/upload-zone.tsx` — Drag-and-drop file upload (PDF, images, Excel; max 50MB)
- `invoice/invoice-list.tsx` — Filterable invoice list
- `invoice/items-table.tsx` — Editable items table with inline NCM picker
- `invoice/ncm-picker.tsx` — Modal NCM code search and selection

## Conventions

- UI text and prompts are in **Spanish**
- Currency/date formatting uses **es-AR** locale
- Icons from **lucide-react**
- Primary colors: #2E86C1 (blue), #1B4F72 (dark blue sidebar)
- Card pattern: `bg-white rounded-xl border p-*`
- Status badges: `px-2.5 py-0.5 rounded-full text-xs font-medium`
