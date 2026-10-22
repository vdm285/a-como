# A cómo

**El mapa de precios del súper en la Ciudad de México.** Abre con el relieve de la ciudad: cada tienda una columna tan alta como su precio, semana a semana. Luego, las tiendas que vigila PROFECO (del súper a las papelerías), dibujadas donde están y coloreadas por lo que buscas; una canasta que dice en qué tienda sale más barata la lista completa; una línea de tiempo que muestra cómo se mueve un precio por la ciudad; y tus propios precios junto a los oficiales, guardados sólo en tu navegador.

*The supermarket price map of Mexico City. It opens on the city in relief: each store a column as tall as its price, week by week. Then the stores PROFECO surveys (from supermarkets to stationers), drawn where they stand and coloured by what you search; a basket that says which store is cheapest for the whole list; a timeline that shows a price moving across the city; your own shelf prices beside the official ones, kept only in your browser. Spanish first; English is a setting.*

Live: https://vdm285.github.io/a-como/ (until 2026-10-22 the repository was `compa-precio`; its old address forwards here).

## What it does

- **Where is this cheaper?** Search a product ("leche Lala 1 L") and the map colours every store by its recent price against the city median, with tags on the three cheapest and the dearest. Search a generic product ("leche") and it colours by the cheapest price per litre at each store, sizes and brands compared like with like.
- **Which store for my list?** Add products to the basket: the map colours by the basket total per store, hatches the stores that lack an item, and the card races the chains.
- **How expensive is this store?** Tap a dot: its basket index (the median of its price ratios against the city, explained in the card), where it beats the city and where it loses in the last 28 days, and everything PROFECO saw there.
- **How did it move?** The timeline under the map walks the last 26 weeks against the recent reference: play the jitomate and watch the whole city turn red in the April 2026 spike, then settle back around the median by August.
- **Is the price in front of me good?** Type it on the product card: it sits beside PROFECO's with its date, as a gold ring on the map, and never leaves your browser (export to JSON or CSV any time).

PROFECO surveys weekly and publishes monthly, five to nine weeks behind; the app says how recent its data is. Nothing is invented: no estimated prices, no generated images, no community layer.

## Data and credits

- **Prices**: "Programa Quién es Quién en los Precios", PROFECO (Procuraduría Federal del Consumidor), https://datos.profeco.gob.mx/datos_abiertos/qqp.php. Mexican government open data under Creative Commons Attribution 4.0, as the datos.gob.mx record states (historically "Términos de Libre Uso MX"). Reference prices surveyed by PROFECO in a sample of stores; this app is not made or endorsed by PROFECO. The app shows the access date. Rebuilt on every deploy, never committed. PROFECO's site does not answer GitHub's build servers, so its yearly archives are mirrored byte for byte, with checksums and the access date, on the [`qqp-mirror` release](https://github.com/vdm285/a-como/releases/tag/qqp-mirror). Details: `docs/PIPELINES.md`, `docs/research/profeco-qqp-2026-10.md`.
- **Map**: alcaldías and metro municipalities from INEGI, Marco Geoestadístico, diciembre de 2025 (free use with credit); arteries, parks, water and airports © OpenStreetMap contributors (ODbL; the derived geometry file is ODbL too). Details: `docs/research/geo-cdmx-2026-10.md`.
- **The code** in this repository is public domain (The Unlicense). The data files are not: they keep the licences above, with their credits, if you reuse them. Quotes and reasoning: `docs/research/licenses-2026-10.md`.

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

`npm run qqp` downloads PROFECO's yearly archives (about 145 MB, from PROFECO or the mirror) into `data/cache/qqp/`, extracts them (about 7 GB of CSV), and writes `public/data/qqp/` (about 55 MB). It needs Node 22+, about 2 GB of RAM, five to eight minutes, and a program that reads RAR5: 7-Zip (Windows; the built-in `tar.exe` also works), or `libarchive-tools` (bsdtar) on Linux. Everything it downloads stays under `data/cache/`.

Other scripts: `npm test` (logic and parser tests), `npm run check` (the data contract), `npm run build` (writes `dist/`), `npm run shots` and `node tools/smoke.mjs` (screenshots and flow checks against the dev server), `npm run geo` (rebuilds the committed map geometry), `npm run qqp:mirror` (refreshes the mirror; needs a network in Mexico and `gh` with write access).

Deploys: GitHub Actions (`.github/workflows/pages.yml`) builds and publishes on every push to `main`, every Tuesday, and by hand. If the data cannot be built, nothing is published and the previous site stays.

## For the next person (human or AI)

Start with `AGENTS.md` (rules, where things live, checks, gotchas), then `docs/VISION.md`, then `HANDOFF.md` (the state, dated).
