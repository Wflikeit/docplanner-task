/**
 * Compact, pipeline-ready listing rows derived from raw Otodom crawl snapshots.
 * Raw crawl files stay unchanged; this module defines the sanitized JSON shape only.
 */
import type {OtodomAddressFromLd, OtodomListingSnapshotItem} from '../raw/listingSnapshot.js'
import {computeOtodomTextCleanup, otodomAttributesRawJsonParseFailed} from './sanitizeListingText.js'

export type OtodomSanitizedLocation = {
    street: string | null
    city: string | null
    district: string | null
    region: string | null
    country: string
}

export type OtodomSanitizedListingItem = {
    source: 'otodom'
    externalId: string
    sourceUrl: string
    scrapedAt: string
    title: string
    descriptionPlain: string
    mainTextCleaned: string
    priceAmount: number | null
    priceCurrency: string | null
    pricePerSqm: number | null
    areaSqm: number | null
    rooms: number | null
    location: OtodomSanitizedLocation
    imageUrls: string[]
    attributes: Record<string, string>
    warnings: string[]
}

export type OtodomSanitizedFileBody = {
    source: 'otodom'
    items: OtodomSanitizedListingItem[]
}

export const OTODOM_WARNING = {
    ldJsonTruncated: 'ld_json_truncated',
    mainTextTruncated: 'main_text_truncated',
    missingPrice: 'missing_price',
    attributesParseFailed: 'attributes_parse_failed',
} as const

function nonEmpty(s: string | null | undefined): string | null {
    if (s == null) return null
    const t = s.trim()
    return t === '' ? null : t
}

export function mergeOtodomImageUrls(urls: readonly string[], single: string | null): string[] {
    const out: string[] = []
    const seen = new Set<string>()
    for (const u of urls) {
        const t = u.trim()
        if (t === '' || seen.has(t)) continue
        seen.add(t)
        out.push(t)
    }
    if (single) {
        const t = single.trim()
        if (t !== '' && !seen.has(t)) {
            seen.add(t)
            out.push(t)
        }
    }
    return out
}

export function computePricePerSqm(
    priceAmount: number | null | undefined,
    areaSqm: number | null | undefined,
    existing: number | null | undefined,
): number | null {
    if (existing != null && Number.isFinite(existing)) return existing
    if (
        priceAmount != null &&
        areaSqm != null &&
        Number.isFinite(priceAmount) &&
        Number.isFinite(areaSqm) &&
        areaSqm > 0
    ) {
        return Math.round(priceAmount / areaSqm)
    }
    return null
}

function inferDistrictFromLocationRaw(
    addr: OtodomAddressFromLd | null | undefined,
    locationRaw: string | null | undefined,
): string | null {
    const city = nonEmpty(addr?.addressLocality)
    const raw = nonEmpty(locationRaw)
    if (!city || !raw) return null
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
    const cityIdx = parts.findIndex((p) => p.toLowerCase() === city.toLowerCase())
    if (cityIdx <= 0) return null
    const candidate = parts[cityIdx - 1]
    if (!candidate) return null
    if (/^ul\.|^ul\s/i.test(candidate)) return null
    return candidate
}

export function buildSanitizedLocation(
    addr: OtodomAddressFromLd | null | undefined,
    attrs: Readonly<Record<string, string>>,
    locationRaw: string | null | undefined,
): OtodomSanitizedLocation {
    const districtAttr =
        nonEmpty(attrs['Dzielnica']) ??
        nonEmpty(attrs['Dzielnica / osiedle']) ??
        inferDistrictFromLocationRaw(addr, locationRaw)
    const country = nonEmpty(addr?.addressCountry) ?? 'Polska'
    return {
        street: nonEmpty(addr?.streetAddress),
        city: nonEmpty(addr?.addressLocality),
        district: districtAttr,
        region: nonEmpty(addr?.addressRegion),
        country,
    }
}

function collectSnapshotWarnings(item: OtodomListingSnapshotItem, attrsParseFailed: boolean): string[] {
    const w: string[] = []
    if (item.ldJsonRawTruncated === true) w.push(OTODOM_WARNING.ldJsonTruncated)
    if (item.mainTextRawTruncated === true) w.push(OTODOM_WARNING.mainTextTruncated)
    if (item.priceAmount == null || !Number.isFinite(item.priceAmount)) w.push(OTODOM_WARNING.missingPrice)
    if (attrsParseFailed) w.push(OTODOM_WARNING.attributesParseFailed)
    return w
}

export function buildOtodomSanitizedItemFromSnapshot(item: OtodomListingSnapshotItem): OtodomSanitizedListingItem {
    const cleaned = computeOtodomTextCleanup(item)
    const attrsParseFailed = otodomAttributesRawJsonParseFailed(item.attributesRawJson)
    const attributes = cleaned.attributes
    const warnings = collectSnapshotWarnings(item, attrsParseFailed)
    const location = buildSanitizedLocation(item.addressFromLd, attributes, item.locationRaw ?? null)
    const imageUrls = mergeOtodomImageUrls(item.imageUrls, item.imageUrl)
    const pricePerSqm = computePricePerSqm(item.priceAmount, item.areaSqm, item.pricePerSqm)

    return {
        source: 'otodom',
        externalId: item.externalId,
        sourceUrl: item.sourceUrl,
        scrapedAt: item.scrapedAt,
        title: cleaned.title,
        descriptionPlain: cleaned.descriptionPlain,
        mainTextCleaned: cleaned.mainTextCleaned,
        priceAmount: item.priceAmount ?? null,
        priceCurrency: item.priceCurrency ?? null,
        pricePerSqm,
        areaSqm: item.areaSqm ?? null,
        rooms: item.rooms ?? null,
        location,
        imageUrls,
        attributes,
        warnings,
    }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isSanitizedListingItem(v: unknown): v is OtodomSanitizedListingItem {
    if (!isPlainObject(v)) return false
    if (v.source !== 'otodom') return false
    if (typeof v.externalId !== 'string' || typeof v.sourceUrl !== 'string') return false
    if (typeof v.scrapedAt !== 'string' || typeof v.title !== 'string') return false
    if (typeof v.descriptionPlain !== 'string' || typeof v.mainTextCleaned !== 'string') return false
    if (!isPlainObject(v.location)) return false
    return !(!Array.isArray(v.imageUrls) || !isPlainObject(v.attributes) || !Array.isArray(v.warnings));

}

/** True when JSON root is a compact sanitized pipeline file (not a crawl snapshot with `meta`). */
export function isOtodomSanitizedFileBody(o: unknown): o is OtodomSanitizedFileBody {
    if (!isPlainObject(o)) return false
    if (o.source !== 'otodom') return false
    if ('meta' in o) return false
    if (!Array.isArray(o.items)) return false
    if (o.items.length === 0) return true
    return o.items.every((it) => isSanitizedListingItem(it))
}
