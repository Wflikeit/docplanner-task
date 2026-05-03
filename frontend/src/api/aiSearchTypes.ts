import type { PaginatedListings } from './listingsTypes'

export type AiChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

/** Filters the UI had when the user ran AI search (optional keys). */
export type AiListingSearchActiveFilters = {
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  roomsMin?: number
  tags?: string[]
}

export type AiListingSearchRequest = {
  messages: AiChatMessage[]
  activeFilters?: AiListingSearchActiveFilters
}

/** Canonical query after server merge (aligns with GET /api/listings). */
export type AiListingSearchMergedQuery = {
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
  mergedQuery: AiListingSearchMergedQuery
  listings: PaginatedListings
}
