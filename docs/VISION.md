# A cómo — vision and roadmap

Written 2026-10-21 at the start of the rebuild, revised the same day after the first self-audit. This file says where the product is going and why; it governs direction. `HANDOFF.md` says what the code does today, and `docs/EDITORIAL.md` settles how numbers and words are shown. When this file and the code disagree on a specific (a colour, a field), read EDITORIAL and the code first; when they disagree on direction, this file wins and the code is behind. The working name "A cómo" is the session's pick (the shortlist is in `HANDOFF.md`); the repository keeps its old name `compa-precio` until the owner decides.

## The one-sentence pitch

The city as a price map: every food store PROFECO surveys in Mexico City and its metro area, drawn where it stands, coloured by what you are looking for; a basket that tells you which store is cheapest for the whole list; a timeline that shows a price moving across the city; and your own shelf prices beside the official ones, kept only on your phone.

## Why this instead of Googling it

Google answers "how much is Lala milk" with online prices from a few stores. PROFECO's own site lists the prices it collects one product at a time, in tables, with a "mi lista" that only sums the rows you tick. Neither shows the city, neither totals a basket per store across all surveyed stores, neither compares per litre or per kilo, neither shows how a price moved, and neither keeps your own observations. One paid iOS app reuses the same data for a cheapest-store basket. The question a chilango asks at the shelf is "¿a cómo?", and the answer should take one tap: what it costs here, what it costs across the city, where it is cheaper, how it moved.

The landscape, with dated citations, is in `docs/research/landscape-2026-10.md`.

## Who it is for

The owner and his friends in Mexico City first, in Mexican Spanish. English is a setting, never a second site. Desktop first (the map wants a wide screen); the phone is a bottom sheet and must never be broken. Anyone in Mexico eventually: the survey covers many cities and the pipeline has a city block; another city is a configuration entry and a review of its map.

## Principles

1. **Free to run, free to use, forever.** Static site on GitHub Pages. No server, no account, no ads, no tracking, no key at runtime. A scheduled build turns the open data into static files; if the schedule stops, the last deploy keeps working and says how old its data is.
2. **Genuine and traceable.** Every price names its source and its date. Prices are PROFECO's survey as published, or the reader's own; never estimated, never averaged across weeks, never carried forward silently. "Recent" means the last 28 days of data, stated on screen.
3. **Peras con peras.** Like with like: the same product (name, brand, presentation) across stores; a generic product per litre, kilo, 100 g, 100 ml or piece, in one unit decided for the whole group. The statistic is the median, never the mean, and every comparison names its reference.
4. **The map never leaves the screen.** The city is the stage. A store or a product opens as a card on the side away from it; the map stays full size and live under it, framed on the stores that are actually there.
5. **Zero friction.** The first screen already answers something (how expensive is each store). Search is one field, always visible. Recording a shelf price takes a number and a tap. Nothing important lives behind a menu.
6. **Data sovereignty.** The reader's own prices live in the browser only (IndexedDB), exportable as JSON and CSV at any time, never uploaded. There is no "community" layer that strangers could poison.
7. **Hard code in production, AI in the workshop.** Parsers, statistics and dictionaries run in the app and the pipeline; AI helped write and test them and never runs at runtime. (Inherited from the first version's essay "El Herrero y la Espada".)
8. **Written for the next person.** Humans and AI agents pick this up from the public repo; the docs explain decisions, not only mechanics.

## What the first screen is

A dark map of the city: the sixteen alcaldías and the metro municipalities as faint shapes, the arteries a local recognizes as thin lines, and one dot per store location. Before any search the dots are coloured by the **basket index**: how the store's prices compare with each product's city median that week (1.00 is the median; blue is cheaper, grey the median, red dearer, a legend always present). Stores without an index (tortillerías and bakeries survey too few products) are quiet rings. A search field floats at the top, the basket at the top right, settings at the bottom right, the legend at the bottom left, and the timeline at the bottom.

## The three questions, and what answers each

| Question | What the reader does | What the stage shows | What the card shows |
|---|---|---|---|
| Where is this cheaper? | Types a product or picks a generic product | Dots recolour by that price against the recent city median (one product: label price; a generic: the cheapest per-unit price at each store); price tags name the three cheapest and the dearest | A strip of every store's price by kind of store; stores ranked with price, per unit, date; the weekly median since 2025; the sizes and brands of the generic ranked per unit |
| Which store for my list? | Adds products to the basket | Dots recolour by the basket total; stores missing an item are hatched | A race of chains (cheapest branch, range, branches), stores ranked by total with the date span of their prices, savings against the dearest |
| How expensive is this store? | Taps a dot | The dot holds the highlight; the map stays | Chain, address, index with its week and its weekly line, where it beats the city most and least in the last 28 days, everything PROFECO saw there (recent first, older apart) |

Plus the owner's original question, kept as a first-class layer:

| Is this a good price? | Types the number seen on the shelf, in the product card | The reader's price appears as a gold ring on that store's dot and a gold tick on the price strip | "Tu precio" beside PROFECO's, the difference, the date; all own prices under settings, with export and import |

## Time

PROFECO surveys stores every week and publishes the data every month, five to nine weeks behind (its metadata says "Mensual"). The pipeline keeps the city median of each product for every week since January 2025, and each store's price for the last 26 weeks. The timeline under the map draws the price curve (or, on the index, how many stores PROFECO visited each week), marks light weeks, and ends at a "Reciente" stop. Scrubbing or playing it colours every week against the same recent median, so a price moving shows on the map: the jitomate turning the whole city red in April and blue again in August. This is the showpiece direction: watching a price move across the city is the one thing no table can show.

## Levels

Discrete steps, never a drifting zoom: the city → a store or a product (card) → its full list. Escape goes back one level (search, card, playback, week, stage); the map's empty space closes a card; Back in the browser returns to the previous card.

## Data

- **PROFECO "Quién es Quién en los Precios"** (open data; CC BY 4.0 per the datos.gob.mx record, historically "Términos de Libre Uso MX"): the survey. A build-time pipeline (`tools/build-qqp.mjs`) turns it into static files on every deploy; the output is not committed. PROFECO's site does not answer GitHub's build servers, so the yearly archives are mirrored byte for byte on a release of this repository and refreshed from a network in Mexico (`npm run qqp:mirror`). `docs/research/profeco-qqp-2026-10.md` has the facts; `docs/PIPELINES.md` the mechanics.
- **Geometry** of the city from INEGI and OpenStreetMap (`tools/build-geo.mjs`), committed, refreshed by hand. `docs/research/geo-cdmx-2026-10.md`.
- **The reader's prices**, in the browser only.
- **Not used**: the first version's scrape of one Walmart store (March 2026). It stays local as a parser test corpus because Walmart's terms could not be read and republishing a store's catalogue is the real risk; online prices are not shelf prices anyway. `docs/research/licenses-2026-10.md`.

## Roadmap

1. **Foundation** (this checkpoint): the pipelines, the map, the three questions, the basket, own prices, the timeline, Spanish and English, PWA, docs, a first self-audit.
2. **The owner's review**: name, the stage, what to remove, what to add; a portfolio of showpiece options; feature cards.
3. **Depth**: a weekly "portada" (the week's story computed from matched stores), a store's neighbours, a share image, product photographs if a legal matched source exists (Open Food Facts is the candidate; parked until match quality is proven), inflation context from INEGI's price index.
4. **Other cities**: the pipeline's city block, one map per city, a city picker.
5. **Later, maybe**: a "walk" through a store's prices by aisle; receipts by camera (needs a model; parked, per the rule that AI stays in the workshop).

## Parked ideas (not forgotten)

- Community prices (strangers' observations): rejected for now; a poisoned price is worse than none. If ever, as a separate opt-in layer with provenance.
- Postal-code radius: replaced by the map itself; distance is visible.
- A phone-first "record a price" mode with the camera: parked until match quality and the honesty rule (never present a model's reading as the price) are solved.
- Merging with ListoLista (the owner's shared shopping list, proposed in September): a question for the owner, not a given.
