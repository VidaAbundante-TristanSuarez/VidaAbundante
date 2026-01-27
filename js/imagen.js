// ================= IMPORTS =================
import { state } from "./estado.js";
import { mostrarTexto } from "./biblia.js";
import { subirImagenFirebase } from "./firebase.js"; // ✅ NUEVO: función para subir imágenes

// ================= ELEMENTOS =================
const modal = document.getElementById("modalPersonalizar");
const preview = document.getElementById("previewImagen");
const textoFront = document.getElementById("previewTexto");
const textoBack = document.getElementById("previewTextoBack");
const wrapper = document.getElementById("previewTextoWrapper");

const inputSize = document.getElementById("personalizarTamaño");
const inputColor = document.getElementById("personalizarColor");
const inputOpacidad = document.getElementById("personalizarOpacidad");
const selectFuente = document.getElementById("personalizarFuente");
const contFuentes = document.getElementById("listaFuentes");
const contFondos = document.getElementById("personalizarFondos");

const canvasFinal = document.getElementById("canvasFinal");

// ================= OBTENER TEXTO SELECCIONADO =================
function obtenerVersiculoSeleccionado() {
  const ids = Object.keys(state.seleccionImagen);
  if (!ids.length) return "";

  let textos = [], numeros = [], libro = "", cap = "";

  ids.forEach(id => {
    const [l, c, v] = id.split("_");
    const vers = state.bibliaData.find(x =>
      x.Libro === l && x.Capitulo == c && x.Versiculo == v
    );
   
    if (vers) {
  libro = l;
  cap = c;
  textos.push(vers.RV1960 || vers.Texto || "");
  numeros.push(Number(v));
}

  });

  numeros.sort((a,b)=>a-b);

  const partes = [];
  let inicio = numeros[0], anterior = numeros[0];
  for (let i=1;i<numeros.length;i++){
    if(numeros[i]===anterior+1) anterior=numeros[i];
    else { 
      partes.push(inicio===anterior?`${inicio}`:`${inicio}-${anterior}`);
      inicio=numeros[i]; anterior=numeros[i];
    }
  }
  partes.push(inicio===anterior?`${inicio}`:`${inicio}-${anterior}`);

  const referencia = `${libro} ${cap}:${partes.join(",")}`;
  return textos.join("\n") + "\n\n▪ " + referencia;
}

// ================= MODO IMAGEN =================
window.toggleModoImagen = () => {
  if (!state.uid) { loginModal.style.display="flex"; return; }

  state.modoImagen = !state.modoImagen;
  state.seleccionImagen = {};
  document.body.classList.toggle("modo-imagen", state.modoImagen);

  const banner = document.getElementById("bannerModoImagen");
  if(banner) banner.style.display = state.modoImagen?"block":"none";

  mostrarTexto();
};

// ================= GENERAR IMAGEN =================
window.generarImagen = () => {
  if (!state.uid) { loginModal.style.display="flex"; return; }
  if (!Object.keys(state.seleccionImagen).length) {
    alert("Seleccioná al menos un versículo"); return;
  }
  abrirPersonalizar();
};

// ================= ABRIR MODAL =================
function abrirPersonalizar() {
  modal.style.display = "flex";
  cargarFondos();
  crearListaVisualFuentes();
  construirTexto();
  actualizarPreview();
}

// ================= CONSTRUIR TEXTO =================
function construirTexto() {
  const contenido = obtenerVersiculoSeleccionado();
  textoFront.innerText = contenido;
  textoBack.innerText = contenido;
}

// ================= PREVIEW EN TIEMPO REAL =================
function actualizarPreview() {

  if (!textoFront || !textoBack) return;

  const contenido = obtenerVersiculoSeleccionado();
  textoFront.innerText = contenido;
  textoBack.innerText = contenido;

  // tamaño
  textoFront.style.fontSize = inputSize.value + "px";
  textoBack.style.fontSize = inputSize.value + "px";

  // color
  textoFront.style.color = inputColor.value;
  textoBack.style.color = inputColor.value;

  // fuente
  textoFront.style.fontFamily = selectFuente.value;
  textoBack.style.fontFamily = selectFuente.value;

  // opacidad fondo
  preview.style.backgroundColor = `rgba(0,0,0,${inputOpacidad.value})`;

  // estilos adicionales
  textoFront.style.fontWeight = state.textStyle.bold ? "700" : "400";
  textoFront.style.fontStyle = state.textStyle.italic ? "italic" : "normal";
  textoFront.style.textDecoration = state.textStyle.underline ? "underline" : "none";
  textoFront.style.textTransform = state.textStyle.upper ? "uppercase" : "none";

  textoBack.style.cssText = textoFront.style.cssText;

  // fondo
 // Actualización del fondo
if (state.fondoFinal) {
  preview.style.backgroundImage = `url(${state.fondoFinal})`;
  preview.style.backgroundSize = "cover";  // Corregimos el tamaño del fondo
  preview.style.backgroundPosition = "center";  // Aseguramos que esté centrado
} else {
  preview.style.backgroundImage = "none";
}

  // tamaño base
  let fontSize = parseInt(inputSize.value);
  textoFront.style.fontSize = fontSize + "px";
  textoBack.style.fontSize = fontSize + "px";

  // 🔁 autoajuste para que no se salga
  while (fontSize > 14) {
    if (textoFront.scrollHeight <= wrapper.clientHeight - 40) break;
    fontSize--;
    textoFront.style.fontSize = fontSize + "px";
    textoBack.style.fontSize = fontSize + "px";
  }
  
}

// ================= FONDOS =================
const fondos = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
  "https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba"
];
function cargarFondos() {
  contFondos.innerHTML="";
  fondos.forEach(url=>{
    const img=document.createElement("img");
    img.src=url;
    img.onclick=()=>{ state.fondoFinal=url; actualizarPreview(); };
    contFondos.appendChild(img);
  });
}

// ================= FUENTES =================
const fuentesGoogle = ["Roboto","Lobster","Playfair Display","Montserrat","Poppins","Great Vibes"];
function crearListaVisualFuentes() {
  contFuentes.innerHTML="";
  fuentesGoogle.forEach(f=>{
    const btn=document.createElement("button");
    btn.textContent=f;
    btn.style.fontFamily=f;
    btn.onclick=()=>{
      selectFuente.value=f;
      actualizarPreview();
      contFuentes.style.display="none";
    };
    contFuentes.appendChild(btn);
  });
}

// ================= LISTENERS =================
[inputSize,inputColor,inputOpacidad].forEach(el=>el.addEventListener("input",actualizarPreview));
selectFuente.addEventListener("change",actualizarPreview);

// ================= CANCELAR =================
window.cancelarCrearImagen = () => {
  modal.style.display = "none";
  state.fondoFinal = null;
  state.textStyle = {upper:false,bold:false,italic:false,underline:false};
};

// ================= FORMATO =================
window.setFormatoImagen = tipo => {
  preview.classList.remove("preview-post", "preview-story", "preview-cuadrado");
  
  if (tipo === "story") {
    preview.classList.add("preview-story");
    preview.style.aspectRatio = "9/16";
  } else if (tipo === "cuadrado") {
    preview.classList.add("preview-cuadrado");
    preview.style.aspectRatio = "1/1";  // Relación cuadrada
  } else {
    preview.classList.add("preview-post");
  }
  actualizarPreview();
};


// ================= CANVAS FINAL =================
async function generarImagenFinal() {
  await document.fonts.ready;
  html2canvas(preview,{
    scale:window.devicePixelRatio||2,
    useCORS:true
  }).then(c=>{
    canvasFinal.width=c.width;
    canvasFinal.height=c.height;
    canvasFinal.getContext("2d").drawImage(c,0,0);

    // preview actualizado con imagen final
    preview.style.backgroundImage=`url(${canvasFinal.toDataURL("image/png")})`;
  });
}
window.generarImagenFinal = generarImagenFinal;

// ======================== DESCARGAR IMAGEN ====================
window.descargarImagenFinal = () => {
  canvasFinal.toBlob(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "versiculo.png";
    link.click();
    URL.revokeObjectURL(link.href);
  });
};

// ======================== COMPARTIR IMAGEN ====================
window.compartirImagenFinal = () => {
  canvasFinal.toBlob(blob => {
    const file = new File([blob], "versiculo.png", { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: "Versículo", text: "Compartir imagen" });
    } else {
      window.descargarImagenFinal();
      alert("Tu dispositivo no permite compartir directamente. La imagen se descargó para que la compartas manualmente.");
    }
  });
};

// ======================== SUBIR IMAGEN ====================
/**
 * panel = "personal" o "iglesia"
 */
window.subirImagen = (panel="personal") => {
  canvasFinal.toBlob(async blob => {
    if(!blob) { alert("Primero generá la imagen final"); return; }

    const url = await subirImagenFirebase(blob, panel); // ✅ capturamos la URL
    if(url) {
      // Por ejemplo, mostrarla en el preview inmediatamente
      preview.style.backgroundImage = `url(${url})`;
      console.log("Imagen subida y lista para mostrar:", url);
    }
  });
};

// 👉 EXPONER PARA OTROS ARCHIVOS (ui.js)
window.actualizarPreview = actualizarPreview;
