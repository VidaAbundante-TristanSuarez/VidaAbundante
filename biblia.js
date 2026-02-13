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
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import {
  getStorage,
  ref as sRef,
  uploadBytes,
  getDownloadURL
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

// ================= ESTADO GLOBAL =================
let uid = null;
let bibliaData = [];
let marcados = {};
let size = 18;
let fuenteActual = "Arial";
let colorActual = "#fff3b0"; // 💛 amarillo por default
let resaltadorBloqueado = false; // 🔒 nuevo estado

// ================= MARCADORES (NUEVO LIMPIO) =================
let modoMarcador = false;
let seleccionMarcador = {};         // {idVersiculo:true}
let marcadores = {};                // cache firebase
let ultimoMarcadorAplicado = null;  // resaltado al volver (opcional)
// ✅ cuando edito desde "Mi Panel", guardo acá la info original del marcador
window.__editMarcadorBase = null;  // {libro, capitulo, versiculos, ref}

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

// ================= DEVOCIONALES: TEXTO EXTERNO PARA EL MODAL =================
let textoExternoModal = "";     // si hay texto acá, el modal usa esto
let modoTextoExterno = false;   // true = no usar versículos seleccionados

window.__devPasoCaptura = false; // ✅ si true: NO subir a firebase

// ================= AUTH =====================================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (!uid) {
    window.location.href = "login.html";
    return;
  }

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

  // si estoy viendo panel marcadores, refrescar
  const panelMarcadores = document.getElementById("panel-marcadores");
if (panelMarcadores && panelMarcadores.offsetParent !== null) {
  renderPanelMarcadores();
}
});

});

// ================= DOM (script al final del body)  =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const loginModal = document.getElementById("loginModal");

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
      paleta.style.display = "none";
    };
  });

  // 🔒 BLOQUEAR / DESBLOQUEAR
  btnBloquear.onclick = e => {
    e.preventDefault();
    e.stopPropagation();

    resaltadorBloqueado = !resaltadorBloqueado;
    btnBloquear.textContent = resaltadorBloqueado ? "🔒" : "🔓";

    paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

    if (resaltadorBloqueado) {
      const botonColor = Array.from(paleta.querySelectorAll("button[data-color]"))
        .find(b => b.dataset.color === colorActual);
      if (botonColor) {
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
        botonColor.style.position = "relative";
        botonColor.appendChild(span);
      }
    }
  };

  // ❌ cerrar clic fuera
  document.addEventListener("click", e => {
    if (!cont.contains(e.target)) paleta.style.display = "none";
  });
}

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

// ======================= ⭐ PINTAR VERSICULO  =============================
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  const selMarcador = modoMarcador && seleccionMarcador[id];

const aplicado = ultimoMarcadorAplicado &&
  ultimoMarcadorAplicado.libro === v.Libro &&
  Number(ultimoMarcadorAplicado.capitulo) === Number(v.Capitulo) &&
  (ultimoMarcadorAplicado.versiculos || []).includes(Number(v.Versiculo));
  
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
  // ✅ MODO MARCADOR: selección bien visible (especialmente en oscuro)
  if (selMarcador) {
    div.style.background = enOscuro
      ? "rgba(209, 238, 255, 0.55)"   // más fuerte en oscuro
      : "rgba(209, 238, 255, 0.92)";  // casi sólido en claro
  } else if (aplicado && ultimoMarcadorAplicado?.color) {
    // ✅ si hay marcador "keep", lo mostramos aunque estés seleccionando
    div.style.background = ultimoMarcadorAplicado.color;
  } else {
    // ✅ ocultar resaltados viejos
    div.style.background = "transparent";
  }

} else {
  // modo normal
  if (aplicado && ultimoMarcadorAplicado?.color) {
    div.style.background = ultimoMarcadorAplicado.color;
  } else {
    div.style.background = marcado?.color || "transparent";
  }
}

if (selMarcador) div.style.border = "2px solid #4f6fa8";
else div.style.border = "none";

// ================= Color de Texto (FIX MODO MARCADOR) =================
if (modoImagen) {
  // modo imagen: seleccionado negro, no seleccionado según tema
  div.style.color = imagen ? "#000000" : (enOscuro ? "#ffffff" : "#000000");
} else {

  // ✅ si estoy seleccionando para marcador, quiero que SIEMPRE se lea
  if (modoMarcador && selMarcador) {
    div.style.color = "#000000"; // el fondo de selección es claro
  } else {
    // fondo real SOLO cuando realmente estás mostrando un fondo
    let fondo = null;

    if (modoMarcador) {
      // ✅ en modo marcador NO usar "marcado.color" si NO lo estás pintando
      if (aplicado && ultimoMarcadorAplicado?.color) fondo = ultimoMarcadorAplicado.color;
      // si no hay aplicado, fondo queda null -> color por tema
    } else {
      if (aplicado && ultimoMarcadorAplicado?.color) fondo = ultimoMarcadorAplicado.color;
      else if (marcado?.color) fondo = marcado.color;
    }

    if (fondo) div.style.color = colorContraste(fondo);
    else div.style.color = enOscuro ? "#ffffff" : "#000000";
  }
}

 // ================= Opacidad (UX Modo imagen y Modo Marcador) =================
if (modoImagen && !imagen) {
  div.style.opacity = "0.6";
} else {
  div.style.opacity = "1";
}

  // ================= Contenido =================
div.innerHTML = `
  <span class="num">${v.Versiculo}</span>
  <span class="txt">${v.RV1960}</span>
`;

  // ================= Click =================
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  texto.appendChild(div);
}

// ================= ⭐ OBTIENE VERSICULO SELECCIONADO =======================
function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) return "";

  // ordenar por número de versículo
 ids.sort((a,b) => {
  const [la, ca, va] = a.split("_");
  const [lb, cb, vb] = b.split("_");
  if (la !== lb) return la.localeCompare(lb);
  if (Number(ca) !== Number(cb)) return Number(ca) - Number(cb);
  return Number(va) - Number(vb);
});

  let textos = [];
  let numeros = [];
  let libro = "";
  let cap = "";

  ids.forEach(id => {
    const [l, c, v] = id.split("_");
    const vers = bibliaData.find(x =>
      x.Libro === l &&
      x.Capitulo == c &&
      x.Versiculo == v
    );

    if (vers) {
      libro = l;
      cap = c;
      textos.push(vers.RV1960);
      numeros.push(Number(v));
    }
  });

  // convertir a rangos
  const partes = [];
  let inicio = numeros[0];
  let anterior = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === anterior + 1) {
      anterior = numeros[i];
    } else {
      partes.push(inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`);
      inicio = numeros[i];
      anterior = numeros[i];
    }
  }
  partes.push(inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`);

  const referencia = `${libro} ${cap}:${partes.join(",")}`;
  return textos.join(" ") + "\n\n▪ " + referencia;
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
// 🔗 Listeners de personalización 
["personalizarOpacidad", "personalizarTamaño", "personalizarColor"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;

  const handler = () => {
    if (id === "personalizarTamaño") userSetFontSize = true; // ✅ manual SOLO si tocan tamaño
    actualizarPreview();
  };

  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
});

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
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
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

  // ================= Texto Versiculos Biblia o Bloque OCR Devocional =================
 const textoFinal = modoTextoExterno
  ? (textoExternoModal || "")
  : obtenerVersiculoSeleccionado();

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
}

// ================= ⭐ CANVAS GENERA IMAGEN FINAL (FIX REAL) ============================
async function generarImagenFinal() {
  const preview = document.getElementById("previewImagen");
  const canvasFinal = document.getElementById("canvasFinal");
  const modal = document.getElementById("modalPersonalizar");

  if (!preview || !canvasFinal) {
  return false;
}

if (modal && getComputedStyle(modal).display === "none") {
  canvasFinal.width = 0; canvasFinal.height = 0;
  return false;
}
  // refrescar estilos
  actualizarPreview();

  // asegurar layout real
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await document.fonts.ready;

  const rect = preview.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return false;

  // asegurar texto visible
  preview.classList.remove("render-final");
  const t1 = document.getElementById("previewTexto");
  const t2 = document.getElementById("previewTextoBack");
  if (t1) t1.style.display = "block";
  if (t2) t2.style.display = "block";

  let canvasTemp;
  
// ✅ esperar a que el navegador “pinte” stroke/shadow y fondo
await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
await new Promise(r => setTimeout(r, 120));

try {
  const fondoUsable = fondoFinalBlobUrl || fondoFinal;

  canvasTemp = await html2canvas(preview, {
    scale: Math.max(2, window.devicePixelRatio || 2),
    useCORS: true,
    allowTaint: false,
     // ✅ Si hay fondo, TRANSPARENTE (evita esquinas blancas con border-radius)
  // ✅ Si no hay fondo, BLANCO (evita fondo negro)
    backgroundColor: fondoUsable ? null : "#ffffff"
  });

    } catch (err) {
    console.error("html2canvas falló:", err);
    alert("No se pudo generar PNG. Probable problema de CORS con el fondo elegido.\nProbá con otro fondo o sin fondo.");
    return false;
  }

  canvasFinal.width = canvasTemp.width;
  canvasFinal.height = canvasTemp.height;

  const ctx = canvasFinal.getContext("2d");
  ctx.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
  ctx.drawImage(canvasTemp, 0, 0);

   // subir imagen (si existe la función)
  const subirIglesia = !!document.getElementById("checkIglesia")?.checked;

// ✅ Subir SOLO si NO estamos capturando pasos devocional
if (!window.__devPasoCaptura && typeof subirImagen === "function") {
  const tareas = [];
  if (subirIglesia) tareas.push(subirImagen("iglesia"));
  tareas.push(subirImagen("personal"));

  const resultados = await Promise.allSettled(tareas);
  const fallos = resultados.filter(r => r.status === "rejected");
  if (fallos.length) {
    console.warn("⚠️ Subida falló:", fallos);
    mostrarToast("⚠️ Se descargó la imagen, pero no se pudo subir.");
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
      capitulo: Number(capSel?.value || 0)
    });

    console.log("✅ Imagen subida:", destino, url);
  } catch (e) {
    console.error("❌ Error subiendo imagen:", e);
    mostrarToast("❌ No se pudo subir la imagen");
  }
  
}

// ======================== ⭐ OPCION DESCARGAR (FIX) ====================================
async function descargarImagenFinal() {
  const canvas = document.getElementById("canvasFinal");
  if (!canvas) return;

  // ✅ SIEMPRE regenerar antes de descargar (evita “me baja el PNG viejo”)
  const ok = await generarImagenFinal();
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
}

// ========================⭐ OPCION COMPARTIR ====================================
async function compartirImagenFinal() {
  const canvas = document.getElementById("canvasFinal");
  if (!canvas) return;
// ✅ SIEMPRE regenerar antes de descargar (evita “me baja el PNG viejo”)
const ok = await generarImagenFinal();
if (!ok) return;

  canvas.toBlob(async blob => {
    if (!blob) {
      await descargarImagenFinal();
      return;
    }

    const file = new File([blob], "versiculo.png", { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Versículo" });
    } else {
      await descargarImagenFinal();
      alert("Tu dispositivo no permite compartir directamente. La imagen se descargó para que la compartas manualmente.");
    }
  }, "image/png");
}

// ================= ⭐ RESET DEL MODAL  =======================
function resetModalPersonalizar() {
  userSetFontSize = false;
  modoTextoExterno = false;
  textoExternoModal = "";
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
    colorInput.value = document.body.classList.contains("oscuro")
      ? "#ffffff"
      : "#000000";
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

  document.getElementById("modalPersonalizar").style.display = "none";
  mostrarTexto();
  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();

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

  // 3) defaults internos
  if (seccion === "iglesia") {
    window.mostrarIglesiaSub?.("devocionales"); // que arranque ahí
  }
  if (seccion === "panel") {
    window.mostrarSeccion?.("imagenes"); // que arranque en imágenes
  }

  // 4) repintar biblia solo cuando estás en biblia
  if (seccion === "biblia") mostrarTexto();
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

  modal.style.display = "flex";

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
};

// ================= ✅ FINALIZAR EDICIÓN (CONFIRMAR) =================
window.finalizarEdicion = async () => {

  // Si querés: antes de finalizar, aseguramos que el PNG se pueda generar
  // (así no salís sin poder descargar). Si no querés esto, decime y lo saco.
  const ok = await generarImagenFinal();
  if (!ok) {
    alert("No se pudo generar la imagen (PNG). Revisá consola (F12) para ver el error.");
    return; // no dejamos finalizar si no hay PNG
  }

  const terminar = confirm(
    "¿Terminar edición?\n\nOK = Terminar edición y volver a Biblia\nCancelar = Volver a edición"
  );

  if (!terminar) {
    // Volver a edición = no hacer nada (modal sigue abierto)
    return;
  }

  // Terminar edición:
  resetModalPersonalizar();  // limpia controles
  salirModoImagen();         // sale de modo imagen y cierra modal
  irA("biblia");             // vuelve a biblia
};

// ================= 🔺 CAMBIAR LETRA ===============================
window.cambiarLetra = delta => {
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
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
};

// ================= ✨ Cerrar Marcadores 📌=================
window.cerrarMarcadores = () => {
  const modal = document.getElementById("modalMarcadores");
  if (modal) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }
  refrescarBotonGuardarMarcador();
};

// ================= ✨ Render Lista Marcadores 📌=================
function renderListaMarcadores() {
  const lista = document.getElementById("listaMarcadores");
  if (!lista) return;

  const items = Object.entries(marcadores || {})
    .map(([id, m]) => ({ ...m, id }))
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
    items
      .map(m => {
        const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleDateString("es-AR") : "";
        const refTxt = m.ref || (m.libro && m.capitulo ? `${m.libro} ${m.capitulo}` : "Nota");
        const titulo = (m.titulo || "Marcador").replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // ✅ línea simple
        const linea = `${refTxt} - ${fechaTxt} - ${titulo}`;

        return `
          <div class="card-marcador" style="cursor:pointer;" onclick="abrirMarcador('${m.id}')">
            <div style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${linea}
            </div>
          </div>
        `;
      })
      .join("");
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

  const ids = Object.keys(seleccionMarcador || {});
  if (ids.length === 0) {
    box.innerHTML = "";
    return;
  }

  ids.sort((a,b) => {
    const va = Number(a.split("_")[2]);
    const vb = Number(b.split("_")[2]);
    return va - vb;
  });

  const libro = libroSel.value;
  const cap = Number(capSel.value);

  const partes = ids.map(id => {
    const n = Number(id.split("_")[2]);
    const vv = bibliaData.find(x => x.Libro === libro && x.Capitulo == cap && x.Versiculo == n);
    const txt = vv ? vv.RV1960 : "";
    return `<div><span style="opacity:.75">${n}</span> ${txt}</div>`;
  }).join("");

  box.innerHTML = partes;
}

// ================= ✨ Abrir Form Nuevo Marcador 📌=================
window.abrirFormNuevoMarcador = () => {
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
let filtroNotasPanel = "con"; // "con" | "sin"

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

  // ✅ Filtro: SOLO NOTAS (con versículo / sin versículo)
  const filtrados = ordenados.filter(m => {
    const tieneNota = !!(m.nota && String(m.nota).trim());
    if (!tieneNota) return false;

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
    : `<i class="fa-solid fa-sheet-plastic"></i>`;

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
  filtroNotasPanel = (filtroNotasPanel === "con") ? "sin" : "con";
  renderPanelMarcadores();
};

// ✅ FIX: desde el panel SIEMPRE ir a la Biblia y recién ahí abrir marcador
window.abrirMarcadorDesdePanel = (idMarcador) => {
  irA("biblia"); // cambia de sección

  // esperamos un pelín para que ya esté visible
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
  const grid = document.getElementById("grid-imagenes");
  const vacio = document.getElementById("imagenes-vacio");
  if (!grid || !vacio) return;

  const items = Object.entries(data || {})
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .sort((a,b) => (b.fecha || 0) - (a.fecha || 0));

  if (!items.length) {
    vacio.style.display = "block";
    grid.innerHTML = "";
    return;
  }

  vacio.style.display = "none";

  grid.innerHTML = items.map(it => {
    const refTxt = (it.libro && it.capitulo) ? `${it.libro} ${it.capitulo}` : "Imagen";
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = (it.url || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");

    return `
      <div class="card-imagen">
        <img src="${url}" alt="Imagen generada" loading="lazy">
        <div class="nombre">${refTxt} · ${fechaTxt}</div>
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

// ================= 🔺 OCLTAR BARRA DE ACCIONES ===========================
let timerBarra = null;

window.ocultarBarraAcciones = () => {
  document.body.classList.add("barra-oculta");
  const btn = document.getElementById("btnMostrarBarra");
  if (btn) btn.style.display = "inline-flex";

  // 🔥 después de unos segundos lo dejo más transparente
  clearTimeout(timerBarra);
  timerBarra = setTimeout(() => {
    if (btn) btn.style.opacity = "0.35";
  }, 2500);
};

// ================= 🔺 MOSTRAR BARRA DE ACCIONES ===========================
window.mostrarBarraAcciones = () => {
  document.body.classList.remove("barra-oculta");
  const btn = document.getElementById("btnMostrarBarra");
  if (btn) {
    btn.style.display = "none";
    btn.style.opacity = "0.55";
  }
};

let __compartirMarcadorId = null;

// ================= 🔺 ABRIR COMPARTIR MARCADOR ===========================
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

// ================= MODAL 3: AUDIO (DEVOCIONAL) =================
let __audioTextoOriginal = "";
let __audioLastUrl = "";     // si tu AppSheet devuelve URL final del mp3/wav
let __audioLastTs = 0;       // para asociar subidas
let __audioSpeaking = false;

// ✅ Fonética: si vos ya tenés un sistema, esto NO lo pisa.
// Solo agrega Joiada con J si hace falta.
window.__FONETICA = window.__FONETICA || {};
if (!window.__FONETICA["Joiada"]) {
  // Truco: “Joíada” suele forzar mejor la J en TTS español
  window.__FONETICA["Joiada"] = "Joíada";
}

// ✅ Normaliza texto para lectura (respeta ¿?¡! y agrega micro pausas)
function audio_prepararTextoParaVoz(txt) {
  let t = String(txt || "");

  // 1) aplicar fonética (mapa)
  const mapa = window.__FONETICA || {};
  Object.keys(mapa).forEach(k => {
    const val = mapa[k];
    // reemplazo simple (no regex raro)
    t = t.split(k).join(val);
  });

  // 2) pausas suaves: sin borrar signos, solo ayudamos al “tono”
  //    (algunos TTS ignoran signos, esto ayuda)
  t = t
    .replace(/([¿¡])/g, "$1 ")     // espacio después de ¿¡
    .replace(/([?.!])(\S)/g, "$1 $2");

  return t.trim();
}

// ✅ Obtener texto que hoy está en tu preview (el de la imagen)
function audio_getTextoDesdePreview() {
  const el = document.getElementById("previewTexto");
  const t = el ? (el.innerText || "") : "";
  return t.trim();
}

// ✅ Abrir/Cerrar modal
window.abrirModalAudio = () => {
  const modal = document.getElementById("modalAudio");
  const ta = document.getElementById("textoAudio");
  const estado = document.getElementById("audioEstado");
  const audio = document.getElementById("audioPreview");

  if (!modal || !ta) return;

  // ✅ TEXTO BASE: en devocional final usar SIEMPRE el texto completo guardado
  const base =
    (window.__devPaso === 3 && window.__devTextoCompleto)
      ? String(window.__devTextoCompleto || "").trim()
      : audio_getTextoDesdePreview();

  __audioTextoOriginal = base;
  ta.value = base;

  // limpiar player (hasta que exista audio real)
  if (audio) audio.removeAttribute("src");
  if (estado) estado.textContent = "Listo para previsualizar.";

  // ✅ abrir como el resto de tus modales
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
};

window.cerrarModalAudio = () => {
  const modal = document.getElementById("modalAudio");
  if (!modal) return;

  try { window.speechSynthesis?.cancel(); } catch(e){}

  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
};

window.restaurarTextoAudio = () => {
  const ta = document.getElementById("textoAudio");
  if (!ta) return;
  ta.value = __audioTextoOriginal || "";
};

// ✅ Escucha previa: usa la voz del dispositivo (NO genera archivo)
window.escucharPreviaAudio = () => {
  const ta = document.getElementById("textoAudio");
  const estado = document.getElementById("audioEstado");
  if (!ta) return;

  const raw = ta.value || "";
  const texto = audio_prepararTextoParaVoz(raw);

  if (!texto.trim()) {
    if (estado) estado.textContent = "⚠️ No hay texto para leer.";
    return;
  }

  if (!("speechSynthesis" in window)) {
    if (estado) estado.textContent = "⚠️ Tu dispositivo no soporta lectura por voz.";
    alert("Tu dispositivo no soporta lectura por voz (speechSynthesis).");
    return;
  }

  try {
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(texto);

    // idioma español (Argentina)
    u.lang = "es-AR";

    // valores suaves (si querés más “radio”, decime y lo ajusto)
    u.rate = 0.95;
    u.pitch = 1.0;
    u.volume = 1.0;

    __audioSpeaking = true;
    if (estado) estado.textContent = "▶ Reproduciendo previa…";

    u.onend = () => {
      __audioSpeaking = false;
      if (estado) estado.textContent = "✅ Previa finalizada.";
    };
    u.onerror = () => {
      __audioSpeaking = false;
      if (estado) estado.textContent = "❌ No se pudo reproducir la previa.";
    };

    window.speechSynthesis.speak(u);
  } catch (e) {
    console.error(e);
    if (estado) estado.textContent = "❌ Error al reproducir previa.";
  }
};

// ✅ Subir audio REAL (vía tu AppSheet/GitHub)
// IMPORTANTE: esto NO inventa tu sistema. Solo llama a una función si ya existe.
window.finalizarYSubirAudio = async () => {
  const estado = document.getElementById("audioEstado");
  const ta = document.getElementById("textoAudio");
  const chk = document.getElementById("checkIglesiaAudio");

  if (!ta) return;
  const texto = (ta.value || "").trim();
  if (!texto) {
    if (estado) estado.textContent = "⚠️ Pegá o escribí el texto antes de subir.";
    return;
  }

  const subirIglesia = !!chk?.checked;

  // 1) Si vos ya tenés una función global (por ejemplo, la traés desde otro JS),
  //    la usamos tal cual:
  //    window.subirAudioAGithub({ texto, subirIglesia, ... }) => debería devolver {url}
  if (typeof window.subirAudioAGithub === "function") {
    try {
      if (estado) estado.textContent = "⬆ Subiendo audio…";
      const resp = await window.subirAudioAGithub({
        texto,
        subirIglesia,
        ts: Date.now()
      });

      const url = resp?.url || resp?.audioUrl || "";
      __audioLastUrl = url || "";
      __audioLastTs = Date.now();

      // poner en el player si hay url
      const audio = document.getElementById("audioPreview");
      if (audio && url) audio.src = url;

      if (estado) estado.textContent = url ? "✅ Audio subido y listo para escuchar." : "✅ Subido (sin URL devuelta).";
      return;
    } catch (e) {
      console.error(e);
      if (estado) estado.textContent = "❌ No se pudo subir el audio (falló tu función).";
      return;
    }
  }

  // 2) Si NO existe tu función todavía, dejamos un mensaje claro:
  if (estado) estado.textContent =
    "⚠️ Falta conectar tu subida real (AppSheet/GitHub). " +
    "Decime el nombre EXACTO de tu función o pegá ese bloque acá y lo conecto sin romper nada.";
  alert("Todavía no está conectado el bloque real de subida (AppSheet/GitHub).");
};

// ✅ Botón del modal de imagen -> abre modal audio
document.addEventListener("DOMContentLoaded", () => {
  const b = document.getElementById("btnAbrirAudio");
  if (b) {
    b.type = "button";
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.abrirModalAudio?.();
    };
  }
});

// ================= mas de AUDIOS 😆 =================
// ✅ URL del Web App de Apps Script (Deploy -> Web app)
const AUDIO_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwDgVe2-aMdEEoqEF0ZFGnQYWArTFjU1TPoGR4WytbYitz6q3CkAtjmz0HobAcqJbs9Uw/exec";

window.subirAudioAGithub = async ({ texto, subirIglesia, ts }) => {
  const r = await fetch(AUDIO_WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texto, subirIglesia, ts })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) {
    throw new Error(data?.error || "No devolvió URL");
  }
  return { url: data.url };
};

// ================= 🔺 HACER FUNCIONES GLOBALES (FIX DESCARGAR/COMPARTIR EN PC) =================
window.generarImagenFinal = generarImagenFinal;
window.descargarImagenFinal = descargarImagenFinal;
window.compartirImagenFinal = compartirImagenFinal;
window.finalizarEdicion = window.finalizarEdicion;
window.cancelarCrearImagen = window.cancelarCrearImagen;

// ================= 💛 DEVOCIONALES =================
function uiModoFondosSolo() {
  const fondos = document.getElementById("personalizarFondos");
  const plano  = document.getElementById("fondoPlanoBox");
  if (fondos) fondos.style.display = "flex";
  if (plano)  plano.style.display  = "none";
}

function uiModoFondoPlanoSolo() {
  const fondos = document.getElementById("personalizarFondos");
  const plano  = document.getElementById("fondoPlanoBox");
  if (fondos) fondos.style.display = "none";
  if (plano)  plano.style.display  = "block";
}

// botón “Aplicar”
window.aplicarFondoPlanoDesdePicker = () => {
  const c = document.getElementById("colorFondoPlano")?.value || "#ffffff";
  const previewImagen = document.getElementById("previewImagen");
  if (previewImagen) {
    // fondo plano: sin imagen
    fondoFinal = null;
    if (fondoFinalBlobUrl) {
      URL.revokeObjectURL(fondoFinalBlobUrl);
      fondoFinalBlobUrl = null;
    }
    previewImagen.style.backgroundImage = "none";
    previewImagen.style.backgroundColor = c;
  }
  // sin caja atrás del texto
  const back = document.getElementById("previewTextoWrapper");
  if (back) back.style.backgroundColor = "rgba(0,0,0,0)";
  actualizarPreview();
};

// ================= 💛 DEVOCIONALES =================
window.abrirPersonalizarConTexto = function(texto, opts = {}) {
  if (!texto) return;

  // ✅ siempre arrancamos limpio
  resetModalPersonalizar();

  modoTextoExterno = true;
  textoExternoModal = String(texto);

  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.style.display = "flex";

  const boxFormato = document.getElementById("boxFormato");
  const esDev = !!opts.devPaso;

  // ✅ En devocionales NO se elige formato manual
  if (boxFormato) boxFormato.style.display = esDev ? "none" : "flex";

  const paso = Number(opts.paso || 1);

  if (paso === 1) {
    // ✅ Bloque 1: CUADRADO + fondos galería
    setFormatoImagen("post");
    uiModoFondosSolo();
    cargarFondos();

    const previewImagen = document.getElementById("previewImagen");
    if (previewImagen) {
      previewImagen.style.backgroundImage = "none";
      previewImagen.style.backgroundColor = "#ffffff";
    }
  }

  if (paso === 2) {
    // ✅ Bloque 2: STORY + solo color plano
    setFormatoImagen("story");
    uiModoFondoPlanoSolo();

    const color = opts.color || "#ffffff";
    const picker = document.getElementById("colorFondoPlano");
    if (picker) picker.value = color;
    window.aplicarFondoPlanoDesdePicker();
  }

  // fuentes (siempre)
  crearListaVisualFuentes();

  actualizarPreview();
};

// ================= IGLESIA: SUBSECCIONES =================
window.mostrarIglesiaSub = (sub) => {
  const dev = document.getElementById("iglesia-devocionales");
  const abc = document.getElementById("iglesia-abc");

  if (dev) dev.style.display = (sub === "devocionales") ? "block" : "none";
  if (abc) abc.style.display = (sub === "abc") ? "block" : "none";

  // marcar botón activo
  const tabsIglesia = document.querySelectorAll("#seccion-iglesia .panel-tabs button");
  tabsIglesia.forEach(b => b.classList.remove("activo"));

  const btn = document.querySelector(`#seccion-iglesia .panel-tabs button[onclick="mostrarIglesiaSub('${sub}')"]`);
  if (btn) btn.classList.add("activo");
};

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
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      guardarNuevoMarcador();
    };
  }

  // 4) arrancar en biblia
  window.irA?.("biblia");
});

// ================= ✅ DEVOCIONAL 3 PASOS arma la imagen final combinada =================
window.__devPaso = 0;
window.__devImg1 = null;
window.__devImg2 = null;

function dev_setUI(paso) {
  const b1 = document.getElementById("btnDevSiguiente1");
  const b2 = document.getElementById("btnDevSiguiente2");
  const bf = document.getElementById("btnDevVerFinal");
  const acciones = document.querySelector("#modalPersonalizar .fila-final");
  const btnAudio = document.getElementById("btnAbrirAudio");

  // botones finales (download/share/check/iglesia)
  const btnDesc = acciones?.querySelector('button[onclick="descargarImagenFinal()"]');
  const btnShare = acciones?.querySelector('button[onclick="compartirImagenFinal()"]');
  const btnFin = acciones?.querySelector('button[onclick="finalizarEdicion()"]');
  const chk = acciones?.querySelector(".subir-iglesia-btn");

  // reset
  if (b1) b1.style.display = "none";
  if (b2) b2.style.display = "none";
  if (bf) bf.style.display = "none";

  if (btnDesc) btnDesc.style.display = "none";
  if (btnShare) btnShare.style.display = "none";
  if (btnFin) btnFin.style.display = "none";
  if (chk) chk.style.display = "none";
  if (btnAudio) btnAudio.style.display = "none";

  // pasos
  if (paso === 1) {
    if (b1) b1.style.display = "inline-flex";
  } else if (paso === 2) {
    if (b2) b2.style.display = "inline-flex";
  } else if (paso === 3) {
    if (bf) bf.style.display = "inline-flex";
    // acciones finales SOLO en final
    if (btnDesc) btnDesc.style.display = "inline-flex";
    if (btnShare) btnShare.style.display = "inline-flex";
    if (btnFin) btnFin.style.display = "inline-flex";
    if (chk) chk.style.display = "inline-flex";
    if (btnAudio) btnAudio.style.display = "inline-flex";

  }
}

async function dev_capturar() {
  const ok = await generarImagenFinal();
  if (!ok) return null;
  const c = document.getElementById("canvasFinal");
  return c ? c.toDataURL("image/png") : null;
}

function dev_cargarImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

async function dev_armarFinal() {
  if (!window.__devImg1 || !window.__devImg2) {
    alert("Falta Bloque 1 o Bloque 2.");
    return;
  }

  const img1 = await dev_cargarImg(window.__devImg1);
  const img2 = await dev_cargarImg(window.__devImg2);

  const W = Math.max(img1.width, img2.width);
  const H = img1.height + img2.height;

  const canvasFinal = document.getElementById("canvasFinal");
  if (!canvasFinal) return;

  canvasFinal.width = W;
  canvasFinal.height = H;

  const ctx = canvasFinal.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img1, 0, 0);
  ctx.drawImage(img2, 0, img1.height);

  // mostrar en el preview como “resultado final”
  const previewImagen = document.getElementById("previewImagen");
  if (previewImagen) {
    previewImagen.style.backgroundImage = "none";
    previewImagen.style.backgroundColor = "#ffffff";
  }

  // ocultar textos del preview para que no molesten
  document.getElementById("previewTexto")?.style && (document.getElementById("previewTexto").style.display = "none");
  document.getElementById("previewTextoBack")?.style && (document.getElementById("previewTextoBack").style.display = "none");

  // mostrar canvas final (en vez de preview html)
  canvasFinal.style.display = "block";
  canvasFinal.style.width = "100%";
  canvasFinal.style.maxWidth = "420px";
  canvasFinal.style.borderRadius = "12px";
}

// Hook: cuando abro el modal desde devocional, activo pasos
const _abrirOriginal = window.abrirPersonalizarConTexto;
window.abrirPersonalizarConTexto = function(texto, opts = {}) {
  _abrirOriginal(texto, opts);

  // devocional: si opts.devPaso viene 1 o 2 o 3
  if (opts.devPaso) {
    window.__devPaso = opts.devPaso;
    dev_setUI(opts.devPaso);

    // si es final, arma el canvas combinado
    if (opts.devPaso === 3) {
      dev_armarFinal().then(() => {
        dev_setUI(3);
      });
    }
  }
};

// botones
document.addEventListener("DOMContentLoaded", () => {
  const b1 = document.getElementById("btnDevSiguiente1");
  const b2 = document.getElementById("btnDevSiguiente2");
  const bf = document.getElementById("btnDevVerFinal");

  if (b1) b1.onclick = async () => {
    const snap = await dev_capturar();
    if (!snap) return alert("No se pudo guardar Bloque 1.");
    window.__devImg1 = snap;

    // devocionales.js tiene que abrir el bloque 2 (lo hacemos desde window)
    window.__devSiguiente?.(2);
  };

  if (b2) b2.onclick = async () => {
    const snap = await dev_capturar();
    if (!snap) return alert("No se pudo guardar Bloque 2.");
    window.__devImg2 = snap;

    window.__devSiguiente?.(3);
  };

  if (bf) bf.onclick = async () => {
    dev_setUI(3);
    await dev_armarFinal();
  };
});
