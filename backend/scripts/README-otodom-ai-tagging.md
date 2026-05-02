# Otodom — AI tagging (Gemini, search)

Offline pipeline step: **sanitized listings** → **Gemini** → JSON with **tags** + short **summary** (for AI / semantic search).  
Does **not** change core fields (price, area, …) — only `tags` / `summary` / optional `warnings`.

## Prerequisites

- `GEMINI_API_KEY` from [Google AI Studio](https://aistudio.google.com/apikey)
- Compact sanitized file: `{ "source": "otodom", "items": [ ... ] }`  
  (from `npm run sanitize:otodom`)

## Commands (from `backend/`)

| Step | Command | Output |
|------|---------|--------|
| Sanitize (no AI) | `npm run sanitize:otodom` | e.g. `data/processed/otodom-listings.sanitized.json` |
| Preview model input (no API) | `npm run preview:otodom:tagging-inputs` | `data/test-data.tagging-inputs.preview.json` (default paths) |
| Run tagging (**all** rows in input, unless `OTODOM_TAGGING_LIMIT`) | `npm run tag:otodom:gemini` | `data/test-data.tagged.json` (defaults) |
| Smoke (**exactly 1** row, no delay — for CI / key check only) | `npm run tag:otodom:gemini:test` | overwrites same default out path with 1 row |

### How many rows?

- **`npm run tag:otodom:gemini`** calls Gemini **once per item** in the sanitized `items` array (or the first **N** if you set **`OTODOM_TAGGING_LIMIT`**).
- Repo default input **`data/test-data.sanitized.json`** is a **fixture with a single offer** — so you naturally get **one** row in `test-data.tagged.json`. That is not a script bug.
- For **dozens / hundreds** of tagged rows: crawl a larger snapshot → sanitize to e.g. `data/processed/otodom-listings.sanitized.json` → run tagging with that path:

```bash
OTODOM_SANITIZED_PATH=data/processed/otodom-listings.sanitized.json \
OTODOM_TAGGING_OUT=data/processed/otodom-listings.tagged.json \
npm run tag:otodom:gemini
```

Do **not** use `tag:otodom:gemini:test` when you want a full batch — that script **forces** `OTODOM_TAGGING_LIMIT=1`.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | **Required** for `tag:otodom:gemini`. |
| `OTODOM_GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model id (stable; avoid `gemini-2.0-flash` for new API keys — 404). |
| `OTODOM_SANITIZED_PATH` | `data/test-data.sanitized.json` | Input sanitized JSON. |
| `OTODOM_TAGGING_OUT` | `data/test-data.tagged.json` | Output JSON path. |
| `OTODOM_TAGGING_LIMIT` | _(all)_ | Max rows to process. |
| `OTODOM_TAGGING_DELAY_MS` | `400` | Pause between API calls (0 allowed). |
| `OTODOM_TAGGING_PROMPT_PATH` | _(default shipped prompt)_ | Override prompt file (path relative to `backend/` or absolute). |

See also `backend/.env.example`.

## Repo layout (tagging)

| Piece | Path |
|-------|------|
| Prompt (shipped) | `src/infrastructure/ai/prompts/listing-tagging.prompt.md` |
| Allowed tags + parse / types | `src/infrastructure/ai/otodomTagging.ts` |
| Compact input DTO | `toLlmTaggingInput` in `src/infrastructure/data-pipeline/otodom/ai/llmInputTransformers.ts` |
| Gemini script | `scripts/tag-otodom-with-gemini.ts` |
| Input preview script | `scripts/preview-otodom-tagging-inputs.ts` |

## Output shape (`OTODOM_TAGGING_OUTPUT_KIND`)

Root object:

- `source`: `"otodom"`
- `meta`: `{ outputKind, model, generatedAt, inputPath }` — `outputKind` is `otodom_tagging_gemini_v1`
- `items[]`: per listing
  - `externalId`
  - `tagging`: payload sent to the model (`LlmTaggingInput`)
  - `gemini`: on success — `{ tags, summary, warnings? }` (tags filtered to allowed set)
  - `error` / `modelTextSnippet`: on failure or invalid model JSON

Validate loaded files with `isOtodomGeminiTaggingFileBody()` from `src/infrastructure/ai/otodomTagging.ts`.

## Import: merge tagging into MySQL

After **`npm run tag:otodom:gemini`**, run **`npm run import:otodom:mysql`** (with `DATABASE_URL`). The importer merges each row’s `gemini` block into DB columns (`tags_json`, `ai_summary`, `ai_warnings_json`, …) keyed by **`externalId`**.

The running API then serves **`aiTags`**, **`aiSummary`**, **`aiTaggingWarnings`** from those columns — **not** from on-disk tagged JSON or tagging env vars at HTTP request time.

Use sanitized + tagged JSON paths expected by the import script so rows align with tagging output (see [`README-otodom-mysql-import.md`](README-otodom-mysql-import.md)).

## Crawl vs tagging

Raw crawl is documented in [`README-otodom-crawl.md`](README-otodom-crawl.md).  
Typical order: **crawl** → **sanitize** → **preview** (optional) → **`npm run tag:otodom:gemini`** → **`npm run import:otodom:mysql`** → **`npm run dev`** (with `DATABASE_URL`).
