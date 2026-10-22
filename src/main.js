// Boot: load the stage, draw the map, wire state → map colours and the floating chrome, route
// the hash, listen to the keyboard. The map is created once outside lit; lit renders only the
// chrome, the card and (in its own host) the tooltip.
import '@fontsource-variable/manrope';
import './style.css';
import { html, render, nothing } from 'lit';
import { state, subscribe, notify, setPref, setView, setWeek, basketAdd, basketSet, basketReplace, inBasket } from './app/state.js';
import { t, setLang, getLang, money, setDataYear, unitName, fdate, fspan } from './app/i18n.js';
import { loadStage, loadCatalog, loadVisits } from './data/qqp.js';
import { createMap } from './map/map.js';
import { computeStage, recentWindow, groupUnit, partialWeeks, MIN_N } from './app/stage.js';
import { median, clampDev } from './logic/stats.js';
import { divergingColor, COLORS } from './logic/color.js';
import { unitFor, DIM } from './logic/unit.js';
import { buildSearchIndex, search, searchView, flatResults } from './ui/search.js';
import { topRight, bottomRight, legend, credit, timeline, tooltip, tooltipText, toast, weekNumeral, weekValue, nHereText } from './ui/chrome.js';
import { storeCard, productCard, groupCard, basketCard, settingsCard } from './ui/cards.js';
import { listOwn, addOwn, deleteOwn, importOwn, persistStorage, ownToJson, ownToCsv, download } from './local/prices.js';

const app = document.getElementById('app');
const stageHost = document.createElement('div'); stageHost.id = 'stage'; app.appendChild(stageHost);
const chrome = document.createElement('div'); chrome.id = 'chrome'; app.appendChild(chrome);
const tipHost = document.createElement('div'); tipHost.id = 'tiphost'; app.appendChild(tipHost);
// one polite region announces what changed (a card opened, playback, search results)
const announcer = document.createElement('div'); announcer.className = 'sr'; announcer.setAttribute('aria-live', 'polite'); app.appendChild(announcer);
// (`still` is asked again when the text is written: a search count must not be spoken after the
// list was closed in the 30 ms between)
let announceInner = 0;
const announce = (text, still = null) => { clearTimeout(announceInner); announcer.textContent = ''; announceInner = setTimeout(() => { if (!still || still()) announcer.textContent = text; }, 30); };
const veil = document.createElement('div'); veil.className = 'veil'; veil.innerHTML = '<div class="logo">A cómo</div><div class="msg"></div>'; app.appendChild(veil);

const ui = {
  query: '', results: null, active: -1, searchIndex: null, pendingPick: false,
  hover: null, hx: 0, hy: 0,
  toast: '', toastAction: null, toastTimer: null,
  stage: null, stageToken: 0, stageReady: Promise.resolve(),
  storeFiles: new Map(), storeFilter: '', showAll: false, onlyComplete: false,
  entering: false, side: 'right',
  installPrompt: null, playing: false, playToken: 0,
  offer: null, moved: false, catalogReady: false, pendingCheck: false,
  phone: matchMedia('(max-width: 720px)'),
  free: { left: 0, right: innerWidth, h: innerHeight },
  tlW: 600, tieTags: new Map(), tlOpen: false, tlSheetOpen: false, beneath: null, announceWeek: false, padPass: 0,
};
let map = null;
const BASE = import.meta.env.BASE_URL;
const reducedOS = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionOn = () => (state.prefs.motion === undefined || state.prefs.motion === null ? !reducedOS() : state.prefs.motion !== false);

function hideToast() { ui.toast = ''; ui.toastAction = null; ui.basketSnap = null; renderChrome(); }
async function runToastAction() {
  const a = ui.toastAction; const back = ui.toastReturn; ui.toastReturn = null; hideToast();
  if (a) await a.fn();
  requestAnimationFrame(() => { const target = back && back !== document.body && document.contains(back) ? back : chrome.querySelector('.card h2') || chrome.querySelector('.search input'); if (target) target.focus(); });
}
function showToast(text, ms = 2600, action = null, { steal = true } = {}) {
  ui.toast = text; ui.toastAction = action; renderChrome();
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(hideToast, action ? 6500 : ms);
  // an undo must be reachable before it expires: a keyboard reader is taken to it (not when the
  // reader is pressing a button repeatedly, where the next Enter would undo what they just did)
  if (action && ui.keyboard && steal) requestAnimationFrame(() => { const b = chrome.querySelector('.toast-btn'); if (b) { ui.toastReturn = document.activeElement; b.focus(); } });
}
const retrievedDate = () => {
  const files = (state.data.meta.source && state.data.meta.source.files) || [];
  return files.map((f) => (f.retrieved || '').slice(0, 10)).filter(Boolean).sort().pop() || (state.data.meta.built || '').slice(0, 10);
};

// ---------------------------------------------------------------- routing
// #t/<store> #p/<product> #g/<group> #c (basket) #s (settings), ?w=<week>. Opening or switching a
// card pushes a history entry that remembers the one before it; closing goes back when the entry
// before is the city, so Back never reopens a card the reader just closed.
const VIEWS = { t: 'store', p: 'product', g: 'group', c: 'basket', s: 'settings' };
const KINDS = { store: 't', product: 'p', group: 'g', basket: 'c', settings: 's' };
function hashFor(view, week) {
  const h = view.kind === 'city' ? '' : `${KINDS[view.kind]}${view.id ? '/' + view.id : ''}`;
  return '#' + h + (week ? `?w=${week}` : '');
}
const urlFor = (hash) => (hash === '#' ? location.pathname + location.search : hash);
// ?lang= in the hash or before it (a link may carry either)
function langFromHash() { const m = location.hash.match(/[?&]lang=(es|en)\b/) || location.search.match(/[?&]lang=(es|en)\b/); return m ? m[1] : null; }
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [pathPart, queryPart] = raw.split('?');
  const q = new URLSearchParams(queryPart || '');
  const [kind, id] = pathPart.split('/');
  let strip = false;
  const lang = q.get('lang');
  // a language from a link is remembered, so a reload keeps it
  if (lang) { if (lang === 'es' || lang === 'en') { if (lang !== getLang()) { setLang(lang); document.title = t('appName'); } if (state.prefs.lang !== lang) setPref('lang', lang); } strip = true; }
  const items = q.get('items');
  if (items) {
    const merged = new Map();
    for (const s of items.split(',')) { const [pid, qty] = s.split(':'); const n = Math.floor(Number(qty) || 1); if (pid && n > 0) merged.set(pid, Math.min(99, (merged.get(pid) || 0) + n)); }
    const offer = [...merged].map(([iid, qty]) => ({ id: iid, qty }));
    if (offer.length) ui.offer = offer; // validated against the catalogue before it is used
    strip = true;
  }
  const w = q.get('w');
  state.week = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : null;
  if (w && !state.week) strip = true; // a malformed week is dropped from the address too
  const v = VIEWS[kind];
  if (v === 'product' || v === 'group') state.stage = { kind: v, id };
  else if (v === 'basket' && state.basket.length) state.stage = { kind: 'basket' };
  state.view = v ? { kind: v, id: id || null } : (ui.offer ? { kind: 'basket', id: null } : { kind: 'city', id: null });
  if (ui.offer && state.view.kind !== 'basket') state.view = { kind: 'basket', id: null };
  if (strip) history.replaceState(history.state, '', urlFor(hashFor(state.view, state.week)));
  validateView();
  if (ui.catalogReady) settleOffer();
  notify('view');
}
function writeHash(push) {
  const next = hashFor(state.view, state.week);
  const cur = location.hash || '#';
  if (cur === next) return;
  if (push) history.pushState({ acomo: true, prev: cur }, '', urlFor(next)); else history.replaceState(history.state, '', urlFor(next));
}
// an id that is not in the data (a stale shared link) falls back to the city, with a reason
function validateView() {
  const v = state.view;
  if (!state.data) return;
  const needCatalog = v.kind === 'product' || v.kind === 'group';
  if (needCatalog && !ui.catalogReady) { ui.pendingCheck = true; return; }
  const ok = v.kind === 'store' ? state.byStore.has(v.id) : v.kind === 'product' ? state.byProduct.has(v.id) : v.kind === 'group' ? state.byGroup.has(v.id) : true;
  if (!ok) {
    state.view = { kind: 'city', id: null };
    if (state.stage.kind === 'product' || state.stage.kind === 'group') state.stage = { kind: 'index' };
    state.week = null;
    history.replaceState(history.state, '', location.pathname);
    showToast(t('notFound'), 3600);
  }
}
// a shared basket: unknown ids dropped with a word; an empty basket adopts it, otherwise it is an offer
function settleOffer() {
  if (!ui.offer) return;
  const all = ui.offer.length;
  ui.offer = ui.offer.filter((b) => state.byProduct.has(b.id));
  const dropped = all - ui.offer.length;
  if (!ui.offer.length) { ui.offer = null; showToast(t('staleShared'), 3600); return; }
  if (!state.basket.length) {
    const n = ui.offer.length; basketReplace(ui.offer); ui.offer = null;
    showToast(`${t('sharedLoaded', { n })}${dropped ? ` · ${t('sharedDropped', { n: dropped })}` : ''}`, 3600);
  } else if (dropped) showToast(t('sharedDropped', { n: dropped }), 3600);
}

// ---------------------------------------------------------------- locations
// Stores that share a coordinate (the Central de Abasto stalls, a mercado's puestos) are one
// dot. Its colour is the cheapest value among them in price modes and the median of their
// indices in the index mode; the tooltip and the card say how many share the spot.
function buildLocations(stores) {
  const byKey = new Map();
  for (const s of stores) {
    if (s.lat == null || s.lon == null) continue;
    const key = `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`;
    let loc = byKey.get(key);
    if (!loc) { loc = { id: `L${byKey.size}`, lat: s.lat, lon: s.lon, stores: [] }; byKey.set(key, loc); }
    loc.stores.push(s.id);
  }
  return [...byKey.values()];
}
function aggregateByLocation(stage) {
  const colors = new Map(), values = new Map();
  if (!stage) return { colors, values };
  for (const loc of state.locations) {
    const rows = loc.stores.map((sid) => [sid, stage.values.get(sid)]).filter(([, v]) => v);
    let best = null;
    if (stage.kind === 'index') {
      const withV = rows.filter(([, v]) => v.dev != null);
      if (withV.length) best = { dev: median(withV.map(([, v]) => v.dev)), value: median(withV.map(([, v]) => v.value)), sid: withV.length === 1 ? withV[0][0] : null, n: withV.length, week: withV[0][1].week };
      else if (rows.length) best = { ...rows[0][1], sid: rows[0][0] };
    } else {
      const withV = rows.filter(([, v]) => v.value != null);
      const complete = withV.filter(([, v]) => !v.hatched);
      // a shared point shows its cheapest fair price: a flagged one only when nothing else is there
      const fair = complete.filter(([, v]) => !v.far);
      const pick = (fair.length ? fair : complete.length ? complete : withV).sort((a, b) => a[1].value - b[1].value)[0];
      if (pick) best = { ...pick[1], sid: pick[0], n: withV.length, hatched: !complete.length };
      else if (rows.length) best = { ...rows[0][1], sid: rows[0][0] };
    }
    values.set(loc.id, best);
    if (!best || (best.value == null && !best.hatched)) colors.set(loc.id, { empty: true });
    else if (best.hatched) colors.set(loc.id, { hatched: true });
    else if (best.neutral) colors.set(loc.id, { fill: COLORS.MID, t: 0 });
    else if (best.dev == null) colors.set(loc.id, { empty: true });
    else { const tt = clampDev(best.dev, stage.cap); colors.set(loc.id, { fill: divergingColor(tt), t: tt }); }
  }
  return { colors, values };
}
const locOf = (storeId) => state.locOf.get(storeId) || null;

// price tags on the stage: the three cheapest locations and the dearest one that is a fair
// comparison (no flagged outlier, never when every store charges the same)
function stageTags(stage, locValues) {
  if (!stage || stage.kind === 'index' || state.prefs.tags === false || stage.tooFew || ui.phone.matches || (ui.free && ui.free.h < 240)) return [];
  // a price flagged "revísalo" is never tagged as a store's extreme
  const rows = [...locValues.entries()].filter(([, v]) => v && v.value != null && !v.hatched && v.dev != null && !v.far);
  if (!rows.length) return [];
  rows.sort((a, b) => a[1].value - b[1].value);
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  const mk = ([id, v], kind) => {
    const s = state.byStore.get(v.sid);
    const loc = state.byLoc.get(id);
    const sub = loc && loc.stores.length > 1 ? nHereText(loc, state.byStore) : s ? s.name.replace(/\s+Sucursal\s+/i, ' ') : '';
    return { id, text: `${money(v.value)}${unit}`, sub, color: divergingColor(clampDev(v.dev, stage.cap)), kind };
  };
  // a handful of stores among hundreds of rings: tag them all so they can be found
  if (rows.length <= 5) return rows.map((r) => mk(r, 'cheap'));
  if (rows[0][1].value === rows[rows.length - 1][1].value) return [];
  // equal prices are one group; a group of several is one tag that says how many stores share the
  // price (three tags on three of 34 tied stores named them by file order)
  const groups = [];
  for (const r of rows) { const g = groups[groups.length - 1]; if (g && Math.abs(g.value - r[1].value) < 0.005) g.rows.push(r); else groups.push({ value: r[1].value, rows: [r] }); }
  const storesAt = (value) => [...stage.values.values()].filter((v) => v.value != null && !v.far && !v.hatched && Math.abs(v.value - value) < 0.005).length;
  const tagOf = (g, kind) => {
    let anchor = g.rows[0];
    if (g.rows.length > 1) {
      const pts = g.rows.map((r) => state.byLoc.get(r[0])).filter(Boolean);
      const mx = median(pts.map((p) => p.lon)), my = median(pts.map((p) => p.lat));
      anchor = g.rows.reduce((a, r) => { const p = state.byLoc.get(r[0]), q = state.byLoc.get(a[0]); return p && q && Math.hypot(p.lon - mx, p.lat - my) < Math.hypot(q.lon - mx, q.lat - my) ? r : a; });
    }
    const tg = mk(anchor, kind); const n = storesAt(g.value);
    if (n > 1) { tg.sub = t('tiedStores', { n }); tg.clickId = `tie:${anchor[0]}`; ui.tieTags.set(tg.clickId, { text: tg.text, n }); }
    return tg;
  };
  // a narrow free area (under 700 px) takes the cheapest and the dearest only (four tags covered a sixth of the data at 1024)
  const narrow = ui.free && ui.free.right - ui.free.left < 700;
  // a "cheap" tag is below the reference and a "dear" one above it (the third-cheapest milk was
  // the median itself). In a chosen week the side is decided against that week's own median
  // when 3 stores give it (in the April jitomate spike every price was above the recent median,
  // and the map lost its cheapest tags); the colours keep the one recent reference
  const wkRef = stage.weekIdx != null && stage.weekN >= MIN_N ? (stage.kind === 'group' ? stage.weekRef : stage.weekMed) : null;
  const side = (v) => (wkRef ? v.value / wkRef - 1 : v.dev);
  const cheapGroups = groups.slice(0, Math.min(narrow ? 1 : 3, groups.length - 1)).filter((g) => side(g.rows[0][1]) < -0.005);
  const dearGroup = groups[groups.length - 1];
  return [...cheapGroups.map((g) => tagOf(g, 'cheap')), ...(side(dearGroup.rows[0][1]) > 0.005 ? [tagOf(dearGroup, 'dear')] : [])];
}
// own prices shown on the map only for what the map is showing
function ownForStage(stage) {
  if (!stage || stage.kind === 'index') return [];
  if (stage.kind === 'product') return state.own.filter((o) => o.productId === stage.id);
  if (stage.kind === 'group') { const ids = new Set(state.data.products.filter((p) => p.group === stage.id).map((p) => p.id)); return state.own.filter((o) => ids.has(o.productId)); }
  if (stage.kind === 'basket') { const ids = new Set(state.basket.map((b) => b.id)); return state.own.filter((o) => ids.has(o.productId)); }
  return [];
}

// ---------------------------------------------------------------- stage
async function updateStage() {
  if (!state.data) return;
  const tok = ++ui.stageToken;
  let resolve;
  ui.stageReady = new Promise((r) => { resolve = r; });
  try {
    const res = await computeStage(state.stage, state.week);
    if (tok !== ui.stageToken) return;
    const subject = res ? `${res.kind}:${res.id || ''}` : '';
    if (subject !== ui.subject) { ui.subject = subject; if (!ui.readerMoved && !map.isAtFit() && state.view.kind !== 'store') { map.reset(); ui.moved = false; } }
    ui.stage = res; ui.stageFailed = null;
    // the address names the week on screen: a typed or stale ?w= is replaced by the week shown
    if (res && state.week && !res.loading && res.weeks && res.weeks.length && (res.weekIdx == null ? null : res.week) !== state.week) { state.week = res.weekIdx == null ? null : res.week; writeHash(false); }
    if (res && res.kind !== 'index') ui.tlOpen = true;
    if (ui.announceWeek && res && !ui.playing) {
      ui.announceWeek = false;
      const wv = weekValue(res);
      announce(res.weekIdx == null ? (res.kind === 'index' && res.weekSpan ? t('indexSpan', { span: fspan(res.weekSpan[0], res.weekSpan[1]) }) : t('recentSpan', { span: fspan(res.win.from, res.win.to) })) : `${t('week', { date: fdate(res.week) })}${res.partial.has(res.week) ? `, ${t('partialWeek')}` : ''}${wv ? `, ${wv.what} ${money(wv.value)}` : ''}`);
    }
    const agg = aggregateByLocation(res);
    ui.locValues = agg.values;
    map.setColors(agg.colors);
    // A new subject keeps the reader's view while it shows the answer. A deliberate zoom in (wheel,
    // pinch, double tap, +) is a neighbourhood the reader chose: kept unless fewer than 3 of the
    // subject's points are in it. A view at about the city's scale that was only dragged is refitted
    // when a tenth of the points fall outside. Measured two frames later, after the new card's
    // padding has moved the view.
    if (subject !== ui.lastFitCheck) {
      ui.lastFitCheck = subject;
      if (ui.readerMoved && state.view.kind !== 'store' && res.kind !== 'index') {
        const coloured = [...agg.colors].filter(([, c]) => c && !c.empty).map(([id]) => id);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (tok !== ui.stageToken || map.isAtFit() || !coloured.length) return;
          const { n, k } = map.inFreeCount(coloured);
          const zoomedIn = map.zoom() > map.fitK() * 1.25;
          if (zoomedIn ? k < Math.min(3, n) : k < n * 0.9) { ui.readerMoved = false; ui.focusZoom = null; map.reset(); ui.moved = false; renderChrome(); }
        }));
      }
    }
    map.setTags(stageTags(res, agg.values));
    map.setOwn(new Set(ownForStage(res).map((o) => locOf(o.storeId))));
  } catch (e) {
    console.warn('stage could not be computed:', e.message);
    if (tok !== ui.stageToken) return;
    if (e.offline) {
      // offline is not a fact about the data: keep the link and say why. The last subject's
      // colours, tags and legend go: they were drawn under the new title
      ui.stageFailed = `${state.stage.kind}:${state.stage.id || ''}`;
      ui.stage = null; ui.locValues = new Map();
      map.setColors(new Map()); map.setTags([]); map.setOwn(new Set());
      showToast(t('offlineNotLoaded'), 4000);
      renderChrome();
    } else if (state.stage.kind !== 'index') {
      state.stage = { kind: 'index' }; state.week = null;
      if (state.view.kind === 'product' || state.view.kind === 'group') state.view = { kind: 'city', id: null };
      showToast(t('notFound'), 3600);
      writeHash(false);
      ui.stageToken++; resolve(); return updateStage();
    } else showToast(t('loadError'));
  } finally { if (tok === ui.stageToken) resolve(); }
  renderChrome();
  queueMicrotask(applyPadding);
}

function cardSide() {
  if (state.view.kind === 'store') {
    const xy = map.screenXY(locOf(state.view.id));
    const [W] = map.size();
    if (xy) return xy[0] < W / 2 ? 'right' : 'left';
  }
  return 'right';
}
// The map's free area, measured from the chrome on screen: search, timeline, card, legend and the
// corner buttons. Labels and tags avoid the same rectangles.
function applyPadding(animate = true, pass = 0) {
  if (!map) return;
  const [W, H] = map.size();
  const open = state.view.kind !== 'city';
  const phone = ui.phone.matches;
  const rect = (sel) => { const e = chrome.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const bs = document.body.style;
  // First the corners that place the timeline (legend stack, buttons, card), then the timeline:
  // reading it before these were set measured where it used to be (1024 px: 146 dots under it).
  const lg0 = rect('.bottomleft'), br0 = rect('.bottomright'), card0 = rect('.card');
  bs.setProperty('--lgh', `${lg0 ? Math.round(H - lg0.top) : 0}px`);
  bs.setProperty('--tll', `${phone ? 10 : Math.round((lg0 ? lg0.right : 300) + 14)}px`);
  bs.setProperty('--tlr', `${Math.max(open && ui.side === 'right' ? (card0 ? W - card0.left + 14 : 28) : 28, br0 ? W - br0.left + 10 : 28)}px`);
  // between the legend and the corner buttons the timeline (or its chip) needs room; when there is
  // little, it moves above the legend and takes the width up to the card
  if (!phone) {
    const chip = chrome.querySelector('.timeline.collapsed .tl-chip');
    const need = chip ? chip.getBoundingClientRect().width + 24 : 400; // the open strip draws well down to about 400 px
    const right = Math.min(br0 ? br0.left : W, open && ui.side === 'right' && card0 ? card0.left : W);
    const room = right - (lg0 ? lg0.right : 0) - 28;
    document.body.classList.toggle('tl-stack', room < need);
  } else document.body.classList.remove('tl-stack');
  const search = rect('.search .box'), tl = rect('.timeline'), card = rect('.card'), lg = rect('.bottomleft'), br = rect('.bottomright'), tr = rect('.topright'), num = rect('.numeral');
  let pad;
  if (phone) {
    const top = Math.max(search ? search.bottom : 60, tl && tl.top < H / 2 ? tl.bottom : 0, num ? num.bottom : 0) + 10;
    const lowest = Math.min(open && card ? card.top : H, lg ? lg.top : H);
    pad = { left: 16, right: 16, top, bottom: H - lowest + 10 };
  } else {
    const cardW = card ? card.width + 28 : 0;
    const stacked = document.body.classList.contains('tl-stack');
    const chipStacked = stacked && !!chrome.querySelector('.timeline.collapsed');
    const chipRect = chipStacked ? rect('.timeline.collapsed .tl-chip') : null;
    // a folded chip above the legend sits in the legend's column: it must not reserve the whole bottom band
    const bottom = tl && !chipStacked ? H - tl.top + 14 : 70;
    let left = open && ui.side === 'left' ? cardW + 14 : 28;
    // the legend stack takes the bottom-left corner: keep the stores to its right (the city is taller than wide)
    // (with the timeline stacked above it, the bottom padding already clears it)
    if (lg && (!stacked || chipStacked)) left = Math.max(left, lg.right + 14, chipRect ? chipRect.right + 14 : 0);
    pad = { left, right: open && ui.side === 'right' ? cardW + 14 : 28, top: (search ? search.bottom : 60) + 16, bottom };
    // the week numeral is a corner too: beside the city when there is room, above it when not
    if (num) {
      const besides = num.right + 14;
      if (W - pad.right - besides >= Math.max(420, (W - pad.left - pad.right) * 0.6)) pad.left = Math.max(pad.left, besides);
      else pad.top = Math.max(pad.top, num.bottom + 10);
    }
  }
  ui.free = { left: pad.left, right: W - pad.right, h: H - pad.top - pad.bottom };
  bs.setProperty('--fl', `${pad.left}px`);
  bs.setProperty('--fr', `${pad.right}px`);
  bs.setProperty('--fcx', `${Math.round((pad.left + W - pad.right) / 2)}px`);
  bs.setProperty('--brw', `${br ? Math.round(br.width) : 0}px`);
  bs.setProperty('--tlh', `${tl ? Math.round(H - tl.top) : 0}px`);
  bs.setProperty('--tlb', `${tl ? Math.round(tl.bottom) : 60}px`);
  bs.setProperty('--numh', `${num && phone ? Math.round(num.height) + 6 : 0}px`);
  map.setPadding(pad, animate);
  map.setObstacles([search, tl, card, lg, br, tr, num].filter(Boolean).map((r) => [r.left - 4, r.top - 4, r.right + 4, r.bottom + 4]));
  if (ui.stage && ui.locValues) map.setTags(stageTags(ui.stage, ui.locValues));
  // the variables just set can move the timeline: measure once more when they did
  // (the strip's bottom too: the phone's numeral sits under it, and an expanded strip moves it)
  const sig = `${tl ? Math.round(tl.top) : 0}|${tl ? Math.round(tl.left) : 0}|${tl ? Math.round(tl.bottom) : 0}|${num ? Math.round(num.bottom) : 0}|${document.body.classList.contains('tl-stack')}`;
  if (pass < 1 && sig !== ui.padSig) { ui.padSig = sig; requestAnimationFrame(() => applyPadding(false, pass + 1)); } else ui.padSig = sig;
}

// ---------------------------------------------------------------- actions
function openStore(id, from = 'card') {
  ui.lastStore = id; ui.storeFrom = from;
  // a store opened over a subject card returns to it; one opened from the bare map returns to the map
  if (state.view.kind !== 'store') ui.storeReturn = state.view.kind;
  setView('store', id);
}
function openProduct(id) { state.stage = { kind: 'product', id }; setView('product', id); }
function openGroup(id) { state.stage = { kind: 'group', id }; setView('group', id); }
function openBasket() { if (state.basket.length) state.stage = { kind: 'basket' }; if (state.view.kind === 'basket') closeCard(); else setView('basket'); }
function openSettings() {
  if (state.view.kind === 'settings') { closeCard(); return; }
  ui.beneath = state.view.kind !== 'city' ? { ...state.view } : null;
  setView('settings');
}
// the card of what the map is showing (a product, a group, the basket); Back when it is the entry before
// A tie tag opens the card that lists the tied stores and takes the reader to them: the rows at
// that price are scrolled into view and marked for a moment (the whole list is shown if they are
// below the first rows)
// (only the stores' ranking is searched, never the sizes list; the whole ranking is shown when
// it lists fewer rows than the tie has stores; the tag's own count is announced)
function showTie(tie, tries = 0) {
  const onCard = !!chrome.querySelector('.card') && state.view.kind === state.stage.kind;
  if (!onCard) { openStageCard(); if (tries < 8) setTimeout(() => showTie(tie, tries + 1), 120); return; }
  if (!tie) return;
  const norm = (s) => s.replace(/\s+/g, '');
  const rows = [...chrome.querySelectorAll('.card .rank.stores li')].filter((li) => { const p = li.querySelector('.pr .p'); return p && norm(p.textContent) === norm(tie.text); });
  if (rows.length < tie.n && !ui.showAll && tries < 8) { ui.showAll = true; renderChrome(); requestAnimationFrame(() => showTie(tie, tries + 1)); return; }
  if (!rows.length) { if (tries < 8) setTimeout(() => showTie(tie, tries + 1), 150); return; }
  // a long way is jumped, not scrolled: the marks would fade before a smooth scroll arrived
  const far = Math.abs(rows[0].getBoundingClientRect().top - innerHeight / 2) > 1500;
  rows[0].scrollIntoView({ block: 'center', behavior: motionOn() && !far ? 'smooth' : 'auto' });
  for (const li of rows) { li.classList.remove('tie-hl'); void li.offsetWidth; li.classList.add('tie-hl'); }
  setTimeout(() => rows.forEach((li) => li.classList.remove('tie-hl')), 2200);
  announce(t('tiedStores', { n: tie.n }));
}
function openStageCard() {
  const s = state.stage;
  const target = s.kind === 'product' ? { kind: 'product', id: s.id } : s.kind === 'group' ? { kind: 'group', id: s.id } : s.kind === 'basket' ? { kind: 'basket', id: null } : null;
  if (!target) return;
  if (history.state && history.state.prev === hashFor(target, state.week)) { history.back(); return; }
  setView(target.kind, target.id);
}
// closing: Settings returns to the card under it; a store opened from a ranking returns to the
// ranking; otherwise the city, going Back when the city is the entry before
function closeCard() {
  if (state.view.kind === 'settings' && ui.beneath) {
    const b = ui.beneath; ui.beneath = null;
    // going Back to the card keeps history linear (a push would make Back reopen Settings)
    if (history.state && history.state.prev === hashFor(b, state.week)) { history.back(); return; }
    setView(b.kind, b.id); return;
  }
  if (state.view.kind === 'store' && state.stage.kind !== 'index' && ['product', 'group', 'basket'].includes(ui.storeReturn)) { openStageCard(); return; }
  if (state.view.kind === 'store' && ui.storeFrom === 'map' && ui.keyboard) ui.opener = stageHost.querySelector('svg');
  if (history.state && history.state.prev === hashFor({ kind: 'city' }, state.week)) { history.back(); return; }
  ui.replaceNext = true;
  setView('city');
}
function resetStage() {
  stopPlay();
  const ae = document.activeElement;
  if (ae && ae.closest && (ae.closest('.timeline') || ae.closest('.legend'))) requestAnimationFrame(() => requestAnimationFrame(() => { const c = chrome.querySelector('.tl-chip') || chrome.querySelector('.legend .ltitle') || chrome.querySelector('.search input'); if (c) c.focus(); }));
  const wasStageCard = ['product', 'group', 'basket'].includes(state.view.kind);
  state.stage = { kind: 'index' }; state.week = null; ui.tlOpen = false;
  if (wasStageCard) closeCard(); else { writeHash(false); notify('stage'); }
}

function copyLink(url) {
  const full = url || `${location.origin}${location.pathname}${location.hash || ''}`;
  navigator.clipboard.writeText(full).then(() => showToast(t('copied')), () => showToast(full, 5000));
}

async function refreshOwn() {
  state.own = await listOwn();
  if (ui.stage) map.setOwn(new Set(ownForStage(ui.stage).map((o) => locOf(o.storeId))));
  renderChrome();
}
async function addOwnPrice({ productId, storeId, price }) {
  try {
    const rec = await addOwn({ productId, storeId, price });
    await refreshOwn();
    const s = state.byStore.get(storeId);
    showToast(t('ownSaved', { price: money(rec.price), store: s ? s.name : storeId }));
    persistStorage();
  } catch (e) { console.error(e); showToast(t('ownInvalid')); }
}
// delete with an undo; focus moves to the next delete button, or the section heading
async function removeOwn(id, btn) {
  const rec = state.own.find((o) => o.id === id);
  const li = btn && btn.closest('li');
  const next = li && (li.nextElementSibling || li.previousElementSibling);
  await deleteOwn(id); await refreshOwn();
  requestAnimationFrame(() => { const nb = next && next.querySelector('.del'); if (nb && document.contains(nb)) nb.focus(); else { const h = chrome.querySelector('.card h2'); if (h) h.focus(); } });
  announce(t('ownDeleted'));
  if (rec) showToast(t('ownDeleted'), 6500, { label: t('undo'), fn: async () => { await addOwn({ productId: rec.productId, storeId: rec.storeId, price: rec.price, date: rec.date, note: rec.note, created: rec.created }); await refreshOwn(); } });
}

// ---------------------------------------------------------------- playback
// Playback owns its position and waits for each week to be drawn before stepping.
function stopPlay() { if (ui.playing) { ui.playing = false; ui.playToken++; if (ui.stage && ui.stage.week) announce(t('pausedAt', { date: fdate(ui.stage.week) })); renderChrome(); } }
async function play() {
  const st = ui.stage; if (!st || !st.weeks || st.weeks.length < 2) return;
  const tok = ++ui.playToken; ui.playing = true; renderChrome();
  const weeks = st.weeks;
  let i = st.weekIdx == null || st.weekIdx >= weeks.length - 1 ? 0 : st.weekIdx + 1;
  announce(t('playFrom', { date: fdate(weeks[i]) }));
  const stepMs = motionOn() ? 650 : 900;
  while (i < weeks.length) {
    const t0 = performance.now();
    setWeek(weeks[i]);
    await new Promise((r) => queueMicrotask(r));
    await ui.stageReady;
    if (tok !== ui.playToken) return;
    await new Promise((r) => setTimeout(r, Math.max(0, stepMs - (performance.now() - t0))));
    if (tok !== ui.playToken) return;
    i++;
  }
  ui.playing = false; setWeek(null); renderChrome();
}
function togglePlay() { if (ui.playing) stopPlay(); else play(); }
function stepWeek(dir) {
  stopPlay();
  const st = ui.stage; if (!st || !st.weeks) return;
  const n = st.weeks.length;
  if (st.weekIdx == null) { if (dir < 0) setWeek(st.weeks[Math.max(0, n + dir)]); return; }
  const i = st.weekIdx + dir;
  if (i >= n) setWeek(null); else setWeek(st.weeks[Math.max(0, i)]);
}

// ---------------------------------------------------------------- render
function stageTitle() {
  const s = state.stage;
  if (!s || s.kind === 'index') return t('index');
  if (s.kind === 'basket') return t('legendBasket', { n: state.basket.length });
  if (s.kind === 'group') { const g = state.byGroup.get(s.id); return g ? t('legendGroup', { name: g.name }) : t('group'); }
  const p = state.byProduct.get(s.id); return p ? `${p.name}${p.brand ? ' · ' + p.brand : ''}` : t('product');
}

function cardView() {
  const v = state.view;
  const win = recentWindow(state.data.meta);
  const common = { catalogReady: ui.catalogReady, stageFailed: !!ui.stageFailed && ui.stageFailed === `${state.stage.kind}:${state.stage.id || ''}`, side: ui.side, entering: ui.entering, win, partial: partialWeeks(state.data.meta), retrieved: retrievedDate(), onClose: closeCard, onOpenStore: openStore, onOpenProduct: openProduct, onOpenGroup: openGroup, showAll: ui.showAll, onShowAll: () => { const first = chrome.querySelectorAll('.card .rank li').length; ui.showAll = true; renderChrome(); requestAnimationFrame(() => { const a = chrome.querySelectorAll('.card .rank li a')[first]; if (a) a.focus({ preventScroll: true }); }); }, selectedStore: v.kind === 'store' ? v.id : ui.lastStore, onPickWeek: (w) => { stopPlay(); setWeek(w); }, onDeleteOwn: removeOwn, onCopyLink: () => copyLink(), byProduct: state.byProduct, byStore: state.byStore };
  if (v.kind === 'store') {
    const store = state.byStore.get(v.id);
    if (!store) return nothing;
    let file = ui.storeFiles.get(v.id);
    if (file === undefined) {
      ui.storeFiles.set(v.id, null);
      while (ui.storeFiles.size > 40) ui.storeFiles.delete(ui.storeFiles.keys().next().value);
      fetch(`${BASE}data/qqp/stores/${v.id}.json`).then((r) => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null)).then((j) => { ui.storeFiles.set(v.id, j || { items: [], error: true }); renderChrome(); }).catch(() => { ui.storeFiles.set(v.id, { items: [], error: true }); renderChrome(); });
      file = null;
    }
    const loc = state.byLoc.get(locOf(v.id));
    const siblings = loc ? loc.stores.filter((id) => id !== v.id).map((id) => ({ store: state.byStore.get(id), val: ui.stage && ui.stage.values ? ui.stage.values.get(id) : null })).filter((x) => x.store).sort((a, b) => ((a.val && a.val.value) ?? Infinity) - ((b.val && b.val.value) ?? Infinity)) : [];
    return storeCard({ ...common, store, storeFile: file, stage: ui.stage, own: state.own, filter: ui.storeFilter, siblings, stageTitle: stageTitle(), onStageCard: openStageCard, onFilter: (q) => { ui.storeFilter = q; renderChrome(); } });
  }
  if (v.kind === 'product') {
    const summary = state.byProduct && state.byProduct.get(v.id);
    if (!summary) return nothing;
    const mine = ui.stage && ui.stage.kind === 'product' && ui.stage.id === v.id ? ui.stage : null;
    const group = state.byGroup.get(summary.group);
    const gu = groupUnit(group, state.data.products.filter((p) => p.group === summary.group));
    // the group's unit when this product's size is in that dimension; its own unit otherwise
    const unit = summary.size && gu.unit && DIM[gu.unit] === summary.size.unit ? gu.unit : unitFor(summary.size);
    const carried = mine ? [...mine.values].filter(([, x]) => x.value != null || x.reason === 'stale').map(([sid]) => state.byStore.get(sid)).filter(Boolean) : [];
    const carriedIds = new Set(carried.map((s) => s.id));
    const storeOptions = [...carried.sort((a, b) => a.name.localeCompare(b.name, 'es')), ...state.data.stores.filter((s) => !carriedIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))];
    const defaultStore = ui.lastStore && state.byStore.has(ui.lastStore) ? ui.lastStore : (storeOptions[0] && storeOptions[0].id);
    return productCard({ ...common, summary, stage: ui.stage, byGroup: state.byGroup, own: state.own, inBasket: inBasket(v.id), storeOptions, defaultStore, unit,
      onToggleBasket: () => { if (inBasket(v.id)) basketSet(v.id, 0); else { basketAdd(v.id, 1); showToast(t('addedToBasket')); } },
      onAddOwn: ({ price, storeId }) => { ui.lastStore = storeId; addOwnPrice({ productId: v.id, storeId, price }); } });
  }
  if (v.kind === 'group') {
    const group = state.byGroup && state.byGroup.get(v.id);
    if (!group) return nothing;
    const members = state.data.products.filter((p) => p.group === v.id);
    return groupCard({ ...common, group, members, stage: ui.stage });
  }
  if (v.kind === 'basket') {
    if (!ui.pacicGroups && state.data.products.length) {
      const ids = new Set(state.data.products.filter((p) => p.pacic).map((p) => p.group));
      ui.pacicGroups = state.data.groups.filter((g) => ids.has(g.id)).sort((a, b) => (b.stores || 0) - (a.stores || 0));
    }
    return basketCard({ ...common, items: state.basket, stage: ui.stage && ui.stage.kind === 'basket' ? ui.stage : null, onlyComplete: ui.onlyComplete, pacicGroups: ui.pacicGroups || [], offer: ui.offer,
      onOnlyComplete: (b) => { ui.onlyComplete = b; renderChrome(); },
      onQty: (id, qty) => {
        // rows move up under a finger after a removal: a second removal within 450 ms is ignored,
        // so repeated taps or Enters on one row never take the rows that slide into its place
        if (qty <= 0 && performance.now() - (ui.lastRemoval || 0) < 450) return;
        const p = state.byProduct.get(id);
        const at = state.basket.findIndex((b) => b.id === id), prev = state.basket.slice();
        basketSet(id, qty);
        if (qty > 0 || at < 0) return;
        ui.lastRemoval = performance.now();
        // one undo brings back every item removed while its toast is up
        if (!(ui.toast && ui.basketSnap)) ui.basketSnap = prev;
        const snap = ui.basketSnap;
        // the focus stays in the list, on the next item's name (never on its remove button, where
        // the next Enter would remove it too), else the one before, else the empty note
        requestAnimationFrame(() => {
          if (document.activeElement && document.activeElement !== document.body) return;
          const names = chrome.querySelectorAll('.card .bitems .linkish');
          const target = names[Math.min(at, names.length - 1)] || chrome.querySelector('#basket-empty') || chrome.querySelector('.card h2');
          if (target) target.focus();
        });
        const removedN = snap.length - state.basket.length;
        showToast(removedN > 1 ? t('basketUndoAll', { n: removedN }) : t('removed', { name: p ? p.name : id }), 6500, { label: t('undo'), fn: () => basketReplace(snap) }, { steal: false });
        ui.basketSnap = snap;
      },
      onClear: () => { const prev = state.basket.slice(); basketReplace([]); showToast(t('cleared'), 6500, { label: t('undo'), fn: () => basketReplace(prev) }); requestAnimationFrame(() => { const n = chrome.querySelector('#basket-empty'); if (n && !(document.activeElement && document.activeElement.classList.contains('toast-btn'))) n.focus(); }); },
      onOfferUse: () => { const n = ui.offer.length; basketReplace(ui.offer); ui.offer = null; announce(t('sharedReplaced', { n })); renderChrome(); requestAnimationFrame(() => { const h = chrome.querySelector('.card h2'); if (h) h.focus(); }); },
      onOfferMerge: () => { const n = ui.offer.length; for (const it of ui.offer) basketAdd(it.id, it.qty); ui.offer = null; announce(t('sharedMerged', { n })); renderChrome(); requestAnimationFrame(() => { const h = chrome.querySelector('.card h2'); if (h) h.focus(); }); },
      onOfferDismiss: () => { ui.offer = null; renderChrome(); requestAnimationFrame(() => { const h = chrome.querySelector('.card h2'); if (h) h.focus(); }); },
      onCopyLink: () => copyLink(`${location.origin}${location.pathname}#c?items=${state.basket.map((b) => `${b.id}:${b.qty}`).join(',')}`) });
  }
  if (v.kind === 'settings') {
    return settingsCard({ ...common, phone: ui.phone.matches, prefs: state.prefs, own: state.own, meta: state.data.meta, canInstall: !!ui.installPrompt,
      onPref: (k, val) => setPref(k, val),
      onInstall: async () => { const p = ui.installPrompt; if (!p) return; p.prompt(); const r = await p.userChoice; if (r && r.outcome === 'accepted') { ui.installPrompt = null; showToast(t('installed')); } renderChrome(); },
      onExport: (kind) => { const rows = state.own; const lookup = { product: (id) => state.byProduct.get(id), store: (id) => state.byStore.get(id) }; if (kind === 'csv') download('acomo-mis-precios.csv', ownToCsv(rows, lookup), 'text/csv'); else download('acomo-mis-precios.json', ownToJson(rows)); },
      onImport: async (f) => { if (!f) return; try { const j = JSON.parse(await f.text()); const r = await importOwn(j.prices || j); await refreshOwn(); showToast(t('imported', { n: r.added, skipped: r.skipped })); } catch (e) { showToast(t('importError')); } } });
  }
  return nothing;
}

// Every way out of the full sheet comes through here: the class goes and, once the sheet's height
// has settled (a 280 ms transition), the map is measured again and refitted, or a store picked
// from the search is centred again, unless the reader moved the map. Measuring before the
// transition ended fitted the city to the full sheet's strip and left it a speck.
function leaveFullSheet(peek) {
  const b = document.body.classList;
  const was = b.contains('sheet-full');
  b.remove('sheet-full');
  if (peek !== undefined) b.toggle('sheet-peek', peek);
  if (was) settleSheet();
}
function settleSheet() {
  clearTimeout(ui.sheetTimer);
  ui.sheetTimer = setTimeout(() => {
    applyPadding(true);
    if (ui.readerMoved) return;
    if (ui.focusZoom && state.view.kind === 'store') map.zoomTo(ui.focusZoom, 3); else map.reset();
  }, 320);
}
function pickResult(e) {
  clearTimeout(ui.announceTimer);
  const inp = chrome.querySelector('.search input');
  ui.opener = inp; ui.query = ''; ui.results = null; ui.active = -1;
  if (inp) inp.blur();
  if (e.kind === 'group') openGroup(e.id);
  else if (e.kind === 'product') openProduct(e.id);
  // a store picked by name is shown up close, and stays so through the sheet's gestures
  else { openStore(e.id); requestAnimationFrame(() => { const l = locOf(e.id); if (l) { ui.focusZoom = l; map.zoomTo(l, 3); } }); }
}
function runSearch(q) {
  ui.query = q; ui.active = -1;
  ui.results = ui.searchIndex && q ? search(ui.searchIndex, q) : q ? { groups: [], products: [], stores: [], total: -1 } : null;
  clearTimeout(ui.announceTimer);
  const res = ui.results;
  // the count is spoken only while that list is still the one open (Escape, ✕, a map tap or a
  // blur close it without passing through here)
  const open = () => ui.results === res && !!ui.query;
  if (res) ui.announceTimer = setTimeout(() => { if (open()) announce(res.total === -1 ? t('loadingCatalog') : res.total === 0 ? t('noResults') : t('nResults', { n: res.total }), open); }, 500);
}

// the tooltip: re-rendered only when the hovered or keyboard-active dot changes; a move over the same dot only moves it
function renderTip(sameDot = false) {
  if (!state.data) return;
  const tip = tipHost.querySelector('.tip');
  if (sameDot && tip && ui.hover) { const left = Math.max(ui.free.left + 150, Math.min(ui.free.right - 150, ui.hx)); tip.style.left = `${left}px`; tip.style.top = `${ui.hy}px`; return; }
  const loc = ui.hover ? state.byLoc.get(ui.hover) : null;
  const own = loc && ui.stage ? ownForStage(ui.stage).find((o) => loc.stores.includes(o.storeId)) : null;
  render(tooltip({ loc, val: ui.hover && ui.locValues ? ui.locValues.get(ui.hover) : null, stage: ui.stage, byStore: state.byStore, byProduct: state.byProduct, x: ui.hx, y: ui.hy, free: ui.free, own }), tipHost);
}

function renderChrome() {
  if (!state.data) return;
  renderTip();
  const open = state.view.kind !== 'city';
  const b = document.body.classList;
  b.toggle('no-card', !open);
  b.toggle('card-right', open && ui.side === 'right');
  b.toggle('card-left', open && ui.side === 'left');
  b.toggle('searching', !!(ui.query && ui.results));
  b.toggle('no-motion', !motionOn());
  const flat = flatResults(ui.results);
  const narrow = innerWidth < 520 || (ui.phone.matches);
  // (on a phone with a card, the strip's state is the sheet's: the index chip opened nothing)
  const tlShown = ui.phone.matches && open ? ui.tlSheetOpen : ui.tlOpen;
  const tlCollapsed = !!ui.stage && ((ui.stage.kind === 'index' && !tlShown && ui.stage.weekIdx == null) || (ui.phone.matches && open && !ui.tlSheetOpen));
  const tpl = html`
    ${searchView({ query: ui.query, results: ui.results, active: ui.active, placeholder: narrow ? (innerWidth < 340 ? t('searchPhTiny') : t('searchPhShort')) : t('searchPh'),
      onInput: (q) => { runSearch(q); renderChrome(); },
      onClear: () => { clearTimeout(ui.announceTimer); ui.query = ''; ui.results = null; ui.active = -1; renderChrome(); requestAnimationFrame(() => { const inp = chrome.querySelector('.search input'); if (inp) inp.focus(); }); },
      onPick: pickResult,
      onKey: ({ key, event, hover }) => {
        if (hover != null) { if (ui.active !== hover) { ui.active = hover; renderChrome(); } return; }
        if (key === 'ArrowDown') { event.preventDefault(); ui.active = Math.min(flat.length - 1, ui.active + 1); renderChrome(); }
        else if (key === 'ArrowUp') { event.preventDefault(); ui.active = Math.max(0, ui.active - 1); renderChrome(); }
        else if (key === 'Enter') { event.preventDefault(); const e = flat[ui.active >= 0 ? ui.active : 0]; if (e) pickResult(e); else if (!ui.catalogReady && ui.query) ui.pendingPick = true; }
        // Escape clears a query; on an empty box it falls through to the window, which steps the stage back
        else if (key === 'Escape' && ui.query) { event.preventDefault(); event.stopPropagation(); clearTimeout(ui.announceTimer); ui.query = ''; ui.results = null; ui.active = -1; renderChrome(); }
      },
      onBlur: () => setTimeout(() => { if (!chrome.querySelector('.search').contains(document.activeElement) && ui.results) { ui.results = null; renderChrome(); } }, 150),
      onFocus: () => { if (ui.query && !ui.results && ui.searchIndex) { runSearch(ui.query); renderChrome(); } } })}
    ${topRight({ basketCount: state.basket.length, basketOn: state.view.kind === 'basket', onBasket: openBasket })}
    ${toast({ text: ui.toast, action: ui.toastAction && ui.toastAction.label, onAction: runToastAction, onFocus: () => clearTimeout(ui.toastTimer), onBlur: () => { if (ui.toastAction) { clearTimeout(ui.toastTimer); ui.toastTimer = setTimeout(hideToast, 4000); } } })}
    ${open ? cardView() : nothing}
    <div class="float bottomleft">${legend({ stage: ui.stage, title: stageTitle(), hasOwn: !!(ui.stage && ownForStage(ui.stage).length), onResetStage: resetStage, onTitle: state.stage.kind !== 'index' && !['product', 'group', 'basket'].includes(state.view.kind) ? openStageCard : null })}${credit({ retrieved: retrievedDate() })}</div>
    ${weekNumeral(ui.stage)}
    ${timeline({ stage: ui.stage, width: ui.tlW, compact: ui.phone.matches || innerHeight < 620 || innerWidth < 1100, playing: ui.playing, collapsed: tlCollapsed,
      onFold: ui.phone.matches && open && ui.tlSheetOpen ? () => { ui.tlSheetOpen = false; renderChrome(); requestAnimationFrame(() => { const c = chrome.querySelector('.tl-chip'); if (c) c.focus(); applyPadding(); }); } : null,
      onExpand: () => { if (ui.phone.matches && open) { ui.tlSheetOpen = true; leaveFullSheet(document.body.classList.contains('sheet-full') ? innerHeight < 700 : undefined); } else ui.tlOpen = true; renderChrome(); requestAnimationFrame(() => { const s = chrome.querySelector('.tl-svg'); if (s) s.focus(); applyPadding(); }); },
      onWeek: (w) => { stopPlay(); ui.announceWeek = true; setWeek(w); },
      // on the index, "Reciente" also folds the strip back into its chip
      onLive: () => { stopPlay(); ui.announceWeek = true; if (ui.phone.matches && open && ui.tlSheetOpen) { ui.tlSheetOpen = false; requestAnimationFrame(() => { const c = chrome.querySelector('.tl-chip'); if (c && ui.keyboard) c.focus(); applyPadding(); }); } if (ui.stage && ui.stage.kind === 'index') { ui.tlOpen = false; requestAnimationFrame(() => { const c = chrome.querySelector('.tl-chip'); if (c && ui.keyboard) c.focus(); applyPadding(); }); } if (state.week) setWeek(null); else renderChrome(); },
      onPlay: togglePlay, onStep: (d) => { ui.announceWeek = true; stepWeek(d); } })}
    ${bottomRight({ settingsOn: state.view.kind === 'settings', onSettings: openSettings, onReset: () => { map.reset(); ui.moved = false; ui.focusZoom = null; renderChrome(); requestAnimationFrame(() => { const s = chrome.querySelector('.settings-btn'); if (s) s.focus(); }); }, moved: ui.moved })}
  `;
  render(tpl, chrome);
  // keep the highlighted search result in view; measure the timeline for pixel-true drawing
  const act = chrome.querySelector('.search .item.active');
  if (act) act.scrollIntoView({ block: 'nearest' });
  observeTimeline();
}

// the timeline's drawing area, measured, so the SVG is drawn in real pixels (no stretching)
let tlObserver = null, tlObserved = null;
function observeTimeline() {
  const row = chrome.querySelector('.tl-row');
  if (!row || row === tlObserved) return;
  if (!tlObserver) tlObserver = new ResizeObserver((entries) => {
    const live = entries[0]; if (!live) return;
    const btn = live.target.querySelector('.tl-live');
    const w = Math.round(live.contentRect.width - (btn ? btn.offsetWidth + 8 : 0));
    if (w > 0 && Math.abs(w - ui.tlW) > 2) { ui.tlW = w; renderChrome(); }
  });
  if (tlObserved) tlObserver.unobserve(tlObserved);
  tlObserver.observe(row); tlObserved = row;
}

// ---------------------------------------------------------------- boot
async function boot() {
  // Spanish first, always; English is a setting (or ?lang=en, read before anything is written)
  setLang(langFromHash() || state.prefs.lang || 'es');
  // ?lang= before the hash: remembered, then dropped from the address
  { const sp = new URLSearchParams(location.search); const l = sp.get('lang'); if (l === 'es' || l === 'en') { setPref('lang', l); sp.delete('lang'); const rest = sp.toString(); history.replaceState(history.state, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`); } }
  if (state.prefs.tags === undefined) state.prefs.tags = true;
  document.title = t('appName');
  const msg = veil.querySelector('.msg');
  msg.textContent = t('loading');
  let stageData;
  try { stageData = await loadStage(); }
  catch (e) { console.error(e); msg.className = 'err'; msg.textContent = `${e.offline ? t('offlineNotLoaded') : t('loadError')} (${e.message})`; return; }
  const { geo, meta, stores } = stageData;
  setDataYear((meta.latestDate || '').slice(0, 4));
  state.data = { geo, meta, stores, products: [], groups: [], index: null };
  state.byStore = new Map(stores.map((s) => [s.id, s]));
  state.byProduct = new Map(); state.byGroup = new Map();
  state.stage = { kind: 'index' };
  state.locations = buildLocations(stores);
  state.byLoc = new Map(state.locations.map((l) => [l.id, l]));
  state.locOf = new Map(); for (const l of state.locations) for (const sid of l.stores) state.locOf.set(sid, l.id);

  map = createMap(stageHost, geo, state.locations, { motion: motionOn });
  map.setName(t('mapLabel'), t('mapRole'));
  map.setLabels(state.prefs.labels !== false);
  map.onHover((id, x, y) => { const same = id === ui.hover; ui.hover = id; ui.hx = x; ui.hy = y; renderTip(same); });
  map.onActive((id, x, y) => {
    ui.hover = id; ui.hx = x || 0; ui.hy = y || 0; renderTip(false);
    if (id) announce(tooltipText(state.byLoc.get(id), ui.locValues && ui.locValues.get(id), ui.stage, state.byStore, state.byProduct));
  });
  map.onClick((id) => {
    ui.tapShield = performance.now();
    if (typeof id === 'string' && id.startsWith('tie:')) { showTie(ui.tieTags.get(id)); return; }
    const loc = state.byLoc.get(id); if (!loc) return;
    const best = ui.locValues && ui.locValues.get(id);
    openStore((best && best.sid) || loc.stores[0], 'map');
  });
  // a tap opens a card on pointerup; the browser's click then lands wherever the finger is, on chrome
  // that has just moved there (the stage reset, a card's row): swallow that one click
  chrome.addEventListener('click', (e) => { if (ui.tapShield && performance.now() - ui.tapShield < 450) { e.preventDefault(); e.stopPropagation(); } ui.tapShield = 0; }, true);
  map.onBackground(() => { if (ui.query) { ui.query = ''; ui.results = null; } if (state.view.kind !== 'city') closeCard(); else renderChrome(); });
  // the reader moved the map (a drag or a wheel, not a tap): a new subject then keeps their view
  map.onMove(() => { const moved = !map.isAtFit(); if (!moved) ui.readerMoved = false; if (moved !== ui.moved) { ui.moved = moved; renderChrome(); } });
  stageHost.addEventListener('pointerdown', (e) => { ui.pressAt = [e.clientX, e.clientY]; }, { passive: true });
  // (a drag in the full sheet's thin strip is not a view the reader chose to keep)
  window.addEventListener('pointerup', (e) => { if (ui.pressAt && Math.hypot(e.clientX - ui.pressAt[0], e.clientY - ui.pressAt[1]) > 60 && !document.body.classList.contains('sheet-full')) ui.readerMoved = true; ui.pressAt = null; }, { passive: true });
  stageHost.addEventListener('dblclick', () => { ui.readerMoved = true; });
  stageHost.addEventListener('wheel', () => { ui.readerMoved = true; }, { passive: true });
  stageHost.addEventListener('keydown', (e) => { if (['+', '-', '=', '_'].includes(e.key)) ui.readerMoved = true; });
  veil.classList.add('off');
  setTimeout(() => veil.remove(), 600);
  if (!navigator.onLine) showToast(t('offlineStart'), 4000);

  try { await refreshOwn(); } catch { state.own = []; }

  // the catalogue (search, product and group cards) loads after the first colours
  loadCatalog().then(({ products, groups }) => {
    state.data.products = products; state.data.groups = groups;
    state.byProduct = new Map(products.map((p) => [p.id, p]));
    state.byGroup = new Map(groups.map((g) => [g.id, g]));
    ui.searchIndex = buildSearchIndex({ products, groups, stores });
    ui.catalogReady = true;
    if (ui.query) { runSearch(ui.query); if (ui.pendingPick) { ui.pendingPick = false; const flat = flatResults(ui.results); if (flat[0]) pickResult(flat[0]); } }
    const keep = state.basket.filter((b) => state.byProduct.has(b.id));
    if (keep.length !== state.basket.length) basketReplace(keep);
    settleOffer();
    if (ui.pendingCheck) { ui.pendingCheck = false; validateView(); }
    if (['product', 'group', 'basket'].includes(state.stage.kind)) updateStage();
    renderChrome();
  }).catch((e) => { console.error(e); showToast(e.offline ? t('offlineNotLoaded') : t('loadError')); });
  // the index timeline's curve arrives when visits.json does; the colours never waited for it
  loadVisits().then(() => { if (state.stage.kind === 'index') updateStage(); });

  parseHash();
  ui.side = cardSide();
  subscribe((kinds) => {
    if (kinds.has('prefs')) {
      setLang(state.prefs.lang || 'es'); document.title = t('appName');
      map.setName(t('mapLabel'), t('mapRole'));
      map.setLabels(state.prefs.labels !== false);
      if (ui.stage) map.setTags(stageTags(ui.stage, ui.locValues || new Map()));
    }
    if (kinds.has('view')) {
      const wasOpen = !!chrome.querySelector('.card');
      const ae0 = document.activeElement;
      if (!wasOpen && state.view.kind !== 'city') ui.opener = ui.opener || (ae0 && ae0 !== document.body ? ae0 : null);
      // the phone sheet opens at its normal height for every new card (peek on short phones)
      leaveFullSheet(ui.phone.matches && innerHeight < 700);
      if (state.view.kind !== 'store' || locOf(state.view.id) !== ui.focusZoom) ui.focusZoom = null;
      ui.side = cardSide(); ui.showAll = false; ui.storeFilter = '';
      if (state.view.kind === 'city') ui.tlSheetOpen = false;
      ui.entering = motionOn(); renderChrome();
      if (ui.entering) requestAnimationFrame(() => requestAnimationFrame(() => { ui.entering = false; renderChrome(); }));
      map.clearHover();
      map.setSelected(state.view.kind === 'store' ? locOf(state.view.id) : null);
      if (state.view.kind === 'basket' && state.basket.length && state.stage.kind !== 'basket') state.stage = { kind: 'basket' };
      if (!ui.fromPop) writeHash(!ui.replaceNext);
      ui.fromPop = false; ui.replaceNext = false;
      updateStage();
      requestAnimationFrame(() => applyPadding(true));
      requestAnimationFrame(() => {
        const bd = chrome.querySelector('.card .body'); if (bd) bd.scrollTop = 0;
        const h = chrome.querySelector('.card h2');
        if (h) { if (!(ui.offer && state.view.kind === 'basket')) announce(h.textContent); if (ui.keyboard) h.focus({ preventScroll: true }); }
        else if (state.view.kind === 'city' && ui.keyboard && (!document.activeElement || document.activeElement === document.body || !document.contains(document.activeElement))) {
          const back = ui.opener && ui.opener !== document.body && document.contains(ui.opener) ? ui.opener : chrome.querySelector('.search input');
          if (back) back.focus({ preventScroll: true });
          ui.opener = null;
        }
        if (state.view.kind === 'city') ui.opener = null;
      });
    } else if (kinds.has('week')) { writeHash(false); updateStage(); }
    else if (kinds.has('basket')) {
      if (state.stage.kind === 'basket' || state.view.kind === 'basket') state.stage = state.basket.length ? { kind: 'basket' } : { kind: 'index' };
      updateStage(); renderChrome();
    } else if (kinds.has('stage')) updateStage();
    else renderChrome();
  });
  updateStage();
  renderChrome();
  requestAnimationFrame(() => applyPadding(false));

  const onNav = () => { ui.fromPop = true; stopPlay(); parseHash(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', () => { if (location.hash !== hashFor(state.view, state.week)) onNav(); });
  window.addEventListener('resize', () => { map.resize(); renderChrome(); requestAnimationFrame(() => applyPadding(false)); });
  // focus moves only for keyboard readers; a mouse or a finger keeps its place
  window.addEventListener('pointerdown', () => { ui.keyboard = false; }, true);
  // Keyboard: Escape steps back one level (search → card → playback → chosen week → stage);
  // Space plays or pauses; "/" focuses the search; ↑↓ walk a card's list, Enter opens.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') ui.keyboard = true;
    if (e.defaultPrevented) return;
    const ae = document.activeElement;
    const inInput = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
    // Ctrl+Z (Cmd+Z) takes the undo a toast offers, wherever the focus is (outside a text field)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && ui.toastAction && !inInput) { e.preventDefault(); runToastAction(); return; }
    if (e.key === 'Escape') {
      if (inInput) { const emptySearch = ae.matches('.search input') && !ae.value; if (!emptySearch) { ae.blur(); return; } clearTimeout(ui.announceTimer); }
      if (state.view.kind !== 'city') closeCard();
      else if (ui.playing) stopPlay();
      else if (state.week) setWeek(null);
      else if (state.stage.kind !== 'index') resetStage();
    } else if (e.key === ' ' && !inInput && !(ae && (['BUTTON', 'A', 'SUMMARY'].includes(ae.tagName) || ae.closest('button, a, summary, [role=slider], [role=application]'))) && ui.stage && ui.stage.weeks && ui.stage.weeks.length > 1) {
      e.preventDefault(); togglePlay();
    } else if (e.key === '/' && !inInput) { e.preventDefault(); const inp = chrome.querySelector('.search input'); if (inp) inp.focus(); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ae && ae.closest && ae.closest('.card .rank li')) {
      e.preventDefault();
      const items = [...ae.closest('.card').querySelectorAll('.rank li a.row')];
      const i = items.indexOf(ae.closest('a.row') || ae) + (e.key === 'ArrowDown' ? 1 : -1);
      if (items[i]) items[i].focus();
    }
  });
  let sheetDrag = null;
  chrome.addEventListener('pointerdown', (e) => {
    if (!ui.phone.matches || !e.target.closest('.card .head') || e.target.closest('button, a')) return;
    sheetDrag = { y: e.clientY, grip: !!e.target.closest('.grip') };
  });
  window.addEventListener('pointerup', (e) => {
    if (!sheetDrag) return;
    const dy = e.clientY - sheetDrag.y, b = document.body.classList;
    const grip = sheetDrag.grip; sheetDrag = null;
    if (dy < -24 || (grip && Math.abs(dy) < 6 && !b.contains('sheet-full'))) { b.add('sheet-full'); b.remove('sheet-peek'); ui.tlSheetOpen = false; renderChrome(); }
    // leaving the full sheet returns to the height the card opened at (peek on short phones)
    else if (dy > 24 || (grip && Math.abs(dy) < 6)) { if (b.contains('sheet-full')) leaveFullSheet(innerHeight < 700); else b.add('sheet-peek'); }
    else return;
    // the gesture's click must not reach the map that now lies under the finger
    ui.tapShield = performance.now();
    settleSheet();
  });
  if (ui.phone.matches && innerHeight < 700) document.body.classList.add('sheet-peek');
  window.addEventListener('offline', () => showToast(t('offline'), 4000));
  window.addEventListener('online', () => { for (const [k, v] of ui.storeFiles) if (v && v.error) ui.storeFiles.delete(k); renderChrome(); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e; renderChrome(); });
  ui.phone.addEventListener('change', () => requestAnimationFrame(() => applyPadding(false)));

  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
}

boot();
