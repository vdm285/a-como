// The search field: one box, always visible, that finds generic products, products and stores by
// name (accent-insensitive, every word must match). Keyboard: ↑↓ Enter Esc; the highlighted row
// is announced through aria-activedescendant.
import { html, nothing } from 'lit';
import { t, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { sizeLabel } from '../logic/unit.js';

// (ñ is kept: NFD split it into n and a tilde, so "pan" found Pañales and "piña" Pinaverio)
export function fold(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/ñ/g, 'ñ').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// n is the number of stores with a recent price (the same count the cards use); the PACIC basics
// get a small lead so "leche" means the milk people buy
export function buildSearchIndex(data) {
  const pacicGroups = new Set(data.products.filter((p) => p.pacic).map((p) => p.group));
  const groups = data.groups.map((g) => ({ kind: 'group', id: g.id, head: fold(g.name), key: fold(g.name), name: g.name, sub: g.category, n: g.stores ?? 0, boost: (pacicGroups.has(g.id) ? 1.2 : 0) - (g.stores ? 0 : 2), ref: g }));
  const products = data.products.map((p) => ({ kind: 'product', id: p.id, head: fold(p.name), brandKey: fold(p.brand || ''), key: fold(`${p.name} ${p.brand || ''} ${p.presentation || ''}`), name: p.name, brand: p.brand, sub: p.presentation, n: p.stores ?? 0, boost: (p.pacic ? 0.4 : 0) + (pacicGroups.has(p.group) ? 1.5 : 0) - (p.stores ? 0 : 2), ref: p }));
  const stores = data.stores.map((s) => ({ kind: 'store', id: s.id, head: fold(`${s.chain} ${s.name}`), chainKey: fold(s.chain), key: fold(`${s.chain} ${s.name} ${s.giro || ''} ${s.address || ''} ${s.municipio || ''}`), name: s.name, sub: `${s.chain}${s.municipio ? ' · ' + s.municipio : ''}`, n: s.products, boost: 0, muni: fold(s.municipio || ''), ref: s }));
  // the same fields without ñ, for a reader who types "costena" or "jalapeno"
  for (const e of [...groups, ...products, ...stores]) if (e.key.includes('ñ') || e.head.includes('ñ')) e.alt = { head: e.head.replace(/ñ/g, 'n'), brandKey: (e.brandKey || '').replace(/ñ/g, 'n'), key: e.key.replace(/ñ/g, 'n') };
  // a product's presentation alone, where an English word's Spanish name may be a whole word
  for (const e of products) e.presKey = fold(e.ref.presentation || '');
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
const EN_ES = { milk: 'leche', egg: 'huevo', eggs: 'huevo', tomato: 'jitomate', tomatoes: 'jitomate', rice: 'arroz', bean: 'frijol', beans: 'frijol', oil: 'aceite', sugar: 'azucar', bread: 'pan', chicken: 'pollo', onion: 'cebolla', onions: 'cebolla', potato: 'papa', potatoes: 'papa', coffee: 'cafe', tuna: 'atun', lemon: 'limon', lime: 'limon', apple: 'manzana', apples: 'manzana', banana: 'platano', bananas: 'platano', cheese: 'queso', butter: 'mantequilla', soap: 'jabon', salt: 'sal', flour: 'harina', water: 'agua', beef: 'res', pork: 'cerdo', ham: 'jamon', yogurt: 'yoghurt', chili: 'chile', avocado: 'aguacate', carrot: 'zanahoria', carrots: 'zanahoria', garlic: 'ajo', orange: 'naranja', oranges: 'naranja', lettuce: 'lechuga', paper: 'papel', detergent: 'detergente', diapers: 'pañal', cream: 'crema', chocolate: 'chocolate', beer: 'cerveza', soda: 'refresco', juice: 'jugo', cookies: 'galletas', meat: 'carne', fish: 'pescado', shrimp: 'camaron', corn: 'maiz', lentils: 'lenteja', oats: 'avena', pasta: 'pasta', soup: 'sopa', toothpaste: 'crema dental', whole: 'entera', skim: 'descremada', skimmed: 'descremada', powdered: 'polvo', evaporated: 'evaporada', condensed: 'condensada', chilies: 'chile', chillies: 'chile', chilli: 'chile', pineapple: 'piña', mango: 'mango', papaya: 'papaya', watermelon: 'sandia', melon: 'melon', grape: 'uva', strawberry: 'fresa', strawberries: 'fresa', pear: 'pera', peach: 'durazno', peaches: 'durazno', cucumber: 'pepino', zucchini: 'calabaza', spinach: 'espinaca', cabbage: 'col', broccoli: 'brocoli', sausage: 'salchicha', turkey: 'pavo', bleach: 'blanqueador', toilet: 'higienico', napkins: 'servilletas', deodorant: 'desodorante', sardine: 'sardina', sardines: 'sardina', peanut: 'cacahuate', walnut: 'nuez', nut: 'nuez', almond: 'almendra', honey: 'miel', jam: 'mermelada', mayonnaise: 'mayonesa', vinegar: 'vinagre', pepper: 'pimienta', cinnamon: 'canela', wine: 'vino', tortillas: 'tortilla', cereal: 'cereal', noodles: 'sopa', lard: 'manteca', margarine: 'margarina', green: 'verde', white: 'blanco', black: 'negro', brown: 'morena', red: 'rojo', yellow: 'amarillo', olive: 'oliva', ground: 'molida', breast: 'pechuga', sliced: 'rebanado', instant: 'soluble', sparkling: 'con gas', still: 'sin gas', dish: 'trastes', laundry: 'ropa', fresh: 'fresco', frozen: 'congelado', dried: 'seco', dry: 'seco', powder: 'polvo', sweet: 'dulce', liquid: 'liquido', bar: 'barra', canned: 'lata', decaf: 'descafeinado', baby: 'bebe' };
const EN_PHRASES = [['dish soap', 'trastes'], ['dishwashing liquid', 'trastes'], ['peanut butter', 'crema de cacahuate'], ['baking soda', 'bicarbonato'], ['hot sauce', 'salsa picante'], ['sour cream', 'crema'], ['tomato puree', 'pure de tomate'], ['tomato sauce', 'pure de tomate']];
// Every word must appear somewhere; a whole word in the name (head) counts most ("pan" is Pan
// before Queso Panela), then a word start, then a hit inside a word; a hit only in the
// presentation or address counts least. Ties break by how many stores carry it.
const wordEnd = (s, j) => j >= s.length || s[j] === ' ' || (s[j] === 's' && (j + 1 >= s.length || s[j + 1] === ' ')) || (s.startsWith('es', j) && (j + 2 >= s.length || s[j + 2] === ' '));
function scoreCore(entry, w) {
  let h = entry.head.indexOf(w), best = -1;
  while (h >= 0) {
    const start = h === 0 || entry.head[h - 1] === ' ';
    best = Math.max(best, start ? (wordEnd(entry.head, h + w.length) ? 9 : 6) : 3);
    if (best === 9) break;
    h = entry.head.indexOf(w, h + 1);
  }
  if (best >= 0) return best;
  if (entry.brandKey) { const b = entry.brandKey.indexOf(w); if (b >= 0) return (b === 0 || entry.brandKey[b - 1] === ' ') ? (wordEnd(entry.brandKey, b + w.length) ? 5 : 3.5) : 1.4; }
  // a whole word of the presentation counts like a whole word of the brand ("leche entera" is the
  // UHT carton "Entera", not the powdered milk whose brand line says "Entera")
  const i = entry.key.indexOf(w);
  if (i < 0) return -1;
  return (i === 0 || entry.key[i - 1] === ' ') ? (wordEnd(entry.key, i + w.length) ? 5 : 1.5) : 0.5;
}
// a hit only without the ñ is one step weaker: "pina" as a whole word is Piña (like a prefix),
// a mere start ("pan" in "panales") is as weak as a hit inside a word
const ALT_SCORE = { 9: 6, 6: 3, 3: 3, 5: 5, 3.5: 1.4, 1.4: 1.4, 1.5: 0.5, 0.5: 0.5 };
// An English word's Spanish name counts only as a whole word of the name or the presentation,
// never a prefix ("bread" → "pan" listed Pantiprotectores) nor a brand ("green" → "verde" listed
// Verde Valle dried chilies)
function scoreWhole(entry, w) {
  const whole = (s) => { let i = s.indexOf(w); while (i >= 0) { if ((i === 0 || s[i - 1] === ' ') && wordEnd(s, i + w.length)) return true; i = s.indexOf(w, i + 1); } return false; };
  if (whole(entry.head) || (entry.alt && whole(entry.alt.head))) return 9;
  if (entry.presKey && whole(entry.presKey)) return 5;
  return -1;
}
function scoreWord(entry, w) {
  if (w[0] === '=') return scoreWhole(entry, w.slice(1));
  const s = scoreCore(entry, w);
  if (s >= 0 || !entry.alt) return s;
  const a = scoreCore(entry.alt, w);
  return a >= 0 ? ALT_SCORE[a] ?? a : -1;
}
// the scores of a hit inside a word ("nido" in Difenidol), dropped when anything matches better
const INSIDE = new Set([3, 1.4, 0.5]);
// words: each an array of alternatives (the word, and in English its Spanish name)
function scoreFull(entry, words) {
  let sc = 0, inside = false;
  for (const alts of words) {
    const best = Math.max(...alts.map((w) => scoreWord(entry, w)));
    if (best < 0) return [-1, true];
    if (INSIDE.has(best)) inside = true;
    sc += best;
  }
  return [sc + (entry.n ? Math.min(entry.n, 200) / 200 : 0) + (entry.boost || 0), inside];
}
const score = (entry, words) => scoreFull(entry, words)[0];

// a plural also tries its singular: huevos → huevo, limones → limon
const forms = (w) => {
  const out = [w];
  if (w.length > 3 && w.endsWith('s')) {
    out.push(w.slice(0, -1));
    if (w.endsWith('es') && w.length > 4 && /[lnrdjzy]$/.test(w.slice(0, -2))) out.push(w.slice(0, -2));
    // -ces is the plural of -z: nueces → nuez, arroces → arroz
    if (w.endsWith('ces') && w.length > 4) out.push(`${w.slice(0, -3)}z`);
  }
  return out;
};
// English: when every word together finds nothing, the first words are left out one by one
// (modifiers come first: "baby diapers" is diapers, "cooking oil" is oil), and the list says which
export function search(index, query, limits) {
  const r = searchOnce(index, query, limits);
  if (r.total !== 0 || getLang() !== 'en') return r;
  const ws = fold(query).split(' ').filter(Boolean);
  for (let i = 1; i < ws.length; i++) {
    const r2 = searchOnce(index, ws.slice(i).join(' '), limits);
    if (r2.total > 0) return { ...r2, dropped: [...ws.slice(0, i), ...(r2.dropped || [])] };
  }
  return r;
}
function searchOnce(index, query, limits = { groups: 6, products: 8, stores: 5 }) {
  const en = getLang() === 'en';
  let q = fold(query);
  // English phrases whose Spanish name is not word for word
  if (en) for (const [ph, es] of EN_PHRASES) if (` ${q} `.includes(` ${ph} `)) q = ` ${q} `.replace(` ${ph} `, ` ${es} `).trim();
  // a municipio named in the query is a place: stores there, products by the other words
  let place = null;
  for (const [alias, m] of index.places || []) { if (` ${q} `.includes(` ${alias} `)) { place = m; q = ` ${q} `.replace(` ${alias} `, ' ').trim(); break; } }
  // English: the word or any of its singular forms may have a Spanish name
  const words = q.split(' ').filter(Boolean).map((w) => { const fs2 = forms(w); const es = fs2.map((x) => EN_ES[x]).find(Boolean); return en && es ? fs2.concat([`=${fold(es)}`]) : fs2; });
  // English: a word that matches nothing anywhere is left out rather than emptying the list
  // ("baby diapers": "baby" is only in a brand), and the list says which (the reader sees the rest)
  let dropped = [];
  if (en && words.length > 1) {
    const hits = (alts) => [index.groups, index.products, index.stores].some((l) => l.some((e) => alts.some((w) => scoreWord(e, w) >= 0)));
    const keep = words.filter(hits);
    if (keep.length && keep.length < words.length) { dropped = q.split(' ').filter(Boolean).filter((_, i) => !keep.includes(words[i])); words.splice(0, words.length, ...keep); }
  }
  if (!words.length && !place) return { groups: [], products: [], stores: [], total: 0 };
  // every list is scored first; a hit inside a word is kept only when no list has a better one
  const scored = (list) => (words.length ? list.map((e) => [...scoreFull(e, words), e]).filter(([sc]) => sc >= 0).sort((a, b) => b[0] - a[0]) : []);
  const all = { groups: scored(index.groups), products: scored(index.products), stores: place ? [] : scored(index.stores) };
  const clean = Object.values(all).some((l) => l.some(([, inside]) => !inside));
  const take = (l, n) => l.filter(([, inside]) => !clean || !inside).slice(0, n).map(([, , e]) => e);
  const run = (list, n) => take(list === index.stores ? all.stores : scored(list), n);
  const groups = take(all.groups, limits.groups);
  const products = take(all.products, limits.products);
  // the words name a chain when each is a whole word of some store's chain and one of them is
  // distinctive ("soriana", "la comer"; never "la" or "de" alone): the reader is looking for a
  // store, so the stores lead and Enter opens one
  // (a word also matches its plural in the chain: "farmacia" is in "Farmacias Similares")
  const inChain = (e, w) => { const c = ` ${e.chainKey} `; return c.includes(` ${w} `) || c.includes(` ${w}s `) || c.includes(` ${w}es `); };
  const chainWords = (e) => words.every((alts) => alts.some((w) => inChain(e, w))) && words.some((alts) => alts.some((w) => w.length >= 4 && inChain(e, w)));
  // words that mean "a store" in general: with a place they list the place's stores
  const STORE_WORDS = new Set(['tienda', 'tiendas', 'super', 'supermercado', 'supermercados', 'market', 'sucursal', 'sucursales', 'hiper', 'mega', 'express', 'bodega']);
  let stores, storesFirst = false, placeName = null, storesTotal = 0;
  if (place) {
    // in a place, the words pick stores by their chain or name only (never by street address)
    const here = index.stores.filter((e) => e.muni === place);
    placeName = here.length ? here[0].ref.municipio : null;
    const chainHere = words.length ? here.filter(chainWords) : [];
    // "soriana coyoacan" is a chain in a place: its stores there, no private-label products
    if (chainHere.length) { stores = chainHere.sort((a, b) => b.n - a.n).slice(0, 8); return { groups: [], products: [], stores, total: stores.length, place, placeName, storesFirst: true, storesTotal: chainHere.length }; }
    // "huevo iztapalapa" is a product in a place: the products, then the stores there whose name
    // has the words, else the place's biggest stores
    const byName = words.length ? here.map((e) => [score({ ...e, key: e.head }, words), e]).filter(([sc]) => sc >= 6 * words.length).sort((a, b) => b[0] - a[0]).map(([, e]) => e) : [];
    // Nothing in the place has that chain or kind in its name: say so, and list those stores
    // elsewhere (the place's supermarkets were listed instead, and Enter opened one). One chain is
    // named ("Ninguna tienda Oxxo en Tlalpan"); a kind matching several chains is said as the
    // words typed ("Nada que se llame «farmacia» en Tlalpan": a pharmacy named otherwise may be
    // there). Words that only mean "a store" list the place's stores.
    const onlyStoreWords = words.every((alts) => alts.some((w) => STORE_WORDS.has(w)));
    const chainAll = words.length && !byName.length && !onlyStoreWords ? index.stores.filter(chainWords) : [];
    if (chainAll.length) {
      const one = new Set(chainAll.map((e) => e.ref.chain)).size === 1;
      stores = [...chainAll].sort((a, b) => b.n - a.n).slice(0, 5);
      return { groups: [], products: [], stores, total: stores.length, place, placeName, storesFirst: true, storesTotal: chainAll.length, note: one ? { key: 'noChainHere', chain: chainAll[0].ref.chain, place: placeName } : { key: 'noKindHere', kind: q, place: placeName } };
    }
    const pool = byName.length ? byName : here;
    stores = (byName.length ? byName : [...here].sort((a, b) => b.n - a.n)).slice(0, words.length ? 5 : 8);
    storesTotal = pool.length;
  } else {
    stores = run(index.stores, limits.stores);
    storesTotal = all.stores.filter(([, inside]) => !clean || !inside).length;
    storesFirst = stores.length > 0 && words.length > 0 && index.stores.some(chainWords);
  }
  return { groups, products, stores, total: groups.length + products.length + stores.length, place, placeName, storesFirst, storesTotal, dropped };
}
// the order the list shows and Enter follows
export const flatResults = (r) => (!r ? [] : r.storesFirst ? [...r.stores, ...r.groups, ...r.products] : [...r.groups, ...r.products, ...r.stores]);

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
      ${results.dropped && results.dropped.length && results.total > 0 ? html`<div class="empty">${t('droppedWords', { words: results.dropped.join(', ') })}</div>` : nothing}
      ${results.total === -1 ? html`<div class="empty">${t('loadingCatalog')}</div>` : results.total === 0 ? html`<div class="empty">${t('noResults')}</div>` : nothing}
      ${(results.storesFirst ? ['stores', 'groups', 'products'] : ['groups', 'products', 'stores']).map((k) => (results[k] && results[k].length ? html`<div role="group" aria-labelledby=${`sr-h-${k[0]}`}><div class="h" id=${`sr-h-${k[0]}`}>${k === 'stores' && results.placeName && !results.note ? t('storesIn', { place: results.placeName }) : t(k)}${k === 'stores' && results.storesTotal > results.stores.length ? ` · ${t('nOfTotal', { n: results.stores.length, total: results.storesTotal })}` : ''}</div>${k === 'stores' && results.note ? html`<div class="empty">${t(results.note.key || 'noChainHere', results.note)}</div>` : nothing}${results[k].map((e) => item(e, ++i))}</div>` : nothing))}
    </div>` : nothing}
  </div>`;
}
