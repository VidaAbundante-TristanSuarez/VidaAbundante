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

import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

window.logout = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

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

// ================= ESTILO DE TEXTO =================
let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

function toggleUpper() {
  textStyle.upper = !textStyle.upper;
  actualizarPreview();
}
function toggleBold() {
  textStyle.bold = !textStyle.bold;
  actualizarPreview();
}
function toggleItalic() {
  textStyle.italic = !textStyle.italic;
  actualizarPreview();
}
function toggleUnderline() {
  textStyle.underline = !textStyle.underline;
  actualizarPreview();
}

// ================= Cuadrado o Historia =================
window.setFormatoImagen = tipo => {
  const preview = document.getElementById("previewImagen");

  preview.classList.remove("preview-post", "preview-story");

  if (tipo === "post") {
    preview.classList.add("preview-post");
  }

  if (tipo === "story") {
    preview.classList.add("preview-story");
  }

  actualizarPreview();
};

// ================= NAVEGACIÓN =================
window.irA = seccion => {
  const secciones = ["biblia", "devocionales", "abc", "iglesia", "panel"];
  secciones.forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = (s === seccion) ? "block" : "none";
  });

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
  });

// ================= AUTH =================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (uid) {
    // Cargar marcados y notas solo si hay usuario
    onValue(ref(db, "marcados/" + uid), s => {
      marcados = s.val() || {};
      mostrarTexto();
    });

    onValue(ref(db, "notas/" + uid), s => {
      notas = s.val() || {};
    });
  }

  // Mostrar u ocultar el panel de usuario
  document.getElementById("panelUsuario").style.display = uid ? "block" : "none";
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

function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) return "";

  let textos = [];
  let referencia = "";

  ids.forEach(id => {
    const [libro, capitulo, versiculo] = id.split("_");

    const v = bibliaData.find(x =>
      x.Libro === libro &&
      x.Capitulo === parseInt(capitulo) &&
      x.Versiculo === parseInt(versiculo)
    );

    if (v) {
      textos.push(v.RV1960);
      referencia = `${libro} ${capitulo}:${versiculo}`;
    }
  });

  return textos.join(" ") + "\n\n— " + referencia;
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
    actualizarPreview();
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

window.cambiarLetra = delta => {
  let size = parseInt(getComputedStyle(document.body).fontSize);
  size = Math.max(14, size + delta * 2); // nunca menos de 14
  document.body.style.fontSize = size + "px";
};

window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};

// ================= MARCADOR =================
window.guardarMarcador = () => {
  marcador = {
    libro: libroSel.value,
    capitulo: capSel.value
  };

  alert(`📌 Marcador guardado:\n${marcador.libro} ${marcador.capitulo}`);
};

window.irAMarcador = () => {
  if (!marcador) {
    alert("No hay marcador guardado");
    return;
  }

  libroSel.value = marcador.libro;
  cargarCapitulos();

  setTimeout(() => {
    capSel.value = marcador.capitulo;
    mostrarTexto();
  }, 0);
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

  // 🔑 CUANDO SALÍS DE MODO IMAGEN
  if (!modoImagen) {
    resetPreview();
    actualizarPreview();
  }

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

  // 📐 formato por defecto
  setFormatoImagen("post");

  // 👉 abrir personalización directo
  document.getElementById("modalPersonalizar").style.display = "flex";

  actualizarPreview();
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

window.cancelarCrearImagen = salirModoImagen;

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

// Crear miniaturas clickeables para los fondos
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
    fondoFinal = img.src; // Asigna el fondo seleccionado

    actualizarPreview(); // Actualiza la vista previa con el nuevo fondo
  };

  contenedorFondos.appendChild(img);
});

// Conectar los controles de personalización a la vista previa
["personalizarFuente", "personalizarTamaño", "personalizarColor", "personalizarOpacidad", "personalizarUpper"]
.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", actualizarPreview); // Llama a actualizarPreview cuando haya cambios
});

// ---------------- Botón Generar ----------------
document.getElementById("btnGenerarPersonalizada").onclick = () => {
  // Validación para asegurarse de que se haya seleccionado un fondo
  if (!fondoFinal) {
    alert("Por favor, selecciona un fondo antes de continuar.");
    return;
  }

  // Si todo está bien, continuamos con la generación de la imagen
  const fuente = document.getElementById("personalizarFuente").value;
  const tamaño = document.getElementById("personalizarTamaño").value;
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const upper = document.getElementById("personalizarUpper").checked;

  document.getElementById("modalPersonalizar").style.display = "none";

  alert(
    `✅ Imagen personalizada generada!\n` +
    `Formato: ${formatoImagen}\n` +
    `Fondo: ${fondoFinal || "No seleccionado"} (opacidad ${opacidad})\n` +
    `Fuente: ${fuente}\n` +
    `Tamaño: ${tamaño}\n` +
    `Color: ${color}\n` +
    `Mayúsculas: ${upper ? "Sí" : "No"}`
  );

  // Mostrar la imagen en grande para vista previa
const imagenFinal = document.createElement("img");
imagenFinal.src = fondoFinal;
imagenFinal.style.width = "100%"; // Esto hace que la imagen ocupe toda la pantalla
imagenFinal.style.maxWidth = "800px"; // Para no hacerlo demasiado grande
imagenFinal.style.margin = "auto";
imagenFinal.style.display = "block";

const modalImagen = document.createElement("div");
modalImagen.style.position = "fixed";
modalImagen.style.top = "0";
modalImagen.style.left = "0";
modalImagen.style.width = "100%";
modalImagen.style.height = "100%";
modalImagen.style.backgroundColor = "rgba(0,0,0,0.7)";
modalImagen.style.zIndex = "1000";
modalImagen.style.display = "flex";
modalImagen.style.justifyContent = "center";
modalImagen.style.alignItems = "center";

modalImagen.appendChild(imagenFinal);

// Añadir un botón de cerrar
const closeButton = document.createElement("button");
closeButton.innerText = "Cerrar";
closeButton.style.position = "absolute";
closeButton.style.top = "10px";
closeButton.style.right = "10px";
closeButton.style.padding = "10px";
closeButton.style.backgroundColor = "white";
closeButton.style.border = "none";
closeButton.style.borderRadius = "50%";
closeButton.style.cursor = "pointer";

closeButton.onclick = () => {
  modalImagen.remove();
};

modalImagen.appendChild(closeButton);

document.body.appendChild(modalImagen);

// Descargar la imagen
const downloadButton = document.createElement("button");
downloadButton.innerText = "Descargar Imagen";
downloadButton.style.marginTop = "15px";
downloadButton.style.padding = "10px";
downloadButton.style.backgroundColor = "#4f6fa8";
downloadButton.style.color = "#fff";
downloadButton.style.border = "none";
downloadButton.style.borderRadius = "5px";
downloadButton.style.cursor = "pointer";

downloadButton.onclick = () => {
  const link = document.createElement("a");
  link.href = imagenFinal.src;
  link.download = "imagen_personalizada.png"; // Nombre por defecto de la imagen
  link.click();
};

modalImagen.appendChild(downloadButton);

  if (uid) {
  const imagenId = Date.now(); // Usamos el tiempo actual como un identificador único para la imagen
  const imagenURL = imagenFinal.src;

  // Guardar la URL de la imagen en la base de datos
  set(ref(db, `imagenes/${uid}/${imagenId}`), {
    url: imagenURL,
    fecha: new Date().toISOString()
  }).then(() => {
    alert("✅ Imagen guardada en tu panel!");
    mostrarImagenesEnPanel(); // Actualiza la sección de imágenes en el panel
  });
}


  // Resetea todo
  modoImagen = false;
  seleccionImagen = {};
  plantillaSeleccionada = null;
  formatoImagen = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen").classList.remove("activo");
  mostrarTexto();
};

// ---------------- VISTA PREVIA ----------------

function actualizarPreview() {
  const previewImagen = document.getElementById("previewImagen");
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");

  // 1️⃣ TEXTO
  const versiculo = obtenerVersiculoSeleccionado();
  const textoFinal = versiculo || "";

  previewTexto.innerText = textoFinal;
  previewTextoBack.innerText = textoFinal;

  // 2️⃣ FONDO
  previewImagen.style.backgroundImage = fondoFinal
    ? `url(${fondoFinal})`
    : "none";

  // 3️⃣ FUENTE
  const fuente = document.getElementById("personalizarFuente").value || "Arial";
  previewTexto.style.fontFamily = fuente;
  previewTextoBack.style.fontFamily = fuente;

  // 4️⃣ TAMAÑO BASE
  const slider = document.getElementById("personalizarTamaño");
  let size = parseInt(slider.value) || 32;

  previewTexto.style.fontSize = size + "px";
  previewTextoBack.style.fontSize = size + "px";

  // 5️⃣ AUTOAJUSTE (solo reduce)
  const min = 14;
  while (
    previewTexto.scrollHeight > wrapper.clientHeight &&
    size > min
  ) {
    size--;
    previewTexto.style.fontSize = size + "px";
    previewTextoBack.style.fontSize = size + "px";
  }

  // 6️⃣ COLORES
  const colorTexto = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const colorBack = colorContraste(colorTexto);

  previewTexto.style.color = colorTexto;
  previewTextoBack.style.color = colorBack;

  // fondo SOLO en wrapper
  wrapper.style.backgroundColor = `rgba(0,0,0,${opacidad})`;

  // 7️⃣ ESTILOS
  const upper = document.getElementById("personalizarUpper").checked;
  const transform = upper ? "uppercase" : "none";

  previewTexto.style.textTransform = transform;
  previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = textStyle.bold ? "700" : "400";
  previewTexto.style.fontStyle = textStyle.italic ? "italic" : "normal";
  previewTexto.style.textDecoration = textStyle.underline ? "underline" : "none";

  previewTextoBack.style.fontWeight = previewTexto.style.fontWeight;
  previewTextoBack.style.fontStyle = previewTexto.style.fontStyle;
  previewTextoBack.style.textDecoration = previewTexto.style.textDecoration;

  // 8️⃣ INTERLINEADO
  previewTexto.style.lineHeight = "1.25";
  previewTextoBack.style.lineHeight = "1.25";
}


// ---------------- CONTRASTE AUTOMÁTICO ----------------

function colorContraste(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminancia > 160 ? "#000000" : "#ffffff";
}

// ---------------- RESET PREVIEW ----------------

function resetPreview() {
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const previewImagen = document.getElementById("previewImagen");
  const wrapper = document.getElementById("previewTextoWrapper");
  const slider = document.getElementById("personalizarTamaño");

  // tamaño por defecto
  slider.value = 32;
  previewTexto.style.fontSize = "32px";
  previewTextoBack.style.fontSize = "32px";

  // fuente por defecto
  previewTexto.style.fontFamily = "Arial";
  previewTextoBack.style.fontFamily = "Arial";

  // colores por defecto (texto + back)
  previewTexto.style.color = "#000000";
  previewTextoBack.style.color = "#ffffff";

  // estilos
  previewTexto.style.textTransform = "none";
  previewTextoBack.style.textTransform = "none";
  previewTexto.style.fontWeight = "400";
  previewTexto.style.fontStyle = "normal";
  previewTexto.style.textDecoration = "none";

  previewTextoBack.style.fontWeight = "400";
  previewTextoBack.style.fontStyle = "normal";
  previewTextoBack.style.textDecoration = "none";

  // fondo
  previewImagen.style.backgroundImage = "none";
  wrapper.style.backgroundColor = "transparent";

  // formato por defecto → POST
  previewImagen.classList.remove("preview-story");
  previewImagen.classList.add("preview-post");

  // reset estado de estilos
  textStyle.upper = false;
  textStyle.bold = false;
  textStyle.italic = false;
  textStyle.underline = false;
}

// ---------------- SALIR MODO IMAGEN ----------------

function salirModoImagen() {
  modoImagen = false;
  seleccionImagen = {};
  fondoFinal = null;

  document.body.classList.remove("modo-imagen");
  document.getElementById("btnImagen")?.classList.remove("activo");

  document.getElementById("modalPersonalizar").style.display = "none";

  resetPreview();
  mostrarTexto();
}

















