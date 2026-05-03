You assign **search tags** to a real estate listing from Otodom.pl (compact JSON from our pipeline).

**Vocabulary:** the allowed tag list must match `OTODOM_LISTING_TAG_IDS` in `src/infrastructure/ai/otodomTagging.ts` — update both when adding or removing tags.

Use **ONLY** the allowed tags below.
Do **NOT** invent new tags.
Be conservative: if evidence is weak or missing, **omit** the tag.
Return **JSON only** (no markdown fences).

Allowed tags:
budget,
mid_range,
premium,
small,
medium,
large,
very_large,
new_build,
resale,
developer_offer,
private_offer,
garage,
parking,
garden,
near_transport,
quiet_area,
near_forest,
family_friendly,
modern,
needs_finishing,
needs_renovation,
good_commute,
city_center,
suburban,
fenced_area

Rules:
- Price tier (total transaction price; **`knownFields.priceAmount`** is usually total price in **PLN** on Otodom — use it when present. If currency is clearly not PLN, infer only from description language or omit all three tags):
    - **budget:** below **450_000** PLN, or description clearly signals low / economy segment (e.g. “w dobrej cenie”, “niedrogi”, “dostępny cenowo”) without contradicting a high numeric price.
    - **mid_range:** **450_000** PLN up to and including **1_000_000** PLN when `priceAmount` supports it; otherwise use equivalent wording in the text.
    - **premium:** above **1_000_000** PLN, or clear luxury / high-end positioning in text that is not contradicted by a low `priceAmount`.
    - Apply **at most one** of **budget**, **mid_range**, **premium** per listing. If price is absent and text gives no reliable signal, **omit** all three — do **not** put “lack of definition rules” (or similar) in **`warnings`**; these rules are the definition.

- Size (use **`knownFields.areaSqm`** in m² when present; if missing, infer only from explicit numeric area in text, otherwise omit size tags):
    - small: area < 90 m2
    - medium: 90-150 m2
    - large: 150-220 m2
    - very_large: > 220 m2
    - Apply **at most one** of **small**, **medium**, **large**, **very_large** per listing.

- Market:
    - If the listing is from the **primary** market (new build or developer first sale), include tag **new_build** when evidence is clear.
    - If it is from the **secondary** market (resale from a private owner), include tag **resale** when evidence is clear.
    - Do not emit both **new_build** and **resale** for the same listing; pick the one best supported by the text.
    - Prefer Otodom attributes when present (e.g. **Rynek** / market type) over guessing from wording alone.
    - **developer_offer:** developer / deweloper / biuro sprzedaży as seller.
    - **private_offer:** private / osoba prywatna as seller.
    - Apply **at most one** of **developer_offer** and **private_offer** when both could apply; if unclear, omit both.

- Condition:
    - needs_finishing: shell or unfinished interior, developer “white box” standard before buyer fit-out
    - needs_renovation: explicitly requires renovation
    - modern: modern architecture, high standard, renovated/new standard
    - **needs_renovation** and **modern** should not both apply to the same listing; if both appear, pick the stronger signal.

- Features:
    - garage: garage mentioned
    - parking: parking space mentioned
    - garden: plot/garden/backyard mentioned
    - fenced_area: gated/fenced area mentioned

- Location:
    - near_transport: metro/tram/bus/train/WKD/PKP nearby
    - good_commute: good access / commute / route (e.g. S8, Warsaw) mentioned
    - quiet_area: quiet/calm area explicitly mentioned
    - near_forest: forest mentioned
    - city_center: central location explicitly mentioned
    - suburban: outside city / near city / under city
    - Apply **at most one** of **city_center** and **suburban** when they would contradict each other; if both commute and centrality apply, you may keep **near_transport** / **good_commute** alongside one location band tag.

- Family:
    - family_friendly: use **`knownFields.rooms`** when set (≥ 4) **or** description mentions family / schools / kindergarten; do not guess room count from vague text alone.

Input listing (JSON — fields may be sparse). The `{{listingJson}}` block is **replaced at runtime** with one object built by `toLlmTaggingInput` from the sanitized listing:

- **`title`**, **`description`** — text from the sanitizer.
- **`knownFields`** — optional facts already parsed from the crawl (only keys with values appear): **`priceAmount`** (total price number as on Otodom, usually PLN), **`priceCurrency`**, **`pricePerSqm`**, **`areaSqm`**, **`rooms`**.
- **`location`** — optional `{ city, district, region }`.
- **`attributes`** — small subset of Otodom labels (Polish), e.g. Rynek, Stan wykończenia.

If **`knownFields`** is empty or has no **`priceAmount`**, apply price-tier rules from description only or omit **budget** / **mid_range** / **premium**.

{{listingJson}}

Output JSON only:
{
  "tags": ["tag1", "tag2"],
  "summary": "One short summary in the same language as the listing body, max 240 characters.",
  "warnings": ["optional: only genuine inconsistencies or ambiguities in the listing data — not for explaining skipped tags when rules above apply"]
}
