const VERSION = "v12";
const CACHE_NAME = `realstock-${VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  event.respondWith((async () => {
    try {
      return await fetch(req, { cache: "no-store" });
    } catch (error) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw error;
    }
  })());
});
