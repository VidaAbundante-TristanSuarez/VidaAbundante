// ================= BIBLIA =================

import {
  bibliaData,
  marcados,
  size,
  colorActual,
  modoImagen,
  seleccionImagen,
  grupoActual
} from "./estado.js";

import { db } from "./firebase.js";
import { ref, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= DOM =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ================= CARGA BIBLIA =================
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData.length = 0;
    data.forEach(v => bibliaData.push(v));
    iniciar();
  });

// ================= INICIO =================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
}

// ================= MOSTRAR TEXTO =================
function mostrarTexto() {
  texto.innerHTML = "";
  notaBox.style.display = "none";
  grupoActual = null;

  titulo.innerText = `${libroSel.value} ${capSel.value}`;

  const versos = bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => pintarVersiculo(v));
}

window.mostrarTexto = mostrarTexto;

// ================= PINTAR VERSÍCULO =================
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo";
  if (imagen) div.classList.add("imagen");

  div.style.fontSize = size + "px";

  if (modoImagen) {
    div.style.background = imagen
      ? "rgba(255, 214, 232, 0.6)"
      : "transparent";
  } else {
    div.style.background = marcado?.color || "transparent";
  }

  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${v.RV1960}`;
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  texto.appendChild(div);
}

// ================= TOGGLE =================
function toggleVersiculo(id, num) {
  if (modoImagen) {
    if (!window.uid) {
      if (loginModal) loginModal.style.display = "flex";
      return;
    }
    if (seleccionImagen[id]) delete seleccionImagen[id];
    else seleccionImagen[id] = true;
    mostrarTexto();
    return;
  }

  if (!window.uid) return;

  const r = ref(db, "marcados/" + window.uid + "/" + id);

  if (marcados[id]) remove(r);
  else set(r, { color: colorActual });

  detectarGrupo(num);
}

// ================= GRUPOS =================
function detectarGrupo(num) {
  const nums = Object.keys(marcados)
    .filter(k => {
      const [lib, cap] = k.split("_");
      return lib === libroSel.value && cap == capSel.value;
    })
    .map(k => Number(k.split("_")[2]))
    .sort((a, b) => a - b);

  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = window.notas?.[grupoActual] || "";
}
