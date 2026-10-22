// Per-unit prices from a product's parsed size ({ value, unit: 'g'|'ml'|'pza', pack? }).
// Which unit to show follows what a shopper says at the shelf: litres for drinks and milk,
// kilos for bulk, 100 g / 100 ml for everything packaged small, pieces for eggs and rolls.
// A generic product decides its unit once for the whole group (groupUnit in src/app/stage.js).

// the dimension each display unit measures
export const DIM = { l: 'ml', '100ml': 'ml', kg: 'g', '100g': 'g', pza: 'pza' };

export function unitFor(size) {
  if (!size || !(size.value > 0)) return null;
  if (size.unit === 'pza') return 'pza';
  if (size.unit === 'ml') return size.value >= 700 ? 'l' : '100ml';
  if (size.unit === 'g') return size.value >= 700 ? 'kg' : '100g';
  return null;
}

// Price per the display unit. Returns null when the size is in another dimension: a bunch of
// onions sold by the piece has no price per kilo (the first audit found $15,900/kg on screen).
export function perUnit(price, size, unit = unitFor(size)) {
  if (price == null || !size || !(size.value > 0) || !unit) return null;
  if (DIM[unit] !== size.unit) return null;
  const per = { l: 1000, kg: 1000, '100g': 100, '100ml': 100, pza: 1 }[unit];
  return (price / size.value) * per;
}

// A group compares its products per unit only when they share a dimension (all g, all ml,
// or all pza). Returns the unit the whole group can use, or null.
export function groupUnit(products) {
  const dims = new Set();
  let maxVal = 0;
  for (const p of products) {
    if (!p.size || !(p.size.value > 0)) continue;
    dims.add(p.size.unit);
    maxVal = Math.max(maxVal, p.size.value);
  }
  if (dims.size !== 1) return null;
  const dim = [...dims][0];
  if (dim === 'pza') return 'pza';
  if (dim === 'ml') return maxVal >= 700 ? 'l' : '100ml';
  if (dim === 'g') return maxVal >= 700 ? 'kg' : '100g';
  return null;
}

// "1.5 L", "900 g", "18 pza" (English: "18 pcs")
export function sizeLabel(size, lang = 'es') {
  if (!size || !(size.value > 0)) return '';
  const u = size.unit;
  if (u === 'pza') return `${trim(size.value)} ${lang === 'en' ? (size.value === 1 ? 'pc' : 'pcs') : 'pza'}`;
  if (u === 'ml') return size.value >= 1000 ? `${trim(size.value / 1000)} L` : `${trim(size.value)} ml`;
  if (u === 'g') return size.value >= 1000 ? `${trim(size.value / 1000)} kg` : `${trim(size.value)} g`;
  return `${size.value} ${u}`;
}
function trim(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); }
