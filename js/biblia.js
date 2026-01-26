import { state } from "./estado.js";
import { marcarVersiculo, desmarcarVersiculo } from "./firebase.js";

// ================= CARGA BIBLIA ==============================

fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    state.bibliaData = data;
    iniciarBiblia();
  });

// ================= INICIO =================

function iniciarBiblia() {
  // valores iniciales
  if (!state.libroActual) {
    state.libroActual = state.bibliaData[0].Libro;
    state.capituloActual = state.bibliaData[0].Capitulo;
  }
}

// ================= TEXTO =================

export function mostrarTexto() {
  const contenedor = document.getElementById("texto");
  const titulo = document.getElementById("titulo");
  const notaBox = document.getElementById("notaBox");
  const notaTexto = document.getElementById("notaTexto");

  contenedor.innerHTML = "";
  notaBox.style.display = "none";
  state.grupoActual = null;

  titulo.innerText = `${state.libroActual} ${state.capituloActual}`;

  const versos = state.bibliaData.filter(v =>
    v.Libro === state.libroActual &&
    v.Capitulo == state.capituloActual
  );

  versos.forEach(v => pintarVersiculo(v, contenedor));
}

// ================= TOGGLE VERSICULO =======================

function toggleVersiculo(id, num) {

  // 🖼️ MODO IMAGEN
  if (state.modoImagen) {
    if (!state.uid) return;

    state.seleccionImagen[id]
      ? delete state.seleccionImagen[id]
      : state.seleccionImagen[id] = true;

    mostrarTexto();
    if (window.actualizarPreview) window.actualizarPreview();
    return;
  }

  // 🔐 requiere login
  if (!state.uid) return;

  // 🔒 resaltador bloqueado
  if (state.resaltadorBloqueado) return;

  // 🎨 marcar / desmarcar
  if (state.marcados[id]) {
    desmarcarVersiculo(state.uid, id);
  } else {
    marcarVersiculo(state.uid, id, state.colorActual);
  }

  detectarGrupo(num);
}

// ======================= PINTAR VERSICULO =============================

function pintarVersiculo(v, contenedor) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = state.marcados[id];
  const imagen = state.modoImagen && state.seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo";
  if (imagen) div.classList.add("imagen");

  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  div.style.fontSize = state.size + "px";

  if (state.modoImagen) {
    div.style.background = imagen
      ? "rgba(255,214,232,0.6)"
      : "transparent";
    div.style.color = imagen ? "#fff" : "";
  } else if (marcado) {
    div.style.background = marcado.color;
  }

  let textoVerso = v.RV1960 || v.Texto || "";
  if (state.textStyle.upper) textoVerso = textoVerso.toUpperCase();

  div.style.fontWeight = state.textStyle.bold ? "bold" : "normal";
  div.style.fontStyle = state.textStyle.italic ? "italic" : "normal";
  div.style.textDecoration = state.textStyle.underline ? "underline" : "none";

  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${textoVerso}`;
  contenedor.appendChild(div);
}

// ================= DETECTA GRUPO =======================

function detectarGrupo(num) {
  const notaBox = document.getElementById("notaBox");
  const notaTexto = document.getElementById("notaTexto");

  const nums = Object.keys(state.marcados)
    .filter(k => {
      const [lib, cap] = k.split("_");
      return lib === state.libroActual && cap == state.capituloActual;
    })
    .map(k => Number(k.split("_")[2]))
    .sort((a, b) => a - b);

  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  state.grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = state.notas[state.grupoActual] || "";
}

