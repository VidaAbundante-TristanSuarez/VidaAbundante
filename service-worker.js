const VA_CACHE = "vida-abundante-pwa-v3";

const APP_SHELL = [
  "/VidaAbundante/",
  "/VidaAbundante/index.html",

  "/VidaAbundante/manifest.webmanifest",

  "/VidaAbundante/styles.css",
  "/VidaAbundante/devocionales.css",
  "/VidaAbundante/subidos.css",
  "/VidaAbundante/compartidos.css",
  "/VidaAbundante/materiales/ediciones.css",

  "/VidaAbundante/biblia.js",
  "/VidaAbundante/biblia.audio.js",
  "/VidaAbundante/biblia.tts.js",
  "/VidaAbundante/devocionales.js",
  "/VidaAbundante/Subidos.js",
  "/VidaAbundante/ABC/abc.js",
  "/VidaAbundante/materiales/Recursos.js",
  "/VidaAbundante/materiales/Ediciones.js",
  "/VidaAbundante/Compartidos.js",
  "/VidaAbundante/carga-imagenes.js",
  "/VidaAbundante/publicaciones-imagen.js",
  "/VidaAbundante/exportacion-imagen.js",
  "/VidaAbundante/imagen-editor.js",
  "/VidaAbundante/texturas-editor.js",
  "/VidaAbundante/adornos-editor.js",

  "/VidaAbundante/img/app/icon-192.png",
  "/VidaAbundante/img/app/icon-512.png",
  "/VidaAbundante/img/app/preview-whatsapp.jpg"
];

function esRequestValida(request) {
  if (!request || request.method !== "GET") return false;

  const url = new URL(request.url);

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  return true;
}

function esFirebaseODinamico(url) {
  const host = url.hostname;

  return (
    host.includes("firebaseio.com") ||
    host.includes("identitytoolkit.googleapis.com") ||
    host.includes("securetoken.googleapis.com") ||
    host.includes("firebasedatabase.app") ||
    host.includes("firebasestorage.googleapis.com")
  );
}

function esDocumento(request) {
  return request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");
}

function esEstatico(url) {
  const path = url.pathname.toLowerCase();

  return (
    url.origin === self.location.origin && path.startsWith("/vidaabundante/") &&
    (
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".png") ||
      path.endsWith(".jpg") ||
      path.endsWith(".jpeg") ||
      path.endsWith(".webp") ||
      path.endsWith(".svg") ||
      path.endsWith(".ico") ||
      path.endsWith(".json") ||
      path.endsWith(".webmanifest")
    )
  );
}

function esCDNCacheable(url) {
  const host = url.hostname;

  return (
    host.includes("cdn.jsdelivr.net") ||
    host.includes("cdnjs.cloudflare.com") ||
    host.includes("fonts.googleapis.com") ||
    host.includes("fonts.gstatic.com") ||
    host.includes("gstatic.com")
  );
}

async function ponerEnCache(request, response) {
  try {
    if (!response || !response.ok) return;

    const cache = await caches.open(VA_CACHE);
    await cache.put(request, response.clone());
  } catch (e) {
    // No rompemos la app si el cache falla.
  }
}

async function networkFirst(request, event) {
  const cache = await caches.open(VA_CACHE);

  try {
    const preload = event?.preloadResponse ? await event.preloadResponse : null;

    if (preload) {
      await ponerEnCache(request, preload.clone());
      return preload;
    }

    const fresh = await fetch(request);
    await ponerEnCache(request, fresh.clone());
    return fresh;

  } catch (e) {
    const cached =
      await cache.match(request) ||
      await cache.match("/VidaAbundante/index.html") ||
      await cache.match("/VidaAbundante/");

    if (cached) return cached;

    throw e;
  }
}

async function staleWhileRevalidate(request,event) {
  const cache = await caches.open(VA_CACHE);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        await ponerEnCache(request,response);
      }

      return response;
    })
    .catch(() => cached || Response.error());

  if(cached)event?.waitUntil(update.then(()=>{}));
  return cached || update;
}

async function cacheFirst(request) {
  const cache = await caches.open(VA_CACHE);
  const cached = await cache.match(request);

  if (cached) return cached;

  const fresh = await fetch(request);
  await ponerEnCache(request, fresh.clone());
  return fresh;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(VA_CACHE).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response && response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (e) {}
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key => key.startsWith('vida-abundante-') && key !== VA_CACHE)
          .map(key => caches.delete(key))
      );

      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch (e) {}
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (!esRequestValida(request)) return;

  const url = new URL(request.url);

  // Firebase/Auth/DB siempre red. No cacheamos datos vivos.
  if (esFirebaseODinamico(url)) return;

  // HTML: red primero, cache solo si no hay conexión.
  if (esDocumento(request)) {
    event.respondWith(networkFirst(request, event));
    return;
  }

  // Archivos principales de la app: abrir rápido con cache y actualizar atrás.
  if (esEstatico(url)) {
    event.respondWith(staleWhileRevalidate(request,event));
    return;
  }

  // CDN de iconos/fuentes/librerías: cache primero.
  if (esCDNCacheable(url)) {
    event.respondWith(cacheFirst(request).catch(()=>Response.error()));
    return;
  }

  // Los archivos de otros servicios siguen la red normal del navegador.
  // No devolver undefined si falla una imagen o un audio remoto.
});
