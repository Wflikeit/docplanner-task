import type { Listing } from '../../api/listingsTypes'

/** Shown when a value is missing (including price). */
const NOT_PROVIDED = 'Not provided'

export type ListingCardModel = {
  id: string
  title: string
  priceLabel: string
  /** True when `priceAmount` is missing — show hint to check price on the source site. */
  priceUnknown: boolean
  locationLabel: string
  areaLabel: string
  roomsLabel: string
  badges: { key: string; label: string }[]
  thumbUrl?: string | null
}

export type ListingDetailModel = {
  id: string
  title: string
  priceLabel: string
  /** True when `priceAmount` is missing — show hint to check price on the source site. */
  priceUnknown: boolean
  locationLabel: string
  rows: { label: string; value: string }[]
  description: string
  sourceUrl?: string | null
  /** When set, shown in a collapsible block (not in the main field grid). */
  aiSummary?: string | null
  /** Shown as colored chips at the bottom of the listing page. */
  aiTags: string[]
  /** Hero image on the detail page (first listing photo). */
  imageUrl?: string | null
}

function nonEmpty(v: string | null | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

/** Listed date from API ISO string — calendar day only (no time). */
function formatListedDate(iso: string): string {
  const t = iso.trim()
  if (!t) return iso
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

function formatRoomsEn(n: number): string {
  if (!Number.isFinite(n) || n < 1) return NOT_PROVIDED
  return n === 1 ? '1 room' : `${n} rooms`
}

function isPriceMissing(amount: number | null | undefined): boolean {
  return amount == null || Number.isNaN(amount)
}

function formatPrice(amount: number | null | undefined, currency: string | null | undefined): string {
  if (isPriceMissing(amount)) return NOT_PROVIDED
  const n = amount as number
  const cur = currency?.trim()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur || 'PLN',
      maximumFractionDigits: 0,
    }).format(n)
  } catch {
    return cur ? `${n} ${cur}` : String(n)
  }
}

export function toListingCard(listing: Listing): ListingCardModel {
  const badges: ListingCardModel['badges'] = []
  if (listing.furnished === true) badges.push({ key: 'furnished', label: 'Furnished' })
  for (const tag of listing.aiTags ?? []) {
    const t = tag.trim()
    if (t) badges.push({ key: `ai-${t}`, label: t.replaceAll('_', ' ') })
  }

  const title = nonEmpty(listing.title) ?? 'Untitled'
  const loc = [nonEmpty(listing.city), nonEmpty(listing.street), nonEmpty(listing.district)]
    .filter(Boolean)
    .join(', ')

  return {
    id: listing.id,
    title,
    priceLabel: formatPrice(listing.priceAmount ?? null, listing.priceCurrency ?? null),
    priceUnknown: isPriceMissing(listing.priceAmount ?? null),
    locationLabel: loc || NOT_PROVIDED,
    areaLabel:
      listing.areaSqm != null && !Number.isNaN(listing.areaSqm)
        ? `${listing.areaSqm} m²`
        : NOT_PROVIDED,
    roomsLabel:
      listing.rooms != null && !Number.isNaN(listing.rooms)
        ? formatRoomsEn(listing.rooms)
        : NOT_PROVIDED,
    badges,
    thumbUrl: listing.imageUrl,
  }
}

export function toListingDetail(listing: Listing): ListingDetailModel {
  const rows: ListingDetailModel['rows'] = [
    { label: 'Price', value: formatPrice(listing.priceAmount ?? null, listing.priceCurrency ?? null) },
    { label: 'City', value: nonEmpty(listing.city) ?? NOT_PROVIDED },
    { label: 'District', value: nonEmpty(listing.district) ?? NOT_PROVIDED },
    { label: 'Street', value: nonEmpty(listing.street) ?? NOT_PROVIDED },
    {
      label: 'Area',
      value:
        listing.areaSqm != null && !Number.isNaN(listing.areaSqm)
          ? `${listing.areaSqm} m²`
          : NOT_PROVIDED,
    },
    {
      label: 'Rooms',
      value:
        listing.rooms != null && !Number.isNaN(listing.rooms)
          ? formatRoomsEn(listing.rooms)
          : NOT_PROVIDED,
    },
    {
      label: 'Furnished',
      value:
        listing.furnished === true ? 'Yes' : listing.furnished === false ? 'No' : NOT_PROVIDED,
    },
  ]

  if (listing.createdAt) {
    rows.push({ label: 'Listed', value: formatListedDate(listing.createdAt) })
  }

  const loc = [nonEmpty(listing.city), nonEmpty(listing.street), nonEmpty(listing.district)]
    .filter(Boolean)
    .join(', ')

  const aiSummary = listing.aiSummary?.trim() ? listing.aiSummary.trim() : null
  const aiTags = (listing.aiTags ?? []).map((t) => t.trim()).filter(Boolean)

  return {
    id: listing.id,
    title: nonEmpty(listing.title) ?? 'Untitled',
    priceLabel: formatPrice(listing.priceAmount ?? null, listing.priceCurrency ?? null),
    priceUnknown: isPriceMissing(listing.priceAmount ?? null),
    locationLabel: loc || NOT_PROVIDED,
    rows,
    description: listing.description?.trim() ? listing.description.trim() : 'No description.',
    sourceUrl: listing.sourceUrl,
    aiSummary,
    aiTags,
    imageUrl: listing.imageUrl ?? null,
  }
}
