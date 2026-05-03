import type { ListingRouteFilters } from '../listings/routes/listingRouteParams'

export const queryKeys = {
  listings: (route: ListingRouteFilters) =>
    [
      'listings',
      route.q,
      route.city,
      route.priceMin,
      route.priceMax,
      route.roomsMin,
      route.tags,
      route.page,
    ] as const,

  listing: (id: string) => ['listing', id] as const,
}
