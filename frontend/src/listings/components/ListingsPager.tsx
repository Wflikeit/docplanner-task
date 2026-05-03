type ListingsPagerProps = {
  currentPage: number
  totalPages: number
  busy: boolean
  onPrev: () => void
  onNext: () => void
}

export function ListingsPager({
  currentPage,
  totalPages,
  busy,
  onPrev,
  onNext,
}: ListingsPagerProps) {
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <nav
      aria-label="Listing pagination"
      aria-busy={busy}
      className="flex flex-col items-stretch gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-left text-sm text-gray-600 dark:text-gray-300">
        Page <span className="font-medium text-gray-900 dark:text-gray-50">{currentPage}</span>
        {' of '}
        <span className="font-medium text-gray-900 dark:text-gray-50">{totalPages}</span>
        {busy ? <span className="sr-only"> — loading</span> : null}
      </p>
      <div className="flex flex-wrap justify-end gap-2 sm:justify-start">
        {canPrev ? (
          <button
            type="button"
            onClick={onPrev}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            Previous
          </button>
        ) : null}
        {canNext ? (
          <button
            type="button"
            onClick={onNext}
            disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Next
          </button>
        ) : null}
      </div>
    </nav>
  )
}
