// Pure logic the app relies on. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, quantile, deviation, clampDev, autoCap, minMax } from '../src/logic/stats.js';
import { unitFor, perUnit, groupUnit, sizeLabel } from '../src/logic/unit.js';
import { divergingColor, divergingGradient } from '../src/logic/color.js';
import { basketLatest, basketAtWeek, rankBasket } from '../src/logic/basket.js';

test('median ignores nulls and handles even counts', () => {
  assert.equal(median([3, null, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([null, undefined]), null);
});

test('quantile interpolates', () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(minMax([3, null, 9, 1])[0], 1);
  assert.equal(minMax([3, null, 9, 1])[1], 9);
});

test('deviation and cap', () => {
  assert.equal(deviation(110, 100), 0.10000000000000009);
  assert.equal(deviation(null, 100), null);
  assert.equal(deviation(100, 0), null);
  assert.equal(clampDev(0.5, 0.2), 1);
  assert.equal(clampDev(-0.1, 0.2), -0.5);
  assert.equal(autoCap([0.01, -0.02, 0.03]), 0.05);
  assert.equal(autoCap([0.4, -0.45, 0.9, 0.1]), 0.5);
  assert.equal(autoCap([]), 0.2);
});

test('display unit follows the shopper', () => {
  assert.equal(unitFor({ value: 1000, unit: 'ml' }), 'l');
  assert.equal(unitFor({ value: 355, unit: 'ml' }), '100ml');
  assert.equal(unitFor({ value: 1000, unit: 'g' }), 'kg');
  assert.equal(unitFor({ value: 150, unit: 'g' }), '100g');
  assert.equal(unitFor({ value: 12, unit: 'pza' }), 'pza');
  assert.equal(unitFor(null), null);
});

test('per-unit price', () => {
  assert.equal(perUnit(24, { value: 1000, unit: 'ml' }), 24);          // $24 per litre
  assert.equal(perUnit(24, { value: 2000, unit: 'ml' }), 12);          // 2 L carton
  assert.equal(perUnit(30, { value: 500, unit: 'g' }), 6);             // per 100 g
  assert.equal(perUnit(36, { value: 12, unit: 'pza' }), 3);            // per piece
  assert.equal(perUnit(36, { value: 18, unit: 'pza' }, 'pza'), 2);
  assert.equal(perUnit(10, null), null);
  assert.equal(perUnit(10, { value: 0, unit: 'g' }), null);
});

test('a group compares per unit only within one dimension', () => {
  assert.equal(groupUnit([{ size: { value: 1000, unit: 'ml' } }, { size: { value: 946, unit: 'ml' } }]), 'l');
  assert.equal(groupUnit([{ size: { value: 1000, unit: 'ml' } }, { size: { value: 500, unit: 'g' } }]), null);
  assert.equal(groupUnit([{ size: null }]), null);
  assert.equal(sizeLabel({ value: 1500, unit: 'ml' }), '1.5 L');
  assert.equal(sizeLabel({ value: 900, unit: 'g' }), '900 g');
  assert.equal(sizeLabel({ value: 12, unit: 'pza' }), '12 pza');
});

test('diverging colour is grey at the median and symmetric in form', () => {
  assert.equal(divergingColor(0), '#5b616a');
  assert.match(divergingColor(-1), /^#[0-9a-f]{6}$/);
  assert.match(divergingColor(1), /^#[0-9a-f]{6}$/);
  assert.notEqual(divergingColor(-1), divergingColor(1));
  assert.equal(divergingColor(null), null);
  assert.equal(divergingColor(2), divergingColor(1));
  assert.ok(divergingGradient().startsWith('linear-gradient('));
});

test('basket totals, missing items and ranking', () => {
  const items = [{ id: 'a', qty: 2 }, { id: 'b', qty: 1 }];
  const latest = new Map([
    ['a', { latest: { s1: [10, '2026-10-13'], s2: [12, '2026-10-13'], s3: [9, '2026-10-06'] } }],
    ['b', { latest: { s1: [5, '2026-10-13'], s2: [4, '2026-10-13'] } }],
  ]);
  const totals = basketLatest(items, latest, ['s1', 's2', 's3', 's4']);
  assert.equal(totals.get('s1').total, 25);
  assert.equal(totals.get('s2').total, 28);
  assert.equal(totals.get('s3').complete, false);
  assert.deepEqual(totals.get('s3').missing, ['b']);
  assert.equal(totals.has('s4'), false);
  const r = rankBasket(totals);
  assert.equal(r.list[0].storeId, 's1');
  assert.equal(r.list[r.list.length - 1].storeId, 's3'); // incomplete last
  assert.equal(r.base, 26.5);
  assert.equal(r.dearest, 28);
  // the map reads dev from the totals rows: complete stores must carry it, incomplete ones null
  assert.ok(Math.abs(totals.get('s1').dev - (25 / 26.5 - 1)) < 1e-12);
  assert.ok(totals.get('s2').dev > 0);
  assert.equal(totals.get('s3').dev, null);
  assert.equal(rankBasket(totals, { onlyComplete: true }).list.length, 2);
  const weeks = new Map([
    ['a', { weeks: ['w1', 'w2'], stores: { s1: [10, 11], s2: [null, 12] } }],
    ['b', { weeks: ['w1', 'w2'], stores: { s1: [5, null], s2: [4, 4] } }],
  ]);
  const t0 = basketAtWeek(items, weeks, ['s1', 's2'], 0);
  assert.equal(t0.get('s1').total, 25);
  assert.equal(t0.get('s2').complete, false);
  const t1 = basketAtWeek(items, weeks, ['s1', 's2'], 1);
  assert.equal(t1.get('s2').total, 28);
  assert.equal(t1.get('s1').complete, false);
});
