/**
 * AI search tagging for Otodom: allowed tag vocabulary + Gemini JSON parsing.
 * Keep in sync with `prompts/listing-tagging.prompt.md` (allowed list + output shape).
 */
export const OTODOM_TAGGING_OUTPUT_KIND = 'otodom_tagging_gemini_v1' as const

/** Single source of truth for allowed listing tags (order = stable sort / docs). */
export const OTODOM_LISTING_TAG_IDS = [
    'budget',
    'mid_range',
    'premium',
    'small',
    'medium',
    'large',
    'very_large',
    'new_build',
    'resale',
    'developer_offer',
    'private_offer',
    'garage',
    'parking',
    'garden',
    'near_transport',
    'quiet_area',
    'near_forest',
    'family_friendly',
    'modern',
    'needs_finishing',
    'needs_renovation',
    'good_commute',
    'city_center',
    'suburban',
    'fenced_area',
] as const

export type OtodomListingTagId = (typeof OTODOM_LISTING_TAG_IDS)[number]

export const OTODOM_ALLOWED_TAGS = new Set<string>(OTODOM_LISTING_TAG_IDS)

/** Normalized model output after validation + tag filtering. */
export type OtodomGeminiTaggingPayload = {
    tags: OtodomListingTagId[]
    summary: string
    warnings?: string[]
}

export type OtodomGeminiTaggingMeta = {
    outputKind: typeof OTODOM_TAGGING_OUTPUT_KIND
    model: string
    generatedAt: string
    inputPath: string
}

/** One row from `tag-otodom-with-gemini.ts` output. */
export type OtodomGeminiTaggingFileItem = {
    externalId: string
    tagging: unknown
    gemini?: OtodomGeminiTaggingPayload
    error?: string
    modelTextSnippet?: string
}

export type OtodomGeminiTaggingFileBody = {
    source: 'otodom'
    meta: OtodomGeminiTaggingMeta
    items: OtodomGeminiTaggingFileItem[]
}

export function stripJsonCodeFence(text: string): string {
    let s = text.trim()
    if (s.startsWith('```')) {
        const firstNl = s.indexOf('\n')
        if (firstNl !== -1) s = s.slice(firstNl + 1)
        const close = s.lastIndexOf('```')
        if (close !== -1) s = s.slice(0, close).trim()
    }
    return s.trim()
}

function isStringArray(a: unknown): a is string[] {
    return Array.isArray(a) && a.every((x) => typeof x === 'string')
}

function asAllowedTags(tags: string[]): OtodomListingTagId[] {
    const filtered = tags.map((t) => t.trim()).filter((t): t is OtodomListingTagId => OTODOM_ALLOWED_TAGS.has(t))
    return [...new Set(filtered)]
}

/**
 * Validates Gemini output for listing tagging (`listing-tagging.prompt.md`).
 * Drops unknown tags; returns null if JSON is invalid or required fields are missing.
 */
export function normalizeGeminiTaggingPayload(parsed: unknown): OtodomGeminiTaggingPayload | null {
    if (parsed === null || typeof parsed !== 'object') return null
    const o = parsed as Record<string, unknown>
    if (!isStringArray(o.tags)) return null
    if (typeof o.summary !== 'string') return null
    const tags = asAllowedTags(o.tags)
    const out: OtodomGeminiTaggingPayload = {tags, summary: o.summary.trim()}
    if (isStringArray(o.warnings) && o.warnings.length > 0) {
        const w = o.warnings.map((x) => String(x).trim()).filter((x) => x !== '')
        if (w.length > 0) out.warnings = w
    }
    return out
}

export function parseGeminiTaggingResponseText(text: string): OtodomGeminiTaggingPayload | null {
    const raw = stripJsonCodeFence(text)
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }
    return normalizeGeminiTaggingPayload(parsed)
}

export function isOtodomGeminiTaggingFileBody(o: unknown): o is OtodomGeminiTaggingFileBody {
    if (o === null || typeof o !== 'object') return false
    const r = o as Record<string, unknown>
    if (r.source !== 'otodom') return false
    if (!r.meta || typeof r.meta !== 'object') return false
    const m = r.meta as Record<string, unknown>
    if (m.outputKind !== OTODOM_TAGGING_OUTPUT_KIND) return false
    if (typeof m.model !== 'string' || typeof m.generatedAt !== 'string' || typeof m.inputPath !== 'string') {
        return false
    }
    return Array.isArray(r.items);

}

/** Build a lookup of successful tagging rows (`gemini` present) by `externalId`. */
export function geminiTaggingIndexFromValidatedBody(
    body: OtodomGeminiTaggingFileBody,
): Map<string, OtodomGeminiTaggingPayload> {
    const m = new Map<string, OtodomGeminiTaggingPayload>()
    for (const row of body.items) {
        if (row.gemini) m.set(row.externalId, row.gemini)
    }
    return m
}