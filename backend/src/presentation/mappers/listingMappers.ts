import type { ListListingsQuery } from '../../application/listingPageTypes.js'
import type { Listing } from '../../domain/listing.js'
import type { ListingsPageResult } from '../../application/listingUseCases.js'
import type {
  AiListingSearchMergedQueryWire,
  AiListingSearchResponse,
  ListingResource,
  PaginatedListings,
} from '../http/types.js'

export function toListingResource(listing: Listing): ListingResource {
  return { ...listing }
}

export function toPaginatedListings(
  page: ListingsPageResult,
): PaginatedListings {
  return {
    items: page.items.map(toListingResource),
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
  }
}

export function toAiListingSearchMergedQueryWire(
  q: ListListingsQuery,
): AiListingSearchMergedQueryWire {
  return {
    q: q.q,
    city: q.city,
    priceMin: q.priceMin,
    priceMax: q.priceMax,
    roomsMin: q.roomsMin,
    tags: q.tags,
    page: q.page,
    limit: q.limit,
  }
}

export function toAiListingSearchHttpResponse(input: {
  reply: string
  mergedQuery: ListListingsQuery
  listingsPage: ListingsPageResult
}): AiListingSearchResponse {
  return {
    reply: input.reply,
    mergedQuery: toAiListingSearchMergedQueryWire(input.mergedQuery),
    listings: toPaginatedListings(input.listingsPage),
  }
}
