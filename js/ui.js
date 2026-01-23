// ================= UI / BOTONES =================

import {
  size,
  colorActual,
  resaltadorBloqueado,
  marcador,
  textStyle
} from "./estado.js";

// ================= DOM =================
const btnMas = document.getElementById("mas");
const btnMenos = document.getElementById("menos");
const colores = document.querySelectorAll(".color");
const btnBold = document.getElementById("btnBold");
const btnItalic = document.getElementById("btnItalic");
const btnUnderline = document.getElementById("btnUnderline");
const btnUpper = document.getElementById("btnUpper");
const btnLock = document.getElementById("btnLock");

// ================= TAMAÑO TEXTO =================
if (btnMas) {
  btnMas.onclick = () => {
    size += 2;
    if (window.mostrarTexto) window.mostrarTexto();
  };
}

if (btnMenos) {
  btnMenos.onclick = () => {
    size = Math.max(12, size - 2);
    if (window.mostrarTexto) window.mostrarTexto();
  };
}

// ================= COLORES =================
colores.forEach(c => {
  c.onclick = () => {
    if (resaltadorBloqueado) return;
    colorActual = c.dataset.color;
    colores.forEach(x => x.classList.remove("activo"));
    c.classList.add("activo");
  };
});

// ================= ESTILOS =================
if (btnBold) btnBold.onclick = () => toggle("bold");
if (btnItalic) btnItalic.onclick = () => toggle("italic");
if (btnUnderline) btnUnderline.onclick = () => toggle("underline");
if (btnUpper) btnUpper.onclick = () => toggle("upper");

function toggle(tipo) {
  textStyle[tipo] = !textStyle[tipo];
  document.body.classList.toggle(tipo, textStyle[tipo]);
}

// ================= BLOQUEO =================
if (btnLock) {
  btnLock.onclick = () => {
    resaltadorBloqueado = !resaltadorBloqueado;
    btnLock.classList.toggle("activo", resaltadorBloqueado);
  };
}
