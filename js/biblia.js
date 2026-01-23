// ================= CARGA BIBLIA ==============================

fetch("https://raw.githubusercontent.com/VidaAbundante-TristanSuarez/VidaAbundante/50fa8465246138b133b154ec2259c718c36872f7/VidaAbundante%20-%20RV1960.json")
  .then(r => r.json())
  .then(data => {
    bibliaData = data;
    iniciarBiblia();
  })
  .catch(err => {
    console.error("Error cargando Biblia:", err);
  });

// ================= INICIO =================

function iniciarBiblia() {
  if (!bibliaData || bibliaData.length === 0) return;

  libroActual = 0;
  capituloActual = 0;

  cargarLibros();
  cargarCapitulos();
  mostrarTexto();
}

// ================= LIBROS =================

function cargarLibros() {
  const contenedor = document.getElementById("libros");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  bibliaData.forEach((libro, index) => {
    const btn = document.createElement("button");
    btn.textContent = libro.name;
    btn.onclick = () => {
      libroActual = index;
      capituloActual = 0;
      cargarCapitulos();
      mostrarTexto();
    };
    contenedor.appendChild(btn);
  });
}

// ================= CAPITULOS =================

function cargarCapitulos() {
  const contenedor = document.getElementById("capitulos");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const caps = bibliaData[libroActual].chapters;

  caps.forEach((_, index) => {
    const btn = document.createElement("button");
    btn.textContent = index + 1;
    btn.onclick = () => {
      capituloActual = index;
      mostrarTexto();
    };
    contenedor.appendChild(btn);
  });
}

// ================= TEXTO =================

function mostrarTexto() {
  const contenedor = document.getElementById("textoBiblia");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  const capitulo = bibliaData[libroActual].chapters[capituloActual];

  capitulo.forEach((verso, index) => {
    const p = document.createElement("p");
    p.className = "versiculo";
    p.dataset.verso = index + 1;
    p.style.fontSize = size + "px";
    p.textContent = (index + 1) + ". " + verso;

    p.onclick = () => toggleVersiculo(index + 1, p);

    aplicarMarcado(p, index + 1);
    contenedor.appendChild(p);
  });
}

// ================= MARCADO =================

function toggleVersiculo(num, elemento) {
  const clave = `${libroActual}-${capituloActual}-${num}`;

  if (marcados[clave]) {
    delete marcados[clave];
    elemento.style.background = "";
  } else {
    marcados[clave] = colorActual;
    elemento.style.background = colorActual;
  }

  guardarMarcados();
}

function aplicarMarcado(elemento, num) {
  const clave = `${libroActual}-${capituloActual}-${num}`;
  if (marcados[clave]) {
    elemento.style.background = marcados[clave];
  }
}

// ================= FIREBASE =================

function guardarMarcados() {
  if (!uid) return;

  set(ref(db, "marcados/" + uid), marcados);
}

function escucharMarcados() {
  if (!uid) return;

  onValue(ref(db, "marcados/" + uid), (snap) => {
    if (snap.exists()) {
      marcados = snap.val();
      mostrarTexto();
    }
  });
}




