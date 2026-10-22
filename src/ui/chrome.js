// Floating controls around the stage: basket and settings buttons, the legend, the timeline,
// the hover tooltip and the toast. Each is a function returning a lit template.
import { html, svg, nothing } from 'lit';
import { t, pct, money, fdate, fspan, unitName } from '../app/i18n.js';
import { I } from './icons.js';
import { divergingGradient } from '../logic/color.js';

const DEFAULT_GIRO = /supermercado|autoservicio/i;
export const giroLabel = (s) => (s && s.giro && !DEFAULT_GIRO.test(s.giro) && s.giro !== s.chain ? s.giro : '');

export function topRight({ basketCount, basketOn, onBasket }) {
  return html`<div class="float topright">
    <button class="pill ${basketOn ? 'on' : ''}" @click=${onBasket} title=${t('basket')} aria-label=${`${t('basket')}${basketCount ? ` (${basketCount})` : ''}`}>${I.basket()}<span>${t('basket')}</span>${basketCount ? html`<span class="count">${basketCount}</span>` : nothing}</button>
  </div>`;
}

export function bottomRight({ settingsOn, onSettings, onReset, moved }) {
  return html`<div class="float bottomright">
    ${moved ? html`<button class="pill icon-btn" @click=${onReset} title=${t('reset')} aria-label=${t('reset')}>${I.center()}</button>` : nothing}
    <button class="pill icon-btn ${settingsOn ? 'on' : ''}" @click=${onSettings} title=${t('settings')} aria-label=${t('settings')}>${I.cog()}</button>
  </div>`;
}

// what a hollow dot means, per mode
function emptyMeaning(stage) {
  if (stage.kind === 'index') return stage.weekIdx == null ? t('emptyIndexRecent') : t('emptyIndexWeek');
  if (stage.kind === 'basket') return stage.weekIdx == null ? t('emptyBasketRecent') : t('noVisitWeek');
  return stage.weekIdx == null ? t('emptyPriceRecent') : t('noVisitWeek');
}

export function legend({ stage, title, hasOwn, onResetStage, onTitle }) {
  if (!stage) return nothing;
  const cap = Math.round((stage.cap || 0.2) * 100);
  const refLine = stage.kind === 'index'
    ? t('indexRef')
    : stage.ref != null ? t('refLine', { ref: `${money(stage.ref)}${stage.kind === 'group' && stage.unit ? ` / ${unitName(stage.unit)}` : ''}` }) : '';
  const when = stage.weekIdx == null
    ? t('recentSpan', { span: fspan(stage.win.from, stage.win.to) })
    : `${t('week', { date: fdate(stage.week) })}${stage.partial && stage.partial.has(stage.week) ? ` · ${t('partialWeek')}` : ''}`;
  return html`<div class="legend" role="group" aria-label=${title}>
    <div class="lt">
      ${onTitle ? html`<button class="ltitle" @click=${onTitle} title=${t('openCard')}>${title}</button>` : html`<span class="ltitle">${title}</span>`}
      ${stage.kind !== 'index' ? html`<button class="lx" title=${t('backToIndex')} aria-label=${t('backToIndex')} @click=${onResetStage}>${I.x()}</button>` : nothing}
    </div>
    <div class="bar" style="background:${divergingGradient()}"></div>
    <div class="ticks"><span>−${cap} % ${t('orMore')}</span><span>${t('median')}</span><span>+${cap} % ${t('orMore')}</span></div>
    <div class="ticks words"><span>${t('cheaper')}</span><span></span><span>${t('dearer')}</span></div>
    ${refLine ? html`<div class="ref">${refLine}</div>` : nothing}
    <div class="row"><span class="sw empty"></span><span>${emptyMeaning(stage)}</span></div>
    ${stage.kind === 'basket' ? html`<div class="row"><span class="sw hatch"></span><span>${t('missingLegend')}</span></div>` : nothing}
    ${hasOwn ? html`<div class="row"><span class="sw own"></span><span>${t('ownMark')}</span></div>` : nothing}
    <div class="when">${when}</div>
  </div>`;
}

export function credit({ retrieved }) {
  return html`<div class="credit">${t('creditShort', { date: retrieved })} · INEGI · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>`;
}

// ---------------------------------------------------------------- timeline
// The weeks on stage as a strip: the curve (price median with its min–max band, the basket
// total, or the survey's rhythm on the index), a tick per week, partial weeks hatched, a
// "Reciente" stop at the right end, and a handle. Drag, click, arrows, Home/End, Space.
const TL = { w: 600, h: 58, padL: 6, padR: 54, top: 6, bottom: 16 };
function monthAbbr(iso) { return fdate(iso, 'month'); }

export function timeline({ stage, playing, busy, onWeek, onLive, onPlay, onStep }) {
  if (!stage || !stage.weeks || stage.weeks.length < 2) return nothing;
  const weeks = stage.weeks;
  const n = weeks.length;
  const live = stage.weekIdx == null;
  const x0 = TL.padL, x1 = TL.w - TL.padR;
  const xAt = (i) => x0 + (i * (x1 - x0)) / (n - 1);
  const liveX = TL.w - TL.padR / 2;
  const curX = live ? liveX : xAt(stage.weekIdx);
  const yTop = TL.top, yBot = TL.h - TL.bottom;

  // curve rows aligned to the weeks on stage
  let curve = nothing;
  if (stage.curve && stage.curve.rows) {
    const byWeek = new Map(stage.curve.rows.map((r) => [r[0], r]));
    if (stage.curve.kind === 'visits') {
      const vals = weeks.map((w) => (byWeek.get(w) || [w, 0])[1]);
      const max = Math.max(1, ...vals);
      const bw = Math.max(1.5, ((x1 - x0) / n) * 0.62);
      curve = svg`${vals.map((v, i) => svg`<rect class="tl-bar ${stage.partial.has(weeks[i]) ? 'partial' : ''}" x=${xAt(i) - bw / 2} y=${yBot - ((yBot - yTop) * v) / max} width=${bw} height=${((yBot - yTop) * v) / max}></rect>`)}`;
    } else {
      const rows = weeks.map((w) => byWeek.get(w) || null);
      const vals = rows.flatMap((r) => (r ? [r[1], r[2], r[3]] : [])).filter((v) => v != null && Number.isFinite(v));
      if (vals.length > 1) {
        let lo = Math.min(...vals), hi = Math.max(...vals);
        if (stage.ref != null && stage.kind !== 'index') { lo = Math.min(lo, stage.ref); hi = Math.max(hi, stage.ref); }
        if (hi === lo) { hi += 1; lo -= 1; }
        const y = (v) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
        let band = '', line = '';
        const pts = rows.map((r, i) => (r && r[1] != null ? [i, r] : null)).filter(Boolean);
        if (pts.length > 1) {
          line = pts.map(([i, r], k) => `${k ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(r[1]).toFixed(1)}`).join('');
          const top = pts.map(([i, r], k) => `${k ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(r[3] ?? r[1]).toFixed(1)}`).join('');
          const bot = [...pts].reverse().map(([i, r]) => `L${xAt(i).toFixed(1)},${y(r[2] ?? r[1]).toFixed(1)}`).join('');
          band = `${top}${bot}Z`;
        }
        const refY = stage.ref != null ? y(stage.ref) : null;
        curve = svg`<path class="tl-band" d=${band}></path><path class="tl-line" d=${line}></path>${refY != null ? svg`<line class="tl-ref" x1=${x0} x2=${x1} y1=${refY} y2=${refY}></line>` : nothing}`;
      }
    }
  }
  // month labels: the first week of each month; the year where it changes
  const months = [];
  let lastM = '', lastY = '';
  weeks.forEach((w, i) => { const m = w.slice(0, 7); if (m !== lastM) { const y = w.slice(0, 4); months.push({ i, label: `${monthAbbr(w)}${y !== lastY ? ` ${y.slice(2)}` : ''}` }); lastM = m; lastY = y; } });
  const thin = months.length > 8 ? 2 : 1;

  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * TL.w;
    if (sx > x1 + (TL.padR / 2 - 8)) { onLive(); return; }
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - x0) / (x1 - x0)) * (n - 1))));
    onWeek(weeks[i]);
  };
  const label = live
    ? t('recentSpan', { span: fspan(stage.win.from, stage.win.to) })
    : `${t('week', { date: fdate(stage.week) })}${stage.partial.has(stage.week) ? ` · ${t('partialWeek')}` : ''}`;
  const caption = stage.curve && stage.curve.kind === 'visits' ? t('tlVisits')
    : stage.curve && stage.curve.kind === 'basket' ? t('tlBasket')
    : stage.curve && stage.curve.label ? t('tlGroup', { name: `${stage.curve.label.brand || stage.curve.label.name} ${stage.curve.label.presentation || ''}`.trim() })
    : stage.curve ? t('tlPrice') : '';
  return html`<div class="float timeline ${busy ? 'busy' : ''}">
    <button class="play" @click=${onPlay} title=${playing ? t('pause') : t('play')} aria-label=${playing ? t('pause') : t('play')}>${playing ? I.pause() : I.play()}</button>
    <div class="tl-main">
      <div class="tl-head">
        <button class="step" @click=${() => onStep(-1)} aria-label=${t('prevWeek')} title=${t('prevWeek')}>${I.chevronL()}</button>
        <span class="tl-label" aria-live="polite">${label}</span>
        <button class="step" @click=${() => onStep(1)} aria-label=${t('nextWeek')} title=${t('nextWeek')}>${I.chevronR()}</button>
        ${caption ? html`<span class="tl-cap">${caption}</span>` : nothing}
      </div>
      <svg class="tl-svg" viewBox="0 0 ${TL.w} ${TL.h}" preserveAspectRatio="none" role="slider" tabindex="0"
        aria-label=${t('timeline')} aria-valuemin="0" aria-valuemax=${n} aria-valuenow=${live ? n : stage.weekIdx} aria-valuetext=${label}
        @pointerdown=${(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        @pointermove=${(e) => { if (e.buttons) pick(e); }}
        @keydown=${(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onStep(-1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); onStep(1); }
          else if (e.key === 'Home') { e.preventDefault(); onWeek(weeks[0]); }
          else if (e.key === 'End') { e.preventDefault(); onLive(); }
        }}>
        ${weeks.map((w, i) => (stage.partial.has(w) ? svg`<rect class="tl-partial" x=${xAt(i) - 3} y=${yTop} width="6" height=${yBot - yTop}></rect>` : nothing))}
        ${curve}
        <line class="tl-axis" x1=${x0} x2=${x1} y1=${yBot} y2=${yBot}></line>
        ${weeks.map((w, i) => svg`<line class="tl-tick" x1=${xAt(i)} x2=${xAt(i)} y1=${yBot} y2=${yBot + 3}></line>`)}
        ${months.filter((m, k) => k % thin === 0 || /d/.test(m.label)).filter((m, k, arr) => !(k > 0 && xAt(m.i) - xAt(arr[k - 1].i) < 26)).map((m) => svg`<text class="tl-month" x=${xAt(m.i)} y=${TL.h - 3}>${m.label}</text>`)}
        <g class="tl-live ${live ? 'on' : ''}">
          <rect x=${liveX - 22} y=${yTop + 6} width="44" height=${yBot - yTop - 6} rx="6"></rect>
          <text x=${liveX} y=${(yTop + yBot) / 2 + 6} text-anchor="middle">${t('recentShort')}</text>
        </g>
        ${live ? nothing : svg`<line class="tl-cursor" x1=${curX} x2=${curX} y1=${yTop - 2} y2=${yBot + 2}></line>`}
        <circle class="tl-knob" cx=${curX} cy=${yBot} r="4.5"></circle>
      </svg>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- tooltip
export function tooltip({ loc, val, stage, byStore, byProduct, x, y, free }) {
  if (!loc || !byStore) return nothing;
  const shared = loc.stores.length > 1;
  const s = byStore.get((val && val.sid) || loc.stores[0]);
  if (!s) return nothing;
  const v = val;
  let line = nothing;
  const dateLine = (d) => (d ? html`<div class="m">${fdate(d)}</div>` : nothing);
  if (v && v.value != null) {
    if (stage.kind === 'index') line = html`<div><b class="num">${v.value.toFixed(2)}</b> <span class="s">${pct(v.dev, 1)} · ${shared && v.n > 1 ? t('medianOfN', { n: v.n }) : t('indexShort')}</span></div>${v.week ? html`<div class="m">${t('week', { date: fdate(v.week) })}</div>` : nothing}`;
    else if (stage.kind === 'product') line = html`<div><b class="num">${money(v.value)}</b> <span class="s">${t('vsRef', { pct: pct(v.dev, 0) })}</span></div>${dateLine(v.date)}`;
    else if (stage.kind === 'group') { const p = v.pid && byProduct ? byProduct.get(v.pid) : null; line = html`<div><b class="num">${money(v.value)}</b> <span class="s">/ ${unitName(stage.unit)} · ${t('vsRef', { pct: pct(v.dev, 0) })}</span></div>${p ? html`<div class="m">${p.brand || p.name} · ${p.presentation || ''} · ${money(v.price)}</div>` : nothing}${dateLine(v.date)}`; }
    else if (stage.kind === 'basket') line = v.hatched ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${v.missing.length === 1 ? t('missingOne') : t('missing', { n: v.missing.length })}</span></div>` : html`<div><b class="num">${money(v.value)}</b> <span class="s">${t('vsRef', { pct: pct(v.dev, 0) })}</span></div>${v.dateMin && v.date ? html`<div class="m">${fspan(v.dateMin, v.date)}</div>` : nothing}`;
  } else if (v && v.reason) {
    const why = { none: t('reasonNone'), stale: v.lastDate ? t('reasonStaleDate', { date: fdate(v.lastDate) }) : t('reasonStale'), few: t('reasonFew'), novisit: t('noVisitWeek'), missing: t('missingLegend') }[v.reason] || '';
    line = html`<div class="m">${why}</div>`;
  } else line = html`<div class="m">${t('reasonNone')}</div>`;
  // keep the tooltip inside the free area (never under a card)
  const left = Math.max((free ? free.left : 0) + 150, Math.min((free ? free.right : window.innerWidth) - 150, x));
  const flip = y < 130;
  return html`<div class="tip" style="left:${left}px;top:${y}px;${flip ? 'transform:translate(-50%,16px)' : ''}">
    <div class="n">${shared ? t('nHere', { n: loc.stores.length }) : s.name}</div>
    <div class="s">${shared ? (stage && stage.kind === 'index' ? '' : `${t('cheapestOfThem')}: ${s.name}`) : `${s.chain}${giroLabel(s) ? ' · ' + giroLabel(s) : ''}${s.municipio ? ' · ' + s.municipio : ''}`}</div>
    ${line}
  </div>`;
}

export function toast({ text }) {
  return html`<div class="toast ${text ? 'on' : ''}" role="status">${text || ''}</div>`;
}
