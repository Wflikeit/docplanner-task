import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseGeminiListingSearchIntentText } from './listingAiSearchGemini.js'

describe('parseGeminiListingSearchIntentText', () => {
  it('parses minimal JSON', () => {
    const r = parseGeminiListingSearchIntentText(
      '{"reply":"Hello","tags":["quiet_area"]}',
    )
    assert.ok(r)
    assert.equal(r!.reply, 'Hello')
    assert.deepEqual(r!.tags, ['quiet_area'])
  })

  it('accepts fenced JSON', () => {
    const r = parseGeminiListingSearchIntentText(
      '```json\n{"reply":"x","q":null}\n```',
    )
    assert.ok(r)
    assert.equal(r!.q, null)
  })

  it('rejects invalid types', () => {
    assert.equal(
      parseGeminiListingSearchIntentText('{"reply":"x","roomsMin":"two"}'),
      null,
    )
  })

  it('rejects tags outside the allowed vocabulary', () => {
    assert.equal(
      parseGeminiListingSearchIntentText(
        '{"reply":"x","tags":["not_a_real_tag"]}',
      ),
      null,
    )
  })
})
