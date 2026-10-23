// Service worker. The build stamps VERSION (vite.config.js), so every deploy installs a new worker
// and a returning reader gets the new app instead of the first shell forever (audit 2026-10-21).
// - Pages (navigations): network first with a 3 s timeout, the cached shell when offline or when the
//   server answers an error (a 404, a 5xx).
// - Hashed assets: cache first (their names change when they change).
// - Boot data (geometry, meta, stores, catalogue, index, visits): network first with a timeout,
//   in a cache that is never trimmed, so an offline start always works.
// - Per-product and per-store files: network first with a timeout, in a small LRU cache.
// - Install precaches the hashed assets and the boot data, so a first visit can start offline; the
//   shell all or nothing, so a failed install leaves the previous worker and its complete shell.
// GitHub Pages answers every file with "Cache-Control: max-age=600", so for 10 minutes after a visit a
// plain fetch() is answered by the browser's HTTP cache, with the previous deploy's index.html if that
// is what it holds. Install, navigations and the boot data therefore fetch with cache: 'no-cache' (a
// conditional request: a 304 within one deploy, a full download after any deploy, since Pages changes
// every ETag at each deploy). Without it, a deploy's worker precached and served the old index.html,
// whose assets its activate step had just deleted: a blank page online for up to 10 minutes, and
// offline until the next online visit (measured 2026-10-22); and the new page read the previous
// deploy's boot data.
const VERSION = '__BUILD__';
// the build replaces this with the hashed assets and the boot data (vite.config.js)
const PRECACHE = /*__PRECACHE__*/ { shell: [], boot: [] };
const SHELL = `acomo-shell-${VERSION}`;
const BOOT = 'acomo-boot';
const DATA = 'acomo-data';
const DATA_MAX = 300;
// this worker's own path (/a-como/): BOOT and DATA are shared by name with any other address the app
// was served from (/compa-precio/ until 2026-10-22), so their entries are told apart by path
const SCOPE = new URL('./', self.location.href).pathname;
const TIMEOUT = 3000;

// 'no-cache' asks the server, never the HTTP cache's copy alone (see above)
const fresh = (u) => new Request(u, { cache: 'no-cache' });
// the shell is all or nothing: one failed file (a dropped connection) fails the install, and the
// previous worker stays with its complete shell (with a per-file catch, the new worker activated on a
// partial shell and deleted the complete one: a blank offline start)
const addShell = () => caches.open(SHELL).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg', ...PRECACHE.shell].map(fresh)));
// the boot data are shared and overwritten in place: one failed file keeps its previous copy and must
// not cost the others theirs, so each is added on its own
const addEach = (name, urls) => caches.open(name).then((c) => Promise.all(urls.map((u) => c.add(fresh(u)).catch(() => {}))));
self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([addShell(), addEach(BOOT, PRECACHE.boot)]));
  self.skipWaiting();
});

// the names the first deploys of 2026-10-21 used, superseded by BOOT and DATA
const RETIRED = ['acomo-v1', 'acomo-data-v1'];
// only this app's own superseded caches: the origin vdm285.github.io is shared with the owner's other apps (Papelito), whose offline copies every deploy used to wipe
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith('acomo-shell-') && k !== SHELL) || RETIRED.includes(k)).map((k) => caches.delete(k))))
    // and the entries another address left in the shared BOOT and DATA (the old address's boot data is 2.6 MB)
    .then(() => Promise.all([BOOT, DATA].map(async (name) => {
      if (!(await caches.has(name))) return;
      const c = await caches.open(name);
      for (const req of await c.keys()) if (!new URL(req.url).pathname.startsWith(SCOPE)) await c.delete(req);
    })))
    .then(() => self.clients.claim()));
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// one trim at a time, oldest first; a hit re-puts the entry so it counts as recent
let trimming = Promise.resolve();
function trim() {
  trimming = trimming.then(async () => {
    const c = await caches.open(DATA);
    const keys = await c.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - DATA_MAX))) await c.delete(k);
  }).catch(() => {});
  return trimming;
}

// revalidate: ask the server ('no-cache'), so the boot data come from the same deploy as the page
async function networkFirst(req, cacheName, { lru = false, revalidate = false } = {}) {
  const c = await caches.open(cacheName);
  try {
    const res = await withTimeout(revalidate ? fetch(req, { cache: 'no-cache' }) : fetch(req), TIMEOUT);
    if (res.ok) { await c.put(req, res.clone()); if (lru) trim(); }
    return res;
  } catch {
    const hit = await c.match(req);
    if (hit) { if (lru) { await c.delete(req); await c.put(req, hit.clone()); } return hit; }
    // no network and no copy: say so, so the app does not mistake it for missing data
    return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json', 'X-Acomo-Offline': '1' } });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = url.pathname;
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      try {
        // 'no-cache': a page served online is always the deployed one (see above)
        const res = await withTimeout(fetch(req, { cache: 'no-cache' }), TIMEOUT);
        // only a page is the shell: a JSON file opened in a tab must not take its place
        if (res.ok && /^text\/html/i.test(res.headers.get('Content-Type') || '')) c.put('./', res.clone());
        // an error page (a 404, Pages down with a 5xx) is not the app: the cached shell is, if there is one
        if (res.status >= 400) return (await c.match('./')) || res;
        return res;
      } catch {
        return (await c.match('./')) || Response.error();
      }
    })());
    return;
  }
  if (p.includes('/data/qqp/products/') || p.includes('/data/qqp/stores/')) { e.respondWith(networkFirst(req, DATA, { lru: true })); return; }
  if (p.includes('/data/')) { e.respondWith(networkFirst(req, BOOT, { revalidate: true })); return; }
  if (p.includes('/assets/')) {
    e.respondWith((async () => {
      const c = await caches.open(SHELL);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
});
