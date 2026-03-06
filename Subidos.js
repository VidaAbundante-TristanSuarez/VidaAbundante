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

const SUBIDOS_COLOR_ETIQUETA = {
  "Predica": "#fbbc04",
  "Anuncio": "#a7ff83",
  "Plan": "#aecbfa",
  "Racimo": "#f28b82",
  "Oración": "#d7aefb",
  "Culto": "#fdcfe8",
  "Santa Cena": "#ffe08a",
  "Reunion Jovenes": "#81c995",
  "Reunion Varones": "#9fc5e8",
  "Reunion Mujeres": "#f6b26b",
  "Taller": "#c9daf8"
};

function colorEtiqueta(nombre = "") {
  return SUBIDOS_COLOR_ETIQUETA[nombre] || "#bcdcff";
}

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

  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const diasMes = ultimoDia.getDate();

  let inicioSemana = primerDia.getDay();
  if (inicioSemana === 0) inicioSemana = 7;

  const hoy = new Date();
  const hoyYMD = fechaYMD(hoy);

  const porFecha = agruparPorFecha(subidosItems);

  let html = `
    <div class="subidos-cal-wrap">
      <div class="subidos-cal-head">
        ${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(d => `<div>${d}</div>`).join("")}
      </div>
      <div class="subidos-cal-grid">
  `;

  for (let i = 1; i < inicioSemana; i++) {
    html += `<div class="subidos-day empty"></div>`;
  }

  for (let dia = 1; dia <= diasMes; dia++) {
    const f = `${year}-${pad(month + 1)}-${pad(dia)}`;
    const itemsDia = (porFecha[f] || []).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
    const esHoy = f === hoyYMD;

    html += `
      <div class="subidos-day ${esHoy ? "today" : ""}">
        <div class="subidos-day-num">${dia}</div>
        <div class="subidos-day-events">
          ${itemsDia.slice(0, 3).map(it => `
            <button type="button"
              class="subidos-chip"
              style="background:${colorEtiqueta(it.etiqueta)}"
              onclick="abrirSubidoDesdeCalendario('${it.id}')"
              onmouseenter="subidosTooltipShow(event, '${it.id}')"
              onmousemove="subidosTooltipMove(event)"
              onmouseleave="subidosTooltipHide()">
              ${escaparHtml(it.etiqueta || "Subido")}
            </button>
          `).join("")}

          ${itemsDia.length > 3 ? `
            <button type="button"
              class="subidos-more"
              onclick="abrirSubidoDesdeCalendario('${itemsDia[0].id}')">
              + ${itemsDia.length - 3} más
            </button>
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

function renderAgenda() {
  const box = document.getElementById("subidosAgenda");
  if (!box) return;

  const year = subidosMesActual.getFullYear();
  const month = subidosMesActual.getMonth();

  const inicio = `${year}-${pad(month + 1)}-01`;
  const fin = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`;

  const itemsMes = subidosItems.filter(it => {
    const f = it.fechaEvento || "";
    return f >= inicio && f <= fin;
  });

  if (!itemsMes.length) {
    box.innerHTML = "";
    return;
  }

  const porFecha = agruparPorFecha(itemsMes);
  const fechas = Object.keys(porFecha).sort((a, b) => a.localeCompare(b));

  box.innerHTML = fechas.map(f => {
    const fechaBonita = new Date(f + "T00:00:00").toLocaleDateString("es-AR", {
      weekday: "long",
      day: "2-digit",
      month: "long"
    });

    const lista = porFecha[f].sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

    return `
      <div class="subidos-agenda-card">
        <div class="subidos-agenda-date">${fechaBonita}</div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${lista.map(it => `
            <button type="button"
              onclick="abrirSubidoDesdeCalendario('${it.id}')"
              style="
                border:none;
                cursor:pointer;
                text-align:left;
                border-radius:10px;
                padding:9px 10px;
                background:${colorEtiqueta(it.etiqueta)};
                color:#111;
                font-weight:700;">
              ${escaparHtml(it.etiqueta || "Subido")}
              ${it.descripcion ? `— ${escaparHtml(it.descripcion.slice(0, 90))}` : ``}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function iconoSegunTipo(tipo = "") {
  if (tipo.startsWith("image/")) return "fa-image";
  if (tipo.startsWith("video/")) return "fa-video";
  if (tipo.startsWith("audio/")) return "fa-headphones";
  return "fa-file";
}

function renderFeed() {
  const feed = document.getElementById("subidosFeed");
  if (!feed) return;

  if (!subidosItems.length) {
    feed.innerHTML = `
      <div class="subidos-feed-card">
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
      <div id="subido-${it.id}" class="subidos-feed-card">
        <div class="subidos-feed-head">
          <div class="subidos-feed-left">
            <div class="subidos-feed-badges">
              <span class="subidos-badge" style="background:${colorEtiqueta(it.etiqueta)};">
                <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
                ${escaparHtml(it.etiqueta || "Subido")}
              </span>
              <span class="subidos-feed-date">${fechaTxt}</span>
            </div>
            <div class="subidos-feed-desc">${escaparHtml(it.descripcion || "")}</div>
          </div>
        </div>

        <div class="subidos-media">
          ${
            esImg ? `<img src="${it.url}" alt="Subido" loading="lazy">` :
            esVideo ? `<video src="${it.url}" controls preload="metadata"></video>` :
            esAudio ? `<audio src="${it.url}" controls preload="metadata"></audio>` :
            `<a href="${it.url}" target="_blank" rel="noopener">Abrir archivo</a>`
          }
        </div>

        <div class="subidos-feed-actions">
          <a href="${it.url}" target="_blank" rel="noopener">Abrir</a>
          ${esImg ? `<button type="button" onclick="compartirSubidoImagen('${it.id}')">Compartir</button>` : ``}
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
  renderAgenda();
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

window.compartirSubidoImagen = async function compartirSubidoImagen(id) {
  const it = subidosItems.find(x => x.id === id);
  if (!it) return;

  if (!(it.mimeType || "").startsWith("image/")) {
    alert("Solo se puede compartir directo en imágenes.");
    return;
  }

  try {
    const resp = await fetch(it.url);
    const blob = await resp.blob();
    const file = new File([blob], it.fileName || "imagen.png", { type: blob.type || "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: it.etiqueta || "Imagen",
        text: it.descripcion || ""
      });
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(it.url);
      alert("Tu navegador no permite compartir directo. Copié el enlace al portapapeles.");
      return;
    }

    prompt("Copiá este enlace:", it.url);
  } catch (e) {
    console.error(e);
    alert("No se pudo compartir la imagen.");
  }
};
