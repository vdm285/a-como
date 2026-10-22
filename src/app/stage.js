// What the map shows. The stage has a mode (index, product, group, basket) that is independent
// of the open card, so a reader can open store after store while a product stays on the map.
//
// Time, honestly (docs/EDITORIAL.md):
// - "Reciente" (no week chosen) is each store's latest observation inside the recent window
//   (meta.recent: the last 28 days of data). Older observations never count as recent.
// - A chosen week uses only that week's observations (products/<id>.weeks.json, last 26 weeks),
//   always found by DATE in each file.
// - One reference per stage: the recent city median (for a group, the recent median of each
//   store's cheapest per-unit price; for a basket, the median total over the stores with
//   everything). Every week is coloured against that same reference, so movement shows. When a
//   product has no recent price at all, a chosen week is coloured against that week's own
//   median and the legend says so (refKind 'week').
// - A reference from fewer than 3 stores colours nothing and gives no chips (tooFew).
// - "Revísalo": a price 2.5 times or more, or 0.4 times or less, its comparison set's median is
//   marked far (v.far) once here, so every card, tooltip and tag agrees. The set is that week's
//   prices in a chosen week, the recent ones otherwise, and it needs 3 stores (farKind says which).
// - The colour cap is computed once per stage and kept while the reader scrubs.
// Empty values carry a reason: 'none' (never seen here), 'stale' (seen, not recently),
// 'otherUnit' (only in another presentation), 'few' (under 30 comparable products, index),
// 'novisit' (no visit that week), 'missing' (a basket item is missing).

import { state } from './state.js';
import { loadProduct, loadProductWeeks, loadIndex, loadVisits, peekVisits } from '../data/qqp.js';
import { median, minMax, deviation, autoCap, clampDev, FAR_HI, FAR_LO, isFar } from '../logic/stats.js';
import { divergingColor, COLORS } from '../logic/color.js';
import { perUnit, DIM } from '../logic/unit.js';
import { basketLatest, basketAtWeek, rankBasket } from '../logic/basket.js';

export const MIN_N = 3;
export { FAR_HI, FAR_LO, isFar };
// mark the far values of a stage against its comparison set; returns the set's description
function markFar(values, setRef, setN, kind) {
  if (setRef == null || setN < MIN_N) return { farRef: null, farKind: null };
  for (const v of values.values()) if (v.value != null && !v.hatched && isFar(v.value, setRef)) v.far = true;
  return { farRef: setRef, farKind: kind };
}
const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export function weekOf(date) { const t = Date.parse(`${date}T12:00:00Z`); const dow = (new Date(t).getUTCDay() + 6) % 7; return iso(t - dow * DAY); }
const addDays = (d, n) => iso(Date.parse(`${d}T12:00:00Z`) + n * DAY);

export function recentWindow(meta) {
  const to = (meta.recent && meta.recent.to) || meta.latestDate;
  const days = (meta.recent && meta.recent.days) || 28;
  const from = (meta.recent && meta.recent.from) || addDays(to, -(days - 1));
  return { from, to, days, fromWeek: weekOf(from) };
}
export const inWindow = (date, w) => !!date && date >= w.from && date <= w.to;

export function partialWeeks(meta) {
  if (Array.isArray(meta.partialWeeks)) return new Set(meta.partialWeeks);
  if (Array.isArray(meta.weekInfo)) return new Set(meta.weekInfo.filter((w) => w.partial).map((w) => w.week));
  return new Set();
}

function colorsFrom(values, cap) {
  const colors = new Map();
  for (const [sid, v] of values) {
    if (v.hatched) colors.set(sid, { hatched: true });
    else if (v.neutral) colors.set(sid, { fill: COLORS.MID, t: 0 });
    else if (v.dev == null) colors.set(sid, { empty: true });
    else { const t = clampDev(v.dev, cap); colors.set(sid, { fill: divergingColor(t), t }); }
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
// median member size.
export function groupUnit(group, members) {
  const fromPipeline = group && group.unit !== undefined ? group.unit : undefined;
  const count = { g: [], ml: [], pza: [] };
  for (const p of members) if (p.size && p.size.value > 0 && count[p.size.unit]) count[p.size.unit].push(p.size.value);
  const best = Object.entries(count).sort((a, b) => b[1].length - a[1].length)[0];
  let unit = fromPipeline;
  if (unit === undefined) {
    if (!best || !best[1].length) unit = null;
    else if (best[0] === 'pza') unit = 'pza';
    else { const m = median(best[1]); unit = best[0] === 'ml' ? (m >= 700 ? 'l' : '100ml') : (m >= 700 ? 'kg' : '100g'); }
  }
  return { unit, dim: unit ? DIM[unit] : null };
}

// Cap memo: one cap per stage (and per basket content), frozen while the reader scrubs.
const capMemo = new Map();
function capFor(key, devs) {
  if (capMemo.has(key)) return capMemo.get(key);
  const cap = autoCap(devs);
  // memoise only a real sample: a pass made before the catalogue arrived must not freeze the cap
  if (devs.length >= MIN_N) capMemo.set(key, cap);
  return cap;
}
export function basketSignature(items) { return items.map((b) => `${b.id}:${b.qty}`).sort().join(','); }

// mark every coloured value neutral when the reference is too thin to compare against
function gate(values, n) {
  if (n >= MIN_N) return false;
  for (const v of values.values()) if (v.value != null && !v.hatched) { v.dev = null; v.neutral = true; }
  return true;
}

export async function computeStage(stage, week) {
  const d = state.data;
  if (!d) return null;
  const meta = d.meta;
  const win = recentWindow(meta);
  const partial = partialWeeks(meta);
  const values = new Map();
  const storeIds = d.stores.map((s) => s.id);
  const base = { win, partial };
  const recentWeeks = (meta.weeks || []).slice(-26);

  // ---------------------------------------------------------------- index
  if (stage.kind === 'index') {
    const weeks = meta.weeks || [];
    const pw = pickWeek(weeks, week);
    const recentVals = [];
    let wMin = null, wMax = null;
    for (const s of d.stores) {
      const series = (s.index && s.index.series) || [];
      let hit = null;
      // a light week is too thin a baseline for the recent index
      for (let i = series.length - 1; i >= 0; i--) { if (series[i][0] < win.fromWeek) break; if (series[i][1] != null && !partial.has(series[i][0])) { hit = series[i]; break; } }
      if (hit) { values.set(s.id, { value: hit[1], dev: hit[1] - 1, week: hit[0] }); recentVals.push(hit[1] - 1); if (!wMin || hit[0] < wMin) wMin = hit[0]; if (!wMax || hit[0] > wMax) wMax = hit[0]; }
      else values.set(s.id, { value: null, dev: null, reason: (s.recentProducts ?? (s.lastSeen >= win.from ? 1 : 0)) > 0 ? 'few' : 'stale', lastSeen: s.lastSeen });
    }
    const cap = capFor('index', recentVals);
    const visits = peekVisits();
    const curve = visits && visits.weeks ? { kind: 'visits', rows: visits.weeks.map((w, i) => [w, Object.values(visits.stores).reduce((n, arr) => n + (arr[i] > 0 ? 1 : 0), 0)]) } : null;
    if (!visits) loadVisits(); // the curve arrives with a later render; the colours never wait for it
    if (pw.idx != null) {
      const idx = await loadIndex();
      const p2 = pickWeek(idx.weeks, week);
      const vis = await loadVisits();
      const vIdx = vis ? vis.weeks.indexOf(p2.week) : -1;
      values.clear();
      for (const s of d.stores) {
        const row = idx.stores[s.id]; const v = row ? row[p2.idx] : null;
        if (v != null) values.set(s.id, { value: v, dev: v - 1, week: p2.week });
        else { const seen = vIdx >= 0 && vis.stores[s.id] ? vis.stores[s.id][vIdx] : 0; values.set(s.id, { value: null, dev: null, reason: seen > 0 ? 'few' : 'novisit' }); }
      }
      return { ...base, kind: 'index', values, colors: colorsFrom(values, cap), cap, weeks: idx.weeks, axisWeeks: idx.weeks, week: p2.week, weekIdx: p2.idx, ref: 1, curve, weekSpan: [p2.week, p2.week] };
    }
    return { ...base, kind: 'index', values, colors: colorsFrom(values, cap), cap, weeks, axisWeeks: weeks, week: null, weekIdx: null, ref: 1, curve, weekSpan: wMin ? [wMin, wMax] : null };
  }

  // ---------------------------------------------------------------- product
  if (stage.kind === 'product') {
    const p = await loadProduct(stage.id);
    const summary = state.byProduct.get(stage.id);
    const recent = new Map();
    for (const [sid, o] of Object.entries(p.latest || {})) if (inWindow(o[1], win)) recent.set(sid, o);
    let ref = median([...recent.values()].map((o) => o[0]));
    let refN = recent.size, refKind = 'recent';
    let weeks = recentWeeks, pw = { week: null, idx: null };
    let cap, weekMed = null, weekN = 0;
    if (week) {
      const w = await loadProductWeeks(stage.id);
      weeks = w.weeks; pw = pickWeek(weeks, week);
      const col = w.weeks.indexOf(pw.week);
      const weekPrices = [];
      for (const sid of storeIds) { const row = w.stores[sid]; const v = row && col >= 0 ? row[col] : null; if (v != null) weekPrices.push(v); }
      // no recent price: the week is compared with itself, and the legend says so
      weekMed = median(weekPrices); weekN = weekPrices.length;
      if (ref == null) { ref = weekMed; refN = weekN; refKind = 'week'; }
      cap = capFor(`p:${stage.id}:${refKind === 'week' ? pw.week : ''}`, refKind === 'week' ? weekPrices.map((v) => deviation(v, ref)) : [...recent.values()].map((o) => deviation(o[0], ref)));
      for (const sid of storeIds) {
        const row = w.stores[sid]; const v = row && col >= 0 ? row[col] : null;
        values.set(sid, v != null ? { value: v, dev: deviation(v, ref), date: pw.week } : { value: null, dev: null, reason: p.latest[sid] ? 'novisit' : 'none' });
      }
    } else {
      cap = capFor(`p:${stage.id}:`, [...recent.values()].map((o) => deviation(o[0], ref)));
      for (const sid of storeIds) {
        const o = recent.get(sid);
        if (o) values.set(sid, { value: o[0], dev: deviation(o[0], ref), date: o[1] });
        else if (p.latest[sid]) values.set(sid, { value: null, dev: null, reason: 'stale', lastDate: p.latest[sid][1], lastPrice: p.latest[sid][0] });
        else values.set(sid, { value: null, dev: null, reason: 'none' });
      }
    }
    const far = pw.idx != null ? markFar(values, weekMed, weekN, 'week') : markFar(values, ref, refN, 'recent');
    const tooFew = ref != null && gate(values, refN);
    const curve = p.series && p.series.length > 1 ? { kind: 'price', rows: p.series } : null;
    const live = [...values.values()].filter((v) => v.value != null).map((v) => v.value);
    const [lo, hi] = minMax(live);
    return { ...base, kind: 'product', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, axisWeeks: curve ? curve.rows.map((r) => r[0]) : weeks, week: pw.week, weekIdx: pw.idx, ref, refN, refKind, tooFew, weekMed, weekN, ...far, n: recent.size, lo, hi, product: p, summary, curve };
  }

  // ---------------------------------------------------------------- group
  if (stage.kind === 'group') {
    const group = state.byGroup.get(stage.id);
    const members = d.products.filter((p) => p.group === stage.id);
    // before the catalogue arrives there is nothing to compute (and nothing must be memoised)
    if (!group || !members.length) return { ...base, kind: 'group', id: stage.id, loading: true, values, colors: new Map(), cap: 0.2, weeks: recentWeeks, axisWeeks: recentWeeks, week: null, weekIdx: null, ref: null, refN: 0, tooFew: false, members: [], usable: [], curve: null };
    const { unit, dim } = groupUnit(group, members);
    // the comparison set: members in the group's dimension, sold in at least 3 stores, within a third
    // to three times the median member size; the others are listed with the reason, never compared
    const inDim = dim ? members.filter((p) => p.size && p.size.unit === dim && p.size.value > 0) : [];
    const medSize = median(inDim.map((p) => p.size.value));
    const excluded = new Map();
    const bySize = inDim.filter((p) => { if (medSize && (p.size.value < medSize / 3 || p.size.value > medSize * 3)) { excluded.set(p.id, 'size'); return false; } return true; });
    // "sold in 3 stores" counts stores with a recent price, the count the rows show (storesAll
    // counted 20 months and let a grade sold in one store be the cheapest jitomate)
    let usable = bySize.filter((p) => (p.stores ?? 0) >= MIN_N);
    if (usable.length) for (const p of bySize) { if (!usable.includes(p)) excluded.set(p.id, 'few'); }
    else usable = bySize; // no member reaches 3 stores: keep them all rather than compare nothing
    const usableIds = new Set(usable.map((p) => p.id));
    // every member's file: usable ones set the prices; the others tell why a store is empty
    const files = await Promise.all(members.map((p) => loadProduct(p.id).catch(() => null)));
    const failed = files.filter((f) => !f).length;
    const bestRecent = new Map(), otherRecent = new Map(), lastSeen = new Map();
    members.forEach((p, i) => {
      const f = files[i]; if (!f) return;
      for (const [sid, o] of Object.entries(f.latest || {})) {
        const prev = lastSeen.get(sid); if (!prev || o[1] > prev) lastSeen.set(sid, o[1]);
        if (!inWindow(o[1], win)) continue;
        if (!usableIds.has(p.id)) { if (!otherRecent.has(sid)) otherRecent.set(sid, { pid: p.id, price: o[0], date: o[1] }); continue; }
        const per = perUnit(o[0], p.size, unit);
        if (per == null) continue;
        const cur = bestRecent.get(sid);
        if (!cur || per < cur.per) bestRecent.set(sid, { per, pid: p.id, price: o[0], date: o[1] });
      }
    });
    const ref = median([...bestRecent.values()].map((b) => b.per));
    const refN = bestRecent.size;
    const cap = capFor(`g:${stage.id}`, [...bestRecent.values()].map((b) => deviation(b.per, ref)));
    const emptyReason = (sid) => (otherRecent.has(sid) ? { reason: 'otherUnit', other: otherRecent.get(sid) } : lastSeen.has(sid) ? { reason: 'stale', lastDate: lastSeen.get(sid) } : { reason: 'none' });
    // a week is judged by its own stores: a member counts in a week when 3 stores priced it that
    // week (a grade with 8 recent stores but 1 that week must not be that week's cheapest)
    const weekFiles = bySize.length ? await Promise.all(bySize.map((p) => loadProductWeeks(p.id).catch(() => null))) : [];
    const countMemo = new Map();
    const countsAt = (w) => {
      if (countMemo.has(w)) return countMemo.get(w);
      const counts = bySize.map((p, i) => { const wf = weekFiles[i]; const col = wf ? wf.weeks.indexOf(w) : -1; if (col < 0) return 0; let n = 0; for (const arr of Object.values(wf.stores)) if (arr[col] != null) n++; return n; });
      countMemo.set(w, counts); return counts;
    };
    const usableAt = (w) => { const counts = countsAt(w); const ok = new Set(bySize.filter((p, i) => counts[i] >= MIN_N).map((p) => p.id)); return ok.size ? ok : new Set(bySize.map((p) => p.id)); };
    const bestAt = (w) => {
      const best = new Map();
      const ok = usableAt(w);
      bySize.forEach((p, i) => {
        if (!ok.has(p.id)) return;
        const wf = weekFiles[i]; if (!wf) return;
        const col = wf.weeks.indexOf(w); if (col < 0) return;
        for (const [sid, arr] of Object.entries(wf.stores)) {
          const price = arr[col]; if (price == null) continue;
          const per = perUnit(price, p.size, unit); if (per == null) continue;
          const cur = best.get(sid);
          if (!cur || per < cur.per) best.set(sid, { per, pid: p.id, price, date: w });
        }
      });
      return best;
    };
    let weeks = recentWeeks, pw = { week: null, idx: null }, weekRef = null, weekN = 0, memberWeekN = null;
    if (week && bySize.length) {
      pw = pickWeek(recentWeeks, week);
      const best = bestAt(pw.week);
      // the member list says what this week used: its stores that week and why one was left out
      const counts = countsAt(pw.week), ok = usableAt(pw.week);
      memberWeekN = new Map(bySize.map((p, i) => [p.id, counts[i]]));
      for (const [pid, why] of [...excluded]) if (why === 'few') excluded.delete(pid);
      if (ok.size < bySize.length) for (const p of bySize) if (!ok.has(p.id)) excluded.set(p.id, 'fewWeek');
      weekRef = median([...best.values()].map((b) => b.per)); weekN = best.size;
      for (const sid of storeIds) { const b = best.get(sid); values.set(sid, b ? { value: b.per, dev: deviation(b.per, ref), pid: b.pid, price: b.price, date: b.date } : { value: null, dev: null, reason: 'novisit' }); }
    } else {
      for (const sid of storeIds) { const b = bestRecent.get(sid); values.set(sid, b ? { value: b.per, dev: deviation(b.per, ref), pid: b.pid, price: b.price, date: b.date } : { value: null, dev: null, ...emptyReason(sid) }); }
    }
    const far = pw.idx != null ? markFar(values, weekRef, weekN, 'week') : markFar(values, ref, refN, 'recent');
    const tooFew = ref != null && gate(values, refN);
    // the curve: each week, the median over stores of the cheapest per-unit price (the
    // reference's own definition)
    const curve = bySize.length ? { kind: 'group', unit, rows: recentWeeks.map((w) => { const v = [...bestAt(w).values()].map((b) => b.per); const [lo, hi] = minMax(v); return [w, median(v), lo, hi, v.length]; }) } : null;
    const live = [...values.values()].filter((v) => v.value != null).map((v) => v.value);
    const [lo, hi] = minMax(live);
    return { ...base, kind: 'group', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, axisWeeks: weeks, week: pw.week, weekIdx: pw.idx, ref, refN, refKind: 'recent', tooFew, weekRef, weekN, ...far, excluded, memberWeekN, n: refN, otherN: [...otherRecent.keys()].filter((sid) => !bestRecent.has(sid)).length, lo, hi, unit, dim, members, usable, curve, failed, total: members.length };
  }

  // ---------------------------------------------------------------- basket
  if (stage.kind === 'basket') {
    const items = state.basket;
    if (!items.length) return { ...base, kind: 'basket', values, colors: new Map(), cap: 0.2, weeks: [], axisWeeks: [], week: null, weekIdx: null, ref: null, ranking: { list: [], base: null, dearest: null, completeCount: 0 }, curve: null };
    const sig = basketSignature(items);
    const latestById = new Map();
    let failed = 0;
    await Promise.all(items.map(async (it) => {
      try {
        const f = await loadProduct(it.id);
        const latest = {};
        for (const [sid, o] of Object.entries(f.latest || {})) if (inWindow(o[1], win)) latest[sid] = o;
        latestById.set(it.id, { latest });
      } catch { failed++; }
    }));
    const recentTotals = basketLatest(items, latestById, storeIds);
    const recentRanking = rankBasket(recentTotals);
    let ref = recentRanking.base;
    let refN = recentRanking.completeCount, refKind = 'recent';
    let cap = capFor(`c:${sig}`, [...recentTotals.values()].filter((r) => r.complete).map((r) => deviation(r.total, ref)));
    const weeksById = new Map();
    await Promise.all(items.map(async (it) => { try { weeksById.set(it.id, await loadProductWeeks(it.id)); } catch { /* counted as missing */ } }));
    // the axis is fixed to the last 26 weeks of the data; every item is read by date
    const weeks = recentWeeks;
    const curveRows = weeks.map((w) => {
      const t = basketAtWeek(items, weeksById, storeIds, w);
      const totalsC = [...t.values()].filter((r) => r.complete).map((r) => r.total);
      const [lo, hi] = minMax(totalsC);
      return [w, median(totalsC), lo, hi, totalsC.length];
    });
    let totals = recentTotals, ranking = recentRanking, pw = { week: null, idx: null };
    if (week) {
      pw = pickWeek(weeks, week);
      totals = basketAtWeek(items, weeksById, storeIds, pw.week);
      ranking = rankBasket(totals);
      // no recent reference: the week is compared with itself, and the legend says so
      if (ref == null && ranking.base != null) {
        ref = ranking.base; refN = ranking.completeCount; refKind = 'week';
        cap = capFor(`c:${sig}:${pw.week}`, ranking.list.filter((r) => r.complete).map((r) => deviation(r.total, ref)));
      }
      // weekly totals are compared with the recent reference, like every other stage
      for (const r of ranking.list) r.dev = r.complete ? deviation(r.total, ref) : null;
      for (const [, r] of totals) r.dev = r.complete ? deviation(r.total, ref) : null;
    }
    for (const sid of storeIds) {
      const r = totals.get(sid);
      if (!r) { values.set(sid, { value: null, dev: null, reason: week ? 'novisit' : 'none' }); continue; }
      values.set(sid, r.complete ? { value: r.total, dev: r.dev, missing: [], date: r.date, dateMin: r.dateMin } : { value: r.total, dev: null, hatched: true, missing: r.missing, reason: 'missing' });
    }
    const weekMed = pw.idx != null ? ranking.base : null, weekN = pw.idx != null ? ranking.completeCount : 0;
    const tooFew = ref != null && gate(values, refN);
    return { ...base, kind: 'basket', values, colors: colorsFrom(values, cap), cap, weeks, axisWeeks: weeks, week: pw.week, weekIdx: pw.idx, ref, refN, refKind, tooFew, weekMed, weekN, ranking, anyComplete: curveRows.some((r) => r[4] > 0) || recentRanking.completeCount > 0, curve: { kind: 'basket', rows: curveRows }, failed, total: items.length };
  }
  return null;
}
