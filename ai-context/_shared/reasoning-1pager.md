# 1-pager reasoning (MVP)

## Gathering data

I built a crawler that collects Otodom listings and stores **raw JSON snapshots** on disk. It runs ahead of the app (not on user requests), gathers URLs then detail pages with Playwright, and prefers **Schema.org JSON-LD** over brittle DOM scraping; page text stays mainly as fallback and audit material.

That separates acquisition from the rest of the stack and avoids depending on Otodom at runtime.

## MVP simplifications / execution model

The pipeline is **file-based stages** instead of a distributed ingestion system:

1. Crawl → raw JSON
2. Deterministic sanitization → compact JSON
3. Offline AI tagging → tagging JSON
4. Merge sanitized rows with AI output by `externalId`
5. Import into MySQL

Each stage can be rerun independently without recrawling or replaying every LLM call. JSON files are the **handoff points** — reproducible and cheap to iterate. A production setup would likely use queues or services; here the trade-off is simplicity over scale.

## Example scenarios

### Example A

The user wants a home in **Warszawa** with at least **four rooms**. They set City and Min rooms, press **Apply**, browse results, open an offer. **Result:** manual filters only.

### Example B (AI-assisted search)

*(AI-assisted mode must be enabled in app configuration.)*

They describe what they want in natural language and submit. The model maps that to **the same dimensions as Example A** (city, price, rooms, optional tags, keywords). They see a short assistant message and an updated list. Tag filters only match listings **already labeled at import**; the assistant suggests filters, not new per-row labels at read time. **Result:** less typing, still nothing beyond what the UI can express.

## Data sanitization and processing

Raw snapshots are **not** imported as-is. A **deterministic** sanitizer produces pipeline-ready JSON: strip HTML, normalize text, drop Otodom chrome, skip expired pages, keep structured fields. That boundary keeps unreliable crawl data out of the DB logic and avoids coupling later steps to AI.

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

**Offline tagging:** after sanitization, Gemini generates feature tags, a short summary, and optional inconsistency warnings per listing. Output is merged at **import** into optional columns. Browsing stays fast: **no LLM on ordinary list/detail reads.**

**Same vocabulary, three roles:** (1) those tags live on rows after import; (2) users can filter by tag ids in the UI (every selected tag must match — AND); (3) optional **AI-assisted search** interprets natural language and proposes **the same filter dimensions** (city, price, rooms, tags, keywords) — it negotiates filters, it does **not** re-tag every row at request time. Without an API key for search, behaviour degrades to a stub.

Why separate offline tagging from interactive search: repeatable enrichment, regenerable prompts, filters and NL search without overwriting deterministic fields.

## Key assumption

**Core listing UX and AI enrichment**

- I assume that core listing usability does not depend on AI enrichment.
- I assume that features such as tagging or summaries can be computed asynchronously after ingestion, without affecting the user experience.
- For the MVP, tags are still **precomputed** and stored so filters and search can use them without waiting on an LLM per page view.

## One success metric

- Primary metric: **data usability** — the share of listings that are complete, non-duplicated and lead to valid pages.

**Beyond the MVP**

- In a real product, add a user-facing metric such as **search-to-detail success rate** — whether people find and open relevant listings.

## One limitation / failure mode

The MVP sits on a **small dataset**, so natural-language or strict filters can easily return **nothing** — e.g. intent “premium near Warsaw” collapsing to exact city and tags when no rows match. **Mismatch:** vague or regional intent vs tight filters on thin data.

## What we’d improve with more time

- **Ingestion:** production-safe imports, better normalization, flag junk listings.
- **Sources:** feeds/APIs where possible; dedupe beyond `(source, externalId)` using similarity algorithm.
- **Search:** more listings; softer geography and ranking when exact filters starve; tags + full-text quality.
- **AI:** background enrichment jobs; lighter NL pipelines (heuristics first, LLM for the rest); optional gap-fill from text without inferring core numeric facts.
- **Observability:** coverage metrics, import/list QA views.

## Development notes

I used AI-assisted tools (Codex, Cursor, Playwright MCP-style exploration) during development to speed up iteration, especially for:

- initial crawler implementation,
- identifying stable selectors,
- improving code structure and readability.
- implementing sanitization mechanisms such as removing html etc.

All core logic (data pipeline, normalization) was reviewed and adjusted manually.