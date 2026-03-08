// ================= SUBIDOS.JS =================
const { db, storage } = window.__FB || {};
const FB = window.__FB_API || {};

const {
  ref,
  set,
  onValue,
  push,
  sRef,
  uploadBytes,
  getDownloadURL
} = FB;

let subidosUID = null;
let subidosEsAdmin = false;
let subidosMesActual = new Date();
let subidosItems = [];
let subidosEtiquetas = [];

const ETIQUETAS_DEFAULT = [
  "Predica",
  "Anuncio",
  "Plan",
  "Racimo",
  "Oración",
  "Culto",
  "Santa Cena",
  "Reunion Jovenes",
  "Reunion Varones",
  "Reunion Mujeres",
  "Taller"
];

// ================= HELPERS =================
function pad(n) {
  return String(n).padStart(2, "0");
}

function fechaYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escaparHtml(txt = "") {
  return String(txt).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nombreMes(d) {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function abrirModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;

  const fecha = document.getElementById("subidosFecha");
  const archivo = document.getElementById("subidosArchivo");
  const descripcion = document.getElementById("subidosDescripcion");
  const estado = document.getElementById("subidosEstado");

  if (archivo) archivo.value = "";
  if (descripcion) descripcion.value = "";
  if (estado) estado.textContent = "";
  if (fecha) fecha.value = fechaYMD(new Date());

  m.style.display = "flex";
  m.setAttribute("aria-hidden", "false");
}

window.cerrarModalSubidos = function cerrarModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;
  m.style.display = "none";
  m.setAttribute("aria-hidden", "true");
};

function poblarEtiquetas() {
  const sel = document.getElementById("subidosEtiqueta");
  if (!sel) return;

  const lista = Array.from(new Set([...(subidosEtiquetas || []), ...ETIQUETAS_DEFAULT])).sort((a, b) => a.localeCompare(b));
  sel.innerHTML = `<option value="">Seleccionar…</option>` +
    lista.map(x => `<option value="${escaparHtml(x)}">${escaparHtml(x)}</option>`).join("");
}

function renderMesTitulo() {
  const el = document.getElementById("subidosMesTitulo");
  if (!el) return;
  el.textContent = nombreMes(subidosMesActual);
}

function agruparPorFecha(items) {
  const map = {};
  items.forEach(it => {
    const f = it.fechaEvento || "";
    if (!f) return;
    map[f] = map[f] || [];
    map[f].push(it);
  });
  return map;
}

function renderCalendario() {
  const box = document.getElementById("subidosCalendario");
  if (!box) return;

  const year = subidosMesActual.getFullYear();
  const month = subidosMesActual.getMonth();

  const hoy = new Date();
  const hoyYMD = fechaYMD(hoy);

  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const diasMes = ultimoDia.getDate();

  let inicioSemana = primerDia.getDay();
  if (inicioSemana === 0) inicioSemana = 7; // domingo = 7

  const porFecha = agruparPorFecha(subidosItems);

  const diasHeader = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  let html = `
    <div class="subidos-cal-wrap">
      <div class="subidos-cal-head">
        ${diasHeader.map(d => `<div>${d}</div>`).join("")}
      </div>

      <div class="subidos-cal-grid">
  `;

  for (let i = 1; i < inicioSemana; i++) {
    html += `<div class="subidos-day empty" aria-hidden="true"></div>`;
  }

  for (let dia = 1; dia <= diasMes; dia++) {
    const f = `${year}-${pad(month + 1)}-${pad(dia)}`;
    const itemsDia = (porFecha[f] || []).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
    const esHoy = f === hoyYMD;

    html += `
      <div class="subidos-day ${esHoy ? "today" : ""}">
        <div class="subidos-day-num">${dia}</div>
        <div class="subidos-day-events">
          ${itemsDia.slice(0, 3).map(it => {
            const color = colorEtiquetaSubidos(it.etiqueta || "");
            const titulo = escaparHtml(it.etiqueta || "Subido");
            const desc = escaparHtml(it.descripcion || "");
            const fechaLegible = new Date((it.fechaEvento || f) + "T00:00:00").toLocaleDateString("es-AR");

            return `
              <button
                type="button"
                class="subidos-chip"
                onclick="abrirSubidoDesdeCalendario('${it.id}')"
                onmouseenter="subidosMostrarPreview(event, '${it.id}')"
                onmousemove="subidosMoverPreview(event)"
                onmouseleave="subidosOcultarPreview()"
                ontouchstart="subidosMostrarPreview(event, '${it.id}')"
                ontouchend="setTimeout(subidosOcultarPreview, 1200)"
                style="background:${color.bg}; color:${color.fg};"
                title="${titulo}"
                data-id="${it.id}"
                data-tag="${titulo}"
                data-desc="${desc}"
                data-date="${fechaLegible}"
              >
                ${titulo}
              </button>
            `;
          }).join("")}

          ${itemsDia.length > 3 ? `
            <div class="subidos-more">+ ${itemsDia.length - 3} más</div>
          ` : ``}
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  box.innerHTML = html;
}

function iconoSegunTipo(tipo = "") {
  if (tipo.startsWith("image/")) return "fa-image";
  if (tipo.startsWith("video/")) return "fa-video";
  if (tipo.startsWith("audio/")) return "fa-headphones";
  return "fa-file";
}

function colorEtiquetaSubidos(etiqueta = "") {
  const t = String(etiqueta).trim().toLowerCase();

  const mapa = {
    "predica":         { bg: "#dbeafe", fg: "#111111" },
    "anuncio":         { bg: "#fef3c7", fg: "#111111" },
    "plan":            { bg: "#dcfce7", fg: "#111111" },
    "racimo":          { bg: "#f3e8ff", fg: "#111111" },
    "oración":         { bg: "#fee2e2", fg: "#111111" },
    "culto":           { bg: "#e0f2fe", fg: "#111111" },
    "santa cena":      { bg: "#fde68a", fg: "#111111" },
    "reunion jovenes": { bg: "#ddd6fe", fg: "#111111" },
    "reunion varones": { bg: "#d1fae5", fg: "#111111" },
    "reunion mujeres": { bg: "#fbcfe8", fg: "#111111" },
    "taller":          { bg: "#e5e7eb", fg: "#111111" }
  };

  return mapa[t] || { bg: "#e8f0fe", fg: "#111111" };
}

window.subidosMostrarPreview = function subidosMostrarPreview(ev, id) {
  const it = subidosItems.find(x => x.id === id);
  if (!it) return;

  let tt = document.getElementById("subidosPreviewTooltip");
  if (!tt) {
    tt = document.createElement("div");
    tt.id = "subidosPreviewTooltip";
    document.body.appendChild(tt);
  }

  const color = colorEtiquetaSubidos(it.etiqueta || "");
  const fechaLegible = it.fechaEvento
    ? new Date(it.fechaEvento + "T00:00:00").toLocaleDateString("es-AR")
    : "";

  const esImg = (it.mimeType || "").startsWith("image/");
  const esVideo = (it.mimeType || "").startsWith("video/");

  tt.innerHTML = `
    <div class="tt-tag" style="background:${color.bg}; color:${color.fg};">
      ${escaparHtml(it.etiqueta || "Subido")}
    </div>
    <div class="tt-date">${escaparHtml(fechaLegible)}</div>
    ${
      esImg ? `<img src="${it.url}" alt="Preview">` :
      esVideo ? `<video src="${it.url}" muted playsinline preload="metadata"></video>` :
      ``
    }
    <div class="tt-desc">${escaparHtml(it.descripcion || "")}</div>
  `;

  tt.style.display = "block";
  subidosMoverPreview(ev);
};

window.subidosMoverPreview = function subidosMoverPreview(ev) {
  const tt = document.getElementById("subidosPreviewTooltip");
  if (!tt) return;

  const x = (ev.touches?.[0]?.clientX ?? ev.clientX ?? 0) + 14;
  const y = (ev.touches?.[0]?.clientY ?? ev.clientY ?? 0) + 14;

  const maxX = window.innerWidth - tt.offsetWidth - 10;
  const maxY = window.innerHeight - tt.offsetHeight - 10;

  tt.style.left = Math.max(10, Math.min(x, maxX)) + "px";
  tt.style.top = Math.max(10, Math.min(y, maxY)) + "px";
};

window.subidosOcultarPreview = function subidosOcultarPreview() {
  const tt = document.getElementById("subidosPreviewTooltip");
  if (tt) tt.style.display = "none";
};

function renderFeed() {
  const feed = document.getElementById("subidosFeed");
  if (!feed) return;

  if (!subidosItems.length) {
    feed.innerHTML = `
      <div style="opacity:.8; padding:12px; border:1px dashed #ccc; border-radius:12px;">
        No hay archivos subidos todavía.
      </div>
    `;
    return;
  }

  feed.innerHTML = subidosItems.map(it => {
    const fechaTxt = it.fechaEvento
      ? new Date(it.fechaEvento + "T00:00:00").toLocaleDateString("es-AR")
      : "";

    const esImg = (it.mimeType || "").startsWith("image/");
    const esVideo = (it.mimeType || "").startsWith("video/");
    const esAudio = (it.mimeType || "").startsWith("audio/");

    return `
      <div id="subido-${it.id}" style="border:1px solid #e5e5e5; border-radius:14px; padding:12px; background:#fff; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
              <b>${escaparHtml(it.etiqueta || "Subido")}</b>
              <span style="opacity:.65; font-size:12px;">${fechaTxt}</span>
            </div>
            <div style="margin-top:6px; opacity:.9;">${escaparHtml(it.descripcion || "")}</div>
          </div>
        </div>

        <div style="margin-top:10px;">
          ${
            esImg ? `<img src="${it.url}" alt="Subido" style="width:100%; max-width:520px; border-radius:12px; display:block;">` :
            esVideo ? `<video src="${it.url}" controls preload="metadata" style="width:100%; max-width:520px; border-radius:12px; display:block;"></video>` :
            esAudio ? `<audio src="${it.url}" controls preload="metadata" style="width:100%;"></audio>` :
            `<a href="${it.url}" target="_blank" rel="noopener">Abrir archivo</a>`
          }
        </div>
      </div>
    `;
  }).join("");
}

window.abrirSubidoDesdeCalendario = function abrirSubidoDesdeCalendario(id) {
  const el = document.getElementById("subido-" + id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
};

function refrescarSubidos() {
  renderMesTitulo();
  renderCalendario();
  renderFeed();

  const btnNuevo = document.getElementById("btnSubidoNuevo");
  if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";
}

async function guardarSubido() {
  try {
    if (!subidosUID) {
      alert("Necesitás iniciar sesión.");
      return;
    }

    if (!subidosEsAdmin) {
      alert("Solo admin puede subir archivos.");
      return;
    }

    const inpFile = document.getElementById("subidosArchivo");
    const inpFecha = document.getElementById("subidosFecha");
    const inpEtiqueta = document.getElementById("subidosEtiqueta");
    const inpDesc = document.getElementById("subidosDescripcion");
    const estado = document.getElementById("subidosEstado");

    const file = inpFile?.files?.[0];
    const fechaEvento = (inpFecha?.value || "").trim();
    const etiqueta = (inpEtiqueta?.value || "").trim();
    const descripcion = (inpDesc?.value || "").trim();

    if (!file) {
      alert("Elegí un archivo.");
      return;
    }

    if (!fechaEvento) {
      alert("Completá la fecha.");
      return;
    }

    if (!etiqueta) {
      alert("Elegí una etiqueta.");
      return;
    }

    if (estado) estado.textContent = "Subiendo archivo...";

    const ts = Date.now();
    const limpio = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `subidos_iglesia/${subidosUID}/${ts}_${limpio}`;
    const storageRef = sRef(storage, path);

    await uploadBytes(storageRef, file, { contentType: file.type || "application/octet-stream" });
    const url = await getDownloadURL(storageRef);

    const nuevoRef = push(ref(db, "subidosIglesia"));
    await set(nuevoRef, {
      fecha: ts,
      fechaEvento,
      etiqueta,
      descripcion,
      url,
      mimeType: file.type || "",
      fileName: file.name || "",
      storagePath: path,
      uidCreador: subidosUID
    });

    const etiquetaNormalizada = etiqueta.trim();
    if (etiquetaNormalizada) {
      const lista = Array.from(new Set([...(subidosEtiquetas || []), etiquetaNormalizada]));
      await set(ref(db, "subidosEtiquetas"), lista);
    }

    if (estado) estado.textContent = "✅ Guardado";
    cerrarModalSubidos();
  } catch (e) {
    console.error("Error guardando subido:", e);
    const estado = document.getElementById("subidosEstado");
    if (estado) estado.textContent = "❌ No se pudo guardar";
    alert("No se pudo guardar el archivo.");
  }
}

function initSubidosBotones() {
  const btnNuevo = document.getElementById("btnSubidoNuevo");
  const btnAnt = document.getElementById("btnSubidosMesAnt");
  const btnSig = document.getElementById("btnSubidosMesSig");
  const btnGuardar = document.getElementById("btnGuardarSubido");
  const btnAgregarEtiqueta = document.getElementById("btnAgregarEtiquetaSubidos");

  if (btnNuevo) btnNuevo.onclick = abrirModalSubidos;

  if (btnAnt) {
    btnAnt.onclick = () => {
      subidosMesActual = new Date(subidosMesActual.getFullYear(), subidosMesActual.getMonth() - 1, 1);
      refrescarSubidos();
    };
  }

  if (btnSig) {
    btnSig.onclick = () => {
      subidosMesActual = new Date(subidosMesActual.getFullYear(), subidosMesActual.getMonth() + 1, 1);
      refrescarSubidos();
    };
  }

  if (btnGuardar) btnGuardar.onclick = guardarSubido;

  if (btnAgregarEtiqueta) {
    btnAgregarEtiqueta.onclick = async () => {
      if (!subidosEsAdmin) return;

      const nueva = prompt("Nueva etiqueta:");
      if (!nueva || !nueva.trim()) return;

      const limpia = nueva.trim();
      const lista = Array.from(new Set([...(subidosEtiquetas || []), limpia])).sort((a, b) => a.localeCompare(b));

      try {
        await set(ref(db, "subidosEtiquetas"), lista);
      } catch (e) {
        console.error(e);
        alert("No se pudo guardar la etiqueta.");
      }
    };
  }
}

function initLecturas() {
  onValue(ref(db, "subidosIglesia"), (s) => {
    const data = s.val() || {};
    subidosItems = Object.entries(data)
      .map(([id, obj]) => ({ id, ...(obj || {}) }))
      .sort((a, b) => {
        const fa = a.fechaEvento || "";
        const fb = b.fechaEvento || "";
        if (fa !== fb) return fb.localeCompare(fa);
        return (b.fecha || 0) - (a.fecha || 0);
      });

    refrescarSubidos();
  });

  onValue(ref(db, "subidosEtiquetas"), (s) => {
    const data = s.val();
    subidosEtiquetas = Array.isArray(data) ? data : [...ETIQUETAS_DEFAULT];
    poblarEtiquetas();
    refrescarSubidos();
  });

  const esperarAuth = () => {
    subidosUID = window.__UID || null;
    subidosEsAdmin = !!window.__ES_ADMIN;

    const btnNuevo = document.getElementById("btnSubidoNuevo");
    if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";

    setTimeout(esperarAuth, 1200);
  };
  esperarAuth();
}

document.addEventListener("DOMContentLoaded", () => {
  initSubidosBotones();
  poblarEtiquetas();
  refrescarSubidos();
  initLecturas();
});
