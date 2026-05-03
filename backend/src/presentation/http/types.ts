/**
 * JSON shapes for this HTTP API (wire contract).
 * Align with `frontend/src/api/listingsTypes.ts` and `aiSearchTypes.ts`.
 *
 * `ListingResource` matches the frontend `Listing` type (domain uses `Listing` too — mapper bridges them).
 */

export type ListingResource = {
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
  aiTags?: string[] | null
  aiSummary?: string | null
  aiTaggingWarnings?: string[] | null
}

export type PaginatedListings = {
  items: ListingResource[]
  total: number
  page: number
  pageSize: number
}

/** Canonical listing query after merge (page 1 from AI path). */
export type AiListingSearchMergedQueryWire = {
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  roomsMin?: number
  tags?: string[]
  page: number
  limit: number
}

export type AiListingSearchResponse = {
  reply: string
  mergedQuery: AiListingSearchMergedQueryWire
  listings: PaginatedListings
}
