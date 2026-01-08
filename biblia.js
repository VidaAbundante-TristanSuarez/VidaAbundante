import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔧 FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 📌 ESTADO
let uid = null;
let marcados = {};
let bibliaData = [];
let size = 18;
let colorActual = "#ffd6e8"; // 🌸 rosado por defecto

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
    bibliaData
      .filter(v => v.Libro === libroSel.value)
      .map(v => v.Capitulo)
  )];

  caps.forEach(c => capSel.innerHTML += `<option>${c}</option>`);

  mostrarTexto();
}

// ✨ MOSTRAR TEXTO
function mostrarTexto() {
  texto.innerHTML = "";

  const versos = bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => {
    const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
    const marcado = marcados[id];
    const fondo = marcado ? marcado.color : "transparent";

    texto.innerHTML += `
      <div class="versiculo"
           style="font-size:${size}px; background:${fondo}"
           onclick="toggle('${id}')">
        <span class="num">${marcado ? "⭐" : ""}${v.Versiculo}</span>
        ${v.RV1960}
      </div>`;
  });
}

// ⭐ MARCAR / DESMARCAR
window.toggle = (id) => {
  if (!uid) return;

  const r = ref(db, "marcados/" + uid + "/" + id);

  if (marcados[id]) {
    remove(r);
  } else {
    set(r, { color: colorActual });
  }
};

// 🎨 CAMBIAR COLOR
window.setColor = (c) => {
  colorActual = c;
};

// 🔍 TAMAÑO LETRA
window.cambiarLetra = (n) => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};
