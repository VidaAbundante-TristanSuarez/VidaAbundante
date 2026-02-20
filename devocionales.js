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
   3) PARSEO DE TEXTO OCR (tus reglas)
   ========================================================= */
function normText(t){
  return String(t || "")
    .replace(/\r/g,"")
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function findOracionIndex(lines){
  return lines.findIndex(l => /oraci[oó]n/i.test(l));
}

function detectCita(line){
  // intenta detectar referencias típicas: "Mateo 19:13-14", "MATEO 19:13–14", "Jn 3:16", etc.
  const s = (line || "").trim();
  return /([1-3]\s*)?[A-Za-zÁÉÍÓÚÑáéíóúñ\.]+\s+\d+\s*:\s*\d+/i.test(s);
}

function limpiarBasuraIcono(lines){
  // elimina cosas típicas del logo/iglesia repetidas por OCR
  const ban = [
    /iglesia cristiana/i,
    /vida abundante/i,
    /\broca\b/i,
    /tristan/i,
    /tristán/i
  ];
  return lines.filter(l => !ban.some(rx => rx.test(l)));
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

function isLogoJunk(line){
  const s = (line || "").trim().toUpperCase();
  // basura típica que aparece justo antes del versículo en el fondo oscuro
  return (
    s === "DE" ||
    s === "DE LA" ||
    s === "DE LA VIDA" ||
    s === "VIDA" ||
    s === "DE LA VIDA ABUNDANTE" ||
    s === "VIDA ABUNDANTE"
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
  const versiculo = verseLines.length ? verseLines.join("\n") : (body.join("\n") || "(Versículo)");

  // fase 2: reflexión y oración
  let reflexion = "";
  let oracion = "";

  // El bloque de reflexión/oración termina justo antes de verseStart
  const bodyAntesDelVerso = (verseStart >= 0) ? body.slice(0, verseStart) : body.slice();

  const idxOr = findOracionLineIndex(bodyAntesDelVerso);

  if (idxOr >= 0) {
    reflexion = bodyAntesDelVerso.slice(0, idxOr).join("\n").trim();

    const orLines = bodyAntesDelVerso.slice(idxOr);
    if (orLines.length) {
      // primera línea: quitar "◾ Oración"
      orLines[0] = cleanOracionHeader(orLines[0]);
    }
    oracion = orLines.join("\n").trim();
  } else {
    // si no encontró "Oración", todo es reflexión
    reflexion = bodyAntesDelVerso.join("\n").trim();
    oracion = "";
  }

  // Limpieza extra: a veces queda basura del logo mezclada arriba de reflexión
  reflexion = reflexion
    .split("\n")
    .filter(l => !isLogoJunk(l))
    .join("\n")
    .trim();

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
  const audioText =
`DEVOCIONAL
${p1.fecha}

${p1.versiculo}

${p1.cita}

${p1.iglesia}
${p1.direccion}

Reflexión:
${p2.reflexion || ""}

Oración:
${p2.oracion || ""}`.trim();

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
        DEV.f1.fondoUrl = finalUrl;
        DEV.f1.fondoBlob = await urlToBlobURL(finalUrl);

        cont.querySelectorAll("img").forEach(x=>x.classList.remove("activo"));
        im.classList.add("activo");

        devRenderFase(1);
      }catch(e){
        console.error(e);
        DEV.f1.fondoUrl = null;
        if (DEV.f1.fondoBlob) URL.revokeObjectURL(DEV.f1.fondoBlob);
        DEV.f1.fondoBlob = null;
        alert("Ese fondo no se puede usar (CORS). Probá otro.");
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

function applyTextStyles(front, back, st){
  const transform = st.style.upper ? "uppercase" : "none";
  const fw = st.style.bold ? "700" : "400";
  const fs = st.style.italic ? "italic" : "normal";
  const td = st.style.underline ? "underline" : "none";

  front.style.textTransform = transform;
  back.style.textTransform = transform;
  front.style.fontWeight = fw; back.style.fontWeight = fw;
  front.style.fontStyle = fs;  back.style.fontStyle = fs;
  front.style.textDecoration = td; back.style.textDecoration = td;
}

function esc(s){
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function buildFase1HTML(basePx){
  const p1 = DEV.p1;
  if (!p1) return "";

  const main = basePx;          // versículo
  const title = Math.round(main * 0.70); // -30%
  const small = Math.round(title * 0.90);// -10% sobre title
  const cita = Math.round(main * 0.90);  // -10% sobre main

  return `
    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
      <div style="font-size:${title}px; font-weight:700;">DEVOCIONAL</div>
      <div style="font-size:${small}px; opacity:.95;">${esc(p1.fecha)}</div>

      <div style="height:8px;"></div>

      <div style="font-size:${main}px; font-weight:700; white-space:pre-wrap;">${esc(p1.versiculo)}</div>
      <div style="font-size:${cita}px; font-weight:700; white-space:pre-wrap;">${esc(p1.cita)}</div>

      <div style="height:8px;"></div>

      <div style="font-size:${title}px; font-weight:700;">${esc(p1.iglesia)}</div>
      <div style="font-size:${small}px;">${esc(p1.direccion)}</div>
    </div>
  `;
}

function buildFase2HTML(basePx){
  const p2 = DEV.p2;
  if (!p2) return "";

  const head = Math.round(basePx * 1.05);

  return `
    <div style="display:flex; flex-direction:column; gap:10px; width:100%; text-align:left;">
      <div>
        <div style="font-size:${head}px; font-weight:800;">Reflexión</div>
        <div style="white-space:pre-wrap;">${esc(p2.reflexion || "")}</div>
      </div>

      <div>
        <div style="font-size:${head}px; font-weight:800;">Oración</div>
        <div style="white-space:pre-wrap;">${esc(p2.oracion || "")}</div>
      </div>
    </div>
  `;
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
    t.innerHTML = buildFase1HTML(st.size);
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
   t.style.fontSize = st.size + "px";
   t.style.color = st.color;

   // outline usando sombras (sirve con HTML interno)
   const oc = outlineColor(st.color);
   t.style.textShadow = `
  -1px 0 ${oc}, 1px 0 ${oc}, 0 -1px ${oc}, 0 1px ${oc},
  -1px -1px ${oc}, 1px 1px ${oc}, -1px 1px ${oc}, 1px -1px ${oc}`;

    // wrapper bg
    w.style.backgroundColor = wrapperBgFromOpacity(st.op);

    applyTextStyles(t,b,st);
    return;
  }

  if (fase === 2) {
    const p = $("dev2Preview");
    const w = $("dev2TextoWrapper");
    const t = $("dev2Texto");
    const b = $("dev2TextoBack");
    if (!p || !w || !t || !b) return;

    const st = DEV.f2;

    t.innerHTML = buildFase2HTML(st.size);
    if (b) b.style.display = "none";

    // fondo plano
    p.style.backgroundImage = "none";
    p.style.backgroundColor = st.fondoColor || "#ffffff";

    // fuente + tamaño + color
   t.style.fontFamily = st.fuente;
   t.style.fontSize = st.size + "px";
   t.style.color = st.color;

   // outline usando sombras (sirve con HTML interno)
   const oc = outlineColor(st.color);
   t.style.textShadow = `
  -1px 0 ${oc}, 1px 0 ${oc}, 0 -1px ${oc}, 0 1px ${oc},
  -1px -1px ${oc}, 1px 1px ${oc}, -1px 1px ${oc}, 1px -1px ${oc}`;

    w.style.backgroundColor = wrapperBgFromOpacity(st.op);

    applyTextStyles(t,b,st);
    return;
  }
}

/* =========================================================
   8) CANVAS FINAL 9:16 (1080x1920)
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

async function imgFromUrl(url){
  return await new Promise((resolve, reject)=>{
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = ()=>resolve(im);
    im.onerror = reject;
    im.src = url;
  });
}

function wrapLines(ctx, text, maxWidth){
  const words = String(text||"").split(/\s+/);
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

  // respetar saltos reales
  const byBreaks = String(text||"").split("\n");
  if (byBreaks.length > 1) {
    const out = [];
    byBreaks.forEach(par=>{
      const p = par.trim();
      if (!p) { out.push(""); return; }
      out.push(...wrapLines(ctx, p, maxWidth));
    });
    return out;
  }

  return lines;
}

function setFont(ctx, st){
  const weight = st.style.bold ? "700" : "400";
  const italic = st.style.italic ? "italic " : "";
  ctx.font = `${italic}${weight} ${st.size}px ${st.fuente}, Arial`;
}

function drawTextBlock(ctx, text, x, y, w, h, st){
  const raw = st.style.upper ? String(text||"").toUpperCase() : String(text||"");
  setFont(ctx, st);

  const lineH = Math.round(st.size * 1.25);
  const maxW = w;
  const lines = wrapLines(ctx, raw, maxW);

  // centrado vertical
  const totalH = lines.length * lineH;
  let yy = y + Math.max(0, (h - totalH) / 2) + lineH;

  const fill = st.color;
  const stroke = outlineColor(st.color);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const cx = x + w/2;

  lines.forEach(line=>{
    if (yy > y + h) return;
    if (!line) { yy += lineH; return; }

    // borde
    ctx.lineWidth = 2;
    ctx.strokeStyle = stroke;
    ctx.strokeText(line, cx, yy);

    // relleno
    ctx.fillStyle = fill;
    ctx.fillText(line, cx, yy);

    // underline simple
    if (st.style.underline) {
      const m = ctx.measureText(line).width;
      const ux1 = cx - m/2;
      const ux2 = cx + m/2;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ux1, yy + 6);
      ctx.lineTo(ux2, yy + 6);
      ctx.stroke();
    }

    yy += lineH;
  });
}

async function renderFinalCanvas(){
  const cFinal = $("devCanvasFinal");
  if (!cFinal) return null;

  // tamaños exactos
  const W = 1080;
  const H1 = 1080; // 9:9
  const H2 = 840;  // 9:7
  const H = 1920;  // 9:16

  cFinal.width = W;
  cFinal.height = H;

  const ctx = cFinal.getContext("2d");
  ctx.clearRect(0,0,W,H);

  // ---------- FASE 1 ----------
  // fondo imagen o blanco
  if (DEV.f1.fondoBlob || DEV.f1.fondoUrl) {
    const url = DEV.f1.fondoBlob || DEV.f1.fondoUrl;
    try{
      const im = await imgFromUrl(url);
      // cover
      const s = Math.max(W/im.width, H1/im.height);
      const dw = im.width*s, dh = im.height*s;
      const dx = (W - dw)/2, dy = (H1 - dh)/2;
      ctx.drawImage(im, dx, dy, dw, dh);
    }catch{
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,W,H1);
    }
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,W,H1);
  }

  // overlay opacidad (wrapper)
  ctx.fillStyle = wrapperBgFromOpacity(DEV.f1.op);
  ctx.fillRect(W*0.08, H1*0.08, W*0.84, H1*0.84);

  // texto
  drawTextBlock(
  ctx,
  (DEV.p1?.versiculo || "") + "\n" + (DEV.p1?.cita || ""),
  W*0.08, H1*0.08, W*0.84, H1*0.84,
  DEV.f1
);

  // ---------- FASE 2 ----------
  ctx.fillStyle = DEV.f2.fondoColor || "#ffffff";
  ctx.fillRect(0, H1, W, H2);

  ctx.fillStyle = wrapperBgFromOpacity(DEV.f2.op);
  ctx.fillRect(W*0.08, H1 + H2*0.08, W*0.84, H2*0.84);

  drawTextBlock(
  ctx,
  (DEV.p2?.reflexion || "") + "\n\n" + (DEV.p2?.oracion || ""),
  W*0.08, H1 + H2*0.08, W*0.84, H2*0.84,
  DEV.f2
);

  // a data url para preview
  DEV.finalDataUrl = cFinal.toDataURL("image/png");
  const img = $("devFinalImg");
  if (img) img.src = DEV.finalDataUrl;

  return cFinal;
}

/* =========================================================
   9) NAV fases
   ========================================================= */
window.devIrFase2 = () => {
  // render fase1 antes de pasar
  devRenderFase(1);
  cerrarModal("modalDevFase1");
  abrirModal("modalDevFase2");
  devRenderFase(2);
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

  await renderFinalCanvas();
};

/* =========================================================
   10) CONTROLES UI (sliders, size, color, fondo)
   ========================================================= */
window.devCambiarTamano = (fase, delta) => {
  const inp = $(`dev${fase}Tamano`);
  if (!inp) return;
  const cur = Number(inp.value || 24);
  const next = Math.max(10, Math.min(90, cur + delta));
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
  // fase 1
  ["Opacidad","Tamano","Color"].forEach(k=>{
    const el = $(`dev1${k}`);
    if (!el) return;
    el.addEventListener("input", ()=>{
      DEV.f1.op = Number($("dev1Opacidad")?.value || 0.35);
      DEV.f1.size = Number($("dev1Tamano")?.value || 30);
      DEV.f1.color = $("dev1Color")?.value || "#000000";
      devRenderFase(1);
    });
  });

  // fase 2
  ["Opacidad","Tamano","Color"].forEach(k=>{
    const el = $(`dev2${k}`);
    if (!el) return;
    el.addEventListener("input", ()=>{
      DEV.f2.op = Number($("dev2Opacidad")?.value || 0.15);
      DEV.f2.size = Number($("dev2Tamano")?.value || 26);
      DEV.f2.color = $("dev2Color")?.value || "#000000";
      devRenderFase(2);
    });
  });

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
  // texto para audio
  DEV.audioText = (DEV.bloque1 + "\n\n" + DEV.bloque2).trim();

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
window.devDescargarFinal = async () => {
  const c = await renderFinalCanvas();
  if (!c) return;

  const link = document.createElement("a");
  link.href = c.toDataURL("image/png");
  link.download = "devocional.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

window.devCompartirFinal = async () => {
  const c = await renderFinalCanvas();
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

  const c = await renderFinalCanvas();
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

      // reset gate audio
      DEV.audioOk = false;
      devSetFinalButtons(false);

      // set controles actuales desde inputs (por si el usuario tocó algo antes)
      DEV.f1.op = Number($("dev1Opacidad")?.value || 0.35);
      DEV.f1.size = Number($("dev1Tamano")?.value || 30);
      DEV.f1.color = $("dev1Color")?.value || "#000000";

      DEV.f2.op = Number($("dev2Opacidad")?.value || 0.15);
      DEV.f2.size = Number($("dev2Tamano")?.value || 26);
      DEV.f2.color = $("dev2Color")?.value || "#000000";
      DEV.f2.fondoColor = $("dev2Fondo")?.value || "#ffffff";

      // abrir fase 1
      abrirModal("modalDevFase1");
      devRenderFase(1);
    });
  }
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener("DOMContentLoaded", initDevocionales);
