import type {
  OtodomExtractedFieldKey,
  OtodomExtractionSource,
  OtodomListingSnapshotItem,
} from './listingSnapshot.js'
import {
  attributesMapToJsonString,
  parseOtodomHouseFromLdJson,
  parsePriceAmountFromDomLine,
  parsePricePerSqmFromDomLine,
  readAreaSqmFromAttributesMap,
  readRoomsFromAttributesMap,
  type ParsedOtodomHouse,
} from './ldJsonHouse.js'

export type DetailPagePayload = {
  ldJsonScriptText: string
  dataCyTitle: string
  dataCyPriceLine: string
  dataCyDescription: string
  mainTextRaw: string
  mainTextRawTruncated: boolean
}

/**
 * Merge browser payload into a snapshot row: JSON-LD primary, `data-cy` fallback, `mainTextRaw` audit only.
 */
export function mergeOtodomDetailPayload(args: {
  externalId: string
  sourceUrl: string
  scrapedAt: string
  /** Full `application/ld+json` text — parsed before any truncation. */
  ldJsonRaw: string
  ldJsonRawMax: number
  payload: DetailPagePayload
}): OtodomListingSnapshotItem {
  const { externalId, sourceUrl, scrapedAt, ldJsonRaw: ldFull, ldJsonRawMax, payload } = args
  const parsed: ParsedOtodomHouse | null = parseOtodomHouseFromLdJson(ldFull)
  const map = parsed?.additionalPropertyMap ?? {}
  const attributesRawJson = attributesMapToJsonString(map)

  let ldJsonRaw = ldFull
  let ldJsonRawTruncated = false
  if (ldJsonRaw.length > ldJsonRawMax) {
    ldJsonRaw = ldJsonRaw.slice(0, ldJsonRawMax)
    ldJsonRawTruncated = true
  }

  const extractionSources: Partial<Record<OtodomExtractedFieldKey, OtodomExtractionSource>> = {}

  const titleLd = !!(parsed?.name && parsed.name.trim())
  const titleDom = !!(payload.dataCyTitle && payload.dataCyTitle.trim())
  const title = (parsed?.name && parsed.name.trim()) || payload.dataCyTitle.trim() || 'Untitled'
  extractionSources.title = titleLd ? 'ld' : titleDom ? 'dataCy' : 'missing'

  const descLd = !!(parsed?.descriptionHtml && parsed.descriptionHtml.trim())
  const descDom = !!(payload.dataCyDescription && payload.dataCyDescription.trim())
  const description = (parsed?.descriptionHtml && parsed.descriptionHtml.trim())
    ? parsed.descriptionHtml
    : payload.dataCyDescription.trim() || null
  extractionSources.description = descLd ? 'ld' : descDom ? 'dataCy' : 'missing'

  const priceLd = parsed?.priceAmount !== null && parsed?.priceAmount !== undefined
  const priceDom = parsePriceAmountFromDomLine(payload.dataCyPriceLine) !== null
  const priceAmount = parsed?.priceAmount ?? parsePriceAmountFromDomLine(payload.dataCyPriceLine)
  extractionSources.priceAmount = priceLd ? 'ld' : priceDom ? 'dataCy' : 'missing'

  const curLd = !!(parsed?.priceCurrency && parsed.priceCurrency.trim())
  const priceCurrency = parsed?.priceCurrency?.trim() || 'PLN'
  extractionSources.priceCurrency = curLd ? 'ld' : 'missing'

  const rooms = readRoomsFromAttributesMap(map, parsed?.numberOfRooms ?? null)
  extractionSources.rooms = rooms != null ? 'ld' : 'missing'

  const areaSqm = readAreaSqmFromAttributesMap(map)
  extractionSources.areaSqm = areaSqm != null ? 'ld' : 'missing'

  const pricePerSqmFromLd =
    typeof parsed?.pricePerSqm === 'number' && parsed.pricePerSqm > 0 ? parsed.pricePerSqm : null
  const pricePerSqmFromDom = parsePricePerSqmFromDomLine(payload.dataCyPriceLine)
  let pricePerSqm: number | null = pricePerSqmFromLd ?? pricePerSqmFromDom ?? null
  let pricePerSqmSource: OtodomExtractionSource = pricePerSqmFromLd
    ? 'ld'
    : pricePerSqmFromDom
      ? 'dataCy'
      : 'missing'
  if (
    pricePerSqm == null &&
    priceAmount != null &&
    priceAmount > 0 &&
    areaSqm != null &&
    areaSqm > 0
  ) {
    pricePerSqm = Math.round(priceAmount / areaSqm)
    pricePerSqmSource = 'computed'
  }
  extractionSources.pricePerSqm = pricePerSqm != null ? pricePerSqmSource : 'missing'

  const imageUrls = parsed?.imageUrls?.length ? parsed.imageUrls : []
  const imageUrl = imageUrls[0] ?? null
  extractionSources.imageUrls = imageUrls.length > 0 ? 'ld' : 'missing'
  extractionSources.imageUrl = imageUrl ? 'ld' : 'missing'

  const locationDisplay = parsed?.locationDisplay?.trim() || null
  extractionSources.locationDisplay = locationDisplay ? 'ld' : 'missing'

  extractionSources.attributesRawJson = Object.keys(map).length > 0 ? 'ld' : 'missing'

  return {
    externalId,
    sourceUrl,
    scrapedAt,
    ldJsonRaw,
    ldJsonRawTruncated,
    attributesRawJson,
    imageUrls,
    imageUrl,
    pricePerSqm,
    locationDisplay,
    locationRaw: locationDisplay,
    addressFromLd: parsed?.address ?? null,
    extractionSources,
    mainTextRaw: payload.mainTextRaw,
    mainTextRawTruncated: payload.mainTextRawTruncated,
    title,
    description,
    priceAmount: priceAmount ?? null,
    priceCurrency,
    areaSqm: areaSqm ?? null,
    rooms: rooms ?? null,
  }
}
