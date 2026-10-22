// The side cards: store, product, generic product, basket, settings. Each is a lit template fed
// by main.js; nothing here touches the map directly. Every price shows its date; every
// comparison names its reference (the city median of the recent window, docs/EDITORIAL.md).
import { html, svg, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { t, money, pct, fdate, fspan, unitName, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { sparkline } from './spark.js';
import { median, minMax, deviation } from '../logic/stats.js';
import { perUnit, sizeLabel } from '../logic/unit.js';
import { fold } from './search.js';
import { giroLabel } from './chrome.js';

const MIN_N = 3; // a chip or a flag needs a median from at least this many stores

export function devChip(dev, digits = 0) {
  if (dev == null) return nothing;
  const color = dev < -0.005 ? 'var(--cheaper-ink)' : dev > 0.005 ? 'var(--dearer-ink)' : 'var(--ink-2)';
  const txt = Math.abs(dev) < 0.005 ? t('atMedian') : dev < 0 ? t('pctBelow', { pct: pct(-dev, digits).replace('+', '') }) : t('pctAbove', { pct: pct(dev, digits).replace('+', '') });
  return html`<span class="d num" style="color:${color}">${txt}</span>`;
}
const swColor = (dev) => (dev == null ? 'transparent' : dev < -0.005 ? 'var(--cheaper)' : dev > 0.005 ? 'var(--dearer)' : 'var(--mid)');

function head({ kicker, title, sub, onClose, onKicker }) {
  return html`<div class="head">
    <div class="titles">
      ${kicker ? html`<div class="kicker">${onKicker ? html`<button class="klink" @click=${onKicker}>${I.chevronL()}${kicker}</button>` : kicker}</div>` : nothing}
      <h2>${title}</h2>
      ${sub ? html`<div class="sub">${sub}</div>` : nothing}
    </div>
    <button class="x" @click=${onClose} title=${t('close')} aria-label=${t('close')}>${I.x()}</button>
  </div>`;
}

const sourceLine = (text) => html`<div class="muted src">PROFECO · Quién es Quién en los Precios${text ? html` · ${text}` : nothing}</div>`;

// unit price shown only when it says something the label price does not (not for exactly 1 L / 1 kg / 1 pza)
function unitLine(price, size, unit) {
  if (!unit || !size) return nothing;
  const base = { l: 1000, kg: 1000, '100g': 100, '100ml': 100, pza: 1 }[unit];
  if (size.value === base) return nothing;
  const per = perUnit(price, size, unit);
  return per == null ? nothing : html`<span class="u num">${money(per)}/${unitName(unit, true)}</span>`;
}

// ---------------------------------------------------------------- price strip
// Every store's recent price on one axis, a row per kind of store, coloured like the map.
// It replaces three boxes that often showed the same number three times.
const KIND = (s) => {
  const g = `${s.giro || ''} ${s.chain || ''}`;
  if (/tortiller/i.test(g)) return 'tortilleria';
  if (/central de abasto/i.test(g)) return 'central';
  if (/(^|[s/·-])mercado/i.test(g) && !/supermercado|autoservicio/i.test(s.giro || '')) return 'mercado';
  if (/farmacia/i.test(g)) return 'farmacia';
  if (/panader|pescader/i.test(g)) return 'tradicional';
  if (/conveniencia|oxxo|7-eleven/i.test(g)) return 'conveniencia';
  return 'super';
};
export function priceStrip({ rows, ref, ownPrice, onPick, selected }) {
  if (!rows.length) return nothing;
  const W = 364, padL = 104, padR = 10, rowH = 22, axisH = 18;
  const kinds = [...new Set(rows.map((r) => r.kind))];
  const order = ['super', 'conveniencia', 'mercado', 'central', 'tortilleria', 'tradicional', 'farmacia'];
  kinds.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const vals = rows.map((r) => r.value).concat(ownPrice != null ? [ownPrice] : []);
  let [lo, hi] = minMax(vals);
  if (hi === lo) { hi = hi * 1.05 + 0.01; lo = lo * 0.95; }
  const x = (v) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const H = kinds.length * rowH + axisH;
  // simple beeswarm: within a row, dots closer than 6 px alternate up and down
  const placed = rows.map((r) => ({ ...r, cx: x(r.value), row: kinds.indexOf(r.kind), dy: 0 })).sort((a, b) => a.cx - b.cx);
  const lastByRow = new Map();
  for (const p of placed) { const last = lastByRow.get(p.row); if (last && p.cx - last.cx < 6) p.dy = last.dy === 0 ? -4.5 : last.dy < 0 ? 4.5 : 0; lastByRow.set(p.row, p); }
  const label = (k) => t(`kind_${k}`);
  const counts = new Map(kinds.map((k) => [k, rows.filter((r) => r.kind === k).length]));
  return svg`<svg class="strip" viewBox="0 0 ${W} ${H}" role="img" aria-label=${t('stripAria')}>
    ${kinds.map((k, i) => svg`<text class="strip-k" x="0" y=${i * rowH + rowH / 2 + 4}>${label(k)} · ${counts.get(k)}</text><line class="strip-row" x1=${padL} x2=${W - padR} y1=${i * rowH + rowH / 2} y2=${i * rowH + rowH / 2}></line>`)}
    ${ref != null ? svg`<line class="strip-ref" x1=${x(ref)} x2=${x(ref)} y1="2" y2=${H - axisH}></line>` : nothing}
    ${placed.map((p) => svg`<circle class="strip-dot ${selected === p.sid ? 'sel' : ''}" cx=${p.cx} cy=${p.row * rowH + rowH / 2 + p.dy} r="3.6" style="fill:${p.color}" @click=${() => onPick(p.sid)}><title>${p.name} · ${money(p.value)} · ${fdate(p.date)}</title></circle>`)}
    ${ownPrice != null ? svg`<line class="strip-own" x1=${x(ownPrice)} x2=${x(ownPrice)} y1="2" y2=${H - axisH}></line>` : nothing}
    <text class="strip-ax" x=${padL} y=${H - 4}>${money(lo)}</text>
    ${ref != null ? svg`<text class="strip-ax mid" x=${x(ref)} y=${H - 4} text-anchor="middle">${money(ref)}</text>` : nothing}
    <text class="strip-ax" x=${W - padR} y=${H - 4} text-anchor="end">${money(hi)}</text>
  </svg>`;
}

// ---------------------------------------------------------------- store
export function storeCard(c) {
  const { store, storeFile, byProduct, stage, own, filter, showAll, win, stageTitle } = c;
  const idx = store.index || {};
  const series = (idx.series || []).filter((r) => r[1] != null).map((r) => [r[0], r[1]]);
  // the headline index skips light weeks, as the map does (a one-day week is too thin a baseline)
  const full = series.filter((r) => !(c.partial && c.partial.has(r[0])));
  const latestIdx = full.length ? full[full.length - 1] : null;
  const stageVal = stage && stage.values ? stage.values.get(store.id) : null;
  const items = storeFile ? storeFile.items : null;
  const pharmacy = /farmacia/i.test(`${store.giro || ''} ${store.chain || ''}`);
  let recentRows = [], olderRows = [], wins = [], losses = [];
  if (items && byProduct) {
    for (const [pid, price, date] of items) {
      const p = byProduct.get(pid);
      if (!p) continue;
      const recent = date >= win.from;
      // a chip only for recent prices, against the recent median of at least MIN_N stores
      const dev = recent && p.median != null && (p.stores ?? 0) >= MIN_N ? deviation(price, p.median) : null;
      (recent ? recentRows : olderRows).push({ p, price, date, dev });
    }
    // wins and losses: recent only; medicines only count for pharmacies; beyond ±150 % it is
    // shown in the list for review but never presented as a win or a loss
    const eligible = recentRows.filter((r) => r.dev != null && Math.abs(r.dev) <= 1.5 && (pharmacy || !/medicamento/i.test(r.p.category || '')));
    wins = [...eligible].sort((a, b) => a.dev - b.dev).slice(0, 5).filter((r) => r.dev < -0.02);
    losses = [...eligible].sort((a, b) => b.dev - a.dev).slice(0, 5).filter((r) => r.dev > 0.02);
  }
  const words = fold(filter || '').split(' ').filter(Boolean);
  const match = (r) => !words.length || words.every((w) => fold(`${r.p.name} ${r.p.brand || ''} ${r.p.presentation || ''}`).includes(w));
  const listed = recentRows.filter(match).sort((a, b) => a.p.name.localeCompare(b.p.name, 'es'));
  const listedOld = olderRows.filter(match).sort((a, b) => b.date.localeCompare(a.date));
  const limit = showAll ? Infinity : 30;
  const ownHere = (own || []).filter((o) => o.storeId === store.id);
  const row = (r) => html`<li @click=${() => c.onOpenProduct(r.p.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenProduct(r.p.id); }}>
    <span class="sw" style="background:${swColor(r.dev)}"></span>
    <div class="nm"><div class="n">${r.p.name}${r.p.brand ? ` · ${r.p.brand}` : ''}</div><div class="s">${r.p.presentation || ''}</div></div>
    <div class="pr"><div class="p num">${money(r.price)}</div><div class="u">${fdate(r.date, true)}${r.dev != null && Math.abs(r.dev) > 1.5 ? html` · <span class="flag" title=${t('outlierHint')}>${t('outlier')}</span>` : r.dev != null ? html` · ${devChip(r.dev)}` : nothing}</div></div>
  </li>`;
  const siblings = c.siblings || [];
  const indexWeek = latestIdx ? latestIdx[0] : null;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${store.name}>
    ${head({ kicker: `${store.chain}${giroLabel(store) ? ' · ' + giroLabel(store) : ''}`, title: store.name, sub: `${store.address || ''}${store.municipio ? ' · ' + store.municipio : ''}`, onClose: c.onClose })}
    <div class="body">
      ${stage && stage.kind !== 'index' && stageVal ? html`<section class="stagebox">
        <button class="h3link" @click=${c.onStageCard}>${I.chevronL()}${stageTitle}</button>
        ${stageVal.value != null ? html`<div class="hero"><span class="big num">${money(stageVal.value)}</span>${stage.kind === 'group' && stage.unit ? html`<span class="unit">/ ${unitName(stage.unit)}</span>` : nothing}${stageVal.hatched ? html`<span class="delta">${stageVal.missing.length === 1 ? t('missingOne') : t('missing', { n: stageVal.missing.length })}</span>` : html`<span class="delta">${devChip(stageVal.dev)}</span>`}</div>
          <div class="muted">${stageVal.dateMin && stageVal.date && stageVal.dateMin !== stageVal.date ? fspan(stageVal.dateMin, stageVal.date) : fdate(stageVal.date)}${stage.ref != null ? ` · ${t('refLine', { ref: money(stage.ref) })}` : ''}</div>`
          : html`<div class="note">${{ stale: stageVal.lastDate ? t('reasonStaleDate', { date: fdate(stageVal.lastDate) }) : t('reasonStale'), none: t('reasonNone'), novisit: t('noVisitWeek') }[stageVal.reason] || t('reasonNone')}${stageVal.lastPrice ? html` · ${money(stageVal.lastPrice)}` : nothing}</div>`}
      </section>` : nothing}
      ${siblings.length ? html`<section>
        <h3>${t('sameSpot')} · ${siblings.length + 1}</h3>
        <ul class="rank">${siblings.slice(0, showAll ? siblings.length : 8).map(({ store: s, val }) => html`<li @click=${() => c.onOpenStore(s.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(s.id); }}>
          <span class="sw" style="background:${swColor(val && val.dev)}"></span>
          <div class="nm"><div class="n">${s.name}</div><div class="s">${s.chain}${giroLabel(s) ? ' · ' + giroLabel(s) : ''}</div></div>
          <div class="pr">${val && val.value != null ? html`<div class="p num">${stage && stage.kind === 'index' ? val.value.toFixed(2) : money(val.value)}</div>${devChip(val.dev)}` : nothing}</div>
        </li>`)}</ul>
        ${siblings.length > 8 && !showAll ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: siblings.length - 8 })}</button>` : nothing}
      </section>` : nothing}
      <section>
        <h3>${t('index')}</h3>
        ${latestIdx ? html`<div class="hero"><span class="big num">${latestIdx[1].toFixed(2)}</span><span class="delta">${devChip(latestIdx[1] - 1, 1)}</span></div>
          <div class="muted">${t('week', { date: fdate(indexWeek) })}${indexWeek < win.fromWeek ? html` · <span class="flag">${t('notRecent')}</span>` : nothing}</div>`
          : html`<div class="note">${t('reasonFew')}</div>`}
        <div class="muted">${t('visitLine', { date: fdate(store.lastSeen), n: store.lastVisitProducts ?? '—' })} · ${t('allTimeLine', { n: store.products, date: fdate(store.firstSeen, 'monthYear') })}</div>
        ${series.length > 1 ? html`<div style="margin-top:8px">${sparkline(series, { band: false, cursor: stage && stage.kind === 'index' && stage.weekIdx != null ? series.findIndex((r) => r[0] === stage.week) : null, onPick: c.onPickWeek, ref: 1 })}</div>
        <div class="spark-cap"><span>${t('min')} ${Math.min(...series.map((r) => r[1])).toFixed(2)}</span><span>${t('max')} ${Math.max(...series.map((r) => r[1])).toFixed(2)}</span></div>` : nothing}
        <details><summary class="muted">${t('howIndex')}</summary><p class="note">${t('indexMethod')}</p></details>
      </section>
      ${wins.length ? html`<section><h3>${t('bestHere')} · ${t('lastDays', { n: win.days })}</h3><ul class="rank">${wins.map(row)}</ul></section>` : nothing}
      ${losses.length ? html`<section><h3>${t('worstHere')} · ${t('lastDays', { n: win.days })}</h3><ul class="rank">${losses.map(row)}</ul></section>` : nothing}
      ${ownHere.length ? html`<section><h3>${t('ownPrices')}</h3>${ownList(ownHere, c, { showStore: false })}</section>` : nothing}
      <section>
        <h3>${t('storeList')}</h3>
        ${items == null ? html`<div class="muted">${t('loadingCard')}</div>` : recentRows.length + olderRows.length === 0 ? html`<div class="note">${t('emptyStore')}</div>` : html`
          <div class="ownform" style="margin:0 0 8px"><input type="search" enterkeyhint="search" aria-label=${t('searchInStore')} placeholder=${t('searchInStore')} .value=${filter || ''} @input=${(e) => c.onFilter(e.target.value)} @keydown=${(e) => { if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); c.onFilter(''); } }} style="flex:1" /></div>
          <div class="subh">${t('lastDays', { n: win.days })} · ${listed.length}</div>
          <ul class="rank">${listed.slice(0, limit).map(row)}</ul>
          ${listed.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: listed.length - limit })}</button>` : nothing}
          ${listedOld.length ? html`<details class="older"><summary class="subh">${t('before')} · ${listedOld.length}</summary><ul class="rank old">${listedOld.slice(0, showAll ? Infinity : 40).map(row)}</ul></details>` : nothing}`}
        ${sourceLine(store.lastSeen ? t('visitShort', { date: fdate(store.lastSeen) }) : '')}
      </section>
    </div>
  </div>`;
}

function ownList(rows, c, { showStore = true, showProduct = true } = {}) {
  return html`<ul class="ownlist">${rows.map((o) => {
    const p = c.byProduct && c.byProduct.get(o.productId);
    const s = c.byStore && c.byStore.get(o.storeId);
    const parts = [];
    if (showProduct && p) parts.push(`${p.name}${p.brand ? ' · ' + p.brand : ''}`);
    if (showStore && s) parts.push(s.name);
    parts.push(fdate(o.date, true));
    return html`<li><span class="p num">${money(o.price)}</span><span class="m">${parts.join(' · ')}${o.vs ? html` · ${o.vs}` : nothing}</span><button class="del" title=${t('ownDelete')} aria-label=${t('ownDelete')} @click=${() => c.onDeleteOwn(o.id)}>${I.trash()}</button></li>`;
  })}</ul>`;
}

// ---------------------------------------------------------------- product
export function productCard(c) {
  const { summary, stage, byStore, byGroup, own, showAll, inBasket, unit, win } = c;
  const mine = stage && stage.kind === 'product' && stage.id === summary.id ? stage : null;
  const ranked = [];
  if (mine) for (const [sid, v] of mine.values) if (v.value != null) { const s = byStore.get(sid); if (s) ranked.push({ sid, s, price: v.value, dev: v.dev, date: v.date, kind: KIND(s), color: swColor(v.dev) }); }
  ranked.sort((a, b) => a.price - b.price);
  const ref = mine ? mine.ref : summary.median;
  const weekMode = mine && mine.weekIdx != null;
  const headline = weekMode ? median(ranked.map((r) => r.price)) : ref;
  const series = mine && mine.product ? mine.product.series : null;
  const cursor = mine && mine.weekIdx != null && series ? series.findIndex((r) => r[0] === mine.week) : null;
  const limit = showAll ? ranked.length : 10;
  const ownHere = (own || []).filter((o) => o.productId === summary.id);
  const group = byGroup ? byGroup.get(summary.group) : null;
  const ownByStore = new Map(); for (const o of ownHere) if (!ownByStore.has(o.storeId)) ownByStore.set(o.storeId, o);
  const latestOwn = ownHere[0];
  const when = mine ? (mine.weekIdx == null ? t('recentSpan', { span: fspan(win.from, win.to) }) : t('week', { date: fdate(mine.week) })) : '';
  const perRef = unit && ref != null ? perUnit(ref, summary.size, unit) : null;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${summary.name}>
    ${head({ kicker: group ? group.name : summary.category, onKicker: group ? () => c.onOpenGroup(group.id) : null, title: `${summary.name}${summary.brand ? ' · ' + summary.brand : ''}`, sub: `${summary.presentation || ''}${summary.size ? ' · ' + sizeLabel(summary.size) : ''}`, onClose: c.onClose })}
    <div class="body">
      <section>
        <h3>${t('cityWide')} · ${when}</h3>
        ${headline != null ? html`<div class="hero"><span class="big num">${money(headline)}</span><span class="unit">${weekMode ? t('weekMedian') : t('cityMedian')}${!weekMode && perRef != null && summary.size && summary.size.value !== ({ l: 1000, kg: 1000, '100g': 100, '100ml': 100, pza: 1 }[unit]) ? html` · ${money(perRef)}/${unitName(unit, true)}` : nothing}</span></div>
          <div class="muted">${weekMode ? html`${t('storesThisWeek', { n: ranked.length })} · ${t('refLine', { ref: money(ref) })}` : t('storesRecent', { n: mine ? mine.n : summary.stores })}</div>`
          : html`<div class="note">${t('noRecentPrice')}${summary.last ? html` ${t('lastData', { date: fdate(summary.last) })}` : nothing}</div>`}
        ${ranked.length > 1 ? html`<div class="stripwrap">${priceStrip({ rows: ranked.map((r) => ({ ...r, value: r.price, name: r.s.name })), ref, ownPrice: latestOwn ? latestOwn.price : null, onPick: c.onOpenStore, selected: c.selectedStore })}</div>` : nothing}
        <div class="actions">
          <button class="btn ${inBasket ? 'on' : ''}" @click=${c.onToggleBasket}>${inBasket ? I.check() : I.plus()}${inBasket ? t('inBasket') : t('addToBasket')}</button>
          <button class="btn ghost" @click=${c.onCopyLink}>${I.link()}${t('copyLink')}</button>
        </div>
      </section>
      <section>
        <h3>${t('ranking')}${weekMode ? html` · ${t('vsRecentShort')}` : nothing}</h3>
        ${!mine ? html`<div class="muted">${t('loadingCard')}</div>` : ranked.length === 0 ? html`<div class="note">${mine.weekIdx == null ? t('noRecentPrice') : t('noVisitWeek')}</div>` : html`
          <ul class="rank">${ranked.slice(0, limit).map((r) => html`<li class=${c.selectedStore === r.sid ? 'sel' : ''} @click=${() => c.onOpenStore(r.sid)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.sid); }}>
            <span class="sw" style="background:${r.color}"></span>
            <div class="nm"><div class="n">${r.s.name}</div><div class="s">${r.s.chain}${r.s.municipio ? ' · ' + r.s.municipio : ''} · ${fdate(r.date, true)}${ownByStore.has(r.sid) ? html` · <span class="own">${t('ownMark')} ${money(ownByStore.get(r.sid).price)}</span>` : nothing}</div></div>
            <div class="pr"><div class="p num">${money(r.price)}</div><div class="u">${unitLine(r.price, summary.size, unit)}${unitLine(r.price, summary.size, unit) !== nothing ? ' · ' : ''}${devChip(r.dev)}</div></div>
          </li>`)}</ul>
          ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
      </section>
      ${series && series.length > 1 ? html`<section>
        <h3>${t('history')}</h3>
        ${sparkline(series, { cursor, onPick: c.onPickWeek, ref })}
        <div class="spark-cap"><span>${t('historyCity')}</span><span class="num">${money(minMax(series.map((r) => r[1]))[0])} – ${money(minMax(series.map((r) => r[1]))[1])}</span></div>
      </section>` : nothing}
      <section>
        <h3>${t('ownPrices')}</h3>
        <div class="note">${t('ownHint')}</div>
        ${keyed(summary.id, html`<form class="ownform" @submit=${(e) => { e.preventDefault(); const f = e.target; c.onAddOwn({ price: f.price.value, storeId: f.store.value }); f.price.value = ''; }}>
          <input class="money num" name="price" type="number" inputmode="decimal" enterkeyhint="done" min="0.01" step="0.01" placeholder="$" required aria-label=${t('ownAdd')} />
          <select name="store" aria-label=${t('store')} .value=${c.defaultStore || ''}>${(c.storeOptions || []).map((s) => html`<option value=${s.id}>${s.name} · ${s.chain}</option>`)}</select>
          <button class="btn" type="submit">${I.check()}${t('ownSave')}</button>
        </form>`)}
        ${ownHere.length ? ownList(ownHere.map((o) => { const v = mine && mine.values.get(o.storeId); return { ...o, vs: v && v.value != null ? t('ownVs', { diff: pct(deviation(o.price, v.value)), date: fdate(v.date, true) }) : null }; }), { ...c, byProduct: null }, { showProduct: false }) : nothing}
        ${sourceLine(summary.asOf ? t('asOf', { date: fdate(summary.asOf) }) : '')}
        ${unit ? html`<div class="muted">${t('unitNote')}</div>` : nothing}
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- group
export function groupCard(c) {
  const { group, members, stage, byStore, byProduct, showAll, win } = c;
  const mine = stage && stage.kind === 'group' && stage.id === group.id ? stage : null;
  const unit = mine ? mine.unit : null, dim = mine ? mine.dim : null;
  const perOf = (p) => (unit && p.median != null && p.size && p.size.unit === dim ? perUnit(p.median, p.size, unit) : null);
  const sized = members.filter((p) => p.size && p.size.unit === dim).sort((a, b) => (perOf(a) ?? Infinity) - (perOf(b) ?? Infinity));
  const otherUnit = members.filter((p) => p.size && p.size.unit !== dim);
  const unsized = members.filter((p) => !p.size);
  const ranked = [];
  if (mine) for (const [sid, v] of mine.values) if (v.value != null) { const s = byStore.get(sid); if (s) ranked.push({ sid, s, ...v }); }
  ranked.sort((a, b) => a.value - b.value);
  const limit = showAll ? ranked.length : 10;
  const pLimit = showAll ? sized.length : 12;
  const best = ranked[0];
  const bestP = best && byProduct.get(best.pid);
  const memberRow = (p, per, perUnitLabel) => html`<li @click=${() => c.onOpenProduct(p.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenProduct(p.id); }}>
    <span class="sw" style="background:${per != null && mine && mine.ref ? swColor(deviation(per, mine.ref)) : 'transparent'}"></span>
    <div class="nm"><div class="n">${p.brand || p.name}</div><div class="s">${p.presentation || ''}${p.size ? ' · ' + sizeLabel(p.size) : ''} · ${p.stores ? t('storesRecentShort', { n: p.stores }) : t('noRecentShort')}</div></div>
    <div class="pr">${per != null ? html`<div class="p num">${money(per)}</div><div class="u">/ ${perUnitLabel}${Math.abs(per - p.median) > 0.005 ? ` · ${money(p.median)} ${t('label')}` : ''}</div>` : p.median != null ? html`<div class="p num">${money(p.median)}</div><div class="u">${t('label')}</div>` : nothing}</div>
  </li>`;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${group.name}>
    ${head({ kicker: group.category, title: group.name, sub: `${t('products_n', { n: members.length })} · ${t('storesRecent', { n: group.stores })}`, onClose: c.onClose })}
    <div class="body">
      ${unit && best ? html`<section>
        <h3>${t('cheapestPerUnit')} · ${mine.weekIdx == null ? t('recentSpan', { span: fspan(win.from, win.to) }) : t('week', { date: fdate(mine.week) })}</h3>
        <div class="hero"><span class="big num">${money(best.value)}</span><span class="unit">/ ${unitName(unit)}</span></div>
        <div class="muted">${best.s.name} · ${bestP ? `${bestP.brand || bestP.name} ${bestP.presentation || ''} · ${money(best.price)}` : ''} · ${fdate(best.date)}</div>
        <div class="muted">${t('groupMedianWhat')}: ${money(mine.ref)} / ${unitName(unit)}</div>
      </section>` : nothing}
      <section>
        <h3>${t('sizes')}${unit ? html` · ${t('perUnit', { unit: unitName(unit) })}` : nothing}</h3>
        <ul class="rank">${sized.slice(0, pLimit).map((p) => memberRow(p, perOf(p), unitName(unit, true)))}</ul>
        ${sized.length > pLimit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: sized.length - pLimit })}</button>` : nothing}
        ${otherUnit.length ? html`<div class="subh">${t('otherUnit')}</div><ul class="rank">${otherUnit.map((p) => { const u = p.size.unit === 'pza' ? 'pza' : p.size.unit === 'ml' ? 'l' : 'kg'; return memberRow(p, p.median != null ? perUnit(p.median, p.size, u) : null, unitName(u, true)); })}</ul>` : nothing}
        ${unsized.length ? html`<div class="subh">${t('noSize')}</div><ul class="rank">${unsized.map((p) => memberRow(p, null, ''))}</ul>` : nothing}
      </section>
      ${unit ? html`<section>
        <h3>${t('ranking')} · ${t('perUnit', { unit: unitName(unit) })}</h3>
        ${!mine ? html`<div class="muted">${t('loadingCard')}</div>` : ranked.length === 0 ? html`<div class="note">${t('noRecentPrice')}</div>` : html`<ul class="rank">${ranked.slice(0, limit).map((r) => { const p = byProduct.get(r.pid); return html`<li class=${c.selectedStore === r.sid ? 'sel' : ''} @click=${() => c.onOpenStore(r.sid)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.sid); }}>
          <span class="sw" style="background:${swColor(r.dev)}"></span>
          <div class="nm"><div class="n">${r.s.name}</div><div class="s">${p ? `${p.brand || p.name} · ${p.presentation || ''}` : ''} · ${fdate(r.date, true)}</div></div>
          <div class="pr"><div class="p num">${money(r.value)}</div><div class="u">${money(r.price)} · ${devChip(r.dev)}</div></div>
        </li>`; })}</ul>
        ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
        ${sourceLine('')}
      </section>` : nothing}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- basket
export function basketCard(c) {
  const { items, byProduct, byStore, stage, onlyComplete, showAll, win, offer } = c;
  const ranking = stage && stage.kind === 'basket' ? stage.ranking : null;
  const list = ranking ? (onlyComplete ? ranking.list.filter((r) => r.complete) : ranking.list) : [];
  const limit = showAll ? list.length : 12;
  const best = ranking && ranking.list.find((r) => r.complete);
  // chains: the cheapest complete branch, the dearest, how many branches
  const chains = new Map();
  if (ranking) for (const r of ranking.list) {
    if (!r.complete) continue;
    const s = byStore.get(r.storeId); if (!s) continue;
    const e = chains.get(s.chain) || { chain: s.chain, lo: Infinity, hi: -Infinity, n: 0 };
    e.lo = Math.min(e.lo, r.total); e.hi = Math.max(e.hi, r.total); e.n++;
    chains.set(s.chain, e);
  }
  const chainList = [...chains.values()].sort((a, b) => a.lo - b.lo).slice(0, 8);
  const maxHi = chainList.length ? Math.max(...chainList.map((e) => e.hi)) : 1;
  const when = stage && stage.weekIdx != null ? t('week', { date: fdate(stage.week) }) : t('recentSpan', { span: fspan(win.from, win.to) });
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${t('basket')}>
    ${head({ kicker: t('basket'), title: items.length ? t('products_n', { n: items.length }) : t('basketEmptyTitle'), sub: ranking && ranking.completeCount ? t('completeStores', { n: ranking.completeCount }) : '', onClose: c.onClose })}
    <div class="body">
      ${offer ? html`<section class="offer">
        <div class="note">${t('sharedBasket', { n: offer.length })}</div>
        <ul class="bitems">${offer.map((it) => { const p = byProduct.get(it.id); return html`<li><div><div class="n">${p ? p.name + (p.brand ? ' · ' + p.brand : '') : it.id}</div><div class="s">${p ? p.presentation || '' : ''}</div></div><span class="num">× ${it.qty}</span><span></span></li>`; })}</ul>
        <div class="actions"><button class="btn" @click=${c.onOfferUse}>${t('offerUse')}</button><button class="btn ghost" @click=${c.onOfferMerge}>${t('offerMerge')}</button><button class="btn ghost" @click=${c.onOfferDismiss}>${t('offerDismiss')}</button></div>
      </section>` : nothing}
      ${items.length === 0 ? html`<section><div class="note">${t('basketEmpty')}</div></section>
      ${c.pacicGroups && c.pacicGroups.length ? html`<section><h3>${t('canasta')} · PACIC</h3><div class="note" style="margin-bottom:8px">${t('pacicHint', { n: c.pacicGroups.length })}</div><div class="chips">${c.pacicGroups.map((g) => html`<button class="chip" @click=${() => c.onOpenGroup(g.id)}>${g.name}</button>`)}</div></section>` : nothing}` : html`
      <section>
        <ul class="bitems">${items.map((it) => { const p = byProduct.get(it.id); return html`<li>
          <div><button class="n linkish" @click=${() => c.onOpenProduct(it.id)}>${p ? p.name + (p.brand ? ' · ' + p.brand : '') : it.id}</button><div class="s">${p ? (p.presentation || '') : ''}${p && p.median != null ? ` · ${money(p.median)} · ${t('storesRecentShort', { n: p.stores })}` : p ? ` · ${t('noRecentShort')}` : ''}</div></div>
          <div class="qty"><button @click=${() => c.onQty(it.id, it.qty - 1)} aria-label=${t('less')}>−</button><span class="num">${it.qty}</span><button @click=${() => c.onQty(it.id, it.qty + 1)} aria-label=${t('more1')}>+</button></div>
          <button class="rm" @click=${() => c.onQty(it.id, 0)} title=${t('removeFromBasket')} aria-label=${t('removeFromBasket')}>${I.x()}</button>
        </li>`; })}</ul>
        <div class="actions"><button class="btn ghost" @click=${c.onCopyLink}>${I.link()}${t('copyLink')}</button><button class="btn ghost" @click=${c.onClear}>${I.trash()}${t('clear')}</button></div>
      </section>
      <section>
        <h3>${t('rankingBasket')} · ${when}</h3>
        ${best ? html`<div class="hero"><span class="big num">${money(best.total)}</span><span class="unit">${byStore.get(best.storeId) ? byStore.get(best.storeId).name : ''}</span></div>
          ${ranking.dearest != null && ranking.dearest > best.total ? html`<div class="muted">${t('savings', { amount: money(ranking.dearest - best.total) })}</div>` : nothing}` : html`<div class="note">${t('noCompleteStore')}</div>`}
        ${chainList.length > 1 ? html`<div class="race" style="height:${chainList.length * 30}px">${repeat(chainList, (e) => e.chain, (e, i) => html`<div class="race-row" style="transform:translateY(${i * 30}px)">
          <span class="race-name">${e.chain}</span>
          <span class="race-track"><span class="race-bar" style="width:${(e.lo / maxHi) * 100}%"></span><span class="race-whisk" style="left:${(e.lo / maxHi) * 100}%;width:${((e.hi - e.lo) / maxHi) * 100}%"></span></span>
          <span class="race-val num">${money(e.lo)}${e.n > 1 ? html`<small> · ${t('branches', { n: e.n })}</small>` : nothing}</span>
        </div>`)}</div>` : nothing}
        <div class="chips" style="margin:10px 0 8px"><button class="chip ${!onlyComplete ? 'on' : ''}" @click=${() => c.onOnlyComplete(false)}>${t('allStores')}</button><button class="chip ${onlyComplete ? 'on' : ''}" @click=${() => c.onOnlyComplete(true)}>${t('onlyComplete')}</button></div>
        ${!ranking ? html`<div class="muted">${t('loadingCard')}</div>` : list.length === 0 ? html`<div class="note">${t('noCompleteStore')}</div>` : html`<ul class="rank">${list.slice(0, limit).map((r) => { const s = byStore.get(r.storeId); return html`<li class=${c.selectedStore === r.storeId ? 'sel' : ''} @click=${() => c.onOpenStore(r.storeId)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.storeId); }}>
          <span class="sw ${r.complete ? '' : 'hatch'}" style="background:${r.complete ? swColor(r.dev) : ''}"></span>
          <div class="nm"><div class="n">${s ? s.name : r.storeId}</div><div class="s">${s ? s.chain + (s.municipio ? ' · ' + s.municipio : '') : ''}${r.dateMin && r.date ? ` · ${r.dateMin === r.date ? fdate(r.date, true) : fspan(r.dateMin, r.date, true)}` : ''}</div></div>
          <div class="pr"><div class="p num">${money(r.total)}</div><div class="u">${r.complete ? devChip(r.dev) : html`<span class="miss">${r.missing.length === 1 ? t('missingOne') : t('missing', { n: r.missing.length })}</span>`}</div></div>
        </li>`; })}</ul>
        ${list.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: list.length - limit })}</button>` : nothing}`}
        ${sourceLine('')}
      </section>`}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- settings
export function settingsCard(c) {
  const { prefs, own, meta, geoMeta, canInstall, retrieved } = c;
  const lang = getLang();
  const seg = (key, on, off) => html`<div class="seg" role="group"><button class=${prefs[key] ? 'on' : ''} aria-pressed=${!!prefs[key]} @click=${() => c.onPref(key, true)}>${on}</button><button class=${!prefs[key] ? 'on' : ''} aria-pressed=${!prefs[key]} @click=${() => c.onPref(key, false)}>${off}</button></div>`;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''} settings" role="dialog" aria-label=${t('settings')}>
    ${head({ kicker: t('appName'), title: t('settings'), sub: t('tagline'), onClose: c.onClose })}
    <div class="body">
      <section>
        <div class="row"><div class="l">${t('language')}</div><div class="seg" role="group"><button class=${lang === 'es' ? 'on' : ''} aria-pressed=${lang === 'es'} @click=${() => c.onPref('lang', 'es')}>Español</button><button class=${lang === 'en' ? 'on' : ''} aria-pressed=${lang === 'en'} @click=${() => c.onPref('lang', 'en')}>English</button></div></div>
        <div class="row"><div class="l">${t('motion')}</div>${seg('motion', t('on'), t('off'))}</div>
        <div class="row"><div class="l">${t('labels')}</div>${seg('labels', t('on'), t('off'))}</div>
        <div class="row"><div class="l">${t('tags')}</div>${seg('tags', t('on'), t('off'))}</div>
        ${canInstall ? html`<div class="row"><div class="l">${t('appRow')}</div><button class="btn ghost" @click=${c.onInstall}>${I.download()}${t('install')}</button></div>` : nothing}
      </section>
      <section>
        <h3>${t('ownPrices')} · ${own.length}</h3>
        <p>${t('ownHint')}</p>
        ${own.length === 0 ? html`<p class="muted">${t('ownNone')}</p>` : ownList(own.slice(0, 80), c)}
        <div class="actions">
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('json')}>${I.download()}${t('ownExportJson')}</button>
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('csv')}>${I.download()}${t('ownExportCsv')}</button>
          <label class="btn ghost">${I.upload()}${t('ownImport')}<input type="file" accept="application/json" class="sr" @change=${(e) => { c.onImport(e.target.files[0]); e.target.value = ''; }} /></label>
        </div>
      </section>
      <section>
        <h3>${t('about')}</h3>
        <p>${t('aboutText')}</p>
        <p>${t('dataLag', { date: fdate(meta.latestDate) })}</p>
        <h3 style="margin-top:12px">${t('sources')}</h3>
        <p>${t('sourcePrices', { retrieved })} <a href="https://datos.profeco.gob.mx/datos_abiertos/qqp.php" target="_blank" rel="noopener">datos.profeco.gob.mx</a> · <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="noopener">CC BY 4.0</a></p>
        <p>${t('derived')}</p>
        <p>${t('sourceMap')}${geoMeta && geoMeta.attribution ? html` <span class="muted">(${geoMeta.attribution})</span>` : nothing} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a></p>
        <p><a href="https://github.com/vdm285/compa-precio" target="_blank" rel="noopener">${t('code')}</a>${meta && meta.built ? html` · ${t('builtOn', { date: fdate(meta.built.slice(0, 10)) })}` : nothing}</p>
        <p class="kbd">${t('kbdHint')}</p>
      </section>
    </div>
  </div>`;
}
