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
          class="ed-card-cover"
          onclick="abrirPresentacionEdicion('${ed.id}')"
          role="button"
          title="Abrir edición"
        >
          ${
            portada
              ? `<img src="${edEscape(portada)}" alt="${titulo}" loading="lazy">`
              : tieneVideo
                ? `<span><i class="fa-solid fa-video"></i><br>Edición con video</span>`
                : `<span>Sin portada</span>`
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

            <button
              type="button"
              onclick="compartirEdicion('${ed.id}', 'redes')"
              title="Compartir en redes"
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
    <div class="ed-galeria-track">
      ${items.map(renderCardEdicion).join("")}
    </div>
  `;
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

  if (!rows.length) {
    alert("Agregá al menos una página.");
    return;
  }

  const existente = edicionEditId ? await obtenerEdicion(edicionEditId) : null;
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
        alert(`La página ${i + 1} necesita imagen o video.`);
        return;
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

        <button type="button" onclick="compartirEdicion('${ed.id}', 'redes')" title="Compartir">
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
  const veniaDeLinkDirecto = document.body.classList.contains("ed-link-directo");

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

  if (veniaDeLinkDirecto) {
    try {
      history.replaceState(null, "", `${edBasePublicaApp()}/index.html`);
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

async function edCompartirConPortada({ titulo, url, portadaUrl }) {
  const tituloLimpio = String(titulo || "Edición").trim() || "Edición";
  const textoFallback = `${tituloLimpio}\n${url}`;

  if (!navigator.share) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(textoFallback);
      return "copiado";
    }

    prompt("Copiá este link:", url);
    return "prompt";
  }

  if (portadaUrl) {
    try {
      const file = await edCrearFileDesdeUrl(portadaUrl, tituloLimpio);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: tituloLimpio,
          text: tituloLimpio,
          url,
          files: [file]
        });

        return "archivo";
      }
    } catch (err) {
      console.warn("No pude compartir la portada como archivo. Uso link solo:", err);
    }
  }

  await navigator.share({
    title: tituloLimpio,
    text: tituloLimpio,
    url
  });

  return "link";
}

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

window.compartirEdicion = async (id, destino = "redes") => {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = typeof edPortadaEdicion === "function"
    ? edPortadaEdicion(ed)
    : (ed.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "");

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
        "Esta edición ya está en Compartidos.\n\n¿Volvemos a compartirla para que quede arriba?"
      );

      if (!ok) return;
    }

    const ts = Date.now();

await set(compRef, {
  tipo: "edicion",
  edicionId: id,
  titulo,
  rama: edRamaEdicion(ed),
  categoria: edRamaEdicion(ed),
  tipoEdicion: edRamaEdicion(ed),
  portadaUrl,
  creadoPor: snap.val()?.creadoPor || window.__UID || "",
  actualizadoPor: window.__UID || "",
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
      mostrarToast(yaEstaba ? "✅ Edición compartida nuevamente" : "✅ Edición enviada a Compartidos");
    } else {
      alert(yaEstaba ? "Edición compartida nuevamente." : "Edición enviada a Compartidos.");
    }

    return;
  }

  const url = await crearLinkPublicoEdicion(id, titulo);

  try {
    const resultado = await edCompartirConPortada({
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
  } catch (err) {
    console.warn("Compartir cancelado o falló:", err);
  }
};

async function crearLinkPublicoEdicion(id, titulo = "Edición") {
  const refPublica = await edAsegurarRefPublica(id, titulo);
  return `${edBasePublicaApp()}/ediciones/?ref=${encodeURIComponent(refPublica)}`;
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
  const data = await edIdDesdeLinkPublico();
  const id = data.id;
  const refPublica = data.refPublica;

  if (!id) return;

  window.__ED_LINK_DIRECTO = true;
  document.body.classList.add("ed-link-directo");

  if (refPublica) {
    try {
      history.replaceState(
        null,
        "",
        `${edBasePublicaApp()}/ediciones/?ref=${encodeURIComponent(refPublica)}`
      );
    } catch (_) {}
  }

  await edEsperarDB();

  setTimeout(() => {
    abrirPresentacionEdicion(id);
  }, 250);
}

setTimeout(abrirEdicionDesdeURL, 100);
