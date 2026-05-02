import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {clampPersistedRowForMysql} from './prismaListingUpsert.js'

describe('clampPersistedRowForMysql', () => {
    it('truncates sourceUrl and title to schema limits', () => {
        const row = {
            source: 'otodom',
            externalId: 'x',
            sourceUrl: `https://x/${'a'.repeat(800)}`,
            title: 't'.repeat(600),
            description: 'd',
            priceAmount: null,
            priceCurrency: 'PLNNNN',
            pricePerSqm: null,
            areaSqm: null,
            rooms: null,
            street: 's'.repeat(600),
            city: 'c'.repeat(300),
            district: null,
            region: null,
            country: 'Polska',
            imageUrls: [],
            attributes: {},
            tags: null,
            aiSummary: null,
            aiUpdatedAt: null,
            aiWarnings: null,
            scrapedAt: '2025-01-01T00:00:00.000Z',
        }
        const out = clampPersistedRowForMysql(row)
        assert.equal(out.sourceUrl.length, 767)
        assert.equal(out.title.length, 512)
        assert.equal(out.priceCurrency?.length, 3)
        assert.equal(out.street?.length, 512)
        assert.equal(out.city?.length, 256)
    })
})
