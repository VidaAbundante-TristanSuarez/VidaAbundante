const VA_CACHE = "vida-abundante-app-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(VA_CACHE).then((cache) => {
return cache.addAll([
  "/VidaAbundante/",
  "/VidaAbundante/index.html",
  "/VidaAbundante/manifest.webmanifest",
  "/VidaAbundante/img/app/icon-192.png",
  "/VidaAbundante/img/app/icon-512.png",
  "/VidaAbundante/img/app/preview-whatsapp.png"
]);
    }).catch(() => null)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== VA_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
