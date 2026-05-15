import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  get,
  push
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= RECURSOS - MÓDULO =================

const RH_TEMAS = [
  {
    titulo: "El comportamiento de Jesús ante el pecado",
    html: "materiales/RH/El comportamiento de Jesús ante el pecado.html",
    pdf: "materiales/RH/pdf/El comportamiento de Jesús ante el pecado.pdf",
    audio: "materiales/RH/El comportamiento de Jesús ante el pecado.mp3"
  },
  {
    titulo: "El Paralítico de Betesda",
    html: "materiales/RH/El Paralítico de Betesda.html",
    pdf: "materiales/RH/pdf/El paralítico de Betesda.pdf",
    audio: "materiales/RH/El Paralítico de Betesda.mp3"
  },
  {
    titulo: "¿Estamos preparados para el milagro?",
    html: "materiales/RH/Estamos preparados para el milagro.html",
    pdf: "materiales/RH/pdf/Estamos preparados para el milagro.pdf",
    audio: "materiales/RH/Estamos preparados para el milagro.mp3"
  },
  {
    titulo: "El momento del milagro",
    html: "materiales/RH/El momento del milagro.html",
    pdf: "materiales/RH/pdf/El momento del milagro.pdf",
    audio: "materiales/RH/El momento del milagro.mp3"
  },
  {
    titulo: "El milagro del paralítico traído por 4 amigos",
    html: "materiales/RH/El milagro del paralítico traído por 4 amigos.html",
    pdf: "materiales/RH/pdf/El milagro del paralítico traído por 4 amigos.pdf",
    audio: "materiales/RH/El milagro del paralítico traído por 4 amigos.mp3"
  },
  {
    titulo: "Reconciliación",
    html: "materiales/RH/Reconciliación.html",
    pdf: "materiales/RH/pdf/Reconciliación.pdf",
    audio: "materiales/RH/Reconciliación.mp3"
  }
];

const RH_PDF_COMPLETO = "materiales/RH/pdf/RH COMPLETO CON PORTADA.pdf";

let rhIndex = 0;
let rhIniciado = false;

// ✅ abrir RH por defecto
// ✅ abrir RH por defecto
window.mostrarRecursosSub = async (sub) => {
  const esAdmin = !!window.__ES_ADMIN;
  const esColab = !!window.__ES_COLABORADOR;
  const puedeVerRecursos = esAdmin || esColab;

  if (!puedeVerRecursos) {
    alert("No tenés permiso para entrar a Recursos.");
    return;
  }

  const rh = document.getElementById("recursos-rh");
  const talleres = document.getElementById("recursos-talleres");
  const hermanos = document.getElementById("recursos-hermanos");
  const permisos = document.getElementById("recursos-permisos");
  const ediciones = document.getElementById("recursos-ediciones");

  if (rh) rh.style.display = (sub === "rh") ? "block" : "none";
  if (talleres) talleres.style.display = (sub === "talleres") ? "block" : "none";
  if (hermanos) hermanos.style.display = (sub === "hermanos") ? "block" : "none";
  if (permisos) permisos.style.display = (sub === "permisos") ? "block" : "none";
  if (ediciones) ediciones.style.display = (sub === "ediciones") ? "block" : "none";

  const wrap = document.getElementById("iglesia-recursos");
  if (wrap) {
    wrap.querySelectorAll(".panel-tabs button").forEach(b => b.classList.remove("activo"));
    const btn = wrap.querySelector(`[onclick="mostrarRecursosSub('${sub}')"]`);
    if (btn) btn.classList.add("activo");
  }

  if (sub === "rh") {
    await mostrarRH();
  }

  if (sub === "hermanos") {
    await mostrarHermanos();
  }

  if (sub === "permisos") {
    if (!window.__ES_ADMIN) {
      alert("Solo los administradores pueden ver Permisos.");
      return;
    }
    await mostrarPermisos();
  }

  if (sub === "ediciones") {
    if (typeof window.mostrarEdiciones === "function") {
      await window.mostrarEdiciones();
    } else {
      const cont = document.getElementById("edicionesApp");
      if (cont) {
        cont.innerHTML = `
          <div style="padding:20px; text-align:center;">
            No se cargó el módulo Ediciones.js.
          </div>
        `;
      }
    }
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
          color:#000;
        }

        #rhIndice::-webkit-scrollbar{ height: 10px; }
        #rhIndice::-webkit-scrollbar-thumb{
          background: rgba(0,0,0,.22);
          border-radius:999px;
        }

/* ================= RH: GALERÍA + AUDIO STICKY ================= */

#rhStickyBar{
  position: sticky;
  top: 0;
  z-index: 70;

  background: rgba(255,255,255,.92);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);

  padding: 10px 10px 12px;
  margin-bottom: 14px;

  border: 1px solid rgba(0,0,0,.08);
  border-radius: 16px;
  overflow: hidden;

  box-shadow: 0 6px 16px rgba(0,0,0,.08);
}

body.oscuro #rhStickyBar{
  background: rgba(255,255,255,.92);
}

#rhCapWrapper{
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  scrollbar-width: thin;
}

#rhCapWrapper::-webkit-scrollbar{
  height: 8px;
  display: block;
}

#rhCapWrapper::-webkit-scrollbar-track{
  background: rgba(0,0,0,.08);
  border-radius: 999px;
}

#rhCapWrapper::-webkit-scrollbar-thumb{
  background: rgba(0,0,0,.28);
  border-radius: 999px;
}

#rhAudioBar{
  background: transparent;
  padding: 8px 0 0;
}

#rhAudio{
  width:100%;
  margin:0;
  display:block;
  border-radius:16px;
}

/* ✅ aire para las acciones de RH */
#rhAcciones{
  margin: 10px 0 16px;
}

        #rhAcciones {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 0 12px;
}

#rhAcciones button {
  border: none;
  cursor: pointer;
  border-radius: 999px;
  width: 40px;
  height: 40px;
  background: var(--ui-azul-claro, #bcdcff);
  color: #000;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
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

  #rhStickyBar{
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

  <div id="rhStickyBar">
    <!-- ✅ Índice / galería arriba -->
    <div id="rhTop">
      <div id="rhIndice" aria-label="Índice RH"></div>
    </div>

    <!-- ✅ Audio debajo del índice -->
    <div id="rhAudioBar">
      <audio id="rhAudio" controls preload="metadata"></audio>
    </div>
  </div>

  <div id="rhAcciones"></div>

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
  audio.load();
}
  renderRHAcciones();

  const cont = document.getElementById("rhContenido");
  if (!cont) return;

  cont.innerHTML = `<div style="opacity:.75; text-align:center; padding:10px;">Cargando…</div>`;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo abrir el HTML");

    const raw = await r.text();
    const parsed = new DOMParser().parseFromString(raw, "text/html");

const headExtras = [
  ...Array.from(parsed.querySelectorAll('link[rel="stylesheet"]')).map(l => l.outerHTML),
  ...Array.from(parsed.querySelectorAll("style")).map(s => s.outerHTML)
].join("\n");

const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;

const htmlFrame = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
 ${headExtras}
  <style>
    html, body{
      margin:0;
      padding:0;
      background:#fff;
      color:#000;
    }

    *{
      box-sizing:border-box;
    }

    img, table{
      max-width:100% !important;
      height:auto !important;
    }

    table{
      display:block;
      overflow-x:auto;
      -webkit-overflow-scrolling:touch;
    }
  </style>
</head>
<body>
  <div id="rhDoc">${bodyHTML}</div>
</body>
</html>
`;

cont.innerHTML = `
  <iframe
    id="rhFrame"
    style="width:100%; border:0; display:block; background:#fff; border-radius:14px;"
    loading="lazy"
  ></iframe>
`;

const frame = document.getElementById("rhFrame");
if (frame) {
  frame.onload = () => {
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      const h = Math.max(
        doc.body ? doc.body.scrollHeight : 0,
        doc.documentElement ? doc.documentElement.scrollHeight : 0
      );
      frame.style.height = (h + 8) + "px";
    } catch(e) {
      console.warn("No pude ajustar alto de RH:", e);
    }
  };

  frame.srcdoc = htmlFrame;

  setTimeout(() => {
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      const h = Math.max(
        doc.body ? doc.body.scrollHeight : 0,
        doc.documentElement ? doc.documentElement.scrollHeight : 0
      );
      frame.style.height = (h + 8) + "px";
    } catch(e) {}
  }, 300);
}
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

/* ================= RH - ACCIONES EXTRA ================= */

function renderRHAcciones() {
  const cont = document.getElementById("rhAcciones");
  if (!cont) return;

  const tema = RH_TEMAS[rhIndex];
  if (!tema) return;

  cont.innerHTML = `
    <button type="button" onclick="guardarRHEnMiPanel(${rhIndex})" title="Guardar en Mi Panel">
      <i class="fa-solid fa-heart-circle-plus"></i>
    </button>

    <button type="button" onclick="abrirOpcionesPDFRH(${rhIndex})" title="Descargar PDF">
      <i class="fa-solid fa-file-pdf"></i>
    </button>

    ${window.__ES_ADMIN ? `
      <button type="button" onclick="publicarRHEnCompartidos(${rhIndex})" title="Publicar en Compartidos">
        <i class="fa-solid fa-icons"></i>
      </button>
    ` : ``}
  `;
}

window.guardarRHEnMiPanel = async (index) => {
  const uid = window.__UID || window.__FB?.auth?.currentUser?.uid || null;

  if (!uid) {
    const modal = document.getElementById("loginModal");

    if (modal) {
      const title = modal.querySelector(".modal-title");
      const sub = modal.querySelector(".modal-sub");

      if (title) title.textContent = "🔐 Iniciar sesión";
      if (sub) sub.textContent = "Iniciá sesión para guardar este recurso en Mi Panel.";

      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      return;
    }

    alert("Iniciá sesión para guardar en Mi Panel.");
    return;
  }

  const tema = RH_TEMAS[index];
  if (!tema) return;

  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  try {
    await set(ref(db, `panelRecursos/${uid}/rh_${index}`), {
      tipo: "rh",
      recursoTipo: "rh",
      temaIndex: index,
      titulo: tema.titulo,
      html: tema.html,
      audio: tema.audio,
      ts: Date.now()
    });

    alert("Recurso guardado en Mi Panel.");
  } catch (err) {
    console.error(err);
    alert("No pude guardar el recurso.");
  }
};

window.publicarRHEnCompartidos = async (index) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden publicar recursos.");
    return;
  }

  const tema = RH_TEMAS[index];
  if (!tema) return;

  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  try {
    await set(ref(db, `compartidos/rh_${index}`), {
      tipo: "rh",
      recursoTipo: "rh",
      temaIndex: index,
      titulo: tema.titulo,
      html: tema.html,
      audio: tema.audio,
      creadoPor: window.__UID || "",
      ts: Date.now()
    });

    alert("Recurso publicado en Compartidos.");
  } catch (err) {
    console.error(err);
    alert("No pude publicar el recurso.");
  }
};

/* ================= RH - PDF PRECARGADO ================= */

function rhNombreDescarga(nombre = "RH") {
  return String(nombre || "RH")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) + ".pdf";
}

function rhDescargarArchivo(url, nombreArchivo) {
  if (!url) {
    alert("No encontré el PDF para descargar.");
    return;
  }

  const a = document.createElement("a");
  a.href = encodeURI(url);
  a.download = nombreArchivo || "RH.pdf";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

window.abrirOpcionesPDFRH = (index = rhIndex) => {
  const tema = RH_TEMAS[index];

  if (!tema) {
    alert("No encontré este módulo RH.");
    return;
  }

  const viejo = document.getElementById("rhPdfModal");
  if (viejo) viejo.remove();

  const modal = document.createElement("div");
  modal.id = "rhPdfModal";

  modal.innerHTML = `
    <div class="rh-pdf-backdrop" onclick="cerrarOpcionesPDFRH()"></div>

    <div class="rh-pdf-box" role="dialog" aria-modal="true">
      <button type="button" class="rh-pdf-x" onclick="cerrarOpcionesPDFRH()">×</button>

      <div class="rh-pdf-title">
        Descargar PDF
      </div>

      <div class="rh-pdf-sub">
        Elegí qué querés descargar.
      </div>

      <button type="button" class="rh-pdf-opcion" onclick="descargarPDFRHActual(${index})">
        <i class="fa-solid fa-file-pdf"></i>
        <span>Módulo actual</span>
      </button>

      <button type="button" class="rh-pdf-opcion" onclick="descargarPDFRHCompleto()">
        <i class="fa-solid fa-layer-group"></i>
        <span>RH completo</span>
      </button>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "rhPdfModalStyle";
  style.textContent = `
    #rhPdfModal{
      position:fixed;
      inset:0;
      z-index:999999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
    }

    #rhPdfModal .rh-pdf-backdrop{
      position:absolute;
      inset:0;
      background:rgba(0,0,0,.45);
    }

    #rhPdfModal .rh-pdf-box{
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

    #rhPdfModal .rh-pdf-x{
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

    #rhPdfModal .rh-pdf-title{
      font-size:20px;
      font-weight:900;
      padding-right:36px;
    }

    #rhPdfModal .rh-pdf-sub{
      font-size:14px;
      opacity:.75;
      margin-bottom:6px;
    }

    #rhPdfModal .rh-pdf-opcion{
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

    #rhPdfModal .rh-pdf-opcion:hover{
      background:var(--ui-azul-hover, #1c6fcb);
      color:#fff;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);
};

window.cerrarOpcionesPDFRH = () => {
  const modal = document.getElementById("rhPdfModal");
  const style = document.getElementById("rhPdfModalStyle");

  if (modal) modal.remove();
  if (style) style.remove();
};

window.descargarPDFRHActual = (index = rhIndex) => {
  const tema = RH_TEMAS[index];

  if (!tema?.pdf) {
    alert("Este módulo todavía no tiene PDF cargado.");
    return;
  }

  rhDescargarArchivo(tema.pdf, rhNombreDescarga(tema.titulo || "RH"));
  cerrarOpcionesPDFRH();
};

window.descargarPDFRHCompleto = () => {
  rhDescargarArchivo(RH_PDF_COMPLETO, "RH_COMPLETO.pdf");
  cerrarOpcionesPDFRH();
};

window.abrirRHCompartido = async (index) => {
  const tema = RH_TEMAS[index];
  if (!tema) return;

  let visor = document.getElementById("rhViewer");

  if (!visor) {
    visor = document.createElement("div");
    visor.id = "rhViewer";
    document.body.appendChild(visor);
  }

  visor.style.cssText = `
    position:fixed;
    inset:0;
    z-index:999999;
    background:rgba(10,14,22,.96);
    color:#fff;
    display:block;
    overflow:auto;
    padding:54px 12px 18px;
  `;

  visor.innerHTML = `
    <div style="position:fixed; top:8px; left:8px; right:8px; z-index:5; display:flex; justify-content:space-between; align-items:center;">
      <div style="font-weight:900; font-size:14px; background:rgba(255,255,255,.12); padding:8px 12px; border-radius:999px;">
        ${tema.titulo}
      </div>

      <button type="button" onclick="cerrarRHCompartido()"
        style="border:none; width:36px; height:36px; border-radius:999px; background:rgba(255,255,255,.16); color:#fff; font-size:20px;">
        ×
      </button>
    </div>

    <div style="max-width:900px; margin:0 auto;">
      <audio controls preload="metadata" src="${encodeURI(tema.audio)}" style="width:100%; margin-bottom:12px;"></audio>
      <div id="rhViewerContenido" style="background:#fff; color:#000; border-radius:16px; padding:12px; overflow:hidden;">
        Cargando…
      </div>
    </div>
  `;

  try {
    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    const raw = await r.text();
    const parsed = new DOMParser().parseFromString(raw, "text/html");

    const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;
    const cont = document.getElementById("rhViewerContenido");

    if (cont) {
      cont.innerHTML = bodyHTML;
      cont.querySelectorAll("img, table").forEach(el => {
        el.style.maxWidth = "100%";
        el.style.height = "auto";
      });
    }

    document.body.style.overflow = "hidden";
  } catch (err) {
    console.error(err);
    const cont = document.getElementById("rhViewerContenido");
    if (cont) cont.innerHTML = "No pude abrir el recurso.";
  }
};

window.cerrarRHCompartido = () => {
  const visor = document.getElementById("rhViewer");
  if (visor) {
    visor.style.display = "none";
    visor.innerHTML = "";
  }

  document.body.style.overflow = "";
};

// ================= HERMANOS - MÓDULO =================

let hermanosIniciado = false;
let hermanosEscuchaActiva = false;
let hermanosCache = [];
let hermanoEditId = null;

function hCrearTokenPedido() {
  return (
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 12)
  );
}

function hEscape(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hValor(v) {
  return String(v ?? "").trim();
}

function hFechaCumple(v) {
  const s = hValor(v);
  if (!s) return "";

  const partes = s.split("-");
  if (partes.length === 3) {
    const [y, m, d] = partes;
    if (y && m && d) return `${d}/${m}/${y}`;
  }

  return s;
}

function hNormalizarRegistro(data = {}) {
  return {
    nombre: hValor(data.nombre),
    apellido: hValor(data.apellido),
    direccion: hValor(data.direccion),
    telefono: hValor(data.telefono),
    cumpleanos: hValor(data.cumpleanos),
    pedidosOracion: hValor(data.pedidosOracion),
    notas: hValor(data.notas),
    mail: hValor(data.mail),
    tokenPedido: data.tokenPedido || "",
    creadoPor: data.creadoPor || window.__UID || "",
    ts: data.ts || Date.now()
  };
}

window.mostrarHermanos = async () => {
  const cont = document.getElementById("hermanosApp");
  if (!cont) return;

  if (!hermanosIniciado) {
    cont.innerHTML = `
      <style>
        #hermanosWrap{
          max-width: 980px;
          margin: 0 auto;
          padding: 10px 12px 18px;
        }

        #hermanosTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding: 8px 0 12px;
          flex-wrap:wrap;
        }

        #hermanosTopLeft{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
        }

        #hermanosTop h3{
          margin:0;
          font-size:22px;
          line-height:1.1;
        }

        #hermanosCount{
          font-size:13px;
          opacity:.75;
          font-weight:700;
        }

        #hermanosActions{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          align-items:center;
        }

        #hermanosBuscar{
          min-width: 240px;
          max-width: 320px;
          width: 100%;
          border:1px solid rgba(0,0,0,.14);
          border-radius:999px;
          padding:10px 14px;
          outline:none;
          font-size:14px;
        }

        #hermanosBtnNuevo{
          border:none;
          cursor:pointer;
          border-radius:999px;
          padding:10px 14px;
          background: var(--ui-azul-claro, #bcdcff);
          color:#000;
          font-weight:700;
        }

        #hermanosLista{
          display:grid;
          gap:12px;
        }

        .hermano-card{
          background:#fff;
          border:1px solid rgba(0,0,0,.10);
          border-radius:16px;
          padding:14px;
          overflow:hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,.04);
        }

        body.oscuro .hermano-card{
          background:#fff;
          color:#000;
          border-color: rgba(0,0,0,.12);
        }

        .hermano-top{
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:flex-start;
          flex-wrap:wrap;
          margin-bottom:10px;
        }

        .hermano-nombre{
          font-size:18px;
          font-weight:700;
          line-height:1.2;
        }

        .hermano-mail{
          font-size:13px;
          opacity:.8;
          margin-top:4px;
          word-break:break-word;
        }

       .hermano-resumen{
  width:100%;
  border:none;
  background:transparent;
  padding:0;
  cursor:pointer;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  text-align:left;
  color:inherit;
  font-family:inherit;
}

.hermano-resumen-info{
  display:grid;
  gap:4px;
}

.hermano-resumen-tel{
  font-size:14px;
  opacity:.82;
  font-weight:700;
}

.hermano-resumen-icono{
  width:34px;
  height:34px;
  border-radius:999px;
  background:var(--ui-azul-claro, #bcdcff);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  transition: transform .18s ease;
}

.hermano-card.abierta .hermano-resumen-icono{
  transform:rotate(180deg);
}

.hermano-detalle{
  display:none;
  margin-top:12px;
}

.hermano-card.abierta .hermano-detalle{
  display:block;
}
        
.hermano-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          grid-template-areas:
            "direccion cumple"
            "pedidos telefono"
            "notas notas";
          gap:10px 14px;
        }

        .hermano-campo-direccion{ grid-area: direccion; }
        .hermano-campo-cumple{ grid-area: cumple; }
        .hermano-campo-telefono{ grid-area: telefono; }
        .hermano-campo-pedidos{ grid-area: pedidos; }
        .hermano-campo-notas{ grid-area: notas; }
        .hermano-campo{
          background: rgba(0,0,0,.03);
          border-radius:12px;
          padding:10px 12px;
        }

        .hermano-campo-label{
          font-size:12px;
          font-weight:700;
          opacity:.75;
          margin-bottom:4px;
        }

        .hermano-campo-valor{
          font-size:14px;
          line-height:1.45;
          white-space:pre-wrap;
          word-break:break-word;
        }

        .hermano-acciones{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        }

        .hermano-acciones button{
          border:none;
          cursor:pointer;
          border-radius:999px;
          padding:8px 12px;
          background: var(--ui-azul-claro, #bcdcff);
          color:#000;
          font-weight:700;
        }

        #hermanosVacio{
          padding:18px;
          text-align:center;
          border:1px dashed rgba(0,0,0,.18);
          border-radius:16px;
          background:#fff;
        }

        body.oscuro #hermanosVacio{
          background:#fff;
          color:#000;
        }

        #modalHermano{
          position:fixed;
          inset:0;
          background:rgba(0,0,0,.45);
          z-index:9999;
          display:none;
          align-items:center;
          justify-content:center;
          padding:16px;
        }

        #modalHermanoBox{
          width:min(760px, 100%);
          max-height:92vh;
          overflow:auto;
          background:#fff;
          color:#000;
          border-radius:18px;
          box-shadow:0 20px 60px rgba(0,0,0,.28);
          padding:16px;
        }

        #modalHermanoTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:12px;
        }

        #modalHermanoTop h3{
          margin:0;
          font-size:22px;
          line-height:1.1;
        }

        #cerrarModalHermano{
          border:none;
          background:transparent;
          font-size:28px;
          line-height:1;
          cursor:pointer;
          padding:0 4px;
        }

        #formHermano{
          display:grid;
          gap:12px;
        }

        .hermano-form-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap:12px;
        }

        .hermano-form-campo{
          display:flex;
          flex-direction:column;
          gap:6px;
        }

        .hermano-form-campo.full{
          grid-column:1 / -1;
        }

        .hermano-form-campo label{
          font-size:13px;
          font-weight:700;
        }

        .hermano-form-campo input,
        .hermano-form-campo textarea{
          width:100%;
          border:1px solid rgba(0,0,0,.16);
          border-radius:12px;
          padding:10px 12px;
          font-size:14px;
          font-family:inherit;
          outline:none;
          background:#fff;
          color:#000;
        }

        .hermano-form-campo textarea{
          min-height:92px;
          resize:vertical;
        }

        #hermanoFormAcciones{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          justify-content:flex-end;
          margin-top:4px;
        }

        #hermanoFormAcciones button{
          border:none;
          cursor:pointer;
          border-radius:999px;
          padding:10px 14px;
          font-weight:700;
        }

        #btnGuardarHermano{
          background: var(--ui-azul-hover, #1c6fcb);
          color:#fff;
        }

        #btnCancelarHermano{
          background:#e9ecef;
          color:#000;
        }

        @media (max-width: 640px){
          #hermanosWrap{
            max-width:100%;
            margin:0;
            padding:8px 10px 16px;
          }

          #hermanosTop{
            align-items:stretch;
          }

          #hermanosActions{
            width:100%;
            flex-direction:column;
            align-items:stretch;
          }

          #hermanosBuscar{
            min-width:0;
            max-width:none;
          }

          #hermanosBtnNuevo{
            width:100%;
          }

         .hermano-grid,
          .hermano-form-grid{
            grid-template-columns: 1fr;
          }

          .hermano-grid{
            grid-template-areas:
              "direccion"
              "cumple"
              "telefono"
              "pedidos"
              "notas";
          }

          #modalHermanoBox{
            padding:14px;
            border-radius:16px;
          }
        }
      </style>

      <div id="hermanosWrap">

        <div id="hermanosTop">
          <div id="hermanosTopLeft">
            <h3>Contactos</h3>
            <div id="hermanosCount">0 registros</div>
          </div>

          <div id="hermanosActions">
            <input
              id="hermanosBuscar"
              type="text"
              placeholder="Buscar por nombre, apellido, teléfono, mail o cumpleaños"
              oninput="renderHermanosLista()"
            />
${window.__ES_ADMIN ? `
  <button id="hermanosBtnNuevo" type="button" onclick="abrirNuevoHermano()">
    ➕ Nuevo registro
  </button>
` : ``}
          </div>
        </div>

        <div id="hermanosLista"></div>

      </div>

      <div id="modalHermano" onclick="cerrarModalHermanoFondo(event)">
        <div id="modalHermanoBox" onclick="event.stopPropagation()">
          <div id="modalHermanoTop">
            <h3 id="tituloModalHermano">Nuevo hermano</h3>
            <button id="cerrarModalHermano" type="button" onclick="cerrarModalHermano()">×</button>
          </div>

          <form id="formHermano" onsubmit="guardarHermano(event)">
            <div class="hermano-form-grid">

              <div class="hermano-form-campo">
                <label for="hermanoNombre">Nombre</label>
                <input id="hermanoNombre" type="text" required />
              </div>

              <div class="hermano-form-campo">
                <label for="hermanoApellido">Apellido</label>
                <input id="hermanoApellido" type="text" required />
              </div>

              <div class="hermano-form-campo">
                <label for="hermanoCumpleanos">Cumpleaños</label>
                <input id="hermanoCumpleanos" type="date" />
              </div>

              <div class="hermano-form-campo">
                <label for="hermanoTelefono">Teléfono</label>
                <input id="hermanoTelefono" type="text" />
              </div>

              <div class="hermano-form-campo">
                <label for="hermanoMail">Mail</label>
                <input id="hermanoMail" type="email" />
              </div>

              <div class="hermano-form-campo full">
                <label for="hermanoDireccion">Dirección</label>
                <input id="hermanoDireccion" type="text" />
              </div>

              <div class="hermano-form-campo full">
                <label for="hermanoPedidos">Pedidos de oración</label>
                <textarea id="hermanoPedidos"></textarea>
              </div>

              <div class="hermano-form-campo full">
                <label for="hermanoNotas">Notas</label>
                <textarea id="hermanoNotas"></textarea>
              </div>

            </div>

            <div id="hermanoFormAcciones">
              <button id="btnCancelarHermano" type="button" onclick="cerrarModalHermano()">Cancelar</button>
              <button id="btnGuardarHermano" type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    hermanosIniciado = true;
  }

  iniciarEscuchaHermanos();
};

function iniciarEscuchaHermanos() {
  if (hermanosEscuchaActiva) return;

  const db = window.__FB?.db;
  if (!db) {
    console.warn("db no está disponible todavía");
    return;
  }

  const { ref, onValue } = window.__FB_API || {};
  if (!ref || !onValue) {
    console.warn("Firebase API no está disponible todavía");
    return;
  }

  const hermanosRef = ref(db, "hermanos");

  onValue(hermanosRef, (snap) => {
    const val = snap.val() || {};

    hermanosCache = Object.entries(val).map(([id, item]) => ({
      id,
      ...hNormalizarRegistro(item)
    }));

    hermanosCache.sort((a, b) => {
      const apA = (a.apellido || "").toLowerCase();
      const apB = (b.apellido || "").toLowerCase();
      if (apA !== apB) return apA.localeCompare(apB, "es");

      const noA = (a.nombre || "").toLowerCase();
      const noB = (b.nombre || "").toLowerCase();
      return noA.localeCompare(noB, "es");
    });

    renderHermanosLista();
  }, (err) => {
    console.error("Error leyendo hermanos:", err);
  });

  hermanosEscuchaActiva = true;
}

window.renderHermanosLista = () => {
  const lista = document.getElementById("hermanosLista");
  const count = document.getElementById("hermanosCount");
  const buscador = document.getElementById("hermanosBuscar");
  if (!lista) return;

  const q = hValor(buscador?.value).toLowerCase();

  const filtrados = !q
    ? hermanosCache
    : hermanosCache.filter(h => {
        const bag = [
          h.nombre,
          h.apellido,
          h.telefono,
          h.cumpleanos,
          h.mail,
          h.direccion,
          h.pedidosOracion,
          h.notas
        ].join(" ").toLowerCase();
        return bag.includes(q);
      });

  if (count) {
    count.textContent = `${filtrados.length} registro${filtrados.length === 1 ? "" : "s"}`;
  }

  if (!filtrados.length) {
    lista.innerHTML = `
      <div id="hermanosVacio">
        ${q ? "No encontré resultados para esa búsqueda." : "Todavía no hay hermanos cargados."}
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(h => {
  const nombreCompleto = `${h.nombre || ""} ${h.apellido || ""}`.trim() || "Sin nombre";

  return `
    <div class="hermano-card" id="hermanoCard_${h.id}">
      
      <button type="button" class="hermano-resumen" onclick="toggleHermanoCard('${h.id}')">
        <div class="hermano-resumen-info">
          <div class="hermano-nombre">${hEscape(nombreCompleto)}</div>
          <div class="hermano-resumen-tel">
            <i class="fa-brands fa-whatsapp"></i>
            ${hEscape(h.telefono || "Sin teléfono")}
          </div>
        </div>

        <div class="hermano-resumen-icono">
          <i class="fa-solid fa-chevron-down"></i>
        </div>
      </button>

      <div class="hermano-detalle">
        <div class="hermano-top">
          <div>
            <div class="hermano-mail">${h.mail ? hEscape(h.mail) : "Sin mail"}</div>
          </div>
        </div>

        <div class="hermano-grid">
          <div class="hermano-campo hermano-campo-direccion">
            <div class="hermano-campo-label">Dirección</div>
            <div class="hermano-campo-valor">${hEscape(h.direccion || "—")}</div>
          </div>

          <div class="hermano-campo hermano-campo-cumple">
            <div class="hermano-campo-label">Cumpleaños</div>
            <div class="hermano-campo-valor">${hEscape(hFechaCumple(h.cumpleanos) || "—")}</div>
          </div>

          <div class="hermano-campo hermano-campo-pedidos">
            <div class="hermano-campo-label">Pedidos de oración</div>
            <div class="hermano-campo-valor">${hEscape(h.pedidosOracion || "—")}</div>
          </div>

          <div class="hermano-campo hermano-campo-telefono">
            <div class="hermano-campo-label">Teléfono</div>
            <div class="hermano-campo-valor">${hEscape(h.telefono || "—")}</div>
          </div>

          <div class="hermano-campo hermano-campo-notas">
            <div class="hermano-campo-label">Notas</div>
            <div class="hermano-campo-valor">${hEscape(h.notas || "—")}</div>
          </div>
        </div>

        <div class="hermano-acciones">
          ${window.__ES_ADMIN ? `<button type="button" onclick="editarHermano('${h.id}')">Editar</button>` : ``}
          <button type="button" onclick="enviarHermanoPorWhatsApp('${h.id}')">WhatsApp</button>
          ${window.__ES_ADMIN ? `<button type="button" onclick="borrarHermano('${h.id}')">Borrar</button>` : ``}
        </div>
      </div>
    </div>
  `;
}).join("");
};

window.toggleHermanoCard = (id) => {
  const card = document.getElementById(`hermanoCard_${id}`);
  if (!card) return;

  card.classList.toggle("abierta");
};

window.abrirNuevoHermano = () => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden crear registros.");
    return;
  }

  hermanoEditId = null;

  const titulo = document.getElementById("tituloModalHermano");
  const modal = document.getElementById("modalHermano");
  const form = document.getElementById("formHermano");

  if (titulo) titulo.textContent = "Nuevo hermano";
  if (form) form.reset();
  if (modal) modal.style.display = "flex";
};

window.editarHermano = (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden editar registros.");
    return;
  }

  const item = hermanosCache.find(x => x.id === id);
  if (!item) return;

  hermanoEditId = id;

  const titulo = document.getElementById("tituloModalHermano");
  const modal = document.getElementById("modalHermano");

  if (titulo) titulo.textContent = "Editar hermano";

  const nombre = document.getElementById("hermanoNombre");
  const apellido = document.getElementById("hermanoApellido");
  const telefono = document.getElementById("hermanoTelefono");
  const cumpleanos = document.getElementById("hermanoCumpleanos");
  const mail = document.getElementById("hermanoMail");
  const direccion = document.getElementById("hermanoDireccion");
  const pedidos = document.getElementById("hermanoPedidos");
  const notas = document.getElementById("hermanoNotas");

  if (nombre) nombre.value = item.nombre || "";
  if (apellido) apellido.value = item.apellido || "";
  if (telefono) telefono.value = item.telefono || "";
  if (cumpleanos) cumpleanos.value = item.cumpleanos || "";
  if (mail) mail.value = item.mail || "";
  if (direccion) direccion.value = item.direccion || "";
  if (pedidos) pedidos.value = item.pedidosOracion || "";
  if (notas) notas.value = item.notas || "";

  if (modal) modal.style.display = "flex";
};

window.cerrarModalHermano = () => {
  const modal = document.getElementById("modalHermano");
  if (modal) modal.style.display = "none";
};

window.cerrarModalHermanoFondo = (e) => {
  if (e.target && e.target.id === "modalHermano") {
    cerrarModalHermano();
  }
};

window.guardarHermano = async (e) => {
  e.preventDefault();

  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden guardar registros.");
    return;
  }

  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo");
    return;
  }

  const btn = document.getElementById("btnGuardarHermano");
  
  const actualEditando = hermanoEditId
  ? hermanosCache.find(x => x.id === hermanoEditId)
  : null;

  const data = hNormalizarRegistro({
nombre: document.getElementById("hermanoNombre")?.value,
apellido: document.getElementById("hermanoApellido")?.value,
telefono: document.getElementById("hermanoTelefono")?.value,
cumpleanos: document.getElementById("hermanoCumpleanos")?.value,
mail: document.getElementById("hermanoMail")?.value,
direccion: document.getElementById("hermanoDireccion")?.value,
pedidosOracion: document.getElementById("hermanoPedidos")?.value,
notas: document.getElementById("hermanoNotas")?.value,
tokenPedido: actualEditando?.tokenPedido || hCrearTokenPedido(),
creadoPor: window.__UID || "",
ts: Date.now()
  });

  if (!data.nombre || !data.apellido) {
    alert("Completá nombre y apellido.");
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando...";
    }

    if (hermanoEditId) {
      const actual = hermanosCache.find(x => x.id === hermanoEditId);
      await set(ref(db, `hermanos/${hermanoEditId}`), {
        ...data,
        ts: actual?.ts || Date.now()
      });
    } else {
      const nuevoRef = push(ref(db, "hermanos"));
      await set(nuevoRef, data);
    }

    cerrarModalHermano();
  } catch (err) {
    console.error(err);
    alert("No pude guardar el registro.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  }
};

window.borrarHermano = async (id) => {
  if (!window.__ES_ADMIN) {
    alert("Solo los administradores pueden borrar registros.");
    return;
  }

  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo");
    return;
  }

  const item = hermanosCache.find(x => x.id === id);
  if (!item) return;

  const nombreCompleto = `${item.nombre || ""} ${item.apellido || ""}`.trim();

  if (!confirm(`¿Borrar a ${nombreCompleto || "este registro"}?`)) return;

  try {
    await remove(ref(db, `hermanos/${id}`));
  } catch (err) {
    console.error(err);
    alert("No pude borrar el registro.");
  }
};

function hTelefonoWhatsApp(telefono) {
  let n = String(telefono || "").replace(/\D/g, "");

  if (!n) return "";

  if (n.startsWith("549")) return n;

  if (n.startsWith("54")) {
    return "549" + n.slice(2).replace(/^15/, "");
  }

  n = n.replace(/^0+/, "").replace(/^15/, "");
  return "549" + n;
}

function hFechaYMDArgentina() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = partes.find(p => p.type === "year")?.value || "";
  const m = partes.find(p => p.type === "month")?.value || "";
  const d = partes.find(p => p.type === "day")?.value || "";

  return `${y}-${m}-${d}`;
}

function hPrimerNombre(nombre = "") {
  return String(nombre || "")
    .trim()
    .split(/\s+/)[0] || "hermano";
}

function hSlugPedidoOracion(txt = "") {
  return String(txt || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hLetraDesdeNumeroPedidoOracion(num = 1) {
  const letras = "abcdefghijklmnopqrstuvwxyz";
  const n = Math.max(1, Number(num) || 1);

  if (n <= 26) return letras[n - 1];

  const primero = Math.floor((n - 1) / 26) - 1;
  const segundo = (n - 1) % 26;

  return letras[Math.max(0, primero)] + letras[segundo];
}

async function hCrearRefPedidoOracion({ db, hermanoId, token, nombre }) {
  const fecha = hFechaYMDArgentina();
  const primerNombre = hPrimerNombre(nombre);
  const nombreSlug = hSlugPedidoOracion(primerNombre);
  const baseRef = `${fecha}-${nombreSlug}`;

  const getFn = window.__FB_API?.get;

  let usados = [];

  if (typeof getFn === "function") {
    try {
      const snap = await getFn(ref(db, "linksPedidosOracion"));
      const data = snap.val() || {};

      usados = Object.keys(data).filter(k => k.startsWith(baseRef + "-"));
    } catch (e) {
      console.warn("No pude leer linksPedidosOracion para calcular letra:", e);
    }
  }

  let numero = usados.length + 1;
  let letra = hLetraDesdeNumeroPedidoOracion(numero);
  let refPedido = `${baseRef}-${letra}`;

  while (usados.includes(refPedido)) {
    numero++;
    letra = hLetraDesdeNumeroPedidoOracion(numero);
    refPedido = `${baseRef}-${letra}`;
  }

  await set(ref(db, `linksPedidosOracion/${refPedido}`), {
    hermanoId,
    token,
    nombre: primerNombre,
    fecha,
    letra,
    activo: true,
    creadoEn: Date.now(),
    creadoPor: window.__UID || ""
  });

  return refPedido;
}

function hBaseUrlApp() {
  const path = location.pathname;

  // Si estás en /VidaAbundante/biblia.html, deja /VidaAbundante
  const basePath = path.replace(/\/[^\/]*\.html$/, "");

  return `${location.origin}${basePath}`;
}

window.enviarHermanoPorWhatsApp = async (id) => {
  const item = hermanosCache.find(x => x.id === id);
  if (!item) return;

  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const numero = hTelefonoWhatsApp(item.telefono);

  if (!numero) {
    alert("Este hermano no tiene teléfono cargado.");
    return;
  }

  let token = item.tokenPedido || "";

  if (!token) {
    token = hCrearTokenPedido();

    try {
      await set(ref(db, `hermanos/${id}/tokenPedido`), token);
      item.tokenPedido = token;
    } catch (err) {
      console.error(err);
      alert("No pude preparar el formulario de oración.");
      return;
    }
  }

  let refPedido = "";

  try {
    refPedido = await hCrearRefPedidoOracion({
      db,
      hermanoId: id,
      token,
      nombre: item.nombre || "hermano"
    });
  } catch (err) {
    console.error(err);
    alert("No pude crear el link corto de oración.");
    return;
  }

  const linkFormulario = `${hBaseUrlApp()}/pedidosdeoracion/?ref=${encodeURIComponent(refPedido)}`;

  const texto = [
    `Bendiciones hermano, complete sus pedidos de oración con libertad y fe en el nombre de Jesús 🙏💛`,
    ``,
    `Formulario:`,
    linkFormulario
  ].join("\n");

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
};

// ================= PERMISOS - MÓDULO =================

let permisosIniciado = false;
let permisosUsuarios = [];
let permisosAdmins = {};
let permisosColaboradores = {};

window.mostrarPermisos = async () => {
  const cont = document.getElementById("permisosApp");
  if (!cont) return;

  if (!window.__ES_ADMIN) {
    cont.innerHTML = `<div style="padding:20px; text-align:center;">Solo administradores.</div>`;
    return;
  }

  if (!permisosIniciado) {
    cont.innerHTML = `
      <style>
        #permisosWrap{
          max-width:980px;
          margin:0 auto;
          padding:10px 12px 18px;
        }

        #permisosTop{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          margin-bottom:12px;
        }

        #permisosTop h3{
          margin:0;
          font-size:22px;
          line-height:1.1;
        }

        #permisosBuscar{
          min-width:240px;
          max-width:320px;
          width:100%;
          border:1px solid rgba(0,0,0,.14);
          border-radius:999px;
          padding:10px 14px;
          outline:none;
          font-size:14px;
        }

        #permisosLista{
          display:grid;
          gap:12px;
        }

        .permiso-card{
          background:#fff;
          border:1px solid rgba(0,0,0,.10);
          border-radius:16px;
          padding:14px;
          box-shadow:0 2px 10px rgba(0,0,0,.04);
        }

        body.oscuro .permiso-card{
          background:#fff;
          color:#000;
        }

        .permiso-top{
          display:flex;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          align-items:flex-start;
          margin-bottom:10px;
        }

        .permiso-nombre{
          font-size:18px;
          font-weight:700;
          line-height:1.2;
        }

        .permiso-mail{
          font-size:13px;
          opacity:.8;
          margin-top:4px;
          word-break:break-word;
        }

        .permiso-estado{
          font-size:13px;
          font-weight:700;
          border-radius:999px;
          padding:6px 10px;
          background:rgba(0,0,0,.06);
        }

        .permiso-acciones{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }

        .permiso-acciones button{
          border:none;
          cursor:pointer;
          border-radius:999px;
          padding:8px 12px;
          background:var(--ui-azul-claro, #bcdcff);
          color:#000;
          font-weight:700;
        }

        #permisosVacio{
          padding:18px;
          text-align:center;
          border:1px dashed rgba(0,0,0,.18);
          border-radius:16px;
          background:#fff;
        }

        @media (max-width: 640px){
          #permisosWrap{
            padding:8px 10px 16px;
          }

          #permisosBuscar{
            min-width:0;
            max-width:none;
          }
        }
      </style>

      <div id="permisosWrap">
        <div id="permisosTop">
          <h3>Permisos</h3>
          <input
            id="permisosBuscar"
            type="text"
            placeholder="Buscar por nombre o mail"
            oninput="renderPermisosLista()"
          />
        </div>

        <div id="permisosLista"></div>
      </div>
    `;

    permisosIniciado = true;
  }

  iniciarEscuchaPermisos();
};

function iniciarEscuchaPermisos() {
  const db = window.__FB?.db;
  if (!db) {
    console.warn("db no está disponible todavía");
    return;
  }

  const { ref, onValue } = window.__FB_API || {};
  if (!ref || !onValue) {
    console.warn("Firebase API no está disponible todavía");
    return;
  }

  onValue(ref(db, "usuarios"), (snap) => {
    const val = snap.val() || {};
    permisosUsuarios = Object.values(val || {}).sort((a, b) => {
      const na = String(a?.nombre || "").toLowerCase();
      const nb = String(b?.nombre || "").toLowerCase();
      return na.localeCompare(nb, "es");
    });
    renderPermisosLista();
  }, (err) => {
    console.error("Error leyendo usuarios:", err);
  });

  onValue(ref(db, "admins"), (snap) => {
    permisosAdmins = snap.val() || {};
    renderPermisosLista();
  });

  onValue(ref(db, "colaboradores"), (snap) => {
    permisosColaboradores = snap.val() || {};
    renderPermisosLista();
  });
}

function rolUsuario(uid) {
  if (permisosAdmins?.[uid] === true) return "Admin";
  if (permisosColaboradores?.[uid] === true) return "Colaborador";
  return "Usuario";
}

window.renderPermisosLista = () => {
  const lista = document.getElementById("permisosLista");
  const buscador = document.getElementById("permisosBuscar");
  if (!lista) return;

  const q = String(buscador?.value || "").trim().toLowerCase();

  const items = !q
    ? permisosUsuarios
    : permisosUsuarios.filter(u => {
        const bag = [
          u?.nombre || "",
          u?.email || "",
          u?.uid || ""
        ].join(" ").toLowerCase();
        return bag.includes(q);
      });

  if (!items.length) {
    lista.innerHTML = `<div id="permisosVacio">No encontré usuarios.</div>`;
    return;
  }

  lista.innerHTML = items.map(u => {
    const uid = u.uid || "";
    const estado = rolUsuario(uid);

    return `
      <div class="permiso-card">
        <div class="permiso-top">
          <div>
            <div class="permiso-nombre">${hEscape(u.nombre || "Sin nombre")}</div>
            <div class="permiso-mail">${hEscape(u.email || "Sin mail")}</div>
          </div>

          <div class="permiso-estado">${estado}</div>
        </div>

        <div class="permiso-acciones">
          <button type="button" onclick="hacerUsuarioNormal('${uid}')">Usuario</button>
          <button type="button" onclick="hacerColaborador('${uid}')">Colaborador</button>
          <button type="button" onclick="hacerAdmin('${uid}')">Admin</button>
        </div>
      </div>
    `;
  }).join("");
};

window.hacerUsuarioNormal = async (uidTarget) => {
  const db = window.__FB?.db;
  if (!db || !uidTarget) return;

  try {
    await remove(ref(db, `admins/${uidTarget}`));
    await remove(ref(db, `colaboradores/${uidTarget}`));
  } catch (e) {
    console.error(e);
    alert("No pude cambiar el rol a usuario.");
  }
};

window.hacerColaborador = async (uidTarget) => {
  const db = window.__FB?.db;
  if (!db || !uidTarget) return;

  try {
    await remove(ref(db, `admins/${uidTarget}`));
    await set(ref(db, `colaboradores/${uidTarget}`), true);
  } catch (e) {
    console.error(e);
    alert("No pude cambiar el rol a colaborador.");
  }
};

window.hacerAdmin = async (uidTarget) => {
  const db = window.__FB?.db;
  if (!db || !uidTarget) return;

  try {
    await remove(ref(db, `colaboradores/${uidTarget}`));
    await set(ref(db, `admins/${uidTarget}`), true);
  } catch (e) {
    console.error(e);
    alert("No pude cambiar el rol a admin.");
  }
};

// ================= formulario publico =================
// ✅ SIN FIREBASE FUNCTIONS: pedidos de oración pasan por Cloudflare Worker
const URL_GUARDAR_PEDIDO_ORACION = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

function iniciarFormularioPedidoOracionDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const path = String(window.location.pathname || "").toLowerCase();

  // ✅ Link nuevo recomendado:
  // biblia.html?pedidoOracionRef=2026-04-19-juan-a
  const refNuevo =
    params.get("pedidoOracionRef") ||
    params.get("refPedidoOracion") ||
    "";

  // ✅ Solo aceptamos ?ref=... si estamos entrando desde /pedidosdeoracion/
  // Así no se mezcla con otros links tipo prédica.
  const refDesdePaginaPedidos = path.includes("/pedidosdeoracion/")
    ? (params.get("ref") || "")
    : "";

  const refPedido = String(refNuevo || refDesdePaginaPedidos || "").trim();

  // ✅ Link viejo:
  // biblia.html?pedidoOracion=ID&token=TOKEN
  const hermanoId = String(params.get("pedidoOracion") || "").trim();
  const token = String(params.get("token") || "").trim();

  if (refPedido) {
    abrirFormularioPedidoOracionPublico({
      ref: refPedido
    });
    return;
  }

  if (hermanoId && token) {
    abrirFormularioPedidoOracionPublico({
      hermanoId,
      token
    });
  }
}

function abrirFormularioPedidoOracionPublico(datos = {}) {
  const viejo = document.getElementById("modalPedidoOracionPublico");
  if (viejo) viejo.remove();

  const styleViejo = document.getElementById("modalPedidoOracionPublicoStyle");
  if (styleViejo) styleViejo.remove();

  const modal = document.createElement("div");
  modal.id = "modalPedidoOracionPublico";

  modal.innerHTML = `
    <div class="pedido-oracion-publico-box">
      <div class="pedido-oracion-publico-icono">
        🙏
      </div>

      <h2>Pedido de oración</h2>

      <p>
        Bendiciones hermano, complete sus pedidos de oración con libertad y fe en el nombre de Jesús 🙏💛
      </p>

      <textarea
        id="pedidoOracionPublicoTexto"
        placeholder="Escriba aquí su pedido de oración..."
      ></textarea>

      <button type="button" id="btnEnviarPedidoOracionPublico">
        Guardar
      </button>

      <div id="pedidoOracionPublicoEstado"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "modalPedidoOracionPublicoStyle";
  style.textContent = `
    #modalPedidoOracionPublico{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .pedido-oracion-publico-box{
      width:min(460px, 96vw);
      background:#fff;
      color:#000;
      border-radius:22px;
      padding:20px;
      box-shadow:0 20px 60px rgba(0,0,0,.30);
      text-align:center;
    }

    .pedido-oracion-publico-icono{
      font-size:38px;
      margin-bottom:6px;
    }

    .pedido-oracion-publico-box h2{
      margin:0 0 8px;
      font-size:24px;
      font-weight:900;
    }

    .pedido-oracion-publico-box p{
      margin:0 0 14px;
      font-size:15px;
      line-height:1.45;
    }

    #pedidoOracionPublicoTexto{
      width:100%;
      min-height:150px;
      resize:vertical;
      border:1px solid rgba(0,0,0,.18);
      border-radius:16px;
      padding:12px;
      font-family:inherit;
      font-size:15px;
      outline:none;
      box-sizing:border-box;
    }

    #btnEnviarPedidoOracionPublico{
      width:100%;
      margin-top:12px;
      border:none;
      border-radius:999px;
      padding:12px 16px;
      background:var(--ui-azul-hover, #1c6fcb);
      color:#fff;
      font-weight:900;
      cursor:pointer;
      font-size:15px;
    }

    #btnEnviarPedidoOracionPublico:disabled{
      opacity:.65;
      cursor:wait;
    }

    #pedidoOracionPublicoEstado{
      margin-top:10px;
      font-size:14px;
      font-weight:700;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  const btn = document.getElementById("btnEnviarPedidoOracionPublico");

  if (btn) {
    btn.onclick = () => enviarPedidoOracionPublico(datos);
  }
}

async function enviarPedidoOracionPublico(datos = {}) {
  const txt = document.getElementById("pedidoOracionPublicoTexto");
  const estado = document.getElementById("pedidoOracionPublicoEstado");
  const btn = document.getElementById("btnEnviarPedidoOracionPublico");

  const pedido = String(txt?.value || "").trim();

  if (!pedido) {
    if (estado) estado.textContent = "Escriba su pedido de oración.";
    return;
  }

  if (!URL_GUARDAR_PEDIDO_ORACION || URL_GUARDAR_PEDIDO_ORACION.includes("PEGAR_URL")) {
    if (estado) estado.textContent = "Falta configurar la función para guardar.";
    return;
  }

  const refPedido = String(datos.ref || "").trim();
  const hermanoId = String(datos.hermanoId || "").trim();
  const token = String(datos.token || "").trim();

  if (!refPedido && (!hermanoId || !token)) {
    if (estado) estado.textContent = "Link inválido o incompleto.";
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando...";
    }

    if (estado) estado.textContent = "";

const payload = refPedido
  ? {
      action: "pedidoOracion",
      ref: refPedido,
      pedido
    }
  : {
      action: "pedidoOracion",
      hermanoId,
      token,
      pedido
    };

    const r = await fetch(URL_GUARDAR_PEDIDO_ORACION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data.ok) {
      throw new Error(data.error || "No se pudo enviar el pedido.");
    }

    if (estado) {
      estado.textContent = "Pedido enviado. Dios le bendiga 🙏💛";
    }

    if (txt) txt.value = "";

    setTimeout(() => {
      const modal = document.getElementById("modalPedidoOracionPublico");
      const style = document.getElementById("modalPedidoOracionPublicoStyle");

      if (modal) modal.remove();
      if (style) style.remove();

      const url = new URL(window.location.href);

      // ✅ limpiamos link nuevo
      url.searchParams.delete("pedidoOracionRef");
      url.searchParams.delete("refPedidoOracion");

      // ✅ limpiamos link viejo
      url.searchParams.delete("pedidoOracion");
      url.searchParams.delete("token");

      // ✅ solo quitamos ref si estamos en pedidosdeoracion
      if (String(url.pathname || "").toLowerCase().includes("/pedidosdeoracion/")) {
        url.searchParams.delete("ref");
      }

      window.history.replaceState({}, "", url.toString());
    }, 1800);

  } catch (err) {
    console.error(err);

    if (estado) {
      estado.textContent = err?.message || "No se pudo enviar. Intente nuevamente.";
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enviar pedido";
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciarFormularioPedidoOracionDesdeURL);
} else {
  iniciarFormularioPedidoOracionDesdeURL();
}
