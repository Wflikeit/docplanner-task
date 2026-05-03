import type { ListingsQueryParams } from '../../api/listingsTypes'
import type { AiListingSearchActiveFilters } from '../../api/aiSearchTypes'

export const LISTINGS_PAGE_SIZE = 12

export type ListingRouteFilters = {
  q: string
  city: string
  priceMin: string
  priceMax: string
  roomsMin: string
  /** Comma-separated tag ids from AI search or manual URL. */
  tags: string
  page: number
}

export function parseListingRouteFilters(
  searchParams: URLSearchParams,
): ListingRouteFilters {
  const pageRaw = searchParams.get('page')
  const parsed = parseInt(pageRaw ?? '1', 10)
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1

  return {
    q: searchParams.get('q') ?? '',
    city: searchParams.get('city') ?? '',
    priceMin: searchParams.get('priceMin') ?? '',
    priceMax: searchParams.get('priceMax') ?? '',
    roomsMin:
      searchParams.get('roomsMin') ?? searchParams.get('rooms') ?? '',
    tags: searchParams.get('tags') ?? '',
    page,
  }
}

function optNonNegativeNumber(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

function optMinRooms(raw: string): number | undefined {
  if (!raw.trim()) return undefined
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

function optTags(raw: string): string[] | undefined {
  const parts = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
  return parts.length > 0 ? parts : undefined
}

/** Maps URL listing filters to a single API request (one page). */
export function toListingsApiParams(
  filters: ListingRouteFilters,
  page: number,
): ListingsQueryParams {
  const priceMin = optNonNegativeNumber(filters.priceMin)
  const priceMax = optNonNegativeNumber(filters.priceMax)
  const roomsMin = optMinRooms(filters.roomsMin)
  const tags = optTags(filters.tags)

  return {
    q: filters.q.trim() || undefined,
    city: filters.city.trim() || undefined,
    priceMin,
    priceMax,
    roomsMin,
    tags,
    page,
    limit: LISTINGS_PAGE_SIZE,
  }
}

/** Active filters for `POST /api/listings/ai-search` from current draft + URL-derived fields. */
export function draftToActiveFiltersWire(
  draft: Pick<
    ListingRouteFilters,
    'q' | 'city' | 'priceMin' | 'priceMax' | 'roomsMin' | 'tags'
  >,
): AiListingSearchActiveFilters {
  const out: AiListingSearchActiveFilters = {}
  const q = draft.q.trim()
  if (q) out.q = q
  const city = draft.city.trim()
  if (city) out.city = city
  const priceMin = optNonNegativeNumber(draft.priceMin)
  if (priceMin !== undefined) out.priceMin = priceMin
  const priceMax = optNonNegativeNumber(draft.priceMax)
  if (priceMax !== undefined) out.priceMax = priceMax
  const roomsMin = optMinRooms(draft.roomsMin)
  if (roomsMin !== undefined) out.roomsMin = roomsMin
  const tags = optTags(draft.tags)
  if (tags) out.tags = tags
  return out
}

/**
 * Payload for `POST /api/listings/ai-search`: structured filters only.
 * Never sends `q` — the user’s wording lives in `messages`; SQL `q` is substring match on listings
 * and must come only from the model patch (short keywords), not from the chat box.
 */
export function draftToActiveFiltersForAiSearch(
  draft: Pick<
    ListingRouteFilters,
    'q' | 'city' | 'priceMin' | 'priceMax' | 'roomsMin' | 'tags'
  >,
): AiListingSearchActiveFilters {
  const { q: _drop, ...rest } = draftToActiveFiltersWire(draft)
  return rest
}
