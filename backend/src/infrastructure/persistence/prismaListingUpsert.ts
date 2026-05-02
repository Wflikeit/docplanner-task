import {Prisma, PrismaClient} from '@prisma/client'

import type {PersistedListingRow} from '../../domain/persistedListingRow.js'

/** Mirrors `schema.prisma` @db.VarChar lengths so imports never abort on long strings (URLs/titles from crawlers). */
const VARCHAR = {
    source: 32,
    externalId: 128,
    sourceUrl: 767,
    title: 512,
    priceCurrency: 3,
    street: 512,
    city: 256,
    district: 256,
    region: 256,
    country: 128,
} as const

function clamp(s: string, max: number): string {
    return s.length <= max ? s : s.slice(0, max)
}

function clampOptional(s: string | null, max: number): string | null {
    if (s == null) return null
    return clamp(s, max)
}

/**
 * Defensive safeguard: prevents import failures due to oversized strings
 * from external sources. In production, this should be replaced with
 * validation + observability instead of silent truncation.
 *
 * Trade-off: silent truncation can hide data-quality issues and affect
 * deduplication if identifiers were ever over-truncated — `externalId` /
 * `source` limits are sized large on purpose; do not shrink them casually.
 */
export function clampPersistedRowForMysql(row: PersistedListingRow): PersistedListingRow {
    return {
        ...row,
        source: clamp(row.source, VARCHAR.source),
        externalId: clamp(row.externalId, VARCHAR.externalId),
        sourceUrl: clamp(row.sourceUrl, VARCHAR.sourceUrl),
        title: clamp(row.title, VARCHAR.title),
        priceCurrency: clampOptional(row.priceCurrency, VARCHAR.priceCurrency),
        street: clampOptional(row.street, VARCHAR.street),
        city: clampOptional(row.city, VARCHAR.city),
        district: clampOptional(row.district, VARCHAR.district),
        region: clampOptional(row.region, VARCHAR.region),
        country: clamp(row.country, VARCHAR.country),
    }
}

function toDecimal(n: number | null | undefined): Prisma.Decimal | null {
    if (n == null || !Number.isFinite(n)) return null
    return new Prisma.Decimal(n)
}

function rowToCreateAndUpdate(row: PersistedListingRow): {
    create: Prisma.ListingCreateInput
    update: Prisma.ListingUpdateInput
} {
    const shared = {
        sourceUrl: row.sourceUrl,
        title: row.title,
        description: row.description,
        priceAmount: toDecimal(row.priceAmount),
        priceCurrency: row.priceCurrency,
        pricePerSqm: toDecimal(row.pricePerSqm),
        areaSqm: toDecimal(row.areaSqm),
        rooms: row.rooms,
        street: row.street,
        city: row.city,
        district: row.district,
        region: row.region,
        country: row.country,
        imageUrlsJson: row.imageUrls,
        attributesJson: row.attributes,
        tagsJson: row.tags === null ? Prisma.JsonNull : row.tags,
        aiSummary: row.aiSummary,
        aiUpdatedAt: row.aiUpdatedAt ? new Date(row.aiUpdatedAt) : null,
        aiWarningsJson: row.aiWarnings === null ? Prisma.JsonNull : row.aiWarnings,
        scrapedAt: new Date(row.scrapedAt),
    }
    return {
        create: {
            source: row.source,
            externalId: row.externalId,
            ...shared,
        },
        update: shared,
    }
}

export type PrismaUpsertStats = {rows: number}

export async function upsertPersistedListingRowsPrisma(
    prisma: PrismaClient,
    rows: readonly PersistedListingRow[],
): Promise<PrismaUpsertStats> {
    for (const row of rows) {
        const {create, update} = rowToCreateAndUpdate(clampPersistedRowForMysql(row))
        await prisma.listing.upsert({
            where: {
                source_externalId: {source: row.source, externalId: row.externalId},
            },
            create,
            update,
        })
    }
    return {rows: rows.length}
}

export async function countListingsPrisma(prisma: PrismaClient): Promise<number> {
    return prisma.listing.count()
}
