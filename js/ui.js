// ================= UI GENERAL =================

// ---- Tamaño de texto ----
function aumentarTexto() {
  size += 2;
  mostrarTexto();
  actualizarPreviewImagen();
}

function disminuirTexto() {
  if (size > 10) size -= 2;
  mostrarTexto();
  actualizarPreviewImagen();
}

// ---- Estilos ----
function toggleBold() {
  textStyle.bold = !textStyle.bold;
  mostrarTexto();
  actualizarPreviewImagen();
}

function toggleItalic() {
  textStyle.italic = !textStyle.italic;
  mostrarTexto();
  actualizarPreviewImagen();
}

function toggleUnderline() {
  textStyle.underline = !textStyle.underline;
  mostrarTexto();
  actualizarPreviewImagen();
}

function toggleUpper() {
  textStyle.upper = !textStyle.upper;
  mostrarTexto();
  actualizarPreviewImagen();
}

// ---- Colores ----
function cambiarColor(color) {
  colorActual = color;
}

// ---- Modo imagen ----
function activarImagen() {
  activarModoImagen();
}

function desactivarImagen() {
  desactivarModoImagen();
}

function generarImagen() {
  generarImagenFinal();
}

// ---- Eventos ----
document.addEventListener("DOMContentLoaded", () => {
  const btnMas = document.getElementById("btnMas");
  const btnMenos = document.getElementById("btnMenos");
  const btnBold = document.getElementById("btnBold");
  const btnItalic = document.getElementById("btnItalic");
  const btnUnderline = document.getElementById("btnUnderline");
  const btnUpper = document.getElementById("btnUpper");
  const btnImagen = document.getElementById("btnImagen");
  const btnImagenOff = document.getElementById("btnImagenOff");
  const btnGenerarImagen = document.getElementById("btnGenerarImagen");

  if (btnMas) btnMas.onclick = aumentarTexto;
  if (btnMenos) btnMenos.onclick = disminuirTexto;
  if (btnBold) btnBold.onclick = toggleBold;
  if (btnItalic) btnItalic.onclick = toggleItalic;
  if (btnUnderline) btnUnderline.onclick = toggleUnderline;
  if (btnUpper) btnUpper.onclick = toggleUpper;
  if (btnImagen) btnImagen.onclick = activarImagen;
  if (btnImagenOff) btnImagenOff.onclick = desactivarImagen;
  if (btnGenerarImagen) btnGenerarImagen.onclick = generarImagen;
});
