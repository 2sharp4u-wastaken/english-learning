/* Service worker for the English Learning PWA (Slice INFRA1).
 *
 * Strategy (hand-rolled, no Workbox — the build is custom: publicDir:false + a
 * copy plugin, which the auto-discovery plugins fight):
 *   - navigation requests  → network-first, fall back to the cached app shell
 *     so the SPA still loads offline (and online always gets fresh HTML).
 *   - same-origin GETs (hashed JS/CSS, data/*.json, img/, legacy scripts, the
 *     self-hosted confetti vendor) → stale-while-revalidate: instant from cache,
 *     refreshed in the background. So the app works offline after one online visit.
 *   - cross-origin (e.g. the optional Dicta nikud API) → untouched / network only.
 *
 * Bump CACHE_VERSION to invalidate the whole cache on a breaking change. The
 * `activate` handler deletes every cache that isn't the current one.
 */
const CACHE_VERSION = 'v2';
const CACHE = `elg-${CACHE_VERSION}`;
const SHELL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(SHELL)).catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin to the network

  // App shell / navigations: network-first so updates land, cache as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(SHELL, fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match(SHELL);
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })(),
  );
});
