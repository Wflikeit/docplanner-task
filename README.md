# 1-pager reasoning (MVP)

## Gathering data

I built a simple crawler utility that collects real estate listings from Otodom and stores them as raw JSON snapshots.

The crawler is executed beforehand, not during application runtime. It collects around 100 listing URLs and then visits detail pages using Playwright. During development, I used Playwright/MCP-style exploration to quickly identify stable data sources and understand the page structure.

The crawler prioritizes structured data over fragile UI parsing. In particular, Schema.org JSON-LD (`application/ld+json`) is treated as the primary source of listing data, while page text is kept mainly as fallback and audit/debug material.

Raw crawl results are stored on disk as snapshots:

- `data/raw/otodom-listings.snapshot.json`

This gives us a reproducible input for later processing and avoids depending on Otodom during normal application runtime.

This creates a clear separation between data acquisition and processing. The crawler is treated as an independent component, while the rest of the system operates on stable, reproducible inputs.


## MVP simplifications / execution model

To keep the MVP simple and cheap to run, I separated the pipeline into file-based stages instead of building a full distributed ingestion system.

The flow is:

1. Run the crawler once and store raw results as JSON.
2. Run deterministic sanitization and store sanitized listings as JSON.
3. Run AI tagging as a separate offline step and store AI output as JSON.
4. Merge sanitized data with AI tags by `externalId`.
5. Import the merged dataset into MySQL.

This file-based approach makes development faster because every stage can be rerun independently
without crawling the external website again or paying for repeated LLM calls.

For local development, **MySQL** and **schema** come up via Docker Compose
(`prisma migrate deploy` runs in the `prisma-migrate` service).
**Loading listing rows is separate:** run **`npm run import:otodom:mysql`** from `backend/`
when you have sanitized (and optionally tagged) JSON — the stack does **not** auto-import snapshot files on startup.

This is intentionally simpler than a production ingestion architecture.
In a larger system, scraping, sanitization, AI enrichment and database writes would
likely be separate services or jobs connected through a queue or webhooks.
For the MVP, JSON files act as stable handoff points between stages,
which keeps the system reproducible, debuggable and inexpensive to iterate on.

## Example scenarios

### Example A

The user is looking for a house in Mazowieckie with at least 4 rooms.

1. The user sets filters:
    - region: Mazowieckie
    - rooms: 4+

2. The system returns matching listings from the database.

3. The user opens a listing detail page to inspect price, description and photos.

Result:
The user quickly finds a relevant house using structured filters.

### Example B (AI search)

The user types:
"I want a quiet house near forest, not too expensive, around Warsaw"

1. The system sends the query to the AI search endpoint.
2. The model maps the intent to:
    - region/city: Warsaw area
    - tags: quiet_area, near_forest
    - priceMax: inferred low-to-mid range

3. The backend merges these filters with the current state.

4. The system returns matching listings.

Result:
The user gets relevant results without manually setting filters.

## Data sanitization and processing

The raw snapshot is not imported directly into the database. Instead, it goes through a deterministic sanitization step that produces a compact, pipeline-ready JSON file:

- `data/processed/otodom-listings.sanitized.json`

The sanitizer:

- strips HTML from descriptions,
- normalizes whitespace and common text artifacts,
- removes obvious Otodom UI/chrome text,
- skips unavailable/expired listing pages,
- keeps only useful listing fields,
- preserves selected attributes in a structured form.

The sanitized file is the canonical source for importing listings into the application database.
This stage acts as a boundary between unreliable external data and the internal system.
By keeping it deterministic, the rest of the pipeline does not depend on heuristics or AI decisions.

## Data model

For the MVP, I store normalized listings in MySQL using Prisma.

The main table is `listings`, with fields such as:

- provenance: `source`, `externalId`, `sourceUrl`
- display data: `title`, `description`, `imageUrls`
- structured filters: `priceAmount`, `priceCurrency`, `pricePerSqm`, `areaSqm`, `rooms`
- location: `street`, `city`, `district`, `region`, `country`
- enrichment: `tagsJson`, `aiSummary`, `aiWarningsJson`, `aiUpdatedAt`
- original extracted attributes: `attributesJson`

Deduplication for safe reruns is handled with a unique constraint on `(source, externalId)`. The importer uses upsert, so the same processed dataset can be imported repeatedly without duplicating records.

Basic indexes are added for expected filters such as city, region, price, area and rooms.

## Handling unstructured / low-quality data

The MVP follows a deterministic-first approach:

- Structured JSON-LD fields are preferred over raw page text.
- Numeric values such as price, area and rooms are parsed defensively.
- Missing values remain `null`; the system does not invent missing price, area or room counts.
- Expired or unavailable listing pages are skipped during sanitization.
- Raw snapshots are preserved separately for audit/debugging.
- Sanitized records are compact and safe to use in later pipeline stages.

This keeps the data pipeline predictable while still allowing improvements later.

## Where and why AI is used

AI is used intentionally as an enrichment layer, not as the source of truth for core listing fields.

After sanitization, a separate offline tagging script sends compact listing data to Gemini flash 2.5 and generates:

- high-level feature tags,
- a short listing summary,
- warnings when the model detects inconsistencies.

The output is stored as:

- `data/processed/otodom-listings.tagged.json`

During database import, the sanitized listing is treated as canonical data, while AI output is merged by `externalId` and stored as optional enrichment.

This means:

- browsing and filtering do not depend on live LLM calls,
- AI latency does not affect user-facing requests,
- LLM output can be regenerated later if prompts or models change,
- AI tags can support natural-language or tag-based search without overwriting deterministic fields.

**Conversational search (optional UI):** the `POST /api/listings/ai-search` endpoint calls Gemini with **`activeFilters`** plus the **full conversation** (clamped by `AI_SEARCH_MAX_CONVERSATION_CHARS`, default 8000). The model returns a JSON patch merged on the server, then listing SQL runs. **Without `GEMINI_API_KEY`** (or with `AI_SEARCH_MOCK=1`) the handler uses a **reply-only stub** — it does not infer filters; set the key for real behaviour.

## Key assumption

**Core listing UX and AI enrichment**

- I assume that core listing usability does not depend on AI enrichment.
- I assume that features such as tagging or summaries can be computed asynchronously after ingestion, without affecting the user experience.

## One success metric

**MVP (data-focused)**

- Primary metric: **data usability** — the share of listings that are complete, non-duplicated and lead to valid pages.

**Beyond the MVP**

- In a real product, add a user-facing metric such as **search-to-detail success rate** — whether people find and open relevant listings.

## One limitation / failure mode

**External data**

- The MVP depends on data quality from a single external source.
- Listings may disappear between URL collection and detail-page crawling.
- Some offers may be incomplete, duplicated or misleading.

**Sanitizer vs production scale**

- The sanitizer handles obvious expired pages and missing values.
- Broader reliability would need stronger source integration, periodic refreshes, better deduplication, retry logic and data quality monitoring.

## What we’d improve with more time

### Ingestion & data quality
- Make the importer production-safe (batching, retries, partial failure handling, import reports).
- Improve normalization (better location parsing, more reliable price/area extraction, consistent attribute mapping).
- Skip or flag low-quality / incomplete listings more explicitly.

### Data sources & deduplication
- Move towards structured data sources (APIs or feeds) to reduce reliance on browser-based crawling.
- Improve deduplication beyond `(source, externalId)` using similarity signals (location, price, area, title).

### Search & relevance
- Improve search relevance with better text matching, typo tolerance and ranking.
- Introduce tag-based filtering to complement structured filters.

### AI & enrichment
- Move AI tagging (currently an offline script) into an asynchronous background process.

  The ingestion pipeline (scraping + sanitization) should remain deterministic and independent, while enrichment runs after listings are stored. This avoids blocking ingestion on LLM latency and allows independent scaling.

- Extend AI usage to natural-language search (mapping user intent to structured filters).
- **Hybrid search intent (future):** pre-parse the user message with deterministic rules (e.g. regex) to extract obvious structured signals (budget, room count, city tokens) and send a **smaller payload** to the LLM for the ambiguous remainder (tags, nuance)—reducing tokens and cost while keeping Gemini for what heuristics miss.
- Optionally use AI to enrich missing information when the description contains useful signals, while avoiding inference of core fields such as price or area.

### Observability & debugging
- Add basic data quality metrics (field coverage, import errors, skipped listings).
- Provide a simple QA/debug view comparing raw, sanitized and stored data.

## Development notes

I used AI-assisted tools (Codex, Cursor, Playwright MCP-style exploration) during development to speed up iteration, especially for:

- initial crawler implementation,
- identifying stable selectors,
- improving code structure and readability.
- implementing sanitization mechanisms such as removing html etc.

All core logic (data pipeline, normalization) was reviewed and adjusted manually.