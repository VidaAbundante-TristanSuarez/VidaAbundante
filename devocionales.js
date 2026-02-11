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
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      // reader.result = "data:image/jpeg;base64,AAAA..."
      const res = String(reader.result || "");
      const base64 = res.split(",")[1] || "";
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
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
  const raw = String(txt || "").replace(/\r/g, "").trim();
  if (!raw) return ["", ""];

  // -------- helpers ----------
  const norm = (s) =>
    String(s || "")
      .trim()
      .replace(/[•·▪●■▶►➤➔➡️]/g, "")     // viñetas comunes
      .replace(/\s+/g, " ");

  const sinAcentos = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isOracionLine = (s) => {
    const n = sinAcentos(norm(s)).toLowerCase();
    // acepta "oracion", "oracion:", "oración", con viñeta delante, etc.
    return /\boracion\b/.test(n);
  };

  const isCitaLine = (s) => {
    // Busca algo tipo "MATEO 19:13-14" o "Juan 3:16"
    // (la cita suele estar sola en una línea)
    return /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+\d+:\d+(-\d+)?/.test(norm(s));
  };

  const letters = (s) => (norm(s).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const uppers  = (s) => (norm(s).match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length;

  const isMostlyUpper = (s) => {
    const L = letters(s);
    if (L < 6) return false;
    return (uppers(s) / L) >= 0.75; // bastante estricto
  };

  const isBasuraLogo = (s) => {
    const n = sinAcentos(norm(s)).toUpperCase();
    // basura típica + líneas demasiado cortas sueltas
    if (n === "DE LA VIDA" || n === "DE LA VIDA." || n === "LA VIDA" || n === "VIDA") return true;
    if (n.includes("DE LA VIDA") && n.length <= 20) return true;
    if (n.length <= 2) return true;
    return false;
  };

  // -------- preparar líneas ----------
  let lineas = raw
    .split("\n")
    .map(norm)
    .filter(Boolean)
    .filter(l => !isBasuraLogo(l));

  // título / fecha
  const titulo = lineas.find(l => /^DEVOCIONAL$/i.test(l)) || "DEVOCIONAL";

  const fecha =
    lineas.find(l =>
      /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+de\s+\w+/i.test(l)
    ) || "";

  // Índices clave
  const idxOracion = lineas.findIndex(isOracionLine);

  // Tomamos LA ÚLTIMA cita encontrada (casi siempre está al final)
  let idxCita = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (isCitaLine(lineas[i])) { idxCita = i; break; }
  }
  const cita = idxCita >= 0 ? lineas[idxCita] : "";

  // -------- detectar bloque del versículo (mayúsculas antes de la cita) ----------
  // Buscamos hacia arriba desde idxCita-1 un bloque CONTIGUO de líneas mayormente en mayúsculas.
  let verseStart = -1;
  let verseEnd = -1;

  if (idxCita > 0) {
    let i = idxCita - 1;

    // saltar posibles líneas basura entre versículo y cita
    while (i >= 0 && isBasuraLogo(lineas[i])) i--;

    // si la línea es mayúscula, empezamos bloque
    if (i >= 0 && isMostlyUpper(lineas[i])) {
      verseEnd = i;
      while (i >= 0 && isMostlyUpper(lineas[i])) i--;
      verseStart = i + 1;
    } else {
      // fallback: si OCR partió raro, buscamos el último “grupo” de mayúsculas
      for (let k = idxCita - 1; k >= 0; k--) {
        if (isMostlyUpper(lineas[k])) {
          verseEnd = k;
          let j = k;
          while (j >= 0 && isMostlyUpper(lineas[j])) j--;
          verseStart = j + 1;
          break;
        }
      }
    }
  }

  const versiculoLines =
    (verseStart >= 0 && verseEnd >= verseStart)
      ? lineas.slice(verseStart, verseEnd + 1)
      : [];

 const versiculo = versiculoLines.join(" ").replace(/\s+/g, " ").trim();

  // -------- Bloque 2: Reflexión + Oración (sin versículo) ----------
  // Reflexión: desde después de fecha (si existe) hasta antes de “Oración”
  // Oración: desde “Oración...” hasta antes del versículo
  const idxFecha = fecha ? lineas.indexOf(fecha) : -1;

  const inicioCuerpo = (idxFecha >= 0) ? (idxFecha + 1) : 0;

  const corteAntesVersiculo = (verseStart >= 0) ? verseStart : (idxCita >= 0 ? idxCita : lineas.length);

  const reflexionEnd = (idxOracion >= 0 ? idxOracion : corteAntesVersiculo);
  const reflexion = lineas.slice(inicioCuerpo, reflexionEnd).join(" ").replace(/\s+/g, " ").trim();

  let oracion = "";
  if (idxOracion >= 0) {
    oracion = lineas.slice(idxOracion, corteAntesVersiculo).join(" ").replace(/\s+/g, " ").trim();

    // opcional: normalizar el prefijo "Oración:" si viene pegado
    oracion = oracion.replace(/^.*?\bOraci[oó]n\b\s*:\s*/i, "Oración: ");
    if (!/^Oración:/i.test(oracion)) oracion = "Oración: " + oracion;
  }

  const bloque2 = [reflexion, oracion].filter(Boolean).join("\n\n").trim();

  // -------- Bloque 1: SOLO versículo + cita + footer (con título/fecha arriba) ----------
  const footer1 = "IGLESIA CRISTIANA DE LA VIDA ABUNDANTE";
  const footer2 = "ROCA 123 - TRISTAN SUAREZ";

  const bloque1 =
`${titulo}
${fecha}

${versiculo}

${cita}

${footer1}
${footer2}`.trim();

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
