import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildMockListingSearchIntent,
  clampConversationBlockForLlm,
  normalizeAiSearchPatchAfterIntent,
} from './aiListingSearchUseCase.js'

describe('clampConversationBlockForLlm', () => {
  it('leaves short blocks unchanged', () => {
    assert.equal(clampConversationBlockForLlm('hello', 10), 'hello')
  })

  it('truncates and annotates when over limit', () => {
    const s = clampConversationBlockForLlm('abcdefghij', 5)
    assert.ok(s.startsWith('abcde'))
    assert.ok(s.includes('truncated'))
  })
})

describe('buildMockListingSearchIntent', () => {
  it('returns reply only (no structured patch — real Gemini does intent)', () => {
    const intent = buildMockListingSearchIntent([
      { role: 'user', content: 'two rooms in Warsaw' },
    ])
    assert.ok(intent.reply.includes('GEMINI_API_KEY'))
    assert.equal(intent.roomsMin, undefined)
    assert.equal(intent.city, undefined)
    assert.equal(intent.q, undefined)
  })
})

describe('normalizeAiSearchPatchAfterIntent', () => {
  const nl =
    'segment w dobrej lokalizacji najlepiej centrum'

  it('adds q null when last user message equals active.q and model set tags only', () => {
    const patch = normalizeAiSearchPatchAfterIntent(
      [{ role: 'user', content: nl }],
      { q: nl },
      { tags: ['city_center'] },
    )
    assert.equal(patch.q, null)
    assert.deepEqual(patch.tags, ['city_center'])
  })

  it('does not override when model set q explicitly', () => {
    const patch = normalizeAiSearchPatchAfterIntent(
      [{ role: 'user', content: nl }],
      { q: nl },
      { q: 'segment', tags: ['city_center'] },
    )
    assert.equal(patch.q, 'segment')
  })

  it('does not clear when active.q differs from last user (refine via filters)', () => {
    const patch = normalizeAiSearchPatchAfterIntent(
      [{ role: 'user', content: 'add quiet area' }],
      { q: 'winda', tags: [] },
      { tags: ['quiet_area'] },
    )
    assert.equal(patch.q, undefined)
  })

  it('does nothing when patch has no structured narrowing', () => {
    const patch = normalizeAiSearchPatchAfterIntent(
      [{ role: 'user', content: nl }],
      { q: nl },
      {},
    )
    assert.equal(patch.q, undefined)
  })
})
