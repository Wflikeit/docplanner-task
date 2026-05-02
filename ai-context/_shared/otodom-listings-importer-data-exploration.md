# Otodom — data exploration report (listings importer)

**Scope:** `https://www.otodom.pl/pl/wyniki/sprzedaz/dom/cala-polska` + selected listing detail pages.  
**Method:** Playwright MCP (Cursor) (`browser_navigate`, `browser_evaluate`) on live DOM — 2026-05-01 (list cards + samples); **2026-05-01 follow-up** — stable selectors / JSON-LD on detail (`…ID4Bar1` and peers).  
**Goal:** MVP-oriented notes for a listings importer (crawler lives in repo; importer cleaning is separate).

### Assignment reasoning (Otodom ingestion)

During exploration I found that Otodom exposes structured Schema.org JSON-LD on detail pages. I therefore used listing pages only to discover offer URLs, and detail pages as the source of truth, preferring JSON-LD over fragile DOM text parsing.

---

## Stable selectors & embedded contracts (detail page)

Otodom exposes **`data-cy` test hooks**, **Schema.org `application/ld+json`**, and **`#__NEXT_DATA__`**. For **structured** fields, prefer these over **line order inside `main.innerText`** (layout, promos, and Baxter slots reorder easily).

### 1. `data-cy` (DOM — reasonably stable)

Roughly **48–50** `[data-cy]` nodes per page; many are nav, ads, contact, similar offers. **Listing core** (query within `main` where possible):

| `data-cy` | Role |
|-----------|------|
| `adPageAdTitle` | `h1` — title |
| `adPageHeaderPrice` | Price in header (still **parse text** — NBSP, grouping) |
| `adPageAdDescription` | Description block in DOM (**may be truncated** until **Show more** is expanded — Otodom UI) |
| `mosaic-gallery-main-view` | Gallery / **All photos** |
| `breadcrumb` | Multiple `a` — geo/category trail (order = hierarchy, not a single location line) |
| `last-breadcrumb` | `span` — current crumb (often mirrors title) |

**Not seen** on sampled offers: a dedicated `data-cy="ad.location"`. **Do not assume** one stable location selector. **Exploration:** JSON-LD `address` is the reliable line; breadcrumb DOM can help humans. **Current repo crawler** builds a single **`locationDisplay`** from **`House.address`** (PostalAddress parts joined) only — it does **not** read `breadcrumb` / `last-breadcrumb` from the live DOM (those hooks remain useful for a future gap-fill or importer-only enrichment).

**Avoid:** Emotion / CSS-module classes (`css-…`, `e1uq1cxb1`, …) — **unstable** across builds.

### 2. `script[type="application/ld+json"]` (best structured contract)

One script tag; `@graph` includes an entity with **`@type` containing `House`** (often `["Product","House"]`).

| Path | Notes |
|------|--------|
| `House.name`, `House.url` | Title + canonical URL |
| `House.description` | **HTML** string; on sample ~4k chars — usually **full** text without clicking **Show more** in the DOM |
| `House.numberOfRooms` | Integer when present |
| `House.address` | `PostalAddress`: `streetAddress`, `addressLocality`, `addressRegion`, `addressCountry` |
| `House.offers` | `Offer`: `price`, `priceCurrency`. **`priceSpecification` per m²** appears on **few** live listings; most offers omit it. **Merge logic** (see below) therefore also uses **`adPageHeaderPrice` text** (regex for per-m² suffix after totals in PLN) and, when needed, **`round(price / area)`** from merged `priceAmount` + **area** from `additionalProperty` (match the area field by localized `name` in LD) — recorded as `extractionSources.pricePerSqm` = `ld` \| `dataCy` \| **`computed`** \| `missing`. |
| `House.additionalProperty[]` | `{ name, value }` — e.g. area, room count, building type (`name` values follow the site locale) — **index by `name`**, not DOM order |
| `House.image` | String or array of URLs |

**Parser risk:** `@type` may be a string or array; graph order can change — **select** the node whose `@type` is or includes `House`. **Implemented today:** only **`House`** is matched (`backend/src/infrastructure/crawler/otodom/ldJsonHouse.ts`). Other verticals (`Apartment`, `SingleFamilyResidence`, …) are **not** parsed until explicitly added — exploration notes above still apply when extending categories.

### 3. `#__NEXT_DATA__` (Next.js hydration)

`#__NEXT_DATA__` JSON includes `props.pageProps.ad` (`id`, `title`, `url`, `description`, …) — **~40kB** on sample.

**Pros:** very rich. **Cons:** **internal** payload — field names/layout can change on deploy. Use **after** JSON-LD / `data-cy`, or for debugging / gap-fill only.

### 4. Crawler + merge in this repo

- **Script (Playwright, URLs + DOM snippets):** [`backend/scripts/crawl-otodom-mock-once.ts`](../../backend/scripts/crawl-otodom-mock-once.ts) — collects `ldJsonScriptText`, `data-cy` title / header price line / description, and capped **`main` `innerText`** as `mainTextRaw`.
- **Merge & types (Node, no browser):** [`backend/src/infrastructure/crawler/otodom/`](../../backend/src/infrastructure/crawler/otodom/) — `listingSnapshot.ts`, `ldJsonHouse.ts`, **`detailMerge.ts`** (`mergeOtodomDetailPayload`).

Output file: **`otodom_snapshot_v2`** with **`ldJsonRaw`**, merged MVP columns, **`extractionSources`** per field (`ld` \| `dataCy` \| **`computed`** \| `missing`), and **`mainTextRaw`** **audit-only** (not used to fill structured fields in merge).

**Importer recommendation:** trust LD + `extractionSources` first; use **`mainTextRaw`** only to debug gaps — **not** as the primary parser input for structured keys.

**Not implemented in the crawler snapshot:** `#__NEXT_DATA__` / `nextDataAdSubset`, DOM **`mosaic-gallery-main-view`** as image fallback, breadcrumb DOM for location. Those remain exploration / future-importer options.

---

## Per-field notes (availability / parsing / selectors)

| Field / area | Usually on list? | Usually on detail? | Parsing | Selectors / stability |
|--------------|------------------|--------------------|---------|------------------------|
| Title | Yes (link text) | Yes | Light cleanup / HTML strip | **`[data-cy="adPageAdTitle"]`** or `h1`; list: `article` + offer link |
| Price + PLN/m² | Yes | Yes | **Total price:** `House.offers.price` (LD) or parse **`[data-cy="adPageHeaderPrice"]`** (total in PLN — regex avoids broken `\b` after non-ASCII currency formatting). **PLN/m²:** LD `priceSpecification` when present; else regex on **same** `adPageHeaderPrice` line(s) for per-m² amounts; else **`round(priceAmount / areaSqm)`** when both known (`extractionSources.pricePerSqm` = `computed`). Note: on some listings the UI shows m² next to the total price but **`adPageHeaderPrice` innerText is only the total** — then **`computed`** is the intended path. | Avoid “first currency token in `main`” |
| Location | Yes | Yes | **`House.address`** only → joined **`locationDisplay`** in merge. Breadcrumb DOM **not** collected in repo crawl. | **No** dedicated `ad.location` `data-cy` on sample; **avoid** single fragile `innerText` line heuristic for truth |
| Rooms / area / attrs | Yes | Yes | **`House.additionalProperty`** keyed by **`name`**; `numberOfRooms` | Avoid “text block before the Description section” — **reorders** with promos |
| Description | Truncated on card | Yes (long HTML in LD) | Strip HTML in importer; DOM: click **Show more** if using **`adPageAdDescription`** | Prefer **`House.description`** in JSON-LD |
| Images | Thumbnails | Gallery + LD | **Implemented:** `House.image` from LD only. **`mosaic-gallery-main-view`** not read in crawl (exploration / future fallback). Filter `apollo.olxcdn.com` in importer if needed. | URL shape varies (`;s=WxH` optional) |
| External ID | In URL (`…-ID4Bakc`) | Same | Regex from URL | Stable; numeric `ad.id` also in `__NEXT_DATA__` |

---

## A. Available fields (with examples)

### Search results — listing cards

Cards appear as **`article`** inside a **list**; each card has gallery links, price row, title link, location, and short attributes (rooms, area, badges).

| # | titleText | priceText | locationText | Visible attributes / badges | detail page URL |
|---|-----------|-----------|----------------|------------------------------|-----------------|
| 1 | House for sale, Wygledy, Zachodnia St. | `1 199 000 PLN` + `9083 PLN/m²` | Zachodnia, Wygledy, Leszno, Masovian Voivodeship | `5 rooms`, `132 m²`, `1 / 6`, `Added today`, `Promoted`, `Private listing` | `https://www.otodom.pl/pl/oferta/na-sprzedaz-dom-wygledy-ul-zachodnia-ID4Bakc` |
| 2 | 3 ha estate — house with pool, restored barn, large hangar | `2 850 000 PLN` + `9896 PLN/m²` | ul. Zielona, Cyganka, Panki, Silesian Voivodeship | `5 rooms`, `288 m²`, `Promoted`, `Private listing` | `https://www.otodom.pl/pl/oferta/3-ha-posiadlosc-dom-z-basenem-odrestaurowana-stodola-i-duzy-hangar-ID4yKlE` |
| 3 | New \| HALO WAWER estate \| handover 10.2026 \| House G | `1 515 000 PLN` + `14 713 PLN/m²` | Borkow 24B, Zerzen, Wawer, Warsaw | `5 rooms`, `102.97 m²`, `Added 7 days ago`, developer | `https://www.otodom.pl/pl/oferta/nowosc-osiedle-halo-wawer-oddanie-10-2026-dom-g-ID4B4nw` |
| 4 | Exceptional 295 m² house in a prime location | `1 198 000 PLN` + `4050 PLN/m²` | City centre, Zielona Gora, Lubusz Voivodeship | `6 rooms`, `295.8 m²`, `Boosted`, `Private listing` | `https://www.otodom.pl/pl/oferta/wyjatkowy-dom-295-m2-w-doskonalej-lokalizacji-ID4AGop` |
| 5 | Modern house — quiet, comfort, quick access to centre \| 0% commission | `1 295 000 PLN` + `6780 PLN/m²` | Feliksin, Widzew, Lodz, Lodz Voivodeship | `7 rooms`, `191 m²`, `Boosted`, agency | `https://www.otodom.pl/pl/oferta/nowoczesny-dom-spokoj-komfort-szybki-dojazd-do-centrum-0-prowizji-ID4B2l4` |

### Listing detail pages — raw (unparsed) samples

Values as seen in DOM (spacing may include NBSP in browser).

#### 1) `…/na-sprzedaz-dom-wygledy-ul-zachodnia-ID4Bakc`

- **titleText:** `House for sale, Wygledy, Zachodnia St.`
- **priceText:** `1 199 000 PLN 9083 PLN/m²`
- **locationText:** `Zachodnia, Wygledy, Leszno, Masovian Voivodeship`
- **descriptionText (shortened):** `Description: Modern single-family house (sample project name) in a quiet green setting in Wygledy, Zachodnia St. Basic facts: type — two-unit detached house …` *(paraphrased from on-page copy)*
- **attributesText (excerpt):** `Area: 132 m²`, `Rooms: 5`, `Building type: semi-detached`, `Finish: shell / to finish`, `Market: primary`, `Heating: heat pump`, `fireplace`, `Additional: attic`, `garage/parking`
- **image URLs (examples):**
  - `https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6ImZ0cm41b2wxMjljZDMtQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.3r4Wm1l4B7SloMAoO5lrMNl2mSF2_ryBwqed3501kvM/image;s=1280x1024;q=80`
  - `https://ireland.apollo.olxcdn.com/v1/files/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmbiI6Inl5MTZoZmEybjljdjItQVBMIiwidyI6W3siZm4iOiJlbnZmcXFlMWF5NGsxLUFQTCIsInMiOiIxNiIsImEiOiIwIiwicCI6IjEwLC0xMCJ9XX0.rZ4gePtoiGfUULQqSDcBZzDkaQdOwQsMSLPkapDI09o/image;s=1280x1024;q=80`

#### 2) `…/wyjatkowy-dom-295-m2-w-doskonalej-lokalizacji-ID4AGop`

- **titleText:** `Exceptional 295 m² house in a prime location`
- **priceText:** `1 198 000 PLN 4050 PLN/m²`
- **locationText:** `City centre, Zielona Gora, Lubusz Voivodeship`
- **descriptionText (shortened):** `Description: House in a very convenient location near forest, shops, and amenities …` *(paraphrased from Polish on-page copy)*
- **attributesText:** e.g. `295.8 m²`, `6` rooms, `terraced row`, `move-in ready`, `gas`, `basement`, `air conditioning`
- **image URLs (examples):** `ireland.apollo.olxcdn.com/.../image;s=1280x1024;q=80` (JWT path; same CDN pattern as above)

#### 3) `…/nowoczesny-dom-spokoj-komfort-szybki-dojazd-do-centrum-0-prowizji-ID4B2l4`

- **titleText:** `Modern house — quiet, comfort, quick access to centre | 0% commission`
- **priceText:** `1 295 000 PLN 6780 PLN/m²`
- **locationText:** `Feliksin, Widzew, Lodz, Lodz Voivodeship`
- **descriptionText (shortened):** starts with `Description: Looking for a new home…`; may include e.g. `Address: Lodz, Ziemianska 160H` (can differ from breadcrumb location line)
- **attributesText:** `191 m²`, `7` rooms, `detached`, `real estate office`, `heat pump`
- **image URLs:** same CDN; at least one image URL had **no** `;s=1280x1024` suffix (`…/image` only) — format not fully uniform

---

## B. Data inconsistencies and issues

- **Units / typography:** `m2` vs `m²` in titles; decimal areas (`295.8`); list cards may show `10+ rooms`.
- **Location:** card line vs full address inside description — two sources, may conflict.
- **Price / m²:** thousands separators + **NBSP** (`\u00a0`) in DOM.
- **Card noise:** `Featured`, `Boosted`, `Added …`, photo counter `1 / 6`, agency names — mixed with attributes.
- **Images:** `apollo.olxcdn.com` with long signed paths; optional `;s=WxH;q=…`; trackers/other hosts may appear among `img` — filter by host/path.
- **Price history:** placeholders / paywalled content in UI — not viable for MVP import without auth/API.

---

## C. Candidate meaningful fields for MVP

`sourceUrl`, `externalId` (from URL slug `…-IDxxxx` and/or on-page `ID: …`), **title**, **price + price/m²** (raw then parsed), **location display**, **area (m²)**, **rooms**, **description**, **image URLs**, **advertiser type** (private / agency / developer), **market** (primary/secondary) when present on detail.

---

## D. Fields to ignore for now

Mortgage teasers (RRSO), interactive map chrome, full price history, notifications CTA, “calculate installment”, footer/app links, ad pixels.

---

## E. Snapshot shape — suggested vs **what the repo writes**

Prefer **embedded JSON** + optional DOM snippets over a single `innerText` blob. A **generic** sketch (e.g. for a future importer buffer):

```ts
type RawListingSnapshot = {
  scrapedAt: string; // ISO
  listingUrl: string;
  /** Raw `application/ld+json` text (or parsed `House` node) — primary structured source */
  ldJsonScriptText?: string;
  /** Optional: full `#__NEXT_DATA__` or `pageProps.ad` subtree — debug / gap-fill only */
  nextDataAdSubset?: unknown;
  /** DOM test-hook snippets (optional redundancy) */
  domSnippets?: {
    title?: string; // [data-cy=adPageAdTitle]
    priceLine?: string; // [data-cy=adPageHeaderPrice]
    descriptionVisible?: string; // [data-cy=adPageAdDescription] after expand
  };
  /** Legacy / audit: full main innerText — do not parse as sole schema */
  mainTextRaw?: string;
  imageUrls: string[];
  pageTitle?: string;
  searchCardRawText?: string;
};
```

**Actually persisted today:** `OtodomListingSnapshotItem` / `OtodomListingsSnapshotFile` in [`backend/src/infrastructure/crawler/otodom/listingSnapshot.ts`](../../backend/src/infrastructure/crawler/otodom/listingSnapshot.ts) — includes `ldJsonRaw`, `attributesRawJson` (from LD `additionalProperty`), merged `title` / `description` / `priceAmount` / `priceCurrency` / `pricePerSqm` / `areaSqm` / `rooms` / `imageUrls`, `addressFromLd`, **`extractionSources`**, **`mainTextRaw`**. There is **no** `nextDataAdSubset` (and no `#__NEXT_DATA__` scrape).

Legacy flat shape (`titleText`, `attributesBlockText`, …) remains valid for **list cards** only until detail is fetched.

---

## F. Suggested normalized `ImportedListing` shape

```ts
type ImportedListing = {
  source: 'otodom';
  sourceListingKey: string;
  url: string;
  title: string;
  pricePln?: number;
  pricePerSqmPln?: number;
  currency: 'PLN';
  locationDisplay: string;
  city?: string;
  district?: string;
  voivodeship?: string;
  areaSqm?: number;
  rooms?: number;
  description: string;
  imageUrls: string[];
  advertiserKind?: 'private' | 'agency' | 'developer';
  market?: 'primary' | 'secondary' | 'unknown';
};
```

---

## G. Recommended extraction strategy

**Detail — exploration (ideal priority)**  
JSON-LD first, then `data-cy`, optional `__NEXT_DATA__`, optional gallery/breadcrumb — as in sections 1–3 above.

**Detail — implemented in repo (`mergeOtodomDetailPayload` + crawl script)**

1. Parse **`application/ld+json`** — first **`House`** node in `@graph`: title, description HTML, address, `offers` (price / rare `priceSpecification` per m²), `additionalProperty` by **`name`**, `image`, `numberOfRooms`.
2. **Fallbacks from DOM snippets** (same page pass): **`adPageAdTitle`**, **`adPageHeaderPrice`** (total price text; per-m² substring when present), **`adPageAdDescription`** when LD description missing.
3. **Price per m²** if still missing: **`round(priceAmount / areaSqm)`** when both are set — provenance **`computed`** (not from `mainTextRaw`).
4. **`mainTextRaw`**: stored for **audit / diffing only** — merge does **not** use it to populate structured columns.

**Not in merge path today:** `#__NEXT_DATA__`, **`mosaic-gallery-main-view`**, breadcrumb DOM.

**List**

- Walk `list` → `listitem` → **`article`**, dedupe `a[href*="/pl/oferta/"]` by absolute URL; **`article.innerText`** + heuristics remains acceptable **only** for list MVP — then **replace** with detail JSON-LD on fetch.

---

## H. Risks and limitations

- **Legal / ToS:** scraping may be restricted; expect rate limits, CAPTCHA, IP blocks.
- **Front-end changes:** CSS-module class names churn — **do not** depend on them; **`data-cy`** and **JSON-LD** can still change but are much weaker coupling than hashed classes.
- **JSON-LD:** `@graph` composition and `@type` unions (`House` vs `Apartment`) may vary by category — parser should be defensive. **Current code paths only `House`** for this crawl (domy / cala-polska).
- **`__NEXT_DATA__`:** highest churn risk — internal Next contract.
- **Duplicate links** in one card (gallery) — dedupe by canonical listing URL.
