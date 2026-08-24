// Minimal service worker — its only job is to satisfy the installability
// requirement (Chrome/Android needs a registered SW with a fetch handler)
// and give the app an offline-safe fallback shell. It deliberately does
// NOT cache pages, API routes, or server actions: this app's data changes
// constantly (attendance, dashboards) and a stale cache would be actively
// misleading. Actual offline resilience for pointage lives in the app's
// own localStorage queue (see src/lib/offline-queue.ts), not here.

const CACHE_NAME = "manguifi-shell-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  // Network-first: always try the live page/data, only fall back to the
  // cached shell if the network is genuinely unreachable (real offline).
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});
