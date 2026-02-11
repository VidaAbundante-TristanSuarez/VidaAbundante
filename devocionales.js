// devocionales.js
// ✅ Devocionales con recorte (PC + CEL) + OCR por Cloud Function (Google Vision)
// ✅ No toca biblia.js

let img = null;
let canvas, ctx;

// recorte
let start = null;
let crop = null;        // {x,y,w,h} en coords canvas
let recortando = false; // modo recorte on/off
let drawing = false;    // arrastrando ahora?

// 🔥 URL de tu Cloud Function ya desplegada
const OCR_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ocrDevocional";

function $(id) { return document.getElementById(id); }

function ocrSetStatus(msg) {
  const el = $("estadoOCRDev");
  if (el) el.textContent = msg || "";
}

function fitCanvasToImage(image, maxW = 420) {
  const scale = Math.min(1, maxW / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
}

// Dibuja imagen + overlay del recorte
function draw() {
  if (!img) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (crop) {
    ctx.save();

    // borde
    ctx.strokeStyle = "#4f6fa8";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // oscurecer afuera
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(crop.x, crop.y, crop.w, crop.h);
    ctx.fill("evenodd");

    ctx.restore();
  }
}

function normalizeRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

// coords pantalla -> coords canvas
function canvasPointFromClient(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = (clientX - r.left) * (canvas.width / r.width);
  const y = (clientY - r.top) * (canvas.height / r.height);
  return { x, y };
}

// Eventos de recorte (mouse + touch + pen)
function bindPointerCropEvents() {
  // clave cel: que no “mueva” la página al tocar el canvas
  canvas.style.touchAction = "none";

  canvas.addEventListener("pointerdown", (e) => {
    if (!recortando || !img) return;

    canvas.setPointerCapture?.(e.pointerId);

    drawing = true;
    start = canvasPointFromClient(e.clientX, e.clientY);
    crop = { x: start.x, y: start.y, w: 1, h: 1 };
    draw();

    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("pointermove", (e) => {
    if (!recortando || !img || !drawing || !start) return;

    const p = canvasPointFromClient(e.clientX, e.clientY);
    crop = normalizeRect(start, p);
    draw();

    e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    if (!recortando || !drawing) return;

    drawing = false;
    start = null;

    // si es muy chico, lo descartamos
    if (crop && (crop.w < 10 || crop.h < 10)) {
      crop = null;
      draw();
    }

    e.preventDefault?.();
  };

  canvas.addEventListener("pointerup", end, { passive: false });
  canvas.addEventListener("pointercancel", end, { passive: false });
  canvas.addEventListener("pointerleave", end, { passive: false });
}

// Devuelve blob del recorte (o toda la imagen si no recortó)
async function getCroppedBlob() {
  if (!img) return null;

  const r = (crop && crop.w > 10 && crop.h > 10)
    ? crop
    : { x: 0, y: 0, w: canvas.width, h: canvas.height };

  const out = document.createElement("canvas");
  out.width = Math.round(r.w);
  out.height = Math.round(r.h);

  const octx = out.getContext("2d");
  octx.drawImage(
    canvas,
    r.x, r.y, r.w, r.h,
    0, 0, out.width, out.height
  );

  return await new Promise(res => out.toBlob(res, "image/jpeg", 0.92));
}

// Blob -> Base64 (sin "data:image/..")
async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// INIT
document.addEventListener("DOMContentLoaded", () => {
  canvas = $("devCanvas");
  if (!canvas) return;

  ctx = canvas.getContext("2d");

  const input = $("devImg");
  const btnRecortar = $("btnDevRecortar");
  const btnOCR = $("btnDevOCR");
  const ta = $("devTexto");

  if (!input || !btnRecortar || !btnOCR || !ta) return;

  bindPointerCropEvents();
  ocrSetStatus("✅ Cargá una imagen, recortá si querés y tocá OCR.");

  // Cargar imagen
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      img = image;

      // reset recorte
      crop = null;
      start = null;
      drawing = false;
      recortando = false;
      btnRecortar.textContent = "✂️ Recortar";

      fitCanvasToImage(img, 420);
      draw();

      URL.revokeObjectURL(url);
      ocrSetStatus("✅ Imagen cargada. Podés recortar o tocar OCR.");
    };

    image.src = url;
  });

  // Toggle recorte
  btnRecortar.addEventListener("click", () => {
    if (!img) { alert("Primero cargá una imagen"); return; }

    recortando = !recortando;
    btnRecortar.textContent = recortando ? "✅ Listo (recorte)" : "✂️ Recortar";

    if (!recortando) {
      start = null;
      drawing = false;
    }
  });

  // OCR por Cloud Function
  btnOCR.addEventListener("click", async () => {
    if (!img) { alert("Primero cargá una imagen"); return; }

    ocrSetStatus("⏳ Enviando imagen al OCR…");

    try {
      const blob = await getCroppedBlob();
      if (!blob) return;

      const imageBase64 = await blobToBase64(blob);

      const r = await fetch(OCR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 })
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        ocrSetStatus("❌ Error OCR: " + (data?.error || r.status));
        return;
      }

      const text = (data?.text || "").trim();
      ta.value = text || "⚠️ No se detectó texto. Probá con mejor luz y texto más grande.";
      ocrSetStatus("✅ OCR listo.");
    } catch (e) {
      console.error(e);
      ocrSetStatus("❌ Error OCR: " + (e?.message || e));
    }
  });

  const btnB1 = document.getElementById("btnDevBloque1");
const btnB2 = document.getElementById("btnDevBloque2");

function partirEn2Bloques(txt) {
  const t = String(txt || "").trim();
  if (!t) return ["", ""];

  // Limpieza básica (borra letras sueltas del logo si aparecen solas)
  const lineas = t.split("\n").map(s => s.trim()).filter(Boolean);

  // 🔥 Bloque 1 armado fijo (lo que pediste)
  // DEVOCIONAL + fecha (si existen)
  const titulo = lineas.find(l => /^DEVOCIONAL$/i.test(l)) || "DEVOCIONAL";
  const fecha = lineas.find(l => /(lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d{1,2}\s+de\s+\w+)/i.test(l)) || "";

  // Versículo: agarramos el texto “grande” hasta encontrar una cita tipo "Mateo 19:13-14"
  let versiculo = [];
  let cita = "";
  let iCita = -1;

  for (let i = 0; i < lineas.length; i++) {
    if (/(?:\b\w+\b)\s+\d+:\d+/i.test(lineas[i])) { // ej "Mateo 19:13-14"
      cita = lineas[i];
      iCita = i;
      break;
    }
  }

  // Versículo: desde después de fecha hasta antes de cita (si la encontramos)
  const startVers = 0;
  const endVers = iCita > -1 ? iCita : Math.min(lineas.length, 30);
  for (let i = startVers; i < endVers; i++) {
    const l = lineas[i];
    // descartamos líneas de iglesia si se mezclaron
    if (/iglesia cristiana|roca\s*123|tristan/i.test(l)) continue;
    if (/^devocional$/i.test(l)) continue;
    if (fecha && l === fecha) continue;
    versiculo.push(l);
  }

  // Footer fijo bloque 1
  const footer1 = "IGLESIA CRISTIANA DE LA VIDA ABUNDANTE";
  const footer2 = "ROCA 123 - TRISTAN SUAREZ";

  const bloque1 =
`${titulo}
${fecha}

${versiculo.join(" ")}

${cita}

${footer1}
${footer2}`.trim();

  // 🔥 Bloque 2: todo lo que queda después de la cita
  let resto = "";
  if (iCita > -1) {
    resto = lineas.slice(iCita + 1).join("\n").trim();
  } else {
    // si no encontró cita, usa lo que quede al final como reflexión
    resto = lineas.slice(Math.floor(lineas.length / 2)).join("\n").trim();
  }

  // Sacar el footer si quedó duplicado
  resto = resto
    .replace(/IGLESIA CRISTIANA DE LA VIDA ABUNDANTE[\s\S]*$/i, "")
    .trim();

  const bloque2 = resto;

  return [bloque1, bloque2];
}

btnB1.onclick = () => {
  const [b1] = partirEn2Bloques(ta.value);
  if (!b1) return alert("No hay texto para Bloque 1");
  window.abrirPersonalizarConTexto?.(b1);
};

btnB2.onclick = () => {
  const [, b2] = partirEn2Bloques(ta.value);
  if (!b2) return alert("No hay texto para Bloque 2");

  window.abrirPersonalizarConTexto?.(b2);

  // ✅ fuerza “modo fondo plano”
  // deja el fondo en blanco (después lo elegís con el color)
  const cont = document.getElementById("previewImagen");
  if (cont) cont.style.background = "#ffffff";

  // si tenés una opacidad/backdrop, lo apagamos
  const back = document.getElementById("previewTextoBack");
  if (back) back.style.opacity = "0";
};

});
