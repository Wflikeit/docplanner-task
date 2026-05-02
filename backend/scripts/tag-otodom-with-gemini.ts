/**
 * Reads compact sanitized `{ source, items }` JSON and calls **Gemini** once per listing
 * (each `items[]` row, unless `OTODOM_TAGGING_LIMIT` caps the batch), using `listing-tagging.prompt.md`.
 *
 * Requires `GEMINI_API_KEY` (Google AI Studio).
 *
 * cd backend
 * npm run tag:otodom:gemini
 *
 * OTODOM_SANITIZED_PATH=data/test-data.sanitized.json OTODOM_TAGGING_OUT=data/test-data.tagged.json npm run tag:otodom:gemini
 * OTODOM_TAGGING_PROMPT_PATH=...  # optional override (relative to backend/ or absolute)
 */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs'
import {dirname, isAbsolute, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'

import {GoogleGenAI} from '@google/genai'
import {config as loadDotenv} from 'dotenv'

import {
    OTODOM_TAGGING_OUTPUT_KIND,
    parseGeminiTaggingResponseText,
    type OtodomGeminiTaggingPayload,
} from '../src/infrastructure/ai/index.js'
import {
    isOtodomSanitizedFileBody,
    toLlmTaggingInput,
    type LlmTaggingInput,
    type OtodomSanitizedListingItem,
} from '../src/infrastructure/data-pipeline/otodom/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..')
loadDotenv({path: join(BACKEND_ROOT, '.env')})
loadDotenv({path: join(BACKEND_ROOT, '.env.local'), override: true})

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

const PROMPT_PATH = resolveBackendPath(
    process.env.OTODOM_TAGGING_PROMPT_PATH ??
        join(BACKEND_ROOT, 'src', 'infrastructure', 'ai', 'prompts', 'listing-tagging.prompt.md'),
)

const DEFAULT_IN = join(BACKEND_ROOT, 'data', 'test-data.sanitized.json')
const DEFAULT_OUT = join(BACKEND_ROOT, 'data', 'test-data.tagged.json')

const IN_PATH = resolveBackendPath(process.env.OTODOM_SANITIZED_PATH ?? DEFAULT_IN)
const OUT_PATH = resolveBackendPath(process.env.OTODOM_TAGGING_OUT ?? DEFAULT_OUT)
/** Default: stable 2.5 Flash (`gemini-2.0-flash` is not offered to new API users). */
const MODEL = process.env.OTODOM_GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

const LIMIT_RAW = process.env.OTODOM_TAGGING_LIMIT
const LIMIT: number | undefined =
    LIMIT_RAW === undefined || LIMIT_RAW === ''
        ? undefined
        : (() => {
              const n = Number.parseInt(LIMIT_RAW, 10)
              if (!Number.isFinite(n) || n <= 0) return undefined
              return n
          })()

const DELAY_MS_RAW = process.env.OTODOM_TAGGING_DELAY_MS ?? '400'
const DELAY_MS: number = (() => {
    const n = Number.parseInt(DELAY_MS_RAW, 10)
    return Number.isFinite(n) && n >= 0 ? n : 400
})()

function ts(): string {
    return new Date().toISOString()
}

function logInfo(message: string, extra?: unknown): void {
    const line = `[tag:otodom:gemini] ${ts()} [INFO] ${message}`
    if (extra !== undefined) console.log(line, extra)
    else console.log(line)
}

function logError(message: string, err?: unknown): void {
    console.error(`[tag:otodom:gemini] ${ts()} [ERROR] ${message}`, err)
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
}

function loadPromptTemplate(): string {
    const t = readFileSync(PROMPT_PATH, 'utf8')
    if (!t.includes('{{listingJson}}')) {
        throw new Error(`Prompt at ${pathForLog(PROMPT_PATH)} must contain {{listingJson}}`)
    }
    return t
}

function buildUserPrompt(template: string, listing: unknown): string {
    const json = JSON.stringify(listing, null, 2)
    return template.replace('{{listingJson}}', json)
}

async function main(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY?.trim()
    if (!apiKey) {
        throw new Error('Missing GEMINI_API_KEY (set in .env or the environment).')
    }

    logInfo('Start', {
        IN_PATH: pathForLog(IN_PATH),
        OUT_PATH: pathForLog(OUT_PATH),
        MODEL,
        LIMIT: LIMIT ?? 'all',
        DELAY_MS,
    })

    const template = loadPromptTemplate()
    const bodyRaw = readFileSync(IN_PATH, 'utf8')
    const parsedBody: unknown = JSON.parse(bodyRaw)
    if (!isOtodomSanitizedFileBody(parsedBody)) {
        throw new Error(
            `Invalid input: expected { source: "otodom", items: [...] }. File: ${pathForLog(IN_PATH)}`,
        )
    }

    let items: OtodomSanitizedListingItem[] = parsedBody.items
    if (LIMIT !== undefined) {
        items = items.slice(0, LIMIT)
    }

    const ai = new GoogleGenAI({apiKey})

    const rows: Array<{
        externalId: string
        tagging: LlmTaggingInput
        gemini?: OtodomGeminiTaggingPayload
        error?: string
        modelTextSnippet?: string
    }> = []

    for (let i = 0; i < items.length; i++) {
        const item = items[i]!
        const tagging = toLlmTaggingInput(item)
        const contents = buildUserPrompt(template, tagging)
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
            })
            const text = response.text?.trim() ?? ''
            const gemini = parseGeminiTaggingResponseText(text)
            if (gemini === null) {
                rows.push({
                    externalId: item.externalId,
                    tagging,
                    error: 'model_output_not_json_or_invalid_shape',
                    modelTextSnippet: text.slice(0, 500),
                })
            } else {
                rows.push({externalId: item.externalId, tagging, gemini})
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            rows.push({externalId: item.externalId, tagging, error: msg})
        }

        if (i < items.length - 1 && DELAY_MS > 0) {
            await sleep(DELAY_MS)
        }
    }

    const outDoc = {
        source: 'otodom' as const,
        meta: {
            outputKind: OTODOM_TAGGING_OUTPUT_KIND,
            model: MODEL,
            generatedAt: new Date().toISOString(),
            inputPath: pathForLog(IN_PATH),
        },
        items: rows,
    }

    mkdirSync(dirname(OUT_PATH), {recursive: true})
    writeFileSync(OUT_PATH, `${JSON.stringify(outDoc, null, 2)}\n`, 'utf8')
    logInfo(`Wrote ${pathForLog(OUT_PATH)} (${rows.length} rows)`)
}

try {
    await main()
} catch (e) {
    logError('Script failed', e)
    process.exit(1)
}
