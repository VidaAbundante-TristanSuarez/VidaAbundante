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
  if (inicioSemana === 0) inicioSemana = 7;

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

            return `
              <button
                type="button"
                class="subidos-chip"
                onclick="abrirSubidoDesdeCalendario('${it.id}')"
                style="background:${color.bg}; color:${color.fg};"
                title="${titulo}"
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

const ETIQUETAS_COLOR = {
  "predica": "#ffcb00",
  "anuncio": "#ff0000",
  "plan": "#d2ff00",
  "racimo": "#00faff",
  "oración": "#ff8000",
  "culto": "#fff600",
  "santa cena": "#a800ff",
  "reunion jovenes": "#00ff79",
  "reunion varones": "#008fff",
  "reunion mujeres": "#ff00a0",
  "taller": "#7200ff",
  "retiro varones": "#0004ff"
};

function colorEtiquetaSubidos(etiqueta = "") {
  const t = String(etiqueta).trim().toLowerCase();

  const color = ETIQUETAS_COLOR[t] || "#e8f0fe";

  return {
    bg: color,
    fg: "#000"
  };
}

window.subidosMostrarPreview = function subidosMostrarPreview() {};
window.subidosMoverPreview = function subidosMoverPreview() {};
window.subidosOcultarPreview = function subidosOcultarPreview() {};

function renderFeed() {
  const feed = document.getElementById("subidosFeed");
  if (!feed) return;

  if (!subidosItems.length) {
    feed.innerHTML = `
      <div class="subidos-feed-card" style="opacity:.85;">
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
    const color = colorEtiquetaSubidos(it.etiqueta || "");

    return `
      <div id="subido-${it.id}" class="subidos-feed-card">
        <div class="subidos-feed-head">
          <div class="subidos-feed-left">
            <div class="subidos-feed-badges">
              <span class="subidos-badge" style="background:${color.bg}; color:${color.fg};">
                <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
                ${escaparHtml(it.etiqueta || "Subido")}
              </span>
              <span class="subidos-feed-date">${fechaTxt}</span>
            </div>

            ${
              it.descripcion
                ? `<div class="subidos-feed-desc">${escaparHtml(it.descripcion || "")}</div>`
                : ``
            }
          </div>
        </div>

        <div class="subidos-media">
          ${
            esImg
              ? `
                <div class="subidos-media-frame is-image">
                  <img src="${it.url}" alt="${escaparHtml(it.fileName || "Imagen subida")}" loading="lazy">
                </div>
              `
              : esVideo
              ? `
                <div class="subidos-media-frame is-video">
                  <video src="${it.url}" controls preload="metadata"></video>
                </div>
              `
              : esAudio
              ? `
                <div class="subidos-media-frame is-audio">
                  <audio src="${it.url}" controls preload="metadata"></audio>
                </div>
              `
              : `
                <div class="subidos-media-frame is-file">
                  <a href="${it.url}" download="${escaparHtml(it.fileName || "archivo")}">Descargar archivo</a>
                </div>
              `
          }
        </div>

        <div class="subidos-feed-actions">
          <a href="${it.url}" download="${escaparHtml(it.fileName || "archivo")}" title="Descargar">
            <i class="fa-solid fa-download"></i>
          </a>

          <button type="button" onclick="compartirSubido('${it.id}')" title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          ${
            subidosEsAdmin
              ? `
                <button type="button" class="subidosDanger" onclick="borrarSubido('${it.id}')" title="Borrar">
                  <i class="fa-solid fa-trash"></i>
                </button>
              `
              : ``
          }
        </div>
      </div>
    `;
  }).join("");
}

window.abrirSubidoDesdeCalendario = function abrirSubidoDesdeCalendario(id) {
  const el = document.getElementById("subido-" + id);
  const feed = document.getElementById("subidosFeed");
  if (!el || !feed) return;

  const left = el.offsetLeft - (feed.clientWidth / 2) + (el.clientWidth / 2);

  feed.scrollTo({
    left,
    behavior: "smooth"
  });
};

window.compartirSubido = async function compartirSubido(id) {
  try {
    const it = subidosItems.find(x => x.id === id);
    if (!it?.url) {
      alert("No se encontró el archivo.");
      return;
    }

    const texto = [it.etiqueta || "Subido", it.descripcion || ""]
      .filter(Boolean)
      .join(" — ");

    if (navigator.share) {
      await navigator.share({
        title: it.etiqueta || "Subido",
        text: texto,
        url: it.url
      });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(it.url);
      alert("Link copiado.");
      return;
    }

    prompt("Copiá este link:", it.url);
  } catch (e) {
    console.error("Error compartiendo:", e);
  }
};

window.borrarSubido = async function borrarSubido(id) {
  try {
    if (!subidosEsAdmin) {
      alert("Solo admin puede borrar archivos.");
      return;
    }

    const it = subidosItems.find(x => x.id === id);
    if (!it) {
      alert("No se encontró el archivo.");
      return;
    }

    const ok = confirm("¿Querés borrar este archivo?");
    if (!ok) return;

    await set(ref(db, `subidosIglesia/${id}`), null);
  } catch (e) {
    console.error("Error borrando subido:", e);
    alert("No se pudo borrar el archivo.");
  }
};

function refrescarSubidos() {
  renderMesTitulo();
  renderCalendario();
  renderFeed();

  const btnNuevo = document.getElementById("btnSubidoNuevo");
  if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";
}

let subidosGuardando = false;

async function guardarSubido() {
  if (subidosGuardando) return;

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
    const btnGuardar = document.getElementById("btnGuardarSubido");

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

    subidosGuardando = true;
    if (btnGuardar) btnGuardar.disabled = true;
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
  } finally {
    subidosGuardando = false;
    const btnGuardar = document.getElementById("btnGuardarSubido");
    if (btnGuardar) btnGuardar.disabled = false;
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
  const uidPrevio = subidosUID;
  const adminPrevio = subidosEsAdmin;

  subidosUID = window.__UID || null;
  subidosEsAdmin = !!window.__ES_ADMIN;

  const btnNuevo = document.getElementById("btnSubidoNuevo");
  if (btnNuevo) btnNuevo.style.display = subidosEsAdmin ? "inline-flex" : "none";

  if (uidPrevio !== subidosUID || adminPrevio !== subidosEsAdmin) {
    refrescarSubidos();
  }

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
