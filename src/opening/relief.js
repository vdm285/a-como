// The opening (Relieve): the city as a landscape of price columns, in three.js. Ported from the
// demo the owner chose (docs/portfolio/relieve.html, which passed an adversarial review); the
// behaviour, look and timing are the demo's. What changed for the app: no globals (three, d3-geo
// and lit are imported), the data and the geometry are arguments, every visible word comes from
// strings.js in the reader's language, data reaches the DOM only through lit or textContent, an
// "Explorar el mapa" button (and Escape) hands the reader to the 2D map through onExplore, and
// destroy() takes everything down (the frame loop, every listener, the GL resources, the DOM).
//
// mountRelief(host, { demo, geo, lang, motion, onExplore }) → { destroy() }
//   host: an empty element, already position: fixed; inset: 0 above the app.
//   demo: public/data/qqp/opening.json (tools/portfolio-data.mjs --json): stores, jitomate,
//         tortilla, stories, partialWeeks, recent, credit.
//   geo:  public/data/geo/cdmx.json (alcaldias, zmvm, roads).
//   motion: false shows the end state, still, with a replay button.
import * as THREE from 'three';
import { geoMercator } from 'd3-geo';
import { html, svg, render, nothing } from 'lit';
import { STRINGS } from './strings.js';
import './relief.css';

let mounts = 0;

const ICON_SKIP = svg`<path d="M4 3l5 5-5 5M10 3v10"></path>`;
const ICON_REPLAY = svg`<path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5V6H6"></path>`;
const ICON_ARROW = svg`<path d="M3 8h10M9 4l4 4-4 4"></path>`;
const ICON_PLAY = svg`<path d="M4 2.5v11l9.5-5.5z" fill="currentColor"></path>`;
const ICON_PAUSE = svg`<path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"></path>`;
const ICON_PREV = svg`<path d="M10 3L5 8l5 5"></path>`;
const ICON_NEXT = svg`<path d="M6 3l5 5-5 5"></path>`;

export async function mountRelief(host, { demo, geo, lang = 'es', motion = true, onExplore } = {}) {
  const LANG = STRINGS[lang] ? lang : 'es';
  const T = STRINGS[LANG];
  const uid = `rv${++mounts}`;
  const ac = new AbortController();
  const on = (target, type, fn, opts) => target.addEventListener(type, fn, { ...(opts || {}), signal: ac.signal });
  let raf = 0, dead = false;
  let renderer = null, scene = null;
  const loose = []; // geometries cloned from, never added to the scene
  const prevColorManagement = THREE.ColorManagement.enabled;

  const explore = () => { if (!dead && typeof onExplore === 'function') onExplore(); };

  function destroy() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    ac.abort();
    if (scene) {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const m = o.material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
      });
      scene.clear();
    }
    for (const g of loose) g.dispose();
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    renderer = null; scene = null;
    THREE.ColorManagement.enabled = prevColorManagement;
    host.replaceChildren();
    host.classList.remove('relief', 'rv-still', 'rv-tipopen');
    host.style.removeProperty('--dock-b');
    host.style.removeProperty('--story-b');
    host.removeAttribute('lang');
  }

  // ---------------------------------------------------------------- words
  const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m)) : String(s));
  // **...** in a string is a bold run; values are filled per run and reach the DOM as text
  const rich = (s, v) => String(s).split('**').map((seg, k) => (k % 2 ? html`<b>${fill(seg, v)}</b>` : fill(seg, v)));
  const MES = T.months;
  const ymd = (iso) => iso.split('-').map(Number);
  const fDate = (iso) => { const [y, m, d] = ymd(iso); return fill(T.date, { d, m: MES[m - 1], y }); };
  const fDay = (iso) => { const [, m, d] = ymd(iso); return fill(T.day, { d, m: MES[m - 1] }); };
  const fRange = (a, b) => {
    const [ya, ma, da] = ymd(a), [yb, mb, db] = ymd(b);
    if (ya === yb && ma === mb) return fill(T.rangeMonth, { d1: da, d2: db, m: MES[mb - 1], y: yb });
    if (ya === yb) return fill(T.rangeYear, { d1: da, m1: MES[ma - 1], d2: db, m2: MES[mb - 1], y: yb });
    return fill(T.rangeFull, { a: fDate(a), b: fDate(b) });
  };
  const money = (v) => '$' + v.toLocaleString(T.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (x) => fill(T.pct, { v: Math.round(Math.abs(x) * 100) });
  const nStores = (n) => fill(n === 1 ? T.stores_1 : T.stores_n, { n });
  const kindName = (k) => T[`kind_${k}`] || k;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const median = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const quant = (a, p) => { const v = a.slice().sort((x, y) => x - y); return v[Math.floor(p * (v.length - 1))]; };

  // ---------------------------------------------------------------- the page (static; data goes in through lit or textContent)
  host.classList.add('relief');
  if (!motion) host.classList.add('rv-still');
  host.setAttribute('lang', LANG);
  const root = document.createElement('div');
  root.className = 'rv-root';
  host.appendChild(root);
  const exploreLabel = html`${T.explore}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_ARROW}</svg>`;
  render(html`
    <div class="rv-stage" data-k="stage" role="img" aria-label=${T.stageLabel}><canvas class="rv-gl" data-k="gl"></canvas><canvas class="rv-flat" data-k="flat" hidden></canvas></div>
    <div class="rv-scrim rv-l"></div><div class="rv-scrim rv-t"></div><div class="rv-scrim rv-b"></div>
    <div class="rv-reflab" data-k="reflab"><i></i><span class="rv-rl"><span>${T.refLabel}</span><b data-k="reflabv"></b></span></div>
    <header class="rv-hero" data-k="hero">
      <div class="rv-head"><span class="rv-brand">${T.brand}</span><h1 class="rv-h1" data-k="pname"></h1></div>
      <div class="rv-pres" data-k="pres"></div>
      <div class="rv-bignum" data-k="bignum"><span class="rv-big rv-num" data-k="big"></span><span class="rv-bigcap">${T.bigcap}</span></div>
      <div class="rv-wk" data-k="wk"><span data-k="wkl"></span><span class="rv-n rv-num" data-k="wkn"></span><span class="rv-chip" data-k="chip" hidden></span></div>
      <section class="rv-story" data-k="story" aria-live="polite"></section>
    </header>
    <div class="rv-caption" data-k="cap" aria-live="polite"></div>
    <div class="rv-topbar" data-k="topbar">
      <button class="rv-pill" data-k="skip" type="button">${T.skip} <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_SKIP}</svg></button>
      <button class="rv-pill" data-k="replay" type="button" hidden><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_REPLAY}</svg>${T.replay}</button>
      <button class="rv-explore rv-explore-top" data-k="explore" type="button">${exploreLabel}</button>
    </div>
    <div class="rv-hint" data-k="hint"></div>
    <div class="rv-side" data-k="side">
      <aside class="rv-legend" data-k="legend" aria-label=${T.legendLabel}></aside>
      <div class="rv-nogl-m" data-k="nogl2" hidden></div>
      <button class="rv-explore rv-explore-bot" data-k="explore2" type="button">${exploreLabel}</button>
      <div class="rv-credit" data-k="credit"></div>
    </div>
    <div class="rv-dock" data-k="dock">
      <div class="rv-row">
        <button class="rv-play" data-k="play" type="button" aria-label=${T.play}><svg data-k="playi" viewBox="0 0 16 16" aria-hidden="true"></svg></button>
        <div class="rv-seg" role="group" aria-label=${T.product}><button type="button" data-k="bj" aria-pressed="true"></button><button type="button" data-k="bt" aria-pressed="false"></button></div>
        <div class="rv-wkctl">
          <button class="rv-step" data-k="prev" type="button" aria-label=${T.prevWeek}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PREV}</svg></button>
          <span class="rv-wkd rv-num"><span data-k="wkd" class="rv-wl"></span><span data-k="wkds" class="rv-ws"></span></span>
          <button class="rv-step" data-k="next" type="button" aria-label=${T.nextWeek}><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_NEXT}</svg></button>
        </div>
      </div>
      <div class="rv-scrub" data-k="scrub"><svg data-k="spark" aria-hidden="true"></svg><input data-k="range" type="range" min="0" max="1" step="1" value="0" aria-label=${T.week}><div class="rv-months" data-k="months"></div></div>
      <div class="rv-legend-m" data-k="legendm"></div>
    </div>
    <div class="rv-tip" data-k="tip" hidden></div>
    <div class="rv-nogl" data-k="nogl" hidden></div>
  `, root);
  const $ = {};
  root.querySelectorAll('[data-k]').forEach((n) => { $[n.dataset.k] = n; });
  on($.explore, 'click', explore);
  on($.explore2, 'click', explore);

  const D = demo;
  const ok = D && Array.isArray(D.stores) && D.stores.length && D.jitomate && D.tortilla && D.stories && D.stories.jitomate && D.stories.tortillaKinds && D.recent;
  if (!ok) {
    // no data: say so, keep the way out
    $.nogl.hidden = false; $.nogl.textContent = T.loadFail;
    $.nogl2.hidden = false; $.nogl2.textContent = T.loadFail;
    for (const k of ['stage', 'reflab', 'hero', 'dock', 'legend', 'hint']) $[k].hidden = true;
    $.skip.hidden = true;
    on(window, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); explore(); } }, { capture: true });
    return { destroy };
  }

  // ---------------------------------------------------------------- colour (OKLab, cheaper → median grey → dearer, capped at ±50 %)
  const css = getComputedStyle(host);
  const tok = (n, fb) => css.getPropertyValue(n).trim() || fb;
  const REDUCED = !motion;
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const hex = (h, fb) => {
    let s = String(h || '').trim();
    if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s.slice(1).split('').map((c) => c + c).join('');
    if (!/^#[0-9a-f]{6}$/i.test(s)) s = fb;
    const n = parseInt(s.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  };
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
  function oklab(rgb) {
    const [r, g, b] = rgb.map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function rgbOf(lab) {
    const [L, a, b] = lab;
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((v) => clamp(toSrgb(clamp(v, 0, 1)), 0, 1));
  }
  const CSSC = { bg: tok('--bg', '#0c1118'), accent: tok('--accent', '#ece6d8'), mid: tok('--mid', '#5b616a') };
  const C = { bg: hex(CSSC.bg, '#0c1118'), ink: hex(tok('--ink'), '#f4f5f7'), cheap: hex(tok('--cheaper'), '#3987e5'), dear: hex(tok('--dearer'), '#e66767'), mid: hex(CSSC.mid, '#5b616a'), accent: hex(CSSC.accent, '#ece6d8'), dot: hex(tok('--dot'), '#8a919c') };
  const LCH = oklab(C.cheap), LMID = oklab(C.mid), LDEAR = oklab(C.dear);
  const LUTN = 257, LUT = new Float32Array(LUTN * 3);
  for (let j = 0; j < LUTN; j++) {
    const t = (j / (LUTN - 1)) * 2 - 1, to = t < 0 ? LCH : LDEAR, u = Math.abs(t);
    LUT.set(rgbOf([lerp(LMID[0], to[0], u), lerp(LMID[1], to[1], u), lerp(LMID[2], to[2], u)]), j * 3);
  }
  const CAP = 0.5;
  const lutAt = (d) => Math.round(((clamp(d / CAP, -1, 1) + 1) / 2) * (LUTN - 1)) * 3;
  const devCss = (d) => { const j = lutAt(d); return 'rgb(' + Math.round(LUT[j] * 255) + ',' + Math.round(LUT[j + 1] * 255) + ',' + Math.round(LUT[j + 2] * 255) + ')'; };
  // the same hue, lifted toward the ink so small text stays readable on glass
  const devInk = (d) => { const j = lutAt(d), m = (c) => Math.round((c + (C.ink[0] - c) * 0.42) * 255); return 'rgb(' + m(LUT[j]) + ',' + m(LUT[j + 1]) + ',' + m(LUT[j + 2]) + ')'; };
  const gradCss = () => { const s = []; for (let k = 0; k <= 10; k++) s.push(devCss((k / 10 - 0.5) * 2 * CAP)); return 'linear-gradient(90deg,' + s.join(',') + ')'; };

  // ---------------------------------------------------------------- data
  const N = D.stores.length;
  const partial = new Set(D.partialWeeks || []);
  function product(key, hTarget) {
    const P = D[key], W = P.weeks.length, arr = new Array(N).fill(null), ids = [];
    for (const k in P.prices) { const i = +k; if (i >= 0 && i < N) { arr[i] = P.prices[k]; ids.push(i); } }
    const med = [], n = [], all = [];
    for (let w = 0; w < W; w++) { const v = []; for (const i of ids) { const x = arr[i][w]; if (x != null) v.push(x); } med.push(median(v)); n.push(v.length); all.push(...v); }
    let last = W - 1; while (last > 0 && partial.has(P.weeks[last])) last--;
    const medMax = Math.max(...med.filter((x) => x != null));
    const k = hTarget / medMax;
    return { key, P, W, arr, ids, med, n, last, ref: P.ref, k, medMax, fitH: k * quant(all, 0.99), name: P.name };
  }
  const PROD = { jitomate: product('jitomate', 20), tortilla: product('tortilla', 11.5) };
  const PJ = PROD.jitomate, SJ = D.stories.jitomate, TK = D.stories.tortillaKinds;
  let peakIdx = PJ.P.weeks.indexOf(SJ.peakWeek), lastIdx = PJ.P.weeks.indexOf(SJ.lastWeek);
  if (peakIdx < 0) peakIdx = PJ.med.indexOf(PJ.medMax);
  if (lastIdx < 0) lastIdx = PJ.last;
  const peakStores = PJ.ids.filter((i) => PJ.arr[i][peakIdx] != null);
  const peakCap = peakStores.filter((i) => PJ.arr[i][peakIdx] / PJ.ref - 1 >= CAP - 1e-9).length;

  // ---------------------------------------------------------------- the plane: a Mercator fitted to the stores, 10 px = 1 world unit
  const proj = geoMercator().fitSize([1000, 1000], { type: 'MultiPoint', coordinates: D.stores.map((s) => [s[4], s[3]]) });
  const SPX = D.stores.map((s) => proj([s[4], s[3]]));
  const priced = [...new Set([...Object.keys(D.jitomate.prices), ...Object.keys(D.tortilla.prices)].map(Number))].filter((i) => i >= 0 && i < N);
  const PCX = median(priced.map((i) => SPX[i][0])), PCY = median(priced.map((i) => SPX[i][1])), UNIT = 10;
  const SX = new Float32Array(N), SZ = new Float32Array(N), DN = new Float32Array(N);
  for (let i = 0; i < N; i++) { SX[i] = (SPX[i][0] - PCX) / UNIT; SZ[i] = (SPX[i][1] - PCY) / UNIT; }
  const pd = priced.map((i) => Math.hypot(SX[i], SZ[i]));
  const R = quant(pd, 0.98), RFIT_WIDE = quant(pd, 0.9) * 1.04, RFIT_PHONE = quant(pd, 0.8) * 1.02; // the reveal's radius; the orbit's fitted radius
  let RFIT = RFIT_WIDE, PHONE = false;
  const RTOP_WIDE = quant(pd, 0.97); // tall columns at the back must stay in frame
  let RTOP = RTOP_WIDE;
  for (let i = 0; i < N; i++) DN[i] = Math.min(1, Math.hypot(SX[i], SZ[i]) / R);
  for (const k in PROD) {
    const pr = PROD[k];
    pr.cx = median(pr.ids.map((i) => SX[i])); pr.cz = median(pr.ids.map((i) => SZ[i]));
    pr.rd = quant(pr.ids.map((i) => Math.hypot(SX[i] - pr.cx, SZ[i] - pr.cz)), 0.9) * 1.1;
  }

  const toW = (lonlat) => { const p = proj(lonlat); return [(p[0] - PCX) / UNIT, (p[1] - PCY) / UNIT]; };
  function segs(fc) {
    const pos = [], dd = [];
    const ring = (cs) => { let p = null; for (const c of cs) { const q = toW(c), d = Math.min(1.25, Math.hypot(q[0], q[1]) / R); if (p) { pos.push(p[0], 0, p[1], q[0], 0, q[1]); dd.push(p[2], d); } p = [q[0], q[1], d]; } };
    for (const f of (fc && fc.features) || []) {
      const g = f.geometry; if (!g) continue;
      if (g.type === 'Polygon') g.coordinates.forEach(ring);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach(ring));
      else if (g.type === 'LineString') ring(g.coordinates);
      else if (g.type === 'MultiLineString') g.coordinates.forEach(ring);
    }
    return { pos: new Float32Array(pos), dd: new Float32Array(dd) };
  }
  const G = geo || {};
  const LINES = [
    { s: segs(G.zmvm), css: tok('--map-zm', 'rgba(255, 255, 255, 0.075)'), a: 0.075 },
    { s: segs(G.roads), css: tok('--map-road', 'rgba(255, 255, 255, 0.07)'), a: 0.07 },
    { s: segs(G.alcaldias), css: tok('--map-alc', 'rgba(255, 255, 255, 0.17)'), a: 0.17 },
  ];

  // ---------------------------------------------------------------- state
  const S = {
    mode: 'opening', fresh: true, t0: performance.now(),
    key: 'jitomate', week: lastIdx, labelWeek: -1, labelKey: '',
    playing: false, playFrom: 0, playT0: 0, playEnd: 0,
    tw: null, hover: -1, pinned: -1,
    camAz: 0, camEl: 40 * Math.PI / 180, autoT0: 0, manual: false, elTw: null, fitTw: null,
    refY: PJ.ref * PJ.k, refA: 0, ghostA: 0, gFrom: 0, gTo: 0, gT0: 0, snapGhost: 0, pulse: 0, reveal: 0, fitH: PJ.fitH, cursor: 0, hold: false, mouse: null,
    snapEl: 84 * Math.PI / 180, snapAz: -0.42,
    pl: [PJ.cx, PJ.cz, PJ.rd], ringS: 1,
  };
  let ringOn = false;
  const STEP = 0.55; // seconds per week when playing after the opening
  const OMEGA = REDUCED ? 0 : (2 * Math.PI) / 150; // one turn every 150 s
  const EL_LIVE = 40 * Math.PI / 180, EL_TOP = 84 * Math.PI / 180, EL_MIN = 18 * Math.PI / 180, EL_MAX = 78 * Math.PI / 180;
  const cur = { H: new Float32Array(N), P: new Float32Array(N), D: new Float32Array(N) };
  const tgt = { H: new Float32Array(N), P: new Float32Array(N), D: new Float32Array(N) };
  const snap = { H: new Float32Array(N), P: new Float32Array(N), D: new Float32Array(N) };
  const copy = (a, b) => { b.H.set(a.H); b.P.set(a.P); b.D.set(a.D); };

  // the state of one product at a (fractional) week: real values at integers, an eased tween between them
  function stateAt(pr, wf, out) {
    const a = clamp(Math.floor(wf), 0, pr.W - 1), b = Math.min(a + 1, pr.W - 1), f = wf - a;
    const e = f > 0 ? ease(clamp(f / 0.72, 0, 1)) : 0, k = pr.k, ref = pr.ref;
    for (let i = 0; i < N; i++) {
      const arr = pr.arr[i];
      if (!arr) { out.H[i] = 0; out.P[i] = 0; out.D[i] = 0; continue; }
      const va = arr[a], vb = arr[b];
      if (va != null && vb != null) { out.H[i] = lerp(va, vb, e) * k; out.P[i] = 1; out.D[i] = lerp(va / ref - 1, vb / ref - 1, e); }
      else if (va != null) { out.H[i] = va * k; out.P[i] = 1 - e; out.D[i] = va / ref - 1; }
      else if (vb != null) { out.H[i] = vb * k; out.P[i] = e; out.D[i] = vb / ref - 1; }
      else { out.H[i] = 0; out.P[i] = 0; out.D[i] = 0; }
    }
    return f > 0 ? a + e : a;
  }

  // ---------------------------------------------------------------- the opening, a pure function of wall-clock seconds
  const OP = (() => {
    const tRiseA = 1.2, tRiseB = 3.4, up = 0.6, hold = 2.2, down = 0.44;
    const tUpEnd = tRiseB + peakIdx * up, tHoldEnd = tUpEnd + hold, tLand = tHoldEnd + (lastIdx - peakIdx) * down;
    return { tRiseA, tRiseB, up, hold, down, tUpEnd, tHoldEnd, tLand, tEnd: tLand + 1.4 };
  })();
  const openingWeek = (t) => (t < OP.tRiseB ? 0 : t < OP.tUpEnd ? (t - OP.tRiseB) / OP.up : t < OP.tHoldEnd ? peakIdx : t < OP.tLand ? peakIdx + (t - OP.tHoldEnd) / OP.down : lastIdx);
  function openingEl(t) {
    let el = lerp(S.snapEl, EL_TOP, ease(clamp(t / 1.1, 0, 1)));
    el = lerp(el, 34 * Math.PI / 180, ease(clamp((t - 1.2) / 3.6, 0, 1)));
    el = lerp(el, 27 * Math.PI / 180, ease(clamp((t - (OP.tUpEnd - 2.2)) / 3.2, 0, 1)));
    el = lerp(el, EL_LIVE, ease(clamp((t - (OP.tHoldEnd + 0.6)) / (OP.tLand - OP.tHoldEnd), 0, 1)));
    return el;
  }
  const openingAz = (t) => S.snapAz + OMEGA * 1.6 * t;
  const capShare = () => (peakCap === peakStores.length ? fill(T.shareAll, { n: peakCap }) : fill(T.shareSome, { k: peakCap, n: peakStores.length }));
  const CAPTIONS = [
    [1.5, OP.tUpEnd - 0.2, () => fill(T.cap1, { name: PJ.name.toLowerCase() })],
    [OP.tUpEnd + 0.1, OP.tHoldEnd + 0.1, () => fill(T.cap2, { date: fDate(PJ.P.weeks[peakIdx]), w: PJ.W })],
    [OP.tHoldEnd + 0.3, OP.tHoldEnd + 3.1, () => fill(T.cap3, { share: capShare() })],
    [OP.tHoldEnd + 3.3, OP.tLand - 0.1, () => fill(T.cap4, { money: money(PJ.ref) })],
  ];

  // ---------------------------------------------------------------- DOM: text from the data
  // the credit is the data's own line; in English, the same line with the data's retrieval date
  const creditDate = /\d{4}-\d{2}-\d{2}/.exec(D.credit || '');
  $.credit.textContent = T.credit && creditDate ? fill(T.credit, { date: fDate(creditDate[0]) }) : (D.credit || '');
  $.bj.textContent = PROD.jitomate.name;
  $.bt.textContent = PROD.tortilla.name;
  const legendBar = gradCss();
  let webgl = true;
  function renderLegend() {
    const pr = PROD[S.key];
    const ghost = S.key === 'jitomate' && webgl;
    const ACC = CSSC.accent;
    const peakDate = PJ.P.weeks[peakIdx];
    render(html`
      <div class="rv-lt">${webgl ? T.legendTitleGL : T.legendTitle2D}</div>
      <div class="rv-bar" style=${'background:' + legendBar}></div>
      <div class="rv-ticks rv-num"><span>${T.tickLow}<small>${T.tickLowSub}</small></span><span>${money(pr.ref)}</span><span>${T.tickHigh}<small>${T.tickHighSub}</small></span></div>
      <div class="rv-li"><svg viewBox="0 0 22 14" aria-hidden="true">${webgl ? svg`<path d="M2 6v7M20 6v7M11 8.5v4.5" stroke=${ACC} stroke-opacity="0.45"></path>` : nothing}<ellipse cx="11" cy="5.5" rx="10" ry="3.6" fill=${ACC} fill-opacity="0.16" stroke=${ACC} stroke-opacity="0.75"></ellipse></svg><span>${fill(webgl ? T.legendPlaneGL : T.legendPlane2D, { money: money(pr.ref), range: fRange(D.recent.from, D.recent.to), stores: nStores(pr.P.n) })}</span></div>
      ${ghost ? html`<div class=${'rv-li rv-ring' + (ringOn ? '' : ' rv-off')}><svg viewBox="0 0 22 14" aria-hidden="true"><ellipse cx="11" cy="3" rx="6.5" ry="2.3" fill=${ACC} fill-opacity="0.12" stroke=${ACC} stroke-opacity="0.95"></ellipse><path d="M11 3v5.5" stroke=${ACC} stroke-opacity="0.55"></path><rect x="8.5" y="8.5" width="5" height="5" fill=${CSSC.mid}></rect></svg><span>${fill(T.legendRing, { date: fDate(peakDate) })}</span></div>` : nothing}
    `, $.legend);
    render(html`<span>${T.lmLow}</span><div class="rv-bar" style=${'background:' + legendBar}></div><span>${T.lmHigh}</span><div class="rv-lm2">${rich(webgl ? T.lmPlaneGL : T.lmPlane2D, { money: money(pr.ref) })}${ghost ? html`<span class=${'rv-lmr' + (ringOn ? '' : ' rv-off')}>${fill(T.lmRing, { day: fDay(peakDate) })}</span>` : nothing}</div>`, $.legendm);
    $.reflabv.textContent = money(pr.ref);
  }
  function renderStory() {
    const st = $.story;
    if (S.key === 'jitomate') {
      const chg = SJ.medianRatio - 1, sign = chg < 0 ? '−' : '+';
      render(html`
        <div class="rv-st-kick">${fill(T.jitoKick, { name: PJ.name, day: fDay(SJ.peakWeek), date: fDate(SJ.lastWeek) })}</div>
        <div class="rv-st-row"><span class=${'rv-st-num rv-num' + (chg < 0 ? ' rv-cheap' : '')}>${sign + pct(chg)}</span></div>
        <p class="rv-st-p">${rich(T.jitoP, { stores: nStores(SJ.matched), day: fDay(SJ.peakWeek), date: fDate(SJ.lastWeek), a: money(SJ.peakMedian), b: money(SJ.lastMedian) })}</p>
      `, st);
    } else {
      const t = TK.tortilleria, s = TK.super, ref = PROD.tortilla.ref;
      const kindBox = (k, label) => html`<div><div class="rv-v rv-num">${money(k.median)}</div><div class="rv-l"><span class="rv-sw" style=${'background:' + devCss(k.median / ref - 1)}></span>${fill(label, { n: k.n })}</div></div>`;
      render(html`
        <div class="rv-st-kick">${fill(T.tortKick, { name: PROD.tortilla.name, range: fRange(D.recent.from, D.recent.to) })}</div>
        <div class="rv-st-two">${t ? kindBox(t, T.tortAtTortilleria) : nothing}${s ? kindBox(s, T.tortAtSuper) : nothing}</div>
        <p class="rv-st-p">${fill(T.tortP, { day: fDay(D.recent.from), date: fDate(D.recent.to) })}</p>
      `, st);
    }
  }
  function renderProductText() {
    const pr = PROD[S.key];
    $.pname.textContent = pr.name;
    $.pres.textContent = pr.P.presentation || '';
    $.bj.setAttribute('aria-pressed', S.key === 'jitomate');
    $.bt.setAttribute('aria-pressed', S.key === 'tortilla');
    $.range.max = pr.W - 1;
    renderLegend(); renderStory(); drawSpark();
  }
  function setLabel(wk) {
    const pr = PROD[S.key];
    wk = clamp(wk, 0, pr.W - 1);
    if (wk === S.labelWeek && S.labelKey === S.key) return;
    S.labelWeek = wk; S.labelKey = S.key;
    const iso = pr.P.weeks[wk], m = pr.med[wk];
    $.big.textContent = m == null ? '—' : money(m);
    $.wkl.textContent = fill(T.weekOf, { date: fDate(iso) });
    $.wkn.textContent = fill(T.nStores, { stores: nStores(pr.n[wk]) });
    $.wkd.textContent = fDate(iso); $.wkds.textContent = fDay(iso);
    const chip = $.chip;
    if (partial.has(iso)) { chip.hidden = false; chip.className = 'rv-chip'; chip.textContent = T.chipPartial; }
    else if (S.key === 'jitomate' && wk === peakIdx) { chip.hidden = false; chip.className = 'rv-chip rv-hot'; chip.textContent = fill(T.chipPeak, { w: pr.W }); }
    else chip.hidden = true;
    const r = $.range; r.value = wk; r.setAttribute('aria-valuetext', fill(T.weekOf, { date: fDate(iso) }));
    $.prev.disabled = wk <= 0; $.next.disabled = wk >= pr.W - 1;
    if (S.pinned >= 0 || S.hover >= 0) tipContent();
  }

  // ---------------------------------------------------------------- sparkline of the weekly city medians
  let SPW = 300;
  const SPH = 42;
  const clipId = `${uid}-spc`;
  let spEls = null;
  const spX = (w) => { const pr = PROD[S.key]; return 8 + (w * (SPW - 16)) / Math.max(1, pr.W - 1); };
  const spY = (v) => { const pr = PROD[S.key]; const mx = Math.max(pr.medMax, pr.ref) * 1.1; return SPH - 5 - (v / mx) * (SPH - 12); };
  function drawSpark() {
    const pr = PROD[S.key];
    SPW = $.scrub.clientWidth || 300;
    let d = '', pen = false;
    pr.med.forEach((m, w) => { if (m == null) { pen = false; return; } d += (pen ? 'L' : 'M') + spX(w).toFixed(1) + ',' + spY(m).toFixed(1); pen = true; });
    const pts = [];
    pr.med.forEach((m, w) => { if (m != null) { const part = partial.has(pr.P.weeks[w]); pts.push(svg`<circle class=${part ? 'rv-sp-pt rv-part' : 'rv-sp-pt'} cx=${spX(w).toFixed(1)} cy=${spY(m).toFixed(1)} r=${part ? 2.2 : 1.6}></circle>`); } });
    const yr = spY(pr.ref).toFixed(1);
    render(svg`
      <defs><clipPath id=${clipId}><rect class="rv-spcr" x="0" y="-4" width="0" height=${SPH + 8}></rect></clipPath></defs>
      <line class="rv-sp-ref" x1="8" x2=${SPW - 8} y1=${yr} y2=${yr}></line>
      <path class="rv-sp-all" d=${d}></path><path class="rv-sp-done" d=${d} clip-path=${`url(#${clipId})`}></path>
      ${pts}
      <g class="rv-sp-cur"><line x1="0" x2="0" y1="0" y2=${SPH}></line><circle r="4.5" cx="0" cy="0"></circle></g>
    `, $.spark);
    const g = $.spark.querySelector('.rv-sp-cur');
    spEls = { line: g.querySelector('line'), dot: g.querySelector('circle'), clip: $.spark.querySelector('.rv-spcr') };
    const months = [];
    pr.P.weeks.forEach((iso, w) => { const m = ymd(iso)[1]; if (w > 0 && ymd(pr.P.weeks[w - 1])[1] === m) return; months.push(html`<span style=${'left:' + spX(w).toFixed(1) + 'px'}>${MES[m - 1]}</span>`); });
    render(months, $.months);
    moveCursor(S.cursor);
  }
  function moveCursor(wf) {
    const pr = PROD[S.key];
    wf = clamp(wf, 0, pr.W - 1);
    S.cursor = wf;
    const a = clamp(Math.floor(wf), 0, pr.W - 1), b = Math.min(a + 1, pr.W - 1), f = wf - a;
    const ma = pr.med[a], mb = pr.med[b];
    const y = ma == null ? SPH / 2 : spY(mb == null ? ma : lerp(ma, mb, f));
    const x = spX(wf);
    if (!spEls) return;
    spEls.line.setAttribute('x1', x); spEls.line.setAttribute('x2', x);
    spEls.dot.setAttribute('cx', x); spEls.dot.setAttribute('cy', y);
    spEls.clip.setAttribute('width', Math.max(0, x));
  }

  // ---------------------------------------------------------------- 3D (or the 2D fallback)
  const glCanvas = $.gl, flat = $.flat;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    webgl = !!gl;
    // the probe's context is let go at once (browsers cap live contexts)
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) { webgl = false; }
  let W = innerWidth, H = innerHeight, DPR = Math.min(2, devicePixelRatio || 1);
  const FREE = { l: 0, t: 0, r: 0, b: 0 };
  let camera, scratch, cols, rings, drops, pools, dots, plane, disc, stilts, foot, selRing, colMat, ringMat, dropMat, discMat, stiltMat;
  const lineMats = [];
  const FOV = 32;

  function buildGL() {
    THREE.ColorManagement.enabled = false;
    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(new THREE.Color(...C.bg), 1);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(FOV, W / H, 1, 4000);
    scratch = new THREE.PerspectiveCamera(FOV, W / H, 1, 4000);
    const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const fogU = () => ({ uFog0: { value: 100 }, uFog1: { value: 300 }, uBg: { value: v3(C.bg) } });

    // the map's lines, revealed outward from the centre on first load
    for (const Ln of LINES) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(Ln.s.pos, 3));
      g.setAttribute('aD', new THREE.BufferAttribute(Ln.s.dd, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: Object.assign({ uCol: { value: v3(C.ink) }, uA: { value: Ln.a }, uReveal: { value: 0 }, uFront: { value: 0.5 } }, fogU()),
        vertexShader: 'attribute float aD; uniform float uReveal; varying float vA; varying float vF; varying float vDepth;\nvoid main(){ float k = uReveal - aD; vA = clamp(k / 0.07, 0.0, 1.0); float q = k / 0.03; vF = exp(-q * q); vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 uCol; uniform float uA; uniform float uFront; uniform float uFog0; uniform float uFog1; uniform vec3 uBg; varying float vA; varying float vF; varying float vDepth;\nvoid main(){ float fog = smoothstep(uFog0, uFog1, vDepth); gl_FragColor = vec4(uCol, (uA * vA + vF * uFront) * (1.0 - fog * 0.55)); }',
      });
      const ls = new THREE.LineSegments(g, m); ls.renderOrder = 1; ls.frustumCulled = false;
      scene.add(ls); lineMats.push(m);
    }

    // a faint floor glow so the plane reads as ground
    {
      const g = new THREE.CircleGeometry(R * 1.5, 96).rotateX(-Math.PI / 2);
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uR: { value: R * 1.5 }, uCol: { value: v3(C.ink) } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uR; uniform vec3 uCol; varying vec2 vP; void main(){ float r = length(vP) / uR; float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); gl_FragColor = vec4(uCol, 0.035 * pow(max(0.0, 1.0 - r), 1.6) + (n - 0.5) * 0.008); }' });
      const mesh = new THREE.Mesh(g, m); mesh.position.y = -0.02; mesh.renderOrder = 0; scene.add(mesh);
    }

    // floor: a dot for every store PROFECO visits, and a pool of light under each priced column
    const quad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    loose.push(quad);
    const mkFloor = (frag, blending) => {
      const g = quad.clone();
      g.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
      g.setAttribute('aD', new THREE.InstancedBufferAttribute(DN.slice(), 1));
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending, uniforms: { uReveal: { value: 0 } },
        vertexShader: 'attribute float aA; attribute float aD; uniform float uReveal; varying vec2 vUv; varying vec3 vC; varying float vA;\nvoid main(){ vUv = uv; vC = instanceColor; vA = aA * clamp((uReveal - aD) / 0.07, 0.0, 1.0); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }',
        fragmentShader: frag });
      m.extensions = { derivatives: true };
      const mesh = new THREE.InstancedMesh(g, m, N);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      scene.add(mesh); return mesh;
    };
    pools = mkFloor('varying vec2 vUv; varying vec3 vC; varying float vA;\nvoid main(){ float r = length(vUv - 0.5) * 2.0; float a = pow(max(0.0, 1.0 - r), 2.2); gl_FragColor = vec4(vC, a * vA); }', THREE.AdditiveBlending);
    pools.renderOrder = 2;
    dots = mkFloor('varying vec2 vUv; varying vec3 vC; varying float vA;\nvoid main(){ float r = length(vUv - 0.5) * 2.0; float fw = fwidth(r); float a = 1.0 - smoothstep(1.0 - fw * 1.5, 1.0, r); gl_FragColor = vec4(vC, a * vA); }', THREE.NormalBlending);
    dots.renderOrder = 3;

    // the columns
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    loose.push(box);
    const cg = box.clone();
    cg.setAttribute('aHi', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    colMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uRefY: { value: 0 }, uRefA: { value: 0 }, uCollar: { value: v3(C.accent) } }, fogU()),
      vertexShader: 'attribute float aHi; varying vec3 vCol; varying vec3 vN; varying float vT; varying float vY; varying float vDepth; varying float vHi; varying vec3 vV;\nvoid main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vN = normal; vV = normalize(mat3(viewMatrix) * normal); vT = position.y; vY = wp.y; vCol = instanceColor; vHi = aHi; vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uBg; uniform vec3 uCollar; uniform float uRefY; uniform float uRefA; uniform float uFog0; uniform float uFog1; varying vec3 vCol; varying vec3 vN; varying float vT; varying float vY; varying float vDepth; varying float vHi; varying vec3 vV;\n' +
        'void main(){ vec3 L = normalize(vec3(-0.75, 0.2, 0.6)); float side = 0.5 + 0.5 * max(dot(normalize(vV), L), 0.0); float grad = mix(0.38, 1.0, pow(vT, 0.7)); vec3 c = vCol * side * grad;\n' +
        ' if (vN.y > 0.5) c = vCol * 1.1 + 0.06;\n' +
        ' float d = abs(vY - uRefY) / max(fwidth(vY), 1e-4); float collar = (1.0 - smoothstep(0.5, 1.4, d)) * uRefA * (1.0 - step(0.5, abs(vN.y)));\n' +
        ' c = mix(c, uCollar, collar * 0.8); c = mix(c, vec3(1.0), vHi * 0.38);\n' +
        ' float fog = smoothstep(uFog0, uFog1, vDepth); c = mix(c, uBg, fog * 0.6); gl_FragColor = vec4(c, 1.0); }',
    });
    colMat.extensions = { derivatives: true };
    cols = new THREE.InstancedMesh(cg, colMat, N);
    cols.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
    cols.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cols.frustumCulled = false; cols.renderOrder = 4;
    scene.add(cols);

    // the median plane: a hatched glass disc at the recent median's height, over the product's own forest,
    // on stilts down to its footprint so it reads as a level, not as a circle on the ground
    plane = new THREE.Group(); scene.add(plane);
    discMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uCol: { value: v3(C.accent) }, uA: { value: 0 }, uLW: { value: 1 } },
      vertexShader: 'varying vec2 vP; varying vec2 vW; void main(){ vP = position.xz; vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; uniform float uLW; varying vec2 vP; varying vec2 vW;\n' +
        'void main(){ float r = length(vP); float fr = max(fwidth(r), 1e-5);\n' +
        ' vec2 g = vW / 2.6; vec2 fg = max(fwidth(g), vec2(1e-5)); vec2 lg = (1.0 - smoothstep(fg * (uLW - 0.5), fg * (uLW + 0.5), abs(fract(g) - 0.5))) * (1.0 - smoothstep(vec2(0.1), vec2(0.28), fg)); float h = max(lg.x, lg.y);\n' +
        ' float edge = 1.0 - smoothstep(fr * (uLW - 0.5), fr * (uLW + 0.5), abs(1.0 - fr * (uLW + 0.6) - r));\n' +
        ' float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));\n' +
        ' float a = uA * ((0.8 + 0.2 * r * r) + h * 0.22 + edge * 3.4) + (n - 0.5) * 0.006 * step(0.001, uA);\n' +
        ' gl_FragColor = vec4(uCol, clamp(a, 0.0, 1.0)); }' });
    discMat.extensions = { derivatives: true };
    disc = new THREE.Mesh(new THREE.CircleGeometry(1, 180).rotateX(-Math.PI / 2), discMat); disc.renderOrder = 6; disc.frustumCulled = false; plane.add(disc);
    const sp = [];
    for (let j = 0; j < 20; j++) { const a = (j / 20) * Math.PI * 2 + 0.13; sp.push(Math.cos(a), 0, Math.sin(a), Math.cos(a), 1, Math.sin(a)); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    stiltMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uCol: { value: v3(C.accent) }, uA: { value: 0 } },
      vertexShader: 'varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vY; void main(){ gl_FragColor = vec4(uCol, uA * (0.1 + 0.9 * vY * vY)); }' });
    stilts = new THREE.LineSegments(sg, stiltMat); stilts.renderOrder = 5; stilts.frustumCulled = false; plane.add(stilts);
    const fp = []; for (let j = 0; j < 180; j++) { const a = (j / 180) * Math.PI * 2; fp.push(Math.cos(a), 0.03, Math.sin(a)); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    foot = new THREE.LineLoop(fg, new THREE.LineBasicMaterial({ color: new THREE.Color(...C.accent), transparent: true, opacity: 0, depthWrite: false }));
    foot.renderOrder = 5; foot.frustumCulled = false; plane.add(foot);

    // the rings: each store's price in the dearest week, a thin ring at that height with one line down to the column it has now
    const rq = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    rq.setAttribute('aA', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    ringMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: Object.assign({ uCol: { value: v3(C.accent) }, uPulse: { value: 0 }, uLW: { value: 1 } }, fogU()),
      vertexShader: 'attribute float aA; varying vec2 vUv; varying float vA; varying float vDepth;\nvoid main(){ vUv = uv; vA = aA; vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform float uPulse; uniform float uLW; uniform vec3 uBg; uniform float uFog0; uniform float uFog1; varying vec2 vUv; varying float vA; varying float vDepth;\n' +
        'void main(){ if (vA < 0.002) discard; float r = length(vUv - 0.5) * 2.0; float fw = max(fwidth(r), 1e-5);\n' +
        ' float ring = 1.0 - smoothstep(fw * (uLW - 0.5), fw * (uLW + 0.5), abs(r - 0.8));\n' +
        ' float fill = (1.0 - smoothstep(0.8 - fw, 0.8, r)) * (0.1 + 0.42 * uPulse);\n' +
        ' float a = max(ring * min(1.0, 0.74 + 0.5 * uPulse), fill) * vA; if (a < 0.003) discard;\n' +
        ' float fog = smoothstep(uFog0, uFog1, vDepth); vec3 c = mix(uCol, uBg, fog * 0.45) + uPulse * 0.2; gl_FragColor = vec4(c, a); }' });
    ringMat.extensions = { derivatives: true };
    rings = new THREE.InstancedMesh(rq, ringMat, N);
    rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage); rings.frustumCulled = false; rings.renderOrder = 8; scene.add(rings);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    dg.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(N * 2), 1).setUsage(THREE.DynamicDrawUsage));
    dropMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: Object.assign({ uCol: { value: v3(C.accent) } }, fogU()),
      vertexShader: 'attribute float aA; varying float vA; varying float vDepth;\nvoid main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uCol; uniform vec3 uBg; uniform float uFog0; uniform float uFog1; varying float vA; varying float vDepth;\nvoid main(){ if (vA < 0.002) discard; float fog = smoothstep(uFog0, uFog1, vDepth); gl_FragColor = vec4(mix(uCol, uBg, fog * 0.45), vA); }' });
    drops = new THREE.LineSegments(dg, dropMat); drops.renderOrder = 7; drops.frustumCulled = false; scene.add(drops);

    // the selected store's ring on the floor
    selRing = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(...C.accent), transparent: true, opacity: 0.95, depthWrite: false }));
    selRing.position.y = 0.05; selRing.visible = false; selRing.renderOrder = 9; scene.add(selRing);
  }

  // ---------------------------------------------------------------- framing: fit the orbit's cylinder into the free part of the screen
  const fitCache = new Map();
  const tmpV = new THREE.Vector3();
  function frameFor(el, fitH) {
    const key = Math.round(el * 400) + ':' + Math.round(fitH * 4);
    let f = fitCache.get(key); if (f) return f;
    const fw = FREE.r - FREE.l, fh = FREE.b - FREE.t;
    scratch.aspect = W / H; scratch.clearViewOffset(); scratch.updateProjectionMatrix();
    const pts = [];
    for (let j = 0; j < 36; j++) { const a = (j / 36) * Math.PI * 2; pts.push([Math.cos(a) * RFIT, 0, Math.sin(a) * RFIT], [Math.cos(a) * RTOP, fitH, Math.sin(a) * RTOP]); }
    const bbox = (d) => {
      scratch.position.set(0, d * Math.sin(el), d * Math.cos(el)); scratch.lookAt(0, 0, 0); scratch.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { tmpV.set(p[0], p[1], p[2]).project(scratch); const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 10, hi = 6000, best = null;
    for (let it = 0; it < 22; it++) { const d = (lo + hi) / 2, b = bbox(d); if (b.x1 - b.x0 <= fw && b.y1 - b.y0 <= fh) { hi = d; best = { d, b }; } else lo = d; }
    if (!best) best = { d: hi, b: bbox(hi) };
    f = { dist: best.d, offX: (best.b.x0 + best.b.x1) / 2 - (FREE.l + FREE.r) / 2, offY: (best.b.y0 + best.b.y1) / 2 - (FREE.t + FREE.b) / 2 };
    if (fitCache.size > 4000) fitCache.clear();
    fitCache.set(key, f); return f;
  }

  function layout() {
    if (dead) return;
    W = innerWidth; H = innerHeight; DPR = Math.min(2, devicePixelRatio || 1);
    const phone = W < 760;
    PHONE = phone; RFIT = phone ? RFIT_PHONE : RFIT_WIDE; RTOP = phone ? RFIT_PHONE * 1.05 : RTOP_WIDE;
    // (offsetTop/offsetHeight, not the bounding box: the entrance animation moves the boxes by a few px)
    if (phone) {
      const sb = parseFloat(getComputedStyle($.side).bottom) || 10;
      host.style.setProperty('--dock-b', Math.round($.side.offsetHeight + sb + 8) + 'px');
    } else host.style.removeProperty('--dock-b');
    const dockTop = $.dock.offsetTop;
    if (phone) host.style.setProperty('--story-b', Math.round(H - dockTop + 12) + 'px');
    else host.style.removeProperty('--story-b');
    const heroTop = $.hero.offsetTop;
    if (phone) {
      // the story/caption band sits above the dock: keep ~92 px for it, more when the story is
      // taller (at 360 px the story wraps to four lines and the plane's tag sat on its text)
      FREE.l = 4; FREE.r = W - 4; FREE.t = Math.max(heroTop + 108, 120);
      FREE.b = Math.min(dockTop - 104, dockTop - 20 - $.story.offsetHeight);
    } else {
      FREE.l = clamp(W * 0.27, 300, 470); FREE.r = W - 36; FREE.t = 30; FREE.b = dockTop - 14;
      if (!webgl) {
        // the no-WebGL notice sits under the top bar, centred on the map's free part, and the 2D map
        // is framed below it (centred on the window it covered the top bar at 1024 px and the map's top)
        const n = $.nogl, tb = $.topbar;
        n.style.left = Math.round((FREE.l + FREE.r) / 2) + 'px';
        n.style.top = Math.round(tb.offsetTop + tb.offsetHeight + 12) + 'px';
        n.style.maxWidth = Math.round(Math.min(560, FREE.r - FREE.l - 32)) + 'px';
        FREE.t = Math.max(FREE.t, n.offsetTop + n.offsetHeight + 12);
      }
    }
    fitCache.clear();
    if (renderer) {
      renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
    }
    if (!webgl) { flat.width = Math.round(W * DPR); flat.height = Math.round(H * DPR); }
    drawSpark();
  }

  // ---------------------------------------------------------------- per-frame: write the instances
  const RP = new Float32Array(N), RH = new Float32Array(N); // the jitomate's presence and heights, held while the tortilla is on screen
  function writeInstances() {
    const m = cols.instanceMatrix.array, c = cols.instanceColor.array, hi = cols.geometry.attributes.aHi.array;
    const pm = pools.instanceMatrix.array, pc = pools.instanceColor.array, pa = pools.geometry.attributes.aA.array;
    const dm = dots.instanceMatrix.array, dc = dots.instanceColor.array, da = dots.geometry.attributes.aA.array;
    const rm = rings.instanceMatrix.array, ra = rings.geometry.attributes.aA.array, dp = drops.geometry.attributes.position.array, dpa = drops.geometry.attributes.aA.array;
    const pr = PROD[S.key], CW = 1.0, sel = S.pinned >= 0 ? S.pinned : S.hover;
    m.fill(0); pm.fill(0); dm.fill(0); rm.fill(0); ra.fill(0); dpa.fill(0);
    for (let i = 0; i < N; i++) {
      const o = i * 16, w = CW * clamp(cur.P[i], 0, 1), h = Math.max(cur.H[i], 0.001), j = lutAt(cur.D[i]);
      m[o] = w; m[o + 5] = h; m[o + 10] = w; m[o + 12] = SX[i]; m[o + 14] = SZ[i]; m[o + 15] = 1;
      c[i * 3] = LUT[j]; c[i * 3 + 1] = LUT[j + 1]; c[i * 3 + 2] = LUT[j + 2];
      hi[i] = i === sel ? 1 : 0;
      const ps = 3.1 * clamp(cur.P[i], 0, 1);
      pm[o] = ps; pm[o + 5] = 1; pm[o + 10] = ps; pm[o + 12] = SX[i]; pm[o + 13] = 0.01; pm[o + 14] = SZ[i]; pm[o + 15] = 1;
      pc[i * 3] = LUT[j]; pc[i * 3 + 1] = LUT[j + 1]; pc[i * 3 + 2] = LUT[j + 2]; pa[i] = 0.34 * clamp(cur.P[i], 0, 1);
      const has = !!pr.arr[i];
      dm[o] = 0.46; dm[o + 5] = 1; dm[o + 10] = 0.46; dm[o + 12] = SX[i]; dm[o + 13] = 0.02; dm[o + 14] = SZ[i]; dm[o + 15] = 1;
      dc[i * 3] = C.dot[0]; dc[i * 3 + 1] = C.dot[1]; dc[i * 3 + 2] = C.dot[2]; da[i] = has ? 0.62 : 0.3;
    }
    // a ring only over a store priced both in the dearest week and in the week shown:
    // at the last full week these are exactly the story's matched stores
    if (S.key === 'jitomate') { RP.set(cur.P); RH.set(cur.H); }
    if (S.ghostA > 0.002) {
      const sc = 2.0 * S.ringS;
      for (const i of peakStores) {
        const a = S.ghostA * sstep(0.35, 0.9, RP[i]);
        if (a < 0.002) continue;
        const top = PJ.arr[i][peakIdx] * PJ.k, now = RH[i], o = i * 16;
        rm[o] = sc; rm[o + 5] = 1; rm[o + 10] = sc; rm[o + 12] = SX[i]; rm[o + 13] = top + 0.03; rm[o + 14] = SZ[i]; rm[o + 15] = 1; ra[i] = a;
        if (top - now > 0.25) { const q = i * 6; dp[q] = SX[i]; dp[q + 1] = top; dp[q + 2] = SZ[i]; dp[q + 3] = SX[i]; dp[q + 4] = now; dp[q + 5] = SZ[i]; dpa[i * 2] = a * 0.45; dpa[i * 2 + 1] = a * 0.08; }
      }
    }
    cols.instanceMatrix.needsUpdate = true; cols.instanceColor.needsUpdate = true; cols.geometry.attributes.aHi.needsUpdate = true;
    pools.instanceMatrix.needsUpdate = true; pools.instanceColor.needsUpdate = true; pools.geometry.attributes.aA.needsUpdate = true;
    dots.instanceMatrix.needsUpdate = true; dots.instanceColor.needsUpdate = true; dots.geometry.attributes.aA.needsUpdate = true;
    rings.instanceMatrix.needsUpdate = true; rings.geometry.attributes.aA.needsUpdate = true;
    drops.geometry.attributes.position.needsUpdate = true; drops.geometry.attributes.aA.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the 2D map, when WebGL is missing
  let fctx = null;
  const F2 = { s: 1, ox: 0, oy: 0 };
  function drawFlat() {
    const x = fctx; x.setTransform(DPR, 0, 0, DPR, 0, 0);
    x.fillStyle = CSSC.bg; x.fillRect(0, 0, W, H);
    F2.s = Math.min((FREE.r - FREE.l) / (2 * R), (FREE.b - FREE.t) / (2 * R)) * 0.98;
    F2.ox = (FREE.l + FREE.r) / 2; F2.oy = (FREE.t + FREE.b) / 2;
    const rv = S.reveal;
    for (const Ln of LINES) {
      x.strokeStyle = Ln.css; x.lineWidth = 1; x.beginPath();
      const p = Ln.s.pos, dd = Ln.s.dd;
      for (let j = 0, k = 0; j < p.length; j += 6, k += 2) { if (dd[k] > rv) continue; x.moveTo(F2.ox + p[j] * F2.s, F2.oy + p[j + 2] * F2.s); x.lineTo(F2.ox + p[j + 3] * F2.s, F2.oy + p[j + 5] * F2.s); }
      x.stroke();
    }
    const pr = PROD[S.key], sel = S.pinned >= 0 ? S.pinned : S.hover;
    for (let i = 0; i < N; i++) {
      if (DN[i] > rv) continue;
      const px = F2.ox + SX[i] * F2.s, py = F2.oy + SZ[i] * F2.s;
      if (!pr.arr[i] || cur.P[i] < 0.02) { x.fillStyle = pr.arr[i] ? 'rgba(138,145,156,0.6)' : 'rgba(138,145,156,0.3)'; x.beginPath(); x.arc(px, py, 1.5, 0, 7); x.fill(); continue; }
      x.globalAlpha = clamp(cur.P[i], 0, 1); x.fillStyle = devCss(cur.D[i]);
      x.beginPath(); x.arc(px, py, 2 + 4 * clamp(cur.H[i] / pr.fitH, 0, 1.4), 0, 7); x.fill(); x.globalAlpha = 1;
      if (i === sel) { x.strokeStyle = CSSC.accent; x.lineWidth = 2; x.beginPath(); x.arc(px, py, 9, 0, 7); x.stroke(); }
    }
  }

  // ---------------------------------------------------------------- picking
  function screenOf(x, y, z) {
    if (!webgl) return [F2.ox + x * F2.s, F2.oy + z * F2.s, 0];
    tmpV.set(x, y, z).project(camera); return [(tmpV.x + 1) / 2 * W, (1 - tmpV.y) / 2 * H, tmpV.z];
  }
  function segDist(px, py, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? clamp(((px - a[0]) * vx + (py - a[1]) * vy) / l2, 0, 1) : 0;
    return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
  }
  function pick(mx, my, touch) {
    const pr = PROD[S.key], thr = touch ? 20 : 10;
    let best = -1, bd = Infinity, bz = Infinity;
    for (const i of pr.ids) {
      const live = cur.P[i] > 0.3, a = screenOf(SX[i], 0, SZ[i]);
      const b = live && webgl ? screenOf(SX[i], cur.H[i], SZ[i]) : a;
      const d = segDist(mx, my, a, b) - (live ? 2 : 0);
      if (d > thr) continue;
      const z = Math.min(a[2], b[2]);
      if (d < bd - 3 || (Math.abs(d - bd) <= 3 && z < bz)) { best = i; bd = d; bz = z; }
    }
    return best;
  }

  // ---------------------------------------------------------------- tooltip
  const tip = $.tip;
  function tipContent() {
    const i = S.pinned >= 0 ? S.pinned : S.hover;
    host.classList.toggle('rv-tipopen', i >= 0);
    if (i < 0) { tip.hidden = true; return; }
    const pr = PROD[S.key], s = D.stores[i], wk = clamp(S.labelWeek, 0, pr.W - 1), iso = pr.P.weeks[wk];
    // the chain is left out when it only repeats the kind of store (PROFECO's chains are Spanish words)
    const kind = kindName(s[2]);
    const same = s[1] && [kind, STRINGS.es[`kind_${s[2]}`]].some((k) => k && s[1].toLowerCase() === k.toLowerCase());
    const chain = s[1] && !same ? s[1] + ' · ' : '';
    const v = pr.arr[i] ? pr.arr[i][wk] : null, lat = pr.P.latest[i];
    let price;
    if (v != null) {
      const d = v / pr.ref - 1;
      const dv = Math.abs(d) < 0.005 ? T.atMedian : fill(d < 0 ? T.below : T.above, { pct: pct(d) });
      price = html`<div class="rv-tpr"><b>${money(v)}</b><span>${T.perKilo}</span><span class="rv-tdv" style=${'color:' + devInk(d)}>${dv}</span></div><div class="rv-tm">${fill(T.weekOf, { date: fDate(iso) })}</div>`;
    } else price = html`<div class="rv-tpr"><span>${fill(T.noPrice, { date: fDate(iso) })}</span></div>`;
    render(html`<div class="rv-tn">${s[0]}</div><div class="rv-tm">${chain + kind}</div>${price}${lat ? html`<div class="rv-tlat">${rich(T.latest, { money: money(lat[0]), date: fDate(lat[1]) })}</div>` : nothing}`, tip);
    tip.hidden = false;
  }
  function placeTip() {
    const i = S.pinned >= 0 ? S.pinned : S.hover;
    if (i < 0 || tip.hidden) return;
    if (PHONE) { tip.classList.add('rv-sheet'); tip.style.transform = ''; return; }
    tip.classList.remove('rv-sheet');
    // beside the pointer (or the column), never over the column itself
    let ax, ay;
    if (S.pinned < 0 && S.mouse) { ax = S.mouse[0]; ay = S.mouse[1]; }
    else { const a = screenOf(SX[i], webgl && cur.P[i] > 0.3 ? cur.H[i] * 0.6 : 0, SZ[i]); ax = a[0]; ay = a[1]; }
    const tw = tip.offsetWidth, th = tip.offsetHeight, g = 16, gap = 20;
    let x, y = ay - th / 2;
    if (ax + gap + tw <= W - g) x = ax + gap;
    else if (ax - gap - tw >= g) x = ax - gap - tw;
    else { x = ax - tw / 2; y = ay - th - 28; if (y < g) y = ay + 28; }
    x = clamp(x, g, W - tw - g); y = clamp(y, g, H - th - g);
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  // while a store is under the pointer or pinned, the orbit holds still so it can be read
  function holdOrbit() {
    const now = performance.now(), want = S.mode === 'live' && (S.hover >= 0 || S.pinned >= 0);
    if (want === S.hold) return;
    if (want) { S.camAz = currentAz(now); S.hold = true; }
    else { S.hold = false; S.autoT0 = now + 1200; }
  }
  function setHover(i) { if (i === S.hover) return; S.hover = i; $.stage.classList.toggle('rv-over', i >= 0); tipContent(); holdOrbit(); }
  function setPinned(i) { S.pinned = i; tipContent(); holdOrbit(); }

  // ---------------------------------------------------------------- transitions in live mode
  function snapshotTween(dur) {
    copy(cur, snap);
    S.tw = { t0: performance.now(), dur: REDUCED ? 0 : dur, refFrom: S.refY, fitFrom: S.fitH, curFrom: S.cursor, plFrom: S.pl.slice() };
  }
  function setWeek(w, dur) {
    const pr = PROD[S.key]; w = clamp(Math.round(w), 0, pr.W - 1);
    stopPlay();
    if (w === S.week && !S.tw) { setLabel(w); return; }
    snapshotTween(dur == null ? 420 : dur); S.week = w; setLabel(w);
  }
  function setProduct(key) {
    if (key === S.key) return;
    endOpening(true);
    stopPlay();
    const from = PROD[S.key], to = PROD[key], iso = from.P.weeks[S.week];
    let w = to.P.weeks.indexOf(iso); if (w < 0) w = to.last;
    const curFrom = clamp((S.cursor / Math.max(1, from.W - 1)) * (to.W - 1), 0, to.W - 1);
    snapshotTween(1100); S.tw.curFrom = curFrom;
    S.key = key; S.week = w; S.cursor = w; S.labelWeek = -1;
    if (S.pinned >= 0 && !to.arr[S.pinned]) S.pinned = -1;
    S.hover = -1;
    renderProductText(); setLabel(w); tipContent();
  }
  function startPlay() {
    endOpening(true);
    const pr = PROD[S.key];
    let from = S.week; if (from >= pr.last) from = 0;
    if (S.tw) { S.tw = null; }
    S.playing = true; S.playFrom = from; S.playEnd = pr.last; S.playT0 = performance.now();
    if (from !== S.week) { S.week = from; }
    playIcon();
  }
  function stopPlay() { if (!S.playing) return; S.playing = false; S.week = S.labelWeek; snapshotTween(250); playIcon(); }
  function playIcon() { render(S.playing ? ICON_PAUSE : ICON_PLAY, $.playi); $.play.setAttribute('aria-label', S.playing ? T.pause : T.play); }

  function currentAz(now) { return S.camAz + (S.manual || S.hold ? 0 : OMEGA * Math.max(0, now - S.autoT0) / 1000); }
  // the contours fade on the wall clock, from wherever they are
  function ghostAt(now, target) {
    if (target !== S.gTo) { S.gFrom = S.ghostA; S.gTo = target; S.gT0 = now; }
    return REDUCED ? target : lerp(S.gFrom, S.gTo, ease(clamp((now - S.gT0) / 450, 0, 1)));
  }
  function currentEl(now) {
    if (!S.elTw) return S.camEl;
    const e = ease(clamp((now - S.elTw.t0) / S.elTw.dur, 0, 1));
    if (e >= 1) { S.elTw = null; return S.camEl; }
    return lerp(S.elTw.from, S.camEl, e);
  }
  let lastEl = EL_TOP, lastAz = 0, labPos = null;
  function endOpening(skipped) {
    if (S.mode !== 'opening') return;
    const now = performance.now();
    S.mode = 'live'; S.fresh = false;
    S.key = 'jitomate'; S.week = lastIdx;
    if (skipped) { snapshotTween(800); S.elTw = REDUCED ? null : { t0: now, dur: 1200, from: lastEl }; }
    S.camAz = lastAz; S.camEl = EL_LIVE; S.autoT0 = now; S.manual = false;
    S.reveal = 1.25; S.refA = 1; S.labelWeek = -1;
    setLabel(lastIdx);
    $.story.classList.add('rv-on'); $.cap.classList.remove('rv-on');
    $.bignum.classList.add('rv-on'); $.wk.classList.add('rv-on');
    $.skip.hidden = true; $.replay.hidden = false;
    $.hint.classList.add('rv-on');
    renderLegend();
  }
  function replay() {
    stopPlay();
    const now = performance.now();
    if (S.key !== 'jitomate') { S.key = 'jitomate'; renderProductText(); }
    copy(cur, snap);
    S.snapEl = lastEl; S.snapAz = lastAz; S.snapGhost = S.ghostA; S.tw = null; S.pinned = -1; S.hover = -1; S.hold = false; tipContent();
    S.mode = 'opening'; S.t0 = now; S.labelWeek = -1; S.fitH = PJ.fitH;
    $.story.classList.remove('rv-on'); $.skip.hidden = false; $.replay.hidden = true; $.hint.classList.remove('rv-on');
    renderLegend();
  }

  // ---------------------------------------------------------------- the frame
  let lastCap = -2;
  function frame() {
    if (dead) return;
    const now = performance.now();
    let az, el, labelWeek, cursorWF;
    if (S.mode === 'opening') {
      const t = (now - S.t0) / 1000;
      if (t >= OP.tEnd) { endOpening(false); }
      else {
        const wf = openingWeek(t);
        cursorWF = stateAt(PJ, wf, tgt);
        labelWeek = Math.ceil(wf - 1e-6);
        if (t < OP.tRiseB) {
          // from the snapshot (nothing on first load) to the first real week, rising outward from the centre
          for (let i = 0; i < N; i++) {
            const out = easeOut(clamp(t / 1.0, 0, 1));
            const r = easeOut(clamp((t - OP.tRiseA - DN[i] * 0.8) / 1.4, 0, 1));
            const hT = tgt.H[i] * r, pT = tgt.P[i] * clamp(r * 5, 0, 1);
            cur.H[i] = lerp(snap.H[i] * (1 - out), hT, r); cur.P[i] = Math.max(snap.P[i] * (1 - out), pT); cur.D[i] = r > 0 ? tgt.D[i] : snap.D[i];
          }
        } else copy(tgt, cur);
        S.reveal = S.fresh ? Math.max(0, (t - 0.1) / 1.6) * 1.25 : 1.25;
        S.refY = PJ.ref * PJ.k; S.fitH = PJ.fitH;
        S.refA = S.fresh ? sstep(2.2, 3.8, t) : 1;
        // the lock: at the dearest week the rings drop onto the column tops and flash
        const lk = t - (OP.tUpEnd - 0.05);
        S.ghostA = lk < 0 ? S.snapGhost * (1 - ease(clamp(t / 0.8, 0, 1))) : sstep(0, 0.3, lk);
        S.ringS = lk < 0 ? 1 : lerp(2.6, 1, easeOut(clamp(lk / 0.55, 0, 1)));
        S.gFrom = S.gTo = S.ghostA;
        S.pulse = Math.exp(-Math.pow((lk - 0.55) / 0.3, 2)) + 0.7 * Math.exp(-Math.pow((t - (OP.tLand + 0.35)) / 0.35, 2));
        S.pl = [PJ.cx, PJ.cz, PJ.rd];
        el = openingEl(t); az = openingAz(t);
        $.bignum.classList.toggle('rv-on', t >= OP.tRiseA); $.wk.classList.toggle('rv-on', t >= OP.tRiseA);
        let ci = -1; CAPTIONS.forEach((c, k) => { if (t >= c[0] && t < c[1]) ci = k; });
        if (ci !== lastCap) { lastCap = ci; const cap = $.cap; if (ci >= 0) { cap.textContent = CAPTIONS[ci][2](); cap.classList.add('rv-on'); } else cap.classList.remove('rv-on'); }
        if (t >= OP.tLand) $.story.classList.add('rv-on');
        if (t >= OP.tRiseA) setLabel(labelWeek);
        lastEl = el; lastAz = az;
      }
    }
    if (S.mode === 'live') {
      const pr = PROD[S.key];
      if (S.playing) {
        const wf = Math.min(S.playEnd, S.playFrom + (now - S.playT0) / 1000 / STEP);
        cursorWF = stateAt(pr, wf, cur); labelWeek = Math.ceil(wf - 1e-6);
        S.refY = pr.ref * pr.k; S.fitH = pr.fitH; S.pl = [pr.cx, pr.cz, pr.rd];
        if (wf >= S.playEnd) { S.playing = false; S.week = S.playEnd; playIcon(); }
      } else {
        stateAt(pr, S.week, tgt); labelWeek = S.week;
        if (S.tw) {
          const e = S.tw.dur > 0 ? ease(clamp((now - S.tw.t0) / S.tw.dur, 0, 1)) : 1;
          for (let i = 0; i < N; i++) {
            let fp = snap.P[i] < 0.01 ? 0 : snap.P[i], tp = tgt.P[i], fh = snap.H[i], th = tgt.H[i], fd = snap.D[i], td = tgt.D[i];
            if (tp === 0) { th = fh; td = fd; }
            if (fp === 0) { fh = th; fd = td; }
            cur.H[i] = lerp(fh, th, e); cur.P[i] = lerp(fp, tp, e); cur.D[i] = lerp(fd, td, e);
          }
          S.refY = lerp(S.tw.refFrom, pr.ref * pr.k, e); S.fitH = lerp(S.tw.fitFrom, pr.fitH, e);
          const pf = S.tw.plFrom || [pr.cx, pr.cz, pr.rd]; S.pl = [lerp(pf[0], pr.cx, e), lerp(pf[1], pr.cz, e), lerp(pf[2], pr.rd, e)];
          cursorWF = lerp(S.tw.curFrom, S.week, e);
          if (e >= 1) S.tw = null;
        } else { copy(tgt, cur); S.refY = pr.ref * pr.k; S.fitH = pr.fitH; S.pl = [pr.cx, pr.cz, pr.rd]; cursorWF = S.week; }
      }
      S.ghostA = ghostAt(now, S.key === 'jitomate' && labelWeek >= peakIdx ? 1 : 0);
      S.pulse = 0; S.ringS = 1;
      S.refA = 1; S.reveal = 1.25;
      az = currentAz(now); el = currentEl(now);
      lastEl = el; lastAz = az;
      setLabel(labelWeek);
    }
    moveCursor(cursorWF);
    const rOn = webgl && S.key === 'jitomate' && (S.mode === 'opening' ? (now - S.t0) / 1000 >= OP.tUpEnd - 0.05 : labelWeek >= peakIdx);
    if (rOn !== ringOn) {
      ringOn = rOn;
      for (const n of [$.legend.querySelector('.rv-ring'), $.legendm.querySelector('.rv-lmr')]) if (n) n.classList.toggle('rv-off', !rOn);
    }

    if (webgl) {
      writeInstances();
      const f = frameFor(el, S.fitH);
      const d = f.dist, ce = Math.cos(el);
      camera.position.set(d * ce * Math.sin(az), d * Math.sin(el), d * ce * Math.cos(az));
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(W, H, f.offX, f.offY, W, H);
      const f0 = d * 0.8, f1 = d * 1.7;
      for (const m of lineMats) { m.uniforms.uReveal.value = S.reveal; m.uniforms.uFront.value = S.fresh && S.mode === 'opening' ? 0.55 : 0; m.uniforms.uFog0.value = f0; m.uniforms.uFog1.value = f1; }
      pools.material.uniforms.uReveal.value = S.reveal; dots.material.uniforms.uReveal.value = S.reveal;
      colMat.uniforms.uRefY.value = S.refY; colMat.uniforms.uRefA.value = S.refA; colMat.uniforms.uFog0.value = f0; colMat.uniforms.uFog1.value = f1;
      const lpx = 0.8 * DPR;
      ringMat.uniforms.uPulse.value = S.pulse; ringMat.uniforms.uLW.value = lpx; ringMat.uniforms.uFog0.value = f0; ringMat.uniforms.uFog1.value = f1;
      dropMat.uniforms.uFog0.value = f0; dropMat.uniforms.uFog1.value = f1;
      plane.position.set(S.pl[0], 0, S.pl[1]); plane.scale.set(S.pl[2], 1, S.pl[2]);
      disc.position.y = S.refY; stilts.scale.y = Math.max(S.refY, 0.001);
      discMat.uniforms.uA.value = 0.14 * S.refA; discMat.uniforms.uLW.value = lpx; stiltMat.uniforms.uA.value = 0.42 * S.refA; foot.material.opacity = 0.12 * S.refA;
      const sel = S.pinned >= 0 ? S.pinned : S.hover;
      selRing.visible = sel >= 0; if (sel >= 0) selRing.position.set(SX[sel], 0.05, SZ[sel]);
      renderer.render(scene, camera);
      // the plane's label is a tag on its rim: the right-most rim point (turning toward the viewer) where the tag fits
      camera.updateMatrixWorld();
      const rr = S.pl[2], lab = $.reflab, lw = lab.offsetWidth, lh = lab.offsetHeight || 18;
      const rimAt = (th) => screenOf(S.pl[0] + Math.cos(th - az) * rr, S.refY, S.pl[1] + Math.sin(th - az) * rr);
      const fits = (q) => q[0] + 2 + lw <= W - 16 && q[1] + lh / 2 <= FREE.b && q[1] - lh / 2 >= FREE.t;
      const th0 = PHONE ? 0.6 : 0;
      let p = null, low = null;
      for (let th = th0; th <= 2.4; th += 0.04) {
        const q = rimAt(th);
        if (!low || q[1] > low[1]) low = q;
        if (fits(q)) {
          // slide to the exact first spot that fits, so the tag glides instead of stepping
          let lo = Math.max(th0, th - 0.04), hi = th; p = q;
          if (th > th0) for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2, qm = rimAt(m); if (fits(qm)) { hi = m; p = qm; } else lo = m; }
          break;
        }
      }
      p = p || low;
      const tx = clamp(p[0] + 2, 16, W - lw - 16), ty = clamp(p[1] - lh / 2, FREE.t, H - 40);
      // a short glide on the wall clock when the tag changes spot (e.g. when it first finds room)
      const k = labPos ? 1 - Math.exp(-Math.max(0, now - labPos[2]) / 70) : 1;
      labPos = labPos ? [lerp(labPos[0], tx, k), lerp(labPos[1], ty, k), now] : [tx, ty, now];
      lab.style.transform = 'translate(' + Math.round(labPos[0]) + 'px,' + Math.round(labPos[1]) + 'px)';
      lab.style.opacity = S.refA * (W < 760 ? 0.9 : 1);
    } else {
      drawFlat();
    }
    placeTip();
    raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  const stage = $.stage;
  let drag = null;
  on(stage, 'pointerdown', (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, az: lastAz, el: lastEl, moved: false, touch: e.pointerType !== 'mouse' };
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
  });
  on(stage, 'pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 7 && webgl) {
        drag.moved = true; stage.classList.add('rv-drag');
        endOpening(true); S.elTw = null; S.manual = true; setHover(-1);
        $.hint.classList.remove('rv-on');
      }
      if (drag.moved) { S.camAz = drag.az - dx * 0.0062; S.camEl = clamp(drag.el + dy * 0.0042, EL_MIN, EL_MAX); }
      return;
    }
    if (e.pointerType === 'mouse') { S.mouse = [e.clientX, e.clientY]; setHover(pick(e.clientX, e.clientY, false)); }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) { const i = pick(e.clientX, e.clientY, drag.touch); setPinned(i === S.pinned ? -1 : i); if (drag.touch) S.hover = -1; }
    else { S.manual = false; S.autoT0 = performance.now() + 3500; }
    stage.classList.remove('rv-drag'); drag = null;
  };
  on(stage, 'pointerup', endDrag);
  on(stage, 'pointercancel', () => { if (drag && drag.moved) { S.manual = false; S.autoT0 = performance.now() + 3500; } stage.classList.remove('rv-drag'); drag = null; });
  on(stage, 'pointerleave', (e) => { if (e.pointerType === 'mouse' && !drag) setHover(-1); });

  on($.skip, 'click', () => endOpening(true));
  on($.replay, 'click', replay);
  on($.play, 'click', () => { if (S.playing) stopPlay(); else startPlay(); });
  on($.bj, 'click', () => setProduct('jitomate'));
  on($.bt, 'click', () => setProduct('tortilla'));
  on($.prev, 'click', () => { endOpening(true); setWeek(S.labelWeek - 1); });
  on($.next, 'click', () => { endOpening(true); setWeek(S.labelWeek + 1); });
  on($.range, 'input', (e) => { endOpening(true); setWeek(+e.target.value, 320); });
  // the opening's keys are its own while it is up (capture, and they stop there): Escape closes a
  // pinned store first, then hands over to the map; space plays; the arrows step the weeks
  on(window, 'keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (S.pinned >= 0) { setPinned(-1); setHover(-1); return; }
      explore();
      return;
    }
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (S.playing) stopPlay(); else startPlay(); }
    else if (e.key === 'ArrowLeft') { e.stopPropagation(); endOpening(true); setWeek(S.labelWeek - 1); }
    else if (e.key === 'ArrowRight') { e.stopPropagation(); endOpening(true); setWeek(S.labelWeek + 1); }
  }, { capture: true });
  on(window, 'resize', layout);

  // ---------------------------------------------------------------- start
  if (webgl) {
    try { buildGL(); } catch (err) {
      webgl = false;
      if (scene) scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
      renderer = null; scene = null;
    }
  }
  if (!webgl) {
    glCanvas.hidden = true; flat.hidden = false; fctx = flat.getContext('2d');
    $.nogl.hidden = false;
    $.nogl.textContent = T.noGL;
    $.nogl2.hidden = false;
    $.nogl2.textContent = T.noGLShort;
    $.reflab.hidden = true;
  }
  $.hint.textContent = webgl ? (COARSE ? T.hintGLTouch : T.hintGLMouse) : (COARSE ? T.hint2DTouch : T.hint2DMouse);
  playIcon();
  renderProductText();
  layout();
  if (REDUCED) {
    // reduced motion: the end state, still; "Repetir" plays the opening on request
    S.fresh = false;
    S.mode = 'opening';
    endOpening(false);
    S.tw = null;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!dead) layout(); });
  raf = requestAnimationFrame(frame);

  return { destroy };
}
