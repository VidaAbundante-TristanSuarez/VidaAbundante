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

let compartidosDescargadosCache = {};
let compartidosDescargadosEscuchaActiva = false;
let compartidosDescargadosUid = null;

let compartidosDevocionalesCache = [];
let compartidosDevocionalesEscuchaActiva = false;

let compartidosSubidosCache = [];
let compartidosSubidosEscuchaActiva = false;

let compartidosOracionesCache = {};
let compartidosOracionesEscuchaActiva = false;

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
    </div>
  `;

  document.body.appendChild(div);
}

window.compAbrirMedia = function compAbrirMedia(url, tipo = "imagen") {
  compAsegurarVisor();

  const modal = document.getElementById("compMediaViewer");
  const body = document.getElementById("compMediaViewerBody");
  if (!modal || !body) return;

  if (tipo === "video") {
    body.innerHTML = `
      <video controls playsinline style="width:100%; max-height:80vh; border-radius:16px; background:#000;">
        <source src="${compEscape(url)}">
      </video>
    `;
  } else {
    body.innerHTML = `
      <img src="${compEscape(url)}" alt="Vista previa" style="width:100%; max-height:80vh; object-fit:contain; display:block; border-radius:16px; background:#fff;">
    `;
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
      <div id="compFeedWrap">
        <div id="compHero"></div>
        <div id="compPromos"></div>
        <div id="compLista"></div>
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
      <div class="comp-promos-viewport">
        <div class="comp-promos-slider">
          <div class="comp-promos-page">
            ${COMP_PROMOS.slice(0, 3).map((src, i) => `
              <img src="${compEscape(src)}" alt="Promo ${i + 1}" loading="lazy">
            `).join("")}
          </div>

          <div class="comp-promos-page">
            ${COMP_PROMOS.slice(3, 6).map((src, i) => `
              <img src="${compEscape(src)}" alt="Promo ${i + 4}" loading="lazy">
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }
}

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
    const val = snap.val() || {};
    compartidosCache = compFlattenCompartidos(val);
    renderCompartidos();
  }, (err) => {
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

  onValue(ref(db, "devocionalesOraciones"), (snap) => {
    compartidosOracionesCache = snap.val() || {};
    renderCompartidos();
  });

  compartidosOracionesEscuchaActiva = true;
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

function compRenderImagen(item) {
  const url = item.url || item.imagenUrl || "";
  const titulo = compEscape(compItemTitulo(item));
  const textoLibre = String(item.textoLibre || "").trim();

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-image"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Imagen compartida</div>
        </div>
      </div>

      <div class="comp-post-media" onclick="compAbrirMedia('${compJs(url)}', 'imagen')" role="button">
        ${url
          ? `<img src="${compEscape(url)}" alt="${titulo}" loading="lazy">`
          : `<div class="comp-post-empty">Sin imagen</div>`
        }
      </div>

      ${textoLibre ? `<div class="comp-post-note-text">${compEscape(textoLibre)}</div>` : ``}

      <div class="comp-post-actions">
        <button type="button" onclick="descargarImagenPanel('${compJs(url)}', '${compJs(compFileName(url, "imagen_vida_abundante.png"))}')" title="Descargar">
          <i class="fa-solid fa-download"></i>
        </button>

        <button type="button" onclick="compartirImagenPanel('${compJs(url)}', '${compJs(compFileName(url, "imagen_vida_abundante.png"))}')" title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>
      </div>
    </article>
  `;
}

function compRenderNota(item) {
  const titulo = compEscape(compItemTitulo(item));
  const texto = compEscape(item.texto || item.nota || item.textoLibre || "");

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-comment-dots"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Nota compartida</div>
        </div>
      </div>

      <div class="comp-post-note-block">${texto}</div>
    </article>
  `;
}

function compRenderDevocional(item) {
  const titulo = compEscape(compItemTitulo(item));
  const url = item.url || "";
  const audioUrl = item.audioGithubUrl || item.audioUrl || "";
  const oraciones = compDevOracionesVisibles(item.uidOwner, item.tsKey);
  const fileName = compFileName(url, "devocional.png");

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-book-bible"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Devocional · ${compEscape(compItemFecha(item))}</div>
        </div>
      </div>

      <div class="comp-post-media" onclick="compAbrirMedia('${compJs(url)}', 'imagen')" role="button">
        ${url
          ? `<img src="${compEscape(url)}" alt="${titulo}" loading="lazy">`
          : `<div class="comp-post-empty">Sin imagen</div>`
        }
      </div>

      ${audioUrl ? `
        <div class="comp-audio-wrap">
          <audio controls preload="metadata" style="width:100%;">
            <source src="${compEscape(audioUrl)}" type="audio/mpeg">
          </audio>
        </div>
      ` : ``}

      ${oraciones.length ? `
        <div class="comp-dev-oraciones-wrap">
          <div class="comp-dev-oraciones-titulo">🙏 Oraciones</div>
          <div class="comp-dev-oraciones-lista">
            ${oraciones.map(o => {
              const fondo = o.color || "#f5f5f5";
              const autor = (compUidActual() && o.autorUid === compUidActual()) ? "Tú" : "Anónimo";
              const fechaTxt = o.fecha
                ? new Date(o.fecha).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"2-digit" })
                : "";

              return `
                <div class="comp-dev-oracion" style="background:${compEscape(fondo)};">
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
      ` : ``}

      <div class="comp-post-actions">
        <button type="button"
          onclick="devCompartirImagenItem('${compJs(url)}', '${compJs(fileName)}')"
          title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button"
          onclick="devDescargarDevocionalItem('${compJs(url)}', '${compJs(fileName)}', '${compJs(audioUrl)}', 'Audio_devocional')"
          title="Descargar">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    </article>
  `;
}

function compRenderPredicaPreview(item) {
  const intro = String(item.predicaIntroduccion || item.introduccionPredica || "").trim();
  const notaFinal = String(item.predicaNotaFinal || item.notaFinalGeneral || "").trim();
  const citas = Array.isArray(item.predicaCitas) ? item.predicaCitas.slice(0, 4) : [];

  return `
    <div class="comp-predica-card" onclick="abrirSubidosVisorPredica('${compJs(item._subidoId || "")}', 'all')" role="button">
      ${intro ? `<div class="comp-predica-intro">${compEscape(intro)}</div>` : ``}

      <div class="comp-predica-citas">
        ${citas.map(c => `
          <div class="comp-predica-cita">
            <div class="comp-predica-ref">${compEscape(c.referencia || "")}</div>
            ${c.texto ? `<div class="comp-predica-texto">${compEscape(c.texto)}</div>` : ``}
            ${c.comentario ? `<div class="comp-predica-comentario">⪦ ${compEscape(c.comentario)}</div>` : ``}
          </div>
        `).join("")}
      </div>

      ${notaFinal ? `<div class="comp-predica-final">${compEscape(notaFinal)}</div>` : ``}
    </div>
  `;
}

function compRenderSubido(item) {
  const titulo = compEscape(compItemTitulo(item));
  const fechaTxt = item.fechaEvento
    ? new Date(item.fechaEvento + "T00:00:00").toLocaleDateString("es-AR")
    : compItemFecha(item);

  const url = item.url || "";
  const esPredica = compEsPredica(item);
  const esVideo = compEsVideoUrl(url, item.mimeType || "");
  const esImagen = compEsImageUrl(url, item.mimeType || "");

  return `
    <article class="comp-post">
      <div class="comp-post-head">
        <div class="comp-avatar">
          <i class="fa-solid fa-cloud-arrow-up"></i>
        </div>

        <div>
          <div class="comp-post-title">${titulo}</div>
          <div class="comp-post-meta">Subido · ${compEscape(item.etiqueta || "Subido")} · ${compEscape(fechaTxt || "")}</div>
        </div>
      </div>

      ${
        esPredica
          ? compRenderPredicaPreview(item)
          : (
            esImagen
              ? `
                <div class="comp-post-media" onclick="abrirSubidosVisorArchivo('${compJs(item._subidoId || "")}')" role="button">
                  <img src="${compEscape(url)}" alt="${titulo}" loading="lazy">
                </div>
              `
              : esVideo
                ? `
                  <div class="comp-post-video" onclick="abrirSubidosVisorArchivo('${compJs(item._subidoId || "")}')" role="button">
                    <video preload="metadata" muted playsinline>
                      <source src="${compEscape(url)}">
                    </video>
                  </div>
                `
                : `
                  <div class="comp-post-file" onclick="abrirSubidosVisorArchivo('${compJs(item._subidoId || "")}')" role="button">
                    <i class="fa-solid fa-file-arrow-down"></i>
                    <span>Abrir archivo</span>
                  </div>
                `
          )
      }

      <div class="comp-post-actions">
        <button type="button" onclick="compartirSubido('${compJs(item._subidoId || "")}')" title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button" onclick="descargarSubido('${compJs(item._subidoId || "")}')" title="Descargar">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
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
};

setTimeout(() => {
  mostrarCompartidos();
}, 1200);
