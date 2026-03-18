// devocionales.js (NUEVO LIMPIO)
// ✅ OCR + Recorte + Modal 3 fases (9:9 + 9:7 => 9:16)
// ✅ NO toca biblia.js
// ✅ Reusa modalAudio existente (si está cargado biblia.audio.js)

const OCR_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ocrDevocional";
const GH_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirAudioDevocionalGithub";
const TTS_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ttsAudio";
console.log("✅ devocionales.js cargó (module)", "VERSION 1");
window.__DEV_DEVOCIONALES_LOADED__ = true;

function $(id){ return document.getElementById(id); }

/* =========================================================
   0) ESTADO GLOBAL DEV
   ========================================================= */
const DEV = {
  img: null,
  canvas: null,
  ctx: null,
  recortando: false,
  drawing: false,
  start: null,
  crop: null,

  // texto y bloques
  rawText: "",
  // ====== CAMPOS EDITABLES (FASE 0) ======
  fields: {
    fecha: "",
    versiculo: "",
    cita: "",
    reflexion: "",
    oracion: ""
  },
   
  bloque1: "",
  bloque2: "",
  audioText: "",
  p1: null,
  p2: null,

  // fase1 (9:9) settings
  f1: {
  fondoUrl: null,
  fondoBlob: null,
  fuente: "Roboto",
  color: "#000000",
  opColor: "#000000",
  op: 0.35,
  size: 30,
  style: { upper:false, bold:true, italic:false, underline:false }
},

  // fase2 (9:7) settings
  f2: {
    fondoColor: "#ffffff",
    fuente: "Roboto",
    color: "#000000",
    op: 0.15,
    size: 26,
    userChanged: false,
    adornoUrl: null,
    adornoWidth: 70,
    style: { upper:false, bold:false, italic:false, underline:false }
  },

  // audio gate
  audioOk: false,

  // final image
  finalDataUrl: "",

  // ✅ ESTAS DOS TENÍAN QUE ESTAR ADENTRO
  subirPanel: false,
  audioGithubUrl: "",

  // modal 0 preview
  cropPreviewUrl: null,

   publicando: false,
   publishTs: 0
};

/* =========================================================
   1) OCR UI helpers
   ========================================================= */
function ocrSetStatus(msg){
  const el = $("estadoOCRDev");
  if (el) el.textContent = msg || "";
}

function show(id, on){
  const el = $(id);
  if (!el) return;
  el.classList.toggle("hidden", !on);
}

function devMostrarHome(){
  const home = $("devHome");
  const crear = $("devCrear");
  if (home) home.style.display = "block";
  if (crear) crear.style.display = "none";

  // ✅ reset recorte para que no “quede activo”
  DEV.recortando = false;
  DEV.drawing = false;
  DEV.start = null;
  DEV.crop = null;

  show("devCanvasBox", false);
  show("devTextoBox", false);

  // opcional: limpiar input file
  const inp = $("devImg");
  if (inp) inp.value = "";
}

function devMostrarCrear(){
  const home = $("devHome");
  const crear = $("devCrear");
  if (home) home.style.display = "none";
  if (crear) crear.style.display = "block";
}

/* =========================================================
   2) RECORTE (canvas)
   ========================================================= */
function fitCanvasToImage(image, maxW = 420) {
  const c = DEV.canvas;
  const scale = Math.min(1, maxW / image.width);
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
}

function draw() {
  const { img, canvas, ctx, crop } = DEV;
  if (!img || !canvas || !ctx) return;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img, 0,0, canvas.width, canvas.height);

  if (crop) {
    ctx.save();
    ctx.strokeStyle = "#4f6fa8";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.rect(0,0,canvas.width,canvas.height);
    ctx.rect(crop.x,crop.y,crop.w,crop.h);
    ctx.fill("evenodd");
    ctx.restore();
  }
}

function normalizeRect(a,b){
  const x = Math.min(a.x,b.x);
  const y = Math.min(a.y,b.y);
  const w = Math.abs(a.x-b.x);
  const h = Math.abs(a.y-b.y);
  return {x,y,w,h};
}

function canvasPointFromClient(clientX, clientY){
  const r = DEV.canvas.getBoundingClientRect();
  const x = (clientX - r.left) * (DEV.canvas.width / r.width);
  const y = (clientY - r.top) * (DEV.canvas.height / r.height);
  return {x,y};
}

function bindPointerCropEvents(){
  const canvas = DEV.canvas;
  if (!canvas) return;
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (e)=>{
    if (!DEV.recortando || !DEV.img) return;
    canvas.setPointerCapture?.(e.pointerId);
    DEV.drawing = true;
    DEV.start = canvasPointFromClient(e.clientX, e.clientY);
    DEV.crop = { x: DEV.start.x, y: DEV.start.y, w: 1, h: 1 };
    draw();
    e.preventDefault();
  }, {passive:false});

  canvas.addEventListener("pointermove", (e)=>{
    if (!DEV.recortando || !DEV.img || !DEV.drawing || !DEV.start) return;
    const p = canvasPointFromClient(e.clientX, e.clientY);
    DEV.crop = normalizeRect(DEV.start, p);
    draw();
    e.preventDefault();
  }, {passive:false});

  const end = (e)=>{
    if (!DEV.recortando || !DEV.drawing) return;
    DEV.drawing = false;
    DEV.start = null;

    if (DEV.crop && (DEV.crop.w < 10 || DEV.crop.h < 10)) {
      DEV.crop = null;
      draw();
    }
    e.preventDefault?.();
  };

  canvas.addEventListener("pointerup", end, {passive:false});
  canvas.addEventListener("pointercancel", end, {passive:false});
  canvas.addEventListener("pointerleave", end, {passive:false});
}

async function getCroppedBlob(){
  if (!DEV.img || !DEV.canvas) return null;

  const r = (DEV.crop && DEV.crop.w > 10 && DEV.crop.h > 10)
    ? DEV.crop
    : { x:0, y:0, w:DEV.canvas.width, h:DEV.canvas.height };

  const out = document.createElement("canvas");
  out.width = Math.round(r.w);
  out.height = Math.round(r.h);

  const octx = out.getContext("2d");
  octx.drawImage(
    DEV.canvas,
    r.x, r.y, r.w, r.h,
    0,0, out.width, out.height
  );

  return await new Promise(res => out.toBlob(res, "image/jpeg", 0.92));
}

async function audioElementToBase64(){
  const audioEl =
    document.querySelector("#modalAudio audio") ||
    document.querySelector("audio#audioPreview") ||
    document.querySelector("audio");

  const src = audioEl?.currentSrc || audioEl?.src || "";
  if (!src) return null;

  const r = await fetch(src);
  if (!r.ok) throw new Error("No pude leer el audio para subirlo");

  const blob = await r.blob();
  const b64 = await blobToBase64(blob); // reutiliza tu helper
  return { base64: b64, blob };
}

async function subirAudioAGithubDesdeWeb(audioBase64){
  const d = new Date();

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(yyyy).slice(-2);

  // ✅ nombre del mp3 en formato que la página entiende
  const fileName = `devocional_${yyyy}-${mm}-${dd}.mp3`;

  // ✅ texto visible en JSON
  const title = `${dd}/${mm}/${yy}`;

  const r = await fetch(GH_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audioBase64,
      fileName,
      title
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok) {
    throw new Error(data?.error || data?.detail || "No se pudo subir a GitHub");
  }
  return data;
}

async function blobToBase64(blob){
  return await new Promise((resolve,reject)=>{
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = ()=>{
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.readAsDataURL(blob);
  });
}

/* =========================================================
   3) LIMPIEZA Y SALTOS DE TEXTO OCR (tus reglas)
   ========================================================= */
function oneLine(s){
  // Convierte saltos OCR en espacios y limpia dobles espacios
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function keepManualBreaks(s){
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, "\n")   // ✅ doble enter o más = un solo salto real
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function ensurePeriod(s){
  s = oneLine(s);
  if (!s) return "";
  return /[.!?…]$/.test(s) ? s : (s + ".");
}

function buildAudioFromParts(p1, p2){
  const reflex = oneLine(p2?.reflexion || "");
  const orac   = oneLine(p2?.oracion || "");

  const fecha = ensurePeriod(p1?.fecha || "");
  const cita  = ensurePeriod(p1?.cita || "");

  return [
    "DEVOCIONAL",
    fecha,
    "",
    oneLine(p1?.versiculo || ""),
    cita,
    "",
    `Reflexión: ${reflex} Oración: ${orac}`.trim()
  ].join("\n").trim();
}

/* =========================================================
   3) PARSEO DE TEXTO OCR (tus reglas)
   ========================================================= */
function normText(t){
  return String(t || "")
    .replace(/\r/g,"")
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function detectCita(line){
  // intenta detectar referencias típicas: "Mateo 19:13-14", "MATEO 19:13–14", "Jn 3:16", etc.
  const s = (line || "").trim();
  return /([1-3]\s*)?[A-Za-zÁÉÍÓÚÑáéíóúñ\.]+\s+\d+\s*:\s*\d+/i.test(s);
}

function onlyLetters(s){
  return (s || "").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
}

function isMostlyUpper(line){
  const s = (line || "").trim();
  if (!s) return false;

  // si parece cita (Mateo 3:16) NO lo tomamos como versículo
  if (detectCita(s)) return false;

  // letras (incluye acentos)
  const letters = (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []);
  if (letters.length < 6) return false;

  // ✅ REGLA FUERTE:
  // si aparece alguna minúscula, NO es versículo
  const hasLower = letters.some(ch => ch === ch.toLowerCase() && ch !== ch.toUpperCase());
  if (hasLower) return false;

  // si llegamos acá, es todo MAYÚSCULA (o sin letras)
  return true;
}

function stripTailLogoJunk(lines){
  const out = lines.slice();
  while (out.length && isLogoJunk(out[out.length - 1])) out.pop();
  return out;
}

function isLogoJunk(line){
  const s = (line || "").trim();
  if (!s) return true;

  const up = s.toUpperCase();

  // ✅ 1) basura conocida explícita
  const basuraExacta = [
    "ANA",
    "ABUNDANTS",
    "DE LA VID",
    "DE LA VIDA",
    "DE",
    "DE LA",
    "VIDA",
    "VIDA ABUNDANTE",
    "DE LA VIDA ABUNDANTE",
    "IGLESIA CRISTIANA DE LA VIDA ABUNDANTE"
  ];

  if (basuraExacta.includes(up)) return true;

  // ✅ 2) líneas MUY cortas (pero solo si no tienen signos ni números)
  const lettersOnly = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, "");
  const hasSignos = /[¿?¡!]/.test(s);
  const hasNumeros = /\d/.test(s);

  if (!hasSignos && !hasNumeros && lettersOnly.length > 0 && lettersOnly.length <= 5) {
    return true;
  }

  return false;
}

function findOracionLineIndex(lines){
  return lines.findIndex(l =>
    /^[^\w]*oraci[oó]n\b/i.test((l || "").trim())
  );
}

function cleanOracionHeader(line){
  return (line || "")
    .replace(/^[^\w]*oraci[oó]n\s*:?\s*/i, "")
    .trim();
}

function extractVerseBlock(body){
  // busca el ÚLTIMO bloque consecutivo en MAYÚSCULAS (versículo)
  let end = -1;
  for (let i = body.length - 1; i >= 0; i--) {
    if (isMostlyUpper(body[i])) { end = i; break; }
  }
  if (end === -1) return { verseStart: -1, verseLines: [] };

  let start = end;
  while (start - 1 >= 0 && isMostlyUpper(body[start - 1])) start--;

  let verseLines = body.slice(start, end + 1).map(x => x.trim()).filter(Boolean);

  // quitar basura del logo al comienzo del versículo
  while (verseLines.length && isLogoJunk(verseLines[0])) verseLines.shift();

  return { verseStart: start, verseLines };
}

function buildBloquesFromOCR(raw){
  const t = normText(raw);
  const lines = t.split("\n").map(x => x.trim()).filter(Boolean);

  const fecha = lines[0] || "";

  // cita = última línea que parezca cita; si no, última línea igual
  let cita = lines[lines.length - 1] || "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (detectCita(lines[i])) { cita = lines[i]; break; }
  }

  // body = todo lo que queda entre fecha y cita
  // (si cita está al final, esto funciona perfecto)
  const body = lines.slice(1, lines.length - 1);

  // detectar versículo como último bloque en mayúsculas dentro del body
  const { verseStart, verseLines } = extractVerseBlock(body);

  // si no encontró versículo, fallback: cuerpo entero
 const versiculo = verseLines.length ? verseLines.join(" ") : "(REVISAR: versículo no detectado en MAYÚSCULAS)";

  // fase 2: reflexión y oración
  let reflexion = "";
  let oracion = "";

  // El bloque de reflexión/oración termina justo antes de verseStart
 const bodyAntesDelVerso = stripTailLogoJunk(
  (verseStart >= 0) ? body.slice(0, verseStart) : body.slice()
  );

  const idxOr = findOracionLineIndex(bodyAntesDelVerso);

  if (idxOr >= 0) {
    reflexion = bodyAntesDelVerso.slice(0, idxOr).join(" ").trim();

    const orLines = bodyAntesDelVerso.slice(idxOr);
    if (orLines.length) {
      // primera línea: quitar "◾ Oración"
      orLines[0] = cleanOracionHeader(orLines[0]);
  }
    oracion = orLines.join(" ").trim();
  } else {
    // si no encontró "Oración", todo es reflexión
    reflexion = bodyAntesDelVerso.join(" ").trim();
    oracion = "";
  }

  // Limpieza extra: a veces queda basura del logo mezclada arriba de reflexión
    reflexion = oneLine(
    reflexion
    .split("\n")
    .filter(l => !isLogoJunk(l))
    .join(" ")
 );

  // Partes estructuradas (NO un string gigante)
  const p1 = {
    fecha,
    versiculo,
    cita,
    iglesia: "Iglesia Cristiana de la Vida Abundante",
    direccion: "Roca 123, Tristan Suarez."
  };

  const p2 = {
    reflexion,
    oracion
  };

  // texto para audio (simple, legible)
  const audioText = buildAudioFromParts(p1, p2);
  return { p1, p2, audioText };
}

/* =========================================================
   FASE 0 — CAMPOS EDITABLES (sync texto <-> campos)
   ========================================================= */

// Lee inputs de Fase 0 hacia DEV.fields
function devReadFieldsFromUI(){
  DEV.fields.fecha     = keepManualBreaks($("dev0Fecha")?.value || "");
  DEV.fields.versiculo = keepManualBreaks($("dev0Versiculo")?.value || "");
  DEV.fields.cita      = keepManualBreaks($("dev0Cita")?.value || "");
  DEV.fields.reflexion = keepManualBreaks($("dev0Reflexion")?.value || "");
  DEV.fields.oracion   = keepManualBreaks($("dev0Oracion")?.value || "");
}

// Escribe DEV.fields hacia inputs de Fase 0
function devWriteFieldsToUI(){
  const f = DEV.fields || {};
  const set = (id,val)=>{ const el=$(id); if(el) el.value = val || ""; };

  set("dev0Fecha", f.fecha);
  set("dev0Versiculo", f.versiculo);
  set("dev0Cita", f.cita);
  set("dev0Reflexion", f.reflexion);
  set("dev0Oracion", f.oracion);
}

// Toma el texto completo (dev0Texto) y re-detecta campos usando tu parser
window.devReparseFase0 = () => {
  const t0 = ($("dev0Texto")?.value || "").trim();
  if (!t0) { alert("No hay texto en el OCR completo."); return; }

  DEV.rawText = t0;
  const { p1, p2, audioText } = buildBloquesFromOCR(t0);

  // actualizar fields desde parser
  DEV.fields.fecha     = p1?.fecha || "";
  DEV.fields.versiculo = p1?.versiculo || "";
  DEV.fields.cita      = p1?.cita || "";
  DEV.fields.reflexion = p2?.reflexion || "";
  DEV.fields.oracion   = p2?.oracion || "";

  devWriteFieldsToUI();

  // también guarda DEV.p1/p2 tentativo (se confirma al pasar a fase1)
  DEV.p1 = p1;
  DEV.p2 = p2;
  DEV.audioText = audioText;

  alert("✅ Listo. Campos re-detectados. (Podés corregirlos manualmente)");
};

// Aplica fields (manuales) a DEV.p1/p2 y arma audioText SIEMPRE desde fields
function devApplyFieldsToParts(){
  devReadFieldsFromUI();

  const f = DEV.fields;

  DEV.p1 = {
    fecha: f.fecha || "",
    versiculo: f.versiculo || "",
    cita: f.cita || "",
    iglesia: "Iglesia Cristiana de la Vida Abundante",
    direccion: "Roca 123, Tristan Suarez."
  };

  DEV.p2 = {
    reflexion: f.reflexion || "",
    oracion: f.oracion || ""
  };

  DEV.audioText = buildAudioFromParts(DEV.p1, DEV.p2);
}

/* =========================================================
   4) MODALES (abrir/cerrar)  ✅ SOLO con .abierto (como Biblia)
   ========================================================= */
function abrirModal(id){
  const m = $(id);
  if (!m) return;

  // ✅ abrir SOLO con clase
  m.classList.add("abierto");
  m.setAttribute("aria-hidden","false");

  // ✅ bloquear scroll del body
  document.body.classList.add("modal-open");
}

function cerrarModal(id){
  const m = $(id);
  if (!m) return;

  // ✅ cerrar SOLO con clase
  m.classList.remove("abierto");
  m.setAttribute("aria-hidden","true");

  // ✅ liberar body si ya no hay ningún modal abierto
  const alguno = document.querySelector(".modal-overlay.abierto");
  if (!alguno) document.body.classList.remove("modal-open");
}

window.devCerrarTodo = () => {
  ["modalDevFase0","modalDevFase1","modalDevFase2","modalDevFase3"].forEach(cerrarModal);

  DEV.audioOk = false;
  devSetFinalButtons(false);

  // ✅ volver al Home (NO recorte)
  devMostrarHome();
};

/* =========================================================
   5) FUENTES (igual que Biblia pero separado)
   ========================================================= */
const fuentesGoogle = [
  { nombre: "Roboto", css: "Roboto" },
  { nombre: "Lobster", css: "Lobster" },
  { nombre: "Playfair Display", css: "'Playfair Display'" },
  { nombre: "Montserrat", css: "Montserrat" },
  { nombre: "Poppins", css: "Poppins" },
  { nombre: "Abril Fatface", css: "'Abril Fatface'" },
  { nombre: "Cormorant", css: "Cormorant" },
  { nombre: "Josefin Sans", css: "'Josefin Sans'" },
  { nombre: "Great Vibes", css: "'Great Vibes'" }
];

function crearListaFuentes(fase){
  const btn = $(`dev${fase}BtnFuentes`);
  const lista = $(`dev${fase}ListaFuentes`);
  const modalBox = document.querySelector(`#modalDevFase${fase} .modal-contenido`);
  if (!btn || !lista || !modalBox) return;

  lista.innerHTML = "";
  const st = (fase===1) ? DEV.f1 : DEV.f2;

  fuentesGoogle.forEach(f=>{
    const b = document.createElement("button");
    b.textContent = f.nombre;
    b.style.fontFamily = f.css;
    if (st.fuente === f.css) b.classList.add("activo");

    b.onclick = (e)=>{
      e.preventDefault(); e.stopPropagation();
      st.fuente = f.css;
      lista.querySelectorAll("button").forEach(x=>x.classList.remove("activo"));
      b.classList.add("activo");
      lista.classList.remove("abierto");
      btn.classList.remove("activo");
      devRenderFase(fase);
    };

    lista.appendChild(b);
  });

  const posicionar = ()=>{
    const rModal = modalBox.getBoundingClientRect();
    const rBtn = btn.getBoundingClientRect();
    const pad = 12;
    lista.style.left = (rModal.left + pad) + "px";
    lista.style.width = (rModal.width - pad*2) + "px";
    lista.style.top = (rBtn.bottom + 8) + "px";
  };

  btn.onclick = (e)=>{
    e.preventDefault(); e.stopPropagation();
    const open = lista.classList.toggle("abierto");
    btn.classList.toggle("activo", open);
    if (open) posicionar();
  };

  window.addEventListener("resize", ()=>{ if (lista.classList.contains("abierto")) posicionar(); });
  window.addEventListener("scroll", ()=>{ if (lista.classList.contains("abierto")) posicionar(); }, true);

  document.addEventListener("click", (e)=>{
    if (!lista.contains(e.target) && e.target !== btn) {
      lista.classList.remove("abierto");
      btn.classList.remove("activo");
    }
  });
}

/* =========================================================
   6) FONDOS (fase 1)
   ========================================================= */
const fondos = [
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puente_gox2gz.jpg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_qttkkt",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_l02emm",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertaflroesvioletas_q4f1bq",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertaangostaflores_fvdw8o",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertafloresblancas_ouomif",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puenteotoñoagua_r9tskw",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/rosabotes_bwnvws",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/playaarenamarolas_oxkh2z",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/plazaamanecer_nvjtqa",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/piedrasaguamontañas_lseoki",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/pastofloresrosas_i0woqq",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/otoño_kdx8u5",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/otoño2_mwn77p",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/mariposas_mmo86f",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/cielocelesterosaarboles_y4t720",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresamarillas_mhosyy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/faro_aginuk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/faro2_s5ynwu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/montaña_c455zz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/olascielo_igbddx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/montañagrande_vwag5k",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/camino_madnav",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/margaritasporton_wnpdps",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/lilamontañasflores_vayxei",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/casitalejosarboles_by72rz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/bebedero_ystc1u",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/jardinflores_eqxwe5",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/casita_sxlvcf",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/boda_nmzaub",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arcoflores_lnrfa9",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arbustos_pwdcsk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresmontañas_h8qhkd",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresfucsias_f17kul",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arcadafloresrosas_fc4aj4",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/amarillopajarosnubes_ar0qqg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresblancasyrosas_ehpvfy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_kpgvmm",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_kupglf",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_a1wlsh",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_hnxuau",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_brmypi",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_xubjvd",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_9_b3tkxx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_jhrx0j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_8_ivok7j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_12_crdynt",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_15_iu1uxj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_14_iww2jx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_13_dzxm4k",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_11_z3nudj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_10_scjlfu"
];

async function urlToBlobURL(url){
  const res = await fetch(url, { mode:"cors", cache:"no-store" });
  if (!res.ok) throw new Error("Fondo no disponible (CORS/404)");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function cargarFondosDev(){
  const cont = $("dev1Fondos");
  if (!cont) return;
  cont.innerHTML = "";

  fondos.forEach(base=>{
    const finalUrl = base.includes("?")
      ? base + "&auto=format&fit=crop&w=900&q=80"
      : base + "?auto=format&fit=crop&w=900&q=80";

    const im = document.createElement("img");
    im.crossOrigin = "anonymous";
    im.referrerPolicy = "no-referrer";
    im.src = finalUrl;

    im.onclick = async ()=>{
      try{
        // limpiar blob anterior
        if (DEV.f1.fondoBlob) URL.revokeObjectURL(DEV.f1.fondoBlob);
        DEV.f1.fondoUrl = null;              // ✅ no guardes la url si ya tenés blob
        DEV.f1.fondoBlob = await urlToBlobURL(finalUrl);

        cont.querySelectorAll("img").forEach(x=>x.classList.remove("activo"));
        im.classList.add("activo");

        devRenderFase(1);
        } catch (e) {
        console.error("Fondo error real:", e);

        DEV.f1.fondoUrl = null;
        if (DEV.f1.fondoBlob) URL.revokeObjectURL(DEV.f1.fondoBlob);
        DEV.f1.fondoBlob = null;

       alert("No se pudo usar este fondo.\n\nDetalle: " + (e?.message || e));
       devRenderFase(1);
}
    };

    cont.appendChild(im);
  });
}

// =========================
// ADORNOS FASE 2
// =========================
const adornosF2 = [
  { nombre: "Ninguno", url: null },
  { nombre: "Adorno 1", url: "./img/ornamentos/adorno1.png" },
  { nombre: "Adorno 2", url: "./img/ornamentos/adorno2.png" },
  { nombre: "Adorno 3", url: "./img/ornamentos/adorno3.png" },
  { nombre: "Adorno 4", url: "./img/ornamentos/adorno4.png" },
  { nombre: "Adorno 5", url: "./img/ornamentos/adorno5.png" },
  { nombre: "Adorno 6", url: "./img/ornamentos/adorno6.png" },
  { nombre: "Adorno 7", url: "./img/ornamentos/adorno7.png" },
  { nombre: "Adorno 8", url: "./img/ornamentos/adorno8.png" },
  { nombre: "Adorno 9", url: "./img/ornamentos/adorno9.png" },
  { nombre: "Adorno 10", url: "./img/ornamentos/adorno10.png" }
];

function cargarAdornosF2(){
  const cont = $("dev2Adornos");
  if (!cont) return;

  cont.innerHTML = "";

  adornosF2.forEach(item=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dev-adorno-btn";
    b.textContent = item.nombre;

    if (item.url) {
      // mini imagen adentro del botón
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.nombre;
      img.className = "dev-adorno-thumb";
      b.textContent = ""; // vaciar texto y poner la imagen
      b.appendChild(img);
    }

    // marcar activo
    const activo = (DEV.f2.adornoUrl === item.url);
    b.classList.toggle("activo", activo);

    b.onclick = ()=>{
      DEV.f2.adornoUrl = item.url;
      // refrescar activo
      cont.querySelectorAll("button").forEach(x=>x.classList.remove("activo"));
      b.classList.add("activo");
      devRenderFase(2);
    };

    cont.appendChild(b);
  });
}

/* =========================================================
   7) RENDER PREVIEW (HTML) + COMPOSICION FINAL (canvas)
   ========================================================= */
function outlineColor(hex){
  const h = (hex||"#000000").replace("#","");
  const r = parseInt(h.slice(0,2),16);
  const g = parseInt(h.slice(2,4),16);
  const b = parseInt(h.slice(4,6),16);
  const lum = 0.299*r + 0.587*g + 0.114*b;
  return lum > 160 ? "#000000" : "#ffffff";
}

function textShadowLegible(textHex){
  const oc = outlineColor(textHex || "#000000");
  return `
    -1px 0 ${oc},
     1px 0 ${oc},
     0 -1px ${oc},
     0  1px ${oc},
     0 0 2px ${oc}
  `;
}

function textShadowLegibleFinal(textHex){
  const oc = outlineColor(textHex || "#000000");
  return `
    -2px 0 ${oc},
     2px 0 ${oc},
     0 -2px ${oc},
     0  2px ${oc},
     0 0 3px ${oc}
  `;
}

function applyTextStylesToOne(el, st){
  el.style.textTransform  = st.style.upper ? "uppercase" : "none";
  el.style.fontWeight     = st.style.bold ? "900" : "500"; /* ✅ más fuerte */
  el.style.fontStyle      = st.style.italic ? "italic" : "normal";
  el.style.textDecoration = st.style.underline ? "underline" : "none";
}

function hexToRgb(hex){
  const h = String(hex || "#000000").replace("#", "").trim();
  const full = h.length === 3
    ? h.split("").map(x => x + x).join("")
    : h.padEnd(6, "0").slice(0, 6);

  return {
    r: parseInt(full.slice(0,2), 16) || 0,
    g: parseInt(full.slice(2,4), 16) || 0,
    b: parseInt(full.slice(4,6), 16) || 0
  };
}

function wrapperBgFromOpacity(op, color){
  const x = Math.max(0, Math.min(1, Number(op) || 0));
  const { r, g, b } = hexToRgb(color || "#000000");
  return `rgba(${r}, ${g}, ${b}, ${x})`;
}

function wrapperShadowFromOpacity(op, color){
  const x = Math.max(0, Math.min(1, Number(op) || 0));
  if (x <= 0) return "none";

  const { r, g, b } = hexToRgb(color || "#000000");

  const a1 = Math.min(0.38, x * 0.95);
  const a2 = Math.min(0.24, x * 0.62);
  const a3 = Math.min(0.14, x * 0.34);

  return `
    0 0 16px rgba(${r}, ${g}, ${b}, ${a1}),
    0 0 34px rgba(${r}, ${g}, ${b}, ${a2}),
    0 0 60px rgba(${r}, ${g}, ${b}, ${a3})
  `;
}

function esc(s){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/\n/g, "<br>");
}

function wrapMeasureLines(ctx, text, maxWidth){
  const words = String(text||"").trim().split(/\s+/);
  const lines = [];
  let line = "";

  for (const w of words) {
    const test = line ? (line + " " + w) : w;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundToHalf(x){
  return Math.round(Number(x) * 2) / 2;
}
function fmtSize(x){
  const n = Number(x);
  return (n % 1 === 0) ? String(n.toFixed(0)) : String(n.toFixed(1));
}

function sugerirTamanoVersiculoAuto(versiculo){
  const W = 1080;
  const H = 1080;

  // Caja más parecida a la final real
  const boxH = H * 0.715;
  const boxW = (W * 0.96) - (36 * 2);

  const cita = oneLine(DEV?.p1?.cita || "");
  const vtxt = oneLine(versiculo || "").toUpperCase();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const MAX_PX = 60;
  const MIN_PX = 12;

  for (let px = MAX_PX; px >= MIN_PX; px -= 0.5) {
    ctx.font = `800 ${px}px ${DEV.f1.fuente}, Arial`;
    const vLines = wrapMeasureLines(ctx, vtxt, boxW);
    const vH = vLines.length * (px * 1.02);

    const citaPx = Math.max(12, Math.round(px * 0.75));
    ctx.font = `700 ${citaPx}px ${DEV.f1.fuente}, Arial`;
    const cLines = wrapMeasureLines(ctx, cita, boxW);
    const cH = cLines.length * (citaPx * 1.02);

    const gap = px * 0.14;
    const safety = px * 0.55;

    if ((vH + gap + cH + safety) <= boxH) {
      return Math.max(10, Math.min(90, roundToHalf(px)));
    }
  }

  return Math.max(10, Math.min(90, MIN_PX));
}

function sugerirTamanoFase2Auto(texto){
  const wWrap = $("dev2TextoWrapper");
  if (!wWrap) return 16;

  const rect = wWrap.getBoundingClientRect();
  const maxW = Math.max(100, rect.width * 0.88);
  const altoDisponible = Math.max(80, rect.height * 0.74);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxPx = 18;
  const minPx = 8;

  const limpio = oneLine(texto || "");

  for (let px = maxPx; px >= minPx; px -= 0.5) {
    ctx.font = `600 ${px}px ${DEV.f2.fuente}, Arial`;
    const lines = wrapMeasureLines(ctx, limpio, maxW);
    const lineH = px * 1.22;
    const totalH = lines.length * lineH;

    if (totalH <= altoDisponible) {
      return Math.max(8, roundToHalf(px));
    }
  }

  return 8;
}

function devSyncStyleButtons(fase){
  const st = (fase===1) ? DEV.f1 : DEV.f2;

  const map = {
    upper: `dev${fase}Upper`,
    bold:  `dev${fase}Bold`,
    italic:`dev${fase}Italic`,
    underline:`dev${fase}Under`
  };

  Object.keys(map).forEach(k=>{
    const b = $(map[k]);
    if (b) b.classList.toggle("activo", !!st.style[k]);
  });
}

function buildFase1HTML(versiculoCanvasPx, scale){
  const p1 = DEV.p1;
  if (!p1) return "";

  scale = scale || 1;

  const versiculoPx = Math.max(8, versiculoCanvasPx * scale);

  // ✅ tamaños reales en canvas 1080 (se escalan en preview)
  const devocionalPx = Math.round(44 * scale);
  const fechaPx      = Math.round(32 * scale);
  const iglesiaPx    = Math.round(34 * scale);
  const direPx       = Math.round(34 * scale);

  // cita proporcional al versículo
  const citaPx = Math.max(Math.round(14 * scale), Math.round(versiculoPx * 0.75));

  // helper: centrado real + interlineado apretado
  const base = (px, weight)=>`
  position:absolute;
  left:0;
  right:0;
  margin:0 auto;
  width:96%;
  text-align:center;
  padding:0;
  font-size:${px}px;
  font-weight:${weight};
  line-height:1.05;
`;

  // ===== Coordenadas fijas tipo Cloudinary (porcentaje del wrapper) =====
  // Arriba
  const Y_DEV   = 2.2;
  const Y_FECHA = 6.2;
   
  // Abajo (pie)
  const Y_IGL   = 89.6;
  const Y_DIR   = 93.1;

  // Caja central (versículo + cita) MÁS GRANDE
  const Y_VBOX  = 14.2;
  const H_VBOX  = 71.5;

  return `
    <div style="position:relative; width:100%; height:100%;">

      <div style="${base(devocionalPx,700)} top:${Y_DEV}%;">
        DEVOCIONAL
      </div>

      <div style="${base(fechaPx,550)} top:${Y_FECHA}%; opacity:.95;">
        ${esc(p1.fecha)}
      </div>

      <!-- ✅ Caja fija grande: Versículo + Cita juntos -->
      <div style="
        position:absolute;
        left:0;
        right:0;
        margin:0 auto;
        top:${Y_VBOX}%;
        height:${H_VBOX}%;
        width:96%;
        padding: 0 ${Math.round(36 * scale)}px;
        box-sizing: border-box;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        overflow:hidden;
      ">
        <div style="
          width:100%;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          gap:4px;                 /* ✅ espacio corto entre versículo y cita */
          line-height:1.03;
        ">
                    <div style="
            font-size:${versiculoPx}px;
            font-weight:${DEV.f1.style.bold ? 800 : 400};
            width:100%;
            white-space:normal;
            word-break:break-word;
            line-height:1.02;
          ">
            ${esc(p1.versiculo)}
          </div>

                    <div style="
            font-size:${citaPx}px;
            font-weight:${DEV.f1.style.bold ? 700 : 400};
            width:100%;
            white-space:normal;
            word-break:break-word;
            line-height:1.02;
          ">
            ${esc(p1.cita)}
          </div>
        </div>
      </div>

      <div style="${base(iglesiaPx,700)} top:${Y_IGL}%;">
        ${esc(p1.iglesia)}
      </div>

      <div style="${base(direPx,700)} top:${Y_DIR}%;">
        ${esc(p1.direccion)}
      </div>

    </div>
  `;
}

function buildFase2HTML(basePx){
  const p2 = DEV.p2;
  if (!p2) return "";

  const ref = oneLine(p2.reflexion || "");
  const ora = oneLine(p2.oracion || "");
  const fw  = DEV.f2.style.bold ? 700 : 400;

  const adorno  = DEV.f2.adornoUrl;
  const adornoW = Math.max(30, Math.min(95, Number(DEV.f2.adornoWidth || 70)));

  return `
    <div style="
      width:100%;
      height:100%;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    ">

      <!-- ✅ TEXTO: ocupa el espacio disponible y queda centrado -->
      <div style="
        flex:1 1 auto;
        min-height:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding: 0 12px;
        box-sizing:border-box;
        text-align:center;
        overflow:hidden;
      ">
        <div style="
          width:100%;
          font-size:${basePx}px;
          font-weight:${fw};
          line-height:1.24;
          word-break:break-word;
        ">
          <div>Reflexión: ${esc(ref)}</div>
          ${ora ? `<div style="margin-top:10px;">Oración: ${esc(ora)}</div>` : ``}
        </div>
      </div>

      <!-- ✅ ADORNO: fijo abajo, no empuja ni corta el texto -->
      ${adorno ? `
        <div style="
          flex:0 0 auto;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding: 0 0 8px;
          box-sizing:border-box;
          pointer-events:none;
        ">
          <img
            src="${adorno}"
            alt="adorno"
            style="
              width:${adornoW}%;
              max-height:110px;
              height:auto;
              object-fit:contain;
              display:block;
            "
          />
        </div>
      ` : ``}

    </div>
  `;
}

function scalePreviewF1(){
  const p = $("dev1Preview");
  if (!p) return 1;
  const h = p.getBoundingClientRect().height || 1;
  return h / 1080; // fase 1 = 9:9 = 1080 de alto en canvas
}

function scalePreviewF2(){
  const p = $("dev2Preview");
  if (!p) return 1;
  const h = p.getBoundingClientRect().height || 1;
  return h / 840; // fase 2 = 9:7 = 840 de alto en canvas
}

function devRenderFase(fase){
  if (fase === 1) {
    const p = $("dev1Preview");
    const w = $("dev1TextoWrapper");
    const t = $("dev1Texto");
    const b = $("dev1TextoBack");
    if (!p || !w || !t || !b) return;

    const st = DEV.f1;

    // texto
   const sc = scalePreviewF1();
   t.innerHTML = buildFase1HTML(st.size, sc);
    // ya no usamos la capa back para no romper tamaños diferentes
    if (b) b.style.display = "none";

    // fondo
    const fondoUsable = st.fondoBlob || st.fondoUrl;
    p.style.backgroundImage = fondoUsable ? `url("${fondoUsable}")` : "none";
    p.style.backgroundSize = "cover";
    p.style.backgroundPosition = "center";
    p.style.backgroundColor = fondoUsable ? "transparent" : "#ffffff";

   // fuente + tamaño + color
   t.style.fontFamily = st.fuente;
   t.style.color = st.color;

   // ✅ OUTLINE estable (para preview + captura)
   t.style.textShadow = textShadowLegible(st.color);
   t.style.webkitTextStroke = "0px";
   t.style.paintOrder = "normal";

    // wrapper bg
    w.style.backgroundColor = wrapperBgFromOpacity(st.op, st.opColor);
    w.style.boxShadow = wrapperShadowFromOpacity(st.op, st.opColor);

    applyTextStylesToOne(t, st);
    devSyncStyleButtons(1);
    return;
  }

  if (fase === 2) {
    const p = $("dev2Preview");
    const w = $("dev2TextoWrapper");
    const t = $("dev2Texto");
    const b = $("dev2TextoBack");
    if (!p || !w || !t || !b) return;

    const st = DEV.f2;

    const pxPreview = Math.max(8, st.size);
    t.innerHTML = buildFase2HTML(pxPreview);
    if (b) b.style.display = "none";

    // fondo plano
    p.style.backgroundImage = "none";
    p.style.backgroundColor = st.fondoColor || "#ffffff";

    // fuente + tamaño + color
   t.style.fontFamily = st.fuente;
   t.style.color = st.color;

   // ✅ OUTLINE estable (para preview + captura)
   t.style.textShadow = textShadowLegible(st.color);
   t.style.webkitTextStroke = "0px";
   t.style.paintOrder = "normal";

   w.style.backgroundColor = "transparent"; // ✅ sin opacidad en Fase 2

    applyTextStylesToOne(t, st);
    devSyncStyleButtons(2);
    return;
  }
}

function devSetLoadingFase3(on, msg){
  const box = $("devF3Loading");
  const previewBox = $("devF3PreviewBox");

  if (box) {
    box.style.display = on ? "block" : "none";
    if (msg) box.textContent = msg;
  }

  if (previewBox) {
    previewBox.style.display = on ? "none" : "block";
  }
}

function roundedRectPath(ctx, x, y, w, h, r){
  const rr = Math.max(0, Math.min(r, w/2, h/2));
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y,   x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x,   y+h, rr);
  ctx.arcTo(x,   y+h, x,   y,   rr);
  ctx.arcTo(x,   y,   x+w, y,   rr);
  ctx.closePath();
}

function makeRoundedCanvas(srcCanvas, radius){
  const out = document.createElement("canvas");
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;

  const octx = out.getContext("2d");
  octx.clearRect(0,0,out.width,out.height);

  octx.save();
  roundedRectPath(octx, 0, 0, out.width, out.height, radius);
  octx.clip();
  octx.drawImage(srcCanvas, 0, 0);
  octx.restore();

  return out;
}

/* =========================================================
   8) FINAL 9:16 — CAPTURA REAL (COMO BIBLIA)
   ========================================================= */
function setFinalCanvasDisabled(disabled){
  ["devBtnDescargar","devBtnCompartir","devBtnPanelToggle","devBtnIglesia","devBtnFinalizar"].forEach(id=>{
    const b = $(id);
    if (b) b.disabled = disabled;
  });
}
function devSetFinalButtons(enabled){
  setFinalCanvasDisabled(!enabled);
}

async function renderFinalCanvasCaptureReal(){
  const cFinal = $("devCanvasFinal");
  if (!cFinal) return null;

  if (typeof html2canvas !== "function") {
    alert("❌ Falta html2canvas. Agregalo en el HTML como en Biblia.");
    return null;
  }

  const W = 1080, H1 = 1080, H2 = 840, H = 1920;

  cFinal.width = W;
  cFinal.height = H;
  const ctx = cFinal.getContext("2d");
  ctx.clearRect(0,0,W,H);

  // ✅ Escenario offscreen
  let stage = document.getElementById("devCaptureStage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "devCaptureStage";
    stage.style.position = "fixed";
    stage.style.left = "-10000px";     // ✅ lejos sin transform
    stage.style.top  = "-10000px";
    stage.style.opacity = "1";      
    stage.style.visibility = "visible";
    stage.style.pointerEvents = "none";
    stage.style.transform = "none";    // ✅ importantísimo
    stage.style.zIndex = "-1";
    document.body.appendChild(stage);
  }
  stage.innerHTML = "";

  // ✅ Construir nodos “a tamaño real” (NO dependen del preview chico)
  const makeFase1Node = () => {
    const st = DEV.f1;
    const node = document.createElement("div");
    node.style.width = W + "px";
    node.style.height = H1 + "px";
    node.style.position = "relative";
    node.style.overflow = "hidden";
    node.style.borderRadius = "0";

    const fondoUsable = st.fondoBlob || st.fondoUrl;
    node.style.backgroundImage = fondoUsable ? `url("${fondoUsable}")` : "none";
    node.style.backgroundSize = "cover";
    node.style.backgroundPosition = "center";
    node.style.backgroundColor = fondoUsable ? "transparent" : "#ffffff";

    const wrap = document.createElement("div");
    wrap.style.position = "absolute";
    wrap.style.inset = "6%";           // ✅ igual que .dev-textwrap
    wrap.style.borderRadius = "14px";  // ✅ igual que preview
    wrap.style.overflow = "hidden";    // ✅ igual que preview
    wrap.style.backgroundColor = wrapperBgFromOpacity(st.op, st.opColor);
    wrap.style.boxShadow = wrapperShadowFromOpacity(st.op, st.opColor);
     
    const texto = document.createElement("div");
    texto.style.position = "absolute";
    texto.style.inset = "0";
    texto.style.fontFamily = st.fuente;
    texto.style.color = st.color;
    applyTextStylesToOne(texto, st);
     
    // ✅ OUTLINE estable
    texto.style.textShadow = textShadowLegibleFinal(st.color);
    texto.style.webkitTextStroke = "0px";
    texto.style.paintOrder = "normal";

    // ✅ IMPORTANTE: tamaño real (sin scalePreviewF1)
    texto.innerHTML = buildFase1HTML(st.size, 1);

    wrap.appendChild(texto);
    node.appendChild(wrap);
    return node;
  };

  const makeFase2Node = () => {
  const st = DEV.f2;

  const node = document.createElement("div");
  node.style.width = W + "px";
  node.style.height = H2 + "px";
  node.style.position = "relative";
  node.style.overflow = "hidden";
  node.style.borderRadius = "0";
  node.style.backgroundImage = "none";
  node.style.backgroundColor = st.fondoColor || "#ffffff";

  // ✅ WRAPPER limpio: margen uniforme y sin padding extra
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.inset = "16px";
  wrap.style.overflow = "hidden";
  wrap.style.textAlign = "center";

  const texto = document.createElement("div");
  texto.style.width = "100%";
  texto.style.height = "100%"; // ✅ importante para el layout interno absoluto de buildFase2HTML()
  texto.style.fontFamily = st.fuente;
  texto.style.color = st.color;
  applyTextStylesToOne(texto, st);

  // ✅ OUTLINE estable
  texto.style.textShadow = textShadowLegibleFinal(st.color);
  texto.style.webkitTextStroke = "0px";
  texto.style.paintOrder = "normal";

  // ✅ HTML fase 2 ya maneja: texto centrado + adorno fijo abajo
  texto.innerHTML = buildFase2HTML(Math.max(12, st.size * 1.9));

  wrap.appendChild(texto);
  node.appendChild(wrap);

  return node;
};

  // ✅ Agregar al stage y esperar fuentes/layout
  const n1 = makeFase1Node();
  const n2 = makeFase2Node();
  stage.appendChild(n1);
  stage.appendChild(n2);

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (document.fonts?.ready) await document.fonts.ready;

  // ✅ Capturar
  const cap1 = await html2canvas(n1, { backgroundColor: null, scale: 2, useCORS: true });
  const cap2 = await html2canvas(n2, { backgroundColor: null, scale: 2, useCORS: true });

  ctx.drawImage(cap1, 0, 0, W, H1);
  ctx.drawImage(cap2, 0, H1, W, H2);

  // ✅ redondear como preview (aprox)
  const RADIO_FINAL = 52; // si querés más redondo probá 50
  const rounded = makeRoundedCanvas(cFinal, RADIO_FINAL);

  DEV.finalDataUrl = rounded.toDataURL("image/png");
  const img = $("devFinalImg");
  if (img) img.src = DEV.finalDataUrl;

  return rounded; // 👈 devolvemos el canvas redondeado
}

window.devToggleSubirPanel = () => {
  DEV.subirPanel = !DEV.subirPanel;
  const tick = $("devPanelTick");
  if (tick) tick.style.display = DEV.subirPanel ? "inline" : "none";
};

// ✅ descarga PNG
async function devDescargarPNG(){
  const c = await renderFinalCanvasCaptureReal();
  if (!c) return;

  const fecha = DEV?.p1?.fecha || "sin_fecha";
  const name = "Devocional_" + safeFilePart(fecha) + ".png";

  c.toBlob((blob)=>{
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}

// ✅ descarga pack: primero PNG, luego audio
window.devDescargarPack = async () => {
  await devDescargarPNG();
  await devDescargarFinal(); // tu función actual (audio + intenta GitHub)
};

/* =========================================================
   9) NAV fases
========================================================= */
async function devAbrirFase0(){
  // muestra imagen recortada
  const blob = await getCroppedBlob();
  if (blob) {
    if (DEV.cropPreviewUrl) URL.revokeObjectURL(DEV.cropPreviewUrl);
    DEV.cropPreviewUrl = URL.createObjectURL(blob);
    const img = $("dev0Img");
    if (img) img.src = DEV.cropPreviewUrl;
  }

  // texto editable completo
  const t0 = $("dev0Texto");
  if (t0) t0.value = DEV.rawText || "";

  // Si ya tengo campos cargados, los muestro.
  // Si no, intento detectarlos a partir del texto.
  const tieneAlgo =
    (DEV.fields?.fecha || DEV.fields?.versiculo || DEV.fields?.cita || DEV.fields?.reflexion || DEV.fields?.oracion);

  if (!tieneAlgo && (DEV.rawText || "").trim()) {
    const { p1, p2, audioText } = buildBloquesFromOCR(DEV.rawText);
    DEV.fields.fecha     = oneLine(p1?.fecha || "");
    DEV.fields.versiculo = oneLine(p1?.versiculo || "");
    DEV.fields.cita      = oneLine(p1?.cita || "");
    DEV.fields.reflexion = oneLine(p2?.reflexion || "");
    DEV.fields.oracion   = oneLine(p2?.oracion || "");
    DEV.audioText = audioText;
    DEV.p1 = p1;
    DEV.p2 = p2;
  }

  devWriteFieldsToUI();

  abrirModal("modalDevFase0");
}

// Fase 0 -> Fase 1  ✅ usa CAMPOS MANUALES si los tocaste
window.devIrFase1Desde0 = () => {
  const t0 = ($("dev0Texto")?.value || "").trim();
  if (!t0) { alert("Pegá o generá el texto primero."); return; }

  DEV.rawText = t0;

  // 1) Si hay campos manuales, mandan
  devReadFieldsFromUI();
  const hayCampos =
    (DEV.fields.fecha || DEV.fields.versiculo || DEV.fields.cita || DEV.fields.reflexion || DEV.fields.oracion);

  if (hayCampos) {
    devApplyFieldsToParts();
  } else {
    const { p1, p2, audioText } = buildBloquesFromOCR(t0);
    DEV.p1 = p1;
    DEV.p2 = p2;
    DEV.audioText = audioText;

    DEV.fields.fecha     = oneLine(p1?.fecha || "");
    DEV.fields.versiculo = oneLine(p1?.versiculo || "");
    DEV.fields.cita      = oneLine(p1?.cita || "");
    DEV.fields.reflexion = oneLine(p2?.reflexion || "");
    DEV.fields.oracion   = oneLine(p2?.oracion || "");
  }

  // reset final
  DEV.finalDataUrl = "";
  const imgF = $("devFinalImg");
  if (imgF) imgF.src = "";

  // reset gate audio
  DEV.audioOk = false;
  devSetFinalButtons(false);

    cerrarModal("modalDevFase0");
  abrirModal("modalDevFase1");

  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#dev1OpColorHost, #dev1ColorHost");
  }

  // render inicial
  devRenderFase(1);

  // ✅ AUTO-SUGERIDO FASE 1 (igual que en btnCrear)
  (async ()=>{
    await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));
    if (document.fonts?.ready) await document.fonts.ready;

    const sugerido = sugerirTamanoVersiculoAuto(DEV?.p1?.versiculo || "");
    DEV.f1.size = sugerido;

    const s1 = $("dev1Tamano");
    if (s1) s1.value = fmtSize(sugerido);

    devRenderFase(1);
  })();
};

// Fase 1 -> volver a Fase 0
window.devVolverFase0 = () => {
  cerrarModal("modalDevFase1");
  abrirModal("modalDevFase0");
};

window.devIrFase2 = () => {
  devRenderFase(1);

    cerrarModal("modalDevFase1");
  abrirModal("modalDevFase2");

  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#dev2FondoHost, #dev2ColorHost");
  }

  requestAnimationFrame(()=>{

    // ✅ SOLO sugerimos una vez (si el usuario no tocó nada aún)
    if (!DEV.f2.userChanged) {
      const texto = `Reflexión: ${DEV.p2?.reflexion || ""}\nOración: ${DEV.p2?.oracion || ""}`;
      const sugerido = sugerirTamanoFase2Auto(texto);

      DEV.f2.size = sugerido;

      const s2 = $("dev2Tamano");
      if (s2) s2.value = fmtSize(sugerido);
    }

    devRenderFase(2);
  });
};

window.devVolverFase1 = () => {
  cerrarModal("modalDevFase2");
  abrirModal("modalDevFase1");
  devRenderFase(1);
};

window.devIrFase3 = async () => {
  devRenderFase(2);
  cerrarModal("modalDevFase2");
  abrirModal("modalDevFase3");

  DEV.audioOk = false;
  devSetFinalButtons(false);

  devSetLoadingFase3(true, "⏳ Generando…");

  try {
    if (typeof html2canvas === "function") {
      await renderFinalCanvasCaptureReal();
    } else {
      alert("❌ Falta html2canvas. Cargalo como en biblia.js");
    }
  } finally {
    devSetLoadingFase3(false);
  }
};

window.devVolverFase2 = () => {
  cerrarModal("modalDevFase3");
  abrirModal("modalDevFase2");
  devRenderFase(2);
};

window.devAudioDesdeFase3 = () => {
  // abre audio pero NO te saca de fase 3
  devAbrirAudio();
};

/* =========================================================
   10) CONTROLES UI (sliders, size, color, fondo)
   ========================================================= */
window.devCambiarTamano = (fase, delta) => {
  const inp = $(`dev${fase}Tamano`);
  if (!inp) return;

  const step = 0.5; // ✅ medio punto
  const cur = Number(inp.value || 24);
  const next = Math.max(8, Math.min(90, +(cur + delta * step).toFixed(1)));

  inp.value = String(next);

  if (fase === 1) DEV.f1.size = next;
  else DEV.f2.size = next;

  devRenderFase(fase);
};

window.devToggleStyle = (fase, key) => {
  const st = (fase===1) ? DEV.f1 : DEV.f2;
  st.style[key] = !st.style[key];

  const btnId =
    key==="upper" ? `dev${fase}Upper` :
    key==="bold" ? `dev${fase}Bold` :
    key==="italic" ? `dev${fase}Italic` :
    `dev${fase}Under`;

  const b = $(btnId);
  if (b) b.classList.toggle("activo", st.style[key]);

  devRenderFase(fase);
};

function bindInputs(){

  // =========================
  // FASE 1 (imagen) - opacidad / tamaño / color
  // =========================
  ["Opacidad","Tamano","Color","OpColor"].forEach(k=>{
    const el = $(`dev1${k}`);
    if (!el) return;

    el.addEventListener("input", ()=>{
      // opacidad y color siempre desde los inputs
      DEV.f1.op = Number($("dev1Opacidad")?.value || 0.35);
      DEV.f1.color = $("dev1Color")?.value || "#000000";
      DEV.f1.opColor = $("dev1OpColor")?.value || "#000000";

      DEV.f1.size = Number($("dev1Tamano")?.value || 30);

      devRenderFase(1);
    });
  });

// =========================
// FASE 2 (color plano) - tamaño / color (SIN opacidad)
// =========================
["Tamano","Color"].forEach(k=>{
  const el = $(`dev2${k}`);
  if (!el) return;

  el.addEventListener("input", ()=>{
    DEV.f2.userChanged = true; // ✅ el usuario modificó fase 2 (NO volver a sugerir)

    DEV.f2.size = Number($("dev2Tamano")?.value || 26);
    DEV.f2.color = $("dev2Color")?.value || "#000000";
    requestAnimationFrame(()=> devRenderFase(2));
  });
});

  // Fondo fase 2
  const fondo2 = $("dev2Fondo");
  if (fondo2) {
    fondo2.addEventListener("input", ()=>{
      DEV.f2.fondoColor = fondo2.value || "#ffffff";
      devRenderFase(2);
    });
  }
}

/* =========================================================
   11) AUDIO (bloquea botones hasta "Correcto")
   ========================================================= */
window.devAbrirAudio = () => {
  window.__AUDIO_VOICE_NAME = "es-US-Studio-B"; // ✅ DEVOCIONALES = STUDIO
  window.__AUDIO_ORIGEN = "devocional";         // ✅ etiqueta opcional

  // ✅ Texto completo y limpio para audio (ya armado al crear devocional)
  DEV.audioText = buildAudioFromParts(DEV.p1, DEV.p2);

  const ta = $("textoAudio");
  if (ta) ta.value = DEV.audioText;
   
   // abrir modal audio existente
  if (typeof window.abrirModalAudio === "function") {
    window.abrirModalAudio();
    return;
  }

  // fallback (si no existe abrirModalAudio)
  const m = $("modalAudio");
if (m) {
  m.classList.add("abierto");
  m.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");
}
};

// Hook: cuando se confirme audio (Correcto), habilitamos finales
function hookAudioCorrecto(){
  if (typeof window.finalizarYSubirAudio !== "function") return;

  const original = window.finalizarYSubirAudio;
  window.finalizarYSubirAudio = async function(...args){
    const r = await original.apply(this, args);

    // ✅ si estoy en fase 3, habilito botones
    const m3 = $("modalDevFase3");
    const visible = m3 && m3.classList.contains("abierto");
    if (visible) {
      DEV.audioOk = true;
      devSetFinalButtons(true);
    }
    return r;
  };
}

async function devDescargarAudioSiExiste(){
  const audioEl =
    document.querySelector("#modalAudio audio") ||
    document.querySelector("audio#audioPreview") ||
    document.querySelector("audio");

  const src = audioEl?.currentSrc || audioEl?.src || "";
  if (!src) return false;

  try{
    const r = await fetch(src);
    const blob = await r.blob();

    const fecha = DEV?.p1?.fecha || "sin_fecha";
    const baseName = "Audio_" + safeFilePart(fecha);

    const ext =
      blob.type.includes("mpeg") ? "mp3" :
      blob.type.includes("wav")  ? "wav" :
      blob.type.includes("ogg")  ? "ogg" : "mp3";

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(a.href), 2000);

    return true;
  }catch(e){
    console.warn("No se pudo descargar audio:", e);
    return false;
  }
}

/* =========================================================
   12) BOTONES FINALES (descargar / compartir / iglesia / finalizar)
   ========================================================= */
async function devDescargarImagenSolo(canvas){
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "devocional.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

window.devCompartirFinal = async () => {
  const c = await renderFinalCanvasCaptureReal();
  if (!c) return;

  c.toBlob(async (blob) => {
    if (!blob) {
      await devDescargarImagenSolo(c);
      return;
    }

    const file = new File([blob], "devocional.png", { type: "image/png" });

    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Devocional" });
      } else {
        await devDescargarImagenSolo(c);
        alert("Tu dispositivo/navegador no permite compartir directo. Se descargó la imagen para compartirla manualmente.");
      }
    } catch (e) {
      console.warn("Share cancelado o falló:", e);
      await devDescargarImagenSolo(c);
    }
  }, "image/png");
};

function safeFilePart(s){
  return String(s || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s/g, "_")
    .slice(0, 60);
}

window.devDescargarFinal = async () => {
     devBusyShow("⏳ Preparando audio…");
  try {
    // 1) obtener base64 desde el <audio>
   let pack = await audioElementToBase64();

if (!pack?.base64 || !pack?.blob) {
  // ✅ si no existe audio, lo generamos automáticamente
  window.__AUDIO_VOICE_NAME = "es-US-Studio-B"; // devocional
  const texto = (DEV.audioText || "").trim();
  if (!texto) { alert("No hay texto para audio."); return; }

  const r = await fetch(TTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto, voiceName: "es-US-Studio-B" })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.audioBase64) {
    alert("No pude generar el audio automáticamente.");
    return;
  }

  // convertir base64 a blob
  const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "audio/mpeg" });

  pack = { base64: data.audioBase64, blob };
}

    // 2) subir a GitHub
    let gh = null;
    try {
      gh = await subirAudioAGithubDesdeWeb(pack.base64);
      // si querés guardar la URL en DEV:
      DEV.audioGithubUrl = gh.url || "";
    } catch (e) {
      console.warn("GitHub upload falló:", e);
      // seguimos igual descargando local
      alert("⚠️ No pude subir a GitHub, pero igual te lo descargo.\n\nDetalle: " + (e?.message || e));
    }

    // 3) descargar local (siempre)
    const fecha = DEV?.p1?.fecha || "sin_fecha";
    const baseName = "Audio_" + safeFilePart(fecha);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(pack.blob);
    a.download = `${baseName}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);

    // 4) mensaje final
    if (gh?.url) {
      alert("✅ Audio subido a GitHub y descargado.\n\nURL:\n" + gh.url);
    }
    } catch (e) {
    console.error(e);
    alert("❌ No se pudo descargar/subir el audio.\n\nDetalle: " + (e?.message || e));
  } finally {
    devBusyHide();
  }
};

// ✅ Devocional a Iglesia (usa un ts fijo si se lo pasás)
window.devCompartirIglesia = async (tsParam) => {
  const fb = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api || !window.__UID) {
    alert("No encuentro Firebase listo. Asegurate que biblia.js cargó y que estás logueado.");
    throw new Error("Firebase no listo");
  }

  // ✅ NO renderizar dos veces: si ya tenés finalDataUrl, reutilizá
  const c = await renderFinalCanvasCaptureReal();
  if (!c) throw new Error("No se pudo renderizar el canvas final");

  const uid = window.__UID;
  const ts = Number(tsParam) || Date.now();     // ✅ MISMO TS si viene
  const fileName = `devocional_${ts}.png`;

  const storagePath = `devocionales_iglesia/${uid}/${fileName}`;
  const dbPath = `devocionalesIglesia/${uid}/${ts}`;

  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) throw new Error("No se pudo convertir a PNG");

  try {
    const { db, storage } = fb;
    const { ref, set, sRef, uploadBytes, getDownloadURL } = api;

    const storageRef = sRef(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType:"image/png" });
    const url = await getDownloadURL(storageRef);

    await set(ref(db, dbPath), {
      url,
      storagePath,
      fecha: ts,
      texto: DEV.audioText || "",
      audioOk: !!DEV.audioOk,
      audioGithubUrl: DEV.audioGithubUrl || ""
    });

    return { ok:true, ts, url, storagePath, dbPath };

  } catch (e) {
    console.error(e);
    alert("❌ No se pudo compartir en Iglesia\n\nDetalle: " + (e?.message || e));
    throw e;
  }
};


// ✅ Devocional a Mi Panel (usa el MISMO ts)
async function devSubirMiPanel(tsParam){
  const fb = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api || !window.__UID) {
    alert("No encuentro Firebase listo o no estás logueado.");
    throw new Error("Firebase no listo");
  }

  const c = await renderFinalCanvasCaptureReal();
  if (!c) throw new Error("No se pudo renderizar el canvas final");

  const uid = window.__UID;
  const ts = Number(tsParam) || Date.now();     // ✅ MISMO TS si viene
  const fileName = `devocional_${ts}.png`;

  const storagePath = `devocionales_panel/${uid}/${fileName}`;
  const dbPath = `miPanelDevocionales/${uid}/${ts}`;

  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) throw new Error("No se pudo convertir a PNG");

  const { db, storage } = fb;
  const { ref, set, sRef, uploadBytes, getDownloadURL } = api;

  const storageRef = sRef(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType:"image/png" });
  const url = await getDownloadURL(storageRef);

  await set(ref(db, dbPath), {
    url,
    storagePath,
    fecha: ts,
    texto: DEV.audioText || "",
    audioOk: !!DEV.audioOk,
    audioGithubUrl: DEV.audioGithubUrl || ""
  });

  return { ok:true, ts, url, storagePath, dbPath };
}

// ✅ candado anti doble submit
DEV.publicando = DEV.publicando || false;

window.devFinalizar = async () => {
  if (DEV.publicando) return;
  DEV.publicando = true;
  devBusyShow("⏳ Finalizando devocional…");

  const btn = document.getElementById("devBtnFinalizar");
  if (btn) btn.disabled = true;

  const ok = confirm("¿Finalizar devocional?\n\nSe sube a Iglesia.\nSi está tildado Mi Panel, también se sube ahí.");
  if (!ok) {
    DEV.publicando = false;
    if (btn) btn.disabled = false;
    return;
  }

  try {
    const ts = Date.now(); // ✅ 1 solo TS para todo

    // ✅ asegurar audio en GitHub antes de publicar
    if (!DEV.audioGithubUrl) {
      try { await window.devDescargarFinal(); } catch (e) { console.warn(e); }
    }

    // ✅ siempre a Iglesia
    await window.devCompartirIglesia(ts);

    // ✅ opcional: también a Mi Panel
    if (DEV.subirPanel) {
      await devSubirMiPanel(ts);
      alert("✅ Subido a Iglesia y a Mi Panel");
    } else {
      alert("✅ Subido a Iglesia");
    }

    devCerrarTodo();
  } catch (e) {
    console.error(e);
    alert("❌ Error al finalizar/subir.\n\nDetalle: " + (e?.message || e));
} finally {
  DEV.publicando = false;
  if (btn) btn.disabled = false;
  devBusyHide();
}
};

/* =========================================================
   13) ENTRADA: Botón Crear Devocional + OCR flow
   ========================================================= */
function syncBtnCrear(){
  const ta = $("devTexto");
  const btn = $("btnAbrirDevModal");
  if (!ta || !btn) return;
  const hay = (ta.value||"").trim().length > 0;
  btn.disabled = !hay;
  btn.style.opacity = hay ? "1" : "0.6";
}

function initDevocionales(){
  DEV.canvas = $("devCanvas");
  if (!DEV.canvas) return;
  DEV.ctx = DEV.canvas.getContext("2d");

  const input = $("devImg");
  const btnImg = $("btnDevImg");
  const btnRecortar = $("btnDevRecortar");
  const btnOCR = $("btnDevOCR");
  const ta = $("devTexto");
  const boxCanvas = $("devCanvasBox");
  const btnCrear = $("btnAbrirDevModal");

  if (btnImg && input) btnImg.addEventListener("click", ()=> input.click());

  if (!input || !btnRecortar || !btnOCR || !ta) return;

  bindPointerCropEvents();
  bindInputs();
  hookAudioCorrecto();

  // fuentes/listas y fondos y adornos
    crearListaFuentes(1);
  crearListaFuentes(2);
  cargarFondosDev();
  cargarAdornosF2();

  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#dev1OpColorHost, #dev1ColorHost, #dev2FondoHost, #dev2ColorHost");
  }

  // estado inicial
  btnRecortar.disabled = true;
  btnRecortar.style.opacity = "0.6";
  syncBtnCrear();
  ta.addEventListener("input", syncBtnCrear);
  ocrSetStatus("✅ Cargá una imagen, recortá si querés y tocá Crear devocional.");

 btnOCR.style.display = "none";
 btnOCR.textContent = "🧠 Crear devocional";
   
  // cargar imagen
  input.addEventListener("change", ()=>{
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = ()=>{
      DEV.img = image;
btnOCR.style.display = "none";
      // reset crop
      DEV.crop = null;
      DEV.start = null;
      DEV.drawing = false;

      DEV.recortando = true;
      btnRecortar.disabled = false;
      btnRecortar.style.opacity = "1";
      btnRecortar.textContent = "✅ Listo";

      fitCanvasToImage(DEV.img, 420);
      draw();

      if (boxCanvas) boxCanvas.classList.remove("hidden");

      // ocultar textarea hasta OCR
      const boxText = $("devTextoBox");
      if (boxText) boxText.classList.add("hidden");
      ta.value = "";
      syncBtnCrear();

      URL.revokeObjectURL(url);
      ocrSetStatus("✅ Imagen cargada. Podés recortar o tocar OCR.");
    };

    image.src = url;
  });

  // toggle recorte
btnRecortar.addEventListener("click", ()=>{
  if (!DEV.img) { alert("Primero cargá una imagen"); return; }

  DEV.recortando = !DEV.recortando;
  btnRecortar.textContent = DEV.recortando ? "✅ Listo" : "✂️ Recortar";

  if (!DEV.recortando) {
    DEV.start = null;
    DEV.drawing = false;

    // mostrar botón crear devocional
    if (btnOCR) {
      btnOCR.style.display = "inline-flex";
      btnOCR.textContent = "🧠 Crear devocional";
    }
  } else {
    if (btnOCR) btnOCR.style.display = "none";
  }
});

  // OCR
  btnOCR.addEventListener("click", async ()=>{
    if (!DEV.img) { alert("Primero cargá una imagen"); return; }

    btnOCR.disabled = true;
    btnOCR.style.opacity = "0.6";
    ocrSetStatus("⏳ Enviando imagen al OCR…");

    try{
      const blob = await getCroppedBlob();
      if (!blob) return;

      const imageBase64 = await blobToBase64(blob);

      const r = await fetch(OCR_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ imageBase64 })
      });

      const data = await r.json().catch(()=> ({}));
      if (!r.ok) {
        ocrSetStatus("❌ Error OCR: " + (data?.error || r.status));
        return;
      }

      const text = (data?.text || "").trim();
      if (!text) {
        ocrSetStatus("⚠️ No se detectó texto.");
        return;
      }

      DEV.rawText = text;
      ta.value = text;

      // mostrar textarea
      const boxText = $("devTextoBox");
      if (boxText) boxText.classList.remove("hidden");

      syncBtnCrear();
      ocrSetStatus("✅ OCR listo.");
      await devAbrirFase0();  // ✅ abre el modal 0 al terminar OCR
       btnOCR.style.display = "none";

    }catch(e){
      console.error(e);
      ocrSetStatus("❌ Error OCR: " + (e?.message || e));
    }finally{
      btnOCR.disabled = false;
      btnOCR.style.opacity = "1";
    }
  });

 // CREAR DEVOCIONAL => construir bloques y abrir fase 1
if (btnCrear) {
  btnCrear.addEventListener("click", ()=>{
    const texto = (ta.value || "").trim();
    if (!texto) { alert("Primero necesitás texto (OCR o pegado)."); return; }

    const { p1, p2, audioText } = buildBloquesFromOCR(texto);

    DEV.p1 = p1;
    DEV.p2 = p2;
    DEV.audioText = audioText;
    DEV.f2.userChanged = false; // ✅ nuevo devocional => permitir sugerencia inicial
     
    // reset gate audio
    DEV.audioOk = false;
    devSetFinalButtons(false);

    // ===== FASE 1: setear opacidad + color desde inputs
    DEV.f1.op = Number($("dev1Opacidad")?.value || 0.35);
    DEV.f1.color = $("dev1Color")?.value || "#000000";
    DEV.f1.opColor = $("dev1OpColor")?.value || "#000000";

// abrir fase 1 primero (para poder medir tamaño real)
abrirModal("modalDevFase1");

// render inicial rápido
devRenderFase(1);

// ✅ esperar 1 frame para que el layout tenga tamaño real
(async ()=>{
  // ✅ esperar layout real
  await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));

  // ✅ esperar que la fuente esté lista (clave para medir bien)
  if (document.fonts?.ready) await document.fonts.ready;

  // ✅ ahora sí medir
  const sugerido = sugerirTamanoVersiculoAuto(p1.versiculo);

  DEV.f1.size = sugerido;

  const s1 = $("dev1Tamano");
  if (s1) s1.value = fmtSize(sugerido);

  devRenderFase(1);
})();
     
  });
}

} // ✅ CIERRA initDevocionales()   
/* =========================================================
   INIT
   ========================================================= */
async function esperarFirebaseListo(timeoutMs = 8000){
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (window.__FB && window.__FB_API && window.__UID) return true;
    await new Promise(r => setTimeout(r, 80));
  }
  return false;
}

async function resolverAdminYArrancar(){
  const ok = await esperarFirebaseListo();
  if (!ok) {
    // igual arranca UI, pero va a mostrar “No encuentro Firebase listo…”
    cargarDevocionales();
    return;
  }

  try{
    const { db } = window.__FB;
    const { ref, get } = window.__FB_API;

    const uid = window.__UID;
    const snap = await get(ref(db, "admins/" + uid));
    window.__ES_ADMIN = !!snap.val();
  }catch(e){
    console.warn("No pude chequear admin:", e);
    window.__ES_ADMIN = false;
  }

  // mostrar/ocultar botón +
  const btnNuevo = document.getElementById("btnDevNuevo");
  if (btnNuevo) btnNuevo.style.display = window.__ES_ADMIN ? "inline-flex" : "none";

  cargarDevocionales();
}

document.addEventListener("DOMContentLoaded", ()=>{
  initDevocionales();
  devMostrarHome();
  resolverAdminYArrancar();
});

function isAdmin(){
  // si biblia.js te setea este flag, lo usamos
  return !!window.__ES_ADMIN;
}

async function cargarDevocionales(){
  const fb  = window.__FB;
  const api = window.__FB_API;

  const row  = $("devIndexRow");
  const feed = $("devFeed");
  if (row)  row.innerHTML  = "";
  if (feed) feed.innerHTML = `<div style="opacity:.8; padding:10px;">Cargando devocionales…</div>`;

  const btnNuevo = $("btnDevNuevo");
if (btnNuevo) {
  btnNuevo.style.display = isAdmin() ? "inline-flex" : "none";
  btnNuevo.onclick = ()=> {
    devMostrarCrear();
    // ✅ abrir selector de imagen directo
    const inp = document.getElementById("devImg");
    if (inp) inp.click();
  };
}

  const btnVolver = $("btnDevVolverHome");
  if (btnVolver) btnVolver.onclick = ()=> devMostrarHome();

  if (!fb || !api) {
    if (feed) feed.innerHTML = `<div style="opacity:.8; padding:10px;">
      No encuentro Firebase listo (window.__FB / window.__FB_API).<br>
      Asegurate que biblia.js inicializa Firebase y setea esas variables.
    </div>`;
    return;
  }

  const { db } = fb;
  const { ref, onValue } = api;

  const r = ref(db, "devocionalesIglesia");

  onValue(r, (snap)=>{
    const val = snap.val() || {};

    const items = [];
    for (const [uid, byTs] of Object.entries(val)) {
      if (!byTs || typeof byTs !== "object") continue;

      for (const [ts, it] of Object.entries(byTs)) {
        if (!it || typeof it !== "object") continue;

        items.push({
          id: `${uid}_${ts}`,
          uidOwner: uid,
          tsKey: Number(ts) || 0,
          ...it
        });
      }
    }

    items.sort((a,b)=>(b.fecha||b.tsKey||0)-(a.fecha||a.tsKey||0));

    if (!items.length) {
      if (feed) feed.innerHTML = `<div style="opacity:.8; padding:10px;">
        No hay devocionales todavía.<br>
        ${isAdmin() ? "Tocá el botón + para crear el primero." : "Pedile a un admin que publique uno."}
      </div>`;
      if (row) row.innerHTML = "";
      return;
    }

    renderDevIndex(items);
    renderDevFeed(items);
  });
}

function fmtFecha(ts){
  try{
    const d = new Date(ts);
    return d.toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"2-digit" });
  }catch{ return ""; }
}

function capitalizarCitaBonita(s){
  s = String(s || "").trim();
  if (!s) return "";

  return s
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .map(palabra => {
      if (!palabra) return palabra;

      // si empieza con número, por ejemplo "1"
      if (/^\d+$/.test(palabra)) return palabra;

      return palabra.charAt(0).toLocaleUpperCase("es") + palabra.slice(1);
    })
    .join(" ");
}

function getCitaDeTexto(texto){
  let t = String(texto || "").trim();
  if (!t) return "";

  // ✅ acepta Mateo 6.6 y lo convierte a Mateo 6:6
  t = t.replace(/(\d+)\.(\d+)(?!\d)/g, "$1:$2");

  // ✅ busca referencias tipo:
  // Juan 3:16
  // 1 Juan 4:8
  // Cantares 2:1-3
  const re = /((?:[1-3]\s+)?[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)*)\s+(\d+)\s*:\s*(\d+(?:-\d+)?)/g;

  let match;
  let ultima = "";

  while ((match = re.exec(t)) !== null) {
    ultima = `${match[1]} ${match[2]}:${match[3]}`;
  }

  // ✅ si no encuentra cita, devolvemos vacío en vez de "Devocional"
  return ultima ? capitalizarCitaBonita(ultima) : "";
}

function renderDevIndex(items){
  const row = $("devIndexRow");
  if (!row) return;
  row.innerHTML = "";

  items.forEach((it)=>{
    const cita  = getCitaDeTexto(it.texto) || "Devocional";
    const fecha = fmtFecha(it.fecha || it.tsKey || 0);

    const card = document.createElement("div");
    card.className = "devIndexCard";

    card.innerHTML = `
      <div class="devIndexBar devIndexBarTop">${cita}</div>

      <div class="devIndexImgWrap">
        <img src="${it.url || ""}" alt="dev">
      </div>

      <div class="devIndexBar devIndexBarBottom">${fecha}</div>
    `;

    card.onclick = ()=>{
      const el = document.getElementById("devBig_" + it.id);
      el?.scrollIntoView({ behavior:"smooth", block:"start" });
    };

    row.appendChild(card);
  });
}

function renderDevFeed(items){
  const feed = $("devFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const esAdmin = isAdmin();
     // ✅ precargar archivos para que compartir abra directo más seguido
  devPrecacheFeedImages(items);

  items.forEach((it)=>{
    const card = document.createElement("div");
    card.className = "devBigCard";
    card.id = "devBig_" + it.id;

    const audioHtml = it.audioGithubUrl
      ? `
        <div class="devAudioBox">
          <audio controls preload="none" src="${it.audioGithubUrl}"></audio>
        </div>
      `
      : ``;

    card.innerHTML = `
      <img src="${it.url || ""}" alt="dev grande">

      ${audioHtml}

      <div class="devBigActions">
<button class="btn-primary" type="button"
  onpointerdown="devWarmShareImage('${it.storagePath || ""}', 'devocional.png')"
  ontouchstart="devWarmShareImage('${it.storagePath || ""}', 'devocional.png')"
  onclick="devCompartirImagenItem('${it.storagePath || ""}', 'devocional.png')"
  aria-label="Compartir">
  <i class="fa-solid fa-share-nodes"></i>
</button>

<button class="btn-primary" type="button"
  onclick="devDescargarImagenItem('${it.storagePath || ""}', 'devocional.png')"
  aria-label="Descargar PNG">
  <i class="fa-solid fa-download"></i>
</button>

        ${esAdmin ? `
          <button class="btn-primary devDanger" type="button"
            onclick="devBorrarDevocional('${it.uidOwner || ""}','${it.tsKey || 0}','${it.storagePath || ""}')"
            aria-label="Borrar">
            <i class="fa-solid fa-trash"></i>
          </button>
        ` : ``}
      </div>
    `;

    feed.appendChild(card);
  });
}

window.devBorrarDevocional = async (uidOwner, tsKey, storagePath) => {
  if (!isAdmin()) { alert("Solo admin."); return; }

  const ok = confirm("¿Borrar este devocional?\n\nEsto elimina la imagen de Storage y el registro de la Iglesia.");
  if (!ok) return;

  const fb  = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api) { alert("Firebase no listo."); return; }

  const { db, storage } = fb;
  const { ref, remove, sRef, deleteObject } = api;

  try {
    // 1) borrar Storage (si existe)
    if (storagePath) {
      await deleteObject(sRef(storage, storagePath));
    }

    // 2) borrar DB
    const dbPath = `devocionalesIglesia/${uidOwner}/${tsKey}`;
    await remove(ref(db, dbPath));

    alert("✅ Devocional borrado.");
  } catch (e) {
    console.error(e);
    alert("❌ No se pudo borrar.\n\nDetalle: " + (e?.message || e));
  }
};

window.devReproducirAudioItem = (url)=>{
  if (!url) { alert("Este devocional no tiene audio."); return; }

  // abrir modal de audio
  if (typeof window.abrirModalAudio === "function") window.abrirModalAudio();
  else $("modalAudio")?.classList.add("abierto");

  const audio = $("audioPreview");
  if (audio) {
    audio.src = url;
    audio.load();
    audio.play().catch(()=>{});
  }

  const est = $("audioEstado");
  if (est) est.textContent = "Reproduciendo audio del devocional…";
};

function base64ToBlob(b64, contentType="application/octet-stream"){
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: contentType });
}

// =========================
// LOADING SIMPLE
// =========================
function devBusyEnsure(){
  let box = document.getElementById("devBusyGlobal");
  if (box) return box;

  box = document.createElement("div");
  box.id = "devBusyGlobal";
  box.style.position = "fixed";
  box.style.inset = "0";
  box.style.background = "rgba(0,0,0,.38)";
  box.style.display = "none";
  box.style.alignItems = "center";
  box.style.justifyContent = "center";
  box.style.zIndex = "99999";

  box.innerHTML = `
    <div style="
      min-width:220px;
      max-width:88vw;
      background:#fff;
      color:#222;
      border-radius:16px;
      padding:18px 16px;
      text-align:center;
      box-shadow:0 10px 30px rgba(0,0,0,.18);
      font-family:inherit;
    ">
      <div id="devBusyText" style="font-size:16px; font-weight:700;">Procesando…</div>
      <div style="margin-top:10px; font-size:13px; opacity:.75;">Por favor esperá un momento</div>
    </div>
  `;

  document.body.appendChild(box);
  return box;
}

function devBusyShow(msg){
  const box = devBusyEnsure();
  const t = document.getElementById("devBusyText");
  if (t) t.textContent = msg || "Procesando…";
  box.style.display = "flex";
}

function devBusyHide(){
  const box = document.getElementById("devBusyGlobal");
  if (box) box.style.display = "none";
}

// =========================
// CACHE DEL PNG PARA SHARE
// =========================
window.__devShareCache = window.__devShareCache || new Map();

function devShareKey(storagePath, fileName){
  return `${storagePath}__${fileName}`;
}

window.devWarmShareImage = async function(storagePath, fileName="devocional.png"){
  try{
    if (!storagePath) return null;

    const key = devShareKey(storagePath, fileName);
    const cached = window.__devShareCache.get(key);
    if (cached?.file) return cached.file;
    if (cached?.promise) return await cached.promise;

    const promise = (async ()=>{
      const blob = await fetchDevocionalBlob(storagePath, fileName);
      const file = new File([blob], fileName, { type:"image/png" });
      window.__devShareCache.set(key, { file });
      return file;
    })();

    window.__devShareCache.set(key, { promise });
    return await promise;
  } catch(e){
    console.warn("No pude precalentar share:", e);
    return null;
  }
};

// =========================
// ✅ CON FUNCTIONS COMPARTIR Y DESCARGAR
// =========================
const DEV_PNG_PROXY =
  "https://us-central1-vidaabundante-f118a.cloudfunctions.net/devocionalPng";

async function fetchDevocionalBlob(storagePath, fileName="devocional.png"){
  const url = `${DEV_PNG_PROXY}?path=${encodeURIComponent(storagePath)}&name=${encodeURIComponent(fileName)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("No pude bajar PNG (" + r.status + ")");
  return await r.blob();
}

function devPrecacheFeedImages(items){
  (items || []).forEach(it => {
    const storagePath = it?.storagePath || "";
    if (!storagePath) return;

    // ✅ calienta cache en segundo plano
    devWarmShareImage(storagePath, "devocional.png").catch(()=>{});
  });
}

window.devDescargarImagenItem = async function(storagePath, fileName="devocional.png"){
  try{
    if (!storagePath) throw new Error("No hay storagePath");

    devBusyShow("⏳ Preparando descarga…");

    const blob = await fetchDevocionalBlob(storagePath, fileName);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
  }catch(e){
    console.error(e);
    alert("❌ No se pudo descargar.\n\nDetalle: " + (e?.message || e));
  }finally{
    devBusyHide();
  }
};

window.devCompartirImagenItem = async function(storagePath, fileName="devocional.png"){
  try{
    if (!storagePath) throw new Error("No hay storagePath");

    const key = devShareKey(storagePath, fileName);
    const cached = window.__devShareCache.get(key);

    // ✅ si todavía no está listo, avisamos y seguimos calentando
    if (!cached?.file) {
      devBusyShow("⏳ Preparando imagen para compartir…");
      devWarmShareImage(storagePath, fileName).catch(()=>{});
      setTimeout(() => devBusyHide(), 900);
      alert("Todavía estoy preparando la imagen. Tocá compartir otra vez en un instante.");
      return;
    }

    const file = cached.file;

    if (navigator.share && navigator.canShare?.({ files:[file] })) {
      await navigator.share({
        files: [file],
        title: "Devocional"
      });
      return;
    }

    await window.devDescargarImagenItem(storagePath, fileName);
    alert("Tu dispositivo o navegador no permite compartir como archivo. Se descargó el PNG.");

  } catch(e){
    console.error(e);
    alert("❌ No se pudo compartir.\n\nDetalle: " + (e?.message || e));
  } finally {
    devBusyHide();
  }
};
