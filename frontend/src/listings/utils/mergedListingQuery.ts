import type { AiListingSearchMergedQuery } from '../../api/aiSearchTypes'
import type { ListingRouteFilters } from '../routes/listingRouteParams'

/** Builds URL search params from server `mergedQuery` (single source after AI search). */
export function mergedListingQueryToUrlSearchParams(
  m: AiListingSearchMergedQuery,
): URLSearchParams {
  const p = new URLSearchParams()
  if (m.q?.trim()) p.set('q', m.q.trim())
  if (m.city?.trim()) p.set('city', m.city.trim())
  if (m.priceMin !== undefined) p.set('priceMin', String(m.priceMin))
  if (m.priceMax !== undefined) p.set('priceMax', String(m.priceMax))
  if (m.roomsMin !== undefined) p.set('roomsMin', String(m.roomsMin))
  if (m.tags?.length) p.set('tags', m.tags.join(','))
  p.set('page', String(m.page))
  return p
}

export function listingRouteFiltersFromMergedQuery(
  m: AiListingSearchMergedQuery,
): ListingRouteFilters {
  return {
    q: m.q?.trim() ?? '',
    city: m.city?.trim() ?? '',
    priceMin: m.priceMin !== undefined ? String(m.priceMin) : '',
    priceMax: m.priceMax !== undefined ? String(m.priceMax) : '',
    roomsMin: m.roomsMin !== undefined ? String(m.roomsMin) : '',
    tags: m.tags?.length ? m.tags.join(',') : '',
    page: m.page,
  }
}
