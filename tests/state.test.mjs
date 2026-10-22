// The notification bus must deliver every kind raised in one tick (a ?lang= link used to
// swallow the 'view' that followed it).
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem: () => {} };
if (!('onLine' in globalThis.navigator)) Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
const { subscribe, notify, setPref, setView } = await import('../src/app/state.js');

test('kinds raised in one tick arrive together', async () => {
  const got = [];
  const off = subscribe((kinds) => got.push([...kinds].sort()));
  setPref('lang', 'en');
  setView('product', 'x');
  notify('week');
  await new Promise((r) => setTimeout(r, 0));
  off();
  assert.deepEqual(got, [['prefs', 'view', 'week']]);
});
