// ================= ABC - MÓDULO =================

const ABC_TEMAS = [
  { titulo: "🤍", html: "ABC/INTRO.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2Fintro_abc.mp3?alt=media&token=c51321da-2f7f-4092-b90d-a61df6da671a" },
  { titulo: "Salvación", html: "ABC/1 Salvación.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F1%20Salvaci%C3%B3n.mp3?alt=media&token=7da0ae0f-da01-4a58-8ae0-5e0a037c8076" },
  { titulo: "Pecado", html: "ABC/2 Pecado.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F2%20Pecado.mp3?alt=media&token=54fe4210-37e9-4cf0-b0bf-c7f0564e881f" },
  { titulo: "La Palabra", html: "ABC/3 La Palabra.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F3%20La%20Palabra.mp3?alt=media&token=73fbd70f-e008-47de-b557-28fcd6a5ac36" },
  { titulo: "La Oración", html: "ABC/4 La Oración.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F4%20La%20Oraci%C3%B3n.mp3?alt=media&token=096b3b09-6179-4c80-8718-a800954907b3" },
  { titulo: "Espíritu Santo", html: "ABC/5 Espíritu Santo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F5%20Esp%C3%ADritu%20Santo.mp3?alt=media&token=68ad750b-4449-433f-b7dc-be457879c61f" },
  { titulo: "Bautismo", html: "ABC/6 Bautismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F6%20Bautismo.mp3?alt=media&token=e85836f1-9f5d-42be-83de-93797cdf3c22" },
  { titulo: "La Mayordomía", html: "ABC/7 La Mayordomía.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F7%20La%20Mayordom%C3%ADa.mp3?alt=media&token=4994a81a-be99-4f39-8bd3-9888df880fcf" },
  { titulo: "Evangelismo", html: "ABC/8 Evangelismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F8%20Evangelismo.mp3?alt=media&token=4d197527-1f36-4378-9389-5e248e44533b" },
  { titulo: "Visión de la iglesia", html: "ABC/9 La visión de la iglesia.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F9%20La%20vision%20de%20la%20iglesia.mp3?alt=media&token=c81cd672-6fd8-46df-b086-e564fed73974" }
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

#abcIndice button{
  white-space: nowrap;     /* ✅ no partir en 2 líneas */
  flex: 0 0 auto;          /* ✅ que no se achique raro */
  line-height: 1.05;
  padding: 8px 10px;
  border-radius: 999px;
}

/* ✅ scrollbar visible */
#abcIndice::-webkit-scrollbar{ height: 10px; }
#abcIndice::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.22); border-radius: 999px; }
body.oscuro #abcIndice::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.22); }


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

/* ✅ BLOQUES (wrapper) */
.abc-block{
  display:block;
  padding: 6px 8px;
  border-radius: 10px;
}
.abc-block > *{
  margin: 0;              /* evita huecos raros de márgenes del Word */
}
.abc-block + .abc-block{
  margin-top: 6px;
}

/* ✅ Forzar tamaño global dentro de ABC aunque Word traiga tamaños */
#abcDoc, #abcDoc *{
  font-size: var(--abc-font, 18px) !important;
}

/* botones modal */
.btn-pri{
  background: var(--ui-azul-claro, #bcdcff);
  border:none; padding:10px 14px; border-radius:12px; cursor:pointer;
}
.btn-pri:hover{ background: var(--ui-azul-hover, #1c6fcb); color:#fff; }

.btn-sec{
  background: rgba(0,0,0,.06);
  border:none; padding:10px 14px; border-radius:12px; cursor:pointer;
}

/* ✅ cuando un bloque está resaltado, el fondo lo maneja el wrapper */
.abc-block *{
  background: transparent !important;
}
      </style>

     <div id="abcWrap">

  <!-- ✅ Audio arriba (sticky) -->
  <div id="abcAudioBar">
    <audio id="abcAudio" controls preload="metadata"></audio>
  </div>

  <!-- ✅ Índice (solo scroll, sin flechas) -->
  <div id="abcTop">
    <div id="abcIndice" aria-label="Índice ABC"></div>
  </div>

  <div id="abcContenido"></div>

  <!-- ✅ Modal Nota ABC (tipo Biblia) -->
  <div id="abcNotaModal" class="modal-overlay" style="display:none;">
    <div class="modal-contenido" style="max-width:520px; width:92vw;">
      <button class="cerrar-modal" type="button" onclick="abcCerrarNota()">✖</button>
      <h3 style="margin:0 0 6px;">Nota</h3>
      <div style="font-size:12px; opacity:.7; margin-bottom:10px;" id="abcNotaInfo"></div>

      <textarea id="abcNotaTexto"
        style="width:100%; min-height:160px; padding:10px; border-radius:12px; border:1px solid rgba(0,0,0,.15);"></textarea>

      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:10px;">
        <button type="button" onclick="abcEliminarNota()" class="btn-sec">Eliminar</button>
        <button type="button" onclick="abcGuardarNotaDesdeModal()" class="btn-pri">Guardar</button>
      </div>
    </div>
  </div>

</div>
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
b.style.background = color;
const child = b.firstElementChild;
if (child) child.style.background = "transparent";
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
  try{
    const uid = UID(); if(!uid) return;
    const { db } = FB();
    const { ref, set } = API();
    if(!db || !ref || !set) return;

    await set(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`), abcIndex);

  } catch (e){
    console.warn("⚠️ No se pudo guardar progreso ABC:", e?.code || e?.message || e);
    // no hacemos nada más: que siga funcionando igual
  }
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
    if (el && obj?.color) {
  el.style.background = obj.color;
  const child = el.firstElementChild;
  if (child) child.style.background = "transparent";
}
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
  if(!abcSeleccionado) return alert("Tocá un bloque primero 🙂");

  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  // cargar nota existente
  const { db } = FB();
  const { ref, get } = API();
  const modal = document.getElementById("abcNotaModal");
  const ta = document.getElementById("abcNotaTexto");
  const info = document.getElementById("abcNotaInfo");

  if (!modal || !ta || !info || !db || !ref || !get) return;

  info.textContent = `Tema: ${ABC_TEMAS[abcIndex]?.titulo || abcIndex} · Bloque: ${abcSeleccionado}`;

  try{
    const snap = await get(ref(db, `${abcPath("abcNotas")}/${abcIndex}/${abcSeleccionado}`));
    ta.value = snap.exists() ? (snap.val()?.nota || "") : "";
  }catch(e){
    ta.value = "";
  }

  modal.style.display = "flex";
}

function abcCerrarNota(){
  const modal = document.getElementById("abcNotaModal");
  if (modal) modal.style.display = "none";
}

async function abcGuardarNotaDesdeModal(){
  const ta = document.getElementById("abcNotaTexto");
  if (!ta) return;
  await abcGuardarNota(abcSeleccionado, ta.value);
  abcCerrarNota();
}

async function abcEliminarNota(){
  const uid = UID(); if(!uid || !abcSeleccionado) return;
  const { db } = FB();
  const { ref, remove } = API();
  if(!db || !ref || !remove) return;
  await remove(ref(db, `${abcPath("abcNotas")}/${abcIndex}/${abcSeleccionado}`));
  abcCerrarNota();
}

async function abcListarNotasTema(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  const { db } = FB();
  const { ref, get } = API();
  if(!db || !ref || !get) return;

  try{
    const snap = await get(ref(db, `${abcPath("abcNotas")}/${abcIndex}`));
    const data = snap.exists() ? snap.val() : null;

    if (!data) return alert("No hay notas en este tema todavía.");

    const keys = Object.keys(data);
    alert(`Notas en "${ABC_TEMAS[abcIndex]?.titulo}":\n\n` + keys.map((k,i)=>`${i+1}) ${k}`).join("\n") + `\n\nTocá un bloque y apretá el alfiler para editar.`);
  }catch(e){
    alert("No pude cargar las notas.");
  }
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

  // usamos variable CSS para no pelear con estilos del Word
  doc.style.setProperty("--abc-font", abcFontSize + "px");
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
const uid = (typeof window.__UID === "function") ? window.__UID() : null;
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
  abcPortalBarraOn();
  abcAjustarBarraUI();
  abcAplicarFontSize();
};

// =====================================================
// ✅ ABC: MOSTRAR BARRA BIBLIA TAMBIÉN EN ABC (PORTAL)
// (sin tocar biblia.js)
// =====================================================
let __abcBarParent = null;
let __abcBarNext = null;
let __abcBtnParent = null;
let __abcBtnNext = null;

function abcPortalBarraOn() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");

  if (!bar) {
    console.warn("❌ No existe #accionesBiblia en el DOM.");
    return;
  }

  // guardar ubicación original (solo la primera vez)
  if (!__abcBarParent) {
    __abcBarParent = bar.parentNode;
    __abcBarNext = bar.nextSibling;
  }
  if (btn && !__abcBtnParent) {
    __abcBtnParent = btn.parentNode;
    __abcBtnNext = btn.nextSibling;
  }

  // mover al body para que no dependa del display:none
  document.body.appendChild(bar);
  if (btn) document.body.appendChild(btn);

  // ✅ forzar que quede como barra flotante visible
  bar.style.display = "";
  bar.style.visibility = "visible";
  bar.style.opacity = "1";
  bar.style.position = "fixed";
  bar.style.left = "0";
  bar.style.right = "0";
  bar.style.bottom = "0";
  bar.style.zIndex = "9999";
}

function abcPortalBarraOff() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");

  // devolver a su lugar original
  if (bar && __abcBarParent) {
    if (__abcBarNext) __abcBarParent.insertBefore(bar, __abcBarNext);
    else __abcBarParent.appendChild(bar);
  }

  if (btn && __abcBtnParent) {
    if (__abcBtnNext) __abcBtnParent.insertBefore(btn, __abcBtnNext);
    else __abcBtnParent.appendChild(btn);
  }
}

// 👉 opcional: si tenés una función global que cambia de secciones,
// podés llamar abcPortalBarraOff() al salir de ABC.
// Si no, no pasa nada: puede quedar “portaleada” y sigue funcionando.
