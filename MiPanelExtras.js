import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= MI PANEL EXTRAS ================= */

let panelFiltros = {
  imagenes: true,
  marcadores: false,
  devocionales: false,
  compartidos: false
};

let panelCompartidosEscuchaActiva = false;
let panelCompartidosUid = null;
let panelCompartidosCache = {};

function mp$(id) {
  return document.getElementById(id);
}

function mpDB() {
  return window.__FB?.db || null;
}

function mpUid() {
  return window.__UID || window.__FB?.auth?.currentUser?.uid || null;
}

function mpEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.panelToggleFiltro = (tipo) => {
  if (!(tipo in panelFiltros)) return;

  panelFiltros[tipo] = !panelFiltros[tipo];

  // Evita que quede todo oculto
  const algunoActivo = Object.values(panelFiltros).some(Boolean);
  if (!algunoActivo) panelFiltros[tipo] = true;

  // Si se activa notas o imágenes, dejamos que tu lógica vieja cargue contenido
  if (panelFiltros[tipo] && typeof window.mostrarSeccion === "function") {
    if (tipo === "imagenes") window.mostrarSeccion("imagenes");
    if (tipo === "marcadores") window.mostrarSeccion("marcadores");
  }

  setTimeout(panelAplicarFiltros, 80);
};

function panelAplicarFiltros() {
  const mapa = {
    imagenes: "panel-imagenes",
    marcadores: "panel-marcadores",
    devocionales: "panel-devocionales",
    compartidos: "panel-compartidos"
  };

  Object.entries(mapa).forEach(([tipo, id]) => {
    const sec = mp$(id);
    if (sec) sec.style.display = panelFiltros[tipo] ? "block" : "none";
  });

  const botones = {
    imagenes: "btnPanelFiltroImagenes",
    marcadores: "btnPanelFiltroMarcadores",
    devocionales: "btnPanelFiltroDevocionales",
    compartidos: "btnPanelFiltroCompartidos"
  };

  Object.entries(botones).forEach(([tipo, id]) => {
    const btn = mp$(id);
    if (btn) btn.classList.toggle("activo", !!panelFiltros[tipo]);
  });

  // Solo admins ven el + de imágenes
  const btnNuevoImg = mp$("btnPanelImgNuevo");
  if (btnNuevoImg) {
    btnNuevoImg.style.display = window.__ES_ADMIN ? "inline-flex" : "none";
  }

  if (panelFiltros.compartidos) {
    panelCargarCompartidosGuardados();
  }

  if (panelFiltros.devocionales) {
    panelRenderDevocionalesPlaceholder();
  }
}

function panelRenderDevocionalesPlaceholder() {
  const cont = mp$("panelDevocionalesApp");
  if (!cont) return;

  cont.innerHTML = `
    <div class="panel-extra-box">
      Todavía no conectamos devocionales guardados. Esta pestaña queda preparada.
    </div>
  `;
}

function panelCargarCompartidosGuardados() {
  const cont = mp$("panelCompartidosApp");
  if (!cont) return;

  const uid = mpUid();

  if (!uid) {
    cont.innerHTML = `
      <div class="panel-extra-box">
        Iniciá sesión para ver tus compartidos guardados.
      </div>
    `;
    return;
  }

  const db = mpDB();
  if (!db) {
    cont.innerHTML = `
      <div class="panel-extra-box">
        Firebase todavía no está listo.
      </div>
    `;
    return;
  }

  if (panelCompartidosEscuchaActiva && panelCompartidosUid === uid) {
    panelRenderCompartidosGuardados();
    return;
  }

  panelCompartidosUid = uid;

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    panelCompartidosCache = snap.val() || {};
    panelRenderCompartidosGuardados();
  });

  panelCompartidosEscuchaActiva = true;
}

function panelRenderCompartidosGuardados() {
  const cont = mp$("panelCompartidosApp");
  if (!cont) return;

  const arr = Object.entries(panelCompartidosCache || {}).map(([id, item]) => ({
    id,
    ...(item || {})
  })).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

  if (!arr.length) {
    cont.innerHTML = `
      <div class="panel-extra-box">
        Todavía no guardaste ediciones en Mi Panel.
      </div>
    `;
    return;
  }

  cont.innerHTML = `
    <div class="panel-guardados-grid">
      ${arr.map(item => `
        <article class="panel-guardado-card">
          <div class="panel-guardado-cover" onclick="abrirPresentacionEdicion('${item.edicionId}')">
            ${item.portadaUrl ? `<img src="${mpEscape(item.portadaUrl)}" alt="${mpEscape(item.titulo || "Edición")}" loading="lazy">` : ``}
          </div>

          <div class="panel-guardado-body">
            <div class="panel-guardado-title">${mpEscape(item.titulo || "Edición")}</div>

            <div class="panel-guardado-actions">
              <button type="button" onclick="abrirPresentacionEdicion('${item.edicionId}')" title="Abrir">
                <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
              </button>

              <button type="button" onclick="descargarEdicionPDF('${item.edicionId}')" title="Descargar PDF">
                <i class="fa-solid fa-file-pdf"></i>
              </button>

              <button type="button" onclick="compartirEdicion('${item.edicionId}', 'redes')" title="Compartir">
                <i class="fa-solid fa-share-nodes"></i>
              </button>
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

setTimeout(() => {
  panelAplicarFiltros();
}, 1200);
