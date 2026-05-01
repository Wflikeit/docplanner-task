/** Core listing entity — no HTTP/API concerns. */
export type Listing = {
  id: string
  title: string
  description?: string | null
  priceAmount?: number | null
  priceCurrency?: string | null
  city?: string | null
  district?: string | null
  areaSqm?: number | null
  rooms?: number | null
  furnished?: boolean | null
  isNewOffer?: boolean | null
  imageUrl?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  createdAt?: string | null
}
