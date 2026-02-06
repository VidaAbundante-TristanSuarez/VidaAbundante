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
  projectId: "vidaabundante-f118a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

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

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

let filtroMarcadoresPanel = "ambos"; // "ambos" | "notas" | "versiculos"
let creandoNotaLibre = false;        // ✅ nota sin versículos

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

// ========================= 🎨 RESALTADOR COMPACTO  =======================================
document.addEventListener("DOMContentLoaded", () => {

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

      // Quitar candado de todos los botones
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
  
    // Quitar todos los candados anteriores
    paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

    if (resaltadorBloqueado) {
      // Colocar candado sobre el color actual
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
    if (!cont.contains(e.target)) {
      paleta.style.display = "none";
    }
  });

});

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
  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${v.RV1960}`;

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
["personalizarOpacidad","personalizarTamaño","personalizarColor"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", actualizarPreview);
  el.addEventListener("change", actualizarPreview);
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

  // ================= Texto =================
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

  // ================= Formato / Tamaño =================
const formatoStory = previewImagen.classList.contains("preview-story");
const sizeSlider = document.getElementById("personalizarTamaño");
const sizeBase = sizeSlider ? Number(sizeSlider.value) : (formatoStory ? 56 : 48);

let fontSize = sizeBase;
previewTexto.style.lineHeight = "1.3";
previewTextoBack.style.lineHeight = "1.3";

// alto usable real del wrapper (sin padding)
const cs = getComputedStyle(wrapper);
const maxHeight =
  wrapper.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

// aplicar el size que eligió el usuario primero
previewTexto.style.fontSize = fontSize + "px";
previewTextoBack.style.fontSize = fontSize + "px";
previewTexto.offsetHeight; // fuerza reflow

// si se desborda, recién ahí achicamos
let guard = 0;
while (previewTexto.scrollHeight > maxHeight && fontSize > 14 && guard < 200) {
  fontSize--;
  previewTexto.style.fontSize = fontSize + "px";
  previewTextoBack.style.fontSize = fontSize + "px";
  guard++;
}

  // ================= Color / Outline =================
  const colorEl = document.getElementById("personalizarColor");
  const opEl = document.getElementById("personalizarOpacidad");

  const color = colorEl ? colorEl.value : "#000000";
  const opacidad = opEl ? opEl.value : "0.3";
  const outlineColor = colorOutlineDesdeBase(color);
  const px = 2; // 👈 grosor del borde

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

// backup por si stroke falla en algún navegador
previewTextoBack.style.textShadow = `
  -${px}px 0 ${outlineColor},
   ${px}px 0 ${outlineColor},
   0 -${px}px ${outlineColor},
   0  ${px}px ${outlineColor},
  -${px}px -${px}px ${outlineColor},
   ${px}px -${px}px ${outlineColor},
  -${px}px  ${px}px ${outlineColor},
   ${px}px  ${px}px ${outlineColor}
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

  if (typeof subirImagen === "function") {
    const tareas = [];
    if (subirIglesia) tareas.push(subirImagen("iglesia"));
    tareas.push(subirImagen("personal"));
    await Promise.all(tareas); // ✅ asegura que termine antes de seguir
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
  fondoFinal = null;
  
  if (fondoFinalBlobUrl) {
  URL.revokeObjectURL(fondoFinalBlobUrl);
  fondoFinalBlobUrl = null;
}
  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  document.getElementById("personalizarTamaño").value = 32;
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
}

// ================= 🔺 WINDOW / UI ⭕ ===============================
window.irA = seccion => {
  ["biblia", "devocionales", "abc", "iglesia", "panel"].forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = s === seccion ? "block" : "none";
  });
  mostrarTexto();
};

// ================= 🔺 MODO IMAGEN ===============================
window.toggleModoImagen = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  modoImagen = !modoImagen;
  seleccionImagen = {};

  // clase global
  document.body.classList.toggle("modo-imagen", modoImagen);

  // 🖼️ banner modo imagen
  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = modoImagen ? "block" : "none";
  }

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
window.cancelarNuevoMarcador = (volverABibliaModoMarcador = false) => {
  const modal = document.getElementById("modalMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const lista = document.getElementById("listaMarcadores");

  // limpiar flags de edición
  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;
  creandoNotaLibre = false;

  if (volverABibliaModoMarcador) {
    // ✅ cerrar modal y volver a biblia en modo marcador
    if (modal) {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    if (form) form.style.display = "none";
    if (lista) lista.style.display = "block";

    // ✅ asegurar que modo marcador siga activo
    modoMarcador = true;
    document.body.classList.add("modo-marcador");

    const btn = document.getElementById("btnModoMarcadorBarra");
    if (btn) btn.classList.add("activo");

    const banner = document.getElementById("bannerModoMarcador");
    if (banner) banner.style.display = "block";

    aplicarUIAccionesPorModo();
    refrescarBotonGuardarMarcador();
    mostrarTexto();
    renderPreviewVersiculosMarcador();
    return;
  }

  // comportamiento normal: volver a la lista dentro del modal
  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";
};

// ================= ✨ Guardar Nuevo Marcador 📌=================
window.guardarNuevoMarcador = async () => {
  if (!uid) return;

  const editando = !!window.__editMarcadorId;

  // ✅ 1) si estoy creando nuevo: uso selección
  // ✅ 2) si estoy editando: uso la base guardada (no rompe aunque no haya selección)
  let ids = Object.keys(seleccionMarcador || {});
  let nums = ids.map(id => Number(id.split("_")[2])).sort((a,b)=>a-b);

  if (nums.length === 0 && editando && window.__editMarcadorBase?.versiculos?.length) {
    nums = window.__editMarcadorBase.versiculos.slice().sort((a,b)=>a-b);
  }

  // ✅ YA NO OBLIGA A SELECCIONAR
  // Si no hay versículos, se guarda igual con versiculos: []
  // y la referencia queda "Libro Capítulo" (sin :rango)

  const titulo = (document.getElementById("marcadorTitulo").value || "").trim();
  const nota = (document.getElementById("marcadorNota").value || "").trim();
  const color = document.getElementById("marcadorColor").value || "#fff3b0";
  const keep = document.getElementById("marcadorKeep").checked;

  // ✅ libro/capítulo: si estoy editando, respeto lo del marcador; si no, lo actual
  const libroBase = editando ? (window.__editMarcadorBase?.libro || libroSel.value) : libroSel.value;
  const capBase   = editando ? (window.__editMarcadorBase?.capitulo || Number(capSel.value)) : Number(capSel.value);

  // ✅ ref: con rango si hay versículos, si no solo "Libro Capítulo"
  const refTxt = (nums.length > 0)
    ? `${libroBase} ${capBase}:${formatearVersiculosComoRango(nums)}`
    : `${libroBase} ${capBase}`;

  const data = {
    fecha: editando ? (marcadores?.[window.__editMarcadorId]?.fecha || Date.now()) : Date.now(),
    titulo: titulo || "Marcador",
    nota,
    libro: libroBase,
    capitulo: Number(capBase),
    versiculos: nums,   // ✅ puede ser []
    ref: refTxt,
    color,
    keep
  };

  const idMarcador = window.__editMarcadorId || `${Date.now()}`;
  await set(ref(db, `marcadores/${uid}/${idMarcador}`), data);

  // limpiar estado edición
  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;

  ultimoMarcadorAplicado = keep ? { ...data } : null;

  // salir del modo marcador si estaba
  modoMarcador = false;
  seleccionMarcador = {};
  document.body.classList.remove("modo-marcador");

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.remove("activo");

  refrescarBotonGuardarMarcador();
  mostrarToast("✅ Guardado");
  cerrarMarcadores();
  mostrarTexto();
};

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
let ordenMarcadores = "fecha"; // "fecha" | "biblia"
let modoEliminarMarcadores = false;
let seleccionEliminarMarcadores = {}; // {id:true}

function renderPanelMarcadores() {
  const panel = document.getElementById("panel-marcadores");
  if (!panel) return;

  // ✅ así nunca se pisa el id
  const items = Object.entries(marcadores || {}).map(([id, m]) => ({ ...m, id }));

  const ordenados = items.sort((a,b) => {
    if (ordenMarcadores === "biblia") {
      const la = (a.libro || "").localeCompare(b.libro || "");
      if (la !== 0) return la;
      const ca = (a.capitulo || 0) - (b.capitulo || 0);
      if (ca !== 0) return ca;
      return ((a.versiculos?.[0] || 0) - (b.versiculos?.[0] || 0));
    }
    return (b.fecha || 0) - (a.fecha || 0);
  });

  const cantSel = Object.keys(seleccionEliminarMarcadores || {}).length;

  // ✅ filtro (todos | notas | versiculos)
  const filtrados = ordenados.filter(m => {
    if (filtroMarcadoresPanel === "notas") return !!(m.nota && m.nota.trim());
    if (filtroMarcadoresPanel === "versiculos") return (m.versiculos || []).length > 0;
    return true;
  });

  panel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <b>📌 Marcadores</b>

        <label style="font-size:13px; display:flex; gap:6px; align-items:center;">
          Ordenar:
          <select id="ordenMarcadoresSelect" style="padding:6px 10px; border-radius:999px;">
            <option value="fecha">Fecha</option>
            <option value="biblia">Libro / Capítulo</option>
          </select>
        </label>
      </div>

      <div style="display:flex; align-items:center; gap:8px;">
        <button type="button" onclick="abrirNotaLibre()" title="Nueva nota"
          style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">
          ➕
        </button>

        <button type="button" onclick="toggleFiltroMarcadoresPanel()" title="Filtrar notas/versículos"
          style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">
          🗒
        </button>

        <button type="button" onclick="toggleModoEliminarMarcadores()" title="Eliminar"
          style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">
          🗑
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
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleString() : "";
      const refTxt = m.ref || (m.libro && m.capitulo ? `${m.libro} ${m.capitulo}` : "Nota");
      const checked = !!(seleccionEliminarMarcadores && seleccionEliminarMarcadores[m.id]);

      // ✅ texto de versículos (si aplica)
      let textoVers = "";
      if (m.libro && m.capitulo && (m.versiculos || []).length && Array.isArray(window.bibliaData)) {
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
                <button type="button" onclick="abrirMarcador('${m.id}')" title="Ir"
                  style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">↩</button>

                <button type="button" onclick="editarMarcadorEnPanel('${m.id}')" title="Editar"
                  style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">✏️</button>

                <button type="button" onclick="abrirCompartirMarcador('${m.id}')" title="Compartir"
                  style="border:none; border-radius:999px; padding:8px 10px; cursor:pointer;">📤</button>
              `}
            </div>
          </div>

          ${textoVers ? `<div class="nota" style="margin-top:8px;">${textoVers}</div>` : ""}
          ${m.nota ? `<div class="nota">${m.nota}</div>` : ""}
        </div>
      `;
    }).join("") : `<p style="opacity:.75">Todavía no guardaste marcadores.</p>`}
  `;

  const sel = document.getElementById("ordenMarcadoresSelect");
  if (sel) {
    sel.value = ordenMarcadores;
    sel.onchange = () => {
      ordenMarcadores = sel.value;
      renderPanelMarcadores();
    };
  }
}

// ================= Toggle Filtro Marcadores Panel 📌===================
window.toggleFiltroMarcadoresPanel = () => {
  // ciclo: ambos -> notas -> versiculos -> ambos
  filtroMarcadoresPanel =
    filtroMarcadoresPanel === "ambos" ? "notas" :
    filtroMarcadoresPanel === "notas" ? "versiculos" : "ambos";
  renderPanelMarcadores();
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
window.mostrarSeccion = tipo => {
  ["imagenes", "marcadores"].forEach(s => {
    const el = document.getElementById("panel-" + s);
    if (el) el.style.display = (s === tipo ? "block" : "none");
  });

  if (tipo === "marcadores") renderPanelMarcadores();
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

// ================= 🔺 CAMBIAR TAMAÑO ===========================
window.cambiarTamanoPreview = (delta) => {
  const inp = document.getElementById("personalizarTamaño");
  if (!inp) return;
  const val = Math.max(10, Math.min(100, Number(inp.value || 24) + delta));
  inp.value = val;
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

// ================= ✅ CHECK IGLESIA (SIEMPRE default TRUE + estado visual) =================
function syncCheckIglesiaUI() {
  const chk = document.getElementById("checkIglesia");
  const label = chk?.closest(".subir-iglesia-btn");
  if (!chk || !label) return;

  // ✅ estado visual del botón
  label.classList.toggle("activo", chk.checked);
}

// ================= 🔺 FORCE DEFAULT CHECK IGLESIA ===========================
function forceDefaultCheckIglesia() {
  const chk = document.getElementById("checkIglesia");
  if (!chk) return;

  // ✅ siempre por defecto TRUE
  chk.checked = true;

  // ✅ enganchar cambio para que el visual se actualice
  chk.removeEventListener("change", syncCheckIglesiaUI);
  chk.addEventListener("change", syncCheckIglesiaUI);

  // ✅ aplicar visual
  syncCheckIglesiaUI();
}

document.addEventListener("DOMContentLoaded", forceDefaultCheckIglesia);

// ================= UI: ocultar acciones al entrar en modo marcador =================
function aplicarUIAccionesPorModo() {
  const acciones = document.getElementById("accionesBiblia");
  if (!acciones) return;

  // elementos
  const btnModo = document.getElementById("btnModoMarcadorBarra"); // 📌
  const btnGuardar = document.getElementById("btnGuardarMarcador"); // ✅
  const btnLista = document.getElementById("btnListaMarcadores"); // list
  const btnImagen = document.getElementById("btnImagen"); // panorama

  // todas las acciones normales dentro de la barra
  const normales = acciones.querySelectorAll(".accion-normal, #resaltadorCompacto");

  if (modoMarcador) {
    // ✅ ocultar TODO lo normal
    normales.forEach(el => (el.style.display = "none"));

    // ✅ dejar visible el 📌 para salir y el ✅ para guardar (cuando haya selección)
    if (btnModo) btnModo.style.display = "inline-flex";
    // el ✅ lo maneja refrescarBotonGuardarMarcador()
    if (btnLista) btnLista.style.display = "none";
    if (btnImagen) btnImagen.style.display = "none";
  } else {
    // volver a modo normal
    normales.forEach(el => (el.style.display = ""));
    if (btnModo) btnModo.style.display = "inline-flex";
    if (btnLista) btnLista.style.display = "inline-flex";
    if (btnImagen) btnImagen.style.display = "inline-flex";
  }
}


// ================= 🔺 HACER FUNCIONES GLOBALES (FIX DESCARGAR/COMPARTIR EN PC) =================
window.generarImagenFinal = generarImagenFinal;
window.descargarImagenFinal = descargarImagenFinal;
window.compartirImagenFinal = compartirImagenFinal;

