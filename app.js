// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue
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
let marcador = null;

let modoImagen = false;
let seleccionImagen = {};
let fondoFinal = null;
let formatoImagen = null;
let plantillaSeleccionada = null;

// ================= LOGOUT =================
window.logout = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

// ================= NAVEGACIÓN =================
window.irA = seccion => {
  document.querySelectorAll(".seccion").forEach(s => s.style.display = "none");
  const el = document.getElementById("seccion-" + seccion);
  if (el) el.style.display = "block";

  modoImagen = false;
  seleccionImagen = {};
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen")?.classList.remove("activo");
  mostrarTexto();
};

// ================= DOM =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ================= CARGAR BIBLIA =================
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  })
  .catch(e => console.error("Error Biblia:", e));

// ================= AUTH =================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (uid) {
    onValue(ref(db, "marcados/" + uid), s => {
      marcados = s.val() || {};
      mostrarTexto();
    });

    onValue(ref(db, "notas/" + uid), s => {
      notas = s.val() || {};
    });
  }
});

// ================= INICIO =================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = libros.map(l => `<option>${l}</option>`).join("");
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

function cargarCapitulos() {
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  capSel.innerHTML = caps.map(c => `<option>${c}</option>`).join("");
  mostrarTexto();
}

// ================= TEXTO =================
function mostrarTexto() {
  texto.innerHTML = "";
  notaBox.style.display = "none";
  grupoActual = null;

  titulo.innerText = `${libroSel.value} ${capSel.value}`;

  bibliaData
    .filter(v => v.Libro === libroSel.value && v.Capitulo == capSel.value)
    .forEach(v => pintarVersiculo(v));
}

function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const img = modoImagen && seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo" + (img ? " imagen" : "");
  div.dataset.marcado = !!marcado;
  div.style.fontSize = size + "px";
  div.style.background = img ? "" : marcado?.color || "transparent";
  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${v.RV1960}`;

  div.onclick = () => toggleVersiculo(id, v.Versiculo);
  texto.appendChild(div);
}

function toggleVersiculo(id, num) {
  if (modoImagen) {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }
    seleccionImagen[id] ? delete seleccionImagen[id] : seleccionImagen[id] = true;
    mostrarTexto();
    return;
  }

  if (!uid) return;
  const r = ref(db, "marcados/" + uid + "/" + id);
  marcados[id] ? remove(r) : set(r, { color: colorActual });
  detectarGrupo(num);
}

function detectarGrupo(num) {
  const nums = Object.keys(marcados).map(k => +k.split("_")[2]);
  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = notas[grupoActual] || "";
}

// ================= NOTAS =================
window.guardarNota = () => {
  if (!grupoActual || !uid) return;
  set(ref(db, "notas/" + uid + "/" + grupoActual), notaTexto.value);
};

// ================= AJUSTES =================
window.setColor = (c, btn) => {
  colorActual = c;
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("activo"));
  btn?.classList.add("activo");
};

window.cambiarLetra = n => {
  size = Math.min(40, Math.max(18, size + n));
  mostrarTexto();
};

// ================= MODO IMAGEN =================
window.toggleModoImagen = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }
  modoImagen = !modoImagen;
  seleccionImagen = {};
  document.body.classList.toggle("modo-imagen", modoImagen);
  document.getElementById("btnImagen").classList.toggle("activo", modoImagen);
  mostrarTexto();
};

window.generarImagen = () => {
  if (!Object.keys(seleccionImagen).length) {
    alert("Seleccioná versículos");
    return;
  }
  document.getElementById("modalFormato").style.display = "flex";
};

// ================= FUNCIONES SEGURAS =================
window.mostrarSeccion = () => {};
window.irALogin = () => window.location.href = "login.html";
window.cerrarLogin = () => loginModal.style.display = "none";
window.mostrarImagenesEnPanel = () => {};
