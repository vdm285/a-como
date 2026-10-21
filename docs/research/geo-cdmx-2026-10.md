# Base map of Mexico City for the price map — sources, licences, pipeline (2026-10-21)

What this is: the research and build notes for `public/data/geo/cdmx.json`, the one committed
geometry file the app draws with d3-geo (SVG). No tile server, no keys, no runtime cost. The
file is produced by `tools/build-geo.mjs` (Node built-ins only, no packages), run by hand.

Result (built 2026-10-21): **167,751 bytes**, 94 features, 7,248 vertices, WGS84 lon/lat with
5 decimals. Preview: `data/cache/geo/preview.svg` (1600x1200). Everything below was checked
on 2026-10-21; re-check the licence pages before a release if more than a year has passed.

## 1. Sources and licences (checked before use)

### 1.1 INEGI — Marco Geoestadístico, diciembre de 2025 (alcaldías and ZMVM municipalities)

- Product: INEGI, *Marco Geoestadístico, diciembre de 2025*, municipal polygons (AGEM), served
  by INEGI's own keyless web service "Servicio Web del Catálogo Único de Claves Geoestadísticas"
  (<https://www.inegi.org.mx/servicios/catalogounico.html>). The service's GeoJSON responses carry
  the metadata `"Fuente_informacion_vectorial": "INEGI. Marco Geoestadístico, diciembre de 2025"`,
  which is the product name recorded in `meta.sources`.
- URLs used (GET, no key, no registration):
  - `https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/09` — the 16 alcaldías of Ciudad de México (485 KB).
  - `https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/15` — the 125 municipalities of Estado de México (4.8 MB), filtered to the metro list.
- Retrieved: 2026-10-21. Cached copies: `data/cache/geo/inegi/mgem-09.json`, `mgem-15.json` (+ `.meta.json` sidecars with URL, date, size).
- Licence: **"Términos de Libre Uso de la Información del INEGI"** (<https://www.inegi.org.mx/inegi/terminos.html>),
  also known as "Libre Uso MX". The page grants, verbatim (section "El usuario"):
  "Puede hacer y distribuir copias de la información, sin alterar ni suprimir sus metadatos",
  "Puede difundir y publicar la información", "Puede adaptar y reordenar la información",
  "Puede extraer total o parcialmente la información", "Puede explotar comercialmente la
  información, utilizándola como insumo para generar otros productos o servicios".
- Obligations, verbatim: "Debe otorgar los créditos correspondientes al INEGI como autor, y cuando
  técnicamente sea posible, mencionar la fuente de extracción de la información de la siguiente
  manera: Fuente: INEGI, nombre del producto de donde se extrae la información"; "No debe
  aparentar que el uso que haga de la información representa una postura oficial del INEGI";
  the user must tell end users about any analysis or transformation of the information (we
  simplified the polygons; this document and `meta` say so).
- **Required attribution wording:** `Fuente: INEGI, Marco Geoestadístico, diciembre de 2025`.
- Not found: a Biblioteca Digital "ficha" page for the December 2025 edition (searched
  2026-10-21). The edition name comes from the service's own metadata; the INEGI MG landing page
  is <https://www.inegi.org.mx/temas/mg/> (JavaScript-rendered; downloads not listed in plain HTML).
  The service page's catalogue text still mentions "diciembre 2023" as its base cartography while
  the responses say December 2025; the responses are the authoritative statement of what we got.

### 1.2 Checked but not used — Portal de Datos Abiertos de la Ciudad de México

- Dataset "Límite de Alcaldías (áreas geoestadísticas municipales)",
  <https://datos.cdmx.gob.mx/dataset/alcaldias>, author/maintainer INEGI, CKAN licence id
  `CC-BY-4.0-ESP` (`package_show` on 2026-10-21; the CKAN `license_list` does not define that id,
  so the portal shows the name without a link to the licence text; the record also has
  `"isopen": false`, which is probably just the unmapped id). GeoJSON (774 KB, last modified
  2026-08-28):
  `https://datos.cdmx.gob.mx/dataset/bae265a8-d1f6-4614-b399-4184bc93e027/resource/deb5c583-84e2-4e07-a706-1b3a0dbc99b0/download/deb5c583-84e2-4e07-a706-1b3a0dbc99b0.json`.
- It is the same INEGI geometry re-published. INEGI's own service was preferred because it is
  the primary source, keyless, and its licence text is unambiguous. This is the fallback if the
  INEGI service goes away.

### 1.3 OpenStreetMap via the Overpass API (roads, green, water, airports)

- Data: OpenStreetMap, © OpenStreetMap contributors, retrieved 2026-10-21 through the public
  Overpass instance `https://overpass-api.de/api/interpreter` (FOSSGIS). The responses include
  `"copyright": "The data included in this document is from www.openstreetmap.org. The data is
  made available under ODbL."`; `timestamp_osm_base` 2026-10-21T22:11Z.
- Licence: **Open Database License (ODbL) 1.0** — <https://www.openstreetmap.org/copyright>:
  "OpenStreetMap® is open data, licensed under the Open Data Commons Open Database License
  (ODbL) by the OpenStreetMap Foundation (OSMF)". Requirements from that page and from the OSMF
  *Attribution Guidelines* (<https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>):
  credit OpenStreetMap, make clear the data is under the ODbL, link "OpenStreetMap" to
  openstreetmap.org/copyright; historical accepted form "© OpenStreetMap contributors". For
  interactive maps the credit "should typically appear in a corner of the map"; it may collapse
  after dismissal or after about five seconds as long as the licence information "must still be
  able to be found if they look for it". For derived databases: include the attribution and the
  ODbL text or a link to it where users would look for it (this file's `meta` and this doc do).
- **Required attribution wording:** `© OpenStreetMap contributors` (link to
  <https://www.openstreetmap.org/copyright>), plus "ODbL" visible or one click away.
- Overpass usage rules (<https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances>,
  read 2026-10-21): assume fewer than 10,000 queries, under 1 GB and under 10 minutes of
  processing per day, "divided by 100" for regular use; a `User-Agent` or `Referer` that uniquely
  identifies the app; no parallel scripts; pause 30 s after HTTP 429/406; cache; commercial users
  should self-host. How the build obeys them: User-Agent
  `CompaPrecio-geo-build/0.1 (+https://github.com/vdm285/CompaPrecio; one-off base-map build)`,
  **two** queries per build (roads, areas), sequential, 6 s pause between live queries, responses
  cached on disk and reused unless the query text changes or `--refresh` is passed, retry after
  35 s on 429/406/503/504. During this research five extra tags-only reconnaissance queries were
  run to learn the real OSM names and ids (about 12 MB in total for the day).

### 1.4 Attribution line the app must display

Spanish, as stored in `meta.attribution`:

`Mapa: © OpenStreetMap contributors (ODbL). Límites: Fuente: INEGI, Marco Geoestadístico, diciembre de 2025.`

"OpenStreetMap" should link to <https://www.openstreetmap.org/copyright> and "ODbL" to
<https://opendatacommons.org/licenses/odbl/>. Put it in a corner of the map or in an "Acerca de"
reachable from the map. `meta.sources[]` holds the per-layer entries.

Licence interplay to confirm with a human (section 7): the OSM-derived layers in `cdmx.json`
are a *derivative database* under the ODbL and are therefore published under the ODbL (this
repo is public, the file carries the notice); the INEGI layers sit beside them as independent
collections in one container, which the ODbL treats as a *collective database* (no share-alike
on the INEGI part). Store dots drawn on top are a *produced work*, not part of the database.

## 2. What the file contains

`public/data/geo/cdmx.json` = `{ meta, alcaldias, zmvm, roads, green, water, airport }`, each
layer a GeoJSON FeatureCollection, each feature `properties: { name, key, class? }` and nothing else.

| layer | features | bytes | what |
|---|---|---|---|
| meta | — | 3,082 | built, sources, bbox, view, projection, attribution |
| alcaldias | 16 | 32,468 | INEGI polygons, `key` = cvegeo (09002–09017), `name` = INEGI name |
| zmvm | 23 | 46,117 | 19 listed Edomex municipalities + 4 that touch CDMX; `key` = cvegeo |
| roads | 19 | 31,971 | one feature per artery (LineString or MultiLineString), `class` ∈ ring, expressway, avenue, highway |
| green | 22 | 39,869 | polygons, `class` ∈ park, forest, wetland |
| water | 12 | 11,950 | polygons, `class` ∈ lake, canal, reservoir, basin, wetland |
| airport | 2 | 2,226 | AICM and AIFA |
| **total** | **94** | **167,751** | under the 300 KB ceiling (budget table in the script) |

### 2.1 alcaldias (INEGI, 16)
Álvaro Obregón 09010, Azcapotzalco 09002, Benito Juárez 09014, Coyoacán 09003, Cuajimalpa de
Morelos 09004, Cuauhtémoc 09015, Gustavo A. Madero 09005, Iztacalco 09006, Iztapalapa 09007, La
Magdalena Contreras 09008, Miguel Hidalgo 09016, Milpa Alta 09009, Tláhuac 09011, Tlalpan 09012,
Venustiano Carranza 09017, Xochimilco 09013. Raw 17,414 vertices → simplified (see §3).

### 2.2 zmvm (INEGI, 23)
Listed (19): Naucalpan de Juárez, Tlalnepantla de Baz, Huixquilucan, Atizapán de Zaragoza,
Cuautitlán Izcalli, Tultitlán, Coacalco de Berriozábal, Ecatepec de Morelos, Nezahualcóyotl,
Chimalhuacán, La Paz, Ixtapaluca, Chalco, Valle de Chalco Solidaridad, Texcoco, Tecámac,
Nicolás Romero, Cuautitlán, Chicoloapan. Added automatically because they share a boundary
vertex with an alcaldía (4): Juchitepec, Tianguistenco, Ocoyoacac, Xalatlaco (rural; drop them
from `ZMVM_NAMES`/the touching rule if the frame should stay urban). 2,836 boundary vertices are
bit-identical between the CDMX and Edomex files, so the state line is simplified once (§3).

### 2.3 roads (OSM, 19 of 19 requested found)
Selection: one Overpass query for `highway` ∈ motorway/trunk/primary/secondary ways in the bbox
whose `name` or `ref` matches the arteries; then ordered rules in the script assign each way to
one road. OSM tagging that made this reliable: Circuito Interior is `ref=CTO INT`, Periférico
`ref=PERIF`/`PERIF N1` (the elevated second deck is `PERIF N2`, excluded), Viaducto `ref=VDCTO A`,
Eje Central `ref=EJE CENTRAL` (its name changes eight times), highways by name.

| key | name | class | lines | km | notes |
|---|---|---|---|---|---|
| periferico | Anillo Periférico | ring | 3 | 95 | as OSM tags it: Blvd Manuel Ávila Camacho from Cuautitlán south, Poniente, Sur, Oriente (Canal de Garay), the Neza border and Río de los Remedios back west; segundo piso and Autopista Urbana excluded |
| circuito-interior | Circuito Interior | ring | 2 | 42 | includes its Patriotismo/Revolución and Río Churubusco stretches |
| viaducto | Viaducto Miguel Alemán | expressway | 1 | 12 | Miguel Alemán + Río de la Piedad |
| insurgentes | Avenida de los Insurgentes | avenue | 2 | 29 | Sur + Centro + Norte, inside CDMX |
| reforma | Paseo de la Reforma | avenue | 3 | 19 | Reforma Norte + Reforma + Prolongación (Santa Fe) |
| tlalpan | Calzada de Tlalpan | avenue | 1 | 15 | |
| zaragoza | Calzada Ignacio Zaragoza | avenue | 1 | 14 | |
| constituyentes | Avenida Constituyentes | avenue | 1 | 7 | |
| eje-central | Eje Central Lázaro Cárdenas | avenue | 2 | 25 | |
| universidad | Avenida Universidad | avenue | 1 | 8 | |
| churubusco | Río Churubusco | avenue | 2 | 8 | only the part that is not Circuito Interior (Eje 4 Oriente) |
| ermita | Ermita Iztapalapa | avenue | 2 | 18 | 16 % of its vertices lie within 100 m of its other line (laterals); harmless overdraw |
| chapultepec | Avenida Chapultepec | avenue | 1 | 3 | |
| patriotismo-revolucion | Patriotismo / Revolución | avenue | 1 | 4 | only the part south of Circuito Interior (Revolución to San Ángel); the rest is drawn by circuito-interior |
| mex-toluca | Carretera México–Toluca | highway | 5 | 46 | libre (MEX 15) + cuota (MEX 15D) |
| mex-queretaro | Carretera México–Querétaro | highway | 2 | 31 | MEX 57 / 57D, from Periférico Norte to the frame |
| mex-pachuca | Carretera México–Pachuca | highway | 5 | 78 | cuota (MEX 85D) + libre (MEX 85, including its Ecatepec name "Vía Morelos") |
| mex-puebla | Carretera México–Puebla | highway | 5 | 74 | Autopista (MEX 150D) + libre (MEX 150) |
| mex-cuernavaca | Carretera México–Cuernavaca | highway | 2 | 63 | cuota (MEX 95D) + libre (MEX 95) |

Not found / not attempted: nothing from the list is missing. "Avenida Paseo de la Reforma (the
whole length)" is the same feature as Reforma (Norte, centre and Prolongación together).

### 2.4 green (OSM, 22), water (12), airport (2)
Selected by OSM object id (r = relation, w = way) after tags-only reconnaissance; names are the
OSM names, keys are slugs. Areas are from the raw OSM rings.

green: Bosque de Chapultepec (unnamed forest/park ways inside the park's box, 3.46 km²; OSM
has no single named polygon for the park, so its three sections are only partly covered — the
real park is ~6.9 km²); Desierto de los Leones r930915 15.2 km²; Parque Nacional El Ajusco
r17528776 5.0; Reserva Ecológica Comunitaria San Miguel Ajusco r17528809 11.7; REC San Miguel
Topilejo r17541959 62.8; REC San Nicolás Totolapan r17528703 19.9; REC San Bernabé Ocotepec
r17509281 2.4; Parque Ecológico de la Ciudad de México r17528561 8.6; Área Comunitaria de
Conservación Ecológica Milpa Alta r17541991 75.2; Bosque de Tlalpan r8212057 2.4; Viveros de
Coyoacán w26966883 0.4; Cerro de la Estrella r17542037 (+ w27284561, largest kept) 1.5; Sierra de
Guadalupe r17508842 + w1258850012 + w1258025520 58.6; Sierra de Santa Catarina r17542258 7.5;
Ejidos de Xochimilco y San Gregorio Atlapulco r17495765 24.0 (the chinampas); Parque Ecológico de
Xochimilco r5377444 1.5; Parque Ecológico Lago de Texcoco w1411608827 1.9; Bosque de San Juan de
Aragón r20008211 1.6; Parque Nacional El Tepeyac r17509182 1.5; Parque Nacional Los Remedios
w1425665063 1.5; Lomas de Padierna r17509251 0.3; Parque Nacional Bosque Pedregal r17528106 2.5.

water: Lago de Chapultepec r14453733 + r2070280 + r2070356 (0.14 km²); Canales de Xochimilco
r5376014 (9.7, the `water=canal` multipolygon = the canals' main area); Laguna de San Gregorio
Atlapulco w60844806; Humedales de Tláhuac r11996995; Lago de los Reyes Aztecas w52901841; Presa
Madín r20239423 (inside the bbox); Presa Lago de Guadalupe r16073668; Laguna Nabor Carrillo
w4780696; El Caracol r14484155; Laguna de Zumpango r18057404 (clipped by the frame's north
edge); Lago del Bosque de San Juan de Aragón r549573; Lago de Regulación Churubusco w52503893.

airport: Aeropuerto Internacional de la Ciudad de México r11952425 (+ w1429419990, largest
kept) 7.1 km²; Aeropuerto Internacional Felipe Ángeles w136142100 34.9 km² (extra, inside the frame).

Dropped on purpose: "Área de Protección de Flora y Fauna Corredor Biológico Chichinautzin"
(r10508407 + r930903, 333 km²): most of it is in Morelos, outside every polygon of the file, and
it painted the frame's bottom edge green; the CDMX part is already covered by the Ajusco/Topilejo/
Milpa Alta reserves. Holes (inner rings) of OSM multipolygons are ignored at this scale.

## 3. Simplification — what and how much

- Algorithm: Douglas–Peucker (iterative, tolerance in metres on a local flat frame:
  1° lon = 105.0 km, 1° lat = 110.6 km at 19.4° N), implemented in the script; no packages.
- **Shared borders stay consistent.** Every admin ring is cut into arcs at the vertices where the
  set of rings containing the vertex changes (336 distinct arcs for the 39 polygons); each arc is
  simplified once with the strictest tolerance of the layers using it and reassembled, so
  neighbouring alcaldías, and the CDMX/Edomex line, do not show slivers or gaps.
- Tolerances (auto-raised ×1.25 per round until a layer fits its byte budget):
  alcaldías 45 m (17,414 → ~1,450 vertices), zmvm 90 m, roads 12 m, parks/lakes 15 m ×1.25 (green)
  / ×1.95 (water), forests/wetlands 40 m × the same factors, airports 20 m.
- Roads: ways are chained end to end into one line per carriageway (best road class, then longest
  continuation wins), then a "shadow" pass drops any stretch running within a radius of an
  already-kept line of the same road (140 m Periférico, 120 m Circuito Interior, 130 m Tlalpan and
  Zaragoza, 80 m other avenues, 250 m highways, which also merges libre/cuota where they run side
  by side); a chain shadows itself too, which is what removes the opposite carriageway when OSM
  joins both at a U-turn. Gaps under 120 m are bridged; city roads keep only lines within 3 km of
  their longest line (drops same-named streets in other towns); lines under 1 km are dropped.
- Polygons: rings under 0.05 km² (admin) / 0.01 km² (areas) dropped after clipping to the frame;
  coordinates rounded to 5 decimals (~1 m) and consecutive duplicates removed.
- Orientation: exterior rings clockwise, holes anticlockwise — the d3-geo convention, opposite to
  RFC 7946. A planar library that cares about winding needs a rewind.

## 4. Frame, view and projection

- `meta.bbox` (data frame, everything is clipped to it): `[-99.549, 19.033, -98.617, 19.824]`
  = extent of the 16 alcaldías plus the 19 listed municipalities, padded 0.015°. It is wide
  because Nicolás Romero reaches far west and Texcoco far east; set `BBOX_OVERRIDE` in the script
  to tighten it (the polygons then get cut at the frame).
- `meta.view` (suggested initial fit): `[-99.385, 19.028, -98.92, 19.613]` = CDMX plus 0.02°.
- Projection recommendation (also in `meta.projection`): conic equal-area centred on CDMX,
  `d3.geoConicEqualArea().parallels([19.2, 19.7]).rotate([99.15, 0]).center([0, 19.43])
  .fitExtent([[pad, pad], [width - pad, height - pad]], frame)` where `frame` is a GeoJSON
  Polygon of `meta.view` (ring closed clockwise). Alternative with the same look at this scale:
  `d3.geoTransverseMercator().rotate([99.15, 0]).center([0, 19.43])`. The preview SVG uses a
  plain Mercator, which is fine for a check but not what the app should use.

## 5. What the preview shows (`data/cache/geo/preview.svg`)

Faint grey Edomex municipalities around the white alcaldías; the Periférico ring and Circuito
Interior in black, Viaducto dark, avenues grey, highways brown leaving the frame to Querétaro
(NW), Pachuca (NE, libre and cuota), Puebla (E), Toluca (W) and Cuernavaca (S); green masses on
the Sierra de Guadalupe (N), Sierra de Santa Catarina (E), the Ajusco and Desierto de los Leones
(SW) and the Xochimilco ejidos (S); blue for Lago de Guadalupe, Zumpango, Madín, the Texcoco
lakes (Nabor Carrillo, El Caracol) and the Xochimilco canals; the two airports in grey; labels
on every polygon and an attribution line at the bottom.

## 6. Known gaps and caveats

1. Bosque de Chapultepec is not one named polygon in OSM; the file carries the real but unnamed
   forest/park pieces inside the park's box (about half the park). Fix upstream in OSM or accept.
2. Periférico is what OSM tags as Periférico, which is more than the colloquial ring: it includes
   the Río de los Remedios/Neza-border loop and the boulevard north to Cuautitlán.
3. Highways: libre and cuota are both in the file under one key; where they run within 250 m of
   each other only one is kept. Mex-Pachuca libre carries its Ecatepec name Vía Morelos.
4. Patriotismo/Revolución is split between `circuito-interior` (the part that is the Circuito) and
   `patriotismo-revolucion` (the rest); label accordingly.
5. The four "touching" municipalities (Juchitepec, Tianguistenco, Ocoyoacac, Xalatlaco) are rural
   and widen the frame; remove if unwanted.
6. INEGI's geostatistical boundaries are not legal boundaries (INEGI says so in its terms); fine
   for a base map.
7. Not verified in the field: every road's name coverage comes from OSM tagging on 2026-10-21;
   Ermita Iztapalapa has a 1.4 km lateral stretch drawn twice.
8. The INEGI December-2025 edition has no product page we could cite; the service metadata is
   the evidence (cached response files keep it).
9. `data/cache/geo/check.png` and `check.svg` appeared in the cache during this build and were
   not written by the script; left untouched.
10. OSM reserve polygons do not follow INEGI's lines: 10 % of the vertices of "Área Comunitaria de
    Conservación Ecológica Milpa Alta" fall outside every admin polygon of the file (it crosses
    into Morelos, which is not drawn), so a sliver of green shows past the state line at the
    bottom of the frame. Every other green feature is at least 95 % inside.
11. `data/cache/` is git-ignored, so `preview.svg` and the download cache stay on this machine;
    only `cdmx.json`, the script and this document are meant to be committed.

## 7. Decisions that need a human

- Confirm the attribution placement (map corner vs "Acerca de") and that publishing
  `cdmx.json` in the public repo under the ODbL for its OSM layers is acceptable (§1.4).
- Keep or drop the four rural touching municipalities and the AIFA airport.
- Tighten the frame (`BBOX_OVERRIDE`) or rely on `meta.view` for the initial fit.
- Whether to add the three Chapultepec sections by hand-picked OSM ids once mapped.

## 8. How to re-run

```
node tools/build-geo.mjs            # uses data/cache/geo/ when the query text is unchanged
node tools/build-geo.mjs --refresh  # download everything again (2 Overpass queries + 2 INEGI)
node tools/build-geo.mjs --offline  # never touch the network; fails if something is not cached
GEO_DEBUG=zaragoza node tools/build-geo.mjs --offline   # print chain/run details for one road
```
Outputs: `public/data/geo/cdmx.json`, `data/cache/geo/preview.svg`, `data/cache/geo/build-report.json`
(per-road counts, line lengths, OSM ids, the exact Overpass queries). The cache sidecars
`*.meta.json` record URL, retrieval date and size of every download. Dev aids kept in the cache:
`data/cache/geo/_probe/render.ps1` (rasterises the JSON to PNG with .NET, optional `-Bbox`) and
`_probe/verify.mjs` (checks size, properties, decimals, winding, closure). Budgets, the ZMVM
list, road rules and OSM ids live at the top of the script. Everything downloaded stays under
`data/cache/geo/` (D: only); nothing is written to C:. Commit `cdmx.json` by hand after looking
at the preview; the pipeline is not meant for CI.
