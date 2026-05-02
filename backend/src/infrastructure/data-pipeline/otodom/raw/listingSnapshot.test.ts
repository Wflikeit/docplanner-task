import assert from 'node:assert/strict'
import {describe, it} from 'node:test'

import {isUnavailableOtodomListingSnapshot} from './listingSnapshot.js'

describe('isUnavailableOtodomListingSnapshot', () => {
    it('returns true for Otodom 404-style detail page row', () => {
        const item = {
            externalId: 'ID4yy2M',
            sourceUrl: 'https://www.otodom.pl/hpr/pl/oferta/5-pokojowy-dom-102m2-ogrodek-bez-prowizji-ID4yy2M',
            scrapedAt: '2026-05-01T16:57:34.387Z',
            ldJsonRaw: '',
            attributesRawJson: '{}',
            imageUrls: [],
            imageUrl: null,
            locationDisplay: null,
            mainTextRaw:
                'Ups! Nie znaleźliśmy strony, której szukasz\n\nStrona mogła zostać usunięta lub link jest nieprawidłowy.',
            title: 'Untitled',
            description: null,
            priceAmount: null,
            priceCurrency: 'PLN',
            areaSqm: null,
            rooms: null,
        }
        assert.equal(isUnavailableOtodomListingSnapshot(item), true)
    })

    it('returns false when LD exists', () => {
        const item = {
            externalId: 'x',
            sourceUrl: 'https://x',
            scrapedAt: '2026-01-01T00:00:00.000Z',
            ldJsonRaw: '{"@context":"https://schema.org"}',
            attributesRawJson: '{}',
            imageUrls: [],
            imageUrl: null,
            locationDisplay: null,
            mainTextRaw: 'nie znaleźliśmy strony',
            title: 'Untitled',
            priceAmount: null,
            areaSqm: null,
            rooms: null,
        }
        assert.equal(isUnavailableOtodomListingSnapshot(item), false)
    })

    it('returns false for normal listing with title', () => {
        const item = {
            externalId: 'x',
            sourceUrl: 'https://x',
            scrapedAt: '2026-01-01T00:00:00.000Z',
            ldJsonRaw: '',
            attributesRawJson: '{}',
            imageUrls: ['https://img'],
            imageUrl: 'https://img',
            locationDisplay: 'Katowice',
            mainTextRaw: 'Opis oferty',
            title: 'Mieszkanie 3 pok',
            priceAmount: 500000,
            priceCurrency: 'PLN',
            areaSqm: 60,
            rooms: 3,
        }
        assert.equal(isUnavailableOtodomListingSnapshot(item), false)
    })
})
