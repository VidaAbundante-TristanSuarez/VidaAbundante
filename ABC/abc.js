// ================= ABC - MÓDULO =================

// 🔥 Firebase (solo DB funcs). Usamos el db ya inicializado en biblia.js: window.__FB.db
import {
  ref, set, get, remove
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const ABC_TEMAS = [
  { titulo: "INTRO", html: "ABC/INTRO.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2Fintro_abc.mp3?alt=media&token=c51321da-2f7f-4092-b90d-a61df6da671a" },
  { titulo: "SALVACIÓN", html: "ABC/1 Salvación.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F1%20Salvaci%C3%B3n.mp3?alt=media&token=7da0ae0f-da01-4a58-8ae0-5e0a037c8076" },
  { titulo: "PECADO", html: "ABC/2 Pecado.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F2%20Pecado.mp3?alt=media&token=54fe4210-37e9-4cf0-b0bf-c7f0564e881f" },
  { titulo: "LA PALABRA", html: "ABC/3 La Palabra.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F3%20La%20Palabra.mp3?alt=media&token=73fbd70f-e008-47de-b557-28fcd6a5ac36" },
  { titulo: "LA ORACIÓN", html: "ABC/4 La Oración.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F4%20La%20Oraci%C3%B3n.mp3?alt=media&token=096b3b09-6179-4c80-8718-a800954907b3" },
  { titulo: "ESPÍRITU SANTO", html: "ABC/5 Espíritu Santo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F5%20Esp%C3%ADritu%20Santo.mp3?alt=media&token=68ad750b-4449-433f-b7dc-be457879c61f" },
  { titulo: "BAUTISMO", html: "ABC/6 Bautismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F6%20Bautismo.mp3?alt=media&token=e85836f1-9f5d-42be-83de-93797cdf3c22" },
  { titulo: "LA MAYORDOMÍA", html: "ABC/7 La Mayordomía.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F7%20La%20Mayordom%C3%ADa.mp3?alt=media&token=4994a81a-be99-4f39-8bd3-9888df880fcf" },
  { titulo: "EVANGELISMO", html: "ABC/8 Evangelismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F8%20Evangelismo.mp3?alt=media&token=4d197527-1f36-4378-9389-5e248e44533b" },
  { titulo: "VISIÓN DE LA IGLESIA", html: "ABC/9 La visión de la iglesia.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F9%20La%20vision%20de%20la%20iglesia.mp3?alt=media&token=c81cd672-6fd8-46df-b086-e564fed73974" }
];

let abcIndex = 0;
let abcIniciado = false;

let abcFontSize = 18;                 // tamaño texto ABC
let abcColor = "#fff3b0";             // resaltador actual
let abcSelId = null;                 // bloque seleccionado (id)
let cacheResaltados = {};            // { blockId: color }
let cacheNotas = {};                 // { blockId: "texto" }

// ===== helpers Firebase =====
function getUID() { return window.__UID || null; }
function getDB() { return window.__FB?.db || null; }

function pathProgreso(uid) { return `abcProgreso/${uid}`; }
function pathResaltados(uid, temaIndex) { return `abcResaltados/${uid}/${temaIndex}`; }
function pathNotas(uid, temaIndex) { return `abcNotas/${uid}/${temaIndex}`; }

// ✅ Esta es la que debe llamar mostrarIglesiaSub('abc')
window.mostrarABC = async () => {
  const cont = document.getElementById("abcApp");
  if (!cont) return;

  if (!abcIniciado) {
    cont.innerHTML = `
      <style>
        /* ===== ABC UI (local) ===== */
        #abcWrap{
          max-width: 980px;
          margin: 0 auto;
          padding: 10px 12px 90px; /* deja lugar para barra acciones sticky */
        }

        /* en celular: sin márgenes laterales */
        @media (max-width: 560px){
          #abcWrap{ padding: 8px 0 90px; max-width: 100%; }
          #abcContenido{ border-radius: 0; border-left: 0; border-right: 0; }
        }

        #abcTop{
          display:flex;
          align-items:center;
          gap:10px;
          padding: 8px 0 10px;
        }

        /* ✅ Scroll normal PC: forzamos scroll + scrollbar */
        #abcIndice{
          flex:1;
          display:flex;
          gap:8px;
          overflow-x: scroll;     /* <- esto fuerza scrollbar */
          overflow-y: hidden;
          padding: 6px 2px;
          -webkit-overflow-scrolling: touch;
          scrollbar-gutter: stable;
          scroll-snap-type: none; /* sin “snap raro” */
        }
        #abcIndice::-webkit-scrollbar{ height: 10px; }
        #abcIndice::-webkit-scrollbar-thumb{ border-radius: 999px; }
        #abcIndice button{
          border:none;
          cursor:pointer;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(79,111,168,.14);
          color: inherit;
          white-space: nowrap;
          font-weight: 800;
          font-size: 13px;
        }
        #abcIndice button.activo{
          background: #4f6fa8;
          color: #fff;
        }

        #abcNav{
          display:flex;
          gap:8px;
          align-items:center;
          justify-content:flex-end;
          min-width: 86px;
        }
        #abcNav button{
          border:none;
          background: transparent;
          cursor:pointer;
          font-size: 26px;
          padding: 6px;
          line-height: 1;
          color: #4f6fa8;
        }
        #abcNav button:disabled{ opacity:.35; cursor:default; }

        /* ✅ audio fijo (sticky) */
        #abcAudioBar{
          position: sticky;
          top: 0;               /* si molesta con tu header, lo ajustamos */
          z-index: 5;
          background: inherit;
          padding: 8px 0 10px;
        }
        #abcAudio{ width:100%; margin:0; }

        #abcContenido{
          background: #fff;
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 14px;
          padding: 14px;
          overflow:hidden;
        }

        /* modo oscuro (legible) */
        body.oscuro #abcContenido{
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.12);
        }
        body.oscuro #abcDoc{
          color: #f2f2f2 !important;
        }
        /* si el Word trae color:black inline, lo anulamos en oscuro */
        body.oscuro #abcDoc [style*="color"]{
          color: inherit !important;
        }

        /* ===== DOC RESPONSIVE + BULLDOZER ===== */
        #abcDoc{
          width:100%;
          max-width:100%;
          margin:0 !important;
          padding:0 !important;
          overflow-x:hidden;
          font-size: var(--abc-font-size, 18px);
          line-height: 1.55;
        }

        /* mata anchos fijos del Word (595pt, etc) */
        #abcDoc [style*="width"],
        #abcDoc table[width],
        #abcDoc td[width],
        #abcDoc img[width]{
          width: auto !important;
          max-width: 100% !important;
        }
        #abcDoc [style*="margin-left"],
        #abcDoc [style*="margin-right"]{
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        /* todo adentro nunca se pasa del ancho */
        #abcDoc *{
          box-sizing: border-box;
          max-width:100% !important;
        }

        /* imágenes */
        #abcDoc img{
          max-width:100% !important;
          height:auto !important;
        }

        /* tablas */
        #abcDoc table{
          width:100% !important;
          display:block;
          overflow-x:auto;
        }

        /* ===== BLOQUES (resaltado por párrafo) ===== */
        #abcDoc .abc-block{
          padding: 8px 10px;
          border-radius: 12px;
          margin: 6px 0;
          transition: box-shadow .15s ease, outline .15s ease;
        }
        #abcDoc .abc-block.seleccionado{
          outline: 2px solid rgba(79,111,168,.55);
          outline-offset: 2px;
        }

        /* ===== BARRA ACCIONES (tipo Biblia, sticky abajo) ===== */
        #abcAcciones{
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 20;
          padding: 10px 10px;
          background: rgba(255,255,255,.92);
          border-top: 1px solid rgba(0,0,0,.12);
          backdrop-filter: blur(8px);
          display:flex;
          gap:10px;
          align-items:center;
          justify-content:center;
          flex-wrap:wrap;
        }
        body.oscuro #abcAcciones{
          background: rgba(18,18,18,.92);
          border-top-color: rgba(255,255,255,.12);
        }

        .abc-btn{
          border: none;
          border-radius: 999px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 800;
          background: var(--ui-azul-claro, #bcdcff);
          color: #000;
        }
        .abc-btn:active{ transform: scale(.98); }
        .abc-btn-ghost{
          background: rgba(0,0,0,.08);
        }
        body.oscuro .abc-btn-ghost{
          background: rgba(255,255,255,.12);
          color: #fff;
        }

        #abcPaleta{
          display:flex;
          gap:6px;
          align-items:center;
          padding: 6px 8px;
          border-radius: 999px;
          background: rgba(0,0,0,.06);
        }
        body.oscuro #abcPaleta{
          background: rgba(255,255,255,.10);
        }
        #abcPaleta button{
          border:none;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          cursor:pointer;
        }

        /* ===== MODAL NOTA ===== */
        #abcModalNota{
          position: fixed;
          inset: 0;
          z-index: 50;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,.35);
          padding: 14px;
        }
        #abcModalNota .card{
          width: min(520px, 94vw);
          background: #fff;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,.12);
        }
        body.oscuro #abcModalNota .card{
          background: #121212;
          border-color: rgba(255,255,255,.14);
          color: #fff;
        }
        #abcModalNota .head{
          padding: 12px 14px;
          border-bottom: 1px solid rgba(0,0,0,.10);
          display:flex;
          justify-content: space-between;
          align-items:center;
          gap:10px;
          font-weight: 900;
        }
        body.oscuro #abcModalNota .head{
          border-bottom-color: rgba(255,255,255,.12);
        }
        #abcModalNota textarea{
          width: 100%;
          height: 160px;
          border: none;
          outline: none;
          padding: 12px 14px;
          resize: none;
          background: transparent;
          color: inherit;
        }
        #abcModalNota .foot{
          padding: 10px 14px 14px;
          display:flex;
          gap:10px;
          justify-content:flex-end;
        }
      </style>

      <div id="abcWrap">
        <div id="abcTop">
          <div id="abcIndice" aria-label="Índice ABC"></div>

          <div id="abcNav">
            <button id="abcBtnPrev" type="button" title="Anterior" onclick="abcPrev()">
              <i class="fa-solid fa-circle-chevron-left"></i>
            </button>
            <button id="abcBtnNext" type="button" title="Siguiente" onclick="abcNext()">
              <i class="fa-solid fa-circle-chevron-right"></i>
            </button>
          </div>
        </div>

        <div id="abcAudioBar">
          <audio id="abcAudio" controls preload="metadata"></audio>
        </div>

        <div id="abcContenido"></div>
      </div>

      <!-- Barra acciones -->
      <div id="abcAcciones">
        <button class="abc-btn abc-btn-ghost" type="button" onclick="abcLetra(-1)">A−</button>
        <button class="abc-btn abc-btn-ghost" type="button" onclick="abcLetra(1)">A+</button>

        <div id="abcPaleta" title="Resaltador">
          <button type="button" data-color="#ffd6e8" style="background:#ffd6e8"></button>
          <button type="button" data-color="#fff3b0" style="background:#fff3b0"></button>
          <button type="button" data-color="#caffd1" style="background:#caffd1"></button>
          <button type="button" data-color="#ffc9c9" style="background:#ffc9c9"></button>
          <button type="button" data-color="#ccecff" style="background:#ccecff"></button>
          <button type="button" data-color="#e6c9ff" style="background:#e6c9ff"></button>
          <button type="button" data-color="#ffe2c9" style="background:#ffe2c9"></button>
        </div>

        <button class="abc-btn" type="button" onclick="abcAplicarResaltado()">💛 Resaltar</button>
        <button class="abc-btn abc-btn-ghost" type="button" onclick="abcQuitarResaltado()">🧼 Quitar</button>
        <button class="abc-btn" type="button" onclick="abcAbrirNota()">📝 Nota</button>

        <button class="abc-btn abc-btn-ghost" type="button"
          onclick="window.scrollTo({top:0,behavior:'smooth'})">⬆️</button>
      </div>

      <!-- Modal nota -->
      <div id="abcModalNota">
        <div class="card">
          <div class="head">
            <div>📝 Nota</div>
            <button class="abc-btn abc-btn-ghost" type="button" onclick="abcCerrarNota()">✖</button>
          </div>
          <textarea id="abcNotaTxt" placeholder="Escribí tu nota..."></textarea>
          <div class="foot">
            <button class="abc-btn abc-btn-ghost" type="button" onclick="abcBorrarNota()">Borrar</button>
            <button class="abc-btn" type="button" onclick="abcGuardarNota()">Guardar</button>
          </div>
        </div>
      </div>
    `;

    construirIndiceABC();
    engancharEventosABC();
    await cargarProgresoABC(); // ✅ intenta volver al último tema
    abcIniciado = true;
  }

  await cargarABCTema();
};

// ===== UI =====
function construirIndiceABC() {
  const idx = document.getElementById("abcIndice");
  if (!idx) return;
  idx.innerHTML = "";

  ABC_TEMAS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t.titulo;
    b.onclick = () => {
      abcIndex = i;
      cargarABCTema(true);
    };
    idx.appendChild(b);
  });

  refrescarUIIndice();
}

function refrescarUIIndice() {
  const idx = document.getElementById("abcIndice");
  if (idx) {
    Array.from(idx.querySelectorAll("button")).forEach((b, i) => {
      b.classList.toggle("activo", i === abcIndex);
    });
    const act = idx.querySelectorAll("button")[abcIndex];
    if (act && act.scrollIntoView) act.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  const prev = document.getElementById("abcBtnPrev");
  const next = document.getElementById("abcBtnNext");
  if (prev) prev.disabled = (abcIndex === 0);
  if (next) next.disabled = (abcIndex === ABC_TEMAS.length - 1);
}

function engancharEventosABC() {
  // paleta
  const pal = document.getElementById("abcPaleta");
  if (pal) {
    pal.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-color]");
      if (!btn) return;
      abcColor = btn.getAttribute("data-color");
    });
  }

  // selección de bloques (delegación)
  const cont = document.getElementById("abcContenido");
  if (cont) {
    cont.addEventListener("click", (e) => {
      const b = e.target.closest(".abc-block");
      if (!b) return;
      seleccionarBloque(b.getAttribute("data-bid"));
    });
  }
}

// ===== Firebase load/save =====
async function cargarProgresoABC() {
  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;

  try {
    const snap = await get(ref(db, pathProgreso(uid)));
    const data = snap.val();
    if (data && typeof data.ultimoIndex === "number") {
      abcIndex = Math.max(0, Math.min(ABC_TEMAS.length - 1, data.ultimoIndex));
    }
  } catch (e) {
    console.warn("No pude cargar progreso ABC", e);
  }
}

async function guardarProgresoABC() {
  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;
  try {
    await set(ref(db, pathProgreso(uid)), { ultimoIndex: abcIndex, ts: Date.now() });
  } catch (e) {
    console.warn("No pude guardar progreso ABC", e);
  }
}

async function cargarDatosTemaABC() {
  const uid = getUID();
  const db = getDB();
  cacheResaltados = {};
  cacheNotas = {};
  if (!uid || !db) return;

  try {
    const [sRes, sNot] = await Promise.all([
      get(ref(db, pathResaltados(uid, abcIndex))),
      get(ref(db, pathNotas(uid, abcIndex)))
    ]);
    cacheResaltados = sRes.val() || {};
    cacheNotas = sNot.val() || {};
  } catch (e) {
    console.warn("No pude cargar datos del tema ABC", e);
  }
}

// ===== Cargar tema =====
async function cargarABCTema(desdeIndice = false) {
  const tema = ABC_TEMAS[abcIndex];
  if (!tema) return;

  refrescarUIIndice();
  await guardarProgresoABC();

  const audio = document.getElementById("abcAudio");
  if (audio) audio.src = tema.audio;

  const cont = document.getElementById("abcContenido");
  if (!cont) return;

  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo abrir el HTML");
    const raw = await r.text();

    // ✅ Si el HTML viene completo (<html><head>...), agarramos SOLO el body
    const parsed = new DOMParser().parseFromString(raw, "text/html");
    const bodyHTML = parsed?.body ? parsed.body.innerHTML : raw;

    cont.innerHTML = `<div id="abcDoc">${bodyHTML}</div>`;

    // ✅ aplica tamaño
    aplicarFontSizeABC();

    // ✅ preparar bloques
    prepararBloquesABC();

    // ✅ cargar resaltados/notas desde Firebase
    await cargarDatosTemaABC();

    // ✅ aplicar resaltados/notas a lo que se ve
    aplicarResaltadosABC();

    // reset selección
    seleccionarBloque(null);

  } catch (e) {
    cont.innerHTML = `
      <div style="padding:12px; border-radius:12px; background:rgba(217,83,79,.12); color:inherit;">
        ❌ No pude cargar el contenido de este tema.<br>
        Revisá si existe el archivo:<br>
        <code style="font-size:12px;">${tema.html}</code>
      </div>
    `;
    console.error(e);
  }
}

// ===== Bloques =====
function prepararBloquesABC() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  // marcamos párrafos y items de lista como bloques
  const blocks = doc.querySelectorAll("p, li");
  let n = 0;
  blocks.forEach((el) => {
    const bid = `t${abcIndex}_b${n++}`;
    el.classList.add("abc-block");
    el.setAttribute("data-bid", bid);
  });
}

function seleccionarBloque(bid) {
  abcSelId = bid;

  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  doc.querySelectorAll(".abc-block.seleccionado").forEach(x => x.classList.remove("seleccionado"));

  if (!bid) return;

  const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
  if (el) el.classList.add("seleccionado");
}

function aplicarResaltadosABC() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  doc.querySelectorAll(".abc-block").forEach((el) => {
    const bid = el.getAttribute("data-bid");
    const color = cacheResaltados?.[bid];
    if (color) el.style.background = color;
    else el.style.background = "transparent";
  });
}

// ===== Acciones =====
window.abcLetra = (delta) => {
  abcFontSize = Math.max(12, Math.min(34, abcFontSize + delta));
  aplicarFontSizeABC();
};

function aplicarFontSizeABC() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;
  doc.style.setProperty("--abc-font-size", `${abcFontSize}px`);
}

window.abcAplicarResaltado = async () => {
  if (!abcSelId) return;
  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;

  cacheResaltados[abcSelId] = abcColor;
  aplicarResaltadosABC();

  try {
    await set(ref(db, `${pathResaltados(uid, abcIndex)}/${abcSelId}`), abcColor);
  } catch (e) {
    console.warn("No pude guardar resaltado", e);
  }
};

window.abcQuitarResaltado = async () => {
  if (!abcSelId) return;
  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;

  delete cacheResaltados[abcSelId];
  aplicarResaltadosABC();

  try {
    await remove(ref(db, `${pathResaltados(uid, abcIndex)}/${abcSelId}`));
  } catch (e) {
    console.warn("No pude quitar resaltado", e);
  }
};

// ===== Notas =====
window.abcAbrirNota = () => {
  if (!abcSelId) return;
  const modal = document.getElementById("abcModalNota");
  const txt = document.getElementById("abcNotaTxt");
  if (!modal || !txt) return;

  txt.value = cacheNotas?.[abcSelId] || "";
  modal.style.display = "flex";
};

window.abcCerrarNota = () => {
  const modal = document.getElementById("abcModalNota");
  if (modal) modal.style.display = "none";
};

window.abcGuardarNota = async () => {
  if (!abcSelId) return;

  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;

  const txt = document.getElementById("abcNotaTxt");
  const val = (txt?.value || "").trim();

  cacheNotas[abcSelId] = val;

  try {
    await set(ref(db, `${pathNotas(uid, abcIndex)}/${abcSelId}`), val);
    abcCerrarNota();
  } catch (e) {
    console.warn("No pude guardar nota", e);
  }
};

window.abcBorrarNota = async () => {
  if (!abcSelId) return;

  const uid = getUID();
  const db = getDB();
  if (!uid || !db) return;

  delete cacheNotas[abcSelId];

  try {
    await remove(ref(db, `${pathNotas(uid, abcIndex)}/${abcSelId}`));
    const txt = document.getElementById("abcNotaTxt");
    if (txt) txt.value = "";
  } catch (e) {
    console.warn("No pude borrar nota", e);
  }
};

// ===== Navegación =====
window.abcNext = () => {
  if (abcIndex < ABC_TEMAS.length - 1) {
    abcIndex++;
    cargarABCTema();
  }
};

window.abcPrev = () => {
  if (abcIndex > 0) {
    abcIndex--;
    cargarABCTema();
  }
};
