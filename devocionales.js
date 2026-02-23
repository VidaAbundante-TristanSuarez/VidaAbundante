// devocionales.js (NUEVO LIMPIO)
// ✅ OCR + Recorte + Modal 3 fases (9:9 + 9:7 => 9:16)
// ✅ NO toca biblia.js
// ✅ Reusa modalAudio existente (si está cargado biblia.audio.js)

const OCR_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ocrDevocional";

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
  bloque1: "",  // Devocional + Fecha + Versículo + Cita + Iglesia + Dirección
  bloque2: "",  // Reflexión + Oración
  audioText: "",
  p1: null,   // {fecha,versiculo,cita,iglesia,direccion}
  p2: null,   // {reflexion,oracion}
   
  // fase1 (9:9) settings
  f1: {
    fondoUrl: null,
    fondoBlob: null,
    fuente: "Roboto",
    color: "#000000",
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
  userChanged: false, // ✅ AGREGAR ESTO
  style: { upper:false, bold:false, italic:false, underline:false }
},

  // audio gate
  audioOk: false,

  // final image
  finalDataUrl: ""
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

function buildAudioFromParts(p1, p2){
  // Acá definimos los ÚNICOS saltos de línea permitidos
  const reflex = oneLine(p2?.reflexion || "");
  const orac  = oneLine(p2?.oracion || "");

  return [
    "DEVOCIONAL",
    oneLine(p1?.fecha || ""),
    "", // 👈 1 salto de línea (línea en blanco)
    oneLine(p1?.versiculo || ""),
    oneLine(p1?.cita || ""),
    oneLine(p1?.iglesia || ""),
    oneLine(p1?.direccion || ""),
    "",
    // FASE 2: Sin salto entre “Reflexión” y “Oración”
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

  const letters = onlyLetters(s);
  if (letters.length < 6) return false;

  let upper = 0;
  for (const ch of letters) if (ch === ch.toUpperCase()) upper++;
  const ratio = upper / letters.length;
  return ratio >= 0.85; // bastante estricto
}

function stripTailLogoJunk(lines){
  const out = lines.slice();
  while (out.length && isLogoJunk(out[out.length - 1])) out.pop();
  return out;
}

function isLogoJunk(line){
  const s = (line || "").trim();

  if (!s) return true;

  const onlyLetters = s.replace(/[^A-Za-zÁÉÍÓÚÜÑ]/g, "");

  // ✅ REGLA NUEVA:
  // Si está en mayúsculas y tiene menos de 15 letras → basura
  if (onlyLetters.length > 0 &&
      onlyLetters === onlyLetters.toUpperCase() &&
      onlyLetters.length < 15) {
    return true;
  }

  // basura típica conocida
  const up = s.toUpperCase();

  return (
    up === "ANA" ||
    up === "DE" ||
    up === "DE LA" ||
    up === "VIDA" ||
    up === "VIDA ABUNDANTE" ||
    up === "DE LA VIDA ABUNDANTE"
  );
}

function findOracionLineIndex(lines){
  // acepta viñetas variadas y con/sin acento
  return lines.findIndex(l => /^(\s*[-•◾▪●]?\s*)?oraci[oó]n\b/i.test((l || "").trim()));
}

function cleanOracionHeader(line){
  return (line || "")
    .replace(/^(\s*[-•◾▪●]?\s*)?oraci[oó]n\s*:?\s*/i, "")
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
  const versiculo = verseLines.length ? verseLines.join(" ") : (body.join(" ") || "(Versículo)");

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
   4) MODALES (abrir/cerrar)
   ========================================================= */
function abrirModal(id){
  const m = $(id);
  if (!m) return;
  m.classList.add("abierto");
  m.style.display = "flex";
  m.setAttribute("aria-hidden","false");
}

function cerrarModal(id){
  const m = $(id);
  if (!m) return;
  m.classList.remove("abierto");
  m.style.display = "none";
  m.setAttribute("aria-hidden","true");
}

window.devCerrarTodo = () => {
  cerrarModal("modalDevFase1");
  cerrarModal("modalDevFase2");
  cerrarModal("modalDevFase3");
  DEV.audioOk = false;
  devSetFinalButtons(false);
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
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
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
  el.style.textTransform = st.style.upper ? "uppercase" : "none";
  el.style.fontWeight    = st.style.bold ? "700" : "400";
  el.style.fontStyle     = st.style.italic ? "italic" : "normal";
  el.style.textDecoration= st.style.underline ? "underline" : "none";
}

function wrapperBgFromOpacity(op){
  const x = parseFloat(op);
  if (isNaN(x)) return "rgba(0,0,0,0)";
  if (x > 0.5) {
    const a = Math.min(0.70, (x - 0.5) * 2);
    return `rgba(0,0,0,${a})`;
  } else if (x < 0.5) {
    const a = Math.min(0.70, (0.5 - x) * 2);
    return `rgba(255,255,255,${a})`;
  }
  return "rgba(0,0,0,0)";
}

function esc(s){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
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

// ✅ Sugerencia REAL: mide el preview y busca el mayor tamaño que entre
function sugerirTamanoVersiculoAuto(versiculo){
  const wWrap = $("dev1TextoWrapper");
  if (!wWrap) return 18;

  const rect = wWrap.getBoundingClientRect();
  const maxW = Math.max(100, rect.width * 0.92);

  // ✅ más espacio para versículo
  const altoDisponible = Math.max(80, rect.height * 0.62);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // ✅ probamos de grande a chico (UNA SOLA VEZ)
  const MAX_PX = 42;
  const MIN_PX = 9;

  for (let px = MAX_PX; px >= MIN_PX; px--) {
    ctx.font = `700 ${px}px ${DEV.f1.fuente}, Arial`;
    const lines = wrapMeasureLines(ctx, oneLine(versiculo), maxW);
    const lineH = px * 1.18;
    const totalH = lines.length * lineH;

    if (totalH <= altoDisponible) {
    const sc = scalePreviewF1() || 1;
    return Math.round(px / sc); // ✅ devuelve tamaño de canvas
}
  }

 return Math.round(MIN_PX / (scalePreviewF1() || 1));
}

function sugerirTamanoFase2Auto(texto){
  const wWrap = $("dev2TextoWrapper");
  if (!wWrap) return 16;

  const rect = wWrap.getBoundingClientRect();
  const maxW = Math.max(100, rect.width * 0.92);
  const altoDisponible = Math.max(80, rect.height * 0.82);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const maxPx = 18;
  const minPx = 9;

  for (let px = maxPx; px >= minPx; px -= 0.5) {
    ctx.font = `600 ${px}px ${DEV.f2.fuente}, Arial`;
    const lines = wrapMeasureLines(ctx, oneLine(texto), maxW);
    const lineH = px * 1.20;
    const totalH = lines.length * lineH;
    if (totalH <= altoDisponible) {
  const sc = scalePreviewF2() || 1;
  return roundToHalf(px / sc);
}
  }
  return roundToHalf(minPx / (scalePreviewF2() || 1));
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
  const Y_DEV   = 2;     // DEVOCIONAL
  const Y_FECHA = 7;   // ✅ más cerca (antes quedaba muy separado)

  // Abajo (pie)
  const Y_IGL   = 88;   // iglesia
  const Y_DIR   = 94; // dirección casi pegada al borde

  // Caja central (versículo + cita) MÁS GRANDE
  const Y_VBOX  = 16;    // empieza
  const H_VBOX  = 66;    // ✅ más alto (antes era chico)

  return `
    <div style="position:relative; width:100%; height:100%;">

      <div style="${base(devocionalPx,700)} top:${Y_DEV}%;">
        DEVOCIONAL
      </div>

      <div style="${base(fechaPx,400)} top:${Y_FECHA}%; opacity:.95;">
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
          gap:6px;                 /* ✅ espacio corto entre versículo y cita */
          line-height:1.08;
        ">
          <div style="
            font-size:${versiculoPx}px;
            font-weight:${DEV.f1.style.bold ? 700 : 400};
            width:100%;
            white-space:normal;
            word-break:break-word;
          ">
            ${esc(p1.versiculo)}
          </div>

          <div style="
            font-size:${citaPx}px;
            font-weight:${DEV.f1.style.bold ? 700 : 400};
            width:100%;
            white-space:normal;
            word-break:break-word;
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

  const txt = `Reflexión: ${oneLine(p2.reflexion || "")}\nOración: ${oneLine(p2.oracion || "")}`;

  const fw = DEV.f2.style.bold ? 700 : 400;

  return `
    <div style="
      width:100%;
      text-align:center;
      display:flex;
      align-items:center;
      justify-content:center;
      height:100%;
    ">
      <div style="
        font-size:${basePx}px;
        font-weight:${fw};
        white-space:pre-line;
        line-height:1.25;
        max-width:95%;
      ">
        ${esc(txt)}
      </div>
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
    w.style.backgroundColor = wrapperBgFromOpacity(st.op);

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

/* =========================================================
   8) FINAL 9:16 — CAPTURA REAL (COMO BIBLIA)
   ========================================================= */
function setFinalCanvasDisabled(disabled){
  ["devBtnDescargar","devBtnCompartir","devBtnIglesia","devBtnFinalizar"].forEach(id=>{
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
    wrap.style.backgroundColor = wrapperBgFromOpacity(st.op);

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

  // ✅ WRAPPER igual al modal: margen uniforme (inset 12px) + centrado real
  const wrap = document.createElement("div");
  wrap.style.position = "absolute";
  wrap.style.inset = "6px 12px 12px 12px";            
  wrap.style.overflow = "hidden";
  wrap.style.display = "flex";
  wrap.style.alignItems = "flex-start";      // ✅ empieza arriba
  wrap.style.justifyContent = "center";      // ✅ centrado horizontal
  wrap.style.paddingTop = "14px";            // ✅ un poquito de aire arriba
  wrap.style.textAlign = "center";

  // ✅ TEXTO adentro del wrapper
  const texto = document.createElement("div");
  texto.style.width = "100%";
  texto.style.display = "block";
  texto.style.textAlign = "center";
  texto.style.alignItems = "center";
  texto.style.justifyContent = "center";
  texto.style.fontFamily = st.fuente;
  texto.style.color = st.color;
  applyTextStylesToOne(texto, st);
     
  // ✅ OUTLINE estable
  texto.style.textShadow = textShadowLegibleFinal(st.color);
  texto.style.webkitTextStroke = "0px";
  texto.style.paintOrder = "normal";

  // ✅ tamaño real (canvas)
  texto.innerHTML = buildFase2HTML(st.size);

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

  DEV.finalDataUrl = cFinal.toDataURL("image/png");
  const img = $("devFinalImg");
  if (img) img.src = DEV.finalDataUrl;

  return cFinal;
}

/* =========================================================
   9) NAV fases
   ========================================================= */
window.devIrFase2 = () => {
  devRenderFase(1);

  cerrarModal("modalDevFase1");
  abrirModal("modalDevFase2");

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
  ["Opacidad","Tamano","Color"].forEach(k=>{
    const el = $(`dev1${k}`);
    if (!el) return;

    el.addEventListener("input", ()=>{
      // opacidad y color siempre desde los inputs
      DEV.f1.op = Number($("dev1Opacidad")?.value || 0.35);
      DEV.f1.color = $("dev1Color")?.value || "#000000";

      // tamaño SIEMPRE desde el slider (el usuario lo mueve)
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
    devRenderFase(2);
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
    m.style.display = "flex";
    m.setAttribute("aria-hidden","false");
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
    const visible = m3 && m3.style.display !== "none" && m3.classList.contains("abierto");
    if (visible) {
      DEV.audioOk = true;
      devSetFinalButtons(true);
    }
    return r;
  };
}

/* =========================================================
   12) BOTONES FINALES (descargar / compartir / iglesia / finalizar)
   ========================================================= */
async function devDescargarAudioSiExiste(){
  // 1) probamos encontrar un <audio> típico del modal
  const audioEl =
    document.querySelector("#modalAudio audio") ||
    document.querySelector("audio#audioPreview") ||
    document.querySelector("audio");

  const src = audioEl?.currentSrc || audioEl?.src || "";
  if (!src) return false;

  try{
    // Si es blob: o url normal, intentamos fetch para bajarlo
    const r = await fetch(src);
    const blob = await r.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "devocional_audio.mp3"; // si fuera wav/ogg igual se baja (nombre es solo nombre)
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

window.devDescargarFinal = async () => {
  const c = await renderFinalCanvasCaptureReal();
  if (!c) return;

  // ✅ 1) imagen
  const link = document.createElement("a");
  link.href = c.toDataURL("image/png");
  link.download = "devocional.png";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // ✅ 2) audio (si existe)
  const okAudio = await devDescargarAudioSiExiste();
  if (!okAudio) {
    alert("Se descargó la imagen ✅\n\nEl audio no se pudo descargar automáticamente.\nPrimero generá/confirmá el audio en el modal y volvé a intentar.");
  }
};

window.devCompartirFinal = async () => {
  const c = await renderFinalCanvasCaptureReal();
  if (!c) return;

  c.toBlob(async (blob)=>{
    if (!blob) return devDescargarFinal();

    const file = new File([blob], "devocional.png", { type:"image/png" });

    try{
      if (navigator.share && navigator.canShare?.({ files:[file] })) {
        await navigator.share({ files:[file], title:"Devocional" });
      } else {
        await devDescargarFinal();
        alert("Tu dispositivo no permite compartir directo. Se descargó la imagen.");
      }
    }catch(e){
      console.warn(e);
      await devDescargarFinal();
    }
  }, "image/png");
};

// Compartir a Iglesia (sube a Firebase si existe window.__FB)
window.devCompartirIglesia = async () => {
  const fb = window.__FB;
  const api = window.__FB_API;
  if (!fb || !api || !window.__UID) {
    alert("No encuentro Firebase listo. Asegurate que biblia.js cargó y que estás logueado.");
    return;
  }

  const c = await renderFinalCanvasCaptureReal();
  if (!c) return;

  const uid = window.__UID;
  const ts = Date.now();
  const fileName = `devocional_${ts}.png`;

  const storagePath = `devocionales_iglesia/${uid}/${fileName}`;
  const dbPath = `devocionalesIglesia/${uid}/${ts}`;

  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) return;

  try{
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
      // si querés guardar estado de audio confirmado:
      audioOk: !!DEV.audioOk
    });

    alert("✅ Devocional compartido en Iglesia");
  }catch(e){
    console.error(e);
    alert("❌ No se pudo compartir en Iglesia");
  }
};

window.devFinalizar = () => {
  const ok = confirm("¿Finalizar devocional?\n\nOK = cerrar y volver\nCancelar = seguir editando");
  if (!ok) return;
  devCerrarTodo();
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

  // fuentes/listas y fondos
  crearListaFuentes(1);
  crearListaFuentes(2);
  cargarFondosDev();

  // estado inicial
  btnRecortar.disabled = true;
  btnRecortar.style.opacity = "0.6";
  syncBtnCrear();
  ta.addEventListener("input", syncBtnCrear);
  ocrSetStatus("✅ Cargá una imagen, recortá si querés y tocá OCR.");

  // cargar imagen
  input.addEventListener("change", ()=>{
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = ()=>{
      DEV.img = image;

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

// abrir fase 1 primero (para poder medir tamaño real)
abrirModal("modalDevFase1");

// render inicial rápido
devRenderFase(1);

// ✅ esperar 1 frame para que el layout tenga tamaño real
requestAnimationFrame(()=>{
  const sugerido = sugerirTamanoVersiculoAuto(p1.versiculo);

  DEV.f1.size = sugerido;

  const s1 = $("dev1Tamano");
  if (s1) s1.value = String(sugerido);

  // re-render con tamaño sugerido ya aplicado
  devRenderFase(1);
});
  });
}

} // ✅ CIERRA initDevocionales()   
/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", initDevocionales);
