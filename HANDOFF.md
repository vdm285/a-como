# Handoff

The state of the code, dated, newest first. `docs/VISION.md` is the plan; this file is what exists. Read `AGENTS.md` first.

## 2026-10-21 — the rebuild, first unguided stretch (in progress)

### The decision

Overhaul from scratch, mining the first version for parts. Kept: the README's philosophy (zero friction, the spreadsheet test, data sovereignty, hard code in production and AI in the workshop) and its event-log idea for the reader's own prices. Replaced: the one-file Tailwind prototype (mock data, nothing saved, injection via `innerHTML`, a size parser that read "12 latas 355 ml" as 12 litres, mean-based colours), the Colab Walmart scraper (its output cannot be published), and the September draft docs that proposed merging into ListoLista (the merge is a question card, not a given). The old files are in git history (`b81c22a` and before); `docs/history/readout-2026-09-25.md` is the previous session's readout, kept as the honest record.

The new data source is PROFECO's weekly "Quién es Quién en los Precios" open data (every monitored store with coordinates, weekly label prices since 2015). The new stage is a map of the city. See `docs/VISION.md`.

### What exists (code)

- Vite 6 + lit 3 + d3-geo, one font (Manrope, self-hosted), no CDN, no key. Build: ~110 kB JS (40 kB gzip), 21 kB CSS.
- `src/map/map.js`: SVG stage, Mercator fitted to the alcaldías with side padding for the card, pan/zoom (wheel, drag, pinch, double-click), store dots, own-price rings, selection halo, alcaldía labels that fade when zoomed.
- `src/app/stage.js`: the four stage modes (index, product, group, basket) with the week axis; `src/logic/*` pure functions (median, deviation, cap, units, OKLab diverging colour, basket totals) with tests (`npm test`, 8 passing).
- `src/ui/*`: search with keyboard, five cards (store, product, group, basket, settings), legend, scrubber with play, tooltip, toast, sparkline.
- `src/local/prices.js`: own prices in IndexedDB (localStorage fallback), export JSON/CSV, import.
- PWA: `public/sw.js` (shell cache-first, data network-first capped at 400 product files), manifest. Icons PNG not yet generated (only the SVG).
- `.github/workflows/pages.yml`: weekly cron (Tuesdays 13:00 UTC), `npm run qqp` with `continue-on-error`, Pages deploy. Not yet enabled on the repo (Pages source must be switched to Actions).

### In flight (sub-agents, started 2026-10-21 afternoon)

1. PROFECO QQP: download 2025 + 2026 archives to `data/cache/qqp/`, inspect, write `tools/build-qqp.mjs` + `tools/lib/presentation.mjs` + tests + `data/overrides/qqp.json` + `docs/research/profeco-qqp-2026-10.md`, run it for CDMX. Output shape is fixed in `docs/PIPELINES.md` (to be written from the result).
2. Geometry: `tools/build-geo.mjs` → `public/data/geo/cdmx.json` (alcaldías, metro municipalities, major roads, green, water, airport; < 300 kB) + `docs/research/geo-cdmx-2026-10.md`.
3. Landscape and licenses: `docs/research/landscape-2026-10.md`, `docs/research/licenses-2026-10.md`.

### Not yet verified

Nothing has been seen in a browser with real data yet. The app boots to the loading veil and reports the missing files. Everything under "What exists" is by construction until the self-audit loop runs.

### Liberties (declared, the owner decides later)

- The product itself: a city map as the stage, PROFECO's open data as the source, the reader's prices as a layer. The old brief said "record your own prices"; this keeps it and adds the official layer above it.
- Working name **A cómo**. Shortlist with a line each: **Mandado** (the grocery run; warm, one word, but says nothing about prices), **Compa Precio** (the current repo name; friendly, a bit bland), **Peras con peras** (the thesis, too long for a title), **Quién da menos** (echoes PROFECO's "Quién es Quién"), **Canasta** (generic), **La Báscula** (weighing options; a stretch). The repository name stays `compa-precio` until the naming card.
- One diverging colour scale (blue cheaper, grey median, red dearer) instead of the first version's green/red; the legend is always present.
- Medians everywhere; the store index formula (median of price ratios, 30-product minimum).
- Dark theme only. A light theme is a later toggle if wanted.
- No product photographs in this checkpoint (no legal matched source yet); no community prices; no postal-code radius (the map replaces it).
- The Walmart scrape stays local as a parser test corpus and is never shipped.
- English via a setting and `?lang=en`, not a second site (per the playbook).
- Desktop first; the phone layout is a bottom sheet, built but not yet polished.
- The folder on disk keeps the old name `CompaPrecio`; renaming the folder is paired with the naming decision.
