import type {Listing as PrismaDbListing} from '@prisma/client'

import type {Listing} from '../../domain/listing.js'

function decimalToNumber(value: {toNumber: () => number} | null | undefined): number | null {
    if (value == null) return null
    return value.toNumber()
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    return value.filter((x): x is string => typeof x === 'string')
}

function jsonStringArrayOrNull(value: unknown): string[] | null {
    if (value === null || value === undefined) return null
    if (!Array.isArray(value)) return null
    const out = value.filter((x): x is string => typeof x === 'string')
    return out.length > 0 ? out : null
}

/** Maps a Prisma `listings` row to the HTTP/domain listing (`id` = DB primary key string). */
export function prismaDbListingToDomain(row: PrismaDbListing): Listing {
    const urls = asStringArray(row.imageUrlsJson)

    return {
        id: row.id.toString(),
        title: row.title,
        description: row.description || null,
        priceAmount: decimalToNumber(row.priceAmount),
        priceCurrency: row.priceCurrency ?? null,
        city: row.city ?? null,
        district: row.district ?? null,
        street: row.street ?? null,
        areaSqm: decimalToNumber(row.areaSqm),
        rooms: row.rooms ?? null,
        furnished: null,
        imageUrl: urls[0] ?? null,
        sourceUrl: row.sourceUrl,
        externalId: row.externalId,
        createdAt: row.scrapedAt.toISOString(),
        aiTags: jsonStringArrayOrNull(row.tagsJson),
        aiSummary: row.aiSummary ?? null,
        aiTaggingWarnings: jsonStringArrayOrNull(row.aiWarningsJson),
    }
}
