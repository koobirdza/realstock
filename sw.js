const CACHE_NAME = "realstock-v49-5-static";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/config.v49.js",
  "./src/utils.v49.js",
  "./src/store.v49.js",
  "./src/state.v49.js",
  "./src/auth.v49.js",
  "./src/api.v49.js",
  "./src/catalog.v49.js",
  "./src/inventory.v49.js",
  "./src/ui.v49.js",
  "./src/app.v49.js"
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
