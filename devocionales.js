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
} else {
  ta.value = "";
  ocrSetStatus("⚠️ No se detectó texto. Probá con mejor luz y texto más grande.");
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
  // ✅ ABRIR MODAL DEVOCIONALES desde el botón "Crear devocional"
  // =========================
  const btnAbrir = document.getElementById("btnAbrirDevModal");
  if (btnAbrir) {
    btnAbrir.addEventListener("click", () => {
      const texto = (document.getElementById("devTexto")?.value || "").trim();
      if (!texto) return alert("Primero necesitás texto (OCR o pegado).");

      const [b1, b2] = partirEn2Bloques(texto);

      DevModal.state.textoCompleto = texto;
      DevModal.state.bloque1 = b1 || "";
      DevModal.state.bloque2 = b2 || "";

      // ✅ Render paso 1 y abrir
      DevModal.renderStep1();
      DevModal.open(1);
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
// ✅ MODAL DEVOCIONALES (nuevo) — abrir/cerrar/pasos
// =========================
const DevModal = {
  state: {
    step: 1,
    textoCompleto: "",
    bloque1: "",
    bloque2: "",
  },

  el() { return document.getElementById("modalDevocionales"); },

  open(step = 1) {
    const m = this.el();
    if (!m) return alert("No existe #modalDevocionales en el HTML");
    this.setStep(step);
    m.classList.add("abierto");
    m.setAttribute("aria-hidden", "false");
  },

  close() {
    const m = this.el();
    if (!m) return;
    m.classList.remove("abierto");
    m.setAttribute("aria-hidden", "true");
  },

  setStep(step) {
    const m = this.el();
    if (!m) return;
    this.state.step = Number(step);
    m.dataset.step = String(step);
  },

  // ✅ rellena previews simple (por ahora texto plano)
  renderStep1() {
    const box = document.getElementById("previewDevPaso1");
    if (box) box.textContent = this.state.bloque1 || "";
  },
  renderStep2() {
    const box = document.getElementById("previewDevPaso2");
    if (box) box.textContent = this.state.bloque2 || "";
  },
  renderStep3() {
    const box = document.getElementById("previewDevPaso3");
    if (box) box.textContent = (this.state.bloque1 + "\n\n" + this.state.bloque2).trim();
  },
};

// ✅ para el botón X del modal
window.cerrarModalDevocionales = () => DevModal.close();

// =========================
// ✅ NAV DEVOCIONALES: botones Anterior/Siguiente
// =========================
document.addEventListener("DOMContentLoaded", () => {
  const sig1 = document.getElementById("devBtnSig1");
  const ant2 = document.getElementById("devBtnAnt2");
  const sig2 = document.getElementById("devBtnSig2");
  const ant3 = document.getElementById("devBtnAnt3");

  if (sig1) sig1.addEventListener("click", () => {
    DevModal.renderStep2();
    DevModal.setStep(2);
  });

  if (ant2) ant2.addEventListener("click", () => {
    DevModal.renderStep1();
    DevModal.setStep(1);
  });

  if (sig2) sig2.addEventListener("click", () => {
    DevModal.renderStep3();
    DevModal.setStep(3);
  });

  if (ant3) ant3.addEventListener("click", () => {
    DevModal.renderStep2();
    DevModal.setStep(2);
  });
});


// =========================
// ✅ AUDIO: abrir modalAudio y pasarle el texto completo
// =========================
function abrirModalAudioDev() {
  const m = document.getElementById("modalAudio");
  if (!m) return alert("No existe #modalAudio en el HTML");

  // texto para audio = el texto completo OCR (editable luego)
  const ta = document.getElementById("textoAudio");
  if (ta) ta.value = DevModal.state.textoCompleto || "";

  m.classList.add("abierto");
  m.setAttribute("aria-hidden", "false");
}

window.cerrarModalAudio = () => {
  const m = document.getElementById("modalAudio");
  if (!m) return;
  m.classList.remove("abierto");
  m.setAttribute("aria-hidden", "true");
};

document.addEventListener("DOMContentLoaded", () => {
  const btnAudio = document.getElementById("devBtnAudio");
  if (btnAudio) btnAudio.addEventListener("click", abrirModalAudioDev);
});

