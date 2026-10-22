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
  const svg = el('svg', { role: 'img', 'aria-label': 'Mapa' }, host);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, fill: 'rgba(255,255,255,0.06)' }, pat);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.2 }, pat);
  el('rect', { class: 'bg', width: '100%', height: '100%', fill: 'transparent' }, svg);
  const world = el('g', { class: 'world' }, svg);
  const layers = {};
  for (const name of ['zmvm', 'alcaldias', 'green', 'water', 'airport', 'roads', 'rings', 'dots', 'halo']) layers[name] = el('g', { class: `L-${name}` }, world);
  // screen-space layers (not scaled by the world transform)
  const labelsG = el('g', { class: 'L-labels' }, svg);
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
  let selected = null, hovered = null;
  let lastColors = null, ownIds = new Set(), tags = [], labelsOn = true;
  const byId = new Map(located.map((s) => [s.id, s]));
  const dotEls = new Map();
  const ringEls = new Map();
  const handlers = { hover: [], click: [], background: [], move: [] };
  let labelItems = [];

  // The projection is fitted once to the whole viewport; a padding change (a card opening on
  // one side) becomes a view transform, so the geometry glides instead of being redrawn.
  function fitProjection() { projection.fitExtent([[BASE_PAD, BASE_PAD], [W - BASE_PAD, H - BASE_PAD]], frameFeature); }
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
      labelItems.push({ x: c[0], y: c[1], name: (f.properties && f.properties.name) || '', area });
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
    for (const [id, c] of dotEls) {
      const v = colors && colors.get(id);
      c._t = 0;
      if (!v || v.empty) { c.setAttribute('class', `dot empty${id === selected ? ' sel' : ''}${id === hovered ? ' hover' : ''}`); c.style.fill = ''; }
      else if (v.hatched) { c.setAttribute('class', `dot hatch${id === selected ? ' sel' : ''}${id === hovered ? ' hover' : ''}`); c.style.fill = ''; }
      else { c.setAttribute('class', `dot${id === selected ? ' sel' : ''}${id === hovered ? ' hover' : ''}`); c.style.fill = v.fill; c._t = Math.min(1, Math.abs(v.t || 0)); }
    }
    // draw the strongest signals last so they sit on top
    const rank = (c) => (c.classList.contains('empty') ? -1 : c.classList.contains('hatch') ? -0.5 : c._t);
    const order = [...dotEls.values()].sort((a, b) => rank(a) - rank(b));
    for (const c of order) layers.dots.appendChild(c);
    if (selected && dotEls.get(selected)) layers.dots.appendChild(dotEls.get(selected));
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
    for (const c of dotEls.values()) c.classList.remove('sel');
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
  function applyView() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    for (const c of dotEls.values()) {
      const empty = c.classList.contains('empty');
      c.setAttribute('r', (empty ? DOT_R * 0.45 * Math.pow(Math.max(view.k, 0.3), 0.15) : screenR(c._t || 0)) / view.k);
    }
    for (const [id, ring] of ringEls) { const c = dotEls.get(id); const r = c ? Number(c.getAttribute('r')) : DOT_R / view.k; ring.setAttribute('r', r + 3 / view.k); }
    const halo = layers.halo.firstChild;
    if (halo) { const c = dotEls.get(selected); const r = c ? Number(c.getAttribute('r')) : DOT_R / view.k; halo.setAttribute('r', r + 6 / view.k); }
    drawLabels();
    drawTags();
    for (const h of handlers.move) h();
  }

  // ---- labels in screen space, collision-culled ----
  function drawLabels() {
    labelsG.innerHTML = '';
    if (!labelsOn || view.k > 4.5) return;
    const placed = [];
    const size = 10.5;
    for (const it of labelItems) {
      const x = it.x * view.k + view.x, y = it.y * view.k + view.y;
      const w = it.name.length * size * 0.66 + 6, h = size + 4;
      const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
      if (box[2] < 0 || box[0] > W || box[3] < 0 || box[1] > H) continue;
      if (placed.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      placed.push(box);
      const t = el('text', { x, y, class: 'alc-label' }, labelsG);
      t.style.fontSize = `${size}px`;
      t.textContent = it.name;
    }
  }

  // ---- price tags: callouts in screen space with a leader to the dot ----
  function drawTags() {
    tagsG.innerHTML = '';
    if (!tags.length) return;
    const placed = [];
    for (const tg of tags) {
      const s = byId.get(tg.id);
      if (!s || s._x == null) continue;
      const x = s._x * view.k + view.x, y = s._y * view.k + view.y;
      if (x < pad.left - 10 || x > W - pad.right + 10 || y < pad.top - 10 || y > H - pad.bottom + 10) continue;
      const priceW = tg.text.length * 7.4 + 16, subW = (tg.sub || '').length * 5.9 + 16;
      const w = Math.min(190, Math.max(priceW, subW)), h = tg.sub ? 36 : 22;
      // try above-right, above-left, below-right, below-left
      const spots = [[x + 10, y - h - 10], [x - w - 10, y - h - 10], [x + 10, y + 10], [x - w - 10, y + 10]];
      let spot = null;
      for (const [bx, by] of spots) {
        const box = [bx, by, bx + w, by + h];
        if (box[0] < pad.left || box[2] > W - pad.right || box[1] < pad.top || box[3] > H - pad.bottom) continue;
        if (placed.some((b) => !(box[2] + 4 < b[0] || box[0] > b[2] + 4 || box[3] + 4 < b[1] || box[1] > b[3] + 4))) continue;
        spot = box; break;
      }
      if (!spot) continue;
      placed.push(spot);
      const g = el('g', { class: `tag ${tg.kind || ''}` }, tagsG);
      const ax = spot[0] < x ? spot[2] : spot[0], ay = spot[1] < y ? spot[3] : spot[1];
      el('line', { x1: x, y1: y, x2: ax, y2: ay, class: 'tag-leader' }, g);
      el('rect', { x: spot[0], y: spot[1], width: w, height: h, rx: 8, class: 'tag-box', style: tg.color ? `stroke:${tg.color}` : null }, g);
      const t1 = el('text', { x: spot[0] + 8, y: spot[1] + 15, class: 'tag-price' }, g); t1.textContent = tg.text;
      if (tg.sub) { const t2 = el('text', { x: spot[0] + 8, y: spot[1] + 29, class: 'tag-sub' }, g); t2.textContent = tg.sub.length > 28 ? `${tg.sub.slice(0, 27)}…` : tg.sub; }
    }
  }

  // ---- animation on the wall clock (the pane throttles frames; never accumulate deltas) ----
  let anim = null;
  function animateTo(target, ms = 520) {
    if (anim) cancelAnimationFrame(anim.raf);
    setHover(null);
    if (!motion() || ms === 0) { view = { ...target }; applyView(); return; }
    const from = { ...view }, t0 = performance.now();
    const step = () => {
      const u = Math.min(1, (performance.now() - t0) / ms);
      const e = 1 - Math.pow(1 - u, 3);
      view = { k: from.k + (target.k - from.k) * e, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      applyView();
      if (u < 1) anim.raf = requestAnimationFrame(step); else anim = null;
    };
    anim = { raf: requestAnimationFrame(step) };
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
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, touch: e.pointerType !== 'mouse' };
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
      atFit = false;
      applyView();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; setHover(null); }
      if (drag.moved) { view = clampView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy }); atFit = false; applyView(); }
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
    atFit = false;
    animateTo(clampView({ k, x: px - (px - view.x) * f, y: py - (py - view.y) * f }), ms);
  }

  function setHover(id, x, y) {
    if (hovered === id) { if (id) for (const h of handlers.hover) h(id, x, y); return; }
    if (hovered && dotEls.get(hovered)) dotEls.get(hovered).classList.remove('hover');
    hovered = id;
    if (id && dotEls.get(id)) { dotEls.get(id).classList.add('hover'); layers.dots.appendChild(dotEls.get(id)); }
    for (const h of handlers.hover) h(id, x, y);
  }

  // ---- public API ----
  const api = {
    svg,
    resize() {
      W = host.clientWidth || W; H = host.clientHeight || H;
      fitProjection();
      drawAll();
      if (atFit) { view = fitView(); applyView(); }
    },
    // A card opened or closed (or the chrome moved). At the fit: glide to the new fit. Zoomed by
    // hand: keep the zoom, and only if the selected store is now covered, pan it into view.
    setPadding(p, animate = true) {
      pad = { ...pad, ...p };
      if (atFit) { animateTo(fitView(), animate ? 480 : 0); return; }
      const s = selected && byId.get(selected);
      if (s && !api.inFreeArea(selected)) {
        const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
        animateTo(clampView({ k: view.k, x: cx - s._x * view.k, y: cy - s._y * view.k }), animate ? 480 : 0);
      } else applyView();
    },
    reset() { atFit = true; animateTo(fitView()); },
    // centre a location in the free area; k is a multiple of the fit scale
    zoomTo(id, kRel = 4) {
      const s = byId.get(id);
      if (!s || s._x == null) return;
      const k = Math.min(K_MAX, fitView().k * kRel);
      const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
      atFit = false;
      animateTo(clampView({ k, x: cx - s._x * k, y: cy - s._y * k }), 650);
    },
    inFreeArea(id) {
      const s = byId.get(id);
      if (!s || s._x == null) return true;
      const x = s._x * view.k + view.x, y = s._y * view.k + view.y;
      return x > pad.left + 16 && x < W - pad.right - 16 && y > pad.top + 16 && y < H - pad.bottom - 16;
    },
    // colors: Map id -> { fill, t, empty, hatched }; t (0..1) is the strength of the signal
    setColors(colors) { lastColors = colors; applyColors(colors); applyView(); },
    setSelected(id) { selected = id; applySelected(id); applyView(); },
    setOwn(ids) { ownIds = new Set(ids || []); applyOwn(ownIds); applyView(); },
    // tags: [{ id, text, sub, color, kind }] in priority order
    setTags(list) { tags = list || []; drawTags(); },
    setLabels(on) { labelsOn = on; drawLabels(); },
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
