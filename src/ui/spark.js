// A sparkline of the city median per week, with the min–max band and a cursor at the
// selected week. Input series rows: [week, median, min, max, n]. Pure lit SVG.
import { svg, nothing } from 'lit';
import { money, fdate } from '../app/i18n.js';

export function sparkline(series, { w = 364, h = 64, cursor = null, band = true, fmt = money, onPick = null } = {}) {
  const rows = (series || []).filter((r) => r && r[1] != null);
  if (rows.length < 2) return nothing;
  const padL = 2, padR = 2, padT = 8, padB = 14;
  const xs = rows.map((_, i) => padL + (i * (w - padL - padR)) / (rows.length - 1));
  const vals = rows.flatMap((r) => (band ? [r[1], r[2], r[3]] : [r[1]])).filter((v) => v != null);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (hi === lo) { hi += 1; lo -= 1; }
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(r[1]).toFixed(1)}`).join('');
  const area = `${line}L${xs[xs.length - 1].toFixed(1)},${(h - padB).toFixed(1)}L${xs[0].toFixed(1)},${(h - padB).toFixed(1)}Z`;
  let bandPath = '';
  if (band) {
    const top = rows.map((r, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)},${y(r[2] ?? r[1]).toFixed(1)}`).join('');
    const bot = [...rows].reverse().map((r, j) => { const i = rows.length - 1 - j; return `L${xs[i].toFixed(1)},${y(r[3] ?? r[1]).toFixed(1)}`; }).join('');
    bandPath = `${top}${bot}Z`;
  }
  const ci = cursor == null || cursor < 0 ? rows.length - 1 : Math.min(rows.length - 1, cursor);
  const cur = rows[ci];
  return svg`<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" @click=${onPick ? (e) => { const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width) * (rows.length - 1)); onPick(rows[i][0], i); } : nothing}>
    ${band ? svg`<path class="band" d=${bandPath}/>` : nothing}
    <path class="area" d=${area}/>
    <path class="line" d=${line}/>
    <line class="cursor" x1=${xs[ci]} x2=${xs[ci]} y1=${padT - 4} y2=${h - padB}/>
    <circle class="pt" cx=${xs[ci]} cy=${y(cur[1])} r="3"/>
    <text class="ax" x=${padL} y=${h - 3}>${fdate(rows[0][0], true)}</text>
    <text class="ax" x=${w - padR} y=${h - 3} text-anchor="end">${fdate(rows[rows.length - 1][0], true)}</text>
  </svg>`;
}
