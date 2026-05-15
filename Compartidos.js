import {
  ref,
  onValue,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= COMPARTIDOS - FEED ================= */

let compartidosIniciado = false;
let compartidosEscuchaActiva = false;
let compartidosStatsEscuchaActiva = false;
let compartidosGuardadosEscuchaActiva = false;
let compartidosGuardadosUid = null;

let compartidosCache = [];
let compartidosStatsCache = {};
let compartidosGuardadosCache = {};

let compartidosDescargadosCache = {};
let compartidosDescargadosEscuchaActiva = false;
let compartidosDescargadosUid = null;

let compartidosDevocionalesCache = [];
let compartidosDevocionalesEscuchaActiva = false;

let compartidosSubidosCache = [];
let compartidosSubidosEscuchaActiva = false;

let compartidosOracionesCache = {};
let compartidosOracionesEscuchaActiva = false;

let compartidosOcultosCache = {};
let compartidosOcultosEscuchaActiva = false;
let compPromosTimer = null;

let compBaseListo = false;
let compDevocionalesListo = false;
let compSubidosListo = false;
let compCargaInicio = Date.now();
let compTimerCarga = null;

const COMP_BANNER_URL = "img/compartidos/banner-horarios.png?v=2026-05-08-2";

const COMP_PROMOS = [
  "img/compartidos/promo-1.png?v=2026-05-08-2",
  "img/compartidos/promo-2.png?v=2026-05-08-2",
  "img/compartidos/promo-3.png?v=2026-05-08-2",
  "img/compartidos/promo-4.png?v=2026-05-08-2",
  "img/compartidos/promo-5.png?v=2026-05-08-2",
  "img/compartidos/promo-6.png?v=2026-05-08-2"
];

function comp$(id) {
  return document.getElementById(id);
}

function compEstaCargandoFeed() {
  const maxEspera = 12000;

  return (
    Date.now() - compCargaInicio < maxEspera &&
    (!compBaseListo || !compDevocionalesListo || !compSubidosListo)
  );
}

function compProgramarRepintadoCarga() {
  if (compTimerCarga) clearTimeout(compTimerCarga);

  if (!compEstaCargandoFeed()) return;

  compTimerCarga = setTimeout(() => {
    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  }, 700);
}

function compLoaderHTML() {
  return `
    <div class="comp-loading-feed">
      <div class="comp-loading-icon">
        <i class="fa-solid fa-dove"></i>
      </div>

      <div class="comp-loading-title">
        Preparando publicaciones
      </div>

      <div class="comp-loading-text">
        Estamos acomodando los devocionales, imágenes y recursos compartidos...
      </div>

      <div class="comp-loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
}

function compDB() {
  return window.__FB?.db || null;
}

function compUidActual() {
  return window.__UID || window.__FB?.auth?.currentUser?.uid || null;
}

function compEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compJs(v) {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}

function compTs(item) {
  return Number(
    item?.ts ||
    item?.publicadoEn ||
    item?.fecha ||
    item?.tsKey ||
    0
  );
}

function compTipoDesdeGrupo(grupo) {
  if (grupo === "imagenes") return "imagen";
  if (grupo === "notas") return "nota";
  if (grupo === "ediciones") return "edicion";
  if (grupo === "rh") return "rh";
  if (grupo === "devocionales") return "devocional";
  if (grupo === "subidos") return "subido";
  return grupo || "publicacion";
}

async function compEsperarDB(intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    if (compDB()) return compDB();
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

async function compBlobDesdeUrl(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("No pude leer el archivo");

  const blob = await r.blob();
  const tipo = blob.type || "application/octet-stream";

  return { blob, tipo };
}

window.compDescargarUrl = async function compDescargarUrl(url, fileName = "imagen.png") {
  try {
    if (!url) return;

    const { blob } = await compBlobDesdeUrl(url);

    const a = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);

    a.href = objectUrl;
    a.download = fileName || "imagen.png";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      a.remove();
    }, 800);

  } catch (e) {
    console.error(e);
    alert("No pude descargar el archivo. Voy a abrirlo para que puedas guardarlo.");
    window.open(url, "_blank");
  }
};

window.compCompartirUrl = async function compCompartirUrl(url, fileName = "imagen.png") {
  try {
    if (!url) return;

    const { blob, tipo } = await compBlobDesdeUrl(url);
    const file = new File([blob], fileName || "imagen.png", { type: tipo });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Vida Abundante"
      });
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: "Vida Abundante",
        url
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("Link copiado.");

  } catch (e) {
    console.error(e);
    alert("No pude compartir el archivo.");
  }
};

function compAsegurarVisor() {
  if (document.getElementById("compMediaViewer")) return;

  const div = document.createElement("div");
  div.id = "compMediaViewer";
  div.className = "comp-media-viewer";
  div.style.display = "none";

  div.innerHTML = `
    <div class="comp-media-viewer-backdrop" onclick="compCerrarMedia()"></div>

    <div class="comp-media-viewer-card">
      <button type="button" class="comp-media-close" onclick="compCerrarMedia()">✕</button>

      <div id="compMediaViewerBody" class="comp-media-viewer-body"></div>

      <div class="comp-media-actions">
        <button type="button" id="compMediaBtnDescargar" title="Descargar">
          <i class="fa-solid fa-download"></i>
        </button>

        <button type="button" id="compMediaBtnCompartir" title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(div);
}

window.compAbrirMedia = function compAbrirMedia(url, tipo = "imagen", titulo = "Archivo") {
  compAsegurarVisor();

  const modal = document.getElementById("compMediaViewer");
  const body = document.getElementById("compMediaViewerBody");
  const btnDescargar = document.getElementById("compMediaBtnDescargar");
  const btnCompartir = document.getElementById("compMediaBtnCompartir");

  if (!modal || !body) return;

  const fileName = compFileName(url, tipo === "video" ? "video.mp4" : "imagen.png");

  if (tipo === "video") {
    body.innerHTML = `
      <video controls playsinline style="width:100%; max-height:78vh; border-radius:16px; background:#000;">
        <source src="${compEscape(url)}">
      </video>
    `;
  } else {
    body.innerHTML = `
      <img src="${compEscape(url)}" alt="${compEscape(titulo)}" style="width:100%; max-height:78vh; object-fit:contain; display:block; border-radius:16px; background:#fff;">
    `;
  }

  if (btnDescargar) {
    btnDescargar.onclick = () => compDescargarUrl(url, fileName);
  }

  if (btnCompartir) {
    btnCompartir.onclick = () => compCompartirUrl(url, fileName);
  }

  modal.style.display = "flex";
};

window.compCerrarMedia = function compCerrarMedia() {
  const modal = document.getElementById("compMediaViewer");
  const body = document.getElementById("compMediaViewerBody");

  if (body) body.innerHTML = "";
  if (modal) modal.style.display = "none";
};

window.mostrarCompartidos = async () => {
  let cont = comp$("compartidosApp");

  if (!cont) {
    const sec = comp$("seccion-compartidos");
    if (!sec) return;

    cont = document.createElement("div");
    cont.id = "compartidosApp";
    sec.appendChild(cont);
  }

  const db = await compEsperarDB();

  if (!db) {
    cont.innerHTML = `
      <div style="padding:20px; text-align:center;">
        Firebase todavía no está listo.
      </div>
    `;
    return;
  }

  if (!compartidosIniciado) {
    cont.innerHTML = `
      cont.innerHTML = `
  <div id="compFeedWrap">
    <div id="compHero"></div>
    <div id="compPromos"></div>
    <div id="compLista">${compLoaderHTML()}</div>
  </div>
`;
    compartidosIniciado = true;
  }

  compAsegurarVisor();
  renderCompartidosTop();

  iniciarEscuchaCompartidos();
  iniciarEscuchaCompartidosStats();
  iniciarEscuchaCompartidosGuardados();
  iniciarEscuchaCompartidosDescargados();
  iniciarEscuchaCompartidosDevocionales();
  iniciarEscuchaCompartidosSubidos();
  iniciarEscuchaCompartidosOraciones();
  iniciarEscuchaCompartidosOcultos();
};

function renderCompartidosTop() {
  const hero = comp$("compHero");
  const promos = comp$("compPromos");

  if (hero) {
    hero.innerHTML = `
      <div class="comp-hero-card">
        <img src="${compEscape(COMP_BANNER_URL)}" alt="Horarios Vida Abundante" loading="lazy">
      </div>
    `;
  }

  if (promos) {
    promos.innerHTML = `
      <div
        class="comp-promos-viewport"
        id="compPromosViewport"
        onpointerdown="compPausarPromos()"
        ontouchstart="compPausarPromos()"
      >
        <div class="comp-promos-slider">
          <div class="comp-promos-page">
            ${COMP_PROMOS.slice(0, 3).map((src, i) => `
              <img
                src="${compEscape(src)}"
                alt="Promo ${i + 1}"
                loading="lazy"
                onclick="compAbrirMedia('${compJs(src)}', 'imagen', 'Promo ${i + 1}')"
              >
            `).join("")}
          </div>

          <div class="comp-promos-page">
            ${COMP_PROMOS.slice(3, 6).map((src, i) => `
              <img
                src="${compEscape(src)}"
                alt="Promo ${i + 4}"
                loading="lazy"
                onclick="compAbrirMedia('${compJs(src)}', 'imagen', 'Promo ${i + 4}')"
              >
            `).join("")}
          </div>
        </div>
      </div>
    `;

    setTimeout(compIniciarPromosAuto, 100);
  }
}

function compIniciarPromosAuto() {
  const vp = document.getElementById("compPromosViewport");
  if (!vp) return;

  if (compPromosTimer) clearInterval(compPromosTimer);

  let segunda = false;

  compPromosTimer = setInterval(() => {
    if (!document.body.classList.contains("en-compartidos")) return;

    segunda = !segunda;

    vp.scrollTo({
      left: segunda ? vp.clientWidth : 0,
      behavior: "smooth"
    });
  }, 9000);
}

window.compPausarPromos = function compPausarPromos() {
  if (compPromosTimer) {
    clearInterval(compPromosTimer);
    compPromosTimer = null;
  }

  setTimeout(compIniciarPromosAuto, 12000);
};

function compFlattenCompartidos(val = {}) {
  const out = [];

  Object.entries(val || {}).forEach(([id, data]) => {
    if (!data || typeof data !== "object") return;

    // ✅ formato viejo: compartidos/{id}
    if (data.tipo) {
      out.push({
        id,
        _compId: id,
        ...data
      });
      return;
    }

    // ✅ formato nuevo: compartidos/imagenes/{id}, compartidos/notas/{id}, etc.
    Object.entries(data || {}).forEach(([subId, item]) => {
      if (!item || typeof item !== "object") return;

      out.push({
        id: `${id}_${subId}`,
        _grupo: id,
        _compId: subId,
        tipo: item.tipo || compTipoDesdeGrupo(id),
        ...item
      });
    });
  });

  return out;
}

function iniciarEscuchaCompartidos() {
  if (compartidosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

onValue(ref(db, "compartidos"), (snap) => {
  compBaseListo = true;

  const val = snap.val() || {};
  compartidosCache = compFlattenCompartidos(val);
  renderCompartidos();
}, (err) => {
  compBaseListo = true;
  console.error("Error leyendo compartidos:", err);
  renderCompartidos();
});
  
    console.error("Error leyendo compartidos:", err);
  });

  compartidosEscuchaActiva = true;
}

function iniciarEscuchaCompartidosStats() {
  if (compartidosStatsEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "edicionesStats"), (snap) => {
    compartidosStatsCache = snap.val() || {};
    window.__EDICIONES_STATS = compartidosStatsCache;
    renderCompartidos();
  });

  compartidosStatsEscuchaActiva = true;
}

function iniciarEscuchaCompartidosGuardados() {
  const uid = compUidActual();

  if (!uid) {
    compartidosGuardadosCache = {};
    compartidosGuardadosUid = null;
    compartidosGuardadosEscuchaActiva = false;
    renderCompartidos();
    return;
  }

  if (compartidosGuardadosEscuchaActiva && compartidosGuardadosUid === uid) return;

  const db = compDB();
  if (!db) return;

  compartidosGuardadosUid = uid;

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    compartidosGuardadosCache = snap.val() || {};
    window.__EDICIONES_GUARDADAS = compartidosGuardadosCache;
    renderCompartidos();
  });

  compartidosGuardadosEscuchaActiva = true;
}

function iniciarEscuchaCompartidosDescargados() {
  const uid = compUidActual();

  if (!uid) {
    compartidosDescargadosCache = {};
    compartidosDescargadosUid = null;
    compartidosDescargadosEscuchaActiva = false;
    renderCompartidos();
    return;
  }

  if (compartidosDescargadosEscuchaActiva && compartidosDescargadosUid === uid) return;

  const db = compDB();
  if (!db) return;

  compartidosDescargadosUid = uid;

  onValue(ref(db, `panelDescargasEdiciones/${uid}`), (snap) => {
    compartidosDescargadosCache = snap.val() || {};
    window.__EDICIONES_DESCARGADAS = compartidosDescargadosCache;
    renderCompartidos();
  });

  compartidosDescargadosEscuchaActiva = true;
}

function iniciarEscuchaCompartidosDevocionales() {
  if (compartidosDevocionalesEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "devocionalesIglesia"), (snap) => {
    compDevocionalesListo = true;
    const val = snap.val() || {};
    const items = [];

    for (const [uid, byTs] of Object.entries(val)) {
      if (!byTs || typeof byTs !== "object") continue;

      for (const [ts, it] of Object.entries(byTs)) {
        if (!it || typeof it !== "object") continue;

        items.push({
          id: `dev_${uid}_${ts}`,
          tipo: "devocional",
          uidOwner: uid,
          tsKey: Number(ts) || 0,
          ...it
        });
      }
    }

    compartidosDevocionalesCache = items;
    renderCompartidos();
  });

  compartidosDevocionalesEscuchaActiva = true;
}

function iniciarEscuchaCompartidosSubidos() {
  if (compartidosSubidosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "subidosIglesia"), (snap) => {
    compSubidosListo = true;
    const val = snap.val() || {};

    compartidosSubidosCache = Object.entries(val)
      .map(([id, it]) => ({
        id: `sub_${id}`,
        tipo: "subido",
        _subidoId: id,
        ...(it || {})
      }));

    renderCompartidos();
  });

  compartidosSubidosEscuchaActiva = true;
}

function iniciarEscuchaCompartidosOraciones() {
  if (compartidosOracionesEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  // ✅ Compartidos solo lee las oraciones públicas.
  // Ruta:
  // devocionalesOracionesPublicas/{uidOwner}/{tsKey}/{oracionId}
  onValue(ref(db, "devocionalesOracionesPublicas"), (snap) => {
    compartidosOracionesCache = snap.val() || {};
    renderCompartidos();
  }, (err) => {
    console.error("Error leyendo oraciones públicas de devocionales:", err);
  });

  compartidosOracionesEscuchaActiva = true;
}

function iniciarEscuchaCompartidosOcultos() {
  if (compartidosOcultosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "compartidosOcultos"), (snap) => {
    compartidosOcultosCache = snap.val() || {};
    renderCompartidos();
  });

  compartidosOcultosEscuchaActiva = true;
}

function compEsAdmin() {
  return !!(
    window.__ES_ADMIN ||
    window.__ADMIN ||
    window.__FB?.auth?.currentUser?.admin
  );
}

function compKeyItem(item) {
  return [
    item?.tipo || "",
    item?.edicionId || "",
    item?._subidoId || "",
    item?.uidOwner || "",
    item?.tsKey || "",
    item?._compId || "",
    item?.url || ""
  ].join("__").replace(/[.#$/\[\]]/g, "_");
}

function compPathCompartido(item) {
  if (item?._grupo && item?._compId) {
    return `compartidos/${item._grupo}/${item._compId}`;
  }

  if (!item?._auto && item?._compId) {
    return `compartidos/${item._compId}`;
  }

  return "";
}

window.compBorrarSoloCompartidos = async function compBorrarSoloCompartidos(key, path = "") {
  const db = compDB();

  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  if (!compEsAdmin()) {
    alert("Solo admin puede borrar de Compartidos.");
    return;
  }

  const ok = confirm("¿Quitar esta publicación solo de Compartidos?");
  if (!ok) return;

  try {
    if (path) {
      await remove(ref(db, path));
    } else {
      await set(ref(db, `compartidosOcultos/${key}`), true);
    }

    alert("Quitado de Compartidos.");

  } catch (e) {
    console.error(e);
    alert("No pude quitarlo de Compartidos.");
  }
};

function compDeleteBtn(item) {
  if (!compEsAdmin()) return "";

  const key = compKeyItem(item);
  const path = compPathCompartido(item);

  return `
    <button
      type="button"
      class="comp-action-delete"
      onclick="compBorrarSoloCompartidos('${compJs(key)}', '${compJs(path)}')"
      title="Quitar solo de Compartidos"
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  `;
}

function compStats(edicionId) {
  const s = compartidosStatsCache?.[edicionId] || window.__EDICIONES_STATS?.[edicionId] || {};
  return {
    guardados: Number(s.guardados || 0),
    descargas: Number(s.descargas || 0),
    compartidos: Number(s.compartidos || 0)
  };
}

function compEstaDescargada(edicionId) {
  const local = localStorage.getItem(`edicion_descargada_${edicionId}`) === "1";

  return !!(
    local ||
    compartidosDescargadosCache?.[edicionId] ||
    window.__EDICIONES_DESCARGADAS?.[edicionId]
  );
}

function compEstaGuardada(edicionId) {
  return !!(
    compartidosGuardadosCache?.[edicionId] ||
    window.__EDICIONES_GUARDADAS?.[edicionId]
  );
}

function compActionButton({ title, onclick, icon, count = 0, saved = false }) {
  return `
    <button
      type="button"
      class="${saved ? "comp-action-saved" : ""}"
      onclick="${onclick}"
      title="${compEscape(title)}"
    >
      <span class="comp-action-wrap">
        <i class="${icon}"></i>
        <span class="comp-action-count">${Number(count || 0)}</span>
      </span>
    </button>
  `;
}

function compFileName(url, fallback = "archivo.png") {
  try {
    const limpio = String(url || "").split("?")[0];
    const nombre = limpio.split("/").pop() || fallback;
    return nombre;
  } catch {
    return fallback;
  }
}

function compEsVideoUrl(url = "", mime = "") {
  const u = String(url || "").toLowerCase();
  const m = String(mime || "").toLowerCase();

  return (
    m.startsWith("video/") ||
    u.endsWith(".mp4") ||
    u.endsWith(".webm") ||
    u.endsWith(".mov")
  );
}

function compEsImageUrl(url = "", mime = "") {
  const u = String(url || "").toLowerCase();
  const m = String(mime || "").toLowerCase();

  return (
    m.startsWith("image/") ||
    u.endsWith(".png") ||
    u.endsWith(".jpg") ||
    u.endsWith(".jpeg") ||
    u.endsWith(".webp")
  );
}

function compItemTitulo(item) {
  return String(
    item?.titulo ||
    item?.title ||
    item?.cita ||
    item?.descripcion ||
    item?.etiqueta ||
    "Compartido"
  );
}

function compItemFecha(item) {
  const ts = compTs(item);
  if (!ts) return "";

  try {
    return new Date(ts).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit"
    });
  } catch {
    return "";
  }
}

function compRegistrarDevocionalParaAcciones(item = {}) {
  const uidOwner = String(item.uidOwner || "");
  const tsKey = Number(item.tsKey || item.fecha || item.ts || 0);

  const id = String(
    item.id ||
    (uidOwner && tsKey ? `dev_${uidOwner}_${tsKey}` : "")
  ).trim();

  const normalizado = {
    ...item,
    id,
    uidOwner,
    tsKey,
    fecha: Number(item.fecha || tsKey || Date.now()),
    url: item.url || item.imagenUrl || "",
    audioGithubUrl: item.audioGithubUrl || item.audioUrl || "",
    texto: item.texto || item.textoLibre || "",
    cita: item.cita || "",
    versiculo: item.versiculo || ""
  };

  window.__DEV_ITEMS_PUBLICADOS = Array.isArray(window.__DEV_ITEMS_PUBLICADOS)
    ? window.__DEV_ITEMS_PUBLICADOS
    : [];

  if (id) {
    const idx = window.__DEV_ITEMS_PUBLICADOS.findIndex(x => String(x.id) === id);

    if (idx >= 0) {
      window.__DEV_ITEMS_PUBLICADOS[idx] = normalizado;
    } else {
      window.__DEV_ITEMS_PUBLICADOS.push(normalizado);
    }
  }

  return normalizado;
}

function compBuscarReferenciaEnTexto(txt = "") {
  const s = String(txt || "").trim();
  if (!s) return "";

  const m = s.match(/\b(?:[1-3]\s*)?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){0,3}\s+\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–]\s*\d{1,3})?\b/);

  return m ? m[0].replace(/\s+/g, " ").trim() : "";
}

function compDevOracionesVisibles(uidOwner, tsKey) {
  const uid = compUidActual();
  const raw = compartidosOracionesCache?.[uidOwner]?.[tsKey] || {};
  const entries = Object.entries(raw || {});

  return entries
    .map(([id, it]) => ({ id, ...(it || {}) }))
    .filter(it => it.publica === true || (uid && it.autorUid === uid))
    .sort((a, b) => Number(b.fecha || 0) - Number(a.fecha || 0));
}

function compNormalizarEtiqueta(txt = "") {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function compEsPredica(item) {
  const et = compNormalizarEtiqueta(item?.etiqueta || "");
  const citas = Array.isArray(item?.predicaCitas) ? item.predicaCitas : [];

  return et === "predica" && (
    citas.length ||
    String(item?.predicaIntroduccion || item?.introduccionPredica || "").trim() ||
    String(item?.predicaNotaFinal || item?.notaFinalGeneral || "").trim()
  );
}

function compRangoVersiculos(nums = []) {
  const arr = Array.from(new Set(
    (nums || []).map(Number).filter(n => Number.isFinite(n))
  )).sort((a, b) => a - b);

  if (!arr.length) return "";

  const partes = [];
  let inicio = arr[0];
  let anterior = arr[0];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === anterior + 1) {
      anterior = arr[i];
    } else {
      partes.push(inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`);
      inicio = anterior = arr[i];
    }
  }

  partes.push(inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`);
  return partes.join(",");
}

function compReferenciaItem(item = {}) {
  const directo = String(
    item.ref ||
    item.referencia ||
    item.cita ||
    item.versiculoRef ||
    item.refCompleta ||
    item.referenciaBiblica ||
    ""
  ).trim();

  if (directo && directo.toLowerCase() !== "compartido") return directo;

  const libro = String(item.libro || "").trim();
  const capitulo = Number(item.capitulo || 0);
  const versiculos = Array.isArray(item.versiculos) ? item.versiculos : [];

  if (libro && capitulo && versiculos.length) {
    return `${libro} ${capitulo}:${compRangoVersiculos(versiculos)}`;
  }

  if (libro && capitulo) {
    return `${libro} ${capitulo}`;
  }

  const desdeTexto = compBuscarReferenciaEnTexto([
    item.titulo,
    item.title,
    item.descripcion,
    item.textoLibre,
    item.texto,
    item.fileName,
    item.nombre
  ].filter(Boolean).join(" "));

  if (desdeTexto) return desdeTexto;

  return "";
}

function compTituloImagen(item = {}) {
  return compReferenciaItem(item) || "Compartido";
}

function compTituloNota(item = {}) {
  return compReferenciaItem(item) || String(item.titulo || item.title || "Nota").trim();
}

function compNotaFondo(item = {}) {
  return String(
    item.color ||
    item.fondo ||
    item.fondoColor ||
    item.highlightColor ||
    item.resaltadoColor ||
    item.colorNota ||
    "#fff4b8"
  ).trim();
}

function compImagenKey(item = {}) {
  return compKeyItem(item);
}

function compDevKey(item = {}) {
  return [
    item.uidOwner || "",
    item.tsKey || "",
    item.url || item.imagenUrl || ""
  ].join("__").replace(/[.#$/\[\]]/g, "_");
}

window.compGuardarImagenCompartidaEnMiPanel = async function compGuardarImagenCompartidaEnMiPanel(key) {
  const db = compDB();
  const uid = compUidActual();

  if (!db || !uid) {
    alert("Tenés que estar logueado.");
    return;
  }

  const item = compUnificarItems().find(x => x.tipo === "imagen" && compImagenKey(x) === key);

  if (!item) {
    alert("No encontré esa imagen.");
    return;
  }

  const ts = Date.now();
  const url = item.url || item.imagenUrl || "";

  try {
await set(ref(db, `panelImagenesPersonal/${uid}/${ts}`), {
  url,
  fecha: ts,
  uid,
  tipo: "imagen",
  libro: item.libro || "",
  capitulo: Number(item.capitulo || 0),
  versiculos: Array.isArray(item.versiculos) ? item.versiculos : [],
  ref: compReferenciaItem(item),
  origen: "compartidos",
  tipoTexto: item.tipoTexto || "biblia",
  textoLibre: item.textoLibre || item.texto || "",

  audioOk: !!(item.audioOk || item.audioGithubUrl || item.audioUrl || item.audio),
  audioGithubUrl: item.audioGithubUrl || item.audioUrl || item.audio || "",
  audioUrl: item.audioUrl || item.audioGithubUrl || item.audio || ""
});

    document.querySelectorAll("[data-comp-img-save]").forEach(btn => {
      if (btn.dataset.compImgSave === key) {
        btn.innerHTML = `<i class="fa-solid fa-heart-circle-check"></i>`;
        btn.classList.add("guardado", "activo");
        btn.title = "Guardado en Mi Panel";
      }
    });

    if (typeof mostrarToast === "function") mostrarToast("💙 Guardado en Mi Panel");
    else alert("Guardado en Mi Panel.");

  } catch (e) {
    console.error(e);
    alert("No pude guardar la imagen en Mi Panel.");
  }
};

window.compGuardarDevocionalCompartidoEnMiPanel = async function compGuardarDevocionalCompartidoEnMiPanel(key) {
  const db = compDB();
  const uid = compUidActual();

  if (!db || !uid) {
    alert("Tenés que estar logueado.");
    return;
  }

  const item = compUnificarItems().find(x => x.tipo === "devocional" && compDevKey(x) === key);

  if (!item) {
    alert("No encontré ese devocional.");
    return;
  }

  const ts = Date.now();
  const url = item.url || item.imagenUrl || "";

  try {
    await set(ref(db, `panelImagenesPersonal/${uid}/${ts}`), {
      url,
      fecha: ts,
      origen: "devocional_publicado",
      tipoTexto: "devocional",
      textoLibre: item.texto || item.textoLibre || "",
      audioOk: !!(item.audioOk || item.audioGithubUrl || item.audioUrl),
      audioGithubUrl: item.audioGithubUrl || item.audioUrl || "",
      cita: item.cita || "",
      versiculo: item.versiculo || "",
      devocionalKey: key,
      sourceUid: item.uidOwner || "",
      sourceTs: item.tsKey || 0
    });

    document.querySelectorAll("[data-comp-dev-save]").forEach(btn => {
      if (btn.dataset.compDevSave === key) {
        btn.innerHTML = `<i class="fa-solid fa-heart-circle-check"></i>`;
        btn.classList.add("guardado", "activo");
        btn.title = "Guardado en Mi Panel";
      }
    });

    if (typeof mostrarToast === "function") mostrarToast("💙 Guardado en Mi Panel");
    else alert("Guardado en Mi Panel.");

  } catch (e) {
    console.error(e);
    alert("No pude guardar el devocional en Mi Panel.");
  }
};

function compRenderImagen(item) {
  const url = item.url || item.imagenUrl || "";
  const tituloBase = compTituloImagen(item);
  const titulo = compEscape(tituloBase);
  const textoLibre = String(item.textoLibre || "").trim();
  const key = compImagenKey(item);

  const guardarBtn = `
    <button
      class="btn-primary"
      type="button"
      data-comp-img-save="${compEscape(key)}"
      onclick="compGuardarImagenCompartidaEnMiPanel('${compJs(key)}')"
      aria-label="Guardar en Mi Panel"
      title="Guardar en Mi Panel"
    >
      <i class="fa-solid fa-heart-circle-plus"></i>
    </button>
  `;

  if (typeof window.panelImagenRenderCardHTML !== "function") {
    return `
      <article class="comp-post comp-post--imagen">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="fa-solid fa-image"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">Imagen compartida</div>
          </div>
        </div>

        <div class="comp-post-media" onclick="compAbrirMedia('${compJs(url)}', 'imagen', '${compJs(tituloBase)}')" role="button">
          ${url
            ? `<img src="${compEscape(url)}" alt="${titulo}" loading="lazy">`
            : `<div class="comp-post-empty">Sin imagen</div>`
          }
        </div>

        ${textoLibre ? `<div class="comp-post-note-text">${compEscape(textoLibre)}</div>` : ``}

        <div class="comp-post-actions">
          <button type="button" onclick="descargarImagenPanel('${compJs(url)}')" title="Descargar">
            <i class="fa-solid fa-download"></i>
          </button>

          <button type="button" onclick="compartirImagenPanel('${compJs(url)}')" title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          ${guardarBtn}
        </div>

        ${compDeleteBtn(item)}
      </article>
    `;
  }

  const card = window.panelImagenRenderCardHTML(
    {
      ...item,
      id: item.id || item._compId || compKeyItem(item),
      url,
      audioGithubUrl: item.audioGithubUrl || item.audioUrl || item.audio || "",
      audioUrl: item.audioUrl || item.audioGithubUrl || item.audio || "",
      audioOk: !!(item.audioOk || item.audioGithubUrl || item.audioUrl || item.audio)
    },
    {
      idPrefix: "compImg_",
      mostrarDescargar: true,
      mostrarCompartir: true,
      mostrarEliminar: false,

      // ✅ guardar queda en la misma línea que descargar/compartir
      extraAcciones: guardarBtn
    }
  );

  return `
    <article class="comp-post comp-post--imagen comp-post--reutilizada">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-image"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Imagen compartida</div>
        </div>
      </div>

      <div
        class="comp-card-click-wrap"
        onclick="if(event.target.closest('button,audio,video,input,textarea,select')) return; compAbrirMedia('${compJs(url)}', 'imagen', '${compJs(tituloBase)}')"
      >
        ${card}
      </div>

      ${textoLibre ? `<div class="comp-post-note-text">${compEscape(textoLibre)}</div>` : ``}

      ${compDeleteBtn(item)}
    </article>
  `;
}

function compNormalizarLibroNombre(txt = "") {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compPrimerTextoValido(...vals) {
  for (const v of vals) {
    if (Array.isArray(v)) {
      const txt = v
        .map(x => typeof x === "object" ? (x?.texto || x?.text || x?.versiculo || "") : x)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (txt) return txt;
      continue;
    }

    if (v && typeof v === "object") {
      const txt = Object.values(v)
        .map(x => typeof x === "object" ? (x?.texto || x?.text || x?.versiculo || "") : x)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (txt) return txt;
      continue;
    }

    const txt = String(v || "").trim();
    if (txt) return txt;
  }

  return "";
}

function compBuscarLibroEnBiblia(data, libro) {
  if (!data || !libro) return null;

  const objetivo = compNormalizarLibroNombre(libro);

  if (!Array.isArray(data) && typeof data === "object") {
    if (data[libro]) return data[libro];

    for (const [k, v] of Object.entries(data)) {
      if (compNormalizarLibroNombre(k) === objetivo) return v;
      if (v && typeof v === "object") {
        const nom = v.nombre || v.libro || v.name || v.book || v.abbrev || v.abreviatura || "";
        if (compNormalizarLibroNombre(nom) === objetivo) return v;
      }
    }
  }

  if (Array.isArray(data)) {
    return data.find(v => {
      const nom = v?.nombre || v?.libro || v?.name || v?.book || v?.abbrev || v?.abreviatura || "";
      return compNormalizarLibroNombre(nom) === objetivo;
    }) || null;
  }

  return null;
}

function compBuscarCapituloEnLibro(libroData, capitulo) {
  const cap = Number(capitulo || 0);
  if (!libroData || !cap) return null;

  if (Array.isArray(libroData)) return libroData[cap - 1] || libroData[cap] || null;

  if (typeof libroData === "object") {
    return (
      libroData[cap] ||
      libroData[String(cap)] ||
      libroData.capitulos?.[cap - 1] ||
      libroData.capitulos?.[cap] ||
      libroData.chapters?.[cap - 1] ||
      libroData.chapters?.[cap] ||
      null
    );
  }

  return null;
}

function compBuscarVersiculoEnCapitulo(capData, num) {
  const n = Number(num || 0);
  if (!capData || !n) return "";

  let v = "";

  if (Array.isArray(capData)) {
    v = capData[n - 1] || capData[n] || "";
  } else if (typeof capData === "object") {
    v = (
      capData[n] ||
      capData[String(n)] ||
      capData.versiculos?.[n - 1] ||
      capData.versiculos?.[n] ||
      capData.verses?.[n - 1] ||
      capData.verses?.[n] ||
      ""
    );
  }

  if (v && typeof v === "object") {
    return String(v.texto || v.text || v.versiculo || v.v || "").trim();
  }

  return String(v || "").trim();
}

function compTextoBiblicoDesdeGlobales(item = {}) {
  const libro = String(item.libro || item.book || "").trim();
  const capitulo = Number(item.capitulo || item.chapter || 0);
  const versiculos = Array.isArray(item.versiculos)
    ? item.versiculos
    : (item.versiculoNumero ? [item.versiculoNumero] : []);

  if (!libro || !capitulo || !versiculos.length) return "";

  const fuentes = [
    window.BIBLIA_RV1960,
    window.bibliaRV1960,
    window.__BIBLIA_RV1960__,
    window.BIBLIA?.RV1960,
    window.bibliaData?.RV1960,
    window.BIBLIA_NTV,
    window.bibliaNTV,
    window.__BIBLIA_NTV__,
    window.BIBLIA?.NTV,
    window.bibliaData?.NTV,
    window.bibliaData,
    window.biblia
  ].filter(Boolean);

  for (const fuente of fuentes) {
    const libroData = compBuscarLibroEnBiblia(fuente, libro);
    const capData = compBuscarCapituloEnLibro(libroData, capitulo);
    const textos = versiculos
      .map(n => {
        const txt = compBuscarVersiculoEnCapitulo(capData, n);
        return txt ? `${Number(n)}. ${txt}` : "";
      })
      .filter(Boolean);

    if (textos.length) return textos.join(" ");
  }

  return "";
}

function compTextoVersiculoNota(item = {}, textoNota = "", titulo = "") {
  const directo = compPrimerTextoValido(
    item.textoVersiculo,
    item.versiculoTexto,
    item.textoBiblico,
    item.textoBiblia,
    item.textoSeleccionado,
    item.textoOriginal,
    item.versiculosTexto,
    item.fragmentoBiblico,
    item.contenidoBiblico,
    item.versiculoCompleto
  );

  const desdeGlobales = directo || compTextoBiblicoDesdeGlobales(item);
  const limpio = String(desdeGlobales || "").trim();

  if (!limpio) return "";
  if (limpio === String(textoNota || "").trim()) return "";
  if (limpio === String(titulo || "").trim()) return "";

  return limpio;
}

function compRenderNota(item) {
  const tituloBase = compTituloNota(item);
  const titulo = compEscape(tituloBase);
  const textoRaw = String(item.texto || item.nota || item.textoLibre || "").trim();
  const texto = compEscape(textoRaw);
  const versoRaw = compTextoVersiculoNota(item, textoRaw, tituloBase);
  const verso = compEscape(versoRaw);
  const fondo = compNotaFondo(item);
  const colorTexto = typeof compColorContraste === "function"
    ? compColorContraste(fondo)
    : "#000";

  return `
    <article class="comp-post comp-post--nota">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-comment-dots"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Nota compartida</div>
        </div>
      </div>

      ${verso ? `<div class="comp-post-verse-block">${verso}</div>` : ``}

      <div
        class="comp-post-note-block"
        style="background:${compEscape(fondo)}; color:${compEscape(colorTexto)};"
      >${texto}</div>

      ${compDeleteBtn(item)}
    </article>
  `;
}

function compColorContraste(hex = "#ffffff") {
  let h = String(hex || "#ffffff").trim();

  if (h.startsWith("rgb")) {
    const nums = h.match(/\d+/g)?.map(Number) || [255, 255, 255];
    const lum = 0.299 * nums[0] + 0.587 * nums[1] + 0.114 * nums[2];
    return lum > 160 ? "#000000" : "#ffffff";
  }

  h = h.replace("#", "");

  if (h.length === 3) {
    h = h.split("").map(x => x + x).join("");
  }

  const r = parseInt(h.slice(0, 2), 16) || 255;
  const g = parseInt(h.slice(2, 4), 16) || 255;
  const b = parseInt(h.slice(4, 6), 16) || 255;

  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#000000" : "#ffffff";
}

function compRenderOracionesDevocionalHTML(item) {
  const oraciones = compDevOracionesVisibles(item.uidOwner, item.tsKey);

  if (!oraciones.length) return "";

  return `
    <div class="comp-dev-oraciones-wrap">
      <div class="comp-dev-oraciones-titulo">🙏 Oraciones</div>

      <div class="comp-dev-oraciones-lista">
        ${oraciones.map(o => {
          const fondo = o.color || "#f5f5f5";
          const colorTexto = compColorContraste(fondo);
          const autor = (compUidActual() && o.autorUid === compUidActual()) ? "Tú" : "Anónimo";
          const fechaTxt = o.fecha
            ? new Date(o.fecha).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit"
              })
            : "";

          return `
            <div class="comp-dev-oracion" style="background:${compEscape(fondo)}; color:${colorTexto};">
              <div class="comp-dev-oracion-top">
                <span>${compEscape(autor)}</span>
                <span>${compEscape(fechaTxt)}</span>
              </div>

              <div class="comp-dev-oracion-texto">${compEscape(o.texto || "")}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function compCapitalizarReferenciaBiblica(txt = "") {
  const s = String(txt || "")
    .replace(/\s+/g, " ")
    .trim();

  return s.replace(
    /^((?:[1-3]\s*)?[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,4})(\s+\d{1,3}\s*:\s*\d{1,3}.*)$/i,
    (_, libro, resto) => {
      const limpio = libro.toLocaleLowerCase("es-AR");
      const libroOk = limpio.replace(/^([1-3]\s*)?([a-záéíóúñ])/, (m, num = "", letra) => {
        return num + letra.toLocaleUpperCase("es-AR");
      });

      return libroOk + resto;
    }
  );
}

function compTituloDevocional(item = {}) {
  return compCapitalizarReferenciaBiblica(compItemTitulo(item));
}

function compRenderDevocional(item) {
  const titulo = compEscape(compTituloDevocional(item));
  const fecha = compEscape(compItemFecha(item));
  const url = item.url || item.imagenUrl || "";
  const fileName = compFileName(url, "devocional.png");
  const key = compDevKey(item);

  const oracionesHTML = compRenderOracionesDevocionalHTML(item);

  const guardarBtn = `
    <button
      class="btn-primary"
      type="button"
      data-comp-dev-save="${compEscape(key)}"
      onclick="compGuardarDevocionalCompartidoEnMiPanel('${compJs(key)}')"
      aria-label="Guardar en Mi Panel"
      title="Guardar en Mi Panel"
    >
      <i class="fa-solid fa-heart-circle-plus"></i>
    </button>
  `;

  if (typeof window.devRenderDevocionalCardHTML !== "function") {
    return `
      <article class="comp-post comp-post--devocional">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="fa-solid fa-book-bible"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">Devocional${fecha ? " · " + fecha : ""}</div>
          </div>
        </div>

        <div class="comp-post-media" onclick="compAbrirMedia('${compJs(url)}', 'imagen')" role="button">
          ${url
            ? `<img src="${compEscape(url)}" alt="${titulo}" loading="lazy">`
            : `<div class="comp-post-empty">Sin imagen</div>`
          }
        </div>

        <div class="comp-post-actions">
          <button type="button"
            onclick="devAbrirModalOracion('${compJs(item.uidOwner || "")}', ${Number(item.tsKey || 0)})"
            title="Dejar oración">
            <i class="fa-solid fa-hands-praying"></i>
          </button>

          ${guardarBtn}

          <button type="button"
            onclick="devCompartirImagenItem('${compJs(url)}', '${compJs(fileName)}')"
            title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          <button type="button"
            onclick="devDescargarImagenItem('${compJs(url)}', '${compJs(fileName)}')"
            title="Descargar">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>

        ${oracionesHTML}
        ${compDeleteBtn(item)}
      </article>
    `;
  }

  const card = window.devRenderDevocionalCardHTML(item, {
    idPrefix: "compDev_",
    mostrarBorrar: false,
    mostrarOracion: true,
    mostrarListaOraciones: false,

    // ✅ apagamos el guardar interno de devocionales.js
    // porque ese buscaba en __DEV_ITEMS_PUBLICADOS y daba “No encontré ese devocional”
    mostrarGuardar: false,

    mostrarCompartir: true,
    mostrarDescargar: true,

    // ✅ agregamos el guardar propio de Compartidos dentro de la misma línea de acciones
    extraAcciones: guardarBtn
  });

  return `
    <article class="comp-post comp-post--devocional comp-post--reutilizada">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-book-bible"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Devocional${fecha ? " · " + fecha : ""}</div>
        </div>
      </div>

      <div class="comp-card-click-wrap">
        ${card}
      </div>

      ${oracionesHTML}
      ${compDeleteBtn(item)}
    </article>
  `;
}

function compActivarBotonesSubidosRenderizados(items = []) {
  items
    .filter(it => it?.tipo === "subido")
    .forEach(it => {
      const id = String(it._subidoId || it.id || "").trim();
      if (!id) return;

      document
        .querySelectorAll(`[data-subidos-download="${CSS.escape(id)}"], [data-subidos-share="${CSS.escape(id)}"]`)
        .forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = "";
          btn.style.cursor = "";
          btn.title = btn.dataset.subidosDownload ? "Descargar" : "Compartir";
        });
    });
}

function compRenderSubido(item) {
  const subidoId = String(item._subidoId || item.id || "").replace(/^sub_/, "");
  const titulo = compEscape(compItemTitulo(item));
  const url = item.url || "";
  const esPredica = compEsPredica(item);
  const esVideo = compEsVideoUrl(url, item.mimeType || "");
  const esImagen = compEsImageUrl(url, item.mimeType || "");

  if (esPredica && typeof window.subidosRenderPredicaAbiertaHTML === "function") {
    const predicaHTML = window.subidosRenderPredicaAbiertaHTML(
      {
        ...item,
        id: subidoId
      },
      "all"
    );

    return `
      <article class="comp-post comp-post--subido comp-post--predica-abierta">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="fa-solid fa-microphone-lines"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">Prédica · ${compEscape(item.fechaEvento || compItemFecha(item) || "")}</div>
          </div>
        </div>

        <div
          class="comp-predica-abierta-wrap"
          onclick="if(event.target.closest('button,audio,video,input,textarea,select')) return; abrirSubidosVisorPredica('${compJs(subidoId)}', 'all')"
        >
          ${predicaHTML || `<div class="comp-post-empty">No pude cargar la prédica.</div>`}
        </div>

        <div class="comp-post-actions">
          <button type="button" onclick="abrirSubidosVisorPredica('${compJs(subidoId)}', 'all')" title="Abrir prédica">
            <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
          </button>

          <button type="button" onclick="compartirSubido('${compJs(subidoId)}', this)" title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          <button type="button" onclick="descargarSubido('${compJs(subidoId)}', this)" title="Descargar">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>

        ${compDeleteBtn(item)}
      </article>
    `;
  }

  if (!esPredica && typeof window.subidosRenderArchivoAbiertoHTML === "function") {
    const archivoHTML = window.subidosRenderArchivoAbiertoHTML(
      {
        ...item,
        id: subidoId
      },
      0
    );

    return `
      <article class="comp-post comp-post--subido comp-post--archivo-abierto">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">Subido · ${compEscape(item.etiqueta || "Subido")}</div>
          </div>
        </div>

        <div class="comp-archivo-abierta-wrap">
          ${archivoHTML || `<div class="comp-post-empty">No pude cargar el archivo.</div>`}
        </div>

        <div class="comp-post-actions">
          <button type="button" onclick="abrirSubidosVisorArchivo('${compJs(subidoId)}', 0)" title="Abrir archivo">
            <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
          </button>

          <button type="button" onclick="compartirSubido('${compJs(subidoId)}')" title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          <button type="button" onclick="descargarSubido('${compJs(subidoId)}')" title="Descargar">
            <i class="fa-solid fa-download"></i>
          </button>
        </div>

        ${compDeleteBtn(item)}
      </article>
    `;
  }
  
  if (typeof window.subidosRenderCardHTML === "function") {
    const card = window.subidosRenderCardHTML(
      {
        ...item,
        id: subidoId
      },
      {
        idPrefix: "compSubido_",
        mostrarEditar: false,
        mostrarBorrarOriginal: false,
        mostrarAccionesArchivo: true,
        borrarHtml: ""
      }
    );

    return `
      <article class="comp-post comp-post--subido comp-post--reutilizada">
        ${card}
        ${compDeleteBtn(item)}
      </article>
    `;
  }

  return `
    <article class="comp-post comp-post--subido">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Subido · ${compEscape(item.etiqueta || "Subido")}</div>
        </div>
      </div>

      ${
        esImagen
          ? `
            <div class="comp-post-media" onclick="compAbrirMedia('${compJs(url)}', 'imagen')" role="button">
              <img src="${compEscape(url)}" alt="${titulo}" loading="lazy">
            </div>
          `
          : esVideo
            ? `
              <div class="comp-post-video" onclick="compAbrirMedia('${compJs(url)}', 'video')" role="button">
                <video preload="metadata" muted playsinline>
                  <source src="${compEscape(url)}">
                </video>
              </div>
            `
            : `
              <div class="comp-post-file" onclick="abrirSubidosVisorArchivo('${compJs(subidoId)}')" role="button">
                <i class="fa-solid fa-file-arrow-down"></i>
                <span>Abrir archivo</span>
              </div>
            `
      }

      <div class="comp-post-actions">
        <button type="button" onclick="compartirSubido('${compJs(subidoId)}')" title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button" onclick="descargarSubido('${compJs(subidoId)}')" title="Descargar">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>

      ${compDeleteBtn(item)}
    </article>
  `;
}

function compRenderRH(item) {
  const titulo = compEscape(item.titulo || "Compartido");

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-shield-heart"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Recurso RH compartido</div>
        </div>
      </div>

      <div class="comp-post-rh" onclick="abrirRHCompartido(${Number(item.temaIndex || 0)})" role="button">
        <i class="fa-solid fa-file-lines"></i>
        <span>Abrir recurso</span>
      </div>

      <div class="comp-post-actions">
        <button type="button" onclick="guardarRHEnMiPanel(${Number(item.temaIndex || 0)})" title="Guardar en Mi Panel">
          <i class="fa-solid fa-heart-circle-plus"></i>
        </button>

        <button type="button" onclick="descargarRHPDF(${Number(item.temaIndex || 0)})" title="Descargar PDF">
          <i class="fa-solid fa-file-pdf"></i>
        </button>

        ${compDeleteBtn(item)}
      </div>
    </article>
  `;
}

function compRenderEdicion(item) {
  const titulo = compEscape(item.titulo || "Compartido");
  const portada = item.portadaUrl || "";
  const edicionId = item.edicionId;
  const st = compStats(edicionId);
  const guardada = compEstaGuardada(edicionId);

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-icons"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Edición compartida</div>
        </div>
      </div>

      <div class="comp-post-media" onclick="abrirPresentacionEdicion('${compJs(edicionId)}')" role="button" title="Abrir edición">
        ${portada ? `<img src="${compEscape(portada)}" alt="${titulo}" loading="lazy">` : `<div class="comp-post-empty">Sin portada</div>`}
      </div>

      <div class="comp-post-actions">
        ${compActionButton({
          title: guardada ? "Guardado en Mi Panel" : "Guardar en Mi Panel",
          onclick: `guardarEdicionEnMiPanel('${compJs(edicionId)}')`,
          icon: guardada ? "fa-solid fa-heart-circle-check" : "fa-solid fa-heart-circle-plus",
          count: st.guardados,
          saved: guardada
        })}

        ${compActionButton({
          title: compEstaDescargada(edicionId) ? "PDF descargado" : "Descargar PDF",
          onclick: `descargarEdicionPDF('${compJs(edicionId)}')`,
          icon: compEstaDescargada(edicionId) ? "fa-solid fa-file-circle-check" : "fa-solid fa-file-pdf",
          count: st.descargas,
          saved: compEstaDescargada(edicionId)
        })}

        ${compActionButton({
          title: "Compartir",
          onclick: `compartirEdicion('${compJs(edicionId)}', 'redes')`,
          icon: "fa-solid fa-share-nodes",
          count: st.compartidos
        })}

        ${compDeleteBtn(item)}
      </div>
    </article>
  `;
}

function compUnificarItems() {
  const todos = [
    ...(compartidosCache || []),
    ...(compartidosDevocionalesCache || []).map(x => ({ ...x, _auto: "devocional" })),
    ...(compartidosSubidosCache || []).map(x => ({ ...x, _auto: "subido" }))
  ];

  const vistos = new Set();

  return todos
    .filter(item => ["edicion", "rh", "imagen", "nota", "devocional", "subido"].includes(item?.tipo || ""))
    .filter(item => !compartidosOcultosCache?.[compKeyItem(item)])
    .filter(item => {
      const key = [
        item.tipo,
        item.edicionId,
        item._subidoId,
        item.uidOwner,
        item.tsKey,
        item._compId,
        item.url
      ].join("|");

      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    })
    .sort((a, b) => compTs(b) - compTs(a));
}

window.renderCompartidos = function renderCompartidos() {
  const lista = comp$("compLista");
  if (!lista) return;

  const items = compUnificarItems();

if (!items.length) {
  if (compEstaCargandoFeed()) {
    lista.innerHTML = compLoaderHTML();
    compProgramarRepintadoCarga();
    return;
  }

  lista.innerHTML = `
    <div id="compVacio">
      Todavía no hay publicaciones compartidas.
    </div>
  `;
  return;
}

  lista.innerHTML = items.map(item => {
    if (item.tipo === "rh") return compRenderRH(item);
    if (item.tipo === "edicion") return compRenderEdicion(item);
    if (item.tipo === "imagen") return compRenderImagen(item);
    if (item.tipo === "nota") return compRenderNota(item);
    if (item.tipo === "devocional") return compRenderDevocional(item);
    if (item.tipo === "subido") return compRenderSubido(item);
    return "";
  }).join("");

  // ✅ Subidos genera botones preparados para su feed.
  // En Compartidos los activamos después de renderizar.
  compActivarBotonesSubidosRenderizados(items);
};

setTimeout(() => {
  mostrarCompartidos();
}, 1200);
