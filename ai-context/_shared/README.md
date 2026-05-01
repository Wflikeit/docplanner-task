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

## Frontend skills (curated)

Agents working on UI should also read:
- `ai-context/frontend-skills/react-rules.md`
- `ai-context/frontend-skills/composition-rules.md`
- `ai-context/frontend-skills/ui-ux-rules.md`
- `ai-context/frontend-skills/frontend-checklist.md`

## How to run (current state)

Backend currently has no `dev` script. Frontend uses Vite.

- Frontend dev: `cd frontend && npm run dev`
- Frontend build: `cd frontend && npm run build`
- Frontend lint: `cd frontend && npm run lint`

## Working rules (keep agents aligned)

- Prefer small, reviewable changes; don’t refactor unrelated code.
- Keep a single source of truth for requirements/decisions in `ai-context/_shared/` and link from provider configs.
- If you add new “rules”, add them here first, then only override per-provider when truly necessary.
- Always make sure that new code is testable

## Decisions / notes

If you make a non-trivial decision (data model, scraping source, AI usage), record it in a short markdown note under:
- `ai-context/_shared/decisions/` (create the folder when needed)
