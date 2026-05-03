import { describe, expect, it } from 'vitest'
import {
  draftToActiveFiltersForAiSearch,
  parseListingRouteFilters,
} from './listingRouteParams'

describe('parseListingRouteFilters', () => {
  it('parses known keys and defaults page to 1', () => {
    const p = new URLSearchParams()
    p.set('q', ' krak ')
    p.set('city', 'Kraków')
    p.set('priceMin', '1000')
    p.set('page', '2')
    expect(parseListingRouteFilters(p)).toEqual({
      q: ' krak ',
      city: 'Kraków',
      priceMin: '1000',
      priceMax: '',
      roomsMin: '',
      tags: '',
      page: 2,
    })
  })

  it('clamps invalid page to 1', () => {
    const p = new URLSearchParams()
    p.set('page', '0')
    expect(parseListingRouteFilters(p).page).toBe(1)
  })
})

describe('draftToActiveFiltersForAiSearch', () => {
  it('omits q even when draft has search text (NL only in messages)', () => {
    expect(
      draftToActiveFiltersForAiSearch({
        q: 'segment w centrum',
        city: 'Warszawa',
        priceMin: '',
        priceMax: '',
        roomsMin: '',
        tags: '',
      }),
    ).toEqual({ city: 'Warszawa' })
  })

  it('still passes tags and numeric filters', () => {
    expect(
      draftToActiveFiltersForAiSearch({
        q: 'x',
        city: '',
        priceMin: '2000',
        priceMax: '4000',
        roomsMin: '2',
        tags: 'quiet_area, city_center',
      }),
    ).toEqual({
      priceMin: 2000,
      priceMax: 4000,
      roomsMin: 2,
      tags: ['quiet_area', 'city_center'],
    })
  })
})
