import assert from 'node:assert/strict'
import test from 'node:test'

import type {OtodomListingSnapshotItem} from '../raw/listingSnapshot.js'
import {
    buildOtodomSanitizedItemFromSnapshot,
    computePricePerSqm,
    isOtodomSanitizedFileBody,
    mergeOtodomImageUrls,
} from './otodomSanitizedListing.js'
import {cutAtStopSection, normalizeAttributesJson, sanitizeMainTextOtodom, stringifyNormalizedAttributes} from './sanitizeListingText.js'

test('mergeOtodomImageUrls dedupes and appends single', () => {
    const a = 'https://a/x'
    const b = 'https://b/y'
    assert.deepEqual(mergeOtodomImageUrls([a, a, b], a), [a, b])
    assert.deepEqual(mergeOtodomImageUrls([], 'https://z'), ['https://z'])
})

test('normalizeAttributesJson returns Record with sorted keys; stringify for logs', () => {
    const raw = '{"Z": "2", "A": "1"}'
    const rec = normalizeAttributesJson(raw)
    assert.deepEqual(rec, {A: '1', Z: '2'})
    assert.equal(stringifyNormalizedAttributes(rec), '{"A":"1","Z":"2"}')
    assert.deepEqual(normalizeAttributesJson('not json'), {})
    assert.deepEqual(normalizeAttributesJson(''), {})
})

test('computePricePerSqm fills from price and area', () => {
    assert.equal(computePricePerSqm(695_000, 85, null), 8176)
    assert.equal(computePricePerSqm(null, 85, null), null)
    assert.equal(computePricePerSqm(100, 10, 5), 5)
})

test('buildOtodomSanitizedItemFromSnapshot strips HTML and omits crawl-only fields', () => {
    const item: OtodomListingSnapshotItem = {
        externalId: 'x1',
        sourceUrl: 'https://otodom.pl/x1',
        scrapedAt: '2026-01-01T00:00:00.000Z',
        ldJsonRaw: '{}',
        attributesRawJson: '{"Rynek":"pierwotny"}',
        imageUrls: ['https://img/1'],
        imageUrl: 'https://img/1',
        locationDisplay: 'ul. Test, Warszawa, mazowieckie, Polska',
        title: '  Title  ',
        mainTextRaw: 'Line\nZapisz\nLine',
        description: '<p>Hello&nbsp;world</p>',
        priceAmount: 100,
        priceCurrency: 'PLN',
        areaSqm: 50,
        rooms: 3,
        addressFromLd: {
            streetAddress: 'ul. Test',
            addressLocality: 'Warszawa',
            addressRegion: 'mazowieckie',
            addressCountry: 'Polska',
        },
    }
    const out = buildOtodomSanitizedItemFromSnapshot(item)
    assert.equal(out.source, 'otodom')
    assert.equal(out.title, 'Title')
    assert.equal(out.descriptionPlain, 'Hello world')
    assert.ok(!out.mainTextCleaned.includes('Zapisz'))
    assert.deepEqual(out.attributes, {Rynek: 'pierwotny'})
    assert.deepEqual(out.imageUrls, ['https://img/1'])
    assert.equal(out.location.city, 'Warszawa')
    assert.equal(out.location.country, 'Polska')
})

test('cutAtStopSection truncates at earliest stop header (case-insensitive)', () => {
    const raw = 'Opis oferty\nPODOBNE OGŁOSZENIA\n496 000 zł'
    assert.equal(cutAtStopSection(raw), 'Opis oferty')
    const raw2 = 'A\nB\nHistoria i statystyki\nX\nPodobne ogłoszenia\nY'
    assert.equal(cutAtStopSection(raw2), 'A\nB')
})

test('sanitizeMainTextOtodom cuts before similar-listings block', () => {
    const raw = [
        'NOWY DOM',
        'ul. Test 1, 40-001, Warszawa, mazowieckie',
        'ul. Test 1, 40-001, Warszawa, mazowieckie',
        'Oblicz ratę dla tej nieruchomości RRSO 5%',
        'Twoje dane zostaną przekazane ogłoszeniodawcy w celu umożliwienia komunikacji.',
        'Szacowana rata/miesiąc: 100 zł',
        '8 176 zł/m²',
        'od 8 380 zł/m²',
        'Podobne ogłoszenia',
        '496 000 zł',
        'ul. Zachodnia, Miasto, województwo',
    ].join('\n')
    const {text} = sanitizeMainTextOtodom(raw)
    assert.ok(!text.includes('Oblicz ratę'))
    assert.ok(!text.includes('Twoje dane zostaną'))
    assert.ok(!text.includes('Szacowana rata'))
    assert.ok(!text.includes('od 8 380'))
    assert.ok(!text.includes('496 000'))
    assert.ok(!text.includes('Zachodnia'))
    assert.equal((text.match(/ul\. Test 1/g) ?? []).length, 1)
    assert.ok(text.includes('8 176 zł/m²'))
})

test('sanitizeMainTextOtodom removes RKM / BKG developer financing blocks', () => {
    const line =
        'Rodzinny Kredyt Mieszkaniowy Skorzystaj z Rodzinnego Kredytu Mieszkaniowego i kup dom w inwestycji Osiedle Stokrotki z minimalnym wkładem własnym – już ok. 8–10 tys. zł. Jeśli posiadasz zdolność kredytową, brakujący wkład może zostać objęty gwarancją BKG. Zostaw kontakt – oddzwonimy i przeprowadzimy Cię przez cały proces'
    const {text} = sanitizeMainTextOtodom(`Mieszkanie 3 pokoje\n${line}\nOpis lokalu`)
    assert.ok(!text.includes('Rodzinny Kredyt Mieszkaniowy'))
    assert.ok(!text.includes('gwarancją BKG'))
    assert.ok(!text.includes('Zostaw kontakt'))
    assert.ok(text.includes('Mieszkanie 3 pokoje'))
    assert.ok(text.includes('Opis lokalu'))
})

test('isOtodomSanitizedFileBody accepts compact root', () => {
    assert.equal(
        isOtodomSanitizedFileBody({
            source: 'otodom',
            items: [
                {
                    source: 'otodom',
                    externalId: '1',
                    sourceUrl: 'u',
                    scrapedAt: 't',
                    title: 'a',
                    descriptionPlain: 'd',
                    mainTextCleaned: 'm',
                    priceAmount: null,
                    priceCurrency: null,
                    pricePerSqm: null,
                    areaSqm: null,
                    rooms: null,
                    location: {
                        street: null,
                        city: null,
                        district: null,
                        region: null,
                        country: 'Polska',
                    },
                    imageUrls: [],
                    attributes: {},
                    warnings: [],
                },
            ],
        }),
        true,
    )
    assert.equal(isOtodomSanitizedFileBody({meta: {}, source: 'otodom', items: []}), false)
})
