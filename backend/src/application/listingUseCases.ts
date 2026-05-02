import type { Listing } from '../domain/listing.js'
import type { ListListingsQuery, ListingsPageResult } from './listingPageTypes.js'
import type { ListingSourcePort } from './listingSourcePort.js'

export type { ListListingsQuery, ListingsPageResult } from './listingPageTypes.js'

export async function listListingsPage(
  source: ListingSourcePort,
  query: ListListingsQuery,
): Promise<ListingsPageResult> {
  return source.listPage(query)
}

export async function getListingById(
  source: ListingSourcePort,
  id: string,
): Promise<Listing | undefined> {
  return source.getById(id)
}
