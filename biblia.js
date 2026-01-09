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

// ⬅️➡️ CAMBIO DE CAPÍTULO
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

// 📖 TEXTO NORMAL
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

// 🎨 DIBUJAR VERSÍCULO
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

// ⭐ MARCAR
window.toggle = (id, num) => {
  if (!uid) return;
  const r = ref(db, "marcados/" + uid + "/" + id);

  marcados[id]
    ? remove(r)
    : set(r, { color: colorActual });

  detectarGrupo(num);
};

// 🔗 DETECTAR GRUPO DE MARCAS
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

// ⭐ MIS VERSÍCULOS
window.mostrarMisVersiculos = () => {
  texto.innerHTML = "<h3>⭐ Mis versículos</h3>";
  titulo.innerText = "";

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

// 📝 MIS NOTAS
window.mostrarNotas = () => {
  texto.innerHTML = "<h3>📝 Mis notas</h3>";
  titulo.innerText = "";

  Object.keys(notas).forEach(grupo => {
    texto.innerHTML += `
      <div class="versiculo resaltado" style="background:#fff3b0">
        <b>Versículos:</b> ${grupo.replaceAll("-", " a ")}<br>
        ${notas[grupo]}
      </div>`;
  });
};

// ↩️ VOLVER
window.volverBiblia = () => mostrarTexto();

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

// 🧭 PANEL — MOSTRAR SECCIÓN (IMÁGENES / VERSÍCULOS / NOTAS)
window.mostrarSeccion = (seccion) => {

  // 🔒 Ocultamos todas las secciones del panel
  const secciones = [
    "panel-imagenes",
    "panel-versiculos",
    "panel-notas"
  ];

  secciones.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // ✅ Mostramos solo la sección elegida
  const activa = document.getElementById("panel-" + seccion);
  if (activa) activa.style.display = "block";

  if (seccion === "imagenes") {
  cargarImagenes();
}

};

// 🧭 CAMBIAR SECCIÓN PRINCIPAL
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

  document.getElementById("seccion-" + seccion).style.display = "block";
};

// 🖼️ MIS IMÁGENES — CARGAR
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

    snap.forEach(img => {
      const data = img.val();

      grid.innerHTML += `
        <div class="card-imagen" onclick="verImagen('${data.url}')">
          <img src="${data.url}">
          <div class="nombre">${data.nombre || "Sin nombre"}</div>
        </div>
      `;
    });
  });
}

// 🔍 VER IMAGEN GRANDE
window.verImagen = (url) => {
  window.open(url, "_blank");
};

// 🖼️ GENERAR IMAGEN DESDE VERSÍCULOS MARCADOS
window.generarImagen = () => {

  if (!uid) {
    alert("Tenés que iniciar sesión");
    return;
  }

  // 📌 Tomamos solo los versículos marcados
  const ids = Object.keys(marcados);

  if (ids.length === 0) {
    alert("Marcá al menos un versículo");
    return;
  }

  // 📖 Construimos el texto
  let textoVersos = "";
  let referencia = "";

  ids.forEach(id => {
    const [Libro, Capitulo, Versiculo] = id.split("_");
    const v = bibliaData.find(x =>
      x.Libro === Libro &&
      x.Capitulo == Capitulo &&
      x.Versiculo == Versiculo
    );
    if (v) {
      textoVersos += v.RV1960 + " ";
      referencia = `${Libro} ${Capitulo}`;
    }
  });

  // 🔗 URL Cloudinary (SIMPLE)
  const base = "https://res.cloudinary.com/dlkpityif/image/upload/";
  const fondo = "fondo1"; // 👈 nombre de tu imagen en cloudinary SIN extensión

  const textoURL = encodeURIComponent(textoVersos.trim());
  const refURL = encodeURIComponent(referencia);

  const url =
    base +
    "w_1600,h_1600,c_fill/" +
    "l_text:Arial_60_center:" + textoURL +
    ",co_rgb:ffffff,g_center,y_-60,w_1400,c_fit/" +
    "l_text:Arial_40_bold_center:" + refURL +
    ",co_rgb:ffffff,g_south,y_120/" +
    fondo;

  // 💾 Guardar en Firebase
  const imgRef = ref(db, "imagenes/" + uid).push();

  set(imgRef, {
    url: url,
    nombre: referencia,
    creada: Date.now()
  });

  alert("Imagen generada ✨\nMirá en Mi Panel → Imágenes");
};

