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
  let pad = { left: 24, right: 24, top: 70, bottom: 60 };
  let view = { k: 1, x: 0, y: 0 };
  let selected = null, hovered = null;
  const byId = new Map(stores.map((s) => [s.id, s]));
  const dotEls = new Map();
  const ringEls = new Map();
  const handlers = { hover: [], click: [], background: [], move: [] };

  function fitProjection() {
    projection.fitExtent([[pad.left, pad.top], [W - pad.right, H - pad.bottom]], fitFeature);
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
    applyView();
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
    const bx = [pad.left * v.k + v.x, (W - pad.right) * v.k + v.x];
    const by = [pad.top * v.k + v.y, (H - pad.bottom) * v.k + v.y];
    const m = 120;
    if (bx[1] < m) v.x += m - bx[1]; if (bx[0] > W - m) v.x -= bx[0] - (W - m);
    if (by[1] < m) v.y += m - by[1]; if (by[0] > H - m) v.y -= by[0] - (H - m);
    return v;
  }

  // ---- pointer handling ----
  const pointers = new Map();
  let drag = null, pinch = null, lastTap = 0;
  svg.addEventListener('pointerdown', (e) => {
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
      applyView();
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) { view = clampView({ k: view.k, x: drag.vx + dx, y: drag.vy + dy }); applyView(); }
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
    const k = Math.max(K_MIN, Math.min(K_MAX, view.k * factor));
    const f = k / view.k;
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
    },
    setPadding(p, animate = true) {
      pad = { ...pad, ...p };
      fitProjection();
      // redraw geometry under the new projection; keep the current zoom level
      const keep = view.k > 1.05 ? { ...view } : { k: 1, x: 0, y: 0 };
      drawAll();
      animateTo(keep.k > 1.05 ? clampView(keep) : { k: 1, x: 0, y: 0 }, animate ? 420 : 0);
    },
    reset() { animateTo({ k: 1, x: 0, y: 0 }); },
    zoomTo(id, k = 5) {
      const s = byId.get(id);
      if (!s || s._x == null) return;
      // put the store at the center of the free area
      const cx = pad.left + (W - pad.left - pad.right) / 2, cy = pad.top + (H - pad.top - pad.bottom) / 2;
      animateTo(clampView({ k, x: cx - s._x * k, y: cy - s._y * k }), 600);
    },
    // colors: Map id -> { fill, empty, hatched } ; stores not in the map are drawn empty
    setColors(colors) {
      for (const [id, c] of dotEls) {
        const v = colors && colors.get(id);
        if (!v || v.empty) { c.classList.add('empty'); c.classList.remove('hatch'); c.style.fill = ''; }
        else if (v.hatched) { c.classList.remove('empty'); c.classList.add('hatch'); c.style.fill = ''; }
        else { c.classList.remove('empty', 'hatch'); c.style.fill = v.fill; }
      }
    },
    setDim(ids) {
      for (const [id, c] of dotEls) c.classList.toggle('dim', !!ids && !ids.has(id));
    },
    setSelected(id) {
      if (selected && dotEls.get(selected)) dotEls.get(selected).classList.remove('sel');
      selected = id;
      layers.halo.innerHTML = '';
      const c = id && dotEls.get(id);
      if (c) {
        c.classList.add('sel');
        c.parentNode.appendChild(c);
        el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: DOT_R + 7, class: 'halo' }, layers.halo);
      }
      applyView();
    },
    setOwn(ids) {
      layers.rings.innerHTML = '';
      ringEls.clear();
      for (const id of ids || []) {
        const c = dotEls.get(id);
        if (!c) continue;
        ringEls.set(id, el('circle', { cx: c.getAttribute('cx'), cy: c.getAttribute('cy'), r: DOT_R + 3, class: 'ring' }, layers.rings));
      }
      applyView();
    },
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
  return api;
}
