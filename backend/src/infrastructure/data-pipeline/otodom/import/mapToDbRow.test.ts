import assert from 'node:assert/strict'
import test from 'node:test'

import type {OtodomGeminiTaggingPayload} from '../../../ai/index.js'
import type {OtodomSanitizedListingItem} from '../sanitize/otodomSanitizedListing.js'
import {buildPersistedRowsFromOtodomSanitizedAndTagging, toPersistedListingRow} from './mapToDbRow.js'

function sampleItem(over: Partial<OtodomSanitizedListingItem> = {}): OtodomSanitizedListingItem {
    const base: OtodomSanitizedListingItem = {
        source: 'otodom',
        externalId: 'EXT1',
        sourceUrl: 'https://otodom.pl/x-EXT1',
        scrapedAt: '2026-01-01T00:00:00.000Z',
        title: '  Dom  ',
        descriptionPlain: '  Opis  ',
        mainTextCleaned: 'm',
        priceAmount: 1_000,
        priceCurrency: 'PLN',
        pricePerSqm: 100,
        areaSqm: 10,
        rooms: 3.2,
        location: {
            street: 'ul. A',
            city: 'Poznań',
            district: null,
            region: 'wlkp',
            country: 'Polska',
        },
        imageUrls: ['https://i/1'],
        attributes: {Rynek: 'pierwotny', Media: ' prąd '},
        warnings: [],
    }
    return {...base, ...over}
}

test('toPersistedListingRow maps location and trims description', () => {
    const row = toPersistedListingRow(sampleItem(), undefined, null)
    assert.equal(row.source, 'otodom')
    assert.equal(row.externalId, 'EXT1')
    assert.equal(row.description, 'Opis')
    assert.equal(row.city, 'Poznań')
    assert.equal(row.country, 'Polska')
    assert.equal(row.rooms, 3)
    assert.deepEqual(row.attributes, {Media: 'prąd', Rynek: 'pierwotny'})
    assert.equal(row.tags, null)
    assert.equal(row.aiSummary, null)
})

test('toPersistedListingRow attaches gemini and aiUpdatedAt', () => {
    const g: OtodomGeminiTaggingPayload = {
        tags: ['garage', 'garden'],
        summary: ' S ',
        warnings: ['w'],
    }
    const row = toPersistedListingRow(sampleItem(), g, '2026-02-02T00:00:00.000Z')
    assert.deepEqual(row.tags, ['garage', 'garden'])
    assert.equal(row.aiSummary, 'S')
    assert.equal(row.aiUpdatedAt, '2026-02-02T00:00:00.000Z')
    assert.deepEqual(row.aiWarnings, ['w'])
})

test('buildPersistedRowsFromOtodomSanitizedAndTagging joins by externalId', () => {
    const items = [sampleItem({externalId: 'A'}), sampleItem({externalId: 'B', title: 'B'})]
    const m = new Map<string, OtodomGeminiTaggingPayload>([
        ['B', {tags: ['small'], summary: 'b'}],
    ])
    const rows = buildPersistedRowsFromOtodomSanitizedAndTagging(items, m, null)
    assert.equal(rows[0]!.tags, null)
    assert.deepEqual(rows[1]!.tags, ['small'])
})
