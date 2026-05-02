/**
 * Row shape for DB persistence (Otodom + optional AI tagging).
 * DB columns use snake_case (see Prisma `@map`); this type uses camelCase in TS.
 */
export type PersistedListingRow = {
    source: string
    externalId: string
    sourceUrl: string
    title: string
    description: string
    priceAmount: number | null
    priceCurrency: string | null
    pricePerSqm: number | null
    areaSqm: number | null
    rooms: number | null
    street: string | null
    city: string | null
    district: string | null
    region: string | null
    country: string
    imageUrls: string[]
    attributes: Record<string, string>
    tags: string[] | null
    aiSummary: string | null
    aiUpdatedAt: string | null
    aiWarnings: string[] | null
    scrapedAt: string
}
