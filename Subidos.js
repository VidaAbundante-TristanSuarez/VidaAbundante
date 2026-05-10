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
const SUBIDOS_VIDEO_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/crearUploadVideoR2";
const SUBIDOS_PROXY_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/descargarImagenR2";
const SUBIDOS_EXPORT_BG_URL = "./img/subidos/fondo-predica-cielo.jpg";

let subidosUID = null;
let subidosEsAdmin = false;
let subidosMesActual = new Date();
let subidosItems = [];
let subidosEtiquetas = [];
let subidosEditandoId = null;

/* ================= ARCHIVOS REALES PARA COMPARTIR/DESCARGAR ================= */

const subidosFileCache = new Map();
const subidosFilePreparando = new Set();

function subidosNombreLimpio(nombre = "archivo") {
  return String(nombre || "archivo")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "archivo";
}

function subidosNombreSharePredica(it) {
  const fecha = it?.fechaEvento || "sin-fecha";
  const id = it?.id || "predica";
  const version = Date.now();

  return subidosNombreLimpio(`predica-${fecha}-${id}-${version}.png`);
}

function subidosInfoArchivoAccion(it) {
  if (!it) return null;

  // ✅ Prédica: usa la imagen PNG ya preparada y subida a R2
  if (subidosEsPredicaConContenido(it)) {
    if (!it.shareUrl) return null;

    return {
      url: it.shareUrl,
      fileName: it.shareFileName || subidosNombreSharePredica(it),
      mimeType: it.shareMimeType || "image/png"
    };
  }

  // ✅ Otras etiquetas: usa el archivo original real
  if (it.url) {
    return {
      url: it.shareUrl || it.url,
      fileName: it.shareFileName || it.fileName || `archivo_${Date.now()}`,
      mimeType: it.shareMimeType || it.mimeType || "application/octet-stream"
    };
  }

  return null;
}

async function subidosCrearFileDesdeInfo(info) {
  if (!info?.url) throw new Error("Falta URL del archivo.");

  const nombre = subidosNombreLimpio(info.fileName || `archivo_${Date.now()}`);

  // ✅ Usa tu proxy para traer bytes reales, no abrir link
  const proxy = subidosProxyArchivoUrl(info.url, nombre, false);

  const r = await fetch(proxy);
  if (!r.ok) throw new Error("No pude preparar el archivo real.");

  const blob = await r.blob();
  const tipo = info.mimeType || blob.type || "application/octet-stream";

  return new File([blob], nombre, { type: tipo });
}

function subidosMarcarArchivoAccionListo(id, listo) {
  const btnD = document.querySelector(`[data-subidos-download="${id}"]`);
  const btnS = document.querySelector(`[data-subidos-share="${id}"]`);

  [btnD, btnS].forEach(btn => {
    if (!btn) return;

    btn.disabled = !listo;
    btn.style.opacity = listo ? "1" : ".45";
    btn.style.cursor = listo ? "pointer" : "wait";
    btn.title = listo
      ? (btn.dataset.subidosShare ? "Compartir" : "Descargar")
      : "Preparando archivo...";
  });
}

async function subidosPrepararArchivoAccion(id) {
  const it = obtenerSubidoPorId(id);
  if (!it) return null;

  // ✅ Videos grandes: NO los bajamos en memoria.
  // Compartir/descargar usa link directo para cuidar Functions y límites.
  if (subidosEsVideoItem(it)) {
    subidosMarcarArchivoAccionListo(id, true);
    return null;
  }  

  const info = subidosInfoArchivoAccion(it);
  if (!info?.url) {
    subidosMarcarArchivoAccionListo(id, false);
    return null;
  }

  const cacheActual = subidosFileCache.get(id);
  if (cacheActual?.url === info.url && cacheActual?.file) {
    subidosMarcarArchivoAccionListo(id, true);
    return cacheActual.file;
  }

  if (subidosFilePreparando.has(id)) return null;

  subidosFilePreparando.add(id);
  subidosMarcarArchivoAccionListo(id, false);

  try {
    const file = await subidosCrearFileDesdeInfo(info);

    subidosFileCache.set(id, {
      url: info.url,
      file
    });

    subidosMarcarArchivoAccionListo(id, true);
    return file;
  } catch (e) {
    console.warn("No pude preparar archivo para acción:", id, e);
    subidosMarcarArchivoAccionListo(id, false);
    return null;
  } finally {
    subidosFilePreparando.delete(id);
  }
}

function subidosPrepararArchivosDelFeed() {
  setTimeout(() => {
    const cards = [...document.querySelectorAll(".subidos-feed-card[id^='subido-']")];

    cards.forEach((card, i) => {
      const id = card.id.replace("subido-", "");

      // ✅ escalonado para no trabar todo de golpe
      setTimeout(() => {
        subidosPrepararArchivoAccion(id);
      }, i * 300);
    });
  }, 500);
}

function subidosDescargarFileReal(file) {
  const url = URL.createObjectURL(file);

  const a = document.createElement("a");
  a.href = url;
  a.download = file.name || `archivo_${Date.now()}`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const ETIQUETAS_DEFAULT = [
  "Predica",
  "Anuncio",
  "Plan",
  "Racimo",
  "Oración",  
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

function renumerarCitasPredica() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  [...wrap.children].forEach((card, i) => {
    const ttl = card.querySelector(".subidosCitaTitulo");
    if (ttl) ttl.textContent = `Cita ${i + 1}`;
  });

  actualizarBotonesAgregarOtraCita();
}

window.subidosAgregarCitaPredica = async function subidosAgregarCitaPredica() {
  const tpl = document.getElementById("tplSubidosCitaPredica");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!tpl || !wrap) return null;

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
    btnLimpiar.onclick = () => {
      limpiarCitaPredica(node);
    };
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
  await inicializarCardCitaPredica(node);
  return node;
};

function resetPredicaSubidosUI() {
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
  const version = document.getElementById("subidosPredicaVersion");
  const intro = document.getElementById("subidosPredicaIntro");

  if (box) box.style.display = "none";
  if (wrap) wrap.innerHTML = "";
  if (notaFinal) notaFinal.value = "";
  if (version) version.value = "RV1960";
  if (intro) intro.value = "";
}

function actualizarPredicaSubidosUI() {
  const sel = document.getElementById("subidosEtiqueta");
  const box = document.getElementById("subidosPredicaBox");
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const intro = document.getElementById("subidosPredicaIntro");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");

  if (!sel || !box || !wrap) return;

  const mostrar = esPredicaSubidos(sel.value);

  box.style.display = mostrar ? "block" : "none";

  if (!mostrar) {
    wrap.innerHTML = "";
    if (intro) intro.value = "";
    if (notaFinal) notaFinal.value = "";
    return;
  }

  if (!wrap.children.length) {
    window.subidosAgregarCitaPredica();
  }
}

/* ================= PREDICA + BIBLIA REAL ================= */

const SUBIDOS_BIBLIA_CACHE = {
  RV1960: null,
  NTV: null
};

const SUBIDOS_BIBLIA_CANDIDATAS = {
  RV1960: [
    "./VidaAbundante - RV1960.json",
    "VidaAbundante - RV1960.json",
    "./json/VidaAbundante - RV1960.json",
    "json/VidaAbundante - RV1960.json"
  ],
  NTV: [
    "./biblia_ntv.json",
    "biblia_ntv.json",
    "./json/biblia_ntv.json",
    "json/biblia_ntv.json"
  ]
};

function subidosNormalizarBiblia(txt = "") {
  return String(txt)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function subidosEsObjeto(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function subidosVersionPredicaActual() {
  return document.getElementById("subidosPredicaVersion")?.value || "RV1960";
}

function subidosPrimerValido(lista = []) {
  for (const x of lista) {
    if (x) return x;
  }
  return null;
}

function subidosTextoVersiculo(v) {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (!v) return "";

  const version = subidosVersionPredicaActual();

  return String(
    v[version] ??
    v.RV1960 ??
    v.NTV ??
    v.texto ??
    v.text ??
    v.contenido ??
    v.content ??
    v.versiculo ??
    v.verse ??
    ""
  ).trim();
}

function subidosCampoLibro(v) {
  return String(
    v?.Libro ??
    v?.book_name ??
    v?.bookName ??
    v?.book ??
    v?.libro ??
    v?.nombre ??
    v?.name ??
    ""
  ).trim();
}

function subidosCampoCapitulo(v) {
  return Number(
    v?.Capitulo ??
    v?.chapter ??
    v?.capitulo ??
    v?.chapterNumber ??
    v?.cap ??
    0
  );
}

function subidosCampoVersiculo(v) {
  return Number(
    v?.Versiculo ??
    v?.Versículo ??
    v?.verse ??
    v?.versiculo ??
    v?.verseNumber ??
    v?.num ??
    0
  );
}

function subidosBibliaEsPlana(raw) {
  const coleccion = subidosColeccionLibros(raw);
  if (!Array.isArray(coleccion) || !coleccion.length) return false;

  const muestra = coleccion[0];
  return !!(
    subidosCampoLibro(muestra) ||
    subidosCampoCapitulo(muestra) ||
    subidosCampoVersiculo(muestra)
  );
}

function subidosLibrosDesdeSelectorPrincipal() {
  const sel = document.getElementById("libro");
  if (!sel) return [];

  const libros = [...sel.options]
    .map(o => String(o.value || "").trim())
    .filter(v =>
      v &&
      v !== "Seleccionar…" &&
      v !== "Seleccionar..." &&
      !/^\d+$/.test(v)
    );

  const vistos = new Set();

  return libros
    .filter(nombre => {
      const k = subidosNormalizarBiblia(nombre);
      if (!k || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map(nombre => ({ nombre, raw: null }));
}

function subidosTextoHtml(txt = "") {
  const limpio = String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map(linea =>
      String(linea || "")
        .replace(/^[\s\u00A0]+/g, "")
        .replace(/[\s\u00A0]+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return escaparHtml(limpio).replace(/\n/g, "<br>");
}

function subidosNumsSeleccionados(card) {
  const nums = Array.isArray(card.__seleccionNums) ? [...card.__seleccionNums] : [];
  return nums
    .map(n => Number(n))
    .filter(n => n > 0)
    .sort((a, b) => a - b);
}

function subidosSetSeleccionados(card, nums) {
  card.__seleccionNums = [...new Set(
    (nums || [])
      .map(n => Number(n))
      .filter(n => n > 0)
  )].sort((a, b) => a - b);
}

function subidosCompactarNumeros(nums = []) {
  const ordenados = [...new Set(nums.map(Number).filter(n => n > 0))].sort((a, b) => a - b);
  if (!ordenados.length) return [];

  const tramos = [];
  let desde = ordenados[0];
  let hasta = ordenados[0];

  for (let i = 1; i < ordenados.length; i++) {
    const n = ordenados[i];
    if (n === hasta + 1) {
      hasta = n;
      continue;
    }
    tramos.push({ desde, hasta });
    desde = n;
    hasta = n;
  }

  tramos.push({ desde, hasta });
  return tramos;
}

function subidosTextoTramosReferencia(tramos = []) {
  return tramos.map(t => t.desde === t.hasta ? `${t.desde}` : `${t.desde}-${t.hasta}`).join(" y ");
}

function subidosTextoCompletoDeSeleccion(versos = [], nums = []) {
  const set = new Set(nums);
  return versos
    .filter(v => set.has(v.n))
    .map(v => `${v.n}. ${v.texto}`)
    .join("\n");
}

function subidosTextoResumenSeleccion(versos = [], nums = []) {
  const set = new Set(nums);
  return versos
    .filter(v => set.has(v.n))
    .map(v => `${v.n}. ${v.texto}`)
    .join(" ");
}

function actualizarBotonesAgregarOtraCita() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  const cards = [...wrap.querySelectorAll(".subidos-cita-card")];
  cards.forEach((card, i) => {
    let box = card.querySelector(".subidosAgregarOtraCitaBox");
    if (!box) {
      box = document.createElement("div");
      box.className = "subidosAgregarOtraCitaBox";
      box.style.marginTop = "10px";
      box.style.display = "none";
      box.innerHTML = `
        <button type="button" class="btn-primary subidosAgregarOtraCitaBtn">
          <i class="fa-solid fa-circle-plus"></i> Agregar otra cita
        </button>
      `;
      card.appendChild(box);

      const btn = box.querySelector(".subidosAgregarOtraCitaBtn");
      if (btn) {
        btn.onclick = () => {
          window.subidosAgregarCitaPredica();
        };
      }
    }

    box.style.display = (i === cards.length - 1) ? "flex" : "none";
  });
}

async function obtenerBibliaPredica(version = subidosVersionPredicaActual()) {
  if (SUBIDOS_BIBLIA_CACHE[version]) return SUBIDOS_BIBLIA_CACHE[version];

  const globalDirecto = version === "RV1960"
    ? subidosPrimerValido([
        window.BIBLIA_RV1960,
        window.bibliaRV1960,
        window.__BIBLIA_RV1960__,
        window.BIBLIA?.RV1960,
        window.bibliaData?.RV1960
      ])
    : subidosPrimerValido([
        window.BIBLIA_NTV,
        window.bibliaNTV,
        window.__BIBLIA_NTV__,
        window.BIBLIA?.NTV,
        window.bibliaData?.NTV
      ]);

  if (globalDirecto) {
    SUBIDOS_BIBLIA_CACHE[version] = globalDirecto;
    return globalDirecto;
  }

  for (const ruta of SUBIDOS_BIBLIA_CANDIDATAS[version] || []) {
    try {
      const r = await fetch(ruta);
      if (!r.ok) continue;
      const data = await r.json();
      SUBIDOS_BIBLIA_CACHE[version] = data;
      return data;
    } catch (e) {
      console.warn("No pude cargar", ruta, e);
    }
  }

  throw new Error(`No pude cargar la Biblia ${version}. Revisá las rutas en SUBIDOS_BIBLIA_CANDIDATAS.`);
}

function subidosColeccionLibros(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.libros)) return raw.libros;
  if (Array.isArray(raw?.books)) return raw.books;
  if (Array.isArray(raw?.biblia)) return raw.biblia;
  if (Array.isArray(raw?.data)) return raw.data;
  if (subidosEsObjeto(raw)) return raw;
  return null;
}

function subidosListaLibros(raw) {
  const desdeUI = subidosLibrosDesdeSelectorPrincipal();
  if (desdeUI.length) return desdeUI;

  const coleccion = subidosColeccionLibros(raw);
  if (!coleccion) return [];

  if (Array.isArray(coleccion) && subidosBibliaEsPlana(raw)) {
    const vistos = new Set();

    return coleccion
      .map(row => subidosCampoLibro(row))
      .filter(Boolean)
      .filter(nombre => {
        const k = subidosNormalizarBiblia(nombre);
        if (!k || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .map(nombre => ({
        nombre,
        raw: nombre
      }));
  }

  if (Array.isArray(coleccion)) {
    return coleccion
      .map((libro) => ({
        nombre: String(
          libro?.nombre ??
          libro?.name ??
          libro?.book ??
          libro?.libro ??
          libro?.title ??
          ""
        ).trim(),
        raw: libro
      }))
      .filter(x => x.nombre);
  }

  if (subidosEsObjeto(coleccion)) {
    const omitidos = new Set([
      "version", "nombre", "name", "abreviatura", "abreviaturas",
      "metadata", "meta", "titulo", "title"
    ]);

    return Object.keys(coleccion)
      .filter(k => !omitidos.has(subidosNormalizarBiblia(k)))
      .map(k => ({
        nombre: k,
        raw: coleccion[k]
      }));
  }

  return [];
}

function subidosCapitulosLibro(rawLibro) {
  const base =
    rawLibro?.capitulos ??
    rawLibro?.chapters ??
    rawLibro?.chapter ??
    rawLibro?.capitulo ??
    rawLibro;

  if (Array.isArray(base)) return base;

  if (subidosEsObjeto(base)) {
    const keys = Object.keys(base)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));

    if (keys.length) return keys.map(k => base[k]);
  }

  return [];
}

function subidosVersiculosCapitulo(rawCapitulo) {
  const base =
    rawCapitulo?.versiculos ??
    rawCapitulo?.verses ??
    rawCapitulo?.verse ??
    rawCapitulo?.versiculo ??
    rawCapitulo;

  if (Array.isArray(base)) {
    return base
      .map((v, i) => ({
        n: i + 1,
        texto: subidosTextoVersiculo(v)
      }))
      .filter(v => v.texto);
  }

  if (subidosEsObjeto(base)) {
    const keys = Object.keys(base)
      .filter(k => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b));

    return keys
      .map(k => ({
        n: Number(k),
        texto: subidosTextoVersiculo(base[k])
      }))
      .filter(v => v.texto);
  }

  return [];
}

async function subidosBuscarLibroPorNombre(nombre, version = subidosVersionPredicaActual()) {
  const data = await obtenerBibliaPredica(version);
  const libros = subidosListaLibros(data);
  const buscado = subidosNormalizarBiblia(nombre);

  return libros.find(x => subidosNormalizarBiblia(x.nombre) === buscado) || null;
}

async function poblarLibrosPredicaEnCard(card, seleccionado = "") {
  const sel = card.querySelector(".subidosCitaLibro");
  if (!sel) return;

  const data = await obtenerBibliaPredica();
  const libros = subidosListaLibros(data);

  sel.innerHTML =
    `<option value="">Seleccionar libro…</option>` +
    libros.map(libro => `
      <option value="${escaparHtml(libro.nombre)}">${escaparHtml(libro.nombre)}</option>
    `).join("");

  if (seleccionado) sel.value = seleccionado;
}

async function poblarCapitulosPredicaEnCard(card, libroNombre, seleccionado = "") {
  const sel = card.querySelector(".subidosCitaCapitulo");
  if (!sel) return;

  if (!libroNombre) {
    sel.innerHTML = `<option value="">Seleccionar capítulo…</option>`;
    sel.disabled = true;
    return;
  }

  const data = await obtenerBibliaPredica();

  if (subidosBibliaEsPlana(data)) {
    const coleccion = subidosColeccionLibros(data) || [];
    const caps = [...new Set(
      coleccion
        .filter(row =>
          subidosNormalizarBiblia(subidosCampoLibro(row)) === subidosNormalizarBiblia(libroNombre)
        )
        .map(row => subidosCampoCapitulo(row))
        .filter(n => n > 0)
    )].sort((a, b) => a - b);

    sel.innerHTML =
      `<option value="">Seleccionar capítulo…</option>` +
      caps.map(n => `<option value="${n}">${n}</option>`).join("");

    sel.disabled = false;
    if (seleccionado) sel.value = String(seleccionado);
    return;
  }

  const libro = await subidosBuscarLibroPorNombre(libroNombre);
  const capitulos = subidosCapitulosLibro(libro?.raw);

  sel.innerHTML =
    `<option value="">Seleccionar capítulo…</option>` +
    capitulos.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");

  sel.disabled = false;

  if (seleccionado) sel.value = String(seleccionado);
}

function renderVersiculosPredicaEnCard(card) {
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  if (!wrap || !empty) return;

  const versos = Array.isArray(card.__versiculosData) ? card.__versiculosData : [];
  const seleccionados = new Set(subidosNumsSeleccionados(card));

  if (!versos.length) {
    wrap.innerHTML = "";
    empty.style.display = "";
    return;
  }

  empty.style.display = "none";

  wrap.innerHTML = versos.map(v => {
    const activo = seleccionados.has(v.n);

    return `
      <button
        type="button"
        data-num="${v.n}"
        style="
          width:100%;
          text-align:left;
          border-radius:12px;
          padding:8px 10px;
          border:1px solid ${activo ? "#97d8f7" : "#e5e7eb"};
          background:${activo ? "#eafaff" : "#ffffff"};
          cursor:pointer;
          line-height:1.35;
        "
      >
        <span style="font-weight:800;">${v.n}</span>
        <span>${escaparHtml(v.texto)}</span>
      </button>
    `;
  }).join("");

  wrap.querySelectorAll("[data-num]").forEach(btn => {
    btn.onclick = () => {
      seleccionarVersiculoPredicaEnCard(card, Number(btn.dataset.num));
    };
  });
}

async function poblarVersiculosPredicaEnCard(card, libroNombre, capituloNumero) {
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  if (!wrap || !empty) return;

  card.__versiculosData = [];
  wrap.innerHTML = "";
  empty.style.display = "";

  if (!libroNombre || !capituloNumero) return;

  const data = await obtenerBibliaPredica();

  if (subidosBibliaEsPlana(data)) {
    const coleccion = subidosColeccionLibros(data) || [];

    card.__versiculosData = coleccion
      .filter(row =>
        subidosNormalizarBiblia(subidosCampoLibro(row)) === subidosNormalizarBiblia(libroNombre) &&
        subidosCampoCapitulo(row) === Number(capituloNumero)
      )
      .map(row => ({
        n: subidosCampoVersiculo(row),
        texto: subidosTextoVersiculo(row)
      }))
      .filter(v => v.n > 0 && v.texto)
      .sort((a, b) => a.n - b.n);

    renderVersiculosPredicaEnCard(card);
    return;
  }

  const libro = await subidosBuscarLibroPorNombre(libroNombre);
  const capitulos = subidosCapitulosLibro(libro?.raw);
  const rawCapitulo = capitulos[Number(capituloNumero) - 1];

  card.__versiculosData = subidosVersiculosCapitulo(rawCapitulo);
  renderVersiculosPredicaEnCard(card);
}

function actualizarPreviewPredicaEnCard(card) {
  const info = card.querySelector(".subidosCitaSeleccionInfo");
  const ref = card.querySelector(".subidosCitaReferencia");
  const txt = card.querySelector(".subidosCitaTexto");
  const btnExpandir = card.querySelector(".subidosCitaExpandir");

  const libro = card.querySelector(".subidosCitaLibro")?.value || "";
  const capitulo = Number(card.querySelector(".subidosCitaCapitulo")?.value || 0);
  const versos = Array.isArray(card.__versiculosData) ? card.__versiculosData : [];
  const nums = subidosNumsSeleccionados(card);

  if (!libro || !capitulo || !nums.length || !versos.length) {
    delete card.dataset.referencia;
    delete card.dataset.texto;
    delete card.dataset.segmentos;
    limpiarPreviewCitaPredica(card);
    return;
  }

  const tramos = subidosCompactarNumeros(nums);
  const referencia = `${libro} ${capitulo}:${subidosTextoTramosReferencia(tramos)}`;
  const texto = subidosTextoCompletoDeSeleccion(versos, nums);

  card.dataset.libro = libro;
  card.dataset.capitulo = String(capitulo);
  card.dataset.referencia = referencia;
  card.dataset.texto = texto;
  card.dataset.segmentos = JSON.stringify(tramos);

  if (info) info.style.display = "block";
  if (ref) ref.textContent = referencia;
  if (txt) {
    txt.textContent = texto;
    txt.style.maxHeight = "240px";
    txt.style.overflow = "auto";
  }

  if (btnExpandir) {
    btnExpandir.dataset.expandido = "0";
    btnExpandir.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
    btnExpandir.style.display = texto.length > 420 ? "block" : "none";
  }
}

function seleccionarVersiculoPredicaEnCard(card, num) {
  const nums = subidosNumsSeleccionados(card);

  if (nums.includes(num)) {
    subidosSetSeleccionados(card, nums.filter(n => n !== num));
  } else {
    subidosSetSeleccionados(card, [...nums, num]);
  }

  renderVersiculosPredicaEnCard(card);
  actualizarPreviewPredicaEnCard(card);
}

async function limpiarCitaPredica(card) {
  if (!card) return;

  const libro = card.querySelector(".subidosCitaLibro");
  const cap = card.querySelector(".subidosCitaCapitulo");
  const wrap = card.querySelector(".subidosCitaVersiculos");
  const empty = card.querySelector(".subidosCitaVersiculosEmpty");
  const nota = card.querySelector(".subidosCitaNota");

  if (libro) libro.value = "";
  if (cap) {
    cap.innerHTML = `<option value="">Seleccionar capítulo…</option>`;
    cap.disabled = true;
  }
  if (wrap) wrap.innerHTML = "";
  if (empty) empty.style.display = "";
  if (nota) nota.value = "";

  card.__versiculosData = [];
  card.__seleccionNums = [];
  delete card.dataset.libro;
  delete card.dataset.capitulo;
  delete card.dataset.referencia;
  delete card.dataset.texto;
  delete card.dataset.segmentos;

  limpiarPreviewCitaPredica(card);
  await poblarLibrosPredicaEnCard(card);
}

async function inicializarCardCitaPredica(card) {
  const selLibro = card.querySelector(".subidosCitaLibro");
  const selCap = card.querySelector(".subidosCitaCapitulo");

  await poblarLibrosPredicaEnCard(card);

  if (selLibro && !selLibro.__hookPredicaLibro) {
    selLibro.__hookPredicaLibro = true;
    selLibro.addEventListener("change", async () => {
      delete card.dataset.desde;
      delete card.dataset.hasta;
      delete card.dataset.referencia;
      delete card.dataset.texto;
      limpiarPreviewCitaPredica(card);
      await poblarCapitulosPredicaEnCard(card, selLibro.value);
      await poblarVersiculosPredicaEnCard(card, "", "");
    });
  }

  if (selCap && !selCap.__hookPredicaCap) {
    selCap.__hookPredicaCap = true;
    selCap.addEventListener("change", async () => {
      delete card.dataset.desde;
      delete card.dataset.hasta;
      delete card.dataset.referencia;
      delete card.dataset.texto;
      limpiarPreviewCitaPredica(card);
      await poblarVersiculosPredicaEnCard(
        card,
        selLibro?.value || "",
        selCap.value || ""
      );
    });
  }
}

async function recargarVersionPredicaCards() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  if (!wrap) return;

  const cards = [...wrap.querySelectorAll(".subidos-cita-card")];

  for (const card of cards) {
    const libroPrev = card.querySelector(".subidosCitaLibro")?.value || "";
    const capPrev = card.querySelector(".subidosCitaCapitulo")?.value || "";
    const desdePrev = card.dataset.desde || "";
    const hastaPrev = card.dataset.hasta || "";

    await poblarLibrosPredicaEnCard(card, libroPrev);
    await poblarCapitulosPredicaEnCard(card, libroPrev, capPrev);
    await poblarVersiculosPredicaEnCard(card, libroPrev, capPrev);

    if (desdePrev) {
      card.dataset.desde = desdePrev;
      if (hastaPrev) card.dataset.hasta = hastaPrev;
      renderVersiculosPredicaEnCard(card);
      actualizarPreviewPredicaEnCard(card);
    }
  }
}

function recogerDatosPredicaSubidos() {
  const wrap = document.getElementById("subidosPredicaCitasWrap");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal")?.value?.trim() || "";
  const introduccion = document.getElementById("subidosPredicaIntro")?.value?.trim() || "";
  const version = subidosVersionPredicaActual();

  const citas = [];

  [...(wrap?.querySelectorAll(".subidos-cita-card") || [])].forEach(card => {
    const libro = card.dataset.libro || "";
    const capitulo = Number(card.dataset.capitulo || 0);
    const referencia = card.dataset.referencia || "";
    const texto = card.dataset.texto || "";
    const comentario = card.querySelector(".subidosCitaNota")?.value?.trim() || "";
    const segmentos = JSON.parse(card.dataset.segmentos || "[]");

    const vacia = !libro && !capitulo && !referencia && !comentario;
    if (vacia) return;

    if (!libro || !capitulo || !referencia || !texto || !segmentos.length) {
      throw new Error("Hay una cita de prédica incompleta. Elegí libro, capítulo y versículo/s.");
    }

    citas.push({
      libro,
      capitulo,
      referencia,
      texto,
      comentario,
      segmentos,
      version
    });
  });

  return {
    version,
    introduccion,
    citas,
    notaFinalGeneral: notaFinal
  };
}

function obtenerCitasPredicaSubido(it) {
  if (Array.isArray(it.predicaCitas)) return it.predicaCitas;
  if (Array.isArray(it.citasPredica)) return it.citasPredica;
  return [];
}

window.subidosToggleMiniPredica = function subidosToggleMiniPredica(bodyId, btn) {
  const body = document.getElementById(bodyId);
  if (!body) return;

  const abierto = body.dataset.abierto === "1";

  if (abierto) {
    body.dataset.abierto = "0";
    body.style.display = "none";
    if (btn) btn.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  } else {
    body.dataset.abierto = "1";
    body.style.display = "block";
    if (btn) btn.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
  }
};

function htmlPredicaBibliaSubido(it) {
  const citas = obtenerCitasPredicaSubido(it);

  // ✅ En la galería mostramos solo la primera cita.
  if (!citas.length) return "";

  const primera = citas[0] || {};
  const referencia = String(primera.referencia || "").trim();
  const texto = String(primera.texto || "").trim();

  return `
    <div
      class="subidos-predica-resumen subidos-predica-resumen-unica"
      onclick="abrirSubidosVisorPredica('${it.id}', 'all')"
      title="Abrir prédica completa"
      role="button"
      tabindex="0"
    >
      <div class="subidos-predica-primera">
        ${referencia ? `
          <div class="subidos-predica-primera-ref">
            ${escaparHtml(referencia)}
          </div>
        ` : ``}

        ${texto ? `
          <div class="subidos-predica-primera-texto">
            ${subidosTextoHtml(texto)}
          </div>
        ` : `
          <div class="subidos-predica-primera-texto subidos-predica-primera-vacia">
            Sin texto cargado.
          </div>
        `}
      </div>
    </div>
  `;
}

window.subidosToggleBibliaPredica = function subidosToggleBibliaPredica(id) {
  const box = document.getElementById(`subidosPredicaTexto-${id}`);
  const btn = document.getElementById(`subidosPredicaBtn-${id}`);
  if (!box || !btn) return;

  const expandido = box.dataset.expandido === "1";

  if (expandido) {
    box.dataset.expandido = "0";
    box.style.maxHeight = "118px";
    box.style.overflow = "auto";
    btn.innerHTML = `<i class="fa-solid fa-caret-down"></i>`;
  } else {
    box.dataset.expandido = "1";
    box.style.maxHeight = "250px";
    box.style.overflow = "auto";
    btn.innerHTML = `<i class="fa-solid fa-caret-up"></i>`;
  }
};

window.subidosToggleDetallePredica = function subidosToggleDetallePredica(id) {
  const body = document.getElementById(id);
  const ico = document.querySelector(`[data-toggle-icon="${id}"]`);
  if (!body) return;

  const abierto = body.style.display !== "none";

  if (abierto) {
    body.style.display = "none";
    if (ico) ico.className = "fa-solid fa-caret-down";
  } else {
    body.style.display = "block";
    if (ico) ico.className = "fa-solid fa-caret-up";
  }
};

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

/* ================= VIDEOS GRANDES: SUBIDA DIRECTA A R2 ================= */

function subidosEsVideoFile(file) {
  return !!file && String(file.type || "").startsWith("video/");
}

function subidosEsVideoItem(it) {
  return String(it?.mimeType || "").startsWith("video/");
}

function subidosContentTypeVideo(file) {
  const tipo = String(file?.type || "").trim();
  if (tipo) return tipo;

  const nombre = String(file?.name || "").toLowerCase();

  if (nombre.endsWith(".mov")) return "video/quicktime";
  if (nombre.endsWith(".webm")) return "video/webm";

  return "video/mp4";
}

function subidosFormatoMB(bytes = 0) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1);
}

async function subirVideoR2DirectoSubidos(file, estadoEl = null) {
  if (!file) throw new Error("Falta video.");

  const contentType = subidosContentTypeVideo(file);

  const permitidos = ["video/mp4", "video/webm", "video/quicktime"];
  if (!permitidos.includes(contentType)) {
    throw new Error("Tipo de video no permitido. Usá MP4, WEBM o MOV.");
  }

  const maxBytes = 80 * 1024 * 1024; // mismo límite que la Cloud Function
  if (file.size > maxBytes) {
    throw new Error(`Video demasiado grande: ${subidosFormatoMB(file.size)} MB. Máximo inicial: 80 MB.`);
  }

  const user =
    window.__AUTH?.currentUser ||
    window.__FB?.auth?.currentUser ||
    null;

  if (!user) {
    throw new Error("No pude obtener el usuario actual para autorizar la subida.");
  }

  if (estadoEl) {
    estadoEl.textContent = `Preparando permiso para video (${subidosFormatoMB(file.size)} MB)...`;
  }

  const token = await user.getIdToken();

  const r = await fetch(SUBIDOS_VIDEO_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      destino: "subidos",
      fileName: file.name || `video_${Date.now()}.mp4`,
      contentType,
      sizeBytes: file.size
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.ok || !data?.uploadUrl) {
    throw new Error(data?.error || "No se pudo crear la URL de subida para el video.");
  }

  if (estadoEl) {
    estadoEl.textContent = "Subiendo video directo a R2...";
  }

  const put = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType
    },
    body: file
  });

  if (!put.ok) {
    const txt = await put.text().catch(() => "");
    throw new Error(`R2 rechazó la subida del video (${put.status}). ${txt}`);
  }

  return {
    ok: true,
    url: data.publicUrl,
    key: data.key || "",
    fileName: data.fileName || file.name || `video_${Date.now()}.mp4`,
    contentType,
    sizeBytes: file.size,
    subidaDirectaVideo: true
  };
}

function subidosDescargarVideoDirecto(it) {
  if (!it?.url) {
    alert("Este video no tiene URL.");
    return;
  }

  const a = document.createElement("a");
  a.href = it.url;
  a.download = subidosNombreLimpio(it.fileName || `video_${Date.now()}.mp4`);
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function subidosCompartirLinkVideo(it) {
  if (!it?.url) {
    alert("Este video no tiene URL para compartir.");
    return;
  }

  const titulo = it.etiqueta || "Video";
  const texto = [it.etiqueta || "Video", it.descripcion || ""]
    .filter(Boolean)
    .join(" — ");

  if (navigator.share) {
    await navigator.share({
      title: titulo,
      text: texto,
      url: it.url
    });
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(it.url);
    alert("Link del video copiado.");
    return;
  }

  prompt("Copiá este link:", it.url);
}

function nombreMes(d) {
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function setSubidosModalTitulo(texto) {
  const ttlTexto = document.getElementById("subidosModalTituloTexto");
  if (ttlTexto) {
    ttlTexto.textContent = String(texto || "").trim() || "Nuevo subido";
    return;
  }

  // fallback por si alguna vez no existiera el span interno
  const ttl = document.getElementById("subidosModalTitulo");
  if (ttl) ttl.textContent = String(texto || "").trim() || "Nuevo subido";
}

function abrirModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;

  const fecha = document.getElementById("subidosFecha");
  const archivo = document.getElementById("subidosArchivo");
  const descripcion = document.getElementById("subidosDescripcion");
  const estado = document.getElementById("subidosEstado");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const ttl = document.getElementById("subidosModalTitulo");
  const archivoBox = document.getElementById("subidosArchivoActualBox");
  const archivoNombre = document.getElementById("subidosArchivoActualNombre");
  const btnVerArchivo = document.getElementById("btnVerArchivoActualSubido");

  subidosEditandoId = null;

  setSubidosModalTitulo("Nuevo subido");
  if (archivo) archivo.value = "";
  if (descripcion) descripcion.value = "";
  if (estado) estado.textContent = "";
  if (fecha) fecha.value = fechaYMD(new Date());
  if (etiqueta) etiqueta.value = "";
  if (archivoBox) archivoBox.style.display = "none";
  if (archivoNombre) archivoNombre.textContent = "";
  if (btnVerArchivo) btnVerArchivo.onclick = null;

  resetPredicaSubidosUI();
  actualizarPredicaSubidosUI();

  m.style.display = "flex";
  m.setAttribute("aria-hidden", "false");
}

window.cerrarModalSubidos = function cerrarModalSubidos() {
  const m = document.getElementById("modalSubidos");
  if (!m) return;

  const ttl = document.getElementById("subidosModalTitulo");
  setSubidosModalTitulo("Nuevo subido");

  subidosEditandoId = null;
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

const SUBIDOS_EVENTOS_HABITUALES = [
  {
    slug: "racimos",
    etiqueta: "Racimo",
    descripcion: "Racimos - 18 hs",
    diaSemana: 2
  },
  {
    slug: "oracion",
    etiqueta: "Oración",
    descripcion: "Oración - 17 a 19 hs",
    diaSemana: 4
  },
  {
    slug: "reunion-general",
    etiqueta: "Predica",
    descripcion: "Reunión general",
    diaSemana: 0
  }
];

function subidosIdHabitual(fechaEvento, slug) {
  return `habitual::${fechaEvento}::${slug}`;
}

function subidosBuscarRealHabitual(fechaEvento, etiqueta) {
  const key = normalizarEtiquetaSubidos(etiqueta);

  return subidosItems.find(it =>
    it.fechaEvento === fechaEvento &&
    normalizarEtiquetaSubidos(it.etiqueta || "") === key
  ) || null;
}

function subidosEventosHabitualesDelMes(year, month) {
  const items = [];
  const ultimoDia = new Date(year, month + 1, 0).getDate();

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(year, month, dia);
    const fechaEvento = fechaYMD(d);

    SUBIDOS_EVENTOS_HABITUALES.forEach(ev => {
      if (d.getDay() !== ev.diaSemana) return;

      const real = subidosBuscarRealHabitual(fechaEvento, ev.etiqueta);
      if (real) return;

      items.push({
        id: subidosIdHabitual(fechaEvento, ev.slug),
        fecha: 0,
        fechaEvento,
        etiqueta: ev.etiqueta,
        descripcion: ev.descripcion,
        esHabitualVirtual: true
      });
    });
  }

  return items;
}

function subidosHabitualDesdeId(id) {
  const partes = String(id || "").split("::");
  if (partes.length !== 3) return null;

  const fechaEvento = partes[1];
  const slug = partes[2];
  const ev = SUBIDOS_EVENTOS_HABITUALES.find(x => x.slug === slug);

  if (!ev) return null;

  return {
    fechaEvento,
    etiqueta: ev.etiqueta,
    descripcion: ev.descripcion
  };
}

function abrirNuevoHabitualDesdeCalendario(id) {
  if (!subidosEsAdmin) {
    alert("Solo admin puede crear o editar este evento.");
    return;
  }

  const ev = subidosHabitualDesdeId(id);
  if (!ev) return;

  abrirModalSubidos();

  const ttl = document.getElementById("subidosModalTitulo");
  const fecha = document.getElementById("subidosFecha");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const descripcion = document.getElementById("subidosDescripcion");
  const archivo = document.getElementById("subidosArchivo");

  setSubidosModalTitulo("Nuevo evento habitual");
  if (fecha) fecha.value = ev.fechaEvento;
  if (etiqueta) etiqueta.value = ev.etiqueta;
  if (descripcion) descripcion.value = ev.descripcion;
  if (archivo) archivo.value = "";

  actualizarPredicaSubidosUI();
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

 const habitualesMes = subidosEventosHabitualesDelMes(year, month);
 const porFecha = agruparPorFecha([...subidosItems, ...habitualesMes]);
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
       const titulo = escaparHtml(it.descripcion || it.etiqueta || "Subido");

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
  "predica": "#35c6b7",
  "anuncio": "#ff0000",
  "plan": "#d2ff00",
  "racimo": "#00afff",
  "oracion": "#ff8000",
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

function obtenerSubidoPorId(id) {
  return subidosItems.find(x => x.id === id) || null;
}

const SUBIDOS_IMAGEN_HORARIOS_URL = "img/subidos/horarios-habituales.png?v=2026-05-07-historia";

window.abrirImagenHorariosSubidos = function abrirImagenHorariosSubidos() {
  abrirModalSubidosVisor(
    "Horarios habituales",
    `<img src="${SUBIDOS_IMAGEN_HORARIOS_URL}" alt="Horarios habituales">`
  );
};

function htmlImagenFijaHorariosSubidos() {
  return `
    <div id="subidos-imagen-horarios" class="subidos-feed-card subidos-card-imagen-fija">
      <div class="subidos-media">
        <button
          type="button"
          onclick="abrirImagenHorariosSubidos()"
          class="subidos-media-link subidos-media-frame is-image"
          title="Ver horarios habituales"
        >
          <img
            src="${SUBIDOS_IMAGEN_HORARIOS_URL}"
            alt="Horarios habituales"
            loading="lazy"
            decoding="async"
          >
        </button>
      </div>
    </div>
  `;
}

function subidosTieneContenidoPredica(it) {
  return !!(obtenerCitasPredicaSubido(it).length || String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim());
}

function subidosTextoPlanoPredica(it) {
  const citas = obtenerCitasPredicaSubido(it);
  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();

  const partes = [];
  if (it.etiqueta) partes.push(it.etiqueta);
  if (it.fechaEvento) partes.push(it.fechaEvento);
  if (it.descripcion) partes.push(it.descripcion);

  citas.forEach(c => {
    partes.push(c.referencia || "");
    if (c.texto) partes.push(c.texto);
    if (c.comentario || c.nota) partes.push(`Comentario: ${c.comentario || c.nota}`);
  });

  if (notaFinal) partes.push(`Nota: ${notaFinal}`);

  return partes.filter(Boolean).join("\n\n").trim();
}

function subidosLimpiarHashDetalle() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  if (!rawHash.startsWith("subido=")) return;

  const url = new URL(window.location.href);
  url.hash = "";
  history.replaceState(null, "", url.pathname + url.search);
}

window.cerrarModalSubidosVisor = function cerrarModalSubidosVisor() {
  const m = document.getElementById("modalSubidosVisor");
  const body = document.getElementById("subidosVisorBody");
  const ttl = document.getElementById("subidosVisorTitulo");
  if (!m) return;

  if (body) body.innerHTML = "";
  if (ttl) ttl.textContent = "Vista previa";

  m.style.display = "none";
  m.setAttribute("aria-hidden", "true");

  subidosLimpiarHashDetalle();
};

function abrirModalSubidosVisor(titulo, html) {
  const m = document.getElementById("modalSubidosVisor");
  const body = document.getElementById("subidosVisorBody");
  const ttl = document.getElementById("subidosVisorTitulo");
  if (!m || !body || !ttl) return;

  ttl.textContent = titulo || "Vista previa";
  body.innerHTML = html || "";
  m.style.display = "flex";
  m.setAttribute("aria-hidden", "false");
}

function subidosLinkDetalle(id) {
  const url = new URL(window.location.href);
  url.hash = `subido=${encodeURIComponent(id)}&open=all`;
  return url.toString();
}

function subidosEsperarImagenes(node) {
  const imgs = [...node.querySelectorAll("img")];

  return Promise.all(
    imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();

      return new Promise(resolve => {
        const fin = () => {
          clearTimeout(timer);
          resolve();
        };

        const timer = setTimeout(fin, 12000);

        img.addEventListener("load", fin, { once: true });
        img.addEventListener("error", fin, { once: true });
      });
    })
  );
}

function subidosAnchoExportPredica() {
  // 420 x 747 aprox = historia 9:16
  return 420;
}

function subidosTextoPlanoExport(txt = "") {
  return String(txt || "")
    .replace(/\u00A0/g, " ")
    .replace(/\t/g, " ")
    .replace(/\r/g, "")
    .split("\n")
    .map(linea =>
      String(linea || "")
        .replace(/^[\s\u00A0]+/g, "")
        .replace(/[\s\u00A0]+$/g, "")
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function subidosHtmlExport(txt = "") {
  return escaparHtml(subidosTextoPlanoExport(txt)).replace(/\n/g, "<br>");
}

function subidosFechaBonitaExport(ymd = "") {
  if (!ymd) return "";
  try {
    return new Date(ymd + "T00:00:00").toLocaleDateString("es-AR");
  } catch {
    return ymd;
  }
}

function subidosArchivoExportHtml(it) {
  const url = String(it?.url || "").trim();
  const mime = String(it?.mimeType || "");
  const nombre = escaparHtml(it?.fileName || "archivo");

  if (!url) return "";

  if (mime.startsWith("image/")) {
    return `
      <div class="subidos-export-media">
        <img src="${url}" alt="${nombre}">
      </div>
    `;
  }

  if (mime.startsWith("video/")) {
    return `
      <div class="subidos-export-media subidos-export-media-placeholder">
        <i class="fa-solid fa-video"></i>
        <span>Video adjunto</span>
      </div>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <div class="subidos-export-media subidos-export-media-placeholder">
        <i class="fa-solid fa-headphones"></i>
        <span>Audio adjunto</span>
      </div>
    `;
  }

  return `
    <div class="subidos-export-media subidos-export-media-placeholder">
      <i class="fa-solid fa-file-lines"></i>
      <span>Archivo adjunto</span>
    </div>
  `;
}

function subidosClaseBalanceIntroNota(introduccion = "", notaFinal = "") {
  const intro = String(introduccion || "").trim();
  const nota = String(notaFinal || "").trim();

  if (intro && !nota) return "uno";
  if (!intro && nota) return "uno";
  if (!intro && !nota) return "uno";

  const a = intro.length;
  const b = nota.length;

  // ✅ antes era muy agresivo y dejaba una caja muy angosta
  if (a >= b * 2.4) return "intro-muy-larga";
  if (b >= a * 2.4) return "nota-muy-larga";

  if (a >= b * 1.7) return "intro-larga";
  if (b >= a * 1.7) return "nota-larga";

  return "dos";
}

function subidosClasePrimeraCitaExport(texto = "", referencia = "") {
  const txt = String(texto || "").trim();
  const ref = String(referencia || "").trim();

  const textoPlano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  // ✅ peso general del contenido
  const peso = textoPlano.length + Math.round(ref.length * 0.35) + (saltos * 18);

  // ✅ muy corto / corto
  if (peso <= 185) return "breve";

  // ✅ medio: acá queremos que entre el caso como 1 Samuel 17:34-35
  if (peso <= 340) return "media";

  // ✅ largo: recién acá usa el tamaño máximo actual
  return "larga";
}

function subidosPesoTextoExport(texto = "") {
  const txt = String(texto || "").trim();
  const plano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  return plano.length + (saltos * 22);
}

function subidosClaseCajaTextoExport(texto = "") {
  const peso = subidosPesoTextoExport(texto);

  // ✅ un texto corto no debe heredar una caja alta
  if (peso <= 180) return "breve";

  // ✅ texto medio: suficiente, sin inflar demasiado
  if (peso <= 440) return "media";

  return "larga";
}

function subidosClaseAireIntroNotaExport(introduccion = "", notaFinal = "", primeraTexto = "") {
  const introPeso = subidosPesoTextoExport(introduccion);
  const notaPeso = subidosPesoTextoExport(notaFinal);
  const primeraPeso = subidosPesoTextoExport(primeraTexto);

  const mayorTextoSecundario = Math.max(introPeso, notaPeso);
  const totalSecundario = introPeso + notaPeso;

  // ✅ Si el primer versículo es muy largo, el aire debe ir a favor de él.
  if (primeraPeso >= 520 && totalSecundario <= 520) return "aire-compacto";

  // ✅ Textos secundarios cortos: más fondo visible.
  if (mayorTextoSecundario <= 160 && totalSecundario <= 290) return "aire-amplio";

  // ✅ Textos secundarios medianos.
  if (mayorTextoSecundario <= 360 && totalSecundario <= 620) return "aire-medio";

  return "aire-compacto";
}

function subidosClaseLayoutPredicaExport(primeraTexto = "", introduccion = "", notaFinal = "") {
  const p1 = subidosPesoTextoExport(primeraTexto);
  const intro = subidosPesoTextoExport(introduccion);
  const nota = subidosPesoTextoExport(notaFinal);
  const secundarios = intro + nota;

  if (p1 >= 650 && secundarios <= 620) return "v1-max";
  if (p1 >= 470 && secundarios <= 700) return "v1-grande";
  if (p1 >= 300) return "v1-medio";

  return "v1-normal";
}

function subidosClampNumero(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || min));
}

function subidosRepartoFlexiblePredicaExport(primeraTexto = "", introduccion = "", notaFinal = "") {
  const p1 = subidosPesoTextoExport(primeraTexto);
  const intro = subidosPesoTextoExport(introduccion);
  const nota = subidosPesoTextoExport(notaFinal);

  // ✅ Como intro y nota van una al lado de la otra,
  // NO usamos intro + nota para el alto de esa fila.
  // Usamos principalmente el más largo.
  const mayorSecundario = Math.max(intro, nota);
  const totalSecundario = intro + nota;
  const haySecundarios = totalSecundario > 0;

  let growPrimera = 2.4 + (p1 / 135);
  let growTextos = haySecundarios ? 0.85 + (mayorSecundario / 210) : 0;

  // ✅ Si el primer versículo pesa más, le damos más espacio.
  if (p1 > mayorSecundario * 1.25) {
    growPrimera += 1.1;
  }

  // ✅ Si intro/nota realmente necesitan más, recién ahí crece esa fila.
  if (haySecundarios && mayorSecundario > p1 * 1.15) {
    growTextos += 0.9;
  }

  // ✅ Evita que la fila de intro/nota se infle por aire.
  growPrimera = subidosClampNumero(growPrimera, 2.4, 8.4);
  growTextos = haySecundarios ? subidosClampNumero(growTextos, 0.85, 3.8) : 0;

  // ✅ Aire general: mínimo 1px.
  let gapGeneral = 7;

  if (p1 >= 650 && mayorSecundario <= 360) {
    gapGeneral = 3;
  } else if (p1 >= 470) {
    gapGeneral = 5;
  } else if (p1 <= 240 && mayorSecundario <= 220) {
    gapGeneral = 13;
  } else if (mayorSecundario <= 340) {
    gapGeneral = 9;
  }

  // ✅ Aire entre intro y nota.
  let gapTextos = 12;

  if (p1 >= 650 && mayorSecundario <= 360) {
    gapTextos = 8;
  } else if (mayorSecundario <= 180) {
    gapTextos = 18;
  } else if (mayorSecundario <= 340) {
    gapTextos = 14;
  }

  return {
    growPrimera: growPrimera.toFixed(2),
    growTextos: growTextos.toFixed(2),
    gapGeneral: Math.max(1, Math.round(gapGeneral)),
    gapTextos: Math.max(1, Math.round(gapTextos))
  };
}

function subidosCrearNodoExportPredica(it) {
  const exportW = subidosAnchoExportPredica();
  const exportH = Math.round((exportW * 16) / 9);

  const citas = obtenerCitasPredicaSubido(it);
  const primeraCita = citas[0] || null;

  const primeraTexto = subidosTextoPlanoExport(primeraCita?.texto || "");
  const primeraRef = subidosTextoPlanoExport(primeraCita?.referencia || "");

  const otrasRefs = citas
    .slice(1)
    .map(c => subidosTextoPlanoExport(c.referencia || ""))
    .filter(Boolean);

  const otrasCitasHtml = otrasRefs.map(ref => `
    <span class="subidos-export-ref-extra">${escaparHtml(ref)}</span>
  `).join(`<span class="subidos-export-bullet">•</span>`);

  const introduccion = subidosTextoPlanoExport(it.predicaIntroduccion || it.introduccionPredica || "");
  const notaFinal = subidosTextoPlanoExport(it.predicaNotaFinal || it.notaFinalGeneral || "");
  const fechaTxt = subidosFechaBonitaExport(it.fechaEvento || "");
  const descripcion = subidosTextoPlanoExport(it.descripcion || "");
  const color = colorEtiquetaSubidos(it.etiqueta || "");

 const textosClase = subidosClaseBalanceIntroNota(introduccion, notaFinal);
 const primeraClase = subidosClasePrimeraCitaExport(primeraTexto, primeraRef);
  const introClase = subidosClaseCajaTextoExport(introduccion);
const notaClase = subidosClaseCajaTextoExport(notaFinal);
const aireClase = subidosClaseAireIntroNotaExport(introduccion, notaFinal, primeraTexto);
const layoutClase = subidosClaseLayoutPredicaExport(primeraTexto, introduccion, notaFinal);
  const repartoFlexible = subidosRepartoFlexiblePredicaExport(primeraTexto, introduccion, notaFinal);

  const node = document.createElement("article");
  node.id = "subidosExportPredicaFinal";
node.className = `subidos-export-template ${layoutClase}`;
  node.style.setProperty("--grow-primera", repartoFlexible.growPrimera);
node.style.setProperty("--grow-textos", repartoFlexible.growTextos);
node.style.setProperty("--gap-general", `${repartoFlexible.gapGeneral}px`);
node.style.setProperty("--gap-textos", `${repartoFlexible.gapTextos}px`);

  node.innerHTML = `
    <style>
      #subidosExportPredicaFinal{
        --left-col: 1.14fr;
        --right-col: .86fr;

        width:${exportW}px;
        height:${exportH}px;
        box-sizing:border-box;
        overflow:hidden;
        border-radius:30px;
        padding:12px 14px 14px;
        display:flex;
        flex-direction:column;
        gap:var(--gap-general, 7px);
        background-image:url("${SUBIDOS_EXPORT_BG_URL}");
        background-size:cover;
        background-position:center center;
        background-repeat:no-repeat;
        font-family:"Lora", serif;
        color:#111;
      }

      #subidosExportPredicaFinal *{
        box-sizing:border-box;
      }

      /* ===== TOP ===== */

      #subidosExportPredicaFinal .subidos-export-head{
        flex:0 0 auto;
        display:flex;
        align-items:center;
        gap:8px;
        min-width:0;
      }

      #subidosExportPredicaFinal .subidos-export-badge{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        gap:6px;
        height:28px;
        padding:0 12px;
        border-radius:999px;
        background:${color.bg};
        color:${color.fg};
        font-family:Arial, sans-serif;
        font-weight:800;
        font-size:14px;
        line-height:1;
        white-space:nowrap;
      }

      #subidosExportPredicaFinal .subidos-export-meta-box{
        flex:1 1 auto;
        min-width:0;
        border-radius:16px;
        padding:6px 10px;
        background:rgba(255,255,255,.62);
        border:1px solid rgba(255,255,255,.42);
        display:flex;
        align-items:center;
        gap:10px;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-fecha{
        flex:0 0 auto;
        font-family:Arial, sans-serif;
        font-size:13px;
        line-height:1;
        color:#23313a;
        white-space:nowrap;
      }

      #subidosExportPredicaFinal .subidos-export-titulo{
        flex:1 1 auto;
        min-width:0;
        font-family:"Lora", serif;
        font-size:15px;
        line-height:1.05;
        font-weight:900;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      }

      #subidosExportPredicaFinal .subidos-export-divider{
        flex:0 0 auto;
        height:1px;
        background:rgba(0,0,0,.08);
      }

      /* ===== ARCHIVO + DATOS IGLESIA ===== */

      #subidosExportPredicaFinal .subidos-export-hero{
        flex:0 0 188px;
        min-height:0;
        display:grid;
        grid-template-columns:var(--left-col) var(--right-col);
        gap:10px;
        align-items:stretch;
      }

      #subidosExportPredicaFinal .subidos-export-media{
        width:100%;
        min-height:0;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.80);
        border-radius:22px;
        overflow:hidden;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      #subidosExportPredicaFinal .subidos-export-media img{
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      #subidosExportPredicaFinal .subidos-export-media-placeholder{
        flex-direction:column;
        gap:10px;
        font-weight:900;
        text-align:center;
      }

      #subidosExportPredicaFinal .subidos-export-media-placeholder i{
        font-size:32px;
      }

      #subidosExportPredicaFinal .subidos-export-brand-wrap{
        min-height:0;
        display:flex;
      }

      #subidosExportPredicaFinal .subidos-export-brand-box{
        width:100%;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.80);
        border-radius:22px;
        padding:14px 12px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        text-align:center;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-iglesia{
        font-weight:900;
        font-size:21.5px;
        line-height:1.04;
      }

      #subidosExportPredicaFinal .subidos-export-address{
        margin-top:12px;
        font-size:13.5px;
        line-height:1.12;
        font-weight:800;
      }

      #subidosExportPredicaFinal .subidos-export-meeting{
        margin-top:10px;
        font-size:13.5px;
        line-height:1.12;
        font-weight:800;
      }

                /* ===== PRIMERA CITA DESTACADA ===== */

      #subidosExportPredicaFinal .subidos-export-primera-box{
        flex:var(--grow-primera, 3) 1 0;
        min-height:0;
        max-height:none;
        border:1px solid rgba(255,255,255,.56);
        background:rgba(255,255,255,.82);
        border-radius:22px;
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:8px;
        text-align:center;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.larga{
        padding:12px 18px;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.media{
        padding:18px 24px;
      }

      #subidosExportPredicaFinal .subidos-export-primera-box.breve{
        padding:24px 34px;
      }

      #subidosExportPredicaFinal .subidos-export-primera-texto{
        width:100%;
        max-width:100%;
        font-family:"Lora", serif;
        font-size:15px;
        line-height:1.14;
        font-weight:900;
        text-align:center;
        overflow-wrap:anywhere;
      }

      #subidosExportPredicaFinal.v1-grande .subidos-export-primera-texto,
      #subidosExportPredicaFinal.v1-max .subidos-export-primera-texto{
        line-height:1.10;
      }

      #subidosExportPredicaFinal .subidos-export-primera-ref{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        border-radius:999px;
        padding:5px 16px;
        background:rgba(255,255,255,.88);
        border:1px solid rgba(190,220,236,.95);
        font-size:13px;
        line-height:1;
        font-weight:900;
        white-space:nowrap;
      }

      /* ===== INTRO + NOTA FINAL ===== */

      #subidosExportPredicaFinal .subidos-export-text-row{
        flex:var(--grow-textos, 2) 1 0;
        min-height:0;
        max-height:none;
        display:grid;
        align-items:center;
        align-content:center;
        justify-items:stretch;
        overflow:hidden;
        gap:var(--gap-textos, 12px);
      }

      #subidosExportPredicaFinal .subidos-export-text-row.dos{
        grid-template-columns:1fr 1fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.intro-larga{
        grid-template-columns:1.08fr .92fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.nota-larga{
        grid-template-columns:.92fr 1.08fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.intro-muy-larga{
        grid-template-columns:1.14fr .86fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.nota-muy-larga{
        grid-template-columns:.86fr 1.14fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-row.uno{
        grid-template-columns:1fr;
      }

      #subidosExportPredicaFinal .subidos-export-text-box{
        width:100%;
        height:auto;
        min-height:0;
        max-height:100%;
        align-self:center;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.80);
        border-radius:22px;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        overflow:hidden;
      }

      /* ✅ poco texto: bloque chico */
      #subidosExportPredicaFinal .subidos-export-text-box.breve{
        min-height:76px;
        padding:12px 14px;
      }

      /* ✅ texto medio: bloque moderado */
      #subidosExportPredicaFinal .subidos-export-text-box.media{
        min-height:118px;
        padding:12px 15px;
      }

      /* ✅ texto largo: crece más, pero no ocupa aire de más */
      #subidosExportPredicaFinal .subidos-export-text-box.larga{
        min-height:154px;
        padding:12px 16px;
      }

      #subidosExportPredicaFinal .subidos-export-intro,
      #subidosExportPredicaFinal .subidos-export-note{
        width:100%;
        max-width:100%;
        font-weight:800;
        text-align:center;
        line-height:1.12;
        overflow-wrap:anywhere;
        display:block;
        font-size:12px;
      }

      #subidosExportPredicaFinal.v1-grande .subidos-export-intro,
      #subidosExportPredicaFinal.v1-grande .subidos-export-note,
      #subidosExportPredicaFinal.v1-max .subidos-export-intro,
      #subidosExportPredicaFinal.v1-max .subidos-export-note{
        font-size:11.4px;
        line-height:1.08;
      }

      /* ===== DEMÁS CITAS ===== */

      #subidosExportPredicaFinal .subidos-export-otras-citas-box{
        flex:0 1 auto;
        min-height:36px;
        max-height:58px;
        border:1px solid rgba(255,255,255,.52);
        background:rgba(255,255,255,.72);
        border-radius:18px;
        padding:7px 12px;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-otras-citas{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:center;
        gap:4px 7px;
        font-size:11.5px;
        line-height:1.10;
        font-weight:900;
        text-align:center;
        overflow:hidden;
      }

      #subidosExportPredicaFinal .subidos-export-ref-extra{
        white-space:nowrap;
      }

      #subidosExportPredicaFinal .subidos-export-bullet{
        opacity:.72;
        font-size:14px;
        line-height:1;
        transform:translateY(-1px);
      }
      
    </style>

    <div class="subidos-export-head">
      <div class="subidos-export-badge">
        <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
        ${escaparHtml(it.etiqueta || "Predica")}
      </div>

      ${fechaTxt || descripcion ? `
        <div class="subidos-export-meta-box">
          ${fechaTxt ? `<div class="subidos-export-fecha">${escaparHtml(fechaTxt)}</div>` : ``}
          ${descripcion ? `<div class="subidos-export-titulo">${escaparHtml(descripcion)}</div>` : ``}
        </div>
      ` : ``}
    </div>

    <div class="subidos-export-divider"></div>

    <div class="subidos-export-hero">
      ${subidosArchivoExportHtml(it)}

      <div class="subidos-export-brand-wrap">
        <div class="subidos-export-brand-box">
          <div class="subidos-export-iglesia">
            Iglesia Cristiana de<br>
            la Vida Abundante
          </div>

          <div class="subidos-export-address">
            Roca 123,<br>
            Tristan Suarez
          </div>

          <div class="subidos-export-meeting">
            Reunión<br>
            Domingo 10hs
          </div>
        </div>
      </div>
    </div>

    <div class="subidos-export-primera-box ${primeraClase}">
      ${primeraTexto ? `
        <div class="subidos-export-primera-texto">
          ${subidosHtmlExport(primeraTexto)}
        </div>
      ` : `
        <div class="subidos-export-primera-texto">
          Sin versículo cargado.
        </div>
      `}

      ${primeraRef ? `
        <div class="subidos-export-primera-ref">
          ~ ${escaparHtml(primeraRef)} ~
        </div>
      ` : ``}
    </div>

    ${introduccion || notaFinal ? `
    <div class="subidos-export-text-row ${textosClase} ${aireClase}">
        ${introduccion ? `
       <div class="subidos-export-text-box intro-box ${introClase}">
            <div class="subidos-export-intro">
              ${subidosHtmlExport(introduccion)}
            </div>
          </div>
        ` : ``}

        ${notaFinal ? `
    <div class="subidos-export-text-box note-box ${notaClase}">
            <div class="subidos-export-note">
              ${subidosHtmlExport(notaFinal)}
            </div>
          </div>
        ` : ``}
      </div>
    ` : ``}

    ${otrasCitasHtml ? `
      <div class="subidos-export-otras-citas-box">
        <div class="subidos-export-otras-citas">
          ${otrasCitasHtml}
        </div>
      </div>
    ` : ``}
  `;

  return node;
}

function subidosBlobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => resolve(String(rd.result || ""));
    rd.readAsDataURL(blob);
  });
}

function subidosAjustarTextoSoloSiNoCabe(boxEl, textEl, minFontPx = 9.5, paso = 0.2) {
  if (!boxEl || !textEl) return;

  const hayOverflow = () => (
    textEl.scrollHeight > textEl.clientHeight + 1 ||
    textEl.scrollWidth > textEl.clientWidth + 1
  );

  let fontSize = parseFloat(window.getComputedStyle(textEl).fontSize || "12");

  while (fontSize > minFontPx && hayOverflow()) {
    fontSize = Math.max(minFontPx, fontSize - paso);
    textEl.style.fontSize = fontSize + "px";
  }
}

function subidosOverflowTextoExport(textEl) {
  if (!textEl) return false;

  return (
    textEl.scrollHeight > textEl.clientHeight + 1 ||
    textEl.scrollWidth > textEl.clientWidth + 1
  );
}

function subidosPadYExport(el) {
  if (!el) return 0;

  const cs = window.getComputedStyle(el);
  return (
    parseFloat(cs.paddingTop || "0") +
    parseFloat(cs.paddingBottom || "0") +
    parseFloat(cs.borderTopWidth || "0") +
    parseFloat(cs.borderBottomWidth || "0")
  );
}

function subidosPesoVisualExport(texto = "") {
  const txt = String(texto || "").trim();
  if (!txt) return 0;

  const plano = txt.replace(/\s+/g, " ").trim();
  const saltos = (txt.match(/\n/g) || []).length;

  return plano.length + (saltos * 26);
}

function subidosFuenteInicialExport(textEl, base, extraSiCorto = 1, limiteCorto = 120) {
  if (!textEl) return base;

  const peso = subidosPesoVisualExport(textEl.textContent || "");
  const font = peso && peso <= limiteCorto ? base + extraSiCorto : base;

  textEl.style.fontSize = font + "px";
  return font;
}

function subidosRecortarTextoHastaEntrarExport(textEl) {
  if (!textEl) return;

  if (!textEl.dataset.textoOriginalExport) {
    textEl.dataset.textoOriginalExport = String(textEl.textContent || "").trim();
  }

  const original = String(textEl.dataset.textoOriginalExport || "").trim();
  if (!original) return;

  if (!subidosOverflowTextoExport(textEl)) return;

  let lo = 0;
  let hi = original.length;
  let mejor = "[…]";

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);

    let candidato = original.slice(0, mid).trim();

    // ✅ no cortar en medio de una palabra si se puede evitar
    candidato = candidato.replace(/\s+\S*$/, "").trim();

    if (!candidato) candidato = original.slice(0, mid).trim();

    textEl.textContent = candidato + " […]";

    if (!subidosOverflowTextoExport(textEl)) {
      mejor = textEl.textContent;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  textEl.textContent = mejor;
}

function subidosAjustarFuenteYRecorteExport(textEl, minFontPx = 9.5, paso = 0.2) {
  if (!textEl) return;

  let fontSize = parseFloat(window.getComputedStyle(textEl).fontSize || "12");

  while (fontSize > minFontPx && subidosOverflowTextoExport(textEl)) {
    fontSize = Math.max(minFontPx, fontSize - paso);
    textEl.style.fontSize = fontSize + "px";
  }

  if (subidosOverflowTextoExport(textEl)) {
    subidosRecortarTextoHastaEntrarExport(textEl);
  }
}

function subidosAplicarColumnasIntroNotaExport(row, introText, noteText) {
  if (!row) return;

  const hayIntro = !!introText;
  const hayNota = !!noteText;

  if (!hayIntro || !hayNota) {
    row.style.gridTemplateColumns = "1fr";
    return;
  }

  const introPeso = Math.max(60, subidosPesoVisualExport(introText.textContent || ""));
  const notaPeso = Math.max(60, subidosPesoVisualExport(noteText.textContent || ""));
  const total = introPeso + notaPeso;

  let introFr = introPeso / total;

  // ✅ No dejamos que una columna quede ridículamente angosta.
  // Pero sí permitimos que el texto más largo reciba más ancho.
  introFr = subidosClampNumero(introFr, 0.34, 0.66);

  const notaFr = 1 - introFr;

  row.style.gridTemplateColumns = `${introFr}fr ${notaFr}fr`;
}

function subidosResetCajaExport(box) {
  if (!box) return;

  box.style.minHeight = "0";
  box.style.height = "auto";
  box.style.maxHeight = "none";
  box.style.padding = "5px";
  box.style.overflow = "hidden";
  box.style.alignSelf = "center";
}

function subidosAltoNaturalCajaExport(box, textEl) {
  if (!box || !textEl) return 0;

  subidosResetCajaExport(box);

  textEl.style.maxHeight = "none";
  textEl.style.overflow = "visible";

  return Math.ceil(textEl.scrollHeight + subidosPadYExport(box) + 2);
}

function subidosAltoNaturalPrimeraExport(box, textEl, refEl) {
  if (!box || !textEl) return 0;

  subidosResetCajaExport(box);

  box.style.gap = "6px";
  textEl.style.maxHeight = "none";
  textEl.style.overflow = "visible";

  const refH = refEl ? refEl.offsetHeight : 0;
  const gapRef = refEl ? 6 : 0;

  return Math.ceil(textEl.scrollHeight + refH + gapRef + subidosPadYExport(box) + 2);
}

function subidosSetMaxTextoCajaExport(box, textEl) {
  if (!box || !textEl) return;

  const disponible = Math.max(12, box.clientHeight - subidosPadYExport(box) - 1);

  textEl.style.maxHeight = disponible + "px";
  textEl.style.overflow = "hidden";
}

function subidosSetMaxPrimeraExport(box, textEl, refEl) {
  if (!box || !textEl) return;

  const refH = refEl ? refEl.offsetHeight : 0;
  const gapRef = refEl ? 6 : 0;

  const disponible = Math.max(
    18,
    box.clientHeight - subidosPadYExport(box) - refH - gapRef - 1
  );

  textEl.style.maxHeight = disponible + "px";
  textEl.style.overflow = "hidden";
}

function subidosAjustarLayoutInteligenteExportPredica(node) {
  if (!node) return;

  const MIN_GAP = 2;

  const primeraBox = node.querySelector(".subidos-export-primera-box");
  const primeraText = node.querySelector(".subidos-export-primera-texto");
  const primeraRef = node.querySelector(".subidos-export-primera-ref");

  const row = node.querySelector(".subidos-export-text-row");

  const introBox = node.querySelector(".subidos-export-text-box.intro-box");
  const introText = node.querySelector(".subidos-export-intro");

  const noteBox = node.querySelector(".subidos-export-text-box.note-box");
  const noteText = node.querySelector(".subidos-export-note");

  const otrasBox = node.querySelector(".subidos-export-otras-citas-box");
  const otrasText = node.querySelector(".subidos-export-otras-citas");

  if (!primeraBox || !primeraText) return;

  // ✅ Reseteo limpio antes de medir.
  node.style.justifyContent = "flex-start";
  node.style.gap = MIN_GAP + "px";

  primeraBox.style.flex = "0 0 auto";

  if (row) {
    row.style.flex = "0 0 auto";
    row.style.height = "auto";
    row.style.minHeight = "0";
    row.style.maxHeight = "none";
    row.style.alignItems = "center";
    row.style.alignContent = "center";
    row.style.gap = MIN_GAP + "px";
    row.style.overflow = "hidden";
  }

  subidosResetCajaExport(primeraBox);
  subidosResetCajaExport(introBox);
  subidosResetCajaExport(noteBox);

  // ✅ Ancho inteligente entre intro y nota ANTES de medir alto.
  subidosAplicarColumnasIntroNotaExport(row, introText, noteText);

  // ✅ Fuente base: si el texto es muy breve, sube 1 punto.
  subidosFuenteInicialExport(primeraText, 15, 1, 150);
  subidosFuenteInicialExport(introText, 12, 1, 110);
  subidosFuenteInicialExport(noteText, 12, 1, 110);

  // ✅ Altos naturales reales: no categorías fijas.
  const altoPrimeraNatural = subidosAltoNaturalPrimeraExport(
    primeraBox,
    primeraText,
    primeraRef
  );

  const altoIntroNatural = subidosAltoNaturalCajaExport(introBox, introText);
  const altoNotaNatural = subidosAltoNaturalCajaExport(noteBox, noteText);

  const hayIntro = !!(introBox && introText);
  const hayNota = !!(noteBox && noteText);
  const hayRow = !!(row && (hayIntro || hayNota));

  const altoRowNatural = hayRow
    ? Math.max(altoIntroNatural || 0, altoNotaNatural || 0)
    : 0;

  // ✅ Medimos altura disponible real dentro del PNG.
  const csNode = window.getComputedStyle(node);
  const altoContenido = node.clientHeight
    - parseFloat(csNode.paddingTop || "0")
    - parseFloat(csNode.paddingBottom || "0");

  const hijos = [...node.children].filter(el => {
    if (!el || el.tagName === "STYLE") return false;
    return window.getComputedStyle(el).display !== "none";
  });

  const espacios = Math.max(0, hijos.length - 1);

  const altoFijo = hijos.reduce((total, el) => {
    if (el === primeraBox) return total;
    if (el === row) return total;
    return total + el.offsetHeight;
  }, 0);

  const disponibleParaTextos = Math.max(
    1,
    altoContenido - altoFijo - (MIN_GAP * espacios)
  );

  const requerido = altoPrimeraNatural + altoRowNatural;

  let altoPrimera = altoPrimeraNatural;
  let altoRow = altoRowNatural;

  if (requerido <= disponibleParaTextos) {
    // ✅ Si entra todo, las cajas quedan ajustadas al texto.
    // El sobrante se vuelve aire ENTRE bloques, no dentro de bloques.
    const gapCalculado = espacios
      ? Math.floor((altoContenido - altoFijo - requerido) / espacios)
      : MIN_GAP;

    const gapFinal = subidosClampNumero(gapCalculado, MIN_GAP, 22);

    node.style.gap = gapFinal + "px";
    if (row) row.style.gap = subidosClampNumero(gapFinal, MIN_GAP, 16) + "px";
  } else {
    // ✅ Si no entra todo, repartimos proporcionalmente entre:
    // primer versículo y fila intro/nota.
    node.style.gap = MIN_GAP + "px";
    if (row) row.style.gap = MIN_GAP + "px";

    const minPrimera = 80;
    const minRow = hayRow ? 62 : 0;

    const ratio = disponibleParaTextos / Math.max(1, requerido);

    altoPrimera = Math.floor(altoPrimeraNatural * ratio);
    altoRow = disponibleParaTextos - altoPrimera;

    altoPrimera = subidosClampNumero(
      altoPrimera,
      minPrimera,
      disponibleParaTextos - minRow
    );

    altoRow = hayRow
      ? Math.max(minRow, disponibleParaTextos - altoPrimera)
      : 0;
  }

  // ✅ Aplicamos alturas reales.
  primeraBox.style.height = Math.max(1, Math.floor(altoPrimera)) + "px";
  primeraBox.style.flex = "0 0 " + Math.max(1, Math.floor(altoPrimera)) + "px";

  if (row && hayRow) {
    row.style.height = Math.max(1, Math.floor(altoRow)) + "px";
    row.style.flex = "0 0 " + Math.max(1, Math.floor(altoRow)) + "px";
  }

  // ✅ Intro y nota NO heredan la altura de la fila.
  // Cada una usa lo que necesita. Si no entra, se limita a la fila.
  if (introBox && introText) {
    const h = Math.min(altoIntroNatural, altoRow || altoIntroNatural);
    introBox.style.height = Math.max(1, Math.floor(h)) + "px";
  }

  if (noteBox && noteText) {
    const h = Math.min(altoNotaNatural, altoRow || altoNotaNatural);
    noteBox.style.height = Math.max(1, Math.floor(h)) + "px";
  }

  // ✅ Máximos internos para que no pise ni corte feo.
  subidosSetMaxPrimeraExport(primeraBox, primeraText, primeraRef);
  subidosSetMaxTextoCajaExport(introBox, introText);
  subidosSetMaxTextoCajaExport(noteBox, noteText);

  // ✅ Si no cabe: baja fuente. Si aun no cabe: recorta con […].
  subidosAjustarFuenteYRecorteExport(primeraText, 10.2, 0.2);
  subidosAjustarFuenteYRecorteExport(introText, 9.4, 0.2);
  subidosAjustarFuenteYRecorteExport(noteText, 9.4, 0.2);

  if (otrasBox && otrasText) {
    subidosSetMaxTextoCajaExport(otrasBox, otrasText);
    subidosAjustarFuenteYRecorteExport(otrasText, 9.2, 0.2);
  }
}

function subidosAjustarTextosExportPredica(node) {
  if (!node) return;

  subidosAjustarLayoutInteligenteExportPredica(node);
}

async function subidosConvertirImagenesExportConProxy(node) {
  const imgs = [...node.querySelectorAll("img")];

  for (const img of imgs) {
    const src = img.currentSrc || img.getAttribute("src") || img.src || "";
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) continue;

    try {
      const proxy = subidosProxyArchivoUrl(src, "imagen-export.png", false);
      const r = await fetch(proxy);

      if (!r.ok) throw new Error("No pude leer imagen desde descargarImagenR2.");

      const blob = await r.blob();
      const dataUrl = await subidosBlobToDataURL(blob);

      img.removeAttribute("crossorigin");
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = dataUrl;
    } catch (e) {
      console.warn("No pude convertir imagen para exportación:", src, e);
    }
  }
}

async function subidosGenerarBlobCardPredica(id, itemOverride = null) {
  const it = itemOverride || obtenerSubidoPorId(id);
  if (!it) throw new Error("No encontré la prédica a exportar.");

  const stage = document.getElementById("subidosExportStage");
  if (!stage) throw new Error("Falta #subidosExportStage en el HTML.");

  stage.innerHTML = "";

  const exportNode = subidosCrearNodoExportPredica({
    id,
    ...(it || {})
  });

  stage.appendChild(exportNode);

  await subidosConvertirImagenesExportConProxy(exportNode);
  await subidosEsperarImagenes(exportNode);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // ✅ solo achica fuente si realmente no entra
  subidosAjustarTextosExportPredica(exportNode);

  // ✅ esperamos otro frame para que el navegador aplique el nuevo tamaño si cambió
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  let canvas;

  try {
    canvas = await html2canvas(exportNode, {
      backgroundColor: null,
      scale: 2,
      useCORS: true
    });
  } catch (e) {
    stage.innerHTML = "";
    throw new Error("No pude generar la imagen de la prédica.");
  }

  console.log("✅ EXPORT PREDICA TEMPLATE:", {
    anchoCanvas: canvas.width,
    altoCanvas: canvas.height,
    proporcion: (canvas.height / canvas.width).toFixed(2)
  });

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

  stage.innerHTML = "";

  if (!blob) throw new Error("No se pudo generar la imagen.");
  return blob;
}

function subidosEsPredicaConContenido(it) {
  return esPredicaSubidos(it?.etiqueta || "") && subidosTieneContenidoPredica(it);
}

function subidosAbrirDesdeHash() {
  const rawHash = String(window.location.hash || "").replace(/^#/, "");
  if (!rawHash.startsWith("subido=")) return;

  const params = new URLSearchParams(rawHash);
  const id = String(params.get("subido") || "").trim();
  const open = String(params.get("open") || "").trim();

  if (!id) return;

  const it = obtenerSubidoPorId(id);
  if (!it) return;

  // ✅ Consumimos el hash una sola vez para que al refrescar no se abra sola otra vez.
  subidosLimpiarHashDetalle();

  if (typeof window.irA === "function") window.irA("iglesia");
  if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("subidos");

  setTimeout(() => {
    const abrirClave = open === "all" ? "all" : "";

    if (subidosEsPredicaConContenido(it)) {
      abrirSubidosVisorPredica(id, abrirClave);
      return;
    }

    if (it.url) {
      abrirSubidosVisorArchivo(id);
    }
  }, 180);
}

function htmlArchivoGrandePredica(it) {
  if (!it?.url) return "";

  const nombre = escaparHtml(it.fileName || "archivo");
  const mime = String(it.mimeType || "");

  if (mime.startsWith("image/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        style="width:100%; border:none; background:#fff; border-radius:16px; padding:0; overflow:hidden; cursor:pointer;"
        title="Abrir archivo"
      >
        <img
          src="${it.url}"
          alt="${nombre}"
          style="display:block; width:100%; max-height:46vh; object-fit:contain; background:#fff;"
        >
      </button>
    `;
  }

  if (mime.startsWith("video/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        style="width:100%; border:none; background:#fff; border-radius:16px; padding:0; overflow:hidden; cursor:pointer;"
        title="Abrir video"
      >
        <video
          src="${it.url}"
          muted
          playsinline
          preload="metadata"
          style="display:block; width:100%; max-height:46vh; object-fit:contain; background:#000;"
        ></video>
      </button>
    `;
  }

  if (mime.startsWith("audio/")) {
    return `
      <button
        type="button"
        onclick="abrirSubidosVisorArchivo('${it.id}')"
        style="width:100%; border:1px solid #d8eef9; background:#fff; border-radius:16px; padding:18px; cursor:pointer;"
        title="Abrir audio"
      >
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
          <i class="fa-solid fa-headphones" style="font-size:28px;"></i>
          <div style="font-family:'Lora',serif; font-weight:700;">${nombre}</div>
          <small>Tocar para abrir</small>
        </div>
      </button>
    `;
  }

  return `
    <button
      type="button"
      onclick="abrirSubidosVisorArchivo('${it.id}')"
      style="width:100%; border:1px solid #d8eef9; background:#fff; border-radius:16px; padding:18px; cursor:pointer;"
      title="Abrir archivo"
    >
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px;">
        <i class="fa-solid fa-file-lines" style="font-size:28px;"></i>
        <div style="font-family:'Lora',serif; font-weight:700;">${nombre}</div>
        <small>Tocar para abrir</small>
      </div>
    </button>
  `;
}

function htmlPredicaBibliaSubidoGrande(it, abrirClave = "") {
  const citas = obtenerCitasPredicaSubido(it);
  const primeraCita = citas[0] || null;
  const otrasCitas = citas.slice(1);

  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();
  const introduccion = String(it.predicaIntroduccion || it.introduccionPredica || "").trim();

  const comentarioPrimera = String(
    primeraCita?.comentario || primeraCita?.nota || ""
  ).trim();

  const primeraBloque = primeraCita ? `
    <section
      class="subidos-visor-bloque subidos-visor-bloque-primera"
      style="
        background:rgba(209,238,255,.62);
        border:1px solid rgba(150,205,235,.72);
        border-radius:16px;
        overflow:hidden;
      "
    >
      <div class="subidos-visor-ref">
        ${escaparHtml(primeraCita.referencia || "")}
      </div>

      ${primeraCita.texto ? `
        <div
          class="subidos-visor-texto-primera"
          style="
            padding:12px 14px 10px;
            white-space:normal !important;
            text-align:center !important;
            font-family:'Lora', serif;
            font-size:15px;
            line-height:1.34;
            font-weight:900;
            color:var(--visor-texto);
          "
        >
          ${subidosTextoHtml(primeraCita.texto || "")}
        </div>
      ` : ``}

      ${comentarioPrimera ? `
        <div class="subidos-visor-comentario">
          ⪦ ${subidosTextoHtml(comentarioPrimera)}
        </div>
      ` : ``}
    </section>
  ` : ``;

  const bloquesRestantes = otrasCitas.map((c) => {
    const comentario = String(c.comentario || c.nota || "").trim();

    return `
      <section class="subidos-visor-bloque">
        <div class="subidos-visor-ref">${escaparHtml(c.referencia || "")}</div>

        ${c.texto ? `
          <div class="subidos-visor-texto">
            ${subidosTextoHtml(c.texto || "")}
          </div>
        ` : ``}

        ${comentario ? `
          <div class="subidos-visor-comentario">
            ⪦ ${subidosTextoHtml(comentario)}
          </div>
        ` : ``}
      </section>
    `;
  }).join("");

  const bloqueInfoEstilo = `
    margin:10px 0 12px;
    padding:12px 16px;
    border-radius:16px;
    background:rgba(255,255,255,.88);
    border:1px solid #d8eef9;
  `;

  return `
    <div class="subidos-visor-predica-full">
      <div class="subidos-visor-marco">
        ${it.url ? `
          <div class="subidos-visor-archivo">
            ${htmlArchivoGrandePredica(it)}
          </div>
        ` : ``}

        ${it.descripcion ? `
          <h2 class="subidos-visor-titulo">
            ${escaparHtml(it.descripcion)}
          </h2>
        ` : ``}

        <div style="${bloqueInfoEstilo}">
          <div class="subidos-visor-iglesia">
            Iglesia Cristiana de la Vida Abundante
          </div>
        </div>

        ${primeraBloque}

        ${introduccion ? `
          <div style="${bloqueInfoEstilo}">
            <div class="subidos-visor-intro">
              • ${subidosTextoHtml(introduccion)}
            </div>
          </div>
        ` : ``}

        ${bloquesRestantes ? `
          <div class="subidos-visor-bloques">
            ${bloquesRestantes}
          </div>
        ` : ``}

        ${notaFinal ? `
          <div style="${bloqueInfoEstilo}">
            <div class="subidos-visor-intro">
              • ${subidosTextoHtml(notaFinal)}
            </div>
          </div>
        ` : ``}

        <div class="subidos-visor-cierre">
          Domingos 10 hs - Roca 123, Tristan Suarez.
        </div>
      </div>
    </div>
  `;
}

// ✅ Permite que Compartidos reutilice la prédica ABIERTA,
// sin rehacerla como mini card de galería.
window.subidosRenderPredicaAbiertaHTML = function subidosRenderPredicaAbiertaHTML(item, abrirClave = "all") {
  if (!item) return "";

  try {
    return htmlPredicaBibliaSubidoGrande(item, abrirClave);
  } catch (e) {
    console.error("No pude renderizar prédica abierta para Compartidos:", e);
    return "";
  }
};

window.abrirSubidosVisorPredica = function abrirSubidosVisorPredica(id, abrirClave = "") {
  const it = obtenerSubidoPorId(id);
  if (!it) return;

  abrirModalSubidosVisor(
    it.etiqueta || "Prédica",
    htmlPredicaBibliaSubidoGrande(it, abrirClave)
  );
};

window.abrirSubidosVisorArchivo = function abrirSubidosVisorArchivo(id) {
  const it = obtenerSubidoPorId(id);
  if (!it?.url) return;

  const mime = String(it.mimeType || "");
  const url = it.url;
  const nombre = escaparHtml(it.fileName || "archivo");

  if (mime.startsWith("image/")) {
    abrirModalSubidosVisor(nombre, `<img src="${url}" alt="${nombre}">`);
    return;
  }

  if (mime.startsWith("video/")) {
    abrirModalSubidosVisor(nombre, `<video src="${url}" controls playsinline style="width:100%; max-height:78vh; border-radius:14px; background:#000;"></video>`);
    return;
  }

  if (mime.startsWith("audio/")) {
    abrirModalSubidosVisor(nombre, `
      <div style="padding:18px; border-radius:14px; background:#f8fafc;">
        <div style="font-weight:800; margin-bottom:10px;">${nombre}</div>
        <audio src="${url}" controls preload="metadata"></audio>
      </div>
    `);
    return;
  }

  abrirModalSubidosVisor(nombre, `<iframe src="${url}" style="width:100%; height:78vh; border:none; border-radius:14px; background:#fff;"></iframe>`);
};

function subidosProxyArchivoUrl(url, nombre = "archivo", descargar = false) {
  const u = new URL(SUBIDOS_PROXY_URL);
  u.searchParams.set("url", url);
  u.searchParams.set("nombre", nombre || "archivo");
  if (descargar) u.searchParams.set("descargar", "1");
  return u.toString();
}

async function descargarArchivoRemoto(url, nombre = "archivo") {
  if (!url) throw new Error("No hay URL para descargar.");

  const a = document.createElement("a");
  a.href = subidosProxyArchivoUrl(url, nombre, true);
  a.download = nombre || "archivo";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function subidosNombreArchivoParaCompartir(it) {
  const nombre = String(it?.fileName || it?.etiqueta || "archivo").trim();
  return nombre || "archivo";
}

async function subidosFileDesdeUrl(it) {
  if (!it?.url) throw new Error("No hay archivo para compartir.");

  const nombre = subidosNombreArchivoParaCompartir(it);
  const proxy = subidosProxyArchivoUrl(it.url, nombre, false);

  const r = await fetch(proxy);
  if (!r.ok) throw new Error("No pude leer el archivo desde descargarImagenR2.");

  const blob = await r.blob();

  return new File(
    [blob],
    nombre,
    { type: it.mimeType || blob.type || "application/octet-stream" }
  );
}

async function subidosCompartirFileObligatorio(file, titulo = "Archivo", texto = "") {
  if (!navigator.share) {
    throw new Error("Este navegador no permite compartir archivos desde la web.");
  }

  if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
    throw new Error("Este navegador no acepta compartir este tipo de archivo.");
  }

  const data = {
    files: [file],
    title: titulo
  };

  if (texto) {
    data.text = texto;
  }

  await navigator.share(data);
}

const subidosAccionesEnCurso = new Set();

function subidosAvisoProceso(texto, permanente = false) {
  let el = document.getElementById("subidosAvisoProceso");

  if (!el) {
    el = document.createElement("div");
    el.id = "subidosAvisoProceso";

    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "22px",
      transform: "translateX(-50%)",
      background: "rgba(17, 24, 39, .94)",
      color: "#fff",
      padding: "10px 15px",
      borderRadius: "999px",
      fontWeight: "800",
      fontSize: "14px",
      zIndex: "999999",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)",
      pointerEvents: "none",
      maxWidth: "88vw",
      textAlign: "center",
      display: "none"
    });

    document.body.appendChild(el);
  }

  clearTimeout(el.__timer);
  el.textContent = texto;
  el.style.display = "block";

  if (!permanente) {
    el.__timer = setTimeout(() => {
      el.style.display = "none";
    }, 1800);
  }
}

function subidosBloquearBotonesCard(id, bloquear) {
  const card = document.getElementById(`subido-${id}`);
  if (!card) return;

  card.querySelectorAll(".subidos-feed-actions button").forEach(btn => {
    btn.disabled = bloquear;
    btn.style.opacity = bloquear ? ".55" : "";
    btn.style.pointerEvents = bloquear ? "none" : "";
  });
}

async function subidosAccionProtegida(id, tipo, textoProceso, accion) {
  const key = `subido-${id}`;

  if (subidosAccionesEnCurso.has(key)) {
    subidosAvisoProceso(textoProceso, true);
    return;
  }

  subidosAccionesEnCurso.add(key);
  subidosBloquearBotonesCard(id, true);
  subidosAvisoProceso(textoProceso, true);

  try {
    await accion();
    subidosAvisoProceso(tipo === "descargar" ? "Descarga lista ✅" : "Listo ✅");
  } catch (e) {
    if (e?.name === "AbortError") {
      subidosAvisoProceso("Acción cancelada");
    } else {
      console.error(`Error en ${tipo}:`, e);
      subidosAvisoProceso("No se pudo completar");
      alert(tipo === "descargar" ? "No se pudo descargar." : "No se pudo compartir.");
    }
  } finally {
    subidosBloquearBotonesCard(id, false);

    setTimeout(() => {
      subidosAccionesEnCurso.delete(key);
    }, 700);
  }
}

window.descargarSubido = function descargarSubido(id) {
  return subidosAccionProtegida(id, "descargar", "Descargando.", async () => {
    const it = obtenerSubidoPorId(id);
    if (!it) return;

    // ✅ Video: no lo pasamos por Functions ni lo cargamos en memoria
    if (subidosEsVideoItem(it)) {
      subidosDescargarVideoDirecto(it);
      return;
    }

    let file = subidosFileCache.get(id)?.file;

    if (!file) {
      file = await subidosPrepararArchivoAccion(id);
    }

    if (!file) {
      throw new Error("El archivo todavía no está listo para descargar.");
    }

    // ✅ resto: descarga real desde Blob/File
    subidosDescargarFileReal(file);
  });
};

function subidosNumsDesdeCitaGuardada(cita) {
  const nums = [];

  if (Array.isArray(cita.segmentos) && cita.segmentos.length) {
    cita.segmentos.forEach(seg => {
      const d = Number(seg.desde || 0);
      const h = Number(seg.hasta || 0) || d;
      for (let n = d; n <= h; n++) nums.push(n);
    });
    return [...new Set(nums)].sort((a, b) => a - b);
  }

  const d = Number(cita.versiculoInicio || 0);
  const h = Number(cita.versiculoFin || 0) || d;
  for (let n = d; n <= h; n++) nums.push(n);

  return [...new Set(nums)].sort((a, b) => a - b);
}

async function poblarCardPredicaDesdeDato(card, cita) {
  const libro = cita.libro || "";
  const capitulo = String(cita.capitulo || "");
  const comentario = cita.comentario || cita.nota || "";

  await poblarLibrosPredicaEnCard(card, libro);
  await poblarCapitulosPredicaEnCard(card, libro, capitulo);
  await poblarVersiculosPredicaEnCard(card, libro, capitulo);

  subidosSetSeleccionados(card, subidosNumsDesdeCitaGuardada(cita));
  renderVersiculosPredicaEnCard(card);
  actualizarPreviewPredicaEnCard(card);

  const ta = card.querySelector(".subidosCitaNota");
  if (ta) ta.value = comentario;
}

window.abrirEditarSubido = async function abrirEditarSubido(id) {
  if (!subidosEsAdmin) {
    alert("Solo admin puede editar.");
    return;
  }

  const it = obtenerSubidoPorId(id);
  if (!it) return;

  abrirModalSubidos();
  subidosEditandoId = id;

  const ttl = document.getElementById("subidosModalTitulo");
  setSubidosModalTitulo("Editar subido");
  
  const fecha = document.getElementById("subidosFecha");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const descripcion = document.getElementById("subidosDescripcion");
  const archivo = document.getElementById("subidosArchivo");
  const version = document.getElementById("subidosPredicaVersion");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
  const intro = document.getElementById("subidosPredicaIntro");
  const wrap = document.getElementById("subidosPredicaCitasWrap");

  if (fecha) fecha.value = it.fechaEvento || "";
  if (etiqueta) etiqueta.value = it.etiqueta || "";
  if (descripcion) descripcion.value = it.descripcion || "";
  if (archivo) archivo.value = "";

  const archivoBox = document.getElementById("subidosArchivoActualBox");
  const archivoNombre = document.getElementById("subidosArchivoActualNombre");
  const btnVerArchivo = document.getElementById("btnVerArchivoActualSubido");

  if (archivoBox) archivoBox.style.display = it.url ? "block" : "none";
  if (archivoNombre) archivoNombre.textContent = it.fileName || "Archivo actual guardado";
  if (btnVerArchivo) {
    btnVerArchivo.onclick = () => {
      abrirSubidosVisorArchivo(it.id);
    };
  }

  actualizarPredicaSubidosUI();

  if (esPredicaSubidos(it.etiqueta || "")) {
    if (version) version.value = it.predicaVersion || (obtenerCitasPredicaSubido(it)[0]?.version || "RV1960");
    if (notaFinal) notaFinal.value = it.predicaNotaFinal || it.notaFinalGeneral || "";
    if (intro) intro.value = it.predicaIntroduccion || it.introduccionPredica || "";
    if (wrap) wrap.innerHTML = "";

    const citas = obtenerCitasPredicaSubido(it);

    if (citas.length) {
      for (const cita of citas) {
        const card = await window.subidosAgregarCitaPredica();
        if (card) {
          await poblarCardPredicaDesdeDato(card, cita);
        }
      }
    } else {
      await window.subidosAgregarCitaPredica();
    }
  }
};

function htmlPreviewArchivoSubido(it) {
  const nombre = escaparHtml(it.fileName || "archivo");
  const esImg = (it.mimeType || "").startsWith("image/");
  const esVideo = (it.mimeType || "").startsWith("video/");
  const esAudio = (it.mimeType || "").startsWith("audio/");

  if (!it.url) return "";

  // ✅ Si es prédica, tocar el archivo abre la prédica completa, no el archivo solo.
  const accionAbrir = subidosEsPredicaConContenido(it)
    ? `abrirSubidosVisorPredica('${it.id}')`
    : `abrirSubidosVisorArchivo('${it.id}')`;

  if (esImg) {
    return `
      <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame is-image" title="Abrir">
        <img
          src="${it.url}"
          alt="${nombre}"
          loading="lazy"
          decoding="async"
        >
      </button>
    `;
  }

if (esVideo) {
  return `
    <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame is-video subidos-video-frame" title="Abrir video">
      <video
        src="${it.url}"
        muted
        playsinline
        preload="metadata"
        style="display:block; width:100%; height:100%; object-fit:cover; background:#000;"
      ></video>

      <span class="subidos-video-play">
        <i class="fa-solid fa-circle-play"></i>
      </span>
    </button>
  `;
}

  if (esAudio) {
    return `
      <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame is-audio" title="Abrir">
        <div class="subidos-file-open">
          <i class="fa-solid fa-headphones"></i>
          <span>${nombre}</span>
          <small>Tocar para abrir</small>
        </div>
      </button>
    `;
  }

  return `
    <button type="button" onclick="${accionAbrir}" class="subidos-media-link subidos-media-frame is-file" title="Abrir">
      <div class="subidos-file-open">
        <i class="fa-solid fa-file-lines"></i>
        <span>${nombre}</span>
        <small>Tocar para abrir</small>
      </div>
    </button>
  `;
}

/* =========================================================
   RENDER REUTILIZABLE: CARD DE SUBIDOS / PRÉDICA
   - Lo usa Subidos ahora.
   - Lo va a poder usar Compartidos después sin rehacer la card.
   ========================================================= */

function subidosJs(v = "") {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

function subidosRenderCardHTML(it = {}, opciones = {}) {
  const idReal = String(it.id || "").trim();
  const idJs = subidosJs(idReal);

  const idPrefix = opciones.idPrefix ?? "subido-";
  const domId = opciones.domId ?? `${idPrefix}${idReal}`;

  const mostrarEditar = opciones.mostrarEditar ?? subidosEsAdmin;
  const mostrarBorrarOriginal = opciones.mostrarBorrarOriginal ?? subidosEsAdmin;
  const mostrarAccionesArchivo = opciones.mostrarAccionesArchivo ?? true;

  // ✅ para Compartidos después: podremos pasar otro delete,
  // que borre solo de Compartidos y NO el archivo original.
  const borrarHtmlPersonalizado = opciones.borrarHtml || "";

  const extraFinal = opciones.extraFinal || "";

  const fechaTxt = it.fechaEvento
    ? new Date(it.fechaEvento + "T00:00:00").toLocaleDateString("es-AR")
    : "";

  const color = colorEtiquetaSubidos(it.etiqueta || "");
  const bloquePredica = htmlPredicaBibliaSubido(it);

  const tieneArchivo = !!String(it.url || "").trim();
  const tienePredica = subidosTieneContenidoPredica(it);
  const mostrarAcciones = mostrarAccionesArchivo && !!(tieneArchivo || tienePredica);

  const borrarHtml = borrarHtmlPersonalizado || (mostrarBorrarOriginal ? `
    <button
      type="button"
      class="subidosDangerMini"
      onclick="borrarSubido('${idJs}')"
      title="Borrar"
      style="opacity:.45;"
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  ` : ``);

  return `
    <div
      id="${escaparHtml(domId)}"
      class="subidos-feed-card ${subidosEsPredicaConContenido(it) ? "subidos-card-predica" : ""}"
      data-subido-card-id="${escaparHtml(idReal)}"
    >
      <div class="subidos-feed-head">
        <div class="subidos-feed-left">
          <div class="subidos-feed-badges" style="display:flex; align-items:center; gap:8px; flex-wrap:nowrap;">
            <span class="subidos-badge" style="background:${color.bg}; color:${color.fg};">
              <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
              ${escaparHtml(it.etiqueta || "Subido")}
            </span>

            ${fechaTxt ? `
              <span class="subidos-feed-date" style="white-space:nowrap; flex:0 0 auto;">
                ${fechaTxt}
              </span>
            ` : ``}
          </div>

          ${
            it.descripcion
              ? `<div class="subidos-feed-desc">${escaparHtml(it.descripcion || "")}</div>`
              : ``
          }
        </div>
      </div>

      ${tieneArchivo ? `
        <div class="subidos-media">
          ${htmlPreviewArchivoSubido(it)}
        </div>
      ` : ``}

      ${tienePredica ? bloquePredica : ``}

      <div class="subidos-feed-actions">
        ${
          mostrarAcciones
            ? `
              <button
                type="button"
                data-subidos-download="${escaparHtml(idReal)}"
                onclick="descargarSubido('${idJs}')"
                title="Preparando archivo..."
                disabled
                style="opacity:.45; cursor:wait;"
              >
                <i class="fa-solid fa-download"></i>
              </button>

              <button
                type="button"
                data-subidos-share="${escaparHtml(idReal)}"
                onclick="compartirSubido('${idJs}')"
                title="Preparando archivo..."
                disabled
                style="opacity:.45; cursor:wait;"
              >
                <i class="fa-solid fa-share-nodes"></i>
              </button>
            `
            : ``
        }

        ${
          mostrarEditar
            ? `
              <button type="button" onclick="abrirEditarSubido('${idJs}')" title="Editar">
                <i class="fa-solid fa-pen"></i>
              </button>
            `
            : ``
        }
      </div>

      ${borrarHtml}

      ${extraFinal}
    </div>
  `;
}

// ✅ funciones públicas para que Compartidos pueda reutilizarlas después
window.subidosRenderCardHTML = subidosRenderCardHTML;
window.subidosPrepararArchivoAccion = subidosPrepararArchivoAccion;

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

  feed.innerHTML = subidosItems.map(it => subidosRenderCardHTML(it, {
    idPrefix: "subido-",
    mostrarEditar: subidosEsAdmin,
    mostrarBorrarOriginal: subidosEsAdmin,
    mostrarAccionesArchivo: true
  })).join("");

  subidosPrepararArchivosDelFeed();
}

window.abrirSubidoDesdeCalendario = function abrirSubidoDesdeCalendario(id) {
  if (String(id || "").startsWith("habitual::")) {
    abrirNuevoHabitualDesdeCalendario(id);
    return;
  }

  const it = obtenerSubidoPorId(id);

  if (it) {
    if (subidosEsPredicaConContenido(it)) {
      abrirSubidosVisorPredica(id, "all");
      return;
    }

    if (it.url) {
      abrirSubidosVisorArchivo(id);
      return;
    }
  }

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
    const it = obtenerSubidoPorId(id);

    if (!it) {
      alert("No se encontró el archivo.");
      return;
    }

    // ✅ Video: compartir link, NO archivo pesado
    if (subidosEsVideoItem(it)) {
      await subidosCompartirLinkVideo(it);
      subidosAvisoProceso("Link listo ✅");
      return;
    }

    let file = subidosFileCache.get(id)?.file;

    if (!file) {
      subidosAvisoProceso("El archivo todavía se está preparando.", true);
      file = await subidosPrepararArchivoAccion(id);
    }

    if (!file) {
      alert("El archivo todavía no está listo para compartir. Probá de nuevo en unos segundos.");
      return;
    }

    const titulo = it?.etiqueta || "Archivo";

    // ✅ imágenes / prédicas / archivos chicos: compartir archivo real
    await subidosCompartirFileObligatorio(file, titulo, subidosLinkDetalle(id));

    subidosAvisoProceso("Listo ✅");
  } catch (e) {
    console.error("Error en compartir:", e);

    if (e?.name === "AbortError") {
      subidosAvisoProceso("Acción cancelada");
      return;
    }

    subidosAvisoProceso("No se pudo compartir");
    alert("No se pudo compartir.");
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

  // ✅ prepara archivos reales en memoria para descargar/compartir
  subidosPrepararArchivosDelFeed();
}

let subidosGuardando = false;

async function subidosCrearSharePredicaAlGuardar(id, datosBase) {
  if (!id || !datosBase) return null;

  try {
    const estado = document.getElementById("subidosEstado");
    if (estado) estado.textContent = "Generando imagen para compartir...";

    const blob = await subidosGenerarBlobCardPredica(id, {
      id,
      ...datosBase
    });

    const nombre = subidosNombreSharePredica({
      ...datosBase,
      id
    });

    const file = new File(
      [blob],
      nombre,
      { type: "image/png" }
    );

    if (estado) estado.textContent = "Subiendo imagen preparada...";

    const subida = await subirArchivoAR2DesdeWeb(file, "subidos-share");

    if (!subida?.url) return null;

    return {
      shareUrl: subida.url,
      shareR2Key: subida.key || "",
      shareMimeType: "image/png",
      shareFileName: nombre
    };
  } catch (e) {
    console.warn("No pude crear PNG preparado de prédica:", e);
    return null;
  }
}

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

    const actual = subidosEditandoId ? (obtenerSubidoPorId(subidosEditandoId) || {}) : {};
    const file = inpFile?.files?.[0] || null;

    const fechaEvento = (inpFecha?.value || "").trim();
    const etiqueta = (inpEtiqueta?.value || "").trim();
    const descripcion = (inpDesc?.value || "").trim();
    const esPredica = esPredicaSubidos(etiqueta);

    const permiteSinArchivo = ["racimo", "oracion"].includes(
  normalizarEtiquetaSubidos(etiqueta)
);
    
    if (!fechaEvento) {
      alert("Completá la fecha.");
      return;
    }

    if (!etiqueta) {
      alert("Elegí una etiqueta.");
      return;
    }

if (!file && !esPredica && !actual.url && !permiteSinArchivo) {
      alert("Elegí un archivo.");
      return;
    }

    let datosPredica = {
      version: "",
      introduccion: "",
      citas: [],
      notaFinalGeneral: ""
    };

    if (esPredica) {
      datosPredica = recogerDatosPredicaSubidos();
    }

    subidosGuardando = true;
    if (btnGuardar) btnGuardar.disabled = true;
    if (estado) estado.textContent = file ? "Subiendo archivo..." : "Guardando...";

    const ts = Date.now();

let url = actual.url || "";
let r2Key = actual.r2Key || "";
let mimeType = actual.mimeType || "";
let fileName = actual.fileName || "";
let sizeBytes = Number(actual.sizeBytes || 0);
let subidaDirectaVideo = !!actual.subidaDirectaVideo;

if (file) {
  const esVideo = subidosEsVideoFile(file);

  if (estado) {
    estado.textContent = esVideo
      ? `Preparando video (${subidosFormatoMB(file.size)} MB)...`
      : "Subiendo archivo...";
  }

  const subida = esVideo
    ? await subirVideoR2DirectoSubidos(file, estado)
    : await subirArchivoAR2DesdeWeb(file, "subidos");

  url = subida?.url || "";
  r2Key = subida?.key || "";
  mimeType = subida?.contentType || file?.type || "";
  fileName = subida?.fileName || file?.name || "";
  sizeBytes = Number(subida?.sizeBytes || file?.size || 0);
  subidaDirectaVideo = !!subida?.subidaDirectaVideo;
}

    const destinoRef = subidosEditandoId
      ? ref(db, `subidosIglesia/${subidosEditandoId}`)
      : push(ref(db, "subidosIglesia"));

    const idFinal = destinoRef.key;

    // ✅ cuando guardo/edito, borro cache viejo para no compartir imagen anterior
    subidosFileCache.delete(idFinal);
    subidosFilePreparando.delete(idFinal);

    const datosBase = {
      fecha: actual.fecha || ts,
      fechaEdicion: subidosEditandoId ? ts : "",
      fechaEvento,
      etiqueta,
      descripcion,
      url,
      r2Key,
mimeType,
fileName,
sizeBytes,
subidaDirectaVideo,
uidCreador: actual.uidCreador || subidosUID,
esEventoSinArchivo: !url && permiteSinArchivo && !esPredica,
esPredica,
      predicaVersion: esPredica ? datosPredica.version : "",
      predicaIntroduccion: esPredica ? datosPredica.introduccion : "",
      predicaCitas: esPredica ? datosPredica.citas : [],
      predicaNotaFinal: esPredica ? datosPredica.notaFinalGeneral : "",

      // ✅ para acciones reales de archivo
      shareUrl: !esPredica ? url : "",
      shareR2Key: !esPredica ? r2Key : "",
      shareMimeType: !esPredica ? mimeType : "",
      shareFileName: !esPredica ? fileName : ""
    };

    await set(destinoRef, datosBase);

    // ✅ si es prédica, genero PNG final una sola vez y lo guardo en R2
    if (esPredica) {
      const share = await subidosCrearSharePredicaAlGuardar(idFinal, datosBase);

      if (share?.shareUrl) {
        await set(destinoRef, {
          ...datosBase,
          ...share
        });

        // ✅ fuerza a preparar el archivo nuevo, no el anterior
        subidosFileCache.delete(idFinal);
        subidosFilePreparando.delete(idFinal);
      }
    }

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
    alert("No se pudo guardar el subido.\n\n" + (e?.message || e));
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
  const selVersionPredica = document.getElementById("subidosPredicaVersion");

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

  if (selVersionPredica && !selVersionPredica.__versionHook) {
    selVersionPredica.__versionHook = true;
    selVersionPredica.addEventListener("change", () => {
      recargarVersionPredicaCards();
    });
  }

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

  // ✅ intentar abrir desde hash una vez que ya existen los datos
  setTimeout(subidosAbrirDesdeHash, 0);
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

  setTimeout(subidosAbrirDesdeHash, 600);
});

window.addEventListener("hashchange", () => {
  subidosAbrirDesdeHash();
});
