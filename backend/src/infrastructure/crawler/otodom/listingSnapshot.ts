/** How a snapshot field was filled (phase-1 extraction audit). */
export type OtodomExtractionSource = 'ld' | 'dataCy' | 'computed' | 'missing'

export const OTODOM_SNAPSHOT_OUTPUT_KIND = 'otodom_snapshot_v2' as const

export type OtodomSnapshotMeta = {
  outputKind: typeof OTODOM_SNAPSHOT_OUTPUT_KIND
  source: 'otodom'
  searchUrl: string
  targetCount: number
  collectedUrls: number
  scrapedAt: string
  note?: string
}

/** Postal address as published in JSON-LD (no normalization). */
export type OtodomAddressFromLd = {
  streetAddress?: string | null
  addressLocality?: string | null
  addressRegion?: string | null
  addressCountry?: string | null
}

/**
 * One row from an Otodom detail page — **phase 1 raw capture**.
 *
 * **Primary:** `ldJsonRaw` + structured merge from `application/ld+json` (House in `@graph`).
 * **Fallback:** DOM `data-cy` snippets when LD is incomplete (see `extractionSources`).
 * **Audit only:** `mainTextRaw` — full `main.innerText` for diffing; not the semantic source of truth.
 */
export type OtodomListingSnapshotItem = {
  externalId: string
  sourceUrl: string
  scrapedAt: string
  /** Raw body of the listing `script[type="application/ld+json"]` (may be capped). */
  ldJsonRaw: string
  ldJsonRawTruncated?: boolean
  /** `additionalProperty` from LD as JSON object string (name → value). */
  attributesRawJson: string
  imageUrls: string[]
  /** First image URL (MVP convenience); same as `imageUrls[0]` when present. */
  imageUrl: string | null
  pricePerSqm?: number | null
  /** Single-line address from LD `PostalAddress` parts. */
  locationDisplay: string | null
  /** Optional legacy one-line location (e.g. breadcrumb); may equal `locationDisplay`. */
  locationRaw?: string | null
  addressFromLd?: OtodomAddressFromLd | null
  /** Per-field provenance: `ld` | `dataCy` | `computed` | `missing` for key MVP columns. */
  extractionSources?: Partial<Record<OtodomExtractedFieldKey, OtodomExtractionSource>>
  /** Full `main.innerText` (NBSP→space), capped — audit/debug only. */
  mainTextRaw: string
  mainTextRawTruncated?: boolean
  title: string
  /** Description: prefer LD HTML; may be DOM text when LD missing. Not sanitized. */
  description?: string | null
  priceAmount?: number | null
  priceCurrency?: string | null
  areaSqm?: number | null
  rooms?: number | null
}

/** Keys we record provenance for in `extractionSources`. */
export type OtodomExtractedFieldKey =
  | 'title'
  | 'description'
  | 'priceAmount'
  | 'priceCurrency'
  | 'pricePerSqm'
  | 'rooms'
  | 'areaSqm'
  | 'imageUrl'
  | 'imageUrls'
  | 'locationDisplay'
  | 'attributesRawJson'

