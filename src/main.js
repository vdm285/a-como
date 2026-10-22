// Boot: load the stage, draw the map, wire state → map colours and the floating chrome, route
// the hash, listen to the keyboard. The map is created once outside lit; lit renders only the
// chrome and the card.
import '@fontsource-variable/manrope';
import './style.css';
import { html, render, nothing } from 'lit';
import { state, subscribe, notify, setPref, setView, setWeek, basketAdd, basketSet, basketReplace, inBasket } from './app/state.js';
import { t, setLang, getLang, money, setDataYear, unitName } from './app/i18n.js';
import { loadStage, loadCatalog } from './data/qqp.js';
import { createMap } from './map/map.js';
import { computeStage, recentWindow, groupUnit, partialWeeks } from './app/stage.js';
import { median, clampDev } from './logic/stats.js';
import { divergingColor } from './logic/color.js';
import { buildSearchIndex, search, searchView } from './ui/search.js';
import { topRight, bottomRight, legend, credit, timeline, tooltip, toast } from './ui/chrome.js';
import { storeCard, productCard, groupCard, basketCard, settingsCard } from './ui/cards.js';
import { listOwn, addOwn, deleteOwn, importOwn, persistStorage, ownToJson, ownToCsv, download } from './local/prices.js';

const app = document.getElementById('app');
const stageHost = document.createElement('div'); stageHost.id = 'stage'; app.appendChild(stageHost);
const chrome = document.createElement('div'); chrome.id = 'chrome'; app.appendChild(chrome);
const tipHost = document.createElement('div'); tipHost.id = 'tiphost'; app.appendChild(tipHost);
// one polite region announces what changed (a card opened, the week while playing); the rest of the app is not a live region
const announcer = document.createElement('div'); announcer.className = 'sr'; announcer.setAttribute('aria-live', 'polite'); app.appendChild(announcer);
const announce = (text) => { announcer.textContent = ''; setTimeout(() => { announcer.textContent = text; }, 30); };
const veil = document.createElement('div'); veil.className = 'veil'; veil.innerHTML = '<div class="logo">A cómo</div><div class="msg"></div>'; app.appendChild(veil);

const ui = {
  query: '', results: null, active: -1, searchIndex: null,
  hover: null, hx: 0, hy: 0,
  toast: '', toastTimer: null,
  stage: null, stageToken: 0, stageReady: Promise.resolve(),
  storeFiles: new Map(), storeFilter: '', showAll: false, onlyComplete: false,
  entering: false, side: 'right',
  installPrompt: null, playing: false, playToken: 0,
  offer: null, moved: false, catalogReady: false, pendingCheck: false,
  phone: matchMedia('(max-width: 720px)'),
  free: { left: 0, right: innerWidth },
};
let map = null;
const BASE = import.meta.env.BASE_URL;

function showToast(text, ms = 2600) {
  ui.toast = text; renderChrome();
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { ui.toast = ''; renderChrome(); }, ms);
}
const retrievedDate = () => {
  const files = (state.data.meta.source && state.data.meta.source.files) || [];
  return files.map((f) => (f.retrieved || '').slice(0, 10)).filter(Boolean).sort().pop() || (state.data.meta.built || '').slice(0, 10);
};

// ---------------------------------------------------------------- routing
// #t/<store> #p/<product> #g/<group> #c (basket) #s (settings), ?w=<week>. Opening or switching a
// card pushes a history entry (Back returns to the previous card); week moves replace it.
// ?lang= and ?items= are read once and stripped: a shared basket arrives as an offer.
const VIEWS = { t: 'store', p: 'product', g: 'group', c: 'basket', s: 'settings' };
const KINDS = { store: 't', product: 'p', group: 'g', basket: 'c', settings: 's' };
function hashFor(view, week) {
  const h = view.kind === 'city' ? '' : `${KINDS[view.kind]}${view.id ? '/' + view.id : ''}`;
  return '#' + h + (week ? `?w=${week}` : '');
}
function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const [pathPart, queryPart] = raw.split('?');
  const q = new URLSearchParams(queryPart || '');
  const [kind, id] = pathPart.split('/');
  let strip = false;
  const lang = q.get('lang');
  if (lang) { if (lang !== getLang() && (lang === 'es' || lang === 'en')) { setLang(lang); setPref('lang', lang); document.title = t('appName'); } strip = true; }
  const items = q.get('items');
  if (items) {
    const merged = new Map();
    for (const s of items.split(',')) { const [pid, qty] = s.split(':'); const n = Math.floor(Number(qty) || 1); if (pid && n > 0) merged.set(pid, Math.min(99, (merged.get(pid) || 0) + n)); }
    const offer = [...merged].map(([id, qty]) => ({ id, qty }));
    if (offer.length) { if (!state.basket.length) { basketReplace(offer); showToast(t('sharedLoaded', { n: offer.length })); } else ui.offer = offer; }
    strip = true;
  }
  const w = q.get('w');
  state.week = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : null;
  const v = VIEWS[kind];
  if (v === 'product' || v === 'group') state.stage = { kind: v, id };
  else if (v === 'basket' && state.basket.length) state.stage = { kind: 'basket' };
  state.view = v ? { kind: v, id: id || null } : (ui.offer ? { kind: 'basket', id: null } : { kind: 'city', id: null });
  if (ui.offer && state.view.kind !== 'basket') state.view = { kind: 'basket', id: null };
  if (strip) history.replaceState(null, '', hashFor(state.view, state.week) === '#' ? location.pathname : hashFor(state.view, state.week));
  validateView();
  notify('view');
}
function writeHash(push) {
  const next = hashFor(state.view, state.week);
  const cur = location.hash || '#';
  if (cur === next) return;
  const url = next === '#' ? location.pathname + location.search : next;
  if (push) history.pushState(null, '', url); else history.replaceState(null, '', url);
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
    history.replaceState(null, '', location.pathname);
    showToast(t('notFound'), 3600);
  }
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
      const pick = (complete.length ? complete : withV).sort((a, b) => a[1].value - b[1].value)[0];
      if (pick) best = { ...pick[1], sid: pick[0], n: withV.length, hatched: !complete.length };
      else if (rows.length) best = { ...rows[0][1], sid: rows[0][0] };
    }
    values.set(loc.id, best);
    if (!best || (best.value == null && !best.hatched)) colors.set(loc.id, { empty: true });
    else if (best.hatched) colors.set(loc.id, { hatched: true });
    else if (best.dev == null) colors.set(loc.id, { empty: true });
    else { const tt = clampDev(best.dev, stage.cap); colors.set(loc.id, { fill: divergingColor(tt), t: tt }); }
  }
  return { colors, values };
}
const locOf = (storeId) => state.locOf.get(storeId) || null;

// price tags on the stage: the three cheapest locations and the dearest
function stageTags(stage, locValues) {
  if (!stage || stage.kind === 'index' || !state.prefs.tags || (ui.free && ui.free.h < 240)) return [];
  const rows = [...locValues.entries()].filter(([, v]) => v && v.value != null && !v.hatched && v.dev != null);
  if (rows.length < 4) return [];
  rows.sort((a, b) => a[1].value - b[1].value);
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  const mk = ([id, v], kind) => {
    const s = state.byStore.get(v.sid);
    const loc = state.byLoc.get(id);
    const sub = loc && loc.stores.length > 1 ? t('nHere', { n: loc.stores.length }) : s ? s.name.replace(/\s+Sucursal\s+/i, ' ') : '';
    return { id, text: `${money(v.value)}${unit}`, sub, color: divergingColor(clampDev(v.dev, stage.cap)), kind };
  };
  return [...rows.slice(0, 3).map((r) => mk(r, 'cheap')), mk(rows[rows.length - 1], 'dear')];
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
    ui.stage = res;
    const agg = aggregateByLocation(res);
    ui.locValues = agg.values;
    map.setColors(agg.colors);
    map.setTags(stageTags(res, agg.values));
  } catch (e) {
    console.warn('stage could not be computed:', e.message);
    if (tok !== ui.stageToken) return;
    // a missing product file (a stale link): back to the index rather than a dead grey map
    if (state.stage.kind !== 'index') {
      state.stage = { kind: 'index' }; state.week = null;
      if (state.view.kind === 'product' || state.view.kind === 'group') state.view = { kind: 'city', id: null };
      showToast(t('notFound'), 3600);
      writeHash(false);
      ui.stageToken++; resolve(); return updateStage();
    }
    showToast(t('loadError'));
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
// The map's free area, measured from the chrome actually on screen: the search on top, the
// timeline, the card on its side (desktop) or the sheet (phone).
function applyPadding(animate = true) {
  if (!map) return;
  const [W, H] = map.size();
  const open = state.view.kind !== 'city';
  const rect = (sel) => { const e = chrome.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
  const search = rect('.search .box'), tl = rect('.timeline'), card = rect('.card');
  let pad;
  if (ui.phone.matches) {
    const top = Math.max(search ? search.bottom : 60, tl && tl.top < H / 2 ? tl.bottom : 0) + 12;
    const bottom = open && card ? H - card.top + 12 : 70;
    pad = { left: 18, right: 18, top, bottom };
  } else {
    const cardW = card ? card.width + 28 : 0;
    const bottom = tl ? H - tl.top + 14 : 70;
    pad = { left: open && ui.side === 'left' ? cardW + 14 : 28, right: open && ui.side === 'right' ? cardW + 14 : 28, top: (search ? search.bottom : 60) + 16, bottom };
  }
  ui.free = { left: pad.left, right: W - pad.right, h: H - pad.top - pad.bottom };
  const lg = rect('.bottomleft');
  document.body.style.setProperty('--tll', `${ui.phone.matches ? 10 : Math.round((lg ? lg.right : 300) + 14)}px`);
  document.body.style.setProperty('--fl', `${pad.left}px`);
  document.body.style.setProperty('--fr', `${pad.right}px`);
  map.setPadding(pad, animate);
  if (ui.stage && ui.locValues) map.setTags(stageTags(ui.stage, ui.locValues));
}

// ---------------------------------------------------------------- actions
function openStore(id) { ui.lastStore = id; setView('store', id); }
function openProduct(id) { state.stage = { kind: 'product', id }; setView('product', id); }
function openGroup(id) { state.stage = { kind: 'group', id }; setView('group', id); }
function openBasket() { if (state.basket.length) state.stage = { kind: 'basket' }; setView(state.view.kind === 'basket' ? 'city' : 'basket'); }
function openSettings() { setView(state.view.kind === 'settings' ? 'city' : 'settings'); }
// the card of what the map is showing (a product, a group, the basket)
function openStageCard() {
  const s = state.stage;
  if (s.kind === 'product') setView('product', s.id);
  else if (s.kind === 'group') setView('group', s.id);
  else if (s.kind === 'basket') setView('basket');
}
// closing a store opened from a ranking returns to that ranking
function closeCard() {
  if (state.view.kind === 'store' && state.stage.kind !== 'index') openStageCard();
  else setView('city');
}
function resetStage() {
  stopPlay();
  const wasStageCard = ['product', 'group', 'basket'].includes(state.view.kind);
  state.stage = { kind: 'index' }; state.week = null;
  if (wasStageCard) setView('city'); else { writeHash(false); notify('stage'); }
}

function copyLink(url) {
  const full = url || `${location.origin}${location.pathname}${location.hash || ''}`;
  navigator.clipboard.writeText(full).then(() => showToast(t('copied')), () => showToast(full, 5000));
}

async function refreshOwn() {
  state.own = await listOwn();
  map.setOwn(new Set(state.own.map((o) => locOf(o.storeId))));
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
async function removeOwn(id) { await deleteOwn(id); await refreshOwn(); }

// ---------------------------------------------------------------- playback
// Playback owns its position and waits for each week to be drawn before stepping; a slow file
// on a phone no longer aborts it.
function stopPlay() { if (ui.playing) { ui.playing = false; ui.playToken++; renderChrome(); } }
async function play() {
  const st = ui.stage; if (!st || !st.weeks || st.weeks.length < 2) return;
  const tok = ++ui.playToken; ui.playing = true; renderChrome();
  const weeks = st.weeks;
  let i = st.weekIdx == null || st.weekIdx >= weeks.length - 1 ? 0 : st.weekIdx + 1;
  const stepMs = state.prefs.motion ? 650 : 900;
  while (i < weeks.length) {
    const t0 = performance.now();
    setWeek(weeks[i]);
    if (i % 4 === 0) announce(t('week', { date: weeks[i] }));
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
  if (st.weekIdx == null) { if (dir < 0) setWeek(st.weeks[n - 1]); return; }
  const i = st.weekIdx + dir;
  if (i >= n) setWeek(null); else if (i >= 0) setWeek(st.weeks[i]);
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
  const common = { side: ui.side, entering: ui.entering, win, partial: partialWeeks(state.data.meta), onClose: closeCard, onOpenStore: openStore, onOpenProduct: openProduct, onOpenGroup: openGroup, showAll: ui.showAll, onShowAll: () => { ui.showAll = true; renderChrome(); }, selectedStore: v.kind === 'store' ? v.id : ui.lastStore, onPickWeek: (w) => { stopPlay(); setWeek(w); }, onDeleteOwn: removeOwn, byProduct: state.byProduct, byStore: state.byStore };
  if (v.kind === 'store') {
    const store = state.byStore.get(v.id);
    if (!store) return nothing;
    let file = ui.storeFiles.get(v.id);
    if (file === undefined) {
      ui.storeFiles.set(v.id, null);
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
    const { unit } = groupUnit(group, state.data.products.filter((p) => p.group === summary.group));
    // stores that carried this product recently first, then all others (a shelf price can be new)
    const carried = mine ? [...mine.values].filter(([, x]) => x.value != null || x.reason === 'stale').map(([sid]) => state.byStore.get(sid)).filter(Boolean) : [];
    const carriedIds = new Set(carried.map((s) => s.id));
    const storeOptions = [...carried.sort((a, b) => a.name.localeCompare(b.name, 'es')), ...state.data.stores.filter((s) => !carriedIds.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))];
    const defaultStore = ui.lastStore && state.byStore.has(ui.lastStore) ? ui.lastStore : (storeOptions[0] && storeOptions[0].id);
    return productCard({ ...common, summary, stage: ui.stage, byGroup: state.byGroup, own: state.own, inBasket: inBasket(v.id), storeOptions, defaultStore, unit,
      onToggleBasket: () => { if (inBasket(v.id)) basketSet(v.id, 0); else { basketAdd(v.id, 1); showToast(t('addedToBasket')); } },
      onCopyLink: () => copyLink(),
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
      ui.pacicGroups = state.data.groups.filter((g) => ids.has(g.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    return basketCard({ ...common, items: state.basket, stage: ui.stage && ui.stage.kind === 'basket' ? ui.stage : null, onlyComplete: ui.onlyComplete, pacicGroups: ui.pacicGroups || [], offer: ui.offer,
      onOnlyComplete: (b) => { ui.onlyComplete = b; renderChrome(); },
      onQty: (id, qty) => basketSet(id, qty),
      onClear: () => { const prev = state.basket.slice(); basketReplace([]); showToast(t('cleared')); ui.lastCleared = prev; },
      onOfferUse: () => { basketReplace(ui.offer); ui.offer = null; renderChrome(); },
      onOfferMerge: () => { for (const it of ui.offer) basketAdd(it.id, it.qty); ui.offer = null; renderChrome(); },
      onOfferDismiss: () => { ui.offer = null; renderChrome(); },
      onCopyLink: () => copyLink(`${location.origin}${location.pathname}#c?items=${state.basket.map((b) => `${b.id}:${b.qty}`).join(',')}`) });
  }
  if (v.kind === 'settings') {
    return settingsCard({ ...common, prefs: state.prefs, own: state.own, meta: state.data.meta, geoMeta: state.data.geo.meta, canInstall: !!ui.installPrompt, retrieved: retrievedDate(),
      onPref: (k, val) => setPref(k, val),
      onInstall: async () => { const p = ui.installPrompt; if (!p) return; p.prompt(); const r = await p.userChoice; if (r && r.outcome === 'accepted') { ui.installPrompt = null; showToast(t('installed')); } renderChrome(); },
      onExport: (kind) => { const rows = state.own; const lookup = { product: (id) => state.byProduct.get(id), store: (id) => state.byStore.get(id) }; if (kind === 'csv') download('acomo-mis-precios.csv', ownToCsv(rows, lookup), 'text/csv'); else download('acomo-mis-precios.json', ownToJson(rows)); },
      onImport: async (f) => { if (!f) return; try { const j = JSON.parse(await f.text()); const r = await importOwn(j.prices || j); await refreshOwn(); showToast(t('imported', { n: r.added, skipped: r.skipped })); } catch (e) { showToast(t('importError')); } } });
  }
  return nothing;
}

function pickResult(e) {
  ui.query = ''; ui.results = null; ui.active = -1;
  const inp = chrome.querySelector('.search input'); if (inp) inp.blur();
  if (e.kind === 'group') openGroup(e.id);
  else if (e.kind === 'product') openProduct(e.id);
  else { openStore(e.id); requestAnimationFrame(() => map.zoomTo(locOf(e.id), 3)); }
}

// the tooltip: re-rendered only when the hovered dot changes; a move over the same dot only moves it
function renderTip(sameDot = false) {
  if (!state.data) return;
  const tip = tipHost.querySelector('.tip');
  if (sameDot && tip && ui.hover) { const left = Math.max(ui.free.left + 150, Math.min(ui.free.right - 150, ui.hx)); tip.style.left = left + 'px'; tip.style.top = ui.hy + 'px'; return; }
  render(tooltip({ loc: ui.hover ? state.byLoc.get(ui.hover) : null, val: ui.hover && ui.locValues ? ui.locValues.get(ui.hover) : null, stage: ui.stage, byStore: state.byStore, byProduct: state.byProduct, x: ui.hx, y: ui.hy, free: ui.free }), tipHost);
}

function renderChrome() {
  if (!state.data) return;
  renderTip();
  const open = state.view.kind !== 'city';
  document.body.classList.toggle('no-card', !open);
  document.body.classList.toggle('card-right', open && ui.side === 'right');
  document.body.classList.toggle('card-left', open && ui.side === 'left');
  document.body.classList.toggle('searching', !!(ui.query && ui.results));
  const flat = ui.results ? [...ui.results.groups, ...ui.results.products, ...ui.results.stores] : [];
  const tpl = html`
    ${searchView({ query: ui.query, results: ui.results, active: ui.active,
      onInput: (q) => { ui.query = q; ui.active = -1; ui.results = ui.searchIndex && q ? search(ui.searchIndex, q) : q ? { groups: [], products: [], stores: [], total: -1 } : null; renderChrome(); },
      onClear: () => { ui.query = ''; ui.results = null; ui.active = -1; renderChrome(); requestAnimationFrame(() => { const inp = chrome.querySelector('.search input'); if (inp) inp.focus(); }); },
      onPick: pickResult,
      onKey: ({ key, event, hover }) => {
        if (hover != null) { if (ui.active !== hover) { ui.active = hover; renderChrome(); } return; }
        if (key === 'ArrowDown') { event.preventDefault(); ui.active = Math.min(flat.length - 1, ui.active + 1); renderChrome(); }
        else if (key === 'ArrowUp') { event.preventDefault(); ui.active = Math.max(0, ui.active - 1); renderChrome(); }
        else if (key === 'Enter') { event.preventDefault(); const e = flat[ui.active >= 0 ? ui.active : 0]; if (e) pickResult(e); }
        else if (key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (ui.query) { ui.query = ''; ui.results = null; ui.active = -1; renderChrome(); } else event.target.blur(); }
      },
      onBlur: () => setTimeout(() => { if (!chrome.querySelector('.search').contains(document.activeElement) && ui.results) { ui.results = null; renderChrome(); } }, 150),
      onFocus: () => { if (ui.query && !ui.results && ui.searchIndex) { ui.results = search(ui.searchIndex, ui.query); renderChrome(); } } })}
    ${topRight({ basketCount: state.basket.reduce((n, b) => n + b.qty, 0), basketOn: state.view.kind === 'basket', onBasket: openBasket })}
    ${bottomRight({ settingsOn: state.view.kind === 'settings', onSettings: openSettings, onReset: () => { map.reset(); ui.moved = false; renderChrome(); }, moved: ui.moved })}
    <div class="float bottomleft">${legend({ stage: ui.stage, title: stageTitle(), hasOwn: state.own.length > 0, onResetStage: resetStage, onTitle: state.stage.kind !== 'index' && !['product', 'group', 'basket'].includes(state.view.kind) ? openStageCard : null })}${credit({ retrieved: retrievedDate() })}</div>
    ${timeline({ stage: ui.stage, playing: ui.playing, onWeek: (w) => { stopPlay(); setWeek(w); }, onLive: () => { stopPlay(); setWeek(null); }, onPlay: togglePlay, onStep: stepWeek })}
    ${open ? cardView() : nothing}
    ${toast({ text: ui.toast })}
  `;
  render(tpl, chrome);
  // keep the highlighted search result in view
  const act = chrome.querySelector('.search .item.active');
  if (act) act.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------- boot
async function boot() {
  // Spanish first, always; English is a setting (or ?lang=en), never a guess from the browser.
  setLang(state.prefs.lang || 'es');
  if (state.prefs.tags === undefined) state.prefs.tags = true;
  try { if (!localStorage.getItem('acomo.prefs') && matchMedia('(prefers-reduced-motion: reduce)').matches) state.prefs.motion = false; } catch { /* storage blocked */ }
  document.title = t('appName');
  const msg = veil.querySelector('.msg');
  msg.textContent = t('loading');
  let stageData;
  try { stageData = await loadStage(); }
  catch (e) { console.error(e); msg.className = 'err'; msg.textContent = `${t('loadError')} (${e.message})`; return; }
  const { geo, meta, stores } = stageData;
  setDataYear((meta.latestDate || '').slice(0, 4));
  state.data = { geo, meta, stores, products: [], groups: [], index: null };
  state.byStore = new Map(stores.map((s) => [s.id, s]));
  state.byProduct = new Map(); state.byGroup = new Map();
  state.stage = { kind: 'index' };
  state.locations = buildLocations(stores);
  state.byLoc = new Map(state.locations.map((l) => [l.id, l]));
  state.locOf = new Map(); for (const l of state.locations) for (const sid of l.stores) state.locOf.set(sid, l.id);

  map = createMap(stageHost, geo, state.locations, { motion: () => state.prefs.motion });
  map.setLabels(state.prefs.labels !== false);
  map.onHover((id, x, y) => { const same = id === ui.hover; ui.hover = id; ui.hx = x; ui.hy = y; renderTip(same); });
  map.onClick((id) => {
    const loc = state.byLoc.get(id); if (!loc) return;
    const best = ui.locValues && ui.locValues.get(id);
    openStore((best && best.sid) || loc.stores[0]);
  });
  map.onBackground(() => { if (ui.query) { ui.query = ''; ui.results = null; } if (state.view.kind !== 'city') closeCard(); else renderChrome(); });
  map.onMove(() => { const moved = !map.isAtFit(); if (moved !== ui.moved) { ui.moved = moved; renderChrome(); } });
  veil.classList.add('off');
  setTimeout(() => veil.remove(), 600);

  try { await refreshOwn(); } catch { state.own = []; }

  // the catalogue (search, product and group cards) loads after the stage
  loadCatalog().then(({ products, groups }) => {
    state.data.products = products; state.data.groups = groups;
    state.byProduct = new Map(products.map((p) => [p.id, p]));
    state.byGroup = new Map(groups.map((g) => [g.id, g]));
    ui.searchIndex = buildSearchIndex({ products, groups, stores });
    ui.catalogReady = true;
    if (ui.query) { ui.results = search(ui.searchIndex, ui.query); ui.active = -1; }
    const keep = state.basket.filter((b) => state.byProduct.has(b.id));
    if (keep.length !== state.basket.length) basketReplace(keep);
    if (ui.offer) ui.offer = ui.offer.filter((b) => state.byProduct.has(b.id));
    if (ui.pendingCheck) { ui.pendingCheck = false; validateView(); }
    if (['product', 'group', 'basket'].includes(state.stage.kind)) updateStage();
    renderChrome();
  }).catch((e) => { console.error(e); showToast(t('loadError')); });

  parseHash();
  ui.side = cardSide();
  subscribe((kinds) => {
    if (kinds.has('prefs')) {
      setLang(state.prefs.lang || 'es'); document.title = t('appName');
      map.setLabels(state.prefs.labels !== false);
      if (ui.stage) map.setTags(stageTags(ui.stage, ui.locValues || new Map()));
    }
    if (kinds.has('view')) {
      const wasOpen = !!chrome.querySelector('.card');
      if (!wasOpen && state.view.kind !== 'city') ui.opener = document.activeElement;
      ui.side = cardSide(); ui.showAll = false; ui.storeFilter = '';
      ui.entering = true; renderChrome();
      requestAnimationFrame(() => requestAnimationFrame(() => { ui.entering = false; renderChrome(); }));
      map.clearHover();
      map.setSelected(state.view.kind === 'store' ? locOf(state.view.id) : null);
      if (state.view.kind === 'basket' && state.basket.length && state.stage.kind !== 'basket') state.stage = { kind: 'basket' };
      if (!ui.fromPop) writeHash(true);
      ui.fromPop = false;
      updateStage();
      requestAnimationFrame(() => applyPadding(true));
      // the card scrolls to its top on every switch
      requestAnimationFrame(() => {
        const b = chrome.querySelector('.card .body'); if (b) b.scrollTop = 0;
        const h = chrome.querySelector('.card h2');
        if (h) { announce(h.textContent); if (ui.keyboard) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
        else if (state.view.kind === 'city' && ui.opener && ui.keyboard && document.contains(ui.opener)) { ui.opener.focus({ preventScroll: true }); ui.opener = null; }
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

  const onNav = () => { ui.fromPop = true; stopPlay(); ui.offer = null; parseHash(); };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', () => { if (location.hash !== hashFor(state.view, state.week)) onNav(); });
  window.addEventListener('resize', () => { map.resize(); renderChrome(); requestAnimationFrame(() => applyPadding(false)); });
  // Keyboard: Escape steps back one level (search → card → playback → chosen week → stage);
  // Space plays or pauses; "/" focuses the search; ↑↓ walk a card's list, Enter opens.
  // focus moves only for keyboard readers; a mouse or a finger keeps its place
  window.addEventListener('pointerdown', () => { ui.keyboard = false; }, true);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') ui.keyboard = true;
    if (e.defaultPrevented) return;
    const ae = document.activeElement;
    const inInput = ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName);
    if (e.key === 'Escape') {
      if (inInput) { ae.blur(); return; }
      if (state.view.kind !== 'city') closeCard();
      else if (ui.playing) stopPlay();
      else if (state.week) setWeek(null);
      else if (state.stage.kind !== 'index') resetStage();
    } else if (e.key === ' ' && !inInput && !(ae && ['BUTTON', 'A', 'SUMMARY', 'LI'].includes(ae.tagName)) && ui.stage && ui.stage.weeks && ui.stage.weeks.length > 1) {
      e.preventDefault(); togglePlay();
    } else if (e.key === '/' && !inInput) { e.preventDefault(); const inp = chrome.querySelector('.search input'); if (inp) inp.focus(); }
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && ae && ae.tagName === 'LI' && ae.closest('.card')) {
      e.preventDefault();
      const items = [...ae.closest('.card').querySelectorAll('.rank li[tabindex]')];
      const i = items.indexOf(ae) + (e.key === 'ArrowDown' ? 1 : -1);
      if (items[i]) items[i].focus();
    }
  });
  window.addEventListener('offline', () => showToast(t('offline'), 4000));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e; renderChrome(); });
  ui.phone.addEventListener('change', () => requestAnimationFrame(() => applyPadding(false)));

  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
}

boot();
