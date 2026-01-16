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
let resaltadorAbierto = true;
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
const op = parseFloat(opacidad);

// opacidad //
let bgColor = "rgba(0,0,0,0)";

if (op > 0.5) {
  // hacia negro
  const a = (op - 0.5) * 2;
  bgColor = `rgba(0,0,0,${a})`;
} else if (op < 0.5) {
  // hacia blanco
  const a = (0.5 - op) * 2;
  bgColor = `rgba(255,255,255,${a})`;
}

wrapper.style.backgroundColor = bgColor;

//
  
  const transform = textStyle.upper ? "uppercase" : "none";

previewTexto.style.textTransform = transform;
previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = textStyle.bold ? "700" : "400";
  previewTexto.style.fontStyle = textStyle.italic ? "italic" : "normal";
  previewTexto.style.textDecoration = textStyle.underline ? "underline" : "none";

  previewTextoBack.style.fontWeight = previewTexto.style.fontWeight;
  previewTextoBack.style.fontStyle = previewTexto.style.fontStyle;
  previewTextoBack.style.textDecoration = previewTexto.style.textDecoration;

  ajustarTextoPreview();

}

function ajustarTextoPreview() {
  const wrapper = document.getElementById("previewTextoWrapper");
  const texto = document.getElementById("previewTexto");
  const back = document.getElementById("previewTextoBack");

  if (!wrapper || !texto) return;

  let size = parseInt(texto.style.fontSize) || 32;

  // reset previo
  texto.style.whiteSpace = "pre-wrap";
  texto.style.wordBreak = "break-word";

  while (
    (texto.scrollHeight > wrapper.clientHeight ||
     texto.scrollWidth > wrapper.clientWidth) &&
    size > 12
  ) {
    size--;
    texto.style.fontSize = size + "px";
    back.style.fontSize = size + "px";
  }
}


function resetPreview() {
  fondoFinal = null;
  textStyle = { upper: false, bold: false, italic: false, underline: false };
}

function resetModalPersonalizar() {
  fondoFinal = null;
  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  document.getElementById("personalizarTamaño").value = 32;
  document.getElementById("personalizarFuente").value = "Arial";
  document.getElementById("personalizarColor").value = "#ffffff";

  const prev = document.getElementById("previewImagen");
  if (prev) prev.style.backgroundImage = "none";
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

// 🔗 Listeners de personalización (NO EXISTÍAN)
["personalizarOpacidad","personalizarFuente","personalizarTamaño","personalizarColor"]
.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.oninput = actualizarPreview;
});

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
  setFormatoImagen("post");
  cargarFondos(); 
  actualizarPreview();
};

window.cancelarCrearImagen = () => {
  resetModalPersonalizar();
  salirModoImagen();
};

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

// ============================================================
// ================= FUNCIONES QUE FALTABAN ===================
// ============================================================

// ---- Marcadores ----
window.guardarMarcador = () => {
  marcador = {
    libro: libroSel.value,
    capitulo: capSel.value
  };
  mostrarToast("📁 Marcador guardado");
};

window.irAMarcador = () => {
  if (!marcador) return;
  libroSel.value = marcador.libro;
  cargarCapitulos();
  capSel.value = marcador.capitulo;
  mostrarTexto();
};

// ---- Notas ----
window.guardarNota = () => {
  if (!grupoActual || !uid) return;
  set(ref(db, `notas/${uid}/${grupoActual}`), notaTexto.value)
    .then(() => mostrarToast("📝 Nota guardada"));
};

// ---- Navegación capítulos ----
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

// ---- Panel ----
window.mostrarSeccion = tipo => {
  ["imagenes", "versiculos", "notas"].forEach(s => {
    document.getElementById("panel-" + s).style.display =
      s === tipo ? "block" : "none";
  });
};

// ---- Login ----
window.irALogin = () => {
  window.location.href = "login.html";
};

window.cerrarLogin = () => {
  loginModal.style.display = "none";
};

// ============================================================
// ================= TEXTO (BOTONES) ==========================
// ============================================================

window.toggleUpper = () => {
  textStyle.upper = !textStyle.upper;
  document.querySelector(".style-row button:nth-child(1)")
    .classList.toggle("activo", textStyle.upper);
  actualizarPreview();
};

window.toggleBold = () => {
  textStyle.bold = !textStyle.bold;
  document.querySelector(".style-row button:nth-child(2)")
    .classList.toggle("activo", textStyle.bold);
  actualizarPreview();
};

window.toggleItalic = () => {
  textStyle.italic = !textStyle.italic;
  document.querySelector(".style-row button:nth-child(3)")
    .classList.toggle("activo", textStyle.italic);
  actualizarPreview();
};

window.toggleUnderline = () => {
  textStyle.underline = !textStyle.underline;
  document.querySelector(".style-row button:nth-child(4)")
    .classList.toggle("activo", textStyle.underline);
  actualizarPreview();
};

// ============================================================
// ================= FORMATO IMAGEN ===========================
// ============================================================

window.setFormatoImagen = tipo => {
  const preview = document.getElementById("previewImagen");
  preview.classList.remove("preview-post", "preview-story");
  preview.classList.add(tipo === "story" ? "preview-story" : "preview-post");
  setTimeout(ajustarTextoPreview, 50); // 👈 ESTA LÍNEA
};

// ============================================================
// ================= FONDOS ================================
// ============================================================

const fondos = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
];

function cargarFondos() {
  const cont = document.getElementById("personalizarFondos");
  cont.innerHTML = "";

  fondos.forEach(url => {
    const img = document.createElement("img");
    img.src = url;
    img.style.width = "70px";
    img.style.height = "70px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "10px";
    img.style.cursor = "pointer";

    img.onclick = () => {
      fondoFinal = url;
      actualizarPreview();
    };

    cont.appendChild(img);
  });
}

// ================= BOTÓN GENERAR ============================
// ============================================================

const btnGen = document.getElementById("btnGenerarPersonalizada");

if (btnGen) {
  btnGen.onclick = () => {
    if (!fondoFinal) {
      alert("Seleccioná un fondo");
      return;
    }

    alert("✅ Imagen generada (canvas va acá)");
    salirModoImagen();
  };
}

// ============================================================ CANVAS

function generarImagenFinal() {
  const canvas = document.getElementById("canvasFinal");
  const ctx = canvas.getContext("2d");

  const esStory = document.getElementById("formatoImagen")?.value === "historia";

  // Tamaños reales
  canvas.width = esStory ? 1080 : 1080;
  canvas.height = esStory ? 1920 : 1080;

  // ===== FONDO =====
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (fondoFinal) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      dibujarFondo(ctx, img, canvas);
      dibujarTexto(ctx, canvas);
      exportarImagen(canvas);
    };
    img.src = fondoFinal;
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dibujarTexto(ctx, canvas);
    exportarImagen(canvas);
  }
}

// ======================== DIBUJA FONDO ==================================== 

function dibujarFondo(ctx, img, canvas) {
  const ratioCanvas = canvas.width / canvas.height;
  const ratioImg = img.width / img.height;

  let drawWidth, drawHeight, x, y;

  if (ratioImg > ratioCanvas) {
    drawHeight = canvas.height;
    drawWidth = img.width * (canvas.height / img.height);
    x = (canvas.width - drawWidth) / 2;
    y = 0;
  } else {
    drawWidth = canvas.width;
    drawHeight = img.height * (canvas.width / img.width);
    x = 0;
    y = (canvas.height - drawHeight) / 2;
  }

  ctx.drawImage(img, x, y, drawWidth, drawHeight);
}

// ======================== DIBUJA TEXTO CLON DEL PREVIEW ==================================== 

function dibujarTexto(ctx, canvas) {
  const texto = obtenerVersiculoSeleccionado();
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;

  const fuente = document.getElementById("personalizarFuente").value || "Arial";
  let size = parseInt(document.getElementById("personalizarTamaño").value || 36);

  const paddingX = 80;
  const paddingY = 120;
  const maxWidth = canvas.width - paddingX * 2;
  const maxHeight = canvas.height - paddingY * 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  // Fondo opaco
  ctx.fillStyle = `rgba(0,0,0,${opacidad})`;
  ctx.fillRect(
    paddingX,
    paddingY,
    maxWidth,
    maxHeight
  );

  // Ajuste automático tamaño
  do {
    ctx.font = `
      ${textStyle.italic ? "italic" : ""}
      ${textStyle.bold ? "700" : "400"}
      ${size}px ${fuente}
    `;
    size--;
  } while (medirAltoTexto(ctx, texto, maxWidth) > maxHeight && size > 14);

  ctx.fillStyle = color;

  let y = paddingY + (maxHeight - medirAltoTexto(ctx, texto, maxWidth)) / 2;
  dibujarTextoMultilinea(ctx, texto, canvas.width / 2, y, maxWidth, size * 1.3);
}

// ======================== FUNCIONES AUXILIARES MULTILÍNEA ==================================== 

function dibujarTextoMultilinea(ctx, texto, x, y, maxWidth, lineHeight) {
  const palabras = texto.split(" ");
  let linea = "";

  for (let i = 0; i < palabras.length; i++) {
    const test = linea + palabras[i] + " ";
    const metrics = ctx.measureText(test);

    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(linea, x, y);
      linea = palabras[i] + " ";
      y += lineHeight;
    } else {
      linea = test;
    }
  }
  ctx.fillText(linea, x, y);
}

function medirAltoTexto(ctx, texto, maxWidth) {
  const palabras = texto.split(" ");
  let linea = "";
  let lineas = 1;

  for (let i = 0; i < palabras.length; i++) {
    const test = linea + palabras[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lineas++;
      linea = palabras[i] + " ";
    } else {
      linea = test;
    }
  }
  return lineas * parseInt(ctx.font);
}




