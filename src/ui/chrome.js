// Floating controls around the stage: basket and settings buttons, the legend, the week
// scrubber, the hover tooltip and the toast. Each is a function returning a lit template.
import { html, nothing } from 'lit';
import { t, pct, money, fdate, unitName } from '../app/i18n.js';
import { I } from './icons.js';
import { divergingGradient } from '../logic/color.js';

export function topRight({ basketCount, basketOn, onBasket }) {
  return html`<div class="float topright">
    <button class="pill ${basketOn ? 'on' : ''}" @click=${onBasket} title=${t('basket')} aria-label=${t('basket')}>${I.basket()}<span>${t('basket')}</span>${basketCount ? html`<span class="count">${basketCount}</span>` : nothing}</button>
  </div>`;
}

export function bottomRight({ settingsOn, onSettings, onReset, zoomed }) {
  return html`<div class="float bottomright">
    ${zoomed ? html`<button class="pill icon-btn" @click=${onReset} title=${t('reset')} aria-label=${t('reset')}>${I.center()}</button>` : nothing}
    <button class="pill icon-btn ${settingsOn ? 'on' : ''}" @click=${onSettings} title=${t('settings')} aria-label=${t('settings')}>${I.cog()}</button>
  </div>`;
}

export function legend({ stage, meta, hasOwn, onResetStage }) {
  if (!stage) return nothing;
  let title;
  if (stage.kind === 'index') title = t('index');
  else if (stage.kind === 'product') title = t('legendPrice');
  else if (stage.kind === 'group') title = stage.unit ? t('legendUnit', { unit: unitName(stage.unit) }) : t('legendPrice');
  else title = t('legendBasket');
  const cap = stage.cap || 0.2;
  const weekLine = stage.week ? t('week', { date: fdate(stage.week) }) : (meta ? fdate(meta.latestDate || (meta.weeks && meta.weeks[meta.weeks.length - 1])) : '');
  return html`<div class="legend" role="group" aria-label=${title}>
    <div class="t" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
      <span>${title}</span>
      ${stage.kind !== 'index' ? html`<button class="x" style="width:22px;height:22px;color:var(--ink-3)" title=${t('close')} aria-label=${t('close')} @click=${onResetStage}>${I.x()}</button>` : nothing}
    </div>
    <div class="bar" style="background:${divergingGradient()}"></div>
    <div class="ticks"><span>−${Math.round(cap * 100)} % ${t('cheaper')}</span><span>${t('median')}</span><span>+${Math.round(cap * 100)} % ${t('dearer')}</span></div>
    <div class="row"><span class="sw empty"></span><span>${t('noData')}</span>${stage.kind === 'basket' ? html`<span class="sw" style="background:repeating-linear-gradient(45deg,rgba(255,255,255,.35) 0 1px,transparent 1px 3px)"></span><span>${t('missing', { n: '…' })}</span>` : nothing}</div>
    ${hasOwn ? html`<div class="row"><span class="sw own"></span><span>${t('ownMark')}</span></div>` : nothing}
    <div class="row muted" style="margin-top:8px;color:var(--ink-3)">${weekLine}</div>
  </div>`;
}

export function credit({ meta }) {
  const date = meta ? fdate(meta.latestDate || (meta.weeks && meta.weeks[meta.weeks.length - 1])) : '';
  return html`<div class="credit">PROFECO · QQP ${date ? html`· ${date}` : nothing} · INEGI · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a></div>`;
}

export function scrubber({ stage, playing, onWeek, onPlay, onLive }) {
  if (!stage || !stage.weeks || stage.weeks.length < 2) return nothing;
  const weeks = stage.weeks;
  const idx = stage.weekIdx == null ? weeks.length - 1 : stage.weekIdx;
  const live = stage.weekIdx == null;
  return html`<div class="float scrubber" role="group" aria-label=${t('week', { date: fdate(weeks[idx]) })}>
    <button class="play" @click=${onPlay} title=${playing ? t('pause') : t('play')} aria-label=${playing ? t('pause') : t('play')}>${playing ? I.pause() : I.play()}</button>
    <div class="track">
      <input type="range" min="0" max=${weeks.length - 1} step="1" .value=${String(idx)} aria-valuetext=${fdate(weeks[idx])} @input=${(e) => onWeek(weeks[Number(e.target.value)])} />
      <div class="labels"><span>${fdate(weeks[0], true)}</span><span class="cur">${t('week', { date: fdate(weeks[idx]) })}</span><span>${fdate(weeks[weeks.length - 1], true)}</span></div>
    </div>
    ${live ? html`<span class="live">${t('latest')}</span>` : html`<button class="live" @click=${onLive}>${t('backToLatest')}</button>`}
  </div>`;
}

export function tooltip({ hover, stage, byStore, byProduct, x, y }) {
  if (!hover || !byStore) return nothing;
  const s = byStore.get(hover);
  if (!s) return nothing;
  const v = stage && stage.values ? stage.values.get(hover) : null;
  let line = nothing;
  if (v) {
    if (stage.kind === 'index') line = v.value != null ? html`<div><b class="num">${v.value.toFixed(2)}</b> <span class="s">${v.dev != null ? t('vsMedian', { pct: pct(v.dev, 1) }) : ''}</span></div>` : html`<div class="m">${t('noData')}</div>`;
    else if (stage.kind === 'product') line = v.value != null ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${t('vsMedian', { pct: pct(v.dev, 0) })}</span></div><div class="m">${fdate(v.date)}</div>` : html`<div class="m">${t('noData')}</div>`;
    else if (stage.kind === 'group') { const p = v.pid && byProduct ? byProduct.get(v.pid) : null; line = v.value != null ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${t('perUnit', { unit: unitName(stage.unit) })} · ${t('vsMedian', { pct: pct(v.dev, 0) })}</span></div>${p ? html`<div class="m">${p.name}${p.brand ? ' · ' + p.brand : ''} ${p.presentation || ''} · ${money(v.price)}</div>` : nothing}` : html`<div class="m">${t('noData')}</div>`; }
    else if (stage.kind === 'basket') line = v.value != null ? html`<div><b class="num">${money(v.value)}</b> <span class="s">${v.hatched ? (v.missing.length === 1 ? t('missingOne') : t('missing', { n: v.missing.length })) : t('vsMedian', { pct: pct(v.dev, 0) })}</span></div>` : html`<div class="m">${t('noData')}</div>`;
  }
  const [W] = [window.innerWidth];
  const left = Math.max(140, Math.min(W - 140, x));
  const flip = y < 110;
  return html`<div class="tip" style="left:${left}px;top:${y}px;${flip ? 'transform:translate(-50%,16px)' : ''}">
    <div class="n">${s.name}</div>
    <div class="s">${s.chain}${s.municipio ? ' · ' + s.municipio : ''}</div>
    ${line}
  </div>`;
}

export function toast({ text }) {
  return html`<div class="toast ${text ? 'on' : ''}" role="status">${text || ''}</div>`;
}
