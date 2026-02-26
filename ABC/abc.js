// ================= ABC - MÓDULO =================

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

// ✅ Esta es la que debe llamar mostrarIglesiaSub('abc')
window.mostrarABC = async () => {
  const cont = document.getElementById("abcApp");
  if (!cont) return;

  if (!abcIniciado) {
    cont.innerHTML = `
      <style>
        /* ===== ABC UI (local) ===== */
        #abcWrap{ max-width: 980px; margin: 0 auto; padding: 10px 12px 18px; }
        #abcTop{
          display:flex; align-items:center; gap:10px;
          /* centra visualmente entre tabs y contenido */
          padding: 8px 0 10px;
        }

        #abcIndice{
  flex:1;
  display:flex;
  gap:8px;

  /* ✅ scrollbar normal siempre visible en PC */
  overflow-x: scroll;
  overflow-y: hidden;

  padding: 6px 2px;
  -webkit-overflow-scrolling: touch;

  /* ✅ nada de "mano / drag" */
  cursor: default;
  scroll-snap-type: none;
}

/* ✅ scrollbar visible */
#abcIndice::-webkit-scrollbar{ height: 10px; }
#abcIndice::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.22); border-radius: 999px; }
body.oscuro #abcIndice::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.22); }

        #abcNav{
          display:flex; gap:8px; align-items:center;
          justify-content:flex-end;
          min-width: 86px;
        }
        #abcNav button{
          border:none; background: transparent; cursor:pointer;
          font-size: 26px;
          padding: 6px;
          line-height: 1;
          color: #4f6fa8;
        }
        #abcNav button:disabled{ opacity:.35; cursor:default; }

        #abcAudio{
          width:100%;
          margin: 8px 0 12px;
        }

#abcAudioBar{
  position: sticky;
  top: 0;              /* ✅ arriba del todo */
  z-index: 50;
  background: #fff;    /* ✅ para que no se mezcle con texto al scrollear */
  padding: 8px 0 10px;
  border-bottom: 1px solid rgba(0,0,0,.08);
}

/* en oscuro igual lo dejamos blanco para legibilidad */
body.oscuro #abcAudioBar{
  background:#fff;
}

/* el audio como antes */
#abcAudio{
  width:100%;
  margin: 0;            /* ahora el margen lo maneja la barra */
}

        #abcContenido{
          background: #fff;
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 14px;
          padding: 14px;
          overflow:hidden;
        }

        /* ✅ En oscuro, el documento queda tipo "hoja" para que SIEMPRE sea legible */
body.oscuro #abcContenido{
  background: #ffffff;
  color: #000000;
  border-color: rgba(0,0,0,.12);
}
body.oscuro #abcContenido a{ color:#1c6fcb; }

        /* ===== DOC RESPONSIVE (muy importante) ===== */
/* ✅ Bulldozer seguro: elimina ancho fijo tipo 595pt pero NO destruye estilos */
#abcDoc *{
  max-width: 100% !important;
  box-sizing: border-box;
}

/* neutraliza anchos fijos típicos de export Word */
#abcDoc [style*="width:"]{
  max-width: 100% !important;
}
#abcDoc img, #abcDoc table{
  max-width: 100% !important;
  height: auto !important;
}

/* tablas: si se pasan, scroll horizontal dentro */
#abcDoc table{
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ✅ CEL: full width, sin márgenes laterales */
@media (max-width: 640px){
  #abcWrap{ max-width: 100%; margin: 0; padding: 8px 0 16px; }
  #abcTop{ padding-left: 10px; padding-right: 10px; } /* para que el índice no pegue al borde */
  #abcAudioBar{ padding-left: 10px; padding-right: 10px; }

  #abcContenido{
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    padding: 10px; /* podés bajarlo a 8 si querés más full */
  }
}
      </style>

      <div id="abcWrap">
        <!-- Índice + navegación (debajo de tabs de Iglesia) -->
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
    `;

    construirIndiceABC();
    abcIniciado = true;

    // ✅ ajustes barra / ocultar botones imagen, etc.
    if (window.__abcOnEnter) window.__abcOnEnter();

    // ✅ IMPORTANTE: acá cargamos progreso y CORTAMOS para no cargar 2 veces
    await abcCargarProgreso();
    return;
  }

  // ✅ si ya estaba iniciado, recién acá cargamos tema normal
  await cargarABCTema();
};

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
  // botones índice
  const idx = document.getElementById("abcIndice");
  if (idx) {
    Array.from(idx.querySelectorAll("button")).forEach((b, i) => {
      b.classList.toggle("activo", i === abcIndex);
    });

    // mantener visible el activo
    const act = idx.querySelectorAll("button")[abcIndex];
    if (act && act.scrollIntoView) {
      act.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  // prev/next
  const prev = document.getElementById("abcBtnPrev");
  const next = document.getElementById("abcBtnNext");
  if (prev) prev.disabled = (abcIndex === 0);
  if (next) next.disabled = (abcIndex === ABC_TEMAS.length - 1);
}

async function cargarABCTema(desdeIndice = false) {
  const tema = ABC_TEMAS[abcIndex];
  if (!tema) return;

  refrescarUIIndice();

  const audio = document.getElementById("abcAudio");
  if (audio) {
    audio.src = tema.audio;
    // si tocó un botón del índice, generalmente quiere escuchar/leer ya.
    // no auto-play por respeto a navegador; pero dejamos listo.
  }

  const cont = document.getElementById("abcContenido");
  if (!cont) return;

  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo abrir el HTML");

   const raw = await r.text();
const parsed = new DOMParser().parseFromString(raw, "text/html");

// ✅ preserva estilos del Word
const estilos = Array.from(parsed.querySelectorAll("style"))
  .map(s => s.outerHTML)
  .join("");

const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;

cont.innerHTML = `
  ${estilos}
  <div id="abcDoc">${bodyHTML}</div>
`;

abcPrepararBloques();
abcEscucharResaltados();
abcGuardarProgreso();
    
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

 // ================= ABC: FIREBASE + BLOQUES =================
const FB = () => window.__FB || {};
const API = () => window.__FB_API || {};
const UID = () => window.__UID || null;

let abcSeleccionado = null;
let abcColor = "#fff3b0"; // igual que Biblia

function abcPath(base){ return `${base}/${UID()}`; }

// Llamar después de cargar el HTML del tema
function abcPrepararBloques() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  const targets = doc.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6");
  let n = 0;

  targets.forEach(el => {
    if (el.closest(".abc-block")) return;

    const wrap = document.createElement("div");
    const id = `t${abcIndex}_b${n++}`;
    wrap.className = "abc-block";
    wrap.dataset.bid = id;

    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
  });

doc.onclick = (e) => {
  const b = e.target.closest(".abc-block");
  if (!b) return;

  abcSeleccionado = b.dataset.bid;
  abcMarcarSeleccionUI();

  // si NO estoy en modo marcador, solo selecciono (borde)
  if (!abcModoMarcador) return;

  // requiere login
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  // respeta candado de Biblia
  if (window.resaltadorBloqueado) return;

  // usa el color actual de Biblia
  const color = window.colorActual || "#fff3b0";
  abcSetResaltado(abcSeleccionado, color);
};

  abcMarcarSeleccionUI();
}

function abcMarcarSeleccionUI(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  doc.querySelectorAll(".abc-block").forEach(b => {
    b.style.outline = (b.dataset.bid === abcSeleccionado) ? "2px solid #4f6fa8" : "none";
    b.style.outlineOffset = "4px";
    b.style.borderRadius = "10px";
  });
}

// ===== Guardar progreso =====
async function abcGuardarProgreso(){
  const uid = UID(); if(!uid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;
  await set(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`), abcIndex);
}

// ===== Cargar progreso (llamar 1 vez al entrar a ABC) =====
async function abcCargarProgreso(){
  const uid = UID(); if(!uid) { abcIndex = 0; await cargarABCTema(); return; }

  const { db } = FB();
  const { ref, onValue } = API();
  if(!db || !ref || !onValue) { abcIndex = 0; await cargarABCTema(); return; }

  onValue(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`), snap => {
    const v = snap.val();

    // ✅ si todavía no hay nada guardado, arrancar en 0
    if (v === null || v === undefined) {
      abcIndex = 0;
      cargarABCTema();
      return;
    }

    // ✅ si hay valor válido, usarlo
    if (typeof v === "number" && v >= 0 && v < ABC_TEMAS.length) {
      abcIndex = v;
      cargarABCTema();
      return;
    }

    // ✅ si vino algo raro, fallback
    abcIndex = 0;
    cargarABCTema();
  }, { onlyOnce: true });
}

// ===== Resaltados por bloque =====
async function abcSetResaltado(bid, color){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;
  await set(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`), { color });
}

function abcAplicarResaltadosEnPantalla(data){
  const doc = document.getElementById("abcDoc");
  if(!doc) return;

  Object.entries(data || {}).forEach(([bid, obj]) => {
    const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
    if (el && obj?.color) el.style.background = obj.color;
  });
}

function abcEscucharResaltados(){
  const uid = UID(); if(!uid) return;
  const { db } = FB();
  const { ref, onValue } = API();
  if(!db || !ref || !onValue) return;

  onValue(ref(db, `${abcPath("abcResaltados")}/${abcIndex}`), snap => {
    const data = snap.val() || {};
    const doc = document.getElementById("abcDoc");
    if(doc) doc.querySelectorAll(".abc-block").forEach(b => b.style.background = "transparent");
    abcAplicarResaltadosEnPantalla(data);
  });
}

// ===== Notas por bloque =====
async function abcGuardarNota(bid, nota){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;
  await set(ref(db, `${abcPath("abcNotas")}/${abcIndex}/${bid}`), { nota: nota || "", fecha: Date.now() });
}

async function abcAbrirNota(){
  if(!abcSeleccionado) return alert("Tocá un párrafo primero 🙂");
  const nota = prompt("Escribí tu nota para este párrafo:");
  if (nota === null) return;
  await abcGuardarNota(abcSeleccionado, nota);
  alert("✅ Nota guardada");
}


// =====================================================
// ✅ ABC: ROUTER DE BARRA (sin tocar biblia.js)
// =====================================================

// guardo originales de Biblia (si existen)
const __BIBLIA = {
  cambiarLetra: window.cambiarLetra,
  toggleModoMarcador: window.toggleModoMarcador,
  abrirMarcadores: window.abrirMarcadores,
  ocultarBarraAcciones: window.ocultarBarraAcciones,
  mostrarBarraAcciones: window.mostrarBarraAcciones,
  toggleModoImagen: window.toggleModoImagen,
  generarImagen: window.generarImagen
};

function estoyEnABC(){
  const sec = document.getElementById("seccion-iglesia");
  const abc = document.getElementById("iglesia-abc");
  return !!(sec && sec.style.display !== "none" && abc && abc.style.display !== "none");
}

// ---------- estado ABC ----------
let abcModoMarcador = false;
let abcFontSize = 18; // default parecido a biblia

function abcAplicarFontSize(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;
  doc.style.fontSize = abcFontSize + "px";
}

// oculta botones de imagen cuando estoy en ABC
function abcAjustarBarraUI(){
  const btnImg = document.getElementById("btnImagen");
  const btnCrear = document.getElementById("btnCrearImagen");
  if (btnImg) btnImg.style.display = estoyEnABC() ? "none" : "";
  if (btnCrear) btnCrear.style.display = estoyEnABC() ? "none" : "";
}

// ---------- router: tamaño letra ----------
window.cambiarLetra = (delta) => {
  if (!estoyEnABC()) {
    if (typeof __BIBLIA.cambiarLetra === "function") return __BIBLIA.cambiarLetra(delta);
    return;
  }
  abcFontSize = Math.max(12, Math.min(36, abcFontSize + (delta > 0 ? 1 : -1)));
  abcAplicarFontSize();
};

// ---------- router: modo marcador ----------
window.toggleModoMarcador = () => {
  if (!estoyEnABC()) {
    if (typeof __BIBLIA.toggleModoMarcador === "function") return __BIBLIA.toggleModoMarcador();
    return;
  }

  // requiere login como biblia (si tenés loginModal)
  const uid = (window.__UID || null);
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  abcModoMarcador = !abcModoMarcador;

  document.body.classList.toggle("modo-marcador", abcModoMarcador);

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.toggle("activo", abcModoMarcador);
};

// ---------- router: lista marcadores (en ABC = abrir nota) ----------
window.abrirMarcadores = () => {
  if (!estoyEnABC()) {
    if (typeof __BIBLIA.abrirMarcadores === "function") return __BIBLIA.abrirMarcadores();
    return;
  }
  // ABC: nota por bloque (mínimo viable igual biblia: guarda en Firebase)
  abcAbrirNota();
};

// ---------- router: ocultar/mostrar barra (igual) ----------
window.ocultarBarraAcciones = () => {
  if (typeof __BIBLIA.ocultarBarraAcciones === "function") return __BIBLIA.ocultarBarraAcciones();
};
window.mostrarBarraAcciones = () => {
  if (typeof __BIBLIA.mostrarBarraAcciones === "function") return __BIBLIA.mostrarBarraAcciones();
};

// ---------- impedir modo imagen en ABC ----------
window.toggleModoImagen = () => {
  if (!estoyEnABC()) {
    if (typeof __BIBLIA.toggleModoImagen === "function") return __BIBLIA.toggleModoImagen();
  }
};
window.generarImagen = () => {
  if (!estoyEnABC()) {
    if (typeof __BIBLIA.generarImagen === "function") return __BIBLIA.generarImagen();
  }
};

// Llamalo cada vez que entras a ABC (lo invoco desde mostrarABC)
window.__abcOnEnter = () => {
  abcAjustarBarraUI();
  abcAplicarFontSize();
};

