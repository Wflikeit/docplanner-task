import { z } from 'zod'

const DEFAULT_LIMIT = 12

const scalarStr = z.unknown().transform((v): string | undefined => {
  const s = Array.isArray(v) ? (v as unknown[])[0] : v
  return typeof s === 'string' && s.trim() !== '' ? s.trim() : undefined
})

const scalarNum = z.unknown().transform((v): number | undefined => {
  const s = Array.isArray(v) ? (v as unknown[])[0] : v
  if (typeof s !== 'string' || !s.trim()) return undefined
  const n = Number(s.trim())
  return Number.isFinite(n) ? n : undefined
})

/** Zod 4: optional must wrap the whole field — `.pipe(z.string().optional())` still rejects a missing key. */
export const ListListingsQuerySchema = z
  .object({
    q: z.optional(scalarStr),
    city: z.optional(scalarStr),
    priceMin: z.optional(scalarNum.pipe(z.number().min(0))),
    priceMax: z.optional(scalarNum.pipe(z.number().min(0))),
    rooms: z.optional(scalarNum.pipe(z.number().min(1))),
    roomsMin: z.optional(scalarNum.pipe(z.number().min(1))),
    /** Comma-separated tag ids (e.g. `near_transport,family_friendly`). */
    tags: z.optional(scalarStr),
    page: z.optional(scalarNum.pipe(z.number().int().min(1))),
    limit: z.optional(scalarNum.pipe(z.number().int().min(1).max(100))),
  })
  .transform(({ rooms, roomsMin, page, limit, tags, ...rest }) => {
    const tagList =
      tags === undefined ?
        undefined
      : tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t !== '')
    return {
      ...rest,
      roomsMin: roomsMin ?? rooms,
      page: page ?? 1,
      limit: limit ?? DEFAULT_LIMIT,
      tags: tagList !== undefined && tagList.length > 0 ? tagList : undefined,
    }
  })
