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
        <div id="compLista"></div>
      </div>
    `;

    compartidosIniciado = true;
  }

  iniciarEscuchaCompartidos();
  iniciarEscuchaCompartidosStats();
  iniciarEscuchaCompartidosGuardados();
  iniciarEscuchaCompartidosDescargados();
};

function iniciarEscuchaCompartidos() {
  if (compartidosEscuchaActiva) return;

  const db = compDB();
  if (!db) return;

  onValue(ref(db, "compartidos"), (snap) => {
    const val = snap.val() || {};

    compartidosCache = Object.entries(val).map(([id, item]) => ({
      id,
      ...(item || {})
    }));

    compartidosCache.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

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

  const items = compartidosCache.filter(x => x.tipo === "edicion" || x.tipo === "rh");

  if (!items.length) {
    lista.innerHTML = `
      <div id="compVacio">
        Todavía no hay publicaciones compartidas.
      </div>
    `;
    return;
  }

  lista.innerHTML = items.map(item => {
    const titulo = compEscape(item.titulo || "Compartido");

    if (item.tipo === "rh") {
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
  }).join("");
};

setTimeout(() => {
  mostrarCompartidos();
}, 1200);
