import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= MI PANEL EXTRAS DEFINITIVO =================
   - Imágenes y devocionales: panelImagenesPersonal/uid
   - Compartidos guardados: panelEdiciones/uid
   - Recursos guardados: panelRecursos/uid
   - Notas: marcadores/uid
============================================================== */

let panelFiltros = {
  imagenes: true,
  devocionales: false,
  marcadores: false,
  compartidos: false
};

let panelUidActual = null;

let panelImagenesCache = {};
let panelMarcadoresCache = {};
let panelEdicionesCache = {};
let panelRecursosCache = {};

let panelEscuchasActivas = false;

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

function mpFecha(ts) {
  if (!ts) return "";
  try {
    return new Date(Number(ts)).toLocaleDateString("es-AR");
  } catch (_) {
    return "";
  }
}

function mpEsDevocional(item = {}) {
  const origen = String(item.origen || "").toLowerCase();
  const tipo = String(item.tipoTexto || "").toLowerCase();

  return (
    tipo === "devocional" ||
    origen.includes("devocional")
  );
}

function mpTituloImagen(item = {}) {
  if (mpEsDevocional(item)) {
    return item.cita || item.versiculo || "Devocional";
  }

  if (item.libro && item.capitulo) {
    return `${item.libro} ${item.capitulo}`;
  }

  return item.titulo || "Imagen";
}

function mpTs(item = {}) {
  return Number(item.ts || item.fecha || item.actualizado || item.creado || 0);
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

function panelAsegurarHost(id) {
  let el = mp$(id);

  if (!el) {
    el = document.createElement("div");
    el.id = id;

    const panel = mp$("seccion-panel");
    if (panel) panel.appendChild(el);
  }

  return el;
}

function panelOcultarSeccionesOriginales() {
  ["panel-imagenes", "panel-marcadores", "panel-devocionales", "panel-compartidos"].forEach(id => {
    const el = mp$(id);
    if (el) el.style.display = "none";
  });
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

  const btnNuevoImg = mp$("btnPanelImgNuevo");
  if (btnNuevoImg) {
    btnNuevoImg.style.display = window.__ES_ADMIN ? "inline-flex" : "none";
  }
}

function panelIniciarEscuchas() {
  const uid = mpUid();
  const db = mpDB();

  if (!uid || !db) return;

  if (panelEscuchasActivas && panelUidActual === uid) return;

  panelUidActual = uid;
  panelEscuchasActivas = true;

  onValue(ref(db, `panelImagenesPersonal/${uid}`), (snap) => {
    panelImagenesCache = snap.val() || {};
    panelAplicarFiltros();
  });

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    panelEdicionesCache = snap.val() || {};
    panelAplicarFiltros();
  });

  onValue(ref(db, `panelRecursos/${uid}`), (snap) => {
    panelRecursosCache = snap.val() || {};
    panelAplicarFiltros();
  });

  onValue(ref(db, `marcadores/${uid}`), (snap) => {
    panelMarcadoresCache = snap.val() || {};
    panelAplicarFiltros();
  });
}

function panelAplicarFiltros() {
  panelIniciarEscuchas();
  panelRefrescarBotones();

  const uid = mpUid();

  panelOcultarSeccionesOriginales();

  const galeria = panelAsegurarHost("panel-mi-galeria");
  const feed = panelAsegurarHost("panel-mi-feed");

  if (!uid) {
    galeria.style.display = "none";
    feed.style.display = "block";
    feed.innerHTML = `
      <div class="panel-extra-box">
        Iniciá sesión para ver tu Mi Panel.
      </div>
    `;
    return;
  }

  if (panelEsModoGaleria()) {
    feed.style.display = "none";
    galeria.style.display = "block";
    panelRenderGaleria();
  } else {
    galeria.style.display = "none";
    feed.style.display = "block";
    panelRenderFeedMiPanel();
  }
}

function panelImagenesFiltradasParaGaleria() {
  const arr = Object.entries(panelImagenesCache || {}).map(([id, item]) => ({
    id,
    ...(item || {})
  }));

  return arr.filter(item => {
    const esDev = mpEsDevocional(item);

    if (panelFiltros.imagenes && panelFiltros.devocionales) return true;
    if (panelFiltros.imagenes && !esDev) return true;
    if (panelFiltros.devocionales && esDev) return true;

    return false;
  }).sort((a, b) => mpTs(b) - mpTs(a));
}

function panelRenderGaleria() {
  const galeria = mp$("panel-mi-galeria");
  if (!galeria) return;

  const items = panelImagenesFiltradasParaGaleria();

  if (!items.length) {
    galeria.innerHTML = `
      <div class="panel-extra-box">
        Todavía no hay ${panelFiltros.devocionales && !panelFiltros.imagenes ? "devocionales" : "imágenes"} guardadas.
      </div>
    `;
    return;
  }

  galeria.innerHTML = `
    <div id="panelMiIndexRow">
      ${window.__ES_ADMIN && panelFiltros.imagenes ? `
        <button
          type="button"
          class="btn-primary panel-mi-add"
          onclick="event.preventDefault(); event.stopPropagation(); abrirCrearImagenLibrePanel(); return false;"
          title="Crear imagen">
          <i class="fa-solid fa-circle-plus"></i>
        </button>
      ` : ``}

      ${items.map(it => {
        const titulo = mpEscape(mpTituloImagen(it));
        const fecha = mpFecha(mpTs(it));
        const url = mpEscape(it.url || "");

        return `
          <div class="devIndexCard" onclick="document.getElementById('panelMiBig_${it.id}')?.scrollIntoView({behavior:'smooth', block:'start'})">
            <div class="devIndexBar devIndexBarTop">${titulo}</div>
            <div class="devIndexImgWrap">
              <img src="${url}" loading="lazy">
            </div>
            <div class="devIndexBar devIndexBarBottom">${fecha}</div>
          </div>
        `;
      }).join("")}
    </div>

    <div id="panelMiFeed">
      ${items.map(it => {
        const titulo = mpEscape(mpTituloImagen(it));
        const fecha = mpFecha(mpTs(it));
        const url = mpEscape(it.url || "");
        const esDev = mpEsDevocional(it);

        return `
          <article class="devBigCard" id="panelMiBig_${it.id}">
            <img src="${url}" loading="lazy" alt="${titulo}">

            <div class="devBigActions">
              <button type="button" class="btn-ghost" onclick="window.open('${url}', '_blank')" title="Abrir">
                <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
              </button>

              <button type="button" class="btn-ghost" onclick="mpCompartirImagen('${it.id}')" title="Compartir">
                <i class="fa-solid fa-share-nodes"></i>
              </button>
            </div>

            <div class="panel-mi-caption">
              <b>${titulo}</b>
              <span>${esDev ? "Devocional" : "Imagen"} · ${fecha}</span>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function panelFeedItems() {
  const items = [];

  if (panelFiltros.imagenes || panelFiltros.devocionales) {
    Object.entries(panelImagenesCache || {}).forEach(([id, item]) => {
      const it = { id, ...(item || {}) };
      const esDev = mpEsDevocional(it);

      if (panelFiltros.imagenes && !esDev) {
        items.push({
          id,
          tipo: "imagen",
          titulo: mpTituloImagen(it),
          url: it.url || "",
          ts: mpTs(it)
        });
      }

      if (panelFiltros.devocionales && esDev) {
        items.push({
          id,
          tipo: "devocional",
          titulo: mpTituloImagen(it),
          url: it.url || "",
          texto: it.textoLibre || it.texto || "",
          audioOk: !!it.audioOk,
          audioGithubUrl: it.audioGithubUrl || "",
          ts: mpTs(it)
        });
      }
    });
  }

  if (panelFiltros.compartidos) {
    Object.entries(panelEdicionesCache || {}).forEach(([id, item]) => {
      items.push({
        id,
        tipo: "edicion",
        titulo: item.titulo || "Edición",
        portadaUrl: item.portadaUrl || "",
        edicionId: item.edicionId || id,
        ts: mpTs(item)
      });
    });

    Object.entries(panelRecursosCache || {}).forEach(([id, item]) => {
      items.push({
        id,
        tipo: "rh",
        titulo: item.titulo || "Recurso RH",
        temaIndex: Number(item.temaIndex || 0),
        ts: mpTs(item)
      });
    });
  }

  if (panelFiltros.marcadores) {
    Object.entries(panelMarcadoresCache || {}).forEach(([id, m]) => {
      if (!m?.nota || !String(m.nota).trim()) return;

      const refTxt = m.origen === "abc"
        ? "Nota ABC"
        : `${m.libro || ""} ${m.capitulo || ""}`.trim() || "Nota";

      items.push({
        id,
        tipo: "nota",
        titulo: m.titulo || refTxt,
        nota: m.nota || "",
        referencia: refTxt,
        color: m.color || "",
        ts: mpTs(m)
      });
    });
  }

  return items.sort((a, b) => mpTs(b) - mpTs(a));
}

function panelRenderFeedMiPanel() {
  const feed = mp$("panel-mi-feed");
  if (!feed) return;

  const items = panelFeedItems();

  if (!items.length) {
    feed.innerHTML = `
      <div class="panel-extra-box">
        Todavía no hay elementos guardados para mostrar acá.
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
  if (item.tipo === "imagen" || item.tipo === "devocional") {
    const titulo = mpEscape(item.titulo || (item.tipo === "devocional" ? "Devocional" : "Imagen"));
    const url = mpEscape(item.url || "");

    return `
      <article class="panel-feed-post">
        <div class="panel-feed-head">
          <div class="panel-feed-avatar">
            <i class="fa-solid ${item.tipo === "devocional" ? "fa-calendar-days" : "fa-image"}"></i>
          </div>

          <div>
            <div class="panel-feed-title">${titulo}</div>
            <div class="panel-feed-meta">${item.tipo === "devocional" ? "Devocional guardado" : "Imagen guardada"}</div>
          </div>
        </div>

        <div class="panel-feed-media">
          <img src="${url}" loading="lazy" alt="${titulo}">
        </div>

        ${item.audioGithubUrl ? `
          <div class="panel-feed-audio">
            <audio controls preload="metadata" src="${mpEscape(item.audioGithubUrl)}"></audio>
          </div>
        ` : ``}

        <div class="panel-feed-actions">
          <button type="button" onclick="window.open('${url}', '_blank')" title="Abrir">
            <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
          </button>

          <button type="button" onclick="mpCompartirImagen('${item.id}')" title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        </div>
      </article>
    `;
  }

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

  if (item.tipo === "nota") {
    return `
      <article class="panel-feed-post panel-feed-note">
        <div class="panel-feed-head">
          <div class="panel-feed-avatar">
            <i class="fa-solid fa-bookmark"></i>
          </div>

          <div>
            <div class="panel-feed-title">${mpEscape(item.titulo)}</div>
            <div class="panel-feed-meta">${mpEscape(item.referencia || "Nota")}</div>
          </div>
        </div>

        <div class="panel-feed-note-body">
          ${mpEscape(item.nota)}
        </div>
      </article>
    `;
  }

  return "";
}

window.mpCompartirImagen = async (id) => {
  const item = panelImagenesCache?.[id];
  if (!item?.url) return;

  const title = mpTituloImagen(item);
  const url = item.url;

  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text: title,
        url
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copiado.");
    } else {
      prompt("Copiá este link:", url);
    }
  } catch (_) {}
};

setTimeout(() => {
  panelAplicarFiltros();
}, 1200);
