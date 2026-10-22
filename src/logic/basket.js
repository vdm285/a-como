// Basket totals per store. A store is "complete" when PROFECO saw every item there in the
// week considered; incomplete stores still get a partial total but are never ranked above
// a complete one by default, and the card says what is missing.

import { median, deviation } from './stats.js';

// items: [{ id, qty }]; latestById: Map productId -> { latest: { storeId: [price, date] } }
// Returns Map storeId -> { total, n, missing: [productId], complete, date }
export function basketLatest(items, latestById, storeIds) {
  const out = new Map();
  for (const sid of storeIds) out.set(sid, { total: 0, n: 0, missing: [], complete: true, date: null, dateMin: null });
  for (const { id, qty } of items) {
    const p = latestById.get(id);
    const latest = p && p.latest ? p.latest : {};
    for (const sid of storeIds) {
      const row = out.get(sid);
      const obs = latest[sid];
      if (obs && obs[0] != null) {
        row.total += obs[0] * qty;
        row.n += 1;
        // the total spans dates: keep both ends so the card can say "del 4 al 27 ago"
        if (!row.date || obs[1] > row.date) row.date = obs[1];
        if (!row.dateMin || obs[1] < row.dateMin) row.dateMin = obs[1];
      } else {
        row.missing.push(id);
        row.complete = false;
      }
    }
  }
  for (const [sid, row] of out) if (row.n === 0) out.delete(sid);
  return out;
}

// Same at a given week index. weeksById: Map productId -> { weeks: [...], stores: { storeId: [price|null...] } }
export function basketAtWeek(items, weeksById, storeIds, weekIdx) {
  const out = new Map();
  for (const sid of storeIds) out.set(sid, { total: 0, n: 0, missing: [], complete: true });
  for (const { id, qty } of items) {
    const w = weeksById.get(id);
    for (const sid of storeIds) {
      const row = out.get(sid);
      const series = w && w.stores ? w.stores[sid] : null;
      const price = series ? series[weekIdx] : null;
      if (price != null) { row.total += price * qty; row.n += 1; }
      else { row.missing.push(id); row.complete = false; }
    }
  }
  for (const [sid, row] of out) if (row.n === 0) out.delete(sid);
  return out;
}

// Ranking with the median among complete stores as the baseline for deviations.
export function rankBasket(totals, { onlyComplete = false } = {}) {
  const rows = [...totals.entries()].map(([storeId, r]) => ({ storeId, ...r }));
  const complete = rows.filter((r) => r.complete);
  const base = median(complete.map((r) => r.total));
  // dev goes on the totals rows themselves too: the stage colours the map from `totals`
  // (the ranking rows are copies; writing only to them left every complete store uncoloured)
  for (const r of rows) r.dev = r.complete ? deviation(r.total, base) : null;
  for (const [, r] of totals) r.dev = r.complete ? deviation(r.total, base) : null;
  const list = (onlyComplete ? complete : rows).sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (a.complete) return a.total - b.total;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return a.total - b.total;
  });
  const dearest = complete.length ? Math.max(...complete.map((r) => r.total)) : null;
  return { list, base, dearest, completeCount: complete.length };
}
