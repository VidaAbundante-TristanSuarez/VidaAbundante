// devocionales.js
// ✅ Devocionales con recorte + OCR (TextDetector). No toca biblia.js

let img = null;
let canvas, ctx;
let start = null;
let crop = null; // {x,y,w,h} en coords canvas
let recortando = false;

function $(id) { return document.getElementById(id); }

function ocrSetStatus(msg) {
  const el = $("estadoOCRDev");
  if (el) el.textContent = msg || "";
}

function limpiarTextoOCR(t) {
  if (!t) return "";
  return String(t)
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fitCanvasToImage(image, maxW = 420) {
  const scale = Math.min(1, maxW / image.width);
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
}

function draw() {
  if (!img) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (crop) {
    ctx.save();
    ctx.strokeStyle = "#4f6fa8";
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

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

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  return { x, y };
}

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

// Preproceso suave (mejora OCR)
async function preprocessBlobToBitmap(blob, maxDim = 1600) {
  const bmp = await createImageBitmap(blob);

  const ratio = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * ratio);
  const h = Math.round(bmp.height * ratio);

  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const cctx = c.getContext("2d", { willReadFrequently: true });
  cctx.drawImage(bmp, 0, 0, w, h);

  const imageData = cctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  const contrast = 1.12;
  const intercept = 128 * (1 - contrast);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    y = y * contrast + intercept;
    y = Math.max(0, Math.min(255, y));
    d[i] = d[i + 1] = d[i + 2] = y;
  }

  cctx.putImageData(imageData, 0, 0);
  return await createImageBitmap(c);
}

document.addEventListener("DOMContentLoaded", () => {
  canvas = $("devCanvas");
  if (!canvas) return;

  ctx = canvas.getContext("2d");
  const input = $("devImg");
  const btnRecortar = $("btnDevRecortar");
  const btnOCR = $("btnDevOCR");
  const ta = $("devTexto");

  if (!input || !btnRecortar || !btnOCR || !ta) return;

  if (!("TextDetector" in window)) {
    ocrSetStatus("⚠️ OCR no disponible en este navegador. Probá Chrome/Edge actualizado (ideal Android).");
  } else {
    ocrSetStatus("✅ Cargá una imagen, recortá si querés y tocá OCR.");
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      img = image;
      crop = null;
      recortando = false;
      btnRecortar.textContent = "✂️ Recortar";
      fitCanvasToImage(img, 420);
      draw();
      URL.revokeObjectURL(url);
      ocrSetStatus("✅ Imagen cargada. Podés recortar o tocar OCR.");
    };
    image.src = url;
  });

  btnRecortar.addEventListener("click", () => {
    if (!img) { alert("Primero cargá una imagen"); return; }
    recortando = !recortando;
    btnRecortar.textContent = recortando ? "✅ Listo (recorte)" : "✂️ Recortar";
    if (!recortando) start = null;
  });

  canvas.addEventListener("mousedown", (e) => {
    if (!recortando || !img) return;
    start = canvasPoint(e);
    crop = { x: start.x, y: start.y, w: 1, h: 1 };
    draw();
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!recortando || !img || !start) return;
    crop = normalizeRect(start, canvasPoint(e));
    draw();
  });

  canvas.addEventListener("mouseup", () => {
    if (!recortando) return;
    start = null;
  });

  btnOCR.addEventListener("click", async () => {
    if (!img) { alert("Primero cargá una imagen"); return; }
    if (!("TextDetector" in window)) {
      alert("Tu navegador no soporta OCR (TextDetector). Probá Chrome/Edge actualizado, ideal Android.");
      return;
    }

    const blob = await getCroppedBlob();
    if (!blob) return;

    ta.value = "";
    ocrSetStatus("⏳ Detectando texto…");

    try {
      const detector = new TextDetector();
      const bitmap = await preprocessBlobToBitmap(blob);
      const results = await detector.detect(bitmap);

      const lines = (results || [])
        .map(r => (r.rawValue || "").trim())
        .filter(Boolean);

      const text = limpiarTextoOCR(lines.join("\n"));

      ta.value = text || "";
      ocrSetStatus(text ? "✅ Texto detectado. Podés corregirlo manualmente." :
        "⚠️ No pude detectar texto. Mejor luz, menos inclinación y texto más grande.");
    } catch (e) {
      console.error(e);
      ocrSetStatus("❌ Error OCR: " + (e?.message || e));
    }
  });
});
