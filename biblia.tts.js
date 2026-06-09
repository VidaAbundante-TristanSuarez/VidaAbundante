/* =========================================================
   BIBLIA TTS - speechSynthesis local
   Lee capítulo / pausa / tocar versículo continúa desde ahí
   No usa Firebase, no usa R2, no usa APIs pagas.
   ========================================================= */

(() => {
  const TTS_LANG = "es-US";   // Latino USA automático
  const TTS_RATE = 1.0;       // velocidad
  const TTS_PITCH = 0.82;     // un poco más grave
  const TTS_VOLUME = 1;

  let versos = [];
  let indiceActual = 0;
  let estado = "detenido"; // detenido | leyendo | pausado
  let tokenLectura = 0;
  let keepAliveTimer = null;

  function qs(sel) {
    return document.querySelector(sel);
  }

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function getBtn() {
    return document.getElementById("btnBibliaTTS");
  }

  function limpiarActivo() {
    qsa("#texto .versiculo.biblia-tts-versiculo-activo").forEach(el => {
      el.classList.remove("biblia-tts-versiculo-activo");
    });
  }

  function setBoton(tipo) {
    const btn = getBtn();
    if (!btn) return;

    if (tipo === "leyendo") {
      btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
      btn.classList.add("biblia-tts-activo");
      btn.setAttribute("aria-label", "Pausar lectura");
      btn.title = "Pausar";
      return;
    }

    if (tipo === "pausado") {
      btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
      btn.classList.add("biblia-tts-activo");
      btn.setAttribute("aria-label", "Continuar lectura");
      btn.title = "Continuar";
      return;
    }

    btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    btn.classList.remove("biblia-tts-activo");
    btn.setAttribute("aria-label", "Reproducir capítulo");
    btn.title = "Reproducir capítulo";
  }

  function iniciarKeepAlive() {
    detenerKeepAlive();

    keepAliveTimer = setInterval(() => {
      try {
        if (estado === "leyendo" && speechSynthesis.speaking && !speechSynthesis.paused) {
          speechSynthesis.resume();
        }
      } catch {}
    }, 7000);
  }

  function detenerKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  function textoVersiculo(el) {
    if (!el) return "";

    const txt = el.querySelector(".txt");
    if (txt) {
      return (txt.innerText || txt.textContent || "").replace(/\s+/g, " ").trim();
    }

    const clon = el.cloneNode(true);
    clon.querySelectorAll("button, i, svg, .icono-nota, .nota, .pluma, .acciones, .btn").forEach(n => n.remove());

    return (clon.innerText || clon.textContent || "")
      .replace(/^\s*\d+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function numeroVersiculo(el, fallback) {
    const num = el?.querySelector(".num");
    const n = Number((num?.innerText || num?.textContent || "").trim());
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function obtenerVersos() {
    return qsa("#texto .versiculo")
      .map((el, i) => ({
        el,
        id: el.dataset.id || "",
        num: numeroVersiculo(el, i + 1),
        texto: textoVersiculo(el)
      }))
      .filter(v => v.texto.length > 1);
  }

  function prepararTextoBibliaParaVoz(txt) {
    if (!txt) return "";

    return String(txt)
      .replace(/\s+/g, " ")
      .trim()

      // Correcciones bíblicas: solo afectan al audio, no al texto visible.
      .replaceAll("Mefi-boset", "Mefi bosét")
      .replaceAll("Mefiboset", "Mefi bosét")
      .replaceAll("Nabucodonosor", "Nabucodonosór")
      .replaceAll("Melquisedec", "Melquisedéc")
      .replaceAll("Habacuc", "Abacúc")
      .replaceAll("Ahitofel", "Ajitófel")
      .replaceAll("Zorobabel", "Zorobabél")
      .replaceAll("Belsasar", "Belsasár")
      .replaceAll("Asuero", "Asuéro")

      // Pequeños descansos para que no lea todo atropellado.
      .replace(/;/g, "; ")
      .replace(/:/g, ": ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hablar(texto, miToken, alTerminar) {
    const limpio = prepararTextoBibliaParaVoz(texto);
    if (!limpio) {
      if (typeof alTerminar === "function") alTerminar();
      return;
    }

    const u = new SpeechSynthesisUtterance(limpio);

    // IMPORTANTE:
    // No usamos u.voice porque en tus pruebas Chrome se trababa.
    u.lang = TTS_LANG;
    u.rate = TTS_RATE;
    u.pitch = TTS_PITCH;
    u.volume = TTS_VOLUME;

    u.onend = () => {
      if (miToken !== tokenLectura) return;
      if (estado !== "leyendo") return;

      if (typeof alTerminar === "function") alTerminar();
    };

    u.onerror = (e) => {
      if (miToken !== tokenLectura) return;

      // "interrupted" aparece cuando nosotros mismos cancelamos una voz.
      if (e?.error === "interrupted") return;

      console.warn("Biblia TTS error:", e?.error || e);
      detenerBibliaTTS(false);
    };

    window.__bibliaTTSUtterance = u;
    speechSynthesis.speak(u);

    setTimeout(() => {
      try { speechSynthesis.resume(); } catch {}
    }, 120);
  }

  function leerActual(miToken) {
    if (miToken !== tokenLectura) return;
    if (estado !== "leyendo") return;

    if (indiceActual >= versos.length) {
      detenerBibliaTTS(true);
      return;
    }

    const v = versos[indiceActual];
    if (!v || !v.el) {
      indiceActual++;
      leerActual(miToken);
      return;
    }

    limpiarActivo();

    v.el.classList.add("biblia-tts-versiculo-activo");

    try {
      v.el.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    } catch {}

    hablar(v.texto, miToken, () => {
      indiceActual++;
      setTimeout(() => leerActual(miToken), 160);
    });
  }

  function reproducirDesde(indice = 0) {
    versos = obtenerVersos();

    if (!versos.length) {
      detenerBibliaTTS(true);
      return;
    }

    indiceActual = Math.max(0, Math.min(Number(indice) || 0, versos.length - 1));

    tokenLectura++;
    const miToken = tokenLectura;

    try { speechSynthesis.cancel(); } catch {}

    estado = "leyendo";
    setBoton("leyendo");
    iniciarKeepAlive();

    setTimeout(() => {
      leerActual(miToken);
    }, 180);
  }

  function pausarBibliaTTS() {
    if (estado !== "leyendo") return;

    try {
      speechSynthesis.pause();
      estado = "pausado";
      setBoton("pausado");
    } catch {}
  }

  function continuarBibliaTTS() {
    if (estado !== "pausado") return;

    try {
      speechSynthesis.resume();
      estado = "leyendo";
      setBoton("leyendo");
    } catch {}
  }

  function detenerBibliaTTS(limpiar = true) {
    tokenLectura++;
    estado = "detenido";
    detenerKeepAlive();

    try { speechSynthesis.cancel(); } catch {}

    if (limpiar) limpiarActivo();

    setBoton("detenido");
  }

  function togglePlayPausa() {
    if (estado === "leyendo") {
      pausarBibliaTTS();
      return;
    }

    if (estado === "pausado") {
      continuarBibliaTTS();
      return;
    }

    reproducirDesde(0);
  }

  function estaEnModoSeleccion() {
    return (
      document.body.classList.contains("modo-imagen") ||
      document.body.classList.contains("modo-marcador")
    );
  }

  function clickVersiculo(e) {
    const el = e.target.closest?.("#texto .versiculo");
    if (!el) return;

    // No molestar íconos internos como pluma/notas.
    if (e.target.closest("button, a, input, select, textarea, i, svg, .icono-nota, .btn")) return;

    // En modo imagen o marcador, que siga funcionando la selección normal.
    if (estaEnModoSeleccion()) return;

    // Si el resaltador está desbloqueado, dejamos que el click marque/desmarque.
    if (window.resaltadorBloqueado === false) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    versos = obtenerVersos();

    const idx = versos.findIndex(v => v.el === el);
    if (idx < 0) return;

    reproducirDesde(idx);
  }

  function detenerAlCambiarCapituloOVersion(e) {
    const t = e.target;

    if (
      t.closest?.("#btnCapAnt") ||
      t.closest?.("#btnCapSig") ||
      t.closest?.("#btnAplicarFiltrosBiblia") ||
      t.closest?.(".btn-version-inline")
    ) {
      detenerBibliaTTS(true);
    }
  }

  function initBibliaTTS() {
    const btn = getBtn();
    if (!btn) return;

    setBoton("detenido");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePlayPausa();
    });

    document.addEventListener("click", clickVersiculo, true);
    document.addEventListener("click", detenerAlCambiarCapituloOVersion, true);

    document.addEventListener("change", (e) => {
      if (e.target?.matches?.("#libro, #capitulo")) {
        detenerBibliaTTS(true);
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        detenerBibliaTTS(true);
      }
    });

    window.addEventListener("beforeunload", () => {
      detenerBibliaTTS(true);
    });

    window.detenerBibliaTTS = detenerBibliaTTS;
    window.reproducirBibliaDesdeInicio = () => reproducirDesde(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBibliaTTS);
  } else {
    initBibliaTTS();
  }
})();
