# Assignment alignment review rule (anti-overengineering)

After completing any larger implementation step, review the result against the assignment requirements **before continuing**.

## Checklist

- Does this help **acquire**, **normalize**, **store**, **browse**, **search**, or **display** listings?
- Does it keep the MVP simple and avoid overengineering?
- Is scraping limited to a small controlled import (not the core product runtime)?
- Are messy/incomplete data handled explicitly?
- Are tradeoffs documented (or at least noted for the 1‑pager reasoning doc)?
- Is MySQL still the persistence target?
- Can the user browse listings, search/filter, paginate, and open details?
- Is AI used intentionally (or intentionally avoided with a reason)?

If a change does not support the assignment, **simplify it or remove it**.

Always prefer:
- working MVP over perfect architecture
- clear reasoning over clever abstractions
- deterministic code over unnecessary AI/runtime magic
- one source over generic multi-source crawling

## Short prompt version

After each implementation step, run an assignment-alignment check:
1) Which requirement does this satisfy?
2) Is this still MVP-sized?
3) Did we add unnecessary complexity?
4) What should be documented in the reasoning doc?

