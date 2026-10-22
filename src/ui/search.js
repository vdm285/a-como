// The search field: one box, always visible, that finds generic products, products and stores by
// name (accent-insensitive, every word must match). Keyboard: ↑↓ Enter Esc; the highlighted row
// is announced through aria-activedescendant.
import { html, nothing } from 'lit';
import { t } from '../app/i18n.js';
import { I } from './icons.js';
import { sizeLabel } from '../logic/unit.js';

export function fold(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ%+ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildSearchIndex(data) {
  const groups = data.groups.map((g) => ({ kind: 'group', id: g.id, head: fold(g.name), key: fold(g.name), name: g.name, sub: g.category, n: g.storesAll ?? g.stores, ref: g }));
  const products = data.products.map((p) => ({ kind: 'product', id: p.id, head: fold(`${p.name} ${p.brand || ''}`), key: fold(`${p.name} ${p.brand || ''} ${p.presentation || ''}`), name: p.name, brand: p.brand, sub: p.presentation, n: p.storesAll ?? p.stores, ref: p }));
  const stores = data.stores.map((s) => ({ kind: 'store', id: s.id, head: fold(`${s.chain} ${s.name}`), key: fold(`${s.chain} ${s.name} ${s.giro || ''} ${s.address || ''} ${s.municipio || ''}`), name: s.name, sub: `${s.chain}${s.municipio ? ' · ' + s.municipio : ''}`, n: s.products, ref: s }));
  return { groups, products, stores };
}

// Every word must appear somewhere; a hit in the name (head) at a word start counts most, a hit
// only in the presentation or address counts least. Ties break by how many stores carry it.
function score(entry, words) {
  let sc = 0;
  for (const w of words) {
    const h = entry.head.indexOf(w);
    if (h >= 0) { sc += (h === 0 || entry.head[h - 1] === ' ') ? 6 : 3; continue; }
    const i = entry.key.indexOf(w);
    if (i < 0) return -1;
    sc += (i === 0 || entry.key[i - 1] === ' ') ? 1.5 : 0.5;
  }
  return sc + (entry.n ? Math.min(entry.n, 200) / 200 : 0);
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

export function searchView({ query, results, active, onInput, onPick, onClear, onKey, onBlur, onFocus }) {
  const item = (e, i) => html`<button id=${`sr-${i}`} class="item ${i === active ? 'active' : ''}" role="option" aria-selected=${i === active} tabindex="-1"
      @mousedown=${(ev) => ev.preventDefault()} @click=${() => onPick(e)} @mousemove=${() => onKey({ hover: i })}>
    <span class="n">${e.name}${e.brand ? html`<span class="b"> · ${e.brand}</span>` : nothing}</span>
    ${e.kind === 'product' && e.ref.size ? html`<span class="tag">${sizeLabel(e.ref.size)}</span>` : nothing}
    <span class="s">${e.sub || ''}</span>
  </button>`;
  let i = -1;
  const open = !!(query && results);
  return html`<div class="float search" role="search" @focusout=${onBlur}>
    <div class="box">
      ${I.search()}
      <input type="search" autocomplete="off" spellcheck="false" enterkeyhint="search" placeholder=${t('searchPh')} .value=${query}
        role="combobox" aria-label=${t('searchPh')} aria-expanded=${open} aria-controls="search-list" aria-activedescendant=${open && active >= 0 ? `sr-${active}` : ''}
        @input=${(e) => onInput(e.target.value)} @keydown=${(e) => onKey({ key: e.key, event: e })} @focus=${onFocus} />
      ${query ? html`<button class="clear" title=${t('clear')} aria-label=${t('clear')} @mousedown=${(ev) => ev.preventDefault()} @click=${onClear}>${I.x()}</button>` : nothing}
    </div>
    ${open ? html`<div class="list" role="listbox" id="search-list">
      ${results.total === 0 ? html`<div class="empty">${t('noResults')}</div>` : nothing}
      ${results.groups.length ? html`<div class="h">${t('groups')}</div>${results.groups.map((e) => item(e, ++i))}` : nothing}
      ${results.products.length ? html`<div class="h">${t('products')}</div>${results.products.map((e) => item(e, ++i))}` : nothing}
      ${results.stores.length ? html`<div class="h">${t('stores')}</div>${results.stores.map((e) => item(e, ++i))}` : nothing}
    </div>` : nothing}
  </div>`;
}
