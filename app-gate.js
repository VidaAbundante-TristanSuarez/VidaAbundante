/* ================= APP GATE VIDA ABUNDANTE ================= */
/* Muestra Instalar app / Ver en web antes de login o entrada */

(function(){
  const KEY_INSTALADA = "VA_APP_INSTALADA";
  const KEY_VER_WEB = "VA_VER_WEB_OK";

  let deferredPrompt = null;

  function vaEsStandalone(){
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  }

  function vaAppInstalada(){
    return (
      vaEsStandalone() ||
      localStorage.getItem(KEY_INSTALADA) === "1"
    );
  }

  function vaDebeMostrarGate(){
    return (
      !vaAppInstalada() &&
      sessionStorage.getItem(KEY_VER_WEB) !== "1"
    );
  }

  function vaEsLoginPage(){
    return /\/login\.html$/i.test(location.pathname);
  }

  function vaCrearEstilos(){
    if (document.getElementById("vaAppGateStyle")) return;

    const st = document.createElement("style");
    st.id = "vaAppGateStyle";
    st.textContent = `
      #vaAppGate{
        position:fixed;
        inset:0;
        z-index:999999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:
          radial-gradient(circle at top left, rgba(166,208,255,.45), transparent 42%),
          radial-gradient(circle at bottom right, rgba(233,246,255,.70), transparent 42%),
          linear-gradient(180deg, #ffffff, #eefaff);
        font-family: Arial, sans-serif;
        color:#111;
      }

      #vaAppGate.va-abierto{
        display:flex;
      }

      .va-app-card{
        position:relative;
        width:min(420px, 92vw);
        padding:30px 24px 24px;
        border-radius:30px;
        background:
          radial-gradient(circle at top right, rgba(166,208,255,.45), transparent 30%),
          radial-gradient(circle at bottom left, rgba(233,246,255,.65), transparent 30%),
          rgba(255,255,255,.92);
        box-shadow:0 22px 60px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.9);
        border:1px solid rgba(166,208,255,.65);
        text-align:center;
        overflow:hidden;
      }

      .va-app-icon{
        width:64px;
        height:64px;
        margin:0 auto 14px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:#d1eeff;
        box-shadow:0 8px 22px rgba(0,0,0,.12);
      }

      .va-app-icon img{
        width:48px;
        height:48px;
        border-radius:999px;
        object-fit:cover;
      }

      .va-app-title{
        margin:0 0 8px;
        font-family: Georgia, "Times New Roman", serif;
        font-size:23px;
        line-height:1.08;
        color:#000;
      }

      .va-app-text{
        margin:0 auto 18px;
        max-width:310px;
        font-size:14px;
        line-height:1.4;
      }

      .va-app-actions{
        display:flex;
        flex-direction:column;
        gap:10px;
        margin-top:12px;
      }

      .va-app-btn{
        border:0;
        border-radius:999px;
        padding:13px 16px;
        font-weight:800;
        font-size:15px;
        cursor:pointer;
      }

      .va-app-btn-primary{
        background:#a6d0ff;
        color:#000;
        box-shadow:0 8px 20px rgba(0,0,0,.14);
      }

      .va-app-btn-light{
        background:transparent;
        color:#000;
      }

      .va-app-ayuda{
        display:none;
        margin-top:12px;
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.82);
        border:1px solid rgba(0,0,0,.08);
        font-size:13px;
        line-height:1.35;
        text-align:left;
      }

      .va-app-ayuda strong{
        display:block;
        margin-bottom:4px;
      }
    `;

    document.head.appendChild(st);
  }

  function vaCrearGate(){
    if (document.getElementById("vaAppGate")) return;

    vaCrearEstilos();

    const div = document.createElement("div");
    div.id = "vaAppGate";

    div.innerHTML = `
      <div class="va-app-card">
        <div class="va-app-icon">
          <img src="/VidaAbundante/img/app/icon-192.png" alt="Vida Abundante">
        </div>

        <h2 class="va-app-title">
          Vida Abundante App
        </h2>

        <p class="va-app-text">
          Podés instalar la app en tu celular o continuar viéndola desde la web.
        </p>

        <div class="va-app-actions">
          <button type="button" class="va-app-btn va-app-btn-primary" id="vaBtnInstalarApp">
            Descargar app
          </button>

          <button type="button" class="va-app-btn va-app-btn-light" id="vaBtnVerWeb">
            Ver en web
          </button>
        </div>

        <div class="va-app-ayuda" id="vaAppAyuda"></div>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("vaBtnInstalarApp")?.addEventListener("click", vaInstalarApp);
    document.getElementById("vaBtnVerWeb")?.addEventListener("click", vaVerEnWeb);
  }

  function vaMostrarGate(){
    vaCrearGate();
    const gate = document.getElementById("vaAppGate");
    if (gate) gate.classList.add("va-abierto");
  }

  function vaCerrarGate(){
    const gate = document.getElementById("vaAppGate");
    if (gate) gate.classList.remove("va-abierto");
  }

  function vaMostrarAyudaInstalacion(){
    const ayuda = document.getElementById("vaAppAyuda");
    if (!ayuda) return;

    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const esAndroid = /android/i.test(navigator.userAgent);

    if (esIOS) {
      ayuda.innerHTML = `
        <strong>Para instalar en iPhone:</strong>
        Tocá el botón de compartir de Safari y elegí
        <b>Agregar a pantalla de inicio</b>.
      `;
    } else if (esAndroid) {
      ayuda.innerHTML = `
        <strong>Para instalar en Android:</strong>
        Tocá el menú de Chrome ⋮ y elegí
        <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.
      `;
    } else {
      ayuda.innerHTML = `
        <strong>Instalación:</strong>
        Si tu navegador no muestra el cartel automático,
        buscá la opción <b>Instalar app</b> en el menú del navegador.
      `;
    }

    ayuda.style.display = "block";
  }

  async function vaInstalarApp(){
    try {
      if (deferredPrompt) {
        deferredPrompt.prompt();

        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;

        if (choice?.outcome === "accepted") {
          localStorage.setItem(KEY_INSTALADA, "1");
          sessionStorage.setItem(KEY_VER_WEB, "1");
          vaCerrarGate();
          vaEntradaLimpia();
          return;
        }
      }

      vaMostrarAyudaInstalacion();

    } catch(e) {
      console.warn("No se pudo abrir instalación:", e);
      vaMostrarAyudaInstalacion();
    }
  }

  function vaVerEnWeb(){
    sessionStorage.setItem(KEY_VER_WEB, "1");
    vaCerrarGate();
    vaEntradaLimpia();
  }

  function vaHayLogin(){
    return !!(
      window.__UID ||
      window.__FB?.auth?.currentUser?.uid
    );
  }

  function vaAbrirLoginSiExiste(){
    if (typeof window.abrirLogin === "function") {
      window.abrirLogin();
      return true;
    }

    if (typeof window.toggleMenuSesion === "function") {
      window.toggleMenuSesion();
      return true;
    }

    return false;
  }

  function vaEntradaLimpia(){
    // ✅ Si estamos en login.html, no paseamos a otra pantalla.
    // Ahí simplemente dejamos ver las opciones de login.
    if (vaEsLoginPage()) return;

    let intentos = 0;

    const tick = () => {
      intentos++;

      // ✅ Si hay usuario, vamos limpio a Compartidos
      if (vaHayLogin()) {
        if (typeof window.irA === "function") {
          try {
            window.irA("compartidos");
            window.scrollTo(0, 0);
            return;
          } catch(e) {
            console.warn("No pude ir a Compartidos todavía:", e);
          }
        }
      }

      // ✅ Si no hay login y existe modal de login, abrirlo
      if (intentos > 10 && !vaHayLogin()) {
        if (vaAbrirLoginSiExiste()) return;
      }

      // Intentar un ratito porque Firebase/router a veces carga después
      if (intentos < 24) {
        setTimeout(tick, 250);
      }
    };

    tick();
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem(KEY_INSTALADA, "1");
    sessionStorage.setItem(KEY_VER_WEB, "1");
    vaCerrarGate();
    vaEntradaLimpia();
  });

  window.VAAppGate = {
    instalada: vaAppInstalada,
    mostrar: vaMostrarGate,
    cerrar: vaCerrarGate,
    entradaLimpia: vaEntradaLimpia
  };

  document.addEventListener("DOMContentLoaded", () => {
    vaCrearGate();

    if (vaDebeMostrarGate()) {
      vaMostrarGate();
      return;
    }

    vaEntradaLimpia();
  });
})();
