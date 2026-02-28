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
const UID = () => {
  // Biblia guarda __UID como string, no función
  if (typeof window.__UID === "function") return window.__UID();
  return window.__UID || null;
};

let abcSeleccionado = null;
let abcColor = "#fff3b0"; // igual que Biblia

function abcPath(base){ return `${base}/${UID()}`; }

// Llamar después de cargar el HTML del tema
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

    abcSeleccionado = b.dataset.bid;
    abcMarcarSeleccionUI();

    const uid = UID();
    const loginModal = document.getElementById("loginModal");
    if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

    // ✅ SI ESTÁ ACTIVO 📌 → SOLO seleccionar, NO pintar, NO despintar
    if (abcModoMarcador === true) return;

    // ✅ Resaltador (💛): pinta/despinta solo si NO hay candado
    if (window.resaltadorBloqueado === true) return;

    const bid = abcSeleccionado;

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
    b.style.outline = (b.dataset.bid === abcSeleccionado) ? "2px solid #4f6fa8" : "none";
    b.style.outlineOffset = "4px";
    b.style.borderRadius = "10px";
  });
}

async function abcQuitarResaltado(bid){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, remove } = API();
  if(!db || !ref || !remove) return;
  await remove(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`));
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

function abcLimpiarFondoBloque(el){
  if (!el) return;
  el.style.background = "transparent";
  // limpiar fondos internos que Word pueda traer
  el.querySelectorAll("*").forEach(x => x.style.background = "transparent");
}

function abcAplicarFondoBloque(el, color){
  if (!el) return;
  el.style.background = color;
  // hijos transparentes para que se vea el bloque parejo
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

  // ✅ cortar escucha anterior si existía
  try{
    if (abcUnsubResaltados) abcUnsubResaltados();
  }catch(e){}

  const r = ref(db, `${abcPath("abcResaltados")}/${abcIndex}`);

  const handler = (snap) => {
    const data = snap.val() || {};
    abcResaltadosCache = data;

        const doc = document.getElementById("abcDoc");
    if (doc) {
      doc.querySelectorAll(".abc-block").forEach(el => abcLimpiarFondoBloque(el));
    }

    abcAplicarResaltadosEnPantalla(data);
  };

  onValue(r, handler);

  // guardamos "unsubscribe" manual
  abcUnsubResaltados = () => {
    try { off(r, "value", handler); } catch(e) {}
  };
}

// =====================================================
// ✅ ABC: NOTAS GUARDADAS EN /marcadores (Mi Panel)
// =====================================================

// id estable por tema+bloque (así “editar” siempre edita la misma)
function abcNotaId(bid){ return `abc_${abcIndex}_${bid}`; }

function abcDataNotaBase(){
  return {
    origen: "abc",
    tipo: "nota",
    fecha: Date.now(),
    // para poder volver desde panel:
    abc: {
      temaIndex: abcIndex,
      temaTitulo: ABC_TEMAS[abcIndex]?.titulo || "",
      html: ABC_TEMAS[abcIndex]?.html || ""
    }
  };
}

async function abcGuardarNotaEnMarcadores(bid, titulo, nota){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;

  const id = abcNotaId(bid);

  const data = {
    ...abcDataNotaBase(),
    titulo: (titulo || "Nota ABC").trim(),
    nota: (nota || "").trim(),
    // compat con panel actual
    libro: "",
    capitulo: 0,
    versiculos: [],     // ABC = sin versículo
    keep: false,
    color: "#fff3b0",
    // extra:
    abcBid: bid
  };

  await set(ref(db, `marcadores/${uid}/${id}`), data);
}

async function abcBorrarNotaEnMarcadores(bid){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, remove } = API();
  if(!db || !ref || !remove) return;

  const id = abcNotaId(bid);
  await remove(ref(db, `marcadores/${uid}/${id}`));
}

// ===== Modal Nota ABC (ya lo tenés en el HTML) =====
let __abcEditTitulo = "";

async function abcAbrirNota(){
  if(!abcSeleccionado) return alert("Tocá un bloque primero 🙂");

  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  const { db } = FB();
  const { ref, get } = API();

  const modal = document.getElementById("abcNotaModal");
  const ta = document.getElementById("abcNotaTexto");
  const info = document.getElementById("abcNotaInfo");
  if (!modal || !ta || !info || !db || !ref || !get) return;

  info.textContent = `Tema: ${ABC_TEMAS[abcIndex]?.titulo || abcIndex} · Bloque: ${abcSeleccionado}`;

  // cargar desde /marcadores
  try{
    const id = abcNotaId(abcSeleccionado);
    const snap = await get(ref(db, `marcadores/${uid}/${id}`));
    const v = snap.exists() ? (snap.val() || {}) : {};
    __abcEditTitulo = (v.titulo || "Nota ABC");
    ta.value = v.nota || "";
  }catch(e){
    __abcEditTitulo = "Nota ABC";
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
  if (!ta || !abcSeleccionado) return;
  await abcGuardarNotaEnMarcadores(abcSeleccionado, __abcEditTitulo || "Nota ABC", ta.value);
  abcCerrarNota();
}

async function abcEliminarNota(){
  if (!abcSeleccionado) return;
  await abcBorrarNotaEnMarcadores(abcSeleccionado);
  abcCerrarNota();
}
  
  // ✅ Exponer para onclick inline
window.abcCerrarNota = abcCerrarNota;
window.abcEliminarNota = abcEliminarNota;
window.abcGuardarNotaDesdeModal = abcGuardarNotaDesdeModal;
window.abcAbrirNota = abcAbrirNota;

// =====================================================
// ✅ ABC: LISTA DE NOTAS (MODAL estilo Biblia)
// (reusa el modalMarcadores si existe)
// =====================================================
window.abcAbrirListaNotasModal = () => {
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  // Si existe el modal de Biblia, lo reutilizamos (se ve igual)
  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form  = document.getElementById("formNuevoMarcador");

  if (!modal || !lista || !form) {
    alert("No encontré el modal de Marcadores de Biblia (modalMarcadores).");
    return;
  }

  // abrir lista
  form.style.display = "none";
  lista.style.display = "block";

  // render especial: solo notas ABC del tema actual
  abcRenderListaNotasEnModalBiblia();

  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
};

function abcRenderListaNotasEnModalBiblia(){
  const lista = document.getElementById("listaMarcadores");
  if (!lista) return;

  const uid = UID();
  const data = window.marcadores || {};

  const items = Object.entries(data)
    .map(([id, m]) => ({...m, id}))
    .filter(m => m?.origen === "abc" && m?.abc?.temaIndex === abcIndex)
    .sort((a,b)=> (b.fecha||0) - (a.fecha||0));

  const tituloTema = ABC_TEMAS[abcIndex]?.titulo || "ABC";

  // CTA: “Tocá un bloque y apretá ✓”
  const header = `
    <div class="card-marcador" style="background:#fff3b0;">
      <b>Notas ABC · ${tituloTema}</b><br>
      <span class="muted">Para crear/editar: activá 📌, tocá un bloque, y apretá ✓</span>
    </div>
  `;

  if (!items.length){
    lista.innerHTML = header + `<p class="muted">Todavía no guardaste notas en este tema.</p>`;
    return;
  }

  lista.innerHTML = header + items.map(m => {
    const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleDateString("es-AR") : "";
    const t = (m.titulo || "Nota ABC").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const linea = `${t} - ${fechaTxt}`;

    return `
      <div class="card-marcador" style="cursor:pointer;" onclick="abcIrNotaDesdeLista('${m.abcBid || ''}')">
        <div style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${linea}
        </div>
      </div>
    `;
  }).join("");
}

window.abcIrNotaDesdeLista = async (bid) => {
  // cerrar modal de marcadores
  const modal = document.getElementById("modalMarcadores");
  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
  }

  // si no hay bid, solo cerramos
  if (!bid) return;

  // seleccionar bloque, scrollear, abrir nota
  abcSeleccionado = bid;
  abcMarcarSeleccionUI();

  const doc = document.getElementById("abcDoc");
  const el = doc ? doc.querySelector(`.abc-block[data-bid="${bid}"]`) : null;
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"center" });

  // abrir modal nota
  setTimeout(()=> abcAbrirNota(), 150);
};

// ✅ Exponer handlers para onclick inline (necesario si el script es module)
window.abcCerrarNota = abcCerrarNota;
window.abcEliminarNota = abcEliminarNota;
window.abcGuardarNotaDesdeModal = abcGuardarNotaDesdeModal;
window.abcAbrirNota = abcAbrirNota;

// =====================================================
// ✅ ABC: INTEGRACIÓN CON BARRA (SIN PISAR FUNCIONES DE BIBLIA)
// =====================================================

// ---------- estado ABC ----------
let abcModoMarcador = false;
let abcFontSize = 18; // default
let abcBarObserver = null;

function estoyEnABC(){
  const sec = document.getElementById("seccion-iglesia");
  const abc = document.getElementById("iglesia-abc");
  return !!(sec && sec.style.display !== "none" && abc && abc.style.display !== "none");
}

function abcAplicarFontSize(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;
  doc.style.setProperty("--abc-font", abcFontSize + "px");
}

function abcConectarMasMenos() {
  const btnMas = document.getElementById("btnMas");
  const btnMenos = document.getElementById("btnMenos");

  if (btnMas) {
    btnMas.onclick = (e) => {
      if (!estoyEnABC()) return; // ✅ en otras secciones no hace nada
      e.preventDefault(); e.stopPropagation();
      abcFontSize = Math.min(28, (abcFontSize || 18) + 1);
      abcAplicarFontSize();
    };
  }

  if (btnMenos) {
    btnMenos.onclick = (e) => {
      if (!estoyEnABC()) return;
      e.preventDefault(); e.stopPropagation();
      abcFontSize = Math.max(12, (abcFontSize || 18) - 1);
      abcAplicarFontSize();
    };
  }
}

// =====================================================
// ✅ PORTAL: mover barra al body para que no dependa del display:none
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

  document.body.appendChild(bar);
  if (btn) document.body.appendChild(btn);

  // visible y fijo abajo
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

  if (bar && __abcBarParent) {
    if (__abcBarNext) __abcBarParent.insertBefore(bar, __abcBarNext);
    else __abcBarParent.appendChild(bar);

    // ✅ reset estilos que ABC fijó
    bar.style.position = "";
    bar.style.left = "";
    bar.style.right = "";
    bar.style.bottom = "";
    bar.style.zIndex = "";
    bar.style.opacity = "";
    bar.style.visibility = "";
  }

  if (btn && __abcBtnParent) {
    if (__abcBtnNext) __abcBtnParent.insertBefore(btn, __abcBtnNext);
    else __abcBtnParent.appendChild(btn);
  }

  // ✅ cortar observer si existía
  if (abcBarObserver) {
    try { abcBarObserver.disconnect(); } catch (e) {}
    abcBarObserver = null;
  }

  // ✅ CLAVE: como la barra es SOLO Biblia+ABC, si NO estoy en Biblia => ocultar
  const secBiblia = document.getElementById("seccion-biblia");
  const estoyEnBiblia = !!(secBiblia && secBiblia.style.display !== "none");

  if (bar && !estoyEnBiblia) {
    bar.style.display = "none";
  }
  if (btn && !estoyEnBiblia) {
    btn.style.display = "none";
  }
}

// =====================================================
// ✅ ABC: UI barra (oculta imagen, y define acciones ABC)
// =====================================================
function abcHideImagenButtonsSiempre(){
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear  = document.getElementById("btnCrearImagen");

  if (btnImagen) {
    btnImagen.style.display = "none";
    btnImagen.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  }
  if (btnCrear) {
    btnCrear.style.display = "none";
    btnCrear.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  }
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

function abcRefrescarBarraABC(){
  const btnGuardar = document.getElementById("btnGuardarMarcador");     // ✓
  const btnLista   = document.getElementById("btnListaMarcadores");     // lista
  const btnPin     = document.getElementById("btnModoMarcadorBarra");   // 📌

  // ❌ botones de imagen (SIEMPRE ocultos en ABC)
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear  = document.getElementById("btnCrearImagen");
  if (btnImagen) btnImagen.style.display = "none";
  if (btnCrear)  btnCrear.style.display  = "none";

  // Otros botones que NO deben verse en modo marcador (ajustá ids si alguno difiere)
  const otros = [
    "btnCopiar", "btnCompartir", "btnAudio", "btnLeer",
    "btnDescargar",
    "btnMas", "btnMenos"
  ].map(id => document.getElementById(id)).filter(Boolean);

  // En ABC siempre mostramos 📌
  if (btnPin) btnPin.style.display = "inline-flex";

  if (abcModoMarcador) {
    // ✅ modo marcador: SOLO 📌 y ✓
    if (btnGuardar) btnGuardar.style.display = "inline-flex";
    if (btnLista)   btnLista.style.display   = "none";
    otros.forEach(el => el.style.display = "none");
  } else {
    // ✅ normal: 📌 + lista; ✓ oculto
    if (btnGuardar) btnGuardar.style.display = "none";
    if (btnLista)   btnLista.style.display   = "inline-flex";
    otros.forEach(el => el.style.display = ""); // vuelve a lo normal
  }

  // ✅ por las dudas: volver a esconder imagen al final (si otro código “lo revive”)
  if (btnImagen) btnImagen.style.display = "none";
  if (btnCrear)  btnCrear.style.display  = "none";
}

function abcUIEnABC(){
  // ✅ esconder imagen siempre (aunque biblia la muestre)
  abcHideImagenButtonsSiempre();

  const btnGuardar = document.getElementById("btnGuardarMarcador");     // ✓
  const btnPin     = document.getElementById("btnModoMarcadorBarra");   // 📌
  const btnLista   = document.getElementById("btnListaMarcadores");     // lista

  // ✓ abre nota del bloque (solo útil en modo marcador)
if (btnGuardar) {
  btnGuardar.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!abcModoMarcador) {
      abcToast("Activá 📌 y tocá un bloque");
      return;
    }

    if (!abcSeleccionado) {
      abcToast("Primero tocá un bloque 🙂");
      return;
    }

    abcAbrirNota();
  };
}

  // lista abre “lista de notas” estilo Biblia (modal)
 if (btnLista) {
  btnLista.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // ✅ en ABC, la lista abre el Panel de Marcadores filtrado en "abc"
    irA("panel");
setTimeout(() => {
  mostrarSeccion?.("marcadores");

  // ✅ crea si no existe
  window.filtroNotasPanel = "abc";

  // ✅ si existe la función, renderiza
  if (typeof window.renderPanelMarcadores === "function") {
    window.renderPanelMarcadores();
  }
}, 0);
  };
}
  
  // 📌 toggle modo marcador ABC
  if (btnPin) {
    btnPin.style.display = "inline-flex";
    btnPin.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      abcToggleModoMarcador();
    };
  }

  abcRefrescarBarraABC();

  // ✅ watchdog: si algo intenta volver a mostrar “Crear imagen”, lo escondemos
  if (!abcBarObserver) {
    const bar = document.getElementById("accionesBiblia");
    if (bar) {
      abcBarObserver = new MutationObserver(() => abcHideImagenButtonsSiempre());
      abcBarObserver.observe(bar, { attributes:true, childList:true, subtree:true });
    }
  }
}

function abcToggleModoMarcador(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  abcModoMarcador = !abcModoMarcador;
  document.body.classList.toggle("modo-marcador", abcModoMarcador);

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) {
    btn.classList.toggle("activo", abcModoMarcador);
    // ✅ sacar focus pegado en cel
    btn.blur && btn.blur();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }

  if (abcModoMarcador) abcToast("📌 Tocá un bloque y apretá ✓ para escribir una nota");
  abcRefrescarBarraABC();
}

// =====================================================
// ✅ Hook al entrar a ABC (lo llamás desde mostrarABC)
// =====================================================
window.__abcOnEnter = () => {
  abcPortalBarraOn();
  abcAplicarFontSize();
  abcUIEnABC();
  abcConectarMasMenos(); // ✅
};

// ✅ si tenés un “onExit” de Iglesia, llamá esto al salir de ABC
window.__abcOnExit = () => {
  abcPortalBarraOff();
};

