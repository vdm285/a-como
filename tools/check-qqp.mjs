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
const DAY = 86400000;
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);
// the recent window: { from, to, days }, to = latestDate, from = to - (days - 1)
const recent = meta.recent;
if (!recent || !isoDate(recent.from) || !isoDate(recent.to) || !(Number.isInteger(recent.days) && recent.days > 0)) fail(`meta.json: recent must be { from, to, days } (got ${JSON.stringify(recent)})`);
else {
  if (recent.to !== meta.latestDate) fail(`meta.json: recent.to ${recent.to} ≠ latestDate ${meta.latestDate}`);
  if (recent.from !== addDays(recent.to, -(recent.days - 1))) fail(`meta.json: recent.from ${recent.from} ≠ recent.to − ${recent.days - 1} days`);
  if (recent.days !== 28) warn(`meta.json: recent.days is ${recent.days} (the contract says 28)`);
}
// weekInfo: one entry per week, aligned; partialWeeks = the weeks flagged partial
if (!Array.isArray(meta.weekInfo) || meta.weekInfo.length !== (meta.weeks || []).length) fail(`meta.json: weekInfo must have one entry per week (${(meta.weekInfo || []).length} for ${(meta.weeks || []).length})`);
else {
  meta.weekInfo.forEach((w, i) => {
    if (w.week !== meta.weeks[i]) fail(`meta.json: weekInfo[${i}].week ${w.week} ≠ weeks[${i}] ${meta.weeks[i]}`);
    if (!(Number.isInteger(w.days) && w.days >= 1 && w.days <= 7)) fail(`meta.json: weekInfo ${w.week} days ${w.days}`);
    if (!(Number.isInteger(w.observations) && w.observations > 0)) fail(`meta.json: weekInfo ${w.week} observations ${w.observations}`);
    if (!(Number.isInteger(w.stores) && w.stores > 0)) fail(`meta.json: weekInfo ${w.week} stores ${w.stores}`);
    if (typeof w.partial !== 'boolean') fail(`meta.json: weekInfo ${w.week} partial must be a boolean`);
  });
  const flagged = meta.weekInfo.filter((w) => w.partial).map((w) => w.week);
  if (JSON.stringify(flagged) !== JSON.stringify(meta.partialWeeks)) fail(`meta.json: partialWeeks ${JSON.stringify(meta.partialWeeks)} ≠ weekInfo's ${JSON.stringify(flagged)}`);
  const obs = meta.weekInfo.reduce((a, w) => a + w.observations, 0);
  if (meta.counts && obs !== meta.counts.observations) fail(`meta.json: weekInfo observations sum ${obs} ≠ counts.observations ${meta.counts.observations}`);
}
const inRecent = (d) => recent && d >= recent.from && d <= recent.to;
// curation counts: data/overrides/qqp.json fixSizes applied to products in the build
if (meta.rules && 'fixSizes' in meta.rules && !(Number.isInteger(meta.rules.fixSizes) && meta.rules.fixSizes >= 0)) fail(`meta.json: rules.fixSizes must be a count (got ${meta.rules.fixSizes})`);
if (meta.source && meta.source.dataset && !/^https:\/\/www\.datos\.gob\.mx\/dataset\/programa_quien_es_quien_precios_\d{4}$/.test(meta.source.dataset)) fail(`meta.json: source.dataset ${meta.source.dataset} is not a datos.gob.mx QQP record`);

const stores = read('stores.json');
const storeIds = new Set();
let noCoords = 0, noIndex = 0;
for (const s of stores) {
  for (const k of ['id', 'chain', 'name', 'lastSeen']) if (s[k] == null) fail(`stores.json: ${s.id || '?'} missing ${k}`);
  if (storeIds.has(s.id)) fail(`stores.json: duplicate id ${s.id}`);
  storeIds.add(s.id);
  if (s.unplaced) { if (s.lat != null || s.lon != null) fail(`stores.json: ${s.id} is unplaced but has coordinates`); }
  else if (s.lat == null || s.lon == null) { noCoords++; warn(`stores.json: ${s.id} (${s.name}) has no coordinates`); }
  else if (!(s.lat > 18.9 && s.lat < 20.0 && s.lon > -99.6 && s.lon < -98.5)) { noCoords++; warn(`stores.json: ${s.id} (${s.name}) coordinates outside the metro box: ${s.lat}, ${s.lon}`); }
  if (!s.index || s.index.latest == null) noIndex++;
  if (s.index && s.index.latest != null && !(meta.weeks || []).includes(s.index.latestWeek)) fail(`stores.json: ${s.id} index.latestWeek ${s.index.latestWeek} is not a week of the data`);
  if (s.index && s.index.latest == null && s.index.latestWeek != null) fail(`stores.json: ${s.id} has index.latestWeek without index.latest`);
  if (s.index && s.index.latestWeek != null && s.index.series.length && s.index.series.at(-1)[0] !== s.index.latestWeek) fail(`stores.json: ${s.id} index.latestWeek ≠ the last week of index.series`);
  for (const k of ['products', 'recentProducts', 'lastVisitProducts']) if (!Number.isInteger(s[k]) || s[k] < 0) fail(`stores.json: ${s.id} ${k} must be a count (got ${s[k]})`);
  if (s.recentProducts > s.products || s.lastVisitProducts > s.products) fail(`stores.json: ${s.id} recentProducts/lastVisitProducts above products`);
  if (s.lastSeen < (recent && recent.from) && s.recentProducts > 0) fail(`stores.json: ${s.id} has recent products but lastSeen ${s.lastSeen} is before the window`);
}
if (+kb('stores.json') > 600) warn(`stores.json is ${kb('stores.json')} kB (> 600)`);

// products.json may use short keys (the size cap); normalise as src/data/qqp.js does
const products = read('products.json').map((p) => (p.id ? p : { id: p.i, group: p.g, name: p.n, brand: p.b, presentation: p.p, category: p.c, catalog: p.k, size: p.z || null, stores: p.s, storesAll: p.sa, min: p.lo, median: p.md, max: p.hi, asOf: p.as ?? null, last: p.la, pacic: p.pacic }));
const productIds = new Set();
let noSize = 0, noMedian = 0, pacic = 0;
for (const p of products) {
  for (const k of ['id', 'group', 'name', 'presentation', 'category', 'stores', 'storesAll', 'last']) if (p[k] == null) fail(`products.json: ${p.id || '?'} missing ${k}`);
  if (productIds.has(p.id)) fail(`products.json: duplicate id ${p.id}`);
  productIds.add(p.id);
  if (!p.size) noSize++;
  else if (!(p.size.value > 0) || !['g', 'ml', 'pza'].includes(p.size.unit)) fail(`products.json: ${p.id} bad size ${JSON.stringify(p.size)}`);
  // min/median/max/asOf summarise the recent window: null exactly when no store has a recent observation
  if (p.stores === 0) {
    noMedian++;
    if (p.min != null || p.median != null || p.max != null || p.asOf != null) fail(`products.json: ${p.id} has prices or asOf with stores 0`);
  } else {
    if (p.median == null || p.min == null || p.max == null) fail(`products.json: ${p.id} median is null with stores ${p.stores}`);
    else if (!(p.min > 0 && p.min <= p.median && p.median <= p.max)) fail(`products.json: ${p.id} min ≤ median ≤ max broken (${p.min}, ${p.median}, ${p.max})`);
    if (!inRecent(p.asOf)) fail(`products.json: ${p.id} asOf ${p.asOf} outside the recent window`);
    if (p.asOf !== p.last) fail(`products.json: ${p.id} asOf ${p.asOf} ≠ last ${p.last}`);
  }
  if (!(Number.isInteger(p.storesAll) && p.storesAll >= p.stores && p.storesAll > 0)) fail(`products.json: ${p.id} storesAll ${p.storesAll} for stores ${p.stores}`);
  if (!isoDate(p.last) || p.last > meta.latestDate) fail(`products.json: ${p.id} bad last ${p.last}`);
  if (p.stores === 0 && inRecent(p.last)) fail(`products.json: ${p.id} stores 0 but last ${p.last} is inside the recent window`);
  if (p.pacic) pacic++;
}
// The cap is on the wire (GitHub Pages serves gzip): 2.2 MB raw is ~300 kB compressed (raised from
// 1.4 MB when every PROFECO category came in, 2026-10-22).
if (+kb('products.json') > 2200) fail(`products.json is ${kb('products.json')} kB (cap 2200 raw)`);

const groups = read('groups.json');
const groupIds = new Set(groups.map((g) => g.id));
for (const p of products) if (!groupIds.has(p.group)) fail(`products.json: ${p.id} group ${p.group} not in groups.json`);
// groups: stores = stores with a recent observation of any member, storesAll = ever; unit decided once per group
const UNITS = new Set(['l', '100ml', 'kg', '100g', 'pza', null]);
const membersOf = new Map();
for (const p of products) { if (!membersOf.has(p.group)) membersOf.set(p.group, []); membersOf.get(p.group).push(p); }
for (const g of groups) {
  const m = membersOf.get(g.id) || [];
  if (!('unit' in g) || !UNITS.has(g.unit)) fail(`groups.json: ${g.id} unit ${JSON.stringify(g.unit)} not in l, 100ml, kg, 100g, pza, null`);
  if (g.products !== m.length) fail(`groups.json: ${g.id} products ${g.products} ≠ ${m.length} members in products.json`);
  if (!(Number.isInteger(g.storesAll) && g.storesAll >= g.stores && g.storesAll > 0)) fail(`groups.json: ${g.id} storesAll ${g.storesAll} for stores ${g.stores}`);
  if (g.storesAll < Math.max(0, ...m.map((p) => p.storesAll))) fail(`groups.json: ${g.id} storesAll below a member's`);
  if (g.stores < Math.max(0, ...m.map((p) => p.stores))) fail(`groups.json: ${g.id} stores below a member's`);
  if (g.unit == null && m.some((p) => p.size)) fail(`groups.json: ${g.id} unit null but a member has a size`);
  const dim = { l: 'ml', '100ml': 'ml', kg: 'g', '100g': 'g', pza: 'pza' }[g.unit];
  if (dim && !m.some((p) => p.size && p.size.unit === dim)) fail(`groups.json: ${g.id} unit ${g.unit} but no member is in ${dim}`);
}

// product files: sample every 25th
const pfiles = readdirSync(join(DIR, 'products'));
const base = pfiles.filter((f) => !f.endsWith('.weeks.json'));
const weeksF = pfiles.filter((f) => f.endsWith('.weeks.json'));
if (base.length !== products.length) warn(`products/: ${base.length} files for ${products.length} products`);
if (weeksF.length !== products.length) warn(`products/: ${weeksF.length} weeks files for ${products.length} products`);
// products.json's recent summary must be what products/<id>.json `latest` gives when filtered to
// dates ≥ recent.from (one price per store); every product, it is cheap
const med = (a) => { const v = [...a].sort((x, y) => x - y); const h = v.length >> 1; return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2; };
let summaryChecked = 0;
for (const p of products) {
  const f = `products/${p.id}.json`;
  if (!existsSync(join(DIR, f))) { fail(`${f} missing`); continue; }
  const lat = Object.values(read(f).latest || {});
  const rec = lat.filter(([, d]) => inRecent(d)).map(([v]) => v);
  const got = { stores: p.stores, storesAll: p.storesAll, median: p.median, min: p.min, max: p.max, last: p.last };
  const want = { stores: rec.length, storesAll: lat.length, median: rec.length ? Math.round(med(rec) * 100) / 100 : null, min: rec.length ? Math.min(...rec) : null, max: rec.length ? Math.max(...rec) : null, last: lat.map(([, d]) => d).sort().at(-1) };
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`products.json: ${p.id} summary ${JSON.stringify(got)} ≠ its latest file ${JSON.stringify(want)}`);
  summaryChecked++;
}

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
    if (ws > 72) warn(`products/${wf} is ${ws.toFixed(0)} kB (cap 72)`);
    if (!Array.isArray(w.weeks) || w.weeks.length > 26) fail(`products/${wf}: weeks must be ≤ 26`);
    // every weeks file covers the same weeks (the last 26 of meta.weeks): the app aligns baskets by date
    else if (JSON.stringify(w.weeks) !== JSON.stringify(meta.weeks.slice(-w.weeks.length)) || w.weeks.length !== Math.min(26, meta.weeks.length)) fail(`products/${wf}: weeks differ from the last 26 of meta.weeks (${w.weeks[0]} … ${w.weeks.length})`);
    for (const [sid, arr] of Object.entries(w.stores || {})) { if (!storeIds.has(sid)) fail(`products/${wf}: unknown store ${sid}`); if (arr.length !== w.weeks.length) fail(`products/${wf}: ${sid} series length ${arr.length} ≠ ${w.weeks.length}`); }
  }
  checked++;
}

// every weeks file must cover the same 26 weeks (sampling above could miss one)
const want = JSON.stringify(meta.weeks.slice(-Math.min(26, meta.weeks.length)));
let misaligned = 0;
for (const wf of weeksF) { const w = read(`products/${wf}`); if (JSON.stringify(w.weeks) !== want) { misaligned++; if (misaligned <= 3) fail(`products/${wf}: ${w.weeks.length} weeks from ${w.weeks[0]}, expected the last 26 of meta.weeks`); } }
if (misaligned > 3) fail(`${misaligned} weeks files misaligned in all`);

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

// visits.json: products recorded per store per week, aligned with meta.weeks, one row per store
let visitsLine = 'visits.json missing';
if (!existsSync(join(DIR, 'visits.json'))) fail('visits.json missing');
else {
  const v = read('visits.json');
  if (JSON.stringify(v.weeks) !== JSON.stringify(meta.weeks)) fail('visits.json: weeks ≠ meta.weeks');
  const ids = Object.keys(v.stores || {});
  for (const sid of ids) {
    const arr = v.stores[sid];
    if (!storeIds.has(sid)) fail(`visits.json: unknown store ${sid}`);
    if (!Array.isArray(arr) || arr.length !== meta.weeks.length) { fail(`visits.json: ${sid} length ${arr && arr.length} ≠ ${meta.weeks.length}`); continue; }
    if (!arr.every((n) => Number.isInteger(n) && n >= 0)) fail(`visits.json: ${sid} has a value that is not a count`);
    if (!arr.some((n) => n > 0)) fail(`visits.json: ${sid} has no visit at all`);
  }
  for (const sid of storeIds) if (!(sid in (v.stores || {}))) fail(`visits.json: store ${sid} missing`);
  // a store-week with a basket index had at least INDEX_MIN products recorded
  for (const [sid, arr] of Object.entries(index.stores || {})) arr.forEach((x, i) => { if (x != null && v.stores[sid] && v.stores[sid][i] < 30) fail(`visits.json: ${sid} ${meta.weeks[i]} has an index but ${v.stores[sid][i]} products`); });
  const cellsSum = Object.values(v.stores || {}).reduce((a, arr) => a + arr.reduce((b, n) => b + n, 0), 0);
  visitsLine = `visits.json ${kb('visits.json')} kB (${ids.length} stores, ${cellsSum} store-week-product cells)`;
}

// opening.json (Relieve, written by `npm run opening`): the stores it draws are the placed ones, and
// its two products carry the last 26 weeks
let openingLine = 'opening.json missing (run npm run opening)';
if (!existsSync(join(DIR, 'opening.json'))) fail('opening.json missing: run npm run opening after the pipeline');
else {
  const o = read('opening.json');
  const placed = stores.filter((s) => s.lat != null && s.lon != null).length;
  if (!Array.isArray(o.stores) || o.stores.length !== placed) fail(`opening.json: ${o.stores && o.stores.length} stores, ${placed} placed in stores.json`);
  for (const k of ['jitomate', 'tortilla']) {
    const p = o[k];
    if (!p || !Array.isArray(p.weeks) || p.weeks.length !== Math.min(26, meta.weeks.length)) fail(`opening.json: ${k} weeks ${p && p.weeks && p.weeks.length}`);
    else for (const [i, arr] of Object.entries(p.prices || {})) if (!(+i >= 0 && +i < o.stores.length) || arr.length !== p.weeks.length) { fail(`opening.json: ${k} prices row ${i}`); break; }
  }
  if (!o.stories || !o.stories.jitomate || !o.stories.tortillaKinds) fail('opening.json: stories missing');
  openingLine = `opening.json ${kb('opening.json')} kB (${o.stores.length} stores)`;
}

const total = (() => { let n = 0, b = 0; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const st = statSync(p); if (st.isDirectory()) walk(p); else { n++; b += st.size; } } }; walk(DIR); return [n, b]; })();

console.log(`stores ${stores.length} (no index: ${noIndex}, outside box: ${noCoords}) · products ${products.length} (no size: ${noSize}, no recent median: ${noMedian}, pacic: ${pacic}) · groups ${groups.length} · weeks ${meta.weeks.length} (${meta.weeks[0]} → ${meta.weeks[meta.weeks.length - 1]}) · latest ${meta.latestDate}`);
console.log(`recent ${recent && recent.from} → ${recent && recent.to} (${recent && recent.days} days) · partial weeks ${JSON.stringify(meta.partialWeeks)} · ${summaryChecked} product summaries recomputed from their latest files · ${visitsLine} · ${openingLine}`);
console.log(`sizes: stores.json ${kb('stores.json')} kB · products.json ${kb('products.json')} kB · index.json ${kb('index.json')} kB · max product ${maxP.toFixed(0)} kB · max weeks ${maxW.toFixed(0)} kB · max store ${maxS.toFixed(0)} kB · total ${total[0]} files, ${(total[1] / 1048576).toFixed(1)} MB · sampled ${checked} product files`);
for (const w of warnings.slice(0, 40)) console.log('warn:', w);
if (warnings.length > 40) console.log(`… ${warnings.length - 40} more warnings`);
for (const p of problems.slice(0, 40)) console.log('FAIL:', p);
if (problems.length > 40) console.log(`… ${problems.length - 40} more failures`);
process.exit(problems.length ? 1 : 0);
