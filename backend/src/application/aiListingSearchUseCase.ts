/** Mock conversational search — replace with real AI + port when integrated. */
export type AiChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AiListingSearchResult = {
  reply: string
  q?: string | null
  city?: string | null
  priceMin?: number | null
  priceMax?: number | null
  rooms?: number | null
}

export function executeAiListingSearchMock(
  messages: AiChatTurn[],
): AiListingSearchResult {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')

  const mockReply =
    lastUser?.content?.trim() ?
      `[mock AI] For “${lastUser.content.trim().slice(0, 80)}${lastUser.content.length > 80 ? '…' : ''}” — use the list filters or narrow down city and budget.`
    : '[mock AI] Describe what you are looking for (city, rooms, budget).'

  const out: AiListingSearchResult = {
    reply: mockReply,
  }

  const text = (lastUser?.content ?? '').toLowerCase()
  if (text.includes('warsaw')) out.city = 'Warsaw'
  if (text.includes('krakow') || text.includes('cracow')) out.city = 'Krakow'
  if (text.includes('gdansk')) out.city = 'Gdansk'
  if (text.includes('poznan')) out.city = 'Poznan'
  if (text.includes('wroclaw')) out.city = 'Wroclaw'
  if (/\b2\s*rooms?\b/.test(text) || /\btwo\s+rooms?\b/.test(text))
    out.rooms = 2
  if (text.includes('cheap') || text.includes('inexpensive') || text.includes('budget')) {
    out.priceMax = 3500
  }

  return out
}
