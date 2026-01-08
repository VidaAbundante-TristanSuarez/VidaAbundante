let size = 18;

const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");

// CARGAR BIBLIA (JSON)
fetch("VidaAbundante - RV1960.json")
  .then(r => r.json())
  .then(data => iniciar(data));

function iniciar(biblia) {
  const libros = [...new Set(biblia.map(v => v.Libro))];
  libros.forEach(l => libroSel.innerHTML += `<option>${l}</option>`);

  libroSel.onchange = () => cargarCapitulos(biblia);
  capSel.onchange = () => mostrarTexto(biblia);

  cargarCapitulos(biblia);
}

function cargarCapitulos(biblia) {
  capSel.innerHTML = "";
  const caps = [...new Set(
    biblia
      .filter(v => v.Libro === libroSel.value)
      .map(v => v.Capitulo)
  )];

  caps.forEach(c => capSel.innerHTML += `<option>${c}</option>`);
  mostrarTexto(biblia);
}

function mostrarTexto(biblia) {
  texto.innerHTML = "";
  const versos = biblia.filter(v =>
    v.Libro === libroSel.value &&
    v.Capitulo == capSel.value
  );

  versos.forEach(v => {
    texto.innerHTML += `
      <div class="versiculo" style="font-size:${size}px">
        <span class="num">${v.Versiculo}</span>
        ${v.Texto}
      </div>`;
  });
}

window.cambiarLetra = (n) => {
  size += n;
  document.querySelectorAll(".versiculo")
    .forEach(v => v.style.fontSize = size + "px");
};
