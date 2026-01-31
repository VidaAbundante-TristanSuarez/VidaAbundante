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
let colorActual = "#fff3b0"; // 💛 amarillo por default
let resaltadorBloqueado = false; // 🔒 nuevo estado
let grupoActual = null;
let marcador = null;
let fuenteActual = "Arial";

let modoImagen = false;
let seleccionImagen = {};
let fondoFinal = null;

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

// ================= AUTH =====================================
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

// ================= DOM (SE CARGA CON DEFER) =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ================= ⭐ CARGA BIBLIA ==============================
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciar();
  });

document.fonts.ready.then(() => {
  console.log("✅ Fuentes cargadas");
  actualizarPreview();
});

// ================= ⭐ INICIAR BIBLIA ==============================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

// ================= ⭐ CARGA CAPITULOS ==============================
function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
}

// ========================= 🎨 RESALTADOR COMPACTO  =======================================
document.addEventListener("DOMContentLoaded", () => {

  const btnActivo = document.getElementById("btnResaltadorActivo");
  const paleta = document.getElementById("paletaResaltadores");
  const cont = document.getElementById("resaltadorCompacto");
  const btnBloquear = document.getElementById("btnBloquearResaltador");

  if (!btnActivo || !paleta || !cont || !btnBloquear) {
    console.warn("❌ Resaltador no inicializado");
    return;
  }

  paleta.style.display = "none";
  btnActivo.style.background = colorActual;
  btnActivo.textContent = "💛";

  // 🟡 CLICK PRINCIPAL → abrir / cerrar paleta
  btnActivo.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const visible = paleta.style.display === "block";
    paleta.style.display = visible ? "none" : "block";
    cont.classList.remove("mover-derecha");
    if (!visible) {
      const rect = paleta.getBoundingClientRect();
      if (rect.top < 10) cont.classList.add("mover-derecha");
    }
  };

  // 🎨 ELEGIR COLOR
  paleta.querySelectorAll("button[data-color]").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      // Quitar candado de todos los botones
      paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

      colorActual = btn.dataset.color;
      btnActivo.style.background = colorActual;
      btnActivo.textContent = btn.textContent;

      resaltadorBloqueado = false;
      paleta.style.display = "none";
    };
  });

  // 🔒 BLOQUEAR / DESBLOQUEAR
  btnBloquear.onclick = e => {
    e.preventDefault();
    e.stopPropagation();

    resaltadorBloqueado = !resaltadorBloqueado;
    btnBloquear.textContent = resaltadorBloqueado ? "🔓" : "🔒";

    // Quitar todos los candados anteriores
    paleta.querySelectorAll("button[data-color] span.icono-candado").forEach(c => c.remove());

    if (resaltadorBloqueado) {
      // Colocar candado sobre el color actual
      const botonColor = Array.from(paleta.querySelectorAll("button[data-color]"))
        .find(b => b.dataset.color === colorActual);
      if (botonColor) {
        const span = document.createElement("span");
        span.textContent = "🔒";
        span.className = "icono-candado";
        span.style.position = "absolute";
        span.style.top = "-4px";
        span.style.right = "-4px";
        span.style.fontSize = "10px";
        span.style.background = "#fff";
        span.style.borderRadius = "50%";
        span.style.padding = "1px";
        botonColor.style.position = "relative";
        botonColor.appendChild(span);
      }
    }
  };

  // ❌ cerrar clic fuera
  document.addEventListener("click", e => {
    if (!cont.contains(e.target)) {
      paleta.style.display = "none";
    }
  });

});


// ================= ⭐ MOSTRAR TEXTO =======================
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

// ================= ⭐ TOGGLE VERSICULO =======================
function toggleVersiculo(id, num) {

  // 🖼️ MODO IMAGEN
  if (modoImagen) {
    if (!uid) {
      loginModal.style.display = "flex";
      return;
    }

    if (seleccionImagen[id]) {
      delete seleccionImagen[id];
    } else {
      seleccionImagen[id] = true;
    }

    mostrarTexto();
    actualizarPreview();
    return;
  }

  // 🔐 requiere login
  if (!uid) return;

  // 🔒 resaltador bloqueado
  if (resaltadorBloqueado) return;

  // 🎨 marcar / desmarcar versículo
  const r = ref(db, "marcados/" + uid + "/" + id);

  if (marcados[id]) {
    remove(r);
  } else {
    set(r, { color: colorActual });
  }

  detectarGrupo(num);
}

// ================= ⭐ DETECTA GRUPO =======================
function detectarGrupo(num) {
 const nums = Object.keys(marcados)
  .filter(k => {
    const [lib, cap] = k.split("_");
    return lib === libroSel.value && cap == capSel.value;
  })
  .map(k => Number(k.split("_")[2]))
  .sort((a, b) => a - b);

  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = notas[grupoActual] || "";
}

// ======================= ⭐ PINTAR VERSICULO  =============================
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo";
  if (imagen) div.classList.add("imagen");

  // ================= Tamaño Letra =================
  div.style.fontSize = size + "px";

  // ================= Fondo =================
  if (modoImagen) {
    div.style.background = imagen
      ? "rgba(255, 214, 232, 0.6)"
      : "transparent";
  } else {
    div.style.background = marcado?.color || "transparent";
  }

  // ================= Color de Texto =================
  if (modoImagen) {
    if (imagen) {
      div.style.color = "#000000";
    } else {
      div.style.color = document.body.classList.contains("oscuro")
        ? "#ffffff"
        : "#000000";
    }
  } 
  else if (marcado) {
    if (document.body.classList.contains("oscuro")) {
      div.style.color = "#000000";
    } else {
      div.style.color = colorContraste(marcado.color);
    }
  }

  // ================= Opacidad (UX MODO IMAGEN) =================
  if (modoImagen && !imagen) {
    div.style.opacity = "0.6";
  } else {
    div.style.opacity = "1";
  }

  // ================= Contenido =================
  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${v.RV1960}`;

  // ================= Click =================
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  texto.appendChild(div);
}

// ================= ⭐ OBTIENE VERSICULO SELECCIONADO =======================
function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(seleccionImagen);
  if (ids.length === 0) return "";

  let textos = [];
  let numeros = [];
  let libro = "";
  let cap = "";

  ids.forEach(id => {
    const [l, c, v] = id.split("_");
    const vers = bibliaData.find(x =>
      x.Libro === l &&
      x.Capitulo == c &&
      x.Versiculo == v
    );

    if (vers) {
      libro = l;
      cap = c;
      textos.push(vers.RV1960);
      numeros.push(Number(v));
    }
  });

  // ordenar versículos // =================
  numeros.sort((a, b) => a - b);

  // convertir a rangos // =================
  const partes = [];
  let inicio = numeros[0];
  let anterior = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === anterior + 1) {
      anterior = numeros[i];
    } else {
      partes.push(
        inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
      );
      inicio = numeros[i];
      anterior = numeros[i];
    }
  }

  partes.push(
    inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
  );

  const referencia = `${libro} ${cap}:${partes.join(",")}`;

  return textos.join("\n") + "\n\n▪ " + referencia;
}

// ================= ⭐ FORMATEA: JUAN 1:5-10  =======================
function formatearVersiculosComoRango(numeros) {
  if (numeros.length === 0) return "";

  numeros.sort((a, b) => a - b);

  const partes = [];
  let inicio = numeros[0];
  let anterior = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === anterior + 1) {
      anterior = numeros[i];
    } else {
      partes.push(
        inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
      );
      inicio = numeros[i];
      anterior = numeros[i];
    }
  }

  partes.push(
    inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
  );

  return partes.join(",");
}
// ================= ⭐ COLOR CONTRASTE  =======================

function colorContraste(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#000000" : "#ffffff";
}

// ================= ⭐ COLOR OUTLINE CLAROS Y OSCUROS  =======================
function colorOutlineDesdeBase(color) {
  if (!color) return "#000000";

  // rgb() → hex
  if (color.startsWith("rgb")) {
    const nums = color.match(/\d+/g).map(Number);
    color =
      "#" + nums.map(x => x.toString(16).padStart(2, "0")).join("");
  }

  // hex → rgb normalizado
  let r = parseInt(color.slice(1, 3), 16) / 255;
  let g = parseInt(color.slice(3, 5), 16) / 255;
  let b = parseInt(color.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // 🔥 CLAVE: extremos tintados
  const isLight = l > 0.65;

  // mantener color vivo
  s = Math.min(1, s * 0.9 + 0.1);

  // extremos reales
  l = isLight
    ? 0.08   // casi negro tintado
    : 0.91;  // casi blanco tintado

  // hsl → rgb
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  let r2, g2, b2;
  if (s === 0) {
    r2 = g2 = b2 = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  return (
    "#" +
    [r2, g2, b2]
      .map(v => Math.round(v * 255).toString(16).padStart(2, "0"))
      .join("")
  );
}

// ================= 🎀 FUENTES  =======================
// 🔗 Listeners de personalización 
["personalizarOpacidad","personalizarTamaño","personalizarColor"]
.forEach(id => {
  const el = document.getElementById(id);
  if (el) el.oninput = actualizarPreview;
});

// ================= 🎀 LISTA VISUAL DE FUENTES =================
const fuentesGoogle = [
  { nombre: "Roboto", css: "Roboto" },
  { nombre: "Lobster", css: "Lobster" },
  { nombre: "Playfair Display", css: "'Playfair Display'" },
  { nombre: "Montserrat", css: "Montserrat" },
  { nombre: "Poppins", css: "Poppins" },
  { nombre: "Abril Fatface", css: "'Abril Fatface'" },
  { nombre: "Cormorant", css: "Cormorant" },
  { nombre: "Josefin Sans", css: "'Josefin Sans'" },
  { nombre: "Great Vibes", css: "'Great Vibes'" }
];

// ================= ⭐ CREAR LISTA VISUAL DE FUENTES  =======================
function crearListaVisualFuentes() {
  const cont = document.getElementById("listaFuentes");
  if (!cont) return;

  cont.innerHTML = "";

  fuentesGoogle.forEach(f => {
    const btn = document.createElement("button");
    btn.textContent = f.nombre;
    btn.style.fontFamily = f.css;

    // marcar la fuente actual como activa
    if (fuenteActual === f.css) btn.classList.add("activo");

    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      fuenteActual = f.css;

      // actualizar activo visual
      cont.querySelectorAll("button").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      actualizarPreview();

      // cerrar al elegir
      cont.classList.remove("abierto");
      document.getElementById("btnFuentes")?.classList.remove("activo");
    };

    cont.appendChild(btn);
  });
}

// ================= 🎀 CERRAR FUENTES AL TOCAR FUERA O AL TOCAR DE NUEVO =================
const btnFuentes = document.getElementById("btnFuentes");
const listaFuentes = document.getElementById("listaFuentes");

if (btnFuentes && listaFuentes) {
  btnFuentes.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    const abierto = listaFuentes.classList.toggle("abierto");
    btnFuentes.classList.toggle("activo", abierto);
  });

  document.addEventListener("click", e => {
    if (!listaFuentes.contains(e.target) && e.target !== btnFuentes) {
      listaFuentes.classList.remove("abierto");
      btnFuentes.classList.remove("activo");
    }
  });
}

// ================= 🌄 FONDOS ⛺================================
const fondos = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
];

// ================= ⭐ CARGAR FONDOS   =======================
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

// ================= ⭐ ACTUALIZAR VISTA PREVIA  =======================
function actualizarPreview() {
  const previewImagen = document.getElementById("previewImagen");
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");

  // ================= Texto =================
  const textoFinal = obtenerVersiculoSeleccionado();
  previewTexto.innerText = textoFinal;
  previewTextoBack.innerText = textoFinal;

  // ================= Fondo =================
  previewImagen.style.backgroundImage = fondoFinal
    ? `url(${fondoFinal})`
    : "none";

  // ================= Fuente =================
  const fuente = fuenteActual;
  previewTexto.style.fontFamily = fuente;
  previewTextoBack.style.fontFamily = fuente;

  // ================= Formato =================
  const formatoStory = previewImagen.classList.contains("preview-story");
  const sizeSlider = document.getElementById("personalizarTamaño");
  const sizeBase = sizeSlider
    ? Number(sizeSlider.value)
    : (formatoStory ? 56 : 48);

  // ================= Auto Ajuste =================
  let fontSize = sizeBase;
  const maxHeight = wrapper.clientHeight - 40;

  previewTexto.style.lineHeight = "1.3";
  previewTextoBack.style.lineHeight = "1.3";

  while (fontSize > 14) {
    previewTexto.style.fontSize = fontSize + "px";
    previewTextoBack.style.fontSize = fontSize + "px";
    if (previewTexto.scrollHeight <= maxHeight) break;
    fontSize--;
  }
  // ================= Color / Outline =================
  const color = document.getElementById("personalizarColor").value;
  const opacidad = document.getElementById("personalizarOpacidad").value;
  const outlineColor = colorOutlineDesdeBase(color);

  // capas
  previewTexto.style.position = "relative";
  previewTexto.style.zIndex = "2";

  previewTextoBack.style.position = "absolute";
  previewTextoBack.style.zIndex = "1";

  // reset estilos acumulables
  previewTextoBack.style.transform = "none";
  previewTextoBack.style.textShadow = "none";
  previewTextoBack.style.filter = "none";

  // colores
  previewTexto.style.color = color;
  previewTextoBack.style.color = outlineColor;

  // desplazamiento (outline)
  previewTextoBack.style.transform = "translate(0.5px, 0.5px)";
  previewTextoBack.style.filter = "blur(0.2px)";

  // ================= Opacidad Oscuro/Claro =================
  const op = parseFloat(opacidad);
  let bgColor = "rgba(0,0,0,0)";

  if (op > 0.5) {
    const a = (op - 0.5) * 2;
    bgColor = `rgba(0,0,0,${a})`;
  } else if (op < 0.5) {
    const a = (0.5 - op) * 2;
    bgColor = `rgba(255,255,255,${a})`;
  }

 wrapper.style.backgroundColor = bgColor;

  // ================= Estilos Texto =================
  const transform = textStyle.upper ? "uppercase" : "none";

  previewTexto.style.textTransform = transform;
  previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = textStyle.bold ? "700" : "400";
  previewTexto.style.fontStyle = textStyle.italic ? "italic" : "normal";
  previewTexto.style.textDecoration = textStyle.underline ? "underline" : "none";

  previewTextoBack.style.fontWeight = previewTexto.style.fontWeight;
  previewTextoBack.style.fontStyle = previewTexto.style.fontStyle;
  previewTextoBack.style.textDecoration = previewTexto.style.textDecoration;
}

// ================= ⭐ CANVAS GENERA IMAGEN FINAL ============================
async function generarImagenFinal() {
  const preview = document.getElementById("previewImagen");
  const canvasFinal = document.getElementById("canvasFinal");

  if (!preview || !canvasFinal) return false;

  // si no hay texto todavía, actualiza
  actualizarPreview();

  // asegurar layout real
  await new Promise(r => requestAnimationFrame(r));
  await document.fonts.ready;

  const rect = preview.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    alert("❌ Error: preview sin tamaño");
    return false;
  }

  const canvasTemp = await html2canvas(preview, {
    scale: Math.max(2, window.devicePixelRatio || 2),
    useCORS: true,
    allowTaint: false,
    backgroundColor: null
  });

  canvasFinal.width = canvasTemp.width;
  canvasFinal.height = canvasTemp.height;

  const ctx = canvasFinal.getContext("2d");
  ctx.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
  ctx.drawImage(canvasTemp, 0, 0);

  // 🔼 subir imagen (si aplica)
  const subirIglesia = document.getElementById("checkIglesia")?.checked;
  if (subirIglesia) subirImagen("iglesia");
  subirImagen("personal");

  return true;
}

// ======================== helper para que Descargar/Compartir generen antes si hace falta ====================================
async function asegurarCanvasListo() {
  const canvas = document.getElementById("canvasFinal");
  if (!canvas) return false;

  if (canvas.width === 0 || canvas.height === 0) {
    const ok = await generarImagenFinal();
    return !!ok;
  }
  return true;
}

// ======================== ⭐ OPCION DESCARGAR ====================================
async function descargarImagenFinal() {
  const canvas = document.getElementById("canvasFinal");

  // si todavía no hay imagen, generarla
  if (!canvas.width || !canvas.height) {
    const ok = await generarImagenFinal();
    if (!ok) return;
  }

  canvas.toBlob(blob => {
    if (!blob) {
      alert("No se pudo generar la imagen");
      return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "versiculo.png";
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/png");
}

// ========================⭐ OPCION COMPARTIR ====================================
async function compartirImagenFinal() {
  const ok = await asegurarCanvasListo();
  if (!ok) return;

  const canvas = document.getElementById("canvasFinal");

  canvas.toBlob(async blob => {
    const file = new File([blob], "versiculo.png", { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Versículo"
        // ✅ sin "text" para que no mande mensaje raro
      });
    } else {
      await descargarImagenFinal();
      alert("Tu dispositivo no permite compartir directamente. La imagen se descargó para que la compartas manualmente.");
    }
  });
}

// ================= ⭐ RESET DEL MODAL  =======================
function resetModalPersonalizar() {
  fondoFinal = null;
  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  document.getElementById("personalizarTamaño").value = 32;
  fuenteActual = "Arial";
  const colorInput = document.getElementById("personalizarColor");
  colorInput.value = document.body.classList.contains("oscuro")
  ? "#ffffff"
  : "#000000";

  const preview = document.getElementById("previewImagen");
  preview.style.backgroundImage = "none";
  preview.style.pointerEvents = "auto";
  preview.classList.remove("render-final"); // 🔥 CLAVE

  // Restaurar texto HTML
  document.getElementById("previewTexto").style.display = "block";
  document.getElementById("previewTextoBack").style.display = "block";

  // Restaurar wrapper
  const wrapper = document.getElementById("previewTextoWrapper");
  wrapper.style.pointerEvents = "auto";
  wrapper.style.background = "";

  // Restaurar UI
  document.getElementById("personalizarFondos").style.display = "flex";
  document.getElementById("btnGenerarPersonalizada").style.display = "inline-block";

  const acciones = document.getElementById("accionesFinales");
  if (acciones) acciones.remove();
  actualizarPreview();
}

// ================= ⭐ SALIR DEL MODO IMAGEN  ======================= 
function salirModoImagen() {
  modoImagen = false;
  seleccionImagen = {};
  fondoFinal = null;

  document.body.classList.remove("modo-imagen");

  // 🖼️ ocultar banner
  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = "none";
  }

  document.getElementById("modalPersonalizar").style.display = "none";
  mostrarTexto();
}

// ================= 🔺 WINDOW / UI ⭕ ===============================
window.irA = seccion => {
  ["biblia", "devocionales", "abc", "iglesia", "panel"].forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = s === seccion ? "block" : "none";
  });
  mostrarTexto();
};

// ================= 🔺 MODO IMAGEN ===============================
window.toggleModoImagen = () => {
  if (!uid) {
    loginModal.style.display = "flex";
    return;
  }

  modoImagen = !modoImagen;
  seleccionImagen = {};

  // clase global
  document.body.classList.toggle("modo-imagen", modoImagen);

  // 🖼️ banner modo imagen
  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = modoImagen ? "block" : "none";
  }

  mostrarTexto();
};

// ================= 🔺 GENERAR IMAGEN ===============================
window.generarImagen = () => {
  if (Object.keys(seleccionImagen).length === 0) {
    alert("Seleccioná al menos un versículo");
    return;
  }
  document.getElementById("modalPersonalizar").style.display = "flex";
  setFormatoImagen("post");
  cargarFondos(); 
  crearListaVisualFuentes();
  actualizarPreview();
};

// ================= 🔺 CANCELAR CREAR IMAGEN ===============================
window.cancelarCrearImagen = () => {
  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.style.display = "none";

  resetModalPersonalizar();
  salirModoImagen();
};

// ================= 🔺 CAMBIAR LETRA ===============================
window.cambiarLetra = delta => {
  size = Math.max(14, size + delta * 2);
  mostrarTexto();
};

// ================= 🔺 TOGGLE TEMA ===============================
// ================= 🌙 TOGGLE TEMA (ANIMADO + ICONO DINÁMICO) =================
window.toggleTema = () => {
  const btn = document.querySelector('#header button[onclick="toggleTema()"]');

  // animación
  if (btn) {
    btn.classList.add("animar");
    setTimeout(() => btn.classList.remove("animar"), 350);
  }

  // toggle modo
  const oscuro = document.body.classList.toggle("oscuro");
  localStorage.setItem("modoOscuro", oscuro ? "1" : "0");

  // cambiar ícono
  if (btn) {
    btn.textContent = oscuro ? "☀️" : "🌙";
  }
};

// ================= ✨ RESTAURAR MODO OSCURO + ICONO =================
(() => {
  const oscuro = localStorage.getItem("modoOscuro") === "1";
  if (oscuro) document.body.classList.add("oscuro");

  const btn = document.querySelector('#header button[onclick="toggleTema()"]');
  if (btn) btn.textContent = oscuro ? "☀️" : "🌙";
})();


// ================= 🔺 LOGOUT ===============================
window.logout = () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
};

// ================= 🔺 GUARDAR MARCADOR ===================
window.guardarMarcador = () => {
  marcador = {
    libro: libroSel.value,
    capitulo: capSel.value
  };
  mostrarToast("📁 Marcador guardado");
};

// ================= 🔺 IR A MARCADOR ===================
window.irAMarcador = () => {
  if (!marcador) return;
  libroSel.value = marcador.libro;
  cargarCapitulos();
  capSel.value = marcador.capitulo;
  mostrarTexto();
};

// ================= 🔺 NOTAS ===================
window.guardarNota = () => {
  if (!grupoActual || !uid) return;
  set(ref(db, `notas/${uid}/${grupoActual}`), notaTexto.value)
    .then(() => mostrarToast("📝 Nota guardada"));
};

// ================= ⭐ TOAST   =======================

function mostrarToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2000);
}

// ================= 🔺 CAPITULO ANTERIOR ===================
window.capituloAnterior = () => {
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    mostrarTexto();
  }
};

// ================= 🔺 CAPITULO SIGUIENTE ===================
window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
    mostrarTexto();
  }
};

// ================= 🔺 PANEL ===================
window.mostrarSeccion = tipo => {
  ["imagenes", "versiculos", "notas"].forEach(s => {
    document.getElementById("panel-" + s).style.display =
      s === tipo ? "block" : "none";
  });
};

// ================= 🔺 IR A LOGIN ===================
window.irALogin = () => {
  window.location.href = "login.html";
};

// ================= 🔺 CERRAR LOGIN ===================
window.cerrarLogin = () => {
  loginModal.style.display = "none";
};

// ================= 🔺 TEXTO MAYUSCULAR ===================
window.toggleUpper = () => {
  textStyle.upper = !textStyle.upper;
  const b = document.getElementById("btnUpper");
  if (b) b.classList.toggle("activo", textStyle.upper);
  actualizarPreview();
};

// ================= 🔺 TEXTO NEGRITA ===================
window.toggleBold = () => {
  textStyle.bold = !textStyle.bold;
  const b = document.getElementById("btnBold");
  if (b) b.classList.toggle("activo", textStyle.bold);
  actualizarPreview();
};

// ================= 🔺 TEXTO ITALIC ===================
window.toggleItalic = () => {
  textStyle.italic = !textStyle.italic;
  const b = document.getElementById("btnItalic");
  if (b) b.classList.toggle("activo", textStyle.italic);
  actualizarPreview();
};

// ================= 🔺 TEXTO UNDERLINE ===================
window.toggleUnderline = () => {
  textStyle.underline = !textStyle.underline;
  const b = document.getElementById("btnUnderline");
  if (b) b.classList.toggle("activo", textStyle.underline);
  actualizarPreview();
};

// ================= 🔺 SET FORMATO IMAGEN ===========================
window.setFormatoImagen = tipo => {
  const preview = document.getElementById("previewImagen");
  preview.classList.remove("preview-post", "preview-story");
  preview.classList.add(tipo === "story" ? "preview-story" : "preview-post");

  const bPost = document.getElementById("btnFormatoPost");
  const bStory = document.getElementById("btnFormatoStory");
  if (bPost) bPost.classList.toggle("activo", tipo !== "story");
  if (bStory) bStory.classList.toggle("activo", tipo === "story");

  actualizarPreview(); // ✅ para recalcular tamaño automático
};

// ================= 🔺 HACER FUNCIONES GLOBALES (FIX DESCARGAR/COMPARTIR EN PC) =================
window.generarImagenFinal = generarImagenFinal;
window.descargarImagenFinal = descargarImagenFinal;
window.compartirImagenFinal = compartirImagenFinal;

