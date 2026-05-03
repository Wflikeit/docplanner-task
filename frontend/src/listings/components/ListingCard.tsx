import { Link } from 'react-router-dom'
import type { ListingCardModel } from '../utils/listingUi'

type ListingCardProps = {
  listing: ListingCardModel
  listingsSearch: string
}

export function ListingImagePlaceholder() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-50 to-gray-200/90 dark:from-gray-800 dark:to-gray-900"
      aria-hidden
    >
      <svg
        className="h-10 w-10 text-gray-300 dark:text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008H12V8.25Z"
        />
      </svg>
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        No image
      </span>
    </div>
  )
}

export function ListingCard({ listing, listingsSearch }: ListingCardProps) {
  return (
    <article className="group flex h-full min-h-0 w-full flex-col self-stretch overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10 dark:hover:shadow-lg dark:hover:shadow-black/50">
      <Link
        to={`/listings/${listing.id}`}
        state={{ listingsSearch }}
        className="flex h-full min-h-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-gray-950"
      >
        {/* Slightly wider than tall — less empty “poster” when there's no photo */}
        <div className="relative aspect-[5/3] w-full shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800">
          {listing.thumbUrl ? (
            <img
              src={listing.thumbUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <ListingImagePlaceholder />
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 pb-5 pt-4">
          {/* Fixed two-line title height so prices line up across cards */}
          <h2 className="line-clamp-2 h-[2.75rem] shrink-0 overflow-hidden text-base font-semibold leading-snug text-gray-900 dark:text-gray-50">
            {listing.title}
          </h2>
          <p className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">
            {listing.priceLabel}
          </p>
          {listing.priceUnknown ? (
            <p className="shrink-0 text-xs leading-snug text-amber-800 dark:text-amber-200">
              Open this listing — use the link to the offer on the portal to see or ask about the
              price.
            </p>
          ) : null}
          <p className="line-clamp-1 min-h-[1.375rem] shrink-0 text-sm leading-snug text-gray-500 dark:text-gray-400">
            {listing.locationLabel}
          </p>
          <p className="min-h-[1.375rem] shrink-0 text-sm leading-snug text-gray-500 dark:text-gray-400">
            <span>{listing.areaLabel}</span>
            <span className="mx-1.5 text-gray-300 dark:text-gray-600" aria-hidden>
              ·
            </span>
            <span>{listing.roomsLabel}</span>
          </p>

          {/* Absorb row height differences so the rule + badge strip sit on one baseline */}
          <div className="min-h-2 flex-1" aria-hidden />

          <div className="shrink-0 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex h-9 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {listing.badges.length > 0 ? (
                <ul className="flex shrink-0 flex-nowrap gap-2" aria-label="Listing badges">
                  {listing.badges.map((b) => (
                    <li key={b.key} className="shrink-0">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-600/10 dark:bg-blue-950/80 dark:text-blue-200 dark:ring-blue-400/20">
                        {b.label}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="sr-only">No badges</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}
