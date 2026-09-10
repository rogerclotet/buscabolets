/* Build replaces these tokens with the exact version and assets of this release. */
const CACHE = "buscabolets-__BUILD_ID__";
const ASSETS = __ASSETS__;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  // Keep the current release until the player accepts an update or closes all tabs.
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("buscabolets-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Navigation stays with the cached release, so its HTML and chunks always agree.
  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      caches
        .open(CACHE)
        .then(async (cache) => (await cache.match("/")) || fetch(request)),
    );
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(
          async (cache) => (await cache.match(url.pathname)) || fetch(request),
        ),
    );
  }
});
