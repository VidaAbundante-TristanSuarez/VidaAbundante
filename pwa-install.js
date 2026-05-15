/* ================= PWA INSTALL VIDA ABUNDANTE ================= */
/* No controla login. No redirige. Solo invita a instalar la app. */

(function(){
  const KEY_TIP_VISTO = "VA_PWA_TIP_VISTO_v1";

  let deferredPrompt = null;
  let modalMostrado = false;

  function esStandalone() {
    return (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      window.navigator.standalone === true
    );
  }

  function esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  }

  function esAndroid() {
    return /android/i.test(navigator.userAgent || "");
  }

  function crearEstilos() {
    if (document.getElementById("vaPwaInstallStyle")) return;

    const st = document.createElement("style");
    st.id = "vaPwaInstallStyle";

    st.textContent = `
      #vaPwaInstallModal {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(0,0,0,.38);
        font-family: Arial, sans-serif;
        color: #111;
      }

      #vaPwaInstallModal.abierto {
        display: flex;
      }

      .va-pwa-card {
        position: relative;
        width: min(92vw, 410px);
        padding: 30px 24px 24px;
        border-radius: 30px;
        background:
          radial-gradient(circle at top left, rgba(166,208,255,.48), transparent 42%),
          radial-gradient(circle at bottom right, rgba(233,246,255,.9), transparent 48%),
          rgba(255,255,255,.96);
        border: 1px solid rgba(255,255,255,.9);
        box-shadow:
          0 22px 60px rgba(0,0,0,.22),
          inset 0 1px 0 rgba(255,255,255,.9);
        text-align: center;
        overflow: hidden;
      }

      .va-pwa-card::before {
        content: "";
        position: absolute;
        width: 160px;
        height: 160px;
        right: -75px;
        top: -75px;
        border-radius: 999px;
        background: rgba(166,208,255,.38);
      }

      .va-pwa-card::after {
        content: "";
        position: absolute;
        width: 120px;
        height: 120px;
        left: -60px;
        bottom: -60px;
        border-radius: 999px;
        background: rgba(233,246,255,.9);
      }

      .va-pwa-content {
        position: relative;
        z-index: 2;
      }

      .va-pwa-icon {
        width: 62px;
        height: 62px;
        margin: 0 auto 14px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(180deg, #e9f6ff, #a6d0ff);
        color: #111;
        box-shadow: 0 10px 24px rgba(0,0,0,.14);
      }

      .va-pwa-icon i {
        font-size: 26px;
      }

      .va-pwa-title {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 21px;
        font-weight: 900;
        line-height: 1.18;
      }

      .va-pwa-text {
        margin: 13px auto 16px;
        max-width: 340px;
        font-size: 14px;
        line-height: 1.45;
        color: #263238;
      }

      .va-pwa-info {
        margin: 0 auto 18px;
        padding: 12px;
        border-radius: 18px;
        background: rgba(255,255,255,.82);
        border: 1px solid rgba(0,0,0,.08);
        text-align: left;
        font-size: 13px;
        line-height: 1.4;
        color: #263238;
      }

      .va-pwa-info strong {
        display: block;
        margin-bottom: 5px;
      }

      .va-pwa-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .va-pwa-btn {
        width: 100%;
        min-height: 46px;
        border: none;
        border-radius: 999px;
        padding: 0 18px;
        font-weight: 900;
        font-size: 14px;
        cursor: pointer;
      }

      .va-pwa-btn-primary {
        background: #a6d0ff;
        color: #000;
        box-shadow: 0 8px 18px rgba(0,0,0,.16);
      }

      .va-pwa-btn-light {
        background: transparent;
        color: #263238;
      }
    `;

    document.head.appendChild(st);
  }

  function instruccionesHTML() {
    if (deferredPrompt) {
      return `
        <strong>Instalar como app:</strong>
        Tu navegador permite instalar Vida Abundante como aplicación.
        Tocá <b>Instalar app</b> para abrir la instalación.
      `;
    }

    if (esIOS()) {
      return `
        <strong>Para usarla como app en iPhone:</strong>
        Tocá el botón de compartir de Safari y elegí
        <b>Agregar a pantalla de inicio</b>.
      `;
    }

    if (esAndroid()) {
      return `
        <strong>Para usarla como app en Android:</strong>
        Si Chrome muestra <b>Instalar app</b>, aceptalo.
        Si no aparece, tocá el menú <b>⋮</b> y elegí
        <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.
      `;
    }

    return `
      <strong>Para usarla como app:</strong>
      Si el navegador muestra el ícono de instalación, aceptalo.
      También podés crear un acceso directo desde el menú del navegador.
    `;
  }

  function crearModal() {
    if (document.getElementById("vaPwaInstallModal")) return;

    crearEstilos();

    const div = document.createElement("div");
    div.id = "vaPwaInstallModal";

    div.innerHTML = `
      <div class="va-pwa-card">
        <div class="va-pwa-content">
          <div class="va-pwa-icon">
            <i class="fa-solid fa-dove"></i>
          </div>

          <h2 class="va-pwa-title">
            Bendecido hermano
          </h2>

          <p class="va-pwa-text">
            Te animamos a usar Vida Abundante como aplicación en tu celular
            para acceder más rápido a Biblia, devocionales, recursos y compartidos.
          </p>

          <div class="va-pwa-info" id="vaPwaInfo">
            ${instruccionesHTML()}
          </div>

          <div class="va-pwa-actions">
            <button
              type="button"
              id="vaBtnInstalarPwa"
              class="va-pwa-btn va-pwa-btn-primary"
              style="${deferredPrompt ? "" : "display:none;"}"
            >
              Instalar app
            </button>

            <button
              type="button"
              id="vaBtnContinuarWeb"
              class="va-pwa-btn va-pwa-btn-light"
            >
              Continuar en web
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(div);

    document.getElementById("vaBtnContinuarWeb")?.addEventListener("click", () => {
      localStorage.setItem(KEY_TIP_VISTO, "1");
      div.classList.remove("abierto");
    });

    document.getElementById("vaBtnInstalarPwa")?.addEventListener("click", async () => {
      if (!deferredPrompt) return;

      try {
        deferredPrompt.prompt();

        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;

        localStorage.setItem(KEY_TIP_VISTO, "1");
        div.classList.remove("abierto");

        console.log("Resultado instalación PWA:", choice?.outcome);
      } catch (e) {
        console.warn("No se pudo abrir instalación PWA:", e);
      }
    });
  }

  function mostrarModal() {
    if (modalMostrado) return;
    if (esStandalone()) return;
    if (localStorage.getItem(KEY_TIP_VISTO) === "1") return;

    modalMostrado = true;

    crearModal();

    const modal = document.getElementById("vaPwaInstallModal");
    const info = document.getElementById("vaPwaInfo");
    const btn = document.getElementById("vaBtnInstalarPwa");

    if (info) info.innerHTML = instruccionesHTML();
    if (btn) btn.style.display = deferredPrompt ? "" : "none";

    modal?.classList.add("abierto");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    // Si el modal ya existía, activamos el botón real.
    const info = document.getElementById("vaPwaInfo");
    const btn = document.getElementById("vaBtnInstalarPwa");

    if (info) info.innerHTML = instruccionesHTML();
    if (btn) btn.style.display = "";
  });

  window.addEventListener("appinstalled", () => {
    localStorage.setItem(KEY_TIP_VISTO, "1");
    document.getElementById("vaPwaInstallModal")?.classList.remove("abierto");
  });

  window.addEventListener("load", () => {
    setTimeout(mostrarModal, 2500);
  });

  window.VAPwaInstall = {
    mostrar: function(){
      localStorage.removeItem(KEY_TIP_VISTO);
      mostrarModal();
    },
    reset: function(){
      localStorage.removeItem(KEY_TIP_VISTO);
    }
  };
})();
