import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= COMPARTIDOS ================= */

let compartidosIniciado = false;
let compartidosEscuchaActiva = false;
let compartidosCache = [];

function comp$(id) {
  return document.getElementById(id);
}

function compDB() {
  return window.__FB?.db || null;
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
      <div id="compWrap">
        <div id="compTop">
          <h3>Compartidos</h3>
        </div>

        <div id="compLista"></div>
      </div>
    `;

    compartidosIniciado = true;
  }

  iniciarEscuchaCompartidos();
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

function renderCompartidos() {
  const lista = comp$("compLista");
  if (!lista) return;

  const items = compartidosCache.filter(x => x.tipo === "edicion");

  if (!items.length) {
    lista.innerHTML = `
      <div id="compVacio">
        Todavía no hay ediciones compartidas.
      </div>
    `;
    return;
  }

  lista.innerHTML = items.map(item => {
    const titulo = compEscape(item.titulo || "Edición");
    const portada = item.portadaUrl || "";

    return `
      <article class="comp-card">
        <div class="comp-cover" onclick="abrirPresentacionEdicion('${item.edicionId}')" role="button">
          ${portada ? `<img src="${compEscape(portada)}" alt="${titulo}" loading="lazy">` : `<span>Sin portada</span>`}
        </div>

        <div class="comp-body">
          <div class="comp-title">${titulo}</div>

          <div class="comp-actions">


            <button type="button" onclick="descargarEdicionPDF('${item.edicionId}')">
              <i class="fa-solid fa-file-pdf"></i>
            </button>

            <button type="button" onclick="compartirEdicion('${item.edicionId}', 'redes')">
              <i class="fa-solid fa-share-nodes"></i>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

setTimeout(() => {
  mostrarCompartidos();
}, 1200);
