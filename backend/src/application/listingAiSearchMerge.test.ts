import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterToAllowedTags,
  mergeAiSearchIntoListQuery,
} from './listingAiSearchMerge.js'

describe('filterToAllowedTags', () => {
  it('keeps allowed ids and dedupes', () => {
    assert.deepEqual(
      filterToAllowedTags(['near_forest', 'bogus', 'near_forest', ' quiet_area ']),
      ['near_forest', 'quiet_area'],
    )
  })
})

describe('mergeAiSearchIntoListQuery', () => {
  it('applies patch over active and resets page to 1', () => {
    const q = mergeAiSearchIntoListQuery(
      { city: 'Warsaw', priceMax: 5000, tags: ['garage'] },
      { roomsMin: 3, tags: ['near_forest'] },
    )
    assert.equal(q.page, 1)
    assert.equal(q.limit, 12)
    assert.equal(q.city, 'Warsaw')
    assert.equal(q.priceMax, 5000)
    assert.equal(q.roomsMin, 3)
    assert.deepEqual(q.tags, ['near_forest'])
  })

  it('null clears a field', () => {
    const q = mergeAiSearchIntoListQuery(
      { city: 'Krakow', q: 'loft' },
      { city: null },
    )
    assert.equal(q.city, undefined)
    assert.equal(q.q, 'loft')
  })

  it('omitted patch keys keep active', () => {
    const q = mergeAiSearchIntoListQuery({ city: 'Gdansk', tags: ['garden'] }, {})
    assert.equal(q.city, 'Gdansk')
    assert.deepEqual(q.tags, ['garden'])
  })
})
