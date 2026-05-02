import type {PersistedListingRow} from '../../../../domain/persistedListingRow.js'
import type {OtodomGeminiTaggingPayload} from '../../../ai/index.js'
import type {OtodomSanitizedListingItem} from '../sanitize/otodomSanitizedListing.js'

function stableAttributesJson(attrs: Readonly<Record<string, string>>): Record<string, string> {
    const keys = Object.keys(attrs).sort((a, b) => a.localeCompare(b))
    const out: Record<string, string> = {}
    for (const k of keys) {
        const v = attrs[k]?.trim()
        if (v !== undefined && v !== '') out[k] = v
    }
    return out
}

function roomsForDb(rooms: number | null | undefined): number | null {
    if (rooms == null || !Number.isFinite(rooms)) return null
    return Math.round(rooms)
}

/**
 * Maps one Otodom sanitized item + optional Gemini tagging into a DB row.
 * `aiBatchGeneratedAt` should be tagging file `meta.generatedAt` when tagging file is used; otherwise `null`.
 */
export function toPersistedListingRow(
    item: OtodomSanitizedListingItem,
    gemini: OtodomGeminiTaggingPayload | undefined,
    aiBatchGeneratedAt: string | null,
): PersistedListingRow {
    const loc = item.location
    return {
        source: item.source,
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        title: item.title.trim(),
        description: item.descriptionPlain.trim(),
        priceAmount: item.priceAmount,
        priceCurrency: item.priceCurrency?.trim() ?? null,
        pricePerSqm: item.pricePerSqm,
        areaSqm: item.areaSqm,
        rooms: roomsForDb(item.rooms),
        street: loc.street?.trim() ? loc.street.trim() : null,
        city: loc.city?.trim() ? loc.city.trim() : null,
        district: loc.district?.trim() ? loc.district.trim() : null,
        region: loc.region?.trim() ? loc.region.trim() : null,
        country: loc.country.trim() || 'Polska',
        imageUrls: [...item.imageUrls],
        attributes: stableAttributesJson(item.attributes),
        tags: gemini ? [...gemini.tags] : null,
        aiSummary: gemini?.summary.trim() ?? null,
        aiUpdatedAt: gemini && aiBatchGeneratedAt ? aiBatchGeneratedAt : null,
        aiWarnings: gemini?.warnings && gemini.warnings.length > 0 ? [...gemini.warnings] : null,
        scrapedAt: item.scrapedAt,
    }
}

/**
 * **Merge point for sanitized + Gemini-tagged JSON** when running `import-otodom-listings-mysql`:
 * each row looks up `tagByExternalId.get(item.externalId)` and passes it to {@link toPersistedListingRow}.
 * The tagged file from `tag-otodom-with-gemini` is not merged elsewhere in the pipeline.
 */
export function buildPersistedRowsFromOtodomSanitizedAndTagging(
    items: readonly OtodomSanitizedListingItem[],
    tagByExternalId: ReadonlyMap<string, OtodomGeminiTaggingPayload>,
    aiBatchGeneratedAt: string | null,
): PersistedListingRow[] {
    return items.map((item) =>
        toPersistedListingRow(item, tagByExternalId.get(item.externalId), aiBatchGeneratedAt),
    )
}
