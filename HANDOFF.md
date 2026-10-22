# Handoff

The state of the code, dated, newest first. `docs/VISION.md` is the direction; this file is what exists. Read `AGENTS.md` first.

## 2026-10-22, small hours — third self-audit round landed

### State in one paragraph

Round 3 ran against the live site with five fresh reviewers (phone, language, honesty of the numbers, desktop polish, accessibility): 91 measured findings, about a dozen of them the same defect seen from two sides. Nearly all are fixed (commits `079c98e`, `abe4915` and the docs after them). The biggest: one "revísalo" rule decided per stage and symmetric (2.5 times or 0.4 times the median of the stage's own comparison set), ties said as ties, a week's own figure only from 3 stores, a peak only where the line moves, five stores whose PROFECO point is another store's no longer drawn (their prices kept), the 1024 px and phone layouts measured in the right order, and the map, rows and slider reachable and audible by keyboard. Bundle: 181 kB JS / 65 kB gzip.

### What the round found and what changed

| Found (measured) | Fixed by |
|---|---|
| The store card flagged 93 April jitomate prices that the product card showed as normal for that week; a −79 % price was crowned the cheapest; the tooltip and tags never showed the flag | `v.far` decided once in `stage.js` against the stage's comparison set; symmetric ratio rule in `logic/stats.js` (`isFar`, unit-tested) read by every surface |
| 48 % of products have a tie for the lowest price; the hero named one store by file order | "la más barata, empatada en N tiendas" |
| A "mediana de la ciudad" printed large from one store; "1 tiendas" | Week figures need 3 stores; singular strings |
| "pico $14.90" on a flat line; a peak from one store or a light week | Peak only from solid weeks, only when the line moves; scale from the median line |
| A generic product opened from a link kept the 0.2 cap of its empty boot pass (59 % of stores saturated) | Caps memoised only from a real sample |
| Five stores drawn on another store's point (another municipio) | `unplaceStores` override; `npm run coords` lists the eight others outside their municipio (two within 200 m of the border, six 1–8.5 km off; left as published) |
| 1024 px: 146 dots under the stacked timeline; the chip under a left card; the numeral over the city | Padding measured in order with a second pass; stacked layout with a compact timeline and one-line numeral |
| Phone: 92 px of map at 360x640 with a card; numeral over half the stores; dates cut from rows; no way to recentre | Timeline folded while a card is open; draggable sheet (peek, full); numeral in the padding; two-line rows with the date beside the price; reset button kept |
| Row link names dropped "falta 1" and "revísalo"; the slider never said the week's price; undo unreachable by keyboard in 6.5 s; focus fell to the body | Names from visible content; week value in the slider and announced; undo takes focus and waits; focus fallbacks |
| "en la mediana que la mediana", "menos de 30 productos en la visita" beside "57 productos", "últimos 28 días" two months after the data, "puestos" for supermarkets, English "milk" found no milk | Wording fixed in both languages; English synonyms for the basics in search |
| The own-price select preselected a store that does not sell the product | Options say whether they are selected (a property set before the options existed) |

Not done this round: the min–max band could become an interquartile band (needs the pipeline's series to carry quartiles); `lang="es"` spans for Spanish data names in English mode; a camera move to frame a product sold in only a handful of stores (they are tagged instead).

### Verified, and how

- `npm test` 110/110; `npm run check` exit 0 on the rebuilt data (5 unplaced, 0 warnings); `node tools/smoke.mjs` 50/50 against a fresh dev server (7 new checks pin this round).
- Screenshots read by eye: desktop 1600, 1366 and 1024 (product week, store card on the left, basket with no common store), phones 375x812, English week view.

### Liberties added in this round

- **The flag rule** changed from "±150 %" to "2.5 times or 0.4 times" (symmetric); EDITORIAL says so.
- **Stores without a dot** when PROFECO's point is provably another store's; their card says why.
- **Price tags**: two when the free map is under 700 px wide; all of them when five or fewer stores have a price.

## 2026-10-21, late night — second self-audit round landed

### State in one paragraph

Round 2 of the self-audit is applied and pushed (commits `140b7a5` to `41af9b7`). The app keeps the same stage and modes; what changed is how honestly and how comfortably it speaks. Comparisons need three stores or they are not drawn; the index is asked as a question and answered in words; product, generic product and basket cards share one grammar; the timeline is drawn in real pixels over every week of the data, with the week's city value printed large over the map; the map works by keyboard and its price tags open their store; a first visit can start offline, and "offline" is never shown as "not in PROFECO's data". Bundle: 170 kB JS / 61 kB gzip, 33 kB CSS / 10 kB gzip.

### The self-audit (round 2)

Fresh reviewers measured the round-1 app; about 65 findings. The ones that changed something:

| Found (measured) | Fixed by |
|---|---|
| A store's weekly index divided by a "city median" taken from one or two stores, i.e. its own price | Pipeline: a product enters the index only when 3 stores reported it that week (`INDEX_MIN_STORES`) |
| The 40 kB weekly-file cap had halved busy products (tortilla: 13 weeks of 26) | Cap 72 kB; the check requires every weekly file to cover `meta.weeks.slice(-26)` |
| A per-litre price computed from a size in grams in mixed groups; basket weeks summed by position across files that start on different weeks | `perUnit` checks the dimension (`DIM`); `basketAtWeek` matches by date; tests for both |
| Chips and colours from a reference of one or two stores | Gating at 3: neutral grey dots, no chips, the legend says why |
| In the April jitomate spike, cheap prices for that week were flagged "revísalo" against the August median | The flag asks about the price's own comparison set (that week, in a chosen week); the map's tags likewise |
| Each card had its own layout; the product hero was a median while the list started with the cheapest | One grammar: cheapest store first, reference named once, the strip, the list |
| The timeline SVG stretched with its box; 26 weeks only; "Reciente" an SVG shape | Drawn at its measured width over all 88 weeks, older ones shaded, peak and recent annotated, a real button, keys for weeks, months, first, last; folded into a chip on the index |
| In a dear week every dot is the same red and the size of the change is lost | The week's city value in large type over the map |
| The map was unreachable by keyboard; price tags guessed their width and could not be clicked; labels sat over dots and chrome | Arrow-key navigation with announcements, Enter, + − 0; measured tags placed off the chrome and off coloured dots, clickable; labels under the dots |
| Offline errors sent the reader to the city as if the data were gone; a first visit could not start offline | Precache of assets and boot data at install; offline replies marked; a distinct message; the link kept |
| Settings forgot the card beneath; closing pushed new history; no undo; Enter during catalogue load did nothing; results not announced | All fixed; undo for own-price delete and basket clear |
| The chain race's dots stretched into ellipses on a phone; strip labels hidden under stacked dots | HTML race positioned in percent; symmetric stacks in taller rows |

Kept for later: the group card still fetches one file per member; stores.json still carries each store's index series; the weekly cron still dies after 60 days without a commit.

### Verified, and how

- `npm test` 109/109; `npm run check` exit 0 on the rebuilt data (5,237 files, 54.6 MB).
- `node tools/smoke.mjs` 42/42 against a fresh dev server, including map keys, a tag click, undo, Settings returning to its card, the pixel timeline and the week numeral.
- `tools/shots.mjs` captures at 1600×900 and 375×812 read by eye, twice (before and after the strip, flag and timeline fixes), plus English on a past week and Settings.
- Offline on a production build: warm visit, server stopped, cold start drew all 412 locations (200 coloured) from the precache; a never-fetched product showed "todavía no se ha descargado en este dispositivo" and kept its link.

### Not verified

- A real phone and Safari; English beyond the product, week and Settings views; the Tuesday cron's first scheduled run.

### Liberties added in this round

- **Index rule**: 3 stores per product per week, on top of 30 products per store (fewer stores now have an index some weeks).
- **The index renamed** for the reader ("¿Qué tan cara es cada tienda?", "3 % más cara"); "índice" stays in the method note.
- **The week numeral** over the map and **the folded timeline** on the index.

### Next

1. Done the same night: the showpiece portfolio (`docs/portfolio/`, three demos of how the app could open), built, reviewed adversarially and fixed by sub-agents, read in full and published as private artifacts for the owner: Respira https://claude.ai/artifact/A7GHaUhcyZgWe29Z8rxepq, Relieve https://claude.ai/artifact/UBFtXeq1N1fmgY2dHdbkW9, Portada https://claude.ai/artifact/XyKBwWehvCFJGezSkxwW98. Republish by publishing the same files again (`demo-data.js` travels as a supporting file); regenerate it with `node tools/portfolio-data.mjs` after any pipeline rule change.
2. Round 3 of the self-audit against the live site, then the checkpoint: live link, decisions, liberties, the name shortlist (below, unchanged), question cards.

## 2026-10-21, night — first self-audit round landed; live on Pages

### State in one paragraph

A cómo is live at https://vdm285.github.io/compa-precio/ (GitHub Pages from the Actions workflow; the March 2026 prototype is gone from `main`, still in history). The stage is an SVG map of Mexico City and its metro area with 412 dot locations for the 499 food stores PROFECO surveyed; data covers 2024-12-30 to 2026-08-31 (88 weeks), recent window 4–31 Aug 2026. Four stage modes (basket index, one product, a generic product per unit, the reader's basket), a timeline over the last 26 weeks that colours every week against the recent median, five cards, own prices in IndexedDB, Spanish with English as a setting, a versioned service worker. Each deploy rebuilds the data from PROFECO's archives, which CI reads from a byte-for-byte mirror on the `qqp-mirror` release, because PROFECO answers 404 to GitHub's runners.

### What exists

- **App** (`src/`, ~149 kB JS / 54 kB gzip, 30 kB CSS / 9 kB gzip, one self-hosted font): see AGENTS "Where things live". The time model, the single reference per stage, the frozen colour cap and the empty-dot reasons are in `src/app/stage.js`'s header comment.
- **Prices pipeline** (`tools/build-qqp.mjs`): 22.7 million national rows streamed, 7.8 million for the metro area, 54.5 MB of output in 5,237 files; recent medians from a median of 66 stores; light weeks flagged (2024-12-30, 2025-12-22, 2025-12-29, 2026-08-31); `visits.json` for the survey's rhythm; curation in `data/overrides/qqp.json` (67 chain labels, 2 coordinate fixes, 2 size fixes).
- **Geometry** (`public/data/geo/cdmx.json`, 168 kB, committed): INEGI alcaldías and municipalities, 19 OSM arteries, 22 green areas, 12 water bodies, 2 airports.
- **Mirror**: release `qqp-mirror` holds `QQP_2025.rar`, `QQP_2026.rar` and `mirror.json` (sha256, the PROFECO access date 2026-10-21). Refresh: `npm run qqp:mirror` from a network in Mexico.
- **CI**: `.github/workflows/pages.yml` on push, Tuesdays 13:00 UTC and by hand: tests → bsdtar → pipeline (PROFECO, else mirror) → contract check → build → Pages. A failure publishes nothing. First green run: 39699189226 (3.5 min).
- **Checks**: `npm test` 108/108 (logic, state, parser); `npm run check` exit 0; `node tools/smoke.mjs` 30/30; `npm run shots` 17 captures.

### The self-audit (round 1)

Seven reviewers (visual, flow, honesty, performance, docs, phone, ambition) each measured the live dev app with their own puppeteer scripts (`data/cache/audit/<dimension>/`), 95 findings; two sceptics per finding were then asked to refute each one against the code. All seven reviewers ran out of quota on the first attempt (the Fable limit) and returned nothing; the round was rerun on Opus 5.5. What it found and what changed:

| Found (measured) | Fixed by |
|---|---|
| Default view mixed prices up to 20 months old under the label of the last week; products.json medians came from a one-day stub (352 from one store) | The recent window (`meta.recent`, 28 days) in the pipeline and the app; stale stores become quiet rings with "último dato" |
| The basket map coloured 0 stores while the card ranked 44 (dev written to copies) | `rankBasket` writes to the totals; a test pins it; smoke checks the colours |
| Each week coloured against its own median: the timeline could not show a price moving, and the cap flipped mid-animation | One reference per stage (the recent median) for every week; the cap frozen per stage |
| 39 dots hidden under the search or off screen; 40 % of the frame empty forest | The camera frames the store locations; the free area is measured from the chrome on screen |
| Dot outlines grew to 8–17 px when zoomed; overlapping stores unclickable at any zoom | Non-scaling strokes, radii that shrink relative to the city, tap snapping (22 px touch, 8 px mouse) |
| Legend ticks ran together; native slider; two clear buttons in search; tooltip text spilling out; card covering the controls; blue meant both "cheaper" and "button" | New legend (grid, "o más", reference, mode-specific reason, date span), a timeline with the curve, one clear button, wrapped tooltips in their own render host, controls that move off the card, a neutral accent |
| Back left the app; a closed store card lost the product; stale links left a dead grey map; a shared basket overwrote the reader's; own-price delete was 0 px wide; own prices dated in UTC; Escape in the search closed the card; a double-click closed the card | History entries per card; closing returns to the ranking; stale links fall back with a reason; shared baskets arrive as an offer; delete works; local dates; Escape and double-click fixed |
| Service worker served the first shell forever; ~420 SVG writes per pan event; ~1,200 per week step; hover re-rendered the card | Versioned worker (network-first pages, never-trimmed boot cache, LRU data cache), one frame per drag, radius writes only on zoom, colour writes only on change |
| Two size-parser errors invented per-unit prices (tea ×25, detergent ×1000) | Parser rules grounded in a scan of all 5,268 presentations; two more fixed through `fixSizes` |
| The phone left a 51–63 px band of map with a card open | A 52dvh sheet, a compact legend on it, no tags when there is no room: 183 px of map measured |
| HANDOFF, VISION, PIPELINES and EDITORIAL stale; VISION said green/red; "PROFECO publishes weekly" was false | All rewritten in this round; the About text says weekly survey, monthly publication |

Not fixed in this round, on purpose or for lack of time: a group card still fetches one file per member (20–43 requests; a pipeline `groups/<id>.json` would fix it); stores.json still carries each store's index series (270 kB raw of 512); the cron is disabled by GitHub after 60 days without a commit (nothing in the repo keeps it alive); the sceptic phase of round 1 ran against code that was changing under it, so its verdicts are advisory.

### Verified, and how

- Every flow in `tools/smoke.mjs` (30 checks) against the dev server on 2026-10-21, including the phone at 375×812.
- The 17 states of `tools/shots.mjs` at 1600×900 and 375×812, read by eye.
- The live site after the first green deploy: Spanish, 412 dots, 215 coloured, service worker active, no console errors (before the round-1 app changes; the next deploy carries them).
- Six recent medians recomputed by hand from the CSVs; two store indices recomputed from the weekly files.

### Not verified

- English end to end (strings exist for every key; no reviewer walked the whole app in English).
- Offline start after the new service worker (the rules are reviewed, not exercised).
- A real phone (only emulation) and Safari (only Chrome and Edge exist on this machine).
- The weekly cron's first scheduled run (the next Tuesday).

### Liberties (declared; the owner decides)

- **The product**: a city map as the stage, PROFECO's open data as the source, the reader's prices as a layer, instead of the first version's "record your own prices" only. Reversal: the own-price layer stands alone in the product card already.
- **Scope of the survey**: 9 non-grocery categories excluded (toys, appliances, electronics, sports, housewares, school supplies: 2,552 of 5,354 metro products), so 72 of 571 stores that sold only those are not drawn. Reversal: `excludeCategories` in `CITIES.cdmx` (`tools/build-qqp.mjs`); products.json would grow to ~1.5 MB raw.
- **All food store types are drawn**: 159 tortillerías, 124 Central de Abasto stalls (on 12 points), 18 mercados, 20 panaderías, 16 farmacias beside 153 supermarkets. Reversal: a `giros` filter in the city block.
- **A product's list is the last 26 weeks** (436 products seen only earlier are left out). Reversal: `recentWeeks`.
- **"Recent" is 28 days**; one reference per stage; colour cap frozen per stage; light weeks under half the median week; index needs 30 products; chips need 3 stores; "revísalo" beyond ±150 %; medicines count only for pharmacies. All in `docs/EDITORIAL.md`.
- **One diverging scale** (blue, grey, red) and a neutral accent; dark theme only.
- **Price tags on the map** (three cheapest and the dearest), on by default, off in Settings.
- **The PACIC preset**: the 31 generic products PROFECO's catalogue tags PACIC, not a transcribed list of 24 (the card says both numbers).
- **The mirror**: PROFECO's archives redistributed byte for byte on a release of the repo (licence allows copies with credit).
- **Pages switched to the Actions workflow and `main` taken over** (the owner allowed it in chat on 2026-10-21).
- **No product photographs, no community prices, no postal-code radius, no ListoLista merge** in this checkpoint.
- **English via Settings and `?lang=en`**, never guessed from the browser.
- **Working name "A cómo"**; the repo, the folder and the package keep their names until the naming card (checklist in AGENTS "Renaming").

### Name shortlist (one line each)

- **A cómo** (working name): what a chilango asks at the shelf; short, warm, Mexican; a question the app answers.
- **Mandado**: the weekly grocery run; warm and one word, but says nothing about prices.
- **Peras con peras**: the thesis (like with like); memorable, long for a title.
- **Quién da menos**: echoes PROFECO's "Quién es Quién"; playful, risks reading as PROFECO's own.
- **Compa Precio**: the current repo name; friendly, a bit bland.
- **La Báscula**: weighing the options; a stretch.

### Next

1. Round 2 of the self-audit on the new state (fresh reviewers), then the showpiece portfolio (three working demos of the opening and the timeline) for the owner to pick from.
2. The checkpoint: live link, decisions, liberties, the shortlist, question cards.
3. After the owner's answers: the portada (the week's story from matched stores), store neighbours, a share image, the group files in the pipeline.

## 2026-10-21, afternoon — the rebuild starts

Overhaul from scratch, mining the first version for parts. Kept: the README's philosophy (zero friction, the spreadsheet test, data sovereignty, hard code in production and AI in the workshop) and its event-log idea for the reader's own prices. Replaced: the one-file Tailwind prototype (mock data, nothing saved, injection via `innerHTML`, a size parser that read "12 latas 355 ml" as 12 litres, mean-based colours), the Colab Walmart scraper (its output cannot be published), and the September draft docs that proposed merging into ListoLista (the merge is a question for the owner, not a given). The old files are in git history (`b81c22a` and before); `docs/history/readout-2026-09-25.md` is the previous session's readout, kept as the honest record.
