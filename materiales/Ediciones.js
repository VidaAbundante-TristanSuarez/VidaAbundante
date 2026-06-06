import {
  ref,
  set,
  remove,
  onValue,
  get,
  push,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= EDICIONES - MÓDULO =================
   - Recursos > Ediciones administra.
   - Compartidos abre la misma presentación.
   - Firebase RTDB guarda solo datos/URLs.
   - Archivos pesados van a R2.
========================================================= */

// ✅ SIN FIREBASE FUNCTIONS: Ediciones usa Cloudflare Worker + R2
const R2_WORKER_URL_EDICIONES = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

const R2_UPLOAD_URL_EDICIONES = R2_WORKER_URL_EDICIONES;
const R2_VIDEO_UPLOAD_URL_EDICIONES = R2_WORKER_URL_EDICIONES;
const R2_PROXY_URL_EDICIONES = R2_WORKER_URL_EDICIONES;

let edicionesIniciado = false;
let edicionesEscuchaActiva = false;
let edicionesCache = [];
let edicionEditId = null;

let edicionesStatsCache = {};
let edicionesStatsEscuchaActiva = false;

let edicionesGuardadasCache = {};
let edicionesGuardadasUid = null;
let edicionesGuardadasEscuchaActiva = false;

let edicionesDescargadasCache = {};
let edicionesDescargadasUid = null;
let edicionesDescargadasEscuchaActiva = false;

let edicionesPublicadasCache = {};
let edicionesPublicadasEscuchaActiva = false;

let edFiltroFlyers = true;
let edFiltroLibros = true;
let edBusquedaTexto = "";
let edBuscadorAbierto = false;

function edEsLinkDirectoPublico() {
  try {
    const params = new URLSearchParams(location.search);
    const path = String(location.pathname || "").toLowerCase();

    return (
      !!params.get("edicionRef") ||
      (params.get("ver") === "edicion" && !!params.get("id")) ||
      (path.includes("/ediciones/") && !!params.get("ref"))
    );
  } catch (_) {
    return false;
  }
}

// ✅ Oculta la app apenas carga el archivo, antes de abrir el visor.
// Así no aparece Compartidos ni Recursos “de paseo”.
if (edEsLinkDirectoPublico()) {
  document.body.classList.add("ed-link-directo");
}

function ed$(id) {
  return document.getElementById(id);
}

function edDB() {
  return window.__FB?.db || null;
}

function edEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function edValor(v) {
  return String(v ?? "").trim();
}

function edNormalizarTexto(txt = "") {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function edActualizarControlesEdiciones() {
  const btnFlyers = ed$("edFiltroFlyersBtn");
  const btnLibros = ed$("edFiltroLibrosBtn");
  const boxBuscar = ed$("edBuscadorBox");
  const inputBuscar = ed$("edBuscarInput");

  if (btnFlyers) {
    btnFlyers.classList.toggle("ed-filter-active", edFiltroFlyers);
  }

  if (btnLibros) {
    btnLibros.classList.toggle("ed-filter-active", edFiltroLibros);
  }

  if (boxBuscar) {
    boxBuscar.style.display = edBuscadorAbierto ? "block" : "none";
  }

  if (inputBuscar && inputBuscar.value !== edBusquedaTexto) {
    inputBuscar.value = edBusquedaTexto;
  }
}

window.edToggleFiltroEdicion = (tipo) => {
  if (tipo === "flyers") {
    edFiltroFlyers = !edFiltroFlyers;
  }

  if (tipo === "libros") {
    edFiltroLibros = !edFiltroLibros;
  }

  // Evita que queden los 2 apagados y la galería parezca vacía por error.
  if (!edFiltroFlyers && !edFiltroLibros) {
    edFiltroFlyers = true;
    edFiltroLibros = true;
  }

  renderEdiciones();
};

window.edToggleBuscadorEdiciones = () => {
  edBuscadorAbierto = !edBuscadorAbierto;
  edActualizarControlesEdiciones();

  if (edBuscadorAbierto) {
    setTimeout(() => {
      const input = ed$("edBuscarInput");
      if (input) input.focus();
    }, 50);
  }
};

window.edBuscarEdiciones = (valor = "") => {
  edBusquedaTexto = String(valor || "");
  renderEdiciones();
};

window.edLimpiarBusquedaEdiciones = () => {
  edBusquedaTexto = "";
  const input = ed$("edBuscarInput");
  if (input) input.value = "";
  renderEdiciones();
};

/* ================= FLECHAS GALERÍA EDICIONES - PC ================= */

function edActualizarFlechasGaleria() {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  const wrap = track.closest(".ed-galeria-wrap");
  if (!wrap) return;

  const btnPrev = wrap.querySelector(".ed-galeria-prev");
  const btnNext = wrap.querySelector(".ed-galeria-next");

  if (!btnPrev || !btnNext) return;

  const hayScroll = track.scrollWidth > track.clientWidth + 8;
  const estaAlInicio = track.scrollLeft <= 4;
  const estaAlFinal =
    track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

  btnPrev.classList.toggle(
    "ed-galeria-nav-oculta",
    !hayScroll || estaAlInicio
  );

  btnNext.classList.toggle(
    "ed-galeria-nav-oculta",
    !hayScroll || estaAlFinal
  );
}

window.edMoverGaleria = (direccion = 1) => {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  const card = track.querySelector(".ed-card-galeria");

  const distancia = card
    ? card.getBoundingClientRect().width + 16
    : Math.max(track.clientWidth * 0.85, 280);

  track.scrollBy({
    left: distancia * Number(direccion || 1),
    behavior: "smooth"
  });

  setTimeout(edActualizarFlechasGaleria, 350);
};

function edActivarFlechasGaleria() {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  if (track.dataset.flechasActivas !== "1") {
    track.dataset.flechasActivas = "1";

    track.addEventListener("scroll", edActualizarFlechasGaleria, {
      passive: true
    });
  }

  if (!window.__ED_GALERIA_RESIZE_ACTIVO) {
    window.__ED_GALERIA_RESIZE_ACTIVO = true;
    window.addEventListener("resize", edActualizarFlechasGaleria);
  }

  requestAnimationFrame(edActualizarFlechasGaleria);
}

function edNormalizarRama(v = "") {
  const s = String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (s === "libro" || s === "libros") return "libros";
  return "flyers";
}

function edRamaEdicion(edicion = {}) {
  return edNormalizarRama(
    edicion.rama ||
    edicion.categoria ||
    edicion.tipoEdicion ||
    "flyers"
  );
}

function edTituloRama(rama = "") {
  return edNormalizarRama(rama) === "libros" ? "Libros" : "Flyers";
}

function edKey(prefix = "p") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function edSafeName(name = "archivo") {
  return String(name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function edSlugTituloPublico(txt = "edicion") {
  return String(txt || "edicion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "edicion";
}

function edBasePublicaApp() {
  const partes = location.pathname.split("/").filter(Boolean);

  // En GitHub Pages del repo queda /VidaAbundante
  if (partes[0] && partes[0].toLowerCase() === "vidaabundante") {
    return `${location.origin}/${partes[0]}`;
  }

  // En dominio propio o raíz
  return location.origin;
}

async function edCrearRefPublicaUnica(titulo, edicionId) {
  const db = edDB();
  if (!db) throw new Error("Firebase no está listo.");

  const base = edSlugTituloPublico(titulo);

  for (let n = 1; n <= 200; n++) {
    const refPublica = `${base}-${n}`;
    const snap = await get(ref(db, `edicionesRefs/${refPublica}`));
    const val = snap.val();

    const usadoPor =
      typeof val === "string"
        ? val
        : val?.edicionId || "";

    if (!usadoPor || usadoPor === edicionId) {
      return refPublica;
    }
  }

  return `${base}-${Date.now()}`;
}

async function edAsegurarRefPublica(edicionId, titulo) {
  const db = edDB();
  if (!db) throw new Error("Firebase no está listo.");

  const ed = await obtenerEdicion(edicionId);
  const refExistente = String(ed?.refPublica || "").trim();

  if (refExistente) {
    return refExistente;
  }

  const refPublica = await edCrearRefPublicaUnica(titulo, edicionId);

  await set(ref(db, `ediciones/${edicionId}/refPublica`), refPublica);

  await set(ref(db, `edicionesRefs/${refPublica}`), {
    edicionId,
    titulo: titulo || "Edición",
    ts: Date.now()
  });

  return refPublica;
}

function edMediaUrlPagina(p = {}) {
  return String(p.mediaUrl || p.videoUrl || p.imagenUrl || "").trim();
}

function edMediaTypePagina(p = {}) {
  const tipo = String(p.mediaType || p.mimeType || "").trim();

  if (tipo) return tipo;
  if (p.videoUrl) return "video/mp4";
  if (p.imagenUrl) return "image/*";

  return "";
}

function edPaginaEsVideo(p = {}) {
  return (
    edMediaTypePagina(p).startsWith("video/") ||
    !!p.videoUrl
  );
}

function edPortadaEdicion(edicion) {
  const primeraImagen = edPaginasArray(edicion)
    .find(p => !edPaginaEsVideo(p));

  return (
    edicion?.portadaUrl ||
    primeraImagen?.imagenUrl ||
    primeraImagen?.mediaUrl ||
    ""
  );
}

function edPaginasArray(edicion) {
  const pags = edicion?.paginas || {};

  const arr = Array.isArray(pags)
    ? pags.map((p, i) => ({ id: p.id || `p_${i}`, ...(p || {}) }))
    : Object.entries(pags).map(([id, p]) => ({ id, ...(p || {}) }));

  return arr
    .filter(p => p && edMediaUrlPagina(p))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

function edTieneAudio(edicion) {
  return edPaginasArray(edicion).some(p => p.audioEsUrl || p.audioEnUrl);
}

function edSetEstado(txt) {
  const el = ed$("edEstado");
  if (el) el.textContent = txt || "";
}

async function edEsperarDB(intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    if (edDB()) return edDB();
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

/* ================= PANTALLA RECURSOS > EDICIONES ================= */

window.mostrarEdiciones = async () => {

    window.__IGLESIA_SUB_ACTIVA = "recursos";
  window.__RECURSOS_SUB_ACTIVA = "ediciones";

  try {
    window.guardarEstadoBiblia?.({
      seccion: "iglesia",
      subIglesia: "recursos",
      subRecursos: "ediciones"
    });
  } catch(e) {}
  
  const cont = ed$("edicionesApp");
  if (!cont) return;

  const db = await edEsperarDB();
  if (!db) {
    cont.innerHTML = `
      <div style="padding:20px; text-align:center;">
        Firebase todavía no está listo.
      </div>
    `;
    return;
  }

  if (!edicionesIniciado) {
    cont.innerHTML = `
      <div id="edWrap">
               <div id="edTop">
          <div class="ed-top-title">
            <h3>Ediciones</h3>

            <button
              type="button"
              class="ed-top-icon"
              onclick="edToggleBuscadorEdiciones()"
              title="Buscar edición"
              aria-label="Buscar edición"
            >
              <i class="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>

          <div class="ed-top-actions">
            ${window.__ES_ADMIN ? `
              <button id="edBtnNueva" type="button" onclick="abrirNuevaEdicion()" title="Nueva edición">
                <i class="fa-solid fa-circle-plus"></i>
              </button>
            ` : ``}
          </div>
        </div>

        <div id="edBuscadorBox" style="display:none;">
          <div class="ed-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>

            <input
              id="edBuscarInput"
              type="search"
              placeholder="Buscar por título..."
              oninput="edBuscarEdiciones(this.value)"
            >

            <button
              type="button"
              onclick="edLimpiarBusquedaEdiciones()"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div id="edFiltros">
          <div class="ed-filtros-title">
            <i class="fa-solid fa-filter"></i>
            <span>Filtros</span>
          </div>

          <div class="ed-filtros-actions">
            <button
              id="edFiltroFlyersBtn"
              type="button"
              class="ed-filter-pill ed-filter-active"
              onclick="edToggleFiltroEdicion('flyers')"
            >
              Flyers
            </button>

            <button
              id="edFiltroLibrosBtn"
              type="button"
              class="ed-filter-pill ed-filter-active"
              onclick="edToggleFiltroEdicion('libros')"
            >
              Libros
            </button>
          </div>
        </div>

        <div id="edLista"></div>
      </div>

      <div id="edModal" onclick="cerrarEditorEdicionFondo(event)">
        <div id="edModalBox" onclick="event.stopPropagation()">

          <div id="edModalHead">
            <h3 id="edModalTitulo">Nueva edición</h3>
            <button id="edCerrarModal" type="button" onclick="cerrarEditorEdicion()">×</button>
          </div>

          <form id="edForm" onsubmit="guardarEdicion(event)">
       <div class="ed-field">
  <label for="edTitulo">Título de la edición</label>
  <input id="edTitulo" type="text" required placeholder="Ej: David y Goliat" />
</div>

<div class="ed-field">
  <label for="edRama">Rama</label>

  <select id="edRama">
    <option value="flyers">Flyers</option>
    <option value="libros">Libros</option>
  </select>

  <div style="font-size:12px; opacity:.75;">
    Elegí si esta edición pertenece a Flyers o Libros.
  </div>
</div>

<div class="ed-field">
  <label for="edPortadaFile">Portada</label>
              <input id="edPortadaFile" type="file" accept="image/*" />
              <img id="edPortadaPreview" alt="Portada actual" style="display:none;">
              <div style="font-size:12px; opacity:.75;">
                Podés cargar una portada o se usará la primera imagen de la edición.
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <b>Páginas / cards</b>
              <button class="ed-pill-btn" type="button" onclick="edAgregarPagina()">
                <i class="fa-solid fa-circle-plus"></i> Agregar página
              </button>
            </div>

            <div id="edPaginasEditor"></div>

            <div id="edEstado"></div>

            <div class="ed-form-actions">
              <button class="ed-secondary" type="button" onclick="cerrarEditorEdicion()">Cancelar</button>
              <button id="edBtnGuardar" class="ed-primary" type="submit">
                Guardar edición
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    edicionesIniciado = true;
  }

iniciarEscuchaEdiciones();
iniciarEscuchaEdicionesStats();
iniciarEscuchaMisEdicionesGuardadas();
iniciarEscuchaMisEdicionesDescargadas();
iniciarEscuchaEdicionesPublicadas();
};

function iniciarEscuchaEdiciones() {
  if (edicionesEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "ediciones"), (snap) => {
    const val = snap.val() || {};

    edicionesCache = Object.entries(val).map(([id, item]) => ({
      id,
      ...(item || {})
    }));

    edicionesCache.sort((a, b) => Number(b.actualizado || b.ts || 0) - Number(a.actualizado || a.ts || 0));

window.__EDICIONES_CACHE = edicionesCache;

renderEdiciones();

if (typeof window.renderCompartidos === "function") {
  window.renderCompartidos();
}
  }, (err) => {
    console.error("Error leyendo ediciones:", err);
  });

  edicionesEscuchaActiva = true;
}

function iniciarEscuchaEdicionesStats() {
  if (edicionesStatsEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "edicionesStats"), (snap) => {
    edicionesStatsCache = snap.val() || {};
    window.__EDICIONES_STATS = edicionesStatsCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesStatsEscuchaActiva = true;
}

function iniciarEscuchaMisEdicionesGuardadas() {
  const uid = edUidActual();

  if (!uid) {
    edicionesGuardadasCache = {};
    edicionesGuardadasUid = null;
    edicionesGuardadasEscuchaActiva = false;
    return;
  }

  if (edicionesGuardadasEscuchaActiva && edicionesGuardadasUid === uid) return;

  const db = edDB();
  if (!db) return;

  edicionesGuardadasUid = uid;

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    edicionesGuardadasCache = snap.val() || {};
    window.__EDICIONES_GUARDADAS = edicionesGuardadasCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesGuardadasEscuchaActiva = true;
}

function edStats(id) {
  const s = edicionesStatsCache?.[id] || window.__EDICIONES_STATS?.[id] || {};
  return {
    guardados: Number(s.guardados || 0),
    descargas: Number(s.descargas || 0),
    compartidos: Number(s.compartidos || 0)
  };
}

function iniciarEscuchaEdicionesPublicadas() {
  if (edicionesPublicadasEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "compartidos"), (snap) => {
    const val = snap.val() || {};
    edicionesPublicadasCache = {};

    Object.entries(val || {}).forEach(([key, item]) => {
      if (!item || typeof item !== "object") return;

      // formato actual: compartidos/edicion_ID
      if (item.tipo === "edicion" && item.edicionId) {
        edicionesPublicadasCache[item.edicionId] = true;
      }

      // respaldo por si el id de la ruta ya trae edicion_
      if (key.startsWith("edicion_")) {
        edicionesPublicadasCache[key.replace(/^edicion_/, "")] = true;
      }

      // formato agrupado futuro: compartidos/ediciones/{id}
      if (key === "ediciones") {
        Object.entries(item || {}).forEach(([subId, subItem]) => {
          if (subItem?.tipo === "edicion" && subItem?.edicionId) {
            edicionesPublicadasCache[subItem.edicionId] = true;
          } else {
            edicionesPublicadasCache[subId] = true;
          }
        });
      }
    });

    renderEdiciones();
  });

  edicionesPublicadasEscuchaActiva = true;
}

function edEstaPublicadaEnCompartidos(id) {
  return !!edicionesPublicadasCache?.[id];
}

function iniciarEscuchaMisEdicionesDescargadas() {
  const uid = edUidActual();

  if (!uid) {
    edicionesDescargadasCache = {};
    edicionesDescargadasUid = null;
    edicionesDescargadasEscuchaActiva = false;
    window.__EDICIONES_DESCARGADAS = {};
    return;
  }

  if (edicionesDescargadasEscuchaActiva && edicionesDescargadasUid === uid) return;

  const db = edDB();
  if (!db) return;

  edicionesDescargadasUid = uid;

  onValue(ref(db, `panelDescargasEdiciones/${uid}`), (snap) => {
    edicionesDescargadasCache = snap.val() || {};
    window.__EDICIONES_DESCARGADAS = edicionesDescargadasCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesDescargadasEscuchaActiva = true;
}

function edEstaDescargada(id) {
  const local = localStorage.getItem(`edicion_descargada_${id}`) === "1";

  return !!(
    local ||
    edicionesDescargadasCache?.[id] ||
    window.__EDICIONES_DESCARGADAS?.[id]
  );
}

async function edMarcarDescargada(id) {
  try {
    localStorage.setItem(`edicion_descargada_${id}`, "1");
  } catch (_) {}

  const uid = edUidActual();
  if (!uid) {
    if (typeof renderEdiciones === "function") renderEdiciones();
    if (typeof window.renderCompartidos === "function") window.renderCompartidos();
    return;
  }

  const db = edDB();
  if (!db) return;

  const ed = await obtenerEdicion(id);
  const portadaUrl = ed?.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "";

  await set(ref(db, `panelDescargasEdiciones/${uid}/${id}`), {
    tipo: "edicion",
    edicionId: id,
    titulo: ed?.titulo || "Edición",
    portadaUrl,
    ts: Date.now()
  });
}

function edEstaGuardada(id) {
  return !!(
    edicionesGuardadasCache?.[id] ||
    window.__EDICIONES_GUARDADAS?.[id]
  );
}

async function edIncrementarStat(id, campo) {
  const db = edDB();
  if (!db || !id || !campo) return;

  try {
    await runTransaction(ref(db, `edicionesStats/${id}/${campo}`), (actual) => {
      return Number(actual || 0) + 1;
    });
  } catch (err) {
    console.warn("No pude incrementar estadística:", campo, err);
  }
}

function edActionButton({ title, onclick, icon, count = 0, saved = false, danger = false }) {
  return `
    <button
      type="button"
      class="${danger ? "ed-danger" : ""} ${saved ? "ed-action-saved" : ""}"
      onclick="${onclick}"
      title="${edEscape(title)}"
    >
      <span class="ed-action-wrap">
        <i class="${icon}"></i>
        <span class="ed-action-count">${Number(count || 0)}</span>
      </span>
    </button>
  `;
}

function renderEdiciones() {
  const lista = ed$("edLista");
  if (!lista) return;

  lista.classList.remove("ed-lista-ramas");
  lista.classList.add("ed-lista-galeria");

  edActualizarControlesEdiciones();

  if (!edicionesCache.length) {
    lista.innerHTML = `
      <div id="edVacio">
        Todavía no hay ediciones cargadas.
      </div>
    `;
    return;
  }

  const busqueda = edNormalizarTexto(edBusquedaTexto);

  const items = edicionesCache.filter(ed => {
    const rama = edRamaEdicion(ed);

    if (rama === "flyers" && !edFiltroFlyers) return false;
    if (rama === "libros" && !edFiltroLibros) return false;

    if (busqueda) {
      const texto = edNormalizarTexto([
        ed.titulo || "",
        ed.refPublica || "",
        edRamaEdicion(ed),
        edTituloRama(edRamaEdicion(ed))
      ].join(" "));

      if (!texto.includes(busqueda)) return false;
    }

    return true;
  });

  if (!items.length) {
    lista.innerHTML = `
      <div id="edVacio">
        No encontré ediciones con esos filtros.
      </div>
    `;
    return;
  }

  function renderCardEdicion(ed) {
    const titulo = edEscape(ed.titulo || "Sin título");
    const portada = edPortadaEdicion(ed);
    const tieneVideo = edPaginasArray(ed).some(p => edPaginaEsVideo(p));
    const publicada = edEstaPublicadaEnCompartidos(ed.id);
    const rama = edRamaEdicion(ed);
    const ramaTitulo = edTituloRama(rama);

    return `
      <article class="ed-card ed-card-rama ed-card-galeria">
<div
  class="ed-card-cover ed-card-cover-scroll"
  role="region"
  title="Deslizá para ver las imágenes"
>
  ${
    tieneVideo
      ? (
          portada
            ? `<img src="${edEscape(portada)}" alt="${titulo}" loading="lazy" onclick="abrirPresentacionEdicion('${ed.id}')">`
            : `<span><i class="fa-solid fa-video"></i><br>Edición con video</span>`
        )
      : edMiniPaginasHTML(ed.id, "ediciones")
  }
</div>

        <div class="ed-card-body">
          <div class="ed-card-title">${titulo}</div>

          <div class="ed-card-rama-label">
            ${ramaTitulo}
          </div>

          <div class="ed-card-actions ed-card-actions-ediciones">
            ${window.__ES_ADMIN ? `
              <button
                type="button"
                class="ed-btn-publicar ${publicada ? "ed-publicada" : ""}"
                onclick="compartirEdicion('${ed.id}', 'compartidos')"
                title="${publicada ? "Ya está en Compartidos. Tocar para volver a compartir" : "Enviar a Compartidos"}"
              >
                <span class="ed-publicar-wrap">
                  <i class="fa-solid fa-icons"></i>

                  ${publicada ? `
                    <span class="ed-check-mini">
                      <i class="fa-solid fa-check"></i>
                    </span>
                  ` : ``}
                </span>
              </button>
            ` : ``}

            ${!tieneVideo ? `
              <button
                type="button"
                onclick="descargarEdicionPDF('${ed.id}')"
                title="Descargar PDF"
              >
                <i class="fa-solid fa-file-pdf"></i>
              </button>
            ` : ``}

            ${!tieneVideo ? `
  <button
    type="button"
    onclick="descargarEdicionPNGs('${ed.id}', this, 'ediciones')"
    title="Descargar PNG"
  >
    <i class="fa-solid fa-download"></i>
  </button>
` : ``}

            <button
              type="button"
onclick="edAbrirOpcionesCompartirEdicion('${ed.id}', 'ediciones', this)"
title="Compartir imagen o publicación"
            >
              <i class="fa-solid fa-share-nodes"></i>
            </button>

            ${window.__ES_ADMIN ? `
              <button type="button" onclick="editarEdicion('${ed.id}')" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                type="button"
                class="ed-danger ed-danger-mini"
                onclick="borrarEdicion('${ed.id}')"
                title="Borrar"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ``}
          </div>
        </div>
      </article>
    `;
  }

   lista.innerHTML = `
    <div class="ed-galeria-wrap">

      <button
        type="button"
        class="ed-galeria-nav ed-galeria-prev ed-galeria-nav-oculta"
        onclick="edMoverGaleria(-1)"
        title="Ver ediciones anteriores"
        aria-label="Ver ediciones anteriores"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <div class="ed-galeria-track">
        ${items.map(renderCardEdicion).join("")}
      </div>

      <button
        type="button"
        class="ed-galeria-nav ed-galeria-next ed-galeria-nav-oculta"
        onclick="edMoverGaleria(1)"
        title="Ver más ediciones"
        aria-label="Ver más ediciones"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>

    </div>
  `;

edActivarFlechasGaleria();
edActivarMiniGalerias(lista);
}

/* ================= EDITOR ================= */

window.abrirNuevaEdicion = () => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden crear ediciones.");
    return;
  }

  edicionEditId = null;

  const tituloModal = ed$("edModalTitulo");
  const modal = ed$("edModal");
  const form = ed$("edForm");
  const portadaPreview = ed$("edPortadaPreview");
  const paginas = ed$("edPaginasEditor");

  if (tituloModal) tituloModal.textContent = "Nueva edición";
  if (form) form.reset();

  const selectRama = ed$("edRama");
if (selectRama) selectRama.value = "flyers";
  
  if (portadaPreview) {
    portadaPreview.style.display = "none";
    portadaPreview.src = "";
  }
  if (paginas) paginas.innerHTML = "";

  edAgregarPagina();

  edSetEstado("");

  if (modal) modal.style.display = "flex";
};

window.editarEdicion = async (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden editar ediciones.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  edicionEditId = id;

  const tituloModal = ed$("edModalTitulo");
  const modal = ed$("edModal");
  const form = ed$("edForm");
  const inputTitulo = ed$("edTitulo");
  const portadaPreview = ed$("edPortadaPreview");
  const paginas = ed$("edPaginasEditor");

  if (tituloModal) tituloModal.textContent = "Editar edición";
  if (form) form.reset();
  if (inputTitulo) inputTitulo.value = ed.titulo || "";

  const selectRama = ed$("edRama");
if (selectRama) selectRama.value = edRamaEdicion(ed);

  if (portadaPreview && ed.portadaUrl) {
    portadaPreview.src = ed.portadaUrl;
    portadaPreview.style.display = "block";
    portadaPreview.dataset.url = ed.portadaUrl;
  } else if (portadaPreview) {
    portadaPreview.src = "";
    portadaPreview.dataset.url = "";
    portadaPreview.style.display = "none";
  }

  if (paginas) paginas.innerHTML = "";

  const arr = edPaginasArray(ed);
  if (arr.length) {
    arr.forEach(p => edAgregarPagina(p));
  } else {
    edAgregarPagina();
  }

  edSetEstado("");

  if (modal) modal.style.display = "flex";
};

window.edAgregarPagina = (data = {}) => {
  const wrap = ed$("edPaginasEditor");
  if (!wrap) return;

  const id = data.id || edKey("p");

  const mediaUrl = edMediaUrlPagina(data);
  const esVideo = edPaginaEsVideo(data);
  const mediaType = edMediaTypePagina(data);

  const div = document.createElement("div");
  div.className = "ed-page-editor";
  div.dataset.pageId = id;

  div.dataset.mediaUrl = mediaUrl;
  div.dataset.mediaType = mediaType;

  div.dataset.imagenUrl = esVideo ? "" : (data.imagenUrl || data.mediaUrl || "");
  div.dataset.videoUrl = esVideo ? (data.videoUrl || data.mediaUrl || data.imagenUrl || "") : "";

  div.dataset.audioEsUrl = data.audioEsUrl || "";
  div.dataset.audioEnUrl = data.audioEnUrl || "";

  div.dataset.videoKey = data.videoKey || "";
  div.dataset.videoFileName = data.videoFileName || "";
  div.dataset.videoSizeBytes = data.videoSizeBytes || "";

  const numero = wrap.children.length + 1;

  div.innerHTML = `
    <div class="ed-page-head">
      <b>Página ${numero}</b>
      <button type="button" onclick="edQuitarPagina(this)">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>

    ${mediaUrl ? (
      esVideo
        ? `<video class="ed-existing-video" src="${edEscape(mediaUrl)}" controls muted playsinline preload="metadata"></video>`
        : `<img class="ed-existing-preview" src="${edEscape(mediaUrl)}" alt="Imagen actual">`
    ) : ``}

    <div class="ed-page-grid">
      <div class="ed-field">
        <label>Imagen A4 / video</label>
        <input class="edInputMedia" type="file" accept="image/*,video/mp4,video/webm,video/quicktime">
        ${mediaUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene ${esVideo ? "video" : "imagen"}. Elegí otro archivo solo si querés reemplazarlo.</div>` : ``}
      </div>

      <div class="ed-field">
        <label>Audio español</label>
        <input class="edInputAudioEs" type="file" accept="audio/*">
        ${data.audioEsUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene audio español.</div>` : ``}
      </div>

      <div class="ed-field">
        <label>Audio inglés</label>
        <input class="edInputAudioEn" type="file" accept="audio/*">
        ${data.audioEnUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene audio inglés.</div>` : ``}
      </div>
    </div>
  `;

  wrap.appendChild(div);
  edRenumerarPaginas();
};

window.edQuitarPagina = (btn) => {
  const row = btn.closest(".ed-page-editor");
  if (row) row.remove();
  edRenumerarPaginas();
};

function edRenumerarPaginas() {
  const rows = Array.from(document.querySelectorAll("#edPaginasEditor .ed-page-editor"));
  rows.forEach((row, i) => {
    const b = row.querySelector(".ed-page-head b");
    if (b) b.textContent = `Página ${i + 1}`;
  });
}

window.cerrarEditorEdicion = () => {
  const modal = ed$("edModal");
  if (modal) modal.style.display = "none";
};

window.cerrarEditorEdicionFondo = (e) => {
  if (e.target && e.target.id === "edModal") {
    cerrarEditorEdicion();
  }
};

window.guardarEdicion = async (e) => {
  e.preventDefault();

  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden guardar ediciones.");
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const btn = ed$("edBtnGuardar");
  const titulo = edValor(ed$("edTitulo")?.value);
const rama = edNormalizarRama(ed$("edRama")?.value || "flyers");
const portadaFile = ed$("edPortadaFile")?.files?.[0] || null;
  const rows = Array.from(document.querySelectorAll("#edPaginasEditor .ed-page-editor"));

  if (!titulo) {
    alert("Completá el título.");
    return;
  }

    const existente = edicionEditId ? await obtenerEdicion(edicionEditId) : null;

  const portadaExistente = String(existente?.portadaUrl || "").trim();

  if (!rows.length && !portadaFile && !portadaExistente) {
    alert("Cargá una portada o agregá al menos una página.");
    return;
  }
  
  const edId = edicionEditId || push(ref(db, "ediciones")).key;
    const refPublica = existente?.refPublica || await edCrearRefPublicaUnica(titulo, edId);

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando...";
    }

    edSetEstado("Preparando archivos...");

    const paginasObj = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pageId = row.dataset.pageId || edKey("p");

      let imagenUrl = row.dataset.imagenUrl || "";
      let videoUrl = row.dataset.videoUrl || "";
      let mediaUrl = row.dataset.mediaUrl || imagenUrl || videoUrl || "";
      let mediaType = row.dataset.mediaType || (videoUrl ? "video/mp4" : (imagenUrl ? "image/*" : ""));

      let videoKey = row.dataset.videoKey || "";
      let videoFileName = row.dataset.videoFileName || "";
      let videoSizeBytes = Number(row.dataset.videoSizeBytes || 0);

      let audioEsUrl = row.dataset.audioEsUrl || "";
      let audioEnUrl = row.dataset.audioEnUrl || "";

      const mediaFile =
        row.querySelector(".edInputMedia")?.files?.[0] ||
        row.querySelector(".edInputImagen")?.files?.[0] ||
        null;

      const esFile = row.querySelector(".edInputAudioEs")?.files?.[0] || null;
      const enFile = row.querySelector(".edInputAudioEn")?.files?.[0] || null;

      if (mediaFile) {
        if (edEsVideoFile(mediaFile)) {
          edSetEstado(`Subiendo video ${i + 1} (${edFormatoMB(mediaFile.size)} MB)...`);

          const subida = await subirVideoEdicionR2Directo(mediaFile);

          videoUrl = subida.url;
          imagenUrl = "";
          mediaUrl = subida.url;
          mediaType = subida.contentType;

          videoKey = subida.key || "";
          videoFileName = subida.fileName || mediaFile.name || "";
          videoSizeBytes = Number(subida.sizeBytes || mediaFile.size || 0);
        } else {
          edSetEstado(`Subiendo imagen ${i + 1}...`);

          imagenUrl = await subirArchivoEdicionR2(mediaFile, `ediciones/${edId}/imagenes`);
          videoUrl = "";
          mediaUrl = imagenUrl;
          mediaType = mediaFile.type || "image/*";

          videoKey = "";
          videoFileName = "";
          videoSizeBytes = 0;
        }
      }

           if (!mediaUrl) {
        const tieneAudioSinImagen =
          esFile ||
          enFile ||
          audioEsUrl ||
          audioEnUrl;

        if (tieneAudioSinImagen) {
          alert(`La página ${i + 1} tiene audio, pero le falta imagen o video.`);
          return;
        }

        // ✅ Si la página está vacía, la salteamos.
        // Esto permite guardar una edición solo con portada.
        continue;
      }

      if (esFile) {
        edSetEstado(`Subiendo audio español ${i + 1}...`);
        audioEsUrl = await subirArchivoEdicionR2(esFile, `ediciones/${edId}/audio-es`);
      }

      if (enFile) {
        edSetEstado(`Subiendo audio inglés ${i + 1}...`);
        audioEnUrl = await subirArchivoEdicionR2(enFile, `ediciones/${edId}/audio-en`);
      }

      paginasObj[pageId] = {
        orden: i,

        // ✅ compatibilidad vieja
        imagenUrl,

        // ✅ nuevo soporte imagen / video
        videoUrl,
        mediaUrl,
        mediaType,

        videoKey,
        videoFileName,
        videoSizeBytes,

        audioEsUrl,
        audioEnUrl,
        actualizado: Date.now()
      };
    }

    let portadaUrl = existente?.portadaUrl || "";

    if (portadaFile) {
      edSetEstado("Subiendo portada...");
      portadaUrl = await subirArchivoEdicionR2(portadaFile, `ediciones/${edId}/portada`);
    }

       if (!portadaUrl) {
      const primeraImagen = Object.values(paginasObj)
        .find(p => !edPaginaEsVideo(p) && (p.imagenUrl || p.mediaUrl));

      portadaUrl = primeraImagen?.imagenUrl || primeraImagen?.mediaUrl || "";
    }

    // ✅ Si no hay páginas, pero sí hay portada,
    // usamos la portada como única página de la edición.
    if (!Object.keys(paginasObj).length) {
      if (!portadaUrl) {
        alert("Cargá una portada o al menos una página.");
        return;
      }

      const portadaPageId = edKey("p");

      paginasObj[portadaPageId] = {
        orden: 0,
        imagenUrl: portadaUrl,
        videoUrl: "",
        mediaUrl: portadaUrl,
        mediaType: "image/*",
        videoKey: "",
        videoFileName: "",
        videoSizeBytes: 0,
        audioEsUrl: "",
        audioEnUrl: "",
        actualizado: Date.now()
      };
    }

const data = {
    titulo,
  refPublica,
  rama,
  categoria: rama,
  tipoEdicion: rama,
  portadaUrl,
  paginas: paginasObj,
  publicada: true,
  creadoPor: existente?.creadoPor || window.__UID || "",
  ts: existente?.ts || Date.now(),
  actualizado: Date.now()
};

    edSetEstado("Guardando datos...");
    await set(ref(db, `ediciones/${edId}`), data);
await set(ref(db, `edicionesRefs/${refPublica}`), {
  edicionId: edId,
  titulo,
  ts: Date.now()
});
    edSetEstado("Edición guardada.");
    cerrarEditorEdicion();
  } catch (err) {
    console.error(err);
    alert(
      "No pude guardar la edición.\n\n" +
      (err?.message || err)
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar edición";
    }
  }
};

/* ================= VIDEOS GRANDES: SUBIDA DIRECTA A R2 ================= */

function edEsVideoFile(file) {
  const tipo = String(file?.type || "");
  const nombre = String(file?.name || "").toLowerCase();

  return (
    tipo.startsWith("video/") ||
    nombre.endsWith(".mp4") ||
    nombre.endsWith(".webm") ||
    nombre.endsWith(".mov")
  );
}

function edContentTypeVideo(file) {
  const tipo = String(file?.type || "").trim();
  if (tipo) return tipo;

  const nombre = String(file?.name || "").toLowerCase();

  if (nombre.endsWith(".mov")) return "video/quicktime";
  if (nombre.endsWith(".webm")) return "video/webm";

  return "video/mp4";
}

function edFormatoMB(bytes = 0) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1);
}

async function subirVideoEdicionR2Directo(file) {
  if (!file) throw new Error("Falta video.");

  const contentType = edContentTypeVideo(file);

  const permitidos = ["video/mp4", "video/webm", "video/quicktime"];
  if (!permitidos.includes(contentType)) {
    throw new Error("Tipo de video no permitido. Usá MP4, WEBM o MOV.");
  }

  const maxBytes = 80 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`Video demasiado grande: ${edFormatoMB(file.size)} MB. Máximo inicial: 80 MB.`);
  }

  edSetEstado(`Subiendo video a R2 (${edFormatoMB(file.size)} MB)...`);

  // ✅ Sin base64, sin Firebase Functions.
  // El video viaja como archivo real al Worker.
  const form = new FormData();
  form.append("file", file);
  form.append("destino", "ediciones");
  form.append("folder", "videos/ediciones");
  form.append("contentType", contentType);

  const r = await fetch(R2_VIDEO_UPLOAD_URL_EDICIONES, {
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

async function subirArchivoEdicionR2(file, carpeta) {
  const safe = `${Date.now()}_${edSafeName(file.name)}`;

  const fileBase64 = await edFileToBase64(file);

  const payload = {
    fileBase64,
    fileName: safe,
    contentType: file.type || "application/octet-stream",
    folder: carpeta || "ediciones"
  };

  const r = await fetch(R2_UPLOAD_URL_EDICIONES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  let data = {};

  try {
    data = JSON.parse(text);
  } catch (_) {
    data = {};
  }

  if (!r.ok) {
    console.error("R2 respondió error:", r.status, data || text);
    throw new Error(data.error || data.message || text || "Error subiendo archivo a R2");
  }

  const url =
    data.url ||
    data.publicUrl ||
    data.downloadURL ||
    data.fileUrl ||
    data.r2Url ||
    data?.data?.url ||
    data?.data?.publicUrl;

  if (!url) {
    console.warn("Respuesta R2 sin URL:", data, text);
    throw new Error("La función R2 respondió, pero no devolvió URL.");
  }

  return url;
}

function edFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ================= OBTENER / BORRAR ================= */

async function obtenerEdicion(id) {
  const cache = edicionesCache.find(x => x.id === id);
  if (cache) return cache;

  const db = await edEsperarDB();
  if (!db) return null;

  const snap = await get(ref(db, `ediciones/${id}`));
  const val = snap.val();
  if (!val) return null;

  return { id, ...val };
}

window.obtenerEdicion = obtenerEdicion;

/* ================= DESCARGA PNG + MINI GALERÍA EDICIONES ================= */

function edPaginasImagenes(edicion = {}) {
  return edPaginasArray(edicion)
    .filter(p => !edPaginaEsVideo(p))
    .filter(p => edMediaUrlPagina(p));
}

async function edBlobPngDesdeUrl(url) {
  const dataUrl = await edUrlToDataUrl(url);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("No pude convertir la imagen a PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    };

    img.onerror = () => reject(new Error("No pude leer la imagen."));
    img.src = dataUrl;
  });
}

function edDescargarBlob(blob, nombre = "imagen.png") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function edIndiceActualMiniGaleria(id, contexto = "ediciones") {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return 0;

  const ancho = track.clientWidth || 1;
  return Math.max(0, Math.round((track.scrollLeft || 0) / ancho));
}

function edIndiceActualVisor() {
  const track = document.querySelector("#edViewer .ed-slides");
  if (!track) return 0;

  const ancho = track.clientWidth || 1;
  return Math.max(0, Math.round((track.scrollLeft || 0) / ancho));
}

window.edMoverMiniGaleria = function edMoverMiniGaleria(id, contexto = "ediciones", direccion = 1) {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return;

  track.scrollBy({
    left: track.clientWidth * Number(direccion || 1),
    behavior: "smooth"
  });

  setTimeout(() => edActualizarMiniFlechas(id, contexto), 300);
};

window.edActualizarMiniFlechas = function edActualizarMiniFlechas(id, contexto = "ediciones") {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return;

  const wrap = track.closest(".ed-mini-galeria");
  if (!wrap) return;

  const prev = wrap.querySelector(".ed-mini-prev");
  const next = wrap.querySelector(".ed-mini-next");

  if (!prev || !next) return;

  const hayScroll = track.scrollWidth > track.clientWidth + 8;
  const inicio = track.scrollLeft <= 4;
  const final = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

  prev.classList.toggle("ed-mini-nav-oculta", !hayScroll || inicio);
  next.classList.toggle("ed-mini-nav-oculta", !hayScroll || final);
};

window.edActivarMiniGalerias = function edActivarMiniGalerias(root = document) {
  const tracks = root.querySelectorAll?.(".ed-mini-paginas") || [];

  tracks.forEach(track => {
    const wrap = track.closest(".ed-mini-galeria");
    if (!wrap) return;

    const id = wrap.dataset.edId || "";
    const contexto = wrap.dataset.contexto || "ediciones";

    if (track.dataset.readyMini !== "1") {
      track.dataset.readyMini = "1";

      track.addEventListener("scroll", () => {
        edActualizarMiniFlechas(id, contexto);
      }, { passive: true });

      // PC: rueda vertical sobre la imagen mueve horizontal.
      track.addEventListener("wheel", e => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

        e.preventDefault();
        track.scrollLeft += e.deltaY;
        edActualizarMiniFlechas(id, contexto);
      }, { passive: false });
    }

    requestAnimationFrame(() => edActualizarMiniFlechas(id, contexto));
  });
};

window.descargarPaginaEdicionPNG = async function descargarPaginaEdicionPNG(id, index = 0, boton = null, opts = {}) {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    if (!opts.silencioso) alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasImagenes(ed);
  const pagina = paginas[Number(index || 0)];

  if (!pagina) {
    if (!opts.silencioso) alert("No encontré esa imagen.");
    return;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    const blob = await edBlobPngDesdeUrl(edMediaUrlPagina(pagina));
    const base = edSafeName(ed.titulo || "edicion").replace(/\.[^.]+$/, "");
    const nombre = `${base}_pagina_${Number(index || 0) + 1}.png`;

    edDescargarBlob(blob, nombre);

    if (opts.marcar !== false) {
      await edMarcarDescargada(id);
      await edIncrementarStat(id, "descargas");
    }

  } catch (e) {
    console.error(e);

    if (!opts.silencioso) {
      alert("No pude descargar esta imagen como PNG.");
    }

    throw e;

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

function edElegirDescargaPNG(total = 1) {
  return new Promise(resolve => {
    // Si hay una sola imagen, no preguntamos nada.
    if (Number(total || 0) <= 1) {
      resolve("actual");
      return;
    }

    const anterior = document.getElementById("edDescargaPngModal");
    if (anterior) anterior.remove();

    const modal = document.createElement("div");
    modal.id = "edDescargaPngModal";
    modal.className = "modal-overlay abierto";
    modal.setAttribute("aria-hidden", "false");

    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.45);
      padding: 14px;
      box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div
        class="modal-card modal-card-sm"
        style="
          width: min(380px, calc(100vw - 32px));
          background: rgba(255,255,255,.98);
          color: #000;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 16px 50px rgba(0,0,0,.28);
          position: relative;
          box-sizing: border-box;
        "
      >
        <button
          type="button"
          data-ed-png-close="1"
          aria-label="Cerrar"
          title="Cerrar"
          style="
            position: absolute;
            right: 12px;
            top: 12px;
            width: 34px;
            height: 34px;
            border: none;
            border-radius: 999px;
            background: rgba(0,0,0,.06);
            color: #000;
            font-size: 20px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          "
        >
          ×
        </button>

        <h3 style="margin: 0 0 8px; font-size: 22px; font-weight: 900;">
          Descargar PNG
        </h3>

        <p style="margin: 0 0 16px; font-size: 14px; opacity: .75;">
          Elegí qué querés descargar.
        </p>

        <div style="display: grid; gap: 10px;">
          <button
            type="button"
            class="btn-primary"
            data-ed-png-opcion="actual"
            style="
              width: 100%;
              min-height: 46px;
              border-radius: 14px;
              font-weight: 900;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <i class="fa-solid fa-download"></i>
            Descargar imagen actual
          </button>

          <button
            type="button"
            class="btn-primary"
            data-ed-png-opcion="todas"
            style="
              width: 100%;
              min-height: 46px;
              border-radius: 14px;
              font-weight: 900;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <i class="fa-solid fa-download"></i>
            Descargar todas
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    modal.querySelector('[data-ed-png-close="1"]')?.addEventListener("click", () => {
      cerrar(null);
    });

    modal.querySelector('[data-ed-png-opcion="actual"]')?.addEventListener("click", () => {
      cerrar("actual");
    });

    modal.querySelector('[data-ed-png-opcion="todas"]')?.addEventListener("click", () => {
      cerrar("todas");
    });

    modal.addEventListener("click", e => {
      if (e.target === modal) cerrar(null);
    });
  });
}

window.descargarEdicionPNGs = async function descargarEdicionPNGs(id, boton = null, contexto = "ediciones") {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasImagenes(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene imágenes para descargar.");
    return;
  }

  const indiceActual =
    contexto === "visor"
      ? edIndiceActualVisor()
      : edIndiceActualMiniGaleria(id, contexto);

const eleccion = await edElegirDescargaPNG(paginas.length);

if (!eleccion) {
  return;
}

const descargarTodas = eleccion === "todas";

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (descargarTodas) {
      for (let i = 0; i < paginas.length; i++) {
        await descargarPaginaEdicionPNG(id, i, null, {
          marcar: false,
          silencioso: true
        });

        await new Promise(r => setTimeout(r, 350));
      }
    } else {
      await descargarPaginaEdicionPNG(id, indiceActual, null, {
        marcar: false,
        silencioso: true
      });
    }

    await edMarcarDescargada(id);
    await edIncrementarStat(id, "descargas");

  } catch (e) {
    console.error(e);
    alert("No pude descargar las imágenes PNG.");

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

function edMiniPaginasHTML(id, contexto = "ediciones") {
  const ed =
    edicionesCache.find(x => x.id === id) ||
    (window.__EDICIONES_CACHE || []).find(x => x.id === id);

  if (!ed) return "";

  const paginas = edPaginasImagenes(ed);

  if (!paginas.length) {
    const portada = edPortadaEdicion(ed);

    return portada ? `
      <div
        class="ed-mini-galeria ed-mini-galeria--${edEscape(contexto)}"
        data-ed-id="${edEscape(id)}"
        data-contexto="${edEscape(contexto)}"
      >
        <div id="edMiniTrack_${edEscape(contexto)}_${edEscape(id)}" class="ed-mini-paginas">
          <div class="ed-mini-page">
            <img
              src="${edEscape(portada)}"
              alt="${edEscape(ed.titulo || "Edición")}"
              loading="lazy"
              onclick="abrirPresentacionEdicion('${edEscape(id)}')"
            >
          </div>
        </div>
      </div>
    ` : `<div class="ed-mini-empty">Sin imagen</div>`;
  }

  return `
    <div
      class="ed-mini-galeria ed-mini-galeria--${edEscape(contexto)}"
      data-ed-id="${edEscape(id)}"
      data-contexto="${edEscape(contexto)}"
    >

      ${paginas.length > 1 ? `
        <button
          type="button"
          class="ed-mini-nav ed-mini-prev ed-mini-nav-oculta"
          onclick="event.stopPropagation(); edMoverMiniGaleria('${edEscape(id)}', '${edEscape(contexto)}', -1)"
          title="Imagen anterior"
          aria-label="Imagen anterior"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      ` : ``}

      <div
        id="edMiniTrack_${edEscape(contexto)}_${edEscape(id)}"
        class="ed-mini-paginas"
      >
        ${paginas.map((p, i) => {
          const url = edMediaUrlPagina(p);

          return `
            <div class="ed-mini-page">
              <img
                src="${edEscape(url)}"
                alt="${edEscape(ed.titulo || "Edición")} ${i + 1}"
                loading="lazy"
                onclick="abrirPresentacionEdicion('${edEscape(id)}')"
              >
            </div>
          `;
        }).join("")}
      </div>

      ${paginas.length > 1 ? `
        <button
          type="button"
          class="ed-mini-nav ed-mini-next ed-mini-nav-oculta"
          onclick="event.stopPropagation(); edMoverMiniGaleria('${edEscape(id)}', '${edEscape(contexto)}', 1)"
          title="Siguiente imagen"
          aria-label="Siguiente imagen"
        >
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      ` : ``}
    </div>
  `;
}

window.edMiniPaginasHTML = edMiniPaginasHTML;

window.borrarEdicion = async (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden borrar ediciones.");
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) return;

  if (!confirm(`¿Borrar la edición "${ed.titulo || "sin título"}"?`)) return;

  try {
    await remove(ref(db, `ediciones/${id}`));
    await remove(ref(db, `compartidos/edicion_${id}`));
  } catch (err) {
    console.error(err);
    alert("No pude borrar la edición.");
  }
};

/* ================= PRESENTACIÓN FULLSCREEN ================= */

window.abrirPresentacionEdicion = async (id) => {
  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasArray(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene páginas.");
    return;
  }

  const tieneVideo = paginas.some(p => edPaginaEsVideo(p));

  let viewer = ed$("edViewer");

  if (!viewer) {
    viewer = document.createElement("div");
    viewer.id = "edViewer";
    document.body.appendChild(viewer);
  }

  viewer.innerHTML = `
    <div class="ed-view-top">
      <div class="ed-view-title">${edEscape(ed.titulo || "Edición")}</div>

      <div class="ed-view-actions">
      <button type="button" onclick="guardarEdicionEnMiPanel('${ed.id}')" title="Guardar en Mi Panel">
  <i class="fa-solid fa-heart-circle-plus"></i>
</button>
               ${!tieneVideo ? `
          <button type="button" onclick="descargarEdicionPDF('${ed.id}')" title="Descargar PDF">
            <i class="fa-solid fa-file-pdf"></i>
          </button>
        ` : ``}

${!tieneVideo ? `
  <button type="button" onclick="descargarEdicionPNGs('${ed.id}', this, 'visor')" title="Descargar PNG">
    <i class="fa-solid fa-download"></i>
  </button>
` : ``}

        <button type="button" onclick="edAbrirOpcionesCompartirEdicion('${ed.id}', 'visor', this)" title="Compartir imagen o publicación">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button" class="ed-view-close" onclick="cerrarPresentacionEdicion()" title="Cerrar">
          ×
        </button>
      </div>
    </div>

    ${paginas.length > 1 ? `
      <button
        type="button"
        class="ed-nav-btn ed-nav-prev"
        onclick="edMoverSlide(-1)"
        title="Página anterior"
        aria-label="Página anterior"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <button
        type="button"
        class="ed-nav-btn ed-nav-next"
        onclick="edMoverSlide(1)"
        title="Página siguiente"
        aria-label="Página siguiente"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    ` : ``}

    <div class="ed-slides">
      ${paginas.map((p, i) => `
        <section class="ed-slide">
          <div class="ed-slide-inner">
            <div class="ed-slide-img-wrap">
              ${
  edPaginaEsVideo(p)
    ? `<video class="ed-slide-video" src="${edEscape(edMediaUrlPagina(p))}" controls playsinline preload="metadata"></video>`
    : `<img class="ed-slide-img" src="${edEscape(edMediaUrlPagina(p))}" alt="Página ${i + 1}" loading="lazy">`
}
            </div>

            ${(p.audioEsUrl || p.audioEnUrl) ? `
              <div class="ed-audios">
                ${p.audioEsUrl ? `
                  <div class="ed-audio-box es">
                    <div class="ed-audio-label">Español</div>
                    <audio controls preload="metadata" src="${edEscape(p.audioEsUrl)}"></audio>
                  </div>
                ` : ``}

                ${p.audioEnUrl ? `
                  <div class="ed-audio-box en">
                    <div class="ed-audio-label">English</div>
                    <audio controls preload="metadata" src="${edEscape(p.audioEnUrl)}"></audio>
                  </div>
                ` : ``}
              </div>
            ` : ``}
          </div>
        </section>
      `).join("")}
    </div>
  `;

  edPrepararVisorEdicion(viewer);

  viewer.classList.add("ed-open");
  document.body.style.overflow = "hidden";
  edIntentarPantallaCompleta(viewer);
};

function edIntentarPantallaCompleta(el) {
  try {
    if (document.fullscreenElement) return;

    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;

    if (fn) {
      const p = fn.call(el);
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  } catch (_) {}
}

function edAjustarViewportEdiciones() {
  const h =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    0;

  if (h) {
    document.documentElement.style.setProperty("--ed-vh", `${h}px`);
  }
}

function edActivarViewportEdiciones() {
  if (window.__ED_VIEWPORT_LISTENER_OK) return;

  window.__ED_VIEWPORT_LISTENER_OK = true;

  edAjustarViewportEdiciones();

  window.addEventListener("resize", edAjustarViewportEdiciones);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", edAjustarViewportEdiciones);
    window.visualViewport.addEventListener("scroll", edAjustarViewportEdiciones);
  }
}

function edPausarMediosEdicion(excepto = null) {
  document.querySelectorAll("#edViewer audio, #edViewer video").forEach((media) => {
    if (excepto && media === excepto) return;

    try {
      media.pause();
    } catch (_) {}
  });
}

function edIndiceSlideActual(slides = null) {
  const cont = slides || document.querySelector("#edViewer .ed-slides");
  if (!cont) return 0;

  const ancho = cont.clientWidth || window.innerWidth || 1;
  return Math.round(cont.scrollLeft / ancho);
}

function edIrASlide(indice, behavior = "smooth") {
  const slides = document.querySelector("#edViewer .ed-slides");
  if (!slides) return;

  const total = slides.querySelectorAll(".ed-slide").length;
  if (!total) return;

  const ancho = slides.clientWidth || window.innerWidth || 1;
  const seguro = Math.max(0, Math.min(total - 1, Number(indice || 0)));

  edPausarMediosEdicion();

  slides.dataset.edSlideActual = String(seguro);

  slides.scrollTo({
    left: seguro * ancho,
    behavior
  });
}

function edPrepararVisorEdicion(viewer) {
  if (!viewer) return;

  edActivarViewportEdiciones();

  const slides = viewer.querySelector(".ed-slides");
  if (!slides) return;

  slides.dataset.edSlideActual = "0";

  // ✅ Si un audio/video empieza, se detienen todos los demás.
  viewer.querySelectorAll("audio, video").forEach((media) => {
    media.addEventListener("play", () => {
      edPausarMediosEdicion(media);
    });
  });

  let scrollTimer = null;

  // ✅ Si cambia la página por scroll, se detienen los audios.
  slides.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
      const actual = edIndiceSlideActual(slides);

      if (slides.dataset.edSlideActual !== String(actual)) {
        slides.dataset.edSlideActual = String(actual);
        edPausarMediosEdicion();
      }

      // Corrige para que quede clavado en una página.
      edIrASlide(actual, "smooth");
    }, 120);
  }, { passive: true });

  let touchActivo = false;
  let touchX = 0;
  let touchY = 0;
  let touchInicioIndice = 0;

  slides.addEventListener("touchstart", (e) => {
    if (e.target?.closest?.("audio, video, button, input, select, textarea")) return;

    const t = e.touches?.[0];
    if (!t) return;

    touchActivo = true;
    touchX = t.clientX;
    touchY = t.clientY;
    touchInicioIndice = edIndiceSlideActual(slides);
  }, { passive: true });

  slides.addEventListener("touchend", (e) => {
    if (!touchActivo) return;

    touchActivo = false;

    const t = e.changedTouches?.[0];
    if (!t) return;

    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;

    const total = slides.querySelectorAll(".ed-slide").length;
    let destino = touchInicioIndice;

    // ✅ Un gesto = máximo una página.
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      destino = touchInicioIndice + (dx < 0 ? 1 : -1);
    }

    destino = Math.max(0, Math.min(total - 1, destino));

    edPausarMediosEdicion();

    setTimeout(() => edIrASlide(destino, "smooth"), 30);
    setTimeout(() => edIrASlide(destino, "smooth"), 180);
    setTimeout(() => edIrASlide(destino, "smooth"), 360);
  }, { passive: true });

  slides.addEventListener("touchcancel", () => {
    touchActivo = false;
  }, { passive: true });
}

window.cerrarPresentacionEdicion = () => {
  const veniaDesdeLinkCompartidos =
    !!window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS ||
    document.body.classList.contains("ed-link-directo");

  edPausarMediosEdicion();

  const viewer = ed$("edViewer");

  if (viewer) {
    viewer.classList.remove("ed-open");
    viewer.innerHTML = "";
  }

  document.body.style.overflow = "";
  document.body.classList.remove("ed-link-directo");

  try {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (_) {}

  if (veniaDesdeLinkCompartidos) {
    window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS = false;

    try {
      history.replaceState(
        null,
        "",
        `${edBasePublicaApp()}/`
      );
    } catch (_) {}

    if (typeof window.irA === "function") {
      window.irA("compartidos");
    }

    if (typeof window.mostrarCompartidos === "function") {
      window.mostrarCompartidos();
    }
  }
};

window.edMoverSlide = (dir = 1) => {
  const slides = document.querySelector("#edViewer .ed-slides");
  if (!slides) return;

  const total = slides.querySelectorAll(".ed-slide").length;
  if (!total) return;

  const actual = edIndiceSlideActual(slides);

  let siguiente = actual + Number(dir || 1);

  if (siguiente < 0) siguiente = total - 1;
  if (siguiente >= total) siguiente = 0;

  edIrASlide(siguiente, "smooth");
};

document.addEventListener("keydown", (e) => {
  const viewerAbierto = document.querySelector("#edViewer.ed-open");

  if (e.key === "Escape") {
    cerrarPresentacionEdicion();
    return;
  }

  if (!viewerAbierto) return;

  if (e.key === "ArrowRight") {
    edMoverSlide(1);
  }

  if (e.key === "ArrowLeft") {
    edMoverSlide(-1);
  }
});

/* ================= PDF ================= */
window.descargarEdicionPDF = async (id) => {
  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasArray(ed);
  if (!paginas.length) {
    alert("Esta edición no tiene páginas para descargar.");
    return;
  }

if (paginas.some(p => edPaginaEsVideo(p))) {
  alert("Esta edición contiene video, por eso no tiene descarga PDF.");
  return;
}

if (edTieneAudio(ed)) {
  alert("El PDF descarga solo el documento visual. Los audios no se incluyen dentro del PDF.");
}

  let jsPDF;

  try {
    jsPDF = await edObtenerJsPDF();
  } catch (err) {
    console.error(err);
    alert("No pude cargar la librería PDF. Revisá tu conexión e intentá de nuevo.");
    return;
  }

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 18;

    for (let i = 0; i < paginas.length; i++) {
      if (i > 0) pdf.addPage();

      if (edPaginaEsVideo(paginas[i])) {
  pdf.setFontSize(18);
  pdf.text("Página con video", pageW / 2, pageH / 2 - 12, { align: "center" });

  pdf.setFontSize(11);
  pdf.text(
    "El video no se puede insertar dentro del PDF.",
    pageW / 2,
    pageH / 2 + 12,
    { align: "center" }
  );

  continue;
}

const dataUrl = await edUrlToDataUrl(edMediaUrlPagina(paginas[i]));
      const dims = await edImageDims(dataUrl);

      const fit = edFit(dims.w, dims.h, pageW - margin * 2, pageH - margin * 2);
      const x = (pageW - fit.w) / 2;
      const y = (pageH - fit.h) / 2;

      const tipo = dataUrl.includes("image/png") ? "PNG" : "JPEG";
      pdf.addImage(dataUrl, tipo, x, y, fit.w, fit.h);
    }

    const nombre = edSafeName(ed.titulo || "edicion").replace(/\.[^.]+$/, "");
    pdf.save(`${nombre}.pdf`);
await edMarcarDescargada(id);
await edIncrementarStat(id, "descargas");
  } catch (err) {
    console.error(err);
    alert(
      "No pude generar el PDF.\n\n" +
      "Si las imágenes están en R2, revisá que R2 permita CORS para poder convertirlas a PDF desde el navegador."
    );
  }
};

async function edObtenerJsPDF() {
  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  await edCargarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");

  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  throw new Error("jsPDF no quedó disponible.");
}

function edCargarScript(src) {
  return new Promise((resolve, reject) => {
    const yaExiste = Array.from(document.scripts).some(s => s.src === src);
    if (yaExiste) {
      setTimeout(resolve, 250);
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function edUrlToDataUrl(url) {
  const proxy = edBuildR2ProxyUrl(url);

  const r = await fetch(proxy, { mode: "cors" });
  if (!r.ok) throw new Error("No pude leer imagen para PDF");

  const blob = await r.blob();

  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function edBuildR2ProxyUrl(url) {
  const u = new URL(R2_PROXY_URL_EDICIONES);
  u.searchParams.set("url", url);
  u.searchParams.set("nombre", "edicion");
  return u.toString();
}

async function edCrearFileDesdeUrl(url, nombre = "edicion.png") {
  if (!url) throw new Error("Falta URL de imagen.");

  const proxy = edBuildR2ProxyUrl(url);

  const r = await fetch(proxy, { mode: "cors" });
  if (!r.ok) throw new Error("No pude preparar la imagen para compartir.");

  const blob = await r.blob();

  const tipo = blob.type || "image/png";
  const extension = tipo.includes("jpeg") || tipo.includes("jpg")
    ? ".jpg"
    : tipo.includes("webp")
      ? ".webp"
      : ".png";

  const limpio = edSafeName(nombre || "edicion").replace(/\.[^.]+$/, "");

  return new File([blob], `${limpio}${extension}`, {
    type: tipo
  });
}

async function edCompartirPublicacionLink({ titulo, url, portadaUrl = "" }) {
  const tituloLimpio = String(titulo || "Edición").trim() || "Edición";
  const textoFallback = `${tituloLimpio}\n${url}`;

  // ✅ WhatsApp / compartir móvil:
  // mandamos portada como imagen adjunta + texto con link.
  if (navigator.share && portadaUrl) {
    try {
      const portadaFile = await edCrearFileDesdeUrl(
        portadaUrl,
        `${tituloLimpio}_portada.png`
      );

      if (
        navigator.canShare &&
        navigator.canShare({ files: [portadaFile] })
      ) {
        await navigator.share({
          title: tituloLimpio,
          text: textoFallback,
          files: [portadaFile]
        });

        return "archivo-link";
      }
    } catch (e) {
      console.warn("No pude adjuntar portada, comparto solo link:", e);
    }
  }

  if (!navigator.share) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(textoFallback);
      return "copiado";
    }

    prompt("Copiá este link:", url);
    return "prompt";
  }

  await navigator.share({
    title: tituloLimpio,
    text: tituloLimpio,
    url
  });

  return "link";
}

function edDescargarFileFallback(file) {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");

  a.href = objectUrl;
  a.download = file.name || "edicion.png";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

function edShareSetTrabajando(texto = "") {
  let aviso = document.getElementById("edShareWorkingAviso");

  if (!aviso) {
    aviso = document.createElement("div");
    aviso.id = "edShareWorkingAviso";
    aviso.innerHTML = `
      <span class="ed-share-working-spinner"></span>
      <span id="edShareWorkingTexto"></span>
    `;
    document.body.appendChild(aviso);
  }

  const txt = document.getElementById("edShareWorkingTexto");
  if (txt) txt.textContent = texto || "Preparando...";

  aviso.style.display = texto ? "inline-flex" : "none";
}

function edShareBloquearBotonesModal(bloquear = false, texto = "Preparando...") {
  const modal = document.getElementById("edShareChoiceModal");
  if (!modal) return;

  const botones = modal.querySelectorAll("button");
  botones.forEach(btn => {
    btn.disabled = bloquear;
  });

  modal.classList.toggle("ed-share-busy", bloquear);

  const titulo = modal.querySelector(".modal-title");
  const sub = modal.querySelector(".modal-sub");

  if (titulo && bloquear) titulo.textContent = "Un momento...";
  if (sub && bloquear) sub.textContent = texto;
}

function edAsegurarModalCompartirEdicion() {
  if (document.getElementById("edShareChoiceModal")) return;

  const modal = document.createElement("div");
  modal.id = "edShareChoiceModal";
  modal.className = "modal-overlay";

  modal.innerHTML = `
    <div class="modal-card modal-card-sm" onclick="event.stopPropagation()">
      <h3 class="modal-title">Compartir edición</h3>

      <p class="modal-sub">
        Elegí qué querés compartir.
      </p>

      <div class="modal-actions">
        <button type="button" id="edShareChoiceImagen" class="btn-primary">
          <i class="fa-solid fa-image"></i>
          Imagen
        </button>

        <button type="button" id="edShareChoicePublicacion" class="btn-primary">
          <i class="fa-solid fa-link"></i>
          Publicación
        </button>

        <button type="button" id="edShareChoiceCancelar" class="btn-ghost">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function edElegirTipoCompartirEdicion() {
  edAsegurarModalCompartirEdicion();

  const modal = document.getElementById("edShareChoiceModal");
  const btnImagen = document.getElementById("edShareChoiceImagen");
  const btnPublicacion = document.getElementById("edShareChoicePublicacion");
  const btnCancelar = document.getElementById("edShareChoiceCancelar");

  if (!modal || !btnImagen || !btnPublicacion || !btnCancelar) {
    return Promise.resolve("");
  }

  return new Promise(resolve => {
    let cerrado = false;

    const cerrar = (valor = "") => {
      if (cerrado) return;
      cerrado = true;

      if (!valor) {
        modal.classList.remove("abierto", "ed-share-busy");
        modal.style.display = "none";
      }

      resolve(valor);
    };

    btnImagen.onclick = () => {
      edShareBloquearBotonesModal(true, "Preparando la imagen para compartir...");
      edShareSetTrabajando("Preparando imagen...");
      cerrar("imagen");
    };

    btnPublicacion.onclick = () => {
      edShareBloquearBotonesModal(true, "Preparando el link de la publicación...");
      edShareSetTrabajando("Preparando publicación...");
      cerrar("publicacion");
    };

    btnCancelar.onclick = () => cerrar("");

    modal.onclick = e => {
      if (e.target === modal) cerrar("");
    };

    edShareBloquearBotonesModal(false);

    const titulo = modal.querySelector(".modal-title");
    const sub = modal.querySelector(".modal-sub");

    if (titulo) titulo.textContent = "Compartir edición";
    if (sub) sub.textContent = "Elegí qué querés compartir.";

    modal.style.display = "flex";
    modal.classList.add("abierto");
  });
}

function edIndiceCompartirActual(id, contexto = "ediciones") {
  try {
    if (contexto === "visor" && typeof edIndiceActualVisor === "function") {
      return edIndiceActualVisor();
    }

    if (typeof edIndiceActualMiniGaleria === "function") {
      return edIndiceActualMiniGaleria(id, contexto);
    }
  } catch (_) {}

  return 0;
}

window.edCompartirImagenActualEdicion = async function edCompartirImagenActualEdicion(
  id,
  contexto = "ediciones",
  boton = null
) {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasImagenes(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene imágenes para compartir.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const indiceRaw = Number(edIndiceCompartirActual(id, contexto) || 0);
  const indice = Math.max(0, Math.min(indiceRaw, paginas.length - 1));
  const pagina = paginas[indice] || paginas[0];
  const imagenUrl = edMediaUrlPagina(pagina);

  if (!imagenUrl) {
    alert("No encontré la imagen actual.");
    return;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Preparando imagen para compartir...");
    }

    const file = await edCrearFileDesdeUrl(
      imagenUrl,
      `${titulo}_${indice + 1}`
    );

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: titulo,
        files: [file]
      });

      await edIncrementarStat(id, "compartidos");
      return;
    }

    edDescargarFileFallback(file);

    alert(
      "Este navegador no permite compartir la imagen directamente.\n\n" +
      "Se descargó la imagen para que puedas compartirla manualmente."
    );

  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error("No pude compartir la imagen actual:", e);
    alert("No pude compartir la imagen actual.");

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

window.edAbrirOpcionesCompartirEdicion = async function edAbrirOpcionesCompartirEdicion(
  id,
  contexto = "ediciones",
  boton = null
) {
  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    const opcion = await edElegirTipoCompartirEdicion();

    if (!opcion) {
      edShareSetTrabajando("");
      return;
    }

    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (opcion === "imagen") {
      edShareSetTrabajando("Preparando imagen...");
      await edCompartirImagenActualEdicion(id, contexto, boton);
      return;
    }

    if (opcion === "publicacion") {
      edShareSetTrabajando("Preparando publicación...");
      await compartirEdicion(id, "redes");
    }

  } finally {
    const modal = document.getElementById("edShareChoiceModal");
    if (modal) {
      modal.classList.remove("abierto", "ed-share-busy");
      modal.style.display = "none";
    }

    edShareSetTrabajando("");

    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

function edImageDims(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function edFit(w, h, maxW, maxH) {
  const ratio = Math.min(maxW / w, maxH / h);
  return {
    w: w * ratio,
    h: h * ratio
  };
}

/* ================= COMPARTIR ================= */
/* ================= GUARDAR EN MI PANEL ================= */

window.guardarEdicionEnMiPanel = async (id) => {
  const uid = edUidActual();

  if (!uid) {
    edPedirLoginParaPanel();
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const panelRef = ref(db, `panelEdiciones/${uid}/${id}`);
  const ya = await get(panelRef);

  if (ya.exists()) {
    alert("Esta edición ya está guardada en Mi Panel.");
    return;
  }

 const portadaUrl = edPortadaEdicion(ed);

  try {
    await set(panelRef, {
      tipo: "edicion",
      edicionId: id,
      titulo: ed.titulo || "Edición",
      portadaUrl,
      ts: Date.now()
    });

    await edIncrementarStat(id, "guardados");

    alert("Guardado en Mi Panel.");
  } catch (err) {
    console.error(err);
    alert("No pude guardar en Mi Panel.");
  }
};

function edUidActual() {
  return window.__UID || window.__FB?.auth?.currentUser?.uid || null;
}

function edPedirLoginParaPanel() {
  const modal = document.getElementById("loginModal");

  if (modal) {
    const title = modal.querySelector(".modal-title");
    const sub = modal.querySelector(".modal-sub");

    if (title) title.textContent = "🔐 Iniciar sesión";
    if (sub) sub.textContent = "Iniciá sesión para guardar esta edición en Mi Panel.";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  if (typeof window.irALogin === "function") {
    window.irALogin();
    return;
  }

  alert("Iniciá sesión para guardar esta edición en Mi Panel.");
}

async function edAsegurarPublicadaParaCompartir(ed) {
  const db = edDB();

  if (!db) {
    alert("Firebase no está listo.");
    return false;
  }

  const id = ed?.id || "";

  if (!id) {
    alert("No encontré la edición.");
    return false;
  }

  const compRef = ref(db, `compartidos/edicion_${id}`);
  const snap = await get(compRef);

  // Si ya está publicada, no alteramos la fecha ni la subimos de nuevo.
  if (snap.exists()) {
    return true;
  }

  // Mantiene tu regla actual: publicar en Compartidos es tarea de admin.
  if (!window.__ES_ADMIN) {
    alert(
      "Esta edición todavía no está publicada en Compartidos.\n\n" +
      "Un administrador debe enviarla a Compartidos antes de compartir el enlace."
    );
    return false;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = edPortadaEdicion(ed);
  const ts = Date.now();

  try {
    await set(compRef, {
      tipo: "edicion",
      edicionId: id,
      titulo,
      rama: edRamaEdicion(ed),
      categoria: edRamaEdicion(ed),
      tipoEdicion: edRamaEdicion(ed),
      portadaUrl,
      creadoPor: window.__UID || "",
      actualizadoPor: window.__UID || "",
      ts,
      publicadoEn: ts,
      republicadoEn: 0
    });

    edicionesPublicadasCache[id] = true;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }

    if (typeof mostrarToast === "function") {
      mostrarToast("✅ Edición enviada a Compartidos para poder compartirla");
    }

    return true;
  } catch (err) {
    console.error("No pude enviar la edición a Compartidos:", err);
    alert("No pude enviar la edición a Compartidos.");
    return false;
  }
}

window.compartirEdicion = async (id, destino = "redes") => {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = edPortadaEdicion(ed);

  /* ===== Botón publicar / volver a publicar en Compartidos ===== */

  if (destino === "compartidos") {
    if (!window.__ES_ADMIN) {
      alert("Solo los administradores pueden enviar a Compartidos.");
      return;
    }

    const db = edDB();

    if (!db) {
      alert("Firebase no está listo.");
      return;
    }

    const compRef = ref(db, `compartidos/edicion_${id}`);
    const snap = await get(compRef);
    const yaEstaba = snap.exists();

    if (yaEstaba) {
      const ok = confirm(
        "Esta edición ya está en Compartidos.\n\n" +
        "¿Volvemos a compartirla para que quede arriba?"
      );

      if (!ok) return;
    }

    const ts = Date.now();

    try {
const anterior = snap.val() || {};

await set(compRef, {
  ...anterior,

  tipo: "edicion",
  edicionId: id,
  titulo,
  rama: edRamaEdicion(ed),
  categoria: edRamaEdicion(ed),
  tipoEdicion: edRamaEdicion(ed),
  portadaUrl,

  creadoPor: anterior.creadoPor || window.__UID || "",
  actualizadoPor: window.__UID || "",

  // ✅ mantiene la publicación original, solo cambia fecha/posición
  fechaOriginal: Number(
    anterior.fechaOriginal ||
    anterior.fecha ||
    anterior.publicadoEn ||
    anterior.ts ||
    0
  ),
  fecha: ts,
  ts,
  publicadoEn: ts,
  republicadoEn: yaEstaba ? ts : 0
});

      edicionesPublicadasCache[id] = true;
      renderEdiciones();

      if (typeof window.renderCompartidos === "function") {
        window.renderCompartidos();
      }

      if (typeof mostrarToast === "function") {
        mostrarToast(
          yaEstaba
            ? "✅ Edición compartida nuevamente"
            : "✅ Edición enviada a Compartidos"
        );
      } else {
        alert(
          yaEstaba
            ? "Edición compartida nuevamente."
            : "Edición enviada a Compartidos."
        );
      }
    } catch (err) {
      console.error("No pude publicar en Compartidos:", err);
      alert("No pude enviar la edición a Compartidos.");
    }

    return;
  }

  /* ===== Compartir publicación con link ===== */

  const publicada = await edAsegurarPublicadaParaCompartir(ed);

  if (!publicada) return;

  const url = await crearLinkPublicoEdicion(id, titulo);

  try {
const resultado = await edCompartirPublicacionLink({
      titulo,
      url,
      portadaUrl
    });

    await edIncrementarStat(id, "compartidos");

    if (resultado === "copiado") {
      if (typeof mostrarToast === "function") {
        mostrarToast("🔗 Link copiado para compartir");
      } else {
        alert("Link copiado para compartir.");
      }
    }
  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error(e);
    alert("No pude compartir la edición.");
  }
};

async function crearLinkPublicoEdicion(id, titulo = "Edición") {
  const refPublica = await edAsegurarRefPublica(id, titulo);

  return `${edBasePublicaApp()}/?ver=compartidos&edicionRef=${encodeURIComponent(refPublica)}`;
}

/* ================= LINK PÚBLICO ================= */

async function edIdDesdeLinkPublico() {
  const params = new URLSearchParams(location.search);

  // Link viejo, para que no se rompan los anteriores:
  // ?ver=edicion&id=...
  if (params.get("ver") === "edicion" && params.get("id")) {
    return {
      id: params.get("id"),
      refPublica: ""
    };
  }

  // Link nuevo redirigido desde /ediciones/?ref=...
  const refPublica =
    params.get("edicionRef") ||
    params.get("ref") ||
    "";

  if (!refPublica) {
    return {
      id: "",
      refPublica: ""
    };
  }

  const db = await edEsperarDB();
  if (!db) {
    return {
      id: "",
      refPublica
    };
  }

  const snapRef = await get(ref(db, `edicionesRefs/${refPublica}`));
  const valRef = snapRef.val();

  const idDesdeRef =
    typeof valRef === "string"
      ? valRef
      : valRef?.edicionId || "";

  if (idDesdeRef) {
    return {
      id: idDesdeRef,
      refPublica
    };
  }

  // Respaldo por si existe refPublica dentro de ediciones,
  // pero todavía no existe edicionesRefs.
  const snapEds = await get(ref(db, "ediciones"));
  const eds = snapEds.val() || {};

  const encontrado = Object.entries(eds).find(([_, item]) => {
    return String(item?.refPublica || "") === refPublica;
  });

  return {
    id: encontrado?.[0] || "",
    refPublica
  };
}

/* ================= LINK PÚBLICO ================= */
async function abrirEdicionDesdeURL() {
  if (!edEsLinkDirectoPublico()) return;

  document.body.classList.add("ed-link-directo");

  const data = await edIdDesdeLinkPublico();
  const id = data.id;
  const refPublica = data.refPublica;

  if (!id) {
    document.body.classList.remove("ed-link-directo");
    return;
  }

  // ✅ Al cerrar, vuelve a Compartidos.
  window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS = true;

  // ✅ Si vino desde /ediciones/?ref=..., dejamos URL canónica.
  if (refPublica) {
    try {
      history.replaceState(
        null,
        "",
        `${edBasePublicaApp()}/?ver=compartidos&edicionRef=${encodeURIComponent(refPublica)}`
      );
    } catch (_) {}
  }

  await edEsperarDB();

  // ✅ Abrimos la edición directamente, sin renderizar feed antes.
  await abrirPresentacionEdicion(id);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(abrirEdicionDesdeURL, 60);
  }, { once: true });
} else {
  setTimeout(abrirEdicionDesdeURL, 60);
}
