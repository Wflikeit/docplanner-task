# Otodom → MySQL import (Prisma)

Aligned with **`ai-context/task-details.md`**: persistence uses **MySQL**, not SQLite.

## Docker Compose (MySQL + schema)

From the **repo root**:

```bash
docker compose up -d
```

- Starts **MySQL 8.4** (`real_estate` DB, user `app` / password `app`, port **3306**).
- Runs **`prisma-migrate`** after MySQL is healthy: on first use `npm ci` into a Docker volume, then `prisma migrate deploy` (Linux `node_modules`, not the host’s).

First run installs deps into a Docker volume (`npm ci`); later `compose up` only runs `prisma migrate deploy` unless that volume was removed. After a large `package-lock.json` change, if migrate misbehaves remove volume `prisma_migrate_node_modules` (see `docker volume ls`) and run `compose up` again.

**`DATABASE_URL` on the host** (backend / import) when talking to this compose stack:

`mysql://app:app@127.0.0.1:3306/real_estate`

You still run **`npm run db:import`** (alias of **`npm run import:otodom:mysql`**) on the host when you want data in `listings`. From **`backend/`** you can also run **`npm run db:up`** instead of `docker compose` (changes to repo root and runs `docker compose up -d`).

The schema (including filter indexes) lives in **one** migration: `20260201120000_init_listings`. If you still have a **very old** MySQL volume from before the current `init` migration, run **`docker compose down -v`** once (this removes data in `mysql_data`), then **`docker compose up -d`** again — the database is recreated from scratch with the full schema.

If a migration **failed mid-way** (e.g. `P3018` / failed migration), Prisma blocks further deploys: either `docker compose down -v` and a clean start, or follow the [troubleshooting guide](https://www.prisma.io/docs/guides/migrate/troubleshooting-development) (`migrate resolve`).

## 1. Database URL and migrations

Set **`DATABASE_URL`** in `backend/.env` (MySQL connection string for Prisma), for example:

`mysql://app:app@127.0.0.1:3306/real_estate` (matches repo `docker-compose.yaml`).

Apply schema manually (if you are not using Docker Compose above):

```bash
cd backend
npm run db:migrate
```

For local development you can use `npm run db:migrate:dev` instead. Migrations live under `prisma/migrations/`.

## 2. Environment (`backend/.env` or `.env.local`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | **Required** — MySQL URL for Prisma |
| `OTODOM_SANITIZED_PATH` | Default **`data/processed/otodom-listings.sanitized.json`** if unset; if missing and unset, import may resolve from **`meta.inputPath`** in the tagged file |
| `OTODOM_TAGGED_PATH` / `OTODOM_TAGGED_JSON_PATH` / **`OTODOM_TAGGING_OUT`** | Tagged Gemini file; default **`data/processed/otodom-listings.tagged.json`** if that file exists and env unset |

## 3. Run import

The script upserts **every** `items[]` entry from the **sanitized** file, merging **`gemini`** from the tagged file by **`externalId`** (`buildPersistedRowsFromOtodomSanitizedAndTagging`). Default paths: **`data/processed/otodom-listings.sanitized.json`** and **`data/processed/otodom-listings.tagged.json`** (when that file exists). When building sanitized JSON with `npm run sanitize:otodom`, leave **`OTODOM_SANITIZE_LIMIT`** unset for a full snapshot. For tagging, omit **`OTODOM_TAGGING_LIMIT`** for a full tagged file.

Very long `VARCHAR` fields (URL, title, city, …) are **trimmed** to MySQL column limits so one bad string does not abort the whole import.

```bash
cd backend
npm run import:otodom:mysql
```

Maps **sanitized** rows + optional **tagged** `gemini` block into columns:

`source`, `external_id`, `source_url`, `title`, `description`, `price_*`, `area_sqm`, `rooms`, `street`, `city`, `district`, `region`, `country`, `image_urls_json`, `attributes_json`, `tags_json`, `ai_summary`, `ai_updated_at`, `ai_warnings_json`, `scraped_at`.

Re-import **upserts** the same logical offer (`source` + `external_id`). Code: `src/infrastructure/persistence/prismaListingUpsert.ts`, mapper `src/infrastructure/data-pipeline/otodom/import/mapToDbRow.ts`, script `scripts/import-otodom-listings-mysql.ts`.

## 4. HTTP API from MySQL (optional)

After import, the backend reads **`GET /api/listings`** and detail from **MySQL** with **SQL filter + pagination**. Tagging fields come from DB columns (`tags_json`, etc.) — the HTTP API does **not** read tagged JSON or tagging-related env vars at request time. Re-import is an upsert — **no restart** of the backend container is required for new rows to show up.
