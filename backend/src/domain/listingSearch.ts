import type { Listing } from './listing.js'

export type ListingSearchCriteria = {
  q?: string
  city?: string
  priceMin?: number
  priceMax?: number
  rooms?: number
}

/** PL/EN city spellings for substring match on mock data (`q` + `city` filter). */
const CITY_ALT: Record<string, string> = {
  warszawa: 'warsaw',
  warsaw: 'warszawa',
  kraków: 'krakow',
  krakow: 'kraków',
  gdańsk: 'gdansk',
  gdansk: 'gdańsk',
  poznań: 'poznan',
  poznan: 'poznań',
  wrocław: 'wroclaw',
  wroclaw: 'wrocław',
}

function cityHay(cityRaw: string): string {
  const raw = cityRaw.trim()
  const key = raw.toLowerCase()
  if (!key) return ''
  const alt = CITY_ALT[key]
  return alt ? `${raw} ${alt}` : raw
}

export function filterListings(
  listings: readonly Listing[],
  criteria: ListingSearchCriteria,
): Listing[] {
  const qLower = criteria.q?.trim().toLowerCase()
  return listings.filter((l) => {
    if (criteria.city?.trim()) {
      const needle = criteria.city.trim().toLowerCase()
      if (!cityHay(l.city ?? '').toLowerCase().includes(needle)) return false
    }
    if (
      criteria.priceMin !== undefined &&
      (l.priceAmount ?? 0) < criteria.priceMin
    )
      return false
    if (
      criteria.priceMax !== undefined &&
      (l.priceAmount ?? Infinity) > criteria.priceMax
    )
      return false
    if (criteria.rooms !== undefined && (l.rooms ?? 0) < criteria.rooms)
      return false
    if (qLower) {
      const hay =
        `${l.title} ${l.description ?? ''} ${cityHay(l.city ?? '')} ${l.district ?? ''}`.toLowerCase()
      if (!hay.includes(qLower)) return false
    }
    return true
  })
}
