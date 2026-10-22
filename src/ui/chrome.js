// Floating controls around the stage: basket and settings buttons, the legend, the timeline, the
// week numeral, the hover tooltip and the toast. Each is a function returning a lit template.
import { html, svg, nothing } from 'lit';
import { t, pct, money, fdate, fspan, unitName, getLang } from '../app/i18n.js';
import { I } from './icons.js';
import { divergingGradient } from '../logic/color.js';
import { median } from '../logic/stats.js';
import { MIN_N } from '../app/stage.js';

const DEFAULT_GIRO = /supermercado|autoservicio/i;
const fold6 = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 6);
// the store type, unless it only repeats the chain ("Tortillería · Tortillerías")
export const giroLabel = (s) => (s && s.giro && !DEFAULT_GIRO.test(s.giro) && s.giro !== s.chain && fold6(s.giro) !== fold6(s.chain) ? s.giro : '');
// several stores on one point: "puestos" only when they are all Central de Abasto stalls
export function nHereText(loc, byStore) {
  const all = loc.stores.map((id) => byStore.get(id)).filter(Boolean);
  const stalls = all.length > 0 && all.every((x) => /central de abasto/i.test(`${x.giro || ''} ${x.chain || ''}`));
  return t(stalls ? 'nStallsHere' : 'nHere', { n: loc.stores.length });
}

export function topRight({ basketCount, basketOn, onBasket }) {
  return html`<div class="float topright">
    <button class="pill ${basketOn ? 'on' : ''}" @click=${onBasket} title=${t('basket')} aria-expanded=${basketOn ? 'true' : 'false'} aria-label=${`${t('basket')}${basketCount ? ` (${basketCount})` : ''}`}>${I.basket()}<span>${t('basket')}</span>${basketCount ? html`<span class="count">${basketCount}</span>` : nothing}</button>
  </div>`;
}

export function bottomRight({ settingsOn, onSettings, onReset, moved }) {
  return html`<div class="float bottomright">
    ${moved ? html`<button class="pill icon-btn reset" @click=${onReset} title=${t('reset')} aria-label=${t('reset')}>${I.center()}</button>` : html`<span class="pill icon-btn reset slot" aria-hidden="true"></span>`}
    <button class="pill icon-btn settings-btn ${settingsOn ? 'on' : ''}" @click=${onSettings} title=${t('settings')} aria-label=${t('settings')} aria-expanded=${settingsOn ? 'true' : 'false'}>${I.cog()}</button>
  </div>`;
}

// the reference line of the legend, in each mode's own words
export function refText(stage) {
  if (!stage || stage.kind === 'index') return '';
  if (stage.ref == null) return '';
  if (stage.tooFew) return t(stage.kind === 'basket' ? 'refTooFewBasket' : 'refTooFew', { n: stage.refN });
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  if (stage.refKind === 'week') return stage.kind === 'basket' ? t('refWeekBasket', { ref: money(stage.ref), n: stage.refN }) : t('refWeekOnly', { ref: money(stage.ref) + unit });
  if (stage.kind === 'group') return t('refGroup', { ref: money(stage.ref) + unit, n: stage.refN });
  if (stage.kind === 'basket') return t('refBasket', { ref: money(stage.ref), n: stage.refN });
  return t('refProduct', { ref: money(stage.ref), n: stage.refN });
}
export function vsText(stage, dev) {
  if (Math.abs(dev) < 0.005) return t('atMedian');
  const p = pct(dev, 0);
  if (stage.refKind === 'week') return t(stage.kind === 'basket' ? 'vsRefWeekBasket' : 'vsRefWeek', { pct: p });
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
  const noneComplete = stage.kind === 'basket' && stage.ranking && !stage.ranking.completeCount && stage.ranking.list.length > 0;
  const noScale = !index && stage.ref == null;
  // (a stage still loading makes no claim about the empty rings)
  const emptyRows = stage.loading ? [] : index
    ? (stage.weekIdx == null ? [t('emptyIndexFew'), t('emptyIndexStale', { span: fspan(stage.win.from, stage.win.to, true) })] : [t('emptyIndexWeek')])
    : stage.kind === 'basket' ? [stage.weekIdx == null ? t('emptyBasketRecent') : t('noVisitWeek')]
    : [stage.weekIdx == null ? t('emptyPriceRecent') : t('noVisitWeek')];
  return html`<div class="legend" role="group" aria-label=${title}>
    <div class="lt">
      ${onTitle ? html`<button class="ltitle" @click=${onTitle} title=${t('openCard')}>${title}</button>` : html`<span class="ltitle">${title}</span>`}
      ${!index ? html`<button class="lx" title=${t('backToIndex')} aria-label=${t('backToIndex')} @click=${onResetStage}>${I.x()}</button>` : nothing}
    </div>
    ${stage.tooFew || noneComplete || noScale || stage.loading ? nothing : html`<div class="bar" style="background:${divergingGradient()}"></div>
    <div class="ticks"><span>−${cap}${pctSign()} ${t('orMore')}</span><span>${t('median')}</span><span>+${cap}${pctSign()} ${t('orMore')}</span></div>
    <div class="ticks words"><span>${index ? t('storeCheaperWord') : t('cheaper')}</span><span></span><span>${index ? t('storeDearerWord') : t('dearer')}</span></div>`}
    ${stage.loading ? html`<div class="ref">${t('loadingCard')}</div>` : noneComplete ? html`<div class="ref">${t(stage.weekIdx != null ? 'noneCompleteWeek' : 'noneCompleteLegend')}</div>` : ref ? html`<div class="ref">${ref}</div>` : nothing}
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
// The week's own value (its city median, its median cheapest per unit, its median basket total),
// said only when at least 3 stores give it: a "median" of one or two stores is their own price.
export function weekValue(stage) {
  if (!stage || stage.weekIdx == null || stage.kind === 'index') return null;
  if (stage.kind === 'product') return stage.weekN >= MIN_N && stage.weekMed != null ? { value: stage.weekMed, n: stage.weekN, what: t('cityMedian') } : null;
  if (stage.kind === 'group') return stage.weekN >= MIN_N && stage.weekRef != null ? { value: stage.weekRef, n: stage.weekN, what: t('groupMedianWhat') } : null;
  if (stage.kind === 'basket') return stage.weekN >= MIN_N && stage.weekMed != null ? { value: stage.weekMed, n: stage.weekN, what: t('basketMedianWhat') } : null;
  return null;
}
// While a week is on stage, that value in large type over the map: the magnitude reads even when
// the colours saturate.
export function weekNumeral(stage) {
  const wv = weekValue(stage);
  if (!wv) return nothing;
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  return html`<div class="float numeral" aria-hidden="true">
    <div class="nbig num">${money(wv.value)}<small>${unit}</small></div>
    <div class="nsub"><span class="nwhat">${wv.what} · </span>${t('weekOf', { date: fdate(stage.week) })}${stage.partial.has(stage.week) ? ` · ${t('partialWeek')}` : ''}</div>
    ${stage.ref != null && stage.refKind !== 'week' && !stage.tooFew ? html`<div class="nref">${t('recentWord')}: ${money(stage.ref)}${unit}</div>` : nothing}
  </div>`;
}

// The movement in words, for a reader who will not scrub: the highest and the lowest weekly
// median over the strip, from weeks with 3 stores that are not light weeks, when they differ by 10 % or more.
export function trendText(stage) {
  if (!stage || !stage.curve || !stage.curve.rows || stage.curve.kind === 'visits' || stage.curve.kind === 'basket') return '';
  const rows = stage.curve.rows.filter((r) => r[1] != null && (r[4] ?? MIN_N) >= MIN_N && !stage.partial.has(r[0]));
  if (rows.length < 4) return '';
  const vals = rows.map((r) => r[1]);
  const hiV = Math.max(...vals), loV = Math.min(...vals);
  if (!(loV > 0) || hiV / loV - 1 < 0.1) return '';
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  // a value that holds for several weeks is dated to its latest week, with the count
  const point = (v) => { const at = rows.filter((r) => Math.abs(r[1] - v) < 0.005); const last = at[at.length - 1][0]; return at.length > 1 ? t('trendPointMany', { price: money(v) + unit, n: at.length, date: fdate(last, true) }) : t('trendPoint', { price: money(v) + unit, date: fdate(last, true) }); };
  return t('trendLine', { since: fdate(rows[0][0], 'monthYear'), hi: point(hiV), lo: point(loV) });
}

// ---------------------------------------------------------------- timeline
// The weeks as a strip drawn in real pixels (no stretched viewBox): the curve over every week the
// data has (on a phone, only the weeks that can be picked), the pickable weeks unshaded, the
// recent reference dashed, the peak annotated when the line moves, and a knob. "Reciente" is a
// real button.
function monthLabel(iso, withYear) {
  const m = fdate(iso, 'month');
  if (!withYear) return m;
  return getLang() === 'en' ? `${m} '${iso.slice(2, 4)}` : `${m} ${iso.slice(0, 4)}`;
}

export function timeline({ stage, width, compact, playing, collapsed, onWeek, onLive, onPlay, onStep, onExpand, onFold }) {
  if (!stage || !stage.weeks || stage.weeks.length < 2) return nothing;
  if (collapsed) {
    return html`<div class="float timeline collapsed">${(() => { const chipText = stage.week ? t('week', { date: fdate(stage.week) }) : stage.weekSpan ? t('indexSpan', { span: fspan(stage.weekSpan[0], stage.weekSpan[1]) }) : t('recentSpan', { span: fspan(stage.win.from, stage.win.to, true) }); return html`<button class="tl-chip" @click=${onExpand} aria-label=${`${chipText}, ${t('timelineCollapsed')}`}>${I.clock()}<span>${chipText}</span>${I.chevronR()}</button>`; })()}</div>`;
  }
  const sel = stage.weeks;                       // weeks that can be picked
  const axis = !compact && stage.axisWeeks && stage.axisWeeks.length >= sel.length ? stage.axisWeeks : sel;
  const n = axis.length;
  const selStart = Math.max(0, axis.indexOf(sel[0]));
  const live = stage.weekIdx == null;
  const W = Math.max(160, Math.round(width || 600)), H = compact ? 50 : 88;
  const padL = 6, padR = 6, top = compact ? 6 : 16, bot = compact ? 14 : 18;
  const x0 = padL, x1 = W - padR;
  const xAt = (i) => x0 + (n > 1 ? (i * (x1 - x0)) / (n - 1) : 0);
  const yTop = top, yBot = H - bot;
  const curIdx = live ? null : axis.indexOf(stage.week);
  const cx = curIdx != null && curIdx >= 0 ? xAt(curIdx) : null;
  const unit = stage.kind === 'group' && stage.unit ? `/${unitName(stage.unit, true)}` : '';
  // (a generic product with no comparable sizes has no weeks either: its controls rest too)
  const neverComplete = (stage.kind === 'basket' && stage.anyComplete === false) || !!stage.noWeeks;
  const emptyNow = stage.kind === 'basket' && stage.weekIdx != null && stage.ranking && !stage.ranking.completeCount && !neverComplete;
  let curve = nothing, notes = nothing, drawnSolid = null;
  if (stage.curve && stage.curve.rows && !neverComplete) {
    const byWeek = new Map(stage.curve.rows.map((r) => [r[0], r]));
    if (stage.curve.kind === 'visits') {
      const vals = axis.map((w) => (byWeek.get(w) || [w, 0])[1] || 0);
      const max = Math.max(1, ...vals);
      const bw = Math.max(1.5, ((x1 - x0) / n) * 0.6);
      curve = svg`${vals.map((v, i) => svg`<rect class="tl-bar ${stage.partial.has(axis[i]) ? 'partial' : ''}" x=${xAt(i) - bw / 2} y=${yBot - ((yBot - yTop) * v) / max} width=${bw} height=${((yBot - yTop) * v) / max}></rect>`)}`;
    } else {
      const rows = axis.map((w) => byWeek.get(w) || null);
      // the scale follows the median line and the reference; the min–max band is clipped to it,
      // so one store's spike never flattens the line the reader is meant to see
      // the scale follows the solid weeks (3 stores) and the reference: one store's spike never sets it
      // (a curve with fewer than 2 solid weeks takes its scale from every week it has, so its thin
      // weeks are still drawn as faint dots)
      // (a light week is a thin week too: the card's sentence leaves it out, so the line does)
      let meds = rows.filter((r) => r && r[1] != null && (r[4] ?? MIN_N) >= MIN_N && !stage.partial.has(r[0])).map((r) => r[1]);
      if (meds.length < 2) meds = rows.filter((r) => r && r[1] != null).map((r) => r[1]);
      if (stage.ref != null && !stage.tooFew) meds.push(stage.ref);
      if (meds.length > 0) {
        let lo = Math.min(...meds), hi = Math.max(...meds);
        const pad = (hi - lo) * 0.18 || Math.max(0.5, hi * 0.05);
        lo -= pad; hi += pad;
        const y = (v) => yBot - ((v - lo) / (hi - lo)) * (yBot - yTop);
        const solidRow = (r) => r && r[1] != null && (r[4] ?? MIN_N) >= MIN_N && !stage.partial.has(r[0]);
        const pts = rows.map((r, i) => (solidRow(r) ? [i, r] : null)).filter(Boolean);
        drawnSolid = pts.length;
        const thin = rows.map((r, i) => (r && r[1] != null && !solidRow(r) ? [i, r] : null)).filter(Boolean);
        // runs of consecutive solid weeks: a thin week breaks the line instead of pulling it
        // a thin week breaks the line; a week with no data at all does not (the line simply spans it)
        const runs = [];
        let thinSince = false;
        rows.forEach((r, i) => {
          if (r && r[1] != null && !solidRow(r)) { thinSince = true; return; }
          if (!solidRow(r)) return;
          if (!runs.length || thinSince) runs.push({ list: [] });
          runs[runs.length - 1].list.push([i, r]); thinSince = false;
        });
        const path = (list, k) => list.map(([i, r], j) => `${j ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(r[k] ?? r[1]).toFixed(1)}`).join('');
        const line = runs.filter((run) => run.list.length > 1).map((run) => path(run.list, 1)).join('');
        const solos = runs.filter((run) => run.list.length === 1).map((run) => run.list[0]);
        const clampY = (v) => Math.max(yTop - 2, Math.min(yBot, y(v)));
        const band = runs.filter((run) => run.list.length > 1).map((run) => `${path(run.list, 3)}${[...run.list].reverse().map(([i, r]) => `L${xAt(i).toFixed(1)},${y(r[2] ?? r[1]).toFixed(1)}`).join('')}Z`).join('');
        const refY = stage.ref != null && !stage.tooFew ? y(stage.ref) : null;
        const clipId = `tlc-${stage.kind}`;
        curve = svg`<defs><clipPath id=${clipId}><rect x=${x0} y=${yTop - 3} width=${x1 - x0} height=${yBot - yTop + 3}></rect></clipPath></defs><path class="tl-band" clip-path=${`url(#${clipId})`} d=${band}></path><path class="tl-line" d=${line}></path>${solos.map(([i, r]) => svg`<circle class="tl-solo" cx=${xAt(i)} cy=${y(r[1])} r="2.2"></circle>`)}${thin.map(([i, r]) => svg`<circle class="tl-thin" cx=${xAt(i)} cy=${clampY(r[1])} r="1.6"></circle>`)}${refY != null ? svg`<line class="tl-ref" x1=${x0} x2=${x1} y1=${refY} y2=${refY}></line>` : nothing}`;
        if (!compact && pts.length > 3) {
          // a note goes where it fits: inside the strip and clear of the cursor, else nowhere
          const wNote = (txt) => txt.length * 5.6 + 6;
          const ext = (an, tx, w) => (an === 'start' ? [tx, tx + w] : an === 'end' ? [tx - w, tx] : [tx - w / 2, tx + w / 2]);
          const fits = (an, tx, w) => { const [l, r] = ext(an, tx, w); return l >= 0 && r <= W && (cx == null || cx < l - 4 || cx > r + 4); };
          const place = (px, w, pref) => {
            for (const [an, tx] of [[pref, px], ['end', px - 6], ['start', px + 6], ['end', (cx ?? px) - 8], ['start', (cx ?? px) + 8]]) if (fits(an, tx, w)) return { an, tx };
            return null;
          };
          const items = [];
          // the peak: only weeks with 3 stores that are not light weeks, and only when the line moves
          const solid = pts.filter(([, r]) => !stage.partial.has(r[0]));
          const sv = solid.map(([, r]) => r[1]);
          const typical = median(sv);
          const moves = sv.length > 3 && typical > 0 && Math.max(...sv) / Math.min(...sv) - 1 >= 0.03;
          // a value reached in 3 weeks or more is a plateau, not a peak: no note (the card's trend
          // line gives it with its count); a value reached twice is dated to its latest week, as
          // the card dates it
          // (within 1 %: $628.50 one week inside twelve weeks at $629.00 is the plateau, not a low)
          const times = (v) => sv.filter((x) => Math.abs(x / v - 1) <= 0.01).length;
          const standsOut = moves && Math.max(...sv) >= typical * 1.03 && times(Math.max(...sv)) < 3;
          const dipsOut = moves && !standsOut && Math.min(...sv) <= typical * 0.97 && times(Math.min(...sv)) < 3;
          let peakY = null;
          if (standsOut || dipsOut) {
            const peak = solid.reduce((p, q) => (standsOut ? q[1][1] >= p[1][1] : q[1][1] <= p[1][1]) ? q : p);
            if (!(stage.ref != null && Math.abs(peak[1][1] / stage.ref - 1) < 0.005)) {
              const px = xAt(peak[0]), py = y(peak[1][1]);
              const txt = `${t(standsOut ? 'peak' : 'low')} ${money(peak[1][1])}${unit} · ${fdate(peak[1][0], true)}`;
              const pos = place(px, wNote(txt), px > W - 120 ? 'end' : px < 80 ? 'start' : 'middle');
              items.push(svg`<circle class="tl-peak" cx=${px} cy=${py} r="2.5"></circle>`);
              // the note never sits on the dashed reference line: above its dot, else below, else none
              const crosses = (ty) => refY != null && refY > ty - 10 && refY < ty + 3;
              const ty = [Math.max(9, py - 5), py + 13].find((v) => v <= yBot + 2 && !crosses(v));
              if (pos && ty != null) { items.push(svg`<text class="tl-note" x=${pos.tx} y=${ty} text-anchor=${pos.an}>${txt}</text>`); peakY = ty; }
            }
          }
          if (refY != null && (peakY == null || Math.abs(refY - 4 - peakY) > 12)) {
            const txt = `${stage.refKind === 'week' ? t('weekWord') : t('recentWord')} ${money(stage.ref)}${unit}`;
            const pos = place(x1, wNote(txt), 'end');
            if (pos) items.push(svg`<text class="tl-note ref" x=${pos.tx} y=${refY - 4} text-anchor=${pos.an}>${txt}</text>`);
          }
          notes = svg`${items}`;
        }
      }
    }
  }
  // month labels on a regular step chosen from the room, always including the last month; the
  // year where it changes; each label's real extent is checked against the one before
  const starts = [];
  let lastM = '';
  axis.forEach((w, i) => { const m = w.slice(0, 7); if (m !== lastM) { starts.push({ i, w }); lastM = m; } });
  const perMonth = (x1 - x0) / Math.max(1, starts.length);
  const step = [1, 2, 3, 4, 6, 12].find((k) => k * perMonth >= (compact ? 36 : 42)) || 12;
  const months = [];
  let prevYear = '', lastRight = -Infinity;
  starts.filter((_, k) => (starts.length - 1 - k) % step === 0).forEach(({ i, w }, k) => {
    const yr = w.slice(0, 4), label = monthLabel(w, k === 0 || yr !== prevYear);
    const wpx = label.length * 5.8 + 4, x = xAt(i);
    let an = 'middle', left = x - wpx / 2;
    if (left < 0) { an = 'start'; left = 0; } else if (x + wpx / 2 > W) { an = 'end'; left = W - wpx; }
    if (left < lastRight + 6) return;
    months.push({ x: an === 'start' ? 0 : an === 'end' ? W : x, an, label });
    lastRight = left + wpx; prevYear = yr;
  });
  const pickIdx = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - x0) / (x1 - x0)) * (n - 1))));
    onWeek(axis[Math.max(selStart, i)]);
  };
  const partialNow = !live && stage.partial.has(stage.week);
  const label = live
    ? (stage.kind === 'index' && stage.weekSpan ? t('indexSpan', { span: fspan(stage.weekSpan[0], stage.weekSpan[1]) }) : t('recentSpan', { span: fspan(stage.win.from, stage.win.to) }))
    : t('week', { date: fdate(stage.week) });
  const wv = weekValue(stage);
  const valueText = `${label}${partialNow ? `, ${t('partialWeek')}` : ''}${wv ? `, ${wv.what} ${money(wv.value)}${unit}` : ''}`;
  // a curve whose every week has fewer than 3 stores has no weekly median to name
  // (judged on the weeks drawn: a narrow strip shows only the last 26)
  const noSolid = stage.curve && stage.curve.kind !== 'visits' && stage.curve.rows && (drawnSolid != null ? drawnSolid === 0 : !stage.curve.rows.some((r) => r[1] != null && (r[4] ?? MIN_N) >= MIN_N));
  const caption = neverComplete ? t(stage.noWeeks ? 'noWeeksGroup' : 'noneCompleteLegend') : emptyNow ? t('noneCompleteWeek') : !stage.curve ? '' : noSolid ? t('tlNoSolid') : stage.curve.kind === 'visits' ? t('tlVisits') : stage.curve.kind === 'basket' ? t('tlBasket') : stage.curve.kind === 'group' ? t('tlGroupMedian') : t('tlPrice');
  const atStart = !live && stage.weekIdx === 0;
  return html`<div class="float timeline ${compact ? 'compact' : ''}">
    <button class="play" @click=${onPlay} ?disabled=${neverComplete} title=${playing ? t('pause') : t('play')} aria-label=${playing ? t('pause') : t('play')}>${playing ? I.pause() : I.play()}</button>
    <div class="tl-main">
      <div class="tl-head">
        <button class="step" @click=${() => onStep(-1)} ?disabled=${atStart || neverComplete} aria-label=${t('prevWeek')} title=${t('prevWeek')}>${I.chevronL()}</button>
        <span class="tl-label">${label}</span>
        ${partialNow ? html`<span class="tl-pill">${t('partialShort')}</span>` : nothing}
        <button class="step" @click=${() => onStep(1)} ?disabled=${live || neverComplete} aria-label=${t('nextWeek')} title=${t('nextWeek')}>${I.chevronR()}</button>
        ${caption ? html`<span class="tl-cap">${caption}</span>` : nothing}
        ${onFold ? html`<button class="step fold" @click=${onFold} aria-label=${t('foldTimeline')} title=${t('foldTimeline')}>${I.x()}</button>` : nothing}
      </div>
      <div class="tl-row">
        <svg class="tl-svg" width=${W} height=${H} viewBox="0 0 ${W} ${H}" role="slider" tabindex="0"
          aria-label=${t('timeline')} aria-valuemin="0" aria-valuemax=${sel.length} aria-valuenow=${live ? sel.length : stage.weekIdx} aria-valuetext=${valueText}
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
          ${months.map((m) => svg`<text class="tl-month" x=${m.x} y=${H - 3} text-anchor=${m.an}>${m.label}</text>`)}
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
  const st = byStore.get((val && val.sid) || loc.stores[0]);
  const shared = loc.stores.length > 1;
  const priced = val && val.value != null;
  const name = shared ? `${nHereText(loc, byStore)}${st && priced && stage && stage.kind !== 'index' ? `, ${t(val.n === 1 ? 'onlyPricedHere' : 'cheapestOfThem')}: ${st.name}` : ''}` : st ? st.name : '';
  if (!priced) return `${name}. ${reasonText(val)}`;
  if (stage.kind === 'index') return `${name}. ${storeIndexWords(val.value)}${val.week ? `, ${t('week', { date: fdate(val.week) })}` : ''}`;
  const unit = stage.kind === 'group' && stage.unit ? ` / ${unitName(stage.unit)}` : '';
  if (val.hatched) return `${name}. ${money(val.value)}, ${val.missing.length === 1 ? t('missingOne') : t('missing', { n: val.missing.length })}`;
  const cmp = val.far ? t('outlier') : val.dev != null ? vsText(stage, val.dev) : '';
  const when = val.dateMin && val.date && val.dateMin !== val.date ? fspan(val.dateMin, val.date) : val.date ? fdate(val.date) : '';
  return `${name}. ${money(val.value)}${unit}${cmp ? `, ${cmp}` : ''}${when ? `, ${when}` : ''}`;
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
    else if (stage.kind === 'product') line = html`<div><b class="num">${money(v.value)}</b> ${v.far ? html`<span class="flag">${t('outlier')}</span>` : v.dev != null ? html`<span class="s">${vsText(stage, v.dev)}</span>` : nothing}</div>${dateLine(v.date)}`;
    else if (stage.kind === 'group') { const p = v.pid && byProduct ? byProduct.get(v.pid) : null; line = html`<div><b class="num">${money(v.value)}</b> <span class="s">/ ${unitName(stage.unit)}${v.far ? ` · ${t('outlier')}` : v.dev != null ? ` · ${vsText(stage, v.dev)}` : ''}</span></div>${p ? html`<div class="m">${p.brand || p.name} · ${p.presentation || ''} · ${money(v.price)}</div>` : nothing}${dateLine(v.date)}`; }
    else if (stage.kind === 'basket') line = v.hatched ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${v.missing.length === 1 ? t('missingOne') : t('missing', { n: v.missing.length })}</span></div>` : html`<div><b class="num">${money(v.value)}</b> ${v.dev != null ? html`<span class="s">${vsText(stage, v.dev)}</span>` : nothing}</div>${v.dateMin && v.date ? html`<div class="m">${fspan(v.dateMin, v.date)}</div>` : nothing}`;
  } else line = html`<div class="m">${reasonText(v)}</div>`;
  const ownLine = own ? html`<div class="m own">${t('ownMark')}: ${money(own.price)} · ${fdate(own.date)}</div>` : nothing;
  // keep the tooltip inside the free area (never under a card)
  const left = Math.max((free ? free.left : 0) + 150, Math.min((free ? free.right : window.innerWidth) - 150, x));
  const flip = y < 130;
  return html`<div class="tip" style="left:${left}px;top:${y}px;${flip ? 'transform:translate(-50%,16px)' : ''}">
    <div class="n">${shared ? nHereText(loc, byStore) : s.name}</div>
    <div class="s">${shared ? (stage.kind === 'index' ? '' : `${t(val && val.n === 1 ? 'onlyPricedHere' : 'cheapestOfThem')}: ${s.name}`) : `${s.chain}${giroLabel(s) ? ' · ' + giroLabel(s) : ''}${s.municipio ? ' · ' + s.municipio : ''}`}</div>
    ${line}
    ${ownLine}
  </div>`;
}

export function toast({ text, action, onAction, onFocus, onBlur }) {
  return html`<div class="toast ${text ? 'on' : ''} ${action ? 'has-action' : ''}" role="status"><span class="toast-text">${text || ''}</span>${text && action ? html`<button class="toast-btn" @click=${onAction} @focus=${onFocus} @blur=${onBlur} aria-keyshortcuts="Control+Z" title=${`${action} (Ctrl+Z)`}>${action}</button>` : nothing}</div>`;
}
