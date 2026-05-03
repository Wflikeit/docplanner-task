import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

import {
  OTODOM_LISTING_TAG_IDS,
  stripJsonCodeFence,
} from './otodomTagging.js'
import type { AiListingSearchModelPatch } from '../../application/listingAiSearchMerge.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
/** `backend/` package root — works for both `src/...` (tsx) and `dist/...` (node). */
const BACKEND_ROOT = join(__dirname, '..', '..', '..')

export type GeminiListingSearchIntent = AiListingSearchModelPatch & {
  reply: string
}

const GeminiListingSearchIntentSchema = z.object({
  reply: z.string().trim().min(1),
  q: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  priceMin: z.number().nullable().optional(),
  priceMax: z.number().nullable().optional(),
  roomsMin: z.number().nullable().optional(),
  tags: z.array(z.enum(OTODOM_LISTING_TAG_IDS)).nullable().optional(),
})

function resolvePromptPath(): string {
  const env = process.env.AI_SEARCH_PROMPT_PATH?.trim()
  if (env) return isAbsolute(env) ? env : join(BACKEND_ROOT, env)
  return join(__dirname, 'prompts', 'listing-ai-search.prompt.md')
}

function loadPromptTemplate(): string {
  const path = resolvePromptPath()
  let t = readFileSync(path, 'utf8')
  const allowedBlock = OTODOM_LISTING_TAG_IDS.join('\n')
  t = t.replace('{{ALLOWED_TAGS}}', allowedBlock)
  return t
}

/**
 * Parses model JSON for listing search intent. Returns null if invalid.
 */
export function parseGeminiListingSearchIntentText(
  text: string,
): GeminiListingSearchIntent | null {
  try {
    const raw = stripJsonCodeFence(text)
    return GeminiListingSearchIntentSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
}

export type GeminiListingSearchCallInput = {
  activeFiltersJson: string
  conversationBlock: string
}

function buildUserContents(
  template: string,
  input: GeminiListingSearchCallInput,
): string {
  return [
    template.trim(),
    '',
    '## activeFilters (JSON)',
    input.activeFiltersJson,
    '',
    '## conversation',
    input.conversationBlock,
  ].join('\n')
}

const DEFAULT_MODEL =
  process.env.AI_SEARCH_GEMINI_MODEL?.trim() ||
  process.env.OTODOM_GEMINI_MODEL?.trim() ||
  'gemini-2.5-flash'

export async function callGeminiListingSearchIntent(
  apiKey: string,
  input: GeminiListingSearchCallInput,
): Promise<GeminiListingSearchIntent> {
  const template = loadPromptTemplate()
  const contents = buildUserContents(template, input)
  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents,
  })
  const text = response.text?.trim() ?? ''
  const intent = parseGeminiListingSearchIntentText(text)
  if (intent === null) {
    throw new Error(
      `listing_ai_search_invalid_json: ${text.slice(0, 400)}${text.length > 400 ? '…' : ''}`,
    )
  }
  return intent
}
