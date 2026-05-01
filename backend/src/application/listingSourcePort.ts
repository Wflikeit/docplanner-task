import type { Listing } from '../domain/listing.js'

/** Read-side access to listings — implemented by DB/cache/in-memory adapters. */
export type ListingSourcePort = {
  getAll(): readonly Listing[]
  getById(id: string): Listing | undefined
}
