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
let abcResaltadosCache = {}; // { bid: {color} }

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

/* ✅ BLOQUES (como Biblia): el bloque ES el párrafo / li / etc */
.abc-block{
  display:block;
  padding: 6px 8px;
  border-radius: 10px;
  margin: 0 0 6px 0;     /* separación uniforme */
}

/* ✅ Forzar tamaño global dentro de ABC aunque Word traiga tamaños */
#abcDoc, #abcDoc *{
  font-size: var(--abc-font, 18px) !important;
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

/* ✅ En ABC: NO borres el fondo del bloque (si no, nunca se ve el resaltado) */
/* Solo limpiamos fondos internos del Word */
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
abcAplicarFontSize();
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
const UID = () => {
  if (typeof window.__UID === "function") return window.__UID();
  return window.__UID || null;
};
function abcPath(base){ return `${base}/${UID()}`; }

// =====================================================
// ✅ ABC: PROGRESO (último tema) + RESALTADOS por bloque
// =====================================================

// ----- PROGRESO -----
async function abcGuardarProgreso(){
  try{
    const uid = UID(); if(!uid) return;
    const { db } = FB();
    const { ref, set } = API();
    if(!db || !ref || !set) return;

    await set(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`), abcIndex);
  } catch (e){
    console.warn("⚠️ No se pudo guardar progreso ABC:", e?.code || e?.message || e);
  }
}

async function abcCargarProgreso(){
  const uid = UID();
  // si no hay login: arrancá en 0 y cargá tema igual
  if(!uid){ abcIndex = 0; await cargarABCTema(); return; }

  const { db } = FB();
  const { ref, get } = API();
  if(!db || !ref || !get){ abcIndex = 0; await cargarABCTema(); return; }

  try{
    const snap = await get(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`));
    const v = snap.exists() ? snap.val() : null;

    if (typeof v === "number" && v >= 0 && v < ABC_TEMAS.length) abcIndex = v;
    else abcIndex = 0;

    await cargarABCTema();
  }catch(e){
    abcIndex = 0;
    await cargarABCTema();
  }
}

// ----- RESALTADOS -----
async function abcSetResaltado(bid, color){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;

  await set(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`), { color });
}

async function abcQuitarResaltado(bid){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, remove } = API();
  if(!db || !ref || !remove) return;

  await remove(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`));
}

function abcLimpiarFondoBloque(el){
  if (!el) return;
  el.style.background = "transparent";
  el.querySelectorAll("*").forEach(x => x.style.background = "transparent");
}

function abcAplicarFondoBloque(el, color){
  if (!el) return;
  el.style.background = color;
  el.querySelectorAll("*").forEach(x => x.style.background = "transparent");
}

function abcAplicarResaltadosEnPantalla(data){
  const doc = document.getElementById("abcDoc");
  if(!doc) return;

  Object.entries(data || {}).forEach(([bid, obj]) => {
    const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
    if (el && obj?.color) abcAplicarFondoBloque(el, obj.color);
  });
}

let abcUnsubResaltados = null;

function abcEscucharResaltados(){
  const uid = UID(); if(!uid) return;
  const { db } = FB();
  const { ref, onValue, off } = API();
  if(!db || !ref || !onValue) return;

  // cortar escucha anterior
  try{ if (abcUnsubResaltados) abcUnsubResaltados(); }catch(e){}

  const r = ref(db, `${abcPath("abcResaltados")}/${abcIndex}`);

  const handler = (snap) => {
    const data = snap.val() || {};
    abcResaltadosCache = data;

    // limpiar pantalla primero
    const doc = document.getElementById("abcDoc");
    if (doc) doc.querySelectorAll(".abc-block").forEach(el => abcLimpiarFondoBloque(el));

    abcAplicarResaltadosEnPantalla(data);
  };

  onValue(r, handler);

  abcUnsubResaltados = () => {
    try { off(r, "value", handler); } catch(e){}
  };
}

// =====================================================
// ✅ ABC: selección múltiple + NOTAS usando el MISMO modalMarcadores (Biblia)
// =====================================================

// tamaño fuente ABC (persistente en memoria)
window.abcFontSize = window.abcFontSize || 18;

// estado
let abcModoMarcador = false;

// selección múltiple
let abcSeleccionados = new Set();
let abcSeleccionado = null;

// -------------------------
// ABC: helpers UI
// -------------------------
function estoyEnABC(){
  const sec = document.getElementById("seccion-iglesia");
  const abc = document.getElementById("iglesia-abc");
  return !!(sec && sec.style.display !== "none" && abc && abc.style.display !== "none");
}

function abcAplicarFontSize(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;
  doc.style.setProperty("--abc-font", (window.abcFontSize || 18) + "px");
}

function abcToast(msg, ms = 1600){
  if (typeof window.mostrarToast === "function") return window.mostrarToast(msg);

  let t = document.getElementById("abcToast");
  if (!t){
    t = document.createElement("div");
    t.id = "abcToast";
    t.style.position = "fixed";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.bottom = "86px";
    t.style.zIndex = "10000";
    t.style.padding = "10px 14px";
    t.style.borderRadius = "999px";
    t.style.background = "rgba(0,0,0,.80)";
    t.style.color = "#fff";
    t.style.fontSize = "14px";
    t.style.maxWidth = "92vw";
    t.style.textAlign = "center";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__abcToastTimer);
  window.__abcToastTimer = setTimeout(() => (t.style.display = "none"), ms);
}

// -------------------------
// ✅ BLOQUES ABC: click
// -------------------------
function abcPrepararBloques() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  const targets = doc.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote");
  let n = 0;

  targets.forEach(el => {
    if (el.closest("table")) return;
    if (el.classList.contains("abc-block")) return;
    const id = `t${abcIndex}_b${n++}`;
    el.classList.add("abc-block");
    el.dataset.bid = id;
  });

  abcMarcarSeleccionUI();

  doc.onclick = async (e) => {
    const b = e.target.closest(".abc-block");
    if (!b) return;

    const bid = b.dataset.bid;

    // 🔐 requiere login
    const uid = UID();
    const loginModal = document.getElementById("loginModal");
    if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

    // ✅ MODO MARCADOR (📌): selección múltiple
    if (abcModoMarcador) {
      if (abcSeleccionados.has(bid)) abcSeleccionados.delete(bid);
      else abcSeleccionados.add(bid);

      abcSeleccionado = bid;
      abcMarcarSeleccionUI();
      return;
    }

    // ✅ RESALTADOR (💛): solo si NO hay candado
    if (window.resaltadorBloqueado === true) return;

    // selección simple “visual”
    abcSeleccionado = bid;
    abcMarcarSeleccionUI();

    // toggle resaltado
    if (abcResaltadosCache && abcResaltadosCache[bid]) {
      await abcQuitarResaltado(bid);
      abcLimpiarFondoBloque(b);
      return;
    }

    const color = window.colorActual || "#fff3b0";
    await abcSetResaltado(bid, color);
    abcAplicarFondoBloque(b, color);
  };
}

function abcMarcarSeleccionUI(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  doc.querySelectorAll(".abc-block").forEach(b => {
    const bid = b.dataset.bid;

    const sel = abcSeleccionados.has(bid);
    const ultimo = (bid === abcSeleccionado);

    b.style.outline = sel ? "2px solid #4f6fa8" : "none";
    b.style.outlineOffset = "4px";
    b.style.borderRadius = "10px";
    b.style.outlineWidth = (sel && ultimo) ? "3px" : (sel ? "2px" : "");
  });
}

// -------------------------
// ✅ ABC -> ABRIR modalMarcadores (Biblia) para escribir nota
// -------------------------
function abcAbrirModalBibliaParaNota() {
  if (!abcSeleccionado && abcSeleccionados.size === 0) {
    abcToast("Primero tocá al menos un bloque 🙂");
    return;
  }

  // asegurar que el último tocado esté dentro del set
  if (abcSeleccionado && !abcSeleccionados.has(abcSeleccionado)) {
    abcSeleccionados.add(abcSeleccionado);
  }

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form  = document.getElementById("formNuevoMarcador");
  const info  = document.getElementById("infoMarcadorNuevo");
  const titulo= document.getElementById("marcadorTitulo");
  const nota  = document.getElementById("marcadorNota");
  const color = document.getElementById("marcadorColor");
  const keep  = document.getElementById("marcadorKeep");
  const btnGuardar = document.getElementById("btnGuardarNuevoMarcador");

  if (!modal || !lista || !form || !info || !titulo || !nota || !color || !keep || !btnGuardar) {
    alert("Falta el modal de Marcadores de Biblia (modalMarcadores) o algún id interno.");
    return;
  }

  // abrir en modo formulario
  lista.style.display = "none";
  form.style.display = "block";

  const temaTitulo = ABC_TEMAS?.[abcIndex]?.titulo || `ABC ${abcIndex}`;
  info.textContent = `ABC · Tema: ${temaTitulo} · Bloques: ${abcSeleccionados.size}`;

  titulo.value = `Nota ABC · ${temaTitulo}`;
  nota.value = "";
  color.value = "#fff3b0";
  keep.checked = true; // ✅ en ABC SI lo usamos: mantener bloque resaltado

  btnGuardar.onclick = async () => {
    try {
      const uid = UID();
      if (!uid) return;

      const t = (titulo.value || "Nota ABC").trim();
      const n = (nota.value || "").trim();

      const { db } = FB();
      const { ref, set } = API();
      if (!db || !ref || !set) return;

      const ahora = Date.now();
      const tema = ABC_TEMAS?.[abcIndex] || {};

      for (const bid of Array.from(abcSeleccionados)) {
        const id = `abc_${abcIndex}_${bid}`;
        const data = {
          origen: "abc",
          tipo: "nota",
          fecha: ahora,
          titulo: t,
          nota: n,
          color: (color.value || "#fff3b0"),
          keep: !!keep.checked,

          libro: "",
          capitulo: 0,
          versiculos: [],

          abc: { temaIndex: abcIndex, temaTitulo: tema.titulo || "", html: tema.html || "" },
          abcBid: bid
        };
        await set(ref(db, `marcadores/${uid}/${id}`), data);
        
        // ✅ si "Mantener resaltado" está activo, aplicamos resaltado al bloque
if (keep.checked) {
  await abcSetResaltado(bid, color.value || "#fff3b0");
}
      }

      // cerrar modal de Biblia
      if (typeof cerrarMarcadores === "function") cerrarMarcadores();
      else {
        modal.classList.remove("abierto");
        modal.setAttribute("aria-hidden", "true");
      }

// ✅ cerrar y resetear modo marcador
abcResetModoMarcador();

// ✅ IMPORTANTÍSIMO: reenganchar la barra para que el ✓ vuelva a tener onclick en ABC
abcUIEnABC();

// ✅ re-aplicar visibilidad (por si biblia lo dejó "bloqueado")
abcAplicarUIAccionesPorModo();

abcToast("✅ Nota guardada");
      
    } catch (e) {
      console.error(e);
      alert("No pude guardar la nota.");
    }
  };

  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
}

async function abcAbrirListaNotasABC(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form  = document.getElementById("formNuevoMarcador");
  if (!modal || !lista || !form) {
    alert("No encontré modalMarcadores (Biblia).");
    return;
  }

  // ✅ mostrar lista (no el form)
  form.style.display = "none";
  lista.style.display = "block";

  // ✅ filtrar SOLO ABC (y si querés solo del tema actual, lo hacemos)
let data = window.marcadores || {};
let items = Object.entries(data)
  .map(([id, m]) => ({...m, id}))
  .filter(m => m?.origen === "abc")
  .sort((a,b)=> (b.fecha||0) - (a.fecha||0));

// ✅ si todavía no cargó window.marcadores, lo traemos directo de Firebase
if (!items.length) {
  try {
    const { db } = FB();
    const { ref, get } = API();
    const uid = UID();
    if (db && ref && get && uid) {
      const snap = await get(ref(db, `marcadores/${uid}`));
      const fresh = snap.exists() ? (snap.val() || {}) : {};

      // ✅ guardamos cache global para que las próximas veces ya esté
      window.marcadores = fresh;

      items = Object.entries(fresh)
        .map(([id, m]) => ({...m, id}))
        .filter(m => m?.origen === "abc")
        .sort((a,b)=> (b.fecha||0) - (a.fecha||0));
    }
  } catch (e) {
    console.warn("No pude cargar marcadores desde Firebase:", e);
  }
}

  if (!items.length){
    lista.innerHTML = `<p class="muted">Todavía no guardaste notas de ABC.</p>`;
  } else {
    lista.innerHTML = items.map(m => {
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleDateString("es-AR") : "";
      const titulo = (m.titulo || "Nota ABC").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const temaTxt = m?.abc?.temaTitulo ? ` · ${m.abc.temaTitulo}` : "";
      const linea = `${titulo}${temaTxt} · ${fechaTxt}`;

      return `
        <div class="card-marcador" style="cursor:pointer; display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="abcIrANota('${m.id}')">
            ${linea}
          </div>
          <button type="button" class="pm-btn" onclick="abcEditarNota('${m.id}')" title="Editar">✏️</button>
        </div>
      `;
    }).join("");
  }

  // abrir modal
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden","false");
}

window.abcIrANota = async (id) => {
  const m = (window.marcadores || {})[id];
  if (!m) return;

  // cerrar modal
  if (typeof cerrarMarcadores === "function") cerrarMarcadores();
  else {
    const modal = document.getElementById("modalMarcadores");
    if (modal) { modal.classList.remove("abierto"); modal.setAttribute("aria-hidden","true"); }
  }

  // ir a ABC y al tema
  if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("abc");
  abcIndex = m?.abc?.temaIndex ?? 0;
  await cargarABCTema(true);

  // scrollear al bloque
  const bid = m.abcBid;
  const doc = document.getElementById("abcDoc");
  const el = doc ? doc.querySelector(`.abc-block[data-bid="${bid}"]`) : null;
  if (el && el.scrollIntoView) el.scrollIntoView({behavior:"smooth", block:"center"});

  // dejarlo seleccionado
  abcSeleccionado = bid;
  abcSeleccionados.clear();
  abcSeleccionados.add(bid);
  abcMarcarSeleccionUI();
};

window.abcEditarNota = async (id) => {
  const m = (window.marcadores || {})[id];
  if (!m) return;
  // ir primero al bloque
  await window.abcIrANota(id);
  // activar modo marcador y abrir form para editar (reusa tu modal)
  abcModoMarcador = true;
  abcAplicarUIAccionesPorModo();
  abcAbrirModalBibliaParaNota();
  // precargar en el form
  const titulo= document.getElementById("marcadorTitulo");
  const nota  = document.getElementById("marcadorNota");
  const color = document.getElementById("marcadorColor");
  const keep  = document.getElementById("marcadorKeep");
  if (titulo) titulo.value = m.titulo || "";
  if (nota)   nota.value = m.nota || "";
  if (color)  color.value = m.color || "#fff3b0";
  if (keep)   keep.checked = !!m.keep;
};

// -------------------------
// ✅ ABC: modo marcador ON/OFF
// -------------------------
function abcToggleModoMarcador(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  abcModoMarcador = !abcModoMarcador;

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) {
    btn.classList.toggle("activo", abcModoMarcador);
    btn.blur && btn.blur();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }

  if (!abcModoMarcador) {
    abcSeleccionados.clear();
    abcSeleccionado = null;
    abcMarcarSeleccionUI();
  } else {
    abcToast("📌 Tocá varios bloques y apretá ✓");
  }

  abcAplicarUIAccionesPorModo();
}

function abcResetModoMarcador() {
  abcModoMarcador = false;

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.remove("activo");

  abcSeleccionados.clear();
  abcSeleccionado = null;

  abcMarcarSeleccionUI();
  abcAplicarUIAccionesPorModo();
}

// -------------------------
// ✅ ABC: barra (solo 📌 + ✓ en modo marcador)
// -------------------------
function abcAplicarUIAccionesPorModo() {
  const btnPin    = document.getElementById("btnModoMarcadorBarra"); // 📌
  const btnCheck  = document.getElementById("btnGuardarMarcador");   // ✓

  // imagen siempre off en ABC
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear  = document.getElementById("btnCrearImagen");
  if (btnImagen) btnImagen.style.display = "none";
  if (btnCrear)  btnCrear.style.display  = "none";

  if (btnPin) btnPin.style.display = "inline-flex";

  const idsOcultar = [
    "btnListaMarcadores",
    "btnCopiar", "btnCompartir", "btnAudio", "btnLeer",
    "btnDescargar",
    "btnMas", "btnMenos"
  ];
  const otros = idsOcultar.map(id => document.getElementById(id)).filter(Boolean);

  if (abcModoMarcador) {
    if (btnCheck) btnCheck.style.display = "inline-flex";
    otros.forEach(el => el.style.display = "none");
  } else {
    if (btnCheck) btnCheck.style.display = "none";
    otros.forEach(el => el.style.display = "");
    if (btnImagen) btnImagen.style.display = "none";
    if (btnCrear)  btnCrear.style.display  = "none";
  }
}

// -------------------------
// ✅ ABC: portal barra ON/OFF
// -------------------------
let __abcBarParent = null;
let __abcBarNext = null;
let __abcBtnParent = null;
let __abcBtnNext = null;

function abcPortalBarraOn() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");
  if (!bar) return;

  if (!__abcBarParent) {
    __abcBarParent = bar.parentNode;
    __abcBarNext = bar.nextSibling;
  }
  if (btn && !__abcBtnParent) {
    __abcBtnParent = btn.parentNode;
    __abcBtnNext = btn.nextSibling;
  }

  document.body.appendChild(bar);
  if (btn) document.body.appendChild(btn);

  bar.style.display = "";
  bar.style.visibility = "visible";
  bar.style.opacity = "1";
  bar.style.position = "fixed";
  bar.style.left = "0";
  bar.style.right = "0";
  bar.style.bottom = "0";
  bar.style.zIndex = "9999";

  if (btn) btn.style.display = "";
}

function abcPortalBarraOff() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");

  if (bar && __abcBarParent) {
    if (__abcBarNext) __abcBarParent.insertBefore(bar, __abcBarNext);
    else __abcBarParent.appendChild(bar);

    bar.style.position = "";
    bar.style.left = "";
    bar.style.right = "";
    bar.style.bottom = "";
    bar.style.zIndex = "";
    bar.style.opacity = "";
    bar.style.visibility = "";
    bar.style.display = "";
  }

  if (btn && __abcBtnParent) {
    if (__abcBtnNext) __abcBtnParent.insertBefore(btn, __abcBtnNext);
    else __abcBtnParent.appendChild(btn);
    btn.style.display = "";
  }
}

// -------------------------
// ✅ ABC: enganchar botones de barra
// -------------------------
function abcUIEnABC(){
  const btnPin   = document.getElementById("btnModoMarcadorBarra");
  const btnCheck = document.getElementById("btnGuardarMarcador");
  const btnLista = document.getElementById("btnListaMarcadores");

  if (btnPin) {
    btnPin.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abcToggleModoMarcador(); };
  }

  if (btnCheck) {
    btnCheck.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!abcModoMarcador) return abcToast("Activá 📌 y seleccioná bloques");
      abcAbrirModalBibliaParaNota();
    };
  }

if (btnLista) {
  btnLista.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    abcAbrirListaNotasABC(); // ✅ abre el modal como Biblia, pero filtrado a ABC
  };
}

  abcAplicarUIAccionesPorModo();
}

// -------------------------
// ✅ Hooks ABC
// -------------------------
window.__abcOnEnter = () => {
  abcPortalBarraOn();
  abcAplicarFontSize();
  abcUIEnABC();
};

window.__abcOnExit = () => {
  try { abcResetModoMarcador(); } catch(e){}
  abcPortalBarraOff();

  // si vuelvo a Biblia, que Biblia re-aplique su UI
  const secBiblia = document.getElementById("seccion-biblia");
  const enBiblia = !!(secBiblia && secBiblia.style.display !== "none");
  if (enBiblia && typeof window.aplicarUIAccionesPorModo === "function") {
    window.aplicarUIAccionesPorModo();
  }
};
