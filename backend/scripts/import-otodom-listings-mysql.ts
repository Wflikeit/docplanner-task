/**
 * Imports Otodom sanitized (+ optional Gemini tagged) JSON into **MySQL** via **Prisma**.
 * Upsert / dedupe on `(source, external_id)` — see `prisma/schema.prisma`.
 *
 * Prerequisites:
 * - `DATABASE_URL` (MySQL)
 * - `npx prisma migrate deploy` (or `db:migrate:dev` once) applied migrations
 *
 * Defaults (when env unset): `data/processed/otodom-listings.sanitized.json` and, if the file exists,
 * `data/processed/otodom-listings.tagged.json`. Override with **`OTODOM_SANITIZED_PATH`** /
 * **`OTODOM_TAGGED_PATH`** / **`OTODOM_TAGGED_JSON_PATH`** / **`OTODOM_TAGGING_OUT`**.
 *
 * **Merge:** DB rows are built from **sanitized** `items[]` plus optional **Gemini** map keyed by `externalId`.
 * If default sanitized is missing and **`OTODOM_SANITIZED_PATH`** is unset, import tries **`meta.inputPath`**
 * inside the tagged JSON (the sanitized file path recorded when you ran `tag:otodom:gemini`).
 *
 * cd backend
 * npm run import:otodom:mysql
 */
import {existsSync, readFileSync} from 'node:fs'
import {dirname, isAbsolute, join, relative} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from 'node:process'

import {PrismaClient} from '@prisma/client'
import {config as loadDotenv} from 'dotenv'

import {
    geminiTaggingIndexFromValidatedBody,
    isOtodomGeminiTaggingFileBody,
    type OtodomGeminiTaggingPayload,
} from '../src/infrastructure/ai/index.js'
import {buildPersistedRowsFromOtodomSanitizedAndTagging} from '../src/infrastructure/data-pipeline/otodom/index.js'
import {isOtodomSanitizedFileBody} from '../src/infrastructure/data-pipeline/otodom/index.js'
import {countListingsPrisma, upsertPersistedListingRowsPrisma} from '../src/infrastructure/persistence/prismaListingUpsert.js'

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

const DEFAULT_PROCESSED_SAN = join(BACKEND_ROOT, 'data', 'processed', 'otodom-listings.sanitized.json')
const DEFAULT_PROCESSED_TAG = join(BACKEND_ROOT, 'data', 'processed', 'otodom-listings.tagged.json')

function ts(): string {
    return new Date().toISOString()
}

function logInfo(message: string, extra?: unknown): void {
    const line = `[import:otodom:mysql] ${ts()} [INFO] ${message}`
    if (extra !== undefined) console.log(line, extra)
    else console.log(line)
}

/**
 * Resolves sanitized + tagged paths. Tagged file only carries `gemini` blobs — base rows always come from
 * sanitized `{ source, items }`. If `OTODOM_SANITIZED_PATH` is unset and the default sanitized file is missing,
 * tries `meta.inputPath` from the tagged JSON (written by `tag:otodom:gemini`).
 */
function resolveImportPaths(): {sanPath: string; tagPath: string | null} {
    const tagRaw =
        process.env.OTODOM_TAGGED_PATH?.trim() ||
        process.env.OTODOM_TAGGED_JSON_PATH?.trim() ||
        process.env.OTODOM_TAGGING_OUT?.trim()
    const tagPath: string | null = tagRaw
        ? resolveBackendPath(tagRaw)
        : existsSync(DEFAULT_PROCESSED_TAG)
          ? DEFAULT_PROCESSED_TAG
          : null

    const explicitSan = process.env.OTODOM_SANITIZED_PATH?.trim()
    let sanPath = resolveBackendPath(explicitSan && explicitSan.length > 0 ? explicitSan : DEFAULT_PROCESSED_SAN)

    if (!explicitSan && !existsSync(sanPath) && tagPath !== null && existsSync(tagPath)) {
        try {
            const taggedParsed: unknown = JSON.parse(readFileSync(tagPath, 'utf8'))
            if (isOtodomGeminiTaggingFileBody(taggedParsed)) {
                const ip = taggedParsed.meta.inputPath?.trim()
                if (ip) {
                    const viaMeta = resolveBackendPath(ip)
                    if (existsSync(viaMeta)) {
                        sanPath = viaMeta
                        logInfo('Sanitized path taken from tagged file meta.inputPath', {path: pathForLog(viaMeta)})
                    }
                }
            }
        } catch {
            /* ignore; main will throw if sanitized still missing */
        }
    }

    return {sanPath, tagPath}
}

function logError(message: string, err?: unknown): void {
    console.error(`[import:otodom:mysql] ${ts()} [ERROR] ${message}`, err)
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL?.trim()) {
        throw new Error('DATABASE_URL must be set (MySQL connection string for Prisma).')
    }

    const {sanPath: SAN_PATH, tagPath: TAG_PATH} = resolveImportPaths()

    logInfo('Start', {
        SAN_PATH: pathForLog(SAN_PATH),
        TAG_PATH: TAG_PATH ? pathForLog(TAG_PATH) : '(none)',
    })

    if (!existsSync(SAN_PATH)) {
        throw new Error(
            `Sanitized file not found: ${pathForLog(SAN_PATH)} — run npm run sanitize:otodom, set OTODOM_SANITIZED_PATH, or ensure tagged JSON meta.inputPath points at the sanitized file used for tagging.`,
        )
    }
    if (TAG_PATH === null) {
        logInfo(
            'No tagged JSON (set OTODOM_TAGGING_OUT or create data/processed/otodom-listings.tagged.json) — DB rows get no AI tags for this run.',
        )
    }

    const raw = readFileSync(SAN_PATH, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isOtodomSanitizedFileBody(parsed)) {
        throw new Error(`Invalid sanitized file: ${pathForLog(SAN_PATH)}`)
    }

    const itemCount = parsed.items.length
    logInfo(`Sanitized file has ${itemCount} listing(s) to upsert`)
    if (itemCount === 0) {
        throw new Error(`No items in sanitized file: ${pathForLog(SAN_PATH)}`)
    }

    let tagMap = new Map<string, OtodomGeminiTaggingPayload>()
    let aiBatchAt: string | null = null
    if (TAG_PATH !== null) {
        const bodyRaw = readFileSync(TAG_PATH, 'utf8')
        const bodyParsed: unknown = JSON.parse(bodyRaw)
        if (!isOtodomGeminiTaggingFileBody(bodyParsed)) {
            throw new Error(`Invalid tagged file: ${pathForLog(TAG_PATH)}`)
        }
        tagMap = geminiTaggingIndexFromValidatedBody(bodyParsed)
        aiBatchAt = bodyParsed.meta.generatedAt
        logInfo('Gemini tagging merged', {taggingIndexSize: tagMap.size, taggedFile: pathForLog(TAG_PATH)})
    }

    const rows = buildPersistedRowsFromOtodomSanitizedAndTagging(parsed.items, tagMap, aiBatchAt)
    const prisma = new PrismaClient()
    try {
        const {rows: n} = await upsertPersistedListingRowsPrisma(prisma, rows)
        const total = await countListingsPrisma(prisma)
        logInfo(`Upserted ${n} row(s) from file; total rows in listings table: ${total}`)
    } finally {
        await prisma.$disconnect()
    }
}

try {
    await main()
} catch (e) {
    logError('Script failed', e)
    process.exit(1)
}
