/** Core listing entity — no HTTP/API concerns. */
export type Listing = {
  /** Public listing id: DB primary key as decimal string when persisted. */
  id: string
  title: string
  description?: string | null
  priceAmount?: number | null
  priceCurrency?: string | null
  city?: string | null
  district?: string | null
  street?: string | null
  areaSqm?: number | null
  rooms?: number | null
  furnished?: boolean | null
  imageUrl?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  createdAt?: string | null
  /** From Gemini tagging file (`tag-otodom-with-gemini`); omitted when not merged. */
  aiTags?: string[] | null
  aiSummary?: string | null
  aiTaggingWarnings?: string[] | null
}
