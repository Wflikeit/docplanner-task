import type { Prisma } from '@prisma/client'
import { PrismaClient } from '@prisma/client'

import type { ListListingsQuery, ListingsPageResult } from '../../application/listingPageTypes.js'
import type { ListingSourcePort } from '../../application/listingSourcePort.js'
import { prismaDbListingToDomain } from './domainListingFromPrisma.js'

const prisma = new PrismaClient()

function parseListingDbId(raw: string): bigint | null {
  const t = raw.trim()
  if (t === '' || !/^\d+$/.test(t)) return null
  try {
    return BigInt(t)
  } catch {
    return null
  }
}

function buildWhere(query: ListListingsQuery): Prisma.ListingWhereInput {
  const and: Prisma.ListingWhereInput[] = []

  const cityRaw = query.city?.trim()
  if (cityRaw) {
    and.push({ city: { contains: cityRaw } })
  }

  if (query.priceMin !== undefined) {
    and.push({ priceAmount: { gte: query.priceMin } })
  }

  if (query.priceMax !== undefined) {
    and.push({ priceAmount: { lte: query.priceMax } })
  }

  if (query.roomsMin !== undefined) {
    and.push({ rooms: { gte: query.roomsMin } })
  }

  const q = query.q?.trim()
  if (q) {
    and.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { city: { contains: q } },
        { district: { contains: q } },
        { street: { contains: q } },
      ],
    })
  }

  if (and.length === 0) return {}
  return { AND: and }
}

/** Reads listings with SQL-level filter + pagination (MySQL). */
export function createPrismaListingSource(): ListingSourcePort {
  return {
    async listPage(query: ListListingsQuery): Promise<ListingsPageResult> {
      const where = buildWhere(query)
      const skip = (query.page - 1) * query.limit
      const take = query.limit

      const [total, rows] = await Promise.all([
        prisma.listing.count({ where }),
        prisma.listing.findMany({
          where,
          orderBy: { id: 'asc' },
          skip,
          take,
        }),
      ])

      return {
        items: rows.map(prismaDbListingToDomain),
        total,
        page: query.page,
        pageSize: query.limit,
      }
    },

    async getById(idParam: string) {
      const id = parseListingDbId(idParam)
      if (id === null) return undefined
      const row = await prisma.listing.findUnique({ where: { id } })
      return row ? prismaDbListingToDomain(row) : undefined
    },
  }
}
