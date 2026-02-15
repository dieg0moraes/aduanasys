# Local Supabase Dev Environment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a local Supabase instance so developers can test without impacting production.

**Architecture:** Supabase CLI runs a full local stack (Postgres + pgVector + Auth + Storage + Realtime) via Docker containers. A consolidated migration creates the full schema, and a seed script loads the NCM nomenclator. Environment switching uses Next.js's built-in `.env.development.local` convention.

**Tech Stack:** Supabase CLI, Docker, PostgreSQL + pgVector, Next.js env files

---

### Task 1: Install Supabase CLI

**Step 1: Install via Homebrew**

Run: `brew install supabase/tap/supabase`

**Step 2: Verify installation**

Run: `supabase --version`
Expected: Version string like `1.x.x`

---

### Task 2: Initialize Supabase in the project

**Step 1: Run supabase init**

Run from project root (worktree):
```bash
cd /Users/diegomoraes/Documents/aduanasys/.worktrees/supabase-local
supabase init
```

This generates `supabase/config.toml`. Since `supabase/` already exists with SQL files, the CLI will create `config.toml` alongside them.

**Step 2: Verify config.toml was created**

Run: `ls supabase/config.toml`
Expected: File exists

---

### Task 3: Create consolidated migration

**Files:**
- Create: `supabase/migrations/00000000000000_initial.sql`

**Step 1: Create migrations directory**

Run: `mkdir -p supabase/migrations`

**Step 2: Write the consolidated migration**

Create `supabase/migrations/00000000000000_initial.sql` that combines all SQL files in the correct order. This is the FULL schema as it exists in production today.

The consolidation order:
1. Extensions: `vector`, `uuid-ossp`, `pg_trgm`
2. Enum types: `invoice_status`, `file_type`, `confidence_level`, `classification_source`, `despacho_status`, `document_type`
3. Tables: `providers`, `invoices` (without `despacho_id` yet), `invoice_items`, `product_catalog`, `ncm_nomenclator`, `clients`, `despachos`
4. ALTER: add `despacho_id` to `invoices`, add `search_vector` columns, add catalog fields (`latu`, `imesi`, `exonera_iva`, `apertura`), add `internal_description`, add `country_code`
5. Table: `despacho_documents`
6. All indexes (regular + vector HNSW + GIN fulltext + GIN trigram)
7. All RPC functions: `search_product_catalog()`, `search_ncm()`, `search_ncm_fulltext()`, `search_ncm_trigram()`, `search_catalog_fulltext()`
8. Triggers: `update_updated_at()` + tsvector auto-update triggers
9. RLS policies
10. Realtime publication
11. Storage bucket for documents

Key notes:
- Use VECTOR(1536) from the start (skip 768 migration)
- Use HNSW indexes (not IVFFlat)
- Include `search_vector` tsvector columns in CREATE TABLE (not ALTER)
- Include all columns added by incremental migrations directly in CREATE TABLE
- Skip `ALTER PUBLICATION supabase_realtime` — Supabase local handles this differently via `config.toml`
- Skip `INSERT INTO storage.buckets` — Supabase local handles storage via `config.toml`

**Step 3: Verify migration syntax**

Run:
```bash
supabase start
supabase db reset
```
Expected: Migration applies cleanly, seed runs (even if empty)

---

### Task 4: Create seed.sql for NCM nomenclator

**Files:**
- Create: `supabase/seed.sql`

**Step 1: Write seed.sql**

The seed needs to load ~10,433 rows from `data/ncm_nomenclator.csv` into `ncm_nomenclator`. Since PostgreSQL's `COPY` command can read local files in the container, we'll generate INSERT statements.

Write a script approach: use `\copy` or generate the seed SQL from the CSV. The simplest approach that works with `supabase db reset`:

Use a Node.js helper script `scripts/generate-seed.ts` that:
1. Reads `data/ncm_nomenclator.csv`
2. Generates `supabase/seed.sql` with INSERT statements
3. Does NOT generate embeddings (those need OpenAI API — run `npx tsx scripts/ingest-ncm.ts` separately if needed)

```typescript
// scripts/generate-seed.ts
import { readFileSync, writeFileSync } from "fs";

const CSV_PATH = "data/ncm_nomenclator.csv";
const OUTPUT_PATH = "supabase/seed.sql";

// Parse CSV (same logic as ingest-ncm.ts)
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

const content = readFileSync(CSV_PATH, "utf-8");
const lines = content.split("\n").filter((l) => l.trim());
const header = lines[0].split(",");

const idx = {
  ncm_code: header.indexOf("ncm_code"),
  description: header.indexOf("description"),
  full_description: header.indexOf("full_description"),
  chapter: header.indexOf("chapter"),
  aec: header.indexOf("aec"),
};

let sql = "-- Auto-generated seed: NCM nomenclator\n";
sql += "-- Run: npx tsx scripts/generate-seed.ts\n\n";

const BATCH = 500;
let values: string[] = [];

for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);
  if (fields.length < 5) continue;
  const ncm_code = fields[idx.ncm_code]?.trim();
  const full_desc = fields[idx.full_description]?.trim();
  const chapter = fields[idx.chapter]?.trim();
  const aec = fields[idx.aec]?.trim();
  if (!ncm_code || !full_desc) continue;

  const escaped = (s: string) => s.replace(/'/g, "''");
  const notes = aec ? `'AEC: ${escaped(aec)}'` : "NULL";
  values.push(
    `('${escaped(ncm_code)}', '${escaped(full_desc)}', '', '${escaped(chapter)}', ${notes})`
  );

  if (values.length >= BATCH) {
    sql += `INSERT INTO ncm_nomenclator (ncm_code, description, section, chapter, notes) VALUES\n`;
    sql += values.join(",\n") + "\nON CONFLICT (ncm_code) DO NOTHING;\n\n";
    values = [];
  }
}

if (values.length > 0) {
  sql += `INSERT INTO ncm_nomenclator (ncm_code, description, section, chapter, notes) VALUES\n`;
  sql += values.join(",\n") + "\nON CONFLICT (ncm_code) DO NOTHING;\n\n";
}

writeFileSync(OUTPUT_PATH, sql);
console.log(`Seed written to ${OUTPUT_PATH}`);
```

**Step 2: Generate the seed**

Run: `npx tsx scripts/generate-seed.ts`
Expected: `supabase/seed.sql` created with ~10,433 INSERT rows

**Step 3: Test with db reset**

Run: `supabase db reset`
Expected: Schema applies, seed loads, no errors

---

### Task 5: Create .env.development.local

**Files:**
- Create: `.env.development.local`

**Step 1: Get local Supabase credentials**

Run: `supabase status`
Expected: Output shows API URL, anon key, service_role key

**Step 2: Create .env.development.local**

```env
# Local Supabase (supabase start)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>

# AI keys (same as production — these are API services, not DB)
ANTHROPIC_API_KEY=<copy-from-.env.local>
OPENAI_API_KEY=<copy-from-.env.local>
```

Next.js loads `.env.development.local` when running `npm run dev`, which overrides `.env.local` for the Supabase vars.

**Step 3: Add to .gitignore if needed**

Check: `.env*` pattern in `.gitignore` already covers `.env.development.local` — verify this.

**Step 4: Verify**

Run: `npm run dev`
Expected: App starts and connects to local Supabase at `127.0.0.1:54321`

---

### Task 6: Configure Supabase config.toml

**Files:**
- Modify: `supabase/config.toml`

**Step 1: Enable required features**

After `supabase init` generates the default config, verify/adjust:
- Storage is enabled (for invoice uploads)
- Realtime is enabled (for invoice status updates)
- The `invoices` table is in the realtime publication

**Step 2: Verify**

Run: `supabase stop && supabase start`
Expected: All services start cleanly

---

### Task 7: Update .env.example

**Files:**
- Modify: `.env.example`

**Step 1: Add local dev instructions**

Add a comment block explaining how to use local vs production Supabase:

```env
# Supabase
# For production: use your Supabase project URL and anon key
# For local dev: run `supabase start` and use the values from `supabase status`
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aca

# Anthropic (Claude API)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# OpenAI (para embeddings)
OPENAI_API_KEY=sk-xxxxx
```

---

### Task 8: Commit all changes

**Step 1: Stage and commit**

```bash
git add supabase/config.toml supabase/migrations/ supabase/seed.sql scripts/generate-seed.ts .env.example
git commit -m "feat: add local Supabase dev environment

- Consolidated migration with full schema
- Seed script for NCM nomenclator
- Generate-seed script to create seed.sql from CSV
- Updated .env.example with local dev instructions"
```

---

### Task 9: End-to-end verification

**Step 1: Full reset and test**

```bash
supabase db reset
npm run dev
```

**Step 2: Verify in browser**

- Open `http://localhost:3000` — dashboard loads
- Open `http://localhost:3000/ncm` — NCM search works (fulltext/trigram, no semantic without embeddings)
- Open `http://127.0.0.1:54323` — Supabase dashboard shows tables with data

**Step 3: Verify table data**

In Supabase local dashboard, check:
- `ncm_nomenclator` has ~10,433 rows
- All other tables exist and are empty
- RPC functions are created

---

## Notes

- **Embeddings:** The local seed loads NCM data WITHOUT embeddings. Semantic search won't work locally unless you run `npx tsx scripts/ingest-ncm.ts` pointing to local Supabase. Fulltext and trigram search will work fine.
- **Storage:** Invoice file uploads will use local Supabase Storage. Files are stored in Docker volumes and persist across `supabase stop`/`start`, but are cleared on `supabase db reset`.
- **Realtime:** Works locally out of the box.
