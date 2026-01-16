// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// ================= ESTADO GLOBAL =================
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

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

// ================= DOM (SE CARGA CON DEFER) =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ============================================================
// ================= FUNCIONES INTERNAS =======================
// ============================================================

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

function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo" + (imagen ? " imagen" : "");
  div.style.fontSize = size + "px";
  div.style.background = imagen ? "" : marcado?.color || "transparent";

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
    seleccionImagen[id]
      ? delete seleccionImagen[id]
      : seleccionImagen[id] = true;
    mostrarTexto();
    actualizarPreview();
    return;
  }

  if (!uid) return;

  const r = ref(db, "marcados/" + uid + "/" + id);
  marcados[id] ? remove(r) : set(r, { color: colorActual });
  detectarGrupo(num);
}

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

function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) return "";

  let textos = [];
  let refFinal = "";

  ids.forEach(id => {
    const [libro, cap, ver] = id.split("_");
    const v = bibliaData.find(x =>
      x.Libro === libro &&
      x.Capitulo == cap &&
      x.Versiculo == ver
    );
    if (v) {
      textos.push(v.RV1960);
      refFinal = `${libro} ${cap}:${ver}`;
    }
  });

  return textos.join(" ") + "\n\n— " + refFinal;
}

function colorContraste(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#000000" : "#ffffff";
}

function actualizarPreview() {
  const previewImagen = document.getElementById("previewImagen");
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");

  const textoFinal = obtenerVersiculoSeleccionado();
  previewTexto.innerText = textoFinal;
  previewTextoBack.innerText = textoFinal;

  previewImagen.style.backgroundImage = fondoFinal
    ? `url(${fondoFinal})`
    : "none";

  const fuente = document.getElementById("personalizarFuente").value || "Arial";
  previewTexto.style.fontFamily = fuente;
  previewTextoBack.style.fontFamily = fuente;

  let sizeBase = parseInt(document.getElementById("personalizarTamaño").value || 32);
  previewTexto.style.fontSize = sizeBase + "px";
  previewTextoBack.style.fontSize = sizeBase + "px";

  while (previewTexto.scrollHeight > wrapper.clientHeight && sizeBase > 14) {
    sizeBase--;
    previewTexto.style.fontSize = sizeBase + "px";
    previewTextoBack.style.fontSize = sizeBase + "px";
  }

  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;

  previewTexto.style.color = color;
  previewTextoBack.style.color = colorContraste(color);
  wrapper.style.backgroundColor = `rgba(0,0,0,${opacidad})`;

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
}

function resetPreview() {
  fondoFinal = null;
  textStyle = { upper: false, bold: false, italic: false, underline: false };
}

function salirModoImagen() {
  modoImagen = false;
  seleccionImagen = {};
  fondoFinal = null;
  document.body.classList.remove("modo-imagen");
  document.getElementById("modalPersonalizar").style.display = "none";
  mostrarTexto();
}

function mostrarToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2000);
}

// ============================================================
// ================= WINDOW / UI ===============================
// ============================================================

window.irA = seccion => {
  ["biblia", "devocionales", "abc", "iglesia", "panel"].forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = s === seccion ? "block" : "none";
  });
  mostrarTexto();
};

window.toggleModoImagen = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }
  modoImagen = !modoImagen;
  seleccionImagen = {};
  document.body.classList.toggle("modo-imagen", modoImagen);
  mostrarTexto();
};

window.generarImagen = () => {
  if (Object.keys(seleccionImagen).length === 0) {
    alert("Seleccioná al menos un versículo");
    return;
  }
  document.getElementById("modalPersonalizar").style.display = "flex";
  actualizarPreview();
};

window.cancelarCrearImagen = salirModoImagen;

window.setColor = (c, btn) => {
  colorActual = c;
  document.querySelectorAll(".color-btn").forEach(b => b.classList.remove("activo"));
  btn?.classList.add("activo");
};

window.cambiarLetra = delta => {
  size = Math.max(14, size + delta * 2);
  mostrarTexto();
};

window.toggleTema = () => {
  document.body.classList.toggle("oscuro");
};

window.logout = () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
};

// ============================================================
// ================= CARGA BIBLIA ==============================
// ============================================================

fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  });

function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
}

// ============================================================
// ================= AUTH =====================================
// ============================================================

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

// ==============================================
// 📸 GENERAR IMAGEN REAL (CANVAS)
// ==============================================

window.generarImagenCanvas = async function () {
  if (!fondoFinal) {
    alert("No hay fondo seleccionado");
    return;
  }

  const formato = formatoImagen || "post";

  // Tamaños estándar redes
  const size = formato === "story"
    ? { w: 1080, h: 1920 }
    : { w: 1080, h: 1080 };

  const canvas = document.createElement("canvas");
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext("2d");

  // ---------- FONDO ----------
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = fondoFinal;

  await new Promise(res => img.onload = res);

  // cubrir fondo
  const scale = Math.max(
    size.w / img.width,
    size.h / img.height
  );
  const x = (size.w - img.width * scale) / 2;
  const y = (size.h - img.height * scale) / 2;

  ctx.drawImage(
    img,
    x,
    y,
    img.width * scale,
    img.height * scale
  );

  // ---------- OVERLAY ----------
  ctx.fillStyle = `rgba(0,0,0,${opacidadFondo || 0.35})`;
  ctx.fillRect(0, 0, size.w, size.h);

  // ---------- TEXTO ----------
  let texto = textoImagen || "";
  if (textStyle.upper) texto = texto.toUpperCase();

  const fontSize = parseInt(tamañoTexto || 32) * (size.w / 400);
  const fontWeight = textStyle.bold ? "bold" : "normal";
  const fontStyle = textStyle.italic ? "italic" : "normal";

  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fuenteTexto || "Arial"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = colorTexto || "#ffffff";

  const maxWidth = size.w * 0.8;
  const lineHeight = fontSize * 1.25;
  const words = texto.split(" ");
  let lines = [];
  let line = "";

  words.forEach(word => {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word + " ";
    } else {
      line = test;
    }
  });
  lines.push(line);

  const totalHeight = lines.length * lineHeight;
  let startY = size.h / 2 - totalHeight / 2;

  // contorno
  ctx.strokeStyle = colorTexto || "#ffffff";
  ctx.lineWidth = fontSize * 0.15;

  lines.forEach((l, i) => {
    const y = startY + i * lineHeight;
    ctx.strokeText(l.trim(), size.w / 2, y);
    ctx.fillText(l.trim(), size.w / 2, y);
  });

  // ---------- EXPORT ----------
  const dataURL = canvas.toDataURL("image/png");

  // Descargar
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = "versiculo.png";
  a.click();

  // Compartir en móvil
  if (navigator.share) {
    const blob = await (await fetch(dataURL)).blob();
    const file = new File([blob], "versiculo.png", { type: "image/png" });

    navigator.share({
      files: [file],
      title: "Versículo",
      text: "Compartido desde Vida Abundante"
    }).catch(() => {});
  }
};



