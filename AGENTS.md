# AGENTS.md — A cómo

Read this before changing the app. `docs/VISION.md` says where the product is going and why. `HANDOFF.md` is the state of the code, dated, newest first. `docs/PIPELINES.md` is how data gets in and how to curate it. `docs/EDITORIAL.md` is the rule for words and numbers on a screen. `docs/research/` holds the dated source research (data, geometry, licences, landscape). The owner's general method lives outside the repo in `D:\_GitHub\revamp-playbook.md`; the lessons specific to this repo are under "Gotchas" below.

Owner: Victor (github.com/vdm285). The app opens in Mexican Spanish; English is a setting (`?lang=en` in a link, or Settings), never a second site. Audience: the owner and the owner's friends in Mexico City first; anyone in Mexico later. `CLAUDE.md` imports this file.

## What this is

A static site on GitHub Pages that draws the stores PROFECO surveys in Mexico City and its metro area (558 of the 571 the survey visits: since 2026-10-22 every category, toys, appliances and school supplies included, by the owner's choice; 13 have no coordinates or no prices) on a dark map, with the prices of "Quién es Quién en los Precios" (QQP). The bare address opens on Relieve, the city's prices as 3D columns (`src/opening/`), until the reader chooses the 2D map. PROFECO surveys weekly and publishes monthly, five to nine weeks behind. Three questions, one stage: where is this product cheaper (the map recolours by that price), which store is cheapest for my basket (totals per store), how expensive is this store (its basket index against the city median). A fourth, inherited from the first version: is the price I am looking at good (the reader's own shelf prices, stored only in the browser). A timeline moves the whole map through the weeks against one reference, so prices visibly move.

Name "A cómo" (what a Mexican asks at the shelf; the owner kept it). The repository is `a-como` since 2026-10-22 (it was `compa-precio`): the app lives at https://vdm285.github.io/a-como/, and the old address forwards there from a stub repository named `compa-precio` (see "Renaming" below). The first version (March 2026, one `index.html` with Tailwind from a CDN and mock data) is in git history up to commit `b81c22a`; its README's philosophy survives in `docs/VISION.md`.

## Do not

- Do not add a server, an account, an analytics script, an ad, a paid API, or any key the browser can see. Build-time keys only, in Actions secrets, free tiers only. Today there are none.
- Do not invent a price, a store, a date, a size or a product. Everything shown comes from PROFECO's files or from the reader. When data is missing the UI says why (a quiet ring and a reason in the tooltip).
- Do not call old data recent. "Recent" is `meta.recent` (the last 28 days of data); a chosen week is that week only (`docs/EDITORIAL.md`).
- Do not use the mean. Medians everywhere (`src/logic/stats.js`), and every comparison names its reference.
- Do not compare across units. Label prices with label prices; per-unit only within the group's one unit (`groupUnit` in `src/app/stage.js`, `unit` in `groups.json`).
- Do not ship, commit or publish the owner's March 2026 Walmart scrape (`data/sources/`, gitignored). It is a local parser test corpus only.
- Do not put a wordmark, a title bar or a fixed control on the stage unless it is used constantly. Search, basket, settings, the legend and the timeline are the whole chrome.
- Do not hide or shrink the map to make room: cards overlay the side away from the subject, and the map's free area is measured from the chrome on screen (`applyPadding` in `src/main.js`).
- Do not use a red/green semaphore. One diverging scale (blue cheaper, grey median, red dearer, `src/logic/color.js`), a legend always present. Blue means cheaper and nothing else: the UI accent is a warm neutral.
- Do not use `innerHTML` with data. Everything from the files goes through lit templates or `textContent`.
- Do not write downloads, caches or scratch anywhere but under `data/cache/` (D:). Never on C:.
- Do not edit pipeline outputs by hand; curate through `data/overrides/qqp.json` (`excludeStores`, `excludeProducts`, `excludeCategories`, `fixCoords`, `unplaceStores`, `fixSizes`, `renameChains`) and rerun.

## Where things live

- `index.html`, `src/main.js`: boot, routing (`#t/<store>`, `#p/<product>`, `#g/<group>`, `#c` basket, `#s` settings, `?w=<week>`; `?lang=` and `?items=` are read once and stripped, a shared basket arrives as an offer), history (a card is a history entry), keyboard, the render loop, price tags, the free-area measurement.
- `src/app/state.js` (state, prefs, basket in localStorage, a notification bus that delivers every kind raised in a tick), `src/app/i18n.js` (es/en strings, dates with the year when it is not the data's latest, ranges), `src/app/stage.js` (what the map shows per mode and week: the recent window, the single reference, frozen caps, empty reasons, the timeline curve).
- `src/map/map.js`: the SVG stage (d3-geo Mercator fitted to the store locations, pan/zoom by hand rendered once per frame, dots that snap and separate, labels and tags in screen space).
- `src/ui/`: `search.js`, `chrome.js` (legend, timeline, tooltip, toast, buttons), `cards.js` (store, product with the price strip, group, basket with the chain race, settings), `spark.js`, `icons.js`.
- `src/logic/`: pure functions with tests in `tests/`.
- `src/local/prices.js`: the reader's own prices (IndexedDB, local dates, export/import without duplicates).
- `src/data/qqp.js`: loaders for `public/data/` (content-type checked; an LRU for per-product files).
- `src/opening/`: Relieve, the opening (three.js, loaded in its own chunk only when it shows): `relief.js` (`mountRelief(host, { demo, geo, lang, motion, onExplore })`), `relief.css` (scoped under `.relief`), `strings.js` (es/en). Its data is `public/data/qqp/opening.json`, written by `npm run opening` (`tools/portfolio-data.mjs --json`) after the pipeline. `showOpening` / `closeOpening` in `src/main.js`; the setting "Abrir con el relieve".
- `tools/build-qqp.mjs` (+ `tools/lib/presentation.mjs`): the PROFECO pipeline → `public/data/qqp/` (gitignored, rebuilt on every deploy). `tools/mirror-qqp.mjs`: refreshes the byte-for-byte mirror of PROFECO's archives on the `qqp-mirror` release (run from a network in Mexico). `tools/check-qqp.mjs`: the data contract. `tools/build-geo.mjs` → `public/data/geo/cdmx.json` (committed); `tools/preview-geo.mjs` renders it. `tools/shots.mjs`: scripted screenshots; `tools/smoke.mjs`: scripted flows. `tools/build-icons.mjs`: the PWA icons.
- `public/sw.js` (stamped per build by `vite.config.js`), `public/manifest.webmanifest`: the PWA.

## Checks before a commit

After the pipeline (`npm run qqp`), write the opening's data once:

```bash
npm run opening
```

```bash
npm test
```

```bash
npm run check
```

```bash
npm run build
```

Then with the dev server up (`.claude/launch.json` → `acomo-dev`, port 5175; the pipeline must have run once so `public/data/qqp/` exists):

```bash
node tools/smoke.mjs
```

```bash
npm run shots
```

and read the captures in `data/cache/shots/` by eye: the city, a product, a past week, a group, a store, the basket, settings, and the phone states. Claims about layout or timing are measured (`getBoundingClientRect`, counts in the DOM), never assumed.

## Gotchas (each one cost time)

- **PROFECO blocks GitHub's runners**: `datos.profeco.gob.mx` answers 404 to them. CI downloads the mirror (`qqp-mirror` release) and verifies sha256; refresh it monthly from Mexico with `npm run qqp:mirror`.
- **Git Bash rewrites a leading slash**: `VITE_BASE=/a-como/` becomes `/Program Files/Git/a-como/`. Use `MSYS_NO_PATHCONV=1` for a local base-path build and grep `dist/index.html`.
- **The Vite dev server answers a missing JSON with `index.html` and 200**: loaders check the content type.
- **Building while the pipeline writes `public/data/`** fails with a copy error; wait for the run to finish.
- **Heredocs with backticks break in this shell** (and a long quoted heredoc can fail too): write scripts with the file-writing tool to `data/cache/patches/` and run them by path; for code edits, write old/new blocks to a text file and run `node tools/apply-patch.cjs <file>` (no escaping; each old text must match once; nothing is written unless every block applies).
- **d3-geo's `geoContains` is spherical and slow**: never call it per frame or per zoom level. The alcaldía labels use a raster of each shape built once in world space (`maskOf` in `src/map/map.js`).
- **The phone sheet animates its height for 280 ms**: anything that leaves `sheet-full` goes through `leaveFullSheet` / `settleSheet` in `src/main.js`, which measure after the transition.
- **The browser pane's screenshots time out when the window is behind**: use `npm run shots` (puppeteer-core with the installed Chrome) for exact viewports; with an emulated viewport, click coordinates are in the screenshot's frame.
- **Size caps are bytes on the wire** (Pages serves gzip): products.json is ~1,250 kB raw, ~160 kB gzip with every category; the checker fails above 2,200 kB raw.
- **The opening covers the bare address**: scripted checks of the 2D app turn it off first (`acomo.prefs.opening = false` via `evaluateOnNewDocument`, as `tools/smoke.mjs` and `tools/shots.mjs` do), or they wait on an overlay that never goes.
- **Chrome profiles under `data/` crash Vite's watcher**, so the config ignores `data/**`. A dev server another agent started can keep serving stale modules after its watcher dies (a "does not provide an export" error for an export that exists): start your own on another port (`npx vite --port 5176 --strictPort`) rather than killing theirs.
- **Puppeteer's offline mode does not reach the service worker**: the worker keeps fetching from the live server. Test offline by stopping the server after a warm visit, with a persistent profile under `data/cache/`.
- **Pointer capture retargets the release**: after `setPointerCapture`, `pointerup` targets the capturing element, so record what was pressed at `pointerdown` (the map's price tags).
- **`page.focus()` refuses SVG elements** in puppeteer; focus from page script.
- **The origin `vdm285.github.io` is shared** with the owner's other Pages apps (Papelito at `/papelito/`, others), and caches belong to the origin, not to a path: the service worker deletes only its own superseded caches (`acomo-shell-*` other than the current one, and two retired names), never "everything that is not mine". Until 2026-10-22 it did, and every deploy wiped the other apps' offline copies. Entries in the shared-by-name `acomo-boot` and `acomo-data` are told apart by path (`SCOPE`). Giramundo's and Tabla Viva's workers still delete every cache that is not theirs (2026-10-22): an offline start can fail after one of their deploys until they are fixed.
- **Pages answers every file with `Cache-Control: max-age=600`** and an ETag that changes on every deploy (so across a deploy a revalidation is a full download, never a 304, changed file or not): for ten minutes a plain `fetch()` gets the browser's HTTP cache copy, the previous deploy's `index.html` and data included. The service worker's install, its navigations and its boot data fetch with `cache: 'no-cache'`; until 2026-10-22 they did not, and a deploy could leave a blank page (HANDOFF.md). A test server for the worker must send Pages' headers: `Cache-Control: max-age=600`, an `Expires` 600 s ahead, `Last-Modified` at the deploy's time, an `ETag` that changes on every deploy, a 304 on a matching `If-None-Match`, gzip with `Vary: Accept-Encoding`, and a 404 (`text/html`) without `Cache-Control`. One that sends `no-cache`, as `vite preview` does, hides the bug.
- **lit**: never remove DOM that lit rendered; key forms by subject (`keyed`) so a typed value never carries to the next product.

## Renaming

The app name changes in: `src/app/i18n.js` (`appName`) and `src/opening/strings.js` (`brand`), `index.html` `<title>`, `public/manifest.webmanifest`, the veil in `src/main.js`, README and docs titles, `package.json` `name`.

The repository was renamed `compa-precio` → `a-como` on 2026-10-22, and the address moved from https://vdm285.github.io/compa-precio/ to https://vdm285.github.io/a-como/ (GitHub does not forward Pages addresses). What changed: `VITE_BASE` in `.github/workflows/pages.yml` now comes from the repository's name (`GITHUB_REPOSITORY`), and the step fails when `dist/index.html` does not load its assets from that base; the Live URL and the mirror link in README and `docs/PIPELINES.md`; the code link in `src/ui/cards.js`; both User-Agents (`tools/build-qqp.mjs`, `tools/build-geo.mjs`); `SOURCE.mirror` and `tools/mirror-qqp.mjs` (the `qqp-mirror` release moved with the repository: `github.com/vdm285/a-como/releases/download/qqp-mirror/`); the portfolio's "Explorar el mapa" link. The old address is served by a separate stub repository named `compa-precio` (a forwarding `index.html` and `404.html`, a `sw.js` that retires the old worker, see `HANDOFF.md`); creating it ends GitHub's own redirects for `github.com/vdm285/compa-precio/...` (release downloads included), so nothing may depend on those URLs. Dated records (`docs/research/`, `docs/history/`, HANDOFF's older sections) keep the old name. The local folder `D:\_GitHub\CompaPrecio` keeps its name: sessions and memory are tied to the path.

A future rename of the repository: the workflow needs no edit; change the URLs above (grep for the old name), add a stub at the old address the same way, and check the mirror's URL. Do not change: the localStorage keys (`acomo.*`) and the IndexedDB name (`acomo`): readers' own prices live there; the store and product id formats (own prices are keyed by them); the cache names in `public/sw.js` (`acomo-shell-<version>`, `acomo-boot`, `acomo-data`).

## Conventions

- Commit per feature, message says why. Update `HANDOFF.md` (dated section, newest first) and the relevant doc in the same commit.
- Liberties taken without the owner are listed in `HANDOFF.md` under the round's "Liberties", with the one-line reversal.
- Sub-agents for independent data work get: goal, what is ruled out, files to read, exact output shape, cache location, the rules above, and what to report (counts, a curation list, the citation text). They never commit.
- Pipelines: Node 22+, ESM, Node built-ins only, streaming, size guards, one bad row never aborts a run, every output names its source and build date.
