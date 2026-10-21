# PIPELINES.md — how data gets in

A cómo is static. Two pipelines feed it: the **geometry** (slow-changing, committed, rebuilt by hand) and the **prices** (weekly, deploy-time, never committed). Both are Node 22 ESM scripts with no dependencies beyond Node's built-ins (the geometry preview uses d3-geo and sharp, which the app already has). Every output names its source and its build date. Downloads and scratch live under `data/cache/` on D: and are gitignored. Curation never edits an output by hand: it goes into `data/overrides/*.json` and the pipeline runs again.

## Geometry: `npm run geo` → `public/data/geo/cdmx.json` (committed)

`tools/build-geo.mjs` downloads into `data/cache/geo/` and writes one JSON with six GeoJSON FeatureCollections and a `meta` block (sources, licenses, attribution, bbox, build time):

| layer | what | source | license |
|---|---|---|---|
| `alcaldias` | the 16 alcaldías of Ciudad de México, `name` + `key` (CVEGEO) | INEGI, Marco Geoestadístico (web service of the Catálogo Único de Claves Geoestadísticas, entity 09) | Términos de Libre Uso de la Información del INEGI; credit "Fuente: INEGI, Marco Geoestadístico, diciembre de 2025" |
| `zmvm` | 23 Estado de México municipalities of the metro area | same service, entity 15 | same |
| `roads` | 19 arteries a chilango knows (Periférico, Circuito Interior, Viaducto, Insurgentes, Reforma, Tlalpan, Zaragoza, Constituyentes, Eje Central, the highways out of the city…), merged by name, `class` | OpenStreetMap via the Overpass API | ODbL; credit "© OpenStreetMap contributors" linked to openstreetmap.org/copyright |
| `green` | 23 big green areas (Chapultepec, Desierto de los Leones, Ajusco, Tlalpan, Viveros, Cerro de la Estrella, Sierra de Guadalupe, Santa Catarina, Xochimilco…) | OSM / Overpass | ODbL |
| `water` | 12 (Lago de Chapultepec, Xochimilco canals, Texcoco lakes, dams) | OSM / Overpass | ODbL |
| `airport` | AICM and AIFA | OSM / Overpass | ODbL |

WGS84 lon/lat, five decimals, simplified in the script (no library) to keep the file under 300 kB (183 kB on 2026-10-21). The app projects it with d3-geo's Mercator fitted to the alcaldías; `tools/preview-geo.mjs` renders the same projection to `data/cache/geo/check.png` for a human eye. Details, quotes and the retrieved dates: `docs/research/geo-cdmx-2026-10.md`.

Re-run only when a boundary changes (INEGI publishes the Marco Geoestadístico yearly) or a road is missing; commit the new file with its build date. Overpass is a shared free instance: the script sends one query per layer with a descriptive User-Agent and a pause between them; do not loop it.

Known curation items: a park polygon in the south is cut by the download bounding box (a straight edge below Tlalpan/Milpa Alta); Soriana's "MEGA SORIANA" versus "Mercado" formats are a prices-pipeline matter, not geometry.

## Prices: `npm run qqp` → `public/data/qqp/` (deploy-time, gitignored)

Written when the pipeline lands (in flight 2026-10-21). The contract the app already reads is in `src/data/qqp.js` and `docs/VISION.md`; the shapes below are the ones the pipeline must honour.

- `meta.json` — `{ built, source: { name, url, files: [{ name, bytes, retrieved }], license: { name, url } }, city: { id, name, states, municipios }, weeks: [Monday ISO dates], latestDate, counts: { stores, products, groups, observations, storeFiles } }`
- `stores.json` — `[{ id, chain, format, name, address, municipio, state, lat, lon, giro, firstSeen, lastSeen, products, index: { latest, series: [[week, value|null]] } }]`
- `products.json` — `[{ id, group, name, brand, presentation, category, catalog, size: { value, unit, pack? } | null, stores, min, median, max, pacic? }]`, under 700 kB
- `groups.json` — `[{ id, name, category, products, stores }]`
- `products/<id>.json` — `{ id, latest: { storeId: [price, date] }, series: [[week, median, min, max, n]] }`
- `products/<id>.weeks.json` — `{ id, weeks: [last 26], stores: { storeId: [price|null per week] } }`
- `stores/<id>.json` — `{ id, week, items: [[productId, price, date]] }`
- `index.json` — `{ weeks, stores: { storeId: [index|null per week] } }`

The store index for a week is the median, over the products PROFECO saw in that store that week, of (store price ÷ city-wide median of the same product that week); null under 30 products. The app never recomputes it; it reads it.

## Schedule

`.github/workflows/pages.yml`: on every push to `main`, every Tuesday 13:00 UTC, and by hand. `npm test` → `npm run qqp` (with `continue-on-error`, so a PROFECO outage deploys the previous data rather than failing) → `npm run build` → Pages. The RAR cache is kept between runs with `actions/cache`. GitHub disables a public repository's cron after 60 days without repository activity; a commit re-arms it.
