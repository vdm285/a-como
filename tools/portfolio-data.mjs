// Real data for the showpiece portfolio (docs/portfolio/*.html): writes docs/portfolio/demo-data.js
// (window.DEMO = {...}) from the pipeline's outputs and the committed geometry. Every number in
// the demos comes from here; the stories are computed, never written by hand.
// Run after the pipeline: node tools/portfolio-data.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const Q = 'public/data/qqp';
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const meta = read(`${Q}/meta.json`);
// only stores with a position are drawn: a store whose PROFECO point is another store's is unplaced
// by curation (unplaceStores) and has no coordinates; the demos are over the stores they can draw
const allStores = read(`${Q}/stores.json`);
const stores = allStores.filter((s) => s.lat != null && s.lon != null);
if (stores.length < allStores.length) console.log(`${allStores.length - stores.length} stores without a position left out of the demos`);
const products = read(`${Q}/products.json`).map((p) => (p.id ? p : { id: p.i, group: p.g, name: p.n, brand: p.b, presentation: p.p, size: p.z, stores: p.s, median: p.md }));
const visits = read(`${Q}/visits.json`);
const index = read(`${Q}/index.json`);
const geo = read('public/data/geo/cdmx.json');
const median = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const round = (x, d = 2) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const kind = (s) => {
  const g = `${s.giro || ''} ${s.chain || ''}`;
  if (/tortiller/i.test(g)) return 'tortilleria';
  if (/central de abasto/i.test(g)) return 'central';
  if (/(^|[\s/·-])mercado/i.test(g) && !/supermercado|autoservicio/i.test(s.giro || '')) return 'mercado';
  if (/farmacia/i.test(g)) return 'farmacia';
  if (/panader|pescader/i.test(g)) return 'tradicional';
  if (/conveniencia|oxxo|7-eleven/i.test(g)) return 'conveniencia';
  return 'super';
};
const sIdx = new Map(stores.map((s, i) => [s.id, i]));
const recentFrom = meta.recent.from, recentTo = meta.recent.to;
const partial = new Set(meta.partialWeeks || []);
const prod = (id) => read(`${Q}/products/${id}.json`);
const weeksOf = (id) => read(`${Q}/products/${id}.weeks.json`);

// --- the stores, compact: [name, chain, kind, lat, lon, giro]
const S = stores.map((s) => [s.name, s.chain, kind(s), round(s.lat, 5), round(s.lon, 5)]);

// --- visits: stores visited per week, and a 0/1 string per store
const vWeeks = visits.weeks;
const vRows = stores.map((s) => (visits.stores[s.id] || []).map((n) => (n > 0 ? '1' : '0')).join(''));
const vCount = vWeeks.map((w, i) => stores.reduce((n, s) => n + ((visits.stores[s.id] || [])[i] > 0 ? 1 : 0), 0));
const vProducts = vWeeks.map((w, i) => stores.reduce((n, s) => n + ((visits.stores[s.id] || [])[i] || 0), 0));

// --- a product for the timeline: the jitomate saladette kilo (the clearest mover)
function productBlock(id) {
  const p = products.find((x) => x.id === id);
  const f = prod(id), w = weeksOf(id);
  const recent = Object.entries(f.latest).filter(([, o]) => o[1] >= recentFrom && o[1] <= recentTo).map(([, o]) => o[0]);
  const ref = median(recent);
  const prices = {};
  for (const [sid, arr] of Object.entries(w.stores)) if (sIdx.has(sid)) prices[sIdx.get(sid)] = arr.map((v) => (v == null ? null : round(v)));
  const latest = {};
  for (const [sid, o] of Object.entries(f.latest)) if (sIdx.has(sid) && o[1] >= recentFrom) latest[sIdx.get(sid)] = [round(o[0]), o[1]];
  return { id, name: p.name, brand: p.brand && p.brand !== 'S/M' ? p.brand : null, presentation: p.presentation, weeks: w.weeks, ref: round(ref), n: recent.length, prices, latest, series: f.series.map((r) => [r[0], round(r[1]), round(r[2]), round(r[3]), r[4]]) };
}
const jitomate = productBlock('jitomate-3532af');
const tortilla = productBlock('tortilla-de-9688d0');

// --- story 1: the tortilla kilo by kind of store (recent window)
const byKind = {};
for (const [i, [price]] of Object.entries(tortilla.latest)) { const k = S[i][2]; (byKind[k] = byKind[k] || []).push(price); }
const tortillaKinds = Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, { median: round(median(v)), n: v.length }]));

// --- story 2: the jitomate since its peak, on matched stores only (sample mix cannot fake it)
const jw = jitomate.weeks;
const weekMed = jw.map((w, i) => median(Object.values(jitomate.prices).map((a) => a[i])));
let peak = 0; weekMed.forEach((m, i) => { if (m != null && m > (weekMed[peak] ?? -1)) peak = i; });
let last = jw.length - 1; while (last > 0 && partial.has(jw[last])) last--;
const ratios = [];
for (const a of Object.values(jitomate.prices)) if (a[peak] != null && a[last] != null) ratios.push(a[last] / a[peak]);
const jitoStory = { peakWeek: jw[peak], lastWeek: jw[last], peakMedian: round(weekMed[peak]), lastMedian: round(weekMed[last]), matched: ratios.length, medianRatio: round(median(ratios), 3) };

// --- story 3: the cheapest store by basket index in the last full week
let li = index.weeks.length - 1; while (li > 0 && partial.has(index.weeks[li])) li--;
// supermarkets only: a pharmacy's or a stall's index compares a different basket
const idxRows = Object.entries(index.stores).map(([sid, arr]) => [sid, arr[li]]).filter(([sid, v]) => v != null && sIdx.has(sid) && S[sIdx.get(sid)][2] === 'super').sort((a, b) => a[1] - b[1]);
const cheapest = idxRows.slice(0, 3).map(([sid, v]) => ({ i: sIdx.get(sid), index: round(v, 3) }));
const dearest = idxRows.slice(-1).map(([sid, v]) => ({ i: sIdx.get(sid), index: round(v, 3) }));
const indexStory = { week: index.weeks[li], stores: idxRows.length, cheapest, dearest, indexByStore: Object.fromEntries(idxRows.map(([sid, v]) => [sIdx.get(sid), round(v, 3)])) };

const retrieved = (meta.source.files || []).map((f) => (f.retrieved || '').slice(0, 10)).sort().pop();
const DEMO = {
  built: new Date().toISOString(),
  credit: `Precios: "Quién es Quién en los Precios", PROFECO, datos.profeco.gob.mx, consultado ${retrieved} (CC BY 4.0). Mapa: INEGI; © colaboradores de OpenStreetMap (ODbL).`,
  recent: meta.recent, latestDate: meta.latestDate, partialWeeks: [...partial],
  geo: { alcaldias: geo.alcaldias, zmvm: geo.zmvm, roads: geo.roads, green: geo.green, water: geo.water },
  stores: S,
  visits: { weeks: vWeeks, count: vCount, products: vProducts, rows: vRows, total: vProducts.reduce((a, b) => a + b, 0), totalWhat: 'precios semanales: uno por tienda, producto y semana' },
  jitomate, tortilla,
  stories: { tortillaKinds, jitomate: jitoStory, index: indexStory },
};
mkdirSync('docs/portfolio', { recursive: true });
const js = `// Generated by tools/portfolio-data.mjs on ${DEMO.built} from the pipeline's outputs. Real data only.\nwindow.DEMO = ${JSON.stringify(DEMO)};\n`;
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || 'docs/portfolio/demo-data.js';
writeFileSync(OUT, js);
console.log(`${OUT} ${(js.length / 1024).toFixed(0)} kB`);
console.log('tortilla by kind', JSON.stringify(tortillaKinds));
console.log('jitomate story', JSON.stringify(jitoStory));
console.log('index story', JSON.stringify({ week: indexStory.week, stores: indexStory.stores, cheapest: cheapest.map((c) => [S[c.i][0], c.index]), dearest: dearest.map((c) => [S[c.i][0], c.index]) }));
console.log('visits total', DEMO.visits.total, 'weeks', vWeeks.length);
