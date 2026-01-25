import { state } from "./estado.js";
import { marcarVersiculo, desmarcarVersiculo } from "./firebase.js";

// ================= CARGA BIBLIA ==============================

fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => {
    state.bibliaData = data;
    iniciar();
  });

document.fonts.ready.then(() => {
  console.log("✅ Fuentes cargadas");
  actualizarPreview();
});

// ================= INICIO =================

function iniciar() {
  const libros = [...new Set(state.bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));
  libroSel.onchange = cargarCapitulos;
  capSel.onchange = mostrarTexto;
  cargarCapitulos();
}

// ================= CAPITULOS =================

function cargarCapitulos() {
  capSel.innerHTML = "";
  const caps = [...new Set(
    state.bibliaData
      .filter(v => v.Libro === libroSel.value)
      .map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
}

// ================= TEXTO =================

export function mostrarTexto() {
  texto.innerHTML = "";
  notaBox.style.display = "none";
  state.grupoActual = null;

  titulo.innerText = `${libroSel.value} ${capSel.value}`;

  const versos = state.bibliaData.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => pintarVersiculo(v));
}

// ================= TOGGLE VERSICULO =======================

function toggleVersiculo(id, num) {

  // 🖼️ MODO IMAGEN
  if (state.modoImagen) {
    if (!state.uid) {
      loginModal.style.display = "flex";
      return;
    }

    state.seleccionImagen[id]
      ? delete state.seleccionImagen[id]
      : state.seleccionImagen[id] = true;

    mostrarTexto();
    actualizarPreview();
    return;
  }

  // 🔐 requiere login
  if (!state.uid) return;

  // 🔒 resaltador bloqueado
  if (state.resaltadorBloqueado) return;

  // 🎨 marcar / desmarcar
  if (state.marcados[id]) {
    desmarcarVersiculo(state.uid, id);
  } else {
    marcarVersiculo(state.uid, id, state.colorActual);
  }

  detectarGrupo(num);
}

// ======================= PINTAR VERSICULO =============================

function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = state.marcados[id];
  const imagen = state.modoImagen && state.seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo";
  if (imagen) div.classList.add("imagen");

  // ================= EVENTO CLICK =================
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  // ================= TAMAÑO DE LETRA =================
  div.style.fontSize = state.size + "px";

  // ================= FONDO =================
  if (state.modoImagen) {
    div.style.background = imagen
      ? "rgba(255, 214, 232, 0.6)"
      : "transparent";
  } else {
    div.style.background = marcado?.color || "transparent";
  }

  // ================= COLOR DE TEXTO =================
  if (state.modoImagen) {
    div.style.color = imagen
      ? "#ffffff"
      : document.body.classList.contains("oscuro")
        ? "#ffffff"
        : "#000000";
  } else if (marcado) {
    div.style.color = document.body.classList.contains("oscuro")
      ? "#000000"
      : colorContraste(marcado.color);
  }

  // ================= TEXTO =================
  let textoVerso = v.Texto;

  if (state.textStyle.upper) textoVerso = textoVerso.toUpperCase();
  if (state.textStyle.bold) div.style.fontWeight = "bold";
  if (state.textStyle.italic) div.style.fontStyle = "italic";
  if (state.textStyle.underline) div.style.textDecoration = "underline";

  div.innerHTML = `<span class="num">${v.Versiculo}</span> ${textoVerso}`;
  texto.appendChild(div);
}

// ================= DETECTA GRUPO =======================

function detectarGrupo(num) {
  const nums = Object.keys(state.marcados)
    .filter(k => {
      const [lib, cap] = k.split("_");
      return lib === libroSel.value && cap == capSel.value;
    })
    .map(k => Number(k.split("_")[2]))
    .sort((a, b) => a - b);

  const grupo = nums.filter(n => Math.abs(n - num) <= 1);
  if (grupo.length < 2) return;

  state.grupoActual = grupo.join("-");
  notaBox.style.display = "block";
  notaTexto.value = state.notas[state.grupoActual] || "";
}

// ================= FORMATO RANGO (UTILIDAD) =======================

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
