# PROFECO "Quién es Quién en los Precios" (QQP) — research notes, October 2026

Written 2026-10-21 from the real files, for the prices pipeline `tools/build-qqp.mjs` (mechanics in
`docs/PIPELINES.md`). Everything below was measured on the 2025 and 2026 archives downloaded that day;
numbers that come from a script say which one. Retrieval dates are UTC unless stated.

## 1. In one paragraph

QQP is PROFECO's price survey: field staff visit stores and write down shelf prices. The open-data
export is one RAR per year with two CSVs per month (first half, second half), 15 columns per row, one
row per (product, store, date). 2025 + 2026 (January to August) hold **22,658,981 rows** from
**2,486 stores** in 30 states; the Mexico City metro area is **7,812,161 rows (34.5 %)** from
**571 stores**, of which **153 are supermarkets** visited about **once a week**. Store coordinates
are given and almost always right. The licence is CC BY 4.0 (the datos.gob.mx record) under the
Government of Mexico's "Términos de Libre Uso"; the attribution it asks for is in section 13.
The build for the city, after the rules in section 12, is 499 stores, 2,366 products, 677 generic
products, 88 ISO weeks (2024-12-30 to 2026-08-31), 54 MB in 5,236 static JSON files.

## 2. Sources and retrieval

| What | URL | Retrieved | Result |
|---|---|---|---|
| Open-data page | https://datos.profeco.gob.mx/datos_abiertos/qqp.php | 2026-10-21 | HTTP 200, 4,188 bytes. Links for 2015 to 2026 plus "Metadatos dataset" and "Diccionario de datos dataset", each `file.php?t=<32-hex token>`. **No licence or terms text anywhere on the page** (grep for licencia, libre uso, términos, creative, atribuci: nothing). Google Analytics tag, gob.mx framework CSS. |
| Data dictionary page | https://datos.profeco.gob.mx/diccionarioDatosQQP.php | 2026-10-21 | HTTP 200, 4,308 bytes. Table of 15 columns with uppercase accented names (PRODUCTO, PRESENTACIÓN, …, FECHAREGISTRO, CADENACOMERCIAL, NOMBRECOMERCIAL, DIRECCIÓN, LATITUD, LONGITUD) and types (Carácter (65), Número (18,2), Datetime (8), Número (18,6)). No licence text. |
| 2026 archive | https://datos.profeco.gob.mx/datos_abiertos/file.php?t=9d62040eae6dcc63e36b8ac821427647 | 2026-10-21T22:27:44Z | `QQP_2026.rar`, **59,971,365 bytes**. Headers: `Content-Type: application/x-rar`, `Content-disposition: inline; filename=QQP_2026.rar`, `Transfer-Encoding: chunked` (no Content-Length, so the size is unknown until downloaded; HEAD says 0), `Cache-Control: no-store`. 41 s with curl. |
| 2025 archive | https://datos.profeco.gob.mx/datos_abiertos/file.php?t=b9540b181657c2bc7735892091e81f96 | 2026-10-21T22:28:26Z | `QQP_2025.rar`, **85,141,166 bytes**. Same headers. 42 s. |
| Metadata | https://datos.profeco.gob.mx/datos_abiertos/file.php?t=42ed7dad4da507b9d536d9b737e7912d | 2026-10-21T22:26:57Z | `QQP_metadatos_dataset.csv`, 875 bytes, `Content-Type: application/csv`. |
| Dictionary | https://datos.profeco.gob.mx/datos_abiertos/file.php?t=2de3505b2d37e7db72557a09262d95c7 | 2026-10-21T22:26:57Z | `QQP_diccionario_dataset.csv`, 1,484 bytes. |
| datos.gob.mx records | https://www.datos.gob.mx/api/3/action/package_search?q=quien+es+quien+precios (CKAN 2.11.6 API) | 2026-10-21 | HTTP 200 with a browser User-Agent (the default curl UA gets HTTP 403 on this host). Three datasets by "Procuraduría Federal del Consumidor (PROFECO)": `programa_quien_es_quien_precios_2024`, `_2025`, `_2026`, each with `license_id: CC-BY-4.0`, `license_title: Creative Commons Attribution 4.0`, `license_url: https://creativecommons.org/licenses/by/4.0/`. Dataset pages: https://www.datos.gob.mx/dataset/programa_quien_es_quien_precios_2026 (and _2025, _2024). |
| Terms of free use | https://datos.gob.mx/libreusomx | 2026-10-21 | **Dead**: HTTP 403 with curl's default UA; with a browser UA it redirects to https://www.datos.gob.mx/libreusomx/ and returns HTTP 404 ("Página no encontrada"). The 404 page links only https://www.gob.mx/terminos. See section 13 for the archived text. |
| Half-month CSVs on datos.gob.mx | https://repodatos.atdt.gob.mx/api_update/profeco/programa_quien_es_quien_precios_2025/11-2025_02.csv (resource URLs listed by the CKAN record) | 2026-10-21 | **HTTP 403 "Access Denied" (Akamai)** for every URL tried (2025 and 2026 names, http and https, curl default UA, browser UA with Accept/Referer headers, Range requests); the desktop app's built-in browser was also refused. See section 14. |

The other download links on the page, for the record (not used): 2024 `2de3505b2d37e7db72557a09262d95c5`, 2023 `fbd16d2cfa45961b75ec05d5ef1f01d9`, 2022 `2de3505b2d37e7db72557a09262d95c3`, 2021 `493b83b886f0266909d783fc8f776b11`, 2020 `4df382eefa26f1f0d28d3a11aaf41add`, 2019 `09939d92d2afcde64dbc06e057877e16`, 2018 `01fafa951fb6c82e6e4bb491af8f1688`, 2017 `059e79ffa462f6f51ed3aa1dbfa83a70`, 2016 `c388a30cb3f4b4c4fa29302618ef5557`, 2015 `4ecfa981c01e742a5461bf543a7b4108`. The pipeline reads the page and matches `Quién es Quién en los Precios <year>` to its token, with 2025/2026 hard-coded as a fallback.

### The metadata file, verbatim (Windows-1252, CRLF; transcribed to UTF-8)

```
Metadato,Descripción
Título,"Programa Quién es Quién en los Precios, Enero 2024 - Agosto de 2026."
Descripción,"El conjunto de datos del programa Quién es Quién en los Precios integra información de precios de productos de consumo habitual en el hogar, tales como alimentos, bebidas, artículos de higiene personal y del hogar, medicamentos, electrodomésticos y productos de temporada. Su objetivo es ofrecer información comparable que apoye a las personas consumidoras en la toma de decisiones de compra mediante la consulta y comparación de precios entre distintos establecimientos."
Cobertura temporal,2024-01-01 a 2026-08-31
Última modificación,31/08/2026 00:00
Autor,Procuraduría Federal del Consumidor (Profeco)
Punto de contacto,Coordinación General de Educación y Divulgación · Dirección General de Estudios sobre Consumo
Temporalidad de actualización,Mensual
```

No licence field. "Mensual" matches what we see: the 2026 archive (built 2026-10-06 according to the
entry timestamps inside the RAR) ends on 2026-08-31, i.e. the data lags the calendar by five to
nine weeks. The 2025 archive's entries are dated 2026-08-21.

### The dictionary file (UTF-8 with BOM, LF)

`Variable,Tipo de dato,Nombre corto,Descripción` with the 15 rows `producto`, `presentacion`, `marca`,
`categoria`, `catalogo`, `precio`, `fecha_registro`, `cadena_comercial`, `giro`, `nombre_comercial`,
`direccion`, `estado`, `municipio`, `latitud`, `longitud`. These lowercase names, not the page's uppercase
ones, are the actual CSV header.

## 3. The archives

Both are RAR 5 (`Rar!\x1a\x07\x01\x00`). Extracted with **7-Zip 21.06** (`C:\Program Files\7-Zip\7z.exe`;
`7z` was not on PATH on this machine). Windows' built-in `C:\Windows\System32\tar.exe` (bsdtar 3.5.2,
libarchive) lists and extracts RAR 5 too; one member extracted with it was byte-identical to 7-Zip's.
WinRAR was not installed. The pipeline tries, in order: `7z`/`7za`/`7zz` on PATH, the two usual
7-Zip install paths, WinRAR's `UnRAR.exe`, `unrar`, `bsdtar`, Windows `tar.exe`, GNU `tar` (which
cannot read RAR and is skipped after a list test). GitHub's ubuntu runner has `7z`. No npm package was
needed, so none was installed.

| Archive | Members | Folder inside | Names | Uncompressed | Entry dates |
|---|---:|---|---|---:|---|
| QQP_2026.rar | 16 CSV | `2026\` | `MM-2026_Q1.csv` (days 1–15), `MM-2026_Q2.csv` (16–end), January to August | 2,957,095,221 bytes | 2026-10-06 |
| QQP_2025.rar | 24 CSV | `QQP_2025\` | `MM-2025_01.csv`, `MM-2025_02.csv`, January to December | 4,172,949,078 bytes | 2026-08-21 |

The naming convention changed between years (`_01/_02` vs `_Q1/_Q2`, folder `QQP_2025` vs `2026`);
the pipeline globs `*.csv` recursively and reads the header, so neither matters.

### Every file (survey.mjs, one streaming pass)

| File | Bytes | Rows | First date | Last date | Distinct dates |
|---|---:|---:|---|---|---:|
| 2026/01-2026_Q1.csv | 156,465,328 | 496,726 | 2026-01-02 | 2026-01-15 | 11 |
| 2026/01-2026_Q2.csv | 198,482,949 | 630,371 | 2026-01-16 | 2026-01-30 | 11 |
| 2026/02-2026_Q1.csv | 156,476,250 | 496,645 | 2026-02-03 | 2026-02-13 | 9 |
| 2026/02-2026_Q2.csv | 172,814,585 | 547,811 | 2026-02-16 | 2026-02-27 | 10 |
| 2026/03-2026_Q1.csv | 176,171,184 | 558,146 | 2026-03-02 | 2026-03-13 | 11 |
| 2026/03-2026_Q2.csv | 190,545,396 | 606,522 | 2026-03-17 | 2026-03-31 | 11 |
| 2026/04-2026_Q1.csv | 151,791,389 | 480,842 | 2026-04-01 | 2026-04-15 | 10 |
| 2026/04-2026_Q2.csv | 187,803,269 | 597,634 | 2026-04-16 | 2026-04-30 | 11 |
| 2026/05-2026_Q1.csv | 150,920,462 | 480,010 | 2026-05-01 | 2026-05-15 | 15 |
| 2026/05-2026_Q2.csv | 167,575,168 | 533,214 | 2026-05-16 | 2026-05-31 | 16 |
| 2026/06-2026_Q1.csv | 196,098,295 | 622,764 | 2026-06-01 | 2026-06-15 | 15 |
| 2026/06-2026_Q2.csv | 199,900,196 | 633,686 | 2026-06-16 | 2026-06-30 | 15 |
| 2026/07-2026_Q1.csv | 210,414,850 | 665,909 | 2026-07-01 | 2026-07-15 | 15 |
| 2026/07-2026_Q2.csv | 234,044,542 | 744,623 | 2026-07-16 | 2026-07-31 | 15 |
| 2026/08-2026_Q1.csv | 200,612,182 | 635,952 | 2026-08-01 | 2026-08-15 | 15 |
| 2026/08-2026_Q2.csv | 206,979,176 | 657,602 | 2026-08-16 | 2026-08-31 | 12 |
| QQP_2025/01-2025_01.csv | 172,924,393 | 547,782 | 2025-01-02 | 2025-01-15 | 10 |
| QQP_2025/01-2025_02.csv | 218,837,634 | 696,182 | 2025-01-16 | 2025-01-31 | 12 |
| QQP_2025/02-2025_01.csv | 168,933,779 | 536,078 | 2025-02-04 | 2025-02-14 | 9 |
| QQP_2025/02-2025_02.csv | 190,830,861 | 606,776 | 2025-02-17 | 2025-02-28 | 10 |
| QQP_2025/03-2025_01.csv | 184,284,322 | 587,058 | 2025-03-03 | 2025-03-14 | 10 |
| QQP_2025/03-2025_02.csv | 186,930,413 | 594,320 | 2025-03-18 | 2025-03-31 | 10 |
| QQP_2025/04-2025_01.csv | 186,622,200 | 594,887 | 2025-04-01 | 2025-04-15 | 11 |
| QQP_2025/04-2025_02.csv | 135,336,065 | 430,973 | 2025-04-16 | 2025-04-30 | 9 |
| QQP_2025/05-2025_01.csv | 137,312,752 | 437,833 | 2025-05-02 | 2025-05-15 | 9 |
| QQP_2025/05-2025_02.csv | 165,182,068 | 526,969 | 2025-05-16 | 2025-05-30 | 11 |
| QQP_2025/06-2025_01.csv | 168,286,465 | 534,834 | 2025-06-02 | 2025-06-13 | 10 |
| QQP_2025/06-2025_02.csv | 180,845,643 | 573,713 | 2025-06-16 | 2025-06-30 | 11 |
| QQP_2025/07-2025_01.csv | 209,028,535 | 664,946 | 2025-07-01 | 2025-07-15 | 11 |
| QQP_2025/07-2025_02.csv | 224,540,038 | 715,246 | 2025-07-16 | 2025-07-31 | 12 |
| QQP_2025/08-2025_01.csv | 217,515,249 | 692,569 | 2025-08-01 | 2025-08-15 | 11 |
| QQP_2025/08-2025_02.csv | 153,500,849 | 489,955 | 2025-08-18 | 2025-08-29 | 10 |
| QQP_2025/09-2025_01.csv | 170,596,551 | 542,922 | 2025-09-01 | 2025-09-15 | 11 |
| QQP_2025/09-2025_02.csv | 166,954,073 | 534,092 | 2025-09-17 | 2025-09-30 | 10 |
| QQP_2025/10-2025_01.csv | 166,396,956 | 528,492 | 2025-10-01 | 2025-10-15 | 12 |
| QQP_2025/10-2025_02.csv | 186,736,618 | 595,062 | 2025-10-16 | 2025-10-31 | 13 |
| QQP_2025/11-2025_01.csv | 153,833,762 | 486,182 | 2025-11-03 | 2025-11-15 | 11 |
| QQP_2025/11-2025_02.csv | 138,876,694 | 437,363 | 2025-11-16 | 2025-11-29 | 13 |
| QQP_2025/12-2025_01.csv | 151,927,226 | 481,458 | 2025-12-01 | 2025-12-15 | 12 |
| QQP_2025/12-2025_02.csv | 136,715,932 | 434,832 | 2025-12-16 | 2025-12-31 | 13 |

Totals: 2026 = 9,388,457 rows (2026-01-02 to 2026-08-31), 2025 = 13,270,524 rows (2025-01-02 to
2025-12-31), **22,658,981 rows, 7,130,044,299 bytes**. Weekdays only, except that 2026-05 and later
include some Saturdays (15–16 distinct dates in a half month). No file crosses its half-month.

## 4. Format of the CSVs

- **Encoding:** UTF-8 with BOM (`EF BB BF`) in all 40 files. Line ending CRLF. Delimiter comma.
  Quoting RFC 4180 (double quotes around fields that contain commas, e.g.
  `"Amoxicilina, Acido Clavulanico"`; 6,265 quoted lines in `01-2026_Q1.csv`). **No field spans
  lines** (0 lines with an odd number of quotes in 22.66 M rows) and **no malformed row** (0 rows with
  a field count other than 15).
- **Exact header**, identical in the 40 files (one variant):
  `producto,presentacion,marca,categoria,catalogo,precio,fecha_registro,cadena_comercial,giro,nombre_comercial,direccion,estado,municipio,latitud,longitud`
- **Values:** `precio` is a decimal with a point and up to two decimals (`28`, `34.5`); `fecha_registro`
  is `YYYY/MM/DD` with no time; `latitud`/`longitud` are decimal degrees with up to six decimals,
  **empty strings when unknown**; text is title case as PROFECO writes it (`Botella 850 Ml. Vegetal`,
  `Bodega Aurrera Sucursal Santa Lucia`), brand `S/M` or `S/m` means sin marca.
- **Accent drift:** early 2025 files are mostly ASCII (`Ciudad de Mexico`, `San Jose`); later files are
  accented (`Ciudad de México`, `San José`). `01-2025_01.csv` contains the string `México` 2,245 times,
  `12-2025_02.csv` 124,722 times. The re-accenting was automatic and left artefacts such as
  `CentenaRío` and `SeminaRío` (`rio` → `Río` inside words). Consequence: the same store or product
  appears with several spellings across months, so every key in the pipeline is accent-, case- and
  punctuation-insensitive (`normKey`), and the displayed spelling is the most recently seen one.
- Category and catalogue labels drift too: 59 spellings of CATEGORÍA for 46 categories
  (`Carnes Frias Secas y Embutidos` / `Carnes Frías Secas y Embutidos`, `Te` / `Té`,
  `Arts. de Esparcimiento (juguetes)` / `(Juguetes)`), 16 spellings of CATÁLOGO for 12 catalogues
  (`Basicos` / `Básicos`, `Pacic` / `PACIC`, `Electrodomesticos` / `Electrodomésticos`,
  `Utiles Escolares` / `Útiles Escolares`), 37 spellings of ESTADO for 30 states. GIRO has two genuinely
  different labels for department stores (`Tienda Departamentales`, `Tiendas Departamentales`).

## 5. Survey cadence

Distinct `fecha_registro` per store per month (survey.mjs, raw store keys, both years):

| | Store-months | Mean | Median | p10 | p90 | Distribution (dates: store-months) |
|---|---:|---:|---:|---:|---:|---|
| National | 36,573 | 3.50 | 4 | 1 | 5 | 1: 4,521 · 2: 3,429 · 3: 5,850 · 4: 16,077 · 5: 6,165 · 6: 232 · 7: 140 · 8: 121 · 9: 23 · 10: 1 · 16–31: 14 |
| Metro area | 9,373 | 3.32 | 4 | 1 | 5 | 1: 1,777 · 2: 704 · 3: 1,418 · 4: 3,954 · 5: 1,419 · 6: 45 · 7: 29 · 8: 22 · 16–31: 5 |

So a store is visited **about once a week** (4 or 5 dates in most store-months); the 1- and 2-date
store-months are mostly tortillerías, bakeries and Central de Abasto stalls, which carry one to three
products and are not visited every week. A handful of store-months have 16–31 dates (daily capture,
probably a market). In the metro area, 88 ISO weeks have observations without a gap from
2024-12-30 (the week of 2025-01-02) to 2026-08-31 (a Monday with 19,413 rows, the last day in the
data). Weekly row counts in the city range from ~39 k (the first and last, partial, weeks and
Christmas 2025) to ~121 k.

## 6. National counts

| Count | Raw spellings | Normalised keys | Note |
|---|---:|---:|---|
| Rows | 22,658,981 | | |
| Stores (cadena \| nombre \| dirección) | 3,537 | 2,486 | the rest are spelling variants |
| Chains (CADENACOMERCIAL) | 246 | 242 | |
| Products (producto \| marca \| presentación) | 7,265 | 5,789 | |
| Generic products (PRODUCTO) | 818 | 815 | |
| Categories | 59 | 46 | |
| Catalogues | 16 | 12 | Básicos, Medicamentos, Frutas y Legumbres, Electrodomésticos, PACIC, Útiles Escolares, Mercados, Pescados y Mariscos, Juguetes, Especial, Navideños, Tenis |
| GIRO | 16 | 16 | see table |
| States | 37 | 30 | Colima and Nayarit are absent |
| Municipios | | 74 | |

Rows and stores by GIRO (raw store keys):

| GIRO | Rows (national) | Stores (national) | Rows (metro) | Stores (metro, raw) |
|---|---:|---:|---:|---:|
| Supermercado / Tienda de Autoservicio | 17,785,487 | 538 | 7,265,788 | 238 |
| Farmacias | 2,604,920 | 341 | 188,093 | 23 |
| Tienda de Electrodomésticos | 534,215 | 207 | 51,645 | 24 |
| Mercados | 389,055 | 141 | 68,073 | 27 |
| Papelerías | 368,454 | 149 | 63,136 | 14 |
| Tienda de Conveniencia | 336,067 | 79 | 23,068 | 10 |
| Tienda Departamentales | 277,692 | 80 | 48,684 | 15 |
| Central de Abasto | 205,742 | 593 | 76,723 | 390 |
| Tortillerías | 50,294 | 1,001 | 10,624 | 221 |
| Uniformes | 25,218 | 65 | 1,957 | 8 |
| Pescaderías | 24,117 | 82 | 429 | 2 |
| Panaderías | 20,775 | 93 | 7,002 | 29 |
| Jugueterías | 17,491 | 60 | 4,370 | 7 |
| Tiendas Departamentales | 15,465 | 34 | 2,139 | 4 |
| Zapaterías | 2,084 | 30 | 297 | 4 |
| Vinaterías | 1,905 | 44 | 133 | 5 |

Rows by catalogue (as published): Basicos 6,888,079 + Básicos 4,943,717; Medicamentos 5,652,661;
Frutas y Legumbres 1,258,676; Electrodomesticos 833,885 + Electrodomésticos 542,931; Pacic 627,234 +
PACIC 385,630; Útiles Escolares 393,966 + Utiles Escolares 315,613; Mercados 387,211; Pescados y Mariscos
182,404; Juguetes 145,295; Especial 69,193; Navideños 29,268; Tenis 3,218.

Rows by state (top): Ciudad de Mexico 2,807,167 + Ciudad de México 2,221,097 (= 5,028,264, 22 %);
Estado de Mexico 1,537,963 + Estado de México 1,374,594; Guanajuato 1,145,154; Jalisco 1,048,206;
Tabasco 903,023; Chihuahua 713,521; Zacatecas 633,258; Quintana Roo 625,026; … Hidalgo 42,366.

## 7. The Mexico City subset

**Definition** (`CITIES.cdmx` in the pipeline): ESTADO is `Ciudad de México` / `Ciudad de Mexico`
(`Distrito Federal` and `CDMX` are accepted but **do not occur** in 2025–2026), or ESTADO is
`Estado de México` / `Estado de Mexico` and MUNICIPIO is one of the metro municipalities, matched on
the accent-less name with a prefix rule because PROFECO writes some of them short.

Municipios of Estado de México present in the data (rows, both spellings of the state), and whether
they are in the metro list: Ecatepec de Morelos 517,516 ✓ · Tlalnepantla 481,802 ✓ (written short) ·
Naucalpan de Juárez 476,032 ✓ · Nezahualcóyotl 228,046 ✓ · Cuautitlán Izcalli 212,863 ✓ ·
Coacalco 211,880 ✓ (short) · Huixquilucan 210,642 ✓ · Atizapán de Zaragoza 207,332 + Atizapán 3,822 ✓
(both forms) · Tultitlán 139,181 ✓ · Cuautitlán 94,577 ✓ · Toluca 72,606 ✗ · Metepec 32,098 ✗ ·
Lerma 23,956 ✗ · Chicoloapan 105 ✓ · Tecámac 99 ✓. **Not surveyed at all** although in the metro list:
Chimalhuacán, La Paz, Texcoco, Chalco, Ixtapaluca, Valle de Chalco, Nicolás Romero, Zumpango. All 16
alcaldías appear (`Gustavo a. Madero` and `Magdalena Contreras` are relabelled `Gustavo A. Madero` and
`La Magdalena Contreras` for display).

**Size:** 7,812,161 rows (34.5 % of the national file), 449 distinct dates, 88 ISO weeks.

**Stores:** 1,021 raw keys → 682 after accent/case/punctuation normalisation → **571** after merging the
chain labels that PROFECO changed in May 2026 (`Central de Abastos` → `Central de Abasto`: 111 stalls
were listed twice, once per label, with disjoint date ranges 2025-01 → 2026-04 and 2026-05 → 2026-08).
Chains: 67 labels as published, mapped to 44 brands (table below). Products: 6,742 raw → 5,354
normalised, in 814 generic products. Every raw store key has exactly one coordinate pair (0 stores
with more than one).

All CADENACOMERCIAL labels seen in the metro area (raw store keys, both years) and the brand/format the
curation file maps them to:

| Label as published | Raw stores | Brand (chain) | Format |
|---|---:|---|---|
| Central de Abastos | 279 | Central de Abasto | Central de Abasto |
| Tortillerias Tradicionales | 221 | Tortillería | Tortillería tradicional |
| Central de Abasto | 111 | Central de Abasto | Central de Abasto |
| Wal-mart | 36 | Walmart | Walmart |
| Bodega Aurrera | 35 | Bodega Aurrera | Bodega Aurrera |
| Wal-mart Express | 32 | Walmart | Walmart Express |
| Panaderias Tradicionales | 29 | Panadería | Panadería tradicional |
| Hipermercado Soriana | 28 | Soriana | Hipermercado Soriana |
| Mercado Publico | 27 | Mercado público | Mercado público |
| Superissste | 21 | SuperISSSTE | SuperISSSTE |
| Mega Soriana | 20 | Soriana | Mega Soriana |
| Mercado Soriana | 16 | Soriana | Mercado Soriana |
| Coppel | 13 | Coppel | Coppel |
| La Comer | 9 | La Comer | La Comer |
| Chedraui | 9 | Chedraui | Chedraui |
| Liverpool | 9 | Liverpool | Liverpool |
| Elektra | 8 | Elektra | Elektra |
| Farmacias del Ahorro | 6 | Farmacias del Ahorro | Farmacias del Ahorro |
| Bodega Aurrera Express | 6 | Bodega Aurrera | Bodega Aurrera Express |
| Chedraui Selecto | 6 | Chedraui | Chedraui Selecto |
| Super Chedraui | 6 | Chedraui | Súper Chedraui |
| Sumesa | 5 | Sumesa | Sumesa |
| Sears Roebuck de Mexico / de México | 5 + 2 | Sears | Sears |
| 7 Eleven | 4 | 7-Eleven | 7-Eleven |
| Oxxo | 4 | Oxxo | Oxxo |
| Sanborn S Hnos. | 3 | Sanborns | Sanborns |
| Palacio de Hierro | 3 | Palacio de Hierro | Palacio de Hierro |
| Juguetron | 3 | Juguetrón | Juguetrón |
| Farmatodo | 3 | Farmatodo | Farmatodo |
| Farmacia San Pablo | 3 | Farmacias San Pablo | Farmacia San Pablo |
| Abastecedora Lumen | 3 | Lumen | Abastecedora Lumen |
| Office Depot | 3 | Office Depot | Office Depot |
| La Europea | 3 | La Europea | La Europea |
| Soriana Super | 2 | Soriana | Soriana Súper |
| Mega Elektra | 2 | Elektra | Mega Elektra |
| U.n.a.m. | 2 | Tienda UNAM | Tienda UNAM |
| Farmacia San Isidro | 2 | Farmacias San Isidro | Farmacia San Isidro |
| Farmacias de Similares | 2 | Farmacias Similares | Farmacias Similares |
| Farmacia | 2 | Farmacia | Farmacia independiente |
| Juguetibici | 2 | Juguetibici | Juguetibici |
| Neto (Super Precio) / Neto (super Precio) | 2 + 1 | Neto | Neto (Súper Precio) |
| Soriana Express | 2 | Soriana | Soriana Express |
| Papeleria Dabo | 2 | Papelería Dabo | Papelería Dabo |
| Office Max | 2 | OfficeMax | OfficeMax |
| Pescaderias Tradicionales | 2 | Pescadería | Pescadería tradicional |
| Grand Marchand | 2 | Grand Marchand | Grand Marchand |
| Papeleria Tony | 2 | Papelería Tony | Papelería Tony |
| Uniformes el General | 2 | Uniformes El General | Uniformes El General |
| Uniformes Roa | 2 | Uniformes Roa | Uniformes Roa |
| La Divina | 2 | La Divina | La Divina |
| Woolworth | 1 | Woolworth | Woolworth |
| Game Planet | 1 | Game Planet | Game Planet |
| Salinas y Rocha | 1 | Salinas y Rocha | Salinas y Rocha |
| Benavides | 1 | Farmacias Benavides | Benavides |
| City Market | 1 | City Market | City Market |
| Fresko la Comer | 1 | Fresko | Fresko La Comer |
| Farmacia Guadalajara | 1 | Farmacias Guadalajara | Farmacia Guadalajara |
| Uniformes Trofeo | 1 | Uniformes Trofeo | Uniformes Trofeo |
| Zapateria la Perla | 1 | Zapatería La Perla | Zapatería La Perla |
| Zapateria la Luna | 1 | Zapatería La Luna | Zapatería La Luna |
| Zapaterias | 1 | Zapatería | Zapatería |
| Uniformes el Surtidor de Xochimilco | 1 | Uniformes El Surtidor de Xochimilco | same |
| Uniformes Escolares y Deportivos | 1 | Uniformes Escolares y Deportivos | same |
| Zapateria Coppel Canada | 1 | Coppel | Zapatería Coppel Canadá |
| Uniformes el Leon | 1 | Uniformes El León | Uniformes El León |

Stores in the **build** (499, after section 12's rules) by brand and format: Tortillería tradicional
159 · Central de Abasto 124 · Walmart 24 + Walmart Express 22 · Bodega Aurrera 22 + Bodega Aurrera
Express 6 · Panadería tradicional 20 · Hipermercado Soriana 19 + Mega Soriana 11 + Mercado Soriana 9 +
Soriana Súper 2 · Mercado público 18 · SuperISSSTE 12 · La Comer 6 · Chedraui 5 + Chedraui Selecto 3 +
Súper Chedraui 3 · Farmacias del Ahorro 4 · Sumesa 4 · 7-Eleven 3 · Oxxo 3 · Sanborns 3 · Farmacia San
Pablo 2 · Farmatodo 2 · Neto 2 · Pescadería tradicional 2 · and one each of Benavides, City Market,
Farmacia Guadalajara, Farmacia independiente, Farmacia San Isidro, Farmacias Similares, Fresko La Comer,
Tienda UNAM, Soriana Express. By GIRO: Tortillerías 159, Supermercado / Tienda de Autoservicio 153,
Central de Abasto 124, Panaderías 20, Mercados 18, Farmacias 16, Tienda de Conveniencia 7,
Pescaderías 2. Products per store: median 35 (tortillerías carry 1–3), supermarkets 1,000–1,844.

Stores in the build by municipio: Iztapalapa 60 · Ecatepec de Morelos 49 · Atizapán de Zaragoza 46 ·
Tultitlán 37 · Cuauhtémoc 33 · Coyoacán 31 · Miguel Hidalgo 26 · Benito Juárez 24 · Gustavo A. Madero 23 ·
Naucalpan de Juárez 23 · Nezahualcóyotl 18 · Cuautitlán Izcalli 17 · Tlalpan 16 · Tlalnepantla de Baz
16 · Venustiano Carranza 14 · Azcapotzalco 14 · Álvaro Obregón 13 · Iztacalco 10 · Xochimilco 9 ·
Coacalco de Berriozábal 6 · Huixquilucan 4 · Chicoloapan 4 · La Magdalena Contreras 3 · Tecámac 3.
Note the geography: Atizapán and Tultitlán are large because the Central de Abasto stalls and
tortillerías PROFECO samples sit there; Milpa Alta, Tláhuac and Cuajimalpa have no store at all.

Observations in the build: **7,046,669** rows → 6,863,687 (product, store, week) cells after keeping
the latest observation per store-week.

## 8. Coordinate sanity

National (rows): empty latitude or longitude **2,169** (0.01 %), zero 0, outside Mexico
(lat 14–33, lon −118 to −86) 75, swapped (lat/lon in each other's range) 0.

Metro area (stores, 571 after merging):

| Problem | Stores | Which | Handling |
|---|---:|---|---|
| No coordinates at all | 4 | `bodega-aurrera-4a1ea3` Bodega Aurrera Sucursal Centenario (Centenario No. 394, Col. Merced Gómez, CP 01600), `bodega-aurrera-bb72d7` Sucursal Observatorio (Observatorio 457, Col. Las Américas, CP 01120), `bodega-aurrera-771715` Sucursal Vía Morelos (Vía Morelos S/N, Col. Jalapa, Ecatepec, CP 55090), `bodega-aurrera-1bdbb4` Sucursal San Juanico (Carr. Méx-Pachuca km 8, Col. La Laguna, Tlalnepantla, CP 54190) | left out of the build until someone geocodes them into `fixCoords` (2,143 rows) |
| Longitude without the minus sign | 1 | `tortilleria-tradicional-9bffbc` Tortillería Sin Nombre, Gustavo A. Madero: published `19.46111, 99.11288` | fixed in `data/overrides/qqp.json` → `[19.46111, -99.11288]` |
| Latitude with the sign flipped | 1 | `tortilleria-tradicional-859adc` Tortillería Hortelanos, Venustiano Carranza: published `-19.440087, -99.107246` | fixed → `[19.440087, -99.107246]` |
| Outside the metro box, cause unknown | 1 | `sears-b87bd0` Sears Sucursal Ecatepec: `19.689909, -101.158587` (that longitude is Michoacán; the latitude is plausible) | left out; needs a human (the store sells no grocery category anyway) |
| Swapped lat/lon | 0 | | |
| Same coordinates, different store | 209 raw keys | mostly spelling variants of one store (now merged) and distinct stalls of a market geocoded to one point | nothing; the app may want to jitter stacked dots |

The metro bounding box used is lat 19.0–19.95, lon −99.45 to −98.75; every other store falls inside
it. The pipeline prints each case and writes them to `data/cache/qqp/report-cdmx.json`.

## 9. Price sanity

National: 0 zero prices, 0 negative, 0 non-numeric; 3 rows above 100,000 MXN (appliances). Metro area,
per product (6,742 raw products, observations more than 10× above or 10× below the product's median):
**8 products** have such an observation, 1 observation each:

| Product | n | Median | Outlier |
|---|---:|---:|---|
| Daflon, Caja con 18 Tabletas de 750 Mg. | 315 | 332 | max 4,295 |
| Shampoo Garnier, Botella 650 Ml. Fructis… | 4,382 | 113 | min 8 |
| Lápiz Adhesivo Dixon, Blister 1 Pieza 8 Gr. | 266 | 21 | max 221 |
| Plaquenil, Caja con 20 Tabletas de 200 Mg. | 2,122 | 1,035 | min 58 |
| Bezafibrato, Caja con 30 Tabletas de 200 Mg. | 2,129 | 81 | max 865 |
| Lisinopril, Frasco con 28 Tabletas de 10 Mg. | 561 | 66 | max 734 |
| Café Soluble Legal, Frasco 180 Gr. (roja) | 15 | 90.5 | min 8 |
| Pedyalite SR-45, Frasco con 500 Ml. Sabor Fresa | 1,382 | 30.5 | max 460 |

They look like capture typos (a dropped or extra digit). The pipeline keeps label prices as published
and the app uses medians, so one typo moves nothing; a product's weekly min/max in `products/<id>.json`
will show it. No automatic outlier removal was added (nothing invented, nothing hidden).

## 10. PRESENTACIÓN: vocabulary and the size parser

5,268 distinct strings nationally, 4,957 in the metro area. Replacing digits by `#`, the 60 most
frequent patterns in the metro area (rows, example):

| # | Pattern | Rows | Example |
|---:|---|---:|---|
| 1 | Caja con # Tabletas de # Mg. | 278,298 | Caja con 30 Tabletas de 50 Mg. |
| 2 | # Kg. Granel | 207,958 | 1 Kg. Granel |
| 3 | Botella # Ml. | 149,624 | Botella 420 Ml. |
| 4 | Caja con # Cápsulas de # Mg. | 103,636 | Caja con 20 Cápsulas de 100 Mg. |
| 5 | Paquete C/# Blanco | 97,373 | Paquete C/12 Blanco |
| 6 | Paquete # Gr. | 92,235 | Paquete 540 Gr. |
| 7 | Botella # Lt. No Retornable | 91,684 | Botella 2 Lt. No Retornable |
| 8 | Caja con # Tabletas de # Mg./# Mg. | 73,413 | Caja con 4 Tabletas de 37.5 Mg./500 Mg. |
| 9 | Bolsa # Gr. | 65,164 | Bolsa 100 Gr. |
| 10 | Barra # Gr. Sin Sal | 60,849 | Barra 220 Gr. Sin Sal |
| 11 | Caja con # Tabletas | 60,727 | Caja con 10 Tabletas |
| 12 | Botella # Lt. | 56,455 | Botella 2 Lt. |
| 13 | Paquete # Rollos. # Hojas Dobles | 47,484 | Paquete 4 Rollos. 195 Hojas Dobles |
| 14 | Caja # Gr. | 45,895 | Caja 38 Gr. |
| 15 | Lata # Gr. en Tomate | 43,260 | Lata 425 Gr. en Tomate |
| 16 | Frasco # Gr. | 42,849 | Frasco 120 Gr. |
| 17 | Lata # Gr. | 41,201 | Lata 850 Gr. |
| 18 | Caja # Lt. Entera | 40,716 | Caja 1 Lt. Entera |
| 19 | Lata # Gr. en Grano | 38,185 | Lata 220 Gr. en Grano |
| 20 | Lata # Gr. Jalapeños Rajas | 34,108 | Lata 220 Gr. Jalapeños Rajas |
| 21 | Caja | 32,471 | Caja |
| 22 | # Kg. Granel. de Pavo. Virginia | 31,603 | 1 Kg. Granel. de Pavo. Virginia |
| 23 | Bolsa # Kg. Polvo | 31,244 | Bolsa 1 Kg. Polvo |
| 24 | Paquete # Kg. | 30,352 | Paquete 1 Kg. |
| 25 | Paquete # Hojas | 29,802 | Paquete 180 Hojas |
| 26 | Bolsa # Gr. Hortalizas Congeladas | 27,507 | Bolsa 500 Gr. Hortalizas Congeladas |
| 27 | Envase # Gr. Bebible. Fresa | 27,035 | Envase 220 Gr. Bebible. Fresa |
| 28 | Bolsa # Gr. Super Extra | 26,057 | Bolsa 907 Gr. Super Extra |
| 29 | Bolsa Plástico # Gr. Estándar | 25,439 | Bolsa Plástico 900 Gr. Estándar |
| 30 | Canasta con # Botellas de # Ml. No Retornable | 25,042 | Canasta con 6 Botellas de 355 Ml. No Retornable |
| 31 | Caja con # Comprimidos de # Mg./# Mg. | 25,025 | Caja con 28 Comprimidos de 1 Mg./2 Mg. |
| 32 | Bote # Gr. | 23,411 | Bote 400 Gr. |
| 33 | Manojo | 23,307 | Manojo |
| 34 | Paquete # Gr. Rebanado | 23,149 | Paquete 400 Gr. Rebanado |
| 35 | Caja con # Comprimidos de # Mg. | 22,926 | Caja con 7 Comprimidos de 120 Mg. |
| 36 | Botella # Ml. Etílico Desnaturalizado. #° | 22,663 | Botella 500 Ml. Etílico Desnaturalizado. 70° |
| 37 | Botella # Ml. Vegetal | 21,819 | Botella 850 Ml. Vegetal |
| 38 | Pieza | 21,641 | Pieza |
| 39 | Vaso # Gr. Fresa | 21,390 | Vaso 120 Gr. Fresa |
| 40 | Frasco # Gr. Fresa | 21,384 | Frasco 470 Gr. Fresa |
| 41 | Vaso # Gr. | 21,265 | Vaso 196 Gr. |
| 42 | Caja con # Cápsulas | 20,293 | Caja con 24 Cápsulas |
| 43 | Caja con # Cápsulas de # Mg./# Mg. | 19,969 | Caja con 16 Cápsulas de 100 Mg./300 Mg. |
| 44 | Paquete Grande # Gr. Rebanado Blanco | 19,306 | Paquete Grande 620 Gr. Rebanado Blanco |
| 45 | Paquete # Gr. Spaghetti | 19,251 | Paquete 220 Gr. Spaghetti |
| 46 | # Kg. Granel. Blanca Sin Rabo | 19,205 | 1 Kg. Granel. Blanca Sin Rabo |
| 47 | Botella # Ml. Soya | 18,762 | Botella 946 Ml. Soya |
| 48 | # Kg. Granel. Saladette/huaje o Tomate Saladette/huaje | 18,598 | 1 Kg. Granel. Saladette/huaje o Tomate Saladette/huaje |
| 49 | # Kg. Granel. Tabasco/chiapas/roatán/portalimón | 18,521 | 1 Kg. Granel. Tabasco/chiapas/roatán/portalimón |
| 50 | Bolsa # Gr. Negro. Querétaro | 18,425 | Bolsa 907 Gr. Negro. Querétaro |
| 51 | # Kg. Granel. Alfa/blanca | 18,176 | 1 Kg. Granel. Alfa/blanca |
| 52 | Lata # Ml. | 17,638 | Lata 355 Ml. |
| 53 | Paquete # Gr. de Pavo. Virginia | 17,477 | Paquete 290 Gr. de Pavo. Virginia |
| 54 | # Kg. Granel. Jalapeño o Cuaresmeño | 17,380 | 1 Kg. Granel. Jalapeño o Cuaresmeño |
| 55 | Caja con # Tabletas. Efervescente | 17,188 | Caja con 12 Tabletas. Efervescente |
| 56 | Frasco # Gr. con Jugo de Limones | 16,970 | Frasco 228 Gr. con Jugo de Limones |
| 57 | # Kg. Granel. Mediana | 16,832 | 1 Kg. Granel. Mediana |
| 58 | # Kg. Granel. Red Delicious/roja/roja Mediana/roja Americana | 16,551 | 1 Kg. Granel. Red Delicious/roja/roja Mediana/roja Americana |
| 59 | # Kg. Granel. Agrio con Semilla o Colima | 16,442 | 1 Kg. Granel. Agrio con Semilla o Colima |
| 60 | Caja Plástico # Gr. Sin Sal | 16,239 | Caja Plástico 190 Gr. Sin Sal |

Vocabulary facts that shaped `tools/lib/presentation.mjs`:

- Units are abbreviated with a trailing period: `Gr.` (6.9 M rows), `Kg.` (3.5 M), `Ml.` (3.4 M),
  `Lt.` (1.1 M), rarely `G.` and `L.`. The words litro, kilo, gramo, mililitro, oz, lb never occur.
- `Mg.` (2.9 M rows), `Mcg.`, `Mg./Ml.`, `875/125 Mg.`, `1 Gr./100 Gr.` are **doses**, never package
  sizes; the parser deletes them before looking for a size, so `Caja con 30 Tabletas de 50 Mg.` is
  30 pieces. Two medicines write the Greek mu (`27.5 Μg./50 Μl.`); it is folded to `M` first.
- Commas inside numbers are always thousands separators (`10,000 Horas`, `75,000 Definiciones`); a
  decimal comma never occurs in the data but is supported (`1,5 Lt.` → 1.5) because the app's own
  input may use it.
- Pieces: `Pieza`, `Pza.`, `Piezas`, the typo `Piezass`, eggs as `Paquete C/18 Blanco`, paper as
  `Paquete 420 Hojas`, notebooks as `100 Hojas. Cuadro Grande`, toilet paper as
  `Paquete 4 Rollos. 200 Hojas Dobles` (parsed as 4 pieces: roll counts are always present, sheet
  counts often not, so rolls keep the group comparable — an open question, see section 16).
- Multipacks: `Canasta con 6 Botellas de 355 Ml.` (container count × size), `Paquete con 12 Latas de
  355 Ml. C/u`, `Caja 12 Cubos de 10.5 Gr. C/u. Caldo`, `Caja 200 Gr. (50 Sobres de 4 Gr. C/u)`,
  `Paquete 400 Gr. (2 Pack)` (the weight before `(N Pack)` is the total). `N Pack X Ml` and `N x X g`
  do not occur in PROFECO's data but are supported for the app's input.
- `Bolsa 15 Piezas. 382.5 Gr.` and `Bolsa 20+2 Piezas. 561 Gr.` give a total weight with a piece count
  (pack 15 / 22); `Pieza 43.8 Gr.` and `Blister 1 Pieza 8 Gr.` are one piece of that weight.
- Bulk: `1 Kg. Granel` (2.8 M rows nationally, 390 variants with the variety after it) and, for
  turkey and shrimp, `Kg. Natural` / `Paquete Contenido Variable. Kg. Seco` with no number: sold by
  the kilo, parsed as 1,000 g.
- Ranges are ignored: `Concha. Pieza de 68 a 90 Gr.` is one piece. Dimensions, power, memory and
  inches (`30 Cm. X 5 M.`, `30 W`, `64 Gb.`, `55 Plgs.`) are stripped so they are never read as sizes.
- Both a weight and a volume: `Bote 305 Gr./400 Ml.` (aerosols) — the first one in the text wins, so an
  insecticide group mixes g and ml and the app will not compare it per unit; acceptable.
- No size: `Caja` alone (hair dye, 85,700 rows nationally), `Bolsa. Cambray` (radishes),
  `Caja con Una Ampolleta No. 1 y Una Ampolleta No. 2`, clothing sizes (`Azul Liso. Talla 6-10`),
  appliance model numbers (`Bvstdc4403 o Bvstdc4403-013. Capacidad 12 Tazas`). Appliances, toys,
  sports goods, housewares are never parsed (a `12/7 Kg. Tambor` washing machine would otherwise
  become 7 kg of goods): `NO_SIZE_CATEGORIES` in the pipeline.

**Coverage** (coverage.mjs over the national vocabulary weighted by rows): 93.9 % of all rows,
**94.85 % of metro-area rows** (7,409,491 of 7,812,161), 61.4 % of distinct strings. By unit in the
metro area: g 3.89 M rows, ml 1.52 M, pza 2.01 M. In the city build (groceries, pharmacy, household;
section 12) **2,357 of 2,366 products (99.6 %) have a size**: g 1,296, pza 616, ml 445; 42 are
multipacks with a `pack`. The nine without one are six hair dyes (`Caja`), `Rábano Bolsa. Cambray`,
`Neuralin Caja con Una Ampolleta No. 1 y Una Ampolleta No. 2` and `Betametasona Caja con Ampolleta y
Jeringa Desechable…`. The 87 cases in `tests/presentation.test.mjs` are real strings from the
data plus seven forms the app's own input may use.

Top unparsed presentations by rows, metro area, over everything PROFECO surveys (only the first
three and `Betametasona` are in the build, 4 distinct strings; the rest are excluded categories, now
parsed, or seasonal products outside the window):

| PRESENTACIÓN | Metro rows | Product (category) | Why |
|---|---:|---|---|
| Caja | 32,471 | Tinte para el Cabello (Arts. para el Cuidado Personal) | no size on the label, correctly null |
| Bolsa. Cambray | 4,400 | Rábano (Hortalizas Frescas) | a bunch with no count; could be 1 pza (open question) |
| Caja con Una Ampolleta No. 1 y Una Ampolleta No. 2 | 4,129 | Neuralin (Medicamentos) | "una" is not a digit; could be 2 pza |
| Bvstdc4403 o Bvstdc4403-013. Capacidad 12 Tazas | 7,835 | coffee makers (Aparatos Eléctricos) | appliances, excluded |
| 50 Ur 7800 Psb. 50 Plgs. Led. Puerto Usb. Smart Tv. and 28 similar | ~16,000 | TVs (Aparatos Electrónicos) | excluded |
| Paquete con 2. Venus. Sensitive / Paquete con 6. Aa | 5,173 / 2,607 | razors, batteries | now parsed (2 / 6 pza) |
| Azul Liso. Talla 6-10 (Boxer. Resorte en Pretina) and the other uniforms | ~3,000 | Pantalón / Playera / Bata Escuela Oficial (Material Escolar) | clothing, excluded |
| Caja con Frasco 120 Disparos. Suspensión 27.5 Μg./50 Μl. | 4,005 | inhaler (Medicamentos) | now parsed (120 pza) |
| Caja 12 Ceras. Estándar | 4,235 | crayons (Material Escolar) | now parsed (12 pza) but excluded |
| Caja con Ampolleta y Jeringa Desechable. Suspensión Inyectable de 5 Mg./2 Mg. | 140 | Betametasona | one ampoule, no count; null |

## 11. Weekly structure and the basket index

- **Week** = Monday of the ISO week of `fecha_registro` (`mondayOf(day)` in the pipeline).
- **One observation per product, store and week**: when a store has two observations of a product in
  one week (it happens in 2.4 % of cells: 7,046,669 rows → 6,863,687 cells in the build), the later
  date wins; same date, the later row.
- **City series** per product (`products/<id>.json` → `series`): for every week in `meta.weeks`,
  `[week, median, min, max, n]` over the stores' prices that week (`null`s and `n = 0` when the product
  was not seen).
- **Basket index** of a store for a week (`index.json`, `stores.json` → `index`):
  the **median, over the products observed in that store that week, of (store price ÷ city-wide
  median price of the same product that week)**; `null` when fewer than 30 products were observed.
  1.00 means the store sits at the city median; 0.95 means its prices are typically 5 % under it.
  `index.latest` is the last non-null week; `index.series` in `stores.json` lists only the non-null
  weeks (the dense per-week array is in `index.json`). Verified by recomputing two stores from the
  `*.weeks.json` files: `bodega-aurrera-08c0e8` 2026-08-24 → 0.994 over 731 products, equal to the
  pipeline's value; `bodega-aurrera-0c2a75` → 0.991 over 807.
  Latest index across the 244 stores that have one: min 0.667 (a Central de Abasto meat stall), p10
  0.928, median 1.000, p90 1.026, max 1.239 (7-Eleven). The five cheapest are Central de Abasto stalls,
  the five dearest three 7-Elevens and two mercados públicos.
- **products.json** `min / median / max` are the label prices across stores in the product's most
  recent week with observations (not necessarily the global latest week); `stores` is the number of
  stores that ever reported it in the build window. **Superseded the same day by §20**: that week was
  usually the one-day last week, so the summary now covers each store's latest observation within
  the last 28 days of data, and `stores` counts those stores.

## 12. The pipeline and its outputs

`node tools/build-qqp.mjs [--years=2026,2025] [--skip-download] [--city=cdmx]` (Node 22+, ESM, built-ins
only; `npm run qqp`). Cache `data/cache/qqp/{raw,extract}/`, output `public/data/qqp/`. It downloads
with curl (`-L -A "compa-precio build (github.com/vdm285/compa-precio)"`, falling back to `fetch`)
only when the archive is not in the cache, extracts once (a marker records the archive's size and
mtime), streams every CSV line by line (1 MB read buffer, never a whole file in memory), keeps the
city's rows in four typed arrays, aggregates per product with a counting sort, and never lets one bad
file or row stop the run (the file is skipped with a warning; a row with a bad price or date is
counted). `data/overrides/qqp.json` is read first: `excludeStores`, `excludeProducts`,
`excludeCategories` (added to the city's own list), `fixCoords` (`id → [lat, lon]`), `renameChains`
(`label → { chain, format }`), `notes`.

**Identity and ids.** `normKey` = NFD, accents removed, lower case, runs of non-alphanumerics → one
space. Store id = slug of the chain **format** label (PROFECO's label after `renameChains`) + `-` +
first 6 hex of sha1 of `normKey("format|nombre comercial|dirección")`, e.g. `walmart-14822b`; using the
format rather than the raw label is what merges the relabelled Central de Abasto stalls, at the cost
that changing a `format` in the curation file changes those stores' ids (the reader's own prices are
keyed by store id). Product id = first two words of the slug of PRODUCTO + `-` + 6 hex of sha1 of
`normKey("producto|marca|presentación")`, e.g. `huevo-02ebd8`; group id = slug of PRODUCTO (`huevo`).
No id collisions occurred. Display spellings are the most recently seen variant; category, catalogue
and GIRO labels are canonicalised city-wide the same way, so `Basicos` and `Básicos` are one catalogue.

**Rules that shape the city build** (all in the `CITIES.cdmx` block, all reported in `meta.json`
→ `rules`):

1. Stores without a usable position are left out (the contract in `docs/PIPELINES.md` and
   `tools/check-qqp.mjs` requires `lat`/`lon`): the four Bodega Aurrera stores without coordinates and
   Sears Ecatepec (section 8). They come back the moment `fixCoords` has them.
2. `excludeCategories`: toys (`Arts. de Esparcimiento (Juguetes)`), `Aparatos Eléctricos`, `Aparatos
   Electrónicos`, `Artículos Deportivos`, `Enseres Menores`, `Refrigeradores`, `Accesorios Domésticos`,
   `Utensilios Domésticos` and `Material Escolar` (school uniforms and supplies). They are not
   groceries, have no comparable size, and together they are 2,552 of the 5,354 metro-area products
   and about 740 KB of a products.json that must stay under 700 KB with full field names. The 67
   stores that sold only those (toy, appliance, department, stationery, uniform and shoe shops, plus
   Liverpool, Sears, Coppel, Elektra, Palacio de Hierro…) drop out with them.
3. `recentWeeks: 26`: a product not seen in the city in the last 26 weeks is left out of the whole
   build (436 products on 2026-10-21: Christmas 2025 items, discontinued presentations). The window
   halves automatically if products.json would still not fit; it did not need to. products.json is
   "what it costs now"; history for a product that comes back is rebuilt from the archives anyway.
4. Basket index needs ≥ 30 products in the store-week; the per-store scrubber file keeps the last 26
   weeks and halves its window when it would exceed 40 KB (one product: `tortilla-de-9688d0`, Tortilla
   de Maíz 1 Kg Granel, sold by 284 stores → 13 weeks, 23.7 KB).

Measured on this machine (Windows 10, Node 24.19, SATA SSD) with the archives already cached:

| Run | Streaming | Total wall | Peak RSS (4 GB heap) |
|---|---:|---:|---:|
| Full metro area, no exclusions (run 2) | 168 s | 221 s (3 m 41 s) | 1,995 MB |
| With the rules above (run 3) | 289 s | 328 s (5 m 29 s) | 1,849 MB |
| With the rules above, final (run 4) | 258 s | 284 s (4 m 45 s) | 1,800 MB |
| First run including extraction of both RARs (run 1) | | 484 s | 1,215 MB |

(The streaming time varies with disk cache state; the first survey pass with heavier bookkeeping took
295 s and 2.1 GB.) Output on 2026-10-21, after the rules:

(Sizes before §20, which adds fields and `visits.json` and moves the products.json cap to 1,400 KB raw.)

| File | Count | Bytes | Limit | Max |
|---|---:|---:|---:|---:|
| `meta.json` | 1 | 3,122 | | |
| `stores.json` | 1 | 491,794 | 600 KB soft | |
| `products.json` | 1 | 654,168 | 700 KB hard | |
| `groups.json` | 1 | 67,067 | | |
| `index.json` | 1 | 220,790 | 400 KB soft | |
| `products/<id>.json` | 2,366 | 15.6 MB | 30 KB each | 17.6 KB |
| `products/<id>.weeks.json` | 2,366 | 28.5 MB | 40 KB each | 28.1 KB |
| `stores/<id>.json` | 499 | 8.7 MB | 120 KB each | 71.0 KB |
| **Total** | **5,236** | **54.2 MB (56,859,594)** | | |

`tools/check-qqp.mjs` passes with exit 0 and no warnings. Without the category and recency rules the
same build is 571 stores, 5,354 products, 11,284 files, 79.4 MB, and products.json is 1,475 KB with
full field names (1,214 KB with one-letter names), which is why the rules exist. Counts in `meta.json`:
stores 499, products 2,366, groups 677, observations 7,046,669, storeFiles 499, pacic 234. Store files
never needed the `MM-DD` date shortening (largest 71 KB).

**PACIC.** CATÁLOGO `PACIC` / `Pacic` marks the official basket (Paquete Contra la Inflación y la
Carestía); a product carries `"pacic": 1` in `products.json` when any of its observations had that
catalogue. In the build: **234 products in 31 generic products** (Aceite, Arroz, Atún, Azúcar, Carne
Cerdo, Carne Pollo, Carne Res, Cebolla, Chile Fresco, Espinacas, Frijol, Huevo, Jabón de Tocador, Jamón,
Jitomate, Leche Pasteurizada, Leche Ultrapasteurizada, Lechuga, Lenteja, Limón, Manzana, Pan de Caja,
Papa, Papel Higiénico, Pasta para Sopa, Piña, Plátano, Puré de Tomate, Sardina, Tortilla de Maíz,
Zanahoria); 306 products in 34 generic products before the recency window (Mojarra, Servilletas de
Papel Blanco and Toalla Femenina were last seen with that catalogue more than 26 weeks ago).

## 13. Licence

What each source says, on 2026-10-21:

1. **PROFECO's page and files** (section 2): no licence text on `qqp.php`, on the dictionary page, in
   `QQP_metadatos_dataset.csv` or in `QQP_diccionario_dataset.csv`.
2. **datos.gob.mx** catalogue records for the same datasets (`programa_quien_es_quien_precios_2024/
   2025/2026`, maintainer "Procuraduría Federal del Consumidor (PROFECO)"): `"license_id": "CC-BY-4.0",
   "license_title": "Creative Commons Attribution 4.0", "license_url":
   "https://creativecommons.org/licenses/by/4.0/"` (CKAN API, HTTP 200). This is the clearest
   statement and the one `meta.json` names.
3. **Términos de Libre Uso de los Datos Abiertos del Gobierno de México** — the live URL
   https://datos.gob.mx/libreusomx is gone (403/404, section 2). The Wayback Machine holds the official
   page: snapshot 2015-12-08 21:45:21 UTC of http://datos.gob.mx/libreusomx/, title "LIBRE USO MX",
   read on 2026-10-21 through the desktop app's browser because curl was rate-limited (HTTP 429);
   saved as `data/cache/qqp/raw/pages/libreusomx.wayback-20151208.txt`. The OpenStreetMap wiki page
   https://wiki.openstreetmap.org/wiki/ES:LIBRE_USO_MX (last edited 2015-05-19) carries the same text.
   The clauses that matter, verbatim:

   > Los presentes "Términos de libre uso" promueven el uso, reuso y redistribución de los conjuntos de
   > datos abiertos, de conformidad con lo siguiente:
   >
   > Usted puede: a. Hacer y distribuir copias del conjunto de datos y su contenido; b. Difundir y
   > publicar el conjunto de datos y su contenido; c. Adaptar o reordenar el conjunto de datos y su
   > contenido; d. Extraer total o parcialmente el contenido del conjunto de datos; e. Explotar
   > comercialmente el conjunto de datos y su contenido, y; f. Crear conjuntos de datos derivados del
   > conjunto de datos o su contenido.
   >
   > Condiciones: a. Citar la fuente de origen de donde obtuvo el conjunto de datos: Nombre del conjunto
   > de datos", [Siglas de la Dependencia o Entidad de la Administración Pública Federal]; Liga de
   > internet de los datos descargados, y la fecha de la de consulta en formato numérico [AAAA-MM-DD],
   > puestos a disposición de tal manera que sean fácilmente accesibles para los usuarios, y en la
   > forma que mejor se adecue al funcionamiento del bien o servicio; b. No utilizar la información con
   > objeto de engañar o confundir a la población variando el sentido original de la información y su
   > veracidad. c. No aparentar que el uso que usted haga de los datos representa una postura oficial
   > del Gobierno o que el mismo está avalado por la fuente de origen.
   >
   > Ejemplo de cita: "Variedades Vegetales y Semillas" publicado por SAGARPA. Consultado en
   > http://catalogo.datos.gob.mx/dataset/variedades-vegetales-y-semillas el 2014-09-04.
   >
   > Aviso sobre contenidos de terceros: Los términos de libre uso no lo autorizan para utilizar el
   > contenido de terceros como pueden ser obras en cualquier formato que se encuentren dentro de los
   > conjuntos de datos. […] Compatible con Creative Commons CC BY

   (The stray quotation mark after "datos" and "la fecha de la de consulta" are in the original.)
4. **https://www.gob.mx/terminos** ("Términos y condiciones de uso del portal", the only legal link
   on the 404 page) is the portal's own terms: it authorises viewing and downloading "solamente para su
   uso personal" and forbids modifying, reproducing or distributing "los materiales". It is about the
   gob.mx website, not about the open datasets, which are published under the terms above and CC BY 4.0;
   it is noted here so nobody mistakes it for the data licence.
5. Nothing in the data is third-party content (no images, no text works); brand names appear as facts.

Conclusion: reuse, redistribution, adaptation and commercial use are permitted; the obligations are
attribution with dataset name, agency, link and access date (AAAA-MM-DD), no misrepresentation, and
no implied endorsement. The app's about screen should also say it is not a PROFECO product.

## 14. The half-month CSVs on datos.gob.mx (for a lighter weekly refresh)

The datos.gob.mx records list one resource per half month, served from
`https://repodatos.atdt.gob.mx/api_update/profeco/programa_quien_es_quien_precios_<year>/<file>`:
`01-2025_01.csv` … `12-2025_02.csv` for 2025 (24 resources, created 2025-12-24), `01-2024_01.csv` …
for 2024, and for 2026 the names change to `b01_2026_q1.csv`, `b01_2026_q2.csv`, `b02_2026_q2.csv`,
`b05_2026_q1.csv`, `b05_2026_q2.csv`, `b06_2026_q1/q2.csv`, `b07_2026_q1/q2.csv` (nine resources only,
created 2026-09-21: February Q1, March, April and August are missing there although the RAR has
them). **Every one of those URLs answered HTTP 403 "Access Denied" (Akamai, `Server-Timing: cdn-cache;
desc=HIT`) from this machine on 2026-10-21**, with and without a browser User-Agent, with Accept and
Referer headers, over http and https, with and without Range; the desktop app's built-in browser was
refused too. So a `--recent` mode that downloads only the newest half month was **not implemented**:
it could not be tested, and the 2026 listing is incomplete anyway. The weekly Actions run downloads
the current year's RAR (60 MB, ~40 s) and reuses the previous year's from the cache, which is cheap
enough. If the host opens up, the CKAN API (`package_show?id=programa_quien_es_quien_precios_2026`)
gives the resource list and `last_modified`, and the pipeline's CSV reader already handles any mix of
files, so the mode is a download step, not a parser change.

## 15. Credit line

Spanish (the app's about screen and the map's corner; the date comes from `meta.source.files[].retrieved`):

> Precios: "Quién es Quién en los Precios", PROFECO (Procuraduría Federal del Consumidor), datos
> abiertos del Gobierno de México, https://datos.profeco.gob.mx/datos_abiertos/qqp.php, consultado el
> 2026-10-21. Licencia Creative Commons Atribución 4.0 (CC BY 4.0). Esta aplicación no es un producto
> de PROFECO ni cuenta con su aval; los precios son los que PROFECO publicó, sin estimaciones.

English:

> Prices: "Quién es Quién en los Precios", PROFECO (Mexico's Federal Consumer Protection Agency), open
> data of the Government of Mexico, https://datos.profeco.gob.mx/datos_abiertos/qqp.php, retrieved
> 2026-10-21. Creative Commons Attribution 4.0 (CC BY 4.0). This app is not a PROFECO product and is
> not endorsed by it; prices are the ones PROFECO published, never estimated.

Short form for a map corner: `Precios: PROFECO, Quién es Quién en los Precios (CC BY 4.0), 2026-10-21`.

## 16. Curation list

Fixed in `data/overrides/qqp.json` (certain from the data itself):

- `fixCoords`: `tortilleria-tradicional-9bffbc` (longitude sign missing), `tortilleria-tradicional-859adc`
  (latitude sign flipped).
- `renameChains`: all 67 labels → brand + format (section 7); it also merges `Central de Abastos` /
  `Central de Abasto`, `Sears Roebuck de Mexico` / `de México`, `Neto (Super Precio)` / `(super Precio)`.

Needs a human:

- Geocode the four Bodega Aurrera stores without coordinates (addresses in section 8) and decide
  Sears Ecatepec (wrong longitude; sells no grocery category, so it only matters if appliances are
  ever included).
- Duplicate-looking stores that are **not** duplicates: 16 groups of tortillerías and bakeries share a
  generic name (`Tortillería Sin Nombre`, `Tortillería La Guadalupana`) at different addresses; left
  as they are. One address is shared by a tortillería and a bakery (Toronjil 67 / 88-B, Victoria de las
  Democracias) with the same coordinates; the app should jitter or stack dots at identical points
  (124 Central de Abasto stalls share a handful of points).
- Products whose presentation could not be parsed in the build: `Tinte para el Cabello … Caja`
  (6 products, no size on the label), `Rábano Bolsa. Cambray`, `Neuralin Caja con Una Ampolleta No. 1 y
  Una Ampolleta No. 2`, `Betametasona Caja con Ampolleta y Jeringa Desechable…` — 9 products of 2,366;
  decide whether a bunch of radishes is 1 pza and whether "Una Ampolleta … y Una Ampolleta" is 2 pza.
- Chains whose formats may deserve a single map colour: Soriana (five formats), Walmart (two), Bodega
  Aurrera (two), Chedraui (three), La Comer / Fresko / City Market / Sumesa (one company, four brands —
  mapped to four brands here because that is what a shopper says).
- Groups whose category differs between products (13): `ajo` (Hortalizas Frescas / Condimentos),
  `atun`, `camaron`, `mojarra`, `pulpo` (fresh vs canned), `cacahuates`, `cerveza`, `galletas-dulces`,
  `galletas-saladas`, `papas-fritas-y-similares`, `refresco`, `carne-cerdo` (fresh vs cold cuts).
  The group's category in `groups.json` is the most common one; the per-product category is kept.
- GIRO `Tienda Departamentales` vs `Tiendas Departamentales` (not merged; both excluded by the
  category rule today).
- Price typos (section 9): eight single observations; leave or add the product-week to a future
  `excludeObservations` list.

## 17. Open questions (owner's call)

1. **Which GIROs belong on the map?** Today every GIRO with a grocery category is in: 159 tortillerías
   (one product each, no index) and 124 Central de Abasto stalls (wholesale, the cheapest indexes) sit
   beside 153 supermarkets. They are genuine and interesting ("¿a cómo el kilo de tortilla?") but they
   will dominate the dot count; `CITIES.cdmx.giros` is the one-line filter.
2. **Which categories?** The build excludes toys, appliances, sports, housewares and school supplies
   so products.json fits 700 KB with full field names (section 12). Alternatives: drop Medicamentos
   instead (495 products, 136 KB) and keep school supplies; or raise the cap. Everything excluded is
   still in the archives.
3. **26-week recency** for the product list, or the whole data range (plus 436 stale products,
   ~90 KB)?
4. **Toilet paper**: pieces = rolls (current) or sheets (better like-for-like, but many labels lack the
   sheet count)?
5. **Store identity across relabels**: ids follow the curated format label (stable unless the curation
   changes); the alternative, raw labels, duplicates stores whenever PROFECO renames a chain.
6. **The index threshold** of 30 products: mercados públicos and pharmacies pass it, bakeries and
   tortillerías never do (their dots have no colour on the index view).
7. **Attribution date**: show the retrieval date of the archive (`meta.source.files[].retrieved`), or
   the data's last date (`meta.latestDate`, 2026-08-31)? The terms ask for the access date.

## 18. Next steps

- A GitHub Actions dry run: `7z` is on ubuntu runners; the 2025 archive should be cached with
  `actions/cache` (85 MB) and the run needs about 2 GB of RAM and 10 GB of disk for the extracted CSVs.
- When 2027 starts, `--years` defaults to 2027,2026; the page scrape finds the new token, and
  `data/cache/qqp/raw/QQP_2027.rar` will be small for months. The Christmas 2026 products will enter
  the build in December through the recency window.
- Re-check https://datos.gob.mx/libreusomx and the repodatos host from the Actions runner (a different
  network): the 403 may be local.
- Consider a `tools/check-qqp.mjs` rule for the index formula (recompute one store from the weeks
  files, as verify.mjs did here).

## Appendix: scripts used

All under `data/cache/qqp/scratch/` (cache, not committed): `survey.mjs` (one pass over the 40 files:
every count in sections 3–10 and `presentations.tsv`, `cdmx-stores.tsv`, `survey.json`), `natcount.mjs`
(normalised national distinct counts), `coverage.mjs` (parser coverage over the vocabulary),
`verify.mjs` and `final-stats.mjs` (output checks, the index recomputation, the tables in sections 7,
11 and 12). The pipeline's own `data/cache/qqp/report-cdmx.json` lists every excluded or fixed store,
the unparsed presentations and the oversize decisions of the last run.

## 19. Reachability from GitHub's runners, and the mirror (added 2026-10-21, later)

The first Pages deploy failed in 19 s: from a GitHub-hosted runner every URL under `datos.profeco.gob.mx` answers **HTTP 404 with a 236-byte Apache page**, with the build's User-Agent and with a browser's. A throwaway probe workflow measured, from runner IP 20.98.141.161 (Microsoft, Des Moines, Iowa, US):

| Host | Answer from the runner |
|---|---|
| `datos.profeco.gob.mx` (the page and every `file.php?t=` archive) | 404, 236 bytes |
| `repodatos.atdt.gob.mx` (the half-month CSVs) | 403 Akamai "Access Denied" (the same from Mexico, section 14) |
| `datos.gob.mx` CKAN API (`package_show`) | 403 with the build's User-Agent, 200 JSON with a browser's |
| `qqp.profeco.gob.mx` (the consumer site) | 200 |
| `web.archive.org` | 200 |

The same archive URLs answer normally from a home connection in Mexico City. So the yearly archives are mirrored byte for byte as assets of the release [`qqp-mirror`](https://github.com/vdm285/compa-precio/releases/tag/qqp-mirror) on this repository, with `mirror.json` listing each file's bytes, sha256, the date PROFECO was accessed and its source URL. `tools/mirror-qqp.mjs` refreshes it from a network that reaches PROFECO (it runs `tools/build-qqp.mjs --download-only` and uploads only the archives whose sha256 changed). The build tries PROFECO first, then the mirror, and verifies the checksum; the credit's access date stays the date PROFECO was accessed. The licence permits it: Libre Uso MX (a) "Hacer y distribuir copias del conjunto de datos y su contenido", and CC BY 4.0 on datos.gob.mx; the release notes carry the credit and the non-endorsement line.

Consequence: PROFECO publishes monthly, and the site's data is as fresh as the last mirror refresh. Someone (or a scheduled task on a machine in Mexico) has to run `npm run qqp:mirror` about once a month; when nobody does, the site keeps working and shows the date of its latest week.

## 20. Recent window and partial weeks (added 2026-10-21, later still)

An adversarial review of the published data measured three honesty defects. (1) The default view used
each store's latest-ever observation, up to 20 months old, and `products.json` took `min / median /
max` from the product's last week with any observation, which was usually the final one-day week:
recomputed from the series, the old summary had a median n of **9 stores**, **352 medians came from a
single store**, and 1,730 of the 2,366 summaries came from the week of 2026-08-31 (186 of those from
one store). (2) That week, Monday 2026-08-31, holds one day of survey (PROFECO's file ends that day)
and was treated as a full week. (3) Two size-parser errors put invented per-unit prices on screen.
This round changes the contract (`docs/PIPELINES.md`, Prices) and `tools/check-qqp.mjs` enforces it.
Runs 5 and 6 of the pipeline (`--skip-download`, cached archives; 6 adds `fixSizes`): 379 s and 486 s, peak RSS 1,385 and 949 MB, 0 warnings;
the same 499 stores, 2,366 products, 677 groups, 88 weeks and 7,046,669 observations as before.

### A. The recent window

`meta.recent = { from: "2026-08-04", to: "2026-08-31", days: 28 }`: `to` is `latestDate`, `from` is
27 days earlier. "Recent" means, per store and product, the store's latest observation whose date
falls in [from, to] (since `to` is the last date in the data, that is the latest-ever observation when
it is no older than `from`). `products/<id>.json` and `stores/<id>.json` are unchanged; the app
filters their `latest` / `items` with `date >= recent.from`.

- **products.json**: `min / median / max` over one price per store, its recent observation; `stores`
  = that n; new `storesAll` (stores that ever had the product in the data range), `asOf` (newest
  recent date) and `last` (newest observation anywhere; equal to `asOf` when there is one). The
  26-week product filter is unchanged (436 stale products still left out). Result: **2,244 products
  with a recent median, 122 without** (`stores: 0`, prices and `asOf` null; their `last` falls in
  March for 29, April 8, May 17, June 13, July 54, 1–3 August 1). PACIC: 213 with, 21 without (for
  example Aceite Imperial 875 ml, last 2026-06-11; Arroz `arroz-4d515a`, last 2026-07-29).
  **Median n of a recent median: 66 stores** (p10 6, p90 129; median `storesAll` 109); 72 recent
  medians rest on one store and 111 on two to four.
- **Change against the old summary**, over the 2,244 products that have a median in both: 1,393
  identical, **210 moved by more than 10 %** (117 up, 93 down), 66 by more than 25 %. The largest
  are one-day stubs replaced by four weeks: Papel Higiénico Elite 4 rollos 10.10 → 23.90 (7 stores
  on 2026-08-31 → 52), Levofloxacino 7 tabletas 54 → 109.90, Salchicha Fud 1 kg 70 → 128.50,
  Jitomate bola 1 kg 59.90 → 19.90 (58 stores, 34 of them at 19.90), Tilapia filete 293 → 109,
  Mango ataulfo 98.50 → 42.
- **groups.json**: `stores` = stores with a recent observation of any member (7 groups have none:
  cintilla, dip, granola, gurrubata, merluza, queso-crema, romeritos), new `storesAll`, and new `unit`,
  decided once per group: the dimension most members share (g, ml, pza; ties in that order) and, within
  it, the **median** member size: ml → `l` from 700 ml else `100ml`, g → `kg` from 700 g else `100g`,
  pza → `pza`, null without sizes. Count: pza 308, kg 133, 100g 122, 100ml 91, l 20, null 3. Against
  the old max-size rule 32 groups change, all to the smaller unit (atún, mayonesa, crema, lenteja,
  queso fresco, shampoo, aceite de oliva, gel antibacterial… → per 100 g / 100 ml), which is the
  point: six 1 kg tuna loins no longer make canned tuna a per-kilo ranking. `products` now counts the
  members actually in products.json: it had counted members dropped by the 26-week filter in 81
  groups (aceituna said 25, has 2).
- **stores.json**: new `recentProducts` (products with an observation in the window), `lastVisitProducts`
  (products recorded on `lastSeen`) and `index.latestWeek`. 58 stores have no recent product (36
  Central de Abasto stalls, 14 tortillerías, 4 mercados, one Bodega Aurrera last seen 2026-03-25…);
  the median store has 8 recent products (tortillerías have one). Every store has products on its
  `lastSeen` date (no last visit is made only of excluded categories). Of the 244 stores with an
  index, `latestWeek` is 2026-08-31 for 29, 2026-08-24 for 109, 2026-08-17 for 45 and older for 61.

### B. Partial weeks

`meta.weekInfo` has one entry per week of `meta.weeks`: `{ week, days, observations, stores, partial }`
(distinct survey dates, rows after the city rules, stores), and `meta.partialWeeks` lists the flagged
ones. `partial` = rows under 50 % of the median week's 83,862.5. Four weeks:

| Week | Days | Rows | Stores | Why |
|---|---:|---:|---:|---|
| 2024-12-30 | 2 | 31,581 | 143 | the data starts on Thursday 2025-01-02 |
| 2025-12-22 | 4 | 30,212 | 286 | Christmas |
| 2025-12-29 | 4 | 35,064 | 257 | New Year |
| 2026-08-31 | 1 | 18,301 | 53 | PROFECO's file ends on that Monday |

The lightest week not flagged is 2025-11-17 (42,652 rows, 51 %). Weeks by survey days: 5 days 60,
7 days 11, 4 days 10, 6 days 4, one each of 1, 2 and 3. Nothing is dropped; the app labels the week.
Caveat for the owner: the basket index of a partial week is computed against city medians of that
week only, so the 29 stores whose latest index is from 2026-08-31 are compared with the 53 stores
surveyed that Monday.

### C. Visits

`visits.json = { weeks: [...meta.weeks], stores: { storeId: [products recorded that week, 0 when
none] } }`, minified, for the 499 stores of stores.json; the counts are the store-week cells of the
build (they sum to its 6,863,687 cells). **131,903 bytes raw, 34,272 gzip** (zlib level 9; 29,713
brotli). A week with an index always has at least 30 products recorded (the checker verifies it).

### D. The size parser

Before choosing the rules, `data/cache/audit/pipeline/scan-parser.mjs` ran the old and new parser
over the whole 2025–2026 vocabulary (`presentations.tsv` from §10: 5,268 distinct strings, 4,957 in the
metro area) and over each candidate pattern. **Exactly four strings change, 7,271 metro rows**
(19,145 national); no other parse moves.

| Rule | Matches (metro strings / rows) | Changes (metro strings / rows) | Every match in the data |
|---|---:|---:|---|
| `N <container> (X unit C/U)` → N × X, `pack: N` | 2 / 2,615 | 2 / 2,615 | `Caja con 25 Sobres (1.2 Gr. C/u). Limón` (1,444), `… (1.2 Gr. C/U). Limón` (1,171): 1.2 g → 30 g, pack 25 |
| `[1-9]\d{0,2}.\d{3}` before Gr./G./Ml. is a thousands point | 3 / 8,699 | 2 / 4,656 | `Bolsa 3.564 Gr. Polvo. Oxigeno Activo` (1,690) and `… Limpieza Instantánea` (2,966): 3.564 g → 3,564 g; `Frasco Gotero 24 Ml. 1.000 G., Solución Gotas` (4,043) matches but its first size, 24 ml, still wins |
| the same shape before Kg./L./Lt. stays decimal | 0 / 0 (national: 2 strings, 861 rows) | 0 | `Botella 3.785 Lt. Entera` (860 national rows) and `Botella 1.892 Lt. Entera` (1): a US gallon and half gallon of milk, which confirms the decimal reading |
| a leading zero is never a thousands group | 1 / 283 | 0 | `Frasco con 120 Ml. Solución 0.040 G./0.150 G./100 Ml.` stays 120 ml |

Fewer than ten real examples exist for each rule; the table lists all of them. Bracketed sizes without
`C/U`, or after a word that is not a container, keep their old reading (`Paquete con 2 Pinguinos (80
Gr.)` 80 g, `Bote 480 Gr. (900 Ml.)` 480 g). The 3,564 g reading is the right one: at the recent
median of 159 pesos it is 44.61 pesos a kilo, beside Ace's 648 g and 756 g bags at 46.30; read as
3.564 g it was over 44,000 pesos a kilo. In the build: **te-d46ac7** (Té McCormick limón) is now
`{ value: 30, unit: "g", pack: 25 }`, 68.33 pesos per 100 g at its recent median of 20.50 (it showed
about 1,700); **detergente-p-8162e8** (Ace Oxígeno Activo) is `{ value: 3564, unit: "g" }`.
`tests/presentation.test.mjs` has 10 new real-string cases (the four changed strings, both gallon
milks, the leading-zero medicine, and three bracket forms that must not change) and two input forms
(`Bolsa 1.500 Kg.` and `Bolsa 1.500 Gr.`, both 1,500 g); 99 tests pass, all the old ones included.

Two more per-unit errors of the same family surfaced in the scan. They are one-off shapes, so instead
of a parser rule they are fixed by curation, with the new `fixSizes` map in `data/overrides/qqp.json`
(documented in `docs/PIPELINES.md`, Curation; applied right after parsing, listed in the run report
and counted in `meta.json` → `rules.fixSizes`): `Caja con 4 Sobres Conteniendo Cada Uno 5 Ampolletas
Aplicadoras con 0.5 Ml. C/U` (Lagricel Ofteno, `lagricel-ofteno-b7bc82`, parsed 0.5 ml, now
`{ value: 10, unit: "ml", pack: 20 }`, 4 sobres × 5 ampolletas × 0.5 ml) and `2 Cajas con Frasco con
30 Cápsulas C/U` (Biometrix, `biometrix-8c6488`, parsed 30 pza, now `{ value: 60, unit: "pza", pack:
2 }`). Outside the build, `Caja con 2 Carteras. 4 Tabletas C/u` still parses as 4 (really 8); it
needs a `fixSizes` line if the product comes back. Both in-build products are alone in their group.
A scan of per-unit prices more than 5× or under 1/5 of their group's median
(`compare.mjs`) finds 11 members, none a parse error (thermometers, imported mineral water, sweetener,
bulk pepper, KN95 masks, a cheap disinfectant spray, potato starch).

### Sizes and the cap

`tools/check-qqp.mjs` fails products.json above 1,400 KB raw (the budget is bytes on the wire: Pages
serves gzip); the pipeline's own limit, which halves the 26-week window when the file would not fit,
moved from 700 KB to the same 1,400 KB, so nothing new is excluded. On 2026-10-21:

| File | Bytes raw | gzip -9 | Before this round (raw) |
|---|---:|---:|---:|
| `products.json` | 784,562 | 96,837 | 654,168 (88,069 gzip) |
| `stores.json` | 524,145 | 63,337 | 491,794 |
| `groups.json` | 86,441 | 13,275 | 67,067 |
| `meta.json` | 13,606 | 2,544 | 3,122 |
| `visits.json` | 131,903 | 34,272 | new |
| **All output** | **57,184,117 (5,237 files)** | | 56,859,594 (5,236 files) |

Also changed: `meta.source.license.url` is the CC BY 4.0 deed (https://creativecommons.org/licenses/by/4.0/)
and `meta.source.dataset` names the datos.gob.mx record that states it, for the newest archive in the
build (`programa_quien_es_quien_precios_<year>`; today
https://www.datos.gob.mx/dataset/programa_quien_es_quien_precios_2026); `tools/build-geo.mjs`'s
User-Agent now points at https://github.com/vdm285/compa-precio (the CamelCase URL was a 404).

### Verification

`node tools/check-qqp.mjs` exits 0. Besides the shapes, it now recomputes every product's recent
summary (stores, storesAll, min, median, max, last) from its `products/<id>.json` and compares it with
products.json (2,366 of 2,366 equal), checks that medians are null exactly when `stores` is 0, that
`weekInfo` is aligned with `weeks` and sums to `counts.observations`, that `partialWeeks` matches it,
that every group's `unit` is one of `l, 100ml, kg, 100g, pza, null` and in a dimension its members
have, that a group's `products` equals its members, and that `visits.json` is aligned with `weeks`
and covers every store. `node --test tests/*.test.mjs`: 108 pass.

By hand, from PROFECO's August 2026 CSVs (`data/cache/audit/pipeline/recompute-recent.mjs`: its own
CSV reader and city filter, the documented store identity, per store the latest row dated 2026-08-04
to 2026-08-31, the median of those): all six products match products.json exactly.

| Product | n | min | median | max | asOf |
|---|---:|---:|---:|---:|---|
| `huevo-6da37e` Huevo San Juan C/18 (PACIC, group unit `pza`) | 136 | 42 | 43 | 52.50 | 2026-08-31 |
| `tortilla-de-9688d0` Tortilla de Maíz 1 kg granel (PACIC, `kg`) | 274 | 12.40 | 20 | 25 | 2026-08-31 |
| `leche-pasteurizada-8ec006` Alpura Clásica 1 l (`l`) | 78 | 27 | 32 | 37 | 2026-08-31 |
| `jitomate-ced931` Jitomate bola 1 kg (PACIC, `kg`) | 58 | 19.90 | 19.90 | 66.70 | 2026-08-31 |
| `detergente-p-8162e8` Ace 3,564 g (`kg`) | 115 | 138.50 | 159 | 184 | 2026-08-31 |
| `te-d46ac7` Té McCormick 25 × 1.2 g (`100g`) | 60 | 19.90 | 20.50 | 27.50 | 2026-08-31 |

The scan saw 2,366 window rows of these products, 15 of them from stores without coordinates (not
published), and 12 cases where one store has two different prices on the same date (the row read last
wins, in the pipeline and by hand). Scripts and outputs: `data/cache/audit/pipeline/`
(`scan-parser.mjs`, `compare.mjs`, `recompute-recent.mjs`, their `.json`, and `before/` with the
previous outputs).
