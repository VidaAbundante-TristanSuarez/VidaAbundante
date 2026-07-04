// ================= ABC - MÓDULO =================

const ABC_TEMAS = [
{
  titulo: "🤍",
  html: "ABC/INTRO.html",
  pdf: "ABC/pdf/1 INTRO.pdf",
  audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/INTRO.mp3"
},
  {
    titulo: "Salvación",
    html: "ABC/1 Salvación.html",
    pdf: "ABC/pdf/2 SALVACIÓN.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Salvacion.mp3"
  },
  {
    titulo: "Pecado",
    html: "ABC/2 Pecado.html",
    pdf: "ABC/pdf/3 PECADO.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Pecado.mp3"
  },
  {
    titulo: "La Palabra",
    html: "ABC/3 La Palabra.html",
    pdf: "ABC/pdf/4 LA PALABRA.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/La.palabra.mp3"
  },
  {
    titulo: "La Oración",
    html: "ABC/4 La Oración.html",
    pdf: "ABC/pdf/5 LA ORACIÓN.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/La.oracion.mp3"
  },
  {
    titulo: "Espíritu Santo",
    html: "ABC/5 Espíritu Santo.html",
    pdf: "ABC/pdf/6 ESPÍRITU SANTO.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Espiritu.Santo.mp3"
  },
  {
    titulo: "Bautismo",
    html: "ABC/6 Bautismo.html",
    pdf: "ABC/pdf/7 BAUTISMO EJERCICIOS.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Bautismo.mp3"
  },
  {
    titulo: "La Mayordomía",
    html: "ABC/7 La Mayordomía.html",
    pdf: "ABC/pdf/9 LA MAYORDOMÍA.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Mayordomia.mp3"
  },
  {
    titulo: "Evangelismo",
    html: "ABC/8 Evangelismo.html",
    pdf: "ABC/pdf/8 EVANGELISMO.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/Evangelismo.mp3"
  },
  {
    titulo: "Visión de la iglesia",
    html: "ABC/9 La visión de la iglesia.html",
    pdf: "ABC/pdf/9X 10 LA VISIÓN DE LA IGLESIA.pdf",
    audio: "https://github.com/VidaAbundante-TristanSuarez/vida-abundante-audios/releases/download/v1/La.vision.de.la.iglesia.mp3"
  }
];

const ABC_PDF_COMPLETO = "ABC/pdf/ABC COMPLETO CON PORTADA.pdf";

let abcIndex = 0;
let abcIniciado = false;
let abcResaltadosCache = {}; // { bid: {color} }
window.abcResaltadosCache = abcResaltadosCache;

let abcBloqueadosKeep = new Set();

// ✅ Esta es la que debe llamar mostrarIglesiaSub('abc')
window.mostrarABC = async () => {
  const cont = document.getElementById("abcApp");
  if (!cont) return;

  if (!abcIniciado) {
    cont.innerHTML = `
      <style>
        /* ===== ABC UI (local) ===== */
      #abcApp,
#iglesia-abc,
#seccion-iglesia,
#abcWrap{
  overflow: visible !important;
}

#abcWrap{
  max-width: 980px;
  margin: 0 auto;
  padding: 10px 12px 18px;
  overflow: visible !important;
}
#abcTop{
  display:flex;
  align-items:center;
  gap:6px;
  padding: 0 0 2px;
}

#abcIndice{
  flex:1;
  display:flex;
  align-items:center;
  gap:8px;

  overflow-x: scroll;
  overflow-y: hidden;

  padding: 3px 2px 11px;
  -webkit-overflow-scrolling: touch;

  cursor: default;
  scroll-snap-type: none;
}

#abcIndice button{
  white-space: nowrap;
  flex: 0 0 auto;
  line-height: 1.05;
  padding: 8px 12px;
  border-radius: 999px;
  border: 2px solid rgba(0,0,0,.82);
  background:#fff;
  color:#000;
  font-weight:800;
}

/* ✅ scrollbar visible */
#abcIndice::-webkit-scrollbar{ height: 10px; }
#abcIndice::-webkit-scrollbar-thumb{ background: rgba(0,0,0,.22); border-radius: 999px; }
body.oscuro #abcIndice::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.22); }


/* ================= ABC: GALERÍA + AUDIO STICKY ================= */

#abcStickyBar{
  position: sticky !important;
  top: 0 !important;
  z-index: 9999 !important;

  background: rgba(255,255,255,.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  padding: 7px 10px 8px;
  margin-bottom: 10px;

  border: 1px solid rgba(0,0,0,.06);
  border-radius: 18px;
  overflow: hidden;

  box-shadow: 0 4px 10px rgba(0,0,0,.06);
}

body.oscuro #abcStickyBar{
  background: rgba(255,255,255,.92);
}

/* ✅ galería ABC con scroll visible en PC */
#abcCapWrapper{
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-width: thin;
}

#abcCapWrapper::-webkit-scrollbar{
  height: 8px;
  display: block;
}

#abcCapWrapper::-webkit-scrollbar-track{
  background: rgba(0,0,0,.08);
  border-radius: 999px;
}

#abcCapWrapper::-webkit-scrollbar-thumb{
  background: rgba(0,0,0,.28);
  border-radius: 999px;
}

/* ✅ audio debajo de la galería + botón PDF al costado */
#abcAudioBar{
  background: transparent;
  padding: 4px 0 0;

  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

#abcAudio{
  width: 70%;
  max-width: calc(100% - 54px);
  min-width: 0;
  margin: 0;
  display: block;
  border-radius: 16px;
  flex: 1 1 auto;
}

#abcBtnPDF{
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;

  border: none;
  border-radius: 999px;
  cursor: pointer;

  background: var(--ui-azul-claro, #bcdcff);
  color: #000;

  display: inline-flex;
  align-items: center;
  justify-content: center;

  font-weight: 900;
  box-shadow: 0 4px 12px rgba(0,0,0,.10);
}

#abcBtnPDF:hover{
  background: var(--ui-azul-hover, #a6d0ff);
  color: #000;
}

#abcBtnPDF i{
  font-size: 17px;
  color: #000;
}

@media (max-width: 640px){
  #abcAudioBar{
    gap: 7px;
  }

  #abcBtnPDF{
    width: 42px;
    height: 42px;
    min-width: 42px;
    min-height: 42px;
  }
}

        #abcContenido{
          position: relative;
          isolation: isolate;
          background: transparent !important;
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 14px;
          padding: 14px;
          overflow:hidden;
        }

        #abcContenido::before{
          content:"";
          position:absolute;
          inset:0;
          z-index:0;
          pointer-events:none;
          border-radius: inherit;
          background:#ffffff;
          opacity: var(--va-abc-box-opacity, .92);
        }

        #abcContenido > *{
          position:relative;
          z-index:1;
        }

        /* ✅ En oscuro, el documento queda tipo "hoja" para que SIEMPRE sea legible */
body.oscuro #abcContenido{
  background: transparent !important;
  color: #000000;
  border-color: rgba(0,0,0,.12);
}
body.oscuro #abcContenido::before{
  background:#ffffff;
}
body.oscuro #abcContenido a{ color:#1c6fcb; }

        /* ===== DOC RESPONSIVE (muy importante) ===== */
/* ✅ Bulldozer seguro: elimina ancho fijo tipo 595pt pero NO destruye estilos */
#abcDoc *{
  max-width: 100% !important;
  box-sizing: border-box;
}

/* neutraliza anchos fijos típicos de export Word */
#abcDoc [style*="width:"]{
  max-width: 100% !important;
}
#abcDoc img, #abcDoc table{
  max-width: 100% !important;
  height: auto !important;
}

/* ✅ INTRO como imagen: legible, estable, sin scroll horizontal y sin corte vertical */
body.abc-intro-activa #accionesBiblia,
body.abc-intro-activa #btnMostrarBarra{
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

#abcContenido.abc-contenido-intro,
#abcContenido.abc-es-intro{
  padding: 0 !important;
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  overflow-x: hidden !important;
  overflow-y: visible !important;
  height: auto !important;
  box-sizing: border-box !important;
}

#abcContenido.abc-contenido-intro .abc-intro-imagen-wrap,
#abcContenido.abc-es-intro .abc-intro-imagen-wrap{
  width: 100%;
  max-width: 100%;
  height: auto !important;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #ffffff !important;
  padding: 0 0 12px 0 !important;
  overflow-x: hidden !important;
  overflow-y: visible !important;
  box-sizing: border-box;
}

#abcContenido.abc-contenido-intro .abc-intro-imagen,
#abcContenido.abc-es-intro .abc-intro-imagen{
  display: block;
  width: 100%;
  max-width: none !important;
  height: auto !important;
  flex: 0 0 auto;
  margin: 0 auto;
  border-radius: 10px;
}

@media (max-width: 640px){
  html,
  body{
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
  }

  #abcApp.abc-es-intro,
  #abcWrap.abc-es-intro,
  #abcContenido.abc-es-intro,
  #abcContenido.abc-contenido-intro{
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
    box-sizing: border-box !important;
  }

  #abcWrap.abc-es-intro{
    margin: 0 auto !important;
    padding: 8px 0 90px !important;
    height: auto !important;
  }

  #abcWrap.abc-es-intro #abcStickyBar{
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 auto 14px auto !important;
    padding: 10px 10px 12px !important;
    box-sizing: border-box !important;
    border-radius: 16px !important;
    overflow: hidden !important;
  }

  #abcWrap.abc-es-intro #abcTop{
    padding: 8px 0 10px !important;
  }

  #abcContenido.abc-contenido-intro,
  #abcContenido.abc-es-intro{
    margin: 0 !important;
    padding: 0 !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
    height: auto !important;
  }

#abcContenido.abc-contenido-intro .abc-intro-imagen-wrap,
#abcContenido.abc-es-intro .abc-intro-imagen-wrap{
  width: 100vw !important;
  max-width: 100vw !important;
  margin-left: 50% !important;
  transform: translateX(-50%) !important;
  padding: 0 0 14px 0 !important;
  background: #ffffff !important;
  overflow-x: hidden !important;
  overflow-y: visible !important;
  height: auto !important;
  box-sizing: border-box !important;
}

  /*
    ✅ Zoom ajustado:
    124vw = legible, pero sin cortar letras por los laterales.
    Si luego queda MUY chico: probá 126vw.
    Si todavía corta una letra: bajá a 122vw.
  */
  #abcContenido.abc-contenido-intro .abc-intro-imagen,
  #abcContenido.abc-es-intro .abc-intro-imagen{
    display: block !important;
width: 114vw !important;
    max-width: none !important;
    height: auto !important;
    flex: 0 0 auto !important;
    margin: 0 auto !important;
    border-radius: 0 !important;
    transform: none !important;
  }

  #abcWrap:not(.abc-es-intro){
    max-width: 100% !important;
    margin: 0 !important;
    padding: 8px 0 16px !important;
    box-sizing: border-box !important;
  }

  #abcWrap:not(.abc-es-intro) #abcStickyBar{
    padding-left: 10px !important;
    padding-right: 10px !important;
    box-sizing: border-box !important;
  }

  #abcContenido:not(.abc-es-intro):not(.abc-contenido-intro){
    border-radius: 0 !important;
    border-left: 0 !important;
    border-right: 0 !important;
    padding: 10px !important;
    box-sizing: border-box !important;
  }
}

.abc-intro-final-spacer{
  display: block !important;
  width: 100% !important;
height: 240px !important;
  flex: 0 0 auto !important;
}

@media (max-width: 640px){
  .abc-intro-final-spacer{
height: 260px !important;
  }
}

/* ✅ Tablas: si se pasan, el scroll horizontal queda SOLO dentro de la tabla */
#abcDoc table{
  display: block;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* ✅ BLOQUES ABC: el bloque es el párrafo / li / etc */
.abc-block{
  position: relative;          /* ✅ necesario para pluma absoluta */
  display:block;
  padding: 6px 8px;
  padding-right: 34px;         /* ✅ reserva espacio para la pluma */
  border-radius: 10px;
  margin: 0 0 6px 0;

  line-height: 1.25;           /* ✅ normaliza (evita “saltos” raros) */
}

/* ✅ Pluma en ABC: NO afecta interlineado ni se superpone */
.abc-block .icono-nota{
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%); /* ✅ centrada vertical */
  font-size: 16px;
  line-height: 1;              /* ✅ nunca altera renglones */
  margin: 0;
  opacity: .70;
  color: var(--ui-azul-hover, #1c6fcb);
  -webkit-text-stroke: 0.6px #466966;
  cursor: pointer;
  pointer-events: auto;
}

.abc-block .icono-nota:hover{ opacity: .8; }

body.oscuro .abc-block .icono-nota{
  opacity: .75;
  color: var(--ui-azul-hover);
  -webkit-text-stroke: 0.6px #466966;
}

/* ✅ Forzar tamaño global dentro de ABC aunque Word traiga tamaños */
#abcDoc, #abcDoc *{
  font-size: var(--abc-font, 18px) !important;
}


/* ✅ Forzar tamaño global dentro de ABC aunque Word traiga tamaños */
#abcDoc, #abcDoc *{
  font-size: var(--abc-font, 18px) !important;
}

/* botones modal */
.btn-pri{
  background: var(--ui-azul-claro, #bcdcff);
  border:none; padding:10px 14px; border-radius:12px; cursor:pointer;
}
.btn-pri:hover{ background: var(--ui-azul-hover, #1c6fcb); color:#fff; }

.btn-sec{
  background: rgba(0,0,0,.06);
  border:none; padding:10px 14px; border-radius:12px; cursor:pointer;
}

/* ✅ En ABC: NO borres el fondo del bloque (si no, nunca se ve el resaltado) */
/* Solo limpiamos fondos internos del Word */
.abc-block *{
  background: transparent !important;
  background-color: transparent !important;
}
      </style>

<div id="abcWrap">

  <div id="abcStickyBar">
    <!-- ✅ Índice / galería arriba -->
    <div id="abcTop">
      <div id="abcIndice" aria-label="Índice ABC"></div>
    </div>

    <!-- ✅ Audio debajo del índice + PDF -->
    <div id="abcAudioBar">
      <audio id="abcAudio" controls preload="metadata"></audio>

      <button
        type="button"
        id="abcBtnPDF"
        onclick="abrirOpcionesPDFABC()"
        title="Descargar PDF"
        aria-label="Descargar PDF"
      >
        <i class="fa-solid fa-file-pdf"></i>
      </button>
    </div>
  </div>

  <div id="abcContenido"></div>

</div>
    `;

    construirIndiceABC();
    abcInstalarSwipeCambioTema();
    abcIniciado = true;

    // ✅ IMPORTANTE: acá cargamos progreso y CORTAMOS para no cargar 2 veces
    await abcCargarProgreso();
    return;
}
  // ✅ si ya estaba iniciado, recién acá cargamos tema normal
  abcInstalarSwipeCambioTema();
  await cargarABCTema();
};

function abcEsZonaInteractivaSwipe(target) {
  return !!target?.closest?.(
    "button, input, textarea, select, a, audio, table, #abcIndice, #abcAudioBar, #abcBtnPDF"
  );
}

function abcCambiarTemaSwipe(dir) {
  const nuevo = Math.max(0, Math.min(ABC_TEMAS.length - 1, abcIndex + dir));

  if (nuevo === abcIndex) return;

  abcIndex = nuevo;
  cargarABCTema(true);

  setTimeout(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, 60);
}

function abcInstalarSwipeCambioTema() {
  const host = document.getElementById("abcContenido");
  if (!host || host.dataset.swipeReady === "1") return;

  host.dataset.swipeReady = "1";

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let ultimoWheel = 0;

  host.addEventListener("touchstart", (e) => {
    const t = e.touches?.[0];
    if (!t) return;

    if (abcEsZonaInteractivaSwipe(e.target)) return;

    startX = t.clientX;
    startY = t.clientY;
    startT = Date.now();
  }, { passive: true });

  host.addEventListener("touchend", (e) => {
    const t = e.changedTouches?.[0];
    if (!t || !startT) return;

    if (abcEsZonaInteractivaSwipe(e.target)) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startT;

    startT = 0;

    // ✅ swipe horizontal real: no confundir con scroll vertical
    if (dt > 900) return;
    if (Math.abs(dx) < 70) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.35) return;

    if (dx < 0) {
      abcCambiarTemaSwipe(1);   // izquierda = siguiente
    } else {
      abcCambiarTemaSwipe(-1);  // derecha = anterior
    }
  }, { passive: true });

  // ✅ Trackpad / mouse con desplazamiento horizontal en PC
  host.addEventListener("wheel", (e) => {
    if (abcEsZonaInteractivaSwipe(e.target)) return;

    const dx = e.deltaX || 0;
    const dy = e.deltaY || 0;

    if (Math.abs(dx) < 80) return;
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return;

    const ahora = Date.now();
    if (ahora - ultimoWheel < 700) return;
    ultimoWheel = ahora;

    if (dx > 0) {
      abcCambiarTemaSwipe(1);
    } else {
      abcCambiarTemaSwipe(-1);
    }
  }, { passive: true });
}

function construirIndiceABC() {
  const idx = document.getElementById("abcIndice");
  if (!idx) return;

  idx.innerHTML = "";

  ABC_TEMAS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t.titulo;
    b.onclick = () => {
      abcIndex = i;
      cargarABCTema(true);
    };
    idx.appendChild(b);
  });

  refrescarUIIndice();
}

function refrescarUIIndice() {
  const idx = document.getElementById("abcIndice");
  if (!idx) return;

  const botones = Array.from(idx.querySelectorAll("button"));

  botones.forEach((b, i) => {
    b.classList.toggle("activo", i === abcIndex);
  });

  const act = botones[abcIndex];

  // ✅ IMPORTANTE:
  // NO usamos scrollIntoView porque puede mover la pantalla verticalmente sola.
  // Solo movemos el scroll horizontal del índice.
  if (act) {
    requestAnimationFrame(() => {
      const left = act.offsetLeft - ((idx.clientWidth - act.offsetWidth) / 2);
      idx.scrollTo({
        left: Math.max(0, left),
        behavior: "auto"
      });
    });
  }
}

function abcLimpiarIntroViejaYFijarSticky() {
  document.body.classList.remove("abc-intro-activa");

  // ✅ eliminar el sistema viejo que hacía saltar la barra
  const viejoStyle = document.getElementById("abcStickyMobileFixFinal");
  if (viejoStyle) viejoStyle.remove();

  document.getElementById("abcStickyPlaceholder")?.remove();

  const st = document.createElement("style");
  st.id = "abcStickyMobileFixFinal";
  st.textContent = `
    body.en-abc #abcApp,
    body.en-abc #iglesia-abc,
    body.en-abc #seccion-iglesia,
    body.en-abc #abcWrap{
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      height: auto !important;
      max-height: none !important;
    }

    body.en-abc #abcWrap:not(.abc-es-intro){
      max-width: 980px !important;
      margin: 0 auto !important;
      padding: calc(var(--abc-bar-h, 122px) + 12px) 8px 18px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }

    body.en-abc #abcStickyBar{
      position: fixed !important;
      top: var(--abc-top-fijo, 0px) !important;
      left: max(4px, calc((100vw - 980px) / 2 + 4px)) !important;
      right: max(4px, calc((100vw - 980px) / 2 + 4px)) !important;
      width: auto !important;
      max-width: none !important;

      z-index: 999999 !important;
      margin: 0 !important;

      border-radius: 18px !important;
      overflow: hidden !important;
      box-sizing: border-box !important;

      background: rgba(255,255,255,.72) !important;
      backdrop-filter: blur(6px) !important;
      -webkit-backdrop-filter: blur(6px) !important;

      padding: 7px 10px 8px !important;
      border: 1px solid rgba(0,0,0,.06) !important;
      box-shadow: 0 4px 10px rgba(0,0,0,.06) !important;
    }

    body.en-abc #abcTop{
      padding: 0 0 2px !important;
      gap: 6px !important;
    }

    body.en-abc #abcIndice{
      align-items: center !important;
      padding: 3px 0 11px !important;
      gap: 8px !important;
    }

    body.en-abc #abcIndice button{
      padding: 8px 12px !important;
      font-weight: 800 !important;
      border: 2px solid rgba(0,0,0,.82) !important;
      border-radius: 999px !important;
    }

    body.en-abc #abcAudioBar{
      padding: 3px 0 0 !important;
      gap: 6px !important;
    }

    body.en-abc #abcAudio{
      width: 100% !important;
      max-width: calc(100% - 48px) !important;
    }

    body.en-abc #abcBtnPDF{
      width: 40px !important;
      height: 40px !important;
      min-width: 40px !important;
      min-height: 40px !important;
      box-shadow: none !important;
    }

    body.en-abc #abcContenido:not(.abc-es-intro):not(.abc-contenido-intro){
      border-radius: 22px !important;
      border: 1px solid rgba(0,0,0,.10) !important;
      padding: 16px 14px !important;
      margin: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }

    body.en-abc #abcContenido:not(.abc-es-intro):not(.abc-contenido-intro)::before{
      border-radius: inherit !important;
    }

    @media (max-width: 640px){
      body.en-abc #abcWrap:not(.abc-es-intro){
        max-width: 100% !important;
        padding: calc(var(--abc-bar-h, 122px) + 10px) 6px 16px !important;
      }

      body.en-abc #abcStickyBar{
        left: 2px !important;
        right: 2px !important;
      }
    }
  `;
  document.head.appendChild(st);

  const app = document.getElementById("abcApp");
  const iglesiaABC = document.getElementById("iglesia-abc");
  const seccionIglesia = document.getElementById("seccion-iglesia");
  const wrap = document.getElementById("abcWrap");
  const cont = document.getElementById("abcContenido");
  const sticky = document.getElementById("abcStickyBar");

  [app, iglesiaABC, seccionIglesia, wrap, cont].filter(Boolean).forEach(el => {
    el.classList.remove("abc-es-intro", "abc-contenido-intro");

    el.style.removeProperty("overflow");
    el.style.removeProperty("overflow-x");
    el.style.removeProperty("overflow-y");
    el.style.removeProperty("height");
    el.style.removeProperty("max-height");
  });

  [app, iglesiaABC, seccionIglesia, wrap].filter(Boolean).forEach(el => {
    el.style.setProperty("overflow", "visible", "important");
    el.style.setProperty("overflow-x", "visible", "important");
    el.style.setProperty("overflow-y", "visible", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("max-height", "none", "important");
  });

  if (cont) {
    cont.style.removeProperty("margin");
    cont.style.removeProperty("width");
    cont.style.removeProperty("max-width");
    cont.style.removeProperty("transform");

    cont.style.setProperty("border-radius", "22px", "important");
    cont.style.setProperty("overflow", "hidden", "important");
  }

  if (sticky) {
    sticky.classList.remove("abc-bar-fija-real");

    sticky.style.setProperty("position", "fixed", "important");
    sticky.style.setProperty("z-index", "999999", "important");
    sticky.style.setProperty("top", "var(--abc-top-fijo, 0px)", "important");
    sticky.style.setProperty("left", "max(4px, calc((100vw - 980px) / 2 + 4px))", "important");
    sticky.style.setProperty("right", "max(4px, calc((100vw - 980px) / 2 + 4px))", "important");
    sticky.style.setProperty("width", "auto", "important");
  }

  abcMedirBarraFijaSimple();
}

function abcMedirBarraFijaSimple() {
  const sticky = document.getElementById("abcStickyBar");
  if (!sticky) return;

  const medir = () => {
    const h = Math.ceil(sticky.getBoundingClientRect().height || 122);
    document.documentElement.style.setProperty("--abc-bar-h", `${h}px`);

    // Si alguna vez querés que quede debajo del header principal, acá se cambia.
    // Por ahora queda arriba fijo, sin saltos.
    document.documentElement.style.setProperty("--abc-top-fijo", "0px");
  };

  medir();
  setTimeout(medir, 80);
  setTimeout(medir, 300);

  if (!window.__abcBarraFijaSimpleReady) {
    window.__abcBarraFijaSimpleReady = true;
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", () => setTimeout(medir, 250));
  }
}

function abcSetIntroActiva(esIntro){
  const activo = !!esIntro;

  document.body.classList.toggle("abc-intro-activa", activo);

  const app = document.getElementById("abcApp");
  const wrap = document.getElementById("abcWrap");
  const cont = document.getElementById("abcContenido");

  [app, wrap, cont].forEach(el => {
    if (!el) return;
    el.classList.toggle("abc-es-intro", activo);
  });

  if (activo) {
    requestAnimationFrame(abcAplicarIntroEstable);
  } else {
    abcLimpiarIntroViejaYFijarSticky();
  }
}

function abcAplicarIntroEstable(){
  const cont = document.getElementById("abcContenido");
  const wrap = document.querySelector("#abcContenido .abc-intro-imagen-wrap");
  const img  = document.querySelector("#abcContenido .abc-intro-imagen");
  const abcWrap = document.getElementById("abcWrap");
  const iglesiaABC = document.getElementById("iglesia-abc");

  if (!cont || !wrap || !img) return;

  const esCel = window.matchMedia("(max-width: 640px)").matches;

  cont.classList.add("abc-contenido-intro", "abc-es-intro");
  if (abcWrap) abcWrap.classList.add("abc-es-intro");

  [cont, abcWrap, iglesiaABC].forEach(el => {
    if (!el) return;
    el.style.setProperty("overflow-x", "hidden", "important");
    el.style.setProperty("overflow-y", "visible", "important");
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("box-sizing", "border-box", "important");
  });

  cont.style.setProperty("padding", "0", "important");
  cont.style.setProperty("border", "none", "important");
  cont.style.setProperty("border-radius", "0", "important");
  cont.style.setProperty("background", "transparent", "important");

  if (abcWrap) {
    abcWrap.style.setProperty("padding-bottom", esCel ? "150px" : "110px", "important");
  }

  if (iglesiaABC) {
    iglesiaABC.style.setProperty("padding-bottom", esCel ? "150px" : "110px", "important");
  }

  wrap.style.setProperty("display", "flex", "important");
  wrap.style.setProperty("justify-content", "center", "important");
  wrap.style.setProperty("align-items", "flex-start", "important");
// ✅ margen blanco REAL al final de la hoja de intro
wrap.style.setProperty("padding", esCel ? "0 0 14px 0" : "0 0 12px 0", "important");
wrap.style.setProperty("background", "#ffffff", "important");
wrap.style.setProperty("border-radius", esCel ? "0" : "10px", "important");
  wrap.style.setProperty("height", "auto", "important");
  wrap.style.setProperty("overflow-x", "hidden", "important");
  wrap.style.setProperty("overflow-y", "visible", "important");
  wrap.style.setProperty("box-sizing", "border-box", "important");

  if (esCel) {
    wrap.style.setProperty("width", "100vw", "important");
    wrap.style.setProperty("max-width", "100vw", "important");
    wrap.style.setProperty("margin-left", "50%", "important");
    wrap.style.setProperty("transform", "translateX(-50%)", "important");
  } else {
    wrap.style.setProperty("width", "100%", "important");
    wrap.style.setProperty("max-width", "100%", "important");
    wrap.style.setProperty("margin-left", "0", "important");
    wrap.style.setProperty("transform", "none", "important");
  }

  img.style.setProperty("display", "block", "important");
  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("height", "auto", "important");
  img.style.setProperty("flex", "0 0 auto", "important");
img.style.setProperty("margin", "0 auto 0 auto", "important");
  img.style.setProperty("transform", "none", "important");

  if (esCel) {
    // Antes 124vw: todavía cortaba una letra del título.
  img.style.setProperty("width", "114vw", "important");
    img.style.setProperty("border-radius", "0", "important");
  } else {
    // Antes 106%: en PC quedaba muy al borde.
  img.style.setProperty("width", "100%", "important");
    img.style.setProperty("border-radius", "10px", "important");
  }
}

async function cargarABCTema(desdeIndice = false) {
  const tema = ABC_TEMAS[abcIndex];
  if (!tema) return;

  refrescarUIIndice();

  const audio = document.getElementById("abcAudio");
  if (audio) {
    audio.src = tema.audio || "";
  }

  const cont = document.getElementById("abcContenido");
  if (!cont) return;

  // ✅ Ya no usamos intro como imagen.
  abcSetIntroActiva(false);
    abcLimpiarIntroViejaYFijarSticky();

  cont.classList.remove("abc-contenido-intro", "abc-es-intro");
  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    if (!tema.html) {
      throw new Error("Este tema no tiene archivo HTML configurado");
    }

    const r = await fetch(tema.html, { cache: "no-store" });

    if (!r.ok) {
      throw new Error("No se pudo abrir el HTML");
    }

    const raw = await r.text();
    const parsed = new DOMParser().parseFromString(raw, "text/html");

    // ✅ preserva estilos del Word
    const headExtras = [
      ...Array.from(parsed.querySelectorAll('link[rel="stylesheet"]')).map(l => l.outerHTML),
      ...Array.from(parsed.querySelectorAll("style")).map(s => s.outerHTML)
    ].join("\n");

    const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;

    cont.innerHTML = `
      ${headExtras}
      <div id="abcDoc">${bodyHTML}</div>
    `;

    abcPrepararBloques();
    abcAplicarFontSize();

    // ✅ 1) cargá marcadores ANTES de armar bloqueados/plumas
    await abcAsegurarMarcadoresCargados();

    // ✅ 2) armá bloqueados inmediatamente
    abcRebuildBloqueadosKeep();

    // ✅ 3) pintá plumas / selección
    abcMarcarSeleccionUI();

    // ✅ 4) escuchá resaltados
    abcEscucharResaltados();

    abcGuardarProgreso();

  } catch (e) {
    cont.innerHTML = `
      <div style="padding:12px; border-radius:12px; background:rgba(217,83,79,.12); color:inherit;">
        ❌ No pude cargar el contenido de este tema.<br>
        Revisá si existe el archivo:<br>
        <code style="font-size:12px;">${tema.html || "sin archivo HTML"}</code>
      </div>
    `;
    console.error(e);
  }
}

/* ================= ABC - PDF PRECARGADO ================= */

function abcNombreDescarga(nombre = "ABC") {
  return String(nombre || "ABC")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) + ".pdf";
}

function abcDescargarArchivo(url, nombreArchivo) {
  if (!url) {
    alert("No encontré el PDF para descargar.");
    return;
  }

  const a = document.createElement("a");
  a.href = encodeURI(url);
  a.download = nombreArchivo || "ABC.pdf";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

window.abrirOpcionesPDFABC = (index = abcIndex) => {
  const tema = ABC_TEMAS[index];

  if (!tema) {
    alert("No encontré este módulo ABC.");
    return;
  }

  const viejo = document.getElementById("abcPdfModal");
  if (viejo) viejo.remove();

  const modal = document.createElement("div");
  modal.id = "abcPdfModal";

  modal.innerHTML = `
    <div class="abc-pdf-backdrop" onclick="cerrarOpcionesPDFABC()"></div>

    <div class="abc-pdf-box" role="dialog" aria-modal="true">
      <button type="button" class="abc-pdf-x" onclick="cerrarOpcionesPDFABC()">×</button>

      <div class="abc-pdf-title">
        Descargar PDF
      </div>

      <div class="abc-pdf-sub">
        Elegí qué querés descargar.
      </div>

      <button type="button" class="abc-pdf-opcion" onclick="descargarPDFABCActual(${index})">
        <i class="fa-solid fa-file-pdf"></i>
        <span>Módulo actual</span>
      </button>

      <button type="button" class="abc-pdf-opcion" onclick="descargarPDFABCCompleto()">
        <i class="fa-solid fa-layer-group"></i>
        <span>ABC completo</span>
      </button>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "abcPdfModalStyle";
  style.textContent = `
    #abcPdfModal{
      position:fixed;
      inset:0;
      z-index:999999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
    }

    #abcPdfModal .abc-pdf-backdrop{
      position:absolute;
      inset:0;
      background:rgba(0,0,0,.45);
    }

    #abcPdfModal .abc-pdf-box{
      position:relative;
      width:min(360px, 94vw);
      background:#fff;
      color:#000;
      border-radius:20px;
      padding:18px;
      box-shadow:0 18px 55px rgba(0,0,0,.30);
      display:grid;
      gap:10px;
    }

    #abcPdfModal .abc-pdf-x{
      position:absolute;
      top:8px;
      right:10px;
      width:34px;
      height:34px;
      border:none;
      border-radius:999px;
      background:rgba(0,0,0,.06);
      color:#000;
      cursor:pointer;
      font-size:24px;
      line-height:1;
    }

    #abcPdfModal .abc-pdf-title{
      font-size:20px;
      font-weight:900;
      padding-right:36px;
    }

    #abcPdfModal .abc-pdf-sub{
      font-size:14px;
      opacity:.75;
      margin-bottom:6px;
    }

    #abcPdfModal .abc-pdf-opcion{
      width:100%;
      border:none;
      border-radius:16px;
      padding:14px;
      background:var(--ui-azul-claro, #bcdcff);
      color:#000;
      cursor:pointer;
      font-weight:900;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      font-size:15px;
    }

    #abcPdfModal .abc-pdf-opcion:hover{
      background:var(--ui-azul-hover, #1c6fcb);
      color:#fff;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);
};

window.cerrarOpcionesPDFABC = () => {
  const modal = document.getElementById("abcPdfModal");
  const style = document.getElementById("abcPdfModalStyle");

  if (modal) modal.remove();
  if (style) style.remove();
};

window.descargarPDFABCActual = (index = abcIndex) => {
  const tema = ABC_TEMAS[index];

  if (!tema?.pdf) {
    alert("Este módulo todavía no tiene PDF cargado.");
    return;
  }

  abcDescargarArchivo(tema.pdf, abcNombreDescarga(tema.titulo || "ABC"));
  cerrarOpcionesPDFABC();
};

window.descargarPDFABCCompleto = () => {
  abcDescargarArchivo(ABC_PDF_COMPLETO, "ABC_COMPLETO.pdf");
  cerrarOpcionesPDFABC();
};

// ================= ABC: FIREBASE + BLOQUES =================
const FB = () => window.__FB || {};
const API = () => window.__FB_API || {};
const UID = () => {
  if (typeof window.__UID === "function") return window.__UID();
  return window.__UID || null;
};
function abcPath(base){ return `${base}/${UID()}`; }

// =====================================================
// ✅ ABC: PROGRESO (último tema) + RESALTADOS por bloque
// =====================================================

// ----- PROGRESO -----
async function abcGuardarProgreso(){
  try{
    const uid = UID(); if(!uid) return;
    const { db } = FB();
    const { ref, set } = API();
    if(!db || !ref || !set) return;

    await set(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`), abcIndex);
  } catch (e){
    console.warn("⚠️ No se pudo guardar progreso ABC:", e?.code || e?.message || e);
  }
}

async function abcCargarProgreso(){
  const uid = UID();
  // si no hay login: arrancá en 0 y cargá tema igual
  if(!uid){ abcIndex = 0; await cargarABCTema(); return; }

  const { db } = FB();
  const { ref, get } = API();
  if(!db || !ref || !get){ abcIndex = 0; await cargarABCTema(); return; }

  try{
    const snap = await get(ref(db, `${abcPath("abcProgreso")}/ultimoIndex`));
    const v = snap.exists() ? snap.val() : null;

    if (typeof v === "number" && v >= 0 && v < ABC_TEMAS.length) abcIndex = v;
    else abcIndex = 0;

    await cargarABCTema();
  }catch(e){
    abcIndex = 0;
    await cargarABCTema();
  }
}

function abcResaltadorGlobalBloqueado(){
  // ✅ ABC usa EXACTAMENTE el mismo lock real que Biblia
  // (no depende de clases CSS ni del DOM de la paleta)
  return !!window.resaltadorBloqueado;
}

// ----- RESALTADOS -----
async function abcSetResaltado(bid, color){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, set } = API();
  if(!db || !ref || !set) return;

  await set(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`), { color });
}

async function abcQuitarResaltado(bid){
  const uid = UID(); if(!uid || !bid) return;
  const { db } = FB();
  const { ref, remove } = API();
  if(!db || !ref || !remove) return;

  await remove(ref(db, `${abcPath("abcResaltados")}/${abcIndex}/${bid}`));
}

function abcLimpiarFondoBloque(el){
  if (!el) return;

  // padre
  el.style.setProperty("background", "transparent", "important");
  el.style.setProperty("background-color", "transparent", "important");

  // hijos internos del html exportado
  el.querySelectorAll("*").forEach(x => {
    x.style.setProperty("background", "transparent", "important");
    x.style.setProperty("background-color", "transparent", "important");
  });
}

function abcAplicarFondoBloque(el, color){
  if (!el) return;

  // el color va SOLO al bloque padre
  el.style.setProperty("background", color, "important");
  el.style.setProperty("background-color", color, "important");

  // todo lo interno del Word queda transparente
  el.querySelectorAll("*").forEach(x => {
    x.style.setProperty("background", "transparent", "important");
    x.style.setProperty("background-color", "transparent", "important");
  });
}

function abcAplicarResaltadosEnPantalla(data){
  const doc = document.getElementById("abcDoc");
  if(!doc) return;

  Object.entries(data || {}).forEach(([bid, obj]) => {
    const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
    if (el && obj?.color) abcAplicarFondoBloque(el, obj.color);
  });
}

let abcUnsubResaltados = null;

function abcEscucharResaltados(){
  const uid = UID(); if(!uid) return;
  const { db } = FB();
  const { ref, onValue, off } = API();
  if(!db || !ref || !onValue) return;

  // cortar escucha anterior
  try{ if (abcUnsubResaltados) abcUnsubResaltados(); }catch(e){}

  const r = ref(db, `${abcPath("abcResaltados")}/${abcIndex}`);

  const handler = async (snap) => {
    const data = snap.val() || {};

abcResaltadosCache = data;
window.abcResaltadosCache = abcResaltadosCache;

    // limpiar pantalla primero
    const doc = document.getElementById("abcDoc");
    if (doc) doc.querySelectorAll(".abc-block").forEach(el => abcLimpiarFondoBloque(el));

    // volver a aplicar resaltados
    abcAplicarResaltadosEnPantalla(data);

    // ✅ asegurar marcadores cargados (para poder bloquear)
    if ((!window.marcadores || !Object.keys(window.marcadores).length) &&
        typeof abcAsegurarMarcadoresCargados === "function") {
      await abcAsegurarMarcadoresCargados();
    }

    // 🔒 reconstruir bloqueados keep desde marcadores
    abcBloqueadosKeep.clear();

    const marcadores = window.marcadores || {};
    for (const m of Object.values(marcadores)) {
      if (m?.origen !== "abc") continue;
      if ((m?.abc?.temaIndex ?? null) !== abcIndex) continue;
      if (!m?.keep) continue;

      // nuevo formato (varios bloques)
      if (Array.isArray(m?.abcBids)) {
        m.abcBids.forEach(b => abcBloqueadosKeep.add(b));
      }

      // compatibilidad con notas viejas
      if (m?.abcBid) {
        abcBloqueadosKeep.add(m.abcBid);
      }
    }

    // ✅ y de paso refrescamos plumas cuando se actualiza todo
    if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
    // ✅ por si cambió keep / bloques desde otro lado
    abcRebuildBloqueadosKeep();
  };

  onValue(r, handler);

  abcUnsubResaltados = () => {
    try { off(r, "value", handler); } catch(e){}
  };
}

async function abcAsegurarMarcadoresCargados(){
  if (window.marcadores && Object.keys(window.marcadores).length) return true;

  try{
    const uid = UID();
    const { db } = FB();
    const { ref, get } = API();
    if (!uid || !db || !ref || !get) return false;

    const snap = await get(ref(db, `marcadores/${uid}`));
    window.marcadores = snap.exists() ? (snap.val() || {}) : {};
    return true;
  }catch(e){
    console.warn("No pude cargar marcadores:", e);
    return false;
  }
}

// =====================================================
// ✅ ABC: selección múltiple + NOTAS usando el MISMO modalMarcadores (Biblia)
// =====================================================

// tamaño fuente ABC (persistente en memoria)
window.abcFontSize = window.abcFontSize || 18;

// estado
let abcModoMarcador = false;

// selección múltiple
let abcSeleccionados = new Set();
let abcSeleccionado = null;

// -------------------------
// ABC: helpers UI
// -------------------------
function estoyEnABC(){
  const sec = document.getElementById("seccion-iglesia");
  const abc = document.getElementById("iglesia-abc");
  return !!(sec && sec.style.display !== "none" && abc && abc.style.display !== "none");
}

function abcAplicarFontSize(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;
  doc.style.setProperty("--abc-font", (window.abcFontSize || 18) + "px");
}

function abcToast(msg, ms = 1600){
  if (typeof window.mostrarToast === "function") return window.mostrarToast(msg);

  let t = document.getElementById("abcToast");
  if (!t){
    t = document.createElement("div");
    t.id = "abcToast";
    t.style.position = "fixed";
    t.style.left = "50%";
    t.style.transform = "translateX(-50%)";
    t.style.bottom = "86px";
    t.style.zIndex = "10000";
    t.style.padding = "10px 14px";
    t.style.borderRadius = "999px";
    t.style.background = "rgba(0,0,0,.80)";
    t.style.color = "#fff";
    t.style.fontSize = "14px";
    t.style.maxWidth = "92vw";
    t.style.textAlign = "center";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(window.__abcToastTimer);
  window.__abcToastTimer = setTimeout(() => (t.style.display = "none"), ms);
}

function abcRebuildBloqueadosKeep(){
  abcBloqueadosKeep.clear();
  const marcadores = window.marcadores || {};

  for (const m of Object.values(marcadores)) {
    if (m?.origen !== "abc") continue;
    if ((m?.abc?.temaIndex ?? null) !== abcIndex) continue;
    if (!m?.keep) continue;

    if (Array.isArray(m?.abcBids)) {
      m.abcBids.forEach(b => abcBloqueadosKeep.add(b));
    }
    if (m?.abcBid) {
      abcBloqueadosKeep.add(m.abcBid);
    }
  }
}

// -------------------------
// ✅ BLOQUES ABC: click
// -------------------------
function abcPrepararBloques() {
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  const targets = doc.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote");
  let n = 0;

  targets.forEach(el => {
    if (el.closest("table")) return;
    if (el.classList.contains("abc-block")) return;

    const id = `t${abcIndex}_b${n++}`;
    el.classList.add("abc-block");
    el.dataset.bid = id;
  });

  // refresco visual inicial
  abcMarcarSeleccionUI();
  abcHabilitarCheckUI();

  doc.onclick = async (e) => {
    // si tocó la pluma, no hagas nada acá
    if (e.target.closest(".icono-nota")) return;

    const b = e.target.closest(".abc-block");
    if (!b) return;

    const bid = b.dataset.bid;

    // requiere login
    const uid = UID();
    const loginModal = document.getElementById("loginModal");
    if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

    // modo marcador: selección múltiple
    if (abcModoMarcador) {
      if (abcSeleccionados.has(bid)) abcSeleccionados.delete(bid);
      else abcSeleccionados.add(bid);

      abcSeleccionado = bid;
      abcMarcarSeleccionUI();
    
      abcHabilitarCheckUI();
      return;
    }

    // selección simple visual
    abcSeleccionado = bid;
    abcMarcarSeleccionUI();

    // ✅ asegurar marcadores cargados SIEMPRE antes de decidir bloqueo
    await abcAsegurarMarcadoresCargados();
    abcRebuildBloqueadosKeep();

    // 🔒 bloqueo definitivo (pintar y despintar)
    if (abcBloqueadosKeep.has(bid)) {
      abcToast("🔒 Este bloque está bloqueado por una nota");
      return;
    }

    // 🔒 bloqueo global real (mismo que Biblia)
    if (abcResaltadorGlobalBloqueado()) {
      abcToast("🔒 El resaltador está bloqueado");
      return;
    }

    // toggle resaltado normal
    if (abcResaltadosCache && abcResaltadosCache[bid]) {
      await abcQuitarResaltado(bid);
      abcLimpiarFondoBloque(b);
      return;
    }

    const color = window.colorActual || "#fff3b0";
    await abcSetResaltado(bid, color);
    abcAplicarFondoBloque(b, color);
  };
}

function abcBloqueadoPorKeep(bid){
  const data = window.marcadores || {};

  for (const m of Object.values(data)) {
    if (m?.origen !== "abc") continue;
    if ((m?.abc?.temaIndex ?? null) !== abcIndex) continue;
    if (!m?.keep) continue;

    // nuevo formato (1 nota con varios bloques)
    if (Array.isArray(m?.abcBids) && m.abcBids.includes(bid)) return true;

    // compatibilidad notas viejas (1 bloque)
    if (m?.abcBid && m.abcBid === bid) return true;
  }
  return false;
}

function abcMarcarSeleccionUI(){
  const doc = document.getElementById("abcDoc");
  if (!doc) return;

  doc.querySelectorAll(".abc-block").forEach(b => {
    const bid = b.dataset.bid;

    const sel = abcSeleccionados.has(bid);
    const ultimo = (bid === abcSeleccionado);

    b.style.outline = sel ? "2px solid #4f6fa8" : "none";
    b.style.outlineOffset = "4px";
    b.style.borderRadius = "10px";
    b.style.outlineWidth = (sel && ultimo) ? "3px" : (sel ? "2px" : "");

    // ✅ PLUMA: SOLO en el último bloque de cada nota
    const data = window.marcadores || {};
    let notaIdParaEsteBloque = null;

    for (const [id, m] of Object.entries(data)) {
      if (m?.origen !== "abc") continue;
      if ((m?.abc?.temaIndex ?? null) !== abcIndex) continue;

      // nuevo formato
      if (m?.abcBidLast && m.abcBidLast === bid) {
        notaIdParaEsteBloque = id;
        break;
      }

      // compatibilidad con notas viejas (una por bloque)
      if (m?.abcBid && m.abcBid === bid && !m?.abcBids) {
        notaIdParaEsteBloque = id;
        // no break para priorizar abcBidLast si existe, pero ya cubrimos arriba
      }
    }

    const ya = b.querySelector(".icono-nota");

if (notaIdParaEsteBloque) {
  if (!ya) {
    const ico = document.createElement("i");
    ico.className = "fa-solid fa-comment-dots icono-nota";
    ico.setAttribute("aria-hidden", "true");

    ico.onclick = (e) => {
      e.stopPropagation();
      if (typeof window.abcEditarNota === "function") window.abcEditarNota(notaIdParaEsteBloque);
    };

    b.appendChild(ico);
  } else {
    // ✅ CLAVE: si ya existía (quizás era pluma), lo actualizamos al icono nuevo
    ya.className = "fa-solid fa-comment-dots icono-nota";

    ya.onclick = (e) => {
      e.stopPropagation();
      if (typeof window.abcEditarNota === "function") window.abcEditarNota(notaIdParaEsteBloque);
    };
  }
} else {
  if (ya) ya.remove();
}
  });
}

function abcAbrirNotaDesdePluma(bid){
  const data = window.marcadores || {};
  const nota = Object.values(data).find(m =>
    m?.origen === "abc" &&
    m?.abcBid === bid &&
    m?.abc?.temaIndex === abcIndex
  );

  if (!nota) return;

  // reutilizamos tu función existente
  if (typeof window.abcEditarNota === "function") {
    window.abcEditarNota(nota.id);
  }
}

function abcHabilitarCheckUI(){
  const btnCheck = document.getElementById("btnGuardarMarcador");
  if (!btnCheck) return;

  const habil = abcModoMarcador && abcSeleccionados && abcSeleccionados.size > 0;

  // 🚫 IMPORTANTE: NO usar disabled (si no, el onclick no corre)
  btnCheck.disabled = false;

  // solo look & feel
  btnCheck.style.opacity = habil ? "1" : ".55";
  btnCheck.title = habil ? "Guardar nota" : "Seleccioná al menos 1 bloque (📌)";
}

// -------------------------
// ✅ ABC -> ABRIR modalMarcadores (Biblia) para escribir nota
// -------------------------
function abcAbrirModalBibliaParaNota() {
  if (!abcSeleccionado && abcSeleccionados.size === 0) {
    abcToast("Primero tocá al menos un bloque 🙂");
    return;
  }

  if (abcSeleccionado && !abcSeleccionados.has(abcSeleccionado)) {
    abcSeleccionados.add(abcSeleccionado);
  }

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form  = document.getElementById("formNuevoMarcador");
  const info  = document.getElementById("infoMarcadorNuevo");
  const titulo= document.getElementById("marcadorTitulo");
  const nota  = document.getElementById("marcadorNota");
  const color = document.getElementById("marcadorColor");
  const keep  = document.getElementById("marcadorKeep");
  const btnGuardar = document.getElementById("btnGuardarNuevoMarcador");
  const esEdicionABC = !!window.__abcEditMarcadorId;

  if (!modal || !lista || !form || !info || !titulo || !nota || !color || !keep || !btnGuardar) {
    alert("Falta el modal de Marcadores de Biblia (modalMarcadores) o algún id interno.");
    return;
  }

  lista.style.display = "none";
  form.style.display = "block";

  const temaTitulo = ABC_TEMAS?.[abcIndex]?.titulo || `ABC ${abcIndex}`;
  info.textContent = `ABC · Tema: ${temaTitulo} · Bloques: ${abcSeleccionados.size}`;

titulo.placeholder = "Título (opcional)";

// ✅ SOLO nota nueva abre amarillo.
// ✅ Si estoy editando, NO piso el color viejo.
if (!esEdicionABC) {
  titulo.value = "";
  nota.value = "";

  if (typeof window.syncMarcadorColorUI === "function") {
    window.syncMarcadorColorUI("#fff3b0");
  } else {
    color.value = "#fff3b0";
  }

  keep.checked = true;
}

  window.setMarcadorCtx("abc", {
    abcEditId: window.__abcEditMarcadorId || null
  });

  modal.style.display = "flex";
modal.classList.add("abierto");
modal.setAttribute("aria-hidden", "false");

// ✅ refuerzo visual SOLO para nota nueva.
// En edición NO tocar, porque pisa el color real de la nota vieja.
if (!esEdicionABC) {
  requestAnimationFrame(() => {
    if (typeof window.syncMarcadorColorUI === "function") {
      window.syncMarcadorColorUI("#fff3b0");
    }
  });
}

abcRenderPreviewBloquesMarcador();
  }

function abcRenderPreviewBloquesMarcador() {
  const box = document.getElementById("previewVersiculosMarcador");
  if (!box) return;

  const form = document.getElementById("formNuevoMarcador");
  const formVisible = form && getComputedStyle(form).display !== "none";
  if (!formVisible) {
    box.innerHTML = "";
    return;
  }

  const doc = document.getElementById("abcDoc");
  if (!doc) {
    box.innerHTML = "";
    return;
  }

  const bids = Array.from(abcSeleccionados || []);
  if (!bids.length) {
    box.innerHTML = `<div class="muted">No hay bloques seleccionados.</div>`;
    return;
  }

  const partes = bids.map(bid => {
    const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
    const txt = (el?.innerText || "")
      .replace(/\s+/g, " ")
      .trim();

    return txt ? `<div style="margin-bottom:8px;">${txt}</div>` : "";
  }).filter(Boolean);

  box.innerHTML = partes.join("") || `<div class="muted">No hay bloques seleccionados.</div>`;
}

window.guardarNuevoMarcadorABC = async function() {
  try {
    const uid = UID();
    if (!uid) return;

    const titulo = document.getElementById("marcadorTitulo");
    const nota   = document.getElementById("marcadorNota");
    const color  = document.getElementById("marcadorColor");
    const keep   = document.getElementById("marcadorKeep");

    const t = (titulo?.value || "").trim();
    const n = (nota?.value || "").trim();
    const c = (color?.value || "#fff3b0");
    const k = !!keep?.checked;

    if (!n) {
      abcToast("Escribí una nota 🙏");
      return;
    }

    const { db } = FB();
    const { ref, set } = API();
    if (!db || !ref || !set) return;

    const ahora = Date.now();
    const tema = ABC_TEMAS?.[abcIndex] || {};

    const bids = Array.from(abcSeleccionados || []);
    const lastBid = abcSeleccionado || bids[bids.length - 1];

    if (!bids.length) {
      abcToast("Seleccioná al menos 1 bloque 🙂");
      return;
    }

    const ctx = window.getMarcadorCtx();
    const editId = ctx?.abcEditId || null;
    const id = editId || `abc_${abcIndex}_${ahora}`;

    const previoEdit = editId ? ((window.marcadores || {})[editId] || null) : null;

    // ✅ texto real de los bloques seleccionados
    const doc = document.getElementById("abcDoc");
    const abcTexto = bids.map(bid => {
      const el = doc ? doc.querySelector(`.abc-block[data-bid="${bid}"]`) : null;
      return (el?.innerText || "").replace(/\s+/g, " ").trim();
    }).filter(Boolean).join(" ");

    const data = {
      origen: "abc",
      tipo: "nota",
      fecha: ahora,
      titulo: t,
      nota: n,
      color: c,
      keep: k,

      libro: "",
      capitulo: 0,
      versiculos: [],

      abc: {
        temaIndex: abcIndex,
        temaTitulo: tema.titulo || "",
        html: tema.html || ""
      },

      abcBids: bids,
      abcBidLast: lastBid,
      abcTexto
    };

    await set(ref(db, `marcadores/${uid}/${id}`), data);

    window.marcadores = window.marcadores || {};
    window.marcadores[id] = data;

    if (previoEdit) {
      const prevBids = Array.isArray(previoEdit?.abcBids)
        ? previoEdit.abcBids
        : (previoEdit?.abcBid ? [previoEdit.abcBid] : []);

      for (const bid of prevBids) {
        if (!k || !bids.includes(bid)) {
          try { await abcQuitarResaltado(bid); } catch(e){}
        }
      }
    }

    if (k) {
      for (const bid of bids) {
        await abcSetResaltado(bid, c);
      }
    } else {
      for (const bid of bids) {
        try { await abcQuitarResaltado(bid); } catch(e){}
      }
    }

    abcRebuildBloqueadosKeep();
    abcMarcarSeleccionUI();

    window.__abcEditMarcadorId = null;
    window.setMarcadorCtx("abc", { abcEditId: null });

    abcResetModoMarcador();

    if (typeof cerrarMarcadores === "function") {
      cerrarMarcadores();
    } else {
      const modal = document.getElementById("modalMarcadores");
      if (modal) {
        modal.classList.remove("abierto");
        modal.setAttribute("aria-hidden", "true");
        modal.style.display = "none";
      }
    }

    abcUIEnABC();
    abcAplicarUIAccionesPorModo();
    abcMarcarSeleccionUI();
    abcHabilitarCheckUI();

    abcToast(editId ? "✅ Nota ABC actualizada" : "✅ Nota ABC guardada");
  } catch (e) {
    console.error(e);
    alert("No pude guardar la nota de ABC.");
  }
};
  
async function abcAbrirListaNotasABC(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form  = document.getElementById("formNuevoMarcador");
  if (!modal || !lista || !form) {
    alert("No encontré modalMarcadores (Biblia).");
    return;
  }

  // ✅ mostrar lista
  form.style.display = "none";
  lista.style.display = "block";

  let data = window.marcadores || {};
  let items = Object.entries(data)
    .map(([id, m]) => ({...m, id}))
    .filter(m => m?.origen === "abc")
    .sort((a,b)=> (b.fecha||0) - (a.fecha||0));

  // ✅ fallback directo a Firebase si la cache todavía no está fresca
  if (!items.length) {
    try {
      const { db } = FB();
      const { ref, get } = API();
      if (db && ref && get && uid) {
        const snap = await get(ref(db, `marcadores/${uid}`));
        const fresh = snap.exists() ? (snap.val() || {}) : {};

        window.marcadores = fresh;

        items = Object.entries(fresh)
          .map(([id, m]) => ({...m, id}))
          .filter(m => m?.origen === "abc")
          .sort((a,b)=> (b.fecha||0) - (a.fecha||0));
      }
    } catch (e) {
      console.warn("No pude cargar marcadores desde Firebase:", e);
    }
  }

  if (!items.length){
    lista.innerHTML = `<p class="muted">Todavía no guardaste notas de ABC.</p>`;
  } else {
    lista.innerHTML = items.map(m => {
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleDateString("es-AR") : "";
      const titulo = (m.titulo || "Nota ABC").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const temaTxt = m?.abc?.temaTitulo ? ` · ${m.abc.temaTitulo}` : "";
      const linea = `${titulo}${temaTxt} · ${fechaTxt}`;

      return `
        <div class="card-marcador" style="cursor:pointer; display:flex; justify-content:space-between; gap:10px; align-items:center;">
          <div style="font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" onclick="abcIrANota('${m.id}')">
            ${linea}
          </div>
          <button type="button" class="pm-btn" onclick="abcEditarNota('${m.id}')" title="Editar">✏️</button>
        </div>
      `;
    }).join("");
  }

  // ✅ CLAVE: abrir de verdad
  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden","false");
}

window.abcIrANota = async (id) => {
  const m = (window.marcadores || {})[id];
  if (!m) return;

  // cerrar modal
  if (typeof cerrarMarcadores === "function") cerrarMarcadores();
  else {
    const modal = document.getElementById("modalMarcadores");
    if (modal) { modal.classList.remove("abierto"); modal.setAttribute("aria-hidden","true"); }
  }

  // ir a ABC y al tema
  if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("abc");
  abcIndex = m?.abc?.temaIndex ?? 0;
  await cargarABCTema(true);

  // scrollear al bloque
  const bid = m.abcBidLast || m.abcBid || (Array.isArray(m.abcBids) ? m.abcBids[m.abcBids.length - 1] : null);
  const doc = document.getElementById("abcDoc");
  const el = doc ? doc.querySelector(`.abc-block[data-bid="${bid}"]`) : null;
  if (el && el.scrollIntoView) el.scrollIntoView({behavior:"smooth", block:"center"});

  // dejarlo seleccionado
  abcSeleccionado = bid;
abcSeleccionados.clear();

// ✅ si es nota nueva con varios bloques, seleccionarlos todos
if (Array.isArray(m.abcBids) && m.abcBids.length) {
  m.abcBids.forEach(x => abcSeleccionados.add(x));
} else if (bid) {
  abcSeleccionados.add(bid);
}
  abcMarcarSeleccionUI();
  // ✅ refresca UI del ✓ por si venías de lista
  abcAplicarUIAccionesPorModo();
  abcMarcarSeleccionUI();
};

window.abcEditarNota = async (id) => {
  window.__abcEditMarcadorId = id;
  const m = (window.marcadores || {})[id];
  if (!m) return;
  // ir primero al bloque
  await window.abcIrANota(id);
  // activar modo marcador y abrir form para editar (reusa tu modal)
  abcModoMarcador = true;
  abcAplicarUIAccionesPorModo();
  abcAbrirModalBibliaParaNota();
  // precargar en el form
  const titulo= document.getElementById("marcadorTitulo");
  const nota  = document.getElementById("marcadorNota");
  const color = document.getElementById("marcadorColor");
  const keep  = document.getElementById("marcadorKeep");
  if (titulo) titulo.value = m.titulo || "";
  if (nota)   nota.value = m.nota || "";
  const colorEdit = m.color || "#fff3b0";

if (typeof window.syncMarcadorColorUI === "function") {
  window.syncMarcadorColorUI(colorEdit);
} else if (color) {
  color.value = colorEdit;
}

  requestAnimationFrame(() => {
  if (typeof window.syncMarcadorColorUI === "function") {
    window.syncMarcadorColorUI(colorEdit);
  } else if (color) {
    color.value = colorEdit;
  }
});
  
  if (keep)   keep.checked = !!m.keep;
  abcRenderPreviewBloquesMarcador();
};

// -------------------------
// ✅ ABC: modo marcador ON/OFF
// -------------------------
function abcToggleModoMarcador(){
  const uid = UID();
  const loginModal = document.getElementById("loginModal");
  if (!uid) { if (loginModal) loginModal.style.display = "flex"; return; }

  abcModoMarcador = !abcModoMarcador;

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) {
    btn.classList.toggle("activo", abcModoMarcador);
    btn.blur && btn.blur();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }

  if (!abcModoMarcador) {
    abcSeleccionados.clear();
    abcSeleccionado = null;
    abcMarcarSeleccionUI();
  } else {
    abcToast("📌 Tocá varios bloques y apretá ✓");
  }

  abcAplicarUIAccionesPorModo();
  setTimeout(abcAplicarUIAccionesPorModo, 50);
}

function abcResetModoMarcador() {
  abcModoMarcador = false;

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.remove("activo");

  abcSeleccionados.clear();
  abcSeleccionado = null;

  abcMarcarSeleccionUI();
  abcAplicarUIAccionesPorModo();
}

// -------------------------
// ✅ ABC: barra (solo 📌 + ✓ en modo marcador) - versión blindada
// -------------------------
function abcAplicarUIAccionesPorModo() {
  const bar = document.getElementById("accionesBiblia");
  if (!bar) return;

  const btnPin   = document.getElementById("btnModoMarcadorBarra"); // 📌
  const btnCheck = document.getElementById("btnGuardarMarcador");   // ✓

  // ✅ en ABC: SIEMPRE ocultar imagen/crear imagen (blindado)
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear  = document.getElementById("btnCrearImagen");
  [btnImagen, btnCrear].forEach(el => {
    if (!el) return;
    el.style.display = "none";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
  });

  // Elementos “accionables” dentro de la barra (botones, links, etc.)
  const items = bar.querySelectorAll("button, a, input, .pm-btn, [role='button']");

  // helper: guardar display original una sola vez
  const saveOriginal = (el) => {
    if (!el.dataset) return;
    if (el.dataset.abcDisplaySaved === "1") return;
    el.dataset.abcDisplaySaved = "1";
    el.dataset.abcDisplay = el.style.display; // puede ser "" (vacío)
  };

  // helper: restaurar display original
  const restoreOriginal = (el) => {
    if (!el.dataset) return;
    if (el.dataset.abcDisplaySaved !== "1") return;
    el.style.display = el.dataset.abcDisplay || "";
  };

  if (abcModoMarcador) {
    // ✅ ON: solo 📌 + ✓ visibles
    items.forEach(el => {
      saveOriginal(el);

      const id = el.id || "";
      const esPin = (id === "btnModoMarcadorBarra");
      const esCheck = (id === "btnGuardarMarcador");

      if (esPin || esCheck) {
        // mostrarlos
        el.style.display = "inline-flex";
      } else {
        // ocultar TODO lo demás
        el.style.display = "none";
      }
    });

    // por las dudas, aseguramos
    if (btnPin) btnPin.style.display = "inline-flex";
    if (btnCheck) btnCheck.style.display = "inline-flex";

  } else {
    // ✅ OFF: restaurar todo como estaba (menos imagen/crear imagen)
    items.forEach(el => restoreOriginal(el));

    // ✓ oculto cuando no estoy en modo marcador (como querías)
    if (btnCheck) btnCheck.style.display = "none";

    // 📌 visible
    if (btnPin) btnPin.style.display = "inline-flex";

    // blindaje otra vez: imagen/crear imagen no vuelven
    [btnImagen, btnCrear].forEach(el => {
      if (!el) return;
      el.style.display = "none";
      el.style.visibility = "hidden";
      el.style.pointerEvents = "none";
    });
  }

  // ✅ refresca estado del ✓ (opacidad/tooltip)
  abcHabilitarCheckUI();
}

// -------------------------
// ✅ ABC: portal barra ON/OFF
// -------------------------
let __abcBarParent = null;
let __abcBarNext = null;
let __abcBtnParent = null;
let __abcBtnNext = null;

function abcPortalBarraOn() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");
  if (!bar) return;

  if (!__abcBarParent) {
    __abcBarParent = bar.parentNode;
    __abcBarNext = bar.nextSibling;
  }
  if (btn && !__abcBtnParent) {
    __abcBtnParent = btn.parentNode;
    __abcBtnNext = btn.nextSibling;
  }

  document.body.appendChild(bar);
  if (btn) document.body.appendChild(btn);

bar.style.display = "";
bar.style.visibility = "visible";
bar.style.opacity = "1";
bar.style.position = "fixed";
bar.style.left = "0";
bar.style.right = "0";
bar.style.bottom = "0";
bar.style.zIndex = "9999";

/* ✅ reset de la geometría que en Biblia rompe el padding del contenedor */
bar.style.marginLeft = "0";
bar.style.marginRight = "0";
bar.style.width = "100%";

/* ✅ aire visual solo para ABC */
bar.style.paddingLeft = "10px";
bar.style.paddingRight = "10px";
bar.style.paddingBottom = "max(8px, env(safe-area-inset-bottom))";
bar.style.boxSizing = "border-box";

   // ✅ en ABC: si la barra está visible, el botón flotante NO se muestra
  if (btn) btn.style.display = "none";
}

function abcPortalBarraOff() {
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");

  if (bar && __abcBarParent) {
    if (__abcBarNext) __abcBarParent.insertBefore(bar, __abcBarNext);
    else __abcBarParent.appendChild(bar);

bar.style.position = "";
bar.style.left = "";
bar.style.right = "";
bar.style.bottom = "";
bar.style.zIndex = "";
bar.style.opacity = "";
bar.style.visibility = "";
bar.style.display = "";

bar.style.marginLeft = "";
bar.style.marginRight = "";
bar.style.width = "";

bar.style.paddingLeft = "";
bar.style.paddingRight = "";
bar.style.paddingBottom = "";
bar.style.boxSizing = "";
    
  }

  if (btn && __abcBtnParent) {
    if (__abcBtnNext) __abcBtnParent.insertBefore(btn, __abcBtnNext);
    else __abcBtnParent.appendChild(btn);

    // ✅ vuelve al control normal de Biblia (solo aparece cuando la barra está escondida)
    btn.style.display = "";
  }
}

// ===============================
// ✅ ABC: guardar/restaurar barra Biblia (handlers + estilos)
// ===============================
window.__abcBarBackup = window.__abcBarBackup || {
  saved: false,
  onclick: {},
  style: {}
};

function abcBackupBarBiblia() {
  const pin   = document.getElementById("btnModoMarcadorBarra");
  const check = document.getElementById("btnGuardarMarcador");
  const lista = document.getElementById("btnListaMarcadores");
  const img   = document.getElementById("btnImagen");
  const crear = document.getElementById("btnCrearImagen");

  if (window.__abcBarBackup.saved) return;

  window.__abcBarBackup.onclick = {
    pin:   pin   ? pin.onclick   : null,
    check: check ? check.onclick : null,
    lista: lista ? lista.onclick : null
  };

  // guardo estilos que tocamos (para devolverlos a Biblia)
  window.__abcBarBackup.style = {
    img:   img   ? { display: img.style.display, visibility: img.style.visibility, pointerEvents: img.style.pointerEvents } : null,
    crear: crear ? { display: crear.style.display, visibility: crear.style.visibility, pointerEvents: crear.style.pointerEvents } : null
  };

  window.__abcBarBackup.saved = true;
}

function abcRestoreBarBiblia() {
  const pin   = document.getElementById("btnModoMarcadorBarra");
  const check = document.getElementById("btnGuardarMarcador");
  const lista = document.getElementById("btnListaMarcadores");
  const img   = document.getElementById("btnImagen");
  const crear = document.getElementById("btnCrearImagen");

  if (!window.__abcBarBackup.saved) return;

  // ✅ restaurar onclick originales de Biblia
  if (pin)   pin.onclick   = window.__abcBarBackup.onclick.pin   || null;
  if (check) check.onclick = window.__abcBarBackup.onclick.check || null;
  if (lista) lista.onclick = window.__abcBarBackup.onclick.lista || null;

  // ✅ restaurar estilos (para que Biblia recupere Crear Imagen)
  if (img && window.__abcBarBackup.style.img) {
    img.style.display = window.__abcBarBackup.style.img.display || "";
    img.style.visibility = window.__abcBarBackup.style.img.visibility || "";
    img.style.pointerEvents = window.__abcBarBackup.style.img.pointerEvents || "";
  }
  if (crear && window.__abcBarBackup.style.crear) {
    crear.style.display = window.__abcBarBackup.style.crear.display || "";
    crear.style.visibility = window.__abcBarBackup.style.crear.visibility || "";
    crear.style.pointerEvents = window.__abcBarBackup.style.crear.pointerEvents || "";
  }
}

// -------------------------
// ✅ ABC: enganchar botones de barra
// -------------------------
function abcUIEnABC(){
  // ✅ guardar handlers originales de Biblia ANTES de pisarlos
  abcBackupBarBiblia();

  const btnPin   = document.getElementById("btnModoMarcadorBarra");
  const btnCheck = document.getElementById("btnGuardarMarcador");
  const btnLista = document.getElementById("btnListaMarcadores");

  if (btnPin) {
    btnPin.onclick = (e) => { e.preventDefault(); e.stopPropagation(); abcToggleModoMarcador(); };
  }

  if (btnCheck) {
    btnCheck.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();

      if (!abcModoMarcador) return abcToast("Activá 📌 y seleccioná bloques");
      if (!abcSeleccionados || abcSeleccionados.size === 0) return abcToast("Seleccioná al menos 1 bloque 🙂");

      abcAbrirModalBibliaParaNota();
    };
  }

  if (btnLista) {
    btnLista.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      abcAbrirListaNotasABC();
    };
  }

  abcAplicarUIAccionesPorModo();
}

// -------------------------
// ✅ Hooks ABC
// -------------------------
window.__abcOnEnter = () => {
    abcLimpiarIntroViejaYFijarSticky();
  document.body.classList.add("en-abc");
  resaltadorBloqueado = true;
  window.resaltadorBloqueado = true;

  try {
    const pal = document.getElementById("paletaResaltadores");
    if (pal) pal.style.display = "none";
  } catch(e){}

  abcPortalBarraOn();
  window.forceSyncResaltadorUI?.(25);

  abcAplicarFontSize();

  // ✅ primer enganche inmediato
  abcUIEnABC();
  abcAplicarUIAccionesPorModo();

  // ✅ segundo enganche blindado por si Biblia dejó handlers viejos un frame después
  requestAnimationFrame(() => {
    abcUIEnABC();
    abcAplicarUIAccionesPorModo();
    abcHabilitarCheckUI();
  });

  // ✅ tercer refuerzo
  setTimeout(() => {
    abcUIEnABC();
    abcAplicarUIAccionesPorModo();
    abcHabilitarCheckUI();
  }, 60);

  window.aplicarEstadoBarra?.("abc");
};

window.__abcOnExit = () => {
    document.body.classList.remove("abc-intro-activa");
    document.body.classList.remove("en-abc");
    window.__abcEditMarcadorId = null;
    window.setMarcadorCtx("biblia");
  
  try { abcResetModoMarcador(); } catch(e){}
  abcPortalBarraOff();

  // ✅ devolver handlers y estilos a Biblia
  abcRestoreBarBiblia();

  // ✅ IMPORTANTÍSIMO: limpiar ocultamiento “forzado” que dejó ABC
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear  = document.getElementById("btnCrearImagen");
  [btnImagen, btnCrear].forEach(b => {
    if (!b) return;
    b.style.visibility = "";
    b.style.pointerEvents = "";

  });

  // ✅ si ya estoy en Biblia, que Biblia recalcule qué botones mostrar
  const secBiblia = document.getElementById("seccion-biblia");
  const enBiblia = !!(secBiblia && secBiblia.style.display !== "none");
  if (enBiblia && typeof window.aplicarUIAccionesPorModo === "function") {
    window.aplicarUIAccionesPorModo();
  }

  window.aplicarEstadoBarra?.("biblia");
};
