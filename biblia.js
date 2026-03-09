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

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL,
  getBytes,
  deleteObject          // ✅ AGREGAR
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a",
  storageBucket: "vidaabundante-f118a.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ✅ Opción blindada (recomendada):
const storage = getStorage(app, "gs://vidaabundante-f118a.firebasestorage.app");

window.__FB = { db, storage };
window.__FB_API = { ref, set, remove, onValue, get, push, sRef, uploadBytes, getDownloadURL, getBytes, deleteObject };

// ================= ESTADO GLOBAL =================
let uid = null;
let bibliaData = [];
let marcados = {};
let size = 18;
let fuenteActual = "Arial";
let colorActual = "#fff3b0"; // 💛 amarillo por default
let resaltadorBloqueado = true; // 🔒 nuevo estado
window.colorActual = colorActual;
window.resaltadorBloqueado = resaltadorBloqueado;

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

// =========

let modoImagen = false;
let seleccionImagen = {};
let fondoFinal = null;
let fondoFinalBlobUrl = null; // ✅ fondo seguro para html2canvas
let creandoNotaLibre = false; // ✅ estado: nota sin versículo

// ================= AUTO TAMAÑO PREVIEW =================
let userSetFontSize = false; // si el usuario tocó tamaño (slider o + -), queda manual hasta que cambie el texto

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

// ================= AUTH =====================================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  window.__UID = uid;

  if (!uid) {
    window.location.href = "login.html";
    return;
  }
  
    // ================= ✅ ADMIN FLAG GLOBAL =================
  // Lee /admins/{uid} = true|false y lo guarda en window.__ES_ADMIN
  onValue(ref(db, "admins/" + uid), (s) => {
    window.__ES_ADMIN = !!s.val();

    // opcional: si existe un botón de "nuevo devocional", lo muestra/oculta
    const btn = document.getElementById("btnDevNuevo");
    if (btn) btn.style.display = window.__ES_ADMIN ? "inline-flex" : "none";
  });

  onValue(ref(db, "marcados/" + uid), s => {
    marcados = s.val() || {};
    mostrarTexto();
  });

  // ✅ Cargar imágenes del panel (personal)
onValue(ref(db, "panelImagenesPersonal/" + uid), s => {
  const data = s.val() || {};
  renderPanelImagenes(data);
});

// ✅ Cargar marcadores
onValue(ref(db, "marcadores/" + uid), s => {
  marcadores = s.val() || {};

  // ✅ reconstruir índices de notas (Biblia / ABC)
  window.notasBibliaIndex = {};
  window.notasBibliaPluma = {}; // 👈 NUEVO: solo el último versículo de cada nota
  window.notasABCIndex = {};

  notasBibliaIndex = window.notasBibliaIndex;
  notasBibliaPluma = window.notasBibliaPluma;
  notasABCIndex = window.notasABCIndex;

  Object.entries(marcadores || {}).forEach(([idMarcador, m]) => {
    const tieneNota = !!(m?.nota && String(m.nota).trim());
    if (!tieneNota) return;

    // --- ABC (lo dejamos como estaba en tu sistema actual) ---
    if (m?.origen === "abc") {
      // si existe abcBidLast, mejor; si no, cae a abcBid
      const bid = m?.abcBidLast || m?.abcBid || null;
      if (bid) notasABCIndex[bid] = true;
      return;
    }

    // --- Biblia ---
    const libro = m?.libro;
    const cap = Number(m?.capitulo);
    const vers = Array.isArray(m?.versiculos) ? m.versiculos : [];

    if (!libro || !cap || !vers.length) return;

    // marcamos “tiene nota” para todos (opcional, por si lo usás en otra parte)
    const nums = vers.map(vn => Number(vn)).filter(n => !isNaN(n));
    nums.forEach(n => {
      notasBibliaIndex[`${libro}_${cap}_${n}`] = true;
    });

    // ✅ SOLO UNA PLUMA: en el último versículo (máximo número)
    const last = Math.max(...nums);
    if (isFinite(last)) {
      const idVersiculo = `${libro}_${cap}_${last}`;
      notasBibliaPluma[idVersiculo] = idMarcador; // guardo el id real del marcador para editar
    }
  });

  // si estoy viendo panel marcadores, refrescar
  const panelMarcadores = document.getElementById("panel-marcadores");
  if (panelMarcadores && panelMarcadores.offsetParent !== null) {
    renderPanelMarcadores();
  }

  // ✅ repintar Biblia (para que aparezca la pluma sin recargar)
  mostrarTexto();

  // ✅ si estoy en ABC, refrescar la UI de selección (agrega pluma a bloques)
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
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  });

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
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

// ================= ⭐ CARGA CAPITULOS ==============================
function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
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

  if (!btnActivo || !paleta || !cont || !btnBloquear) {
    console.warn("❌ Resaltador no inicializado");
    return;
  }

  paleta.style.display = "none";
  btnActivo.style.background = colorActual;
  btnActivo.textContent = "💛";
  btnBloquear.textContent = "🔒";

  // 🟡 CLICK PRINCIPAL → abrir / cerrar paleta
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

  // 🎨 ELEGIR COLOR
  paleta.querySelectorAll("button[data-color]").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

      colorActual = btn.dataset.color;
      btnActivo.style.background = colorActual;
      btnActivo.textContent = btn.textContent;

      resaltadorBloqueado = false;
      window.colorActual = colorActual;
      window.resaltadorBloqueado = resaltadorBloqueado;
      paleta.style.display = "none";
    };
  });

  // 🔒 BLOQUEAR / DESBLOQUEAR
  btnBloquear.onclick = e => {
  e.preventDefault();
  e.stopPropagation();

  resaltadorBloqueado = !resaltadorBloqueado;
  window.resaltadorBloqueado = resaltadorBloqueado;

  // ✅ misma UI para manual y automático
  actualizarUICandadoResaltador();
};

  // ❌ cerrar clic fuera
  document.addEventListener("click", e => {
    if (!cont.contains(e.target)) paleta.style.display = "none";
  });
  actualizarUICandadoResaltador();
}

// ================= ⭐ BLOQUEO DE RESALTADOR =======================
function actualizarUICandadoResaltador() {
  const paleta = document.getElementById("paletaResaltadores");
  const btnBloquear = document.getElementById("btnBloquearResaltador");
  if (!paleta || !btnBloquear) return;

  // ✅ SIEMPRE leer del window (evita desync entre secciones)
  const locked = !!window.resaltadorBloqueado;
  const curColor = (window.colorActual || "#fff3b0") + "";

  // icono grande
  btnBloquear.textContent = locked ? "🔒" : "🔓";

  // limpiar candaditos pequeños anteriores
  paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

  // si está bloqueado, poner el candadito pequeño en el color actual
  if (locked) {
    const botonColor = Array.from(paleta.querySelectorAll("button[data-color]"))
      .find(b => ((b.dataset.color || "") + "") === curColor);

    // ✅ si no encontró exacto, igual lo mostramos en el primer color (fallback)
    const target = botonColor || paleta.querySelector("button[data-color]");
    if (target) {
      const span = document.createElement("span");
      span.textContent = "🔒";
      span.className = "icono-candado";
      span.style.position = "absolute";
      span.style.top = "-4px";
      span.style.right = "-4px";
      span.style.fontSize = "10px";
      span.style.background = "#fff";
      span.style.borderRadius = "50%";
      span.style.padding = "1px";
      target.style.position = "relative";
      target.appendChild(span);
    }
  }
}

// ================= ⭐ FUERZA CANDADO PEQUEÑO =======================
window.forceSyncResaltadorUI = function forceSyncResaltadorUI(intentos = 20) {
  const tick = () => {
    try { actualizarUICandadoResaltador?.(); } catch (e) {}

    // ✅ chequeo si ya existe el candadito chico
    const paleta = document.getElementById("paletaResaltadores");
    const ok = paleta && paleta.querySelector("span.icono-candado");

    if (ok) return;                  // listo
    if (intentos <= 0) return;       // no se pudo

    requestAnimationFrame(() => {
      window.forceSyncResaltadorUI(intentos - 1);
    });
  };

  // 1 frame + tick (para que el portal termine)
  requestAnimationFrame(tick);
};

// ================= ⭐ MOSTRAR TEXTO =======================
function mostrarTexto() {
  texto.innerHTML = ""; 
  titulo.innerText = `${libroSel.value} ${capSel.value}`;

  const versos = bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => pintarVersiculo(v));
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

    mostrarTexto();
    userSetFontSize = false; // ✅ cambió el texto => volver a AUTO
    actualizarPreview();
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
    <span class="txt">${v.RV1960}</span>
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
    if (vers?.RV1960) textos.push(vers.RV1960);
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
  ["personalizarOpacidad", "personalizarTamaño", "personalizarColor"].forEach(id => {
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

// ================= 🎀 LISTA VISUAL DE FUENTES =================
const fuentesGoogle = [
  { nombre: "Roboto", css: "Roboto" },
  { nombre: "Lobster", css: "Lobster" },
  { nombre: "Playfair Display", css: "'Playfair Display'" },
  { nombre: "Montserrat", css: "Montserrat" },
  { nombre: "Poppins", css: "Poppins" },
  { nombre: "Abril Fatface", css: "'Abril Fatface'" },
  { nombre: "Cormorant", css: "Cormorant" },
  { nombre: "Josefin Sans", css: "'Josefin Sans'" },
  { nombre: "Great Vibes", css: "'Great Vibes'" }
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

      // cerrar al elegir
      cont.classList.remove("abierto");
      document.getElementById("btnFuentes")?.classList.remove("activo");
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

// ================= 🌄 FONDOS ⛺================================
const fondos = [
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puente_gox2gz.jpg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_qttkkt",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_l02emm",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertaflroesvioletas_q4f1bq",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertaangostaflores_fvdw8o",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puertafloresblancas_ouomif",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/puenteotoñoagua_r9tskw",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/rosabotes_bwnvws",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/playaarenamarolas_oxkh2z",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/plazaamanecer_nvjtqa",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/piedrasaguamontañas_lseoki",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/pastofloresrosas_i0woqq",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/otoño_kdx8u5",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/otoño2_mwn77p",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/mariposas_mmo86f",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/cielocelesterosaarboles_y4t720",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresamarillas_mhosyy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/faro_aginuk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/faro2_s5ynwu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/montaña_c455zz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/olascielo_igbddx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/montañagrande_vwag5k",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/camino_madnav",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/margaritasporton_wnpdps",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/lilamontañasflores_vayxei",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/casitalejosarboles_by72rz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/bebedero_ystc1u",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/jardinflores_eqxwe5",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/casita_sxlvcf",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/boda_nmzaub",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arcoflores_lnrfa9",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arbustos_pwdcsk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresmontañas_h8qhkd",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresfucsias_f17kul",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/arcadafloresrosas_fc4aj4",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/amarillopajarosnubes_ar0qqg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/floresblancasyrosas_ehpvfy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_kpgvmm",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_kupglf",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_a1wlsh",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_hnxuau",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_brmypi",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_xubjvd",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_9_b3tkxx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_jhrx0j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_8_ivok7j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_12_crdynt",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_15_iu1uxj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_14_iww2jx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_13_dzxm4k",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_11_z3nudj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_10_scjlfu"
];

// ================= ⭐ CARGAR FONDOS (CORS + URL FINAL) =======================
function cargarFondos() {
  const cont = document.getElementById("personalizarFondos");
  if (!cont) return;

  cont.innerHTML = "";

  fondos.forEach(baseUrl => {
    const finalUrl = baseUrl.includes("?")
      ? baseUrl + "&auto=format&fit=crop&w=900&q=80"
      : baseUrl + "?auto=format&fit=crop&w=900&q=80";

    const img = document.createElement("img");

    // ✅ crossOrigin ANTES del src
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
    // liberar blob anterior
    if (fondoFinalBlobUrl) URL.revokeObjectURL(fondoFinalBlobUrl);

    fondoFinal = finalUrl; // guardo la url original (por si querés)
    fondoFinalBlobUrl = await urlToBlobURL(finalUrl); // ✅ la clave

    actualizarPreview();
  } catch (e) {
    console.error(e);
    fondoFinal = null;
    fondoFinalBlobUrl = null;
    alert("Ese fondo no se puede usar (CORS). Probá otro o sin fondo.");
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

  // ================= Texto Versiculos Biblia =================
const textoFinal = obtenerVersiculoSeleccionado();

previewTexto.innerText = textoFinal || "";
previewTextoBack.innerText = textoFinal || "";

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

// line-height estable ayuda a medir bien
previewTexto.style.lineHeight = "1.3";
previewTextoBack.style.lineHeight = "1.3";

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

  // ================= Color / Outline =================
  const colorEl = document.getElementById("personalizarColor");
  const opEl = document.getElementById("personalizarOpacidad");

  const color = colorEl ? colorEl.value : "#000000";
  const opacidad = opEl ? opEl.value : "0.3";
  const outlineColor = colorOutlineDesdeBase(color);
  const px = 0.50; // 👈 grosor del borde

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

 if (!isNaN(op)) {
  if (op > 0.5) {
    const a = Math.min(0.70, (op - 0.5) * 2);     // ✅ cap
    bgColor = `rgba(0,0,0,${a})`;
  } else if (op < 0.5) {
    const a = Math.min(0.70, (0.5 - op) * 2);     // ✅ cap
    bgColor = `rgba(255,255,255,${a})`;
  }
}

  wrapper.style.backgroundColor = bgColor;

  // ================= Estilos Texto =================
  const transform = textStyle?.upper ? "uppercase" : "none";

  previewTexto.style.textTransform = transform;
  previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = textStyle?.bold ? "700" : "400";
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
    // Siempre a Mi Panel
    await subirImagen("personal");

    // Si está tildado "Iglesia", también sube a Iglesia
    const chk = document.getElementById("checkIglesia");
    if (chk && chk.checked) {
      await subirImagen("iglesia");
    }
  }

  
  return true;
}

// ================= ✅ CLICK SEGURO PARA DESCARGA =================
function clickLink(link) {
  document.body.appendChild(link);
  link.click();
  link.remove();
}


// ================= ⭐ SUBIR IMAGEN (personal / iglesia) ☁️ =================
async function subirImagen(destino = "personal") {
  if (!uid) return;

  const canvas = document.getElementById("canvasFinal");
  if (!canvas || canvas.width < 10 || canvas.height < 10) return;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;

  // nombre único
  const ts = Date.now();
  const fileName = `versiculo_${ts}.png`;

  // rutas (podés cambiarlas si tu panel lee otra cosa)
  const storagePath =
    destino === "iglesia"
      ? `imagenes_iglesia/${uid}/${fileName}`
      : `imagenes_personal/${uid}/${fileName}`;

  const dbPath =
    destino === "iglesia"
      ? `panelImagenesIglesia/${uid}/${ts}`
      : `panelImagenesPersonal/${uid}/${ts}`;

  try {
    // 1) subir a Storage
    const storageRef = sRef(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: "image/png" });

    // 2) obtener URL
    const url = await getDownloadURL(storageRef);

    // 3) guardar referencia en Realtime DB
await set(ref(db, dbPath), {
  url,
  storagePath,
  fecha: ts,
  libro: libroSel?.value || "",
  capitulo: Number(capSel?.value || 0),

});

    console.log("✅ Imagen subida:", destino, url);
  } catch (e) {
    console.error("❌ Error subiendo imagen:", e);
    mostrarToast("❌ No se pudo subir la imagen");
  }
  
}

// ======================== ⭐ OPCION DESCARGAR (FIX) ====================================
async function descargarImagenFinal() {
  return withRenderLock(async () => {
    const canvas = document.getElementById("canvasFinal");
    if (!canvas) return;

    // ✅ regenerar antes de descargar
    const ok = await generarImagenFinal({ subir: false });
    if (!ok) return;

    const descargarDesdeDataURL = () => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = "versiculo.png";
      clickLink(link);
    };

    try {
      canvas.toBlob(blob => {
        if (!blob) return descargarDesdeDataURL();

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "versiculo.png";
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
  
  if (fondoFinalBlobUrl) {
  URL.revokeObjectURL(fondoFinalBlobUrl);
  fondoFinalBlobUrl = null;
}
  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  fuenteActual = "Arial";

 const colorInput = document.getElementById("personalizarColor");
 if (colorInput) {
 colorInput.value = "#000000"; // ✅ siempre negro por defecto
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

  // ================= RESTAURAR UI (SEGURO) =================
  const fondosBox = document.getElementById("personalizarFondos");
  if (fondosBox) fondosBox.style.display = "flex";

  const btnGen = document.getElementById("btnGenerarPersonalizada");
  if (btnGen) btnGen.style.display = "inline-block";

  const acciones = document.getElementById("accionesFinales");
  if (acciones) acciones.remove();

    // ✅ default TRUE cada vez que se abre / resetea el modal
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
  await subirImagen("personal");
  const chk = document.getElementById("checkIglesia");
  if (chk && chk.checked) await subirImagen("iglesia");
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
  await subirImagen("personal");
  const chk = document.getElementById("checkIglesia");
  if (chk && chk.checked) await subirImagen("iglesia");
}

    }

    return ok;
  } finally {
    window.__canvasFinalCache.busy = false;
  }
}

// ================= 🔺 WINDOW / UI ⭕ ===============================
window.irA = (seccion) => {
  // 1) mostrar/ocultar secciones principales
  ["biblia", "iglesia", "panel"].forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = (s === seccion) ? "block" : "none";
  });

  // 2) marcar botón activo del menú
  document.querySelectorAll("#menu .nav-btn").forEach(b => b.classList.remove("activo"));
  const btnActivo = document.querySelector(`#menu .nav-btn[onclick="irA('${seccion}')"]`);
  if (btnActivo) btnActivo.classList.add("activo");

  // ✅ si me fui de IGLESIA (donde vive ABC) a otra sección, apago ABC
  if (seccion !== "iglesia") {
    window.__abcOnExit?.();
  }

  // 3) defaults internos
  if (seccion === "iglesia") {
    window.mostrarIglesiaSub?.("devocionales");
    return;
  }

  if (seccion === "panel") {
    window.mostrarSeccion?.("imagenes");
    return;
  }

  // 4) biblia
  if (seccion === "biblia") {
       window.setMarcadorCtx("biblia");
    // ✅ al volver a Biblia: restaurar estado previo (modo imagen / modo marcador)
    // (si no existe, no pasa nada)
    try { bibliaRestaurarUIAlVolver?.(); } catch(e){}

    // ✅ barra visible según estado guardado de Biblia
    aplicarEstadoBarra?.("biblia");

    // ✅ Biblia: refrescar UI normal
    resaltadorBloqueado = true;
    actualizarUICandadoResaltador?.();
    mostrarTexto?.();

    // ✅ aplica botones según modo actual (normal / marcador / imagen)
    if (typeof aplicarUIAccionesPorModo === "function") {
      aplicarUIAccionesPorModo();
    }
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

  // ✅ CLAVE: reset antes de mostrar (evita overlay negro por sliders viejos)
  resetModalPersonalizar();

    // ✅ MODO: CREAR IMAGEN
  modal.classList.add("solo-imagen");
  modal.classList.remove("modo-devocional");
  
  abrirModalPersonalizar();
  setFormatoImagen("post");
  cargarFondos();
  crearListaVisualFuentes();

  // ✅ esperar 1 frame para que el modal ya tenga tamaño real
  await new Promise(r => requestAnimationFrame(r));

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
window.finalizarEdicion = async () => {
  return withRenderLock(async () => {
   
        // ✅ Si hay audio confirmado, lo subimos AHORA y lo dejamos listo para que la imagen lo “consuma”
    if (window.__pendingAudio?.audioBase64) {
      try {
        // si querés respetar el check de iglesia, cambialo acá:
        // const subirIglesia = !!document.getElementById("checkIglesia")?.checked;
        const subirIglesia = false; // ✅ simple: Biblia audio siempre a personal
        await subirPendingAudioAFirebase({ subirIglesia });
      } catch (e) {
        console.error(e);
        alert("No se pudo subir el audio. Probá generar la previa otra vez.");
        return;
      }
    }
    
    const ok = await asegurarCanvasFinal({ subir: true });
    if (!ok) {
      alert("No se pudo generar la imagen (PNG). Revisá consola (F12) para ver el error.");
      return;
    }

    const terminar = confirm(
      "¿Terminar edición?\n\nOK = Terminar edición y volver a Biblia\nCancelar = Volver a edición"
    );

    if (!terminar) return;

    resetModalPersonalizar();
    salirModoImagen();
    irA("biblia");
  });
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

  // ✅ Si está abierto, cerrar
  const abierto = getComputedStyle(modal).display !== "none";
  if (abierto) {
    cerrarMarcadores();
    return;
  }

  // ✅ Por defecto: abrir lista
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
  window.__editMarcadorBase = { ...m };

  // ✅ abrimos el formulario (sin depender de selección)
  abrirFormNuevoMarcador();

  // ✅ precargar campos
  document.getElementById("marcadorTitulo").value = m.titulo || "";
  document.getElementById("marcadorNota").value   = m.nota || "";
  document.getElementById("marcadorColor").value  = m.color || "#fff3b0";
  document.getElementById("marcadorKeep").checked = !!m.keep;

  // ✅ refrescar preview para edición
  renderPreviewVersiculosMarcador();
};

// ================= ✨ Cerrar Marcadores 📌=================
window.cerrarMarcadores = () => {
  const modal = document.getElementById("modalMarcadores");
  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
  }

  // ✅ Si estoy en ABC, NO dejes que Biblia esconda el ✓
  // porque en ABC el ✓ depende de abcModoMarcador/selección de bloques.
  try {
    const secIglesia = document.getElementById("seccion-iglesia");
    const subABC = document.getElementById("iglesia-abc");
    const estoyEnABC =
      !!(secIglesia && secIglesia.style.display !== "none" &&
         subABC && subABC.style.display !== "none");

    if (estoyEnABC) {
      // re-aplicar UI de ABC (vuelve el ✓ y se actualiza su estado)
      if (typeof abcAplicarUIAccionesPorModo === "function") abcAplicarUIAccionesPorModo();
      if (typeof abcHabilitarCheckUI === "function") abcHabilitarCheckUI();
      if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
      return; // ✅ IMPORTANTÍSIMO: no ejecutes el refresco de Biblia
    }
  } catch(e){}

  // ✅ caso Biblia normal
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
    const txt = vv ? vv.RV1960 : "";
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
  if (!lista || !form || !info) return;

  const ids = Object.keys(seleccionMarcador);
  const nums = ids.map(id => Number(id.split("_")[2])).sort((a,b)=>a-b);
  const rango = formatearVersiculosComoRango(nums);
  const refTxt = `${libroSel.value} ${capSel.value}:${rango}`;

  const hoy = new Date().toLocaleDateString("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});
info.textContent = `📌 ${refTxt} · ${hoy}`;

  document.getElementById("marcadorTitulo").value = "";
  document.getElementById("marcadorNota").value = "";
  document.getElementById("marcadorColor").value = colorActual || "#fff3b0";
  document.getElementById("marcadorKeep").checked = true;

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

    if (!titulo) {
      mostrarToast("Poné un título 🙏");
      return;
    }

    // ✅ Si estoy EDITANDO desde Mi Panel, uso la base original
    const editId = window.__editMarcadorId || null;
    const base = window.__editMarcadorBase || null;

    const libro = base?.libro || libroSel?.value || "";
    const capitulo = Number(base?.capitulo ?? capSel?.value ?? 0);

    // versículos:
    // - si edito: uso los versículos originales
    // - si creo: uso selección actual
    const versiculos = (base?.versiculos && Array.isArray(base.versiculos))
      ? base.versiculos.map(Number).filter(n => !isNaN(n))
      : Object.keys(seleccionMarcador || {})
          .map(x => Number(x.split("_").pop()))
          .filter(n => !isNaN(n));

    // si NO es nota libre y NO hay versículos, no dejamos guardar
    if (!creandoNotaLibre && versiculos.length === 0) {
      mostrarToast("Seleccioná al menos 1 versículo 📌");
      return;
    }

    const data = {
      titulo,
      nota,
      color,
      keep,
      libro,
      capitulo,
      versiculos,
      fecha: Date.now()
    };

    // ✅ ruta: coincide con tu listener onValue(ref(db, "marcadores/" + uid))
    const id = editId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const ruta = `marcadores/${uid}/${id}`;

    await set(ref(db, ruta), data);

    // ✅ estado post-guardado
    seleccionMarcador = {};
    creandoNotaLibre = false;

    // el resaltado al volver (solo si keep)
    ultimoMarcadorAplicado = data.keep ? data : null;

    // limpiar edición
    window.__editMarcadorId = null;
    window.__editMarcadorBase = null;

    // cerrar UI del modal marcadores prolijo
    const form = document.getElementById("formNuevoMarcador");
    const lista = document.getElementById("listaMarcadores");
    if (form) form.style.display = "none";
    if (lista) lista.style.display = "block";

    const modal = document.getElementById("modalMarcadores");
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    mostrarToast(editId ? "✅ Marcador actualizado" : "✅ Marcador guardado");
    mostrarTexto();
    refrescarBotonGuardarMarcador();

        // ✅ al terminar de guardar: volver a Biblia normal (sin modo marcador)
    if (typeof salirModoMarcadorLimpio === "function") {
      salirModoMarcadorLimpio();
    } else {
      modoMarcador = false;
      seleccionMarcador = {};
      document.body.classList.remove("modo-marcador");
      const btnPin = document.getElementById("btnModoMarcadorBarra");
      if (btnPin) btnPin.classList.remove("activo");
      aplicarUIAccionesPorModo();
      refrescarBotonGuardarMarcador();
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
let filtroNotasPanel = "con"; // "con" | "sin" | "abc"

function renderPanelMarcadores() {
  const panel = document.getElementById("panel-marcadores");
  if (!panel) return;

  const items = Object.entries(marcadores || {}).map(([id, m]) => ({ ...m, id }));

  const ordenados = items.sort((a, b) => {
    if (ordenMarcadores === "biblia") {
      const la = (a.libro || "").localeCompare(b.libro || "");
      if (la !== 0) return la;
      const ca = (a.capitulo || 0) - (b.capitulo || 0);
      if (ca !== 0) return ca;
      return ((a.versiculos?.[0] || 0) - (b.versiculos?.[0] || 0));
    }
    return (b.fecha || 0) - (a.fecha || 0);
  });

  // ✅ Filtro: SOLO NOTAS (con versículo / sin versículo / abc)
   const filtrados = ordenados.filter(m => {
    const tieneNota = !!(m.nota && String(m.nota).trim());
    if (!tieneNota) return false;

    // ✅ filtro ABC
    if (filtroNotasPanel === "abc") return m?.origen === "abc";

    // ✅ filtro Biblia (con/sin versículo)
    const esABC = (m?.origen === "abc");
    if (esABC) return false; // en con/sin no mezclar ABC

    const cantVers = (m.versiculos || []).length;
    if (filtroNotasPanel === "con") return cantVers > 0;
    return cantVers === 0;
  });

  const cantSel = Object.keys(seleccionEliminarMarcadores || {}).length;

  // iconos dinámicos
  const iconOrden = (ordenMarcadores === "fecha")
    ? `<i class="fa-regular fa-calendar"></i>`
    : `<i class="fa-solid fa-book-bible"></i>`;

   const iconFiltroNotas = (filtroNotasPanel === "con")
    ? `<i class="fa-solid fa-thumbtack"></i>`
    : (filtroNotasPanel === "sin")
      ? `<i class="fa-solid fa-sheet-plastic"></i>`
      : `<i class="fa-solid fa-graduation-cap"></i>`;

  panel.innerHTML = `
    <div class="panel-marcadores-bar">
      <div class="pm-left">
        <b>📌 Marcadores</b>
      </div>

      <div class="pm-right">
        <!-- 1) AGREGAR NOTA -->
        <button type="button" class="pm-btn" onclick="abrirNotaLibre()" title="Agregar nota">
          <i class="fa-solid fa-square-plus"></i>
        </button>

        <!-- 2) ORDEN FECHA / BIBLICO -->
        <button type="button" class="pm-btn" onclick="toggleOrdenMarcadoresPanel()" title="Ordenar">
          ${iconOrden}
        </button>

        <!-- 3) FILTRO NOTAS CON / SIN VERSICULO -->
        <button type="button" class="pm-btn" onclick="toggleFiltroNotasPanel()" title="Filtrar notas">
          ${iconFiltroNotas}
        </button>

        <!-- 4) ELIMINAR -->
        <button type="button" class="pm-btn" onclick="toggleModoEliminarMarcadores()" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>

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
      const refTxt = m.ref || (m.libro && m.capitulo ? `${m.libro} ${m.capitulo}` : "Nota");
      const checked = !!(seleccionEliminarMarcadores && seleccionEliminarMarcadores[m.id]);

      let textoVers = "";
      if (m.libro && m.capitulo && (m.versiculos || []).length) {
        const partes = (m.versiculos || []).map(n => {
          const vv = bibliaData.find(x => x.Libro === m.libro && x.Capitulo == m.capitulo && x.Versiculo == n);
          return vv ? vv.RV1960 : "";
        }).filter(Boolean);
        if (partes.length) textoVers = partes.join(" ");
      }

      return `
        <div class="card-marcador">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-size:13px;">
              <b>${m.titulo || "Marcador"}</b><br>
              <span class="muted">${refTxt} · ${fechaTxt}</span>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
              ${modoEliminarMarcadores ? `
                <input type="checkbox" ${checked ? "checked":""}
                  onchange="toggleSeleccionEliminarMarcador('${m.id}', this.checked)">
              ` : `
                <button type="button" class="pm-btn" onclick="abrirMarcadorDesdePanel('${m.id}')" title="Volver">
                  <i class="fa-solid fa-reply"></i>
                </button>

                <button type="button" class="pm-btn" onclick="editarMarcadorEnPanel('${m.id}')" title="Editar">
                  <i class="fa-solid fa-pen-to-square"></i>
                </button>

                <button type="button" class="pm-btn" onclick="abrirCompartirMarcador('${m.id}')" title="Compartir">
                  <i class="fa-solid fa-share-nodes"></i>
                </button>
              `}
            </div>
          </div>

          ${textoVers ? `<div class="nota" style="margin-top:8px;">${textoVers}</div>` : ""}
          ${m.nota ? `<div class="nota">${m.nota}</div>` : ""}
        </div>
      `;
    }).join("") : `<p style="opacity:.75">Todavía no tenés notas para este filtro.</p>`}
  `;
}

// ================= TOGGLES PANEL (iconos tipo sol/luna) =================
window.toggleOrdenMarcadoresPanel = () => {
  ordenMarcadores = (ordenMarcadores === "fecha") ? "biblia" : "fecha";
  renderPanelMarcadores();
};

window.toggleFiltroNotasPanel = () => {
  if (filtroNotasPanel === "con") filtroNotasPanel = "sin";
  else if (filtroNotasPanel === "sin") filtroNotasPanel = "abc";
  else filtroNotasPanel = "con";
  renderPanelMarcadores();
};

window.abrirMarcadorDesdePanel = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

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

  abrirMarcadores(); // abre modal
  setTimeout(() => {
    abrirFormNuevoMarcador();

    document.getElementById("marcadorTitulo").value = m.titulo || "";
    document.getElementById("marcadorNota").value = m.nota || "";
    document.getElementById("marcadorColor").value = m.color || "#fff3b0";
    document.getElementById("marcadorKeep").checked = !!m.keep;

    // guardamos “id en edición”
    window.__editMarcadorId = idMarcador;

    // ✅ guardo la base para que NO pida selección al guardar
    window.__editMarcadorBase = {
      libro: m.libro,
      capitulo: Number(m.capitulo),
      versiculos: (m.versiculos || []).map(Number),
      ref: m.ref || ""
    };

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

// ================= 🔺 CONFIRMAR ELIMINAR MARCADORES ===================
window.confirmarEliminarMarcadores = async () => {
  const ids = Object.keys(seleccionEliminarMarcadores);
  if (ids.length === 0) return;

  const ok = confirm(`¿Seguro que querés borrar ${ids.length} marcador(es)?\n\nEsto NO se puede deshacer.`);
  if (!ok) return;

  try {
    for (const id of ids) {
      await remove(ref(db, `marcadores/${uid}/${id}`));
    }
    seleccionEliminarMarcadores = {};
    modoEliminarMarcadores = false;
    mostrarToast("🗑️ Marcadores eliminados");
    renderPanelMarcadores();
  } catch (e) {
    console.error(e);
    mostrarToast("❌ No se pudo borrar");
  }
};

// ================= ✅ NUEVA NOTA SIN VERSÍCULO =================
window.abrirNotaLibre = () => {
  creandoNotaLibre = true;
  // no depende de selección
  abrirMarcadores();
  setTimeout(() => {
    // forzamos formulario
    const lista = document.getElementById("listaMarcadores");
    const form = document.getElementById("formNuevoMarcador");
    const info = document.getElementById("infoMarcadorNuevo");
    if (!lista || !form || !info) return;

    info.textContent = `🗒 Nota (sin versículo) · ${new Date().toLocaleDateString("es-AR")}`;
    document.getElementById("marcadorTitulo").value = "";
    document.getElementById("marcadorNota").value = "";
    document.getElementById("marcadorColor").value = "#fff3b0";
    document.getElementById("marcadorKeep").checked = false;

    lista.style.display = "none";
    form.style.display = "block";
  }, 0);
};

// ================= 🔺 RENDERPANELIMAGENES ===================
function renderPanelImagenes(data) {
  const grid = document.getElementById("grid-imagenes"); // compatibilidad
  const vacio = document.getElementById("imagenes-vacio");
  const indexRow = document.getElementById("panelImgIndexRow");
  const feed = document.getElementById("panelImgFeed");

  if (!vacio || !indexRow || !feed) return;
  if (grid) grid.innerHTML = "";

  const items = Object.entries(data || {})
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  if (!items.length) {
    vacio.style.display = "block";
    indexRow.innerHTML = "";
    feed.innerHTML = "";
    return;
  }

  vacio.style.display = "none";

  // índice horizontal arriba
  indexRow.innerHTML = items.map(it => {
    const refTxt = (it.libro && it.capitulo) ? `${it.libro} ${it.capitulo}` : "Imagen";
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = (it.url || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    return `
      <div class="devIndexCard" onclick="document.getElementById('panelImgBig_${it.id}')?.scrollIntoView({behavior:'smooth', block:'start'})">
        <div class="devIndexBar devIndexBarTop">${refTxt}</div>

<div class="devIndexImgWrap">
  <img src="${url}" loading="lazy">
</div>

        <div class="devIndexBar devIndexBarBottom">${fechaTxt}</div>
      </div>
    `;
  }).join("");

  // feed grande abajo
  feed.innerHTML = items.map(it => {
    const refTxt = (it.libro && it.capitulo) ? `${it.libro} ${it.capitulo}` : "Imagen";
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = (it.url || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    return `
      <div class="devBigCard" id="panelImgBig_${it.id}">
        <img src="${url}" alt="Imagen generada" loading="lazy">

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
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    mostrarTexto();
  }
};

// ================= 🔺 CAPITULO SIGUIENTE ===================
window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
    mostrarTexto();
  }
};

// ================= 🔍 TOGGLE FILTROS BIBLIA =================
window.toggleFiltrosBiblia = () => {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn  = document.getElementById("btnToggleFiltros");
  const libroSel = document.getElementById("libro");
  if (!wrap) return;

  const abierto = wrap.classList.toggle("abierto");

  if (btn) {
    btn.classList.toggle("activo", abierto);

    // ✅ CLAVE: en celular saca el "focus pegado"
    if (!abierto) {
      btn.blur();
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }
  }

  // ✅ cuando se abre → foco en Libro
  if (abierto && libroSel) {
    setTimeout(() => libroSel.focus(), 0);
  }
};

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
  const preview = document.getElementById("previewImagen");
  preview.classList.remove("preview-post", "preview-story");
  preview.classList.add(tipo === "story" ? "preview-story" : "preview-post");

  const bPost = document.getElementById("btnFormatoPost");
  const bStory = document.getElementById("btnFormatoStory");
  if (bPost) bPost.classList.toggle("activo", tipo !== "story");
  if (bStory) bStory.classList.toggle("activo", tipo === "story");

  actualizarPreview(); // ✅ para recalcular tamaño automático
    
  // ✅ si la lista de fuentes está abierta, la reubicamos
  if (typeof posicionarListaFuentes === "function") {
    const lf = document.getElementById("listaFuentes");
    if (lf && lf.classList.contains("abierto")) posicionarListaFuentes();
  }

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
      return vv ? vv.RV1960 : "";
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
  try {
    await set(ref(db, `marcadoresIglesia/${uid}/${Date.now()}`), {
      ...m,
      publicadoPor: uid,
      publicadoEn: Date.now()
    });
    mostrarToast("✅ Compartido en Iglesia");
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

  // 4) arrancar en biblia
  window.irA?.("biblia");

  // ✅ asegurar filtros cerrados al iniciar
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

  ["devocionales", "abc", "subidos", "xyz"].forEach(k => {
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
};
  
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

  if(!confirm("¿Eliminar esta imagen?")) return;

  try{

    const uid = window.__UID;

    await remove(
      ref(db, `imagenes/${uid}/${id}`)
    );

  }catch(e){
    console.error(e);
    alert("No se pudo eliminar la imagen");
  }
};
