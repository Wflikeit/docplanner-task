import { createInMemoryListingSource } from './infrastructure/inMemoryListingSource.js'
import { startHttpServer } from './presentation/http/server.js'

const listingSource = createInMemoryListingSource()
startHttpServer(listingSource)
