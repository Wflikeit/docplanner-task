import type { ListingSourcePort } from '../application/listingSourcePort.js'
import { MOCK_LISTINGS } from './mockListingsData.js'

export function createInMemoryListingSource(): ListingSourcePort {
  return {
    getAll: () => MOCK_LISTINGS,
    getById: (id) => MOCK_LISTINGS.find((l) => l.id === id),
  }
}
