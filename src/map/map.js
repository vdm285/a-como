// The stage: an SVG map of the city drawn from the committed geometry, one dot per store
// location, pan and zoom by hand (wheel, drag, pinch, double-click), and an API the app drives:
// colours, selection, own-price rings, price tags, fit with side padding. No tiles, no library
// beyond d3-geo for the projection and the paths.
//
// Decisions measured in the first audit (HANDOFF 2026-10-21):
// - The camera frames the stores, not the alcaldías (the south is forest without a store; the
//   north has 91 stores outside the alcaldías' box). Boundaries stay as context.
// - Strokes never scale with zoom (vector-effect), and a dot's on-screen radius grows only
//   slightly as the reader zooms in, so neighbours separate instead of staying stacked.
// - A click or tap snaps to the nearest dot within a few pixels; fingers are wider than dots.
// - Alcaldía labels sit above the dots with a knockout halo, are sized in screen pixels, and
//   colliding labels are dropped.

import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_R = 5;          // on-screen radius at the fit, for a median-coloured dot
const K_MAX = 16;
const SNAP_MOUSE = 8, SNAP_TOUCH = 22;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// points: [{ id, lat, lon }] — one per map location (co-located stores share a point).
export function createMap(host, geo, points, { motion = () => true } = {}) {
  const svg = el('svg', { role: 'application', tabindex: '0', 'aria-roledescription': 'mapa', 'aria-label': 'Mapa' }, host);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, fill: 'rgba(255,255,255,0.06)' }, pat);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.2 }, pat);
  el('rect', { class: 'bg', width: '100%', height: '100%', fill: 'transparent' }, svg);
  // screen-space alcaldía labels sit under the dots: the data outranks the names
  const labelsG = el('g', { class: 'L-labels' }, svg);
  const world = el('g', { class: 'world' }, svg);
  const layers = {};
  for (const name of ['zmvm', 'alcaldias', 'green', 'water', 'airport', 'roads', 'rings', 'dots', 'halo']) layers[name] = el('g', { class: `L-${name}` }, world);
  // price tags are screen-space and above everything (they are buttons)
  const tagsG = el('g', { class: 'L-tags' }, svg);

  let W = host.clientWidth || 800, H = host.clientHeight || 600;
  const projection = geoMercator();
  const path = geoPath(projection);
  const located = points.filter((p) => p.lat != null && p.lon != null);
  // the subject of the frame: every store location (MultiPoint), with the alcaldías as fallback
  const frameFeature = located.length > 2
    ? { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: located.map((p) => [p.lon, p.lat]) } }
    : (geo.alcaldias && geo.alcaldias.features.length ? geo.alcaldias : geo.zmvm);
  const BASE_PAD = 24;
  let pad = { left: 24, right: 24, top: 80, bottom: 90 };
  let view = { k: 1, x: 0, y: 0 };
  let atFit = true; // false once the reader zooms or pans by hand
  let selected = null, hovered = null, userMoves = 0, savedView = null, restoreView = null, userZoomed = false;
  // a view saved under one padding, moved by the change of the free area's centre since
  const shiftFor = (v, p0) => {
    const c0 = { x: p0.left + (W - p0.left - p0.right) / 2, y: p0.top + (H - p0.top - p0.bottom) / 2 };
    const c1 = { x: pad.left + (W - pad.left - pad.right) / 2, y: pad.top + (H - pad.top - pad.bottom) / 2 };
    return { k: v.k, x: v.x + c1.x - c0.x, y: v.y + c1.y - c0.y };
  };
  let lastColors = null, ownIds = new Set(), tags = [], labelsOn = true, obstacles = [], placedTags = [], active = null;
  const byId = new Map(located.map((s) => [s.id, s]));
  const dotEls = new Map();
  const ringEls = new Map();
  const handlers = { hover: [], click: [], background: [], move: [], active: [] };
  let labelItems = [];

  // The projection is fitted once to the whole viewport; a padding change (a card opening on
  // one side) becomes a view transform, so the geometry glides instead of being redrawn.
  // (a host smaller than the padding would give a degenerate projection and NaN everywhere)
  const MIN_SIDE = 2 * BASE_PAD + 60;
  function fitProjection() { projection.fitExtent([[BASE_PAD, BASE_PAD], [Math.max(W, MIN_SIDE) - BASE_PAD, Math.max(H, MIN_SIDE) - BASE_PAD]], frameFeature); }
  function frameBounds() {
    const b = path.bounds(frameFeature);
    const mx = (b[1][0] - b[0][0]) * 0.03, my = (b[1][1] - b[0][1]) * 0.03;
    return [[b[0][0] - mx, b[0][1] - my], [b[1][0] + mx, b[1][1] + my]];
  }
  function fitView(p = pad) {
    const b = frameBounds();
    const bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
    const boxW = Math.max(80, W - p.left - p.right), boxH = Math.max(60, H - p.top - p.bottom);
    const k = Math.min(boxW / bw, boxH / bh, 1.6);
    if (!(k > 0) || !Number.isFinite(k)) return { ...view };
    const cx = p.left + boxW / 2, cy = p.top + boxH / 2;
    return { k, x: cx - (b[0][0] + bw / 2) * k, y: cy - (b[0][1] + bh / 2) * k };
  }
  const kMin = () => Math.min(fitView().k, 1) * 0.8;

  function drawPolys(layer, fc, cls) {
    layer.innerHTML = '';
    if (!fc || !fc.features) return;
    for (const f of fc.features) {
      const d = path(f);
      if (!d) continue;
      el('path', { d, class: cls }, layer);
    }
  }
  function drawRoads(layer, fc) {
    layer.innerHTML = '';
    if (!fc || !fc.features) return;
    for (const f of fc.features) {
      const d = path(f);
      if (!d) continue;
      const hw = /motorway|trunk|hw|highway/i.test((f.properties && f.properties.class) || '');
      el('path', { d, class: `road${hw ? ' hw' : ''}` }, layer);
    }
  }
  function prepareLabels() {
    labelItems = [];
    if (!geo.alcaldias || !geo.alcaldias.features) return;
    for (const f of geo.alcaldias.features) {
      const c = projection(geoCentroid(f));
      if (!c) continue;
      const area = path.area(f);
      labelItems.push({ x: c[0], y: c[1], name: (f.properties && f.properties.name) || '', area, f });
    }
    labelItems.sort((a, b) => b.area - a.area); // big alcaldías win collisions
  }
  function drawDots() {
    layers.dots.innerHTML = '';
    dotEls.clear();
    for (const s of located) {
      const p = projection([s.lon, s.lat]);
      if (!p) continue;
      s._x = p[0]; s._y = p[1];
      const c = el('circle', { cx: p[0], cy: p[1], r: DOT_R, class: 'dot empty', 'data-id': s.id }, layers.dots);
      c._st = 'e'; c._rk = null;
      dotEls.set(s.id, c);
    }
  }
  function drawAll() {
    drawPolys(layers.zmvm, geo.zmvm, 'zmvm');
    drawPolys(layers.alcaldias, geo.alcaldias, 'alc');
    drawPolys(layers.green, geo.green, 'green');
    drawPolys(layers.water, geo.water, 'water');
    drawPolys(layers.airport, geo.airport, 'airport');
    drawRoads(layers.roads, geo.roads);
    prepareLabels();
    drawDots();
    applyColors(lastColors);
    applyOwn(ownIds);
    applySelected(selected);
    applyView();
  }
  function applyColors(colors) {
    let changed = 0;
    for (const [id, c] of dotEls) {
      const v = colors && colors.get(id);
      const st = !v || v.empty ? 'e' : v.hatched ? 'h' : v.fill;
      if (c._st === st) continue;
      changed++;
      const was = c._st;
      c._st = st;
      if (st === 'e' || st === 'h') {
        c.classList.toggle('empty', st === 'e'); c.classList.toggle('hatch', st === 'h');
        c.style.fill = ''; c._t = 0;
      } else {
        c.classList.remove('empty', 'hatch');
        c.style.fill = st; c._t = Math.min(1, Math.max(0, -(v.t || 0)));
      }
      if (was === undefined || (was === 'e') !== (st === 'e') || st !== 'e') c._rk = null; // radius depends on state and strength
    }
    if (!changed) return false;
    // draw the strongest signals last so they sit on top
    const rank = (c) => (c.classList.contains('empty') ? -1 : c.classList.contains('hatch') ? -0.5 : c._t);
    const order = [...dotEls.values()].sort((a, b) => rank(a) - rank(b));
    for (const c of order) layers.dots.appendChild(c);
    if (selected && dotEls.get(selected)) layers.dots.appendChild(dotEls.get(selected));
    return true;
  }
  function applyOwn(ids) {
    layers.rings.innerHTML = '';
    ringEls.clear();
    for (const id of ids || []) {
      const c = dotEls.get(id);
      if (!c) continue;
      ringEls.set(id, el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: DOT_R + 3, class: 'ring' }, layers.rings));
    }
  }
  function applySelected(id) {
    // (a selected incomplete store is drawn at the answer size: the radius is recomputed)
    for (const c of dotEls.values()) if (c.classList.contains('sel')) { c.classList.remove('sel'); c._rk = null; }
    if (id && dotEls.get(id)) dotEls.get(id)._rk = null;
    layers.halo.innerHTML = '';
    const c = id && dotEls.get(id);
    if (c) {
      c.classList.add('sel');
      layers.dots.appendChild(c);
      el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: DOT_R + 7, class: 'halo' }, layers.halo);
    }
  }
  // on-screen radius: grows gently with zoom (k^0.15) so stacked neighbours separate
  const screenR = (t = 0) => DOT_R * (0.8 + 0.5 * t) * Math.pow(Math.max(view.k, 0.3), 0.15);
  // an incomplete (hatched) store is small and faint, except while it is selected or hovered
  function setR(c) {
    const empty = c.classList.contains('empty'), small = c.classList.contains('hatch') && !c.classList.contains('sel') && !c.classList.contains('hover');
    c.setAttribute('r', (empty ? DOT_R * 0.45 * Math.pow(Math.max(view.k, 0.3), 0.15) : small ? screenR(0) * 0.7 : screenR(c._t || 0)) / view.k);
  }
  let frame = 0;
  function scheduleView() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; applyView(); }); }
  function applyView() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    for (const c of dotEls.values()) {
      if (c._rk === view.k) continue; // a pan does not change any radius
      c._rk = view.k;
      setR(c);
    }
    for (const [id, ring] of ringEls) { const c = dotEls.get(id); const r = c ? Number(c.getAttribute('r')) : DOT_R / view.k; ring.setAttribute('r', r + 3 / view.k); }
    const halo = layers.halo.firstChild;
    if (halo) { const c = dotEls.get(selected); const r = c ? Number(c.getAttribute('r')) : DOT_R / view.k; halo.setAttribute('r', r + 6 / view.k); }
    drawTags();
    drawLabels();
    drawActive();
    for (const h of handlers.move) h();
  }

  // ---- labels in screen space, collision-culled ----
  // Alcaldía names. For each zoom level (quarter-octave buckets) every alcaldía gets, once, a list
  // of spots inside it in world space with at most two dots under the name, emptiest and nearest
  // its centre first. Each frame only picks the first spot that is on screen and clear of the chrome
  // and the tags: no per-frame search (it cost 13 ms a frame), no hopping while the map pans, and a
  // name wherever part of its alcaldía shows.
  const labelCache = new Map();
  // Each alcaldía's shape as a 96×96 raster over its box in world space, filled once by scanlines
  // over its projected rings (even-odd, so holes stay holes). The inside test for a spot becomes a
  // lookup: the spherical geoContains took 67–133 ms per new zoom level, 500 ms at 4× CPU.
  function maskOf(it) {
    if (it._mask) return it._mask;
    const bb = path.bounds(it.f), N = 96;
    const x0 = bb[0][0], y0 = bb[0][1], cw = (bb[1][0] - x0) / N || 1, ch = (bb[1][1] - y0) / N || 1;
    const bits = new Uint8Array(N * N);
    const g = it.f.geometry || it.f;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const edges = [];
    for (const poly of polys) for (const ring of poly) {
      const pts = ring.map((c) => projection(c)).filter(Boolean);
      for (let i = 0; i + 1 < pts.length; i++) edges.push(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
    const xs = [];
    for (let r = 0; r < N; r++) {
      const y = y0 + (r + 0.5) * ch;
      xs.length = 0;
      for (let e = 0; e < edges.length; e += 4) { const ay = edges[e + 1], by = edges[e + 3]; if ((ay > y) !== (by > y)) xs.push(edges[e] + ((y - ay) / (by - ay)) * (edges[e + 2] - edges[e])); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil((xs[k] - x0) / cw - 0.5)), c1 = Math.min(N - 1, Math.floor((xs[k + 1] - x0) / cw - 0.5));
        for (let c = c0; c <= c1; c++) bits[r * N + c] = 1;
      }
    }
    // eroded by one cell: a spot on a cell the border crosses could sit a few pixels outside
    const inner = new Uint8Array(N * N);
    for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) { const i = r * N + c; inner[i] = bits[i] & bits[i - 1] & bits[i + 1] & bits[i - N] & bits[i + N]; }
    it._mask = { x0, y0, cw, ch, N, bits: inner };
    return it._mask;
  }
  const insideMask = (m, x, y) => { const c = Math.floor((x - m.x0) / m.cw), r = Math.floor((y - m.y0) / m.ch); return c >= 0 && r >= 0 && c < m.N && r < m.N && m.bits[r * m.N + c] === 1; };
  function labelCandidates(size) {
    const bk = Math.round(Math.log2(Math.max(view.k, 0.05)) * 4) / 4;
    const key = `${bk}|${size}`;
    if (labelCache.has(key)) return labelCache.get(key);
    const kq = Math.pow(2, bk), hW = (size + 4) / kq, padW = 2 / kq;
    const out = labelItems.map((it) => {
      const wW = (it.name.length * size * 0.7 + 6) / kq;
      const bb = path.bounds(it.f);
      // the dots near this alcaldía, found once (counting all 411 for every spot made a zoom step hitch)
      if (!it._near) { const m = Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) * 0.1; it._near = located.filter((p) => p._x != null && p._x > bb[0][0] - m && p._x < bb[1][0] + m && p._y > bb[0][1] - m && p._y < bb[1][1] + m); }
      const step = Math.max(hW * 1.2, Math.max(bb[1][0] - bb[0][0], bb[1][1] - bb[0][1]) / 14);
      const cands = [];
      const mask = maskOf(it);
      for (let y = bb[0][1] + step / 2; y < bb[1][1]; y += step) {
        for (let x = bb[0][0] + step / 2; x < bb[1][0]; x += step) {
          if (!insideMask(mask, x, y)) continue;
          let dots = 0;
          for (const p of it._near) { if (Math.abs(p._x - x) < wW / 2 + padW && Math.abs(p._y - y) < hW / 2 + padW) dots++; }
          if (dots > 2) continue;
          cands.push({ x, y, cost: dots * 3 + Math.hypot(x - it.x, y - it.y) / hW / 4 });
        }
      }
      cands.sort((p, q) => p.cost - q.cost);
      return { it, cands: cands.slice(0, 80) };
    });
    if (labelCache.size > 48) labelCache.clear();
    labelCache.set(key, out);
    return out;
  }
  function drawLabels() {
    labelsG.innerHTML = '';
    if (!labelsOn) return;
    // a city drawn smaller than its own names gets none
    { const fb = frameBounds(); if ((fb[1][0] - fb[0][0]) * view.k < 200) return; }
    const placed = [...obstacles, ...placedTags];
    const size = W < 520 ? 9 : 10.5;
    const hit = (box, q) => !(box[2] < q[0] || box[0] > q[2] || box[3] < q[1] || box[1] > q[3]);
    // a name keeps its spot while that spot stays on screen and clear (taking the first clear spot
    // every frame made names jump as the chrome's edges passed during a pan); a new zoom level
    // keeps the spot nearest the old one
    const near = (h) => 2 * h / view.k;
    for (const { it, cands } of labelCandidates(size)) {
      const w = it.name.length * size * 0.7 + 6, h = size + 4;
      const boxOf = (c) => {
        const x = c.x * view.k + view.x, y = c.y * view.k + view.y;
        const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        if (box[0] < 4 || box[2] > W - 4 || box[1] < 4 || box[3] > H - 4) return null;
        return placed.some((q) => hit(box, q)) ? null : box;
      };
      let chosen = null, box = null;
      if (it._spot) {
        const prev = cands.includes(it._spot) ? it._spot : cands.reduce((a, c) => { const d = Math.hypot(c.x - it._spot.x, c.y - it._spot.y); return d < near(h) && (!a || d < a.d) ? { c, d } : a; }, null)?.c;
        if (prev) { box = boxOf(prev); if (box) chosen = prev; }
      }
      // a spot that must move goes to the nearest clear one, not the best one across the alcaldía
      const order = it._spot ? [...cands].sort((a, b) => Math.hypot(a.x - it._spot.x, a.y - it._spot.y) - Math.hypot(b.x - it._spot.x, b.y - it._spot.y)) : cands;
      if (!chosen) for (const c of order) { box = boxOf(c); if (box) { chosen = c; break; } }
      it._spot = chosen;
      if (!chosen) continue;
      placed.push(box);
      const t = el('text', { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, class: 'alc-label' }, labelsG);
      t.style.fontSize = `${size}px`;
      t.textContent = it.name;
    }
  }

  // ---- price tags: callouts in screen space with a leader to the dot ----
  // a tag's text is measured once (it is drawn in screen pixels, so its width never changes with
  // the view); measuring on every frame forced a layout per tag and stalled playback for a second
  const textWidths = new Map();
  // Widths come from a canvas with the tags' computed fonts (read once from a probe), so a week's
  // new prices cost no layout: each step brought new texts and the SVG probe forced one per tag.
  let tagFonts = null;
  const canvasCtx = document.createElement('canvas').getContext('2d');
  function measureTag(tg) {
    const key = `${tg.text}|${tg.sub || ''}`;
    if (textWidths.has(key)) return textWidths.get(key);
    if (!tagFonts) {
      const probe = el('g', { class: 'tag' }, tagsG);
      const f = (cls) => { const n = el('text', { class: cls, x: 0, y: 0 }, probe); n.textContent = 'x'; const s = getComputedStyle(n); return `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; };
      tagFonts = { price: f('tag-price'), sub: f('tag-sub') };
      probe.remove();
    }
    const w = (txt, font) => { canvasCtx.font = font; return canvasCtx.measureText(txt).width; };
    let sub = tg.sub || '';
    if (sub && w(sub, tagFonts.sub) > 172) { while (sub.length > 4 && w(`${sub}…`, tagFonts.sub) > 172) sub = sub.slice(0, -2); sub = `${sub}…`; }
    const out = { tw: Math.max(w(tg.text, tagFonts.price), sub ? w(sub, tagFonts.sub) : 0), sub };
    if (textWidths.size > 400) textWidths.clear();
    textWidths.set(key, out);
    return out;
  }
  // a width taken before Manrope arrived was the fallback font's
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { textWidths.clear(); tagFonts = null; drawTags(); });
  function drawTags() {
    tagsG.innerHTML = '';
    placedTags = [];
    if (!tags.length) return;
    const placed = [...obstacles];
    // the coloured dots on screen, once per draw (each spot scanned all 411 dots through the DOM)
    const pts = [];
    for (const [id, c] of dotEls) { if (c.classList.contains('empty')) continue; const p = byId.get(id); pts.push(p._x * view.k + view.x, p._y * view.k + view.y); }
    const colouredNear = (box) => { let n = 0; for (let i = 0; i < pts.length; i += 2) { const dx = pts[i], dy = pts[i + 1]; if (dx > box[0] - 3 && dx < box[2] + 3 && dy > box[1] - 3 && dy < box[3] + 3) n++; } return n; };
    for (const tg of tags) {
      const s = byId.get(tg.id);
      if (!s || s._x == null) continue;
      const x = s._x * view.k + view.x, y = s._y * view.k + view.y;
      if (x < pad.left - 10 || x > W - pad.right + 10 || y < pad.top - 10 || y > H - pad.bottom + 10) continue;
      const { tw, sub } = measureTag(tg);
      const w = Math.ceil(tw) + 16, h = tg.sub ? 36 : 22;
      // above, below and beside the dot, at three leader lengths: the nearest spot that covers no data wins
      const spots = [];
      // (two longer leaders before a tag is given up: a week's dearest price vanished at 1440)
      for (const d of [10, 30, 56, 90, 130]) spots.push([x + d, y - h - d], [x - w - d, y - h - d], [x + d, y + d], [x - w - d, y + d], [x + d + 8, y - h / 2], [x - w - d - 8, y - h / 2]);
      let spot = null, spotCost = Infinity;
      for (const [bx, by] of spots) {
        const box = [bx, by, bx + w, by + h];
        if (box[0] < pad.left || box[2] > W - pad.right || box[1] < pad.top || box[3] > H - pad.bottom) continue;
        if (placed.some((b) => !(box[2] + 4 < b[0] || box[0] > b[2] + 4 || box[3] + 4 < b[1] || box[1] > b[3] + 4))) continue;
        const cost = colouredNear(box);
        if (cost < spotCost) { spot = box; spotCost = cost; if (!cost) break; }
      }
      // never bury the data a tag annotates: a spot over more than two coloured dots is no spot
      if (!spot || spotCost > 2) continue;
      placed.push(spot); placedTags.push(spot);
      const g = el('g', { class: `tag ${tg.kind || ''}`, 'data-id': tg.clickId || tg.id, role: 'button', tabindex: '-1', 'aria-label': `${tg.text}, ${sub}` }, tagsG);
      const ax = spot[0] < x ? spot[2] : spot[0], ay = spot[1] < y ? spot[3] : spot[1];
      el('line', { x1: x, y1: y, x2: ax, y2: ay, class: 'tag-leader' }, g);
      el('rect', { x: spot[0], y: spot[1], width: w, height: h, rx: 8, class: 'tag-box', style: tg.color ? `stroke:${tg.color}` : null }, g);
      const t1 = el('text', { x: spot[0] + 8, y: spot[1] + 15, class: 'tag-price' }, g); t1.textContent = tg.text;
      if (tg.sub) { const t2 = el('text', { x: spot[0] + 8, y: spot[1] + 29, class: 'tag-sub' }, g); t2.textContent = sub; }
    }
  }

  // ---- animation on the wall clock (the pane throttles frames; never accumulate deltas) ----
  // (a target equal to the view draws once instead of animating: every week step asked for the
  // same fit and redrew the tags and labels 33 times)
  let anim = null;
  function animateTo(target, ms = 520) {
    if (anim) cancelAnimationFrame(anim.raf);
    anim = null;
    setHover(null);
    const same = Math.abs(target.k - view.k) < 1e-4 && Math.abs(target.x - view.x) < 0.5 && Math.abs(target.y - view.y) < 0.5;
    if (!motion() || ms === 0 || same) { view = { ...target }; applyView(); return; }
    const from = { ...view }, t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - u, 3);
      view = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      applyView();
      if (u < 1) anim.raf = requestAnimationFrame(step); else anim = null;
    };
    anim = { raf: requestAnimationFrame(step), target: { ...target } };
  }

  function clampView(v) {
    // keep the framed extent at least partly on screen
    const b = frameBounds();
    const bx = [b[0][0] * v.k + v.x, b[1][0] * v.k + v.x];
    const by = [b[0][1] * v.k + v.y, b[1][1] * v.k + v.y];
    const m = 120;
    if (bx[1] < m) v.x += m - bx[1]; if (bx[0] > W - m) v.x -= bx[0] - (W - m);
    if (by[1] < m) v.y += m - by[1]; if (by[0] > H - m) v.y -= by[0] - (H - m);
    return v;
  }

  // nearest location to a screen point, within maxPx
  function nearest(px, py, maxPx) {
    let best = null, bd = maxPx * maxPx;
    for (const [id, c] of dotEls) {
      const s = byId.get(id);
      const dx = s._x * view.k + view.x - px, dy = s._y * view.k + view.y - py;
      const d2 = dx * dx + dy * dy;
      // a coloured dot wins over an empty one at a similar distance
      const bias = c.classList.contains('empty') ? 1.6 : 1;
      if (d2 * bias < bd) { bd = d2 * bias; best = id; }
    }
    return best;
  }

  // ---- pointer handling ----
  const pointers = new Map();
  let drag = null, pinch = null, lastTap = 0, bgTimer = null;
  svg.addEventListener('pointerdown', (e) => {
    if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.setPointerCapture(e.pointerId);
    // pointer capture retargets the release to the svg: remember a pressed tag now
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, touch: e.pointerType !== 'mouse', tag: e.target && e.target.closest ? e.target.closest('.tag') : null };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: view.x, vy: view.y };
      drag = null;
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const rect = host.getBoundingClientRect();
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = Math.max(kMin(), Math.min(K_MAX, pinch.k * (d / pinch.d)));
      const cx = pinch.cx - rect.left, cy = pinch.cy - rect.top;
      const ncx = (a.x + b.x) / 2 - rect.left, ncy = (a.y + b.y) / 2 - rect.top;
      view = clampView({ k, x: ncx - (cx - pinch.vx) * (k / pinch.k), y: ncy - (cy - pinch.vy) * (k / pinch.k) });
      atFit = false; userMoves++; userZoomed = true;
      scheduleView();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; setHover(null); }
      if (drag.moved) { view = clampView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy }); atFit = false; userMoves++; scheduleView(); }
      return;
    }
    if (e.pointerType !== 'mouse') return; // no hover on touch
    const id = nearest(e.clientX - rect.left, e.clientY - rect.top, SNAP_MOUSE);
    setHover(id, e.clientX - rect.left, e.clientY - rect.top);
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && e.type === 'pointerup' && !drag.moved) {
      const tagEl = drag.tag;
      if (tagEl) { drag = null; clearTimeout(bgTimer); for (const h of handlers.click) h(tagEl.getAttribute('data-id')); return; }
      const rect = host.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const id = nearest(px, py, drag.touch ? SNAP_TOUCH : SNAP_MOUSE);
      const now = performance.now();
      const isDouble = now - lastTap < 320;
      lastTap = now;
      if (isDouble) {
        // a double tap zooms and cancels the pending single-tap action
        clearTimeout(bgTimer); bgTimer = null;
        zoomAt(e.clientX, e.clientY, 1.8);
      } else if (id) {
        for (const h of handlers.click) h(id);
      } else {
        // wait for a possible second tap before treating this as a background tap
        clearTimeout(bgTimer);
        bgTimer = setTimeout(() => { bgTimer = null; for (const h of handlers.background) h(); }, 320);
      }
    }
    if (e.type !== 'pointermove') drag = pointers.size ? drag : null;
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    setHover(null);
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    zoomAt(e.clientX, e.clientY, f, 0);
  }, { passive: false });

  function zoomAt(clientX, clientY, factor, ms = 260) {
    const rect = host.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const k = Math.max(kMin(), Math.min(K_MAX, view.k * factor));
    const f = k / view.k;
    atFit = false; userMoves++; userZoomed = true;
    animateTo(clampView({ k, x: px - (px - view.x) * f, y: py - (py - view.y) * f }), ms);
  }

  function setHover(id, x, y) {
    if (hovered === id) { if (id) for (const h of handlers.hover) h(id, x, y); return; }
    if (hovered && dotEls.get(hovered)) { const o = dotEls.get(hovered); o.classList.remove('hover'); setR(o); }
    hovered = id;
    if (id && dotEls.get(id)) { const c = dotEls.get(id); c.classList.add('hover'); setR(c); layers.dots.appendChild(c); }
    for (const h of handlers.hover) h(id, x, y);
  }

  // ---- keyboard ----
  function screenOf(id) { const p = byId.get(id); return [p._x * view.k + view.x, p._y * view.k + view.y]; }
  function drawActive() {
    layers.halo.querySelectorAll('.kbd-ring').forEach((n) => n.remove());
    if (!active || !dotEls.get(active)) return;
    const c = dotEls.get(active);
    el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: (Number(c.getAttribute('r')) || DOT_R / view.k) + 5 / view.k, class: 'kbd-ring' }, layers.halo);
  }
  function setActive(id) {
    active = id;
    // the keyboard's store stays in view: pan (never zoom) when it leaves the free area
    if (id && !api.inFreeArea(id)) {
      const p = byId.get(id);
      const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
      atFit = false; userMoves++; // a keyboard walk that pans is the reader moving the map
      view = clampView({ k: view.k, x: cx - p._x * view.k, y: cy - p._y * view.k });
      applyView();
    }
    drawActive();
    if (id) { const [x, y] = screenOf(id); for (const h of handlers.active) h(id, x, y); }
  }
  function move(dx, dy) {
    const from = active ? screenOf(active) : [pad.left + (W - pad.left - pad.right) / 2, pad.top + (H - pad.top - pad.bottom) / 2];
    let best = null, bd = Infinity;
    for (const id of dotEls.keys()) {
      if (id === active) continue;
      const [x, y] = screenOf(id); const vx = x - from[0], vy = y - from[1];
      const along = vx * dx + vy * dy; if (along <= 0) continue;
      const across = Math.abs(vx * dy - vy * dx);
      if (across > along * 1.2) continue; // a 100-degree cone
      const d = along + across * 2;
      if (d < bd) { bd = d; best = id; }
    }
    if (best) setActive(best);
  }
  svg.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
    else if (k === 'ArrowRight') { e.preventDefault(); move(1, 0); }
    else if (k === 'ArrowUp') { e.preventDefault(); move(0, -1); }
    else if (k === 'ArrowDown') { e.preventDefault(); move(0, 1); }
    else if (k === 'Enter' && active) { e.preventDefault(); for (const h of handlers.click) h(active); }
    else if (k === '+' || k === '=') { e.preventDefault(); const [x, y] = active ? screenOf(active) : [W / 2, H / 2]; const r = host.getBoundingClientRect(); zoomAt(x + r.left, y + r.top, 1.6); }
    else if (k === '-' || k === '_') { e.preventDefault(); const [x, y] = active ? screenOf(active) : [W / 2, H / 2]; const r = host.getBoundingClientRect(); zoomAt(x + r.left, y + r.top, 1 / 1.6); }
    else if (k === '0') { e.preventDefault(); atFit = true; animateTo(fitView()); }
  });
  // a tap or a click focuses the svg too: that must not start the keyboard walk (a second ring, an
  // announcement, a pan); a keyboard focus resumes the walk where it was
  // Focus that follows a press anywhere is a pointer's, never the keyboard walk's: a finger's
  // focus arrives with the compatibility mousedown after pointerup, and a tap on the sheet's grip
  // lands its mousedown on the map that moved under it. Only Tab starts the walk.
  let lastPress = -Infinity, lastActive = null;
  window.addEventListener('pointerdown', () => { lastPress = performance.now(); }, true);
  window.addEventListener('mousedown', () => { lastPress = performance.now(); }, true);
  svg.addEventListener('focus', () => {
    if (performance.now() - lastPress < 1000) return;
    if (active) { setActive(active); return; }
    if (lastActive && dotEls.has(lastActive)) { setActive(lastActive); return; }
    move(0, 1); if (!active) move(1, 0);
  });
  svg.addEventListener('blur', () => { if (active) lastActive = active; active = null; drawActive(); for (const h of handlers.active) h(null); });

  // ---- public API ----
  const api = {
    svg,
    resize() {
      const nw = host.clientWidth || W, nh = host.clientHeight || H;
      if (nw < MIN_SIDE || nh < MIN_SIDE) return; // keep the last good layout until the host is usable
      W = nw; H = nh;
      fitProjection();
      labelCache.clear(); for (const it of labelItems) { it._near = null; it._mask = null; } // world coordinates change with the projection
      drawAll();
      if (atFit) { view = fitView(); applyView(); }
    },
    // A card opened or closed (or the chrome moved). At the fit: glide to the new fit. Zoomed by
    // hand: keep the zoom, and only if the selected store is now covered, pan it into view.
    // The view follows the free area's centre the same way when a card opens and when it closes
    // (a store card too: skipping the shift on open slid the view on close, and buried the side of
    // the city under the card); then a selected store the shift left covered is centred.
    // A store card opened over a moved map remembers that view, and closing it returns there
    // unless the reader moved the map meanwhile (the shift and the re-centring of the open were
    // only half undone by the close). The base is a running animation's end, not its current
    // frame (a search's zoom was cancelled by the card's padding 2 ms after it started).
    setPadding(p, animate = true) {
      const before = { x: pad.left + (W - pad.left - pad.right) / 2, y: pad.top + (H - pad.top - pad.bottom) / 2 };
      pad = { ...pad, ...p };
      if (atFit) { restoreView = null; animateTo(fitView(), animate ? 480 : 0); return; }
      // the view a store card opened over comes back, moved by however much the free area's centre
      // differs from then (closing it into another card must not put the city under that card)
      if (restoreView) { const r = restoreView; restoreView = null; animateTo(clampView(shiftFor(r.view, r.pad)), animate ? 480 : 0); return; }
      const base = anim && anim.target ? anim.target : view;
      const after = { x: pad.left + (W - pad.left - pad.right) / 2, y: pad.top + (H - pad.top - pad.bottom) / 2 };
      let target = Math.abs(after.x - before.x) > 40 || Math.abs(after.y - before.y) > 40 ? clampView({ k: base.k, x: base.x + after.x - before.x, y: base.y + after.y - before.y }) : base;
      const s = selected && byId.get(selected);
      if (s && s._x != null) {
        const x = s._x * target.k + target.x, y = s._y * target.k + target.y;
        if (!(x > pad.left + 16 && x < W - pad.right - 16 && y > pad.top + 16 && y < H - pad.bottom - 16)) target = clampView({ k: base.k, x: after.x - s._x * base.k, y: after.y - s._y * base.k });
      }
      if (target === base && anim) return; // the running animation already ends there
      if (target !== view) animateTo(target, animate ? 480 : 0); else applyView();
    },
    fitK() { return fitView().k; },
    // a zoom the reader made (wheel, pinch, double tap, + and −), as opposed to one the app made
    userZoomed() { return userZoomed && !atFit; },
    // the view now, to come back to after a passing layout (the phone's full sheet)
    snapshot() { return { view: { ...(anim && anim.target ? anim.target : view) }, pad: { ...pad }, moves: userMoves }; },
    restoreSnapshot(s) { if (!s || s.moves !== userMoves || atFit) return false; animateTo(clampView(shiftFor(s.view, s.pad))); return true; },
    reset() { atFit = true; userZoomed = false; restoreView = null; animateTo(fitView()); },
    // centre a location in the free area; k is a multiple of the fit scale
    zoomTo(id, kRel = 4) {
      const s = byId.get(id);
      if (!s || s._x == null) return;
      const k = Math.min(K_MAX, fitView().k * kRel);
      const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
      atFit = false; userZoomed = false; restoreView = null;
      animateTo(clampView({ k, x: cx - s._x * k, y: cy - s._y * k }), 650);
    },
    // how many of these locations the view shows in the free area (at a running animation's end)
    inFreeCount(ids) {
      const v = anim && anim.target ? anim.target : view;
      let n = 0, k = 0;
      for (const id of ids) { const s = byId.get(id); if (!s || s._x == null) continue; n++; const x = s._x * v.k + v.x, y = s._y * v.k + v.y; if (x > pad.left + 16 && x < W - pad.right - 16 && y > pad.top + 16 && y < H - pad.bottom - 16) k++; }
      return { n, k };
    },
    inFreeArea(id) {
      const s = byId.get(id);
      if (!s || s._x == null) return true;
      const x = s._x * view.k + view.x, y = s._y * view.k + view.y;
      return x > pad.left + 16 && x < W - pad.right - 16 && y > pad.top + 16 && y < H - pad.bottom - 16;
    },
    // colors: Map id -> { fill, t, empty, hatched }; t (0..1) is the strength of the signal
    setColors(colors) { lastColors = colors; if (applyColors(colors)) applyView(); },
    setSelected(id) {
      if (id && !selected) { restoreView = null; savedView = atFit ? null : { view: { ...(anim && anim.target ? anim.target : view) }, pad: { ...pad }, moves: userMoves }; }
      if (!id && selected) { restoreView = savedView && savedView.moves === userMoves && !atFit ? savedView : null; savedView = null; }
      selected = id; applySelected(id); applyView();
    },
    setOwn(ids) { ownIds = new Set(ids || []); applyOwn(ownIds); applyView(); },
    // tags: [{ id, text, sub, color, kind }] in priority order
    setTags(list) { tags = list || []; drawTags(); },
    setLabels(on) { labelsOn = on; drawLabels(); },
    // screen rectangles the labels and tags must avoid (search, legend, timeline, card, buttons)
    setObstacles(list) { obstacles = list || []; drawTags(); drawLabels(); },
    setName(text, role) { svg.setAttribute('aria-label', text); if (role) svg.setAttribute('aria-roledescription', role); },
    onActive(h) { handlers.active.push(h); },
    isAtFit() { return atFit; },
    screenXY(id) {
      const s = byId.get(id);
      if (!s || s._x == null) return null;
      return [s._x * view.k + view.x, s._y * view.k + view.y];
    },
    size() { return [W, H]; },
    zoom() { return view.k; },
    onHover(h) { handlers.hover.push(h); },
    onClick(h) { handlers.click.push(h); },
    onBackground(h) { handlers.background.push(h); },
    onMove(h) { handlers.move.push(h); },
    clearHover() { setHover(null); },
  };

  fitProjection();
  drawAll();
  view = fitView();
  applyView();
  return api;
}
