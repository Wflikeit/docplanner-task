# Frontend PR checklist (max 10)

1) Listing/search/details flows work end-to-end.
2) Listing page has `loading`, `empty`, and `error` states.
3) Search + filters are reflected in the URL (query params) and are shareable.
4) Navigating to details and back preserves search/filters (via URL, not hidden state).
5) API → UI mapping happens near the boundary (UI does not depend on raw backend shape).
6) List rendering uses stable keys (listing `id`), not array indexes.
7) Inputs have labels; buttons/controls are keyboard-accessible.
8) Pagination or “load more” works with current filters and has clear affordances.
9) No boolean-prop explosion; variants are explicit components when UI diverges.
10) Scope stays MVP: no heavy animations/design systems/over-abstractions.

