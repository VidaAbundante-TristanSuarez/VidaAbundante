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

/* ================= ORACIONES GENERALES DE PUBLICACIONES ================= */
/* Devocionales mantienen su sistema actual; esto es para notas, imágenes,
   ediciones, RH y subidos/prédicas. */

let compartidosOracionesPublicacionesCache = {};
let compartidosOracionesPublicacionesEscuchaActiva = false;

let compOraListaActual = {};
let compOraEdicionActual = {
  key: "",
  id: "",
  data: null
};

let compartidosOcultosCache = {};
let compartidosOcultosEscuchaActiva = false;
let compPromosTimer = null;

let compBaseListo = false;
let compDevocionalesListo = false;
let compSubidosListo = false;
let compCargaInicio = Date.now();
let compTimerCarga = null;

function compEsIOS() {
  const ua = navigator.userAgent || "";

  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

// ✅ En iPhone no pintamos todo el feed junto.
let compItemsVisibles = compEsIOS() ? 8 : 9999;

window.compVerMasPublicaciones = function compVerMasPublicaciones() {
  compItemsVisibles += compEsIOS() ? 8 : 20;
  renderCompartidos();
};

function compOptimizarImagenesFeed() {
  document.querySelectorAll("#compLista img").forEach(img => {
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
  });
}

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
  // ✅ Mientras las 3 fuentes principales no respondieron,
  // seguimos mostrando cargando. Sin límite falso de 12 segundos.
  return !compBaseListo || !compDevocionalesListo || !compSubidosListo;
}

function compProgramarRepintadoCarga() {
  if (compTimerCarga) clearTimeout(compTimerCarga);

  compTimerCarga = setTimeout(() => {
    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  }, 900);
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
      <div class="comp-loading-feed">
        <div class="comp-loading-icon">
          <i class="fa-solid fa-dove"></i>
        </div>

        <div class="comp-loading-title">
          Conectando con Vida Abundante
        </div>

        <div class="comp-loading-text">
          Estamos preparando las publicaciones...
        </div>
      </div>
    `;
    return;
  }

  if (!compartidosIniciado) {
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
  iniciarEscuchaOracionesPublicacionesCompartidos();
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

        // ✅ En iPhone evitamos cargar carrusel/promos arriba del feed.
    // Reduce memoria al entrar desde Safari/WhatsApp.
    if (compEsIOS()) {
      promos.innerHTML = "";
      return;
    }
    
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
}, (err) => {
  compDevocionalesListo = true;
  console.error("Error leyendo devocionales para Compartidos:", err);
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
}, (err) => {
  compSubidosListo = true;
  console.error("Error leyendo subidos para Compartidos:", err);
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

/* =========================================================
   ORACIONES GENERALES PARA PUBLICACIONES DE COMPARTIDOS
   - Devocionales siguen usando su sistema original.
   - Este sistema cubre: nota, imagen, edicion, rh y subido.
========================================================= */

function iniciarEscuchaOracionesPublicacionesCompartidos() {
  if (compartidosOracionesPublicacionesEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "compartidosOracionesPublicas"), (snap) => {
    compartidosOracionesPublicacionesCache = snap.val() || {};
    renderCompartidos();
  }, (err) => {
    console.error("Error leyendo oraciones públicas de publicaciones:", err);
  });

  compartidosOracionesPublicacionesEscuchaActiva = true;
}

function compOraPathPublica(key, id = "") {
  return `compartidosOracionesPublicas/${key}${id ? "/" + id : ""}`;
}

function compOraPathMia(uid, key, id = "") {
  return `compartidosOracionesMias/${uid}/${key}${id ? "/" + id : ""}`;
}

function compOraNotificar(texto) {
  if (typeof window.mostrarToast === "function") {
    window.mostrarToast(texto);
  } else {
    alert(texto);
  }
}

function compOraRequerirLogin() {
  const uid = compUidActual();

  if (uid) return uid;

  if (typeof window.abrirLoginParaGuardarMiPanel === "function") {
    window.abrirLoginParaGuardarMiPanel();
  } else {
    window.location.href = "login.html";
  }

  return "";
}

function compOraUsuarioNombre() {
  const user = window.__FB?.auth?.currentUser;

  return String(
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Hermano/a"
  ).trim();
}

function compOraColorSeguro(color = "#fff4b8") {
  const limpio = String(color || "").trim();

  return /^#[0-9a-f]{6}$/i.test(limpio)
    ? limpio
    : "#fff4b8";
}

function compOraSetColorVisual(color = "#fff4b8") {
  const c = compOraColorSeguro(color);

  const input = document.getElementById("compOraColor");
  if (input) {
    input.value = c;
  }

  const host = document.getElementById("compOraColorHost");
  if (!host) return;

  host.style.setProperty("--pickr-color", c);
  host.style.background = c;
  host.style.backgroundColor = c;

  try {
    if (host._pickr && typeof host._pickr.setColor === "function") {
      host._pickr.setColor(c, true);
    }
  } catch (_) {}
}

function compOraBuscarItem(key) {
  return compUnificarItems().find(item => compKeyItem(item) === key) || null;
}

function compOraTituloItem(item = {}) {
  if (item.tipo === "nota") {
    return String(item.titulo || item.title || "Nota compartida").trim();
  }

  if (item.tipo === "imagen") {
    return String(compTituloImagen(item) || "Imagen compartida").trim();
  }

  if (item.tipo === "edicion") {
    return String(item.titulo || "Edición compartida").trim();
  }

  if (item.tipo === "subido") {
    return String(compItemTitulo(item) || "Publicación compartida").trim();
  }

  if (item.tipo === "rh") {
    return String(item.titulo || "Recurso compartido").trim();
  }

  return "Publicación compartida";
}

function compOraFecha(ts) {
  if (!ts) return "";

  try {
    return new Date(Number(ts)).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function compOraAsegurarModales() {
  if (!document.getElementById("compOraModal")) {
    const modal = document.createElement("div");
    modal.id = "compOraModal";
    modal.className = "comp-ora-overlay";

    modal.innerHTML = `
      <div class="comp-ora-card">
        <button
          type="button"
          class="comp-ora-close"
          onclick="compCerrarModalOracionPublicacion()"
          aria-label="Cerrar"
        >✕</button>

        <h3 id="compOraModalTitulo">🙏 Dejar oración</h3>

        <textarea
          id="compOraTexto"
          class="comp-ora-textarea"
          placeholder="Escribí tu oración o comentario..."
        ></textarea>

        <div class="comp-ora-controls">
<label class="comp-ora-color-label">
  <span>Color</span>

  <input id="compOraColor" type="hidden" value="#fff4b8">

  <button
    type="button"
    id="compOraColorHost"
    class="pickr-host"
    data-target="#compOraColor"
    aria-label="Color oración"
    title="Color oración"
  ></button>
</label>

          <label class="comp-ora-publica-label">
            <input id="compOraPublica" type="checkbox" checked>
            <span>Mostrar públicamente</span>
          </label>
        </div>

        <div class="comp-ora-actions-modal">
          <button
            type="button"
            class="btn-primary"
            onclick="compGuardarOracionPublicacion()"
          >
            Guardar
          </button>

          <button
            type="button"
            class="btn-primary"
            onclick="compCerrarModalOracionPublicacion()"
          >
            Cancelar
          </button>
        </div>
      </div>
    `;

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        window.compCerrarModalOracionPublicacion();
      }
    });

    document.body.appendChild(modal);

    setTimeout(() => {
  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#compOraColorHost");
  }

  compOraSetColorVisual("#fff4b8");
}, 0);
  }

  if (!document.getElementById("compOraListaModal")) {
    const modalLista = document.createElement("div");
    modalLista.id = "compOraListaModal";
    modalLista.className = "comp-ora-overlay";

    modalLista.innerHTML = `
      <div class="comp-ora-card comp-ora-card--lista">
        <button
          type="button"
          class="comp-ora-close"
          onclick="compCerrarListaOracionesPublicacion()"
          aria-label="Cerrar"
        >✕</button>

        <h3>🙏 Oraciones</h3>

        <div id="compOraListaContenido" class="comp-ora-lista-contenido">
          <div class="comp-ora-vacio">Cargando...</div>
        </div>
      </div>
    `;

    modalLista.addEventListener("click", (e) => {
      if (e.target === modalLista) {
        window.compCerrarListaOracionesPublicacion();
      }
    });

    document.body.appendChild(modalLista);
  }
}

function compOraAbrirModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.style.display = "flex";
  modal.classList.add("abierto");
  document.body.classList.add("modal-open");
}

function compOraCerrarModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  try {
    document.activeElement?.blur?.();
  } catch (_) {}

  modal.style.display = "none";
  modal.classList.remove("abierto");

  if (!document.querySelector(".comp-ora-overlay.abierto")) {
    document.body.classList.remove("modal-open");
  }
}

window.compCerrarModalOracionPublicacion = function compCerrarModalOracionPublicacion() {
  compOraEdicionActual = {
    key: "",
    id: "",
    data: null
  };

  compOraCerrarModal("compOraModal");
};

window.compCerrarListaOracionesPublicacion = function compCerrarListaOracionesPublicacion() {
  compOraListaActual = {};
  compOraCerrarModal("compOraListaModal");
};

window.compAbrirModalOracionPublicacion = function compAbrirModalOracionPublicacion(key) {
  const uid = compOraRequerirLogin();
  if (!uid) return;

  const item = compOraBuscarItem(key);
  if (!item) {
    alert("No encontré esa publicación.");
    return;
  }

  compOraAsegurarModales();

  compOraEdicionActual = {
    key,
    id: "",
    data: null
  };

  const titulo = document.getElementById("compOraModalTitulo");
  const texto = document.getElementById("compOraTexto");
  const color = document.getElementById("compOraColor");
  const publica = document.getElementById("compOraPublica");

  if (titulo) {
    titulo.textContent = `🙏 ${compOraTituloItem(item)}`;
  }

  if (texto) texto.value = "";
 compOraSetColorVisual("#fff4b8");
  if (publica) publica.checked = true;

  compOraAbrirModal("compOraModal");

  setTimeout(() => texto?.focus(), 80);
};

window.compGuardarOracionPublicacion = async function compGuardarOracionPublicacion() {
  const db = compDB();
  const uid = compOraRequerirLogin();

  if (!db || !uid) return;

  const key = String(compOraEdicionActual.key || "").trim();
  const item = compOraBuscarItem(key);

  if (!key || !item) {
    alert("No encontré esa publicación.");
    return;
  }

  const texto = String(document.getElementById("compOraTexto")?.value || "").trim();
  const color = compOraColorSeguro(document.getElementById("compOraColor")?.value);
  const publica = !!document.getElementById("compOraPublica")?.checked;

  if (!texto) {
    alert("Escribí una oración antes de guardar.");
    return;
  }

  const anterior = compOraEdicionActual.data || {};
  const ahora = Date.now();

  const id = compOraEdicionActual.id || `${ahora}_${uid.slice(0, 8)}`;

  const data = {
    ...anterior,
    texto,
    color,
    publica,
    autorUid: uid,
    autorNombre: anterior.autorNombre || compOraUsuarioNombre(),
    creadoEn: Number(anterior.creadoEn || ahora),
    editadoEn: compOraEdicionActual.id ? ahora : 0,

    publicacionKey: key,
    publicacionTipo: item.tipo || "",
    publicacionTitulo: compOraTituloItem(item)
  };

  try {
    await set(ref(db, compOraPathMia(uid, key, id)), data);

    if (publica) {
      await set(ref(db, compOraPathPublica(key, id)), data);
    } else {
      await remove(ref(db, compOraPathPublica(key, id))).catch(() => {});
    }

    window.compCerrarModalOracionPublicacion();

    compOraNotificar(
      publica
        ? "🙏 Oración publicada"
        : "🙏 Oración guardada solo para vos"
    );

    renderCompartidos();

  } catch (e) {
    console.error("No pude guardar oración de publicación:", e);
    alert("No pude guardar la oración.\n\nDetalle: " + (e?.message || e));
  }
};

async function compOraLeerPropias(key) {
  const uid = compUidActual();
  const getFn = window.__FB_API?.get;
  const db = compDB();

  if (!uid || !db || typeof getFn !== "function") return {};

  try {
    const snap = await getFn(ref(db, compOraPathMia(uid, key)));
    return snap.val() || {};
  } catch (e) {
    console.warn("No pude leer oraciones propias de esta publicación:", e);
    return {};
  }
}

window.compAbrirListaOracionesPublicacion = async function compAbrirListaOracionesPublicacion(key) {
  compOraAsegurarModales();
  compOraAbrirModal("compOraListaModal");

  const box = document.getElementById("compOraListaContenido");
  if (!box) return;

  box.innerHTML = `<div class="comp-ora-vacio">Cargando...</div>`;

  const uid = compUidActual();
  const publicas = compartidosOracionesPublicacionesCache?.[key] || {};
  const propias = await compOraLeerPropias(key);

  const combinadas = {
    ...publicas,
    ...propias
  };

  const entries = Object.entries(combinadas)
    .filter(([, it]) => it && typeof it === "object")
    .sort((a, b) => Number(b[1]?.creadoEn || 0) - Number(a[1]?.creadoEn || 0));

  if (!entries.length) {
    box.innerHTML = `
      <div class="comp-ora-vacio">
        Todavía no hay oraciones visibles en esta publicación.
      </div>
    `;
    return;
  }

  compOraListaActual = {};

  box.innerHTML = entries.map(([id, it]) => {
const esMia = !!uid && String(it.autorUid || "") === String(uid);
const puedeEditar = esMia;
const color = compOraColorSeguro(it.color);
const privada = it.publica === false;
const autor = esMia ? "Tú" : "Hermano/a";

    compOraListaActual[`${key}__${id}`] = it;

    return `
      <div class="comp-ora-item" style="background:${compEscape(color)};">
        <div class="comp-ora-item-head">
          <strong>${compEscape(autor)}</strong>
          <span>
            ${privada ? "Privada · " : ""}
            ${compEscape(compOraFecha(it.creadoEn))}
          </span>
        </div>

        <div class="comp-ora-item-texto">${compEscape(it.texto || "")}</div>

        ${puedeEditar ? `
          <div class="comp-ora-item-actions">
            <button
  type="button"
  class="btn-primary"
  onclick="compEditarOracionPublicacion('${compJs(key)}', '${compJs(id)}')"
  title="Editar oración"
  aria-label="Editar oración"
>
  <i class="fa-solid fa-pen"></i>
</button>

<button
  type="button"
  class="btn-primary comp-ora-danger"
  onclick="compBorrarOracionPublicacion('${compJs(key)}', '${compJs(id)}')"
  title="Borrar oración"
  aria-label="Borrar oración"
>
  <i class="fa-solid fa-trash"></i>
</button>
          </div>
        ` : ``}
      </div>
    `;
  }).join("");
};

window.compEditarOracionPublicacion = function compEditarOracionPublicacion(key, id) {
  const uid = compOraRequerirLogin();
  if (!uid) return;

  const data = compartidosOracionesPublicacionesCache?.[key]?.[id] || null;

  if (!data) {
    alert("No encontré esa oración.");
    return;
  }

  if (String(data.autorUid || "") !== String(uid)) {
    alert("Solo podés editar tus propias oraciones.");
    return;
  }

  const item = compOraBuscarItem(key);

  if (!item) {
    alert("No encontré esa publicación.");
    return;
  }

  compOraAsegurarModales();

  compOraEdicionActual = {
    key,
    id,
    data
  };

  const titulo = document.getElementById("compOraModalTitulo");
  const texto = document.getElementById("compOraTexto");
  const color = document.getElementById("compOraColor");
  const publica = document.getElementById("compOraPublica");

  if (titulo) {
    titulo.textContent = "🙏 Editar oración";
  }

  if (texto) texto.value = data.texto || "";
  compOraSetColorVisual(data.color);
  if (publica) publica.checked = data.publica !== false;

  compOraAbrirModal("compOraModal");

  setTimeout(() => texto?.focus(), 80);
};

window.compBorrarOracionPublicacion = async function compBorrarOracionPublicacion(key, id) {
  const uid = compOraRequerirLogin();
  const db = compDB();

  if (!uid || !db) return;

  const data = compartidosOracionesPublicacionesCache?.[key]?.[id] || null;

  if (!data) {
    alert("No encontré esa oración.");
    return;
  }

  const esMia = String(data.autorUid || "") === String(uid);
  const admin = compEsAdmin();

  if (!esMia && !admin) {
    alert("Solo podés borrar tus propias oraciones.");
    return;
  }

  if (!confirm("¿Borrar esta oración?")) return;

  const autorUid = String(data.autorUid || "");

  try {
    const tareas = [
      remove(ref(db, compOraPathPublica(key, id)))
    ];

    // ✅ También borra la copia personal del autor real.
    if (autorUid) {
      tareas.push(
        remove(ref(db, compOraPathMia(autorUid, key, id))).catch(() => {})
      );
    }

    await Promise.all(tareas);

    compOraNotificar("🗑 Oración borrada");
    renderCompartidos();

  } catch (e) {
    console.error("No pude borrar oración:", e);
    alert("No pude borrar la oración.");
  }
};

function compCantidadOracionesPublicacion(item = {}) {
  if (!item || item.tipo === "devocional") return 0;

  const key = compKeyItem(item);
  return Object.keys(compartidosOracionesPublicacionesCache?.[key] || {}).length;
}

function compAccionesOracionPublicacion(item = {}) {
  // ✅ Devocionales conservan su sistema actual.
  if (!item || item.tipo === "devocional") return "";

  const key = compKeyItem(item);

  return `
    <button
      class="btn-primary"
      type="button"
      onclick="compAbrirModalOracionPublicacion('${compJs(key)}')"
      aria-label="Dejar oración"
      title="Dejar oración"
    >
      🙏
    </button>
  `;
}

function compRenderOracionesPublicacionHTML(item = {}) {
  // ✅ Los devocionales ya tienen su propio render directo de oraciones.
  if (!item || item.tipo === "devocional") return "";

  const key = compKeyItem(item);
  const uidActual = String(compUidActual() || "");
  const admin = compEsAdmin();

  const lista = Object.entries(
    compartidosOracionesPublicacionesCache?.[key] || {}
  )
    .filter(([, it]) =>
      it &&
      typeof it === "object" &&
      it.publica !== false
    )
    .sort((a, b) =>
      Number(b[1]?.creadoEn || 0) - Number(a[1]?.creadoEn || 0)
    );

  if (!lista.length) return "";

  return `
    <div class="comp-dev-oraciones-wrap">
      <div class="comp-dev-oraciones-titulo">🙏 Oraciones</div>

      <div class="comp-dev-oraciones-lista">
        ${lista.map(([id, it]) => {
          const fondo = compOraColorSeguro(it.color || "#fff4b8");

          const colorTexto = typeof compColorContraste === "function"
            ? compColorContraste(fondo)
            : "#000000";

          const esMia = !!uidActual &&
            String(it.autorUid || "") === uidActual;

          // ✅ Nunca mostramos nombre real de la cuenta
          const autor = esMia ? "Tú" : "Hermano/a";

          const fechaTxt = it.creadoEn
            ? new Date(Number(it.creadoEn)).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit"
              })
            : "";

          const puedeEditar = esMia;
          const puedeBorrar = esMia || admin;

          return `
            <div
              class="comp-dev-oracion"
              style="background:${compEscape(fondo)}; color:${compEscape(colorTexto)};"
            >
              <div class="comp-dev-oracion-top">
                <span>${compEscape(autor)}</span>
                <span>${compEscape(fechaTxt)}</span>
              </div>

              <div class="comp-dev-oracion-texto">${compEscape(it.texto || "")}</div>

              ${(puedeEditar || puedeBorrar) ? `
                <div class="comp-dev-oracion-actions">

                  ${puedeEditar ? `
                    <button
                      type="button"
                      onclick="compEditarOracionPublicacion('${compJs(key)}', '${compJs(id)}')"
                      title="Editar oración"
                      aria-label="Editar oración"
                    >
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  ` : ``}

                  ${puedeBorrar ? `
                    <button
                      type="button"
                      class="comp-dev-oracion-delete"
                      onclick="compBorrarOracionPublicacion('${compJs(key)}', '${compJs(id)}')"
                      title="Borrar oración"
                      aria-label="Borrar oración"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ``}

                </div>
              ` : ``}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

/*
  ✅ Agrega los botones a la fila de acciones que la publicación ya tiene.
  Así no hay que reescribir una por una nota, imagen, edición, RH y prédica.
*/
function compAgregarOracionesAPublicacionHTML(html = "", item = {}) {
  if (!html || !item || item.tipo === "devocional") return html;

  const botones = compAccionesOracionPublicacion(item);
  const oraciones = compRenderOracionesPublicacionHTML(item);

  let salida = String(html);

  if (salida.includes('<div class="comp-post-actions')) {
    salida = salida.replace(
      /<div class="comp-post-actions([^"]*)">/,
      `<div class="comp-post-actions$1">${botones}`
    );
  } else if (salida.includes('<div class="devBigActions">')) {
    salida = salida.replace(
      '<div class="devBigActions">',
      `<div class="devBigActions">${botones}`
    );
  } else {
    salida = salida.replace(
      /<\/article>\s*$/,
      `<div class="comp-post-actions">${botones}</div></article>`
    );
  }

  if (oraciones) {
    salida = salida.replace(
      /<\/article>\s*$/,
      `${oraciones}</article>`
    );
  }

  return salida;
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

function compOwnerUid(item = {}) {
  return String(
    item.publicadoPor ||
    item.uid ||
    item.uidOwner ||
    item.ownerUid ||
    item.sourceUid ||
    ""
  );
}

function compEsPropia(item = {}) {
  const uidActual = String(compUidActual() || "");
  return !!uidActual && compOwnerUid(item) === uidActual;
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
  // ✅ En Compartidos NO mostramos contadores.
  // Los contadores quedan solo en Recursos > Ediciones.
  return `
    <button
      type="button"
      class="${saved ? "comp-action-saved" : ""}"
      onclick="${onclick}"
      title="${compEscape(title)}"
    >
      <span class="comp-action-wrap">
        <i class="${icon}"></i>
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
  if (typeof window.abrirLoginParaGuardarMiPanel === "function") {
    window.abrirLoginParaGuardarMiPanel();
  } else {
    window.location.href = "login.html";
  }
  return;
}

  const item = compUnificarItems().find(x => x.tipo === "imagen" && compImagenKey(x) === key);

  if (!item) {
    alert("No encontré esa imagen.");
    return;
  }

  if (compEsPropia(item)) {
    if (typeof mostrarToast === "function") {
      mostrarToast("Esta imagen ya es tuya y ya está en Mi Panel.");
    }
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
  if (typeof window.abrirLoginParaGuardarMiPanel === "function") {
    window.abrirLoginParaGuardarMiPanel();
  } else {
    window.location.href = "login.html";
  }
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

  const guardarBtn = compEsPropia(item) ? "" : `
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

function compFechaHoraNota(item = {}) {
  const ts = compTs(item);
  if (!ts) return "";

  try {
    return new Date(ts).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function compDatosImagenNota(item = {}) {
  const titulo = String(item.titulo || item.title || "Nota").trim() || "Nota";
  const texto = String(item.texto || item.nota || item.textoLibre || "").trim();

  const versiculo = compTextoVersiculoNota(item, texto, titulo);
  const referencia = compReferenciaItem(item) || "Nota";
  const fecha = compFechaHoraNota(item);

  return {
    titulo,
    referencia,
    meta: [referencia, fecha].filter(Boolean).join(" · "),
    versiculo,
    texto,
    fondo: compNotaFondo(item)
  };
}

function compBuscarNotaPorKey(key) {
  return compUnificarItems().find(item =>
    item.tipo === "nota" &&
    compKeyItem(item) === key
  );
}

window.compCompartirNotaComoImagen = async function compCompartirNotaComoImagen(key, boton = null) {
  const item = compBuscarNotaPorKey(key);

  if (!item) {
    alert("No encontré esa nota.");
    return;
  }

  if (typeof window.notaCompartirComoImagen !== "function") {
    alert("Todavía no está listo el generador de imagen de notas.");
    return;
  }

  await window.notaCompartirComoImagen(
    compDatosImagenNota(item),
    `compartidos_${key}`,
    boton
  );
};

window.compDescargarNotaComoImagen = async function compDescargarNotaComoImagen(key, boton = null) {
  const item = compBuscarNotaPorKey(key);

  if (!item) {
    alert("No encontré esa nota.");
    return;
  }

  if (typeof window.notaDescargarComoImagen !== "function") {
    alert("Todavía no está listo el generador de imagen de notas.");
    return;
  }

  await window.notaDescargarComoImagen(
    compDatosImagenNota(item),
    `compartidos_${key}`,
    boton
  );
};

window.compGuardarNotaCompartidaEnMiPanel = async function compGuardarNotaCompartidaEnMiPanel(key, boton = null) {
  const db = compDB();
  const uid = compUidActual();

  if (!db || !uid) {
    if (typeof window.abrirLoginParaGuardarMiPanel === "function") {
      window.abrirLoginParaGuardarMiPanel();
    } else {
      window.location.href = "login.html";
    }
    return;
  }

  const item = compBuscarNotaPorKey(key);

  if (!item) {
    alert("No encontré esa nota.");
    return;
  }

  if (compEsPropia(item)) {
    if (typeof mostrarToast === "function") {
      mostrarToast("Esta nota ya es tuya y ya está en Mi Panel.");
    }
    return;
  }

  if (boton?.classList.contains("guardado")) {
    if (typeof mostrarToast === "function") {
      mostrarToast("✅ Esta nota ya está guardada en Mi Panel");
    }
    return;
  }

  const datos = compDatosImagenNota(item);

  const id = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : String(Date.now());

  try {
    if (boton) boton.disabled = true;

    // ✅ Las notas de Mi Panel salen de marcadores/{uid},
    // no de panelImagenesPersonal.
    await set(ref(db, `marcadores/${uid}/${id}`), {
      titulo: datos.titulo,
      nota: datos.texto,
      color: datos.fondo,
      destacada: true,
      keep: false,

      libro: item.libro || "",
      capitulo: Number(item.capitulo || 0),
      versiculos: Array.isArray(item.versiculos) ? item.versiculos : [],
      ref: datos.referencia || "",
      textoVersiculo: datos.versiculo || "",

      origen: item.origen === "abc" ? "abc" : "compartidos",
      abcTexto: item.abcTexto || datos.versiculo || "",

      fecha: Date.now(),
      sourceUid: compOwnerUid(item),
      sourceCompKey: key
    });

    if (boton) {
      boton.innerHTML = `<i class="fa-solid fa-heart-circle-check"></i>`;
      boton.classList.add("guardado", "activo");
      boton.title = "Guardada en Mi Panel";
      boton.setAttribute("aria-label", "Guardada en Mi Panel");
    }

    if (typeof mostrarToast === "function") {
      mostrarToast("💙 Nota guardada en Mi Panel");
    }

  } catch (e) {
    console.error(e);
    alert("No pude guardar la nota en Mi Panel.");

  } finally {
    if (boton) boton.disabled = false;
  }
};

function compPrepararImagenNotaCompartida(key) {
  const item = compBuscarNotaPorKey(key);

  if (!item) return;
  if (typeof window.notaPrepararComoImagen !== "function") return;

  const datos = compDatosImagenNota(item);

  window.notaPrepararComoImagen(datos, `compartidos_${key}`)
    .catch(e => console.warn("No pude precargar la nota compartida:", e));
}

let compNotasShareObserver = null;

function compObservarNotasParaCompartir() {
  const cards = document.querySelectorAll(
    "#compLista .comp-post--nota[data-comp-nota-key]"
  );

  if (!cards.length) return;

  if (!("IntersectionObserver" in window)) {
    cards.forEach(card => {
      compPrepararImagenNotaCompartida(card.dataset.compNotaKey || "");
    });
    return;
  }

  if (!compNotasShareObserver) {
    compNotasShareObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const card = entry.target;
        const key = card.dataset.compNotaKey || "";

        compPrepararImagenNotaCompartida(key);
        compNotasShareObserver.unobserve(card);
      });
    }, {
      rootMargin: "280px 0px"
    });
  }

  cards.forEach(card => {
    compNotasShareObserver.observe(card);
  });
}

function compRenderNota(item) {
  const tituloRaw = String(item.titulo || item.title || "Nota").trim() || "Nota";
  const titulo = compEscape(tituloRaw);

  const referenciaRaw = compReferenciaItem(item) || "Nota compartida";
  const fechaRaw = compItemFecha(item);
  const metaRaw = [referenciaRaw, fechaRaw].filter(Boolean).join(" · ");
  const meta = compEscape(metaRaw);

  const textoRaw = String(
    item.texto ||
    item.nota ||
    item.textoLibre ||
    ""
  ).trim();

  const texto = compEscape(textoRaw);

  const versoRaw = compTextoVersiculoNota(item, textoRaw, tituloRaw);
  const verso = compEscape(versoRaw);

  const fondo = compNotaFondo(item);

  const colorTexto = typeof compColorContraste === "function"
    ? compColorContraste(fondo)
    : "#000000";

  const key = compKeyItem(item);

  const guardarBtn = compEsPropia(item) ? "" : `
    <button
      class="btn-primary"
      type="button"
      data-comp-nota-save="${compEscape(key)}"
      onclick="compGuardarNotaCompartidaEnMiPanel('${compJs(key)}', this)"
      title="Guardar en Mi Panel"
      aria-label="Guardar en Mi Panel"
    >
      <i class="fa-solid fa-heart-circle-plus"></i>
    </button>
  `;

  return `
    <article
      class="comp-post comp-post--nota"
      data-comp-nota-key="${compEscape(key)}"
      style="
        --comp-nota-fondo:${compEscape(fondo)};
        --comp-nota-texto:${compEscape(colorTexto)};
        background:${compEscape(fondo)};
        color:${compEscape(colorTexto)};
      "
    >
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-comment-dots"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">${meta}</div>
        </div>
      </div>

      <div class="comp-post-nota-contenido">
        ${verso ? `
          <div class="comp-post-verse-block">${verso}</div>
        ` : ``}

        ${texto ? `
          <div class="comp-post-note-block">${texto}</div>
        ` : ``}
      </div>

      <div class="comp-post-actions comp-post-actions--nota">
        <button
          class="btn-primary"
          type="button"
          onclick="compDescargarNotaComoImagen('${compJs(key)}', this)"
          title="Descargar PNG"
          aria-label="Descargar PNG"
        >
          <i class="fa-solid fa-download"></i>
        </button>

        <button
          class="btn-primary"
          type="button"
          onclick="compCompartirNotaComoImagen('${compJs(key)}', this)"
          title="Compartir"
          aria-label="Compartir"
        >
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        ${guardarBtn}
      </div>

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
  const uidOwner = String(item.uidOwner || item.sourceUid || item.ownerUid || item.devocionalUid || "");
  const tsKey = Number(item.tsKey || item.sourceTs || item.devocionalTs || item.fecha || item.ts || 0);

  const oraciones = compDevOracionesVisibles(uidOwner, tsKey);

  if (!oraciones.length) return "";

  const uidActual = String(compUidActual() || "");
  const admin = compEsAdmin();

  return `
    <div class="comp-dev-oraciones-wrap">
      <div class="comp-dev-oraciones-titulo">🙏 Oraciones</div>

      <div class="comp-dev-oraciones-lista">
        ${oraciones.map(o => {
          const fondo = o.color || "#f5f5f5";
          const colorTexto = compColorContraste(fondo);

          const esMia = !!uidActual &&
            String(o.autorUid || "") === uidActual;

          // ✅ Nunca mostramos nombre de cuenta en Compartidos
          const autor = esMia ? "Tú" : "Hermano/a";

          const fechaTxt = o.fecha
            ? new Date(o.fecha).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit"
              })
            : "";

          const oracionId = String(o.id || o.comentId || o.key || "");

          const puedeEditar = !!oracionId && esMia;
          const puedeBorrar = !!oracionId && (esMia || admin);

          return `
            <div
              class="comp-dev-oracion"
              style="background:${compEscape(fondo)}; color:${compEscape(colorTexto)};"
            >
              <div class="comp-dev-oracion-top">
                <span>${compEscape(autor)}</span>
                <span>${compEscape(fechaTxt)}</span>
              </div>

              <div class="comp-dev-oracion-texto">${compEscape(o.texto || "")}</div>

              ${(puedeEditar || puedeBorrar) ? `
                <div class="comp-dev-oracion-actions">

                  ${puedeEditar ? `
                    <button
                      type="button"
                      onclick="devEditarOracionPropia('${compJs(uidOwner)}','${compJs(tsKey)}','${compJs(oracionId)}')"
                      title="Editar oración"
                      aria-label="Editar oración"
                    >
                      <i class="fa-solid fa-pen"></i>
                    </button>
                  ` : ``}

                  ${puedeBorrar ? `
                    <button
                      type="button"
                      class="comp-dev-oracion-delete"
                      onclick="devBorrarOracionPropia('${compJs(uidOwner)}','${compJs(tsKey)}','${compJs(oracionId)}')"
                      title="Borrar oración"
                      aria-label="Borrar oración"
                    >
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  ` : ``}

                </div>
              ` : ``}
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

window.compTogglePredicaCompartidos = function compTogglePredicaCompartidos(subidoId, ev = null) {
  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
  }

  const id = String(subidoId || "");
  const card = document.querySelector(
    `.comp-post--predica-abierta[data-comp-predica-id="${CSS.escape(id)}"]`
  );

  if (!card) return;

  const yaAbierta = card.classList.contains("comp-predica-expandida");

  document
    .querySelectorAll(".comp-post--predica-abierta.comp-predica-expandida")
    .forEach(el => {
      if (el !== card) el.classList.remove("comp-predica-expandida");
    });

  card.classList.toggle("comp-predica-expandida", !yaAbierta);
};

// ✅ Tocando fuera de la prédica, se comprime otra vez.
if (!window.__COMP_PREDICA_COMPRIMIR_CLICK_READY) {
  window.__COMP_PREDICA_COMPRIMIR_CLICK_READY = true;

  document.addEventListener("click", e => {
    if (e.target.closest(".comp-post--predica-abierta")) return;

    document
      .querySelectorAll(".comp-post--predica-abierta.comp-predica-expandida")
      .forEach(el => el.classList.remove("comp-predica-expandida"));
  });
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
    <article
  class="comp-post comp-post--subido comp-post--predica-abierta"
  data-comp-predica-id="${compEscape(subidoId)}"
>
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
  onclick="compTogglePredicaCompartidos('${compJs(subidoId)}', event)"
  title="Tocar para desplegar"
>
  ${predicaHTML || `<div class="comp-post-empty">No pude cargar la prédica.</div>`}
</div>

<button
  type="button"
  class="comp-predica-desplegar"
  onclick="compTogglePredicaCompartidos('${compJs(subidoId)}', event)"
  title="Desplegar prédica"
  aria-label="Desplegar prédica"
>
  <i class="fa-solid fa-arrow-down-short-wide"></i>
</button>

        <div class="comp-post-actions">

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

window.__COMP_ED_MINI_CARGANDO = window.__COMP_ED_MINI_CARGANDO || new Set();

async function compAsegurarEdicionMini(edicionId) {
  if (!edicionId) return;

  const cache = window.__EDICIONES_CACHE || [];
  if (cache.some(x => x?.id === edicionId)) return;

  if (window.__COMP_ED_MINI_CARGANDO.has(edicionId)) return;
  window.__COMP_ED_MINI_CARGANDO.add(edicionId);

  try {
    if (typeof window.obtenerEdicion !== "function") return;

    const ed = await window.obtenerEdicion(edicionId);
    if (!ed) return;

    const actual = window.__EDICIONES_CACHE || [];
    const sinDuplicar = actual.filter(x => x?.id !== edicionId);

    window.__EDICIONES_CACHE = [
      ...sinDuplicar,
      ed
    ];

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }

  } catch (e) {
    console.warn("No pude cargar páginas de la edición para Compartidos:", e);

  } finally {
    window.__COMP_ED_MINI_CARGANDO.delete(edicionId);
  }
}

function compRenderEdicion(item) {
  const titulo = compEscape(item.titulo || "Edición");
  const portada = item.portadaUrl || "";
  const edicionId = item.edicionId;
  const st = compStats(edicionId);
  const guardada = compEstaGuardada(edicionId);
  const descargada = compEstaDescargada(edicionId);

  const miniPaginas =
    typeof window.edMiniPaginasHTML === "function"
      ? window.edMiniPaginasHTML(edicionId, "compartidos")
      : "";

  if (!miniPaginas && edicionId) {
  compAsegurarEdicionMini(edicionId);
}

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

      <div
        class="comp-post-media comp-post-media--edicion-scroll"
        role="region"
        title="Deslizá para ver las imágenes"
      >
        ${
          miniPaginas
            ? miniPaginas
            : (
                portada
                  ? `<img src="${compEscape(portada)}" alt="${titulo}" loading="lazy" onclick="abrirPresentacionEdicion('${compJs(edicionId)}')">`
                  : `<div class="comp-post-empty">Sin portada</div>`
              )
        }
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
          title: descargada ? "PDF descargado" : "Descargar PDF",
          onclick: `descargarEdicionPDF('${compJs(edicionId)}')`,
          icon: descargada ? "fa-solid fa-file-circle-check" : "fa-solid fa-file-pdf",
          count: st.descargas,
          saved: descargada
        })}

${compActionButton({
  title: "Descargar PNG",
  onclick: `descargarEdicionPNGs('${compJs(edicionId)}', this, 'compartidos')`,
  icon: "fa-solid fa-download",
  count: st.descargas,
  saved: descargada
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

  const itemsTodos = compUnificarItems();

  // ✅ iPhone/Safari: pintar por tandas.
  // PC/Android siguen viendo todo como antes.
  const items = compEsIOS()
    ? itemsTodos.slice(0, compItemsVisibles)
    : itemsTodos;

  if (items.length) {
    lista.innerHTML = `
      ${items.map(item => {
        let html = "";

        if (item.tipo === "rh") html = compRenderRH(item);
        if (item.tipo === "edicion") html = compRenderEdicion(item);
        if (item.tipo === "imagen") html = compRenderImagen(item);
        if (item.tipo === "nota") html = compRenderNota(item);
        if (item.tipo === "devocional") html = compRenderDevocional(item);
        if (item.tipo === "subido") html = compRenderSubido(item);

        if (typeof compAgregarOracionesAPublicacionHTML === "function") {
          return compAgregarOracionesAPublicacionHTML(html, item);
        }

        return html;
      }).join("")}

      ${
        compEsIOS() && itemsTodos.length > items.length
          ? `
            <div class="comp-ver-mas-wrap">
              <button
                type="button"
                class="btn-primary"
                onclick="compVerMasPublicaciones()"
              >
                Ver más publicaciones
              </button>
            </div>
          `
          : ``
      }
    `;

    compActivarBotonesSubidosRenderizados(items);

    if (typeof compObservarNotasParaCompartir === "function") {
      compObservarNotasParaCompartir();
    }

compOptimizarImagenesFeed();

if (typeof window.edActivarMiniGalerias === "function") {
  window.edActivarMiniGalerias(lista);
}

return;
  }

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
};

// ✅ Iniciar Compartidos lo antes posible.
// Si Firebase todavía no está listo, mostrarCompartidos espera con compEsperarDB().
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    mostrarCompartidos();
  }, { once: true });
} else {
  mostrarCompartidos();
}
