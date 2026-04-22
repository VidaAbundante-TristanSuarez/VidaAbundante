// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  get,
  push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a",
 };

// ================= ☁️ R2 =================
const R2_UPLOAD_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/subirImagenR2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

window.__FB = { db };
window.__FB_API = { ref, set, remove, onValue, get, push };

// ================= ESTADO GLOBAL =================
let uid = null;
let bibliaData = [];
let bibliaDataRV = [];
let bibliaDataNTV = [];
let versionActual = "RV1960"; // "RV1960" | "NTV"

let marcados = {};
let size = 18;
let fuenteActual = "Arial";
let colorActual = "#fff3b0"; // 💛 amarillo por default
let resaltadorBloqueado = true; // 🔒 nuevo estado
window.colorActual = colorActual;
window.resaltadorBloqueado = resaltadorBloqueado;

// ================= 🎨 CONFIG RESALTADORES PERSONALIZABLES =================
const DEFAULT_RESALTADORES = [
  { color: "#ffd6e8", forma: "circle" },
  { color: "#fff3b0", forma: "circle" },
  { color: "#caffd1", forma: "circle" },
  { color: "#ffc9c9", forma: "circle" },
  { color: "#ccecff", forma: "circle" },
  { color: "#e6c9ff", forma: "circle" },
  { color: "#ffe2c9", forma: "circle" },
  { color: "#efefef", forma: "circle" }
];

let resaltadoresConfig = cargarResaltadoresConfig();

async function cargarResaltadoresConfigFirebase() {
  try {
    if (!uid) return null;

    const snap = await get(ref(db, `usuariosConfig/${uid}/resaltadores`));
    const data = snap.val();

    if (Array.isArray(data) && data.length === 8) {
      return data.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));
    }

    return null;
  } catch (e) {
    console.warn("No pude leer resaltadores desde Firebase:", e);
    return null;
  }
}

async function guardarResaltadoresConfigFirebase() {
  try {
    if (!uid) return;
    await set(ref(db, `usuariosConfig/${uid}/resaltadores`), resaltadoresConfig);
  } catch (e) {
    console.warn("No pude guardar resaltadores en Firebase:", e);
  }
}

async function sincronizarResaltadoresUsuario() {
  try {
    // 1) Firebase primero
    const remotos = await cargarResaltadoresConfigFirebase();

    if (Array.isArray(remotos) && remotos.length === 8) {
      resaltadoresConfig = remotos;
      guardarResaltadoresConfigLocal(); // backup local
      return;
    }

    // 2) si no había en Firebase, subimos lo local/default actual
    guardarResaltadoresConfigLocal();
    await guardarResaltadoresConfigFirebase();

  } catch (e) {
    console.warn("No pude sincronizar resaltadores del usuario:", e);
  }
}

function cargarResaltadoresConfig() {
  try {
    const raw = localStorage.getItem("resaltadoresConfig");
    const parsed = raw ? JSON.parse(raw) : null;

    if (Array.isArray(parsed) && parsed.length === 8) {
      return parsed.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));
    }
  } catch (e) {
    console.warn("No pude leer resaltadoresConfig:", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_RESALTADORES));
}

function guardarResaltadoresConfigLocal() {
  try {
    localStorage.setItem("resaltadoresConfig", JSON.stringify(resaltadoresConfig));
  } catch (e) {
    console.warn("No pude guardar resaltadoresConfig:", e);
  }
}

function obtenerConfigResaltadorActual() {
  return (
    resaltadoresConfig.find(x => x.color === colorActual) ||
    resaltadoresConfig[0] ||
    { color: "#fff3b0", forma: "circle" }
  );
}

function crearNodoFormaResaltador(color, forma = "circle") {
  const span = document.createElement("span");
  span.className = `marker-shape ${forma === "heart" ? "heart" : "circle"}`;
  span.style.setProperty("--marker-color", color || "#fff3b0");
  return span;
}

async function cargarResaltadoresUsuario() {
  if (!uid) return;

  try {
    const snap = await get(ref(db, `usuariosConfig/${uid}/resaltadores`));

    const data = snap.val();

    if (Array.isArray(data) && data.length === 8) {
      resaltadoresConfig = data.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));

      guardarResaltadoresConfigLocal();
      initResaltadorCompacto();
    }

  } catch(e) {
    console.warn("No pude cargar resaltadores del usuario:", e);
  }
}

async function guardarResaltadoresUsuario() {
  if (!uid) return;

  try {
    await set(ref(db, `usuariosConfig/${uid}/resaltadores`), resaltadoresConfig);
  } catch (e) {
    console.warn("No pude guardar resaltadores del usuario:", e);
  }
}

// ================= MARCADORES (NUEVO LIMPIO) =================
let modoMarcador = false;
let seleccionMarcador = {};         // {idVersiculo:true}
let marcadores = {};                // cache firebase

// ================= ✅ INDICE DE NOTAS (para mostrar pluma) =================
window.notasBibliaIndex = window.notasBibliaIndex || {};
window.notasABCIndex    = window.notasABCIndex || {};

// (si tu código usa las variables locales, podés dejar alias)
let notasBibliaIndex = window.notasBibliaIndex;
let notasABCIndex    = window.notasABCIndex;

let ultimoMarcadorAplicado = null;  // resaltado al volver (opcional)
// ✅ cuando edito desde "Mi Panel", guardo acá la info original del marcador
window.__editMarcadorBase = null;  // {libro, capitulo, versiculos, ref}

// ================= CONTEXTO MODAL MARCADORES =================
window.__marcadorCtx = {
  origen: "biblia",   // "biblia" | "abc"
  abcEditId: null
};

window.setMarcadorCtx = function(origen, extra = {}) {
  window.__marcadorCtx = {
    origen: origen || "biblia",
    abcEditId: null,
    ...extra
  };
};

window.getMarcadorCtx = function() {
  return window.__marcadorCtx || { origen: "biblia", abcEditId: null };
};

// ========= Modo Imagen
let modoImagen = false;
let seleccionImagen = {};
let fondoFinal = null;
let fondoFinalBlobUrl = null; // ✅ fondo seguro para html2canvas
let creandoNotaLibre = false; // ✅ estado: nota sin versículo

// ✅ NUEVO: modal de imagen desde Biblia o desde Mi Panel
let origenModalImagen = "biblia";   // "biblia" | "panel"
let modoImagenLibre = false;        // true cuando el texto viene de un textarea libre
let textoLibreImagen = "";          // texto escrito manualmente en Mi Panel
let formatoImagenActual = "post"; // "post" | "story"

// ================= AUTO TAMAÑO PREVIEW =================
let userSetFontSize = false; // si el usuario tocó tamaño (slider o + -), queda manual hasta que cambie el texto

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

// ================= 🧠 MEMORIA SCROLL CAPÍTULOS =================
let scrollCapituloAnterior = 0;

// ================= 💾 ESTADO DE NAVEGACIÓN BIBLIA =================
const LS_BIBLIA_ESTADO = "va_biblia_estado_v1";

function obtenerSeccionActual() {
  if (document.body.classList.contains("en-iglesia")) return "iglesia";
  if (document.body.classList.contains("en-panel")) return "panel";
  if (document.body.classList.contains("en-compartidos")) return "compartidos";
  return "biblia";
}

function guardarEstadoBiblia(extra = {}) {
  try {
    const estado = {
      seccion: obtenerSeccionActual(),
      version: versionActual || "RV1960",
      libro: libroSel?.value || "",
      capitulo: Number(capSel?.value || 1),
      scrollBiblia: window.scrollY || document.documentElement.scrollTop || 0,
      modoImagen: !!modoImagen,
      ts: Date.now(),
      ...extra
    };
    localStorage.setItem(LS_BIBLIA_ESTADO, JSON.stringify(estado));
  } catch (e) {
    console.warn("No pude guardar estado Biblia:", e);
  }
}

function leerEstadoBiblia() {
  try {
    const raw = localStorage.getItem(LS_BIBLIA_ESTADO);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("No pude leer estado Biblia:", e);
    return null;
  }
}

function irArribaBiblia() {
  const primerVersiculo = document.querySelector("#texto .versiculo");
  const barra = document.getElementById("barraTituloBiblia");

  if (primerVersiculo) {
    const rect = primerVersiculo.getBoundingClientRect();
    const barraH = barra ? barra.offsetHeight : 0;

    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - barraH - 6),
      behavior: "auto"
    });
    return;
  }

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}

function restaurarEstadoBibliaInicial() {
  const estado = leerEstadoBiblia();
  if (!estado) return;

  // versión
  if (estado.version === "NTV") {
    versionActual = "NTV";
    bibliaData = bibliaDataNTV;
  } else {
    versionActual = "RV1960";
    bibliaData = bibliaDataRV;
  }

  // libro
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));

  if (estado.libro && libros.includes(estado.libro)) {
    libroSel.value = estado.libro;
  }

  // capítulos
  cargarCapitulos({ capituloPreferido: estado.capitulo, irArriba: false, guardar: false });

  // restaurar sección después de que esté todo armado
  setTimeout(() => {
    if (estado.seccion && typeof window.irA === "function") {
      try { window.irA(estado.seccion); } catch(e) {}
    }

    // restaurar scroll solo si estaba en biblia
    if (estado.seccion === "biblia") {
      setTimeout(() => {
        window.scrollTo({ top: Number(estado.scrollBiblia || 0), behavior: "auto" });
      }, 60);
    }
  }, 0);
}

// ================= REGISTRAR USUARIO ===================================
async function registrarUsuarioActual(user) {
  try {
    if (!user?.uid) return;

    const nombre =
      user.displayName ||
      user.email?.split("@")[0] ||
      "Sin nombre";

    const data = {
      uid: user.uid,
      nombre: nombre,
      email: user.email || "",
      ultimoAcceso: Date.now()
    };

    const snap = await get(ref(db, `usuarios/${user.uid}`));
    const actual = snap.val() || {};

    await set(ref(db, `usuarios/${user.uid}`), {
      uid: user.uid,
      nombre: actual.nombre || data.nombre,
      email: actual.email || data.email,
      ultimoAcceso: Date.now()
    });
  } catch (e) {
    console.warn("No pude registrar usuario actual:", e);
  }
}

window.actualizarPermisosUI = function () {
  const esAdmin = !!window.__ES_ADMIN;
  const esColaborador = !!window.__ES_COLABORADOR;
  const puedeVerRecursos = esAdmin || esColaborador;

  // si tenés botón/tab principal de Recursos, agregale este id en HTML:
  // id="btnTabRecursos"
  const btnTabRecursos = document.getElementById("btnTabRecursos");
  if (btnTabRecursos) {
    btnTabRecursos.style.display = puedeVerRecursos ? "inline-flex" : "none";
  }

  // si existe la sección ya abierta, la escondemos si no tiene permiso
  const wrapRecursos = document.getElementById("iglesia-recursos");
  if (wrapRecursos && !puedeVerRecursos) {
    wrapRecursos.style.display = "none";
  }

  // botones ya existentes que dependían de admin
  const btnDevNuevo = document.getElementById("btnDevNuevo");
  if (btnDevNuevo) btnDevNuevo.style.display = esAdmin ? "inline-flex" : "none";

  const btnSubidoNuevo = document.getElementById("btnSubidoNuevo");
  if (btnSubidoNuevo) btnSubidoNuevo.style.display = esAdmin ? "inline-flex" : "none";
};

// ================= AUTH =====================================
onAuthStateChanged(auth, async user => {
  uid = user ? user.uid : null;

  window.__UID = uid;

  if (!uid) {
    window.location.href = "login.html";
    return;
  }

  // ✅ registrar automáticamente al usuario que entró
  await registrarUsuarioActual(user);

  // ✅ roles globales
  window.__ES_ADMIN = false;
  window.__ES_COLABORADOR = false;

  // ✅ cargar paleta de resaltadores del usuario
  sincronizarResaltadoresUsuario().then(() => {
    try { initResaltadorCompacto?.(); } catch(e){}
    try { actualizarUICandadoResaltador?.(); } catch(e){}
  });

  // ✅ admin
  onValue(ref(db, "admins/" + uid), (s) => {
    window.__ES_ADMIN = !!s.val();
    actualizarPermisosUI();
  });

  // ✅ colaborador
  onValue(ref(db, "colaboradores/" + uid), (s) => {
    window.__ES_COLABORADOR = !!s.val();
    actualizarPermisosUI();
  });

onValue(ref(db, "marcados/" + uid), s => {
  marcados = s.val() || {};

  if (obtenerSeccionActual() === "biblia") {
    mostrarTexto({ guardar: false });
  }
});

  // ✅ Cargar imágenes del panel (personal)
  onValue(ref(db, "panelImagenesPersonal/" + uid), s => {
    const data = s.val() || {};
    renderPanelImagenes(data);
  });

  // ✅ Cargar marcadores
  onValue(ref(db, "marcadores/" + uid), s => {
    marcadores = s.val() || {};

    window.notasBibliaIndex = {};
    window.notasBibliaPluma = {};
    window.notasABCIndex = {};

    notasBibliaIndex = window.notasBibliaIndex;
    notasBibliaPluma = window.notasBibliaPluma;
    notasABCIndex = window.notasABCIndex;

    Object.entries(marcadores || {}).forEach(([idMarcador, m]) => {
      const tieneNota = !!(m?.nota && String(m.nota).trim());
      if (!tieneNota) return;

      if (m?.origen === "abc") {
        const bid = m?.abcBidLast || m?.abcBid || null;
        if (bid) notasABCIndex[bid] = true;
        return;
      }

      const libro = m?.libro;
      const cap = Number(m?.capitulo);
      const vers = Array.isArray(m?.versiculos) ? m.versiculos : [];

      if (!libro || !cap || !vers.length) return;

      const nums = vers.map(vn => Number(vn)).filter(n => !isNaN(n));
      nums.forEach(n => {
        notasBibliaIndex[`${libro}_${cap}_${n}`] = true;
      });

      const last = Math.max(...nums);
      if (isFinite(last)) {
        const idVersiculo = `${libro}_${cap}_${last}`;
        notasBibliaPluma[idVersiculo] = idMarcador;
      }
    });

    const panelMarcadores = document.getElementById("panel-marcadores");
    if (panelMarcadores && panelMarcadores.offsetParent !== null) {
      renderPanelMarcadores();
    }

    if (obtenerSeccionActual() === "biblia") {
  mostrarTexto({ guardar: false });
}

    if (typeof abcMarcarSeleccionUI === "function") {
      abcMarcarSeleccionUI();
    }
  });
});

// ================= DOM (script al final del body)  =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const loginModal = document.getElementById("loginModal");

// ================= 🔎 HELPERS FILTROS BIBLIA =================
let filtroBibliaBackup = null;

function normalizarTextoFiltro(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getLibrosUnicosActuales() {
  return [...new Set(bibliaData.map(v => v.Libro))];
}

function reconstruirCapitulosParaLibro(libro, capituloPreferido = 1) {
  if (!capSel) return;

  const caps = [...new Set(
    bibliaData
      .filter(v => v.Libro === libro)
      .map(v => Number(v.Capitulo))
  )].sort((a, b) => a - b);

  capSel.innerHTML = "";

  caps.forEach(c => {
    capSel.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const destino = caps.includes(Number(capituloPreferido))
    ? Number(capituloPreferido)
    : (caps[0] || 1);

  capSel.value = String(destino);
}

function abrirFiltrosBiblia() {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn  = document.getElementById("btnToggleFiltros");
  if (!wrap) return;

  filtroBibliaBackup = {
    libro: libroSel?.value || "",
    capitulo: Number(capSel?.value || 1),
    input: document.getElementById("buscarLibroBiblia")?.value || ""
  };

  wrap.classList.add("abierto");
  if (btn) btn.classList.add("activo");

   if (libroSel) {
    Array.from(libroSel.options).forEach(opt => {
      opt.hidden = false;
    });
  }
  
  setTimeout(() => {
    const inputBuscar = document.getElementById("buscarLibroBiblia");
    if (inputBuscar) inputBuscar.focus();
  }, 0);
}

function cerrarFiltrosBiblia(cancelar = false) {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn  = document.getElementById("btnToggleFiltros");
  const inputBuscar = document.getElementById("buscarLibroBiblia");

  if (!wrap) return;

  if (cancelar && filtroBibliaBackup) {
    if (libroSel && filtroBibliaBackup.libro) {
      libroSel.value = filtroBibliaBackup.libro;
      reconstruirCapitulosParaLibro(filtroBibliaBackup.libro, filtroBibliaBackup.capitulo);
    }
    if (inputBuscar) {
      inputBuscar.value = filtroBibliaBackup.input || "";
    }
  }

  wrap.classList.remove("abierto");
  if (btn) {
    btn.classList.remove("activo");
    btn.blur();
  }

  if (document.activeElement?.blur) {
    document.activeElement.blur();
  }
}

function aplicarFiltrosBiblia() {
  const libro = libroSel?.value || "";
  const capitulo = Number(capSel?.value || 1);

  if (!libro) {
    cerrarFiltrosBiblia(true);
    return;
  }

  reconstruirCapitulosParaLibro(libro, capitulo);
  mostrarTexto({ irArriba: true, guardar: true });
  cerrarFiltrosBiblia(false);
}

// ================= CONTEXTO: AISLAR MODOS BIBLIA vs ABC =================
// Guarda el estado de Biblia y lo apaga visualmente al entrar en ABC.
// Luego lo restaura al volver a Biblia.

window.__bibliaUIBackup = window.__bibliaUIBackup || null;

function bibliaBackupUI() {
  // guardo flags + selecciones (lo importante)
  window.__bibliaUIBackup = {
    modoImagen: !!modoImagen,
    modoMarcador: !!modoMarcador,
    seleccionImagen: { ...(seleccionImagen || {}) },
    seleccionMarcador: { ...(seleccionMarcador || {}) },
    userSetFontSize: !!userSetFontSize
  };
}

function bibliaApagarModosParaCambiarSeccion() {
  // cerrar modal de imagen si estaba abierto (pero no “romper” nada)
  try { cerrarModalPersonalizar?.(); } catch(e){}

  // apagar flags (para que NO afecten UI de otras secciones)
  modoImagen = false;
  modoMarcador = false;

  // limpiar clases visuales
  document.body.classList.remove("modo-imagen", "modo-marcador");

  // ocultar banners si existen
  const bImg = document.getElementById("bannerModoImagen");
  if (bImg) bImg.style.display = "none";

  const bMar = document.getElementById("bannerModoMarcador");
  if (bMar) bMar.style.display = "none";

  // sacar “activo” del botón 📌 por si quedó pegado
  const btnPin = document.getElementById("btnModoMarcadorBarra");
  if (btnPin) btnPin.classList.remove("activo");

  // dejar UI consistente
  try { aplicarUIAccionesPorModo?.(); } catch(e){}
  try { refrescarBotonGuardarMarcador?.(); } catch(e){}
}

function bibliaRestaurarUIAlVolver() {
  const bk = window.__bibliaUIBackup;
  if (!bk) return;

  modoImagen = !!bk.modoImagen;
  modoMarcador = !!bk.modoMarcador;
  seleccionImagen = { ...(bk.seleccionImagen || {}) };
  seleccionMarcador = { ...(bk.seleccionMarcador || {}) };
  userSetFontSize = !!bk.userSetFontSize;

  // restaurar clases visuales
  document.body.classList.toggle("modo-imagen", modoImagen);
  document.body.classList.toggle("modo-marcador", modoMarcador);

  // banners
  const bImg = document.getElementById("bannerModoImagen");
  if (bImg) bImg.style.display = modoImagen ? "block" : "none";

  const bMar = document.getElementById("bannerModoMarcador");
  if (bMar) bMar.style.display = modoMarcador ? "block" : "none";

  // botón 📌 activo o no
  const btnPin = document.getElementById("btnModoMarcadorBarra");
  if (btnPin) btnPin.classList.toggle("activo", modoMarcador);

  // UI normal
  try { aplicarUIAccionesPorModo?.(); } catch(e){}
  try { refrescarBotonGuardarMarcador?.(); } catch(e){}
  try { mostrarTexto?.(); } catch(e){}
}

// ================= ⭐ CARGA BIBLIA ==============================
Promise.all([
  fetch("VidaAbundante - RV1960.json", { cache: "force-cache" }).then(r => r.json()),
  fetch("biblia_ntv.json", { cache: "force-cache" }).then(r => r.json())
])
.then(([rvData, ntvData]) => {
  bibliaDataRV = Array.isArray(rvData) ? rvData : [];
  bibliaDataNTV = Array.isArray(ntvData) ? ntvData : [];

  // arranca por defecto en RV1960
   bibliaData = bibliaDataRV;
  versionActual = "RV1960";

  requestAnimationFrame(() => {
    iniciar();
  });
})
.catch(err => {
  console.error("❌ Error cargando Biblias:", err);
});

// =======

document.fonts.ready.then(() => {
  console.log("✅ Fuentes cargadas");

  // ✅ solo refrescar si el modal existe y está visible
  const modal = document.getElementById("modalPersonalizar");
  if (modal && getComputedStyle(modal).display !== "none") {
    actualizarPreview();
  }
});

// ================= ⭐ INICIAR BIBLIA ==============================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));

  libroSel.onchange = () => {
    // ✅ en filtros, solo preparar capítulos y dejar 1 por default
    reconstruirCapitulosParaLibro(libroSel.value, 1);
  };

  capSel.onchange = () => {
    // ✅ no navegar automáticamente desde el filtro
  };

  restaurarEstadoBibliaInicial();
}

// ================= ⭐ CARGA CAPITULOS ==============================
function cargarCapitulos(opts = {}) {
  const {
    capituloPreferido = null,
    irArriba = false,
    guardar = true
  } = opts;

  const valorAnterior = Number(capSel?.value || 1);

  capSel.innerHTML = "";

  const caps = [...new Set(
    bibliaData
      .filter(v => v.Libro === libroSel.value)
      .map(v => Number(v.Capitulo))
  )].sort((a, b) => a - b);

  caps.forEach(c => {
    capSel.innerHTML += `<option value="${c}">${c}</option>`;
  });

  let destino = Number(capituloPreferido);

  if (!Number.isFinite(destino) || !caps.includes(destino)) {
    destino = caps.includes(valorAnterior) ? valorAnterior : caps[0];
  }

  if (Number.isFinite(destino)) {
    capSel.value = String(destino);
  }

  mostrarTexto({ irArriba, guardar });
}

// ================= ⭐ MOSTRAR TOAST ==============================
function mostrarToast(msg, ms = 2200) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  requestAnimationFrame(() => (t.style.opacity = "1"));

  clearTimeout(t._tm);
  t._tm = setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => (t.style.display = "none"), 250);
  }, ms);
}

// ================= ⭐ helpers para cambiar versión ==============================
function getCampoTextoVersion() {
  return versionActual === "NTV" ? "NTV" : "RV1960";
}

function getTextoVersiculo(v) {
  if (!v) return "";
  return v[getCampoTextoVersion()] || "";
}

function actualizarTituloBiblia() {
  if (!titulo) return;

  const htmlNuevo = `
    <span class="titulo-libro-cap">${libroSel.value} ${capSel.value}</span>
    <span class="versiones-inline">
      <button type="button"
        onclick="event.stopPropagation(); cambiarVersionBiblia('RV1960')"
        class="btn-version-inline ${versionActual === "RV1960" ? "activo" : ""}">
        RV1960
      </button>

      <button type="button"
        onclick="event.stopPropagation(); cambiarVersionBiblia('NTV')"
        class="btn-version-inline ${versionActual === "NTV" ? "activo" : ""}">
        NTV
      </button>
    </span>
  `;

  if (titulo.innerHTML !== htmlNuevo) {
    titulo.innerHTML = htmlNuevo;
  }
}

window.cambiarVersionBiblia = function(version) {
  if (version !== "RV1960" && version !== "NTV") return;

  const libroActual = libroSel?.value || "";
  const capituloActual = Number(capSel?.value || 1);

  versionActual = version;
  bibliaData = (version === "NTV") ? bibliaDataNTV : bibliaDataRV;

  // reconstruir lista de libros
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));

  if (libroActual && libros.includes(libroActual)) {
    libroSel.value = libroActual;
  }

  // conservar mismo capítulo
  cargarCapitulos({
    capituloPreferido: capituloActual,
    irArriba: false,
    guardar: true
  });

  // si está en modo imagen, mantener preview y selección
  if (modoImagen) {
    userSetFontSize = false;
    actualizarPreview();
  }
};

// ================= ⭐ SUGERIR TAMAÑO QUE ENTRE (solo sugerencia) =================
function sugerirFontSizeQueEntre(wrapper, elFront, elBack, maxPx = 64, minPx = 10, step = 0.5) {
  if (!wrapper || !elFront || !elBack) return 32;

  // medir "zona útil" (restando padding del wrapper)
  const cs = getComputedStyle(wrapper);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);

  const maxW = Math.max(10, wrapper.clientWidth - padX);
  const maxH = Math.max(10, wrapper.clientHeight - padY);

  // helper: aplica tamaño y revisa si entra
  const entra = (px) => {
    elFront.style.fontSize = px + "px";
    elBack.style.fontSize  = px + "px";

    // OJO: usamos scrollHeight/Width para detectar desborde real
    const okH = elFront.scrollHeight <= maxH && elBack.scrollHeight <= maxH;
    const okW = elFront.scrollWidth  <= maxW && elBack.scrollWidth  <= maxW;
    return okH && okW;
  };

  // si ni el mínimo entra, devolvemos min (igual será sugerencia)
  if (!entra(minPx)) return minPx;

  // Búsqueda binaria en pasos de 0.5px (máximo tamaño que entra)
  let lo = minPx;
  let hi = maxPx;

  while ((hi - lo) > step) {
    const mid = Math.floor(((lo + hi) / 2) / step) * step; // redondeo a step
    if (entra(mid)) lo = mid;
    else hi = mid - step;
  }

  return Number(lo.toFixed(1));
}

// ========================= 🎨 RESALTADOR COMPACTO  =======================================
function initResaltadorCompacto() {
  const btnActivo = document.getElementById("btnResaltadorActivo");
  const paleta = document.getElementById("paletaResaltadores");
  const cont = document.getElementById("resaltadorCompacto");
  const btnBloquear = document.getElementById("btnBloquearResaltador");
  const btnEditar = document.getElementById("btnEditarPaleta");
  const wrapColores = document.getElementById("paletaColoresWrap");

  if (!btnActivo || !paleta || !cont || !btnBloquear || !btnEditar || !wrapColores) {
    console.warn("❌ Resaltador no inicializado");
    return;
  }

  paleta.style.display = "none";

  function renderBotonActivo() {
    const conf = obtenerConfigResaltadorActual();

    btnActivo.innerHTML = "";
    btnActivo.style.background = "transparent";
    btnActivo.appendChild(crearNodoFormaResaltador(conf.color, conf.forma));
  }

  function renderPaletaColores() {
    wrapColores.innerHTML = "";

    resaltadoresConfig.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-color-marker";
      btn.dataset.color = item.color;
      btn.dataset.index = i;

      if (item.color === colorActual) {
        btn.classList.add("activo");
      }

      btn.appendChild(crearNodoFormaResaltador(item.color, item.forma));

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        colorActual = item.color;
        window.colorActual = colorActual;

        resaltadorBloqueado = false;
        window.resaltadorBloqueado = resaltadorBloqueado;

        renderBotonActivo();
        renderPaletaColores();
        actualizarUICandadoResaltador();
        paleta.style.display = "none";
      };

      wrapColores.appendChild(btn);
    });
  }

  btnActivo.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const visible = paleta.style.display === "grid";
    paleta.style.display = visible ? "none" : "grid";
    cont.classList.remove("mover-derecha");
    if (!visible) {
      const rect = paleta.getBoundingClientRect();
      if (rect.top < 10) cont.classList.add("mover-derecha");
    }
  };

  btnBloquear.onclick = e => {
    e.preventDefault();
    e.stopPropagation();

    resaltadorBloqueado = !resaltadorBloqueado;
    window.resaltadorBloqueado = resaltadorBloqueado;

    actualizarUICandadoResaltador();
  };

  btnEditar.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirModalEditarPaletaResaltador();
  };

  document.addEventListener("click", e => {
    if (!cont.contains(e.target)) paleta.style.display = "none";
  });

  renderBotonActivo();
  renderPaletaColores();
  actualizarUICandadoResaltador();
}

// ================= ⭐ BLOQUEO DE RESALTADOR =======================
function actualizarUICandadoResaltador() {
  const wrapColores = document.getElementById("paletaColoresWrap");
  const btnBloquear = document.getElementById("btnBloquearResaltador");
  if (!wrapColores || !btnBloquear) return;

  const locked = !!window.resaltadorBloqueado;
  const curColor = (window.colorActual || "#fff3b0") + "";

  btnBloquear.textContent = locked ? "🔒" : "🔓";

  wrapColores.querySelectorAll(".icono-candado").forEach(c => c.remove());

  if (locked) {
    const botonColor = Array.from(wrapColores.querySelectorAll(".btn-color-marker"))
      .find(b => ((b.dataset.color || "") + "") === curColor);

    const target = botonColor || wrapColores.querySelector(".btn-color-marker");
    if (target) {
      const span = document.createElement("span");
      span.textContent = "🔒";
      span.className = "icono-candado";
      target.appendChild(span);
    }
  }
}

// ================= 🧩 MODAL EDITAR PALETA RESALTADOR =================
function abrirModalEditarPaletaResaltador() {
  const modal = document.getElementById("modalEditarPaletaResaltador");
  const lista = document.getElementById("listaEditarPaletaResaltador");
  if (!modal || !lista) return;

  lista.innerHTML = "";

  resaltadoresConfig.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row-editar-paleta";

row.innerHTML = `
  <div><b>${i + 1}</b></div>
  <input id="resaltadorColor_${i}" type="hidden" value="${item.color}" data-index="${i}" class="input-color-paleta">
  <button type="button" class="pickr-host pickr-host--full" data-target="#resaltadorColor_${i}" aria-label="Color resaltador ${i + 1}"></button>
  <select data-index="${i}" class="select-forma-paleta">
    <option value="circle" ${item.forma === "circle" ? "selected" : ""}>Círculo</option>
    <option value="heart" ${item.forma === "heart" ? "selected" : ""}>Corazón</option>
  </select>
`;

    lista.appendChild(row);
  });

  modal.style.display = "flex";

setTimeout(() => {
  initPickrEnHosts("#listaEditarPaletaResaltador .pickr-host");
}, 0);
}

function cerrarModalEditarPaletaResaltador() {
  const modal = document.getElementById("modalEditarPaletaResaltador");
  if (!modal) return;
  modal.style.display = "none";
}


function destruirPickrsActivos() {
  try {
    pickrInstances.forEach(p => {
      try { p.destroyAndRemove(); } catch(e){}
    });
  } catch(e){}
  pickrInstances = [];
}

let pickrInstances = [];

function initPickrEnHosts(selector = ".pickr-host") {
  if (typeof Pickr === "undefined") {
    console.warn("Pickr no está cargado");
    return;
  }

  const hosts = document.querySelectorAll(selector);

  hosts.forEach(host => {
    if (host.dataset.pickrReady === "1") return;

    const targetSel = host.dataset.target;
    if (!targetSel) return;

    const input = document.querySelector(targetSel);
    if (!input) return;

    const setColorVisual = (hex) => {
      const color = hex || "#ffffff";
      host.style.setProperty("--pickr-color", color);
      host.style.background = color;
    };

    const pickr = Pickr.create({
      el: host,
      theme: "classic",
      default: input.value || "#ffffff",
      comparison: true,
      useAsButton: true,
      position: "top-middle",

      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          save: true,
          cancel: true,
          clear: false
        }
      },

      i18n: {
        "ui:dialog": "Selector de color",
        "btn:toggle": "Abrir selector",
        "btn:swatch": "Muestras",
        "btn:last-color": "Color anterior",
        "btn:save": "Guardar",
        "btn:cancel": "Cancelar",
        "btn:clear": "Limpiar",
        "aria:btn:save": "Guardar color",
        "aria:btn:cancel": "Cancelar",
        "aria:input": "Campo de color",
        "aria:palette": "Paleta de color",
        "aria:hue": "Tono",
        "aria:opacity": "Opacidad"
      }
    });
host._pickr = pickr;
    
    // color inicial visible en el botón
    setColorVisual(input.value || "#ffffff");

    pickr.on("show", () => {
      setColorVisual(input.value || "#ffffff");
    });

    pickr.on("save", (color) => {
      const hex = color ? color.toHEXA().toString() : "#ffffff";
      input.value = hex;
      setColorVisual(hex);

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      pickr.hide();
    });

    pickr.on("cancel", () => {
      // vuelve al último valor guardado y cierra
      setColorVisual(input.value || "#ffffff");
      pickr.hide();
    });

    host.dataset.pickrReady = "1";
    pickrInstances.push(pickr);
  });
}

window.initPickrEnHosts = initPickrEnHosts;
window.destruirPickrsActivos = destruirPickrsActivos;

async function guardarModalEditarPaletaResaltador() {
  const colors = document.querySelectorAll(".input-color-paleta");
  const formas = document.querySelectorAll(".select-forma-paleta");

  resaltadoresConfig = resaltadoresConfig.map((item, i) => ({
    color: colors[i]?.value || item.color,
    forma: formas[i]?.value === "heart" ? "heart" : "circle"
  }));

  guardarResaltadoresConfigLocal();
  await guardarResaltadoresConfigFirebase();

  if (!resaltadoresConfig.some(x => x.color === colorActual)) {
    colorActual = resaltadoresConfig[0]?.color || "#fff3b0";
    window.colorActual = colorActual;
  }

  initResaltadorCompacto();
  cerrarModalEditarPaletaResaltador();
}

async function resetearPaletaResaltador() {
  resaltadoresConfig = JSON.parse(JSON.stringify(DEFAULT_RESALTADORES));
  guardarResaltadoresConfigLocal();
  await guardarResaltadoresConfigFirebase();

  colorActual = resaltadoresConfig[1]?.color || "#fff3b0";
  window.colorActual = colorActual;

  initResaltadorCompacto();
  abrirModalEditarPaletaResaltador();
}

// ================= ⭐ FUERZA CANDADO PEQUEÑO =======================
window.forceSyncResaltadorUI = function forceSyncResaltadorUI(intentos = 20) {
  const tick = () => {
    try { actualizarUICandadoResaltador?.(); } catch (e) {}

    const wrapColores = document.getElementById("paletaColoresWrap");
    const ok = wrapColores && wrapColores.querySelector("span.icono-candado");

    if (ok) return;
    if (intentos <= 0) return;

    requestAnimationFrame(() => {
      window.forceSyncResaltadorUI(intentos - 1);
    });
  };

  requestAnimationFrame(tick);
};

// ================= ⭐ MOSTRAR TEXTO =======================
function mostrarTexto(opts = {}) {
  const {
    irArriba = false,
    guardar = true
  } = opts;

  texto.innerHTML = "";
  actualizarTituloBiblia();

 const libroActual = libroSel.value;
const capituloActual = Number(capSel.value);

const versos = bibliaData.filter(v =>
  v.Libro === libroActual &&
  Number(v.Capitulo) === capituloActual
);

  versos.forEach(v => pintarVersiculo(v));

  if (irArriba) {
    requestAnimationFrame(() => {
      irArribaBiblia();
    });
  }

  if (guardar) {
    guardarEstadoBiblia();
  }
}

// ================= ⭐ TOGGLE VERSICULO =======================
function toggleVersiculo(id, num) {

  // 📌 MODO MARCADOR (seleccionar versículos para guardar)
  if (modoMarcador) {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }

    if (seleccionMarcador[id]) delete seleccionMarcador[id];
    else seleccionMarcador[id] = true;

    mostrarTexto();
    refrescarBotonGuardarMarcador();
    renderPreviewVersiculosMarcador();
    return;
  }

  // 🖼️ MODO IMAGEN
  if (modoImagen) {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }

    if (seleccionImagen[id]) {
      delete seleccionImagen[id];
    } else {
      seleccionImagen[id] = true;
    }

        mostrarTexto({ guardar: false });
    userSetFontSize = false; // ✅ cambió el texto => volver a AUTO

    requestAnimationFrame(() => {
      actualizarPreview();
    });

    return;
  }

  // 🔐 requiere login
  if (!uid) return;

  // 🔒 resaltador bloqueado
  if (resaltadorBloqueado) return;

  // 🎨 marcar / desmarcar versículo
  const r = ref(db, "marcados/" + uid + "/" + id);

  if (marcados[id]) {
    remove(r);
  } else {
    set(r, { color: colorActual });
  }
}

// ======================= ⭐ Obtener Marcador Keep Para Versiculo  ====
function obtenerMarcadorKeepParaVersiculo(libro, capitulo, versiculo) {
  const items = Object.values(marcadores || {});
  for (const m of items) {
    if (m?.origen === "abc") continue;
    if (!m?.keep) continue;
    if (m?.libro !== libro) continue;
    if (Number(m?.capitulo) !== Number(capitulo)) continue;

    const vers = Array.isArray(m?.versiculos) ? m.versiculos.map(Number) : [];
    if (vers.includes(Number(versiculo))) {
      return m;
    }
  }
  return null;
}

// ======================= ⭐ PINTAR VERSICULO  ====
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];
  const selMarcador = modoMarcador && seleccionMarcador[id];

  const marcadorKeepDelVersiculo = obtenerMarcadorKeepParaVersiculo(v.Libro, v.Capitulo, v.Versiculo);

  const aplicado = (
    !!ultimoMarcadorAplicado &&
    ultimoMarcadorAplicado.libro === v.Libro &&
    Number(ultimoMarcadorAplicado.capitulo) === Number(v.Capitulo) &&
    (ultimoMarcadorAplicado.versiculos || []).includes(Number(v.Versiculo))
  ) || !!marcadorKeepDelVersiculo;

  const colorAplicadoKeep =
    ultimoMarcadorAplicado?.color ||
    marcadorKeepDelVersiculo?.color ||
    null;

  const div = document.createElement("div");
  div.className = "versiculo";
  div.dataset.id = id;
  if (imagen) div.classList.add("imagen");

  const enOscuro = document.body.classList.contains("oscuro");

  // ================= Tamaño Letra =================
  div.style.fontSize = size + "px";

  // ================= Fondo =================
  if (modoImagen) {
    div.style.background = imagen ? "rgba(255, 214, 232, 0.6)" : "transparent";

  } else if (modoMarcador) {
    if (selMarcador) {
      div.style.background = enOscuro
        ? "rgba(209, 238, 255, 0.92)"
        : "rgba(209, 238, 255, 0.92)";
    } else if (aplicado && colorAplicadoKeep) {
      div.style.background = colorAplicadoKeep;
    } else {
      div.style.background = "transparent";
    }

  } else {
    if (aplicado && colorAplicadoKeep) {
      div.style.background = colorAplicadoKeep;
    } else {
      div.style.background = marcado?.color || "transparent";
    }
  }

  if (selMarcador) div.style.border = "2px solid #4f6fa8";
  else div.style.border = "none";

  // ================= Color de Texto =================
  if (modoImagen) {
    div.style.color = imagen ? "#000000" : (enOscuro ? "#ffffff" : "#000000");
  } else {
    if (modoMarcador && selMarcador) {
      div.style.color = "#000000";
    } else {
      let fondo = null;

      if (modoMarcador) {
        if (aplicado && colorAplicadoKeep) fondo = colorAplicadoKeep;
      } else {
        if (aplicado && colorAplicadoKeep) fondo = colorAplicadoKeep;
        else if (marcado?.color) fondo = marcado.color;
      }

      if (fondo) div.style.color = colorContraste(fondo);
      else div.style.color = enOscuro ? "#ffffff" : "#000000";
    }
  }

  // ================= Opacidad =================
  if (modoImagen && !imagen) {
    div.style.opacity = "0.6";
  } else {
    div.style.opacity = "1";
  }

  // ================= Contenido =================
  const idMarcadorPluma = (window.notasBibliaPluma || {})[id] || null;

  div.innerHTML = `
    <span class="num">${v.Versiculo}</span>
   <span class="txt">${getTextoVersiculo(v)}</span>
    ${idMarcadorPluma ? `<i class="fa-solid fa-comment-dots icono-nota" aria-hidden="true" data-mid="${idMarcadorPluma}"></i>` : ``}
  `;

  // ================= Click =================
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  const pluma = div.querySelector(".icono-nota[data-mid]");
  if (pluma) {
    pluma.style.cursor = "pointer";
    pluma.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const mid = pluma.getAttribute("data-mid");
      if (!mid) return;

      if (typeof window.abrirMarcadores === "function") {
        window.abrirMarcadores();
      }

      setTimeout(() => {
        if (typeof window.editarMarcadorDesdeLista === "function") {
          window.editarMarcadorDesdeLista(mid);
          return;
        }
        if (typeof window.editarMarcadorEnPanel === "function") {
          window.editarMarcadorEnPanel(mid);
          return;
        }
      }, 0);
    };
  }

  texto.appendChild(div);
}

// ================= ⭐ OBTIENE VERSICULO SELECCIONADO (FIX MULTI CAP) =======================
function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(seleccionImagen || {});
  if (ids.length === 0) return "";

  // 1) Parse + ordenar por Libro, Cap, Vers
  const items = ids.map(id => {
    const [Libro, Capitulo, Versiculo] = id.split("_");
    return {
      id,
      Libro,
      Capitulo: Number(Capitulo),
      Versiculo: Number(Versiculo)
    };
  }).filter(x => x.Libro && !isNaN(x.Capitulo) && !isNaN(x.Versiculo));

  items.sort((a, b) => {
    if (a.Libro !== b.Libro) return a.Libro.localeCompare(b.Libro);
    if (a.Capitulo !== b.Capitulo) return a.Capitulo - b.Capitulo;
    return a.Versiculo - b.Versiculo;
  });

  // 2) Armar texto (en el orden ya ordenado)
  const textos = [];
  for (const it of items) {
    const vers = bibliaData.find(x =>
      x.Libro === it.Libro &&
      Number(x.Capitulo) === it.Capitulo &&
      Number(x.Versiculo) === it.Versiculo
    );
    const txt = getTextoVersiculo(vers);
if (txt) textos.push(txt);
  }

  // 3) Agrupar por Libro + Capítulo para referencia
  const porLibro = {}; // {Libro: {Capitulo: [versiculos]}}
  for (const it of items) {
    porLibro[it.Libro] = porLibro[it.Libro] || {};
    porLibro[it.Libro][it.Capitulo] = porLibro[it.Libro][it.Capitulo] || [];
    porLibro[it.Libro][it.Capitulo].push(it.Versiculo);
  }

  // helper: rangos "5-7,9,11-13"
  const rangos = (nums) => {
    const a = Array.from(new Set(nums.map(Number).filter(n => !isNaN(n)))).sort((x,y)=>x-y);
    if (!a.length) return "";
    const partes = [];
    let ini = a[0], ant = a[0];
    for (let i = 1; i < a.length; i++) {
      if (a[i] === ant + 1) ant = a[i];
      else {
        partes.push(ini === ant ? `${ini}` : `${ini}-${ant}`);
        ini = ant = a[i];
      }
    }
    partes.push(ini === ant ? `${ini}` : `${ini}-${ant}`);
    return partes.join(",");
  };

  // 4) Construir referencia bonita
  const librosOrdenados = Object.keys(porLibro).sort((a,b)=>a.localeCompare(b));

  let referencia = "";
  if (librosOrdenados.length === 1) {
    // ✅ MISMO LIBRO: "Génesis 1:5-7 y 2:1-3"
    const L = librosOrdenados[0];
    const caps = Object.keys(porLibro[L]).map(Number).sort((a,b)=>a-b);
    const partes = caps.map(c => `${c}:${rangos(porLibro[L][c])}`);
    referencia = `${L} ${partes.join(" y ")}`;
  } else {
    // ✅ VARIOS LIBROS: "Génesis 1:5-7; Éxodo 2:1-3"
    const partesLibros = librosOrdenados.map(L => {
      const caps = Object.keys(porLibro[L]).map(Number).sort((a,b)=>a-b);
      const partes = caps.map(c => `${c}:${rangos(porLibro[L][c])}`);
      return `${L} ${partes.join(" , ")}`;
    });
    referencia = partesLibros.join("; ");
  }

  // 5) Salida final
  return (textos.join(" ") + "\n\n▪ " + referencia).trim();
}

// ================= ⭐ texto libre  =======================
function obtenerTextoParaPreview() {
  if (modoImagenLibre) {
    return (textoLibreImagen || "").trim();
  }
  return obtenerVersiculoSeleccionado();
}

function asegurarCajaTextoLibrePanel() {
  const modalBox = document.querySelector("#modalPersonalizar .modal-contenido");
  const preview = document.getElementById("previewImagen");
  if (!modalBox || !preview) return;

  let box = document.getElementById("boxTextoLibrePanel");

  if (!box) {
    box = document.createElement("div");
    box.id = "boxTextoLibrePanel";
    box.style.display = "none";
    box.style.maxWidth = "420px";
    box.style.margin = "0 auto 10px auto";
    box.style.width = "100%";

box.innerHTML = `
  <textarea
    id="textoLibrePanelInput"
    placeholder="Escribí o pegá tu texto acá..."
    style="
      width:100%;
      min-height:120px;
      border-radius:14px;
      border:1px solid #d9d9d9;
      padding:12px;
      resize:vertical;
      font-size:15px;
      line-height:1.35;
      box-sizing:border-box;
    "
  ></textarea>
`;

    modalBox.insertBefore(box, preview);
  }

  const input = document.getElementById("textoLibrePanelInput");
  if (input && !input.dataset.ready) {
    input.addEventListener("input", () => {
      textoLibreImagen = input.value || "";
      userSetFontSize = false;
      actualizarPreview();
    });
    input.dataset.ready = "1";
  }

  box.style.display = modoImagenLibre ? "block" : "none";

  if (input) {
    input.value = textoLibreImagen || "";
  }
}

// ================= ⭐ FORMATEA: JUAN 1:5-10  =======================
function formatearVersiculosComoRango(numeros) {
  if (numeros.length === 0) return "";

  numeros.sort((a, b) => a - b);

  const partes = [];
  let inicio = numeros[0];
  let anterior = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === anterior + 1) {
      anterior = numeros[i];
    } else {
      partes.push(
        inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
      );
      inicio = numeros[i];
      anterior = numeros[i];
    }
  }

  partes.push(
    inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
  );

  return partes.join(",");
}
// ================= ⭐ COLOR CONTRASTE  =======================

function colorContraste(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#000000" : "#ffffff";
}

// ================= ⭐ COLOR OUTLINE (PURO BLANCO/NEGRO) =======================
function colorOutlineDesdeBase(color) {
  if (!color) return "#000000";

  // rgb() → hex
  if (color.startsWith("rgb")) {
    const nums = color.match(/\d+/g).map(Number);
    color = "#" + nums.map(x => x.toString(16).padStart(2, "0")).join("");
  }

  // por si viene #abc (raro, pero por las dudas)
  if (color.length === 4) {
    color =
      "#" +
      color[1] + color[1] +
      color[2] + color[2] +
      color[3] + color[3];
  }

  // luminancia simple
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  // ✅ si el texto base es claro -> outline NEGRO
  // ✅ si el texto base es oscuro -> outline BLANCO
  return lum > 160 ? "#000000" : "#ffffff";
}

// ================= 🎀 FUENTES  =======================
// 🔗 Listeners de personalización (✅ se enganchan cuando el DOM ya existe)
function initPersonalizarListeners() {
  ["personalizarOpacidad", "personalizarTamaño", "personalizarColor", "colorOpacidadBiblia"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("⚠️ No existe:", id);
      return;
    }

    const handler = () => {
      if (id === "personalizarTamaño") userSetFontSize = true; // manual si tocan tamaño
      actualizarPreview();
    };

    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
}

document.addEventListener("DOMContentLoaded", initPersonalizarListeners);
window.addEventListener("beforeunload", () => {
  guardarEstadoBiblia();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    guardarEstadoBiblia();
  }
});

// ================= 🎀 LISTA VISUAL DE FUENTES =================
const fuentesGoogle = [
  { nombre: "Roboto", css: "Roboto, sans-serif" },
  { nombre: "Lobster", css: "Lobster, cursive" },
  { nombre: "Playfair Display", css: "'Playfair Display', serif" },
  { nombre: "Montserrat", css: "Montserrat, sans-serif" },
  { nombre: "Poppins", css: "Poppins, sans-serif" },
  { nombre: "Abril Fatface", css: "'Abril Fatface', serif" },
  { nombre: "Cormorant", css: "Cormorant, serif" },
  { nombre: "Josefin Sans", css: "'Josefin Sans', sans-serif" },
  { nombre: "Great Vibes", css: "'Great Vibes', cursive" },

  { nombre: "Lexend", css: "Lexend, sans-serif" },
  { nombre: "Lora", css: "Lora, serif" },
  { nombre: "Caveat", css: "Caveat, cursive" },
  { nombre: "Merriweather", css: "Merriweather, serif" },

  { nombre: "Arial", css: "Arial, sans-serif" },
  { nombre: "Arial Black", css: "'Arial Black', Arial, sans-serif" },
  { nombre: "Verdana", css: "Verdana, sans-serif" },
  { nombre: "Trebuchet MS", css: "'Trebuchet MS', sans-serif" },
  { nombre: "Comic Sans MS", css: "'Comic Sans MS', cursive" }
];

// ================= ⭐ CREAR LISTA VISUAL DE FUENTES  =======================
function crearListaVisualFuentes() {
  const cont = document.getElementById("listaFuentes");
  if (!cont) return;

  cont.innerHTML = "";

  fuentesGoogle.forEach(f => {
    const btn = document.createElement("button");
    btn.textContent = f.nombre;
    btn.style.fontFamily = f.css;

    // marcar la fuente actual como activa
    if (fuenteActual === f.css) btn.classList.add("activo");

    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      fuenteActual = f.css;

      // actualizar activo visual
      cont.querySelectorAll("button").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      actualizarPreview();

      // ✅ ya NO cerramos al elegir
    };

    cont.appendChild(btn);
  });
}

// ================= 🎀 CERRAR/ABRIR FUENTES + POSICIONAR AL ANCHO DEL MODAL =================
const btnFuentes = document.getElementById("btnFuentes");
const listaFuentes = document.getElementById("listaFuentes");

// ✅ PC: rueda vertical => scroll horizontal en lista de fuentes
if (listaFuentes) {
  listaFuentes.addEventListener("wheel", (e) => {
    // solo cuando la lista está abierta
    if (!listaFuentes.classList.contains("abierto")) return;

    // si el usuario ya tiene shift, dejamos el comportamiento normal
    if (e.shiftKey) return;

    e.preventDefault();
    listaFuentes.scrollLeft += e.deltaY;
  }, { passive: false });
}

// ================= ⭐ Posicionar Lista Fuentes =================
function posicionarListaFuentes() {
const modalBox = document.querySelector("#modalPersonalizar .modal-contenido");
  if (!modalBox || !btnFuentes || !listaFuentes) return;

  const rModal = modalBox.getBoundingClientRect();
  const rBtn = btnFuentes.getBoundingClientRect();

  // ancho exacto del modal (con padding interno)
  const padding = 12;
  const left = rModal.left + padding;
  const width = rModal.width - padding * 2;

  listaFuentes.style.left = left + "px";
  listaFuentes.style.width = width + "px";

  // debajo del botón
  listaFuentes.style.top = (rBtn.bottom + 8) + "px";
}

if (btnFuentes && listaFuentes) {
  btnFuentes.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    const abierto = listaFuentes.classList.toggle("abierto");
    btnFuentes.classList.toggle("activo", abierto);

    if (abierto) {
      posicionarListaFuentes();
    }
  });

  window.addEventListener("resize", () => {
    if (listaFuentes.classList.contains("abierto")) posicionarListaFuentes();
  });

  window.addEventListener("scroll", () => {
    if (listaFuentes.classList.contains("abierto")) posicionarListaFuentes();
  }, true);

  document.addEventListener("click", e => {
    if (!listaFuentes.contains(e.target) && e.target !== btnFuentes) {
      listaFuentes.classList.remove("abierto");
      btnFuentes.classList.remove("activo");
    }
  });
}

// ================= ☁️ R2 HELPERS (COPIADO DE DEVOCIONALES) =================
async function blobToBase64(blob){
  return await new Promise((resolve,reject)=>{
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = ()=>{
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.readAsDataURL(blob);
  });
}

async function subirImagenAR2DesdeWeb(fileBase64, fileName, contentType = "image/png"){
  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName,
      contentType
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir imagen a R2");
  }

  return data;
}

// ================= 🌄 FONDOS ⛺================================
const fondosCategorias = {
  paisajes: [
    "./img/fondos/Paisajes/Untitled_Project_10_scjlfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_11_z3nudj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_12_crdynt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_13_dzxm4k.jpg",
    "./img/fondos/Paisajes/Untitled_Project_14_iww2jx.jpg",
    "./img/fondos/Paisajes/Untitled_Project_15_iu1uxj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_cg9dfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_jwctxg.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_q3uzog.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_qttkkt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_z6ol0o.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_a1wlsh.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_ehfqna.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_hi9hhz.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_twzefr.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_wzlhio.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_jhrx0j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_qfbqel.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_thrkka_b1ibx2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_tjsq2f.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_zw4kl2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_brmypi.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_ftamyb.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_htsxrq.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_ghg8ux.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_kpgvmm.jpg",
    "./img/fondos/Paisajes/Untitled_Project_7_qpfbuy.jpg",
    "./img/fondos/Paisajes/Untitled_Project_8_ivok7j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_c2feyb_juy9d6.jpg",
    "./img/fondos/Paisajes/Untitled_Project_ycpnpv.jpg",
    "./img/fondos/Paisajes/amanecer1600x1600_igddhh.jpg",
    "./img/fondos/Paisajes/amanecerpiedras_zb18j1.jpg",
    "./img/fondos/Paisajes/arbustos_pwdcsk.jpg",
    "./img/fondos/Paisajes/arcadafloresrosas_fc4aj4.jpg",
    "./img/fondos/Paisajes/arcoflores_lnrfa9.jpg",
    "./img/fondos/Paisajes/bebedero_ystc1u.jpg",
    "./img/fondos/Paisajes/boda_nmzaub.jpg",
    "./img/fondos/Paisajes/camino_madnav.jpg",
    "./img/fondos/Paisajes/casitalejosarboles_by72rz_upjpn4.jpg",
    "./img/fondos/Paisajes/cielocelesterosaarboles_y4t720.jpg",
    "./img/fondos/Paisajes/cielovioleta_us3ilw.jpg",
    "./img/fondos/Paisajes/faro2_s5ynwu.jpg",
    "./img/fondos/Paisajes/faro_aginuk.jpg",
    "./img/fondos/Paisajes/floresamarillas_mhosyy.jpg",
    "./img/fondos/Paisajes/floresblancasyrosas_ehpvfy.jpg",
    "./img/fondos/Paisajes/floresmontañas_h8qhkd.jpg",
    "./img/fondos/Paisajes/jardinflores_eqxwe5.jpg",
    "./img/fondos/Paisajes/jardinflorescielorosas_qctpa1.jpg",
    "./img/fondos/Paisajes/lagunapastofloresrosas_gibn7c.jpg",
    "./img/fondos/Paisajes/margaritasporton_wnpdps.jpg",
    "./img/fondos/Paisajes/mariposas_mmo86f.jpg",
    "./img/fondos/Paisajes/montaña_c455zz.jpg",
    "./img/fondos/Paisajes/montañagrande_vwag5k.jpg",
    "./img/fondos/Paisajes/olascielo_igbddx.jpg",
    "./img/fondos/Paisajes/otoño2_mwn77p.jpg",
    "./img/fondos/Paisajes/otoño_kdx8u5.jpg",
    "./img/fondos/Paisajes/pastofloresrosas_i0woqq.jpg",
    "./img/fondos/Paisajes/piedrasaguamontañas_lseoki.jpg",
    "./img/fondos/Paisajes/playaarenamarolas_oxkh2z.jpg",
    "./img/fondos/Paisajes/plazaamanecer_nvjtqa.jpg",
    "./img/fondos/Paisajes/puente_gox2gz.jpg",
    "./img/fondos/Paisajes/puenteotoñoagua_r9tskw.jpg",
    "./img/fondos/Paisajes/puertaangostaflores_fvdw8o.jpg",
    "./img/fondos/Paisajes/puertafloresblancas_ouomif.jpg",
    "./img/fondos/Paisajes/puertaflroesvioletas_q4f1bq.jpg"
  ],

  acuarelas: [
    "./img/fondos/Acuarelas/Untitled_Project_10_dzbofe_hudn3p.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_10_hgtbrz.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_1_gffwqd.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_2_vdks5w.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_3_crxvum.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_rplu10_avqvn9.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_xubjvd_wyhnzq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_yp8i7h_vtja0u.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_ghlggy_ogar08.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_r3cqwb.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_wychbo.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_cf7yzv_ujyx6n.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_hnxuau_yhk6w7.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_8_h5y32e.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_b3tkxx_jgo6gs.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_zhryll.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_l02emm_gtylbq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_wefjkh.jpg",
    "./img/fondos/Acuarelas/casita_sxlvcf_s5lvth.jpg",
    "./img/fondos/Acuarelas/floresfucsias_f17kul.jpg",
    "./img/fondos/Acuarelas/lilamontañasflores_vayxei_ubvtpm.jpg",
    "./img/fondos/Acuarelas/nubepasto_w0pg1i.jpg",
    "./img/fondos/Acuarelas/rosabotes_bwnvws.jpg"
  ],

  tarjetas: [
    "./img/fondos/Tarjetas/Untitled_Project_12_oal95a.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_1_arstzx_inkdoy.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_2_wza5pr_rgvyrz.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_3_xyutfs_wwvy6h.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_fwlgtt.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_kwzbbn_iuh5nl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_uxzbsn_f1a2vp.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_zey825.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_gunjzi_t9iy0d.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_qv09sl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_8_xzqnli_opyzjn.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_9_uoqpfk_k7v565.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_tgzcpn_u75stk.jpg",
    "./img/fondos/Tarjetas/amarillopajarosnubes_ar0qqg_x9rx4p.jpg",
    "./img/fondos/Tarjetas/cielopastofloresrosas_cyfof2_dbqnq7.jpg",
    "./img/fondos/Tarjetas/cielorosa_pc0puk_b1qrvx.jpg",
    "./img/fondos/Tarjetas/flores_riug8f_whpgds.jpg"
  ]
};

const fondosEtiquetas = {
  paisajes: "Paisajes",
  acuarelas: "Acuarelas",
  tarjetas: "Tarjetas"
};

let fondoCategoriaActual = "paisajes";

// ================= ⭐ CARGAR FONDOS (CORS + URL FINAL) =======================
function cargarFondos() {
  const cont = document.getElementById("personalizarFondos");
  if (!cont) return;

  cont.innerHTML = "";

  const menuWrap = document.createElement("div");
  menuWrap.className = "dev-f1-menu-wrap";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "dev-f1-menu-btn";
  menuBtn.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
  menuBtn.title = "Elegir galería";

  const menu = document.createElement("div");
  menu.className = "dev-f1-menu";

  Object.keys(fondosCategorias).forEach(cat => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = fondosEtiquetas[cat] || cat;
    b.classList.toggle("activo", cat === fondoCategoriaActual);

    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fondoCategoriaActual = cat;
      cargarFondos();
    };

    menu.appendChild(b);
  });

  menuBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("abierto");
  };

 if (!window.__fondosMenuOutsideClickBound) {
  window.__fondosMenuOutsideClickBound = true;

  document.addEventListener("click", (e) => {
    document.querySelectorAll(".dev-f1-menu-wrap").forEach(wrap => {
      const menu = wrap.querySelector(".dev-f1-menu");
      if (menu && !wrap.contains(e.target)) {
        menu.classList.remove("abierto");
      }
    });
  });
}

  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  cont.appendChild(menuWrap);

  const fondos = fondosCategorias[fondoCategoriaActual] || [];

  fondos.forEach(baseUrl => {
    const finalUrl = baseUrl;

    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = finalUrl;

    img.style.width = "70px";
    img.style.height = "70px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.cursor = "pointer";

    img.onclick = async () => {
      try {
        if (fondoFinalBlobUrl) URL.revokeObjectURL(fondoFinalBlobUrl);

        fondoFinal = finalUrl;
        fondoFinalBlobUrl = await urlToBlobURL(finalUrl);

        actualizarPreview();
      } catch (e) {
        console.error(e);
        fondoFinal = null;
        fondoFinalBlobUrl = null;
        alert("Ese fondo no se puede usar. Probá otro o sin fondo.");
        actualizarPreview();
      }
    };

    cont.appendChild(img);
  });
}

// ================= ⭐ URLTOBLOBURL =======================
async function urlToBlobURL(url) {
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error("Fondo no disponible (CORS o 404)");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ================= ⭐ ACTUALIZAR VISTA PREVIA (FIX) 🌅 =======================
function actualizarPreview() {
  const previewImagen = document.getElementById("previewImagen");
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");

  if (!previewImagen || !previewTexto || !previewTextoBack || !wrapper) return;

  // ================= Texto para preview (Biblia o libre) =================
  asegurarCajaTextoLibrePanel();

  const textoFinal = obtenerTextoParaPreview();

  const textoSeguro = String(textoFinal || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

previewTexto.innerHTML = `<div class="preview-text-inner">${textoSeguro}</div>`;
previewTextoBack.innerHTML = `<div class="preview-text-inner">${textoSeguro}</div>`;

previewTexto.style.display = "grid";
previewTextoBack.style.display = "grid";
previewTexto.style.placeItems = "center";
previewTextoBack.style.placeItems = "center";
previewTexto.style.textAlign = "center";
previewTextoBack.style.textAlign = "center";
  
  // ================= Fondo =================
const fondoUsable = fondoFinalBlobUrl || fondoFinal;

if (fondoUsable) {
  previewImagen.style.backgroundImage = `url("${fondoUsable}")`;
} else {
  previewImagen.style.backgroundImage = "none";
}

 // ✅ Fondo: si hay imagen, dejamos TRANSPARENTE para que no aparezcan “esquinas blancas”
// ✅ Si NO hay fondo, usamos blanco para evitar negro
previewImagen.style.backgroundColor = fondoUsable ? "transparent" : "#ffffff";

  // ================= Fuente =================
  const fuente = fuenteActual || "Arial";
  previewTexto.style.fontFamily = fuente;
  previewTextoBack.style.fontFamily = fuente;

// ================= Tamaño (AUTO sugerido por MEDICION / MANUAL libre) =================
const sizeSlider = document.getElementById("personalizarTamaño");

// 1) AUTO: sugerimos midiendo si entra (NO es obligación, solo sugerencia)
if (!userSetFontSize && sizeSlider) {
  // primero ponemos un tamaño alto para que mida bien el “peor caso”
  sizeSlider.value = "64";
  previewTexto.style.fontSize = "64px";
  previewTextoBack.style.fontSize = "64px";

  const sugerido = sugerirFontSizeQueEntre(wrapper, previewTexto, previewTextoBack, 64, 10, 0.5);
  sizeSlider.value = String(sugerido);
}

// 2) MANUAL (o AUTO ya sugerido): el tamaño final SIEMPRE es el del slider
const finalSize = sizeSlider ? Number(sizeSlider.value || 32) : 32;
previewTexto.style.fontSize = finalSize + "px";
previewTextoBack.style.fontSize = finalSize + "px";

const innerFront = previewTexto.querySelector(".preview-text-inner");
const innerBack  = previewTextoBack.querySelector(".preview-text-inner");

if (innerFront) {
  innerFront.style.width = "100%";
  innerFront.style.margin = "0";
}
if (innerBack) {
  innerBack.style.width = "100%";
  innerBack.style.margin = "0";
}
  // ================= Color / Outline =================
  const colorEl = document.getElementById("personalizarColor");
  const opEl = document.getElementById("personalizarOpacidad");

  const color = colorEl ? colorEl.value : "#000000";
  const opacidad = opEl ? opEl.value : "0.3";
  const outlineColor = colorOutlineDesdeBase(color);
  const px = 0.80; // 👈 grosor del borde

  // ✅ NO tocar position acá. La define el CSS para que queden idénticos.
previewTexto.style.zIndex = "2";
previewTextoBack.style.zIndex = "1";
  
// reset acumulables (back)
previewTextoBack.style.transform = "none";     // ✅ sin desplazamiento
previewTextoBack.style.filter = "none";        // ✅ sin blur
previewTextoBack.style.textShadow = "none";

previewTexto.style.color = color;

// back: borde REAL (mejor para html2canvas)
previewTextoBack.style.color = outlineColor;                 // color del borde
previewTextoBack.style.WebkitTextStroke = `${px}px ${outlineColor}`;
previewTextoBack.style.webkitTextFillColor = "transparent"; // relleno transparente (solo borde)
previewTextoBack.style.transform = "none";
previewTextoBack.style.filter = "none";

// ✅ backup MUCHO más suave (solo 4 direcciones, no 8)
previewTextoBack.style.textShadow = `
  -${px}px 0 ${outlineColor},
   ${px}px 0 ${outlineColor},
   0 -${px}px ${outlineColor},
   0  ${px}px ${outlineColor}
`;


// ================= Opacidad Oscuro/Claro =================
const op = parseFloat(opacidad);
let bgColor = "rgba(0,0,0,0)";

const opColorEl = document.getElementById("colorOpacidadBiblia");
const opColor = opColorEl ? opColorEl.value : "#000000";

if (!isNaN(op)) {
  const hex = String(opColor || "#000000").replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map(x => x + x).join("")
    : hex.padEnd(6, "0").slice(0, 6);

  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;

  bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, op))})`;
}

wrapper.style.backgroundColor = bgColor;

  // ================= Estilos Texto =================
  const transform = textStyle?.upper ? "uppercase" : "none";

  previewTexto.style.textTransform = transform;
  previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = textStyle?.bold ? "800" : "600";
  previewTexto.style.fontStyle = textStyle?.italic ? "italic" : "normal";
  previewTexto.style.textDecoration = textStyle?.underline ? "underline" : "none";

  previewTextoBack.style.fontWeight = previewTexto.style.fontWeight;
  previewTextoBack.style.fontStyle = previewTexto.style.fontStyle;
  previewTextoBack.style.textDecoration = previewTexto.style.textDecoration;

invalidarRenderFinal();

}

// ================= ⭐ CANVAS GENERA IMAGEN FINAL (FIX REAL) ============================
async function generarImagenFinal(opts = {}) {
  const { subir = true } = opts; // ✅ por defecto sube (Finalizar), pero Descargar/Compartir pasan false

  const preview = document.getElementById("previewImagen");
  const canvasFinal = document.getElementById("canvasFinal");
  const modal = document.getElementById("modalPersonalizar");

  if (!preview || !canvasFinal) return false;

  if (modal && getComputedStyle(modal).display === "none") {
    canvasFinal.width = 0;
    canvasFinal.height = 0;
    return false;
  }

  actualizarPreview();

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await document.fonts.ready;

  const rect = preview.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return false;

  preview.classList.remove("render-final");
  const t1 = document.getElementById("previewTexto");
  const t2 = document.getElementById("previewTextoBack");
  if (t1) t1.style.display = "block";
  if (t2) t2.style.display = "block";

  const fondoUsable = fondoFinalBlobUrl || fondoFinal;

  try {
    const dpr = window.devicePixelRatio || 1;
    const SCALE = (rect.width <= 480 && rect.height <= 480) ? 1 : Math.min(2, dpr);

    if (fondoUsable && typeof fondoUsable === "string" && /^blob:|^https?:/.test(fondoUsable)) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = fondoUsable;
      });
    }

    const canvasTemp = await html2canvas(preview, {
      scale: SCALE,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      backgroundColor: fondoUsable ? null : "#ffffff"
    });

    canvasFinal.width = canvasTemp.width;
    canvasFinal.height = canvasTemp.height;

    const ctx = canvasFinal.getContext("2d");
    ctx.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    ctx.drawImage(canvasTemp, 0, 0);

  } catch (err) {
    console.error("html2canvas falló:", err);
    alert("No se pudo generar PNG. Probable problema de CORS con el fondo elegido.\nProbá con otro fondo o sin fondo.");
    return false;
  }

    // ================= ✅ SI pidieron "subir", subimos a Firebase =================
  if (subir) {
    await subirImagenBibliaUnaVezYGuardarDestinos();
  }

  
  return true;
}

// ================= ✅ CLICK SEGURO PARA DESCARGA =================
function clickLink(link) {
  document.body.appendChild(link);
  link.click();
  link.remove();
}

(function(){
  const chk = document.getElementById("checkIglesia");
  const icon = document.getElementById("iconCompartidos");
  const wrap = document.getElementById("btnCompartidosWrap");

  if (!chk || !icon || !wrap) return;

  function update(){
    if (chk.checked){
      icon.className = "fa-solid fa-check";
      wrap.classList.add("guardado");
    } else {
      icon.className = "fa-solid fa-share-nodes";
      wrap.classList.remove("guardado");
    }
  }

  chk.addEventListener("change", update);
  update();
})();

// ================= 🔥 SUBIR IMAGEN BIBLIA UNA SOLA VEZ =================
async function subirImagenBibliaBaseUnaVez() {
  if (!uid) return null;

  const canvas = document.getElementById("canvasFinal");
  if (!canvas || canvas.width < 10 || canvas.height < 10) return null;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  const ts = Date.now();
  const fileName = `versiculo_${ts}.png`;

  try {
    const fileBase64 = await blobToBase64(blob);
    const subida = await subirImagenAR2DesdeWeb(fileBase64, fileName, "image/png");

    return {
      ts,
      url: subida.url,
      storagePath: "", // ya no usamos storage
      dbPath: ""
    };

  } catch (e) {
    console.error("❌ Error subiendo a R2:", e);
    alert("No se pudo subir la imagen. Probá de nuevo.");
    return null;
  }
}

// ================= 📌 GUARDAR REFERENCIA EN MI PANEL =================
async function guardarReferenciaImagenEnPanel(asset) {
  if (!uid || !asset) return;

  const dbPath = `panelImagenesPersonal/${uid}/${asset.ts}`;

  await set(ref(db, dbPath), {
    url: asset.url,

    fecha: asset.ts,
    uid,
    tipo: "imagen",
    libro: modoImagenLibre ? "" : (libroSel?.value || ""),
    capitulo: modoImagenLibre ? 0 : Number(capSel?.value || 0),
    origen: origenModalImagen,
    tipoTexto: modoImagenLibre ? "libre" : "biblia",
    textoLibre: modoImagenLibre ? (textoLibreImagen || "") : ""
  });
}

// ================= 🌍 GUARDAR REFERENCIA EN COMPARTIDOS =================
async function guardarReferenciaImagenEnCompartidos(asset) {
  if (!uid || !asset) return;

  const dbPath = `compartidos/imagenes/${asset.ts}`;

  await set(ref(db, dbPath), {
    url: asset.url,

    fecha: asset.ts,
    uid,
    publicadoPor: uid,
    tipo: "imagen",
    libro: modoImagenLibre ? "" : (libroSel?.value || ""),
    capitulo: modoImagenLibre ? 0 : Number(capSel?.value || 0),
    origen: origenModalImagen,
    tipoTexto: modoImagenLibre ? "libre" : "biblia",
    textoLibre: modoImagenLibre ? (textoLibreImagen || "") : ""
  });
}

// ================= ✅ SUBIR UNA VEZ Y REPARTIR REFERENCIAS =================
async function subirImagenBibliaUnaVezYGuardarDestinos() {
  const asset = await subirImagenBibliaBaseUnaVez();
  if (!asset) return false;

  // ✅ siempre a Mi Panel
  await guardarReferenciaImagenEnPanel(asset);

  // ✅ opcional a Compartidos, pero si falla NO rompe todo
  const chk = document.getElementById("checkIglesia");
  if (chk && chk.checked) {
    try {
      await guardarReferenciaImagenEnCompartidos(asset);
    } catch (e) {
      console.warn("No pude publicar en Compartidos:", e);
      alert("✅ Se guardó en Mi Panel, pero no se pudo publicar en Compartidos.");
    }
  }

  console.log("✅ Imagen subida una sola vez y referenciada en destinos");
  return true;
}

// ================= ⭐ SUBIR IMAGEN (personal / iglesia) ☁️ =================
async function subirImagen(destino = "personal") {
  // ⚠️ Compatibilidad:
  // esta función ya no sube distinto por destino.
  // ahora sube UNA sola vez y guarda referencias.
  return await subirImagenBibliaUnaVezYGuardarDestinos();
}

// ======================== ⭐ OPCION DESCARGAR (FIX) ====================================
async function descargarImagenFinal() {
  return withRenderLock(async () => {
    const canvas = document.getElementById("canvasFinal");
    if (!canvas) return;

    const ok = await generarImagenFinal({ subir: false });
    if (!ok) return;

    let nombreArchivo = "versiculo.png";

    // ===== TEXTO LIBRE (Mi Panel) =====
    if (modoImagenLibre || origenModalImagen === "panel") {
      const ahora = new Date();
      const yyyy = ahora.getFullYear();
      const mm = String(ahora.getMonth() + 1).padStart(2, "0");
      const dd = String(ahora.getDate()).padStart(2, "0");
      const hh = String(ahora.getHours()).padStart(2, "0");
      const min = String(ahora.getMinutes()).padStart(2, "0");

      nombreArchivo = `img_${yyyy}-${mm}-${dd}_${hh}-${min}.png`;
    }

    // ===== VERSÍCULOS BIBLIA =====
    else {
      const ref = obtenerVersiculoSeleccionado();

      if (ref) {
        const lineaRef = ref.split("\n").pop().replace("▪", "").trim();

        const limpio = lineaRef
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/:/g, "_")
          .replace(/,/g, "")
          .replace(/[^\w\-]/g, "");

        nombreArchivo = `${limpio}.png`;
      }
    }

    const descargarDesdeDataURL = () => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = nombreArchivo;
      clickLink(link);
    };

    try {
      canvas.toBlob(blob => {
        if (!blob) return descargarDesdeDataURL();

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nombreArchivo;
        clickLink(link);
        URL.revokeObjectURL(link.href);
      }, "image/png");
    } catch (e) {
      descargarDesdeDataURL();
    }
  });
}

// ========================⭐ OPCION COMPARTIR ====================================
async function compartirImagenFinal() {
  return withRenderLock(async () => {
    const canvas = document.getElementById("canvasFinal");
    if (!canvas) return;

    const ok = await asegurarCanvasFinal({ subir: false }); // ✅ NO SUBE
    if (!ok) return;

    canvas.toBlob(async blob => {
      if (!blob) {
        await descargarImagenFinal();
        return;
      }

      const file = new File([blob], "versiculo.png", { type: "image/png" });

      try {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "Versículo" });
        } else {
          await descargarImagenFinal();
          alert("Tu dispositivo/navegador no permite compartir directo. La imagen se descargó para compartirla manualmente.");
        }
      } catch (e) {
        console.warn("Share cancelado o falló:", e);
        await descargarImagenFinal();
      }
    }, "image/png");
  });
}

// ================= ⭐ RESET DEL MODAL  =======================
function resetModalPersonalizar() {
  userSetFontSize = false;
  fondoFinal = null;
  modoImagenLibre = false;
  textoLibreImagen = "";
  origenModalImagen = "biblia";
  
  if (fondoFinalBlobUrl) {
    URL.revokeObjectURL(fondoFinalBlobUrl);
    fondoFinalBlobUrl = null;
  }

  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  fuenteActual = "Arial";

  const colorInput = document.getElementById("personalizarColor");
  if (colorInput) {
    colorInput.value = "#000000";
  }

  const preview = document.getElementById("previewImagen");
  if (preview) {
    preview.style.backgroundImage = "none";
    preview.style.backgroundColor = "#ffffff";
    preview.style.pointerEvents = "auto";
    preview.classList.remove("render-final");
  }

  const t1 = document.getElementById("previewTexto");
  const t2 = document.getElementById("previewTextoBack");
  if (t1) t1.style.display = "block";
  if (t2) t2.style.display = "block";

  const wrapper = document.getElementById("previewTextoWrapper");
  if (wrapper) {
    wrapper.style.pointerEvents = "auto";
    wrapper.style.background = "";
  }

  const fondosBox = document.getElementById("personalizarFondos");
  if (fondosBox) fondosBox.style.display = "flex";

  const btnGen = document.getElementById("btnGenerarPersonalizada");
  if (btnGen) btnGen.style.display = "inline-block";

  const acciones = document.getElementById("accionesFinales");
  if (acciones) acciones.remove();

  const boxTextoLibre = document.getElementById("boxTextoLibrePanel");
  if (boxTextoLibre) boxTextoLibre.style.display = "none";

  const inputTextoLibre = document.getElementById("textoLibrePanelInput");
  if (inputTextoLibre) inputTextoLibre.value = "";

  forceDefaultCheckIglesia();
  actualizarPreview();
}

// ================= ⭐ SALIR DEL MODO IMAGEN  ======================= 
function salirModoImagen() {
  modoImagen = false;
  seleccionImagen = {};
  fondoFinal = null;
  if (fondoFinalBlobUrl) {
  URL.revokeObjectURL(fondoFinalBlobUrl);
  fondoFinalBlobUrl = null;
}

  document.body.classList.remove("modo-imagen");

  // 🖼️ ocultar banner
  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = "none";
  }

  cerrarModalPersonalizar();

  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.classList.remove("solo-imagen", "modo-devocional");

  mostrarTexto();
  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();

}

// ================= 🔒 LOCK GLOBAL (evita doble click / doble render) =================
window.__renderLock = window.__renderLock || {
  busy: false,
  promise: null,
  lastAt: 0
};

async function withRenderLock(fn) {
  // Si ya hay un render corriendo, devolvemos la MISMA promesa
  if (window.__renderLock.busy && window.__renderLock.promise) {
    return window.__renderLock.promise;
  }

  window.__renderLock.busy = true;
  window.__renderLock.lastAt = Date.now();

  const p = (async () => {
    try {
      return await fn();
    } finally {
      window.__renderLock.busy = false;
      window.__renderLock.promise = null;
    }
  })();

  window.__renderLock.promise = p;
  return p;
}

// ================= ⭐ CACHE de render del canvasFinal =================
window.__canvasFinalCache = {
  key: "",       // firma del estado renderizado
  busy: false,   // evita renders dobles
  lastOk: false
};

function getRenderKey() {
  const preview = document.getElementById("previewImagen");
  if (!preview) return "no-preview";

  const rect = preview.getBoundingClientRect();
  const fondoUsable = (fondoFinalBlobUrl || fondoFinal || "") + "";
  const texto = (document.getElementById("previewTexto")?.textContent || "").trim();
  const font = getComputedStyle(document.getElementById("previewTexto") || preview).fontFamily || "";
  const color = getComputedStyle(document.getElementById("previewTexto") || preview).color || "";
  const opBack = getComputedStyle(document.getElementById("previewTextoBack") || preview).opacity || "";

  // ✅ incluimos tamaño porque si cambia el layout, hay que rerender
  return [
    Math.round(rect.width),
    Math.round(rect.height),
    fondoUsable,
    texto,
    font,
    color,
    opBack
  ].join("|");
}

// Marca el cache como “sucio” cuando cambias algo (fondo, texto, etc.)
function invalidarRenderFinal() {
  window.__canvasFinalCache.key = "";
  window.__canvasFinalCache.lastOk = false;
}

// Render SOLO si hace falta (si cambió algo)
async function asegurarCanvasFinal({ subir = false } = {}) {
  const modal = document.getElementById("modalPersonalizar");
  const canvas = document.getElementById("canvasFinal");
  if (!canvas) return false;

  // si el modal no está visible, no renderices
  if (modal && getComputedStyle(modal).display === "none") return false;

  const nuevaKey = getRenderKey();

  // ✅ si ya está renderizado con el mismo estado, no hacemos nada
  if (
    window.__canvasFinalCache.lastOk &&
    window.__canvasFinalCache.key === nuevaKey &&
    canvas.width > 10 && canvas.height > 10
  ) {
    // Si alguien pidió "subir", subimos sin re-render
if (subir) {
  await subirImagenBibliaUnaVezYGuardarDestinos();
}

    return true;
  }

  // ✅ evita renders simultáneos: si ya está ocupado, devolvemos false
  if (window.__canvasFinalCache.busy) return false;
  window.__canvasFinalCache.busy = true;

  try {
    // ✅ acá estaba tu bug: NO hay que llamarse a sí misma
    const ok = await generarImagenFinal({ subir: false });

    if (ok) {
      window.__canvasFinalCache.key = nuevaKey;
      window.__canvasFinalCache.lastOk = true;

if (subir) {
  await subirImagenBibliaUnaVezYGuardarDestinos();
}

    }

    return ok;
  } finally {
    window.__canvasFinalCache.busy = false;
  }
}

// ================= 🔺 WINDOW / UI ⭕ ===============================
window.irA = (seccion) => {
  const todas = ["biblia", "iglesia", "panel", "compartidos"];

  // 1) mostrar/ocultar secciones principales
  todas.forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) {
      el.style.display = (s === seccion) ? "block" : "none";
    }
  });

  // 2) clases correctas en body
  document.body.classList.remove("en-biblia", "en-iglesia", "en-panel", "en-compartidos");
  document.body.classList.add("en-" + seccion);

  // 3) marcar botón activo del menú
  document.querySelectorAll("#menu .nav-btn").forEach(b => b.classList.remove("activo"));
  const btnActivo = document.querySelector(`#menu .nav-btn[onclick="irA('${seccion}')"]`);
  if (btnActivo) btnActivo.classList.add("activo");

  // 4) defaults internos
  if (seccion === "iglesia") {
    window.mostrarIglesiaSub?.("devocionales");
    return;
  }

  if (seccion === "panel") {
    window.mostrarSeccion?.("imagenes");
    return;
  }

  if (seccion === "compartidos") {
    return;
  }

  // 5) biblia
  if (seccion === "biblia") {
    try { bibliaRestaurarUIAlVolver?.(); } catch(e){}
    try { aplicarEstadoBarra?.("biblia"); } catch(e){}
    try { mostrarTexto?.(); } catch(e){}
    try { aplicarUIAccionesPorModo?.(); } catch(e){}
  }
};

// ================= 🔺 MODO IMAGEN ===============================
window.toggleModoImagen = () => {
  if (!uid) { loginModal.style.display = "flex"; return; }

  modoImagen = !modoImagen;
  seleccionImagen = {};

  document.body.classList.toggle("modo-imagen", modoImagen);

  const banner = document.getElementById("bannerModoImagen");
  if (banner) banner.style.display = modoImagen ? "block" : "none";

  aplicarUIAccionesPorModo();          // ✅ CLAVE
  refrescarBotonGuardarMarcador();     // ✅ CLAVE

  mostrarTexto();
};

function abrirModalPersonalizar() {
  const m = document.getElementById("modalPersonalizar");
  if (!m) return;
  m.style.display = "flex";
  m.classList.add("abierto");
}

function cerrarModalPersonalizar() {
  const m = document.getElementById("modalPersonalizar");
  if (!m) return;
  m.style.display = "none";
  m.classList.remove("abierto");
}

// ================= 🔺 GENERAR IMAGEN ===============================
window.generarImagen = async () => {
  if (Object.keys(seleccionImagen).length === 0) {
    alert("Seleccioná al menos un versículo");
    return;
  }

  const modal = document.getElementById("modalPersonalizar");
  if (!modal) return;

  resetModalPersonalizar();

  origenModalImagen = "biblia";
  modoImagenLibre = false;
  textoLibreImagen = "";

  modal.classList.add("solo-imagen");
  modal.classList.remove("modo-devocional");

  abrirModalPersonalizar();
  asegurarCajaTextoLibrePanel();
  setFormatoImagen("post");
  cargarFondos();
  crearListaVisualFuentes();

  await new Promise(r => requestAnimationFrame(r));

  actualizarPreview();
};

// ================= 🔺 FUNCIÓN NUEVA PARA ABRIR EL MODAL DESDE MI PANEL ============
window.abrirCrearImagenLibrePanel = async () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  const modal = document.getElementById("modalPersonalizar");
  if (!modal) return;

  resetModalPersonalizar();

  origenModalImagen = "panel";
  modoImagenLibre = true;
  textoLibreImagen = "";

  modal.classList.add("solo-imagen");
  modal.classList.remove("modo-devocional");

  abrirModalPersonalizar();
  asegurarCajaTextoLibrePanel();
  setFormatoImagen("post");
  cargarFondos();
  crearListaVisualFuentes();

  await new Promise(r => requestAnimationFrame(r));

  asegurarCajaTextoLibrePanel();

  const input = document.getElementById("textoLibrePanelInput");
  if (input) {
    input.value = "ESCRIBÍ AQUÍ TU TEXTO";
    textoLibreImagen = input.value;
    input.focus();
    input.select();
  }

  actualizarPreview();
};

// ================= 🔺 CANCELAR CREAR IMAGEN ===============================
window.cancelarCrearImagen = () => {
  // 1️⃣ resetear mientras el modal está visible
  resetModalPersonalizar();

  // 2️⃣ salir del modo imagen (cierra modal + vuelve a biblia)
  salirModoImagen();
    // ✅ limpiar modo visual del modal
  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.classList.remove("solo-imagen", "modo-devocional");
};

// ================= ✅ FINALIZAR EDICIÓN (CONFIRMAR) =================
window.finalizarEdicion = async (ev) => {
  if (window.__FINALIZANDO__) return;
  window.__FINALIZANDO__ = true;

  const btn = ev?.currentTarget;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    btn.style.opacity = "0.65";
  }

  try {
    const ok = await subirImagenBibliaUnaVezYGuardarDestinos();
    if (!ok) throw new Error("No se pudo guardar la imagen");

    if (typeof devToast === "function") {
      devToast("✅ Imagen guardada");
    }

    resetModalPersonalizar();
    salirModoImagen();
  } catch (e) {
    console.error(e);
    alert("❌ Error al guardar\n\n" + (e?.message || e));
  } finally {
    window.__FINALIZANDO__ = false;

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
      btn.style.opacity = "";
    }
  }
};

// ================= 🔺 CAMBIAR LETRA ===============================
// ✅ Router: + y - cambian según la sección visible (Biblia o ABC)
window.cambiarLetra = (delta) => {
  // =========================
  // ✅ Si estoy en ABC -> SOLO ABC
  // =========================
  const secIglesia = document.getElementById("seccion-iglesia");
  const subABC = document.getElementById("iglesia-abc");
  const estoyEnABC =
    !!(secIglesia && secIglesia.style.display !== "none" &&
       subABC && subABC.style.display !== "none");

  if (estoyEnABC) {
    window.abcFontSize = Math.max(12, Math.min(28, (window.abcFontSize || 18) + delta));
    const doc = document.getElementById("abcDoc");
    if (doc) doc.style.setProperty("--abc-font", window.abcFontSize + "px");
    return;
  }

  // =========================
  // ✅ Si NO estoy en ABC -> Biblia (tu lógica actual)
  // =========================
  size = Math.max(14, size + delta * 2);
  mostrarTexto();
};

// ================= 🔺 TOGGLE TEMA ===============================
// ================= 🌙 TOGGLE TEMA (ANIMADO + ICONO + REPINTAR) =================
window.toggleTema = () => {
  const btn = document.querySelector('#header button[onclick="toggleTema()"]');

  // animación
  if (btn) {
    btn.classList.add("animar");
    setTimeout(() => btn.classList.remove("animar"), 350);
  }

  // toggle modo
  const oscuro = document.body.classList.toggle("oscuro");
  localStorage.setItem("modoOscuro", oscuro ? "1" : "0");

  // cambiar ícono
  if (btn) btn.textContent = oscuro ? "☀️" : "🌙";

  // ✅ FIX: repintar colores de versículos YA MISMO
  mostrarTexto();

  // ✅ FIX: si el modal está abierto, refrescar preview YA MISMO
  const modal = document.getElementById("modalPersonalizar");
  if (modal && modal.style.display === "flex") {
    actualizarPreview();
  }
};

// ================= ✨ RESTAURAR MODO OSCURO + ICONO =================
(() => {
  const oscuro = localStorage.getItem("modoOscuro") === "1";
  if (oscuro) document.body.classList.add("oscuro");

  const btn = document.querySelector('#header button[onclick="toggleTema()"]');
  if (btn) btn.textContent = oscuro ? "☀️" : "🌙";
})();


// ================= 🔺 LOGOUT ===============================
window.logout = () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
};

// ================= 🔺 MARCADOR ===================
// ================= 📌 BOTÓN 1: MODO MARCADOR 📌 =================
window.toggleModoMarcador = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  // si estaba modo imagen, lo apagamos
  if (modoImagen) salirModoImagen();

  modoMarcador = !modoMarcador;

  if (!modoMarcador) {
    seleccionMarcador = {};
  }

  document.body.classList.toggle("modo-marcador", modoMarcador);

  // ✅ botón correcto (ahora está en la barra)
  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.toggle("activo", modoMarcador);

  // banner fijo marcador
  const banner = document.getElementById("bannerModoMarcador");
  if (banner) banner.style.display = modoMarcador ? "block" : "none";

  // ✅ ocultar/mostrar acciones según modo
  aplicarUIAccionesPorModo();

  mostrarTexto();
  refrescarBotonGuardarMarcador();
  renderPreviewVersiculosMarcador(); // por si está abierto el form
};

// ================= 📁 BOTÓN 2: LISTA MARCADORES 📌=================
// ================= 📁 BOTÓN: ABRIR MODAL MARCADORES =================
window.abrirMarcadores = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  if (!modal || !lista || !form) return;

  const abierto = getComputedStyle(modal).display !== "none";

  // ✅ si ya está abierto, cerrar prolijo
  if (abierto) {
    cerrarMarcadores();
    return;
  }

  // ✅ IMPORTANTÍSIMO: limpiar display inline que lo deja muerto después de guardar
  modal.style.display = "flex";

  // ✅ por defecto abrir lista
  form.style.display = "none";
  lista.style.display = "block";

  renderListaMarcadores();
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
};

// ================= ✨ edita marcador desde lista 📌=================
window.editarMarcadorDesdeLista = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  // ✅ marcamos “modo edición”
  window.__editMarcadorId = idMarcador;
  window.__editMarcadorBase = {
  ...m,
  libro: !((m.versiculos || []).length) ? "" : (m.libro || ""),
  capitulo: !((m.versiculos || []).length) ? 0 : Number(m.capitulo || 0),
  versiculos: !((m.versiculos || []).length) ? [] : (m.versiculos || []).map(Number),
  ref: !((m.versiculos || []).length) ? "" : (m.ref || "")
};
  
creandoNotaLibre = !((m.versiculos || []).length > 0);
  // ✅ abrimos el formulario (sin depender de selección)
  abrirFormNuevoMarcador();

  // ✅ precargar campos
document.getElementById("marcadorTitulo").value = m.titulo || "";
document.getElementById("marcadorNota").value   = m.nota || "";
document.getElementById("marcadorColor").value  = m.color || "#fff3b0";

const chkKeep = document.getElementById("marcadorKeep");
if (txtKeep) {
  txtKeep.textContent = esNotaLibre ? "⭐ Destacar nota" : "📌 Mantener resaltado";
}
const esNotaLibre = !m.libro && !(m.versiculos || []).length;

if (chkKeep) chkKeep.checked = !!(m.destacada || m.keep);

if (lblKeep) {
  lblKeep.innerHTML = esNotaLibre ? `⭐ Destacar nota` : `📌 Mantener resaltado`;
}

  // ✅ refrescar preview para edición
  renderPreviewVersiculosMarcador();
};

// ================= ✨ Cerrar Marcadores 📌=================
window.cerrarMarcadores = () => {

  try {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
} catch(e){}
  
  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");

  const ctx = (typeof window.getMarcadorCtx === "function")
    ? window.getMarcadorCtx()
    : { origen: "biblia" };

  const estabaEditandoABC =
    ctx?.origen === "abc" &&
    form &&
    getComputedStyle(form).display !== "none";

  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }

  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";

  try {
    const secIglesia = document.getElementById("seccion-iglesia");
    const subABC = document.getElementById("iglesia-abc");
    const estoyEnABC =
      !!(secIglesia && secIglesia.style.display !== "none" &&
         subABC && subABC.style.display !== "none");

    if (estoyEnABC) {
      // ✅ si cerré el form de una nota ABC, vuelvo a ABC normal
      if (estabaEditandoABC) {
        window.__abcEditMarcadorId = null;
        window.setMarcadorCtx("biblia");
        if (typeof abcResetModoMarcador === "function") abcResetModoMarcador();
      }

      if (typeof abcAplicarUIAccionesPorModo === "function") abcAplicarUIAccionesPorModo();
      if (typeof abcHabilitarCheckUI === "function") abcHabilitarCheckUI();
      if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
      return;
    }
  } catch(e){}

  refrescarBotonGuardarMarcador();
};

// ================= ✨ Render Lista Marcadores 📌=================
function renderListaMarcadores() {
  const lista = document.getElementById("listaMarcadores");
  if (!lista) return;

const items = Object.entries(marcadores || {})
  .map(([id, m]) => ({ ...m, id }))
  .filter(m => m?.origen !== "abc")   // ✅ NO mezclar ABC en lista Biblia
  .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  // CTA Guardar (solo si está en modo marcador y hay selección)
  let header = "";
  if (modoMarcador && Object.keys(seleccionMarcador).length > 0) {
    header = `
      <div class="card-marcador" style="background:#fff3b0;">
        <b>Guardar nuevo marcador</b><br>
        <button type="button" onclick="abrirFormNuevoMarcador()"
          style="margin-top:8px; border:none; border-radius:999px; padding:8px 12px; cursor:pointer; background:#4f6fa8; color:#fff;">
          Continuar
        </button>
      </div>
    `;
  }

  if (items.length === 0) {
    lista.innerHTML = header + `<p class="muted">Todavía no guardaste marcadores.</p>`;
    return;
  }

  lista.innerHTML =
    header +
    items.map(m => {
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleDateString("es-AR") : "";
      const refTxt = m.ref || (m.libro && m.capitulo ? `${m.libro} ${m.capitulo}` : "Nota");
      const titulo = (m.titulo || "Marcador").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const linea = `${refTxt} - ${fechaTxt} - ${titulo}`;

      return `
        <div class="card-marcador" style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div style="cursor:pointer; flex:1; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"
               onclick="abrirMarcador('${m.id}')">
            ${linea}
          </div>

          <button type="button" class="pm-btn"
                  onclick="editarMarcadorDesdeLista('${m.id}')"
                  title="Editar">✏️</button>
        </div>
      `;
    }).join("");
}

// ================= ✨ RENDER PREVIEW VERSICULOS MARCADOR 📌=================
function renderPreviewVersiculosMarcador() {
  const box = document.getElementById("previewVersiculosMarcador");
  if (!box) return;

  const form = document.getElementById("formNuevoMarcador");
  const formVisible = form && getComputedStyle(form).display !== "none";
  if (!formVisible) {
    box.innerHTML = "";
    return;
  }

  if (creandoNotaLibre) {
  box.innerHTML = "";
  return;
}

  // ✅ si estoy en contexto ABC, no renderices preview bíblica
  const ctx = window.getMarcadorCtx ? window.getMarcadorCtx() : { origen: "biblia" };
  if (ctx.origen === "abc") {
    box.innerHTML = "";
    return;
  }

  // ✅ prioridad 1: si estoy editando, usar base original
  const base = window.__editMarcadorBase || null;
  let versiculos = [];
  let libro = "";
  let cap = 0;

  if (base && Array.isArray(base.versiculos) && base.versiculos.length) {
    versiculos = base.versiculos.map(Number).filter(n => !isNaN(n));
    libro = base.libro || libroSel.value;
    cap = Number(base.capitulo || capSel.value || 0);
  } else {
    // ✅ prioridad 2: selección actual
    const ids = Object.keys(seleccionMarcador || {});
    if (ids.length === 0) {
      box.innerHTML = "";
      return;
    }

    versiculos = ids.map(id => Number(id.split("_")[2])).filter(n => !isNaN(n));
    libro = libroSel.value;
    cap = Number(capSel.value);
  }

  versiculos.sort((a,b) => a - b);

  const partes = versiculos.map(n => {
    const vv = bibliaData.find(x => x.Libro === libro && x.Capitulo == cap && x.Versiculo == n);
   const txt = vv ? getTextoVersiculo(vv) : "";
    return `<div><span style="opacity:.75">${n}</span> ${txt}</div>`;
  }).join("");

  box.innerHTML = partes;
}

// ================= ✨ Abrir Form Nuevo Marcador 📌=================
window.abrirFormNuevoMarcador = () => {
  window.setMarcadorCtx("biblia");

  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const info = document.getElementById("infoMarcadorNuevo");
  const chkKeep = document.getElementById("marcadorKeep");
  const txtKeep = document.getElementById("txtMarcadorKeep");

  if (!lista || !form || !info) return;

  const base = window.__editMarcadorBase || null;
  const versBase = Array.isArray(base?.versiculos) ? base.versiculos.map(Number).filter(n => !isNaN(n)) : [];
  const esLibre = creandoNotaLibre || (!!base && versBase.length === 0);

  if (esLibre) {
    info.textContent = `🗒 Nota (sin versículo) · ${new Date().toLocaleDateString("es-AR")}`;
    if (chkKeep) chkKeep.checked = !!(base?.destacada || base?.keep);
    if (txtKeep) txtKeep.textContent = "⭐ Destacar nota";
  } else {
    const ids = Object.keys(seleccionMarcador || {});
    const nums = versBase.length
      ? versBase.slice().sort((a,b)=>a-b)
      : ids.map(id => Number(id.split("_")[2])).filter(n => !isNaN(n)).sort((a,b)=>a-b);

    const libro = base?.libro || libroSel.value;
    const capitulo = Number(base?.capitulo || capSel.value || 0);
    const rango = formatearVersiculosComoRango(nums);
    const refTxt = `${libro} ${capitulo}:${rango}`;

    const hoy = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    info.textContent = `📌 ${refTxt} · ${hoy}`;
    if (chkKeep) chkKeep.checked = !!base?.keep;
    if (txtKeep) txtKeep.textContent = "📌 Mantener resaltado";
  }

if (!window.__editMarcadorId) {
  document.getElementById("marcadorTitulo").value = "";
  document.getElementById("marcadorNota").value = "";

  // ✅ color visible + real
  syncMarcadorColorUI(colorActual || "#fff3b0");

  // ✅ por default tildado también en nota libre
  if (chkKeep) chkKeep.checked = true;
}

  lista.style.display = "none";
  form.style.display = "block";
  renderPreviewVersiculosMarcador();
};

// ================= ❌ Cancelar Nuevo Marcador 📌=================
window.cancelarNuevoMarcador = () => {
  // cerrar modal marcadores y volver a lista
  const modal = document.getElementById("modalMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const lista = document.getElementById("listaMarcadores");

  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;
  creandoNotaLibre = false;

  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";

  // ✅ si estoy en Panel (seccion-panel visible) NO dejo modo marcador prendido
  const seccionPanel = document.getElementById("seccion-panel");
  const estoyEnPanel = seccionPanel && seccionPanel.style.display !== "none";
  if (estoyEnPanel) {
    salirModoMarcadorLimpio();
  }

  // ✅ SI ESTOY EN ABC → volver a modo normal (sin marcador)
  try {
    const ctx = (typeof window.getMarcadorCtx === "function")
      ? window.getMarcadorCtx()
      : { origen: "biblia" };

    const secIglesia = document.getElementById("seccion-iglesia");
    const subABC = document.getElementById("iglesia-abc");

    const estoyEnABC =
      !!(secIglesia && secIglesia.style.display !== "none" &&
         subABC && subABC.style.display !== "none");

    if (estoyEnABC && ctx.origen === "abc") {

      window.__abcEditMarcadorId = null;

      // volver contexto normal
      if (typeof window.setMarcadorCtx === "function") {
        window.setMarcadorCtx("biblia");
      }

      // resetear modo marcador
      if (typeof abcResetModoMarcador === "function") {
        abcResetModoMarcador();
      }

      // reconstruir UI ABC
      if (typeof abcAplicarUIAccionesPorModo === "function") {
        abcAplicarUIAccionesPorModo();
      }

      if (typeof abcHabilitarCheckUI === "function") {
        abcHabilitarCheckUI();
      }

      if (typeof abcMarcarSeleccionUI === "function") {
        abcMarcarSeleccionUI();
      }

      return;
    }

  } catch(e) {}

};

// ================= ✨ Guardar Nuevo Marcador 📌=================
async function guardarNuevoMarcador() {
  try {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }

const titulo = (document.getElementById("marcadorTitulo")?.value || "").trim();
const nota = (document.getElementById("marcadorNota")?.value || "").trim();
const color = document.getElementById("marcadorColor")?.value || "#fff3b0";
const keep = !!document.getElementById("marcadorKeep")?.checked;
const destacada = creandoNotaLibre ? keep : false;

    if (!titulo) {
      mostrarToast("Poné un título 🙏");
      return;
    }

const editId = window.__editMarcadorId || null;
const base = window.__editMarcadorBase || null;

const esNotaLibre = !!creandoNotaLibre;

const libro = esNotaLibre ? "" : (base?.libro || libroSel?.value || "");
const capitulo = esNotaLibre ? 0 : Number(base?.capitulo ?? capSel?.value ?? 0);

const versiculos = esNotaLibre
  ? []
  : ((base?.versiculos && Array.isArray(base.versiculos))
      ? base.versiculos.map(Number).filter(n => !isNaN(n))
      : Object.keys(seleccionMarcador || {})
          .map(x => Number(x.split("_").pop()))
          .filter(n => !isNaN(n)));

    if (!creandoNotaLibre && versiculos.length === 0) {
      mostrarToast("Seleccioná al menos 1 versículo 📌");
      return;
    }

const data = {
  titulo,
  nota,
  color,
  keep: creandoNotaLibre ? false : keep,
  destacada,
  libro,
  capitulo,
  versiculos,
  fecha: Date.now()
};

    const id = editId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const ruta = `marcadores/${uid}/${id}`;

    await set(ref(db, ruta), data);

    seleccionMarcador = {};
    creandoNotaLibre = false;
    ultimoMarcadorAplicado = data.keep ? data : null;

    window.__editMarcadorId = null;
    window.__editMarcadorBase = null;

    // ✅ cerrar SIEMPRE prolijo
    cerrarMarcadores();

    mostrarToast(editId ? "✅ Marcador actualizado" : "✅ Marcador guardado");
    mostrarTexto();
    refrescarBotonGuardarMarcador();

    // ✅ salir completamente del modo marcador
    if (typeof salirModoMarcadorLimpio === "function") {
      salirModoMarcadorLimpio();
    } else {
      modoMarcador = false;
      seleccionMarcador = {};
      document.body.classList.remove("modo-marcador");

      const btnPin = document.getElementById("btnModoMarcadorBarra");
      if (btnPin) btnPin.classList.remove("activo");

      const banner = document.getElementById("bannerModoMarcador");
      if (banner) banner.style.display = "none";

      aplicarUIAccionesPorModo();
      refrescarBotonGuardarMarcador();
      renderPreviewVersiculosMarcador();
      mostrarTexto();
    }

  } catch (e) {
    console.error("❌ Error guardando marcador:", e);

    const msg = String(e?.message || "");
    const code = String(e?.code || "");

    if (msg.includes("PERMISSION_DENIED") || code.includes("permission-denied")) {
      mostrarToast("⛔ No tenés permiso para guardar (reglas Firebase)");
    } else {
      mostrarToast("❌ No se pudo guardar el marcador");
    }
  }
}

// ================= ✨ Abrir Marcador 📌=================
window.abrirMarcador = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  libroSel.value = m.libro;
  cargarCapitulos();
  capSel.value = m.capitulo;
  mostrarTexto();

  ultimoMarcadorAplicado = m.keep ? m : null;

  cerrarMarcadores();
  setTimeout(mostrarTexto, 50);

  // ✅ scroll al primer versículo del marcador
  const primero = (m.versiculos || [])[0];
  if (primero) {
    const idV = `${m.libro}_${m.capitulo}_${primero}`;
    setTimeout(() => {
      const el = document.querySelector(`.versiculo[data-id="${idV}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }
};

// ================= ✨ Refrescar Botones Marcador (✅ y 📁) 📌=================
function refrescarBotonGuardarMarcador() {
  const btnGuardar = document.getElementById("btnGuardarMarcador");   // ✅
  const btnLista = document.getElementById("btnListaMarcadores");     // list
  if (!btnGuardar) return;

  const haySeleccion = Object.keys(seleccionMarcador || {}).length > 0;

  // ✅ aparece solo en modo marcador + hay selección
  btnGuardar.style.display = (modoMarcador && haySeleccion) ? "inline-flex" : "none";
  btnGuardar.disabled = !haySeleccion;
  btnGuardar.style.opacity = haySeleccion ? "1" : "0.4";

  // ✅ lista solo visible cuando NO estás en modo marcador
  if (btnLista) btnLista.style.display = modoMarcador ? "none" : "inline-flex";

  aplicarUIAccionesPorModo();
}

// ================= ✨ Guardar Marcador Rapido 📌 (abre formulario directo)=================
window.guardarMarcadorRapido = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }
  if (!modoMarcador) return;

  const seleccion = Object.keys(seleccionMarcador || {});
  if (seleccion.length === 0) {
    mostrarToast("Seleccioná al menos 1 versículo 📌");
    return;
  }

  // ✅ Abrir modal
  abrirMarcadores();

  // ✅ Pasar directo al formulario
  setTimeout(() => {
    abrirFormNuevoMarcador();
  }, 0);
};

// ================= 🔺RENDER PANEL MARCADORES con orden: fecha o libro/capítulo 📌===================
// (dejá donde ya esté esto en tu archivo)
let ordenMarcadores = "fecha"; // "fecha" | "biblia"

// (dejá estas)
let modoEliminarMarcadores = false;
let seleccionEliminarMarcadores = {}; // {id:true}

// (agregá esta si no existe en otro lado)
let filtroNotasPanel = "todas"; // "todas" | "con" | "sin" | "abc"
let menuFiltroNotasPanelAbierto = false;

function renderPanelMarcadores() {
  const panel = document.getElementById("panel-marcadores");
  if (!panel) return;

  const items = Object.entries(marcadores || {}).map(([id, m]) => ({ ...m, id }));

  const ordenados = items.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  const filtrados = ordenados.filter(m => {
    const tieneNota = !!(m.nota && String(m.nota).trim());
    if (!tieneNota) return false;

    const esABC = (m?.origen === "abc");
    const cantVers = (m.versiculos || []).length;

    if (filtroNotasPanel === "todas") return true;
    if (filtroNotasPanel === "abc") return esABC;
    if (filtroNotasPanel === "con") return !esABC && cantVers > 0;
    if (filtroNotasPanel === "sin") return !esABC && cantVers === 0;

    return true;
  });

  const cantSel = Object.keys(seleccionEliminarMarcadores || {}).length;

  const tituloPanel =
    filtroNotasPanel === "todas"
      ? "📝 Todas las notas"
      : filtroNotasPanel === "con"
        ? "📌 Notas de Biblia"
        : filtroNotasPanel === "sin"
          ? "🗒 Notas libres"
          : "🎓 Notas ABC";

  const filtroActualIcono =
    filtroNotasPanel === "todas"
      ? `<i class="fa-solid fa-list-check"></i>`
      : filtroNotasPanel === "con"
        ? `<i class="fa-solid fa-thumbtack"></i>`
        : filtroNotasPanel === "sin"
          ? `<i class="fa-solid fa-sheet-plastic"></i>`
          : `<i class="fa-solid fa-graduation-cap"></i>`;

  panel.innerHTML = `
    <div class="panel-marcadores-bar">
      <div class="pm-left">
        <b>${tituloPanel}</b>
        <div class="pm-sub muted" style="font-size:12px; margin-top:2px;">
          orden: más recientes primero
        </div>
      </div>

      <div class="pm-right" style="position:relative;">
        <button type="button" class="pm-btn" onclick="abrirNotaLibre()" title="Agregar nota">
          <i class="fa-solid fa-square-plus"></i>
        </button>

        <button type="button" class="pm-btn" onclick="toggleMenuFiltroNotasPanel()" title="Filtrar notas">
          ${filtroActualIcono}
        </button>

        <button type="button" class="pm-btn" onclick="toggleModoEliminarMarcadores()" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>

    ${menuFiltroNotasPanelAbierto ? `
      <div style="display:flex; gap:16px; justify-content:flex-end; align-items:flex-start; margin:-4px 0 12px 0; flex-wrap:wrap;">
        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('todas')" title="Todas">
          <span class="pm-filter-icon ${filtroNotasPanel === "todas" ? "activo" : ""}">
            <i class="fa-solid fa-list-check"></i>
          </span>
          <span class="pm-filter-label">Todas</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('con')" title="Biblia">
          <span class="pm-filter-icon ${filtroNotasPanel === "con" ? "activo" : ""}">
            <i class="fa-solid fa-thumbtack"></i>
          </span>
          <span class="pm-filter-label">Biblia</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('sin')" title="Libres">
          <span class="pm-filter-icon ${filtroNotasPanel === "sin" ? "activo" : ""}">
            <i class="fa-solid fa-sheet-plastic"></i>
          </span>
          <span class="pm-filter-label">Libres</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('abc')" title="ABC">
          <span class="pm-filter-icon ${filtroNotasPanel === "abc" ? "activo" : ""}">
            <i class="fa-solid fa-graduation-cap"></i>
          </span>
          <span class="pm-filter-label">ABC</span>
        </button>
      </div>
    ` : ``}

    ${modoEliminarMarcadores && cantSel > 0 ? `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button type="button" onclick="confirmarEliminarMarcadores()"
          style="border:none; border-radius:999px; padding:10px 14px; cursor:pointer; background:#d9534f; color:#fff;">
          Eliminar (${cantSel})
        </button>
      </div>
    ` : ``}

    ${filtrados.length ? filtrados.map(m => {
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleString("es-AR") : "";

      let refTxt = "Nota libre";

      // ✅ ABC
      if (m?.origen === "abc") {
        const temaABC = String(m?.abc?.temaTitulo || "").trim();
        refTxt = temaABC ? `ABC - ${temaABC}` : "ABC";
      }

      // ✅ Biblia
      else if ((m.versiculos || []).length > 0) {
        if (m.ref && String(m.ref).trim()) {
          refTxt = m.ref.trim();
        } else if (m.libro && m.capitulo) {
          const vers = (m.versiculos || []).map(Number).sort((a, b) => a - b);

          if (vers.length === 1) {
            refTxt = `${m.libro} ${m.capitulo}:${vers[0]}`;
          } else if (vers.length > 1) {
            refTxt = `${m.libro} ${m.capitulo}:${vers[0]}-${vers[vers.length - 1]}`;
          } else {
            refTxt = `${m.libro} ${m.capitulo}`;
          }
        }
      }

      const checked = !!(seleccionEliminarMarcadores && seleccionEliminarMarcadores[m.id]);

      let textoVers = "";
      let textoABC = "";

      if (m?.origen === "abc") {
        textoABC = String(m?.abcTexto || "").trim();
      }

      if (m.libro && m.capitulo && (m.versiculos || []).length) {
        const partes = (m.versiculos || []).map(n => {
          const vv = bibliaData.find(x => x.Libro === m.libro && x.Capitulo == m.capitulo && x.Versiculo == n);
          return vv ? getTextoVersiculo(vv) : "";
        }).filter(Boolean);

        if (partes.length) textoVers = partes.join(" ");
      }

      const bgDestacada = (m.destacada || m.keep) ? (m.color || "#fff3b0") : "";
      const colorTextoDestacada = bgDestacada ? colorContraste(bgDestacada) : "";

      return `
        <div class="card-marcador" style="${bgDestacada ? `background:${bgDestacada} !important; color:${colorTextoDestacada} !important; border:1px solid rgba(0,0,0,.10);` : ""}">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-size:13px;">
              <b>${m.destacada ? "⭐ " : ""}${m.titulo || "Marcador"}</b><br>
              <span class="${bgDestacada ? "" : "muted"}">${refTxt} · ${fechaTxt}</span>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
              ${modoEliminarMarcadores ? `
                <input type="checkbox" ${checked ? "checked":""}
                  onchange="toggleSeleccionEliminarMarcador('${m.id}', this.checked)">
              ` : `
                ${(((m.versiculos || []).length > 0) || m?.origen === "abc") ? `
                  <button type="button" class="pm-btn" onclick="abrirMarcadorDesdePanel('${m.id}')" title="Volver">
                    <i class="fa-solid fa-reply"></i>
                  </button>
                ` : ""}

                <button type="button" class="pm-btn" onclick="editarMarcadorEnPanel('${m.id}')" title="Editar">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>

                <button type="button" class="pm-btn" onclick="abrirCompartirMarcador('${m.id}')" title="Compartir">
                  <i class="fa-solid fa-share-nodes"></i>
                </button>
              `}
            </div>
          </div>

          ${textoVers ? `<div class="nota preview-versiculos-marcador" style="margin-top:8px;">${textoVers}</div>` : ""}
          ${(!textoVers && textoABC) ? `<div class="nota preview-versiculos-marcador" style="margin-top:8px;">${textoABC}</div>` : ""}
          ${m.nota ? `<div class="nota">${m.nota}</div>` : ""}
        </div>
      `;
    }).join("") : `<p style="opacity:.75">Todavía no tenés notas para este filtro.</p>`}
  `;
}

window.toggleMenuFiltroNotasPanel = () => {
  menuFiltroNotasPanelAbierto = !menuFiltroNotasPanelAbierto;
  renderPanelMarcadores();
};

window.setFiltroNotasPanel = (filtro) => {
  filtroNotasPanel = filtro || "todas";
  menuFiltroNotasPanelAbierto = false;
  renderPanelMarcadores();
};

// ================= TOGGLES PANEL (iconos tipo sol/luna) =================
window.toggleOrdenMarcadoresPanel = () => {
  ordenMarcadores = (ordenMarcadores === "fecha") ? "biblia" : "fecha";
  renderPanelMarcadores();
};

window.abrirMarcadorDesdePanel = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  const esNotaLibre = !(m.versiculos || []).length;

if (esNotaLibre) {
  mostrarToast("Esta nota es libre y no tiene versículo para volver");
  return;
}

  // ✅ si es ABC, ir a Iglesia > ABC
  if (m.origen === "abc" && m.abc) {
    irA("iglesia"); // tu router principal
    setTimeout(async () => {
      // mostrar sub-sección abc (ajustá si tu función se llama distinto)
      if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("abc");
      if (typeof window.mostrarABC === "function") await window.mostrarABC();

      // cargar el tema
      if (typeof m.abc.temaIndex === "number") {
        abcIndex = m.abc.temaIndex;
        await cargarABCTema(true);
      }

      // seleccionar bloque y abrir nota
      if (m.abcBid) {
        abcSeleccionado = m.abcBid;
        abcMarcarSeleccionUI();
        const doc = document.getElementById("abcDoc");
        const el = doc ? doc.querySelector(`.abc-block[data-bid="${m.abcBid}"]`) : null;
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"center" });
        setTimeout(()=> abcAbrirNota(), 150);
      }
    }, 0);
    return;
  }

  // ✅ si NO es ABC, es Biblia como antes
  irA("biblia");
  setTimeout(() => {
    abrirMarcador(idMarcador);
  }, 0);
};

// ================= Editar marcador desde Mi Panel (reusa tu modal) 📌===================
window.editarMarcadorEnPanel = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  const esNotaLibre = !((m.versiculos || []).length > 0);

  // ✅ primero marcar que estoy editando
  window.__editMarcadorId = idMarcador;
  creandoNotaLibre = esNotaLibre;

  // ✅ guardar base correcta ANTES de abrir el form
  window.__editMarcadorBase = {
    libro: esNotaLibre ? "" : (m.libro || ""),
    capitulo: esNotaLibre ? 0 : Number(m.capitulo || 0),
    versiculos: esNotaLibre ? [] : (m.versiculos || []).map(Number),
    ref: esNotaLibre ? "" : (m.ref || ""),
    destacada: !!m.destacada,
    keep: !!m.keep
  };

  abrirMarcadores(); // abre modal

  setTimeout(() => {
    abrirFormNuevoMarcador();

    const inputTitulo = document.getElementById("marcadorTitulo");
    const inputNota = document.getElementById("marcadorNota");
    const inputColor = document.getElementById("marcadorColor");
    const chkKeep = document.getElementById("marcadorKeep");
    const txtKeep = document.getElementById("txtMarcadorKeep");

    if (inputTitulo) inputTitulo.value = m.titulo || "";
    if (inputNota) inputNota.value = m.nota || "";
    if (inputColor) inputColor.value = m.color || "#fff3b0";
    if (chkKeep) chkKeep.checked = !!(m.destacada || m.keep);

    if (txtKeep) {
      txtKeep.textContent = esNotaLibre ? "⭐ Destacar nota" : "📌 Mantener resaltado";
    }

    renderPreviewVersiculosMarcador();
  }, 0);
};

// ================= 🔺 TOGGLE MODO ELIMINAR MARCADORES ===================
window.toggleModoEliminarMarcadores = () => {
  modoEliminarMarcadores = !modoEliminarMarcadores;
  if (!modoEliminarMarcadores) seleccionEliminarMarcadores = {};
  renderPanelMarcadores();
};

// ================= 🔺 SELECCIONAR ELIMINAR MARCADOR ===================
window.toggleSeleccionEliminarMarcador = (id, checked) => {
  if (checked) seleccionEliminarMarcadores[id] = true;
  else delete seleccionEliminarMarcadores[id];
  renderPanelMarcadores();
};


// ================= 🔺 LIMPUAR RESALTADRO DE ABC NOTAS ==============
async function limpiarResaltadoABCDeMarcador(marcador) {
  try {
    if (!marcador) return;
    if (marcador?.origen !== "abc") return;

    const temaIndex = Number(marcador?.abc?.temaIndex);
    const bids = Array.isArray(marcador?.abcBids)
      ? marcador.abcBids
      : (marcador?.abcBid ? [marcador.abcBid] : []);

    if (!Number.isFinite(temaIndex) || !bids.length) return;

    const fb = window.__FB || {};
    const api = window.__FB_API || {};
    const db = fb.db;
    const refFn = api.ref;
    const removeFn = api.remove;

    if (!db || !refFn || !removeFn) return;

    // 1) borrar de Firebase
    for (const bid of bids) {
      try {
        await removeFn(refFn(db, `abcResaltados/${uid}/${temaIndex}/${bid}`));
      } catch (e) {
        console.warn("No pude borrar resaltado ABC:", bid, e);
      }
    }

    // 2) limpiar cache global si existe
    if (window.abcResaltadosCache) {
      bids.forEach(bid => delete window.abcResaltadosCache[bid]);
    }

    // 3) si estoy viendo ese tema, limpiar visualmente YA
    const doc = document.getElementById("abcDoc");
    if (doc) {
      bids.forEach(bid => {
        const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
        if (el && typeof abcLimpiarFondoBloque === "function") {
          abcLimpiarFondoBloque(el);
        }
      });
    }

    // 4) refrescar UI ABC
    if (typeof abcRebuildBloqueadosKeep === "function") abcRebuildBloqueadosKeep();
    if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();

  } catch (e) {
    console.warn("No pude limpiar resaltado ABC del marcador:", e);
  }
}

// ================= 🔺 CONFIRMAR ELIMINAR MARCADORES ===================
window.confirmarEliminarMarcadores = async () => {
  const ids = Object.keys(seleccionEliminarMarcadores);
  if (ids.length === 0) return;

  const ok = confirm(`¿Seguro que querés borrar ${ids.length} marcador(es)?\n\nEsto NO se puede deshacer.`);
  if (!ok) return;

  try {
    for (const id of ids) {
      const marcador = (marcadores || {})[id] || (window.marcadores || {})[id] || null;

      // ✅ si es ABC, borrar también su resaltado guardado
      await limpiarResaltadoABCDeMarcador(marcador);

      // ✅ si era Biblia y justo quedó aplicado en memoria, limpiarlo
      if (
        marcador &&
        marcador?.origen !== "abc" &&
        ultimoMarcadorAplicado &&
        ultimoMarcadorAplicado.libro === marcador.libro &&
        Number(ultimoMarcadorAplicado.capitulo) === Number(marcador.capitulo) &&
        JSON.stringify((ultimoMarcadorAplicado.versiculos || []).map(Number).sort((a,b)=>a-b)) ===
        JSON.stringify((marcador.versiculos || []).map(Number).sort((a,b)=>a-b))
      ) {
        ultimoMarcadorAplicado = null;
      }

      // ✅ borrar marcador
      await remove(ref(db, `marcadores/${uid}/${id}`));

      // ✅ limpiar cache local
      if (window.marcadores && window.marcadores[id]) delete window.marcadores[id];
      if (marcadores && marcadores[id]) delete marcadores[id];
    }

    seleccionEliminarMarcadores = {};
    modoEliminarMarcadores = false;

    // ✅ reconstruir estado ABC
    if (typeof abcRebuildBloqueadosKeep === "function") abcRebuildBloqueadosKeep();

    // ✅ refrescar ABC si estoy ahí
    if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
    if (typeof abcAplicarUIAccionesPorModo === "function") abcAplicarUIAccionesPorModo();

    // ✅ refrescar Biblia / Panel
    mostrarTexto();
    renderPanelMarcadores();
    refrescarBotonGuardarMarcador();

    // ✅ extra: si estoy en ABC actual, asegurar limpieza visual completa
const doc = document.getElementById("abcDoc");
if (doc) {
  doc.querySelectorAll(".abc-block").forEach(b => {
    const bid = b.dataset.bid;
    const cache = window.abcResaltadosCache || {};
    if (!cache[bid]) {
      b.style.setProperty("background", "transparent", "important");
      b.style.setProperty("background-color", "transparent", "important");

      b.querySelectorAll("*").forEach(x => {
        x.style.setProperty("background", "transparent", "important");
        x.style.setProperty("background-color", "transparent", "important");
      });
    }
  });
}
    mostrarToast("🗑️ Marcadores eliminados");
  } catch (e) {
    console.error(e);
    mostrarToast("❌ No se pudo borrar");
  }
};

// ================= 🔺 LIMPIAR PINTADO DE MARCADOR ELIMINADO ===================
async function limpiarPintadoDeMarcadorEliminado(idMarcador, marcador) {
  try {
    if (!marcador) return;

    // =========================
    // ✅ BIBLIA: si era el último aplicado, limpiarlo
    // =========================
    if (ultimoMarcadorAplicado && (
      (ultimoMarcadorAplicado.id && ultimoMarcadorAplicado.id === idMarcador) ||
      (
        ultimoMarcadorAplicado.libro === marcador.libro &&
        Number(ultimoMarcadorAplicado.capitulo) === Number(marcador.capitulo) &&
        JSON.stringify((ultimoMarcadorAplicado.versiculos || []).map(Number).sort((a,b)=>a-b)) ===
        JSON.stringify((marcador.versiculos || []).map(Number).sort((a,b)=>a-b))
      )
    )) {
      ultimoMarcadorAplicado = null;
    }

    // =========================
    // ✅ ABC: borrar resaltados guardados de esa nota
    // =========================
    if (marcador?.origen === "abc") {
      const bids = Array.isArray(marcador?.abcBids)
        ? marcador.abcBids
        : (marcador?.abcBid ? [marcador.abcBid] : []);

      const temaIndex = marcador?.abc?.temaIndex;

      if (uid && bids.length && typeof temaIndex === "number") {
        const { db } = FB();
        const { ref, remove } = API();

        if (db && ref && remove) {
          for (const bid of bids) {
            try {
              await remove(ref(db, `abcResaltados/${uid}/${temaIndex}/${bid}`));
            } catch(e) {
              console.warn("No pude borrar resaltado ABC:", bid, e);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("No pude limpiar pintado del marcador eliminado:", e);
  }
}

function syncMarcadorColorUI(hex = "#fff3b0") {
  const inputColor = document.getElementById("marcadorColor");
  const host = document.getElementById("marcadorColorHost");

  if (inputColor) {
    inputColor.value = hex;
    inputColor.setAttribute("value", hex);
    inputColor.dispatchEvent(new Event("input", { bubbles: true }));
    inputColor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (host) {
    host.style.setProperty("--pickr-color", hex);
    host.style.background = hex;
    host.dataset.color = hex;
    host.setAttribute("data-color", hex);
  }

  try {
    if (host && host._pickr) {
      host._pickr.setColor(hex);
    }
  } catch (e) {
    console.warn("No pude sincronizar Pickr de marcador:", e);
  }
}

// ================= ✅ NUEVA NOTA SIN VERSÍCULO =================
window.abrirNotaLibre = () => {
  creandoNotaLibre = true;
  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;
  window.setMarcadorCtx("biblia");

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const info = document.getElementById("infoMarcadorNuevo");
  const inputTitulo = document.getElementById("marcadorTitulo");
  const inputNota = document.getElementById("marcadorNota");
  const chkKeep = document.getElementById("marcadorKeep");
  const txtKeep = document.getElementById("txtMarcadorKeep");

  if (!modal || !lista || !form || !info) return;

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  info.textContent = `🗒 Nota libre · ${new Date().toLocaleDateString("es-AR")}`;

  if (inputTitulo) inputTitulo.value = "";
  if (inputNota) inputNota.value = "";

  // ✅ color default REAL + visual
  syncMarcadorColorUI("#fff3b0");

  // ✅ destacar nota por default
  if (chkKeep) chkKeep.checked = true;
  if (txtKeep) txtKeep.textContent = "⭐ Destacar nota";

  lista.style.display = "none";
  form.style.display = "block";

  renderPreviewVersiculosMarcador();

  // ✅ pequeño refuerzo visual por si Pickr repinta tarde
  requestAnimationFrame(() => {
    syncMarcadorColorUI("#fff3b0");
  });
};

// ================= 🔺 RENDERPANELIMAGENES ===================
function renderPanelImagenes(data) {
  const grid = document.getElementById("grid-imagenes"); // compatibilidad
  const vacio = document.getElementById("imagenes-vacio");
  const topRow = document.getElementById("panelImgTopRow");
  const indexRow = document.getElementById("panelImgIndexRow");
  const feed = document.getElementById("panelImgFeed");

  if (!vacio || !indexRow || !feed) return;
  if (grid) grid.innerHTML = "";

  const items = Object.entries(data || {})
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  function esc(txt = "") {
    return String(txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function capitalizarCitaBonitaPanel(s){
    s = String(s || "").trim();
    if (!s) return "";

    return s
      .toLocaleLowerCase("es")
      .split(/\s+/)
      .map(palabra => {
        if (!palabra) return palabra;
        if (/^\d+$/.test(palabra)) return palabra;
        return palabra.charAt(0).toLocaleUpperCase("es") + palabra.slice(1);
      })
      .join(" ");
  }

  function normalizarUrlPanel(url){
    let s = String(url || "").trim();
    if (!s) return "";

    // ✅ arregla URLs viejas tipo /pub-... o ./pub-...
    if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(s)) {
      s = "https://" + s.replace(/^(?:\.\/|\/)+/, "");
    }

    // ✅ arregla https:/algo -> https://algo
    s = s.replace(/^https:\//i, "https://");
    s = s.replace(/^http:\//i, "http://");

    return esc(s);
  }

  function refBonitaPanel(it){
    const cita = capitalizarCitaBonitaPanel(it.cita || "");
    const refBiblia = (it.libro && it.capitulo) ? `${it.libro} ${it.capitulo}` : "";
    const versiculo = capitalizarCitaBonitaPanel(it.versiculo || "");

    if (cita) return cita;
    if (refBiblia) return refBiblia;
    if (versiculo) return versiculo.length > 60 ? versiculo.slice(0, 60) + "…" : versiculo;
    return "Imagen";
  }

  function esDevocional(it){
    return it?.origen === "devocional" || it?.tipoTexto === "devocional";
  }

  if (topRow) {
    topRow.innerHTML = `
      <button
        type="button"
        class="btn-primary"
        style="flex:0 0 auto; align-self:flex-start;"
        onclick="event.preventDefault(); event.stopPropagation(); abrirCrearImagenLibrePanel(); return false;">
        <i class="fa-solid fa-circle-plus"></i>
      </button>
    `;
  }

  if (!items.length) {
    vacio.style.display = "block";
    indexRow.innerHTML = "";
    feed.innerHTML = "";
    return;
  }

  vacio.style.display = "none";

  // índice horizontal arriba
  indexRow.innerHTML = items.map(it => {
    const refTxt = esc(refBonitaPanel(it));
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = normalizarUrlPanel(it.url || "");

    return `
      <div class="devIndexCard" onclick="document.getElementById('panelImgBig_${it.id}')?.scrollIntoView({behavior:'smooth', block:'start'})">
        <div class="devIndexBar devIndexBarTop">${refTxt}</div>

        <div class="devIndexImgWrap">
          ${url ? `<img src="${url}" loading="lazy">` : `<div class="devIndexImgFallback">Sin imagen</div>`}
        </div>

        <div class="devIndexBar devIndexBarBottom">${fechaTxt}</div>
      </div>
    `;
  }).join("");

  // feed grande abajo
  feed.innerHTML = items.map(it => {
    const refTxt = esc(refBonitaPanel(it));
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = normalizarUrlPanel(it.url || "");
    const audioUrl = normalizarUrlPanel(it.audioGithubUrl || "");
    const textoDev = esc(it.textoLibre || "");

    return `
      <div class="devBigCard" id="panelImgBig_${it.id}">
        <div class="devIndexBar devIndexBarTop">${refTxt}</div>

        ${
          url
            ? `<img src="${url}" alt="Imagen generada" loading="lazy">`
            : `<div class="devBigImgFallback">Sin imagen</div>`
        }

        ${esDevocional(it) && audioUrl ? `
          <div style="margin-top:10px;">
            <audio controls preload="metadata" style="width:100%;">
              <source src="${audioUrl}" type="audio/mpeg">
            </audio>
          </div>
        ` : ``}

        ${esDevocional(it) && textoDev ? `
          <div style="margin-top:10px; white-space:pre-wrap; line-height:1.4;">
            ${textoDev}
          </div>
        ` : ``}

        <div style="margin-top:8px; opacity:.7; font-size:12px;">${fechaTxt}</div>

        <div class="devBigActions">
          <button class="btn-primary" type="button"
            onclick="descargarImagenPanel('${url}')"
            aria-label="Descargar PNG">
            <i class="fa-solid fa-download"></i>
          </button>

          <button class="btn-primary" type="button"
            onclick="compartirImagenPanel('${url}')"
            aria-label="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>

          <button class="btn-danger" type="button"
            onclick="eliminarImagenPanel('${it.id}')"
            aria-label="Eliminar">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ================= 🔺 CAPITULO ANTERIOR ===================
window.capituloAnterior = () => {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  const libroActual = libroSel.value;
  const idxLibroActual = libros.indexOf(libroActual);

  // 1) si todavía hay capítulo anterior dentro del mismo libro
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;

    mostrarTexto({ irArriba: false, guardar: true });

    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollCapituloAnterior || 0,
        behavior: "auto"
      });
    });
    return;
  }

  // 2) si está en capítulo 1, ir al libro anterior en su último capítulo
  if (idxLibroActual > 0) {
    const libroAnterior = libros[idxLibroActual - 1];

    libroSel.value = libroAnterior;

    const capsLibroAnterior = [...new Set(
      bibliaData
        .filter(v => v.Libro === libroAnterior)
        .map(v => Number(v.Capitulo))
    )].sort((a, b) => a - b);

    const ultimoCapitulo = capsLibroAnterior[capsLibroAnterior.length - 1] || 1;

    cargarCapitulos({
      capituloPreferido: ultimoCapitulo,
      irArriba: false,
      guardar: true
    });

    // ✅ al cambiar al libro anterior, quedar abajo del todo
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "auto"
      });
    });
  }

  // 3) si ya está en Génesis 1, no hace nada
};

// ================= 🔺 CAPITULO SIGUIENTE ===================
window.capituloSiguiente = () => {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  const libroActual = libroSel.value;
  const idxLibroActual = libros.indexOf(libroActual);

  // 📌 guardo dónde estaba antes de avanzar
  scrollCapituloAnterior = window.scrollY || document.documentElement.scrollTop || 0;

  // 1) si todavía hay capítulo siguiente dentro del mismo libro
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;

    mostrarTexto({ irArriba: false, guardar: true });

    requestAnimationFrame(() => {
      irArribaBiblia();
    });
    return;
  }

  // 2) si ya estaba en el último capítulo, pasar al siguiente libro capítulo 1
  if (idxLibroActual >= 0 && idxLibroActual < libros.length - 1) {
    const siguienteLibro = libros[idxLibroActual + 1];

    libroSel.value = siguienteLibro;

    cargarCapitulos({
      capituloPreferido: 1,
      irArriba: false,
      guardar: true
    });

    requestAnimationFrame(() => {
      irArribaBiblia();
    });
  }

  // 3) si ya está en Apocalipsis 22, no hace nada
};

// ================= 🔍 TOGGLE FILTROS BIBLIA =================
window.toggleFiltrosBiblia = () => {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  if (!wrap) return;

  const abierto = wrap.classList.contains("abierto");

  if (abierto) {
    cerrarFiltrosBiblia(true); // tocar botón otra vez = cancelar
  } else {
    abrirFiltrosBiblia();
  }
};

// ================= CERRAR FILTROS AL TOCAR AFUERA =================
document.addEventListener("click", (e) => {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn = document.getElementById("btnToggleFiltros");
  const titulo = document.getElementById("titulo");

  if (!wrap) return;
  if (!wrap.classList.contains("abierto")) return;

  if (
    wrap.contains(e.target) ||
    (btn && btn.contains(e.target)) ||
    (titulo && titulo.contains(e.target))
  ) {
    return;
  }

  cerrarFiltrosBiblia(true); // afuera = cancelar
});

// ================= 🔺 PANEL ===================
window.mostrarSeccion = (tipo) => {
  ["imagenes", "marcadores"].forEach(s => {
    const el = document.getElementById("panel-" + s);
    if (el) el.style.display = (s === tipo ? "block" : "none");
  });

  if (tipo === "marcadores") renderPanelMarcadores();

  // ✅ marcar tab activo SOLO en Panel
  const tabsPanel = document.querySelectorAll("#seccion-panel .panel-tabs button");
  tabsPanel.forEach(b => b.classList.remove("activo"));

  const btn = document.querySelector(`#seccion-panel .panel-tabs button[onclick="mostrarSeccion('${tipo}')"]`);
  if (btn) btn.classList.add("activo");
};

// ================= 🔺 IR A LOGIN ===================
window.irALogin = () => {
  window.location.href = "login.html";
};

// ================= 🔺 CERRAR LOGIN ===================
window.cerrarLogin = () => {
  loginModal.style.display = "none";
};

// ================= 🔺 TEXTO MAYUSCULAR ===================
window.toggleUpper = () => {
  textStyle.upper = !textStyle.upper;
  const b = document.getElementById("btnUpper");
  if (b) b.classList.toggle("activo", textStyle.upper);
  actualizarPreview();
};

// ================= 🔺 TEXTO NEGRITA ===================
window.toggleBold = () => {
  textStyle.bold = !textStyle.bold;
  const b = document.getElementById("btnBold");
  if (b) b.classList.toggle("activo", textStyle.bold);
  actualizarPreview();
};

// ================= 🔺 TEXTO ITALIC ===================
window.toggleItalic = () => {
  textStyle.italic = !textStyle.italic;
  const b = document.getElementById("btnItalic");
  if (b) b.classList.toggle("activo", textStyle.italic);
  actualizarPreview();
};

// ================= 🔺 TEXTO UNDERLINE ===================
window.toggleUnderline = () => {
  textStyle.underline = !textStyle.underline;
  const b = document.getElementById("btnUnderline");
  if (b) b.classList.toggle("activo", textStyle.underline);
  actualizarPreview();
};

// ================= 🔺 SET FORMATO IMAGEN ===========================
window.setFormatoImagen = tipo => {
  formatoImagenActual = (tipo === "story") ? "story" : "post";

  const preview = document.getElementById("previewImagen");
  if (!preview) return;

  preview.classList.remove("preview-post", "preview-story");
  preview.classList.add(formatoImagenActual === "story" ? "preview-story" : "preview-post");

  const bToggle = document.getElementById("btnFormatoToggle");
 if (bToggle) {
  bToggle.title = formatoImagenActual === "story" ? "Cambiar a post" : "Cambiar a story";

  // ✅ Cambiar icono dinámicamente
  bToggle.innerHTML = formatoImagenActual === "story"
    ? '<i class="fa-solid fa-mobile"></i>'   // story
    : '<i class="fa-solid fa-tablet"></i>';  // post
}

  actualizarPreview();

  if (typeof posicionarListaFuentes === "function") {
    const lf = document.getElementById("listaFuentes");
    if (lf && lf.classList.contains("abierto")) posicionarListaFuentes();
  }
};

window.toggleFormatoImagen = function() {
  const siguiente = formatoImagenActual === "post" ? "story" : "post";
  setFormatoImagen(siguiente);
};

// ================= 🔺 CAMBIAR TAMAÑO (+/-) LIBRE ===========================
window.cambiarTamanoPreview = (delta) => {
  userSetFontSize = true; // ✅ al tocar +/-, ya es manual

  const inp = document.getElementById("personalizarTamaño");
  if (!inp) return;

  const step = 0.5; // ✅ medio punto
  const cur = Number(inp.value || 32);
  const next = cur + (delta * step);

  inp.value = String(next);
  actualizarPreview();
};

// ===============================
// ✅ Estado de barra por sección (Biblia vs ABC)
// ===============================
window.__barraState = window.__barraState || {
  bibliaOculta: false,
  abcOculta: false
};

function estoyEnABCAhora(){
  const secIglesia = document.getElementById("seccion-iglesia");
  const subABC = document.getElementById("iglesia-abc");
  return !!(secIglesia && secIglesia.style.display !== "none" &&
            subABC && subABC.style.display !== "none");
}

function ctxBarraActual(){
  return estoyEnABCAhora() ? "abc" : "biblia";
}

function aplicarEstadoBarra(ctx){
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");
  if (!bar || !btn) return;

  const oculta = (ctx === "abc") ? !!window.__barraState.abcOculta
                                 : !!window.__barraState.bibliaOculta;

  // clase global (ok) PERO la manejamos según contexto
  document.body.classList.toggle("barra-oculta", oculta);

  // ✅ regla: si barra visible => botón flotante NO
  // ✅ si barra oculta  => botón flotante SÍ
  bar.style.display = oculta ? "none" : "";
  btn.style.display = oculta ? "inline-flex" : "none";
  btn.style.opacity = oculta ? "0.55" : "0.55"; // tu default
}

window.aplicarEstadoBarra = aplicarEstadoBarra;

// ================= 🔺 OCLTAR BARRA DE ACCIONES ===========================
let timerBarra = null;

window.ocultarBarraAcciones = () => {
  const ctx = ctxBarraActual();

  if (ctx === "abc") window.__barraState.abcOculta = true;
  else window.__barraState.bibliaOculta = true;

  aplicarEstadoBarra(ctx);

  // 🔥 después de unos segundos lo dejo más transparente
  clearTimeout(timerBarra);
  timerBarra = setTimeout(() => {
    const btn = document.getElementById("btnMostrarBarra");
    if (btn) btn.style.opacity = "0.35";
  }, 2500);
};

// ================= 🔺 MOSTRAR BARRA DE ACCIONES ===========================
window.mostrarBarraAcciones = () => {
  const ctx = ctxBarraActual();

  if (ctx === "abc") window.__barraState.abcOculta = false;
  else window.__barraState.bibliaOculta = false;

  clearTimeout(timerBarra);
  aplicarEstadoBarra(ctx);
};

// ================= 🔺 ABRIR COMPARTIR MARCADOR ===========================
let __compartirMarcadorId = null;

window.abrirCompartirMarcador = (id) => {
  __compartirMarcadorId = id;
  const modal = document.getElementById("modalCompartirMarcador");
  if (modal) {
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");
  }
};

// ================= 🔺 CERRAR COMPARTIR MARCADOR ===========================
window.cerrarCompartirMarcador = () => {
  __compartirMarcadorId = null;
  const modal = document.getElementById("modalCompartirMarcador");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden","true");
  }
};

// ================= 🔺 COMPARTIR MARCADOR ===========================
window.compartirMarcador = async (destino) => {
  const id = __compartirMarcadorId;
  if (!id) return;

  const m = (marcadores || {})[id];
  if (!m) return;

  // armar texto
  let textoVers = "";
  if (m.libro && m.capitulo && (m.versiculos || []).length) {
    const partes = (m.versiculos || []).map(n => {
      const vv = bibliaData.find(x => x.Libro === m.libro && x.Capitulo == m.capitulo && x.Versiculo == n);
    return vv ? getTextoVersiculo(vv) : "";
    }).filter(Boolean);
    textoVers = partes.join(" ");
  }

  const payload = [
    m.titulo ? `*${m.titulo}*` : "",
    m.ref ? m.ref : "Nota",
    textoVers,
    m.nota || ""
  ].filter(Boolean).join("\n\n");

  if (destino === "redes") {
    try {
      if (navigator.share) {
        await navigator.share({ text: payload, title: "Marcador" });
      } else {
        await navigator.clipboard.writeText(payload);
        alert("Tu dispositivo no permite compartir directo. Copié el texto al portapapeles.");
      }
    } catch (e) {
      console.error(e);
    }
    cerrarCompartirMarcador();
    return;
  }

  // destino = iglesia: guardar copia en DB
  // destino = compartidos: guardar copia en DB
  try {
    const ts = Date.now();

    await set(ref(db, `compartidos/notas/${ts}`), {
      ...m,
      uid,
      tipo: "nota",
      publicadoPor: uid,
      publicadoEn: ts
    });

    mostrarToast("✅ Compartido en Compartidos");
  } catch (e) {
    console.error(e);
    mostrarToast("❌ No se pudo compartir");
  }

  cerrarCompartirMarcador();
};

// ================= 🔺 FORCE DEFAULT CHECK IGLESIA estado pinta css ===========================
function forceDefaultCheckIglesia() {
  const chk = document.getElementById("checkIglesia");
  if (!chk) return;
  chk.checked = true; // ✅ siempre por defecto
}

// ================= UI: ocultar acciones al entrar en modo marcador =================
function aplicarUIAccionesPorModo() {
  const acciones = document.getElementById("accionesBiblia");
  if (!acciones) return;

  const btnModo = document.getElementById("btnModoMarcadorBarra"); // 📌
  const btnGuardar = document.getElementById("btnGuardarMarcador"); // ✅
  const btnLista = document.getElementById("btnListaMarcadores"); // list
  const btnImagen = document.getElementById("btnImagen"); // panorama
  const btnCrear = document.getElementById("btnCrearImagen"); // Crear Imagen

  const normales = acciones.querySelectorAll(".accion-normal, #resaltadorCompacto");

  // ✅ MODO IMAGEN: ocultar marcadores + mostrar Crear Imagen
  if (modoImagen) {
    normales.forEach(el => (el.style.display = "none"));

    if (btnImagen) btnImagen.style.display = "inline-flex";
    if (btnCrear) btnCrear.style.display = "inline-flex";

    if (btnModo) btnModo.style.display = "none";
    if (btnGuardar) btnGuardar.style.display = "none";
    if (btnLista) btnLista.style.display = "none";
    return;
  }

  // ✅ MODO MARCADOR
  if (modoMarcador) {
    normales.forEach(el => (el.style.display = "none"));

    if (btnModo) btnModo.style.display = "inline-flex";
    if (btnLista) btnLista.style.display = "none";
    if (btnImagen) btnImagen.style.display = "none";
    if (btnCrear) btnCrear.style.display = "none";
    return;
  }

  // ✅ MODO NORMAL
  normales.forEach(el => (el.style.display = ""));
  if (btnModo) btnModo.style.display = "inline-flex";
  if (btnLista) btnLista.style.display = "inline-flex";
  if (btnImagen) btnImagen.style.display = "inline-flex";
  if (btnCrear) btnCrear.style.display = "none";
}

window.aplicarUIAccionesPorModo = aplicarUIAccionesPorModo;
// ================= Salir de modal limpio ================
function salirModoMarcadorLimpio() {
  modoMarcador = false;
  seleccionMarcador = {};
  document.body.classList.remove("modo-marcador");

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.remove("activo");

  const banner = document.getElementById("bannerModoMarcador");
  if (banner) banner.style.display = "none";

  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();
  renderPreviewVersiculosMarcador();
  mostrarTexto();

}

// ================= 🔺 HACER FUNCIONES GLOBALES (FIX DESCARGAR/COMPARTIR EN PC) =================
window.generarImagenFinal = generarImagenFinal;
window.descargarImagenFinal = descargarImagenFinal;
window.compartirImagenFinal = compartirImagenFinal;
window.finalizarEdicion = window.finalizarEdicion;
window.cancelarCrearImagen = window.cancelarCrearImagen;

// ================= ✅ INIT ÚNICO =================
document.addEventListener("DOMContentLoaded", () => {
  // 1) UI resaltador
  initResaltadorCompacto();

    // ================= 🎨 modal editar paleta =================
  const btnCerrarPaleta = document.getElementById("cerrarModalEditarPaleta");
  if (btnCerrarPaleta) {
    btnCerrarPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalEditarPaletaResaltador();
    };
  }

  const btnGuardarPaleta = document.getElementById("btnGuardarPaletaResaltador");
  if (btnGuardarPaleta) {
    btnGuardarPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      guardarModalEditarPaletaResaltador();
    };
  }

  const btnResetPaleta = document.getElementById("btnResetPaletaResaltador");
  if (btnResetPaleta) {
    btnResetPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetearPaletaResaltador();
    };
  }

  const modalEditarPaleta = document.getElementById("modalEditarPaletaResaltador");
  if (modalEditarPaleta) {
    modalEditarPaleta.addEventListener("click", (e) => {
      if (e.target === modalEditarPaleta) cerrarModalEditarPaletaResaltador();
    });
  }

  // 2) check iglesia por defecto
  forceDefaultCheckIglesia();

  // 3) listeners botones (sin depender del onclick en HTML)
  const btnGuardar = document.getElementById("btnGuardarMarcador");
  if (btnGuardar) {
    btnGuardar.type = "button";
    btnGuardar.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      guardarMarcadorRapido();
    };
  }

  const btnModo = document.getElementById("btnModoMarcadorBarra");
  if (btnModo) {
    btnModo.type = "button";
    btnModo.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleModoMarcador();
    };
  }

  const b = document.getElementById("btnGuardarNuevoMarcador");
  if (b) {
    b.type = "button";
    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ctx = getMarcadorCtx();

      if (ctx.origen === "abc") {
  await window.guardarNuevoMarcadorABC();
} else {
  await guardarNuevoMarcador();
}
    };
  }

  // ✅ NUEVO: botón 🔍 (si lo querés sin onclick en HTML)
  const btnFiltros = document.getElementById("btnToggleFiltros");
  if (btnFiltros) {
    btnFiltros.type = "button";
    btnFiltros.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleFiltrosBiblia();
    };
  }

  const tituloBiblia = document.getElementById("titulo");
if (tituloBiblia) {
  tituloBiblia.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      toggleFiltrosBiblia();
    }
  });
}

const inputBuscarLibro = document.getElementById("buscarLibroBiblia");
const selectLibro = document.getElementById("libro");

if (inputBuscarLibro && selectLibro) {
  inputBuscarLibro.addEventListener("input", () => {
    const q = normalizarTextoFiltro(inputBuscarLibro.value);
    const opciones = Array.from(selectLibro.options);

    let primeraCoincidencia = null;

    opciones.forEach(opt => {
      const textoNormalizado = normalizarTextoFiltro(opt.text);
      const ok = !q || textoNormalizado.includes(q);

      opt.hidden = !ok;
      if (ok && !primeraCoincidencia) primeraCoincidencia = opt;
    });

    if (primeraCoincidencia) {
      selectLibro.value = primeraCoincidencia.value;

      // ✅ al cambiar de libro desde el buscador, mostrar capítulo 1 en el filtro
      reconstruirCapitulosParaLibro(primeraCoincidencia.value, 1);
    }
  });

  inputBuscarLibro.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      aplicarFiltrosBiblia();
    }
  });
}
    
// 4) arrancar en iglesia
window.irA?.("iglesia");

document.body.classList.remove("en-biblia", "en-iglesia", "en-panel", "en-compartidos");
document.body.classList.add("en-iglesia");

// cuando Firebase confirma el usuario
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  cargarResaltadoresUsuario();
});

// asegurar filtros cerrados al iniciar
const secBiblia = document.getElementById("seccion-biblia");
if (secBiblia) secBiblia.classList.remove("filtros-abiertos");
  
// ================= 🔺 IGLESIA: SUB-SECCIONES =================
window.mostrarIglesiaSub = (sub) => {
  // ✅ detecto si estaba en ABC antes
  const abcAntes = document.getElementById("iglesia-abc");
  const estabaEnABC = !!(abcAntes && abcAntes.style.display !== "none");

  // ✅ si salgo de ABC a otro sub, apago ABC (devuelvo barra + resetea modo)
  if (estabaEnABC && sub !== "abc") {
    window.__abcOnExit?.();
  }

["devocionales", "abc", "subidos", "recursos"].forEach(k => {
    const el = document.getElementById("iglesia-" + k);
    if (el) el.style.display = (k === sub) ? "block" : "none";
  });

  const wrap = document.getElementById("seccion-iglesia");
  if (wrap) {
    wrap.querySelectorAll(".iglesia-tab, .nav-btn, button").forEach(b => b.classList.remove("activo"));
    const btn = wrap.querySelector(`[onclick="mostrarIglesiaSub('${sub}')"]`);
    if (btn) btn.classList.add("activo");
  }

  // ✅ cuando entro a ABC: inicializo ABC + engancho barra SIEMPRE
  // ✅ cuando entro a ABC: guardo estado de Biblia y apago modos para que NO contaminen ABC
  if (sub === "abc") {
    try { bibliaBackupUI(); } catch(e){}
    try { bibliaApagarModosParaCambiarSeccion(); } catch(e){}

    window.mostrarABC?.();
    window.__abcOnEnter?.();
  }

  if (sub === "recursos") {
  window.mostrarRecursosSub?.("rh");
}
};

// ================= SELECTOR DE COLORES REUTILIZABLE =====  
setTimeout(() => {
  initPickrEnHosts(
    "#personalizarColorHost, #marcadorColorHost, #dev1ColorHost, #dev1OpColorHost, #dev2ColorHost, #colorFondoPlanoHost, #dev2FondoHost, #colorOpacidadBibliaHost, #colorFondoAppHost"
  );
}, 0);

const btn = document.getElementById("btnAplicarFiltrosBiblia");
if (btn && !btn.__ready) {
  btn.__ready = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    aplicarFiltrosBiblia();
  });
}
  
}); // ================= ✅ CIERRA INIT ÚNICO =====

// ================= IGLESIA > DEVOCIONALES (UI + CARGA) =================
function devMostrarHome() {
  const home = document.getElementById("devHome");
  const crear = document.getElementById("devCrear");
  if (home) home.style.display = "block";
  if (crear) crear.style.display = "none";
}

function devMostrarCrear() {
  const home = document.getElementById("devHome");
  const crear = document.getElementById("devCrear");
  if (home) home.style.display = "none";
  if (crear) crear.style.display = "block";
}

// Render mínimo (para que NO se vea vacío)
function renderDevFeed(items) {
  const feed = document.getElementById("devFeed");
  if (!feed) return;

  if (!items.length) {
    feed.innerHTML = `
      <div style="opacity:.8; padding:12px; border:1px dashed #ccc; border-radius:12px;">
        No hay devocionales todavía.
      </div>
    `;
    return;
  }

  feed.innerHTML = items.map(d => {
    const titulo = (d.titulo || "Devocional").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const fecha = d.fecha ? new Date(d.fecha).toLocaleDateString("es-AR") : "";
    const texto  = (d.texto || "").toString().slice(0, 220).replace(/</g,"&lt;").replace(/>/g,"&gt;");

    return `
      <div style="border:1px solid #e5e5e5; border-radius:14px; padding:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; gap:10px;">
          <b>${titulo}</b>
          <span style="opacity:.65; font-size:12px;">${fecha}</span>
        </div>
        <div style="margin-top:8px; opacity:.9; white-space:pre-wrap;">${texto}</div>
      </div>
    `;
  }).join("");
}

// Lee devocionales de Iglesia (ruta estándar)
function initDevocionalesIglesiaFeed() {
  const feed = document.getElementById("devFeed");
  if (feed) feed.innerHTML = `<div style="opacity:.7; padding:12px;">Cargando devocionales...</div>`;

  // ✅ Ruta sugerida (si tu proyecto usa otra, la cambiamos)
  const r = ref(db, "devocionalesIglesia");

  onValue(r, (s) => {
    const data = s.val() || {};
    const items = Object.entries(data)
      .map(([id, obj]) => ({ id, ...(obj || {}) }))
      .sort((a,b) => (b.fecha || 0) - (a.fecha || 0));

    renderDevFeed(items);
  }, (err) => {
    console.error("Devocionales read error:", err);
    if (feed) {
      feed.innerHTML = `
        <div style="padding:12px; border:1px solid #f1c0c0; background:#fff5f5; border-radius:12px;">
          No pude leer devocionales (permiso o ruta). Mirá consola (F12).
        </div>
      `;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // botón +
  const btnNuevo = document.getElementById("btnDevNuevo");
  if (btnNuevo) {
    btnNuevo.type = "button";
    btnNuevo.onclick = () => {
      if (!window.__ES_ADMIN) return; // solo admin
      devMostrarCrear();
    };
  }

  // volver
  const btnVolver = document.getElementById("btnDevVolverHome");
  if (btnVolver) {
    btnVolver.type = "button";
    btnVolver.onclick = () => devMostrarHome();
  }

  // default: Home visible
  devMostrarHome();

  // cargar feed (para que no se vea vacío)
  initDevocionalesIglesiaFeed();
});

window.descargarImagenPanel = async (url) => {
  try {
    const r = await fetch(url);
    const blob = await r.blob();

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "imagen_panel.png";
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) {
    console.error(e);
    alert("No se pudo descargar la imagen.");
  }
};

window.compartirImagenPanel = async (url) => {
  try {

    if (navigator.share) {
      await navigator.share({
        title: "Vida Abundante",
        url
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("Link copiado para compartir");

  } catch(e){
    console.error(e);
  }
};

window.eliminarImagenPanel = async (id) => {
  if (!confirm("¿Eliminar esta imagen de Mi Panel?")) return;

  try {
    const uid = window.__UID;

    // ✅ solo borra la referencia del panel
    // ❌ NO borra el archivo de Storage
    // porque puede estar compartido también en "Compartidos"
    await remove(ref(db, `panelImagenesPersonal/${uid}/${id}`));

  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar la imagen");
  }
};

(function initScrollTopGlobal(){
  const btn = document.getElementById("btnScrollTopGlobal");
  if (!btn) return;

  function seccionVisible(id) {
    const el = document.getElementById(id);
    return !!el && getComputedStyle(el).display !== "none";
  }

  function obtenerContenedorScrollActivo() {
    const candidatos = [
      document.getElementById("iglesia-devocionales"),
      document.getElementById("iglesia-subidos"),
      document.getElementById("panel-imagenes"),
      document.getElementById("panel-marcadores"),
      document.getElementById("seccion-iglesia"),
      document.getElementById("seccion-panel")
    ].filter(Boolean);

    for (const el of candidatos) {
      const st = getComputedStyle(el);
      const tieneScrollInterno =
        (st.overflowY === "auto" || st.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 10 &&
        st.display !== "none";

      if (tieneScrollInterno) return el;
    }

    return window;
  }

  function hayZonaActiva() {
    return (
      seccionVisible("iglesia-devocionales") ||
      seccionVisible("iglesia-subidos") ||
      seccionVisible("panel-imagenes") ||
      seccionVisible("panel-marcadores")
    );
  }

  function obtenerScrollActual() {
    const cont = obtenerContenedorScrollActivo();
    return cont === window ? window.scrollY : cont.scrollTop;
  }

  function actualizarBotonScrollTop() {
    if (hayZonaActiva() && obtenerScrollActual() > 260) {
      btn.classList.add("mostrar");
    } else {
      btn.classList.remove("mostrar");
    }
  }

  window.addEventListener("scroll", actualizarBotonScrollTop, { passive: true });
  window.addEventListener("resize", actualizarBotonScrollTop);

  ["iglesia-devocionales", "iglesia-subidos", "panel-imagenes", "panel-marcadores", "seccion-iglesia", "seccion-panel"]
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener("scroll", actualizarBotonScrollTop, { passive: true });
    });

  btn.addEventListener("click", () => {
    const cont = obtenerContenedorScrollActivo();

    if (cont === window) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } else {
      cont.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  });

  setInterval(actualizarBotonScrollTop, 500);
})();


// ================= MODAL TEMA + FONDOS POR SECCIÓN =================
const FONDO_SECCIONES = {
  biblia: {
    seccionId: "seccion-biblia",
    fondoId: "fondoBiblia"
  },
  iglesia: {
    seccionId: "seccion-iglesia",
    fondoId: "fondoIglesia"
  },
  panel: {
    seccionId: "seccion-panel",
    fondoId: "fondoPanel"
  },
  compartidos: {
    seccionId: "seccion-compartidos",
    fondoId: "fondoCompartidos"
  }
};

let fondoTemaDraft = null;

function getSeccionActualFondoKey() {
  if (document.body.classList.contains("en-iglesia")) return "iglesia";
  if (document.body.classList.contains("en-panel")) return "panel";
  if (document.body.classList.contains("en-compartidos")) return "compartidos";
  return "biblia";
}

function getFondoStorageKey(seccion) {
  return `fondoApp_${seccion}`;
}

function getFondoTipoStorageKey(seccion) {
  return `fondoTipo_${seccion}`;
}

function getFondoOpacidadStorageKey(seccion) {
  return `fondoOpacidad_${seccion}`;
}

function getElementoSeccionFondo(seccion) {
  const cfg = FONDO_SECCIONES[seccion];
  return cfg ? document.getElementById(cfg.seccionId) : null;
}

function getElementoCapaFondo(seccion) {
  const cfg = FONDO_SECCIONES[seccion];
  return cfg ? document.getElementById(cfg.fondoId) : null;
}

function asegurarFondoBiblia() {
  return document.getElementById("fondoBiblia");
}

function getEstadoGuardadoSeccion(seccion) {
  return {
    tipo: localStorage.getItem(getFondoTipoStorageKey(seccion)) || "color",
    valor: localStorage.getItem(getFondoStorageKey(seccion)) || "#ffffff",
    opacidad: localStorage.getItem(getFondoOpacidadStorageKey(seccion)) || "0.35"
  };
}

function guardarEstadoSeccion(seccion, estado) {
  localStorage.setItem(getFondoTipoStorageKey(seccion), estado.tipo);
  localStorage.setItem(getFondoStorageKey(seccion), estado.valor);
  localStorage.setItem(getFondoOpacidadStorageKey(seccion), String(estado.opacidad));
}

function limpiarFondosInternosApp() {
  [
    document.getElementById("iglesia-devocionales"),
    document.getElementById("iglesia-abc"),
    document.getElementById("iglesia-subidos"),
    document.getElementById("subidosApp"),
    document.getElementById("iglesia-recursos"),
    document.getElementById("recursos-rh"),
    document.getElementById("recursos-talleres"),
    document.getElementById("recursos-hermanos"),
    document.getElementById("recursos-permisos"),
    document.getElementById("panel-imagenes"),
    document.getElementById("panel-marcadores")
  ].filter(Boolean).forEach(el => {
    el.style.background = "none";
    el.style.backgroundImage = "none";
    el.style.backgroundColor = "transparent";
    el.style.backgroundRepeat = "";
    el.style.backgroundPosition = "";
    el.style.backgroundSize = "";
    el.style.backgroundAttachment = "";
    el.style.opacity = "";
  });
}

function aplicarEstadoVisualSeccion(seccion, estado) {
  const el = getElementoSeccionFondo(seccion);
  const capa = getElementoCapaFondo(seccion);
  if (!el || !capa) return;

  const tipo = estado?.tipo || "color";
  const valor = estado?.valor || "#ffffff";
  const opacidad = String(estado?.opacidad || "0.35");

  el.style.background = "none";
  el.style.backgroundImage = "none";
  el.style.backgroundColor = "transparent";

  if (tipo === "imagen") {
    capa.style.backgroundImage = `url("${valor}")`;
    capa.style.backgroundColor = "transparent";
  } else {
    capa.style.backgroundImage = "none";
    capa.style.backgroundColor = valor;
  }

  capa.style.opacity = opacidad;
}

function aplicarFondosGuardados() {
  Object.keys(FONDO_SECCIONES).forEach(seccion => {
    aplicarEstadoVisualSeccion(seccion, getEstadoGuardadoSeccion(seccion));
  });

  limpiarFondosInternosApp();
}

function cargarDraftDesdeGuardado(seccion) {
  const guardado = getEstadoGuardadoSeccion(seccion);
  fondoTemaDraft = {
    seccion,
    tipo: guardado.tipo,
    valor: guardado.valor,
    opacidad: guardado.opacidad
  };
}

function reflejarDraftEnModal() {
  if (!fondoTemaDraft) return;

  const label = document.getElementById("fondoSeccionActualLabel");
  const slider = document.getElementById("opacidadFondoApp");
  const inputColor = document.getElementById("colorFondoApp");

  if (label) {
    const nombres = {
      biblia: "Biblia",
      iglesia: "Iglesia",
      panel: "Mi Panel",
      compartidos: "Compartidos"
    };
    label.textContent = nombres[fondoTemaDraft.seccion] || "Biblia";
  }

  if (slider) {
    slider.value = String(fondoTemaDraft.opacidad || "0.35");
  }

  if (inputColor && fondoTemaDraft.tipo === "color") {
    inputColor.value = fondoTemaDraft.valor || "#ffffff";
    inputColor.dispatchEvent(new Event("input", { bubbles: true }));
    inputColor.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

window.abrirModalTema = () => {
  const modal = document.getElementById("modalTema");
  if (!modal) return;

  const seccion = getSeccionActualFondoKey();
  cargarDraftDesdeGuardado(seccion);
  reflejarDraftEnModal();

  modal.style.display = "flex";

  setTimeout(() => {
    if (typeof initPickrEnHosts === "function") {
      initPickrEnHosts("#colorFondoAppHost");
    }
  }, 0);
};

window.cerrarModalTema = () => {
  const modal = document.getElementById("modalTema");
  if (modal) modal.style.display = "none";
};

window.aplicarColorFondo = () => {
  if (!fondoTemaDraft) return;

  const input = document.getElementById("colorFondoApp");
  if (!input) return;

  fondoTemaDraft.tipo = "color";
  fondoTemaDraft.valor = input.value || "#ffffff";

  aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
  limpiarFondosInternosApp();
};

window.aplicarImagenFondo = () => {
  if (!fondoTemaDraft) return;

  const input = document.getElementById("imgFondoApp");
  if (!input || !input.files || !input.files[0]) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    const src = e?.target?.result;
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      const maxLado = 1600; // suficiente para fondo, mucho más liviano
      let { width, height } = img;

      if (width > height && width > maxLado) {
        height = Math.round(height * (maxLado / width));
        width = maxLado;
      } else if (height >= width && height > maxLado) {
        width = Math.round(width * (maxLado / height));
        height = maxLado;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, width, height);

      // ✅ guardamos versión comprimida, no el archivo bruto
      const dataUrl = canvas.toDataURL("image/jpeg", 0.78);

      fondoTemaDraft.tipo = "imagen";
      fondoTemaDraft.valor = dataUrl;

      aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
      limpiarFondosInternosApp();
    };

    img.src = src;
  };

  reader.readAsDataURL(file);
};

window.confirmarFondoTema = () => {
  if (!fondoTemaDraft) return;

  try {
    guardarEstadoSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
    aplicarFondosGuardados();
    cerrarModalTema();
  } catch (e) {
    console.error("Error al confirmar fondo:", e);
    alert("No se pudo guardar esa imagen de fondo. Probá con una imagen más liviana.");
  }
};

window.cancelarFondoTema = () => {
  if (!fondoTemaDraft) {
    cerrarModalTema();
    return;
  }

  const guardado = getEstadoGuardadoSeccion(fondoTemaDraft.seccion);
  aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, guardado);
  limpiarFondosInternosApp();

  fondoTemaDraft = null;
  cerrarModalTema();
};

// ================= CARGAR FONDOS AL INICIAR =================
window.addEventListener("load", () => {
  aplicarFondosGuardados();

  const slider = document.getElementById("opacidadFondoApp");
  if (slider && !slider.dataset.ready) {
    slider.dataset.ready = "1";

    slider.addEventListener("input", () => {
      if (!fondoTemaDraft) return;
      fondoTemaDraft.opacidad = slider.value || "0.35";
      aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
      limpiarFondosInternosApp();
    });
  }
});


