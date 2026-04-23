// ================= SUBIDOS.JS =================
const { db } = window.__FB || {};
const FB = window.__FB_API || {};

const {
  ref,
  set,
  onValue,
  push
} = FB;

const R2_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirImagenR2";

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
function esPredicaSubidos(etiqueta = "") {
  return normalizarEtiquetaSubidos(etiqueta) === "predica";
}

function limpiarPreviewCitaPredica(card) {
  if (!card) return;

  const info = card.querySelector(".subidosCitaSeleccionInfo");
  const ref = card.querySelector(".subidosCitaReferencia");
  const txt = card.querySelector(".subidosCitaTexto");
  const btnExpandir = card.querySelector(".subidosCitaExpandir");

  if (info) info.style.display = "none";
  if (ref) ref.textContent = "";
  if (txt) {
    txt.textContent = "";
    txt.style.maxHeight = "240px";
    txt.style.overflow = "auto";
  }
  if (btnExpandir) {
    btnExpandir.style.display = "none";
    btnExpandir.dataset.expandido = "0";
    btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  }
}

function limpiarCitaPredica(card) {
  if (!card) return;

  const libro = card.querySelector(".subidosCitaLibro");
  const cap = card.querySelector(".subidosCitaCapitulo");
  const versWrap = card.querySelector(".subidosCitaVersiculos");
  const versEmpty = card.querySelector(".subidosCitaVersiculosEmpty");
  const nota = card.querySelector(".subidosCitaNota");

  if (libro) libro.value = "";
  if (cap) {
    cap.innerHTML = `<option value="">Seleccionar capítulo…</option>`;
    cap.disabled = true;
  }
  if (versWrap) versWrap.innerHTML = "";
  if (versEmpty) versEmpty.style.display = "";
  if (nota) nota.value = "";

  delete card.dataset.libro;
  delete card.dataset.capitulo;
  delete card.dataset.desde;
  delete card.dataset.hasta;
  delete card.dataset.referencia;
  delete card.dataset.texto;

  limpiarPreviewCitaPredica(card);
}

function renumerarCitasPredica() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  [...wrap.children].forEach((card, i) => {
    const ttl = card.querySelector(".subidosCitaTitulo");
    if (ttl) ttl.textContent = `Cita ${i + 1}`;
  });
}

window.subidosAgregarCitaPredica = function subidosAgregarCitaPredica() {
  const tpl = document.getElementById("tplSubidosCitaPredica");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!tpl || !wrap) return;

  const node = tpl.content.firstElementChild.cloneNode(true);

  const btnEliminar = node.querySelector(".subidosCitaEliminar");
  const btnLimpiar = node.querySelector(".subidosCitaLimpiar");
  const btnExpandir = node.querySelector(".subidosCitaExpandir");

  if (btnEliminar) {
    btnEliminar.onclick = () => {
      node.remove();
      renumerarCitasPredica();
    };
  }

  if (btnLimpiar) {
    btnLimpiar.onclick = () => limpiarCitaPredica(node);
  }

  if (btnExpandir) {
    btnExpandir.onclick = () => {
      const txt = node.querySelector(".subidosCitaTexto");
      if (!txt) return;

      const expandido = btnExpandir.dataset.expandido === "1";

      if (expandido) {
        txt.style.maxHeight = "240px";
        txt.style.overflow = "auto";
        btnExpandir.dataset.expandido = "0";
        btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
      } else {
        txt.style.maxHeight = "420px";
        txt.style.overflow = "auto";
        btnExpandir.dataset.expandido = "1";
        btnExpandir.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
      }
    };
  }

  wrap.appendChild(node);
  renumerarCitasPredica();
};

function resetPredicaSubidosUI() {
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
  const version = document.getElementById("subidosPredicaVersion");

  if (box) box.style.display = "none";
  if (wrap) wrap.innerHTML = "";
  if (notaFinal) notaFinal.value = "";
  if (version) version.value = "RV1960";
}

function actualizarPredicaSubidosUI() {
  const sel = document.getElementById("subidosEtiqueta");
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");

  if (!sel || !box || !wrap) return;

  const mostrar = esPredicaSubidos(sel.value);

  box.style.display = mostrar ? "block" : "none";

  if (!mostrar) {
    if (wrap) wrap.innerHTML = "";
    const notaFinal = document.getElementById("subidosPredicaNotaFinal");
    if (notaFinal) notaFinal.value = "";
    return;
  }

  if (!wrap.children.length) {
    window.subidosAgregarCitaPredica();
  }
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function fechaYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function escaparHtml(txt = "") {
  return String(txt).replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function blobToBase64(blob){
  return await new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.readAsDataURL(blob);
  });
}

async function subirArchivoAR2DesdeWeb(file, folder = "subidos"){
  const fileBase64 = await blobToBase64(file);

  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName: file.name || `archivo_${Date.now()}`,
      contentType: file.type || "application/octet-stream",
      folder
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir archivo a R2");
  }

  return data;
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
  const etiqueta = document.getElementById("subidosEtiqueta");

  if (archivo) archivo.value = "";
  if (descripcion) descripcion.value = "";
  if (estado) estado.textContent = "";
  if (fecha) fecha.value = fechaYMD(new Date());
  if (etiqueta) etiqueta.value = "";

  resetPredicaSubidosUI();
  actualizarPredicaSubidosUI();

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

function normalizarEtiquetaSubidos(txt = "") {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const ETIQUETAS_COLOR = {
  "predica": "#ffcb00",
  "anuncio": "#ff0000",
  "plan": "#d2ff00",
  "racimo": "#00faff",
  "oracion": "#ff8000",
  "culto": "#fff600",
  "santa cena": "#a800ff",
  "reunion jovenes": "#00ff79",
  "reunion de jovenes": "#00ff79",
  "reunion varones": "#008fff",
  "reunion de varones": "#008fff",
  "reunion mujeres": "#ff00a0",
  "reunion de mujeres": "#ff00a0",
  "taller": "#7200ff",
  "retiro varones": "#0004ff",
  "retiro de varones": "#0004ff",
  "ayuno": "#ff4da6"
};

function colorEtiquetaSubidos(etiqueta = "") {
  const t = normalizarEtiquetaSubidos(etiqueta);
  const color = ETIQUETAS_COLOR[t] || "#dbeafe";

  return {
    bg: color,
    fg: "#ffffff"
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
  if (!el) return;

  el.scrollIntoView({
    behavior: "smooth",
    inline: "center",
    block: "nearest"
  });

  document.querySelectorAll(".subidos-feed-card.subidos-focus").forEach(x => {
    x.classList.remove("subidos-focus");
  });

  el.classList.add("subidos-focus");

  setTimeout(() => {
    el.classList.remove("subidos-focus");
  }, 1800);
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

    const subida = await subirArchivoAR2DesdeWeb(file, "subidos");

    const nuevoRef = push(ref(db, "subidosIglesia"));
    await set(nuevoRef, {
      fecha: ts,
      fechaEvento,
      etiqueta,
      descripcion,
      url: subida.url,
      r2Key: subida.key || "",
      mimeType: file.type || "",
      fileName: file.name || "",
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
    alert("No se pudo guardar el archivo.\n\n" + (e?.message || e));
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
  const selEtiqueta = document.getElementById("subidosEtiqueta");
  const btnAgregarCita = document.getElementById("btnSubidosAgregarCita");

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
    if (selEtiqueta && !selEtiqueta.__predicaHook) {
    selEtiqueta.__predicaHook = true;
    selEtiqueta.addEventListener("change", actualizarPredicaSubidosUI);
  }

  if (btnAgregarCita && !btnAgregarCita.__citaHook) {
    btnAgregarCita.__citaHook = true;
    btnAgregarCita.addEventListener("click", () => {
      window.subidosAgregarCitaPredica();
    });
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
