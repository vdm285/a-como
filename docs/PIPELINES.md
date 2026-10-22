# PIPELINES.md — how data gets in

A cómo is static. Two pipelines feed it: the **geometry** (slow-changing, committed, rebuilt by hand) and the **prices** (weekly, deploy-time, never committed). Both are Node 22 ESM scripts with no dependencies beyond Node's built-ins (the geometry preview uses d3-geo and sharp, which the app already has). Every output names its source and its build date. Downloads and scratch live under `data/cache/` on D: and are gitignored. Curation never edits an output by hand: it goes into `data/overrides/*.json` and the pipeline runs again.

## Geometry: `npm run geo` → `public/data/geo/cdmx.json` (committed)

`tools/build-geo.mjs` downloads into `data/cache/geo/` and writes one JSON with six GeoJSON FeatureCollections and a `meta` block (sources, licenses, attribution, bbox, build time):

| layer | what | source | license |
|---|---|---|---|
| `alcaldias` | the 16 alcaldías of Ciudad de México, `name` + `key` (CVEGEO) | INEGI, Marco Geoestadístico (web service of the Catálogo Único de Claves Geoestadísticas, entity 09) | Términos de Libre Uso de la Información del INEGI; credit "Fuente: INEGI, Marco Geoestadístico, diciembre de 2025" |
| `zmvm` | 23 Estado de México municipalities: the 19 of the metro area named in the brief plus 4 rural ones the script adds because they touch Ciudad de México (Juchitepec, Tianguistenco, Ocoyoacac, Xalatlaco); Zumpango, which the price pipeline counts as metro, is not drawn (PROFECO surveys no store there) | same service, entity 15 | same |
| `roads` | 19 arteries a chilango knows (Periférico, Circuito Interior, Viaducto, Insurgentes, Reforma, Tlalpan, Zaragoza, Constituyentes, Eje Central, the highways out of the city…), merged by name, `class` | OpenStreetMap via the Overpass API | ODbL; credit "© OpenStreetMap contributors" linked to openstreetmap.org/copyright |
| `green` | 22 big green areas (Chapultepec, Desierto de los Leones, Ajusco, Tlalpan, Viveros, Cerro de la Estrella, Sierra de Guadalupe, Santa Catarina, Xochimilco…) | OSM / Overpass | ODbL |
| `water` | 12 (Lago de Chapultepec, Xochimilco canals, Texcoco lakes, dams) | OSM / Overpass | ODbL |
| `airport` | AICM and AIFA | OSM / Overpass | ODbL |

WGS84 lon/lat, five decimals, simplified in the script (no library) to keep the file under 300 kB (167,751 bytes on 2026-10-21). The app projects it with d3-geo's Mercator fitted to the store locations (not the alcaldías: the south is forest without a store and 91 stores lie north of the alcaldías' box). The geo research recommends a conic equal-area projection; at the scale of one metro area the difference is under one percent and Mercator keeps north up with straight arteries, so it stays; `tools/preview-geo.mjs` renders the same projection to `data/cache/geo/check.png` for a human eye. Details, quotes and the retrieved dates: `docs/research/geo-cdmx-2026-10.md`.

Re-run only when a boundary changes (INEGI publishes the Marco Geoestadístico yearly) or a road is missing; commit the new file with its build date. Overpass is a shared free instance: the script sends two queries per build (roads, then areas) with a descriptive User-Agent and a pause between them, and caches them on disk; do not loop it.

Known curation items: a park polygon in the south is cut by the download bounding box (a straight edge below Tlalpan/Milpa Alta); Soriana's "MEGA SORIANA" versus "Mercado" formats are a prices-pipeline matter, not geometry.

## Prices: `npm run qqp` → `public/data/qqp/` (deploy-time, gitignored)

`tools/build-qqp.mjs` (built-ins only; 6 to 8 minutes and under 1.5 GB of memory from the cached archives) writes the files below; `tools/check-qqp.mjs` (`npm run check`) enforces this contract and fails the deploy when it breaks. The loaders are in `src/data/qqp.js`; the facts and every rule's reasoning are in `docs/research/profeco-qqp-2026-10.md` (§11–§12, §20 for the recent window).

**"Recent"** is the last 28 days of data, ending on `latestDate` (`meta.recent`). A store's price is recent when its latest observation of the product falls in that window; nothing older counts as a current price. `products.json` and `groups.json` summarise the recent window; the per-product and per-store files keep every store's latest observation with its date, and the app filters them with `date >= recent.from`.

- `meta.json` — `{ built, source: { name, url, dataset, files: [{ name, bytes, retrieved, via, sha256 }], mirror, license: { name, url } }, city: { id, name, states, municipios }, weeks: [Monday ISO dates], latestDate, recent: { from, to, days: 28 }, weekInfo: [{ week, days, observations, stores, partial }], partialWeeks: [week], counts: { stores, products, groups, observations, storeFiles, pacic }, rules }`. `recent.to` = `latestDate`, `recent.from` = `to` − 27 days. `weekInfo` is aligned with `weeks`: distinct survey dates, rows, stores; `partial` when the week's rows are under half the median week's (the last week of a monthly file often holds one day; Christmas weeks are light). Partial weeks stay in the data; the app labels them. `source.dataset` is the datos.gob.mx record that states the licence, for the newest year in the build (`programa_quien_es_quien_precios_<year>`); `license.url` is the CC BY 4.0 deed. `rules` records the build rules, including `fixSizes`, the number of curated sizes applied.
- `stores.json` — `[{ id, chain, format, name, address, municipio, state, lat, lon, giro, firstSeen, lastSeen, products, recentProducts, lastVisitProducts, index: { latest, latestWeek, series: [[week, value]] } }]`. `products` = products ever recorded there (data range); `recentProducts` = those with an observation in the recent window; `lastVisitProducts` = those recorded on `lastSeen`; `index.latestWeek` = the week of `index.latest` (null with it).
- `products.json` — `[{ id, group, name, brand, presentation, category, catalog, size: { value, unit, pack? } | null, stores, storesAll, min, median, max, asOf, last, pacic? }]`. `min`/`median`/`max` are over one price per store, its latest observation inside the recent window; `stores` is how many stores that is (n); `asOf` the newest of those dates. A product nobody recorded in the window has `min`/`median`/`max`/`asOf` null and `stores` 0 ("sin precio reciente"); `storesAll` counts the stores that ever had it in the data range and `last` is its newest observation anywhere (equal to `asOf` when there is one). Cap 1,400 kB raw (about 200 kB gzip; the budget is bytes on the wire), checked by `tools/check-qqp.mjs`; it was 700 kB until 2026-10-21. Nothing is excluded to fit: if the file grows past the cap, the check fails and a human decides.
- `groups.json` — `[{ id, name, category, products, stores, storesAll, unit }]`. `products` = its members in `products.json`; `stores` = stores with a recent observation of any member, `storesAll` = ever. `unit` is decided once for the group: the dimension most members share (g, ml or pza; ties in that order) and, within it, the median member size: ml → `l` from 700 ml, else `100ml`; g → `kg` from 700 g, else `100g`; pza → `pza`; null when no member has a size.
- `products/<id>.json` — `{ id, latest: { storeId: [price, date] }, series: [[week, median, min, max, n]] }`
- `products/<id>.weeks.json` — `{ id, weeks: [last 26], stores: { storeId: [price|null per week] } }`. Every file covers exactly `meta.weeks.slice(-26)` (the check enforces it, so the timeline and the files never disagree); cap 72 kB raw. A 40 kB cap had silently halved the busiest products (tortilla kept 13 weeks) until 2026-10-21.
- `stores/<id>.json` — `{ id, week, items: [[productId, price, date]] }`
- `index.json` — `{ weeks, stores: { storeId: [index|null per week] } }`
- `visits.json` — `{ weeks: [same as meta.weeks], stores: { storeId: [products recorded that week, 0 when none] } }`, minified, every store in `stores.json` (132 kB raw, 34 kB gzip on 2026-10-21). For the survey-rhythm animation.

The store index for a week is the median, over the products PROFECO saw in that store that week, of (store price ÷ city-wide median of the same product that week). A product enters only when at least 3 stores reported it that week (`INDEX_MIN_STORES`, `rules.indexMinStores`): with one or two, the city "median" is the store's own price and the ratio pulls the index toward 1. Null under 30 such products (`INDEX_MIN_PRODUCTS`). The app never recomputes it; it reads it.

### Curation (`data/overrides/qqp.json`)

Read first by the pipeline; every key is optional and keyed by the ids the pipeline prints (store and product ids are explained in the research doc, §12). The file's `notes` say why each entry is there; add a sentence there with every new entry.

- `excludeStores`, `excludeProducts`: ids left out of the build.
- `excludeCategories`: CATEGORÍA labels to leave out (compared without accents or case). The city leaves none out since 2026-10-22 (the nine non-grocery categories were out until then); a category added here leaves the build.
- `unplaceStores`: `{ "<storeId>": "why" }`, stores whose PROFECO point is provably another store's (the same coordinates as a store in another municipio, outside their own). They keep their prices and cards, get `lat`/`lon` null and `unplaced: true` in `stores.json`, and the app draws no dot for them; the check fails if an unplaced store has coordinates. On 2026-10-21: five stores (Mega Soriana la Viga, three public markets sharing one point in Iztacalco, Tortillería Lupita). Thirteen stores fall outside their stated municipio. Of the other eight, two are within 200 m of the border (generalised geometry can explain that), and six are 1 to 8.5 km away from it (Walmart Perinorte, Bodega Aurrera Fuentes del Valle, Tortillería Lulu, Tortillería Ricky, Soriana Hiper Mixcoac, Farmacias del Ahorro Contreras); none shares another store's point, so the data cannot tell whether the point or the municipio is wrong, and they stay as published until someone checks them on the ground or in another source. `npm run coords` (`tools/check-coords.mjs`) lists them, with the distance to the border, after any rebuild.
- `fixCoords`: `{ "<storeId>": [lat, lon] }`, only when the right position is certain from the data itself (a lost minus sign); a store without a usable position has no dot and is left out until then.
- `fixSizes`: `{ "<productId>": { "value": n, "unit": "g" | "ml" | "pza", "pack"?: n, "why": "…" } }` replaces the size parsed from PRESENTACIÓN; `value` is the package total, `pack` the number of units when it is a multipack. It is applied right after parsing, before any per-unit price, group unit or ranking, so the fix reaches `products.json`, `groups.json` and the app alike. Use it only when the label states the size and the parser misreads it; a pattern that recurs belongs in `tools/lib/presentation.mjs` with a test instead. Each run lists what it applied in `data/cache/qqp/report-cdmx.json` (`sizesFixed`: id, presentation, parsed, fixed, why; `fixSizesUnused` for ids no longer in the build, also a warning) and counts it in `meta.json` → `rules.fixSizes`. On 2026-10-21: `lagricel-ofteno-b7bc82` (4 sobres × 5 ampolletas × 0.5 ml = 10 ml, pack 20; parsed 0.5 ml) and `biometrix-8c6488` (2 cajas × 30 cápsulas = 60, pack 2; parsed 30).
- `renameChains`: `{ "<CADENACOMERCIAL label>": { "chain", "format" } }`, the brand a shopper says and PROFECO's format label. Two labels with the same format are one store, so changing a `format` changes the ids of its stores (the reader's own prices are keyed by store id).

## The opening's data: `npm run opening` → `public/data/qqp/opening.json` (deploy-time)

`tools/portfolio-data.mjs --json` computes, from the pipeline's outputs, what Relieve (the opening, `src/opening/`) draws: the placed stores as `[name, chain, kind, lat, lon]`, the jitomate (`jitomate-3532af`) and tortilla (`tortilla-de-9688d0`) blocks with each store's last 26 weekly prices, the recent reference and the city's weekly series, and two stories computed on matched stores (the jitomate since its dearest week; the tortilla kilo by kind of store). About 110 kB raw. It runs after `npm run qqp` and before `npm run check`, which checks it. Without the flag the same tool writes `docs/portfolio/demo-data.js` for the portfolio demos.

## The mirror (why CI does not download from PROFECO)

`datos.profeco.gob.mx` answers 404 to GitHub's runners (US addresses; measured 2026-10-21, research doc §19) while it serves the same files to a home connection in Mexico. The yearly archives are therefore mirrored byte for byte as assets of the release [`qqp-mirror`](https://github.com/vdm285/a-como/releases/tag/qqp-mirror), with `mirror.json` (bytes, sha256, the date PROFECO was accessed, the source URL). The pipeline tries PROFECO first and falls back to the mirror, verifying the checksum; an error page never replaces a cached archive (every download must start with the RAR signature), and the current year's archive is re-fetched when the cached copy is older than six days.

To refresh the data, from any network in Mexico, about once a month (PROFECO publishes monthly):

```bash
npm run qqp:mirror
```

It downloads the archives that changed, uploads them with the new index (needs `gh` logged in with write access), and the next scheduled build (or a manual run of the Pages workflow) deploys them. If nobody refreshes the mirror, the site keeps working and shows the date of its latest week.

## Schedule

`.github/workflows/pages.yml`: on every push to `main`, every Tuesday 13:00 UTC, and by hand. `npm test` → install `libarchive-tools` → `npm run qqp` (PROFECO, else the mirror) → `npm run check` (the contract in this file) → `npm run build` → Pages. There is no `continue-on-error`: if the data cannot be built or breaks the contract, the job fails and the previous deployment stays live. Only the archives are cached between runs (`data/cache/qqp/raw`); the extracted CSVs are several GB and are rebuilt. GitHub disables a public repository's cron after 60 days without repository activity; a commit or a mirror refresh followed by a manual run re-arms it.
