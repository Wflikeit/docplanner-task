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

The user wants a home in **Warszawa** with at least **four rooms**.

1. They enter **Warszawa** under City, set **Min rooms** to **4**, and press **Apply filters**.
2. The list updates to matching offers.
3. They open an offer to read the description and see photos.

**Result:** they narrowed the list using the manual filters only.

### Example B (AI-assisted search)

*(Turn on AI-assisted search in configuration if you want this behaviour.)*

The user types something like: *“I’m looking for a premium house in the city centre for a family around Warsaw.”*

1. They press **Enter**. Anything they already entered in the filter panel still counts.
2. The model interprets the sentence and maps it to **the same kinds of limits as in Example A** — city, price band, room count, optional tags, plus short search keywords where it helps.
3. They see a brief **assistant message** and the list refreshes.

Tag chips only match listings that **already** had those labels when data was imported; the assistant suggests **filters**, not new labels created on the fly for each row.

**Result:** less tedious tweaking of every field, but no “hidden” dimensions beyond what the UI can show.

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

**AI tagging vs AI search (same tag vocabulary, different jobs):**

- **Offline tagging** (`npm run tag:otodom:gemini`) runs once per listing after sanitization. Gemini assigns **feature tag ids**, a short summary, and optional warnings; results land in `data/processed/otodom-listings.tagged.json` and are merged into MySQL at import (`tagsJson`, display chips on the detail page). This is **not** executed during a user search request.
- **Tag-based listing search** uses those ids in **`GET /api/listings`**: query param **`tags`** is a comma-separated list; the SQL layer requires **every** selected tag on a row (AND). Users can also toggle the same ids in the UI filter chips.
- **AI-assisted search** (`POST /api/listings/ai-search`, optional frontend flag) is a **separate** runtime Gemini call: it maps the user’s sentence plus current panel filters into **`mergedQuery`** (city, price, `q`, **`tags`**, etc.). The model may suggest **tag ids from that same controlled vocabulary**—it does not re-tag listings row-by-row; it only proposes filters, then the usual listing query runs.

**Conversational search (optional UI):** the `POST /api/listings/ai-search` endpoint calls Gemini with **`activeFilters`** plus the **full conversation** (clamped by `AI_SEARCH_MAX_CONVERSATION_CHARS`, default 8000). The model returns a JSON patch merged on the server, then listing SQL runs. **Without `GEMINI_API_KEY`** (or with `AI_SEARCH_MOCK=1`) the handler uses a **reply-only stub** — it does not infer filters; set the key for real behaviour.

## Key assumption

**Core listing UX and AI enrichment**

- I assume that core listing usability does not depend on AI enrichment.
- I assume that features such as tagging or summaries can be computed asynchronously after ingestion, without affecting the user experience.
- For the MVP, tags are still **precomputed** and stored so filters and search can use them without waiting on an LLM per page view.

**MVP (data-focused)**

- Primary metric: **data usability** — the share of listings that are complete, non-duplicated and lead to valid pages.

**Beyond the MVP**

- In a real product, add a user-facing metric such as **search-to-detail success rate** — whether people find and open relevant listings.

## One limitation / failure mode

The MVP operates on a small and limited dataset, which can lead to poor results for natural-language search.

For example, a query like “a premium house near Warsaw” may be mapped to strict filters such as `city = Warsaw`, returning zero results if matching listings are not present.

This highlights a mismatch between user intent (often vague or regional) and strict filtering on limited data.

## What we’d improve with more time

### Ingestion & data quality
- Make the importer production-safe (batching, retries, partial failure handling, import reports).
- Improve normalization (better location parsing, more reliable price/area extraction, consistent attribute mapping).
- Skip or flag low-quality / incomplete listings more explicitly.

### Data sources & deduplication
- Move towards structured data sources (APIs or feeds) to reduce reliance on browser-based crawling.
- Improve deduplication beyond `(source, externalId)` using similarity signals (location, price, area, title).

### Search & relevance
- Import more (and more varied) listings so ordinary searches are less likely to return nothing under strict filters.
- Improve natural-language → filter mapping for vague or regional intent (e.g. “near Warsaw”), using ranking and softer geography instead of exact equality-only filters when data is thin.
- Layer tag-based and full-text signals (typo tolerance, better matching) on top of structured filters.

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