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
let bibliaData = [];
let marcados = {};
let notas = {};
let size = 18;
let colorActual = "#ffd6e8";

const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");

let grupoActual = null;

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

  onValue(ref(db, "marcados/" + uid), s => {
    marcados = s.val() || {};
    mostrarTexto();
  });

  onValue(ref(db, "notas/" + uid), s => {
    notas = s.val() || {};
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

// 📖 MOSTRAR TEXTO
function mostrarTexto() {
  texto.innerHTML = "";
  notaBox.style.display = "none";
  grupoActual = null;

  titulo.innerText = `${libroSel.value} ${capSel.value}`;

  const versos = bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => {
    const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
    const marcado = marcados[id];
    texto.innerHTML += `
      <div class="versiculo ${marcado ? "resaltado" : ""}"
        style="font-size:${size}px; background:${marcado?.color || "transparent"}"
        onclick="toggle('${id}', ${v.Versiculo})">
        <span class="num">${v.Versiculo}</span>
        ${v.RV1960}
      </div>`;
  });
}

// ⭐ MARCAR
window.toggle = (id, num) => {
  if (!uid) return;
  const r = ref(db, "marcados/" + uid + "/" + id);

  if (marcados[id]) {
    remove(r);
  } else {
    set(r, { color: colorActual });
  }

  detectarGrupo(num);
};

// 🔗 DETECTAR GRUPO
function detectarGrupo(num) {
  const nums = Object.keys(marcados)
    .map(k => Number(k.split("_")[2]))
    .sort((a,b)=>a-b);

  let grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = notas[grupoActual] || "";
}

// 💾 GUARDAR NOTA
window.guardarNota = () => {
  if (!grupoActual || !uid) return;
  set(ref(db, "notas/" + uid + "/" + grupoActual), notaTexto.value);
  alert("Nota guardada ✨");
};

// 🎨 COLOR
window.setColor = c => colorActual = c;

// 🔍 LETRA
window.cambiarLetra = n => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};

// 🌙 TEMA
window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};
