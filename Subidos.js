// ================= SUBIDOS.JS =================
const { db } = window.__FB || {};
const FB = window.__FB_API || {};

const {
  ref,
  set,
  onValue,
  push
} = FB;

// ✅ SIN FUNCTIONS para R2 / proxy / video.
// ✅ Todo esto va por Cloudflare Worker.
const R2_WORKER_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

const R2_UPLOAD_URL = R2_WORKER_URL;
const SUBIDOS_VIDEO_UPLOAD_URL = R2_WORKER_URL;
const SUBIDOS_PROXY_URL = R2_WORKER_URL;

const SUBIDOS_EXPORT_BG_URL = "./img/fondos/Tarjetas/1a.png";

console.log("✅ Subidos PRINT FIX cargado", "20260826-PDF-ORDEN-14PT-4");

/*
  ✅ Fondos de prédica:
  Dejamos SOLO TARJETAS.
  Primero intenta leer la carpeta real desde GitHub.
  Si GitHub no responde, usa esta lista fija como respaldo.
*/

const SUBIDOS_TARJETAS_GITHUB_API =
  "https://api.github.com/repos/VidaAbundante-TristanSuarez/VidaAbundante/contents/img/fondos/Tarjetas";

const fondosCategorias = {
  tarjetas: [
    "./img/fondos/Tarjetas/1a.png",
    "./img/fondos/Tarjetas/2a.png",
    "./img/fondos/Tarjetas/3a.png",
    "./img/fondos/Tarjetas/4a.png",
    "./img/fondos/Tarjetas/5a.png",
    "./img/fondos/Tarjetas/6a.png",
    "./img/fondos/Tarjetas/7a.png",
    "./img/fondos/Tarjetas/8a.png",
    "./img/fondos/Tarjetas/9a.png",
    "./img/fondos/Tarjetas/10a.png",
    "./img/fondos/Tarjetas/11a.png",
    "./img/fondos/Tarjetas/12a.png",
    "./img/fondos/Tarjetas/13a.png",
    "./img/fondos/Tarjetas/14a.png",
    "./img/fondos/Tarjetas/Untitled_Project_12_oal95a.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_1_arstzx_inkdoy.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_2_wza5pr_rgvyrz.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_3_xyutfs_wwvy6h.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_fwlgtt.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_kwzbbn_iuh5nl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_uxzbsn_f1a2vp.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_zey825.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_gunjzi_t9iy0d.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_qv09sl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_8_xzqnli_opyzjn.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_9_uoqpfk_k7v565.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_tgzcpn_u75stk.jpg",
    "./img/fondos/Tarjetas/amarillopajarosnubes_ar0qqg_x9rx4p.jpg",
    "./img/fondos/Tarjetas/cielopastofloresrosas_cyfof2_dbqnq7.jpg",
    "./img/fondos/Tarjetas/cielorosa_pc0puk_b1qrvx.jpg",
    "./img/fondos/Tarjetas/flores_riug8f_whpgds.jpg"
  ]
};

const fondosEtiquetas = {
  tarjetas: "Tarjetas"
};

let subidosFondosTarjetasCache = null;

function subidosFondoPredicaActual(it = null) {
  return String(
    it?.predicaFondoUrl ||
    document.getElementById("subidosPredicaFondo")?.value ||
    SUBIDOS_EXPORT_BG_URL
  ).trim() || SUBIDOS_EXPORT_BG_URL;
}

function subidosCssUrl(url = "") {
  return String(url || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function subidosOrdenarFondosPorNombre(lista = []) {
  return [...lista].sort((a, b) => {
    return String(a).localeCompare(String(b), "es", {
      numeric: true,
      sensitivity: "base"
    });
  });
}

function subidosLeerFondosTarjetasDesdeEdiciones() {
  try {
    if (typeof window.vaFondosObtenerLista !== "function") {
      return [];
    }

    return (window.vaFondosObtenerLista("tarjetas") || [])
      .map(url => String(url || "").trim())
      .filter(Boolean);
  } catch (e) {
    console.warn("No pude leer fondos desde Ediciones:", e);
    return [];
  }
}

async function subidosLeerFondosTarjetasDesdeGithub() {
  /*
    Primero usamos los fondos cargados desde:
    Recursos > Ediciones > Fondos > Tarjetas.
    Esos NO están en img/fondos/Tarjetas, están en Firebase/R2.
  */
  const desdeEdiciones = subidosLeerFondosTarjetasDesdeEdiciones();

  if (desdeEdiciones.length) {
    subidosFondosTarjetasCache = subidosOrdenarFondosPorNombre(desdeEdiciones);
    return subidosFondosTarjetasCache;
  }

  /*
    Si Ediciones todavía no cargó o no hay fondos nuevos,
    usamos cache/lista fija como respaldo.
  */
  if (Array.isArray(subidosFondosTarjetasCache)) {
    return subidosFondosTarjetasCache;
  }

  try {
    const r = await fetch(SUBIDOS_TARJETAS_GITHUB_API, {
      cache: "no-store"
    });

    if (!r.ok) {
      throw new Error("GitHub no respondió la lista de fondos.");
    }

    const data = await r.json();

    const fondos = (Array.isArray(data) ? data : [])
      .filter(item => item && item.type === "file")
      .filter(item => /\.(png|jpg|jpeg|webp)$/i.test(item.name || ""))
      .map(item => `./${item.path}`);

    if (!fondos.length) {
      throw new Error("No encontré imágenes en img/fondos/Tarjetas.");
    }

    subidosFondosTarjetasCache = subidosOrdenarFondosPorNombre(fondos);
    return subidosFondosTarjetasCache;

  } catch (e) {
    console.warn("Uso lista fija de fondos Tarjetas:", e);

    subidosFondosTarjetasCache = subidosOrdenarFondosPorNombre(
      fondosCategorias.tarjetas || []
    );

    return subidosFondosTarjetasCache;
  }
}

function subidosRenderFondosPredica({
  input,
  galeria,
  fondos,
  actual
}) {
  const lista = subidosOrdenarFondosPorNombre(fondos || []);

  const actualFinal =
    lista.includes(actual)
      ? actual
      : (lista[0] || SUBIDOS_EXPORT_BG_URL);

  input.value = actualFinal;

  galeria.innerHTML = `
    <div class="subidos-fondo-predica-cats">
      <button
        type="button"
        class="subidos-fondo-predica-cat activo"
        data-fondo-cat="tarjetas"
      >
        Tarjetas
      </button>
    </div>

    <div class="subidos-fondo-predica-carril">
      ${lista.map(url => {
        const activo = url === input.value;

        return `
          <button
            type="button"
            class="subidos-fondo-predica-opcion ${activo ? "activo" : ""}"
            data-fondo-url="${escaparHtml(url)}"
            aria-label="Elegir fondo"
            title="${escaparHtml(url.split("/").pop() || "Elegir fondo")}"
          >
            <span
              class="subidos-fondo-predica-preview"
              style="background-image:url('${subidosCssUrl(url)}');"
            ></span>
          </button>
        `;
      }).join("")}
    </div>
  `;

  galeria.querySelectorAll("[data-fondo-url]").forEach(btn => {
    btn.onclick = () => {
      const url = btn.dataset.fondoUrl || SUBIDOS_EXPORT_BG_URL;
      input.value = url;

      subidosRenderFondosPredica({
        input,
        galeria,
        fondos: lista,
        actual: url
      });
    };
  });
}

function subidosPoblarFondosPredica(valorActual = "", categoriaInicial = "") {
  const input = document.getElementById("subidosPredicaFondo");
  const galeria = document.getElementById("subidosPredicaFondosGaleria");

  if (!input || !galeria) return;

  const actual = String(valorActual || input.value || SUBIDOS_EXPORT_BG_URL).trim();
  input.value = actual;

  galeria.innerHTML = `
    <div style="font-size:12px; opacity:.75; padding:8px;">
      Cargando fondos de tarjetas...
    </div>
  `;

  subidosLeerFondosTarjetasDesdeGithub()
    .then(fondos => {
      subidosRenderFondosPredica({
        input,
        galeria,
        fondos,
        actual
      });
    })
    .catch(e => {
      console.warn("No pude cargar fondos:", e);

      subidosRenderFondosPredica({
        input,
        galeria,
        fondos: fondosCategorias.tarjetas || [],
        actual
      });
    });
}

window.addEventListener("va-fondos-actualizados", () => {
  subidosFondosTarjetasCache = null;

  const galeria = document.getElementById("subidosPredicaFondosGaleria");
  if (!galeria) return;

  const actual =
    document.getElementById("subidosPredicaFondo")?.value ||
    SUBIDOS_EXPORT_BG_URL;

  subidosPoblarFondosPredica(actual);
});

let subidosUID = null;
let subidosEsAdmin = false;
let subidosMesActual = new Date();
let subidosItems = [];
let subidosCargados = false;
let subidosHermanosCumples = [];
let subidosEtiquetas = [];
let subidosEditandoId = null;
let subidosDeepLinkAbierto = false;

/* =========================================================
   APK ANDROID: COMPARTIR / DESCARGAR CON PUENTE NATIVO
   ========================================================= */
function subidosEsAPKAndroid(){
  try {
    return !!(
      window.AndroidVida &&
      (
        typeof window.AndroidVida.compartirArchivoBase64 === "function" ||
        typeof window.AndroidVida.descargarArchivoBase64 === "function"
      )
    );
  } catch(e) {
    return false;
  }
}

async function subidosAndroidDescargarFile(file){
  if (!file) throw new Error("No hay archivo para descargar.");

  const nombre = file.name || `archivo_${Date.now()}`;
  const mime = file.type || "application/octet-stream";
  const base64 = await blobToBase64(file);

  window.AndroidVida.descargarArchivoBase64(
    nombre,
    mime,
    base64
  );
}

async function subidosAndroidCompartirFile(file, texto = ""){
  if (!file) throw new Error("No hay archivo para compartir.");

  const nombre = file.name || `archivo_${Date.now()}`;
  const mime = file.type || "application/octet-stream";
  const base64 = await blobToBase64(file);
  const textoFinal = String(texto || "").trim();

  /*
    PRÉDICAS:
    comparte la imagen preparada + el enlace bonito.

    OTROS ARCHIVOS:
    siguen compartiéndose solamente como archivo.
  */
  if (
    textoFinal &&
    window.AndroidVida &&
    typeof window.AndroidVida.compartirArchivoBase64ConTexto === "function"
  ) {
    window.AndroidVida.compartirArchivoBase64ConTexto(
      nombre,
      mime,
      base64,
      textoFinal
    );

    return;
  }

  window.AndroidVida.compartirArchivoBase64(
    nombre,
    mime,
    base64
  );
}

/* ================= ARCHIVOS REALES PARA COMPARTIR/DESCARGAR ================= */

const subidosFileCache = new Map();
const subidosFilePreparando = new Set();

function subidosNombreLimpio(nombre = "archivo") {
  return String(nombre || "archivo")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "archivo";
}

function subidosMimeDesdeNombreUrl(nombre = "", url = "") {
  const s = `${nombre || ""} ${url || ""}`.toLowerCase();

  if (s.includes(".jpg") || s.includes(".jpeg")) return "image/jpeg";
  if (s.includes(".png")) return "image/png";
  if (s.includes(".webp")) return "image/webp";
  if (s.includes(".gif")) return "image/gif";

  if (s.includes(".pdf")) return "application/pdf";
  if (s.includes(".txt")) return "text/plain";

  if (s.includes(".mp3")) return "audio/mpeg";
  if (s.includes(".wav")) return "audio/wav";
  if (s.includes(".m4a")) return "audio/mp4";
  if (s.includes(".ogg")) return "audio/ogg";

  if (s.includes(".mp4")) return "video/mp4";
  if (s.includes(".webm")) return "video/webm";
  if (s.includes(".mov")) return "video/quicktime";

  if (s.includes(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (s.includes(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }

  if (s.includes(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  return "";
}

function subidosExtensionPorMime(tipo = "") {
  const t = String(tipo || "").toLowerCase().split(";")[0].trim();

  if (t === "image/jpeg") return "jpg";
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  if (t === "image/gif") return "gif";

  if (t === "application/pdf") return "pdf";
  if (t === "text/plain") return "txt";

  if (t === "audio/mpeg") return "mp3";
  if (t === "audio/wav") return "wav";
  if (t === "audio/mp4") return "m4a";
  if (t === "audio/ogg") return "ogg";

  if (t === "video/mp4") return "mp4";
  if (t === "video/webm") return "webm";
  if (t === "video/quicktime") return "mov";

  if (t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (t === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";

  return "";
}

function subidosNombreConExtension(nombre = "archivo", tipo = "", url = "") {
  let limpio = subidosNombreLimpio(nombre || "archivo");

  if (/\.[a-z0-9]{2,6}$/i.test(limpio)) {
    return limpio;
  }

  const tipoInferido = tipo || subidosMimeDesdeNombreUrl(nombre, url);
  const ext = subidosExtensionPorMime(tipoInferido);

  return ext ? `${limpio}.${ext}` : limpio;
}

function subidosInfoShareNormalizada(info = {}) {
  const url = String(info.url || "").trim();

  const nombreBase = String(
    info.fileName ||
    info.nombre ||
    `archivo_${Date.now()}`
  ).trim();

  const mimeGuardado = String(
    info.mimeType ||
    info.contentType ||
    ""
  ).split(";")[0].trim();

  const mimeInferido = subidosMimeDesdeNombreUrl(nombreBase, url);

  const mimeType =
    mimeGuardado && mimeGuardado !== "application/octet-stream"
      ? mimeGuardado
      : (mimeInferido || mimeGuardado || "application/octet-stream");

  return {
    ...info,
    url,
    mimeType,
    fileName: subidosNombreConExtension(nombreBase, mimeType, url)
  };
}

function subidosCacheKeyArchivo(info = {}) {
  return `archivo-url::${String(info?.url || "").trim()}`;
}

function subidosLeerFileCachePorInfo(info = {}, id = "") {
  const normal = subidosInfoShareNormalizada(info);
  if (!normal.url) return null;

  const porUrl = subidosFileCache.get(subidosCacheKeyArchivo(normal));
  if (porUrl?.url === normal.url && porUrl?.file) return porUrl.file;

  if (id) {
    const porId = subidosFileCache.get(String(id));
    if (porId?.url === normal.url && porId?.file) return porId.file;
  }

  return null;
}

function subidosGuardarFileCachePorInfo(info = {}, file = null, id = "") {
  const normal = subidosInfoShareNormalizada(info);
  if (!normal.url || !file) return;

  const data = {
    url: normal.url,
    file
  };

  subidosFileCache.set(subidosCacheKeyArchivo(normal), data);

  if (id) {
    subidosFileCache.set(String(id), data);
  }
}

async function subidosObtenerFileDesdeInfo(info = {}, id = "") {
  const normal = subidosInfoShareNormalizada(info);

  const cache = subidosLeerFileCachePorInfo(normal, id);
  if (cache) return cache;

  const file = await subidosCrearFileDesdeInfo(normal);
  subidosGuardarFileCachePorInfo(normal, file, id);

  return file;
}

function subidosEsImagenParaShare(info = {}) {
  const n = subidosInfoShareNormalizada(info);
  const tipo = String(n.mimeType || "").toLowerCase();

  return (
    tipo.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif)$/i.test(String(n.fileName || "")) ||
    /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(String(n.url || ""))
  );
}

function subidosEsVideoParaShare(info = {}) {
  const n = subidosInfoShareNormalizada(info);
  const tipo = String(n.mimeType || "").toLowerCase();

  return (
    tipo.startsWith("video/") ||
    /\.(mp4|webm|mov)(\?|$)/i.test(String(n.fileName || "")) ||
    /\.(mp4|webm|mov)(\?|$)/i.test(String(n.url || ""))
  );
}

function subidosShareUrlPreparada(url = "", r2Key = "") {
  const u = String(url || "").toLowerCase();
  const k = String(r2Key || "").toLowerCase();

  return (
    k.startsWith("subidos-share/") ||
    u.includes("/subidos-share/")
  );
}

function subidosTieneSharePreparado(a = {}) {
  return !!(
    a?.shareUrl &&
    subidosShareUrlPreparada(a.shareUrl, a.shareR2Key)
  );
}

async function subidosCrearShareComunAlGuardarDesdeFile(file, estadoEl = null, idx = 0) {
  if (!file) return null;

  // Videos grandes no los duplicamos en base64. Se comparten desde el original.
  if (subidosEsVideoFile(file)) {
    return null;
  }

  if (estadoEl) {
    estadoEl.textContent = `Preparando archivo ${idx + 1} para compartir...`;
  }

  let fileShare = file;

  // Para imágenes, igual que venimos intentando: JPG limpio compatible.
  if (subidosEsImagenParaShare({
    url: file.name || "",
    fileName: file.name || `imagen_${idx + 1}`,
    mimeType: file.type || ""
  })) {
    fileShare = await subidosCrearShareComunDesdeBlob(
      file,
      file.name || `imagen_${idx + 1}`
    );
  }

  if (estadoEl) {
    estadoEl.textContent = `Subiendo archivo preparado ${idx + 1}...`;
  }

  const subida = await subirArchivoAR2DesdeWeb(fileShare, "subidos-share");

  if (!subida?.url) {
    throw new Error("No se pudo subir el archivo preparado para compartir.");
  }

  return {
    shareUrl: subida.url,
    shareR2Key: subida.key || "",
    shareMimeType: subida.contentType || fileShare.type || "application/octet-stream",
    shareFileName: subida.fileName || fileShare.name || `archivo_${idx + 1}`
  };
}

function subidosNombreBaseSinExtension(nombre = "archivo") {
  return subidosNombreLimpio(nombre || "archivo").replace(/\.[a-z0-9]{2,6}$/i, "");
}

function subidosCargarImagenDesdeBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    const limpiar = () => {
      setTimeout(() => URL.revokeObjectURL(url), 500);
    };

    img.onload = () => {
      limpiar();
      resolve(img);
    };

    img.onerror = () => {
      limpiar();
      reject(new Error("No pude preparar la imagen para compartir."));
    };

    img.src = url;
  });
}

async function subidosCrearJpgLimpioParaShareDesdeInfo(info = {}, id = "") {
  const normal = subidosInfoShareNormalizada(info);
  if (!normal?.url) throw new Error("Falta URL del archivo.");

  const cacheKey = `share-jpg-limpio::${normal.url}`;
  const cache = subidosFileCache.get(cacheKey);

  if (cache?.file) return cache.file;

  const proxy = subidosProxyArchivoUrl(normal.url, normal.fileName, false);

  const r = await fetch(proxy, {
    cache: "no-store"
  });

  if (!r.ok) {
    throw new Error("No pude preparar la imagen real.");
  }

  const blob = await r.blob();
  const img = await subidosCargarImagenDesdeBlob(blob);

  const maxLado = 2200;
  const w0 = img.naturalWidth || img.width || 1200;
  const h0 = img.naturalHeight || img.height || 1200;

  const escala = Math.min(1, maxLado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", {
    alpha: false
  });

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const jpgBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/jpeg", 0.94);
  });

  if (!jpgBlob) {
    throw new Error("No pude convertir la imagen para compartir.");
  }

  const nombre = `${subidosNombreBaseSinExtension(normal.fileName || "imagen")}.jpg`;
  const file = new File([jpgBlob], nombre, { type: "image/jpeg" });

  subidosFileCache.set(cacheKey, {
    url: normal.url,
    file
  });

  if (id) {
    subidosFileCache.set(`share-jpg-limpio-id::${id}`, {
      url: normal.url,
      file
    });
  }

  return file;
}

async function subidosCrearFileShareComunDesdeInfo(info = {}, id = "") {
  const normal = subidosInfoShareNormalizada(info);
  if (!normal?.url) throw new Error("Falta URL del archivo.");

  // Importante:
  // NO usamos subidosObtenerFileDesdeInfo acá porque eso cachea el original
  // antes de saber si Android lo acepta para compartir.
  const original = await subidosCrearFileDesdeInfo(normal);

  try {
    if (
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [original] }))
    ) {
      subidosGuardarFileCachePorInfo(normal, original, id);
      return original;
    }
  } catch (e) {}

  // Si Android no acepta la imagen original, la convertimos a JPG limpio
  // y guardamos ESE jpg en el cache normal que después usa compartir.
  if (subidosEsImagenParaShare(normal)) {
    const jpg = await subidosCrearJpgLimpioParaShareDesdeInfo(normal, id);
    subidosGuardarFileCachePorInfo(normal, jpg, id);
    return jpg;
  }

  subidosGuardarFileCachePorInfo(normal, original, id);
  return original;
}

function subidosCompartirArchivoComunSinLink(info = {}, titulo = "Archivo", id = "") {
  const normal = subidosInfoShareNormalizada(info);
  const file = subidosLeerFileCachePorInfo(normal, id);

  if (!file) {
    if (id) subidosPrepararArchivoAccion(id);
    throw new Error("El archivo todavía no está listo para compartir. Esperá unos segundos y tocá compartir de nuevo.");
  }

  // ✅ MISMO SISTEMA QUE PRÉDICA.
  // ✅ SIN LINK.
  // ✅ SIN TEXT.
  return subidosCompartirFileObligatorio(file, titulo || "Archivo", "");
}

async function subidosCrearShareComunDesdeBlob(blob, nombreBase = "imagen") {
  const img = await subidosCargarImagenDesdeBlob(blob);

  const maxLado = 2200;
  const w0 = img.naturalWidth || img.width || 1200;
  const h0 = img.naturalHeight || img.height || 1200;

  const escala = Math.min(1, maxLado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const pngBlob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/png");
  });

  if (!pngBlob) {
    throw new Error("No se pudo preparar la imagen para compartir.");
  }

  const nombre = `${subidosNombreBaseSinExtension(nombreBase || "imagen")}.png`;

  return new File([pngBlob], nombre, {
    type: "image/png"
  });
}

async function subidosCrearShareComunAlGuardarDesdeUrl(info = {}, estadoEl = null, idx = 0) {
  const normal = subidosInfoShareNormalizada(info);

  if (!normal?.url) return null;

  // Si ya está realmente en subidos-share, lo respetamos.
  if (subidosTieneSharePreparado(info)) {
    return {
      shareUrl: info.shareUrl || "",
      shareR2Key: info.shareR2Key || "",
      shareMimeType: info.shareMimeType || normal.mimeType || "application/octet-stream",
      shareFileName: info.shareFileName || normal.fileName || `archivo_${idx + 1}`
    };
  }

  // Videos no los duplicamos. Se comparten desde el original.
  if (subidosEsVideoParaShare(normal)) {
    return {
      shareUrl: normal.url,
      shareR2Key: info.r2Key || "",
      shareMimeType: normal.mimeType || "video/mp4",
      shareFileName: normal.fileName || `video_${idx + 1}.mp4`
    };
  }

  if (estadoEl) {
    estadoEl.textContent = `Preparando archivo ${idx + 1} para compartir...`;
  }

  const proxy = subidosProxyArchivoUrl(normal.url, normal.fileName, false);

  const r = await fetch(proxy, {
    cache: "no-store"
  });

  if (!r.ok) {
    throw new Error("No pude leer el archivo para prepararlo.");
  }

  const blob = await r.blob();

  let fileShare;

  if (subidosEsImagenParaShare(normal)) {
    fileShare = await subidosCrearShareComunDesdeBlob(
      blob,
      normal.fileName || `imagen_${idx + 1}`
    );
  } else {
    const tipo = normal.mimeType || blob.type || "application/octet-stream";
    const nombre = subidosNombreConExtension(
      normal.fileName || `archivo_${idx + 1}`,
      tipo,
      normal.url
    );

    fileShare = new File(
      [blob.type === tipo ? blob : blob.slice(0, blob.size, tipo)],
      nombre,
      { type: tipo }
    );
  }

  if (estadoEl) {
    estadoEl.textContent = `Subiendo archivo preparado ${idx + 1}...`;
  }

  const subida = await subirArchivoAR2DesdeWeb(fileShare, "subidos-share");

  if (!subida?.url) {
    throw new Error("No se pudo subir el archivo preparado.");
  }

  return {
    shareUrl: subida.url,
    shareR2Key: subida.key || "",
    shareMimeType: subida.contentType || fileShare.type || "application/octet-stream",
    shareFileName: subida.fileName || fileShare.name || `archivo_${idx + 1}`
  };
}

async function subidosPrepararSharesComunesAlGuardar(idFinal, datosBase, estadoEl = null) {
  if (!idFinal || !datosBase) return null;

  const archivosBase = Array.isArray(datosBase.archivos)
    ? datosBase.archivos
    : [];

  if (!archivosBase.length) return null;

  const archivosPreparados = [];

  for (let i = 0; i < archivosBase.length; i++) {
    const a = archivosBase[i];

    if (subidosTieneSharePreparado(a)) {
      archivosPreparados.push(a);
      continue;
    }

    const share = await subidosCrearShareComunAlGuardarDesdeUrl(a, estadoEl, i);

    archivosPreparados.push({
      ...a,
      ...(share || {})
    });
  }

  const principal = archivosPreparados[0] || {};

  return {
    archivos: archivosPreparados,

    // ✅ OJO: sin fallback a datosBase.shareUrl, porque eso era el original.
    shareUrl: principal.shareUrl || "",
    shareR2Key: principal.shareR2Key || "",
    shareMimeType: principal.shareMimeType || "",
    shareFileName: principal.shareFileName || ""
  };
}

function subidosNombreSharePredica(it) {
  const fecha = it?.fechaEvento || "sin-fecha";
  const id = it?.id || "predica";
  const version = Date.now();

  return subidosNombreLimpio(`predica-${fecha}-${id}-${version}.png`);
}

function subidosInfoArchivoAccion(it) {
  if (!it) return null;

  // ✅ PRÉDICA NO SE TOCA:
  // usa la imagen PNG ya preparada y subida a R2.
  if (subidosEsPredicaConContenido(it)) {
    if (!it.shareUrl) return null;

    return subidosInfoShareNormalizada({
      url: it.shareUrl,
      fileName: it.shareFileName || subidosNombreSharePredica(it),
      mimeType: it.shareMimeType || "image/png"
    });
  }

  // ✅ Otras etiquetas:
  // usa archivo preparado si existe; si no, cae al archivo original.
  const principal = subidosArchivoPrincipal(it);

  if (principal?.shareUrl || it.shareUrl) {
    return subidosInfoShareNormalizada({
      url: principal?.shareUrl || it.shareUrl,
      fileName:
        principal?.shareFileName ||
        it.shareFileName ||
        principal?.fileName ||
        it.fileName ||
        `archivo_${Date.now()}`,
      mimeType:
        principal?.shareMimeType ||
        it.shareMimeType ||
        principal?.mimeType ||
        it.mimeType ||
        "application/octet-stream"
    });
  }

  if (principal?.url) {
    return subidosInfoShareNormalizada({
      url: principal.url,
      fileName: principal.fileName || it.fileName || `archivo_${Date.now()}`,
      mimeType: principal.mimeType || it.mimeType || "application/octet-stream"
    });
  }

  return null;
}

function subidosInfoArchivoPorIndice(it, indice = 0) {
  if (!it) return null;

  // ✅ PRÉDICA NO SE TOCA
  if (subidosEsPredicaConContenido(it)) {
    return subidosInfoArchivoAccion(it);
  }

  const archivos = subidosArchivosItem(it);
  const idx = Math.max(0, Math.min(Number(indice || 0), archivos.length - 1));
  const a = archivos[idx];

  if (!a?.url) return null;

  return subidosInfoShareNormalizada({
    url: a.url,
    fileName: a.fileName || it.fileName || `archivo_${idx + 1}`,
    mimeType:
      a.mimeType ||
      a.contentType ||
      it.mimeType ||
      subidosMimeDesdeNombreUrl(a.fileName || it.fileName || "", a.url) ||
      "application/octet-stream"
  });
}

function subidosInfoShareArchivoPorIndice(it, indice = 0) {
  if (!it) return null;

  // ✅ PRÉDICA NO SE TOCA
  if (subidosEsPredicaConContenido(it)) {
    return subidosInfoArchivoAccion(it);
  }

  const archivos = subidosArchivosItem(it);
  const idx = Math.max(0, Math.min(Number(indice || 0), archivos.length - 1));
  const a = archivos[idx];

  if (!a) return null;

  // ✅ Primero usa el archivo ya preparado para compartir
  if (a.shareUrl) {
    return subidosInfoShareNormalizada({
      url: a.shareUrl,
      fileName: a.shareFileName || a.fileName || `archivo_${idx + 1}`,
      mimeType: a.shareMimeType || a.mimeType || "application/octet-stream"
    });
  }

  // ✅ Compatibilidad: primer archivo con shareUrl raíz
  if (idx === 0 && it.shareUrl) {
    return subidosInfoShareNormalizada({
      url: it.shareUrl,
      fileName: it.shareFileName || a.fileName || it.fileName || `archivo_${idx + 1}`,
      mimeType: it.shareMimeType || a.mimeType || it.mimeType || "application/octet-stream"
    });
  }

  // Fallback al archivo original
  if (a.url) {
    return subidosInfoShareNormalizada({
      url: a.url,
      fileName: a.fileName || it.fileName || `archivo_${idx + 1}`,
      mimeType:
        a.mimeType ||
        a.contentType ||
        it.mimeType ||
        subidosMimeDesdeNombreUrl(a.fileName || it.fileName || "", a.url) ||
        "application/octet-stream"
    });
  }

  return null;
}

function subidosIndiceActualDesdeBoton(id, btn) {
  const base =
    btn?.closest?.(".subidos-feed-card") ||
    btn?.closest?.(".comp-post") ||
    btn?.closest?.("#modalSubidosVisor") ||
    document.getElementById(`subido-${id}`) ||
    null;

  const carril =
    base?.querySelector?.(".subidos-media-carril") ||
    base?.querySelector?.(".subidos-visor-archivos-carril") ||
    document.querySelector("#modalSubidosVisor .subidos-visor-archivos-carril");

  if (!carril) return 0;

  const selector = carril.classList.contains("subidos-visor-archivos-carril")
    ? ".subidos-visor-archivo-slide"
    : ".subidos-media-slide";

  return subidosIndiceActualCarril(carril, selector);
}

async function subidosCrearFileDeItemPorIndice(it, indice = 0) {
  const info = subidosInfoArchivoPorIndice(it, indice);
  if (!info?.url) throw new Error("No se encontró el archivo.");

  const idCache = Number(indice || 0) === 0 ? (it?.id || "") : "";

  return await subidosObtenerFileDesdeInfo(info, idCache);
}

async function subidosCrearFilesDeItem(it, indices = []) {
  const files = [];

  for (const idx of indices) {
    const file = await subidosCrearFileDeItemPorIndice(it, idx);
    files.push(file);
  }

  return files;
}

function subidosElegirTodoOActual(accion, cantidad) {
  if (cantidad <= 1) return Promise.resolve("actual");

  return new Promise(resolve => {
    const verbo = accion === "compartir" ? "compartir" : "descargar";

    const modal = document.createElement("div");
    modal.className = "subidos-modal-eleccion-archivos";
    modal.innerHTML = `
      <div class="subidos-modal-eleccion-card">
        <h3>¿Querés ${verbo} todas las imágenes o solo la actual?</h3>

        <div class="subidos-modal-eleccion-actions">
          <button type="button" data-opcion="actual">
            Solo la actual
          </button>

          <button type="button" data-opcion="todo">
            Todas
          </button>

          <button type="button" data-opcion="cancelar" class="subidos-modal-eleccion-cancelar">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll("[data-opcion]").forEach(btn => {
      btn.onclick = () => {
        const opcion = btn.dataset.opcion || "cancelar";
        modal.remove();
        resolve(opcion);
      };
    });
  });
}

async function subidosCrearFileDesdeInfo(info) {
  const datos = subidosInfoShareNormalizada(info);

  if (!datos?.url) throw new Error("Falta URL del archivo.");

  const proxy = subidosProxyArchivoUrl(datos.url, datos.fileName, false);

  const r = await fetch(proxy, {
    cache: "no-store"
  });

  if (!r.ok) {
    throw new Error("No pude preparar el archivo real.");
  }

  const blob = await r.blob();

  let tipo = datos.mimeType;

  if (!tipo || tipo === "application/octet-stream") {
    tipo =
      subidosMimeDesdeNombreUrl(datos.fileName, datos.url) ||
      blob.type ||
      "application/octet-stream";
  }

  tipo = String(tipo || "application/octet-stream").split(";")[0].trim();

  const nombre = subidosNombreConExtension(datos.fileName, tipo, datos.url);
  const blobFinal = blob.type === tipo ? blob : blob.slice(0, blob.size, tipo);

  return new File([blobFinal], nombre, { type: tipo });
}

function subidosMarcarArchivoAccionListo(id, listo) {
  const btnD = document.querySelector(`[data-subidos-download="${id}"]`);
  const btnS = document.querySelector(`[data-subidos-share="${id}"]`);

  [btnD, btnS].forEach(btn => {
    if (!btn) return;

    btn.disabled = !listo;
    btn.style.opacity = listo ? "1" : ".45";
    btn.style.cursor = listo ? "pointer" : "wait";
    btn.title = listo
      ? (btn.dataset.subidosShare ? "Compartir" : "Descargar")
      : "Preparando archivo...";
  });
}

async function subidosPrepararArchivoAccion(id) {
  const it = obtenerSubidoPorId(id);
  if (!it) return null;

  const esPredica = subidosEsPredicaConContenido(it);
  const archivos = esPredica ? [] : subidosArchivosItem(it);

  const LIMITE_AUTO_VIDEO = 28 * 1024 * 1024;

  const tieneVideoGrande = !esPredica && archivos.some(a =>
    String(a?.mimeType || "").startsWith("video/") &&
    Number(a?.sizeBytes || 0) > LIMITE_AUTO_VIDEO
  );

  if (tieneVideoGrande) {
    subidosMarcarArchivoAccionListo(id, true);
    return null;
  }

  // ✅ Prédica usa su info normal.
  // ✅ Otras etiquetas usan la info preparada para compartir.
  const infos = esPredica
    ? [subidosInfoArchivoAccion(it)].filter(Boolean)
    : archivos
        .map((_, i) => subidosInfoShareArchivoPorIndice(it, i))
        .filter(info => info?.url);

  if (!infos.length) {
    subidosMarcarArchivoAccionListo(id, false);
    return null;
  }

  const principal = infos[0];

  const cachePrincipal = subidosLeerFileCachePorInfo(principal, id);
  if (cachePrincipal) {
    subidosMarcarArchivoAccionListo(id, true);
    return cachePrincipal;
  }

  if (subidosFilePreparando.has(id)) return null;

  subidosFilePreparando.add(id);
  subidosMarcarArchivoAccionListo(id, false);

  try {
    let principalFile = null;

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i];
      const idCache = i === 0 ? id : "";

      try {
const file = await subidosObtenerFileDesdeInfo(info, idCache);
        if (i === 0) principalFile = file;
      } catch (e) {
        console.warn("No pude preparar archivo:", id, i, e);
        if (i === 0) throw e;
      }
    }

    subidosMarcarArchivoAccionListo(id, true);
    return principalFile;
  } catch (e) {
    console.warn("No pude preparar archivo para acción:", id, e);
    subidosMarcarArchivoAccionListo(id, false);
    return null;
  } finally {
    subidosFilePreparando.delete(id);
  }
}

function subidosPrepararArchivosDelFeed() {
  setTimeout(() => {
    const cards = [...document.querySelectorAll(".subidos-feed-card[id^='subido-']")];

    cards.forEach((card, i) => {
      const id = card.id.replace("subido-", "");

      // ✅ escalonado para no trabar todo de golpe
      setTimeout(() => {
        subidosPrepararArchivoAccion(id);
      }, i * 300);
    });
  }, 500);
}

async function subidosDescargarFileReal(file) {
  if (!file) {
    throw new Error("No hay archivo para descargar.");
  }

  if (subidosEsAPKAndroid() && window.AndroidVida?.descargarArchivoBase64) {
    await subidosAndroidDescargarFile(file);
    return;
  }

  const url = URL.createObjectURL(file);

  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || `archivo_${Date.now()}`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const ETIQUETAS_DEFAULT = [
  "Predica",
  "Anuncio",
  "Plan",
  "Racimo",
  "Oración",
  "Cumpleaños",
  "Santa Cena",
  "Reunion Jovenes",
  "Reunion Varones",
  "Reunion Mujeres",
  "Taller"
];

// ================= HELPERS =================
function esPredicaSubidos(etiqueta = "") {
  return normalizarEtiquetaSubidos(etiqueta) === "predica";
}

function limpiarPreviewCitaPredica(card) {
  if (!card) return;

  const info = card.querySelector(".subidosCitaSeleccionInfo");
  const ref = card.querySelector(".subidosCitaReferencia");
  const txt = card.querySelector(".subidosCitaTexto");
  const btnExpandir = card.querySelector(".subidosCitaExpandir");

  if (info) info.style.display = "none";
  if (ref) ref.textContent = "";
  if (txt) {
    txt.textContent = "";
    txt.style.maxHeight = "240px";
    txt.style.overflow = "auto";
  }
  if (btnExpandir) {
    btnExpandir.style.display = "none";
    btnExpandir.dataset.expandido = "0";
    btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  }
}

function renumerarCitasPredica() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  [...wrap.children].forEach((card, i) => {
    const ttl = card.querySelector(".subidosCitaTitulo");
    if (ttl) ttl.textContent = `Cita ${i + 1}`;
  });

  actualizarBotonesAgregarOtraCita();
}

window.subidosAgregarCitaPredica = async function subidosAgregarCitaPredica() {
  const tpl = document.getElementById("tplSubidosCitaPredica");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!tpl || !wrap) return null;

  const node = tpl.content.firstElementChild.cloneNode(true);

  const btnEliminar = node.querySelector(".subidosCitaEliminar");
  const btnLimpiar = node.querySelector(".subidosCitaLimpiar");
  const btnExpandir = node.querySelector(".subidosCitaExpandir");

  if (btnEliminar) {
    btnEliminar.onclick = () => {
      node.remove();
      renumerarCitasPredica();
    };
  }

  if (btnLimpiar) {
    btnLimpiar.onclick = () => {
      limpiarCitaPredica(node);
    };
  }

  if (btnExpandir) {
    btnExpandir.onclick = () => {
      const txt = node.querySelector(".subidosCitaTexto");
      if (!txt) return;

      const expandido = btnExpandir.dataset.expandido === "1";

      if (expandido) {
        txt.style.maxHeight = "240px";
        txt.style.overflow = "auto";
        btnExpandir.dataset.expandido = "0";
        btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
      } else {
        txt.style.maxHeight = "420px";
        txt.style.overflow = "auto";
        btnExpandir.dataset.expandido = "1";
        btnExpandir.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
      }
    };
  }

  wrap.appendChild(node);
  renumerarCitasPredica();
  await inicializarCardCitaPredica(node);
  return node;
};

function resetPredicaSubidosUI() {
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
  const version = document.getElementById("subidosPredicaVersion");
  const intro = document.getElementById("subidosPredicaIntro");
  const titulo = document.getElementById("subidosPredicaTitulo");
  const fondo = document.getElementById("subidosPredicaFondo");

  subidosPoblarFondosPredica();

  if (box) box.style.display = "none";
  if (wrap) wrap.innerHTML = "";
  if (notaFinal) notaFinal.value = "";
  if (version) version.value = "RV1960";
  if (intro) intro.value = "";
  if (titulo) titulo.value = "";
  if (fondo) fondo.value = SUBIDOS_EXPORT_BG_URL;
  subidosPoblarFondosPredica(SUBIDOS_EXPORT_BG_URL);
}

function actualizarPredicaSubidosUI() {
  const sel = document.getElementById("subidosEtiqueta");
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const intro = document.getElementById("subidosPredicaIntro");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
  const titulo = document.getElementById("subidosPredicaTitulo");
  const fondo = document.getElementById("subidosPredicaFondo");

  if (!sel || !box || !wrap) return

  const mostrar = esPredicaSubidos(sel.value);

  box.style.display = mostrar ? "block" : "none";

  if (!mostrar) {
    wrap.innerHTML = "";
    if (intro) intro.value = "";
    if (notaFinal) notaFinal.value = "";
    if (titulo) titulo.value = "";
    if (fondo) fondo.value = SUBIDOS_EXPORT_BG_URL;
    subidosPoblarFondosPredica(SUBIDOS_EXPORT_BG_URL);
    return;
  }

  if (!wrap.children.length) {
    subidosPoblarFondosPredica(fondo?.value || SUBIDOS_EXPORT_BG_URL);
    window.subidosAgregarCitaPredica();
  }
}

/* ================= PREDICA + BIBLIA REAL ================= */

const SUBIDOS_BIBLIA_CACHE = {
  RV1960: null,
  NTV: null
};

const SUBIDOS_BIBLIA_CANDIDATAS = {
  RV1960: [
    "./VidaAbundante - RV1960.json",
    "VidaAbundante - RV1960.json",
    "./json/VidaAbundante - RV1960.json",
    "json/VidaAbundante - RV1960.json"
  ],
  NTV: [
    "./biblia_ntv.json",
    "biblia_ntv.json",
    "./json/biblia_ntv.json",
    "json/biblia_ntv.json"
  ]
};

function subidosNormalizarBiblia(txt = "") {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function subidosEsObjeto(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function subidosVersionPredicaActual() {
  return document.getElementById("subidosPredicaVersion")?.value || "RV1960";
}

function subidosPrimerValido(lista = []) {
  for (const x of lista) {
    if (x) return x;
  }
  return null;
}

function subidosTextoVersiculo(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (!v) return "";

  const version = subidosVersionPredicaActual();

  return String(
    v[version] ??
    v.RV1960 ??
    v.NTV ??
    v.texto ??
    v.text ??
    v.contenido ??
    v.content ??
    v.versiculo ??
    v.verse ??
    ""
  ).trim();
}

function subidosCampoLibro(v) {
  return String(
    v?.Libro ??
    v?.book_name ??
    v?.bookName ??
    v?.book ??
    v?.libro ??
    v?.nombre ??
    v?.name ??
    ""
  ).trim();
}

function subidosCampoCapitulo(v) {
  return Number(
    v?.Capitulo ??
    v?.chapter ??
    v?.capitulo ??
    v?.chapterNumber ??
    v?.cap ??
    0
  );
}

function subidosCampoVersiculo(v) {
  return Number(
    v?.Versiculo ??
    v?.Versículo ??
    v?.verse ??
    v?.versiculo ??
    v?.verseNumber ??
    v?.num ??
    0
  );
}

function subidosBibliaEsPlana(raw) {
  const coleccion = subidosColeccionLibros(raw);
  if (!Array.isArray(coleccion) || !coleccion.length) return false;

  const muestra = coleccion[0];
  return !!(
    subidosCampoLibro(muestra) ||
    subidosCampoCapitulo(muestra) ||
    subidosCampoVersiculo(muestra)
  );
}

function subidosLibrosDesdeSelectorPrincipal() {
  const sel = document.getElementById("libro");
  if (!sel) return [];

  const libros = [...sel.options]
    .map(o => String(o.value || "").trim())
    .filter(v =>
      v &&
      v !== "Seleccionar…" &&
      v !== "Seleccionar..." &&
      !/^\d+$/.test(v)
    );

  const vistos = new Set();

  return libros
    .filter(nombre => {
      const k = subidosNormalizarBiblia(nombre);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(nombre => ({ nombre, raw: null }));
}

function subidosTextoHtml(txt = "") {
  const limpio = String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map(linea =>
      String(linea || "")
        .replace(/^[\s\u00A0]+/g, "")
        .replace(/[\s\u00A0]+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return escaparHtml(limpio).replace(/\n/g, "<br>");
}

function subidosNumsSeleccionados(card) {
  const nums = Array.isArray(card.__seleccionNums) ? [...card.__seleccionNums] : [];
  return nums
    .map(n => Number(n))
    .filter(n => n > 0)
    .sort((a, b) => a - b);
}

function subidosSetSeleccionados(card, nums) {
  card.__seleccionNums = [...new Set(
    (nums || [])
      .map(n => Number(n))
      .filter(n => n > 0)
  )].sort((a, b) => a - b);
}

function subidosCompactarNumeros(nums = []) {
  const ordenados = [...new Set(nums.map(Number).filter(n => n > 0))].sort((a, b) => a - b);
  if (!ordenados.length) return [];

  const tramos = [];
  let desde = ordenados[0];
  let hasta = ordenados[0];

  for (let i = 1; i < ordenados.length; i++) {
    const n = ordenados[i];
    if (n === hasta + 1) {
      hasta = n;
      continue;
    }
    tramos.push({ desde, hasta });
    desde = n;
    hasta = n;
  }

  tramos.push({ desde, hasta });
  return tramos;
}

function subidosTextoTramosReferencia(tramos = []) {
  return tramos.map(t => t.desde === t.hasta ? `${t.desde}` : `${t.desde}-${t.hasta}`).join(" y ");
}

function subidosTextoCompletoDeSeleccion(versos = [], nums = []) {
  const set = new Set(nums);
  return versos
    .filter(v => set.has(v.n))
    .map(v => `${v.n}. ${v.texto}`)
    .join("\n");
}

function subidosTextoResumenSeleccion(versos = [], nums = []) {
  const set = new Set(nums);
  return versos
    .filter(v => set.has(v.n))
    .map(v => `${v.n}. ${v.texto}`)
    .join(" ");
}

function actualizarBotonesAgregarOtraCita() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  const cards = [...wrap.querySelectorAll(".subidos-cita-card")];
  cards.forEach((card, i) => {
    let box = card.querySelector(".subidosAgregarOtraCitaBox");
    if (!box) {
      box = document.createElement("div");
      box.className = "subidosAgregarOtraCitaBox";
      box.style.marginTop = "10px";
      box.style.display = "none";
      box.innerHTML = `
        <button type="button" class="btn-primary subidosAgregarOtraCitaBtn">
          <i class="fa-solid fa-circle-plus"></i> Agregar otra cita
        </button>
      `;
      card.appendChild(box);

      const btn = box.querySelector(".subidosAgregarOtraCitaBtn");
      if (btn) {
        btn.onclick = () => {
          window.subidosAgregarCitaPredica();
        };
      }
    }

    box.style.display = (i === cards.length - 1) ? "flex" : "none";
  });
}

async function obtenerBibliaPredica(version = subidosVersionPredicaActual()) {
  if (SUBIDOS_BIBLIA_CACHE[version]) return SUBIDOS_BIBLIA_CACHE[version];

  const globalDirecto = version === "RV1960"
    ? subidosPrimerValido([
        window.BIBLIA_RV1960,
        window.bibliaRV1960,
        window.__BIBLIA_RV1960__,
        window.BIBLIA?.RV1960,
        window.bibliaData?.RV1960
      ])
    : subidosPrimerValido([
        window.BIBLIA_NTV,
        window.bibliaNTV,
        window.__BIBLIA_NTV__,
        window.BIBLIA?.NTV,
        window.bibliaData?.NTV
      ]);

  if (globalDirecto) {
    SUBIDOS_BIBLIA_CACHE[version] = globalDirecto;
    return globalDirecto;
  }

  for (const ruta of SUBIDOS_BIBLIA_CANDIDATAS[version] || []) {
    try {
      const r = await fetch(ruta);
      if (!r.ok) continue;
      const data = await r.json();
      SUBIDOS_BIBLIA_CACHE[version] = data;
      return data;
    } catch (e) {
      console.warn("No pude cargar", ruta, e);
    }
  }

  throw new Error(`No pude cargar la Biblia ${version}. Revisá las rutas en SUBIDOS_BIBLIA_CANDIDATAS.`);
}

function subidosColeccionLibros(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.libros)) return raw.libros;
  if (Array.isArray(raw?.books)) return raw.books;
  if (Array.isArray(raw?.biblia)) return raw.biblia;
  if (Array.isArray(raw?.data)) return raw.data;
  if (subidosEsObjeto(raw)) return raw;
  return null;
}

function subidosListaLibros(raw) {
  const desdeUI = subidosLibrosDesdeSelectorPrincipal();
  if (desdeUI.length) return desdeUI;

  const coleccion = subidosColeccionLibros(raw);
  if (!coleccion) return [];

  if (Array.isArray(coleccion) && subidosBibliaEsPlana(raw)) {
    const vistos = new Set();

    return coleccion
      .map(row => subidosCampoLibro(row))
      .filter(Boolean)
      .filter(nombre => {
        const k = subidosNormalizarBiblia(nombre);
        if (!k || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .map(nombre => ({
        nombre,
        raw: nombre
      }));
  }

  if (Array.isArray(coleccion)) {
    return coleccion
      .map((libro) => ({
        nombre: String(
          libro?.nombre ??
          libro?.name ??
          libro?.book ??
          libro?.libro ??
          libro?.title ??
          ""
        ).trim(),
        raw: libro
      }))
      .filter(x => x.nombre);
  }

  if (subidosEsObjeto(coleccion)) {
    const omitidos = new Set([
      "version", "nombre", "name", "abreviatura", "abreviaturas",
      "metadata", "meta", "titulo", "title"
    ]);

    return Object.keys(coleccion)
      .filter(k => !omitidos.has(subidosNormalizarBiblia(k)))
      .map(k => ({
        nombre: k,
        raw: coleccion[k]
      }));
  }

  return [];
}

function subidosCapitulosLibro(rawLibro) {
  const base =
    rawLibro?.capitulos ??
    rawLibro?.chapters ??
    rawLibro?.chapter ??
    rawLibro?.capitulo ??
    rawLibro;

  if (Array.isArray(base)) return base;

  if (subidosEsObjeto(base)) {
    const keys = Object.keys(base)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));

    if (keys.length) return keys.map(k => base[k]);
  }

  return [];
}

function subidosVersiculosCapitulo(rawCapitulo) {
  const base =
    rawCapitulo?.versiculos ??
    rawCapitulo?.verses ??
    rawCapitulo?.verse ??
    rawCapitulo?.versiculo ??
    rawCapitulo;

  if (Array.isArray(base)) {
    return base
      .map((v, i) => ({
        n: i + 1,
        texto: subidosTextoVersiculo(v)
      }))
      .filter(v => v.texto);
  }

  if (subidosEsObjeto(base)) {
    const keys = Object.keys(base)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));

    return keys
      .map(k => ({
        n: Number(k),
        texto: subidosTextoVersiculo(base[k])
      }))
      .filter(v => v.texto);
  }

  return [];
}

async function subidosBuscarLibroPorNombre(nombre, version = subidosVersionPredicaActual()) {
  const data = await obtenerBibliaPredica(version);
  const libros = subidosListaLibros(data);
  const buscado = subidosNormalizarBiblia(nombre);

  return libros.find(x => subidosNormalizarBiblia(x.nombre) === buscado) || null;
}

async function poblarLibrosPredicaEnCard(card, seleccionado = "") {
  const sel = card.querySelector(".subidosCitaLibro");
  if (!sel) return;

  const data = await obtenerBibliaPredica();
  const libros = subidosListaLibros(data);

  sel.innerHTML =
    `<option value="">Seleccionar libro…</option>` +
    libros.map(libro => `
      <option value="${escaparHtml(libro.nombre)}">${escaparHtml(libro.nombre)}</option>
    `).join("");

  if (seleccionado) sel.value = seleccionado;
}

async function poblarCapitulosPredicaEnCard(card, libroNombre, seleccionado = "") {
  const sel = card.querySelector(".subidosCitaCapitulo");
  if (!sel) return;

  if (!libroNombre) {
    sel.innerHTML = `<option value="">Seleccionar capítulo…</option>`;
    sel.disabled = true;
    return;
  }

  const data = await obtenerBibliaPredica();

  if (subidosBibliaEsPlana(data)) {
    const coleccion = subidosColeccionLibros(data) || [];
    const caps = [...new Set(
      coleccion
        .filter(row =>
          subidosNormalizarBiblia(subidosCampoLibro(row)) === subidosNormalizarBiblia(libroNombre)
        )
        .map(row => subidosCampoCapitulo(row))
        .filter(n => n > 0)
    )].sort((a, b) => a - b);

    sel.innerHTML =
      `<option value="">Seleccionar capítulo…</option>` +
      caps.map(n => `<option value="${n}">${n}</option>`).join("");

    sel.disabled = false;
    if (seleccionado) sel.value = String(seleccionado);
    return;
  }

  const libro = await subidosBuscarLibroPorNombre(libroNombre);
  const capitulos = subidosCapitulosLibro(libro?.raw);

  sel.innerHTML =
    `<option value="">Seleccionar capítulo…</option>` +
    capitulos.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");

  sel.disabled = false;

  if (seleccionado) sel.value = String(seleccionado);
}

function renderVersiculosPredicaEnCard(card) {
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  if (!wrap || !empty) return;

  const versos = Array.isArray(card.__versiculosData) ? card.__versiculosData : [];
  const seleccionados = new Set(subidosNumsSeleccionados(card));

  if (!versos.length) {
    wrap.innerHTML = "";
    empty.style.display = "";
    return;
  }

  empty.style.display = "none";

  wrap.innerHTML = versos.map(v => {
    const activo = seleccionados.has(v.n);

    return `
      <button
        type="button"
        data-num="${v.n}"
        style="
          width:100%;
          text-align:left;
          border-radius:12px;
          padding:8px 10px;
          border:1px solid ${activo ? "#97d8f7" : "#e5e7eb"};
          background:${activo ? "#eafaff" : "#ffffff"};
          cursor:pointer;
          line-height:1.35;
        "
      >
        <span style="font-weight:800;">${v.n}</span>
        <span>${escaparHtml(v.texto)}</span>
      </button>
    `;
  }).join("");

  wrap.querySelectorAll("[data-num]").forEach(btn => {
    btn.onclick = () => {
      seleccionarVersiculoPredicaEnCard(card, Number(btn.dataset.num));
    };
  });
}

async function poblarVersiculosPredicaEnCard(card, libroNombre, capituloNumero) {
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  if (!wrap || !empty) return;

  card.__versiculosData = [];
  wrap.innerHTML = "";
  empty.style.display = "";

  if (!libroNombre || !capituloNumero) return;

  const data = await obtenerBibliaPredica();

  if (subidosBibliaEsPlana(data)) {
    const coleccion = subidosColeccionLibros(data) || [];

    card.__versiculosData = coleccion
      .filter(row =>
        subidosNormalizarBiblia(subidosCampoLibro(row)) === subidosNormalizarBiblia(libroNombre) &&
        subidosCampoCapitulo(row) === Number(capituloNumero)
      )
      .map(row => ({
        n: subidosCampoVersiculo(row),
        texto: subidosTextoVersiculo(row)
      }))
      .filter(v => v.n > 0 && v.texto)
      .sort((a, b) => a.n - b.n);

    renderVersiculosPredicaEnCard(card);
    return;
  }

  const libro = await subidosBuscarLibroPorNombre(libroNombre);
  const capitulos = subidosCapitulosLibro(libro?.raw);
  const rawCapitulo = capitulos[Number(capituloNumero) - 1];

  card.__versiculosData = subidosVersiculosCapitulo(rawCapitulo);
  renderVersiculosPredicaEnCard(card);
}

function actualizarPreviewPredicaEnCard(card) {
  const info = card.querySelector(".subidosCitaSeleccionInfo");
  const ref = card.querySelector(".subidosCitaReferencia");
  const txt = card.querySelector(".subidosCitaTexto");
  const btnExpandir = card.querySelector(".subidosCitaExpandir");

  const libro = card.querySelector(".subidosCitaLibro")?.value || "";
  const capitulo = Number(card.querySelector(".subidosCitaCapitulo")?.value || 0);
  const versos = Array.isArray(card.__versiculosData) ? card.__versiculosData : [];
  const nums = subidosNumsSeleccionados(card);

  if (!libro || !capitulo || !nums.length || !versos.length) {
    delete card.dataset.referencia;
    delete card.dataset.texto;
    delete card.dataset.segmentos;
    limpiarPreviewCitaPredica(card);
    return;
  }

  const tramos = subidosCompactarNumeros(nums);
  const referencia = `${libro} ${capitulo}:${subidosTextoTramosReferencia(tramos)}`;
  const texto = subidosTextoCompletoDeSeleccion(versos, nums);

  card.dataset.libro = libro;
  card.dataset.capitulo = String(capitulo);
  card.dataset.referencia = referencia;
  card.dataset.texto = texto;
  card.dataset.segmentos = JSON.stringify(tramos);

  if (info) info.style.display = "block";
  if (ref) ref.textContent = referencia;
  if (txt) {
    txt.textContent = texto;
    txt.style.maxHeight = "240px";
    txt.style.overflow = "auto";
  }

  if (btnExpandir) {
    btnExpandir.dataset.expandido = "0";
    btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
    btnExpandir.style.display = texto.length > 420 ? "block" : "none";
  }
}

function seleccionarVersiculoPredicaEnCard(card, num) {
  const nums = subidosNumsSeleccionados(card);

  if (nums.includes(num)) {
    subidosSetSeleccionados(card, nums.filter(n => n !== num));
  } else {
    subidosSetSeleccionados(card, [...nums, num]);
  }

  renderVersiculosPredicaEnCard(card);
  actualizarPreviewPredicaEnCard(card);
}

async function limpiarCitaPredica(card) {
  if (!card) return;

  const libro = card.querySelector(".subidosCitaLibro");
  const cap = card.querySelector(".subidosCitaCapitulo");
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  const nota = card.querySelector(".subidosCitaNota");

  if (libro) libro.value = "";
  if (cap) {
    cap.innerHTML = `<option value="">Seleccionar capítulo…</option>`;
    cap.disabled = true;
  }
  if (wrap) wrap.innerHTML = "";
  if (empty) empty.style.display = "";
  if (nota) nota.value = "";

  card.__versiculosData = [];
  card.__seleccionNums = [];
  delete card.dataset.libro;
  delete card.dataset.capitulo;
  delete card.dataset.referencia;
  delete card.dataset.texto;
  delete card.dataset.segmentos;

  limpiarPreviewCitaPredica(card);
  await poblarLibrosPredicaEnCard(card);
}

async function inicializarCardCitaPredica(card) {
  const selLibro = card.querySelector(".subidosCitaLibro");
  const selCap = card.querySelector(".subidosCitaCapitulo");

  await poblarLibrosPredicaEnCard(card);

  if (selLibro && !selLibro.__hookPredicaLibro) {
    selLibro.__hookPredicaLibro = true;
    selLibro.addEventListener("change", async () => {
      delete card.dataset.desde;
      delete card.dataset.hasta;
      delete card.dataset.referencia;
      delete card.dataset.texto;
      limpiarPreviewCitaPredica(card);
      await poblarCapitulosPredicaEnCard(card, selLibro.value);
      await poblarVersiculosPredicaEnCard(card, "", "");
    });
  }

  if (selCap && !selCap.__hookPredicaCap) {
    selCap.__hookPredicaCap = true;
    selCap.addEventListener("change", async () => {
      delete card.dataset.desde;
      delete card.dataset.hasta;
      delete card.dataset.referencia;
      delete card.dataset.texto;
      limpiarPreviewCitaPredica(card);
      await poblarVersiculosPredicaEnCard(
        card,
        selLibro?.value || "",
        selCap.value || ""
      );
    });
  }
}

async function recargarVersionPredicaCards() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  const cards = [...wrap.querySelectorAll(".subidos-cita-card")];

  for (const card of cards) {
    const libroPrev = card.querySelector(".subidosCitaLibro")?.value || "";
    const capPrev = card.querySelector(".subidosCitaCapitulo")?.value || "";
    const desdePrev = card.dataset.desde || "";
    const hastaPrev = card.dataset.hasta || "";

    await poblarLibrosPredicaEnCard(card, libroPrev);
    await poblarCapitulosPredicaEnCard(card, libroPrev, capPrev);
    await poblarVersiculosPredicaEnCard(card, libroPrev, capPrev);

    if (desdePrev) {
      card.dataset.desde = desdePrev;
      if (hastaPrev) card.dataset.hasta = hastaPrev;
      renderVersiculosPredicaEnCard(card);
      actualizarPreviewPredicaEnCard(card);
    }
  }
}

function recogerDatosPredicaSubidos() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal")?.value?.trim() || "";
  const introduccion = document.getElementById("subidosPredicaIntro")?.value?.trim() || "";
  const titulo = document.getElementById("subidosPredicaTitulo")?.value?.trim() || "";
  const fondoUrl = subidosFondoPredicaActual();
  const version = subidosVersionPredicaActual();

  const citas = [];

  [...(wrap?.querySelectorAll(".subidos-cita-card") || [])].forEach(card => {
    const libro = card.dataset.libro || "";
    const capitulo = Number(card.dataset.capitulo || 0);
    const referencia = card.dataset.referencia || "";
    const texto = card.dataset.texto || "";
    const comentario = card.querySelector(".subidosCitaNota")?.value?.trim() || "";
    const segmentos = JSON.parse(card.dataset.segmentos || "[]");

    const vacia = !libro && !capitulo && !referencia && !comentario;
    if (vacia) return;

    if (!libro || !capitulo || !referencia || !texto || !segmentos.length) {
      throw new Error("Hay una cita de prédica incompleta. Elegí libro, capítulo y versículo/s.");
    }

    citas.push({
      libro,
      capitulo,
      referencia,
      texto,
      comentario,
      segmentos,
      version
    });
  });

  return {
    version,
    titulo,
    fondoUrl,
    introduccion,
    citas,
    notaFinalGeneral: notaFinal
  };
}

function obtenerCitasPredicaSubido(it) {
  if (Array.isArray(it.predicaCitas)) return it.predicaCitas;
  if (Array.isArray(it.citasPredica)) return it.citasPredica;
  return [];
}

window.subidosToggleMiniPredica = function subidosToggleMiniPredica(bodyId, btn) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  const abierto = body.dataset.abierto === "1";

  if (abierto) {
    body.dataset.abierto = "0";
    body.style.display = "none";
    if (btn) btn.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  } else {
    body.dataset.abierto = "1";
    body.style.display = "block";
    if (btn) btn.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
  }
};

function htmlPredicaBibliaSubido(it) {
  const citas = obtenerCitasPredicaSubido(it);

  // ✅ En la galería mostramos solo la primera cita.
  if (!citas.length) return "";

  const primera = citas[0] || {};
  const referencia = String(primera.referencia || "").trim();
  const texto = String(primera.texto || "").trim();

  const tituloPredica = String(
    it?.predicaTitulo ||
    it?.tituloPredica ||
    it?.descripcion ||
    ""
  ).trim();

  // ✅ Usa el MISMO fondo elegido para el PNG y la prédica abierta.
  // Esta es la variable que tu CSS ya venía usando:
  // --subidos-predica-card-fondo
  const fondoUrl = subidosFondoPredicaActual(it);

  const idJs = String(it?.id || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");

  return `
    <div
      class="subidos-predica-resumen subidos-predica-resumen-unica"
      onclick="abrirSubidosVisorPredica('${idJs}', 'all')"
      title="Abrir prédica completa"
      role="button"
      tabindex="0"
    >
      ${tituloPredica ? `
        <div class="subidos-predica-card-titulo">
          ${escaparHtml(tituloPredica)}
        </div>
      ` : ``}

      <div
        class="subidos-predica-primera"
        style="--subidos-predica-card-fondo:url('${subidosCssUrl(fondoUrl)}');"
      >
        ${referencia ? `
          <div class="subidos-predica-primera-ref">
            ${escaparHtml(referencia)}
          </div>
        ` : ``}

        ${texto ? `
          <div class="subidos-predica-primera-texto">
            ${subidosTextoHtml(texto)}
          </div>
        ` : ``}
      </div>
    </div>
  `;
}

window.subidosToggleBibliaPredica = function subidosToggleBibliaPredica(id) {
  const box = document.getElementById(`subidosPredicaTexto-${id}`);
  const btn = document.getElementById(`subidosPredicaBtn-${id}`);
  if (!box || !btn) return;

  const expandido = box.dataset.expandido === "1";

  if (expandido) {
    box.dataset.expandido = "0";
    box.style.maxHeight = "118px";
    box.style.overflow = "auto";
    btn.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  } else {
    box.dataset.expandido = "1";
    box.style.maxHeight = "250px";
    box.style.overflow = "auto";
    btn.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
  }
};

window.subidosToggleDetallePredica = function subidosToggleDetallePredica(id) {
  const body = document.getElementById(id);
  const ico = document.querySelector(`[data-toggle-icon="${id}"]`);
  if (!body) return;

  const abierto = body.style.display !== "none";

  if (abierto) {
    body.style.display = "none";
    if (ico) ico.className = "fa-solid fa-caret-down";
  } else {
    body.style.display = "block";
    if (ico) ico.className = "fa-solid fa-caret-up";
  }
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function fechaYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escaparHtml(txt = "") {
  return String(txt).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function blobToBase64(blob){
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.readAsDataURL(blob);
  });
}

async function subirArchivoAR2DesdeWeb(file, folder = "subidos"){
  const fileBase64 = await blobToBase64(file);

  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName: file.name || `archivo_${Date.now()}`,
      contentType: file.type || "application/octet-stream",
      folder
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir archivo a R2");
  }

  return data;
}

/* ================= VIDEOS GRANDES: SUBIDA DIRECTA A R2 ================= */

function subidosEsVideoFile(file) {
  return !!file && String(file.type || "").startsWith("video/");
}

function subidosObtenerPreviewVideoInfo(it = {}, archivo = null, idx = 0) {
  return {
    url: String(
      archivo?.videoPreviewUrl ||
      (idx === 0 ? (it?.videoPreviewUrl || "") : "")
    ).trim(),

    r2Key: String(
      archivo?.videoPreviewR2Key ||
      (idx === 0 ? (it?.videoPreviewR2Key || "") : "")
    ).trim(),

    mimeType: String(
      archivo?.videoPreviewMimeType ||
      (idx === 0 ? (it?.videoPreviewMimeType || "") : "")
    ).trim(),

    fileName: String(
      archivo?.videoPreviewFileName ||
      (idx === 0 ? (it?.videoPreviewFileName || "") : "")
    ).trim()
  };
}

function subidosHtmlPosterVideo(previewUrl = "", alt = "Video") {
  const src = String(previewUrl || "").trim();
  const nombre = escaparHtml(alt || "Video");

  if (src) {
    return `
      <div class="subidos-video-poster">
        <img src="${src}" alt="${nombre}" loading="lazy" decoding="async">
        <span class="subidos-video-play subidos-video-play--pretty">
          <i class="fa-solid fa-play"></i>
        </span>
      </div>
    `;
  }

  return `
    <div class="subidos-video-poster subidos-video-poster--fallback">
      <div class="subidos-video-poster-fallback">
        <i class="fa-solid fa-video"></i>
      </div>

      <span class="subidos-video-play subidos-video-play--pretty">
        <i class="fa-solid fa-play"></i>
      </span>
    </div>
  `;
}

function subidosEsperarEventoMedia(el, evento, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let listo = false;

    const limpiar = () => {
      el.removeEventListener(evento, ok);
      el.removeEventListener("error", fail);
      clearTimeout(timer);
    };

    const ok = () => {
      if (listo) return;
      listo = true;
      limpiar();
      resolve();
    };

    const fail = () => {
      if (listo) return;
      listo = true;
      limpiar();
      reject(new Error(`No llegó el evento ${evento}.`));
    };

    const timer = setTimeout(fail, timeoutMs);

    el.addEventListener(evento, ok, { once: true });
    el.addEventListener("error", fail, { once: true });
  });
}

async function subidosGenerarBlobVistaPreviaVideo(file) {
  if (!file) throw new Error("Falta el video para la vista previa.");

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = objectUrl;

  try {
    video.load?.();
    await subidosEsperarEventoMedia(video, "loadedmetadata");

    if (video.readyState < 2) {
      try {
        await subidosEsperarEventoMedia(video, "loadeddata", 12000);
      } catch (e) {}
    }

    const duration = Number(video.duration || 0);
    let frameTime = 0;

    if (Number.isFinite(duration) && duration > 0.6) {
      frameTime = Math.min(1.2, Math.max(0.15, duration * 0.2));
    }

    if (frameTime > 0) {
      try {
        video.currentTime = frameTime;
        await subidosEsperarEventoMedia(video, "seeked", 12000);
      } catch (e) {}
    }

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    const maxLado = 1600;
    const escala = Math.min(1, maxLado / Math.max(vw, vh));

    const cw = Math.max(1, Math.round(vw * escala));
    const ch = Math.max(1, Math.round(vh * escala));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(video, 0, 0, cw, ch);

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) {
      throw new Error("No se pudo crear la captura del video.");
    }

    return blob;
  } finally {
    try { URL.revokeObjectURL(objectUrl); } catch (e) {}
  }
}

async function subidosCrearVistaPreviaVideoAlGuardar(file, estadoEl = null, idx = 0) {
  try {
    if (estadoEl) {
      estadoEl.textContent = `Generando vista previa del video ${idx + 1}...`;
    }

    const blobPreview = await subidosGenerarBlobVistaPreviaVideo(file);

    const nombre = `${subidosNombreBaseSinExtension(file.name || `video_${idx + 1}`)}_preview.jpg`;

    const previewFile = new File(
      [blobPreview],
      nombre,
      { type: "image/jpeg" }
    );

    if (estadoEl) {
      estadoEl.textContent = `Subiendo vista previa del video ${idx + 1}...`;
    }

    const subida = await subirArchivoAR2DesdeWeb(previewFile, "subidos-previews");

    if (!subida?.url) {
      return {
        videoPreviewUrl: "",
        videoPreviewR2Key: "",
        videoPreviewMimeType: "",
        videoPreviewFileName: ""
      };
    }

    return {
      videoPreviewUrl: subida.url || "",
      videoPreviewR2Key: subida.key || "",
      videoPreviewMimeType: subida.contentType || "image/jpeg",
      videoPreviewFileName: subida.fileName || nombre
    };
  } catch (e) {
    console.warn("No pude generar la vista previa del video:", e);

    return {
      videoPreviewUrl: "",
      videoPreviewR2Key: "",
      videoPreviewMimeType: "",
      videoPreviewFileName: ""
    };
  }
}

function subidosArchivosItem(it = {}) {
  const arr = Array.isArray(it.archivos)
    ? it.archivos.filter(a => a && String(a.url || "").trim())
    : [];

  if (arr.length) {
    return arr.map((a, i) => ({
      url: a.url || "",
      r2Key: a.r2Key || "",
      mimeType: a.mimeType || a.contentType || "",
      fileName: a.fileName || `archivo_${i + 1}`,
      sizeBytes: Number(a.sizeBytes || 0),
      subidaDirectaVideo: !!a.subidaDirectaVideo,

      videoPreviewUrl: a.videoPreviewUrl || "",
      videoPreviewR2Key: a.videoPreviewR2Key || "",
      videoPreviewMimeType: a.videoPreviewMimeType || "",
      videoPreviewFileName: a.videoPreviewFileName || "",

      shareUrl: a.shareUrl || "",
      shareR2Key: a.shareR2Key || "",
      shareMimeType: a.shareMimeType || "",
      shareFileName: a.shareFileName || ""
    }));
  }

  if (it.url) {
    return [{
      url: it.url || "",
      r2Key: it.r2Key || "",
      mimeType: it.mimeType || "",
      fileName: it.fileName || "archivo",
      sizeBytes: Number(it.sizeBytes || 0),
      subidaDirectaVideo: !!it.subidaDirectaVideo,

      videoPreviewUrl: it.videoPreviewUrl || "",
      videoPreviewR2Key: it.videoPreviewR2Key || "",
      videoPreviewMimeType: it.videoPreviewMimeType || "",
      videoPreviewFileName: it.videoPreviewFileName || "",

      shareUrl: it.shareUrl || "",
      shareR2Key: it.shareR2Key || "",
      shareMimeType: it.shareMimeType || "",
      shareFileName: it.shareFileName || ""
    }];
  }

  return [];
}

function subidosArchivoPrincipal(it = {}) {
  return subidosArchivosItem(it)[0] || null;
}

function subidosEsVideoItem(it) {
  const a = subidosArchivoPrincipal(it);
  return String(a?.mimeType || it?.mimeType || "").startsWith("video/");
}

function subidosContentTypeVideo(file) {
  const tipo = String(file?.type || "").trim();
  if (tipo) return tipo;

  const nombre = String(file?.name || "").toLowerCase();

  if (nombre.endsWith(".mov")) return "video/quicktime";
  if (nombre.endsWith(".webm")) return "video/webm";

  return "video/mp4";
}

function subidosFormatoMB(bytes = 0) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1);
}

async function subirVideoR2DirectoSubidos(file, estadoEl = null) {
  if (!file) throw new Error("Falta video.");

  const contentType = subidosContentTypeVideo(file);

  const permitidos = ["video/mp4", "video/webm", "video/quicktime"];
  if (!permitidos.includes(contentType)) {
    throw new Error("Tipo de video no permitido. Usá MP4, WEBM o MOV.");
  }

  const maxBytes = 80 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`Video demasiado grande: ${subidosFormatoMB(file.size)} MB. Máximo inicial: 80 MB.`);
  }

  if (estadoEl) {
    estadoEl.textContent = `Subiendo video a R2 (${subidosFormatoMB(file.size)} MB)...`;
  }

  // ✅ Sin base64 y sin Firebase Functions.
  // El video viaja como archivo real al Worker.
  const form = new FormData();
  form.append("file", file);
  form.append("destino", "subidos");
  form.append("folder", "videos/subidos");
  form.append("contentType", contentType);

  const r = await fetch(SUBIDOS_VIDEO_UPLOAD_URL, {
    method: "POST",
    body: form
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir video a R2.");
  }

  return {
    ok: true,
    url: data.url,
    key: data.key || "",
    fileName: data.fileName || file.name || `video_${Date.now()}.mp4`,
    contentType: data.contentType || contentType,
    sizeBytes: Number(data.sizeBytes || file.size || 0),
    subidaDirectaVideo: true
  };
}

function subidosDescargarVideoDirecto(it) {
  if (!it?.url) {
    alert("Este video no tiene URL.");
    return;
  }

  const a = document.createElement("a");
  a.href = it.url;
  a.download = subidosNombreLimpio(it.fileName || `video_${Date.now()}.mp4`);
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function subidosCompartirLinkVideo(it) {
  if (!it?.url) {
    alert("Este video no tiene URL para compartir.");
    return;
  }

  const titulo = it.etiqueta || "Video";
  const texto = [it.etiqueta || "Video", it.descripcion || ""]
    .filter(Boolean)
    .join(" — ");

  if (navigator.share) {
    await navigator.share({
      title: titulo,
      text: texto,
      url: it.url
    });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(it.url);
    alert("Link del video copiado.");
    return;
  }

  prompt("Copiá este link:", it.url);
}

function nombreMes(d) {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function setSubidosModalTitulo(texto) {
  const ttlTexto = document.getElementById("subidosModalTituloTexto");
  if (ttlTexto) {
    ttlTexto.textContent = String(texto || "").trim() || "Nuevo subido";
    return;
  }

  // fallback por si alguna vez no existiera el span interno
  const ttl = document.getElementById("subidosModalTitulo");
  if (ttl) ttl.textContent = String(texto || "").trim() || "Nuevo subido";
}

function abrirModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;

  const fecha = document.getElementById("subidosFecha");
  const archivo = document.getElementById("subidosArchivo");
  const descripcion = document.getElementById("subidosDescripcion");
  const estado = document.getElementById("subidosEstado");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const ttl = document.getElementById("subidosModalTitulo");
  const archivoBox = document.getElementById("subidosArchivoActualBox");
  const archivoNombre = document.getElementById("subidosArchivoActualNombre");
  const btnVerArchivo = document.getElementById("btnVerArchivoActualSubido");

  subidosEditandoId = null;

  setSubidosModalTitulo("Nuevo subido");
  if (archivo) archivo.value = "";
  if (descripcion) descripcion.value = "";
  if (estado) estado.textContent = "";
  if (fecha) fecha.value = fechaYMD(new Date());
  if (etiqueta) etiqueta.value = "";
  if (archivoBox) archivoBox.style.display = "none";
  if (archivoNombre) archivoNombre.textContent = "";
  if (btnVerArchivo) btnVerArchivo.onclick = null;
  
delete m.dataset.cumpleHermanoId;
delete m.dataset.cumpleTelefono;
delete m.dataset.cumpleNombre;
  
  resetPredicaSubidosUI();
  actualizarPredicaSubidosUI();

  m.style.display = "flex";
  m.setAttribute("aria-hidden", "false");
}

window.cerrarModalSubidos = function cerrarModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;

  const ttl = document.getElementById("subidosModalTitulo");
  setSubidosModalTitulo("Nuevo subido");

  subidosEditandoId = null;
  m.style.display = "none";
  m.setAttribute("aria-hidden", "true");
};

function poblarEtiquetas() {
  const sel = document.getElementById("subidosEtiqueta");
  if (!sel) return;

  const lista = Array.from(new Set([...(subidosEtiquetas || []), ...ETIQUETAS_DEFAULT])).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">Seleccionar…</option>` +
    lista.map(x => `<option value="${escaparHtml(x)}">${escaparHtml(x)}</option>`).join("");
}

function renderMesTitulo() {
  const el = document.getElementById("subidosMesTitulo");
  if (!el) return;
  el.textContent = nombreMes(subidosMesActual);
}

function agruparPorFecha(items) {
  const map = {};
  items.forEach(it => {
    const f = it.fechaEvento || "";
    if (!f) return;
    map[f] = map[f] || [];
    map[f].push(it);
  });
  return map;
}

const SUBIDOS_EVENTOS_HABITUALES = [
  {
    slug: "racimos",
    etiqueta: "Racimo",
    descripcion: "Racimos - 18 hs",
    diaSemana: 2
  },
  {
    slug: "oracion",
    etiqueta: "Oración",
    descripcion: "Oración - 17 a 19 hs",
    diaSemana: 4
  },
  {
    slug: "reunion-general",
    etiqueta: "Predica",
    descripcion: "Reunión general",
    diaSemana: 0
  }
];

function subidosIdHabitual(fechaEvento, slug) {
  return `habitual::${fechaEvento}::${slug}`;
}

function subidosBuscarRealHabitual(fechaEvento, etiqueta) {
  const key = normalizarEtiquetaSubidos(etiqueta);

  return subidosItems.find(it =>
    it.fechaEvento === fechaEvento &&
    normalizarEtiquetaSubidos(it.etiqueta || "") === key
  ) || null;
}

function subidosEventosHabitualesDelMes(year, month) {
  const items = [];
  const ultimoDia = new Date(year, month + 1, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(year, month, dia);
    const fechaEvento = fechaYMD(d);

    SUBIDOS_EVENTOS_HABITUALES.forEach(ev => {
      if (d.getDay() !== ev.diaSemana) return;

      const real = subidosBuscarRealHabitual(fechaEvento, ev.etiqueta);
      if (real) return;

      items.push({
        id: subidosIdHabitual(fechaEvento, ev.slug),
        fecha: 0,
        fechaEvento,
        etiqueta: ev.etiqueta,
        descripcion: ev.descripcion,
        esHabitualVirtual: true
      });
    });
  }

  return items;
}

function subidosHabitualDesdeId(id) {
  const partes = String(id || "").split("::");
  if (partes.length !== 3) return null;

  const fechaEvento = partes[1];
  const slug = partes[2];
  const ev = SUBIDOS_EVENTOS_HABITUALES.find(x => x.slug === slug);

  if (!ev) return null;

  return {
    fechaEvento,
    etiqueta: ev.etiqueta,
    descripcion: ev.descripcion
  };
}

function abrirNuevoHabitualDesdeCalendario(id) {
  if (!subidosEsAdmin) {
    alert("Solo admin puede crear o editar este evento.");
    return;
  }

  const ev = subidosHabitualDesdeId(id);
  if (!ev) return;

  abrirModalSubidos();

  const ttl = document.getElementById("subidosModalTitulo");
  const fecha = document.getElementById("subidosFecha");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const descripcion = document.getElementById("subidosDescripcion");
  const archivo = document.getElementById("subidosArchivo");

  setSubidosModalTitulo("Nuevo evento habitual");
  if (fecha) fecha.value = ev.fechaEvento;
  if (etiqueta) etiqueta.value = ev.etiqueta;
  if (descripcion) descripcion.value = ev.descripcion;
  if (archivo) archivo.value = "";

  actualizarPredicaSubidosUI();
}

function renderCalendario() {
  const box = document.getElementById("subidosCalendario");
  if (!box) return;

  const year = subidosMesActual.getFullYear();
  const month = subidosMesActual.getMonth();

  const hoy = new Date();
  const hoyYMD = fechaYMD(hoy);

  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const diasMes = ultimoDia.getDate();

  let inicioSemana = primerDia.getDay();
  if (inicioSemana === 0) inicioSemana = 7;

  const habitualesMes = subidosEventosHabitualesDelMes(year, month);

  // ✅ Los cumpleaños NO van como chip normal.
  const itemsSinCumple = subidosItems.filter(it => !subidosEsCumpleanos(it.etiqueta || ""));

  const porFecha = agruparPorFecha([...itemsSinCumple, ...habitualesMes]);
  const diasHeader = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  let html = `
    <div class="subidos-cal-wrap">
      <div class="subidos-cal-head">
        ${diasHeader.map(d => `<div>${d}</div>`).join("")}
      </div>
      <div class="subidos-cal-grid">
  `;

  for (let i = 1; i < inicioSemana; i++) {
    html += `<div class="subidos-day empty" aria-hidden="true"></div>`;
  }

  for (let dia = 1; dia <= diasMes; dia++) {
    const f = `${year}-${pad(month + 1)}-${pad(dia)}`;
    const itemsDia = (porFecha[f] || []).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
    const cumplesDia = subidosCumplesDia(f);
    const esHoy = f === hoyYMD;

    const tituloCumple = cumplesDia.length === 1
      ? `Cumpleaños: ${cumplesDia[0].nombreCompleto || cumplesDia[0].descripcion || ""}`
      : `Cumpleaños: ${cumplesDia.length}`;

    html += `
      <div class="subidos-day ${esHoy ? "today" : ""}">
        <div class="subidos-day-num">${dia}</div>

        ${cumplesDia.length ? `
          <button
            type="button"
            class="subidos-cumple-icon"
            onclick="abrirCumpleanosDesdeCalendario('${f}')"
            title="${subidosEsc(tituloCumple)}"
            aria-label="${subidosEsc(tituloCumple)}"
          >
            <i class="fa-solid fa-cake-candles"></i>
          </button>
        ` : ``}

        <div class="subidos-day-events">
          ${itemsDia.slice(0, 3).map(it => {
            const color = colorEtiquetaSubidos(it.etiqueta || "");
            const titulo = escaparHtml(it.descripcion || it.etiqueta || "Subido");

            return `
              <button
                type="button"
                class="subidos-chip"
                onclick="abrirSubidoDesdeCalendario('${it.id}')"
                style="background:${color.bg}; color:${color.fg};"
                title="${titulo}"
              >
                ${titulo}
              </button>
            `;
          }).join("")}

          ${itemsDia.length > 3 ? `
            <div class="subidos-more">+ ${itemsDia.length - 3} más</div>
          ` : ``}
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  box.innerHTML = html;
}

function iconoSegunTipo(tipo = "") {
  if (tipo.startsWith("image/")) return "fa-image";
  if (tipo.startsWith("video/")) return "fa-video";
  if (tipo.startsWith("audio/")) return "fa-headphones";
  return "fa-file";
}

function normalizarEtiquetaSubidos(txt = "") {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const ETIQUETAS_COLOR = {
  "predica": "#35c6b7",
  "anuncio": "#ff0000",
  "plan": "#d2ff00",
  "racimo": "#00afff",
  "oracion": "#ff8000",
  "cumpleanos": "#ff5fb7",
  "santa cena": "#a800ff",
  "reunion jovenes": "#00ff79",
  "reunion de jovenes": "#00ff79",
  "reunion varones": "#008fff",
  "reunion de varones": "#008fff",
  "reunion mujeres": "#ff00a0",
  "reunion de mujeres": "#ff00a0",
  "taller": "#7200ff",
  "retiro varones": "#0004ff",
  "retiro de varones": "#0004ff",
  "ayuno": "#ff4da6"
};

function colorEtiquetaSubidos(etiqueta = "") {
  const t = normalizarEtiquetaSubidos(etiqueta);
  const color = ETIQUETAS_COLOR[t] || "#8babfa";

  return {
    bg: color,
    fg: "#ffffff"
  };
}

window.subidosMostrarPreview = function subidosMostrarPreview() {};
window.subidosMoverPreview = function subidosMoverPreview() {};
window.subidosOcultarPreview = function subidosOcultarPreview() {};

function obtenerSubidoPorId(id) {
  return subidosItems.find(x => x.id === id) || null;
}

function subidosEsCumpleanos(etiqueta = "") {
  return normalizarEtiquetaSubidos(etiqueta) === "cumpleanos";
}

function subidosEsc(txt = "") {
  return String(txt ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subidosNombreCompletoHermano(h = {}) {
  return `${h.nombre || ""} ${h.apellido || ""}`.trim() || "Sin nombre";
}

function subidosPrimerNombre(txt = "") {
  return String(txt || "").trim().split(/\s+/)[0] || "hermano";
}

function subidosCumpleValor(h = {}) {
  return String(
    h.cumpleanos ||
    h.cumpleaños ||
    h.fechaCumpleanos ||
    h.fechaCumpleaños ||
    ""
  ).trim();
}

function subidosFechaCumpleEnAnio(cumple = "", year) {
  const s = String(cumple || "").trim();
  if (!s) return "";

  // Esperado desde input type="date": YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";

  const mes = m[2];
  const dia = m[3];

  return `${year}-${mes}-${dia}`;
}

function subidosIdCumple(fechaEvento, hermanoId) {
  return `cumple::${fechaEvento}::${hermanoId}`;
}

function subidosCumpleanosDelMes(year, month) {
  return (subidosHermanosCumples || [])
    .map(h => {
      const fechaEvento = subidosFechaCumpleEnAnio(subidosCumpleValor(h), year);
      if (!fechaEvento) return null;

      const partes = fechaEvento.split("-");
      const mes = Number(partes[1] || 0) - 1;

      if (mes !== month) return null;

      const nombreCompleto = subidosNombreCompletoHermano(h);

      return {
        id: subidosIdCumple(fechaEvento, h.id),
        fecha: 0,
        fechaEvento,
        etiqueta: "Cumpleaños",
        descripcion: `Cumpleaños de ${nombreCompleto}`,
        esCumpleVirtual: true,
        hermanoId: h.id,
        nombreCompleto,
        telefono: h.telefono || "",
        cumpleOriginal: subidosCumpleValor(h)
      };
    })
    .filter(Boolean);
}

function subidosCumplesDia(fechaEvento) {
  const fecha = String(fechaEvento || "").trim();
  if (!fecha) return [];

  const partes = fecha.split("-");
  const year = Number(partes[0] || 0);
  const month = Number(partes[1] || 1) - 1;

  const desdeContactos = subidosCumpleanosDelMes(year, month)
    .filter(it => it.fechaEvento === fecha);

  const desdeSubidos = subidosItems
    .filter(it =>
      it.fechaEvento === fecha &&
      subidosEsCumpleanos(it.etiqueta || "")
    )
    .map(it => ({
      ...it,
      esCumpleReal: true,
      nombreCompleto: it.cumpleNombre || it.descripcion || "Cumpleaños",
      telefono: it.cumpleTelefono || ""
    }));

  return [...desdeContactos, ...desdeSubidos];
}

function subidosBuscarCumpleItem(id) {
  const raw = String(id || "").trim();
  if (!raw) return null;

  if (!raw.startsWith("cumple::")) {
    return obtenerSubidoPorId(raw);
  }

  const partes = raw.split("::");
  const fechaEvento = partes[1] || "";

  return subidosCumplesDia(fechaEvento).find(x => String(x.id) === raw) || null;
}

function subidosTelefonoWhatsApp(telefono) {
  let n = String(telefono || "").replace(/\D/g, "");

  if (!n) return "";

  if (n.startsWith("549")) return n;

  if (n.startsWith("54")) {
    return "549" + n.slice(2).replace(/^15/, "");
  }

  n = n.replace(/^0+/, "").replace(/^15/, "");
  return "549" + n;
}

window.enviarWhatsAppCumpleSubidos = function enviarWhatsAppCumpleSubidos(id) {
  const it = subidosBuscarCumpleItem(id);
  if (!it) return;

  const numero = subidosTelefonoWhatsApp(it.telefono || it.cumpleTelefono || "");

  if (!numero) {
    alert("Este contacto no tiene teléfono cargado.");
    return;
  }

  const nombre = subidosPrimerNombre(it.nombreCompleto || it.cumpleNombre || it.descripcion || "");

  const texto = [
    `Feliz Cumpleaños, ${nombre} 🎂🎉`,
    ``,
    `Que el Señor te bendiga grandemente en este día tan especial.`
  ].join("\n");

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
};

window.abrirEditarCumpleanosSubidos = function abrirEditarCumpleanosSubidos(id) {
  if (!subidosEsAdmin) {
    alert("Solo admin puede editar cumpleaños.");
    return;
  }

  const it = subidosBuscarCumpleItem(id);
  if (!it) return;

  // Si ya es un subido real, editamos ese subido.
  if (!it.esCumpleVirtual && it.id) {
    cerrarModalSubidosVisor();
    abrirEditarSubido(it.id);
    return;
  }

  cerrarModalSubidosVisor();
  abrirModalSubidos();

  const modal = document.getElementById("modalSubidos");
  const fecha = document.getElementById("subidosFecha");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const descripcion = document.getElementById("subidosDescripcion");
  const archivo = document.getElementById("subidosArchivo");

  setSubidosModalTitulo("Cumpleaños");

  if (modal) {
    modal.dataset.cumpleHermanoId = it.hermanoId || "";
    modal.dataset.cumpleTelefono = it.telefono || "";
    modal.dataset.cumpleNombre = it.nombreCompleto || "";
  }

  if (fecha) fecha.value = it.fechaEvento || fechaYMD(new Date());
  if (etiqueta) etiqueta.value = "Cumpleaños";
  if (descripcion) descripcion.value = it.descripcion || `Cumpleaños de ${it.nombreCompleto || ""}`;
  if (archivo) archivo.value = "";

  actualizarPredicaSubidosUI();
};

window.abrirCumpleanosDesdeCalendario = function abrirCumpleanosDesdeCalendario(fechaEvento) {
  const items = subidosCumplesDia(fechaEvento);

  if (!items.length) return;

  const fechaTxt = new Date(fechaEvento + "T00:00:00").toLocaleDateString("es-AR");

  const html = `
    <style>
      .subidos-cumple-lista{
        display:grid;
        gap:12px;
      }

      .subidos-cumple-row{
        background:#fff;
        color:#000;
        border:1px solid rgba(0,0,0,.10);
        border-radius:16px;
        padding:12px;
        display:grid;
        gap:8px;
      }

      .subidos-cumple-nombre{
        font-weight:900;
        font-size:17px;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .subidos-cumple-fecha{
        font-size:13px;
        opacity:.75;
        font-weight:700;
      }

      .subidos-cumple-acciones{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .subidos-cumple-acciones button{
        border:none;
        border-radius:999px;
        padding:9px 12px;
        background:var(--ui-azul-claro, #bcdcff);
        color:#000;
        font-weight:900;
        cursor:pointer;
      }
    </style>

    <div class="subidos-cumple-lista">
      ${items.map(it => {
        const idJs = subidosJs(it.id || "");
        const nombre = it.nombreCompleto || it.cumpleNombre || it.descripcion || "Cumpleaños";

        return `
          <div class="subidos-cumple-row">
            <div class="subidos-cumple-nombre">
              <i class="fa-solid fa-cake-candles"></i>
              ${subidosEsc(nombre)}
            </div>

            <div class="subidos-cumple-fecha">
              ${subidosEsc(fechaTxt)} · Etiqueta: Cumpleaños
            </div>

            <div class="subidos-cumple-acciones">
              <button type="button" onclick="enviarWhatsAppCumpleSubidos('${idJs}')">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
              </button>

              ${subidosEsAdmin ? `
                <button type="button" onclick="abrirEditarCumpleanosSubidos('${idJs}')">
                  Editar
                </button>
              ` : ``}
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  abrirModalSubidosVisor("Cumpleaños", html);
};

const SUBIDOS_IMAGEN_HORARIOS_URL = "img/subidos/horarios-habituales.png?v=2026-05-07-historia";

window.abrirImagenHorariosSubidos = function abrirImagenHorariosSubidos() {
  abrirModalSubidosVisor(
    "Horarios habituales",
    `<img src="${SUBIDOS_IMAGEN_HORARIOS_URL}" alt="Horarios habituales">`
  );
};

function htmlImagenFijaHorariosSubidos() {
  return `
    <div id="subidos-imagen-horarios" class="subidos-feed-card subidos-card-imagen-fija">
      <div class="subidos-media">
        <button
          type="button"
          onclick="abrirImagenHorariosSubidos()"
          class="subidos-media-link subidos-media-frame is-image"
          title="Ver horarios habituales"
        >
          <img
            src="${SUBIDOS_IMAGEN_HORARIOS_URL}"
            alt="Horarios habituales"
            loading="lazy"
            decoding="async"
          >
        </button>
      </div>
    </div>
  `;
}

function subidosTieneContenidoPredica(it) {
  return !!(obtenerCitasPredicaSubido(it).length || String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim());
}

function subidosBaseUrlApp() {
  const url = new URL(window.location.href);
  let path = url.pathname;

  if (path.endsWith("/")) path = path.slice(0, -1);

  const partes = path.split("/");
  const ultimo = partes[partes.length - 1] || "";

  if (ultimo.includes(".")) {
    partes.pop();
    path = partes.join("/");
  }

  return url.origin + path.replace(/\/$/, "");
}

function subidosNormalizarRefPredica(txt = "") {
  return String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function subidosNumeroDesdePredicaRef(refTxt = "", fechaEvento = "") {
  const ref = String(refTxt || "").trim();
  const fecha = String(fechaEvento || "").trim();

  if (!ref || !fecha) return 0;

  const m = ref.match(new RegExp("^" + fecha.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "-(\\d+)$"));
  return m ? Number(m[1] || 0) : 0;
}

function subidosListaPredicasMismaFecha(fechaEvento = "", excluirId = "") {
  const fecha = String(fechaEvento || "").trim();
  const excluir = String(excluirId || "").trim();

  if (!fecha) return [];

  return subidosItems
    .filter(it =>
      String(it.id || "") !== excluir &&
      esPredicaSubidos(it.etiqueta || "") &&
      String(it.fechaEvento || "") === fecha
    )
    .sort((a, b) => {
      const fa = Number(a.fecha || 0);
      const fb = Number(b.fecha || 0);
      if (fa !== fb) return fa - fb;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function subidosCrearPredicaRef(fechaEvento = "", excluirId = "") {
  const fecha = String(fechaEvento || "").trim() || fechaYMD(new Date());
  const existentes = subidosListaPredicasMismaFecha(fecha, excluirId);

  const maxNumeroGuardado = existentes.reduce((max, it) => {
    const n = subidosNumeroDesdePredicaRef(it.predicaRef || "", fecha);
    return Math.max(max, n);
  }, 0);

  const numero = Math.max(maxNumeroGuardado, existentes.length) + 1;

  return `${fecha}-${numero}`;
}

function subidosRefPredicaItem(it = {}) {
  if (it.predicaRef) return String(it.predicaRef || "").trim();

  const fecha = String(it.fechaEvento || "").trim();
  if (!fecha) return String(it.id || "").trim();

  const lista = subidosListaPredicasMismaFecha(fecha, "");

  const index = lista.findIndex(x => String(x.id || "") === String(it.id || ""));
  const numero = index >= 0 ? index + 1 : 1;

  return `${fecha}-${numero}`;
}

function subidosBuscarPredicaPorReferencia(refTxt = "") {
  const refLimpia = decodeURIComponent(String(refTxt || "").trim());
  if (!refLimpia) return null;

  // ✅ Compatibilidad: si entra el ID raro viejo, también abre.
  const porId = obtenerSubidoPorId(refLimpia);
  if (porId) return porId;

  const refNorm = subidosNormalizarRefPredica(refLimpia);

  const candidatas = subidosItems
    .filter(it => subidosEsPredicaConContenido(it))
    .filter(it => {
      const guardada = subidosNormalizarRefPredica(it.predicaRef || "");
      const calculada = subidosNormalizarRefPredica(subidosRefPredicaItem(it));
      const fecha = String(it.fechaEvento || "").trim();

      return (
        guardada === refNorm ||
        calculada === refNorm ||
        fecha === refLimpia
      );
    })
    .sort((a, b) => {
      const fa = Number(a.fecha || 0);
      const fb = Number(b.fecha || 0);
      if (fa !== fb) return fa - fb;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

  return candidatas[0] || null;
}

function subidosTextoPlanoPredica(it) {
  const citas = obtenerCitasPredicaSubido(it);
  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();

  const partes = [];
  if (it.etiqueta) partes.push(it.etiqueta);
  if (it.fechaEvento) partes.push(it.fechaEvento);
  if (it.descripcion) partes.push(it.descripcion);

  citas.forEach(c => {
    partes.push(c.referencia || "");
    if (c.texto) partes.push(c.texto);
    if (c.comentario || c.nota) partes.push(`Comentario: ${c.comentario || c.nota}`);
  });

  if (notaFinal) partes.push(`Nota: ${notaFinal}`);

  return partes.filter(Boolean).join("\n\n").trim();
}

function subidosLimpiarHashDetalle() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  if (!rawHash.startsWith("subido=")) return;

  const url = new URL(window.location.href);
  url.hash = "";
  history.replaceState(null, "", url.pathname + url.search);
}

window.cerrarModalSubidosVisor = function cerrarModalSubidosVisor() {
  const m = document.getElementById("modalSubidosVisor");
  const body = document.getElementById("subidosVisorBody");
  const ttl = document.getElementById("subidosVisorTitulo");
  if (!m) return;

  if (body) body.innerHTML = "";
  if (ttl) ttl.textContent = "Vista previa";

  m.style.display = "none";
  m.setAttribute("aria-hidden", "true");

  subidosLimpiarHashDetalle();
};

function abrirModalSubidosVisor(titulo, html) {
  const m = document.getElementById("modalSubidosVisor");
  const body = document.getElementById("subidosVisorBody");
  const ttl = document.getElementById("subidosVisorTitulo");
  if (!m || !body || !ttl) return;

  ttl.textContent = titulo || "Vista previa";
  body.innerHTML = html || "";
  m.style.display = "flex";
  m.setAttribute("aria-hidden", "false");
}

function subidosLinkDetalle(id) {
  const base = subidosBaseUrlApp();
  const it = obtenerSubidoPorId(id);

  const ref = it && subidosEsPredicaConContenido(it)
    ? subidosRefPredicaItem(it)
    : id;

  return `${base}/predica/?ref=${encodeURIComponent(ref)}`;
}

function subidosEsperarImagenes(node) {
  const imgs = [...node.querySelectorAll("img")];

  return Promise.all(
    imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();

      return new Promise(resolve => {
        const fin = () => {
          clearTimeout(timer);
          resolve();
        };

        const timer = setTimeout(fin, 12000);

        img.addEventListener("load", fin, { once: true });
        img.addEventListener("error", fin, { once: true });
      });
    })
  );
}

function subidosAnchoExportPredica() {
  // 420 x 747 aprox = historia 9:16
  return 420;
}

function subidosTextoPlanoExport(txt = "") {
  return String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map(linea =>
      String(linea || "")
        .replace(/^[\s\u00A0]+/g, "")
        .replace(/[\s\u00A0]+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function subidosHtmlExport(txt = "") {
  return escaparHtml(subidosTextoPlanoExport(txt)).replace(/\n/g, "<br>");
}

function subidosFechaBonitaExport(ymd = "") {
  if (!ymd) return "";
  try {
    return new Date(ymd + "T00:00:00").toLocaleDateString("es-AR");
  } catch {
    return ymd;
  }
}

function subidosArchivoExportHtml(it) {
  const archivo = subidosArchivoPrincipal(it);
  const url = String(archivo?.url || it?.url || "").trim();
  const mime = String(archivo?.mimeType || it?.mimeType || "");
  const nombre = escaparHtml(archivo?.fileName || it?.fileName || "archivo");
  const preview = subidosObtenerPreviewVideoInfo(it, archivo, 0);

  if (!url) return "";

  if (mime.startsWith("image/")) {
    return `
      <div class="subidos-export-media">
        <img src="${url}" alt="${nombre}">
      </div>
    `;
  }

  if (mime.startsWith("video/")) {
    if (preview.url) {
      return `
        <div class="subidos-export-media" style="position:relative;">
          <div style="position:relative; width:100%; height:100%; overflow:hidden; border-radius:22px;">
            <img
              src="${preview.url}"
              alt="${nombre}"
              style="width:100%; height:100%; object-fit:cover; display:block;"
            >
            <span
              style="
                position:absolute;
                right:12px;
                bottom:12px;
                width:50px;
                height:50px;
                border-radius:999px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(255,255,255,.95);
                box-shadow:0 8px 18px rgba(0,0,0,.22);
              "
            >
              <i
                class="fa-solid fa-play"
                style="font-size:18px; color:#111; transform:translateX(1px);"
              ></i>
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="subidos-export-media subidos-export-media-placeholder">
        <i class="fa-solid fa-video"></i>
        <span>Video adjunto</span>
      </div>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <div class="subidos-export-media subidos-export-media-placeholder">
        <i class="fa-solid fa-headphones"></i>
        <span>Audio adjunto</span>
      </div>
    `;
  }

  return `
    <div class="subidos-export-media subidos-export-media-placeholder">
      <i class="fa-solid fa-file-lines"></i>
      <span>Archivo adjunto</span>
    </div>
  `;
}

function subidosClaseBalanceIntroNota(introduccion = "", notaFinal = "") {
  const intro = String(introduccion || "").trim();
  const nota = String(notaFinal || "").trim();

  if (intro && !nota) return "uno";
  if (!intro && nota) return "uno";
  if (!intro && !nota) return "uno";

  const a = intro.length;
  const b = nota.length;

  // ✅ antes era muy agresivo y dejaba una caja muy angosta
  if (a >= b * 2.4) return "intro-muy-larga";
  if (b >= a * 2.4) return "nota-muy-larga";

  if (a >= b * 1.7) return "intro-larga";
  if (b >= a * 1.7) return "nota-larga";

  return "dos";
}

function subidosClasePrimeraCitaExport(texto = "", referencia = "") {
  const txt = String(texto || "").trim();
  const ref = String(referencia || "").trim();

  const textoPlano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  // ✅ peso general del contenido
  const peso = textoPlano.length + Math.round(ref.length * 0.35) + (saltos * 18);

  // ✅ muy corto / corto
  if (peso <= 185) return "breve";

  // ✅ medio: acá queremos que entre el caso como 1 Samuel 17:34-35
  if (peso <= 340) return "media";

  // ✅ largo: recién acá usa el tamaño máximo actual
  return "larga";
}

function subidosPesoTextoExport(texto = "") {
  const txt = String(texto || "").trim();
  const plano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  return plano.length + (saltos * 22);
}

function subidosClaseCajaTextoExport(texto = "") {
  const peso = subidosPesoTextoExport(texto);

  // ✅ un texto corto no debe heredar una caja alta
  if (peso <= 180) return "breve";

  // ✅ texto medio: suficiente, sin inflar demasiado
  if (peso <= 440) return "media";

  return "larga";
}

function subidosClaseAireIntroNotaExport(introduccion = "", notaFinal = "", primeraTexto = "") {
  const introPeso = subidosPesoTextoExport(introduccion);
  const notaPeso = subidosPesoTextoExport(notaFinal);
  const primeraPeso = subidosPesoTextoExport(primeraTexto);

  const mayorTextoSecundario = Math.max(introPeso, notaPeso);
  const totalSecundario = introPeso + notaPeso;

  // ✅ Si el primer versículo es muy largo, el aire debe ir a favor de él.
  if (primeraPeso >= 520 && totalSecundario <= 520) return "aire-compacto";

  // ✅ Textos secundarios cortos: más fondo visible.
  if (mayorTextoSecundario <= 160 && totalSecundario <= 290) return "aire-amplio";

  // ✅ Textos secundarios medianos.
  if (mayorTextoSecundario <= 360 && totalSecundario <= 620) return "aire-medio";

  return "aire-compacto";
}

function subidosClaseLayoutPredicaExport(primeraTexto = "", introduccion = "", notaFinal = "") {
  const p1 = subidosPesoTextoExport(primeraTexto);
  const intro = subidosPesoTextoExport(introduccion);
  const nota = subidosPesoTextoExport(notaFinal);
  const secundarios = intro + nota;

  if (p1 >= 650 && secundarios <= 620) return "v1-max";
  if (p1 >= 470 && secundarios <= 700) return "v1-grande";
  if (p1 >= 300) return "v1-medio";

  return "v1-normal";
}

function subidosClampNumero(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || min));
}

function subidosRepartoFlexiblePredicaExport(primeraTexto = "", introduccion = "", notaFinal = "") {
  const p1 = subidosPesoTextoExport(primeraTexto);
  const intro = subidosPesoTextoExport(introduccion);
  const nota = subidosPesoTextoExport(notaFinal);

  // ✅ Como intro y nota van una al lado de la otra,
  // NO usamos intro + nota para el alto de esa fila.
  // Usamos principalmente el más largo.
  const mayorSecundario = Math.max(intro, nota);
  const totalSecundario = intro + nota;
  const haySecundarios = totalSecundario > 0;

  let growPrimera = 2.4 + (p1 / 135);
  let growTextos = haySecundarios ? 0.85 + (mayorSecundario / 210) : 0;

  // ✅ Si el primer versículo pesa más, le damos más espacio.
  if (p1 > mayorSecundario * 1.25) {
    growPrimera += 1.1;
  }

  // ✅ Si intro/nota realmente necesitan más, recién ahí crece esa fila.
  if (haySecundarios && mayorSecundario > p1 * 1.15) {
    growTextos += 0.9;
  }

  // ✅ Evita que la fila de intro/nota se infle por aire.
  growPrimera = subidosClampNumero(growPrimera, 2.4, 8.4);
  growTextos = haySecundarios ? subidosClampNumero(growTextos, 0.85, 3.8) : 0;

// ✅ Gap fijo y prolijo para que no vuelva el aire exagerado.
const gapGeneral = 5;
const gapTextos = 5;

return {
  growPrimera: growPrimera.toFixed(2),
  growTextos: growTextos.toFixed(2),
  gapGeneral,
  gapTextos
};
}

function subidosCrearNodoExportPredica(it) {
  const exportW = subidosAnchoExportPredica();
  const exportH = Math.round((exportW * 16) / 9);

  const citas = obtenerCitasPredicaSubido(it);
  const primeraCita = citas[0] || null;

  const primeraTexto = subidosTextoPlanoExport(primeraCita?.texto || "");
  const primeraRef = subidosTextoPlanoExport(primeraCita?.referencia || "");

const otrasRefs = citas
  .slice(1)
  .map(c => subidosTextoPlanoExport(c.referencia || ""))
  .filter(Boolean);

const otrasCitasHtml = otrasRefs.map(ref => `
  <span class="subidos-export-ref-extra">${escaparHtml(ref)}</span>
`).join(`<span class="subidos-export-bullet">•</span>`);

  const introduccion = subidosTextoPlanoExport(it.predicaIntroduccion || it.introduccionPredica || "");
  const notaFinal = subidosTextoPlanoExport(it.predicaNotaFinal || it.notaFinalGeneral || "");
  const fechaTxt = subidosFechaBonitaExport(it.fechaEvento || "");
  const descripcion = subidosTextoPlanoExport(it.descripcion || "");
  const tituloPredica = subidosTextoPlanoExport(it.predicaTitulo || it.tituloPredica || "");
const fondoUrl = subidosFondoPredicaActual(it);
  const color = colorEtiquetaSubidos(it.etiqueta || "");
  const archivoHeroHtml = subidosArchivoExportHtml(it);
const tieneArchivoHero = !!String(archivoHeroHtml || "").trim();

 const textosClase = subidosClaseBalanceIntroNota(introduccion, notaFinal);
 const primeraClase = subidosClasePrimeraCitaExport(primeraTexto, primeraRef);
  const introClase = subidosClaseCajaTextoExport(introduccion);
const notaClase = subidosClaseCajaTextoExport(notaFinal);
const aireClase = subidosClaseAireIntroNotaExport(introduccion, notaFinal, primeraTexto);
const layoutClase = subidosClaseLayoutPredicaExport(primeraTexto, introduccion, notaFinal);
  const repartoFlexible = subidosRepartoFlexiblePredicaExport(primeraTexto, introduccion, notaFinal);

  const node = document.createElement("article");
  node.id = "subidosExportPredicaFinal";
node.className = `subidos-export-template ${layoutClase} ${tieneArchivoHero ? "con-archivo" : "sin-archivo"}`;
  node.style.setProperty("--grow-primera", repartoFlexible.growPrimera);
node.style.setProperty("--grow-textos", repartoFlexible.growTextos);
node.style.setProperty("--gap-general", `${repartoFlexible.gapGeneral}px`);
node.style.setProperty("--gap-textos", `${repartoFlexible.gapTextos}px`);

  node.innerHTML = `
    <style>
      #subidosExportPredicaFinal{
        --left-col: 1.14fr;
        --right-col: .86fr;

        width:${exportW}px;
        height:${exportH}px;
        box-sizing:border-box;
        overflow:hidden;
        border-radius:30px;
        padding:12px 14px 14px;
        display:flex;
        flex-direction:column;
       gap:5px;
        position:relative;
background:#f7fbff;
font-family:"Lora", serif;
color:#111;
      }
#subidosExportPredicaFinal *{
  box-sizing:border-box;
}

#subidosExportPredicaFinal::before{
  content:"";
  position:absolute;
  inset:0;
  background-image:url("${fondoUrl}");
  background-size:cover;
  background-position:center center;
  background-repeat:no-repeat;
  opacity:.60;
  z-index:0;
}

#subidosExportPredicaFinal > :not(style){
  position:relative;
  z-index:1;
}

      /* ===== TOP ===== */

      #subidosExportPredicaFinal .subidos-export-head{
        flex:0 0 auto;
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }

      #subidosExportPredicaFinal .subidos-export-badge{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        gap:6px;
        height:28px;
        padding:0 12px;
        border-radius:999px;
        background:${color.bg};
        color:${color.fg};
        font-family:Arial, sans-serif;
        font-weight:800;
        font-size:14px;
        line-height:1;
        white-space:nowrap;
      }

      #subidosExportPredicaFinal .subidos-export-meta-box{
        flex:1 1 auto;
        min-width:0;
        border-radius:16px;
        padding:6px 10px;
        background:rgba(255,255,255,.62);
        border:1px solid rgba(255,255,255,.42);
        display:flex;
        align-items:center;
        gap:10px;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-fecha{
        flex:0 0 auto;
        font-family:Arial, sans-serif;
        font-size:13px;
        line-height:1;
        color:#23313a;
        white-space:nowrap;
      }

      #subidosExportPredicaFinal .subidos-export-titulo{
        flex:1 1 auto;
        min-width:0;
        font-family:"Lora", serif;
        font-size:15px;
        line-height:1.05;
        font-weight:900;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      #subidosExportPredicaFinal .subidos-export-divider{
        flex:0 0 auto;
        height:1px;
        background:rgba(0,0,0,.08);
      }

      /* ===== ARCHIVO + DATOS IGLESIA ===== */

      #subidosExportPredicaFinal .subidos-export-hero{
        flex:0 0 168px;
        min-height:0;
        display:grid;
        grid-template-columns:var(--left-col) var(--right-col);
        gap:10px;
        align-items:stretch;
      }

      #subidosExportPredicaFinal .subidos-export-media{
        width:100%;
        min-height:0;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.80);
        border-radius:22px;
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      #subidosExportPredicaFinal .subidos-export-media img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      #subidosExportPredicaFinal .subidos-export-media-placeholder{
        flex-direction:column;
        gap:10px;
        font-weight:900;
        text-align:center;
      }

      #subidosExportPredicaFinal .subidos-export-media-placeholder i{
        font-size:32px;
      }

      #subidosExportPredicaFinal .subidos-export-brand-wrap{
        min-height:0;
        display:flex;
      }

      #subidosExportPredicaFinal .subidos-export-brand-box{
        width:100%;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.80);
        border-radius:22px;
        padding:8px 10px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        overflow:hidden;
      }

#subidosExportPredicaFinal .subidos-export-iglesia{
  font-weight:900;
  font-size:18.5px;
  line-height:1.02;
}

#subidosExportPredicaFinal .subidos-export-address{
  margin-top:7px;
  font-size:12.5px;
  line-height:1.08;
  font-weight:800;
}

#subidosExportPredicaFinal .subidos-export-meeting{
  margin-top:6px;
  font-size:12.5px;
  line-height:1.08;
  font-weight:800;
}

/* ✅ Sin archivo/foto: datos de la iglesia compactos, sin gastar 168px de alto */
#subidosExportPredicaFinal.sin-archivo .subidos-export-hero{
  flex:0 0 auto !important;
  min-height:0 !important;
  display:block !important;
}

#subidosExportPredicaFinal.sin-archivo .subidos-export-brand-wrap{
  width:100% !important;
  min-height:0 !important;
  display:block !important;
}

#subidosExportPredicaFinal.sin-archivo .subidos-export-brand-box{
  min-height:0 !important;
  padding:7px 12px !important;
  border-radius:18px;
  flex-direction:row;
  flex-wrap:wrap;
  align-items:center;
  justify-content:center;
  gap:2px 9px;
}

#subidosExportPredicaFinal.sin-archivo .subidos-export-iglesia{
  font-size:13.5px;
  line-height:1.08;
}

#subidosExportPredicaFinal.sin-archivo .subidos-export-address,
#subidosExportPredicaFinal.sin-archivo .subidos-export-meeting{
  margin-top:0;
  font-size:11.2px;
  line-height:1.08;
}

#subidosExportPredicaFinal.sin-archivo .subidos-export-address::before,
#subidosExportPredicaFinal.sin-archivo .subidos-export-meeting::before{
  content:"•";
  margin-right:8px;
  opacity:.65;
}

                /* ===== PRIMERA CITA DESTACADA ===== */

      #subidosExportPredicaFinal .subidos-export-primera-box{
        flex:var(--grow-primera, 3) 1 0;
        min-height:0;
        max-height:none;
        border:1px solid rgba(255,255,255,.56);
        background:rgba(255,255,255,.82);
        border-radius:22px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:8px;
        text-align:center;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.larga{
        padding:8px 12px;
        justify-content:flex-start;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.media{
        padding:12px 16px;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.breve{
        padding:16px 22px;
      }

      #subidosExportPredicaFinal .subidos-export-primera-texto{
        width:100%;
        max-width:100%;
        font-family:"Lora", serif;
        font-size:15px;
        line-height:1.14;
        font-weight:900;
        text-align:left;
        overflow-wrap:anywhere;
      }

      #subidosExportPredicaFinal.v1-grande .subidos-export-primera-texto,
      #subidosExportPredicaFinal.v1-max .subidos-export-primera-texto{
        line-height:1.10;
      }

      #subidosExportPredicaFinal .subidos-export-primera-ref{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-radius:999px;
        padding:5px 16px;
        background:rgba(255,255,255,.88);
        border:1px solid rgba(190,220,236,.95);
        font-size:13px;
        line-height:1;
        font-weight:900;
        white-space:nowrap;
      }

      /* ===== INTRO + NOTA FINAL ===== */

      #subidosExportPredicaFinal .subidos-export-text-row{
        flex:var(--grow-textos, 2) 1 0;
        min-height:0;
        max-height:none;
        display:grid;
        align-items:center;
        align-content:center;
        justify-items:stretch;
        overflow:hidden;
        gap:var(--gap-textos, 12px);
      }

      #subidosExportPredicaFinal .subidos-export-text-row.dos{
        grid-template-columns:1fr 1fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.intro-larga{
        grid-template-columns:1.08fr .92fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.nota-larga{
        grid-template-columns:.92fr 1.08fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.intro-muy-larga{
        grid-template-columns:1.14fr .86fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.nota-muy-larga{
        grid-template-columns:.86fr 1.14fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.uno{
        grid-template-columns:1fr;
      }

#subidosExportPredicaFinal .subidos-export-text-box{
  width:100%;
  height:auto;
  min-height:0;
  max-height:none;
  align-self:stretch;
  border:1px solid rgba(255,255,255,.52);
  background:rgba(255,255,255,.80);
  border-radius:22px;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  text-align:left;
  overflow:hidden;
  padding:10px 14px;
}

#subidosExportPredicaFinal .subidos-export-text-box.breve{
  min-height:0;
  padding:10px 14px;
}

#subidosExportPredicaFinal .subidos-export-text-box.media{
  min-height:0;
  padding:10px 14px;
}

#subidosExportPredicaFinal .subidos-export-text-box.larga{
  min-height:0;
  padding:10px 14px;
}

#subidosExportPredicaFinal .subidos-export-intro,
#subidosExportPredicaFinal .subidos-export-note{
  width:100%;
  max-width:100%;
  font-weight:800;
  text-align:left;
  line-height:1.12;
  overflow-wrap:anywhere;
  display:block;
  font-size:11.8px;
}

      #subidosExportPredicaFinal.v1-grande .subidos-export-intro,
      #subidosExportPredicaFinal.v1-grande .subidos-export-note,
      #subidosExportPredicaFinal.v1-max .subidos-export-intro,
      #subidosExportPredicaFinal.v1-max .subidos-export-note{
        font-size:11.4px;
        line-height:1.08;
      }

/* ===== DEMÁS CITAS: SOLO REFERENCIAS ===== */

#subidosExportPredicaFinal .subidos-export-otras-citas-box{
  flex:0 0 auto;
  width:100%;
  min-height:0;
  max-height:none;
  border:1px solid rgba(255,255,255,.52);
  background:rgba(255,255,255,.72);
  border-radius:18px;
  padding:9px 14px;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
}

#subidosExportPredicaFinal .subidos-export-otras-citas{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  justify-content:center;
  gap:4px 8px;
  font-size:12px;
  line-height:1.14;
  font-weight:900;
  text-align:center;
  overflow:hidden;
}

#subidosExportPredicaFinal .subidos-export-ref-extra{
  white-space:nowrap;
}

#subidosExportPredicaFinal .subidos-export-bullet{
  opacity:.72;
  font-size:14px;
  line-height:1;
  transform:translateY(-1px);
}
      #subidosExportPredicaFinal .subidos-export-predica-titulo{
  flex:0 0 auto;
  width:100%;
  padding:6px 12px;
  border-radius:18px;
  background:rgba(255,255,255,.74);
  border:1px solid rgba(255,255,255,.52);
  font-family:"Lora", serif;
  font-size:17px;
  line-height:1.05;
  font-weight:900;
  text-align:center;
  color:#111;
  overflow:hidden;
  white-space:nowrap;
  text-overflow:ellipsis;
}

/* ✅ Intro y nota final una debajo de la otra */
#subidosExportPredicaFinal .subidos-export-text-row,
#subidosExportPredicaFinal .subidos-export-text-row.dos,
#subidosExportPredicaFinal .subidos-export-text-row.uno,
#subidosExportPredicaFinal .subidos-export-text-row.intro-larga,
#subidosExportPredicaFinal .subidos-export-text-row.nota-larga,
#subidosExportPredicaFinal .subidos-export-text-row.intro-muy-larga,
#subidosExportPredicaFinal .subidos-export-text-row.nota-muy-larga{
  display:flex !important;
  flex-direction:column !important;
  grid-template-columns:none !important;
  align-items:stretch !important;
  align-content:center !important;
  gap:5px !important;
}

#subidosExportPredicaFinal .subidos-export-text-box{
  width:100%;
  height:auto;
  min-height:0;
  max-height:100%;
  align-self:center;
  border:1px solid rgba(255,255,255,.52);
  background:rgba(255,255,255,.80);
  border-radius:22px;
  display:flex;
  align-items:flex-start;
  justify-content:center;
  text-align:left;
  overflow:hidden;
  padding:8px 14px;
}
   
    </style>

    <div class="subidos-export-head">
      <div class="subidos-export-badge">
        <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
        ${escaparHtml(it.etiqueta || "Predica")}
      </div>

      ${fechaTxt || descripcion ? `
        <div class="subidos-export-meta-box">
          ${fechaTxt ? `<div class="subidos-export-fecha">${escaparHtml(fechaTxt)}</div>` : ``}
          ${descripcion ? `<div class="subidos-export-titulo">${escaparHtml(descripcion)}</div>` : ``}
        </div>
      ` : ``}
    </div>

    <div class="subidos-export-divider"></div>

<div class="subidos-export-hero">
  ${archivoHeroHtml}

  <div class="subidos-export-brand-wrap">
        <div class="subidos-export-brand-box">
          <div class="subidos-export-iglesia">
            ${tieneArchivoHero
              ? `Iglesia Cristiana de<br>la Vida Abundante`
              : `Iglesia Cristiana de la Vida Abundante`}
          </div>

          <div class="subidos-export-address">
            ${tieneArchivoHero
              ? `Roca 123,<br>Tristan Suarez`
              : `Roca 123, Tristan Suarez`}
          </div>

          <div class="subidos-export-meeting">
            ${tieneArchivoHero
              ? `Reunión<br>Domingo 10hs`
              : `Reunión Domingo 10hs`}
          </div>
        </div>
      </div>
    </div>

${tituloPredica ? `
  <div class="subidos-export-predica-titulo">
    ${escaparHtml(tituloPredica)}
  </div>
` : ``}

    <div class="subidos-export-primera-box ${primeraClase}">
      ${primeraTexto ? `
        <div class="subidos-export-primera-texto">
          ${subidosHtmlExport(primeraTexto)}
        </div>
      ` : `
        <div class="subidos-export-primera-texto">
          Sin versículo cargado.
        </div>
      `}

      ${primeraRef ? `
        <div class="subidos-export-primera-ref">
          ~ ${escaparHtml(primeraRef)} ~
        </div>
      ` : ``}
    </div>

    ${introduccion ? `
  <div class="subidos-export-text-row intro-row">
    <div class="subidos-export-text-box intro-box ${introClase}">
      <div class="subidos-export-intro">
        ${subidosHtmlExport(introduccion)}
      </div>
    </div>
  </div>
` : ``}

${otrasCitasHtml ? `
  <div class="subidos-export-otras-citas-box">
    <div class="subidos-export-otras-citas">
      ${otrasCitasHtml}
    </div>
  </div>
` : ``}

${notaFinal ? `
  <div class="subidos-export-text-row note-row">
    <div class="subidos-export-text-box note-box ${notaClase}">
      <div class="subidos-export-note">
        ${subidosHtmlExport(notaFinal)}
      </div>
    </div>
  </div>
` : ``}
`;

  return node;
}

function subidosBlobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => resolve(String(rd.result || ""));
    rd.readAsDataURL(blob);
  });
}

function subidosAjustarTextoSoloSiNoCabe(boxEl, textEl, minFontPx = 9.5, paso = 0.2) {
  if (!boxEl || !textEl) return;

  const hayOverflow = () => (
    textEl.scrollHeight > textEl.clientHeight + 1 ||
    textEl.scrollWidth > textEl.clientWidth + 1
  );

  let fontSize = parseFloat(window.getComputedStyle(textEl).fontSize || "12");

  while (fontSize > minFontPx && hayOverflow()) {
    fontSize = Math.max(minFontPx, fontSize - paso);
    textEl.style.fontSize = fontSize + "px";
  }
}

function subidosOverflowTextoExport(textEl) {
  if (!textEl) return false;

  const esCitasExtra = textEl.classList?.contains("subidos-export-otras-citas");

  return (
    textEl.scrollHeight > textEl.clientHeight + 1 ||
    (!esCitasExtra && textEl.scrollWidth > textEl.clientWidth + 1)
  );
}

function subidosPadYExport(el) {
  if (!el) return 0;

  const cs = window.getComputedStyle(el);
  return (
    parseFloat(cs.paddingTop || "0") +
    parseFloat(cs.paddingBottom || "0") +
    parseFloat(cs.borderTopWidth || "0") +
    parseFloat(cs.borderBottomWidth || "0")
  );
}

function subidosPesoVisualExport(texto = "") {
  const txt = String(texto || "").trim();
  if (!txt) return 0;

  const plano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  return plano.length + (saltos * 26);
}

function subidosFuenteInicialExport(textEl, base, extraSiCorto = 1, limiteCorto = 120) {
  if (!textEl) return base;

  const peso = subidosPesoVisualExport(textEl.textContent || "");
  const font = peso && peso <= limiteCorto ? base + extraSiCorto : base;

  textEl.style.fontSize = font + "px";
  return font;
}

function subidosRecortarTextoHastaEntrarExport(textEl) {
  if (!textEl) return;

  if (!textEl.dataset.textoOriginalExport) {
    textEl.dataset.textoOriginalExport = String(textEl.textContent || "").trim();
  }

  const original = String(textEl.dataset.textoOriginalExport || "").trim();
  if (!original) return;

  if (!subidosOverflowTextoExport(textEl)) return;

  let lo = 0;
  let hi = original.length;
  let mejor = "[…]";

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);

    let candidato = original.slice(0, mid).trim();

    // ✅ no cortar en medio de una palabra si se puede evitar
    candidato = candidato.replace(/\s+\S*$/, "").trim();

    if (!candidato) candidato = original.slice(0, mid).trim();

    textEl.textContent = candidato + " […]";

    if (!subidosOverflowTextoExport(textEl)) {
      mejor = textEl.textContent;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  textEl.textContent = mejor;
}

function subidosAjustarFuenteYRecorteExport(textEl, minFontPx = 9.5, paso = 0.2) {
  if (!textEl) return;

  let fontSize = parseFloat(window.getComputedStyle(textEl).fontSize || "12");

  while (fontSize > minFontPx && subidosOverflowTextoExport(textEl)) {
    fontSize = Math.max(minFontPx, fontSize - paso);
    textEl.style.fontSize = fontSize + "px";
  }

  if (subidosOverflowTextoExport(textEl)) {
    subidosRecortarTextoHastaEntrarExport(textEl);
  }
}

function subidosAplicarColumnasIntroNotaExport(row, introText, noteText) {
  if (!row) return;

  const hayIntro = !!introText;
  const hayNota = !!noteText;

  if (!hayIntro || !hayNota) {
    row.style.gridTemplateColumns = "1fr";
    return;
  }

  const introPeso = Math.max(60, subidosPesoVisualExport(introText.textContent || ""));
  const notaPeso = Math.max(60, subidosPesoVisualExport(noteText.textContent || ""));
  const total = introPeso + notaPeso;

  let introFr = introPeso / total;

  // ✅ No dejamos que una columna quede ridículamente angosta.
  // Pero sí permitimos que el texto más largo reciba más ancho.
  introFr = subidosClampNumero(introFr, 0.34, 0.66);

  const notaFr = 1 - introFr;

  row.style.gridTemplateColumns = `${introFr}fr ${notaFr}fr`;
}

function subidosResetCajaExport(box) {
  if (!box) return;

  box.style.minHeight = "0";
  box.style.height = "auto";
  box.style.maxHeight = "none";
  box.style.padding = "5px";
  box.style.overflow = "hidden";
  box.style.alignSelf = "center";
}

function subidosAltoNaturalCajaExport(box, textEl) {
  if (!box || !textEl) return 0;

  subidosResetCajaExport(box);

  textEl.style.maxHeight = "none";
  textEl.style.overflow = "visible";

  return Math.ceil(textEl.scrollHeight + subidosPadYExport(box) + 2);
}

function subidosAltoNaturalPrimeraExport(box, textEl, refEl) {
  if (!box || !textEl) return 0;

  subidosResetCajaExport(box);

  box.style.gap = "6px";
  textEl.style.maxHeight = "none";
  textEl.style.overflow = "visible";

  const refH = refEl ? refEl.offsetHeight : 0;
  const gapRef = refEl ? 6 : 0;

  return Math.ceil(textEl.scrollHeight + refH + gapRef + subidosPadYExport(box) + 2);
}

function subidosSetMaxTextoCajaExport(box, textEl) {
  if (!box || !textEl) return;

  const disponible = Math.max(12, box.clientHeight - subidosPadYExport(box) - 1);

  textEl.style.maxHeight = disponible + "px";
  textEl.style.overflow = "hidden";
}

function subidosSetMaxPrimeraExport(box, textEl, refEl) {
  if (!box || !textEl) return;

  const refH = refEl ? refEl.offsetHeight : 0;
  const gapRef = refEl ? 6 : 0;

  const disponible = Math.max(
    18,
    box.clientHeight - subidosPadYExport(box) - refH - gapRef - 1
  );

  textEl.style.maxHeight = disponible + "px";
  textEl.style.overflow = "hidden";
}

function subidosAjustarLayoutInteligenteExportPredica(node) {
  if (!node) return;

  const GAP = 4;

  const primeraBox = node.querySelector(".subidos-export-primera-box");
  const primeraText = node.querySelector(".subidos-export-primera-texto");
  const primeraRef = node.querySelector(".subidos-export-primera-ref");

  const rows = [...node.querySelectorAll(".subidos-export-text-row")];
  const introBox = node.querySelector(".subidos-export-text-box.intro-box");
  const introText = node.querySelector(".subidos-export-intro");
  const noteBox = node.querySelector(".subidos-export-text-box.note-box");
  const noteText = node.querySelector(".subidos-export-note");

  const otrasBox = node.querySelector(".subidos-export-otras-citas-box");
  const otrasText = node.querySelector(".subidos-export-otras-citas");

  node.style.height = "auto";
  node.style.minHeight = "0";
  node.style.justifyContent = "flex-start";
  node.style.gap = GAP + "px";
  node.style.overflow = "hidden";

  [primeraBox, introBox, noteBox, otrasBox, ...rows].forEach(el => {
    if (!el) return;
    el.style.flex = "0 0 auto";
    el.style.height = "auto";
    el.style.minHeight = "0";
    el.style.maxHeight = "none";
    el.style.overflow = "hidden";
  });

  rows.forEach(row => {
    row.style.display = "flex";
    row.style.flexDirection = "column";
    row.style.gap = GAP + "px";
    row.style.alignItems = "stretch";
    row.style.alignContent = "stretch";
  });

  [primeraText, introText, noteText, otrasText].forEach(el => {
    if (!el) return;
    el.style.maxHeight = "none";
    el.style.overflow = "visible";
  });

  if (primeraBox) {
    primeraBox.style.gap = "5px";

    if (primeraBox.classList.contains("larga")) {
      primeraBox.style.justifyContent = "flex-start";
      primeraBox.style.padding = "7px 10px";
    } else if (primeraBox.classList.contains("media")) {
      primeraBox.style.padding = "10px 14px";
    } else {
      primeraBox.style.padding = "14px 18px";
    }
  }

  if (primeraText) {
    primeraText.style.fontSize = "15px";
    primeraText.style.lineHeight = "1.10";
  }

  if (primeraRef) {
    primeraRef.style.padding = "4px 13px";
  }

  if (introText) {
    introText.style.fontSize = "11.8px";
    introText.style.lineHeight = "1.10";
    introText.style.textAlign = "left";
  }

  if (noteText) {
    noteText.style.fontSize = "11.8px";
    noteText.style.lineHeight = "1.10";
    noteText.style.textAlign = "left";
  }

  if (otrasText) {
    otrasText.style.fontSize = "12px";
    otrasText.style.lineHeight = "1.12";
    otrasText.style.textAlign = "center";
    otrasText.style.justifyContent = "center";
  }

  // Si el primer bloque es muy largo, achicamos solo lo necesario
  // antes de medir el alto total. Así no se desperdicia espacio.
  if (primeraText && primeraBox) {
    let fontSize = parseFloat(window.getComputedStyle(primeraText).fontSize || "15");
    const limiteAlto = primeraBox.classList.contains("larga") ? 170 : 190;

    while (
      fontSize > 10.2 &&
      primeraText.scrollHeight > limiteAlto
    ) {
      fontSize -= 0.2;
      primeraText.style.fontSize = fontSize + "px";
    }
  }
}

function subidosAjustarTextosExportPredica(node) {
  if (!node) return;

  subidosAjustarLayoutInteligenteExportPredica(node);
}

function subidosAjustarAltoFinalExportPredica(node) {
  if (!node) return;

  const exportW = subidosAnchoExportPredica();
  const MAX_H = Math.round((exportW * 16) / 9);
  const MIN_H = 500;

  let gapActual = 4;

  node.style.height = "auto";
  node.style.minHeight = "0";
  node.style.gap = gapActual + "px";
  node.style.justifyContent = "flex-start";

  const primeraText = node.querySelector(".subidos-export-primera-texto");
  const primeraBox = node.querySelector(".subidos-export-primera-box");
  const primeraRef = node.querySelector(".subidos-export-primera-ref");
  const introText = node.querySelector(".subidos-export-intro");
  const noteText = node.querySelector(".subidos-export-note");
  const otrasText = node.querySelector(".subidos-export-otras-citas");
  const hero = node.querySelector(".subidos-export-hero");
  const titulo = node.querySelector(".subidos-export-predica-titulo");
  const esSinArchivo = node.classList.contains("sin-archivo");

  const textosReducibles = [
    primeraText,
    introText,
    noteText,
    otrasText
  ].filter(Boolean);

  const medirAltoNatural = () => {
    const cs = window.getComputedStyle(node);

    const paddingY =
      parseFloat(cs.paddingTop || "0") +
      parseFloat(cs.paddingBottom || "0");

    const hijos = [...node.children].filter(el => {
      if (!el || el.tagName === "STYLE") return false;
      return window.getComputedStyle(el).display !== "none";
    });

    const altoHijos = hijos.reduce((total, el) => {
      return total + Math.ceil(el.getBoundingClientRect().height || el.offsetHeight || 0);
    }, 0);

    const gaps = Math.max(0, hijos.length - 1) * gapActual;

    return Math.ceil(paddingY + altoHijos + gaps + 6);
  };

  let altoNatural = medirAltoNatural();

  if (altoNatural <= MAX_H) {
    node.style.height = subidosClampNumero(altoNatural, MIN_H, MAX_H) + "px";
    return;
  }

  // 1) Reducimos tipografías gradualmente. Priorizamos conservar
  // la nota final completa antes que dejar aire innecesario.
  for (let i = 0; i < 38 && altoNatural > MAX_H; i++) {
    textosReducibles.forEach(el => {
      const actual = parseFloat(window.getComputedStyle(el).fontSize || "12");
      const esPrimera = el === primeraText;
      const min = esPrimera ? 9.4 : 8.9;
      const paso = esPrimera ? 0.22 : 0.16;

      if (actual > min) {
        el.style.fontSize = Math.max(min, actual - paso) + "px";
      }
    });

    altoNatural = medirAltoNatural();
  }

  // 2) Con foto/archivo, si aún no entra achicamos el hero.
  // Sin archivo ya es compacto por CSS y no ocupa 168px.
  if (altoNatural > MAX_H && hero && !esSinArchivo) {
    let heroH = Math.round(hero.getBoundingClientRect().height || 168);

    while (heroH > 112 && altoNatural > MAX_H) {
      heroH -= 4;
      hero.style.flexBasis = heroH + "px";
      altoNatural = medirAltoNatural();
    }
  }

  // 3) Último ajuste de espacios antes de permitir cualquier recorte.
  if (altoNatural > MAX_H) {
    gapActual = 3;
    node.style.gap = gapActual + "px";
    node.style.padding = "9px 10px 10px";

    if (primeraBox) {
      primeraBox.style.padding = "5px 8px";
      primeraBox.style.gap = "4px";
    }

    if (primeraRef) {
      primeraRef.style.padding = "3px 10px";
      primeraRef.style.fontSize = "11.5px";
    }

    node.querySelectorAll(".subidos-export-text-box").forEach(box => {
      box.style.padding = "6px 9px";
    });

    const otrasBox = node.querySelector(".subidos-export-otras-citas-box");
    if (otrasBox) otrasBox.style.padding = "6px 9px";

    if (titulo) {
      titulo.style.padding = "4px 8px";
      titulo.style.fontSize = "15.5px";
    }

    altoNatural = medirAltoNatural();
  }

  // 4) Seguridad para prédicas excepcionalmente largas.
  // Seguimos bajando principalmente el bloque bíblico para que la
  // nota final no desaparezca por overflow del canvas.
  for (let i = 0; i < 30 && altoNatural > MAX_H; i++) {
    if (primeraText) {
      const actual = parseFloat(window.getComputedStyle(primeraText).fontSize || "10");
      if (actual > 8.5) {
        primeraText.style.fontSize = Math.max(8.5, actual - 0.18) + "px";
      }
    }

    [introText, noteText, otrasText].filter(Boolean).forEach(el => {
      const actual = parseFloat(window.getComputedStyle(el).fontSize || "9");
      if (actual > 8.4) {
        el.style.fontSize = Math.max(8.4, actual - 0.08) + "px";
      }
    });

    altoNatural = medirAltoNatural();
  }

  node.style.height = subidosClampNumero(altoNatural, MIN_H, MAX_H) + "px";
}

async function subidosConvertirImagenesExportConProxy(node) {
  const imgs = [...node.querySelectorAll("img")];

  for (const img of imgs) {
    const src = img.currentSrc || img.getAttribute("src") || img.src || "";
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;

    try {
      const proxy = subidosProxyArchivoUrl(src, "imagen-export.png", false);
      const r = await fetch(proxy);

      if (!r.ok) throw new Error("No pude leer imagen desde descargarImagenR2.");

      const blob = await r.blob();
      const dataUrl = await subidosBlobToDataURL(blob);

      img.removeAttribute("crossorigin");
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = dataUrl;
    } catch (e) {
      console.warn("No pude convertir imagen para exportación:", src, e);
    }
  }
}

async function subidosGenerarBlobCardPredica(id, itemOverride = null) {
  const it = itemOverride || obtenerSubidoPorId(id);
  if (!it) throw new Error("No encontré la prédica a exportar.");

  const stage = document.getElementById("subidosExportStage");
  if (!stage) throw new Error("Falta #subidosExportStage en el HTML.");

  stage.innerHTML = "";

  const exportNode = subidosCrearNodoExportPredica({
    id,
    ...(it || {})
  });

  stage.appendChild(exportNode);

  await subidosConvertirImagenesExportConProxy(exportNode);
  await subidosEsperarImagenes(exportNode);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

 subidosAjustarTextosExportPredica(exportNode);

// ✅ Achica el alto final del PNG si no necesita todo el 9:16.
subidosAjustarAltoFinalExportPredica(exportNode);

// ✅ esperamos otro frame para que el navegador aplique el nuevo tamaño si cambió
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let canvas;

  try {
    canvas = await html2canvas(exportNode, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });
  } catch (e) {
    stage.innerHTML = "";
    throw new Error("No pude generar la imagen de la prédica.");
  }

  console.log("✅ EXPORT PREDICA TEMPLATE:", {
    anchoCanvas: canvas.width,
    altoCanvas: canvas.height,
    proporcion: (canvas.height / canvas.width).toFixed(2)
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

  stage.innerHTML = "";

  if (!blob) throw new Error("No se pudo generar la imagen.");
  return blob;
}

function subidosEsPredicaConContenido(it) {
  return esPredicaSubidos(it?.etiqueta || "") && subidosTieneContenidoPredica(it);
}

function subidosLeerLinkPredicaDirecta() {
  const url = new URL(window.location.href);

  const refQuery =
    url.searchParams.get("predicaRef") ||
    url.searchParams.get("ref") ||
    url.searchParams.get("predica") ||
    url.searchParams.get("p") ||
    url.searchParams.get("idPredica");

  if (refQuery) {
    return {
      ref: String(refQuery || "").trim(),
      limpiarHash: false
    };
  }

  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  if (!rawHash) return null;

  if (rawHash.startsWith("subido=")) {
    const params = new URLSearchParams(rawHash);
    return {
      ref: String(params.get("subido") || "").trim(),
      limpiarHash: true
    };
  }

  if (rawHash.startsWith("predica=")) {
    const params = new URLSearchParams(rawHash);
    return {
      ref: String(params.get("predica") || "").trim(),
      limpiarHash: true
    };
  }

  return null;
}

function subidosAbrirDesdeHash() {
  if (subidosDeepLinkAbierto) return;

  const link = subidosLeerLinkPredicaDirecta();
  if (!link?.ref) return;

  const it = subidosBuscarPredicaPorReferencia(link.ref);
  if (!it) return;

  subidosDeepLinkAbierto = true;

  if (link.limpiarHash) {
    subidosLimpiarHashDetalle();
  }

  if (typeof window.irA === "function") window.irA("iglesia");
  if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("subidos");

  setTimeout(() => {
    if (subidosEsPredicaConContenido(it)) {
      abrirSubidosVisorPredica(it.id, "all");
      return;
    }

    if (it.url) {
      abrirSubidosVisorArchivo(it.id);
    }
  }, 180);
}

function htmlArchivoGrandePredica(it) {
  const archivos = subidosArchivosItem(it);
  if (!archivos.length) return "";

  if (archivos.length > 1) {
    return subidosHtmlArchivosAbiertos(it, 0);
  }

  const archivo = archivos[0];
  const url = String(archivo.url || "").trim();
  if (!url) return "";

  const nombrePlano = archivo.fileName || "archivo";
  const nombre = escaparHtml(nombrePlano);
  const mime = String(archivo.mimeType || "");
  const preview = subidosObtenerPreviewVideoInfo(it, archivo, 0);

  if (mime.startsWith("image/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        style="width:100%; border:none; background:transparent; border-radius:16px; padding:0; overflow:hidden; cursor:pointer;"
        title="Abrir archivo"
      >
        <img
          src="${url}"
          alt="${nombre}"
          style="display:block; width:100%; max-height:46vh; object-fit:contain; background:transparent;"
        >
      </button>
    `;
  }

  if (mime.startsWith("video/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        class="subidos-video-frame"
        style="width:100%; border:none; background:transparent; border-radius:16px; padding:0; overflow:hidden; cursor:pointer; position:relative;"
        title="Abrir video"
      >
        ${subidosHtmlPosterVideo(preview.url, nombrePlano)}
      </button>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        style="width:100%; border:1px solid #d8eef9; background:#fff; border-radius:16px; padding:18px; cursor:pointer;"
        title="Abrir audio"
      >
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
          <i class="fa-solid fa-headphones" style="font-size:28px;"></i>
          <div style="font-family:'Lora',serif; font-weight:700;">${nombre}</div>
          <small>Tocar para abrir</small>
        </div>
      </button>
    `;
  }

  return `
    <button
      type="button"
      onclick="abrirSubidosVisorArchivo('${it.id}')"
      style="width:100%; border:1px solid #d8eef9; background:#fff; border-radius:16px; padding:18px; cursor:pointer;"
      title="Abrir archivo"
    >
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
        <i class="fa-solid fa-file-lines" style="font-size:28px;"></i>
        <div style="font-family:'Lora',serif; font-weight:700;">${nombre}</div>
        <small>Tocar para abrir</small>
      </div>
    </button>
  `;
}


/* =========================================================
   PRÉDICA: IMPRESIÓN A4 BLANCO Y NEGRO
   ========================================================= */
function subidosHtmlBibliaImpresion(txt = "") {
  const limpio = String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .trim();

  if (!limpio) return "";

  return limpio
    .split("\n")
    .map(linea => String(linea || "").trim())
    .filter(Boolean)
    .map(linea => {
      let html = escaparHtml(linea);
      html = html.replace(
        /^(\d+\s*[\.\)]?\s*)/,
        '<strong class="print-num-verso">$1</strong>'
      );
      return `<div class="print-verso">${html}</div>`;
    })
    .join("");
}

function subidosHtmlParrafosImpresion(txt = "") {
  return String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .trim()
    .split(/\n+/)
    .map(linea => String(linea || "").trim())
    .filter(Boolean)
    .map(linea => `<p>${escaparHtml(linea)}</p>`)
    .join("");
}

function subidosHtmlPredicaImpresion(it = {}) {
  const citas = obtenerCitasPredicaSubido(it);

  const titulo = String(
    it.predicaTitulo ||
    it.tituloPredica ||
    "Prédica"
  ).trim();

  const fecha = subidosFechaBonitaExport(it.fechaEvento || "");

  const version = String(
    it.predicaVersion ||
    citas[0]?.version ||
    ""
  ).trim();

  const introduccion = String(
    it.predicaIntroduccion ||
    it.introduccionPredica ||
    ""
  ).trim();

  const notaFinal = String(
    it.predicaNotaFinal ||
    it.notaFinalGeneral ||
    ""
  ).trim();

  const citasHtml = citas.map(c => {
    const referencia = String(c?.referencia || "").trim();
    const textoBiblico = String(c?.texto || "").trim();
    const comentario = String(c?.comentario || c?.nota || "").trim();

    return `
      <section class="print-cita">
        ${referencia ? `
          <div class="print-ref">
            <span class="print-bullet">•</span>
            <strong>${escaparHtml(referencia)}</strong>
          </div>
        ` : ``}

        ${textoBiblico ? `
          <div class="print-biblia">
            ${subidosHtmlBibliaImpresion(textoBiblico)}
          </div>
        ` : ``}

        ${comentario ? `
          <div class="print-item print-comentario">
            <span class="print-bullet">•</span>
            <div>
              <strong>Comentario:</strong>
              ${subidosHtmlParrafosImpresion(comentario)}
            </div>
          </div>
        ` : ``}
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>&#8203;</title>
<style>
@page{size:A4 portrait;margin:0;}
*{box-sizing:border-box;}
html,body{
  margin:0;
  padding:0;
  background:#fff!important;
  color:#000!important;
  font-family:Arial,Helvetica,sans-serif;
  font-size:10.5pt;
  line-height:1.27;
}
main{
  width:100%;
  padding:1cm;
  box-decoration-break:clone;
  -webkit-box-decoration-break:clone;
}
.print-header{
  text-align:center;border-bottom:1.4px solid #000;
  padding:0 0 3mm;margin:0 0 4mm;
}
.print-header h1{margin:0;font-size:17pt;line-height:1.12;font-weight:800;}
.print-meta{margin-top:1.5mm;font-size:9.4pt;font-weight:700;}
.print-item,.print-ref,.print-seccion-titulo{
  display:grid;grid-template-columns:4mm 1fr;column-gap:1.5mm;align-items:start;
}
.print-bullet{font-weight:900;font-size:12pt;line-height:1.05;text-align:center;}
.print-item{margin:0 0 3mm;}
.print-item p,.print-seccion-contenido p{
  margin:0 0 1.5mm;text-align:justify;orphans:3;widows:3;
}
.print-item p:last-child,.print-seccion-contenido p:last-child{margin-bottom:0;}
.print-cita{margin:0 0 4mm;break-inside:auto;}
.print-ref{
  margin:0 0 2mm;font-size:11.3pt;
  break-after:avoid;page-break-after:avoid;
}
.print-biblia{margin:0 0 2.5mm 5.5mm;padding-left:3mm;border-left:1px solid #000;}
.print-verso{margin:0 0 1.1mm;text-align:justify;orphans:3;widows:3;}
.print-num-verso{font-weight:800;}
.print-comentario{margin-left:5.5mm;margin-bottom:2mm;}
.print-seccion{margin:0 0 4mm;}
.print-seccion-titulo{margin:0 0 1.5mm;break-after:avoid;page-break-after:avoid;}
.print-seccion-contenido{margin-left:5.5mm;}
.print-nota{border-top:1px solid #000;padding-top:3mm;margin-top:2mm;}
strong{font-weight:800;}
</style>
</head>
<body>
<main>
  <header class="print-header">
    <h1>${escaparHtml(titulo || "Prédica")}</h1>
    ${(fecha || version) ? `
      <div class="print-meta">
        ${fecha ? escaparHtml(fecha) : ""}
        ${(fecha && version) ? " · " : ""}
        ${version ? escaparHtml(version) : ""}
      </div>
    ` : ``}
  </header>

  ${introduccion ? `
    <section class="print-seccion">
      <div class="print-seccion-titulo">
        <span class="print-bullet">•</span>
        <strong>Introducción</strong>
      </div>
      <div class="print-seccion-contenido">
        ${subidosHtmlParrafosImpresion(introduccion)}
      </div>
    </section>
  ` : ``}

  ${citasHtml}

  ${notaFinal ? `
    <section class="print-seccion print-nota">
      <div class="print-seccion-titulo">
        <span class="print-bullet">•</span>
        <strong>Nota final</strong>
      </div>
      <div class="print-seccion-contenido">
        ${subidosHtmlParrafosImpresion(notaFinal)}
      </div>
    </section>
  ` : ``}
</main>
</body>
</html>`;
}

function subidosCargarJsPDF() {
  if (window.jspdf?.jsPDF) {
    return Promise.resolve(window.jspdf.jsPDF);
  }

  if (window.__SUBIDOS_JSPDF_PROMISE) {
    return window.__SUBIDOS_JSPDF_PROMISE;
  }

  window.__SUBIDOS_JSPDF_PROMISE = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    script.async = true;

    script.onload = () => {
      if (window.jspdf?.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error("jsPDF no quedó disponible."));
      }
    };

    script.onerror = () => reject(new Error("No pude cargar el generador PDF."));

    document.head.appendChild(script);
  });

  return window.__SUBIDOS_JSPDF_PROMISE;
}

function subidosTextoPlanoPdf(txt = "") {
  return String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

async function subidosCrearPdfPredica(it = {}) {
  const jsPDF = await subidosCargarJsPDF();

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true
  });

  // =========================================================
  // A4: 1 cm REAL en los cuatro lados.
  // No agregamos "márgenes internos" innecesarios:
  // todo el contenido puede usar los 190 mm útiles.
  // =========================================================
  const PAGE_W = 210;
  const PAGE_H = 297;
  const M = 10;
  const LEFT = M;
  const RIGHT = PAGE_W - M;
  const TOP = M;
  const BOTTOM = PAGE_H - M;
  const FULL_W = RIGHT - LEFT; // 190 mm

  // 14 pt reales para TODO el cuerpo.
  const BODY_SIZE = 14;
  const BODY_LINE = 5.05;

  let y = TOP;

  const setFont = (size = BODY_SIZE, bold = false, italic = false) => {
    const style = bold
      ? (italic ? "bolditalic" : "bold")
      : (italic ? "italic" : "normal");

    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
  };

  const nuevaPagina = () => {
    doc.addPage();
    y = TOP;
  };

  const asegurarLinea = (alto = BODY_LINE) => {
    if (y + alto <= BOTTOM) return;
    nuevaPagina();
  };

  const limpiarUnaLinea = (txt = "") =>
    String(txt || "")
      .replace(/\u00A0/g, " ")
      .replace(/\t/g, " ")
      .replace(/[ ]{2,}/g, " ")
      .trim();

  const dividir = (txt, width, size = BODY_SIZE, bold = false, italic = false) => {
    const limpio = limpiarUnaLinea(txt);
    if (!limpio) return [];

    setFont(size, bold, italic);
    return doc.splitTextToSize(limpio, width);
  };

  // =========================================================
  // SEPARADOR
  // Las líneas van EN LOS SALTOS entre conceptos.
  // Nunca atraviesan texto.
  // =========================================================
  const separador = () => {
    // Si ya estamos demasiado abajo, empezamos la página nueva
    // sin dejar una raya sola al pie.
    if (y + 4 > BOTTOM) {
      nuevaPagina();
      return;
    }

    y += 1.4;

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.28);
    doc.line(LEFT, y, RIGHT, y);

    y += 3.0;
  };

  // =========================================================
  // TEXTO GENÉRICO, línea por línea.
  // Así NO queda media hoja vacía porque un bloque completo
  // haya sido empujado a la página siguiente.
  // =========================================================
  const escribirLineas = (
    txt,
    {
      x = LEFT,
      width = FULL_W,
      size = BODY_SIZE,
      bold = false,
      italic = false,
      lineH = BODY_LINE,
      after = 0
    } = {}
  ) => {
    const lineas = dividir(txt, width, size, bold, italic);
    if (!lineas.length) return;

    setFont(size, bold, italic);

    lineas.forEach(linea => {
      asegurarLinea(lineH);
      doc.text(String(linea), x, y);
      y += lineH;
    });

    y += Math.max(0, Number(after) || 0);
  };

  // Respeta los saltos que el usuario escribió.
  const escribirParrafosOriginales = (
    txt,
    opts = {}
  ) => {
    const raw = String(txt || "").replace(/\r/g, "");
    if (!raw.trim()) return;

    const lineasOriginales = raw.split("\n");

    lineasOriginales.forEach((linea, idx) => {
      const limpio = limpiarUnaLinea(linea);

      if (!limpio) {
        // Un salto vacío real, pero compacto.
        y += 1.6;
        return;
      }

      escribirLineas(limpio, {
        ...opts,
        after: 0
      });

      if (idx < lineasOriginales.length - 1) {
        y += 0.55;
      }
    });

    y += Number(opts.after ?? 0);
  };

  // =========================================================
  // CABECERA
  // TÍTULO a la IZQUIERDA — FECHA a la DERECHA
  // =========================================================
  const escribirCabecera = (titulo = "", fecha = "") => {
    const tituloTxt = limpiarUnaLinea(titulo || "Prédica");
    const fechaTxt = limpiarUnaLinea(fecha || "");

    const TITLE_SIZE = 18;
    const DATE_SIZE = 14;
    const GAP = 5;

    setFont(DATE_SIZE, true, false);
    const fechaW = fechaTxt ? doc.getTextWidth(fechaTxt) : 0;

    const tituloWDisponible = Math.max(
      70,
      FULL_W - fechaW - GAP
    );

    const tituloLineas = dividir(
      tituloTxt,
      tituloWDisponible,
      TITLE_SIZE,
      true,
      false
    );

    const lineH = 6.4;

    // La fecha va a la derecha de la primera línea.
    if (fechaTxt) {
      setFont(DATE_SIZE, true, false);
      doc.text(fechaTxt, RIGHT, y, { align: "right" });
    }

    setFont(TITLE_SIZE, true, false);
    tituloLineas.forEach((linea, i) => {
      doc.text(String(linea), LEFT, y + (i * lineH));
    });

    y += Math.max(1, tituloLineas.length) * lineH;

    separador();
  };

  // =========================================================
  // INTRO y NOTA
  // 14 pt ITALIC, ocupando prácticamente todo el ancho.
  // =========================================================
  const escribirItalic = (txt = "") => {
    escribirParrafosOriginales(txt, {
      x: LEFT + 2,
      width: RIGHT - (LEFT + 2),
      size: BODY_SIZE,
      italic: true,
      lineH: BODY_LINE,
      after: 0
    });
  };

  // =========================================================
  // CITA BÍBLICA
  // Sangría + viñeta + BOLD.
  // La raya viene DESPUÉS del bloque de versículos, no debajo
  // de la cita, para que jamás parezca texto tachado.
  // =========================================================
  const escribirReferencia = (referencia = "") => {
    const refTxt = limpiarUnaLinea(referencia);
    if (!refTxt) return;

    const BULLET_X = LEFT + 3;
    const TEXT_X = LEFT + 8;
    const TEXT_W = RIGHT - TEXT_X;

    const lineas = dividir(refTxt, TEXT_W, BODY_SIZE, true, false);

    // Reservamos referencia + una sola línea de versículo, nada más.
    if (y + (BODY_LINE * 2) > BOTTOM) {
      nuevaPagina();
    }

    setFont(BODY_SIZE, true, false);
    doc.text("•", BULLET_X, y);

    lineas.forEach((linea, i) => {
      if (i > 0) asegurarLinea(BODY_LINE);
      doc.text(String(linea), TEXT_X, y);
      y += BODY_LINE;
    });

    y += 0.6;
  };

  // =========================================================
  // VERSÍCULOS
  // Misma sangría general que la cita.
  // SOLO el número del versículo va en bold.
  // El texto bíblico sigue en 14 pt normal.
  // =========================================================
  const escribirVersiculo = (linea = "") => {
    const limpio = limpiarUnaLinea(linea);
    if (!limpio) return;

    const m = limpio.match(/^(\d+)\s*[\.\)]?\s*(.*)$/);

    const X_NUM = LEFT + 8;
    const X_BODY = LEFT + 14;
    const BODY_W = RIGHT - X_BODY;

    if (!m) {
      escribirLineas(limpio, {
        x: X_NUM,
        width: RIGHT - X_NUM,
        size: BODY_SIZE,
        lineH: BODY_LINE
      });
      y += 0.45;
      return;
    }

    const num = `${m[1]}.`;
    const cuerpo = String(m[2] || "").trim();

    const cuerpoLineas = dividir(
      cuerpo,
      BODY_W,
      BODY_SIZE,
      false,
      false
    );

    asegurarLinea(BODY_LINE);

    setFont(BODY_SIZE, true, false);
    doc.text(num, X_NUM, y);

    if (cuerpoLineas.length) {
      setFont(BODY_SIZE, false, false);
      doc.text(String(cuerpoLineas[0]), X_BODY, y);
    }

    y += BODY_LINE;

    for (let i = 1; i < cuerpoLineas.length; i++) {
      asegurarLinea(BODY_LINE);
      setFont(BODY_SIZE, false, false);
      doc.text(String(cuerpoLineas[i]), X_BODY, y);
      y += BODY_LINE;
    }

    y += 0.4;
  };

  // =========================================================
  // COMENTARIO
  // - Sin itálica forzada.
  // - Si encuentra "1." o "1)" lo muestra SIEMPRE como "1)".
  // - Conserva •, -, –, —, *, ▪, ◦, · cuando ya estaban escritos.
  // - Respeta los saltos de línea originales.
  // =========================================================
  const escribirComentario = (txt = "") => {
    const raw = String(txt || "").replace(/\r/g, "");
    if (!raw.trim()) return;

    const COMMENT_X = LEFT + 8;
    const COMMENT_W = RIGHT - COMMENT_X;
    const HANG_X = LEFT + 15;
    const HANG_W = RIGHT - HANG_X;

    const lineas = raw.split("\n");

    lineas.forEach((lineaOriginal) => {
      const linea = limpiarUnaLinea(lineaOriginal);

      if (!linea) {
        y += 1.5;
        return;
      }

      // Enumeración: 1. / 1) -> siempre 1)
      const num = linea.match(/^(\d+)\s*[\.\)]\s*(.*)$/);

      if (num) {
        const marcador = `${num[1]})`;
        const cuerpo = String(num[2] || "").trim();
        const partes = dividir(
          cuerpo,
          HANG_W,
          BODY_SIZE,
          true,
          false
        );

        asegurarLinea(BODY_LINE);

        setFont(BODY_SIZE, true, false);
        doc.text(marcador, COMMENT_X, y);

        if (partes.length) {
          doc.text(String(partes[0]), HANG_X, y);
        }

        y += BODY_LINE;

        for (let i = 1; i < partes.length; i++) {
          asegurarLinea(BODY_LINE);
          setFont(BODY_SIZE, true, false);
          doc.text(String(partes[i]), HANG_X, y);
          y += BODY_LINE;
        }

        y += 0.65;
        return;
      }

      // Viñeta ORIGINAL: la conservamos.
      const bullet = linea.match(/^([•▪◦·\-\–\—\*])\s*(.*)$/);

      if (bullet) {
        const marcador = bullet[1];
        const cuerpo = String(bullet[2] || "").trim();
        const partes = dividir(
          cuerpo,
          HANG_W,
          BODY_SIZE,
          false,
          false
        );

        asegurarLinea(BODY_LINE);

        setFont(BODY_SIZE, false, false);
        doc.text(marcador, COMMENT_X, y);

        if (partes.length) {
          doc.text(String(partes[0]), HANG_X, y);
        }

        y += BODY_LINE;

        for (let i = 1; i < partes.length; i++) {
          asegurarLinea(BODY_LINE);
          doc.text(String(partes[i]), HANG_X, y);
          y += BODY_LINE;
        }

        y += 0.55;
        return;
      }

      // Texto normal del comentario.
      escribirLineas(linea, {
        x: COMMENT_X,
        width: COMMENT_W,
        size: BODY_SIZE,
        lineH: BODY_LINE
      });

      y += 0.55;
    });
  };

  // =========================================================
  // DATOS
  // =========================================================
  const titulo = String(
    it.predicaTitulo ||
    it.tituloPredica ||
    "Prédica"
  ).trim();

  const fecha = subidosFechaBonitaExport(it.fechaEvento || "");

  const introduccion = String(
    it.predicaIntroduccion ||
    it.introduccionPredica ||
    ""
  ).trim();

  const notaFinal = String(
    it.predicaNotaFinal ||
    it.notaFinalGeneral ||
    ""
  ).trim();

  const citas = obtenerCitasPredicaSubido(it);

  // =========================================================
  // ORDEN EXACTO
  // Título/Fecha
  // línea
  // Intro italic
  // línea
  // Cita + versículos
  // línea
  // Comentario
  // línea
  // siguiente cita...
  // Nota italic
  // =========================================================
  escribirCabecera(titulo, fecha);

  if (introduccion) {
    escribirItalic(introduccion);
    separador();
  }

  citas.forEach((cita, idx) => {
    const referencia = String(cita?.referencia || "").trim();
    const textoBiblico = String(cita?.texto || "").trim();
    const comentario = String(cita?.comentario || cita?.nota || "").trim();

    if (referencia) {
      escribirReferencia(referencia);
    }

    if (textoBiblico) {
      const versos = String(textoBiblico)
        .replace(/\r/g, "")
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

      versos.forEach(escribirVersiculo);
    }

    if (comentario) {
      separador();
      escribirComentario(comentario);
    }

    // Línea entre una cita completa y la siguiente.
    if (idx < citas.length - 1) {
      separador();
    }
  });

  if (notaFinal) {
    separador();
    escribirItalic(notaFinal);
  }

  return doc;
}

window.subidosImprimirPredica = async function subidosImprimirPredica(id) {
  const it = obtenerSubidoPorId(id);

  if (!it) {
    alert("No encontré la prédica para imprimir.");
    return;
  }

  // Abrimos una pestaña en el mismo click para evitar bloqueadores.
  const visorPdf = window.open("", "_blank");

  if (!visorPdf) {
    alert("El navegador bloqueó la vista de impresión. Permití ventanas emergentes para esta página.");
    return;
  }

  try {
    visorPdf.document.write(`
      <html>
        <head><title>Preparando impresión…</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          Preparando A4…
        </body>
      </html>
    `);

    const doc = await subidosCrearPdfPredica(it);

    if (typeof doc.autoPrint === "function") {
      try {
        doc.autoPrint({ variant: "non-conform" });
      } catch (e) {}
    }

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);

    visorPdf.location.replace(url);

    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch {}
    }, 120000);

  } catch (e) {
    console.error("No pude preparar el PDF de la prédica:", e);

    try {
      visorPdf.close();
    } catch {}

    alert("No pude preparar el A4 para imprimir.");
  }
};


function htmlPredicaBibliaSubidoGrande(it, abrirClave = "") {
  const citas = obtenerCitasPredicaSubido(it);
  const primeraCita = citas[0] || null;
  const otrasCitas = citas.slice(1);

  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();
  const introduccion = String(it.predicaIntroduccion || it.introduccionPredica || "").trim();
  const tituloPredica = String(it.predicaTitulo || it.tituloPredica || "").trim();
  const fondoUrl = subidosFondoPredicaActual(it);

  const comentarioPrimera = String(
    primeraCita?.comentario || primeraCita?.nota || ""
  ).trim();

  const primeraBloque = primeraCita ? `
    <section class="subidos-visor-bloque subidos-visor-bloque-primera">
      <div class="subidos-visor-ref">
        ${escaparHtml(primeraCita.referencia || "")}
      </div>

      ${primeraCita.texto ? `
        <div class="subidos-visor-texto subidos-visor-texto-primera subidos-visor-versiculo-box">
          ${subidosTextoHtml(primeraCita.texto || "")}
        </div>
      ` : ``}

      ${comentarioPrimera ? `
        <div class="subidos-visor-comentario">
          ${subidosTextoHtml(comentarioPrimera)}
        </div>
      ` : ``}
    </section>
  ` : ``;

  const bloquesRestantes = otrasCitas.map((c) => {
    const comentario = String(c.comentario || c.nota || "").trim();

    return `
      <section class="subidos-visor-bloque">
        <div class="subidos-visor-ref">${escaparHtml(c.referencia || "")}</div>

        ${c.texto ? `
          <div class="subidos-visor-texto subidos-visor-versiculo-box">
            ${subidosTextoHtml(c.texto || "")}
          </div>
        ` : ``}

        ${comentario ? `
          <div class="subidos-visor-comentario">
            ${subidosTextoHtml(comentario)}
          </div>
        ` : ``}
      </section>
    `;
  }).join("");

const descripcionPredica = String(
  it.descripcion || "Pastor Kevin Gauna"
).trim();
  
  const bloqueInfoEstilo = `
    margin:10px 0 12px;
    padding:12px 16px;
    border-radius:16px;
    background:rgba(255,255,255,.88);
    border:1px solid #d8eef9;
  `;

  return `
    <div class="subidos-visor-predica-full">
      <div
        class="subidos-visor-marco"
        style="--subidos-predica-fondo:url('${subidosCssUrl(fondoUrl)}');"
      >
               <div class="subidos-visor-encabezado-predica">
          <div class="subidos-visor-iglesia-top">
            Iglesia Cristiana de la Vida Abundante
          </div>

          <div class="subidos-visor-desc-top">
            ${escaparHtml(descripcionPredica)}
          </div>
        </div>

        ${it.url ? `
          <div class="subidos-visor-archivo">
            ${htmlArchivoGrandePredica(it)}
          </div>
        ` : ``}

        ${tituloPredica ? `
          <div class="subidos-visor-predica-titulo">
            ${escaparHtml(tituloPredica)}
          </div>
        ` : ``}

        ${subidosHtmlAudioPredica(it)}

        ${introduccion ? `
          <div style="${bloqueInfoEstilo}">
            <div class="subidos-visor-intro">
              ${subidosTextoHtml(introduccion)}
            </div>
          </div>
        ` : ``}

        ${primeraBloque}

        ${bloquesRestantes ? `
          <div class="subidos-visor-bloques">
            ${bloquesRestantes}
          </div>
        ` : ``}

        ${notaFinal ? `
          <div style="${bloqueInfoEstilo}">
            <div class="subidos-visor-intro">
              ${subidosTextoHtml(notaFinal)}
            </div>
          </div>
        ` : ``}

        <div class="subidos-visor-cierre">
          Domingos 10 hs - Roca 123, Tristan Suarez.
        </div>
      </div>
    </div>
  `;
}

// ✅ Permite que Compartidos reutilice la prédica ABIERTA,
// sin rehacerla como mini card de galería.
window.subidosRenderPredicaAbiertaHTML = function subidosRenderPredicaAbiertaHTML(item, abrirClave = "all") {
  if (!item) return "";

  try {
    const html = htmlPredicaBibliaSubidoGrande(item, abrirClave);

    // ✅ Compartidos NUNCA recibe el botón de impresión.
    // Esto protege el abrir/cerrar aunque el visor de Subidos tenga su propio botón.
    const tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");

    tpl.content
      .querySelectorAll(
        '[data-subidos-print-a4], button[onclick*="subidosImprimirPredica"]'
      )
      .forEach(el => el.remove());

    return tpl.innerHTML;
  } catch (e) {
    console.error("No pude renderizar prédica abierta para Compartidos:", e);
    return "";
  }
};

window.abrirSubidosVisorPredica =
  function abrirSubidosVisorPredica(
    id,
    abrirClave = ""
  ) {
    const it =
      obtenerSubidoPorId(id);

    if (!it) return;

    const idPrint = String(it?.id || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'");

    const botonImprimir = `
      <div
        data-subidos-print-a4="1"
        style="
        display:flex;
        justify-content:flex-end;
        align-items:center;
        margin:0 0 8px;
      ">
        <button
          type="button"
          onclick="event.stopPropagation(); subidosImprimirPredica('${idPrint}')"
          title="Imprimir prédica en A4"
          aria-label="Imprimir prédica en A4"
          style="
            border:1px solid #cfd8df;
            background:#fff;
            color:#111;
            border-radius:999px;
            padding:8px 13px;
            font-weight:800;
            cursor:pointer;
            display:inline-flex;
            align-items:center;
            gap:7px;
            box-shadow:0 3px 10px rgba(0,0,0,.10);
          "
        >
          <i class="fa-solid fa-print"></i>
          Imprimir A4
        </button>
      </div>
    `;

    abrirModalSubidosVisor(
      it.etiqueta || "Prédica",

      botonImprimir +
      htmlPredicaBibliaSubidoGrande(
        it,
        abrirClave
      )
    );
  };

function subidosHtmlArchivoVisor(archivo, idx) {
  const url = String(archivo?.url || "").trim();
  const mime = String(archivo?.mimeType || "");
  const nombre = escaparHtml(archivo?.fileName || "archivo");

  if (!url) return "";

  if (mime.startsWith("image/")) {
    return `
      <section id="subidosVisorArchivo-${idx}" class="subidos-visor-archivo-slide">
        <img src="${url}" alt="${nombre}" loading="lazy" decoding="async">
      </section>
    `;
  }

  if (mime.startsWith("video/")) {
    return `
      <section id="subidosVisorArchivo-${idx}" class="subidos-visor-archivo-slide">
        <video src="${url}" controls playsinline preload="metadata"></video>
      </section>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <section id="subidosVisorArchivo-${idx}" class="subidos-visor-archivo-slide">
        <div class="subidos-visor-archivo-audio">
          <i class="fa-solid fa-headphones"></i>
          <strong>${nombre}</strong>
          <audio src="${url}" controls preload="metadata"></audio>
        </div>
      </section>
    `;
  }

  return `
    <section id="subidosVisorArchivo-${idx}" class="subidos-visor-archivo-slide">
      <iframe src="${url}" title="${nombre}"></iframe>
    </section>
  `;
}

function subidosHtmlArchivosAbiertos(it, indiceInicial = 0) {
  const archivos = subidosArchivosItem(it);
  if (!archivos.length) return "";

  const mostrarFlechas = archivos.length > 1;

  return `
    <div class="subidos-visor-archivos-shell" data-indice-inicial="${Number(indiceInicial || 0)}">
      ${mostrarFlechas ? `
        <button type="button" class="subidos-visor-flecha subidos-visor-flecha-izq" onclick="subidosMoverVisorArchivo(this, -1)" title="Anterior">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      ` : ``}

      <div class="subidos-visor-archivos-carril">
        ${archivos.map((a, i) => subidosHtmlArchivoVisor(a, i)).join("")}
      </div>

      ${mostrarFlechas ? `
        <button type="button" class="subidos-visor-flecha subidos-visor-flecha-der" onclick="subidosMoverVisorArchivo(this, 1)" title="Siguiente">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      ` : ``}
    </div>
  `;
}

window.subidosMoverVisorArchivo = function subidosMoverVisorArchivo(btn, dir) {
  const shell = btn?.closest?.(".subidos-visor-archivos-shell");
  const carril = shell?.querySelector(".subidos-visor-archivos-carril");
  if (!carril) return;

  subidosMoverCarrilCircular(carril, dir, ".subidos-visor-archivo-slide");
};

window.abrirSubidosVisorArchivo = function abrirSubidosVisorArchivo(id, indiceInicial = 0) {
  const it = obtenerSubidoPorId(id);
  const archivos = subidosArchivosItem(it);

  if (!it || !archivos.length) return;

  const idx = Math.max(0, Math.min(Number(indiceInicial || 0), archivos.length - 1));

  // ✅ Arriba mostramos descripción, no nombre larguísimo del archivo
  const titulo = String(
    it.descripcion ||
    it.etiqueta ||
    "Vista previa"
  ).trim();

  abrirModalSubidosVisor(
    titulo,
    subidosHtmlArchivosAbiertos(it, idx)
  );

  setTimeout(() => {
    const body = document.getElementById("subidosVisorBody");
    const carril = body?.querySelector(".subidos-visor-archivos-carril");
    const slide = body?.querySelector(`#subidosVisorArchivo-${idx}`);

    if (carril && slide) {
      slide.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "center"
      });
    }
  }, 80);
};

// ✅ Para Compartidos: permite mostrar archivo común como card abierta, no mini card.
window.subidosRenderArchivoAbiertoHTML = function subidosRenderArchivoAbiertoHTML(item, indiceInicial = 0) {
  if (!item) return "";
  return subidosHtmlArchivosAbiertos(item, indiceInicial);
};

function subidosProxyArchivoUrl(url, nombre = "archivo", descargar = false) {
  const u = new URL(SUBIDOS_PROXY_URL);
  u.searchParams.set("url", url);
  u.searchParams.set("nombre", nombre || "archivo");
  if (descargar) u.searchParams.set("descargar", "1");
  return u.toString();
}

async function descargarArchivoRemoto(url, nombre = "archivo") {
  if (!url) throw new Error("No hay URL para descargar.");

  if (subidosEsAPKAndroid() && window.AndroidVida?.descargarArchivoBase64) {
    const proxy = subidosProxyArchivoUrl(url, nombre, false);

    const r = await fetch(proxy, {
      cache: "no-store"
    });

    if (!r.ok) {
      throw new Error("No pude preparar el archivo.");
    }

    const blob = await r.blob();
    const tipo =
      blob.type ||
      subidosMimeDesdeNombreUrl(nombre, url) ||
      "application/octet-stream";

    const nombreFinal = subidosNombreConExtension(nombre || "archivo", tipo, url);
    const blobFinal = blob.type === tipo ? blob : blob.slice(0, blob.size, tipo);
    const file = new File([blobFinal], nombreFinal, { type: tipo });

    await subidosAndroidDescargarFile(file);
    return;
  }

  const a = document.createElement("a");
  a.href = subidosProxyArchivoUrl(url, nombre, true);
  a.download = nombre || "archivo";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function subidosNombreArchivoParaCompartir(it) {
  const nombre = String(it?.fileName || it?.etiqueta || "archivo").trim();
  return nombre || "archivo";
}

async function subidosCompartirFileObligatorio(file, titulo = "Archivo", texto = "") {
  if (!file) {
    throw new Error("No hay archivo para compartir.");
  }

if (subidosEsAPKAndroid() && window.AndroidVida?.compartirArchivoBase64) {
  const fileFinal = subidosFileFrescoParaShare(file, "vida-abundante");

  await subidosAndroidCompartirFile(
    fileFinal,
    texto
  );

  return;
}

  if (!navigator.share) {
    throw new Error("Este navegador no permite compartir archivos desde la web.");
  }

  if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
    throw new Error("Este navegador no acepta compartir este tipo de archivo.");
  }

  const data = {
    files: [file],
    title: titulo
  };

  if (texto) {
    data.text = texto;
  }

  await navigator.share(data);
}

function subidosFileFrescoParaShare(file, base = "vida-abundante") {
  if (!file) return file;

  const tipo = String(file.type || "application/octet-stream").split(";")[0].trim();
  const ext =
    subidosExtensionPorMime(tipo) ||
    String(file.name || "").match(/\.([a-z0-9]{2,6})$/i)?.[1] ||
    "bin";

  // ✅ nombre simple, sin puntos raros, sin hora, sin caracteres del nombre original
  const nombre = subidosNombreLimpio(`${base || "vida-abundante"}.${ext}`);

  const blob = file.slice(0, file.size, tipo);

  return new File([blob], nombre, {
    type: tipo,
    lastModified: Date.now()
  });
}

async function subidosCompartirFileComunSinLinkObligatorio(file, titulo = "Archivo") {
  if (!file) {
    throw new Error("No se pudo preparar el archivo.");
  }

  // ✅ CLAVE:
  // No compartimos el File cacheado tal cual.
  // Creamos un File fresco en el toque, con nombre simple.
  const fileFinal = subidosFileFrescoParaShare(file, "vida-abundante");

  if (subidosEsAPKAndroid() && window.AndroidVida?.compartirArchivoBase64) {
    await subidosAndroidCompartirFile(fileFinal);
    return;
  }

  if (!navigator.share) {
    throw new Error("Este navegador no permite compartir archivos desde la web.");
  }

  if (navigator.canShare && !navigator.canShare({ files: [fileFinal] })) {
    throw new Error(`Este navegador no acepta compartir este archivo: ${fileFinal.name} / ${fileFinal.type}`);
  }

  // ✅ Solo archivo.
  // ✅ Sin link.
  // ✅ Sin text.
  return navigator.share({
    files: [fileFinal],
    title: titulo || "Archivo"
  });
}

const subidosAccionesEnCurso = new Set();

function subidosAvisoProceso(texto, permanente = false) {
  let el = document.getElementById("subidosAvisoProceso");

  if (!el) {
    el = document.createElement("div");
    el.id = "subidosAvisoProceso";

    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "22px",
      transform: "translateX(-50%)",
      background: "rgba(17, 24, 39, .94)",
      color: "#fff",
      padding: "10px 15px",
      borderRadius: "999px",
      fontWeight: "800",
      fontSize: "14px",
      zIndex: "999999",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
      pointerEvents: "none",
      maxWidth: "88vw",
      textAlign: "center",
      display: "none"
    });

    document.body.appendChild(el);
  }

  clearTimeout(el.__timer);
  el.textContent = texto;
  el.style.display = "block";

  if (!permanente) {
    el.__timer = setTimeout(() => {
      el.style.display = "none";
    }, 1800);
  }
}

function subidosBloquearBotonesCard(id, bloquear) {
  const card = document.getElementById(`subido-${id}`);
  if (!card) return;

  card.querySelectorAll(".subidos-feed-actions button").forEach(btn => {
    btn.disabled = bloquear;
    btn.style.opacity = bloquear ? ".55" : "";
    btn.style.pointerEvents = bloquear ? "none" : "";
  });
}

async function subidosAccionProtegida(id, tipo, textoProceso, accion) {
  const key = `subido-${id}`;

  if (subidosAccionesEnCurso.has(key)) {
    subidosAvisoProceso(textoProceso, true);
    return;
  }

  subidosAccionesEnCurso.add(key);
  subidosBloquearBotonesCard(id, true);
  subidosAvisoProceso(textoProceso, true);

  try {
    await accion();
    subidosAvisoProceso(tipo === "descargar" ? "Descarga lista ✅" : "Listo ✅");
  } catch (e) {
    if (e?.name === "AbortError") {
      subidosAvisoProceso("Acción cancelada");
    } else {
      console.error(`Error en ${tipo}:`, e);
      subidosAvisoProceso("No se pudo completar");
      alert(tipo === "descargar" ? "No se pudo descargar." : "No se pudo compartir.");
    }
  } finally {
    subidosBloquearBotonesCard(id, false);

    setTimeout(() => {
      subidosAccionesEnCurso.delete(key);
    }, 700);
  }
}

window.descargarSubido = async function descargarSubido(id, btn = null) {
  try {
    const it = obtenerSubidoPorId(id);

    if (!it) {
      alert("No se encontró el archivo.");
      return;
    }

    if (subidosEsVideoItem(it)) {
      subidosDescargarVideoDirecto(it);
      return;
    }

    const archivos = subidosArchivosItem(it);
    const cantidad = subidosEsPredicaConContenido(it) ? 1 : archivos.length;
    const actual = subidosIndiceActualDesdeBoton(id, btn);
    const modo = await subidosElegirTodoOActual("descargar", cantidad);
if (modo === "cancelar") {
  subidosAvisoProceso("Acción cancelada");
  return;
}

    if (modo === "todo" && cantidad > 1) {
      subidosAvisoProceso("Preparando todos los archivos...", true);

      for (let i = 0; i < cantidad; i++) {
const file = await subidosCrearFileDeItemPorIndice(it, i);
await subidosDescargarFileReal(file);

        // pequeño respiro para que el navegador no bloquee descargas seguidas
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      subidosAvisoProceso("Descarga lista ✅");
      return;
    }

    subidosAvisoProceso("Preparando archivo actual...", true);

const file = await subidosCrearFileDeItemPorIndice(it, actual);
await subidosDescargarFileReal(file);

    subidosAvisoProceso("Descarga lista ✅");
  } catch (e) {
    console.error("Error descargando:", e);
    subidosAvisoProceso("No se pudo descargar");
    alert("No se pudo descargar.");
  }
};

function subidosNumsDesdeCitaGuardada(cita) {
  const nums = [];

  if (Array.isArray(cita.segmentos) && cita.segmentos.length) {
    cita.segmentos.forEach(seg => {
      const d = Number(seg.desde || 0);
      const h = Number(seg.hasta || 0) || d;
      for (let n = d; n <= h; n++) nums.push(n);
    });
    return [...new Set(nums)].sort((a, b) => a - b);
  }

  const d = Number(cita.versiculoInicio || 0);
  const h = Number(cita.versiculoFin || 0) || d;
  for (let n = d; n <= h; n++) nums.push(n);

  return [...new Set(nums)].sort((a, b) => a - b);
}

async function poblarCardPredicaDesdeDato(card, cita) {
  const libro = cita.libro || "";
  const capitulo = String(cita.capitulo || "");
  const comentario = cita.comentario || cita.nota || "";

  await poblarLibrosPredicaEnCard(card, libro);
  await poblarCapitulosPredicaEnCard(card, libro, capitulo);
  await poblarVersiculosPredicaEnCard(card, libro, capitulo);

  subidosSetSeleccionados(card, subidosNumsDesdeCitaGuardada(cita));
  renderVersiculosPredicaEnCard(card);
  actualizarPreviewPredicaEnCard(card);

  const ta = card.querySelector(".subidosCitaNota");
  if (ta) ta.value = comentario;
}

window.abrirEditarSubido = async function abrirEditarSubido(id) {
  if (!subidosEsAdmin) {
    alert("Solo admin puede editar.");
    return;
  }

  const it = obtenerSubidoPorId(id);
  if (!it) return;

  abrirModalSubidos();
  subidosEditandoId = id;

  const ttl = document.getElementById("subidosModalTitulo");
  setSubidosModalTitulo("Editar subido");
  
  const fecha = document.getElementById("subidosFecha");
const etiqueta = document.getElementById("subidosEtiqueta");
const descripcion = document.getElementById("subidosDescripcion");
const archivo = document.getElementById("subidosArchivo");
const version = document.getElementById("subidosPredicaVersion");
const notaFinal = document.getElementById("subidosPredicaNotaFinal");
const intro = document.getElementById("subidosPredicaIntro");
const wrap = document.getElementById("subidosPredicaCitasWrap");
const tituloPredica = document.getElementById("subidosPredicaTitulo");
const fondoPredica = document.getElementById("subidosPredicaFondo");

  if (fecha) fecha.value = it.fechaEvento || "";
  if (etiqueta) etiqueta.value = it.etiqueta || "";
  if (descripcion) descripcion.value = it.descripcion || "";
  if (archivo) archivo.value = "";

  const archivoBox = document.getElementById("subidosArchivoActualBox");
  const archivoNombre = document.getElementById("subidosArchivoActualNombre");
  const btnVerArchivo = document.getElementById("btnVerArchivoActualSubido");

 const archivosActuales = subidosArchivosItem(it);

if (archivoBox) archivoBox.style.display = archivosActuales.length ? "block" : "none";

if (archivoNombre) {
  archivoNombre.textContent = archivosActuales.length > 1
    ? `${archivosActuales.length} archivos guardados`
    : (archivosActuales[0]?.fileName || it.fileName || "Archivo actual guardado");
}
  if (btnVerArchivo) {
    btnVerArchivo.onclick = () => {
      abrirSubidosVisorArchivo(it.id);
    };
  }

  actualizarPredicaSubidosUI();

  if (esPredicaSubidos(it.etiqueta || "")) {
    if (version) version.value = it.predicaVersion || (obtenerCitasPredicaSubido(it)[0]?.version || "RV1960");
    if (notaFinal) notaFinal.value = it.predicaNotaFinal || it.notaFinalGeneral || "";
    if (intro) intro.value = it.predicaIntroduccion || it.introduccionPredica || "";
    if (tituloPredica) tituloPredica.value = it.predicaTitulo || it.tituloPredica || "";
if (fondoPredica) {
  fondoPredica.value = it.predicaFondoUrl || SUBIDOS_EXPORT_BG_URL;
  subidosPoblarFondosPredica(fondoPredica.value);
}
    if (wrap) wrap.innerHTML = "";

    const citas = obtenerCitasPredicaSubido(it);

    if (citas.length) {
      for (const cita of citas) {
        const card = await window.subidosAgregarCitaPredica();
        if (card) {
          await poblarCardPredicaDesdeDato(card, cita);
        }
      }
    } else {
      await window.subidosAgregarCitaPredica();
    }
  }
};

function subidosHtmlBotonArchivoPreview(it, archivo, idx = 0) {
  const nombrePlano = archivo.fileName || "archivo";
  const nombre = escaparHtml(nombrePlano);
  const mime = String(archivo.mimeType || "");
  const url = String(archivo.url || "").trim();

  if (!url) return "";

  const idJs = subidosJs(it.id || "");

  const accionAbrir = subidosEsPredicaConContenido(it)
    ? `abrirSubidosVisorPredica('${idJs}', 'all')`
    : `abrirSubidosVisorArchivo('${idJs}', ${idx})`;

  if (mime.startsWith("image/")) {
    return `
      <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame subidos-media-slide is-image" title="Abrir">
        <img src="${url}" alt="${nombre}" loading="lazy" decoding="async">
      </button>
    `;
  }

  if (mime.startsWith("video/")) {
    const preview = subidosObtenerPreviewVideoInfo(it, archivo, idx);

    return `
      <button
        type="button"
        onclick="${accionAbrir}"
        class="subidos-media-link subidos-media-frame subidos-media-slide is-video subidos-video-frame"
        title="Abrir video"
      >
        ${subidosHtmlPosterVideo(preview.url, nombrePlano)}
      </button>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame subidos-media-slide is-audio" title="Abrir">
        <div class="subidos-file-open">
          <i class="fa-solid fa-headphones"></i>
          <span>${nombre}</span>
          <small>Tocar para abrir</small>
        </div>
      </button>
    `;
  }

  return `
    <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame subidos-media-slide is-file" title="Abrir">
      <div class="subidos-file-open">
        <i class="fa-solid fa-file-lines"></i>
        <span>${nombre}</span>
        <small>Tocar para abrir</small>
      </div>
    </button>
  `;
}

function subidosIndiceActualCarril(carril, selectorSlide) {
  const slides = [...carril.querySelectorAll(selectorSlide)]
    .filter(s => s.dataset.clon !== "1");

  if (!slides.length) return 0;

  const ancho = Math.max(1, carril.clientWidth);
  let idx = Math.round(carril.scrollLeft / ancho);

  if (idx < 0) idx = 0;
  if (idx >= slides.length) idx = slides.length - 1;

  return idx;
}

function subidosMoverCarrilCircular(carril, dir, selectorSlide) {
  if (!carril || carril.__subidosMoviendoCircular) return;

  const slides = [...carril.querySelectorAll(selectorSlide)]
    .filter(s => s.dataset.clon !== "1");

  if (slides.length <= 1) return;

  const actual = subidosIndiceActualCarril(carril, selectorSlide);
  const ultimo = slides.length - 1;
  const direccion = Number(dir || 0);

  carril.__subidosMoviendoCircular = true;

  // ✅ siguiente desde la última: avanza a un clon y luego salta invisible a la primera
  if (direccion > 0 && actual === ultimo) {
    const clonPrimera = slides[0].cloneNode(true);
    clonPrimera.dataset.clon = "1";
    carril.appendChild(clonPrimera);

    clonPrimera.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    setTimeout(() => {
      carril.style.scrollBehavior = "auto";

      slides[0].scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "center"
      });

      clonPrimera.remove();

      requestAnimationFrame(() => {
        carril.style.scrollBehavior = "";
        carril.__subidosMoviendoCircular = false;
      });
    }, 430);

    return;
  }

  // ✅ anterior desde la primera: va a un clon anterior y luego salta invisible a la última
  if (direccion < 0 && actual === 0) {
    const clonUltima = slides[ultimo].cloneNode(true);
    clonUltima.dataset.clon = "1";

    carril.insertBefore(clonUltima, carril.firstElementChild);

    const ancho = Math.max(1, carril.clientWidth);
    carril.scrollLeft += ancho;

    clonUltima.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });

    setTimeout(() => {
      carril.style.scrollBehavior = "auto";

      clonUltima.remove();

      slides[ultimo].scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "center"
      });

      requestAnimationFrame(() => {
        carril.style.scrollBehavior = "";
        carril.__subidosMoviendoCircular = false;
      });
    }, 430);

    return;
  }

  const siguiente = actual + direccion;

  slides[siguiente].scrollIntoView({
    behavior: "smooth",
    block: "nearest",
    inline: "center"
  });

  setTimeout(() => {
    carril.__subidosMoviendoCircular = false;
  }, 430);
}

window.subidosMoverCarruselCard = function subidosMoverCarruselCard(ev, btn, dir) {
  ev.preventDefault();
  ev.stopPropagation();

  const carril = btn.closest(".subidos-media-carousel")?.querySelector(".subidos-media-carril");
  if (!carril) return;

  subidosMoverCarrilCircular(carril, dir, ".subidos-media-slide");
};

function htmlPreviewArchivoSubido(it) {
  const archivos = subidosArchivosItem(it);
  if (!archivos.length) return "";

  if (archivos.length === 1) {
    return subidosHtmlBotonArchivoPreview(it, archivos[0], 0);
  }

  return `
    <div class="subidos-media-carousel">
      <button type="button" class="subidos-media-nav subidos-media-prev" onclick="subidosMoverCarruselCard(event, this, -1)" title="Anterior">
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <div class="subidos-media-carril">
        ${archivos.map((a, i) => subidosHtmlBotonArchivoPreview(it, a, i)).join("")}
      </div>

      <button type="button" class="subidos-media-nav subidos-media-next" onclick="subidosMoverCarruselCard(event, this, 1)" title="Siguiente">
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    </div>
  `;
}

/* =========================================================
   RENDER REUTILIZABLE: CARD DE SUBIDOS / PRÉDICA
   - Lo usa Subidos ahora.
   - Lo va a poder usar Compartidos después sin rehacer la card.
   ========================================================= */

function subidosJs(v = "") {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

function subidosRenderCardHTML(it = {}, opciones = {}) {
  const idReal = String(it.id || "").trim();
  const idJs = subidosJs(idReal);

  const idPrefix = opciones.idPrefix ?? "subido-";
  const domId = opciones.domId ?? `${idPrefix}${idReal}`;

  const mostrarEditar = opciones.mostrarEditar ?? subidosEsAdmin;
  const mostrarBorrarOriginal = opciones.mostrarBorrarOriginal ?? subidosEsAdmin;
  const mostrarAccionesArchivo = opciones.mostrarAccionesArchivo ?? true;

  // ✅ para Compartidos después: podremos pasar otro delete,
  // que borre solo de Compartidos y NO el archivo original.
  const borrarHtmlPersonalizado = opciones.borrarHtml || "";

  const extraFinal = opciones.extraFinal || "";

  const fechaTxt = it.fechaEvento
    ? new Date(it.fechaEvento + "T00:00:00").toLocaleDateString("es-AR")
    : "";

  const color = colorEtiquetaSubidos(it.etiqueta || "");
  const bloquePredica = htmlPredicaBibliaSubido(it);

  const archivosItem = subidosArchivosItem(it);
const archivoPrincipal = archivosItem[0] || null;

const tieneArchivo = archivosItem.length > 0;
  const tienePredica = subidosTieneContenidoPredica(it);
  const mostrarAcciones = mostrarAccionesArchivo && !!(tieneArchivo || tienePredica);

  const borrarHtml = borrarHtmlPersonalizado || (mostrarBorrarOriginal ? `
    <button
      type="button"
      class="subidosDangerMini"
      onclick="borrarSubido('${idJs}')"
      title="Borrar"
      style="opacity:.45;"
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  ` : ``);

  return `
    <div
      id="${escaparHtml(domId)}"
      class="subidos-feed-card ${subidosEsPredicaConContenido(it) ? "subidos-card-predica" : ""}"
      data-subido-card-id="${escaparHtml(idReal)}"
    >
      <div class="subidos-feed-head">
        <div class="subidos-feed-left">
          <div class="subidos-feed-badges" style="display:flex; align-items:center; gap:8px; flex-wrap:nowrap;">
            <span class="subidos-badge" style="background:${color.bg}; color:${color.fg};">
              <i class="fa-solid ${iconoSegunTipo(archivoPrincipal?.mimeType || it.mimeType || "")}"></i>
              ${escaparHtml(it.etiqueta || "Subido")}
            </span>

            ${fechaTxt ? `
              <span class="subidos-feed-date" style="white-space:nowrap; flex:0 0 auto;">
                ${fechaTxt}
              </span>
            ` : ``}
          </div>

          ${
            it.descripcion
              ? `<div class="subidos-feed-desc">${escaparHtml(it.descripcion || "")}</div>`
              : ``
          }
        </div>
      </div>

      ${tieneArchivo ? `
        <div class="subidos-media">
          ${htmlPreviewArchivoSubido(it)}
        </div>
      ` : ``}

${tienePredica ? bloquePredica : ``}

${tienePredica
  ? subidosHtmlAudioPredica(it)
  : ``
}

<div class="subidos-feed-actions">
        ${
          mostrarAcciones
            ? `
              <button
                type="button"
                data-subidos-download="${escaparHtml(idReal)}"
                onclick="descargarSubido('${idJs}', this)"
                title="Preparando archivo..."
                disabled
                style="opacity:.45; cursor:wait;"
              >
                <i class="fa-solid fa-download"></i>
              </button>

              <button
                type="button"
                data-subidos-share="${escaparHtml(idReal)}"
                onclick="event.preventDefault(); event.stopPropagation(); compartirSubido('${idJs}', this)"
                title="Preparando archivo..."
                disabled
                style="opacity:.45; cursor:wait;"
              >
                <i class="fa-solid fa-share-nodes"></i>
              </button>
            `
            : ``
        }

        ${
          mostrarEditar
            ? `
              <button type="button" onclick="abrirEditarSubido('${idJs}')" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
            `
            : ``
        }
      </div>

      ${borrarHtml}

      ${extraFinal}
    </div>
  `;
}

// ✅ funciones públicas para que Compartidos pueda reutilizarlas después
window.subidosRenderCardHTML = subidosRenderCardHTML;
window.subidosPrepararArchivoAccion = subidosPrepararArchivoAccion;

function renderFeed() {
  const feed = document.getElementById("subidosFeed");
  if (!feed) return;

  if (!subidosCargados) {
    feed.innerHTML = `
      <div class="subidos-feed-card" style="opacity:.85;">
        Cargando...
      </div>
    `;
    return;
  }

  if (!subidosItems.length) {
    feed.innerHTML = `
      <div class="subidos-feed-card" style="opacity:.85;">
        No hay archivos subidos todavía.
      </div>
    `;
    return;
  }

  feed.innerHTML = subidosItems.map(it => subidosRenderCardHTML(it, {
    idPrefix: "subido-",
    mostrarEditar: subidosEsAdmin,
    mostrarBorrarOriginal: subidosEsAdmin,
    mostrarAccionesArchivo: true
  })).join("");

  subidosPrepararArchivosDelFeed();
}

window.abrirSubidoDesdeCalendario = function abrirSubidoDesdeCalendario(id) {
  if (String(id || "").startsWith("habitual::")) {
    abrirNuevoHabitualDesdeCalendario(id);
    return;
  }

  const it = obtenerSubidoPorId(id);

  if (it) {
    if (subidosEsPredicaConContenido(it)) {
      abrirSubidosVisorPredica(id, "all");
      return;
    }

    if (it.url) {
      abrirSubidosVisorArchivo(id);
      return;
    }
  }

  const el = document.getElementById("subido-" + id);
  if (!el) return;

  el.scrollIntoView({
    behavior: "smooth",
    inline: "center",
    block: "nearest"
  });

  document.querySelectorAll(".subidos-feed-card.subidos-focus").forEach(x => {
    x.classList.remove("subidos-focus");
  });

  el.classList.add("subidos-focus");

  setTimeout(() => {
    el.classList.remove("subidos-focus");
  }, 1800);
};

window.compartirSubido = async function compartirSubido(id, btn = null) {
  try {
    const it = obtenerSubidoPorId(id);

    if (!it) {
      alert("No se encontró el archivo.");
      return;
    }

    const esPredica = subidosEsPredicaConContenido(it);
    const titulo = it?.descripcion || it?.etiqueta || "Archivo";

    // ✅ PRÉDICA: MISMO SISTEMA DE SIEMPRE, ARCHIVO + LINK.
    if (esPredica) {
      const info = subidosInfoArchivoAccion(it);
      const file = subidosLeerFileCachePorInfo(info, id);

      if (!file) {
        subidosPrepararArchivoAccion(id);
        alert("La prédica todavía se está preparando. Esperá unos segundos y tocá compartir otra vez.");
        return;
      }

      await subidosCompartirFileObligatorio(
        file,
        titulo,
        subidosLinkDetalle(id)
      );

      return;
    }

    // ✅ DEMÁS ETIQUETAS: MISMO SISTEMA QUE PRÉDICA, PERO SIN LINK.
    const archivos = subidosArchivosItem(it);

    if (!archivos.length) {
      alert("Este subido no tiene archivo para compartir.");
      return;
    }

    const actual = subidosIndiceActualDesdeBoton(id, btn);
    const info = subidosInfoShareArchivoPorIndice(it, actual);

    if (!info?.url) {
      throw new Error("No se encontró el archivo preparado para compartir.");
    }

    const idCache = Number(actual || 0) === 0 ? id : "";
    const file = subidosLeerFileCachePorInfo(info, idCache);

    if (!file) {
      subidosPrepararArchivoAccion(id);
      alert("El archivo todavía se está preparando. Esperá unos segundos y tocá compartir otra vez.");
      return;
    }

await subidosCompartirFileComunSinLinkObligatorio(
  file,
  titulo
);
  } catch (e) {
    console.error("Error en compartir:", e);

    if (e?.name === "AbortError") return;

    alert("No se pudo compartir.\n\n" + (e?.message || e?.name || e));
  }
};

window.borrarSubido = async function borrarSubido(id) {
  try {
    if (!subidosEsAdmin) {
      alert("Solo admin puede borrar archivos.");
      return;
    }

    const it = subidosItems.find(x => x.id === id);
    if (!it) {
      alert("No se encontró el archivo.");
      return;
    }

    const ok = confirm("¿Querés borrar este archivo?");
    if (!ok) return;

    await set(ref(db, `subidosIglesia/${id}`), null);
  } catch (e) {
    console.error("Error borrando subido:", e);
    alert("No se pudo borrar el archivo.");
  }
};

function refrescarSubidos() {
  renderMesTitulo();
  renderCalendario();
  renderFeed();

  const btnNuevo = document.getElementById("btnSubidoNuevo");
  if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";

  // ✅ prepara archivos reales en memoria para descargar/compartir
  subidosPrepararArchivosDelFeed();
}

function subidosFirmaVisualPredica(src = {}) {
  const citas = Array.isArray(src.predicaCitas) && src.predicaCitas.length
    ? src.predicaCitas
    : obtenerCitasPredicaSubido(src);

  const archivos = subidosArchivosItem(src).map(a => ({
    url: String(a.url || "").trim(),
    mimeType: String(a.mimeType || "").trim(),
    fileName: String(a.fileName || "").trim(),
    sizeBytes: Number(a.sizeBytes || 0),
    videoPreviewUrl: String(a.videoPreviewUrl || "").trim()
  }));

  return JSON.stringify({
    fechaEvento: String(src.fechaEvento || "").trim(),
    etiqueta: String(src.etiqueta || "").trim(),
    descripcion: String(src.descripcion || "").trim(),

    predicaTitulo: String(src.predicaTitulo || src.tituloPredica || "").trim(),
    predicaFondoUrl: String(src.predicaFondoUrl || "").trim(),
    predicaIntroduccion: String(src.predicaIntroduccion || src.introduccionPredica || "").trim(),
    predicaNotaFinal: String(src.predicaNotaFinal || src.notaFinalGeneral || "").trim(),

    citas: (Array.isArray(citas) ? citas : []).map(c => ({
      referencia: String(c?.referencia || "").trim(),
      texto: String(c?.texto || "").trim(),
      comentario: String(c?.comentario || c?.nota || "").trim()
    })),

    archivos
  });
}

function subidosPredicaNecesitaRegenerarShare(actual = {}, nuevo = {}) {
  const shareActual = String(actual.shareUrl || "").trim();
  if (!shareActual) return true;

  const firmaActual =
    String(actual.shareFingerprintPredica || "").trim() ||
    subidosFirmaVisualPredica(actual);

  const firmaNueva = subidosFirmaVisualPredica(nuevo);

  return firmaActual !== firmaNueva;
}

let subidosGuardando = false;

async function subidosCrearSharePredicaAlGuardar(id, datosBase) {
  if (!id || !datosBase) return null;

  try {
    const estado = document.getElementById("subidosEstado");
    if (estado) estado.textContent = "Generando imagen para compartir...";

    const blob = await subidosGenerarBlobCardPredica(id, {
      id,
      ...datosBase
    });

    const nombre = subidosNombreSharePredica({
      ...datosBase,
      id
    });

    const file = new File(
      [blob],
      nombre,
      { type: "image/png" }
    );

    if (estado) estado.textContent = "Subiendo imagen preparada...";

    const subida = await subirArchivoAR2DesdeWeb(file, "subidos-share");

    if (!subida?.url) return null;

    return {
      shareUrl: subida.url,
      shareR2Key: subida.key || "",
      shareMimeType: "image/png",
      shareFileName: nombre
    };
  } catch (e) {
    console.warn("No pude crear PNG preparado de prédica:", e);
    return null;
  }
}

// =========================================================
// 🎧 AUDIO DE PRÉDICAS
// =========================================================

function subidosAudioUrlPredica(it = {}) {
  return String(
    it.audioUrl ||
    it.audioGithubUrl ||
    it.audio ||
    ""
  ).trim();
}

function subidosFechaAudioPredica(fechaYMD = "") {
  const valor = String(fechaYMD || "").trim();
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return "";

  const meses = [
    "enero", "febrero", "marzo", "abril",
    "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"
  ];

  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);

  if (!anio || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return "";
  }

  return `${dia} de ${meses[mes - 1]} de ${anio}`;
}

function subidosQuitarNumerosVersiculosAudio(texto = "") {
  return String(texto || "")
    .replace(/(^|\n)\s*\d{1,3}\s*[.)-]\s*/g, "$1")
    .trim();
}

/*
  La prédica se envía como segmentos para que Firebase pueda:
  - usar la voz principal en fecha, citas y Biblia;
  - usar otra voz masculina en introducciones y comentarios;
  - unir todas las partes como un único MP3 válido;
  - colocar el arpa una sola vez sobre el audio completo.
*/
function subidosArmarSegmentosAudioPredica(it = {}) {
  const citas =
    typeof obtenerCitasPredicaSubido === "function"
      ? obtenerCitasPredicaSubido(it)
      : [];

  const segmentos = [];

  const agregar = (tipo, valor) => {
    const limpio = String(valor || "").trim();
    if (!limpio) return;

    segmentos.push({
      tipo: tipo === "comentario" ? "comentario" : "biblia",
      texto: tipo === "biblia"
        ? subidosQuitarNumerosVersiculosAudio(limpio)
        : limpio
    });
  };

  const fechaLarga = subidosFechaAudioPredica(
    it.fechaEvento || ""
  );

  agregar(
    "biblia",
    fechaLarga
      ? `Prédica del ${fechaLarga}.`
      : "Prédica."
  );

  const tituloPredica = String(
    it.predicaTitulo ||
    it.tituloPredica ||
    ""
  ).trim();

  if (
    tituloPredica &&
    !/^pr[eé]dica$/i.test(tituloPredica)
  ) {
    agregar("biblia", tituloPredica);
  }

  agregar(
    "comentario",
    it.predicaIntroduccion ||
    it.introduccionPredica ||
    ""
  );

  citas.forEach(cita => {
    agregar("biblia", cita?.referencia || "");
    agregar("biblia", cita?.texto || "");
    agregar(
      "comentario",
      cita?.comentario ||
      cita?.nota ||
      ""
    );
  });

  agregar(
    "comentario",
    it.predicaNotaFinal ||
    it.notaFinalGeneral ||
    ""
  );

  return segmentos.filter(segmento => segmento.texto);
}

function subidosArmarTextoAudioPredica(it = {}) {
  return subidosArmarSegmentosAudioPredica(it)
    .map(segmento => segmento.texto)
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

/*
  Reproductor reutilizable.

  Lo usaremos en:
  - Subidos
  - Visor de la prédica
  - Compartidos
*/
function subidosHtmlAudioPredica(it = {}) {
  const audioUrl =
    subidosAudioUrlPredica(it);

  if (!audioUrl) return "";

  return `
    <div
      class="subidos-predica-audio"
      onclick="event.stopPropagation()"
    >
      <audio
        controls
        playsinline
        preload="metadata"
        src="${escaparHtml(audioUrl)}"
      ></audio>
    </div>
  `;
}

window.subidosHtmlAudioPredica =
  subidosHtmlAudioPredica;

/*
  Abre el modal común de audio,
  pero indicando que ahora pertenece
  a una prédica.
*/
window.subidosAbrirAudioPredica =
  function(idPredica = "", itemBase = null) {
    const id =
      String(idPredica || "").trim();

    const base =
      itemBase &&
      typeof itemBase === "object"
        ? itemBase
        : obtenerSubidoPorId(id);

    if (!id || !base) {
      alert(
        "No encontré la prédica para crear el audio."
      );
      return;
    }

    const item = {
      ...base,
      id
    };

    const segmentos =
      subidosArmarSegmentosAudioPredica(item);

    const texto = segmentos
      .map(segmento => segmento.texto)
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!texto) {
      alert(
        "La prédica no tiene texto para convertir en audio."
      );
      return;
    }

    window.__AUDIO_ORIGEN =
      "predica";

    window.__AUDIO_PREDICA_ID =
      id;

    window.__AUDIO_PREDICA_TEXTO =
      texto;

    window.__AUDIO_PREDICA_SEGMENTOS =
      segmentos;

    window.__AUDIO_PREDICA_FECHA =
      String(item.fechaEvento || "").trim();

    window.__AUDIO_PREDICA_URL =
      subidosAudioUrlPredica(item);

    if (
      typeof window.abrirModalAudio !==
      "function"
    ) {
      alert(
        "Todavía no cargó el sistema de audio."
      );
      return;
    }

    window.abrirModalAudio();
  };

/*
  Guarda únicamente los campos de audio.

  No modifica fecha, título, citas,
  PNG ni posición de la prédica.
*/
window.subidosGuardarAudioPredica =
  async function({
    id = "",
    url = "",
    texto = ""
  } = {}) {
    const idLimpio =
      String(id || "").trim();

    const urlLimpia =
      String(url || "").trim();

    if (!idLimpio || !urlLimpia) {
      throw new Error(
        "Faltan los datos del audio de la prédica."
      );
    }

    const ahora = Date.now();

    const cambios = {
      audioUrl: urlLimpia,
      audioGithubUrl: urlLimpia,
      audio: urlLimpia,

      audioTexto:
        String(texto || "").trim(),

      audioFecha: ahora,
      audioOk: true
    };

    const base =
      `subidosIglesia/${idLimpio}`;

    await Promise.all([
      set(
        ref(db, `${base}/audioUrl`),
        cambios.audioUrl
      ),

      set(
        ref(db, `${base}/audioGithubUrl`),
        cambios.audioGithubUrl
      ),

      set(
        ref(db, `${base}/audio`),
        cambios.audio
      ),

      set(
        ref(db, `${base}/audioTexto`),
        cambios.audioTexto
      ),

      set(
        ref(db, `${base}/audioFecha`),
        cambios.audioFecha
      ),

      set(
        ref(db, `${base}/audioOk`),
        true
      )
    ]);

    /*
      Actualización inmediata de la memoria local,
      sin esperar otra lectura de Firebase.
    */
    const indice =
      subidosItems.findIndex(
        item =>
          String(item?.id || "") ===
          idLimpio
      );

    if (indice >= 0) {
      subidosItems[indice] = {
        ...subidosItems[indice],
        ...cambios
      };
    }

    try {
      renderFeed();
    } catch (e) {}

    try {
      window.renderCompartidos?.();
    } catch (e) {}

    return cambios;
  };

async function guardarSubido() {
  if (subidosGuardando) return;

  try {
    if (!subidosUID) {
      alert("Necesitás iniciar sesión.");
      return;
    }

    if (!subidosEsAdmin) {
      alert("Solo admin puede subir archivos.");
      return;
    }

    const inpFile = document.getElementById("subidosArchivo");
    const inpFecha = document.getElementById("subidosFecha");
    const inpEtiqueta = document.getElementById("subidosEtiqueta");
    const inpDesc = document.getElementById("subidosDescripcion");
    const estado = document.getElementById("subidosEstado");
    const btnGuardar = document.getElementById("btnGuardarSubido");

    const actual = subidosEditandoId ? (obtenerSubidoPorId(subidosEditandoId) || {}) : {};
    const files = [...(inpFile?.files || [])];
    const file = files[0] || null;

    const fechaEvento = (inpFecha?.value || "").trim();
    const etiqueta = (inpEtiqueta?.value || "").trim();
    const descripcion = (inpDesc?.value || "").trim();
    const esPredica = esPredicaSubidos(etiqueta);
    const modalSubidos = document.getElementById("modalSubidos");
    const esCumpleanos = subidosEsCumpleanos(etiqueta);

    const datosCumpleanos = esCumpleanos ? {
      cumpleHermanoId: modalSubidos?.dataset?.cumpleHermanoId || actual.cumpleHermanoId || "",
      cumpleTelefono: modalSubidos?.dataset?.cumpleTelefono || actual.cumpleTelefono || "",
      cumpleNombre: modalSubidos?.dataset?.cumpleNombre || actual.cumpleNombre || descripcion || ""
    } : {};

    const permiteSinArchivo = ["racimo", "oracion", "cumpleanos"].includes(
      normalizarEtiquetaSubidos(etiqueta)
    );

    const tieneArchivoActual = subidosArchivosItem(actual).length > 0;

    if (!fechaEvento) {
      alert("Completá la fecha.");
      return;
    }

    if (!etiqueta) {
      alert("Elegí una etiqueta.");
      return;
    }

    // ✅ Si hay video, solo permitimos 1 archivo.
    if (files.length > 1 && files.some(f => subidosEsVideoFile(f))) {
      alert("Cuando subís video, solo se permite 1 archivo en esa card.");
      return;
    }

    if (!file && !esPredica && !tieneArchivoActual && !permiteSinArchivo) {
      alert("Elegí un archivo.");
      return;
    }

let datosPredica = {
  version: "",
  titulo: "",
  fondoUrl: SUBIDOS_EXPORT_BG_URL,
  introduccion: "",
  citas: [],
  notaFinalGeneral: ""
};

if (esPredica) {
  const citasGuardadas = obtenerCitasPredicaSubido(actual);

  try {
    datosPredica = recogerDatosPredicaSubidos();
  } catch (e) {
    /*
      Si al editar el formulario quedó roto/incompleto,
      pero la prédica ya tenía citas guardadas,
      NO dejamos que se borre.
    */
    if (subidosEditandoId && citasGuardadas.length) {
      console.warn("Formulario de prédica incompleto. Mantengo citas guardadas:", e);

      datosPredica = {
        version: actual.predicaVersion || citasGuardadas[0]?.version || "RV1960",
        titulo: actual.predicaTitulo || "",
        fondoUrl: actual.predicaFondoUrl || SUBIDOS_EXPORT_BG_URL,
        introduccion: actual.predicaIntroduccion || "",
        citas: citasGuardadas,
        notaFinalGeneral: actual.predicaNotaFinal || ""
      };
    } else {
      throw e;
    }
  }

  const citasNuevas = Array.isArray(datosPredica.citas)
    ? datosPredica.citas
    : [];

  /*
    EMERGENCIA:
    Si estoy editando una prédica y el formulario quedó sin citas,
    conservamos las citas que ya estaban guardadas.
  */
  if (subidosEditandoId && !citasNuevas.length && citasGuardadas.length) {
    datosPredica.citas = citasGuardadas;

    datosPredica.version =
      datosPredica.version ||
      actual.predicaVersion ||
      citasGuardadas[0]?.version ||
      "RV1960";

    datosPredica.titulo =
      datosPredica.titulo ||
      actual.predicaTitulo ||
      "";

    datosPredica.fondoUrl =
      datosPredica.fondoUrl ||
      actual.predicaFondoUrl ||
      SUBIDOS_EXPORT_BG_URL;

    datosPredica.introduccion =
      datosPredica.introduccion ||
      actual.predicaIntroduccion ||
      "";

    datosPredica.notaFinalGeneral =
      datosPredica.notaFinalGeneral ||
      actual.predicaNotaFinal ||
      "";
  }

  /*
    Si no hay citas nuevas NI guardadas,
    frenamos el guardado para no destruir la publicación.
  */
  if (!Array.isArray(datosPredica.citas) || !datosPredica.citas.length) {
    alert(
      "⚠️ No guardé la prédica porque quedó sin cita bíblica.\n\n" +
      "Para evitar borrar contenido, elegí la cita bíblica de nuevo antes de guardar."
    );

    return;
  }
}

    subidosGuardando = true;
    if (btnGuardar) btnGuardar.disabled = true;

    if (estado) {
      estado.textContent = files.length > 1
        ? `Subiendo ${files.length} archivos...`
        : file
          ? "Subiendo archivo..."
          : "Guardando...";
    }

    const ts = Date.now();

let archivos = subidosArchivosItem(actual).map(a => ({
  url: a.url || "",
  r2Key: a.r2Key || "",
  mimeType: a.mimeType || "",
  fileName: a.fileName || "archivo",
  sizeBytes: Number(a.sizeBytes || 0),
  subidaDirectaVideo: !!a.subidaDirectaVideo,

  videoPreviewUrl: a.videoPreviewUrl || "",
  videoPreviewR2Key: a.videoPreviewR2Key || "",
  videoPreviewMimeType: a.videoPreviewMimeType || "",
  videoPreviewFileName: a.videoPreviewFileName || "",

  shareUrl: a.shareUrl || "",
  shareR2Key: a.shareR2Key || "",
  shareMimeType: a.shareMimeType || "",
  shareFileName: a.shareFileName || ""
}));

    let principalActual = archivos[0] || {};

let url = principalActual.url || actual.url || "";
let r2Key = principalActual.r2Key || actual.r2Key || "";
let mimeType = principalActual.mimeType || actual.mimeType || "";
let fileName = principalActual.fileName || actual.fileName || "";
let sizeBytes = Number(principalActual.sizeBytes || actual.sizeBytes || 0);
let subidaDirectaVideo = !!(principalActual.subidaDirectaVideo || actual.subidaDirectaVideo);

let videoPreviewUrl = principalActual.videoPreviewUrl || actual.videoPreviewUrl || "";
let videoPreviewR2Key = principalActual.videoPreviewR2Key || actual.videoPreviewR2Key || "";
let videoPreviewMimeType = principalActual.videoPreviewMimeType || actual.videoPreviewMimeType || "";
let videoPreviewFileName = principalActual.videoPreviewFileName || actual.videoPreviewFileName || "";

    if (files.length) {
      archivos = [];

      for (let i = 0; i < files.length; i++) {
        const fileActual = files[i];
        const esVideo = subidosEsVideoFile(fileActual);

        if (estado) {
          estado.textContent = files.length > 1
            ? `Subiendo archivo ${i + 1} de ${files.length}...`
            : esVideo
              ? `Preparando video (${subidosFormatoMB(fileActual.size)} MB)...`
              : "Subiendo archivo...";
        }

        const subida = esVideo
          ? await subirVideoR2DirectoSubidos(fileActual, estado)
          : await subirArchivoAR2DesdeWeb(fileActual, "subidos");

let previewVideoData = {
  videoPreviewUrl: "",
  videoPreviewR2Key: "",
  videoPreviewMimeType: "",
  videoPreviewFileName: ""
};

if (esVideo) {
  previewVideoData = await subidosCrearVistaPreviaVideoAlGuardar(
    fileActual,
    estado,
    i
  );
}

const archivoBase = {
  url: subida?.url || "",
  r2Key: subida?.key || "",
  mimeType: subida?.contentType || fileActual?.type || "",
  fileName: subida?.fileName || fileActual?.name || `archivo_${i + 1}`,
  sizeBytes: Number(subida?.sizeBytes || fileActual?.size || 0),
  subidaDirectaVideo: !!subida?.subidaDirectaVideo,

  ...previewVideoData,

  shareUrl: "",
  shareR2Key: "",
  shareMimeType: "",
  shareFileName: ""
};

// ✅ NO-PRÉDICA: preparar al guardar, igual que prédica, pero sin link.
if (!esPredica) {
  const shareComunFile = await subidosCrearShareComunAlGuardarDesdeFile(
    fileActual,
    estado,
    i
  );

  if (shareComunFile?.shareUrl) {
    Object.assign(archivoBase, shareComunFile);
  }
}

archivos.push(archivoBase);
      }

const principal = archivos[0] || {};

url = principal.url || "";
r2Key = principal.r2Key || "";
mimeType = principal.mimeType || "";
fileName = principal.fileName || "";
sizeBytes = Number(principal.sizeBytes || 0);
subidaDirectaVideo = !!principal.subidaDirectaVideo;

videoPreviewUrl = principal.videoPreviewUrl || "";
videoPreviewR2Key = principal.videoPreviewR2Key || "";
videoPreviewMimeType = principal.videoPreviewMimeType || "";
videoPreviewFileName = principal.videoPreviewFileName || "";
    }

    const destinoRef = subidosEditandoId
      ? ref(db, `subidosIglesia/${subidosEditandoId}`)
      : push(ref(db, "subidosIglesia"));

    const idFinal = destinoRef.key;

    const predicaRef = esPredica
      ? (
          actual.predicaRef && actual.fechaEvento === fechaEvento
            ? actual.predicaRef
            : subidosCrearPredicaRef(fechaEvento, idFinal)
        )
      : "";

    // ✅ cuando guardo/edito, borro cache viejo para no compartir imagen anterior
subidosFileCache.delete(idFinal);
subidosFilePreparando.delete(idFinal);

/*
  Si estamos editando una prédica que ya tenía audio,
  lo conservamos mientras se vuelve a guardar.
*/
const audioAnteriorUrl =
  String(
    actual.audioUrl ||
    actual.audioGithubUrl ||
    actual.audio ||
    ""
  ).trim();

const datosBase = {
      fecha: actual.fecha || ts,
      fechaEdicion: subidosEditandoId ? ts : "",
      fechaEvento,
      etiqueta,
      descripcion,

      // ✅ compatibilidad vieja: se sigue guardando el primer archivo como url principal
url,
r2Key,
mimeType,
fileName,
sizeBytes,
subidaDirectaVideo,

videoPreviewUrl,
videoPreviewR2Key,
videoPreviewMimeType,
videoPreviewFileName,

      // ✅ nuevo: todos los archivos de la misma card
      archivos,

      uidCreador: actual.uidCreador || subidosUID,
      esEventoSinArchivo: !url && permiteSinArchivo && !esPredica,
      esPredica,
      predicaRef,
      predicaVersion: esPredica ? datosPredica.version : "",
predicaTitulo: esPredica ? datosPredica.titulo : "",
predicaFondoUrl: esPredica ? datosPredica.fondoUrl : "",
predicaIntroduccion: esPredica ? datosPredica.introduccion : "",
predicaCitas: esPredica ? datosPredica.citas : [],
predicaNotaFinal: esPredica ? datosPredica.notaFinalGeneral : "",

        // ✅ Mantener el audio anterior al editar
      audioUrl: audioAnteriorUrl,
      audioGithubUrl: audioAnteriorUrl,
      audio: audioAnteriorUrl,

      audioTexto:
        String(
          actual.audioTexto || ""
        ).trim(),

      audioFecha:
        Number(
          actual.audioFecha || 0
        ),

      audioOk:
        !!audioAnteriorUrl,

      // ✅ para acciones reales de archivo
// ✅ No guardar el original como share.
// El share real se pone abajo con subidosPrepararSharesComunesAlGuardar()
// o con subidosCrearSharePredicaAlGuardar().
shareUrl: "",
shareR2Key: "",
shareMimeType: "",
shareFileName: "",
shareFingerprintPredica: esPredica ? subidosFirmaVisualPredica({
  ...actual,
  fechaEvento,
  etiqueta,
  descripcion,
  predicaTitulo: esPredica ? datosPredica.titulo : "",
  predicaFondoUrl: esPredica ? datosPredica.fondoUrl : "",
  predicaIntroduccion: esPredica ? datosPredica.introduccion : "",
  predicaCitas: esPredica ? datosPredica.citas : [],
  predicaNotaFinal: esPredica ? datosPredica.notaFinalGeneral : "",
  archivos,
  url,
  mimeType,
  fileName,
  sizeBytes,
  videoPreviewUrl
}) : "",

      ...datosCumpleanos
    };

// =========================================================
// GUARDADO FINAL DEL SUBIDO
// =========================================================

/*
  Backup automático antes de editar.
  Si algo se pisa en el futuro, queda copia en:
  subidosBackups/{id}/{timestamp}
*/
if (subidosEditandoId && actual && Object.keys(actual).length) {
  try {
    await set(
      ref(db, `subidosBackups/${idFinal}/${Date.now()}`),
      {
        ...actual,
        backupTs: Date.now(),
        backupMotivo: "antes_de_editar_subido"
      }
    );
  } catch (e) {
    console.warn("No pude crear backup del subido antes de editar:", e);
  }
}

let datosFinalGuardados =
  datosBase;

/*
  PRÉDICA:
  guarda los datos y después prepara su PNG.
*/
if (esPredica) {
  await set(
    destinoRef,
    datosBase
  );

  const necesitaRegenerarShare = subidosPredicaNecesitaRegenerarShare(
    actual,
    datosBase
  );

  let regenerarShare = necesitaRegenerarShare;

  // ✅ Al EDITAR una prédica que ya tiene imagen, preguntamos.
  // Una prédica nueva (o una vieja sin imagen) se genera automáticamente.
  if (
    necesitaRegenerarShare &&
    subidosEditandoId &&
    String(actual.shareUrl || "").trim()
  ) {
    regenerarShare = window.confirm(
      "Cambiaste datos de la prédica que pueden modificar la imagen para compartir.\n\n" +
      "¿Querés regenerar la imagen ahora?\n\n" +
      "Aceptar = regenerar imagen\nCancelar = conservar la imagen actual"
    );
  }

  if (regenerarShare) {
    const share =
      await subidosCrearSharePredicaAlGuardar(
        idFinal,
        datosBase
      );

    if (share?.shareUrl) {
      datosFinalGuardados = {
        ...datosBase,
        ...share
      };

      await set(
        destinoRef,
        datosFinalGuardados
      );

      subidosFileCache.delete(idFinal);
      subidosFilePreparando.delete(idFinal);
    }
  } else {
    datosFinalGuardados = {
      ...datosBase,
      shareUrl: actual.shareUrl || "",
      shareR2Key: actual.shareR2Key || "",
      shareMimeType: actual.shareMimeType || "",
      shareFileName: actual.shareFileName || "",
      shareFingerprintPredica:
        actual.shareFingerprintPredica ||
        datosBase.shareFingerprintPredica ||
        ""
    };

    await set(
      destinoRef,
      datosFinalGuardados
    );
  }

} else {
  /*
    Otras etiquetas:
    prepara el archivo para compartir
    sin agregar link de publicación.
  */
  let datosFinal =
    datosBase;

  if (archivos.length) {
    const shareComun =
      await subidosPrepararSharesComunesAlGuardar(
        idFinal,
        datosBase,
        estado
      );

    if (shareComun?.shareUrl) {
      datosFinal = {
        ...datosBase,
        ...shareComun
      };
    }
  }

  datosFinalGuardados =
    datosFinal;

  await set(
    destinoRef,
    datosFinal
  );

  subidosFileCache.delete(idFinal);
  subidosFilePreparando.delete(idFinal);
}

// ⛔ NO guardar subidosEtiquetas acá.
// Ese nodo está dando permission denied y no hace falta para guardar el subido.

if (estado) {
  estado.textContent = "✅ Guardado";
}

cerrarModalSubidos();

/*
  Al terminar una prédica,
  pasamos directamente al audio.
*/
if (esPredica) {
  const predicaParaAudio = {
    id: idFinal,
    ...datosFinalGuardados
  };

  setTimeout(() => {
    window.subidosAbrirAudioPredica?.(
      idFinal,
      predicaParaAudio
    );
  }, 220);
}
  } catch (e) {
    console.error("Error guardando subido:", e);

    const estado = document.getElementById("subidosEstado");
    if (estado) estado.textContent = "❌ No se pudo guardar";

    alert("No se pudo guardar el subido.\n\n" + (e?.message || e));
  } finally {
    subidosGuardando = false;

    const btnGuardar = document.getElementById("btnGuardarSubido");
    if (btnGuardar) btnGuardar.disabled = false;
  }
}

function initSubidosBotones() {
  const btnNuevo = document.getElementById("btnSubidoNuevo");
  const btnAnt = document.getElementById("btnSubidosMesAnt");
  const btnSig = document.getElementById("btnSubidosMesSig");
  const btnGuardar = document.getElementById("btnGuardarSubido");
  const btnAgregarEtiqueta = document.getElementById("btnAgregarEtiquetaSubidos");
  const selEtiqueta = document.getElementById("subidosEtiqueta");
  const btnAgregarCita = document.getElementById("btnSubidosAgregarCita");
  const selVersionPredica = document.getElementById("subidosPredicaVersion");

  if (btnNuevo) btnNuevo.onclick = abrirModalSubidos;

  if (btnAnt) {
    btnAnt.onclick = () => {
      subidosMesActual = new Date(subidosMesActual.getFullYear(), subidosMesActual.getMonth() - 1, 1);
      refrescarSubidos();
    };
  }

  if (btnSig) {
    btnSig.onclick = () => {
      subidosMesActual = new Date(subidosMesActual.getFullYear(), subidosMesActual.getMonth() + 1, 1);
      refrescarSubidos();
    };
  }

  if (btnGuardar) btnGuardar.onclick = guardarSubido;

  if (selEtiqueta && !selEtiqueta.__predicaHook) {
    selEtiqueta.__predicaHook = true;
    selEtiqueta.addEventListener("change", actualizarPredicaSubidosUI);
  }

  if (btnAgregarCita && !btnAgregarCita.__citaHook) {
    btnAgregarCita.__citaHook = true;
    btnAgregarCita.addEventListener("click", () => {
      window.subidosAgregarCitaPredica();
    });
  }

  if (selVersionPredica && !selVersionPredica.__versionHook) {
    selVersionPredica.__versionHook = true;
    selVersionPredica.addEventListener("change", () => {
      recargarVersionPredicaCards();
    });
  }

  if (btnAgregarEtiqueta) {
    btnAgregarEtiqueta.onclick = () => {
      if (!subidosEsAdmin) return;

      const nueva = prompt("Nueva etiqueta:");
      if (!nueva || !nueva.trim()) return;

      const limpia = nueva.trim();

      // ✅ Solo local. No escribir en subidosEtiquetas porque ese nodo da permission denied.
      subidosEtiquetas = Array.from(
        new Set([...(subidosEtiquetas || []), limpia])
      ).sort((a, b) => a.localeCompare(b));

      poblarEtiquetas();

      if (selEtiqueta) {
        selEtiqueta.value = limpia;
        selEtiqueta.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
  }
}

function initLecturas() {
onValue(ref(db, "subidosIglesia"), (s) => {
   subidosCargados = true;
  const data = s.val() || {};
  subidosItems = Object.entries(data)
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .sort((a, b) => {
      const fa = a.fechaEvento || "";
      const fb = b.fechaEvento || "";
      if (fa !== fb) return fb.localeCompare(fa);
      return (b.fecha || 0) - (a.fecha || 0);
    });

  refrescarSubidos();

  // ✅ intentar abrir desde hash una vez que ya existen los datos
  setTimeout(subidosAbrirDesdeHash, 0);
});

  onValue(ref(db, "subidosEtiquetas"), (s) => {
    const data = s.val();
    subidosEtiquetas = Array.isArray(data) ? data : [...ETIQUETAS_DEFAULT];
    poblarEtiquetas();
    refrescarSubidos();
  });

  onValue(ref(db, "hermanos"), (s) => {
  const data = s.val() || {};

  subidosHermanosCumples = Object.entries(data)
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .filter(h => subidosCumpleValor(h));

  refrescarSubidos();
});

const esperarAuth = () => {
  const uidPrevio = subidosUID;
  const adminPrevio = subidosEsAdmin;

  subidosUID = window.__UID || null;
  subidosEsAdmin = !!window.__ES_ADMIN;

  const btnNuevo = document.getElementById("btnSubidoNuevo");
  if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";

  if (uidPrevio !== subidosUID || adminPrevio !== subidosEsAdmin) {
    refrescarSubidos();
  }

  setTimeout(esperarAuth, 1200);
};
esperarAuth();
}

document.addEventListener("DOMContentLoaded", () => {
  initSubidosBotones();
  poblarEtiquetas();
  refrescarSubidos();
  initLecturas();

  setTimeout(subidosAbrirDesdeHash, 600);
});

window.addEventListener("hashchange", () => {
  subidosAbrirDesdeHash();
});

// =========================================================
// BOTONES FIJOS DEL MODAL DE SUBIDOS
// Guardar, Cancelar y estado siempre visibles.
// =========================================================

function subidosAsegurarFooterFijo() {
  const modal =
    document.getElementById("modalSubidos");

  const card =
    modal?.querySelector(".modal-card");

  const btnGuardar =
    document.getElementById(
      "btnGuardarSubido"
    );

  const estado =
    document.getElementById(
      "subidosEstado"
    );

  const filaBotones =
    btnGuardar?.parentElement;

  /*
    En tu HTML:
    - primer hijo de modal-card = encabezado
    - segundo hijo = contenido con scroll
  */
  const cuerpoScroll =
    card?.children?.[1];

  if (
    !modal ||
    !card ||
    !btnGuardar ||
    !filaBotones ||
    !cuerpoScroll
  ) {
    return;
  }

  cuerpoScroll.classList.add(
    "subidos-modal-scroll"
  );

  let footer =
    document.getElementById(
      "subidosFooterFijo"
    );

  if (!footer) {
    footer =
      document.createElement("div");

    footer.id =
      "subidosFooterFijo";

    footer.className =
      "subidos-modal-footer-fijo";

    card.appendChild(footer);
  }

  /*
    Movemos el estado y los botones
    afuera de la zona que hace scroll.
  */
  if (
    estado &&
    estado.parentElement !== footer
  ) {
    footer.appendChild(estado);
  }

  if (
    filaBotones.parentElement !== footer
  ) {
    footer.appendChild(
      filaBotones
    );
  }

  filaBotones.classList.add(
    "subidos-modal-footer-botones"
  );
}

/*
  Lo hacemos inmediatamente y también
  cuando termina de cargar la página.
*/
setTimeout(
  subidosAsegurarFooterFijo,
  0
);

window.addEventListener(
  "load",
  subidosAsegurarFooterFijo
);