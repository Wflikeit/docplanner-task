import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyListingSearchDisplayQFromLastUserMessage,
  buildMockListingSearchIntent,
  clampConversationBlockForLlm,
} from './aiListingSearchUseCase.js'
import { mergeAiSearchIntoListQuery } from './listingAiSearchMerge.js'

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

describe('applyListingSearchDisplayQFromLastUserMessage', () => {
  it('sets merged q from the last user turn', () => {
    const merged = mergeAiSearchIntoListQuery(
      {},
      { tags: ['garden'], q: 'house' },
    )
    applyListingSearchDisplayQFromLastUserMessage(merged, [
      { role: 'user', content: 'house for 2 people with dog' },
    ])
    assert.equal(merged.q, 'house for 2 people with dog')
    assert.deepEqual(merged.tags, ['garden'])
  })

  it('does nothing when last user message is empty', () => {
    const merged = mergeAiSearchIntoListQuery({}, { q: 'loft' })
    applyListingSearchDisplayQFromLastUserMessage(merged, [
      { role: 'user', content: '   ' },
    ])
    assert.equal(merged.q, 'loft')
  })
})
