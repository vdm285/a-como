// Service worker: the app shell and the geometry are cached on install (offline start);
// price data is network-first with the last copy as fallback, capped so the cache never
// grows without bound. Versioned by the build: Vite replaces nothing here, so bump CACHE
// when the caching rules change; hashed asset names change by themselves.
const CACHE = 'acomo-v1';
const DATA = 'acomo-data-v1';
const DATA_MAX = 400; // product files kept at most

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './favicon.svg']).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![CACHE, DATA].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length <= max) return;
  for (const k of keys.slice(0, keys.length - max)) await c.delete(k);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isData = url.pathname.includes('/data/qqp/');
  if (isData) {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try {
        const res = await fetch(req);
        if (res.ok) { c.put(req, res.clone()); trim(DATA, DATA_MAX); }
        return res;
      } catch {
        const hit = await c.match(req);
        return hit || new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }
  // app shell, assets, geometry: cache first, then network (and keep it)
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/data/geo/') || req.mode === 'navigate')) c.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') { const shell = await c.match('./'); if (shell) return shell; }
      throw new Error('offline');
    }
  })());
});
