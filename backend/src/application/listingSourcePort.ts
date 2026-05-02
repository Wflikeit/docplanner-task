import type { Listing } from '../domain/listing.js'

import type { ListListingsQuery, ListingsPageResult } from './listingPageTypes.js'

/** Read-side access to listings (MySQL via Prisma in production). */
export type ListingSourcePort = {
  listPage(query: ListListingsQuery): Promise<ListingsPageResult>
  /** `id` is the persisted listing primary key as a decimal string. */
  getById(id: string): Promise<Listing | undefined>
}
