# Licenses and limits (research, October 2026)

Written 2026-10-21 by Claude (researcher) for the CompaPrecio rebuild. Not legal advice: this is
what each publisher says, quoted briefly and dated. "Read" means the page was opened and its text
extracted (WebFetch or the Claude desktop built-in browser). **[unverified]** marks anything that
could not be opened. Companion file: `landscape-2026-10.md`.

---

## 1. PROFECO "Quién es Quién en los Precios" open data

### 1.1 Which terms apply

Three signals, in order of specificity:

**(a) The dataset page on the national platform** states a license outright.
https://www.datos.gob.mx/dataset/programa_quien_es_quien_precios_2025 (read in the built-in
browser 2026-10-21; WebFetch receives HTTP 403 from every datos.gob.mx host): "Licencia:
Creative Commons Attribution 4.0", linking to https://creativecommons.org/licenses/by/4.0/.
Publisher "Procuraduría Federal del Consumidor (PROFECO)"; "Última actualización: 24 de
diciembre de 2025".

**(b) The 2015 open-data decree** that makes federal datasets free to reuse. "DECRETO por el que
se establece la regulación en materia de Datos Abiertos", DOF 2015-02-20,
https://dof.gob.mx/nota_detalle.php?codigo=5382838&fecha=20/02/2015 (read 2026-10-21): data must be
"De libre uso: Citarán la fuente de origen como único requerimiento para ser utilizados
libremente" (Artículo Quinto, fracción III); the purpose is "facilitar su acceso, uso,
reutilización y redistribución para cualquier fin" (Artículo Primero); open data may be "usados,
reutilizados y redistribuidos, por cualquier interesado" (Artículo Segundo, fracción V).

**(c) "Términos de Libre Uso MX"** (the historic license of datos.gob.mx). The live URL is gone:
https://datos.gob.mx/libreusomx returns HTTP 403 (WebFetch) or redirects to
https://www.datos.gob.mx/libreusomx which is a 404 "Página no encontrada" (built-in browser,
2026-10-21); https://historico.datos.gob.mx/libreusomx returned "502 Bad Gateway" (2026-10-21).
The text below is from the Wayback Machine capture of 2015-12-08 21:45:21 UTC of
http://datos.gob.mx/libreusomx/ (owner's local copy, `data/cache/qqp/raw/pages/libreusomx.wayback-20151208.txt`,
saved 2026-10-21), cross-checked against the OSM wiki copy
https://wiki.openstreetmap.org/wiki/ES:LIBRE_USO_MX (last edited 2015-05-19, read 2026-10-21),
which is identical in substance:

> "Los presentes 'Términos de libre uso' promueven el uso, reuso y redistribución de los conjuntos
> de datos abiertos, de conformidad con lo siguiente:
>
> Usted puede:
> a. Hacer y distribuir copias del conjunto de datos y su contenido;
> b. Difundir y publicar el conjunto de datos y su contenido;
> c. Adaptar o reordenar el conjunto de datos y su contenido;
> d. Extraer total o parcialmente el contenido del conjunto de datos;
> e. Explotar comercialmente el conjunto de datos y su contenido, y;
> f. Crear conjuntos de datos derivados del conjunto de datos o su contenido.
>
> Condiciones:
> a. Citar la fuente de origen de donde obtuvo el conjunto de datos: Nombre del conjunto de
> datos", [Siglas de la Dependencia o Entidad de la Administración Pública Federal]; Liga de
> internet de los datos descargados, y la fecha de la de consulta en formato numérico
> [AAAA-MM-DD], puestos a disposición de tal manera que sean fácilmente accesibles para los
> usuarios, y en la forma que mejor se adecue al funcionamiento del bien o servicio;
> b. No utilizar la información con objeto de engañar o confundir a la población variando el
> sentido original de la información y su veracidad.
> c. No aparentar que el uso que usted haga de los datos representa una postura oficial del
> Gobierno o que el mismo está avalado por la fuente de origen.
>
> Ejemplo de cita: "Variedades Vegetales y Semillas" publicado por SAGARPA. Consultado en
> http://catalogo.datos.gob.mx/dataset/variedades-vegetales-y-semillas el 2014-09-04.
>
> Aviso sobre contenidos de terceros: Los términos de libre uso no lo autorizan para utilizar el
> contenido de terceros como pueden ser obras en cualquier formato que se encuentren dentro de los
> conjuntos de datos. ...
>
> Compatible con [Creative Commons CC BY]"

**What is not a license for the data:** PROFECO's own portal https://datos.profeco.gob.mx/ shows
no license or terms text at all (read 2026-10-21, and the owner's saved copies of the index,
`qqp.php` and `diccionarioDatosQQP.php` pages confirm it). The general site terms at
https://www.gob.mx/terminos (read 2026-10-21) say the opposite of open data: "Se autoriza al
Usuario a visualizar y descargar los materiales contenidos en el sitio solamente para su uso
personal" and "El Usuario no deberá modificar, reproducir o mostrar pública o comercialmente los
materiales". Those are website terms for gob.mx pages; the dataset-level CC BY 4.0 statement in
(a) and the decree in (b) are the ones that govern the datasets. The research file should keep
this tension visible, and the app should cite (a) and (b) explicitly.

### 1.2 What the app may do, and must do

- May: copy, redistribute, transform, extract, build derived files, and use commercially
  (Libre Uso MX a–f; CC BY 4.0). The rebuild's weekly JSON extracts are "conjuntos de datos
  derivados".
- Must: credit the source with dataset name, agency, download link and access date in
  `AAAA-MM-DD` form, "fácilmente accesibles para los usuarios" (Libre Uso MX, Condiciones a;
  CC BY 4.0 attribution). Must not distort the data's meaning (b) or imply PROFECO endorses the
  app (c).
- Third-party content: the data contains brand names and product descriptions, which are facts,
  not "obras"; no third-party works (images, texts) are in the CSVs. Still, the app should not
  reproduce chain logos (see "Brand colours" in section 5 of `landscape-2026-10.md`).

### 1.3 Credit lines to display

The access date must be filled by the build (the date the CSV was fetched), not hard-coded.

**Spanish (primary, visible in the app footer and on the "Acerca de" screen):**

> Precios: "Programa Quién es Quién en los Precios", PROFECO (Procuraduría Federal del
> Consumidor). Descargado de https://datos.profeco.gob.mx/ el AAAA-MM-DD. Datos abiertos del
> Gobierno de México, licencia Creative Commons Atribución 4.0 (Términos de Libre Uso MX). Son
> precios de referencia tomados por PROFECO en una muestra de tiendas; esta aplicación no es de
> PROFECO ni está avalada por ella.

**English (secondary, README and "About"):**

> Prices: "Programa Quién es Quién en los Precios", PROFECO (Mexico's federal consumer protection
> agency). Downloaded from https://datos.profeco.gob.mx/ on YYYY-MM-DD. Mexican government open
> data under Creative Commons Attribution 4.0 (Libre Uso MX terms). These are reference prices
> surveyed by PROFECO in a sample of stores; this app is not made or endorsed by PROFECO.

Short form for tight UI (still carries name, agency, link, date): `Fuente: "Quién es Quién en los
Precios", PROFECO, datos.profeco.gob.mx, AAAA-MM-DD`.

---

## 2. Walmart México terms

Attempt on 2026-10-21 via WebFetch at https://www.walmart.com.mx/ayuda/articulo/terminos-y-condiciones:
the response was a bot-check page whose only text is "Mantén presionado el botón para confirmar
que no eres un robot." The terms were **not read**; nothing about automated access or catalogue
reuse is paraphrased here, and the check was not bypassed. (The same check gates sams.com.mx.)

**Project rule, as of 2026-10-21.** The owner's March 2026 capture of one Walmart store
(`data/sources/walmart-patio-santafe-2026-03`, 92 files, 2.0 MB on disk) is a **private local test
corpus**. It is never committed, published, shipped in the site bundle, or used to seed public
data. Verified: `.gitignore` already lists `data/sources/` and `data/cache/` ("Downloads, caches
and raw sources stay on D:, under the project, never committed."), and the old Colab scraper
notebooks are staged for deletion. Any future shelf prices in the public app come from the reader
typing them into their own browser, or from PROFECO's open data, never from scraping a retailer.

---

## 3. Open Food Facts (parked: product photos later)

- **Data license.** https://world.openfoodfacts.org/terms-of-use (read 2026-10-21): "The Open Food
  Facts database is available under the Open Database License" (ODbL 1.0); "Individual contents of
  the database are available under the Database Contents License" (DbCL 1.0). Same on
  https://world.openfoodfacts.org/data (read 2026-10-21), which adds the attribution example
  "Contains data from Open Food Facts, available under the Open Database License" and the
  share-alike duty: if you publicly use an adapted database you must "offer that adapted database
  under the ODbL and share your modifications back".
- **Image license.** Terms of use: "Products images are available under the Creative Commons
  Attribution ShareAlike licence" (link to CC BY-SA 3.0).
- **Trademarks on packaging photos (OFF's own words).** Terms of use: the image licence "only
  covers the photo itself and the rights of the contributors who took the picture"; images "may
  contain graphical elements subject to copyright or other rights", including "image rights of
  people (e.g. celebrities) featured on the packaging, trademark rights etc."; re-users must check
  those rights themselves. Attribution: "mention the licence and to attribute the authorship to
  Open Food Facts with a link to https://openfoodfacts.org" (or to the product page). The terms
  carry no version or date and say the French original prevails.
- **API terms.** https://openfoodfacts.github.io/openfoodfacts-server/api/ (read 2026-10-21):
  reads need no key, "READ operations ... do not require authentication other than the custom
  User-Agent"; "The User-Agent should be in the form of `AppName/Version (ContactEmail)`";
  limits "15 req/min/IP address for all read product queries (`GET /api/v*/product` requests or
  product page)", "10 req/min/IP address for all search queries", "don't use it for a
  search-as-you-type feature", HTTP 503 when exceeded, IP bans reserved; "If you need to fetch
  more than a few hundred products, we ask you to download the data as a CSV or JSONL file
  directly"; for apps, "the rate limits apply per user"; test against the staging host
  world.openfoodfacts.net (basic auth off/off). Product consequence: any OFF use in this app must
  be a build-time batch from the bulk export, never live calls from readers' browsers.
- **Mexico coverage.** https://mx.openfoodfacts.org/ shows "Productos 17.930" (read 2026-10-21).
  The API count (`/api/v2/search?countries_tags_en=mexico`) and
  https://world.openfoodfacts.org/country/mexico both returned HTTP 503 on 2026-10-21, so 17,930 is
  the only verified figure.

---

## 4. OpenStreetMap, Overpass, Nominatim

- **License and credit.** https://www.openstreetmap.org/copyright (read 2026-10-21): "Where you
  use OpenStreetMap data, you are required to do the following two things: Provide credit to
  OpenStreetMap by displaying our attribution notice. Make clear that the data is available under
  the Open Database License." Derived databases: "If you alter or build upon our data, you may
  distribute the result only under the same license." In print or where links are impossible,
  "please include the full URL on the page, e.g. https://www.openstreetmap.org/copyright."
- **Exact wording.** OSMF Attribution Guidelines,
  https://osmfoundation.org/wiki/Licence/Attribution_Guidelines ("Adopted by the OpenStreetMap
  Foundation board on 2021-06-25", read 2026-10-21): attribution must be to "OpenStreetMap"; the
  historical forms "© OpenStreetMap contributors" and "© OpenStreetMap" remain acceptable; on an
  interactive map it goes in a corner of the map (or adjacent, or on a splash); the text
  "OpenStreetMap" should link to openstreetmap.org/copyright; if the credit can be collapsed,
  licence information must still be reachable (About/info button). Credit line for this app:
  **"© OpenStreetMap contributors"** linked to https://www.openstreetmap.org/copyright, in the map
  corner.
- **Overpass public instance rules.** https://wiki.openstreetmap.org/wiki/Overpass_API ("last
  edited on 21 October 2026", read 2026-10-21), main instance overpass-api.de: "You can assume that
  you don't disturb other users when you do less than 10,000 queries per day" and "download less
  than 1 GB data per day"; "If you set something up that uses the Overpass API regularly, then
  divide those numbers by 100"; for apps and websites "the usage counts towards the sum of
  requests made by all your users"; add "User-Agent or Referer headers to requests that uniquely
  identify your app"; "No parallel running of multiple scripts"; "Cache and rate-limit calls, use
  extracts if you need a lot of data"; after HTTP 429 or 406 "pause for 30 seconds"; commercial use
  should go to self-hosted or paid servers; "Do not use platforms for fast-deployment of
  AI-generated apps like lovable.app or netlify.app"; the server "is overloaded", "do not expect
  high reliability". Product consequence: one Overpass query at build time (GitHub Actions, with
  a User-Agent), result committed as the slow-changing geo file; never queried from readers'
  browsers. Map tiles are a separate question: the OSMF tile usage policy
  (https://operations.osmfoundation.org/policies/tiles/) was **not read** this session; drawing
  store dots over alcaldía outlines without raster tiles avoids it entirely.
- **Nominatim usage policy** (https://operations.osmfoundation.org/policies/nominatim/, undated,
  "may change without notice", read 2026-10-21), in case the app ever geocodes: "No heavy uses (an
  absolute maximum of 1 request per second)"; "Provide a valid HTTP Referer or User-Agent
  identifying the application"; "Clearly display attribution as suitable for your medium";
  "Results must be cached on your side"; "Clients sending repeatedly the same query may be
  classified as faulty and blocked"; "Auto-complete search ... you must not implement such a
  service on the client side using the API"; bulk geocoding is "not encouraged". The QQP data
  already has coordinates, so geocoding should not be needed.

---

## 5. INEGI and Banxico (parked: inflation context)

**INEGI.** Terms of free use, https://www.inegi.org.mx/inegi/terminos.html (read 2026-10-21,
"La vigencia de estos Términos de Libre Uso es por tiempo indefinido"): "Puede hacer y distribuir
copias de la información, sin alterar ni suprimir sus metadatos", "Puede difundir y publicar",
"Puede adaptar y reordenar", "Puede extraer total o parcialmente", "Puede explotar comercialmente
la información, utilizándola como insumo para generar otros productos o servicios"; conditions:
"Debe otorgar los créditos correspondientes al INEGI como autor", cite as "Fuente: INEGI, nombre
del producto de donde se extrae la información" plus update date where possible, notify end
users of any transformation, and "No debe aparentar que el uso que haga de la información
representa una postura oficial del INEGI". **API vs no-token downloads:** the indicators API
"Para utilizar la API es necesario mandarle un token válido" (https://www.inegi.org.mx/servicios/api_indicadores.html,
read 2026-10-21); the token form asks only for an e-mail ("Su Token será enviado a la cuenta de
correo electrónico proporcionada", https://www.inegi.org.mx/app/desarrolladores/generatoken/Usuarios/token_Verify,
read 2026-10-21); no cost is mentioned. The BIE application shell
(https://www.inegi.org.mx/app/indicadores/?tm=0, read 2026-10-21) shows an export control
"Formato de descarga" with XLS, IQY, CSV, TSV and no login field, but the page is a JavaScript
app and the export was not exercised; the INPC programme page
(https://www.inegi.org.mx/programas/inpc/2018/) returned only its title. Whether INPC "genéricos"
CSVs can be fetched by URL without a token is therefore **[unverified]**; the API route with a
free e-mail token is verified.

**Banxico SIE.** https://www.banxico.org.mx/SieAPIRest/service/v1/ (read 2026-10-21): "Todas las
solicitudes que se realicen al API requieren enviar un token de consulta". The token page
(https://www.banxico.org.mx/SieAPIRest/service/v1/token, read 2026-10-21) asks only for a
security-image code, no registration or e-mail: "El token se genera una sola vez y se usa
cuantas veces se necesite". Limits (https://www.banxico.org.mx/SieAPIRest/service/v1/doc/limiteConsultas,
read 2026-10-21): "Máximo 80 consultas en 1 minuto" and "40,000 consultas por día" for timely
data; "Máximo 200 consultas en 5 minutos" and "10,000 consultas por día" for historical data. The
"Salvedad de uso" (disclaimer/terms) page was linked but **not read** (the doc index returned 404
on both banxico.org.mx and anterior.banxico.org.mx). Because both APIs need a token, any INEGI or
Banxico series would be fetched at build time in GitHub Actions with the token held as a repository
secret, and shipped as a static JSON; nothing runs at read time.

---

## 6. Hosting limits (GitHub Pages and Actions)

GitHub Docs pages show no publication date; all read 2026-10-21.

- **Pages** (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits):
  "Published GitHub Pages sites may be no larger than 1 GB."; "GitHub Pages source repositories
  have a recommended limit of 1 GB."; "GitHub Pages sites have a soft bandwidth limit of 100 GB
  per month."; "GitHub Pages sites have a soft limit of 10 builds per hour." (not applicable to
  custom Actions workflows); "GitHub Pages deployments will timeout if they take longer than 10
  minutes."; "GitHub Pages is not intended for or allowed to be used as a free web-hosting service
  to run your online business" (this app is free and non-commercial).
- **Actions billing** (https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions):
  "GitHub Actions usage is free for self-hosted runners and for public repositories that use
  standard GitHub-hosted runners." The per-plan minute and artifact-storage quotas (2,000
  min / 500 MB on Free) are stated for private repositories.
- **Runners** (https://docs.github.com/en/actions/reference/runners/github-hosted-runners): "Use of
  the standard GitHub-hosted runners is free and unlimited on public repositories."; standard Linux
  runner for public repositories: 4 CPU, 16 GB RAM, 14 GB SSD.
- **Actions limits** (https://docs.github.com/en/actions/reference/limits): "Each job in a workflow
  can run for up to 6 hours of execution time."; workflow run limit 35 days; "GitHub Support cannot
  increase storage limits for GitHub Actions."
- **Pages artifact** (https://github.com/actions/upload-pages-artifact, README, `@v3`): the
  artifact must be "a single gzip archive containing a single tar file", must "not contain any
  symbolic or hard links", must "contain only files and directories", and must "be under 10GB in
  size (we recommend under 1 GB!)"; `retention-days` defaults to 1.
- **Cron on inactive repos** (https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow):
  "In a public repository, scheduled workflows are automatically disabled when no repository
  activity has occurred in 60 days." The page does not define "repository activity"; the safe
  reading is that a commit is needed at least every 60 days, so a weekly job that commits its
  output (or a small "last-run" stamp) keeps itself alive, while a job that only deploys an
  artifact may not.

**Is the weekly job within limits?** Yes, with margin. Measured inputs (owner's download,
2026-10-21): `QQP_2025.rar` 85.1 MB, `QQP_2026.rar` 60.0 MB; the 2025 archive expands to 4.17 GB
of CSV, which fits the 14 GB SSD if files are processed one at a time and deleted. Better still,
the national platform serves each half-month as one uncompressed CSV (135–225 MB) at
`repodatos.atdt.gob.mx/api_update/profeco/programa_quien_es_quien_precios_2025/MM-2025_0N.csv`
(read 2026-10-21), so a weekly job can fetch only the newest file. Output of 50–100 MB of JSON is
well under the 1 GB site limit; artifact retention of 1 day keeps storage negligible; runtime of
minutes is far under 6 hours. The binding limit is **bandwidth**: 100 GB/month is roughly 1,000
full loads of a 100 MB bundle, so the JSON must be split per product/store and loaded lazily, and
the service worker must cache aggressively. RAR extraction on `ubuntu-latest` needs `7z`/`unrar`;
the owner's local extract used 7-Zip ("Type = Rar5"), and whether 7-Zip is preinstalled on the
runner image was **not verified** (install step is cheap either way).

---

## 7. The app's own license: The Unlicense

The repository's `LICENSE` is The Unlicense (verified locally 2026-10-21; text at
https://unlicense.org/, read 2026-10-21): "This is free and unencumbered software released into
the public domain." and "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND". The
unlicense.org page addresses only contributor waivers and says nothing about third-party content.

**What it implies for bundled data.** A public-domain dedication covers the author's own work
only. It does not and cannot relicense PROFECO's data (CC BY 4.0 / Libre Uso MX, attribution
required), OpenStreetMap data (ODbL, attribution and share-alike), Open Food Facts data or images
(ODbL / DbCL / CC BY-SA), or INEGI/Banxico series (attribution). Each data file keeps its own
license. The README must say so in one block, for example:

> The code in this repository is public domain (The Unlicense). The data files under
> `public/data/` are not: price data is PROFECO open data (Creative Commons Attribution 4.0 /
> Términos de Libre Uso MX, credit required, see docs/research/licenses-2026-10.md); store
> geometry is © OpenStreetMap contributors (ODbL). Keep their credits if you reuse them.

Because ODbL is share-alike for derived **databases**, any derived geo file built from OSM data
that the repo publishes is itself under ODbL; the README block above covers that by naming the
license per file.

---

## 8. Summary table

| Source | License | Credit the app shows | Status 2026-10-21 |
|---|---|---|---|
| PROFECO QQP | CC BY 4.0 (dataset page) / Libre Uso MX (historic terms, archived) / DOF decree 2015 | Section 1.3 credit lines | Verified (live pages + archived terms) |
| Walmart México catalogue | Terms not readable (bot check) | None; corpus private, never shipped | Rule in section 2 |
| Open Food Facts | ODbL + DbCL (data), CC BY-SA 3.0 (images) | "Contains data from Open Food Facts, available under the Open Database License" + link | Parked |
| OpenStreetMap / Overpass | ODbL | "© OpenStreetMap contributors" linked to /copyright | Verified; tile policy not read |
| INEGI | Términos de Libre Uso INEGI | "Fuente: INEGI, <producto>, <fecha>" | Parked; API token free by e-mail |
| Banxico SIE | Token required; "Salvedad de uso" not read | TBD after reading salvedad | Parked |
| This repo | The Unlicense (code only) | README block in section 7 | Verified locally |
