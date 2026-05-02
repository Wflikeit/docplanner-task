import process from 'node:process'

import {config as loadDotenv} from 'dotenv'

import {createPrismaListingSource} from './infrastructure/persistence/prismaListingSource.js'
import {startHttpServer} from './presentation/http/server.js'

loadDotenv()
loadDotenv({path: '.env.local', override: true})

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

    console.log('[startup] listings: MySQL via Prisma (filter/paginate in SQL)')
    const listingSource = createPrismaListingSource()
    startHttpServer(listingSource)
}

main().catch((e) => {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[startup] fatal\n', message)
    process.exitCode = 1
})
