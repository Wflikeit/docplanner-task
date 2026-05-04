import type { Listing } from '../domain/listing.js'

/** Listing search filters (HTTP + Prisma); no separate domain types file for MVP. */
export type ListingSearchCriteria = {
  /** Echoed for URL / UI only; listing queries do not filter rows by this field. */
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  roomsMin?: number
  /** Listing must contain every tag (AND). IDs from offline tagging vocabulary. */
  tags?: string[]
}

export type ListListingsQuery = ListingSearchCriteria & {
  page: number
  limit: number
}

export type ListingsPageResult = {
  items: Listing[]
  total: number
  page: number
  pageSize: number
}
