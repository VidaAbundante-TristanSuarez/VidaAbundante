import {
  ref,
  onValue
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

let compartidosDevocionalesCache = [];
let compartidosSubidosCache = [];

let compartidosDevocionalesEscuchaActiva = false;
let compartidosSubidosEscuchaActiva = false;

const COMP_BANNER_URL = "img/compartidos/banner-horarios.png?v=2026-05-08";

const COMP_PROMOS = [
  "img/compartidos/promo-1.png?v=2026-05-08",
  "img/compartidos/promo-2.png?v=2026-05-08",
  "img/compartidos/promo-3.png?v=2026-05-08",
  "img/compartidos/promo-4.png?v=2026-05-08",
  "img/compartidos/promo-5.png?v=2026-05-08",
  "img/compartidos/promo-6.png?v=2026-05-08"
];

let compartidosDescargadosCache = {};
let compartidosDescargadosEscuchaActiva = false;
let compartidosDescargadosUid = null;

function comp$(id) {
  return document.getElementById(id);
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

function compTs(item) {
  return Number(
    item?.ts ||
    item?.fecha ||
    item?.publicadoEn ||
    item?.creadoEn ||
    item?.actualizado ||
    0
  );
}

function compTipoDesdeGrupo(grupo) {
  if (grupo === "imagenes") return "imagen";
  if (grupo === "notas") return "nota";
  if (grupo === "ediciones") return "edicion";
  if (grupo === "devocionales") return "devocional";
  if (grupo === "subidos") return "subido";
  if (grupo === "rh") return "rh";
  return grupo || "publicacion";
}

function compFlattenCompartidos(val = {}) {
  const out = [];

  Object.entries(val || {}).forEach(([id, data]) => {
    if (!data || typeof data !== "object") return;

    // ✅ caso viejo: compartidos/{id} directo con tipo
    if (data.tipo) {
      out.push({
        id,
        _compId: id,
        _origen: "compartidos",
        ...(data || {})
      });
      return;
    }

    // ✅ caso nuevo: compartidos/imagenes/{id}, compartidos/notas/{id}, etc.
    const grupo = id;
    Object.entries(data || {}).forEach(([subId, item]) => {
      if (!item || typeof item !== "object") return;

      out.push({
        id: `${grupo}_${subId}`,
        _compId: subId,
        _grupo: grupo,
        _origen: `compartidos/${grupo}`,
        tipo: item.tipo || compTipoDesdeGrupo(grupo),
        ts: compTs(item) || Number(subId) || Date.now(),
        ...(item || {})
      });
    });
  });

  return out;
}

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
    const imgs = COMP_PROMOS.filter(Boolean);

    if (!imgs.length) {
      promos.innerHTML = "";
      return;
    }

    promos.innerHTML = `
      <div class="comp-promos-wrap" aria-label="Anuncios">
        <div class="comp-promos-group comp-promos-a">
          ${imgs.slice(0, 3).map((src, i) => `
            <img src="${compEscape(src)}" alt="Anuncio ${i + 1}" loading="lazy">
          `).join("")}
        </div>

        <div class="comp-promos-group comp-promos-b">
          ${imgs.slice(3, 6).map((src, i) => `
            <img src="${compEscape(src)}" alt="Anuncio ${i + 4}" loading="lazy">
          `).join("")}
        </div>
      </div>
    `;
  }
}

async function compEsperarDB(intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    if (compDB()) return compDB();
    await new Promise(r => setTimeout(r, 250));
  }

  return null;
}

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
  <div id="compFeedWrap">
    <div id="compHero"></div>
    <div id="compPromos"></div>
    <div id="compLista"></div>
  </div>
`;

    compartidosIniciado = true;
    renderCompartidosTop();
  }

iniciarEscuchaCompartidos();
iniciarEscuchaCompartidosStats();
iniciarEscuchaCompartidosGuardados();
iniciarEscuchaCompartidosDescargados();
iniciarEscuchaCompartidosDevocionales();
iniciarEscuchaCompartidosSubidos();
};

function iniciarEscuchaCompartidos() {
  if (compartidosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "compartidos"), (snap) => {
    const val = snap.val() || {};

    compartidosCache = compFlattenCompartidos(val);

    compartidosCache.sort((a, b) => compTs(b) - compTs(a));

    renderCompartidos();
  }, (err) => {
    console.error("Error leyendo compartidos:", err);
  });

  compartidosEscuchaActiva = true;
}

function iniciarEscuchaCompartidosDevocionales() {
  if (compartidosDevocionalesEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "devocionalesIglesia"), (snap) => {
    const val = snap.val() || {};

    compartidosDevocionalesCache = Object.entries(val || {}).map(([id, item]) => ({
      id: `dev_${id}`,
      _compId: id,
      _origen: "devocionalesIglesia",
      tipo: "devocional",
      ts: compTs(item) || Number(id) || 0,
      ...(item || {})
    }));

    renderCompartidos();
  });

  compartidosDevocionalesEscuchaActiva = true;
}

function iniciarEscuchaCompartidosSubidos() {
  if (compartidosSubidosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "subidosIglesia"), (snap) => {
    const val = snap.val() || {};

    compartidosSubidosCache = Object.entries(val || {}).map(([id, item]) => ({
      id: `sub_${id}`,
      _compId: id,
      _origen: "subidosIglesia",
      tipo: "subido",
      ts: compTs(item) || Number(id) || 0,
      ...(item || {})
    }));

    renderCompartidos();
  });

  compartidosSubidosEscuchaActiva = true;
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

function compStats(edicionId) {
  const s = compartidosStatsCache?.[edicionId] || window.__EDICIONES_STATS?.[edicionId] || {};

  return {
    guardados: Number(s.guardados || 0),
    descargas: Number(s.descargas || 0),
    compartidos: Number(s.compartidos || 0)
  };
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

window.renderCompartidos = function renderCompartidos() {
  const lista = comp$("compLista");
  if (!lista) return;

  const items = compUnificarItemsCompartidos();

  if (!items.length) {
    lista.innerHTML = `
      <div id="compVacio">
        Todavía no hay publicaciones compartidas.
      </div>
    `;
    return;
  }

  lista.innerHTML = items.map(item => renderCompItem(item)).join("");
};

function compUnificarItemsCompartidos() {
  const todos = [
    ...(compartidosCache || []),
    ...(compartidosDevocionalesCache || []),
    ...(compartidosSubidosCache || [])
  ];

  const vistos = new Set();

  return todos
    .filter(item => {
      const tipo = item?.tipo || "";
      return [
        "edicion",
        "rh",
        "imagen",
        "nota",
        "devocional",
        "subido"
      ].includes(tipo);
    })
    .filter(item => {
      const clave = item?.url || item?.imagenUrl || item?.archivoUrl || item?._origen + "_" + item?._compId;
      if (!clave) return true;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .sort((a, b) => compTs(b) - compTs(a));
}

function compItemTitulo(item) {
  const tipo = item?.tipo || "";

  if (item?.titulo) return item.titulo;
  if (item?.title) return item.title;
  if (item?.cita) return item.cita;
  if (item?.ref) return item.ref;
  if (item?.etiqueta) return item.etiqueta;

  if (tipo === "devocional") return "Devocional";
  if (tipo === "subido") return "Subido";
  if (tipo === "imagen") return "Imagen compartida";
  if (tipo === "nota") return "Nota compartida";

  return "Compartido";
}

function compItemMeta(item) {
  const tipo = item?.tipo || "";

  if (tipo === "edicion") return "Edición compartida";
  if (tipo === "rh") return "Recurso RH compartido";
  if (tipo === "imagen") return "Imagen compartida";
  if (tipo === "nota") return "Nota compartida";
  if (tipo === "devocional") return "Devocional del día";
  if (tipo === "subido") return item?.etiqueta ? `Subido · ${item.etiqueta}` : "Subido";

  return "Publicación";
}

function compItemIcon(item) {
  const tipo = item?.tipo || "";

  if (tipo === "edicion") return "fa-solid fa-icons";
  if (tipo === "rh") return "fa-solid fa-shield-heart";
  if (tipo === "imagen") return "fa-solid fa-image";
  if (tipo === "nota") return "fa-solid fa-comment-dots";
  if (tipo === "devocional") return "fa-solid fa-book-bible";
  if (tipo === "subido") return "fa-solid fa-cloud-arrow-up";

  return "fa-solid fa-heart";
}

function compItemUrl(item) {
  return (
    item?.url ||
    item?.imagenUrl ||
    item?.imageUrl ||
    item?.portadaUrl ||
    item?.archivoUrl ||
    item?.fileUrl ||
    item?.downloadUrl ||
    item?.cardUrl ||
    item?.shareUrl ||
    ""
  );
}

function compEsVideo(url = "", item = {}) {
  const u = String(url || "").toLowerCase();
  const mime = String(item?.mimeType || item?.contentType || "").toLowerCase();

  return (
    mime.startsWith("video/") ||
    u.includes(".mp4") ||
    u.includes(".webm") ||
    u.includes(".mov")
  );
}

function compEsImagen(url = "", item = {}) {
  const u = String(url || "").toLowerCase();
  const mime = String(item?.mimeType || item?.contentType || "").toLowerCase();

  return (
    mime.startsWith("image/") ||
    u.includes(".png") ||
    u.includes(".jpg") ||
    u.includes(".jpeg") ||
    u.includes(".webp")
  );
}

function compTextoNota(item) {
  return (
    item?.nota ||
    item?.texto ||
    item?.textoLibre ||
    item?.descripcion ||
    item?.pedido ||
    item?.contenido ||
    ""
  );
}

function renderCompMedia(item) {
  const url = compItemUrl(item);
  const titulo = compEscape(compItemTitulo(item));

  if (!url) {
    const texto = compTextoNota(item);

    return texto ? `
      <div class="comp-post-note">
        ${compEscape(texto)}
      </div>
    ` : `
      <div class="comp-post-rh">
        <i class="${compItemIcon(item)}"></i>
        <span>${titulo}</span>
      </div>
    `;
  }

  if (compEsVideo(url, item)) {
    return `
      <div class="comp-post-media comp-post-video">
        <video controls preload="metadata">
          <source src="${compEscape(url)}">
        </video>
      </div>
    `;
  }

  if (compEsImagen(url, item)) {
    return `
      <div class="comp-post-media">
        <img src="${compEscape(url)}" alt="${titulo}" loading="lazy">
      </div>
    `;
  }

  return `
    <div class="comp-post-file" onclick="window.open('${compEscape(url)}', '_blank')" role="button">
      <i class="fa-solid fa-file-arrow-down"></i>
      <span>Abrir archivo</span>
    </div>
  `;
}

function renderCompItem(item) {
  const tipo = item?.tipo || "";
  const titulo = compEscape(compItemTitulo(item));
  const meta = compEscape(compItemMeta(item));

  if (tipo === "rh") {
    return `
      <article class="comp-post">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="${compItemIcon(item)}"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">${meta}</div>
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
        </div>
      </article>
    `;
  }

  if (tipo === "edicion") {
    const portada = item.portadaUrl || "";
    const edicionId = item.edicionId;
    const st = compStats(edicionId);
    const guardada = compEstaGuardada(edicionId);

    return `
      <article class="comp-post">
        <div class="comp-post-head">
          <div class="comp-avatar">
            <i class="${compItemIcon(item)}"></i>
          </div>

          <div>
            <div class="comp-post-title">${titulo}</div>
            <div class="comp-post-meta">${meta}</div>
          </div>
        </div>

        <div class="comp-post-media" onclick="abrirPresentacionEdicion('${edicionId}')" role="button" title="Abrir edición">
          ${portada ? `<img src="${compEscape(portada)}" alt="${titulo}" loading="lazy">` : `<span>Sin portada</span>`}
        </div>

        <div class="comp-post-actions">
          ${compActionButton({
            title: guardada ? "Guardado en Mi Panel" : "Guardar en Mi Panel",
            onclick: `guardarEdicionEnMiPanel('${edicionId}')`,
            icon: guardada ? "fa-solid fa-heart-circle-check" : "fa-solid fa-heart-circle-plus",
            count: st.guardados,
            saved: guardada
          })}

          ${compActionButton({
            title: compEstaDescargada(edicionId) ? "PDF descargado" : "Descargar PDF",
            onclick: `descargarEdicionPDF('${edicionId}')`,
            icon: compEstaDescargada(edicionId) ? "fa-solid fa-file-circle-check" : "fa-solid fa-file-pdf",
            count: st.descargas,
            saved: compEstaDescargada(edicionId)
          })}

          ${compActionButton({
            title: "Compartir",
            onclick: `compartirEdicion('${edicionId}', 'redes')`,
            icon: "fa-solid fa-share-nodes",
            count: st.compartidos
          })}
        </div>
      </article>
    `;
  }

  const audioUrl = item?.audioGithubUrl || item?.audioUrl || "";

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="${compItemIcon(item)}"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">${meta}</div>
        </div>
      </div>

      ${renderCompMedia(item)}

      ${audioUrl ? `
        <div class="comp-audio">
          <audio controls preload="metadata">
            <source src="${compEscape(audioUrl)}" type="audio/mpeg">
          </audio>
        </div>
      ` : ``}
    </article>
  `;
}

setTimeout(() => {
  mostrarCompartidos();
}, 1200);
