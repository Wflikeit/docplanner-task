import { OTODOM_LISTING_TAG_IDS } from '../constants/otodomListingTagIds'
import { humanizeAiTag, tagChipClass } from './listingTagChips'

type AiSearchTagsFilterProps = {
  /** Comma-separated tag ids (same as URL `tags`). */
  tagsCsv: string
  onChange: (tagsCsv: string) => void
  disabled?: boolean
}

function parseTagsCsv(raw: string): Set<string> {
  const ids = raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
  return new Set(ids)
}

function formatTagsCsv(selected: Set<string>): string {
  return [...selected].sort().join(',')
}

export function AiSearchTagsFilter({
  tagsCsv,
  onChange,
  disabled = false,
}: AiSearchTagsFilterProps) {
  const selected = parseTagsCsv(tagsCsv)

  function toggle(id: string): void {
    if (disabled) return
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(formatTagsCsv(next))
  }

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white/60 px-4 py-3 dark:border-gray-600 dark:bg-gray-950/40"
      aria-label="AI search tags"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        AI search tags
      </h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
        Match listings that have every selected tag (same vocabulary as listing details). Tap to toggle.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {OTODOM_LISTING_TAG_IDS.map((id) => {
          const on = selected.has(id)
          return (
            <li key={id}>
              <button
                type="button"
                disabled={disabled}
                aria-pressed={on}
                aria-label={
                  on ?
                    `${humanizeAiTag(id)}, selected — tap to remove from filter`
                  : `${humanizeAiTag(id)} — tap to add to filter`
                }
                onClick={() => toggle(id)}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900',
                  tagChipClass(id),
                  on ?
                    'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-50 dark:ring-blue-300 dark:ring-offset-gray-950'
                  : 'opacity-80 hover:opacity-100',
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                ].join(' ')}
              >
                {humanizeAiTag(id)}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
