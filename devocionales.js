// devocionales.js (NUEVO LIMPIO)
// ✅ OCR + Recorte + Modal 3 fases (9:9 + 9:7 => 9:16)
// ✅ NO toca biblia.js
// ✅ Reusa modalAudio existente (si está cargado biblia.audio.js)

// ✅ SIN FUNCTIONS para OCR/R2.
const R2_WORKER_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

// ✅ OCR bueno y R2 pasan por Worker.
const OCR_URL = R2_WORKER_URL;
const R2_UPLOAD_URL = R2_WORKER_URL;

// ✅ Audio también pasa por Worker para evitar CORS,
// pero adentro sigue usando tus Functions originales.
const GH_UPLOAD_URL = R2_WORKER_URL;
const TTS_URL = R2_WORKER_URL;

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

  cropDragMode: "",
  cropHandle: "",
  cropEdgePad: 18,
  cropMinSize: 40,
  cropStartRect: null,

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
fondoSrc: "",
fuente: "Roboto",
color: "#000000",
outlineColor: "",
opColor: "#000000",
op: 0.35,
  size: 30,
  userChanged: false,
  style: { upper:false, bold:true, italic:false, underline:false }
},

  // fase2 (9:7) settings
  f2: {
    // ✅ Fondo diseñado fase 2: mantiene fondo plano y suma degradado
    baseTipo: "plano",          // "plano" | "gradiente"
  fondoColor: "#ffffff",
gradienteColor2: "#d1eeff",
gradienteColor3: "#a6d0ff",

// ✅ Fase 2: color 1 siempre visible.
// Color 2 y 3 se agregan con +
usarColor2: false,
usarColor3: false,

gradienteForma: "vertical",
    tabActiva: "fondo",         // "fondo" | "textura" | "adorno"
    // Varias texturas pueden quedar activas al mismo tiempo.
    texturasUrls: [],
    texturaUrl: null, // compatibilidad interna con el sistema anterior
    texturaOp: 0.22,
    fuente: "Roboto",
color: "#000000",
outlineColor: "",
textoSigueF1: true,
op: 0.15,
    size: 26,
    userChanged: false,
adornoUrl: null,
adornoWidth: 70,
adornoOpacidad: 1,
style: { upper:false, bold:false, italic:false, underline:false }
  },

  // audio gate
  audioOk: false,
  requiereAudio: true,
  subirAudioGithub: true,

    // final image
  finalDataUrl: "",
  finalizadaMode: false,
  finalOriginalBlob: null,
  finalOriginalName: "",
  finalOriginalUrl: "",

  // audio manual / finalizado
  audioManualBlob: null,
  audioManualBase64: "",
  audioManualName: "",

  // ✅ ESTAS DOS TENÍAN QUE ESTAR ADENTRO
  subirPanel: false,
  audioGithubUrl: "",

  // modal 0 preview
  cropPreviewUrl: null,

   publicando: false,
   publishTs: 0,

  panelGuardados: new Set(),
  panelGuardadosLoaded: false,

  oracionDevActual: null,
  oracionDevOwner: "",
  oracionDevTs: 0,

};

function devResetAjustesDevocionalNuevo(){
  // ✅ limpiar fondo anterior de fase 1
  if (DEV.f1?.fondoBlob) {
    try { URL.revokeObjectURL(DEV.f1.fondoBlob); } catch {}
  }

  DEV.f1.fondoUrl = null;
  DEV.f1.fondoBlob = null;
  DEV.f1.fondoSrc = "";
  DEV.f1.fuente = "Roboto";
DEV.f1.color = "#000000";
DEV.f1.outlineColor = "";
DEV.f1.opColor = "#000000";
  DEV.f1.op = 0.35;
  DEV.f1.size = 30;
  DEV.f1.userChanged = false;
  DEV.f1.style = { upper:false, bold:true, italic:false, underline:false };

  // ✅ limpiar fase 2 también
  DEV.f2.baseTipo = "plano";
  DEV.f2.fondoColor = "#ffffff";
DEV.f2.gradienteColor2 = "#d1eeff";
DEV.f2.gradienteColor3 = "#a6d0ff";
DEV.f2.usarColor2 = false;
DEV.f2.usarColor3 = false;
DEV.f2.gradienteForma = "vertical";
  DEV.f2.tabActiva = "fondo";
  DEV.f2.texturasUrls = [];
  DEV.f2.texturaUrl = null;
  DEV.f2.texturaOp = 0.22;
  DEV.f2.fuente = "Roboto";
DEV.f2.color = "#000000";
DEV.f2.outlineColor = "";
DEV.f2.textoSigueF1 = true;
DEV.f2.op = 0.15;
  DEV.f2.size = 26;
  DEV.f2.userChanged = false;
DEV.f2.adornoUrl = null;
DEV.f2.adornoWidth = 70;
DEV.f2.adornoOpacidad = 1;
DEV.f2.style = { upper:false, bold:false, italic:false, underline:false };
  DEV.audioOk = false;
  DEV.audioGithubUrl = "";

  // ✅ sincronizar inputs si existen
  const setVal = (id, val) => {
    const el = $(id);
    if (el) el.value = val;
  };

  setVal("dev1Color", "#000000");
   setVal("dev1OutlineColor", "");
  setVal("dev1OpColor", "#000000");
  setVal("dev1Opacidad", "0.35");
  setVal("dev1Tamano", "30");

  setVal("dev2Fondo", "#ffffff");
  setVal("dev2GradColor2", "#d1eeff");
  setVal("dev2GradColor3", "#a6d0ff");
  setVal("dev2Color", "#000000");
   setVal("dev2OutlineColor", "");
setVal("dev2TexturaOp", "0.22");
setVal("dev2AdornoTamano", "70");
setVal("dev2AdornoOpacidad", "1");
setVal("dev2Tamano", "26");

  const formaGradiente = $("dev2GradForma");
  if (formaGradiente) formaGradiente.value = "vertical";

  // ✅ Panel nuevo vuelve siempre a Fondo/Plano
  if (typeof dev2ActualizarPanelUI === "function") {
    dev2ActualizarPanelUI();
  }

  // ✅ limpiar activos visuales
  document.querySelectorAll("#dev1Fondos img.activo").forEach(x => x.classList.remove("activo"));
  document.querySelectorAll("#dev2Adornos button.activo").forEach(x => x.classList.remove("activo"));
  document.querySelectorAll("#dev2Texturas button.activo").forEach(x => x.classList.remove("activo"));
}

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
     if (DEV.ctx && DEV.canvas) {
    DEV.ctx.clearRect(0, 0, DEV.canvas.width, DEV.canvas.height);
  }
  show("devTextoBox", false);

  const btnFinal = $("btnDevCargarFinal");
  const btnListo = $("btnDevListo");
  const btnOCR = $("btnDevOCR");
  const btnRecortar = $("btnDevRecortar");
  const estado = $("estadoOCRDev");
  const ta = $("devTexto");

  if (btnFinal) btnFinal.style.display = "inline-flex";
  if (btnListo) btnListo.style.display = "none";
  if (btnOCR) btnOCR.style.display = "none";

  if (btnRecortar) {
    btnRecortar.disabled = true;
    btnRecortar.style.opacity = "0.6";
  }

  if (ta) ta.value = "";
  if (estado) estado.textContent = "";

  // opcional: limpiar input file
  const inp = $("devImg");
  if (inp) inp.value = "";
}

function devMostrarCrear(){
  const home = $("devHome");
  const crear = $("devCrear");
  if (home) home.style.display = "none";
  if (crear) crear.style.display = "block";
     devResetAjustesDevocionalNuevo();

  const btnFinal = $("btnDevCargarFinal");
  const btnListo = $("btnDevListo");
  const btnOCR = $("btnDevOCR");
  const btnRecortar = $("btnDevRecortar");
  const estado = $("estadoOCRDev");
  const ta = $("devTexto");

  if (btnFinal) btnFinal.style.display = "inline-flex";

  if (btnRecortar) {
    btnRecortar.style.display = "none";
    btnRecortar.disabled = true;
    btnRecortar.style.opacity = "0.6";
  }

  if (btnListo) btnListo.style.display = "none";
  if (btnOCR) btnOCR.style.display = "none";

  if (ta) ta.value = "";
  if (estado) {
    estado.textContent = "✅ Cargá una imagen, recortá si querés y tocá Crear devocional.";
  }
}

/* =========================================================
   2) RECORTE (canvas)
   ========================================================= */
function fitCanvasToImage(image, maxW = 300) {
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

    const hs = 10;
    const pts = [
      [crop.x, crop.y],
      [crop.x + crop.w / 2, crop.y],
      [crop.x + crop.w, crop.y],
      [crop.x, crop.y + crop.h / 2],
      [crop.x + crop.w, crop.y + crop.h / 2],
      [crop.x, crop.y + crop.h],
      [crop.x + crop.w / 2, crop.y + crop.h],
      [crop.x + crop.w, crop.y + crop.h]
    ];

    ctx.fillStyle = "#4f6fa8";
    pts.forEach(([px, py]) => {
      ctx.fillRect(px - hs / 2, py - hs / 2, hs, hs);
    });

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

function clamp(n, min, max){
  return Math.max(min, Math.min(max, n));
}

function devCrearCropCuadradoInicial(){
  const c = DEV.canvas;
  if (!c) return null;

  const side = Math.round(Math.min(c.width, c.height) * 0.72);
  const x = Math.round((c.width - side) / 2);
  const y = Math.round((c.height - side) / 2);

  return { x, y, w: side, h: side };
}

function pointNear(a, b, pad){
  return Math.abs(a - b) <= pad;
}

function detectCropHandle(p, r){
  if (!r) return "";

  const pad = DEV.cropEdgePad || 18;
  const left   = r.x;
  const right  = r.x + r.w;
  const top    = r.y;
  const bottom = r.y + r.h;

  const inside =
    p.x >= left && p.x <= right &&
    p.y >= top  && p.y <= bottom;

  if (pointNear(p.x, left, pad) && pointNear(p.y, top, pad)) return "nw";
  if (pointNear(p.x, right, pad) && pointNear(p.y, top, pad)) return "ne";
  if (pointNear(p.x, left, pad) && pointNear(p.y, bottom, pad)) return "sw";
  if (pointNear(p.x, right, pad) && pointNear(p.y, bottom, pad)) return "se";

  if (pointNear(p.x, left, pad) && p.y >= top && p.y <= bottom) return "w";
  if (pointNear(p.x, right, pad) && p.y >= top && p.y <= bottom) return "e";
  if (pointNear(p.y, top, pad) && p.x >= left && p.x <= right) return "n";
  if (pointNear(p.y, bottom, pad) && p.x >= left && p.x <= right) return "s";

  if (inside) return "move";
  return "";
}

function devUpdateCropFromHandle(handle, p){
  const c = DEV.canvas;
  const r0 = DEV.cropStartRect;
  if (!c || !r0) return;

  const min = DEV.cropMinSize || 40;

  let x = r0.x;
  let y = r0.y;
  let w = r0.w;
  let h = r0.h;

  const left0   = r0.x;
  const right0  = r0.x + r0.w;
  const top0    = r0.y;
  const bottom0 = r0.y + r0.h;

  if (handle === "move") {
    const dx = p.x - DEV.start.x;
    const dy = p.y - DEV.start.y;

    x = clamp(r0.x + dx, 0, c.width - r0.w);
    y = clamp(r0.y + dy, 0, c.height - r0.h);
    DEV.crop = { x, y, w: r0.w, h: r0.h };
    return;
  }

  let left = left0;
  let right = right0;
  let top = top0;
  let bottom = bottom0;

  if (handle.includes("w")) left = clamp(p.x, 0, right0 - min);
  if (handle.includes("e")) right = clamp(p.x, left0 + min, c.width);
  if (handle.includes("n")) top = clamp(p.y, 0, bottom0 - min);
  if (handle.includes("s")) bottom = clamp(p.y, top0 + min, c.height);

  x = left;
  y = top;
  w = right - left;
  h = bottom - top;

  DEV.crop = { x, y, w, h };
}

function bindPointerCropEvents(){
  const canvas = DEV.canvas;
  if (!canvas) return;
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (e)=>{
    if (!DEV.recortando || !DEV.img) return;

    const p = canvasPointFromClient(e.clientX, e.clientY);

    if (!DEV.crop || DEV.crop.w < 10 || DEV.crop.h < 10) {
      DEV.crop = devCrearCropCuadradoInicial();
      draw();
      e.preventDefault();
      return;
    }

    const handle = detectCropHandle(p, DEV.crop);
    if (!handle) return;

    canvas.setPointerCapture?.(e.pointerId);
    DEV.drawing = true;
    DEV.start = p;
    DEV.cropHandle = handle;
    DEV.cropDragMode = handle === "move" ? "move" : "resize";
    DEV.cropStartRect = { ...DEV.crop };

    e.preventDefault();
  }, {passive:false});

  canvas.addEventListener("pointermove", (e)=>{
    if (!DEV.recortando || !DEV.img || !DEV.drawing || !DEV.start) return;

    const p = canvasPointFromClient(e.clientX, e.clientY);
    devUpdateCropFromHandle(DEV.cropHandle, p);
    draw();
    e.preventDefault();
  }, {passive:false});

  const end = (e)=>{
    if (!DEV.recortando || !DEV.drawing) return;

    DEV.drawing = false;
    DEV.start = null;
    DEV.cropHandle = "";
    DEV.cropDragMode = "";
    DEV.cropStartRect = null;

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

async function subirImagenAR2DesdeWeb(fileBase64, fileName, contentType = "image/png"){
  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName,
      contentType,
      folder: "devocionales"
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir imagen a R2");
  }

  return data;
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

function cleanReflexionHeader(line){
  return (line || "")
    .replace(/^[^\w]*reflexi[oó]n\s*:?\s*/i, "")
    .trim();
}

function buildBloquesFromOCRFinalizado(raw){
  const t = normText(raw);
  let lines = t.split("\n").map(x => x.trim()).filter(Boolean);

  // sacar "DEVOCIONAL" si viene arriba
  if (lines.length && /^devocional$/i.test(lines[0])) {
    lines.shift();
  }

  // sacar posibles líneas de iglesia/dirección del medio
  const iglesiaIdx = lines.findIndex(l =>
    /iglesia\s+cristiana\s+de\s+la\s+vida\s+abundante/i.test(l)
  );

  const direccionIdx = lines.findIndex(l =>
    /roca\s*123/i.test(l) || /tristan\s*suarez/i.test(l)
  );

  const fecha = lines[0] || "";

  // buscar cita bíblica
  let citaIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (detectCita(lines[i])) {
      citaIdx = i;
      break;
    }
  }

  if (citaIdx === -1) {
    // fallback suave: una línea corta tipo referencia
    citaIdx = lines.findIndex((l, i) =>
      i > 0 &&
      i < Math.max(1, iglesiaIdx >= 0 ? iglesiaIdx : lines.length) &&
      /[0-9]/.test(l) &&
      l.length <= 40
    );
  }

  let versiculo = "";
  if (citaIdx > 1) {
    versiculo = lines.slice(1, citaIdx).join(" ").trim();
  } else if (lines.length > 1) {
    versiculo = lines[1] || "";
  }

  const cita = citaIdx >= 0 ? (lines[citaIdx] || "") : "";

  // desde dónde empieza reflexión/oración
  let bodyStart = citaIdx >= 0 ? (citaIdx + 1) : 2;

  if (iglesiaIdx >= 0) bodyStart = Math.max(bodyStart, iglesiaIdx + 1);
  if (direccionIdx >= 0) bodyStart = Math.max(bodyStart, direccionIdx + 1);

  let bodyLines = lines.slice(bodyStart).filter(Boolean);

  // quitar iglesia/dirección si quedaron mezcladas
  bodyLines = bodyLines.filter(l =>
    !/iglesia\s+cristiana\s+de\s+la\s+vida\s+abundante/i.test(l) &&
    !/roca\s*123/i.test(l) &&
    !/tristan\s*suarez/i.test(l)
  );

  const idxRef = bodyLines.findIndex(l => /^[^\w]*reflexi[oó]n\b/i.test(l));
  const idxOra = bodyLines.findIndex(l => /^[^\w]*oraci[oó]n\b/i.test(l));

  let reflexion = "";
  let oracion = "";

  if (idxRef >= 0 && idxOra >= 0 && idxOra > idxRef) {
    const refLines = bodyLines.slice(idxRef, idxOra);
    if (refLines.length) refLines[0] = cleanReflexionHeader(refLines[0]);
    reflexion = refLines.join(" ").trim();

    const oraLines = bodyLines.slice(idxOra);
    if (oraLines.length) oraLines[0] = cleanOracionHeader(oraLines[0]);
    oracion = oraLines.join(" ").trim();
  } else if (idxOra >= 0) {
    reflexion = bodyLines.slice(0, idxOra).join(" ").trim();
    const oraLines = bodyLines.slice(idxOra);
    if (oraLines.length) oraLines[0] = cleanOracionHeader(oraLines[0]);
    oracion = oraLines.join(" ").trim();
  } else {
    reflexion = bodyLines.join(" ").trim();
    oracion = "";
  }

  reflexion = oneLine(reflexion);
  oracion = oneLine(oracion);

  const p1 = {
    fecha: oneLine(fecha),
    versiculo: oneLine(versiculo),
    cita: oneLine(cita),
    iglesia: "Iglesia Cristiana de la Vida Abundante",
    direccion: "Roca 123, Tristan Suarez."
  };

  const p2 = {
    reflexion,
    oracion
  };

  const audioText = buildAudioFromParts(p1, p2);
  return { p1, p2, audioText };
}

window.devPickFinalizado = function(){
  const inp = $("devInputFinalizado");
  if (inp) inp.click();
};

function devResetAudioManual(){
  DEV.audioManualBlob = null;
  DEV.audioManualBase64 = "";
  DEV.audioManualName = "";
}

function devUpdateAudioManualUI(){
  const info = $("devAudioManualInfo");

  if (info) {
    if (DEV.audioManualBlob && DEV.audioManualName) {
      info.textContent = `✅ Audio cargado: ${DEV.audioManualName}`;
    } else if (DEV.audioOk && DEV.requiereAudio) {
      info.textContent = "✅ Audio confirmado";
    } else if (!DEV.requiereAudio) {
      info.textContent = "Audio no requerido";
    } else {
      info.textContent = "Sin audio cargado";
    }
  }

  const btnAudio = $("devBtnAudio");
  const btnUp    = $("devBtnCargarAudioManual");
  const btnDel   = $("devBtnQuitarAudioManual");

  // ✅ Audio siempre visible en fase 3
  if (btnAudio) {
    btnAudio.style.display = "inline-flex";
  }

  // ✅ solo visible si vino de "Cargar finalizado"
  if (btnUp) {
    btnUp.style.display = DEV.finalizadaMode ? "inline-flex" : "none";
  }

  // ✅ visible si hay audio cargado/confirmado
  if (btnDel) {
    btnDel.style.display = (DEV.audioManualBlob || DEV.audioOk) ? "inline-flex" : "none";
  }
}

window.devAudioPickManual = function(){
  const inp = $("devAudioManualInput");
  if (inp) inp.click();
};

window.devAudioQuitarManual = function(){
  devResetAudioManual();
  DEV.audioOk = false;
  devUpdateAudioManualUI();
  devSetFinalButtons(DEV.requiereAudio ? false : true);
};

window.devAudioCargarManual = async function(file){
  try{
    if (!file) return;

    DEV.audioManualBlob = file;
    DEV.audioManualName = file.name || "audio_finalizado.mp3";
    DEV.audioManualBase64 = await blobToBase64(file);

    DEV.audioOk = true;
    devUpdateAudioManualUI();
    devSetFinalButtons(true);

    const audioEl =
      document.querySelector("#modalAudio audio") ||
      document.querySelector("audio#audioPreview") ||
      document.querySelector("audio");

    if (audioEl) {
      audioEl.src = URL.createObjectURL(file);
      audioEl.load();
    }

    devToast("🎵 Audio finalizado cargado");
  } catch(e){
    console.error(e);
    alert("❌ No pude cargar el audio.\n\nDetalle: " + (e?.message || e));
  }
};

window.devCargarFinalizado = async function(file){
  if (!file) return;

  devBusyShow("⏳ Leyendo devocional finalizado…");

  try{
    DEV.finalizadaMode = true;
    DEV.finalOriginalBlob = file;
    DEV.finalOriginalName = file.name || "devocional_final.png";

    if (DEV.finalOriginalUrl) {
      try { URL.revokeObjectURL(DEV.finalOriginalUrl); } catch {}
    }
    DEV.finalOriginalUrl = URL.createObjectURL(file);

    // reset audio del flujo
    DEV.audioOk = false;
    DEV.audioGithubUrl = "";
    devResetAudioManual();

const imageBase64 = await blobToBase64(file);

const r = await fetch(OCR_URL, {
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({ imageBase64 })
});

const data = await r.json().catch(()=> ({}));
if (!r.ok) {
  throw new Error(data?.error || data?.detail || ("OCR " + r.status));
}

const text = (data?.text || "").trim();
if (!text) throw new Error("No se detectó texto en la imagen finalizada.");

    DEV.rawText = text;

    const { p1, p2, audioText } = buildBloquesFromOCRFinalizado(text);

    DEV.p1 = p1;
    DEV.p2 = p2;
    DEV.audioText = audioText;

    DEV.fields.fecha     = keepManualBreaks(p1?.fecha || "");
    DEV.fields.versiculo = keepManualBreaks(p1?.versiculo || "");
    DEV.fields.cita      = keepManualBreaks(p1?.cita || "");
    DEV.fields.reflexion = keepManualBreaks(p2?.reflexion || "");
    DEV.fields.oracion   = keepManualBreaks(p2?.oracion || "");

    const ta = $("devTexto");
    if (ta) ta.value = text;

    const boxText = $("devTextoBox");
    if (boxText) boxText.classList.remove("hidden");

    const img = $("devFinalImg");
    if (img && DEV.finalOriginalUrl) {
      img.src = DEV.finalOriginalUrl;
    }

    // ir a fase 0 para corregir campos
    await devAbrirFase0();

    devToast("✅ Finalizado cargado");
  } catch(e){
    console.error(e);
    alert("❌ No pude procesar el devocional finalizado.\n\nDetalle: " + (e?.message || e));
  } finally {
    devBusyHide();
  }
};

function devInitFinalizadoHook(){
  const inp = $("devInputFinalizado");
  if (!inp || inp.__hookFinalizado) return;

  inp.__hookFinalizado = true;
  inp.addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if (!file) return;
    await window.devCargarFinalizado(file);
    e.target.value = "";
  });
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

  // ✅ si el foco quedó adentro del modal, lo sacamos antes de ocultarlo
  // evita el warning de aria-hidden y que quede “trabado” visualmente
  try {
    if (m.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  } catch {}

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
  DEV.requiereAudio = true;
  DEV.subirAudioGithub = true;
  devSetFinalButtons(false);

  DEV.finalizadaMode = false;
  DEV.finalOriginalBlob = null;
  DEV.finalOriginalName = "";

  if (DEV.finalOriginalUrl) {
    try { URL.revokeObjectURL(DEV.finalOriginalUrl); } catch {}
  }
  DEV.finalOriginalUrl = "";

  devResetAudioManual();

  window.__devFinalCanvas = null;
  window.__devFinalFile = null;

  // ✅ reset visual de la pantalla crear
  DEV.img = null;
  DEV.crop = null;

const btnFinal = $("btnDevCargarFinal");
const btnRecortar = $("btnDevRecortar");
const btnListo = $("btnDevListo");
const btnOCR = $("btnDevOCR");
const ta = $("devTexto");
const estado = $("estadoOCRDev");

if (btnFinal) btnFinal.style.display = "inline-flex";

if (btnRecortar) {
  btnRecortar.style.display = "none";
  btnRecortar.disabled = true;
  btnRecortar.style.opacity = "0.6";
}

if (btnListo) btnListo.style.display = "none";

if (btnOCR) {
  btnOCR.style.display = "none";
  btnOCR.disabled = false;
  btnOCR.style.opacity = "1";
}

if (ta) ta.value = "";

if (estado) {
  estado.textContent = "✅ Cargá una imagen, recortá si querés y tocá Crear devocional.";
}
   
  // ✅ volver al Home
  devMostrarHome();
};

/* =========================================================
   5) FUENTES (igual que Biblia pero separado)
   ========================================================= */
const fuentesGoogle = [
  // ================= Limpias y muy legibles =================
  { nombre: "Roboto", css: "Roboto, sans-serif" },
  { nombre: "Lexend", css: "Lexend, sans-serif" },
  { nombre: "Montserrat", css: "Montserrat, sans-serif" },
  { nombre: "Poppins", css: "Poppins, sans-serif" },
  { nombre: "Oswald", css: "Oswald, sans-serif" },
  { nombre: "Josefin Sans", css: "'Josefin Sans', sans-serif" },

  // ================= Clásicas / bíblicas =================
  { nombre: "Lora", css: "Lora, serif" },
  { nombre: "Merriweather", css: "Merriweather, serif" },
  { nombre: "Libre Baskerville", css: "'Libre Baskerville', serif" },
  { nombre: "Alegreya", css: "Alegreya, serif" },
  { nombre: "Playfair Display", css: "'Playfair Display', serif" },
  { nombre: "DM Serif Display", css: "'DM Serif Display', serif" },
  { nombre: "Cinzel", css: "Cinzel, serif" },
  { nombre: "Cormorant", css: "Cormorant, serif" },

  // ================= Fuertes para títulos =================
  { nombre: "Bebas Neue", css: "'Bebas Neue', sans-serif" },
  { nombre: "Abril Fatface", css: "'Abril Fatface', serif" },

  // ================= Manuscritas / decorativas =================
  { nombre: "Lobster", css: "Lobster, cursive" },
  { nombre: "Caveat", css: "Caveat, cursive" },
  { nombre: "Dancing Script", css: "'Dancing Script', cursive" },
  { nombre: "Courgette", css: "Courgette, cursive" },
  { nombre: "Great Vibes", css: "'Great Vibes', cursive" },

  // ✅ La dejamos porque en tu celular sí se visualiza bien
  { nombre: "Comic Sans MS", css: "'Comic Sans MS', cursive" }
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
      e.preventDefault();
      e.stopPropagation();

      st.fuente = f.css;

      lista.querySelectorAll("button").forEach(x=>x.classList.remove("activo"));
      b.classList.add("activo");

      devRenderFase(fase);

      // ✅ ya NO cerramos al elegir
    };

    lista.appendChild(b);
  });

  const posicionar = ()=>{
    const rModal = modalBox.getBoundingClientRect();
    const rBtn = btn.getBoundingClientRect();
    const pad = 12;

    lista.style.left = (rModal.left + pad) + "px";
    lista.style.width = (rModal.width - pad * 2) + "px";
    lista.style.top = (rBtn.bottom + 8) + "px";
  };

  btn.onclick = (e)=>{
    e.preventDefault();
    e.stopPropagation();

    const open = lista.classList.toggle("abierto");
    btn.classList.toggle("activo", open);

    if (open) posicionar();
  };

  window.addEventListener("resize", ()=>{
    if (lista.classList.contains("abierto")) posicionar();
  });

  window.addEventListener("scroll", ()=>{
    if (lista.classList.contains("abierto")) posicionar();
  }, true);

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
const fondosCategorias = {
  paisajes: [
     "./img/fondos/Paisajes/1a.jpg",
      "./img/fondos/Paisajes/2a.jpg",
      "./img/fondos/Paisajes/3a.jpg",
      "./img/fondos/Paisajes/4a.jfif",
      "./img/fondos/Paisajes/5a.jfif",
      "./img/fondos/Paisajes/6a.jfif",
      "./img/fondos/Paisajes/7a.jfif",
      "./img/fondos/Paisajes/8a.jfif",
      "./img/fondos/Paisajes/9a.jfif",
      "./img/fondos/Paisajes/10a.jfif",
      "./img/fondos/Paisajes/11a.jfif",
      "./img/fondos/Paisajes/12a.jfif",
      "./img/fondos/Paisajes/13a.jfif",     
     "./img/fondos/Paisajes/1.jpeg",
      "./img/fondos/Paisajes/2.jpeg",
      "./img/fondos/Paisajes/3.jpeg",
      "./img/fondos/Paisajes/4.jpeg",
      "./img/fondos/Paisajes/5.jpeg",
      "./img/fondos/Paisajes/6.jpeg",
      "./img/fondos/Paisajes/7.jpeg",
      "./img/fondos/Paisajes/8.jpeg",
      "./img/fondos/Paisajes/9.jpeg",
      "./img/fondos/Paisajes/10.jpeg",
      "./img/fondos/Paisajes/11.jpeg",
      "./img/fondos/Paisajes/12.jpeg",
      "./img/fondos/Paisajes/13.jpeg",
    "./img/fondos/Paisajes/Untitled_Project_10_scjlfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_11_z3nudj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_12_crdynt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_13_dzxm4k.jpg",
    "./img/fondos/Paisajes/Untitled_Project_14_iww2jx.jpg",
    "./img/fondos/Paisajes/Untitled_Project_15_iu1uxj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_cg9dfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_jwctxg.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_q3uzog.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_qttkkt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_z6ol0o.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_a1wlsh.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_ehfqna.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_hi9hhz.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_twzefr.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_wzlhio.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_jhrx0j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_qfbqel.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_thrkka_b1ibx2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_tjsq2f.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_zw4kl2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_brmypi.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_ftamyb.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_htsxrq.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_ghg8ux.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_kpgvmm.jpg",
    "./img/fondos/Paisajes/Untitled_Project_7_qpfbuy.jpg",
    "./img/fondos/Paisajes/Untitled_Project_8_ivok7j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_c2feyb_juy9d6.jpg",
    "./img/fondos/Paisajes/Untitled_Project_ycpnpv.jpg",
    "./img/fondos/Paisajes/amanecer1600x1600_igddhh.jpg",
    "./img/fondos/Paisajes/amanecerpiedras_zb18j1.jpg",
    "./img/fondos/Paisajes/arbustos_pwdcsk.jpg",
    "./img/fondos/Paisajes/arcadafloresrosas_fc4aj4.jpg",
    "./img/fondos/Paisajes/arcoflores_lnrfa9.jpg",
    "./img/fondos/Paisajes/bebedero_ystc1u.jpg",
    "./img/fondos/Paisajes/boda_nmzaub.jpg",
    "./img/fondos/Paisajes/camino_madnav.jpg",
    "./img/fondos/Paisajes/casitalejosarboles_by72rz_upjpn4.jpg",
    "./img/fondos/Paisajes/cielocelesterosaarboles_y4t720.jpg",
    "./img/fondos/Paisajes/cielovioleta_us3ilw.jpg",
    "./img/fondos/Paisajes/faro2_s5ynwu.jpg",
    "./img/fondos/Paisajes/faro_aginuk.jpg",
    "./img/fondos/Paisajes/floresamarillas_mhosyy.jpg",
    "./img/fondos/Paisajes/floresblancasyrosas_ehpvfy.jpg",
    "./img/fondos/Paisajes/floresmontañas_h8qhkd.jpg",
    "./img/fondos/Paisajes/jardinflores_eqxwe5.jpg",
    "./img/fondos/Paisajes/jardinflorescielorosas_qctpa1.jpg",
    "./img/fondos/Paisajes/lagunapastofloresrosas_gibn7c.jpg",
    "./img/fondos/Paisajes/margaritasporton_wnpdps.jpg",
    "./img/fondos/Paisajes/mariposas_mmo86f.jpg",
    "./img/fondos/Paisajes/montaña_c455zz.jpg",
    "./img/fondos/Paisajes/montañagrande_vwag5k.jpg",
    "./img/fondos/Paisajes/olascielo_igbddx.jpg",
    "./img/fondos/Paisajes/otoño2_mwn77p.jpg",
    "./img/fondos/Paisajes/otoño_kdx8u5.jpg",
    "./img/fondos/Paisajes/pastofloresrosas_i0woqq.jpg",
    "./img/fondos/Paisajes/piedrasaguamontañas_lseoki.jpg",
    "./img/fondos/Paisajes/playaarenamarolas_oxkh2z.jpg",
    "./img/fondos/Paisajes/plazaamanecer_nvjtqa.jpg",
    "./img/fondos/Paisajes/puente_gox2gz.jpg",
    "./img/fondos/Paisajes/puenteotoñoagua_r9tskw.jpg",
    "./img/fondos/Paisajes/puertaangostaflores_fvdw8o.jpg",
    "./img/fondos/Paisajes/puertafloresblancas_ouomif.jpg",
    "./img/fondos/Paisajes/puertaflroesvioletas_q4f1bq.jpg"
  ],

  acuarelas: [
"./img/fondos/Acuarelas/1a.png",
"./img/fondos/Acuarelas/2a.png",
     "./img/fondos/Acuarelas/3a.png",
     "./img/fondos/Acuarelas/4a.png",
     "./img/fondos/Acuarelas/5a.png",
     "./img/fondos/Acuarelas/6a.png",
     "./img/fondos/Acuarelas/7a.png",
     "./img/fondos/Acuarelas/8a.png",
     "./img/fondos/Acuarelas/9a.png",
     "./img/fondos/Acuarelas/10a.png",
     "./img/fondos/Acuarelas/11a.png",
     "./img/fondos/Acuarelas/12a.png",
     "./img/fondos/Acuarelas/13a.png",
    "./img/fondos/Acuarelas/Untitled_Project_10_dzbofe_hudn3p.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_10_hgtbrz.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_1_gffwqd.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_2_vdks5w.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_3_crxvum.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_rplu10_avqvn9.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_xubjvd_wyhnzq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_yp8i7h_vtja0u.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_ghlggy_ogar08.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_r3cqwb.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_wychbo.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_cf7yzv_ujyx6n.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_hnxuau_yhk6w7.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_8_h5y32e.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_b3tkxx_jgo6gs.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_zhryll.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_l02emm_gtylbq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_wefjkh.jpg",
    "./img/fondos/Acuarelas/casita_sxlvcf_s5lvth.jpg",
    "./img/fondos/Acuarelas/floresfucsias_f17kul.jpg",
    "./img/fondos/Acuarelas/lilamontañasflores_vayxei_ubvtpm.jpg",
    "./img/fondos/Acuarelas/nubepasto_w0pg1i.jpg",
    "./img/fondos/Acuarelas/rosabotes_bwnvws.jpg"
  ],

  tarjetas: [
 "./img/fondos/Tarjetas/1a.png",
     "./img/fondos/Tarjetas/2a.png",
     "./img/fondos/Tarjetas/3a.png",
     "./img/fondos/Tarjetas/4a.png",
     "./img/fondos/Tarjetas/5a.png",
     "./img/fondos/Tarjetas/6a.png",
     "./img/fondos/Tarjetas/7a.png",
     "./img/fondos/Tarjetas/8a.png",
     "./img/fondos/Tarjetas/9a.png",
     "./img/fondos/Tarjetas/10a.png",
     "./img/fondos/Tarjetas/11a.png",
     "./img/fondos/Tarjetas/12a.png",
     "./img/fondos/Tarjetas/13a.png",
      "./img/fondos/Tarjetas/14a.png",
    "./img/fondos/Tarjetas/Untitled_Project_12_oal95a.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_1_arstzx_inkdoy.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_2_wza5pr_rgvyrz.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_3_xyutfs_wwvy6h.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_fwlgtt.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_kwzbbn_iuh5nl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_uxzbsn_f1a2vp.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_zey825.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_gunjzi_t9iy0d.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_qv09sl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_8_xzqnli_opyzjn.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_9_uoqpfk_k7v565.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_tgzcpn_u75stk.jpg",
    "./img/fondos/Tarjetas/amarillopajarosnubes_ar0qqg_x9rx4p.jpg",
    "./img/fondos/Tarjetas/cielopastofloresrosas_cyfof2_dbqnq7.jpg",
    "./img/fondos/Tarjetas/cielorosa_pc0puk_b1qrvx.jpg",
    "./img/fondos/Tarjetas/flores_riug8f_whpgds.jpg"
  ]
};

const fondosEtiquetas = {
  paisajes: "Paisajes",
  acuarelas: "Acuarelas",
  tarjetas: "Tarjetas"
};

let devF1CategoriaActual = "paisajes";


/* =========================================================
   FONDOS COMPARTIDOS CON EDICIONES
   Ediciones.js administra altas, reemplazos y quitados.
========================================================= */
window.__VA_FONDOS_BASE_PENDIENTE =
  window.__VA_FONDOS_BASE_PENDIENTE || {};

Object.entries(fondosCategorias).forEach(([categoria, urls]) => {
  const actuales = Array.isArray(window.__VA_FONDOS_BASE_PENDIENTE[categoria])
    ? window.__VA_FONDOS_BASE_PENDIENTE[categoria]
    : [];

  window.__VA_FONDOS_BASE_PENDIENTE[categoria] = Array.from(
    new Set([
      ...actuales,
      ...(Array.isArray(urls) ? urls : [])
    ])
  );
});

if (!window.__DEV_FONDOS_EVENTO_ACTIVO) {
  window.__DEV_FONDOS_EVENTO_ACTIVO = true;

  window.addEventListener("va-fondos-actualizados", () => {
    if (document.getElementById("dev1Fondos")) {
      cargarFondosDev();
    }
  });
}

window.vaFondosRegistrarBase?.(fondosCategorias);


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

  const menuWrap = document.createElement("div");
  menuWrap.className = "dev-f1-menu-wrap";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "dev-f1-menu-btn";
  menuBtn.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
  menuBtn.title = "Elegir galería";

  const menu = document.createElement("div");
  menu.className = "dev-f1-menu";

  Object.keys(fondosCategorias).forEach(cat => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = fondosEtiquetas[cat] || cat;
    b.classList.toggle("activo", cat === devF1CategoriaActual);

    b.onclick = (e)=>{
      e.preventDefault();
      e.stopPropagation();
      devF1CategoriaActual = cat;
      cargarFondosDev();
    };

    menu.appendChild(b);
  });

  menuBtn.onclick = (e)=>{
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("abierto");
  };

  document.addEventListener("click", (e)=>{
    if (!menuWrap.contains(e.target)) {
      menu.classList.remove("abierto");
    }
  });

  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  cont.appendChild(menuWrap);

  const fondos = window.vaFondosObtenerLista
    ? window.vaFondosObtenerLista(devF1CategoriaActual)
    : (fondosCategorias[devF1CategoriaActual] || []);

  fondos.forEach(base=>{
  const finalUrl = base;

    const im = document.createElement("img");
    im.crossOrigin = "anonymous";
    im.referrerPolicy = "no-referrer";
    im.src = finalUrl;

    im.onclick = async ()=>{
      try{
        if (DEV.f1.fondoBlob) URL.revokeObjectURL(DEV.f1.fondoBlob);
        DEV.f1.fondoUrl = null;
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
  { nombre: "🔲", url: null },
   { nombre: "Adorno 14", url: "./img/ornamentos/a11.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a22.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a33.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a44.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a55.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a66.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a77.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a88.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a99.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/a100.png" },
   { nombre: "Adorno 14", url: "./img/ornamentos/O1.png" },
  { nombre: "Adorno 15", url: "./img/ornamentos/O2.png" },
  { nombre: "Adorno 16", url: "./img/ornamentos/O3.png" },
  { nombre: "Adorno 17", url: "./img/ornamentos/O4.png" },
  { nombre: "Adorno 18", url: "./img/ornamentos/O5.png" },
    { nombre: "Adorno 20", url: "./img/ornamentos/O7.png" },
  { nombre: "Adorno 21", url: "./img/ornamentos/O8.png" },
   { nombre: "Adorno 23", url: "./img/ornamentos/O10.png" },
    { nombre: "Adorno 25", url: "./img/ornamentos/O12.png" },
  { nombre: "Adorno 26", url: "./img/ornamentos/O13.png" },
  { nombre: "Adorno 27", url: "./img/ornamentos/O14.png" },
  { nombre: "Adorno 28", url: "./img/ornamentos/O15.png" },
  { nombre: "Adorno 29", url: "./img/ornamentos/O16.png" },
  { nombre: "Adorno 30", url: "./img/ornamentos/O17.png" },
  { nombre: "Adorno 31", url: "./img/ornamentos/O18.png" },
  { nombre: "Adorno 1", url: "./img/ornamentos/adorno1.png" },
  { nombre: "Adorno 2", url: "./img/ornamentos/adorno2.png" },
  { nombre: "Adorno 3", url: "./img/ornamentos/adorno3.png" },
  { nombre: "Adorno 4", url: "./img/ornamentos/adorno4.png" },
  { nombre: "Adorno 5", url: "./img/ornamentos/adorno5.png" },
  { nombre: "Adorno 6", url: "./img/ornamentos/adorno6.png" },
  { nombre: "Adorno 7", url: "./img/ornamentos/adorno7.png" },
  { nombre: "Adorno 8", url: "./img/ornamentos/adorno8.png" },
  { nombre: "Adorno 9", url: "./img/ornamentos/adorno9.png" },
  { nombre: "Adorno 10", url: "./img/ornamentos/adorno10.png" },
  { nombre: "Adorno 11", url: "./img/ornamentos/adorno11.png" },
  { nombre: "Adorno 12", url: "./img/ornamentos/adorno12.png" },
  { nombre: "Adorno 13", url: "./img/ornamentos/adorno13.png" }
];

function devF2TexturasSeleccionadas() {
  const actuales = Array.isArray(DEV.f2?.texturasUrls)
    ? DEV.f2.texturasUrls
    : [];

  const heredada = String(DEV.f2?.texturaUrl || "").trim();

  return Array.from(
    new Set([
      ...actuales.map(url => String(url || "").trim()).filter(Boolean),
      ...(heredada ? [heredada] : [])
    ])
  );
}

function devF2GuardarTexturas(urls = []) {
  const limpias = Array.from(
    new Set(
      (Array.isArray(urls) ? urls : [])
        .map(url => String(url || "").trim())
        .filter(Boolean)
    )
  );

  DEV.f2.texturasUrls = limpias;
  DEV.f2.texturaUrl = limpias[0] || null;
}

function devRecursosF2Administrados(categoria, base, nombreVacio) {
  const baseLimpia = (Array.isArray(base) ? base : [])
    .filter(item => item && item.url)
    .map(item => ({
      nombre: String(item.nombre || "Recurso"),
      url: String(item.url || "").trim()
    }))
    .filter(item => item.url);

  const administrados =
    typeof window.vaFondosObtenerItems === "function"
      ? window.vaFondosObtenerItems(categoria, false)
          .map(item => ({
            nombre: String(item?.nombre || "Recurso"),
            url: String(item?.url || "").trim()
          }))
          .filter(item => item.url)
      : baseLimpia;

  return [
    { nombre: nombreVacio, url: null },
    ...administrados
  ];
}

function cargarAdornosF2(){
  const cont = $("dev2Adornos");
  if (!cont) return;

  cont.innerHTML = "";

  const items = devRecursosF2Administrados(
    "adornos",
    adornosF2,
    "Sin adorno"
  );

  const adornosPermitidos = new Set(
    items.map(item => String(item?.url || "").trim()).filter(Boolean)
  );

  if (
    DEV.f2.adornoUrl &&
    !adornosPermitidos.has(DEV.f2.adornoUrl)
  ) {
    DEV.f2.adornoUrl = null;
  }

  items.forEach(item=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dev-adorno-btn";

    if (item.url) {
      b.textContent = "";
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.nombre;
      img.className = "dev-adorno-thumb";
      img.onerror = () => {
        b.classList.add("dev-adorno-btn-none");
        b.innerHTML = `<i class="fa-solid fa-genderless"></i>`;
      };
      b.appendChild(img);
    } else {
      b.classList.add("dev-adorno-btn-none");
      b.innerHTML = `<i class="fa-solid fa-genderless"></i>`;
    }

    const activo = (DEV.f2.adornoUrl === item.url);
    b.classList.toggle("activo", activo);
    b.title = item.nombre;

    b.onclick = ()=>{
      DEV.f2.adornoUrl = item.url;

      cont.querySelectorAll("button").forEach(x=>x.classList.remove("activo"));
      b.classList.add("activo");

      if (!DEV.f2.userChanged) {
        const texto = `Reflexión: ${DEV.p2?.reflexion || ""}\nOración: ${DEV.p2?.oracion || ""}`;
        const sugerido = sugerirTamanoFase2Auto(texto);
        DEV.f2.size = sugerido;

        const s2 = $("dev2Tamano");
        if (s2) s2.value = fmtSize(sugerido);
      }

      devRenderFase(2);
    };

    cont.appendChild(b);
  });
}

const texturasF2 = [
  { nombre: "🔲", url: null },
    { nombre: "Textura 21", url: "./img/texturas/c1.png" },
   { nombre: "Textura 21", url: "./img/texturas/c2.png" },
   { nombre: "Textura 21", url: "./img/texturas/c3.png" },
   { nombre: "Textura 21", url: "./img/texturas/c4.png" },
   { nombre: "Textura 21", url: "./img/texturas/c5.png" },
   { nombre: "Textura 21", url: "./img/texturas/c6.png" },
   { nombre: "Textura 21", url: "./img/texturas/c7.png" },
   { nombre: "Textura 21", url: "./img/texturas/c8.png" },
   { nombre: "Textura 21", url: "./img/texturas/c9.png" },
   { nombre: "Textura 21", url: "./img/texturas/c10.png" },
   { nombre: "Textura 21", url: "./img/texturas/c11.png" },
   { nombre: "Textura 21", url: "./img/texturas/c12.png" },
   { nombre: "Textura 21", url: "./img/texturas/c14.png" },
   { nombre: "Textura 21", url: "./img/texturas/c15.png" },
   { nombre: "Textura 21", url: "./img/texturas/c16.png" },
   { nombre: "Textura 21", url: "./img/texturas/c17.png" },
   { nombre: "Textura 21", url: "./img/texturas/c18.png" },
   { nombre: "Textura 21", url: "./img/texturas/c19.png" },
   { nombre: "Textura 21", url: "./img/texturas/c20.png" },
   { nombre: "Textura 21", url: "./img/texturas/c21.png" },
   { nombre: "Textura 21", url: "./img/texturas/c22.png" },
   { nombre: "Textura 21", url: "./img/texturas/c23.png" },
   { nombre: "Textura 21", url: "./img/texturas/c24.png" },
   { nombre: "Textura 21", url: "./img/texturas/c25.png" },
   { nombre: "Textura 21", url: "./img/texturas/1.png" },
   { nombre: "Textura 22", url: "./img/texturas/2.png" },
   { nombre: "Textura 23", url: "./img/texturas/3.png" },
   { nombre: "Textura 24", url: "./img/texturas/4.png" },
   { nombre: "Textura 25", url: "./img/texturas/5.png" },
   { nombre: "Textura 26", url: "./img/texturas/6.png" },
   { nombre: "Textura 27", url: "./img/texturas/7.png" },
  { nombre: "Textura 1", url: "./img/texturas/TEXTURA1.png" },
  { nombre: "Textura 2", url: "./img/texturas/TEXTURA2.png" },
  { nombre: "Textura 3", url: "./img/texturas/TEXTURA3.png" },
  { nombre: "Textura 4", url: "./img/texturas/TEXTURA4.png" },
  { nombre: "Textura 5", url: "./img/texturas/TEXTURA5.png" },
  { nombre: "Textura 6", url: "./img/texturas/TEXTURA6.png" },
  { nombre: "Textura 7", url: "./img/texturas/TEXTURA7.png" },
  { nombre: "Textura 8", url: "./img/texturas/TEXTURA8.png" },
  { nombre: "Textura 9", url: "./img/texturas/TEXTURA9.png" },
  { nombre: "Textura 10", url: "./img/texturas/TEXTURA10.png" },
  { nombre: "Textura 11", url: "./img/texturas/TEXTURA11.png" },
  { nombre: "Textura 12", url: "./img/texturas/TEXTURA12.png" },
  { nombre: "Textura 13", url: "./img/texturas/TEXTURA13.png" },
  { nombre: "Textura 14", url: "./img/texturas/TEXTURA14.png" },
  { nombre: "Textura 15", url: "./img/texturas/TEXTURA15.png" },
  { nombre: "Textura 16", url: "./img/texturas/TEXTURA16.png" },
  { nombre: "Textura 17", url: "./img/texturas/TEXTURA17.png" },
  { nombre: "Textura 18", url: "./img/texturas/TEXTURA18.png" },
  { nombre: "Textura 19", url: "./img/texturas/TEXTURA19.png" },
  { nombre: "Textura 20", url: "./img/texturas/TEXTURA20.png" }
];


function devRegistrarRecursosDecorativosEdiciones() {
  const recursos = {
    texturas: texturasF2
      .map(item => String(item?.url || "").trim())
      .filter(Boolean),

    adornos: adornosF2
      .map(item => String(item?.url || "").trim())
      .filter(Boolean)
  };

  window.__VA_FONDOS_BASE_PENDIENTE =
    window.__VA_FONDOS_BASE_PENDIENTE || {};

  Object.entries(recursos).forEach(([categoria, urls]) => {
    const actuales = Array.isArray(window.__VA_FONDOS_BASE_PENDIENTE[categoria])
      ? window.__VA_FONDOS_BASE_PENDIENTE[categoria]
      : [];

    window.__VA_FONDOS_BASE_PENDIENTE[categoria] = Array.from(
      new Set([
        ...actuales,
        ...(Array.isArray(urls) ? urls : [])
      ])
    );
  });

  window.vaFondosRegistrarBase?.(recursos);
}

if (!window.__DEV_RECURSOS_DECORATIVOS_EVENTO_ACTIVO) {
  window.__DEV_RECURSOS_DECORATIVOS_EVENTO_ACTIVO = true;

  window.addEventListener("va-fondos-actualizados", () => {
    if (document.getElementById("dev2Texturas")) {
      cargarTexturasF2();
    }

    if (document.getElementById("dev2Adornos")) {
      cargarAdornosF2();
    }
  });
}

devRegistrarRecursosDecorativosEdiciones();

function cargarTexturasF2(){
  const cont = $("dev2Texturas");
  if (!cont) return;

  cont.innerHTML = "";

  const items = devRecursosF2Administrados(
    "texturas",
    texturasF2,
    "Sin textura"
  );

  const permitidas = new Set(
    items.map(item => String(item?.url || "").trim()).filter(Boolean)
  );

  const seleccionadas = devF2TexturasSeleccionadas()
    .filter(url => permitidas.has(url));

  devF2GuardarTexturas(seleccionadas);

  items.forEach(item=>{
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dev-textura-btn";
    b.textContent = "";

    if (item.url) {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = item.nombre;
      img.className = "dev-textura-thumb";
      img.onerror = () => {
        b.classList.add("dev-textura-btn-none");
        b.innerHTML = `<i class="fa-solid fa-genderless"></i>`;
      };
      b.appendChild(img);
    } else {
      b.classList.add("dev-textura-btn-none");
      b.innerHTML = `<i class="fa-solid fa-genderless"></i>`;
    }

    const activo = item.url
      ? seleccionadas.includes(item.url)
      : seleccionadas.length === 0;

    b.classList.toggle("activo", activo);
    b.title = item.url
      ? `${item.nombre} · tocar para agregar o quitar`
      : item.nombre;

    b.onclick = ()=>{
      if (!item.url) {
        devF2GuardarTexturas([]);
      } else {
        const actuales = devF2TexturasSeleccionadas();

        const nuevas = actuales.includes(item.url)
          ? actuales.filter(url => url !== item.url)
          : [item.url, ...actuales];

        devF2GuardarTexturas(nuevas);
      }

      cargarTexturasF2();
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

function textShadowLegible(textHex, outlineHex = null){
  const oc = devHexSeguro(outlineHex) || outlineColor(textHex || "#000000");

  return `
    -1.6px 0 ${oc},
     1.6px 0 ${oc},
     0 -1.6px ${oc},
     0  1.6px ${oc},
    -1.1px -1.1px ${oc},
     1.1px -1.1px ${oc},
    -1.1px  1.1px ${oc},
     1.1px  1.1px ${oc},
     0 0 3px ${oc}
  `;
}

function devHexSeguro(color = "") {
  const c = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "";
}

function devSetHostColorVisual(hostId, color) {
  const host = $(hostId);
  const c = devHexSeguro(color) || "#ffffff";

  if (!host) return;

  host.style.setProperty("--pickr-color", c);
  host.style.background = c;
  host.style.backgroundColor = c;
}

function devAsegurarControlContorno(fase) {
  const colorHost = $(`dev${fase}ColorHost`);
  if (!colorHost) return null;

  let input = $(`dev${fase}OutlineColor`);

  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.id = `dev${fase}OutlineColor`;
    input.value = "";
    input.dataset.manual = "0";

    colorHost.insertAdjacentElement("afterend", input);
  }

  let host = $(`dev${fase}OutlineColorHost`);

  if (!host) {
    host = document.createElement("button");
    host.type = "button";
    host.id = `dev${fase}OutlineColorHost`;
    host.className = "pickr-host dev-outline-color-host";
    host.dataset.target = `#dev${fase}OutlineColor`;
    host.title = "Color del contorno";
    host.setAttribute("aria-label", "Color del contorno");

    input.insertAdjacentElement("afterend", host);
  }

  if (!input.dataset.ready) {
    input.dataset.ready = "1";

    input.addEventListener("input", () => {
      const st = fase === 1 ? DEV.f1 : DEV.f2;

      input.dataset.manual = "1";
      st.outlineColor = devHexSeguro(input.value) || "";

      if (fase === 1) {
        // ✅ si cambio borde en Fase 1, se copia a Fase 2
        devF2HeredarTextoDesdeF1SiCorresponde();
      }

      if (fase === 2) {
        // ✅ si el usuario toca manualmente el borde en Fase 2,
        // deja de seguir automáticamente a Fase 1
        DEV.f2.textoSigueF1 = false;
      }

      devSetHostColorVisual(`dev${fase}OutlineColorHost`, st.outlineColor || outlineColor(st.color));
      devRenderFase(fase);
    });
  }

  if (!host.dataset.pickrReady && typeof initPickrEnHosts === "function") {
    setTimeout(() => {
      initPickrEnHosts(`#dev${fase}OutlineColorHost`);
    }, 0);
  }

  return input;
}

function devGetOutlineColor(fase, colorTexto) {
  const st = fase === 1 ? DEV.f1 : DEV.f2;
  const input = devAsegurarControlContorno(fase);

  const sugerido = outlineColor(colorTexto || "#000000");
  let final = sugerido;

  if (input) {
    const manual = input.dataset.manual === "1";
    const elegido = devHexSeguro(input.value || st.outlineColor);

    if (manual && elegido) {
      final = elegido;
    } else {
      input.value = sugerido;
      input.dataset.manual = "0";
      final = sugerido;
    }
  }

  st.outlineColor = final;
  devSetHostColorVisual(`dev${fase}ColorHost`, colorTexto || "#000000");
  devSetHostColorVisual(`dev${fase}OutlineColorHost`, final);

  return final;
}

function textShadowLegibleFinal(textHex, scale = 1, outlineHex = null){
  const oc = devHexSeguro(outlineHex) || outlineColor(textHex || "#000000");
  const s = Math.max(0.12, Number(scale) || 1);
  const px = (n) => `${(n * s).toFixed(2)}px`;

  return `
    -${px(3)} 0 ${oc},
     ${px(3)} 0 ${oc},
     0 -${px(3)} ${oc},
     0  ${px(3)} ${oc},
    -${px(2)} -${px(2)} ${oc},
     ${px(2)} -${px(2)} ${oc},
    -${px(2)}  ${px(2)} ${oc},
     ${px(2)}  ${px(2)} ${oc},
     0 0 ${px(4)} ${oc}
  `;
}

function applyTextStylesToOne(el, st){
  el.style.textTransform  = st.style.upper ? "uppercase" : "none";
  el.style.fontWeight     = st.style.bold ? "900" : "500";
  el.style.fontStyle      = st.style.italic ? "italic" : "normal";

  // ✅ Subrayado eliminado: en imagen no estaba funcionando bien
  // y nos libera espacio en los controles.
  el.style.textDecoration = "none";
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

const DEV_CUENTAGOTAS_F2 = {
  color: "#000000",
  ctx: null,
  arrastrando: false,
  destino: "fondoF2",
  destinoFondo: 1
};

function devRgbToHex(r, g, b){
  const hx = n => Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function devEnsureBotonCuentagotasF2(){
  if ($("devBtnCuentagotasF2")) return;

  const previewBox =
    $("dev2Preview")?.closest(".dev-preview-box") ||
    $("dev2Preview")?.parentElement;

  if (!previewBox) return;

  const row = document.createElement("div");
  row.className = "dev2-eyedropper-row";
  row.innerHTML = `
    <button type="button" id="devBtnCuentagotasF2">
      <i class="fa-solid fa-eye-dropper"></i>
      Tomar color del fondo de fase 1
    </button>
  `;

  previewBox.insertAdjacentElement("afterend", row);

  const btn = $("devBtnCuentagotasF2");
  if (btn) {
    btn.addEventListener("click", () => {
      window.devAbrirCuentagotasF2();
    });
  }
}

function devEnsureBotonCuentagotasWrapperF1(){
  if ($("devBtnCuentagotasWrapperF1")) return;

  const host =
    $("dev1OpColorHost") ||
    $("dev1OpColor");

  if (!host?.parentElement) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "devBtnCuentagotasWrapperF1";
  btn.title = "Tomar color del fondo para el wrapper";
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = `<i class="fa-solid fa-eye-dropper"></i>`;

  btn.style.width = "36px";
  btn.style.height = "36px";
  btn.style.minWidth = "36px";
  btn.style.padding = "0";
  btn.style.border = "none";
  btn.style.borderRadius = "999px";
  btn.style.background = "var(--ui-azul-claro, #d1eeff)";
  btn.style.color = "#000";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.cursor = "pointer";
  btn.style.marginLeft = "6px";
  btn.style.verticalAlign = "middle";

  btn.onclick = () => {
    window.devAbrirCuentagotasF2(1, "wrapperF1");
  };

  host.insertAdjacentElement("afterend", btn);
}

function devEnsureModalCuentagotasF2(){
  if ($("modalDevCuentagotasF2")) return;

  const div = document.createElement("div");
  div.id = "modalDevCuentagotasF2";
  div.className = "modal-overlay";
  div.setAttribute("aria-hidden", "true");

  div.innerHTML = `
    <div class="modal-contenido">
      <button type="button" class="cerrar-modal" onclick="cerrarModal('modalDevCuentagotasF2')">✕</button>

      <h3 style="margin:8px 36px 4px; color:#0e286f;">
        Tomar color del fondo
      </h3>

      <p style="margin:0; font-size:14px; opacity:.75;">
        Tocá una parte de la imagen para copiar ese color.
      </p>

           <canvas id="devCuentagotasCanvas"></canvas>

      <div id="devCuentagotasCursor">
        <span id="devCuentagotasCursorColor"></span>
        <span id="devCuentagotasCursorHex">#000000</span>
      </div>

      <div class="dev-cuentagotas-colorbox">
        <span id="devCuentagotasMuestra"></span>
        <span id="devCuentagotasHex">#000000</span>
      </div>

      <div class="dev-cuentagotas-actions">
   <button type="button" onclick="devAplicarCuentagotasF2('fondoActual')">
  Usar este color
</button>

        <button type="button" onclick="cerrarModal('modalDevCuentagotasF2')">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(div);
}

function devSetColorCuentagotasF2(hex){
  DEV_CUENTAGOTAS_F2.color = hex || "#000000";

  const muestra = $("devCuentagotasMuestra");
  const label = $("devCuentagotasHex");

  if (muestra) muestra.style.background = DEV_CUENTAGOTAS_F2.color;
  if (label) label.textContent = DEV_CUENTAGOTAS_F2.color;
}

function devCargarImagenCuentagotasF2(src){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No pude cargar la imagen para tomar color."));

    img.src = src;
  });
}

window.devAbrirCuentagotasF2 = async function(indiceFondo = 1, destino = "fondoF2"){
  DEV_CUENTAGOTAS_F2.destinoFondo = Number(indiceFondo || 1);
  DEV_CUENTAGOTAS_F2.destino =
    destino === "wrapperF1" ? "wrapperF1" : "fondoF2";

  const src = DEV.f1?.fondoBlob || DEV.f1?.fondoUrl || "";

  if (!src) {
    alert("Primero elegí un fondo en la fase 1.");
    return;
  }

  devEnsureModalCuentagotasF2();
  abrirModal("modalDevCuentagotasF2");

  const canvas = $("devCuentagotasCanvas");
  if (!canvas) return;

  try {
    const img = await devCargarImagenCuentagotasF2(src);

    const maxW = 900;
    const maxH = 900;
    const sc = Math.min(maxW / img.width, maxH / img.height, 1);

    canvas.width = Math.max(1, Math.round(img.width * sc));
    canvas.height = Math.max(1, Math.round(img.height * sc));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    DEV_CUENTAGOTAS_F2.ctx = ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    devSetColorCuentagotasF2("#000000");

       canvas.style.touchAction = "none";

    const cursor = $("devCuentagotasCursor");
    const cursorColor = $("devCuentagotasCursorColor");
    const cursorHex = $("devCuentagotasCursorHex");

    const moverCursor = (e, hex) => {
      if (!cursor) return;

      const margen = 86;
      let left = e.clientX;
      let top = e.clientY;

      // ✅ para que no se salga de pantalla
      left = Math.max(70, Math.min(window.innerWidth - 70, left));
      top = Math.max(margen, Math.min(window.innerHeight - 20, top));

      cursor.style.left = left + "px";
      cursor.style.top = top + "px";
      cursor.style.display = "flex";

      if (cursorColor) cursorColor.style.background = hex;
      if (cursorHex) cursorHex.textContent = hex;
    };

    const ocultarCursor = () => {
      if (cursor) cursor.style.display = "none";
    };

    const tomarColorDesdePunto = (e) => {
      const r = canvas.getBoundingClientRect();

      const x = Math.max(0, Math.min(canvas.width - 1,
        Math.floor((e.clientX - r.left) * (canvas.width / r.width))
      ));

      const y = Math.max(0, Math.min(canvas.height - 1,
        Math.floor((e.clientY - r.top) * (canvas.height / r.height))
      ));

      const px = ctx.getImageData(x, y, 1, 1).data;
      const hex = devRgbToHex(px[0], px[1], px[2]);

      devSetColorCuentagotasF2(hex);
      moverCursor(e, hex);

      return hex;
    };

    canvas.onpointerdown = (e) => {
      e.preventDefault();

      DEV_CUENTAGOTAS_F2.arrastrando = true;
      canvas.setPointerCapture?.(e.pointerId);

      tomarColorDesdePunto(e);
    };

    canvas.onpointermove = (e) => {
      if (!DEV_CUENTAGOTAS_F2.arrastrando) return;

      e.preventDefault();
      tomarColorDesdePunto(e);
    };

    const terminarArrastre = (e) => {
      if (!DEV_CUENTAGOTAS_F2.arrastrando) return;

      e.preventDefault();

      // ✅ al soltar, dejamos elegido el último color tocado
      tomarColorDesdePunto(e);

      DEV_CUENTAGOTAS_F2.arrastrando = false;
      canvas.releasePointerCapture?.(e.pointerId);

      setTimeout(ocultarCursor, 250);
    };

    canvas.onpointerup = terminarArrastre;
    canvas.onpointercancel = () => {
      DEV_CUENTAGOTAS_F2.arrastrando = false;
      ocultarCursor();
    };

    canvas.onpointerleave = () => {
      if (!DEV_CUENTAGOTAS_F2.arrastrando) {
        ocultarCursor();
      }
    };

  } catch(e) {
    console.error(e);
    alert("No pude abrir el cuentagotas.\n\nDetalle: " + (e?.message || e));
  }
};

window.devAplicarCuentagotasF2 = function(tipo){
  const hex = DEV_CUENTAGOTAS_F2.color || "#000000";

  if (
    DEV_CUENTAGOTAS_F2.destino === "wrapperF1" ||
    tipo === "wrapperF1"
  ) {
    DEV.f1.opColor = hex;

    const inp = $("dev1OpColor");

    if (inp) {
      inp.value = hex;
      inp.dispatchEvent(new Event("input", { bubbles:true }));
      inp.dispatchEvent(new Event("change", { bubbles:true }));
    }

    devSetHostColorVisual("dev1OpColorHost", hex);
    devRenderFase(1);
    cerrarModal("modalDevCuentagotasF2");
    return;
  }

  if (tipo === "fondoActual") {
    const indice = Number(DEV_CUENTAGOTAS_F2.destinoFondo || 1);
    dev2SetColorFondo(indice, hex);
    cerrarModal("modalDevCuentagotasF2");
    return;
  }

  // Compatibilidad por si quedó algún botón viejo en caché
  if (tipo === "texto") {
    DEV.f2.color = hex;
    DEV.f2.userChanged = true;

    const inp = $("dev2Color");
    if (inp) {
      inp.value = hex;
      inp.dispatchEvent(new Event("input", { bubbles:true }));
    } else {
      devRenderFase(2);
    }
  }

  if (tipo === "fondo") {
    dev2SetColorFondo(1, hex);
  }

  cerrarModal("modalDevCuentagotasF2");
};

const DEV_WRAPPER_CACHE = new Map();

function devRoundRectPath(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapperVisualDataUrl(op, color){
  const raw = Math.max(0, Math.min(1, Number(op) || 0));
  const col = color || "#000000";

  const key = `${raw.toFixed(3)}_${col}`;
  if (DEV_WRAPPER_CACHE.has(key)) return DEV_WRAPPER_CACHE.get(key);

  const { r, g, b } = hexToRgb(col);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const size = 1000;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;

  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const radius = 150;
  devRoundRectPath(ctx, 0, 0, size, size, radius);
  ctx.clip();

  // ✅ Fondo base: centro más fuerte, bordes/esquinas más transparentes.
  const center = lum > 0.78 ? Math.max(raw, 0.32) : raw;
  const mid    = Math.max(0.03, center * 0.48);
  const edge   = Math.max(0.00, center * 0.035);

  const base = ctx.createRadialGradient(
    size * 0.50, size * 0.50, size * 0.05,
    size * 0.50, size * 0.50, size * 0.78
  );

  base.addColorStop(0.00, `rgba(${r}, ${g}, ${b}, ${center})`);
  base.addColorStop(0.54, `rgba(${r}, ${g}, ${b}, ${center})`);
  base.addColorStop(0.78, `rgba(${r}, ${g}, ${b}, ${mid})`);
  base.addColorStop(1.00, `rgba(${r}, ${g}, ${b}, ${edge})`);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // ✅ Efecto tipo 3D en esquinas.
  // Si el fondo es oscuro: brillo blanco.
  // Si el fondo es claro/blanco: sombra gris.
  const corner = lum > 0.78 ? [0, 0, 0] : [255, 255, 255];
  const a1 = lum > 0.78
    ? Math.min(0.30, Math.max(0.10, raw * 0.34))
    : Math.min(0.34, Math.max(0.12, raw * 0.48));

  const a2 = lum > 0.78
    ? Math.min(0.12, Math.max(0.04, raw * 0.15))
    : Math.min(0.16, Math.max(0.05, raw * 0.22));

  const drawCorner = (x, y) => {
    const gCorner = ctx.createRadialGradient(x, y, 0, x, y, size * 0.34);
    gCorner.addColorStop(0.00, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, ${a1})`);
    gCorner.addColorStop(0.36, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, ${a2})`);
    gCorner.addColorStop(1.00, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, 0)`);

    ctx.fillStyle = gCorner;
    ctx.fillRect(0, 0, size, size);
  };

  drawCorner(0, 0);
  drawCorner(size, 0);
  drawCorner(0, size);
  drawCorner(size, size);

  // ✅ Sombra interior suave para profundidad, sin borde duro.
  const inner = ctx.createRadialGradient(
    size * 0.50, size * 0.50, size * 0.52,
    size * 0.50, size * 0.50, size * 0.86
  );

  inner.addColorStop(0.00, "rgba(0,0,0,0)");
  inner.addColorStop(1.00, lum > 0.78 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.10)");

  ctx.fillStyle = inner;
  ctx.fillRect(0, 0, size, size);

  const url = c.toDataURL("image/png");
  DEV_WRAPPER_CACHE.set(key, url);
  return url;
}

function applyFase1WrapperLook(el, st, scale = 1){
  if (!el || !st) return;

  const s = Math.max(0.12, Number(scale) || 1);
  const url = wrapperVisualDataUrl(st.op, st.opColor);

  el.style.backgroundImage = `url("${url}")`;
  el.style.backgroundSize = "100% 100%";
  el.style.backgroundPosition = "center";
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundColor = "transparent";

  // ✅ No usar box-shadow acá: html2canvas lo interpreta distinto.
  el.style.boxShadow = "none";

  el.style.borderRadius = `${Math.round(118 * s)}px`;
  el.style.overflow = "hidden";
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
      return Math.max(10, Math.min(90, roundToHalf(px - 4)));
    }
  }

  return Math.max(10, Math.min(90, MIN_PX));
}

function sugerirTamanoFase2Auto(texto){
  const W = 1080;
  const H = 840;

  const tieneAdorno = !!DEV?.f2?.adornoUrl;

  const maxW = W - 120;
  const altoDisponible = H - (tieneAdorno ? 180 : 120);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxPx = 32;
  const minPx = 12;
  const limpio = oneLine(texto || "");

  for (let px = maxPx; px >= minPx; px -= 0.5) {
    ctx.font = `600 ${px}px ${DEV.f2.fuente}, Arial`;
    const lines = wrapMeasureLines(ctx, limpio, maxW);
    const lineH = px * 1.24;
    const totalH = lines.length * lineH;

    const safety = px * (tieneAdorno ? 2.2 : 1.6);

    if ((totalH + safety) <= altoDisponible) {
      const bonus = tieneAdorno ? 3 : 8;
      return Math.max(12, Math.min(90, roundToHalf(px + bonus)));
    }
  }

  return tieneAdorno ? 15 : 20;
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
  width:98%;
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
        width:98%;
        padding: 0 ${Math.round(18 * scale)}px;
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

function devEvitarUltimaPalabraSola(s){
  let txt = oneLine(s || "")
    .replace(/\s+([,.;:!?])/g, "$1");

  const words = txt.split(/\s+/).filter(Boolean);

  // Si hay varias palabras, unimos las últimas 2 con espacio duro.
  // Esto evita finales feos tipo:
  // "Hola buenas tardes como"
  // "estas?"
  if (words.length >= 4) {
    const ult = words.pop();
    const ant = words.pop();
    return [...words, `${ant}\u00A0${ult}`].join(" ");
  }

  return txt;
}

function buildFase2HTML(basePx, scale = 1){
  const p2 = DEV.p2;
  if (!p2) return "";

  scale = Number(scale) || 1;

  const ref = devEvitarUltimaPalabraSola(p2.reflexion || "");
  const ora = devEvitarUltimaPalabraSola(p2.oracion || "");

  const fw  = DEV.f2.style.bold ? 700 : 400;

const adorno  = DEV.f2.adornoUrl;
const adornoW = Math.max(30, Math.min(95, Number(DEV.f2.adornoWidth || 70)));
const adornoOp = Math.max(0, Math.min(1, Number(DEV.f2.adornoOpacidad ?? 1)));

  // ✅ Estos valores ahora escalan igual en preview y en final
  const padTop = Math.max(1, Math.round(4 * scale));
  const padX   = Math.max(1, Math.round(18 * scale));
  const gapOra = Math.max(2, Math.round(6 * scale));
  const adornoMaxH = Math.max(24, Math.round(86 * scale));

  return `
    <div style="
      width:100%;
      height:100%;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    ">

      <div style="
        flex:1 1 auto;
        min-height:0;
        display:flex;
        align-items:center;
        justify-content:center;
        padding:${padTop}px ${padX}px 0;
        box-sizing:border-box;
        text-align:center;
        overflow:hidden;
      ">
        <div style="
          width:100%;
          max-width:100%;
          font-size:${basePx}px;
          font-weight:${fw};
          line-height:1.18;
          word-break:normal;
          overflow-wrap:normal;
          hyphens:none;
          text-wrap:pretty;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
        ">
          <div style="width:100%;">Reflexión: ${esc(ref)}</div>
          ${ora ? `<div style="width:100%; margin-top:${gapOra}px;">Oración: ${esc(ora)}</div>` : ``}
        </div>
      </div>

      ${adorno ? `
        <div style="
          flex:0 0 auto;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding:0 0 ${padTop}px;
          box-sizing:border-box;
          pointer-events:none;
        ">
          <img
            src="${adorno}"
            alt="adorno"
            style="
              width:${adornoW}%;
              max-height:${adornoMaxH}px;
              height:auto;
              object-fit:contain;
           display:block;
opacity:${adornoOp};
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

function ensureDev2TextureLayer(container){
  if (!container) return null;

  let layer = container.querySelector(".dev2-texture-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "dev2-texture-layer";
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "0";
    layer.style.backgroundRepeat = "no-repeat";
    layer.style.backgroundPosition = "center";
    layer.style.backgroundSize = "cover";
    layer.style.mixBlendMode = "normal";

    container.insertBefore(layer, container.firstChild);
  }

  return layer;
}

function devSvgRomboDifuminadoDataUrl(c1, c2, c3, usar3 = false){
  c1 = devHexSeguro(c1) || "#ffffff";
  c2 = devHexSeguro(c2) || "#d1eeff";
  c3 = usar3 ? (devHexSeguro(c3) || "#a6d0ff") : c2;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 840" preserveAspectRatio="none">
    <defs>
      <filter id="blurGrande" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="58"/>
      </filter>

      <filter id="blurMedio" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="34"/>
      </filter>

      <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="52%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c3}" stop-opacity="0.28"/>
      </linearGradient>

      <linearGradient id="romboGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.10"/>
        <stop offset="42%" stop-color="${c2}" stop-opacity="0.72"/>
        <stop offset="64%" stop-color="${c3}" stop-opacity="${usar3 ? "0.62" : "0.32"}"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0.08"/>
      </linearGradient>
    </defs>

    <rect width="1080" height="840" fill="url(#base)"/>

    <!-- halo grande con forma de rombo -->
    <polygon
      points="540,-80 1180,420 540,920 -100,420"
      fill="${c2}"
      opacity="0.16"
      filter="url(#blurGrande)"
    />

    <!-- rombo principal -->
    <polygon
      points="540,45 1015,420 540,795 65,420"
      fill="url(#romboGrad)"
      opacity="0.82"
      filter="url(#blurMedio)"
    />

    <!-- rombo interno más suave -->
    <polygon
      points="540,155 875,420 540,685 205,420"
      fill="${c3}"
      opacity="${usar3 ? "0.30" : "0.14"}"
      filter="url(#blurMedio)"
    />

    <!-- luz central -->
    <ellipse
      cx="540"
      cy="420"
      rx="215"
      ry="145"
      fill="${c1}"
      opacity="0.18"
      filter="url(#blurGrande)"
    />
  </svg>`;

  return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
}

// ================= FASE 2: FONDO DISEÑADO COMPACTO =================
// Fase 2 ya era el bloque diseñado del devocional: no agregamos toggle.
// Conservamos fondo plano/textura/adorno y sumamos degradado sin mezclar Fase 1.
function dev2GradienteCSS(st = DEV.f2){
  const c1 = devHexSeguro(st.fondoColor) || "#ffffff";
  const c2 = devHexSeguro(st.gradienteColor2) || "#d1eeff";
  const c3 = st.usarColor3
    ? (devHexSeguro(st.gradienteColor3) || "#a6d0ff")
    : c2;

  const colores = st.usarColor3
    ? `${c1}, ${c2}, ${c3}`
    : `${c1}, ${c2}`;

  switch (st.gradienteForma) {
    case "horizontal":
      return `linear-gradient(90deg, ${colores})`;

    case "diagonal":
      return `linear-gradient(135deg, ${colores})`;

    case "radial":
      return `radial-gradient(circle at center, ${colores})`;

    // ✅ rombo real tipo 🔷, difuminado y sin forma de X
    case "rombo":
      return devSvgRomboDifuminadoDataUrl(c1, c2, c3, !!st.usarColor3);

    // ✅ nuevo: difuminado tipo manchas suaves
    // ✅ manchas más difuminadas, amplias y parejas
    case "manchas":
      return [
        `radial-gradient(ellipse 82% 62% at 22% 24%, ${devRgba(c2, .32)} 0%, ${devRgba(c2, .22)} 30%, ${devRgba(c2, .10)} 54%, transparent 78%)`,
        `radial-gradient(ellipse 82% 62% at 78% 24%, ${devRgba(c3, .30)} 0%, ${devRgba(c3, .20)} 31%, ${devRgba(c3, .09)} 55%, transparent 79%)`,
        `radial-gradient(ellipse 86% 64% at 24% 76%, ${devRgba(c3, .28)} 0%, ${devRgba(c3, .18)} 32%, ${devRgba(c3, .08)} 56%, transparent 80%)`,
        `radial-gradient(ellipse 86% 64% at 76% 76%, ${devRgba(c2, .28)} 0%, ${devRgba(c2, .18)} 32%, ${devRgba(c2, .08)} 56%, transparent 80%)`,
        `radial-gradient(ellipse 90% 70% at 50% 50%, ${devRgba(c2, .14)} 0%, ${devRgba(c3, .10)} 38%, transparent 74%)`,
        `linear-gradient(180deg, ${c1} 0%, ${devRgba(c1, .96)} 48%, ${c1} 100%)`
      ].join(",");

    case "vertical":
    default:
      return `linear-gradient(180deg, ${colores})`;
  }
}

function dev2AplicarFondoBase(el, st = DEV.f2){
  if (!el) return;

  const tieneMezcla = !!st.usarColor2;

  el.style.backgroundColor = st.fondoColor || "#ffffff";

  el.style.backgroundImage = tieneMezcla
    ? dev2GradienteCSS(st)
    : "none";

  if (tieneMezcla && st.gradienteForma === "manchas") {
    // ✅ manchas más grandes, suaves y parejas
    el.style.backgroundSize = "125% 125%, 125% 125%, 130% 130%, 130% 130%, 135% 135%, cover";
    el.style.backgroundPosition = "center";
  } else if (tieneMezcla && st.gradienteForma === "rombo") {
    // ✅ el SVG ya trae el rombo entero
    el.style.backgroundSize = "100% 100%";
    el.style.backgroundPosition = "center";
  } else {
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
  }

  el.style.backgroundRepeat = "no-repeat";
}

function dev2SyncPickrHost(hostId, hex){
  const host = $(hostId);
  const color = devHexSeguro(hex) || "#ffffff";

  if (!host) return;

  // ✅ Solo pintamos visualmente el botón.
  // NO usamos host._pickr.setColor() porque dispara eventos internos
  // y puede generar loop infinito con devRenderFase/dev2ActualizarPanelUI.
  host.style.setProperty("--pickr-color", color);
  host.style.background = color;
  host.style.backgroundColor = color;
}

function dev2InputColorFondo(indice){
  if (indice === 2) return $("dev2GradColor2");
  if (indice === 3) return $("dev2GradColor3");
  return $("dev2Fondo");
}

function dev2HostColorFondo(indice){
  if (indice === 2) return $("dev2GradColor2Host");
  if (indice === 3) return $("dev2GradColor3Host");
  return $("dev2FondoHost");
}

function dev2SetColorFondo(indice, hex){
  const color = devHexSeguro(hex) || "#ffffff";

  if (indice === 2) {
    DEV.f2.usarColor2 = true;
    DEV.f2.gradienteColor2 = color;
  } else if (indice === 3) {
    DEV.f2.usarColor2 = true;
    DEV.f2.usarColor3 = true;
    DEV.f2.gradienteColor3 = color;
  } else {
    DEV.f2.fondoColor = color;
  }

  DEV.f2.userChanged = true;

  const inp = dev2InputColorFondo(indice);
  if (inp) inp.value = color;

  const host =
    indice === 2 ? "dev2GradColor2Host" :
    indice === 3 ? "dev2GradColor3Host" :
    "dev2FondoHost";

  dev2SyncPickrHost(host, color);

  dev2ActualizarPanelUI();
  devRenderFase(2);
}

function dev2AsegurarBotonColor2(){
  if ($("dev2BtnColor2")) return;

  const host1 = $("dev2FondoHost");
  if (!host1) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "dev2BtnColor2";
  btn.className = "dev2-mas-color";
  btn.title = "Agregar segundo color";
  btn.innerHTML = `<i class="fa-solid fa-plus"></i>`;

  btn.onclick = () => {
    DEV.f2.usarColor2 = true;
    DEV.f2.userChanged = true;
    dev2ActualizarPanelUI();
    devRenderFase(2);
  };

  host1.insertAdjacentElement("afterend", btn);
}

function dev2AsegurarOpcionRombo(){
  const sel = $("dev2GradForma");
  if (!sel) return;

  const extras = [
    { value: "rombo", text: "Rombo suave" },
    { value: "manchas", text: "Manchas" }
  ];

  extras.forEach(item => {
    const existe = Array.from(sel.options || []).some(o => o.value === item.value);
    if (existe) {
      const opt = Array.from(sel.options || []).find(o => o.value === item.value);
      if (opt) opt.textContent = item.text;
      return;
    }

    const opt = document.createElement("option");
    opt.value = item.value;
    opt.textContent = item.text;
    sel.appendChild(opt);
  });
}

function dev2AsegurarModalColorFondo(){
  if ($("modalDevColorFondoOpciones")) return;

  const div = document.createElement("div");
  div.id = "modalDevColorFondoOpciones";
  div.className = "modal-overlay";
  div.setAttribute("aria-hidden", "true");

  div.innerHTML = `
    <div class="modal-contenido modal-dev-color-opciones" onclick="event.stopPropagation()">
      <button
        type="button"
        class="cerrar-modal"
        onclick="cerrarModal('modalDevColorFondoOpciones')"
      >✕</button>

      <h3>Color de fondo</h3>

      <p>Elegí cómo querés tomar este color.</p>

      <div class="dev-color-opciones-actions">
        <button type="button" id="devColorOpcionImagen">
          <i class="fa-solid fa-eye-dropper"></i>
          Tomar color de imagen
        </button>

        <button type="button" id="devColorOpcionPaleta">
          <i class="fa-solid fa-palette"></i>
          Abrir paleta
        </button>
      </div>
    </div>
  `;

  div.addEventListener("click", e => {
    if (e.target === div) cerrarModal("modalDevColorFondoOpciones");
  });

  document.body.appendChild(div);
}

window.dev2AbrirOpcionesColorFondo = function(indice = 1){
  indice = Number(indice || 1);

  dev2AsegurarModalColorFondo();

  const modal = $("modalDevColorFondoOpciones");
  const btnImg = $("devColorOpcionImagen");
  const btnPal = $("devColorOpcionPaleta");

  if (!modal || !btnImg || !btnPal) return;

  btnImg.onclick = () => {
    cerrarModal("modalDevColorFondoOpciones");

    DEV_CUENTAGOTAS_F2.destinoFondo = indice;
    window.devAbrirCuentagotasF2(indice);
  };

  btnPal.onclick = () => {
    cerrarModal("modalDevColorFondoOpciones");

    const host = dev2HostColorFondo(indice);

    try {
      if (host?._pickr && typeof host._pickr.show === "function") {
        host._pickr.show();
      } else {
        dev2InputColorFondo(indice)?.click();
      }
    } catch(e) {
      dev2InputColorFondo(indice)?.click();
    }
  };

  abrirModal("modalDevColorFondoOpciones");
};

function dev2InterceptarHostsColorFondo(){
  [
    ["dev2FondoHost", 1],
    ["dev2GradColor2Host", 2],
    ["dev2GradColor3Host", 3]
  ].forEach(([id, indice]) => {
    const host = $(id);
    if (!host || host.dataset.devColorChoiceReady === "1") return;

    host.dataset.devColorChoiceReady = "1";

    host.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      window.dev2AbrirOpcionesColorFondo(indice);
    }, true);
  });
}

function devOcultarSubrayadoDev(){
  [1, 2].forEach(fase => {
    const btn = $(`dev${fase}Under`);
    if (btn) {
      btn.style.display = "none";
      btn.setAttribute("aria-hidden", "true");
    }

    const st = fase === 1 ? DEV.f1 : DEV.f2;
    if (st?.style) st.style.underline = false;
  });
}

function devCompactarFilaTextoFase1(){
  const modal = $("modalDevFase1");
  if (!modal) return;

  const btnFuentes = $("dev1BtnFuentes");
  const btnAa = $("dev1Upper");
  const btnB = $("dev1Bold");
  const btnI = $("dev1Italic");
  const colorHost = $("dev1ColorHost");
  const outlineHost = $("dev1OutlineColorHost");

  if (!btnFuentes || !btnAa || !btnB || !btnI || !colorHost || !outlineHost) return;

  let fila = $("dev1FilaTextoCompacta");

  if (!fila) {
    fila = document.createElement("div");
    fila.id = "dev1FilaTextoCompacta";
    fila.className = "dev-fila-texto-compacta";

    const ref =
      btnFuentes.closest(".dev-row") ||
      btnFuentes.parentElement;

    ref?.insertAdjacentElement("beforebegin", fila);
  }

  fila.appendChild(btnFuentes);
  fila.appendChild(btnAa);
  fila.appendChild(btnB);
  fila.appendChild(btnI);
  fila.appendChild(colorHost);
  fila.appendChild(outlineHost);

  devOcultarSubrayadoDev();
}

function dev2CompactarFilaTexto(){
  const modal = $("modalDevFase2");
  if (!modal) return;

  const btnFuentes = $("dev2BtnFuentes");
  const inputTam = $("dev2Tamano");

  if (!btnFuentes || !inputTam) return;

  const botones = Array.from(modal.querySelectorAll("button"));

  const btnMenos = botones.find(b =>
    /devCambiarTamano\s*\(\s*2\s*,\s*-1\s*\)/.test(b.getAttribute("onclick") || "")
  );

  const btnMas = botones.find(b =>
    /devCambiarTamano\s*\(\s*2\s*,\s*1\s*\)/.test(b.getAttribute("onclick") || "")
  );

  if (!btnMenos || !btnMas) return;

  let fila = $("dev2FilaFuenteTamano");

  if (!fila) {
    fila = document.createElement("div");
    fila.id = "dev2FilaFuenteTamano";
    fila.className = "dev2-fila-fuente-tamano";

    const ref = btnFuentes.closest(".dev-row") || btnFuentes.parentElement;
    ref?.insertAdjacentElement("beforebegin", fila);
  }

  fila.appendChild(btnFuentes);
  fila.appendChild(btnMenos);
  fila.appendChild(inputTam);
  fila.appendChild(btnMas);
   devOcultarSubrayadoDev();
}

function dev2AsegurarSlidersAdorno(){
  const tam = $("dev2AdornoTamano");
  if (!tam) return;

  tam.classList.add("dev2-slider-mini");

  const filaVieja =
    tam.closest(".dev2-slider-row") ||
    tam.closest(".dev-row") ||
    tam.closest("label") ||
    tam.parentElement;

  let box = $("dev2AdornoSliders");

  if (!box) {
    box = document.createElement("div");
    box.id = "dev2AdornoSliders";
    box.className = "dev2-adorno-sliders";

    if (filaVieja) {
      filaVieja.insertAdjacentElement("beforebegin", box);
    } else {
      $("dev2PaneAdorno")?.appendChild(box);
    }
  }

  let packTam = $("dev2AdornoPackTamano");
  if (!packTam) {
    packTam = document.createElement("label");
    packTam.id = "dev2AdornoPackTamano";
    packTam.className = "dev2-slider-pack";
    packTam.title = "Tamaño del adorno";
    packTam.innerHTML = `<i class="fa-solid fa-up-right-and-down-left-from-center"></i>`;
  }

  let op = $("dev2AdornoOpacidad");
  if (!op) {
    op = document.createElement("input");
    op.id = "dev2AdornoOpacidad";
    op.type = "range";
    op.min = "0";
    op.max = "1";
    op.step = "0.01";
    op.value = String(DEV.f2.adornoOpacidad ?? 1);
  }

  op.classList.add("dev2-slider-mini");

  let packOp = $("dev2AdornoPackOpacidad");
  if (!packOp) {
    packOp = document.createElement("label");
    packOp.id = "dev2AdornoPackOpacidad";
    packOp.className = "dev2-slider-pack";
    packOp.title = "Opacidad del adorno";
    packOp.innerHTML = `<i class="fa-solid fa-circle-half-stroke"></i>`;
  }

  if (!packTam.contains(tam)) packTam.appendChild(tam);
  if (!packOp.contains(op)) packOp.appendChild(op);

  if (!box.contains(packTam)) box.appendChild(packTam);
  if (!box.contains(packOp)) box.appendChild(packOp);

  // ✅ Borra la fila vieja que quedó vacía con el ícono solo
  document.querySelectorAll("#dev2PaneAdorno .dev2-slider-row").forEach(row => {
    const tieneInput = row.querySelector("input");
    const esFilaViejaAdorno = row.querySelector(".fa-up-right-and-down-left-from-center");

    if (!tieneInput && esFilaViejaAdorno) {
      row.remove();
    }
  });

  const leer = () => {
    DEV.f2.userChanged = true;
    DEV.f2.adornoWidth = Number($("dev2AdornoTamano")?.value || 70);
    DEV.f2.adornoOpacidad = Math.max(0, Math.min(1, Number($("dev2AdornoOpacidad")?.value ?? 1)));
    requestAnimationFrame(()=> devRenderFase(2));
  };

  if (!tam.dataset.devAdornoReady) {
    tam.dataset.devAdornoReady = "1";
    tam.addEventListener("input", leer);
  }

  if (!op.dataset.devAdornoReady) {
    op.dataset.devAdornoReady = "1";
    op.addEventListener("input", leer);
  }
}

function dev2ActualizarPanelUI(){
  const st = DEV.f2;
  const tab = ["fondo", "textura", "adorno"].includes(st.tabActiva)
    ? st.tabActiva
    : "fondo";

dev2AsegurarBotonColor2();
dev2AsegurarOpcionRombo();
dev2InterceptarHostsColorFondo();
dev2CompactarFilaTexto();
dev2AsegurarSlidersAdorno();

  ["fondo", "textura", "adorno"].forEach(nombre => {
    const btn = $(`dev2Tab${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`);
    const pane = $(`dev2Pane${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`);

    if (btn) btn.classList.toggle("activo", tab === nombre);
    if (pane) pane.classList.toggle("activo", tab === nombre);
  });

  // ✅ Ya no hay dos modos visibles. Internamente:
  // 1 color = fondo plano, 2/3 colores = mezcla/degradado.
  st.baseTipo = st.usarColor2 ? "gradiente" : "plano";

  const btnPlano = $("dev2BtnPlano");
  if (btnPlano) {
    btnPlano.style.display = "none";
    btnPlano.setAttribute("aria-hidden", "true");
  }

  const btnGrad = $("dev2BtnGradiente");
  if (btnGrad) {
    btnGrad.style.display = "inline-flex";
    btnGrad.classList.add("activo");
    btnGrad.innerHTML = `<i class="fa-solid fa-palette"></i>`;
    btnGrad.title = "Color principal del fondo";
    btnGrad.setAttribute("aria-label", "Color principal del fondo");

    // ✅ el botón paleta abre las opciones del color 1
    btnGrad.onclick = () => window.dev2AbrirOpcionesColorFondo(1);
  }

  const extra = $("dev2GradExtra");
  if (extra) {
    extra.style.display = "inline-flex";
  }

  const host2 = $("dev2GradColor2Host");
  if (host2) {
    host2.style.display = st.usarColor2 ? "inline-flex" : "none";
  }

  const inp2 = $("dev2GradColor2");
  if (inp2) {
    inp2.style.display = "none";
  }

  const btnColor2 = $("dev2BtnColor2");
  if (btnColor2) {
    btnColor2.style.display = st.usarColor2 ? "none" : "inline-flex";
    btnColor2.title = "Agregar segundo color";
  }

  const color3Wrap = $("dev2Color3Wrap");
  if (color3Wrap) {
    color3Wrap.style.display = st.usarColor2 && st.usarColor3
      ? "inline-flex"
      : "none";
  }

  const btnMas = $("dev2BtnColor3");
  if (btnMas) {
    btnMas.style.display = st.usarColor2 ? "inline-flex" : "none";

    btnMas.classList.toggle("activo", !!st.usarColor3);
    btnMas.title = st.usarColor3 ? "Quitar tercer color" : "Agregar tercer color";
  }

  const forma = $("dev2GradForma");
  if (forma) {
    forma.style.display = st.usarColor2 ? "inline-flex" : "none";

    if (!forma.value) forma.value = st.gradienteForma || "vertical";
  }

  dev2SyncPickrHost("dev2FondoHost", st.fondoColor || "#ffffff");
  dev2SyncPickrHost("dev2GradColor2Host", st.gradienteColor2 || "#d1eeff");
  dev2SyncPickrHost("dev2GradColor3Host", st.gradienteColor3 || "#a6d0ff");
}

window.dev2MostrarTab = function(tab){
  DEV.f2.tabActiva = ["fondo", "textura", "adorno"].includes(tab) ? tab : "fondo";
  dev2ActualizarPanelUI();
};

window.dev2ElegirBase = function(tipo){
  DEV.f2.baseTipo = tipo === "gradiente" ? "gradiente" : "plano";
  DEV.f2.userChanged = true;
  dev2ActualizarPanelUI();
  devRenderFase(2);
};

window.dev2ToggleColor3 = function(){
  if (!DEV.f2.usarColor2) {
    DEV.f2.usarColor2 = true;
  } else {
    DEV.f2.usarColor3 = !DEV.f2.usarColor3;
  }

  DEV.f2.userChanged = true;
  dev2ActualizarPanelUI();
  devRenderFase(2);
};

function devRenderFase(fase){
  if (fase === 1) {
    devEnsureBotonCuentagotasWrapperF1();

    const p = $("dev1Preview");
    const w = $("dev1TextoWrapper");
    const t = $("dev1Texto");
    const b = $("dev1TextoBack");
    if (!p || !w || !t || !b) return;

    const st = DEV.f1;

    const sc = scalePreviewF1();
    t.innerHTML = buildFase1HTML(st.size, sc);

    if (b) b.style.display = "none";

    const fondoUsable = st.fondoBlob || st.fondoUrl;
    p.style.backgroundImage = fondoUsable ? `url("${fondoUsable}")` : "none";
    p.style.backgroundSize = "cover";
    p.style.backgroundPosition = "center";
    p.style.backgroundColor = fondoUsable ? "transparent" : "#ffffff";

t.style.fontFamily = st.fuente;
t.style.color = st.color;

const outline1 = devGetOutlineColor(1, st.color);

const outlineScale1 = Math.max(0.55, sc * 1.25);

t.style.textShadow = textShadowLegibleFinal(st.color, outlineScale1, outline1);
t.style.webkitTextStroke = `${Math.max(0.35, 0.78 * sc).toFixed(2)}px ${outline1}`;
t.style.paintOrder = "stroke fill";
applyFase1WrapperLook(w, st, sc);

applyTextStylesToOne(t, st);
devSyncStyleButtons(1);
devCompactarFilaTextoFase1();
return;
  }

if (fase === 2) {
  devEnsureBotonCuentagotasF2();

  const p = $("dev2Preview");
  const w = $("dev2TextoWrapper");
  const t = $("dev2Texto");
  const b = $("dev2TextoBack");
  if (!p || !w || !t || !b) return;

  const st = DEV.f2;

  const sc2 = scalePreviewF2();
  const pxPreview = Math.max(8, (st.size * sc2));

  // ✅ El inset también escala, para que la preview sea proporcional al final
  w.style.inset = `${Math.max(4, Math.round(16 * sc2))}px`;

  t.innerHTML = buildFase2HTML(pxPreview, sc2);

  if (b) b.style.display = "none";

  // =========================
  // base del preview
  // =========================
  p.style.position = "relative";
dev2AplicarFondoBase(p, st);
p.style.backgroundBlendMode = "normal";
// ✅ No llamar dev2ActualizarPanelUI() desde el render.
// El panel se actualiza cuando cambia una opción o al entrar a fase 2.

  // =========================
  // textura en capa separada
  // =========================
  const layer = ensureDev2TextureLayer(p);

  if (layer) {
    const op = Math.max(0, Math.min(1, Number(st.texturaOp ?? 0.22)));

const texturasActivas = devF2TexturasSeleccionadas();

if (texturasActivas.length) {
  layer.style.display = "block";
  layer.style.backgroundImage = texturasActivas
    .map(url => `url("${url}")`)
    .join(", ");
  layer.style.backgroundSize = texturasActivas
    .map(() => "cover")
    .join(", ");
  layer.style.backgroundPosition = texturasActivas
    .map(() => "center")
    .join(", ");
  layer.style.backgroundRepeat = texturasActivas
    .map(() => "no-repeat")
    .join(", ");
  layer.style.opacity = String(op);
  layer.style.mixBlendMode = "normal";
  layer.style.filter = "none";
} else {
  layer.style.display = "none";
  layer.style.backgroundImage = "none";
  layer.style.backgroundSize = "";
  layer.style.backgroundPosition = "";
  layer.style.backgroundRepeat = "";
  layer.style.opacity = "0";
  layer.style.mixBlendMode = "normal";
  layer.style.filter = "none";
}
  }

  // =========================
  // texto arriba de todo
  // =========================
  w.style.position = "absolute";
  w.style.zIndex = "1";
  w.style.backgroundColor = "transparent";

t.style.fontFamily = st.fuente;
t.style.color = st.color;

const outline2 = devGetOutlineColor(2, st.color);

const outlineScale2 = Math.max(0.55, sc2 * 1.25);

t.style.textShadow = textShadowLegibleFinal(st.color, outlineScale2, outline2);
t.style.webkitTextStroke = `${Math.max(0.38, 0.72 * sc2).toFixed(2)}px ${outline2}`;
t.style.paintOrder = "stroke fill";

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
  ["devBtnDescargar","devBtnCompartir","devBtnPanelToggle","devBtnIglesia"].forEach(id=>{
    const b = $(id);
    if (b) b.disabled = disabled;
  });

  const fin = $("devBtnFinalizar");
  if (fin) fin.disabled = (!!DEV.requiereAudio && disabled);
}

function devSetFinalButtons(enabled){
  setFinalCanvasDisabled(!enabled);
}

function devRgba(hex, alpha = 1){
  const { r, g, b } = hexToRgb(hex || "#ffffff");
  const a = Math.max(0, Math.min(1, Number(alpha)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function devDibujarUnionSuaveFinal(ctx, W, y){
  const c1 = devHexSeguro(DEV.f2?.fondoColor) || "#ffffff";
  const c2 = devHexSeguro(DEV.f2?.gradienteColor2) || c1;

  // banda suave que tapa el corte seco
  const alto = 72;

  const g = ctx.createLinearGradient(0, y - alto, 0, y + 28);
  g.addColorStop(0.00, devRgba(c1, 0));
  g.addColorStop(0.45, devRgba(c1, 0.45));
  g.addColorStop(0.68, devRgba(c1, 0.88));
  g.addColorStop(1.00, devRgba(c1, 0));

  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, y - alto, W, alto + 34);

  // detalle finito para que parezca separación intencional, no corte
  const linea = ctx.createLinearGradient(0, y - 4, 0, y + 18);
  linea.addColorStop(0.00, "rgba(0,0,0,0)");
  linea.addColorStop(0.45, "rgba(0,0,0,0.08)");
  linea.addColorStop(1.00, devRgba(c2, 0.10));

  ctx.fillStyle = linea;
  ctx.fillRect(0, y - 6, W, 26);
  ctx.restore();
}

async function renderFinalCanvasCaptureReal(){
  const cFinal = $("devCanvasFinal");
  if (!cFinal) return null;

  const W = 1080, H = 1920;
  cFinal.width = W;
  cFinal.height = H;
  const ctx = cFinal.getContext("2d");
  ctx.clearRect(0,0,W,H);

  // =====================================================
  // MODO FINALIZADO: usar la imagen subida tal cual
  // =====================================================
  if (DEV.finalizadaMode && DEV.finalOriginalBlob) {
    const url = DEV.finalOriginalUrl || URL.createObjectURL(DEV.finalOriginalBlob);

    const img = await new Promise((resolve, reject)=>{
      const im = new Image();
      im.onload = ()=> resolve(im);
      im.onerror = ()=> reject(new Error("No pude leer la imagen finalizada"));
      im.src = url;
    });

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const scale = Math.min(W / img.width, H / img.height);
    const drawW = Math.round(img.width * scale);
    const drawH = Math.round(img.height * scale);
    const dx = Math.round((W - drawW) / 2);
    const dy = Math.round((H - drawH) / 2);

    ctx.drawImage(img, dx, dy, drawW, drawH);

    const rounded = makeRoundedCanvas(cFinal, 52);
    DEV.finalDataUrl = rounded.toDataURL("image/png");

    const outImg = $("devFinalImg");
    if (outImg) outImg.src = DEV.finalDataUrl;

    return rounded;
  }

  // =====================================================
  // MODO NORMAL: composición fases 1 + 2
  // =====================================================
  if (typeof html2canvas !== "function") {
    alert("❌ Falta html2canvas. Agregalo en el HTML como en Biblia.");
    return null;
  }

  const H1 = 1080, H2 = 840;

  let stage = document.getElementById("devCaptureStage");
  if (!stage) {
    stage = document.createElement("div");
    stage.id = "devCaptureStage";
    stage.style.position = "fixed";
    stage.style.left = "-10000px";
    stage.style.top  = "-10000px";
    stage.style.opacity = "1";
    stage.style.visibility = "visible";
    stage.style.pointerEvents = "none";
    stage.style.transform = "none";
    stage.style.zIndex = "-1";
    document.body.appendChild(stage);
  }
  stage.innerHTML = "";

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
wrap.style.inset = "6%";

applyFase1WrapperLook(wrap, st, 1);

    const texto = document.createElement("div");
    texto.style.position = "absolute";
    texto.style.inset = "0";
    texto.style.fontFamily = st.fuente;
    texto.style.color = st.color;
    applyTextStylesToOne(texto, st);

const outlineFinalF1 = 2.15;
const outlineF1 = devHexSeguro(st.outlineColor) || devGetOutlineColor(1, st.color);

texto.style.textShadow = textShadowLegibleFinal(st.color, outlineFinalF1, outlineF1);
texto.style.webkitTextStroke = `${(0.72 * outlineFinalF1).toFixed(2)}px ${outlineF1}`;
texto.style.paintOrder = "stroke fill";
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
    dev2AplicarFondoBase(node, st);

    const texturasActivas = devF2TexturasSeleccionadas();

    if (texturasActivas.length) {
      const textureLayer = document.createElement("div");
      textureLayer.style.position = "absolute";
      textureLayer.style.inset = "0";
      textureLayer.style.backgroundImage = texturasActivas
        .map(url => `url("${url}")`)
        .join(", ");
      textureLayer.style.backgroundSize = texturasActivas
        .map(() => "cover")
        .join(", ");
      textureLayer.style.backgroundPosition = texturasActivas
        .map(() => "center")
        .join(", ");
      textureLayer.style.backgroundRepeat = texturasActivas
        .map(() => "no-repeat")
        .join(", ");
      textureLayer.style.opacity = String(
        Math.max(0, Math.min(1, Number(st.texturaOp ?? 0.22)))
      );
      textureLayer.style.mixBlendMode = "normal";
      textureLayer.style.filter = "none";
      textureLayer.style.pointerEvents = "none";

      node.appendChild(textureLayer);
    }

    const wrap = document.createElement("div");
    wrap.style.position = "absolute";
    wrap.style.inset = "16px";
    wrap.style.overflow = "hidden";
    wrap.style.textAlign = "center";
    wrap.style.zIndex = "1";

    const texto = document.createElement("div");
    texto.style.width = "100%";
    texto.style.height = "100%";
    texto.style.fontFamily = st.fuente;
    texto.style.color = st.color;
    applyTextStylesToOne(texto, st);

    const outlineF2 = devHexSeguro(st.outlineColor) || devGetOutlineColor(2, st.color);

texto.style.textShadow = textShadowLegibleFinal(st.color, 1.25, outlineF2);
texto.style.webkitTextStroke = "0.75px " + outlineF2;
    texto.style.paintOrder = "stroke fill";
    texto.innerHTML = buildFase2HTML(st.size, 1);
    wrap.appendChild(texto);
    node.appendChild(wrap);

    return node;
  };

  const n1 = makeFase1Node();
  const n2 = makeFase2Node();
  stage.appendChild(n1);
  stage.appendChild(n2);

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (document.fonts?.ready) await document.fonts.ready;

  const cap1 = await html2canvas(n1, { backgroundColor: null, scale: 2, useCORS: true });
  const cap2 = await html2canvas(n2, { backgroundColor: null, scale: 2, useCORS: true });

  ctx.drawImage(cap1, 0, 0, W, H1);
  ctx.drawImage(cap2, 0, H1, W, H2);

  // ✅ unión suave entre imagen superior y bloque inferior
  devDibujarUnionSuaveFinal(ctx, W, H1);

  const rounded = makeRoundedCanvas(cFinal, 52);

  DEV.finalDataUrl = rounded.toDataURL("image/png");
  const img = $("devFinalImg");
  if (img) img.src = DEV.finalDataUrl;

  return rounded;
}

window.devToggleSubirPanel = () => {
  DEV.subirPanel = !DEV.subirPanel;
  const tick = $("devPanelTick");
  if (tick) tick.style.display = DEV.subirPanel ? "inline" : "none";
  console.log("DEV.subirPanel =", DEV.subirPanel);
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
window.devIrFase1Desde0 = async () => {
  const t0 = ($("dev0Texto")?.value || "").trim();
  if (!t0) {
    alert("Pegá o generá el texto primero.");
    return;
  }

  DEV.rawText = t0;

  // 1) los campos manuales mandan
  devReadFieldsFromUI();
  const hayCampos =
    (DEV.fields.fecha || DEV.fields.versiculo || DEV.fields.cita || DEV.fields.reflexion || DEV.fields.oracion);

  if (hayCampos) {
    devApplyFieldsToParts();
  } else {
    const parsed = DEV.finalizadaMode
      ? buildBloquesFromOCRFinalizado(t0)
      : buildBloquesFromOCR(t0);

    DEV.p1 = parsed.p1;
    DEV.p2 = parsed.p2;
    DEV.audioText = parsed.audioText;

    DEV.fields.fecha     = oneLine(parsed.p1?.fecha || "");
    DEV.fields.versiculo = oneLine(parsed.p1?.versiculo || "");
    DEV.fields.cita      = oneLine(parsed.p1?.cita || "");
    DEV.fields.reflexion = oneLine(parsed.p2?.reflexion || "");
    DEV.fields.oracion   = oneLine(parsed.p2?.oracion || "");
  }

  // reset final
  DEV.finalDataUrl = "";
  const imgF = $("devFinalImg");
  if (imgF && DEV.finalOriginalUrl && DEV.finalizadaMode) {
    imgF.src = DEV.finalOriginalUrl;
  } else if (imgF) {
    imgF.src = "";
  }

  // ✅ No resetear audio al volver desde Fase 0.
  // Si el usuario ya dio "Correcto", el audio debe seguir confirmado.
  devSetFinalButtons(DEV.requiereAudio ? !!DEV.audioOk : true);

  cerrarModal("modalDevFase0");

  // ✅ si es finalizado, salta directo a fase 3
   if (DEV.finalizadaMode) {
    abrirModal("modalDevFase3");

    DEV.audioOk = !!DEV.audioManualBlob;
    devEnsureFase3Opciones();
    devUpdateAudioManualUI();
    devSetFinalButtons(DEV.requiereAudio ? !!DEV.audioOk : true);

    devSetLoadingFase3(true, "⏳ Preparando imagen finalizada…");
    try {
      const c = await renderFinalCanvasCaptureReal();
      await devPrepararShareFinalDesdeCanvas(c);
    } finally {
      devSetLoadingFase3(false);
    }
    return;
  }

  // flujo normal
  abrirModal("modalDevFase1");

  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#dev1OpColorHost, #dev1ColorHost");
  }

  devRenderFase(1);

  (async ()=>{
    await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));
    if (document.fonts?.ready) await document.fonts.ready;

    if (!DEV.f1.userChanged) {
      const sugerido = sugerirTamanoVersiculoAuto(DEV?.p1?.versiculo || "");
      DEV.f1.size = sugerido;
    }

    const s1 = $("dev1Tamano");
    if (s1) s1.value = fmtSize(DEV.f1.size);

    devRenderFase(1);
  })();
};

// Fase 1 -> volver a Fase 0
window.devVolverFase0 = () => {
  cerrarModal("modalDevFase1");
  abrirModal("modalDevFase0");
};

function devF2HeredarTextoDesdeF1SiCorresponde(){
  // ✅ Fase 2 sigue el color/borde de Fase 1,
  // incluso si ya cambiaste fondo, textura, tamaño o adorno.
  // Solo deja de seguir si tocás manualmente el color/borde de texto en Fase 2.
  if (DEV.f2.textoSigueF1 === false) return;

  const colorF1 = devHexSeguro(DEV.f1.color) || "#000000";

  const inputF1 = devAsegurarControlContorno(1);
  const contornoF1 = devGetOutlineColor(1, colorF1);

  const contornoManualF1 =
    inputF1?.dataset?.manual === "1"
      ? devHexSeguro(inputF1.value || DEV.f1.outlineColor)
      : "";

  const finalOutline =
    contornoManualF1 ||
    devHexSeguro(DEV.f1.outlineColor) ||
    contornoF1 ||
    outlineColor(colorF1);

  DEV.f2.color = colorF1;
  DEV.f2.outlineColor = finalOutline;
  DEV.f2.textoSigueF1 = true;

  const color2 = $("dev2Color");
  if (color2) color2.value = colorF1;

  const outline2 = devAsegurarControlContorno(2);
  if (outline2) {
    outline2.value = finalOutline;
    outline2.dataset.manual = contornoManualF1 ? "1" : "0";
  }

  devSetHostColorVisual("dev2ColorHost", colorF1);
  devSetHostColorVisual("dev2OutlineColorHost", finalOutline);
}

window.devIrFase2 = () => {
  devRenderFase(1);

  cerrarModal("modalDevFase1");
  abrirModal("modalDevFase2");

  // ✅ Fase 2 arranca sugerida con el mismo color/borde de Fase 1
  devF2HeredarTextoDesdeF1SiCorresponde();

  // ✅ Ya no mostramos botón grande debajo de la preview.
// El cuentagotas se abre desde cada selector de color.
$("devBtnCuentagotasF2")?.closest(".dev2-eyedropper-row")?.remove();

if (typeof window.initPickrEnHosts === "function") {
  window.initPickrEnHosts(
    "#dev2FondoHost, #dev2GradColor2Host, #dev2GradColor3Host, #dev2ColorHost, #dev2OutlineColorHost"
  );
}

  dev2ActualizarPanelUI();

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

  // ✅ NO resetear el audio acá.
  // Si ya tocaste "Correcto", debe seguir confirmado aunque vuelvas a editar fases.
  devEnsureFase3Opciones();

     const btnFinal = $("devBtnFinalizar");
  if (btnFinal) {
    btnFinal.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Publicar y compartir`;
    btnFinal.title = "Publicar y compartir";
  }
   
  devSetFinalButtons(DEV.requiereAudio ? !!DEV.audioOk : true);

  devSetLoadingFase3(true, "⏳ Generando…");

  try {
    if (typeof html2canvas === "function") {
      const c = await renderFinalCanvasCaptureReal();
      await devPrepararShareFinalDesdeCanvas(c);
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
  window.__devFinalCanvas = null;
  window.__devFinalFile = null;
  devRenderFase(2);
};

window.devAudioDesdeFase3 = () => {
  // abre audio pero NO te saca de fase 3
  devAbrirAudio();
};

function devEnsureFase3Opciones(){
  const box = $("devF3PreviewBox");
  if (!box) return;

  let panel = $("devF3Opciones");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "devF3Opciones";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";
    panel.style.gap = "10px";
    panel.style.padding = "10px 12px 4px";
    panel.style.alignItems = "stretch";

    panel.innerHTML = `
      <label style="display:flex; align-items:center; gap:8px; font-weight:700; cursor:pointer;">
        <input type="checkbox" id="devChkRequiereAudio">
        Requiere audio
      </label>

      <label style="display:flex; align-items:center; gap:8px; font-weight:700; cursor:pointer;">
        <input type="checkbox" id="devChkSubirGithubFase3">
        Subir audio a GitHub
      </label>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        
        <button type="button" class="btn-primary" id="devBtnCargarAudioManual">
          🎵 Cargar audio finalizado
        </button>

        <button type="button" class="btn-ghost" id="devBtnQuitarAudioManual">
          🗑 Quitar audio
        </button>
      </div>

      <input id="devAudioManualInput" type="file" accept="audio/*" hidden>

      <div id="devAudioManualInfo" style="font-size:13px; opacity:.8;">
        Sin audio cargado
      </div>
    `;

    box.parentNode.insertBefore(panel, box);

    const chkReq   = $("devChkRequiereAudio");
    const chkGh    = $("devChkSubirGithubFase3");
    const btnAudio = $("devBtnAudio");
    const btnUp    = $("devBtnCargarAudioManual");
    const btnDel   = $("devBtnQuitarAudioManual");
    const inpAud   = $("devAudioManualInput");

    if (chkReq) {
      chkReq.addEventListener("change", ()=>{
        DEV.requiereAudio = !!chkReq.checked;

        if (!DEV.requiereAudio) {
          devSetFinalButtons(true);
        } else {
          devSetFinalButtons(!!DEV.audioOk);
        }

        devUpdateAudioManualUI();
      });
    }

    if (chkGh) {
      chkGh.addEventListener("change", ()=>{
        DEV.subirAudioGithub = !!chkGh.checked;
      });
    }

    if (btnAudio) {
      btnAudio.addEventListener("click", ()=>{
        window.devAbrirAudio();
      });
    }

    if (btnUp) {
      btnUp.addEventListener("click", ()=>{
        window.devAudioPickManual();
      });
    }

    if (btnDel) {
      btnDel.addEventListener("click", ()=>{
        window.devAudioQuitarManual();
      });
    }

    if (inpAud) {
      inpAud.addEventListener("change", async (e)=>{
        const file = e.target.files?.[0];
        if (!file) return;
        await window.devAudioCargarManual(file);
        e.target.value = "";
      });
    }
  }

  const chkReq = $("devChkRequiereAudio");
  const chkGh  = $("devChkSubirGithubFase3");

  if (chkReq) chkReq.checked = !!DEV.requiereAudio;
  if (chkGh) chkGh.checked = !!DEV.subirAudioGithub;

  devUpdateAudioManualUI();
  devSetFinalButtons(DEV.requiereAudio ? !!DEV.audioOk : true);
}

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

  if (fase === 1) {
    DEV.f1.size = next;
    DEV.f1.userChanged = true;
  } else {
    DEV.f2.size = next;
    DEV.f2.userChanged = true;
  }

  devRenderFase(fase);
};

window.devToggleStyle = (fase, key) => {
     if (key === "underline") return;
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

    if (k === "Tamano") {
      DEV.f1.userChanged = true;
    }

    // ✅ si cambia el color de texto en Fase 1,
    // Fase 2 se actualiza también aunque ya exista imagen final.
    if (k === "Color") {
      devF2HeredarTextoDesdeF1SiCorresponde();
    }

    devRenderFase(1);
  });
});

// =========================
// FASE 2: texto, textura y adorno
// =========================
["Tamano","Color","TexturaOp","AdornoTamano","AdornoOpacidad"].forEach(k=>{
  const el = $(`dev2${k}`);
  if (!el) return;

  el.addEventListener("input", ()=>{
    DEV.f2.userChanged = true;

    DEV.f2.size = Number($("dev2Tamano")?.value || 26);
    DEV.f2.color = $("dev2Color")?.value || "#000000";
    DEV.f2.texturaOp = Number($("dev2TexturaOp")?.value || 0.22);
    DEV.f2.adornoWidth = Number($("dev2AdornoTamano")?.value || 70);
    DEV.f2.adornoOpacidad = Math.max(0, Math.min(1, Number($("dev2AdornoOpacidad")?.value ?? 1)));

    // ✅ solo si tocás color de texto en Fase 2,
    // Fase 2 deja de copiar el color/borde de Fase 1.
    if (k === "Color") {
      DEV.f2.textoSigueF1 = false;
    }

    requestAnimationFrame(()=> devRenderFase(2));
  });
});

  // Fondo principal fase 2: sirve para plano y como primer color del degradado
  const fondo2 = $("dev2Fondo");
  if (fondo2) {
    fondo2.addEventListener("input", ()=>{
      DEV.f2.fondoColor = fondo2.value || "#ffffff";
      DEV.f2.userChanged = true;
      devRenderFase(2);
    });
  }

const gradColor2 = $("dev2GradColor2");
if (gradColor2) {
  gradColor2.addEventListener("input", ()=>{
    DEV.f2.usarColor2 = true;
    DEV.f2.gradienteColor2 = gradColor2.value || "#d1eeff";
    DEV.f2.userChanged = true;
    dev2ActualizarPanelUI();
    devRenderFase(2);
  });
}

const gradColor3 = $("dev2GradColor3");
if (gradColor3) {
  gradColor3.addEventListener("input", ()=>{
    DEV.f2.usarColor2 = true;
    DEV.f2.usarColor3 = true;
    DEV.f2.gradienteColor3 = gradColor3.value || "#a6d0ff";
    DEV.f2.userChanged = true;
    dev2ActualizarPanelUI();
    devRenderFase(2);
  });
}

  const gradForma = $("dev2GradForma");
  if (gradForma) {
    gradForma.addEventListener("change", ()=>{
      DEV.f2.gradienteForma = gradForma.value || "vertical";
      DEV.f2.userChanged = true;
      devRenderFase(2);
    });
  }
}

/* =========================================================
   11) AUDIO (bloquea botones hasta "Correcto")
   ========================================================= */
window.devAbrirAudio = () => {
  window.__AUDIO_VOICE_NAME = "es-US-Neural2-B";
  window.__AUDIO_ORIGEN = "devocional";

  DEV.audioText = buildAudioFromParts(DEV.p1, DEV.p2);

  const ta = $("textoAudio");
  if (ta) ta.value = DEV.audioText;

  if (typeof window.abrirModalAudio === "function") {
    window.abrirModalAudio();

    setTimeout(() => {
      let box = $("devAudioGithubBox");
      const host =
        document.querySelector("#modalAudio .modal-contenido") ||
        document.querySelector("#modalAudio .modal-box") ||
        document.querySelector("#modalAudio .modal-body") ||
        $("modalAudio");

      if (!host) return;

      if (!box) {
        box = document.createElement("div");
        box.id = "devAudioGithubBox";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.gap = "8px";
        box.style.padding = "10px 12px 4px";

        box.innerHTML = `
          <label style="display:flex; align-items:center; gap:8px; font-weight:700; cursor:pointer;">
            <input type="checkbox" id="devChkSubirGithubAudio">
            Subir audio a GitHub
          </label>
        `;

        const audioEl =
          document.querySelector("#modalAudio audio") ||
          $("audioPreview");

        if (audioEl && audioEl.parentNode) {
          audioEl.parentNode.insertBefore(box, audioEl);
        } else {
          host.appendChild(box);
        }

        const chk = $("devChkSubirGithubAudio");
        if (chk) {
          chk.addEventListener("change", ()=>{
            DEV.subirAudioGithub = !!chk.checked;
          });
        }
      }

      const chk = $("devChkSubirGithubAudio");
      if (chk) chk.checked = !!DEV.subirAudioGithub;
    }, 50);

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

  // ✅ evita enganchar el hook dos veces
  if (window.finalizarYSubirAudio.__devHooked) return;

  const original = window.finalizarYSubirAudio;

  const wrapped = async function(...args){
    const r = await original.apply(this, args);

    // ✅ si estoy en fase 3, guardo el audio confirmado
    const m3 = $("modalDevFase3");
    const visible = m3 && m3.classList.contains("abierto");

    if (visible) {
      try {
        const pack = await audioElementToBase64();

        if (pack?.blob && pack?.base64) {
          DEV.audioManualBlob = pack.blob;
          DEV.audioManualBase64 = pack.base64;

          // ✅ nombre vacío para que arriba diga "Audio confirmado"
          // y no "Audio cargado: audio finalizado"
          DEV.audioManualName = "";
        }
      } catch(e) {
        console.warn("No pude guardar copia del audio confirmado, pero lo marco como OK:", e);
      }

      DEV.audioOk = true;
      devSetFinalButtons(true);
      devUpdateAudioManualUI();
    }

    return r;
  };

  wrapped.__devHooked = true;
  window.finalizarYSubirAudio = wrapped;
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
window.__devFinalCanvas = null;
window.__devFinalFile = null;

async function devPrepararShareFinalDesdeCanvas(canvas){
  if (!canvas) return null;

  window.__devFinalCanvas = canvas;

  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
  if (!blob) {
    window.__devFinalFile = null;
    return null;
  }

  window.__devFinalFile = new File([blob], "devocional.png", { type: "image/png" });
  return window.__devFinalFile;
}

async function devDescargarImagenSolo(canvas){
  const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
  if (!blob) {
    alert("❌ No se pudo preparar la imagen.");
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "devocional.png";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

window.devCompartirFinal = async () => {
  try {
    const file = window.__devFinalFile;
    const canvas = window.__devFinalCanvas;

    if (!file || !canvas) {
      alert("Todavía se está preparando la imagen. Tocá compartir otra vez en un instante.");
      return false;
    }

    // ✅ Compartir real: SOLO funciona bien cuando viene de un toque directo del usuario
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Devocional"
      });
      return true;
    }

    // ✅ Ya NO descarga automáticamente.
    // Solo ofrece descargar si el navegador realmente no soporta compartir archivo.
    const descargar = confirm(
      "Este navegador no permite compartir la imagen directamente.\n\n¿Querés descargar el PNG para compartirlo manualmente?"
    );

    if (descargar) {
      await devDescargarImagenSolo(canvas);
    }

    return false;

  } catch (e) {
    // ✅ Si el usuario cancela compartir, NO descargamos nada.
    console.warn("Share cancelado o falló:", e);
    return false;
  }
};

function devCrearModalCompartirPublicado(){
  if ($("modalDevCompartirPublicado")) return;

  const div = document.createElement("div");
  div.id = "modalDevCompartirPublicado";
  div.className = "modal-overlay";
  div.setAttribute("aria-hidden", "true");
  div.style.zIndex = "100000";

  div.innerHTML = `
    <div class="modal-contenido modal-dev" style="
      width:min(92vw, 420px);
      max-width:420px;
      height:auto;
      min-height:0;
      text-align:center;
      padding:22px 18px 18px;
      gap:14px;
      background:#ffffff;
      color:#13213a;
      border-radius:24px;
      box-shadow:0 18px 60px rgba(0,0,0,.35);
      border:1px solid rgba(0,0,0,.08);
      position:relative;
      box-sizing:border-box;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
    ">
      <button
        type="button"
        class="cerrar-modal"
        onclick="devCerrarModalCompartirPublicado(true)"
        style="
          position:absolute;
          top:10px;
          right:10px;
          width:34px;
          height:34px;
          border-radius:999px;
          border:0;
          background:#f2f4f8;
          color:#111;
          font-weight:900;
          cursor:pointer;
        "
      >✕</button>

      <h3 style="
        margin:8px 34px 0;
        color:#0e286f;
        font-size:20px;
        line-height:1.2;
      ">
        ✅ Devocional publicado
      </h3>

      <p style="
        margin:0;
        font-size:15px;
        line-height:1.35;
        color:#24324a;
      ">
        Ahora tocá compartir para abrir el menú de redes.
      </p>

      <div style="
        display:flex;
        gap:10px;
        justify-content:center;
        flex-wrap:wrap;
        margin-top:6px;
      ">
        <button type="button" class="btn-primary" onclick="devCompartirPublicadoAhora()">
          <i class="fa-solid fa-share-nodes"></i>
          Compartir ahora
        </button>

        <button type="button" class="btn-ghost" onclick="devDescargarPublicadoAhora()">
          <i class="fa-solid fa-download"></i>
          Descargar PNG
        </button>

        <button type="button" class="btn-ghost" onclick="devCerrarModalCompartirPublicado(true)">
          Listo
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(div);
}

window.devAbrirModalCompartirPublicado = function(){
  devCrearModalCompartirPublicado();
  abrirModal("modalDevCompartirPublicado");
};

window.devCerrarModalCompartirPublicado = function(cerrarTodo = true){
  cerrarModal("modalDevCompartirPublicado");

  if (cerrarTodo) {
    devCerrarTodo();
  }
};

window.devCompartirPublicadoAhora = async function(){
  const ok = await window.devCompartirFinal();

  // ✅ Solo cerramos y reseteamos si realmente compartió.
  // Si todavía no estaba listo, el modal queda abierto y no se pierde el archivo.
  if (ok) {
    window.devCerrarModalCompartirPublicado(true);
  }
};

window.devDescargarPublicadoAhora = async function(){
  if (!window.__devFinalCanvas) {
    alert("No hay imagen preparada para descargar.");
    return;
  }

  await devDescargarImagenSolo(window.__devFinalCanvas);
  window.devCerrarModalCompartirPublicado(true);
};

function safeFilePart(s){
  return String(s || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s/g, "_")
    .slice(0, 60);
}

window.devDescargarFinal = async (opts = {}) => {
 const silent = !!opts.silent;
const descargarLocal = opts.descargarLocal !== false;
const subirGithub = opts.subirGithub !== false;

  if (!silent) {
    devBusyShow("⏳ Preparando audio…");
  }

  try {
    let pack = null;

    // 1) si cargaste audio finalizado manual, ese manda
    if (DEV.audioManualBlob && DEV.audioManualBase64) {
      pack = {
        base64: DEV.audioManualBase64,
        blob: DEV.audioManualBlob
      };
    }

    // 2) si no, intentar tomarlo del modal/audio existente
    if (!pack) {
      pack = await audioElementToBase64();
    }

    // 3) si no existe, generarlo automáticamente
    if (!pack?.base64 || !pack?.blob) {
      window.__AUDIO_VOICE_NAME = "es-US-Neural2-B";

      const texto = (DEV.audioText || "").trim();
      if (!texto) {
        throw new Error("No hay texto para audio.");
      }

      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          voiceName: "es-US-Neural2-B"
        })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.audioBase64) {
        throw new Error(data?.error || data?.detail || "No pude generar el audio automáticamente.");
      }

      const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });

      pack = { base64: data.audioBase64, blob };
    }

// 4) subir a GitHub opcional
let gh = null;

if (DEV.subirAudioGithub && subirGithub && !DEV.audioGithubUrl) {
  try {
    gh = await subirAudioAGithubDesdeWeb(pack.base64);
    DEV.audioGithubUrl = gh.url || "";
  } catch (e) {
    console.warn("GitHub upload falló:", e);

    // ✅ En finalizar/compartir no seguimos si GitHub era requerido
    if (silent) {
      throw e;
    }

    alert("⚠️ No pude subir a GitHub, pero igual te lo descargo.\n\nDetalle: " + (e?.message || e));
  }
} else if (!DEV.subirAudioGithub) {
  DEV.audioGithubUrl = "";
}

    // 5) descargar local solo cuando corresponde
    if (descargarLocal) {
      const fecha = DEV?.p1?.fecha || "sin_fecha";
      const baseName = "Audio_" + safeFilePart(fecha);

      const ext =
        pack.blob.type.includes("wav")  ? "wav" :
        pack.blob.type.includes("ogg")  ? "ogg" :
        pack.blob.type.includes("mpeg") ? "mp3" :
        "mp3";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(pack.blob);
      a.download = `${baseName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    DEV.audioOk = true;
    devSetFinalButtons(true);
    devUpdateAudioManualUI();

    if (!silent) {
      if (gh?.url) {
        alert("✅ Audio subido a GitHub y descargado.\n\nURL:\n" + gh.url);
      } else if (descargarLocal) {
        alert("✅ Audio descargado.");
      } else {
        alert("✅ Audio preparado.");
      }
    }

    return {
      ok: true,
      githubUrl: DEV.audioGithubUrl || ""
    };

  } catch (e) {
    console.error(e);

    if (!silent) {
      alert("❌ No se pudo descargar/subir el audio.\n\nDetalle: " + (e?.message || e));
    }

    throw e;

  } finally {
    if (!silent) {
      devBusyHide();
    }
  }
};

// ✅ SUBE LA IMAGEN SOLO UNA VEZ A R2
async function devSubirImagenBaseUnaVez(tsParam){
  if (!window.__UID) {
    alert("Debes iniciar sesión.");
    throw new Error("Usuario no logueado");
  }

  const c = await renderFinalCanvasCaptureReal();
  if (!c) throw new Error("No se pudo renderizar el canvas final");

  const ts = Number(tsParam) || Date.now();
  const fileName = `devocional_${ts}.png`;

  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) throw new Error("No se pudo convertir a PNG");

  const fileBase64 = await blobToBase64(blob);

  const subida = await subirImagenAR2DesdeWeb(fileBase64, fileName, "image/png");

return {
  ok: true,
  ts,
  url: subida.url,
  dbPath: ""
};
}

// ✅ SOLO GUARDA REFERENCIA EN IGLESIA
async function devGuardarEnIglesia(asset){
  const fb = window.__FB;
  const api = window.__FB_API;

  if (!fb || !api || !window.__UID) {
    throw new Error("Firebase no listo");
  }

  const uid = window.__UID;
  const { db } = fb;
  const { ref, set } = api;

  const dbPath = `devocionalesIglesia/${uid}/${asset.ts}`;

await set(ref(db, dbPath), {
  url: asset.url,
  fecha: asset.ts,
  texto: DEV.audioText || "",
  cita: DEV.p1?.cita || "",
  versiculo: DEV.p1?.versiculo || "",
  audioOk: !!DEV.audioOk,
  audioGithubUrl: DEV.audioGithubUrl || "",
  origen: "devocional"
});

  return { ok:true, dbPath };
}

// ✅ SOLO GUARDA REFERENCIA EN MI PANEL
async function devGuardarEnMiPanel(asset){
  const fb = window.__FB;
  const api = window.__FB_API;

  if (!fb || !api || !window.__UID) {
    throw new Error("Firebase no listo");
  }

  const uid = window.__UID;
  const { db } = fb;
  const { ref, set } = api;

  const dbPath = `panelImagenesPersonal/${uid}/${asset.ts}`;

  await set(ref(db, dbPath), {
    url: asset.url,
    fecha: asset.ts,
    origen: "devocional",
    tipoTexto: "devocional",

    // ✅ para mostrar bonito en Mi Panel
    cita: DEV.p1?.cita || "",
    versiculo: DEV.p1?.versiculo || "",

    // ✅ texto y audio
    textoLibre: DEV.audioText || "",
    audioOk: !!DEV.audioOk,
    audioGithubUrl: DEV.audioGithubUrl || "",

    // ✅ útil para relacionarlo si después querés
    devocionalKey: `${uid}_${asset.ts}`
  });

  return { ok:true, dbPath };
}

// ✅ candado anti doble submit
DEV.publicando = DEV.publicando || false;

async function devAsegurarShareFinalListo(){
  if (window.__devFinalCanvas && window.__devFinalFile) return;

  const c = await renderFinalCanvasCaptureReal();
  if (!c) throw new Error("No se pudo preparar la imagen para compartir.");

  await devPrepararShareFinalDesdeCanvas(c);
}

window.devFinalizar = async () => {
  if (DEV.publicando) return;

  DEV.publicando = true;

  const btns = [
    "devBtnFinalizar",
    "devBtnDescargar",
    "devBtnCompartir",
    "devBtnPanelToggle",
    "devBtnIglesia",
    "devBtnAudio"
  ]
    .map(id => document.getElementById(id))
    .filter(Boolean);

  btns.forEach(b => b.disabled = true);

  const ok = confirm(
    "¿Publicar devocional y compartir?\n\n" +
    "1) Sube el audio a GitHub si está tildado y lo descarga.\n" +
    "2) Sube el devocional a Iglesia.\n" +
    "3) Lo guarda en Mi Panel solo si está tildado.\n" +
    "4) Abre compartir en redes."
  );

  if (!ok) {
    DEV.publicando = false;
    btns.forEach(b => b.disabled = false);
    return;
  }

  try {
    const ts = Date.now(); // ✅ 1 solo TS para todo

    // ✅ si requiere audio, primero tiene que estar confirmado/cargado
    if (DEV.requiereAudio && !DEV.audioOk) {
      throw new Error("Primero confirmá el audio, cargá un audio finalizado, o desactivá 'Requiere audio'.");
    }

// ✅ preparar audio: subir a GitHub si corresponde Y descargar local
if (DEV.requiereAudio) {
  devBusyShow(
    DEV.subirAudioGithub
      ? "⏳ Subiendo y descargando audio…"
      : "⏳ Descargando audio…"
  );

  await window.devDescargarFinal({
    silent: true,
    descargarLocal: true,
    subirGithub: !!DEV.subirAudioGithub
  });

  if (DEV.subirAudioGithub && !DEV.audioGithubUrl) {
    throw new Error("El audio no quedó subido a GitHub. Revisá el audio o la Function de GitHub.");
  }
}

    // ✅ subir imagen/devocional
    devBusyShow("⏳ Subiendo devocional…");

    const asset = await devSubirImagenBaseUnaVez(ts);

    // ✅ guardar en Iglesia
    await devGuardarEnIglesia(asset);

    // ✅ guardar en Mi Panel solo si está tildado
    if (DEV.subirPanel) {
      await devGuardarEnMiPanel(asset);
    }

    // ✅ asegurar archivo listo para compartir
    devBusyShow("⏳ Preparando compartir…");
    await devAsegurarShareFinalListo();

    devBusyHide();

    // ✅ MUY IMPORTANTE:
    // Cerramos solo Fase 3, NO devCerrarTodo(),
    // porque devCerrarTodo borra window.__devFinalCanvas y window.__devFinalFile.
    cerrarModal("modalDevFase3");

    devToast("✅ Publicado. Elegí cómo compartir…");

    // ✅ Ahora el modal ya no queda escondido detrás de Fase 3.
    window.devAbrirModalCompartirPublicado();

  } catch (e) {
    console.error(e);
    alert("❌ Error al publicar/compartir.\n\nDetalle: " + (e?.message || e));
  } finally {
    DEV.publicando = false;
    btns.forEach(b => b.disabled = false);
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
const btnFinal = $("btnDevCargarFinal");
const btnRecortar = $("btnDevRecortar");
const btnListo = $("btnDevListo");
const btnOCR = $("btnDevOCR");
const ta = $("devTexto");
const boxCanvas = $("devCanvasBox");
const btnCrear = $("btnAbrirDevModal");

  if (btnImg && input) btnImg.addEventListener("click", ()=> input.click());

 if (!input || !btnRecortar || !btnListo || !btnOCR || !ta) return;

  bindPointerCropEvents();
  bindInputs();
  hookAudioCorrecto();

  // fuentes/listas y fondos y adornos
  crearListaFuentes(1);
  crearListaFuentes(2);
  cargarFondosDev();
  cargarAdornosF2();
  cargarTexturasF2();

  if (typeof window.initPickrEnHosts === "function") {
    window.initPickrEnHosts("#dev1OpColorHost, #dev1ColorHost, #dev2FondoHost, #dev2ColorHost");
  }

  // estado inicial
// estado inicial
btnRecortar.style.display = "none";
btnListo.style.display = "none";
btnOCR.style.display = "none";

btnRecortar.disabled = true;
btnRecortar.style.opacity = "0.6";

syncBtnCrear();
ta.addEventListener("input", syncBtnCrear);
ocrSetStatus("✅ Cargá una imagen, recortá si querés y tocá Crear devocional.");
   
  // cargar imagen
  input.addEventListener("change", ()=>{
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = ()=>{
DEV.img = image;

if (btnFinal) btnFinal.style.display = "none";
btnOCR.style.display = "none";
btnRecortar.style.display = "inline-flex";
btnListo.style.display = "inline-flex";

// reset crop
DEV.crop = null;
DEV.start = null;
DEV.drawing = false;

DEV.recortando = true;
btnRecortar.disabled = false;
btnRecortar.style.opacity = "1";

fitCanvasToImage(DEV.img, 300);
DEV.crop = devCrearCropCuadradoInicial();
draw();

      if (boxCanvas) boxCanvas.classList.remove("hidden");

// ✅ OCR local: mantenemos el flujo limpio, sin Functions
const boxText = $("devTextoBox");
if (boxText) boxText.classList.add("hidden");

ta.value = "";
syncBtnCrear();

URL.revokeObjectURL(url);
ocrSetStatus("✅ Imagen cargada. Ajustá el recorte y tocá OCR.");
    };

    image.src = url;
  });

// entrar en modo recorte
btnRecortar.addEventListener("click", ()=>{
  if (!DEV.img) { alert("Primero cargá una imagen"); return; }

  DEV.recortando = true;
  DEV.start = null;
  DEV.drawing = false;

  btnRecortar.style.display = "inline-flex";
  btnListo.style.display = "inline-flex";
  btnOCR.style.display = "none";

  draw();
});

// confirmar recorte
btnListo.addEventListener("click", ()=>{
  if (!DEV.img) { alert("Primero cargá una imagen"); return; }

  DEV.recortando = false;
  DEV.start = null;
  DEV.drawing = false;

  btnRecortar.style.display = "none";
  btnListo.style.display = "none";
  btnOCR.style.display = "inline-flex";

  draw();
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
        ocrSetStatus("❌ Error OCR: " + (data?.error || data?.detail || r.status));
        return;
      }

      const text = (data?.text || "").trim();
      if (!text) {
        ocrSetStatus("⚠️ No se detectó texto.");
        return;
      }

      DEV.rawText = text;
      ta.value = text;

      const boxText = $("devTextoBox");
      if (boxText) boxText.classList.remove("hidden");

      syncBtnCrear();
      ocrSetStatus("✅ OCR listo.");
      await devAbrirFase0();

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
DEV.f2.textoSigueF1 = true; // ✅ Fase 2 vuelve a seguir color/borde de Fase 1
DEV.f1.userChanged = false; // ✅ nuevo devocional => permitir sugerencia inicial fase 1
     
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
  devInitFinalizadoHook();
  devMostrarHome();
  resolverAdminYArrancar();
});

function isAdmin(){
  // si biblia.js te setea este flag, lo usamos
  return !!window.__ES_ADMIN;
}

window.devPrivacidadLabel = function(){
  const chk = document.getElementById("devOracionPublica");
  const txt = document.getElementById("devOracionPrivacidadTxt");
  if (!txt) return;
  txt.textContent = chk?.checked ? "Público" : "Solo yo";
};

function devAsegurarModalOracion(){
  if (document.getElementById("modalDevOracion")) return;

  const div = document.createElement("div");
  div.id = "modalDevOracion";
  div.className = "modal-overlay";
  div.setAttribute("aria-hidden", "true");

  div.innerHTML = `
    <div class="modal-contenido" style="
      max-width: 540px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 14px 34px rgba(0,0,0,.24);
      padding: 16px 14px 14px;
      box-sizing: border-box;
    ">
      <button type="button" class="cerrar-modal" onclick="devCerrarModalOracion()">✕</button>

      <h3 style="margin:0 0 12px; text-align:center;">🙏</h3>

<div style="
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:10px;
">
  <label style="font-size:13px; font-weight:700;">Color</label>
  <input id="devOracionColor" type="hidden" value="#fff4b8">
  <button
    type="button"
    id="devOracionColorHost"
    class="pickr-host"
    data-target="#devOracionColor"
    aria-label="Color oración"></button>
</div>

      <textarea
        id="devOracionTexto"
        placeholder="Escribí tu oración o comentario..."
        style="
          width:100%;
          min-height:150px;
          border:1px solid #d3d3d3;
          border-radius:16px;
          padding:14px 12px;
          font:inherit;
          font-size:14px;
          line-height:1.45;
          resize:vertical;
          box-sizing:border-box;
        "
      ></textarea>

      <div style="
        margin-top:12px;
        padding:10px 12px;
        border:1px solid #e5e5e5;
        border-radius:14px;
        background:#fafafa;
      ">
        <label style="
          display:flex;
          align-items:center;
          gap:8px;
          font-size:14px;
          cursor:pointer;
        ">
          <input type="checkbox" id="devOracionPublica" onchange="devPrivacidadLabel()">
          <span id="devOracionPrivacidadTxt">Público</span>
        </label>
      </div>

      <div style="
        display:flex;
        justify-content:center;
        gap:10px;
        margin-top:16px;
      ">
        <button type="button" class="btn-primary" onclick="devGuardarOracionDevocional()">
          Guardar
        </button>

        <button type="button" class="btn-primary" onclick="devCerrarModalOracion()">
          Cancelar
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(div);

  div.addEventListener("click", (e)=>{
    if (e.target === div) devCerrarModalOracion();
  });
}

window.devAbrirModalOracion = function(uidOwner, tsKey){
  devAsegurarModalOracion();

  DEV.oracionDevOwner = String(uidOwner || "");
  DEV.oracionDevTs = Number(tsKey || 0);
  DEV.oracionDevActual = `${DEV.oracionDevOwner}_${DEV.oracionDevTs}`;

  if (!DEV.oracionDevOwner || !DEV.oracionDevTs) {
    alert("No encontré el devocional para adjuntar la oración.");
    return;
  }

  const ta = document.getElementById("devOracionTexto");
  const chk = document.getElementById("devOracionPublica");

  if (ta) ta.value = "";
  if (chk) chk.checked = true;

  // ✅ resetea valor real + color visual del selector
  devSetColorOracionVisual(DEV_ORACION_COLOR_DEFAULT);

  devPrivacidadLabel();
  abrirModal("modalDevOracion");

  setTimeout(()=>{
    if (typeof window.initPickrEnHosts === "function") {
      window.initPickrEnHosts("#devOracionColorHost");
    }

    // ✅ lo repetimos después de inicializar Pickr,
    // porque Pickr a veces recuerda visualmente el color anterior
    devSetColorOracionVisual(DEV_ORACION_COLOR_DEFAULT);

    document.getElementById("devOracionTexto")?.focus();
  }, 80);
};

window.devCerrarModalOracion = function(){
  cerrarModal("modalDevOracion");
};

window.devGuardarOracionDevocional = async function(){
  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

  if (!fb || !api || !uid) {
    alert("Tenés que estar logueado.");
    return;
  }

  const texto = (document.getElementById("devOracionTexto")?.value || "").trim();
  const publica = !!document.getElementById("devOracionPublica")?.checked;
  const color = devLeerColorOracionSeguro();

  if (!texto) {
    alert("Escribí algo primero.");
    return;
  }

  if (!DEV.oracionDevOwner || !DEV.oracionDevTs) {
    alert("No encontré el devocional.");
    return;
  }

  const { db } = fb;
  const { ref, push, set } = api;

  try {
    const pathsBase = devOracionPaths(DEV.oracionDevOwner, DEV.oracionDevTs);
    const newRef = push(ref(db, pathsBase.basePrivada));
    const comentId = newRef.key;

    const paths = devOracionPaths(DEV.oracionDevOwner, DEV.oracionDevTs, comentId);

    const oracionData = {
      autorUid: uid,
      texto,
      publica,
      destacado: false,
      color,
      fecha: Date.now()
    };

    // ✅ 1) principal
    await set(ref(db, paths.privadaItem), oracionData);

    // ✅ 2) copia propia para que el autor pueda editar/borrar desde Compartidos
    if (paths.miaItem) {
      await set(ref(db, paths.miaItem), {
        ...oracionData,
        uidOwner: DEV.oracionDevOwner,
        tsKey: DEV.oracionDevTs
      });
    }

    // ✅ 3) copia pública para que Compartidos pueda leer sin permission_denied
    if (publica === true) {
      await set(ref(db, paths.publicaItem), {
        ...oracionData,
        uidOwner: DEV.oracionDevOwner,
        tsKey: DEV.oracionDevTs
      });
    }

    if (typeof devToast === "function") {
      devToast("🙏 Guardado");
    }

    devCerrarModalOracion();

  } catch (e) {
    console.error(e);
    alert("❌ No se pudo guardar.\n\nDetalle: " + (e?.message || e));
  }
};

function devToast(msg){
  let t = document.getElementById("devToast");

  if (!t){
    t = document.createElement("div");
    t.id = "devToast";
    t.style.position = "fixed";
    t.style.bottom = "80px";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.background = "#111";
    t.style.color = "#fff";
    t.style.padding = "10px 16px";
    t.style.borderRadius = "12px";
    t.style.fontSize = "14px";
    t.style.zIndex = "99999";
    t.style.opacity = "0";
    t.style.transition = "opacity .25s ease";
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.style.opacity = "1";

  clearTimeout(t._hide);
  t._hide = setTimeout(()=>{
    t.style.opacity = "0";
  }, 1600);
}

async function cargarGuardadosEnMiPanel(){
  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

  DEV.panelGuardados = new Set();
  DEV.panelGuardadosLoaded = false;

  if (!fb || !api || !uid) return;

  const { db } = fb;
  const { ref, get } = api;

  try{
    const snap = await get(ref(db, `panelImagenesPersonal/${uid}`));
    const val = snap.val() || {};

    Object.values(val).forEach(it => {
      if (!it || typeof it !== "object") return;

      const key = String(it.devocionalKey || "");

      if (key) DEV.panelGuardados.add(key);
    });

    DEV.panelGuardadosLoaded = true;
  } catch(e){
    console.warn("No pude cargar guardados de Mi Panel:", e);
  }
}

function devKeyPublicado(it){
  return String(it?.id || "");
}

function devYaGuardadoEnPanel(it){
  const key = devKeyPublicado(it);
  return DEV.panelGuardados.has(key);
}

window.devGuardarPublicadoEnMiPanel = async function(itId){
  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

 if (!fb || !api || !uid) {
  if (typeof window.abrirLoginParaGuardarMiPanel === "function") {
    window.abrirLoginParaGuardarMiPanel();
  } else {
    window.location.href = "login.html";
  }
  return;
}

  const item = (window.__DEV_ITEMS_PUBLICADOS || []).find(x => x.id === itId);
  if (!item) {
    alert("No encontré ese devocional.");
    return;
  }

  const key = devKeyPublicado(item);
  if (devYaGuardadoEnPanel(item)) {
  devToast("💙 Ya lo tenías guardado");
  return;
}

  const { db } = fb;
  const { ref, set } = api;

  const ts = Date.now();
  const dbPath = `panelImagenesPersonal/${uid}/${ts}`;

  try{
    await set(ref(db, dbPath), {
  url: item.url || "",
  fecha: ts,
  origen: "devocional_publicado",
  tipoTexto: "devocional",
  textoLibre: item.texto || "",
  audioOk: !!item.audioOk,
  audioGithubUrl: item.audioGithubUrl || "",
  cita: item.cita || "",
  versiculo: item.versiculo || "",
  devocionalKey: key,
  sourceUid: item.uidOwner || "",
  sourceTs: item.tsKey || 0
});

    DEV.panelGuardados.add(key);
   
    const btn = document.querySelector(`[data-dev-save="${itId}"]`);
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-heart-circle-check"></i>`;
      btn.disabled = true;
      btn.classList.add("guardado");
       devToast("💙 Guardado en Mi Panel");
      btn.setAttribute("aria-label", "Guardado en Mi Panel");
      btn.title = "Ya guardado en Mi Panel";
    }

  } catch(e){
    console.error(e);
    alert("❌ No se pudo guardar en Mi Panel.\n\nDetalle: " + (e?.message || e));
  }
};

function devMoverAddDebajoGaleria(){
  const row = $("devIndexRow");
  const top = $("devTopRow");

  if (!row || !top) return;

  top.classList.add("devTopRowDebajo");

  // ✅ mueve la fila del + debajo de la galería horizontal
  if (top.previousElementSibling !== row) {
    row.insertAdjacentElement("afterend", top);
  }
}

async function cargarDevocionales(){
  const fb  = window.__FB;
  const api = window.__FB_API;

  const row  = $("devIndexRow");
  const feed = $("devFeed");
  if (row)  row.innerHTML  = "";
 if (feed) feed.innerHTML = `<div class="dev-loading-msg">Cargando devocionales...</div>`;

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

// ✅ baja el + debajo de la galería
devMoverAddDebajoGaleria();

  const btnVolver = $("btnDevVolverHome");
  if (btnVolver) btnVolver.onclick = ()=> devMostrarHome();

  if (!fb || !api) {
    if (feed) feed.innerHTML = `<div style="opacity:.8; padding:10px;">
      No encuentro Firebase listo (window.__FB / window.__FB_API).<br>
      Asegurate que biblia.js inicializa Firebase y setea esas variables.
    </div>`;
    return;
  }

  await cargarGuardadosEnMiPanel();
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
    window.__DEV_ITEMS_PUBLICADOS = items;
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
    const cita  = capitalizarCitaBonita(it.cita || getCitaDeTexto(it.texto) || "") || "Devocional";
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

/* =========================================================
   RENDER REUTILIZABLE: DEVOCIONAL PUBLICADO
   - Lo usa Iglesia ahora.
   - Lo va a poder usar Compartidos después sin rehacer la card.
   ========================================================= */

function devHtml(v = "") {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function devAttr(v = "") {
  return devHtml(v)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function devJs(v = "") {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

/* =========================================================
   ORACIONES DEVOCIONAL — helpers seguros
   ========================================================= */
const DEV_ORACION_COLOR_DEFAULT = "#fff4b8";

function devColorHexValido(hex){
  return /^#[0-9a-fA-F]{6}$/.test(String(hex || "").trim());
}

function devSetColorOracionVisual(color = DEV_ORACION_COLOR_DEFAULT){
  const c = devColorHexValido(color) ? color : DEV_ORACION_COLOR_DEFAULT;

  const input = document.getElementById("devOracionColor");
  if (input) input.value = c;

  const host = document.getElementById("devOracionColorHost");
  if (!host) return;

  host.dataset.color = c;
  host.dataset.value = c;
  host.style.background = c;
  host.style.backgroundColor = c;
  host.style.setProperty("--pickr-color", c);

  const interno = host.querySelector(".pcr-button, button");
  if (interno) {
    interno.style.background = c;
    interno.style.backgroundColor = c;
    interno.style.color = c;
  }

  ["_pickr", "__pickr", "pickr"].forEach(k => {
    try {
      if (host[k] && typeof host[k].setColor === "function") {
        host[k].setColor(c, true);
      }
    } catch {}
  });
}

function devLeerColorOracionSeguro(){
  const v = document.getElementById("devOracionColor")?.value || DEV_ORACION_COLOR_DEFAULT;
  return devColorHexValido(v) ? v : DEV_ORACION_COLOR_DEFAULT;
}

function devEsErrorPermiso(e){
  return /permission_denied|permission denied/i.test(
    String(e?.message || e?.code || e || "")
  );
}

function devOracionPaths(uidOwner, tsKey, comentId = ""){
  const owner = String(uidOwner || "");
  const ts = String(tsKey || "");
  const id = String(comentId || "");
  const uid = window.__UID || "";

  const basePrivada = `devocionalesOraciones/${owner}/${ts}`;
  const basePublica = `devocionalesOracionesPublicas/${owner}/${ts}`;
  const baseMia = uid ? `devocionalesOracionesMias/${uid}/${owner}_${ts}` : "";

  return {
    basePrivada,
    basePublica,
    baseMia,

    privadaItem: id ? `${basePrivada}/${id}` : "",
    publicaItem: id ? `${basePublica}/${id}` : "",
    miaItem: id && baseMia ? `${baseMia}/${id}` : ""
  };
}

async function devSafeGetPath(db, refFn, path){
  if (!path) {
    return { ok:false, val:{}, error:new Error("Path vacío") };
  }

  try {
    const getFn = window.__FB_API?.get;

    if (typeof getFn !== "function") {
      throw new Error("Firebase get no está listo");
    }

    const snap = await getFn(refFn(db, path));

    return {
      ok: true,
      val: snap.val() || {},
      error: null
    };

  } catch(e) {
    return {
      ok: false,
      val: {},
      error: e
    };
  }
}

function devCombinarOraciones(...raws){
  const out = {};

  raws.forEach(raw => {
    Object.entries(raw || {}).forEach(([id, it]) => {
      if (!it || typeof it !== "object") return;
      out[id] = { ...(out[id] || {}), ...it };
    });
  });

  return out;
}

async function devBuscarOracionData(uidOwner, tsKey, comentId){
  const fb = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api) return null;

  const { db } = fb;
  const { ref, get } = api;
  const p = devOracionPaths(uidOwner, tsKey, comentId);

  const lecturas = await Promise.all([
    devSafeGetPath(db, ref, p.miaItem),
    devSafeGetPath(db, ref, p.publicaItem),
    devSafeGetPath(db, ref, p.privadaItem)
  ]);

  for (const r of lecturas) {
    if (r.ok && r.val && typeof r.val === "object" && Object.keys(r.val).length) {
      return r.val;
    }
  }

  return null;
}

function devEsAdminActual(){
  return typeof isAdmin === "function" && isAdmin();
}

function devAccionUrl(it = {}) {
  return String(it.url || it.shareUrl || it.storagePath || "").trim();
}

function devRenderDevocionalCardHTML(it = {}, opciones = {}) {
  const idPrefix = opciones.idPrefix ?? "devBig_";
  const domId = opciones.domId ?? `${idPrefix}${it.id || ""}`;

  const mostrarBorrar = opciones.mostrarBorrar ?? !!isAdmin();
  const mostrarOracion = opciones.mostrarOracion ?? true;
  const mostrarListaOraciones = opciones.mostrarListaOraciones ?? true;
  const mostrarGuardar = opciones.mostrarGuardar ?? true;
  const mostrarCompartir = opciones.mostrarCompartir ?? true;
  const mostrarDescargar = opciones.mostrarDescargar ?? true;

  const extraDespuesAudio = opciones.extraDespuesAudio || "";
  const extraFinal = opciones.extraFinal || "";
  const extraAcciones = opciones.extraAcciones || "";

  // ✅ para Compartidos después: podremos pasar un delete distinto,
  // que borre solo de Compartidos y NO el devocional original.
  const borrarHtmlPersonalizado = opciones.borrarHtml || "";

 const uidOwner = devJs(it.uidOwner || it.sourceUid || it.ownerUid || it.devocionalUid || "");
const tsKey = Number(it.tsKey || it.sourceTs || it.devocionalTs || 0);
  const storagePath = devJs(it.storagePath || "");
  const itemId = devJs(it.id || "");

  const urlAccion = devAccionUrl(it);
  const urlJs = devJs(urlAccion);
  const urlAttr = devAttr(it.url || urlAccion || "");

  const yaGuardado = devYaGuardadoEnPanel(it);

  const saveBtnHtml = mostrarGuardar ? `
    <button class="btn-primary ${yaGuardado ? "guardado" : ""}" type="button"
      data-dev-save="${devAttr(it.id || "")}"
      onclick="devGuardarPublicadoEnMiPanel('${itemId}')"
      aria-label="${yaGuardado ? "Guardado en Mi Panel" : "Guardar en Mi Panel"}"
      title="${yaGuardado ? "Ya guardado en Mi Panel" : "Guardar en Mi Panel"}"
      ${yaGuardado ? "disabled" : ""}>
      <i class="fa-solid ${yaGuardado ? "fa-heart-circle-check" : "fa-heart-circle-plus"}"></i>
    </button>
  ` : ``;

  const audioHtml = it.audioGithubUrl ? `
    <div class="devAudioBox">
      <audio controls preload="none" src="${devAttr(it.audioGithubUrl)}"></audio>
    </div>
  ` : ``;

  const deleteTopBtnHtml = borrarHtmlPersonalizado || (mostrarBorrar ? `
    <button class="btn-primary devDanger devDeleteTopBtn" type="button"
      onclick="devBorrarDevocional('${uidOwner}','${tsKey}','${storagePath}')"
      aria-label="Borrar"
      title="Borrar">
      <i class="fa-solid fa-trash"></i>
    </button>
  ` : ``);

  return `
    <div class="devBigCard" id="${devAttr(domId)}" style="position:relative;" data-dev-card-id="${devAttr(it.id || "")}">
      ${deleteTopBtnHtml}

      <img src="${urlAttr}" alt="dev grande" loading="lazy">

      ${audioHtml}

      ${extraDespuesAudio}

      <div class="devBigActions">
        ${mostrarOracion ? `
          <button class="btn-primary" type="button"
            onclick="devAbrirModalOracion('${uidOwner}', '${tsKey}')"
            aria-label="Adjuntar oración"
            title="Adjuntar oración">
            🙏
          </button>
        ` : ``}

        ${mostrarListaOraciones ? `
          <button class="btn-primary" type="button"
            onclick="devAbrirListaOraciones('${uidOwner}', '${tsKey}')"
            aria-label="Ver oraciones"
            title="Ver oraciones">
            <i class="fa-solid fa-receipt"></i>
          </button>
        ` : ``}

        ${saveBtnHtml}

        ${mostrarCompartir ? `
          <button class="btn-primary" type="button"
            onpointerdown="devWarmShareImage('${urlJs}', 'devocional.png')"
            ontouchstart="devWarmShareImage('${urlJs}', 'devocional.png')"
            onclick="devCompartirImagenItem('${urlJs}', 'devocional.png')"
            aria-label="Compartir"
            title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        ` : ``}

        ${mostrarDescargar ? `
          <button class="btn-primary" type="button"
            onclick="devDescargarImagenItem('${urlJs}', 'devocional.png')"
            aria-label="Descargar PNG"
            title="Descargar PNG">
            <i class="fa-solid fa-download"></i>
          </button>
        ` : ``}

        ${extraAcciones}
      </div>

      ${extraFinal}
    </div>
  `;
}

// ✅ función pública para que Compartidos pueda reutilizarla después
window.devRenderDevocionalCardHTML = devRenderDevocionalCardHTML;

function renderDevFeed(items){
  const feed = $("devFeed");
  if (!feed) return;
  feed.innerHTML = "";

  devPrecacheFeedImages(items);

  items.forEach((it)=>{
    feed.insertAdjacentHTML("beforeend", devRenderDevocionalCardHTML(it, {
      idPrefix: "devBig_",
      mostrarBorrar: isAdmin(),
      mostrarOracion: true,
      mostrarListaOraciones: true,
      mostrarGuardar: true,
      mostrarCompartir: true,
      mostrarDescargar: true
    }));
  });
}

function devAsegurarModalListaOraciones(){
  if (document.getElementById("modalDevListaOraciones")) return;

  const div = document.createElement("div");
  div.id = "modalDevListaOraciones";
  div.className = "modal-overlay";

  div.innerHTML = `
    <div class="modal-contenido" style="max-width:520px;">
      <button type="button" class="cerrar-modal" onclick="devCerrarListaOraciones()">✕</button>

      <h3 style="margin-top:0; text-align:center;">🙏 Oraciones</h3>

      <div id="devListaOracionesContenido" style="
        max-height:320px;
        overflow:auto;
        display:flex;
        flex-direction:column;
        gap:10px;
      ">
        <div style="text-align:center; font-size:13px; opacity:.6;">
          Cargando...
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(div);

  div.addEventListener("click", (e)=>{
    if (e.target === div) devCerrarListaOraciones();
  });
}

window.devAbrirListaOraciones = async function(uidOwner, tsKey){
  devAsegurarModalListaOraciones();

  abrirModal("modalDevListaOraciones");

  const box = document.getElementById("devListaOracionesContenido");
  if (box) {
    box.innerHTML = `
      <div style="text-align:center; font-size:13px; opacity:.6;">
        Cargando...
      </div>
    `;
  }

  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

  if (!fb || !api) {
    if (box) box.innerHTML = `<div style="text-align:center; opacity:.6;">Firebase no listo</div>`;
    return;
  }

  uidOwner = String(uidOwner || "");
  tsKey = String(tsKey || "");

  if (!uidOwner || !tsKey || tsKey === "0") {
    if (box) {
      box.innerHTML = `<div style="text-align:center; opacity:.6;">No encontré el devocional.</div>`;
    }
    return;
  }

  const { db } = fb;
  const { ref, get } = api;

  try{
    const paths = devOracionPaths(uidOwner, tsKey);

    // ✅ Primero público y copia propia.
    // ✅ El privado puede dar permission_denied y NO debe romper el modal.
    const [pubRes, miaRes, privRes] = await Promise.all([
      devSafeGetPath(db, ref, paths.basePublica),
      devSafeGetPath(db, ref, paths.baseMia),
      devSafeGetPath(db, ref, paths.basePrivada)
    ]);

    [pubRes, miaRes, privRes].forEach(r => {
      if (!r.ok && !devEsErrorPermiso(r.error)) {
        console.warn("Lectura oración falló:", r.error);
      }
    });

    const raw = devCombinarOraciones(
      pubRes.val,
      miaRes.val,
      privRes.val
    );

    const entries = Object.entries(raw);

    if (!entries.length) {
      box.innerHTML = `<div style="text-align:center; opacity:.6;">Sin oraciones visibles todavía</div>`;
      return;
    }

    const visibles = entries
      .map(([id, it]) => ({ id, ...(it || {}) }))
      .filter(it => it.publica === true || (uid && it.autorUid === uid) || devEsAdminActual())
      .sort((a,b)=>(b.fecha||0)-(a.fecha||0));

    if (!visibles.length){
      box.innerHTML = `<div style="text-align:center; opacity:.6;">No hay oraciones visibles para vos</div>`;
      return;
    }

    const uidJs = devJs(uidOwner);
    const tsJs = devJs(tsKey);

    box.innerHTML = visibles.map(it=>{
      const soyYo = uid && it.autorUid === uid;
      const puedeEditar = soyYo || devEsAdminActual();

      const autorTxt = soyYo ? "Tú" : (it.publica ? "Hermano/a" : "Privada");
      const fondo = devColorHexValido(it.color) ? it.color : "#f5f5f5";
      const fechaTxt = it.fecha ? fmtFecha(it.fecha) : "";
      const idJs = devJs(it.id);

      return `
        <div style="
          background:${fondo};
          padding:12px;
          border-radius:14px;
          font-size:14px;
          box-sizing:border-box;
          display:flex;
          flex-direction:column;
          gap:8px;
        ">
          <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            font-size:12px;
            opacity:.75;
          ">
            <span>${devHtml(autorTxt)}</span>
            <span>${devHtml(fechaTxt)}</span>
          </div>

          <div style="
            white-space:pre-wrap;
            line-height:1.45;
            word-break:break-word;
          ">${devHtml(it.texto || "")}</div>

${puedeEditar ? `
  <div style="
    display:flex;
    justify-content:flex-end;
    align-items:center;
    gap:6px;
  ">
    <button
      class="btn-primary"
      type="button"
      onclick="devEditarOracionPropia('${uidJs}','${tsJs}','${idJs}')"
      title="Editar oración"
      aria-label="Editar oración"
      style="
        width:29px;
        height:29px;
        min-width:29px;
        min-height:29px;
        padding:0;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      "
    >
      <i class="fa-solid fa-pen" style="font-size:11px; line-height:1;"></i>
    </button>

    <button
      class="btn-primary devDanger"
      type="button"
      onclick="devBorrarOracionPropia('${uidJs}','${tsJs}','${idJs}')"
      title="Borrar oración"
      aria-label="Borrar oración"
      style="
        width:29px;
        height:29px;
        min-width:29px;
        min-height:29px;
        padding:0;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
      "
    >
      <i class="fa-solid fa-trash" style="font-size:11px; line-height:1;"></i>
    </button>
  </div>
` : ``}
        </div>
      `;
    }).join("");

  } catch(e){
    console.error(e);
    if (box) {
      box.innerHTML = `<div style="text-align:center; opacity:.6;">Error al cargar</div>`;
    }
  }
};

window.devCerrarListaOraciones = function(){
  cerrarModal("modalDevListaOraciones");
};

function devCerrarPantallasOracion(){
  try {
    const activo = document.activeElement;
    if (activo && typeof activo.blur === "function") activo.blur();
  } catch {}

  cerrarModal("modalDevListaOraciones");
  cerrarModal("modalDevOracion");

  const alguno = document.querySelector(".modal-overlay.abierto");
  if (!alguno) document.body.classList.remove("modal-open");
}

function devRefrescarPantallaTrasOracion(){
  try {
    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  } catch {}

  try {
    if (typeof cargarDevocionales === "function") {
      cargarDevocionales();
    }
  } catch {}
}

window.devBorrarOracionPropia = async function(uidOwner, tsKey, comentId){
  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

  if (!fb || !api || !uid) {
    alert("Tenés que estar logueado.");
    return;
  }

  const ok = confirm("¿Borrar esta oración?");
  if (!ok) return;

  const { db } = fb;
  const { ref, remove } = api;

  if (typeof remove !== "function") {
    alert("❌ Firebase remove no está listo.");
    return;
  }

  try{
    const paths = devOracionPaths(uidOwner, tsKey, comentId);

    const tareas = [
      paths.privadaItem,
      paths.publicaItem,
      paths.miaItem
    ]
      .filter(Boolean)
      .map(path => remove(ref(db, path)));

    const res = await Promise.allSettled(tareas);
    const algunoOk = res.some(r => r.status === "fulfilled");

    if (!algunoOk) {
      throw res.find(r => r.status === "rejected")?.reason || new Error("No se pudo borrar.");
    }

    if (typeof devToast === "function") {
      devToast("🗑 Oración borrada");
    }

    // ✅ NO volvemos a abrir el modal de lista.
    // Cerramos y volvemos a la pantalla normal donde estabas.
    devCerrarPantallasOracion();
    devRefrescarPantallaTrasOracion();

  } catch(e){
    console.error(e);
    alert("❌ No se pudo borrar.\n\nDetalle: " + (e?.message || e));
  }
};

window.devEditarOracionPropia = async function(uidOwner, tsKey, comentId){
  const fb = window.__FB;
  const api = window.__FB_API;
  const uid = window.__UID;

  if (!fb || !api || !uid) {
    alert("Tenés que estar logueado.");
    return;
  }

  const { db } = fb;
  const { ref, set } = api;

  // ✅ No usamos update porque en tu app window.__FB_API.update no está cargado.
  // Usamos set conservando todos los datos anteriores.
  if (typeof set !== "function") {
    alert("❌ Firebase set no está listo.");
    return;
  }

  try{
    const data = await devBuscarOracionData(uidOwner, tsKey, comentId);

    if (!data) {
      alert("No encontré la oración.");
      return;
    }

    if (data.autorUid && data.autorUid !== uid && !devEsAdminActual()) {
      alert("Solo podés editar tus propias oraciones.");
      return;
    }

    const nuevoTexto = prompt("Editar oración:", data.texto || "");
    if (nuevoTexto == null) return;

    const limpio = String(nuevoTexto || "").trim();
    if (!limpio) {
      alert("La oración no puede quedar vacía.");
      return;
    }

    const paths = devOracionPaths(uidOwner, tsKey, comentId);

    const dataActualizadaBase = {
      ...data,
      autorUid: data.autorUid || uid,
      texto: limpio,
      editado: Date.now()
    };

    const targets = [
      {
        path: paths.privadaItem,
        data: dataActualizadaBase
      },
      {
        path: paths.miaItem,
        data: {
          ...dataActualizadaBase,
          uidOwner: String(uidOwner || ""),
          tsKey: Number(tsKey || 0)
        }
      },
      dataActualizadaBase.publica === true ? {
        path: paths.publicaItem,
        data: {
          ...dataActualizadaBase,
          uidOwner: String(uidOwner || ""),
          tsKey: Number(tsKey || 0)
        }
      } : null
    ].filter(x => x && x.path);

    const res = await Promise.allSettled(
      targets.map(t => set(ref(db, t.path), t.data))
    );

    const algunoOk = res.some(r => r.status === "fulfilled");

    if (!algunoOk) {
      throw res.find(r => r.status === "rejected")?.reason || new Error("No se pudo editar.");
    }

    if (typeof devToast === "function") {
      devToast("✏️ Oración actualizada");
    }

    // ✅ No abrimos modal después de editar.
    // Volvemos a la pantalla normal.
    devCerrarPantallasOracion();
    devRefrescarPantallaTrasOracion();

  } catch(e){
    console.error(e);
    alert("❌ No se pudo editar.\n\nDetalle: " + (e?.message || e));
  }
};

window.devBorrarDevocional = async (uidOwner, tsKey) => {
  if (!isAdmin()) { 
    alert("Solo admin."); 
    return; 
  }

  const ok = confirm("¿Borrar este devocional?\n\nEsto elimina el registro de la Iglesia.\n\nLa imagen en R2 no se borra desde este paso.");
  if (!ok) return;

  const fb  = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api) { 
    alert("Firebase no listo."); 
    return; 
  }

  const { db } = fb;
  const { ref, remove } = api;

  try {
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

function devShareKey(url, fileName){
  return `${url}__${fileName}`;
}

window.devWarmShareImage = async function(url, fileName="devocional.png"){
  try{
    if (!url) return null;

    const key = devShareKey(url, fileName);
    const cached = window.__devShareCache.get(key);

    if (cached?.file) return cached.file;
    if (cached?.promise) return await cached.promise;

    const promise = (async ()=>{
      const blob = await fetchDevocionalBlob(url);
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
// Usa descargarImagenR2: baja ARCHIVO REAL desde R2
// =========================

const DEV_R2_DOWNLOAD_URL = R2_WORKER_URL;

function devNombreArchivoSeguro(fileName = "devocional.png"){
  return String(fileName || "devocional.png")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "devocional.png";
}

function devProxyImagenUrl(url, fileName = "devocional.png", descargar = false){
  return DEV_R2_DOWNLOAD_URL +
    "?url=" + encodeURIComponent(url) +
    "&nombre=" + encodeURIComponent(devNombreArchivoSeguro(fileName)) +
    "&descargar=" + (descargar ? "1" : "0");
}

async function fetchDevocionalBlob(url, fileName = "devocional.png"){
  if (!url) throw new Error("No hay URL de imagen");

  const proxyUrl = devProxyImagenUrl(url, fileName, false);

  const r = await fetch(proxyUrl, { cache: "no-store" });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error("No pude bajar PNG (" + r.status + ") " + txt);
  }

  const blob = await r.blob();

  if (!blob || !blob.size) {
    throw new Error("La imagen bajó vacía");
  }

  return blob;
}

function devPrecacheFeedImages(items){
  // ✅ desactivado: evitamos ensuciar consola con CORS
}

window.devDescargarImagenItem = async function(url, fileName = "devocional.png"){
  try{
    if (!url) throw new Error("No hay URL");

    fileName = devNombreArchivoSeguro(fileName);

    devBusyShow("⏳ Preparando descarga…");

    // ✅ baja ARCHIVO REAL como blob
    const blob = await fetchDevocionalBlob(url, fileName);

    const objUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);

  }catch(e){
    console.error(e);
    alert("❌ No se pudo descargar.\n\nDetalle: " + (e?.message || e));
  }finally{
    devBusyHide();
  }
};

window.devDescargarAudioItem = async function(audioUrl, baseName = "Audio_devocional"){
  try{
    if (!audioUrl) return false;

    const r = await fetch(audioUrl);
    if (!r.ok) throw new Error("No pude bajar el audio (" + r.status + ")");

    const blob = await r.blob();

    const ext =
      blob.type.includes("mpeg") ? "mp3" :
      blob.type.includes("wav")  ? "wav" :
      blob.type.includes("ogg")  ? "ogg" :
      "mp3";

    const objUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
    return true;
  }catch(e){
    console.warn("No se pudo descargar audio:", e);
    return false;
  }
};

window.devDescargarDevocionalItem = async function(url, fileName = "devocional.png", audioUrl = "", audioBaseName = "Audio_devocional"){
  try{
    await window.devDescargarImagenItem(url, fileName);

    if (audioUrl) {
      setTimeout(() => {
        window.devDescargarAudioItem(audioUrl, audioBaseName);
      }, 400);
    }
  }catch(e){
    console.error(e);
    alert("❌ No se pudo descargar el devocional.\n\nDetalle: " + (e?.message || e));
  }
};

window.devCompartirImagenItem = async function(url, fileName = "devocional.png"){
  try{
    if (!url) throw new Error("No hay URL");

    fileName = devNombreArchivoSeguro(fileName);

    devBusyShow("⏳ Preparando para compartir…");

    let file = null;

    // ✅ primero intento usar el archivo precalentado
    try {
      file = await window.devWarmShareImage?.(url, fileName);
    } catch(e) {
      file = null;
    }

    // ✅ si no estaba precalentado, bajo el archivo real ahora
    if (!file) {
      const blob = await fetchDevocionalBlob(url, fileName);
      file = new File([blob], fileName, { type: blob.type || "image/png" });
    }

    // ✅ compartir ARCHIVO REAL
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Devocional",
        files: [file]
      });
      return;
    }

    // fallback: descargar archivo real
    const objUrl = URL.createObjectURL(file);

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);

    alert("Tu navegador no permite compartir archivo directo. Se descargó la imagen para compartirla manualmente.");

  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error(e);
    alert("No pude compartir el devocional.");
  } finally {
    devBusyHide();
  }
};
