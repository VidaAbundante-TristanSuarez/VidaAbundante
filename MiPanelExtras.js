import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= MI PANEL EXTRAS =================
   Regla:
   - Solo imágenes/devocionales => galería con índice.
   - Si además hay notas o compartidos => feed tipo Compartidos.
===================================================== */

let panelFiltros = {
  imagenes: true,
  devocionales: false,
  marcadores: false,
  compartidos: false
};

let panelCompartidosEscuchaActiva = false;
let panelCompartidosUid = null;
let panelCompartidosCache = {};

let panelRecursosEscuchaActiva = false;
let panelRecursosUid = null;
let panelRecursosCache = {};

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

  const algunoActivo = Object.values(panelFiltros).some(Boolean);
  if (!algunoActivo) panelFiltros[tipo] = true;

  panelAplicarFiltros();
};

function panelEsModoGaleria() {
  const tieneGaleria = panelFiltros.imagenes || panelFiltros.devocionales;
  const tieneFeed = panelFiltros.marcadores || panelFiltros.compartidos;

  return tieneGaleria && !tieneFeed;
}

function panelAsegurarFeed() {
  let feed = mp$("panel-mi-feed");

  if (!feed) {
    feed = document.createElement("div");
    feed.id = "panel-mi-feed";

    const panel = mp$("seccion-panel");
    if (panel) panel.appendChild(feed);
  }

  return feed;
}

function panelAplicarFiltros() {
  const modoGaleria = panelEsModoGaleria();

  const secImagenes = mp$("panel-imagenes");
  const secMarcadores = mp$("panel-marcadores");
  const secDev = mp$("panel-devocionales");
  const secComp = mp$("panel-compartidos");
  const feed = panelAsegurarFeed();

  if (modoGaleria) {
    if (feed) feed.style.display = "none";

    if (secImagenes) secImagenes.style.display = panelFiltros.imagenes ? "block" : "none";
    if (secMarcadores) secMarcadores.style.display = "none";
    if (secComp) secComp.style.display = "none";

    if (secDev) {
      secDev.style.display = panelFiltros.devocionales && !panelFiltros.imagenes ? "block" : "none";
    }

    if (panelFiltros.imagenes && typeof window.mostrarSeccion === "function") {
      window.mostrarSeccion("imagenes");
      setTimeout(() => {
        if (secImagenes) secImagenes.style.display = "block";
        if (secMarcadores) secMarcadores.style.display = "none";
        if (feed) feed.style.display = "none";
      }, 80);
    }

    if (panelFiltros.devocionales && !panelFiltros.imagenes) {
      panelRenderDevocionalesPlaceholder();
    }
  } else {
    if (secImagenes) secImagenes.style.display = "none";
    if (secMarcadores) secMarcadores.style.display = "none";
    if (secDev) secDev.style.display = "none";
    if (secComp) secComp.style.display = "none";

    if (feed) feed.style.display = "block";

    panelCargarFeedMiPanel();
  }

  panelRefrescarBotones();

  const btnNuevoImg = mp$("btnPanelImgNuevo");
  if (btnNuevoImg) {
    btnNuevoImg.style.display = window.__ES_ADMIN ? "inline-flex" : "none";
  }
}

function panelRefrescarBotones() {
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
}

function panelRenderDevocionalesPlaceholder() {
  const cont = mp$("panelDevocionalesApp");
  if (!cont) return;

  cont.innerHTML = `
    <div class="panel-extra-box">
      La galería de devocionales queda preparada. La conectamos en el próximo paso.
    </div>
  `;
}

function panelCargarFeedMiPanel() {
  const uid = mpUid();
  const feed = panelAsegurarFeed();

  if (!feed) return;

  if (!uid) {
    feed.innerHTML = `
      <div class="panel-extra-box">
        Iniciá sesión para ver tu Mi Panel.
      </div>
    `;
    return;
  }

  const db = mpDB();
  if (!db) {
    feed.innerHTML = `
      <div class="panel-extra-box">
        Firebase todavía no está listo.
      </div>
    `;
    return;
  }

  panelEscucharCompartidosGuardados(uid);
  panelEscucharRecursosGuardados(uid);
  panelRenderFeedMiPanel();
}

function panelEscucharCompartidosGuardados(uid) {
  if (panelCompartidosEscuchaActiva && panelCompartidosUid === uid) return;

  const db = mpDB();
  if (!db) return;

  panelCompartidosUid = uid;

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    panelCompartidosCache = snap.val() || {};
    panelRenderFeedMiPanel();
  });

  panelCompartidosEscuchaActiva = true;
}

function panelEscucharRecursosGuardados(uid) {
  if (panelRecursosEscuchaActiva && panelRecursosUid === uid) return;

  const db = mpDB();
  if (!db) return;

  panelRecursosUid = uid;

  onValue(ref(db, `panelRecursos/${uid}`), (snap) => {
    panelRecursosCache = snap.val() || {};
    panelRenderFeedMiPanel();
  });

  panelRecursosEscuchaActiva = true;
}

function panelFeedItems() {
  const items = [];

  if (panelFiltros.compartidos) {
    Object.entries(panelCompartidosCache || {}).forEach(([id, item]) => {
      items.push({
        id,
        tipo: "edicion",
        titulo: item.titulo || "Edición",
        portadaUrl: item.portadaUrl || "",
        edicionId: item.edicionId || id,
        ts: Number(item.ts || 0)
      });
    });

    Object.entries(panelRecursosCache || {}).forEach(([id, item]) => {
      items.push({
        id,
        tipo: "rh",
        titulo: item.titulo || "Recurso RH",
        temaIndex: Number(item.temaIndex || 0),
        ts: Number(item.ts || 0)
      });
    });
  }

  if (panelFiltros.marcadores) {
    items.push({
      id: "notas_pendiente",
      tipo: "placeholder-notas",
      titulo: "Notas",
      ts: 0
    });
  }

  if (panelFiltros.imagenes) {
    items.push({
      id: "imagenes_pendiente",
      tipo: "placeholder-imagenes",
      titulo: "Imágenes",
      ts: 0
    });
  }

  if (panelFiltros.devocionales) {
    items.push({
      id: "devocionales_pendiente",
      tipo: "placeholder-devocionales",
      titulo: "Devocionales",
      ts: 0
    });
  }

  return items.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
}

function panelRenderFeedMiPanel() {
  const feed = panelAsegurarFeed();
  if (!feed || feed.style.display === "none") return;

  const items = panelFeedItems();

  if (!items.length) {
    feed.innerHTML = `
      <div class="panel-extra-box">
        No hay elementos para mostrar con estos filtros.
      </div>
    `;
    return;
  }

  feed.innerHTML = `
    <div class="panel-feed-wrap">
      ${items.map(panelRenderFeedItem).join("")}
    </div>
  `;
}

function panelRenderFeedItem(item) {
  if (item.tipo === "edicion") {
    return `
      <article class="panel-feed-post">
        <div class="panel-feed-head">
          <div class="panel-feed-avatar">
            <i class="fa-solid fa-icons"></i>
          </div>

          <div>
            <div class="panel-feed-title">${mpEscape(item.titulo)}</div>
            <div class="panel-feed-meta">Edición guardada</div>
          </div>
        </div>

        <div class="panel-feed-media" onclick="abrirPresentacionEdicion('${item.edicionId}')">
          ${item.portadaUrl ? `<img src="${mpEscape(item.portadaUrl)}" alt="${mpEscape(item.titulo)}" loading="lazy">` : ``}
        </div>

        <div class="panel-feed-actions">
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
      </article>
    `;
  }

  if (item.tipo === "rh") {
    return `
      <article class="panel-feed-post">
        <div class="panel-feed-head">
          <div class="panel-feed-avatar">
            <i class="fa-solid fa-shield-heart"></i>
          </div>

          <div>
            <div class="panel-feed-title">${mpEscape(item.titulo)}</div>
            <div class="panel-feed-meta">Recurso RH guardado</div>
          </div>
        </div>

        <div class="panel-feed-rh" onclick="abrirRHCompartido(${Number(item.temaIndex || 0)})">
          <i class="fa-solid fa-file-lines"></i>
          <span>Abrir recurso</span>
        </div>

        <div class="panel-feed-actions">
          <button type="button" onclick="abrirRHCompartido(${Number(item.temaIndex || 0)})" title="Abrir">
            <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
          </button>

          <button type="button" onclick="descargarRHPDF(${Number(item.temaIndex || 0)})" title="Descargar PDF">
            <i class="fa-solid fa-file-pdf"></i>
          </button>
        </div>
      </article>
    `;
  }

  if (item.tipo === "placeholder-notas") {
    return `
      <article class="panel-feed-post panel-feed-placeholder">
        <i class="fa-solid fa-bookmark"></i>
        <b>Notas</b>
        <span>Las conectamos al feed cuando integremos las notas existentes.</span>
      </article>
    `;
  }

  if (item.tipo === "placeholder-imagenes") {
    return `
      <article class="panel-feed-post panel-feed-placeholder">
        <i class="fa-solid fa-image"></i>
        <b>Imágenes</b>
        <span>Las imágenes ya mantienen su galería cuando están solas. Luego las sumamos al feed mixto.</span>
      </article>
    `;
  }

  if (item.tipo === "placeholder-devocionales") {
    return `
      <article class="panel-feed-post panel-feed-placeholder">
        <i class="fa-solid fa-calendar-days"></i>
        <b>Devocionales</b>
        <span>En el próximo paso conectamos la imagen final del devocional a Mi Panel.</span>
      </article>
    `;
  }

  return "";
}

setTimeout(() => {
  panelAplicarFiltros();
}, 1200);
