import assert from 'node:assert/strict'
import test from 'node:test'

import {
    geminiTaggingIndexFromValidatedBody,
    normalizeGeminiTaggingPayload,
    parseGeminiTaggingResponseText,
    isOtodomGeminiTaggingFileBody,
    OTODOM_TAGGING_OUTPUT_KIND,
} from './otodomTagging.js'

test('parseGeminiTaggingResponseText parses plain JSON', () => {
    const text = JSON.stringify({
        tags: ['garage', 'garden'],
        summary: 'Dom z garażem.',
    })
    const out = parseGeminiTaggingResponseText(text)
    assert.deepEqual(out?.tags, ['garage', 'garden'])
    assert.equal(out?.summary, 'Dom z garażem.')
})

test('parseGeminiTaggingResponseText strips markdown fence', () => {
    const text = '```json\n' + JSON.stringify({tags: ['small'], summary: 'Mały.'}) + '\n```'
    const out = parseGeminiTaggingResponseText(text)
    assert.deepEqual(out?.tags, ['small'])
})

test('parseGeminiTaggingResponseText filters unknown tags and dedupes', () => {
    const text = JSON.stringify({
        tags: ['garage', 'not_a_real_tag', 'garage', 'parking'],
        summary: 'Ok',
    })
    const out = parseGeminiTaggingResponseText(text)
    assert.deepEqual(out?.tags, ['garage', 'parking'])
})

test('parseGeminiTaggingResponseText returns null on invalid JSON', () => {
    assert.equal(parseGeminiTaggingResponseText('not json'), null)
})

test('parseGeminiTaggingResponseText returns null when tags missing', () => {
    assert.equal(parseGeminiTaggingResponseText(JSON.stringify({summary: 'x'})), null)
})

test('normalizeGeminiTaggingPayload keeps optional warnings', () => {
    const out = normalizeGeminiTaggingPayload({
        tags: ['modern'],
        summary: 'Nowoczesny.',
        warnings: ['  a  ', ''],
    })
    assert.deepEqual(out?.warnings, ['a'])
})

test('isOtodomGeminiTaggingFileBody accepts minimal valid body', () => {
    assert.equal(
        isOtodomGeminiTaggingFileBody({
            source: 'otodom',
            meta: {
                outputKind: OTODOM_TAGGING_OUTPUT_KIND,
                model: 'gemini-2.5-flash',
                generatedAt: '2026-01-01T00:00:00.000Z',
                inputPath: 'data/x.json',
            },
            items: [],
        }),
        true,
    )
})

test('isOtodomGeminiTaggingFileBody rejects wrong outputKind', () => {
    assert.equal(
        isOtodomGeminiTaggingFileBody({
            source: 'otodom',
            meta: {
                outputKind: 'other',
                model: 'm',
                generatedAt: 't',
                inputPath: 'p',
            },
            items: [],
        }),
        false,
    )
})

test('geminiTaggingIndexFromValidatedBody collects gemini rows', () => {
    const body = {
        source: 'otodom' as const,
        meta: {
            outputKind: OTODOM_TAGGING_OUTPUT_KIND,
            model: 'gemini-2.5-flash',
            generatedAt: '2026-01-01T00:00:00.000Z',
            inputPath: 'x.json',
        },
        items: [
            {externalId: 'a', tagging: {}, gemini: {tags: ['small' as const], summary: 's'}},
            {externalId: 'b', tagging: {}, error: 'fail'},
        ],
    }
    const m = geminiTaggingIndexFromValidatedBody(body)
    assert.equal(m.size, 1)
    assert.deepEqual(m.get('a')?.tags, ['small'])
})
