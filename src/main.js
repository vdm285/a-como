// Boot: load the stage, draw the map, wire state → map colours and the floating chrome,
// route the hash, listen to the keyboard. The map is created once outside lit; lit renders
// only the chrome and the card.
import '@fontsource-variable/manrope';
import './style.css';
import { html, render, nothing } from 'lit';
import { state, subscribe, notify, setPref, setView, setWeek, basketAdd, basketSet, basketReplace, inBasket } from './app/state.js';
import { t, setLang, getLang, money } from './app/i18n.js';
import { loadStage, loadCatalog, loadProduct } from './data/qqp.js';
import { createMap } from './map/map.js';
import { computeStage } from './app/stage.js';
import { buildSearchIndex, search, searchView } from './ui/search.js';
import { topRight, bottomRight, legend, credit, scrubber, tooltip, toast } from './ui/chrome.js';
import { storeCard, productCard, groupCard, basketCard, settingsCard } from './ui/cards.js';
import { listOwn, addOwn, deleteOwn, importOwn, persistStorage, ownToJson, ownToCsv, download } from './local/prices.js';

const app = document.getElementById('app');
const stageHost = document.createElement('div'); stageHost.id = 'stage'; app.appendChild(stageHost);
const chrome = document.createElement('div'); chrome.id = 'chrome'; app.appendChild(chrome);
const veil = document.createElement('div'); veil.className = 'veil'; veil.innerHTML = '<div class="logo">A cómo</div><div class="msg"></div>'; app.appendChild(veil);

const ui = {
  query: '', results: null, active: -1, searchIndex: null,
  hover: null, hx: 0, hy: 0,
  toast: '', toastTimer: null,
  stage: null, stageToken: 0,
  storeFiles: new Map(), storeFilter: '', showAll: false, onlyComplete: false,
  entering: false, side: 'right',
  installPrompt: null, playTimer: null,
  phone: matchMedia('(max-width: 720px)'),
};
let map = null;
const BASE = import.meta.env.BASE_URL;

function showToast(text, ms = 2200) {
  ui.toast = text; renderChrome();
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(() => { ui.toast = ''; renderChrome(); }, ms);
}

// ---------------------------------------------------------------- routing
function parseHash() {
  const raw = location.hash.replace(/^#/, '');
  const [pathPart, queryPart] = raw.split('?');
  const q = new URLSearchParams(queryPart || '');
  const [kind, id] = pathPart.split('/');
  const lang = q.get('lang');
  if (lang && lang !== getLang()) { setLang(lang); setPref('lang', lang); }
  const items = q.get('items');
  if (items) basketReplace(items.split(',').map((s) => { const [pid, qty] = s.split(':'); return { id: pid, qty: Math.max(1, Number(qty) || 1) }; }));
  const week = q.get('w');
  state.week = week || null;
  const views = { t: 'store', p: 'product', g: 'group', c: 'basket', s: 'settings' };
  const v = views[kind];
  if (v === 'product' || v === 'group') state.stage = { kind: v, id };
  if (v === 'basket' && state.basket.length) state.stage = { kind: 'basket' };
  state.view = v ? { kind: v, id: id || null } : { kind: 'city', id: null };
  notify('view');
}
function writeHash() {
  const kinds = { store: 't', product: 'p', group: 'g', basket: 'c', settings: 's' };
  let h = state.view.kind === 'city' ? '' : `${kinds[state.view.kind]}${state.view.id ? '/' + state.view.id : ''}`;
  const q = new URLSearchParams();
  if (state.week) q.set('w', state.week);
  const qs = q.toString();
  const next = '#' + h + (qs ? '?' + qs : '');
  if (location.hash !== next && !(next === '#' && !location.hash)) history.replaceState(null, '', next === '#' ? location.pathname + location.search : next);
}

// ---------------------------------------------------------------- stage
async function updateStage() {
  if (!state.data) return;
  const tok = ++ui.stageToken;
  try {
    const res = await computeStage(state.stage, state.week);
    if (tok !== ui.stageToken) return;
    ui.stage = res;
    if (res) map.setColors(res.colors); else map.setColors(null);
  } catch (e) {
    console.error(e);
    if (tok !== ui.stageToken) return;
    showToast(t('loadError'));
  }
  renderChrome();
}

function cardSide() {
  if (state.view.kind === 'store') {
    const xy = map.screenXY(state.view.id);
    const [W] = map.size();
    if (xy) return xy[0] < W / 2 ? 'right' : 'left';
  }
  return 'right';
}
function applyPadding(animate = true) {
  const open = state.view.kind !== 'city';
  const [, H] = map.size();
  const cardW = 400;
  if (ui.phone.matches) map.setPadding({ left: 20, right: 20, top: 70, bottom: open ? Math.round(H * 0.58) + 16 : 60 }, animate);
  else map.setPadding({ left: ui.side === 'left' && open ? cardW + 34 : 24, right: ui.side === 'right' && open ? cardW + 34 : 24, top: 70, bottom: 70 }, animate);
}

// ---------------------------------------------------------------- actions
function openStore(id) { setView('store', id); }
function openProduct(id) { state.stage = { kind: 'product', id }; setView('product', id); loadProduct(id).then(() => renderChrome()).catch(() => {}); }
function openGroup(id) { state.stage = { kind: 'group', id }; setView('group', id); }
function openBasket() { if (state.basket.length) state.stage = { kind: 'basket' }; setView(state.view.kind === 'basket' ? 'city' : 'basket'); }
function openSettings() { setView(state.view.kind === 'settings' ? 'city' : 'settings'); }
function closeCard() { setView('city'); }
function resetStage() { state.stage = { kind: 'index' }; state.week = null; notify('stage'); }

function copyLink(extra = '') {
  const url = `${location.origin}${location.pathname}${location.hash || '#'}${extra}`;
  navigator.clipboard.writeText(url).then(() => showToast(t('copied')), () => showToast(url));
}

async function addOwnPrice({ productId, storeId, price }) {
  try {
    const rec = await addOwn({ productId, storeId, price });
    state.own = await listOwn();
    map.setOwn(new Set(state.own.map((o) => o.storeId)));
    const s = state.byStore.get(storeId);
    showToast(t('ownSaved', { price: money(rec.price), store: s ? s.name : storeId }));
    persistStorage();
    renderChrome();
  } catch (e) { console.error(e); }
}
async function removeOwn(id) {
  await deleteOwn(id);
  state.own = await listOwn();
  map.setOwn(new Set(state.own.map((o) => o.storeId)));
  renderChrome();
}

function togglePlay() {
  if (ui.playTimer) { clearInterval(ui.playTimer); ui.playTimer = null; state.playing = false; renderChrome(); return; }
  const st = ui.stage; if (!st || !st.weeks || st.weeks.length < 2) return;
  state.playing = true;
  let i = st.weekIdx == null ? 0 : (st.weekIdx + 1) % st.weeks.length;
  setWeek(st.weeks[i]);
  ui.playTimer = setInterval(() => {
    const s = ui.stage; if (!s || !s.weeks) return;
    i = (s.weekIdx == null ? s.weeks.length - 1 : s.weekIdx) + 1;
    if (i >= s.weeks.length) { clearInterval(ui.playTimer); ui.playTimer = null; state.playing = false; setWeek(null); renderChrome(); return; }
    setWeek(s.weeks[i]);
  }, 700);
  renderChrome();
}

// ---------------------------------------------------------------- render
function cardView() {
  const v = state.view;
  const common = { side: ui.side, entering: ui.entering, onClose: closeCard, onOpenStore: openStore, onOpenProduct: openProduct, onOpenGroup: openGroup, showAll: ui.showAll, onShowAll: () => { ui.showAll = true; renderChrome(); }, selectedStore: v.kind === 'store' ? v.id : null, onPickWeek: (w) => setWeek(w), onDeleteOwn: removeOwn };
  if (v.kind === 'store') {
    const store = state.byStore.get(v.id);
    if (!store) return nothing;
    let file = ui.storeFiles.get(v.id);
    if (file === undefined) {
      ui.storeFiles.set(v.id, null);
      fetch(`${BASE}data/qqp/stores/${v.id}.json`).then((r) => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null)).then((j) => { ui.storeFiles.set(v.id, j || { items: [] }); renderChrome(); }).catch(() => { ui.storeFiles.set(v.id, { items: [] }); renderChrome(); });
      file = null;
    }
    return storeCard({ ...common, store, storeFile: file, byProduct: state.byProduct, byGroup: state.byGroup, stage: ui.stage, own: state.own, filter: ui.storeFilter, onFilter: (q) => { ui.storeFilter = q; renderChrome(); } });
  }
  if (v.kind === 'product') {
    const summary = state.byProduct && state.byProduct.get(v.id);
    if (!summary) return nothing;
    // the product file arrives through the stage result (computeStage loads it)
    const ranked = ui.stage && ui.stage.kind === 'product' && ui.stage.id === v.id ? ui.stage : null;
    const storeOptions = ranked ? [...ranked.values].filter(([, x]) => x.value != null).map(([sid]) => state.byStore.get(sid)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es')) : state.data.stores;
    const defaultStore = ui.lastStore && storeOptions.some((s) => s.id === ui.lastStore) ? ui.lastStore : (storeOptions[0] && storeOptions[0].id);
    return productCard({ ...common, summary, file: ranked ? ranked.product : null, stage: ui.stage, byStore: state.byStore, byGroup: state.byGroup, own: state.own, inBasket: inBasket(v.id), storeOptions, defaultStore,
      onToggleBasket: () => { if (inBasket(v.id)) basketSet(v.id, 0); else basketAdd(v.id, 1); },
      onCopyLink: () => copyLink(),
      onAddOwn: ({ price, storeId }) => { ui.lastStore = storeId; addOwnPrice({ productId: v.id, storeId, price }); } });
  }
  if (v.kind === 'group') {
    const group = state.byGroup && state.byGroup.get(v.id);
    if (!group) return nothing;
    const members = state.data.products.filter((p) => p.group === v.id);
    return groupCard({ ...common, group, members, stage: ui.stage, byStore: state.byStore, byProduct: state.byProduct });
  }
  if (v.kind === 'basket') {
    return basketCard({ ...common, items: state.basket, byProduct: state.byProduct, byStore: state.byStore, stage: ui.stage && ui.stage.kind === 'basket' ? ui.stage : null, onlyComplete: ui.onlyComplete,
      onOnlyComplete: (b) => { ui.onlyComplete = b; renderChrome(); },
      onQty: (id, qty) => basketSet(id, qty),
      onClear: () => basketReplace([]),
      onCopyLink: () => copyLink(`${location.hash.includes('?') ? '&' : '?'}items=${state.basket.map((b) => `${b.id}:${b.qty}`).join(',')}`) });
  }
  if (v.kind === 'settings') {
    return settingsCard({ ...common, prefs: state.prefs, own: state.own, byProduct: state.byProduct, byStore: state.byStore, meta: state.data.meta, canInstall: !!ui.installPrompt,
      onPref: (k, val) => { setPref(k, val); if (k === 'lang') { setLang(val); document.title = t('appName'); } if (k === 'labels') map.setLabels(val); renderChrome(); },
      onInstall: async () => { const p = ui.installPrompt; if (!p) return; p.prompt(); const r = await p.userChoice; if (r && r.outcome === 'accepted') { ui.installPrompt = null; showToast(t('installed')); } renderChrome(); },
      onExport: (kind) => { const rows = state.own; const lookup = { product: (id) => state.byProduct.get(id), store: (id) => state.byStore.get(id) }; if (kind === 'csv') download('acomo-mis-precios.csv', ownToCsv(rows, lookup), 'text/csv'); else download('acomo-mis-precios.json', ownToJson(rows)); },
      onImport: async (f) => { if (!f) return; try { const j = JSON.parse(await f.text()); const n = await importOwn(j.prices || j); state.own = await listOwn(); map.setOwn(new Set(state.own.map((o) => o.storeId))); showToast(`+${n}`); renderChrome(); } catch (e) { showToast(t('loadError')); } } });
  }
  return nothing;
}

function renderChrome() {
  if (!state.data) return;
  const open = state.view.kind !== 'city';
  document.body.classList.toggle('no-card', !open);
  const tpl = html`
    ${searchView({ query: ui.query, results: ui.results, active: ui.active,
      onInput: (q) => { ui.query = q; ui.active = -1; ui.results = ui.searchIndex && q ? search(ui.searchIndex, q) : null; renderChrome(); },
      onClear: () => { ui.query = ''; ui.results = null; ui.active = -1; renderChrome(); },
      onPick: (e) => { ui.query = ''; ui.results = null; ui.active = -1; if (e.kind === 'group') openGroup(e.id); else if (e.kind === 'product') openProduct(e.id); else { openStore(e.id); map.zoomTo(e.id, 4); } },
      onKey: ({ key, event, hover }) => {
        if (hover != null) { if (ui.active !== hover) { ui.active = hover; renderChrome(); } return; }
        const flat = ui.results ? [...ui.results.groups, ...ui.results.products, ...ui.results.stores] : [];
        if (key === 'ArrowDown') { event.preventDefault(); ui.active = Math.min(flat.length - 1, ui.active + 1); renderChrome(); }
        else if (key === 'ArrowUp') { event.preventDefault(); ui.active = Math.max(0, ui.active - 1); renderChrome(); }
        else if (key === 'Enter') { event.preventDefault(); const e = flat[ui.active >= 0 ? ui.active : 0]; if (e) { ui.query = ''; ui.results = null; ui.active = -1; if (e.kind === 'group') openGroup(e.id); else if (e.kind === 'product') openProduct(e.id); else { openStore(e.id); map.zoomTo(e.id, 4); } } }
        else if (key === 'Escape') { ui.query = ''; ui.results = null; ui.active = -1; event.target.blur(); renderChrome(); }
      } })}
    ${topRight({ basketCount: state.basket.reduce((n, b) => n + b.qty, 0), basketOn: state.view.kind === 'basket', onBasket: openBasket })}
    ${bottomRight({ settingsOn: state.view.kind === 'settings', onSettings: openSettings, onReset: () => map.reset(), zoomed: ui.zoomed })}
    <div class="float bottomleft">${legend({ stage: ui.stage, meta: state.data.meta, hasOwn: state.own.length > 0, onResetStage: resetStage })}${credit({ meta: state.data.meta })}</div>
    ${scrubber({ stage: ui.stage, playing: state.playing, onWeek: (w) => { if (ui.playTimer) togglePlay(); setWeek(w); }, onPlay: togglePlay, onLive: () => { if (ui.playTimer) togglePlay(); setWeek(null); } })}
    ${open ? cardView() : nothing}
    ${tooltip({ hover: ui.hover, stage: ui.stage, byStore: state.byStore, byProduct: state.byProduct, x: ui.hx, y: ui.hy })}
    ${toast({ text: ui.toast })}
  `;
  render(tpl, chrome);
}

// ---------------------------------------------------------------- boot
async function boot() {
  setLang(state.prefs.lang || ((navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es'));
  document.title = t('appName');
  const msg = veil.querySelector('.msg');
  msg.textContent = t('loading');
  let stageData;
  try { stageData = await loadStage(); }
  catch (e) { console.error(e); msg.className = 'err'; msg.textContent = `${t('loadError')} (${e.message})`; return; }
  const { geo, meta, stores } = stageData;
  state.data = { geo, meta, stores, products: [], groups: [], index: null };
  state.byStore = new Map(stores.map((s) => [s.id, s]));
  state.byProduct = new Map(); state.byGroup = new Map();
  state.stage = { kind: 'index' };

  map = createMap(stageHost, geo, stores, { motion: () => state.prefs.motion });
  map.setLabels(state.prefs.labels !== false);
  map.onHover((id, x, y) => { ui.hover = id; ui.hx = x; ui.hy = y; renderChrome(); });
  map.onClick((id) => { ui.lastStore = id; openStore(id); });
  map.onBackground(() => { if (ui.query) { ui.query = ''; ui.results = null; } if (state.view.kind !== 'city') closeCard(); else renderChrome(); });
  map.onMove(() => { const z = map.zoom() > 1.05; if (z !== ui.zoomed) { ui.zoomed = z; renderChrome(); } });
  veil.classList.add('off');
  setTimeout(() => veil.remove(), 600);

  // own prices
  try { state.own = await listOwn(); map.setOwn(new Set(state.own.map((o) => o.storeId))); } catch { state.own = []; }

  // catalog (search needs it; the stage does not)
  loadCatalog().then(({ products, groups }) => {
    state.data.products = products; state.data.groups = groups;
    state.byProduct = new Map(products.map((p) => [p.id, p]));
    state.byGroup = new Map(groups.map((g) => [g.id, g]));
    ui.searchIndex = buildSearchIndex({ products, groups, stores });
    // drop basket items that no longer exist
    const keep = state.basket.filter((b) => state.byProduct.has(b.id));
    if (keep.length !== state.basket.length) basketReplace(keep);
    if (state.view.kind === 'product' || state.view.kind === 'group') { updateStage(); }
    renderChrome();
  }).catch((e) => { console.error(e); showToast(t('loadError')); });

  parseHash();
  ui.side = cardSide();
  applyPadding(false);
  subscribe((what) => {
    if (what === 'view') {
      const side = cardSide();
      ui.side = side; ui.showAll = false; ui.storeFilter = '';
      ui.entering = true; renderChrome();
      requestAnimationFrame(() => requestAnimationFrame(() => { ui.entering = false; renderChrome(); }));
      map.setSelected(state.view.kind === 'store' ? state.view.id : null);
      applyPadding(true);
      writeHash();
      if (state.view.kind === 'basket' && state.basket.length && (!ui.stage || ui.stage.kind !== 'basket')) { state.stage = { kind: 'basket' }; }
      updateStage();
    } else if (what === 'week') { writeHash(); updateStage(); }
    else if (what === 'basket') { if (state.stage.kind === 'basket' || state.view.kind === 'basket') { state.stage = state.basket.length ? { kind: 'basket' } : { kind: 'index' }; } updateStage(); renderChrome(); }
    else if (what === 'stage') { updateStage(); }
    else renderChrome();
  });
  updateStage();
  renderChrome();

  window.addEventListener('hashchange', parseHash);
  window.addEventListener('resize', () => { map.resize(); applyPadding(false); renderChrome(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (state.view.kind !== 'city') closeCard();
      else if (ui.stage && ui.stage.kind !== 'index') resetStage();
    }
    if (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); const inp = chrome.querySelector('.search input'); if (inp) inp.focus(); }
  });
  window.addEventListener('online', () => renderChrome());
  window.addEventListener('offline', () => showToast(t('offline'), 4000));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installPrompt = e; renderChrome(); });

  if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {});
}

boot();
