import type { Listing } from '../../domain/listing.js'
import type { ListingsPageResult } from '../../application/listingUseCases.js'
import type {
  AiListingSearchResponse,
  ListingResource,
  PaginatedListings,
} from '../http/types.js'
import type { AiListingSearchResult } from '../../application/aiListingSearchUseCase.js'

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

export function toAiListingSearchResponse(
  result: AiListingSearchResult,
): AiListingSearchResponse {
  return { ...result }
}
