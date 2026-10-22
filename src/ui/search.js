// The search field: one box, always visible, that finds generic products, products and stores by
// name (accent-insensitive, every word must match). Keyboard: ↑↓ Enter Esc; the highlighted row
// is announced through aria-activedescendant.
import { html, nothing } from 'lit';
import { t, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { sizeLabel } from '../logic/unit.js';

export function fold(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// n is the number of stores with a recent price (the same count the cards use); the PACIC basics
// get a small lead so "leche" means the milk people buy
export function buildSearchIndex(data) {
  const pacicGroups = new Set(data.products.filter((p) => p.pacic).map((p) => p.group));
  const groups = data.groups.map((g) => ({ kind: 'group', id: g.id, head: fold(g.name), key: fold(g.name), name: g.name, sub: g.category, n: g.stores ?? 0, boost: (pacicGroups.has(g.id) ? 1.2 : 0) - (g.stores ? 0 : 2), ref: g }));
  const products = data.products.map((p) => ({ kind: 'product', id: p.id, head: fold(p.name), brandKey: fold(p.brand || ''), key: fold(`${p.name} ${p.brand || ''} ${p.presentation || ''}`), name: p.name, brand: p.brand, sub: p.presentation, n: p.stores ?? 0, boost: (p.pacic ? 0.4 : 0) + (pacicGroups.has(p.group) ? 1.5 : 0) - (p.stores ? 0 : 2), ref: p }));
  const stores = data.stores.map((s) => ({ kind: 'store', id: s.id, head: fold(`${s.chain} ${s.name}`), key: fold(`${s.chain} ${s.name} ${s.giro || ''} ${s.address || ''} ${s.municipio || ''}`), name: s.name, sub: `${s.chain}${s.municipio ? ' · ' + s.municipio : ''}`, n: s.products, boost: 0, muni: fold(s.municipio || ''), ref: s }));
  // a place by its full name or by the names people use: "neza", "gam", "izcalli", "naucalpan"
  const full = [...new Set(stores.map((e) => e.muni).filter(Boolean))];
  const places = full.map((m) => [m, m]);
  const ALIAS = { neza: 'nezahualcoyotl', gam: 'gustavo a madero', izcalli: 'cuautitlan izcalli', 'magdalena contreras': 'la magdalena contreras', contreras: 'la magdalena contreras', cdmx: null };
  for (const [a, m] of Object.entries(ALIAS)) if (m && full.includes(m)) places.push([a, m]);
  // the first word of a multi-word name when no other municipio starts with it (naucalpan, ecatepec, atizapan)
  for (const m of full) { const w = m.split(' ')[0]; if (w.length >= 5 && w !== m && full.filter((x) => x.split(' ')[0] === w).length === 1 && !full.includes(w)) places.push([w, m]); }
  places.sort((a, b) => b[0].length - a[0].length);
  return { groups, products, stores, places };
}

// PROFECO's product names are Spanish; in English a basic word also matches its Spanish name.
const EN_ES = { milk: 'leche', egg: 'huevo', eggs: 'huevo', tomato: 'jitomate', tomatoes: 'jitomate', rice: 'arroz', bean: 'frijol', beans: 'frijol', oil: 'aceite', sugar: 'azucar', bread: 'pan', chicken: 'pollo', onion: 'cebolla', onions: 'cebolla', potato: 'papa', potatoes: 'papa', coffee: 'cafe', tuna: 'atun', lemon: 'limon', lime: 'limon', apple: 'manzana', apples: 'manzana', banana: 'platano', bananas: 'platano', cheese: 'queso', butter: 'mantequilla', soap: 'jabon', salt: 'sal', flour: 'harina', water: 'agua', beef: 'res', pork: 'cerdo', ham: 'jamon', yogurt: 'yoghurt', chili: 'chile', avocado: 'aguacate', carrot: 'zanahoria', carrots: 'zanahoria', garlic: 'ajo', orange: 'naranja', oranges: 'naranja', lettuce: 'lechuga', paper: 'papel', detergent: 'detergente', diapers: 'pañal', cream: 'crema', chocolate: 'chocolate', beer: 'cerveza', soda: 'refresco', juice: 'jugo', cookies: 'galletas', meat: 'carne', fish: 'pescado', shrimp: 'camaron', corn: 'maiz', lentils: 'lenteja', oats: 'avena', pasta: 'pasta', soup: 'sopa', toothpaste: 'pasta dental', whole: 'entera', skim: 'descremada', skimmed: 'descremada', powdered: 'polvo', evaporated: 'evaporada', condensed: 'condensada' };
// Every word must appear somewhere; a hit in the name (head) at a word start counts most, a hit
// only in the presentation or address counts least. Ties break by how many stores carry it.
function scoreWord(entry, w) {
  const h = entry.head.indexOf(w);
  if (h >= 0) return (h === 0 || entry.head[h - 1] === ' ') ? 6 : 3;
  if (entry.brandKey) { const b = entry.brandKey.indexOf(w); if (b >= 0) return (b === 0 || entry.brandKey[b - 1] === ' ') ? 3 : 1.5; }
  const i = entry.key.indexOf(w);
  if (i < 0) return -1;
  return (i === 0 || entry.key[i - 1] === ' ') ? 1.5 : 0.5;
}
// words: each an array of alternatives (the word, and in English its Spanish name)
function score(entry, words) {
  let sc = 0;
  for (const alts of words) {
    const best = Math.max(...alts.map((w) => scoreWord(entry, w)));
    if (best < 0) return -1;
    sc += best;
  }
  return sc + (entry.n ? Math.min(entry.n, 200) / 200 : 0) + (entry.boost || 0);
}

// a plural also tries its singular: huevos → huevo, limones → limon
const forms = (w) => {
  const out = [w];
  if (w.length > 3 && w.endsWith('s')) {
    out.push(w.slice(0, -1));
    if (w.endsWith('es') && w.length > 4 && /[lnrdjzy]$/.test(w.slice(0, -2))) out.push(w.slice(0, -2));
  }
  return out;
};
export function search(index, query, limits = { groups: 6, products: 8, stores: 5 }) {
  const en = getLang() === 'en';
  let q = fold(query);
  // a municipio named in the query is a place: stores there, products by the other words
  let place = null;
  for (const [alias, m] of index.places || []) { if (` ${q} `.includes(` ${alias} `)) { place = m; q = ` ${q} `.replace(` ${alias} `, ' ').trim(); break; } }
  // English: the word or any of its singular forms may have a Spanish name
  const words = q.split(' ').filter(Boolean).map((w) => { const fs2 = forms(w); const es = fs2.map((x) => EN_ES[x]).find(Boolean); return en && es ? fs2.concat([fold(es)]) : fs2; });
  if (!words.length && !place) return { groups: [], products: [], stores: [], total: 0 };
  const run = (list, n, ws) => list.map((e) => [score(e, ws), e]).filter(([sc]) => sc >= 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, e]) => e);
  const groups = words.length ? run(index.groups, limits.groups, words) : [];
  const products = words.length ? run(index.products, limits.products, words) : [];
  let stores;
  if (place) {
    // in a place, the words pick stores by their chain or name only (never by street address)
    const here = index.stores.filter((e) => e.muni === place);
    const byName = words.length ? here.map((e) => [score({ ...e, key: e.head }, words), e]).filter(([sc]) => sc >= 0).sort((a, b) => b[0] - a[0]).map(([, e]) => e) : [];
    stores = byName.length ? byName.slice(0, 8) : [...here].sort((a, b) => b.n - a.n).slice(0, 8);
    // "soriana coyoacan" is a store in a place: the stores lead, no private-label products
    if (byName.length) return { groups: [], products: [], stores, total: stores.length, place };
  } else stores = run(index.stores, limits.stores, words);
  return { groups, products, stores, total: groups.length + products.length + stores.length, place };
}

export function searchView({ query, results, active, placeholder, onInput, onPick, onClear, onKey, onBlur, onFocus }) {
  const item = (e, i) => html`<button id=${`sr-${i}`} class="item ${i === active ? 'active' : ''}" role="option" aria-selected=${i === active} tabindex="-1"
      @mousedown=${(ev) => ev.preventDefault()} @click=${() => onPick(e)} @mousemove=${() => onKey({ hover: i })}>
    <span class="n">${e.name}${e.brand ? html`<span class="b"> · ${e.brand}</span>` : nothing}</span>
    ${e.kind === 'product' && e.ref.size ? html`<span class="tag">${sizeLabel(e.ref.size, getLang())}</span>` : nothing}
    ${(e.kind === 'product' || e.kind === 'group') && !e.ref.stores ? html`<span class="tag old">${t('noRecentShort')}</span>` : nothing}
    <span class="s">${e.sub || ''}</span>
  </button>`;
  let i = -1;
  const open = !!(query && results);
  return html`<div class="float search" role="search" @focusout=${onBlur}>
    <div class="box">
      ${I.search()}
      <input type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder=${placeholder || t('searchPh')} .value=${query}
        role="combobox" aria-label=${t('searchPh')} aria-expanded=${open} aria-controls="search-list" aria-activedescendant=${open && active >= 0 ? `sr-${active}` : ''}
        @input=${(e) => onInput(e.target.value)} @keydown=${(e) => onKey({ key: e.key, event: e })} @focus=${onFocus} />
      ${query ? html`<button class="clear" title=${t('clear')} aria-label=${t('clear')} @mousedown=${(ev) => ev.preventDefault()} @click=${onClear}>${I.x()}</button>` : nothing}
    </div>
    ${open ? html`<div class="list" role="listbox" id="search-list">
      ${results.total === -1 ? html`<div class="empty">${t('loadingCatalog')}</div>` : results.total === 0 ? html`<div class="empty">${t('noResults')}</div>` : nothing}
      ${results.groups.length ? html`<div role="group" aria-labelledby="sr-h-g"><div class="h" id="sr-h-g">${t('groups')}</div>${results.groups.map((e) => item(e, ++i))}</div>` : nothing}
      ${results.products.length ? html`<div role="group" aria-labelledby="sr-h-p"><div class="h" id="sr-h-p">${t('products')}</div>${results.products.map((e) => item(e, ++i))}</div>` : nothing}
      ${results.stores.length ? html`<div role="group" aria-labelledby="sr-h-s"><div class="h" id="sr-h-s">${t('stores')}</div>${results.stores.map((e) => item(e, ++i))}</div>` : nothing}
    </div>` : nothing}
  </div>`;
}
