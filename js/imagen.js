// ================= MODO IMAGEN =================

function activarModoImagen() {
  modoImagen = true;
  seleccionImagen = {};
  actualizarPreviewImagen();
}

function desactivarModoImagen() {
  modoImagen = false;
  seleccionImagen = {};
  actualizarPreviewImagen();
}

// ================= SELECCION DE VERSICULOS =================

function seleccionarVersiculoImagen(num, texto) {
  if (!modoImagen) return;

  if (seleccionImagen[num]) {
    delete seleccionImagen[num];
  } else {
    seleccionImagen[num] = texto;
  }

  actualizarPreviewImagen();
}

// ================= PREVIEW =================

function actualizarPreviewImagen() {
  const contenedor = document.getElementById("previewImagen");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (!modoImagen) {
    contenedor.textContent = "Modo imagen desactivado";
    return;
  }

  const versos = Object.values(seleccionImagen);
  if (versos.length === 0) {
    contenedor.textContent = "Seleccioná versículos";
    return;
  }

  versos.forEach(txt => {
    const p = document.createElement("p");
    p.textContent = txt;
    p.style.fontSize = size + "px";
    aplicarEstilosTexto(p);
    contenedor.appendChild(p);
  });
}

// ================= ESTILOS =================

function aplicarEstilosTexto(el) {
  el.style.fontWeight = textStyle.bold ? "bold" : "normal";
  el.style.fontStyle = textStyle.italic ? "italic" : "normal";
  el.style.textDecoration = textStyle.underline ? "underline" : "none";
  el.style.textTransform = textStyle.upper ? "uppercase" : "none";
}

// ================= CANVAS =================

function generarImagenFinal() {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const versos = Object.values(seleccionImagen);
  if (versos.length === 0) return;

  canvas.width = 1080;
  canvas.height = 1080;

  if (fondoFinal) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      dibujarTexto(ctx, versos);
      descargarCanvas(canvas);
    };
    img.src = fondoFinal;
  } else {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dibujarTexto(ctx, versos);
    descargarCanvas(canvas);
  }
}

function dibujarTexto(ctx, versos) {
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";

  let y = 200;
  versos.forEach(txt => {
    ctx.font = `${textStyle.bold ? "bold" : ""} ${size * 2}px Arial`;
    ctx.fillText(txt, 540, y);
    y += size * 3;
  });
}

// ================= DESCARGA =================

function descargarCanvas(canvas) {
  const link = document.createElement("a");
  link.download = "imagen-biblica.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
