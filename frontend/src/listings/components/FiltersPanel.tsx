import type { ListingRouteFilters } from '../routes/listingRouteParams'
import { AiSearchTagsFilter } from './AiSearchTagsFilter'

type FiltersPanelProps = {
  filters: Pick<
    ListingRouteFilters,
    'city' | 'priceMin' | 'priceMax' | 'roomsMin' | 'tags'
  >
  onChange: (patch: Partial<ListingRouteFilters>) => void
  onClear: () => void
  /** Disables filter inputs and the Apply submit button (e.g. while AI search runs). */
  applyBusy?: boolean
}

export function FiltersPanel({
  filters,
  onChange,
  onClear,
  applyBusy = false,
}: FiltersPanelProps) {
  return (
    <section
      aria-label="Listing filters"
      className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left dark:border-gray-700 dark:bg-gray-900/40"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-city" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          City
        </label>
        <input
          id="filter-city"
          type="text"
          autoComplete="address-level2"
          disabled={applyBusy}
          value={filters.city}
          onChange={(e) => onChange({ city: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-price-min" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Min price
        </label>
        <input
          id="filter-price-min"
          inputMode="numeric"
          type="text"
          disabled={applyBusy}
          value={filters.priceMin}
          onChange={(e) => onChange({ priceMin: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-price-max" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Max price
        </label>
        <input
          id="filter-price-max"
          inputMode="numeric"
          type="text"
          disabled={applyBusy}
          value={filters.priceMax}
          onChange={(e) => onChange({ priceMax: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-rooms" className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Min rooms
        </label>
        <input
          id="filter-rooms"
          inputMode="numeric"
          type="text"
          disabled={applyBusy}
          value={filters.roomsMin}
          onChange={(e) => onChange({ roomsMin: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>
      </div>

      <AiSearchTagsFilter
        tagsCsv={filters.tags}
        disabled={applyBusy}
        onChange={(tags) => onChange({ tags })}
      />

      <div className="flex flex-wrap items-end gap-2">
        <button
          type="submit"
          disabled={applyBusy}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {applyBusy ? 'Applying…' : 'Apply filters'}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          Clear filters
        </button>
      </div>
    </section>
  )
}
