// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  get,
  push,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a",
 };

// ================= ☁️ R2 =================
// ✅ SIN FIREBASE FUNCTIONS: Biblia usa Cloudflare Worker + R2
const R2_WORKER_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

const R2_UPLOAD_URL = R2_WORKER_URL;
const R2_DOWNLOAD_URL = R2_WORKER_URL;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const VA_ANDROID_ID_TOKEN_KEY = "__VA_ANDROID_ID_TOKEN__";
let vaLoginAndroidEnCurso = false;

function vaEsAndroidAPK() {
  const ua = navigator.userAgent || "";

  let esPorUrl = false;

  try {
    const params = new URLSearchParams(window.location.search || "");
    esPorUrl = params.get("apk") === "1" || params.get("android") === "1";
  } catch (e) {}

  return (
    esPorUrl ||
    !!window.__VIDA_ANDROID_APK__ ||
    /VidaAbundanteAndroidApp/i.test(ua) ||
    localStorage.getItem("vida_abundante_android_apk") === "1"
  );
}

window.vaEsAndroidAPK = vaEsAndroidAPK;

window.vaIniciarSesionGoogle = function() {
  try {
    if (
      vaEsAndroidAPK() &&
      window.AndroidVida &&
      typeof window.AndroidVida.loginGoogle === "function"
    ) {
      window.AndroidVida.loginGoogle();
      return;
    }
  } catch (e) {}

  window.location.href = "login.html";
};

window.vaLoginAndroidError = function(mensaje = "") {
  alert("No pude iniciar sesión con Google: " + (mensaje || "intentá nuevamente."));
};

async function vaConsumirLoginAndroidPendiente() {
  const idToken = localStorage.getItem(VA_ANDROID_ID_TOKEN_KEY) || "";

  if (!idToken) return false;

  vaLoginAndroidEnCurso = true;

  try {
    const credential = GoogleAuthProvider.credential(idToken);

    await signInWithCredential(auth, credential);

    localStorage.removeItem(VA_ANDROID_ID_TOKEN_KEY);
    localStorage.removeItem("VA_VISITANTE_OK");
    localStorage.setItem("vida_abundante_android_apk", "1");

    vaLoginAndroidEnCurso = false;

    const params = new URLSearchParams(location.search);

    if (params.get("loginOk") !== "1") {
      window.location.replace("/VidaAbundante/?loginOk=1");
    }

    return true;
  } catch (error) {
    console.error("Error login Android APK:", error);

    vaLoginAndroidEnCurso = false;
    localStorage.removeItem(VA_ANDROID_ID_TOKEN_KEY);

    alert("No pude iniciar sesión desde la app. Probá nuevamente.");

    return false;
  }
}

window.vaLoginAndroidConGoogle = async function(idToken = "") {
  if (!idToken) return;

  localStorage.setItem(VA_ANDROID_ID_TOKEN_KEY, idToken);
  await vaConsumirLoginAndroidPendiente();
};

vaConsumirLoginAndroidPendiente();

// ================= PWA: INSTALAR / COMPARTIR APP =================
let vaInstallPromptPendiente = null;

function vaAppEstaInstalada() {
  return (
    vaEsAndroidAPK() ||
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function vaUrlApp() {
  return "https://vidaabundante-tristansuarez.github.io/VidaAbundante/";
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  vaInstallPromptPendiente = e;

  if (typeof window.vaActualizarBotonInstalarApp === "function") {
    window.vaActualizarBotonInstalarApp();
  }
});

window.addEventListener("appinstalled", () => {
  vaInstallPromptPendiente = null;

  if (typeof window.vaActualizarBotonInstalarApp === "function") {
    window.vaActualizarBotonInstalarApp();
  }
});

window.vaActualizarBotonInstalarApp = function() {
  const btn = document.getElementById("btnOpcionInstalarApp");
  if (!btn) return;

  if (vaAppEstaInstalada()) {
    btn.style.display = "none";
    return;
  }

  btn.style.display = "inline-flex";
};

window.vaCompartirApp = async function() {
  const url = vaUrlApp();
  const texto = "Vida Abundante App";

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Vida Abundante",
        text: texto,
        url
      });
      return;
    }

    await navigator.clipboard.writeText(url);
    alert("Link de la app copiado.");
  } catch (e) {
    if (window.vaShareCancelado?.(e)) return;

    try {
      await navigator.clipboard.writeText(url);
      alert("Link de la app copiado.");
    } catch (_) {
      prompt("Copiá este link para compartir la app:", url);
    }
  }
};

window.vaInstalarAppDesdeMenu = async function() {
  try {
    if (vaAppEstaInstalada()) {
      alert("La app ya está instalada en este dispositivo.");
      vaActualizarBotonInstalarApp();
      return;
    }

    if (vaInstallPromptPendiente) {
      vaInstallPromptPendiente.prompt();

      try {
        await vaInstallPromptPendiente.userChoice;
      } catch (e) {}

      vaInstallPromptPendiente = null;
      vaActualizarBotonInstalarApp();
      return;
    }

    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");

    if (esIOS) {
      alert("Para instalar en iPhone: tocá Compartir y luego “Agregar a pantalla de inicio”.");
      return;
    }

    alert("Si no aparece el cartel de instalación, abrí el menú de Chrome y tocá “Instalar app” o “Agregar a pantalla principal”.");
  } catch (e) {
    console.warn("No pude iniciar instalación:", e);
    alert("No pude abrir la instalación automática. Probá desde el menú del navegador: “Instalar app”.");
  }
};

// ================= 🙏 BOTÓN PEDIDO DE ORACIÓN EN MENÚ =================
function vaAsegurarExtrasMenuSesion() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;

if (!document.getElementById("vaMenuSesionExtraStyle")) {
  const st = document.createElement("style");
  st.id = "vaMenuSesionExtraStyle";
  st.textContent = `
    #btnOpcionPedidoOracion{
      grid-column:1 / -1 !important;
      min-height:38px !important;
      width:100% !important;
      background:linear-gradient(135deg, #fff3b0, var(--ui-azul-claro, #bcdcff)) !important;
      color:#000 !important;
      font-weight:900 !important;
      box-shadow:0 6px 18px rgba(0,0,0,.10);
    }

    #btnOpcionPedidoOracion i{
      color:#000 !important;
    }

    #loginModal .opciones-sesion-actions{
      display:grid !important;
      grid-template-columns:1fr 1fr !important;
      gap:10px !important;
      width:100% !important;
    }

    #loginModal .opciones-sesion-actions > button{
      width:100% !important;
      min-width:0 !important;
      max-width:none !important;
      min-height:38px !important;
      height:38px !important;
      padding:0 12px !important;
      border-radius:999px !important;

      display:inline-flex !important;
      align-items:center !important;
      justify-content:center !important;
      gap:8px !important;

      white-space:nowrap !important;
      font-weight:900 !important;
      box-sizing:border-box !important;
    }

    #btnOpcionDevocionales,
    #btnOpcionAgenda,
    #btnOpcionABC,
    #btnOpcionRecursos{
      grid-column:auto !important;
    }

    #loginModal .va-opciones-footer{
      justify-content:center !important;
    }

    #loginModal.va-app-instalada #btnOpcionInstalarApp{
      display:none !important;
    }

    #loginModal.va-app-instalada .va-opciones-footer{
      display:flex !important;
      justify-content:center !important;
      align-items:center !important;
      gap:10px !important;
    }

    #loginModal.va-app-instalada .va-opciones-footer > button{
      flex:0 0 132px !important;
      max-width:150px !important;
    }

      /* =========================================
       MODAL ABIERTO SOLO PARA PEDIR INICIO
       DE SESIÓN
    ========================================= */

    #loginModal.va-solo-login .opciones-sesion-actions{
      display:none !important;
    }

    #loginModal.va-solo-login .va-opciones-footer,
    #loginModal.va-solo-login .opciones-sesion-footer{
      display:flex !important;
      justify-content:center !important;
      align-items:center !important;
      grid-template-columns:1fr !important;

      margin-top:14px !important;
      padding-top:0 !important;
      border-top:none !important;
    }

    #loginModal.va-solo-login .va-opciones-footer > button,
    #loginModal.va-solo-login .opciones-sesion-footer > button{
      display:none !important;
    }

    #loginModal.va-solo-login #btnOpcionLogin{
      display:inline-flex !important;
      flex-direction:row !important;
      align-items:center !important;
      justify-content:center !important;

      flex:1 1 100% !important;
      width:min(100%, 320px) !important;
      max-width:320px !important;
      min-height:52px !important;

      padding:0 18px !important;
      gap:10px !important;
      border-radius:999px !important;

      background:var(--ui-azul-claro, #bcdcff) !important;
      color:#000 !important;
      font-size:14px !important;
      font-weight:900 !important;
    }

    #loginModal.va-solo-login #btnOpcionLogin i{
      font-size:18px !important;
      color:#000 !important;
    }
    
    @media(max-width:420px){
      #loginModal .opciones-sesion-actions{
        gap:8px !important;
      }

      #loginModal .opciones-sesion-actions > button{
        font-size:13px !important;
        padding:0 9px !important;
      }
    }
  `;
  document.head.appendChild(st);
}

  const btnDevocionales = document.getElementById("btnOpcionDevocionales");

  if (btnDevocionales && !document.getElementById("btnOpcionPedidoOracion")) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnOpcionPedidoOracion";
    btn.className = btnDevocionales.className || "";
    btn.innerHTML = `
      <i class="fa-solid fa-hands-praying"></i>
      <span>Pedido de oración</span>
    `;

btn.onclick = () => {
      try { cerrarLogin(); } catch(e) {}

      if (typeof window.vaAbrirAccesoPedidoOracion === "function") {
        window.vaAbrirAccesoPedidoOracion();
      } else if (typeof window.abrirPedidoOracionUsuario === "function") {
        window.abrirPedidoOracionUsuario();
      } else {
        alert("Todavía no cargó el formulario de pedido de oración. Cerrá y abrí la app nuevamente.");
      }
    };

    btnDevocionales.parentElement.insertBefore(btn, btnDevocionales);
  }

  vaAjustarMenuSesionInstalada();
}

window.vaCerrarAccesoPedidoOracion = function() {
  document.getElementById("modalAccesoPedidoOracion")?.remove();
  document.getElementById("modalAccesoPedidoOracionStyle")?.remove();
};

window.vaAbrirAccesoPedidoOracion = function() {
  window.vaCerrarAccesoPedidoOracion?.();

  const modal = document.createElement("div");
  modal.id = "modalAccesoPedidoOracion";

  modal.innerHTML = `
    <div class="va-pedido-acceso-box">
      <button type="button" class="va-pedido-acceso-x" onclick="vaCerrarAccesoPedidoOracion()">×</button>

      <div class="va-pedido-acceso-icon">
        <i class="fa-solid fa-person-praying"></i>
      </div>

      <h2>Pedidos de oración</h2>

      <p>Elegí qué querés hacer.</p>

      <button type="button" onclick="vaCerrarAccesoPedidoOracion(); abrirPedidoOracionUsuario();">
        <i class="fa-solid fa-plus"></i>
        <span>Hacer un pedido</span>
      </button>

      <button type="button" onclick="vaCerrarAccesoPedidoOracion(); abrirMisPedidosOracionUsuario();">
        <i class="fa-solid fa-rectangle-list"></i>
        <span>Ver mis pedidos</span>
      </button>
    </div>
  `;

  const style = document.createElement("style");
  style.id = "modalAccesoPedidoOracionStyle";
  style.textContent = `
    #modalAccesoPedidoOracion{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.45);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .va-pedido-acceso-box{
      position:relative;
      width:min(380px, 94vw);
      background:#fff;
      color:#000;
      border-radius:24px;
      padding:20px;
      box-shadow:0 22px 70px rgba(0,0,0,.30);
      display:grid;
      gap:12px;
      text-align:center;
    }

    .va-pedido-acceso-x{
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

    .va-pedido-acceso-icon{
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

    .va-pedido-acceso-box h2{
      margin:0;
      font-size:22px;
      font-weight:900;
    }

    .va-pedido-acceso-box p{
      margin:0;
      opacity:.75;
    }

    .va-pedido-acceso-box button:not(.va-pedido-acceso-x){
      border:none;
      border-radius:999px;
      padding:12px 14px;
      background:var(--ui-azul-claro, #bcdcff);
      color:#000;
      font-weight:900;
      cursor:pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
    }

    .va-pedido-acceso-box button:not(.va-pedido-acceso-x):hover{
      background:var(--ui-azul-hover, #a6d0ff);
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(modal);
};

function vaAjustarMenuSesionInstalada() {
  const modal = document.getElementById("loginModal");
  if (!modal) return;

  modal.classList.toggle("va-app-instalada", vaAppEstaInstalada());

  const btnInstalar = document.getElementById("btnOpcionInstalarApp");
  const btnSalir = document.getElementById("btnOpcionLogout");
  const btnCompartir = modal.querySelector(`button[onclick*="vaCompartirApp"]`);

  const footer =
    btnInstalar?.parentElement ||
    btnCompartir?.parentElement ||
    btnSalir?.parentElement;

  if (footer) {
    footer.classList.add("va-opciones-footer");
  }
}

const vaActualizarBotonInstalarAppOriginal = window.vaActualizarBotonInstalarApp;

window.vaActualizarBotonInstalarApp = function() {
  if (typeof vaActualizarBotonInstalarAppOriginal === "function") {
    vaActualizarBotonInstalarAppOriginal();
  }

  vaAjustarMenuSesionInstalada();
};

// ================= MENÚ SESIÓN (...) =================
// ================= OPCIONES SESIÓN DESDE BOTÓN (...) =================

window.toggleMenuSesion = function() {
  vaAsegurarExtrasMenuSesion();

  const modal = document.getElementById("loginModal");
  const btnLogin = document.getElementById("btnOpcionLogin");
  const btnLogout = document.getElementById("btnOpcionLogout");
  const btnDevocionales = document.getElementById("btnOpcionDevocionales");
  const btnAgenda = document.getElementById("btnOpcionAgenda");
  const btnABC = document.getElementById("btnOpcionABC");
  const btnRecursos = document.getElementById("btnOpcionRecursos");
  const btnPedidoOracion = document.getElementById("btnOpcionPedidoOracion");
  const titulo = document.getElementById("opcionesSesionTitulo");
  const texto = document.getElementById("opcionesSesionTexto");

  if (!modal || !btnLogin || !btnLogout || !titulo || !texto) return;

  /* Al abrir desde los tres puntos recuperamos el menú completo */
  modal.classList.remove("va-solo-login");

  btnLogin.innerHTML = `
    <i class="fa-brands fa-google"></i>
    <span>Ingresar</span>
  `;

  btnLogin.onclick = () => {
    window.vaIniciarSesionGoogle();
  };

  const user = auth.currentUser;
  const puedeVerRecursos =
    !!window.__ES_ADMIN ||
    !!window.__ES_COLABORADOR;

  if (btnPedidoOracion) {
    btnPedidoOracion.style.display = "inline-flex";
  }

  if (btnDevocionales) {
    btnDevocionales.style.display = "inline-flex";
  }

  if (btnAgenda) {
    btnAgenda.style.display = "inline-flex";
  }

  if (btnABC) {
    btnABC.style.display = "inline-flex";
  }

  if (btnRecursos) {
    btnRecursos.style.display =
      puedeVerRecursos ? "inline-flex" : "none";
  }

  if (typeof window.vaActualizarBotonInstalarApp === "function") {
    window.vaActualizarBotonInstalarApp();
  }

  if (user) {
    titulo.textContent = "Vida Abundante";

    texto.textContent =
      "Accesos rápidos y opciones de sesión.";

    btnLogin.style.display = "none";
    btnLogout.style.display = "inline-flex";
  } else {
    titulo.textContent = "Vida Abundante App";

    texto.textContent =
      "Podés navegar como visitante o ingresar con Google para guardar tus preferencias.";

    btnLogin.style.display = "inline-flex";
    btnLogout.style.display = "none";
  }

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  vaAjustarMenuSesionInstalada();
};

window.abrirLoginParaGuardarMiPanel = function() {
  /*
    Carga el diseño nuevo aunque el usuario todavía
    nunca haya abierto el menú de los tres puntos.
  */
  vaAsegurarExtrasMenuSesion();

  const modal = document.getElementById("loginModal");

  if (!modal) {
    window.vaIniciarSesionGoogle();
    return;
  }

  const titulo = document.getElementById("opcionesSesionTitulo");
  const texto = document.getElementById("opcionesSesionTexto");
  const btnLogin = document.getElementById("btnOpcionLogin");
  const btnLogout = document.getElementById("btnOpcionLogout");

  /*
    Esta clase oculta todos los accesos del menú
    y deja solamente el botón para ingresar.
  */
  modal.classList.add("va-solo-login");

  if (titulo) {
    titulo.textContent = "Iniciá sesión";
  }

  if (texto) {
    texto.innerHTML = `
      Para usar esta función y guardar tu contenido en
      <b>Mi Panel</b>, necesitás iniciar sesión con Google.
      <br><br>
      Así vas a poder recuperar tus preferencias y guardados
      cuando vuelvas a entrar.
    `;
  }

  if (btnLogin) {
    btnLogin.innerHTML = `
      <i class="fa-brands fa-google"></i>
      <span>Iniciar sesión con Google</span>
    `;

    btnLogin.onclick = () => {
      window.vaIniciarSesionGoogle();
    };

    btnLogin.style.display = "inline-flex";
  }

  if (btnLogout) {
    btnLogout.style.display = "none";
  }

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  vaAjustarMenuSesionInstalada();
};

window.cerrarLogin = function(){
  const modal = document.getElementById("loginModal");
  if (!modal) return;

  modal.classList.remove("abierto");
  modal.setAttribute("aria-hidden", "true");

  // ✅ cerramos limpio, pero toggleMenuSesion lo vuelve a flex cuando haga falta
  modal.style.display = "none";
};

window.vaAbrirIglesiaDesdeMenu = function(sub = "devocionales") {
  try {
    cerrarLogin();
  } catch (e) {}

    if (sub === "recursos") {
    const puedeVerRecursos = !!window.__ES_ADMIN || !!window.__ES_COLABORADOR;

    if (!puedeVerRecursos) {
      try {
        window.__IGLESIA_SUB_ACTIVA = "";
        window.__RECURSOS_SUB_ACTIVA = "";

        if (typeof guardarEstadoBiblia === "function") {
          guardarEstadoBiblia({
            seccion: "compartidos",
            subIglesia: "",
            subRecursos: ""
          });
        }

        if (typeof window.irA === "function") {
          window.irA("compartidos");
        } else if (typeof window.forzarSeccionActiva === "function") {
          window.forzarSeccionActiva("compartidos");
        }

        setTimeout(() => {
          try { window.mostrarCompartidosSub?.("todo"); } catch(e) {}
          try { window.mostrarCompartidos?.("todo"); } catch(e) {}
          try { window.scrollTo({ top: 0, behavior: "auto" }); } catch(e) {}
        }, 0);

      } catch (e) {
        console.warn("No pude abrir Compartidos:", e);
      }

      return;
    }
  }

  const elegido = ["devocionales", "subidos", "abc", "recursos"].includes(sub)
    ? sub
    : "devocionales";

  try {
    irA("iglesia");
  } catch (e) {
    try { forzarSeccionActiva("iglesia"); } catch (_) {}
  }

  setTimeout(() => {
    try {
      forzarSeccionActiva("iglesia");
      mostrarIglesiaSub(elegido);
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (e) {
      console.warn("No pude abrir Iglesia:", e);
    }
  }, 120);
};

window.vaToggleVidaAbundante = function() {
  const estoyEnCompartidos = document.body.classList.contains("en-compartidos");
  const estoyEnPanel = document.body.classList.contains("en-panel");

  if (estoyEnCompartidos) {
    irA("panel");
    return;
  }

  if (estoyEnPanel) {
    irA("compartidos");
    return;
  }

  irA("compartidos");
};

function actualizarNavVida(seccion) {
  const btnVida = document.getElementById("btnNavVida");
  const iconVida = document.getElementById("vidaNavIcon");

  if (!btnVida || !iconVida) return;

  const esVida =
    seccion === "compartidos" ||
    seccion === "panel" ||
    seccion === "iglesia";

  const esPersonal = seccion === "panel";

  btnVida.classList.toggle("activo", esVida);
  btnVida.classList.toggle("modo-iglesia", !esPersonal);
  btnVida.classList.toggle("modo-personal", esPersonal);

  iconVida.className = esPersonal
    ? "fa-solid fa-heart"
    : "fa-solid fa-church";
}

window.actualizarNavVida = actualizarNavVida;

window.cerrarSesionDesdeMenu = async function(){
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Error cerrando sesión:", error);
    alert("No se pudo cerrar sesión. Intentá nuevamente.");
  }
};

// cerrar tocando afuera
document.addEventListener("click", function(e){
  const modal = document.getElementById("loginModal");
  const card = document.querySelector("#loginModal .opciones-sesion-card");

  if (!modal || !card) return;
  if (!modal.classList.contains("abierto")) return;

  if (modal.contains(e.target) && !card.contains(e.target)) {
    cerrarLogin();
  }
});

// FIN MODAL LOGIN 
const db = getDatabase(app);

window.__FB = { db, auth };
window.__AUTH = auth;
window.__FB_API = { ref, set, remove, onValue, get, push, runTransaction };

// ================= ✅ COMPARTIR: CANCELACIÓN NORMAL =================
// Android / Chrome puede devolver "Share canceled" al cerrar el compartir.
// Eso NO es error: no mostramos alert, no descargamos, no molestamos.
window.vaShareCancelado = function vaShareCancelado(e) {
  const texto = [
    e?.name || "",
    e?.message || "",
    String(e || "")
  ].join(" ").toLowerCase();

  return (
    texto.includes("aborterror") ||
    texto.includes("share canceled") ||
    texto.includes("share cancelled") ||
    texto.includes("user aborted") ||
    texto.includes("cancelado") ||
    texto.includes("cancelada")
  );
};

// ================= 🧯 CORTAFUEGOS REAL DE SECCIONES =================
// Evita que Biblia, Iglesia, Mi Panel y Compartidos queden visibles juntos.
function forzarSeccionActiva(seccion) {
  const todas = ["biblia", "iglesia", "panel", "compartidos"];

  if (!todas.includes(seccion)) seccion = "compartidos";

  // ✅ Si venimos de ABC y vamos a Biblia/Panel/Compartidos,
  // primero apagamos ABC para que no deje handlers ni estilos pegados.
  if (document.body.classList.contains("en-abc") && seccion !== "iglesia") {
    try {
      window.__abcOnExit?.();
    } catch (e) {
      console.warn("No pude apagar ABC al cambiar de sección:", e);
    }
  }

  window.__SECCION_ACTIVA = seccion;

  document.body.classList.remove(
    "en-biblia",
    "en-iglesia",
    "en-panel",
    "en-compartidos"
  );

  document.body.classList.add("en-" + seccion);

  todas.forEach(s => {
    const el = document.getElementById("seccion-" + s);
    if (!el) return;

    el.style.setProperty(
      "display",
      s === seccion ? "block" : "none",
      "important"
    );
  });

  try {
    actualizarNavVida(seccion);
  } catch (e) {}

  if (seccion === "biblia") {
    try { window.setMarcadorCtx?.("biblia"); } catch(e) {}

    requestAnimationFrame(() => {
      try {
        if (typeof aplicarUIAccionesPorModo === "function") aplicarUIAccionesPorModo();
      } catch(e) {}

      try {
        if (typeof refrescarBotonGuardarMarcador === "function") refrescarBotonGuardarMarcador();
      } catch(e) {}
    });
  }

  if (seccion === "panel" && !uid) {
    setTimeout(mostrarPanelVisitante, 0);
  }
}

window.forzarSeccionActiva = forzarSeccionActiva;

// ================= ESTADO GLOBAL =================
let uid = null;
let bibliaData = [];
let bibliaDataRV = [];
let bibliaDataNTV = [];
let versionActual = "RV1960"; // "RV1960" | "NTV"

let marcados = {};
let size = 18;
let fuenteActual = "Roboto, sans-serif";
let colorActual = "#fff3b0"; // 💛 amarillo por default
let resaltadorBloqueado = true; // 🔒 nuevo estado
window.colorActual = colorActual;
window.resaltadorBloqueado = resaltadorBloqueado;

// ================= 🎨 CONFIG RESALTADORES PERSONALIZABLES =================
const DEFAULT_RESALTADORES = [
  { color: "#ffd6e8", forma: "circle" },
  { color: "#fff3b0", forma: "circle" },
  { color: "#caffd1", forma: "circle" },
  { color: "#ffc9c9", forma: "circle" },
  { color: "#ccecff", forma: "circle" },
  { color: "#e6c9ff", forma: "circle" },
  { color: "#ffe2c9", forma: "circle" },
  { color: "#efefef", forma: "circle" }
];

let resaltadoresConfig = cargarResaltadoresConfig();

async function cargarResaltadoresConfigFirebase() {
  try {
    if (!uid) return null;

    const snap = await get(ref(db, `usuariosConfig/${uid}/resaltadores`));
    const data = snap.val();

    if (Array.isArray(data) && data.length === 8) {
      return data.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));
    }

    return null;
  } catch (e) {
    console.warn("No pude leer resaltadores desde Firebase:", e);
    return null;
  }
}

async function guardarResaltadoresConfigFirebase() {
  try {
    if (!uid) return;
    await set(ref(db, `usuariosConfig/${uid}/resaltadores`), resaltadoresConfig);
  } catch (e) {
    console.warn("No pude guardar resaltadores en Firebase:", e);
  }
}

async function sincronizarResaltadoresUsuario() {
  try {
    // 1) Firebase primero
    const remotos = await cargarResaltadoresConfigFirebase();

    if (Array.isArray(remotos) && remotos.length === 8) {
      resaltadoresConfig = remotos;
      guardarResaltadoresConfigLocal(); // backup local
      return;
    }

    // 2) si no había en Firebase, subimos lo local/default actual
    guardarResaltadoresConfigLocal();
    await guardarResaltadoresConfigFirebase();

  } catch (e) {
    console.warn("No pude sincronizar resaltadores del usuario:", e);
  }
}

function cargarResaltadoresConfig() {
  try {
    const raw = localStorage.getItem("resaltadoresConfig");
    const parsed = raw ? JSON.parse(raw) : null;

    if (Array.isArray(parsed) && parsed.length === 8) {
      return parsed.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));
    }
  } catch (e) {
    console.warn("No pude leer resaltadoresConfig:", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_RESALTADORES));
}

function guardarResaltadoresConfigLocal() {
  try {
    localStorage.setItem("resaltadoresConfig", JSON.stringify(resaltadoresConfig));
  } catch (e) {
    console.warn("No pude guardar resaltadoresConfig:", e);
  }
}

function obtenerConfigResaltadorActual() {
  return (
    resaltadoresConfig.find(x => x.color === colorActual) ||
    resaltadoresConfig[0] ||
    { color: "#fff3b0", forma: "circle" }
  );
}

function crearNodoFormaResaltador(color, forma = "circle") {
  const span = document.createElement("span");
  span.className = `marker-shape ${forma === "heart" ? "heart" : "circle"}`;
  span.style.setProperty("--marker-color", color || "#fff3b0");
  return span;
}

async function cargarResaltadoresUsuario() {
  if (!uid) return;

  try {
    const snap = await get(ref(db, `usuariosConfig/${uid}/resaltadores`));

    const data = snap.val();

    if (Array.isArray(data) && data.length === 8) {
      resaltadoresConfig = data.map(x => ({
        color: x?.color || "#fff3b0",
        forma: x?.forma === "heart" ? "heart" : "circle"
      }));

      guardarResaltadoresConfigLocal();
      initResaltadorCompacto();
    }

  } catch(e) {
    console.warn("No pude cargar resaltadores del usuario:", e);
  }
}

async function guardarResaltadoresUsuario() {
  if (!uid) return;

  try {
    await set(ref(db, `usuariosConfig/${uid}/resaltadores`), resaltadoresConfig);
  } catch (e) {
    console.warn("No pude guardar resaltadores del usuario:", e);
  }
}

// ================= MARCADORES (NUEVO LIMPIO) =================
let modoMarcador = false;
let seleccionMarcador = {};         // {idVersiculo:true}
let seleccionMarcadorOrden = [];    // ✅ respeta el orden real en que marcás
let marcadores = {};                // cache firebase

let panelRecursosGuardados = {};
let panelEdicionesGuardadas = {};
let panelImagenesGuardadas = {};
let panelImagenesPublicadas = {};
let panelImagenesCompartidosCache = {};
let notasCompartidasPanel = {};

// ================= ✅ INDICE DE NOTAS (para mostrar pluma) =================
window.notasBibliaIndex = window.notasBibliaIndex || {};
window.notasABCIndex    = window.notasABCIndex || {};

// (si tu código usa las variables locales, podés dejar alias)
let notasBibliaIndex = window.notasBibliaIndex;
let notasABCIndex    = window.notasABCIndex;

let ultimoMarcadorAplicado = null;  // resaltado al volver (opcional)
// ✅ cuando edito desde "Mi Panel", guardo acá la info original del marcador
window.__editMarcadorBase = null;  // {libro, capitulo, versiculos, ref}

// ================= CONTEXTO MODAL MARCADORES =================
window.__marcadorCtx = {
  origen: "biblia",   // "biblia" | "abc"
  abcEditId: null
};

window.setMarcadorCtx = function(origen, extra = {}) {
  window.__marcadorCtx = {
    origen: origen || "biblia",
    abcEditId: null,
    ...extra
  };
};

window.getMarcadorCtx = function() {
  return window.__marcadorCtx || { origen: "biblia", abcEditId: null };
};

// ========= Modo Imagen
let modoImagen = false;
let seleccionImagen = {};
let seleccionImagenOrden = [];
let fondoFinal = null;
let fondoFinalBlobUrl = null; // ✅ fondo seguro para html2canvas
let creandoNotaLibre = false; // ✅ estado: nota sin versículo

// ✅ NUEVO: modal de imagen desde Biblia o desde Mi Panel
let origenModalImagen = "biblia";   // "biblia" | "panel"
let modoImagenLibre = false;        // true cuando el texto viene de un textarea libre
let textoLibreImagen = "";          // texto escrito manualmente en Mi Panel
let formatoImagenActual = "post"; // "post" | "story"

let imagenMetaActual = null;
window.__VA_IMG_META_ACTUAL = null;
window.__VA_PANEL_IMG_ITEMS = window.__VA_PANEL_IMG_ITEMS || {};

// ✅ EDICIÓN DE IMÁGENES DEL PANEL
// null = imagen nueva
// { id, item } = estoy editando una imagen existente
window.__VA_IMG_EDITANDO = null;
window.__VA_ULTIMA_IMG_PANEL_ID = "";

function vaImgMetaHex(color = "") {
  const c = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "";
}

function vaImgMetaContraste(hex = "#ffffff") {
  let h = vaImgMetaHex(hex) || "#ffffff";
  h = h.replace("#", "");

  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  return lum > 160 ? "#000000" : "#ffffff";
}

function vaImgMetaTituloSugerido() {
  if (modoImagenLibre || origenModalImagen === "panel") {
    return "Imagen libre";
  }

  const items = getItemsImagenEnOrden();
  const ref = items.length ? referenciaImagenEnOrden(items) : "";

  return ref || "Imagen bíblica";
}

function vaImgMetaSyncColor(hex = "#fff3b0") {
  const color = vaImgMetaHex(hex) || "#fff3b0";
  const input = document.getElementById("imagenMetaColor");
  const host = document.getElementById("imagenMetaColorHost");

  if (input) input.value = color;

  if (host) {
    host.style.setProperty("--pickr-color", color);
    host.style.background = color;

    try {
      if (host._pickr) host._pickr.setColor(color);
    } catch (e) {}
  }
}

function vaImgMetaCrearModal() {
  // ✅ recreamos limpio para que no queden listeners viejos
  const viejo = document.getElementById("modalImagenMeta");
  if (viejo) viejo.remove();

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modalImagenMeta" class="va-img-meta-modal" aria-hidden="true">
      <div class="va-img-meta-card">
        <button type="button" class="va-img-meta-close" id="btnImagenMetaCancelarTop">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <h3>Datos de la imagen</h3>
        <p class="va-img-meta-sub">
          Podés agregar título y descripción, o tocar Omitir para guardar solo la imagen.
        </p>

        <label class="va-img-meta-label">
          Título
          <input id="imagenMetaTitulo" type="text" placeholder="Título opcional">
        </label>

        <label class="va-img-meta-label">
          Descripción
          <textarea id="imagenMetaDescripcion" placeholder="Descripción opcional"></textarea>
        </label>

        <div class="va-img-meta-color-row">
          <span>Color del contenedor</span>
          <input type="hidden" id="imagenMetaColor" value="#fff3b0">
          <button
            type="button"
            id="imagenMetaColorHost"
            class="pickr-host"
            data-target="#imagenMetaColor"
            aria-label="Color del contenedor"
          ></button>
        </div>

        <div class="va-img-meta-actions">
          <button type="button" class="btn-ghost" id="btnImagenMetaCancelar">Omitir</button>
          <button type="button" class="btn-primary" id="btnImagenMetaGuardar">
            <i class="fa-solid fa-circle-check"></i>
            Guardar
          </button>
        </div>
      </div>
    </div>
  `);

  const modal = document.getElementById("modalImagenMeta");
  const card = modal?.querySelector(".va-img-meta-card");

  const omitir = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    const color = vaImgMetaHex(document.getElementById("imagenMetaColor")?.value || "#fff3b0") || "#fff3b0";

    vaImgMetaCerrar({
      titulo: "",
      descripcion: "",
      color,
      omitido: true
    });
  };

  document.getElementById("btnImagenMetaCancelar")?.addEventListener("click", omitir);
  document.getElementById("btnImagenMetaCancelarTop")?.addEventListener("click", omitir);

  // ✅ FIX: tocar afuera NO guarda ni omite.
  // Antes esto podía cerrar el modal cuando intentabas seleccionar texto con el mouse.
  modal?.addEventListener("click", (e) => {
    if (e.target?.id === "modalImagenMeta") {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  card?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.getElementById("btnImagenMetaGuardar")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const btn = e.currentTarget;
    if (btn) btn.disabled = true;

    const titulo = String(document.getElementById("imagenMetaTitulo")?.value || "").trim();
    const descripcion = String(document.getElementById("imagenMetaDescripcion")?.value || "").trim();
    const color = vaImgMetaHex(document.getElementById("imagenMetaColor")?.value || "#fff3b0") || "#fff3b0";

    vaImgMetaCerrar({ titulo, descripcion, color });
  });

  setTimeout(() => {
    if (typeof initPickrEnHosts === "function") {
      initPickrEnHosts("#imagenMetaColorHost");
    }
  }, 0);
}

function vaImgMetaCerrar(valor) {
  const modal = document.getElementById("modalImagenMeta");

  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }

  const resolver = window.__VA_IMG_META_RESOLVE;
  window.__VA_IMG_META_RESOLVE = null;

  if (resolver) resolver(valor);
}

function pedirDatosImagenMeta(base = {}) {
  vaImgMetaCrearModal();

  const modal = document.getElementById("modalImagenMeta");
  const inputTitulo = document.getElementById("imagenMetaTitulo");
  const inputDesc = document.getElementById("imagenMetaDescripcion");

  const tituloBase = String(base?.titulo || "").trim();
  const descBase = String(base?.descripcion || "").trim();
  const colorBase = vaImgMetaHex(base?.color || base?.colorFondo || "#fff3b0") || "#fff3b0";

  if (!modal || !inputTitulo || !inputDesc) {
    return Promise.resolve({
      titulo: tituloBase,
      descripcion: descBase,
      color: colorBase
    });
  }

  // ✅ No sugerimos título.
  // Nueva imagen: queda vacío.
  // Edición: trae lo que ya tenía.
  inputTitulo.value = tituloBase;
  inputDesc.value = descBase;
  vaImgMetaSyncColor(colorBase);

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  setTimeout(() => inputTitulo.focus(), 80);

  return new Promise(resolve => {
    window.__VA_IMG_META_RESOLVE = resolve;
  });
}

function limpiarSeleccionImagenCompleta() {
  seleccionImagen = {};
  seleccionImagenOrden = [];
}

function marcarImagenEnOrden(id) {
  id = String(id || "").trim();
  if (!id) return;

  if (seleccionImagen[id]) {
    delete seleccionImagen[id];
    seleccionImagenOrden = seleccionImagenOrden.filter(x => x !== id);
    return;
  }

  seleccionImagen[id] = true;

  if (!seleccionImagenOrden.includes(id)) {
    seleccionImagenOrden.push(id);
  }
}

function getIdsImagenEnOrden() {
  const vivos = new Set(Object.keys(seleccionImagen || {}));

  seleccionImagenOrden = (seleccionImagenOrden || []).filter(id => vivos.has(id));

  Object.keys(seleccionImagen || {}).forEach(id => {
    if (!seleccionImagenOrden.includes(id)) {
      seleccionImagenOrden.push(id);
    }
  });

  return [...seleccionImagenOrden];
}

function getItemsImagenEnOrden() {
  return getIdsImagenEnOrden()
    .map(id => {
      const [Libro, Capitulo, Versiculo] = String(id || "").split("_");

      return {
        id,
        Libro,
        Capitulo: Number(Capitulo),
        Versiculo: Number(Versiculo)
      };
    })
    .filter(x => x.Libro && !isNaN(x.Capitulo) && !isNaN(x.Versiculo));
}

function rangosVersiculosImagen(nums) {
  const a = Array.from(new Set(nums.map(Number).filter(n => !isNaN(n))))
    .sort((x, y) => x - y);

  if (!a.length) return "";

  const partes = [];
  let ini = a[0];
  let ant = a[0];

  for (let i = 1; i < a.length; i++) {
    if (a[i] === ant + 1) {
      ant = a[i];
    } else {
      partes.push(ini === ant ? `${ini}` : `${ini}-${ant}`);
      ini = ant = a[i];
    }
  }

  partes.push(ini === ant ? `${ini}` : `${ini}-${ant}`);

  return partes.join(",");
}

function referenciaImagenEnOrden(items = []) {
  const grupos = [];
  const mapa = {};

  items.forEach(it => {
    const key = `${it.Libro}__${it.Capitulo}`;

    if (!mapa[key]) {
      mapa[key] = {
        Libro: it.Libro,
        Capitulo: it.Capitulo,
        versiculos: []
      };

      grupos.push(mapa[key]);
    }

    mapa[key].versiculos.push(it.Versiculo);
  });

  if (!grupos.length) return "";

  const porLibro = [];
  const mapaLibro = {};

  grupos.forEach(g => {
    if (!mapaLibro[g.Libro]) {
      mapaLibro[g.Libro] = {
        Libro: g.Libro,
        capitulos: []
      };

      porLibro.push(mapaLibro[g.Libro]);
    }

    mapaLibro[g.Libro].capitulos.push(g);
  });

  return porLibro.map(libroGrupo => {
    const partes = libroGrupo.capitulos.map(c =>
      `${c.Capitulo}:${rangosVersiculosImagen(c.versiculos)}`
    );

    return `${libroGrupo.Libro} ${partes.join(" y ")}`;
  }).join("; ");
}

// ================= ✅ HELPERS EDICIÓN IMÁGENES PANEL =================

function vaImgNormalizarUrlGuardada(url) {
  let s = String(url || "").trim();
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;

  if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(s)) {
    return "https://" + s.replace(/^(?:\.\/|\/)+/, "");
  }

  s = s.replace(/^https:\//i, "https://");
  s = s.replace(/^http:\//i, "http://");

  return s;
}

function vaImgItemsDesdePanelItem(item = {}) {
  const out = [];

  function add(libro, capitulo, versiculo) {
    const Libro = String(libro || "").trim();
    const Capitulo = Number(capitulo || 0);
    const Versiculo = Number(versiculo || 0);

    if (!Libro || !Number.isFinite(Capitulo) || !Number.isFinite(Versiculo)) return;

    const id = `${Libro}_${Capitulo}_${Versiculo}`;

    if (!out.some(x => x.id === id)) {
      out.push({ id, Libro, Capitulo, Versiculo });
    }
  }

  if (Array.isArray(item?.versiculosDetalle)) {
    item.versiculosDetalle.forEach(v => {
      add(
        v?.Libro || v?.libro || item.libro,
        v?.Capitulo || v?.capitulo || item.capitulo,
        v?.Versiculo || v?.versiculo
      );
    });
  }

  if (Array.isArray(item?.versiculos)) {
    item.versiculos.forEach(v => {
      if (v && typeof v === "object") {
        add(
          v.Libro || v.libro || item.libro,
          v.Capitulo || v.capitulo || item.capitulo,
          v.Versiculo || v.versiculo
        );
      } else {
        add(item.libro, item.capitulo, v);
      }
    });
  }

  return out;
}

function vaImgCargarSeleccionBibliaDesdePanelItem(item = {}) {
  limpiarSeleccionImagenCompleta();

  const items = vaImgItemsDesdePanelItem(item);

  items.forEach(it => {
    seleccionImagen[it.id] = true;
    if (!seleccionImagenOrden.includes(it.id)) {
      seleccionImagenOrden.push(it.id);
    }
  });

  return items;
}

function vaImgAbrirPanelImagenesDespuesGuardar() {
  try {
    if (typeof renderPanelImagenes === "function") {
      renderPanelImagenes(panelImagenesGuardadas || {});
    }
  } catch (e) {}

  try {
    if (typeof window.irA === "function") {
      window.irA("panel");
    } else if (typeof forzarSeccionActiva === "function") {
      forzarSeccionActiva("panel");
    }
  } catch (e) {}

  setTimeout(() => {
    try {
      if (typeof window.mostrarSeccion === "function") {
        window.mostrarSeccion("imagenes");
      }
    } catch (e) {}

    try {
      if (typeof renderPanelImagenes === "function") {
        renderPanelImagenes(panelImagenesGuardadas || {});
      }
    } catch (e) {}
  }, 100);
}

// ================= ORDEN REAL PARA MARCADORES / NOTAS =================
// Copia la lógica de Crear Imagen Biblia:
// no ordena alfabéticamente, respeta el orden en que tocás los versículos.

function marcadorEscapeHTML(v = "") {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function limpiarSeleccionMarcadorCompleta() {
  seleccionMarcador = {};
  seleccionMarcadorOrden = [];
}

function marcarMarcadorEnOrden(id) {
  id = String(id || "").trim();
  if (!id) return;

  if (seleccionMarcador[id]) {
    delete seleccionMarcador[id];
    seleccionMarcadorOrden = seleccionMarcadorOrden.filter(x => x !== id);
    return;
  }

  seleccionMarcador[id] = true;

  if (!seleccionMarcadorOrden.includes(id)) {
    seleccionMarcadorOrden.push(id);
  }
}

function getIdsMarcadorEnOrden() {
  const vivos = new Set(Object.keys(seleccionMarcador || {}));

  seleccionMarcadorOrden = (seleccionMarcadorOrden || [])
    .filter(id => vivos.has(id));

  // respaldo por si alguna selección vieja quedó sin orden
  Object.keys(seleccionMarcador || {}).forEach(id => {
    if (!seleccionMarcadorOrden.includes(id)) {
      seleccionMarcadorOrden.push(id);
    }
  });

  return [...seleccionMarcadorOrden];
}

function marcadorItemDesdeId(id) {
  const partes = String(id || "").split("_");
  const Versiculo = Number(partes.pop());
  const Capitulo = Number(partes.pop());
  const Libro = partes.join("_");

  if (!Libro || !Number.isFinite(Capitulo) || !Number.isFinite(Versiculo)) {
    return null;
  }

  return {
    id,
    Libro,
    Capitulo,
    Versiculo
  };
}

function getItemsMarcadorEnOrden() {
  return getIdsMarcadorEnOrden()
    .map(marcadorItemDesdeId)
    .filter(Boolean);
}

function itemsMarcadorDesdeData(m = {}) {
  const orden = Array.isArray(m?.seleccionOrden)
    ? m.seleccionOrden.map(marcadorItemDesdeId).filter(Boolean)
    : [];

  // ✅ si existe el orden real, manda el orden real
  if (orden.length) return orden;

  const detalle = Array.isArray(m?.versiculosDetalle)
    ? m.versiculosDetalle.map(it => ({
        id: it.id || `${it.libro || it.Libro}_${it.capitulo || it.Capitulo}_${it.versiculo || it.Versiculo}`,
        Libro: it.Libro || it.libro || "",
        Capitulo: Number(it.Capitulo || it.capitulo || 0),
        Versiculo: Number(it.Versiculo || it.versiculo || 0)
      })).filter(it => it.Libro && it.Capitulo && it.Versiculo)
    : [];

  if (detalle.length) return detalle;

  const libro = String(m?.libro || "").trim();
  const capitulo = Number(m?.capitulo || 0);
  const versiculos = Array.isArray(m?.versiculos)
    ? m.versiculos.map(Number).filter(n => !isNaN(n))
    : [];

  if (!libro || !capitulo || !versiculos.length) return [];

  return versiculos.map(n => ({
    id: `${libro}_${capitulo}_${n}`,
    Libro: libro,
    Capitulo: capitulo,
    Versiculo: n
  }));
}

function getItemsMarcadorParaForm(base = null) {
  if (base) return itemsMarcadorDesdeData(base);
  return getItemsMarcadorEnOrden();
}

function referenciaMarcadorEnOrden(items = []) {
  return referenciaImagenEnOrden(items);
}

function textoVersiculosMarcadorPlano(items = []) {
  const textos = [];

  items.forEach(it => {
    const vv = bibliaData.find(x =>
      x.Libro === it.Libro &&
      Number(x.Capitulo) === Number(it.Capitulo) &&
      Number(x.Versiculo) === Number(it.Versiculo)
    );

    const txt = vv ? getTextoVersiculo(vv) : "";
    if (txt) textos.push(txt);
  });

  return textos.join(" ").trim();
}

function baseEdicionMarcadorCompleta(m = {}, idMarcador = "") {
  const items = itemsMarcadorDesdeData(m);
  const esNotaLibre = items.length === 0;

  const primero = items[0] || null;
  const libroBase = primero?.Libro || "";
  const capBase = Number(primero?.Capitulo || 0);

  const idsOrden = items.map(it =>
    it.id || `${it.Libro}_${it.Capitulo}_${it.Versiculo}`
  );

  return {
    ...m,
    id: idMarcador || m.id || "",

    libro: esNotaLibre ? "" : libroBase,
    capitulo: esNotaLibre ? 0 : capBase,

    // compatibilidad vieja: solo primer libro/capítulo
    versiculos: esNotaLibre ? [] : items
      .filter(it =>
        it.Libro === libroBase &&
        Number(it.Capitulo) === Number(capBase)
      )
      .map(it => Number(it.Versiculo))
      .filter(n => !isNaN(n)),

    // ✅ sistema nuevo completo
    versiculosDetalle: esNotaLibre ? [] : items.map(it => ({
      id: it.id || `${it.Libro}_${it.Capitulo}_${it.Versiculo}`,
      libro: it.Libro,
      capitulo: Number(it.Capitulo),
      versiculo: Number(it.Versiculo)
    })),

    seleccionOrden: esNotaLibre ? [] : idsOrden,

    ref: esNotaLibre
      ? ""
      : (String(m.ref || "").trim() || referenciaMarcadorEnOrden(items)),

    textoVersiculo: esNotaLibre
      ? ""
      : (
          String(m.textoVersiculo || m.textoBiblico || "").trim() ||
          textoVersiculosMarcadorPlano(items)
        )
  };
}

function marcadorContieneVersiculo(m, libro, capitulo, versiculo) {
  return itemsMarcadorDesdeData(m).some(it =>
    it.Libro === libro &&
    Number(it.Capitulo) === Number(capitulo) &&
    Number(it.Versiculo) === Number(versiculo)
  );
}

// ================= FONDO / TEXTURA / ADORNO: CREAR IMAGEN BIBLIA =================
// ✅ Unificado: ya no hay switch. Fondos, textura y adorno conviven siempre.
let modoFondoBiblia = "diseno"; // queda fijo para permitir textura + adorno sobre imagen/color

function bibliaNuevoEstadoFondoDiseno() {
  return {
    // "imagen" = galería Paisajes/Acuarelas/Tarjetas
    // "plano" = 1 color
    // "gradiente" = 2 o 3 colores
    baseTipo: "imagen",

    color1: "#ffffff",
    color2: "#d1eeff",
    color3: "#a6d0ff",
    usarColor2: false,
    usarColor3: false,

   gradienteForma: "vertical", // "vertical" | "horizontal" | "diagonal" | "radial" | "rombo" | "manchas"

    // Varias texturas pueden quedar activas al mismo tiempo.
    texturasUrls: [],
    texturaUrl: null, // compatibilidad con diseños guardados anteriormente
    texturaOpacidad: 0.22,

    adornoUrl: null,
   adornoTamano: 70,
adornoOpacidad: 1
  };
}

let fondoDisenoBiblia = bibliaNuevoEstadoFondoDiseno();

// ✅ Copiado con criterio de Devocionales: lista explícita, así no pide archivos borrados.
const BIBLIA_TEXTURAS_DISENO = [
  { nombre: "Sin textura", url: null },

  ...Array.from({ length: 12 }, (_, i) => ({
    nombre: `Textura C${i + 1}`,
    url: `./img/texturas/c${i + 1}.png`
  })),

  ...Array.from({ length: 12 }, (_, i) => ({
    nombre: `Textura C${i + 14}`,
    url: `./img/texturas/c${i + 14}.png`
  })),

  ...Array.from({ length: 7 }, (_, i) => ({
    nombre: `Textura ${i + 1}`,
    url: `./img/texturas/${i + 1}.png`
  })),

  ...Array.from({ length: 20 }, (_, i) => ({
    nombre: `Textura ${i + 1}`,
    url: `./img/texturas/TEXTURA${i + 1}.png`
  }))
];

const BIBLIA_ADORNOS_DISENO = [
  { nombre: "Sin adorno", url: null },

  { nombre: "Adorno A1", url: "./img/ornamentos/a11.png" },
  { nombre: "Adorno A2", url: "./img/ornamentos/a22.png" },
  { nombre: "Adorno A3", url: "./img/ornamentos/a33.png" },
  { nombre: "Adorno A4", url: "./img/ornamentos/a44.png" },
  { nombre: "Adorno A5", url: "./img/ornamentos/a55.png" },
  { nombre: "Adorno A6", url: "./img/ornamentos/a66.png" },
  { nombre: "Adorno A7", url: "./img/ornamentos/a77.png" },
  { nombre: "Adorno A8", url: "./img/ornamentos/a88.png" },
  { nombre: "Adorno A9", url: "./img/ornamentos/a99.png" },
  { nombre: "Adorno A10", url: "./img/ornamentos/a100.png" },

  // ✅ No pongo O6, O9 ni O11 porque son los típicos que te dan 404 si los borraste.
  ...[1,2,3,4,5,7,8,10,12,13,14,15,16,17,18].map(n => ({
    nombre: `Ornamento ${n}`,
    url: `./img/ornamentos/O${n}.png`
  })),

  ...Array.from({ length: 13 }, (_, i) => ({
    nombre: `Adorno ${i + 1}`,
    url: `./img/ornamentos/adorno${i + 1}.png`
  }))
];

// ================= AUTO TAMAÑO PREVIEW =================
let userSetFontSize = false; // si el usuario tocó tamaño (slider o + -), queda manual hasta que cambie el texto

let textStyle = {
  upper: false,
  bold: false,
  italic: false,
  underline: false
};

function bibliaHexSeguro(color = "") {
  const c = String(color || "").trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "";
}

function bibliaSetHostColorVisual(hostId, color) {
  const host = document.getElementById(hostId);
  const c = bibliaHexSeguro(color) || "#ffffff";

  if (!host) return;

  host.style.setProperty("--pickr-color", c);
  host.style.background = c;
  host.style.backgroundColor = c;
}

function asegurarColorContornoBiblia() {
  const colorHost = document.getElementById("personalizarColorHost");
  if (!colorHost) return null;

  colorHost.classList.add("biblia-text-color-host");
  colorHost.title = "Color del texto";
  colorHost.setAttribute("aria-label", "Color del texto");

  const colorTexto = document.getElementById("personalizarColor")?.value || "#000000";
  const sugerido = colorOutlineDesdeBase(colorTexto);

  let input = document.getElementById("personalizarOutlineColor");

  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.id = "personalizarOutlineColor";
    input.value = sugerido;
    input.dataset.manual = "0";

    colorHost.insertAdjacentElement("afterend", input);
  }

  let host = document.getElementById("personalizarOutlineHost");

  if (!host) {
    host = document.createElement("button");
    host.type = "button";
    host.id = "personalizarOutlineHost";
    host.className = "pickr-host biblia-outline-color-host";
    host.dataset.target = "#personalizarOutlineColor";
    host.title = "Color del contorno";
    host.setAttribute("aria-label", "Color del contorno");

    input.insertAdjacentElement("afterend", host);
  }

  if (!input.dataset.ready) {
    input.dataset.ready = "1";

    const handler = () => {
      input.dataset.manual = "1";
      bibliaSetHostColorVisual("personalizarOutlineHost", input.value);
      actualizarPreview();
      invalidarRenderFinal();
    };

    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  }

  if (!host.dataset.pickrReady && typeof initPickrEnHosts === "function") {
    setTimeout(() => {
      initPickrEnHosts("#personalizarOutlineHost");
    }, 0);
  }

  bibliaSetHostColorVisual("personalizarOutlineHost", input.value || sugerido);

  return input;
}

// ================= 🧠 MEMORIA SCROLL CAPÍTULOS =================
let scrollCapituloAnterior = 0;

// ================= 💾 ESTADO DE NAVEGACIÓN BIBLIA =================
const LS_BIBLIA_ESTADO = "va_biblia_estado_v1";

const VA_UI_SNAPSHOT_KEY = "va_ui_snapshot_v1";
const VA_UI_SNAPSHOT_MAX_AGE = 1000 * 60 * 60 * 24 * 3; // 3 días
const VA_UI_SNAPSHOT_MAX_HTML = 900000; // evita romper localStorage con HTML enorme

const VA_VISITANTE_KEY = "VA_VISITANTE_OK";
const VA_TIP_APP_KEY = "VA_TIP_APP_VISTO";

function vaParam(nombre) {
  try {
    return new URL(location.href).searchParams.get(nombre) || "";
  } catch {
    return "";
  }
}

function vaLimpiarParamsEntrada() {
  try {
    const u = new URL(location.href);
    ["visitante", "loginOk"].forEach(k => u.searchParams.delete(k));
    history.replaceState({}, "", u.pathname + u.search + u.hash);
  } catch {}
}

function vaEsStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

function vaEsIOS() {
  const ua = navigator.userAgent || "";

  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function vaEsMovil() {
  const ua = navigator.userAgent || "";

  return (
    vaEsIOS() ||
    /android|mobile/i.test(ua) ||
    window.innerWidth <= 760
  );
}

function vaEntradaVisitante() {
  return (
    vaParam("visitante") === "1" ||
    localStorage.getItem(VA_VISITANTE_KEY) === "1"
  );
}

function vaEntradaDesdeLogin() {
  return vaParam("loginOk") === "1" || vaParam("visitante") === "1";
}

function vaSeccionValidaApp(seccion) {
  return ["biblia", "iglesia", "panel", "compartidos"].includes(seccion);
}

function vaEsLinkCompartidosDirecto() {
  try {
    const params = new URLSearchParams(location.search);

    // ✅ Compartidos común, sin abrir publicación directa.
    return (
      params.get("ver") === "compartidos" &&
      !params.get("edicionRef") &&
      !params.get("predicaRef")
    );
  } catch {
    return false;
  }
}

function vaHayLinkDirectoInterno() {
  try {
    const params = new URLSearchParams(location.search);
    const path = String(location.pathname || "").toLowerCase();

    // ✅ Links directos que NO deben mostrar paseo previo.
    if (params.get("edicionRef")) return true;
    if (params.get("predicaRef")) return true;

    if (params.get("ver") === "edicion") return true;
    if (path.includes("/ediciones/") && params.get("ref")) return true;
    if (path.includes("/predica/") && params.get("ref")) return true;

    return false;
  } catch {
    return false;
  }
}

function vaSeccionInicialLogueado() {
  const estado = leerEstadoBiblia();
  const seccionGuardada = estado?.seccion || "";

  // ✅ Link directo a una publicación de Compartidos:
  // abrimos Compartidos sí o sí, pero sin restaurar caché vieja.
  if (vaEsLinkCompartidosDirecto()) {
    return "compartidos";
  }

  // Si viene de otro link especial, no forzamos pantalla.
  if (vaHayLinkDirectoInterno()) {
    return "";
  }

  // Si recién viene del login, entramos a Compartidos.
  if (vaEntradaDesdeLogin()) {
    return "compartidos";
  }

  // Si ya usó la app antes, abrimos donde quedó.
  if (vaSeccionValidaApp(seccionGuardada)) {
    return seccionGuardada;
  }

  // Primera vez: Compartidos.
  return "compartidos";
}

function vaSeccionInicialVisitante() {
  const estado = leerEstadoBiblia();
  const seccionGuardada = estado?.seccion || "";

  // ✅ Link directo a una publicación de Compartidos:
  // abrimos Compartidos también en modo visitante.
  if (vaEsLinkCompartidosDirecto()) {
    return "compartidos";
  }

  if (vaHayLinkDirectoInterno()) {
    return "";
  }

  if (vaSeccionValidaApp(seccionGuardada)) {
    return seccionGuardada;
  }

  return "compartidos";
}

let vaPantallaInicialAplicada = false;

function vaAbrirPantallaInicialUnaVez(seccion, motivo = "") {
  if (vaPantallaInicialAplicada) return;
  if (!seccion) return;
  if (!vaSeccionValidaApp(seccion)) seccion = "compartidos";

  vaPantallaInicialAplicada = true;

  setTimeout(() => {
    try {
if (typeof window.irA === "function") {
  window.irA(seccion);
}

// ✅ En links directos no mostramos cartel de instalar app.
// En iPhone puede molestar y sumar carga visual justo al abrir desde WhatsApp.
if (!vaHayLinkDirectoInterno() && !vaEsAndroidAPK()) {
  vaMostrarConsejoInstalarApp();
}
    } catch (e) {
      console.warn("No pude abrir pantalla inicial:", motivo, e);
    }
  }, 0);
}

function vaTextoInstalarApp() {
  const ua = navigator.userAgent || "";
  const esIOS = /iphone|ipad|ipod/i.test(ua);
  const esAndroid = /android/i.test(ua);

  if (esIOS) {
    return `
      <strong>Para usarla como app en iPhone:</strong>
      Tocá el botón de compartir de Safari y elegí
      <b>Agregar a pantalla de inicio</b>.
    `;
  }

  if (esAndroid) {
    return `
      <strong>Para usarla como app en Android:</strong>
      Si Chrome muestra <b>Instalar app</b>, aceptalo.
      Si no aparece, tocá el menú <b>⋮</b> y elegí
      <b>Agregar a pantalla principal</b>.
    `;
  }

  return `
    <strong>Para usarla como app:</strong>
    Si tu navegador muestra <b>Instalar app</b>, aceptalo.
    También podés crear un acceso directo desde el menú del navegador.
  `;
}

function vaMostrarConsejoInstalarApp() {
  const esAPK =
    window.__VIDA_ANDROID_APK__ === true ||
    document.documentElement.classList.contains("vida-android-apk") ||
    document.body?.classList.contains("vida-android-apk") ||
    new URLSearchParams(location.search).get("apk") === "1" ||
    localStorage.getItem("vida_abundante_android_apk") === "1";

  if (esAPK) {
    return false;
  }
  
  if (vaEsAndroidAPK()) {
    try {
      localStorage.setItem(VA_TIP_APP_KEY, "1");
      localStorage.setItem("vida_abundante_android_apk", "1");
      document.getElementById("vaTipInstalarApp")?.remove();
    } catch (e) {}
    return;
  }

  if (vaEsStandalone()) return;
  if (localStorage.getItem(VA_TIP_APP_KEY) === "1") return;
  if (document.getElementById("vaTipInstalarApp")) return;

  const div = document.createElement("div");
  div.id = "vaTipInstalarApp";
  div.innerHTML = `
    <div class="va-tip-app-card">
      <div class="va-tip-app-icon">
        <i class="fa-solid fa-dove"></i>
      </div>

      <h3>Bendecido hermano</h3>

      <p>
        Te animamos a usar Vida Abundante como aplicación en tu celular
        para acceder más rápido a Biblia, devocionales, recursos y compartidos.
      </p>

      <div class="va-tip-app-info">
        ${vaTextoInstalarApp()}
      </div>

      <button type="button" id="btnVaContinuarWeb">
        Continuar en web
      </button>
    </div>
  `;

  document.body.appendChild(div);

  document.getElementById("btnVaContinuarWeb")?.addEventListener("click", () => {
    localStorage.setItem(VA_TIP_APP_KEY, "1");
    div.remove();
  });
}

function obtenerSeccionActual() {
  if (document.body.classList.contains("en-iglesia")) return "iglesia";
  if (document.body.classList.contains("en-panel")) return "panel";
  if (document.body.classList.contains("en-compartidos")) return "compartidos";
  return "biblia";
}

function guardarEstadoBiblia(extra = {}) {
  try {
    const anterior = leerEstadoBiblia() || {};

    const estado = {
      ...anterior,

      seccion: obtenerSeccionActual(),

      // ✅ ahora también recordamos pantallas internas
      subIglesia: window.__IGLESIA_SUB_ACTIVA || anterior.subIglesia || "",
      subRecursos: window.__RECURSOS_SUB_ACTIVA || anterior.subRecursos || "",
      subPanel: window.__PANEL_SUB_ACTIVA || anterior.subPanel || "",

      version: versionActual || "RV1960",
      libro: libroSel?.value || anterior.libro || "",
      capitulo: Number(capSel?.value || anterior.capitulo || 1),
      scrollBiblia: window.scrollY || document.documentElement.scrollTop || 0,
      modoImagen: !!modoImagen,
      ts: Date.now(),

      ...extra
    };

    localStorage.setItem(LS_BIBLIA_ESTADO, JSON.stringify(estado));
  } catch (e) {
    console.warn("No pude guardar estado Biblia:", e);
  }
}

window.guardarEstadoBiblia = guardarEstadoBiblia;

function leerEstadoBiblia() {
  try {
    const raw = localStorage.getItem(LS_BIBLIA_ESTADO);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn("No pude leer estado Biblia:", e);
    return null;
  }
}

function vaSelectorVisible(selectores = []) {
  for (const sel of selectores) {
    const el = document.querySelector(sel);
    if (!el) continue;

    const st = getComputedStyle(el);
    if (st.display !== "none") return sel;
  }

  return "";
}

function vaSelectorCacheActual(seccion) {
  if (seccion === "biblia") {
    return "#texto";
  }

if (seccion === "iglesia") {
  const sel = vaSelectorVisible([
    "#iglesia-devocionales",
    "#iglesia-abc",
    "#iglesia-subidos",
    "#iglesia-recursos"
  ]) || "#seccion-iglesia";

  // ✅ ABC se arma con JS propio.
  // No guardamos/restauramos su HTML porque pisa estilos nuevos
  // y causa el problema de "se ve bien y vuelve atrás".
  if (sel === "#iglesia-abc") return "";

  return sel;
}

  if (seccion === "panel") {
    return vaSelectorVisible([
      "#panel-imagenes",
      "#panel-marcadores",
      "#panel-compartidos",
      "#panel-abc",
      "#panel-recursos"
    ]) || "#seccion-panel";
  }

  if (seccion === "compartidos") {
    return vaSelectorVisible([
      "#compFeed",
      "#compartidosFeed",
      "#feedCompartidos",
      "#listaCompartidos",
      "#seccion-compartidos"
    ]) || "#seccion-compartidos";
  }

  return "";
}

function vaGuardarSnapshotVisual() {

// ✅ Teléfonos: no guardar HTML visual pesado.
// Evita restauraciones lentas, memoria alta y cargas eternas.
if (vaEsMovil()) {
  try {
    localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
  } catch (_) {}
  return;
}
  
  try {
    guardarEstadoBiblia();

    const seccion = obtenerSeccionActual();
    if (!vaSeccionValidaApp(seccion)) return;

    // No guardamos encima si hay un modal grande abierto.
    if (document.querySelector("#edViewer.ed-open")) return;
    if (document.querySelector("#edModal[style*='flex']")) return;
    if (document.querySelector("#modalPersonalizar.abierto")) return;

    const selector = vaSelectorCacheActual(seccion);
    const el = selector ? document.querySelector(selector) : null;

    // ✅ Nunca guardar HTML visual de ABC.
// ABC debe cargarse fresco desde abc.js, no desde localStorage.
if (seccion === "iglesia" && selector === "#iglesia-abc") {
  localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
  return;
}

        // ✅ Por seguridad, nunca guardar HTML visual de Recursos.
    // Así no puede reaparecer al iniciar antes de validar permisos.
    if (seccion === "iglesia" && selector === "#iglesia-recursos") {
      localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
      return;
    }

    let html = el ? String(el.innerHTML || "") : "";

    // Evita guardar cosas gigantes que rompan localStorage.
    if (html.length > VA_UI_SNAPSHOT_MAX_HTML) {
      html = "";
    }

    const snap = {
      seccion,
      selector,
      html,
      tituloBibliaHtml: document.getElementById("titulo")?.innerHTML || "",
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      scrollTopInterno: el && el !== document.body ? Number(el.scrollTop || 0) : 0,
      bodyOscuro: document.body.classList.contains("oscuro"),
      ts: Date.now()
    };

    localStorage.setItem(VA_UI_SNAPSHOT_KEY, JSON.stringify(snap));
  } catch (e) {
    console.warn("No pude guardar caché visual rápido:", e);
  }
}

function vaLeerSnapshotVisual() {
  try {
    const raw = localStorage.getItem(VA_UI_SNAPSHOT_KEY);
    if (!raw) return null;

    const snap = JSON.parse(raw);
    if (!snap || !snap.ts) return null;

    const vencido = Date.now() - Number(snap.ts || 0) > VA_UI_SNAPSHOT_MAX_AGE;
    if (vencido) return null;

    if (!vaSeccionValidaApp(snap.seccion)) return null;

    return snap;
  } catch (e) {
    console.warn("No pude leer caché visual rápido:", e);
    return null;
  }
}

function vaMostrarCargandoSuave(texto = "Actualizando...") {
  let pill = document.getElementById("vaCacheActualizando");
  if (!pill) {
    pill = document.createElement("div");
    pill.id = "vaCacheActualizando";
    pill.style.cssText = `
      position:fixed;
      left:50%;
      bottom:78px;
      transform:translateX(-50%);
      z-index:999999;
      padding:8px 12px;
      border-radius:999px;
      background:rgba(0,0,0,.68);
      color:#fff;
      font-size:12px;
      font-weight:800;
      box-shadow:0 6px 18px rgba(0,0,0,.22);
      pointer-events:none;
      opacity:.92;
    `;
    document.body.appendChild(pill);
  }

  pill.textContent = texto;

  clearTimeout(pill._tm);
  pill._tm = setTimeout(() => {
    pill.remove();
  }, 3500);
}

function vaRestaurarSnapshotVisualRapido() {
  
// ✅ Teléfonos: no restaurar HTML cacheado pesado.
if (vaEsMovil()) {
  try {
    localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
  } catch (_) {}
  return false;
}
  
  const snap = vaLeerSnapshotVisual();
  if (!snap) return false;
  if (vaHayLinkDirectoInterno()) return false;

  // ✅ Nunca restaurar HTML viejo de ABC.
// Si quedó guardado de antes, lo borramos y dejamos que abc.js lo dibuje limpio.
if (snap.seccion === "iglesia" && snap.selector === "#iglesia-abc") {
  localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
  return false;
}

    // ✅ Si quedó una caché vieja de Recursos, no mostrarla nunca.
  if (snap.seccion === "iglesia" && snap.selector === "#iglesia-recursos") {
    localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
    return false;
  }

  try {
    if (snap.bodyOscuro) {
      document.body.classList.add("oscuro");
    }

    forzarSeccionActiva(snap.seccion);

    // Menú activo rápido.
    document.querySelectorAll("#menu .nav-btn").forEach(b => b.classList.remove("activo"));
    const btnActivo = document.querySelector(`#menu .nav-btn[onclick="irA('${snap.seccion}')"]`);
    if (btnActivo) btnActivo.classList.add("activo");

    // Restaurar HTML del contenedor visible.
    if (snap.selector && snap.html) {
      const el = document.querySelector(snap.selector);
      if (el) {
        el.innerHTML = snap.html;

        if (snap.selector.startsWith("#iglesia-")) {
          ["devocionales", "abc", "subidos", "recursos"].forEach(k => {
            const sub = document.getElementById("iglesia-" + k);
            if (sub) {
              sub.style.setProperty(
                "display",
                snap.selector === "#iglesia-" + k ? "block" : "none",
                "important"
              );
            }
          });
        }

        if (snap.selector.startsWith("#panel-")) {
          ["imagenes", "marcadores", "compartidos", "abc", "recursos"].forEach(k => {
            const sub = document.getElementById("panel-" + k);
            if (sub) {
              sub.style.setProperty(
                "display",
                snap.selector === "#panel-" + k ? "block" : "none",
                "important"
              );
            }
          });
        }

        if (Number(snap.scrollTopInterno || 0) > 0) {
          setTimeout(() => {
            try {
              el.scrollTop = Number(snap.scrollTopInterno || 0);
            } catch (_) {}
          }, 60);
        }
      }
    }

    // Biblia: restaurar título visual rápido si estaba disponible.
    if (snap.seccion === "biblia" && snap.tituloBibliaHtml) {
      const t = document.getElementById("titulo");
      if (t) t.innerHTML = snap.tituloBibliaHtml;
    }

    setTimeout(() => {
      window.scrollTo({
        top: Number(snap.scrollY || 0),
        behavior: "auto"
      });
    }, 80);

    vaMostrarCargandoSuave("Restaurando donde estabas...");

    return true;
  } catch (e) {
    console.warn("No pude restaurar caché visual rápido:", e);
    return false;
  }
}

function irArribaBiblia() {
  const primerVersiculo = document.querySelector("#texto .versiculo");
  const barra = document.getElementById("barraTituloBiblia");

  if (primerVersiculo) {
    const rect = primerVersiculo.getBoundingClientRect();
    const barraH = barra ? barra.offsetHeight : 0;

    window.scrollTo({
      top: Math.max(0, window.scrollY + rect.top - barraH - 6),
      behavior: "auto"
    });
    return;
  }

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });
}

function restaurarEstadoBibliaInicial() {
  const estado = leerEstadoBiblia();
  if (!estado) return;

  // versión
  if (estado.version === "NTV") {
    versionActual = "NTV";
    bibliaData = bibliaDataNTV;
  } else {
    versionActual = "RV1960";
    bibliaData = bibliaDataRV;
  }

  // libro
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));

  if (estado.libro && libros.includes(estado.libro)) {
    libroSel.value = estado.libro;
  }

  // capítulos
  cargarCapitulos({ capituloPreferido: estado.capitulo, irArriba: false, guardar: false });

   // ✅ Biblia solo restaura Biblia.
  // La pantalla inicial la decide vaAbrirPantallaInicialUnaVez().
  if (estado.seccion === "biblia") {
    setTimeout(() => {
      if (obtenerSeccionActual() === "biblia") {
        window.scrollTo({
          top: Number(estado.scrollBiblia || 0),
          behavior: "auto"
        });
      }
    }, 120);
  }
}

// ================= REGISTRAR USUARIO ===================================
async function registrarUsuarioActual(user) {
  try {
    if (!user?.uid) return;

    const nombre =
      user.displayName ||
      user.email?.split("@")[0] ||
      "Sin nombre";

    const data = {
      uid: user.uid,
      nombre: nombre,
      email: user.email || "",
      ultimoAcceso: Date.now()
    };

    const snap = await get(ref(db, `usuarios/${user.uid}`));
    const actual = snap.val() || {};

    await set(ref(db, `usuarios/${user.uid}`), {
      uid: user.uid,
      nombre: actual.nombre || data.nombre,
      email: actual.email || data.email,
      ultimoAcceso: Date.now()
    });
  } catch (e) {
    console.warn("No pude registrar usuario actual:", e);
  }
}

function mostrarPanelVisitante() {
  const panel = document.getElementById("seccion-panel");
  if (!panel) return;

  const tabs = panel.querySelector(".panel-tabs");
  if (tabs) tabs.style.display = "none";

  ["imagenes", "marcadores", "compartidos", "abc", "recursos"].forEach(s => {
    const el = document.getElementById("panel-" + s);
    if (el) el.style.setProperty("display", "none", "important");
  });

  const topRow = document.getElementById("panelImgTopRow");
  const indexRow = document.getElementById("panelImgIndexRow");
  const feed = document.getElementById("panelImgFeed");
  const grid = document.getElementById("grid-imagenes");
  const vacio = document.getElementById("imagenes-vacio");

  if (topRow) topRow.innerHTML = "";
  if (indexRow) indexRow.innerHTML = "";
  if (grid) grid.innerHTML = "";
  if (vacio) vacio.style.display = "none";
  if (feed) feed.innerHTML = "";

  let msg = document.getElementById("panelVisitanteMsg");

  if (!msg) {
    msg = document.createElement("div");
    msg.id = "panelVisitanteMsg";
    msg.className = "panel-vacio-login";
    panel.appendChild(msg);
  }

  msg.innerHTML = `
    <div class="panel-vacio-login-icon">
      <i class="fa-solid fa-user-lock"></i>
    </div>

    <b>Mi Panel</b>

    <p>
      Puedes loguearte para guardar aquí tus devocionales preferidos,
      las publicaciones que te gusten, las notas que generes y más.
    </p>

    <button type="button" class="btn-primary" onclick="window.location.href='login.html'">
      <i class="fa-brands fa-google"></i>
      Iniciar sesión
    </button>
  `;

  msg.style.display = "block";
}

function ocultarPanelVisitante() {
  const panel = document.getElementById("seccion-panel");
  if (!panel) return;

  const tabs = panel.querySelector(".panel-tabs");
  if (tabs) tabs.style.display = "";

  const msg = document.getElementById("panelVisitanteMsg");
  if (msg) msg.style.display = "none";
}

window.actualizarPermisosUI = function () {
  const esAdmin = !!window.__ES_ADMIN;
  const esColaborador = !!window.__ES_COLABORADOR;
  const puedeVerRecursos = esAdmin || esColaborador;

  if (!uid) {
    const btnPanelImgNuevo = document.getElementById("btnPanelImgNuevo");
    if (btnPanelImgNuevo) btnPanelImgNuevo.style.display = "none";

    const panelImgTopRow = document.getElementById("panelImgTopRow");
    if (panelImgTopRow) panelImgTopRow.innerHTML = "";

    if (document.body.classList.contains("en-panel")) {
      mostrarPanelVisitante();
    }
  } else {
    ocultarPanelVisitante();
  }

  // ✅ Recursos: solo admin o colaborador
  const btnTabRecursos = document.getElementById("btnTabRecursos");
  if (btnTabRecursos) {
    btnTabRecursos.style.display = puedeVerRecursos ? "inline-flex" : "none";
  }

    const btnOpcionRecursos = document.getElementById("btnOpcionRecursos");
  if (btnOpcionRecursos) {
    btnOpcionRecursos.style.display = puedeVerRecursos ? "inline-flex" : "none";
  }

  // ✅ Permisos dentro de Recursos: solo admin
  const btnTabPermisos = document.getElementById("btnTabPermisos");
  if (btnTabPermisos) {
    btnTabPermisos.style.display = esAdmin ? "inline-flex" : "none";
  }

  const wrapRecursos = document.getElementById("iglesia-recursos");
  const recursosPermisos = document.getElementById("recursos-permisos");

// ✅ Si usuario común quedó en Recursos por estado guardado, lo sacamos.
// Ya NO lo mandamos a Devocionales: va a Compartidos.
if (wrapRecursos && !puedeVerRecursos) {
  wrapRecursos.style.display = "none";

  if (document.body.classList.contains("en-iglesia")) {
    setTimeout(() => {
      try {
        if (typeof window.irA === "function") {
          window.irA("compartidos");
        } else if (typeof window.forzarSeccionActiva === "function") {
          window.forzarSeccionActiva("compartidos");
        }
      } catch (e) {
        console.warn(e);
      }
    }, 0);
  }
}

  // ✅ Si colaborador estaba en Permisos, lo mandamos a Ediciones
  if (
    puedeVerRecursos &&
    !esAdmin &&
    recursosPermisos &&
    getComputedStyle(recursosPermisos).display !== "none"
  ) {
    setTimeout(() => {
      try {
        window.mostrarRecursosSub?.("ediciones");
      } catch (e) {
        console.warn(e);
      }
    }, 0);
  }

  // botones ya existentes que dependían de admin
  const btnDevNuevo = document.getElementById("btnDevNuevo");
  if (btnDevNuevo) btnDevNuevo.style.display = esAdmin ? "inline-flex" : "none";

  const btnSubidoNuevo = document.getElementById("btnSubidoNuevo");
  if (btnSubidoNuevo) btnSubidoNuevo.style.display = esAdmin ? "inline-flex" : "none";

if (typeof panelImgRenderAddBoton === "function") {
  panelImgRenderAddBoton();
}

try {
  aplicarUIAccionesPorModo?.();
} catch(e) {}
};

// ================= AUTH =====================================
onAuthStateChanged(auth, async user => {
  uid = user ? user.uid : null;

  window.__UID = uid;

if (!uid) {
  if (vaLoginAndroidEnCurso || localStorage.getItem(VA_ANDROID_ID_TOKEN_KEY)) {
    return;
  }

  const puedeEntrarComoVisitante = vaEntradaVisitante();

  // ✅ Primer ingreso real sin login y sin elegir visitante:
  // va a la pantalla bienvenida/login.
  if (!puedeEntrarComoVisitante) {
    window.location.replace("/VidaAbundante/login.html");
    return;
  }

  // ✅ MODO VISITANTE
  localStorage.setItem(VA_VISITANTE_KEY, "1");

  window.__UID = null;
  window.__ES_ADMIN = false;
  window.__ES_COLABORADOR = false;

  try {
    actualizarPermisosUI();
  } catch (e) {
    console.warn("No pude actualizar permisos visitante:", e);
  }

  vaLimpiarParamsEntrada();

 vaAbrirPantallaInicialUnaVez(
    vaSeccionInicialVisitante(),
    "visitante"
  );

  setTimeout(() => {
    document.getElementById("vaCacheActualizando")?.remove();
    vaGuardarSnapshotVisual();
  }, 1200);

  return;
}
vaLimpiarParamsEntrada();
  
  // ✅ registrar automáticamente al usuario que entró
  await registrarUsuarioActual(user);

  // ✅ Pintar de inmediato la apariencia guardada en este dispositivo.
  // Así la app abre visualmente sin esperar Firebase.
  try {
    aplicarFondosGuardados();
  } catch (e) {
    console.warn("No pude aplicar apariencia local:", e);
  }

  // ✅ Actualizar fondos desde Firebase en segundo plano.
  // Ya no frena la entrada a la app.
  cargarFondosFirebaseUsuario().catch((e) => {
    console.warn("No pude actualizar apariencia en segundo plano:", e);
  });

  // ✅ roles globales
  window.__ES_ADMIN = false;
  window.__ES_COLABORADOR = false;

  // ✅ cargar paleta de resaltadores del usuario
  sincronizarResaltadoresUsuario().then(() => {
    try { initResaltadorCompacto?.(); } catch(e){}
    try { actualizarUICandadoResaltador?.(); } catch(e){}
  });

  // ✅ admin
onValue(ref(db, "admins/" + uid), (s) => {
window.__ES_ADMIN = !!s.val();
window.__PUEDE_CREAR_IMAGEN_BIBLIA = !!(window.__ES_ADMIN || window.__ES_COLABORADOR);

actualizarPermisosUI();
vaRepintarCrearImagenBibliaConReintentos();

  // ✅ iPhone/Safari: si Mi Panel Imágenes se pintó antes de saber que era admin,
  // reconstruimos el botón + apenas llega el permiso.
  if (typeof panelImgRenderAddBoton === "function") {
    panelImgRenderAddBoton();
  }

  if (typeof renderPanelImagenes === "function") {
    renderPanelImagenes(panelImagenesGuardadas || {});
  }

  // ✅ si Compartidos ya se pintó antes de cargar permisos,
  // lo volvemos a pintar para que aparezcan los deletes de admin
  if (typeof window.renderCompartidos === "function") {
    window.renderCompartidos();
  }
});

  // ✅ colaborador
onValue(ref(db, "colaboradores/" + uid), (s) => {
  window.__ES_COLABORADOR = !!s.val();
  window.__PUEDE_CREAR_IMAGEN_BIBLIA = !!(window.__ES_ADMIN || window.__ES_COLABORADOR);

  actualizarPermisosUI();

  // ✅ El rol colaborador llega después de pintar la barra.
  // Repintamos varias veces para ganarle a cualquier render posterior.
  vaRepintarCrearImagenBibliaConReintentos();

  try {
    if (obtenerSeccionActual() === "biblia") {
      mostrarTexto({ guardar: false });
    }
  } catch(e) {}
});

onValue(ref(db, "marcados/" + uid), s => {
  marcados = s.val() || {};

  if (obtenerSeccionActual() === "biblia") {
    mostrarTexto({ guardar: false });
  }
});

  // ✅ Cargar imágenes del panel (personal)
onValue(ref(db, "panelImagenesPersonal/" + uid), s => {
  const data = s.val() || {};
  panelImagenesGuardadas = data;

  // ✅ En celulares no renderizamos Mi Panel si no está visible.
  // Esto evita cargar muchas imágenes al iniciar Biblia/Compartidos.
  if (
    document.body.classList.contains("en-panel") &&
    document.getElementById("panel-imagenes")?.offsetParent !== null
  ) {
    renderPanelImagenes(data);
  }
});

onValue(ref(db, "compartidos/imagenes"), s => {
  const data = s.val() || {};

  panelImagenesCompartidosCache = data;
  panelImagenesPublicadas = {};

  Object.entries(data).forEach(([compId, item]) => {
    if (!item || typeof item !== "object") return;

    const info = {
      compId,
      path: `compartidos/imagenes/${compId}`,
      item
    };

    const panelId = String(item?.panelItemId || "");
    if (panelId) {
      panelImagenesPublicadas[panelId] = info;
    }

    const sourcePanelId = String(item?.sourcePanelItemId || "");
    if (sourcePanelId) {
      panelImagenesPublicadas[sourcePanelId] = info;
    }
  });

  // ✅ Antes solo repintaba si Mi Panel estaba visible.
  // Ahora repinta también si está oculto, para no dejar check viejo.
  if (typeof panelImagenRefrescarPanelSiVisible === "function") {
    panelImagenRefrescarPanelSiVisible();
  } else if (
    typeof renderPanelImagenes === "function" &&
    document.getElementById("panelImgFeed")
  ) {
    renderPanelImagenes(panelImagenesGuardadas || {});
  }
});

onValue(ref(db, "compartidos/notas"), s => {
  const data = s.val() || {};
  notasCompartidasPanel = {};

  Object.entries(data).forEach(([compId, item]) => {
    const marcadorId = String(item?.marcadorId || "");
    const owner = String(item?.publicadoPor || item?.uid || "");

    // ✅ Solo relacionamos con Mi Panel las publicaciones creadas por este usuario.
    if (marcadorId && owner === String(uid || "")) {
      notasCompartidasPanel[marcadorId] = {
        compId,
        item
      };
    }
  });

  const panelMarcadores = document.getElementById("panel-marcadores");
  if (panelMarcadores && panelMarcadores.offsetParent !== null) {
    renderPanelMarcadores();
  }
});
  
  // ✅ Cargar recursos guardados en Mi Panel: ABC + RH / Recursos
onValue(ref(db, "panelRecursos/" + uid), s => {
  panelRecursosGuardados = s.val() || {};

  renderPanelABCGuardados();
  renderPanelRecursosGuardados();
});

// ✅ Cargar compartidos/ediciones guardadas en Mi Panel
onValue(ref(db, "panelEdiciones/" + uid), s => {
  panelEdicionesGuardadas = s.val() || {};

  renderPanelCompartidosGuardados();
});
  
  // ✅ Cargar marcadores
  onValue(ref(db, "marcadores/" + uid), s => {
    marcadores = s.val() || {};

    window.notasBibliaIndex = {};
    window.notasBibliaPluma = {};
    window.notasABCIndex = {};

    notasBibliaIndex = window.notasBibliaIndex;
    notasBibliaPluma = window.notasBibliaPluma;
    notasABCIndex = window.notasABCIndex;

Object.entries(marcadores || {}).forEach(([idMarcador, m]) => {
      const tieneNota = !!(m?.nota && String(m.nota).trim());
      if (!tieneNota) return;

      if (m?.origen === "abc") {
        const bid = m?.abcBidLast || m?.abcBid || null;
        if (bid) notasABCIndex[bid] = true;
        return;
      }

      const itemsMarcador = itemsMarcadorDesdeData(m);
      if (!itemsMarcador.length) return;

      itemsMarcador.forEach(it => {
        notasBibliaIndex[`${it.Libro}_${it.Capitulo}_${it.Versiculo}`] = true;
      });

      // ✅ la pluma va en el último marcado según TU orden real
      const last = itemsMarcador[itemsMarcador.length - 1];

      if (last) {
        const idVersiculo = `${last.Libro}_${last.Capitulo}_${last.Versiculo}`;
        notasBibliaPluma[idVersiculo] = idMarcador;
      }
    });

    const panelMarcadores = document.getElementById("panel-marcadores");
    if (panelMarcadores && panelMarcadores.offsetParent !== null) {
      renderPanelMarcadores();
    }

    if (obtenerSeccionActual() === "biblia") {
  mostrarTexto({ guardar: false });
}

    if (typeof abcMarcarSeleccionUI === "function") {
      abcMarcarSeleccionUI();
    }
  });

   vaAbrirPantallaInicialUnaVez(
    vaSeccionInicialLogueado(),
    "usuario-logueado"
  );

  setTimeout(() => {
  document.getElementById("vaCacheActualizando")?.remove();
  vaGuardarSnapshotVisual();
}, 1200);

});

// ================= 💾 GUARDADO RÁPIDO AL SALIR / BLOQUEAR =================
// Android puede matar la PWA al bloquear pantalla o dejarla en segundo plano.
// Guardamos el estado apenas la app pierde visibilidad para que al volver abra mejor.
function vaGuardarEstadoAntesDeSuspender() {
  try {
    if (typeof guardarEstadoBiblia === "function") {
      guardarEstadoBiblia({
        seccion: window.__SECCION_ACTIVA || obtenerSeccionActual?.() || "compartidos",
        subIglesia: window.__IGLESIA_SUB_ACTIVA || "",
        subRecursos: window.__RECURSOS_SUB_ACTIVA || "",
        scrollY: window.scrollY || document.documentElement.scrollTop || 0,
        ts: Date.now()
      });
    }
  } catch (e) {
    console.warn("No pude guardar estado antes de suspender:", e);
  }

  try {
    if (typeof vaGuardarSnapshotVisual === "function") {
      vaGuardarSnapshotVisual();
    }
  } catch (e) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    vaGuardarEstadoAntesDeSuspender();
  }
});

window.addEventListener("pagehide", vaGuardarEstadoAntesDeSuspender);
window.addEventListener("beforeunload", vaGuardarEstadoAntesDeSuspender);

// ================= DOM (script al final del body)  =================
const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const loginModal = document.getElementById("loginModal");

// ✅ Muestra rápido la última pantalla guardada,
// mientras Firebase/Biblia/R2 terminan de cargar de verdad.
// Si en teléfono no usamos caché visual, igual fijamos UNA pantalla inicial
// para que no se vean varias secciones ni parezca que cambia solo.
const vaSnapshotRapidoOk = vaRestaurarSnapshotVisualRapido();

if (!vaSnapshotRapidoOk) {
  let seccionTemprana = "";

  if (vaEsLinkCompartidosDirecto()) {
    seccionTemprana = "compartidos";
  } else if (!vaHayLinkDirectoInterno()) {
    seccionTemprana = vaEntradaVisitante()
      ? vaSeccionInicialVisitante()
      : vaSeccionInicialLogueado();
  }

  if (vaSeccionValidaApp(seccionTemprana)) {
    forzarSeccionActiva(seccionTemprana);
  }
}

// ================= 🔎 HELPERS FILTROS BIBLIA =================
let filtroBibliaBackup = null;

// ================= 🔁 RETORNO RÁPIDO DESDE FILTROS BIBLIA =================
const LS_FILTRO_BIBLIA_RETORNO = "va_biblia_filtro_retorno_v1";

/* ✅ La marca empieza vacía cada vez que abrís la app.
   Así el botón NO arranca activo apenas abrís filtros. */
let filtroBibliaRetorno = null;

try {
  localStorage.removeItem(LS_FILTRO_BIBLIA_RETORNO);
} catch (e) {}

function leerRetornoFiltrosBiblia() {
  try {
    const raw = localStorage.getItem(LS_FILTRO_BIBLIA_RETORNO);
    const data = raw ? JSON.parse(raw) : null;

    if (!data || !data.libro || !data.capitulo) return null;

    return {
      version: data.version === "NTV" ? "NTV" : "RV1960",
      libro: String(data.libro || ""),
      capitulo: Number(data.capitulo || 1),
      scroll: Number(data.scroll || 0),
      ts: Number(data.ts || Date.now())
    };
  } catch (e) {
    return null;
  }
}

function guardarRetornoFiltrosBibliaLocal(data) {
  // ✅ Solo memoria viva de la app, no localStorage.
  // Así se activa cuando tocás el clip, pero no queda pegado al reiniciar.
  filtroBibliaRetorno = data;
}

function borrarRetornoFiltrosBiblia() {
  filtroBibliaRetorno = null;

  try {
    localStorage.removeItem(LS_FILTRO_BIBLIA_RETORNO);
  } catch (e) {}
}

function obtenerEstadoLecturaParaRetornoFiltros() {
  const bk = filtroBibliaBackup || {};

  return {
    version: bk.version || versionActual || "RV1960",
    libro: bk.libro || libroSel?.value || "",
    capitulo: Number(bk.capitulo || capSel?.value || 1),
    scroll: Number.isFinite(Number(bk.scroll))
      ? Number(bk.scroll)
      : (window.scrollY || document.documentElement.scrollTop || 0),
    ts: Date.now()
  };
}

function filtrosBibliaMismoLugar(a, b) {
  if (!a || !b) return false;

  const mismoCapitulo =
    String(a.version || "RV1960") === String(b.version || "RV1960") &&
    String(a.libro || "") === String(b.libro || "") &&
    Number(a.capitulo || 0) === Number(b.capitulo || 0);

  if (!mismoCapitulo) return false;

  // ✅ Si es el mismo capítulo pero otro scroll, igual permite volver.
  return Math.abs(Number(a.scroll || 0) - Number(b.scroll || 0)) < 40;
}

function asegurarBotonRetornoFiltrosBiblia() {
  const filtros = document.getElementById("filtrosBiblia");
  if (!filtros) return null;

  let btn = document.getElementById("btnRetornoFiltrosBiblia");

  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "btnRetornoFiltrosBiblia";
    btn.className = "btn-retorno-filtros";
    btn.setAttribute("aria-label", "Guardar o volver al punto de lectura");

    const btnAplicar = document.getElementById("btnAplicarFiltrosBiblia");

    if (btnAplicar && btnAplicar.parentElement === filtros) {
      filtros.insertBefore(btn, btnAplicar);
    } else {
      filtros.appendChild(btn);
    }
  }

  if (!btn.dataset.ready) {
    btn.dataset.ready = "1";

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.dataset.modo === "volver") {
        volverPuntoRetornoFiltrosBiblia();
      } else {
        guardarPuntoRetornoFiltrosBiblia();
      }
    });
  }

  actualizarBotonRetornoFiltrosBiblia();

  return btn;
}

function actualizarBotonRetornoFiltrosBiblia() {
  const btn = document.getElementById("btnRetornoFiltrosBiblia");
  if (!btn) return;

  const actual = obtenerEstadoLecturaParaRetornoFiltros();

  const hayMarcaGuardada = !!filtroBibliaRetorno;

  const puedeVolver =
    hayMarcaGuardada &&
    !filtrosBibliaMismoLugar(filtroBibliaRetorno, actual);

  // ✅ si estoy en otro lugar: vuelve
  // ✅ si estoy en el mismo lugar: sigue siendo paperclip para actualizar la marca
  btn.dataset.modo = puedeVolver ? "volver" : "guardar";

  // ✅ activo cuando existe una marca guardada, aunque todavía sea paperclip
  btn.classList.toggle("activo", hayMarcaGuardada);

  btn.classList.toggle("modo-guardado", hayMarcaGuardada && !puedeVolver);
  btn.classList.toggle("modo-volver", puedeVolver);

  btn.innerHTML = puedeVolver
    ? `<i class="fa-solid fa-reply"></i>`
    : `<i class="fa-solid fa-paperclip"></i>`;

  btn.title = puedeVolver
    ? "Volver al punto guardado"
    : hayMarcaGuardada
      ? "Punto guardado. Tocar para actualizarlo"
      : "Guardar este punto de lectura";
}

function guardarPuntoRetornoFiltrosBiblia() {
  const estado = obtenerEstadoLecturaParaRetornoFiltros();

  if (!estado.libro) return;

  guardarRetornoFiltrosBibliaLocal(estado);
  actualizarBotonRetornoFiltrosBiblia();

  if (typeof mostrarToast === "function") {
    mostrarToast("📎 Punto de lectura guardado");
  }
}

function volverPuntoRetornoFiltrosBiblia() {
const destino = filtroBibliaRetorno;

  if (!destino || !destino.libro) {
    if (typeof mostrarToast === "function") {
      mostrarToast("No hay punto guardado");
    }
    return;
  }

  // ✅ restaurar versión
  if (destino.version === "NTV" && bibliaDataNTV.length) {
    versionActual = "NTV";
    bibliaData = bibliaDataNTV;
  } else {
    versionActual = "RV1960";
    bibliaData = bibliaDataRV;
  }

  const libros = [...new Set(bibliaData.map(v => v.Libro))];

  if (!libros.includes(destino.libro)) {
    if (typeof mostrarToast === "function") {
      mostrarToast("No encontré ese libro en esta versión");
    }
    return;
  }

  libroSel.value = destino.libro;
  reconstruirCapitulosParaLibro(destino.libro, destino.capitulo);
  capSel.value = String(destino.capitulo);

  mostrarTexto({
    irArriba: false,
    guardar: true
  });

  cerrarFiltrosBiblia(false);

  const y = Math.max(0, Number(destino.scroll || 0));

  requestAnimationFrame(() => {
    window.scrollTo({
      top: y,
      behavior: "auto"
    });

    setTimeout(() => {
      window.scrollTo({
        top: y,
        behavior: "auto"
      });

      guardarEstadoBiblia();
    }, 80);
  });

  borrarRetornoFiltrosBiblia();

  if (typeof mostrarToast === "function") {
    mostrarToast("↩️ Volviste al punto guardado");
  }
}

function normalizarTextoFiltro(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getLibrosUnicosActuales() {
  return [...new Set(bibliaData.map(v => v.Libro))];
}

function reconstruirCapitulosParaLibro(libro, capituloPreferido = 1) {
  if (!capSel) return;

  const caps = [...new Set(
    bibliaData
      .filter(v => v.Libro === libro)
      .map(v => Number(v.Capitulo))
  )].sort((a, b) => a - b);

  capSel.innerHTML = "";

  caps.forEach(c => {
    capSel.innerHTML += `<option value="${c}">${c}</option>`;
  });

  const destino = caps.includes(Number(capituloPreferido))
    ? Number(capituloPreferido)
    : (caps[0] || 1);

  capSel.value = String(destino);
}

function abrirFiltrosBiblia() {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn  = document.getElementById("btnToggleFiltros");
  if (!wrap) return;

  filtroBibliaBackup = {
    version: versionActual || "RV1960",
    libro: libroSel?.value || "",
    capitulo: Number(capSel?.value || 1),
    scroll: window.scrollY || document.documentElement.scrollTop || 0,
    input: document.getElementById("buscarLibroBiblia")?.value || ""
  };

  asegurarBotonRetornoFiltrosBiblia();
  actualizarBotonRetornoFiltrosBiblia();

  wrap.classList.add("abierto");
if (btn) btn.classList.add("activo");

   if (libroSel) {
    Array.from(libroSel.options).forEach(opt => {
      opt.hidden = false;
    });
  }
  
  setTimeout(() => {
    const inputBuscar = document.getElementById("buscarLibroBiblia");
    if (inputBuscar) inputBuscar.focus();
  }, 0);
}

function cerrarFiltrosBiblia(cancelar = false) {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn  = document.getElementById("btnToggleFiltros");
  const inputBuscar = document.getElementById("buscarLibroBiblia");

  if (!wrap) return;

  if (cancelar && filtroBibliaBackup) {
    if (libroSel && filtroBibliaBackup.libro) {
      libroSel.value = filtroBibliaBackup.libro;
      reconstruirCapitulosParaLibro(filtroBibliaBackup.libro, filtroBibliaBackup.capitulo);
    }
    if (inputBuscar) {
      inputBuscar.value = filtroBibliaBackup.input || "";
    }
  }

wrap.classList.remove("abierto");
if (btn) {
    btn.classList.remove("activo");
    btn.blur();
  }

  if (document.activeElement?.blur) {
    document.activeElement.blur();
  }
}

function aplicarFiltrosBiblia() {
  const libro = libroSel?.value || "";
  const capitulo = Number(capSel?.value || 1);

  if (!libro) {
    cerrarFiltrosBiblia(true);
    return;
  }

  reconstruirCapitulosParaLibro(libro, capitulo);
  mostrarTexto({ irArriba: true, guardar: true });
  cerrarFiltrosBiblia(false);
}

// ================= CONTEXTO: AISLAR MODOS BIBLIA vs ABC =================
// Guarda el estado de Biblia y lo apaga visualmente al entrar en ABC.
// Luego lo restaura al volver a Biblia.

window.__bibliaUIBackup = window.__bibliaUIBackup || null;

function bibliaBackupUI() {
  // guardo flags + selecciones (lo importante)
  window.__bibliaUIBackup = {
    modoImagen: !!modoImagen,
    modoMarcador: !!modoMarcador,
    seleccionImagen: { ...(seleccionImagen || {}) },
    seleccionImagenOrden: [...(seleccionImagenOrden || [])],
seleccionMarcador: { ...(seleccionMarcador || {}) },
seleccionMarcadorOrden: [...(seleccionMarcadorOrden || [])],
    userSetFontSize: !!userSetFontSize
  };
}

function bibliaApagarModosParaCambiarSeccion() {
  // cerrar modal de imagen si estaba abierto (pero no “romper” nada)
  try { cerrarModalPersonalizar?.(); } catch(e){}

  // apagar flags (para que NO afecten UI de otras secciones)
  modoImagen = false;
  modoMarcador = false;

  // limpiar clases visuales
  document.body.classList.remove("modo-imagen", "modo-marcador");

  // ocultar banners si existen
  const bImg = document.getElementById("bannerModoImagen");
  if (bImg) bImg.style.display = "none";

  const bMar = document.getElementById("bannerModoMarcador");
  if (bMar) bMar.style.display = "none";

  // sacar “activo” del botón 📌 por si quedó pegado
  const btnPin = document.getElementById("btnModoMarcadorBarra");
  if (btnPin) btnPin.classList.remove("activo");

  // dejar UI consistente
  try { aplicarUIAccionesPorModo?.(); } catch(e){}
  try { refrescarBotonGuardarMarcador?.(); } catch(e){}
}

function bibliaRestaurarUIAlVolver() {
  const bk = window.__bibliaUIBackup;
  if (!bk) return;

  modoImagen = !!bk.modoImagen;
  modoMarcador = !!bk.modoMarcador;
  seleccionImagen = { ...(bk.seleccionImagen || {}) };
  seleccionImagenOrden = [...(bk.seleccionImagenOrden || [])];
  seleccionMarcador = { ...(bk.seleccionMarcador || {}) };
  seleccionMarcadorOrden = [...(bk.seleccionMarcadorOrden || [])];
  userSetFontSize = !!bk.userSetFontSize;

  // restaurar clases visuales
  document.body.classList.toggle("modo-imagen", modoImagen);
  document.body.classList.toggle("modo-marcador", modoMarcador);

  // banners
  const bImg = document.getElementById("bannerModoImagen");
  if (bImg) bImg.style.display = modoImagen ? "block" : "none";

  const bMar = document.getElementById("bannerModoMarcador");
  if (bMar) {
    ubicarBannerModoMarcadorDebajoTitulo();
    bMar.style.display = modoMarcador ? "block" : "none";
  }

  // botón 📌 activo o no
  const btnPin = document.getElementById("btnModoMarcadorBarra");
  if (btnPin) btnPin.classList.toggle("activo", modoMarcador);

  // UI normal
  try { aplicarUIAccionesPorModo?.(); } catch(e){}
  try { refrescarBotonGuardarMarcador?.(); } catch(e){}
  try { mostrarTexto?.(); } catch(e){}
}

// ================= ⭐ CARGA BIBLIA ==============================
const BIBLIA_VERSION_CACHE = "2026-05-01-correcciones2";

Promise.all([
  fetch(`VidaAbundante - RV1960.json?v=${BIBLIA_VERSION_CACHE}`).then(r => r.json()),
  fetch(`biblia_ntv.json?v=${BIBLIA_VERSION_CACHE}`).then(r => r.json())
])
.then(([rvData, ntvData]) => {
  bibliaDataRV = Array.isArray(rvData) ? rvData : [];
  bibliaDataNTV = Array.isArray(ntvData) ? ntvData : [];

  // arranca por defecto en RV1960
   bibliaData = bibliaDataRV;
  versionActual = "RV1960";

  requestAnimationFrame(() => {
    iniciar();
  });
})
.catch(err => {
  console.error("❌ Error cargando Biblias:", err);
});

// =======

document.fonts.ready.then(() => {
  console.log("✅ Fuentes cargadas");

  // ✅ solo refrescar si el modal existe y está visible
  const modal = document.getElementById("modalPersonalizar");
  if (modal && getComputedStyle(modal).display !== "none") {
    actualizarPreview();
  }
});

// ================= ⭐ INICIAR BIBLIA ==============================
function iniciar() {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  libroSel.innerHTML = "";
  libros.forEach(l => (libroSel.innerHTML += `<option>${l}</option>`));

  libroSel.onchange = () => {
    // ✅ en filtros, solo preparar capítulos y dejar 1 por default
    reconstruirCapitulosParaLibro(libroSel.value, 1);
  };

  capSel.onchange = () => {
    // ✅ no navegar automáticamente desde el filtro
  };

  restaurarEstadoBibliaInicial();
  
}

// ================= ⭐ CARGA CAPITULOS ==============================
function cargarCapitulos(opts = {}) {
  const {
    capituloPreferido = null,
    irArriba = false,
    guardar = true
  } = opts;

  const valorAnterior = Number(capSel?.value || 1);

  capSel.innerHTML = "";

  const caps = [...new Set(
    bibliaData
      .filter(v => v.Libro === libroSel.value)
      .map(v => Number(v.Capitulo))
  )].sort((a, b) => a - b);

  caps.forEach(c => {
    capSel.innerHTML += `<option value="${c}">${c}</option>`;
  });

  let destino = Number(capituloPreferido);

  if (!Number.isFinite(destino) || !caps.includes(destino)) {
    destino = caps.includes(valorAnterior) ? valorAnterior : caps[0];
  }

  if (Number.isFinite(destino)) {
    capSel.value = String(destino);
  }

  mostrarTexto({ irArriba, guardar });
}

// ================= ⭐ MOSTRAR TOAST ==============================
function mostrarToast(msg, ms = 2200) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = "block";
  requestAnimationFrame(() => (t.style.opacity = "1"));

  clearTimeout(t._tm);
  t._tm = setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => (t.style.display = "none"), 250);
  }, ms);
}

// ================= ⭐ helpers para cambiar versión ==============================
function getCampoTextoVersion() {
  return versionActual === "NTV" ? "NTV" : "RV1960";
}

function getTextoVersiculo(v) {
  if (!v) return "";
  return v[getCampoTextoVersion()] || "";
}

function actualizarTituloBiblia() {
  if (!titulo) return;

  const htmlNuevo = `
    <span class="titulo-libro-cap">${libroSel.value} ${capSel.value}</span>
    <span class="versiones-inline">
      <button type="button"
        onclick="event.stopPropagation(); cambiarVersionBiblia('RV1960')"
        class="btn-version-inline ${versionActual === "RV1960" ? "activo" : ""}">
        RV1960
      </button>

      <button type="button"
        onclick="event.stopPropagation(); cambiarVersionBiblia('NTV')"
        class="btn-version-inline ${versionActual === "NTV" ? "activo" : ""}">
        NTV
      </button>
    </span>
  `;

  if (titulo.innerHTML !== htmlNuevo) {
    titulo.innerHTML = htmlNuevo;
  }
}

// ================= ⭐ ANCLA EXACTA AL CAMBIAR VERSION =================
function obtenerAnclaScrollBiblia() {
  const barra = document.getElementById("barraTituloBiblia");
  const barraH = barra ? barra.offsetHeight : 0;

  // punto de referencia: apenas debajo de la barra sticky
  const yReferencia = barraH + 8;

  const versos = Array.from(document.querySelectorAll("#texto .versiculo"));

  let elegido = null;

  for (const el of versos) {
    const rect = el.getBoundingClientRect();

    // primer versículo que toca o pasa el punto visible
    if (rect.bottom >= yReferencia) {
      elegido = el;
      break;
    }
  }

  if (!elegido) {
    elegido = versos[0] || null;
  }

  if (!elegido) {
    return {
      id: null,
      offset: 0,
      scroll: window.scrollY || document.documentElement.scrollTop || 0
    };
  }

  const rect = elegido.getBoundingClientRect();

  return {
    id: elegido.dataset.id || null,
    offset: rect.top - yReferencia,
    scroll: window.scrollY || document.documentElement.scrollTop || 0
  };
}

function restaurarAnclaScrollBiblia(ancla) {
  if (!ancla) return;

  const barra = document.getElementById("barraTituloBiblia");
  const barraH = barra ? barra.offsetHeight : 0;
  const yReferencia = barraH + 8;

  if (!ancla.id) {
    window.scrollTo({
      top: ancla.scroll || 0,
      behavior: "auto"
    });
    return;
  }

  const el = document.querySelector(`#texto .versiculo[data-id="${CSS.escape(ancla.id)}"]`);

  if (!el) {
    window.scrollTo({
      top: ancla.scroll || 0,
      behavior: "auto"
    });
    return;
  }

  const rect = el.getBoundingClientRect();

  const destino =
    (window.scrollY || document.documentElement.scrollTop || 0) +
    rect.top -
    yReferencia -
    (ancla.offset || 0);

  window.scrollTo({
    top: Math.max(0, destino),
    behavior: "auto"
  });
}

window.cambiarVersionBiblia = function(version) {
  if (version !== "RV1960" && version !== "NTV") return;
  if (versionActual === version) return;

  // ✅ guardamos exactamente el versículo que se está viendo
  const ancla = obtenerAnclaScrollBiblia();

  const libroActual = libroSel?.value || "";
  const capituloActual = Number(capSel?.value || 1);

  // ✅ evitamos que el navegador acomode el scroll solo
  const html = document.documentElement;
  const body = document.body;

  const oldHtmlOverflowAnchor = html.style.overflowAnchor;
  const oldBodyOverflowAnchor = body.style.overflowAnchor;
  const oldHtmlScrollBehavior = html.style.scrollBehavior;
  const oldBodyScrollBehavior = body.style.scrollBehavior;

  html.style.overflowAnchor = "none";
  body.style.overflowAnchor = "none";
  html.style.scrollBehavior = "auto";
  body.style.scrollBehavior = "auto";

  // ✅ cambiamos versión
  versionActual = version;
  bibliaData = (version === "NTV") ? bibliaDataNTV : bibliaDataRV;

  // ✅ actualizamos el título/botones RV1960 - NTV
  actualizarTituloBiblia();

  // ✅ NO usamos cargarCapitulos()
  // ✅ NO usamos mostrarTexto()
  // Solo cambiamos el texto de los versículos ya pintados.
  const versosNuevoCapitulo = bibliaData.filter(v =>
    v.Libro === libroActual &&
    Number(v.Capitulo) === capituloActual
  );

  const porNumero = new Map(
    versosNuevoCapitulo.map(v => [Number(v.Versiculo), v])
  );

  document.querySelectorAll("#texto .versiculo").forEach(div => {
    const numEl = div.querySelector(".num");
    const txtEl = div.querySelector(".txt");

    if (!numEl || !txtEl) return;

    const numero = Number(numEl.textContent.trim());
    const versoNuevo = porNumero.get(numero);

    if (!versoNuevo) return;

    txtEl.textContent = getTextoVersiculo(versoNuevo);
  });

  // ✅ restauramos el mismo versículo en la misma posición
  restaurarAnclaScrollBiblia(ancla);

  requestAnimationFrame(() => {
    restaurarAnclaScrollBiblia(ancla);

    setTimeout(() => {
      restaurarAnclaScrollBiblia(ancla);
      guardarEstadoBiblia();

      html.style.overflowAnchor = oldHtmlOverflowAnchor;
      body.style.overflowAnchor = oldBodyOverflowAnchor;
      html.style.scrollBehavior = oldHtmlScrollBehavior;
      body.style.scrollBehavior = oldBodyScrollBehavior;
    }, 0);
  });

  // ✅ si está en modo imagen, mantener preview y selección
  if (modoImagen) {
    userSetFontSize = false;

    requestAnimationFrame(() => {
      actualizarPreview();
    });
  }

  // ✅ si está en modo marcador, mantener selección y botón guardar
  if (modoMarcador) {
    requestAnimationFrame(() => {
      refrescarBotonGuardarMarcador?.();
      renderPreviewVersiculosMarcador?.();
    });
  }
};

// ================= ⭐ SUGERIR TAMAÑO QUE ENTRE (solo sugerencia) =================
function sugerirFontSizeQueEntre(wrapper, elFront, elBack, maxPx = 64, minPx = 10, step = 0.5) {
  if (!wrapper || !elFront || !elBack) return 32;

  // medir "zona útil" (restando padding del wrapper)
  const cs = getComputedStyle(wrapper);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);

  const maxW = Math.max(10, wrapper.clientWidth - padX);
  const maxH = Math.max(10, wrapper.clientHeight - padY);

  // helper: aplica tamaño y revisa si entra
  const entra = (px) => {
    elFront.style.fontSize = px + "px";
    elBack.style.fontSize  = px + "px";

    // OJO: usamos scrollHeight/Width para detectar desborde real
    const okH = elFront.scrollHeight <= maxH && elBack.scrollHeight <= maxH;
    const okW = elFront.scrollWidth  <= maxW && elBack.scrollWidth  <= maxW;
    return okH && okW;
  };

  // si ni el mínimo entra, devolvemos min (igual será sugerencia)
  if (!entra(minPx)) return minPx;

  // Búsqueda binaria en pasos de 0.5px (máximo tamaño que entra)
  let lo = minPx;
  let hi = maxPx;

  while ((hi - lo) > step) {
    const mid = Math.floor(((lo + hi) / 2) / step) * step; // redondeo a step
    if (entra(mid)) lo = mid;
    else hi = mid - step;
  }

  return Number(lo.toFixed(1));
}

// ========================= 🎨 RESALTADOR COMPACTO  =======================================
function initResaltadorCompacto() {
  const btnActivo = document.getElementById("btnResaltadorActivo");
  const paleta = document.getElementById("paletaResaltadores");
  const cont = document.getElementById("resaltadorCompacto");
  const btnBloquear = document.getElementById("btnBloquearResaltador");
  const btnEditar = document.getElementById("btnEditarPaleta");
  const wrapColores = document.getElementById("paletaColoresWrap");

  if (!btnActivo || !paleta || !cont || !btnBloquear || !btnEditar || !wrapColores) {
    console.warn("❌ Resaltador no inicializado");
    return;
  }

  paleta.style.display = "none";

function pedirLoginResaltador() {
  if (
    typeof window.abrirLoginParaGuardarMiPanel === "function"
  ) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }

  window.vaIniciarSesionGoogle();
}

  function renderBotonActivo() {
    const conf = obtenerConfigResaltadorActual();

    btnActivo.innerHTML = "";
    btnActivo.style.background = "";
    btnActivo.appendChild(crearNodoFormaResaltador(conf.color, conf.forma));
  }

  function renderPaletaColores() {
    wrapColores.innerHTML = "";

    resaltadoresConfig.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-color-marker";
      btn.dataset.color = item.color;
      btn.dataset.index = i;

      if (item.color === colorActual) {
        btn.classList.add("activo");
      }

      btn.appendChild(crearNodoFormaResaltador(item.color, item.forma));

      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!uid) {
          pedirLoginResaltador();
          return;
        }

        colorActual = item.color;
        window.colorActual = colorActual;

        resaltadorBloqueado = false;
        window.resaltadorBloqueado = resaltadorBloqueado;

        renderBotonActivo();
        renderPaletaColores();
        actualizarUICandadoResaltador();

        paleta.style.display = "none";
      };

      wrapColores.appendChild(btn);
    });
  }

  btnActivo.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!uid) {
      pedirLoginResaltador();
      return;
    }

    const visible = paleta.style.display === "grid";
    paleta.style.display = visible ? "none" : "grid";

    cont.classList.remove("mover-derecha");

    if (!visible) {
      const rect = paleta.getBoundingClientRect();
      if (rect.top < 10) cont.classList.add("mover-derecha");
    }
  };

  btnBloquear.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!uid) {
      pedirLoginResaltador();
      return;
    }

    resaltadorBloqueado = !resaltadorBloqueado;
    window.resaltadorBloqueado = resaltadorBloqueado;

    actualizarUICandadoResaltador();
  };

  btnEditar.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!uid) {
      pedirLoginResaltador();
      return;
    }

    abrirModalEditarPaletaResaltador();
  };

  document.addEventListener("click", (e) => {
    if (!cont.contains(e.target)) {
      paleta.style.display = "none";
    }
  });

  renderBotonActivo();
  renderPaletaColores();
  actualizarUICandadoResaltador();
}

// ================= ⭐ BLOQUEO DE RESALTADOR =======================
function actualizarUICandadoResaltador() {
  const wrapColores = document.getElementById("paletaColoresWrap");
  const btnBloquear = document.getElementById("btnBloquearResaltador");
  if (!wrapColores || !btnBloquear) return;

  const locked = !!window.resaltadorBloqueado;
  const curColor = (window.colorActual || "#fff3b0") + "";

  btnBloquear.textContent = locked ? "🔒" : "🔓";

  wrapColores.querySelectorAll(".icono-candado").forEach(c => c.remove());

  if (locked) {
    const botonColor = Array.from(wrapColores.querySelectorAll(".btn-color-marker"))
      .find(b => ((b.dataset.color || "") + "") === curColor);

    const target = botonColor || wrapColores.querySelector(".btn-color-marker");
    if (target) {
      const span = document.createElement("span");
      span.textContent = "🔒";
      span.className = "icono-candado";
      target.appendChild(span);
    }
  }
}

// ================= 🧩 MODAL EDITAR PALETA RESALTADOR =================
function abrirModalEditarPaletaResaltador() {
  const modal = document.getElementById("modalEditarPaletaResaltador");
  const lista = document.getElementById("listaEditarPaletaResaltador");
  if (!modal || !lista) return;

  lista.innerHTML = "";

  resaltadoresConfig.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "row-editar-paleta";

row.innerHTML = `
  <div><b>${i + 1}</b></div>
  <input id="resaltadorColor_${i}" type="hidden" value="${item.color}" data-index="${i}" class="input-color-paleta">
  <button type="button" class="pickr-host pickr-host--full" data-target="#resaltadorColor_${i}" aria-label="Color resaltador ${i + 1}"></button>
  <select data-index="${i}" class="select-forma-paleta">
    <option value="circle" ${item.forma === "circle" ? "selected" : ""}>Círculo</option>
    <option value="heart" ${item.forma === "heart" ? "selected" : ""}>Corazón</option>
  </select>
`;

    lista.appendChild(row);
  });

  modal.style.display = "flex";

setTimeout(() => {
  initPickrEnHosts("#listaEditarPaletaResaltador .pickr-host");
}, 0);
}

function cerrarModalEditarPaletaResaltador() {
  const modal = document.getElementById("modalEditarPaletaResaltador");
  if (!modal) return;
  modal.style.display = "none";
}


function destruirPickrsActivos() {
  try {
    pickrInstances.forEach(p => {
      try { p.destroyAndRemove(); } catch(e){}
    });
  } catch(e){}
  pickrInstances = [];
}

let pickrInstances = [];

function initPickrEnHosts(selector = ".pickr-host") {
  if (typeof Pickr === "undefined") {
    console.warn("Pickr no está cargado");
    return;
  }

  const hosts = document.querySelectorAll(selector);

  hosts.forEach(host => {
    if (host.dataset.pickrReady === "1") return;

    const targetSel = host.dataset.target;
    if (!targetSel) return;

    const input = document.querySelector(targetSel);
    if (!input) return;

    const setColorVisual = (hex) => {
      const color = hex || "#ffffff";
      host.style.setProperty("--pickr-color", color);
      host.style.background = color;
    };

    const pickr = Pickr.create({
      el: host,
      theme: "classic",
      default: input.value || "#ffffff",
      comparison: true,
      useAsButton: true,
      position: "top-middle",

      components: {
        preview: true,
        opacity: false,
        hue: true,
        interaction: {
          save: true,
          cancel: true,
          clear: false
        }
      },

      i18n: {
        "ui:dialog": "Selector de color",
        "btn:toggle": "Abrir selector",
        "btn:swatch": "Muestras",
        "btn:last-color": "Color anterior",
        "btn:save": "Guardar",
        "btn:cancel": "Cancelar",
        "btn:clear": "Limpiar",
        "aria:btn:save": "Guardar color",
        "aria:btn:cancel": "Cancelar",
        "aria:input": "Campo de color",
        "aria:palette": "Paleta de color",
        "aria:hue": "Tono",
        "aria:opacity": "Opacidad"
      }
    });
host._pickr = pickr;
    
    // color inicial visible en el botón
    setColorVisual(input.value || "#ffffff");

    pickr.on("show", () => {
      setColorVisual(input.value || "#ffffff");
    });

    pickr.on("save", (color) => {
      const hex = color ? color.toHEXA().toString() : "#ffffff";
      input.value = hex;
      setColorVisual(hex);

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));

      pickr.hide();
    });

    pickr.on("cancel", () => {
      // vuelve al último valor guardado y cierra
      setColorVisual(input.value || "#ffffff");
      pickr.hide();
    });

    host.dataset.pickrReady = "1";
    pickrInstances.push(pickr);
  });
}

window.initPickrEnHosts = initPickrEnHosts;
window.destruirPickrsActivos = destruirPickrsActivos;

async function guardarModalEditarPaletaResaltador() {
  const colors = document.querySelectorAll(".input-color-paleta");
  const formas = document.querySelectorAll(".select-forma-paleta");

  resaltadoresConfig = resaltadoresConfig.map((item, i) => ({
    color: colors[i]?.value || item.color,
    forma: formas[i]?.value === "heart" ? "heart" : "circle"
  }));

  guardarResaltadoresConfigLocal();
  await guardarResaltadoresConfigFirebase();

  if (!resaltadoresConfig.some(x => x.color === colorActual)) {
    colorActual = resaltadoresConfig[0]?.color || "#fff3b0";
    window.colorActual = colorActual;
  }

  initResaltadorCompacto();
  cerrarModalEditarPaletaResaltador();
}

async function resetearPaletaResaltador() {
  resaltadoresConfig = JSON.parse(JSON.stringify(DEFAULT_RESALTADORES));
  guardarResaltadoresConfigLocal();
  await guardarResaltadoresConfigFirebase();

  colorActual = resaltadoresConfig[1]?.color || "#fff3b0";
  window.colorActual = colorActual;

  initResaltadorCompacto();
  abrirModalEditarPaletaResaltador();
}

// ================= ⭐ FUERZA CANDADO PEQUEÑO =======================
window.forceSyncResaltadorUI = function forceSyncResaltadorUI(intentos = 20) {
  const tick = () => {
    try { actualizarUICandadoResaltador?.(); } catch (e) {}

    const wrapColores = document.getElementById("paletaColoresWrap");
    const ok = wrapColores && wrapColores.querySelector("span.icono-candado");

    if (ok) return;
    if (intentos <= 0) return;

    requestAnimationFrame(() => {
      window.forceSyncResaltadorUI(intentos - 1);
    });
  };

  requestAnimationFrame(tick);
};

// ================= ⭐ MOSTRAR TEXTO =======================
function mostrarTexto(opts = {}) {
  const {
    irArriba = false,
    guardar = true
  } = opts;

  texto.innerHTML = "";
  actualizarTituloBiblia();

 const libroActual = libroSel.value;
const capituloActual = Number(capSel.value);

const versos = bibliaData.filter(v =>
  v.Libro === libroActual &&
  Number(v.Capitulo) === capituloActual
);

  versos.forEach(v => pintarVersiculo(v));

  if (irArriba) {
    requestAnimationFrame(() => {
      irArribaBiblia();
    });
  }

  if (guardar) {
    guardarEstadoBiblia();
  }
}

// ================= ⭐ TOGGLE VERSICULO =======================
function toggleVersiculo(id, num) {

  // 📌 MODO MARCADOR (seleccionar versículos para guardar)
  if (modoMarcador) {
    if (!uid) {
      window.abrirLoginParaGuardarMiPanel();
      return;
    }

marcarMarcadorEnOrden(id);

    mostrarTexto();
    refrescarBotonGuardarMarcador();
    renderPreviewVersiculosMarcador();
    return;
  }

  // 🖼️ MODO IMAGEN
  if (modoImagen) {
    if (!uid) {
      window.abrirLoginParaGuardarMiPanel();
      return;
    }

marcarImagenEnOrden(id);

        mostrarTexto({ guardar: false });
    userSetFontSize = false; // ✅ cambió el texto => volver a AUTO

    requestAnimationFrame(() => {
      actualizarPreview();
    });

    return;
  }

  // 🔐 requiere login
  if (!uid) return;

  // 🔒 resaltador bloqueado
  if (resaltadorBloqueado) return;

  // 🎨 marcar / desmarcar versículo
  const r = ref(db, "marcados/" + uid + "/" + id);

  if (marcados[id]) {
    remove(r);
  } else {
    set(r, { color: colorActual });
  }
}

// ======================= ⭐ Obtener Marcador Keep Para Versiculo  ====
function obtenerMarcadorKeepParaVersiculo(libro, capitulo, versiculo) {
  const items = Object.values(marcadores || {});

  for (const m of items) {
    if (m?.origen === "abc") continue;
    if (!m?.keep) continue;

    if (marcadorContieneVersiculo(m, libro, capitulo, versiculo)) {
      return m;
    }
  }

  return null;
}

// ======================= ⭐ PINTAR VERSICULO  ====
function pintarVersiculo(v) {
  const id = `${v.Libro}_${v.Capitulo}_${v.Versiculo}`;
  const marcado = marcados[id];
  const imagen = modoImagen && seleccionImagen[id];
  const selMarcador = modoMarcador && seleccionMarcador[id];

  const marcadorKeepDelVersiculo = obtenerMarcadorKeepParaVersiculo(v.Libro, v.Capitulo, v.Versiculo);

const coincideUltimoMarcador = (
  !!ultimoMarcadorAplicado &&
  marcadorContieneVersiculo(
    ultimoMarcadorAplicado,
    v.Libro,
    v.Capitulo,
    v.Versiculo
  )
);

const aplicado = coincideUltimoMarcador || !!marcadorKeepDelVersiculo;

const colorAplicadoKeep = coincideUltimoMarcador
  ? (ultimoMarcadorAplicado?.color || null)
  : (marcadorKeepDelVersiculo?.color || null);

  const div = document.createElement("div");
  div.className = "versiculo";
  div.dataset.id = id;
  if (imagen) div.classList.add("imagen");

  const enOscuro = document.body.classList.contains("oscuro");

  // ================= Tamaño Letra =================
  div.style.fontSize = size + "px";

  // ================= Fondo =================
  if (modoImagen) {
    div.style.background = imagen ? "rgba(255, 214, 232, 0.6)" : "transparent";

  } else if (modoMarcador) {
    if (selMarcador) {
      div.style.background = enOscuro
        ? "rgba(209, 238, 255, 0.92)"
        : "rgba(209, 238, 255, 0.92)";
    } else if (aplicado && colorAplicadoKeep) {
      div.style.background = colorAplicadoKeep;
    } else {
      div.style.background = "transparent";
    }

  } else {
    if (aplicado && colorAplicadoKeep) {
      div.style.background = colorAplicadoKeep;
    } else {
      div.style.background = marcado?.color || "transparent";
    }
  }

  if (selMarcador) div.style.border = "2px solid #4f6fa8";
  else div.style.border = "none";

  // ================= Color de Texto =================
  if (modoImagen) {
    div.style.color = imagen ? "#000000" : (enOscuro ? "#ffffff" : "#000000");
  } else {
    if (modoMarcador && selMarcador) {
      div.style.color = "#000000";
    } else {
      let fondo = null;

      if (modoMarcador) {
        if (aplicado && colorAplicadoKeep) fondo = colorAplicadoKeep;
      } else {
        if (aplicado && colorAplicadoKeep) fondo = colorAplicadoKeep;
        else if (marcado?.color) fondo = marcado.color;
      }

      if (fondo) div.style.color = colorContraste(fondo);
      else div.style.color = enOscuro ? "#ffffff" : "#000000";
    }
  }

  // ================= Opacidad =================
  if (modoImagen && !imagen) {
    div.style.opacity = "0.6";
  } else {
    div.style.opacity = "1";
  }

  // ================= Contenido =================
  const idMarcadorPluma = (window.notasBibliaPluma || {})[id] || null;

  div.innerHTML = `
    <span class="num">${v.Versiculo}</span>
    <span class="txt">${getTextoVersiculo(v)}</span>
    ${idMarcadorPluma ? `<i class="fa-solid fa-comment-dots icono-nota" aria-hidden="true" data-mid="${idMarcadorPluma}"></i>` : ``}
  `;

// ✅ dejar color bíblico temático SOLO cuando NO hay resaltado
const hayFondoResaltado =
  !!imagen ||
  !!selMarcador ||
  !!(aplicado && colorAplicadoKeep) ||
  !!(marcado?.color);

div.classList.toggle("versiculo-con-fondo-resaltado", hayFondoResaltado);

  // ================= Click =================
  div.onclick = () => toggleVersiculo(id, v.Versiculo);

  const pluma = div.querySelector(".icono-nota[data-mid]");
  if (pluma) {
    pluma.style.cursor = "pointer";
    pluma.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const mid = pluma.getAttribute("data-mid");
      if (!mid) return;

      if (typeof window.abrirMarcadores === "function") {
        window.abrirMarcadores();
      }

      setTimeout(() => {
        if (typeof window.editarMarcadorDesdeLista === "function") {
          window.editarMarcadorDesdeLista(mid);
          return;
        }
        if (typeof window.editarMarcadorEnPanel === "function") {
          window.editarMarcadorEnPanel(mid);
          return;
        }
      }, 0);
    };
  }

  texto.appendChild(div);
}

// ================= ⭐ OBTIENE VERSICULO SELECCIONADO (FIX MULTI CAP) =======================
function obtenerVersiculoSeleccionado() {
  const items = getItemsImagenEnOrden();

  if (!items.length) return "";

  const textos = [];

  for (const it of items) {
    const vers = bibliaData.find(x =>
      x.Libro === it.Libro &&
      Number(x.Capitulo) === it.Capitulo &&
      Number(x.Versiculo) === it.Versiculo
    );

    const txt = getTextoVersiculo(vers);
    if (txt) textos.push(txt);
  }

  const referencia = referenciaImagenEnOrden(items);

  return (textos.join(" ") + "\n\n▪ " + referencia).trim();
}

// ================= ⭐ texto libre  =======================
function obtenerTextoParaPreview() {
  if (modoImagenLibre) {
    return (textoLibreImagen || "").trim();
  }
  return obtenerVersiculoSeleccionado();
}

function asegurarCajaTextoLibrePanel() {
  // ✅ Ya no usamos el bloque feo de arriba.
  // Si quedó de una versión anterior, lo sacamos.
  const box = document.getElementById("boxTextoLibrePanel");
  if (box) box.remove();
}

function textoLibreHtmlSeguro(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function activarEdicionDirectaTextoLibre() {
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");
  const colorEl = document.getElementById("personalizarColor");

  if (!previewTexto || !previewTextoBack || !wrapper) return;

  // ✅ Si no estamos en modo imagen libre, limpiar edición directa
  if (!modoImagenLibre) {
    previewTexto.removeAttribute("contenteditable");
    previewTexto.removeAttribute("spellcheck");
    previewTexto.removeAttribute("role");
    previewTexto.style.cursor = "";
    previewTexto.style.outline = "";
    previewTexto.style.caretColor = "";
    wrapper.style.cursor = "";
    return;
  }

  previewTexto.setAttribute("contenteditable", "true");
  previewTexto.setAttribute("spellcheck", "false");
  previewTexto.setAttribute("role", "textbox");
  previewTexto.setAttribute("aria-label", "Escribí tu texto sobre la imagen");

  previewTexto.style.cursor = "text";
  previewTexto.style.outline = "none";
  previewTexto.style.caretColor = colorEl ? colorEl.value : "#000000";
  previewTexto.style.whiteSpace = "pre-wrap";

  previewTextoBack.style.pointerEvents = "none";
  wrapper.style.cursor = "text";

  if (!previewTexto.dataset.libreReady) {
    previewTexto.addEventListener("input", () => {
      textoLibreImagen = (previewTexto.innerText || "").replace(/\r/g, "");

      previewTextoBack.innerHTML = `
        <div class="preview-text-inner">${textoLibreHtmlSeguro(textoLibreImagen)}</div>
      `;

      const innerBack = previewTextoBack.querySelector(".preview-text-inner");
      if (innerBack) {
        innerBack.style.width = "100%";
        innerBack.style.margin = "0";
      }

      invalidarRenderFinal();
    });

    previewTexto.dataset.libreReady = "1";
  }

  if (!wrapper.dataset.libreClickReady) {
    wrapper.addEventListener("click", () => {
      if (modoImagenLibre) previewTexto.focus();
    });
    wrapper.dataset.libreClickReady = "1";
  }
}

// ================= ⭐ FORMATEA: JUAN 1:5-10  =======================
function formatearVersiculosComoRango(numeros) {
  if (numeros.length === 0) return "";

  numeros.sort((a, b) => a - b);

  const partes = [];
  let inicio = numeros[0];
  let anterior = numeros[0];

  for (let i = 1; i < numeros.length; i++) {
    if (numeros[i] === anterior + 1) {
      anterior = numeros[i];
    } else {
      partes.push(
        inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
      );
      inicio = numeros[i];
      anterior = numeros[i];
    }
  }

  partes.push(
    inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`
  );

  return partes.join(",");
}
// ================= ⭐ COLOR CONTRASTE  =======================

function colorContraste(hex) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 160 ? "#000000" : "#ffffff";
}

// ================= ⭐ COLOR OUTLINE (PURO BLANCO/NEGRO) =======================
function colorOutlineDesdeBase(color) {
  if (!color) return "#000000";

  // rgb() → hex
  if (color.startsWith("rgb")) {
    const nums = color.match(/\d+/g).map(Number);
    color = "#" + nums.map(x => x.toString(16).padStart(2, "0")).join("");
  }

  // por si viene #abc (raro, pero por las dudas)
  if (color.length === 4) {
    color =
      "#" +
      color[1] + color[1] +
      color[2] + color[2] +
      color[3] + color[3];
  }

  // luminancia simple
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;

  // ✅ si el texto base es claro -> outline NEGRO
  // ✅ si el texto base es oscuro -> outline BLANCO
  return lum > 160 ? "#000000" : "#ffffff";
}

function textShadowLegibleBiblia(textHex, scale = 1, outlineHex = null){
  const oc =
    bibliaHexSeguro(outlineHex) ||
    colorOutlineDesdeBase(textHex || "#000000");

  const s = Math.max(0.12, Number(scale) || 1);
  const px = (n) => `${(n * s).toFixed(2)}px`;

  return `
    -${px(2.2)} 0 ${oc},
     ${px(2.2)} 0 ${oc},
     0 -${px(2.2)} ${oc},
     0  ${px(2.2)} ${oc},
    -${px(1.6)} -${px(1.6)} ${oc},
     ${px(1.6)} -${px(1.6)} ${oc},
    -${px(1.6)}  ${px(1.6)} ${oc},
     ${px(1.6)}  ${px(1.6)} ${oc},
     0 0 ${px(3.2)} ${oc}
  `;
}

// ================= 🎀 FUENTES  =======================
// 🔗 Listeners de personalización (✅ se enganchan cuando el DOM ya existe)
function initPersonalizarListeners() {
  ["personalizarOpacidad", "personalizarTamaño", "personalizarColor", "colorOpacidadBiblia"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn("⚠️ No existe:", id);
      return;
    }

    const handler = () => {
      if (id === "personalizarTamaño") userSetFontSize = true; // manual si tocan tamaño
      actualizarPreview();
    };

    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  });
}

document.addEventListener("DOMContentLoaded", initPersonalizarListeners);
window.addEventListener("beforeunload", () => {
  vaGuardarSnapshotVisual();
});

window.addEventListener("pagehide", () => {
  vaGuardarSnapshotVisual();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    vaGuardarSnapshotVisual();
  }
});

// Algunos Android/Chrome disparan freeze antes de matar la app.
document.addEventListener("freeze", () => {
  vaGuardarSnapshotVisual();
});

// ================= 🎀 LISTA VISUAL DE FUENTES =================
const fuentesGoogle = [
  // ================= Limpias y muy legibles =================
  { nombre: "Roboto", css: "Roboto, sans-serif" },
  { nombre: "Lexend", css: "Lexend, sans-serif" },
  { nombre: "Montserrat", css: "Montserrat, sans-serif" },
  { nombre: "Poppins", css: "Poppins, sans-serif" },
  { nombre: "Oswald", css: "Oswald, sans-serif" },
  { nombre: "Josefin Sans", css: "'Josefin Sans', sans-serif" },

  // ================= Clásicas / bíblicas =================
  { nombre: "Lora", css: "Lora, serif" },
  { nombre: "Merriweather", css: "Merriweather, serif" },
  { nombre: "Libre Baskerville", css: "'Libre Baskerville', serif" },
  { nombre: "Alegreya", css: "Alegreya, serif" },
  { nombre: "Playfair Display", css: "'Playfair Display', serif" },
  { nombre: "DM Serif Display", css: "'DM Serif Display', serif" },
  { nombre: "Cinzel", css: "Cinzel, serif" },
  { nombre: "Cormorant", css: "Cormorant, serif" },

  // ================= Fuertes para títulos =================
  { nombre: "Bebas Neue", css: "'Bebas Neue', sans-serif" },
  { nombre: "Abril Fatface", css: "'Abril Fatface', serif" },

  // ================= Manuscritas / decorativas =================
  { nombre: "Lobster", css: "Lobster, cursive" },
  { nombre: "Caveat", css: "Caveat, cursive" },
  { nombre: "Dancing Script", css: "'Dancing Script', cursive" },
  { nombre: "Courgette", css: "Courgette, cursive" },
  { nombre: "Great Vibes", css: "'Great Vibes', cursive" },

  // ✅ La dejamos porque en tu celular sí se visualiza bien
  { nombre: "Comic Sans MS", css: "'Comic Sans MS', cursive" }
];

// ================= ⭐ CREAR LISTA VISUAL DE FUENTES  =======================
function crearListaVisualFuentes() {
  const cont = document.getElementById("listaFuentes");
  if (!cont) return;

  cont.innerHTML = "";

  fuentesGoogle.forEach(f => {
    const btn = document.createElement("button");
    btn.textContent = f.nombre;
    btn.style.fontFamily = f.css;

    // marcar la fuente actual como activa
    if (fuenteActual === f.css) btn.classList.add("activo");

    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      fuenteActual = f.css;

      // actualizar activo visual
      cont.querySelectorAll("button").forEach(b => b.classList.remove("activo"));
      btn.classList.add("activo");

      actualizarPreview();

      // ✅ ya NO cerramos al elegir
    };

    cont.appendChild(btn);
  });
}

// ================= 🎀 CERRAR/ABRIR FUENTES + POSICIONAR AL ANCHO DEL MODAL =================
const btnFuentes = document.getElementById("btnFuentes");
const listaFuentes = document.getElementById("listaFuentes");

// ✅ PC: rueda vertical => scroll horizontal en lista de fuentes
if (listaFuentes) {
  listaFuentes.addEventListener("wheel", (e) => {
    // solo cuando la lista está abierta
    if (!listaFuentes.classList.contains("abierto")) return;

    // si el usuario ya tiene shift, dejamos el comportamiento normal
    if (e.shiftKey) return;

    e.preventDefault();
    listaFuentes.scrollLeft += e.deltaY;
  }, { passive: false });
}

// ================= ⭐ Posicionar Lista Fuentes =================
function posicionarListaFuentes() {
const modalBox = document.querySelector("#modalPersonalizar .modal-contenido");
  if (!modalBox || !btnFuentes || !listaFuentes) return;

  const rModal = modalBox.getBoundingClientRect();
  const rBtn = btnFuentes.getBoundingClientRect();

  // ancho exacto del modal (con padding interno)
  const padding = 12;
  const left = rModal.left + padding;
  const width = rModal.width - padding * 2;

  listaFuentes.style.left = left + "px";
  listaFuentes.style.width = width + "px";

  // debajo del botón
  listaFuentes.style.top = (rBtn.bottom + 8) + "px";
}

if (btnFuentes && listaFuentes) {
  btnFuentes.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    const abierto = listaFuentes.classList.toggle("abierto");
    btnFuentes.classList.toggle("activo", abierto);

    if (abierto) {
      posicionarListaFuentes();
    }
  });

  window.addEventListener("resize", () => {
    if (listaFuentes.classList.contains("abierto")) posicionarListaFuentes();
  });

  window.addEventListener("scroll", () => {
    if (listaFuentes.classList.contains("abierto")) posicionarListaFuentes();
  }, true);

  document.addEventListener("click", e => {
    if (!listaFuentes.contains(e.target) && e.target !== btnFuentes) {
      listaFuentes.classList.remove("abierto");
      btnFuentes.classList.remove("activo");
    }
  });
}

// ================= ☁️ R2 HELPERS (COPIADO DE DEVOCIONALES) =================
async function blobToBase64(blob){
  return await new Promise((resolve,reject)=>{
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = ()=>{
      const s = String(rd.result || "");
      resolve(s.split(",")[1] || "");
    };
    rd.readAsDataURL(blob);
  });
}

async function subirImagenAR2DesdeWeb(fileBase64, fileName, contentType = "image/png"){
  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName,
      contentType,
      folder: "biblia"
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir imagen a R2");
  }

  return data;
}

// ================= 🌄 FONDOS ⛺================================
const fondosCategorias = {
  paisajes: [
     "./img/fondos/Paisajes/1a.jpg",
      "./img/fondos/Paisajes/2a.jpg",
      "./img/fondos/Paisajes/3a.jpg",
      "./img/fondos/Paisajes/4a.jfif",
      "./img/fondos/Paisajes/5a.jfif",
      "./img/fondos/Paisajes/6a.jfif",
      "./img/fondos/Paisajes/7a.jfif",
      "./img/fondos/Paisajes/8a.jfif",
      "./img/fondos/Paisajes/9a.jfif",
      "./img/fondos/Paisajes/10a.jfif",
      "./img/fondos/Paisajes/11a.jfif",
      "./img/fondos/Paisajes/12a.jfif",
      "./img/fondos/Paisajes/13a.jfif",     
     "./img/fondos/Paisajes/1.jpeg",
      "./img/fondos/Paisajes/2.jpeg",
      "./img/fondos/Paisajes/3.jpeg",
      "./img/fondos/Paisajes/4.jpeg",
      "./img/fondos/Paisajes/5.jpeg",
      "./img/fondos/Paisajes/6.jpeg",
      "./img/fondos/Paisajes/7.jpeg",
      "./img/fondos/Paisajes/8.jpeg",
      "./img/fondos/Paisajes/9.jpeg",
      "./img/fondos/Paisajes/10.jpeg",
      "./img/fondos/Paisajes/11.jpeg",
      "./img/fondos/Paisajes/12.jpeg",
      "./img/fondos/Paisajes/13.jpeg",
    "./img/fondos/Paisajes/Untitled_Project_10_scjlfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_11_z3nudj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_12_crdynt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_13_dzxm4k.jpg",
    "./img/fondos/Paisajes/Untitled_Project_14_iww2jx.jpg",
    "./img/fondos/Paisajes/Untitled_Project_15_iu1uxj.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_cg9dfu.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_jwctxg.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_q3uzog.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_qttkkt.jpg",
    "./img/fondos/Paisajes/Untitled_Project_1_z6ol0o.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_a1wlsh.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_ehfqna.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_hi9hhz.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_twzefr.jpg",
    "./img/fondos/Paisajes/Untitled_Project_2_wzlhio.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_jhrx0j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_qfbqel.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_thrkka_b1ibx2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_tjsq2f.jpg",
    "./img/fondos/Paisajes/Untitled_Project_3_zw4kl2.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_brmypi.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_ftamyb.jpg",
    "./img/fondos/Paisajes/Untitled_Project_5_htsxrq.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_ghg8ux.jpg",
    "./img/fondos/Paisajes/Untitled_Project_6_kpgvmm.jpg",
    "./img/fondos/Paisajes/Untitled_Project_7_qpfbuy.jpg",
    "./img/fondos/Paisajes/Untitled_Project_8_ivok7j.jpg",
    "./img/fondos/Paisajes/Untitled_Project_c2feyb_juy9d6.jpg",
    "./img/fondos/Paisajes/Untitled_Project_ycpnpv.jpg",
    "./img/fondos/Paisajes/amanecer1600x1600_igddhh.jpg",
    "./img/fondos/Paisajes/amanecerpiedras_zb18j1.jpg",
    "./img/fondos/Paisajes/arbustos_pwdcsk.jpg",
    "./img/fondos/Paisajes/arcadafloresrosas_fc4aj4.jpg",
    "./img/fondos/Paisajes/arcoflores_lnrfa9.jpg",
    "./img/fondos/Paisajes/bebedero_ystc1u.jpg",
    "./img/fondos/Paisajes/boda_nmzaub.jpg",
    "./img/fondos/Paisajes/camino_madnav.jpg",
    "./img/fondos/Paisajes/casitalejosarboles_by72rz_upjpn4.jpg",
    "./img/fondos/Paisajes/cielocelesterosaarboles_y4t720.jpg",
    "./img/fondos/Paisajes/cielovioleta_us3ilw.jpg",
    "./img/fondos/Paisajes/faro2_s5ynwu.jpg",
    "./img/fondos/Paisajes/faro_aginuk.jpg",
    "./img/fondos/Paisajes/floresamarillas_mhosyy.jpg",
    "./img/fondos/Paisajes/floresblancasyrosas_ehpvfy.jpg",
    "./img/fondos/Paisajes/floresmontañas_h8qhkd.jpg",
    "./img/fondos/Paisajes/jardinflores_eqxwe5.jpg",
    "./img/fondos/Paisajes/jardinflorescielorosas_qctpa1.jpg",
    "./img/fondos/Paisajes/lagunapastofloresrosas_gibn7c.jpg",
    "./img/fondos/Paisajes/margaritasporton_wnpdps.jpg",
    "./img/fondos/Paisajes/mariposas_mmo86f.jpg",
    "./img/fondos/Paisajes/montaña_c455zz.jpg",
    "./img/fondos/Paisajes/montañagrande_vwag5k.jpg",
    "./img/fondos/Paisajes/olascielo_igbddx.jpg",
    "./img/fondos/Paisajes/otoño2_mwn77p.jpg",
    "./img/fondos/Paisajes/otoño_kdx8u5.jpg",
    "./img/fondos/Paisajes/pastofloresrosas_i0woqq.jpg",
    "./img/fondos/Paisajes/piedrasaguamontañas_lseoki.jpg",
    "./img/fondos/Paisajes/playaarenamarolas_oxkh2z.jpg",
    "./img/fondos/Paisajes/plazaamanecer_nvjtqa.jpg",
    "./img/fondos/Paisajes/puente_gox2gz.jpg",
    "./img/fondos/Paisajes/puenteotoñoagua_r9tskw.jpg",
    "./img/fondos/Paisajes/puertaangostaflores_fvdw8o.jpg",
    "./img/fondos/Paisajes/puertafloresblancas_ouomif.jpg",
    "./img/fondos/Paisajes/puertaflroesvioletas_q4f1bq.jpg"
  ],

  acuarelas: [
"./img/fondos/Acuarelas/1a.png",
"./img/fondos/Acuarelas/2a.png",
     "./img/fondos/Acuarelas/3a.png",
     "./img/fondos/Acuarelas/4a.png",
     "./img/fondos/Acuarelas/5a.png",
     "./img/fondos/Acuarelas/6a.png",
     "./img/fondos/Acuarelas/7a.png",
     "./img/fondos/Acuarelas/8a.png",
     "./img/fondos/Acuarelas/9a.png",
     "./img/fondos/Acuarelas/10a.png",
     "./img/fondos/Acuarelas/11a.png",
     "./img/fondos/Acuarelas/12a.png",
     "./img/fondos/Acuarelas/13a.png",
    "./img/fondos/Acuarelas/Untitled_Project_10_dzbofe_hudn3p.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_10_hgtbrz.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_1_gffwqd.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_2_vdks5w.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_3_crxvum.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_rplu10_avqvn9.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_xubjvd_wyhnzq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_4_yp8i7h_vtja0u.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_ghlggy_ogar08.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_r3cqwb.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_6_wychbo.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_cf7yzv_ujyx6n.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_7_hnxuau_yhk6w7.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_8_h5y32e.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_b3tkxx_jgo6gs.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_9_zhryll.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_l02emm_gtylbq.jpg",
    "./img/fondos/Acuarelas/Untitled_Project_wefjkh.jpg",
    "./img/fondos/Acuarelas/casita_sxlvcf_s5lvth.jpg",
    "./img/fondos/Acuarelas/floresfucsias_f17kul.jpg",
    "./img/fondos/Acuarelas/lilamontañasflores_vayxei_ubvtpm.jpg",
    "./img/fondos/Acuarelas/nubepasto_w0pg1i.jpg",
    "./img/fondos/Acuarelas/rosabotes_bwnvws.jpg"
  ],

  tarjetas: [
 "./img/fondos/Tarjetas/1a.png",
     "./img/fondos/Tarjetas/2a.png",
     "./img/fondos/Tarjetas/3a.png",
     "./img/fondos/Tarjetas/4a.png",
     "./img/fondos/Tarjetas/5a.png",
     "./img/fondos/Tarjetas/6a.png",
     "./img/fondos/Tarjetas/7a.png",
     "./img/fondos/Tarjetas/8a.png",
     "./img/fondos/Tarjetas/9a.png",
     "./img/fondos/Tarjetas/10a.png",
     "./img/fondos/Tarjetas/11a.png",
     "./img/fondos/Tarjetas/12a.png",
     "./img/fondos/Tarjetas/13a.png",
      "./img/fondos/Tarjetas/14a.png",
    "./img/fondos/Tarjetas/Untitled_Project_12_oal95a.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_1_arstzx_inkdoy.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_2_wza5pr_rgvyrz.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_3_xyutfs_wwvy6h.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_fwlgtt.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_4_kwzbbn_iuh5nl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_uxzbsn_f1a2vp.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_5_zey825.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_gunjzi_t9iy0d.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_7_qv09sl.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_8_xzqnli_opyzjn.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_9_uoqpfk_k7v565.jpg",
    "./img/fondos/Tarjetas/Untitled_Project_tgzcpn_u75stk.jpg",
    "./img/fondos/Tarjetas/amarillopajarosnubes_ar0qqg_x9rx4p.jpg",
    "./img/fondos/Tarjetas/cielopastofloresrosas_cyfof2_dbqnq7.jpg",
    "./img/fondos/Tarjetas/cielorosa_pc0puk_b1qrvx.jpg",
    "./img/fondos/Tarjetas/flores_riug8f_whpgds.jpg"
  ]
};

const fondosEtiquetas = {
  paisajes: "Paisajes",
  acuarelas: "Acuarelas",
  tarjetas: "Tarjetas"
};

let fondoCategoriaActual = "paisajes";


/* =========================================================
   RECURSOS COMPARTIDOS CON EDICIONES
   Ediciones.js administra fondos, texturas y adornos.
========================================================= */
window.__VA_FONDOS_BASE_PENDIENTE =
  window.__VA_FONDOS_BASE_PENDIENTE || {};

const bibliaRecursosBaseEdiciones = {
  ...fondosCategorias,

  texturas: BIBLIA_TEXTURAS_DISENO
    .map(item => String(item?.url || "").trim())
    .filter(Boolean),

  adornos: BIBLIA_ADORNOS_DISENO
    .map(item => String(item?.url || "").trim())
    .filter(Boolean)
};

Object.entries(bibliaRecursosBaseEdiciones).forEach(([categoria, urls]) => {
  const actuales = Array.isArray(window.__VA_FONDOS_BASE_PENDIENTE[categoria])
    ? window.__VA_FONDOS_BASE_PENDIENTE[categoria]
    : [];

  window.__VA_FONDOS_BASE_PENDIENTE[categoria] = Array.from(
    new Set([
      ...actuales,
      ...(Array.isArray(urls) ? urls : [])
    ])
  );
});

if (!window.__BIBLIA_FONDOS_EVENTO_ACTIVO) {
  window.__BIBLIA_FONDOS_EVENTO_ACTIVO = true;

  window.addEventListener("va-fondos-actualizados", () => {
    // No recargamos todas las miniaturas ocultas mientras
    // el editor de imagen está cerrado.
    if (!bibliaModalImagenVisible()) return;

    if (document.getElementById("personalizarFondos")) {
      cargarFondos();
    }

    if (document.getElementById("bibliaTexturasCarril")) {
      bibliaRenderTexturasDiseno();
    }

    if (document.getElementById("bibliaAdornosCarril")) {
      bibliaRenderAdornosDiseno();
    }
  });
}

window.vaFondosRegistrarBase?.(bibliaRecursosBaseEdiciones);


// ================= 🛡️ RECURSOS VISUALES SIN CORS =======================
// Los recursos nuevos subidos desde Ediciones quedan alojados en R2.
// Para leerlos desde canvas/html2canvas usamos el Worker como proxy.
function bibliaUrlRecursoSeguro(url, nombre = "recurso.png") {
  const original = String(url || "").trim();
  if (!original) return "";

  if (/^(blob:|data:)/i.test(original)) {
    return original;
  }

  try {
    const absoluta = new URL(original, window.location.href);
    const worker = new URL(R2_DOWNLOAD_URL);

    if (absoluta.origin === window.location.origin) {
      return original;
    }

    if (absoluta.origin === worker.origin) {
      return original;
    }

    worker.searchParams.set("url", absoluta.href);
    worker.searchParams.set("nombre", String(nombre || "recurso.png"));
    worker.searchParams.set("descargar", "0");

    return worker.toString();
  } catch (_) {
    return original;
  }
}

function bibliaModalImagenVisible() {
  const modal = document.getElementById("modalPersonalizar");
  if (!modal) return false;

  const estilo = getComputedStyle(modal);

  return (
    estilo.display !== "none" &&
    estilo.visibility !== "hidden"
  );
}

// ================= ⭐ CARGAR FONDOS (CORS + URL FINAL) =======================
function cargarFondos() {
  const cont = document.getElementById("personalizarFondos");
  if (!cont) return;

  cont.innerHTML = "";

  bibliaAsegurarTabsFondoDiseno();

  // ✅ Paleta antes del menú de tres puntitos
  const paletaBtn = document.createElement("button");
  paletaBtn.type = "button";
  paletaBtn.id = "btnBibliaPaletaFondo";
  paletaBtn.className = "biblia-fondo-palette-btn";
  paletaBtn.innerHTML = `<i class="fa-solid fa-palette"></i>`;
  paletaBtn.title = "Usar fondo plano o degradado";
  paletaBtn.setAttribute("aria-label", "Usar fondo plano o degradado");
  paletaBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    window.bibliaTogglePaletaFondo();
  };
  cont.appendChild(paletaBtn);

  // ✅ Panel color/degradado. Se muestra al tocar paleta y oculta la galería.
  const colorPanel = document.createElement("div");
  colorPanel.id = "bibliaFondoColorPanel";
  colorPanel.innerHTML = `
    <input type="hidden" id="bibliaFondoColor1" value="${fondoDisenoBiblia.color1}" oninput="actualizarFondoDisenoBibliaDesdeUI()">
    <button
      type="button"
      id="bibliaFondoColor1Host"
      class="pickr-host biblia-color-host"
      data-target="#bibliaFondoColor1"
      title="Color de fondo"
      aria-label="Color de fondo"
    ></button>

    <button
      type="button"
      id="btnBibliaColorAdd"
      class="biblia-color-add"
      onclick="bibliaAgregarColorFondo()"
      title="Agregar color"
      aria-label="Agregar color"
    >
      <i class="fa-solid fa-plus"></i>
    </button>

    <span id="bibliaColor2Wrap" class="biblia-color-extra">
      <input type="hidden" id="bibliaFondoColor2" value="${fondoDisenoBiblia.color2}" oninput="actualizarFondoDisenoBibliaDesdeUI()">
      <button
        type="button"
        id="bibliaFondoColor2Host"
        class="pickr-host biblia-color-host"
        data-target="#bibliaFondoColor2"
        title="Segundo color"
        aria-label="Segundo color"
      ></button>
    </span>

    <span id="bibliaColor3Wrap" class="biblia-color-extra">
      <input type="hidden" id="bibliaFondoColor3" value="${fondoDisenoBiblia.color3}" oninput="actualizarFondoDisenoBibliaDesdeUI()">
      <button
        type="button"
        id="bibliaFondoColor3Host"
        class="pickr-host biblia-color-host"
        data-target="#bibliaFondoColor3"
        title="Tercer color"
        aria-label="Tercer color"
      ></button>
    </span>

<select id="bibliaGradienteForma" onchange="actualizarFondoDisenoBibliaDesdeUI()" title="Forma del degradado">
  <option value="vertical">Vertical</option>
  <option value="horizontal">Horizontal</option>
  <option value="diagonal">Diagonal</option>
  <option value="radial">Radial</option>
  <option value="rombo">Rombo suave</option>
  <option value="manchas">Manchas</option>
</select>
  `;
  cont.appendChild(colorPanel);

  const menuWrap = document.createElement("div");
  menuWrap.className = "dev-f1-menu-wrap biblia-galeria-control";

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "dev-f1-menu-btn";
  menuBtn.innerHTML = `<i class="fa-solid fa-ellipsis-vertical"></i>`;
  menuBtn.title = "Elegir galería";

  const menu = document.createElement("div");
  menu.className = "dev-f1-menu";

  Object.keys(fondosCategorias).forEach(cat => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = fondosEtiquetas[cat] || cat;
    b.classList.toggle("activo", cat === fondoCategoriaActual);

    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      fondoCategoriaActual = cat;
      cargarFondos();
    };

    menu.appendChild(b);
  });

menuBtn.onclick = (e) => {
  e.preventDefault();
  e.stopPropagation();

  document.querySelectorAll(".dev-f1-menu.abierto").forEach(m => {
    if (m !== menu) m.classList.remove("abierto");
  });

  menu.style.left = "";
  menu.style.top = "";
  menu.classList.toggle("abierto");
};

  if (!window.__fondosMenuOutsideClickBound) {
    window.__fondosMenuOutsideClickBound = true;

    document.addEventListener("click", (e) => {
      document.querySelectorAll(".dev-f1-menu").forEach(menu => {
        const wrap = menu.closest(".dev-f1-menu-wrap");
        if (menu && wrap && !wrap.contains(e.target)) {
          menu.classList.remove("abierto");
        }
      });
    });
  }

  menuWrap.appendChild(menuBtn);
  menuWrap.appendChild(menu);
  cont.appendChild(menuWrap);

  const fondos = window.vaFondosObtenerLista
    ? window.vaFondosObtenerLista(fondoCategoriaActual)
    : (fondosCategorias[fondoCategoriaActual] || []);

  fondos.forEach(baseUrl => {
    const finalUrl = baseUrl;

    const img = document.createElement("img");
    img.className = "biblia-fondo-img";
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.src = bibliaUrlRecursoSeguro(
      finalUrl,
      "fondo_biblia.png"
    );

    img.onclick = async () => {
      try {
        if (fondoFinalBlobUrl) URL.revokeObjectURL(fondoFinalBlobUrl);

        fondoDisenoBiblia.baseTipo = "imagen";

        fondoFinal = finalUrl;
        fondoFinalBlobUrl = await urlToBlobURL(finalUrl);

        cont.querySelectorAll("img.biblia-fondo-img").forEach(x => x.classList.remove("activo"));
        img.classList.add("activo");

        bibliaSincronizarControlesFondoDiseno();
        actualizarPreview();
      } catch (e) {
        console.error(e);
        fondoFinal = null;
        fondoFinalBlobUrl = null;
        alert("Ese fondo no se puede usar. Probá otro o sin fondo.");
        actualizarPreview();
      }
    };

    cont.appendChild(img);
  });

  setTimeout(() => {
    if (typeof initPickrEnHosts === "function") {
      initPickrEnHosts("#bibliaFondoColor1Host, #bibliaFondoColor2Host, #bibliaFondoColor3Host");
    }

    bibliaSincronizarControlesFondoDiseno();
  }, 0);
}

// ================= ⭐ URLTOBLOBURL =======================
async function urlToBlobURL(url) {
  const urlSegura = bibliaUrlRecursoSeguro(
    url,
    "fondo_biblia.png"
  );

  const res = await fetch(urlSegura, {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Fondo no disponible (HTTP ${res.status})`);
  }

  const blob = await res.blob();

  if (!blob || !blob.size) {
    throw new Error("El fondo se recibió vacío.");
  }

  return URL.createObjectURL(blob);
}

function bibliaRgba(hex, alpha = 1){
  const h = (bibliaHexSeguro(hex) || "#ffffff").replace("#", "");

  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(alpha)));

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function bibliaSvgRomboDifuminadoDataUrl(c1, c2, c3, usar3 = false){
  c1 = bibliaHexSeguro(c1) || "#ffffff";
  c2 = bibliaHexSeguro(c2) || "#d1eeff";
  c3 = usar3 ? (bibliaHexSeguro(c3) || "#a6d0ff") : c2;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" preserveAspectRatio="none">
    <defs>
      <filter id="blurGrande" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="70"/>
      </filter>

      <filter id="blurMedio" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="42"/>
      </filter>

      <linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="52%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c3}" stop-opacity="0.26"/>
      </linearGradient>

      <linearGradient id="romboGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c2}" stop-opacity="0.10"/>
        <stop offset="42%" stop-color="${c2}" stop-opacity="0.72"/>
        <stop offset="64%" stop-color="${c3}" stop-opacity="${usar3 ? "0.62" : "0.32"}"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0.08"/>
      </linearGradient>
    </defs>

    <rect width="1080" height="1080" fill="url(#base)"/>

    <polygon
      points="540,-80 1210,540 540,1160 -130,540"
      fill="${c2}"
      opacity="0.16"
      filter="url(#blurGrande)"
    />

    <polygon
      points="540,70 1010,540 540,1010 70,540"
      fill="url(#romboGrad)"
      opacity="0.82"
      filter="url(#blurMedio)"
    />

    <polygon
      points="540,210 870,540 540,870 210,540"
      fill="${c3}"
      opacity="${usar3 ? "0.30" : "0.14"}"
      filter="url(#blurMedio)"
    />

    <ellipse
      cx="540"
      cy="540"
      rx="250"
      ry="170"
      fill="${c1}"
      opacity="0.18"
      filter="url(#blurGrande)"
    />
  </svg>`;

  return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
}

// ================= FONDO DISEÑADO BIBLIA =======================
function bibliaCssGradienteDiseno() {
  const c1 = bibliaHexSeguro(fondoDisenoBiblia.color1) || "#ffffff";
  const c2 = bibliaHexSeguro(fondoDisenoBiblia.color2) || "#d1eeff";
  const c3 = fondoDisenoBiblia.usarColor3
    ? (bibliaHexSeguro(fondoDisenoBiblia.color3) || "#a6d0ff")
    : c2;

  const colores = fondoDisenoBiblia.usarColor3
    ? `${c1}, ${c2}, ${c3}`
    : `${c1}, ${c2}`;

  switch (fondoDisenoBiblia.gradienteForma) {
    case "horizontal":
      return `linear-gradient(90deg, ${colores})`;

    case "diagonal":
      return `linear-gradient(135deg, ${colores})`;

    case "radial":
      return `radial-gradient(circle at center, ${colores})`;

    case "rombo":
      return bibliaSvgRomboDifuminadoDataUrl(
        c1,
        c2,
        c3,
        !!fondoDisenoBiblia.usarColor3
      );

    case "manchas":
      return [
        `radial-gradient(ellipse 82% 62% at 22% 24%, ${bibliaRgba(c2, .32)} 0%, ${bibliaRgba(c2, .22)} 30%, ${bibliaRgba(c2, .10)} 54%, transparent 78%)`,
        `radial-gradient(ellipse 82% 62% at 78% 24%, ${bibliaRgba(c3, .30)} 0%, ${bibliaRgba(c3, .20)} 31%, ${bibliaRgba(c3, .09)} 55%, transparent 79%)`,
        `radial-gradient(ellipse 86% 64% at 24% 76%, ${bibliaRgba(c3, .28)} 0%, ${bibliaRgba(c3, .18)} 32%, ${bibliaRgba(c3, .08)} 56%, transparent 80%)`,
        `radial-gradient(ellipse 86% 64% at 76% 76%, ${bibliaRgba(c2, .28)} 0%, ${bibliaRgba(c2, .18)} 32%, ${bibliaRgba(c2, .08)} 56%, transparent 80%)`,
        `radial-gradient(ellipse 90% 70% at 50% 50%, ${bibliaRgba(c2, .14)} 0%, ${bibliaRgba(c3, .10)} 38%, transparent 74%)`,
        `linear-gradient(180deg, ${c1} 0%, ${bibliaRgba(c1, .96)} 48%, ${c1} 100%)`
      ].join(",");

    case "vertical":
    default:
      return `linear-gradient(180deg, ${colores})`;
  }
}

function bibliaLimpiarCapasFondoDiseno() {
  const textura = document.getElementById("bibliaFondoTexturaLayer");
  const adorno = document.getElementById("bibliaFondoAdornoLayer");
  const imgAdorno = document.getElementById("bibliaFondoAdornoImg");

  if (textura) {
    textura.style.display = "none";
    textura.style.backgroundImage = "none";
    textura.style.backgroundSize = "";
    textura.style.backgroundPosition = "";
    textura.style.backgroundRepeat = "";
    textura.style.opacity = "0";
  }

  if (adorno) adorno.style.display = "none";

  if (imgAdorno) {
    imgAdorno.removeAttribute("src");
    imgAdorno.style.width = "";
    imgAdorno.style.opacity = "";
  }
}

function bibliaAplicarFondoAlPreview(previewImagen) {
  if (!previewImagen) return;

  const fondoUsable = fondoFinalBlobUrl || fondoFinal;

  const fondoVisual = fondoUsable
    ? bibliaUrlRecursoSeguro(
        fondoUsable,
        "fondo_biblia.png"
      )
    : "";

  const textura = document.getElementById("bibliaFondoTexturaLayer");
  const adorno = document.getElementById("bibliaFondoAdornoLayer");
  const imgAdorno = document.getElementById("bibliaFondoAdornoImg");

  // ✅ Unificado:
  // imagen = galería normal
  // plano/gradiente = fondo de color
  if (fondoDisenoBiblia.baseTipo === "imagen") {
    if (fondoVisual) {
      previewImagen.style.backgroundImage = `url("${fondoVisual}")`;
      previewImagen.style.backgroundColor = "transparent";
    } else {
      previewImagen.style.backgroundImage = "none";
      previewImagen.style.backgroundColor = "#ffffff";
    }
  } else {
    previewImagen.style.backgroundColor = fondoDisenoBiblia.color1 || "#ffffff";

    if (fondoDisenoBiblia.baseTipo === "gradiente") {
      previewImagen.style.backgroundImage = bibliaCssGradienteDiseno();

      if (fondoDisenoBiblia.gradienteForma === "manchas") {
        previewImagen.style.backgroundSize = "125% 125%, 125% 125%, 130% 130%, 130% 130%, 135% 135%, cover";
      } else if (fondoDisenoBiblia.gradienteForma === "rombo") {
        previewImagen.style.backgroundSize = "100% 100%";
      } else {
        previewImagen.style.backgroundSize = "cover";
      }

      previewImagen.style.backgroundPosition = "center";
      previewImagen.style.backgroundRepeat = "no-repeat";
    } else {
      previewImagen.style.backgroundImage = "none";
      previewImagen.style.backgroundSize = "cover";
      previewImagen.style.backgroundPosition = "center";
      previewImagen.style.backgroundRepeat = "no-repeat";
    }
  }

  // ✅ Varias texturas pueden superponerse sobre imagen o color.
  if (textura) {
    const texturasActivas = bibliaTexturasSeleccionadas();

    if (texturasActivas.length) {
      textura.style.display = "block";
      textura.style.backgroundImage = texturasActivas
        .map(url => bibliaUrlRecursoSeguro(
          url,
          "textura_biblia.png"
        ))
        .map(url => `url("${url}")`)
        .join(", ");
      textura.style.backgroundSize = texturasActivas
        .map(() => "cover")
        .join(", ");
      textura.style.backgroundPosition = texturasActivas
        .map(() => "center")
        .join(", ");
      textura.style.backgroundRepeat = texturasActivas
        .map(() => "no-repeat")
        .join(", ");
      textura.style.opacity = String(
        Math.max(0, Math.min(1, Number(fondoDisenoBiblia.texturaOpacidad) || 0))
      );
    } else {
      textura.style.display = "none";
      textura.style.backgroundImage = "none";
      textura.style.backgroundSize = "";
      textura.style.backgroundPosition = "";
      textura.style.backgroundRepeat = "";
      textura.style.opacity = "0";
    }
  }

  // ✅ Adorno siempre puede ir arriba de imagen o color
  if (adorno && imgAdorno) {
    if (fondoDisenoBiblia.adornoUrl) {
      adorno.style.display = "flex";
      imgAdorno.crossOrigin = "anonymous";
      imgAdorno.src = bibliaUrlRecursoSeguro(
        fondoDisenoBiblia.adornoUrl,
        "adorno_biblia.png"
      );
      imgAdorno.style.width = `${Math.max(20, Math.min(100, Number(fondoDisenoBiblia.adornoTamano) || 70))}%`;
      imgAdorno.style.opacity = String(
  Math.max(0, Math.min(1, Number(fondoDisenoBiblia.adornoOpacidad ?? 1)))
);
    } else {
      adorno.style.display = "none";
      imgAdorno.removeAttribute("src");
    }
  }
}

function bibliaSincronizarHostPickrFondo(idHost, color) {
  const host = document.getElementById(idHost);
  if (!host) return;

  const valor = color || "#ffffff";
  host.style.setProperty("--pickr-color", valor);
  host.style.background = valor;

  try {
    if (host._pickr && typeof host._pickr.setColor === "function") {
      host._pickr.setColor(valor, true);
    }
  } catch (e) {}
}

function bibliaActualizarGaleriaFondoVisible() {
  const cont = document.getElementById("personalizarFondos");
  if (!cont) return;

  const usandoColor = fondoDisenoBiblia.baseTipo !== "imagen";
  cont.classList.toggle("biblia-fondo-color-activo", usandoColor);

  const btnPaleta = document.getElementById("btnBibliaPaletaFondo");
  if (btnPaleta) {
    btnPaleta.classList.toggle("activo", usandoColor);
    btnPaleta.title = usandoColor ? "Volver a galería de fondos" : "Usar fondo plano o degradado";
    btnPaleta.setAttribute("aria-label", btnPaleta.title);
  }
}

function bibliaSincronizarControlesFondoDiseno() {
  const color1 = document.getElementById("bibliaFondoColor1");
  const color2 = document.getElementById("bibliaFondoColor2");
  const color3 = document.getElementById("bibliaFondoColor3");
  const forma = document.getElementById("bibliaGradienteForma");
  const texturaOp = document.getElementById("bibliaTexturaOpacidad");
  const adornoTam = document.getElementById("bibliaAdornoTamano");
  const adornoOp = document.getElementById("bibliaAdornoOpacidad");

  const color2Wrap = document.getElementById("bibliaColor2Wrap");
  const color3Wrap = document.getElementById("bibliaColor3Wrap");
  const btnAdd = document.getElementById("btnBibliaColorAdd");

  if (color1) color1.value = fondoDisenoBiblia.color1;
  if (color2) color2.value = fondoDisenoBiblia.color2;
  if (color3) color3.value = fondoDisenoBiblia.color3;

  bibliaSincronizarHostPickrFondo("bibliaFondoColor1Host", fondoDisenoBiblia.color1);
  bibliaSincronizarHostPickrFondo("bibliaFondoColor2Host", fondoDisenoBiblia.color2);
  bibliaSincronizarHostPickrFondo("bibliaFondoColor3Host", fondoDisenoBiblia.color3);

  if (forma) {
    forma.value = fondoDisenoBiblia.gradienteForma;
    forma.style.display = fondoDisenoBiblia.usarColor2 ? "inline-flex" : "none";
  }

  if (texturaOp) texturaOp.value = String(fondoDisenoBiblia.texturaOpacidad);
  if (adornoTam) adornoTam.value = String(fondoDisenoBiblia.adornoTamano);
  if (adornoOp) adornoOp.value = String(fondoDisenoBiblia.adornoOpacidad ?? 1);

  if (color2Wrap) {
    color2Wrap.style.display = fondoDisenoBiblia.usarColor2 ? "inline-flex" : "none";
  }

  if (color3Wrap) {
    color3Wrap.style.display = fondoDisenoBiblia.usarColor3 ? "inline-flex" : "none";
  }

  if (btnAdd) {
    if (!fondoDisenoBiblia.usarColor2) {
      btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i>';
      btnAdd.title = "Agregar segundo color";
    } else if (!fondoDisenoBiblia.usarColor3) {
      btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i>';
      btnAdd.title = "Agregar tercer color";
    } else {
      btnAdd.innerHTML = '<i class="fa-solid fa-minus"></i>';
      btnAdd.title = "Volver a un solo color";
    }
  }

  bibliaActualizarGaleriaFondoVisible();
}

function bibliaTexturasSeleccionadas() {
  const actuales = Array.isArray(fondoDisenoBiblia?.texturasUrls)
    ? fondoDisenoBiblia.texturasUrls
    : [];

  const heredada = String(fondoDisenoBiblia?.texturaUrl || "").trim();

  return Array.from(
    new Set([
      ...actuales.map(url => String(url || "").trim()).filter(Boolean),
      ...(heredada ? [heredada] : [])
    ])
  );
}

function bibliaGuardarTexturasSeleccionadas(urls = []) {
  const limpias = Array.from(
    new Set(
      (Array.isArray(urls) ? urls : [])
        .map(url => String(url || "").trim())
        .filter(Boolean)
    )
  );

  fondoDisenoBiblia.texturasUrls = limpias;
  fondoDisenoBiblia.texturaUrl = limpias[0] || null;
}

function bibliaRecursosAdministrados(categoria, base, nombreVacio) {
  const baseLimpia = (Array.isArray(base) ? base : [])
    .filter(item => item && item.url)
    .map(item => ({
      nombre: String(item.nombre || "Recurso"),
      url: String(item.url || "").trim()
    }))
    .filter(item => item.url);

  const administrados =
    typeof window.vaFondosObtenerItems === "function"
      ? window.vaFondosObtenerItems(categoria, false)
          .map(item => ({
            nombre: String(item?.nombre || "Recurso"),
            url: String(item?.url || "").trim()
          }))
          .filter(item => item.url)
      : baseLimpia;

  return [
    { nombre: nombreVacio, url: null },
    ...administrados
  ];
}

function bibliaRenderTexturasDiseno() {
  const cont = document.getElementById("bibliaTexturasCarril");
  if (!cont) return;

  cont.innerHTML = "";

  const items = bibliaRecursosAdministrados(
    "texturas",
    BIBLIA_TEXTURAS_DISENO,
    "Sin textura"
  );

  const permitidas = new Set(
    items.map(item => String(item?.url || "").trim()).filter(Boolean)
  );

  const seleccionadas = bibliaTexturasSeleccionadas()
    .filter(url => permitidas.has(url));

  bibliaGuardarTexturasSeleccionadas(seleccionadas);

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "biblia-recurso-mini";

    const activo = item.url
      ? seleccionadas.includes(item.url)
      : seleccionadas.length === 0;

    btn.classList.toggle("activo", activo);
    btn.title = item.url
      ? `${item.nombre} · tocar para agregar o quitar`
      : item.nombre;

    if (item.url) {
      const miniatura = document.createElement("img");
      miniatura.crossOrigin = "anonymous";
      miniatura.src = bibliaUrlRecursoSeguro(
        item.url,
        "textura_biblia.png"
      );
      miniatura.alt = item.nombre;
      btn.appendChild(miniatura);
    } else {
      btn.innerHTML = `<i class="fa-solid fa-ban"></i>`;
    }

    btn.onclick = () => {
      if (!item.url) {
        bibliaGuardarTexturasSeleccionadas([]);
      } else {
        const actuales = bibliaTexturasSeleccionadas();
        const nuevas = actuales.includes(item.url)
          ? actuales.filter(url => url !== item.url)
          : [item.url, ...actuales];

        bibliaGuardarTexturasSeleccionadas(nuevas);
      }

      bibliaRenderTexturasDiseno();
      actualizarPreview();
    };

    cont.appendChild(btn);
  });
}

function bibliaRenderAdornosDiseno() {
  const cont = document.getElementById("bibliaAdornosCarril");
  if (!cont) return;

  cont.innerHTML = "";

  const items = bibliaRecursosAdministrados(
    "adornos",
    BIBLIA_ADORNOS_DISENO,
    "Sin adorno"
  );

  const adornosPermitidos = new Set(
    items.map(item => String(item?.url || "").trim()).filter(Boolean)
  );

  if (
    fondoDisenoBiblia.adornoUrl &&
    !adornosPermitidos.has(fondoDisenoBiblia.adornoUrl)
  ) {
    fondoDisenoBiblia.adornoUrl = null;
  }

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "biblia-recurso-mini";
    btn.classList.toggle("activo", fondoDisenoBiblia.adornoUrl === item.url);
    btn.title = item.nombre;

    if (item.url) {
      const miniatura = document.createElement("img");
      miniatura.crossOrigin = "anonymous";
      miniatura.src = bibliaUrlRecursoSeguro(
        item.url,
        "adorno_biblia.png"
      );
      miniatura.alt = item.nombre;
      btn.appendChild(miniatura);
    } else {
      btn.innerHTML = `<i class="fa-solid fa-ban"></i>`;
    }

    btn.onclick = () => {
      fondoDisenoBiblia.adornoUrl = item.url;
      bibliaRenderAdornosDiseno();
      actualizarPreview();
    };

    cont.appendChild(btn);
  });
}

function bibliaAsegurarTabsFondoDiseno() {
  const fondosBox = document.getElementById("personalizarFondos");
  if (!fondosBox) return null;

let box = document.getElementById("bibliaDisenoFondos");

if (!box) {
  box = document.createElement("div");
  box.id = "bibliaDisenoFondos";
}

/* ✅ Tabs siempre arriba / galería de fondos siempre abajo */
if (fondosBox.parentNode && fondosBox.previousElementSibling !== box) {
  fondosBox.parentNode.insertBefore(box, fondosBox);
}

  if (!box.dataset.unificado) {
    box.dataset.unificado = "1";

    box.innerHTML = `
      <div class="biblia-diseno-tabs">
        <button type="button" data-biblia-tab="fondo" onclick="mostrarTabFondoDisenoBiblia('fondo')">
          Fondos
        </button>
        <button type="button" data-biblia-tab="textura" onclick="mostrarTabFondoDisenoBiblia('textura')">
          Textura
        </button>
        <button type="button" data-biblia-tab="adorno" onclick="mostrarTabFondoDisenoBiblia('adorno')">
          Adorno
        </button>
      </div>

      <div id="bibliaPanelFondo" class="biblia-diseno-panel" data-biblia-panel="fondo"></div>

      <div id="bibliaPanelTextura" class="biblia-diseno-panel" data-biblia-panel="textura">
        <div id="bibliaTexturasCarril" class="biblia-recursos-carril"></div>
        <div class="biblia-slider-row">
          <input
            id="bibliaTexturaOpacidad"
            class="biblia-slider-mini"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="0.22"
            oninput="actualizarFondoDisenoBibliaDesdeUI()"
          >
        </div>
      </div>

<div id="bibliaPanelAdorno" class="biblia-diseno-panel" data-biblia-panel="adorno">
  <div id="bibliaAdornosCarril" class="biblia-recursos-carril"></div>

  <div class="biblia-adorno-sliders">
    <label class="biblia-slider-pack" title="Tamaño del adorno">
      <i class="fa-solid fa-up-right-and-down-left-from-center"></i>
      <input
        id="bibliaAdornoTamano"
        class="biblia-slider-mini"
        type="range"
        min="20"
        max="100"
        step="1"
        value="70"
        oninput="actualizarFondoDisenoBibliaDesdeUI()"
      >
    </label>

    <label class="biblia-slider-pack" title="Opacidad del adorno">
      <i class="fa-solid fa-circle-half-stroke"></i>
      <input
        id="bibliaAdornoOpacidad"
        class="biblia-slider-mini"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value="1"
        oninput="actualizarFondoDisenoBibliaDesdeUI()"
      >
    </label>
  </div>
</div>
    `;
  }

  return box;
}

window.mostrarTabFondoDisenoBiblia = function(tab = "fondo") {
  const permitidas = ["fondo", "textura", "adorno"];
  const elegida = permitidas.includes(tab) ? tab : "fondo";

  bibliaAsegurarTabsFondoDiseno();

  const boxDiseno = document.getElementById("bibliaDisenoFondos");
if (boxDiseno) {
  boxDiseno.classList.remove("tab-fondo", "tab-textura", "tab-adorno");
  boxDiseno.classList.add("tab-" + elegida);
}

  document.querySelectorAll("#bibliaDisenoFondos [data-biblia-tab]").forEach(btn => {
    btn.classList.toggle("activo", btn.dataset.bibliaTab === elegida);
  });

  document.querySelectorAll("#bibliaDisenoFondos [data-biblia-panel]").forEach(panel => {
    panel.classList.toggle("activo", panel.dataset.bibliaPanel === elegida);
  });

  const galeria = document.getElementById("personalizarFondos");
  if (galeria) {
    galeria.style.display = elegida === "fondo" ? "flex" : "none";
  }

  if (elegida === "textura") bibliaRenderTexturasDiseno();
  if (elegida === "adorno") bibliaRenderAdornosDiseno();

  bibliaSincronizarControlesFondoDiseno();
};

window.bibliaTogglePaletaFondo = function() {
  if (fondoDisenoBiblia.baseTipo === "imagen") {
    fondoDisenoBiblia.baseTipo = fondoDisenoBiblia.usarColor2 ? "gradiente" : "plano";
  } else {
    fondoDisenoBiblia.baseTipo = "imagen";
  }

  bibliaSincronizarControlesFondoDiseno();
  actualizarPreview();
};

window.bibliaAgregarColorFondo = function() {
  if (!fondoDisenoBiblia.usarColor2) {
    fondoDisenoBiblia.usarColor2 = true;
    fondoDisenoBiblia.baseTipo = "gradiente";
  } else if (!fondoDisenoBiblia.usarColor3) {
    fondoDisenoBiblia.usarColor3 = true;
    fondoDisenoBiblia.baseTipo = "gradiente";
  } else {
    fondoDisenoBiblia.usarColor2 = false;
    fondoDisenoBiblia.usarColor3 = false;
    fondoDisenoBiblia.baseTipo = "plano";
  }

  bibliaSincronizarControlesFondoDiseno();
  actualizarPreview();
};

// compatibilidad por si quedó algún botón viejo llamando estas funciones
window.setTipoBaseFondoBiblia = function(tipo) {
  if (tipo === "gradiente") {
    fondoDisenoBiblia.baseTipo = "gradiente";
    fondoDisenoBiblia.usarColor2 = true;
  } else if (tipo === "plano") {
    fondoDisenoBiblia.baseTipo = "plano";
  } else {
    fondoDisenoBiblia.baseTipo = "imagen";
  }

  bibliaSincronizarControlesFondoDiseno();
  actualizarPreview();
};

window.toggleTercerColorBiblia = function() {
  fondoDisenoBiblia.usarColor2 = true;
  fondoDisenoBiblia.usarColor3 = !fondoDisenoBiblia.usarColor3;
  fondoDisenoBiblia.baseTipo = "gradiente";

  bibliaSincronizarControlesFondoDiseno();
  actualizarPreview();
};

window.actualizarFondoDisenoBibliaDesdeUI = function() {
  const color1 = document.getElementById("bibliaFondoColor1");
  const color2 = document.getElementById("bibliaFondoColor2");
  const color3 = document.getElementById("bibliaFondoColor3");
  const forma = document.getElementById("bibliaGradienteForma");
  const texturaOp = document.getElementById("bibliaTexturaOpacidad");
  const adornoTam = document.getElementById("bibliaAdornoTamano");
  const adornoOp = document.getElementById("bibliaAdornoOpacidad");

  if (color1) fondoDisenoBiblia.color1 = color1.value || "#ffffff";
  if (color2) fondoDisenoBiblia.color2 = color2.value || "#d1eeff";
  if (color3) fondoDisenoBiblia.color3 = color3.value || "#a6d0ff";
  if (forma) fondoDisenoBiblia.gradienteForma = forma.value || "vertical";

  if (texturaOp) fondoDisenoBiblia.texturaOpacidad = Number(texturaOp.value || 0);
  if (adornoTam) fondoDisenoBiblia.adornoTamano = Number(adornoTam.value || 70);
  if (adornoOp) fondoDisenoBiblia.adornoOpacidad = Number(adornoOp.value ?? 1);

  if (fondoDisenoBiblia.baseTipo !== "imagen") {
    fondoDisenoBiblia.baseTipo = fondoDisenoBiblia.usarColor2 ? "gradiente" : "plano";
  }

  bibliaSincronizarControlesFondoDiseno();
  actualizarPreview();
};

function bibliaActualizarUIModoFondo() {
  modoFondoBiblia = "diseno";

  const modal = document.getElementById("modalPersonalizar");
  const btn = document.getElementById("btnModoFondoBiblia");
  const diseno = bibliaAsegurarTabsFondoDiseno();

  if (modal) modal.classList.add("fondo-diseno-activo");

  // ✅ switch eliminado visualmente
  if (btn) {
    btn.style.display = "none";
    btn.setAttribute("aria-hidden", "true");
  }

  if (diseno) {
    diseno.style.display = "flex";
    diseno.setAttribute("aria-hidden", "false");
  }

  bibliaSincronizarControlesFondoDiseno();
}

// compatibilidad si alguna parte vieja llama el switch
window.toggleModoFondoBiblia = function() {
  modoFondoBiblia = "diseno";
  bibliaActualizarUIModoFondo();
  window.mostrarTabFondoDisenoBiblia("fondo");
  actualizarPreview();
};

function bibliaResetFondoDiseno() {
  modoFondoBiblia = "diseno";
  fondoDisenoBiblia = bibliaNuevoEstadoFondoDiseno();

  bibliaAsegurarTabsFondoDiseno();
  bibliaSincronizarControlesFondoDiseno();
  bibliaRenderTexturasDiseno();
  bibliaRenderAdornosDiseno();
  window.mostrarTabFondoDisenoBiblia("fondo");
  bibliaActualizarUIModoFondo();
  bibliaLimpiarCapasFondoDiseno();
}

// ================= ✅ FIX IMÁGENES: ESTADO / GUARDANDO / PREVIEW ESTABLE =================

function vaImgPausa(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function vaImgEsperarFuentesCorto() {
  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        vaImgPausa(700)
      ]);
    }
  } catch (e) {}
}

async function vaImgRecalcularPreviewDespuesAbrir() {
  try { bibliaCompactarControlesMobile?.(); } catch (e) {}

  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await vaImgEsperarFuentesCorto();

  try { actualizarPreview(); } catch (e) {}

  try {
    if (typeof bibliaEsperarRecursosDiseno === "function") {
      await bibliaEsperarRecursosDiseno();
    }
  } catch (e) {}

  await vaImgPausa(80);

  try { actualizarPreview(); } catch (e) {}
  await new Promise(resolve => requestAnimationFrame(resolve));

  try { invalidarRenderFinal?.(); } catch (e) {}
}

function vaImgMostrarGuardando(texto = "Guardando imagen...") {
  let overlay = document.getElementById("vaImgGuardandoOverlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "vaImgGuardandoOverlay";
    overlay.className = "va-img-guardando-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="va-img-guardando-card">
        <div class="va-img-spinner"></div>
        <div class="va-img-guardando-text">Guardando imagen...</div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  const txt = overlay.querySelector(".va-img-guardando-text");
  if (txt) txt.textContent = texto;

  overlay.style.display = "flex";
  overlay.setAttribute("aria-hidden", "false");
}

function vaImgOcultarGuardando() {
  const overlay = document.getElementById("vaImgGuardandoOverlay");
  if (!overlay) return;

  overlay.style.display = "none";
  overlay.setAttribute("aria-hidden", "true");
}

function vaImgSetInputValue(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  if (valor === undefined || valor === null || valor === "") return;
  el.value = String(valor);
}

function vaImgCapturarEstadoDisenoActual() {
  const sizeInput = document.getElementById("personalizarTamaño");
  const colorInput = document.getElementById("personalizarColor");
  const opInput = document.getElementById("personalizarOpacidad");
  const opColorInput = document.getElementById("colorOpacidadBiblia");
  const outlineInput = document.getElementById("personalizarOutlineColor");

  return {
    version: 1,

    formato: formatoImagenActual || "post",
    fondoCategoriaActual: fondoCategoriaActual || "paisajes",

    modoFondoBiblia: "diseno",
    fondoFinal: String(fondoFinal || ""),

    fondoDisenoBiblia: {
      ...fondoDisenoBiblia
    },

    fuenteActual: fuenteActual || "Roboto, sans-serif",

    textStyle: {
      upper: !!textStyle?.upper,
      bold: !!textStyle?.bold,
      italic: !!textStyle?.italic,
      underline: !!textStyle?.underline
    },

    userSetFontSize: !!userSetFontSize,

    controles: {
      tamano: sizeInput ? String(sizeInput.value || "") : "",
      colorTexto: colorInput ? String(colorInput.value || "#000000") : "#000000",
      opacidad: opInput ? String(opInput.value || "0.35") : "0.35",
      colorOpacidad: opColorInput ? String(opColorInput.value || "#000000") : "#000000",
      outlineColor: outlineInput ? String(outlineInput.value || "") : "",
      outlineManual: outlineInput ? outlineInput.dataset.manual === "1" : false
    }
  };
}

function vaImgSyncBotonesEstilo() {
  const mapa = [
    ["btnUpper", !!textStyle?.upper],
    ["btnBold", !!textStyle?.bold],
    ["btnItalic", !!textStyle?.italic],
    ["btnUnderline", !!textStyle?.underline]
  ];

  mapa.forEach(([id, activo]) => {
    const b = document.getElementById(id);
    if (b) b.classList.toggle("activo", activo);
  });
}

async function vaImgAplicarEstadoDisenoGuardado(item = {}) {
  const estado =
    item.disenoImagen ||
    item.estadoDisenoImagen ||
    item.diseno ||
    null;

  if (!estado || typeof estado !== "object") {
    setFormatoImagen("post");
    return false;
  }

  const fdGuardado = estado.fondoDisenoBiblia && typeof estado.fondoDisenoBiblia === "object"
    ? estado.fondoDisenoBiblia
    : {};

  fondoCategoriaActual = String(estado.fondoCategoriaActual || fondoCategoriaActual || "paisajes");

  modoFondoBiblia = "diseno";
  fondoDisenoBiblia = {
    ...bibliaNuevoEstadoFondoDiseno(),
    ...fdGuardado
  };

  bibliaGuardarTexturasSeleccionadas(
    Array.isArray(fdGuardado.texturasUrls)
      ? fdGuardado.texturasUrls
      : (fdGuardado.texturaUrl ? [fdGuardado.texturaUrl] : [])
  );

  if (!["imagen", "plano", "gradiente"].includes(fondoDisenoBiblia.baseTipo)) {
    fondoDisenoBiblia.baseTipo = "imagen";
  }

  if (fondoFinalBlobUrl) {
    URL.revokeObjectURL(fondoFinalBlobUrl);
    fondoFinalBlobUrl = null;
  }

  fondoFinal = String(estado.fondoFinal || "").trim();

  if (fondoFinal) {
    try {
      fondoFinalBlobUrl = await urlToBlobURL(fondoFinal);
    } catch (e) {
      console.warn("No pude restaurar fondo como blob, uso la URL directa:", e);
      fondoFinalBlobUrl = null;
    }
  }

  fuenteActual = String(estado.fuenteActual || "Roboto, sans-serif");

  textStyle = {
    upper: !!estado.textStyle?.upper,
    bold: !!estado.textStyle?.bold,
    italic: !!estado.textStyle?.italic,
    underline: !!estado.textStyle?.underline
  };

  const controles = estado.controles || {};

  vaImgSetInputValue("personalizarTamaño", controles.tamano);
  vaImgSetInputValue("personalizarColor", controles.colorTexto || "#000000");
  vaImgSetInputValue("personalizarOpacidad", controles.opacidad || "0.35");
  vaImgSetInputValue("colorOpacidadBiblia", controles.colorOpacidad || "#000000");

  userSetFontSize = !!(estado.userSetFontSize || controles.tamano);

  try {
    const outline = asegurarColorContornoBiblia?.();
    if (outline && controles.outlineColor) {
      outline.value = controles.outlineColor;
      outline.dataset.manual = controles.outlineManual ? "1" : "0";
      bibliaSetHostColorVisual?.("personalizarOutlineHost", controles.outlineColor);
    }
  } catch (e) {}

  vaImgSyncBotonesEstilo();

  try { cargarFondos(); } catch (e) {}
  try { bibliaActualizarUIModoFondo(); } catch (e) {}
  try { bibliaSincronizarControlesFondoDiseno(); } catch (e) {}
  try { bibliaRenderTexturasDiseno(); } catch (e) {}
  try { bibliaRenderAdornosDiseno(); } catch (e) {}

  setFormatoImagen(estado.formato === "story" ? "story" : "post");

  await vaImgRecalcularPreviewDespuesAbrir();

  return true;
}

function bibliaPrecargarRecurso(url) {
  if (!url) return Promise.resolve();

  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = resolve;
    img.onerror = resolve;
    img.src = bibliaUrlRecursoSeguro(
      url,
      "recurso_biblia.png"
    );
  });
}


async function bibliaEsperarRecursosDiseno() {
  if (modoFondoBiblia !== "diseno") return;

  await Promise.all([
    ...bibliaTexturasSeleccionadas().map(url => bibliaPrecargarRecurso(url)),
    bibliaPrecargarRecurso(fondoDisenoBiblia.adornoUrl)
  ]);
}

// ================= CUENTAGOTAS PARA EL WRAPPER =================
const BIBLIA_CUENTAGOTAS_WRAPPER = {
  color: "#000000",
  ctx: null,
  arrastrando: false
};

function bibliaRgbToHex(r, g, b) {
  const hx = n => Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function bibliaAsegurarBotonCuentagotasWrapper() {
  if (document.getElementById("btnBibliaCuentagotasWrapper")) return;

  const host =
    document.getElementById("colorOpacidadBibliaHost") ||
    document.getElementById("colorOpacidadBiblia");

  if (!host?.parentElement) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btnBibliaCuentagotasWrapper";
  btn.title = "Tomar color del fondo para el wrapper";
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = `<i class="fa-solid fa-eye-dropper"></i>`;

  btn.style.width = "36px";
  btn.style.height = "36px";
  btn.style.minWidth = "36px";
  btn.style.padding = "0";
  btn.style.border = "none";
  btn.style.borderRadius = "999px";
  btn.style.background = "var(--ui-azul-claro, #d1eeff)";
  btn.style.color = "#000";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.cursor = "pointer";
  btn.style.marginLeft = "6px";
  btn.style.verticalAlign = "middle";

  btn.onclick = () => window.bibliaAbrirCuentagotasWrapper();

  host.insertAdjacentElement("afterend", btn);
}

window.bibliaCerrarCuentagotasWrapper = function() {
  document.getElementById("modalBibliaCuentagotasWrapper")?.remove();
};

function bibliaAsegurarModalCuentagotasWrapper() {
  let modal = document.getElementById("modalBibliaCuentagotasWrapper");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "modalBibliaCuentagotasWrapper";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.zIndex = "9999999";
  modal.style.background = "rgba(0,0,0,.58)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.padding = "12px";

  modal.innerHTML = `
    <div
      style="
        position:relative;
        width:min(760px, 96vw);
        max-height:94vh;
        overflow:auto;
        background:#fff;
        color:#000;
        border-radius:22px;
        padding:16px;
        box-shadow:0 24px 70px rgba(0,0,0,.35);
        box-sizing:border-box;
        text-align:center;
      "
      onclick="event.stopPropagation()"
    >
      <button
        type="button"
        onclick="bibliaCerrarCuentagotasWrapper()"
        style="
          position:absolute;
          top:8px;
          right:10px;
          width:34px;
          height:34px;
          border:none;
          border-radius:999px;
          background:rgba(0,0,0,.08);
          font-size:22px;
          cursor:pointer;
        "
      >×</button>

      <h3 style="margin:4px 38px 6px;">Color del wrapper</h3>

      <p style="margin:0 0 12px; opacity:.72;">
        Tocá o arrastrá sobre la imagen para elegir un color.
      </p>

      <canvas
        id="bibliaCuentagotasWrapperCanvas"
        style="
          display:block;
          width:100%;
          max-height:68vh;
          object-fit:contain;
          border-radius:16px;
          background:#eee;
          touch-action:none;
        "
      ></canvas>

      <div
        style="
          display:flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          margin-top:12px;
          font-weight:900;
        "
      >
        <span
          id="bibliaCuentagotasWrapperMuestra"
          style="
            width:34px;
            height:34px;
            border-radius:999px;
            border:1px solid rgba(0,0,0,.18);
            background:#000;
          "
        ></span>

        <span id="bibliaCuentagotasWrapperHex">#000000</span>
      </div>

      <div
        style="
          display:flex;
          justify-content:center;
          gap:10px;
          margin-top:14px;
          flex-wrap:wrap;
        "
      >
        <button
          type="button"
          onclick="bibliaAplicarCuentagotasWrapper()"
          style="
            border:none;
            border-radius:999px;
            padding:10px 16px;
            background:var(--ui-azul-claro, #d1eeff);
            color:#000;
            font-weight:900;
            cursor:pointer;
          "
        >
          Usar este color
        </button>

        <button
          type="button"
          onclick="bibliaCerrarCuentagotasWrapper()"
          style="
            border:none;
            border-radius:999px;
            padding:10px 16px;
            background:#e9ecef;
            color:#000;
            font-weight:900;
            cursor:pointer;
          "
        >
          Cancelar
        </button>
      </div>
    </div>
  `;

  modal.onclick = () => window.bibliaCerrarCuentagotasWrapper();
  document.body.appendChild(modal);

  return modal;
}

function bibliaSetColorCuentagotasWrapper(hex) {
  const color = bibliaHexSeguro(hex) || "#000000";
  BIBLIA_CUENTAGOTAS_WRAPPER.color = color;

  const muestra = document.getElementById("bibliaCuentagotasWrapperMuestra");
  const texto = document.getElementById("bibliaCuentagotasWrapperHex");

  if (muestra) muestra.style.background = color;
  if (texto) texto.textContent = color;
}

function bibliaCargarImagenCuentagotasWrapper(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => resolve(img);
    img.onerror = () => reject(
      new Error("No pude cargar el fondo para tomar el color.")
    );

    img.src = bibliaUrlRecursoSeguro(
      src,
      "fondo_cuentagotas.png"
    );
  });
}

window.bibliaAbrirCuentagotasWrapper = async function() {
  const src = fondoFinalBlobUrl || fondoFinal || "";

  if (!src) {
    alert("Primero elegí una imagen de fondo.");
    return;
  }

  bibliaAsegurarModalCuentagotasWrapper();

  const canvas = document.getElementById("bibliaCuentagotasWrapperCanvas");
  if (!canvas) return;

  try {
    const img = await bibliaCargarImagenCuentagotasWrapper(src);

    const maxW = 1000;
    const maxH = 1000;
    const escala = Math.min(maxW / img.width, maxH / img.height, 1);

    canvas.width = Math.max(1, Math.round(img.width * escala));
    canvas.height = Math.max(1, Math.round(img.height * escala));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    BIBLIA_CUENTAGOTAS_WRAPPER.ctx = ctx;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const actual =
      document.getElementById("colorOpacidadBiblia")?.value ||
      "#000000";

    bibliaSetColorCuentagotasWrapper(actual);

    const tomar = e => {
      const rect = canvas.getBoundingClientRect();

      const x = Math.max(
        0,
        Math.min(
          canvas.width - 1,
          Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
        )
      );

      const y = Math.max(
        0,
        Math.min(
          canvas.height - 1,
          Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
        )
      );

      const px = ctx.getImageData(x, y, 1, 1).data;
      const hex = bibliaRgbToHex(px[0], px[1], px[2]);

      bibliaSetColorCuentagotasWrapper(hex);
    };

    canvas.onpointerdown = e => {
      e.preventDefault();
      BIBLIA_CUENTAGOTAS_WRAPPER.arrastrando = true;
      canvas.setPointerCapture?.(e.pointerId);
      tomar(e);
    };

    canvas.onpointermove = e => {
      if (!BIBLIA_CUENTAGOTAS_WRAPPER.arrastrando) return;
      e.preventDefault();
      tomar(e);
    };

    const terminar = e => {
      if (!BIBLIA_CUENTAGOTAS_WRAPPER.arrastrando) return;
      e.preventDefault();
      tomar(e);
      BIBLIA_CUENTAGOTAS_WRAPPER.arrastrando = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    canvas.onpointerup = terminar;
    canvas.onpointercancel = () => {
      BIBLIA_CUENTAGOTAS_WRAPPER.arrastrando = false;
    };

  } catch (error) {
    console.error("Error en cuentagotas del wrapper:", error);
    window.bibliaCerrarCuentagotasWrapper();

    alert(
      "No pude tomar el color de este fondo.\n\n" +
      (error?.message || error)
    );
  }
};

window.bibliaAplicarCuentagotasWrapper = function() {
  const hex = BIBLIA_CUENTAGOTAS_WRAPPER.color || "#000000";
  const input = document.getElementById("colorOpacidadBiblia");

  if (input) {
    input.value = hex;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  bibliaSetHostColorVisual("colorOpacidadBibliaHost", hex);
  actualizarPreview();
  window.bibliaCerrarCuentagotasWrapper();
};

// ================= WRAPPER SUAVE PARA CREAR IMAGEN BIBLIA =================
const BIBLIA_WRAPPER_CACHE = new Map();

function bibliaHexToRgb(hex){
  const h = String(hex || "#000000").replace("#", "").trim();

  const full = h.length === 3
    ? h.split("").map(x => x + x).join("")
    : h.padEnd(6, "0").slice(0, 6);

  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0
  };
}

function bibliaRoundRectPath(ctx, x, y, w, h, r){
  r = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function bibliaWrapperVisualDataUrl(op, color){
  const raw = Math.max(0, Math.min(1, Number(op) || 0));
  const col = color || "#000000";

  if (raw <= 0) return "";

  const key = `${raw.toFixed(3)}_${col}`;
  if (BIBLIA_WRAPPER_CACHE.has(key)) return BIBLIA_WRAPPER_CACHE.get(key);

  const { r, g, b } = bibliaHexToRgb(col);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const size = 1000;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;

  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  bibliaRoundRectPath(ctx, 0, 0, size, size, 145);
  ctx.clip();

  // Centro visible, bordes más suaves.
  const center = lum > 0.78 ? Math.max(raw, 0.30) : raw;
  const mid    = Math.max(0.03, center * 0.48);
  const edge   = Math.max(0.00, center * 0.035);

  const base = ctx.createRadialGradient(
    size * 0.50, size * 0.50, size * 0.04,
    size * 0.50, size * 0.50, size * 0.78
  );

  base.addColorStop(0.00, `rgba(${r}, ${g}, ${b}, ${center})`);
  base.addColorStop(0.54, `rgba(${r}, ${g}, ${b}, ${center})`);
  base.addColorStop(0.78, `rgba(${r}, ${g}, ${b}, ${mid})`);
  base.addColorStop(1.00, `rgba(${r}, ${g}, ${b}, ${edge})`);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Esquinas tipo 3D:
  // fondo oscuro = brillo blanco
  // fondo claro = sombra gris/negra
  const corner = lum > 0.78 ? [0, 0, 0] : [255, 255, 255];

  const a1 = lum > 0.78
    ? Math.min(0.30, Math.max(0.10, raw * 0.34))
    : Math.min(0.34, Math.max(0.12, raw * 0.48));

  const a2 = lum > 0.78
    ? Math.min(0.12, Math.max(0.04, raw * 0.15))
    : Math.min(0.16, Math.max(0.05, raw * 0.22));

  const drawCorner = (x, y) => {
    const gCorner = ctx.createRadialGradient(x, y, 0, x, y, size * 0.34);
    gCorner.addColorStop(0.00, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, ${a1})`);
    gCorner.addColorStop(0.36, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, ${a2})`);
    gCorner.addColorStop(1.00, `rgba(${corner[0]}, ${corner[1]}, ${corner[2]}, 0)`);

    ctx.fillStyle = gCorner;
    ctx.fillRect(0, 0, size, size);
  };

  drawCorner(0, 0);
  drawCorner(size, 0);
  drawCorner(0, size);
  drawCorner(size, size);

  const url = c.toDataURL("image/png");
  BIBLIA_WRAPPER_CACHE.set(key, url);
  return url;
}

function aplicarWrapperBibliaImagen(wrapper, op, color){
  if (!wrapper) return;

  const raw = Math.max(0, Math.min(1, Number(op) || 0));

  wrapper.style.backgroundColor = "transparent";
  wrapper.style.boxShadow = "none";
  wrapper.style.backgroundRepeat = "no-repeat";
  wrapper.style.backgroundPosition = "center";
  wrapper.style.backgroundSize = "100% 100%";

  if (raw <= 0) {
    wrapper.style.backgroundImage = "none";
    return;
  }

  const url = bibliaWrapperVisualDataUrl(raw, color || "#000000");
  wrapper.style.backgroundImage = url ? `url("${url}")` : "none";
}

// ================= ⭐ ACTUALIZAR VISTA PREVIA (FIX) 🌅 =======================
function actualizarPreview() {
  const previewImagen = document.getElementById("previewImagen");
  const previewTexto = document.getElementById("previewTexto");
  const previewTextoBack = document.getElementById("previewTextoBack");
  const wrapper = document.getElementById("previewTextoWrapper");

  if (!previewImagen || !previewTexto || !previewTextoBack || !wrapper) return;

  bibliaAsegurarBotonCuentagotasWrapper();

  // ================= Texto para preview (Biblia o libre) =================
  asegurarCajaTextoLibrePanel();

  const textoFinal = obtenerTextoParaPreview();

const textoSeguro = textoLibreHtmlSeguro(textoFinal);

previewTexto.innerHTML = `<div class="preview-text-inner">${textoSeguro}</div>`;
previewTextoBack.innerHTML = `<div class="preview-text-inner">${textoSeguro}</div>`;

previewTexto.style.display = "grid";
previewTextoBack.style.display = "grid";
previewTexto.style.placeItems = "center";
previewTextoBack.style.placeItems = "center";
previewTexto.style.textAlign = "center";
previewTextoBack.style.textAlign = "center";
  
  // ================= Fondo =================
  // ✅ Modo imagen conserva el fondo viejo; modo diseño usa color/degradado + capas.
  bibliaAplicarFondoAlPreview(previewImagen);

  // ================= Fuente =================
  const fuente = fuenteActual || "Roboto, sans-serif";
  previewTexto.style.fontFamily = fuente;
  previewTextoBack.style.fontFamily = fuente;

  // ================= Estilos Texto =================
  // ✅ IMPORTANTE: aplicar estilos ANTES de medir el tamaño.
  // Así Mayúsculas, Bold e Italic no se calculan con el estado anterior.
  const transform = textStyle?.upper ? "uppercase" : "none";
  const pesoTexto = textStyle?.bold ? "800" : "500";
  const estiloTexto = textStyle?.italic ? "italic" : "normal";
  const decoracionTexto = textStyle?.underline ? "underline" : "none";

  previewTexto.style.textTransform = transform;
  previewTextoBack.style.textTransform = transform;

  previewTexto.style.fontWeight = pesoTexto;
  previewTextoBack.style.fontWeight = pesoTexto;

  previewTexto.style.fontStyle = estiloTexto;
  previewTextoBack.style.fontStyle = estiloTexto;

  previewTexto.style.textDecoration = decoracionTexto;
  previewTextoBack.style.textDecoration = decoracionTexto;

// ================= Tamaño (AUTO sugerido por MEDICION / MANUAL libre) =================
const sizeSlider = document.getElementById("personalizarTamaño");

// 1) AUTO: sugerimos midiendo si entra (NO es obligación, solo sugerencia)
if (!userSetFontSize && sizeSlider) {
  // primero ponemos un tamaño alto para que mida bien el “peor caso”
  sizeSlider.value = "64";
  previewTexto.style.fontSize = "64px";
  previewTextoBack.style.fontSize = "64px";

  const sugerido = sugerirFontSizeQueEntre(wrapper, previewTexto, previewTextoBack, 64, 10, 0.5);
  sizeSlider.value = String(sugerido);
}

// 2) MANUAL (o AUTO ya sugerido): el tamaño final SIEMPRE es el del slider
const finalSize = sizeSlider ? Number(sizeSlider.value || 32) : 32;
previewTexto.style.fontSize = finalSize + "px";
previewTextoBack.style.fontSize = finalSize + "px";

const innerFront = previewTexto.querySelector(".preview-text-inner");
const innerBack  = previewTextoBack.querySelector(".preview-text-inner");

if (innerFront) {
  innerFront.style.width = "100%";
  innerFront.style.margin = "0";
}
if (innerBack) {
  innerBack.style.width = "100%";
  innerBack.style.margin = "0";
}
  
// ================= Color / Outline =================
const colorEl = document.getElementById("personalizarColor");
const opEl = document.getElementById("personalizarOpacidad");
const outlineEl = asegurarColorContornoBiblia();

const color = colorEl ? colorEl.value : "#000000";
const opacidad = opEl ? opEl.value : "0.3";

let outlineColor = colorOutlineDesdeBase(color);

// ✅ Si el usuario no eligió contorno manualmente,
// seguimos sugiriendo blanco/negro automático.
if (outlineEl) {
  const manual = outlineEl.dataset.manual === "1";
  const valorManual = bibliaHexSeguro(outlineEl.value);

  if (manual && valorManual) {
    outlineColor = valorManual;
  } else {
    outlineEl.value = outlineColor;
    outlineEl.dataset.manual = "0";
  }
}

bibliaSetHostColorVisual("personalizarColorHost", color);
bibliaSetHostColorVisual("personalizarOutlineHost", outlineColor);

  // ✅ más parecido a Devocionales: contorno más visible y prolijo
  const outlineScale = 1.35;
  const strokePx = (0.75 * outlineScale).toFixed(2);

  // ✅ NO tocar position acá. La define el CSS para que queden idénticos.
  previewTexto.style.zIndex = "2";
  previewTextoBack.style.zIndex = "1";

  // reset acumulables
  previewTexto.style.textShadow = "none";
  previewTexto.style.WebkitTextStroke = "0px";
  previewTexto.style.webkitTextFillColor = color;
  previewTexto.style.paintOrder = "stroke fill";

  previewTextoBack.style.transform = "none";
  previewTextoBack.style.filter = "none";
  previewTextoBack.style.textShadow = "none";
  previewTextoBack.style.paintOrder = "stroke fill";

  // frente = texto normal
  previewTexto.style.color = color;
  previewTexto.style.caretColor = color;

  // atrás = contorno visible
  previewTextoBack.style.color = outlineColor;
  previewTextoBack.style.WebkitTextStroke = `${strokePx}px ${outlineColor}`;
  previewTextoBack.style.webkitTextFillColor = "transparent";
  previewTextoBack.style.transform = "none";
  previewTextoBack.style.filter = "none";
 previewTextoBack.style.textShadow = textShadowLegibleBiblia(color, outlineScale, outlineColor);
  
// ================= Opacidad Oscuro/Claro =================
const op = parseFloat(opacidad);
let bgColor = "rgba(0,0,0,0)";

const opColorEl = document.getElementById("colorOpacidadBiblia");
const opColor = opColorEl ? opColorEl.value : "#000000";

if (!isNaN(op)) {
  const hex = String(opColor || "#000000").replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map(x => x + x).join("")
    : hex.padEnd(6, "0").slice(0, 6);

  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;

  bgColor = `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, op))})`;
}

aplicarWrapperBibliaImagen(wrapper, op, opColor);

activarEdicionDirectaTextoLibre();
  
invalidarRenderFinal();

} // ✅ CIERRA actualizarPreview()

// ================= ⭐ CANVAS GENERA IMAGEN FINAL (FIX REAL) ============================
async function generarImagenFinal(opts = {}) {
  const { subir = true } = opts; // ✅ por defecto sube (Finalizar), pero Descargar/Compartir pasan false

  const preview = document.getElementById("previewImagen");
  const canvasFinal = document.getElementById("canvasFinal");
  const modal = document.getElementById("modalPersonalizar");

  if (!preview || !canvasFinal) return false;

  if (modal && getComputedStyle(modal).display === "none") {
    canvasFinal.width = 0;
    canvasFinal.height = 0;
    return false;
  }

  actualizarPreview();

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  await document.fonts.ready;

  const rect = preview.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) return false;

preview.classList.remove("render-final");

const t1 = document.getElementById("previewTexto");
const t2 = document.getElementById("previewTextoBack");
const wrapperTexto = document.getElementById("previewTextoWrapper");

if (wrapperTexto) {
  wrapperTexto.style.display = "flex";
  wrapperTexto.style.alignItems = "center";
  wrapperTexto.style.justifyContent = "center";
  wrapperTexto.style.textAlign = "center";
}

[t1, t2].forEach(t => {
  if (!t) return;

  t.style.display = "grid";
  t.style.placeItems = "center";
  t.style.textAlign = "center";
  t.style.alignItems = "center";
  t.style.justifyItems = "center";
});

  const fondoUsable = fondoFinalBlobUrl || fondoFinal;

  try {
    const dpr = window.devicePixelRatio || 1;
    const SCALE = (rect.width <= 480 && rect.height <= 480) ? 1 : Math.min(2, dpr);

    if (fondoUsable && typeof fondoUsable === "string" && /^blob:|^https?:/.test(fondoUsable)) {
      await new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = fondoUsable;
      });
    }

    // ✅ Si está activo el fondo diseñado, esperamos textura y adorno antes de capturar.
    await bibliaEsperarRecursosDiseno();

    const canvasTemp = await html2canvas(preview, {
      scale: SCALE,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      backgroundColor: (modoFondoBiblia === "diseno" || fondoUsable) ? null : "#ffffff"
    });

    canvasFinal.width = canvasTemp.width;
    canvasFinal.height = canvasTemp.height;

    const ctx = canvasFinal.getContext("2d");
    ctx.clearRect(0, 0, canvasFinal.width, canvasFinal.height);
    ctx.drawImage(canvasTemp, 0, 0);

  } catch (err) {
    console.error("html2canvas falló:", err);
    alert("No se pudo generar PNG. Probable problema de CORS con el fondo elegido.\nProbá con otro fondo o sin fondo.");
    return false;
  }

    // ================= ✅ SI pidieron "subir", subimos a Firebase =================
  if (subir) {
    await subirImagenBibliaUnaVezYGuardarDestinos();
  }

  
  return true;
}

// ================= ✅ CLICK SEGURO PARA DESCARGA =================
function clickLink(link) {
  document.body.appendChild(link);
  link.click();
  link.remove();
}

(function(){
  const chk = document.getElementById("checkIglesia");
  const icon = document.getElementById("iconCompartidos");
  const wrap = document.getElementById("btnCompartidosWrap");

  if (!chk || !icon || !wrap) return;

  function update(){
    if (chk.checked){
      icon.className = "fa-solid fa-check";
      wrap.classList.add("guardado");
    } else {
      icon.className = "fa-solid fa-share-nodes";
      wrap.classList.remove("guardado");
    }
  }

  chk.addEventListener("change", update);
  update();
})();

// ================= 🔥 SUBIR IMAGEN BIBLIA UNA SOLA VEZ =================
async function subirImagenBibliaBaseUnaVez() {
  if (!uid) return null;

  const canvas = document.getElementById("canvasFinal");
  if (!canvas || canvas.width < 10 || canvas.height < 10) return null;

  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return null;

  const ts = Date.now();
  const fileName = `versiculo_${ts}.png`;

  try {
    const fileBase64 = await blobToBase64(blob);
    const subida = await subirImagenAR2DesdeWeb(fileBase64, fileName, "image/png");

    return {
      ts,
      url: subida.url,
      storagePath: "", // ya no usamos storage
      dbPath: ""
    };

  } catch (e) {
    console.error("❌ Error subiendo a R2:", e);
    alert("No se pudo subir la imagen. Probá de nuevo.");
    return null;
  }
}

// ================= 📌 GUARDAR REFERENCIA EN MI PANEL =================
async function guardarReferenciaImagenEnPanel(asset) {
  if (!uid || !asset) return "";

  const editando = window.__VA_IMG_EDITANDO || null;
  const idEditando = String(editando?.id || "").trim();
  const itemAnterior = idEditando
    ? (editando?.item || panelImagenesGuardadas?.[idEditando] || {})
    : {};

  const panelId = idEditando || String(asset.ts || Date.now());
  const dbPath = `panelImagenesPersonal/${uid}/${panelId}`;

  const itemsSel = modoImagenLibre ? [] : getItemsImagenEnOrden();

  const versiculosSel = itemsSel.map(it => ({
    libro: it.Libro,
    capitulo: it.Capitulo,
    versiculo: it.Versiculo
  }));

  const refCompleta = (!modoImagenLibre && itemsSel.length)
    ? referenciaImagenEnOrden(itemsSel)
    : "";

  const metaImagen = asset.meta || window.__VA_IMG_META_ACTUAL || {};
  const metaColor = vaImgMetaHex(metaImagen.color || "#fff3b0") || "#fff3b0";

  const ahora = Number(asset.ts || Date.now());
  const fechaOriginal = Number(
    itemAnterior.fechaOriginal ||
    itemAnterior.creadoEn ||
    itemAnterior.fecha ||
    ahora
  );

  const audioFinal =
    asset.audioGithubUrl ||
    asset.audioUrl ||
    asset.audio ||
    itemAnterior.audioGithubUrl ||
    itemAnterior.audioUrl ||
    itemAnterior.audio ||
    "";

  const nuevoItem = {
    ...itemAnterior,

    url: vaImgNormalizarUrlGuardada(asset.url),
    imagenUrl: vaImgNormalizarUrlGuardada(asset.url),

    // ✅ En edición NO cambia la clave, pero sí cambia la fecha.
    // Así vuelve arriba en Mi Panel.
    fecha: ahora,
    ts: ahora,
    uid,

    fechaOriginal,
    creadoEn: fechaOriginal,
    editadoEn: idEditando ? ahora : (itemAnterior.editadoEn || 0),

    tipo: "imagen",

    titulo: String(metaImagen.titulo || "").trim(),
    descripcion: String(metaImagen.descripcion || "").trim(),
    color: metaColor,
    colorFondo: metaColor,

    libro: modoImagenLibre ? "" : (itemsSel[0]?.Libro || itemAnterior.libro || libroSel?.value || ""),
    capitulo: modoImagenLibre ? 0 : Number(itemsSel[0]?.Capitulo || itemAnterior.capitulo || capSel?.value || 0),
    versiculos: versiculosSel,
    ref: refCompleta,

    origen: idEditando ? (itemAnterior.origen || origenModalImagen) : origenModalImagen,
    tipoTexto: modoImagenLibre ? "libre" : "biblia",
    textoLibre: modoImagenLibre ? (textoLibreImagen || "") : "",

    // ✅ Guarda fondo, textura, adorno, tamaño, fuente y colores.
    disenoImagen: vaImgCapturarEstadoDisenoActual(),

    audioOk: !!audioFinal,
    audioGithubUrl: audioFinal,
    audioUrl: audioFinal,
    audioTexto: asset.audioTexto || itemAnterior.audioTexto || "",

    storagePath: asset.storagePath || itemAnterior.storagePath || "",

    sourceCompPath: itemAnterior.sourceCompPath || "",
    sourceCompId: itemAnterior.sourceCompId || "",
    sourceCompKey: itemAnterior.sourceCompKey || "",
    sourceOracionesKey: itemAnterior.sourceOracionesKey || ""
  };

  await set(ref(db, dbPath), nuevoItem);

  panelImagenesGuardadas = {
    ...(panelImagenesGuardadas || {}),
    [panelId]: nuevoItem
  };

  window.__VA_ULTIMA_IMG_PANEL_ID = panelId;
  asset.panelItemId = panelId;

  return panelId;
}

// ================= 🌍 GUARDAR REFERENCIA EN COMPARTIDOS =================
async function guardarReferenciaImagenEnCompartidos(asset) {
  if (!uid || !asset) return "";

  const panelId = String(asset.panelItemId || window.__VA_IMG_EDITANDO?.id || asset.ts || Date.now());
  const itemPanel = panelImagenesGuardadas?.[panelId] || window.__VA_IMG_EDITANDO?.item || {};

  const existente = panelBuscarPublicacionImagenPanel(panelId, itemPanel);
  const compId = String(existente?.compId || asset.ts || Date.now());
  const dbPath = existente?.path || `compartidos/imagenes/${compId}`;

  const anterior = existente?.item || {};
  const ahora = Number(asset.ts || Date.now());

  const itemsSel = modoImagenLibre ? [] : getItemsImagenEnOrden();

  const versiculosSel = itemsSel.map(it => ({
    libro: it.Libro,
    capitulo: it.Capitulo,
    versiculo: it.Versiculo
  }));

  const refCompleta = (!modoImagenLibre && itemsSel.length)
    ? referenciaImagenEnOrden(itemsSel)
    : "";

  const metaImagen = asset.meta || window.__VA_IMG_META_ACTUAL || {};
  const metaColor = vaImgMetaHex(metaImagen.color || itemPanel.color || itemPanel.colorFondo || "#fff3b0") || "#fff3b0";

  const urlFinal = vaImgNormalizarUrlGuardada(asset.url);

  const fechaOriginal = Number(
    anterior.fechaOriginal ||
    anterior.creadoEn ||
    anterior.fecha ||
    itemPanel.fechaOriginal ||
    itemPanel.creadoEn ||
    itemPanel.fecha ||
    ahora
  );

  const audioFinal =
    asset.audioGithubUrl ||
    asset.audioUrl ||
    asset.audio ||
    itemPanel.audioGithubUrl ||
    itemPanel.audioUrl ||
    itemPanel.audio ||
    anterior.audioGithubUrl ||
    anterior.audioUrl ||
    anterior.audio ||
    "";

  const nuevoCompartido = {
    ...anterior,
    ...itemPanel,

    url: urlFinal,
    imagenUrl: urlFinal,

    uid,
    publicadoPor: uid,
    tipo: "imagen",

    titulo: String(metaImagen.titulo || "").trim(),
    descripcion: String(metaImagen.descripcion || "").trim(),
    color: metaColor,
    colorFondo: metaColor,

    fechaOriginal,
    creadoEn: fechaOriginal,

    // ✅ si edito y publico, la publicación también sube arriba
    fecha: ahora,
    publicadoEn: ahora,
    ts: ahora,
    editadoEn: window.__VA_IMG_EDITANDO ? ahora : (anterior.editadoEn || 0),
    actualizadoPor: uid,

    panelItemId: panelId,
    sourcePanelItemId: panelId,

    libro: modoImagenLibre ? "" : (itemsSel[0]?.Libro || itemPanel.libro || ""),
    capitulo: modoImagenLibre ? 0 : Number(itemsSel[0]?.Capitulo || itemPanel.capitulo || 0),
    versiculos: versiculosSel,
    ref: refCompleta,

    origen: itemPanel.origen || origenModalImagen,
    tipoTexto: modoImagenLibre ? "libre" : "biblia",
    textoLibre: modoImagenLibre ? (textoLibreImagen || "") : "",

    // ✅ Si se publica, también conserva los datos de edición.
    disenoImagen: vaImgCapturarEstadoDisenoActual(),

    audioOk: !!audioFinal,
    audioGithubUrl: audioFinal,
    audioUrl: audioFinal,
    audioTexto: asset.audioTexto || itemPanel.audioTexto || anterior.audioTexto || "",

    sourceCompPath: anterior.sourceCompPath || itemPanel.sourceCompPath || "",
    sourceCompId: anterior.sourceCompId || itemPanel.sourceCompId || "",
    sourceCompKey: anterior.sourceCompKey || itemPanel.sourceCompKey || "",
    sourceOracionesKey:
      anterior.sourceOracionesKey ||
      itemPanel.sourceOracionesKey ||
      itemPanel.sourceCompKey ||
      ""
  };

  await set(ref(db, dbPath), nuevoCompartido);

  panelImagenesPublicadas[panelId] = {
    compId,
    path: dbPath,
    item: nuevoCompartido
  };

  return compId;
}

// ================= ✅ SUBIR UNA VEZ Y REPARTIR REFERENCIAS =================
async function subirImagenBibliaUnaVezYGuardarDestinos() {
  const asset = await subirImagenBibliaBaseUnaVez();
  if (!asset) return false;

  asset.meta = {
    ...(window.__VA_IMG_META_ACTUAL || imagenMetaActual || {})
  };

  const audioUrlFinal = String(window.__lastAudioUrl || "").trim();

  if (audioUrlFinal) {
    asset.audioOk = true;
    asset.audioGithubUrl = audioUrlFinal;
    asset.audioUrl = audioUrlFinal;
    asset.audioTexto = window.__lastAudioTexto || "";
  }

  const panelId = await guardarReferenciaImagenEnPanel(asset);

  const chk = document.getElementById("checkIglesia");

  if (chk && chk.checked) {
    try {
      await guardarReferenciaImagenEnCompartidos(asset);
    } catch (e) {
      console.warn("No pude publicar en Compartidos:", e);
      alert("✅ Se guardó en Mi Panel, pero no se pudo publicar en Compartidos.");
    }
  }

  window.__lastAudioUrl = "";
  window.__lastAudioTs = 0;
  window.__lastAudioTexto = "";

  console.log("✅ Imagen guardada sin duplicar. Panel ID:", panelId);
  return true;
}

// ================= ⭐ SUBIR IMAGEN (personal / iglesia) ☁️ =================
async function subirImagen(destino = "personal") {
  // ⚠️ Compatibilidad:
  // esta función ya no sube distinto por destino.
  // ahora sube UNA sola vez y guarda referencias.
  return await subirImagenBibliaUnaVezYGuardarDestinos();
}

// ======================== ⭐ OPCION DESCARGAR (FIX) ====================================
async function descargarImagenFinal() {
  return withRenderLock(async () => {
    const canvas = document.getElementById("canvasFinal");
    if (!canvas) return;

    const ok = await generarImagenFinal({ subir: false });
    if (!ok) return;

    let nombreArchivo = "versiculo.png";

    // ===== TEXTO LIBRE (Mi Panel) =====
    if (modoImagenLibre || origenModalImagen === "panel") {
      const ahora = new Date();
      const yyyy = ahora.getFullYear();
      const mm = String(ahora.getMonth() + 1).padStart(2, "0");
      const dd = String(ahora.getDate()).padStart(2, "0");
      const hh = String(ahora.getHours()).padStart(2, "0");
      const min = String(ahora.getMinutes()).padStart(2, "0");

      nombreArchivo = `img_${yyyy}-${mm}-${dd}_${hh}-${min}.png`;
    }

    // ===== VERSÍCULOS BIBLIA =====
    else {
      const ref = obtenerVersiculoSeleccionado();

      if (ref) {
        const lineaRef = ref.split("\n").pop().replace("▪", "").trim();

        const limpio = lineaRef
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/:/g, "_")
          .replace(/,/g, "")
          .replace(/[^\w\-]/g, "");

        nombreArchivo = `${limpio}.png`;
      }
    }

    const descargarDesdeDataURL = () => {
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = nombreArchivo;
      clickLink(link);
    };

    try {
      canvas.toBlob(blob => {
        if (!blob) return descargarDesdeDataURL();

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = nombreArchivo;
        clickLink(link);
        URL.revokeObjectURL(link.href);
      }, "image/png");
    } catch (e) {
      descargarDesdeDataURL();
    }
  });
}

// ========================⭐ OPCION COMPARTIR ====================================
async function compartirImagenFinal() {
  return withRenderLock(async () => {
    const canvas = document.getElementById("canvasFinal");
    if (!canvas) return;

    const ok = await asegurarCanvasFinal({ subir: false }); // ✅ NO SUBE
    if (!ok) return;

    canvas.toBlob(async blob => {
      if (!blob) {
        await descargarImagenFinal();
        return;
      }

      const file = new File([blob], "versiculo.png", { type: "image/png" });

      try {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "Versículo" });
        } else {
          await descargarImagenFinal();
          alert("Tu dispositivo/navegador no permite compartir directo. La imagen se descargó para compartirla manualmente.");
        }
      } catch (e) {
        if (window.vaShareCancelado?.(e)) {
          return;
        }

        console.warn("Share falló:", e);
        await descargarImagenFinal();
      }
    }, "image/png");
  });
}

// ================= ⭐ RESET DEL MODAL  =======================
function resetModalPersonalizar() {
  userSetFontSize = false;
  fondoFinal = null;
  modoImagenLibre = false;
  textoLibreImagen = "";
  origenModalImagen = "biblia";
  
  if (fondoFinalBlobUrl) {
    URL.revokeObjectURL(fondoFinalBlobUrl);
    fondoFinalBlobUrl = null;
  }

  textStyle = { upper:false, bold:false, italic:false, underline:false };

  document.getElementById("personalizarOpacidad").value = 0.35;
  fuenteActual = "Roboto, sans-serif";

  const colorInput = document.getElementById("personalizarColor");
  if (colorInput) {
    colorInput.value = "#000000";
  }

  const preview = document.getElementById("previewImagen");
  if (preview) {
    preview.style.backgroundImage = "none";
    preview.style.backgroundColor = "#ffffff";
    preview.style.pointerEvents = "auto";
    preview.classList.remove("render-final");
  }

  const t1 = document.getElementById("previewTexto");
  const t2 = document.getElementById("previewTextoBack");
  if (t1) t1.style.display = "block";
  if (t2) t2.style.display = "block";

  const wrapper = document.getElementById("previewTextoWrapper");
if (wrapper) {
  wrapper.style.pointerEvents = "auto";
  wrapper.style.background = "";
  wrapper.style.backgroundImage = "none";
  wrapper.style.backgroundSize = "";
  wrapper.style.backgroundPosition = "";
  wrapper.style.backgroundRepeat = "";
  wrapper.style.boxShadow = "";
}

  const fondosBox = document.getElementById("personalizarFondos");
  if (fondosBox) fondosBox.style.display = "flex";

  const btnGen = document.getElementById("btnGenerarPersonalizada");
  if (btnGen) btnGen.style.display = "inline-block";

  const acciones = document.getElementById("accionesFinales");
  if (acciones) acciones.remove();

const boxTextoLibre = document.getElementById("boxTextoLibrePanel");
if (boxTextoLibre) boxTextoLibre.remove();

const previewTextoLibre = document.getElementById("previewTexto");
if (previewTextoLibre) {
  previewTextoLibre.removeAttribute("contenteditable");
  previewTextoLibre.removeAttribute("spellcheck");
  previewTextoLibre.removeAttribute("role");
  previewTextoLibre.style.cursor = "";
  previewTextoLibre.style.outline = "";
  previewTextoLibre.style.caretColor = "";
}

  // ✅ Cada apertura comienza en el modo actual de imágenes, sin perderlo durante el uso.
  bibliaResetFondoDiseno();

  forceDefaultCheckIglesia();
  actualizarPreview();
}

// ================= ⭐ SALIR DEL MODO IMAGEN  ======================= 
function salirModoImagen() {
modoImagen = false;
limpiarSeleccionImagenCompleta();
fondoFinal = null;
  if (fondoFinalBlobUrl) {
  URL.revokeObjectURL(fondoFinalBlobUrl);
  fondoFinalBlobUrl = null;
}

  document.body.classList.remove("modo-imagen");

  // 🖼️ ocultar banner
  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = "none";
  }

  cerrarModalPersonalizar();

  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.classList.remove("solo-imagen", "modo-devocional");

  mostrarTexto();
  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();

}

// ================= 🔒 LOCK GLOBAL (evita doble click / doble render) =================
window.__renderLock = window.__renderLock || {
  busy: false,
  promise: null,
  lastAt: 0
};

async function withRenderLock(fn) {
  // Si ya hay un render corriendo, devolvemos la MISMA promesa
  if (window.__renderLock.busy && window.__renderLock.promise) {
    return window.__renderLock.promise;
  }

  window.__renderLock.busy = true;
  window.__renderLock.lastAt = Date.now();

  const p = (async () => {
    try {
      return await fn();
    } finally {
      window.__renderLock.busy = false;
      window.__renderLock.promise = null;
    }
  })();

  window.__renderLock.promise = p;
  return p;
}

// ================= ⭐ CACHE de render del canvasFinal =================
window.__canvasFinalCache = {
  key: "",       // firma del estado renderizado
  busy: false,   // evita renders dobles
  lastOk: false
};

function getRenderKey() {
  const preview = document.getElementById("previewImagen");
  if (!preview) return "no-preview";

  const rect = preview.getBoundingClientRect();
  const fondoUsable = (fondoFinalBlobUrl || fondoFinal || "") + "";
  const firmaFondo = modoFondoBiblia === "diseno"
    ? JSON.stringify(fondoDisenoBiblia)
    : fondoUsable;
  const texto = (document.getElementById("previewTexto")?.textContent || "").trim();
  const font = getComputedStyle(document.getElementById("previewTexto") || preview).fontFamily || "";
  const color = getComputedStyle(document.getElementById("previewTexto") || preview).color || "";
  const opBack = getComputedStyle(document.getElementById("previewTextoBack") || preview).opacity || "";

  // ✅ incluimos tamaño porque si cambia el layout, hay que rerender
  return [
    Math.round(rect.width),
    Math.round(rect.height),
    modoFondoBiblia,
    firmaFondo,
    texto,
    font,
    color,
    opBack
  ].join("|");
}

// Marca el cache como “sucio” cuando cambias algo (fondo, texto, etc.)
function invalidarRenderFinal() {
  window.__canvasFinalCache.key = "";
  window.__canvasFinalCache.lastOk = false;
}

// Render SOLO si hace falta (si cambió algo)
async function asegurarCanvasFinal({ subir = false } = {}) {
  const modal = document.getElementById("modalPersonalizar");
  const canvas = document.getElementById("canvasFinal");
  if (!canvas) return false;

  // si el modal no está visible, no renderices
  if (modal && getComputedStyle(modal).display === "none") return false;

  const nuevaKey = getRenderKey();

  // ✅ si ya está renderizado con el mismo estado, no hacemos nada
  if (
    window.__canvasFinalCache.lastOk &&
    window.__canvasFinalCache.key === nuevaKey &&
    canvas.width > 10 && canvas.height > 10
  ) {
    // Si alguien pidió "subir", subimos sin re-render
if (subir) {
  await subirImagenBibliaUnaVezYGuardarDestinos();
}

    return true;
  }

  // ✅ evita renders simultáneos: si ya está ocupado, devolvemos false
  if (window.__canvasFinalCache.busy) return false;
  window.__canvasFinalCache.busy = true;

  try {
    // ✅ acá estaba tu bug: NO hay que llamarse a sí misma
    const ok = await generarImagenFinal({ subir: false });

    if (ok) {
      window.__canvasFinalCache.key = nuevaKey;
      window.__canvasFinalCache.lastOk = true;

if (subir) {
  await subirImagenBibliaUnaVezYGuardarDestinos();
}

    }

    return ok;
  } finally {
    window.__canvasFinalCache.busy = false;
  }
}

// ================= 🔺 WINDOW / UI ⭕ ===============================
window.irA = (seccion) => {
  const todas = ["biblia", "iglesia", "panel", "compartidos"];

  // ✅ Si algo manda una sección rara, abrimos Compartidos.
  if (!todas.includes(seccion)) seccion = "compartidos";

  // ✅ guardamos la sección apenas se toca el menú o se cambia pantalla.
  // Esto ayuda a volver donde estabas si Android mata la app.
  try {
    guardarEstadoBiblia({ seccion });
    setTimeout(vaGuardarSnapshotVisual, 120);
  } catch (e) {
    console.warn("No pude guardar sección actual:", e);
  }

  // ✅ primero cierro todo de forma fuerte
  forzarSeccionActiva(seccion);

  // ✅ botón activo del menú principal
  document.querySelectorAll("#menu .nav-btn").forEach(b => b.classList.remove("activo"));

  const btnActivo = document.querySelector(`#menu .nav-btn[onclick="irA('${seccion}')"]`);
  if (btnActivo) btnActivo.classList.add("activo");

  try {
    actualizarNavVida(seccion);
  } catch (e) {}

  // ✅ iniciales internos SOLO de la sección abierta
  if (seccion === "iglesia") {
    const estado = leerEstadoBiblia() || {};

    let subIglesiaGuardada =
      window.__IGLESIA_SUB_ACTIVA ||
      estado.subIglesia ||
      "devocionales";

    // ✅ CORRECCIÓN IMPORTANTE:
    // Antes acá se cambiaba "recursos" por "devocionales".
    // Ahora, si la app quedó guardada en Recursos y todavía no sabemos permisos
    // o el usuario no tiene permiso, vamos a Compartidos/Todo.
    if (subIglesiaGuardada === "recursos") {
      const puedeVerRecursos = !!window.__ES_ADMIN || !!window.__ES_COLABORADOR;

      if (!puedeVerRecursos) {
        window.__IGLESIA_SUB_ACTIVA = "";
        window.__RECURSOS_SUB_ACTIVA = "";

        try {
          guardarEstadoBiblia({
            seccion: "compartidos",
            subIglesia: "",
            subRecursos: ""
          });
        } catch (e) {}

        try {
          localStorage.removeItem(VA_UI_SNAPSHOT_KEY);
        } catch (e) {}

        try {
          forzarSeccionActiva("compartidos");
        } catch (e) {}

        try {
          window.cargarCompartidos?.();
        } catch (e) {}

        try {
          window.renderCompartidos?.();
        } catch (e) {}

        try {
          window.iniciarCompartidos?.();
        } catch (e) {}

        try {
          window.mostrarCompartidosSub?.("todo");
        } catch (e) {}

        try {
          window.mostrarCompartidos?.("todo");
        } catch (e) {}

        requestAnimationFrame(() => {
          try { forzarSeccionActiva("compartidos"); } catch(e) {}
          try { window.scrollTo({ top: 0, behavior: "auto" }); } catch(e) {}
        });

        setTimeout(() => {
          try { forzarSeccionActiva("compartidos"); } catch(e) {}
          try { window.mostrarCompartidosSub?.("todo"); } catch(e) {}
          try { window.mostrarCompartidos?.("todo"); } catch(e) {}
        }, 120);

        return;
      }
    }

    try {
      window.mostrarIglesiaSub?.(subIglesiaGuardada);
    } catch(e) {}

    requestAnimationFrame(() => forzarSeccionActiva("iglesia"));
    setTimeout(() => forzarSeccionActiva("iglesia"), 120);
    return;
  }

  if (seccion === "panel") {
    try { window.mostrarSeccion?.("imagenes"); } catch(e) {}

    requestAnimationFrame(() => forzarSeccionActiva("panel"));
    setTimeout(() => forzarSeccionActiva("panel"), 80);
    return;
  }

  if (seccion === "compartidos") {
    try { window.cargarCompartidos?.(); } catch(e) {}
    try { window.renderCompartidos?.(); } catch(e) {}
    try { window.iniciarCompartidos?.(); } catch(e) {}
    try { window.mostrarCompartidosSub?.("todo"); } catch(e) {}
    try { window.mostrarCompartidos?.("todo"); } catch(e) {}

    requestAnimationFrame(() => forzarSeccionActiva("compartidos"));
    setTimeout(() => forzarSeccionActiva("compartidos"), 80);
    return;
  }

  if (seccion === "biblia") {
    try { bibliaRestaurarUIAlVolver?.(); } catch(e) {}
    try { aplicarEstadoBarra?.("biblia"); } catch(e) {}
    try { mostrarTexto?.(); } catch(e) {}
    try { aplicarUIAccionesPorModo?.(); } catch(e) {}

    requestAnimationFrame(() => forzarSeccionActiva("biblia"));
    setTimeout(() => forzarSeccionActiva("biblia"), 80);
  }
};

// ================= 🔺 MODO IMAGEN ===============================
window.toggleModoImagen = () => {
  if (!uid) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }

  if (!usuarioPuedeCrearImagen()) {
    modoImagen = false;
    limpiarSeleccionImagenCompleta();
    document.body.classList.remove("modo-imagen");

    const banner = document.getElementById("bannerModoImagen");
    if (banner) banner.style.display = "none";

    aplicarUIAccionesPorModo();
    alert("Solo administradores o colaboradores pueden crear imágenes.");
    return;
  }

  modoImagen = !modoImagen;
  limpiarSeleccionImagenCompleta();

  document.body.classList.toggle("modo-imagen", modoImagen);

  const banner = document.getElementById("bannerModoImagen");
  if (banner) {
    banner.style.display = modoImagen ? "block" : "none";
  }

  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();

  mostrarTexto();
};

function abrirModalPersonalizar() {
  const m = document.getElementById("modalPersonalizar");
  if (!m) return;
  m.style.display = "flex";
  m.classList.add("abierto");
}

function cerrarModalPersonalizar() {
  const m = document.getElementById("modalPersonalizar");
  if (!m) return;
  m.style.display = "none";
  m.classList.remove("abierto");
}

// ================= 🔺 GENERAR IMAGEN ===============================
window.generarImagen = async () => {
  if (!usuarioPuedeCrearImagen()) {
    alert("Solo administradores o colaboradores pueden crear imágenes.");
    return;
  }

  if (Object.keys(seleccionImagen).length === 0) {
    alert("Seleccioná al menos un versículo");
    return;
  }

  const modal = document.getElementById("modalPersonalizar");
  if (!modal) return;

  resetModalPersonalizar();

  origenModalImagen = "biblia";
  modoImagenLibre = false;
  textoLibreImagen = "";

  modal.classList.add("solo-imagen");
  modal.classList.remove("modo-devocional");

  abrirModalPersonalizar();
  asegurarCajaTextoLibrePanel();
  setFormatoImagen("post");
  cargarFondos();
  crearListaVisualFuentes();
  bibliaCompactarControlesMobile();

  await vaImgRecalcularPreviewDespuesAbrir();
};

// ================= 🔺 FUNCIÓN NUEVA PARA ABRIR EL MODAL DESDE MI PANEL ============
window.abrirCrearImagenLibrePanel = async () => {
  if (!uid) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }

  const modal = document.getElementById("modalPersonalizar");
  if (!modal) return;

  window.__VA_IMG_EDITANDO = null;

  resetModalPersonalizar();

  origenModalImagen = "panel";
  modoImagenLibre = true;
  textoLibreImagen = "";

  modal.classList.add("solo-imagen");
  modal.classList.remove("modo-devocional");

  abrirModalPersonalizar();
  asegurarCajaTextoLibrePanel();
  setFormatoImagen("post");
  cargarFondos();
  crearListaVisualFuentes();

  textoLibreImagen = "ESCRIBÍ\nAQUÍ TU\nTEXTO";

  await vaImgRecalcularPreviewDespuesAbrir();

  requestAnimationFrame(() => {
    const previewTexto = document.getElementById("previewTexto");
    if (!previewTexto) return;

    previewTexto.focus();

    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(previewTexto);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (e) {}
  });
};

// ================= 🔺 CANCELAR CREAR / EDITAR IMAGEN ===============================
window.cancelarCrearImagen = () => {
  window.__VA_IMG_EDITANDO = null;

  // 1️⃣ resetear mientras el modal está visible
  resetModalPersonalizar();

  // 2️⃣ salir del modo imagen
  salirModoImagen();

  // ✅ limpiar modo visual del modal
  const modal = document.getElementById("modalPersonalizar");
  if (modal) modal.classList.remove("solo-imagen", "modo-devocional");
};

// ================= ✅ FINALIZAR EDICIÓN / CREACIÓN =================
window.finalizarEdicion = async (ev) => {
  if (window.__FINALIZANDO__) return;
  window.__FINALIZANDO__ = true;

  const btn = ev?.currentTarget;
  const editandoAhora = !!window.__VA_IMG_EDITANDO;
  let guardadoOK = false;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    btn.style.opacity = "0.65";
    btn.style.cursor = "wait";
  }

  try {
    // ✅ Nueva imagen: modal vacío.
    // ✅ Edición: trae título/desc/color anteriores.
    const meta = await pedirDatosImagenMeta(window.__VA_IMG_EDITANDO?.item || {});

    imagenMetaActual = meta || {
      titulo: "",
      descripcion: "",
      color: "#fff3b0"
    };

    window.__VA_IMG_META_ACTUAL = imagenMetaActual;

    // ✅ Crear consume límite.
    // ✅ Editar NO consume límite diario porque no es una imagen nueva del panel.
    if (!editandoAhora) {
      try {
        await window.vaConsumirUsoColaborador?.(
          "crearImagenBiblia",
          VA_LIMITE_COLAB_IMAGENES_DIA
        );
      } catch (limiteErr) {
        alert(limiteErr?.message || "No podés crear más imágenes por hoy.");
        return;
      }
    }

    vaImgMostrarGuardando(editandoAhora ? "Guardando edición..." : "Guardando imagen...");

    if (typeof devToast === "function") {
      devToast(editandoAhora ? "⏳ Guardando edición." : "⏳ Guardando imagen.");
    }

    await vaImgRecalcularPreviewDespuesAbrir();

    // ✅ si hay audio confirmado, subirlo antes de guardar la imagen
    if (window.__pendingAudio?.audioBase64) {
      if (typeof devToast === "function") {
        devToast("⏳ Subiendo audio...");
      }

      try {
        await window.subirPendingAudioAFirebase({ subirIglesia: false });
        console.log("✅ Audio subido y listo para unir a la imagen:", window.__lastAudioUrl);
      } catch (e) {
        console.error("❌ Error subiendo audio:", e);
        alert("No se pudo subir el audio. Probá generar la previa otra vez.");
        return;
      }
    }

    const ok = await withRenderLock(async () => {
      return await asegurarCanvasFinal({ subir: true });
    });

    if (!ok) throw new Error("No se pudo generar o guardar la imagen");

    guardadoOK = true;

    if (typeof devToast === "function") {
      devToast(editandoAhora ? "✅ Imagen editada" : "✅ Imagen guardada");
    }

    // ✅ cerrar modal de datos + cerrar modal editor + volver a Mi Panel Imágenes
    resetModalPersonalizar();
    salirModoImagen();
    vaImgAbrirPanelImagenesDespuesGuardar();

  } catch (e) {
    console.error(e);
    alert("❌ Error al guardar\n\n" + (e?.message || e));

  } finally {
    vaImgOcultarGuardando();

    window.__FINALIZANDO__ = false;

    if (guardadoOK) {
      window.__VA_IMG_EDITANDO = null;
    }

    imagenMetaActual = null;
    window.__VA_IMG_META_ACTUAL = null;

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
      btn.style.opacity = "";
      btn.style.cursor = "";
    }
  }
};

// ================= 🔺 CAMBIAR LETRA ===============================
// ✅ Router: + y - cambian según la sección visible (Biblia o ABC)
window.cambiarLetra = (delta) => {
  // =========================
  // ✅ Si estoy en ABC -> SOLO ABC
  // =========================
  const secIglesia = document.getElementById("seccion-iglesia");
  const subABC = document.getElementById("iglesia-abc");
  const estoyEnABC =
    !!(secIglesia && secIglesia.style.display !== "none" &&
       subABC && subABC.style.display !== "none");

  if (estoyEnABC) {
    window.abcFontSize = Math.max(12, Math.min(28, (window.abcFontSize || 18) + delta));
    const doc = document.getElementById("abcDoc");
    if (doc) doc.style.setProperty("--abc-font", window.abcFontSize + "px");
    return;
  }

  // =========================
  // ✅ Si NO estoy en ABC -> Biblia (tu lógica actual)
  // =========================
  size = Math.max(14, size + delta * 2);
  mostrarTexto();
};

// ================= 🔺 TOGGLE TEMA ===============================
// ================= 🌙 TOGGLE TEMA (ANIMADO + ICONO + REPINTAR) =================
window.toggleTema = () => {
  const btn = document.querySelector('#header button[onclick="toggleTema()"]');

  // animación
  if (btn) {
    btn.classList.add("animar");
    setTimeout(() => btn.classList.remove("animar"), 350);
  }

  // toggle modo
  const oscuro = document.body.classList.toggle("oscuro");
  localStorage.setItem("modoOscuro", oscuro ? "1" : "0");

  // cambiar ícono
  if (btn) btn.textContent = oscuro ? "☀️" : "🌙";

  // ✅ FIX: repintar colores de versículos YA MISMO
  mostrarTexto();

  // ✅ FIX: si el modal está abierto, refrescar preview YA MISMO
  const modal = document.getElementById("modalPersonalizar");
  if (modal && modal.style.display === "flex") {
    actualizarPreview();
  }
};

// ================= ✨ RESTAURAR MODO OSCURO + ICONO =================
(() => {
  const oscuro = localStorage.getItem("modoOscuro") === "1";
  if (oscuro) document.body.classList.add("oscuro");

  const btn = document.querySelector('#header button[onclick="toggleTema()"]');
  if (btn) btn.textContent = oscuro ? "☀️" : "🌙";
})();


// ================= 🔺 LOGOUT ===============================
window.logout = () => {
  signOut(auth).then(() => (window.location.href = "login.html"));
};

// ================= 🔺 MARCADOR ===================
// ================= 📌 BOTÓN 1: MODO MARCADOR 📌 =================
function ubicarBannerModoMarcadorDebajoTitulo() {
  const banner = document.getElementById("bannerModoMarcador");
  const barra = document.getElementById("barraTituloBiblia");

  if (!banner || !barra || !barra.parentNode) return;

  // Lo mueve debajo de la barra Génesis 1 / RV1960 / NTV
  if (banner.previousElementSibling !== barra) {
    barra.insertAdjacentElement("afterend", banner);
  }
}

window.toggleModoMarcador = () => {
  if (!uid) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }

  // si estaba modo imagen, lo apagamos
  if (modoImagen) salirModoImagen();

  modoMarcador = !modoMarcador;

if (!modoMarcador) {
    limpiarSeleccionMarcadorCompleta();
  }

  document.body.classList.toggle("modo-marcador", modoMarcador);

  // ✅ botón correcto (ahora está en la barra)
  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.toggle("activo", modoMarcador);

  // banner fijo marcador
  // banner marcador debajo de la barra libro/capítulo
  const banner = document.getElementById("bannerModoMarcador");
  if (banner) {
    ubicarBannerModoMarcadorDebajoTitulo();

    banner.innerHTML = `
      <i class="fa-solid fa-circle-check"></i>
      Seleccioná versículos para abrir una nota
    `;

    banner.style.display = modoMarcador ? "block" : "none";
  }

  // ✅ ocultar/mostrar acciones según modo
  aplicarUIAccionesPorModo();

  mostrarTexto();
  refrescarBotonGuardarMarcador();
  renderPreviewVersiculosMarcador(); // por si está abierto el form
};

// ================= 🔖 LISTA Y BUSCADOR DE MARCADORES =================

let busquedaMarcadoresLibro = "";

function marcadoresNormalizarBusqueda(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function prepararCabeceraBuscadorMarcadores() {
  const modal = document.getElementById("modalMarcadores");
  if (!modal) return;

  const card = modal.querySelector(
    ".modal-card, .modal-contenido, .modal-content, .modal-box"
  );

  if (!card) return;

  /*
    Buscamos la cabecera que contiene el título Marcadores.
    De esta manera no hace falta modificar el HTML.
  */
  const cabecera = Array.from(card.children).find(el => {
    if (!(el instanceof HTMLElement)) return false;

    if (
      el.id === "listaMarcadores" ||
      el.id === "formNuevoMarcador"
    ) {
      return false;
    }

    return marcadoresNormalizarBusqueda(
      el.textContent
    ).includes("marcadores");
  });

  if (!cabecera) return;

  let bloque = document.getElementById(
    "marcadoresCabeceraIzquierda"
  );

  if (!bloque) {
    /*
      Buscamos el título anterior que contiene
      el emoji de carpeta y la palabra Marcadores.
    */
    const tituloViejo = Array.from(
      cabecera.querySelectorAll(
        "b, strong, h1, h2, h3, span, div"
      )
    ).find(el => {
      if (el.querySelector("button")) return false;

      return marcadoresNormalizarBusqueda(
        el.textContent
      ).includes("marcadores");
    });

    bloque = document.createElement("div");
    bloque.id = "marcadoresCabeceraIzquierda";

    bloque.innerHTML = `
      <div class="marcadores-cabecera-titulo">
        <i class="fa-classic fa-solid fa-bookmark"></i>
        <span>Marcadores</span>
      </div>

      <label
        class="marcadores-busqueda-wrap"
        title="Buscar por libro"
      >
        <i class="fa-classic fa-solid fa-magnifying-glass"></i>

        <input
          id="buscarMarcadoresLibro"
          type="search"
          placeholder="Libro..."
          autocomplete="off"
          aria-label="Buscar notas por libro"
          oninput="filtrarMarcadoresPorLibro(this.value)"
        >
      </label>
    `;

    if (tituloViejo) {
      tituloViejo.replaceWith(bloque);

    } else {
      /*
        Respaldo por si el título está escrito
        directamente dentro de la cabecera.
      */
      Array.from(cabecera.childNodes).forEach(node => {
        if (
          node.nodeType === Node.TEXT_NODE &&
          marcadoresNormalizarBusqueda(
            node.textContent
          ).includes("marcadores")
        ) {
          node.remove();
        }
      });

      const botonCerrar =
        cabecera.querySelector("button");

      cabecera.insertBefore(
        bloque,
        botonCerrar || null
      );
    }
  }

  const input = document.getElementById(
    "buscarMarcadoresLibro"
  );

  if (
    input &&
    input.value !== busquedaMarcadoresLibro
  ) {
    input.value = busquedaMarcadoresLibro;
  }
}

window.filtrarMarcadoresPorLibro = function(valor = "") {
  busquedaMarcadoresLibro = String(valor || "");
  renderListaMarcadores();
};

// ================= 🔖 ABRIR MODAL MARCADORES =================

window.abrirMarcadores = () => {
  if (!uid) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }

  const modal = document.getElementById(
    "modalMarcadores"
  );

  const lista = document.getElementById(
    "listaMarcadores"
  );

  const form = document.getElementById(
    "formNuevoMarcador"
  );

  if (!modal || !lista || !form) return;

  const abierto =
    getComputedStyle(modal).display !== "none";

  if (abierto) {
    cerrarMarcadores();
    return;
  }

  /*
    Cada vez que se abre nuevamente el modal,
    comenzamos sin filtro.
  */
  busquedaMarcadoresLibro = "";

  prepararCabeceraBuscadorMarcadores();

  const inputBuscar = document.getElementById(
    "buscarMarcadoresLibro"
  );

  if (inputBuscar) {
    inputBuscar.value = "";
  }

  modal.style.display = "flex";

  form.style.display = "none";
  lista.style.display = "block";

  renderListaMarcadores();

  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");
};

// ================= ✨ edita marcador desde lista 📌=================
window.editarMarcadorDesdeLista = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  if (typeof notaPanelVieneDeCompartidos === "function" && notaPanelVieneDeCompartidos(m)) {
    mostrarToast("Esta nota fue guardada desde Compartidos y no se puede editar.");
    return;
  }

  const versiculosM = Array.isArray(m.versiculos)
    ? m.versiculos.map(Number).filter(n => !isNaN(n))
    : [];

  const esNotaLibre = versiculosM.length === 0;

  // ✅ marcamos “modo edición”
  window.__editMarcadorId = idMarcador;
  window.__editMarcadorBase = {
    ...m,
    libro: esNotaLibre ? "" : (m.libro || ""),
    capitulo: esNotaLibre ? 0 : Number(m.capitulo || 0),
    versiculos: esNotaLibre ? [] : versiculosM,
    ref: esNotaLibre ? "" : (m.ref || "")
  };

  creandoNotaLibre = esNotaLibre;

  // ✅ abrimos el formulario
  abrirFormNuevoMarcador();

  // ✅ ahora sí buscamos los elementos del formulario
  const inputTitulo = document.getElementById("marcadorTitulo");
  const inputNota = document.getElementById("marcadorNota");
  const inputColor = document.getElementById("marcadorColor");
  const chkKeep = document.getElementById("marcadorKeep");
  const txtKeep = document.getElementById("txtMarcadorKeep");

  // ✅ precargar campos
  if (inputTitulo) inputTitulo.value = m.titulo || "";
  if (inputNota) inputNota.value = m.nota || "";
  if (inputColor) inputColor.value = m.color || "#fff3b0";

  if (chkKeep) chkKeep.checked = !!(m.destacada || m.keep);

  if (txtKeep) {
    txtKeep.textContent = esNotaLibre ? "⭐ Destacar nota" : "📌 Mantener resaltado";
  }

  // ✅ color visible + real
  syncMarcadorColorUI(m.color || "#fff3b0");

  // ✅ refrescar preview para edición
  renderPreviewVersiculosMarcador();
};

// ================= ✨ Cerrar Marcadores 📌=================
window.cerrarMarcadores = () => {

  try {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
} catch(e){}
  
  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");

  const ctx = (typeof window.getMarcadorCtx === "function")
    ? window.getMarcadorCtx()
    : { origen: "biblia" };

  const estabaEditandoABC =
    ctx?.origen === "abc" &&
    form &&
    getComputedStyle(form).display !== "none";

  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }

  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";

  try {
    const secIglesia = document.getElementById("seccion-iglesia");
    const subABC = document.getElementById("iglesia-abc");
    const estoyEnABC =
      !!(secIglesia && secIglesia.style.display !== "none" &&
         subABC && subABC.style.display !== "none");

    if (estoyEnABC) {
      // ✅ si cerré el form de una nota ABC, vuelvo a ABC normal
      if (estabaEditandoABC) {
        window.__abcEditMarcadorId = null;
        window.setMarcadorCtx("biblia");
        if (typeof abcResetModoMarcador === "function") abcResetModoMarcador();
      }

      if (typeof abcAplicarUIAccionesPorModo === "function") abcAplicarUIAccionesPorModo();
      if (typeof abcHabilitarCheckUI === "function") abcHabilitarCheckUI();
      if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
      return;
    }
  } catch(e){}

  refrescarBotonGuardarMarcador();
};

function notaResumenVersiculoLista(m = {}, max = 92) {
  let txt = "";

  try {
    if (typeof notaShareTextoVersiculoMarcador === "function") {
      txt = notaShareTextoVersiculoMarcador(m);
    }
  } catch (e) {}

  txt = String(txt || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!txt) return "";

  return txt.length > max
    ? txt.slice(0, max).trim() + " (...)"
    : txt;
}

window.notaResumenVersiculoLista = notaResumenVersiculoLista;

// ================= ✨ Render Lista Marcadores 📌=================
function renderListaMarcadores() {
  const lista = document.getElementById(
    "listaMarcadores"
  );

  if (!lista) return;

  /*
    Primero reunimos todas las notas de Biblia.
    Las notas de ABC continúan usando su propia lista.
  */
  const todosItems = Object.entries(
    marcadores || {}
  )
    .map(([id, m]) => ({
      ...(m || {}),
      id
    }))
    .filter(m => m?.origen !== "abc")
    .sort(
      (a, b) =>
        Number(b.fecha || 0) -
        Number(a.fecha || 0)
    );

  const busqueda = marcadoresNormalizarBusqueda(
    busquedaMarcadoresLibro
  );

  /*
    Solo se revisan el libro y la referencia.

    No se buscan coincidencias dentro del título
    ni dentro del contenido de la nota.
  */
  const items = busqueda
    ? todosItems.filter(m => {
        const libroYReferencia =
          marcadoresNormalizarBusqueda(
            `${m.libro || ""} ${m.ref || ""}`
          );

        return libroYReferencia.includes(
          busqueda
        );
      })
    : todosItems;

  let header = "";

  if (
    modoMarcador &&
    Object.keys(
      seleccionMarcador || {}
    ).length > 0
  ) {
    header = `
      <div
        class="card-marcador nota-lista-card nota-lista-card-cta"
      >
        <div class="nota-lista-contenido">
          <div class="nota-lista-titulo">
            Guardar nuevo marcador
          </div>

          <div class="nota-lista-resumen">
            Abrí el formulario para guardar la nota con los versículos seleccionados.
          </div>
        </div>

        <div class="nota-lista-botones">
          <button
            type="button"
            class="pm-btn"
            onclick="abrirFormNuevoMarcador()"
            title="Continuar"
          >
            <i class="fa-solid fa-circle-check"></i>
          </button>
        </div>
      </div>
    `;
  }

  if (todosItems.length === 0) {
    lista.innerHTML =
      header +
      `
        <p class="muted">
          Todavía no guardaste marcadores.
        </p>
      `;

    lista.scrollTop = 0;
    lista.scrollLeft = 0;
    return;
  }

  if (items.length === 0) {
    lista.innerHTML =
      header +
      `
        <p class="muted">
          No encontré notas de ese libro.
        </p>
      `;

    lista.scrollTop = 0;
    lista.scrollLeft = 0;
    return;
  }

  lista.innerHTML =
    header +
    items.map(m => {
      const refTxt =
        m.ref ||
        (
          m.libro && m.capitulo
            ? `${m.libro} ${m.capitulo}`
            : "Nota"
        );

      const tituloTxt =
        m.titulo || "Marcador";

      /*
        Acá quitamos completamente la fecha.

        Antes se mostraba:
        referencia - fecha - título

        Ahora se muestra:
        referencia - título
      */
      const linea = marcadorEscapeHTML(
        [refTxt, tituloTxt]
          .filter(Boolean)
          .join(" - ")
      );

      const fondoNota =
        m.color || "#fff3b0";

      const colorTexto =
        typeof colorContraste === "function"
          ? colorContraste(fondoNota)
          : "#000";

      const notaVieneDeCompartidos =
        typeof notaPanelVieneDeCompartidos ===
        "function"
          ? notaPanelVieneDeCompartidos(m)
          : (
              m?.origen === "compartidos" ||
              !!m?.sourceCompKey
            );

      const puedeEditarNota =
        !notaVieneDeCompartidos;

      const resumen = marcadorEscapeHTML(
        notaResumenVersiculoLista(m, 110)
      );

      return `
        <div
          class="card-marcador nota-lista-card"
          style="
            --nota-bg:${fondoNota};
            --nota-color:${colorTexto};
          "
        >
          <div
            class="nota-lista-contenido"
            onclick="abrirMarcador('${m.id}')"
          >
            <div class="nota-lista-titulo">
              ${linea}
            </div>

            ${
              resumen
                ? `
                  <div class="nota-lista-resumen">
                    ${resumen}
                  </div>
                `
                : ``
            }
          </div>

          <div class="nota-lista-botones">
            <button
              type="button"
              class="pm-btn"
              onclick="
                event.stopPropagation();
                abrirVistaMarcadorDesdeLista(
                  '${m.id}',
                  'biblia'
                );
              "
              title="Ver nota"
            >
              <i class="fa-solid fa-rectangle-list"></i>
            </button>

            ${
              puedeEditarNota
                ? `
                  <button
                    type="button"
                    class="pm-btn"
                    onclick="
                      event.stopPropagation();
                      editarMarcadorDesdeLista(
                        '${m.id}'
                      );
                    "
                    title="Editar"
                  >
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                `
                : ``
            }
          </div>
        </div>
      `;
    }).join("");

  lista.scrollTop = 0;
  lista.scrollLeft = 0;
}

window.volverListaMarcadoresDesdeVista = function(origenLista = "biblia") {
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");

  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";

  if (origenLista === "abc" && typeof window.abcAbrirListaNotasABC === "function") {
    window.abcAbrirListaNotasABC();
    return;
  }

  renderListaMarcadores();
};

// =========================================================
// 🎧 AUDIO PARA NOTAS DE BIBLIA
// =========================================================

function notaAudioArmarTexto(m = {}) {
  const datos =
    notaShareDatosDesdeMarcador(m);

  return [
    datos.titulo || "",
    datos.referencia || "",
    datos.versiculo || "",
    datos.texto || ""
  ]
    .map(texto =>
      String(texto || "").trim()
    )
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

window.abrirAudioNota = function(
  idMarcador
) {
  const m =
    (marcadores || {})[idMarcador];

  if (!m) {
    mostrarToast?.(
      "No encontré esta nota."
    );
    return;
  }

  const texto =
    notaAudioArmarTexto(m);

  if (!texto) {
    mostrarToast?.(
      "Esta nota no tiene texto para convertir en audio."
    );
    return;
  }

  /*
    Indicamos a biblia.audio.js que esta vez
    el audio viene desde una nota.
  */
  window.__AUDIO_ORIGEN = "nota";
  window.__AUDIO_NOTA_ID = idMarcador;
  window.__AUDIO_NOTA_TEXTO = texto;

  /*
    Si la nota ya tiene un audio guardado,
    se carga en el reproductor.
  */
  window.__AUDIO_NOTA_URL =
    String(m.audioUrl || "").trim();

  window.__AUDIO_NOTA_ORIGEN_LISTA =
    m?.origen === "abc"
      ? "abc"
      : "biblia";

  if (
    typeof window.abrirModalAudio !==
    "function"
  ) {
    mostrarToast?.(
      "Todavía no cargó el sistema de audio."
    );
    return;
  }

  window.abrirModalAudio();
};

window.vaGuardarAudioNota =
  async function({
    id = "",
    url = "",
    texto = ""
  } = {}) {
    if (!uid) {
      throw new Error(
        "Necesitás iniciar sesión."
      );
    }

    if (!id || !url) {
      throw new Error(
        "Faltan los datos del audio."
      );
    }

    const actual =
      (marcadores || {})[id];

    if (!actual) {
      throw new Error(
        "No encontré la nota."
      );
    }

    const actualizado = {
      ...actual,

      audioUrl: String(url).trim(),
      audioTexto: String(texto).trim(),
      audioFecha: Date.now()
    };

    await set(
      ref(
        db,
        `marcadores/${uid}/${id}`
      ),
      actualizado
    );

    /*
      Actualizamos también la memoria local
      sin esperar nuevamente a Firebase.
    */
    marcadores[id] = actualizado;

    mostrarToast?.(
      "✅ Audio guardado en la nota"
    );

    const origenLista =
      window.__AUDIO_NOTA_ORIGEN_LISTA ||
      (
        actualizado?.origen === "abc"
          ? "abc"
          : "biblia"
      );

    /*
      Refrescamos la vista de la nota.
    */
    if (
      document
        .getElementById("modalMarcadores")
        ?.classList.contains("abierto")
    ) {
      window.abrirVistaMarcadorDesdeLista?.(
        id,
        origenLista
      );
    }

    return actualizado;
  };

window.descargarVistaMarcadorDesdeLista = async function(idMarcador, boton = null) {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  if (typeof notaShareDatosDesdeMarcador !== "function" || typeof window.notaDescargarComoImagen !== "function") {
    mostrarToast?.("No está lista la descarga de notas.");
    return;
  }

  const datos = notaShareDatosDesdeMarcador(m);
  await window.notaDescargarComoImagen(datos, `nota_${idMarcador}`, boton);
};

window.abrirVistaMarcadorDesdeLista = function(idMarcador, origenLista = "biblia") {
  const m = (marcadores || window.marcadores || {})[idMarcador];
  if (!m) return;

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");

  if (!modal || !lista) return;

  if (form) form.style.display = "none";
  lista.style.display = "block";

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  const datos = notaShareDatosDesdeMarcador(m);

  const fondoNota = String(datos.fondo || "#fff3b0").trim();
  const colorTexto = (typeof colorContraste === "function")
    ? colorContraste(fondoNota)
    : "#000";

  const titulo = marcadorEscapeHTML(datos.titulo || "Nota");
  const metaBase = datos.meta || "";
  const temaABC = m?.origen === "abc" && m?.abc?.temaTitulo
    ? `ABC · ${m.abc.temaTitulo}`
    : "";

  const meta = marcadorEscapeHTML([temaABC, metaBase].filter(Boolean).join(" · "));
  const versiculo = marcadorEscapeHTML(datos.versiculo || "");
  const nota = marcadorEscapeHTML(datos.texto || "");

  const notaVieneDeCompartidos =
    (typeof notaPanelVieneDeCompartidos === "function")
      ? notaPanelVieneDeCompartidos(m)
      : (m?.origen === "compartidos" || !!m?.sourceCompKey);

  const puedeEditarNota = !notaVieneDeCompartidos;
  const puedeUsarAudioNota =
  !!window.__ES_ADMIN ||
  !!window.__ES_COLABORADOR ||
  !!m?.audioUrl;

  lista.innerHTML = `
    <div class="nota-vista-lista">
      <div class="nota-vista-top">
        <button
          type="button"
          class="pm-btn"
          onclick="volverListaMarcadoresDesdeVista('${origenLista}')"
          title="Volver"
        >
          <i class="fa-solid fa-arrow-left"></i>
        </button>

        <div class="nota-vista-titulo">
          <b>${titulo}</b>
          ${meta ? `<span>${meta}</span>` : ``}
        </div>
      </div>

      <div
        class="nota-vista-card"
        style="background:${fondoNota} !important; color:${colorTexto} !important;"
      >
        ${versiculo ? `<div class="nota-vista-versiculo">${versiculo}</div>` : ``}
        ${nota ? `<div class="nota-vista-texto">${nota}</div>` : `<div class="nota-vista-texto muted">Esta nota no tiene texto escrito.</div>`}
      </div>

      <div class="nota-vista-acciones">

        ${puedeUsarAudioNota ? `
          <button
            type="button"
            class="pm-btn"
            onclick="abrirAudioNota('${idMarcador}')"
            title="${
              m?.audioUrl
                ? "Escuchar o regenerar audio"
                : "Crear audio"
            }"
          >
            <i class="fa-solid fa-headphones"></i>
          </button>
        ` : ``}
      
        <button
          type="button"
          class="pm-btn"
          onclick="descargarVistaMarcadorDesdeLista('${idMarcador}', this)"
          title="Descargar imagen"
        >
          <i class="fa-solid fa-download"></i>
        </button>

        <button
          type="button"
          class="pm-btn"
          onclick="abrirCompartirMarcador('${idMarcador}')"
          title="Compartir"
        >
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        ${puedeEditarNota ? `
          <button
            type="button"
            class="pm-btn"
            onclick="editarMarcadorDesdeLista('${idMarcador}')"
            title="Editar"
          >
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        ` : ``}
      </div>
    </div>
  `;
};

// ================= ✨ RENDER PREVIEW VERSICULOS MARCADOR 📌=================
function renderPreviewVersiculosMarcador() {
  const box = document.getElementById("previewVersiculosMarcador");
  if (!box) return;

  const form = document.getElementById("formNuevoMarcador");
  const formVisible = form && getComputedStyle(form).display !== "none";

  if (!formVisible || creandoNotaLibre) {
    box.innerHTML = "";
    return;
  }

  const ctx = window.getMarcadorCtx
    ? window.getMarcadorCtx()
    : { origen: "biblia" };

  if (ctx.origen === "abc") {
    box.innerHTML = "";
    return;
  }

  const base = window.__editMarcadorBase || null;
  const items = getItemsMarcadorParaForm(base);

  if (!items.length) {
    box.innerHTML = "";
    return;
  }

  const refCompleta = referenciaMarcadorEnOrden(items);

  const partes = items.map(it => {
    const vv = bibliaData.find(x =>
      x.Libro === it.Libro &&
      Number(x.Capitulo) === Number(it.Capitulo) &&
      Number(x.Versiculo) === Number(it.Versiculo)
    );

    const txt = vv ? getTextoVersiculo(vv) : "";

    return `
      <div class="marcador-preview-versiculo">
        ${marcadorEscapeHTML(txt)}
      </div>
    `;
  }).join("");

  box.innerHTML = `
    <div class="marcador-preview-ref">
      ${marcadorEscapeHTML(refCompleta)}
    </div>

    <div class="marcador-preview-textos">
      ${partes}
    </div>
  `;
}

// ================= ✨ Abrir Form Nuevo Marcador 📌=================
window.abrirFormNuevoMarcador = () => {
  window.setMarcadorCtx("biblia");

  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const info = document.getElementById("infoMarcadorNuevo");
  const chkKeep = document.getElementById("marcadorKeep");
  const txtKeep = document.getElementById("txtMarcadorKeep");

  if (!lista || !form || !info) return;

  const base = window.__editMarcadorBase || null;
  const items = getItemsMarcadorParaForm(base);
  const esLibre = creandoNotaLibre || (!!base && !items.length);

  if (esLibre) {
    info.textContent = `🗒 Nota (sin versículo) · ${new Date().toLocaleDateString("es-AR")}`;

    if (chkKeep) chkKeep.checked = !!(base?.destacada || base?.keep);
    if (txtKeep) txtKeep.textContent = "⭐ Destacar nota";

  } else {
    const refTxt = referenciaMarcadorEnOrden(items);

    const hoy = new Date().toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    info.textContent = `📌 ${refTxt} · ${hoy}`;

    if (chkKeep) chkKeep.checked = !!base?.keep;
    if (txtKeep) txtKeep.textContent = "📌 Mantener resaltado";
  }

  if (!window.__editMarcadorId) {
    const inputTitulo = document.getElementById("marcadorTitulo");
    const inputNota = document.getElementById("marcadorNota");

    if (inputTitulo) inputTitulo.value = "";
    if (inputNota) inputNota.value = "";

    syncMarcadorColorUI(colorActual || "#fff3b0");

    if (chkKeep) chkKeep.checked = true;
  }

  lista.style.display = "none";
  form.style.display = "block";

  renderPreviewVersiculosMarcador();
};

// ================= ❌ Cancelar Nuevo Marcador 📌=================
window.cancelarNuevoMarcador = () => {
  // cerrar modal marcadores y volver a lista
  const modal = document.getElementById("modalMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const lista = document.getElementById("listaMarcadores");

  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;
  creandoNotaLibre = false;

  if (form) form.style.display = "none";
  if (lista) lista.style.display = "block";

  // ✅ si estoy en Panel (seccion-panel visible) NO dejo modo marcador prendido
  const seccionPanel = document.getElementById("seccion-panel");
  const estoyEnPanel = seccionPanel && seccionPanel.style.display !== "none";
  if (estoyEnPanel) {
    salirModoMarcadorLimpio();
  }

  // ✅ SI ESTOY EN ABC → volver a modo normal (sin marcador)
  try {
    const ctx = (typeof window.getMarcadorCtx === "function")
      ? window.getMarcadorCtx()
      : { origen: "biblia" };

    const secIglesia = document.getElementById("seccion-iglesia");
    const subABC = document.getElementById("iglesia-abc");

    const estoyEnABC =
      !!(secIglesia && secIglesia.style.display !== "none" &&
         subABC && subABC.style.display !== "none");

    if (estoyEnABC && ctx.origen === "abc") {

      window.__abcEditMarcadorId = null;

      // volver contexto normal
      if (typeof window.setMarcadorCtx === "function") {
        window.setMarcadorCtx("biblia");
      }

      // resetear modo marcador
      if (typeof abcResetModoMarcador === "function") {
        abcResetModoMarcador();
      }

      // reconstruir UI ABC
      if (typeof abcAplicarUIAccionesPorModo === "function") {
        abcAplicarUIAccionesPorModo();
      }

      if (typeof abcHabilitarCheckUI === "function") {
        abcHabilitarCheckUI();
      }

      if (typeof abcMarcarSeleccionUI === "function") {
        abcMarcarSeleccionUI();
      }

      return;
    }

  } catch(e) {}

};

// ================= ✨ Guardar Nuevo Marcador 📌=================
async function guardarNuevoMarcador() {
  try {
    if (!uid) {
      window.abrirLoginParaGuardarMiPanel();
      return;
    }

    const titulo = (document.getElementById("marcadorTitulo")?.value || "").trim();
    const nota = (document.getElementById("marcadorNota")?.value || "").trim();
    const color = document.getElementById("marcadorColor")?.value || "#fff3b0";
    const keep = !!document.getElementById("marcadorKeep")?.checked;
    const destacada = creandoNotaLibre ? keep : false;

    if (!titulo) {
      mostrarToast("Poné un título 🙏");
      return;
    }

    const editId = window.__editMarcadorId || null;
    const base = window.__editMarcadorBase || null;
    const esNotaLibre = !!creandoNotaLibre;

    const itemsMarcador = esNotaLibre
      ? []
      : getItemsMarcadorParaForm(base);

    if (!creandoNotaLibre && itemsMarcador.length === 0) {
      mostrarToast("Seleccioná al menos 1 versículo 📌");
      return;
    }

    const primero = itemsMarcador[0] || null;

    const libro = esNotaLibre ? "" : (primero?.Libro || "");
    const capitulo = esNotaLibre ? 0 : Number(primero?.Capitulo || 0);

const versiculosDetalle = itemsMarcador.map(it => {
  const idItem = it.id || `${it.Libro}_${it.Capitulo}_${it.Versiculo}`;

  return {
    id: idItem,
    libro: it.Libro,
    capitulo: Number(it.Capitulo),
    versiculo: Number(it.Versiculo)
  };
});

    const seleccionOrdenFinal = itemsMarcador.map(it =>
      it.id || `${it.Libro}_${it.Capitulo}_${it.Versiculo}`
    );

    // ✅ Compatibilidad con el sistema viejo:
    // dejamos en versiculos solo los del primer libro/capítulo.
    // La referencia completa queda en ref y el orden real en versiculosDetalle.
    const versiculos = itemsMarcador
      .filter(it =>
        it.Libro === libro &&
        Number(it.Capitulo) === Number(capitulo)
      )
      .map(it => Number(it.Versiculo))
      .filter(n => !isNaN(n));

    const refCompleta = esNotaLibre
      ? ""
      : referenciaMarcadorEnOrden(itemsMarcador);

    const textoVersiculoCompleto = esNotaLibre
      ? ""
      : textoVersiculosMarcadorPlano(itemsMarcador);

    const data = {
      titulo,
      nota,
      color,
      keep: creandoNotaLibre ? false : keep,
      destacada,

      // compatibilidad vieja
      libro,
      capitulo,
      versiculos,

      // ✅ nuevo sistema ordenado
      versiculosDetalle,
      seleccionOrden: seleccionOrdenFinal,
      ref: refCompleta,
      textoVersiculo: textoVersiculoCompleto,

      fecha: Date.now()
    };

    const id = editId || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const ruta = `marcadores/${uid}/${id}`;

    await set(ref(db, ruta), data);

    limpiarSeleccionMarcadorCompleta();
    creandoNotaLibre = false;
    ultimoMarcadorAplicado = data.keep ? data : null;

    window.__editMarcadorId = null;
    window.__editMarcadorBase = null;

    cerrarMarcadores();

    mostrarToast(editId ? "✅ Marcador actualizado" : "✅ Marcador guardado");
    mostrarTexto();
    refrescarBotonGuardarMarcador();

    if (typeof salirModoMarcadorLimpio === "function") {
      salirModoMarcadorLimpio();
    } else {
      modoMarcador = false;
      limpiarSeleccionMarcadorCompleta();
      document.body.classList.remove("modo-marcador");

      const btnPin = document.getElementById("btnModoMarcadorBarra");
      if (btnPin) btnPin.classList.remove("activo");

      const banner = document.getElementById("bannerModoMarcador");
      if (banner) banner.style.display = "none";

      aplicarUIAccionesPorModo();
      refrescarBotonGuardarMarcador();
      renderPreviewVersiculosMarcador();
      mostrarTexto();
    }

  } catch (e) {
    console.error("❌ Error guardando marcador:", e);

    const msg = String(e?.message || "");
    const code = String(e?.code || "");

    if (msg.includes("PERMISSION_DENIED") || code.includes("permission-denied")) {
      mostrarToast("⛔ No tenés permiso para guardar (reglas Firebase)");
    } else {
      mostrarToast("❌ No se pudo guardar el marcador");
    }
  }
}

// ================= ✨ Abrir Marcador 📌=================
window.abrirMarcador = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  const items = itemsMarcadorDesdeData(m);
  const primero = items[0];

  if (!primero) return;

  libroSel.value = primero.Libro;
  cargarCapitulos();
  capSel.value = primero.Capitulo;
  mostrarTexto();

  ultimoMarcadorAplicado = m.keep ? m : null;

  cerrarMarcadores();
  setTimeout(mostrarTexto, 50);

  const idV = `${primero.Libro}_${primero.Capitulo}_${primero.Versiculo}`;

  setTimeout(() => {
    const el = document.querySelector(`.versiculo[data-id="${CSS.escape(idV)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 120);
};

// ================= ✨ Refrescar Botones Marcador (✅ y 📁) 📌=================
function refrescarBotonGuardarMarcador() {
  const btnGuardar = document.getElementById("btnGuardarMarcador");
  const btnLista = document.getElementById("btnListaMarcadores");

  if (!btnGuardar) return;

  const haySeleccion = getIdsMarcadorEnOrden().length > 0;

  btnGuardar.innerHTML = `
    <i class="fa-solid fa-circle-check"></i>
    <span>Abrir Nota</span>
  `;

  btnGuardar.setAttribute("aria-label", "Abrir nota");

  btnGuardar.style.display = (modoMarcador && haySeleccion) ? "inline-flex" : "none";
  btnGuardar.disabled = !haySeleccion;
  btnGuardar.style.opacity = haySeleccion ? "1" : "0.4";

  if (btnLista) {
    btnLista.style.display = modoMarcador ? "none" : "inline-flex";
  }

  aplicarUIAccionesPorModo();
}

// ================= ✨ Guardar Marcador Rapido 📌 (abre formulario directo)=================
window.guardarMarcadorRapido = () => {
  if (!uid) {
    window.abrirLoginParaGuardarMiPanel();
    return;
  }
  if (!modoMarcador) return;

  const seleccion = Object.keys(seleccionMarcador || {});
  if (seleccion.length === 0) {
    mostrarToast("Seleccioná al menos 1 versículo 📌");
    return;
  }

  // ✅ Abrir modal
  abrirMarcadores();

  // ✅ Pasar directo al formulario
  setTimeout(() => {
    abrirFormNuevoMarcador();
  }, 0);
};

// ================= 🔺RENDER PANEL MARCADORES con orden: fecha o libro/capítulo 📌===================
// (dejá donde ya esté esto en tu archivo)
let ordenMarcadores = "fecha"; // "fecha" | "biblia"

// (dejá estas)
let modoEliminarMarcadores = false;
let seleccionEliminarMarcadores = {}; // {id:true}

// (agregá esta si no existe en otro lado)
let filtroNotasPanel = "todas"; // "todas" | "con" | "sin" | "abc"
let menuFiltroNotasPanelAbierto = false;

function renderPanelMarcadores() {
  const panel = document.getElementById("panel-marcadores");
  if (!panel) return;

  const items = Object.entries(marcadores || {}).map(([id, m]) => ({ ...m, id }));

  const ordenados = items.sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  const filtrados = ordenados.filter(m => {
    const tieneNota = !!(m.nota && String(m.nota).trim());
    if (!tieneNota) return false;

    const esABC = (m?.origen === "abc");
    const cantVers = (m.versiculos || []).length;

    if (filtroNotasPanel === "todas") return true;
    if (filtroNotasPanel === "abc") return esABC;
    if (filtroNotasPanel === "con") return !esABC && cantVers > 0;
    if (filtroNotasPanel === "sin") return !esABC && cantVers === 0;

    return true;
  });

  const cantSel = Object.keys(seleccionEliminarMarcadores || {}).length;

  const tituloPanel =
    filtroNotasPanel === "todas"
      ? "📝 Todas las notas"
      : filtroNotasPanel === "con"
        ? "📌 Notas de Biblia"
        : filtroNotasPanel === "sin"
          ? "🗒 Notas libres"
          : "🎓 Notas ABC";

  const filtroActualIcono =
    filtroNotasPanel === "todas"
      ? `<i class="fa-solid fa-list-check"></i>`
      : filtroNotasPanel === "con"
        ? `<i class="fa-solid fa-thumbtack"></i>`
        : filtroNotasPanel === "sin"
          ? `<i class="fa-solid fa-sheet-plastic"></i>`
          : `<i class="fa-solid fa-graduation-cap"></i>`;

  panel.innerHTML = `
    <div class="panel-marcadores-bar">
      <div class="pm-left">
        <b>${tituloPanel}</b>
        <div class="pm-sub muted" style="font-size:12px; margin-top:2px;">
          orden: más recientes primero
        </div>
      </div>

      <div class="pm-right" style="position:relative;">
        <button type="button" class="pm-btn" onclick="abrirNotaLibre()" title="Agregar nota">
          <i class="fa-solid fa-square-plus"></i>
        </button>

        <button type="button" class="pm-btn" onclick="toggleMenuFiltroNotasPanel()" title="Filtrar notas">
          ${filtroActualIcono}
        </button>

        <button type="button" class="pm-btn" onclick="toggleModoEliminarMarcadores()" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>

    ${menuFiltroNotasPanelAbierto ? `
      <div style="display:flex; gap:16px; justify-content:flex-end; align-items:flex-start; margin:-4px 0 12px 0; flex-wrap:wrap;">
        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('todas')" title="Todas">
          <span class="pm-filter-icon ${filtroNotasPanel === "todas" ? "activo" : ""}">
            <i class="fa-solid fa-list-check"></i>
          </span>
          <span class="pm-filter-label">Todas</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('con')" title="Biblia">
          <span class="pm-filter-icon ${filtroNotasPanel === "con" ? "activo" : ""}">
            <i class="fa-solid fa-thumbtack"></i>
          </span>
          <span class="pm-filter-label">Biblia</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('sin')" title="Libres">
          <span class="pm-filter-icon ${filtroNotasPanel === "sin" ? "activo" : ""}">
            <i class="fa-solid fa-sheet-plastic"></i>
          </span>
          <span class="pm-filter-label">Libres</span>
        </button>

        <button type="button" class="pm-filter-chip" onclick="setFiltroNotasPanel('abc')" title="ABC">
          <span class="pm-filter-icon ${filtroNotasPanel === "abc" ? "activo" : ""}">
            <i class="fa-solid fa-graduation-cap"></i>
          </span>
          <span class="pm-filter-label">ABC</span>
        </button>
      </div>
    ` : ``}

    ${modoEliminarMarcadores && cantSel > 0 ? `
      <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
        <button type="button" onclick="confirmarEliminarMarcadores()"
          style="border:none; border-radius:999px; padding:10px 14px; cursor:pointer; background:#d9534f; color:#fff;">
          Eliminar (${cantSel})
        </button>
      </div>
    ` : ``}

    ${filtrados.length ? filtrados.map(m => {
      const fechaTxt = m.fecha ? new Date(m.fecha).toLocaleString("es-AR") : "";

      let refTxt = "Nota libre";

      // ✅ ABC
      if (m?.origen === "abc") {
        const temaABC = String(m?.abc?.temaTitulo || "").trim();
        refTxt = temaABC ? `ABC - ${temaABC}` : "ABC";
      }

      // ✅ Biblia
      else if ((m.versiculos || []).length > 0) {
        if (m.ref && String(m.ref).trim()) {
          refTxt = m.ref.trim();
        } else if (m.libro && m.capitulo) {
          const vers = (m.versiculos || []).map(Number).sort((a, b) => a - b);

          if (vers.length === 1) {
            refTxt = `${m.libro} ${m.capitulo}:${vers[0]}`;
          } else if (vers.length > 1) {
            refTxt = `${m.libro} ${m.capitulo}:${vers[0]}-${vers[vers.length - 1]}`;
          } else {
            refTxt = `${m.libro} ${m.capitulo}`;
          }
        }
      }

      const checked = !!(seleccionEliminarMarcadores && seleccionEliminarMarcadores[m.id]);

      let textoVers = "";
      let textoABC = "";

      if (m?.origen === "abc") {
        textoABC = String(m?.abcTexto || "").trim();
      }

const textoGuardado = String(m.textoVersiculo || m.textoBiblico || "").trim();

      if (textoGuardado) {
        textoVers = textoGuardado;
      } else {
        const items = itemsMarcadorDesdeData(m);

        const partes = items.map(it => {
          const vv = bibliaData.find(x =>
            x.Libro === it.Libro &&
            Number(x.Capitulo) === Number(it.Capitulo) &&
            Number(x.Versiculo) === Number(it.Versiculo)
          );

          return vv ? getTextoVersiculo(vv) : "";
        }).filter(Boolean);

        if (partes.length) textoVers = partes.join(" ");
      }

      const bgDestacada = (m.destacada || m.keep) ? (m.color || "#fff3b0") : "";
      const colorTextoDestacada = bgDestacada ? colorContraste(bgDestacada) : "";

      const notaVieneDeCompartidos =
  m?.origen === "compartidos" ||
  !!m?.sourceCompKey;

const notaEstaPublicadaEnCompartidos =
  !notaVieneDeCompartidos &&
  !!notasCompartidasPanel[m.id];

      const puedeEditarNota = !notaVieneDeCompartidos;

      return `
        <div class="card-marcador" style="${bgDestacada ? `background:${bgDestacada} !important; color:${colorTextoDestacada} !important; border:1px solid rgba(0,0,0,.10);` : ""}">
          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-size:13px;">
              <b>${m.destacada ? "⭐ " : ""}${m.titulo || "Marcador"}</b><br>
              <span class="${bgDestacada ? "" : "muted"}">${refTxt} · ${fechaTxt}</span>
            </div>

            <div style="display:flex; gap:8px; align-items:center;">
              ${modoEliminarMarcadores ? `
                <input type="checkbox" ${checked ? "checked":""}
                  onchange="toggleSeleccionEliminarMarcador('${m.id}', this.checked)">
              ` : `
                ${(((m.versiculos || []).length > 0) || m?.origen === "abc") ? `
                  <button type="button" class="pm-btn" onclick="abrirMarcadorDesdePanel('${m.id}')" title="Volver">
                    <i class="fa-solid fa-reply"></i>
                  </button>
                ` : ""}

               ${puedeEditarNota ? `
  <button type="button" class="pm-btn" onclick="editarMarcadorEnPanel('${m.id}')" title="Editar">
    <i class="fa-solid fa-pen-to-square"></i>
  </button>
` : ``}

<button type="button"
  class="pm-btn pm-share-main ${notaEstaPublicadaEnCompartidos ? "pm-btn-compartido" : ""}"
  onclick="abrirCompartirMarcador('${m.id}')"
  title="${notaEstaPublicadaEnCompartidos ? "Ya publicada en Compartidos · tocar para compartir nuevamente" : "Compartir"}">
  
  <span class="pm-share-icon-wrap">
    <i class="fa-solid fa-share-nodes"></i>

    ${notaEstaPublicadaEnCompartidos ? `
      <span class="pm-share-mini-check">
        <i class="fa-solid fa-check"></i>
      </span>
    ` : ``}
  </span>
</button>
              `}
            </div>
          </div>

          ${textoVers ? `<div class="nota preview-versiculos-marcador" style="margin-top:8px;">${textoVers}</div>` : ""}
          ${(!textoVers && textoABC) ? `<div class="nota preview-versiculos-marcador" style="margin-top:8px;">${textoABC}</div>` : ""}
          ${m.nota ? `<div class="nota">${m.nota}</div>` : ""}
        </div>
      `;
    }).join("") : `<p style="opacity:.75">Todavía no tenés notas para este filtro.</p>`}
  `;
}

window.toggleMenuFiltroNotasPanel = () => {
  menuFiltroNotasPanelAbierto = !menuFiltroNotasPanelAbierto;
  renderPanelMarcadores();
};

window.setFiltroNotasPanel = (filtro) => {
  filtroNotasPanel = filtro || "todas";
  menuFiltroNotasPanelAbierto = false;
  renderPanelMarcadores();
};

// ================= TOGGLES PANEL (iconos tipo sol/luna) =================
window.toggleOrdenMarcadoresPanel = () => {
  ordenMarcadores = (ordenMarcadores === "fecha") ? "biblia" : "fecha";
  renderPanelMarcadores();
};

window.abrirMarcadorDesdePanel = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  const esNotaLibre = !(m.versiculos || []).length;

if (esNotaLibre) {
  mostrarToast("Esta nota es libre y no tiene versículo para volver");
  return;
}

  // ✅ si es ABC, ir a Iglesia > ABC
  if (m.origen === "abc" && m.abc) {
    irA("iglesia"); // tu router principal
    setTimeout(async () => {
      // mostrar sub-sección abc (ajustá si tu función se llama distinto)
      if (typeof window.mostrarIglesiaSub === "function") window.mostrarIglesiaSub("abc");
      if (typeof window.mostrarABC === "function") await window.mostrarABC();

      // cargar el tema
      if (typeof m.abc.temaIndex === "number") {
        abcIndex = m.abc.temaIndex;
        await cargarABCTema(true);
      }

      // seleccionar bloque y abrir nota
      if (m.abcBid) {
        abcSeleccionado = m.abcBid;
        abcMarcarSeleccionUI();
        const doc = document.getElementById("abcDoc");
        const el = doc ? doc.querySelector(`.abc-block[data-bid="${m.abcBid}"]`) : null;
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"center" });
        setTimeout(()=> abcAbrirNota(), 150);
      }
    }, 0);
    return;
  }

  // ✅ si NO es ABC, es Biblia como antes
  irA("biblia");
  setTimeout(() => {
    abrirMarcador(idMarcador);
  }, 0);
};

// ================= Editar marcador desde Mi Panel (reusa tu modal) 📌===================
window.editarMarcadorEnPanel = (idMarcador) => {
  const m = (marcadores || {})[idMarcador];
  if (!m) return;

  if (notaPanelVieneDeCompartidos(m)) {
    mostrarToast("Esta nota fue guardada desde Compartidos y no se puede editar.");
    return;
  }

  const base = baseEdicionMarcadorCompleta(m, idMarcador);
  const esNotaLibre = itemsMarcadorDesdeData(base).length === 0;

  window.__editMarcadorId = idMarcador;
  window.__editMarcadorBase = base;
  creandoNotaLibre = esNotaLibre;

  const modal = document.getElementById("modalMarcadores");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("abierto");
    modal.setAttribute("aria-hidden", "false");
  }

  setTimeout(() => {
    abrirFormNuevoMarcador();

    const inputTitulo = document.getElementById("marcadorTitulo");
    const inputNota = document.getElementById("marcadorNota");
    const chkKeep = document.getElementById("marcadorKeep");
    const txtKeep = document.getElementById("txtMarcadorKeep");

    if (inputTitulo) inputTitulo.value = m.titulo || "";
    if (inputNota) inputNota.value = m.nota || "";

    syncMarcadorColorUI(m.color || "#fff3b0");

    if (chkKeep) chkKeep.checked = !!(m.destacada || m.keep);

    if (txtKeep) {
      txtKeep.textContent = esNotaLibre ? "⭐ Destacar nota" : "📌 Mantener resaltado";
    }

    renderPreviewVersiculosMarcador();
  }, 0);
};

// ================= 🔺 TOGGLE MODO ELIMINAR MARCADORES ===================
window.toggleModoEliminarMarcadores = () => {
  modoEliminarMarcadores = !modoEliminarMarcadores;
  if (!modoEliminarMarcadores) seleccionEliminarMarcadores = {};
  renderPanelMarcadores();
};

// ================= 🔺 SELECCIONAR ELIMINAR MARCADOR ===================
window.toggleSeleccionEliminarMarcador = (id, checked) => {
  if (checked) seleccionEliminarMarcadores[id] = true;
  else delete seleccionEliminarMarcadores[id];
  renderPanelMarcadores();
};


// ================= 🔺 LIMPUAR RESALTADRO DE ABC NOTAS ==============
async function limpiarResaltadoABCDeMarcador(marcador) {
  try {
    if (!marcador) return;
    if (marcador?.origen !== "abc") return;

    const temaIndex = Number(marcador?.abc?.temaIndex);
    const bids = Array.isArray(marcador?.abcBids)
      ? marcador.abcBids
      : (marcador?.abcBid ? [marcador.abcBid] : []);

    if (!Number.isFinite(temaIndex) || !bids.length) return;

    const fb = window.__FB || {};
    const api = window.__FB_API || {};
    const db = fb.db;
    const refFn = api.ref;
    const removeFn = api.remove;

    if (!db || !refFn || !removeFn) return;

    // 1) borrar de Firebase
    for (const bid of bids) {
      try {
        await removeFn(refFn(db, `abcResaltados/${uid}/${temaIndex}/${bid}`));
      } catch (e) {
        console.warn("No pude borrar resaltado ABC:", bid, e);
      }
    }

    // 2) limpiar cache global si existe
    if (window.abcResaltadosCache) {
      bids.forEach(bid => delete window.abcResaltadosCache[bid]);
    }

    // 3) si estoy viendo ese tema, limpiar visualmente YA
    const doc = document.getElementById("abcDoc");
    if (doc) {
      bids.forEach(bid => {
        const el = doc.querySelector(`.abc-block[data-bid="${bid}"]`);
        if (el && typeof abcLimpiarFondoBloque === "function") {
          abcLimpiarFondoBloque(el);
        }
      });
    }

    // 4) refrescar UI ABC
    if (typeof abcRebuildBloqueadosKeep === "function") abcRebuildBloqueadosKeep();
    if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();

  } catch (e) {
    console.warn("No pude limpiar resaltado ABC del marcador:", e);
  }
}

// ================= 🔺 CONFIRMAR ELIMINAR MARCADORES ===================
window.confirmarEliminarMarcadores = async () => {
  const ids = Object.keys(seleccionEliminarMarcadores);
  if (ids.length === 0) return;

  const ok = confirm(`¿Seguro que querés borrar ${ids.length} marcador(es)?\n\nEsto NO se puede deshacer.`);
  if (!ok) return;

  try {
    for (const id of ids) {
      const marcador = (marcadores || {})[id] || (window.marcadores || {})[id] || null;

      // ✅ si es ABC, borrar también su resaltado guardado
      await limpiarResaltadoABCDeMarcador(marcador);

      // ✅ si era Biblia y justo quedó aplicado en memoria, limpiarlo
      if (
        marcador &&
        marcador?.origen !== "abc" &&
        ultimoMarcadorAplicado &&
        ultimoMarcadorAplicado.libro === marcador.libro &&
        Number(ultimoMarcadorAplicado.capitulo) === Number(marcador.capitulo) &&
        JSON.stringify((ultimoMarcadorAplicado.versiculos || []).map(Number).sort((a,b)=>a-b)) ===
        JSON.stringify((marcador.versiculos || []).map(Number).sort((a,b)=>a-b))
      ) {
        ultimoMarcadorAplicado = null;
      }

      // ✅ borrar marcador
      await remove(ref(db, `marcadores/${uid}/${id}`));

      // ✅ limpiar cache local
      if (window.marcadores && window.marcadores[id]) delete window.marcadores[id];
      if (marcadores && marcadores[id]) delete marcadores[id];
    }

    seleccionEliminarMarcadores = {};
    modoEliminarMarcadores = false;

    // ✅ reconstruir estado ABC
    if (typeof abcRebuildBloqueadosKeep === "function") abcRebuildBloqueadosKeep();

    // ✅ refrescar ABC si estoy ahí
    if (typeof abcMarcarSeleccionUI === "function") abcMarcarSeleccionUI();
    if (typeof abcAplicarUIAccionesPorModo === "function") abcAplicarUIAccionesPorModo();

    // ✅ refrescar Biblia / Panel
    mostrarTexto();
    renderPanelMarcadores();
    refrescarBotonGuardarMarcador();

    // ✅ extra: si estoy en ABC actual, asegurar limpieza visual completa
const doc = document.getElementById("abcDoc");
if (doc) {
  doc.querySelectorAll(".abc-block").forEach(b => {
    const bid = b.dataset.bid;
    const cache = window.abcResaltadosCache || {};
    if (!cache[bid]) {
      b.style.setProperty("background", "transparent", "important");
      b.style.setProperty("background-color", "transparent", "important");

      b.querySelectorAll("*").forEach(x => {
        x.style.setProperty("background", "transparent", "important");
        x.style.setProperty("background-color", "transparent", "important");
      });
    }
  });
}
    mostrarToast("🗑️ Marcadores eliminados");
  } catch (e) {
    console.error(e);
    mostrarToast("❌ No se pudo borrar");
  }
};

// ================= 🔺 LIMPIAR PINTADO DE MARCADOR ELIMINADO ===================
async function limpiarPintadoDeMarcadorEliminado(idMarcador, marcador) {
  try {
    if (!marcador) return;

    // =========================
    // ✅ BIBLIA: si era el último aplicado, limpiarlo
    // =========================
    if (ultimoMarcadorAplicado && (
      (ultimoMarcadorAplicado.id && ultimoMarcadorAplicado.id === idMarcador) ||
      (
        ultimoMarcadorAplicado.libro === marcador.libro &&
        Number(ultimoMarcadorAplicado.capitulo) === Number(marcador.capitulo) &&
        JSON.stringify((ultimoMarcadorAplicado.versiculos || []).map(Number).sort((a,b)=>a-b)) ===
        JSON.stringify((marcador.versiculos || []).map(Number).sort((a,b)=>a-b))
      )
    )) {
      ultimoMarcadorAplicado = null;
    }

    // =========================
    // ✅ ABC: borrar resaltados guardados de esa nota
    // =========================
    if (marcador?.origen === "abc") {
      const bids = Array.isArray(marcador?.abcBids)
        ? marcador.abcBids
        : (marcador?.abcBid ? [marcador.abcBid] : []);

      const temaIndex = marcador?.abc?.temaIndex;

      if (uid && bids.length && typeof temaIndex === "number") {
        const { db } = FB();
        const { ref, remove } = API();

        if (db && ref && remove) {
          for (const bid of bids) {
            try {
              await remove(ref(db, `abcResaltados/${uid}/${temaIndex}/${bid}`));
            } catch(e) {
              console.warn("No pude borrar resaltado ABC:", bid, e);
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("No pude limpiar pintado del marcador eliminado:", e);
  }
}

function syncMarcadorColorUI(hex = "#fff3b0") {
  const inputColor = document.getElementById("marcadorColor");
  const host = document.getElementById("marcadorColorHost");

  if (inputColor) {
    inputColor.value = hex;
    inputColor.setAttribute("value", hex);
    inputColor.dispatchEvent(new Event("input", { bubbles: true }));
    inputColor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  if (host) {
    host.style.setProperty("--pickr-color", hex);
    host.style.background = hex;
    host.dataset.color = hex;
    host.setAttribute("data-color", hex);
  }

  try {
    if (host && host._pickr) {
      host._pickr.setColor(hex);
    }
  } catch (e) {
    console.warn("No pude sincronizar Pickr de marcador:", e);
  }
}

window.syncMarcadorColorUI = syncMarcadorColorUI;

// ================= ✅ NUEVA NOTA SIN VERSÍCULO =================
window.abrirNotaLibre = () => {
  creandoNotaLibre = true;
  window.__editMarcadorId = null;
  window.__editMarcadorBase = null;
  window.setMarcadorCtx("biblia");

  const modal = document.getElementById("modalMarcadores");
  const lista = document.getElementById("listaMarcadores");
  const form = document.getElementById("formNuevoMarcador");
  const info = document.getElementById("infoMarcadorNuevo");
  const inputTitulo = document.getElementById("marcadorTitulo");
  const inputNota = document.getElementById("marcadorNota");
  const chkKeep = document.getElementById("marcadorKeep");
  const txtKeep = document.getElementById("txtMarcadorKeep");

  if (!modal || !lista || !form || !info) return;

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  info.textContent = `🗒 Nota libre · ${new Date().toLocaleDateString("es-AR")}`;

  if (inputTitulo) inputTitulo.value = "";
  if (inputNota) inputNota.value = "";

  // ✅ color default REAL + visual
  syncMarcadorColorUI("#fff3b0");

  // ✅ destacar nota por default
  if (chkKeep) chkKeep.checked = true;
  if (txtKeep) txtKeep.textContent = "⭐ Destacar nota";

  lista.style.display = "none";
  form.style.display = "block";

  renderPreviewVersiculosMarcador();

  // ✅ pequeño refuerzo visual por si Pickr repinta tarde
  requestAnimationFrame(() => {
    syncMarcadorColorUI("#fff3b0");
  });
};

function panelImgMoverAddDebajoGaleria(){
  const row = document.getElementById("panelImgIndexRow");
  const top = document.getElementById("panelImgTopRow");

  if (!row || !top) return;

  top.classList.add("panelImgTopRowDebajo");

  // ✅ mueve el + debajo de la galería
  if (top.previousElementSibling !== row) {
    row.insertAdjacentElement("afterend", top);
  }
}

function panelImgRenderAddBoton() {
  const topRow = document.getElementById("panelImgTopRow");
  if (!topRow) return;

  // ✅ Si no hay usuario o no es admin, no mostramos el +
  if (!uid || !window.__ES_ADMIN) {
    topRow.innerHTML = "";
    return;
  }

  // ✅ Reconstruye el botón aunque Safari/iPhone haya restaurado
  // un HTML viejo o aunque otra función haya vaciado panelImgTopRow.
  topRow.innerHTML = `
    <button
      id="btnPanelImgNuevo"
      type="button"
      class="btn-primary panel-add-redondo"
      onclick="event.preventDefault(); event.stopPropagation(); abrirCrearImagenLibrePanel(); return false;"
      title="Crear imagen"
      aria-label="Crear imagen"
    >
      <i class="fa-solid fa-circle-plus"></i>
    </button>
  `;

  panelImgMoverAddDebajoGaleria();
}

/* =========================================================
   RENDER REUTILIZABLE: IMAGEN DE MI PANEL / BIBLIA
   - Lo usa Mi Panel ahora.
   - Lo va a poder usar Compartidos después sin rehacer la card.
   ========================================================= */

function panelImgHtml(v = "") {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function panelImgAttr(v = "") {
  return panelImgHtml(v)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function panelImgJs(v = "") {
  return String(v ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");
}

function panelImgNormalizarUrlRaw(url = "") {
  let s = String(url || "").trim();
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;

  if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(s)) {
    return "https://" + s.replace(/^(?:\.\/|\/)+/, "");
  }

  return s;
}

function panelImagenRenderCardHTML(it = {}, opciones = {}) {
  const idPrefix = opciones.idPrefix ?? "panelImgBig_";
  const domId = opciones.domId ?? `${idPrefix}${it.id || ""}`;

  const mostrarDescargar = opciones.mostrarDescargar ?? true;
  const mostrarCompartir = opciones.mostrarCompartir ?? true;
  const mostrarEliminar = opciones.mostrarEliminar ?? true;

  // ✅ para Compartidos después: podremos pasar otro delete,
  // que borre solo de Compartidos y NO de Mi Panel.
  const eliminarHtmlPersonalizado = opciones.eliminarHtml || "";

  const extraAcciones = opciones.extraAcciones || "";
  const extraFinal = opciones.extraFinal || "";

  const tituloMeta = String(it.titulo || "").trim();
const descripcionMeta = String(it.descripcion || "").trim();
const tieneMetaImagen = !!(tituloMeta || descripcionMeta);

const colorMeta = vaImgMetaHex(it.color || it.colorFondo || "#fff3b0") || "#fff3b0";
const textoMeta = vaImgMetaContraste(colorMeta);

const metaHtml = tieneMetaImagen ? `
  <div class="panel-img-meta" style="background:${panelImgAttr(colorMeta)}; color:${panelImgAttr(textoMeta)};">
    ${tituloMeta ? `<div class="panel-img-meta-title">${panelImgHtml(tituloMeta)}</div>` : ``}
    ${descripcionMeta ? `<div class="panel-img-meta-desc">${panelImgHtml(descripcionMeta)}</div>` : ``}
  </div>
` : ``;

  const urlRaw = panelImgNormalizarUrlRaw(it.url || it.shareUrl || "");
  const urlAttr = panelImgAttr(urlRaw);
  const urlJs = panelImgJs(urlRaw);

  const audioRaw = panelImgNormalizarUrlRaw(
  it.audioGithubUrl ||
  it.audioUrl ||
  it.audio ||
  ""
);

const audioAttr = panelImgAttr(audioRaw);

  const itemId = panelImgJs(it.id || "");

  const eliminarHtml = eliminarHtmlPersonalizado || (mostrarEliminar ? `
    <button
      class="btn-danger panel-img-delete-corner"
      type="button"
      onclick="eliminarImagenPanel('${itemId}')"
      aria-label="Eliminar"
      title="Eliminar"
      style="
        position:absolute;
        right:10px;
        bottom:10px;
        width:28px;
        height:28px;
        min-width:28px;
        min-height:28px;
        padding:0;
        border-radius:999px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        opacity:.65;
        z-index:3;
      "
    >
      <i class="fa-solid fa-trash"></i>
    </button>
  ` : ``);

const cardKey = domId || `${idPrefix}${it.id || Date.now()}`;
window.__VA_PANEL_IMG_ITEMS[cardKey] = {
  ...it,
  id: it.id || "",
  url: urlRaw
};
const cardKeyJs = panelImgJs(cardKey);
  
  return `
    <div
      class="devBigCard"
      id="${panelImgAttr(domId)}"
      data-panel-img-card-id="${panelImgAttr(it.id || "")}"
style="position:relative; ${tieneMetaImagen ? `background:${panelImgAttr(colorMeta)};` : ``}"
>
 ${metaHtml}
 <img src="${urlAttr}" alt="Imagen generada" loading="lazy">

${audioRaw ? `
  <div class="devBigAudioBox">
    <audio controls preload="none" src="${audioAttr}"></audio>
  </div>
` : ``}

<div class="devBigActions">
        ${mostrarDescargar ? `
          <button class="btn-primary" type="button"
       onclick="panelImagenAccionCard('${cardKeyJs}', 'descargar')"
            aria-label="Descargar PNG"
            title="Descargar PNG">
            <i class="fa-solid fa-download"></i>
          </button>
        ` : ``}

        ${mostrarCompartir ? `
          <button class="btn-primary" type="button"
      onclick="panelImagenAccionCard('${cardKeyJs}', 'compartir')"
            aria-label="Compartir"
            title="Compartir">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        ` : ``}

        ${extraAcciones}
      </div>

      ${eliminarHtml}

      ${extraFinal}
    </div>
  `;
}

// ✅ función pública para que Compartidos pueda reutilizarla después
window.panelImagenRenderCardHTML = panelImagenRenderCardHTML;

// ================= 🔺 RENDERPANELIMAGENES ===================
function renderPanelImagenes(data) {
  const grid = document.getElementById("grid-imagenes"); // compatibilidad
  const vacio = document.getElementById("imagenes-vacio");
  const topRow = document.getElementById("panelImgTopRow");

  if (!uid) {
  if (topRow) topRow.innerHTML = "";
  if (indexRow) indexRow.innerHTML = "";

  if (vacio) vacio.style.display = "none";

  if (feed) {
    feed.innerHTML = `
      <div class="panel-vacio-login">
        Puedes loguearte para guardar aquí tus devocionales preferidos,
        las publicaciones que te gusten, las notas que generes y más.
      </div>
    `;
  }

  return;
}
  
  const indexRow = document.getElementById("panelImgIndexRow");
  const feed = document.getElementById("panelImgFeed");

  if (!vacio || !indexRow || !feed) return;
    panelImgMoverAddDebajoGaleria();
  if (grid) grid.innerHTML = "";

  const items = Object.entries(data || {})
    .map(([id, obj]) => ({ id, ...(obj || {}) }))
    .sort((a, b) => (b.fecha || 0) - (a.fecha || 0));

  function esc(txt = "") {
    return String(txt)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function capitalizarCitaBonitaPanel(s){
    s = String(s || "").trim();
    if (!s) return "";

    return s
      .toLocaleLowerCase("es")
      .split(/\s+/)
      .map(palabra => {
        if (!palabra) return palabra;
        if (/^\d+$/.test(palabra)) return palabra;
        return palabra.charAt(0).toLocaleUpperCase("es") + palabra.slice(1);
      })
      .join(" ");
  }

  function normalizarUrlPanel(url){
    let s = String(url || "").trim();
    if (!s) return "";

    if (/^https?:\/\//i.test(s)) return esc(s);

    if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(s)) {
      s = "https://" + s.replace(/^(?:\.\/|\/)+/, "");
    }

    s = s.replace(/^https:\//i, "https://");
    s = s.replace(/^http:\//i, "http://");

    return esc(s);
  }

  function esDevocional(it){
    return it?.origen === "devocional" || it?.tipoTexto === "devocional";
  }

  function esLibrePanel(it){
    return !esDevocional(it) && it?.tipoTexto === "libre";
  }

function refBonitaPanel(it){
  const tituloImg = String(it.titulo || "").trim();
if (tituloImg) return tituloImg;
  const cita = capitalizarCitaBonitaPanel(it.cita || "");
  const refDirecta = String(it.ref || "").trim();

  let refBiblia = "";
  if (refDirecta) {
    refBiblia = refDirecta;
  } else if (it.libro && it.capitulo) {
    const vers = Array.isArray(it.versiculos)
      ? it.versiculos.map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b)
      : [];

    refBiblia = vers.length
      ? `${it.libro} ${it.capitulo}:${formatearVersiculosComoRango(vers)}`
      : `${it.libro} ${it.capitulo}`;
  }

  const versiculo = capitalizarCitaBonitaPanel(it.versiculo || "");
  const libre = String(it.textoLibre || "").trim();

  if (cita) return cita;
  if (refBiblia) return refBiblia;
  if (versiculo) return versiculo.length > 60 ? versiculo.slice(0, 60) + "…" : versiculo;
  if (esLibrePanel(it) && libre) return libre.length > 60 ? libre.slice(0, 60) + "…" : libre;
  return "Imagen";
}

panelImgRenderAddBoton();

  if (!items.length) {
    vacio.style.display = "block";
    indexRow.innerHTML = "";
    feed.innerHTML = "";
    return;
  }

  vacio.style.display = "none";

  indexRow.innerHTML = items.map(it => {
    const refTxt = esc(refBonitaPanel(it));
    const fechaTxt = it.fecha ? new Date(it.fecha).toLocaleDateString("es-AR") : "";
    const url = normalizarUrlPanel(it.url || "");

    return `
      <div class="devIndexCard" onclick="document.getElementById('panelImgBig_${it.id}')?.scrollIntoView({behavior:'smooth', block:'start'})">
        <div class="devIndexBar devIndexBarTop">${refTxt}</div>

        <div class="devIndexImgWrap">
          ${url ? `<img src="${url}" loading="lazy">` : `<div class="devIndexImgFallback">Sin imagen</div>`}
        </div>

        <div class="devIndexBar devIndexBarBottom">${fechaTxt}</div>
      </div>
    `;
  }).join("");

  // feed grande abajo
  // feed grande abajo
  feed.innerHTML = items.map(it => {
    const idJs = String(it.id || "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'");

 const yaPublicado = panelImagenPublicadaActiva(it.id, it);

    const esDevocionalPanel = (
      String(it.tipoTexto || "").toLowerCase() === "devocional" ||
      String(it.origen || "").toLowerCase().includes("devocional") ||
      !!it.devocionalKey
    );

    const vieneDeCompartidosPanel = panelImagenVieneDeCompartidos(it);

    const puedeEditarImagenPanel = (
      !esDevocionalPanel &&
      !vieneDeCompartidosPanel &&
      (
        String(it.tipoTexto || "").toLowerCase() === "libre" ||
        String(it.tipoTexto || "").toLowerCase() === "biblia" ||
        vaImgItemsDesdePanelItem(it).length > 0
      )
    );

    const botonEditarHTML = puedeEditarImagenPanel ? `
      <button
        class="btn-primary"
        type="button"
        onclick="editarImagenPanel('${idJs}')"
        aria-label="Editar imagen"
        title="Editar imagen"
      >
        <i class="fa-solid fa-pen-to-square"></i>
      </button>
    ` : ``;

    const botonCompartidosHTML = (esDevocionalPanel || vieneDeCompartidosPanel) ? "" : `
      <button
        class="btn-primary btn-panel-compartidos ${yaPublicado ? "activo" : ""}"
        type="button"
        onclick="publicarImagenPanelEnCompartidos('${idJs}')"
        aria-label="Publicar en Compartidos"
        title="${yaPublicado ? "Ya publicado en Compartidos" : "Publicar en Compartidos"}"
        style="position:relative; overflow:visible;"
      >
        <i class="fa-solid fa-icons"></i>

        ${yaPublicado ? `
          <span
            style="
              position:absolute;
              left:72%;
              bottom:-7px;
              transform:translateX(-50%);
              width:14px;
              height:14px;
              border-radius:999px;
              background:#8dbdff;
              color:#fff;
              display:flex;
              align-items:center;
              justify-content:center;
              box-shadow:0 0 0 2px #fff;
              line-height:1;
              pointer-events:none;
              z-index:2;
            "
          >
            <i class="fa-solid fa-check" style="font-size:8px; line-height:1;"></i>
          </span>
        ` : ``}
      </button>
    `;

    return panelImagenRenderCardHTML(it, {
      idPrefix: "panelImgBig_",
      mostrarDescargar: true,
      mostrarCompartir: true,
      mostrarEliminar: true,

      extraAcciones: botonEditarHTML + botonCompartidosHTML
    });
  }).join("");
}

// ================= 🔺 CAPITULO ANTERIOR ===================
window.capituloAnterior = () => {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  const libroActual = libroSel.value;
  const idxLibroActual = libros.indexOf(libroActual);

  // 1) si todavía hay capítulo anterior dentro del mismo libro
  if (capSel.selectedIndex > 0) {
    capSel.selectedIndex--;

    mostrarTexto({ irArriba: false, guardar: true });

    requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollCapituloAnterior || 0,
        behavior: "auto"
      });
    });
    return;
  }

  // 2) si está en capítulo 1, ir al libro anterior en su último capítulo
  if (idxLibroActual > 0) {
    const libroAnterior = libros[idxLibroActual - 1];

    libroSel.value = libroAnterior;

    const capsLibroAnterior = [...new Set(
      bibliaData
        .filter(v => v.Libro === libroAnterior)
        .map(v => Number(v.Capitulo))
    )].sort((a, b) => a - b);

    const ultimoCapitulo = capsLibroAnterior[capsLibroAnterior.length - 1] || 1;

    cargarCapitulos({
      capituloPreferido: ultimoCapitulo,
      irArriba: false,
      guardar: true
    });

    // ✅ al cambiar al libro anterior, quedar abajo del todo
    requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "auto"
      });
    });
  }

  // 3) si ya está en Génesis 1, no hace nada
};

// ================= 🔺 CAPITULO SIGUIENTE ===================
window.capituloSiguiente = () => {
  const libros = [...new Set(bibliaData.map(v => v.Libro))];
  const libroActual = libroSel.value;
  const idxLibroActual = libros.indexOf(libroActual);

  // 📌 guardo dónde estaba antes de avanzar
  scrollCapituloAnterior = window.scrollY || document.documentElement.scrollTop || 0;

  // 1) si todavía hay capítulo siguiente dentro del mismo libro
  if (capSel.selectedIndex < capSel.options.length - 1) {
    capSel.selectedIndex++;

    mostrarTexto({ irArriba: false, guardar: true });

    requestAnimationFrame(() => {
      irArribaBiblia();
    });
    return;
  }

  // 2) si ya estaba en el último capítulo, pasar al siguiente libro capítulo 1
  if (idxLibroActual >= 0 && idxLibroActual < libros.length - 1) {
    const siguienteLibro = libros[idxLibroActual + 1];

    libroSel.value = siguienteLibro;

    cargarCapitulos({
      capituloPreferido: 1,
      irArriba: false,
      guardar: true
    });

    requestAnimationFrame(() => {
      irArribaBiblia();
    });
  }

  // 3) si ya está en Apocalipsis 22, no hace nada
};

// ================= 🔍 TOGGLE FILTROS BIBLIA =================
window.toggleFiltrosBiblia = () => {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  if (!wrap) return;

  const abierto = wrap.classList.contains("abierto");

  if (abierto) {
    cerrarFiltrosBiblia(true); // tocar botón otra vez = cancelar
  } else {
    abrirFiltrosBiblia();
  }
};

// ================= CERRAR FILTROS AL TOCAR AFUERA =================
document.addEventListener("click", (e) => {
  const wrap = document.getElementById("wrapFiltrosBiblia");
  const btn = document.getElementById("btnToggleFiltros");
  const titulo = document.getElementById("titulo");

  if (!wrap) return;
  if (!wrap.classList.contains("abierto")) return;

  if (
    wrap.contains(e.target) ||
    (btn && btn.contains(e.target)) ||
    (titulo && titulo.contains(e.target))
  ) {
    return;
  }

  cerrarFiltrosBiblia(true); // afuera = cancelar
});


// ================= 🔺 MI PANEL: COMPARTIDOS / ABC / RECURSOS ===================

function panelEsc(txt = "") {
  return String(txt ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function panelFechaBonita(ts) {
  if (!ts) return "";
  try {
    return new Date(Number(ts)).toLocaleDateString("es-AR");
  } catch {
    return "";
  }
}

function panelItemsFromObj(obj) {
  return Object.entries(obj || {})
    .map(([id, data]) => ({ id, ...(data || {}) }))
    .sort((a, b) => Number(b.ts || b.fecha || 0) - Number(a.ts || a.fecha || 0));
}

window.abrirPanelUrl = function(urlCodificada) {
  const url = decodeURIComponent(String(urlCodificada || ""));
  if (!url) {
    alert("Este elemento no tiene archivo para abrir.");
    return;
  }

  window.open(url, "_blank");
};

window.abrirPanelEdicion = function(edicionId) {
  if (!edicionId) return;

  if (typeof window.abrirPresentacionEdicion === "function") {
    window.abrirPresentacionEdicion(edicionId);
    return;
  }

  // respaldo por si Ediciones.js todavía no terminó de cargar
  const base = `${location.origin}${location.pathname}`;
  window.open(`${base}?ver=edicion&id=${encodeURIComponent(edicionId)}`, "_blank");
};

window.eliminarPanelRecursoGuardado = async function(id) {
  if (!id) return;
  if (!confirm("¿Quitar este recurso de Mi Panel?")) return;

  try {
    const uid = window.__UID;
    if (!uid) throw new Error("Usuario no disponible");

    await remove(ref(db, `panelRecursos/${uid}/${id}`));
  } catch (e) {
    console.error(e);
    alert("No pude quitar este recurso de Mi Panel.");
  }
};

window.eliminarPanelEdicionGuardada = async function(id) {
  if (!id) return;
  if (!confirm("¿Quitar este compartido de Mi Panel?")) return;

  try {
    const uid = window.__UID;
    if (!uid) throw new Error("Usuario no disponible");

    await remove(ref(db, `panelEdiciones/${uid}/${id}`));
  } catch (e) {
    console.error(e);
    alert("No pude quitar este compartido de Mi Panel.");
  }
};

function renderPanelCompartidosGuardados() {
  const panel = document.getElementById("panel-compartidos");
  if (!panel) return;

  const items = panelItemsFromObj(panelEdicionesGuardadas);

  if (!items.length) {
    panel.innerHTML = `<p style="opacity:.75;">Todavía no guardaste compartidos en Mi Panel.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-folder-grid">
      ${items.map(it => {
        const titulo = panelEsc(it.titulo || "Compartido");
        const portada = panelEsc(it.portadaUrl || "");
        const fecha = panelFechaBonita(it.ts);

        return `
          <article class="panel-folder-card">
            <button type="button" class="panel-folder-main" onclick="abrirPanelEdicion('${panelEsc(it.edicionId || it.id)}')">
              <div class="panel-folder-icon panel-folder-cover">
                ${
                  portada
                    ? `<img src="${portada}" alt="${titulo}" loading="lazy">`
                    : `<i class="fa-solid fa-icons"></i>`
                }
              </div>

              <div class="panel-folder-info">
                <b>${titulo}</b>
                <span>Compartido guardado${fecha ? " · " + fecha : ""}</span>
              </div>
            </button>

            <button type="button" class="panel-folder-delete" onclick="eliminarPanelEdicionGuardada('${panelEsc(it.id)}')" title="Quitar">
              <i class="fa-solid fa-trash"></i>
            </button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderPanelABCGuardados() {
  const panel = document.getElementById("panel-abc");
  if (!panel) return;

  const items = panelItemsFromObj(panelRecursosGuardados)
    .filter(it =>
      it.tipo === "abc" ||
      it.recursoTipo === "abc" ||
      String(it.id || "").startsWith("abc_")
    );

  if (!items.length) {
    panel.innerHTML = `<p style="opacity:.75;">Todavía no guardaste carpetas de ABC en Mi Panel.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-folder-grid">
      ${items.map(it => {
        const titulo = panelEsc(it.titulo || "ABC");
        const fecha = panelFechaBonita(it.ts);
        const url = encodeURIComponent(it.html || "");

        return `
          <article class="panel-folder-card">
            <button type="button" class="panel-folder-main" onclick="abrirPanelUrl('${url}')">
              <div class="panel-folder-icon">
                <i class="fa-solid fa-font"></i>
              </div>

              <div class="panel-folder-info">
                <b>${titulo}</b>
                <span>ABC guardado${fecha ? " · " + fecha : ""}</span>
              </div>
            </button>

            <button type="button" class="panel-folder-delete" onclick="eliminarPanelRecursoGuardado('${panelEsc(it.id)}')" title="Quitar">
              <i class="fa-solid fa-trash"></i>
            </button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderPanelRecursosGuardados() {
  const panel = document.getElementById("panel-recursos");
  if (!panel) return;

  const items = panelItemsFromObj(panelRecursosGuardados)
    .filter(it =>
      !(
        it.tipo === "abc" ||
        it.recursoTipo === "abc" ||
        String(it.id || "").startsWith("abc_")
      )
    );

  if (!items.length) {
    panel.innerHTML = `<p style="opacity:.75;">Todavía no guardaste recursos en Mi Panel.</p>`;
    return;
  }

  panel.innerHTML = `
    <div class="panel-folder-grid">
      ${items.map(it => {
        const tipo = panelEsc((it.recursoTipo || it.tipo || "recurso").toUpperCase());
        const titulo = panelEsc(it.titulo || "Recurso");
        const fecha = panelFechaBonita(it.ts);
        const url = encodeURIComponent(it.html || "");

        return `
          <article class="panel-folder-card">
            <button type="button" class="panel-folder-main" onclick="abrirPanelUrl('${url}')">
              <div class="panel-folder-icon">
                <i class="fa-solid fa-shield-heart"></i>
              </div>

              <div class="panel-folder-info">
                <b>${titulo}</b>
                <span>${tipo}${fecha ? " · " + fecha : ""}</span>
              </div>
            </button>

            <button type="button" class="panel-folder-delete" onclick="eliminarPanelRecursoGuardado('${panelEsc(it.id)}')" title="Quitar">
              <i class="fa-solid fa-trash"></i>
            </button>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

// ================= 🔺 PANEL ===================
window.mostrarSeccion = (tipo) => {
  // ✅ Mi Panel solo puede manejar sus pestañas si realmente estamos en Mi Panel
  if (!document.body.classList.contains("en-panel")) return;

  if (!uid) {
  mostrarPanelVisitante();
  return;
}

  // ✅ refuerzo: no permitir que Iglesia/Compartidos queden visibles abajo
  if (typeof forzarSeccionActiva === "function") {
    forzarSeccionActiva("panel");
  }

  const permitidas = ["imagenes", "marcadores", "compartidos"];
  if (!permitidas.includes(tipo)) tipo = "imagenes";

  permitidas.forEach(s => {
    const el = document.getElementById("panel-" + s);
    if (el) {
      el.style.setProperty("display", s === tipo ? "block" : "none", "important");
    }
  });

  if (tipo === "marcadores") {
    try { renderPanelMarcadores(); } catch(e) { console.warn(e); }
  }

  if (tipo === "compartidos") {
    try { renderPanelCompartidosGuardados(); } catch(e) { console.warn(e); }
  }

  if (tipo === "abc") {
    try { renderPanelABCGuardados(); } catch(e) { console.warn(e); }
  }

  if (tipo === "recursos") {
    try { renderPanelRecursosGuardados(); } catch(e) { console.warn(e); }
  }

  // ✅ marcar tab activo SOLO en Panel
  const tabsPanel = document.querySelectorAll("#seccion-panel .panel-tabs button");
  tabsPanel.forEach(b => b.classList.remove("activo"));

  const btn = document.querySelector(`#seccion-panel .panel-tabs button[onclick="mostrarSeccion('${tipo}')"]`);
  if (btn) btn.classList.add("activo");

  // ✅ segundo refuerzo por si algún render tarde intenta reabrir otra sección
  requestAnimationFrame(() => {
    if (typeof forzarSeccionActiva === "function") {
      forzarSeccionActiva("panel");
    }
  });
};

// ================= 🔺 IR A LOGIN ===================
window.irALogin = () => {
  window.location.href = "login.html";
};

// ================= 🔺 CONSERVAR TAMAÑO AL CAMBIAR ESTILO ===================
// ✅ Los botones de estilo no deben agrandar ni achicar la letra solos.
// El tamaño vuelve a calcularse automáticamente cuando cambia el texto/versículo.
function conservarTamanoAlCambiarEstilo() {
  const inp = document.getElementById("personalizarTamaño");

  if (inp && inp.value !== "") {
    userSetFontSize = true;
  }
}

// ================= 🔺 TEXTO MAYUSCULAR ===================
window.toggleUpper = () => {
  conservarTamanoAlCambiarEstilo();

  textStyle.upper = !textStyle.upper;

  const b = document.getElementById("btnUpper");
  if (b) b.classList.toggle("activo", textStyle.upper);

  actualizarPreview();
};

// ================= 🔺 TEXTO NEGRITA ===================
window.toggleBold = () => {
  conservarTamanoAlCambiarEstilo();

  textStyle.bold = !textStyle.bold;

  const b = document.getElementById("btnBold");
  if (b) b.classList.toggle("activo", textStyle.bold);

  actualizarPreview();
};

// ================= 🔺 TEXTO ITALIC ===================
window.toggleItalic = () => {
  conservarTamanoAlCambiarEstilo();

  textStyle.italic = !textStyle.italic;

  const b = document.getElementById("btnItalic");
  if (b) b.classList.toggle("activo", textStyle.italic);

  actualizarPreview();
};

// ================= 🔺 TEXTO UNDERLINE ===================
window.toggleUnderline = () => {
  conservarTamanoAlCambiarEstilo();

  textStyle.underline = !textStyle.underline;

  const b = document.getElementById("btnUnderline");
  if (b) b.classList.toggle("activo", textStyle.underline);

  actualizarPreview();
};
  
// ================= 🔺 SET FORMATO IMAGEN ===========================
window.setFormatoImagen = tipo => {
  formatoImagenActual = (tipo === "story") ? "story" : "post";

  const preview = document.getElementById("previewImagen");
  if (!preview) return;

  preview.classList.remove("preview-post", "preview-story");
  preview.classList.add(formatoImagenActual === "story" ? "preview-story" : "preview-post");

  const bToggle = document.getElementById("btnFormatoToggle");
 if (bToggle) {
  bToggle.title = formatoImagenActual === "story" ? "Cambiar a post" : "Cambiar a story";

  // ✅ Cambiar icono dinámicamente
  bToggle.innerHTML = formatoImagenActual === "story"
    ? '<i class="fa-solid fa-mobile"></i>'   // story
    : '<i class="fa-solid fa-tablet"></i>';  // post
}

  actualizarPreview();

  if (typeof posicionarListaFuentes === "function") {
    const lf = document.getElementById("listaFuentes");
    if (lf && lf.classList.contains("abierto")) posicionarListaFuentes();
  }
};

window.toggleFormatoImagen = function() {
  const siguiente = formatoImagenActual === "post" ? "story" : "post";
  setFormatoImagen(siguiente);
};

function bibliaCompactarControlesMobile() {
  const boxFormato = document.getElementById("boxFormato");
  const rowA = document.getElementById("rowA");

  if (!boxFormato || !rowA) return;

  // ✅ Post/Story SIEMPRE va en la fila de wrapper/opacidad/tamaño.
  // No lo mandamos más a rowB porque rowB es Fuentes / Aa / B / I / U.
  if (boxFormato.parentElement !== rowA) {
    rowA.insertBefore(boxFormato, rowA.firstChild);
  }
}

if (!window.__bibliaCompactarControlesResize) {
  window.__bibliaCompactarControlesResize = true;
  window.addEventListener("resize", () => {
    bibliaCompactarControlesMobile();
  });
}

// ================= 🔺 CAMBIAR TAMAÑO (+/-) LIBRE ===========================
window.cambiarTamanoPreview = (delta) => {
  userSetFontSize = true; // ✅ al tocar +/-, ya es manual

  const inp = document.getElementById("personalizarTamaño");
  if (!inp) return;

  const step = 0.5; // ✅ medio punto
  const cur = Number(inp.value || 32);
  const next = cur + (delta * step);

  inp.value = String(next);
  actualizarPreview();
};

// ===============================
// ✅ Estado de barra por sección (Biblia vs ABC)
// ===============================
window.__barraState = window.__barraState || {
  bibliaOculta: false,
  abcOculta: false
};

function estoyEnABCAhora(){
  const secIglesia = document.getElementById("seccion-iglesia");
  const subABC = document.getElementById("iglesia-abc");
  return !!(secIglesia && secIglesia.style.display !== "none" &&
            subABC && subABC.style.display !== "none");
}

function ctxBarraActual(){
  return estoyEnABCAhora() ? "abc" : "biblia";
}

function aplicarEstadoBarra(ctx){
  const bar = document.getElementById("accionesBiblia");
  const btn = document.getElementById("btnMostrarBarra");
  if (!bar || !btn) return;

  const oculta = (ctx === "abc") ? !!window.__barraState.abcOculta
                                 : !!window.__barraState.bibliaOculta;

  // clase global (ok) PERO la manejamos según contexto
  document.body.classList.toggle("barra-oculta", oculta);

  // ✅ regla: si barra visible => botón flotante NO
  // ✅ si barra oculta  => botón flotante SÍ
  bar.style.display = oculta ? "none" : "";
  btn.style.display = oculta ? "inline-flex" : "none";
  btn.style.opacity = oculta ? "0.55" : "0.55"; // tu default
}

window.aplicarEstadoBarra = aplicarEstadoBarra;

// ================= 🔺 OCLTAR BARRA DE ACCIONES ===========================
let timerBarra = null;

window.ocultarBarraAcciones = () => {
  const ctx = ctxBarraActual();

  if (ctx === "abc") window.__barraState.abcOculta = true;
  else window.__barraState.bibliaOculta = true;

  aplicarEstadoBarra(ctx);

  // 🔥 después de unos segundos lo dejo más transparente
  clearTimeout(timerBarra);
  timerBarra = setTimeout(() => {
    const btn = document.getElementById("btnMostrarBarra");
    if (btn) btn.style.opacity = "0.35";
  }, 2500);
};

// ================= 🔺 MOSTRAR BARRA DE ACCIONES ===========================
window.mostrarBarraAcciones = () => {
  const ctx = ctxBarraActual();

  if (ctx === "abc") window.__barraState.abcOculta = false;
  else window.__barraState.bibliaOculta = false;

  clearTimeout(timerBarra);
  aplicarEstadoBarra(ctx);
};

// ================= 🔺 COMPARTIR NOTA COMO IMAGEN PNG ===========================

let __compartirMarcadorId = null;

window.__notaShareFiles = window.__notaShareFiles || new Map();

function notaShareColorContraste(color = "#fff3b0") {
  const c = String(color || "#fff3b0").trim();

  if (c.startsWith("rgb")) {
    const nums = c.match(/\d+/g)?.map(Number) || [255, 255, 255];
    const lum = (0.299 * nums[0]) + (0.587 * nums[1]) + (0.114 * nums[2]);
    return lum > 155 ? "#000000" : "#ffffff";
  }

  let hex = c.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map(x => x + x).join("");
  }

  const r = parseInt(hex.slice(0, 2), 16) || 255;
  const g = parseInt(hex.slice(2, 4), 16) || 255;
  const b = parseInt(hex.slice(4, 6), 16) || 255;

  const lum = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return lum > 155 ? "#000000" : "#ffffff";
}

function notaShareNombreArchivo(titulo = "nota") {
  const limpio = String(titulo || "nota")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 46);

  return `nota_${limpio || "vida_abundante"}.png`;
}

function notaShareFondoPantallaActual() {
  const ids = document.body.classList.contains("en-panel")
    ? ["fondoPanel", "fondoCompartidos", "fondoBiblia"]
    : ["fondoCompartidos", "fondoPanel", "fondoBiblia"];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;

    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      return bg;
    }
  }

  return "";
}

function notaShareExtraerUrlFondo(cssBackground = "") {
  const match = String(cssBackground || "").match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || "";
}

async function notaShareAplicarFondoSeguro(stage) {
  // ✅ Fondo base seguro mientras se prepara la imagen real
  stage.style.backgroundImage =
    "linear-gradient(145deg, rgba(255,214,232,.82), rgba(209,238,255,.82))";

  const cssFondo = notaShareFondoPantallaActual();
  const urlRaw = notaShareExtraerUrlFondo(cssFondo);

  if (!urlRaw || typeof fetchPanelImagenBlob !== "function") return;

  try {
    const urlAbsoluta = new URL(urlRaw, window.location.href).href;

    // ✅ Usa el Worker/proxy que ya tenés en biblia.js.
    // Así html2canvas no intenta leer R2 directamente y no choca con CORS.
    const blob = await fetchPanelImagenBlob(urlAbsoluta, "fondo_nota.jpg");
    const objectUrl = URL.createObjectURL(blob);

    stage.__notaShareFondoObjectUrl = objectUrl;

    stage.style.backgroundImage = `
      linear-gradient(rgba(255,255,255,.40), rgba(255,255,255,.40)),
      url("${objectUrl}")
    `;
  } catch (e) {
    console.warn("No pude cargar el fondo visual de la nota. Uso fondo suave.", e);
  }
}

function notaShareRangoVersiculos(numeros = []) {
  const nums = [...new Set(
    (numeros || [])
      .map(Number)
      .filter(n => Number.isFinite(n))
  )].sort((a, b) => a - b);

  if (!nums.length) return "";

  const rangos = [];
  let inicio = nums[0];
  let fin = nums[0];

  for (let i = 1; i < nums.length; i++) {
    const actual = nums[i];

    if (actual === fin + 1) {
      fin = actual;
      continue;
    }

    rangos.push(inicio === fin ? `${inicio}` : `${inicio}-${fin}`);
    inicio = actual;
    fin = actual;
  }

  rangos.push(inicio === fin ? `${inicio}` : `${inicio}-${fin}`);

  return rangos.join(" y ");
}

function notaShareTextoVersiculoMarcador(m = {}) {
  if (m?.origen === "abc") {
    return String(m.abcTexto || "").trim();
  }

  const guardado = String(m.textoVersiculo || m.textoBiblico || "").trim();
  if (guardado) return guardado;

  const items = itemsMarcadorDesdeData(m);
  if (!items.length) return "";

  return textoVersiculosMarcadorPlano(items);
}

function notaShareReferenciaMarcador(m = {}) {
  if (m.ref) return String(m.ref).trim();

  if (m.libro && m.capitulo && (m.versiculos || []).length) {
    const rango = notaShareRangoVersiculos(m.versiculos);
    return `${m.libro} ${m.capitulo}:${rango}`;
  }

  if (m.libro && m.capitulo) {
    return `${m.libro} ${m.capitulo}`;
  }

  return "Nota";
}

function notaShareFechaHora(ts) {
  if (!ts) return "";

  try {
    return new Date(Number(ts)).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function notaShareDatosDesdeMarcador(m = {}) {
  const referencia = notaShareReferenciaMarcador(m);
  const fecha = notaShareFechaHora(m.fecha);

  return {
    titulo: String(m.titulo || "Nota").trim() || "Nota",
    referencia,
    meta: [referencia, fecha].filter(Boolean).join(" · "),
    versiculo: notaShareTextoVersiculoMarcador(m),
    texto: String(m.nota || "").trim(),
    fondo: String(m.color || "#fff3b0").trim()
  };
}

function notaShareCrearNodo(datos = {}) {
  const stage = document.createElement("div");
  stage.className = "nota-share-stage";

  /*
    Medimos la cantidad total de texto.

    Nota normal:
    mantiene el formato actual.

    Nota larga:
    se genera más ancha para que no quede como una tira.

    Nota extremadamente larga:
    aumenta todavía más el ancho y ajusta el texto.
  */
const textoTotalNota = [
  datos.titulo || "",
  datos.meta || "",
  datos.versiculo || "",
  datos.texto || ""
]
  .join("\n")
  .trim();

const cantidadCaracteres =
  textoTotalNota.length;

const cantidadSaltos =
  (
    textoTotalNota.match(/\n/g) || []
  ).length;

/*
  Los saltos y párrafos también aumentan
  visualmente la altura de la nota.
*/
const puntajeVisual =
  cantidadCaracteres +
  cantidadSaltos * 90;

/*
  Antes:
  - larga desde 3000
  - muy larga desde 7000

  Ahora detectamos antes las notas
  que visualmente ocupan mucho espacio.
*/
if (
  cantidadCaracteres >= 4200 ||
  puntajeVisual >= 4700
) {
  stage.classList.add(
    "nota-share-stage--muy-larga"
  );

} else if (
  cantidadCaracteres >= 1400 ||
  puntajeVisual >= 1750
) {
  stage.classList.add(
    "nota-share-stage--larga"
  );
}

  /*
    Nunca ponemos acá directamente la URL de R2.
    El fondo real se aplica después mediante Blob seguro.
  */
  stage.style.backgroundImage =
    "linear-gradient(145deg, rgba(255,214,232,.82), rgba(209,238,255,.82))";

  const card = document.createElement("div");
  card.className = "nota-share-card";

  card.style.setProperty(
    "--nota-share-fondo",
    datos.fondo || "#fff3b0"
  );

  card.style.setProperty(
    "--nota-share-texto",
    notaShareColorContraste(
      datos.fondo || "#fff3b0"
    )
  );

  const agregar = (clase, texto) => {
    const limpio = String(
      texto || ""
    ).trim();

    if (!limpio) return;

    const div = document.createElement("div");
    div.className = clase;
    div.textContent = limpio;

    card.appendChild(div);
  };

  agregar(
    "nota-share-title",
    datos.titulo
  );

  agregar(
    "nota-share-meta",
    datos.meta
  );

  agregar(
    "nota-share-verse",
    datos.versiculo
  );

  agregar(
    "nota-share-text",
    datos.texto
  );

  agregar(
    "nota-share-firma",
    "Vida Abundante"
  );

  stage.appendChild(card);
  document.body.appendChild(stage);

  return stage;
}

function notaShareCanvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("No se pudo convertir la nota a PNG."));
          return;
        }

        resolve(blob);
      }, "image/png", 0.98);
    } catch (e) {
      reject(e);
    }
  });
}

function notaShareClaveCache(claveBase = "", datos = {}) {
  return [
    claveBase,
    datos.titulo,
    datos.meta,
    datos.versiculo,
    datos.texto,
    datos.fondo
  ].join("|");
}

async function notaShareGenerarArchivo(datos = {}) {
  if (typeof html2canvas !== "function") {
    throw new Error("Falta html2canvas para generar la imagen.");
  }

  const stage = notaShareCrearNodo(datos);

  try {
    // ✅ Traemos el fondo por proxy antes de capturar.
    await notaShareAplicarFondoSeguro(stage);

    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

const escalaCaptura =
      stage.classList.contains(
        "nota-share-stage--muy-larga"
      )
        ? 1.4
        : stage.classList.contains(
            "nota-share-stage--larga"
          )
          ? 1.65
          : 2;

    const canvas = await html2canvas(stage, {
      scale: escalaCaptura,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null
    });

    const blob = await notaShareCanvasBlob(canvas);

    return new File(
      [blob],
      notaShareNombreArchivo(datos.titulo),
      { type: "image/png" }
    );

  } finally {
    if (stage.__notaShareFondoObjectUrl) {
      URL.revokeObjectURL(stage.__notaShareFondoObjectUrl);
    }

    stage.remove();
  }
}

window.notaPrepararComoImagen = async function(datos = {}, claveBase = "nota") {
  const clave = notaShareClaveCache(claveBase, datos);

  if (window.__notaShareFiles.has(clave)) {
    return await window.__notaShareFiles.get(clave);
  }

  const preparando = notaShareGenerarArchivo(datos);
  window.__notaShareFiles.set(clave, preparando);

  try {
    return await preparando;
  } catch (e) {
    window.__notaShareFiles.delete(clave);
    throw e;
  }
};

window.__notaShareAccionEnCurso = false;

function notaShareBusyShow(texto = "Preparando…") {
  let box = document.getElementById("notaShareBusy");

  if (!box) {
    box = document.createElement("div");
    box.id = "notaShareBusy";

    box.style.cssText = `
      position: fixed;
      left: 50%;
      bottom: 82px;
      transform: translateX(-50%);
      z-index: 1000000;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(15,20,30,.92);
      color: #fff;
      font-size: 13px;
      font-weight: 800;
      box-shadow: 0 10px 28px rgba(0,0,0,.25);
      pointer-events: none;
      white-space: nowrap;
    `;

    box.innerHTML = `
      <i class="fa-solid fa-spinner fa-spin"></i>
      <span></span>
    `;

    document.body.appendChild(box);
  }

  const span = box.querySelector("span");
  if (span) span.textContent = texto;

  box.style.display = "inline-flex";
}

function notaShareBusyHide() {
  const box = document.getElementById("notaShareBusy");
  if (box) box.style.display = "none";
}

function notaShareDescargarArchivo(file) {
  const objectUrl = URL.createObjectURL(file);
  const a = document.createElement("a");

  a.href = objectUrl;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

window.notaDescargarComoImagen = async function(datos = {}, claveBase = "nota", boton = null) {
  if (window.__notaShareAccionEnCurso) {
    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Ya se está preparando una imagen.");
    }
    return false;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  window.__notaShareAccionEnCurso = true;

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    notaShareBusyShow("Preparando descarga…");

    const file = await window.notaPrepararComoImagen(datos, claveBase);

    notaShareDescargarArchivo(file);

    if (typeof mostrarToast === "function") {
      mostrarToast("📥 Descargando imagen");
    }

    return true;

  } catch (e) {
    console.error("No pude descargar la nota como imagen:", e);
    alert("No pude generar la imagen de esta nota.");
    return false;

  } finally {
    window.__notaShareAccionEnCurso = false;
    notaShareBusyHide();

    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

window.notaCompartirComoImagen = async function(datos = {}, claveBase = "nota", boton = null) {
  if (window.__notaShareAccionEnCurso) {
    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Ya se está preparando para compartir.");
    }
    return false;
  }

  const icono = boton?.querySelector("i");
  const claseAnterior = icono?.className || "";

  window.__notaShareAccionEnCurso = true;

  try {
    if (boton) boton.disabled = true;
    if (icono) icono.className = "fa-solid fa-spinner fa-spin";

    notaShareBusyShow("Preparando para compartir…");

    const file = await window.notaPrepararComoImagen(datos, claveBase);

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      notaShareBusyShow("Abriendo opciones para compartir…");

      await navigator.share({
        files: [file],
        title: datos.titulo || "Nota - Vida Abundante"
      });

      return true;
    }

    const descargar = confirm(
      "Este navegador no permite compartir la imagen directamente.\n\n¿Querés descargar el PNG?"
    );

    if (descargar) {
      notaShareDescargarArchivo(file);

      if (typeof mostrarToast === "function") {
        mostrarToast("📥 Descargando imagen");
      }
    }

    return false;

  } catch (e) {
    if (window.vaShareCancelado?.(e)) {
      return false;
    }
    
    if (e?.name === "InvalidStateError") {
      if (typeof mostrarToast === "function") {
        mostrarToast("⏳ Cerrá el compartir anterior antes de volver a intentar.");
      }
      return false;
    }

    console.error("No pude compartir la nota como imagen:", e);
    alert("No pude generar o compartir la imagen de esta nota.");
    return false;

  } finally {
    window.__notaShareAccionEnCurso = false;
    notaShareBusyHide();

    if (boton) boton.disabled = false;
    if (icono && claseAnterior) icono.className = claseAnterior;
  }
};

// ================= 🔺 COMPARTIR NOTA DESDE MI PANEL ===========================

function notaPanelVieneDeCompartidos(m = {}) {
  return (
    m?.origen === "compartidos" ||
    !!m?.sourceCompKey
  );
}

function notaPanelPublicacionCompartida(id) {
  return notasCompartidasPanel?.[id] || null;
}

function actualizarEstadoModalCompartirNota(id) {
  const m = (marcadores || {})[id];
  if (!m) return;

  const btnCompartidos = document.getElementById("btnModalNotaCompartidos");
  const btnRedes = document.getElementById("btnModalNotaRedes");
  const texto = document.getElementById("modalCompartirMarcadorTexto");

  const vieneDeCompartidos = notaPanelVieneDeCompartidos(m);
  const yaPublicadaEnCompartidos =
    !vieneDeCompartidos &&
    !!notaPanelPublicacionCompartida(id);

  const yaCompartidaEnRedes = m?.compartidaEnRedes === true;

  if (btnCompartidos) {
    // ✅ Si esta nota vino de Compartidos, no tiene sentido volver a publicarla allí.
    btnCompartidos.style.display = vieneDeCompartidos ? "none" : "inline-flex";
    btnCompartidos.classList.toggle("marcada", yaPublicadaEnCompartidos);

    btnCompartidos.title = yaPublicadaEnCompartidos
      ? "Volver a mostrar arriba en Compartidos"
      : "Publicar en Compartidos";
  }

  if (btnRedes) {
    btnRedes.classList.toggle("marcada", yaCompartidaEnRedes);
  }

  if (texto) {
    if (vieneDeCompartidos) {
      texto.textContent = "Esta nota ya viene de Compartidos. Podés compartirla en redes.";
    } else if (yaPublicadaEnCompartidos) {
      texto.textContent = "Ya está en Compartidos. Al tocarlo nuevamente volverá arriba del feed.";
    } else {
      texto.textContent = "¿Dónde querés compartir esta nota?";
    }
  }
}

window.abrirCompartirMarcador = (id) => {
  __compartirMarcadorId = id;

  actualizarEstadoModalCompartirNota(id);

  const modal = document.getElementById("modalCompartirMarcador");
  if (modal) {
    modal.style.display = "flex";
    modal.classList.add("abierto");
    modal.setAttribute("aria-hidden", "false");
  }

  // ✅ Prepara la imagen apenas abrís el modal para compartir en redes.
  const m = (marcadores || {})[id];

  if (m && typeof window.notaPrepararComoImagen === "function") {
    const datos = notaShareDatosDesdeMarcador(m);

    window.notaPrepararComoImagen(datos, `panel_${id}`)
      .catch(e => console.warn("No pude precargar imagen de nota:", e));
  }
};

window.cerrarCompartirMarcador = () => {
  __compartirMarcadorId = null;

  const modal = document.getElementById("modalCompartirMarcador");
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
  }
};

window.compartirMarcador = async (destino, boton = null) => {
  const id = __compartirMarcadorId;
  if (!id) return;

  const m = (marcadores || {})[id];
  if (!m) return;

  const vieneDeCompartidos = notaPanelVieneDeCompartidos(m);
  const datos = notaShareDatosDesdeMarcador(m);
  const textoVers = datos.versiculo || "";
  const referencia = datos.referencia || m.ref || "";

  // =========================================================
  // REDES: siempre permitido, incluso si ya está en Compartidos
  // =========================================================
  if (destino === "redes") {
    const compartio = await window.notaCompartirComoImagen(
      datos,
      `panel_${id}`,
      boton
    );

    if (compartio) {
      try {
        // ✅ Recordamos que esta nota ya se compartió en redes.
        await Promise.all([
          set(ref(db, `marcadores/${uid}/${id}/compartidaEnRedes`), true),
          set(ref(db, `marcadores/${uid}/${id}/compartidaEnRedesTs`), Date.now())
        ]);

        actualizarEstadoModalCompartirNota(id);

        if (typeof renderPanelMarcadores === "function") {
          renderPanelMarcadores();
        }

      } catch (e) {
        console.warn("Se compartió la imagen, pero no pude guardar el check de Redes:", e);
      }
    }

    cerrarCompartirMarcador();
    return;
  }

  // =========================================================
  // COMPARTIDOS: una nota recibida desde allí no se republica
  // =========================================================
  if (destino === "compartidos" && vieneDeCompartidos) {
    mostrarToast("Esta nota ya proviene de Compartidos.");
    actualizarEstadoModalCompartirNota(id);
    return;
  }

  try {
    const ahora = Date.now();
    const existente = notaPanelPublicacionCompartida(id);

    // =======================================================
    // YA PUBLICADA: actualizar la MISMA publicación
    // =======================================================
    if (existente?.compId) {
      const publicadaAnterior = existente.item || {};

      await set(ref(db, `compartidos/notas/${existente.compId}`), {
        ...publicadaAnterior,

        // ✅ Conserva el mismo registro, pero actualiza el contenido
        // si la nota fue editada antes de volver a compartirla.
        ...m,

        marcadorId: id,
        uid,
        publicadoPor: uid,
        tipo: "nota",

        textoVersiculo: textoVers,
        textoBiblico: textoVers,
        ref: referencia,
        libro: m.libro || "",
        capitulo: Number(m.capitulo || 0),
        versiculos: Array.isArray(m.versiculos) ? m.versiculos : [],

        // ✅ Mantiene fecha original y refresca posición en el feed.
        fechaOriginal: Number(
          publicadaAnterior.fechaOriginal ||
          publicadaAnterior.fecha ||
          m.fecha ||
          0
        ),
        fecha: ahora,
        publicadoEn: ahora,
        ts: ahora,
        republicadaEn: ahora
      });

      mostrarToast("✅ La nota volvió arriba en Compartidos");
      cerrarCompartirMarcador();
      return;
    }

    // =======================================================
    // PRIMERA PUBLICACIÓN: crear una sola vez
    // =======================================================
    await set(ref(db, `compartidos/notas/${ahora}`), {
      ...m,

      marcadorId: id,
      uid,
      publicadoPor: uid,
      tipo: "nota",

      textoVersiculo: textoVers,
      textoBiblico: textoVers,
      ref: referencia,
      libro: m.libro || "",
      capitulo: Number(m.capitulo || 0),
      versiculos: Array.isArray(m.versiculos) ? m.versiculos : [],

      fechaOriginal: Number(m.fecha || 0),
      fecha: ahora,
      publicadoEn: ahora,
      ts: ahora
    });

    mostrarToast("✅ Compartido en Compartidos");

  } catch (e) {
    console.error(e);
    mostrarToast("❌ No se pudo compartir");
  }

  cerrarCompartirMarcador();
};
// ================= 🔺 FORCE DEFAULT CHECK IGLESIA estado pinta css ===========================
function forceDefaultCheckIglesia() {
  const chk = document.getElementById("checkIglesia");
  if (!chk) return;
  chk.checked = false;
}

// ================= UI: ocultar acciones al entrar en modo marcador =================
const VA_LIMITE_COLAB_IMAGENES_DIA = 3;
const VA_LIMITE_COLAB_AUDIOS_DIA = 3;

function vaFechaArgentinaKey() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch (_) {
    return new Date().toISOString().slice(0, 10);
  }
}

function vaEsAdminActual() {
  return !!window.__ES_ADMIN;
}

function vaEsColaboradorActual() {
  return !!window.__ES_COLABORADOR;
}

function vaPuedeCrearImagenPorRol() {
  return !!(window.__ES_ADMIN || window.__ES_COLABORADOR);
}

function usuarioPuedeCrearImagen() {
  return (
    vaPuedeCrearImagenPorRol() ||
    window.__PUEDE_CREAR_IMAGEN_BIBLIA === true
  );
}

function vaSetDisplay(el, valor) {
  if (!el) return;
  el.style.setProperty("display", valor, "important");
}

function vaActualizarFlagCrearImagenBiblia() {
  window.__PUEDE_CREAR_IMAGEN_BIBLIA = vaPuedeCrearImagenPorRol();
  return !!window.__PUEDE_CREAR_IMAGEN_BIBLIA;
}

function vaRepintarCrearImagenBibliaConReintentos() {
  [0, 80, 250, 600, 1200].forEach(ms => {
    setTimeout(() => {
      try {
        aplicarUIAccionesPorModo?.();
      } catch(e) {}
    }, ms);
  });
}

window.vaRepintarCrearImagenBibliaConReintentos = vaRepintarCrearImagenBibliaConReintentos;

function vaPathUsoDiarioColaborador(tipo = "crearImagenBiblia") {
  const uidActual = window.__UID || window.__FB?.auth?.currentUser?.uid || "";
  const fecha = vaFechaArgentinaKey();

  return `usuariosConfig/${uidActual}/usoDiario/${fecha}/${tipo}`;
}

async function vaLeerRestantesUsoColaborador(tipo = "crearImagenBiblia", limite = 3) {
  const uidActual = window.__UID || window.__FB?.auth?.currentUser?.uid || "";

  if (!uidActual) return 0;
  if (vaEsAdminActual()) return null;
  if (!vaEsColaboradorActual()) return 0;

  try {
    const snap = await get(ref(db, vaPathUsoDiarioColaborador(tipo)));
    const data = snap.val() || {};
    const cantidad = Number(data.cantidad || 0);

    return Math.max(0, Number(limite || 3) - cantidad);
  } catch (e) {
    console.warn("No pude leer límite diario:", e);
    return 0;
  }
}

async function vaConsumirUsoColaborador(
  tipo = "crearImagenBiblia",
  limite = 3,
  meta = {}
) {
  const uidActual =
    window.__UID ||
    window.__FB?.auth?.currentUser?.uid ||
    "";

  if (vaEsAdminActual()) {
    return {
      ok: true,
      admin: true,
      restantes: null,
      restantesCaracteres: null
    };
  }

  if (!vaEsColaboradorActual()) {
    throw new Error(
      "Solo administradores o colaboradores pueden usar esta función."
    );
  }

  if (!uidActual) {
    throw new Error("Necesitás iniciar sesión.");
  }

  const limiteAudios = Math.max(
    1,
    Number(limite || 3)
  );

  /*
    Los audios tienen además un límite de caracteres.

    Se comparte entre:
    - Crear imagen de Biblia
    - Audio de notas

    Ambos usan el tipo audioBiblia.
  */
  const esTipoAudio =
    String(tipo || "").startsWith("audio");

  const limiteCaracteres =
    esTipoAudio ? 15000 : 0;

  const caracteresNuevos = Math.max(
    0,
    Math.floor(
      Number(meta?.caracteres || 0)
    )
  );

  const path = vaPathUsoDiarioColaborador(tipo);
  const fecha = vaFechaArgentinaKey();

  const res = await runTransaction(
    ref(db, path),
    actual => {
      const data = actual || {};

      const cantidadActual =
        Number(data.cantidad || 0);

      const caracteresActuales =
        Number(data.caracteres || 0);

      /*
        Límite de cantidad de audios.
      */
      if (cantidadActual >= limiteAudios) {
        return;
      }

      /*
        Límite diario de caracteres.
      */
      if (
        limiteCaracteres > 0 &&
        caracteresActuales + caracteresNuevos >
          limiteCaracteres
      ) {
        return;
      }

      return {
        ...data,

        cantidad: cantidadActual + 1,
        limite: limiteAudios,

        caracteres:
          caracteresActuales +
          caracteresNuevos,

        limiteCaracteres,

        fecha,
        actualizadoEn: Date.now(),

        ultimoUso: {
          caracteres: caracteresNuevos,
          contexto: String(
            meta?.contexto || ""
          ),
          voiceName: String(
            meta?.voiceName || ""
          ),
          fecha: Date.now()
        }
      };
    }
  );

  if (!res.committed) {
    const actual =
      res.snapshot?.val() || {};

    const cantidadActual =
      Number(actual.cantidad || 0);

    const caracteresActuales =
      Number(actual.caracteres || 0);

    if (
      limiteCaracteres > 0 &&
      caracteresActuales + caracteresNuevos >
        limiteCaracteres
    ) {
      const disponibles = Math.max(
        0,
        limiteCaracteres -
          caracteresActuales
      );

      throw new Error(
        `Llegaste al límite diario de ${limiteCaracteres.toLocaleString(
          "es-AR"
        )} caracteres. Te quedan ${disponibles.toLocaleString(
          "es-AR"
        )} caracteres disponibles hoy.`
      );
    }

    if (cantidadActual >= limiteAudios) {
      throw new Error(
        `Llegaste al límite diario de ${limiteAudios} audios. Podés volver a usarlo mañana.`
      );
    }

    throw new Error(
      "No pude registrar el uso diario."
    );
  }

  const dataFinal =
    res.snapshot?.val() || {};

  const cantidadFinal =
    Number(dataFinal.cantidad || 0);

  const caracteresFinales =
    Number(dataFinal.caracteres || 0);

  return {
    ok: true,
    admin: false,

    restantes: Math.max(
      0,
      limiteAudios - cantidadFinal
    ),

    restantesCaracteres:
      limiteCaracteres > 0
        ? Math.max(
            0,
            limiteCaracteres -
              caracteresFinales
          )
        : null
  };
}

window.vaLeerRestantesUsoColaborador = vaLeerRestantesUsoColaborador;
window.vaConsumirUsoColaborador = vaConsumirUsoColaborador;

// ================= UI: ocultar acciones al entrar en modo marcador =================
function aplicarUIAccionesPorModo() {
  const acciones = document.getElementById("accionesBiblia");
  if (!acciones) return;

  const puedeCrearImagen = vaActualizarFlagCrearImagenBiblia();

  const btnModo = document.getElementById("btnModoMarcadorBarra");
  const btnGuardar = document.getElementById("btnGuardarMarcador");
  const btnLista = document.getElementById("btnListaMarcadores");
  const btnImagen = document.getElementById("btnImagen");
  const btnCrear = document.getElementById("btnCrearImagen");

  const normales = Array.from(
    acciones.querySelectorAll(".accion-normal, #resaltadorCompacto")
  );

  // ✅ Sin permiso: ocultar fuerte, aunque CSS lo quiera mantener oculto/visible.
  if (!puedeCrearImagen) {
    vaSetDisplay(btnImagen, "none");
    vaSetDisplay(btnCrear, "none");
  }

  // ✅ MODO IMAGEN: mostrar botón de imagen + Crear Imagen a admin/colaborador.
  if (modoImagen) {
    normales.forEach(el => {
      if (el === btnImagen || el === btnCrear) return;
      vaSetDisplay(el, "none");
    });

    vaSetDisplay(btnImagen, puedeCrearImagen ? "inline-flex" : "none");
    vaSetDisplay(btnCrear, puedeCrearImagen ? "inline-flex" : "none");

    vaSetDisplay(btnModo, "none");
    vaSetDisplay(btnGuardar, "none");
    vaSetDisplay(btnLista, "none");
    return;
  }

  // ✅ MODO MARCADOR
  if (modoMarcador) {
    normales.forEach(el => vaSetDisplay(el, "none"));

    vaSetDisplay(btnModo, "inline-flex");
    vaSetDisplay(btnLista, "none");
    vaSetDisplay(btnImagen, "none");
    vaSetDisplay(btnCrear, "none");
    return;
  }

  // ✅ MODO NORMAL
  normales.forEach(el => {
    if (el === btnImagen || el === btnCrear) return;
    el.style.removeProperty("display");
  });

  vaSetDisplay(btnModo, "inline-flex");
  vaSetDisplay(btnLista, "inline-flex");

  // ✅ Admin y colaborador ven el botón para entrar a modo imagen.
  vaSetDisplay(btnImagen, puedeCrearImagen ? "inline-flex" : "none");

  // ✅ Este solo aparece dentro del modo imagen.
  vaSetDisplay(btnCrear, "none");
}

window.aplicarUIAccionesPorModo = aplicarUIAccionesPorModo;
// ================= Salir de modal limpio ================
function salirModoMarcadorLimpio() {
  modoMarcador = false;
  seleccionMarcador = {};
  document.body.classList.remove("modo-marcador");

  const btn = document.getElementById("btnModoMarcadorBarra");
  if (btn) btn.classList.remove("activo");

  const banner = document.getElementById("bannerModoMarcador");
  if (banner) banner.style.display = "none";

  aplicarUIAccionesPorModo();
  refrescarBotonGuardarMarcador();
  renderPreviewVersiculosMarcador();
  mostrarTexto();

}

// ================= 🔺 HACER FUNCIONES GLOBALES (FIX DESCARGAR/COMPARTIR EN PC) =================
window.generarImagenFinal = generarImagenFinal;
window.descargarImagenFinal = descargarImagenFinal;
window.compartirImagenFinal = compartirImagenFinal;
window.finalizarEdicion = window.finalizarEdicion;
window.cancelarCrearImagen = window.cancelarCrearImagen;

// ================= ✅ INIT ÚNICO =================
document.addEventListener("DOMContentLoaded", () => {

  // 1) UI resaltador
  initResaltadorCompacto();

    // ================= 🎨 modal editar paleta =================
  const btnCerrarPaleta = document.getElementById("cerrarModalEditarPaleta");
  if (btnCerrarPaleta) {
    btnCerrarPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      cerrarModalEditarPaletaResaltador();
    };
  }

  const btnGuardarPaleta = document.getElementById("btnGuardarPaletaResaltador");
  if (btnGuardarPaleta) {
    btnGuardarPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      guardarModalEditarPaletaResaltador();
    };
  }

  const btnResetPaleta = document.getElementById("btnResetPaletaResaltador");
  if (btnResetPaleta) {
    btnResetPaleta.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      resetearPaletaResaltador();
    };
  }

  const modalEditarPaleta = document.getElementById("modalEditarPaletaResaltador");
  if (modalEditarPaleta) {
    modalEditarPaleta.addEventListener("click", (e) => {
      if (e.target === modalEditarPaleta) cerrarModalEditarPaletaResaltador();
    });
  }

  // 2) check iglesia por defecto
  forceDefaultCheckIglesia();

  // 3) listeners botones (sin depender del onclick en HTML)
  const btnGuardar = document.getElementById("btnGuardarMarcador");
  if (btnGuardar) {
    btnGuardar.type = "button";
    btnGuardar.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      guardarMarcadorRapido();
    };
  }

  const btnModo = document.getElementById("btnModoMarcadorBarra");
  if (btnModo) {
    btnModo.type = "button";
    btnModo.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleModoMarcador();
    };
  }

  const b = document.getElementById("btnGuardarNuevoMarcador");
  if (b) {
    b.type = "button";
    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const ctx = getMarcadorCtx();

      if (ctx.origen === "abc") {
  await window.guardarNuevoMarcadorABC();
} else {
  await guardarNuevoMarcador();
}
    };
  }

  // ✅ NUEVO: botón 🔍 (si lo querés sin onclick en HTML)
  // ✅ FILTROS BIBLIA: abre tocando el título "Génesis 1"
  // El botón btnToggleFiltros está oculto por CSS, así que el disparador real es #titulo.
  const btnFiltros = document.getElementById("btnToggleFiltros");
  const tituloBiblia = document.getElementById("titulo");

  function dispararFiltrosBiblia(e) {
    if (e) {
      // ✅ no abrir filtros si tocás RV1960 / NTV u otro botón interno del título
      if (
        e.target?.closest?.(".btn-version-inline") ||
        e.target?.closest?.("button, a, input, select, textarea")
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
    }

    if (typeof window.toggleFiltrosBiblia === "function") {
      window.toggleFiltrosBiblia();
    }
  }

  if (btnFiltros && !btnFiltros.__readyFiltrosBiblia) {
    btnFiltros.__readyFiltrosBiblia = true;
    btnFiltros.type = "button";

    btnFiltros.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (typeof window.toggleFiltrosBiblia === "function") {
        window.toggleFiltrosBiblia();
      }
    });
  }

if (tituloBiblia && !tituloBiblia.__readyFiltrosBiblia) {
  tituloBiblia.__readyFiltrosBiblia = true;

  // ✅ El HTML ya trae onclick="toggleFiltrosBiblia()".
  // Lo quitamos para que no haga doble toggle: abrir y cerrar en el mismo toque.
  tituloBiblia.removeAttribute("onclick");
  tituloBiblia.onclick = null;

  tituloBiblia.setAttribute("role", "button");
  tituloBiblia.setAttribute("tabindex", "0");
  tituloBiblia.setAttribute("aria-label", "Abrir filtros de Biblia");

  tituloBiblia.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (typeof window.toggleFiltrosBiblia === "function") {
      window.toggleFiltrosBiblia();
    }
  });

  tituloBiblia.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();

      if (typeof window.toggleFiltrosBiblia === "function") {
        window.toggleFiltrosBiblia();
      }
    }
  });
}

const inputBuscarLibro = document.getElementById("buscarLibroBiblia");
const selectLibro = document.getElementById("libro");

if (inputBuscarLibro && selectLibro) {
  inputBuscarLibro.addEventListener("input", () => {
    const q = normalizarTextoFiltro(inputBuscarLibro.value);
    const opciones = Array.from(selectLibro.options);

    let primeraCoincidencia = null;

    opciones.forEach(opt => {
      const textoNormalizado = normalizarTextoFiltro(opt.text);
      const ok = !q || textoNormalizado.includes(q);

      opt.hidden = !ok;
      if (ok && !primeraCoincidencia) primeraCoincidencia = opt;
    });

    if (primeraCoincidencia) {
      selectLibro.value = primeraCoincidencia.value;

      // ✅ al cambiar de libro desde el buscador, mostrar capítulo 1 en el filtro
      reconstruirCapitulosParaLibro(primeraCoincidencia.value, 1);
    }
  });

  inputBuscarLibro.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      aplicarFiltrosBiblia();
    }
  });
}
    
// cuando Firebase confirma el usuario
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  cargarResaltadoresUsuario();
});

// asegurar filtros cerrados al iniciar
const secBiblia = document.getElementById("seccion-biblia");
if (secBiblia) secBiblia.classList.remove("filtros-abiertos");
  
// ================= 🔺 IGLESIA: SUB-SECCIONES =================
window.mostrarIglesiaSub = (sub) => {
  // ✅ Iglesia solo puede manejar sus subsecciones si estamos en Iglesia
  if (!document.body.classList.contains("en-iglesia")) return;

  // ✅ refuerzo: no permitir que Mi Panel/Compartidos queden visibles abajo
  if (typeof forzarSeccionActiva === "function") {
    forzarSeccionActiva("iglesia");
  }

  const permitidas = ["devocionales", "abc", "subidos", "recursos"];
  if (!permitidas.includes(sub)) sub = "devocionales";

  // ✅ Usuarios comunes no pueden abrir Recursos.
  // Si todavía no sabemos permisos o no tiene permiso, NO mandamos a Devocionales:
  // mandamos a Compartidos.
  if (sub === "recursos") {
    const puedeVerRecursos = !!window.__ES_ADMIN || !!window.__ES_COLABORADOR;

    if (!puedeVerRecursos) {
      try {
        window.__IGLESIA_SUB_ACTIVA = "";
        window.__RECURSOS_SUB_ACTIVA = "";

        if (typeof guardarEstadoBiblia === "function") {
          guardarEstadoBiblia({
            seccion: "compartidos",
            subIglesia: "",
            subRecursos: ""
          });
        }

        if (typeof window.irA === "function") {
          window.irA("compartidos");
        } else if (typeof window.forzarSeccionActiva === "function") {
          window.forzarSeccionActiva("compartidos");
        }

        setTimeout(() => {
          try { window.mostrarCompartidosSub?.("todo"); } catch(e) {}
          try { window.mostrarCompartidos?.("todo"); } catch(e) {}
          try { window.scrollTo({ top: 0, behavior: "auto" }); } catch(e) {}
        }, 0);

      } catch (e) {
        console.warn("No pude mandar a Compartidos:", e);
      }

      return;
    }
  }

    window.__IGLESIA_SUB_ACTIVA = sub;

  try {
    guardarEstadoBiblia({
      seccion: "iglesia",
      subIglesia: sub
    });
  } catch(e) {}

  // ✅ detecto si estaba en ABC antes
  const abcAntes = document.getElementById("iglesia-abc");
  const estabaEnABC = !!(abcAntes && getComputedStyle(abcAntes).display !== "none");

  // ✅ si salgo de ABC a otro sub, apago ABC
  if (estabaEnABC && sub !== "abc") {
    try { window.__abcOnExit?.(); } catch(e) { console.warn(e); }
  }

  permitidas.forEach(k => {
    const el = document.getElementById("iglesia-" + k);
    if (el) {
      el.style.setProperty("display", k === sub ? "block" : "none", "important");
    }
  });

  const wrap = document.getElementById("seccion-iglesia");
  if (wrap) {
    wrap.querySelectorAll(".iglesia-tab, .nav-btn, button").forEach(b => b.classList.remove("activo"));

    const btn = wrap.querySelector(`[onclick="mostrarIglesiaSub('${sub}')"]`);
    if (btn) btn.classList.add("activo");
  }

  // ✅ cuando entro a ABC: inicializo ABC + apago modos de Biblia
  if (sub === "abc") {
    try { bibliaBackupUI(); } catch(e) {}
    try { bibliaApagarModosParaCambiarSeccion(); } catch(e) {}

    try { window.mostrarABC?.(); } catch(e) { console.warn(e); }
    try { window.__abcOnEnter?.(); } catch(e) { console.warn(e); }
  }

 if (sub === "recursos") {
    const estado = leerEstadoBiblia?.() || {};
    const subRecursosGuardada =
      window.__RECURSOS_SUB_ACTIVA ||
      estado.subRecursos ||
      "ediciones";

    try { window.mostrarRecursosSub?.(subRecursosGuardada); } catch(e) { console.warn(e); }
  }

  // ✅ segundo refuerzo por si devocionales/ABC/recursos renderizan después
  requestAnimationFrame(() => {
    if (typeof forzarSeccionActiva === "function") {
      forzarSeccionActiva("iglesia");
    }
  });
};

// ================= SELECTOR DE COLORES REUTILIZABLE =====  
setTimeout(() => {
initPickrEnHosts(
  "#personalizarColorHost, #personalizarOutlineHost, #marcadorColorHost, #dev1ColorHost, #dev1OutlineColorHost, #dev1OpColorHost, #dev2ColorHost, #dev2OutlineColorHost, #colorFondoPlanoHost, #dev2FondoHost, #colorOpacidadBibliaHost, #colorFondoAppHost, #colorTextoAppHost, #bibliaFondoColor1Host, #bibliaFondoColor2Host, #bibliaFondoColor3Host"
);
}, 0);

const btn = document.getElementById("btnAplicarFiltrosBiblia");
if (btn && !btn.__ready) {
  btn.__ready = true;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    aplicarFiltrosBiblia();
  });
}
  
vaRepintarCrearImagenBibliaConReintentos();
  
}); // ================= ✅ CIERRA INIT ÚNICO =====

// ================= 🔺 MI PANEL IMÁGENES: DESCARGAR / COMPARTIR ARCHIVO REAL ===================

function panelNombreArchivoSeguro(fileName = "imagen_vida_abundante.png"){
  return String(fileName || "imagen_vida_abundante.png")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120) || "imagen_vida_abundante.png";
}

function panelProxyImagenUrl(url, fileName = "imagen_vida_abundante.png", descargar = false){
  return R2_DOWNLOAD_URL +
    "?url=" + encodeURIComponent(url) +
    "&nombre=" + encodeURIComponent(panelNombreArchivoSeguro(fileName)) +
    "&descargar=" + (descargar ? "1" : "0");
}

async function fetchPanelImagenBlob(url, fileName = "imagen_vida_abundante.png"){
  if (!url) throw new Error("No hay imagen para descargar.");

  const proxyUrl = panelProxyImagenUrl(url, fileName, false);

  const r = await fetch(proxyUrl, { cache: "no-store" });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error("No pude bajar la imagen (" + r.status + ") " + txt);
  }

  const blob = await r.blob();

  if (!blob || !blob.size) {
    throw new Error("La imagen bajó vacía.");
  }

  return blob;
}

function panelImagenTieneMeta(item = {}) {
  return !!(
    String(item.titulo || "").trim() ||
    String(item.descripcion || "").trim()
  );
}

function panelImagenSlug(txt = "imagen") {
  return String(txt || "imagen")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "imagen";
}

function panelImagenNombreArchivo(item = {}, tipo = "imagen") {
  const base = panelImagenSlug(item.titulo || item.ref || "vida_abundante");
  return panelNombreArchivoSeguro(`${tipo}_${base}.png`);
}

function panelImagenDescargarFile(file) {
  const objUrl = URL.createObjectURL(file);

  const a = document.createElement("a");
  a.href = objUrl;
  a.download = file.name || "imagen_vida_abundante.png";
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
}

function panelImagenCrearModalSalida() {
  if (document.getElementById("modalImagenSalida")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modalImagenSalida" class="va-img-salida-modal" aria-hidden="true">
      <div class="va-img-salida-card">
        <h3>¿Qué querés usar?</h3>
        <p>Publicación incluye título, descripción y color. Imagen es solo el PNG original.</p>

        <div class="va-img-salida-actions">
          <button type="button" class="btn-primary" data-va-img-salida="publicacion">
            <i class="fa-solid fa-newspaper"></i>
            Publicación
          </button>

          <button type="button" class="btn-primary" data-va-img-salida="imagen">
            <i class="fa-solid fa-image"></i>
            Imagen
          </button>

          <button type="button" class="btn-ghost" data-va-img-salida="cancelar">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  `);

  document.getElementById("modalImagenSalida")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-va-img-salida]");

    if (!btn && e.target?.id !== "modalImagenSalida") return;

    const valor = btn?.dataset?.vaImgSalida || "cancelar";
    panelImagenCerrarModalSalida(valor === "cancelar" ? null : valor);
  });
}

function panelImagenCerrarModalSalida(valor) {
  const modal = document.getElementById("modalImagenSalida");

  if (modal) {
    modal.classList.remove("abierto");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
  }

  const resolver = window.__VA_IMG_SALIDA_RESOLVE;
  window.__VA_IMG_SALIDA_RESOLVE = null;

  if (resolver) resolver(valor);
}

function panelImagenElegirSalida() {
  panelImagenCrearModalSalida();

  const modal = document.getElementById("modalImagenSalida");
  if (!modal) return Promise.resolve("imagen");

  modal.style.display = "flex";
  modal.classList.add("abierto");
  modal.setAttribute("aria-hidden", "false");

  return new Promise(resolve => {
    window.__VA_IMG_SALIDA_RESOLVE = resolve;
  });
}

function panelCanvasRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panelCanvasWrapText(ctx, text, maxWidth) {
  const lineas = [];
  const partes = String(text || "").split(/\n/);

  partes.forEach(parte => {
    const palabras = parte.split(/\s+/).filter(Boolean);

    if (!palabras.length) {
      lineas.push("");
      return;
    }

    let linea = "";

    palabras.forEach(palabra => {
      const prueba = linea ? `${linea} ${palabra}` : palabra;

      if (ctx.measureText(prueba).width > maxWidth && linea) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = prueba;
      }
    });

    if (linea) lineas.push(linea);
  });

  return lineas;
}

async function panelImagenBlobToDrawable(blob) {
  if (window.createImageBitmap) {
    return await createImageBitmap(blob);
  }

  return await new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("No pude preparar la imagen."));
    };

    img.src = objUrl;
  });
}

async function panelImagenCrearPublicacionFile(item = {}) {
  const url = item.url || item.imagenUrl || "";
  if (!url) throw new Error("No hay imagen para preparar.");

  const titulo = String(item.titulo || item.ref || "Vida Abundante").trim();
  const descripcion = String(item.descripcion || "").trim();
  const fondo = vaImgMetaHex(item.color || item.colorFondo || "#fff3b0") || "#fff3b0";
  const textoColor = vaImgMetaContraste(fondo);

  const imgBlob = await fetchPanelImagenBlob(url, panelImagenNombreArchivo(item, "imagen"));
  const img = await panelImagenBlobToDrawable(imgBlob);

  const W = 1080;

  // ✅ Sin borde vacío externo en la publicación descargada
  const outer = 0;
  const cardX = 0;
  const cardY = 0;
  const cardW = W;

  const pad = 58;
  const innerW = cardW - pad * 2;

  const canvasMedida = document.createElement("canvas");
  const ctxM = canvasMedida.getContext("2d");

  ctxM.font = "800 54px Arial";
  const titleLines = panelCanvasWrapText(ctxM, titulo, innerW);

  ctxM.font = "400 38px Arial";
  const descLines = descripcion ? panelCanvasWrapText(ctxM, descripcion, innerW) : [];

  const imgW0 = img.width || img.videoWidth || 1000;
  const imgH0 = img.height || img.videoHeight || 1000;

  let drawW = innerW;
  let drawH = Math.round(imgH0 * (drawW / imgW0));

  const maxImgH = 1650;
  if (drawH > maxImgH) {
    drawH = maxImgH;
    drawW = Math.round(imgW0 * (drawH / imgH0));
  }

  const titleH = titleLines.length * 64;
  const descH = descLines.length ? descLines.length * 48 + 18 : 0;
  const imgTopGap = 24;

  const cardH = pad + titleH + descH + imgTopGap + drawH + pad;

  // ✅ La altura ya no suma borde externo
  const H = cardH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");

  // ✅ Pintamos todo el PNG con el color del contenedor.
  // Así no queda borde blanco/rosado afuera.
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = fondo;
  panelCanvasRoundRect(ctx, cardX, cardY, cardW, cardH, 46);
  ctx.fill();

  let y = cardY + pad;

  ctx.fillStyle = textoColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "800 54px Arial";
  titleLines.forEach(linea => {
    ctx.fillText(linea, W / 2, y);
    y += 64;
  });

  if (descLines.length) {
    y += 8;
    ctx.font = "400 38px Arial";

    descLines.forEach(linea => {
      ctx.fillText(linea, W / 2, y);
      y += 48;
    });
  }

  y += imgTopGap;

  const imgX = Math.round((W - drawW) / 2);

  ctx.save();
  panelCanvasRoundRect(ctx, imgX, y, drawW, drawH, 28);
  ctx.clip();
  ctx.drawImage(img, imgX, y, drawW, drawH);
  ctx.restore();

  if (typeof img.close === "function") {
    try { img.close(); } catch(e) {}
  }

  const outBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  if (!outBlob) throw new Error("No pude generar la publicación.");

  return new File(
    [outBlob],
    panelImagenNombreArchivo(item, "publicacion"),
    { type: "image/png" }
  );
}

window.panelImagenAccionCard = async function(cardKey, accion = "descargar") {
  const item = window.__VA_PANEL_IMG_ITEMS?.[cardKey];

  if (!item || !(item.url || item.imagenUrl)) {
    alert("No encuentro la imagen.");
    return;
  }

  const url = item.url || item.imagenUrl || "";
  const nombreImagen = panelImagenNombreArchivo(item, "imagen");

  if (!panelImagenTieneMeta(item)) {
    if (accion === "descargar") {
      return descargarImagenPanel(url, nombreImagen);
    }

    return compartirImagenPanel(url, nombreImagen);
  }

  const salida = await panelImagenElegirSalida();
  if (!salida) return;

  if (salida === "imagen") {
    if (accion === "descargar") {
      return descargarImagenPanel(url, nombreImagen);
    }

    return compartirImagenPanel(url, nombreImagen);
  }

  try {
    mostrarToast?.("⏳ Preparando publicación...");

    const file = await panelImagenCrearPublicacionFile(item);

    if (accion === "descargar") {
      panelImagenDescargarFile(file);
      mostrarToast?.("📥 Descargando publicación");
      return;
    }

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: item.titulo || "Vida Abundante"
      });
      return;
    }

    panelImagenDescargarFile(file);
    alert("Tu navegador no permite compartir directo. Se descargó la publicación para compartirla manualmente.");

  } catch (e) {
    if (window.vaShareCancelado?.(e)) return;

    console.error(e);
    alert("No se pudo preparar la publicación.\n\nDetalle: " + (e?.message || e));
  }
};

window.descargarImagenPanel = async (url, fileName = "imagen_vida_abundante.png") => {
  try {
    if (!url) {
      alert("No hay imagen para descargar.");
      return;
    }

    fileName = panelNombreArchivoSeguro(fileName);

    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Preparando descarga...");
    }

    // ✅ baja ARCHIVO REAL
    const blob = await fetchPanelImagenBlob(url, fileName);

    const objUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);

    if (typeof mostrarToast === "function") {
      mostrarToast("📥 Descargando imagen...");
    }

  } catch (e) {
    console.error(e);
    alert("No se pudo descargar la imagen.\n\nDetalle: " + (e?.message || e));
  }
};

function normalizarUrlPanelParaDB(url) {
  let s = String(url || "").trim();
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;

  if (/^(?:\.\/|\/)?pub-[a-z0-9-]+\.r2\.dev\//i.test(s)) {
    s = "https://" + s.replace(/^(?:\.\/|\/)+/, "");
  }

  s = s.replace(/^https:\//i, "https://");
  s = s.replace(/^http:\//i, "http://");

  return s;
}

function panelCompInfoDesdePath(path = "") {
  const p = String(path || "").trim();
  if (!p.includes("compartidos/imagenes/")) return null;

  const compId = p.split("/").filter(Boolean).pop();
  if (!compId) return null;

  return {
    compId,
    path: `compartidos/imagenes/${compId}`,
    item: panelImagenesCompartidosCache?.[compId] || null
  };
}

function panelBuscarPublicacionImagenPanel(id, item = {}) {
  const directa = panelImagenesPublicadas?.[id];
  if (directa?.path) return directa;

  const porMismoId = panelImagenesCompartidosCache?.[id];
if (porMismoId) {
  return {
    compId: id,
    path: `compartidos/imagenes/${id}`,
    item: porMismoId
  };
}

  const sourcePath = String(item.sourceCompPath || item.compPath || "").trim();
  const desdePath = panelCompInfoDesdePath(sourcePath);
  if (desdePath) return desdePath;

  const sourceCompId = String(item.sourceCompId || item.compId || item._compId || "").trim();
  if (sourceCompId) {
    return {
      compId: sourceCompId,
      path: `compartidos/imagenes/${sourceCompId}`,
      item: panelImagenesCompartidosCache?.[sourceCompId] || null
    };
  }

  const sourceKey = String(item.sourceOracionesKey || item.sourceCompKey || item.publicacionKey || "").trim();
  const url = normalizarUrlPanelParaDB(item.url || item.imagenUrl || "");
  const vieneDeCompartidos = String(item.origen || "").toLowerCase() === "compartidos";

  for (const [compId, pub] of Object.entries(panelImagenesCompartidosCache || {})) {
    if (!pub || typeof pub !== "object") continue;

    const pubKey = String(pub.sourceOracionesKey || pub.sourceCompKey || pub.publicacionKey || "").trim();

    if (sourceKey && pubKey && sourceKey === pubKey) {
      return {
        compId,
        path: `compartidos/imagenes/${compId}`,
        item: pub
      };
    }

    const pubUrl = normalizarUrlPanelParaDB(pub.url || pub.imagenUrl || "");

    if (
      vieneDeCompartidos &&
      url &&
      pubUrl &&
      url === pubUrl
    ) {
      return {
        compId,
        path: `compartidos/imagenes/${compId}`,
        item: pub
      };
    }
  }

  return null;
}

function panelImagenPublicadaActiva(id, item = {}) {
  const info = panelBuscarPublicacionImagenPanel(id, item);

  if (!info?.compId) return false;

  const compId = String(info.compId || "").trim();

  // ✅ Importante:
  // si la publicación ya no existe en compartidos/imagenes,
  // NO debe quedar activo ni con check en Mi Panel.
  return !!panelImagenesCompartidosCache?.[compId];
}

function panelImagenRefrescarPanelSiVisible() {
  const repintar = () => {
    try {
      // ✅ aunque Mi Panel esté oculto, si el HTML existe lo repintamos igual.
      // Así cuando volvés a Mi Panel ya no queda el check viejo.
      if (
        typeof renderPanelImagenes === "function" &&
        document.getElementById("panelImgFeed")
      ) {
        renderPanelImagenes(panelImagenesGuardadas || {});
      }
    } catch (e) {
      console.warn("No pude refrescar Mi Panel Imágenes:", e);
    }
  };

  repintar();

  // ✅ Reintentos cortos porque Firebase puede actualizar el listener unos ms después.
  setTimeout(repintar, 80);
  setTimeout(repintar, 300);
  setTimeout(repintar, 800);
}

function panelImagenQuitarEstadoPublicado(compId = "", panelId = "") {
  compId = String(compId || "").trim();
  panelId = String(panelId || "").trim();

  const pub = compId ? (panelImagenesCompartidosCache?.[compId] || {}) : {};

  const idsPanel = new Set(
    [
      panelId,
      pub.panelItemId,
      pub.sourcePanelItemId
    ]
      .map(x => String(x || "").trim())
      .filter(Boolean)
  );

  if (compId && panelImagenesCompartidosCache) {
    delete panelImagenesCompartidosCache[compId];
  }

  Object.keys(panelImagenesPublicadas || {}).forEach(pid => {
    const info = panelImagenesPublicadas[pid];

    const mismoComp =
      compId &&
      (
        String(info?.compId || "") === compId ||
        String(info?.path || "") === `compartidos/imagenes/${compId}`
      );

    const mismoPanel = idsPanel.has(String(pid || ""));

    if (mismoComp || mismoPanel) {
      delete panelImagenesPublicadas[pid];
    }
  });

  panelImagenRefrescarPanelSiVisible();
}

window.panelImagenQuitarEstadoPublicado = panelImagenQuitarEstadoPublicado;

function panelImagenVieneDeCompartidos(item = {}) {
  const origen = String(item.origen || "").trim().toLowerCase();

  return (
    origen === "compartidos" ||
    origen.includes("compartidos") ||
    !!item.sourceCompPath ||
    !!item.sourceCompId ||
    !!item.sourceCompKey ||
    !!item.sourceOracionesKey
  );
}

// ================= ✏️ EDITAR IMAGEN DESDE MI PANEL =================
window.editarImagenPanel = async function(id) {
  try {
    if (!uid) {
      window.abrirLoginParaGuardarMiPanel();
      return;
    }

    if (!usuarioPuedeCrearImagen()) {
      alert("Solo administradores o colaboradores pueden editar imágenes.");
      return;
    }

    id = String(id || "").trim();

    const item = panelImagenesGuardadas?.[id];

    if (!id || !item) {
      alert("No encuentro esta imagen en Mi Panel.");
      return;
    }

    if (panelImagenVieneDeCompartidos(item)) {
      alert("Esta imagen viene de Compartidos. Para no modificar publicaciones ajenas, no se edita desde acá.");
      return;
    }

    const modal = document.getElementById("modalPersonalizar");
    if (!modal) return;

    const tipoTexto = String(item.tipoTexto || "").toLowerCase();
    const itemsBiblia = vaImgItemsDesdePanelItem(item);
    const esLibre = tipoTexto === "libre" || (!!String(item.textoLibre || "").trim() && !itemsBiblia.length);
    const esBiblia = !esLibre && (tipoTexto === "biblia" || itemsBiblia.length);

    if (!esLibre && !esBiblia) {
      alert("Esta imagen no tiene datos de texto para editarla.");
      return;
    }

    resetModalPersonalizar();

    window.__VA_IMG_EDITANDO = {
      id,
      item: { ...item }
    };

    origenModalImagen = esLibre ? "panel" : "biblia";
    modoImagenLibre = !!esLibre;

    if (esLibre) {
      textoLibreImagen = String(item.textoLibre || "").trim() || "ESCRIBÍ\nAQUÍ TU\nTEXTO";
    } else {
      textoLibreImagen = "";

      const cargados = vaImgCargarSeleccionBibliaDesdePanelItem(item);

      if (!cargados.length) {
        alert("No encuentro los versículos originales para editar esta imagen.");
        window.__VA_IMG_EDITANDO = null;
        return;
      }
    }

    modal.classList.add("solo-imagen");
    modal.classList.remove("modo-devocional");

    abrirModalPersonalizar();
    asegurarCajaTextoLibrePanel();
    crearListaVisualFuentes();
    bibliaCompactarControlesMobile?.();

    // ✅ Restaura fondo/textura/adorno/tamaño/fuente/colores si la imagen ya lo tiene guardado.
    const pudoRestaurarDiseno = await vaImgAplicarEstadoDisenoGuardado(item);

    // ✅ Si es imagen vieja sin datos de diseño, abre igual pero no inventa adornos.
    if (!pudoRestaurarDiseno) {
      cargarFondos();
      setFormatoImagen("post");
      await vaImgRecalcularPreviewDespuesAbrir();
    }

    // ✅ Solo texto libre se puede editar.
    // ✅ Biblia queda bloqueada: no se toca el texto del versículo.
    if (esLibre) {
      requestAnimationFrame(() => {
        const previewTexto = document.getElementById("previewTexto");
        if (!previewTexto) return;

        previewTexto.focus();

        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(previewTexto);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (e) {}
      });
    }

  } catch (e) {
    console.error(e);
    alert("No se pudo abrir la edición de la imagen.");
  }
};

window.publicarImagenPanelEnCompartidos = async function(id) {
  try {
    if (!uid) {
      window.abrirLoginParaGuardarMiPanel();
      return;
    }

    const item = panelImagenesGuardadas?.[id];

    if (!item || !item.url) {
      alert("No encuentro la imagen para publicar en Compartidos.");
      return;
    }

    if (panelImagenVieneDeCompartidos(item)) {
  mostrarToast("Esta imagen ya viene de Compartidos.");
  renderPanelImagenes(panelImagenesGuardadas || {});
  return;
}

    const ts = Date.now();
    const url = normalizarUrlPanelParaDB(item.url);
    const existente = panelBuscarPublicacionImagenPanel(id, item);

    // ✅ YA EXISTE EN COMPARTIDOS:
    // no resubimos, solo cambiamos fecha para que vuelva arriba.
    if (existente?.path) {
      const ok = confirm(
        "Esta imagen ya está en Compartidos.\n\n" +
        "¿Volvemos a compartirla para que quede arriba?"
      );

      if (!ok) return;

      const pubRef = ref(db, existente.path);
      const snap = await get(pubRef);

      if (snap.exists()) {
        const anterior = snap.val() || {};

        await set(pubRef, {
          ...anterior,

          tipo: "imagen",
          url: anterior.url || url,
          imagenUrl: anterior.imagenUrl || url,

          // ✅ conserva la fecha original y refresca posición
          fechaOriginal: Number(
            anterior.fechaOriginal ||
            anterior.fecha ||
            item.fecha ||
            0
          ),
          fecha: ts,
          publicadoEn: ts,
          ts,
          republicadaEn: ts,

          actualizadoPor: uid,

          // ✅ conserva relación con Mi Panel si ya existía
          panelItemId: anterior.panelItemId || (
            String(item.origen || "").toLowerCase() === "compartidos" ? "" : id
          ),

          // ✅ claves de origen para conservar oraciones
          sourceCompPath: anterior.sourceCompPath || item.sourceCompPath || "",
          sourceCompId: anterior.sourceCompId || item.sourceCompId || "",
          sourceCompKey: anterior.sourceCompKey || item.sourceCompKey || "",
          sourceOracionesKey:
            anterior.sourceOracionesKey ||
            item.sourceOracionesKey ||
            item.sourceCompKey ||
            ""
        });

        panelImagenesPublicadas[id] = {
          compId: existente.compId,
          path: existente.path,
          item: {
            ...anterior,
            fecha: ts,
            publicadoEn: ts,
            ts
          }
        };

        if (
          document.body.classList.contains("en-panel") &&
          document.getElementById("panel-imagenes")?.offsetParent !== null
        ) {
          renderPanelImagenes(panelImagenesGuardadas || {});
        }

        mostrarToast("✅ La publicación volvió arriba en Compartidos");
        return;
      }
    }

    // ✅ PRIMERA VEZ:
    // crea una sola publicación nueva.
    await set(ref(db, `compartidos/imagenes/${ts}`), {
      ...item,
      url,
      imagenUrl: url,

      uid,
      publicadoPor: uid,
      tipo: item.tipo || "imagen",
      origen: item.origen || "panel",

      fecha: ts,
      publicadoEn: ts,
      ts,
      fechaOriginal: item.fecha || 0,

      panelItemId: id,

      // ✅ si esta imagen venía desde Compartidos,
      // guardamos la clave original para que las oraciones sigan vinculadas.
      sourceCompPath: item.sourceCompPath || "",
      sourceCompId: item.sourceCompId || "",
      sourceCompKey: item.sourceCompKey || "",
      sourceOracionesKey: item.sourceOracionesKey || item.sourceCompKey || ""
    });

    mostrarToast("✅ Publicado en Compartidos");

  } catch (e) {
    console.error(e);
    alert("No se pudo publicar en Compartidos.");
  }
};

window.compartirImagenPanel = async (url, fileName = "imagen_vida_abundante.png") => {
  try {
    if (!url) {
      alert("No hay imagen para compartir.");
      return;
    }

    fileName = panelNombreArchivoSeguro(fileName);

    if (typeof mostrarToast === "function") {
      mostrarToast("⏳ Preparando para compartir...");
    }

    // ✅ baja ARCHIVO REAL
    const blob = await fetchPanelImagenBlob(url, fileName);
    const file = new File([blob], fileName, { type: blob.type || "image/png" });

    // ✅ comparte ARCHIVO REAL
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: "Vida Abundante",
        files: [file]
      });
      return;
    }

    // fallback: descargar archivo real
    const objUrl = URL.createObjectURL(file);

    const a = document.createElement("a");
    a.href = objUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);

    alert("Tu navegador no permite compartir archivo directo. Se descargó la imagen para compartirla manualmente.");

  } catch(e){
    if (window.vaShareCancelado?.(e)) {
      return;
    }

    console.error(e);
    alert("No se pudo compartir la imagen.\n\nDetalle: " + (e?.message || e));
  }
};

window.eliminarImagenPanel = async (id) => {
  if (!confirm("¿Eliminar esta imagen de Mi Panel?")) return;

  try {
    const uid = window.__UID;

    // ✅ solo borra la referencia del panel
    // ❌ NO borra el archivo de Storage
    // porque puede estar compartido también en "Compartidos"
    await remove(ref(db, `panelImagenesPersonal/${uid}/${id}`));

  } catch (e) {
    console.error(e);
    alert("No se pudo eliminar la imagen");
  }
};

(function initScrollTopGlobal(){
  const btn = document.getElementById("btnScrollTopGlobal");
  if (!btn || btn.dataset.iniciado === "1") return;

  btn.dataset.iniciado = "1";

  let timerOcultar = null;

  function elementoVisible(el) {
    if (!el) return false;

    return (
      el.getClientRects().length > 0 &&
      getComputedStyle(el).display !== "none"
    );
  }

  function hayModalAbierto() {
    if (document.querySelector(".modal-overlay.abierto, .comp-ora-overlay.abierto")) {
      return true;
    }

    const ids = [
      "modalPersonalizar",
      "modalTema",
      "compMediaViewer",
      "compOraModal",
      "compOraListaModal"
    ];

    return ids.some(id => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== "none";
    });
  }

function seccionPermiteBoton() {
  return (
    document.body.classList.contains("en-biblia") ||
    document.body.classList.contains("en-iglesia") ||
    document.body.classList.contains("en-panel") ||
    document.body.classList.contains("en-compartidos")
  );
}

function obtenerContenedorScrollActivo() {
  const candidatos = [
    document.querySelector("body.en-biblia #seccion-biblia"),

    document.querySelector("body.en-compartidos #seccion-compartidos"),

    document.querySelector("body.en-iglesia #iglesia-devocionales"),
    document.querySelector("body.en-iglesia #iglesia-abc"),
    document.querySelector("body.en-iglesia #iglesia-subidos"),
    document.querySelector("body.en-iglesia #seccion-iglesia"),

    document.querySelector("body.en-panel #panel-imagenes"),
    document.querySelector("body.en-panel #panel-marcadores"),
    document.querySelector("body.en-panel #seccion-panel")
  ].filter(elementoVisible);

  for (const el of candidatos) {
    const st = getComputedStyle(el);

    const tieneScrollInterno =
      (st.overflowY === "auto" || st.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 10;

    if (tieneScrollInterno) return el;
  }

  return window;
}

  function obtenerScrollActual() {
    const cont = obtenerContenedorScrollActivo();
    return cont === window ? window.scrollY : cont.scrollTop;
  }

  function ocultarBoton() {
    clearTimeout(timerOcultar);
    btn.classList.remove("mostrar");
  }

  function programarOcultado() {
    clearTimeout(timerOcultar);

    timerOcultar = setTimeout(() => {
      btn.classList.remove("mostrar");
    }, 1800);
  }

function puedeMostrarse() {
  return (
    seccionPermiteBoton() &&
    !hayModalAbierto() &&
    obtenerScrollActual() > 480
  );
}

  function mostrarSoloUnMomento() {
    if (!puedeMostrarse()) {
      ocultarBoton();
      return;
    }

    btn.classList.add("mostrar");
    programarOcultado();
  }

  function revisarSiDebeOcultarse() {
    if (!puedeMostrarse()) {
      ocultarBoton();
    }
  }

  window.addEventListener("scroll", mostrarSoloUnMomento, { passive: true });
  window.addEventListener("resize", revisarSiDebeOcultarse);

[
  "seccion-biblia",
  "seccion-compartidos",
  "iglesia-devocionales",
  "iglesia-abc",
  "iglesia-subidos",
  "panel-imagenes",
  "panel-marcadores",
  "seccion-iglesia",
  "seccion-panel"
]
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .forEach(el => {
      el.addEventListener("scroll", mostrarSoloUnMomento, { passive: true });
    });

  btn.addEventListener("mouseenter", () => {
    clearTimeout(timerOcultar);
  });

  btn.addEventListener("mouseleave", () => {
    if (btn.classList.contains("mostrar")) {
      programarOcultado();
    }
  });

  btn.addEventListener("pointerdown", () => {
    clearTimeout(timerOcultar);
  });

  btn.addEventListener("click", () => {
    const cont = obtenerContenedorScrollActivo();

    ocultarBoton();

    if (cont === window) {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    } else {
      cont.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  });

  setInterval(revisarSiDebeOcultarse, 400);
})();

// ================= MODAL TEMA + FONDOS POR SECCIÓN =================
const FONDO_SECCIONES = {
  biblia: {
    seccionId: "seccion-biblia",
    fondoId: "fondoBiblia"
  },
  iglesia: {
    seccionId: "seccion-iglesia",
    fondoId: "fondoIglesia"
  },
  panel: {
    seccionId: "seccion-panel",
    fondoId: "fondoPanel"
  },
  compartidos: {
    seccionId: "seccion-compartidos",
    fondoId: "fondoCompartidos"
  }
};

let fondoTemaDraft = null;

let fondoTemaBackupAbrir = null;

function getNombreSeccionTema(seccion) {
  const nombres = {
    biblia: "Biblia",
    iglesia: "Iglesia",
    panel: "Mi Panel",
    compartidos: "Compartidos"
  };

  return nombres[seccion] || "Biblia";
}

function getSeccionesTemaDestino() {
  if (fondoTemaDraft?.ambito === "todas") {
    return Object.keys(FONDO_SECCIONES);
  }

  return [fondoTemaDraft?.seccion || getSeccionActualFondoKey()];
}

function guardarBackupTemaActual() {
  fondoTemaBackupAbrir = {};

  Object.keys(FONDO_SECCIONES).forEach(seccion => {
    fondoTemaBackupAbrir[seccion] = getEstadoGuardadoSeccion(seccion);
  });
}

function restaurarBackupTemaVisual() {
  const backup = fondoTemaBackupAbrir || {};

  Object.keys(FONDO_SECCIONES).forEach(seccion => {
    const estado = backup[seccion] || getEstadoGuardadoSeccion(seccion);
    aplicarEstadoVisualSeccion(seccion, estado);
  });

  limpiarFondosInternosApp();

  try {
    if (obtenerSeccionActual() === "biblia" && typeof mostrarTexto === "function") {
      mostrarTexto({ guardar: false });
    }
  } catch(e) {}
}

function getEstadoDraftParaSeccionTema(seccion) {
  return normalizarEstadoApariencia(seccion, {
    ...fondoTemaDraft,
    seccion
  });
}

function aplicarDraftTemaVisual() {
  if (!fondoTemaDraft) return;

  getSeccionesTemaDestino().forEach(seccion => {
    aplicarEstadoVisualSeccion(
      seccion,
      getEstadoDraftParaSeccionTema(seccion)
    );
  });

  limpiarFondosInternosApp();
  repintarTextoBibliaTema();
}

function temaGetFirmaImagenInput() {
  const input = document.getElementById("imgFondoApp");
  const file = input?.files?.[0];

  if (!file) return "";

  return `${file.name}|${file.size}|${file.lastModified}`;
}

function temaLeerImagenComprimida(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(e) {
      const src = e?.target?.result;

      if (!src) {
        reject(new Error("No pude leer la imagen."));
        return;
      }

      const img = new Image();

      img.onload = () => {
        const maxLado = 1600;
        let { width, height } = img;

        if (width > height && width > maxLado) {
          height = Math.round(height * (maxLado / width));
          width = maxLado;
        } else if (height >= width && height > maxLado) {
          width = Math.round(width * (maxLado / height));
          height = maxLado;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("No pude preparar la imagen."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };

      img.onerror = () => reject(new Error("La imagen no se pudo cargar."));
      img.src = src;
    };

    reader.onerror = () => reject(new Error("No pude leer el archivo."));
    reader.readAsDataURL(file);
  });
}

async function temaAsegurarImagenSeleccionadaEnDraft({ aplicarVisual = false } = {}) {
  if (!fondoTemaDraft) return false;

  const input = document.getElementById("imgFondoApp");
  const file = input?.files?.[0];

  if (!file) return false;

  const firma = temaGetFirmaImagenInput();

  if (
    input.dataset.temaAplicadoFirma === firma &&
    fondoTemaDraft.tipo === "imagen" &&
    String(fondoTemaDraft.valor || "").startsWith("data:")
  ) {
    return true;
  }

  const dataUrl = await temaLeerImagenComprimida(file);

  fondoTemaDraft.tipo = "imagen";
  fondoTemaDraft.valor = dataUrl;

  input.dataset.temaAplicadoFirma = firma;

  const nombreImagen = document.getElementById("temaNombreImagen");
  if (nombreImagen) nombreImagen.textContent = file.name || "Imagen seleccionada";

  if (aplicarVisual) {
    aplicarDraftTemaVisual();
  }

  return true;
}

function temaSincronizarDraftDesdeControles() {
  if (!fondoTemaDraft) return;

  const slider = document.getElementById("opacidadFondoApp");
  if (slider) {
    fondoTemaDraft.opacidad = slider.value || "0.35";
  }

  const inputTexto = document.getElementById("colorTextoApp");
  if (inputTexto) {
    fondoTemaDraft.colorTexto = inputTexto.value || "";
  }

  const btnBold = document.getElementById("btnBoldTextoBiblia");
  if (btnBold) {
    fondoTemaDraft.textoBold = btnBold.classList.contains("activo");
  }

  const radioImagen = document.getElementById("temaFondoImagen");
  const usarImagen = !!radioImagen?.checked;

  if (!usarImagen) {
    const inputColor = document.getElementById("colorFondoApp");

    fondoTemaDraft.tipo = "color";
    fondoTemaDraft.valor = inputColor?.value || fondoTemaDraft.valor || "#ffffff";
  }
}

function asegurarControlAmbitoTema() {
  if (!fondoTemaDraft) return;

  const host = document.getElementById("fondoSeccionActualLabel");
  if (!host) return;

  const nombre = getNombreSeccionTema(fondoTemaDraft.seccion);
  const ambito = fondoTemaDraft.ambito || "seccion";

  host.classList.add("tema-ambito-wrap");

  host.innerHTML = `
    <button
      type="button"
      id="btnTemaAmbitoSeccion"
      class="tema-ambito-btn ${ambito !== "todas" ? "activo" : ""}"
      onclick="cambiarAmbitoFondoTema('seccion')"
    >
      ${nombre}
    </button>

    <span class="tema-ambito-sep">/</span>

    <button
      type="button"
      id="btnTemaAmbitoTodas"
      class="tema-ambito-btn ${ambito === "todas" ? "activo" : ""}"
      onclick="cambiarAmbitoFondoTema('todas')"
    >
      Todas
    </button>
  `;
}

window.cambiarAmbitoFondoTema = function cambiarAmbitoFondoTema(ambito) {
  if (!fondoTemaDraft) return;

  fondoTemaDraft.ambito = ambito === "todas" ? "todas" : "seccion";

  asegurarControlAmbitoTema();
  asegurarControlColorTextoTema();
  aplicarDraftTemaVisual();
  reflejarDraftEnModal();
};

function getSeccionActualFondoKey() {
  if (document.body.classList.contains("en-iglesia")) return "iglesia";
  if (document.body.classList.contains("en-panel")) return "panel";
  if (document.body.classList.contains("en-compartidos")) return "compartidos";
  return "biblia";
}

function getFondoStorageKey(seccion) {
  return `fondoApp_${seccion}`;
}

function getFondoTipoStorageKey(seccion) {
  return `fondoTipo_${seccion}`;
}

function getFondoOpacidadStorageKey(seccion) {
  return `fondoOpacidad_${seccion}`;
}

function getFondoTextoStorageKey(seccion) {
  return `fondoTexto_${seccion}`;
}

function getFondoTextoBoldStorageKey(seccion) {
  return `fondoTextoBold_${seccion}`;
}

function normalizarEstadoApariencia(seccion, estado = {}) {
  return {
    seccion,
    tipo: estado.tipo || "color",
    valor: estado.valor || "#ffffff",
    opacidad: String(estado.opacidad ?? "0.35"),
    colorTexto: estado.colorTexto || "",
    textoBold: estado.textoBold === true || estado.textoBold === "1" || estado.textoBold === "true"
  };
}

function getAparienciaFirebasePath(seccion) {
  if (!uid) return null;
  return `usuariosConfig/${uid}/apariencia/${seccion}`;
}

function getEstadoGuardadoSeccion(seccion) {
  return normalizarEstadoApariencia(seccion, {
    tipo: localStorage.getItem(getFondoTipoStorageKey(seccion)) || "color",
    valor: localStorage.getItem(getFondoStorageKey(seccion)) || "#ffffff",
    opacidad: localStorage.getItem(getFondoOpacidadStorageKey(seccion)) || "0.35",
    colorTexto: localStorage.getItem(getFondoTextoStorageKey(seccion)) || "",
    textoBold: localStorage.getItem(getFondoTextoBoldStorageKey(seccion)) === "1"
  });
}

function guardarEstadoSeccion(seccion, estado) {
  const limpio = normalizarEstadoApariencia(seccion, estado);

  localStorage.setItem(getFondoTipoStorageKey(seccion), limpio.tipo);
  localStorage.setItem(getFondoStorageKey(seccion), limpio.valor);
  localStorage.setItem(getFondoOpacidadStorageKey(seccion), String(limpio.opacidad));
  localStorage.setItem(getFondoTextoStorageKey(seccion), limpio.colorTexto || "");
  localStorage.setItem(getFondoTextoBoldStorageKey(seccion), limpio.textoBold ? "1" : "0");
}

async function guardarEstadoSeccionFirebase(seccion, estado) {
  if (!uid) return;

  const path = getAparienciaFirebasePath(seccion);
  if (!path) return;

  const limpio = normalizarEstadoApariencia(seccion, estado);

  await set(ref(db, path), {
    tipo: limpio.tipo,
    valor: limpio.valor,
    opacidad: limpio.opacidad,
    colorTexto: limpio.colorTexto || "",
    textoBold: !!limpio.textoBold,
    actualizado: Date.now()
  });
}

async function cargarFondosFirebaseUsuario() {
  if (!uid) {
    aplicarFondosGuardados();
    return;
  }

  try {
    for (const seccion of Object.keys(FONDO_SECCIONES)) {
      const path = getAparienciaFirebasePath(seccion);
      if (!path) continue;

      const snap = await get(ref(db, path));
      const remoto = snap.val();

      if (!remoto) continue;

      const limpio = normalizarEstadoApariencia(seccion, remoto);

      // ✅ guardo copia local rápida
      guardarEstadoSeccion(seccion, limpio);

      // ✅ aplico visualmente
      aplicarEstadoVisualSeccion(seccion, limpio);
    }

    limpiarFondosInternosApp();
  } catch (e) {
    console.warn("No pude cargar apariencia desde Firebase:", e);
    aplicarFondosGuardados();
  }
}

async function subirFondoTemaAR2(dataUrl, seccion) {
  const s = String(dataUrl || "");
  if (!s.startsWith("data:")) return s;

  const match = s.match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error("Imagen inválida.");

  const contentType = match[1] || "image/jpeg";
  const fileBase64 = match[2] || "";

  const r = await fetch(R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64,
      fileName: `fondo-${seccion}-${Date.now()}.jpg`,
      contentType,
      folder: "fondos-app"
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.ok || !data?.url) {
    throw new Error(data?.error || data?.detail || "No se pudo subir el fondo a R2.");
  }

  return data.url;
}

async function prepararEstadoTemaParaGuardar(estado) {
  const limpio = normalizarEstadoApariencia(estado?.seccion || getSeccionActualFondoKey(), estado);

  // ✅ si es imagen nueva en dataUrl, la subimos a R2 y guardamos URL
  if (limpio.tipo === "imagen" && String(limpio.valor || "").startsWith("data:")) {
    limpio.valor = await subirFondoTemaAR2(limpio.valor, limpio.seccion);
  }

  return limpio;
}

function getElementoSeccionFondo(seccion) {
  const cfg = FONDO_SECCIONES[seccion];
  if (!cfg) return null;

  return document.getElementById(cfg.seccionId);
}

function getElementoCapaFondo(seccion) {
  const cfg = FONDO_SECCIONES[seccion];
  if (!cfg) return null;

  return document.getElementById(cfg.fondoId);
}

function limpiarFondosInternosApp() {
  [
    document.getElementById("iglesia-devocionales"),
    document.getElementById("iglesia-abc"),
    document.getElementById("iglesia-subidos"),
    document.getElementById("subidosApp"),
    document.getElementById("iglesia-recursos"),
    document.getElementById("recursos-rh"),
    document.getElementById("recursos-talleres"),
    document.getElementById("recursos-hermanos"),
    document.getElementById("recursos-permisos"),
    document.getElementById("panel-imagenes"),
    document.getElementById("panel-marcadores")
  ].filter(Boolean).forEach(el => {
    el.style.background = "none";
    el.style.backgroundImage = "none";
    el.style.backgroundColor = "transparent";
    el.style.backgroundRepeat = "";
    el.style.backgroundPosition = "";
    el.style.backgroundSize = "";
    el.style.backgroundAttachment = "";
    el.style.opacity = "";
  });
}

function aplicarEstadoVisualSeccion(seccion, estado) {
  const el = getElementoSeccionFondo(seccion);
  const capa = getElementoCapaFondo(seccion);
  const textoBiblia = document.getElementById("texto");
  if (!el || !capa) return;

  const limpio = normalizarEstadoApariencia(seccion, estado);

  const tipo = limpio.tipo;
  const valor = limpio.valor || "#ffffff";
  const opacidad = String(limpio.opacidad || "0.35");
  const colorTexto = limpio.colorTexto || "";

  el.style.background = "none";
  el.style.backgroundImage = "none";
  el.style.backgroundColor = "transparent";

  if (tipo === "imagen") {
    capa.style.backgroundImage = `url("${valor}")`;
    capa.style.backgroundColor = "transparent";
  } else {
    capa.style.backgroundImage = "none";
    capa.style.backgroundColor = valor;
  }

  const abcContenido = document.getElementById("abcContenido");
  const iglesiaABC = document.getElementById("iglesia-abc");
  const abcVisible =
    seccion === "iglesia" &&
    abcContenido &&
    iglesiaABC &&
    iglesiaABC.style.display !== "none";

  // ✅ IMPORTANTE:
  // En Biblia, el slider toca el recuadro detrás de #texto.
  // En ABC, el slider toca el recuadro detrás del HTML.
  if (seccion === "biblia") {
    capa.style.opacity = "1";

    if (textoBiblia) {
      textoBiblia.style.setProperty("--va-biblia-box-opacity", opacidad);
    }
  } else if (abcVisible) {
    capa.style.opacity = "1";
    abcContenido.style.setProperty("--va-abc-box-opacity", opacidad);
  } else {
    capa.style.opacity = opacidad;

    // ✅ No borrar la opacidad del wrapper ABC cuando aplicarFondosGuardados()
    // recorre Biblia / Panel / Compartidos después de Iglesia.
    if (seccion === "iglesia" && abcContenido && !abcVisible) {
      abcContenido.style.removeProperty("--va-abc-box-opacity");
    }
  }
  
  // ✅ Reset de variables de texto
  el.style.color = "";
  el.style.removeProperty("--va-color-texto");
  el.style.removeProperty("--va-color-texto-biblia");
  el.style.removeProperty("--va-peso-texto-biblia");

  // ✅ Color y bold SOLO para el texto bíblico
  if (seccion === "biblia") {
    if (colorTexto) {
      el.style.setProperty("--va-color-texto-biblia", colorTexto);
    }

    if (limpio.textoBold) {
      el.style.setProperty("--va-peso-texto-biblia", "700");
    }
  }
}

function aplicarFondosGuardados() {
  Object.keys(FONDO_SECCIONES).forEach(seccion => {
    aplicarEstadoVisualSeccion(seccion, getEstadoGuardadoSeccion(seccion));
  });

  limpiarFondosInternosApp();
}

function cargarDraftDesdeGuardado(seccion) {
  const guardado = getEstadoGuardadoSeccion(seccion);

  fondoTemaDraft = {
    seccion,
    ambito: "seccion",
    tipo: guardado.tipo,
    valor: guardado.valor,
    opacidad: guardado.opacidad,
    colorTexto: guardado.colorTexto || "",
    textoBold: !!guardado.textoBold
  };
}

function repintarTextoBibliaTema() {
  try {
    const tocaBiblia =
      fondoTemaDraft?.seccion === "biblia" ||
      fondoTemaDraft?.ambito === "todas";

    if (
      tocaBiblia &&
      obtenerSeccionActual() === "biblia" &&
      typeof mostrarTexto === "function"
    ) {
      mostrarTexto({ guardar: false });
    }
  } catch(e) {}
}

function asegurarControlColorTextoTema() {
  const modal = document.getElementById("modalTema");
  if (!modal) return;

  let box = document.getElementById("colorTextoAppBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "colorTextoAppBox";
    box.className = "tema-linea tema-linea-full tema-color-texto-box";

    box.innerHTML = `
      <span class="tema-label">Texto bíblico</span>

      <div class="tema-control-row tema-control-row-texto-biblico">
        <input
          id="colorTextoApp"
          type="hidden"
          value="#111111"
        >

        <button
          type="button"
          id="colorTextoAppHost"
          class="pickr-host"
          data-target="#colorTextoApp"
          aria-label="Color de texto bíblico"
        ></button>

        <button
          type="button"
          id="btnBoldTextoBiblia"
          class="btn-bold-biblia"
          onclick="toggleBoldTextoBiblia()"
          title="Texto bíblico en negrita"
        >B</button>
      </div>
    `;
  }

  // ✅ Siempre lo reubicamos antes de Opacidad.
  // Así no queda perdido entre Color/Imagen.
  const labelOpacidad = document.getElementById("labelOpacidadTema");
  const lineaOpacidad = labelOpacidad?.closest(".tema-linea");

  if (lineaOpacidad && box.nextElementSibling !== lineaOpacidad) {
    lineaOpacidad.insertAdjacentElement("beforebegin", box);
  } else if (!lineaOpacidad) {
    modal.querySelector(".tema-grid")?.appendChild(box);
  }

const mostrarTextoBiblico =
  fondoTemaDraft?.seccion === "biblia" ||
  fondoTemaDraft?.ambito === "todas";

box.classList.toggle("oculto", !mostrarTextoBiblico);
box.style.display = mostrarTextoBiblico ? "flex" : "none";

  const input = document.getElementById("colorTextoApp");

  if (input && !input.dataset.ready) {
    input.dataset.ready = "1";

    const handler = () => {
      if (!fondoTemaDraft) return;

      fondoTemaDraft.colorTexto = input.value || "";

aplicarDraftTemaVisual();
    };

    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  }

  setTimeout(() => {
    if (typeof initPickrEnHosts === "function") {
      initPickrEnHosts("#colorTextoAppHost");
    }
  }, 0);
}

window.aplicarColorTextoTema = () => {
  if (!fondoTemaDraft) return;

  const input = document.getElementById("colorTextoApp");
  if (!input) return;

  fondoTemaDraft.colorTexto = input.value || "";

  aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
  limpiarFondosInternosApp();
  repintarTextoBibliaTema();
};

window.toggleBoldTextoBiblia = () => {
  if (!fondoTemaDraft) return;

  fondoTemaDraft.textoBold = !fondoTemaDraft.textoBold;

  const btn = document.getElementById("btnBoldTextoBiblia");
  if (btn) btn.classList.toggle("activo", !!fondoTemaDraft.textoBold);

  aplicarEstadoVisualSeccion(fondoTemaDraft.seccion, fondoTemaDraft);
  limpiarFondosInternosApp();
  repintarTextoBibliaTema();
};

function reflejarDraftEnModal() {
  if (!fondoTemaDraft) return;

  asegurarControlColorTextoTema();

const label = document.getElementById("fondoSeccionActualLabel");
const labelOpacidad = document.getElementById("labelOpacidadTema");
const slider = document.getElementById("opacidadFondoApp");
const inputColor = document.getElementById("colorFondoApp");
const inputTexto = document.getElementById("colorTextoApp");

asegurarControlAmbitoTema();

  if (labelOpacidad) {
    const estoyEnABC =
      fondoTemaDraft.seccion === "iglesia" &&
      document.body.classList.contains("en-abc");

    labelOpacidad.textContent =
      fondoTemaDraft.seccion === "biblia" || estoyEnABC
        ? "Opacidad del recuadro"
        : "Opacidad del fondo";
  }

  if (slider) {
    slider.value = String(fondoTemaDraft.opacidad || "0.35");
  }

  const nombreImagen = document.getElementById("temaNombreImagen");
const radioColor = document.getElementById("temaFondoColor");
const radioImagen = document.getElementById("temaFondoImagen");
const boxColor = document.getElementById("temaBoxColor");
const boxImagen = document.getElementById("temaBoxImagen");

const esImagenGuardada =
  fondoTemaDraft.tipo === "imagen" &&
  String(fondoTemaDraft.valor || "").trim();

if (radioColor) radioColor.checked = fondoTemaDraft.tipo !== "imagen";
if (radioImagen) radioImagen.checked = fondoTemaDraft.tipo === "imagen";

if (boxColor) boxColor.style.display = fondoTemaDraft.tipo === "imagen" ? "none" : "flex";
if (boxImagen) boxImagen.style.display = fondoTemaDraft.tipo === "imagen" ? "flex" : "none";

if (nombreImagen) {
  nombreImagen.textContent = esImagenGuardada ? "Imagen guardada" : "Ninguna";
}

  if (inputColor && fondoTemaDraft.tipo === "color") {
    inputColor.value = fondoTemaDraft.valor || "#ffffff";
    inputColor.dispatchEvent(new Event("input", { bubbles: true }));
    inputColor.dispatchEvent(new Event("change", { bubbles: true }));
  }

 const boxTextoBiblico = document.getElementById("colorTextoAppBox");
if (boxTextoBiblico) {
const mostrarTextoBiblico =
  fondoTemaDraft.seccion === "biblia" ||
  fondoTemaDraft.ambito === "todas";

  boxTextoBiblico.classList.toggle("oculto", !mostrarTextoBiblico);
  boxTextoBiblico.style.display = mostrarTextoBiblico ? "flex" : "none";
}

  if (inputTexto) {
    const colorTexto = fondoTemaDraft.colorTexto || "#111111";
    inputTexto.value = colorTexto;

    const hostTexto = document.getElementById("colorTextoAppHost");
    if (hostTexto) {
      hostTexto.style.setProperty("--pickr-color", colorTexto);
      hostTexto.style.background = colorTexto;

      try {
        if (hostTexto._pickr) {
          hostTexto._pickr.setColor(colorTexto);
        }
      } catch(e) {}
    }
  }

  const btnBoldTexto = document.getElementById("btnBoldTextoBiblia");
  if (btnBoldTexto) {
    btnBoldTexto.classList.toggle("activo", !!fondoTemaDraft.textoBold);
  }
}

window.abrirModalTema = () => {
  const modal = document.getElementById("modalTema");
  if (!modal) return;

  guardarBackupTemaActual();

  const seccion = getSeccionActualFondoKey();
  cargarDraftDesdeGuardado(seccion);

  const inputImagen = document.getElementById("imgFondoApp");
  if (inputImagen) {
    inputImagen.value = "";
    inputImagen.dataset.temaAplicadoFirma = "";
  }

  const boxTextoBiblico = document.getElementById("colorTextoAppBox");
  if (boxTextoBiblico && seccion !== "biblia") {
    boxTextoBiblico.classList.add("oculto");
    boxTextoBiblico.style.display = "none";
  }

  reflejarDraftEnModal();

  modal.style.display = "flex";

  setTimeout(() => {
    if (typeof initPickrEnHosts === "function") {
      initPickrEnHosts("#colorFondoAppHost, #colorTextoAppHost");
    }
  }, 0);
};

window.temaMostrarFondo = function(tipo) {
  const boxColor = document.getElementById("temaBoxColor");
  const boxImagen = document.getElementById("temaBoxImagen");
  const radioColor = document.getElementById("temaFondoColor");
  const radioImagen = document.getElementById("temaFondoImagen");

  const esImagen = tipo === "imagen";

  if (boxColor) boxColor.style.display = esImagen ? "none" : "flex";
  if (boxImagen) boxImagen.style.display = esImagen ? "flex" : "none";

  if (radioColor) radioColor.checked = !esImagen;
  if (radioImagen) radioImagen.checked = esImagen;
};

window.cerrarModalTema = () => {
  const modal = document.getElementById("modalTema");
  if (modal) modal.style.display = "none";
};

window.aplicarColorFondo = () => {
  if (!fondoTemaDraft) return;

  const input = document.getElementById("colorFondoApp");
  if (!input) return;

  fondoTemaDraft.tipo = "color";
  fondoTemaDraft.valor = input.value || "#ffffff";

  aplicarDraftTemaVisual();
};

window.aplicarImagenFondo = async () => {
  if (!fondoTemaDraft) return;

  try {
    const ok = await temaAsegurarImagenSeleccionadaEnDraft({
      aplicarVisual: true
    });

    if (!ok) {
      alert("Elegí una imagen primero.");
    }
  } catch (e) {
    console.error("No pude aplicar la imagen:", e);
    alert("No pude aplicar la imagen.\n\n" + (e?.message || e));
  }
};

window.confirmarFondoTema = async () => {
  if (!fondoTemaDraft) return;

  try {
    temaSincronizarDraftDesdeControles();

    const radioImagen = document.getElementById("temaFondoImagen");

    // ✅ Si eligió una imagen pero no tocó "Aplicar",
    // igual la procesamos y se guarda correctamente.
    if (radioImagen?.checked) {
      await temaAsegurarImagenSeleccionadaEnDraft({
        aplicarVisual: false
      });
    }

    let estadoBase = normalizarEstadoApariencia(
      fondoTemaDraft.seccion || getSeccionActualFondoKey(),
      fondoTemaDraft
    );

    // ✅ Si se aplica a todas, subimos la imagen una sola vez.
    if (
      estadoBase.tipo === "imagen" &&
      String(estadoBase.valor || "").startsWith("data:")
    ) {
      estadoBase.valor = await subirFondoTemaAR2(
        estadoBase.valor,
        fondoTemaDraft.ambito === "todas" ? "todas" : estadoBase.seccion
      );
    }

    const seccionesDestino = getSeccionesTemaDestino();

    for (const seccion of seccionesDestino) {
      const estadoFinal = normalizarEstadoApariencia(seccion, {
        ...estadoBase,
        seccion
      });

      guardarEstadoSeccion(seccion, estadoFinal);
      await guardarEstadoSeccionFirebase(seccion, estadoFinal);
    }

    fondoTemaDraft = null;
    fondoTemaBackupAbrir = null;

    aplicarFondosGuardados();
    cerrarModalTema();

  } catch (e) {
    console.error("Error al confirmar apariencia:", e);
    alert("No se pudo guardar la apariencia.\n\n" + (e?.message || e));
  }
};

window.cancelarFondoTema = () => {
  restaurarBackupTemaVisual();

  fondoTemaDraft = null;
  fondoTemaBackupAbrir = null;

  cerrarModalTema();
};

// ================= 📱 FIJAR ALTO DEL FONDO EN CELULAR =================
(function fijarAltoFondoEnCelular(){
  const esMovil = window.matchMedia("(max-width: 800px)").matches;
  if (!esMovil) return;

  function fijarAlto(){
    const alto = window.innerHeight || document.documentElement.clientHeight;
    document.documentElement.style.setProperty("--va-alto-fondo-fijo", alto + "px");
  }

  fijarAlto();

  // Solo recalcula si girás el celular, NO mientras scrolleás
  window.addEventListener("orientationchange", () => {
    setTimeout(fijarAlto, 400);
  });
})();

// ================= CARGAR FONDOS AL INICIAR =================
window.addEventListener("load", () => {
  aplicarFondosGuardados();

  // ✅ si ya hay usuario, después pisa con Firebase
  setTimeout(() => {
    cargarFondosFirebaseUsuario();
  }, 300);

  const slider = document.getElementById("opacidadFondoApp");
  if (slider && !slider.dataset.ready) {
    slider.dataset.ready = "1";

slider.addEventListener("input", () => {
  if (!fondoTemaDraft) return;

  fondoTemaDraft.opacidad = slider.value || "0.35";

  aplicarDraftTemaVisual();
});
  }
});
