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
let subidosEditandoId = null;

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
  return escaparHtml(String(txt || "")).replace(/\n/g, "<br>");
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
    citas,
    notaFinalGeneral: notaFinal
  };
}

function obtenerCitasPredicaSubido(it) {
  if (Array.isArray(it.predicaCitas)) return it.predicaCitas;
  if (Array.isArray(it.citasPredica)) return it.citasPredica;
  return [];
}

function htmlPredicaBibliaSubido(it) {
  const citas = obtenerCitasPredicaSubido(it);
  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();

  if (!citas.length && !notaFinal) return "";

  const filas = citas.map((c, i) => `
    <button
      type="button"
      onclick="event.stopPropagation(); abrirSubidosVisorPredica('${it.id}', '${i}')"
      style="
        width:100%;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:8px 10px;
        border:1px solid #d8eef9;
        background:#ffffff;
        border-radius:12px;
        cursor:pointer;
        font-family:'Lora',serif;
        font-size:15px;
        font-weight:700;
        text-align:left;
      "
      title="Abrir esta cita"
    >
      <span>${escaparHtml(c.referencia || "")}</span>
      <i class="fa-solid fa-caret-down"></i>
    </button>
  `);

  if (notaFinal) {
    filas.push(`
      <button
        type="button"
        onclick="event.stopPropagation(); abrirSubidosVisorPredica('${it.id}', 'nota')"
        style="
          width:100%;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 10px;
          border:1px solid #d8eef9;
          background:#ffffff;
          border-radius:12px;
          cursor:pointer;
          font-family:'Lora',serif;
          font-size:15px;
          font-weight:700;
          text-align:left;
        "
        title="Abrir nota"
      >
        <span>Nota</span>
        <i class="fa-solid fa-caret-down"></i>
      </button>
    `);
  }

  return `
    <div
      class="subidos-predica-resumen"
      onclick="abrirSubidosVisorPredica('${it.id}')"
      style="display:flex; flex-direction:column; gap:8px; cursor:pointer;"
      title="Abrir detalle completo"
    >
      ${filas.join("")}
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
  const ttl = document.getElementById("subidosModalTitulo");
  const archivoBox = document.getElementById("subidosArchivoActualBox");
  const archivoNombre = document.getElementById("subidosArchivoActualNombre");
  const btnVerArchivo = document.getElementById("btnVerArchivoActualSubido");

  subidosEditandoId = null;

  if (ttl) ttl.textContent = "📤 Nuevo subido";
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
  if (ttl) ttl.textContent = "📤 Nuevo subido";

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

function obtenerSubidoPorId(id) {
  return subidosItems.find(x => x.id === id) || null;
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

window.cerrarModalSubidosVisor = function cerrarModalSubidosVisor() {
  const m = document.getElementById("modalSubidosVisor");
  const body = document.getElementById("subidosVisorBody");
  const ttl = document.getElementById("subidosVisorTitulo");
  if (!m) return;

  if (body) body.innerHTML = "";
  if (ttl) ttl.textContent = "Vista previa";

  m.style.display = "none";
  m.setAttribute("aria-hidden", "true");
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
  url.hash = `subido=${encodeURIComponent(id)}`;
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

        const timer = setTimeout(fin, 4000);

        img.addEventListener("load", fin, { once: true });
        img.addEventListener("error", fin, { once: true });
      });
    })
  );
}

function subidosPrepararCloneParaExport(clone) {
  clone.id = "subidosExportCardReal";
  clone.style.width = "420px";
  clone.style.maxWidth = "420px";
  clone.style.margin = "0";
  clone.style.transform = "none";
  clone.style.boxSizing = "border-box";

  // sacar acciones de abajo
  clone.querySelectorAll(".subidos-feed-actions").forEach(el => el.remove());
  clone.querySelectorAll(".subidosDangerMini").forEach(el => el.remove());

  // si hubiera cosas de focus/animaciones
  clone.classList.remove("subidos-focus");

  // convertir botones clickeables visuales en elementos neutros
  clone.querySelectorAll("button").forEach(btn => {
    btn.blur();
  });

  // asegurar que el preview del archivo se vea bien
  clone.querySelectorAll(".subidos-media-frame").forEach(el => {
    el.style.cursor = "default";
  });

clone.querySelectorAll("img").forEach(img => {
  const src = img.currentSrc || img.getAttribute("src") || "";

  img.removeAttribute("loading");
  img.loading = "eager";
  img.decoding = "sync";

  if (src) img.src = src;

  img.crossOrigin = "anonymous";
  img.referrerPolicy = "no-referrer";

  img.style.display = "block";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";
});

  // por si la card tiene resumen de prédica
  clone.querySelectorAll(".subidos-predica-resumen").forEach(el => {
    el.style.cursor = "default";
  });

  return clone;
}

async function subidosGenerarBlobCardPredica(id) {
  const original = document.getElementById(`subido-${id}`);
  if (!original) throw new Error("No encontré la card a exportar.");

  const stage = document.getElementById("subidosExportStage");
  if (!stage) throw new Error("Falta #subidosExportStage en el HTML.");

  stage.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.padding = "24px";
  wrap.style.display = "inline-block";
  wrap.style.background = "transparent";

  const clone = original.cloneNode(true);
  subidosPrepararCloneParaExport(clone);

  wrap.appendChild(clone);
  stage.appendChild(wrap);

  await subidosEsperarImagenes(clone);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

let canvas;
try {
  canvas = await html2canvas(clone, {
    backgroundColor: null,
    scale: 2,
    useCORS: true
  });
} catch (e) {
  stage.innerHTML = "";
  throw new Error("No pude generar la imagen de la card. Lo más probable es un bloqueo CORS del archivo adjunto.");
}

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

  stage.innerHTML = "";

  if (!blob) throw new Error("No se pudo generar la imagen.");
  return blob;
}

function subidosEsPredicaConContenido(it) {
  return esPredicaSubidos(it?.etiqueta || "") && subidosTieneContenidoPredica(it);
}

function subidosAbrirDesdeHash() {
  const hash = String(window.location.hash || "");
  if (!hash.startsWith("#subido=")) return;

  const id = decodeURIComponent(hash.replace("#subido=", "").trim());
  if (!id) return;

  const it = obtenerSubidoPorId(id);
  if (!it) return;

  // llevar a Iglesia > Subidos
  if (typeof window.irA === "function") window.irA("iglesia");
  if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("subidos");

  setTimeout(() => {
    if (subidosEsPredicaConContenido(it)) {
      abrirSubidosVisorPredica(id);
      return;
    }

    if (it.url) {
      abrirSubidosVisorArchivo(id);
    }
  }, 120);
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
  const notaFinal = String(it.predicaNotaFinal || it.notaFinalGeneral || "").trim();

  const bloques = [];

  citas.forEach((c, i) => {
    const bodyId = `subidosPredicaGrande-${it.id}-${i}`;
    const abierto = String(abrirClave) === String(i);

    bloques.push(`
      <div style="border:1px solid #d8eef9; background:#ffffff; border-radius:14px; overflow:hidden; margin-bottom:10px;">
        <button
          type="button"
          onclick="subidosToggleDetallePredica('${bodyId}')"
          style="
            width:100%;
            border:none;
            background:#f6fcff;
            padding:12px;
            text-align:left;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            cursor:pointer;
            font-family:'Lora',serif;
            font-size:15px;
            font-weight:700;
          "
        >
          <span>${escaparHtml(c.referencia || "")}</span>
          <i class="fa-solid ${abierto ? "fa-caret-up" : "fa-caret-down"}" data-toggle-icon="${bodyId}"></i>
        </button>

        <div
          id="${bodyId}"
          style="
            display:${abierto ? "block" : "none"};
            max-height:320px;
            overflow:auto;
            padding:12px;
            border-top:1px solid #e7f2f8;
            background:#fff;
          "
        >
          <div style="white-space:pre-wrap; line-height:1.38; font-size:15px; font-family:'Lora',serif;">
            ${subidosTextoHtml(c.texto || "")}
          </div>

          ${String(c.comentario || c.nota || "").trim() ? `
            <div style="margin-top:10px; padding-top:10px; border-top:1px solid #eef6fb;">
              <div style="font-family:'Lora',serif; font-weight:700; font-size:15px; margin-bottom:6px;">
                Comentario
              </div>
              <div style="white-space:pre-wrap; line-height:1.38; font-size:15px; font-family:'Lora',serif;">
                ${subidosTextoHtml(c.comentario || c.nota || "")}
              </div>
            </div>
          ` : ``}
        </div>
      </div>
    `);
  });

  if (notaFinal) {
    const bodyId = `subidosPredicaGrandeNota-${it.id}`;
    const abierto = String(abrirClave) === "nota";

    bloques.push(`
      <div style="border:1px solid #d8eef9; background:#ffffff; border-radius:14px; overflow:hidden;">
        <button
          type="button"
          onclick="subidosToggleDetallePredica('${bodyId}')"
          style="
            width:100%;
            border:none;
            background:#f6fcff;
            padding:12px;
            text-align:left;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:10px;
            cursor:pointer;
            font-family:'Lora',serif;
            font-size:15px;
            font-weight:700;
          "
        >
          <span>Nota</span>
          <i class="fa-solid ${abierto ? "fa-caret-up" : "fa-caret-down"}" data-toggle-icon="${bodyId}"></i>
        </button>

        <div
          id="${bodyId}"
          style="
            display:${abierto ? "block" : "none"};
            max-height:320px;
            overflow:auto;
            padding:12px;
            border-top:1px solid #e7f2f8;
            background:#fff;
          "
        >
          <div style="white-space:pre-wrap; line-height:1.38; font-size:15px; font-family:'Lora',serif;">
            ${subidosTextoHtml(notaFinal)}
          </div>
        </div>
      </div>
    `);
  }

  return `
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${it.url ? `
        <div>
          ${htmlArchivoGrandePredica(it)}
        </div>
      ` : ``}

      ${it.descripcion ? `
        <div style="font-family:'Lora',serif; font-weight:700; font-size:20px;">
          ${escaparHtml(it.descripcion)}
        </div>
      ` : ``}

      ${bloques.join("")}
    </div>
  `;
}

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

async function descargarArchivoRemoto(url, nombre = "archivo") {
  const r = await fetch(url, { mode: "cors" });
  if (!r.ok) {
    throw new Error("No pude descargar el archivo remoto.");
  }

  const blob = await r.blob();
  const obj = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = obj;
  a.download = nombre || "archivo";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(obj), 1200);
}

window.descargarSubido = async function descargarSubido(id) {
  try {
    const it = obtenerSubidoPorId(id);
    if (!it) return;

    // prédica con contenido => descargar card como PNG
    if (subidosEsPredicaConContenido(it)) {
      const blob = await subidosGenerarBlobCardPredica(id);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${(it.etiqueta || "predica").toLowerCase()}-${it.fechaEvento || Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1200);
      return;
    }

    // resto de archivos => descargar blob real, no abrir link
    if (it.url) {
      await descargarArchivoRemoto(it.url, it.fileName || "archivo");
    }
  } catch (e) {
    console.error("Error descargando:", e);
    alert("No se pudo descargar.");
  }
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
  if (ttl) ttl.textContent = "✏️ Editar subido";

  const fecha = document.getElementById("subidosFecha");
  const etiqueta = document.getElementById("subidosEtiqueta");
  const descripcion = document.getElementById("subidosDescripcion");
  const archivo = document.getElementById("subidosArchivo");
  const version = document.getElementById("subidosPredicaVersion");
  const notaFinal = document.getElementById("subidosPredicaNotaFinal");
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

  if (esImg) {
    return `
      <button type="button" onclick="abrirSubidosVisorArchivo('${it.id}')" class="subidos-media-link subidos-media-frame is-image" title="Abrir archivo">
        <img src="${it.url}" alt="${nombre}" loading="lazy">
      </button>
    `;
  }

  if (esVideo) {
    return `
      <button type="button" onclick="abrirSubidosVisorArchivo('${it.id}')" class="subidos-media-link subidos-media-frame is-video" title="Abrir video">
        <video src="${it.url}" muted playsinline preload="metadata"></video>
      </button>
    `;
  }

  if (esAudio) {
    return `
      <button type="button" onclick="abrirSubidosVisorArchivo('${it.id}')" class="subidos-media-link subidos-media-frame is-audio" title="Abrir audio">
        <div class="subidos-file-open">
          <i class="fa-solid fa-headphones"></i>
          <span>${nombre}</span>
          <small>Tocar para abrir</small>
        </div>
      </button>
    `;
  }

  return `
    <button type="button" onclick="abrirSubidosVisorArchivo('${it.id}')" class="subidos-media-link subidos-media-frame is-file" title="Abrir archivo">
      <div class="subidos-file-open">
        <i class="fa-solid fa-file-lines"></i>
        <span>${nombre}</span>
        <small>Tocar para abrir</small>
      </div>
    </button>
  `;
}

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

    const color = colorEtiquetaSubidos(it.etiqueta || "");
    const bloquePredica = htmlPredicaBibliaSubido(it);
    const tieneArchivo = !!String(it.url || "").trim();
    const tienePredica = subidosTieneContenidoPredica(it);
    const mostrarAcciones = !!(tieneArchivo || tienePredica);

    return `
      <div id="subido-${it.id}" class="subidos-feed-card">
        <div class="subidos-feed-head">
          <div class="subidos-feed-left">
            <div class="subidos-feed-badges">
              <span class="subidos-badge" style="background:${color.bg}; color:${color.fg};">
                <i class="fa-solid ${iconoSegunTipo(it.mimeType || "")}"></i>
                ${escaparHtml(it.etiqueta || "Subido")}
              </span>
            </div>

            <div class="subidos-feed-date">${fechaTxt}</div>

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
                <button type="button" onclick="descargarSubido('${it.id}')" title="Descargar">
                  <i class="fa-solid fa-download"></i>
                </button>

                <button type="button" onclick="compartirSubido('${it.id}')" title="Compartir">
                  <i class="fa-solid fa-share-nodes"></i>
                </button>
              `
              : ``
          }

          ${
            subidosEsAdmin
              ? `
                <button type="button" onclick="abrirEditarSubido('${it.id}')" title="Editar">
                  <i class="fa-solid fa-pen"></i>
                </button>
              `
              : ``
          }
        </div>

        ${
          subidosEsAdmin
            ? `
              <button type="button" class="subidosDangerMini" onclick="borrarSubido('${it.id}')" title="Borrar">
                <i class="fa-solid fa-trash"></i>
              </button>
            `
            : ``
        }
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
    const it = obtenerSubidoPorId(id);
    if (!it) return;

    const link = subidosLinkDetalle(id);

    // si es prédica con contenido, compartimos la CARD COMO IMAGEN
    if (subidosEsPredicaConContenido(it)) {
      const blob = await subidosGenerarBlobCardPredica(id);

      const file = new File(
        [blob],
        `${(it.etiqueta || "predica").toLowerCase()}-${it.fechaEvento || Date.now()}.png`,
        { type: "image/png" }
      );

      // ✅ SOLO EL LINK
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: link
        });
        return;
      }

      // fallback
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
        alert("Tu navegador no pudo compartir la imagen directamente. Copié el link de detalle.");
        return;
      }

      prompt("Copiá este link:", link);
      return;
    }

    // resto de subidos normales
    if (navigator.share) {
      const payload = {
        title: it.etiqueta || "Subido",
        text: it.url ? link : (it.descripcion || link)
      };
      if (it.url) payload.url = it.url;
      await navigator.share(payload);
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      alert("Link copiado.");
      return;
    }

    prompt("Copiá este link:", link);
  } catch (e) {
    console.error("Error compartiendo:", e);
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

    const actual = subidosEditandoId ? (obtenerSubidoPorId(subidosEditandoId) || {}) : {};
    const file = inpFile?.files?.[0] || null;
    const fechaEvento = (inpFecha?.value || "").trim();
    const etiqueta = (inpEtiqueta?.value || "").trim();
    const descripcion = (inpDesc?.value || "").trim();
    const esPredica = esPredicaSubidos(etiqueta);

    if (!fechaEvento) {
      alert("Completá la fecha.");
      return;
    }

    if (!etiqueta) {
      alert("Elegí una etiqueta.");
      return;
    }

    if (!file && !esPredica && !actual.url) {
      alert("Elegí un archivo.");
      return;
    }

    let datosPredica = {
      version: "",
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

    if (file) {
      const subida = await subirArchivoAR2DesdeWeb(file, "subidos");
      url = subida?.url || "";
      r2Key = subida?.key || "";
      mimeType = file?.type || "";
      fileName = file?.name || "";
    }

    const destinoRef = subidosEditandoId
      ? ref(db, `subidosIglesia/${subidosEditandoId}`)
      : push(ref(db, "subidosIglesia"));

    await set(destinoRef, {
      fecha: actual.fecha || ts,
      fechaEdicion: subidosEditandoId ? ts : "",
      fechaEvento,
      etiqueta,
      descripcion,
      url,
      r2Key,
      mimeType,
      fileName,
      uidCreador: actual.uidCreador || subidosUID,
      esPredica,
      predicaVersion: esPredica ? datosPredica.version : "",
      predicaCitas: esPredica ? datosPredica.citas : [],
      predicaNotaFinal: esPredica ? datosPredica.notaFinalGeneral : ""
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
