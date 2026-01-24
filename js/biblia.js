

// ================= CARGA BIBLIA ==============================

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

// ================= INICIO =================

function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
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
    bibliaData.filter(v => v.Libro === libroSel.value).map(v => v.Capitulo)
  )];
  caps.forEach(c => (capSel.innerHTML += `<option>${c}</option>`));
  mostrarTexto();
} 

// ================= TEXTO =================

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

// ================= TOGGLE VERSICULO =======================
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

// ======================= PINTAR VERSICULO  =============================
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];

  const div = document.createElement("div");
  div.className = "versiculo";
  if (imagen) div.classList.add("imagen");

  // ================= TAMAÑO DE LETRA =================
  div.style.fontSize = size + "px";

  // ================= FONDO =================
  if (modoImagen) {
    div.style.background = imagen
      ? "rgba(255, 214, 232, 0.6)"
      : "transparent";
  } else {
    div.style.background = marcado?.color || "transparent";
  }

  // ================= COLOR DE TEXTO =================
  if (modoImagen) {
    if (imagen) {
      div.style.color = "#ffffff";
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

// ================= DETECTA GRUPO =======================

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

// ================= FORMATO EN RANGO ej JUAN 1:5-10  =======================

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



