# AduanaSys

Sistema de automatizacion de despachos aduaneros. Procesa facturas comerciales con IA para extraer items y clasificarlos con codigos NCM (Nomenclatura Comun del Mercosur).

## Requisitos

- Node.js 20+
- Docker Desktop
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) (`brew install supabase/tap/supabase`)

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar Supabase local

```bash
supabase start
```

La primera vez descarga las imagenes Docker (~2GB). Una vez listo, muestra las URLs y keys locales.

### 3. Aplicar schema y cargar datos

```bash
supabase db reset
```

Esto aplica la migracion inicial (todas las tablas, funciones, indexes) y carga el nomenclador NCM (~10.400 codigos).

### 4. Crear el archivo de entorno

Copiar `.env.example` a `.env.development.local` y completar con las keys locales:

```bash
cp .env.example .env.development.local
```

Editar `.env.development.local`:

```env
# Supabase local (obtener de `supabase status -o env`)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY de supabase status>

# API keys
ANTHROPIC_API_KEY=sk-ant-xxxxx
OPENAI_API_KEY=sk-xxxxx
```

> `npm run dev` carga `.env.development.local` automaticamente con mayor prioridad que `.env.local`.

### 5. (Opcional) Generar embeddings para busqueda semantica

La busqueda fulltext y trigram funcionan sin este paso. Para habilitar busqueda semantica:

```bash
npx tsx scripts/ingest-ncm.ts --force
```

Costo: ~$0.01 (OpenAI text-embedding-3-small).

### 6. Levantar el servidor de desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Uso diario

```bash
supabase start        # Levantar DB local
npm run dev           # Servidor de desarrollo
supabase stop         # Parar DB local
supabase db reset     # Resetear a schema limpio + seed
```

### URLs locales

| Servicio | URL |
|----------|-----|
| App | http://localhost:3000 |
| Supabase Studio | http://127.0.0.1:54323 |
| Supabase API | http://127.0.0.1:54321 |
| PostgreSQL | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## Scripts

```bash
npm run dev                        # Servidor de desarrollo
npm run build                      # Build de produccion
npm run lint                       # ESLint
npx tsx scripts/ingest-ncm.ts      # Importar NCM con embeddings
npx tsx scripts/generate-seed.ts   # Regenerar seed.sql desde CSV
```

## Entornos

| Entorno | Archivo env | Supabase |
|---------|-------------|----------|
| Desarrollo | `.env.development.local` | Local (127.0.0.1:54321) |
| Produccion | `.env.local` | Cloud (supabase.co) |
