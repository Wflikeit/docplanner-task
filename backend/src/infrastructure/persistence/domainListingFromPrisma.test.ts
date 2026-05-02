import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {Prisma} from '@prisma/client'
import type {Listing as PrismaDbListing} from '@prisma/client'

import {prismaDbListingToDomain} from './domainListingFromPrisma.js'

describe('prismaDbListingToDomain', () => {
    it('maps row (id = DB pk string, aiTags from tagsJson)', () => {
        const row = {
            id: 1n,
            source: 'otodom',
            externalId: 'ext-1',
            sourceUrl: 'https://otodom.pl/x',
            title: 'T',
            description: 'D',
            priceAmount: new Prisma.Decimal(450000),
            priceCurrency: 'PLN',
            pricePerSqm: new Prisma.Decimal(9000),
            areaSqm: new Prisma.Decimal(50),
            rooms: 3,
            street: 'S',
            city: 'Warszawa',
            district: 'Mokotów',
            region: 'mazowieckie',
            country: 'Polska',
            imageUrlsJson: ['https://img/a.jpg', 'https://img/b.jpg'],
            attributesJson: {Rynek: 'Wtórny'},
            tagsJson: ['resale', 'quiet_area'],
            aiSummary: 'Nice place',
            aiUpdatedAt: new Date('2025-06-01T12:00:00.000Z'),
            aiWarningsJson: ['low_confidence'],
            scrapedAt: new Date('2025-05-01T10:00:00.000Z'),
        } satisfies PrismaDbListing

        const listing = prismaDbListingToDomain(row)
        assert.equal(listing.id, '1')
        assert.equal(listing.externalId, 'ext-1')
        assert.equal(listing.street, 'S')
        assert.equal(listing.imageUrl, 'https://img/a.jpg')
        assert.deepEqual(listing.aiTags, ['resale', 'quiet_area'])
        assert.deepEqual(listing.aiTaggingWarnings, ['low_confidence'])
        assert.equal(listing.createdAt, '2025-05-01T10:00:00.000Z')
    })
})
