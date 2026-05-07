// devocionales.js (NUEVO LIMPIO)
// ✅ OCR + Recorte + Modal 3 fases (9:9 + 9:7 => 9:16)
// ✅ NO toca biblia.js
// ✅ Reusa modalAudio existente (si está cargado biblia.audio.js)

const OCR_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ocrDevocional";
const GH_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirAudioDevocionalGithub";
const TTS_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ttsAudio";
const R2_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirImagenR2";

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
  fuente: "Roboto",
  color: "#000000",
  opColor: "#000000",
  op: 0.35,
  size: 30,
  userChanged: false,
  style: { upper:false, bold:true, italic:false, underline:false }
},

  // fase2 (9:7) settings
  f2: {
    fondoColor: "#ffffff",
    texturaUrl: null,
    texturaOp: 0.22,
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
    contentType
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
    if (DEV.audioManualBlob) {
      info.textContent = `✅ Audio cargado: ${DEV.audioManualName || "audio finalizado"}`;
    } else if (DEV.audioOk && DEV.requiereAudio) {
      info.textContent = "✅ Audio confirmado";
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

  // ✅ solo visible si hay audio manual cargado
  if (btnDel) {
    btnDel.style.display = DEV.audioManualBlob ? "inline-flex" : "none";
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
  { nombre: "Roboto", css: "Roboto, sans-serif" },
  { nombre: "Lobster", css: "Lobster, cursive" },
  { nombre: "Playfair Display", css: "'Playfair Display', serif" },
  { nombre: "Montserrat", css: "Montserrat, sans-serif" },
  { nombre: "Poppins", css: "Poppins, sans-serif" },
  { nombre: "Abril Fatface", css: "'Abril Fatface', serif" },
  { nombre: "Cormorant", css: "Cormorant, serif" },
  { nombre: "Josefin Sans", css: "'Josefin Sans', sans-serif" },
  { nombre: "Great Vibes", css: "'Great Vibes', cursive" },

  { nombre: "Lexend", css: "Lexend, sans-serif" },
  { nombre: "Lora", css: "Lora, serif" },
  { nombre: "Caveat", css: "Caveat, cursive" },
  { nombre: "Merriweather", css: "Merriweather, serif" },

  { nombre: "Arial", css: "Arial, sans-serif" },
  { nombre: "Arial Black", css: "'Arial Black', Arial, sans-serif" },
  { nombre: "Verdana", css: "Verdana, sans-serif" },
  { nombre: "Trebuchet MS", css: "'Trebuchet MS', sans-serif" },
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

  const fondos = fondosCategorias[devF1CategoriaActual] || [];

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
   { nombre: "Adorno 14", url: "./img/ornamentos/O1.png" },
  { nombre: "Adorno 15", url: "./img/ornamentos/O2.png" },
  { nombre: "Adorno 16", url: "./img/ornamentos/O3.png" },
  { nombre: "Adorno 17", url: "./img/ornamentos/O4.png" },
  { nombre: "Adorno 18", url: "./img/ornamentos/O5.png" },
  { nombre: "Adorno 19", url: "./img/ornamentos/O6.png" },
  { nombre: "Adorno 20", url: "./img/ornamentos/O7.png" },
  { nombre: "Adorno 21", url: "./img/ornamentos/O8.png" },
  { nombre: "Adorno 22", url: "./img/ornamentos/O9.png" },
  { nombre: "Adorno 23", url: "./img/ornamentos/O10.png" },
  { nombre: "Adorno 24", url: "./img/ornamentos/O11.png" },
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

function cargarAdornosF2(){
  const cont = $("dev2Adornos");
  if (!cont) return;

  cont.innerHTML = "";

  adornosF2.forEach(item=>{
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

    // marcar activo
    const activo = (DEV.f2.adornoUrl === item.url);
    b.classList.toggle("activo", activo);

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

function cargarTexturasF2(){
  const cont = $("dev2Texturas");
  if (!cont) return;

  cont.innerHTML = "";

  texturasF2.forEach(item=>{
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

    b.classList.toggle("activo", DEV.f2.texturaUrl === item.url);

    b.onclick = ()=>{
      DEV.f2.texturaUrl = item.url;
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
    -3px 0 ${oc},
     3px 0 ${oc},
     0 -3px ${oc},
     0  3px ${oc},
    -2px -2px ${oc},
     2px -2px ${oc},
    -2px  2px ${oc},
     2px  2px ${oc},
     0 0 4px ${oc}
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

  const a1 = Math.min(0.48, x * 1.05);
  const a2 = Math.min(0.28, x * 0.72);
  const a3 = Math.min(0.18, x * 0.42);

  return `
    0 0 22px rgba(${r}, ${g}, ${b}, ${a1}),
    0 0 48px rgba(${r}, ${g}, ${b}, ${a2}),
    0 0 80px rgba(${r}, ${g}, ${b}, ${a3})
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
        padding: 4px 18px 0;
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
          word-break:break-word;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
        ">
          <div style="width:100%;">Reflexión: ${esc(ref)}</div>
          ${ora ? `<div style="width:100%; margin-top:6px;">Oración: ${esc(ora)}</div>` : ``}
        </div>
      </div>

      <!-- ✅ ADORNO: fijo abajo, no empuja ni corta el texto -->
            ${adorno ? `
        <div style="
          flex:0 0 auto;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding: 0 0 4px;
          box-sizing:border-box;
          pointer-events:none;
        ">
          <img
            src="${adorno}"
            alt="adorno"
            style="
              width:${adornoW}%;
              max-height:86px;
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

function devRenderFase(fase){
  if (fase === 1) {
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
    t.style.textShadow = textShadowLegible(st.color);
    t.style.webkitTextStroke = "0px";
    t.style.paintOrder = "normal";

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

  const pxPreview = Math.max(8, (st.size * scalePreviewF2()));
  t.innerHTML = buildFase2HTML(pxPreview);

  if (b) b.style.display = "none";

  // =========================
  // base del preview
  // =========================
  p.style.position = "relative";
  p.style.backgroundColor = st.fondoColor || "#ffffff";
  p.style.backgroundImage = "none";
  p.style.backgroundBlendMode = "normal";
  p.style.backgroundSize = "";
  p.style.backgroundPosition = "";
  p.style.backgroundRepeat = "";

  // =========================
  // textura en capa separada
  // =========================
  const layer = ensureDev2TextureLayer(p);

  if (layer) {
    const op = Math.max(0, Math.min(1, Number(st.texturaOp ?? 0.22)));

if (st.texturaUrl) {
  layer.style.display = "block";
  layer.style.backgroundImage = `url("${st.texturaUrl}")`;
  layer.style.opacity = String(op);
  layer.style.mixBlendMode = "normal";
  layer.style.filter = "none";
} else {
  layer.style.display = "none";
  layer.style.backgroundImage = "none";
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
  t.style.textShadow = textShadowLegible(st.color);
  t.style.webkitTextStroke = "0px";
  t.style.paintOrder = "normal";

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
    wrap.style.borderRadius = "14px";
    wrap.style.overflow = "hidden";
    wrap.style.backgroundColor = wrapperBgFromOpacity(st.op, st.opColor);
    wrap.style.boxShadow = wrapperShadowFromOpacity(st.op, st.opColor);

    const texto = document.createElement("div");
    texto.style.position = "absolute";
    texto.style.inset = "0";
    texto.style.fontFamily = st.fuente;
    texto.style.color = st.color;
    applyTextStylesToOne(texto, st);

    texto.style.textShadow = textShadowLegibleFinal(st.color);
    texto.style.webkitTextStroke = "0.6px " + outlineColor(st.color);
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
    node.style.backgroundColor = st.fondoColor || "#ffffff";

    if (st.texturaUrl) {
      const textureLayer = document.createElement("div");
      textureLayer.style.position = "absolute";
      textureLayer.style.inset = "0";
      textureLayer.style.backgroundImage = `url("${st.texturaUrl}")`;
      textureLayer.style.backgroundSize = "cover";
      textureLayer.style.backgroundPosition = "center";
      textureLayer.style.backgroundRepeat = "no-repeat";
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

    texto.style.textShadow = textShadowLegibleFinal(st.color);
    texto.style.webkitTextStroke = "0.5px " + outlineColor(st.color);
    texto.style.paintOrder = "stroke fill";
    texto.innerHTML = buildFase2HTML(Math.max(12, roundToHalf(st.size * 1.12)));

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

  // reset audio solo si NO venimos con audio manual cargado
  if (!DEV.audioManualBlob) {
    DEV.audioOk = false;
  }

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
  devEnsureFase3Opciones();

     const btnFinal = $("devBtnFinalizar");
  if (btnFinal) {
    btnFinal.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Publicar y compartir`;
    btnFinal.title = "Publicar y compartir";
  }
   
  devSetFinalButtons(DEV.requiereAudio ? false : true);

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

      devRenderFase(1);
    });
  });

// =========================
// FASE 2 (color plano) - tamaño / color (SIN opacidad)
// =========================
["Tamano","Color","TexturaOp"].forEach(k=>{
  const el = $(`dev2${k}`);
  if (!el) return;

  el.addEventListener("input", ()=>{
    DEV.f2.userChanged = true;

    DEV.f2.size = Number($("dev2Tamano")?.value || 26);
    DEV.f2.color = $("dev2Color")?.value || "#000000";
    DEV.f2.texturaOp = Number($("dev2TexturaOp")?.value || 0.22);

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

    // ✅ NO renderizar acá: ya debía quedar preparado al entrar a fase 3
    if (!file || !canvas) {
      alert("Todavía se está preparando la imagen. Esperá un instante y tocá compartir otra vez.");
      return;
    }

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Devocional"
      });
    } else {
      await devDescargarImagenSolo(canvas);
      alert("Tu dispositivo o navegador no permite compartir directo. Se descargó la imagen para compartirla manualmente.");
    }
  } catch (e) {
    console.warn("Share cancelado o falló:", e);

    if (window.__devFinalCanvas) {
      await devDescargarImagenSolo(window.__devFinalCanvas);
    } else {
      alert("❌ No se pudo compartir.\n\nDetalle: " + (e?.message || e));
    }
  }
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
        alert("No hay texto para audio.");
        return;
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
        alert("No pude generar el audio automáticamente.");
        return;
      }

      const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });

      pack = { base64: data.audioBase64, blob };
    }

    // 4) subir a GitHub opcional
    let gh = null;
    if (DEV.subirAudioGithub) {
      try {
        gh = await subirAudioAGithubDesdeWeb(pack.base64);
        DEV.audioGithubUrl = gh.url || "";
      } catch (e) {
        console.warn("GitHub upload falló:", e);
        alert("⚠️ No pude subir a GitHub, pero igual te lo descargo.\n\nDetalle: " + (e?.message || e));
      }
    } else {
      DEV.audioGithubUrl = "";
    }

    // 5) descargar local siempre
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

    DEV.audioOk = true;
    devSetFinalButtons(true);
    devUpdateAudioManualUI();

    if (gh?.url) {
      alert("✅ Audio subido a GitHub y descargado.\n\nURL:\n" + gh.url);
    } else {
      alert("✅ Audio descargado.");
    }

  } catch (e) {
    console.error(e);
    alert("❌ No se pudo descargar/subir el audio.\n\nDetalle: " + (e?.message || e));
  } finally {
    devBusyHide();
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
    "1) Sube el audio a GitHub si está tildado.\n" +
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

    // ✅ subir audio a GitHub solo si corresponde
    if (DEV.requiereAudio && DEV.subirAudioGithub && !DEV.audioGithubUrl) {
      devBusyShow("⏳ Subiendo audio a GitHub…");

      await window.devDescargarFinal();

      if (!DEV.audioGithubUrl) {
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

    devToast("✅ Publicado. Abriendo compartir…");

    // ✅ último paso: abrir compartir en redes
    await window.devCompartirFinal();

    // ✅ recién cerramos todo después de compartir/cancelar
    devCerrarTodo();

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

  const ta = document.getElementById("devOracionTexto");
  const chk = document.getElementById("devOracionPublica");
  const color = document.getElementById("devOracionColor");

  if (ta) ta.value = "";
  if (chk) chk.checked = true;
  if (color) color.value = "#fff4b8";

  devPrivacidadLabel();
  abrirModal("modalDevOracion");

  setTimeout(()=>{
    if (typeof window.initPickrEnHosts === "function") {
      window.initPickrEnHosts("#devOracionColorHost");
    }
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
  const color = document.getElementById("devOracionColor")?.value || "#fff4b8";

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
    const baseRef = ref(
      db,
      `devocionalesOraciones/${DEV.oracionDevOwner}/${DEV.oracionDevTs}`
    );

    const newRef = push(baseRef);

      await set(newRef, {
      autorUid: uid,
      texto,
      publica,
      destacado: false,
      color,
      fecha: Date.now()
    });

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
    alert("Tenés que estar logueado.");
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

function renderDevFeed(items){
  const feed = $("devFeed");
  if (!feed) return;
  feed.innerHTML = "";

  const esAdmin = isAdmin();
  devPrecacheFeedImages(items);

  items.forEach((it)=>{
    const card = document.createElement("div");
    card.className = "devBigCard";
    card.id = "devBig_" + it.id;
    card.style.position = "relative";

    const yaGuardado = devYaGuardadoEnPanel(it);

    const saveBtnHtml = `
      <button class="btn-primary ${yaGuardado ? "guardado" : ""}" type="button"
        data-dev-save="${it.id}"
        onclick="devGuardarPublicadoEnMiPanel('${it.id}')"
        aria-label="${yaGuardado ? "Guardado en Mi Panel" : "Guardar en Mi Panel"}"
        title="${yaGuardado ? "Ya guardado en Mi Panel" : "Guardar en Mi Panel"}"
        ${yaGuardado ? "disabled" : ""}>
        <i class="fa-solid ${yaGuardado ? "fa-heart-circle-check" : "fa-heart-circle-plus"}"></i>
      </button>
    `;

    const audioHtml = it.audioGithubUrl
      ? `
        <div class="devAudioBox">
          <audio controls preload="none" src="${it.audioGithubUrl}"></audio>
        </div>
      `
      : ``;

    const deleteTopBtnHtml = esAdmin ? `
      <button class="btn-primary devDanger devDeleteTopBtn" type="button"
       onclick="devBorrarDevocional('${it.uidOwner || ""}','${it.tsKey || 0}')"
        aria-label="Borrar"
        title="Borrar">
        <i class="fa-solid fa-trash"></i>
      </button>
    ` : ``;

    card.innerHTML = `
      ${deleteTopBtnHtml}

      <img src="${it.url || ""}" alt="dev grande">

      ${audioHtml}

      <div class="devBigActions">
        <button class="btn-primary" type="button"
          onclick="devAbrirModalOracion('${it.uidOwner || ""}', '${it.tsKey || 0}')"
          aria-label="Adjuntar oración"
          title="Adjuntar oración">
          🙏
        </button>

        <button class="btn-primary" type="button"
  onclick="devAbrirListaOraciones('${it.uidOwner || ""}', '${it.tsKey || 0}')"
  aria-label="Ver oraciones"
  title="Ver oraciones">
  <i class="fa-solid fa-receipt"></i>
</button>

        ${saveBtnHtml}

       <button class="btn-primary" type="button"
  onpointerdown="devWarmShareImage('${it.url || ""}', 'devocional.png')"
  ontouchstart="devWarmShareImage('${it.url || ""}', 'devocional.png')"
  onclick="devCompartirImagenItem('${it.url || ""}', 'devocional.png')"
  aria-label="Compartir"
  title="Compartir">
  <i class="fa-solid fa-share-nodes"></i>
</button>

        <button class="btn-primary" type="button"
        onclick="devDescargarDevocionalItem('${it.url || ""}', 'devocional.png', '${it.audioGithubUrl || ""}', 'Audio_devocional')"
          aria-label="Descargar PNG">
          <i class="fa-solid fa-download"></i>
        </button>
      </div>
    `;

    feed.appendChild(card);
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

  const { db } = fb;
  const { ref, get } = api;

  try{
    const basePath = `devocionalesOraciones/${uidOwner}/${tsKey}`;
    const baseSnap = await get(ref(db, basePath));
    const raw = baseSnap.val() || {};

    const entries = Object.entries(raw);
    if (!entries.length) {
      box.innerHTML = `<div style="text-align:center; opacity:.6;">Sin oraciones todavía</div>`;
      return;
    }

    const visibles = entries
      .map(([id, it]) => ({ id, ...(it || {}) }))
      .filter(it => it.publica === true || (uid && it.autorUid === uid))
      .sort((a,b)=>(b.fecha||0)-(a.fecha||0));

    if (!visibles.length){
      box.innerHTML = `<div style="text-align:center; opacity:.6;">No hay oraciones visibles para vos</div>`;
      return;
    }

    box.innerHTML = visibles.map(it=>{
      const soyYo = uid && it.autorUid === uid;
      const autorTxt = soyYo ? "Tú" : (it.publica ? "Anónimo" : "Privada");
      const fondo = it.color || "#f5f5f5";
      const fechaTxt = it.fecha ? fmtFecha(it.fecha) : "";

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
            <span>${autorTxt}</span>
            <span>${fechaTxt}</span>
          </div>

          <div style="
            white-space:pre-wrap;
            line-height:1.45;
            word-break:break-word;
          ">${(it.texto || "")
            .replace(/&/g,"&amp;")
            .replace(/</g,"&lt;")
            .replace(/>/g,"&gt;")
          }</div>

          ${soyYo ? `
            <div style="
              display:flex;
              justify-content:flex-end;
              gap:8px;
            ">
              <button class="btn-primary" type="button"
                onclick="devEditarOracionPropia('${uidOwner}','${tsKey}','${it.id}')">
                Editar
              </button>

              <button class="btn-primary devDanger" type="button"
                onclick="devBorrarOracionPropia('${uidOwner}','${tsKey}','${it.id}')">
                Borrar
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

window.devBorrarOracionPropia = async function(uidOwner, tsKey, comentId){
  const fb = window.__FB;
  const api = window.__FB_API;

  if (!fb || !api) {
    alert("Firebase no listo.");
    return;
  }

  const ok = confirm("¿Borrar esta oración?");
  if (!ok) return;

  const { db } = fb;
  const { ref, remove } = api;

  try{
    await remove(ref(db, `devocionalesOraciones/${uidOwner}/${tsKey}/${comentId}`));
    if (typeof devToast === "function") devToast("🗑 Oración borrada");
    await window.devAbrirListaOraciones(uidOwner, tsKey);
  } catch(e){
    console.error(e);
    alert("❌ No se pudo borrar.\n\nDetalle: " + (e?.message || e));
  }
};

window.devEditarOracionPropia = async function(uidOwner, tsKey, comentId){
  const fb = window.__FB;
  const api = window.__FB_API;

  if (!fb || !api) {
    alert("Firebase no listo.");
    return;
  }

  const { db } = fb;
  const { ref, get, update } = api;

  try{
    const snap = await get(ref(db, `devocionalesOraciones/${uidOwner}/${tsKey}/${comentId}`));
    const data = snap.val();

    if (!data) {
      alert("No encontré la oración.");
      return;
    }

    const nuevoTexto = prompt("Editar oración:", data.texto || "");
    if (nuevoTexto == null) return;

    const limpio = String(nuevoTexto || "").trim();
    if (!limpio) {
      alert("La oración no puede quedar vacía.");
      return;
    }

    await update(ref(db, `devocionalesOraciones/${uidOwner}/${tsKey}/${comentId}`), {
      texto: limpio
    });

    if (typeof devToast === "function") devToast("✏️ Oración actualizada");
    await window.devAbrirListaOraciones(uidOwner, tsKey);
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
// =========================
async function fetchDevocionalBlob(url){
  if (!url) throw new Error("No hay URL de imagen");

  const proxyUrl =
    "https://us-central1-vidaabundante-f118a.cloudfunctions.net/devocionalR2Proxy" +
    "?url=" + encodeURIComponent(url) +
    "&name=" + encodeURIComponent("devocional.png");

  const r = await fetch(proxyUrl);
  if (!r.ok) throw new Error("No pude bajar PNG (" + r.status + ")");
  return await r.blob();
}

function devPrecacheFeedImages(items){
  // ✅ desactivado: el fetch a R2 da error CORS y ensucia consola
}

window.devDescargarImagenItem = async function(url, fileName="devocional.png"){
  try{
    if (!url) throw new Error("No hay URL");

    devBusyShow("⏳ Preparando descarga…");

    const blob = await fetchDevocionalBlob(url);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  }catch(e){
    console.warn("No se pudo descargar audio:", e);
    return false;
  }
};

window.devDescargarDevocionalItem = async function(url, fileName="devocional.png", audioUrl="", audioBaseName="Audio_devocional"){
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

window.devCompartirImagenItem = async function(url, fileName="devocional.png"){
  try{
    if (!url) throw new Error("No hay URL");

    // ✅ usar tu proxy (IMPORTANTE)
    const proxyUrl =
      "https://us-central1-vidaabundante-f118a.cloudfunctions.net/devocionalR2Proxy" +
      "?url=" + encodeURIComponent(url) +
      "&name=" + encodeURIComponent(fileName);

    const r = await fetch(proxyUrl);
    if (!r.ok) throw new Error("No pude bajar la imagen (" + r.status + ")");

    const blob = await r.blob();
    const file = new File([blob], fileName, { type: blob.type || "image/png" });

    // ✅ intento compartir archivo REAL
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Devocional",
        files: [file]
      });
      return;
    }

    // ❌ fallback si el navegador no soporta compartir archivos
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

  } catch(e){
    console.error(e);
    alert("❌ No se pudo compartir.\n\nDetalle: " + (e?.message || e));
  }
};
