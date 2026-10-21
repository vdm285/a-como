# A cómo — vision and roadmap

Written 2026-10-21, at the start of the rebuild, before the owner's first review. This is the north star. `HANDOFF.md` says what the code does today; this file says where it is going and why. If they disagree, the code is behind. The working name "A cómo" is the session's pick (the shortlist is in `HANDOFF.md`); the repository keeps its old name `compa-precio` until the owner decides.

## The one-sentence pitch

The city as a price map: every supermarket PROFECO monitors in Mexico City, drawn where it stands, colored by what you are looking for; a basket that tells you which store is cheapest for the whole list; and your own shelf prices beside the official ones, kept only on your phone.

## Why this instead of Googling it

Google answers "how much is Lala milk" with online prices from a few stores. PROFECO's own site lists the prices it collects but one product and one store at a time, in tables. Neither shows the city, neither totals a basket across stores, neither compares per litre or per kilo, and neither keeps your own observations. The question a chilango actually asks at the shelf is "¿a cómo?" and the answer should take one tap: this is what it costs here, this is what it costs across the city, this is where it is cheaper, and this is how it moved.

The landscape is documented in `docs/research/landscape-2026-10.md`.

## Who it is for

The owner and his friends in Mexico City first, in Mexican Spanish. English is a setting, never a second site. Desktop first (the map wants a wide screen), phone second but never broken. Anyone in Mexico eventually: the data covers many cities and the pipeline has a city block; another city is a configuration change and a review of its map.

## Principles

1. **Free to run, free to use, forever.** Static site on GitHub Pages. No server, no account, no ads, no tracking, no key at runtime. A scheduled build fetches the open data; if the schedule stops, the last deploy keeps working.
2. **Genuine and traceable.** Every price names its source and its date. Prices are PROFECO's weekly survey as published, or the reader's own; never estimated, never averaged across weeks, never invented. If the survey did not visit a store that week, the map says so instead of guessing.
3. **Peras con peras.** Like with like, always: the same product (name, brand, presentation) across stores; or the same generic product per 100 g, per 100 ml, per piece. Label prices and per-unit prices are both shown, never mixed in one ranking. The statistic is the median, never the mean.
4. **The map never leaves the screen.** The city is the stage. A store or a product opens as a card on the side away from it; the map stays full size and live under it, so the reader can keep hopping from store to store.
5. **Zero friction.** The first screen already answers something (how expensive is each store). A search is one field, always visible. Recording a shelf price takes a number and a tap. Nothing important lives behind a menu.
6. **Data sovereignty.** The reader's own prices live in the browser only (IndexedDB), exportable as JSON and CSV at any time, never uploaded anywhere. There is no "community" layer that strangers could poison.
7. **Hard code in production, AI in the workshop.** Parsers, statistics and dictionaries run in the app; AI helped write and test them and never runs at runtime. (Inherited from the first version's essay "El Herrero y la Espada".)
8. **Written for the next person.** Humans and AI agents pick this up from the public repo; the docs explain decisions, not only mechanics.

## What the first screen is

A dark map of Mexico City: the sixteen alcaldías and the metro municipalities as faint shapes, the arteries a local recognizes as thin lines, and one dot per monitored store. Before any search the dots are colored by the **basket index**: how that store's prices compare with the city median across everything PROFECO saw there that week (1.00 is the median; green is cheaper, red dearer). Hover a dot: chain, name, index, last visit. A search field floats at the top; a basket at the top-right; settings bottom-right. Nothing else.

## The three questions, and what answers each

| Question | What the reader does | What the stage shows | What the card shows |
|---|---|---|---|
| Where is this cheaper? | Types a product or picks a generic product | Dots recolor by that price (label price for one product, cheapest per-unit price for a generic) | Stores ranked, price, per unit, date; city min, median, max; a weekly line since 2025; the sizes and brands of the generic ranked per unit |
| Which store for my list? | Adds products to the basket | Dots recolor by the basket total; stores missing an item are hatched and say how many | Stores ranked by total, savings against the dearest and the median, the missing items per store |
| How expensive is this store? | Taps a dot | The dot holds the highlight; the rest stays | Chain, address, index with its weekly line, where it beats the city most and least, its product list with search |

Plus the owner's original question, kept as a first-class layer:

| Is this a good price? | Types the number seen on the shelf, in the product card or the store list | The reader's price appears as a ring on that store's dot | "Tu precio" beside PROFECO's latest, the difference, the date; a list of all own prices under settings, with export |

## Time

PROFECO visits stores weekly. The data keeps every week since January 2025 for the city median of each product, and the last 26 weeks per store. A slim scrubber under the map, shown when a product or the index is on stage, moves the whole map through the weeks; a play button animates it. This is the showpiece: watching a price move across the city is the one thing no table can show.

## Levels

Discrete steps, never a drifting zoom: the city → a store or a product (card) → its full list. Escape or the map's empty space goes back up. Keyboard: arrows walk the ranked list, Enter opens, Escape closes.

## Data

- **PROFECO "Quién es Quién en los Precios"** (open data, Libre Uso MX): the survey; a build-time pipeline (`tools/build-qqp.mjs`) rebuilt weekly by GitHub Actions, output not committed. `docs/research/profeco-qqp-2026-10.md` has the facts; `docs/PIPELINES.md` the mechanics.
- **Geometry** of the city from INEGI and OpenStreetMap (`tools/build-geo.mjs`), committed, refreshed by hand. `docs/research/geo-cdmx-2026-10.md`.
- **The reader's prices**, in the browser only.
- **Not used**: the first version's scrape of one Walmart store (March 2026). It stays local as a test corpus for the parsers because Walmart's terms forbid republishing its catalogue, and online prices are not shelf prices anyway. `docs/research/licenses-2026-10.md`.

## Roadmap

1. **Foundation** (this checkpoint): the pipelines, the map, the three questions, the basket, own prices, the scrubber, Spanish and English, PWA, docs.
2. **The owner's review**: name, the stage, what to remove, what to add; feature cards.
3. **Depth**: product photographs if a legal source with good matches exists (Open Food Facts is the candidate; parked until the match quality is proven), inflation context from INEGI's price index, the canasta básica as a preset basket, a store's product list by aisle.
4. **Other cities**: the pipeline's city block, one map per city, a city picker.
5. **Later, maybe**: sharing a basket by link (already free: the basket lives in the URL), a "walk" through a store's prices by aisle order, receipts by camera (needs a model; parked, per the owner's rule that AI stays in the workshop).

## Parked ideas (not forgotten)

- Community prices (strangers' observations): rejected for now; a poisoned price is worse than none. If ever, as a separate opt-in layer with provenance.
- Postal-code radius: replaced by the map itself; distance is visible.
- Product photographs: see Depth above.
- A phone-first "record a price" mode with the camera: parked until the match quality and the honesty rule (never present a model's reading as the price) are solved.
