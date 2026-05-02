import express from 'express'

import type { ListingSourcePort } from '../../application/listingSourcePort.js'
import { registerListingHttpRoutes } from './listingHttpRoutes.js'

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

  registerListingHttpRoutes(app, listingSource)

  return app
}

export function startHttpServer(
  listingSource: ListingSourcePort,
  port = Number(process.env.PORT) || 3000,
): void {
  const host = process.env.LISTEN_HOST?.trim() || '0.0.0.0'
  const app = createHttpApp(listingSource)
  app.listen(port, host, () => {
    console.log(`API listening (host=${host} port=${port})`)
  })
}
