// The search field: one box, always visible, that finds generic products, products and
// stores by name (accent-insensitive, every word must match). Keyboard: ↑↓ Enter Esc.
import { html, nothing } from 'lit';
import { t } from '../app/i18n.js';
import { I } from './icons.js';
import { sizeLabel } from '../logic/unit.js';

export function fold(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildSearchIndex(data) {
  const groups = data.groups.map((g) => ({ kind: 'group', id: g.id, key: fold(g.name), name: g.name, sub: g.category, n: g.products, ref: g }));
  const products = data.products.map((p) => ({ kind: 'product', id: p.id, key: fold(`${p.name} ${p.brand || ''} ${p.presentation || ''}`), name: `${p.name}${p.brand ? ' · ' + p.brand : ''}`, sub: p.presentation, ref: p }));
  const stores = data.stores.map((s) => ({ kind: 'store', id: s.id, key: fold(`${s.chain} ${s.name} ${s.address || ''} ${s.municipio || ''}`), name: s.name, sub: `${s.chain}${s.municipio ? ' · ' + s.municipio : ''}`, ref: s }));
  return { groups, products, stores };
}

function score(entry, words) {
  let sc = 0;
  for (const w of words) {
    const i = entry.key.indexOf(w);
    if (i < 0) return -1;
    sc += (i === 0 || entry.key[i - 1] === ' ') ? 3 : 1; // word start beats substring
  }
  return sc + (entry.n ? Math.min(entry.n, 30) / 30 : 0);
}

export function search(index, query, limits = { groups: 6, products: 8, stores: 5 }) {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return { groups: [], products: [], stores: [], total: 0 };
  const run = (list, n) => list.map((e) => [score(e, words), e]).filter(([s]) => s >= 0).sort((a, b) => b[0] - a[0]).slice(0, n).map(([, e]) => e);
  const groups = run(index.groups, limits.groups);
  const products = run(index.products, limits.products);
  const stores = run(index.stores, limits.stores);
  return { groups, products, stores, total: groups.length + products.length + stores.length };
}

export function searchView({ query, results, active, onInput, onPick, onClear, onKey }) {
  const flat = results ? [...results.groups, ...results.products, ...results.stores] : [];
  const item = (e, i) => html`<button class="item ${i === active ? 'active' : ''}" role="option" aria-selected=${i === active} @click=${() => onPick(e)} @mousemove=${() => onKey({ hover: i })}>
    <span class="n">${e.name}</span>
    ${e.kind === 'product' && e.ref.size ? html`<span class="tag">${sizeLabel(e.ref.size)}</span>` : nothing}
    <span class="s">${e.sub || ''}</span>
  </button>`;
  let i = -1;
  return html`<div class="float search" role="search">
    <div class="box">
      ${I.search()}
      <input type="search" autocomplete="off" spellcheck="false" placeholder=${t('searchPh')} .value=${query} aria-label=${t('searchPh')} aria-expanded=${!!(query && results)} @input=${(e) => onInput(e.target.value)} @keydown=${(e) => onKey({ key: e.key, event: e })} />
      ${query ? html`<button class="clear" title=${t('clear')} aria-label=${t('clear')} @click=${onClear}>${I.x()}</button>` : nothing}
    </div>
    ${query && results ? html`<div class="list" role="listbox">
      ${results.total === 0 ? html`<div class="empty">${t('noResults')}</div>` : nothing}
      ${results.groups.length ? html`<div class="h">${t('groups')}</div>${results.groups.map((e) => item(e, ++i))}` : nothing}
      ${results.products.length ? html`<div class="h">${t('products')}</div>${results.products.map((e) => item(e, ++i))}` : nothing}
      ${results.stores.length ? html`<div class="h">${t('stores')}</div>${results.stores.map((e) => item(e, ++i))}` : nothing}
    </div>` : nothing}
  </div>`;
}
