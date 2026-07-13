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

// ✅ SIN FIREBASE FUNCTIONS: Ediciones usa Cloudflare Worker + R2
const R2_WORKER_URL_EDICIONES = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

const R2_UPLOAD_URL_EDICIONES = R2_WORKER_URL_EDICIONES;
const R2_VIDEO_UPLOAD_URL_EDICIONES = R2_WORKER_URL_EDICIONES;
const R2_PROXY_URL_EDICIONES = R2_WORKER_URL_EDICIONES;

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

let edicionesPublicadasCache = {};
let edicionesPublicadasEscuchaActiva = false;

let edFiltroCategoria = (() => {
  try {
    return localStorage.getItem("vaEdFiltroCategoria") || "todo";
  } catch (e) {
    return "todo";
  }
})();

let edBusquedaTexto = "";
let edBuscadorAbierto = false;

const ED_CATEGORIAS = [
  { id: "todo", label: "Todo" },
  { id: "flyers", label: "Flyers" },
  { id: "libros", label: "Libros" },
  { id: "videos", label: "Videos" },
  { id: "stickers", label: "Stickers" }
];

function edCategoriaValida(id) {
  if (id === "fondos" && window.__ES_ADMIN) return "fondos";

  return ED_CATEGORIAS.some(c => c.id === id) ? id : "todo";
}

edFiltroCategoria = edCategoriaValida(edFiltroCategoria);

function edEsLinkDirectoPublico() {
  try {
    const params = new URLSearchParams(location.search);
    const path = String(location.pathname || "").toLowerCase();

    return (
      !!params.get("edicionRef") ||
      (params.get("ver") === "edicion" && !!params.get("id")) ||
      (path.includes("/ediciones/") && !!params.get("ref"))
    );
  } catch (_) {
    return false;
  }
}

// ✅ Oculta la app apenas carga el archivo, antes de abrir el visor.
// Así no aparece Compartidos ni Recursos “de paseo”.
if (edEsLinkDirectoPublico()) {
  document.body.classList.add("ed-link-directo");
}

function ed$(id) {
  return document.getElementById(id);
}

function edDB() {
  return window.__FB?.db || null;
}


/* =========================================================
   ADMINISTRADOR GLOBAL DE FONDOS
   - Usa los fondos actuales como base.
   - Guarda altas, reemplazos y ocultamientos en Firebase.
   - Los archivos nuevos/reemplazados se suben a R2.
========================================================= */

const ED_FONDOS_RUTA = "fondosGalerias";

const ED_FONDOS_CATEGORIAS = [
  { id: "paisajes", label: "Paisajes" },
  { id: "acuarelas", label: "Acuarelas" },
  { id: "tarjetas", label: "Tarjetas" }
];

const edFondosBase = {
  paisajes: [],
  acuarelas: [],
  tarjetas: []
};

let edFondosConfig = {};
let edFondosEscuchaActiva = false;
let edFondosMostrarOcultos = false;

function edFondosCategoriaValida(categoria = "") {
  const id = String(categoria || "").trim().toLowerCase();

  return ED_FONDOS_CATEGORIAS.some(c => c.id === id)
    ? id
    : "paisajes";
}

function edFondosHash(texto = "") {
  let hash = 2166136261;
  const s = String(texto || "");

  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function edFondosIdBase(url = "") {
  return `base_${edFondosHash(url)}`;
}

function edFondosNombreDesdeUrl(url = "") {
  try {
    const limpio = String(url || "").split("?")[0].split("#")[0];
    const ultimo = limpio.split("/").pop() || "Fondo";
    return decodeURIComponent(ultimo);
  } catch (_) {
    return "Fondo";
  }
}

function edFondosRegistrarBase(base = {}) {
  ED_FONDOS_CATEGORIAS.forEach(({ id }) => {
    const recibidos = Array.isArray(base?.[id]) ? base[id] : [];

    const unicos = new Set([
      ...(edFondosBase[id] || []),
      ...recibidos.map(x => String(x || "").trim()).filter(Boolean)
    ]);

    edFondosBase[id] = Array.from(unicos);
  });

  edFondosNotificar();
}

window.vaFondosRegistrarBase = edFondosRegistrarBase;

function edFondosConfigCategoria(categoria = "") {
  const cat = edFondosCategoriaValida(categoria);
  const val = edFondosConfig?.[cat];

  return val && typeof val === "object"
    ? val
    : {};
}

function edFondosConstruirLista(categoria = "", incluirOcultos = false) {
  const cat = edFondosCategoriaValida(categoria);
  const base = edFondosBase[cat] || [];
  const config = edFondosConfigCategoria(cat);
  const idsBase = new Set();

  const itemsBase = base.map((originalUrl, indice) => {
    const id = edFondosIdBase(originalUrl);
    idsBase.add(id);

    const cfg = config[id] && typeof config[id] === "object"
      ? config[id]
      : {};

    const activo = cfg.activo !== false;

    return {
      id,
      categoria: cat,
      url: String(cfg.url || originalUrl || "").trim(),
      originalUrl,
      nombre: String(cfg.nombre || edFondosNombreDesdeUrl(cfg.url || originalUrl)),
      activo,
      esBase: true,
      nuevo: false,
      orden: Number.isFinite(Number(cfg.orden))
        ? Number(cfg.orden)
        : indice
    };
  });

  const itemsNuevos = Object.entries(config)
    .filter(([id, item]) => {
      if (!item || typeof item !== "object") return false;
      if (idsBase.has(id)) return false;

      return !!String(item.url || "").trim();
    })
    .map(([id, item], indice) => ({
      id,
      categoria: cat,
      url: String(item.url || "").trim(),
      originalUrl: String(item.originalUrl || "").trim(),
      nombre: String(item.nombre || edFondosNombreDesdeUrl(item.url)),
      activo: item.activo !== false,
      esBase: false,
      nuevo: true,
      orden: Number.isFinite(Number(item.orden))
        ? Number(item.orden)
        : 100000 + indice
    }));

  return [...itemsBase, ...itemsNuevos]
    .filter(item => item.url && (incluirOcultos || item.activo))
    .sort((a, b) => {
      const orden = Number(a.orden || 0) - Number(b.orden || 0);
      if (orden !== 0) return orden;

      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });
}

window.vaFondosObtenerLista = function(categoria = "") {
  return edFondosConstruirLista(categoria, false).map(item => item.url);
};

window.vaFondosObtenerItems = function(categoria = "", incluirOcultos = false) {
  return edFondosConstruirLista(categoria, incluirOcultos);
};

function edFondosNotificar() {
  try {
    window.dispatchEvent(new CustomEvent("va-fondos-actualizados"));
  } catch (_) {}

  if (
    typeof renderEdiciones === "function" &&
    edFiltroCategoria === "fondos"
  ) {
    renderEdiciones();
  }
}

function edFondosIniciarEscucha(intento = 0) {
  if (edFondosEscuchaActiva) return;

  const db = edDB();

  if (!db) {
    if (intento < 120) {
      setTimeout(() => edFondosIniciarEscucha(intento + 1), 500);
    }
    return;
  }

  onValue(
    ref(db, ED_FONDOS_RUTA),
    (snap) => {
      edFondosConfig = snap.val() || {};
      edFondosNotificar();
    },
    (error) => {
      console.warn("No pude leer los fondos administrables:", error);
    }
  );

  edFondosEscuchaActiva = true;
}

function edFondosTomarPendientes() {
  const pendientes = window.__VA_FONDOS_BASE_PENDIENTE;

  if (pendientes && typeof pendientes === "object") {
    edFondosRegistrarBase(pendientes);
  }
}

setTimeout(() => {
  edFondosTomarPendientes();
  edFondosIniciarEscucha();
}, 0);

function edFondosBuscarItem(categoria = "", id = "") {
  return edFondosConstruirLista(categoria, true)
    .find(item => item.id === id) || null;
}

function edFondosSetEstado(texto = "") {
  const el = ed$("edFondosEstado");
  if (el) el.textContent = texto || "";
}

function edFondosCardHTML(categoria, item) {
  const oculto = !item.activo;
  const nombre = edEscape(item.nombre || "Fondo");

  return `
    <article class="ed-fondo-card ${oculto ? "ed-fondo-card-oculto" : ""}">
      <button
        type="button"
        class="ed-fondo-thumb"
        onclick="edFondoAbrirDetalle('${categoria}', '${item.id}')"
        title="Abrir para revisar calidad"
      >
        <img
          src="${edEscape(item.url)}"
          alt="${nombre}"
          loading="lazy"
          data-ed-fondo-id="${item.id}"
          onload="edFondoMarcarDimensiones(this)"
        >
      </button>

      <div class="ed-fondo-card-body">
        <div class="ed-fondo-card-name" title="${nombre}">
          ${nombre}
        </div>

        <div class="ed-fondo-card-meta" data-ed-fondo-meta="${item.id}">
          Cargando tamaño…
        </div>

        <div class="ed-fondo-card-actions">
          ${
            oculto
              ? `
                <button
                  type="button"
                  onclick="edFondoRestaurar('${categoria}', '${item.id}')"
                  title="Restaurar fondo"
                >
                  <i class="fa-solid fa-rotate-left"></i>
                </button>
              `
              : `
                <button
                  type="button"
                  class="ed-fondo-edit-btn"
                  onclick="edFondoAbrirEditor('${categoria}', '${item.id}')"
                  title="Editar nombre o imagen"
                >
                  <i class="fa-solid fa-pen"></i>
                  <span>Editar</span>
                </button>

                <button
                  type="button"
                  class="ed-fondo-danger"
                  onclick="edFondoBorrar('${categoria}', '${item.id}')"
                  title="Quitar de las galerías"
                >
                  <i class="fa-solid fa-trash"></i>
                </button>
              `
          }
        </div>
      </div>
    </article>
  `;
}

function edRenderGestorFondos() {
  const lista = ed$("edLista");
  if (!lista) return;

  if (!window.__ES_ADMIN) {
    lista.innerHTML = `
      <div id="edVacio">
        Solo un administrador puede modificar los fondos.
      </div>
    `;
    return;
  }

  const secciones = ED_FONDOS_CATEGORIAS.map(({ id, label }) => {
    const items = edFondosConstruirLista(id, edFondosMostrarOcultos);
    const activos = items.filter(item => item.activo).length;

    return `
      <section class="ed-fondos-seccion">
        <div class="ed-fondos-seccion-head">
          <div>
            <h4>${edEscape(label)}</h4>
            <span>${activos} fondos activos</span>
          </div>

          <div class="ed-fondos-seccion-actions">
            <input
              id="edFondosInput_${id}"
              type="file"
              accept="image/*"
              multiple
              hidden
              onchange="edFondosAgregar('${id}', this)"
            >

            <label
              for="edFondosInput_${id}"
              class="ed-fondos-agregar"
              title="Agregar fondos a ${edEscape(label)}"
            >
              <i class="fa-solid fa-circle-plus"></i>
              Agregar
            </label>
          </div>
        </div>

        <div class="ed-fondos-galeria">
          ${
            items.length
              ? items.map(item => edFondosCardHTML(id, item)).join("")
              : `<div class="ed-fondos-vacio">No hay fondos en esta galería.</div>`
          }
        </div>
      </section>
    `;
  }).join("");

    lista.innerHTML = `
    <div id="edFondosAdmin">

      ${secciones}

      <div class="ed-fondos-admin-head">
        <div>
          <h3>Fondos</h3>

          <p>
            Estos mismos fondos aparecen en Devocionales fase 1 y en Biblia → Crear imagen.
          </p>
        </div>

        <button
          type="button"
          class="ed-fondos-ocultos-btn ${edFondosMostrarOcultos ? "activo" : ""}"
          onclick="edFondosToggleOcultos()"
        >
          <i class="fa-solid fa-eye${edFondosMostrarOcultos ? "-slash" : ""}"></i>

          ${edFondosMostrarOcultos ? "Ocultar quitados" : "Ver quitados"}
        </button>
      </div>

      <div id="edFondosEstado"></div>
    </div>
  `;
}

window.edFondosToggleOcultos = function() {
  edFondosMostrarOcultos = !edFondosMostrarOcultos;
  renderEdiciones();
};

window.edFondoMarcarDimensiones = function(img) {
  if (!img) return;

  const id = img.dataset.edFondoId || "";
  const meta = document.querySelector(`[data-ed-fondo-meta="${id}"]`);
  if (!meta) return;

  const w = Number(img.naturalWidth || 0);
  const h = Number(img.naturalHeight || 0);

  if (!w || !h) {
    meta.textContent = "No pude leer el tamaño";
    return;
  }

  const baja = Math.min(w, h) < 1200;

  meta.textContent = `${w} × ${h}px${baja ? " · revisar calidad" : ""}`;
  meta.classList.toggle("ed-fondo-meta-baja", baja);
};

window.edFondosAgregar = async function(categoria = "", input) {
  const cat = edFondosCategoriaValida(categoria);
  const files = Array.from(input?.files || []);

  if (!files.length) return;

  const db = edDB();

  if (!db) {
    alert("Firebase todavía no está listo.");
    return;
  }

  const invalidos = files.filter(file => !String(file.type || "").startsWith("image/"));

  if (invalidos.length) {
    alert("Solo podés subir imágenes.");
    input.value = "";
    return;
  }

  const muyGrandes = files.filter(file => Number(file.size || 0) > 15 * 1024 * 1024);

  if (muyGrandes.length) {
    alert("Cada fondo debe pesar menos de 15 MB.");
    input.value = "";
    return;
  }

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      edFondosSetEstado(`Subiendo fondo ${i + 1} de ${files.length}…`);

      const url = await subirArchivoEdicionR2(file, `fondos/${cat}`);
      const id = `nuevo_${Date.now()}_${edFondosHash(file.name + Math.random())}`;

      await set(ref(db, `${ED_FONDOS_RUTA}/${cat}/${id}`), {
        url,
        nombre: file.name || "Fondo",
        activo: true,
        nuevo: true,
        orden: Date.now() + i,
        creado: Date.now(),
        actualizado: Date.now()
      });
    }

    edFondosSetEstado("Fondos agregados correctamente.");
  } catch (error) {
    console.error("Error agregando fondos:", error);
    alert("No pude agregar los fondos.\n\n" + (error?.message || error));
    edFondosSetEstado("");
  } finally {
    if (input) input.value = "";
  }
};

window.edFondoCerrarEditor = function() {
  const modal = document.getElementById("edFondoEditorModal");

  if (modal?.dataset?.previewUrl) {
    try {
      URL.revokeObjectURL(modal.dataset.previewUrl);
    } catch (_) {}
  }

  modal?.remove();
};

window.edFondoAbrirEditor = function(categoria = "", id = "") {
  const item = edFondosBuscarItem(categoria, id);

  if (!item) {
    alert("No encontré ese fondo.");
    return;
  }

  window.edFondoCerrarEditor();

  const cat = edFondosCategoriaValida(categoria);
  const modal = document.createElement("div");
  modal.id = "edFondoEditorModal";

  modal.innerHTML = `
    <div class="ed-fondo-editor-box" onclick="event.stopPropagation()">
      <div class="ed-fondo-editor-head">
        <h3>Editar fondo</h3>

        <button
          type="button"
          class="ed-fondo-editor-x"
          onclick="edFondoCerrarEditor()"
          aria-label="Cerrar"
        >×</button>
      </div>

      <img
        id="edFondoEditorPreview"
        class="ed-fondo-editor-preview"
        src="${edEscape(item.url)}"
        alt="${edEscape(item.nombre || "Fondo")}"
      >

      <label class="ed-fondo-editor-field">
        <span>Nombre del fondo</span>

        <input
          id="edFondoEditorNombre"
          type="text"
          maxlength="100"
          value="${edEscape(item.nombre || "Fondo")}"
          placeholder="Ej: Lago al atardecer"
        >
      </label>

      <label class="ed-fondo-editor-field">
        <span>Cambiar imagen <small>(opcional)</small></span>

        <input
          id="edFondoEditorArchivo"
          type="file"
          accept="image/*"
        >
      </label>

      <div class="ed-fondo-editor-ayuda">
        Si no elegís otra imagen, se conserva la actual.
      </div>

      <div id="edFondoEditorEstado"></div>

      <div class="ed-fondo-editor-actions">
        <button
          type="button"
          class="ed-fondo-editor-cancelar"
          onclick="edFondoCerrarEditor()"
        >
          Cancelar
        </button>

        <button
          id="edFondoEditorGuardar"
          type="button"
          class="ed-fondo-editor-guardar"
          onclick="edFondoGuardarEdicion('${cat}', '${item.id}')"
        >
          Guardar cambios
        </button>
      </div>
    </div>
  `;

  modal.onclick = () => window.edFondoCerrarEditor();
  document.body.appendChild(modal);

  const archivo = document.getElementById("edFondoEditorArchivo");
  const preview = document.getElementById("edFondoEditorPreview");

  archivo?.addEventListener("change", () => {
    const file = archivo.files?.[0];
    if (!file || !String(file.type || "").startsWith("image/")) return;

    if (modal.dataset.previewUrl) {
      try {
        URL.revokeObjectURL(modal.dataset.previewUrl);
      } catch (_) {}
    }

    const previewUrl = URL.createObjectURL(file);
    modal.dataset.previewUrl = previewUrl;

    if (preview) {
      preview.src = previewUrl;
    }
  });

  setTimeout(() => {
    document.getElementById("edFondoEditorNombre")?.focus();
  }, 0);
};

window.edFondoGuardarEdicion = async function(categoria = "", id = "") {
  const item = edFondosBuscarItem(categoria, id);

  if (!item) {
    alert("No encontré ese fondo.");
    return;
  }

  const nombreInput = document.getElementById("edFondoEditorNombre");
  const archivoInput = document.getElementById("edFondoEditorArchivo");
  const estado = document.getElementById("edFondoEditorEstado");
  const btn = document.getElementById("edFondoEditorGuardar");

  const nombre = String(nombreInput?.value || "").trim();
  const file = archivoInput?.files?.[0] || null;

  if (!nombre) {
    alert("Escribí un nombre para el fondo.");
    nombreInput?.focus();
    return;
  }

  if (file && !String(file.type || "").startsWith("image/")) {
    alert("Elegí una imagen válida.");
    return;
  }

  if (file && Number(file.size || 0) > 15 * 1024 * 1024) {
    alert("La imagen debe pesar menos de 15 MB.");
    return;
  }

  const db = edDB();

  if (!db) {
    alert("Firebase todavía no está listo.");
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const cat = edFondosCategoriaValida(categoria);
    const actual = edFondosConfigCategoria(cat)?.[id] || {};

    let url = item.url;

    if (file) {
      if (estado) estado.textContent = "Subiendo la nueva imagen…";

      url = await subirArchivoEdicionR2(
        file,
        `fondos/${cat}`
      );
    }

    if (estado) estado.textContent = "Guardando cambios…";

    await set(ref(db, `${ED_FONDOS_RUTA}/${cat}/${id}`), {
      ...actual,
      url,
      nombre,
      originalUrl: item.originalUrl || "",
      activo: true,
      nuevo: !item.esBase,
      orden: item.orden,
      actualizado: Date.now(),
      creado: Number(actual.creado || Date.now())
    });

    edFondosSetEstado("Fondo editado correctamente.");
    window.edFondoCerrarEditor();
  } catch (error) {
    console.error("Error editando fondo:", error);

    if (estado) estado.textContent = "";

    alert(
      "No pude guardar los cambios del fondo.\n\n" +
      (error?.message || error)
    );
  } finally {
    const btnActual = document.getElementById("edFondoEditorGuardar");
    if (btnActual) btnActual.disabled = false;
  }
};

window.edFondoBorrar = async function(categoria = "", id = "") {
  const item = edFondosBuscarItem(categoria, id);

  if (!item) {
    alert("No encontré ese fondo.");
    return;
  }

  const ok = confirm(
    `¿Quitar este fondo de las galerías?\n\n${item.nombre || "Fondo"}`
  );

  if (!ok) return;

  const db = edDB();

  if (!db) {
    alert("Firebase todavía no está listo.");
    return;
  }

  try {
    const cat = edFondosCategoriaValida(categoria);
    const actual = edFondosConfigCategoria(cat)?.[id] || {};

    await set(ref(db, `${ED_FONDOS_RUTA}/${cat}/${id}`), {
      ...actual,
      url: item.url,
      nombre: item.nombre || "Fondo",
      originalUrl: item.originalUrl || "",
      activo: false,
      nuevo: !item.esBase,
      orden: item.orden,
      actualizado: Date.now(),
      creado: Number(actual.creado || Date.now())
    });
  } catch (error) {
    console.error("Error quitando fondo:", error);
    alert("No pude quitar el fondo.\n\n" + (error?.message || error));
  }
};

window.edFondoRestaurar = async function(categoria = "", id = "") {
  const item = edFondosBuscarItem(categoria, id);

  if (!item) {
    alert("No encontré ese fondo.");
    return;
  }

  const db = edDB();

  if (!db) {
    alert("Firebase todavía no está listo.");
    return;
  }

  try {
    const cat = edFondosCategoriaValida(categoria);
    const actual = edFondosConfigCategoria(cat)?.[id] || {};

    await set(ref(db, `${ED_FONDOS_RUTA}/${cat}/${id}`), {
      ...actual,
      url: item.url,
      nombre: item.nombre || "Fondo",
      originalUrl: item.originalUrl || "",
      activo: true,
      nuevo: !item.esBase,
      orden: item.orden,
      actualizado: Date.now(),
      creado: Number(actual.creado || Date.now())
    });
  } catch (error) {
    console.error("Error restaurando fondo:", error);
    alert("No pude restaurar el fondo.\n\n" + (error?.message || error));
  }
};

window.edFondoCerrarDetalle = function() {
  document.getElementById("edFondoDetalleModal")?.remove();
};

window.edFondoAbrirDetalle = function(categoria = "", id = "") {
  const item = edFondosBuscarItem(categoria, id);

  if (!item) {
    alert("No encontré ese fondo.");
    return;
  }

  window.edFondoCerrarDetalle();

  const modal = document.createElement("div");
  modal.id = "edFondoDetalleModal";

  modal.innerHTML = `
    <div class="ed-fondo-detalle-box" onclick="event.stopPropagation()">
      <button
        type="button"
        class="ed-fondo-detalle-x"
        onclick="edFondoCerrarDetalle()"
      >×</button>

      <img
        id="edFondoDetalleImg"
        src="${edEscape(item.url)}"
        alt="${edEscape(item.nombre || "Fondo")}"
      >

      <div class="ed-fondo-detalle-info">
        <b>${edEscape(item.nombre || "Fondo")}</b>
        <span id="edFondoDetalleMedidas">Cargando medidas…</span>
      </div>
    </div>
  `;

  modal.onclick = () => window.edFondoCerrarDetalle();

  document.body.appendChild(modal);

  const img = document.getElementById("edFondoDetalleImg");
  const medidas = document.getElementById("edFondoDetalleMedidas");

  if (img && medidas) {
    const actualizarMedidas = () => {
      const w = Number(img.naturalWidth || 0);
      const h = Number(img.naturalHeight || 0);
      const baja = Math.min(w, h) < 1200;

      medidas.textContent = `${w} × ${h}px${baja ? " · puede verse borroso al ampliar" : " · buena resolución"}`;
      medidas.classList.toggle("ed-fondo-meta-baja", baja);
    };

    img.onload = actualizarMedidas;

    if (img.complete) {
      actualizarMedidas();
    }
  }
};


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

function edNormalizarTexto(txt = "") {
  return String(txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function edActualizarControlesEdiciones() {
  const selectCategoria = ed$("edFiltroCategoriaSelect");
  const boxBuscar = ed$("edBuscadorBox");
  const inputBuscar = ed$("edBuscarInput");
  const btnBuscar = document.querySelector("#edTop .ed-top-icon");
  const btnNueva = ed$("edBtnNueva");

  edFiltroCategoria = edCategoriaValida(edFiltroCategoria);

  const esFondos = edFiltroCategoria === "fondos";

  if (selectCategoria && selectCategoria.value !== edFiltroCategoria) {
    selectCategoria.value = edFiltroCategoria;
  }

  document.querySelectorAll("#edFiltros button[data-ed-cat]").forEach(btn => {
    btn.classList.toggle("ed-filter-active", btn.dataset.edCat === edFiltroCategoria);
  });

  if (boxBuscar) {
    boxBuscar.style.display = !esFondos && edBuscadorAbierto ? "block" : "none";
  }

  if (btnBuscar) {
    btnBuscar.style.display = esFondos ? "none" : "inline-flex";
  }

  if (btnNueva) {
    btnNueva.style.display = esFondos ? "none" : "inline-flex";
  }

  if (inputBuscar && inputBuscar.value !== edBusquedaTexto) {
    inputBuscar.value = edBusquedaTexto;
  }
}

window.edCambiarFiltroCategoria = (categoria = "todo") => {
  edFiltroCategoria = edCategoriaValida(categoria);

  try {
    localStorage.setItem("vaEdFiltroCategoria", edFiltroCategoria);
  } catch (e) {}

  renderEdiciones();
};

// ✅ Compatibilidad por si quedó algún botón viejo llamando a esta función.
window.edToggleFiltroEdicion = (tipo) => {
  edCambiarFiltroCategoria(tipo);
};

window.edToggleBuscadorEdiciones = () => {
  edBuscadorAbierto = !edBuscadorAbierto;
  edActualizarControlesEdiciones();

  if (edBuscadorAbierto) {
    setTimeout(() => {
      const input = ed$("edBuscarInput");
      if (input) input.focus();
    }, 50);
  }
};

window.edBuscarEdiciones = (valor = "") => {
  edBusquedaTexto = String(valor || "");
  renderEdiciones();
};

window.edLimpiarBusquedaEdiciones = () => {
  edBusquedaTexto = "";
  const input = ed$("edBuscarInput");
  if (input) input.value = "";
  renderEdiciones();
};

/* ================= FLECHAS GALERÍA EDICIONES - PC ================= */

function edActualizarFlechasGaleria() {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  const wrap = track.closest(".ed-galeria-wrap");
  if (!wrap) return;

  const btnPrev = wrap.querySelector(".ed-galeria-prev");
  const btnNext = wrap.querySelector(".ed-galeria-next");

  if (!btnPrev || !btnNext) return;

  const hayScroll = track.scrollWidth > track.clientWidth + 8;
  const estaAlInicio = track.scrollLeft <= 4;
  const estaAlFinal =
    track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

  btnPrev.classList.toggle(
    "ed-galeria-nav-oculta",
    !hayScroll || estaAlInicio
  );

  btnNext.classList.toggle(
    "ed-galeria-nav-oculta",
    !hayScroll || estaAlFinal
  );
}

window.edMoverGaleria = (direccion = 1) => {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  const card = track.querySelector(".ed-card-galeria");

  const distancia = card
    ? card.getBoundingClientRect().width + 16
    : Math.max(track.clientWidth * 0.85, 280);

  track.scrollBy({
    left: distancia * Number(direccion || 1),
    behavior: "smooth"
  });

  setTimeout(edActualizarFlechasGaleria, 350);
};

function edActivarFlechasGaleria() {
  const track = document.querySelector("#edLista .ed-galeria-track");
  if (!track) return;

  if (track.dataset.flechasActivas !== "1") {
    track.dataset.flechasActivas = "1";

    track.addEventListener("scroll", edActualizarFlechasGaleria, {
      passive: true
    });
  }

  if (!window.__ED_GALERIA_RESIZE_ACTIVO) {
    window.__ED_GALERIA_RESIZE_ACTIVO = true;
    window.addEventListener("resize", edActualizarFlechasGaleria);
  }

  requestAnimationFrame(edActualizarFlechasGaleria);
}

function edNormalizarRama(v = "") {
  const s = String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  if (["libro", "libros"].includes(s)) return "libros";
  if (["video", "videos"].includes(s)) return "videos";
  if (["sticker", "stickers", "stiker", "stikers", "pegatina", "pegatinas"].includes(s)) return "stickers";
  if (["flyer", "flyers", "volante", "volantes"].includes(s)) return "flyers";

  return "flyers";
}

function edRamaEdicion(edicion = {}) {
  return edNormalizarRama(
    edicion.rama ||
    edicion.categoria ||
    edicion.tipoEdicion ||
    "flyers"
  );
}

function edTituloRama(rama = "") {
  const id = edNormalizarRama(rama);
  return ED_CATEGORIAS.find(c => c.id === id)?.label || "Flyers";
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

function edSlugTituloPublico(txt = "edicion") {
  return String(txt || "edicion")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "edicion";
}

function edBasePublicaApp() {
  const partes = location.pathname.split("/").filter(Boolean);

  // En GitHub Pages del repo queda /VidaAbundante
  if (partes[0] && partes[0].toLowerCase() === "vidaabundante") {
    return `${location.origin}/${partes[0]}`;
  }

  // En dominio propio o raíz
  return location.origin;
}

async function edCrearRefPublicaUnica(titulo, edicionId) {
  const db = edDB();
  if (!db) throw new Error("Firebase no está listo.");

  const base = edSlugTituloPublico(titulo);

  for (let n = 1; n <= 200; n++) {
    const refPublica = `${base}-${n}`;
    const snap = await get(ref(db, `edicionesRefs/${refPublica}`));
    const val = snap.val();

    const usadoPor =
      typeof val === "string"
        ? val
        : val?.edicionId || "";

    if (!usadoPor || usadoPor === edicionId) {
      return refPublica;
    }
  }

  return `${base}-${Date.now()}`;
}

async function edAsegurarRefPublica(edicionId, titulo) {
  const db = edDB();
  if (!db) throw new Error("Firebase no está listo.");

  const ed = await obtenerEdicion(edicionId);
  const refExistente = String(ed?.refPublica || "").trim();

  if (refExistente) {
    return refExistente;
  }

  const refPublica = await edCrearRefPublicaUnica(titulo, edicionId);

  await set(ref(db, `ediciones/${edicionId}/refPublica`), refPublica);

  await set(ref(db, `edicionesRefs/${refPublica}`), {
    edicionId,
    titulo: titulo || "Edición",
    ts: Date.now()
  });

  return refPublica;
}

function edMediaUrlPagina(p = {}) {
  return String(p.mediaUrl || p.videoUrl || p.imagenUrl || "").trim();
}

function edMediaTypePagina(p = {}) {
  const tipo = String(p.mediaType || p.mimeType || "").trim();

  if (tipo) return tipo;
  if (p.videoUrl) return "video/mp4";
  if (p.imagenUrl) return "image/*";

  return "";
}

function edPaginaEsVideo(p = {}) {
  return (
    edMediaTypePagina(p).startsWith("video/") ||
    !!p.videoUrl
  );
}

function edPortadaEdicion(edicion) {
  const primeraImagen = edPaginasArray(edicion)
    .find(p => !edPaginaEsVideo(p));

  return (
    edicion?.portadaUrl ||
    primeraImagen?.imagenUrl ||
    primeraImagen?.mediaUrl ||
    ""
  );
}

function edPaginasArray(edicion) {
  const pags = edicion?.paginas || {};

  const arr = Array.isArray(pags)
    ? pags.map((p, i) => ({ id: p.id || `p_${i}`, ...(p || {}) }))
    : Object.entries(pags).map(([id, p]) => ({ id, ...(p || {}) }));

  return arr
    .filter(p => p && edMediaUrlPagina(p))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

function edPaginasArrayConPortada(edicion) {
  const paginas = edPaginasArray(edicion);
  const portadaUrl = String(edicion?.portadaUrl || "").trim();

  if (!portadaUrl) return paginas;

  const primeraUrl = paginas.length ? edMediaUrlPagina(paginas[0]) : "";

  // ✅ Si la portada es exactamente la misma que la primera página,
  // no la duplicamos.
  if (primeraUrl && primeraUrl === portadaUrl) {
    return paginas;
  }

  const portadaPagina = {
    id: "portada",
    orden: -1,
    imagenUrl: portadaUrl,
    mediaUrl: portadaUrl,
    mediaType: "image/*",
    audioEsUrl: "",
    audioEnUrl: "",
    esPortada: true
  };

  return [portadaPagina, ...paginas];
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

    window.__IGLESIA_SUB_ACTIVA = "recursos";
  window.__RECURSOS_SUB_ACTIVA = "ediciones";

  try {
    window.guardarEstadoBiblia?.({
      seccion: "iglesia",
      subIglesia: "recursos",
      subRecursos: "ediciones"
    });
  } catch(e) {}
  
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
          <div class="ed-top-title">
            <h3>Ediciones</h3>

            <button
              type="button"
              class="ed-top-icon"
              onclick="edToggleBuscadorEdiciones()"
              title="Buscar edición"
              aria-label="Buscar edición"
            >
              <i class="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>

          <div class="ed-top-actions">
            ${window.__ES_ADMIN ? `
              <button id="edBtnNueva" type="button" onclick="abrirNuevaEdicion()" title="Nueva edición">
                <i class="fa-solid fa-circle-plus"></i>
              </button>
            ` : ``}
          </div>
        </div>

        <div id="edBuscadorBox" style="display:none;">
          <div class="ed-search-wrap">
            <i class="fa-solid fa-magnifying-glass"></i>

            <input
              id="edBuscarInput"
              type="search"
              placeholder="Buscar por título..."
              oninput="edBuscarEdiciones(this.value)"
            >

            <button
              type="button"
              onclick="edLimpiarBusquedaEdiciones()"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        <div id="edFiltros" class="ed-filtros-buscador">
          <div class="ed-filtros-actions ed-subfiltros-actions">
            ${[
              ...ED_CATEGORIAS,
              ...(window.__ES_ADMIN ? [{ id: "fondos", label: "Fondos" }] : [])
            ].map(c => `
              <button
                type="button"
                class="ed-filter-pill"
                data-ed-cat="${edEscape(c.id)}"
                onclick="edCambiarFiltroCategoria('${edEscape(c.id)}')"
              >
                ${edEscape(c.label)}
              </button>
            `).join("")}
          </div>
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
  <label for="edRama">Tipo de edición</label>

  <select id="edRama">
    ${ED_CATEGORIAS.filter(c => c.id !== "todo").map(c => `
      <option value="${edEscape(c.id)}">${edEscape(c.label)}</option>
    `).join("")}
  </select>

  <div style="font-size:12px; opacity:.75;">
Elegí si es flyer, libro, video o sticker.
  </div>
</div>

<div class="ed-field">
  <label for="edPortadaFile">Portada</label>
              <input id="edPortadaFile" type="file" accept="image/*" />
              <img id="edPortadaPreview" alt="Portada actual" style="display:none;">
              <div style="font-size:12px; opacity:.75;">
                Podés cargar una portada o se usará la primera imagen de la edición.
              </div>
            </div>

<div class="ed-pages-head">
  <b>Páginas / cards</b>

  <div class="ed-serie-actions">
    <input
      id="edSerieImagenesInput"
      type="file"
      accept="image/*"
      multiple
      hidden
      onchange="edAgregarImagenesSerie(this)"
    >

    <label for="edSerieImagenesInput" class="ed-pill-btn ed-serie-btn">
      <i class="fa-solid fa-images"></i>
      Subir imágenes en serie
    </label>

    <input
      id="edPDFInput"
      type="file"
      accept="application/pdf,.pdf"
      hidden
      onchange="edAgregarPDF(this)"
    >

    <label for="edPDFInput" class="ed-pill-btn ed-serie-btn">
      <i class="fa-solid fa-file-pdf"></i>
      Subir PDF
    </label>
  </div>
</div>

            <div id="edPaginasEditor"></div>

<div class="ed-add-page-row">
  <button class="ed-pill-btn" type="button" onclick="edAgregarPagina()">
    <i class="fa-solid fa-circle-plus"></i> Agregar página
  </button>
</div>

            <div id="edEstado"></div>
          </form>

          <div class="ed-form-actions">
            <button class="ed-secondary" type="button" onclick="cerrarEditorEdicion()">Cancelar</button>

            <button id="edBtnGuardar" class="ed-primary" type="submit" form="edForm">
              Guardar edición
            </button>
          </div>
        </div>
      </div>
    `;

    edicionesIniciado = true;
  }

iniciarEscuchaEdiciones();
iniciarEscuchaEdicionesStats();
iniciarEscuchaMisEdicionesGuardadas();
iniciarEscuchaMisEdicionesDescargadas();
iniciarEscuchaEdicionesPublicadas();
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

if (typeof window.renderCompartidos === "function") {
  window.renderCompartidos();
}
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

function iniciarEscuchaEdicionesPublicadas() {
  if (edicionesPublicadasEscuchaActiva) return;

  const db = edDB();
  if (!db) return;

  onValue(ref(db, "compartidos"), (snap) => {
    const val = snap.val() || {};
    edicionesPublicadasCache = {};

    Object.entries(val || {}).forEach(([key, item]) => {
      if (!item || typeof item !== "object") return;

      // formato actual: compartidos/edicion_ID
      if (item.tipo === "edicion" && item.edicionId) {
        edicionesPublicadasCache[item.edicionId] = true;
      }

      // respaldo por si el id de la ruta ya trae edicion_
      if (key.startsWith("edicion_")) {
        edicionesPublicadasCache[key.replace(/^edicion_/, "")] = true;
      }

      // formato agrupado futuro: compartidos/ediciones/{id}
      if (key === "ediciones") {
        Object.entries(item || {}).forEach(([subId, subItem]) => {
          if (subItem?.tipo === "edicion" && subItem?.edicionId) {
            edicionesPublicadasCache[subItem.edicionId] = true;
          } else {
            edicionesPublicadasCache[subId] = true;
          }
        });
      }
    });

    renderEdiciones();
  });

  edicionesPublicadasEscuchaActiva = true;
}

function edEstaPublicadaEnCompartidos(id) {
  return !!edicionesPublicadasCache?.[id];
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

  lista.classList.remove("ed-lista-ramas");
  lista.classList.add("ed-lista-galeria");

  edActualizarControlesEdiciones();

  if (edFiltroCategoria === "fondos") {
    lista.classList.remove("ed-lista-galeria", "ed-lista-ramas");
    lista.classList.add("ed-lista-fondos");

    edRenderGestorFondos();
    return;
  }

  if (!edicionesCache.length) {
    lista.innerHTML = `
      <div id="edVacio">
        Todavía no hay ediciones cargadas.
      </div>
    `;
    return;
  }

  const busqueda = edNormalizarTexto(edBusquedaTexto);
  const filtroCategoria = edCategoriaValida(edFiltroCategoria);

  const items = edicionesCache.filter(ed => {
    const categoria = edRamaEdicion(ed);

    if (filtroCategoria !== "todo" && categoria !== filtroCategoria) {
      return false;
    }

    if (busqueda) {
      const texto = edNormalizarTexto([
        ed.titulo || "",
        ed.refPublica || "",
        categoria,
        edTituloRama(categoria)
      ].join(" "));

      if (!texto.includes(busqueda)) return false;
    }

    return true;
  });

  if (!items.length) {
    lista.innerHTML = `
      <div id="edVacio">
        No encontré ediciones con esos filtros.
      </div>
    `;
    return;
  }

  function renderCardEdicion(ed) {
    const titulo = edEscape(ed.titulo || "Sin título");
    const portada = edPortadaEdicion(ed);
    const tieneVideo = edPaginasArray(ed).some(p => edPaginaEsVideo(p));
    const publicada = edEstaPublicadaEnCompartidos(ed.id);
    const rama = edRamaEdicion(ed);
    const ramaTitulo = edTituloRama(rama);

    return `
      <article class="ed-card ed-card-rama ed-card-galeria">
<div
  class="ed-card-cover ed-card-cover-scroll"
  role="region"
  title="Deslizá para ver las imágenes"
>
  ${
    tieneVideo
      ? (
          portada
            ? `<img src="${edEscape(portada)}" alt="${titulo}" loading="lazy" onclick="abrirPresentacionEdicion('${ed.id}')">`
            : `<span onclick="abrirPresentacionEdicion('${ed.id}')" role="button"><i class="fa-solid fa-video"></i><br>Edición con video</span>`
        )
      : edMiniPaginasHTML(ed.id, "ediciones")
  }
</div>

        <div class="ed-card-body">
          <div class="ed-card-title">${titulo}</div>

          <div class="ed-card-rama-label">
            ${ramaTitulo}
          </div>

          <div class="ed-card-actions ed-card-actions-ediciones">
            ${window.__ES_ADMIN ? `
              <button
                type="button"
                class="ed-btn-publicar ${publicada ? "ed-publicada" : ""}"
                onclick="compartirEdicion('${ed.id}', 'compartidos')"
                title="${publicada ? "Ya está en Compartidos. Tocar para volver a compartir" : "Enviar a Compartidos"}"
              >
                <span class="ed-publicar-wrap">
                  <i class="fa-solid fa-icons"></i>

                  ${publicada ? `
                    <span class="ed-check-mini">
                      <i class="fa-solid fa-check"></i>
                    </span>
                  ` : ``}
                </span>
              </button>
            ` : ``}

            ${!tieneVideo ? `
              <button
                type="button"
                onclick="descargarEdicionPDF('${ed.id}')"
                title="Descargar PDF"
              >
                <i class="fa-solid fa-file-pdf"></i>
              </button>
            ` : ``}

            ${!tieneVideo ? `
  <button
    type="button"
    onclick="descargarEdicionPNGs('${ed.id}', this, 'ediciones')"
    title="Descargar PNG"
  >
    <i class="fa-solid fa-download"></i>
  </button>
` : ``}

            <button
              type="button"
onclick="edAbrirOpcionesCompartirEdicion('${ed.id}', 'ediciones', this)"
title="Compartir imagen o publicación"
            >
              <i class="fa-solid fa-share-nodes"></i>
            </button>

            ${window.__ES_ADMIN ? `
              <button type="button" onclick="editarEdicion('${ed.id}')" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>

              <button
                type="button"
                class="ed-danger ed-danger-mini"
                onclick="borrarEdicion('${ed.id}')"
                title="Borrar"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ``}
          </div>
        </div>
      </article>
    `;
  }

   lista.innerHTML = `
    <div class="ed-galeria-wrap">

      <button
        type="button"
        class="ed-galeria-nav ed-galeria-prev ed-galeria-nav-oculta"
        onclick="edMoverGaleria(-1)"
        title="Ver ediciones anteriores"
        aria-label="Ver ediciones anteriores"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <div class="ed-galeria-track">
        ${items.map(renderCardEdicion).join("")}
      </div>

      <button
        type="button"
        class="ed-galeria-nav ed-galeria-next ed-galeria-nav-oculta"
        onclick="edMoverGaleria(1)"
        title="Ver más ediciones"
        aria-label="Ver más ediciones"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>

    </div>
  `;

edActivarFlechasGaleria();
edActivarMiniGalerias(lista);
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

    const serieInput = ed$("edSerieImagenesInput");
  if (serieInput) serieInput.value = "";
  
  const selectRama = ed$("edRama");
if (selectRama) selectRama.value = "flyers";
  
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

  const selectRama = ed$("edRama");
if (selectRama) selectRama.value = edRamaEdicion(ed);

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

  const mediaUrl = edMediaUrlPagina(data);
  const esVideo = edPaginaEsVideo(data);
  const mediaType = edMediaTypePagina(data);

  const archivoSerie = data.__file || null;
  const esSoloImagenSerie = !!archivoSerie;

  const div = document.createElement("div");
  div.className = "ed-page-editor";
  div.dataset.pageId = id;

  div.dataset.mediaUrl = mediaUrl;
  div.dataset.mediaType = mediaType;

  div.dataset.imagenUrl = esVideo ? "" : (data.imagenUrl || data.mediaUrl || "");
  div.dataset.videoUrl = esVideo ? (data.videoUrl || data.mediaUrl || data.imagenUrl || "") : "";

  div.dataset.audioEsUrl = data.audioEsUrl || "";
  div.dataset.audioEnUrl = data.audioEnUrl || "";

  div.dataset.videoKey = data.videoKey || "";
  div.dataset.videoFileName = data.videoFileName || "";
  div.dataset.videoSizeBytes = data.videoSizeBytes || "";

  const numero = wrap.children.length + 1;

  div.innerHTML = `
    <div class="ed-page-head">
      <div class="ed-page-title-wrap">
        <span class="ed-drag-handle" title="Arrastrar para ordenar">
          <i class="fa-solid fa-grip-vertical"></i>
        </span>

        <b>Página ${numero}</b>

        <span class="ed-portada-badge" style="display:none;">
          <i class="fa-solid fa-star"></i>
          Portada
        </span>
      </div>

      <div class="ed-page-head-actions">
        <button
          type="button"
          class="ed-portada-btn"
          onclick="edDefinirPortadaRow(this.closest('.ed-page-editor'))"
          title="Usar esta página como portada"
        >
          <i class="fa-solid fa-star"></i>
        </button>

        <button type="button" onclick="edQuitarPagina(this)" title="Quitar página">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>

    ${mediaUrl ? (
      esVideo
        ? `<video class="ed-existing-video" src="${edEscape(mediaUrl)}" controls muted playsinline preload="metadata"></video>`
        : `<img class="ed-existing-preview" src="${edEscape(mediaUrl)}" alt="Imagen actual">`
    ) : ``}

    <div class="ed-page-grid ${esSoloImagenSerie ? "ed-page-grid-serie" : ""}">
      <div class="ed-field">
        <label>${esSoloImagenSerie ? "Imagen seleccionada" : "Imagen A4 / video"}</label>

        <input
          class="edInputMedia"
          type="file"
          accept="${esSoloImagenSerie ? "image/*" : "image/*,video/mp4,video/webm,video/quicktime"}"
          ${esSoloImagenSerie ? "style='display:none;'" : ""}
        >

        ${esSoloImagenSerie ? `
          <div class="ed-serie-file-name">
            <i class="fa-solid fa-image"></i>
            <span>${edEscape(archivoSerie.name || "Imagen")}</span>
          </div>
        ` : ``}

        ${mediaUrl ? `<div style="font-size:12px; opacity:.7;">Ya tiene ${esVideo ? "video" : "imagen"}. Elegí otro archivo solo si querés reemplazarlo.</div>` : ``}
      </div>

      ${esSoloImagenSerie ? `` : `
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
      `}
    </div>
  `;

  wrap.appendChild(div);

  if (archivoSerie) {
    div.__edMediaFile = archivoSerie;
    div.dataset.mediaType = archivoSerie.type || "image/*";

    const previewUrl = URL.createObjectURL(archivoSerie);
    div.__edLocalPreviewUrl = previewUrl;

    const grid = div.querySelector(".ed-page-grid");
    if (grid) {
      grid.insertAdjacentHTML("beforebegin", `
        <img
          class="ed-existing-preview ed-existing-preview-serie"
          src="${previewUrl}"
          alt="Vista previa"
        >
      `);
    }
  }

  edRenumerarPaginas();
};

function edFilaPaginaVacia(row) {
  if (!row) return false;

  const tieneMediaGuardada =
    row.dataset.mediaUrl ||
    row.dataset.imagenUrl ||
    row.dataset.videoUrl;

  const tieneArchivo =
    row.__edMediaFile ||
    row.querySelector(".edInputMedia")?.files?.[0];

  const tieneAudio =
    row.querySelector(".edInputAudioEs")?.files?.[0] ||
    row.querySelector(".edInputAudioEn")?.files?.[0] ||
    row.dataset.audioEsUrl ||
    row.dataset.audioEnUrl;

  return !tieneMediaGuardada && !tieneArchivo && !tieneAudio;
}

window.edAgregarImagenesSerie = function(input) {
  const archivos = Array.from(input?.files || [])
    .filter(file => String(file?.type || "").startsWith("image/"));

  if (!archivos.length) {
    alert("Elegí una o más imágenes.");
    if (input) input.value = "";
    return;
  }

  const wrap = ed$("edPaginasEditor");
  if (!wrap) return;

  // ✅ Si estaba la Página 1 vacía de arranque, la quitamos para no dejar basura.
  Array.from(wrap.querySelectorAll(".ed-page-editor")).forEach(row => {
    if (edFilaPaginaVacia(row)) row.remove();
  });

  // ✅ Orden prolijo por nombre: 01, 02, 03...
  archivos.sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "es", {
      numeric: true,
      sensitivity: "base"
    })
  );

  archivos.forEach(file => {
    edAgregarPagina({
      __file: file
    });
  });

  edRenumerarPaginas();

  edSetEstado(`✅ Se agregaron ${archivos.length} imágenes en serie.`);

  // permite volver a elegir los mismos archivos si te equivocaste
  if (input) input.value = "";
};

async function edCargarPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;

  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  return window.pdfjsLib;
}

async function edPdfPageToFile(pdf, pageNumber, baseName = "pdf") {
  const page = await pdf.getPage(pageNumber);

  const viewportBase = page.getViewport({ scale: 1 });
  const escala = Math.min(2.2, Math.max(1.4, 1600 / viewportBase.width));
  const viewport = page.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport
  }).promise;

  const blob = await new Promise(resolve => {
    canvas.toBlob(resolve, "image/png", 0.95);
  });

  return new File(
    [blob],
    `${baseName}_pagina_${String(pageNumber).padStart(2, "0")}.png`,
    { type: "image/png" }
  );
}

window.edAgregarPDF = async function(input) {
  const file = input?.files?.[0] || null;

  if (!file) return;

  if (!String(file.type || "").includes("pdf") && !String(file.name || "").toLowerCase().endsWith(".pdf")) {
    alert("Elegí un archivo PDF.");
    if (input) input.value = "";
    return;
  }

  const wrap = ed$("edPaginasEditor");
  if (!wrap) return;

  try {
    edSetEstado("Leyendo PDF...");

    Array.from(wrap.querySelectorAll(".ed-page-editor")).forEach(row => {
      if (edFilaPaginaVacia(row)) row.remove();
    });

    const pdfjsLib = await edCargarPdfJs();
    const buffer = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    const baseName = edSafeName(file.name || "pdf").replace(/\.pdf$/i, "");

    for (let i = 1; i <= pdf.numPages; i++) {
      edSetEstado(`Convirtiendo PDF: página ${i} de ${pdf.numPages}...`);

      const imgFile = await edPdfPageToFile(pdf, i, baseName);

      edAgregarPagina({
        __file: imgFile
      });

      await new Promise(r => setTimeout(r, 20));
    }

    edRenumerarPaginas();
    edSetEstado(`✅ PDF cargado: ${pdf.numPages} páginas.`);

  } catch (err) {
    console.error(err);
    alert("No pude convertir el PDF. Probá con otro archivo o con imágenes.");
  } finally {
    if (input) input.value = "";
  }
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

    row.dataset.ordenActual = String(i);
  });

  edActualizarPortadaVisual();
  edActivarOrdenPaginas();
}

window.edDefinirPortadaRow = function(row) {
  if (!row) return;

  document.querySelectorAll("#edPaginasEditor .ed-page-editor").forEach(r => {
    r.dataset.portadaElegida = "";
  });

  row.dataset.portadaElegida = "1";

  edActualizarPortadaVisual();
  edSetEstado("✅ Esta página quedó marcada como portada.");
};

function edActualizarPortadaVisual() {
  document.querySelectorAll("#edPaginasEditor .ed-page-editor").forEach(row => {
    const activa = row.dataset.portadaElegida === "1";

    row.classList.toggle("ed-page-portada", activa);

    const badge = row.querySelector(".ed-portada-badge");
    if (badge) badge.style.display = activa ? "inline-flex" : "none";
  });
}

function edActivarOrdenPaginas() {
  const wrap = ed$("edPaginasEditor");
  if (!wrap || wrap.dataset.ordenActivo === "1") return;

  wrap.dataset.ordenActivo = "1";

  let rowActiva = null;
  let yInicial = 0;
  let offsetY = 0;
  let moviendo = false;
  let placeholder = null;
  let portadaTimer = null;

  function limpiarPortadaTimer() {
    if (portadaTimer) {
      clearTimeout(portadaTimer);
      portadaTimer = null;
    }
  }

  function finalizarDrag() {
    limpiarPortadaTimer();

    if (!rowActiva) return;

    rowActiva.classList.remove("ed-page-dragging");
    rowActiva.style.position = "";
    rowActiva.style.zIndex = "";
    rowActiva.style.left = "";
    rowActiva.style.top = "";
    rowActiva.style.width = "";
    rowActiva.style.pointerEvents = "";
    rowActiva.style.transform = "";

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.insertBefore(rowActiva, placeholder);
      placeholder.remove();
    }

    placeholder = null;
    rowActiva = null;
    moviendo = false;

    edRenumerarPaginas();
  }

  function rowDespuesDeY(y) {
    const rows = [...wrap.querySelectorAll(".ed-page-editor:not(.ed-page-dragging)")];

    return rows.find(row => {
      const box = row.getBoundingClientRect();
      return y < box.top + box.height / 2;
    }) || null;
  }

  wrap.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(".ed-page-editor");
    if (!row) return;

    if (e.target.closest("button, input, select, textarea, audio, video")) return;

    rowActiva = row;
    yInicial = e.clientY;

    const box = row.getBoundingClientRect();
    offsetY = e.clientY - box.top;

    // ✅ Mantener apretado sin mover = definir portada.
    portadaTimer = setTimeout(() => {
      if (!rowActiva || moviendo) return;
      edDefinirPortadaRow(rowActiva);
      rowActiva = null;
    }, 750);
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!rowActiva) return;

    const distancia = Math.abs(e.clientY - yInicial);

    if (!moviendo && distancia < 8) return;

    limpiarPortadaTimer();

    if (!moviendo) {
      moviendo = true;

      const box = rowActiva.getBoundingClientRect();

      placeholder = document.createElement("div");
      placeholder.className = "ed-page-placeholder";
      placeholder.style.height = `${box.height}px`;

      rowActiva.parentNode.insertBefore(placeholder, rowActiva.nextSibling);

      rowActiva.classList.add("ed-page-dragging");
      rowActiva.style.width = `${box.width}px`;
      rowActiva.style.position = "fixed";
      rowActiva.style.zIndex = "999999";
      rowActiva.style.left = `${box.left}px`;
      rowActiva.style.top = `${box.top}px`;
      rowActiva.style.pointerEvents = "none";

      try {
        rowActiva.setPointerCapture?.(e.pointerId);
      } catch (_) {}
    }

    e.preventDefault();

    rowActiva.style.top = `${e.clientY - offsetY}px`;

    const despues = rowDespuesDeY(e.clientY);

    if (despues) {
      wrap.insertBefore(placeholder, despues);
    } else {
      wrap.appendChild(placeholder);
    }
  });

  wrap.addEventListener("pointerup", finalizarDrag);
  wrap.addEventListener("pointercancel", finalizarDrag);
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
const rama = edNormalizarRama(ed$("edRama")?.value || "flyers");
const portadaFile = ed$("edPortadaFile")?.files?.[0] || null;
  const rows = Array.from(document.querySelectorAll("#edPaginasEditor .ed-page-editor"));

  if (!titulo) {
    alert("Completá el título.");
    return;
  }

    const existente = edicionEditId ? await obtenerEdicion(edicionEditId) : null;

  const portadaExistente = String(existente?.portadaUrl || "").trim();

  if (!rows.length && !portadaFile && !portadaExistente) {
    alert("Cargá una portada o agregá al menos una página.");
    return;
  }
  
  const edId = edicionEditId || push(ref(db, "ediciones")).key;
    const refPublica = existente?.refPublica || await edCrearRefPublicaUnica(titulo, edId);

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando...";
    }

    edSetEstado("Preparando archivos...");

    const paginasObj = {};
let portadaDesdePagina = "";

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const pageId = row.dataset.pageId || edKey("p");

      let imagenUrl = row.dataset.imagenUrl || "";
      let videoUrl = row.dataset.videoUrl || "";
      let mediaUrl = row.dataset.mediaUrl || imagenUrl || videoUrl || "";
      let mediaType = row.dataset.mediaType || (videoUrl ? "video/mp4" : (imagenUrl ? "image/*" : ""));

      let videoKey = row.dataset.videoKey || "";
      let videoFileName = row.dataset.videoFileName || "";
      let videoSizeBytes = Number(row.dataset.videoSizeBytes || 0);

      let audioEsUrl = row.dataset.audioEsUrl || "";
      let audioEnUrl = row.dataset.audioEnUrl || "";

const mediaFile =
  row.__edMediaFile ||
  row.querySelector(".edInputMedia")?.files?.[0] ||
  row.querySelector(".edInputImagen")?.files?.[0] ||
  null;

      const esFile = row.querySelector(".edInputAudioEs")?.files?.[0] || null;
      const enFile = row.querySelector(".edInputAudioEn")?.files?.[0] || null;

      if (mediaFile) {
        if (edEsVideoFile(mediaFile)) {
          edSetEstado(`Subiendo video ${i + 1} (${edFormatoMB(mediaFile.size)} MB)...`);

          const subida = await subirVideoEdicionR2Directo(mediaFile);

          videoUrl = subida.url;
          imagenUrl = "";
          mediaUrl = subida.url;
          mediaType = subida.contentType;

          videoKey = subida.key || "";
          videoFileName = subida.fileName || mediaFile.name || "";
          videoSizeBytes = Number(subida.sizeBytes || mediaFile.size || 0);
        } else {
          edSetEstado(`Subiendo imagen ${i + 1}...`);

          imagenUrl = await subirArchivoEdicionR2(mediaFile, `ediciones/${edId}/imagenes`);
          videoUrl = "";
          mediaUrl = imagenUrl;
          mediaType = mediaFile.type || "image/*";

          videoKey = "";
          videoFileName = "";
          videoSizeBytes = 0;
        }
      }

           if (!mediaUrl) {
        const tieneAudioSinImagen =
          esFile ||
          enFile ||
          audioEsUrl ||
          audioEnUrl;

        if (tieneAudioSinImagen) {
          alert(`La página ${i + 1} tiene audio, pero le falta imagen o video.`);
          return;
        }

        // ✅ Si la página está vacía, la salteamos.
        // Esto permite guardar una edición solo con portada.
        continue;
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

        // ✅ compatibilidad vieja
        imagenUrl,

        // ✅ nuevo soporte imagen / video
        videoUrl,
        mediaUrl,
        mediaType,

        videoKey,
        videoFileName,
        videoSizeBytes,

        audioEsUrl,
        audioEnUrl,
        actualizado: Date.now()
      };

            if (row.dataset.portadaElegida === "1" && !edPaginaEsVideo({ mediaType, videoUrl, mediaUrl })) {
        portadaDesdePagina = imagenUrl || mediaUrl || "";
      }
    }

     let portadaUrl = portadaDesdePagina || existente?.portadaUrl || "";

    if (portadaFile) {
      edSetEstado("Subiendo portada...");
      portadaUrl = await subirArchivoEdicionR2(portadaFile, `ediciones/${edId}/portada`);
    } else if (portadaDesdePagina) {
      portadaUrl = portadaDesdePagina;
    }

       if (!portadaUrl) {
      const primeraImagen = Object.values(paginasObj)
        .find(p => !edPaginaEsVideo(p) && (p.imagenUrl || p.mediaUrl));

      portadaUrl = primeraImagen?.imagenUrl || primeraImagen?.mediaUrl || "";
    }

    // ✅ Si no hay páginas, pero sí hay portada,
    // usamos la portada como única página de la edición.
    if (!Object.keys(paginasObj).length) {
      if (!portadaUrl) {
        alert("Cargá una portada o al menos una página.");
        return;
      }

      const portadaPageId = edKey("p");

      paginasObj[portadaPageId] = {
        orden: 0,
        imagenUrl: portadaUrl,
        videoUrl: "",
        mediaUrl: portadaUrl,
        mediaType: "image/*",
        videoKey: "",
        videoFileName: "",
        videoSizeBytes: 0,
        audioEsUrl: "",
        audioEnUrl: "",
        actualizado: Date.now()
      };
    }

const data = {
    titulo,
  refPublica,
  rama,
  categoria: rama,
  tipoEdicion: rama,
  portadaUrl,
  paginas: paginasObj,
  publicada: true,
  creadoPor: existente?.creadoPor || window.__UID || "",
  ts: existente?.ts || Date.now(),
  actualizado: Date.now()
};

    edSetEstado("Guardando datos...");
    await set(ref(db, `ediciones/${edId}`), data);
await set(ref(db, `edicionesRefs/${refPublica}`), {
  edicionId: edId,
  titulo,
  ts: Date.now()
});
    edSetEstado("Edición guardada.");
    cerrarEditorEdicion();
  } catch (err) {
    console.error(err);
    alert(
      "No pude guardar la edición.\n\n" +
      (err?.message || err)
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar edición";
    }
  }
};

/* ================= VIDEOS GRANDES: SUBIDA DIRECTA A R2 ================= */

function edEsVideoFile(file) {
  const tipo = String(file?.type || "");
  const nombre = String(file?.name || "").toLowerCase();

  return (
    tipo.startsWith("video/") ||
    nombre.endsWith(".mp4") ||
    nombre.endsWith(".webm") ||
    nombre.endsWith(".mov")
  );
}

function edContentTypeVideo(file) {
  const tipo = String(file?.type || "").trim();
  if (tipo) return tipo;

  const nombre = String(file?.name || "").toLowerCase();

  if (nombre.endsWith(".mov")) return "video/quicktime";
  if (nombre.endsWith(".webm")) return "video/webm";

  return "video/mp4";
}

function edFormatoMB(bytes = 0) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1);
}

async function subirVideoEdicionR2Directo(file) {
  if (!file) throw new Error("Falta video.");

  const contentType = edContentTypeVideo(file);

  const permitidos = ["video/mp4", "video/webm", "video/quicktime"];
  if (!permitidos.includes(contentType)) {
    throw new Error("Tipo de video no permitido. Usá MP4, WEBM o MOV.");
  }

  const maxBytes = 80 * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(`Video demasiado grande: ${edFormatoMB(file.size)} MB. Máximo inicial: 80 MB.`);
  }

  edSetEstado(`Subiendo video a R2 (${edFormatoMB(file.size)} MB)...`);

  // ✅ Sin base64, sin Firebase Functions.
  // El video viaja como archivo real al Worker.
  const form = new FormData();
  form.append("file", file);
  form.append("destino", "ediciones");
  form.append("folder", "videos/ediciones");
  form.append("contentType", contentType);

  const r = await fetch(R2_VIDEO_UPLOAD_URL_EDICIONES, {
    method: "POST",
    body: form
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir video a R2.");
  }

  return {
    ok: true,
    url: data.url,
    key: data.key || "",
    fileName: data.fileName || file.name || `video_${Date.now()}.mp4`,
    contentType: data.contentType || contentType,
    sizeBytes: Number(data.sizeBytes || file.size || 0),
    subidaDirectaVideo: true
  };
}

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

/* ================= DESCARGA PNG + MINI GALERÍA EDICIONES ================= */

function edPaginasImagenes(edicion = {}) {
  return edPaginasArray(edicion)
    .filter(p => !edPaginaEsVideo(p))
    .filter(p => edMediaUrlPagina(p));
}

/*
  ✅ Esta es la lista REAL que se ve en pantalla para acciones.
  Antes la galería podía mostrar portada + páginas,
  pero compartir/descargar usaba solo páginas.
  Eso desfasaba el índice y compartía/descargaba otra imagen.
*/
function edPaginasImagenesVisuales(edicion = {}) {
  const esCategoriaVideos = edRamaEdicion(edicion) === "videos";

  const paginas = esCategoriaVideos
    ? edPaginasArray(edicion)
    : edPaginasArrayConPortada(edicion);

  return paginas
    .filter(p => !edPaginaEsVideo(p))
    .filter(p => edMediaUrlPagina(p));
}

async function edBlobPngDesdeUrl(url) {
  const dataUrl = await edUrlToDataUrl(url);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("No pude convertir la imagen a PNG."));
          return;
        }

        resolve(blob);
      }, "image/png");
    };

    img.onerror = () => reject(new Error("No pude leer la imagen."));
    img.src = dataUrl;
  });
}

function edDescargarBlob(blob, nombre = "imagen.png") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function edIndiceActualMiniGaleria(id, contexto = "ediciones") {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return 0;

  const ancho = track.clientWidth || 1;
  return Math.max(0, Math.round((track.scrollLeft || 0) / ancho));
}

function edIndiceActualVisor() {
  const track = document.querySelector("#edViewer .ed-slides");
  if (!track) return 0;

  const ancho = track.clientWidth || 1;
  return Math.max(0, Math.round((track.scrollLeft || 0) / ancho));
}

window.edMoverMiniGaleria = function edMoverMiniGaleria(id, contexto = "ediciones", direccion = 1) {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return;

  track.scrollBy({
    left: track.clientWidth * Number(direccion || 1),
    behavior: "smooth"
  });

  setTimeout(() => edActualizarMiniFlechas(id, contexto), 300);
};

window.edActualizarMiniFlechas = function edActualizarMiniFlechas(id, contexto = "ediciones") {
  const track = document.getElementById(`edMiniTrack_${contexto}_${id}`);
  if (!track) return;

  const wrap = track.closest(".ed-mini-galeria");
  if (!wrap) return;

  const prev = wrap.querySelector(".ed-mini-prev");
  const next = wrap.querySelector(".ed-mini-next");

  if (!prev || !next) return;

  const hayScroll = track.scrollWidth > track.clientWidth + 8;
  const inicio = track.scrollLeft <= 4;
  const final = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;

  prev.classList.toggle("ed-mini-nav-oculta", !hayScroll || inicio);
  next.classList.toggle("ed-mini-nav-oculta", !hayScroll || final);
};

window.edActivarMiniGalerias = function edActivarMiniGalerias(root = document) {
  const tracks = root.querySelectorAll?.(".ed-mini-paginas") || [];

  tracks.forEach(track => {
    const wrap = track.closest(".ed-mini-galeria");
    if (!wrap) return;

    const id = wrap.dataset.edId || "";
    const contexto = wrap.dataset.contexto || "ediciones";

    if (track.dataset.readyMini !== "1") {
      track.dataset.readyMini = "1";

      track.addEventListener("scroll", () => {
        edActualizarMiniFlechas(id, contexto);
      }, { passive: true });

      // PC: rueda vertical sobre la imagen mueve horizontal.
track.addEventListener("wheel", e => {
        const esCompartidos =
          contexto === "compartidos" ||
          !!track.closest?.("#compLista") ||
          document.body.classList.contains("en-compartidos");

        // ✅ En Compartidos, la rueda vertical baja la página.
        // No la convertimos en scroll horizontal.
        if (esCompartidos && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          return;
        }

        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

        e.preventDefault();
        track.scrollLeft += e.deltaY;
        edActualizarMiniFlechas(id, contexto);
      }, { passive: false });
    }

    requestAnimationFrame(() => edActualizarMiniFlechas(id, contexto));
  });
};

window.descargarPaginaEdicionPNG = async function descargarPaginaEdicionPNG(id, index = 0, boton = null, opts = {}) {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    if (!opts.silencioso) alert("No encontré la edición.");
    return;
  }

 const paginas = opts.paginasVisuales || edPaginasImagenesVisuales(ed);
  const pagina = paginas[Number(index || 0)];

  if (!pagina) {
    if (!opts.silencioso) alert("No encontré esa imagen.");
    return;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    const blob = await edBlobPngDesdeUrl(edMediaUrlPagina(pagina));
    const base = edSafeName(ed.titulo || "edicion").replace(/\.[^.]+$/, "");
    const nombre = `${base}_pagina_${Number(index || 0) + 1}.png`;

    edDescargarBlob(blob, nombre);

    if (opts.marcar !== false) {
      await edMarcarDescargada(id);
      await edIncrementarStat(id, "descargas");
    }

  } catch (e) {
    console.error(e);

    if (!opts.silencioso) {
      alert("No pude descargar esta imagen como PNG.");
    }

    throw e;

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

function edElegirDescargaPNG(total = 1) {
  return new Promise(resolve => {
    // Si hay una sola imagen, no preguntamos nada.
    if (Number(total || 0) <= 1) {
      resolve("actual");
      return;
    }

    const anterior = document.getElementById("edDescargaPngModal");
    if (anterior) anterior.remove();

    const modal = document.createElement("div");
    modal.id = "edDescargaPngModal";
    modal.className = "modal-overlay abierto";
    modal.setAttribute("aria-hidden", "false");

modal.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483000 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0,0,0,.55) !important;
      padding: 14px !important;
      box-sizing: border-box !important;
    `;

    modal.innerHTML = `
      <div
        class="modal-card modal-card-sm"
        style="
          width: min(380px, calc(100vw - 32px));
          background: rgba(255,255,255,.98);
          color: #000;
          border-radius: 20px;
          padding: 18px;
          box-shadow: 0 16px 50px rgba(0,0,0,.28);
          position: relative;
                    z-index: 2147483001;
          box-sizing: border-box;
        "
      >
        <button
          type="button"
          data-ed-png-close="1"
          aria-label="Cerrar"
          title="Cerrar"
          style="
            position: absolute;
            right: 12px;
            top: 12px;
            width: 34px;
            height: 34px;
            border: none;
            border-radius: 999px;
            background: rgba(0,0,0,.06);
            color: #000;
            font-size: 20px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          "
        >
          ×
        </button>

        <h3 style="margin: 0 0 8px; font-size: 22px; font-weight: 900;">
          Descargar PNG
        </h3>

        <p style="margin: 0 0 16px; font-size: 14px; opacity: .75;">
          Elegí qué querés descargar.
        </p>

        <div style="display: grid; gap: 10px;">
          <button
            type="button"
            class="btn-primary"
            data-ed-png-opcion="actual"
            style="
              width: 100%;
              min-height: 46px;
              border-radius: 14px;
              font-weight: 900;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <i class="fa-solid fa-download"></i>
            Descargar imagen actual
          </button>

          <button
            type="button"
            class="btn-primary"
            data-ed-png-opcion="todas"
            style="
              width: 100%;
              min-height: 46px;
              border-radius: 14px;
              font-weight: 900;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            "
          >
            <i class="fa-solid fa-download"></i>
            Descargar todas
          </button>
        </div>
      </div>
    `;

    edMontarModalEdiciones(modal);

    const cerrar = valor => {
      modal.remove();
      resolve(valor);
    };

    modal.querySelector('[data-ed-png-close="1"]')?.addEventListener("click", () => {
      cerrar(null);
    });

    modal.querySelector('[data-ed-png-opcion="actual"]')?.addEventListener("click", () => {
      cerrar("actual");
    });

    modal.querySelector('[data-ed-png-opcion="todas"]')?.addEventListener("click", () => {
      cerrar("todas");
    });

    modal.addEventListener("click", e => {
      if (e.target === modal) cerrar(null);
    });
  });
}

window.descargarEdicionPNGs = async function descargarEdicionPNGs(id, boton = null, contexto = "ediciones") {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

const paginas = edPaginasImagenesVisuales(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene imágenes para descargar.");
    return;
  }

  const indiceActual =
    contexto === "visor"
      ? edIndiceActualVisor()
      : edIndiceActualMiniGaleria(id, contexto);

const eleccion = await edElegirDescargaPNG(paginas.length);

if (!eleccion) {
  return;
}

const descargarTodas = eleccion === "todas";

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (descargarTodas) {
      for (let i = 0; i < paginas.length; i++) {
await descargarPaginaEdicionPNG(id, i, null, {
  marcar: false,
  silencioso: true,
  paginasVisuales: paginas
});

        await new Promise(r => setTimeout(r, 350));
      }
    } else {
await descargarPaginaEdicionPNG(id, indiceActual, null, {
  marcar: false,
  silencioso: true,
  paginasVisuales: paginas
});
    }

    await edMarcarDescargada(id);
    await edIncrementarStat(id, "descargas");

  } catch (e) {
    console.error(e);
    alert("No pude descargar las imágenes PNG.");

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

function edMiniPaginasHTML(id, contexto = "ediciones") {
  const ed =
    edicionesCache.find(x => x.id === id) ||
    (window.__EDICIONES_CACHE || []).find(x => x.id === id);

  if (!ed) return "";

  // ✅ Usamos la misma lista que compartir/descargar.
  // Así la imagen visible y la imagen descargada/compartida coinciden.
  const items = edPaginasImagenesVisuales(ed);

  if (!items.length) {
    return `<div class="ed-mini-empty">Sin imagen</div>`;
  }

  return `
    <div
      class="ed-mini-galeria ed-mini-galeria--${edEscape(contexto)}"
      data-ed-id="${edEscape(id)}"
      data-contexto="${edEscape(contexto)}"
    >

      ${items.length > 1 ? `
        <button
          type="button"
          class="ed-mini-nav ed-mini-prev ed-mini-nav-oculta"
          onclick="event.stopPropagation(); edMoverMiniGaleria('${edEscape(id)}', '${edEscape(contexto)}', -1)"
          title="Imagen anterior"
          aria-label="Imagen anterior"
        >
          <i class="fa-solid fa-chevron-left"></i>
        </button>
      ` : ``}

      <div
        id="edMiniTrack_${edEscape(contexto)}_${edEscape(id)}"
        class="ed-mini-paginas"
      >
        ${items.map((p, i) => {
          const url = edMediaUrlPagina(p);

          return `
            <div class="ed-mini-page">
              <img
                src="${edEscape(url)}"
                alt="${edEscape(ed.titulo || "Edición")} ${i + 1}"
                loading="lazy"
                onclick="abrirPresentacionEdicion('${edEscape(id)}')"
              >
            </div>
          `;
        }).join("")}
      </div>

      ${items.length > 1 ? `
        <button
          type="button"
          class="ed-mini-nav ed-mini-next ed-mini-nav-oculta"
          onclick="event.stopPropagation(); edMoverMiniGaleria('${edEscape(id)}', '${edEscape(contexto)}', 1)"
          title="Siguiente imagen"
          aria-label="Siguiente imagen"
        >
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      ` : ``}
    </div>
  `;
}

window.edMiniPaginasHTML = edMiniPaginasHTML;

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

  const esCategoriaVideos = edRamaEdicion(ed) === "videos";

  // ✅ En Videos NO metemos la portada como primera página.
  // Si metemos la portada, el video se reproduce atrás pero se sigue viendo la portada.
  const paginas = esCategoriaVideos
    ? edPaginasArray(ed)
    : edPaginasArrayConPortada(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene páginas.");
    return;
  }

  const tieneVideo = paginas.some(p => edPaginaEsVideo(p));

  const indiceInicial =
    esCategoriaVideos && tieneVideo
      ? Math.max(0, paginas.findIndex(p => edPaginaEsVideo(p)))
      : 0;

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

        ${!tieneVideo ? `
          <button type="button" onclick="descargarEdicionPDF('${ed.id}')" title="Descargar PDF">
            <i class="fa-solid fa-file-pdf"></i>
          </button>
        ` : ``}

        ${!tieneVideo ? `
          <button type="button" onclick="descargarEdicionPNGs('${ed.id}', this, 'visor')" title="Descargar PNG">
            <i class="fa-solid fa-download"></i>
          </button>
        ` : ``}

        <button type="button" onclick="edAbrirOpcionesCompartirEdicion('${ed.id}', 'visor', this)" title="Compartir imagen o publicación">
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        <button type="button" class="ed-view-close" onclick="cerrarPresentacionEdicion()" title="Cerrar">
          ×
        </button>
      </div>
    </div>

    ${paginas.length > 1 ? `
      <button
        type="button"
        class="ed-nav-btn ed-nav-prev"
        onclick="edMoverSlide(-1)"
        title="Página anterior"
        aria-label="Página anterior"
      >
        <i class="fa-solid fa-chevron-left"></i>
      </button>

      <button
        type="button"
        class="ed-nav-btn ed-nav-next"
        onclick="edMoverSlide(1)"
        title="Página siguiente"
        aria-label="Página siguiente"
      >
        <i class="fa-solid fa-chevron-right"></i>
      </button>
    ` : ``}

    <div class="ed-slides">
      ${paginas.map((p, i) => `
        <section class="ed-slide">
          <div class="ed-slide-inner">
            <div class="ed-slide-img-wrap">
              ${
                edPaginaEsVideo(p)
                  ? `<video
                      class="ed-slide-video"
                      src="${edEscape(edMediaUrlPagina(p))}"
                      controls
                      playsinline
                      preload="auto"
                      ${i === indiceInicial ? "autoplay" : ""}
                    ></video>`
                  : `<img
                      class="ed-slide-img"
                      src="${edEscape(edMediaUrlPagina(p))}"
                      alt="Página ${i + 1}"
                      loading="lazy"
                    >`
              }
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

  edPrepararVisorEdicion(viewer);

  viewer.classList.add("ed-open");
  document.body.style.overflow = "hidden";

  requestAnimationFrame(() => {
    edIrASlide(indiceInicial, "auto");

    setTimeout(() => {
      edIrASlide(indiceInicial, "auto");

      const slide = viewer.querySelectorAll(".ed-slide")[indiceInicial];
      const video = slide?.querySelector("video");

      if (video) {
        try {
          video.currentTime = 0;
          video.play().catch(() => {});
        } catch (e) {}
      }
    }, 80);
  });

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

function edAjustarViewportEdiciones() {
  const h =
    window.visualViewport?.height ||
    window.innerHeight ||
    document.documentElement.clientHeight ||
    0;

  if (h) {
    document.documentElement.style.setProperty("--ed-vh", `${h}px`);
  }
}

function edActivarViewportEdiciones() {
  if (window.__ED_VIEWPORT_LISTENER_OK) return;

  window.__ED_VIEWPORT_LISTENER_OK = true;

  edAjustarViewportEdiciones();

  window.addEventListener("resize", edAjustarViewportEdiciones);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", edAjustarViewportEdiciones);
    window.visualViewport.addEventListener("scroll", edAjustarViewportEdiciones);
  }
}

function edPausarMediosEdicion(excepto = null) {
  document.querySelectorAll("#edViewer audio, #edViewer video").forEach((media) => {
    if (excepto && media === excepto) return;

    try {
      media.pause();
    } catch (_) {}
  });
}

function edIndiceSlideActual(slides = null) {
  const cont = slides || document.querySelector("#edViewer .ed-slides");
  if (!cont) return 0;

  const ancho = cont.clientWidth || window.innerWidth || 1;
  return Math.round(cont.scrollLeft / ancho);
}

function edIrASlide(indice, behavior = "smooth") {
  const slides = document.querySelector("#edViewer .ed-slides");
  if (!slides) return;

  const total = slides.querySelectorAll(".ed-slide").length;
  if (!total) return;

  const ancho = slides.clientWidth || window.innerWidth || 1;
  const seguro = Math.max(0, Math.min(total - 1, Number(indice || 0)));

  edPausarMediosEdicion();

  slides.dataset.edSlideActual = String(seguro);

  slides.scrollTo({
    left: seguro * ancho,
    behavior
  });
}

function edPrepararVisorEdicion(viewer) {
  if (!viewer) return;

  edActivarViewportEdiciones();

  const slides = viewer.querySelector(".ed-slides");
  if (!slides) return;

  slides.dataset.edSlideActual = "0";

  // ✅ Si un audio/video empieza, se detienen todos los demás.
  viewer.querySelectorAll("audio, video").forEach((media) => {
    media.addEventListener("play", () => {
      edPausarMediosEdicion(media);
    });
  });

  let scrollTimer = null;

  // ✅ Si cambia la página por scroll, se detienen los audios.
  slides.addEventListener("scroll", () => {
    clearTimeout(scrollTimer);

    scrollTimer = setTimeout(() => {
      const actual = edIndiceSlideActual(slides);

      if (slides.dataset.edSlideActual !== String(actual)) {
        slides.dataset.edSlideActual = String(actual);
        edPausarMediosEdicion();
      }

      // Corrige para que quede clavado en una página.
      edIrASlide(actual, "smooth");
    }, 120);
  }, { passive: true });

  let touchActivo = false;
  let touchX = 0;
  let touchY = 0;
  let touchInicioIndice = 0;

  slides.addEventListener("touchstart", (e) => {
    if (e.target?.closest?.("audio, video, button, input, select, textarea")) return;

    const t = e.touches?.[0];
    if (!t) return;

    touchActivo = true;
    touchX = t.clientX;
    touchY = t.clientY;
    touchInicioIndice = edIndiceSlideActual(slides);
  }, { passive: true });

  slides.addEventListener("touchend", (e) => {
    if (!touchActivo) return;

    touchActivo = false;

    const t = e.changedTouches?.[0];
    if (!t) return;

    const dx = t.clientX - touchX;
    const dy = t.clientY - touchY;

    const total = slides.querySelectorAll(".ed-slide").length;
    let destino = touchInicioIndice;

    // ✅ Un gesto = máximo una página.
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      destino = touchInicioIndice + (dx < 0 ? 1 : -1);
    }

    destino = Math.max(0, Math.min(total - 1, destino));

    edPausarMediosEdicion();

    setTimeout(() => edIrASlide(destino, "smooth"), 30);
    setTimeout(() => edIrASlide(destino, "smooth"), 180);
    setTimeout(() => edIrASlide(destino, "smooth"), 360);
  }, { passive: true });

  slides.addEventListener("touchcancel", () => {
    touchActivo = false;
  }, { passive: true });
}

window.cerrarPresentacionEdicion = () => {
  const veniaDesdeLinkCompartidos =
    !!window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS ||
    document.body.classList.contains("ed-link-directo");

  edPausarMediosEdicion();

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

  if (veniaDesdeLinkCompartidos) {
    window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS = false;

    try {
      history.replaceState(
        null,
        "",
        `${edBasePublicaApp()}/`
      );
    } catch (_) {}

    if (typeof window.irA === "function") {
      window.irA("compartidos");
    }

    if (typeof window.mostrarCompartidos === "function") {
      window.mostrarCompartidos();
    }
  }
};

window.edMoverSlide = (dir = 1) => {
  const slides = document.querySelector("#edViewer .ed-slides");
  if (!slides) return;

  const total = slides.querySelectorAll(".ed-slide").length;
  if (!total) return;

  const actual = edIndiceSlideActual(slides);

  let siguiente = actual + Number(dir || 1);

  if (siguiente < 0) siguiente = total - 1;
  if (siguiente >= total) siguiente = 0;

  edIrASlide(siguiente, "smooth");
};

document.addEventListener("keydown", (e) => {
  const viewerAbierto = document.querySelector("#edViewer.ed-open");

  if (e.key === "Escape") {
    cerrarPresentacionEdicion();
    return;
  }

  if (!viewerAbierto) return;

  if (e.key === "ArrowRight") {
    edMoverSlide(1);
  }

  if (e.key === "ArrowLeft") {
    edMoverSlide(-1);
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

if (paginas.some(p => edPaginaEsVideo(p))) {
  alert("Esta edición contiene video, por eso no tiene descarga PDF.");
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

      if (edPaginaEsVideo(paginas[i])) {
  pdf.setFontSize(18);
  pdf.text("Página con video", pageW / 2, pageH / 2 - 12, { align: "center" });

  pdf.setFontSize(11);
  pdf.text(
    "El video no se puede insertar dentro del PDF.",
    pageW / 2,
    pageH / 2 + 12,
    { align: "center" }
  );

  continue;
}

const dataUrl = await edUrlToDataUrl(edMediaUrlPagina(paginas[i]));
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

function edBuildR2ProxyUrl(url) {
  try {
    const u = new URL(R2_PROXY_URL_EDICIONES);
    u.searchParams.set("url", url);
    u.searchParams.set("nombre", "edicion");
    return u.toString();
  } catch (_) {
    return url;
  }
}

async function edFetchBlobEdicion(url, mensajeError = "No pude leer el archivo.") {
  if (!url) throw new Error("Falta URL.");

  const original = String(url || "").trim();

  if (original.startsWith("data:")) {
    const r = await fetch(original);
    return await r.blob();
  }

  const intentos = [];

  // ✅ Primero intenta la URL real.
  intentos.push(original);

  // ✅ Si falla por CORS, intenta el proxy R2.
  const proxy = edBuildR2ProxyUrl(original);
  if (proxy && proxy !== original) {
    intentos.push(proxy);
  }

  let ultimoError = null;

  for (const intento of intentos) {
    try {
      const r = await fetch(intento, {
        mode: "cors",
        cache: "no-store"
      });

      if (!r.ok) {
        throw new Error(`HTTP ${r.status}`);
      }

      const blob = await r.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Blob vacío.");
      }

      return blob;

    } catch (err) {
      ultimoError = err;
      console.warn("No pude leer archivo desde:", intento, err);
    }
  }

  throw ultimoError || new Error(mensajeError);
}

async function edUrlToDataUrl(url) {
  const blob = await edFetchBlobEdicion(
    url,
    "No pude leer imagen para PDF."
  );

  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function edCrearFileDesdeUrl(url, nombre = "edicion.png") {
  if (!url) throw new Error("Falta URL de imagen.");

  const blob = await edFetchBlobEdicion(
    url,
    "No pude preparar la imagen para compartir."
  );

  let tipo = blob.type || "image/png";

  if (!tipo.startsWith("image/")) {
    tipo = "image/png";
  }

  const extension = tipo.includes("jpeg") || tipo.includes("jpg")
    ? ".jpg"
    : tipo.includes("webp")
      ? ".webp"
      : ".png";

  const limpio = edSafeName(nombre || "edicion").replace(/\.[^.]+$/, "");

  return new File([blob], `${limpio}${extension}`, {
    type: tipo
  });
}

async function edCompartirPublicacionLink({ titulo, url, portadaUrl = "" }) {
  const tituloLimpio = String(titulo || "Edición").trim() || "Edición";
  const textoFallback = `${tituloLimpio}\n${url}`;

  // ✅ WhatsApp / compartir móvil:
  // mandamos portada como imagen adjunta + texto con link.
  if (navigator.share && portadaUrl) {
    try {
      const portadaFile = await edCrearFileDesdeUrl(
        portadaUrl,
        `${tituloLimpio}_portada.png`
      );

      if (
        navigator.canShare &&
        navigator.canShare({ files: [portadaFile] })
      ) {
        await navigator.share({
          title: tituloLimpio,
          text: textoFallback,
          files: [portadaFile]
        });

        return "archivo-link";
      }
    } catch (e) {
      console.warn("No pude adjuntar portada, comparto solo link:", e);
    }
  }

  if (!navigator.share) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(textoFallback);
      return "copiado";
    }

    prompt("Copiá este link:", url);
    return "prompt";
  }

  await navigator.share({
    title: tituloLimpio,
    text: tituloLimpio,
    url
  });

  return "link";
}

function edDescargarFileFallback(file) {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");

  a.href = objectUrl;
  a.download = file.name || "edicion.png";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

function edShareSetTrabajando(texto = "") {
  let aviso = document.getElementById("edShareWorkingAviso");

  if (!aviso) {
    aviso = document.createElement("div");
    aviso.id = "edShareWorkingAviso";
    aviso.innerHTML = `
      <span class="ed-share-working-spinner"></span>
      <span id="edShareWorkingTexto"></span>
    `;
    document.body.appendChild(aviso);
  }

  const txt = document.getElementById("edShareWorkingTexto");
  if (txt) txt.textContent = texto || "Preparando...";

  aviso.style.display = texto ? "inline-flex" : "none";
}

function edShareBloquearBotonesModal(bloquear = false, texto = "Preparando...") {
  const modal = document.getElementById("edShareChoiceModal");
  if (!modal) return;

  const botones = modal.querySelectorAll("button");
  botones.forEach(btn => {
    btn.disabled = bloquear;
  });

  modal.classList.toggle("ed-share-busy", bloquear);

  const titulo = modal.querySelector(".modal-title");
  const sub = modal.querySelector(".modal-sub");

  if (titulo && bloquear) titulo.textContent = "Un momento...";
  if (sub && bloquear) sub.textContent = texto;
}

function edMontarModalEdiciones(modal) {
  if (!modal) return;

  const visor = document.getElementById("edViewer");

  const fullscreen =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;

  /*
    ✅ Solo metemos el modal dentro del visor si el visor está en pantalla completa REAL.
    Si el visor está abierto normal, lo dejamos en body con z-index alto.
    Esto evita que Compartir / Descargar queden atrapados o detrás.
  */
  const host =
    visor && fullscreen === visor
      ? visor
      : document.body;

  if (modal.parentElement !== host) {
    host.appendChild(modal);
  }

  modal.style.setProperty("position", "fixed", "important");
  modal.style.setProperty("inset", "0", "important");
  modal.style.setProperty("z-index", "2147483000", "important");
  modal.style.setProperty("display", "flex", "important");
  modal.style.setProperty("align-items", "center", "important");
  modal.style.setProperty("justify-content", "center", "important");
  modal.style.setProperty("background", "rgba(0,0,0,.55)", "important");
  modal.style.setProperty("padding", "14px", "important");
  modal.style.setProperty("box-sizing", "border-box", "important");
  modal.style.setProperty("pointer-events", "auto", "important");
  modal.style.setProperty("visibility", "visible", "important");
  modal.style.setProperty("opacity", "1", "important");

  const card = modal.querySelector(".modal-card");

  if (card) {
    card.style.setProperty("position", "relative", "important");
    card.style.setProperty("z-index", "2147483001", "important");
    card.style.setProperty("width", "min(390px, calc(100vw - 32px))", "important");
    card.style.setProperty("max-height", "calc(100dvh - 40px)", "important");
    card.style.setProperty("overflow", "auto", "important");
    card.style.setProperty("box-sizing", "border-box", "important");
    card.style.setProperty("background", "rgba(255,255,255,.98)", "important");
    card.style.setProperty("color", "#000", "important");
    card.style.setProperty("border-radius", "20px", "important");
    card.style.setProperty("padding", "18px", "important");
    card.style.setProperty("box-shadow", "0 16px 50px rgba(0,0,0,.28)", "important");
  }

  const actions = modal.querySelector(".modal-actions");

  if (actions) {
    actions.style.setProperty("display", "grid", "important");
    actions.style.setProperty("gap", "10px", "important");
  }

  modal.querySelectorAll("button").forEach(btn => {
    btn.style.setProperty("min-height", "44px", "important");
    btn.style.setProperty("cursor", "pointer", "important");
    btn.style.setProperty("pointer-events", "auto", "important");
  });
}

function edAsegurarModalCompartirEdicion() {
  let modal = document.getElementById("edShareChoiceModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "edShareChoiceModal";
    modal.className = "modal-overlay";

    modal.innerHTML = `
      <div class="modal-card modal-card-sm" onclick="event.stopPropagation()">
        <h3 class="modal-title">Compartir edición</h3>

        <p class="modal-sub">
          Elegí qué querés compartir.
        </p>

        <div class="modal-actions">
          <button type="button" id="edShareChoiceImagen" class="btn-primary">
            <i class="fa-solid fa-image"></i>
            Imagen
          </button>

          <button type="button" id="edShareChoicePublicacion" class="btn-primary">
            <i class="fa-solid fa-link"></i>
            Publicación
          </button>

          <button type="button" id="edShareChoiceCancelar" class="btn-ghost">
            Cancelar
          </button>
        </div>
      </div>
    `;
  }

  edMontarModalEdiciones(modal);

  modal.style.setProperty("display", "none", "important");
}

function edElegirTipoCompartirEdicion() {
  edAsegurarModalCompartirEdicion();

  const modal = document.getElementById("edShareChoiceModal");
  const btnImagen = document.getElementById("edShareChoiceImagen");
  const btnPublicacion = document.getElementById("edShareChoicePublicacion");
  const btnCancelar = document.getElementById("edShareChoiceCancelar");

  if (!modal || !btnImagen || !btnPublicacion || !btnCancelar) {
    return Promise.resolve("");
  }

  // ✅ Importante: si el visor está abierto, mete el modal dentro del visor.
  edMontarModalEdiciones(modal);

  return new Promise(resolve => {
    let cerrado = false;

    const cerrar = (valor = "") => {
      if (cerrado) return;
      cerrado = true;

      if (!valor) {
        modal.classList.remove("abierto", "ed-share-busy");
        modal.style.setProperty("display", "none", "important");
      }

      resolve(valor);
    };

    btnImagen.onclick = () => {
      edShareBloquearBotonesModal(true, "Preparando la imagen para compartir.");
      edShareSetTrabajando("Preparando imagen.");
      cerrar("imagen");
    };

    btnPublicacion.onclick = () => {
      edShareBloquearBotonesModal(true, "Preparando el link de la publicación.");
      edShareSetTrabajando("Preparando publicación.");
      cerrar("publicacion");
    };

    btnCancelar.onclick = () => cerrar("");

    modal.onclick = e => {
      if (e.target === modal) cerrar("");
    };

    edShareBloquearBotonesModal(false);

    const titulo = modal.querySelector(".modal-title");
    const sub = modal.querySelector(".modal-sub");

    if (titulo) titulo.textContent = "Compartir edición";
    if (sub) sub.textContent = "Elegí qué querés compartir.";

    modal.classList.add("abierto");
    modal.style.setProperty("display", "flex", "important");
    modal.style.setProperty("z-index", "2147483000", "important");
  });
}

function edIndiceCompartirActual(id, contexto = "ediciones") {
  try {
    if (contexto === "visor" && typeof edIndiceActualVisor === "function") {
      return edIndiceActualVisor();
    }

    if (typeof edIndiceActualMiniGaleria === "function") {
      return edIndiceActualMiniGaleria(id, contexto);
    }
  } catch (_) {}

  return 0;
}

window.edCompartirImagenActualEdicion = async function edCompartirImagenActualEdicion(
  id,
  contexto = "ediciones",
  boton = null
) {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

const paginas = edPaginasImagenesVisuales(ed);

  if (!paginas.length) {
    alert("Esta edición no tiene imágenes para compartir.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const indiceRaw = Number(edIndiceCompartirActual(id, contexto) || 0);
  const indice = Math.max(0, Math.min(indiceRaw, paginas.length - 1));
  const pagina = paginas[indice] || paginas[0];
  const imagenUrl = edMediaUrlPagina(pagina);

  if (!imagenUrl) {
    alert("No encontré la imagen actual.");
    return;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Preparando imagen para compartir...");
    }

    const file = await edCrearFileDesdeUrl(
      imagenUrl,
      `${titulo}_${indice + 1}`
    );

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: titulo,
        files: [file]
      });

      await edIncrementarStat(id, "compartidos");
      return;
    }

    edDescargarFileFallback(file);

    alert(
      "Este navegador no permite compartir la imagen directamente.\n\n" +
      "Se descargó la imagen para que puedas compartirla manualmente."
    );

  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error("No pude compartir la imagen actual:", e);
    alert("No pude compartir la imagen actual.");

  } finally {
    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

window.edAbrirOpcionesCompartirEdicion = async function edAbrirOpcionesCompartirEdicion(
  id,
  contexto = "ediciones",
  boton = null
) {
  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  try {
    const opcion = await edElegirTipoCompartirEdicion();

    if (!opcion) {
      edShareSetTrabajando("");
      return;
    }

    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    if (opcion === "imagen") {
      edShareSetTrabajando("Preparando imagen...");
      await edCompartirImagenActualEdicion(id, contexto, boton);
      return;
    }

    if (opcion === "publicacion") {
      edShareSetTrabajando("Preparando publicación...");
      await compartirEdicion(id, "redes");
    }

  } finally {
    const modal = document.getElementById("edShareChoiceModal");
    if (modal) {
      modal.classList.remove("abierto", "ed-share-busy");
      modal.style.display = "none";
    }

    edShareSetTrabajando("");

    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

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

 const portadaUrl = edPortadaEdicion(ed);

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

async function edAsegurarPublicadaParaCompartir(ed) {
  const db = edDB();

  if (!db) {
    alert("Firebase no está listo.");
    return false;
  }

  const id = ed?.id || "";

  if (!id) {
    alert("No encontré la edición.");
    return false;
  }

  const compRef = ref(db, `compartidos/edicion_${id}`);
  const snap = await get(compRef);

  // Si ya está publicada, no alteramos la fecha ni la subimos de nuevo.
  if (snap.exists()) {
    return true;
  }

  // Mantiene tu regla actual: publicar en Compartidos es tarea de admin.
  if (!window.__ES_ADMIN) {
    alert(
      "Esta edición todavía no está publicada en Compartidos.\n\n" +
      "Un administrador debe enviarla a Compartidos antes de compartir el enlace."
    );
    return false;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = edPortadaEdicion(ed);
  const ts = Date.now();

  try {
    await set(compRef, {
      tipo: "edicion",
      edicionId: id,
      titulo,
      rama: edRamaEdicion(ed),
      categoria: edRamaEdicion(ed),
      tipoEdicion: edRamaEdicion(ed),
      portadaUrl,
      creadoPor: window.__UID || "",
      actualizadoPor: window.__UID || "",
      ts,
      publicadoEn: ts,
      republicadoEn: 0
    });

    edicionesPublicadasCache[id] = true;

    renderEdiciones();

    if (typeof window.renderCompartidos === "function") {
      window.renderCompartidos();
    }

    if (typeof mostrarToast === "function") {
      mostrarToast("✅ Edición enviada a Compartidos para poder compartirla");
    }

    return true;
  } catch (err) {
    console.error("No pude enviar la edición a Compartidos:", err);
    alert("No pude enviar la edición a Compartidos.");
    return false;
  }
}

window.compartirEdicion = async (id, destino = "redes") => {
  const ed = await obtenerEdicion(id);

  if (!ed) {
    alert("No encontré la edición.");
    return;
  }

  const titulo = ed.titulo || "Edición";
  const portadaUrl = edPortadaEdicion(ed);

  /* ===== Botón publicar / volver a publicar en Compartidos ===== */

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

    const compRef = ref(db, `compartidos/edicion_${id}`);
    const snap = await get(compRef);
    const yaEstaba = snap.exists();

    if (yaEstaba) {
      const ok = confirm(
        "Esta edición ya está en Compartidos.\n\n" +
        "¿Volvemos a compartirla para que quede arriba?"
      );

      if (!ok) return;
    }

    const ts = Date.now();

    try {
const anterior = snap.val() || {};

await set(compRef, {
  ...anterior,

  tipo: "edicion",
  edicionId: id,
  titulo,
  rama: edRamaEdicion(ed),
  categoria: edRamaEdicion(ed),
  tipoEdicion: edRamaEdicion(ed),
  portadaUrl,

  creadoPor: anterior.creadoPor || window.__UID || "",
  actualizadoPor: window.__UID || "",

  // ✅ mantiene la publicación original, solo cambia fecha/posición
  fechaOriginal: Number(
    anterior.fechaOriginal ||
    anterior.fecha ||
    anterior.publicadoEn ||
    anterior.ts ||
    0
  ),
  fecha: ts,
  ts,
  publicadoEn: ts,
  republicadoEn: yaEstaba ? ts : 0
});

      edicionesPublicadasCache[id] = true;
      renderEdiciones();

      if (typeof window.renderCompartidos === "function") {
        window.renderCompartidos();
      }

      if (typeof mostrarToast === "function") {
        mostrarToast(
          yaEstaba
            ? "✅ Edición compartida nuevamente"
            : "✅ Edición enviada a Compartidos"
        );
      } else {
        alert(
          yaEstaba
            ? "Edición compartida nuevamente."
            : "Edición enviada a Compartidos."
        );
      }
    } catch (err) {
      console.error("No pude publicar en Compartidos:", err);
      alert("No pude enviar la edición a Compartidos.");
    }

    return;
  }

  /* ===== Compartir publicación con link ===== */

  const publicada = await edAsegurarPublicadaParaCompartir(ed);

  if (!publicada) return;

  const url = await crearLinkPublicoEdicion(id, titulo);

  try {
const resultado = await edCompartirPublicacionLink({
      titulo,
      url,
      portadaUrl
    });

    await edIncrementarStat(id, "compartidos");

    if (resultado === "copiado") {
      if (typeof mostrarToast === "function") {
        mostrarToast("🔗 Link copiado para compartir");
      } else {
        alert("Link copiado para compartir.");
      }
    }
  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error(e);
    alert("No pude compartir la edición.");
  }
};

async function crearLinkPublicoEdicion(id, titulo = "Edición") {
  const refPublica = await edAsegurarRefPublica(id, titulo);

  return `${edBasePublicaApp()}/?ver=compartidos&edicionRef=${encodeURIComponent(refPublica)}`;
}

/* ================= LINK PÚBLICO ================= */

async function edIdDesdeLinkPublico() {
  const params = new URLSearchParams(location.search);

  // Link viejo, para que no se rompan los anteriores:
  // ?ver=edicion&id=...
  if (params.get("ver") === "edicion" && params.get("id")) {
    return {
      id: params.get("id"),
      refPublica: ""
    };
  }

  // Link nuevo redirigido desde /ediciones/?ref=...
  const refPublica =
    params.get("edicionRef") ||
    params.get("ref") ||
    "";

  if (!refPublica) {
    return {
      id: "",
      refPublica: ""
    };
  }

  const db = await edEsperarDB();
  if (!db) {
    return {
      id: "",
      refPublica
    };
  }

  const snapRef = await get(ref(db, `edicionesRefs/${refPublica}`));
  const valRef = snapRef.val();

  const idDesdeRef =
    typeof valRef === "string"
      ? valRef
      : valRef?.edicionId || "";

  if (idDesdeRef) {
    return {
      id: idDesdeRef,
      refPublica
    };
  }

  // Respaldo por si existe refPublica dentro de ediciones,
  // pero todavía no existe edicionesRefs.
  const snapEds = await get(ref(db, "ediciones"));
  const eds = snapEds.val() || {};

  const encontrado = Object.entries(eds).find(([_, item]) => {
    return String(item?.refPublica || "") === refPublica;
  });

  return {
    id: encontrado?.[0] || "",
    refPublica
  };
}

/* ================= LINK PÚBLICO ================= */
async function abrirEdicionDesdeURL() {
  if (!edEsLinkDirectoPublico()) return;

  document.body.classList.add("ed-link-directo");

  const data = await edIdDesdeLinkPublico();
  const id = data.id;
  const refPublica = data.refPublica;

  if (!id) {
    document.body.classList.remove("ed-link-directo");
    return;
  }

  // ✅ Al cerrar, vuelve a Compartidos.
  window.__ED_ABIERTA_DESDE_LINK_COMPARTIDOS = true;

  // ✅ Si vino desde /ediciones/?ref=..., dejamos URL canónica.
  if (refPublica) {
    try {
      history.replaceState(
        null,
        "",
        `${edBasePublicaApp()}/?ver=compartidos&edicionRef=${encodeURIComponent(refPublica)}`
      );
    } catch (_) {}
  }

  await edEsperarDB();

  // ✅ Abrimos la edición directamente, sin renderizar feed antes.
  await abrirPresentacionEdicion(id);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(abrirEdicionDesdeURL, 60);
  }, { once: true });
} else {
  setTimeout(abrirEdicionDesdeURL, 60);
}
