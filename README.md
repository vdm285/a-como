# A cómo

**El mapa de precios del súper en la Ciudad de México.** Cada tienda que vigila PROFECO, dibujada donde está, coloreada por lo que buscas; una canasta que dice en qué tienda sale más barata la lista completa; y tus propios precios junto a los oficiales, guardados sólo en tu teléfono.

*The supermarket price map of Mexico City: every store PROFECO monitors, drawn where it stands and coloured by what you search; a basket that says which store is cheapest for the whole list; your own shelf prices beside the official ones, kept only on your phone. Spanish first; English is a setting.*

Live: https://vdm285.github.io/compa-precio/

## What it does

- **Where is this cheaper?** Search a product ("leche Lala 1 L") and the map colours every store by its latest price against the city median. Search a generic product ("leche") and it colours by the cheapest price per litre at each store, sizes and brands compared like with like.
- **Which store for my list?** Add products to the basket; the map colours by the basket total per store, hatches the stores that lack an item, and ranks them.
- **How expensive is this store?** Tap a dot: its basket index (median price ratio against the city, documented in the card), where it beats the city and where it loses, and everything PROFECO saw there.
- **How did it move?** A scrubber under the map walks the weeks since January 2025; play it and watch a price cross the city.
- **Is the price I am looking at good?** Type the number you see on the shelf; it sits beside PROFECO's with its date, and it never leaves your browser (export to JSON or CSV any time).

## Data and credits

- Prices: **PROFECO, Quién es Quién en los Precios**, open data under the Mexican government's free-use terms (Libre Uso MX), rebuilt weekly by a GitHub Actions job. The files are not committed; see `docs/PIPELINES.md` and `docs/research/profeco-qqp-2026-10.md`.
- Map: borough and municipality shapes from **INEGI**; streets, parks and water © **OpenStreetMap contributors** (ODbL). See `docs/research/geo-cdmx-2026-10.md`.
- The code is public domain (The Unlicense). The data files keep their own licenses, named above and in `docs/research/licenses-2026-10.md`.

Nothing is invented: no estimated prices, no generated images, no community layer. When PROFECO did not visit a store that week, the map shows a hollow dot and says so.

## Run it

```bash
npm install
```

```bash
npm run qqp
```

```bash
npm run dev
```

`npm run qqp` downloads PROFECO's yearly archives into `data/cache/qqp/` (D: only; a few hundred MB) and writes `public/data/qqp/`. `npm run geo` rebuilds the committed map geometry. `npm test` runs the logic tests. `npm run build` writes `dist/`.

## For the next person (human or AI)

Start with `AGENTS.md`, then `docs/VISION.md`, then `HANDOFF.md`. The owner's working method lives outside the repo in `D:\_GitHub\revamp-playbook.md`.
