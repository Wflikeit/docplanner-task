/**
 * Compact DTO for **AI search tagging** built from {@link OtodomSanitizedListingItem}.
 * Do not pass the full sanitized row to the model — use {@link toLlmTaggingInput} only.
 */
import type {OtodomSanitizedListingItem, OtodomSanitizedLocation} from '../sanitize/otodomSanitizedListing.js'

/** Alias for readability at call sites (`SanitizedListing` in product language). */
export type OtodomSanitizedListing = OtodomSanitizedListingItem

const TAGGING_ATTRIBUTE_KEYS = new Set<string>([
    'Rynek',
    'Stan wykończenia',
    'Typ ogłoszeniodawcy',
    'Rodzaj zabudowy',
    'Ogrzewanie',
    'Informacje dodatkowe',
    'Media',
    'Zabezpieczenia',
    'Okolica',
    'Położenie',
    'Powierzchnia działki',
    'Rok budowy',
])

/** Dropped from tagging attributes — duplicated by structured `knownFields` / listing columns. */
const ATTRIBUTE_KEYS_OMIT_FOR_TAGGING = new Set<string>(['Powierzchnia', 'Liczba pokoi'])

export type LlmTaggingKnownFields = {
    priceAmount?: number
    priceCurrency?: string
    pricePerSqm?: number
    areaSqm?: number
    rooms?: number
}

export type LlmTaggingLocation = {
    city?: string
    district?: string
    region?: string
}

export type LlmTaggingInput = {
    title: string
    description: string
    knownFields: LlmTaggingKnownFields
    location: LlmTaggingLocation
    attributes: Record<string, string>
}

function finiteNumber(n: number | null | undefined): n is number {
    return n != null && Number.isFinite(n)
}

function nonEmptyString(s: string | null | undefined): s is string {
    return s != null && s.trim() !== ''
}

function pickKnownFields(s: OtodomSanitizedListingItem): LlmTaggingKnownFields {
    const out: LlmTaggingKnownFields = {}
    if (finiteNumber(s.priceAmount)) out.priceAmount = s.priceAmount
    if (nonEmptyString(s.priceCurrency)) out.priceCurrency = s.priceCurrency.trim()
    if (finiteNumber(s.pricePerSqm)) out.pricePerSqm = s.pricePerSqm
    if (finiteNumber(s.areaSqm)) out.areaSqm = s.areaSqm
    if (finiteNumber(s.rooms)) out.rooms = Math.round(s.rooms)
    return out
}

function pickTaggingLocation(loc: OtodomSanitizedLocation): LlmTaggingLocation {
    const out: LlmTaggingLocation = {}
    if (nonEmptyString(loc.city)) out.city = loc.city.trim()
    if (nonEmptyString(loc.district)) out.district = loc.district.trim()
    if (nonEmptyString(loc.region)) out.region = loc.region.trim()
    return out
}

function filterAttributes(
    attrs: Readonly<Record<string, string>>,
    allowed: ReadonlySet<string>,
    omit: ReadonlySet<string>,
): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(attrs)) {
        if (omit.has(k)) continue
        if (!allowed.has(k)) continue
        const t = v.trim()
        if (t === '') continue
        out[k] = t
    }
    return out
}

export function toLlmTaggingInput(sanitized: OtodomSanitizedListing): LlmTaggingInput {
    return {
        title: sanitized.title.trim(),
        description: sanitized.descriptionPlain.trim(),
        knownFields: pickKnownFields(sanitized),
        location: pickTaggingLocation(sanitized.location),
        attributes: filterAttributes(
            sanitized.attributes,
            TAGGING_ATTRIBUTE_KEYS,
            ATTRIBUTE_KEYS_OMIT_FOR_TAGGING,
        ),
    }
}
