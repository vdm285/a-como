// Floating controls around the stage: basket and settings buttons, the legend, the timeline, the
// week numeral, the hover tooltip and the toast. Each is a function returning a lit template.
import { html, svg, nothing } from 'lit';
import { t, pct, money, fdate, fspan, unitName, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { divergingGradient } from '../logic/color.js';
import { median } from '../logic/stats.js';

const DEFAULT_GIRO = /supermercado|autoservicio/i;
export const giroLabel = (s) => (s && s.giro && !DEFAULT_GIRO.test(s.giro) && s.giro !== s.chain ? s.giro : '');

export function topRight({ basketCount, basketOn, onBasket }) {
  return html`<div class="float topright">
    <button class="pill ${basketOn ? 'on' : ''}" @click=${onBasket} title=${t('basket')} aria-expanded=${basketOn ? 'true' : 'false'} aria-label=${`${t('basket')}${basketCount ? ` (${basketCount})` : ''}`}>${I.basket()}<span>${t('basket')}</span>${basketCount ? html`<span class="count">${basketCount}</span>` : nothing}</button>
  </div>`;
}

export function bottomRight({ settingsOn, onSettings, onReset, moved }) {
  return html`<div class="float bottomright">
    ${moved ? html`<button class="pill icon-btn reset" @click=${onReset} title=${t('reset')} aria-label=${t('reset')}>${I.center()}</button>` : nothing}
    <button class="pill icon-btn settings-btn ${settingsOn ? 'on' : ''}" @click=${onSettings} title=${t('settings')} aria-label=${t('settings')} aria-expanded=${settingsOn ? 'true' : 'false'}>${I.cog()}</button>
  </div>`;
}

// the reference line of the legend, in each mode's own words
export function refText(stage) {
  if (!stage || stage.kind === 'index') return '';
  if (stage.ref == null) return '';
  if (stage.tooFew) return t('refTooFew', { n: stage.refN });
  const unit = stage.kind === 'group' && stage.unit ? ` / ${unitName(stage.unit)}` : '';
  if (stage.refKind === 'week') return t('refWeekOnly', { ref: money(stage.ref) + unit });
  if (stage.kind === 'group') return t('refGroup', { ref: money(stage.ref) + unit, n: stage.refN });
  if (stage.kind === 'basket') return t('refBasket', { ref: money(stage.ref), n: stage.refN });
  return t('refProduct', { ref: money(stage.ref), n: stage.refN });
}
export function vsText(stage, dev) {
  const p = pct(dev, 0);
  if (stage.refKind === 'week') return t('vsRefWeek', { pct: p });
  if (stage.kind === 'group') return t('vsRefGroup', { pct: p });
  if (stage.kind === 'basket') return t('vsRefBasket', { pct: p });
  return t('vsRef', { pct: p });
}
// an index as the shopper says it: "3 % más cara"
export function storeIndexWords(value) {
  const d = value - 1;
  if (Math.abs(d) < 0.005) return t('storeAtMedian');
  const p = pct(Math.abs(d), 0).replace('+', '');
  return d > 0 ? t('storeDearer', { pct: p }) : t('storeCheaper', { pct: p });
}

// Spanish puts a space before the percent sign, English does not
const pctSign = () => (getLang() === 'en' ? '%' : ' %');

export function legend({ stage, title, hasOwn, onResetStage, onTitle }) {
  if (!stage) return nothing;
  const cap = Math.round((stage.cap || 0.2) * 100);
  const ref = refText(stage);
  const index = stage.kind === 'index';
  const when = index
    ? (stage.weekIdx == null ? (stage.weekSpan ? t('indexSpan', { span: fspan(stage.weekSpan[0], stage.weekSpan[1]) }) : '') : t('week', { date: fdate(stage.week) }))
    : '';
  const emptyRows = index
    ? (stage.weekIdx == null ? [t('emptyIndexFew'), t('emptyIndexStale')] : [t('emptyIndexWeek')])
    : stage.kind === 'basket' ? [stage.weekIdx == null ? t('emptyBasketRecent') : t('noVisitWeek')]
    : [stage.weekIdx == null ? t('emptyPriceRecent') : t('noVisitWeek')];
  return html`<div class="legend" role="group" aria-label=${title}>
    <div class="lt">
      ${onTitle ? html`<button class="ltitle" @click=${onTitle} title=${t('openCard')}>${title}</button>` : html`<span class="ltitle">${title}</span>`}
      ${!index ? html`<button class="lx" title=${t('backToIndex')} aria-label=${t('backToIndex')} @click=${onResetStage}>${I.x()}</button>` : nothing}
    </div>
    ${stage.tooFew ? nothing : html`<div class="bar" style="background:${divergingGradient()}"></div>
    <div class="ticks"><span>−${cap}${pctSign()} ${t('orMore')}</span><span>${t('median')}</span><span>+${cap}${pctSign()} ${t('orMore')}</span></div>
    <div class="ticks words"><span>${index ? t('storeCheaperWord') : t('cheaper')}</span><span></span><span>${index ? t('storeDearerWord') : t('dearer')}</span></div>`}
    ${ref ? html`<div class="ref">${ref}</div>` : nothing}
    ${index ? html`<div class="ref">${t('indexWhat')}</div>` : nothing}
    ${emptyRows.map((r) => html`<div class="row"><span class="sw empty"></span><span>${r}</span></div>`)}
    ${stage.kind === 'basket' ? html`<div class="row"><span class="sw hatch"></span><span>${t('missingLegend')}</span></div>` : nothing}
    ${hasOwn ? html`<div class="row"><span class="sw own"></span><span>${t('ownMark')}</span></div>` : nothing}
    ${stage.failed ? html`<div class="row warn">${t('partLoaded', { n: stage.failed, m: stage.total })}</div>` : nothing}
    ${when ? html`<div class="when">${when}</div>` : nothing}
  </div>`;
}

// The licence (Libre Uso MX) asks for the access date in numeric form, AAAA-MM-DD.
export function credit({ retrieved }) {
  return html`<div class="credit">${t('creditShort', { date: retrieved })} · INEGI · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>`;
}

// ---------------------------------------------------------------- the week numeral
// While a week is on stage, its city median in large type over the map: the magnitude reads even
// when the colours saturate.
export function weekNumeral(stage) {
  if (!stage || stage.weekIdx == null || stage.kind === 'index') return nothing;
  let value = null, what = '';
  if (stage.kind === 'product') { value = median([...stage.values.values()].filter((v) => v.value != null).map((v) => v.value)); what = t('cityMedian'); }
  else if (stage.kind === 'group') { value = stage.weekRef; what = t('groupMedianWhat'); }
  else if (stage.kind === 'basket') { value = stage.ranking ? stage.ranking.base : null; what = t('basketMedianWhat'); }
  if (value == null) return nothing;
  const unit = stage.kind === 'group' && stage.unit ? ` / ${unitName(stage.unit, true)}` : '';
  return html`<div class="float numeral" aria-hidden="true">
    <div class="nbig num">${money(value)}<small>${unit}</small></div>
    <div class="nsub">${what} · ${t('weekOf', { date: fdate(stage.week) })}${stage.partial.has(stage.week) ? ` · ${t('partialWeek')}` : ''}</div>
    ${stage.ref != null && stage.refKind !== 'week' ? html`<div class="nref">${t('recentWord')}: ${money(stage.ref)}${unit}</div>` : nothing}
  </div>`;
}

// ---------------------------------------------------------------- timeline
// The weeks as a strip drawn in real pixels (no stretched viewBox): the curve over every week the
// data has (for a product, 88), the weeks that can be picked shaded, light weeks hatched, the
// recent reference as a dashed line, the peak annotated, and a knob. "Reciente" is a real button.
function monthLabel(iso, withYear) {
  const m = fdate(iso, 'month');
  if (!withYear) return m;
  return getLang() === 'en' ? `${m} '${iso.slice(2, 4)}` : `${m} ${iso.slice(0, 4)}`;
}

export function timeline({ stage, width, compact, playing, collapsed, onWeek, onLive, onPlay, onStep, onExpand }) {
  if (!stage || !stage.weeks || stage.weeks.length < 2) return nothing;
  if (collapsed) {
    return html`<div class="float timeline collapsed"><button class="tl-chip" @click=${onExpand} aria-label=${t('timelineCollapsed')}>${I.clock()}<span>${stage.weekIdx == null && stage.weekSpan ? t('indexSpan', { span: fspan(stage.weekSpan[0], stage.weekSpan[1]) }) : stage.week ? t('week', { date: fdate(stage.week) }) : ''}</span>${I.chevronR()}</button></div>`;
  }
  const sel = stage.weeks;                       // weeks that can be picked
  const axis = stage.axisWeeks && stage.axisWeeks.length >= sel.length ? stage.axisWeeks : sel;
  const n = axis.length;
  const selStart = axis.indexOf(sel[0]);
  const live = stage.weekIdx == null;
  const W = Math.max(160, Math.round(width || 600)), H = compact ? 50 : 88;
  const padL = 6, padR = 6, top = compact ? 6 : 14, bot = compact ? 14 : 18;
  const x0 = padL, x1 = W - padR;
  const xAt = (i) => x0 + (n > 1 ? (i * (x1 - x0)) / (n - 1) : 0);
  const yTop = top, yBot = H - bot;
  const curIdx = live ? null : axis.indexOf(stage.week);

  let curve = nothing, notes = nothing;
  if (stage.curve && stage.curve.rows) {
    const byWeek = new Map(stage.curve.rows.map((r) => [r[0], r]));
    if (stage.curve.kind === 'visits') {
      const vals = axis.map((w) => (byWeek.get(w) || [w, 0])[1] || 0);
      const max = Math.max(1, ...vals);
      const bw = Math.max(1.5, ((x1 - x0) / n) * 0.6);
      curve = svg`${vals.map((v, i) => svg`<rect class="tl-bar ${stage.partial.has(axis[i]) ? 'partial' : ''}" x=${xAt(i) - bw / 2} y=${yBot - ((yBot - yTop) * v) / max} width=${bw} height=${((yBot - yTop) * v) / max}></rect>`)}`;
    } else {
      const rows = axis.map((w) => byWeek.get(w) || null);
      const vals = rows.flatMap((r) => (r ? [r[1], r[2], r[3]] : [])).filter((v) => v != null && Number.isFinite(v));
      if (stage.ref != null) vals.push(stage.ref);
      if (vals.length > 1) {
        let lo = Math.min(...vals), hi = Math.max(...vals);
        if (hi === lo) { hi += 1; lo -= 1; }
        const y = (v) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
        const pts = rows.map((r, i) => (r && r[1] != null ? [i, r] : null)).filter(Boolean);
        const path = (list, k) => list.map(([i, r], j) => `${j ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(r[k] ?? r[1]).toFixed(1)}`).join('');
        const line = path(pts, 1);
        const band = pts.length > 1 ? `${path(pts, 3)}${[...pts].reverse().map(([i, r]) => `L${xAt(i).toFixed(1)},${y(r[2] ?? r[1]).toFixed(1)}`).join('')}Z` : '';
        const refY = stage.ref != null ? y(stage.ref) : null;
        curve = svg`<path class="tl-band" d=${band}></path><path class="tl-line" d=${line}></path>${refY != null ? svg`<line class="tl-ref" x1=${x0} x2=${x1} y1=${refY} y2=${refY}></line>` : nothing}`;
        // annotate the peak and the recent reference, where there is room
        if (!compact && pts.length > 3) {
          const peak = pts.reduce((a, b) => (b[1][1] > a[1][1] ? b : a));
          const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
          const px = xAt(peak[0]), py = y(peak[1][1]);
          const cx = curIdx != null && curIdx >= 0 ? xAt(curIdx) : null;
          const nearCursor = cx != null && Math.abs(cx - px) < 70;
          const anchor = nearCursor ? (px > W / 2 ? 'end' : 'start') : px > W - 120 ? 'end' : px < 80 ? 'start' : 'middle';
          const tx = nearCursor ? (anchor === 'end' ? Math.min(px, cx) - 7 : Math.max(px, cx) + 7) : px;
          notes = svg`<circle class="tl-peak" cx=${px} cy=${py} r="2.5"></circle><text class="tl-note" x=${tx} y=${Math.max(9, py - 5)} text-anchor=${anchor}>${t('peak')} ${money(peak[1][1])}${unit} · ${fdate(peak[1][0], true)}</text>
            ${refY != null && Math.abs(refY - py) > 12 ? svg`<text class="tl-note ref" x=${x1} y=${refY - 4} text-anchor="end">${t('recentWord')} ${money(stage.ref)}${unit}</text>` : nothing}`;
        }
      }
    }
  }
  // month labels thinned by their real width; a year shown where it changes
  const months = [];
  let lastM = '', lastY = '', lastRight = -Infinity;
  axis.forEach((w, i) => {
    const m = w.slice(0, 7); if (m === lastM) return; lastM = m;
    const y = w.slice(0, 4); const withYear = y !== lastY;
    const label = monthLabel(w, withYear); const x = xAt(i); const wpx = label.length * 5.8 + 4;
    if (x - wpx / 2 < lastRight + 6 && !withYear) return;
    if (x - wpx / 2 < lastRight + 6 && withYear && months.length) months.pop();
    months.push({ x, label, w: wpx }); lastRight = x + wpx / 2; lastY = y;
  });
  const pickIdx = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - x0) / (x1 - x0)) * (n - 1))));
    onWeek(axis[Math.max(selStart, i)]);
  };
  const label = live
    ? (stage.kind === 'index' && stage.weekSpan ? t('indexSpan', { span: fspan(stage.weekSpan[0], stage.weekSpan[1]) }) : t('recentSpan', { span: fspan(stage.win.from, stage.win.to) }))
    : `${t('week', { date: fdate(stage.week) })}${stage.partial.has(stage.week) ? ` · ${t('partialWeek')}` : ''}`;
  const caption = !stage.curve ? '' : stage.curve.kind === 'visits' ? t('tlVisits') : stage.curve.kind === 'basket' ? t('tlBasket') : stage.curve.kind === 'group' ? t('tlGroupMedian') : t('tlPrice');
  const atStart = !live && stage.weekIdx === 0;
  return html`<div class="float timeline ${compact ? 'compact' : ''}">
    <button class="play" @click=${onPlay} title=${playing ? t('pause') : t('play')} aria-label=${playing ? t('pause') : t('play')}>${playing ? I.pause() : I.play()}</button>
    <div class="tl-main">
      <div class="tl-head">
        <button class="step" @click=${() => onStep(-1)} ?disabled=${atStart} aria-label=${t('prevWeek')} title=${t('prevWeek')}>${I.chevronL()}</button>
        <span class="tl-label">${label}</span>
        <button class="step" @click=${() => onStep(1)} ?disabled=${live} aria-label=${t('nextWeek')} title=${t('nextWeek')}>${I.chevronR()}</button>
        ${caption ? html`<span class="tl-cap">${caption}</span>` : nothing}
      </div>
      <div class="tl-row">
        <svg class="tl-svg" width=${W} height=${H} viewBox="0 0 ${W} ${H}" role="slider" tabindex="0"
          aria-label=${t('timeline')} aria-valuemin="0" aria-valuemax=${sel.length} aria-valuenow=${live ? sel.length : stage.weekIdx} aria-valuetext=${label}
          @pointerdown=${(e) => { e.currentTarget.setPointerCapture(e.pointerId); pickIdx(e); }}
          @pointermove=${(e) => { if (e.buttons) pickIdx(e); }}
          @keydown=${(e) => {
            const k = e.key;
            if (k === 'ArrowLeft' || k === 'ArrowDown') { e.preventDefault(); onStep(-1); }
            else if (k === 'ArrowRight' || k === 'ArrowUp') { e.preventDefault(); onStep(1); }
            else if (k === 'PageDown') { e.preventDefault(); onStep(-4); }
            else if (k === 'PageUp') { e.preventDefault(); onStep(4); }
            else if (k === 'Home') { e.preventDefault(); onWeek(sel[0]); }
            else if (k === 'End') { e.preventDefault(); onLive(); }
          }}>
          ${selStart > 0 ? svg`<rect class="tl-unsel" x="0" y=${yTop - 4} width=${xAt(selStart) - 4} height=${yBot - yTop + 4}></rect>` : nothing}
          ${curve}
          ${notes}
          <line class="tl-axis" x1=${x0} x2=${x1} y1=${yBot} y2=${yBot}></line>
          ${sel.map((w) => { const i = axis.indexOf(w); return svg`<line class="tl-tick" x1=${xAt(i)} x2=${xAt(i)} y1=${yBot} y2=${yBot + 3}></line>`; })}
          ${months.map((m) => { const a = m.x - m.w / 2 < 0 ? 'start' : m.x + m.w / 2 > W ? 'end' : 'middle'; return svg`<text class="tl-month" x=${a === 'start' ? 0 : a === 'end' ? W : m.x} y=${H - 3} text-anchor=${a}>${m.label}</text>`; })}
          ${curIdx != null && curIdx >= 0 ? svg`<line class="tl-cursor" x1=${xAt(curIdx)} x2=${xAt(curIdx)} y1=${yTop - 4} y2=${yBot + 2}></line><circle class="tl-knob" cx=${xAt(curIdx)} cy=${yBot} r="5"></circle>` : nothing}
        </svg>
        <button class="tl-live ${live ? 'on' : ''}" @click=${onLive} aria-pressed=${live ? 'true' : 'false'}>${t('recentShort')}</button>
      </div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- tooltip
export function tooltipText(loc, val, stage, byStore, byProduct) {
  if (!loc || !byStore) return '';
  const s = byStore.get((val && val.sid) || loc.stores[0]);
  const name = loc.stores.length > 1 ? t('nHere', { n: loc.stores.length }) : s ? s.name : '';
  if (!val || val.value == null) return `${name}. ${reasonText(val)}`;
  if (stage.kind === 'index') return `${name}. ${storeIndexWords(val.value)}`;
  return `${name}. ${money(val.value)}`;
}
function reasonText(v) {
  if (!v || !v.reason) return t('reasonNone');
  return { none: t('reasonNone'), stale: v.lastDate ? t('reasonStaleDate', { date: fdate(v.lastDate) }) : t('reasonStale'), few: t('reasonFew'), novisit: t('noVisitWeek'), missing: t('missingLegend'), otherUnit: t('reasonOtherUnit') }[v.reason] || '';
}

export function tooltip({ loc, val, stage, byStore, byProduct, x, y, free, own }) {
  if (!loc || !byStore || !stage) return nothing;
  const shared = loc.stores.length > 1;
  const s = byStore.get((val && val.sid) || loc.stores[0]);
  if (!s) return nothing;
  const v = val;
  let line = nothing;
  const dateLine = (d) => (d ? html`<div class="m">${fdate(d)}</div>` : nothing);
  if (v && v.value != null) {
    if (stage.kind === 'index') line = html`<div><b>${storeIndexWords(v.value)}</b> <span class="s">${shared && v.n > 1 ? t('medianOfN', { n: v.n }) : t('indexShort')}</span></div>${v.week ? html`<div class="m">${t('week', { date: fdate(v.week) })}</div>` : nothing}`;
    else if (stage.kind === 'product') line = html`<div><b class="num">${money(v.value)}</b> ${v.dev != null ? html`<span class="s">${vsText(stage, v.dev)}</span>` : nothing}</div>${dateLine(v.date)}`;
    else if (stage.kind === 'group') { const p = v.pid && byProduct ? byProduct.get(v.pid) : null; line = html`<div><b class="num">${money(v.value)}</b> <span class="s">/ ${unitName(stage.unit)}${v.dev != null ? ` · ${vsText(stage, v.dev)}` : ''}</span></div>${p ? html`<div class="m">${p.brand || p.name} · ${p.presentation || ''} · ${money(v.price)}</div>` : nothing}${dateLine(v.date)}`; }
    else if (stage.kind === 'basket') line = v.hatched ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${v.missing.length === 1 ? t('missingOne') : t('missing', { n: v.missing.length })}</span></div>` : html`<div><b class="num">${money(v.value)}</b> ${v.dev != null ? html`<span class="s">${vsText(stage, v.dev)}</span>` : nothing}</div>${v.dateMin && v.date ? html`<div class="m">${fspan(v.dateMin, v.date)}</div>` : nothing}`;
  } else line = html`<div class="m">${reasonText(v)}</div>`;
  const ownLine = own ? html`<div class="m own">${t('ownMark')}: ${money(own.price)} · ${fdate(own.date)}</div>` : nothing;
  // keep the tooltip inside the free area (never under a card)
  const left = Math.max((free ? free.left : 0) + 150, Math.min((free ? free.right : window.innerWidth) - 150, x));
  const flip = y < 130;
  return html`<div class="tip" style="left:${left}px;top:${y}px;${flip ? 'transform:translate(-50%,16px)' : ''}">
    <div class="n">${shared ? t('nHere', { n: loc.stores.length }) : s.name}</div>
    <div class="s">${shared ? (stage.kind === 'index' ? '' : `${t('cheapestOfThem')}: ${s.name}`) : `${s.chain}${giroLabel(s) ? ' · ' + giroLabel(s) : ''}${s.municipio ? ' · ' + s.municipio : ''}`}</div>
    ${line}
    ${ownLine}
  </div>`;
}

export function toast({ text, action, onAction }) {
  return html`<div class="toast ${text ? 'on' : ''}" role="status">${text || ''}${text && action ? html` <button class="toast-btn" @click=${onAction}>${action}</button>` : nothing}</div>`;
}
