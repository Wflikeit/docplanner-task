import { fetchListingsPage } from '../../api/listingsApi'
import {
  toListingsApiParams,
  type ListingRouteFilters,
} from '../routes/listingRouteParams'
import { toListingCard, type ListingCardModel } from '../utils/listingUi'

export type ListingsQueryResult = {
  items: ListingCardModel[]
  total: number
  pageSize: number
}

/** Fetches a single page — `route.page` is the server page index (≥ 1). */
export async function fetchListingsForRoute(
  route: ListingRouteFilters,
  signal: AbortSignal,
): Promise<ListingsQueryResult> {
  const page = await fetchListingsPage(
    toListingsApiParams(route, route.page),
    signal,
  )
  return {
    items: page.items.map(toListingCard),
    total: page.total,
    pageSize: page.pageSize,
  }
}
