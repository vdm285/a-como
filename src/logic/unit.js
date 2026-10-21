// Per-unit prices from a product's parsed size ({ value, unit: 'g'|'ml'|'pza', pack? }).
// Which unit to show follows what a shopper says at the shelf: litres for drinks and
// milk, kilos for bulk, 100 g / 100 ml for everything packaged small, pieces for eggs
// and rolls. The rule is by the generic product's typical size, decided per group once.

export function unitFor(size) {
  if (!size || !(size.value > 0)) return null;
  if (size.unit === 'pza') return 'pza';
  if (size.unit === 'ml') return size.value >= 700 ? 'l' : '100ml';
  if (size.unit === 'g') return size.value >= 700 ? 'kg' : '100g';
  return null;
}

// Price per the display unit. The factor converts the whole package to that unit.
export function perUnit(price, size, unit = unitFor(size)) {
  if (price == null || !size || !(size.value > 0) || !unit) return null;
  const base = size.unit === 'pza' ? size.value : size.value; // total g, ml or pieces
  const per = { l: 1000, kg: 1000, '100g': 100, '100ml': 100, pza: 1 }[unit];
  if (!per) return null;
  return (price / base) * per;
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

export function sizeLabel(size) {
  if (!size || !(size.value > 0)) return '';
  const u = size.unit;
  if (u === 'pza') return `${size.value} pza`;
  if (u === 'ml') return size.value >= 1000 ? `${trim(size.value / 1000)} L` : `${trim(size.value)} ml`;
  if (u === 'g') return size.value >= 1000 ? `${trim(size.value / 1000)} kg` : `${trim(size.value)} g`;
  return `${size.value} ${u}`;
}
function trim(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); }
