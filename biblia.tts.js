/* =========================================================
   BIBLIA TTS - speechSynthesis local
   PC: versículo por versículo
   Móvil/PWA: modo fluido para reducir silencios
   Arpa de fondo suave
   No usa Firebase, no usa R2, no usa APIs pagas.
   ========================================================= */

(() => {
  const ES_MOVIL =
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "") ||
    window.innerWidth <= 760;

  const MODO_FLUIDO_MOVIL = ES_MOVIL;

  const TTS_LANG = "es-US";
  const TTS_RATE = ES_MOVIL ? 1.08 : 1.0;
  const TTS_PITCH = ES_MOVIL ? 1.0 : 0.82;
  const TTS_VOLUME = 1;

  /* ================= ARPA DE FONDO ================= */
  const BIBLIA_ARPA_URL = "./audio/arpa-biblia.mp3";
  const BIBLIA_ARPA_VOLUME = ES_MOVIL ? 0.08 : 0.06;

  let bibliaArpaAudio = null;
  let bibliaArpaFadeTimer = null;

  function getBibliaArpaAudio() {
    if (bibliaArpaAudio) return bibliaArpaAudio;

    bibliaArpaAudio = new Audio(BIBLIA_ARPA_URL);
    bibliaArpaAudio.loop = true;
    bibliaArpaAudio.preload = "auto";
    bibliaArpaAudio.volume = 0;

    return bibliaArpaAudio;
  }

  function iniciarArpaBiblia() {
    try {
      const audio = getBibliaArpaAudio();

      clearInterval(bibliaArpaFadeTimer);

      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {});
      }

      bibliaArpaFadeTimer = setInterval(() => {
        audio.volume = Math.min(BIBLIA_ARPA_VOLUME, audio.volume + 0.01);

        if (audio.volume >= BIBLIA_ARPA_VOLUME) {
          clearInterval(bibliaArpaFadeTimer);
        }
      }, 80);

    } catch (e) {
      console.warn("No se pudo iniciar arpa Biblia:", e);
    }
  }

  function pausarArpaBiblia() {
    try {
      const audio = bibliaArpaAudio;
      if (!audio) return;

      clearInterval(bibliaArpaFadeTimer);
      audio.pause();
    } catch {}
  }

  function detenerArpaBiblia() {
    try {
      const audio = bibliaArpaAudio;
      if (!audio) return;

      clearInterval(bibliaArpaFadeTimer);

      bibliaArpaFadeTimer = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.015);

        if (audio.volume <= 0.001) {
          clearInterval(bibliaArpaFadeTimer);
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 0;
        }
      }, 70);

    } catch (e) {
      console.warn("No se pudo detener arpa Biblia:", e);
    }
  }

  let versos = [];
  let indiceActual = 0;
  let estado = "detenido"; // detenido | leyendo | pausado
  let tokenLectura = 0;
  let keepAliveTimer = null;

  let mapaFluido = [];
  let ultimoIndiceMarcado = -1;

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function getBtn() {
    return document.getElementById("btnBibliaTTS");
  }

  function limpiarActivo() {
    qsa("#texto .versiculo.biblia-tts-versiculo-activo").forEach(el => {
      el.classList.remove("biblia-tts-versiculo-activo");
      el.style.removeProperty("background");
      el.style.removeProperty("outline");
      el.style.removeProperty("border-radius");
    });
  }

  function marcarActivo(el) {
    if (!el) return;

    limpiarActivo();

    el.classList.add("biblia-tts-versiculo-activo");
    el.style.setProperty("background", "rgba(209, 238, 255, .88)", "important");
    el.style.setProperty("outline", "2px solid #466966", "important");
    el.style.setProperty("border-radius", "10px", "important");

    void el.offsetHeight;
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
    }, 5000);
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
      return (txt.innerText || txt.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
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

      // Corrección comprobada.
      .replace(/\bsepare\b/gi, "cepare")
      .replace(/\bsepares\b/gi, "cepares")
      .replace(/\bseparéis\b/gi, "ceparéis")
      .replace(/\bseparare\b/gi, "ceparare")
      .replace(/\bseparares\b/gi, "ceparares")

      .replace(/;/g, "; ")
      .replace(/:/g, ": ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* =========================================================
     MODO PC: versículo por versículo
     ========================================================= */

  function hablarVersiculoPC(texto, miToken, alTerminar) {
    const limpio = prepararTextoBibliaParaVoz(texto);

    if (!limpio) {
      if (typeof alTerminar === "function") alTerminar();
      return;
    }

    const u = new SpeechSynthesisUtterance(limpio);

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
      if (e?.error === "interrupted") return;

      console.warn("Biblia TTS error:", e?.error || e);
      estado = "pausado";
      setBoton("pausado");
      pausarArpaBiblia();
    };

    window.__bibliaTTSUtterance = u;

    try {
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn("No se pudo iniciar Biblia TTS:", e);
      estado = "pausado";
      setBoton("pausado");
      pausarArpaBiblia();
    }

    setTimeout(() => {
      try { speechSynthesis.resume(); } catch {}
    }, 80);
  }

  function leerActualPC(miToken) {
    if (miToken !== tokenLectura) return;
    if (estado !== "leyendo") return;

    if (indiceActual >= versos.length) {
      detenerBibliaTTS(true);
      return;
    }

    const v = versos[indiceActual];

    if (!v || !v.el) {
      indiceActual++;
      leerActualPC(miToken);
      return;
    }

    marcarActivo(v.el);

    requestAnimationFrame(() => {
      try {
        v.el.scrollIntoView({
          behavior: "smooth",
          block: "center"
        });
      } catch {}
    });

    hablarVersiculoPC(v.texto, miToken, () => {
      indiceActual++;
      setTimeout(() => leerActualPC(miToken), 60);
    });
  }

  /* =========================================================
     MODO MÓVIL FLUIDO: un solo texto continuo
     ========================================================= */

  function crearTextoFluidoDesde(indiceInicio) {
    mapaFluido = [];
    ultimoIndiceMarcado = -1;

    let textoTotal = "";

    for (let i = indiceInicio; i < versos.length; i++) {
      const texto = prepararTextoBibliaParaVoz(versos[i].texto || "");
      if (!texto) continue;

      const separador = textoTotal ? " " : "";
      textoTotal += separador;

      const inicio = textoTotal.length;
      textoTotal += texto;
      const fin = textoTotal.length;

      mapaFluido.push({
        indice: i,
        el: versos[i].el,
        inicio,
        fin
      });
    }

    return textoTotal.trim();
  }

  function marcarFluidoPorIndice(indice) {
    const item = mapaFluido.find(x => x.indice === indice);
    if (!item) return;

    if (ultimoIndiceMarcado === indice) return;
    ultimoIndiceMarcado = indice;
    indiceActual = indice;

    marcarActivo(item.el);

    requestAnimationFrame(() => {
      try {
        item.el.scrollIntoView({
          behavior: "auto",
          block: "center"
        });
      } catch {}
    });
  }

  function marcarFluidoPorChar(charIndex) {
    if (!mapaFluido.length) return;

    const pos = Number(charIndex || 0);

    let elegido = mapaFluido[0];

    for (const item of mapaFluido) {
      if (pos >= item.inicio) elegido = item;
      if (pos < item.fin) break;
    }

    if (!elegido) return;

    marcarFluidoPorIndice(elegido.indice);
  }

  function hablarFluidoMovil(indiceInicio, miToken) {
    const textoTotal = crearTextoFluidoDesde(indiceInicio);

    if (!textoTotal) {
      detenerBibliaTTS(true);
      return;
    }

    const primero = mapaFluido[0];
    if (primero) marcarFluidoPorIndice(primero.indice);

    const u = new SpeechSynthesisUtterance(textoTotal);

    // No forzamos voz exacta.
    u.lang = TTS_LANG;
    u.rate = TTS_RATE;
    u.pitch = TTS_PITCH;
    u.volume = TTS_VOLUME;

    u.onboundary = (ev) => {
      if (miToken !== tokenLectura) return;
      if (estado !== "leyendo") return;

      if (typeof ev.charIndex === "number") {
        marcarFluidoPorChar(ev.charIndex);
      }
    };

    u.onend = () => {
      if (miToken !== tokenLectura) return;
      if (estado !== "leyendo") return;

      detenerBibliaTTS(true);
    };

    u.onerror = (e) => {
      if (miToken !== tokenLectura) return;
      if (e?.error === "interrupted") return;

      console.warn("Biblia TTS móvil fluido error:", e?.error || e);

      estado = "pausado";
      setBoton("pausado");
      detenerKeepAlive();
      pausarArpaBiblia();
    };

    window.__bibliaTTSUtterance = u;

    try {
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn("No se pudo iniciar Biblia TTS móvil:", e);
      estado = "pausado";
      setBoton("pausado");
      detenerKeepAlive();
      pausarArpaBiblia();
    }

    setTimeout(() => {
      try { speechSynthesis.resume(); } catch {}
    }, 80);
  }

  /* =========================================================
     CONTROL GENERAL
     ========================================================= */

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
    iniciarArpaBiblia();

    setTimeout(() => {
      if (MODO_FLUIDO_MOVIL) {
        hablarFluidoMovil(indiceActual, miToken);
      } else {
        leerActualPC(miToken);
      }
    }, ES_MOVIL ? 80 : 140);
  }

  function pausarBibliaTTS() {
    if (estado !== "leyendo") return;

    estado = "pausado";
    setBoton("pausado");
    detenerKeepAlive();
    pausarArpaBiblia();

    // En modo fluido móvil intentamos pausa real.
    // Si Android no la respeta, depende del motor del celular.
    try {
      speechSynthesis.pause();
    } catch {
      try { speechSynthesis.cancel(); } catch {}
    }
  }

  function continuarBibliaTTS() {
    if (estado !== "pausado") return;

    estado = "leyendo";
    setBoton("leyendo");
    iniciarKeepAlive();
    iniciarArpaBiblia();

    try {
      speechSynthesis.resume();

      setTimeout(() => {
        try { speechSynthesis.resume(); } catch {}
      }, 120);

    } catch {
      reproducirDesde(indiceActual);
    }
  }

  function detenerBibliaTTS(limpiar = true) {
    tokenLectura++;
    estado = "detenido";
    detenerKeepAlive();
    detenerArpaBiblia();

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

    if (e.target.closest("button, a, input, select, textarea, i, svg, .icono-nota, .btn")) return;

    if (estaEnModoSeleccion()) return;

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
