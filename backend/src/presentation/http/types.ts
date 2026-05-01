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
  areaSqm?: number | null
  rooms?: number | null
  furnished?: boolean | null
  isNewOffer?: boolean | null
  imageUrl?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  createdAt?: string | null
}

export type PaginatedListings = {
  items: ListingResource[]
  total: number
  page: number
  pageSize: number
}

export type AiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AiListingSearchRequest = {
  messages: AiChatMessage[]
}

export type AiListingSearchResponse = {
  reply: string
  q?: string | null
  city?: string | null
  priceMin?: number | null
  priceMax?: number | null
  rooms?: number | null
}
