import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔧 FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 📌 ESTADO
let uid = null;
let marcados = {};
let bibliaData = [];
let size = 18;
let colorActual = "#ffd6e8";

const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");

// 📖 CARGAR BIBLIA
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  });

// 👤 USUARIO
onAuthStateChanged(auth, user => {
  if (!user) return;
  uid = user.uid;

  onValue(ref(db, "marcados/" + uid), snap => {
    marcados = snap.val() || {};
    mostrarTexto();
  });
});

// 🚀 INICIO
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => libroSel.innerHTML += `<option>${l}</option>`);
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

// 📚 CAPÍTULOS
function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value)
      .map(v => v.Capitulo)
  )];
  caps.forEach(c => capSel.innerHTML += `<option>${c}</option>`);
  mostrarTexto();
}

// 📖 TEXTO NORMAL
function mostrarTexto() {
  texto.innerHTML = "";
  const versos = bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => pintarVersiculo(v));
}

// ⭐ SOLO MIS VERSÍCULOS
window.mostrarMisVersiculos = () => {
  texto.innerHTML = "<h3>⭐ Mis versículos</h3>";

  Object.keys(marcados).forEach(id => {
    const [Libro, Capitulo, Versiculo] = id.split("_");
    const v = bibliaData.find(x =>
      x.Libro === Libro &&
      x.Capitulo == Capitulo &&
      x.Versiculo == Versiculo
    );
    if (v) pintarVersiculo(v, true);
  });
};

// ↩️ VOLVER
window.volverBiblia = () => mostrarTexto();

// 🎨 DIBUJAR
function pintarVersiculo(v, solo = false) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const fondo = marcado ? marcado.color : "transparent";
  const clase = marcado ? "versiculo resaltado" : "versiculo";

  texto.innerHTML += `
    <div class="${clase}"
         style="font-size:${size}px; background:${fondo}"
         onclick="${solo ? `irAVersiculo('${v.Libro}',${v.Capitulo})` : `toggle('${id}')`}">
      <span class="num">${marcado ? "⭐" : ""}${v.Versiculo}</span>
      <b>${v.Libro} ${v.Capitulo}</b><br>
      ${v.RV1960}
    </div>`;
}

// 🔁 IR AL TEXTO
window.irAVersiculo = (libro, cap) => {
  libroSel.value = libro;
  cargarCapitulos();
  capSel.value = cap;
  mostrarTexto();
};

// ⭐ MARCAR
window.toggle = (id) => {
  if (!uid) return;
  const r = ref(db, "marcados/" + uid + "/" + id);
  marcados[id] ? remove(r) : set(r, { color: colorActual });
};

// 🎨 COLOR
window.setColor = c => colorActual = c;

// 🔍 LETRA
window.cambiarLetra = n => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};

// 🌙 TOGGLE TEMA (LOCAL, SIN FIREBASE)
window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};
