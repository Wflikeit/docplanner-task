# React composition rules (keep it maintainable)

Derived from `composition-patterns` but scoped to this MVP.

## Avoid boolean prop proliferation

- Don’t add props like `isCompact`, `isAdmin`, `isDetails`, `isCard`, `isRow` to one mega-component.
- Prefer explicit variants:
  - `ListingCard` and `ListingRow` instead of `Listing isRow`.
  - `ListingsFilters` and `ListingsToolbar` instead of `SearchBar showFilters`.

## Prefer composition over configuration

- Let pages compose small parts:
  - `ListingsPage` composes `SearchInput`, `FiltersPanel`, `ResultsList`, `Pagination`.
- If a component becomes “framework-ish”, split it into a small provider + subcomponents (compound components) only when it truly reduces prop drilling.

## Lift state intentionally

- Keep state at the lowest level that needs it, but don’t trap shared state in deep children.
- If multiple siblings need the same state (e.g. filters + pagination + results count), lift it to the page container.

