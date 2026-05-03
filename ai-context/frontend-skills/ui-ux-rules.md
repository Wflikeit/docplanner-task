# UI/UX rules (listings MVP)

Focus: clarity, searchability, consistency.

## Listing page

- Show a clear “results summary” (count + active filters/search phrase).
- Always support `loading`, `empty results`, and `error` states with actionable copy.
- Use pagination or “Load more” (infinite scroll only if trivial).
- Keep cards scannable: price, location, area, rooms, key badges (e.g. “new”, “furnished” if available).

## Search & filters

- Prioritize 2–4 filters that matter for **buying** (e.g. city/district, price range, rooms, area).
- Keep filters reversible: easy “clear all” and per-filter clear.
- Preserve user input on navigation back from details.
- Make search shareable: reflect active search/filters in the URL (query params).

## Details page

- Start with the essentials (title, price, location, main attributes), then description, then raw/source info.
- If data is missing/uncertain, show it as “unknown” (don’t invent values).

## Accessibility basics

- Inputs have labels; buttons have text/aria-labels.
- Keyboard navigation works for filters and pagination.
- Color is not the only signal (use text/badges/icons with labels).
