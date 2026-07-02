/* homepage-Kito service worker (M16 v1).
 *
 * Deliberately minimal to avoid stale-cache bugs:
 *  - navigations: network-first, fall back to the cached /offline page when offline
 *  - immutable build assets (/_next/static/*): cache-first (safe — content-hashed)
 *  - everything else (APIs, /api/*, config, dynamic data): always network, never cached
 *
 * Bump CACHE_VERSION to force clients onto a fresh cache; activate() prunes old ones.
 */
const CACHE_VERSION = "kito-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; never interfere with POST/PUT/etc. (logins, config writes).
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Same-origin only; leave cross-origin (icons, CDNs) to the browser.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never cache API/auth/config/dynamic data — always hit the network.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Immutable, content-hashed build assets: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }),
    );
    return;
  }

  // Page navigations: network-first with an offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(CACHE_VERSION);
          const offline = await cache.match(OFFLINE_URL);
          return offline ?? Response.error();
        }
      })(),
    );
  }
});
