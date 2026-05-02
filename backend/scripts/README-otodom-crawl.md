# Otodom crawl (raw snapshot JSON)

One-off script: search results → listing detail pages → **`data/raw/otodom-listings.snapshot.json`**. Not used by the API at runtime.

Snapshot **`meta.outputKind`: `otodom_snapshot_v2`**. Each item is a **phase-1 raw capture**:

1. **Primary:** `application/ld+json` on the detail page (Schema.org `House` in `@graph`) — stored as `ldJsonRaw` plus merged fields (`title`, `description` HTML, `priceAmount`, `addressFromLd`, `attributesRawJson` from `additionalProperty`, `imageUrls`, …).
2. **Fallback:** DOM snippets from **`data-cy`** (`adPageAdTitle`, `adPageHeaderPrice`, `adPageAdDescription`) when LD is incomplete.
3. **Audit only:** `mainTextRaw` — full `main.innerText` after expand + scroll; for diffing, **not** the semantic source of truth.

Legacy path `data/otodom-listings-mock.json` is **not** produced by this script.

## Setup (once per machine)

From `backend/`:

```bash
npm install
npm run crawl:otodom:install
```

Installs Chromium into `backend/.pw-browsers/` (see `.gitignore`).

## Run crawl

```bash
cd backend
npm run crawl:otodom
```

Default: **100** listings. Output: **`data/raw/otodom-listings.snapshot.json`**

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTODOM_LISTING_COUNT` | `100` | How many listings (max `500`). |
| `OTODOM_DETAIL_DELAY_MS` | `450` | Pause between detail page loads (ms). |
| `OTODOM_LD_JSON_RAW_MAX` | `900000` | Max characters stored in `ldJsonRaw` per listing (parse uses full script before truncate). |
| `OTODOM_MAIN_TEXT_RAW_MAX` | `500000` | Max characters stored in `mainTextRaw` per listing (audit blob). |
| `OTODOM_LOG` | _(off)_ | Set to `verbose` for per-listing logs. |

Examples:

```bash
OTODOM_LISTING_COUNT=3 npm run crawl:otodom
OTODOM_LISTING_COUNT=100 OTODOM_DETAIL_DELAY_MS=600 npm run crawl:otodom
OTODOM_LOG=verbose npm run crawl:otodom
```

## Behaviour

- Collects unique `/pl/oferta/...-ID…` URLs from search (`?page=` pagination + scroll).
- Opens each listing **sequentially**; expands **Show more** (Otodom UI label) in `main`, scrolls briefly, then runs a string **`page.evaluate`** that returns:
  - full **`application/ld+json`** text (script tag containing `House` / `@graph` when possible),
  - **`data-cy`** title / price line / description text,
  - **`mainTextRaw`** (capped) for audit.
- **Node** merges with [`../src/infrastructure/crawler/otodom/detailMerge.ts`](../src/infrastructure/crawler/otodom/detailMerge.ts): JSON-LD first, DOM fallback, provenance in `extractionSources`.
- Skips a listing on error; logs `ok` / `skipped` counts.

Some URLs collected from search may **404 or redirect** before detail extraction. **`npm run sanitize:otodom`** detects typical Otodom **“we couldn’t find the page”** / removed-listing pages (empty LD, no attributes, no price/area/rooms, Untitled) and **omits** them from the sanitized file instead of treating them as incomplete offers — so downstream LLM and DB stay clean.

## Sanitize → tag → import → API

**Order matters** if you want **`aiTags` / `aiSummary`** in the API: run **`npm run tag:otodom:gemini`**, then **`npm run import:otodom:mysql`** so those fields land in MySQL. `npm run dev` only reads the database; it does not call Gemini or load listing JSON at startup.

1. **Sanitize** (compact `{ "source": "otodom", "items": [...] }`):  
   `npm run sanitize:otodom`  
   Rows that look like Otodom **“page not found”** (removed listing between URL collection and fetch) are **skipped** — they never reach tagging, DB import, or the API. The script logs `Summary: { read, sanitized, skipped_unavailable }` so you can see how many were dropped.
2. **Tag with Gemini** (writes e.g. `data/test-data.tagged.json`; needs `GEMINI_API_KEY`):  
   `npm run tag:otodom:gemini`  
   (or `npm run tag:otodom:gemini:test` for a one-row smoke.)
3. **Import to MySQL** (writes `tags_json`, `ai_summary`, … on each row):  
   `npm run import:otodom:mysql`  
   (needs `DATABASE_URL`; see [`README-otodom-mysql-import.md`](README-otodom-mysql-import.md).)
4. **API**: set `DATABASE_URL` and start the server:

```bash
cd backend
DATABASE_URL=mysql://app:app@127.0.0.1:3306/real_estate npm run dev
```

The HTTP server **does not read** `OTODOM_SANITIZED_PATH` (or other importer JSON paths) at runtime — JSON files are **importer input only**; after import, **MySQL is the source of truth** (see `backend/README.md`).

MySQL import maps sanitized JSON via `src/infrastructure/data-pipeline/otodom/import/mapToDbRow.ts` (`PersistedListingRow`); see `src/infrastructure/data-pipeline/otodom/import/mapToDbRow.test.ts`.
