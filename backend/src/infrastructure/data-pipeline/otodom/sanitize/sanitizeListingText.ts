/**
 * Deterministic text cleanup for Otodom crawl rows (no LLM).
 * Safe for pipeline before NLP / embeddings / LLM tagging (search).
 */
import type {OtodomListingSnapshotItem} from '../raw/listingSnapshot.js'

type OtodomMainTextSanitizeStats = {
    linesBefore: number
    linesAfter: number
    droppedByRules: number
    droppedBlank: number
    dedupedConsecutive: number
}

/** Lines that are typically Otodom chrome (exact match after trim; length already bounded in caller). */
const OTODOM_MAIN_UI_LINES = new Set(
    [
        'Zapisz',
        'Kontakt',
        'Wróć',
        'Udostępnij',
        'Mapa',
        'Satelita',
        'Skróty klawiszowe',
        'Warunki',
        'Zgłoś',
        'Zgłoś błąd w mapach',
        'Opis',
        'Kalkulator kredytowy',
        'Powiadom o podobnych',
        'Historia i statystyki',
        'Zaloguj się i sprawdź szczegóły',
        'Zaloguj się lub załóż konto, aby otrzymać dostęp do pełnej historii ogłoszenia, w tym zmian ceny',
        'Pokaż mniej',
        'Pokaż więcej',
        'Pokaż numer',
        'Wyślij wiadomość',
        'Zapytaj o ofertę',
        'Zobacz koszty kredytu',
        'Zobacz ogłoszenia',
        'Więcej szczegółów',
        'Dostępne lokale',
        'O inwestycji',
        'Realizacja',
        'Stan inwestycji',
        'W budowie',
        'Domy',
        'Dom na sprzedaż',
        'Rynek pierwotny',
        'Rynek wtórny',
        'Data',
        'Zmiana',
        'Biuro sprzedaży',
        'Deweloper',
        'Oferta prywatna',
        'Hipoteka z ING',
        'Oblicz ratę dla tej nieruchomości',
        'Oblicz ratę dla tego domu z ING',
        'Oblicz ratę dla tego domu z ING. RRSO',
        'Finansowanie:',
        'Chcesz mieć na oku podobne nieruchomości?',
        'Włącz powiadomienia i nie przegap okazji',
        'Podobne ogłoszenia',
        'Więcej ogłoszeń',
        'Szczegóły budynku',
        'Działka i otoczenie',
        'Informacje dodatkowe:',
        // Otodom section title only (exact full-line match). Value lines under it (woda, kanalizacja, …)
        // stay in main text — do not extend rules to drop a whole "Media" block.
        'Media',
        'O deweloperze',
        'Twoje dane zostaną przekazane ogłoszeniodawcy w celu umożliwienia komunikacji.',
        'Administratorem Twoich danych osobowych jest Grupa OLX Sp. z o.o. więcej',
        'Inwestycja',
        'Rzut',
        'Cena nieruchomości',
        'Ustaw kwotę, którą zamierzasz wydać',
        'Wkład własny',
        'Okres spłaty',
        'Ile lat chcesz spłacać kredyt?',
        'Wybierz interesujące Cię warunki i odkryj ofertę idealną dla Ciebie.',
        'Minimum 20%',
        'Typ',
        'Pokoje',
        'Metraż',
        'Cena',
        'Lat',
        'zł',
        '%',
        'Imię*',
        'E-mail*',
        'Numer telefonu*',
        'Twoja wiadomość',
        'Deweloper Bezposrednio',
        'Deweloper Bezpośrednio',
    ].map((s) => s.toLocaleLowerCase('pl')),
)

function nbspToSpace(s: string): string {
    return s.replace(/\u00a0/g, ' ')
}

/**
 * First occurrence of any of these (case-insensitive, `pl` locale) ends meaningful `main`
 * body; everything after is similar listings, history, calculators, etc.
 */
const OTODOM_MAIN_TEXT_STOP_SECTIONS: readonly string[] = [
    'Podobne ogłoszenia',
    'Więcej ogłoszeń',
    'Więcej ogłoszeń od',
    'Historia i statystyki',
    'Kalkulator kredytowy',
    'Hipoteka z ING',
    'Chcesz mieć na oku podobne nieruchomości',
]

/** Truncate raw main text before line-level cleanup (similar-offer blocks, widgets). */
export function cutAtStopSection(text: string): string {
    const hay = text.toLocaleLowerCase('pl')
    let end = text.length
    for (const section of OTODOM_MAIN_TEXT_STOP_SECTIONS) {
        const needle = section.toLocaleLowerCase('pl')
        const i = hay.indexOf(needle)
        if (i !== -1 && i < end) end = i
    }
    return text.slice(0, end).trimEnd()
}

export function decodeHtmlEntities(s: string): string {
    let t = s
    t = t.replace(/&#x([0-9a-f]{1,6});/gi, (full, hex: string) => {
        const n = Number.parseInt(hex, 16)
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : full
    })
    t = t.replace(/&#(\d{1,7});/g, (full, dec: string) => {
        const n = Number.parseInt(dec, 10)
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : full
    })
    t = t.replace(/&nbsp;/gi, ' ')
    t = t.replace(/&apos;/gi, "'")
    t = t.replace(/&quot;/g, '"')
    t = t.replace(/&lt;/g, '<')
    t = t.replace(/&gt;/g, '>')
    t = t.replace(/&amp;/g, '&')
    return t
}

export function stripHtmlToPlain(html: string): string {
    const withoutTags = nbspToSpace(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    const spaced = withoutTags.replace(/\s+/g, ' ').trim()
    return decodeHtmlEntities(spaced)
}

export function sanitizeTitle(title: string): string {
    return nbspToSpace(title).replace(/\s+/g, ' ').trim()
}

function isRepeatedCharLine(t: string): boolean {
    if (t.length < 8) return false
    const c = t[0]
    if (c === undefined) return false
    return [...t].every((ch) => ch === c)
}

/** Otodom chrome + financing widgets + developer lead-gen / program copy (whole line dropped if matched). */
const OTODOM_MAIN_LINE_DROP_REGEX: RegExp[] = [
    /twoje dane zostaną przekazane/i,
    /administratorem twoich danych osobowych/i,
    /\bgrupa olx\b/i,
    /oblicz ratę/i,
    /\brrso\b/i,
    /szacowana rata/i,
    /wybierz interesujące cię warunki/i,
    /\(30 lat to najczęstszy wybór\)/i,
    /\(minimum 20%\)/i,
    /^ing bank śląski/i,
    /^więcej ogłoszeń od\b/i,
    /^podobne ogłoszenia\b/i,
    /^od [\d\s]+\s*zł\/m²\s*$/i,
    /finansowanie:\s*oblicz/i,
    /^segmentynatura\.pl$/i,
    /^ostatnia aktualizacja/i,
    /chcesz mieć na oku podobne/i,
    /rodzinny kredyt mieszkaniowy/i,
    /rodzinnego kredytu mieszkaniowego/i,
    /\bprogram\s+rkm\b/i,
    /gwarancj[ąa]\s+bkg\b/i,
    /spłata rodzinna|spłatą rodzinną|spłaty rodzinnej/i,
    /spłata części kredytu przez państwo/i,
    /zostaw kontakt/i,
    /oddzwonimy/i,
    /przeprowadzimy cię przez cały proces/i,
]

function lineMatchesDropRegex(lower: string): boolean {
    for (const re of OTODOM_MAIN_LINE_DROP_REGEX) {
        if (re.test(lower)) return true
    }
    return false
}

/**
 * Address / breadcrumb lines repeated under maps, similar ads, footers (dedupe keeps first).
 * May rarely match a short descriptive sentence with two commas; only duplicate lines are removed.
 */
function isLikelyRepeatedLocationLine(t: string): boolean {
    const commas = (t.match(/,/g) ?? []).length
    if (commas < 2 || t.length < 24) return false
    if (/^ul\.\s/i.test(t)) return true
    if (/\b\d{2}-\d{3}\b/.test(t) && commas >= 2) return true
    return !/\d/.test(t) && commas === 2 && t.length < 96;

}

function shouldDropMainLine(trimmed: string): boolean {
    if (trimmed.length === 0) return false
    if (isRepeatedCharLine(trimmed)) return true
    const lower = trimmed.toLocaleLowerCase('pl')
    if (OTODOM_MAIN_UI_LINES.has(lower)) return true
    if (lineMatchesDropRegex(lower)) return true
    if (/^zaloguj się/i.test(trimmed)) return true
    if (/^ing bank/i.test(trimmed)) return true
    if (/^dane mapy ©/i.test(trimmed)) return true
    if (/^wszystkie \(\d+\)$/i.test(trimmed)) return true
    if (/^\d+\s*pokoje?\s*\(\d+\)$/i.test(trimmed)) return true
    if (/^\d+\+\s*pokoi\s*\(\d+\)$/i.test(trimmed)) return true
    if (/^wszystkie zdjęcia\s*\(\d+\)\s*$/i.test(trimmed)) return true
    if (/^nr w biurze:/i.test(trimmed)) return true
    return /^id:\s*\d+\s*$/i.test(trimmed);

}

/**
 * Truncate at stop-section headers, then drop Otodom UI lines (exact + regex), collapse
 * consecutive duplicates, then dedupe repeated address-style lines.
 */
export function sanitizeMainTextOtodom(raw: string): {text: string; stats: OtodomMainTextSanitizeStats} {
    const normalized = cutAtStopSection(nbspToSpace(raw).replace(/\r\n/g, '\n'))
    const lines = normalized.split('\n')
    let droppedByRules = 0
    let droppedBlank = 0
    const kept: string[] = []
    for (const line of lines) {
        const t = line.trim()
        if (t.length === 0) {
            droppedBlank++
            continue
        }
        if (shouldDropMainLine(t)) {
            droppedByRules++
            continue
        }
        kept.push(t)
    }

    let dedupedConsecutive = 0
    const deduped: string[] = []
    for (const t of kept) {
        if (deduped.length > 0 && deduped[deduped.length - 1] === t) {
            dedupedConsecutive++
            continue
        }
        deduped.push(t)
    }

    const seenLocation = new Set<string>()
    let droppedDuplicateLocation = 0
    const finalLines: string[] = []
    for (const t of deduped) {
        if (isLikelyRepeatedLocationLine(t)) {
            if (seenLocation.has(t)) {
                droppedDuplicateLocation++
                continue
            }
            seenLocation.add(t)
        }
        finalLines.push(t)
    }

    return {
        text: finalLines.join('\n').trim(),
        stats: {
            linesBefore: lines.length,
            linesAfter: finalLines.length,
            droppedByRules: droppedByRules + droppedDuplicateLocation,
            droppedBlank,
            dedupedConsecutive,
        },
    }
}

/** True when non-empty `attributesRawJson` is not a JSON object (for pipeline warnings). */
export function otodomAttributesRawJsonParseFailed(raw: string): boolean {
    const t = raw.trim()
    if (t === '') return false
    try {
        const v = JSON.parse(t) as unknown
        return v === null || typeof v !== 'object' || Array.isArray(v)
    } catch {
        return true
    }
}

/**
 * Parse LD `additionalProperty` JSON into a trimmed string map (sorted key insertion order).
 * Invalid or non-object JSON → `{}` (use `otodomAttributesRawJsonParseFailed` for warnings).
 */
export function normalizeAttributesJson(raw: string): Record<string, string> {
    const t = raw.trim()
    if (t === '') return {}
    try {
        const o = JSON.parse(t) as unknown
        if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
        const rec = o as Record<string, unknown>
        const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b, 'pl'))
        const out: Record<string, string> = {}
        for (const k of keys) {
            const v = rec[k]
            if (v === null || v === undefined) continue
            const s = typeof v === 'string' ? v : String(v)
            out[k] = nbspToSpace(s).replace(/\s+/g, ' ').trim()
        }
        return out
    } catch {
        return {}
    }
}

/** Stable JSON for debug logs only (sorted keys). */
export function stringifyNormalizedAttributes(attrs: Record<string, string>): string {
    const keys = Object.keys(attrs).sort((a, b) => a.localeCompare(b, 'pl'))
    const ordered: Record<string, string> = {}
    for (const k of keys) ordered[k] = attrs[k]
    return JSON.stringify(ordered)
}

/**
 * Deterministic text cleanup from a raw crawl row (does not mutate the snapshot).
 * Used by the compact sanitizer and by LLM context builders.
 *
 * **LLM / importer priority:** rely on `descriptionPlain`, `attributes`, and structured snapshot
 * fields first; treat `mainTextCleaned` as **fallback** only (DOM can change; sanitizer is best-effort).
 */
export function computeOtodomTextCleanup(item: OtodomListingSnapshotItem): {
    title: string
    descriptionPlain: string
    mainTextCleaned: string
    attributes: Record<string, string>
} {
    const descPlain = stripHtmlToPlain(item.description ?? '')
    const {text: mainClean} = sanitizeMainTextOtodom(item.mainTextRaw ?? '')
    const attributes = normalizeAttributesJson(item.attributesRawJson)

    const hasDesc = item.description != null && item.description.trim() !== ''
    const descriptionPlain = hasDesc ? (descPlain.length > 0 ? descPlain : '') : ''

    return {
        title: sanitizeTitle(item.title),
        descriptionPlain,
        mainTextCleaned: mainClean,
        attributes,
    }
}
