// ================= IMAGEN / CANVAS =================

import {
  size,
  modoImagen,
  seleccionImagen,
  fondoFinal
} from "./estado.js";

// ================= DOM =================
const btnImagen = document.getElementById("btnImagen");
const btnGenerarImagen = document.getElementById("btnGenerarImagen");
const canvas = document.getElementById("canvasFinal");
const ctx = canvas.getContext("2d");

// ================= TOGGLE MODO IMAGEN =================
if (btnImagen) {
  btnImagen.onclick = () => {
    modoImagen = !modoImagen;
    seleccionImagen = {};
    if (window.mostrarTexto) window.mostrarTexto();
  };
}

// ================= GENERAR IMAGEN =================
if (btnGenerarImagen) {
  btnGenerarImagen.onclick = () => {
    const versiculos = document.querySelectorAll(".versiculo.imagen");
    if (!versiculos.length) return;

    const padding = 40;
    const lineHeight = size + 12;

    canvas.width = 1080;
    canvas.height = padding * 2 + versiculos.length * lineHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let y = padding;

    versiculos.forEach(v => {
      ctx.font = `${size}px serif`;
      ctx.fillStyle = "#000";
      ctx.fillText(v.innerText, padding, y);
      y += lineHeight;
    });

    fondoFinal = canvas.toDataURL("image/png");
  };
}
