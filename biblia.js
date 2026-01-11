// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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
  });

// ================= AUTH =================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (!uid) return;

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

window.capituloAnterior = () => {
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    seleccionImagen = {};
    mostrarTexto();
  }
};

window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
    seleccionImagen = {};
    mostrarTexto();
  }
};

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

  const div = document.createElement("div");
  div.className = "versiculo" + (imagen ? " imagen" : "");
  div.dataset.marcado = !!marcado;
  div.style.fontSize = size + "px";
  div.style.background = imagen ? "" : marcado?.color || "transparent";

  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${v.RV1960}`;
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  texto.appendChild(div);
}

// ================= TOGGLE =================
function toggleVersiculo(id, num) {

  // 🖼️ MODO IMAGEN
  if (modoImagen) {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }
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
}

// ================= NOTAS AUTOMÁTICAS =================
function detectarGrupo(num) {
  const nums = Object.keys(marcados)
    .map(k => Number(k.split("_")[2]))
    .sort((a, b) => a - b);

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
  alert("📝 Nota guardada");
};

// ================= AJUSTES =================
window.setColor = (c, btn) => {
  colorActual = c;
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("activo"));
  btn?.classList.add("activo");
};

window.cambiarLetra = n => {
  size += n;
  mostrarTexto();
};

window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};

// ================= MODO IMAGEN =================
window.toggleModoImagen = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  modoImagen = !modoImagen;
  seleccionImagen = {};

  const body = document.body;
  const btnImg = document.getElementById("btnImagen");

  body.classList.toggle("modo-imagen", modoImagen);
  btnImg.classList.toggle("activo", modoImagen);

  mostrarTexto();
};

// ================= GENERAR IMAGEN REAL =================
window.generarImagen = () => {
  if (!modoImagen) return;

  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) {
    alert("Seleccioná al menos un versículo para continuar");
    return;
  }

  // Mostrar modal de formato
  document.getElementById("modalFormato").style.display = "flex";
};

let formatoImagen = null;
let plantillaSeleccionada = null;

// ================= ELEGIR FORMATO =================
window.elegirFormato = formato => {
  if (!Object.keys(seleccionImagen).length) {
    alert("Seleccioná al menos un versículo antes de continuar");
    return;
  }

  formatoImagen = formato;
  document.getElementById("modalFormato").style.display = "none";

  // Abrimos modal de plantillas
  document.getElementById("modalPlantilla").style.display = "flex";
};

// ================= ELEGIR PLANTILLA =================
window.elegirPlantilla = plantilla => {
  plantillaSeleccionada = plantilla;
  document.getElementById("modalPlantilla").style.display = "none";

  if (plantilla === "personalizar") {
    // Abrimos modal de personalización
    document.getElementById("modalPersonalizar").style.display = "flex";
    return;
  }

  // Generar imagen automáticamente con la plantilla elegida
  generarImagenFinal();
};

// ================= GENERAR IMAGEN PERSONALIZADA =================
window.generarImagenPersonalizada = () => {
  const fondo = document.getElementById("personalizarFondo").value;
  const fuente = document.getElementById("personalizarFuente").value;
  const tamaño = document.getElementById("personalizarTamaño").value;
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const upper = document.getElementById("personalizarUpper").checked;

  document.getElementById("modalPersonalizar").style.display = "none";

  alert(
    `✅ Imagen personalizada generada!\n` +
    `Formato: ${formatoImagen}\n` +
    `Fondo: ${fondo} (opacidad ${opacidad})\n` +
    `Fuente: ${fuente}\n` +
    `Tamaño: ${tamaño}\n` +
    `Color: ${color}\n` +
    `Mayúsculas: ${upper ? "Sí" : "No"}`
  );

  // Reseteamos todo
  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ================= FUNCIONES INTERNAS =================
function generarImagenFinal() {
  alert(`✅ Imagen generada!\nFormato: ${formatoImagen}\nPlantilla: ${plantillaSeleccionada}`);

  // Reseteamos todo
  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
}

// ================= CANCELAR CREACIÓN DE IMAGEN =================
window.cancelarCrearImagen = () => {
  document.getElementById("modalFormato").style.display = "none";

  // Salimos del modo imagen
  modoImagen = false;
  seleccionImagen = {};

  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};
