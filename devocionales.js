// devocionales.js
// ✅ Módulo independiente para Devocionales (sin romper biblia.js)

let img = null;
let canvas, ctx;
let start = null;
let crop = null; // {x,y,w,h} en coords de canvas

function $(id) { return document.getElementById(id); }

function fitCanvasToImage(image, maxW = 420) {
  const scale = Math.min(1, maxW / image.width);
  const w = Math.round(image.width * scale);
  const h = Math.round(image.height * scale);
  canvas.width = w;
  canvas.height = h;
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

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (canvas.width / r.width);
  const y = (e.clientY - r.top) * (canvas.height / r.height);
  return { x, y };
}

async function getCroppedBlob() {
  if (!img) return null;

  // si no recortó, mandamos toda la imagen renderizada a canvas
  const r = crop && crop.w > 10 && crop.h > 10
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

// ✅ INIT cuando abrís la sección (no molesta en otras secciones)
document.addEventListener("DOMContentLoaded", () => {
  canvas = $("devCanvas");
  if (!canvas) return; // si no está la sección aún
  ctx = canvas.getContext("2d");

  const input = $("devImg");
  const btnRecortar = $("btnDevRecortar");
  const btnOCR = $("btnDevOCR");
  const ta = $("devTexto");

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      img = image;
      crop = null;
      fitCanvasToImage(img, 420);
      draw();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

  // ✂️ activar recorte (arrastrar)
  let recortando = false;

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
    const p = canvasPoint(e);
    crop = normalizeRect(start, p);
    draw();
  });

  canvas.addEventListener("mouseup", () => {
    if (!recortando) return;
    start = null;
  });

  // 🧠 OCR (lo conectamos a la Cloud Function en el paso 2)
  btnOCR.addEventListener("click", async () => {
    if (!img) { alert("Primero cargá una imagen"); return; }

    const blob = await getCroppedBlob();
    if (!blob) return;

    // por ahora solo confirmamos que tenemos el recorte
    ta.value = "✅ Recorte listo. Próximo paso: enviar este recorte a OCR (Cloud Function).";
  });
});
