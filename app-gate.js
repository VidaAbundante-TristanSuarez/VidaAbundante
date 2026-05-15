/* ================= APP GATE VIDA ABUNDANTE - CONSEJO APP ================= */
/* Ya no muestra "Descargar app" al entrar. Solo ordena login/sin login y muestra consejo después. */

(function(){
  const KEY_MODO_WEB = "VA_MODO_WEB_OK";
  const KEY_SIN_LOGIN = "VA_CONTINUAR_SIN_LOGIN";
  const KEY_TIP_VISTO = "VA_TIP_APP_VISTO";

  function vaEsStandalone(){
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
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

  function vaPuedeSinLogin(){
    return localStorage.getItem(KEY_SIN_LOGIN) === "1";
  }

  function vaIrLogin(){
    if (vaEsLoginPage()) return;
    location.replace("/VidaAbundante/login.html");
  }

  function vaIrCompartidosCuandoEsteListo(){
    let intentos = 0;

    const tick = () => {
      intentos++;

      if (typeof window.irA === "function") {
        try {
          window.irA("compartidos");
          window.scrollTo(0, 0);
          return;
        } catch(e) {
          console.warn("Todavía no pude abrir Compartidos:", e);
        }
      }

      if (intentos < 40) {
        setTimeout(tick, 150);
      }
    };

    tick();
  }

  function vaCrearEstilosTip(){
    if (document.getElementById("vaAppTipStyle")) return;

    const st = document.createElement("style");
    st.id = "vaAppTipStyle";

    st.textContent = `
      #vaAppTip{
        position:fixed;
        inset:0;
        z-index:999999;
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        background:rgba(0,0,0,.38);
        font-family: Arial, sans-serif;
        color:#111;
      }

      #vaAppTip.va-abierto{
        display:flex;
      }

      .va-tip-card{
        position:relative;
        width:min(92vw, 410px);
        padding:30px 24px 24px;
        border-radius:30px;
        background:
          radial-gradient(circle at top left, rgba(166,208,255,.48), transparent 42%),
          radial-gradient(circle at bottom right, rgba(233,246,255,.9), transparent 48%),
          rgba(255,255,255,.96);
        border:1px solid rgba(255,255,255,.9);
        box-shadow:
          0 22px 60px rgba(0,0,0,.22),
          inset 0 1px 0 rgba(255,255,255,.9);
        text-align:center;
        overflow:hidden;
      }

      .va-tip-card::before{
        content:"";
        position:absolute;
        width:160px;
        height:160px;
        right:-75px;
        top:-75px;
        border-radius:999px;
        background:rgba(166,208,255,.38);
      }

      .va-tip-card::after{
        content:"";
        position:absolute;
        width:120px;
        height:120px;
        left:-60px;
        bottom:-60px;
        border-radius:999px;
        background:rgba(233,246,255,.9);
      }

      .va-tip-content{
        position:relative;
        z-index:2;
      }

      .va-tip-icon{
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

      .va-tip-icon i{
        font-size:26px;
        line-height:1;
      }

      .va-tip-title{
        margin:0;
        font-family: Georgia, "Times New Roman", serif;
        font-size:21px;
        font-weight:900;
        line-height:1.18;
        color:#111;
      }

      .va-tip-text{
        margin:13px auto 16px;
        max-width:340px;
        font-size:14px;
        line-height:1.45;
        color:#263238;
      }

      .va-tip-instrucciones{
        margin:0 auto 18px;
        padding:12px;
        border-radius:18px;
        background:rgba(255,255,255,.82);
        border:1px solid rgba(0,0,0,.08);
        text-align:left;
        font-size:13px;
        line-height:1.4;
        color:#263238;
      }

      .va-tip-instrucciones strong{
        display:block;
        margin-bottom:5px;
      }

      .va-tip-btn{
        width:100%;
        min-height:46px;
        border:none;
        border-radius:999px;
        padding:0 18px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        background:#a6d0ff;
        color:#000;
        font-weight:900;
        font-size:14px;
        box-shadow:0 8px 18px rgba(0,0,0,.16);
        cursor:pointer;
      }
    `;

    document.head.appendChild(st);
  }

  function vaTextoInstalacion(){
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
        Si el navegador te muestra la opción <b>Instalar app</b>, aceptala.
        Si no aparece, tocá el menú <b>⋮</b> de Chrome y elegí
        <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.
      `;
    }

    return `
      <strong>Para usarla como app:</strong>
      Si tu navegador muestra la opción <b>Instalar app</b>, aceptala.
      También podés crear un acceso directo desde el menú del navegador.
    `;
  }

  function vaCrearTip(){
    if (document.getElementById("vaAppTip")) return;

    vaCrearEstilosTip();

    const div = document.createElement("div");
    div.id = "vaAppTip";

    div.innerHTML = `
      <div class="va-tip-card">
        <div class="va-tip-content">
          <div class="va-tip-icon">
            <i class="fa-solid fa-dove"></i>
          </div>

          <h2 class="va-tip-title">
            Bendecido hermano
          </h2>

          <p class="va-tip-text">
            Te animamos a usar Vida Abundante como aplicación en tu celular
            para acceder más rápido a Biblia, devocionales, recursos y compartidos.
          </p>

          <div class="va-tip-instrucciones">
            ${vaTextoInstalacion()}
          </div>

          <button type="button" class="va-tip-btn" id="vaTipContinuar">
            Continuar en web
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("vaTipContinuar")?.addEventListener("click", () => {
      localStorage.setItem(KEY_TIP_VISTO, "1");
      div.classList.remove("va-abierto");
    });
  }

  function vaMostrarTipDespuesDeCarga(){
    if (vaEsStandalone()) return;
    if (localStorage.getItem(KEY_TIP_VISTO) === "1") return;

    const mostrar = () => {
      setTimeout(() => {
        vaCrearTip();
        const tip = document.getElementById("vaAppTip");
        if (tip) tip.classList.add("va-abierto");
      }, 900);
    };

    if (document.readyState === "complete") {
      mostrar();
    } else {
      window.addEventListener("load", mostrar, { once:true });
    }
  }

  function vaEntradaLimpia(){
    if (vaEsLoginPage()) return;

    let intentos = 0;

    const tick = () => {
      intentos++;

      if (vaHayLogin()) {
        localStorage.setItem(KEY_MODO_WEB, "1");
        localStorage.removeItem(KEY_SIN_LOGIN);

        vaIrCompartidosCuandoEsteListo();
        vaMostrarTipDespuesDeCarga();
        return;
      }

      if (vaPuedeSinLogin()) {
        localStorage.setItem(KEY_MODO_WEB, "1");

        vaIrCompartidosCuandoEsteListo();
        vaMostrarTipDespuesDeCarga();
        return;
      }

      // Espera un poco a Firebase para no mandar a login antes de saber si hay sesión.
      if (intentos > 34) {
        vaIrLogin();
        return;
      }

      setTimeout(tick, 150);
    };

    tick();
  }

  window.VAAppGate = {
    entradaLimpia: vaEntradaLimpia,

    continuarSinLogin: function(){
      localStorage.setItem(KEY_MODO_WEB, "1");
      localStorage.setItem(KEY_SIN_LOGIN, "1");
      location.replace("/VidaAbundante/");
    },

    resetPrueba: function(){
      localStorage.removeItem(KEY_MODO_WEB);
      localStorage.removeItem(KEY_SIN_LOGIN);
      localStorage.removeItem(KEY_TIP_VISTO);
      location.replace("/VidaAbundante/");
    },

    mostrarConsejoApp: function(){
      localStorage.removeItem(KEY_TIP_VISTO);
      vaMostrarTipDespuesDeCarga();
    }
  };

  document.addEventListener("DOMContentLoaded", vaEntradaLimpia);
})();
