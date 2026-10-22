# Handoff

The state of the code, dated, newest first. `docs/VISION.md` is the direction; this file is what exists. Read `AGENTS.md` first.

## 2026-10-22, day — fifth round: what the second verification of round 4 found (the owner still asleep)

### State in one paragraph

A second verification of round 4 (seven fresh agents; verdicts in `data/cache/verify4b/result.json`, gitignored) re-tested 90 items: 49 fixed, 4 deliberate, 29 partial, 8 not fixed, plus 41 new reports, two of them serious (a past week crowned a generic-product member sold in 2 stores that week; a product word plus a place dropped every product when a store name there contained the word). This round answers all of them except the few listed under "Not done". The arithmetic was never in question (about 9,000 recomputed values matched in round 4); what changed is which set each sentence counts, the camera on the phone and at 1024 px, search, and two stalls (a new zoom level cost 67–566 ms in label placement; each week step forced a layout per price tag). Unit tests 110/110; smoke 62/62 (7 new); a round script, `data/cache/r5/verify.mjs`, 25/27 (one failure is its own stale regex, the other the label residue below). Bundle: 204 kB JS / 73 kB gzip, 37 kB CSS / 11 kB gzip.

### What the round found and what changed

| Found (measured) | Fixed by |
|---|---|
| In a chosen week a generic product kept members by their recent store count: blanqueador on 9 Mar crowned a 1 L bottle priced in 2 stores that week; calamar ignored a member priced in 42 | `stage.js` group branch: each week judges members by that week's stores (`countsAt`, `usableAt`), for the map, the hero and every week of the curve; rows give both counts ("8 tiendas · 2 esa semana") |
| The store split counted medicines in supermarkets, against EDITORIAL; it flipped La Comer Coyoacán (cheaper more often with them, dearer without) | The split counts the same products as the wins and losses and says "sin contar medicinas"; the singular forms are right ("1 igual", "1 más barato") |
| Members "en otra unidad" were coloured against the group's unit (a $15.90 bunch of onions "cheaper" than $39.90/kg) | Other-unit and unsized members get the empty swatch |
| Cards stated false facts while their stage loaded (a product "sin precio reciente" for 200 ms; every UHT milk "en otra unidad" for up to 2.4 s) | "Cargando…" until the stage is there |
| The strip's "pico" dated a repeated value to its first week, the card to its last; a 9–15 week plateau was still a "pico" | A value reached in 3 or more weeks is a plateau and gets no note; one reached twice is dated to its latest week |
| A curve with no week of 3 stores drew an empty strip under "mediana semanal y rango" (78 products, 2,720 weeks) | The scale falls back to every week it has (faint dots) and the caption says "ninguna semana tuvo 3 tiendas: cada punto es una semana con menos" |
| "huevo iztapalapa" opened a store; "res coyoacan" listed Walmart Express; "pan coyoacan" dropped every bread (124 of 13,896 product-and-place queries lost their products) | A place query lists stores only when the words name a chain ("soriana coyoacan"); otherwise the products stay and the place's stores follow, under "Tiendas en Coyoacán" |
| "soriana" and Enter opened a face mask; "la comer" led with "comercial" ground beef; "nido" led with Difenidol; "pan" ranked Queso Panela with bread; "nueces", "arroces", "pineapple", "chilies" found nothing | A query naming a chain lists stores first (Enter opens one); a whole word outranks a word start, which outranks a hit inside a word, and inside-word hits drop out when anything better matches; -ces plurals; 40 more English words |
| Phone: leaving the full sheet by the chip, a sibling row or the grip left the city a speck (k 0.13 against 0.36), measured mid-transition; a store picked by search lost its street zoom after any sheet gesture | One exit path (`leaveFullSheet`, `settleSheet`): re-measure after the 280 ms transition, refit unless the reader moved the map, re-centre a store picked by search; the chip from a full sheet now gives the same scale as from a normal one |
| 360x640: the full sheet ran under the folded chip | The full sheet stops 8 px under the chip |
| Any tap on the phone map (and a tap on the sheet's grip) focused the map, drew a keyboard ring and announced a store | Focus within a second of any press is a pointer's; only Tab starts the walk |
| 1024: the folded timeline's invisible wrapper blocked hover and clicks on 82–86 dots | The folded wrapper is its chip's size and lets pointers through |
| A store card opened from a zoomed map did not shift the view, and closing it slid the view 207–414 px | The view follows the free area's centre the same way on open and close (the round's script returns to the exact transform); a new subject with under half its points in the free map is refitted |
| Zoom stalled 67–133 ms per new zoom level (566 ms at 4× CPU; 0.9 s per pinch step on a throttled phone) in d3's spherical `geoContains` | Each alcaldía is rasterised once (96×96, scanlines over its projected rings); a zoom level's label spots are a lookup: 0 long tasks over 16 wheel notches |
| Each week step and pan frame measured every tag's text (forced layout) and scanned every dot per spot: playback stalls of 1.2 s at 4× CPU | Tag widths measured once (re-measured when the font arrives); dot positions once per draw: 0 long tasks over 6 steps of the UHT milk group |
| Names hopped up to 134 px during a pan | A name keeps its spot while it stays clear; one that must move goes to the nearest clear spot |
| A tie tag clicked with its card open did nothing visible | It scrolls the card to the tied rows and marks them for two seconds |
| The strip's axis labels overlapped ("$180.0reciente $190.00") | Labels compared by their text's extent |
| A thin hero gave no store name and disagreed with the counts beside it (2 stores vs "3 tiendas esa semana") | "X, una de solo 2 tiendas con precio" plus "1 precio más, marcado «revísalo»"; the basket's thin hero names its store too |
| A "cheap" tag sat on the median itself ("$20.00/L empatada en 45 tiendas") | Cheap tags only below the reference, the dear tag only above it |
| A shared point's tooltip and dot used a flagged price as "el más barato" | A point shows its cheapest fair price |
| The basket in a week with no recent reference said "mediana de la ciudad esa semana … (sin precio reciente)"; its header said "13 tiendas con todo" with no week | "total mediano esa semana en las N tiendas con todo … (sin total reciente)"; "13 tiendas con todo esa semana" |
| A shared basket loading read "Vacía" with the empty-basket hint | "Canasta compartida" and only the loading line |
| Removing a basket item by keyboard dropped focus to the page | Focus stays in the list; the removal has an undo that does not take the focus (the next Enter would undo it) |
| The undo toast wrapped to two lines over a fifth of the phone's city | One line (`width: max-content`) |
| `?w=1999-01-01` showed 9 Mar 2026 and `?w=xx` the recent prices, but the address kept the bad value | The address is replaced by the week shown, a malformed week dropped |
| The index legend said "su última semana visitada" while 29 stores show an older week | "su última semana completa"; the store card names a later light week and why it does not count |
| 859 products named like their generic product had no way to it | A kicker "Ver sus 8 tamaños y marcas" |
| Group rows' third line cut the grade that tells members apart | It drops what repeats (the price when it equals the per-unit figure, the group's name) and wraps to two lines |
| Phone product rows with long unit prices cut the store's name (4 of 10 at 375) | The price column wraps between its parts and takes at most 45 % of the row |
| Pharmacy chains cut in the race ("Farmacias San Pablo" 126 px in 112) | The name column fits the longest chain up to 144 px |
| Smaller items: Escape and ✕ still spoke a pending count; the index's spoken span differed from its label; the timeline chip started in lowercase; the English placeholder was cut at 360; the selected hatched dot was small; touch targets under 40 px | Each fixed; touch targets grow on coarse pointers without moving anything |

### Decisions taken while the owner slept (continued; each with its one-line reversal)

16. **A chosen week judges a generic product's members by that week's stores.** Reverse: use `usable` instead of `usableAt(w)` in `bestAt` (`src/app/stage.js`).
17. **The store split leaves medicines out of a supermarket** (and says so); the index still includes them, since leaving them out moves it by 0 in the typical supermarket and at most 1.3 points. Reverse: count `recentRows` instead of `eligible` in `storeCard`'s split.
18. **The camera follows the free area for every card, store cards included, and refits a new subject that is mostly out of view.** Reverse: restore `&& !selected` in `setPadding` (`src/map/map.js`) and drop the `shareInFree` check in `updateStage`.
19. **Search**: a chain name puts stores first; whole words outrank prefixes; a place keeps the products unless the words name a chain. Reverse: `storesFirst` and `INSIDE` in `src/ui/search.js`.
20. **A value held 3 weeks or more is a plateau** (no "pico" on the strip; the card's sentence keeps it with its count). Reverse: `times(...) < 3` in `timeline()` (`src/ui/chrome.js`).
21. **Tags**: "cheap" only below the reference, "dear" only above. Reverse: the two `dev` filters at the end of `stageTags` (`src/main.js`).
22. **A thin hero names its store**, and flagged prices are counted after the line. Reverse: the `storesWithPrice`, `completeHero` and `flaggedMore` strings.
23. **Removing one basket item offers an undo** that leaves the focus in the list. Reverse: the `showToast` call in `onQty`.
24. **Links are normalised to the week shown.** Reverse: the `state.week` check after `computeStage` in `updateStage`.
25. **Left as they are, deliberately**: the phone timeline carries no notes (its strip is 40 px tall; the card's sentence gives the high and the low on the first screen); a name pushed by the chrome during a pan moves one grid step (9 such moves in a 30-frame diagonal pan at 1440, against about 40 with jumps up to 134 px before).

### Not done

- Some alcaldías stay unnamed in some views (Benito Juárez beside a card at 1440 and at the 1024 fit; Magdalena Contreras and Miguel Hidalgo on the phone city; none on a phone with a card open, by the "a city smaller than its names gets none" rule).
- A tie between two stores anchors its tag by file order (both are equally near their middle); the click shows both rows.
- Touch targets were enlarged by CSS for coarse pointers and measured only in emulation, not on a device.

### Verified, and how

- `npm test` 110/110; `npm run build`; `node tools/smoke.mjs` 62/62 against a fresh dev server.
- `data/cache/r5/verify.mjs` (27 measured checks for this round's items, on 5176): 25 pass; "rows count that week" fails only on its own regex (the row reads "8 tiendas · 2 esa semana"), and the label check reports the residue in decision 25.
- `node tools/shots.mjs` with three new states (a generic product in a past week, a supermarket's split, a product with no solid week), read by eye at 1600 and 375.

## 2026-10-22, morning — fourth self-audit round (the owner asleep: decisions taken alone)

### State in one paragraph

Three fresh reviewers measured the live site (40 findings; about 9,000 recomputed values matched, so the arithmetic is sound and what failed was what the surfaces claimed). Commit `4560c3f` answered them: one hero rule that never crowns a flagged price, ties said as ties on the card and as one tag on the map, a weekly line that skips weeks under 3 stores, generic products that compare like with like, the store split, and a search built for shoppers. Nine agents then re-tested the 40 on the routes where they were found (19 fixed, 18 partial, 3 regressed) and hunted for regressions (69 reports); commit `55d4242` answered those. A second verification followed; round 5, above, answers it.

### Decisions taken while the owner slept (each reversible; say the word)

1. **The store index stays the median of ratios**, and the store card adds the split of its recent prices against the city ("más barata en 160, igual en 822, más cara en 190 de 1,172 productos"). Reason: every Walmart and La Comer sits at exactly 1.000 because their prices are often the median itself; the split says what the index cannot, without breaking the "no means" rule. Alternative left open: a matched-basket index in the pipeline. Reverse: drop the `split` block in `storeCard` (`src/ui/cards.js`).
2. **Generic products compare only members sold in 3 or more stores and within a third to three times the median member size.** Reason: a 200 ml chocolate box was "the dearest litre of milk" and a grade sold in one store "the cheapest jitomate". Excluded members stay listed with the reason. Reverse: the `bySize` and `usable` filters in the group branch of `src/app/stage.js`.
3. **A basket with no recent reference compares a chosen week with that week's own median total**, as products already did, and says so. Reverse: the `refKind = 'week'` fallback in the basket branch of `src/app/stage.js`.
4. **Only cheaper dots grow on the map**; more expensive ones keep the base size, and "missing an item" dots are smaller and fainter. Reason: the ink went to the dear and incomplete stores, not to the answer. Reverse: `screenR(c._t)` and the hatch factor in `applyView` (`src/map/map.js`).
5. **A tie on the map is one tag** ("empatada en 34 tiendas") instead of three stores picked by file order. Reverse: `groups` and `tagOf` in `stageTags` (`src/main.js`).
6. **Search**: plurals match their singular, results rank by stores with a recent price with the PACIC basics first, products without a recent price sink and say so, a municipio in the query is a place filter. Reverse: `boost` and `forms()` in `src/ui/search.js`.
7. **The basket card answers first** (cheapest store, savings, the race, the ranking) and the editable list comes after. Reverse: move the "Tu lista" section back above the ranking in `basketCard`.
8. **The portfolio demos keep the data they were reviewed on** (before five stores were unplaced); the chosen direction will be rebuilt in the app on current data. `tools/portfolio-data.mjs` now leaves stores without a position out, so a rerun cannot break the demos. Reverse: rerun `node tools/portfolio-data.mjs` and republish the three demos.
9. **"Sold in 3 stores" means 3 stores with a recent price** (not ever), the same count the rows show; in a chosen week, 3 stores that week (decision 16). Reverse: `p.storesAll` in the `usable` filter.
10. **A tie tag opens the subject's card** (which lists the tied stores) and points at the tied store nearest the middle of the others; since round 5 it also scrolls to the tied rows and marks them. Reverse: `showTie` in `src/main.js`.
11. **A store card returns to the card it was opened over** (a product, a generic product, the basket); opened from the bare map, it returns to the map and the keyboard walk resumes on that store. Reverse: `ui.storeReturn` in `openStore` and `closeCard`.
12. **Colloquial place names** are read as places in search: neza, gam, izcalli, contreras, and the first word of a municipio when it is unambiguous (naucalpan, ecatepec, atizapan, tlalnepantla, coacalco). A chain plus a place lists only stores (since round 5, only when the words are a chain's whole words). Reverse: the `ALIAS` table and the first-word rule in `buildSearchIndex`.
13. **The weekly line breaks only at thin weeks** (1 or 2 stores, drawn as faint dots); weeks with no data are spanned, since a gap there drew nothing at all. Reverse: the `runs` construction in `timeline()`.
14. **A tap or a small drag (under 60 px) does not count as the reader moving the map**; a longer drag, a wheel, a double click or + and − do, and then a new subject keeps the reader's view (since round 5, unless under half of it is in view). Reverse: the 60 px test in the window `pointerup` listener (`src/main.js`).
15. **Left as they are, deliberately**: the index hero may read "en la mediana" (decision 1); stores that can never have an index keep their empty rings on the index; the index legend's weeks and the cards' 28-day window are different measures and may both show; a price near the 0.4 boundary can be flagged in a product and not in its generic product (different comparison sets).

## 2026-10-22, small hours — third self-audit round landed

### State in one paragraph

Round 3 ran against the live site with five fresh reviewers (phone, language, honesty of the numbers, desktop polish, accessibility): 91 measured findings, about a dozen of them the same defect seen from two sides. Nearly all are fixed (commits `079c98e`, `abe4915` and the docs after them). The biggest: one "revísalo" rule decided per stage and symmetric (2.5 times or 0.4 times the median of the stage's own comparison set), ties said as ties, a week's own figure only from 3 stores, a peak only where the line moves, five stores whose PROFECO point is another store's no longer drawn (their prices kept), the 1024 px and phone layouts measured in the right order, and the map, rows and slider reachable and audible by keyboard. Bundle: 181 kB JS / 65 kB gzip.

### What the round found and what changed

| Found (measured) | Fixed by |
|---|---|
| The store card flagged 93 April jitomate prices that the product card showed as normal for that week; a −79 % price was crowned the cheapest; the tooltip and tags never showed the flag | `v.far` decided once in `stage.js` against the stage's comparison set; symmetric ratio rule in `logic/stats.js` (`isFar`, unit-tested) read by every surface |
| In a sample of 94 products with 3 or more stores, 45 had a tie for the lowest price; the hero named one store by file order | "la más barata, empatada en N tiendas" |
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
