// Service worker minimal : installabilité + page hors ligne.
// Il ne met en cache ni les pages, ni les API, ni les actions serveur : les données changent
// en permanence, et un cache obsolète serait trompeur. La résistance hors ligne des pointages
// vit dans la file d'attente locale de l'application (src/lib/offline-queue.ts).

const CACHE_NAME = "manguifi-shell-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
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

  // Réseau d'abord. La page hors ligne ne remplace que la navigation (ouverture ou
  // rechargement d'une page). Un script ou une feuille de style manquant reste une erreur.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
