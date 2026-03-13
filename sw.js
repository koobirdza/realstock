const CACHE_VERSION = 'realstock-v51-4-3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pwa-register.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './src/app.v51.js',
  './src/api.v51.js',
  './src/auth.v51.js',
  './src/catalog.v51.js',
  './src/config.v51.js',
  './src/inventory.v51.js',
  './src/state.v51.js',
  './src/store.v51.js',
  './src/ui.v51.js',
  './src/utils.v51.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const networkPromise = fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      })
      .catch(() => cached);

    return cached || networkPromise;
  })());
});
