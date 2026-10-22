// One mutable state object, a subscribe/notify pair, and the preferences that persist.
// Views are discrete levels: city (index), store, product, group, basket. The week is a
// separate axis: null means the latest week; a 'YYYY-MM-DD' Monday means the scrubber moved.

const PREFS_KEY = 'acomo.prefs';
const BASKET_KEY = 'acomo.basket';

function readJson(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or full: the app still works */ }
}

export const state = {
  // motion stays unset until the reader touches the switch, so the OS setting can decide
  prefs: Object.assign({ lang: null, labels: true }, readJson(PREFS_KEY, {})),
  basket: readJson(BASKET_KEY, []), // [{ id, qty }]
  view: { kind: 'city', id: null },
  week: null,
  hover: null,
  playing: false,
  data: null,      // { meta, stores, products, groups, geo, index }
  byStore: null,   // Map id -> store
  byProduct: null, // Map id -> product summary
  byGroup: null,   // Map id -> group
  own: [],         // the reader's own prices, loaded from IndexedDB
  online: navigator.onLine,
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
// Notifications coalesce per microtask but none is lost: subscribers receive the Set of every
// kind raised in that tick ('view', 'week', 'basket', 'stage', 'prefs', ...). The first version
// kept only the first kind, so a link carrying ?lang= swallowed the 'view' that followed it.
let pending = null;
export function notify(what = 'state') {
  if (pending) { pending.add(what); return; }
  pending = new Set([what]);
  queueMicrotask(() => { const kinds = pending; pending = null; for (const fn of subs) fn(kinds); });
}

export function setPref(key, value) {
  state.prefs[key] = value;
  writeJson(PREFS_KEY, state.prefs);
  notify('prefs');
}

export function setView(kind, id = null) {
  if (state.view.kind === kind && state.view.id === id) return;
  state.view = { kind, id };
  notify('view');
}

export function setWeek(week) {
  if (state.week === week) return;
  state.week = week;
  notify('week');
}

export function basketAdd(id, qty = 1) {
  const it = state.basket.find((b) => b.id === id);
  if (it) it.qty = Math.min(99, it.qty + qty); else state.basket.push({ id, qty: Math.min(99, qty) });
  writeJson(BASKET_KEY, state.basket);
  notify('basket');
}
export function basketSet(id, qty) {
  const i = state.basket.findIndex((b) => b.id === id);
  if (qty <= 0) { if (i >= 0) state.basket.splice(i, 1); }
  else if (i >= 0) state.basket[i].qty = Math.min(99, qty);
  else state.basket.push({ id, qty: Math.min(99, qty) });
  writeJson(BASKET_KEY, state.basket);
  notify('basket');
}
export function basketRemove(id) { basketSet(id, 0); }
export function basketReplace(items) {
  state.basket = items.filter((b) => b && b.id && b.qty > 0);
  writeJson(BASKET_KEY, state.basket);
  notify('basket');
}
export function inBasket(id) { return state.basket.some((b) => b.id === id); }
