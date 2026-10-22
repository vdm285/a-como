// What the map shows. The stage has a mode (index, product, group, basket) that is independent
// of the open card, so a reader can open store after store while a product stays on the map.
//
// Time, honestly (docs/EDITORIAL.md):
// - "Reciente" (no week chosen) is each store's latest observation inside the recent window
//   (meta.recent: the last 28 days of data). Older observations never count as recent: the
//   store becomes a hollow dot whose tooltip says when PROFECO last saw the product there.
// - A chosen week uses only that week's observations (products/<id>.weeks.json, last 26 weeks).
// - One reference per stage: the city median of the recent window. Every week is coloured against
//   that same reference, so a price moving through the weeks shows on the map, and the legend
//   states the reference with its dates. The index is the exception: it is already a ratio to
//   each week's own city median, so its reference is 1.00 by definition.
// - The colour cap is computed once per stage from the recent distribution and kept while the
//   reader scrubs, so the legend never rescales mid-animation.
// Empty values carry a reason: 'none' (never seen here), 'stale' (seen, not recently), 'few'
// (visited but under 30 products, index only), 'novisit' (no visit that week), 'missing' (a
// basket item is missing).

import { state } from './state.js';
import { loadProduct, loadProductWeeks, loadIndex, loadVisits } from '../data/qqp.js';
import { median, minMax, deviation, clampDev, autoCap } from '../logic/stats.js';
import { divergingColor } from '../logic/color.js';
import { perUnit } from '../logic/unit.js';
import { basketLatest, basketAtWeek, rankBasket } from '../logic/basket.js';

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const addDays = (d, n) => iso(Date.parse(`${d}T12:00:00Z`) + n * DAY);

export function recentWindow(meta) {
  const to = (meta.recent && meta.recent.to) || meta.latestDate;
  const days = (meta.recent && meta.recent.days) || 28;
  const from = (meta.recent && meta.recent.from) || addDays(to, -(days - 1));
  return { from, to, days, fromWeek: weekOf(from) };
}
export const inWindow = (date, w) => !!date && date >= w.from && date <= w.to;
// the Monday of the week containing a date
export function weekOf(date) { const t = Date.parse(`${date}T12:00:00Z`); const dow = (new Date(t).getUTCDay() + 6) % 7; return iso(t - dow * DAY); }

export function partialWeeks(meta) {
  if (Array.isArray(meta.partialWeeks)) return new Set(meta.partialWeeks);
  if (Array.isArray(meta.weekInfo)) return new Set(meta.weekInfo.filter((w) => w.partial).map((w) => w.week));
  return new Set();
}

function colorsFrom(values, cap) {
  const colors = new Map();
  for (const [sid, v] of values) {
    if (v.hatched) colors.set(sid, { hatched: true });
    else if (v.dev == null) colors.set(sid, { empty: true });
    else colors.set(sid, { fill: divergingColor(clampDev(v.dev, cap)) });
  }
  return colors;
}

function pickWeek(weeks, week) {
  if (!week || !weeks || !weeks.length) return { week: null, idx: null, exact: true };
  let idx = weeks.indexOf(week);
  const exact = idx >= 0;
  if (idx < 0) { // nearest earlier week, else the first
    idx = weeks.findIndex((w) => w > week);
    idx = idx < 0 ? weeks.length - 1 : Math.max(0, idx - 1);
  }
  return { week: weeks[idx], idx, exact };
}

// The display unit of a generic product, decided once for the whole group: the pipeline's
// groups.json `unit` when present, else the dimension most members share and, within it, the
// median member size (the max let six 1 kg loins turn canned tuna into a per-kilo ranking).
export function groupUnit(group, members) {
  const fromPipeline = group && group.unit !== undefined ? group.unit : undefined;
  const count = { g: [], ml: [], pza: [] };
  for (const p of members) if (p.size && p.size.value > 0 && count[p.size.unit]) count[p.size.unit].push(p.size.value);
  const best = Object.entries(count).sort((a, b) => b[1].length - a[1].length)[0];
  const dim = best && best[1].length ? best[0] : null;
  let unit = fromPipeline;
  if (unit === undefined) {
    if (!dim) unit = null;
    else if (dim === 'pza') unit = 'pza';
    else { const m = median(best[1]); unit = dim === 'ml' ? (m >= 700 ? 'l' : '100ml') : (m >= 700 ? 'kg' : '100g'); }
  }
  const unitDim = unit === 'l' || unit === '100ml' ? 'ml' : unit === 'kg' || unit === '100g' ? 'g' : unit === 'pza' ? 'pza' : null;
  return { unit, dim: unitDim };
}

// Cap memo: one cap per stage (and per basket content), frozen while the reader scrubs.
const capMemo = new Map();
function capFor(key, devs) {
  if (!capMemo.has(key)) capMemo.set(key, autoCap(devs));
  return capMemo.get(key);
}
export function basketSignature(items) { return items.map((b) => `${b.id}:${b.qty}`).sort().join(','); }

export async function computeStage(stage, week) {
  const d = state.data;
  if (!d) return null;
  const meta = d.meta;
  const win = recentWindow(meta);
  const partial = partialWeeks(meta);
  const values = new Map();
  const storeIds = d.stores.map((s) => s.id);
  const base = { win, partial };

  // ---------------------------------------------------------------- index
  if (stage.kind === 'index') {
    const winWeek = win.fromWeek;
    const weeks = meta.weeks || [];
    const pw = pickWeek(weeks, week);
    const recentVals = [];
    for (const s of d.stores) {
      const series = (s.index && s.index.series) || [];
      let hit = null;
      // a light week (meta.partialWeeks: 53 stores on the last Monday, the Christmas weeks) is too thin a baseline for the recent index
      for (let i = series.length - 1; i >= 0; i--) { if (series[i][0] < winWeek) break; if (series[i][1] != null && !partial.has(series[i][0])) { hit = series[i]; break; } }
      if (hit) { values.set(s.id, { value: hit[1], dev: hit[1] - 1, week: hit[0] }); recentVals.push(hit[1] - 1); }
      else values.set(s.id, { value: null, dev: null, reason: (s.recentProducts ?? (s.lastSeen >= win.from ? 1 : 0)) > 0 ? 'few' : 'stale', lastSeen: s.lastSeen });
    }
    const cap = capFor('index', recentVals);
    let curve = null;
    try {
      const visits = await loadVisits();
      if (visits && visits.weeks) curve = { kind: 'visits', rows: visits.weeks.map((w, i) => [w, Object.values(visits.stores).reduce((n, arr) => n + (arr[i] > 0 ? 1 : 0), 0)]) };
    } catch { /* the timeline then draws ticks only */ }
    if (pw.idx != null) {
      const idx = await loadIndex();
      const p2 = pickWeek(idx.weeks, week);
      let visits = null; try { visits = await loadVisits(); } catch { /* reasons fall back to 'novisit' */ }
      const vIdx = visits ? visits.weeks.indexOf(p2.week) : -1;
      values.clear();
      for (const s of d.stores) {
        const row = idx.stores[s.id]; const v = row ? row[p2.idx] : null;
        if (v != null) values.set(s.id, { value: v, dev: v - 1, week: p2.week });
        else { const seen = vIdx >= 0 && visits.stores[s.id] ? visits.stores[s.id][vIdx] : 0; values.set(s.id, { value: null, dev: null, reason: seen > 0 ? 'few' : 'novisit' }); }
      }
      return { ...base, kind: 'index', values, colors: colorsFrom(values, cap), cap, weeks: idx.weeks, week: p2.week, weekIdx: p2.idx, ref: 1, curve };
    }
    return { ...base, kind: 'index', values, colors: colorsFrom(values, cap), cap, weeks, week: null, weekIdx: null, ref: 1, curve };
  }

  // The per-store weekly files cover the last 26 weeks; the scrubber offers those.
  const recentWeeks = (meta.weeks || []).slice(-26);

  // ---------------------------------------------------------------- product
  if (stage.kind === 'product') {
    const p = await loadProduct(stage.id);
    const summary = state.byProduct.get(stage.id);
    const recent = new Map();
    for (const [sid, o] of Object.entries(p.latest || {})) if (inWindow(o[1], win)) recent.set(sid, o);
    const ref = median([...recent.values()].map((o) => o[0]));
    const cap = capFor(`p:${stage.id}`, [...recent.values()].map((o) => deviation(o[0], ref)));
    let weeks = recentWeeks, pw = { week: null, idx: null };
    if (week) {
      const w = await loadProductWeeks(stage.id);
      weeks = w.weeks; pw = pickWeek(weeks, week);
      for (const sid of storeIds) {
        const row = w.stores[sid]; const v = row ? row[pw.idx] : null;
        values.set(sid, v != null ? { value: v, dev: deviation(v, ref), date: pw.week } : { value: null, dev: null, reason: p.latest[sid] ? 'novisit' : 'none' });
      }
    } else {
      for (const sid of storeIds) {
        const o = recent.get(sid);
        if (o) values.set(sid, { value: o[0], dev: deviation(o[0], ref), date: o[1] });
        else if (p.latest[sid]) values.set(sid, { value: null, dev: null, reason: 'stale', lastDate: p.latest[sid][1], lastPrice: p.latest[sid][0] });
        else values.set(sid, { value: null, dev: null, reason: 'none' });
      }
    }
    const curve = p.series && p.series.length > 1 ? { kind: 'price', rows: p.series } : null;
    const live = [...values.values()].filter((v) => v.value != null).map((v) => v.value);
    const [lo, hi] = minMax(live);
    return { ...base, kind: 'product', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, ref, n: recent.size, lo, hi, product: p, summary, curve };
  }

  // ---------------------------------------------------------------- group
  if (stage.kind === 'group') {
    const group = state.byGroup.get(stage.id);
    const members = d.products.filter((p) => p.group === stage.id);
    const { unit, dim } = groupUnit(group, members);
    const usable = dim ? members.filter((p) => p.size && p.size.unit === dim && p.size.value > 0) : [];
    const files = await Promise.all(usable.map((p) => loadProduct(p.id).catch(() => null)));
    // reference: per store the cheapest per-unit price among members with a recent observation
    const bestRecent = new Map();
    usable.forEach((p, i) => {
      const f = files[i]; if (!f) return;
      for (const [sid, o] of Object.entries(f.latest || {})) {
        if (!inWindow(o[1], win)) continue;
        const per = perUnit(o[0], p.size, unit);
        if (per == null) continue;
        const cur = bestRecent.get(sid);
        if (!cur || per < cur.per) bestRecent.set(sid, { per, pid: p.id, price: o[0], date: o[1] });
      }
    });
    const ref = median([...bestRecent.values()].map((b) => b.per));
    const cap = capFor(`g:${stage.id}`, [...bestRecent.values()].map((b) => deviation(b.per, ref)));
    let weeks = recentWeeks, pw = { week: null, idx: null };
    if (week && usable.length) {
      const weekFiles = await Promise.all(usable.map((p) => loadProductWeeks(p.id).catch(() => null)));
      const first = weekFiles.find(Boolean);
      if (first) { weeks = first.weeks; pw = pickWeek(weeks, week); }
      const best = new Map();
      usable.forEach((p, i) => {
        const wf = weekFiles[i]; if (!wf || pw.idx == null) return;
        const col = wf.weeks.indexOf(pw.week); if (col < 0) return;
        for (const [sid, arr] of Object.entries(wf.stores)) {
          const price = arr[col]; if (price == null) continue;
          const per = perUnit(price, p.size, unit); if (per == null) continue;
          const cur = best.get(sid);
          if (!cur || per < cur.per) best.set(sid, { per, pid: p.id, price, date: pw.week });
        }
      });
      for (const sid of storeIds) { const b = best.get(sid); values.set(sid, b ? { value: b.per, dev: deviation(b.per, ref), pid: b.pid, price: b.price, date: b.date } : { value: null, dev: null, reason: 'novisit' }); }
    } else {
      for (const sid of storeIds) { const b = bestRecent.get(sid); values.set(sid, b ? { value: b.per, dev: deviation(b.per, ref), pid: b.pid, price: b.price, date: b.date } : { value: null, dev: null, reason: 'none' }); }
    }
    // the curve follows the member most stores carry, named on the timeline
    let curve = null;
    const anchor = usable.map((p, i) => ({ p, f: files[i] })).filter((x) => x.f && x.f.series && x.f.series.length > 1).sort((a, b) => (b.p.storesAll ?? b.p.stores) - (a.p.storesAll ?? a.p.stores))[0];
    if (anchor) curve = { kind: 'price', rows: anchor.f.series.map((r) => [r[0], perUnit(r[1], anchor.p.size, unit), perUnit(r[2], anchor.p.size, unit), perUnit(r[3], anchor.p.size, unit), r[4]]), label: anchor.p, unit };
    const live = [...values.values()].filter((v) => v.value != null).map((v) => v.value);
    const [lo, hi] = minMax(live);
    return { ...base, kind: 'group', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, ref, n: bestRecent.size, lo, hi, unit, dim, members, usable, curve };
  }

  // ---------------------------------------------------------------- basket
  if (stage.kind === 'basket') {
    const items = state.basket;
    if (!items.length) return { ...base, kind: 'basket', values, colors: new Map(), cap: 0.2, weeks: [], week: null, weekIdx: null, ref: null, ranking: { list: [], base: null, dearest: null, completeCount: 0 }, curve: null };
    const sig = basketSignature(items);
    // recent totals: each item's latest observation inside the window
    const latestById = new Map();
    await Promise.all(items.map(async (it) => {
      try {
        const f = await loadProduct(it.id);
        const latest = {};
        for (const [sid, o] of Object.entries(f.latest || {})) if (inWindow(o[1], win)) latest[sid] = o;
        latestById.set(it.id, { latest });
      } catch { /* missing file: counts as missing */ }
    }));
    const recentTotals = basketLatest(items, latestById, storeIds);
    const recentRanking = rankBasket(recentTotals);
    const ref = recentRanking.base;
    const cap = capFor(`c:${sig}`, [...recentTotals.values()].filter((r) => r.complete).map((r) => deviation(r.total, ref)));
    // weekly totals for the curve and the scrubber
    const weeksById = new Map();
    await Promise.all(items.map(async (it) => { try { weeksById.set(it.id, await loadProductWeeks(it.id)); } catch { /* missing */ } }));
    const first = [...weeksById.values()][0];
    const weeks = first ? first.weeks : recentWeeks;
    const curveRows = weeks.map((w, i) => {
      const t = basketAtWeek(items, weeksById, storeIds, i);
      const totalsC = [...t.values()].filter((r) => r.complete).map((r) => r.total);
      const [lo, hi] = minMax(totalsC);
      return [w, median(totalsC), lo, hi, totalsC.length];
    });
    let totals = recentTotals, ranking = recentRanking, pw = { week: null, idx: null };
    if (week) {
      pw = pickWeek(weeks, week);
      totals = basketAtWeek(items, weeksById, storeIds, pw.idx ?? 0);
      ranking = rankBasket(totals);
      // weekly totals are compared with the recent reference, like every other stage
      for (const r of ranking.list) r.dev = r.complete ? deviation(r.total, ref) : null;
      for (const [, r] of totals) r.dev = r.complete ? deviation(r.total, ref) : null;
    }
    for (const sid of storeIds) {
      const r = totals.get(sid);
      if (!r) { values.set(sid, { value: null, dev: null, reason: week ? 'novisit' : 'none' }); continue; }
      values.set(sid, r.complete ? { value: r.total, dev: r.dev, missing: [], date: r.date, dateMin: r.dateMin } : { value: r.total, dev: null, hatched: true, missing: r.missing, reason: 'missing' });
    }
    return { ...base, kind: 'basket', values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, ref, ranking, curve: { kind: 'basket', rows: curveRows } };
  }
  return null;
}
