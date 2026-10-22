// The side cards: store, product, generic product, basket, settings. Each is a lit template fed
// by main.js; nothing here touches the map directly. Every price shows its date; every
// comparison names its reference (docs/EDITORIAL.md). One grammar for every subject card: the
// cheapest first, the reference named once, the strip of every store, the list.
import { html, svg, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';
import { t, money, pct, fdate, fspan, unitName, getLang, mxDay } from '../app/i18n.js';
import { I } from './icons.js';
import { sparkline } from './spark.js';
import { median, minMax, deviation } from '../logic/stats.js';
import { perUnit, sizeLabel, DIM } from '../logic/unit.js';
import { fold } from './search.js';
import { giroLabel, storeIndexWords, refText, trendText } from './chrome.js';
import { isFar } from '../logic/stats.js';

const MIN_N = 3; // a chip or a flag needs a median from at least this many stores

export function devChip(dev, digits = 0) {
  if (dev == null) return nothing;
  const color = dev < -0.005 ? 'var(--cheaper-ink)' : dev > 0.005 ? 'var(--dearer-ink)' : 'var(--ink-2)';
  const txt = Math.abs(dev) < 0.005 ? t('atMedian') : dev < 0 ? t('pctBelow', { pct: pct(-dev, digits).replace('+', '') }) : t('pctAbove', { pct: pct(dev, digits).replace('+', '') });
  return html`<span class="d num" style="color:${color}">${txt}</span>`;
}
// a chip, or the review flag when the price is too far from its comparison set to be a fair
// comparison. far: the stage's own decision (v.far, see stage.js); when not given, the ratio to
// the reference decides, symmetrically (2.5 times or 0.4 times). farKind names the set.
function chipOrFlag(dev, ok = true, far = null, farKind = 'recent') {
  if (!ok || dev == null) return nothing;
  if (far == null ? isFar(1 + dev, 1) : far) return html`<span class="flag" title=${farKind === 'week' ? t('outlierHintWeek') : t('outlierHint')}>${t('outlier')}</span>`;
  return devChip(dev);
}
const swColor = (dev) => (dev == null ? 'transparent' : dev < -0.005 ? 'var(--cheaper)' : dev > 0.005 ? 'var(--dearer)' : 'var(--mid)');
// a card whose subject is still loading says so; offline, it says it could not be loaded
const pending = (c) => (c.stageFailed ? html`<div class="note">${t('offlineNotLoaded')}</div>` : html`<div class="muted">${t('loadingCard')}</div>`);
// the hero's line under the big number: who, when, and (only for a thin set) the prices set aside
const heroLine = (h) => `${h.line}${h.dateText ? ` · ${h.dateText}` : ''}${h.flagged ? ` · ${t('flaggedNote', { n: h.flagged })}` : ''}`;
// how many rows share the lowest value: a tie is said as a tie, never as one store's win
// The hero of a subject card. The cheapest price that is not flagged "revísalo"; a tie said as a
// tie, dated with the span of the tied stores' dates; under 3 stores no superlative, only the count.
function heroOf(rows, key, nameOf, { thinKey = 'storesWithPrice', dateOf = (r) => [r.date, r.date] } = {}) {
  if (!rows.length) return null;
  const fair = rows.filter((r) => !r.far);
  if (!fair.length) return { best: null, allFar: true };
  const best = fair[0];
  const tied = fair.filter((r) => Math.abs(r[key] - best[key]) < 0.005);
  const ds = tied.flatMap((r) => dateOf(r)).filter(Boolean).sort();
  const dateText = !ds.length ? '' : ds[0] === ds[ds.length - 1] ? fdate(ds[0]) : fspan(ds[0], ds[ds.length - 1]);
  let line;
  // under 3 prices no superlative; a tie between them is said as a tie, never one store by order
  if (fair.length < MIN_N && tied.length > 1) line = t(`${thinKey}Tie`, { n: tied.length });
  else if (fair.length < MIN_N) line = t(thinKey, { n: fair.length, name: nameOf(best) });
  else if (tied.length > 1) line = t('tiedCheapest', { n: tied.length });
  else line = `${t('cheapestHere')} · ${nameOf(best)}`;
  // in a thin set the prices set aside as "revísalo" are counted, so the line agrees with the
  // counts beside it (in a long list the strip and the rows show them)
  const flagged = fair.length < MIN_N ? rows.length - fair.length : 0;
  return { best, line, dateText, flagged };
}
// A store's name in a row: the chain is on the line below, so the row leads with the branch
// ("Bodega Aurrera Sucursal Tacubaya" read "Bodega Aurrera Sucur…" in every row of a tie)
export function branchName(st) {
  const name = String((st && st.name) || '').replace(/\s+Sucursal\s+/i, ' ').trim();
  const chain = String((st && st.chain) || '');
  if (chain && fold(name).startsWith(`${fold(chain)} `)) {
    const rest = name.slice(chain.length).trim();
    if (rest.length >= 2 && !/^\(?\d+\)?$/.test(rest) && !rest.startsWith('(')) return rest;
  }
  return name;
}
const fmtInt = (n) => new Intl.NumberFormat(getLang() === 'en' ? 'en-US' : 'es-MX').format(n);

// a whole row as a real link to its route: Enter opens, middle-click opens a tab, a screen reader
// hears a link named by everything the row shows (an aria-label dropped "falta 1" and "revísalo");
// the click is intercepted so the app keeps its own history
function rowLink(href, open, label, content, selected = false, extra = '') {
  return html`<li class=${`${selected ? 'sel' : ''} ${extra}`}><a class="row" href=${href} @click=${(e) => { if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); open(); } }}>${content}</a></li>`;
}

function head({ kicker, title, sub, onClose, onKicker, id, kickerSame }) {
  // a kicker that repeats the title gives way to its alternative (a product named like its group)
  const k = kicker && fold(kicker) !== fold(title) ? kicker : kickerSame || null;
  return html`<div class="head">
    <div class="grip" aria-hidden="true"></div>
    <div class="titles">
      ${k ? html`<div class="kicker">${onKicker ? html`<button class="klink" @click=${onKicker}>${I.chevronL()}${k}</button>` : k}</div>` : nothing}
      <h2 id=${id} tabindex="-1">${title}</h2>
      ${sub ? html`<div class="sub">${sub}</div>` : nothing}
    </div>
    <button class="x" @click=${onClose} title=${t('close')} aria-label=${t('close')}>${I.x()}</button>
  </div>`;
}

const sourceLine = (retrieved, text) => html`<div class="muted src">PROFECO · Quién es Quién en los Precios · ${retrieved}${text ? html` · ${text}` : nothing}</div>`;
const copyBtn = (c) => html`<button class="btn ghost" @click=${c.onCopyLink}>${I.link()}${t('copyLink')}</button>`;

// unit price inline after the label price, only when it says something the label price does not
function unitInline(price, size, unit) {
  if (!unit || !size || size.unit !== DIM[unit]) return '';
  const base = { l: 1000, kg: 1000, '100g': 100, '100ml': 100, pza: 1 }[unit];
  if (size.value === base) return '';
  const per = perUnit(price, size, unit);
  return per == null ? '' : `${money(per)}/${unitName(unit, true)}`;
}

// ---------------------------------------------------------------- price strip
// Every store's price on one axis, a row per kind of store, coloured like the map. The reference
// is always on the axis; when every store charges the same, it says so in one label instead of
// inventing a range.
export const KIND = (s) => {
  const g = `${s.giro || ''} ${s.chain || ''}`;
  if (/tortiller/i.test(g)) return 'tortilleria';
  if (/central de abasto/i.test(g)) return 'central';
  if (/(^|[\s/·-])mercado/i.test(g) && !/supermercado|autoservicio/i.test(s.giro || '')) return 'mercado';
  if (/farmacia/i.test(g)) return 'farmacia';
  if (/panader|pescader/i.test(g)) return 'tradicional';
  if (/conveniencia|oxxo|7-eleven/i.test(g)) return 'conveniencia';
  // the non-grocery stores PROFECO also surveys (appliances, stationery, department stores, uniforms,
  // shoes, toys), drawn since 2026-10-22
  if (/electrodom|papeler|departamental|uniforme|zapater|jugueter/i.test(s.giro || '')) return 'otro';
  return 'super';
};
export function priceStrip({ rows, ref, refLabel, ownPrice, onPick, selected, unitSuffix = '' }) {
  if (!rows.length) return nothing;
  const W = 364, padL = 6, padR = 6, rowH = 38, axisH = 16, R = 3.4, STEP = 4.2;
  const kinds = [...new Set(rows.map((r) => r.kind))];
  const order = ['super', 'conveniencia', 'mercado', 'central', 'tortilleria', 'tradicional', 'farmacia'];
  kinds.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const vals = rows.map((r) => r.value);
  const all = vals.concat(ownPrice != null ? [ownPrice] : [], ref != null ? [ref] : []);
  let [lo, hi] = minMax(all);
  const flat = Math.max(...vals) === Math.min(...vals);
  if (hi === lo) { hi = hi * 1.05 + 0.01; lo = lo * 0.95; } // layout only: no label shows these
  const x = (v) => padL + ((v - lo) / (hi - lo)) * (W - padL - padR);
  const H = kinds.length * rowH + axisH;
  // beeswarm: equal or near prices stack above and below their row line, up to 5 slots
  const placed = rows.map((r) => ({ ...r, cx: x(r.value), row: kinds.indexOf(r.kind), k: 0 })).sort((a, b) => a.cx - b.cx);
  const stacks = new Map();
  for (const p of placed) { const key = `${p.row}:${Math.round(p.cx / 6)}`; const k = stacks.get(key) || 0; p.k = Math.min(k, 4); stacks.set(key, k + 1); }
  const counts = new Map(kinds.map((k) => [k, rows.filter((r) => r.kind === k).length]));
  const lineY = (i) => i * rowH + 26;
  const OFF = [0, -1, 1, -2, 2];
  const axisLabels = [];
  const fairVals = rows.filter((r) => !r.far).map((r) => r.value);
  const minV = Math.min(...(fairVals.length ? fairVals : vals)), maxV = Math.max(...(fairVals.length ? fairVals : vals));
  if (flat) axisLabels.push({ x: W / 2, text: t('allAt', { n: vals.length, price: money(minV) + unitSuffix }), anchor: 'middle', cls: 'mid' });
  else {
    // the reference's label first; the minimum and maximum only where their text clears it (the
    // anchors alone were compared, and "$180.00" ran into "reciente $190.00")
    const refX = ref != null ? x(ref) : null;
    const span = (a) => { const w = a.text.length * 6.3 + 4; return a.anchor === 'start' ? [a.x, a.x + w] : a.anchor === 'end' ? [a.x - w, a.x] : [a.x - w / 2, a.x + w / 2]; };
    const refLab = refX != null ? { x: refX, text: `${refLabel || ''}${money(ref)}`, anchor: refX < 60 ? 'start' : refX > W - 60 ? 'end' : 'middle', cls: 'mid' } : null;
    const clear = (a) => { if (!refLab) return true; const [l, r] = span(a), [rl, rr] = span(refLab); return r + 6 < rl || l > rr + 6; };
    const lo = { x: x(minV), text: money(minV), anchor: 'start' }, hi = { x: x(maxV), text: money(maxV), anchor: 'end' };
    if (clear(lo)) axisLabels.push(lo);
    if (refLab) axisLabels.push(refLab);
    if (clear(hi) && (!axisLabels.includes(lo) || span(lo)[1] + 6 < span(hi)[0])) axisLabels.push(hi);
  }
  return svg`<svg class="strip" viewBox="0 0 ${W} ${H}" role="img" aria-label=${t('stripAria')}>
    ${kinds.map((k, i) => svg`<text class="strip-k" x=${padL} y=${i * rowH + 10}>${t(`kind_${k}`)} · ${counts.get(k)}</text><line class="strip-row" x1=${padL} x2=${W - padR} y1=${lineY(i)} y2=${lineY(i)}></line>`)}
    ${ref != null && !flat ? svg`<line class="strip-ref" x1=${x(ref)} x2=${x(ref)} y1="12" y2=${H - axisH + 2}></line>` : nothing}
    ${placed.map((p) => svg`<circle class="strip-dot ${selected === p.sid ? 'sel' : ''} ${p.far ? 'far' : ''}" cx=${p.cx} cy=${lineY(p.row) + OFF[p.k] * STEP} r=${R} style="fill:${p.color}" @click=${() => onPick(p.sid)}><title>${p.name} · ${money(p.value)}${unitSuffix} · ${fdate(p.date)}${p.far ? ` · ${t('outlier')}` : ''}</title></circle>`)}
    ${ownPrice != null ? svg`<line class="strip-own" x1=${x(ownPrice)} x2=${x(ownPrice)} y1="12" y2=${H - axisH + 2}></line>` : nothing}
    ${axisLabels.map((a) => svg`<text class="strip-ax ${a.cls || ''}" x=${a.x} y=${H - 3} text-anchor=${a.anchor}>${a.text}</text>`)}
  </svg>`;
}

// ---------------------------------------------------------------- store
export function storeCard(c) {
  const { store, storeFile, byProduct, stage, own, filter, showAll, win, stageTitle } = c;
  const idx = store.index || {};
  const series = (idx.series || []).filter((r) => r[1] != null).map((r) => [r[0], r[1]]);
  const full = series.filter((r) => !(c.partial && c.partial.has(r[0])));
  const latestIdx = full.length ? full[full.length - 1] : null;
  // a later week left out because the city's data that week was thin: the card says why its week is older
  const skippedIdx = latestIdx ? series.filter((r) => r[0] > latestIdx[0]).pop() || null : null;
  const stageVal = stage && stage.values ? stage.values.get(store.id) : null;
  const items = storeFile ? storeFile.items : null;
  const pharmacy = /farmacia/i.test(`${store.giro || ''} ${store.chain || ''}`);
  let recentRows = [], olderRows = [], wins = [], losses = [];
  const split = { n: 0, a: 0, b: 0, c: 0 };
  if (items && byProduct) {
    for (const [pid, price, date] of items) {
      const p = byProduct.get(pid);
      if (!p) continue;
      const recent = date >= win.from;
      const dev = recent && p.median != null && (p.stores ?? 0) >= MIN_N ? deviation(price, p.median) : null;
      (recent ? recentRows : olderRows).push({ p, price, date, dev });
    }
    // the split and the wins and losses count the same products: medicines only in a pharmacy
    // (their spread swamps a supermarket's list and flipped La Comer's answer)
    const eligible = recentRows.filter((r) => r.dev != null && !isFar(1 + r.dev, 1) && (pharmacy || !/medicamento/i.test(r.p.category || '')));
    for (const r of eligible) { split.n++; if (r.dev < -0.005) split.a++; else if (r.dev > 0.005) split.c++; else split.b++; }
    split.noMed = !pharmacy && recentRows.some((r) => r.dev != null && /medicamento/i.test(r.p.category || ''));
    wins = [...eligible].sort((a, b) => a.dev - b.dev).slice(0, 5).filter((r) => r.dev < -0.02);
    losses = [...eligible].sort((a, b) => b.dev - a.dev).slice(0, 5).filter((r) => r.dev > 0.02);
  }
  const words = fold(filter || '').split(' ').filter(Boolean);
  const match = (r) => !words.length || words.every((w) => fold(`${r.p.name} ${r.p.brand || ''} ${r.p.presentation || ''}`).includes(w));
  const listed = recentRows.filter(match).sort((a, b) => a.p.name.localeCompare(b.p.name, 'es'));
  const listedOld = olderRows.filter(match).sort((a, b) => b.date.localeCompare(a.date));
  const limit = showAll ? Infinity : 30;
  const ownHere = (own || []).filter((o) => o.storeId === store.id);
  const row = (r) => rowLink(`#p/${r.p.id}`, () => c.onOpenProduct(r.p.id), `${r.p.name}${r.p.brand ? ' ' + r.p.brand : ''}, ${money(r.price)}, ${fdate(r.date)}`, html`
    <span class="sw" style="background:${swColor(r.dev)}"></span>
    <div class="nm"><div class="n">${r.p.name}${r.p.brand ? ` · ${r.p.brand}` : ''}</div><div class="s">${r.p.presentation || ''}</div></div>
    <div class="pr"><div class="p num">${money(r.price)}</div><div class="u">${fdate(r.date, true)}${r.dev != null ? html` · ${chipOrFlag(r.dev)}` : nothing}</div></div>`, false, r.date < win.from ? 'old' : '');
  const siblings = c.siblings || [];
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-labelledby="card-title">
    ${head({ id: 'card-title', kicker: `${store.chain}${giroLabel(store) ? ' · ' + giroLabel(store) : ''}`, title: store.name, sub: `${store.address || ''}${store.municipio ? ' · ' + store.municipio : ''}`, onClose: c.onClose })}
    <div class="body">
      ${stage && stage.kind !== 'index' && stageVal ? html`<section class="stagebox">
        <button class="h3link" @click=${c.onStageCard}>${I.chevronL()}${stageTitle}</button>
        ${stageVal.value != null ? html`<div class="hero"><span class="big num">${money(stageVal.value)}</span>${stage.kind === 'group' && stage.unit ? html`<span class="unit">/ ${unitName(stage.unit)}</span>` : nothing}${stageVal.hatched ? html`<span class="delta">${stageVal.missing.length === 1 ? t('missingOne') : t('missing', { n: stageVal.missing.length })}</span>` : stageVal.dev != null ? html`<span class="delta">${chipOrFlag(stageVal.dev, true, !!stageVal.far, stage.farKind)}</span>` : nothing}</div>
          <div class="muted">${stageVal.dateMin && stageVal.date && stageVal.dateMin !== stageVal.date ? fspan(stageVal.dateMin, stageVal.date) : fdate(stageVal.date)}${refText(stage) ? ` · ${refText(stage)}` : ''}</div>`
          : html`<div class="note">${{ stale: stageVal.lastDate ? t('reasonStaleDate', { date: fdate(stageVal.lastDate) }) : t('reasonStale'), none: t('reasonNone'), novisit: t('noVisitWeek'), otherUnit: t('reasonOtherUnit') }[stageVal.reason] || t('reasonNone')}${stageVal.lastPrice ? html` · ${money(stageVal.lastPrice)}` : nothing}</div>`}
      </section>` : nothing}
      ${siblings.length ? html`<section>
        <h3>${t('sameSpot')} · ${siblings.length + 1}</h3>
        <ul class="rank">${siblings.slice(0, showAll ? siblings.length : 8).map(({ store: s, val }) => rowLink(`#t/${s.id}`, () => c.onOpenStore(s.id), s.name, html`
          <span class="sw ${val && val.dev != null ? '' : 'empty'}" style="background:${swColor(val && val.dev)}"></span>
          <div class="nm"><div class="n">${s.name}</div><div class="s">${s.chain}${giroLabel(s) ? ' · ' + giroLabel(s) : ''}</div></div>
          <div class="pr">${val && val.value != null ? html`<div class="p num">${stage && stage.kind === 'index' ? storeIndexWords(val.value) : money(val.value)}</div>${stage && stage.kind !== 'index' ? devChip(val.dev) : nothing}` : nothing}</div>`))}</ul>
        ${siblings.length > 8 && !showAll ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: siblings.length - 8 })}</button>` : nothing}
      </section>` : nothing}
      <section>
        <h3>${t('indexCardTitle')}</h3>
        ${split.n ? html`<div class="refline split">${t('indexSplit', { span: fspan(win.from, win.to, true), n: split.n, a: t('splitCheaper', { n: split.a }), b: t('splitEqual', { n: split.b }), c: t('splitDearer', { n: split.c }), noMed: split.noMed ? t('splitNoMed') : '' })}</div>` : nothing}
        ${latestIdx ? html`<div class="hero"><span class="big">${storeIndexWords(latestIdx[1])}</span></div>
          <div class="muted">${t(Math.abs(latestIdx[1] - 1) < 0.005 ? 'indexSubAt' : 'indexSub', { date: fdate(latestIdx[0]) })}${latestIdx[0] < win.fromWeek ? html` · <span class="flag">${t('notRecent')}</span>` : nothing}${skippedIdx ? ` · ${t('indexSkipped', { date: fdate(skippedIdx[0]) })}` : ''}</div>`
          : html`<div class="note">${t('reasonFew')}</div>`}
        <div class="muted">${t('visitLine', { date: fdate(store.lastSeen), n: store.lastVisitProducts ?? 0 })} · ${t('allTimeLine', { n: store.products, date: fdate(store.firstSeen, 'monthYear') })}</div>
        ${series.length > 1 ? html`<div style="margin-top:8px">${sparkline(series, { band: false, cursor: stage && stage.kind === 'index' && stage.weekIdx != null ? series.findIndex((r) => r[0] === stage.week) : null, onPick: c.onPickWeek, ref: 1 })}</div>` : nothing}
        <details><summary class="muted">${t('howIndex')}</summary><p class="note">${t('indexMethod')}${latestIdx ? html` ${t('indexRatio', { v: latestIdx[1].toFixed(3) })}` : nothing}</p></details>
        <div class="actions">${copyBtn(c)}</div>
      </section>
      ${store.unplaced ? html`<section><div class="note">${t('unplacedNote')}</div></section>` : nothing}
      ${wins.length ? html`<section><h3>${t('bestHere')} · ${fspan(win.from, win.to, true)}</h3><ul class="rank">${wins.map(row)}</ul></section>` : nothing}
      ${losses.length ? html`<section><h3>${t('worstHere')} · ${fspan(win.from, win.to, true)}</h3><ul class="rank">${losses.map(row)}</ul></section>` : nothing}
      ${ownHere.length ? html`<section><h3>${t('ownPrices')}</h3>${ownList(ownHere, c, { showStore: false })}</section>` : nothing}
      <section>
        <h3>${t('storeList')}</h3>
        ${items == null ? html`<div class="muted">${t('loadingCard')}</div>` : storeFile.error ? html`<div class="note">${t('loadFailedCard')}</div>` : recentRows.length + olderRows.length === 0 ? html`<div class="note">${t('emptyStore')}</div>` : html`
          <div class="ownform" style="margin:0 0 8px"><input id="store-filter" type="search" enterkeyhint="search" aria-label=${t('searchInStore')} placeholder=${t('searchInStore')} .value=${filter || ''} @input=${(e) => c.onFilter(e.target.value)} @keydown=${(e) => { if (e.key === 'Escape' && e.target.value) { e.stopPropagation(); c.onFilter(''); } }} style="flex:1" /></div>
          <div class="subh">${t('recentSpan', { span: fspan(win.from, win.to, true) })} · ${fmtInt(listed.length)}</div>
          <ul class="rank">${listed.slice(0, limit).map(row)}</ul>
          ${listed.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: listed.length - limit })}</button>` : nothing}
          ${listedOld.length ? html`<details class="older"><summary class="subh">${t('before')} · ${fmtInt(listedOld.length)}</summary><ul class="rank old">${listedOld.slice(0, showAll ? Infinity : 40).map(row)}</ul></details>` : nothing}`}
        ${sourceLine(c.retrieved, store.lastSeen ? t('visitShort', { date: fdate(store.lastSeen) }) : '')}
      </section>
    </div>
  </div>`;
}

function ownList(rows, c, { showStore = true, showProduct = true } = {}) {
  return html`<ul class="ownlist">${repeat(rows, (o) => o.id, (o) => {
    const p = c.byProduct && c.byProduct.get(o.productId);
    const s = c.byStore && c.byStore.get(o.storeId);
    const parts = [];
    if (showProduct && p) parts.push(`${p.name}${p.brand ? ' · ' + p.brand : ''}`);
    if (showStore && s) parts.push(s.name);
    parts.push(fdate(o.date, true));
    return html`<li><span class="p num">${money(o.price)}</span><span class="m">${parts.join(' · ')}${o.vs ? html` · ${o.vs}` : nothing}</span><button class="del" title=${t('ownDelete')} aria-label=${`${t('ownDelete')}: ${money(o.price)}, ${parts.join(', ')}`} @click=${(e) => c.onDeleteOwn(o.id, e.currentTarget)}>${I.trash()}</button></li>`;
  })}</ul>`;
}

// ---------------------------------------------------------------- product
export function productCard(c) {
  const { summary, stage, byStore, byGroup, own, showAll, inBasket, unit, win } = c;
  const mine = stage && stage.kind === 'product' && stage.id === summary.id ? stage : null;
  const okChip = !!(mine && !mine.tooFew);
  const ranked = [];
  if (mine) for (const [sid, v] of mine.values) if (v.value != null) { const s = byStore.get(sid); if (s) ranked.push({ sid, s, price: v.value, dev: v.dev, far: !!v.far, date: v.date, kind: KIND(s), color: v.neutral ? 'var(--mid)' : swColor(v.dev) }); }
  ranked.sort((a, b) => a.price - b.price);
  const weekMode = mine && mine.weekIdx != null;
  const ref = mine ? mine.ref : summary.median;
  // a week's median is said only when 3 stores give it; the recent reference is named only when it is one
  const weekMedOk = weekMode && mine.weekN >= MIN_N;
  const recentRef = !!(mine && mine.refKind === 'recent');
  const limit = showAll ? ranked.length : 10;
  const ownHere = (own || []).filter((o) => o.productId === summary.id);
  const group = byGroup ? byGroup.get(summary.group) : null;
  const ownByStore = new Map(); for (const o of ownHere) if (!ownByStore.has(o.storeId)) ownByStore.set(o.storeId, o);
  const latestOwn = ownHere[0];
  const when = mine ? (weekMode ? t('week', { date: fdate(mine.week) }) : t('recentSpan', { span: fspan(win.from, win.to) })) : '';
  const hero = heroOf(ranked, 'price', (r) => `${r.s.name}${r.s.unplaced ? ` (${t('noDot')})` : ''}`);
  const best = hero && hero.best;
  const sizeInPres = summary.size && summary.presentation && fold(summary.presentation).startsWith(fold(sizeLabel(summary.size, getLang())).split(' ')[0]);
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-labelledby="card-title">
    ${head({ id: 'card-title', kicker: group ? group.name : summary.category, kickerSame: group && group.products > 1 ? t('allOfGroup', { n: group.products }) : null, onKicker: group ? () => c.onOpenGroup(group.id) : null, title: `${summary.name}${summary.brand ? ' · ' + summary.brand : ''}`, sub: `${summary.presentation || ''}${summary.size && !sizeInPres ? ' · ' + sizeLabel(summary.size, getLang()) : ''}`, onClose: c.onClose })}
    <div class="body">
      <section>
        <h3>${t('cityWide')}${when ? ` · ${when}` : ''}</h3>
        ${hero && hero.allFar ? html`<div class="note">${t('allFlagged')}</div>` : nothing}
        ${best ? html`<div class="hero"><span class="big num">${money(best.price)}${unitInline(best.price, summary.size, unit) ? html`<small> · ${unitInline(best.price, summary.size, unit)}</small>` : nothing}</span></div>
          <div class="unitline">${heroLine(hero)}</div>
          <div class="refline">${weekMode ? html`${weekMedOk ? html`${t('weekMedian')}: <b class="num">${money(mine.weekMed)}</b> · ` : nothing}${t('storesThisWeek', { n: ranked.length })}${recentRef && refText(mine) ? html` · ${refText(mine)}` : nothing}` : refText(mine) || nothing}</div>`
          : !mine ? pending(c) : hero && hero.allFar ? nothing : weekMode ? html`<div class="note">${t('noVisitWeek')}</div>` : html`<div class="note">${t('noRecentPrice')}${summary.last ? html` ${t('lastData', { date: fdate(summary.last) })}` : nothing}</div>`}
        ${mine && trendText(mine) ? html`<div class="muted trend">${trendText(mine)}</div>` : nothing}
        ${ranked.length > 1 ? html`<div class="stripwrap">${priceStrip({ rows: ranked.map((r) => ({ ...r, value: r.price, name: r.s.name })), ref: okChip ? ref : null, refLabel: weekMode && recentRef ? `${t('recentWord')} ` : '', ownPrice: latestOwn ? latestOwn.price : null, onPick: c.onOpenStore, selected: c.selectedStore })}</div>` : nothing}
        <div class="actions">
          <button class="btn ${inBasket ? 'on' : ''}" @click=${c.onToggleBasket}>${inBasket ? I.check() : I.plus()}${inBasket ? t('inBasket') : t('addToBasket')}</button>
          ${copyBtn(c)}
        </div>
      </section>
      <section>
        <h3>${t('ranking')}${weekMode && okChip && recentRef ? html` · ${t('vsRecentShort')}` : nothing}</h3>
        ${!mine ? pending(c) : ranked.length === 0 ? html`<div class="note">${weekMode ? t('noVisitWeek') : t('noRecentPrice')}</div>` : html`
          <ul class="rank stores">${ranked.slice(0, limit).map((r) => { const ui2 = unitInline(r.price, summary.size, unit); const chip = okChip ? chipOrFlag(r.dev, okChip, r.far, mine.farKind) : nothing; return rowLink(`#t/${r.sid}`, () => c.onOpenStore(r.sid), `${r.s.name}, ${money(r.price)}, ${fdate(r.date)}`, html`
            <span class="sw" style="background:${r.color}"></span>
            <div class="nm"><div class="n">${branchName(r.s)}</div><div class="s">${r.s.chain}${r.s.municipio ? ' · ' + r.s.municipio : ''}${ownByStore.has(r.sid) ? html` · <span class="own">${t('ownMark')} ${money(ownByStore.get(r.sid).price)}</span>` : nothing}</div></div>
            <div class="pr wrapu"><div class="p num">${money(r.price)}</div><div class="u"><span class="nowrap">${fdate(r.date, true)}${ui2 || chip !== nothing ? ' ·' : ''}</span>${ui2 ? html` <span class="nowrap">${ui2}${chip !== nothing ? ' ·' : ''}</span>` : nothing}${chip !== nothing ? html` ${chip}` : nothing}</div></div>`, c.selectedStore === r.sid); })}</ul>
          ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
      </section>
      <section>
        <h3>${t('ownPrices')}</h3>
        <div class="note">${t('ownHint')}</div>
        ${keyed(summary.id, html`<form class="ownform" @submit=${(e) => { e.preventDefault(); const f = e.target; c.onAddOwn({ price: f.price.value, storeId: f.store.value }); f.price.value = ''; }}>
          <input id="own-price" class="money num" name="price" type="number" inputmode="decimal" enterkeyhint="done" min="0.01" step="0.01" placeholder="$" required aria-label=${t('ownAdd')} />
          <select id="own-store" name="store" aria-label=${t('store')}>${(c.storeOptions || []).map((s) => html`<option value=${s.id} ?selected=${s.id === c.defaultStore}>${s.name} · ${s.chain}</option>`)}</select>
          <button class="btn" type="submit">${I.check()}${t('ownSave')}</button>
        </form>`)}
        ${ownHere.length ? ownList(ownHere.map((o) => { const v = mine && mine.values.get(o.storeId); return { ...o, vs: v && v.value != null ? t('ownVs', { diff: pct(deviation(o.price, v.value)), date: fdate(v.date, true) }) : null }; }), { ...c, byProduct: null }, { showProduct: false }) : nothing}
        ${sourceLine(c.retrieved, summary.asOf ? t('asOf', { date: fdate(summary.asOf) }) : '')}
        ${unit ? html`<div class="muted">${t('unitNote')}</div>` : nothing}
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- group
export function groupCard(c) {
  const { group, members, stage, byStore, byProduct, showAll, win } = c;
  // (a stage still loading has no unit yet: every member would read "en otra unidad")
  const mine = stage && stage.kind === 'group' && stage.id === group.id && !stage.loading ? stage : null;
  const okChip = !!(mine && !mine.tooFew);
  const unit = mine ? mine.unit : null, dim = mine ? mine.dim : null;
  const uShort = unit ? unitName(unit, true) : '';
  // in a chosen week each member shows its median price that week, not its recent one
  const wk = mine && mine.memberWeekN;
  const labelOf = (p) => (wk ? (wk.get(p.id) || {}).price ?? null : p.median);
  const perOf = (p) => (wk ? (wk.get(p.id) || {}).per ?? null : unit && p.median != null && p.size && p.size.unit === dim ? perUnit(p.median, p.size, unit) : null);
  const sized = members.filter((p) => p.size && p.size.unit === dim).sort((a, b) => (perOf(a) ?? Infinity) - (perOf(b) ?? Infinity));
  const otherUnit = members.filter((p) => p.size && p.size.unit !== dim);
  const unsized = members.filter((p) => !p.size);
  const ranked = [];
  if (mine) for (const [sid, v] of mine.values) if (v.value != null) { const s = byStore.get(sid); if (s) ranked.push({ sid, s, ...v, far: !!v.far, kind: KIND(s), color: v.neutral ? 'var(--mid)' : swColor(v.dev) }); }
  ranked.sort((a, b) => a.value - b.value);
  const limit = showAll ? ranked.length : 10;
  const pLimit = showAll ? sized.length : 12;
  const hero = heroOf(ranked, 'value', (r) => `${r.s.name}${r.s.unplaced ? ` (${t('noDot')})` : ''}`);
  const best = hero && hero.best;
  const bestP = best && byProduct.get(best.pid);
  const excluded = (mine && mine.excluded) || new Map();
  const weekMode = mine && mine.weekIdx != null;
  // a ranking row says which member gave the price, leading with what tells the members apart:
  // the brand (else the name when it is not the group's), then the presentation without the words
  // every member shares ("Lata 360 Gr. Evaporada" hid "Parcialmente Descremada"), then the price
  // paid when it differs from the per-unit figure
  const shared = (() => { const ws = members.map((p) => (p.presentation || '').split(' ')); if (ws.length < 2) return 0; let i = 0; while (ws.every((w) => w[i] !== undefined && w[i] === ws[0][i])) i++; return i; })();
  const tail = (p) => { const w = (p.presentation || '').split(' '); return shared && w.length > shared ? w.slice(shared).join(' ') : p.presentation; };
  const memberLine = (r, p) => [p.brand || (fold(p.name) !== fold(group.name) ? p.name : null), tail(p), Math.abs(r.price - r.value) > 0.005 ? money(r.price) : null].filter(Boolean).join(' · ');
  // a week view counts each member's stores that week; members in another unit or with no size
  // are listed, never coloured against the group's unit
  const OUT = { size: 'memberOutSize', few: 'memberOutFew', fewWeek: 'memberOutFewWeek' };
  const countText = (p) => `${p.stores ? t('storesRecentShort', { n: p.stores }) : t('noRecentShort')}${wk && wk.has(p.id) ? ` · ${t('storesWeekShort', { n: wk.get(p.id).n })}` : ''}`;
  const memberRow = (p, per, label, compare = true) => rowLink(`#p/${p.id}`, () => c.onOpenProduct(p.id), `${p.brand || p.name}, ${p.presentation || ''}`, html`
    <span class="sw ${excluded.has(p.id) || !compare ? 'empty' : ''}" style="background:${compare && per != null && mine && mine.ref && okChip && !excluded.has(p.id) ? swColor(deviation(per, mine.ref)) : 'transparent'}"></span>
    <div class="nm"><div class="n">${p.brand || p.presentation || p.name}</div><div class="s">${p.brand ? `${p.presentation || ''} · ` : ''}${countText(p)}${excluded.has(p.id) ? html` · <span class="out">${t(OUT[excluded.get(p.id)])}</span>` : nothing}</div></div>
    <div class="pr">${per != null ? html`<div class="p num">${money(per)}<small class="pu">/${label}</small></div>${labelOf(p) != null && Math.abs(per - labelOf(p)) > 0.005 ? html`<div class="u">${money(labelOf(p))} ${t('label')}</div>` : nothing}` : labelOf(p) != null ? html`<div class="p num">${money(labelOf(p))}</div><div class="u">${t('label')}</div>` : nothing}</div>`);
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-labelledby="card-title">
    ${head({ id: 'card-title', kicker: group.category, title: group.name, sub: `${t('products_n', { n: members.length })}${mine && unit ? ` · ${t('groupStoresLine', { n: mine.n, unit: unitName(unit) })}${mine.otherN ? ` · ${t('groupOtherLine', { n: mine.otherN })}` : ''}` : ''}`, onClose: c.onClose })}
    <div class="body">
      ${hero && hero.allFar ? html`<section><div class="note">${t('allFlagged')}</div></section>` : nothing}
      ${unit && best ? html`<section>
        <h3>${t('cheapestPerUnit')} · ${weekMode ? t('week', { date: fdate(mine.week) }) : t('recentSpan', { span: fspan(win.from, win.to) })}</h3>
        <div class="hero"><span class="big num">${money(best.value)}<small>/${uShort}</small></span></div>
        <div class="unitline">${heroLine(hero)}</div>
        ${bestP ? html`<div class="muted">${bestP.brand || bestP.name} ${bestP.presentation || ''} · ${money(best.price)}</div>` : nothing}
        <div class="refline">${weekMode && mine.weekRef != null && mine.weekN >= MIN_N ? html`${t('weekRefGroup', { ref: `${money(mine.weekRef)}/${uShort}`, n: mine.weekN })} · ` : nothing}${refText(mine)}</div>
        ${trendText(mine) ? html`<div class="muted trend">${trendText(mine)}</div>` : nothing}
        ${ranked.length > 1 ? html`<div class="stripwrap">${priceStrip({ rows: ranked.map((r) => ({ ...r, value: r.value, name: r.s.name })), ref: okChip ? mine.ref : null, refLabel: weekMode ? `${t('recentWord')} ` : '', onPick: c.onOpenStore, selected: c.selectedStore, unitSuffix: `/${uShort}` })}</div>` : nothing}
        <div class="actions">${copyBtn(c)}</div>
      </section>` : nothing}
      ${unit && !best && mine && trendText(mine) ? html`<section><div class="muted trend">${trendText(mine)}</div></section>` : nothing}
      <section>
        <h3>${t('sizes')}${unit ? html` · ${t('perUnit', { unit: unitName(unit) })}` : nothing}${wk ? html` · ${t('medianThatWeek')}` : nothing}</h3>
        ${!mine ? pending(c) : html`<ul class="rank">${sized.slice(0, pLimit).map((p) => memberRow(p, perOf(p), uShort))}</ul>`}
        ${mine && sized.length > pLimit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: sized.length - pLimit })}</button>` : nothing}
        ${mine && otherUnit.length ? html`<div class="subh">${t('otherUnit')}</div><ul class="rank">${otherUnit.map((p) => { const u = p.size.unit === 'pza' ? 'pza' : p.size.unit === 'ml' ? 'l' : 'kg'; return memberRow(p, wk ? ((wk.get(p.id) || {}).per ?? null) : p.median != null ? perUnit(p.median, p.size, u) : null, unitName(u, true), false); })}</ul>` : nothing}
        ${mine && unsized.length ? html`<div class="subh">${t('noSize')}</div><ul class="rank">${unsized.map((p) => memberRow(p, null, '', false))}</ul>` : nothing}
      </section>
      ${unit ? html`<section>
        <h3>${t('ranking')} · ${t('perUnit', { unit: unitName(unit) })}${weekMode && okChip ? html` · ${t('vsRecentShort')}` : nothing}</h3>
        ${!mine ? pending(c) : ranked.length === 0 ? html`<div class="note">${weekMode ? t('noVisitWeek') : t('noRecentPrice')}</div>` : html`<ul class="rank stores">${ranked.slice(0, limit).map((r) => { const p = byProduct.get(r.pid); return rowLink(`#t/${r.sid}`, () => c.onOpenStore(r.sid), `${r.s.name}, ${money(r.value)} / ${unitName(unit)}`, html`
          <span class="sw" style="background:${r.color}"></span>
          <div class="nm"><div class="n">${branchName(r.s)}</div><div class="s">${r.s.chain}${r.s.municipio ? ` · ${r.s.municipio}` : ''}</div>${p ? html`<div class="s2">${memberLine(r, p)}</div>` : nothing}</div>
          <div class="pr"><div class="p num">${money(r.value)}<small class="pu">/${uShort}</small></div><div class="u">${fdate(r.date, true)}${okChip ? html` · ${chipOrFlag(r.dev, true, r.far, mine.farKind)}` : nothing}</div></div>`, c.selectedStore === r.sid); })}</ul>
        ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
        ${sourceLine(c.retrieved, '')}
      </section>` : nothing}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- basket
// The chain race on one shared axis: a dot at the cheapest complete branch, a whisker to the
// dearest, from the lowest total to the highest. No bar implies a zero baseline.
function chainRace(chains) {
  if (chains.length < 2) return nothing;
  const rowH = 26;
  const lo = Math.min(...chains.map((e) => e.lo)), hi = Math.max(...chains.map((e) => e.hi));
  const span = hi - lo || 1;
  const x = (v) => (((v - lo) / span) * 100).toFixed(2);
  // the name column grows to the longest chain, up to 144 px ("Farmacias Guadalajara" needs 140)
  const nameW = Math.min(144, Math.max(112, Math.ceil(Math.max(...chains.map((e) => e.chain.length)) * 6.8)));
  return html`<div class="race" style="height:${chains.length * rowH + 18}px;--rn:${nameW}px" aria-hidden="true">
    ${repeat(chains, (e) => e.chain, (e, i) => html`<div class="race-row" style="transform:translateY(${i * rowH}px)">
      <span class="race-name" title=${e.chain}>${e.chain}</span>
      <span class="race-track"><span class="race-whisk" style="left:${x(e.lo)}%;width:${(x(e.hi) - x(e.lo)).toFixed(2)}%"></span><span class="race-dot" style="left:${x(e.lo)}%"></span></span>
      <span class="race-val num">${money(e.lo)}${e.n > 1 ? html`<small> · ${t('branches', { n: e.n })}</small>` : nothing}</span>
    </div>`)}
    <div class="race-axis" style="top:${chains.length * rowH + 2}px"><span>${money(lo)}</span><span>${money(hi)}</span></div>
  </div>`;
}

export function basketCard(c) {
  const { items, byProduct, byStore, stage, onlyComplete, showAll, win, offer } = c;
  const ranking = stage && stage.kind === 'basket' ? stage.ranking : null;
  const okChip = !!(stage && !stage.tooFew && stage.ref != null);
  const list = ranking ? (onlyComplete ? ranking.list.filter((r) => r.complete) : ranking.list) : [];
  const limit = showAll ? list.length : 12;
  const chains = new Map();
  if (ranking) for (const r of ranking.list) {
    if (!r.complete) continue;
    const s = byStore.get(r.storeId); if (!s) continue;
    const e = chains.get(s.chain) || { chain: s.chain, lo: Infinity, hi: -Infinity, n: 0 };
    e.lo = Math.min(e.lo, r.total); e.hi = Math.max(e.hi, r.total); e.n++;
    chains.set(s.chain, e);
  }
  const chainList = [...chains.values()].sort((a, b) => a.lo - b.lo).slice(0, 8);
  const weekMode = !!(stage && stage.weekIdx != null);
  const when = weekMode ? t('week', { date: fdate(stage.week) }) : t('recentSpan', { span: fspan(win.from, win.to) });
  const completeRows = ranking ? ranking.list.filter((r) => r.complete) : [];
  const bHero = heroOf(completeRows, 'total', (r) => (byStore.get(r.storeId) ? byStore.get(r.storeId).name : ''), { thinKey: 'completeHero', dateOf: (r) => [r.dateMin || r.date, r.date] });
  const best = bHero && bHero.best;
  const units = items.reduce((n, b) => n + b.qty, 0);
  // a shared basket still loading: the card is about it, not about an empty basket
  const offerPending = !!(offer && !c.catalogReady);
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-labelledby="card-title">
    ${head({ id: 'card-title', kicker: t('basket'), title: items.length ? `${t('products_n', { n: items.length })}${units !== items.length ? ` · ${t('units_n', { n: units })}` : ''}` : offerPending ? t('sharedTitle') : t('basketEmptyTitle'), sub: ranking && ranking.completeCount ? t(weekMode ? 'completeStoresWeek' : 'completeStores', { n: ranking.completeCount }) : '', onClose: c.onClose })}
    <div class="body">
      ${offer && !c.catalogReady ? html`<section class="offer"><div class="note">${t('sharedLoading')}</div></section>` : nothing}
      ${offer && c.catalogReady ? html`<section class="offer">
        <div class="note">${t('sharedBasket', { n: offer.length })}</div>
        <ul class="bitems">${offer.map((it) => { const p = byProduct.get(it.id); return html`<li><div><div class="n">${p ? p.name + (p.brand ? ' · ' + p.brand : '') : it.id}</div><div class="s">${p ? p.presentation || '' : ''}</div></div><span class="num">× ${it.qty}</span><span></span></li>`; })}</ul>
        <div class="actions"><button class="btn" @click=${c.onOfferUse}>${t('offerUse')}</button><button class="btn ghost" @click=${c.onOfferMerge}>${t('offerMerge')}</button><button class="btn ghost" @click=${c.onOfferDismiss}>${t('offerDismiss')}</button></div>
      </section>` : nothing}
      ${items.length === 0 && offerPending ? nothing : items.length === 0 ? html`<section><div class="note" id="basket-empty" tabindex="-1">${t('basketEmpty')}</div></section>
      ${c.pacicGroups && c.pacicGroups.length ? html`<section><h3>${t('canasta')} · PACIC</h3><div class="note" style="margin-bottom:8px">${t('pacicHint', { n: c.pacicGroups.length })}</div><div class="chips">${c.pacicGroups.map((g) => html`<button class="chip" @click=${() => c.onOpenGroup(g.id)}>${g.name}</button>`)}</div></section>` : nothing}` : html`
      <section>
        <h3>${t('rankingBasket')} · ${when}${weekMode && okChip && stage.refKind === 'recent' && ranking && ranking.completeCount > 0 ? html` · ${t('vsRecentShort')}` : nothing}</h3>
        ${best ? html`<div class="hero"><span class="big num">${money(best.total)}</span></div>
          <div class="unitline">${heroLine(bHero)}</div>
          ${ranking.base != null && ranking.completeCount >= MIN_N && ranking.base > best.total ? html`<div class="refline">${t(weekMode ? 'savingsMedianWeek' : 'savingsMedian', { amount: money(ranking.base - best.total), n: ranking.completeCount, median: money(ranking.base) })}</div>` : nothing}` : !ranking ? pending(c) : html`<div class="note">${onlyComplete ? t('noCompleteStore') : t('noCompleteStoreAll')}</div>`}
        ${chainRace(chainList)}
        <div class="chips" style="margin:10px 0 8px"><button class="chip ${!onlyComplete ? 'on' : ''}" aria-pressed=${!onlyComplete ? 'true' : 'false'} @click=${() => c.onOnlyComplete(false)}>${t('allStores')}</button><button class="chip ${onlyComplete ? 'on' : ''}" aria-pressed=${onlyComplete ? 'true' : 'false'} @click=${() => c.onOnlyComplete(true)}>${t('onlyComplete')}</button></div>
        ${!ranking ? pending(c) : list.length === 0 ? html`<div class="note">${t('noCompleteStore')}</div>` : html`<ul class="rank stores">${list.slice(0, limit).map((r) => { const s = byStore.get(r.storeId); return rowLink(`#t/${r.storeId}`, () => c.onOpenStore(r.storeId), `${s ? s.name : r.storeId}, ${money(r.total)}`, html`
          <span class="sw ${r.complete ? '' : 'hatch'}" style="background:${r.complete ? (okChip ? swColor(r.dev) : 'var(--mid)') : ''}"></span>
          <div class="nm"><div class="n">${s ? branchName(s) : r.storeId}</div><div class="s">${s ? s.chain + (s.municipio ? ' · ' + s.municipio : '') : ''}${r.dateMin && r.date ? ` · ${r.dateMin === r.date ? fdate(r.date, true) : fspan(r.dateMin, r.date, true)}` : ''}</div></div>
          <div class="pr"><div class="p num">${money(r.total)}</div><div class="u">${r.complete ? (okChip ? devChip(r.dev) : nothing) : html`<span class="miss">${r.missing.length === 1 ? t('missingOne') : t('missing', { n: r.missing.length })}</span>`}</div></div>`, c.selectedStore === r.storeId, r.complete ? '' : 'partial'); })}</ul>
        ${list.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: list.length - limit })}</button>` : nothing}`}
        ${sourceLine(c.retrieved, '')}
      </section>
      <section>
        <h3>${t('yourList')}</h3>
        <ul class="bitems mine">${repeat(items, (it) => it.id, (it) => { const p = byProduct.get(it.id); const name = p ? p.name + (p.brand ? ' · ' + p.brand : '') : c.catalogReady ? it.id : t('loadingShort'); return html`<li tabindex="-1" aria-label=${name}>
          <div><a class="n linkish" href=${`#p/${it.id}`} @click=${(e) => { e.preventDefault(); c.onOpenProduct(it.id); }}>${name}</a><div class="s">${p && p.median != null ? html`<b class="num nowrap">${money(p.median)}</b> · ` : nothing}${p ? (p.presentation || '') : ''}${p && p.median != null ? ` · ${t('storesRecentShort', { n: p.stores })}` : p ? ` · ${t('noRecentShort')}` : ''}</div></div>
          <div class="qty"><button @click=${() => c.onQty(it.id, it.qty - 1)} aria-label=${`${t('less')}: ${name}`}>−</button><span class="num" aria-label=${t('qty')}>${it.qty}</span><button @click=${() => c.onQty(it.id, it.qty + 1)} ?disabled=${it.qty >= 99} aria-label=${`${t('more1')}: ${name}`}>+</button></div>
          <button class="rm" @click=${() => c.onQty(it.id, 0)} title=${t('removeFromBasket')} aria-label=${`${t('removeFromBasket')}: ${name}`}>${I.x()}</button>
        </li>`; })}</ul>
        <div class="actions">${copyBtn(c)}<button class="btn ghost" @click=${c.onClear}>${I.trash()}${t('clear')}</button></div>
      </section>`}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- settings
export function settingsCard(c) {
  // (the phone's map band is too small for tags: the switch is hidden there)
  const { prefs, own, meta, canInstall, retrieved } = c;
  const lang = getLang();
  const seg = (key, labelId, on, off) => html`<div class="seg" role="group" aria-labelledby=${labelId}><button class=${prefs[key] !== false ? 'on' : ''} aria-pressed=${prefs[key] !== false ? 'true' : 'false'} @click=${() => c.onPref(key, true)}>${on}</button><button class=${prefs[key] === false ? 'on' : ''} aria-pressed=${prefs[key] === false ? 'true' : 'false'} @click=${() => c.onPref(key, false)}>${off}</button></div>`;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''} settings" role="dialog" aria-labelledby="card-title">
    ${head({ id: 'card-title', kicker: t('appName'), title: t('settings'), sub: t('tagline'), onClose: c.onClose })}
    <div class="body">
      <section>
        <div class="row"><div class="l" id="set-lang">${t('language')}</div><div class="seg" role="group" aria-labelledby="set-lang"><button class=${lang === 'es' ? 'on' : ''} aria-pressed=${lang === 'es' ? 'true' : 'false'} @click=${() => c.onPref('lang', 'es')}>Español</button><button class=${lang === 'en' ? 'on' : ''} aria-pressed=${lang === 'en' ? 'true' : 'false'} @click=${() => c.onPref('lang', 'en')}>English</button></div></div>
        <div class="row"><div class="l" id="set-motion">${t('motion')}</div>${seg('motion', 'set-motion', t('on'), t('off'))}</div>
        <div class="row"><div class="l" id="set-labels">${t('labels')}</div>${seg('labels', 'set-labels', t('on'), t('off'))}</div>
        ${c.phone ? nothing : html`<div class="row"><div class="l" id="set-tags">${t('tags')}</div>${seg('tags', 'set-tags', t('on'), t('off'))}</div>`}
        <div class="row"><div class="l" id="set-opening">${t('openingPref')}</div>${seg('opening', 'set-opening', t('on'), t('off'))}</div>
        <div class="row"><div class="l">${t('reliefRow')}</div><button class="btn ghost" @click=${c.onOpenRelief}>${t('seeRelief')}</button></div>
        ${canInstall ? html`<div class="row"><div class="l">${t('appRow')}</div><button class="btn ghost" @click=${c.onInstall}>${I.download()}${t('install')}</button></div>` : nothing}
      </section>
      <section>
        <h3>${t('ownPrices')} · ${own.length}</h3>
        <p>${t('ownHint')}</p>
        ${own.length === 0 ? html`<p class="muted">${t('ownNone')}</p>` : ownList(own.slice(0, 80), c)}
        <div class="actions">
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('json')}>${I.download()}${t('ownExportJson')}</button>
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('csv')}>${I.download()}${t('ownExportCsv')}</button>
          <button class="btn ghost" @click=${(e) => e.currentTarget.nextElementSibling.click()}>${I.upload()}${t('ownImport')}</button><input id="own-import" type="file" accept="application/json" hidden @change=${(e) => { c.onImport(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </section>
      <section>
        <h3>${t('about')}</h3>
        <p>${t('aboutText')}</p>
        <p>${t('dataLag', { date: fdate(meta.latestDate) })}</p>
        <h3 style="margin-top:12px">${t('sources')}</h3>
        <p>${t('sourcePrices', { retrieved })} <a href="https://datos.profeco.gob.mx/datos_abiertos/qqp.php" target="_blank" rel="noopener">datos.profeco.gob.mx</a> · <a href=${`https://creativecommons.org/licenses/by/4.0/deed.${lang === 'en' ? 'en' : 'es'}`} target="_blank" rel="noopener">CC BY 4.0</a></p>
        <p>${t('derived')}</p>
        <p>${t('sourceMap')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a></p>
        <p><a href="https://github.com/vdm285/compa-precio" target="_blank" rel="noopener">${t('code')}</a>${meta && meta.built ? html` · ${t('builtOn', { date: fdate(mxDay(meta.built)) })}` : nothing}</p>
        <p class="kbd">${t('kbdHint')}</p>
      </section>
    </div>
  </div>`;
}
