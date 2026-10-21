// The stage: an SVG map of the city drawn from the committed geometry, one dot per store,
// pan and zoom by hand (wheel, drag, pinch, double-click), and an API the app drives:
// colors, selection, dimming, own-price rings, fit with side padding. No tiles, no library
// beyond d3-geo for the projection and the paths.

import { geoMercator, geoPath, geoCentroid } from 'd3-geo';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_R = 5.5;
const K_MIN = 1, K_MAX = 14;

function el(name, attrs = {}, parent) {
  const e = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function createMap(host, geo, stores, { motion = () => true } = {}) {
  const svg = el('svg', { role: 'img', 'aria-label': 'Mapa' }, host);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'hatch', patternUnits: 'userSpaceOnUse', width: 4, height: 4, patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 4, height: 4, fill: 'rgba(255,255,255,0.06)' }, pat);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 4, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2 }, pat);
  const bg = el('rect', { class: 'bg', width: '100%', height: '100%', fill: 'transparent' }, svg);
  const world = el('g', { class: 'world' }, svg);
  const layers = {};
  for (const name of ['zmvm', 'alcaldias', 'green', 'water', 'airport', 'roads', 'labels', 'rings', 'dots', 'halo']) layers[name] = el('g', { class: `L-${name}` }, world);

  let W = host.clientWidth || 800, H = host.clientHeight || 600;
  const projection = geoMercator();
  const path = geoPath(projection);
  const fitFeature = geo.alcaldias && geo.alcaldias.features.length ? geo.alcaldias : geo.zmvm;
  const BASE_PAD = 24;
  let pad = { left: 24, right: 24, top: 70, bottom: 60 };
  let view = { k: 1, x: 0, y: 0 };
  let atFit = true; // false once the reader zooms or pans by hand
  let selected = null, hovered = null;
  let lastColors = null, ownIds = new Set();
  const byId = new Map(stores.map((s) => [s.id, s]));
  const dotEls = new Map();
  const ringEls = new Map();
  const handlers = { hover: [], click: [], background: [], move: [] };

  // The projection is fitted once to the whole viewport with a small margin; a padding change
  // (a card opening on one side) becomes a view transform, so the geometry glides instead of
  // being redrawn, and the reader's own zoom survives.
  function fitProjection() {
    projection.fitExtent([[BASE_PAD, BASE_PAD], [W - BASE_PAD, H - BASE_PAD]], fitFeature);
  }
  function fitView(p = pad) {
    const b = path.bounds(fitFeature);
    const bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
    const boxW = Math.max(100, W - p.left - p.right), boxH = Math.max(100, H - p.top - p.bottom);
    const k = Math.min(boxW / bw, boxH / bh, 1);
    const cx = p.left + boxW / 2, cy = p.top + boxH / 2;
    return { k, x: cx - (b[0][0] + bw / 2) * k, y: cy - (b[0][1] + bh / 2) * k };
  }

  function drawPolys(layer, fc, cls) {
    layer.innerHTML = '';
    if (!fc || !fc.features) return;
    for (const f of fc.features) {
      const d = path(f);
      if (!d) continue;
      const p = el('path', { d, class: cls }, layer);
      if (f.properties && f.properties.name) el('title', {}, p).textContent = f.properties.name;
    }
  }
  function drawRoads(layer, fc) {
    layer.innerHTML = '';
    if (!fc || !fc.features) return;
    for (const f of fc.features) {
      const d = path(f);
      if (!d) continue;
      const hw = /motorway|trunk|hw|highway/i.test(f.properties && f.properties.class || '');
      el('path', { d, class: `road${hw ? ' hw' : ''}` }, layer);
    }
  }
  function drawLabels(layer, fc) {
    layer.innerHTML = '';
    if (!fc || !fc.features) return;
    for (const f of fc.features) {
      const c = projection(geoCentroid(f));
      if (!c) continue;
      const tx = el('text', { x: c[0], y: c[1], class: 'alc-label' }, layer);
      tx.textContent = (f.properties && f.properties.name) || '';
    }
  }
  function drawDots() {
    layers.dots.innerHTML = '';
    layers.rings.innerHTML = '';
    dotEls.clear(); ringEls.clear();
    for (const s of stores) {
      if (s.lat == null || s.lon == null) continue;
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
    drawLabels(layers.labels, geo.alcaldias);
    drawDots();
    applyColors(lastColors);
    applyOwn(ownIds);
    applySelected(selected);
    applyView();
  }
  function applyColors(colors) {
    for (const [id, c] of dotEls) {
      const v = colors && colors.get(id);
      if (!v || v.empty) { c.classList.add('empty'); c.classList.remove('hatch'); c.style.fill = ''; }
      else if (v.hatched) { c.classList.remove('empty'); c.classList.add('hatch'); c.style.fill = ''; }
      else { c.classList.remove('empty', 'hatch'); c.style.fill = v.fill; }
    }
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
      c.parentNode.appendChild(c);
      el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: DOT_R + 7, class: 'halo' }, layers.halo);
    }
  }
  // Is this store's screen position inside the free (unpadded) area?
  function inFreeArea(s, v = view) {
    if (!s || s._x == null) return true;
    const x = s._x * v.k + v.x, y = s._y * v.k + v.y;
    return x > pad.left + 20 && x < W - pad.right - 20 && y > pad.top + 20 && y < H - pad.bottom - 20;
  }

  function applyView() {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    const r = DOT_R / Math.sqrt(view.k);
    layers.dots.setAttribute('stroke-width', 1 / view.k);
    for (const c of dotEls.values()) c.setAttribute('r', r);
    for (const [id, ring] of ringEls) { ring.setAttribute('r', r + 3 / view.k); ring.setAttribute('stroke-width', 2 / view.k); }
    const halo = layers.halo.firstChild;
    if (halo) { halo.setAttribute('r', r + 7 / view.k); halo.setAttribute('stroke-width', 1 / view.k); }
    layers.labels.style.opacity = view.k > 4 ? 0 : 1;
    layers.labels.setAttribute('transform', '');
    for (const t of layers.labels.children) t.setAttribute('font-size', 11 / view.k);
    for (const h of handlers.move) h();
  }

  // ---- animation on the wall clock (the pane throttles frames; never accumulate deltas) ----
  let anim = null;
  function animateTo(target, ms = 520) {
    if (anim) cancelAnimationFrame(anim.raf);
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
    // keep the fitted extent at least partly on screen
    const b = path.bounds(fitFeature);
    const bx = [b[0][0] * v.k + v.x, b[1][0] * v.k + v.x];
    const by = [b[0][1] * v.k + v.y, b[1][1] * v.k + v.y];
    const m = 120;
    if (bx[1] < m) v.x += m - bx[1]; if (bx[0] > W - m) v.x -= bx[0] - (W - m);
    if (by[1] < m) v.y += m - by[1]; if (by[0] > H - m) v.y -= by[0] - (H - m);
    return v;
  }

  // ---- pointer handling ----
  const pointers = new Map();
  let drag = null, pinch = null, lastTap = 0;
  svg.addEventListener('pointerdown', (e) => {
    if (anim) { cancelAnimationFrame(anim.raf); anim = null; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.setPointerCapture(e.pointerId);
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, target: e.target };
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
      const k = Math.max(K_MIN, Math.min(K_MAX, pinch.k * (d / pinch.d)));
      const cx = pinch.cx - rect.left, cy = pinch.cy - rect.top;
      const ncx = (a.x + b.x) / 2 - rect.left, ncy = (a.y + b.y) / 2 - rect.top;
      view = clampView({ k, x: ncx - (cx - pinch.vx) * (k / pinch.k), y: ncy - (cy - pinch.vy) * (k / pinch.k) });
      atFit = false;
      applyView();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { view = clampView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy }); atFit = false; applyView(); }
      return;
    }
    const id = e.target && e.target.classList && e.target.classList.contains('dot') ? e.target.getAttribute('data-id') : null;
    setHover(id, e.clientX - rect.left, e.clientY - rect.top);
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && e.type === 'pointerup') {
      if (!drag.moved) {
        const t = drag.target;
        if (t && t.classList && t.classList.contains('dot')) {
          for (const h of handlers.click) h(t.getAttribute('data-id'));
        } else {
          const now = performance.now();
          if (now - lastTap < 320) zoomAt(e.clientX, e.clientY, 1.8); else for (const h of handlers.background) h();
          lastTap = now;
        }
      }
      drag = null;
    }
    if (pointers.size === 0) drag = null;
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('pointerleave', () => { if (!drag) setHover(null); });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
    zoomAt(e.clientX, e.clientY, f, 0);
  }, { passive: false });

  function zoomAt(clientX, clientY, factor, ms = 260) {
    const rect = host.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const fit = fitView();
    const k = Math.max(fit.k, Math.min(K_MAX, view.k * factor));
    const f = k / view.k;
    atFit = false;
    animateTo(clampView({ k, x: px - (px - view.x) * f, y: py - (py - view.y) * f }), ms);
  }

  function setHover(id, x, y) {
    if (hovered === id) { if (id) for (const h of handlers.hover) h(id, x, y); return; }
    if (hovered && dotEls.get(hovered)) dotEls.get(hovered).classList.remove('hover');
    hovered = id;
    if (id && dotEls.get(id)) { dotEls.get(id).classList.add('hover'); dotEls.get(id).parentNode.appendChild(dotEls.get(id)); }
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
    // A card opened or closed. At the fit: glide to the new fit. Zoomed by hand: keep the
    // zoom, and only if the selected store is now under the card, pan it into the free area.
    setPadding(p, animate = true) {
      pad = { ...pad, ...p };
      const fit = fitView();
      if (atFit) { animateTo(fit, animate ? 480 : 0); return; }
      const s = selected && byId.get(selected);
      if (s && !inFreeArea(s)) {
        const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
        animateTo(clampView({ k: view.k, x: cx - s._x * view.k, y: cy - s._y * view.k }), animate ? 480 : 0);
      }
    },
    reset() { atFit = true; animateTo(fitView()); },
    zoomTo(id, k = 5) {
      const s = byId.get(id);
      if (!s || s._x == null) return;
      // put the store at the center of the free area
      const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
      atFit = false;
      animateTo(clampView({ k, x: cx - s._x * k, y: cy - s._y * k }), 600);
    },
    // colors: Map id -> { fill, empty, hatched } ; stores not in the map are drawn empty
    setColors(colors) { lastColors = colors; applyColors(colors); },
    setDim(ids) {
      for (const [id, c] of dotEls) c.classList.toggle('dim', !!ids && !ids.has(id));
    },
    setSelected(id) { selected = id; applySelected(id); applyView(); },
    setOwn(ids) { ownIds = new Set(ids || []); applyOwn(ownIds); applyView(); },
    isAtFit() { return atFit; },
    setLabels(on) { layers.labels.style.display = on ? '' : 'none'; },
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
