# Landscape: why this beats Googling it (research, October 2026)

Written 2026-10-21 by Claude (researcher) for the CompaPrecio rebuild. Every claim carries its
source URL and the date it was read. "Read" means the page was opened and its text extracted
(WebFetch or the Claude desktop built-in browser). Where only a search snippet or a secondary
press article was available, the claim is marked **[snippet]** or **[press]**; where nothing could
be opened, it is marked **[unverified]**. Nothing here is invented. Companion file:
`licenses-2026-10.md`.

---

## 1. PROFECO's "Quién es Quién en los Precios" (QQP)

### 1.1 What PROFECO says the program is

**From the consumer site itself** (https://qqp.profeco.gob.mx/, read in the built-in browser
2026-10-21, section "Sobre Quién es Quién"):

> "El programa Quién en los Precios (QQP) recaba y difunde información de precios de productos de
> consumo regular en el hogar, como alimentos, bebidas, productos de aseo personal y del hogar,
> medicinas, electrodomésticos y artículos de temporada para ofrecer información que te permita
> tomar decisiones de compra mediante la comparación de precios."
>
> "Para recabar los precios se visita una muestra de los principales establecimientos en cada una
> de las ciudades que forman parte del programa durante los cinco días hábiles de la semana."
>
> "Los precios que se muestran contienen la fecha en que fueron tomados, sin embargo, se
> encuentran sujetos a cambios, ya que algunos establecimientos pueden variar sus precios más de
> una vez por día, por lo que deben ser considerados como precios referencia."

The same page promises "los precios de más de 3 mil productos", "cuál es el comercio que vende un
producto al precio más bajo", saved lists, and "la tienda con el menor costo por grupo de la zona
geográfica" (the last promise is not borne out by the UI, see 1.2).

**Who captures prices.** The site says "se visita una muestra de los principales
establecimientos"; it does not say by whom. The legacy help page of the previous site
(https://www.profeco.gob.mx/precios/canasta/ayuda.html, read 2026-10-21, undated) says prices are
"de los últimos 5 días hábiles observados por Profeco" and "La recopilación de precios de los
productos se realiza durante los días hábiles de la semana". A press explainer says prices come
from "visitas periódicas de personal de la Profeco a los puntos de venta" and "se actualizan
semanalmente" (dedinero.com.mx, 2024-03-07, read 2026-10-21) **[press]**.

**Scale, as PROFECO has stated it at different times** (figures differ by date and by what was
being counted):

| Figure | Source (read 2026-10-21) |
|---|---|
| "Semanalmente se recopilan en promedio 200,000 precios ... de 26 ciudades"; "aproximadamente 560 productos genéricos con 3,600 marcas y presentaciones"; "aproximadamente 1,500 establecimientos comerciales, independientes y de las principales cadenas" | Legacy help page https://www.profeco.gob.mx/precios/canasta/ayuda.html (undated, old site) |
| "197 productos en 500 establecimientos" ... "de 32 ciudades del país" (Christmas-season monitoring) | gob.mx press release 2024-11-21, https://www.gob.mx/profeco/prensa/monitorea-profeco-precios-de-articulos-de-temporada-navidena?idiom=es |
| "consultar los precios de tres mil productos" | gob.mx press release 2025-03-04 announcing the new site, https://www.gob.mx/profeco/prensa/profeco-lanza-nuevo-sitio-del-quien-es-quien-en-los-precios-consulta-en-tres-sencillos-pasos?idiom=es-MX |
| 37 cities selectable (list below) | https://qqp.profeco.gob.mx/ city dropdown, 2026-10-21 |
| ~9.4 million price rows Jan–Aug 2026; ~11.4 million Jan–Oct 2025 (nationwide, all catalogues) | Owner's local survey of the open-data CSVs, `data/cache/qqp/scratch/survey.log`, 2026-10-21 |

**Cities in the dropdown (37), 2026-10-21:** Acapulco, Aguascalientes, Apizaco, Campeche, Cancún,
Chihuahua, Ciudad Juárez, Ciudad de México (value `0901`), Cuernavaca, Culiacán, Durango, Estado de
México (`1502`), Guadalajara, Hermosillo, La Paz, La Piedad, León, Monterrey, Morelia, Mérida,
Oaxaca, Orizaba, Pachuca, Playa del Carmen, Puebla, Querétaro, Saltillo, San Luis Potosí, Tampico,
Tijuana, Tlaxcala, Toluca, Torreón, Tuxtla Gutiérrez, Veracruz, Villahermosa, Zacatecas.

**The 2025 relaunch.** PROFECO's release of 2025-03-04 (URL above) describes three steps:
"Seleccionar la ciudad y buscar el producto de preferencia para ver su precio" (with "se puede
filtrar por municipio o alcaldía"), "Elegir los productos que se consideren tienen precios justos
para generar una lista de compras", "Comparar los precios de la lista, para que se pueda enviar
por correo electrónico". It gives no store, city or frequency counts. Press coverage of the same
launch (elimparcial.com, 2025-03-05, read 2026-10-21) adds nothing verifiable beyond "tres mil
productos básicos" **[press]**.

**Weekly bulletins.** PROFECO publishes weekly PDF bulletins for the basic-needs basket at
`https://qqph.profeco.gob.mx/storage/attachment/primeran/2026/QQPPRIMERAN_MMDDYY.pdf` (e.g.
`QQPPRIMERAN_090726.pdf`, 7 September 2026) **[snippet: URLs seen in search results 2026-10-21;
PDFs not opened]**. The qqph.profeco.gob.mx home page is JavaScript-only and returned only a
title to WebFetch (2026-10-21).

### 1.2 What qqp.profeco.gob.mx offers, exactly (tested 2026-10-21)

Test: city "Ciudad de México", search "leche". Result URL pattern:
`https://qqp.profeco.gob.mx/results?city=0901&searchTerm=leche`.

**Has:**
- Search by product name within one city. Filters: "Filtrar por Tipo de Producto" (radio buttons:
  LECHE CONDENSADA, LECHE EN POLVO, LECHE EVAPORADA, LECHE PASTEURIZADA, LECHE ULTRAPASTEURIZADA)
  and "Filtrar por Alcaldía/Municipio". For CDMX the alcaldía filter listed 11 of the 16 alcaldías
  (Álvaro Obregón, Azcapotzalco, Benito Juárez, Coyoacán, Cuauhtémoc, Gustavo A. Madero,
  Iztacalco, Iztapalapa, Miguel Hidalgo, Tlalpan, Venustiano Carranza), consistent with a sample
  of stores rather than full coverage.
- A results table with columns "Producto", "Precio", "Cadena Comercial". Each row shows the full
  presentation text (e.g. "LECHE ULTRAPASTEURIZADA, ALPURA. CLÁSICA, PARCIALMENTE DESCREMADA. CAJA
  200 ML."), the store address (a link to a Google Maps search, e.g.
  `https://www.google.com/maps/search/?api=1&query=BODEGA%20AURRERA%2C%20BOLIVAR%20NO.%20190...`),
  "Fecha de observación: 2026-10-16", the price ("$8") and the chain label ("BODEGA AURRERA",
  "WAL-MART", "MEGA SORIANA", "HIPERMERCADO SORIANA"). Results were ordered by ascending price in
  the test; no sort control was visible. Ten result pages for "leche" in CDMX.
- "Mi lista": tick rows, set a quantity with −/+, "Gran Total", "Guardar lista en PDF", "Enviar
  lista por correo". Test: ticking the same 200 ml Alpura at two different Bodega Aurrera stores
  gave "Gran Total: $16.00", i.e. the list is a plain sum of the ticked rows. It does **not**
  compute a basket total per store or tell you which store is cheapest for the whole list.
- Links to "Datos abiertos del programa Quién es Quién en los Precios" and "Solicitudes de datos
  históricos del programa", and a seasonal PDF ("Comparativo productos para 16 septiembre
  20260914 2.0.pdf").
- Free, no account, no registration (confirmed by use; also stated by adn40.mx, 2026-03-03,
  "No requiere registro ni suscripción" **[press]**).

**Lacks (verified by use, 2026-10-21):**
- No map. Store locations are only outbound Google Maps links.
- No basket total per store, no "cheapest store for my list".
- No price history or trend: each row shows only its latest observation date.
- No per-unit (per litre / per 100 g) price: a 200 ml carton and a 1 L carton appear as raw
  prices side by side.
- No cross-city or cross-chain summaries; one city at a time.
- Online only; nothing is stored on the reader's device beyond the current session.

### 1.3 The QQP open data (what the app will be built on)

- **PROFECO's own portal** https://datos.profeco.gob.mx/ (read 2026-10-21) lists one entry per
  year, "Quién es Quién en los Precios 2015" through "... 2026", plus "Metadatos dataset" and
  "Diccionario de datos dataset"; each links to `file.php?t=<32-hex-hash>` (e.g. 2026:
  `file.php?t=9d62040eae6dcc63e36b8ac821427647`, 2025: `file.php?t=b9540b181657c2bc7735892091e81f96`).
  The page shows no license text and no file sizes.
- **Metadata file** (owner's local copy, downloaded 2026-10-21): title "Programa Quién es Quién en
  los Precios, Enero 2024 - Agosto de 2026."; "Cobertura temporal: 2024-01-01 a 2026-08-31";
  "Última modificación: 31/08/2026"; "Autor: Procuraduría Federal del Consumidor (Profeco)";
  "Punto de contacto: Coordinación General de Educación y Divulgación – Dirección General de
  Estudios sobre Consumo"; "Temporalidad de actualización: Mensual".
- **Data dictionary** (owner's local copy and
  https://datos.profeco.gob.mx/diccionarioDatosQQP.php, 2026-10-21), 15 columns: `producto`,
  `presentacion`, `marca`, `categoria`, `catalogo`, `precio`, `fecha_registro`, `cadena_comercial`,
  `giro`, `nombre_comercial`, `direccion`, `estado`, `municipio`, `latitud`, `longitud`. Latitude
  and longitude are "Localización del establecimiento ... expresada en grados decimales".
- **Observed shape** (owner's local extract, 2026-10-21): `QQP_2025.rar` is 85.1 MB (RAR5) and
  expands to 24 CSVs totalling 4.17 GB (two files per month, `MM-2025_01.csv` / `MM-2025_02.csv`,
  135–225 MB each); `QQP_2026.rar` is 60.0 MB for January–August 2026 (16 CSVs). Row counts per
  half-month run 430k–745k. A sample 2026 row:
  `Aceite,Botella 850 Ml. Vegetal,Ave,Aceites y Grasas Veg. Comestibles,PACIC,28,2026/01/02,Chedraui,Supermercado / Tienda de Autoservicio,Chedraui Sucursal Aguascalientes,...,Aguascalientes,Aguascalientes,21.854349,-102.294259`.
  Note the `catalogo` value **PACIC**: the official anti-inflation basket is tagged in the data
  (see section 4).
- **The national open-data platform** https://www.datos.gob.mx/dataset/programa_quien_es_quien_precios_2025
  (read in the built-in browser 2026-10-21; WebFetch gets HTTP 403 on every datos.gob.mx host)
  describes the set as "información de precios de productos de consumo habitual en el hogar, tales
  como alimentos, bebidas, artículos de higiene personal y del hogar, medicamentos,
  electrodomésticos y productos de temporada" and lists "Licencia: Creative Commons Attribution
  4.0". It serves the same half-month CSVs directly, uncompressed, at
  `https://repodatos.atdt.gob.mx/api_update/profeco/programa_quien_es_quien_precios_2025/MM-2025_0N.csv`
  ("Última actualización: 24 de diciembre de 2025"). Product decision: a weekly job can fetch only
  the newest half-month CSV from this host instead of re-downloading a whole-year RAR.

### 1.4 The PROFECO app

- Google Play listing `mx.gob.profeco.qqp` ("Quien es quien en los precios", publisher
  Procuraduría Federal del Consumidor) appeared in search results, with a snippet saying it was
  last updated 2020-10-13 and had 10,000+ installs **[snippet]**. All three URL variants of the
  listing returned HTTP 404 on 2026-10-21, so the listing appears to have been removed; this is
  the only thing verified.
- No QQP app published by PROFECO was found on the App Store (search restricted to apps.apple.com,
  2026-10-21). PROFECO's only App Store app found is "Litro X Litro PROFECO" (fuel prices)
  **[snippet]**.
- Historical note: PROFECO announced an iOS/Android QQP app with "más de 2,000 productos",
  nearby stores by location and saved searches (xataka.com.mx, 2015-02-24, read 2026-10-21)
  **[press]**. Current PROFECO communications point only to the website.

---

## 2. Other price comparators in Mexico today

**Google Shopping** (https://www.google.com/search?q=leche+lala+entera+1+litro&gl=mx&hl=es-419&udm=28,
read in the built-in browser 2026-10-21). Free. Returned offers from Walmart.com.mx, Bodega
Aurrera, Chedraui, Soriana.com, sams.com.mx, City Club, H-E-B México, Amazon MX, Merco, Jüsto,
Grupo Scorpion, La Ranita de la Paz, Click Abasto, Joinet, Super La Más Chiquita and others, with
"Cerca, 2 km"-style distance tags and sponsored results. The prices are the retailers' **online**
prices, not shelf prices of a named branch; there is no history; and there is no per-unit
normalisation: "Lala leche entera" results ran from MXN 26.50 (1 L) to MXN 455.23 (12 × 1 L)
in the same list. It does cover many chains at once, which is its strength.

**Chain apps** (App Store pages read 2026-10-21). All free, all single-chain, all built for
ordering, none compares across chains; per-unit prices were not verifiable from the listings
**[unverified]**:
- "Walmart - Walmart Express - MX" (Wal-Mart Mexico, Inc.): "Decide si quieres comprar en Walmart
  o en Walmart Express. Consulta disponibilidad de tiendas en la app." Version 26.40 at read time.
  https://apps.apple.com/mx/app/walmart-m%C3%A9xico/id823947897
- "Bodega Aurrera En Línea" (Wal-Mart Mexico, Inc.) **[snippet only]**
  https://apps.apple.com/mx/app/bodega-aurrera-en-l%C3%ADnea/id1435107890
- "Soriana App" (Tiendas Soriana, S.A. de C.V.): update notes say "Ahora puedes buscar productos
  en tienda o en línea, verificar precios y disponibilidad" ("Modo Tienda"); pick-up at a chosen
  branch. Version 33.9.3. https://apps.apple.com/mx/app/soriana-app/id1469594088
- "Chedraui - Tienda en línea" (Tiendas Chedraui, S.A. de C.V.): "Haz tu pedido desde la tienda
  más cercana a tu ubicación." Version 4.0.19. https://apps.apple.com/mx/app/chedraui-tienda-en-l%C3%ADnea/id1239945600

**Tiendeo México** (https://www.tiendeo.mx/, read 2026-10-21). Catalogue/flyer aggregator: shows
catalogue covers with validity dates for La Comer, Fresko, Tiendas Neto, Walmart, Bodega Aurrera,
Chedraui, Sam's Club, Soriana Híper, HEB, Costco, Coppel, Liverpool and others; has a shopping
list, loyalty-card storage, an iOS/Android app. The page says it lets you "comparar los precios"
of favourites but shows no product-level cross-chain comparison on its front page; it works from
promotional catalogues, not from shelf prices. Pricing (free or not) not stated on the page.

**Promodescuentos** (https://www.promodescuentos.com/, read 2026-10-21). Community deals site
("Consumidores reales, ofertas reales"): members post offers from Mercado Libre, Amazon, Samsung,
occasional supermarket coupons. No price-comparison tool.

**"Profeco Precios"** (third-party iOS app, https://apps.apple.com/mx/app/profeco-precios/id6757349713,
read 2026-10-21). Developer "Alejandro Cruz", copyright "Taller de Apps 2026", price **$19.00
MXN**. Description: "Te da acceso directo a precios oficiales recabados por Profeco"; "Canasta
inteligente: Crea listas de compra y descubre cuál establecimiento ofrece el total más económico
para tu canasta de productos"; "Busca cerca de tí: Filtra precios por ciudad o zona". No map
mentioned, no history mentioned, no per-unit mentioned, no affiliation disclaimer. This is the
closest existing product to the thesis below: it reuses the same open data and already claims a
cheapest-store basket, but it is paid, iOS-only and closed.

**Superprice** (Mexican start-up, xataka.com.mx 2022-10-26, read 2026-10-21) **[press]**:
"funciona indexando precios de supermercados y otras tiendas"; chains Arteli, Bodega Aurrera,
Chedraui, Farmacias YZA, Farmacias del Ahorro, HEB, Soriana, Walmart; at that time showed
"precios promedio que se han calculado con base en varias ubicaciones" (no user location);
founder said he would never charge a subscription; iOS/Android. Its site superprice.com.mx
failed DNS twice on 2026-10-21, so current status is **[unverified]**.

**ByPrice** (byprice.com). On 2026-10-21 the domain redirected (HTTP 307) to a GoDaddy
"for sale" page; the service appears defunct. Older press described it as a geolocated
comparator with 10,000+ stores and 500,000 products **[snippet]**.

**ChecaPrecios** (MIT Center for Transportation and Logistics, https://ctl.mit.edu/checaprecios,
read 2026-10-21). A freemium web app for Mexican **shopkeepers** to set prices by comparing with
nearby stores; "2,000+ products across thousands of stores in Mexico"; full launch August 2024;
data source not stated (PROFECO not mentioned). Its own domain checaprecios.mx did not resolve on
2026-10-21 **[unverified]**.

**Delivery aggregators.** Cornershop's app was wound down in Mexico from September 2023 and
folded into Uber Eats (Uber newsroom and xataka.com.mx, 2023) **[snippet]**; Rappi "Turbo" runs
dark stores in CDMX and other cities (dplnews.com, 2025-07) **[snippet]**. These show prices for
ordering, not shelf prices, and are not comparison tools.

**Press "comparativas".** Outlets such as Ámbito, Crónica and Eje Central publish weekly
chain-by-chain basket comparisons based on PROFECO's Monday report **[snippet]**. Editorial, not
tools, and not store-level.

**Not Mexico (false positives in app-store searches, read 2026-10-21):** "Pricely" (Argentina,
id6670457886), "ElDescuentos" (Spain, id6742034576), "Superprecio MCP" (Argentina, glama.ai).

---

## 3. The thesis

Strictly from what was verified above: no free tool today puts PROFECO's store-level survey on a
**map of every monitored CDMX store coloured by one product's price** (qqp.profeco.gob.mx has no
map and the open data carries `latitud`/`longitud` for every row); none computes a **basket total
per store** across all monitored stores (QQP's "Mi lista" only sums the rows you tick; the one app
that claims it, "Profeco Precios", costs MX$19, is iOS-only and closed); none shows **price
history** (the open data goes back to 2015 as yearly files, while the QQP site shows only each
row's latest "Fecha de observación" and Google Shopping shows none); none normalises to
**per 100 g / per 100 ml** across presentations (QQP lists a 200 ml carton beside a 1 L carton;
Google Shopping mixes 1 L with 6- and 12-packs); none lets the reader keep **their own shelf
prices beside the official ones**, stored only in their browser; and none is a **static, free,
no-account, offline-capable** page. The honest limits are also verified: PROFECO samples a subset
of stores (11 of 16 CDMX alcaldías appeared in the "leche" filter), prices are weekly reference
prices that "deben ser considerados como precios referencia", and chain labels in the data
("WAL-MART", "MEGA SORIANA", "HIPERMERCADO SORIANA") need a mapping to the retail brand names
people know.

---

## 4. Mexico's "canasta básica"

### 4.1 The 24-product PACIC basket (price-cap basket, 910 pesos)

- The cap and its origin, from PROFECO: "el precio de la canasta, conformada por 24 productos, no
  será mayor a $910.00 pesos", "al inicio de la estrategia Pacic, en 2022, el precio de esta canasta
  se fijó en $1,039.00 pesos" (gob.mx/profeco press releases, surfaced 2026-10-21 **[snippet]**);
  "mantener el precio de la canasta básica de 24 productos en menos de 910 pesos en la totalidad de
  sus tiendas" (gob.mx press release 2024-12-23,
  https://www.gob.mx/profeco/prensa/profeco-recuerda-que-el-precio-de-la-canasta-basica-debe-costar-maximo-910-pesos?idiom=es-MX, read 2026-10-21).
- The November 2024 renewal (SHCP communiqué no. 64, 2024-11-12,
  https://www.gob.mx/shcp/prensa/comunicado-no-64-se-firma-la-renovacion-del-pacic-2024-2025, read
  2026-10-21) names, "entre otros": "leche entera pasteurizada, huevo blanco, pollo entero, papel
  higiénico, pan de caja, sopa de pasta -spaguetti y codo-, atún en lata, sardina en lata, aceite
  vegetal, arroz, bistec de res de pulpa, harinas comercializadas y harina de maíz básica"; the
  chains that signed: "Walmart, Chedraui, Soriana, La Comer, Merza, Calimax y Aprecio, HEB, Smart,
  Casa Ley, SuperKompras y Super AKI"; commitment "por los próximos seis meses".
- The May 2026 renewal: PROFECO's release of 2026-05-14
  (https://www.gob.mx/profeco/prensa/tiendas-de-autoservicio-ya-senalizan-productos-de-la-canasta-pacic-algunos-muestran-disminucion-de-precio-profeco?idiom=es,
  read 2026-10-21) names Soriana, Chedraui and La Comer as already signposting PACIC products but
  lists only seven items. **The full 24-item list was not found on a gob.mx page this session.**
  The fullest list read is El Imparcial's, which attributes it to PROFECO's presentation at the
  2026-05-14 Mañanera (https://www.elimparcial.com/mexico/2026/05/14/canasta-basica-del-pacic-en-910-pesos-estos-son-los-24-productos-y-como-afecta-a-tu-bolsillo-en-mexico/,
  read 2026-10-21) **[press]**: Aceite vegetal comestible; Arroz en grano; Atún en hojuelas;
  Azúcar estándar; Carne de res; Cebolla blanca; Chile jalapeño; Carne de cerdo; Frijol negro; Huevo
  de gallina; Jabón de tocador; Jitomate saladet; Leche de vaca; Limón; Manzana; Plátano; Pan blanco
  de caja; Papa blanca; Papel higiénico; Pasta para sopa; Carne de pollo; Sardina en tomate en lata;
  Tortilla de maíz de supermercado; Zanahoria. The Presidency's stenographic version of that
  conference exists (https://www.gob.mx/presidencia/es/articulos/version-estenografica-conferencia-de-prensa-de-la-presidenta-claudia-sheinbaum-pardo-del-14-de-mayo-de-2026)
  but was not read **[unverified]**.
- **Product decision:** the open data tags these products itself (`catalogo = "PACIC"`, verified
  on a 2026 row, section 1.3), so the app can take the official basket straight from the data
  rather than from a transcribed list, and PROFECO's weekly "primera necesidad" bulletins use the
  same 24-product basket.

### 4.2 The 40-product Diconsa/Segalmex basket (rural supply basket)

Numbered list of 40, as reproduced in the Gaceta Parlamentaria (Senate, PAN group proposition),
year XXIII no. 5436-X, 2020-01-15, https://gaceta.diputados.gob.mx/Gaceta/64/2020/ene/20200115-X.html
(read 2026-10-21): 1 Maíz; 2 Frijol; 3 Arroz; 4 Azúcar; 5 Harina de maíz enriquecida; 6 Aceite
vegetal comestible; 7 Atún; 8 Sardina; 9 Leche fluida, en polvo y derivado de la leche; 10 Chiles
envasados; 11 Café soluble (con y sin azúcar); 12 Sal de mesa; 13 Avena; 14 Pasta para sopa;
15 Harina de trigo; 16 Chocolate; 17 Galletas marías, de animales y saladas; 18 Lentejas; 19 Jabón
de lavandería; 20 Jabón de tocador; 21 Papel higiénico; 22 Detergente en polvo; 23 Crema dental;
24 Carne de res; 25 Carne de puerco; 26 Carne de pollo; 27 Tostadas; 28 Pan de caja y de dulce;
29 Huevo fresco; 30 Pescado seco; 31 Agua purificada; 32 Golosina de amaranto, cacahuate, etc.;
33 Puré de tomate envasado; 34 Frutas deshidratadas; 35 Jamaica y tamarindo naturales;
36 Concentrados sin azúcar para elaboración de bebidas; 37 Gelatina; 38 Garbanzos, chícharos y
soya; 39 Cuadro básico de frutas y verduras; 40 Pilas.

Executive-branch confirmation of the same items (read 2026-10-21): LICONSA, "Canasta básica se
fortalce con 40 productos", 2019-01-30, https://www.gob.mx/liconsa/articulos/canasta-basica-se-fortalce-con-40-productos
(lists the items in prose); Diconsa, "Canasta Básica SEGALMEX-DICONSA", 2019-09-12,
https://www.gob.mx/diconsa/es/articulos/canasta-basica-segalmex-diconsa?idiom=es (names the 17
additions). The campaign page https://www.gob.mx/canastabasica returned 404 on 2026-10-21.
Segalmex/Diconsa have since been reorganised under "Alimentación para el Bienestar" **[snippet,
unverified]**; the list above is the 2019 list and may not be the current rural supply list.

---

## 5. Supermarket chains in Mexico City

Formats are from each group's own corporate site unless marked. QQP's own chain labels seen in
CDMX results on 2026-10-21 are given in brackets where observed; the app needs a label-to-brand
table.

**Walmart de México y Centroamérica** (https://www.walmartmexico.com/ and
https://www.walmartmexico.com/conocenos/lineas-de-negocio, read 2026-10-21): "3,154 están en
México" of 4,079 stores in the region (year not stated on the page; the site shows "© 2026").
- Bodega Aurrera: discount format, "Contamos con más de 2,500 tiendas" [QQP: "BODEGA AURRERA"].
  Sub-formats Mi Bodega Aurrera and Bodega Aurrera Express are not described on the page
  **[unverified]**.
- Walmart Supercenter: hypermarket, "una gran diversidad de productos para todas las necesidades"
  [QQP: "WAL-MART"].
- Walmart Express: supermarket format (site super.walmart.com.mx). The former Superama brand does
  not appear on the corporate page; its rebranding to Walmart Express was not verified from an
  official page this session **[unverified]**.
- Sam's Club: membership club (sams.com.mx; the site is behind a "no eres un robot" check,
  2026-10-21).

**Organización Soriana** (https://www.organizacionsoriana.com/formatos_de_tienda.html, read in the
built-in browser 2026-10-21; the format names are images, descriptions are text, order as on the
page): hypermarket "superficie de venta promedio de 7,000 m2" with "ropa, mercancías generales,
abarrotes, frescos y alimentos preparados" (Soriana Híper) [QQP: "HIPERMERCADO SORIANA"];
supermarket "piso de venta promedio de 2,500 m2" for "consumo frecuente" (Soriana Súper);
"Una tienda austera pero agradable ... piso de ventas promedio de 5,000 m2" with "precios bajos"
(Soriana Mercado; QQP label "MEGA SORIANA" was also seen and must be mapped by store name
**[mapping unverified]**); "piso de venta promedio de 1,500 m2" for small towns (Soriana Express);
soriana.com e-commerce; "Club de Precios ... aproximadamente 8,000 m2" (City Club); Sodimac
(home improvement). Counts at end-2025 per the BMV Q4-2025 report: 372 Híper, 136 Súper, 165
Mercado, 106 Express, 41 City Club, 820 total **[snippet; PDF not opened]**.

**Grupo Comercial Chedraui** (https://inversionistas.grupochedraui.com.mx/ and
https://inversionistas.grupochedraui.com.mx/formatos/, read 2026-10-21): "opera en 25 estados de
la República Mexicana con cinco formatos"; "PERFIL CORPORATIVO JUNIO 2026": 221 Tiendas Chedraui,
83 Super Chedraui, 7 Super Che, 379 Supercito, 38 Tiendas Arteli.
- Tiendas Chedraui: "Alrededor de 64,500 SKU's", "Piso de venta promedio de 6,428 m2", groceries,
  perishables, general merchandise, clothing, electronics.
- Súper Chedraui: "Aproximadamente 25,900 SKU's", "2,128 m2".
- Súper Che: "Aproximadamente 10,200 SKU's", "1,059 m2", "Opera en grandes ciudades".
- Supercito: "Aproximadamente 2,300 SKU's", "273 m2", "zonas con alta densidad de población".
- Arteli: north-east Mexico only (not CDMX).
- Selecto: premium concept "Presente en los formatos de Tiendas Chedraui, Súper Chedraui y
  Supercito" (35 / 13 / 11 stores).

**La Comer, S.A.B. de C.V.** (https://lacomerfinanzas.com.mx/, read 2026-10-21): "La empresa
opera 93 tiendas localizadas principalmente en el área metropolitana y región centro de la
República Mexicana". Formats named on the site: La Comer, City Market, Fresko (Sumesa is the
fourth format but is not named on the home page). Per-format counts at end-2024 per the BMV
Q1-2025 report: 38 La Comer, 22 Fresko, 16 City Market, 13 Sumesa **[snippet; PDF not opened]**.
Format descriptions from the home-page carousel (unattributed to a format in the extracted text):
"productos gourmet, orgánicos y saludables" (City Market by common knowledge **[unverified
attribution]**).

**Costco de México**: store finder https://www.costco.com.mx/store-finder returned only the word
"Costco" to WebFetch (JavaScript-only), so warehouse counts for CDMX are **[unverified]**.

**H-E-B México**: https://www.heb.com.mx/ (read 2026-10-21) shows no store directory and no
mention of Ciudad de México; PROFECO monitors H-E-B in northern cities (release of 2024-12-23,
above). "H-E-B has no CDMX stores" is consistent with this but **[unverified from an official
page]**.

**Other chains that appear in PROFECO/PACIC material** (SHCP 2024-11-12): Merza, Calimax, Aprecio,
S-Mart, Casa Ley, SuperKompras, Super AKI (regional, mostly outside CDMX).

**Brand colours.** Walmart publishes a public Brand Center
(https://brandcenter.walmart.com/brand/brand-identity/color, read in the built-in browser
2026-10-21) naming "True Blue", "Spark Yellow", "White", "Bentonville Blue", "Everyday Blue" and
"Sky Blue"; the HEX/CMYK specs are image assets that were not transcribed, and third-party
palette sites disagree with each other (#0071CE vs #0053E2 for the blue) **[unverified]**. The
same site has a "Trademarks" section (not read). No public brand guidelines were found for
Soriana, Chedraui, La Comer or Costco (not searched exhaustively). Product decision: the app
identifies chains by **name only** and uses its own neutral palette; no logos, no attempt at
"official" colours until a guideline is read.
