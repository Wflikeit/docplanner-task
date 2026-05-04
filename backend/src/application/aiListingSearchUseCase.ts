import process from 'node:process'

import type { ListListingsQuery, ListingsPageResult } from './listingPageTypes.js'
import type { ListingSourcePort } from './listingSourcePort.js'
import { listListingsPage } from './listingUseCases.js'
import {
  type AiListingSearchActiveFilters,
  type AiListingSearchModelPatch,
  filterToAllowedTags,
  mergeAiSearchIntoListQuery,
} from './listingAiSearchMerge.js'
import type { GeminiListingSearchIntent } from '../infrastructure/ai/listingAiSearchGemini.js'
import { callGeminiListingSearchIntent } from '../infrastructure/ai/listingAiSearchGemini.js'

/** Wire-compatible chat turns (same as HTTP). */
export type AiChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

export type AiListingSearchRunResult = {
  reply: string
  mergedQuery: ListListingsQuery
  listingsPage: ListingsPageResult
}

/**
 * Gemini when `GEMINI_API_KEY` is set; otherwise mock (no API calls).
 */
export async function runAiListingSearch(
  listingSource: ListingSourcePort,
  messages: AiChatTurn[],
  active: AiListingSearchActiveFilters,
): Promise<AiListingSearchRunResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return runAiListingSearchWithMock(listingSource, messages, active)
  }
  return runAiListingSearchWithGemini(listingSource, messages, active, apiKey)
}

// -----------------------------------------------------------------------------
// Mock — stub intent, same merge + list as production
// -----------------------------------------------------------------------------

/** Stub when `GEMINI_API_KEY` is missing: no filter heuristics — use real Gemini for intent. */
export function buildMockListingSearchIntent(messages: AiChatTurn[]): GeminiListingSearchIntent {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')

  const mockReply =
    lastUser?.content?.trim() ?
      `[mock AI] Set \`GEMINI_API_KEY\` for real intent parsing. Preview: “${lastUser.content.trim().slice(0, 80)}${lastUser.content.length > 80 ? '…' : ''}”.`
    : '[mock AI] Describe what you are looking for; with a real API key the model maps intent to filters and tags.'

  return {
    reply: mockReply,
  }
}

export async function runAiListingSearchWithMock(
  listingSource: ListingSourcePort,
  messages: AiChatTurn[],
  active: AiListingSearchActiveFilters,
): Promise<AiListingSearchRunResult> {
  const intent = buildMockListingSearchIntent(messages)
  const { reply, ...patch } = intent
  const mergedQuery = mergeAiSearchIntoListQuery(active, patch)
  const listingsPage = await listListingsPage(listingSource, mergedQuery)
  return { reply, mergedQuery, listingsPage }
}

// -----------------------------------------------------------------------------
// Gemini — build LLM input → intent JSON → normalize patch → merge → list
// -----------------------------------------------------------------------------

export async function runAiListingSearchWithGemini(
    listingSource: ListingSourcePort,
    messages: AiChatTurn[],
    active: AiListingSearchActiveFilters,
    apiKey: string,
): Promise<AiListingSearchRunResult> {
    const activeFiltersJson = JSON.stringify(active, null, 2)
    const rawBlock = conversationBlock(messages)
    const maxChars = listingSearchMaxConversationChars()
    const conversationBlockClamped = clampConversationBlockForLlm(
        rawBlock,
        maxChars,
    )
    const intent = await callGeminiListingSearchIntent(apiKey, {
        activeFiltersJson,
        conversationBlock: conversationBlockClamped,
    })
    const { reply, ...patch } = intent
    const patchNorm = normalizeAiSearchPatchAfterIntent(messages, active, patch)
    const mergedQuery = mergeAiSearchIntoListQuery(active, patchNorm)
    const listingsPage = await listListingsPage(listingSource, mergedQuery)
    return { reply, mergedQuery, listingsPage }
}

function conversationBlock(messages: AiChatTurn[]): string {
  return messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n')
}

function listingSearchMaxConversationChars(): number {
  const raw = process.env.AI_SEARCH_MAX_CONVERSATION_CHARS?.trim()
  if (raw === undefined || raw === '') return 8000
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 500 ? n : 8000
}

/** Max characters of the `## conversation` section sent to Gemini (full UTF-16 length). */
export function clampConversationBlockForLlm(
  block: string,
  maxChars: number,
): string {
  if (block.length <= maxChars) return block
  return `${block.slice(0, maxChars)}\n\n[…truncated: exceeded ${maxChars} characters]`
}

function modelReturnedStructuredSearchWithoutQ(
  patch: AiListingSearchModelPatch,
): boolean {
  if (typeof patch.city === 'string' && patch.city.trim() !== '') return true
  if (typeof patch.priceMin === 'number') return true
  if (typeof patch.priceMax === 'number') return true
  if (typeof patch.roomsMin === 'number') return true
  if (patch.tags !== undefined && patch.tags !== null) {
    return filterToAllowedTags(patch.tags).length > 0
  }
  return false
}

/**
 * Gemini returned structured filters but omitted `q`. The UI often puts the same natural-language
 * sentence in `active.q` as in the last user message; SQL `q` is substring match on title/body,
 * so leaving it AND'd with tags yields zero rows. Clear `q` in that case.
 */
export function normalizeAiSearchPatchAfterIntent(
  messages: AiChatTurn[],
  active: AiListingSearchActiveFilters,
  patch: AiListingSearchModelPatch,
): AiListingSearchModelPatch {
  if (patch.q !== undefined) return patch
  const activeQ = active.q?.trim() ?? ''
  if (activeQ === '') return patch
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const lastText = lastUser?.content?.trim() ?? ''
  if (lastText === '' || lastText !== activeQ) return patch
  if (!modelReturnedStructuredSearchWithoutQ(patch)) return patch
  return { ...patch, q: null }
}

