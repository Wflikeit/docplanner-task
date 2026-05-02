/**
 * Parse Otodom listing detail `application/ld+json` — prefer House node in @graph.
 */

export type OtodomLdAddress = {
  streetAddress?: string | null
  addressLocality?: string | null
  addressRegion?: string | null
  addressCountry?: string | null
}

/** Structured fields read from Schema.org JSON-LD (not business-normalized). */
export type ParsedOtodomHouse = {
  name: string | null
  url: string | null
  descriptionHtml: string | null
  numberOfRooms: number | null
  address: OtodomLdAddress | null
  /** Human single-line from PostalAddress parts (comma-separated). */
  locationDisplay: string | null
  priceAmount: number | null
  priceCurrency: string | null
  pricePerSqm: number | null
  /** additionalProperty name → value (stringified). */
  additionalPropertyMap: Record<string, string>
  imageUrls: string[]
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null
}

function typeIncludesHouse(types: unknown): boolean {
  if (types === 'House') return true
  if (Array.isArray(types)) return types.some((t) => t === 'House')
  return false
}

function toNumber(x: unknown): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return x
  if (typeof x === 'string') {
    const n = Number.parseFloat(x.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function collectImages(imageField: unknown): string[] {
  if (!imageField) return []
  if (typeof imageField === 'string') return [imageField]
  if (Array.isArray(imageField)) {
    const out: string[] = []
    for (const item of imageField) {
      if (typeof item === 'string') out.push(item)
      else {
        const o = asRecord(item)
        const u = o?.url
        if (typeof u === 'string') out.push(u)
      }
    }
    return out
  }
  const o = asRecord(imageField)
  const u = o?.url
  if (typeof u === 'string') return [u]
  return []
}

function readAdditionalProperty(house: Record<string, unknown>): Record<string, string> {
  const raw = house.additionalProperty
  const map: Record<string, string> = {}
  if (!Array.isArray(raw)) return map
  for (const entry of raw) {
    const o = asRecord(entry)
    if (!o) continue
    const name = o.name
    const value = o.value
    if (typeof name !== 'string' || name.trim() === '') continue
    if (value === undefined || value === null) map[name] = ''
    else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      map[name] = String(value)
    else map[name] = JSON.stringify(value)
  }
  return map
}

function readAddress(house: Record<string, unknown>): OtodomLdAddress | null {
  const a = asRecord(house.address)
  if (!a) return null
  return {
    streetAddress: typeof a.streetAddress === 'string' ? a.streetAddress : null,
    addressLocality: typeof a.addressLocality === 'string' ? a.addressLocality : null,
    addressRegion: typeof a.addressRegion === 'string' ? a.addressRegion : null,
    addressCountry: typeof a.addressCountry === 'string' ? a.addressCountry : null,
  }
}

function joinLocation(addr: OtodomLdAddress | null): string | null {
  if (!addr) return null
  const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  return parts.length ? parts.join(', ') : null
}

function isPerSqmUnit(spec: Record<string, unknown>): boolean {
  const unit = spec.unitCode
  if (unit === 'MTK') return true
  const unitText = typeof spec.unitText === 'string' ? spec.unitText : ''
  if (/square\s*meter/i.test(unitText)) return true
  return /m\s*²|m²|\bm2\b|metr(ów)?\s*kwadratow(ych)?/i.test(unitText);

}

function readPricePerSqmFromOfferSpecs(offers: Record<string, unknown>): number | null {
  const raw = offers.priceSpecification
  const list: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  for (const entry of list) {
    const spec = asRecord(entry)
    if (!spec) continue
    if (!isPerSqmUnit(spec)) continue
    const p = toNumber(spec.price)
    if (p !== null && p > 0) return p
  }
  return null
}

function readOffers(house: Record<string, unknown>): {
  priceAmount: number | null
  priceCurrency: string | null
  pricePerSqm: number | null
} {
  const offers = asRecord(house.offers)
  if (!offers) return { priceAmount: null, priceCurrency: null, pricePerSqm: null }
  const priceAmount = toNumber(offers.price)
  const priceCurrency = typeof offers.priceCurrency === 'string' ? offers.priceCurrency : null
  const pricePerSqm = readPricePerSqmFromOfferSpecs(offers)
  return { priceAmount, priceCurrency, pricePerSqm }
}

function findHouseInGraph(graph: unknown[]): Record<string, unknown> | null {
  for (const node of graph) {
    const o = asRecord(node)
    if (!o) continue
    if (typeIncludesHouse(o['@type'])) return o
  }
  return null
}

/** Parse first valid JSON object from ld+json script text; returns null on failure. */
export function parseLdJsonRoot(ldScriptText: string): Record<string, unknown> | null {
  const trimmed = ldScriptText.trim()
  if (!trimmed) return null
  try {
    const root = JSON.parse(trimmed) as unknown
    return asRecord(root)
  } catch {
    return null
  }
}

/**
 * Extract House-shaped listing data from Otodom `application/ld+json` body.
 * Returns null if no @graph or no House node.
 */
export function parseOtodomHouseFromLdJson(ldScriptText: string): ParsedOtodomHouse | null {
  const root = parseLdJsonRoot(ldScriptText)
  if (!root) return null
  const graph = root['@graph']
  if (!Array.isArray(graph)) return null
  const house = findHouseInGraph(graph)
  if (!house) return null

  const address = readAddress(house)
  const { priceAmount, priceCurrency, pricePerSqm } = readOffers(house)
  const additionalPropertyMap = readAdditionalProperty(house)
  const imageUrls = collectImages(house.image)

  const name = typeof house.name === 'string' ? house.name : null
  const url = typeof house.url === 'string' ? house.url : null
  const descriptionHtml = typeof house.description === 'string' ? house.description : null
  const numberOfRooms = toNumber(house.numberOfRooms)

  return {
    name,
    url,
    descriptionHtml,
    numberOfRooms,
    address,
    locationDisplay: joinLocation(address),
    priceAmount,
    priceCurrency,
    pricePerSqm,
    additionalPropertyMap,
    imageUrls,
  }
}

export function attributesMapToJsonString(map: Record<string, string>): string {
  return JSON.stringify(map, null, 0)
}

/** Parse Polish price line like `1 599 000 zł` → integer PLN (null if not matched). */
export function parsePriceAmountFromDomLine(line: string | null | undefined): number | null {
  if (!line) return null
  const normalized = line.replace(/\u00a0/g, ' ').trim()
  /** No `\b` after `zł`: in JS `\b` is ASCII-`\w`-based, so Polish `ł` breaks `zł\b` at EOL. */
  const m = normalized.match(/([\d\s]+)\s*zł/i)
  if (!m) return null
  const n = Number.parseInt(m[1].replace(/\s/g, ''), 10)
  return Number.isFinite(n) && n >= 1000 ? n : null
}

/**
 * Otodom header often shows e.g. `9 460 zł/m²` on its own line or after the total price.
 * Does not match plain `… zł` (no `/m`).
 */
export function parsePricePerSqmFromDomLine(line: string | null | undefined): number | null {
  if (!line) return null
  const normalized = line.replace(/\u00a0/g, ' ')
  const re = /([\d\s]+)\s*zł\s*\/\s*m[²2]?/gi
  let best: number | null = null
  for (;;) {
    const m = re.exec(normalized)
    if (!m) break
    const n = Number.parseInt(m[1].replace(/\s/g, ''), 10)
    if (Number.isFinite(n) && n > 0 && n < 1_000_000) best = n
  }
  return best
}

/** Try `Powierzchnia` / similar from LD `additionalProperty` values (raw strings). */
export function readAreaSqmFromAttributesMap(map: Record<string, string>): number | null {
  const v = map['Powierzchnia'] ?? map['Powierzchnia użytkowa'] ?? map['Powierzchnia całkowita']
  if (!v) return null
  const m = v.replace(/\u00a0/g, ' ').match(/([\d.,]+)\s*m/i)
  if (!m) return null
  const n = Number.parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function readRoomsFromAttributesMap(
  map: Record<string, string>,
  numberOfRooms: number | null,
): number | null {
  if (numberOfRooms !== null && numberOfRooms !== undefined) return numberOfRooms
  const v = map['Liczba pokoi']
  if (!v) return null
  const m = v.replace(/\u00a0/g, ' ').match(/(\d+)/)
  return m ? Number.parseInt(m[1], 10) : null
}
