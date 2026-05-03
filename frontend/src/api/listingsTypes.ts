/**
 * API models for listings (`GET /api/listings`, `GET /api/listings/:id`).
 * `:id` is the listing primary key as a decimal string (`listings.id`).
 * Keep field names aligned with the backend — change here only when the API changes.
 */

export type Listing = {
  /** DB primary key as decimal string (MySQL). */
  id: string
  title: string
  description?: string | null
  priceAmount?: number | null
  priceCurrency?: string | null
  city?: string | null
  district?: string | null
  street?: string | null
  areaSqm?: number | null
  rooms?: number | null
  furnished?: boolean | null
  imageUrl?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  createdAt?: string | null
  /** Populated when backend merges `tag-otodom-with-gemini` output at startup. */
  aiTags?: string[] | null
  aiSummary?: string | null
  aiTaggingWarnings?: string[] | null
}

export type PaginatedListings = {
  items: Listing[]
  total: number
  page: number
  pageSize: number
}

export type ListingsQueryParams = {
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  /** Minimum number of rooms (`roomsMin` query param). */
  roomsMin?: number
  /** Tag ids (comma-separated in the URL). */
  tags?: string[]
  page?: number
  limit?: number
}
