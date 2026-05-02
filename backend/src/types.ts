/**
 * Mirrors `frontend/src/api/listingsTypes.ts` and `aiSearchTypes.ts`.
 * Change together with the frontend contract.
 */

export type ListingDto = {
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
}

export type ListingsPageDto = {
  items: ListingDto[]
  total: number
  page: number
  pageSize: number
}

export type AiChatMessageDto = {
  role: 'user' | 'assistant'
  content: string
}

export type AiListingSearchRequestDto = {
  messages: AiChatMessageDto[]
}

export type AiListingSearchResponseDto = {
  reply: string
  q?: string | null
  city?: string | null
  priceMin?: number | null
  priceMax?: number | null
  roomsMin?: number | null
}
