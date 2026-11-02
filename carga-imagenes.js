const WORKER = 'https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev';
const blobs = new Map(), pendientes = new Map();
const MAX_CACHE = 24 * 1024 * 1024;
let bytesCache = 0;

export function normalizarUrlImagen(valor = '') {
  let url = String(valor || '').trim();
  if (!url) return '';
  if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(url)) url = 'https://' + url.replace(/^(?:\.\/|\/)+/, '');
  try {
    const u = new URL(url, location.href);
    return ['http:', 'https:', 'blob:', 'data:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}

export function proxyImagen(url, nombre = 'imagen.png') {
  const original = normalizarUrlImagen(url);
  if (!original || /^(blob:|data:)/.test(original)) return original;
  const u = new URL(original), worker = new URL(WORKER);
  if (u.origin === worker.origin) return original;
  worker.searchParams.set('url', original);
  worker.searchParams.set('nombre', nombre);
  worker.searchParams.set('descargar', '0');
  return worker.href;
}

async function leerBlob(url, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw new Error('No se pudo leer la imagen (' + response.status + ').');
    const blob = await response.blob();
    if (!blob.size || (/^(text\/html|application\/json)/i.test(blob.type))) throw new Error('La respuesta no contiene una imagen.');
    return blob;
  } finally { clearTimeout(timer); }
}

// Reutiliza el original: no comprime ni cambia la calidad de las exportaciones.
export function obtenerBlobImagen(valor, nombre = 'imagen.png') {
  const url = normalizarUrlImagen(valor);
  if (!url) return Promise.reject(new Error('No hay imagen para preparar.'));
  if (blobs.has(url)) {
    const blob = blobs.get(url); blobs.delete(url); blobs.set(url, blob);
    return Promise.resolve(blob);
  }
  if (pendientes.has(url)) return pendientes.get(url);
  const trabajo = (async () => {
    let blob;
    try { blob = await leerBlob(url, 5000); }
    catch (error) {
      const alternativa = proxyImagen(url, nombre);
      if (alternativa === url || /^(blob:|data:)/.test(url)) throw error;
      blob = await leerBlob(alternativa, 15000);
    }
    if (blob.size <= MAX_CACHE) {
      while (blobs.size && bytesCache + blob.size > MAX_CACHE) {
        const key = blobs.keys().next().value;
        bytesCache -= blobs.get(key).size; blobs.delete(key);
      }
      blobs.set(url, blob); bytesCache += blob.size;
    }
    return blob;
  })();
  pendientes.set(url, trabajo);
  trabajo.finally(() => pendientes.delete(url)).catch(() => {});
  return trabajo;
}

const estados = new WeakMap();
let observador = null;

function prepararImagen(img) {
  if (estados.has(img)) return;
  const original = normalizarUrlImagen(img.getAttribute('src'));
  if (!original) return;
  const host = img.closest('[data-va-imagen-host]') || img.parentElement;
  host?.setAttribute('data-va-imagen-host','');
  const estado = {original, host, timer: null, intento: 0, activa: false, cancelada: false};
  estados.set(img, estado);
  img.decoding = 'async';
  const limpiar = () => {clearTimeout(estado.timer); estado.timer = null;};
  const listo = () => {
    if (!img.naturalWidth) return;
    limpiar(); host?.classList.remove('va-imagen-cargando', 'va-imagen-error');
    host?.querySelector(':scope > .va-imagen-estado')?.remove();
  };
  const mostrar = (error = false) => {
    if (!host) return;
    host.classList.toggle('va-imagen-error', error);
    host.classList.toggle('va-imagen-cargando', !error);
    let aviso = host.querySelector(':scope > .va-imagen-estado');
    if (!aviso) {aviso = document.createElement('span'); aviso.className = 'va-imagen-estado'; host.appendChild(aviso);}
    aviso.textContent = error ? 'No se pudo cargar. Tocá para reintentar.' : 'Cargando imagen…';
  };
  const fallar = () => {limpiar(); mostrar(true);};
  const respaldo = () => {
    limpiar();
    if (estado.cancelada || !img.isConnected) return;
    const proxy = proxyImagen(original);
    if (estado.intento || proxy === original || /^(blob:|data:)/.test(original)) {fallar(); return;}
    estado.intento = 1; img.src = proxy;
    estado.timer = setTimeout(fallar, 15000);
  };
  estado.iniciar = () => {
    if (estado.cancelada || !img.isConnected) return;
    if (img.complete && img.naturalWidth) {listo(); return;}
    estado.activa = true; mostrar();
    if (img.complete && !img.naturalWidth) respaldo();
    else estado.timer = setTimeout(respaldo, 6500);
  };
  estado.cancelar = () => {estado.cancelada = true; limpiar(); observador?.unobserve(img);};
  img.addEventListener('load', listo);
  img.addEventListener('error', () => {if (estado.activa) respaldo();});
  host?.addEventListener('click', e => {
    if (!host.classList.contains('va-imagen-error')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    estado.intento = 0; img.src = original; estado.iniciar();
  }, true);
  if (img.complete && img.naturalWidth) listo();
  else if (img.loading === 'lazy' && 'IntersectionObserver' in window) {
    observador ||= new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {observador.unobserve(entry.target); estados.get(entry.target)?.iniciar();}
    }, {rootMargin: '120px'});
    observador.observe(img);
  } else estado.iniciar();
}

export function prepararCargaImagenes(root = document) {
  if (root.matches?.('img[data-va-imagen]')) prepararImagen(root);
  for (const img of root.querySelectorAll?.('img[data-va-imagen]') || []) prepararImagen(img);
}

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '[data-va-imagen-host]{position:relative}.va-imagen-estado{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;background:#eaf3f9;color:#3c6079;font:13px/1.4 Arial,sans-serif;pointer-events:none}.va-imagen-error{cursor:pointer}';
  document.head.appendChild(style);
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) if (node.nodeType === 1) prepararCargaImagenes(node);
      for (const node of record.removedNodes) if (node.nodeType === 1) {
        if (node.matches?.('img[data-va-imagen]')) estados.get(node)?.cancelar();
        for (const img of node.querySelectorAll?.('img[data-va-imagen]') || []) estados.get(img)?.cancelar();
      }
    }
  }).observe(document.documentElement, {childList: true, subtree: true});
  prepararCargaImagenes();
}
