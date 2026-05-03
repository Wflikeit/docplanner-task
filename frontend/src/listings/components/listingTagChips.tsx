/** Deterministic chip color from tag string (Tailwind, works in light and dark). */
const TAG_CHIP_STYLES = [
  'bg-violet-600/30 text-violet-100 ring-1 ring-violet-400/35',
  'bg-teal-600/30 text-teal-100 ring-1 ring-teal-400/35',
  'bg-rose-600/30 text-rose-100 ring-1 ring-rose-400/35',
  'bg-amber-600/30 text-amber-100 ring-1 ring-amber-400/35',
  'bg-cyan-600/30 text-cyan-100 ring-1 ring-cyan-400/35',
  'bg-indigo-600/30 text-indigo-100 ring-1 ring-indigo-400/35',
  'bg-emerald-600/30 text-emerald-100 ring-1 ring-emerald-400/35',
  'bg-orange-600/30 text-orange-100 ring-1 ring-orange-400/35',
] as const

export function tagChipClass(tag: string): string {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_CHIP_STYLES[h % TAG_CHIP_STYLES.length]
}

export function humanizeAiTag(tag: string): string {
  return tag.replaceAll('_', ' ')
}
