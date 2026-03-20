// ================= RECURSOS - MÓDULO =================

const RH_TEMAS = [
  {
    titulo: "El Paralítico de Betesda",
    html: "materiales/RH/El Paralítico de Betesda.html",
    audio: "materiales/RH/El Paralítico de Betesda.mp3"
  }
];

let rhIndex = 0;
let rhIniciado = false;

// ✅ abrir RH por defecto
window.mostrarRecursosSub = async (sub) => {
  const rh = document.getElementById("recursos-rh");
  const talleres = document.getElementById("recursos-talleres");

  if (rh) rh.style.display = (sub === "rh") ? "block" : "none";
  if (talleres) talleres.style.display = (sub === "talleres") ? "block" : "none";

  const wrap = document.getElementById("iglesia-recursos");
  if (wrap) {
    wrap.querySelectorAll(".panel-tabs button").forEach(b => b.classList.remove("activo"));
    const btn = wrap.querySelector(`[onclick="mostrarRecursosSub('${sub}')"]`);
    if (btn) btn.classList.add("activo");
  }

  if (sub === "rh") {
    await mostrarRH();
  }
};

window.mostrarRH = async () => {
  const cont = document.getElementById("rhApp");
  if (!cont) return;

  if (!rhIniciado) {
    cont.innerHTML = `
      <style>
        #rhWrap{
          max-width: 980px;
          margin: 0 auto;
          padding: 10px 12px 18px;
        }

        #rhTop{
          display:flex;
          align-items:center;
          gap:10px;
          padding: 8px 0 10px;
        }

        #rhIndice{
          flex:1;
          display:flex;
          gap:8px;
          overflow-x:scroll;
          overflow-y:hidden;
          padding:6px 2px;
          -webkit-overflow-scrolling: touch;
          cursor: default;
        }

        #rhIndice button{
          white-space: nowrap;
          flex: 0 0 auto;
          line-height: 1.05;
          padding: 8px 10px;
          border-radius: 999px;
          border:none;
          cursor:pointer;
          background: var(--ui-azul-claro, #bcdcff);
          color:#000;
          font-weight:700;
        }

        #rhIndice button.activo{
          background: var(--ui-azul-hover, #1c6fcb);
          color:#fff;
        }

        #rhIndice::-webkit-scrollbar{ height: 10px; }
        #rhIndice::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.22);
          border-radius:999px;
        }

        #rhAudioBar{
          position: sticky;
          top: 0;
          z-index: 50;
          background: #fff;
          padding: 8px 0 10px;
          border-bottom: 1px solid rgba(0,0,0,.08);
        }

        body.oscuro #rhAudioBar{
          background:#fff;
        }

        #rhAudio{
          width:100%;
          margin:0;
        }

        #rhContenido{
          background:#fff;
          border:1px solid rgba(0,0,0,.10);
          border-radius:14px;
          padding:14px;
          overflow:hidden;
        }

        body.oscuro #rhContenido{
          background:#fff;
          color:#000;
          border-color: rgba(0,0,0,.12);
        }

        #rhDoc *{
          max-width:100% !important;
          box-sizing:border-box;
        }

        #rhDoc [style*="width:"]{
          max-width:100% !important;
        }

        #rhDoc img,
        #rhDoc table{
          max-width:100% !important;
          height:auto !important;
        }

        #rhDoc table{
          display:block;
          overflow-x:auto;
          -webkit-overflow-scrolling:touch;
        }

        @media (max-width: 640px){
          #rhWrap{
            max-width:100%;
            margin:0;
            padding:8px 0 16px;
          }

          #rhTop{
            padding-left:10px;
            padding-right:10px;
          }

          #rhAudioBar{
            padding-left:10px;
            padding-right:10px;
          }

          #rhContenido{
            border-radius:0;
            border-left:0;
            border-right:0;
            padding:10px;
          }
        }
      </style>

      <div id="rhWrap">

        <div id="rhAudioBar">
          <audio id="rhAudio" controls preload="metadata"></audio>
        </div>

        <div id="rhTop">
          <div id="rhIndice" aria-label="Índice RH"></div>
        </div>

        <div id="rhContenido"></div>
      </div>
    `;

    construirIndiceRH();
    rhIniciado = true;
  }

  await cargarRHTema();
};

function construirIndiceRH() {
  const idx = document.getElementById("rhIndice");
  if (!idx) return;

  idx.innerHTML = "";

  RH_TEMAS.forEach((t, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = t.titulo;
    b.onclick = () => {
      rhIndex = i;
      cargarRHTema(true);
    };
    idx.appendChild(b);
  });

  refrescarUIIndiceRH();
}

function refrescarUIIndiceRH() {
  const idx = document.getElementById("rhIndice");
  if (!idx) return;

  Array.from(idx.querySelectorAll("button")).forEach((b, i) => {
    b.classList.toggle("activo", i === rhIndex);
  });

  const act = idx.querySelectorAll("button")[rhIndex];
  if (act && act.scrollIntoView) {
    act.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

async function cargarRHTema() {
  const tema = RH_TEMAS[rhIndex];
  if (!tema) return;

  refrescarUIIndiceRH();

  const audio = document.getElementById("rhAudio");
  if (audio) {
    audio.src = encodeURI(tema.audio);
  }

  const cont = document.getElementById("rhContenido");
  if (!cont) return;

  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo abrir el HTML");

    const raw = await r.text();
    const parsed = new DOMParser().parseFromString(raw, "text/html");

    const estilos = Array.from(parsed.querySelectorAll("style"))
      .map(s => s.outerHTML)
      .join("");

    const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;

    cont.innerHTML = `
      ${estilos}
      <div id="rhDoc">${bodyHTML}</div>
    `;
  } catch (e) {
    cont.innerHTML = `
      <div style="padding:12px; border-radius:12px; background:rgba(217,83,79,.12); color:inherit;">
        ❌ No pude cargar el contenido RH.<br>
        Revisá si existe el archivo:<br>
        <code style="font-size:12px;">${tema.html}</code>
      </div>
    `;
    console.error(e);
  }
}
