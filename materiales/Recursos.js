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
    audio: "materiales/RH/El comportamiento de Jesús ante el pecado.mp3"
  },
  {
    titulo: "El Paralítico de Betesda",
    html: "materiales/RH/El Paralítico de Betesda.html",
    audio: "materiales/RH/El Paralítico de Betesda.mp3"
  },
  {
    titulo: "¿Estamos preparados para el milagro?",
    html: "materiales/RH/Estamos preparados para el milagro.html",
    audio: "materiales/RH/Estamos preparados para el milagro.mp3"
  },
   {
    titulo: "El momento del milagro",
    html: "materiales/RH/El momento del milagro.html",
    audio: "materiales/RH/El momento del milagro.mp3"
  },
   {
    titulo: "El milagro del paralítico traído por 4 amigos",
    html: "materiales/RH/El milagro del paralítico traído por 4 amigos.html",
    audio: "materiales/RH/El milagro del paralítico traído por 4 amigos.mp3"
  },
   {
    titulo: "Reconciliación",
    html: "materiales/RH/Reconciliación.html",
    audio: "materiales/RH/Reconciliación.mp3"
  }
];

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

    <button type="button" onclick="descargarRHPDF(${rhIndex})" title="Descargar PDF">
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

window.descargarRHPDF = async (index) => {
  const tema = RH_TEMAS[index];
  if (!tema) return;

  try {
    const jsPDF = await rhObtenerJsPDF();

    const r = await fetch(encodeURI(tema.html), { cache: "no-store" });
    if (!r.ok) throw new Error("No pude abrir el HTML de RH");

    const raw = await r.text();
    const parsed = new DOMParser().parseFromString(raw, "text/html");

    const estilos = Array.from(parsed.querySelectorAll("style"))
      .map(s => s.outerHTML)
      .join("");

    const bodyHTML = parsed.body ? parsed.body.innerHTML : raw;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-99999px";
    iframe.style.top = "0";
    iframe.style.width = "794px";
    iframe.style.height = "1123px";
    iframe.style.background = "#fff";
    iframe.style.border = "0";

    iframe.srcdoc = `
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        ${estilos}
                <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #000;
            box-sizing: border-box;
          }

          * {
            box-sizing: border-box;
          }

          body {
            padding: 34px 34px 42px;
          }

          img, table {
            max-width: 100% !important;
            height: auto !important;
          }

          h1, h2, h3 {
            white-space: normal !important;
            word-break: normal !important;
            overflow-wrap: break-word !important;
          }
        </style>
      </head>
      <body>${bodyHTML}</body>
      </html>
    `;

    document.body.appendChild(iframe);

    await new Promise(resolve => {
      iframe.onload = resolve;
      setTimeout(resolve, 900);
    });

       const doc = iframe.contentDocument || iframe.contentWindow.document;

    if (doc.fonts?.ready) {
      try { await doc.fonts.ready; } catch (_) {}
    }
    await new Promise(resolve => setTimeout(resolve, 250));

    const body = doc.body;

    const canvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      width: body.scrollWidth,
      height: body.scrollHeight,
      windowWidth: body.scrollWidth,
      windowHeight: body.scrollHeight,
      scrollX: 0,
      scrollY: 0
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4"
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;

    const imgW = pageW - margin * 2;
    const imgH = canvas.height * imgW / canvas.width;
    const pageContentH = pageH - margin * 2;

    let y = margin;
    let remaining = imgH;

    pdf.addImage(imgData, "JPEG", margin, y, imgW, imgH);
    remaining -= pageContentH;

    while (remaining > 0) {
      y -= pageContentH;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, y, imgW, imgH);
      remaining -= pageContentH;
    }

    const nombre = String(tema.titulo || "recurso-rh")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 90);

    pdf.save(`${nombre}.pdf`);

    iframe.remove();
  } catch (err) {
    console.error(err);
    alert("No pude generar el PDF del recurso.");
  }
};

async function rhObtenerJsPDF() {
  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  await new Promise((resolve, reject) => {
    const yaExiste = Array.from(document.scripts).some(s =>
      s.src.includes("jspdf.umd.min.js")
    );

    if (yaExiste) {
      setTimeout(resolve, 300);
      return;
    }

    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });

  if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;

  throw new Error("jsPDF no cargó.");
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

function hNormalizarRegistro(data = {}) {
  return {
    nombre: hValor(data.nombre),
    apellido: hValor(data.apellido),
    direccion: hValor(data.direccion),
    telefono: hValor(data.telefono),
    pedidosOracion: hValor(data.pedidosOracion),
    notas: hValor(data.notas),
    mail: hValor(data.mail),
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

        .hermano-grid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap:10px 14px;
        }

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

          #modalHermanoBox{
            padding:14px;
            border-radius:16px;
          }
        }
      </style>

      <div id="hermanosWrap">

        <div id="hermanosTop">
          <div id="hermanosTopLeft">
            <h3>Hermanos</h3>
            <div id="hermanosCount">0 registros</div>
          </div>

          <div id="hermanosActions">
            <input
              id="hermanosBuscar"
              type="text"
              placeholder="Buscar por nombre, apellido, teléfono o mail"
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
      <div class="hermano-card">
        <div class="hermano-top">
          <div>
            <div class="hermano-nombre">${hEscape(nombreCompleto)}</div>
            <div class="hermano-mail">${h.mail ? hEscape(h.mail) : "Sin mail"}</div>
          </div>
        </div>

        <div class="hermano-grid">
          <div class="hermano-campo">
            <div class="hermano-campo-label">Dirección</div>
            <div class="hermano-campo-valor">${hEscape(h.direccion || "—")}</div>
          </div>

          <div class="hermano-campo">
            <div class="hermano-campo-label">Teléfono</div>
            <div class="hermano-campo-valor">${hEscape(h.telefono || "—")}</div>
          </div>

          <div class="hermano-campo">
            <div class="hermano-campo-label">Pedidos de oración</div>
            <div class="hermano-campo-valor">${hEscape(h.pedidosOracion || "—")}</div>
          </div>

          <div class="hermano-campo">
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
    `;
  }).join("");
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
  const mail = document.getElementById("hermanoMail");
  const direccion = document.getElementById("hermanoDireccion");
  const pedidos = document.getElementById("hermanoPedidos");
  const notas = document.getElementById("hermanoNotas");

  if (nombre) nombre.value = item.nombre || "";
  if (apellido) apellido.value = item.apellido || "";
  if (telefono) telefono.value = item.telefono || "";
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

  const data = hNormalizarRegistro({
    nombre: document.getElementById("hermanoNombre")?.value,
    apellido: document.getElementById("hermanoApellido")?.value,
    telefono: document.getElementById("hermanoTelefono")?.value,
    mail: document.getElementById("hermanoMail")?.value,
    direccion: document.getElementById("hermanoDireccion")?.value,
    pedidosOracion: document.getElementById("hermanoPedidos")?.value,
    notas: document.getElementById("hermanoNotas")?.value,
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

window.enviarHermanoPorWhatsApp = (id) => {
  const item = hermanosCache.find(x => x.id === id);
  if (!item) return;

  const texto = [
    `Ficha de hermano`,
    ``,
    `Nombre: ${item.nombre || ""}`,
    `Apellido: ${item.apellido || ""}`,
    `Dirección: ${item.direccion || ""}`,
    `Teléfono: ${item.telefono || ""}`,
    `Mail: ${item.mail || ""}`,
    `Pedidos de oración: ${item.pedidosOracion || ""}`,
    `Notas: ${item.notas || ""}`
  ].join("\n");

  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
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
