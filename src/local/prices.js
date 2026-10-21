// The reader's own shelf prices: IndexedDB in this browser only, never uploaded. Append-only
// events (a price seen at a store on a date), exportable as JSON and CSV, importable back.
// Falls back to localStorage when IndexedDB is unavailable (some private modes).

const DB = 'acomo', STORE = 'prices', LS_KEY = 'acomo.own';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return resolve(null);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('productId', 'productId');
        os.createIndex('storeId', 'storeId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

let dbPromise = null;
function db() { if (!dbPromise) dbPromise = openDb(); return dbPromise; }

function lsRead() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function lsWrite(rows) { try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); } catch { /* ignore */ } }

function tx(d, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const os = t.objectStore(STORE);
    const out = fn(os);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function listOwn() {
  const d = await db();
  let rows;
  if (d) rows = await tx(d, 'readonly', (os) => os.getAll());
  else rows = lsRead();
  return (rows || []).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.id || 0) - (a.id || 0));
}

export async function addOwn({ productId, storeId, price, date, note }) {
  const rec = { productId, storeId, price: Number(price), date: date || new Date().toISOString().slice(0, 10), note: note || '', created: new Date().toISOString() };
  if (!(rec.price > 0) || !productId || !storeId) throw new Error('invalid own price');
  const d = await db();
  if (d) { rec.id = await tx(d, 'readwrite', (os) => os.add(rec)); return rec; }
  const rows = lsRead();
  rec.id = (rows.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
  rows.push(rec); lsWrite(rows);
  return rec;
}

export async function deleteOwn(id) {
  const d = await db();
  if (d) { await tx(d, 'readwrite', (os) => os.delete(id)); return; }
  lsWrite(lsRead().filter((r) => r.id !== id));
}

export async function importOwn(rows) {
  let n = 0;
  for (const r of rows || []) {
    if (!r || !r.productId || !r.storeId || !(Number(r.price) > 0)) continue;
    await addOwn({ productId: r.productId, storeId: r.storeId, price: Number(r.price), date: r.date, note: r.note });
    n++;
  }
  return n;
}

export async function persistStorage() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return false;
}

// ---- export ----
export function ownToJson(rows) {
  return JSON.stringify({ app: 'acomo', version: 1, exported: new Date().toISOString(), prices: rows }, null, 2);
}
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
export function ownToCsv(rows, lookup = {}) {
  const head = ['date', 'price', 'productId', 'product', 'brand', 'presentation', 'storeId', 'store', 'chain', 'address', 'note'];
  const lines = [head.join(',')];
  for (const r of rows) {
    const p = lookup.product ? lookup.product(r.productId) : null;
    const s = lookup.store ? lookup.store(r.storeId) : null;
    lines.push([r.date, r.price, r.productId, p && p.name, p && p.brand, p && p.presentation, r.storeId, s && s.name, s && s.chain, s && s.address, r.note].map(csvCell).join(','));
  }
  return '﻿' + lines.join('\r\n');
}
export function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
