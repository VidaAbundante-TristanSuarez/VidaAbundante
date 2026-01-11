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

// ================= NAVEGACIÓN =================
function irA(seccion) {
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
}

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
  // Cerramos todos los modales relacionados
  document.getElementById("modalFormato").style.display = "none";
  document.getElementById("modalPlantilla").style.display = "none";
  document.getElementById("modalPersonalizar").style.display = "none";

  // Salimos del modo imagen
  modoImagen = false;
  seleccionImagen = {};

  document.body.classList.remove("modo-imagen");
  const btnImg = document.getElementById("btnImagen");
  if(btnImg) btnImg.classList.remove("activo");

  // Volvemos a mostrar el texto normal
  mostrarTexto();
};

// ---------------- Fondos de Cloudinary ----------------
const fondosCloudinary = [
  "https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_kpgvmm",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_kupglf",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_a1wlsh",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_hnxuau",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_brmypi",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_xubjvd",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_9_b3tkxx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_jhrx0j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_8_ivok7j",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_12_crdynt",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_15_iu1uxj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_14_iww2jx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_13_dzxm4k",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_11_z3nudj",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_10_scjlfu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_cg9dfu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_hi9hhz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_cg9dfu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_q3uzog",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_wzlhio",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_tjsq2f",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_cf7yzv",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_rplu10",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_ftamyb",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_yxah7e",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_wychbo",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/jardinflorescielorosas_qctpa1",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/nubepasto_w0pg1i",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/lagunapastofloresrosas_gibn7c",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/flores_riug8f",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/flores_riug8f",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/cielorosa_pc0puk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_twzefr",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_zw4kl2",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_ghg8ux",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_jwctxg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_c2feyb",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_htsxrq",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_jfb0m1",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_qpfbuy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_z6ol0o",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_ycpnpv",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_ehfqna",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/doble_n6nexy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/doble2_zyqinh",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_p3bdgg",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/piedras_no3cnu",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_tzcjhe",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_bzbuyy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_hzwmnn",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_9_uoqpfk",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_10_dzbofe",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_8_xzqnli",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_gunjzi",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_kwzbbn",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_ghlggy",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_uxzbsn",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_2_wza5pr",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_tgzcpn",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_xyutfs",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_1_arstzx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_3_thrkka",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_4_yp8i7h",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_6_lbylzl",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_7_f9qxrz",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/Untitled_Project_5_uh3dsx",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/cielovioleta_us3ilw",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/amanecerpiedras_zb18j1",
"https://res.cloudinary.com/dlkpityif/image/upload/v1757268584/amanecer1600x1600_igddhh",

];

const contenedorFondos = document.getElementById("personalizarFondos");

// Crear miniaturas clickeables
fondosCloudinary.forEach(url => {
  const img = document.createElement("img");
  img.src = url;
  img.style.width = "60px";
  img.style.height = "60px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "8px";
  img.style.cursor = "pointer";
  img.onclick = () => {
    // Deselecciona todas
    contenedorFondos.querySelectorAll("img").forEach(i => i.style.outline = "");
    // Marca seleccionada
    img.style.outline = "3px solid #4f6fa8";
    img.dataset.seleccionado = "true";
  };
  contenedorFondos.appendChild(img);
});

// ---------------- Botón Generar ----------------
document.getElementById("btnGenerarPersonalizada").onclick = () => {
  const fondoColor = document.getElementById("personalizarFondo").value;
  const fuente = document.getElementById("personalizarFuente").value;
  const tamaño = document.getElementById("personalizarTamaño").value;
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const upper = document.getElementById("personalizarUpper").checked;

  // Chequea si hay imagen seleccionada
  const imgSeleccionada = document.querySelector("#personalizarFondos img[data-seleccionado='true']");
  let fondoFinal = fondoColor;
  if(imgSeleccionada) fondoFinal = imgSeleccionada.src;

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

  // Resetea todo
  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ---------------- Botón Cancelar ----------------
document.getElementById("btnCancelarPersonalizada").onclick = () => {
  document.getElementById("modalPersonalizar").style.display = "none";
  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};



