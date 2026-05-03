import {performance} from 'node:perf_hooks'

import type {Express, NextFunction, Request, RequestHandler, Response} from 'express'

import type {ListingSourcePort} from '../../application/listingSourcePort.js'
import type {ListListingsQuery} from '../../application/listingPageTypes.js'
import type {AiListingSearchActiveFilters} from '../../application/listingAiSearchMerge.js'
import {createLogger} from '../../infrastructure/logging/logger.js'
import {runAiListingSearch} from '../../application/aiListingSearchUseCase.js'
import {getListingById, listListingsPage} from '../../application/listingUseCases.js'
import {toAiListingSearchHttpResponse, toListingResource, toPaginatedListings,} from '../mappers/listingMappers.js'
import {z} from 'zod'
import {ListListingsQuerySchema} from './listListingsQueryFromParsedQs.js'

const AiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const AiSearchActiveFiltersSchema = z
  .object({
    q: z.string().optional(),
    city: z.string().optional(),
    priceMin: z.number().optional(),
    priceMax: z.number().optional(),
    roomsMin: z.number().optional(),
    tags: z.array(z.string()).optional(),
  })
  .strict()

const AiListingSearchBodySchema = z.object({
  messages: z.array(AiChatMessageSchema).min(1),
  activeFilters: AiSearchActiveFiltersSchema.optional(),
})

const aiSearchLog = createLogger('ai-search')
const listingsLog = createLogger('listings')

export function registerListingHttpRoutes(
  app: Express,
  listingSource: ListingSourcePort,
): void {
  app.get(
    '/api/listings',
    asyncHandler(async (req, res) => {
      const t0 = performance.now()
      const parsed = ListListingsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        listingsLog.info(`400 invalid_query · ${msSince(t0)}ms`)
        res.status(400).json({ message: 'Invalid query parameters', issues: z.flattenError(parsed.error) })
        return
      }
      const q = parsed.data
      const page = await listListingsPage(listingSource, q)
      listingsLog.info(
        [
          `200 ok`,
          `${msSince(t0)}ms`,
          `filters={${summarizeListListingsQueryForLog(q)}}`,
          `hits=${page.total} page=${page.page}/${page.pageSize}`,
        ].join(' · '),
      )
      res.json(toPaginatedListings(page))
    }),
  )

  app.get(
    '/api/listings/:id',
    asyncHandler(async (req, res) => {
      const t0 = performance.now()
      const id = firstPathParam(req.params.id)
      if (id === undefined) {
        listingsLog.info(`400 missing_id · ${msSince(t0)}ms`)
        res.status(400).json({ message: 'Missing id' })
        return
      }
      const listing = await getListingById(listingSource, id)
      if (!listing) {
        listingsLog.info(`404 · ${msSince(t0)}ms · id=${id}`)
        res.status(404).json({ message: 'Not found' })
        return
      }
      listingsLog.info(`200 ok · ${msSince(t0)}ms · id=${id}`)
      res.json(toListingResource(listing))
    }),
  )

  app.post(
    '/api/listings/ai-search',
    asyncHandler(async (req, res) => {
      const t0 = performance.now()
      const parsed = AiListingSearchBodySchema.safeParse(req.body)
      if (!parsed.success) {
        aiSearchLog.info(`400 invalid_body · ${msSince(t0)}ms`)
        res.status(400).json({
          message: 'Invalid request body',
          issues: z.flattenError(parsed.error),
        })
        return
      }
      const active: AiListingSearchActiveFilters =
        parsed.data.activeFilters ?? {}
      const msgCount = parsed.data.messages.length
      try {
        const result = await runAiListingSearch(
          listingSource,
          parsed.data.messages,
          active,
        )
        const { mergedQuery, listingsPage } = result
        const parts = [
          `200 ok`,
          `${msSince(t0)}ms`,
          `mode=${aiSearchRuntimeMode()}`,
          `msgs=${msgCount}`,
        ]
        const activeSummary = summarizeActiveFiltersForLog(active)
        if (activeSummary !== null) parts.push(`active={${activeSummary}}`)
        parts.push(
          `merged={${summarizeListListingsQueryForLog(mergedQuery)}}`,
          `reply_chars=${result.reply.length}`,
          `hits=${listingsPage.total} page=${listingsPage.page}/${listingsPage.pageSize}`,
        )
        aiSearchLog.info(parts.join(' · '))
        res.json(toAiListingSearchHttpResponse(result))
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const status = msg.startsWith('listing_ai_search_invalid_json') ?
          502
        : 503
        aiSearchLog.error(
          `${status} · ${msSince(t0)}ms · ${truncateOneLine(msg, 220)}`,
        )
        if (msg.startsWith('listing_ai_search_invalid_json')) {
          res.status(502).json({ message: 'AI search returned invalid output' })
          return
        }
        res.status(503).json({ message: msg || 'AI search failed' })
      }
    }),
  )
}

function firstPathParam(raw: string | string[] | undefined): string | undefined {
    if (typeof raw === 'string' && raw !== '') return raw
    if (Array.isArray(raw)) {
        const x = raw[0]
        if (x !== undefined && x !== '') return x
    }
    return undefined
}

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
    return (req, res, next) => {
        void fn(req, res, next).catch(next)
    }
}

function msSince(t0: number): string {
  return `${Math.round(performance.now() - t0)}`
}

function aiSearchRuntimeMode(): 'mock' | 'gemini' {
  if (process.env.AI_SEARCH_MOCK?.trim() === '1') return 'mock'
  if (!process.env.GEMINI_API_KEY?.trim()) return 'mock'
  return 'gemini'
}

/**
 * Which filter dimensions the client sent (lengths only for text — avoid PII).
 * Returns `null` when nothing to log (omit `active=` segment).
 */
function summarizeActiveFiltersForLog(
  a: AiListingSearchActiveFilters,
): string | null {
  const bits: string[] = []
  if (a.q !== undefined && String(a.q).trim() !== '')
    bits.push(`q_chars=${String(a.q).length}`)
  if (a.city !== undefined && String(a.city).trim() !== '')
    bits.push(`city_chars=${String(a.city).length}`)
  if (a.priceMin !== undefined) bits.push(`priceMin=${a.priceMin}`)
  if (a.priceMax !== undefined) bits.push(`priceMax=${a.priceMax}`)
  if (a.roomsMin !== undefined) bits.push(`roomsMin=${a.roomsMin}`)
  if (a.tags !== undefined && a.tags.length > 0)
    bits.push(`tags=${a.tags.length}`)
  return bits.length > 0 ? bits.join(' ') : null
}

/** Parsed list query / merged AI query — same shape for GET and ai-search logs. */
function summarizeListListingsQueryForLog(m: ListListingsQuery): string {
  const bits: string[] = [`page=${m.page}`, `limit=${m.limit}`]
  if (m.city !== undefined && m.city !== '')
    bits.push(`city_chars=${m.city.length}`)
  if (m.q !== undefined && m.q !== '') bits.push(`q_chars=${m.q.length}`)
  if (m.priceMin !== undefined) bits.push(`priceMin=${m.priceMin}`)
  if (m.priceMax !== undefined) bits.push(`priceMax=${m.priceMax}`)
  if (m.roomsMin !== undefined) bits.push(`roomsMin=${m.roomsMin}`)
  if (m.tags !== undefined && m.tags.length > 0)
    bits.push(`tags=${m.tags.length}`)
  return bits.join(' ')
}

function truncateOneLine(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  return `${one.slice(0, max - 1)}…`
}

