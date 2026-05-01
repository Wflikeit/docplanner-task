# Data import / scraping rule (MVP)

For MVP data import, use Playwright only as an **infrastructure adapter**.

## Rules

- Do not put Playwright, DOM, scraping, selectors, or browser logic in `domain` or `application`.
- Use MCP only during development to inspect pages and discover selectors.
- The final importer must be deterministic code, runnable without AI/MCP at runtime.
- Import should be a manual script, not a public HTTP endpoint.
- Imported data must be sanitized, validated, deduplicated, and written via repository upsert/skip.
- The importer must be safe to rerun.
- Use `sourceUrl` as the primary deduplication key and enforce it as unique in DB.
- Prefer small batches and graceful skipping over failing the whole import.
- Keep it single-source and MVP-friendly unless explicitly asked to generalize.

