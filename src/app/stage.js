// What the map shows. The stage has a mode (index, product, group, basket) that is
// independent of the open card, so a reader can open store after store while a product
// stays on the map. Every mode colours stores by deviation from the city median; the
// legend's cap comes from the spread. All async loads go through the cache in data/qqp.js.

import { state } from './state.js';
import { loadProduct, loadProductWeeks, loadIndex } from '../data/qqp.js';
import { median, deviation, clampDev, autoCap } from '../logic/stats.js';
import { divergingColor } from '../logic/color.js';
import { perUnit } from '../logic/unit.js';
import { basketLatest, basketAtWeek, rankBasket } from '../logic/basket.js';

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
  if (!week || !weeks || !weeks.length) return { week: null, idx: null };
  let idx = weeks.indexOf(week);
  if (idx < 0) { // nearest earlier week, else the first
    idx = weeks.findIndex((w) => w > week);
    idx = idx < 0 ? weeks.length - 1 : Math.max(0, idx - 1);
  }
  return { week: weeks[idx], idx };
}

// Dominant size dimension of a group so sizes compare like with like.
export function groupDimension(products) {
  const count = { g: 0, ml: 0, pza: 0 };
  let maxVal = { g: 0, ml: 0, pza: 0 };
  for (const p of products) if (p.size && p.size.value > 0 && count[p.size.unit] != null) { count[p.size.unit]++; maxVal[p.size.unit] = Math.max(maxVal[p.size.unit], p.size.value); }
  const dim = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  if (!dim || dim[1] === 0) return null;
  const d = dim[0];
  const unit = d === 'pza' ? 'pza' : d === 'ml' ? (maxVal.ml >= 700 ? 'l' : '100ml') : (maxVal.g >= 700 ? 'kg' : '100g');
  return { dim: d, unit };
}

export async function computeStage(stage, week) {
  const d = state.data;
  if (!d) return null;
  const values = new Map();
  const storeIds = d.stores.map((s) => s.id);

  if (stage.kind === 'index') {
    let weeks = d.meta.weeks || [];
    const pw = pickWeek(weeks, week);
    if (pw.idx == null) {
      for (const s of d.stores) values.set(s.id, { dev: s.index && s.index.latest != null ? s.index.latest - 1 : null, value: s.index ? s.index.latest : null });
    } else {
      const idx = await loadIndex();
      weeks = idx.weeks; const p2 = pickWeek(weeks, week);
      for (const s of d.stores) { const row = idx.stores[s.id]; const v = row ? row[p2.idx] : null; values.set(s.id, { dev: v != null ? v - 1 : null, value: v }); }
      pw.idx = p2.idx; pw.week = p2.week;
    }
    const cap = autoCap([...values.values()].map((v) => v.dev));
    return { kind: 'index', values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, unit: null };
  }

  if (stage.kind === 'product') {
    const p = await loadProduct(stage.id);
    const summary = state.byProduct.get(stage.id);
    let weeks = [], pw = { week: null, idx: null };
    const prices = new Map();
    if (week) {
      const w = await loadProductWeeks(stage.id);
      weeks = w.weeks; pw = pickWeek(weeks, week);
      for (const sid of storeIds) { const row = w.stores[sid]; prices.set(sid, row ? row[pw.idx] : null); }
    } else {
      for (const sid of storeIds) { const o = p.latest[sid]; prices.set(sid, o ? o[0] : null); }
    }
    const med = median([...prices.values()]);
    for (const sid of storeIds) { const v = prices.get(sid); values.set(sid, { value: v, dev: deviation(v, med), date: !week && p.latest[sid] ? p.latest[sid][1] : pw.week }); }
    const cap = autoCap([...values.values()].map((v) => v.dev));
    return { kind: 'product', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, median: med, unit: null, product: p, summary };
  }

  if (stage.kind === 'group') {
    const members = d.products.filter((p) => p.group === stage.id);
    const dim = groupDimension(members);
    const usable = dim ? members.filter((p) => p.size && p.size.unit === dim.dim && p.size.value > 0) : [];
    const files = await Promise.all(usable.map((p) => loadProduct(p.id).catch(() => null)));
    let weeks = [], pw = { week: null, idx: null }, weekFiles = null;
    if (week && usable.length) {
      weekFiles = await Promise.all(usable.map((p) => loadProductWeeks(p.id).catch(() => null)));
      const first = weekFiles.find(Boolean);
      if (first) { weeks = first.weeks; pw = pickWeek(weeks, week); }
    }
    const best = new Map(); // sid -> { per, pid, price, date }
    usable.forEach((p, i) => {
      const f = files[i]; if (!f) return;
      for (const sid of storeIds) {
        let price = null, date = null;
        if (pw.idx != null) { const wf = weekFiles[i]; const row = wf && wf.stores[sid]; price = row ? row[pw.idx] : null; date = pw.week; }
        else { const o = f.latest[sid]; if (o) { price = o[0]; date = o[1]; } }
        if (price == null) continue;
        const per = perUnit(price, p.size, dim.unit);
        if (per == null) continue;
        const cur = best.get(sid);
        if (!cur || per < cur.per) best.set(sid, { per, pid: p.id, price, date });
      }
    });
    const med = median([...best.values()].map((b) => b.per));
    for (const sid of storeIds) { const b = best.get(sid); values.set(sid, b ? { value: b.per, dev: deviation(b.per, med), pid: b.pid, price: b.price, date: b.date } : { value: null, dev: null }); }
    const cap = autoCap([...values.values()].map((v) => v.dev));
    return { kind: 'group', id: stage.id, values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, median: med, unit: dim ? dim.unit : null, members, usable, dim };
  }

  if (stage.kind === 'basket') {
    const items = state.basket;
    if (!items.length) return { kind: 'basket', values, colors: new Map(), cap: 0.2, weeks: [], week: null, weekIdx: null, ranking: { list: [], base: null, dearest: null, completeCount: 0 } };
    const latestById = new Map();
    let totals;
    let weeks = [], pw = { week: null, idx: null };
    if (week) {
      const weeksById = new Map();
      await Promise.all(items.map(async (it) => { try { weeksById.set(it.id, await loadProductWeeks(it.id)); } catch { /* missing file: counts as missing */ } }));
      const first = [...weeksById.values()][0];
      if (first) { weeks = first.weeks; pw = pickWeek(weeks, week); }
      totals = basketAtWeek(items, weeksById, storeIds, pw.idx ?? 0);
    } else {
      await Promise.all(items.map(async (it) => { try { latestById.set(it.id, await loadProduct(it.id)); } catch { /* ignore */ } }));
      totals = basketLatest(items, latestById, storeIds);
    }
    const ranking = rankBasket(totals);
    for (const sid of storeIds) {
      const r = totals.get(sid);
      if (!r) { values.set(sid, { value: null, dev: null }); continue; }
      values.set(sid, r.complete ? { value: r.total, dev: r.dev, missing: [] } : { value: r.total, dev: null, hatched: true, missing: r.missing });
    }
    const cap = autoCap([...values.values()].map((v) => v.dev));
    return { kind: 'basket', values, colors: colorsFrom(values, cap), cap, weeks, week: pw.week, weekIdx: pw.idx, median: ranking.base, ranking, unit: null };
  }
  return null;
}
