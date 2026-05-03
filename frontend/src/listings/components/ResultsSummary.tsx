import type { ListingRouteFilters } from '../routes/listingRouteParams'

type ResultsSummaryProps = {
  total: number
  page: number
  pageSize: number
  filters: ListingRouteFilters
}

function describeFilters(f: ListingRouteFilters): string[] {
  const parts: string[] = []
  const q = f.q.trim()
  if (q) parts.push(`search “${q}”`)
  if (f.city.trim()) parts.push(`city ${f.city.trim()}`)
  if (f.priceMin.trim()) parts.push(`min ${f.priceMin.trim()}`)
  if (f.priceMax.trim()) parts.push(`max ${f.priceMax.trim()}`)
  if (f.roomsMin.trim()) parts.push(`≥ ${f.roomsMin.trim()} rooms (min)`)
  const tags = f.tags.trim()
  if (tags) parts.push(`tags ${tags}`)
  return parts
}

export function ResultsSummary({
  total,
  page,
  pageSize,
  filters,
}: ResultsSummaryProps) {
  const parts = describeFilters(filters)
  const filterPhrase = parts.length ? ` · Filtered by ${parts.join(', ')}` : ''

  if (total === 0) {
    return (
      <p className="text-left text-sm text-gray-700 dark:text-gray-200">
        <span className="font-medium text-gray-900 dark:text-gray-50">
          Showing 0 of 0 listings
        </span>
        {filterPhrase}
      </p>
    )
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  const rangeLabel = start === end ? `${start}` : `${start}–${end}`

  return (
    <p className="text-left text-sm text-gray-700 dark:text-gray-200">
      <span className="font-medium text-gray-900 dark:text-gray-50">
        Showing {rangeLabel} of {total} listings
      </span>
      {filterPhrase}
    </p>
  )
}
