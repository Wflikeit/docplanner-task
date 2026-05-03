import { humanizeAiTag, tagChipClass } from './listingTagChips'

type AiSummaryCollapsibleProps = {
  text: string
}

export function AiSummaryCollapsible({ text }: AiSummaryCollapsibleProps) {
  return (
    <section className="mt-8" aria-label="AI summary">
      <details className="group rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/60">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
          AI summary
          <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">(expand to read)</span>
        </summary>
        <div className="border-t border-gray-200 px-4 pb-4 pt-3 text-sm leading-relaxed text-gray-800 dark:border-gray-700 dark:text-gray-200">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </details>
    </section>
  )
}

type SearchTagsStripProps = {
  tags: readonly string[]
}

export function SearchTagsStrip({ tags }: SearchTagsStripProps) {
  if (tags.length === 0) return null
  return (
    <section className="mt-10" aria-label="AI search tags">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        AI search tags
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <li key={tag}>
            <span
              className={`inline-block rounded-md px-2.5 py-1 text-xs font-medium ${tagChipClass(tag)}`}
            >
              {humanizeAiTag(tag)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
