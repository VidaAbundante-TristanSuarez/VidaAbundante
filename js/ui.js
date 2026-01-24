
// ================= MARCADOR =================

window.guardarMarcador = () => {
  marcador = {
    libro: libroSel.value,
    capitulo: capSel.value
  };
  mostrarToast("📁 Marcador guardado");
};

// ----- IR A MARCADOR
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

// ================= TOAST  =======================

function mostrarToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2000);
}

// ---- CAPITULO ANTERIOR ----
window.capituloAnterior = () => {
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;
    mostrarTexto();
  }
};

// ---- CAPITULO SIGUIENTE
window.capituloSiguiente = () => {
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;
    mostrarTexto();
  }
};

// ---- PANEL MOSTRAR SECCION  ----
window.mostrarSeccion = tipo => {
  ["imagenes", "versiculos", "notas"].forEach(s => {
    document.getElementById("panel-" + s).style.display =
      s === tipo ? "block" : "none";
  });
};

// ---- IR A LOGIN ----
window.irALogin = () => {
  window.location.href = "login.html";
};

// ---- CERRAR LOGIN
window.cerrarLogin = () => {
  loginModal.style.display = "none";
};

// ---- LOGOUT 
window.logout = () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
};

// ---- CAMBIAR LETRA
window.cambiarLetra = delta => {
  size = Math.max(14, size + delta * 2);
  mostrarTexto();
};

// ---- TOGGLE TEMA OSCURO / CLARO 🌙
window.toggleTema = () => {
  const oscuro = document.body.classList.toggle("oscuro");
  localStorage.setItem("modoOscuro", oscuro ? "1" : "0");
};

// ================= 🆎 TEXTO ESTILOS FUENTES (BOTONES) ==========================

// ---- MAYUSULAS
window.toggleUpper = () => {
  textStyle.upper = !textStyle.upper;
  document.querySelector(".style-row button:nth-child(1)")
    .classList.toggle("activo", textStyle.upper);
  actualizarPreview();
};

// ---- NEGRITA
window.toggleBold = () => {
  textStyle.bold = !textStyle.bold;
  document.querySelector(".style-row button:nth-child(2)")
    .classList.toggle("activo", textStyle.bold);
  actualizarPreview();
};

// ---- ITALIC
window.toggleItalic = () => {
  textStyle.italic = !textStyle.italic;
  document.querySelector(".style-row button:nth-child(3)")
    .classList.toggle("activo", textStyle.italic);
  actualizarPreview();
};

// ---- SUBRAYADO
window.toggleUnderline = () => {
  textStyle.underline = !textStyle.underline;
  document.querySelector(".style-row button:nth-child(4)")
    .classList.toggle("activo", textStyle.underline);
  actualizarPreview();
};

// ========================= 🌸 RESALTADOR COMPACTO 💛 =======================================
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

// ============// ============// ============// ============
