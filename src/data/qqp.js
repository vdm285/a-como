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

export async function loadCatalog() {
  const [products, groups] = await Promise.all([getJson('qqp/products.json'), getJson('qqp/groups.json')]);
  return { products, groups };
}

let indexPromise = null;
export function loadIndex() {
  if (!indexPromise) indexPromise = getJson('qqp/index.json').catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

const products = new Map();
const weeks = new Map();
export function loadProduct(id) {
  if (!products.has(id)) products.set(id, getJson(`qqp/products/${id}.json`).catch((e) => { products.delete(id); throw e; }));
  return products.get(id);
}
export function loadProductWeeks(id) {
  if (!weeks.has(id)) weeks.set(id, getJson(`qqp/products/${id}.weeks.json`).catch((e) => { weeks.delete(id); throw e; }));
  return weeks.get(id);
}
export function peekProduct(id) { return products.get(id); }
