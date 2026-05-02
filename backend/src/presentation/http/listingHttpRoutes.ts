import type {Express, NextFunction, Request, RequestHandler, Response} from 'express'

import type { ListingSourcePort } from '../../application/listingSourcePort.js'
import { executeAiListingSearchMock } from '../../application/aiListingSearchUseCase.js'
import { getListingById, listListingsPage } from '../../application/listingUseCases.js'
import {
  toAiListingSearchResponse,
  toListingResource,
  toPaginatedListings,
} from '../mappers/listingMappers.js'
import { z } from 'zod'
import { ListListingsQuerySchema } from './listListingsQueryFromParsedQs.js'
import type { AiListingSearchRequest } from './types.js'

export function registerListingHttpRoutes(
  app: Express,
  listingSource: ListingSourcePort,
): void {
  app.get(
    '/api/listings',
    asyncHandler(async (req, res) => {
      const parsed = ListListingsQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        res.status(400).json({ message: 'Invalid query parameters', issues: z.flattenError(parsed.error) })
        return
      }
      const page = await listListingsPage(listingSource, parsed.data)
      res.json(toPaginatedListings(page))
    }),
  )

  app.get(
    '/api/listings/:id',
    asyncHandler(async (req, res) => {
      const id = firstPathParam(req.params.id)
      if (id === undefined) {
        res.status(400).json({ message: 'Missing id' })
        return
      }
      const listing = await getListingById(listingSource, id)
      if (!listing) {
        res.status(404).json({ message: 'Not found' })
        return
      }
      res.json(toListingResource(listing))
    }),
  )

  app.post('/api/listings/ai-search', (req, res) => {
    const body = req.body as AiListingSearchRequest | undefined
    const messages = body?.messages ?? []
    const result = executeAiListingSearchMock(messages)
    res.json(toAiListingSearchResponse(result))
  })
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

