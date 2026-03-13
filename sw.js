const CACHE_VERSION = 'realstock-v51-4-7';
const APP_SHELL = [
  './',
  './index.html?v=51.4.7',
  './manifest.json?v=51.4.7',
  './pwa-register.js?v=51.4.7',
  './icons/favicon-32.png?v=51.4.7',
  './icons/icon-192.png?v=51.4.7',
  './icons/icon-512.png?v=51.4.7',
  './icons/icon-512-maskable.png?v=51.4.7',
  './icons/apple-touch-icon.png?v=51.4.7',
  './src/app.v51.js?v=51.4.7',
  './src/api.v51.js?v=51.4.7',
  './src/auth.v51.js?v=51.4.7',
  './src/catalog.v51.js?v=51.4.7',
  './src/config.v51.js?v=51.4.7',
  './src/inventory.v51.js?v=51.4.7',
  './src/state.v51.js?v=51.4.7',
  './src/store.v51.js?v=51.4.7',
  './src/ui.v51.js?v=51.4.7',
  './src/utils.v51.js?v=51.4.7'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
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

  const isDocument = event.request.mode === 'navigate' || event.request.destination === 'document';
  const isDynamicShell = ['script', 'style', 'manifest'].includes(event.request.destination) || url.pathname.endsWith('/manifest.json') || url.pathname.endsWith('/pwa-register.js') || url.pathname.endsWith('/index.html');

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);

    if (isDocument || isDynamicShell) {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        if (fresh && fresh.status === 200) cache.put(event.request, fresh.clone()).catch(() => {});
        return fresh;
      } catch (err) {
        const fallback = await cache.match(event.request, { ignoreSearch: true });
        return fallback || Response.error();
      }
    }

    const cached = await cache.match(event.request, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const response = await fetch(event.request);
      if (response && response.status === 200 && response.type === 'basic') {
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
