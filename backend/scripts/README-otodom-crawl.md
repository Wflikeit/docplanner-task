# Otodom crawl (raw snapshot JSON)

One-off script: search results → listing detail pages → **`data/raw/otodom-listings.snapshot.json`**. Not used by the API at runtime.

Snapshot **`meta.outputKind`: `otodom_snapshot_v2`**. Each item is a **phase-1 raw capture**:

1. **Primary:** `application/ld+json` on the detail page (Schema.org `House` in `@graph`) — stored as `ldJsonRaw` plus merged fields (`title`, `description` HTML, `priceAmount`, `addressFromLd`, `attributesRawJson` from `additionalProperty`, `imageUrls`, …).
2. **Fallback:** DOM snippets from **`data-cy`** (`adPageAdTitle`, `adPageHeaderPrice`, `adPageAdDescription`) when LD is incomplete.
3. **Audit only:** `mainTextRaw` — full `main.innerText` after expand + scroll; for diffing, **not** the semantic source of truth.

Sanitization (HTML strip, DB import) is **out of scope** until extraction output is reviewed.

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
- Opens each listing **sequentially**; expands **„Pokaż więcej”** in `main`, scrolls briefly, then runs a string **`page.evaluate`** that returns:
  - full **`application/ld+json`** text (script tag containing `House` / `@graph` when possible),
  - **`data-cy`** title / price line / description text,
  - **`mainTextRaw`** (capped) for audit.
- **Node** merges with [`../src/infrastructure/otodom/detailMerge.ts`](../src/infrastructure/otodom/detailMerge.ts): JSON-LD first, DOM fallback, provenance in `extractionSources`.
- Skips a listing on error; logs `ok` / `skipped` counts.
