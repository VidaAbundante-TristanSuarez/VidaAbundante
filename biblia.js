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
  if (user) {
    uid = user.uid;

    // 👉 Acción pendiente (ej: generar imagen luego del login)
    const accion = sessionStorage.getItem("accionPendiente");
    if (accion === "generarImagen") {
      sessionStorage.removeItem("accionPendiente");
      setTimeout(() => generarImagen(), 300);
    }

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

// ================= CAMBIO CAPÍTULO =================
window.capituloAnterior = () => {
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    mostrarTexto();
  }
};

window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
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
function pintarVersiculo(v, solo = false) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];

  texto.innerHTML += `
    <div class="versiculo ${marcado ? "resaltado" : ""}"
      style="font-size:${size}px; background:${marcado?.color || "transparent"}"
      onclick="${solo ? "" : `toggle('${id}', ${v.Versiculo})`}">
      <span class="num">${v.Versiculo}</span>
      ${v.RV1960}
    </div>`;
}

// ================= MARCAR =================
window.toggle = (id, num) => {
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
window.setColor = c => colorActual = c;

window.cambiarLetra = n => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};

window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};

// ================= GENERAR IMAGEN =================
// 🖼️ GENERAR IMAGEN DESDE VERSÍCULOS MARCADOS
window.generarImagen = () => {

  // 🔐 validar sesión
  if (!uid) {
    sessionStorage.setItem("accionPendiente", "generarImagen");
    mostrarModalLogin();
    return;
  }

  // 📌 versículos marcados
  const ids = Object.keys(marcados || {});

  if (ids.length === 0) {
    alert("Marcá al menos un versículo primero 🙏");
    return;
  }

  // 📖 texto + referencia
// 📖 construir texto y referencia correcta
let textoVersos = [];
let libro = "";
let capitulo = "";
let numeros = [];

ids.forEach(id => {
  const [L, C, V] = id.split("_");
  const v = bibliaData.find(x =>
    x.Libro === L &&
    x.Capitulo == C &&
    x.Versiculo == V
  );
  if (v) {
    libro = L;
    capitulo = C;
    numeros.push(Number(V));
    textoVersos.push(v.RV1960);
  }
});

// ordenar versículos
numeros.sort((a, b) => a - b);

// 📌 referencia tipo Génesis 1:1-5
let referencia = "";
if (numeros.length === 1) {
  referencia = `${libro} ${capitulo}:${numeros[0]}`;
} else {
  referencia = `${libro} ${capitulo}:${numeros[0]}-${numeros[numeros.length - 1]}`;
}

// texto con saltos
const textoFinal = textoVersos.join("\n\n");

  if (!textoVersos.trim()) {
    alert("No se pudo construir el texto.");
    return;
  }

  // ☁️ CLOUDINARY
  const base = "https://res.cloudinary.com/dlkpityif/image/upload/";
  const fondo = "fondo1";

 const textoURL = encodeURIComponent(textoFinal);
const refURL = encodeURIComponent(referencia);

const url =
  base +
  "w_1600,h_1600,c_fill/" +

  // TEXTO PRINCIPAL
  "l_text:Arial_60_center:" + textoURL +
  ",co_rgb:ffffff,gravity:center,y_-80,w_1400,c_fit,line_spacing_10/" +

  // REFERENCIA
  "l_text:Arial_42_bold_center:" + refURL +
  ",co_rgb:ffffff,gravity:south,y_140/" +

  fondo;

  // 💾 guardar en Firebase
  const imgRef = push(ref(db, "imagenes/" + uid));

  set(imgRef, {
    url,
    nombre: referencia,
    creada: Date.now()
  });

  alert("✨ Imagen generada\nMi Panel → Imágenes");
};


// ================= LOGIN MODAL =================
window.mostrarModalLogin = () => {
  document.getElementById("loginModal").style.display = "flex";
};

window.cerrarLogin = () => {
  document.getElementById("loginModal").style.display = "none";
};

window.irALogin = () => {
  window.location.href = "login.html";
};

// ================= NAVEGACIÓN PRINCIPAL =================
window.irA = (seccion) => {

  const secciones = [
    "seccion-biblia",
    "seccion-panel",
    "seccion-devocionales",
    "seccion-abc",
    "seccion-iglesia"
  ];

  secciones.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const activa = document.getElementById("seccion-" + seccion);
  if (activa) activa.style.display = "block";
};

// ================= PANEL — PESTAÑAS =================
window.mostrarSeccion = (seccion) => {

  const paneles = [
    "panel-imagenes",
    "panel-versiculos",
    "panel-notas"
  ];

  paneles.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const activa = document.getElementById("panel-" + seccion);
  if (activa) activa.style.display = "block";

  if (seccion === "imagenes") {
    cargarImagenes();
  }
};

// ================= CARGAR IMÁGENES DEL PANEL =================
function cargarImagenes() {
  if (!uid) return;

  const grid = document.getElementById("grid-imagenes");
  const vacio = document.getElementById("imagenes-vacio");

  onValue(ref(db, "imagenes/" + uid), snap => {
    grid.innerHTML = "";

    if (!snap.exists()) {
      vacio.style.display = "block";
      return;
    }

    vacio.style.display = "none";

    snap.forEach(child => {
      const img = child.val();

      const card = document.createElement("div");
      card.className = "card-imagen";
      card.innerHTML = `
        <img src="${img.url}" />
        <div class="nombre">${img.nombre || "Imagen bíblica"}</div>
      `;

      grid.appendChild(card);
    });
  });
}


