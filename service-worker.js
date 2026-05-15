const VA_CACHE = "vida-abundante-clean-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// ✅ Mientras probamos, no interceptamos nada.
// Todo se carga directo desde GitHub Pages.
self.addEventListener("fetch", (event) => {
  return;
});
