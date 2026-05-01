# React rules (MVP, React + Vite + TS)

Goal: build a clean listings UX (browse/search/details) without overengineering.

## Data fetching & state

- Keep async states explicit: `idle | loading | success | error`.
- Always render `loading`, `empty`, and `error` states (especially for search + listing).
- Avoid fetch loops: effects depend only on stable inputs; compute derived values with `useMemo` when needed.
- Cancel/ignore stale requests (use `AbortController` or a request id) when query/filters change quickly.

## Component boundaries

- Prefer page-level containers that own data fetching (`ListingsPage`, `ListingDetailsPage`) + presentational components for UI.
- Keep props small and typed; avoid passing “raw API response” deep into UI—map to a UI-friendly shape near the boundary.

## Rendering

- Use stable keys from listing IDs (never array index).
- Don’t prematurely optimize performance; do the obvious wins first (avoid unnecessary state, avoid rerender cascades).

## Forms & inputs (search)

- Debounce text search if it hits the backend on every keystroke.
- Keep filters in a single state object; update immutably; serialize to query string if helpful.
- Prefer URL-driven state for listings: keep `q`, `city`, `priceMin/priceMax`, `rooms`, `page` in query params so the view is shareable and “back” preserves state.
