const VERSION = "v21";
const STATIC_CACHE = `realstock-static-${VERSION}`;
const APP_SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => null));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key)));
    if ("navigationPreload" in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

function isSameOrigin(url){
  try { return new URL(url).origin === self.location.origin; } catch (e) { return false; }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;
  // Let Google Script, fonts, and other cross-origin requests go straight to network
  if (!isSameOrigin(url)) return;

  const accept = req.headers.get("accept") || "";
  const isDocument = req.mode === "navigate" || accept.includes("text/html");
  const isStaticAsset = ["script", "style", "image", "font"].includes(req.destination);

  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);

    if (isDocument) {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          cache.put(req, preload.clone());
          return preload;
        }
        const fresh = await fetch(req, { cache: "no-store" });
        cache.put(req, fresh.clone());
        return fresh;
      } catch (error) {
        const cached = await cache.match(req) || await cache.match("./index.html");
        if (cached) return cached;
        throw error;
      }
    }

    if (isStaticAsset) {
      const cached = await cache.match(req);
      const networkPromise = fetch(req, { cache: "no-store" }).then((res) => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || networkPromise || fetch(req);
    }

    return fetch(req, { cache: "no-store" });
  })());
});
