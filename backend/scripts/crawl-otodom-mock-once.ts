/**
 * One-shot: Otodom search (paginated) → collect listing URLs → open each detail → JSON (default 100).
 *
 * npm run crawl:otodom:install
 * OTODOM_LISTING_COUNT=50 npm run crawl:otodom
 * OTODOM_LOG=verbose npm run crawl:otodom
 *
 * See README: scripts/README-otodom-crawl.md
 */
import {mkdirSync, writeFileSync} from 'node:fs'
import {performance} from 'node:perf_hooks'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import process from "node:process"

import type {Page} from 'playwright'

import {
    OTODOM_SNAPSHOT_OUTPUT_KIND,
    type OtodomListingSnapshotItem,
    mergeOtodomDetailPayload,
} from '../src/infrastructure/crawler/otodom/index.js'
import {createLogger} from '../src/infrastructure/logging/logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLAYWRIGHT_BROWSERS_PATH = join(__dirname, '..', '.pw-browsers')
const OUT = join(__dirname, '..', 'data', 'raw', 'otodom-listings.snapshot.json')
const SEARCH_URL =
    'https://www.otodom.pl/pl/wyniki/sprzedaz/dom/cala-polska'

const TARGET_COUNT = Math.min(
    500,
    Math.max(1, Number.parseInt(process.env.OTODOM_LISTING_COUNT ?? '100', 10) || 100),
)
/** ~36 carts / page */
const MAX_SEARCH_PAGES = Math.min(30, Math.ceil(TARGET_COUNT / 28) + 3)
const BETWEEN_DETAIL_MS = Number.parseInt(
    process.env.OTODOM_DETAIL_DELAY_MS ?? '450',
    10,
) || 450

const LOG_VERBOSE = (process.env.OTODOM_LOG ?? '').toLowerCase() === 'verbose'

const log = createLogger('crawl:otodom', {timestamps: true})

/** Max chars stored for `ldJsonRaw` per listing (full script body can be large). */
const LD_JSON_RAW_MAX = Math.min(
    2_000_000,
    Math.max(5_000, Number.parseInt(process.env.OTODOM_LD_JSON_RAW_MAX ?? '900000', 10) || 900_000),
)
/** Max chars for `mainTextRaw` per listing (audit only — full main innerText). */
const MAIN_TEXT_RAW_MAX = Math.min(
    2_000_000,
    Math.max(10_000, Number.parseInt(process.env.OTODOM_MAIN_TEXT_RAW_MAX ?? '500000', 10) || 500_000),
)

const COLLECT_LISTING_URLS_SCRIPT = `(() => {
  var seen = {};
  var out = [];
  var list = [].slice.call(document.querySelectorAll('a[href*="/pl/oferta/"]'));
  for (var i = 0; i < list.length; i++) {
    var raw = list[i].getAttribute('href') || '';
    var h = raw.split('?')[0].split('#')[0];
    if (!/ID[a-zA-Z0-9]+$/.test(h)) continue;
    var abs = new URL(raw, location.origin).href.split('?')[0];
    if (seen[abs]) continue;
    seen[abs] = true;
    out.push(abs);
  }
  return out;
})()`

const DETAIL_COLLECT_PAYLOAD_SCRIPT = `(() => {
  function nbsp(s) { return s.replace(/\\u00a0/g, ' '); }
  function tcy(sel) {
    var el = document.querySelector(sel);
    return el ? nbsp(el.innerText || '').trim() : '';
  }
  var scripts = [].slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
  var ldJsonScriptText = '';
  for (var si = 0; si < scripts.length; si++) {
    var t = scripts[si].textContent || '';
    if (t.indexOf('"@graph"') >= 0 && (t.indexOf('"House"') >= 0 || t.indexOf('House') >= 0)) {
      ldJsonScriptText = t;
      break;
    }
  }
  if (!ldJsonScriptText && scripts.length) ldJsonScriptText = scripts[0].textContent || '';
  var main = document.querySelector('main');
  var all = main ? nbsp(main.innerText || '') : '';
  var maxMain = ${MAIN_TEXT_RAW_MAX};
  var mainTextRaw = all.length > maxMain ? all.slice(0, maxMain) : all;
  var mainTextRawTruncated = all.length > maxMain;
  return {
    ldJsonScriptText: ldJsonScriptText,
    dataCyTitle: tcy('[data-cy="adPageAdTitle"]'),
    dataCyPriceLine: tcy('[data-cy="adPageHeaderPrice"]'),
    dataCyDescription: tcy('[data-cy="adPageAdDescription"]'),
    mainTextRaw: mainTextRaw,
    mainTextRawTruncated: mainTextRawTruncated
  };
})()`

type DetailPayloadRow = {
    ldJsonScriptText: string
    dataCyTitle: string
    dataCyPriceLine: string
    dataCyDescription: string
    mainTextRaw: string
    mainTextRawTruncated: boolean
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
}

function searchResultsPageUrl(base: string, page: number): string {
    if (page <= 1) return base
    const u = new URL(base)
    u.searchParams.set('page', String(page))
    return u.toString()
}

function extractExternalId(url: string): string | null {
    const m = url.match(/-(ID[a-zA-Z0-9]+)(?:\?|$)/)
    return m ? m[1] : null
}

async function scrollDetailMain(page: Page): Promise<void> {
    for (let step = 0; step < 6; step++) {
        await page.evaluate(`(() => { window.scrollBy(0, 900); })()`)
        await sleep(220)
    }
}

/** Expands collapsed listing description (full text is hidden until click). */
async function tryExpandDescription(page: Page): Promise<void> {
    const scope = page.locator('main')
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const btn = scope.getByRole('button', {name: /Pokaż więcej/i}).first()
            if (!(await btn.isVisible({timeout: 700}))) break
            await btn.click({timeout: 5000})
            await sleep(450)
        } catch {
            break
        }
    }
    try {
        const link = scope.getByRole('link', {name: /Pokaż więcej/i}).first()
        if (await link.isVisible({timeout: 500})) {
            await link.click({timeout: 5000})
            await sleep(450)
        }
    } catch {
        /* no link variant */
    }
}

async function tryAcceptCookies(page: Page): Promise<void> {
    const names = [/akceptuj/i, /Akceptuję/, /Accept all/i]
    for (const re of names) {
        try {
            const b = page.getByRole('button', {name: re})
            if (await b.first().isVisible({timeout: 2000})) {
                await b.first().click({timeout: 3000})
                log.info(`Cookies: clicked button matching ${String(re)}`)
                await sleep(800)
                return
            }
        } catch {
            /* next */
        }
    }
}

async function scrollListingPage(page: Page): Promise<void> {
    for (let step = 0; step < 6; step++) {
        const y = step * 900
        await page.evaluate(`(() => { window.scrollTo(0, ${y}); })()`)
        await sleep(350)
    }
}

async function collectUrlsFromSearchPages(page: Page): Promise<string[]> {
    const ordered: string[] = []
    const seen = new Set<string>()

    log.info(
        `Search: target ${TARGET_COUNT} URLs, up to ${MAX_SEARCH_PAGES} pages (?page=), delay between details ${BETWEEN_DETAIL_MS} ms`,
    )

    for (let p = 1; p <= MAX_SEARCH_PAGES && ordered.length < TARGET_COUNT; p++) {
        const url = searchResultsPageUrl(SEARCH_URL, p)
        log.info(`Search: opening page ${p} -> ${url}`)
        await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90_000})
        if (p === 1) await tryAcceptCookies(page)

        try {
            await page.locator('a[href*="/pl/oferta/"]').first().waitFor({
                state: 'attached',
                timeout: 45_000,
            })
        } catch {
            if (p === 1) {
                throw new Error('No listing links on the first search results page.')
            }
            log.warn(`Search page ${p}: no listing links; stopping URL collection.`)
            break
        }

        log.info(`Search: scrolling page ${p}`)
        await scrollListingPage(page)
        await sleep(500)

        const batch = (await page.evaluate(COLLECT_LISTING_URLS_SCRIPT)) as string[]
        let newOnPage = 0
        for (const href of batch) {
            if (seen.has(href)) continue
            seen.add(href)
            ordered.push(href)
            newOnPage++
            if (ordered.length >= TARGET_COUNT) break
        }

        log.info(
            `Search: page ${p} - +${newOnPage} new URLs on page, total collected ${ordered.length}/${TARGET_COUNT}`,
        )
        if (newOnPage === 0 && p > 1) {
            log.warn(`Search page ${p}: no new URLs; stopping pagination.`)
            break
        }
    }

    const slice = ordered.slice(0, TARGET_COUNT)
    log.info(`Search: done - ${slice.length} URLs to fetch as details`)
    return slice
}

async function main(): Promise<void> {
    const started = Date.now()
    process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSERS_PATH
    const {chromium} = await import('playwright')

    log.info('Start', {
        OUT,
        PLAYWRIGHT_BROWSERS_PATH,
        TARGET_COUNT,
        BETWEEN_DETAIL_MS,
        LD_JSON_RAW_MAX,
        MAIN_TEXT_RAW_MAX,
        LOG_VERBOSE,
    })

    const browser = await chromium.launch({
        headless: true,
        args: ['--disable-blink-features=AutomationControlled'],
    })
    log.info('Browser: Chromium launched (headless)')
    const context = await browser.newContext({
        locale: 'pl-PL',
        timezoneId: 'Europe/Warsaw',
        viewport: {width: 1365, height: 900},
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    log.info('Context: locale pl-PL, viewport 1365x900')

    const listingUrls = await collectUrlsFromSearchPages(page)
    if (listingUrls.length === 0) {
        await browser.close()
        throw new Error('No listing URLs collected.')
    }
    if (listingUrls.length < TARGET_COUNT) {
        log.warn(
            `Collected only ${listingUrls.length} URLs (target ${TARGET_COUNT}); fetching all collected.`,
        )
    }

    log.info(`Details: processing ${listingUrls.length} listings...`)
    const now = new Date().toISOString()
    const items: OtodomListingSnapshotItem[] = []
    let ok = 0
    let fail = 0

    for (let i = 0; i < listingUrls.length; i++) {
        const listingUrl = listingUrls[i]
        const externalId = extractExternalId(listingUrl)
        if (!externalId) {
            fail++
            log.warn(`[${i + 1}/${listingUrls.length}] missing externalId in URL`, listingUrl)
            continue
        }

        if (LOG_VERBOSE) {
            log.info(`[${i + 1}/${listingUrls.length}] → ${externalId}`, listingUrl)
        }

        try {
            await page.goto(listingUrl, {waitUntil: 'domcontentloaded', timeout: 55_000})
            await tryAcceptCookies(page)
            await page.locator('main').waitFor({state: 'attached', timeout: 25_000})
            await page.locator('h1').waitFor({state: 'attached', timeout: 12_000}).catch(() => {
            })
            await sleep(400)
            await tryExpandDescription(page)
            await scrollDetailMain(page)

            const raw = (await page.evaluate(DETAIL_COLLECT_PAYLOAD_SCRIPT)) as DetailPayloadRow | undefined
            if (!raw || typeof raw !== 'object') {
                throw new Error('Empty page.evaluate result on listing detail')
            }

            const fullLd = raw.ldJsonScriptText ?? ''

            const item = mergeOtodomDetailPayload({
                externalId,
                sourceUrl: listingUrl,
                scrapedAt: now,
                ldJsonRaw: fullLd,
                ldJsonRawMax: LD_JSON_RAW_MAX,
                payload: {
                    ldJsonScriptText: fullLd,
                    dataCyTitle: raw.dataCyTitle ?? '',
                    dataCyPriceLine: raw.dataCyPriceLine ?? '',
                    dataCyDescription: raw.dataCyDescription ?? '',
                    mainTextRaw: raw.mainTextRaw ?? '',
                    mainTextRawTruncated: raw.mainTextRawTruncated,
                },
            })
            items.push(item)
            ok++
            if (LOG_VERBOSE) {
                log.info(
                    `[${i + 1}/${listingUrls.length}] OK ${externalId} | ${item.title.slice(0, 60)} | ${item.priceAmount ?? '—'} PLN`,
                )
            }
        } catch (e) {
            fail++
            log.warn(
                `[${i + 1}/${listingUrls.length}] skipped ${externalId}`,
                (e as Error).message,
            )
        }

        if ((i + 1) % 10 === 0 || i + 1 === listingUrls.length) {
            const elapsed = ((Date.now() - started) / 1000).toFixed(1)
            log.info(
                `Progress: ${i + 1}/${listingUrls.length} | ok ${ok} | skipped ${fail} | elapsed ${elapsed}s`,
            )
        }
        await sleep(BETWEEN_DETAIL_MS)
    }

    await browser.close()
    log.info('Browser: closed')

    mkdirSync(dirname(OUT), {recursive: true})
    writeFileSync(
        OUT,
        `${JSON.stringify(
            {
                meta: {
                    outputKind: OTODOM_SNAPSHOT_OUTPUT_KIND,
                    source: 'otodom',
                    searchUrl: SEARCH_URL,
                    targetCount: TARGET_COUNT,
                    collectedUrls: listingUrls.length,
                    scrapedAt: now,
                    note:
                        'Phase-1 raw snapshot (v2): primary = application/ld+json (House); fallback = data-cy snippets; mainTextRaw = audit only. No DB/sanitization in this step.',
                },
                items,
            },
            null,
            2,
        )}\n`,
        'utf8',
    )
    const totalSec = ((Date.now() - started) / 1000).toFixed(1)
    log.info(
        `Wrote file: ${items.length} rows (${ok} ok, ${fail} skipped) in ${totalSec}s -> ${OUT}`,
    )
}

const scriptT0 = performance.now()
main()
    .then(() => {
        log.info(`ok · ${Math.round(performance.now() - scriptT0)}ms`)
    })
    .catch((e) => {
        log.error('Crawl script failed', e)
        process.exit(1)
    })
