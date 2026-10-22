// Loads the pipeline's outputs (public/data/qqp/, built by tools/build-qqp.mjs) and the
// committed geometry (public/data/geo/). Product files are fetched on demand and cached.
// Shapes are documented in docs/PIPELINES.md.

const BASE = `${import.meta.env.BASE_URL}data/`;

async function getJson(path, { optional = false } = {}) {
  const res = await fetch(BASE + path, { cache: 'default' });
  // A dev server answers a missing file with the HTML shell and 200; check the type too.
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !/json/.test(type)) {
    if (optional) return null;
    throw new Error(`${path}: ${res.ok ? 'not JSON' : 'HTTP ' + res.status}`);
  }
  return res.json();
}

export async function loadStage() {
  const [geo, meta, stores] = await Promise.all([
    getJson('geo/cdmx.json'),
    getJson('qqp/meta.json'),
    getJson('qqp/stores.json'),
  ]);
  return { geo, meta, stores };
}

// products.json carries short keys to stay under its size cap; expand them once here.
// "S/M" is PROFECO's code for "sin marca" (no brand).
const noBrand = (b) => (b && !/^s\/m$/i.test(b.trim()) ? b : null);
export function expandProduct(p) {
  if (p.id) { p.brand = noBrand(p.brand); return p; }
  return { id: p.i, group: p.g, name: p.n, brand: noBrand(p.b), presentation: p.p, category: p.c, catalog: p.k, size: p.z || null, stores: p.s, storesAll: p.sa ?? p.s, min: p.lo, median: p.md, max: p.hi, asOf: p.as || null, last: p.la || null, pacic: p.pacic ? 1 : 0 };
}

export async function loadCatalog() {
  const [products, groups] = await Promise.all([getJson('qqp/products.json'), getJson('qqp/groups.json')]);
  return { products: products.map(expandProduct), groups };
}

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = getJson('qqp/index.json').catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

// visits.json: products recorded per store per week (the survey's rhythm). Optional: an older
// build without it simply has no rhythm curve.
let visitsPromise = null;
export function loadVisits() {
  if (!visitsPromise) visitsPromise = getJson('qqp/visits.json', { optional: true }).catch(() => null);
  return visitsPromise;
}

// Per-product files are cached in memory with a small LRU (a long session of hopping used to grow
// the heap without bound); a hit moves the entry to the end.
const LRU_MAX = 120;
const products = new Map();
const weeks = new Map();
function cached(map, key, load) {
  if (map.has(key)) { const v = map.get(key); map.delete(key); map.set(key, v); return v; }
  const p = load().catch((e) => { map.delete(key); throw e; });
  map.set(key, p);
  while (map.size > LRU_MAX) map.delete(map.keys().next().value);
  return p;
}
export function loadProduct(id) { return cached(products, id, () => getJson(`qqp/products/${id}.json`)); }
export function loadProductWeeks(id) { return cached(weeks, id, () => getJson(`qqp/products/${id}.weeks.json`)); }
export function peekProduct(id) { return products.get(id); }
