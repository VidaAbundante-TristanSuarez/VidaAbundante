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
// ✅ DEVOCIONALES: flujo 3 pasos usando el modal de biblia.js
// Bloque 1: CUADRADO + fondos galería
// Bloque 2: STORY + solo color plano
// Bloque 3: preview final (combinada)
// =========================

window.__devSiguiente = (paso) => {
  const ta = document.getElementById("devTexto");
  const texto = (ta?.value || "").trim();
  window.__devTextoCompleto = texto; // ✅ para audio final (paso 3)
  if (!texto) { alert("Primero necesitás texto (OCR o pegado)."); return; }

  const [b1, b2] = partirEn2Bloques(texto); // ✅ ahora sí existe

  if (paso === 1) {
    if (!b1) return alert("No hay texto para Bloque 1");
    window.abrirPersonalizarConTexto(b1, { paso: 1, devPaso: 1 });
    return;
  }

  if (paso === 2) {
    if (!b2) return alert("No hay texto para Bloque 2");
    window.abrirPersonalizarConTexto(b2, { paso: 2, devPaso: 2, color: "#ffffff" });
    return;
  }

  if (paso === 3) {
    window.abrirPersonalizarConTexto("FINAL", { devPaso: 3 });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const b1 = document.getElementById("btnDevBloque1");
  const b2 = document.getElementById("btnDevBloque2");

  if (b1) b1.onclick = () => {
  const texto = (document.getElementById("devTexto")?.value || "").trim();
  window.__devTextoCompleto = texto;
  const [bloque1, bloque2] = partirEn2Bloques(texto);

  window.__devBloque1 = bloque1;
  window.__devBloque2 = bloque2;

  dev_openModal();
  irPasoDev(1);
};

if (b2) b2.onclick = () => {
  const texto = (document.getElementById("devTexto")?.value || "").trim();
  window.__devTextoCompleto = texto;
  const [bloque1, bloque2] = partirEn2Bloques(texto);

  window.__devBloque1 = bloque1;
  window.__devBloque2 = bloque2;

  dev_openModal();
  irPasoDev(2);
};

});

// =====================================================
// ✅ MODAL DEVOCIONALES REAL (Step1/2/3)
// =====================================================
window.__devStep = 1;
window.__devBloque1 = "";
window.__devBloque2 = "";
window.__devFondoImg = "";  // fondo galería (step1)
window.__devFondoPlano = "#ffffff"; // step2
window.__devFuente = "Roboto";
window.__devStyle = {
  1:{ bold:false, italic:false, underline:false, size:24, color:"#000000", op:0.3 },
  2:{ bold:false, italic:false, underline:false, size:22, color:"#000000", op:0.3 }
};

function dev_openModal() {
  const m = document.getElementById("modalDevocionales");
  if (m) { m.style.display="flex"; m.setAttribute("aria-hidden","false"); }
}
window.cerrarModalDevocionales = () => {
  const m = document.getElementById("modalDevocionales");
  if (m) { m.style.display="none"; m.setAttribute("aria-hidden","true"); }
};

window.irPasoDev = (n) => {
  window.__devStep = n;

  document.getElementById("devStep1").style.display = (n===1) ? "block" : "none";
  document.getElementById("devStep2").style.display = (n===2) ? "block" : "none";
  document.getElementById("devStep3").style.display = (n===3) ? "block" : "none";

  dev_renderPreview();
};

function dev_applyTextStyle(el, st) {
  el.style.fontFamily = window.__devFuente;
  el.style.fontSize = (st.size||24) + "px";
  el.style.fontWeight = st.bold ? "700" : "400";
  el.style.fontStyle = st.italic ? "italic" : "normal";
  el.style.textDecoration = st.underline ? "underline" : "none";
  el.style.lineHeight = "1.25";
  el.style.color = st.color || "#000";
}

function dev_renderPreview() {
  const box = document.getElementById("previewDevocional");
  if (!box) return;

  // limpiar
  box.innerHTML = "";

  if (window.__devStep === 1) {
    box.style.width = "210px";
    box.style.height = "210px";
    box.style.margin = "0 auto";
    box.style.borderRadius = "14px";
    box.style.overflow = "hidden";
    box.style.position = "relative";

    if (window.__devFondoImg) {
      box.style.backgroundImage = `url("${window.__devFondoImg}")`;
      box.style.backgroundSize = "cover";
      box.style.backgroundPosition = "center";
      box.style.backgroundColor = "transparent";
    } else {
      box.style.backgroundImage = "none";
      box.style.backgroundColor = "#fff";
    }

    const st = window.__devStyle[1];
    const overlay = document.createElement("div");
    overlay.style.position="absolute";
    overlay.style.inset="0";
    overlay.style.display="flex";
    overlay.style.alignItems="center";
    overlay.style.justifyContent="center";
    overlay.style.padding="14px";
    overlay.style.background = (function(){
      const op = Number(st.op||0.3);
      if (op>0.5) return `rgba(0,0,0,${Math.min(0.7,(op-0.5)*2)})`;
      if (op<0.5) return `rgba(255,255,255,${Math.min(0.7,(0.5-op)*2)})`;
      return "transparent";
    })();

    const txt = document.createElement("div");
    txt.style.whiteSpace="pre-wrap";
    txt.style.textAlign="center";
    dev_applyTextStyle(txt, st);
    txt.textContent = window.__devBloque1 || "";

    overlay.appendChild(txt);
    box.appendChild(overlay);
    return;
  }

  if (window.__devStep === 2) {
    box.style.width = "210px";
    box.style.height = "87px";
    box.style.margin = "0 auto";
    box.style.borderRadius = "14px";
    box.style.overflow = "hidden";
    box.style.position = "relative";
    box.style.backgroundImage = "none";
    box.style.backgroundColor = window.__devFondoPlano || "#fff";

    const st = window.__devStyle[2];
    const overlay = document.createElement("div");
    overlay.style.position="absolute";
    overlay.style.inset="0";
    overlay.style.display="flex";
    overlay.style.alignItems="center";
    overlay.style.justifyContent="center";
    overlay.style.padding="10px";
    overlay.style.background = (function(){
      const op = Number(st.op||0.3);
      if (op>0.5) return `rgba(0,0,0,${Math.min(0.7,(op-0.5)*2)})`;
      if (op<0.5) return `rgba(255,255,255,${Math.min(0.7,(0.5-op)*2)})`;
      return "transparent";
    })();

    const txt = document.createElement("div");
    txt.style.whiteSpace="pre-wrap";
    txt.style.textAlign="center";
    dev_applyTextStyle(txt, st);
    txt.textContent = window.__devBloque2 || "";

    overlay.appendChild(txt);
    box.appendChild(overlay);
    return;
  }

  // Step3 A4: mostrar composición simple (bloque1 arriba + bloque2 abajo)
  if (window.__devStep === 3) {
    box.style.width = "210px";
    box.style.height = "297px";
    box.style.margin = "0 auto";
    box.style.borderRadius = "14px";
    box.style.overflow = "hidden";
    box.style.background = "#fff";
    box.style.display = "flex";
    box.style.flexDirection = "column";

    const top = document.createElement("div");
    top.style.height = "210px";
    top.style.position="relative";
    top.style.background = window.__devFondoImg ? `url("${window.__devFondoImg}") center/cover` : "#fff";

    const bottom = document.createElement("div");
    bottom.style.height = "87px";
    bottom.style.background = window.__devFondoPlano || "#fff";
    bottom.style.position="relative";

    // textos
    const t1 = document.createElement("div");
    t1.style.position="absolute"; t1.style.inset="0";
    t1.style.display="flex"; t1.style.alignItems="center"; t1.style.justifyContent="center";
    t1.style.padding="14px"; t1.style.textAlign="center";
    t1.style.whiteSpace="pre-wrap";
    dev_applyTextStyle(t1, window.__devStyle[1]);
    t1.textContent = window.__devBloque1 || "";
    top.appendChild(t1);

    const t2 = document.createElement("div");
    t2.style.position="absolute"; t2.style.inset="0";
    t2.style.display="flex"; t2.style.alignItems="center"; t2.style.justifyContent="center";
    t2.style.padding="10px"; t2.style.textAlign="center";
    t2.style.whiteSpace="pre-wrap";
    dev_applyTextStyle(t2, window.__devStyle[2]);
    t2.textContent = window.__devBloque2 || "";
    bottom.appendChild(t2);

    box.appendChild(top);
    box.appendChild(bottom);
  }
}

// Hooks de UI (inputs existentes)
document.addEventListener("DOMContentLoaded", () => {
  // Step1 inputs
  const op1 = document.getElementById("opacidadDev1");
  const c1  = document.getElementById("colorFuenteDev1");
  const s1  = document.getElementById("tamanoDev1");

  if (op1) op1.addEventListener("input", () => { window.__devStyle[1].op = Number(op1.value); dev_renderPreview(); });
  if (c1)  c1.addEventListener("input", () => { window.__devStyle[1].color = c1.value; dev_renderPreview(); });
  if (s1)  s1.addEventListener("input", () => { window.__devStyle[1].size = Number(s1.value); dev_renderPreview(); });

  // Step2 inputs
  const bg2 = document.getElementById("colorFondoDev2");
  const op2 = document.getElementById("opacidadDev2");
  const c2  = document.getElementById("colorFuenteDev2");
  const s2  = document.getElementById("tamanoDev2");

  if (bg2) bg2.addEventListener("input", () => { window.__devFondoPlano = bg2.value; dev_renderPreview(); });
  if (op2) op2.addEventListener("input", () => { window.__devStyle[2].op = Number(op2.value); dev_renderPreview(); });
  if (c2)  c2.addEventListener("input", () => { window.__devStyle[2].color = c2.value; dev_renderPreview(); });
  if (s2)  s2.addEventListener("input", () => { window.__devStyle[2].size = Number(s2.value); dev_renderPreview(); });
});

// Botones de estilos (ya existen en HTML)
window.toggleBoldDev = (n) => { window.__devStyle[n].bold = !window.__devStyle[n].bold; dev_renderPreview(); };
window.toggleItalicDev = (n) => { window.__devStyle[n].italic = !window.__devStyle[n].italic; dev_renderPreview(); };
window.toggleUnderlineDev = (n) => { window.__devStyle[n].underline = !window.__devStyle[n].underline; dev_renderPreview(); };

window.cambiarTamanoDev = (n, delta) => {
  const st = window.__devStyle[n];
  st.size = Math.max(10, Math.min(100, (st.size||24) + delta));
  const inp = document.getElementById(n===1 ? "tamanoDev1" : "tamanoDev2");
  if (inp) inp.value = st.size;
  dev_renderPreview();
};

