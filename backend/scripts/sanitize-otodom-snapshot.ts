/**
 * Deterministic cleanup of Otodom crawl snapshot JSON → compact pipeline file (no AI).
 * Raw crawl file is read-only; output is `{ source, items }` only.
 * Rows matching “page not found” (empty LD, no attributes/price/area/rooms, Untitled + Otodom copy) are **skipped**; see `isUnavailableOtodomListingSnapshot` and Summary log.
 *
 * npm run sanitize:otodom
 * OTODOM_SNAPSHOT_PATH=data/test-data.json OTODOM_SANITIZED_OUT=data/test-data.sanitized.json npm run sanitize:otodom
 */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs'
import {dirname, isAbsolute, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'

import {config as loadDotenv} from 'dotenv'

import {
    OTODOM_SNAPSHOT_OUTPUT_KIND,
    type OtodomListingSnapshotItem,
    type OtodomSnapshotMeta,
    isUnavailableOtodomListingSnapshot,
} from '../src/infrastructure/crawler/otodom/index.js'
import {
    buildOtodomSanitizedItemFromSnapshot,
    type OtodomSanitizedFileBody,
    type OtodomSanitizedListingItem,
} from '../src/infrastructure/data-pipeline/otodom/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..')
loadDotenv({path: join(BACKEND_ROOT, '.env')})
loadDotenv({path: join(BACKEND_ROOT, '.env.local'), override: true})

const DEFAULT_SNAPSHOT = join(BACKEND_ROOT, 'data', 'raw', 'otodom-listings.snapshot.json')
const DEFAULT_OUT = join(BACKEND_ROOT, 'data', 'processed', 'otodom-listings.sanitized.json')

function resolveBackendPath(p: string): string {
    return isAbsolute(p) ? p : join(BACKEND_ROOT, p)
}

function pathForMeta(absPath: string): string {
    try {
        return relative(BACKEND_ROOT, absPath) || absPath
    } catch {
        return absPath
    }
}

const SNAPSHOT_PATH = resolveBackendPath(process.env.OTODOM_SNAPSHOT_PATH ?? DEFAULT_SNAPSHOT)
const OUT_PATH = resolveBackendPath(process.env.OTODOM_SANITIZED_OUT ?? DEFAULT_OUT)
const LIMIT_RAW = process.env.OTODOM_SANITIZE_LIMIT
const LIMIT: number | undefined =
    LIMIT_RAW === undefined || LIMIT_RAW === ''
        ? undefined
        : (() => {
              const n = Number.parseInt(LIMIT_RAW, 10)
              if (!Number.isFinite(n) || n <= 0) return undefined
              return n
          })()

type SnapshotFile = {
    meta: OtodomSnapshotMeta
    items: OtodomListingSnapshotItem[]
}

function ts(): string {
    return new Date().toISOString()
}

function logInfo(message: string, extra?: unknown): void {
    const line = `[sanitize:otodom] ${ts()} [INFO] ${message}`
    if (extra !== undefined) console.log(line, extra)
    else console.log(line)
}

function logError(message: string, err?: unknown): void {
    console.error(`[sanitize:otodom] ${ts()} [ERROR] ${message}`, err)
}

function main(): void {
    logInfo('Start', {
        SNAPSHOT_PATH: pathForMeta(SNAPSHOT_PATH),
        OUT_PATH: pathForMeta(OUT_PATH),
        LIMIT: LIMIT ?? 'all',
    })

    const raw = readFileSync(SNAPSHOT_PATH, 'utf8')
    const parsed = JSON.parse(raw) as SnapshotFile
    if (parsed.meta?.outputKind !== OTODOM_SNAPSHOT_OUTPUT_KIND) {
        throw new Error(
            `Invalid snapshot: meta.outputKind=${String(parsed.meta?.outputKind)}, expected ${OTODOM_SNAPSHOT_OUTPUT_KIND}`,
        )
    }
    if (!Array.isArray(parsed.items)) {
        throw new Error('Invalid snapshot: missing items array')
    }

    let items = parsed.items
    if (LIMIT !== undefined && LIMIT > 0) {
        items = items.slice(0, LIMIT)
    }

    const read = items.length
    let skippedUnavailable = 0
    const outItems: OtodomSanitizedListingItem[] = []
    for (const item of items) {
        if (isUnavailableOtodomListingSnapshot(item)) {
            skippedUnavailable += 1
            continue
        }
        outItems.push(buildOtodomSanitizedItemFromSnapshot(item))
    }
    const outDoc: OtodomSanitizedFileBody = {
        source: 'otodom',
        items: outItems,
    }

    mkdirSync(dirname(OUT_PATH), {recursive: true})
    writeFileSync(OUT_PATH, `${JSON.stringify(outDoc, null, 2)}\n`, 'utf8')
    logInfo(`Wrote ${pathForMeta(OUT_PATH)} (${outItems.length} rows)`)
    logInfo('Summary', {read, sanitized: outItems.length, skipped_unavailable: skippedUnavailable})
}

try {
    main()
} catch (e) {
    logError('Script failed', e)
    process.exit(1)
}
