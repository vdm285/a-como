#!/usr/bin/env node
// tools/build-qqp.mjs — PROFECO "Quién es Quién en los Precios" (QQP) -> public/data/qqp/*
//
// Build-time pipeline. Node 22+, ESM, built-ins only. Downloads the yearly RAR archives from
// datos.profeco.gob.mx (unless cached), extracts them with 7-Zip (or a fallback), streams the
// CSVs line by line, keeps one city (see CITY), and writes the static JSON the app reads.
// Facts about the data and the reasoning behind every rule: docs/research/profeco-qqp-2026-10.md
//
//   node tools/build-qqp.mjs [--years=2026,2025] [--skip-download] [--city=cdmx]
//
// It never throws out of the whole run because one file or one row is bad: it logs and continues.
// Everything it downloads or extracts stays under data/cache/qqp/ (on the project drive).

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePresentation } from './lib/presentation.mjs';

// ---------------------------------------------------------------------------------------------
// CITY config block. Another city is a new entry here plus a review of its map.
// ---------------------------------------------------------------------------------------------
export const CITIES = {
  cdmx: {
    id: 'cdmx',
    name: 'Ciudad de México y zona metropolitana',
    // ESTADO values that are the city itself (compared without accents or case; both spellings occur).
    states: ['Ciudad de México', 'Distrito Federal', 'CDMX'],
    // Metro municipalities of the neighbouring state. The data writes some of them short
    // ("Atizapán", "Tlalnepantla", "Coacalco"); a prefix match on the accent-less name catches both.
    metro: {
      states: ['Estado de México', 'México'],
      municipios: ['Naucalpan de Juárez', 'Tlalnepantla de Baz', 'Huixquilucan', 'Ecatepec de Morelos', 'Nezahualcóyotl',
        'Atizapán de Zaragoza', 'Cuautitlán Izcalli', 'Coacalco de Berriozábal', 'Tultitlán', 'Chimalhuacán', 'La Paz',
        'Texcoco', 'Chalco', 'Ixtapaluca', 'Valle de Chalco Solidaridad', 'Nicolás Romero', 'Tecámac', 'Cuautitlán',
        'Chicoloapan', 'Zumpango'],
    },
    // Display spellings for values the data writes inconsistently (key = accent-less lowercase).
    labels: {
      'ciudad de mexico': 'Ciudad de México', 'distrito federal': 'Ciudad de México', 'cdmx': 'Ciudad de México',
      'estado de mexico': 'Estado de México', 'mexico': 'Estado de México',
      'gustavo a. madero': 'Gustavo A. Madero', 'gustavo a madero': 'Gustavo A. Madero',
      'magdalena contreras': 'La Magdalena Contreras', 'alvaro obregon': 'Álvaro Obregón',
    },
    // Coordinates outside this box are set to null (the store keeps its prices, it just has no dot).
    bbox: { latMin: 19.0, latMax: 19.95, lonMin: -99.45, lonMax: -98.75 },
    // GIRO values to keep; null keeps every GIRO (the app can filter). See the research doc.
    giros: null,
    // Categories left out of the city build (accent-less lowercase). They are not groceries, have no
    // comparable size, and without them products.json fits the 700 KB contract. Curation can add more
    // in data/overrides/qqp.json (excludeCategories); removing one here needs a size check.
    excludeCategories: ['arts. de esparcimiento (juguetes)', 'aparatos electricos', 'aparatos electronicos', 'articulos deportivos',
      'enseres menores', 'refrigeradores', 'accesorios domesticos', 'utensilios domesticos', 'material escolar'],
    // products.json is "what it costs now": a product not seen in the city within this many weeks is left
    // out of the build (it comes back when PROFECO surveys it again). Halved when the file would not fit.
    recentWeeks: 26,
  },
};

// Sizes are meaningless for these (a 7 kg washing machine is not 7 kg of food). Accent-less lowercase.
const NO_SIZE_CATEGORIES = new Set(['aparatos electricos', 'aparatos electronicos', 'refrigeradores', 'enseres menores',
  'accesorios domesticos', 'utensilios domesticos', 'arts. de esparcimiento (juguetes)', 'articulos deportivos']);
const NO_SIZE_CATALOGS = new Set(['electrodomesticos', 'juguetes', 'tenis']);

const SOURCE = {
  name: 'PROFECO, Quién es Quién en los Precios',
  url: 'https://datos.profeco.gob.mx/datos_abiertos/qqp.php',
  fileUrl: (token) => `https://datos.profeco.gob.mx/datos_abiertos/file.php?t=${token}`,
  // Tokens seen on the page on 2026-10-21; the page is scraped first, these are the fallback.
  tokens: { 2026: '9d62040eae6dcc63e36b8ac821427647', 2025: 'b9540b181657c2bc7735892091e81f96' },
  extras: { 'QQP_metadatos_dataset.csv': '42ed7dad4da507b9d536d9b737e7912d', 'QQP_diccionario_dataset.csv': '2de3505b2d37e7db72557a09262d95c7' },
  // datos.gob.mx states the dataset licence as Creative Commons Attribution 4.0 (see the research doc)
  license: { name: 'CC BY 4.0 (Datos Abiertos, Gobierno de México)', url: 'https://datos.gob.mx/' },
  userAgent: 'compa-precio build (github.com/vdm285/compa-precio)',
};

const LIMITS = {
  productsJson: 700 * 1024,   // products.json
  productFile: 30 * 1024,     // products/<id>.json
  weeksFile: 40 * 1024,       // products/<id>.weeks.json
  storeFile: 120 * 1024,      // stores/<id>.json
  storesJson: 1500 * 1024,    // stores.json (soft, warn only)
  indexJson: 1500 * 1024,     // index.json (soft, warn only)
};
const INDEX_MIN_PRODUCTS = 30; // a store's weekly basket index needs at least this many products
const WEEKS_WINDOW = 26;       // weeks kept per store in products/<id>.weeks.json

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'data', 'cache', 'qqp');
const OUT = path.join(ROOT, 'public', 'data', 'qqp');
const OVERRIDES_FILE = path.join(ROOT, 'data', 'overrides', 'qqp.json');

// ---------------------------------------------------------------------------------------------
// Small helpers (exported so the overrides file can be curated with the same ids)
// ---------------------------------------------------------------------------------------------
export function stripAccents(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
// Key normalisation: accent-less, lower-case, punctuation and spaces collapsed to one space.
// "Col. San José" and "Col.San Jose" become the same store; "Mega Soriana" stays distinct from "Soriana".
export function normKey(s) { return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export function slug(s) { return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
export function sha1(s) { return createHash('sha1').update(s).digest('hex'); }
// Store identity: the chain FORMAT label (PROFECO's label after the curation file's renameChains, so
// "Central de Abastos" and "Central de Abasto" are one stall), the store name and the address.
export function storeId(formatLabel, name, address) { return `${slug(formatLabel) || 'tienda'}-${sha1(normKey(`${formatLabel}|${name}|${address}`)).slice(0, 6)}`; }
export function productId(producto, marca, presentacion) {
  const words = slug(producto).split('-').filter(Boolean).slice(0, 2).join('-') || 'producto';
  return `${words}-${sha1(normKey(`${producto}|${marca}|${presentacion}`)).slice(0, 6)}`;
}
export function groupId(producto) { return slug(producto) || 'producto'; }
const DAY = 86400000;
export function dayToIso(day) { return new Date(day * DAY).toISOString().slice(0, 10); }
export function mondayOf(day) { return day - ((day + 3) % 7 + 7) % 7; } // day 0 = Thu 1970-01-01
function median(sorted) { const n = sorted.length; if (!n) return null; const h = n >> 1; return n % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2; }
function round2(x) { return Math.round(x * 100) / 100; }
function round4(x) { return Math.round(x * 10000) / 10000; }
function kb(n) { return `${(n / 1024).toFixed(1)} KB`; }
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

// RFC 4180 line parser. Fast path when the line has no quote (the vast majority).
function parseLine(line) {
  if (line.indexOf('"') < 0) return line.split(',');
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += c; }
    else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// A value seen with several spellings: keep the one seen most recently (newer files carry accents).
class Variants {
  constructor() { this.map = new Map(); }
  add(v, day) { const e = this.map.get(v); if (e) { e.n++; if (day > e.last) e.last = day; } else this.map.set(v, { n: 1, last: day }); }
  best() { let b = null; for (const [v, e] of this.map) if (!b || e.last > b.e.last || (e.last === b.e.last && e.n > b.e.n)) b = { v, e }; return b ? b.v : ''; }
  get size() { return this.map.size; }
  all() { return [...this.map.entries()].map(([v, e]) => [v, e.n]); }
}

function parseArgs(argv) {
  const now = new Date();
  const args = { years: [now.getFullYear(), now.getFullYear() - 1], skipDownload: false, city: 'cdmx', help: false };
  for (const a of argv) {
    if (a.startsWith('--years=')) args.years = a.slice(8).split(',').map((y) => Number(y.trim())).filter((y) => y > 2000);
    else if (a === '--skip-download') args.skipDownload = true;
    else if (a.startsWith('--city=')) args.city = a.slice(7).trim();
    else if (a === '--help' || a === '-h') args.help = true;
    else log(`ignoring unknown argument ${a}`);
  }
  return args;
}

// ---------------------------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------------------------
function readManifest() { try { return JSON.parse(fs.readFileSync(path.join(CACHE, 'raw', 'manifest.json'), 'utf8')); } catch { return {}; } }
function writeManifest(m) { fs.writeFileSync(path.join(CACHE, 'raw', 'manifest.json'), JSON.stringify(m, null, 2)); }

function curlAvailable() { const r = spawnSync('curl', ['--version'], { windowsHide: true }); return !r.error && r.status === 0; }

async function downloadTo(url, file) {
  const tmp = `${file}.part`;
  if (curlAvailable()) {
    const r = spawnSync('curl', ['-L', '-sS', '-A', SOURCE.userAgent, '-o', tmp, url], { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    if (r.error || r.status !== 0) throw new Error(`curl failed (${r.error ? r.error.message : `exit ${r.status}`})`);
  } else {
    const res = await fetch(url, { headers: { 'user-agent': SOURCE.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { Readable } = await import('node:stream');
    const { pipeline } = await import('node:stream/promises');
    await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp));
  }
  const size = fs.statSync(tmp).size;
  if (size === 0) { fs.rmSync(tmp, { force: true }); throw new Error('empty download'); }
  fs.renameSync(tmp, file);
  return size;
}

// The page lists one link per year: <a href="file.php?t=TOKEN">Quién es Quién en los Precios 2026</a>
async function tokensFromPage() {
  const out = {};
  try {
    const res = await fetch(SOURCE.url, { headers: { 'user-agent': SOURCE.userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const re = /href="file\.php\?t=([0-9a-f]{32})"[^>]*>\s*Qui[eé]n es Qui[eé]n en los Precios\s+(\d{4})\s*</gi;
    let m;
    while ((m = re.exec(html))) out[Number(m[2])] = m[1];
  } catch (e) { log(`could not read the PROFECO page for tokens (${e.message}); using the known tokens`); }
  return out;
}

async function download(years, skip) {
  const raw = path.join(CACHE, 'raw');
  fs.mkdirSync(raw, { recursive: true });
  const manifest = readManifest();
  const files = [];
  const pageTokens = skip ? {} : await tokensFromPage();
  for (const y of years) {
    const name = `QQP_${y}.rar`;
    const file = path.join(raw, name);
    const have = fs.existsSync(file) && fs.statSync(file).size > 0;
    if (!have && !skip) {
      const token = pageTokens[y] || SOURCE.tokens[y];
      if (!token) { log(`no download token for ${y} (not on the page, not in SOURCE.tokens); skipping`); continue; }
      const url = SOURCE.fileUrl(token);
      log(`downloading ${name} from ${url} ...`);
      try {
        const size = await downloadTo(url, file);
        manifest[name] = { bytes: size, retrieved: new Date().toISOString(), url };
        log(`downloaded ${name}: ${size} bytes`);
      } catch (e) { log(`download of ${name} failed: ${e.message}`); continue; }
    } else if (!have) { log(`${name} is not in the cache and --skip-download was given; skipping ${y}`); continue; }
    else log(`${name} already in cache (${fs.statSync(file).size} bytes)`);
    const st = fs.statSync(file);
    if (!manifest[name]) manifest[name] = { bytes: st.size, retrieved: st.mtime.toISOString(), url: SOURCE.fileUrl(pageTokens[y] || SOURCE.tokens[y] || '') };
    files.push({ year: y, name, file, bytes: st.size, retrieved: manifest[name].retrieved });
  }
  if (!skip) {
    for (const [name, token] of Object.entries(SOURCE.extras)) {
      const file = path.join(raw, name);
      if (fs.existsSync(file) && fs.statSync(file).size > 0) continue;
      try { const size = await downloadTo(SOURCE.fileUrl(token), file); manifest[name] = { bytes: size, retrieved: new Date().toISOString(), url: SOURCE.fileUrl(token) }; }
      catch (e) { log(`download of ${name} failed: ${e.message}`); }
    }
  }
  writeManifest(manifest);
  return files;
}

// ---------------------------------------------------------------------------------------------
// Extraction: 7z on PATH, then the usual Windows installs, then WinRAR, unrar, bsdtar/tar.
// ---------------------------------------------------------------------------------------------
function runs(cmd, args) { const r = spawnSync(cmd, args, { windowsHide: true, encoding: 'utf8' }); return !r.error && (r.status === 0 || r.status === 7) ? r : null; }
function findExtractor(rar) {
  const candidates = [];
  if (process.env.QQP_EXTRACTOR) candidates.push({ name: process.env.QQP_EXTRACTOR, kind: '7z' });
  candidates.push({ name: '7z', kind: '7z' }, { name: '7za', kind: '7z' }, { name: '7zz', kind: '7z' });
  if (process.platform === 'win32') {
    for (const p of ['C:\\Program Files\\7-Zip\\7z.exe', 'C:\\Program Files (x86)\\7-Zip\\7z.exe']) candidates.push({ name: p, kind: '7z' });
    for (const p of ['C:\\Program Files\\WinRAR\\UnRAR.exe', 'C:\\Program Files\\WinRAR\\WinRAR.exe', 'C:\\Program Files (x86)\\WinRAR\\UnRAR.exe']) candidates.push({ name: p, kind: 'unrar' });
  }
  candidates.push({ name: 'unrar', kind: 'unrar' }, { name: 'bsdtar', kind: 'tar' });
  if (process.platform === 'win32') candidates.push({ name: 'C:\\Windows\\System32\\tar.exe', kind: 'tar' });
  candidates.push({ name: 'tar', kind: 'tar' });
  for (const c of candidates) {
    if (c.name.includes('\\') || c.name.includes('/')) { if (!fs.existsSync(c.name)) continue; }
    if (c.kind === '7z') { if (!runs(c.name, ['i'])) continue; }
    else if (c.kind === 'unrar') { if (!runs(c.name, [])) continue; }
    else if (c.kind === 'tar') { const r = runs(c.name, ['-tf', rar]); if (!r || !/\.csv/i.test(r.stdout || '')) continue; } // GNU tar cannot read RAR; libarchive's can
    return c;
  }
  return null;
}
function extract(rar, outDir) {
  const ex = findExtractor(rar);
  if (!ex) throw new Error('no RAR extractor found: install 7-Zip (https://7-zip.org) or set QQP_EXTRACTOR to a 7z executable');
  fs.mkdirSync(outDir, { recursive: true });
  let r;
  if (ex.kind === '7z') r = spawnSync(ex.name, ['x', '-y', `-o${outDir}`, rar], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  else if (ex.kind === 'unrar') r = spawnSync(ex.name, ['x', '-y', '-o+', rar, outDir + path.sep], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  else r = spawnSync(ex.name, ['-xf', rar, '-C', outDir], { stdio: ['ignore', 'ignore', 'inherit'], windowsHide: true });
  if (r.error || r.status !== 0) throw new Error(`${ex.name} failed (${r.error ? r.error.message : `exit ${r.status}`})`);
  return ex.name;
}
function listCsvs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listCsvs(p));
    else if (/\.csv$/i.test(e.name)) out.push(p);
  }
  return out.sort();
}
function ensureExtracted(file) {
  const dir = path.join(CACHE, 'extract', String(file.year));
  const marker = path.join(dir, '.extracted');
  const st = fs.statSync(file.file);
  const stamp = `${st.size}:${st.mtimeMs}`;
  if (fs.existsSync(marker) && fs.readFileSync(marker, 'utf8') === stamp && listCsvs(dir).length) { log(`${file.name} already extracted`); return { dir, extractor: 'cache' }; }
  const head = Buffer.alloc(8); const fd = fs.openSync(file.file, 'r'); fs.readSync(fd, head, 0, 8, 0); fs.closeSync(fd);
  if (!head.toString('latin1').startsWith('Rar!')) log(`warning: ${file.name} does not start with the RAR signature (${JSON.stringify(head.toString('latin1'))}); trying anyway`);
  fs.rmSync(dir, { recursive: true, force: true });
  log(`extracting ${file.name} ...`);
  const extractor = extract(file.file, dir);
  fs.writeFileSync(marker, stamp);
  log(`extracted ${file.name} with ${extractor}: ${listCsvs(dir).length} csv files`);
  return { dir, extractor };
}

// ---------------------------------------------------------------------------------------------
// The city filter
// ---------------------------------------------------------------------------------------------
function makeCityFilter(city) {
  const states = new Set(city.states.map(normKey));
  const metroStates = new Set((city.metro?.states || []).map(normKey));
  const metroMunis = (city.metro?.municipios || []).map((m) => ({ label: m, key: normKey(m) }));
  const giros = city.giros ? new Set(city.giros.map(normKey)) : null;
  // cheap pre-filter on the raw line: it must contain one of the state names (with or without accents)
  const needles = [...new Set([...city.states, ...(city.metro?.states || [])].flatMap((s) => [s, stripAccents(s)]))];
  const muniLabel = (muniKey) => {
    for (const m of metroMunis) if (muniKey === m.key || m.key.startsWith(muniKey + ' ') || muniKey.startsWith(m.key + ' ')) return m.label;
    return null;
  };
  return {
    maybe(line) { for (const n of needles) if (line.includes(n)) return true; return false; },
    // returns { state, municipio } display labels, or null when the row is outside the city
    classify(estado, municipio, giro) {
      if (giros && !giros.has(normKey(giro))) return null;
      const ek = normKey(estado); const mk = normKey(municipio);
      if (states.has(ek)) return { state: city.labels[ek] || estado, municipio: city.labels[mk] || municipio };
      if (metroStates.has(ek)) { const label = muniLabel(mk); if (label) return { state: city.labels[ek] || estado, municipio: label }; }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Growable column store for the rows kept (typed arrays, no per-row objects)
// ---------------------------------------------------------------------------------------------
class Rows {
  constructor(cap = 1 << 20) { this.n = 0; this.p = new Int32Array(cap); this.s = new Int32Array(cap); this.d = new Int32Array(cap); this.v = new Float64Array(cap); }
  push(p, s, d, v) {
    if (this.n === this.p.length) { const grow = (a, C) => { const b = new C(a.length * 2); b.set(a); return b; }; this.p = grow(this.p, Int32Array); this.s = grow(this.s, Int32Array); this.d = grow(this.d, Int32Array); this.v = grow(this.v, Float64Array); }
    const i = this.n++; this.p[i] = p; this.s[i] = s; this.d[i] = d; this.v[i] = v;
  }
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();
  let peakRss = 0;
  const tick = () => { peakRss = Math.max(peakRss, process.memoryUsage().rss); };
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log('node tools/build-qqp.mjs [--years=2026,2025] [--skip-download] [--city=cdmx]'); return 0; }
  const city = CITIES[args.city];
  if (!city) { log(`unknown city "${args.city}"; known: ${Object.keys(CITIES).join(', ')}`); return 1; }
  fs.mkdirSync(CACHE, { recursive: true });
  const warnings = [];
  const warn = (m) => { warnings.push(m); log('warning:', m); };

  // overrides (curation)
  let ov = { excludeStores: [], excludeProducts: [], excludeCategories: [], fixCoords: {}, renameChains: {}, notes: '' };
  try { ov = { ...ov, ...JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf8')) }; log(`overrides: ${ov.excludeStores.length} stores, ${ov.excludeProducts.length} products, ${ov.excludeCategories.length} categories excluded; ${Object.keys(ov.fixCoords).length} coordinate fixes; ${Object.keys(ov.renameChains).length} chain renames`); }
  catch (e) { log(`no usable overrides file (${e.message}); continuing without`); }
  const excludeStores = new Set(ov.excludeStores), excludeProducts = new Set(ov.excludeProducts);
  const excludeCategories = new Set([...(city.excludeCategories || []), ...ov.excludeCategories].map(normKey));
  // renameChains: "<PROFECO label>": { chain: "<brand a shopper says>", format: "<PROFECO's label, title-cased>" } (a plain string is the chain)
  const renameChains = new Map(Object.entries(ov.renameChains).map(([a, b]) => [normKey(a), typeof b === 'string' ? { chain: b, format: a } : { chain: b.chain || a, format: b.format || a }]));

  // 1. download + extract
  let files = [];
  try { files = await download(args.years, args.skipDownload); } catch (e) { log(`download phase failed: ${e.message}`); }
  const csvs = [];
  const extractors = new Set();
  for (const f of files) {
    try { const { dir, extractor } = ensureExtracted(f); extractors.add(extractor); for (const c of listCsvs(dir)) csvs.push({ year: f.year, file: c }); }
    catch (e) { warn(`${f.name}: ${e.message}`); }
  }
  if (!csvs.length) { log('no CSV files to process; nothing written'); return 1; }
  tick();

  // 2. stream the CSVs
  const filter = makeCityFilter(city);
  const stores = []; const storeIdx = new Map();   // normKey(format|name|addr) -> idx
  const products = []; const productIdx = new Map(); // normKey(producto|marca|presentacion) -> idx
  const rows = new Rows();
  // Labels the data spells inconsistently ("Básicos"/"Basicos", "PACIC"/"Pacic"): one spelling per key, city-wide.
  const normCache = new Map();
  const nk = (v) => { let k = normCache.get(v); if (k === undefined) { k = normKey(v); normCache.set(v, k); } return k; };
  const labels = { cat: new Map(), catalog: new Map(), giro: new Map() };
  const seen = (map, v, day) => { const k = nk(v); let e = map.get(k); if (!e) { e = new Variants(); map.set(k, e); } e.add(v, day); };
  const canon = (map, v) => { const e = map.get(nk(v)); return e ? e.best() : v; };
  const formatOf = (chain) => { const rn = renameChains.get(nk(chain)); return rn ? rn.format : chain; };
  const stats = { files: 0, lines: 0, badLines: 0, badPrice: 0, badDate: 0, kept: 0, byFile: [] };
  const REQUIRED = ['producto', 'presentacion', 'marca', 'categoria', 'catalogo', 'precio', 'fecha_registro', 'cadena_comercial', 'giro', 'nombre_comercial', 'direccion', 'estado', 'municipio', 'latitud', 'longitud'];
  for (const { year, file } of csvs) {
    const rel = path.relative(CACHE, file);
    try {
      const rl = readline.createInterface({ input: fs.createReadStream(file, { highWaterMark: 1 << 20 }), crlfDelay: Infinity });
      let cols = null; let fileRows = 0; let fileKept = 0; let pending = null; let minDay = Infinity; let maxDay = -Infinity;
      for await (let line of rl) {
        if (!cols) {
          if (line.charCodeAt(0) === 0xfeff) line = line.slice(1);
          const names = parseLine(line).map((h) => stripAccents(h).trim().toLowerCase());
          cols = Object.fromEntries(names.map((n, i) => [n, i]));
          const missing = REQUIRED.filter((r) => !(r in cols));
          if (missing.length) { warn(`${rel}: header is missing ${missing.join(', ')}; file skipped (header: ${line.slice(0, 200)})`); cols = 'skip'; break; }
          continue;
        }
        if (pending !== null) { line = pending + '\n' + line; pending = null; }
        else if (!filter.maybe(line)) { stats.lines++; fileRows++; continue; }
        // a quoted field may span lines: odd number of quotes means the record continues
        let q = 0; for (let i = 0; i < line.length; i++) if (line.charCodeAt(i) === 34) q++;
        if (q % 2 === 1) { pending = line; continue; }
        stats.lines++; fileRows++;
        const f = parseLine(line);
        if (f.length !== REQUIRED.length && f.length < Object.keys(cols).length) { stats.badLines++; continue; }
        const c = filter.classify(f[cols.estado], f[cols.municipio], f[cols.giro]);
        if (!c) continue;
        const price = Number(f[cols.precio]);
        if (!(price > 0) || !Number.isFinite(price)) { stats.badPrice++; continue; }
        const dm = /^(\d{4})[/-](\d{2})[/-](\d{2})/.exec(f[cols.fecha_registro]);
        if (!dm) { stats.badDate++; continue; }
        const day = Date.UTC(+dm[1], +dm[2] - 1, +dm[3]) / DAY;
        if (!Number.isFinite(day)) { stats.badDate++; continue; }
        const chain = f[cols.cadena_comercial], name = f[cols.nombre_comercial], addr = f[cols.direccion];
        const format = formatOf(chain);
        const sk = normKey(`${format}|${name}|${addr}`);
        let si = storeIdx.get(sk);
        if (si === undefined) {
          si = stores.length; storeIdx.set(sk, si);
          stores.push({ key: sk, format, chain: new Variants(), name: new Variants(), addr: new Variants(), muni: new Variants(), state: new Variants(), giro: new Variants(), coord: new Variants(), first: day, last: day, rows: 0 });
        }
        const st = stores[si];
        st.chain.add(chain, day); st.name.add(name, day); st.addr.add(addr, day); st.muni.add(c.municipio, day); st.state.add(c.state, day); st.giro.add(f[cols.giro], day);
        seen(labels.giro, f[cols.giro], day); seen(labels.cat, f[cols.categoria], day); seen(labels.catalog, f[cols.catalogo], day);
        st.coord.add(`${f[cols.latitud]},${f[cols.longitud]}`, day);
        if (day < st.first) st.first = day; if (day > st.last) st.last = day; st.rows++;
        const producto = f[cols.producto], marca = f[cols.marca], pres = f[cols.presentacion];
        const pk = normKey(`${producto}|${marca}|${pres}`);
        let pi = productIdx.get(pk);
        if (pi === undefined) {
          pi = products.length; productIdx.set(pk, pi);
          products.push({ key: pk, name: new Variants(), brand: new Variants(), pres: new Variants(), cat: new Variants(), catalog: new Variants(), rows: 0, last: day });
        }
        const pr = products[pi];
        pr.name.add(producto, day); pr.brand.add(marca, day); pr.pres.add(pres, day); pr.cat.add(f[cols.categoria], day); pr.catalog.add(f[cols.catalogo], day); pr.rows++;
        if (day > pr.last) pr.last = day;
        rows.push(pi, si, day, price);
        fileKept++; if (day < minDay) minDay = day; if (day > maxDay) maxDay = day;
      }
      if (pending !== null) { stats.badLines++; }
      if (cols === 'skip') continue;
      stats.files++; stats.kept += fileKept;
      stats.byFile.push({ file: rel, year, rows: fileRows, kept: fileKept, from: minDay < Infinity ? dayToIso(minDay) : null, to: maxDay > -Infinity ? dayToIso(maxDay) : null });
      tick();
      log(`${rel}: ${fileRows} rows, ${fileKept} kept (${(fileKept / Math.max(1, fileRows) * 100).toFixed(1)}%), rss ${(process.memoryUsage().rss / 1048576) | 0} MB`);
    } catch (e) { warn(`${rel}: ${e.message}; file skipped`); }
  }
  log(`streamed ${stats.lines} rows from ${stats.files} files; kept ${stats.kept}; bad lines ${stats.badLines}, bad prices ${stats.badPrice}, bad dates ${stats.badDate}`);
  if (!rows.n) { log('no rows for the city; nothing written'); return 1; }

  // 3. stores: ids, display values, coordinates, overrides
  const report = { builtFor: city.id, coords: { nullCoords: [], outsideBox: [], suspectedSwapped: [], fixed: [] }, duplicateNames: [], chainVariants: [], unparsedPresentations: [], priceOutliers: [], oversize: { storeFiles: [], weeksWindowReduced: [], productFiles: [], recentWeeks: null }, excluded: { stores: [], storesNoCoords: [], storesNoProducts: 0, products: 0, categories: 0, stale: 0 } };
  const storeOut = new Array(stores.length).fill(null);
  const storeKeep = new Uint8Array(stores.length);
  const idSeen = new Map();
  const bb = city.bbox;
  const byChainName = new Map();
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const chainRaw = s.chain.best(), name = s.name.best(), addr = s.addr.best();
    const id = storeId(s.format, name, addr);
    if (idSeen.has(id)) warn(`store id collision ${id} (${s.key} vs ${idSeen.get(id)})`); idSeen.set(id, s.key);
    if (excludeStores.has(id)) { report.excluded.stores.push(id); continue; }
    const rename = renameChains.get(normKey(chainRaw));
    const chain = rename ? rename.chain : chainRaw;
    const format = rename ? rename.format : s.format;
    if (s.chain.size > 1) report.chainVariants.push({ id, variants: s.chain.all() });
    let [lat, lon] = s.coord.best().split(',').map((x) => (x === '' ? NaN : Number(x)));
    const raw = { lat, lon };
    if (ov.fixCoords[id]) { [lat, lon] = ov.fixCoords[id]; report.coords.fixed.push({ id, from: raw, to: [lat, lon] }); }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { if (!ov.fixCoords[id]) report.coords.nullCoords.push({ id, chain, name, addr, raw }); lat = null; lon = null; }
    else if (lat < bb.latMin || lat > bb.latMax || lon < bb.lonMin || lon > bb.lonMax) {
      const hint = (lon >= bb.latMin && lon <= bb.latMax && lat >= bb.lonMin && lat <= bb.lonMax) ? 'swapped'
        : (-lat >= bb.latMin && -lat <= bb.latMax && lon >= bb.lonMin && lon <= bb.lonMax) ? 'lat sign'
          : (lat >= bb.latMin && lat <= bb.latMax && -lon >= bb.lonMin && -lon <= bb.lonMax) ? 'lon sign' : 'unknown';
      report.coords.outsideBox.push({ id, chain, name, addr, raw, hint });
      if (hint === 'swapped') report.coords.suspectedSwapped.push(id);
      lat = null; lon = null;
    }
    const nk = `${normKey(chainRaw)}|${normKey(name)}`;
    if (!byChainName.has(nk)) byChainName.set(nk, []); byChainName.get(nk).push({ id, addr });
    // the app is a map: a store without a usable position is left out until curation fixes it (fixCoords)
    if (lat == null) { report.excluded.storesNoCoords.push(id); continue; }
    storeKeep[i] = 1;
    storeOut[i] = { id, chain, format, name, address: addr, municipio: s.muni.best(), state: s.state.best(), lat: lat == null ? null : Number(lat.toFixed(6)), lon: lon == null ? null : Number(lon.toFixed(6)), giro: canon(labels.giro, s.giro.best()), firstSeen: dayToIso(s.first), lastSeen: dayToIso(s.last), products: 0, index: { latest: null, series: [] } };
  }
  for (const [, arr] of byChainName) if (arr.length > 1) report.duplicateNames.push(arr);
  // products: ids, display values, size, overrides
  const productOut = new Array(products.length).fill(null);
  const productKeep = new Uint8Array(products.length);
  const pidSeen = new Map();
  const groups = new Map(); // groupId -> { id, name, category: Variants, products: 0, stores: Set }
  const unparsed = new Map();
  let pacicCount = 0;
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const name = p.name.best(), brand = p.brand.best(), pres = p.pres.best(), cat = canon(labels.cat, p.cat.best()), catalog = canon(labels.catalog, p.catalog.best());
    const id = productId(name, brand, pres);
    if (pidSeen.has(id)) warn(`product id collision ${id} (${p.key} vs ${pidSeen.get(id)})`); pidSeen.set(id, p.key);
    if (excludeProducts.has(id)) { report.excluded.products++; continue; }
    if (excludeCategories.has(normKey(cat))) { report.excluded.categories++; continue; }
    const gid = groupId(name);
    let g = groups.get(gid);
    if (!g) { g = { id: gid, name, category: new Variants(), products: 0, stores: new Set() }; groups.set(gid, g); }
    g.category.add(cat, p.rows); g.products++;
    let size = null;
    if (!NO_SIZE_CATEGORIES.has(normKey(cat)) && !NO_SIZE_CATALOGS.has(normKey(catalog))) {
      try { size = parsePresentation(pres); } catch (e) { warn(`parsePresentation failed for ${JSON.stringify(pres)}: ${e.message}`); }
      if (!size) { const k = pres; const u = unparsed.get(k) || { presentation: k, rows: 0, products: [] }; u.rows += p.rows; if (u.products.length < 3) u.products.push(`${name} (${cat})`); unparsed.set(k, u); }
    }
    productKeep[i] = 1;
    productOut[i] = { id, group: gid, name, brand, presentation: pres, category: cat, catalog, size, stores: 0, min: null, median: null, max: null };
    // CATÁLOGO "PACIC" marks the official basket (Paquete Contra la Inflación y la Carestía); any spelling, any month
    if ([...p.catalog.map.keys()].some((v) => normKey(v) === 'pacic')) { productOut[i].pacic = 1; pacicCount++; }
  }
  tick();

  // 4. weeks, the recency window, and the per-product aggregation
  const allWeeks = (() => { const s = new Set(); for (let i = 0; i < rows.n; i++) if (storeKeep[rows.s[i]] && productKeep[rows.p[i]]) s.add(mondayOf(rows.d[i])); return [...s].sort((a, b) => a - b); })();
  if (!allWeeks.length) { log('no observations left after the exclusions; nothing written'); return 1; }
  // products.json must fit LIMITS.productsJson with full field names: keep the products seen within the
  // last `recentWeeks` weeks, halving the window while the (estimated) file would not fit
  const estimate = (keep) => { let b = 2; for (let i = 0; i < products.length; i++) if (keep[i]) { const p = productOut[i]; b += JSON.stringify({ ...p, stores: 999, min: 9999.99, median: 9999.99, max: 9999.99 }).length + 1; } return b; };
  let recentWeeks = city.recentWeeks || Infinity;
  const eligible = productKeep.slice();
  for (;;) {
    const cutoff = recentWeeks === Infinity ? -Infinity : allWeeks[Math.max(0, allWeeks.length - recentWeeks)];
    for (let i = 0; i < products.length; i++) productKeep[i] = eligible[i] && products[i].last >= cutoff ? 1 : 0;
    const est = estimate(productKeep);
    if (est <= LIMITS.productsJson || recentWeeks <= 4) { log(`products seen in the last ${recentWeeks} weeks: ${productKeep.reduce((a, b) => a + b, 0)} (products.json about ${kb(est)})`); break; }
    log(`products.json would be about ${kb(est)} with a ${recentWeeks}-week window; halving`);
    recentWeeks = Math.max(4, Math.floor(recentWeeks / 2));
  }
  report.oversize.recentWeeks = recentWeeks;
  report.excluded.stale = eligible.reduce((a, b) => a + b, 0) - productKeep.reduce((a, b) => a + b, 0);
  const weekSet = new Set();
  for (let i = 0; i < rows.n; i++) if (storeKeep[rows.s[i]] && productKeep[rows.p[i]]) weekSet.add(mondayOf(rows.d[i]));
  const weekDays = [...weekSet].sort((a, b) => a - b);
  const weeks = weekDays.map(dayToIso);
  const weekIdx = new Map(weekDays.map((d, i) => [d, i]));
  const nWeeks = weeks.length;
  const windowStart = Math.max(0, nWeeks - WEEKS_WINDOW);
  let latestDay = -Infinity;
  // counting sort of row indexes by product
  const counts = new Int32Array(products.length + 1);
  for (let i = 0; i < rows.n; i++) counts[rows.p[i] + 1]++;
  for (let i = 1; i <= products.length; i++) counts[i] += counts[i - 1];
  const order = new Uint32Array(rows.n);
  { const pos = counts.slice(0, products.length); for (let i = 0; i < rows.n; i++) order[pos[rows.p[i]]++] = i; }

  fs.rmSync(path.join(OUT, 'products'), { recursive: true, force: true });
  fs.rmSync(path.join(OUT, 'stores'), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'products'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'stores'), { recursive: true });

  const ratios = stores.map(() => new Array(nWeeks));            // ratios[store][week] = number[]
  const storeItems = stores.map(() => []);                        // [[productId, price, date]]
  const storeProductCount = new Int32Array(stores.length);
  let cells = 0, productFiles = 0, observations = 0;
  const outBytes = { products: 0, weeks: 0 };
  for (let pi = 0; pi < products.length; pi++) {
    if (!productKeep[pi]) continue;
    const po = productOut[pi];
    try {
      const cell = new Map(); // store*nWeeks+week -> row index (latest observation in that week)
      for (let k = counts[pi]; k < counts[pi + 1]; k++) {
        const r = order[k];
        const si = rows.s[r];
        if (!storeKeep[si]) continue;
        observations++;
        const w = weekIdx.get(mondayOf(rows.d[r]));
        const key = si * nWeeks + w;
        const prev = cell.get(key);
        if (prev === undefined || rows.d[r] >= rows.d[prev]) cell.set(key, r);
      }
      if (!cell.size) continue;
      cells += cell.size;
      const byWeek = new Array(nWeeks);
      const latest = new Map(); // store -> row
      const storeSet = new Set();
      for (const [key, r] of cell) {
        const si = (key / nWeeks) | 0; const w = key % nWeeks;
        (byWeek[w] || (byWeek[w] = [])).push(rows.v[r]);
        const l = latest.get(si); if (l === undefined || rows.d[r] > rows.d[l]) latest.set(si, r);
        storeSet.add(si);
        if (rows.d[r] > latestDay) latestDay = rows.d[r];
      }
      const series = new Array(nWeeks);
      const wmed = new Float64Array(nWeeks);
      let lastWeek = -1;
      for (let w = 0; w < nWeeks; w++) {
        const a = byWeek[w];
        if (!a) { series[w] = [weeks[w], null, null, null, 0]; continue; }
        a.sort((x, y) => x - y);
        wmed[w] = median(a);
        series[w] = [weeks[w], round2(wmed[w]), a[0], a[a.length - 1], a.length];
        lastWeek = w;
      }
      // ratios for the store index + the store's own product list
      for (const [key, r] of cell) {
        const si = (key / nWeeks) | 0; const w = key % nWeeks;
        if (wmed[w] > 0) (ratios[si][w] || (ratios[si][w] = [])).push(rows.v[r] / wmed[w]);
      }
      const latestObj = {};
      for (const [si, r] of latest) {
        latestObj[storeOut[si].id] = [rows.v[r], dayToIso(rows.d[r])];
        storeItems[si].push([po.id, rows.v[r], dayToIso(rows.d[r])]);
        storeProductCount[si]++;
      }
      // products.json summary: prices of the product's latest week with observations
      const lw = byWeek[lastWeek];
      po.stores = storeSet.size; po.min = lw[0]; po.max = lw[lw.length - 1]; po.median = round2(median(lw));
      const g = groups.get(po.group); for (const si of storeSet) g.stores.add(si);
      // products/<id>.json
      const pj = JSON.stringify({ id: po.id, latest: latestObj, series });
      if (pj.length > LIMITS.productFile) report.oversize.productFiles.push({ id: po.id, bytes: pj.length });
      fs.writeFileSync(path.join(OUT, 'products', `${po.id}.json`), pj); outBytes.products += pj.length;
      // products/<id>.weeks.json: last 26 weeks per store (halved when over the limit)
      let start = windowStart; let wj;
      for (;;) {
        const wk = weeks.slice(start);
        const st = {};
        for (const si of storeSet) {
          const arr = new Array(wk.length).fill(null); let any = false;
          for (let w = start; w < nWeeks; w++) { const r = cell.get(si * nWeeks + w); if (r !== undefined) { arr[w - start] = rows.v[r]; any = true; } }
          if (any) st[storeOut[si].id] = arr;
        }
        wj = JSON.stringify({ id: po.id, weeks: wk, stores: st });
        if (wj.length <= LIMITS.weeksFile || nWeeks - start <= 4) break;
        start = nWeeks - Math.max(4, ((nWeeks - start) / 2) | 0);
        report.oversize.weeksWindowReduced.push({ id: po.id, weeks: nWeeks - start });
      }
      fs.writeFileSync(path.join(OUT, 'products', `${po.id}.weeks.json`), wj); outBytes.weeks += wj.length;
      productFiles++;
    } catch (e) { warn(`product ${po.id}: ${e.message}; skipped`); productKeep[pi] = 0; }
  }
  tick();

  // 5. store index, stores.json, index.json, stores/<id>.json
  const indexStores = {};
  let storeFiles = 0; let storeBytes = 0; let storesWithIndex = 0; let shortDates = 0;
  const storesJson = [];
  for (let si = 0; si < stores.length; si++) {
    if (!storeKeep[si]) continue;
    if (!storeProductCount[si]) { report.excluded.storesNoProducts++; continue; } // only excluded categories were sold there
    const so = storeOut[si];
    try {
      const dense = new Array(nWeeks).fill(null);
      const sparse = [];
      for (let w = 0; w < nWeeks; w++) {
        const a = ratios[si][w];
        if (!a || a.length < INDEX_MIN_PRODUCTS) continue;
        a.sort((x, y) => x - y);
        const v = Number(median(a).toFixed(3));
        dense[w] = v; sparse.push([weeks[w], v]); so.index.latest = v;
      }
      if (sparse.length) storesWithIndex++;
      so.index.series = sparse;
      so.products = storeProductCount[si];
      indexStores[so.id] = dense;
      storesJson.push(so);
      // stores/<id>.json
      const items = storeItems[si].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      let sj = JSON.stringify({ id: so.id, week: dayToIso(mondayOf(stores[si].last)), items });
      if (sj.length > LIMITS.storeFile) {
        const short = items.map(([p, v, d]) => [p, v, d.slice(5)]);
        sj = JSON.stringify({ id: so.id, week: dayToIso(mondayOf(stores[si].last)), items: short });
        shortDates++;
        report.oversize.storeFiles.push({ id: so.id, items: items.length, bytes: sj.length, dates: 'MM-DD', stillOver: sj.length > LIMITS.storeFile });
      }
      fs.writeFileSync(path.join(OUT, 'stores', `${so.id}.json`), sj); storeFiles++; storeBytes += sj.length;
    } catch (e) { warn(`store ${so.id}: ${e.message}; skipped`); }
  }
  storesJson.sort((a, b) => (a.id < b.id ? -1 : 1));
  const storesText = JSON.stringify(storesJson);
  if (storesText.length > LIMITS.storesJson) warn(`stores.json is ${kb(storesText.length)} (soft limit ${kb(LIMITS.storesJson)})`);
  fs.writeFileSync(path.join(OUT, 'stores.json'), storesText);
  const indexText = JSON.stringify({ weeks, stores: indexStores });
  if (indexText.length > LIMITS.indexJson) warn(`index.json is ${kb(indexText.length)} (soft limit ${kb(LIMITS.indexJson)})`);
  fs.writeFileSync(path.join(OUT, 'index.json'), indexText);

  // 6. products.json, groups.json
  const productsJson = productOut.filter((p, i) => p && productKeep[i] && p.stores > 0).sort((a, b) => (a.id < b.id ? -1 : 1));
  const productsText = JSON.stringify(productsJson);
  if (productsText.length > LIMITS.productsJson) warn(`products.json is ${kb(productsText.length)}, over the ${kb(LIMITS.productsJson)} limit (window ${recentWeeks} weeks)`);
  fs.writeFileSync(path.join(OUT, 'products.json'), productsText);
  const groupsJson = [...groups.values()].filter((g) => g.stores.size > 0).map((g) => ({ id: g.id, name: g.name, category: g.category.best(), products: g.products, stores: g.stores.size })).sort((a, b) => (a.id < b.id ? -1 : 1));
  fs.writeFileSync(path.join(OUT, 'groups.json'), JSON.stringify(groupsJson));

  // 7. meta.json
  const municipios = [...new Set(storesJson.map((s) => s.municipio))].sort((a, b) => a.localeCompare(b, 'es'));
  const meta = {
    built: new Date().toISOString(),
    source: { name: SOURCE.name, url: SOURCE.url, files: files.map((f) => ({ name: f.name, bytes: f.bytes, retrieved: f.retrieved })), license: SOURCE.license },
    city: { id: city.id, name: city.name, states: [...new Set(storesJson.map((s) => s.state))], municipios },
    weeks, latestDate: latestDay > -Infinity ? dayToIso(latestDay) : null,
    counts: { stores: storesJson.length, products: productsJson.length, groups: groupsJson.length, observations, storeFiles, pacic: productsJson.filter((p) => p.pacic).length },
    rules: { recentWeeks, excludeCategories: [...excludeCategories], indexMinProducts: INDEX_MIN_PRODUCTS },
  };
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));

  // 8. curation report for the research doc (cache only)
  report.unparsedPresentations = [...unparsed.values()].sort((a, b) => b.rows - a.rows).slice(0, 80);
  report.stats = stats; report.extractors = [...extractors]; report.warnings = warnings;
  report.summary = { stores: storesJson.length, storesWithIndex, products: productsJson.length, groups: groupsJson.length, weeks: nWeeks, observations, cells, storeFiles, shortDates, productFiles, recentWeeks, bytes: { products: outBytes.products, weeks: outBytes.weeks, stores: storeBytes, storesJson: storesText.length, indexJson: indexText.length, productsJson: productsText.length } };
  fs.writeFileSync(path.join(CACHE, `report-${city.id}.json`), JSON.stringify(report, null, 1));

  tick();
  const total = (dir) => { let n = 0, b = 0; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const t = total(p); n += t.n; b += t.b; } else { n++; b += fs.statSync(p).size; } } return { n, b }; };
  const tot = total(OUT);
  console.log(JSON.stringify({
    city: city.id, years: args.years, extractors: [...extractors],
    rowsStreamed: stats.lines, rowsKept: stats.kept, observations, cells,
    stores: storesJson.length, storesWithIndex, products: productsJson.length, pacicProducts: productsJson.filter((p) => p.pacic).length, groups: groupsJson.length, weeks: nWeeks, latestDate: meta.latestDate,
    excluded: { storesNoCoords: report.excluded.storesNoCoords.length, storesNoProducts: report.excluded.storesNoProducts, storesByOverride: report.excluded.stores.length, productsByCategory: report.excluded.categories, productsByOverride: report.excluded.products, productsStale: report.excluded.stale, recentWeeks },
    storesNullCoords: report.coords.nullCoords.length, storesOutsideBox: report.coords.outsideBox.length, unparsedPresentations: unparsed.size,
    files: tot.n, bytes: tot.b, productsJsonBytes: productsText.length, storeFilesShortDates: shortDates, weeksWindowReduced: report.oversize.weeksWindowReduced.length, productFilesOver: report.oversize.productFiles.length,
    warnings: warnings.length, seconds: Math.round((Date.now() - t0) / 1000), peakRssMB: Math.round(peakRss / 1048576),
  }, null, 1));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }, (e) => { log(`fatal: ${e && e.stack || e}`); process.exitCode = 1; });
}
