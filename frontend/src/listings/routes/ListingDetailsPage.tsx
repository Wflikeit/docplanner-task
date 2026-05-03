import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchListingById } from '../../api/listingsApi'
import { formatApiError } from '../../query/formatApiError'
import { queryKeys } from '../../query/queryKeys'
import { toListingDetail } from '../utils/listingUi'
import { AiSummaryCollapsible, SearchTagsStrip } from '../components/ListingDetailAiBlocks'
import { ListingImagePlaceholder } from '../components/ListingCard'
import { ResultsLoading } from '../components/ResultsStates'

export function ListingDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const listingsSearch =
    (location.state as { listingsSearch?: string } | null)?.listingsSearch ?? ''

  const listingQuery = useQuery({
    queryKey: queryKeys.listing(id ?? ''),
    queryFn: ({ signal }) => fetchListingById(id!, signal),
    enabled: Boolean(id),
    select: (listing) => toListingDetail(listing),
  })

  const backTo = listingsSearch ? `/?${listingsSearch}` : '/'

  if (!id) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6">
          <Link
            to={backTo}
            className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Back to listings
          </Link>
        </nav>
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40"
        >
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Missing listing id
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            The URL does not include a listing identifier.
          </p>
        </div>
      </div>
    )
  }

  if (listingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6">
          <Link
            to={backTo}
            className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Back to listings
          </Link>
        </nav>
        <ResultsLoading />
      </div>
    )
  }

  if (listingQuery.isError || !listingQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-6">
          <Link
            to={backTo}
            className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            ← Back to listings
          </Link>
        </nav>
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40"
        >
          <p className="font-medium text-red-900 dark:text-red-100">
            Could not load listing
          </p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-200">
            {listingQuery.isError ? formatApiError(listingQuery.error) : 'Unknown error'}
          </p>
          <button
            type="button"
            onClick={() => void listingQuery.refetch()}
            className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-900/80"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const listing = listingQuery.data

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 text-left">
      <nav className="mb-6">
        <Link
          to={backTo}
          className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
        >
          ← Back to listings
        </Link>
      </nav>

      <figure className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="relative aspect-[16/10] w-full">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <ListingImagePlaceholder />
          )}
        </div>
      </figure>

      <header className="mt-6 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {listing.title}
        </h1>
        <p className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-50">
          {listing.priceLabel}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {listing.locationLabel}
        </p>
      </header>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {listing.rows.map((row) => (
          <div key={row.label} className="flex flex-col rounded-md border border-gray-100 p-3 dark:border-gray-800">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {row.label}
            </dt>
            <dd className="text-sm text-gray-900 dark:text-gray-100">{row.value}</dd>
          </div>
        ))}
      </dl>

      {listing.priceUnknown ? (
        <aside
          role="note"
          aria-label="How to see the price"
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/50"
        >
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            Looking for the price?
          </p>
          <p className="mt-2 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            {listing.sourceUrl ? (
              <>
                It isn't shown above. On the portal you can see the full price and contact the
                seller —{' '}
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-amber-950 underline underline-offset-2 hover:no-underline dark:text-amber-50"
                >
                  open the listing on the portal
                </a>
                {' '}
                (new tab).
              </>
            ) : (
              <>
                It isn't shown above, and there is no link to the listing on the portal from this
                page, so you can't open it from here to check or ask.
              </>
            )}
          </p>
        </aside>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-50">
          Description
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {listing.description}
        </p>
      </section>

      {listing.aiSummary ? <AiSummaryCollapsible text={listing.aiSummary} /> : null}

      {listing.sourceUrl ? (
        <p className="mt-8 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-medium text-gray-800 dark:text-gray-200">Source: </span>
          <a
            href={listing.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="break-all text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            {listing.sourceUrl}
          </a>
        </p>
      ) : (
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">Source: Not provided</p>
      )}

      <SearchTagsStrip tags={listing.aiTags} />
    </article>
  )
}
