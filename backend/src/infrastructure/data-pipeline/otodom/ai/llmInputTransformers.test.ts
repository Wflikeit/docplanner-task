import assert from 'node:assert/strict'
import test from 'node:test'

import type {OtodomSanitizedListingItem} from '../sanitize/otodomSanitizedListing.js'
import {toLlmTaggingInput} from './llmInputTransformers.js'

function sampleListing(over: Partial<OtodomSanitizedListingItem> = {}): OtodomSanitizedListingItem {
    const base: OtodomSanitizedListingItem = {
        source: 'otodom',
        externalId: 'ext-1',
        sourceUrl: 'https://otodom.pl/oferta/1',
        scrapedAt: '2026-01-02T12:00:00.000Z',
        title: 'Dom na sprzedaż',
        descriptionPlain: 'Opis krótki.',
        mainTextCleaned: 'Main\nbody\nlines',
        priceAmount: 500_000,
        priceCurrency: 'PLN',
        pricePerSqm: 6000,
        areaSqm: 83,
        rooms: 4,
        location: {
            street: 'ul. Test 1',
            city: 'Katowice',
            district: 'Zarzecze',
            region: 'śląskie',
            country: 'Polska',
        },
        imageUrls: ['https://img/a'],
        attributes: {
            Rynek: 'pierwotny',
            'Stan wykończenia': 'do wykończenia',
            'Typ ogłoszeniodawcy': 'deweloper',
            Powierzchnia: '83 m²',
            'Liczba pokoi': '4',
            Media: 'woda, prąd',
            Ogrzewanie: 'gazowe',
            'Powierzchnia działki': '150 m²',
            'Rok budowy': '2026',
        },
        warnings: [],
    }
    return {...base, ...over}
}

test('toLlmTaggingInput omits crawl-only fields and mainText', () => {
    const out = toLlmTaggingInput(sampleListing())
    assert.equal('sourceUrl' in out, false)
    assert.equal('scrapedAt' in out, false)
    assert.equal('imageUrls' in out, false)
    assert.equal('mainTextFallback' in out, false)
    assert.equal('mainTextCleaned' in out, false)
    assert.equal(out.title, 'Dom na sprzedaż')
    assert.equal(out.description, 'Opis krótki.')
    assert.equal(out.knownFields.areaSqm, 83)
    assert.equal(out.knownFields.rooms, 4)
    assert.equal(out.location.city, 'Katowice')
})

test('toLlmTaggingInput drops Powierzchnia and Liczba pokoi from attributes', () => {
    const out = toLlmTaggingInput(sampleListing())
    assert.equal(out.attributes['Powierzchnia'], undefined)
    assert.equal(out.attributes['Liczba pokoi'], undefined)
    assert.equal(out.attributes['Rynek'], 'pierwotny')
    assert.equal(out.attributes['Media'], 'woda, prąd')
    assert.equal(out.attributes['Ogrzewanie'], 'gazowe')
})
