import {
  ref,
  set,
  remove,
  onValue,
  get,
  push,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

/* ================= EDICIONES - MÓDULO =================
   - Recursos > Ediciones administra.
   - Compartidos abre la misma presentación.
   - Firebase RTDB guarda solo datos/URLs.
   - Archivos pesados van a R2.
========================================================= */

const R2_UPLOAD_URL_EDICIONES = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirImagenR2";

let edicionesIniciado = false;
let edicionesEscuchaActiva = false;
let edicionesCache = [];
let edicionEditId = null;

let edicionesStatsCache = {};
let edicionesStatsEscuchaActiva = false;

let edicionesGuardadasCache = {};
let edicionesGuardadasUid = null;
let edicionesGuardadasEscuchaActiva = false;

let edicionesDescargadasCache = {};
let edicionesDescargadasUid = null;
let edicionesDescargadasEscuchaActiva = false;

function ed$(id) {
  return document.getElementById(id);
}

function edDB() {
  return window.__FB?.db || null;
}

function edEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function edValor(v) {
  return String(v ?? "").trim();
}

function edKey(prefix = "p") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function edSafeName(name = "archivo") {
  return String(name)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

function edPaginasArray(edicion) {
  const pags = edicion?.paginas || {};
  const arr = Array.isArray(pags)
    ? pags.map((p, i) => ({ id: p.id || `p_${i}`, ...p }))
    : Object.entries(pags).map(([id, p]) => ({ id, ...(p || {}) }));

  return arr
    .filter(p => p && p.imagenUrl)
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

function edTieneAudio(edicion) {
  return edPaginasArray(edicion).some(p => p.audioEsUrl || p.audioEnUrl);
}

function edSetEstado(txt) {
  const el = ed$("edEstado");
  if (el) el.textContent = txt || "";
}

async function edEsperarDB(intentos = 30) {
  for (let i = 0; i < intentos; i++) {
    if (edDB()) return edDB();
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

/* ================= PANTALLA RECURSOS > EDICIONES ================= */

window.mostrarEdiciones = async () => {
  const cont = ed$("edicionesApp");
  if (!cont) return;

  const db = await edEsperarDB();
  if (!db) {
    cont.innerHTML = `
      <div style="padding:20px; text-align:center;">
        Firebase todavía no está listo.
      </div>
    `;
    return;
  }

  if (!edicionesIniciado) {
    cont.innerHTML = `
      <div id="edWrap">
        <div id="edTop">
          <h3>Ediciones</h3>

          ${window.__ES_ADMIN ? `
            <button id="edBtnNueva" type="button" onclick="abrirNuevaEdicion()" title="Nueva edición">
              <i class="fa-solid fa-circle-plus"></i>
            </button>
          ` : ``}
        </div>

        <div id="edLista"></div>
      </div>

      <div id="edModal" onclick="cerrarEditorEdicionFondo(event)">
        <div id="edModalBox" onclick="event.stopPropagation()">

          <div id="edModalHead">
            <h3 id="edModalTitulo">Nueva edición</h3>
            <button id="edCerrarModal" type="button" onclick="cerrarEditorEdicion()">×</button>
          </div>

          <form id="edForm" onsubmit="guardarEdicion(event)">
            <div class="ed-field">
              <label for="edTitulo">Título de la edición</label>
              <input id="edTitulo" type="text" required placeholder="Ej: David y Goliat" />
            </div>

            <div class="ed-field">
              <label for="edPortadaFile">Portada</label>
              <input id="edPortadaFile" type="file" accept="image/*" />
              <img id="edPortadaPreview" alt="Portada actual" style="display:none;">
              <div style="font-size:12px; opacity:.75;">
                Podés cargar una portada o se usará la primera imagen de la edición.
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
              <b>Páginas / cards</b>
              <button class="ed-pill-btn" type="button" onclick="edAgregarPagina()">
                <i class="fa-solid fa-circle-plus"></i> Agregar página
              </button>
            </div>

            <div id="edPaginasEditor"></div>

            <div id="edEstado"></div>

            <div class="ed-form-actions">
              <button class="ed-secondary" type="button" onclick="cerrarEditorEdicion()">Cancelar</button>
              <button id="edBtnGuardar" class="ed-primary" type="submit">
                Guardar edición
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    edicionesIniciado = true;
  }

iniciarEscuchaEdiciones();
iniciarEscuchaEdicionesStats();
iniciarEscuchaMisEdicionesGuardadas();
iniciarEscuchaMisEdicionesDescargadas();
};

function iniciarEscuchaEdiciones() {
  if (edicionesEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "ediciones"), (snap) => {
    const val = snap.val() || {};

    edicionesCache = Object.entries(val).map(([id, item]) => ({
      id,
      ...(item || {})
    }));

    edicionesCache.sort((a, b) => Number(b.actualizado || b.ts || 0) - Number(a.actualizado || a.ts || 0));

    window.__EDICIONES_CACHE = edicionesCache;

    renderEdiciones();
  }, (err) => {
    console.error("Error leyendo ediciones:", err);
  });

  edicionesEscuchaActiva = true;
}

function iniciarEscuchaEdicionesStats() {
  if (edicionesStatsEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "edicionesStats"), (snap) => {
    edicionesStatsCache = snap.val() || {};
    window.__EDICIONES_STATS = edicionesStatsCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesStatsEscuchaActiva = true;
}

function iniciarEscuchaMisEdicionesGuardadas() {
  const uid = edUidActual();

  if (!uid) {
    edicionesGuardadasCache = {};
    edicionesGuardadasUid = null;
    edicionesGuardadasEscuchaActiva = false;
    return;
  }

  if (edicionesGuardadasEscuchaActiva && edicionesGuardadasUid === uid) return;

  const db = edDB();
  if (!db) return;

  edicionesGuardadasUid = uid;

  onValue(ref(db, `panelEdiciones/${uid}`), (snap) => {
    edicionesGuardadasCache = snap.val() || {};
    window.__EDICIONES_GUARDADAS = edicionesGuardadasCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesGuardadasEscuchaActiva = true;
}

function edStats(id) {
  const s = edicionesStatsCache?.[id] || window.__EDICIONES_STATS?.[id] || {};
  return {
    guardados: Number(s.guardados || 0),
    descargas: Number(s.descargas || 0),
    compartidos: Number(s.compartidos || 0)
  };
}

function iniciarEscuchaMisEdicionesDescargadas() {
  const uid = edUidActual();

  if (!uid) {
    edicionesDescargadasCache = {};
    edicionesDescargadasUid = null;
    edicionesDescargadasEscuchaActiva = false;
    window.__EDICIONES_DESCARGADAS = {};
    return;
  }

  if (edicionesDescargadasEscuchaActiva && edicionesDescargadasUid === uid) return;

  const db = edDB();
  if (!db) return;

  edicionesDescargadasUid = uid;

  onValue(ref(db, `panelDescargasEdiciones/${uid}`), (snap) => {
    edicionesDescargadasCache = snap.val() || {};
    window.__EDICIONES_DESCARGADAS = edicionesDescargadasCache;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }
  });

  edicionesDescargadasEscuchaActiva = true;
}

function edEstaDescargada(id) {
  const local = localStorage.getItem(`edicion_descargada_${id}`) === "1";

  return !!(
    local ||
    edicionesDescargadasCache?.[id] ||
    window.__EDICIONES_DESCARGADAS?.[id]
  );
}

async function edMarcarDescargada(id) {
  try {
    localStorage.setItem(`edicion_descargada_${id}`, "1");
  } catch (_) {}

  const uid = edUidActual();
  if (!uid) {
    if (typeof renderEdiciones === "function") renderEdiciones();
    if (typeof window.renderCompartidos === "function") window.renderCompartidos();
    return;
  }

  const db = edDB();
  if (!db) return;

  const ed = await obtenerEdicion(id);
  const portadaUrl = ed?.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "";

  await set(ref(db, `panelDescargasEdiciones/${uid}/${id}`), {
    tipo: "edicion",
    edicionId: id,
    titulo: ed?.titulo || "Edición",
    portadaUrl,
    ts: Date.now()
  });
}

function edEstaGuardada(id) {
  return !!(
    edicionesGuardadasCache?.[id] ||
    window.__EDICIONES_GUARDADAS?.[id]
  );
}

async function edIncrementarStat(id, campo) {
  const db = edDB();
  if (!db || !id || !campo) return;

  try {
    await runTransaction(ref(db, `edicionesStats/${id}/${campo}`), (actual) => {
      return Number(actual || 0) + 1;
    });
  } catch (err) {
    console.warn("No pude incrementar estadística:", campo, err);
  }
}

function edActionButton({ title, onclick, icon, count = 0, saved = false, danger = false }) {
  return `
    <button
      type="button"
      class="${danger ? "ed-danger" : ""} ${saved ? "ed-action-saved" : ""}"
      onclick="${onclick}"
      title="${edEscape(title)}"
    >
      <span class="ed-action-wrap">
        <i class="${icon}"></i>
        <span class="ed-action-count">${Number(count || 0)}</span>
      </span>
    </button>
  `;
}

function renderEdiciones() {
  const lista = ed$("edLista");
  if (!lista) return;

  if (!edicionesCache.length) {
    lista.innerHTML = `
      <div id="edVacio">
        Todavía no hay ediciones cargadas.
      </div>
    `;
    return;
  }

  lista.innerHTML = edicionesCache.map(ed => {
    const titulo = edEscape(ed.titulo || "Sin título");
    const portada = ed.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "";
    const st = edStats(ed.id);
    const guardada = edEstaGuardada(ed.id);

    return `
      <article class="ed-card">
        <div class="ed-card-cover" onclick="abrirPresentacionEdicion('${ed.id}')" role="button" title="Abrir edición">
          ${portada ? `<img src="${edEscape(portada)}" alt="${titulo}" loading="lazy">` : `<span>Sin portada</span>`}
        </div>

        <div class="ed-card-body">
          <div class="ed-card-title">${titulo}</div>

          <div class="ed-card-actions">
            ${edActionButton({
              title: guardada ? "Guardado en Mi Panel" : "Guardar en Mi Panel",
              onclick: `guardarEdicionEnMiPanel('${ed.id}')`,
              icon: guardada ? "fa-solid fa-heart-circle-check" : "fa-solid fa-heart-circle-plus",
              count: st.guardados,
              saved: guardada
            })}

           ${edActionButton({
  title: edEstaDescargada(ed.id) ? "PDF descargado" : "Descargar PDF",
  onclick: `descargarEdicionPDF('${ed.id}')`,
  icon: edEstaDescargada(ed.id) ? "fa-solid fa-file-circle-check" : "fa-solid fa-file-pdf",
  count: st.descargas,
  saved: edEstaDescargada(ed.id)
})}
            ${edActionButton({
              title: "Compartir",
              onclick: `compartirEdicion('${ed.id}', 'redes')`,
              icon: "fa-solid fa-share-nodes",
              count: st.compartidos
            })}

            ${window.__ES_ADMIN ? `
              <button type="button" onclick="compartirEdicion('${ed.id}', 'compartidos')" title="Enviar a Compartidos">
                <i class="fa-solid fa-icons"></i>
              </button>

              <button type="button" onclick="editarEdicion('${ed.id}')" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button type="button" class="ed-danger" onclick="borrarEdicion('${ed.id}')" title="Borrar">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ``}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ================= EDITOR ================= */

window.abrirNuevaEdicion = () => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden crear ediciones.");
    return;
  }

  edicionEditId = null;

  const tituloModal = ed$("edModalTitulo");
  const modal = ed$("edModal");
  const form = ed$("edForm");
  const portadaPreview = ed$("edPortadaPreview");
  const paginas = ed$("edPaginasEditor");

  if (tituloModal) tituloModal.textContent = "Nueva edición";
  if (form) form.reset();
  if (portadaPreview) {
    portadaPreview.style.display = "none";
    portadaPreview.src = "";
  }
  if (paginas) paginas.innerHTML = "";

  edAgregarPagina();

  edSetEstado("");

  if (modal) modal.style.display = "flex";
};

window.editarEdicion = async (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden editar ediciones.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  edicionEditId = id;

  const tituloModal = ed$("edModalTitulo");
  const modal = ed$("edModal");
  const form = ed$("edForm");
  const inputTitulo = ed$("edTitulo");
  const portadaPreview = ed$("edPortadaPreview");
  const paginas = ed$("edPaginasEditor");

  if (tituloModal) tituloModal.textContent = "Editar edición";
  if (form) form.reset();
  if (inputTitulo) inputTitulo.value = ed.titulo || "";

  if (portadaPreview && ed.portadaUrl) {
    portadaPreview.src = ed.portadaUrl;
    portadaPreview.style.display = "block";
    portadaPreview.dataset.url = ed.portadaUrl;
  } else if (portadaPreview) {
    portadaPreview.src = "";
    portadaPreview.dataset.url = "";
    portadaPreview.style.display = "none";
  }

  if (paginas) paginas.innerHTML = "";

  const arr = edPaginasArray(ed);
  if (arr.length) {
    arr.forEach(p => edAgregarPagina(p));
  } else {
    edAgregarPagina();
  }

  edSetEstado("");

  if (modal) modal.style.display = "flex";
};

window.edAgregarPagina = (data = {}) => {
  const wrap = ed$("edPaginasEditor");
  if (!wrap) return;

  const id = data.id || edKey("p");

  const div = document.createElement("div");
  div.className = "ed-page-editor";
  div.dataset.pageId = id;
  div.dataset.imagenUrl = data.imagenUrl || "";
  div.dataset.audioEsUrl = data.audioEsUrl || "";
  div.dataset.audioEnUrl = data.audioEnUrl || "";

  const numero = wrap.children.length + 1;

  div.innerHTML = `
    <div class="ed-page-head">
      <b>Página ${numero}</b>
      <button type="button" onclick="edQuitarPagina(this)">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>

    ${data.imagenUrl ? `
      <img class="ed-existing-preview" src="${edEscape(data.imagenUrl)}" alt="Imagen actual">
    ` : ``}

    <div class="ed-page-grid">
      <div class="ed-field">
        <label>Imagen A4 / card</label>
        <input class="edInputImagen" type="file" accept="image/*">
        ${data.imagenUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene imagen. Elegí otra solo si querés reemplazarla.</div>` : ``}
      </div>

      <div class="ed-field">
        <label>Audio español</label>
        <input class="edInputAudioEs" type="file" accept="audio/*">
        ${data.audioEsUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene audio español.</div>` : ``}
      </div>

      <div class="ed-field">
        <label>Audio inglés</label>
        <input class="edInputAudioEn" type="file" accept="audio/*">
        ${data.audioEnUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene audio inglés.</div>` : ``}
      </div>
    </div>
  `;

  wrap.appendChild(div);
  edRenumerarPaginas();
};

window.edQuitarPagina = (btn) => {
  const row = btn.closest(".ed-page-editor");
  if (row) row.remove();
  edRenumerarPaginas();
};

function edRenumerarPaginas() {
  const rows = Array.from(document.querySelectorAll("#edPaginasEditor .ed-page-editor"));
  rows.forEach((row, i) => {
    const b = row.querySelector(".ed-page-head b");
    if (b) b.textContent = `Página ${i + 1}`;
  });
}

window.cerrarEditorEdicion = () => {
  const modal = ed$("edModal");
  if (modal) modal.style.display = "none";
};

window.cerrarEditorEdicionFondo = (e) => {
  if (e.target && e.target.id === "edModal") {
    cerrarEditorEdicion();
  }
};

window.guardarEdicion = async (e) => {
  e.preventDefault();

  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden guardar ediciones.");
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const btn = ed$("edBtnGuardar");
  const titulo = edValor(ed$("edTitulo")?.value);
  const portadaFile = ed$("edPortadaFile")?.files?.[0] || null;
  const rows = Array.from(document.querySelectorAll("#edPaginasEditor .ed-page-editor"));

  if (!titulo) {
    alert("Completá el título.");
    return;
  }

  if (!rows.length) {
    alert("Agregá al menos una página.");
    return;
  }

  const existente = edicionEditId ? await obtenerEdicion(edicionEditId) : null;
  const edId = edicionEditId || push(ref(db, "ediciones")).key;

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando...";
    }

    edSetEstado("Preparando archivos...");

    const paginasObj = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pageId = row.dataset.pageId || edKey("p");

      let imagenUrl = row.dataset.imagenUrl || "";
      let audioEsUrl = row.dataset.audioEsUrl || "";
      let audioEnUrl = row.dataset.audioEnUrl || "";

      const imgFile = row.querySelector(".edInputImagen")?.files?.[0] || null;
      const esFile = row.querySelector(".edInputAudioEs")?.files?.[0] || null;
      const enFile = row.querySelector(".edInputAudioEn")?.files?.[0] || null;

      if (imgFile) {
        edSetEstado(`Subiendo imagen ${i + 1}...`);
        imagenUrl = await subirArchivoEdicionR2(imgFile, `ediciones/${edId}/imagenes`);
      }

      if (!imagenUrl) {
        alert(`La página ${i + 1} necesita imagen.`);
        return;
      }

      if (esFile) {
        edSetEstado(`Subiendo audio español ${i + 1}...`);
        audioEsUrl = await subirArchivoEdicionR2(esFile, `ediciones/${edId}/audio-es`);
      }

      if (enFile) {
        edSetEstado(`Subiendo audio inglés ${i + 1}...`);
        audioEnUrl = await subirArchivoEdicionR2(enFile, `ediciones/${edId}/audio-en`);
      }

      paginasObj[pageId] = {
        orden: i,
        imagenUrl,
        audioEsUrl,
        audioEnUrl,
        actualizado: Date.now()
      };
    }

    let portadaUrl = existente?.portadaUrl || "";

    if (portadaFile) {
      edSetEstado("Subiendo portada...");
      portadaUrl = await subirArchivoEdicionR2(portadaFile, `ediciones/${edId}/portada`);
    }

    if (!portadaUrl) {
      portadaUrl = Object.values(paginasObj)[0]?.imagenUrl || "";
    }

    const data = {
      titulo,
      portadaUrl,
      paginas: paginasObj,
      publicada: true,
      creadoPor: existente?.creadoPor || window.__UID || "",
      ts: existente?.ts || Date.now(),
      actualizado: Date.now()
    };

    edSetEstado("Guardando datos...");
    await set(ref(db, `ediciones/${edId}`), data);

    edSetEstado("Edición guardada.");
    cerrarEditorEdicion();
  } catch (err) {
    console.error(err);
    alert(
      "No pude guardar la edición.\n\n" +
      "Si falló al subir audios, probablemente la función R2 actual solo acepte imágenes y hay que ajustarla para audio también."
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar edición";
    }
  }
};

async function subirArchivoEdicionR2(file, carpeta) {
  const safe = `${Date.now()}_${edSafeName(file.name)}`;

  const fileBase64 = await edFileToBase64(file);

  const payload = {
    fileBase64,
    fileName: safe,
    contentType: file.type || "application/octet-stream",
    folder: carpeta || "ediciones"
  };

  const r = await fetch(R2_UPLOAD_URL_EDICIONES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  let data = {};

  try {
    data = JSON.parse(text);
  } catch (_) {
    data = {};
  }

  if (!r.ok) {
    console.error("R2 respondió error:", r.status, data || text);
    throw new Error(data.error || data.message || text || "Error subiendo archivo a R2");
  }

  const url =
    data.url ||
    data.publicUrl ||
    data.downloadURL ||
    data.fileUrl ||
    data.r2Url ||
    data?.data?.url ||
    data?.data?.publicUrl;

  if (!url) {
    console.warn("Respuesta R2 sin URL:", data, text);
    throw new Error("La función R2 respondió, pero no devolvió URL.");
  }

  return url;
}

function edFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ================= OBTENER / BORRAR ================= */

async function obtenerEdicion(id) {
  const cache = edicionesCache.find(x => x.id === id);
  if (cache) return cache;

  const db = await edEsperarDB();
  if (!db) return null;

  const snap = await get(ref(db, `ediciones/${id}`));
  const val = snap.val();
  if (!val) return null;

  return { id, ...val };
}

window.obtenerEdicion = obtenerEdicion;

window.borrarEdicion = async (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden borrar ediciones.");
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) return;

  if (!confirm(`¿Borrar la edición "${ed.titulo || "sin título"}"?`)) return;

  try {
    await remove(ref(db, `ediciones/${id}`));
    await remove(ref(db, `compartidos/edicion_${id}`));
  } catch (err) {
    console.error(err);
    alert("No pude borrar la edición.");
  }
};

/* ================= PRESENTACIÓN FULLSCREEN ================= */

window.abrirPresentacionEdicion = async (id) => {
  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasArray(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene páginas.");
    return;
  }

  let viewer = ed$("edViewer");

  if (!viewer) {
    viewer = document.createElement("div");
    viewer.id = "edViewer";
    document.body.appendChild(viewer);
  }

  viewer.innerHTML = `
    <div class="ed-view-top">
      <div class="ed-view-title">${edEscape(ed.titulo || "Edición")}</div>

      <div class="ed-view-actions">
      <button type="button" onclick="guardarEdicionEnMiPanel('${ed.id}')" title="Guardar en Mi Panel">
  <i class="fa-solid fa-heart-circle-plus"></i>
</button>
        <button type="button" onclick="descargarEdicionPDF('${ed.id}')" title="Descargar PDF">
          <i class="fa-solid fa-file-pdf"></i>
        </button>

        <button type="button" onclick="compartirEdicion('${ed.id}', 'redes')" title="Compartir">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button" class="ed-view-close" onclick="cerrarPresentacionEdicion()" title="Cerrar">
          ×
        </button>
      </div>
    </div>

    <div class="ed-slides">
      ${paginas.map((p, i) => `
        <section class="ed-slide">
          <div class="ed-slide-inner">
            <div class="ed-slide-img-wrap">
              <img class="ed-slide-img" src="${edEscape(p.imagenUrl)}" alt="Página ${i + 1}" loading="lazy">
            </div>

            ${(p.audioEsUrl || p.audioEnUrl) ? `
              <div class="ed-audios">
                ${p.audioEsUrl ? `
                  <div class="ed-audio-box es">
                    <div class="ed-audio-label">Español</div>
                    <audio controls preload="metadata" src="${edEscape(p.audioEsUrl)}"></audio>
                  </div>
                ` : ``}

                ${p.audioEnUrl ? `
                  <div class="ed-audio-box en">
                    <div class="ed-audio-label">English</div>
                    <audio controls preload="metadata" src="${edEscape(p.audioEnUrl)}"></audio>
                  </div>
                ` : ``}
              </div>
            ` : ``}
          </div>
        </section>
      `).join("")}
    </div>
  `;

  viewer.classList.add("ed-open");
  document.body.style.overflow = "hidden";
  edIntentarPantallaCompleta(viewer);
};

function edIntentarPantallaCompleta(el) {
  try {
    if (document.fullscreenElement) return;

    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;

    if (fn) {
      const p = fn.call(el);
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  } catch (_) {}
}

window.cerrarPresentacionEdicion = () => {
  const veniaDeLinkDirecto = document.body.classList.contains("ed-link-directo");

  const viewer = ed$("edViewer");
  if (viewer) {
    viewer.classList.remove("ed-open");
    viewer.innerHTML = "";
  }

  document.body.style.overflow = "";
  document.body.classList.remove("ed-link-directo");

  try {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (_) {}

  if (veniaDeLinkDirecto) {
    try {
      history.replaceState(null, "", location.pathname);
    } catch (_) {}

    if (typeof window.irA === "function") {
      window.irA("compartidos");
    }

    if (typeof window.mostrarCompartidos === "function") {
      window.mostrarCompartidos();
    }
  }
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarPresentacionEdicion();
  }
});

/* ================= PDF ================= */
window.descargarEdicionPDF = async (id) => {
  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const paginas = edPaginasArray(ed);
  if (!paginas.length) {
    alert("Esta edición no tiene páginas para descargar.");
    return;
  }

  if (edTieneAudio(ed)) {
    alert("El PDF descarga solo el documento visual. Los audios no se incluyen dentro del PDF.");
  }

  let jsPDF;

  try {
    jsPDF = await edObtenerJsPDF();
  } catch (err) {
    console.error(err);
    alert("No pude cargar la librería PDF. Revisá tu conexión e intentá de nuevo.");
    return;
  }

  try {
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 18;

    for (let i = 0; i < paginas.length; i++) {
      if (i > 0) pdf.addPage();

      const dataUrl = await edUrlToDataUrl(paginas[i].imagenUrl);
      const dims = await edImageDims(dataUrl);

      const fit = edFit(dims.w, dims.h, pageW - margin * 2, pageH - margin * 2);
      const x = (pageW - fit.w) / 2;
      const y = (pageH - fit.h) / 2;

      const tipo = dataUrl.includes("image/png") ? "PNG" : "JPEG";
      pdf.addImage(dataUrl, tipo, x, y, fit.w, fit.h);
    }

    const nombre = edSafeName(ed.titulo || "edicion").replace(/\.[^.]+$/, "");
    pdf.save(`${nombre}.pdf`);
await edMarcarDescargada(id);
await edIncrementarStat(id, "descargas");
  } catch (err) {
    console.error(err);
    alert(
      "No pude generar el PDF.\n\n" +
      "Si las imágenes están en R2, revisá que R2 permita CORS para poder convertirlas a PDF desde el navegador."
    );
  }
};

async function edObtenerJsPDF() {
  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  await edCargarScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");

  if (window.jspdf?.jsPDF) {
    return window.jspdf.jsPDF;
  }

  throw new Error("jsPDF no quedó disponible.");
}

function edCargarScript(src) {
  return new Promise((resolve, reject) => {
    const yaExiste = Array.from(document.scripts).some(s => s.src === src);
    if (yaExiste) {
      setTimeout(resolve, 250);
      return;
    }

    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function edUrlToDataUrl(url) {
  const proxy = edBuildR2ProxyUrl(url);

  const r = await fetch(proxy, { mode: "cors" });
  if (!r.ok) throw new Error("No pude leer imagen para PDF");

  const blob = await r.blob();

  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function edBuildR2ProxyUrl(url) {
  const base = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/descargarImagenR2";
  return `${base}?url=${encodeURIComponent(url)}`;
}

function edImageDims(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function edFit(w, h, maxW, maxH) {
  const ratio = Math.min(maxW / w, maxH / h);
  return {
    w: w * ratio,
    h: h * ratio
  };
}

/* ================= COMPARTIR ================= */
/* ================= GUARDAR EN MI PANEL ================= */

window.guardarEdicionEnMiPanel = async (id) => {
  const uid = edUidActual();

  if (!uid) {
    edPedirLoginParaPanel();
    return;
  }

  const db = edDB();
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const panelRef = ref(db, `panelEdiciones/${uid}/${id}`);
  const ya = await get(panelRef);

  if (ya.exists()) {
    alert("Esta edición ya está guardada en Mi Panel.");
    return;
  }

  const portadaUrl = ed.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "";

  try {
    await set(panelRef, {
      tipo: "edicion",
      edicionId: id,
      titulo: ed.titulo || "Edición",
      portadaUrl,
      ts: Date.now()
    });

    await edIncrementarStat(id, "guardados");

    alert("Guardado en Mi Panel.");
  } catch (err) {
    console.error(err);
    alert("No pude guardar en Mi Panel.");
  }
};

function edUidActual() {
  return window.__UID || window.__FB?.auth?.currentUser?.uid || null;
}

function edPedirLoginParaPanel() {
  const modal = document.getElementById("loginModal");

  if (modal) {
    const title = modal.querySelector(".modal-title");
    const sub = modal.querySelector(".modal-sub");

    if (title) title.textContent = "🔐 Iniciar sesión";
    if (sub) sub.textContent = "Iniciá sesión para guardar esta edición en Mi Panel.";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    return;
  }

  if (typeof window.irALogin === "function") {
    window.irALogin();
    return;
  }

  alert("Iniciá sesión para guardar esta edición en Mi Panel.");
}

window.compartirEdicion = async (id, destino = "redes") => {
  const ed = await obtenerEdicion(id);
  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = ed.portadaUrl || edPaginasArray(ed)[0]?.imagenUrl || "";

  if (destino === "compartidos") {
    if (!window.__ES_ADMIN) {
      alert("Solo los administradores pueden enviar a Compartidos.");
      return;
    }

    const db = edDB();
    if (!db) {
      alert("Firebase no está listo.");
      return;
    }

    await set(ref(db, `compartidos/edicion_${id}`), {
      tipo: "edicion",
      edicionId: id,
      titulo,
      portadaUrl,
      creadoPor: window.__UID || "",
      ts: Date.now()
    });

    alert("Edición enviada a Compartidos.");
    return;
  }

  const url = crearLinkPublicoEdicion(id);
  const texto = `${titulo}\n${url}`;

  try {
if (navigator.share) {
  await navigator.share({
    title: titulo,
    text: titulo,
    url
  });

  await edIncrementarStat(id, "compartidos");
} else if (navigator.clipboard) {
  await navigator.clipboard.writeText(texto);
  await edIncrementarStat(id, "compartidos");
  alert("Link copiado para compartir.");
} else {
  prompt("Copiá este link:", url);
  await edIncrementarStat(id, "compartidos");
}
  } catch (err) {
    console.warn("Compartir cancelado o falló:", err);
  }
};

function crearLinkPublicoEdicion(id) {
  const base = `${location.origin}${location.pathname}`;
  return `${base}?ver=edicion&id=${encodeURIComponent(id)}`;
}

/* ================= LINK PÚBLICO ================= */

async function abrirEdicionDesdeURL() {
  const params = new URLSearchParams(location.search);
  const ver = params.get("ver");
  const id = params.get("id");

  if (ver !== "edicion" || !id) return;

  window.__ED_LINK_DIRECTO = true;
  document.body.classList.add("ed-link-directo");

  await edEsperarDB();

  setTimeout(() => {
    abrirPresentacionEdicion(id);
  }, 250);
}

setTimeout(abrirEdicionDesdeURL, 100);
