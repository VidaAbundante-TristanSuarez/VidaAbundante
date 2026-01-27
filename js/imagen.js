// ================= IMPORTS =================
import { state } from "./estado.js";
import { mostrarTexto } from "./biblia.js";
import { subirImagenFirebase } from "./firebase.js";

// ================= ELEMENTOS DEL DOM =================
const modal = document.getElementById("modalPersonalizar");
const preview = document.getElementById("previewImagen");

// Texto frontal (visible)
const textoFront = document.getElementById("previewTexto");
// Texto de fondo (borde / sombra)
const textoBack = document.getElementById("previewTextoBack");
// Contenedor que limita el texto
const wrapper = document.getElementById("previewTextoWrapper");

// Controles
const inputSize = document.getElementById("personalizarTamaño");
const inputColor = document.getElementById("personalizarColor");
const inputOpacidad = document.getElementById("personalizarOpacidad");
const selectFuente = document.getElementById("personalizarFuente");

const contFondos = document.getElementById("personalizarFondos");
const canvasFinal = document.getElementById("canvasFinal");

// ================= OBTENER TEXTO SELECCIONADO =================
// Junta los versículos marcados y arma el texto + referencia
function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(state.seleccionImagen);
  if (!ids.length) return "";

  let textos = [];
  let numeros = [];
  let libro = "";
  let cap = "";

  ids.forEach(id => {
    const [l, c, v] = id.split("_");
    const vers = state.bibliaData.find(x =>
      x.Libro === l && x.Capitulo == c && x.Versiculo == v
    );

    if (vers) {
      libro = l;
      cap = c;
      textos.push(vers.RV1960 || vers.Texto || "");
      numeros.push(Number(v));
    }
  });

  // Ordenar versículos
  numeros.sort((a, b) => a - b);

  // Compactar rangos (ej: 1-3,5)
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

  const referencia = `${libro} ${cap}:${partes.join(",")}`;

  return textos.join("\n") + "\n\n▪ " + referencia;
}

// ================= MODO IMAGEN =================
window.toggleModoImagen = () => {
  if (!state.uid) {
    loginModal.style.display = "flex";
    return;
  }

  state.modoImagen = !state.modoImagen;
  state.seleccionImagen = {};

  document.body.classList.toggle("modo-imagen", state.modoImagen);

  const banner = document.getElementById("bannerModoImagen");
  if (banner) banner.style.display = state.modoImagen ? "block" : "none";

  mostrarTexto();
};

// ================= ABRIR MODAL =================
window.generarImagen = () => {
  if (!state.uid) {
    loginModal.style.display = "flex";
    return;
  }

  if (!Object.keys(state.seleccionImagen).length) {
    alert("Seleccioná al menos un versículo");
    return;
  }

  modal.style.display = "flex";
  cargarFondos();
  actualizarPreview();
};

// ================= PREVIEW EN TIEMPO REAL =================
function actualizarPreview() {
  const contenido = obtenerVersiculoSeleccionado();
  if (!contenido) return;

  textoFront.innerText = contenido;
  textoBack.innerText = contenido;

  // Tamaño
  let fontSize = parseInt(inputSize.value);
  textoFront.style.fontSize = fontSize + "px";
  textoBack.style.fontSize = fontSize + "px";

  // Color
  textoFront.style.color = inputColor.value;
  textoBack.style.color = colorOutlineDesdeBase(inputColor.value);

  // Fuente
  textoFront.style.fontFamily = selectFuente.value;
  textoBack.style.fontFamily = selectFuente.value;

  // Fondo con opacidad
  preview.style.backgroundColor = `rgba(0,0,0,${inputOpacidad.value})`;

  // Estilos de texto
  textoFront.style.fontWeight = state.textStyle.bold ? "700" : "400";
  textoFront.style.fontStyle = state.textStyle.italic ? "italic" : "normal";
  textoFront.style.textDecoration = state.textStyle.underline ? "underline" : "none";
  textoFront.style.textTransform = state.textStyle.upper ? "uppercase" : "none";

  // Copiar estilos al texto de fondo
  textoBack.style.cssText = textoFront.style.cssText;

  // Fondo imagen
  if (state.fondoFinal) {
    preview.style.backgroundImage = `url(${state.fondoFinal})`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
  } else {
    preview.style.backgroundImage = "none";
  }

  // Autoajuste para que no se salga del cuadro
  while (fontSize > 14) {
    if (textoFront.scrollHeight <= wrapper.clientHeight - 40) break;
    fontSize--;
    textoFront.style.fontSize = fontSize + "px";
    textoBack.style.fontSize = fontSize + "px";
  }
}

// ================= FONDOS =================
const fondos = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
];

function cargarFondos() {
  contFondos.innerHTML = "";
  fondos.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.onclick = () => {
      state.fondoFinal = url;
      actualizarPreview();
    };
    contFondos.appendChild(img);
  });
}

// ================= COLOR DE BORDE AUTOMÁTICO =================
function colorOutlineDesdeBase(color) {
  let r = parseInt(color.slice(1,3),16)/255;
  let g = parseInt(color.slice(3,5),16)/255;
  let b = parseInt(color.slice(5,7),16)/255;

  const l = (Math.max(r,g,b) + Math.min(r,g,b)) / 2;
  return l > 0.65 ? "#111" : "#fff";
}

// ================= LISTENERS =================
[inputSize, inputColor, inputOpacidad].forEach(el =>
  el.addEventListener("input", actualizarPreview)
);

selectFuente.addEventListener("change", actualizarPreview);

// ================= CERRAR MODAL =================
window.cancelarCrearImagen = () => {
  modal.style.display = "none";
  state.fondoFinal = null;
};
