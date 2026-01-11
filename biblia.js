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
const contenedorFondos = document.getElementById("personalizarFondos");

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

// ================= NAVEGACIÓN =================
window.irA = (seccion) => {
  const secciones = ["biblia", "devocionales", "abc", "iglesia", "panel"];
  secciones.forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if(el) el.style.display = (s === seccion) ? "block" : "none";
  });

  // Salimos del modo imagen si estaba activo
  modoImagen = false;
  seleccionImagen = {};
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ================= CAPÍTULOS ANTERIOR / SIGUIENTE =================
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

// ================= PINTAR VERSÍCULO =================
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

// ================= TOGGLE VERSÍCULO =================
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

// ================= DETECTAR GRUPO DE VERSÍCULOS =================
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

// ================= GENERAR IMAGEN =================
let formatoImagen = null;
let plantillaSeleccionada = null;

window.generarImagen = () => {
  if (!modoImagen) return;

  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) {
    alert("Seleccioná al menos un versículo para continuar");
    return;
  }

  document.getElementById("modalFormato").style.display = "flex";
};

window.elegirFormato = formato => {
  if (!Object.keys(seleccionImagen).length) {
    alert("Seleccioná al menos un versículo antes de continuar");
    return;
  }

  formatoImagen = formato;
  document.getElementById("modalFormato").style.display = "none";
  document.getElementById("modalPlantilla").style.display = "flex";
};

window.elegirPlantilla = plantilla => {
  plantillaSeleccionada = plantilla;
  document.getElementById("modalPlantilla").style.display = "none";

  if (plantilla === "personalizar") {
    document.getElementById("modalPersonalizar").style.display = "flex";
    return;
  }

  generarImagenFinal();
};

window.generarImagenFinal = () => {
  alert(`✅ Imagen generada!\nFormato: ${formatoImagen}\nPlantilla: ${plantillaSeleccionada}`);

  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ================= CANCELAR CREACIÓN =================
window.cancelarCrearImagen = () => {
  document.getElementById("modalFormato").style.display = "none";
  document.getElementById("modalPlantilla").style.display = "none";
  document.getElementById("modalPersonalizar").style.display = "none";

  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;

  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ================= FONDOS CLOUDINARY =================
const fondosCloudinary = [
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_kpgvmm",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_kupglf",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_a1wlsh",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_hnxuau",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_brmypi",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_xubjvd",
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_9_b3tkxx"
];

fondosCloudinary.forEach(url => {
  const img = document.createElement("img");
  img.src = url;
  img.style.width = "60px";
  img.style.height = "60px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "8px";
  img.style.cursor = "pointer";

  img.onclick = () => {
    contenedorFondos.querySelectorAll("img").forEach(i => {
      i.style.outline = "";
      i.removeAttribute("data-seleccionado");
    });
    img.style.outline = "3px solid #4f6fa8";
    img.dataset.seleccionado = "true";
  };

  contenedorFondos.appendChild(img);
});

// ================= BOTONES MODAL PERSONALIZAR =================
document.getElementById("btnGenerarPersonalizada").onclick = () => {
  const fuente = document.getElementById("personalizarFuente").value;
  const tamaño = document.getElementById("personalizarTamaño").value;
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const upper = document.getElementById("personalizarUpper").checked;

  const imgSeleccionada = document.querySelector("#personalizarFondos img[data-seleccionado='true']");
  if (!imgSeleccionada) {
    alert("⚠️ Seleccioná un fondo para continuar");
    return;
  }
  const fondoFinal = imgSeleccionada.src;

  document.getElementById("modalPersonalizar").style.display = "none";

  alert(
    `✅ Imagen personalizada generada!\n` +
    `Formato: ${formatoImagen}\n` +
    `Fondo: ${fondoFinal} (opacidad ${opacidad})\n` +
    `Fuente: ${fuente}\n` +
    `Tamaño: ${tamaño}\n` +
    `Color: ${color}\n` +
    `Mayúsculas: ${upper ? "Sí" : "No"}`
  );

  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

document.getElementById("btnCancelarPersonalizada").onclick = () => {
  document.getElementById("modalPersonalizar").style.display = "none";

  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");

  contenedorFondos.querySelectorAll("img").forEach(i => {
    i.style.outline = "";
    i.removeAttribute("data-seleccionado");
  });

  mostrarTexto();
};
