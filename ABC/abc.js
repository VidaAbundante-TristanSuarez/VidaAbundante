// ================= ABC - MÓDULO =================

const ABC_TEMAS = [
  { titulo: "INTRO", html: "ABC/INTRO.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2Fintro_abc.mp3?alt=media&token=c51321da-2f7f-4092-b90d-a61df6da671a" },
  { titulo: "SALVACIÓN", html: "ABC/1 Salvación.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F1%20Salvaci%C3%B3n.mp3?alt=media&token=7da0ae0f-da01-4a58-8ae0-5e0a037c8076" },
  { titulo: "PECADO", html: "ABC/2 Pecado.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F2%20Pecado.mp3?alt=media&token=54fe4210-37e9-4cf0-b0bf-c7f0564e881f" },
  { titulo: "LA PALABRA", html: "ABC/3 La Palabra.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F3%20La%20Palabra.mp3?alt=media&token=73fbd70f-e008-47de-b557-28fcd6a5ac36" },
  { titulo: "LA ORACIÓN", html: "ABC/4 La Oración.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F4%20La%20Oraci%C3%B3n.mp3?alt=media&token=096b3b09-6179-4c80-8718-a800954907b3" },
  { titulo: "ESPÍRITU SANTO", html: "ABC/5 Espíritu Santo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F5%20Esp%C3%ADritu%20Santo.mp3?alt=media&token=68ad750b-4449-433f-b7dc-be457879c61f" },
  { titulo: "BAUTISMO", html: "ABC/6 Bautismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F6%20Bautismo.mp3?alt=media&token=e85836f1-9f5d-42be-83de-93797cdf3c22" },
  { titulo: "LA MAYORDOMÍA", html: "ABC/7 La Mayordomía.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F7%20La%20Mayordom%C3%ADa.mp3?alt=media&token=4994a81a-be99-4f39-8bd3-9888df880fcf" },
  { titulo: "EVANGELISMO", html: "ABC/8 Evangelismo.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F8%20Evangelismo.mp3?alt=media&token=4d197527-1f36-4378-9389-5e248e44533b" },
  { titulo: "VISIÓN DE LA IGLESIA", html: "ABC/9 La visión de la iglesia.html", audio: "https://firebasestorage.googleapis.com/v0/b/vidaabundante-f118a.firebasestorage.app/o/ABC%2F9%20La%20vision%20de%20la%20iglesia.mp3?alt=media&token=c81cd672-6fd8-46df-b086-e564fed73974" }
];

let abcIndex = 0;
let abcIniciado = false;

// ✅ Esta es la que debe llamar mostrarIglesiaSub('abc')
window.mostrarABC = async () => {
  const cont = document.getElementById("abcApp");
  if (!cont) return;

  // no volver a “rearmar” la UI si ya está
  if (!abcIniciado) {
    cont.innerHTML = `
      <style>
        /* ===== ABC UI (local) ===== */
        #abcWrap{ max-width: 980px; margin: 0 auto; padding: 10px 12px 18px; }
        #abcTop{
          display:flex; align-items:center; gap:10px;
          /* centra visualmente entre tabs y contenido */
          padding: 8px 0 10px;
        }
        #abcIndice{
          flex:1;
          display:flex; gap:8px; overflow-x:auto; overflow-y:hidden;
          padding: 6px 2px;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x proximity;
        }
        #abcIndice::-webkit-scrollbar{ height: 8px; }
        #abcIndice button{
          border:none; cursor:pointer;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(79,111,168,.14);
          color: inherit;
          white-space: nowrap;
          font-weight: 700;
          font-size: 13px;
          scroll-snap-align: start;
        }
        #abcIndice button.activo{
          background: #4f6fa8;
          color: #fff;
        }

        #abcNav{
          display:flex; gap:8px; align-items:center;
          justify-content:flex-end;
          min-width: 86px;
        }
        #abcNav button{
          border:none; background: transparent; cursor:pointer;
          font-size: 26px;
          padding: 6px;
          line-height: 1;
          color: #4f6fa8;
        }
        #abcNav button:disabled{ opacity:.35; cursor:default; }

        #abcAudio{
          width:100%;
          margin: 8px 0 12px;
        }

        #abcContenido{
          background: #fff;
          border: 1px solid rgba(0,0,0,.10);
          border-radius: 14px;
          padding: 14px;
          overflow:hidden;
        }

        /* modo oscuro (sin tocar biblia) */
        body.oscuro #abcContenido{
          background: rgba(255,255,255,.06);
          border-color: rgba(255,255,255,.12);
        }

        /* ===== DOC RESPONSIVE (muy importante) ===== */
#abcDoc{
  width:100%;
  max-width:100%;
  margin:0;
  padding:0;
  overflow-x:hidden;
}

/* quitar márgenes heredados del Word */
#abcDoc *{
  max-width:100% !important;
}

/* párrafos y títulos sin margen lateral exagerado */
#abcDoc p,
#abcDoc h1,
#abcDoc h2,
#abcDoc h3,
#abcDoc h4,
#abcDoc h5,
#abcDoc h6{
  margin-left:0 !important;
  margin-right:0 !important;
}

/* imágenes adaptables */
#abcDoc img{
  max-width:100% !important;
  height:auto !important;
}

/* tablas adaptables */
#abcDoc table{
  width:100% !important;
  display:block;
  overflow-x:auto;
}
      </style>

      <div id="abcWrap">
        <!-- Índice + navegación (debajo de tabs de Iglesia) -->
        <div id="abcTop">
          <div id="abcIndice" aria-label="Índice ABC"></div>

          <div id="abcNav">
            <button id="abcBtnPrev" type="button" title="Anterior" onclick="abcPrev()">
              <i class="fa-solid fa-circle-chevron-left"></i>
            </button>
            <button id="abcBtnNext" type="button" title="Siguiente" onclick="abcNext()">
              <i class="fa-solid fa-circle-chevron-right"></i>
            </button>
          </div>
        </div>

        <audio id="abcAudio" controls preload="metadata"></audio>

        <div id="abcContenido"></div>
      </div>
    `;

    construirIndiceABC();
    abcIniciado = true;
  }

  await cargarABCTema();
};

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
  // botones índice
  const idx = document.getElementById("abcIndice");
  if (idx) {
    Array.from(idx.querySelectorAll("button")).forEach((b, i) => {
      b.classList.toggle("activo", i === abcIndex);
    });

    // mantener visible el activo
    const act = idx.querySelectorAll("button")[abcIndex];
    if (act && act.scrollIntoView) {
      act.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  // prev/next
  const prev = document.getElementById("abcBtnPrev");
  const next = document.getElementById("abcBtnNext");
  if (prev) prev.disabled = (abcIndex === 0);
  if (next) next.disabled = (abcIndex === ABC_TEMAS.length - 1);
}

async function cargarABCTema(desdeIndice = false) {
  const tema = ABC_TEMAS[abcIndex];
  if (!tema) return;

  refrescarUIIndice();

  const audio = document.getElementById("abcAudio");
  if (audio) {
    audio.src = tema.audio;
    // si tocó un botón del índice, generalmente quiere escuchar/leer ya.
    // no auto-play por respeto a navegador; pero dejamos listo.
  }

  const cont = document.getElementById("abcContenido");
  if (!cont) return;

  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo abrir el HTML");

    const html = await r.text();

    // ✅ metemos el HTML exportado dentro. (si trae <html> completo, igual lo muestra)
    cont.innerHTML = `<div id="abcDoc">${html}</div>`;

  } catch (e) {
    cont.innerHTML = `
      <div style="padding:12px; border-radius:12px; background:rgba(217,83,79,.12); color:inherit;">
        ❌ No pude cargar el contenido de este tema.<br>
        Revisá si existe el archivo:<br>
        <code style="font-size:12px;">${tema.html}</code>
      </div>
    `;
    console.error(e);
  }
}

window.abcNext = () => {
  if (abcIndex < ABC_TEMAS.length - 1) {
    abcIndex++;
    cargarABCTema();
  }
};

window.abcPrev = () => {
  if (abcIndex > 0) {
    abcIndex--;
    cargarABCTema();
  }
};
