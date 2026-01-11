// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// ================= ESTADO =================
let uid = null;
let bibliaData = [];
let marcados = {};
let notas = {};
let size = 18;
let colorActual = "#ffd6e8";
let grupoActual = null;

let seccionActiva = "biblia";

let modoImagen = false;
let seleccionImagen = {};

// ================= DOM =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");

// ================= CARGAR BIBLIA =================
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  });

// ================= AUTH =================
onAuthStateChanged(auth, user => {
  if (!user) return;

  uid = user.uid;

  onValue(ref(db, "marcados/" + uid), s => {
    marcados = s.val() || {};
    mostrarTexto();
  });

  onValue(ref(db, "notas/" + uid), s => {
    notas = s.val() || {};
  });
});

// ================= INICIO =================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => libroSel.innerHTML += `<option>${l}</option>`);
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

// ================= CAPÍTULOS =================
function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value)
      .map(v => v.Capitulo)
  )];
  caps.forEach(c => capSel.innerHTML += `<option>${c}</option>`);
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

// ================= VERSÍCULO =================
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;

  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  let clases = "versiculo";
  if (imagen) clases += " imagen";

  texto.innerHTML += `
    <div class="${clases}"
      data-marcado="${!!marcado}"
      style="font-size:${size}px; background:${imagen ? '' : marcado?.color || 'transparent'}"
      onclick="toggle('${id}', ${v.Versiculo})">
      <span class="num">${v.Versiculo}</span>
      ${v.RV1960}
    </div>
  `;
}

// ================= MARCAR =================
window.toggle = (id, num) => {

  // 🖼️ MODO IMAGEN
  if (modoImagen) {
    seleccionImagen[id]
      ? delete seleccionImagen[id]
      : seleccionImagen[id] = true;
    mostrarTexto();
    return;
  }

  // ✍️ MODO NORMAL
  if (!uid) return;

  const r = ref(db, "marcados/" + uid + "/" + id);
  marcados[id] ? remove(r) : set(r, { color: colorActual });
  detectarGrupo(num);
};

// ================= GRUPO PARA NOTAS =================
function detectarGrupo(num) {
  const nums = Object.keys(marcados)
    .map(k => Number(k.split("_")[2]))
    .sort((a,b)=>a-b);

  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = notas[grupoActual] || "";
}

// ================= GUARDAR NOTA =================
window.guardarNota = () => {
  if (!grupoActual || !uid) return;
  set(ref(db, "notas/" + uid + "/" + grupoActual), notaTexto.value);
  alert("Nota guardada ✨");
};

// ================= AJUSTES =================
window.setColor = (c, btn) => {
  colorActual = c;

  document.querySelectorAll(".color-btn")
    .forEach(b => b.classList.remove("activo"));

  if (btn) btn.classList.add("activo");
};

window.cambiarLetra = n => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};

window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};

// ================= MODO IMAGEN =================
window.toggleModoImagen = () => {
  modoImagen = !modoImagen;
  seleccionImagen = {};

  const body = document.body;
  const btnImg = document.getElementById("btnImagen");

  if (modoImagen) {
    body.classList.add("modo-imagen");
    btnImg.classList.add("activo");
  } else {
    body.classList.remove("modo-imagen");
    btnImg.classList.remove("activo");
  }

  mostrarTexto();
};

// ================= GENERAR IMAGEN =================
window.generarImagen = () => {

  if (!modoImagen) {
    alert("Primero activá 'Habilitar Crear Imagen'");
    return;
  }

  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) {
    alert("Seleccioná al menos un versículo");
    return;
  }

  alert("✅ Lógica de generación OK (siguiente paso)");
};


