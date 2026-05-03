# Frontend listings MVP — specification

This document describes what we built in `frontend/`: enough detail that someone (or an agent) could recreate it without reading the codebase first. It reflects the actual behaviour and contracts we wired up, not an aspirational architecture doc.

---

## What we’re building

A small browser for **property sale** listings (Otodom “na sprzedaż” style data): search and filters on one screen, full detail on another, typed HTTP calls, obvious loading/empty/error states, and no global client-side store. Filters and search live in the URL so links are shareable and the back button does what people expect. Structured filters include **minimum rooms**, **city**, **price band**, and optional **AI tag ids** (comma-separated in the URL, toggled as chips in the UI). When enabled, **AI-assisted search** sends the user’s wording to the backend and applies the returned **merged query** plus the first page of results.

We deliberately skipped Redux-style globals and a heavy design system. Presentation components stay small; route-level pages own router wiring and TanStack Query. API responses get mapped to UI-friendly shapes at the boundary—cards and detail views shouldn’t depend on raw JSON shapes deeper in the tree.

Out of scope for this MVP: changing backend contracts beyond what’s listed here, and polishing visuals beyond clarity and basic accessibility (labels, keyboard, don’t rely on colour alone).

---

## AI tagging vs AI search (what the frontend sees)

- **`aiTags`, `aiSummary`, … on each listing** are already stored when data was imported: they come from the **offline** tagging pipeline (Gemini per listing, merged at import). The UI **displays** them on cards and detail; it does not call Gemini per row.
- **Tag filter chips** use a **fixed list of tag ids** (`OTODOM_LISTING_TAG_IDS`). Choosing chips updates URL **`tags`** (comma-separated) and **`GET /api/listings`** — server requires **all** selected tags on a listing (AND).
- **AI-assisted search** (`VITE_AI_CONVERSATIONAL_SEARCH`): submitting text calls **`POST /api/listings/ai-search`**. The response **`mergedQuery`** may include **`tags`** as the **same** ids the chips use; the UI applies them like a suggested filter set. That endpoint adjusts **filters**, not the per-listing tag assignment logic.

---

## Stack

React 19, TypeScript, Vite 8, React Router 7, Tailwind 4, TanStack Query 5. Server state: `QueryClientProvider` + `useQuery` for list and detail.

---

## Vite and environment

Dev server proxies `/api` to your backend (e.g. `http://127.0.0.1:3000`). Variables prefixed `VITE_` map to `import.meta.env`.

- **`VITE_API_BASE_URL`** — Optional base URL for API calls; empty means same-origin `/api/...`.
- **`VITE_AI_CONVERSATIONAL_SEARCH`** — Set to `"true"` to turn on AI-assisted search from the main field; otherwise search is plain text + filters. Restart dev server after changing `.env`.

---

## App shell

`main.tsx`: `StrictMode`, `QueryClientProvider`, `App`. Reasonable Query defaults (short stale time, limited retries, no refetch on focus).

`App.tsx`: simple layout. Routes:

- `/` → listings index  
- `/listings/:id` → detail  
- `*` → redirect to `/` with `replace`

---

## Backend JSON the UI expects

JSON over HTTP; `Accept: application/json` and `Content-Type: application/json` for POSTs. Paths are relative or prefixed with `VITE_API_BASE_URL` if set.

### `GET /api/listings`

**Query parameters**

| Parameter | Meaning |
|-----------|---------|
| `q` | Free-text search |
| `city` | City filter |
| `priceMin`, `priceMax` | Non-negative numbers |
| `roomsMin` | Minimum rooms (integer ≥ 1). Server also accepts legacy **`rooms`** as an alias. |
| `tags` | Comma-separated tag ids (AND semantics on the server). |
| `page` | Page index (≥ 1) |
| `limit` | Page size; UI sends **12** |

**Response body**

| Field | Meaning |
|-------|---------|
| `items` | Array of listings |
| `total` | Total matching rows (all pages) |
| `page` | Current page index |
| `pageSize` | Matches `limit` |

**Each `items[]` element (`Listing`)** — required: `id`, `title`. Everything else optional / nullable (e.g. `description`, `priceAmount`, `priceCurrency`, `city`, `district`, `street`, `areaSqm`, `rooms`, `furnished`, `imageUrl`, `sourceUrl`, `externalId`, `createdAt`, `aiTags`, `aiSummary`, `aiTaggingWarnings`). Source of truth in repo: `frontend/src/api/listingsTypes.ts`.

### `GET /api/listings/:id`

Returns a single `Listing`. Errors include a JSON body when possible.

### `POST /api/listings/ai-search`

**Request body**

| Field | Meaning |
|-------|---------|
| `messages` | Chat messages (≥ 1). UI sends **one** `user` message per submit. |
| `activeFilters` | Optional. Structured filters from the panel — see table below. Omit unset keys. |

**`activeFilters` (all optional)**

| Field | Type | Meaning |
|-------|------|---------|
| `q` | string | Supported by API, but **UI does not send** user text here — only in `messages`. Model may merge a keyword into `mergedQuery.q`. |
| `city` | string | City |
| `priceMin`, `priceMax` | number | Price band |
| `roomsMin` | number | Minimum rooms |
| `tags` | string[] | Tag ids |

**Response body**

| Field | Meaning |
|-------|---------|
| `reply` | Short assistant text shown under the search field |
| `mergedQuery` | Canonical query aligned with `GET /api/listings` — see below |
| `listings` | Same shape as **`GET /api/listings`** for page 1 (items + total + page + pageSize) |

**`mergedQuery`** — same semantics as `GET /api/listings`; `tags` is a **JSON array** of ids here (GET uses a comma-separated string).

| Field | Meaning |
|-------|---------|
| `q` | Substring search term (may be empty / omitted) |
| `city`, `priceMin`, `priceMax`, `roomsMin` | As in GET |
| `tags` | Array of tag ids |
| `page` | Usually `1` after AI |
| `limit` | Page size (e.g. 12) |

The UI writes `mergedQuery` into the URL, shows `reply`, and seeds TanStack cache from `listings` so the list matches the POST without an extra GET.

---

## URL contract on the listings page

`q`, `city`, `priceMin`, `priceMax`, `roomsMin`, `tags` (comma-separated), `page`. Search text and filters are written to the URL on **submit** (Enter / Apply), not on every keystroke. `page` is clamped to valid range. Old links may use `rooms` instead of `roomsMin` (reader accepts both). `limit` is not in the URL (fixed in code).

---

## Listings page behaviour

List query tracks the **current URL** (stable string snapshot of `searchParams`), not typing drafts. Submit (Enter / Apply) commits search + filters (`roomsMin`, tag chips → `tags`) and resets `page` to 1. Paginate by changing `page`; clamp when results shrink.

Loading / error / empty states are explicit. Cards link to `/listings/:id` with **location state** carrying the list query string so “back” restores the list.

With **`VITE_AI_CONVERSATIONAL_SEARCH`**, submitting non-empty text runs **`POST /api/listings/ai-search`** (structured `activeFilters` from the panel only). On success: show assistant `reply`, apply `mergedQuery` to the URL, warm the query cache from response `listings`. Abort in-flight requests on unmount or on a new submit.

---

## Detail page behaviour

`useQuery` for `GET /api/listings/:id`, map to a display model in **`select`**. Standard loading / error / success. Optional **`aiSummary`** and **`aiTags`** appear in separate blocks below the main facts.

---

## HTTP helpers

Small wrappers around `fetch`: **`apiJson`**, **`apiPostJson`**, plus **`fetchListingsPage`**, **`fetchListingById`**, **`postAiListingSearch`**. Types live next to the calls.

---

## UI mapping

Cards: price, location (city / street / district), area, rooms, thumb, optional **`aiTags`** as badges. Filters: city, price band, min rooms, tag toggles (fixed tag id list). Detail: fact grid, description, source link, then AI summary / tags when present.

---

## File layout (reference)

Rough split: **`api/`** (types + clients), **`listings/`** (routes, filters, cards, pager, route params, merge helpers, UI mappers), **`query/`** (client + keys), **`runtime/`** (feature flag).

---

## Sanity checks before you call it done

List → detail → back preserves the query. Filters, **tag chips**, pager, bad API (error + retry), empty DB. With the AI flag: submit with text and check **`reply`**, URL from **`mergedQuery`**, and that suggested **`tags`** line up with chip ids. `npm run build`, `npm run lint`, `npm test`.

For style and composition habits, see `ai-context/frontend-skills/` — this file is the behaviour contract only.
