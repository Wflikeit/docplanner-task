/**
 * Reads a compact sanitized `{ source, items }` JSON and writes **tagging-only** LLM inputs
 * (`LlmTaggingInput` per row). No API calls.
 *
 * cd backend
 * npm run preview:otodom:tagging-inputs
 * OTODOM_SANITIZED_PATH=data/test-data.sanitized.json OTODOM_TAGGING_PREVIEW_OUT=data/test-data.tagging-inputs.preview.json npm run preview:otodom:tagging-inputs
 */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {dirname, isAbsolute, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'

import {config as loadDotenv} from 'dotenv'

import {
    isOtodomSanitizedFileBody,
    toLlmTaggingInput,
    type OtodomSanitizedListingItem,
} from '../src/infrastructure/data-pipeline/otodom/index.js'
import {createLogger} from '../src/infrastructure/logging/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..')
loadDotenv({path: join(BACKEND_ROOT, '.env')})
loadDotenv({path: join(BACKEND_ROOT, '.env.local'), override: true})

const DEFAULT_IN = join(BACKEND_ROOT, 'data', 'test-data.sanitized.json')
const DEFAULT_OUT = join(BACKEND_ROOT, 'data', 'test-data.tagging-inputs.preview.json')

function resolveBackendPath(p: string): string {
    return isAbsolute(p) ? p : join(BACKEND_ROOT, p)
}

function pathForLog(absPath: string): string {
    try {
        return relative(BACKEND_ROOT, absPath) || absPath
    } catch {
        return absPath
    }
}

const IN_PATH = resolveBackendPath(process.env.OTODOM_SANITIZED_PATH ?? DEFAULT_IN)
const OUT_PATH = resolveBackendPath(process.env.OTODOM_TAGGING_PREVIEW_OUT ?? DEFAULT_OUT)
const LIMIT_RAW = process.env.OTODOM_TAGGING_PREVIEW_LIMIT
const LIMIT: number | undefined =
    LIMIT_RAW === undefined || LIMIT_RAW === ''
        ? undefined
        : (() => {
              const n = Number.parseInt(LIMIT_RAW, 10)
              if (!Number.isFinite(n) || n <= 0) return undefined
              return n
          })()

const log = createLogger('preview:otodom:tagging', {timestamps: true})

function main(): void {
    log.info('Start', {
        IN_PATH: pathForLog(IN_PATH),
        OUT_PATH: pathForLog(OUT_PATH),
        LIMIT: LIMIT ?? 'all',
    })

    const raw = readFileSync(IN_PATH, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isOtodomSanitizedFileBody(parsed)) {
        throw new Error(
            `Invalid input: expected compact sanitized file { source: "otodom", items: [...] } (no meta). File: ${pathForLog(IN_PATH)}`,
        )
    }

    let items: OtodomSanitizedListingItem[] = parsed.items
    if (LIMIT !== undefined) {
        items = items.slice(0, LIMIT)
    }

    const rows = items.map((item) => ({
        externalId: item.externalId,
        tagging: toLlmTaggingInput(item),
    }))

    const outDoc = {source: 'otodom' as const, generatedFor: 'tagging_input_preview', items: rows}
    mkdirSync(dirname(OUT_PATH), {recursive: true})
    writeFileSync(OUT_PATH, `${JSON.stringify(outDoc, null, 2)}\n`, 'utf8')
    log.info(`Wrote ${pathForLog(OUT_PATH)} (${rows.length} rows)`)
}

try {
    const t0 = performance.now()
    main()
    log.info(`ok · ${Math.round(performance.now() - t0)}ms`)
} catch (e) {
    log.error('Script failed', e)
    process.exit(1)
}
