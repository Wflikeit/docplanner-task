# Backend (listings MVP)

Full setup (env, Docker, import, pipeline): [root README — SETUP](../README.md#setup).

## Source of truth

**Processed JSON files are not runtime data sources.** They are intermediate artifacts used by the import script (`npm run db:import` / `npm run import:otodom:mysql`). Once imported, **MySQL is the source of truth** for the running application.

Pipeline:

`crawler → sanitizer → tagger → JSON under data/` → **import** → **MySQL** → **API (Prisma)** → frontend.

The HTTP server **only** reads listings from MySQL via Prisma. It requires **`DATABASE_URL`** at startup; without it, startup fails with a short setup hint (no silent fallback to JSON on disk).

## Setup

1. **MySQL** — e.g. from repo root: `docker compose up -d` (see `../docker-compose.yaml`).
2. **`DATABASE_URL`** in **`backend/.env.local`** (copy from `.env.example`; gitignored).
3. **Import** — `npm run import:otodom:mysql` (needs sanitized JSON paths as in `scripts/README-otodom-mysql-import.md`).

Offline steps before import (optional / as needed):

| Script | Role |
|--------|------|
| `npm run crawl:otodom` | Raw snapshot → `data/raw/…` |
| `npm run data:prepare` | Snapshot → `data/processed/otodom-listings.sanitized.json` |
| `npm run tag:otodom:gemini` | Optional tagging JSON for import merge |

## Run API

From `backend/`:

```bash
npm run dev
```

Requires `DATABASE_URL` pointing at a database that already has schema (`prisma migrate deploy`) and preferably imported rows.

Raw crawl adapters live under `src/infrastructure/crawler/otodom/` (detail merge; snapshot + LD types are re-exported from `data-pipeline/otodom/raw/`). Sanitize / LLM / import mappers live under `src/infrastructure/data-pipeline/otodom/` (`raw/`, `sanitize/`, `ai/`, `import/`). Those modules and `scripts/` are **offline pipeline** only — they do not serve HTTP at runtime.
