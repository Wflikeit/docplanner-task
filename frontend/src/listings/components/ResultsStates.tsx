export function ResultsLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-gray-700 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200"
    >
      Loading listings…
    </div>
  )
}

type ResultsEmptyProps = {
  onResetFilters: () => void
}

export function ResultsEmpty({ onResetFilters }: ResultsEmptyProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="text-lg font-medium text-gray-900 dark:text-gray-50">No listings match</p>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Try clearing filters or broadening your search.
      </p>
      <button
        type="button"
        onClick={onResetFilters}
        className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        Clear filters
      </button>
    </div>
  )
}

type ResultsErrorProps = {
  message: string
  onRetry: () => void
}

export function ResultsError({ message, onRetry }: ResultsErrorProps) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-6 text-left dark:border-red-900 dark:bg-red-950/40"
    >
      <p className="font-medium text-red-900 dark:text-red-100">Something went wrong</p>
      <p className="mt-1 text-sm text-red-800 dark:text-red-200">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 dark:border-red-800 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-900/80"
      >
        Retry
      </button>
    </div>
  )
}
