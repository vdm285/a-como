// The side cards: store, product, generic product, basket, settings. Each is a lit template
// fed by main.js; nothing here touches the map directly. Every price shows its date.
import { html, nothing } from 'lit';
import { t, money, pct, fdate, unitName, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { sparkline } from './spark.js';
import { median, minMax, deviation } from '../logic/stats.js';
import { unitFor, perUnit, sizeLabel } from '../logic/unit.js';
import { fold } from './search.js';

export function devChip(dev, digits = 0) {
  if (dev == null) return nothing;
  const color = dev < -0.005 ? 'var(--cheaper)' : dev > 0.005 ? 'var(--dearer)' : 'var(--ink-2)';
  const txt = Math.abs(dev) < 0.005 ? t('atMedian') : dev < 0 ? t('pctBelow', { pct: pct(-dev, digits).replace('+', '') }) : t('pctAbove', { pct: pct(dev, digits).replace('+', '') });
  return html`<span class="d num" style="color:${color}">${txt}</span>`;
}

function head({ kicker, title, sub, onClose, onKicker }) {
  return html`<div class="head">
    <div class="titles">
      ${kicker ? html`<div class="kicker">${onKicker ? html`<a href="#" @click=${(e) => { e.preventDefault(); onKicker(); }}>${kicker}</a>` : kicker}</div>` : nothing}
      <h2>${title}</h2>
      ${sub ? html`<div class="sub">${sub}</div>` : nothing}
    </div>
    <button class="x" @click=${onClose} title=${t('close')} aria-label=${t('close')}>${I.x()}</button>
  </div>`;
}

// The access date the license asks for (AAAA-MM-DD): the latest download in the build's meta.
function retrievedDate(meta) {
  const files = (meta && meta.source && meta.source.files) || [];
  const d = files.map((f) => (f.retrieved || '').slice(0, 10)).filter(Boolean).sort().pop();
  return d || (meta && meta.built ? meta.built.slice(0, 10) : '—');
}

function sourceLine(date) {
  return html`<div class="muted" style="margin-top:6px">PROFECO · Quién es Quién en los Precios${date ? html` · ${fdate(date)}` : nothing}</div>`;
}

// ---------------------------------------------------------------- store
export function storeCard(c) {
  const { store, storeFile, byProduct, stage, own, filter, showAll } = c;
  const idx = store.index || {};
  const series = (idx.series || []).filter((r) => r[1] != null).map((r) => [r[0], r[1]]);
  const stageVal = stage && stage.values ? stage.values.get(store.id) : null;
  const items = storeFile ? storeFile.items : null;
  let wins = [], losses = [], rows = [];
  if (items && byProduct) {
    rows = items.map(([pid, price, date]) => { const p = byProduct.get(pid); return p ? { p, price, date, dev: deviation(price, p.median) } : null; }).filter(Boolean);
    const withDev = rows.filter((r) => r.dev != null);
    wins = [...withDev].sort((a, b) => a.dev - b.dev).slice(0, 5).filter((r) => r.dev < -0.02);
    losses = [...withDev].sort((a, b) => b.dev - a.dev).slice(0, 5).filter((r) => r.dev > 0.02);
  }
  const q = fold(filter || '');
  const words = q.split(' ').filter(Boolean);
  const listed = rows.filter((r) => !words.length || words.every((w) => fold(`${r.p.name} ${r.p.brand || ''} ${r.p.presentation || ''}`).includes(w))).sort((a, b) => a.p.name.localeCompare(b.p.name, 'es'));
  const limit = showAll ? listed.length : 30;
  const ownHere = (own || []).filter((o) => o.storeId === store.id);
  const row = (r) => html`<li @click=${() => c.onOpenProduct(r.p.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenProduct(r.p.id); }}>
    <span class="sw" style="background:${r.dev == null ? 'transparent' : r.dev < 0 ? 'var(--cheaper)' : r.dev > 0 ? 'var(--dearer)' : 'var(--mid)'}"></span>
    <div class="nm"><div class="n">${r.p.name}${r.p.brand ? ` · ${r.p.brand}` : ''}</div><div class="s">${r.p.presentation || ''} · ${fdate(r.date, true)}</div></div>
    <div class="pr"><div class="p num">${money(r.price)}</div>${devChip(r.dev)}</div>
  </li>`;
  const siblings = c.siblings || [];
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${store.name}>
    ${head({ kicker: `${store.chain}${store.giro && store.giro !== store.chain ? ' · ' + store.giro : ''}`, title: store.name, sub: `${store.address || ''}${store.municipio ? ' · ' + store.municipio : ''}`, onClose: c.onClose })}
    <div class="body">
      ${store.lat == null ? html`<section><div class="note">${t('noCoords')}</div></section>` : nothing}
      ${siblings.length ? html`<section>
        <h3>${t('sameSpot')} · ${siblings.length + 1}</h3>
        <ul class="rank">${siblings.slice(0, showAll ? siblings.length : 8).map(({ store: s, val }) => html`<li @click=${() => c.onOpenStore(s.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(s.id); }}>
          <span class="sw" style="background:${val && val.dev != null ? (val.dev < 0 ? 'var(--cheaper)' : val.dev > 0 ? 'var(--dearer)' : 'var(--mid)') : 'transparent'}"></span>
          <div class="nm"><div class="n">${s.name}</div><div class="s">${s.chain}${s.giro && s.giro !== s.chain ? ' · ' + s.giro : ''} · ${t('products_n', { n: s.products })}</div></div>
          <div class="pr">${val && val.value != null ? html`<div class="p num">${stage && stage.kind === 'index' ? val.value.toFixed(2) : money(val.value)}</div>${devChip(val.dev)}` : nothing}</div>
        </li>`)}</ul>
        ${siblings.length > 8 && !showAll ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: siblings.length - 8 })}</button>` : nothing}
      </section>` : nothing}
      ${stage && stage.kind !== 'index' && stageVal ? html`<section>
        <h3>${stage.kind === 'basket' ? t('basket') : stage.kind === 'group' ? (c.byGroup && c.byGroup.get(stage.id) ? c.byGroup.get(stage.id).name : t('group')) : (stage.summary ? stage.summary.name : t('product'))}</h3>
        ${stageVal.value != null ? html`<div class="hero"><span class="big num">${money(stageVal.value)}</span>${stage.kind === 'group' && stage.unit ? html`<span class="unit">${t('perUnit', { unit: unitName(stage.unit) })}</span>` : nothing}${stageVal.hatched ? html`<span class="delta">${stageVal.missing.length === 1 ? t('missingOne') : t('missing', { n: stageVal.missing.length })}</span>` : html`<span class="delta">${devChip(stageVal.dev)}</span>`}</div>${stageVal.date ? html`<div class="muted">${fdate(stageVal.date)}</div>` : nothing}` : html`<div class="note">${stage.kind === 'basket' ? t('noData') : t('notInStore')}</div>`}
      </section>` : nothing}
      <section>
        <h3>${t('index')}</h3>
        ${idx.latest != null ? html`<div class="hero"><span class="big num">${idx.latest.toFixed(2)}</span><span class="delta">${devChip(idx.latest - 1, 1)}</span></div>` : html`<div class="note">${t('noData')}</div>`}
        <div class="muted">${t('visited', { date: fdate(store.lastSeen) })} · ${t('products_n', { n: store.products })}</div>
        ${series.length > 1 ? html`<div style="margin-top:8px">${sparkline(series.map((r) => [r[0], r[1]]), { band: false, cursor: stage && stage.kind === 'index' && stage.weekIdx != null ? series.findIndex((r) => r[0] === stage.week) : null, onPick: c.onPickWeek })}</div>
        <div class="spark-cap"><span>${t('min')} ${Math.min(...series.map((r) => r[1])).toFixed(2)}</span><span>${t('max')} ${Math.max(...series.map((r) => r[1])).toFixed(2)}</span></div>` : nothing}
        <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">${t('howIndex')}</summary><p class="note">${t('indexMethod')}</p></details>
      </section>
      ${wins.length ? html`<section><h3>${t('bestHere')}</h3><ul class="rank">${wins.map(row)}</ul></section>` : nothing}
      ${losses.length ? html`<section><h3>${t('worstHere')}</h3><ul class="rank">${losses.map(row)}</ul></section>` : nothing}
      ${ownHere.length ? html`<section><h3>${t('ownPrices')}</h3><ul class="ownlist">${ownHere.map((o) => { const p = byProduct && byProduct.get(o.productId); return html`<li><span class="p num">${money(o.price)}</span><span class="m">${p ? p.name + (p.brand ? ' · ' + p.brand : '') : o.productId} · ${fdate(o.date, true)}</span><button class="del" title=${t('ownDelete')} @click=${() => c.onDeleteOwn(o.id)}>${I.trash()}</button></li>`; })}</ul></section>` : nothing}
      <section>
        <h3>${t('storeList')}${rows.length ? html` · ${rows.length}` : nothing}</h3>
        ${items == null ? html`<div class="muted">${t('loading')}</div>` : rows.length === 0 ? html`<div class="note">${t('emptyStore')}</div>` : html`
          <div class="ownform" style="margin:0 0 8px"><input type="text" placeholder=${t('searchInStore')} .value=${filter || ''} @input=${(e) => c.onFilter(e.target.value)} style="flex:1" /></div>
          <ul class="rank">${listed.slice(0, limit).map(row)}</ul>
          ${listed.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: listed.length - limit })}</button>` : nothing}`}
        ${sourceLine(store.lastSeen)}
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- product
export function productCard(c) {
  const { summary, file, stage, byStore, byGroup, own, showAll, inBasket } = c;
  const unit = unitFor(summary.size);
  const vals = stage && stage.kind === 'product' && stage.id === summary.id ? stage.values : null;
  const ranked = [];
  if (vals) for (const [sid, v] of vals) if (v.value != null) ranked.push({ sid, s: byStore.get(sid), price: v.value, dev: v.dev, date: v.date });
  ranked.sort((a, b) => a.price - b.price);
  const med = vals ? stage.median : summary.median;
  const [lo, hi] = ranked.length ? [ranked[0].price, ranked[ranked.length - 1].price] : [summary.min, summary.max];
  const series = file ? file.series : null;
  const cursor = stage && stage.weekIdx != null && series ? series.findIndex((r) => r[0] === stage.week) : null;
  const limit = showAll ? ranked.length : 10;
  const ownHere = (own || []).filter((o) => o.productId === summary.id);
  const group = byGroup ? byGroup.get(summary.group) : null;
  const ownByStore = new Map(); for (const o of ownHere) if (!ownByStore.has(o.storeId)) ownByStore.set(o.storeId, o);
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${summary.name}>
    ${head({ kicker: group ? group.name : summary.category, onKicker: group ? () => c.onOpenGroup(group.id) : null, title: `${summary.name}${summary.brand ? ' · ' + summary.brand : ''}`, sub: `${summary.presentation || ''}${summary.size ? ' · ' + sizeLabel(summary.size) : ''}${summary.category ? ' · ' + summary.category : ''}`, onClose: c.onClose })}
    <div class="body">
      <section>
        <h3>${t('cityWide')}${stage && stage.week ? html` · ${t('week', { date: fdate(stage.week) })}` : nothing}</h3>
        <div class="hero"><span class="big num">${money(med)}</span><span class="unit">${t('cityMedian')}${unit ? html` · ${money(perUnit(med, summary.size, unit))} ${t('perUnit', { unit: unitName(unit) })}` : nothing}</span></div>
        <div class="stat3" style="margin-top:10px">
          <div><div class="l">${t('min')}</div><div class="v num">${money(lo)}</div></div>
          <div><div class="l">${t('median')}</div><div class="v num">${money(med)}</div></div>
          <div><div class="l">${t('max')}</div><div class="v num">${money(hi)}</div></div>
        </div>
        <div class="muted" style="margin-top:6px">${t('stores_n', { n: ranked.length || summary.stores })}${!summary.size ? html` · ${t('noSize')}` : nothing}</div>
        <div class="actions">
          <button class="btn ${inBasket ? 'on' : ''}" @click=${c.onToggleBasket}>${inBasket ? I.check() : I.plus()}${inBasket ? t('inBasket') : t('addToBasket')}</button>
          <button class="btn ghost" @click=${c.onCopyLink}>${I.link()}${t('copyLink')}</button>
        </div>
      </section>
      <section>
        <h3>${t('whereCheapest')} · ${t('ranking')}</h3>
        ${!vals ? html`<div class="muted">${t('loading')}</div>` : ranked.length === 0 ? html`<div class="note">${t('noData')}</div>` : html`
          <ul class="rank">${ranked.slice(0, limit).map((r, i) => html`<li class=${c.selectedStore === r.sid ? 'sel' : ''} @click=${() => c.onOpenStore(r.sid)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.sid); }}>
            <span class="sw" style="background:${r.dev < 0 ? 'var(--cheaper)' : r.dev > 0 ? 'var(--dearer)' : 'var(--mid)'}"></span>
            <div class="nm"><div class="n">${r.s ? r.s.name : r.sid}</div><div class="s">${r.s ? r.s.chain + (r.s.municipio ? ' · ' + r.s.municipio : '') : ''} · ${fdate(r.date, true)}${ownByStore.has(r.sid) ? html` · <span class="own">${t('ownMark')} ${money(ownByStore.get(r.sid).price)}</span>` : nothing}</div></div>
            <div class="pr"><div class="p num">${money(r.price)}</div>${unit ? html`<div class="u num">${money(perUnit(r.price, summary.size, unit))} / ${unitName(unit)}</div>` : nothing}${devChip(r.dev)}</div>
          </li>`)}</ul>
          ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
      </section>
      ${series && series.length > 1 ? html`<section>
        <h3>${t('history')}</h3>
        ${sparkline(series, { cursor, onPick: c.onPickWeek })}
        <div class="spark-cap"><span>${t('historyCity', { from: fdate(series[0][0], true) })}</span><span class="num">${money(minMax(series.map((r) => r[1]))[0])} – ${money(minMax(series.map((r) => r[1]))[1])}</span></div>
      </section>` : nothing}
      <section>
        <h3>${t('ownPrices')}</h3>
        <div class="note">${t('ownHint')}</div>
        <form class="ownform" @submit=${(e) => { e.preventDefault(); const f = e.target; c.onAddOwn({ price: f.price.value, storeId: f.store.value }); f.price.value = ''; }}>
          <input class="money num" name="price" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="$" required aria-label=${t('ownAdd')} />
          <select name="store" aria-label=${t('store')}>${(c.storeOptions || []).map((s) => html`<option value=${s.id} ?selected=${s.id === c.defaultStore}>${s.name} · ${s.chain}</option>`)}</select>
          <button class="btn" type="submit">${I.check()}${t('ownSave')}</button>
        </form>
        ${ownHere.length ? html`<ul class="ownlist" style="margin-top:8px">${ownHere.map((o) => { const s = byStore.get(o.storeId); const ref = vals && vals.get(o.storeId); return html`<li><span class="p num">${money(o.price)}</span><span class="m">${s ? s.name : o.storeId} · ${fdate(o.date, true)}${ref && ref.value != null ? html` · ${t('ownVs', { diff: pct(deviation(o.price, ref.value)), date: fdate(ref.date, true) })}` : nothing}</span><button class="del" title=${t('ownDelete')} @click=${() => c.onDeleteOwn(o.id)}>${I.trash()}</button></li>`; })}</ul>` : nothing}
        ${sourceLine(file && file.series && file.series.length ? file.series[file.series.length - 1][0] : null)}
        <div class="muted" style="margin-top:4px">${t('unitNote')}</div>
      </section>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- group
export function groupCard(c) {
  const { group, members, stage, byStore, byProduct, showAll } = c;
  const unit = stage && stage.kind === 'group' && stage.id === group.id ? stage.unit : null;
  const dim = stage && stage.dim ? stage.dim.dim : null;
  const sized = members.filter((p) => p.size && (!dim || p.size.unit === dim) && p.median != null).map((p) => ({ p, per: unit ? perUnit(p.median, p.size, unit) : null })).sort((a, b) => (a.per ?? Infinity) - (b.per ?? Infinity));
  const unsized = members.filter((p) => !p.size || (dim && p.size.unit !== dim)).sort((a, b) => (a.median ?? Infinity) - (b.median ?? Infinity));
  const ranked = [];
  if (stage && stage.kind === 'group' && stage.id === group.id) for (const [sid, v] of stage.values) if (v.value != null) ranked.push({ sid, s: byStore.get(sid), ...v });
  ranked.sort((a, b) => a.value - b.value);
  const limit = showAll ? ranked.length : 10;
  const pLimit = showAll ? sized.length : 12;
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${group.name}>
    ${head({ kicker: group.category, title: group.name, sub: `${t('products_n', { n: members.length })} · ${t('stores_n', { n: group.stores })}`, onClose: c.onClose })}
    <div class="body">
      ${unit && ranked.length ? html`<section>
        <h3>${t('cityWide')}${stage.week ? html` · ${t('week', { date: fdate(stage.week) })}` : nothing}</h3>
        <div class="hero"><span class="big num">${money(ranked[0].value)}</span><span class="unit">${t('perUnit', { unit: unitName(unit) })} · ${t('cheapestHere')}</span></div>
        <div class="muted">${t('cityMedian')}: ${money(stage.median)} ${t('perUnit', { unit: unitName(unit) })}</div>
      </section>` : nothing}
      <section>
        <h3>${t('sizes')}</h3>
        ${!unit ? html`<div class="note">${t('noSize')}</div>` : nothing}
        <ul class="rank">
          ${sized.slice(0, pLimit).map(({ p, per }) => html`<li @click=${() => c.onOpenProduct(p.id)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenProduct(p.id); }}>
            <span class="sw" style="background:${per != null && stage && stage.median ? (per < stage.median ? 'var(--cheaper)' : per > stage.median ? 'var(--dearer)' : 'var(--mid)') : 'transparent'}"></span>
            <div class="nm"><div class="n">${p.brand || p.name}</div><div class="s">${p.presentation || ''} · ${sizeLabel(p.size)} · ${t('stores_n', { n: p.stores })}</div></div>
            <div class="pr">${per != null ? html`<div class="p num">${money(per)}</div><div class="u">/ ${unitName(unit)}</div>` : nothing}<div class="u num">${money(p.median)} ${t('label')}</div></div>
          </li>`)}
          ${unsized.slice(0, showAll ? unsized.length : 4).map((p) => html`<li @click=${() => c.onOpenProduct(p.id)} tabindex="0"><span class="sw" style="background:transparent"></span><div class="nm"><div class="n">${p.brand || p.name}</div><div class="s">${p.presentation || ''} · ${t('noSize')}</div></div><div class="pr"><div class="p num">${money(p.median)}</div><div class="u">${t('label')}</div></div></li>`)}
        </ul>
        ${sized.length > pLimit || unsized.length > 4 ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: Math.max(0, sized.length - pLimit) + Math.max(0, unsized.length - 4) })}</button>` : nothing}
      </section>
      ${unit ? html`<section>
        <h3>${t('whereCheapest')} · ${t('ranking')}</h3>
        ${ranked.length === 0 ? html`<div class="muted">${t('loading')}</div>` : html`<ul class="rank">${ranked.slice(0, limit).map((r) => { const p = byProduct.get(r.pid); return html`<li class=${c.selectedStore === r.sid ? 'sel' : ''} @click=${() => c.onOpenStore(r.sid)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.sid); }}>
          <span class="sw" style="background:${r.dev < 0 ? 'var(--cheaper)' : r.dev > 0 ? 'var(--dearer)' : 'var(--mid)'}"></span>
          <div class="nm"><div class="n">${r.s ? r.s.name : r.sid}</div><div class="s">${p ? `${p.brand || p.name} ${p.presentation || ''} · ${money(r.price)}` : ''} · ${fdate(r.date, true)}</div></div>
          <div class="pr"><div class="p num">${money(r.value)}</div><div class="u">/ ${unitName(unit)}</div>${devChip(r.dev)}</div>
        </li>`; })}</ul>
        ${ranked.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: ranked.length - limit })}</button>` : nothing}`}
        ${sourceLine(null)}
      </section>` : nothing}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- basket
export function basketCard(c) {
  const { items, byProduct, byStore, stage, onlyComplete, showAll } = c;
  const ranking = stage && stage.kind === 'basket' ? stage.ranking : null;
  const list = ranking ? (onlyComplete ? ranking.list.filter((r) => r.complete) : ranking.list) : [];
  const limit = showAll ? list.length : 12;
  const best = ranking && ranking.list.find((r) => r.complete);
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''}" role="dialog" aria-label=${t('basket')}>
    ${head({ kicker: t('basket'), title: t('products_n', { n: items.length }), sub: ranking && ranking.completeCount ? `${t('stores_n', { n: ranking.completeCount })} · ${t('complete')}` : '', onClose: c.onClose })}
    <div class="body">
      ${items.length === 0 ? html`<section><div class="note">${t('basketEmpty')}</div></section>
      ${c.pacicGroups && c.pacicGroups.length ? html`<section><h3>${t('canasta')} · PACIC</h3><div class="note" style="margin-bottom:8px">${t('pacicHint')}</div><div class="chips">${c.pacicGroups.map((g) => html`<button class="chip" @click=${() => c.onOpenGroup(g.id)}>${g.name}</button>`)}</div></section>` : nothing}` : html`
      <section>
        <ul class="bitems">${items.map((it) => { const p = byProduct.get(it.id); return html`<li>
          <div><div class="n" style="cursor:pointer" @click=${() => c.onOpenProduct(it.id)}>${p ? p.name + (p.brand ? ' · ' + p.brand : '') : it.id}</div><div class="s">${p ? (p.presentation || '') : ''}${p && p.median != null ? ` · ${money(p.median)}` : ''}</div></div>
          <div class="qty"><button @click=${() => c.onQty(it.id, it.qty - 1)} aria-label="−">−</button><span class="num">${it.qty}</span><button @click=${() => c.onQty(it.id, it.qty + 1)} aria-label="+">+</button></div>
          <button class="rm" @click=${() => c.onQty(it.id, 0)} title=${t('removeFromBasket')} aria-label=${t('removeFromBasket')}>${I.x()}</button>
        </li>`; })}</ul>
        <div class="actions"><button class="btn ghost" @click=${c.onCopyLink}>${I.link()}${t('copyLink')}</button><button class="btn ghost" @click=${c.onClear}>${I.trash()}${t('clear')}</button></div>
      </section>
      <section>
        <h3>${t('rankingBasket')}${stage && stage.week ? html` · ${t('week', { date: fdate(stage.week) })}` : nothing}</h3>
        ${best ? html`<div class="hero"><span class="big num">${money(best.total)}</span><span class="unit">${best.storeId && byStore.get(best.storeId) ? byStore.get(best.storeId).name : ''}</span></div>
          ${ranking.dearest != null && ranking.dearest > best.total ? html`<div class="muted">${t('savings', { amount: money(ranking.dearest - best.total) })}</div>` : nothing}` : nothing}
        <div class="chips" style="margin:8px 0"><button class="chip ${!onlyComplete ? 'on' : ''}" @click=${() => c.onOnlyComplete(false)}>${t('allStores')}</button><button class="chip ${onlyComplete ? 'on' : ''}" @click=${() => c.onOnlyComplete(true)}>${t('onlyComplete')}</button></div>
        ${!ranking ? html`<div class="muted">${t('loading')}</div>` : list.length === 0 ? html`<div class="note">${t('noData')}</div>` : html`<ul class="rank">${list.slice(0, limit).map((r) => { const s = byStore.get(r.storeId); return html`<li class=${c.selectedStore === r.storeId ? 'sel' : ''} @click=${() => c.onOpenStore(r.storeId)} tabindex="0" @keydown=${(e) => { if (e.key === 'Enter') c.onOpenStore(r.storeId); }}>
          <span class="sw ${r.complete ? '' : 'empty'}" style="background:${r.complete ? (r.dev < 0 ? 'var(--cheaper)' : r.dev > 0 ? 'var(--dearer)' : 'var(--mid)') : 'transparent'}"></span>
          <div class="nm"><div class="n">${s ? s.name : r.storeId}</div><div class="s">${s ? s.chain + (s.municipio ? ' · ' + s.municipio : '') : ''}${r.date ? ` · ${fdate(r.date, true)}` : ''}</div></div>
          <div class="pr"><div class="p num">${money(r.total)}</div>${r.complete ? devChip(r.dev) : html`<div class="miss">${r.missing.length === 1 ? t('missingOne') : t('missing', { n: r.missing.length })}</div>`}</div>
        </li>`; })}</ul>
        ${list.length > limit ? html`<button class="more" @click=${c.onShowAll}>${t('showMore', { n: list.length - limit })}</button>` : nothing}`}
        ${sourceLine(null)}
      </section>`}
    </div>
  </div>`;
}

// ---------------------------------------------------------------- settings
export function settingsCard(c) {
  const { prefs, own, byProduct, byStore, meta, canInstall } = c;
  const lang = getLang();
  return html`<div class="card ${c.side} ${c.entering ? 'enter' : ''} settings" role="dialog" aria-label=${t('settings')}>
    ${head({ kicker: t('appName'), title: t('settings'), sub: t('tagline'), onClose: c.onClose })}
    <div class="body">
      <section>
        <div class="row"><div><div class="l">${t('language')}</div></div><div class="seg"><button class=${lang === 'es' ? 'on' : ''} @click=${() => c.onPref('lang', 'es')}>Español</button><button class=${lang === 'en' ? 'on' : ''} @click=${() => c.onPref('lang', 'en')}>English</button></div></div>
        <div class="row"><div><div class="l">${t('motion')}</div></div><div class="seg"><button class=${prefs.motion ? 'on' : ''} @click=${() => c.onPref('motion', true)}>${t('motionOn')}</button><button class=${!prefs.motion ? 'on' : ''} @click=${() => c.onPref('motion', false)}>${t('motionOff')}</button></div></div>
        <div class="row"><div><div class="l">${t('labels')}</div></div><div class="seg"><button class=${prefs.labels ? 'on' : ''} @click=${() => c.onPref('labels', true)}>${t('motionOn')}</button><button class=${!prefs.labels ? 'on' : ''} @click=${() => c.onPref('labels', false)}>${t('motionOff')}</button></div></div>
        ${canInstall ? html`<div class="row"><div><div class="l">${t('install')}</div></div><button class="btn ghost" @click=${c.onInstall}>${I.download()}${t('install')}</button></div>` : nothing}
      </section>
      <section>
        <h3>${t('ownPrices')} · ${own.length}</h3>
        <p>${t('ownHint')}</p>
        ${own.length === 0 ? html`<p class="muted">${t('ownNone')}</p>` : html`<ul class="ownlist">${own.slice(0, 50).map((o) => { const p = byProduct && byProduct.get(o.productId); const s = byStore && byStore.get(o.storeId); return html`<li><span class="p num">${money(o.price)}</span><span class="m">${p ? p.name + (p.brand ? ' · ' + p.brand : '') : o.productId} · ${s ? s.name : o.storeId} · ${fdate(o.date, true)}</span><button class="del" title=${t('ownDelete')} @click=${() => c.onDeleteOwn(o.id)}>${I.trash()}</button></li>`; })}</ul>`}
        <div class="actions">
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('json')}>${I.download()}${t('ownExportJson')}</button>
          <button class="btn ghost" ?disabled=${!own.length} @click=${() => c.onExport('csv')}>${I.download()}${t('ownExportCsv')}</button>
          <label class="btn ghost">${I.upload()}${t('ownImport')}<input type="file" accept="application/json" class="sr" @change=${(e) => c.onImport(e.target.files[0])} /></label>
        </div>
      </section>
      <section>
        <h3>${t('about')}</h3>
        <p>${t('aboutText')}</p>
        <h3 style="margin-top:12px">${t('sources')}</h3>
        <p>${t('sourcePrices', { date: fdate(meta ? meta.latestDate : null), retrieved: retrievedDate(meta) })} <a href="https://datos.profeco.gob.mx/datos_abiertos/qqp.php" target="_blank" rel="noopener">datos.profeco.gob.mx</a></p>
        <p>${t('sourceMap')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a></p>
        <p><a href="https://github.com/vdm285/compa-precio" target="_blank" rel="noopener">${t('code')}</a>${meta && meta.built ? html` · build ${fdate(meta.built.slice(0, 10))}` : nothing}</p>
        <p class="kbd">${t('kbdHint')} · ${t('zoomHint')}</p>
      </section>
    </div>
  </div>`;
}
