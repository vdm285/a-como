# AGENTS.md — A cómo

Read this before changing the app. `docs/VISION.md` says where the product is going and why. `HANDOFF.md` is the state of the code, dated, newest first. `docs/PIPELINES.md` is how data gets in and how to curate it. `docs/EDITORIAL.md` is the rule for words and numbers on a screen. `docs/research/` holds the dated source research (data, geometry, licenses, landscape). `D:\_GitHub\revamp-playbook.md` (outside the repo) is how the owner works; read it first in any of his repos.

Owner: Victor (github.com/vdm285). The app opens in Mexican Spanish; English is a setting (`?lang=en` in the hash or Settings), never a second site. Audience: the owner and his friends in Mexico City first; anyone in Mexico later. `CLAUDE.md` imports this file.

## What this is

A static site on GitHub Pages that draws every supermarket PROFECO monitors in Mexico City and its metro area on a dark map, with the prices PROFECO publishes weekly as open data ("Quién es Quién en los Precios", QQP). Three questions, one stage: where is this product cheaper (the map recolours by that price), which store is cheapest for my basket (totals per store), how expensive is this store (its basket index against the city median). A fourth, inherited from the first version: is the price I am looking at good (the reader's own shelf prices, stored only in the browser). A scrubber moves the whole map through the weeks.

Working name "A cómo" (what a Mexican asks at the shelf); the repository keeps its old name `compa-precio` until the owner decides. The first version (March 2026, one `index.html` with Tailwind from a CDN and mock data) is in git history before commit `b81c22a`; its README's philosophy survives in `docs/VISION.md`.

## Do not

- Do not add a server, an account, an analytics script, an ad, a paid API, or any key the browser can see. Build-time keys only, in Actions secrets, free tiers only. Today there are none.
- Do not invent a price, a store, a date, or a product. Everything shown comes from PROFECO's files or from the reader. When data is missing the UI says so (a hollow dot, "sin visita esa semana").
- Do not use the mean. Medians everywhere (`src/logic/stats.js`).
- Do not compare across units. Label prices with label prices; per-unit only inside one dimension (`src/logic/unit.js`, `groupDimension` in `src/app/stage.js`).
- Do not ship, commit or publish the owner's March 2026 Walmart scrape (`data/sources/`, gitignored). Walmart's terms forbid it and online prices are not shelf prices. It is a local test corpus only.
- Do not put a wordmark, a title bar or a fixed control on the stage unless it is used constantly. Search, basket, settings and the legend are the whole chrome.
- Do not hide or shrink the map to make room: cards overlay the side away from the subject.
- Do not use a red/green semaphore. The stage uses one diverging scale (blue cheaper, grey median, red dearer, `src/logic/color.js`) with a legend always present.
- Do not use `innerHTML` with data. Everything from the files goes through lit templates or `textContent`.
- Do not write downloads, caches or scratch anywhere but under `data/cache/` (D:). Never on C:.
- Do not edit pipeline outputs by hand; curate through `data/overrides/*.json` and rerun.

## Where things live

- `index.html`, `src/main.js`: boot, routing (`#t/<store>`, `#p/<product>`, `#g/<group>`, `#c` basket, `#s` settings, `?w=<week>`, `?lang=`, `?items=` for a shared basket), keyboard, the render loop.
- `src/app/state.js` (state, prefs, basket in localStorage), `src/app/i18n.js` (es/en strings and formatting), `src/app/stage.js` (what the map shows per mode and week).
- `src/map/map.js`: the SVG stage (d3-geo Mercator fitted to the alcaldías, pan/zoom by hand, dots, rings, halo).
- `src/ui/`: `search.js`, `chrome.js` (legend, scrubber, tooltip, toast, buttons), `cards.js` (store, product, group, basket, settings), `spark.js`, `icons.js`.
- `src/logic/`: pure functions with tests in `tests/`.
- `src/local/prices.js`: the reader's own prices (IndexedDB, export/import).
- `src/data/qqp.js`: loaders for `public/data/`.
- `tools/build-qqp.mjs` (+ `tools/lib/presentation.mjs`): the PROFECO pipeline → `public/data/qqp/` (gitignored, rebuilt weekly by `.github/workflows/pages.yml`). `tools/build-geo.mjs` → `public/data/geo/cdmx.json` (committed).
- `data/overrides/qqp.json`: curation (exclude stores/products, fix coordinates, rename chains).
- `public/sw.js`, `public/manifest.webmanifest`: the PWA.

## Checks before a commit

```bash
npm test
```

```bash
npm run build
```

Then open the dev server (`.claude/launch.json` → `acomo-dev`, port 5175; the pipeline must have run once so `public/data/qqp/` exists) and look at: the city with the index, a product search ("leche"), a group, a store, the basket with two items, the scrubber playing. Phone width too. Claims about layout or timing are verified in the browser pane, measured with `getBoundingClientRect` when numeric, never assumed.

## Conventions

- Commit per feature, message says why. Update `HANDOFF.md` (dated section, newest first) and the relevant doc in the same commit.
- Liberties taken without the owner are listed in `HANDOFF.md` under the round's "Liberties".
- Sub-agents for independent data work get: goal, what is ruled out, files to read, exact output shape, cache location, the rules above, and what to report (counts, a curation list, the citation text). They never commit.
- Pipelines: Node 22, ESM, Node built-ins only, streaming, size guards, one bad row never aborts a run, every output names its source and build date.
