# How the stage speaks

Written 2026-10-21. This is the rule the app follows for every number and word on a screen.

We do not promise that a price is right today. We promise that every price names who recorded it and when.

- **Prices are PROFECO's**, as published in the weekly "Quién es Quién en los Precios" open data, label price per product per store per visit. We show the latest visit's price with its date. We never average across weeks, never interpolate a missing week, never carry a price forward silently. A store PROFECO did not visit in the week on stage is a hollow dot and the tooltip says "sin visita esa semana".
- **"Peras con peras."** A product is a name, a brand and a presentation; its price compares only with the same product elsewhere. A generic product (PROFECO's PRODUCTO field) compares its members per litre, per kilo, per 100 g, per 100 ml or per piece, and only within one dimension; members whose presentation gives no size are listed apart, by label price, marked "sin tamaño en el nombre". The unit on screen follows what a shopper says: litres for drinks, kilos for bulk, pieces for eggs and rolls.
- **The median, never the mean.** The city median is the baseline for every colour, every "arriba/abajo" chip, every ranking. The store index is the median of price ratios, documented in the card under "Cómo se calcula", and it is shown only when the store had at least 30 products that week.
- **One colour scale**, stated by the legend every time: blue is cheaper than the median, grey is the median, red is dearer; the cap (±5 %, ±10 %…) is chosen from the spread and printed on the legend, so a saturated dot reads "at least this much", not "exactly this much". No red/green semaphore, no rainbow.
- **Nothing invented.** No product photographs until a legal, matched source exists; the category and the text are PROFECO's own. Store names, addresses and coordinates are PROFECO's; a wrong coordinate is fixed through `data/overrides/qqp.json` with a note, never guessed in code. Chains appear by name only, no logos.
- **The reader's prices are the reader's.** They sit beside PROFECO's, marked "tu precio" in gold, with their own date, and the card states the difference against PROFECO's latest. They never mix into any median or ranking, and never leave the browser.
- **Dates everywhere.** The legend shows the week on stage; every ranked line shows the visit date; the settings card shows the latest week in the data and the build date; the footer line names PROFECO, INEGI and OpenStreetMap.
- **Spanish first.** Mexican usage: "súper", "mandado", "a cómo", "canasta", "anaquel". English is a translation of the same strings, never a different product.
- **If a number looks wrong**, the fix is a line in the override file and a rerun, written down in `docs/PIPELINES.md` under curation, so the next person knows why.
