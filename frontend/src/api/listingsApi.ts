import { apiJson } from './client'
import type {
  Listing,
  ListingsQueryParams,
  PaginatedListings,
} from './listingsTypes'

function buildQuery(params: ListingsQueryParams): string {
  const search = new URLSearchParams()
  if (params.q) search.set('q', params.q)
  if (params.city) search.set('city', params.city)
  if (params.priceMin !== undefined)
    search.set('priceMin', String(params.priceMin))
  if (params.priceMax !== undefined)
    search.set('priceMax', String(params.priceMax))
  if (params.roomsMin !== undefined)
    search.set('roomsMin', String(params.roomsMin))
  if (params.tags?.length)
    search.set('tags', params.tags.join(','))
  if (params.page !== undefined) search.set('page', String(params.page))
  if (params.limit !== undefined) search.set('limit', String(params.limit))
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export async function fetchListingsPage(
  params: ListingsQueryParams,
  signal?: AbortSignal,
): Promise<PaginatedListings> {
  return apiJson<PaginatedListings>(`/api/listings${buildQuery(params)}`, {
    signal,
  })
}

export async function fetchListingById(
  id: string,
  signal?: AbortSignal,
): Promise<Listing> {
  return apiJson<Listing>(`/api/listings/${encodeURIComponent(id)}`, {
    signal,
  })
}
