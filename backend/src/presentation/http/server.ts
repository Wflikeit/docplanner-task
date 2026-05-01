import express, { type Request } from 'express'
import type { ListingSourcePort } from '../../application/listingSourcePort.js'
import {
  getListingById,
  listListingsPage,
} from '../../application/listingUseCases.js'
import { executeAiListingSearchMock } from '../../application/aiListingSearchUseCase.js'
import type { AiListingSearchRequest } from './types.js'
import {
  toAiListingSearchResponse,
  toListingResource,
  toPaginatedListings,
} from '../mappers/listingMappers.js'

const DEFAULT_LIMIT = 12

function firstQueryString(req: Request, key: string): string | undefined {
  const v = req.query[key]
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  if (Array.isArray(v)) {
    const x = v[0]
    if (typeof x === 'string') return x
    if (typeof x === 'number' && Number.isFinite(x)) return String(x)
  }
  return undefined
}

function parseListListingsQuery(req: Request): Parameters<
  typeof listListingsPage
>[1] {
  const q = firstQueryString(req, 'q')
  const city = firstQueryString(req, 'city')
  const priceMinRaw = firstQueryString(req, 'priceMin')
  const priceMaxRaw = firstQueryString(req, 'priceMax')
  const roomsRaw = firstQueryString(req, 'rooms')
  const pageRaw = firstQueryString(req, 'page')
  const limitRaw = firstQueryString(req, 'limit')

  const priceMin =
    priceMinRaw !== undefined && priceMinRaw !== ''
      ? Number(priceMinRaw)
      : undefined
  const priceMax =
    priceMaxRaw !== undefined && priceMaxRaw !== ''
      ? Number(priceMaxRaw)
      : undefined
  const rooms =
    roomsRaw !== undefined && roomsRaw !== '' ? Number(roomsRaw) : undefined
  const pageParsed = pageRaw ? Number(pageRaw) : 1
  const limitParsed = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT

  const page =
    Number.isFinite(pageParsed) && pageParsed >= 1 ? Math.floor(pageParsed) : 1
  const limit =
    Number.isFinite(limitParsed) && limitParsed >= 1
      ? Math.min(Math.floor(limitParsed), 100)
      : DEFAULT_LIMIT

  return {
    q,
    city,
    priceMin: Number.isFinite(priceMin ?? NaN) ? priceMin : undefined,
    priceMax: Number.isFinite(priceMax ?? NaN) ? priceMax : undefined,
    rooms: Number.isFinite(rooms ?? NaN) ? rooms : undefined,
    page,
    limit,
  }
}

export function createHttpApp(listingSource: ListingSourcePort): express.Express {
  const app = express()
  /** Avoid conditional GET / stale JSON in dev browsers (Safari especially). */
  app.set('etag', false)
  app.use(express.json())
  app.use((req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store, max-age=0')
    }
    next()
  })

  app.get('/api/listings', (req, res) => {
    const query = parseListListingsQuery(req)
    const page = listListingsPage(listingSource, query)
    res.json(toPaginatedListings(page))
  })

  app.get('/api/listings/:id', (req, res) => {
    const listing = getListingById(listingSource, req.params.id)
    if (!listing) {
      res.status(404).json({ message: 'Not found' })
      return
    }
    res.json(toListingResource(listing))
  })

  app.post('/api/listings/ai-search', (req, res) => {
    const body = req.body as AiListingSearchRequest | undefined
    const messages = body?.messages ?? []
    const result = executeAiListingSearchMock(messages)
    res.json(toAiListingSearchResponse(result))
  })

  return app
}

export function startHttpServer(
  listingSource: ListingSourcePort,
  port = Number(process.env.PORT) || 3000,
): void {
  const app = createHttpApp(listingSource)
  app.listen(port, () => {
    console.log(`mock API http://127.0.0.1:${port}`)
  })
}
