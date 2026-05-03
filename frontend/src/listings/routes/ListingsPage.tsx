import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { postAiListingSearch } from '../../api/aiSearchApi'
import { formatApiError } from '../../query/formatApiError'
import { queryKeys } from '../../query/queryKeys'
import { isAiConversationalSearchEnabled } from '../../runtime/runtimeConfig'
import { fetchListingsForRoute } from '../api/fetchListings'
import { FiltersPanel } from '../components/FiltersPanel'
import { ListingCard } from '../components/ListingCard'
import { ListingsPager } from '../components/ListingsPager'
import {
  draftToActiveFiltersForAiSearch,
  LISTINGS_PAGE_SIZE,
  parseListingRouteFilters,
  type ListingRouteFilters,
} from './listingRouteParams'
import {
  listingRouteFiltersFromMergedQuery,
  mergedListingQueryToUrlSearchParams,
} from '../utils/mergedListingQuery'
import { ResultsSummary } from '../components/ResultsSummary'
import { ResultsEmpty, ResultsError, ResultsLoading } from '../components/ResultsStates'
import { SearchInput } from '../components/SearchInput'
import { toListingCard } from '../utils/listingUi'

type FilterFields = Pick<
  ListingRouteFilters,
  'city' | 'priceMin' | 'priceMax' | 'roomsMin' | 'tags'
>

type ListingSearchDraft = FilterFields & { q: string }

function writeListingSearchDraftToParams(
  p: URLSearchParams,
  draft: ListingSearchDraft,
): void {
  const q = draft.q.trim()
  if (q) p.set('q', q)
  else p.delete('q')

  const apply = (
    key: 'city' | 'priceMin' | 'priceMax' | 'roomsMin' | 'tags',
    raw: string,
  ) => {
    const nextVal = raw.trim()
    if (nextVal) p.set(key, nextVal)
    else p.delete(key)
  }

  apply('city', draft.city)
  apply('priceMin', draft.priceMin)
  apply('priceMax', draft.priceMax)
  apply('roomsMin', draft.roomsMin)
  apply('tags', draft.tags)
}

function listingDraftMatchesRoute(
  draft: ListingSearchDraft,
  route: ListingRouteFilters,
): boolean {
  return (
    draft.q.trim() === route.q.trim() &&
    draft.city.trim() === route.city.trim() &&
    draft.priceMin.trim() === route.priceMin.trim() &&
    draft.priceMax.trim() === route.priceMax.trim() &&
    draft.roomsMin.trim() === route.roomsMin.trim() &&
    draft.tags.trim() === route.tags.trim()
  )
}

export function ListingsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  /** Router often hands a new `URLSearchParams` identity each render — derive route from a stable string. */
  const searchSnapshot = searchParams.toString()
  const route = useMemo(
    () => parseListingRouteFilters(new URLSearchParams(searchSnapshot)),
    [searchSnapshot],
  )

  const [qDraft, setQDraft] = useState(route.q)

  const [filtersDraft, setFiltersDraft] = useState<FilterFields>(() => ({
    city: route.city,
    priceMin: route.priceMin,
    priceMax: route.priceMax,
    roomsMin: route.roomsMin,
    tags: route.tags,
  }))

  const [searchBusy, setSearchBusy] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [aiReply, setAiReply] = useState<string | null>(null)
  const aiAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => aiAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    setQDraft(route.q)
  }, [route.q])

  useEffect(() => {
    setFiltersDraft({
      city: route.city,
      priceMin: route.priceMin,
      priceMax: route.priceMax,
      roomsMin: route.roomsMin,
      tags: route.tags,
    })
  }, [route.city, route.priceMin, route.priceMax, route.roomsMin, route.tags])

  const listingsQuery = useQuery({
    queryKey: queryKeys.listings(route),
    queryFn: ({ queryKey, signal }) => {
      const [, q, city, priceMin, priceMax, roomsMin, tags, page] = queryKey
      return fetchListingsForRoute(
        {
          q,
          city,
          priceMin,
          priceMax,
          roomsMin,
          tags,
          page,
        },
        signal,
      )
    },
  })

  const items = listingsQuery.data?.items ?? []
  const total = listingsQuery.data?.total ?? 0
  const pageSize = listingsQuery.data?.pageSize ?? LISTINGS_PAGE_SIZE

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
  const showResults = listingsQuery.isSuccess || listingsQuery.isFetching

  useEffect(() => {
    if (!listingsQuery.isSuccess) return
    const max = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
    if (route.page <= max) return
    const next = new URLSearchParams(searchSnapshot)
    next.set('page', String(max))
    setSearchParams(next, { replace: true })
  }, [
    listingsQuery.isSuccess,
    route.page,
    total,
    pageSize,
    searchSnapshot,
    setSearchParams,
  ])

  const listingsSearch = searchSnapshot

  function mergeFiltersDraft(patch: Partial<FilterFields>) {
    setFiltersDraft((prev) => ({ ...prev, ...patch }))
  }

  const searchDraft: ListingSearchDraft = {
    q: qDraft,
    city: filtersDraft.city,
    priceMin: filtersDraft.priceMin,
    priceMax: filtersDraft.priceMax,
    roomsMin: filtersDraft.roomsMin,
    tags: filtersDraft.tags,
  }

  function applySearchAndFiltersToUrl() {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      writeListingSearchDraftToParams(p, searchDraft)
      p.set('page', '1')
      return p
    }, { replace: true })
  }

  async function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    if (searchBusy) return
    setSearchError(null)

    const aiSearch = isAiConversationalSearchEnabled()
    const q = qDraft.trim()

    if (aiSearch && q) {
      aiAbortRef.current?.abort()
      const ac = new AbortController()
      aiAbortRef.current = ac
      setSearchBusy(true)
      try {
        const activeFilters = draftToActiveFiltersForAiSearch(searchDraft)
        const res = await postAiListingSearch(
          {
            messages: [{ role: 'user', content: q }],
            activeFilters,
          },
          ac.signal,
        )
        if (ac.signal.aborted) return
        setAiReply(res.reply)
        const nextRoute = listingRouteFiltersFromMergedQuery(res.mergedQuery)
        const nextParams = mergedListingQueryToUrlSearchParams(res.mergedQuery)
        queryClient.setQueryData(queryKeys.listings(nextRoute), {
          items: res.listings.items.map(toListingCard),
          total: res.listings.total,
          pageSize: res.listings.pageSize,
        })
        setSearchParams(nextParams, { replace: true })
      } catch (err) {
        if (ac.signal.aborted) return
        setSearchError(formatApiError(err))
      } finally {
        if (!ac.signal.aborted) setSearchBusy(false)
      }
    } else {
      setAiReply(null)
      applySearchAndFiltersToUrl()
    }
  }

  function clearFilters() {
    setAiReply(null)
    const next = new URLSearchParams(searchParams)
    next.delete('city')
    next.delete('priceMin')
    next.delete('priceMax')
    next.delete('roomsMin')
    next.delete('rooms')
    next.delete('q')
    next.delete('tags')
    next.set('page', '1')
    setSearchParams(next, { replace: true })
  }

  function goPrevPage() {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      writeListingSearchDraftToParams(p, searchDraft)
      const sameQuery = listingDraftMatchesRoute(searchDraft, route)
      const page = sameQuery ? Math.max(1, route.page - 1) : 1
      p.set('page', String(page))
      return p
    }, { replace: true })
  }

  function goNextPage() {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      writeListingSearchDraftToParams(p, searchDraft)
      const sameQuery = listingDraftMatchesRoute(searchDraft, route)
      if (!sameQuery) {
        p.set('page', '1')
        return p
      }
      const max = Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
      p.set('page', String(Math.min(route.page + 1, max)))
      return p
    }, { replace: true })
  }

  const aiSearch = isAiConversationalSearchEnabled()

  const blockingLoad = listingsQuery.isPending && items.length === 0

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 text-left">
      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Listings
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {aiSearch ?
            'Enter runs AI on your text (tags and optional filter hints). For reliable city, price, rooms, and tag filters, use the panel below — then Apply or Enter.'
          : 'Search property listings and open one for full details.'}
        </p>
      </header>

      <form className="contents" onSubmit={handleSearchSubmit}>
        <SearchInput
          id="listing-search"
          label={aiSearch ? 'Describe what you want (AI)' : 'Search'}
          value={qDraft}
          onChange={setQDraft}
          disabled={searchBusy}
          placeholder={
            aiSearch ?
              'e.g. quiet area, near transport, city centre — set city, price, and rooms in the filters below'
            : 'Search titles and descriptions…'
          }
        />

        {aiSearch && aiReply ? (
          <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            {aiReply}
          </p>
        ) : null}

        {searchError ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100"
          >
            {searchError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => setSearchError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <FiltersPanel
          filters={filtersDraft}
          onChange={mergeFiltersDraft}
          applyBusy={searchBusy}
          onClear={() => {
            setAiReply(null)
            const next = new URLSearchParams(searchParams)
            next.delete('city')
            next.delete('priceMin')
            next.delete('priceMax')
            next.delete('roomsMin')
            next.delete('rooms')
            next.delete('q')
            next.delete('tags')
            next.set('page', '1')
            setSearchParams(next, { replace: true })
          }}
        />
      </form>

      {blockingLoad ? <ResultsLoading /> : null}
      {listingsQuery.isError ? (
        <ResultsError
          message={formatApiError(listingsQuery.error)}
          onRetry={() => void listingsQuery.refetch()}
        />
      ) : null}

      {showResults ? (
        <>
          <ResultsSummary
            total={total}
            page={route.page}
            pageSize={pageSize}
            filters={route}
          />
          {items.length === 0 ? (
            <ResultsEmpty onResetFilters={clearFilters} />
          ) : (
            <>
              <ul className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 sm:gap-6 xl:grid-cols-3 xl:gap-6">
                {items.map((listing) => (
                  <li key={listing.id} className="flex h-full min-h-0">
                    <ListingCard
                      listing={listing}
                      listingsSearch={listingsSearch}
                    />
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? (
                <ListingsPager
                  currentPage={Math.min(route.page, totalPages)}
                  totalPages={totalPages}
                  busy={listingsQuery.isFetching}
                  onPrev={goPrevPage}
                  onNext={goNextPage}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
