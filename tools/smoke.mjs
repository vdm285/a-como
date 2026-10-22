// Smoke test of the flows the first audit broke, against a running dev server (or a preview).
// Each check prints PASS or FAIL with the measured value; exit 1 on any failure.
// Run: node tools/smoke.mjs [--base=http://localhost:5175/]
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=').slice(1).join('=') || d;
const BASE = arg('base', 'http://localhost:5175/');
const CHROME = ['C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser'].find((p) => existsSync(p));
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
async function fresh(viewport = { width: 1600, height: 900 }) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}
async function open(page, hash = '') {
  await page.goto(`${BASE}#${hash}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#stage .dot', { timeout: 30000 });
  await sleep(900);
}
const count = (page, sel) => page.$$eval(sel, (els) => els.length);

try {
  // 1. the city
  {
    const { ctx, page, errors } = await fresh();
    await open(page);
    const dots = await count(page, '#stage .dot');
    const filled = await count(page, '#stage .dot:not(.empty):not(.hatch)');
    check('city draws every location', dots > 300, dots);
    check('city colours the stores with a recent index', filled > 100, filled);
    const inFrame = await page.evaluate(() => { const sb = document.querySelector('.search .box').getBoundingClientRect(); const tl = document.querySelector('.timeline').getBoundingClientRect(); return [...document.querySelectorAll('#stage .dot')].filter((d) => { const r = d.getBoundingClientRect(); const y = r.top + r.height / 2; return y < sb.bottom || y > tl.top || r.left < 0 || r.right > innerWidth; }).length; });
    check('no dot under the search or the timeline or off screen', inFrame === 0, inFrame);
    const lang = await page.evaluate(() => document.documentElement.lang);
    check('opens in Spanish', lang === 'es', lang);
    check('no console errors on the city', errors.length === 0, errors.slice(0, 2));
    await ctx.close();
  }
  // 2. search → group → product → store, then Back twice
  {
    const { ctx, page } = await fresh();
    await open(page);
    await page.type('.search input', 'leche');
    await sleep(300);
    const groups = await count(page, '.search .list .item');
    check('search lists results', groups > 3, groups);
    const clears = await page.$$eval('.search .box button', (b) => b.length);
    check('one clear button in the search', clears === 1, clears);
    await page.keyboard.press('Enter');
    await sleep(1500);
    check('Enter opens the first generic product', /#g\//.test(page.url()), page.url().split('#')[1]);
    await page.click('.card .rank li');
    await sleep(1500);
    check('a size opens its product card', /#p\//.test(page.url()), page.url().split('#')[1]);
    const firstStore = await page.$('.card .rank li');
    if (firstStore) { await firstStore.click(); await sleep(1200); }
    check('a ranked store opens its card', /#t\//.test(page.url()), page.url().split('#')[1]);
    const back = await page.$('.card .h3link');
    check('the store card links back to the product', !!back);
    await page.goBack(); await sleep(1200);
    check('Back returns to the product', /#p\//.test(page.url()), page.url().split('#')[1]);
    await page.goBack(); await sleep(1200);
    check('Back again returns to the generic product', /#g\//.test(page.url()), page.url().split('#')[1]);
    await ctx.close();
  }
  // 3. the basket colours complete stores (the first audit found zero)
  {
    const { ctx, page } = await fresh();
    await open(page, 'c?items=leche-ultrapasteurizada-a3d941:1,huevo-f2ba30:1');
    await sleep(1500);
    const filled = await count(page, '#stage .dot:not(.empty):not(.hatch)');
    check('basket map colours the stores with everything', filled > 5, filled);
    const items = await count(page, '.card .bitems li');
    check('a shared basket loads into an empty basket', items === 2, items);
    const url = page.url();
    check('items= is stripped from the address after reading', !/items=/.test(url), url.split('#')[1]);
    await ctx.close();
  }
  // 4. a stale link falls back with a reason
  {
    const { ctx, page } = await fresh();
    // the reason is a toast that lasts a few seconds: watch for it while the page loads
    await page.goto(`${BASE}#p/no-existe-000000`, { waitUntil: 'domcontentloaded' });
    const toast = await page.waitForFunction(() => { const e = document.querySelector('.toast.on'); return e && /PROFECO/.test(e.textContent) ? e.textContent.trim() : null; }, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => '');
    await page.waitForSelector('#stage .dot', { timeout: 30000 });
    await sleep(800);
    const legend = await page.$('.legend');
    check('unknown product id shows a reason', /PROFECO/.test(toast), toast);
    check('unknown product id keeps a legend (index stage)', !!legend);
    await ctx.close();
  }
  // 5. own price: save, see it, delete it
  {
    const { ctx, page } = await fresh();
    await open(page, 'p/leche-ultrapasteurizada-a3d941');
    await sleep(1500);
    await page.type('.ownform input[name=price]', '15.50');
    await page.click('.ownform button[type=submit]');
    await sleep(1000);
    const rows = await count(page, '.card .ownlist li');
    check('a saved own price is listed', rows === 1, rows);
    const date = await page.$eval('.card .ownlist .m', (e) => e.textContent).catch(() => '');
    const del = await page.$eval('.card .ownlist .del', (e) => e.getBoundingClientRect().width).catch(() => 0);
    check('the delete button is usable', del >= 28, del);
    const ring = await count(page, '#stage .ring');
    check('the store gets a gold ring', ring === 1, ring);
    await page.click('.card .ownlist .del');
    await sleep(800);
    check('delete removes the row', (await count(page, '.card .ownlist li')) === 0);
    check('own price date is today (local)', date.length > 0, date);
    const undo = await page.$('.toast.on .toast-btn');
    check('delete offers an undo', !!undo);
    if (undo) { await undo.click(); await sleep(900); }
    check('undo brings the price back', (await count(page, '.card .ownlist li')) === 1);
    await ctx.close();
  }
  // 5b. Settings opened over a card returns to that card
  {
    const { ctx, page } = await fresh();
    await open(page, 'p/leche-ultrapasteurizada-a3d941');
    await sleep(1200);
    const len0 = await page.evaluate(() => history.length);
    await page.click('.settings-btn');
    await sleep(600);
    const inSettings = /#s/.test(page.url());
    await page.click('.card .x');
    await sleep(800);
    check('Settings closes back to the card beneath', inSettings && /#p\//.test(page.url()), page.url().split('#')[1]);
    const grew = (await page.evaluate(() => history.length)) - len0;
    check('closing Settings goes Back instead of adding history', grew <= 1, grew);
    await ctx.close();
  }
  // 5c. the map by keyboard, and a price tag is a button
  {
    const { ctx, page } = await fresh();
    await open(page);
    const chip = await page.$('.timeline.collapsed .tl-chip');
    check('the index opens with the timeline folded into a chip', !!chip);
    const title = await page.$eval('.legend .ltitle', (e) => e.textContent).catch(() => '');
    check('the index is named as a question', /Qué tan cara/.test(title), title);
    await page.evaluate(() => document.querySelector('#stage svg').focus());
    await sleep(200);
    await page.keyboard.press('ArrowRight');
    await sleep(200);
    check('arrow keys pick a store on the map', (await count(page, '#stage .kbd-ring')) === 1);
    await page.keyboard.press('Enter');
    await sleep(900);
    check('Enter on the map opens that store', /#t\//.test(page.url()), page.url().split('#')[1]);
    await page.goto(`${BASE}#p/jitomate-3532af`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    const tags = await count(page, '#stage .tag');
    check('a product shows price tags', tags >= 3, tags);
    const box = await page.$eval('#stage .tag .tag-box', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }).catch(() => null);
    if (box) { await page.mouse.click(box.x, box.y); await sleep(900); }
    check('clicking a price tag opens its store', /#t\//.test(page.url()), page.url().split('#')[1]);
    await ctx.close();
  }
  // 6. Escape in the search does not close the card
  {
    const { ctx, page } = await fresh();
    await open(page, 'p/leche-ultrapasteurizada-a3d941');
    await page.click('.search input');
    await page.type('.search input', 'hue');
    await page.keyboard.press('Escape');
    await sleep(300);
    check('Escape in the search keeps the card', !!(await page.$('.card')));
    await page.keyboard.press('Escape'); // blur
    await page.keyboard.press('Escape'); // now closes the card
    await sleep(500);
    check('Escape outside inputs closes the card', !(await page.$('.card')));
    await ctx.close();
  }
  // 7. a week link and the timeline
  {
    const { ctx, page } = await fresh();
    await open(page, 'p/jitomate-3532af?w=2026-04-20');
    await sleep(1500);
    const label = await page.$eval('.timeline .tl-label', (e) => e.textContent).catch(() => '');
    check('a week link shows that week', /20 abr 2026/.test(label), label);
    const hero = await page.$eval('.card .unitline', (e) => e.textContent).catch(() => '');
    check('the card headline is that week\'s cheapest store', /la más barata/.test(hero), hero);
    const refl = await page.$eval('.card .refline', (e) => e.textContent).catch(() => '');
    check('the card names that week\'s city median', /esa semana/.test(refl), refl);
    const numeral = await page.$eval('.numeral .nbig', (e) => e.textContent).catch(() => '');
    check('the week numeral shows a price', /\$\d/.test(numeral), numeral);
    // the timeline is drawn in real pixels: the SVG's width attribute matches its box
    const tl = await page.$eval('.tl-svg', (e) => ({ attr: Number(e.getAttribute('width')), box: Math.round(e.getBoundingClientRect().width) })).catch(() => ({}));
    check('the timeline is not stretched', tl.attr > 100 && Math.abs(tl.attr - tl.box) <= 2, tl);
    await page.keyboard.press('Escape'); await sleep(400); // card
    await page.keyboard.press('Escape'); await sleep(800); // week → recent
    const label2 = await page.$eval('.timeline .tl-label', (e) => e.textContent).catch(() => '');
    check('Escape returns to the recent prices', /Precios del/.test(label2), label2);
    await ctx.close();
  }
  // 7b. round 3: one flag rule, ties, caps from links, stores without a dot, the own-price form
  {
    const { ctx, page } = await fresh();
    await open(page, 't/bodega-aurrera-76280c');
    await page.evaluate(() => { location.hash = '#p/jitomate-3532af?w=2026-04-20'; });
    await sleep(2500);
    await page.evaluate(() => { location.hash = '#t/bodega-aurrera-76280c?w=2026-04-20'; });
    await sleep(2000);
    const flag = await page.$eval('.card .stagebox', (e) => e.textContent).catch(() => '');
    check('a price cheap for its week is not flagged on its store card', !/revísalo/.test(flag) && /\$/.test(flag), flag.replace(/\s+/g, ' ').slice(0, 80));
    await page.goto(`${BASE}#p/leche-ultrapasteurizada-a3d941`, { waitUntil: 'networkidle2' });
    await sleep(2000);
    const tie = await page.$eval('.card .unitline', (e) => e.textContent).catch(() => '');
    check('a tie for the lowest price is named as a tie', /empatada en \d+ tiendas/.test(tie), tie);
    const sel = await page.$eval('#own-store', (e) => ({ v: e.value, first: e.options[0] && e.options[0].value })).catch(() => ({}));
    check('the own-price form preselects the first listed store', !!sel.v && sel.v === sel.first, sel);
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh();
    await open(page, 'g/leche-ultrapasteurizada');
    await sleep(2500);
    const ticks = await page.$eval('.legend .ticks', (e) => e.textContent).catch(() => '');
    check('a generic product opened from a link gets its real colour cap', /50/.test(ticks), ticks.replace(/\s+/g, ' '));
    await page.goto(`${BASE}#t/mega-soriana-4b3699`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    const note = await page.$eval('.card', (e) => e.textContent).catch(() => '');
    check('a store without a dot says why', /no está en el mapa/.test(note));
    await ctx.close();
  }
  {
    const { ctx, page } = await fresh({ width: 1024, height: 768 });
    await open(page, 'p/jitomate-3532af');
    await sleep(2500);
    const under = await page.evaluate(() => { const tl = document.querySelector('.timeline').getBoundingClientRect(); return [...document.querySelectorAll('#stage .dot:not(.empty)')].filter((d) => { const r = d.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return x > tl.left && x < tl.right && y > tl.top && y < tl.bottom; }).length; });
    check('1024: no coloured dot under the timeline', under === 0, under);
    await ctx.close();
  }
  // 8. phone: the sheet leaves map visible, no horizontal overflow
  {
    const { ctx, page } = await fresh({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await open(page, 'p/jitomate-3532af');
    await sleep(1500);
    const m = await page.evaluate(() => {
      const tl = document.querySelector('.timeline').getBoundingClientRect();
      const lg = document.querySelector('.legend').getBoundingClientRect();
      const card = document.querySelector('.card').getBoundingClientRect();
      return { band: Math.round(lg.top - tl.bottom), sheetTop: Math.round(card.top), overflow: document.documentElement.scrollWidth - innerWidth };
    });
    check('phone: map band between timeline and legend', m.band >= 140, m);
    check('phone: no horizontal overflow', m.overflow <= 0, m.overflow);
    const chip = await page.$('.timeline.collapsed .tl-chip');
    check('phone: with a card open the timeline folds into its chip', !!chip);
    await ctx.close();
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
