import {
  filterListings,
  type ListingSearchCriteria,
} from '../domain/listingSearch.js'
import type { Listing } from '../domain/listing.js'
import type { ListingSourcePort } from './listingSourcePort.js'

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

export function listListingsPage(
  source: ListingSourcePort,
  query: ListListingsQuery,
): ListingsPageResult {
  const criteria: ListingSearchCriteria = {
    q: query.q,
    city: query.city,
    priceMin: query.priceMin,
    priceMax: query.priceMax,
    rooms: query.rooms,
  }
  const filtered = filterListings(source.getAll(), criteria)
  const total = filtered.length
  const start = (query.page - 1) * query.limit
  const items = filtered.slice(start, start + query.limit)
  return {
    items,
    total,
    page: query.page,
    pageSize: query.limit,
  }
}

export function getListingById(
  source: ListingSourcePort,
  id: string,
): Listing | undefined {
  return source.getById(id)
}
