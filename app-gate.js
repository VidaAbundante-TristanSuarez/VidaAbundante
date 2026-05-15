/* ================= APP GATE VIDA ABUNDANTE V3 ================= */
/* Instalar app / Ver en web / Login sin bucles */

(function(){
  const KEY_INSTALADA = "VA_APP_INSTALADA";
  const KEY_VER_WEB = "VA_VER_WEB_OK";
  const KEY_SIN_LOGIN = "VA_SIN_LOGIN_OK";

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

  function vaPuedeVerWeb(){
    return localStorage.getItem(KEY_VER_WEB) === "1";
  }

  function vaPuedeSinLogin(){
    return localStorage.getItem(KEY_SIN_LOGIN) === "1";
  }

  function vaEsLoginPage(){
    return /\/login\.html$/i.test(location.pathname);
  }

  function vaHayLogin(){
    return !!(
      window.__UID ||
      window.__FB?.auth?.currentUser?.uid
    );
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
          radial-gradient(circle at top left, rgba(166,208,255,.55), transparent 34%),
          radial-gradient(circle at bottom right, rgba(233,246,255,.95), transparent 42%),
          linear-gradient(180deg, #ffffff, #eef8ff);
        font-family: Arial, sans-serif;
        color:#111;
      }

      #vaAppGate.va-abierto{
        display:flex;
      }

      .va-app-card{
        position:relative;
        width:min(92vw, 410px);
        padding:30px 24px 24px;
        border-radius:30px;
        background:
          radial-gradient(circle at top left, rgba(166,208,255,.48), transparent 42%),
          radial-gradient(circle at bottom right, rgba(233,246,255,.9), transparent 48%),
          rgba(255,255,255,.94);
        border:1px solid rgba(255,255,255,.9);
        box-shadow:
          0 22px 60px rgba(0,0,0,.18),
          inset 0 1px 0 rgba(255,255,255,.9);
        text-align:center;
        overflow:hidden;
      }

      .va-app-card::before{
        content:"";
        position:absolute;
        width:160px;
        height:160px;
        right:-75px;
        top:-75px;
        border-radius:999px;
        background:rgba(166,208,255,.38);
      }

      .va-app-card::after{
        content:"";
        position:absolute;
        width:120px;
        height:120px;
        left:-60px;
        bottom:-60px;
        border-radius:999px;
        background:rgba(233,246,255,.9);
      }

      .va-app-content{
        position:relative;
        z-index:2;
      }

      .va-app-icon{
        width:62px;
        height:62px;
        margin:0 auto 14px;
        border-radius:999px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:linear-gradient(180deg, #e9f6ff, #a6d0ff);
        color:#111;
        box-shadow:0 10px 24px rgba(0,0,0,.14);
      }

      .va-app-icon i{
        font-size:26px;
        line-height:1;
      }

      .va-app-title{
        margin:0;
        font-family: Georgia, "Times New Roman", serif;
        font-size:21px;
        font-weight:900;
        line-height:1.18;
        color:#111;
      }

      .va-app-text{
        margin:13px auto 22px;
        max-width:340px;
        font-size:14px;
        line-height:1.45;
        color:#263238;
      }

      .va-app-actions{
        display:flex;
        flex-direction:column;
        gap:10px;
      }

      .va-app-btn{
        width:100%;
        min-height:46px;
        border:none;
        border-radius:999px;
        padding:0 18px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        font-weight:900;
        font-size:14px;
        cursor:pointer;
      }

      .va-app-btn-primary{
        background:#a6d0ff;
        color:#000;
        box-shadow:0 8px 18px rgba(0,0,0,.16);
      }

      .va-app-btn-light{
        margin-top:2px;
        background:transparent;
        color:#263238;
        font-size:13px;
        font-weight:800;
        box-shadow:none;
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
        <div class="va-app-content">
          <div class="va-app-icon">
            <i class="fa-solid fa-dove"></i>
          </div>

          <h2 class="va-app-title">
            Bendecido hermano, bienvenido<br>
            a Vida Abundante App
          </h2>

          <p class="va-app-text">
            Puedes instalar la app en tu celular, o continuar viéndola desde la web.
          </p>

          <div class="va-app-actions">
            <button type="button" class="va-app-btn va-app-btn-primary" id="vaBtnInstalarApp">
              <i class="fa-solid fa-download"></i>
              Descargar app
            </button>

            <button type="button" class="va-app-btn va-app-btn-light" id="vaBtnVerWeb">
              Ver en web
            </button>
          </div>

          <div class="va-app-ayuda" id="vaAppAyuda"></div>
        </div>
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

    ayuda.innerHTML = `
      <strong>No pude abrir la instalación automática.</strong>
      En algunos celulares el navegador no permite instalar desde un botón.
      Si querés que sea una descarga directa como archivo, necesitamos hacer una versión APK para Android.
    `;

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
          localStorage.setItem(KEY_VER_WEB, "1");
          vaCerrarGate();
          vaEntradaLimpia();
          return;
        }

        return;
      }

      vaMostrarAyudaInstalacion();

    } catch(e) {
      console.warn("No se pudo abrir instalación:", e);
      vaMostrarAyudaInstalacion();
    }
  }

  function vaVerEnWeb(){
    localStorage.setItem(KEY_VER_WEB, "1");
    vaCerrarGate();

    if (vaEsLoginPage()) return;

    vaEntradaLimpia();
  }

  function vaIrLogin(){
    if (vaEsLoginPage()) return;

    localStorage.setItem(KEY_VER_WEB, "1");
    location.href = "/VidaAbundante/login.html";
  }

  function vaIrHome(){
    localStorage.setItem(KEY_VER_WEB, "1");
    location.href = "/VidaAbundante/";
  }

  function vaEntradaLimpia(){
    // Si no está instalada y nunca eligió web, mostrar cartel.
    if (!vaAppInstalada() && !vaPuedeVerWeb()) {
      vaMostrarGate();
      return;
    }

    // En login.html no hacemos nada más: dejamos ver login.
    if (vaEsLoginPage()) {
      vaCerrarGate();
      return;
    }

    let intentos = 0;

    const tick = () => {
      intentos++;

      // Si está logueado, va a Compartidos.
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

      // Si eligió continuar sin login, dejamos la web visible sin mandar a login.
      if (vaPuedeSinLogin()) {
        return;
      }

      // Si no hay login, mandamos a login una sola vez.
      if (intentos > 8 && !vaHayLogin()) {
        vaIrLogin();
        return;
      }

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
    localStorage.setItem(KEY_VER_WEB, "1");
    vaCerrarGate();
    vaEntradaLimpia();
  });

  window.VAAppGate = {
    instalada: vaAppInstalada,
    mostrar: vaMostrarGate,
    cerrar: vaCerrarGate,
    entradaLimpia: vaEntradaLimpia,

    verWeb: function(){
      localStorage.setItem(KEY_VER_WEB, "1");
      vaCerrarGate();
    },

    continuarSinLogin: function(){
      localStorage.setItem(KEY_VER_WEB, "1");
      localStorage.setItem(KEY_SIN_LOGIN, "1");
      vaIrHome();
    },

    cerrarSesion: function(){
      localStorage.removeItem(KEY_SIN_LOGIN);
    },

    resetPrueba: function(){
      localStorage.removeItem(KEY_INSTALADA);
      localStorage.removeItem(KEY_VER_WEB);
      localStorage.removeItem(KEY_SIN_LOGIN);
      location.href = "/VidaAbundante/";
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    vaCrearGate();
    vaEntradaLimpia();
  });
})();
