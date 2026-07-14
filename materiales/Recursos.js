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

// ✅ abrir Ediciones por defecto
window.mostrarRecursosSub = async (sub = "ediciones") => {
  const esAdmin = !!window.__ES_ADMIN;
  const esColab = !!window.__ES_COLABORADOR;
  const puedeVerRecursos = esAdmin || esColab;

  // ✅ Recursos solo admin o colaborador.
// Si por algún estado viejo se intenta abrir sin permiso,
// volvemos a Compartidos/Todo.
if (!puedeVerRecursos) {
  try {
    if (typeof window.irA === "function") {
      window.irA("compartidos");
    } else if (typeof window.forzarSeccionActiva === "function") {
      window.forzarSeccionActiva("compartidos");
    }
  } catch (e) {
    console.warn("No pude mandar a Compartidos:", e);
  }

  return;
}

  const permitidas = ["rh", "talleres", "hermanos", "permisos", "ediciones"];
  if (!permitidas.includes(sub)) sub = "ediciones";

  // ✅ Permisos solo admin.
  // Si un colaborador intenta entrar a Permisos, lo mandamos a Ediciones.
  if (sub === "permisos" && !esAdmin) {
    sub = "ediciones";
  }

  // ✅ guardar estado interno: Iglesia > Recursos > sub
  window.__IGLESIA_SUB_ACTIVA = "recursos";
  window.__RECURSOS_SUB_ACTIVA = sub;

  try {
    window.guardarEstadoBiblia?.({
      seccion: "iglesia",
      subIglesia: "recursos",
      subRecursos: sub
    });
  } catch(e) {}

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

    // ✅ Ocultar botón Permisos dentro de Recursos si NO es admin
    const btnPermisos = document.getElementById("btnTabPermisos");
    if (btnPermisos) {
      btnPermisos.style.display = esAdmin ? "inline-flex" : "none";
    }
  }

  if (sub === "rh") {
    await mostrarRH();
  }

  if (sub === "hermanos") {
    await mostrarHermanos();
  }

  if (sub === "permisos") {
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

function rhPuedeDescargarAndroid() {
  return !!(
    window.AndroidVida &&
    typeof window.AndroidVida.descargarArchivoBase64 === "function"
  );
}

function rhBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const res = String(reader.result || "");
      resolve(res.includes(",") ? res.split(",")[1] : res);
    };

    reader.onerror = () => {
      reject(new Error("No pude preparar el PDF para Android."));
    };

    reader.readAsDataURL(blob);
  });
}

async function rhDescargarArchivo(url, nombreArchivo) {
  if (!url) {
    alert("No encontré el PDF para descargar.");
    return;
  }

  const nombreFinal = nombreArchivo || "RH.pdf";

  if (rhPuedeDescargarAndroid()) {
    try {
      const r = await fetch(encodeURI(url), {
        cache: "no-store"
      });

      if (!r.ok) {
        throw new Error("No pude leer el PDF.");
      }

      const blob = await r.blob();
      const base64 = await rhBlobToBase64(blob);

      window.AndroidVida.descargarArchivoBase64(
        nombreFinal,
        blob.type || "application/pdf",
        base64
      );

      return;

    } catch (e) {
      console.warn("No pude descargar PDF RH con Android, uso descarga web:", e);
    }
  }

  const a = document.createElement("a");
  a.href = encodeURI(url);
  a.download = nombreFinal;
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

window.descargarPDFRHActual = async (index = rhIndex) => {
  const tema = RH_TEMAS[index];

  if (!tema?.pdf) {
    alert("Este módulo todavía no tiene PDF cargado.");
    return;
  }

  await rhDescargarArchivo(tema.pdf, rhNombreDescarga(tema.titulo || "RH"));
  cerrarOpcionesPDFRH();
};

window.descargarPDFRHCompleto = async () => {
  await rhDescargarArchivo(RH_PDF_COMPLETO, "RH_COMPLETO.pdf");
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

function hMailKey(v = "") {
  return String(v || "").trim().toLowerCase();
}

function hCrearPedidoId() {
  return (
    "p_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10)
  );
}

function hFechaHoraArgentina(ts = Date.now()) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      dateStyle: "short",
      timeStyle: "medium"
    }).format(new Date(Number(ts) || Date.now()));
  } catch {
    return new Date(Number(ts) || Date.now()).toLocaleString();
  }
}

function hFechaYMDDesdeTs(ts = Date.now()) {
  const d = new Date(Number(ts) || Date.now());

  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const y = partes.find(p => p.type === "year")?.value || "";
  const m = partes.find(p => p.type === "month")?.value || "";
  const dia = partes.find(p => p.type === "day")?.value || "";

  return `${y}-${m}-${dia}`;
}

function hFechaDesdeTextoLegacyPedido(txt = "") {
  const s = String(txt || "");
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);

  if (!m) return "sin-fecha";

  const dia = String(m[1]).padStart(2, "0");
  const mes = String(m[2]).padStart(2, "0");
  const anio = String(m[3]);

  return `${anio}-${mes}-${dia}`;
}

function hPedidoFechaBonita(key = "") {
  if (!key || key === "sin-fecha") return "Sin fecha";

  const partes = String(key).split("-");
  if (partes.length === 3) {
    const [y, m, d] = partes;
    return `${d}/${m}/${y}`;
  }

  return key;
}

function hNormalizarPedidoOracionItem(p, idFallback = "") {
  const texto = typeof p === "string"
    ? hValor(p)
    : hValor(p?.texto || p?.pedido || p?.detalle || "");

  if (!texto) return null;

  const ts = Number(p?.ts || p?.creadoEn || p?.fechaTs || 0) || 0;

  return {
    id: hValor(p?.id || idFallback || hCrearPedidoId()),
    texto,
    fecha: hValor(p?.fecha) || (ts ? hFechaYMDDesdeTs(ts) : "sin-fecha"),
    fechaTexto: hValor(p?.fechaTexto) || (ts ? hFechaHoraArgentina(ts) : ""),
    ts,
    origen: hValor(p?.origen || ""),
    mail: hValor(p?.mail || ""),
    uid: hValor(p?.uid || "")
  };
}

function hNormalizarPedidosOracionLista(lista) {
  const out = [];

  if (Array.isArray(lista)) {
    lista.forEach((p, i) => {
      const item = hNormalizarPedidoOracionItem(p, p?.id || `pedido_${i}`);
      if (item) out.push(item);
    });
  } else if (lista && typeof lista === "object") {
    Object.entries(lista).forEach(([id, p]) => {
      const item = hNormalizarPedidoOracionItem(p, id);
      if (item) out.push(item);
    });
  }

  out.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  return out;
}

function hPedidosDeHermano(h = {}) {
  const pedidos = Array.isArray(h.pedidosOracionLista)
    ? [...h.pedidosOracionLista]
    : hNormalizarPedidosOracionLista(h.pedidosOracionLista);

  const legado = hValor(h.pedidosOracion);

  if (legado) {
    pedidos.push({
      id: "legacy",
      texto: legado,
      fecha: hFechaDesdeTextoLegacyPedido(legado),
      fechaTexto: "",
      ts: 0,
      origen: "legacy"
    });
  }

  return pedidos;
}

function hTextoPedidosBusqueda(h = {}) {
  return hPedidosDeHermano(h).map(p => p.texto).join(" ");
}

function hRenderPedidosOracion(h = {}) {
  const pedidos = hPedidosDeHermano(h);

  if (!pedidos.length) return "—";

  const grupos = [];
  const mapa = {};

  pedidos.forEach(p => {
    const key = p.fecha || "sin-fecha";

    if (!mapa[key]) {
      mapa[key] = {
        fecha: key,
        items: []
      };
      grupos.push(mapa[key]);
    }

    mapa[key].items.push(p);
  });

  return `
    <div class="pedidos-oracion-wrap">${grupos.map(g => `
      <details class="pedido-fecha-grupo">
        <summary>
          <span class="pedido-fecha-info">
            <i class="fa-solid fa-person-praying"></i>
            <span>${hEscape(hPedidoFechaBonita(g.fecha))}</span>
          </span>
          <span class="pedido-fecha-cantidad">${g.items.length}</span>
          <i class="fa-solid fa-caret-down pedido-caret"></i>
        </summary>
        <div class="pedido-fecha-items">${g.items.map(p => `
          <label class="pedido-oracion-item">
            <input
              type="checkbox"
              class="pedido-check"
              data-hermano-id="${hEscape(h.id)}"
              data-pedido-id="${hEscape(p.id)}"
              onchange="hActualizarPedidosSeleccionados()"
              onclick="event.stopPropagation()"
            >
            <span class="pedido-check-fake" aria-hidden="true">
              <i class="fa-regular fa-square-full icon-unchecked"></i>
              <i class="fa-solid fa-square-check icon-checked"></i>
            </span>
            <span class="pedido-oracion-body">${p.fechaTexto ? `<small>${hEscape(p.fechaTexto)}</small>` : ``}<span class="pedido-oracion-texto">${hEscape(p.texto)}</span></span>
          </label>
        `).join("")}</div>
      </details>
    `).join("")}</div>
  `;
}

function hGetPedidosSeleccionados() {
  const checks = Array.from(document.querySelectorAll("#hermanosLista .pedido-check:checked"));
  const out = [];

  checks.forEach(ch => {
    const hermanoId = ch.dataset.hermanoId || "";
    const pedidoId = ch.dataset.pedidoId || "";

    const hermano = hermanosCache.find(x => x.id === hermanoId);
    if (!hermano) return;

    const pedido = hPedidosDeHermano(hermano).find(p => p.id === pedidoId);
    if (!pedido) return;

    out.push({
      hermano,
      pedido
    });
  });

  return out;
}

function hTextoPedidosSeleccionados() {
  const items = hGetPedidosSeleccionados();

  const lineas = [
    "Pedidos de oración",
    ""
  ];

  items.forEach(({ hermano, pedido }) => {
    const nombre = `${hermano.nombre || ""} ${hermano.apellido || ""}`.trim() || "Sin nombre";
    const telefono = hValor(hermano.telefono || "Sin teléfono");

    lineas.push(`${hPedidoFechaBonita(pedido.fecha)} — ${nombre}`);
    lineas.push(`Teléfono: ${telefono}`);
    lineas.push(pedido.texto);
    lineas.push("");
  });

  return lineas.join("\n").trim();
}

function hGetPedidosVisiblesChecks() {
  return Array.from(document.querySelectorAll("#hermanosLista .pedido-check"));
}

function hTodasOracionesVisiblesMarcadas() {
  const checks = hGetPedidosVisiblesChecks();
  return checks.length > 0 && checks.every(ch => ch.checked);
}

function hRefrescarBotonMarcarOraciones() {
  const btn = document.getElementById("btnToggleMarcarPedidos");
  if (!btn) return;

  const todasMarcadas = hTodasOracionesVisiblesMarcadas();

  btn.classList.toggle("activo", todasMarcadas);

  btn.innerHTML = todasMarcadas
    ? `
      <i class="fa-solid fa-square-check"></i>
      <span>Oraciones marcadas</span>
    `
    : `
      <i class="fa-regular fa-square-full"></i>
      <span>Marcar Oraciones</span>
    `;
}

window.hActualizarPedidosSeleccionados = () => {
  const total = hGetPedidosSeleccionados().length;
  const btnImprimir = document.getElementById("btnImprimirPedidosSeleccionados");
  const btnEnviar = document.getElementById("btnEnviarPedidosSeleccionados");

  hRefrescarBotonMarcarOraciones();

  if (btnImprimir) {
    btnImprimir.innerHTML = `
      <i class="fa-solid fa-print"></i>
      <span>Imprimir${total ? ` (${total})` : ""}</span>
    `;
  }

  if (btnEnviar) {
    btnEnviar.innerHTML = `
      <i class="fa-solid fa-share-nodes"></i>
      <span>Compartir${total ? ` (${total})` : ""}</span>
    `;
  }
};

window.hToggleMarcarPedidosVisibles = () => {
  const marcar = !hTodasOracionesVisiblesMarcadas();

  hGetPedidosVisiblesChecks().forEach(ch => {
    ch.checked = marcar;
  });

  hActualizarPedidosSeleccionados();
};

window.hMarcarPedidosVisibles = (marcar = true) => {
  hGetPedidosVisiblesChecks().forEach(ch => {
    ch.checked = !!marcar;
  });

  hActualizarPedidosSeleccionados();
};

window.hImprimirPedidosSeleccionados = () => {
  const items = hGetPedidosSeleccionados();

  if (!items.length) {
    alert("Marcá al menos un pedido de oración.");
    return;
  }

  const html = `
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Pedidos de oración</title>
      <style>
        body{
          font-family:Arial, sans-serif;
          color:#000;
          padding:24px;
          line-height:1.45;
        }

        h1{
          margin:0 0 18px;
          font-size:24px;
        }

        .pedido-print{
          border:1px solid #ddd;
          border-radius:12px;
          padding:12px 14px;
          margin-bottom:12px;
          break-inside:avoid;
        }

        .pedido-print h2{
          font-size:16px;
          margin:0 0 8px;
        }

        .pedido-print p{
          white-space:pre-wrap;
          margin:0;
        }
      </style>
    </head>
    <body>
      <h1>Pedidos de oración</h1>

      ${items.map(({ hermano, pedido }) => {
        const nombre = `${hermano.nombre || ""} ${hermano.apellido || ""}`.trim() || "Sin nombre";
        const telefono = hValor(hermano.telefono || "Sin teléfono");

        return `
          <div class="pedido-print">
            <h2>${hEscape(hPedidoFechaBonita(pedido.fecha))} — ${hEscape(nombre)}</h2>
            <div style="font-weight:700; margin-bottom:8px;">
              Teléfono: ${hEscape(telefono)}
            </div>
            <p>${hEscape(pedido.texto)}</p>
          </div>
        `;
      }).join("")}

      <script>
        window.onload = () => {
          window.print();
        };
      <\/script>
    </body>
    </html>
  `;

  const w = window.open("", "_blank");
  if (!w) {
    alert("El navegador bloqueó la ventana de impresión.");
    return;
  }

  w.document.open();
  w.document.write(html);
  w.document.close();
};

window.hEnviarPedidosSeleccionados = () => {
  const texto = hTextoPedidosSeleccionados();

  if (!texto) {
    alert("Marcá al menos un pedido de oración.");
    return;
  }

  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
};

function hNormalizarRegistro(data = {}) {
  return {
    nombre: hValor(data.nombre),
    apellido: hValor(data.apellido),
    direccion: hValor(data.direccion),
    telefono: hValor(data.telefono),
    cumpleanos: hValor(data.cumpleanos),

    // texto viejo, se conserva para no perder nada
    pedidosOracion: hValor(data.pedidosOracion),

    // sistema nuevo: pedidos separados, agrupables por fecha
    pedidosOracionLista: hNormalizarPedidosOracionLista(data.pedidosOracionLista),

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
          width:100%;
          max-width:100%;
          min-width:0;
          display:grid;
          grid-template-columns: minmax(0, 1fr) auto auto auto auto;
          gap:8px;
          align-items:center;
          overflow:hidden;
        }

        .hermanosBtnAccion,
        #hermanosBtnNuevo{
          min-height:38px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          white-space:nowrap;
          min-width:0;
          box-sizing:border-box;
        }

        #hermanosBtnNuevo{
          width:160px;
        }

        #btnToggleMarcarPedidos{
          width:178px;
        }

        #btnImprimirPedidosSeleccionados{
          width:110px;
        }

        #btnEnviarPedidosSeleccionados{
          width:118px;
        }

        .hermanosBtnAccion i,
        #hermanosBtnNuevo i{
          color:#000;
          font-size:14px;
          line-height:1;
        }

        #hermanosBuscar{
          min-width:0;
          max-width:none;
          width:100%;
          border:1px solid rgba(0,0,0,.14);
          border-radius:999px;
          padding:10px 14px;
          outline:none;
          font-size:14px;
          box-sizing:border-box;
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
          padding:10px;
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
  margin-top:8px;
}

.hermano-card.abierta .hermano-detalle{
  display:block;
}
        
.hermano-nombre-linea{
  display:flex;
  align-items:center;
  gap:8px;
  flex-wrap:wrap;
}

.hermano-cumple-mini{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:3px 8px;
  border-radius:999px;
  background:rgba(188,220,255,.55);
  font-size:12px;
  font-weight:900;
}

.hermano-datos-linea{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap:8px;
  margin-bottom:8px;
}

.hermano-grid{
  display:grid;
  grid-template-columns: 1fr;
  grid-template-areas:
    "pedidos"
    "notas";
  gap:8px;
}

.hermano-campo-pedidos{ grid-area: pedidos; }
.hermano-campo-notas{ grid-area: notas; }
        .hermano-campo{
          background: rgba(0,0,0,.03);
          border-radius:12px;
          padding:8px 10px;
        }

        .hermano-campo-label{
          font-size:12px;
          font-weight:700;
          opacity:.75;
          margin-bottom:4px;
        }

        .hermano-campo-valor{
          font-size:14px;
          line-height:1.35;
          white-space:normal;
          word-break:break-word;
        }

        .hermano-campo-notas .hermano-campo-valor{
          white-space:pre-wrap;
        }

        .hermano-campo-pedidos{
          padding:6px 8px;
        }

        .hermano-campo-pedidos .hermano-campo-label{
          margin-bottom:6px;
        }

        .hermano-campo-pedidos .hermano-campo-valor{
          white-space:normal !important;
          line-height:1.25;
        }

        .hermanosBtnAccion{
          border:none;
          cursor:pointer;
          border-radius:999px;
          padding:10px 14px;
          background: var(--ui-azul-claro, #bcdcff);
          color:#000;
          font-weight:700;
        }

        .hermanosBtnAccion.secundario{
          background:#fff;
          border:1px solid rgba(0,0,0,.10);
        }

          #btnToggleMarcarPedidos.activo{
          background: var(--ui-azul-hover, #a6d0ff);
          border-color: rgba(0,0,0,.12);
        }

        .pedidos-oracion-wrap{
          display:grid;
          gap:4px;
          margin:0;
          padding:0;
        }

        .pedido-fecha-grupo{
          background:#fff;
          border:1px solid rgba(0,0,0,.08);
          border-radius:10px;
          overflow:hidden;
          margin:0;
        }

        .pedido-fecha-grupo summary{
          cursor:pointer;
          list-style:none;
          padding:5px 8px;
          min-height:32px;
          display:grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items:center;
          gap:7px;
          font-weight:900;
          background:rgba(188,220,255,.45);
        }

        .pedido-fecha-grupo summary::-webkit-details-marker{
          display:none;
        }

        .pedido-fecha-info{
          display:inline-flex;
          align-items:center;
          gap:7px;
          min-width:0;
        }

        .pedido-fecha-info i{
          color:#000;
          font-size:13px;
        }

        .pedido-fecha-cantidad{
          min-width:22px;
          text-align:center;
          font-weight:900;
        }

        .pedido-caret{
          color:#000;
          transition:transform .18s ease;
        }

        .pedido-fecha-grupo[open] .pedido-caret{
          transform:rotate(180deg);
        }

        .pedido-fecha-items{
          display:grid;
          gap:5px;
          padding:6px 5px;
          margin:0;
        }

        .pedido-oracion-item{
          position:relative;
          display:block;
          padding:7px 32px 7px 5px;
          border-radius:10px;
          background:rgba(0,0,0,.035);
          cursor:pointer;
          min-height:0;
          margin:0;
        }

        .pedido-oracion-item .pedido-check{
          position:absolute;
          opacity:0;
          pointer-events:none;
        }

        .pedido-check-fake{
          position:absolute;
          top:7px;
          right:8px;
          width:20px;
          height:20px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:#000;
          margin:0;
          line-height:1;
        }

        .pedido-check-fake .icon-checked{
          display:none;
        }

        .pedido-oracion-item .pedido-check:checked + .pedido-check-fake .icon-unchecked{
          display:none;
        }

        .pedido-oracion-item .pedido-check:checked + .pedido-check-fake .icon-checked{
          display:inline-block;
        }

        .pedido-oracion-body{
          display:block;
          min-width:0;
          margin:0;
          padding:0;
        }

        .pedido-oracion-body small{
          display:block;
          opacity:.7;
          font-size:12px;
          line-height:1.15;
          margin:0 0 4px 0;
          padding:0;
          text-align:left;
        }

        .pedido-oracion-texto{
          display:block;
          white-space:pre-wrap;
          word-break:break-word;
          line-height:1.28;
          text-align:left;
          margin:0;
          padding:0;
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
            max-width:100%;
            min-width:0;
            display:grid;
            grid-template-columns: minmax(0, 1fr) 54px 54px 54px 54px;
            gap:8px;
            align-items:center;
            overflow:hidden;
          }

          #hermanosBuscar{
            grid-column:1 / -1;
            width:100%;
            min-width:0;
            max-width:100%;
            box-sizing:border-box;
          }

          .hermanosBtnAccion,
          #hermanosBtnNuevo{
            width:100%;
            min-width:0;
            max-width:100%;
            height:54px;
            min-height:54px;
            padding:0;
            border-radius:999px;
            box-sizing:border-box;
          }

          #hermanosBtnNuevo{
            width:100%;
          }

          #btnToggleMarcarPedidos,
          #btnImprimirPedidosSeleccionados,
          #btnEnviarPedidosSeleccionados{
            width:54px;
          }

          .hermanosBtnAccion span,
          #hermanosBtnNuevo span{
            display:none;
          }

         .hermano-grid,
          .hermano-form-grid{
            grid-template-columns: 1fr;
          }

          .hermano-datos-linea{
            grid-template-columns:1fr;
          }

          .hermano-grid{
            grid-template-areas:
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
  <button id="hermanosBtnNuevo" type="button" onclick="abrirNuevoHermano()" title="Agregar contacto">
    <i class="fa-solid fa-plus"></i>
    <span>Agregar contacto</span>
  </button>
` : ``}

<button
  id="btnToggleMarcarPedidos"
  class="hermanosBtnAccion secundario"
  type="button"
  onclick="hToggleMarcarPedidosVisibles()"
  title="Marcar Oraciones"
>
  <i class="fa-regular fa-square-full"></i>
  <span>Marcar Oraciones</span>
</button>

<button id="btnImprimirPedidosSeleccionados" class="hermanosBtnAccion" type="button" onclick="hImprimirPedidosSeleccionados()" title="Imprimir">
  <i class="fa-solid fa-print"></i>
  <span>Imprimir</span>
</button>

<button id="btnEnviarPedidosSeleccionados" class="hermanosBtnAccion" type="button" onclick="hEnviarPedidosSeleccionados()" title="Compartir">
  <i class="fa-solid fa-share-nodes"></i>
  <span>Compartir</span>
</button>
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
          hTextoPedidosBusqueda(h),
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
        ${q ? "No encontré resultados para esa búsqueda." : "Todavía no hay contactos cargados."}
      </div>
    `;
    return;
  }

  lista.innerHTML = filtrados.map(h => {
    const nombreCompleto = `${h.nombre || ""} ${h.apellido || ""}`.trim() || "Sin nombre";
    const cumple = hFechaCumple(h.cumpleanos);

    return `
      <div class="hermano-card" id="hermanoCard_${h.id}">
        
        <button type="button" class="hermano-resumen" onclick="toggleHermanoCard('${h.id}')">
          <div class="hermano-resumen-info">
            <div class="hermano-nombre-linea">
              <span class="hermano-nombre">${hEscape(nombreCompleto)}</span>
              ${cumple ? `<span class="hermano-cumple-mini">${hEscape(cumple)}</span>` : ``}
            </div>

            <div class="hermano-resumen-tel">
              <i class="fa-brands fa-whatsapp"></i>
              ${hEscape(h.telefono || "Sin teléfono")}
            </div>
          </div>

          <div class="hermano-resumen-icono">
            <i class="fa-solid fa-caret-down"></i>
          </div>
        </button>

        <div class="hermano-detalle">
          <div class="hermano-datos-linea">
            <div class="hermano-campo">
              <div class="hermano-campo-label">Mail</div>
              <div class="hermano-campo-valor">${h.mail ? hEscape(h.mail) : "Sin mail"}</div>
            </div>

            <div class="hermano-campo">
              <div class="hermano-campo-label">Dirección</div>
              <div class="hermano-campo-valor">${hEscape(h.direccion || "—")}</div>
            </div>
          </div>

          <div class="hermano-grid">
            <div class="hermano-campo hermano-campo-pedidos">
              <div class="hermano-campo-label">Pedidos de oración</div>
              <div class="hermano-campo-valor">${hRenderPedidosOracion(h)}</div>
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

  hActualizarPedidosSeleccionados();
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
pedidosOracionLista: actualEditando?.pedidosOracionLista || [],
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

// ================= 🙏 PEDIDO DE ORACIÓN DESDE LA APP =================

function hSepararNombreApellido(display = "") {
  const partes = String(display || "").trim().split(/\s+/).filter(Boolean);

  return {
    nombre: partes.shift() || "",
    apellido: partes.join(" ")
  };
}

async function hBuscarHermanoPorMail(mail = "") {
  const buscado = hMailKey(mail);
  if (!buscado) return null;

  let encontrado = hermanosCache.find(h => hMailKey(h.mail) === buscado);
  if (encontrado) return encontrado;

  const db = window.__FB?.db;
  if (!db) return null;

  try {
    const snap = await get(ref(db, "hermanos"));
    const val = snap.val() || {};

    const lista = Object.entries(val).map(([id, item]) => ({
      id,
      ...hNormalizarRegistro(item)
    }));

    encontrado = lista.find(h => hMailKey(h.mail) === buscado);
    return encontrado || null;
  } catch (e) {
    console.warn("No pude buscar hermano por mail:", e);
    return null;
  }
}

window.abrirPedidoOracionUsuario = async () => {
  const viejo = document.getElementById("modalPedidoOracionUsuario");
  if (viejo) viejo.remove();

  const styleViejo = document.getElementById("modalPedidoOracionUsuarioStyle");
  if (styleViejo) styleViejo.remove();

  const user = window.__FB?.auth?.currentUser || window.__AUTH?.currentUser || null;
  const nombreSplit = hSepararNombreApellido(user?.displayName || "");

  const modal = document.createElement("div");
  modal.id = "modalPedidoOracionUsuario";

  modal.innerHTML = `
    <div class="pedido-usuario-box">
      <button type="button" class="pedido-usuario-x" onclick="cerrarPedidoOracionUsuario()">×</button>

      <div class="pedido-usuario-icono">
        <i class="fa-solid fa-person-praying"></i>
      </div>

      <h2>Pedido de oración</h2>

      <p>
        Primero escribí tu pedido. Después completá tus datos para poder guardarlo correctamente.
      </p>

      <input id="pedidoUsuarioHermanoId" type="hidden">

      <label>
        Pedido de oración
        <textarea id="pedidoUsuarioTexto" placeholder="Escribí aquí tu pedido de oración..." required></textarea>
      </label>

      <label>
        Mail
        <input id="pedidoUsuarioMail" type="email" value="${hEscape(user?.email || "")}" placeholder="tu mail" required>
      </label>

      <div class="pedido-usuario-grid">
        <label>
          Nombre
          <input id="pedidoUsuarioNombre" type="text" value="${hEscape(nombreSplit.nombre)}" placeholder="Nombre">
        </label>

        <label>
          Apellido
          <input id="pedidoUsuarioApellido" type="text" value="${hEscape(nombreSplit.apellido)}" placeholder="Apellido">
        </label>
      </div>

      <label>
        Teléfono opcional
        <input id="pedidoUsuarioTelefono" type="text" placeholder="Teléfono">
      </label>

      <button type="button" id="btnGuardarPedidoUsuario" onclick="guardarPedidoOracionUsuario()">
        Guardar pedido
      </button>

      <div id="pedidoUsuarioEstado"></div>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "modalPedidoOracionUsuarioStyle";
  style.textContent = `
    #modalPedidoOracionUsuario{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .pedido-usuario-box{
      position:relative;
      width:min(520px, 96vw);
      max-height:92vh;
      overflow:auto;
      background:#fff;
      color:#000;
      border-radius:24px;
      padding:20px;
      box-shadow:0 22px 70px rgba(0,0,0,.30);
      display:grid;
      gap:12px;
    }

    .pedido-usuario-x{
      position:absolute;
      top:10px;
      right:12px;
      width:34px;
      height:34px;
      border:none;
      border-radius:999px;
      background:rgba(0,0,0,.06);
      cursor:pointer;
      font-size:24px;
      line-height:1;
    }

    .pedido-usuario-icono{
      width:56px;
      height:56px;
      border-radius:999px;
      background:var(--ui-azul-claro, #bcdcff);
      color:#000;
      display:flex;
      align-items:center;
      justify-content:center;
      margin:0 auto;
      font-size:26px;
    }

    .pedido-usuario-box h2{
      text-align:center;
      margin:0;
      font-size:24px;
      font-weight:900;
    }

    .pedido-usuario-box p{
      text-align:center;
      margin:0;
      line-height:1.45;
      font-size:14px;
      opacity:.82;
    }

    .pedido-usuario-box label{
      display:grid;
      gap:6px;
      font-size:13px;
      font-weight:800;
    }

    .pedido-usuario-box input,
    .pedido-usuario-box textarea{
      width:100%;
      border:1px solid rgba(0,0,0,.16);
      border-radius:14px;
      padding:11px 12px;
      font-family:inherit;
      font-size:15px;
      outline:none;
      box-sizing:border-box;
      background:#fff;
      color:#000;
    }

    .pedido-usuario-box textarea{
      min-height:170px;
      resize:vertical;
    }

    .pedido-usuario-grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:10px;
    }

    #btnGuardarPedidoUsuario{
      border:none;
      border-radius:999px;
      padding:12px 16px;
      background:var(--ui-azul-hover, #1c6fcb);
      color:#fff;
      font-weight:900;
      cursor:pointer;
      font-size:15px;
    }

    #btnGuardarPedidoUsuario:disabled{
      opacity:.65;
      cursor:wait;
    }

    #pedidoUsuarioEstado{
      text-align:center;
      font-size:14px;
      font-weight:800;
      min-height:20px;
    }

    @media(max-width:640px){
      .pedido-usuario-grid{
        grid-template-columns:1fr;
      }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  const mailInput = document.getElementById("pedidoUsuarioMail");
  if (mailInput) {
    mailInput.addEventListener("blur", hCompletarPedidoUsuarioPorMail);
  }

  setTimeout(hCompletarPedidoUsuarioPorMail, 80);
};

window.cerrarPedidoOracionUsuario = () => {
  document.getElementById("modalPedidoOracionUsuario")?.remove();
  document.getElementById("modalPedidoOracionUsuarioStyle")?.remove();
};

window.cerrarMisPedidosOracionUsuario = () => {
  document.getElementById("modalMisPedidosOracionUsuario")?.remove();
  document.getElementById("modalMisPedidosOracionUsuarioStyle")?.remove();
};

window.abrirMisPedidosOracionUsuario = async () => {
  const viejo = document.getElementById("modalMisPedidosOracionUsuario");
  if (viejo) viejo.remove();

  const styleViejo = document.getElementById("modalMisPedidosOracionUsuarioStyle");
  if (styleViejo) styleViejo.remove();

  const user = window.__FB?.auth?.currentUser || window.__AUTH?.currentUser || null;
  const mail = hValor(user?.email || "").toLowerCase();

  const modal = document.createElement("div");
  modal.id = "modalMisPedidosOracionUsuario";

  const style = document.createElement("style");
  style.id = "modalMisPedidosOracionUsuarioStyle";
  style.textContent = `
    #modalMisPedidosOracionUsuario{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .mis-pedidos-box{
      position:relative;
      width:min(560px, 96vw);
      max-height:92vh;
      overflow:auto;
      background:#fff;
      color:#000;
      border-radius:24px;
      padding:20px;
      box-shadow:0 22px 70px rgba(0,0,0,.30);
      display:grid;
      gap:12px;
    }

    .mis-pedidos-x{
      position:absolute;
      top:10px;
      right:12px;
      width:34px;
      height:34px;
      border:none;
      border-radius:999px;
      background:rgba(0,0,0,.06);
      cursor:pointer;
      font-size:24px;
      line-height:1;
    }

    .mis-pedidos-box h2{
      text-align:center;
      margin:0;
      font-size:24px;
      font-weight:900;
    }

    .mis-pedidos-sub{
      text-align:center;
      opacity:.75;
      margin:0;
      line-height:1.4;
    }

    .mis-pedido-item{
      border:1px solid rgba(0,0,0,.10);
      border-radius:16px;
      padding:12px;
      background:rgba(188,220,255,.22);
      display:grid;
      gap:6px;
    }

    .mis-pedido-fecha{
      display:flex;
      align-items:center;
      gap:8px;
      font-weight:900;
    }

    .mis-pedido-texto{
      white-space:pre-wrap;
      line-height:1.4;
    }

    .mis-pedidos-actions{
      display:flex;
      justify-content:center;
      gap:10px;
      flex-wrap:wrap;
    }

    .mis-pedidos-actions button{
      border:none;
      border-radius:999px;
      padding:10px 14px;
      background:var(--ui-azul-claro, #bcdcff);
      color:#000;
      font-weight:900;
      cursor:pointer;
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);

  if (!mail) {
    modal.innerHTML = `
      <div class="mis-pedidos-box">
        <button type="button" class="mis-pedidos-x" onclick="cerrarMisPedidosOracionUsuario()">×</button>
        <h2>Mis pedidos de oración</h2>
        <p class="mis-pedidos-sub">Para ver tus pedidos necesitás iniciar sesión con mail.</p>

        <div class="mis-pedidos-actions">
          <button type="button" onclick="cerrarMisPedidosOracionUsuario(); abrirPedidoOracionUsuario();">
            Hacer pedido
          </button>
        </div>
      </div>
    `;
    return;
  }

  modal.innerHTML = `
    <div class="mis-pedidos-box">
      <button type="button" class="mis-pedidos-x" onclick="cerrarMisPedidosOracionUsuario()">×</button>
      <h2>Mis pedidos de oración</h2>
      <p class="mis-pedidos-sub">Buscando pedidos guardados con ${hEscape(mail)}...</p>
    </div>
  `;

  const hermano = await hBuscarHermanoPorMail(mail);
  const pedidos = hermano ? hPedidosDeHermano(hermano) : [];

  const box = modal.querySelector(".mis-pedidos-box");
  if (!box) return;

  box.innerHTML = `
    <button type="button" class="mis-pedidos-x" onclick="cerrarMisPedidosOracionUsuario()">×</button>
    <h2>Mis pedidos de oración</h2>

    <p class="mis-pedidos-sub">
      ${pedidos.length
        ? `Encontré ${pedidos.length} pedido${pedidos.length === 1 ? "" : "s"} asociado${pedidos.length === 1 ? "" : "s"} a tu mail.`
        : `No encontré pedidos asociados a tu mail.`}
    </p>

    ${pedidos.length ? `
      ${pedidos.map(p => `
        <div class="mis-pedido-item">
          <div class="mis-pedido-fecha">
            <i class="fa-solid fa-person-praying"></i>
            <span>${hEscape(hPedidoFechaBonita(p.fecha))}</span>
          </div>

          ${p.fechaTexto ? `<small>${hEscape(p.fechaTexto)}</small>` : ``}

          <div class="mis-pedido-texto">${hEscape(p.texto)}</div>
        </div>
      `).join("")}
    ` : ``}

    <div class="mis-pedidos-actions">
      <button type="button" onclick="cerrarMisPedidosOracionUsuario(); abrirPedidoOracionUsuario();">
        Hacer nuevo pedido
      </button>
    </div>
  `;
};

async function hCompletarPedidoUsuarioPorMail() {
  const mail = hValor(document.getElementById("pedidoUsuarioMail")?.value);
  const estado = document.getElementById("pedidoUsuarioEstado");
  const hidden = document.getElementById("pedidoUsuarioHermanoId");

  if (!mail) return;

  const h = await hBuscarHermanoPorMail(mail);

  if (!h) {
    if (hidden) hidden.value = "";
    if (estado) estado.textContent = "No encontré ficha con ese mail. Se creará una nueva.";
    return;
  }

  if (hidden) hidden.value = h.id || "";

  const nombre = document.getElementById("pedidoUsuarioNombre");
  const apellido = document.getElementById("pedidoUsuarioApellido");
  const telefono = document.getElementById("pedidoUsuarioTelefono");

  if (nombre && !hValor(nombre.value)) nombre.value = h.nombre || "";
  if (apellido && !hValor(apellido.value)) apellido.value = h.apellido || "";
  if (telefono && !hValor(telefono.value)) telefono.value = h.telefono || "";

  if (estado) {
    const nombreCompleto = `${h.nombre || ""} ${h.apellido || ""}`.trim();
    estado.textContent = `Encontré tu ficha${nombreCompleto ? `: ${nombreCompleto}` : ""}.`;
  }
}

window.guardarPedidoOracionUsuario = async () => {
  const db = window.__FB?.db;
  if (!db) {
    alert("Firebase no está listo.");
    return;
  }

  const btn = document.getElementById("btnGuardarPedidoUsuario");
  const estado = document.getElementById("pedidoUsuarioEstado");

  const mail = hValor(document.getElementById("pedidoUsuarioMail")?.value).toLowerCase();
  const nombre = hValor(document.getElementById("pedidoUsuarioNombre")?.value);
  const apellido = hValor(document.getElementById("pedidoUsuarioApellido")?.value);
  const telefono = hValor(document.getElementById("pedidoUsuarioTelefono")?.value);
  const pedido = hValor(document.getElementById("pedidoUsuarioTexto")?.value);

  if (!mail) {
    if (estado) estado.textContent = "Completá tu mail.";
    return;
  }

  if (!pedido) {
    if (estado) estado.textContent = "Escribí tu pedido de oración.";
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando...";
    }

    if (estado) estado.textContent = "";

    let hermano = await hBuscarHermanoPorMail(mail);

    if (!hermano && !nombre) {
      if (estado) estado.textContent = "Como no encontré una ficha con ese mail, escribí al menos tu nombre.";
      return;
    }

    const pedidoId = hCrearPedidoId();
    const ahora = Date.now();

    const pedidoObj = {
      id: pedidoId,
      texto: pedido,
      fecha: hFechaYMDArgentina(),
      fechaTexto: hFechaHoraArgentina(ahora),
      ts: ahora,
      origen: "app",
      mail,
      uid: window.__UID || ""
    };

    if (hermano) {
      await set(ref(db, `hermanos/${hermano.id}/pedidosOracionLista/${pedidoId}`), pedidoObj);

      const updates = [];

      if (!hValor(hermano.mail)) {
        updates.push(set(ref(db, `hermanos/${hermano.id}/mail`), mail));
      }

      if (!hValor(hermano.nombre) && nombre) {
        updates.push(set(ref(db, `hermanos/${hermano.id}/nombre`), nombre));
      }

      if (!hValor(hermano.apellido) && apellido) {
        updates.push(set(ref(db, `hermanos/${hermano.id}/apellido`), apellido));
      }

      if (!hValor(hermano.telefono) && telefono) {
        updates.push(set(ref(db, `hermanos/${hermano.id}/telefono`), telefono));
      }

      await Promise.all(updates);
    } else {
      const nuevoRef = push(ref(db, "hermanos"));

      await set(nuevoRef, {
        nombre,
        apellido,
        direccion: "",
        telefono,
        cumpleanos: "",
        pedidosOracion: "",
        pedidosOracionLista: {
          [pedidoId]: pedidoObj
        },
        notas: "",
        mail,
        tokenPedido: hCrearTokenPedido(),
        creadoPor: window.__UID || "",
        ts: ahora
      });
    }

    if (estado) estado.textContent = "Pedido guardado. Dios te bendiga 🙏";

    const txt = document.getElementById("pedidoUsuarioTexto");
    if (txt) txt.value = "";

    setTimeout(() => {
      cerrarPedidoOracionUsuario();

      try {
        if (typeof renderHermanosLista === "function") {
          renderHermanosLista();
        }
      } catch(e) {}
    }, 1200);

  } catch (e) {
    console.error(e);
    if (estado) estado.textContent = "No pude guardar el pedido. Revisá permisos o conexión.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar pedido";
    }
  }
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
