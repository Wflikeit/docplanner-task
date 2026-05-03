import { OTODOM_ALLOWED_TAGS } from '../infrastructure/ai/index.js'

import type { ListListingsQuery } from './listingPageTypes.js'

/** Filters the UI / client already had when the user submitted AI search. */
export type AiListingSearchActiveFilters = {
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  roomsMin?: number
  tags?: string[]
}

/** Model delta: omit key = leave active value; null = clear; value = set. */
export type AiListingSearchModelPatch = {
  q?: string | null
  city?: string | null
  priceMin?: number | null
  priceMax?: number | null
  roomsMin?: number | null
  tags?: string[] | null
}

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12

export function filterToAllowedTags(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const t = raw.trim()
    if (t === '' || !OTODOM_ALLOWED_TAGS.has(t) || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function mergeScalarField(
  base: string | undefined,
  patch: string | null | undefined,
): string | undefined {
  if (patch === undefined) return base
  if (patch === null) return undefined
  const t = patch.trim()
  return t === '' ? undefined : t
}

function mergeNumberField(
  base: number | undefined,
  patch: number | null | undefined,
): number | undefined {
  if (patch === undefined) return base
  if (patch === null || Number.isNaN(patch)) return undefined
  return patch
}

function mergeTagsField(
  base: string[] | undefined,
  patch: string[] | null | undefined,
): string[] | undefined {
  if (patch === undefined) {
    if (base === undefined || base.length === 0) return undefined
    const filtered = filterToAllowedTags(base)
    return filtered.length === 0 ? undefined : filtered
  }
  if (patch === null) return undefined
  const filtered = filterToAllowedTags(patch)
  return filtered.length === 0 ? undefined : filtered
}

/**
 * Combines active filters with the model patch, then normalizes to `ListListingsQuery` (page 1).
 */
export function mergeAiSearchIntoListQuery(
  active: AiListingSearchActiveFilters,
  patch: AiListingSearchModelPatch,
): ListListingsQuery {
  const q = mergeScalarField(active.q?.trim() || undefined, patch.q)
  const city = mergeScalarField(active.city?.trim() || undefined, patch.city)
  const priceMin = mergeNumberField(active.priceMin, patch.priceMin)
  const priceMax = mergeNumberField(active.priceMax, patch.priceMax)
  const roomsMin = mergeNumberField(active.roomsMin, patch.roomsMin)
  const tags = mergeTagsField(active.tags, patch.tags)

  const out: ListListingsQuery = {
    page: DEFAULT_PAGE,
    limit: DEFAULT_LIMIT,
  }
  if (q !== undefined) out.q = q
  if (city !== undefined) out.city = city
  if (priceMin !== undefined) out.priceMin = priceMin
  if (priceMax !== undefined) out.priceMax = priceMax
  if (roomsMin !== undefined) out.roomsMin = roomsMin
  if (tags !== undefined && tags.length > 0) out.tags = tags
  return out
}
