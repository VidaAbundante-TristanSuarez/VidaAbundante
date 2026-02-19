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
  if (!img || !canvas || !ctx) return;

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
  if (!canvas) return;

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
  if (!img || !canvas) return null;

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
  const btnImg = $("btnDevImg");
if (btnImg) {
  btnImg.addEventListener("click", () => input.click());
}

  // Botón "Crear devocional"
  const btnAbrirDev = $("btnAbrirDevModal");

  // Si faltan elementos base, no rompemos nada
  if (!input || !btnRecortar || !btnOCR || !ta) {
    console.warn("Devocionales: faltan elementos (#devImg/#btnDevRecortar/#btnDevOCR/#devTexto).");
    return;
  }

  // ✅ Al inicio: recorte deshabilitado
  btnRecortar.disabled = true;
  btnRecortar.style.opacity = "0.6";

  // ✅ Botón "Crear devocional": solo se habilita si hay texto
  function syncBtnCrearDevocional() {
    if (!btnAbrirDev) return;
    const hayTexto = (ta.value || "").trim().length > 0;
    btnAbrirDev.disabled = !hayTexto;
    btnAbrirDev.style.opacity = hayTexto ? "1" : "0.6";
  }

  // ✅ si pegan/editar texto a mano, también habilita
  ta.addEventListener("input", syncBtnCrearDevocional);

  // estado inicial
  syncBtnCrearDevocional();

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
      $("devCanvasBox")?.classList.remove("hidden");

      // ✅ el textarea solo aparece cuando haya OCR
      $("devTextoBox")?.classList.add("hidden");
      ta.value = "";
      syncBtnCrearDevocional();

      URL.revokeObjectURL(url);
      ocrSetStatus("✅ Imagen cargada. Podés recortar o tocar OCR.");
    };

    image.src = url;
  });

  // Toggle recorte (por si querés apagarlo/encenderlo)
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
        $("devTextoBox")?.classList.remove("hidden");

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
// ✅ ABRIR “DEVOCIONAL” desde el botón "Crear devocional"
// ✅ Usa TUS modales (#modalDevPaso1/2/3) y NO pisa audio de Biblia
// =========================

// helpers modales (usa tu CSS .abierto)
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

// X de cada paso (tu HTML ya los llama)
window.cerrarDevPaso1 = () => cerrarModal("modalDevPaso1");
window.cerrarDevPaso2 = () => cerrarModal("modalDevPaso2");
window.cerrarDevPaso3 = () => cerrarModal("modalDevPaso3");

// Navegación pasos (tu HTML ya los llama)
window.irDevPaso2 = () => {
  renderPaso2();                // importante: pintar preview antes de mostrar
  cerrarModal("modalDevPaso1");
  abrirModal("modalDevPaso2");
};
window.volverDevPaso1 = () => {
  renderPaso1();
  cerrarModal("modalDevPaso2");
  abrirModal("modalDevPaso1");
};
window.irDevPaso3 = () => {
  renderPaso3();
  cerrarModal("modalDevPaso2");
  abrirModal("modalDevPaso3");
};
window.volverDevPaso2 = () => {
  renderPaso2();
  cerrarModal("modalDevPaso3");
  abrirModal("modalDevPaso2");
};

// ✅ Audio Dev: NO redefinimos cerrarModalAudio ni abrirModalAudio.
// Solo usamos el audio de Biblia si existe.
window.abrirAudioDev = () => {
  // Si biblia.audio.js está cargado, esto existe:
  if (typeof window.abrirModalAudio === "function") {
    const ta = document.getElementById("textoAudio");
    if (ta) ta.value = (window.__dev?.textoCompleto || "");
    window.abrirModalAudio();
    return;
  }
  alert("No está cargado el audio (biblia.audio.js).");
};

// (opcional) estos quedan por si después implementás descargar/compartir/finalizar
window.descargarDevFinal = () => alert("Descargar devocional: falta implementar.");
window.compartirDevFinal  = () => alert("Compartir devocional: falta implementar.");
window.finalizarDevFinal  = () => alert("Finalizar devocional: falta implementar.");

// =========================
// ✅ Render previews
// =========================
function renderPaso1() {
  const el = document.getElementById("previewDevPaso1");
  if (!el) return;
  el.innerHTML = devBloque1AHTML(window.__dev?.bloque1 || "");
}
function renderPaso2() {
  const el = document.getElementById("previewDevPaso2");
  if (!el) return;
  el.innerHTML = devBloque2AHTML(window.__dev?.bloque2 || "");
}
function renderPaso3() {
  const el = document.getElementById("previewDevPaso3");
  if (!el) return;

  // Paso 3 puede mostrar todo junto o solo bloque2, vos elegís.
  // Yo lo dejo mostrando TODO (bloque1 + bloque2) para que sea “A4 completo”.
  const b1 = devBloque1AHTML(window.__dev?.bloque1 || "");
  const b2 = devBloque2AHTML(window.__dev?.bloque2 || "");
  el.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:14px;">
      ${b1}
      ${b2}
    </div>
  `;
}

// =========================
// ✅ Botón "Crear devocional" -> abre Paso 1
// =========================
if (btnAbrirDev) {
  btnAbrirDev.addEventListener("click", () => {
    const texto = (ta.value || "").trim();
    if (!texto) {
      alert("Primero necesitás texto (OCR o pegado).");
      return;
    }

    const [b1, b2] = partirEn2Bloques(texto);

    window.__dev = window.__dev || {};
    window.__dev.textoCompleto = texto;
    window.__dev.bloque1 = b1 || "";
    window.__dev.bloque2 = b2 || "";

    // pintar + abrir paso 1
    renderPaso1();
    abrirModal("modalDevPaso1");
  });
}

}); // ✅ cierra DOMContentLoaded

