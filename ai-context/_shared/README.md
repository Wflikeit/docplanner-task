# Shared AI context (source of truth)

This folder is the canonical context for *all* AI tools (Codex, Cursor, Claude, etc.).

## What this project is

MVP: a simplified real estate listings platform (scrape/fetch ~100 offers, normalize, store in DB, browse/search in UI).

Primary spec: `ai-context/task-details.md`

## Repo layout

- `backend/` — Node.js + TypeScript backend
- `frontend/` — React + Vite frontend

## Backend architecture (hexagonal)

Agents working on backend should follow:
- `ai-context/_shared/hexagonal-architecture-rules.md`
- `ai-context/_shared/data-import-scraping-rules.md`

## Assignment alignment (always)

After larger steps, run a quick anti-overengineering check:
- `ai-context/_shared/assignment-alignment-review-rule.md`

## Deliverables

- 1‑pager reasoning doc: `ai-context/_shared/reasoning-1pager.md`

## Frontend skills (curated)

Agents working on UI should also read:
- `ai-context/frontend-skills/react-rules.md`
- `ai-context/frontend-skills/composition-rules.md`
- `ai-context/frontend-skills/ui-ux-rules.md`
- `ai-context/frontend-skills/frontend-checklist.md`

## How to run (current state)

- **Full stack (Docker):** from repo root, `docker compose up --build` (or `cd backend && npm run db:up` for containers only). Browser: `http://localhost:18080` — frontend nginx proxies `/api` to the backend (see root `docker-compose.yaml`).
- **Backend API (local):** from `backend/`, set `DATABASE_URL` and `npm run dev` (`tsx watch`).
- **Frontend (local):** `cd frontend && npm run dev` (Vite).
- Frontend build: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`

## Working rules (keep agents aligned)

- Prefer small, reviewable changes; don’t refactor unrelated code.
- Keep a single source of truth for requirements/decisions in `ai-context/_shared/` and link from provider configs.
- If you add new “rules”, add them here first, then only override per-provider when truly necessary.
- Always make sure that new code is testable

## LLM prompts used by the product

Importer/sanitization code reads prompts from **`backend/src/infrastructure/ai/prompts/`** — shipped configuration for the pipeline, not Cursor/agent chat.

There is no duplicate prompt body under `ai-context/`; `ai-context/_shared/prompts/listing-tagging.md` is only a pointer to the backend tagging prompt (for AI search).

## Decisions / notes

If you make a non-trivial decision (data model, scraping source, AI usage), record it in a short markdown note under:
- `ai-context/_shared/decisions/` (create the folder when needed)
