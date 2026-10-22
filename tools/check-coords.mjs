// Stores whose coordinates disagree with their own record: points outside the municipio the store
// names (with the distance to that municipio's border) and points shared by stores of different
// municipios. Run after a pipeline build: node tools/check-coords.mjs (or npm run coords).
// It only reports; curation goes through data/overrides/qqp.json (unplaceStores, fixCoords) with a note.
import fs from 'node:fs';
import { geoContains } from 'd3-geo';

const geo = JSON.parse(fs.readFileSync('public/data/geo/cdmx.json', 'utf8'));
const stores = JSON.parse(fs.readFileSync('public/data/qqp/stores.json', 'utf8'));
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const feats = [...geo.alcaldias.features, ...geo.zmvm.features];
const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
// metres in a local equirectangular frame (good to a few metres at this latitude and scale)
const R = 6371000, k = Math.cos((19.4 * Math.PI) / 180);
const xy = (c) => [((c[0] * Math.PI) / 180) * R * k, ((c[1] * Math.PI) / 180) * R];
function toBorder(p, feature) {
  let best = Infinity;
  for (const r of rings(feature.geometry)) for (let i = 1; i < r.length; i++) {
    const a = xy(r[i - 1]), b = xy(r[i]), vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy));
  }
  return best;
}

const placed = stores.filter((s) => s.lat != null);
console.log(`${stores.length} stores, ${placed.length} with a point, ${stores.filter((s) => s.unplaced).length} unplaced by curation`);
console.log('\nOutside their own municipio (metres to its border):');
for (const s of placed) {
  const own = feats.find((f) => fold(f.properties.name) === fold(s.municipio));
  if (!own) { console.log(`     ? ${s.id} ${s.name} | municipio "${s.municipio}" not in the geometry`); continue; }
  if (geoContains(own, [s.lon, s.lat])) continue;
  console.log(`${String(Math.round(toBorder(xy([s.lon, s.lat]), own))).padStart(6)} ${s.id} ${s.name} | ${s.municipio}`);
}
console.log('\nOne point, stores of different municipios:');
const byKey = new Map();
for (const s of placed) { const key = `${s.lat},${s.lon}`; if (!byKey.has(key)) byKey.set(key, []); byKey.get(key).push(s); }
for (const list of byKey.values()) if (list.length > 1 && new Set(list.map((s) => s.municipio)).size > 1) console.log('  ' + list.map((s) => `${s.id} [${s.municipio}]`).join(' | '));
