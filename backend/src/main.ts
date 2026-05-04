import process from 'node:process'

import {config as loadDotenv} from 'dotenv'

import {createLogger} from './infrastructure/logging/logger.js'
import {createPrismaListingSource} from './infrastructure/persistence/prismaListingSource.js'
import {startHttpServer} from './presentation/http/server.js'

// dotenv ≥17 logs "injected env (N)…" by default; N is *new* keys only — noisy and misleading when vars come from the shell.
loadDotenv({quiet: true})
loadDotenv({path: '.env.local', override: true, quiet: true})

const log = createLogger('startup')

function logStartupSummary(): void {
    const cwd = process.cwd()
    const nodeEnv = process.env.NODE_ENV?.trim() || '(unset)'
    const geminiSet = Boolean(process.env.GEMINI_API_KEY?.trim())
    const aiSearchMode = geminiSet ? 'Gemini' : 'mock (no GEMINI_API_KEY)'

    log.info(`${process.version} · NODE_ENV=${nodeEnv} · cwd=${cwd}`)
    log.info(
        `Listings: MySQL/Prisma · AI search: ${aiSearchMode} · GEMINI_API_KEY=${geminiSet ? 'set' : 'unset'}`,
    )
}

function missingDatabaseUrlMessage(): string {
    return [
        'DATABASE_URL is required.',
        '',
        'The running API reads listings only from MySQL via Prisma. JSON under data/ is not a runtime source —',
        'it is input to the import script. Once imported, MySQL is the source of truth.',
        '',
        'Setup:',
        '  1) Start MySQL (e.g. from repo root: docker compose up -d)',
        '  2) Set DATABASE_URL (see backend/.env.example)',
        '  3) Import rows: npm run import:otodom:mysql',
        '',
        'Prepare pipeline artifacts (optional before import):',
        '  npm run crawl:otodom && npm run data:prepare && npm run tag:otodom:gemini',
        '',
    ].join('\n')
}

async function main(): Promise<void> {
    if (!process.env.DATABASE_URL?.trim()) {
        throw new Error(missingDatabaseUrlMessage())
    }

    logStartupSummary()
    const listingSource = createPrismaListingSource()
    startHttpServer(listingSource)
}

main().catch((e) => {
    const message = e instanceof Error ? e.message : String(e)
    log.error('fatal', message)
    process.exitCode = 1
})
