/* ================= ENTRADA VIDA ABUNDANTE - SIMPLE Y SIN BUCLE ================= */

(function(){
  const KEY_ENTRADA = "VA_ENTRADA_OK";
  const KEY_SIN_LOGIN = "VA_SIN_LOGIN_OK";
  const KEY_TIP = "VA_TIP_APP_VISTO";

  const url = new URL(location.href);
  const vieneSinLogin = url.searchParams.get("sinLogin") === "1";
  const vieneLoginOk = url.searchParams.get("loginOk") === "1";
  const resetEntrada = url.searchParams.get("resetEntrada") === "1";

  function limpiarUrl(){
    try {
      const u = new URL(location.href);
      ["sinLogin", "loginOk", "resetEntrada"].forEach(k => u.searchParams.delete(k));
      history.replaceState({}, "", u.pathname + u.search + u.hash);
    } catch {}
  }

  function esStandalone(){
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  }

  function hayLogin(){
    return !!(
      window.__UID ||
      window.__FB?.auth?.currentUser?.uid
    );
  }

  function tieneEntradaPermitida(){
    return (
      localStorage.getItem(KEY_ENTRADA) === "1" ||
      localStorage.getItem(KEY_SIN_LOGIN) === "1" ||
      vieneSinLogin ||
      vieneLoginOk
    );
  }

  function marcarEntrada(){
    if (resetEntrada) {
      localStorage.removeItem(KEY_ENTRADA);
      localStorage.removeItem(KEY_SIN_LOGIN);
      localStorage.removeItem(KEY_TIP);
      limpiarUrl();
      return;
    }

    if (vieneSinLogin) {
      localStorage.setItem(KEY_ENTRADA, "1");
      localStorage.setItem(KEY_SIN_LOGIN, "1");
      limpiarUrl();
      return;
    }

    if (vieneLoginOk) {
      localStorage.setItem(KEY_ENTRADA, "1");
      localStorage.removeItem(KEY_SIN_LOGIN);
      limpiarUrl();
    }
  }

  function irLogin(){
    location.replace("/VidaAbundante/login.html");
  }

  function abrirCompartidos(){
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

      if (intentos < 60) {
        setTimeout(tick, 150);
      }
    };

    tick();
  }

  function crearTip(){
    if (document.getElementById("vaAppTip")) return;

    const st = document.createElement("style");
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
        font-family:Arial,sans-serif;
        color:#111;
      }

      #vaAppTip.abierto{
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
        box-shadow:0 22px 60px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.9);
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
      }

      .va-tip-title{
        margin:0;
        font-family:Georgia, "Times New Roman", serif;
        font-size:21px;
        font-weight:900;
        line-height:1.18;
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
        background:#a6d0ff;
        color:#000;
        font-weight:900;
        font-size:14px;
        box-shadow:0 8px 18px rgba(0,0,0,.16);
        cursor:pointer;
      }
    `;

    document.head.appendChild(st);

    const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
    const esAndroid = /android/i.test(navigator.userAgent || "");

    let instrucciones = `
      <strong>Para usarla como app:</strong>
      Si tu navegador muestra la opción <b>Instalar app</b>, aceptala.
      También podés crear un acceso directo desde el menú del navegador.
    `;

    if (esIOS) {
      instrucciones = `
        <strong>Para usarla como app en iPhone:</strong>
        Tocá el botón de compartir de Safari y elegí <b>Agregar a pantalla de inicio</b>.
      `;
    }

    if (esAndroid) {
      instrucciones = `
        <strong>Para usarla como app en Android:</strong>
        Si Chrome muestra <b>Instalar app</b>, aceptalo. Si no aparece, tocá el menú <b>⋮</b> y elegí <b>Agregar a pantalla principal</b>.
      `;
    }

    const div = document.createElement("div");
    div.id = "vaAppTip";

    div.innerHTML = `
      <div class="va-tip-card">
        <div class="va-tip-content">
          <div class="va-tip-icon">
            <i class="fa-solid fa-dove"></i>
          </div>

          <h2 class="va-tip-title">Bendecido hermano</h2>

          <p class="va-tip-text">
            Te animamos a usar Vida Abundante como aplicación en tu celular
            para acceder más rápido a Biblia, devocionales, recursos y compartidos.
          </p>

          <div class="va-tip-instrucciones">
            ${instrucciones}
          </div>

          <button type="button" class="va-tip-btn" id="vaTipContinuar">
            Continuar en web
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("vaTipContinuar")?.addEventListener("click", () => {
      localStorage.setItem(KEY_TIP, "1");
      div.classList.remove("abierto");
    });
  }

  function mostrarTipDespues(){
    if (esStandalone()) return;
    if (localStorage.getItem(KEY_TIP) === "1") return;

    setTimeout(() => {
      crearTip();
      document.getElementById("vaAppTip")?.classList.add("abierto");
    }, 1400);
  }

  function iniciar(){
    marcarEntrada();

    if (tieneEntradaPermitida()) {
      abrirCompartidos();
      mostrarTipDespues();
      return;
    }

    let intentos = 0;

    const tick = () => {
      intentos++;

      if (hayLogin()) {
        localStorage.setItem(KEY_ENTRADA, "1");
        localStorage.removeItem(KEY_SIN_LOGIN);
        abrirCompartidos();
        mostrarTipDespues();
        return;
      }

      if (intentos > 30) {
        irLogin();
        return;
      }

      setTimeout(tick, 150);
    };

    tick();
  }

  window.VAEntradaApp = {
    reset: function(){
      location.replace("/VidaAbundante/?resetEntrada=1");
    },
    mostrarConsejo: function(){
      localStorage.removeItem(KEY_TIP);
      mostrarTipDespues();
    }
  };

  document.addEventListener("DOMContentLoaded", iniciar);
})();
