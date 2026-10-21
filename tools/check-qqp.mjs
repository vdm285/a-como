// Validates public/data/qqp/ against the contract in docs/PIPELINES.md: shapes, size caps,
// cross-references, null rates. Exit 1 on a hard failure. Run: node tools/check-qqp.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/data/qqp';
const problems = [], warnings = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);
const read = (p) => JSON.parse(readFileSync(join(DIR, p), 'utf8'));
const kb = (p) => (statSync(join(DIR, p)).size / 1024).toFixed(0);
const isoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

if (!existsSync(DIR)) { console.error(`${DIR} missing: run npm run qqp first`); process.exit(1); }

const meta = read('meta.json');
for (const k of ['built', 'source', 'city', 'weeks', 'latestDate', 'counts']) if (!(k in meta)) fail(`meta.json: missing ${k}`);
if (!meta.source || !meta.source.license || !meta.source.license.name) fail('meta.json: source.license.name missing');
if (!Array.isArray(meta.weeks) || !meta.weeks.every(isoDate)) fail('meta.json: weeks must be ISO dates');
if (meta.weeks && meta.weeks.some((w) => new Date(w + 'T12:00:00Z').getUTCDay() !== 1)) warn('meta.json: some weeks are not Mondays');
if (meta.weeks && meta.weeks.some((w, i) => i && w <= meta.weeks[i - 1])) fail('meta.json: weeks not ascending');

const stores = read('stores.json');
const storeIds = new Set();
let noCoords = 0, noIndex = 0;
for (const s of stores) {
  for (const k of ['id', 'chain', 'name', 'lastSeen']) if (s[k] == null) fail(`stores.json: ${s.id || '?'} missing ${k}`);
  if (storeIds.has(s.id)) fail(`stores.json: duplicate id ${s.id}`);
  storeIds.add(s.id);
  if (s.lat == null || s.lon == null) { noCoords++; warn(`stores.json: ${s.id} (${s.name}) has no coordinates`); }
  else if (!(s.lat > 18.9 && s.lat < 20.0 && s.lon > -99.6 && s.lon < -98.5)) { noCoords++; warn(`stores.json: ${s.id} (${s.name}) coordinates outside the metro box: ${s.lat}, ${s.lon}`); }
  if (!s.index || s.index.latest == null) noIndex++;
}
if (+kb('stores.json') > 600) warn(`stores.json is ${kb('stores.json')} kB (> 600)`);

// products.json may use short keys (the size cap); normalise as src/data/qqp.js does
const products = read('products.json').map((p) => (p.id ? p : { id: p.i, group: p.g, name: p.n, brand: p.b, presentation: p.p, category: p.c, catalog: p.k, size: p.z || null, stores: p.s, min: p.lo, median: p.md, max: p.hi, pacic: p.pacic }));
const productIds = new Set();
let noSize = 0, noMedian = 0, pacic = 0;
for (const p of products) {
  for (const k of ['id', 'group', 'name', 'presentation', 'category', 'stores', 'median']) if (p[k] == null) fail(`products.json: ${p.id || '?'} missing ${k}`);
  if (productIds.has(p.id)) fail(`products.json: duplicate id ${p.id}`);
  productIds.add(p.id);
  if (!p.size) noSize++;
  else if (!(p.size.value > 0) || !['g', 'ml', 'pza'].includes(p.size.unit)) fail(`products.json: ${p.id} bad size ${JSON.stringify(p.size)}`);
  if (p.median == null) noMedian++;
  if (p.pacic) pacic++;
}
// The cap is on the wire (GitHub Pages serves gzip): 1.4 MB raw is ~200 kB compressed.
if (+kb('products.json') > 1400) fail(`products.json is ${kb('products.json')} kB (cap 1400 raw)`);

const groups = read('groups.json');
const groupIds = new Set(groups.map((g) => g.id));
for (const p of products) if (!groupIds.has(p.group)) fail(`products.json: ${p.id} group ${p.group} not in groups.json`);

// product files: sample every 25th
const pfiles = readdirSync(join(DIR, 'products'));
const base = pfiles.filter((f) => !f.endsWith('.weeks.json'));
const weeksF = pfiles.filter((f) => f.endsWith('.weeks.json'));
if (base.length !== products.length) warn(`products/: ${base.length} files for ${products.length} products`);
if (weeksF.length !== products.length) warn(`products/: ${weeksF.length} weeks files for ${products.length} products`);
let maxP = 0, maxW = 0, checked = 0;
for (let i = 0; i < base.length; i += 25) {
  const f = base[i];
  const p = read(`products/${f}`);
  const size = statSync(join(DIR, 'products', f)).size / 1024; maxP = Math.max(maxP, size);
  if (size > 30) warn(`products/${f} is ${size.toFixed(0)} kB (cap 30)`);
  if (!p.latest || !p.series) fail(`products/${f}: missing latest or series`);
  for (const sid of Object.keys(p.latest || {})) if (!storeIds.has(sid)) fail(`products/${f}: unknown store ${sid}`);
  for (const [sid, v] of Object.entries(p.latest || {})) if (!(Array.isArray(v) && v[0] > 0 && isoDate(v[1]))) fail(`products/${f}: bad latest for ${sid}: ${JSON.stringify(v)}`);
  const wf = f.replace('.json', '.weeks.json');
  if (existsSync(join(DIR, 'products', wf))) {
    const w = read(`products/${wf}`);
    const ws = statSync(join(DIR, 'products', wf)).size / 1024; maxW = Math.max(maxW, ws);
    if (ws > 40) warn(`products/${wf} is ${ws.toFixed(0)} kB (cap 40)`);
    if (!Array.isArray(w.weeks) || w.weeks.length > 26) fail(`products/${wf}: weeks must be ≤ 26`);
    for (const [sid, arr] of Object.entries(w.stores || {})) { if (!storeIds.has(sid)) fail(`products/${wf}: unknown store ${sid}`); if (arr.length !== w.weeks.length) fail(`products/${wf}: ${sid} series length ${arr.length} ≠ ${w.weeks.length}`); }
  }
  checked++;
}

// store files
const sfiles = existsSync(join(DIR, 'stores')) ? readdirSync(join(DIR, 'stores')) : [];
if (sfiles.length !== stores.length) warn(`stores/: ${sfiles.length} files for ${stores.length} stores`);
let maxS = 0;
for (let i = 0; i < sfiles.length; i += 10) {
  const f = sfiles[i];
  const s = read(`stores/${f}`);
  const size = statSync(join(DIR, 'stores', f)).size / 1024; maxS = Math.max(maxS, size);
  if (size > 120) warn(`stores/${f} is ${size.toFixed(0)} kB (cap 120)`);
  if (!Array.isArray(s.items)) fail(`stores/${f}: items missing`);
  for (const [pid, price, date] of s.items.slice(0, 200)) { if (!productIds.has(pid)) fail(`stores/${f}: unknown product ${pid}`); if (!(price > 0)) fail(`stores/${f}: bad price for ${pid}`); if (!isoDate(date) && !/^\d{2}-\d{2}$/.test(date || '')) fail(`stores/${f}: bad date ${date}`); }
}

// index
const index = read('index.json');
if (!Array.isArray(index.weeks) || !index.stores) fail('index.json: weeks/stores missing');
for (const [sid, arr] of Object.entries(index.stores || {})) { if (!storeIds.has(sid)) fail(`index.json: unknown store ${sid}`); if (arr.length !== index.weeks.length) fail(`index.json: ${sid} length ${arr.length} ≠ ${index.weeks.length}`); }
if (+kb('index.json') > 400) warn(`index.json is ${kb('index.json')} kB (> 400)`);

const total = (() => { let n = 0, b = 0; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); if (st.isDirectory()) walk(p); else { n++; b += st.size; } } }; walk(DIR); return [n, b]; })();

console.log(`stores ${stores.length} (no index: ${noIndex}, outside box: ${noCoords}) · products ${products.length} (no size: ${noSize}, no median: ${noMedian}, pacic: ${pacic}) · groups ${groups.length} · weeks ${meta.weeks.length} (${meta.weeks[0]} → ${meta.weeks[meta.weeks.length - 1]}) · latest ${meta.latestDate}`);
console.log(`sizes: stores.json ${kb('stores.json')} kB · products.json ${kb('products.json')} kB · index.json ${kb('index.json')} kB · max product ${maxP.toFixed(0)} kB · max weeks ${maxW.toFixed(0)} kB · max store ${maxS.toFixed(0)} kB · total ${total[0]} files, ${(total[1] / 1048576).toFixed(1)} MB · sampled ${checked} product files`);
for (const w of warnings.slice(0, 40)) console.log('warn:', w);
if (warnings.length > 40) console.log(`… ${warnings.length - 40} more warnings`);
for (const p of problems.slice(0, 40)) console.log('FAIL:', p);
if (problems.length > 40) console.log(`… ${problems.length - 40} more failures`);
process.exit(problems.length ? 1 : 0);
