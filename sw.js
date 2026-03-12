const CACHE_NAME = 'realstock-v47-static-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './src/config.v47.js',
  './src/app.v47.js',
  './src/ui.v47.js',
  './src/api.v47.js',
  './src/auth.v47.js',
  './src/state.v47.js',
  './src/catalog.v47.js',
  './src/inventory.v47.js',
  './src/store.v47.js',
  './src/utils.v47.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        event.waitUntil(fetch(event.request).then((res) => {
          if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
        }).catch(() => {}));
        return cached;
      }
      return fetch(event.request).then((res) => {
        if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res.clone()));
        return res;
      });
    })
  );
});
