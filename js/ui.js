import { state } from "./estado.js";
import { mostrarTexto } from "./biblia.js";

// ================= DOM (SE CARGA CON DEFER) =================

const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ================= IR A SECCIONES =================

window.irA = seccion => {
  ["biblia", "devocionales", "abc", "iglesia", "panel"].forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (el) el.style.display = s === seccion ? "block" : "none";
  });
  mostrarTexto();
};

// ================= 📁 MARCADOR =================

window.guardarMarcador = () => {
  state.marcador = {
    libro: libroSel.value,
    capitulo: capSel.value
  };
  mostrarToast("📁 Marcador guardado");
};

// =========== IR A MARCADOR 📁↩
window.irAMarcador = () => {
  if (!state.marcador) return;
  libroSel.value = state.marcador.libro;
  cargarCapitulos();
  capSel.value = state.marcador.capitulo;
  mostrarTexto();
};

// ================ NOTAS  📋 ================
// 👉 UI SOLO actualiza estado (Firebase escucha desde main.js)

window.guardarNota = () => {
  if (!state.grupoActual || !state.uid) return;
  state.notaPendiente = {
    grupo: state.grupoActual,
    texto: notaTexto.value
  };
  mostrarToast("📝 Nota guardada");
};

// ================= TOAST =======================

function mostrarToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2000);
}

// ================= CAPITULO ANTERIOR ----
window.capituloAnterior = () => {
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    mostrarTexto();
  }
};

// ================= CAPITULO SIGUIENTE ----
window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
    mostrarTexto();
  }
};

// ================= PANEL MOSTRAR SECCION ----
window.mostrarSeccion = tipo => {
  ["imagenes", "versiculos", "notas"].forEach(s => {
    document.getElementById("panel-" + s).style.display =
      s === tipo ? "block" : "none";
  });
};

// ================= IR A LOGIN ----
window.irALogin = () => {
  window.location.href = "login.html";
};

// ================= CERRAR LOGIN ----
window.cerrarLogin = () => {
  loginModal.style.display = "none";
};

// ❌ LOGOUT YA NO VA AQUÍ
// 👉 logout está en main.js

// ================= CAMBIAR LETRA ----
window.cambiarLetra = delta => {
  state.size = Math.max(14, state.size + delta * 2);
  mostrarTexto();
};

// ================= TOGGLE TEMA OSCURO 🌙 ----
window.toggleTema = () => {
  const oscuro = document.body.classList.toggle("oscuro");
  localStorage.setItem("modoOscuro", oscuro ? "1" : "0");
};

// ================= RESTAURAR MODO OSCURO 🌙 =================
if (localStorage.getItem("modoOscuro") === "1") {
  document.body.classList.add("oscuro");
}

// ================= 🆎 ESTILOS DE TEXTO =================

// ---- MAYUSCULAS
window.toggleUpper = () => {
  state.textStyle.upper = !state.textStyle.upper;
  actualizarPreview();
};

// ---- NEGRITA
window.toggleBold = () => {
  state.textStyle.bold = !state.textStyle.bold;
  actualizarPreview();
};

// ---- ITALIC
window.toggleItalic = () => {
  state.textStyle.italic = !state.textStyle.italic;
  actualizarPreview();
};

// ---- SUBRAYADO
window.toggleUnderline = () => {
  state.textStyle.underline = !state.textStyle.underline;
  actualizarPreview();
};

// ================= 🌸 RESALTADOR COMPACTO 💛 =================

document.addEventListener("DOMContentLoaded", () => {

  const btnActivo = document.getElementById("btnResaltadorActivo");
  const paleta = document.getElementById("paletaResaltadores");
  const cont = document.getElementById("resaltadorCompacto");
  const btnBloquear = document.getElementById("btnBloquearResaltador");

  if (!btnActivo || !paleta || !cont || !btnBloquear) return;

  paleta.style.display = "none";
  btnActivo.style.background = state.colorActual;

  btnActivo.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    paleta.style.display =
      paleta.style.display === "block" ? "none" : "block";
  };

  paleta.querySelectorAll("button[data-color]").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      state.colorActual = btn.dataset.color;
      btnActivo.style.background = state.colorActual;
      paleta.style.display = "none";
    };
  });

  btnBloquear.onclick = e => {
    e.preventDefault();
    state.resaltadorBloqueado = !state.resaltadorBloqueado;
    btnBloquear.textContent =
      state.resaltadorBloqueado ? "🔓" : "🔒";
  };

  document.addEventListener("click", e => {
    if (!cont.contains(e.target)) {
      paleta.style.display = "none";
    }
  });

});
