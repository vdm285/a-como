# Handoff

The state of the code, dated, newest first. `docs/VISION.md` is the direction; this file is what exists. Read `AGENTS.md` first.

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
