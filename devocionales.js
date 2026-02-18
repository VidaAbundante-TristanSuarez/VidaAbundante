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
  // ✅ Al inicio deshabilitado
btnRecortar.disabled = true;
btnRecortar.style.opacity = "0.6";
  const btnOCR = $("btnDevOCR");
  const ta = $("devTexto");

// ✅ Botón "Crear devocional": solo se habilita si hay texto
const btnAbrirDev = document.getElementById("btnAbrirDevModal");

function syncBtnCrearDevocional() {
  if (!btnAbrirDev || !ta) return;
  const hayTexto = (ta.value || "").trim().length > 0;

  btnAbrirDev.disabled = !hayTexto;
  btnAbrirDev.style.opacity = hayTexto ? "1" : "0.6";
}

// ✅ si la persona pega/edita texto a mano, también habilita
ta?.addEventListener("input", syncBtnCrearDevocional);

// estado inicial
syncBtnCrearDevocional();
  
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
  // ✅ activar recorte automáticamente
recortando = true;
btnRecortar.disabled = false;
btnRecortar.style.opacity = "1";
btnRecortar.innerHTML = '✅ Listo <i class="fa-solid fa-crop"></i>';


  fitCanvasToImage(img, 420);
  draw();

  // ✅ mostrar canvas
document.getElementById("devCanvasBox")?.classList.remove("hidden");

// ✅ el textarea solo aparece cuando haya OCR
document.getElementById("devTextoBox")?.classList.add("hidden");
const devTA = document.getElementById("devTexto");
if (devTA) devTA.value = "";

  URL.revokeObjectURL(url);
  ocrSetStatus("✅ Imagen cargada. Podés recortar o tocar OCR.");
};

    image.src = url;
  });

  // Toggle recorte
  btnRecortar.addEventListener("click", () => {
    if (!img) { alert("Primero cargá una imagen"); return; }

    recortando = !recortando;
   btnRecortar.innerHTML = recortando
  ? '✅ Listo <i class="fa-solid fa-crop"></i>'
  : '✂️ Recortar <i class="fa-solid fa-crop"></i>';

    if (!recortando) {
      start = null;
      drawing = false;
    }
  });

  // OCR por Cloud Function
btnOCR.addEventListener("click", async () => {
  if (!img) { alert("Primero cargá una imagen"); return; }

  // ✅ Evita doble click
  btnOCR.disabled = true;
  btnOCR.style.opacity = "0.6";

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

if (text) {
  ta.value = text;

  // ✅ Mostrar textarea SOLO si hay texto real
  document.getElementById("devTextoBox")?.classList.remove("hidden");

  ocrSetStatus("✅ OCR listo.");
  syncBtnCrearDevocional();

} else {
  ta.value = "";
  ocrSetStatus("⚠️ No se detectó texto. Probá con mejor luz y texto más grande.");
  syncBtnCrearDevocional();
}

  } catch (e) {
    console.error(e);
    ocrSetStatus("❌ Error OCR: " + (e?.message || e));
  } finally {
    // ✅ Pase lo que pase, volver a habilitar
    btnOCR.disabled = false;
    btnOCR.style.opacity = "1";
  }
});

// =========================
// ✅ ABRIR MODAL desde el botón "Crear devocional"
// =========================
if (btnAbrirDev) {
  btnAbrirDev.addEventListener("click", () => {
    const texto = (ta.value || "").trim();
    if (!texto) {
      alert("Primero necesitás texto (OCR o pegado).");
      return;
    }

    const [b1, b2] = partirEn2Bloques(texto);

    window.__dev.textoCompleto = texto;
    window.__dev.bloque1 = b1 || "";
    window.__dev.bloque2 = b2 || "";
    window.__devSiguiente(1);

  });
}
  
}); // ✅ CIERRA el document.addEventListener("DOMContentLoaded", () => { ... })
  
// ✅ GLOBAL: para que lo pueda usar window.__devSiguiente
function partirEn2Bloques(txt) {
  const raw = String(txt || "").replace(/\r/g, "").trim();
  if (!raw) return ["", ""];

  // -------- helpers ----------
  const norm = (s) =>
    String(s || "")
      .trim()
      .replace(/[•·▪●■▶►➤➔➡️]/g, "")
      .replace(/\s+/g, " ");

  const sinAcentos = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const isOracionLine = (s) => {
    const n = sinAcentos(norm(s)).toLowerCase();
    return /\boracion\b/.test(n);
  };

  const isCitaLine = (s) => {
    return /([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s+\d+:\d+(-\d+)?/.test(norm(s));
  };

  const letters = (s) => (norm(s).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
  const uppers  = (s) => (norm(s).match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length;

  const isMostlyUpper = (s) => {
    const L = letters(s);
    if (L < 6) return false;
    return (uppers(s) / L) >= 0.75;
  };

  const isBasuraLogo = (s) => {
    const raw = String(s || "").trim();
    if (!raw) return true;

    const clean = sinAcentos(norm(raw));
    const n = clean.toUpperCase();

    if (n.length <= 2) return true;

    const ltrs = (clean.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) || []).length;
    const ups  = (clean.match(/[A-ZÁÉÍÓÚÜÑ]/g) || []).length;
    const upperRatio = ltrs ? (ups / ltrs) : 0;

    const esCorta = n.length <= 28;
    const esMayus = upperRatio >= 0.75;

    if (!esCorta || !esMayus) return false;

    const keys = [
      "IGLESIA", "CRISTIANA", "VIDA", "ABUNDANTE",
      "DE LA VIDA", "LA VIDA", "VIDA ABUNDANTE",
      "ABUNDAN", "ABUNDA", "AB", "DE LA", "DE", "LA"
    ];

    const tieneKey = keys.some(k => n.includes(sinAcentos(k).toUpperCase()));
    return !!tieneKey;
  };

  // -------- preparar líneas ----------
  let lineas = raw
    .split("\n")
    .map(norm)
    .filter(Boolean)
    .filter(l => !isBasuraLogo(l));

  const titulo = lineas.find(l => /^DEVOCIONAL$/i.test(l)) || "DEVOCIONAL";

  const fecha =
    lineas.find(l =>
      /(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\s+\d{1,2}\s+de\s+\w+/i.test(l)
    ) || "";

  const idxOracion = lineas.findIndex(isOracionLine);

  let idxCita = -1;
  for (let i = lineas.length - 1; i >= 0; i--) {
    if (isCitaLine(lineas[i])) { idxCita = i; break; }
  }
  const cita = idxCita >= 0 ? lineas[idxCita] : "";

  // -------- bloque versículo (mayúsculas antes de la cita) ----------
  let verseStart = -1;
  let verseEnd = -1;

  if (idxCita > 0) {
    let i = idxCita - 1;

    if (i >= 0 && isMostlyUpper(lineas[i])) {
      verseEnd = i;
      while (i >= 0 && isMostlyUpper(lineas[i])) i--;
      verseStart = i + 1;
    } else {
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

  // -------- Bloque 2: Reflexión + Oración ----------
  const idxFecha = fecha ? lineas.indexOf(fecha) : -1;
  const inicioCuerpo = (idxFecha >= 0) ? (idxFecha + 1) : 0;

  const corteAntesVersiculo = (verseStart >= 0) ? verseStart : (idxCita >= 0 ? idxCita : lineas.length);

  const reflexionEnd = (idxOracion >= 0 ? idxOracion : corteAntesVersiculo);
  const reflexion = lineas.slice(inicioCuerpo, reflexionEnd).join(" ").replace(/\s+/g, " ").trim();

  let oracion = "";
  if (idxOracion >= 0) {
    oracion = lineas.slice(idxOracion, corteAntesVersiculo).join(" ").replace(/\s+/g, " ").trim();
    oracion = oracion.replace(/^.*?\bOraci[oó]n\b\s*:\s*/i, "Oración: ");
    if (!/^Oración:/i.test(oracion)) oracion = "Oración: " + oracion;
  }

  const bloque2 = [reflexion, oracion].filter(Boolean).join("\n\n").trim();

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

// =========================
// ✅ MODALES DEVOCIONAL (Paso 1/2/3) — helpers
// =========================
function abrirModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add("abierto");
  m.setAttribute("aria-hidden", "false");
}

function cerrarModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove("abierto");
  m.setAttribute("aria-hidden", "true");
}

// Hacemos globales las X (porque tu HTML las llama con onclick="...")
window.cerrarDevPaso1 = () => cerrarModal("modalDevPaso1");
window.cerrarDevPaso2 = () => cerrarModal("modalDevPaso2");
window.cerrarDevPaso3 = () => cerrarModal("modalDevPaso3");

// =========================
// ✅ Estado del devocional (global simple)
// =========================
window.__dev = window.__dev || {
  textoCompleto: "",
  bloque1: "",
  bloque2: ""
};

function renderPaso1() {
  const el = document.getElementById("previewDevPaso1");
  if (el) el.textContent = window.__dev.bloque1 || "";
}
function renderPaso2() {
  const el = document.getElementById("previewDevPaso2");
  if (el) el.textContent = window.__dev.bloque2 || "";
}
function renderPaso3() {
  const el = document.getElementById("previewDevPaso3");
  if (el) el.textContent = ((window.__dev.bloque1 || "") + "\n\n" + (window.__dev.bloque2 || "")).trim();
}

// =========================
// ✅ Navegación entre pasos (tu HTML llama estas funciones)
// =========================
window.irDevPaso2 = () => {
  cerrarModal("modalDevPaso1");
  renderPaso2();
  abrirModal("modalDevPaso2");
};

window.volverDevPaso1 = () => {
  cerrarModal("modalDevPaso2");
  renderPaso1();
  abrirModal("modalDevPaso1");
};

window.irDevPaso3 = () => {
  cerrarModal("modalDevPaso2");
  renderPaso3();
  abrirModal("modalDevPaso3");
};

window.volverDevPaso2 = () => {
  cerrarModal("modalDevPaso3");
  renderPaso2();
  abrirModal("modalDevPaso2");
};

// =========================
// ✅ Audio: tu HTML usa onclick="abrirAudioDev()"
// =========================
window.abrirAudioDev = () => {
  const m = document.getElementById("modalAudio");
  if (!m) return alert("No existe #modalAudio en el HTML");

  const ta = document.getElementById("textoAudio");
  if (ta) ta.value = window.__dev.textoCompleto || "";

  abrirModal("modalAudio");
};

// ya tenías cerrarModalAudio en HTML
window.cerrarModalAudio = () => cerrarModal("modalAudio");

// ===============================
// ✅ DEVOCIONAL: cambiar de paso usando #modalPersonalizar
// ===============================
window.__devSiguiente = (paso) => {
  paso = Number(paso || 1);
  window.__devPaso = paso;

  // 1) Elegir modo del controller
  const mode =
    paso === 1 ? "DEV1" :
    paso === 2 ? "DEV2" : "DEV3";

  // 2) Abrir el modal único
  Modal.open(mode);

  // 3) Cargar el texto correcto en la vista previa
  const texto = (paso === 1) ? (window.__dev.bloque1 || "") : (window.__dev.bloque2 || "");

  // devPaso:true solo para que tu función sepa que es devocional
  window.abrirPersonalizarConTexto(texto, { devPaso: true, paso });

  // 4) Refrescar UI (fondos / fondo plano / botones)
  Modal.applyUI();
};

function devBloque1AHTML(txt) {
  const lines = String(txt || "").split("\n").map(s => s.trim()).filter(Boolean);

  const titulo = lines[0] || "DEVOCIONAL";
  const fecha  = lines[1] || "";
  const footer2 = lines[lines.length - 1] || "";
  const footer1 = lines[lines.length - 2] || "";

  // cita: buscá la primera que parezca "Mateo 19:13-14"
  let citaIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/\d+:\d+/.test(lines[i])) { citaIdx = i; break; }
  }
  const cita = citaIdx >= 0 ? lines[citaIdx] : "";

  // versículo: todo lo que esté entre fecha y cita
  const verseStart = fecha ? 2 : 1;
  const verseEnd = (citaIdx >= 0 ? citaIdx : lines.length - 2);
  const versiculo = lines.slice(verseStart, verseEnd).join(" ");

  return `
    <div class="dev-head">
      <div class="dev-titulo">${titulo}</div>
      <div class="dev-fecha">${fecha}</div>
    </div>

    <div class="dev-versiculo">${versiculo}</div>

    <div class="dev-cita">${cita}</div>

    <div class="dev-footer">
      <div>${footer1}</div>
      <div>${footer2}</div>
    </div>
  `;
}

function devBloque2AHTML(txt) {
  const raw = String(txt || "").trim();
  if (!raw) return "";

  const parts = raw.split(/\n\s*\n/); // separa por doble salto
  const reflexion = parts[0] || "";
  const oracion = parts.slice(1).join("\n\n") || "";

  return `
    <div class="dev-reflexion">${reflexion}</div>
    ${oracion ? `<div class="dev-oracion">${oracion}</div>` : ""}
  `;
}
