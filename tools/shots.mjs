// Deterministic screenshots of the running app through the installed Chrome (puppeteer-core,
// no browser download). Used by the self-audit loop and for the handoff pictures.
// Run with the dev server up: node tools/shots.mjs [--base=http://localhost:5175/] [--out=data/cache/shots]
// Each state below becomes <out>/<name>.png; "desktop" is 1600×900, "phone" 375×812 at 2×.
import puppeteer from 'puppeteer-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const BASE = arg('base', 'http://localhost:5175/');
const OUT = resolve(arg('out', 'data/cache/shots'));
const CHROME = ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
if (!CHROME) { console.error('no Chrome/Edge found'); process.exit(1); }
mkdirSync(OUT, { recursive: true });

// Each state: name, hash, optional actions (typed into the page) and a settle time.
const STATES = [
  { name: 'city', hash: '' },
  { name: 'city-week', hash: '?w=2025-06-02' },
  { name: 'search', hash: '', type: 'leche' },
  { name: 'group', hash: 'g/leche-ultrapasteurizada' },
  { name: 'product', hash: 'p/leche-ultrapasteurizada-a3d941' },
  { name: 'store', hash: 't/chedraui-selecto-46b8a5' },
  { name: 'basket', hash: 'c?items=leche-ultrapasteurizada-a3d941:1,huevo-f2ba30:1' },
  { name: 'settings', hash: 's' },
];
const VIEWPORTS = { desktop: { width: 1600, height: 900, deviceScaleFactor: 1 }, phone: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'] });
try {
  for (const [vp, viewport] of Object.entries(VIEWPORTS)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const st of STATES) {
      if (vp === 'phone' && ['city-week', 'settings'].includes(st.name)) continue;
      // a fresh document per state, so a typed search or an open card never leaks into the next
      await page.goto('about:blank');
      await page.goto(`${BASE}#${st.hash}`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('#stage .dot', { timeout: 30000 });
      if (st.type) { await page.type('.search input', st.type); }
      await page.waitForFunction(() => !document.querySelector('.veil') || document.querySelector('.veil').classList.contains('off'));
      await new Promise((r) => setTimeout(r, st.type ? 800 : 1800));
      const file = resolve(OUT, `${vp}-${st.name}.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
    if (errors.length) console.log(`${vp}: ${errors.length} console errors:\n  ${[...new Set(errors)].slice(0, 10).join('\n  ')}`);
    await page.close();
  }
} finally {
  await browser.close();
}
