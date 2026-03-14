const CACHE_VERSION = 'realstock-v51-5-0';
const APP_SHELL = [
  './',
  './index.html?v=51.5.0',
  './manifest.json?v=51.5.0',
  './pwa-register.js?v=51.5.0',
  './src/app.v51.js?v=51.5.0',
  './src/api.v51.js',
  './src/auth.v51.js',
  './src/catalog.v51.js',
  './src/config.v51.js',
  './src/inventory.v51.js',
  './src/state.v51.js',
  './src/store.v51.js',
  './src/ui.v51.js',
  './src/utils.v51.js',
  './icons/icon-192.png?v=51.5.0',
  './icons/icon-512.png?v=51.5.0',
  './icons/icon-512-maskable.png?v=51.5.0',
  './icons/apple-touch-icon.png?v=51.5.0'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const isPageLike = event.request.mode === 'navigate' || /\.(html|js|json)$/.test(url.pathname);
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    if (isPageLike) {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh && fresh.status === 200) cache.put(event.request, fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
      }
    }
    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;
    const fresh = await fetch(event.request);
    if (fresh && fresh.status === 200) cache.put(event.request, fresh.clone()).catch(() => {});
    return fresh;
  })());
});
