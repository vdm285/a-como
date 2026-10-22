#!/usr/bin/env node
// tools/build-geo.mjs — builds the base map of the app: public/data/geo/cdmx.json
//
// Why: the map is drawn from one committed geometry file (zero runtime cost, no tile
// servers, no keys). This script downloads open data (INEGI + OpenStreetMap), simplifies
// it and writes a compact file under 300 KB plus a human-checkable preview SVG.
// Run by hand, not in CI:   node tools/build-geo.mjs [--refresh] [--offline]
//   --refresh  ignore the download cache (data/cache/geo/) and fetch again
//   --offline  never touch the network; fail if something is not cached
// No npm packages: Node built-ins only. Everything downloaded stays under data/cache/geo/.
// Licences and sources: docs/research/geo-cdmx-2026-10.md

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- config
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'data', 'cache', 'geo');
const OUT = join(ROOT, 'public', 'data', 'geo', 'cdmx.json');
const PREVIEW = join(CACHE, 'preview.svg');
const ARGS = new Set(process.argv.slice(2));
const REFRESH = ARGS.has('--refresh');
const OFFLINE = ARGS.has('--offline');

// Identify ourselves to the servers (Overpass asks for a unique User-Agent).
const UA = 'a-como-geo-build/0.1 (+https://github.com/vdm285/a-como; one-off base-map build)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const OVERPASS_PAUSE_MS = 6000; // pause between live Overpass queries (be nice to the shared server)
// INEGI "Servicio Web del Catálogo Único de Claves Geoestadísticas" (keyless, GeoJSON).
// /v2/geo/mgem/<state> = all municipalities of a state. 09 = Ciudad de México, 15 = Estado de México.
const INEGI_MGEM = 'https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/';

// Byte budgets per layer (the whole file must stay under 300 KB).
const BUDGET = { alcaldias: 58_000, zmvm: 62_000, roads: 100_000, green: 42_000, water: 12_000, airport: 3_000, total: 295_000 };
const BBOX_PAD_DEG = 0.015; // padding around alcaldías + listed ZMVM municipalities
const BBOX_OVERRIDE = null; // e.g. [-99.45, 19.05, -98.75, 19.80] to hand-tune the frame

// Estado de México municipalities drawn as the fainter second layer (names as INEGI writes them).
const ZMVM_NAMES = [
  'Naucalpan de Juárez', 'Tlalnepantla de Baz', 'Huixquilucan', 'Atizapán de Zaragoza', 'Cuautitlán Izcalli',
  'Tultitlán', 'Coacalco de Berriozábal', 'Ecatepec de Morelos', 'Nezahualcóyotl', 'Chimalhuacán', 'La Paz',
  'Ixtapaluca', 'Chalco', 'Valle de Chalco Solidaridad', 'Texcoco', 'Tecámac', 'Nicolás Romero', 'Cuautitlán',
  'Chicoloapan',
];

// Roads: ordered rules, first match wins. `cdmx: true` keeps only ways whose sampled vertices fall
// inside Ciudad de México (same-named streets exist in every town of the metro area).
// `shadow` = metres: a candidate way is dropped when most of it runs this close to an already
// accepted way of the same road (that removes frontage roads, second decks and the opposite
// carriageway, which OSM maps as separate ways with the same name/ref).
// `maxGap` = metres: lines farther than this from the road's longest line are dropped (a street
// of the same name in another town). Highways have no maxGap: libre and cuota run apart.
const HW = /^(motorway|trunk|primary|secondary)$/;
const CITY_GAP = 3000;
const ROAD_RULES = [
  { key: 'periferico', name: 'Anillo Periférico', class: 'ring', shadow: 140, maxGap: CITY_GAP,
    test: (t) => (/PERIF/.test(t.ref || '') && !/N2/.test(t.ref)) || /^(Anillo Periférico|Periférico Boulevard|Calle Periférico)/.test(t.name || '') || /^Boulevard (Adolfo López Mateos|Manuel Ávila Camacho)$/.test(t.name || ''),
    exclude: (t) => /Autopista Urbana|Viaducto Bicentenario|Segundo Piso/.test(t.name || '') },
  { key: 'circuito-interior', name: 'Circuito Interior', class: 'ring', shadow: 120, maxGap: CITY_GAP,
    test: (t) => /CTO INT/.test(t.ref || '') || /^Circuito Interior/.test(t.name || '') },
  { key: 'viaducto', name: 'Viaducto Miguel Alemán', class: 'expressway', shadow: 80, maxGap: CITY_GAP,
    test: (t) => /VDCTO A/.test(t.ref || '') || /^Viaducto (Presidente )?Miguel Alemán$|^Viaducto Río de la Piedad$/.test(t.name || '') },
  { key: 'insurgentes', name: 'Avenida de los Insurgentes', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Avenida Insurgentes( Sur| Norte| Centro)?$/.test(t.name || '') },
  { key: 'reforma', name: 'Paseo de la Reforma', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^(Avenida )?Paseo de la Reforma( Norte)?$|^Prolongación Paseo de la Reforma$/.test(t.name || '') },
  { key: 'tlalpan', name: 'Calzada de Tlalpan', class: 'avenue', shadow: 130, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Calzada de Tlalpan$/.test(t.name || '') },
  { key: 'zaragoza', name: 'Calzada Ignacio Zaragoza', class: 'avenue', shadow: 130, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Calzada (General )?Ignacio Zaragoza$/.test(t.name || '') },
  { key: 'constituyentes', name: 'Avenida Constituyentes', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Avenida Constituyentes$/.test(t.name || '') },
  { key: 'eje-central', name: 'Eje Central Lázaro Cárdenas', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /EJE CENTRAL/.test(t.ref || '') },
  { key: 'universidad', name: 'Avenida Universidad', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Avenida Universidad$/.test(t.name || '') },
  { key: 'churubusco', name: 'Río Churubusco', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /Río Churubusco/.test(t.name || '') && !/CTO INT/.test(t.ref || '') },
  { key: 'ermita', name: 'Ermita Iztapalapa', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /Ermita Iztapalapa/.test(t.name || '') },
  { key: 'chapultepec', name: 'Avenida Chapultepec', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Avenida Chapultepec$/.test(t.name || '') },
  { key: 'patriotismo-revolucion', name: 'Patriotismo / Revolución', class: 'avenue', shadow: 80, cdmx: true, maxGap: CITY_GAP,
    test: (t) => /^Avenida (Diagonal )?Patriotismo$|^Avenida Revolución$/.test(t.name || '') && !/CTO INT/.test(t.ref || '') },
  { key: 'mex-toluca', name: 'Carretera México–Toluca', class: 'highway', shadow: 250,
    test: (t) => /M[eé]xico ?-? ?Toluca/.test(t.name || '') && !/Lateral/.test(t.name || '') },
  { key: 'mex-queretaro', name: 'Carretera México–Querétaro', class: 'highway', shadow: 250,
    test: (t) => /M[eé]xico ?-? ?Quer[eé]taro/.test(t.name || '') && !/Lateral/.test(t.name || '') },
  { key: 'mex-pachuca', name: 'Carretera México–Pachuca', class: 'highway', shadow: 250,
    test: (t) => (/M[eé]xico ?-? ?Pachuca/.test(t.name || '') || /^Vía Morelos$/.test(t.name || '')) && !/Lateral/.test(t.name || '') },
  { key: 'mex-puebla', name: 'Carretera México–Puebla', class: 'highway', shadow: 250,
    test: (t) => (/M[eé]xico ?-? ?Puebla/.test(t.name || '') || /^MEX 150D$/.test(t.ref || '')) && !/Lateral/.test(t.name || '') },
  { key: 'mex-cuernavaca', name: 'Carretera México–Cuernavaca', class: 'highway', shadow: 250,
    test: (t) => /M[eé]xico ?-? ?Cuernavaca/.test(t.name || '') && !/Lateral/.test(t.name || '') },
];
// One Overpass regex that pre-filters the roads query to the names/refs the rules look at.
const ROAD_NAME_RE = 'Periférico|^Boulevard Adolfo López Mateos$|^Boulevard Manuel Ávila Camacho$|^Circuito Interior|^Viaducto (Presidente )?Miguel Alemán$|^Viaducto Río de la Piedad$|^Avenida Insurgentes|Paseo de la Reforma|^Calzada de Tlalpan$|Ignacio Zaragoza|^Avenida Constituyentes$|^Avenida Universidad$|Río Churubusco|Ermita Iztapalapa|^Avenida Chapultepec$|^Avenida (Diagonal )?Patriotismo$|^Avenida Revolución$|M[eé]xico ?-? ?(Toluca|Quer[eé]taro|Pachuca|Puebla|Cuernavaca)|^Vía Morelos$';
const ROAD_REF_RE = 'PERIF|CTO INT|VDCTO A|EJE CENTRAL|^MEX 150D$';

// Areas from OSM, by object id (r = relation, w = way). Found by hand with tags-only
// reconnaissance queries (see the research doc). `pick: 'largest'` keeps only the biggest ring
// when ids duplicate each other (e.g. a relation and a way both mapping the airport).
const CHAPULTEPEC_BOX = '19.400,-99.235,19.432,-99.170'; // OSM has no single named polygon for the park
const AREA_SPECS = {
  green: [
    { key: 'chapultepec', name: 'Bosque de Chapultepec', class: 'park', box: CHAPULTEPEC_BOX, minArea: 0.03 },
    { key: 'desierto-de-los-leones', name: 'Desierto de los Leones', class: 'forest', ids: ['r930915'] },
    { key: 'ajusco', name: 'Parque Nacional El Ajusco', class: 'forest', ids: ['r17528776'] },
    { key: 'ajusco-san-miguel', name: 'Reserva Ecológica Comunitaria San Miguel Ajusco', class: 'forest', ids: ['r17528809'] },
    { key: 'ajusco-topilejo', name: 'Reserva Ecológica Comunitaria San Miguel Topilejo', class: 'forest', ids: ['r17541959'] },
    { key: 'ajusco-totolapan', name: 'Reserva Ecológica Comunitaria San Nicolás Totolapan', class: 'forest', ids: ['r17528703'] },
    { key: 'ajusco-san-bernabe', name: 'Reserva Ecológica Comunitaria San Bernabé Ocotepec', class: 'forest', ids: ['r17509281'] },
    { key: 'parque-ecologico-cdmx', name: 'Parque Ecológico de la Ciudad de México', class: 'forest', ids: ['r17528561'] },
    { key: 'milpa-alta', name: 'Área Comunitaria de Conservación Ecológica Milpa Alta', class: 'forest', ids: ['r17541991'] },
    { key: 'bosque-de-tlalpan', name: 'Bosque de Tlalpan', class: 'park', ids: ['r8212057'] },
    { key: 'viveros-de-coyoacan', name: 'Viveros de Coyoacán', class: 'park', ids: ['w26966883'] },
    { key: 'cerro-de-la-estrella', name: 'Cerro de la Estrella', class: 'park', ids: ['r17542037', 'w27284561'], pick: 'largest' },
    { key: 'sierra-de-guadalupe', name: 'Sierra de Guadalupe', class: 'forest', ids: ['r17508842', 'w1258850012', 'w1258025520'] },
    { key: 'sierra-de-santa-catarina', name: 'Sierra de Santa Catarina', class: 'forest', ids: ['r17542258'] },
    { key: 'xochimilco-ejidos', name: 'Ejidos de Xochimilco y San Gregorio Atlapulco', class: 'wetland', ids: ['r17495765'] },
    { key: 'xochimilco-parque', name: 'Parque Ecológico de Xochimilco', class: 'park', ids: ['r5377444'] },
    { key: 'lago-de-texcoco', name: 'Parque Ecológico Lago de Texcoco', class: 'wetland', ids: ['w1411608827'] },
    { key: 'aragon', name: 'Bosque de San Juan de Aragón', class: 'park', ids: ['r20008211'] },
    { key: 'tepeyac', name: 'Parque Nacional El Tepeyac', class: 'forest', ids: ['r17509182'] },
    { key: 'los-remedios', name: 'Parque Nacional Los Remedios', class: 'forest', ids: ['w1425665063'] },
    { key: 'lomas-de-padierna', name: 'Lomas de Padierna', class: 'forest', ids: ['r17509251'] },
    { key: 'pedregal', name: 'Parque Nacional Bosque Pedregal', class: 'park', ids: ['r17528106'] },
  ],
  water: [
    { key: 'lago-de-chapultepec', name: 'Lago de Chapultepec', class: 'lake', ids: ['r14453733', 'r2070280', 'r2070356'] },
    { key: 'canales-de-xochimilco', name: 'Canales de Xochimilco', class: 'canal', ids: ['r5376014'] },
    { key: 'laguna-san-gregorio', name: 'Laguna de San Gregorio Atlapulco', class: 'lake', ids: ['w60844806'] },
    { key: 'humedales-de-tlahuac', name: 'Humedales de Tláhuac', class: 'wetland', ids: ['r11996995'] },
    { key: 'lago-de-los-reyes', name: 'Lago de los Reyes Aztecas', class: 'lake', ids: ['w52901841'] },
    { key: 'presa-madin', name: 'Presa Madín', class: 'reservoir', ids: ['r20239423'] },
    { key: 'presa-guadalupe', name: 'Presa Lago de Guadalupe', class: 'reservoir', ids: ['r16073668'] },
    { key: 'nabor-carrillo', name: 'Laguna Nabor Carrillo', class: 'lake', ids: ['w4780696'] },
    { key: 'el-caracol', name: 'El Caracol', class: 'basin', ids: ['r14484155'] },
    { key: 'laguna-de-zumpango', name: 'Laguna de Zumpango', class: 'lake', ids: ['r18057404'] },
    { key: 'lago-aragon', name: 'Lago del Bosque de San Juan de Aragón', class: 'lake', ids: ['r549573'] },
    { key: 'lago-churubusco', name: 'Lago de Regulación Churubusco', class: 'basin', ids: ['w52503893'] },
  ],
  airport: [
    { key: 'aicm', name: 'Aeropuerto Internacional de la Ciudad de México', class: 'airport', ids: ['r11952425', 'w1429419990'], pick: 'largest' },
    { key: 'aifa', name: 'Aeropuerto Internacional Felipe Ángeles', class: 'airport', ids: ['w136142100'] },
  ],
};

// ---------------------------------------------------------------- small geometry kit
// Local flat metres around CDMX (good to <0.5 % over the frame); enough for tolerances and distances.
const KX = 111320 * Math.cos((19.4 * Math.PI) / 180);
const KY = 110574;
const distM = (a, b) => Math.hypot((a[0] - b[0]) * KX, (a[1] - b[1]) * KY);
function segDistM(p, a, b) {
  const ax = a[0] * KX, ay = a[1] * KY, bx = b[0] * KX, by = b[1] * KY, px = p[0] * KX, py = p[1] * KY;
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
const lengthM = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += distM(pts[i - 1], pts[i]); return s; };

// Douglas–Peucker, iterative (no recursion limits), tolerance in metres. Keeps both ends.
function simplifyDP(pts, tol) {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    if (e - s < 2) continue;
    let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDistM(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

// Signed area of an open ring in km² (positive = anticlockwise in the lon/lat plane).
function ringAreaKm2(ring) {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    s += a[0] * KX * b[1] * KY - b[0] * KX * a[1] * KY;
  }
  return s / 2 / 1e6;
}
function centroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Sutherland–Hodgman clip of an open ring against the frame [w, s, e, n].
function clipRing(ring, [w, s, e, n]) {
  const edges = [
    [(p) => p[0] >= w, (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= e, (a, b) => [e, a[1] + ((b[1] - a[1]) * (e - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= s, (a, b) => [a[0] + ((b[0] - a[0]) * (s - a[1])) / (b[1] - a[1]), s]],
    [(p) => p[1] <= n, (a, b) => [a[0] + ((b[0] - a[0]) * (n - a[1])) / (b[1] - a[1]), n]],
  ];
  let out = ring;
  for (const [inside, cross] of edges) {
    const inp = out;
    out = [];
    if (!inp.length) break;
    let prev = inp[inp.length - 1];
    for (const cur of inp) {
      if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cross(prev, cur));
      prev = cur;
    }
  }
  return out.length >= 3 ? out : [];
}
// Liang–Barsky: part of segment p→q inside the frame, or null.
function clipSeg(p, q, [w, s, e, n]) {
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - w], [dx, e - p[0]], [-dy, p[1] - s], [dy, n - p[1]]]) {
    if (pp === 0) { if (qq < 0) return null; continue; }
    const r = qq / pp;
    if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [[p[0] + t0 * dx, p[1] + t0 * dy], [p[0] + t1 * dx, p[1] + t1 * dy]];
}
function clipLine(pts, bbox) {
  const parts = [];
  let cur = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = clipSeg(pts[i], pts[i + 1], bbox);
    if (!seg) { if (cur.length > 1) parts.push(cur); cur = []; continue; }
    if (!cur.length || !same(cur[cur.length - 1], seg[0])) { if (cur.length > 1) parts.push(cur); cur = [seg[0]]; }
    cur.push(seg[1]);
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;
function roundPts(pts) {
  const out = [];
  for (const p of pts) {
    const q = [r5(p[0]), r5(p[1])];
    const l = out[out.length - 1];
    if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q);
  }
  return out;
}
// d3-geo wants exterior rings clockwise (opposite to RFC 7946) or it fills the rest of the globe.
function orient(ring, clockwise) {
  const a = ringAreaKm2(ring);
  return (a < 0) === clockwise ? ring : ring.slice().reverse();
}
function closeRing(ring) { return ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ? ring.concat([ring[0]]) : ring; }

// Grid of accepted road segments; answers "is this point within R metres of any of them?".
class SegIndex {
  constructor(cell = 150) { this.cell = cell; this.map = new Map(); }
  add(a, b, line) {
    const seg = [a, b];
    seg.line = line;
    const c = this.cell;
    const x0 = Math.floor(Math.min(a[0], b[0]) * KX / c), x1 = Math.floor(Math.max(a[0], b[0]) * KX / c);
    const y0 = Math.floor(Math.min(a[1], b[1]) * KY / c), y1 = Math.floor(Math.max(a[1], b[1]) * KY / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const k = x + ',' + y;
      let arr = this.map.get(k);
      if (!arr) this.map.set(k, (arr = []));
      arr.push(seg);
    }
  }
  near(p, R) {
    const c = this.cell;
    const x0 = Math.floor((p[0] * KX - R) / c), x1 = Math.floor((p[0] * KX + R) / c);
    const y0 = Math.floor((p[1] * KY - R) / c), y1 = Math.floor((p[1] * KY + R) / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const arr = this.map.get(x + ',' + y);
      if (!arr) continue;
      for (const [a, b] of arr) if (segDistM(p, a, b) <= R) return true;
    }
    return false;
  }
  // Same, but ignores segments tagged with `line` (used for the self-overlap metric).
  nearOther(p, R, line) {
    const c = this.cell;
    const x0 = Math.floor((p[0] * KX - R) / c), x1 = Math.floor((p[0] * KX + R) / c);
    const y0 = Math.floor((p[1] * KY - R) / c), y1 = Math.floor((p[1] * KY + R) / c);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const arr = this.map.get(x + ',' + y);
      if (!arr) continue;
      for (const seg of arr) if (seg.line !== line && segDistM(p, seg[0], seg[1]) <= R) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- download with cache
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(CACHE, { recursive: true });
let lastOverpassAt = 0;

async function fetchCached(name, url, { body, kind } = {}) {
  const file = join(CACHE, name);
  const metaFile = file + '.meta.json';
  if (!REFRESH && existsSync(file) && existsSync(metaFile)) {
    const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
    if (meta.hash === hashOf(url + (body || ''))) {
      log(`cache hit  ${name} (${meta.bytes} bytes, retrieved ${meta.retrieved})`);
      return { text: readFileSync(file, 'utf8'), meta };
    }
  }
  if (OFFLINE) throw new Error(`--offline and not cached: ${name}`);
  if (kind === 'overpass') {
    const wait = lastOverpassAt + OVERPASS_PAUSE_MS - Date.now();
    if (wait > 0) { log(`pausing ${wait} ms before the next Overpass query`); await sleep(wait); }
  }
  let text;
  for (let attempt = 1; ; attempt++) {
    log(`fetching   ${name} <- ${url.slice(0, 80)}${body ? ' (POST, ' + body.length + ' chars)' : ''}`);
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'User-Agent': UA, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      body,
    });
    if (kind === 'overpass') lastOverpassAt = Date.now();
    text = await res.text();
    if (res.ok) break;
    // Overpass etiquette: after 429/406 wait 30 s before retrying; 504 = server busy.
    if ([429, 406, 503, 504].includes(res.status) && attempt < 4) { log(`HTTP ${res.status}, waiting 35 s`); await sleep(35000); continue; }
    throw new Error(`HTTP ${res.status} for ${name}: ${text.slice(0, 200)}`);
  }
  if (kind === 'overpass' && text.includes('"remark"') && /runtime error/.test(text)) throw new Error(`Overpass runtime error: ${text.slice(0, 300)}`);
  const meta = { url, retrieved: new Date().toISOString(), bytes: Buffer.byteLength(text), hash: hashOf(url + (body || '')), query: body ? decodeURIComponent(body.replace(/^data=/, '')) : undefined };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  writeFileSync(metaFile, JSON.stringify(meta, null, 1));
  return { text, meta };
}
const hashOf = (s) => createHash('sha1').update(s).digest('hex');
const overpass = (name, query) => fetchCached(name, OVERPASS, { body: 'data=' + encodeURIComponent(query), kind: 'overpass' });
function log(...a) { console.log(...a); }

// ---------------------------------------------------------------- 1. INEGI polygons
// Parses an INEGI FeatureCollection into {props, polys:[ [outer, hole...] ]} with open rings.
function parseInegi(fc) {
  return fc.features.map((f) => {
    const g = f.geometry;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((poly) => poly.map((ring) => {
      const r = ring.slice();
      if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
      return r;
    }));
    return { props: { name: f.properties.nomgeo, key: f.properties.cvegeo }, polys };
  });
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function loadInegi() {
  const sources = [];
  const a = await fetchCached('inegi/mgem-09.json', INEGI_MGEM + '09');
  const b = await fetchCached('inegi/mgem-15.json', INEGI_MGEM + '15');
  const fcA = JSON.parse(a.text), fcB = JSON.parse(b.text);
  const alcaldias = parseInegi(fcA).sort((x, y) => x.props.key.localeCompare(y.props.key));
  if (alcaldias.length !== 16) throw new Error(`expected 16 alcaldías, got ${alcaldias.length}`);
  const edomex = parseInegi(fcB);
  const wanted = new Map(ZMVM_NAMES.map((n) => [norm(n), n]));
  const listed = edomex.filter((m) => wanted.has(norm(m.props.name)));
  const missing = ZMVM_NAMES.filter((n) => !listed.some((m) => norm(m.props.name) === norm(n)));
  if (missing.length) throw new Error(`ZMVM municipalities not found in INEGI 15: ${missing.join(', ')}`);
  // Also take any other Edomex municipality that touches CDMX (shares a boundary vertex).
  const cdmxVerts = new Set();
  for (const f of alcaldias) for (const poly of f.polys) for (const p of poly[0]) cdmxVerts.add(p[0] + ',' + p[1]);
  const touching = edomex.filter((m) => !listed.includes(m) && m.polys.some((poly) => poly[0].some((p) => cdmxVerts.has(p[0] + ',' + p[1]))));
  const zmvm = listed.concat(touching).sort((x, y) => x.props.key.localeCompare(y.props.key));
  const vectorSource = fcA.metadatos?.Fuente_informacion_vectorial || 'INEGI. Marco Geoestadístico';
  for (const [layer, m, ent] of [['alcaldias', a.meta, '09'], ['zmvm', b.meta, '15']]) {
    sources.push({
      layer, name: `INEGI, ${vectorSource.replace(/^INEGI\.\s*/, '')} (Servicio Web del Catálogo Único de Claves Geoestadísticas, municipios de la entidad ${ent})`,
      url: m.url, license: 'Términos de Libre Uso de la Información del INEGI (https://www.inegi.org.mx/inegi/terminos.html)',
      attribution: `Fuente: ${vectorSource.replace(/^INEGI\.\s*/, 'INEGI, ')}`, retrieved: m.retrieved.slice(0, 10),
    });
  }
  log(`INEGI: 16 alcaldías; ZMVM ${listed.length} listed + ${touching.length} touching (${touching.map((t) => t.props.name).join(', ') || 'none'})`);
  const zmvmVerts = new Set();
  for (const m of zmvm) for (const poly of m.polys) for (const p of poly[0]) zmvmVerts.add(p[0] + ',' + p[1]);
  let shared = 0;
  for (const k of cdmxVerts) if (zmvmVerts.has(k)) shared++;
  log(`INEGI: ${shared} boundary vertices shared exactly between CDMX and Edomex polygons (shared-arc simplification ${shared ? 'will keep the state line consistent' : 'cannot pair the state line'})`);
  return { alcaldias, zmvm, listed, sources };
}

// ---------------------------------------------------------------- 2. shared-arc simplification
// Polygons that share a border (neighbouring alcaldías, the CDMX/Edomex line) must be simplified
// identically or the drawing shows slivers and gaps. So: split every ring into arcs at the
// vertices where "which rings contain this vertex" changes, simplify each distinct arc once
// (with the strictest tolerance of the layers using it), and rebuild the rings from the arcs.
function simplifyShared(layers) {
  const rings = [];
  layers.forEach((L, li) => L.features.forEach((f, fi) => f.polys.forEach((poly, pi) => poly.forEach((ring, ri) => rings.push({ li, fi, pi, ri, pts: ring })))));
  const vkey = (p) => p[0] + ',' + p[1];
  const vert = new Map();
  rings.forEach((r, idx) => r.pts.forEach((p) => { const k = vkey(p); let s = vert.get(k); if (!s) vert.set(k, (s = new Set())); s.add(idx); }));
  const setKey = (s) => [...s].sort((a, b) => a - b).join('/');
  const arcs = new Map();
  const ringArcs = rings.map(() => []);
  rings.forEach((r, idx) => {
    const n = r.pts.length, tol = layers[r.li].tol;
    const sk = r.pts.map((p) => setKey(vert.get(vkey(p))));
    const js = [];
    for (let i = 0; i < n; i++) if (vert.get(vkey(r.pts[i])).size >= 3 || sk[i] !== sk[(i - 1 + n) % n] || sk[i] !== sk[(i + 1) % n]) js.push(i);
    if (!js.length) { const id = 'ring' + idx; arcs.set(id, { pts: r.pts.concat([r.pts[0]]), tol }); ringArcs[idx].push({ id, rev: false }); return; }
    for (let a = 0; a < js.length; a++) {
      const s = js[a], e = js[(a + 1) % js.length];
      const pts = [r.pts[s]];
      for (let i = s; i !== e;) { i = (i + 1) % n; pts.push(r.pts[i]); }
      const fk = vkey(pts[0]), lk = vkey(pts[pts.length - 1]);
      const rev = fk > lk || (fk === lk && pts.length > 2 && vkey(pts[1]) > vkey(pts[pts.length - 2]));
      const seq = rev ? pts.slice().reverse() : pts;
      const id = hashOf(seq.map(vkey).join(';'));
      const ex = arcs.get(id);
      if (ex) ex.tol = Math.min(ex.tol, tol); else arcs.set(id, { pts: seq, tol });
      ringArcs[idx].push({ id, rev });
    }
  });
  for (const a of arcs.values()) a.simp = simplifyDP(a.pts, a.tol);
  const rebuilt = rings.map((r, idx) => {
    const out = [];
    for (const { id, rev } of ringArcs[idx]) {
      const s = rev ? arcs.get(id).simp.slice().reverse() : arcs.get(id).simp;
      for (let i = out.length ? 1 : 0; i < s.length; i++) out.push(s[i]);
    }
    if (out.length > 1 && vkey(out[0]) === vkey(out[out.length - 1])) out.pop();
    return { ...r, simp: out };
  });
  // Put the simplified rings back into feature structures.
  return layers.map((L, li) => ({
    ...L,
    features: L.features.map((f, fi) => ({ props: f.props, polys: f.polys.map((poly, pi) => poly.map((_, ri) => rebuilt.find((x) => x.li === li && x.fi === fi && x.pi === pi && x.ri === ri).simp)) })),
    arcs: arcs.size,
  }));
}

// Finishes a polygon feature: clip to frame, drop slivers, orient for d3, round, close rings.
function finishPolygons(features, bbox, minAreaKm2) {
  const out = [];
  for (const f of features) {
    const polys = [];
    for (const poly of f.polys) {
      const rings = poly.map((ring) => roundPts(clipRing(ring, bbox))).filter((r) => r.length >= 3 && Math.abs(ringAreaKm2(r)) >= minAreaKm2);
      if (!rings.length || Math.abs(ringAreaKm2(rings[0])) < minAreaKm2) continue;
      polys.push(rings.map((r, i) => closeRing(orient(r, i === 0))));
    }
    if (!polys.length) continue;
    out.push({ type: 'Feature', properties: f.props, geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } });
  }
  return out;
}

// ---------------------------------------------------------------- 3. roads from OSM
function osmPts(el) { return el.geometry.map((g) => [g.lon, g.lat]); }

async function loadRoads(bbox, cdmxRings) {
  const [w, s, e, n] = bbox;
  const q = `[out:json][timeout:180][bbox:${s},${w},${n},${e}];
(
  way[highway~"^(motorway|trunk|primary|secondary)$"][ref~"${ROAD_REF_RE}"];
  way[highway~"^(motorway|trunk|primary|secondary)$"][name~"${ROAD_NAME_RE}"];
);
out geom;`;
  const { text, meta } = await overpass('overpass/roads.json', q);
  const j = JSON.parse(text);
  const ways = j.elements.filter((el) => el.type === 'way' && el.geometry && HW.test(el.tags?.highway || ''));
  log(`OSM roads: ${ways.length} candidate ways (${(text.length / 1e6).toFixed(1)} MB)`);
  const insideCdmx = (pts) => {
    const samples = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]];
    let hits = 0;
    for (const p of samples) if (cdmxRings.some((r) => pointInRing(p, r))) hits++;
    return hits >= 2;
  };
  const RANK = { motorway: 0, trunk: 1, primary: 2, secondary: 3 };
  const byRule = new Map(ROAD_RULES.map((r) => [r.key, []]));
  for (const el of ways) {
    const t = el.tags;
    const rule = ROAD_RULES.find((r) => r.test(t) && !(r.exclude && r.exclude(t)));
    if (!rule) continue;
    const pts = osmPts(el);
    if (rule.cdmx && !insideCdmx(pts)) continue;
    byRule.get(rule.key).push({ pts, rank: RANK[t.highway], len: lengthM(pts), osmName: t.name });
  }
  return { byRule, meta, query: q };
}

// Joins line pieces whose ends coincide exactly (same OSM node). When several pieces meet,
// the best-ranked (motorway first) and then longest continuation wins, so a chain follows the
// main carriageway rather than wandering into a frontage road.
function chainExact(pieces) {
  const key = (p) => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  const ends = new Map();
  pieces.forEach((pc, i) => { for (const [k, end] of [[key(pc.pts[0]), 's'], [key(pc.pts[pc.pts.length - 1]), 'e']]) { if (!ends.has(k)) ends.set(k, []); ends.get(k).push({ i, end }); } });
  const order = pieces.map((_, i) => i).sort((a, b) => pieces[a].rank - pieces[b].rank || pieces[b].len - pieces[a].len);
  const used = new Uint8Array(pieces.length);
  const chains = [];
  for (const start of order) {
    if (used[start]) continue;
    used[start] = 1;
    let line = pieces[start].pts.slice();
    let rank = pieces[start].rank;
    for (const dir of ['fwd', 'back']) {
      for (;;) {
        const k = key(dir === 'fwd' ? line[line.length - 1] : line[0]);
        const cs = (ends.get(k) || []).filter((x) => !used[x.i]).sort((a, b) => pieces[a.i].rank - pieces[b.i].rank || pieces[b.i].len - pieces[a.i].len);
        if (!cs.length) break;
        const c = cs[0];
        used[c.i] = 1;
        rank = Math.min(rank, pieces[c.i].rank);
        const wv = pieces[c.i].pts;
        if (dir === 'fwd') line = line.concat(c.end === 's' ? wv.slice(1) : wv.slice(0, -1).reverse());
        else line = (c.end === 'e' ? wv.slice(0, -1) : wv.slice(1).reverse()).concat(line);
      }
    }
    chains.push({ pts: line, rank, len: lengthM(line) });
  }
  return chains;
}

// Chaining + shadow filter + simplification for one road; returns arrays of points (one per line).
// Order matters: chain first (each carriageway becomes one long line), then drop the parts of
// later chains that run within `shadow` metres of what is already drawn (opposite carriageway,
// frontage roads, second decks), keeping only unshadowed stretches of at least 400 m.
function buildRoad(cands, rule, bbox, tol) {
  const pieces = cands.flatMap((c) => clipLine(c.pts, bbox).map((pts) => ({ pts, rank: c.rank, len: lengthM(pts) })));
  const chains = chainExact(pieces).sort((a, b) => a.rank - b.rank || b.len - a.len);
  const idx = new SegIndex();
  let kept = [];
  for (const ch of chains) {
    // A chain can run out along one carriageway, U-turn, and come back along the other (that is
    // how OSM connects Periférico's two carriageways). So a chain also shadows itself: its own
    // segments enter a per-chain index once the walk is `lag` metres past them.
    const self = new SegIndex();
    const lag = 2 * rule.shadow;
    const cum = [0];
    for (let i = 1; i < ch.pts.length; i++) cum[i] = cum[i - 1] + distM(ch.pts[i - 1], ch.pts[i]);
    const flags = [];
    for (let i = 0, pend = 0; i < ch.pts.length; i++) {
      while (pend + 1 < i && cum[i] - cum[pend + 1] > lag) { self.add(ch.pts[pend], ch.pts[pend + 1]); pend++; }
      flags.push(idx.near(ch.pts[i], rule.shadow) || self.near(ch.pts[i], rule.shadow));
    }
    // Runs of unshadowed vertices, each extended by one shadowed vertex at both ends so the run
    // reaches the line it continues from. A lone shadowed vertex between unshadowed ones is
    // tolerated. A run made only of shadowed vertices is never kept (it would lie on the main line).
    let run = [], live = false;
    const flush = () => { if (live && run.length >= 2 && lengthM(run) >= 400) kept.push(run); run = []; live = false; };
    for (let i = 0; i < ch.pts.length; i++) {
      const sh = flags[i] && !(i > 0 && i < ch.pts.length - 1 && !flags[i - 1] && !flags[i + 1]);
      if (sh) { if (live) { run.push(ch.pts[i]); flush(); } run = [ch.pts[i]]; live = false; }
      else { run.push(ch.pts[i]); live = true; }
    }
    flush();
    for (const r of kept) if (!r.indexed) { for (let i = 1; i < r.length; i++) idx.add(r[i - 1], r[i]); r.indexed = true; }
  }
  // Bridge small gaps between what is left (one-way pairs switching sides, missing stubs).
  let lines = kept.map((r) => r.slice());
  for (let joined = true; joined;) {
    joined = false;
    outer: for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
      const A = lines[i], B = lines[j];
      const combos = [[A[A.length - 1], B[0], () => A.concat(B)], [A[A.length - 1], B[B.length - 1], () => A.concat(B.slice().reverse())], [A[0], B[0], () => A.slice().reverse().concat(B)], [A[0], B[B.length - 1], () => B.concat(A)]];
      for (const [p, q, merge] of combos) if (distM(p, q) <= 120) { lines[i] = merge(); lines.splice(j, 1); joined = true; break outer; }
    }
  }
  if (process.env.GEO_DEBUG === rule.key) {
    log(`DEBUG ${rule.key}: ${chains.length} chains:`, chains.map((c) => `${(c.len / 1000).toFixed(1)}km/r${c.rank}`).join(' '));
    log(`DEBUG ${rule.key}: kept runs (km):`, kept.map((r) => (lengthM(r) / 1000).toFixed(1)).join(' '), '| after gap-join:', lines.map((l) => (lengthM(l) / 1000).toFixed(1)).join(' '));
  }
  // Fragments under 1 km are noise at map scale (a ramp, a lateral's tail): drop them.
  lines = lines.map((c) => roundPts(simplifyDP(c, tol))).filter((c) => c.length >= 2 && lengthM(c) >= 1000);
  lines.sort((a, b) => lengthM(b) - lengthM(a));
  // City roads: a same-named street in another town is never part of the artery. Keep only
  // lines that come within `maxGap` metres of the longest line (highways are left alone).
  if (lines.length > 1 && rule.maxGap) {
    const main = lines[0];
    const nearMain = (line) => line.some((p) => main.some((q, i) => i > 0 && segDistM(p, main[i - 1], q) <= rule.maxGap));
    lines = lines.filter((l, i) => i === 0 || nearMain(l));
  }
  return { lines, acceptedWays: kept.length, candidates: cands.length, chains: chains.length };
}

// ---------------------------------------------------------------- 4. areas from OSM (green, water, airport)
function assembleRings(wayLists) {
  const k = (p) => p[0].toFixed(7) + ',' + p[1].toFixed(7);
  const pool = wayLists.map((w) => w.slice()).filter((w) => w.length >= 2);
  const rings = [];
  while (pool.length) {
    let cur = pool.shift();
    for (let guard = 0; k(cur[0]) !== k(cur[cur.length - 1]) && guard < 5000; guard++) {
      const endK = k(cur[cur.length - 1]);
      const i = pool.findIndex((wv) => k(wv[0]) === endK || k(wv[wv.length - 1]) === endK);
      if (i < 0) break;
      let wv = pool.splice(i, 1)[0];
      if (k(wv[0]) !== endK) wv = wv.slice().reverse();
      cur = cur.concat(wv.slice(1));
    }
    if (k(cur[0]) === k(cur[cur.length - 1]) && cur.length >= 4) rings.push(cur.slice(0, -1));
  }
  return rings;
}

async function loadAreas() {
  const specs = Object.values(AREA_SPECS).flat();
  const relIds = [], wayIds = [];
  for (const sp of specs) for (const id of sp.ids || []) (id[0] === 'r' ? relIds : wayIds).push(id.slice(1));
  const boxes = specs.filter((sp) => sp.box).map((sp) => `  way[landuse=forest](${sp.box})(if:length()>1500);\n  way[natural=wood](${sp.box})(if:length()>1500);\n  way[leisure~"^(park|garden)$"](${sp.box})(if:length()>1500);`).join('\n');
  const q = `[out:json][timeout:180];
(
  rel(id:${relIds.join(',')});
  way(id:${wayIds.join(',')});
${boxes}
);
out geom;`;
  const { text, meta } = await overpass('overpass/areas.json', q);
  const j = JSON.parse(text);
  const byId = new Map(j.elements.map((el) => [el.type[0] + el.id, el]));
  // Outer rings only: holes in a park are noise at this scale.
  const ringsOf = (el) => el.type === 'way' ? assembleRings([osmPts(el)]) : assembleRings((el.members || []).filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry.map((g) => [g.lon, g.lat])));
  const boxEls = j.elements.filter((el) => el.type === 'way' && el.geometry && !wayIds.includes(String(el.id)) && (el.tags?.landuse === 'forest' || el.tags?.natural === 'wood' || /^(park|garden)$/.test(el.tags?.leisure || '')));
  const result = {};
  for (const [layer, list] of Object.entries(AREA_SPECS)) {
    result[layer] = [];
    for (const sp of list) {
      let rings = [];
      const found = [];
      for (const id of sp.ids || []) { const el = byId.get(id); if (!el) { log(`  missing in OSM result: ${id} (${sp.name})`); continue; } found.push(id); rings.push(...ringsOf(el)); }
      if (sp.box) {
        const box = sp.box.split(',').map(Number); // s,w,n,e
        for (const el of boxEls) { const c = centroid(osmPts(el)); if (c[1] >= box[0] && c[1] <= box[2] && c[0] >= box[1] && c[0] <= box[3]) rings.push(...ringsOf(el)); }
      }
      rings = rings.map((r) => ({ r, a: Math.abs(ringAreaKm2(r)) })).filter((x) => x.a >= (sp.minArea ?? 0.005)).sort((x, y) => y.a - x.a);
      if (sp.pick === 'largest') rings = rings.slice(0, 1);
      // Drop rings that duplicate a bigger one (same object mapped twice): centroids within 250 m.
      const kept = [];
      for (const x of rings) if (!kept.some((y) => distM(centroid(y.r), centroid(x.r)) < 250 && y.a >= x.a * 0.5)) kept.push(x);
      if (!kept.length) { log(`  no usable ring for ${layer}/${sp.key} (${sp.name})`); continue; }
      result[layer].push({ props: { name: sp.name, key: sp.key, class: sp.class }, polys: kept.map((x) => [x.r]), ids: found, areaKm2: kept.reduce((s, x) => s + x.a, 0) });
    }
  }
  return { result, meta, query: q };
}

function finishAreas(features, bbox, tolFor, minArea) {
  const simplified = features.map((f) => ({ ...f, polys: f.polys.map((poly) => poly.map((ring) => simplifyDP(ring.concat([ring[0]]), tolFor(f)).slice(0, -1))) }));
  return finishPolygons(simplified, bbox, minArea);
}

// ---------------------------------------------------------------- 5. assembly, budgets, output
const bytesOf = (o) => Buffer.byteLength(JSON.stringify(o));
const fc = (features) => ({ type: 'FeatureCollection', features });

// Grows the tolerance scale until the layer fits its budget (or gives up after 10 rounds).
function fitBudget(label, budget, build) {
  let scale = 1;
  for (let i = 0; i < 10; i++) {
    const out = build(scale);
    const bytes = bytesOf(out.layers ? out.layers : out.fc);
    if (bytes <= budget || i === 9) { log(`${label}: ${bytes} bytes at tolerance x${scale.toFixed(2)} (budget ${budget})`); return { ...out, scale, bytes }; }
    scale *= 1.25;
  }
}

async function main() {
  const t0 = Date.now();
  const sources = [];
  // 1. INEGI
  const inegi = await loadInegi();
  sources.push(...inegi.sources);
  const frameFeatures = inegi.alcaldias.concat(inegi.listed);
  let bbox = BBOX_OVERRIDE;
  if (!bbox) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const f of frameFeatures) for (const poly of f.polys) for (const p of poly[0]) { if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0]; if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1]; }
    bbox = [w - BBOX_PAD_DEG, s - BBOX_PAD_DEG, e + BBOX_PAD_DEG, n + BBOX_PAD_DEG].map((v) => Math.round(v * 1000) / 1000);
  }
  let view;
  { let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity; for (const f of inegi.alcaldias) for (const poly of f.polys) for (const p of poly[0]) { if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0]; if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1]; } view = [w - 0.02, s - 0.02, e + 0.02, n + 0.02].map((v) => Math.round(v * 1000) / 1000); }
  log(`bbox [w,s,e,n] = ${JSON.stringify(bbox)}; suggested initial view ${JSON.stringify(view)}`);
  const cdmxRings = inegi.alcaldias.flatMap((f) => f.polys.map((poly) => poly[0]));

  // 2. admin polygons with shared arcs, fitted to budget
  const admin = fitBudget('alcaldías+zmvm', BUDGET.alcaldias + BUDGET.zmvm, (scale) => {
    const [A, Z] = simplifyShared([
      { name: 'alcaldias', tol: 45 * scale, features: inegi.alcaldias },
      { name: 'zmvm', tol: 90 * scale, features: inegi.zmvm },
    ]);
    const alc = fc(finishPolygons(A.features, bbox, 0.05));
    const zm = fc(finishPolygons(Z.features, bbox, 0.05));
    return { layers: { alcaldias: alc, zmvm: zm }, arcs: A.arcs, tolA: 45 * scale, tolZ: 90 * scale };
  });
  log(`  ${admin.arcs} distinct boundary arcs; tolerances alcaldías ${admin.tolA.toFixed(0)} m, zmvm ${admin.tolZ.toFixed(0)} m; alcaldías ${bytesOf(admin.layers.alcaldias)} B, zmvm ${bytesOf(admin.layers.zmvm)} B`);

  // 3. roads
  const roads = await loadRoads(bbox, cdmxRings);
  const roadReport = [];
  const roadsFit = fitBudget('roads', BUDGET.roads, (scale) => {
    const tol = 12 * scale;
    const feats = [];
    roadReport.length = 0;
    for (const rule of ROAD_RULES) {
      const built = buildRoad(roads.byRule.get(rule.key).map((c) => ({ ...c })), rule, bbox, tol);
      const km = built.lines.reduce((s, l) => s + lengthM(l), 0) / 1000;
      // Self-overlap: share of vertices lying within 100 m of another line of the same road.
      const ov = built.lines.length > 1 ? (() => { const ix = new SegIndex(); built.lines.forEach((l, i) => { for (let k = 1; k < l.length; k++) ix.add(l[k - 1], l[k], i); }); let hit = 0, n = 0; for (let i = 0; i < built.lines.length; i++) for (const p of built.lines[i]) { n++; if (ix.nearOther(p, 100, i)) hit++; } return hit / n; })() : 0;
      roadReport.push({ key: rule.key, name: rule.name, candidates: built.candidates, accepted: built.acceptedWays, lines: built.lines.length, km: Math.round(km), overlap: +ov.toFixed(2), lineKm: built.lines.map((l) => +(lengthM(l) / 1000).toFixed(1)) });
      if (!built.lines.length) continue;
      feats.push({ type: 'Feature', properties: { name: rule.name, key: rule.key, class: rule.class }, geometry: built.lines.length === 1 ? { type: 'LineString', coordinates: built.lines[0] } : { type: 'MultiLineString', coordinates: built.lines } });
    }
    return { fc: fc(feats), tol };
  });
  log(`  roads tolerance ${roadsFit.tol.toFixed(1)} m`);
  for (const r of roadReport) log(`  ${r.lines ? 'ok  ' : 'MISS'} ${r.key.padEnd(24)} ways ${String(r.candidates).padStart(4)} -> ${String(r.accepted).padStart(3)} kept, ${r.lines} line(s), ${r.km} km, self-overlap ${Math.round(r.overlap * 100)} %`);
  sources.push({ layer: 'roads', name: 'OpenStreetMap (major roads via Overpass API)', url: OVERPASS, license: 'Open Database License (ODbL) 1.0 (https://www.openstreetmap.org/copyright)', attribution: '© OpenStreetMap contributors', retrieved: roads.meta.retrieved.slice(0, 10) });

  // 4. areas
  const areas = await loadAreas();
  const areaLayers = {};
  for (const layer of ['green', 'water', 'airport']) {
    const fit = fitBudget(layer, BUDGET[layer], (scale) => ({ fc: fc(finishAreas(areas.result[layer], bbox, (f) => (f.props.class === 'forest' || f.props.class === 'wetland' ? 40 : 15) * scale, 0.01)) }));
    areaLayers[layer] = fit.fc;
    for (const f of areas.result[layer]) log(`  ${layer.padEnd(7)} ${f.props.key.padEnd(26)} ${f.ids.join('+').padEnd(28)} ${f.areaKm2.toFixed(2)} km²${fit.fc.features.some((x) => x.properties.key === f.props.key) ? '' : '  (dropped: outside frame or too small)'}`);
    sources.push({ layer, name: `OpenStreetMap (${layer} polygons via Overpass API, selected by object id)`, url: OVERPASS, license: 'Open Database License (ODbL) 1.0 (https://www.openstreetmap.org/copyright)', attribution: '© OpenStreetMap contributors', retrieved: areas.meta.retrieved.slice(0, 10) });
  }

  // 5. write
  const out = {
    meta: {
      built: new Date().toISOString(),
      generator: 'tools/build-geo.mjs',
      crs: 'WGS84 lon/lat (EPSG:4326), 5 decimals',
      attribution: `Mapa: © OpenStreetMap contributors (ODbL). Límites: ${sources[0].attribution}.`,
      sources,
      bbox,
      view,
      projection: {
        recommended: 'conicEqualArea',
        d3: 'd3.geoConicEqualArea().parallels([19.2, 19.7]).rotate([99.15, 0]).center([0, 19.43]).fitExtent([[pad, pad], [width - pad, height - pad]], frame)',
        parallels: [19.2, 19.7], rotate: [99.15, 0], center: [0, 19.43],
        alternative: 'd3.geoTransverseMercator().rotate([99.15, 0]).center([0, 19.43]).fitExtent(...)',
        frame: 'GeoJSON Polygon of meta.view (CDMX plus a margin) for the initial fit, or meta.bbox for the whole drawing; ring closed clockwise, e.g. [[w,n],[e,n],[e,s],[w,s],[w,n]]',
        winding: 'Exterior rings clockwise, holes anticlockwise (d3-geo convention; opposite to RFC 7946). Rewind if you draw with a planar library that cares.',
      },
    },
    alcaldias: admin.layers.alcaldias,
    zmvm: admin.layers.zmvm,
    roads: roadsFit.fc,
    green: areaLayers.green,
    water: areaLayers.water,
    airport: areaLayers.airport,
  };
  const json = JSON.stringify(out);
  const total = Buffer.byteLength(json);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);
  const sizes = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, bytesOf(v)]));
  log('\nbytes per layer:', JSON.stringify(sizes));
  log(`features: ${Object.entries(out).filter(([k]) => k !== 'meta').map(([k, v]) => `${k} ${v.features.length}`).join(', ')}`);
  log(`wrote ${OUT} (${total} bytes${total > BUDGET.total ? ' — OVER BUDGET' : ''}) in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  writeFileSync(PREVIEW, renderPreview(out));
  log(`wrote ${PREVIEW}`);
  writeFileSync(join(CACHE, 'build-report.json'), JSON.stringify({ built: out.meta.built, bbox, sizes, total, roads: roadReport, zmvm: out.zmvm.features.map((f) => f.properties), green: areas.result.green.map((f) => ({ key: f.props.key, ids: f.ids, km2: +f.areaKm2.toFixed(2) })), water: areas.result.water.map((f) => ({ key: f.props.key, ids: f.ids, km2: +f.areaKm2.toFixed(3) })), airport: areas.result.airport.map((f) => ({ key: f.props.key, ids: f.ids, km2: +f.areaKm2.toFixed(2) })), queries: { roads: roads.query, areas: areas.query } }, null, 1));
  if (total > BUDGET.total) process.exitCode = 1;
}

// ---------------------------------------------------------------- 6. preview SVG (plain Mercator)
function renderPreview(out) {
  const W = 1600, H = 1200, M = 40;
  const [w, s, e, n] = out.meta.bbox;
  // Mercator y in "degrees" so one scale factor serves both axes.
  const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
  const sx = (W - 2 * M) / (e - w), sy = (H - 2 * M) / (merc(n) - merc(s));
  const k = Math.min(sx, sy);
  const ox = (W - k * (e - w)) / 2, oy = (H - k * (merc(n) - merc(s))) / 2;
  const X = (lon) => (ox + k * (lon - w)).toFixed(1), Y = (lat) => (oy + k * (merc(n) - merc(lat))).toFixed(1);
  const path = (g) => {
    const ring = (r) => r.map((p, i) => (i ? 'L' : 'M') + X(p[0]) + ' ' + Y(p[1])).join('') + (g.type.endsWith('Polygon') ? 'Z' : '');
    if (g.type === 'Polygon') return g.coordinates.map(ring).join('');
    if (g.type === 'MultiPolygon') return g.coordinates.flat().map(ring).join('');
    if (g.type === 'LineString') return ring(g.coordinates);
    return g.coordinates.map(ring).join('');
  };
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const layer = (fcx, style, cls) => fcx.features.filter((f) => !cls || f.properties.class === cls).map((f) => `<path d="${path(f.geometry)}" ${style}><title>${esc(f.properties.name)}</title></path>`).join('\n');
  const labels = (fcx, size, fill) => fcx.features.map((f) => {
    const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((p) => p[0]);
    const big = rings.sort((a, b) => Math.abs(ringAreaKm2(b)) - Math.abs(ringAreaKm2(a)))[0];
    const c = centroid(big);
    return `<text x="${X(c[0])}" y="${Y(c[1])}" font-size="${size}" fill="${fill}" text-anchor="middle">${esc(f.properties.name)}</text>`;
  }).join('\n');
  const roadStyle = { highway: 'stroke="#b5651d" stroke-width="2"', avenue: 'stroke="#555" stroke-width="1.6"', expressway: 'stroke="#333" stroke-width="2.2"', ring: 'stroke="#222" stroke-width="2.6"' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">
<rect width="${W}" height="${H}" fill="#f7f6f2"/>
<rect x="${ox.toFixed(1)}" y="${oy.toFixed(1)}" width="${(k * (e - w)).toFixed(1)}" height="${(k * (merc(n) - merc(s))).toFixed(1)}" fill="#fff" stroke="#999" stroke-dasharray="4 3"/>
<g id="zmvm">${layer(out.zmvm, 'fill="#efede6" stroke="#c9c5b8" stroke-width="1"')}</g>
<g id="alcaldias">${layer(out.alcaldias, 'fill="#fbfaf6" stroke="#8d897c" stroke-width="1.2"')}</g>
<g id="green">${layer(out.green, 'fill="#bfdcb0" stroke="#8fbf7f" stroke-width="0.8" fill-opacity="0.85"')}</g>
<g id="water">${layer(out.water, 'fill="#a9cbe8" stroke="#7fa8cc" stroke-width="0.8"')}</g>
<g id="airport">${layer(out.airport, 'fill="#d9d9e0" stroke="#8c8ca0" stroke-width="1"')}</g>
<g id="roads" fill="none" stroke-linecap="round" stroke-linejoin="round">
${['highway', 'avenue', 'expressway', 'ring'].map((c) => layer(out.roads, roadStyle[c], c)).join('\n')}
</g>
<g id="labels-zmvm" opacity="0.7">${labels(out.zmvm, 11, '#6b675c')}</g>
<g id="labels-alcaldias">${labels(out.alcaldias, 13, '#222')}</g>
<g id="legend" font-size="12" fill="#333">
<text x="${M}" y="${H - 44}">bbox [w,s,e,n] ${out.meta.bbox.join(', ')} · roads: ring (black) · expressway (dark) · avenue (grey) · highway (brown) · green/water/airport filled · preview projection: plain Mercator</text>
<text x="${M}" y="${H - 26}">${esc(out.meta.attribution)} · built ${out.meta.built.slice(0, 10)}</text>
</g>
</svg>`;
}

main().catch((err) => { console.error('build-geo failed:', err.message); process.exitCode = 1; });
