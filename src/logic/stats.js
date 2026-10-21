// Pure statistics. The app never uses the mean: one outlier drags it, and PROFECO's
// survey has outliers (a mis-typed price, a promotion captured once).

export function median(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function quantile(values, q) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export function minMax(values) {
  let lo = Infinity, hi = -Infinity;
  for (const x of values) { if (x == null || !Number.isFinite(x)) continue; if (x < lo) lo = x; if (x > hi) hi = x; }
  return lo === Infinity ? [null, null] : [lo, hi];
}

// Relative deviation from a baseline: (value - base) / base. null when either is missing.
export function deviation(value, base) {
  if (value == null || base == null || !(base > 0)) return null;
  return value / base - 1;
}

// Map a deviation to [-1, 1] with a cap (±cap maps to ±1). Beyond the cap the color saturates;
// the legend states the cap so a saturated dot is not read as "exactly cap".
export function clampDev(dev, cap) {
  if (dev == null) return null;
  return Math.max(-1, Math.min(1, dev / cap));
}

// Pick a legend cap from the spread: the 90th percentile of |dev|, rounded to a friendly step,
// never below 5 % nor above 50 %.
export function autoCap(devs) {
  const abs = devs.filter((d) => d != null).map(Math.abs);
  const q = quantile(abs, 0.9);
  if (q == null) return 0.2;
  const steps = [0.05, 0.1, 0.15, 0.2, 0.3, 0.5];
  for (const s of steps) if (q <= s) return s;
  return 0.5;
}
