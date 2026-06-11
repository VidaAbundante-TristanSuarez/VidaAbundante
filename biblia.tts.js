/* =========================================================
   BIBLIA TTS - speechSynthesis local
   PC y Móvil/PWA: versículo por versículo
   Marcado exacto del versículo que está sonando
   Arpa de fondo suave
   No usa Firebase, no usa R2, no usa APIs pagas.
   ========================================================= */

(() => {
  const ES_MOVIL =
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "") ||
    window.innerWidth <= 760;

  const TTS_LANG = "es-US";
  const TTS_RATE = ES_MOVIL ? 1.08 : 1.0;
  const TTS_PITCH = ES_MOVIL ? 1.0 : 0.82;
  const TTS_VOLUME = 1;

  /* =========================================================
     ARPA DE FONDO
     ========================================================= */

  const USAR_ARPA_BIBLIA = true;
  const BIBLIA_ARPA_URL = "./audio/arpa-biblia.mp3";
const BIBLIA_ARPA_VOLUME = ES_MOVIL ? 0.075 : 0.06;
   
  let bibliaArpaAudio = null;
  let bibliaArpaFadeTimer = null;

  function getBibliaArpaAudio() {
    if (!USAR_ARPA_BIBLIA) return null;
    if (bibliaArpaAudio) return bibliaArpaAudio;

    bibliaArpaAudio = new Audio(BIBLIA_ARPA_URL);
    bibliaArpaAudio.loop = true;
    bibliaArpaAudio.preload = "auto";
    bibliaArpaAudio.volume = 0;

    return bibliaArpaAudio;
  }

  function iniciarArpaBiblia() {
    if (!USAR_ARPA_BIBLIA) return;

    try {
      const audio = getBibliaArpaAudio();
      if (!audio) return;

      clearInterval(bibliaArpaFadeTimer);

      const p = audio.play();

      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Si el navegador no permite iniciar el arpa, no rompemos la voz.
        });
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
    if (!USAR_ARPA_BIBLIA) return;

    try {
      const audio = bibliaArpaAudio;
      if (!audio) return;

      clearInterval(bibliaArpaFadeTimer);
      audio.pause();
    } catch {}
  }

  function detenerArpaBiblia() {
    if (!USAR_ARPA_BIBLIA) return;

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

  /* =========================================================
     ESTADO
     ========================================================= */

  let versos = [];
  let indiceActual = 0;
  let estado = "detenido"; // detenido | leyendo | pausado
  let tokenLectura = 0;
  let keepAliveTimer = null;

     const LS_BIBLIA_TTS_ULTIMO = "va_biblia_tts_ultimo_v1";

  function guardarUltimoVersiculoTTS(v) {
    try {
      if (!v || !v.id) return;

      localStorage.setItem(LS_BIBLIA_TTS_ULTIMO, JSON.stringify({
        id: v.id,
        num: v.num || 0,
        ts: Date.now()
      }));
    } catch {}
  }

  function limpiarUltimoGuardadoVisual() {
    qsa("#texto .versiculo.biblia-tts-ultimo-guardado").forEach(el => {
      el.classList.remove("biblia-tts-ultimo-guardado");
    });
  }

  function restaurarUltimoVersiculoTTS(opts = {}) {
    try {
      if (estado === "leyendo") return;

      const raw = localStorage.getItem(LS_BIBLIA_TTS_ULTIMO);
      if (!raw) return;

      const data = JSON.parse(raw);
      if (!data?.id) return;

      const el = qsa("#texto .versiculo").find(x => x.dataset.id === data.id);
      if (!el) return;

      limpiarUltimoGuardadoVisual();

      if (!el.classList.contains("biblia-tts-versiculo-activo")) {
        el.classList.add("biblia-tts-ultimo-guardado");
      }

      if (opts.scroll) {
        setTimeout(() => {
          try {
            el.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          } catch {}
        }, 150);
      }
    } catch {}
  }

  function obtenerIndiceUltimoGuardadoTTS() {
    try {
      const raw = localStorage.getItem(LS_BIBLIA_TTS_ULTIMO);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!data?.id) return null;

      const lista = obtenerVersos();
      const idx = lista.findIndex(v => v.id === data.id);

      if (idx < 0) return null;

      return idx;
    } catch {
      return null;
    }
  }
   
   function programarRestaurarUltimoTTS() {
    let intentos = 0;

    const timer = setInterval(() => {
      intentos++;

      restaurarUltimoVersiculoTTS({
        scroll: intentos === 2
      });

      const hayVersos = qsa("#texto .versiculo").length > 0;

      if (hayVersos || intentos >= 15) {
        clearInterval(timer);
      }
    }, 300);
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
      el.style.removeProperty("background");
      el.style.removeProperty("outline");
      el.style.removeProperty("border-radius");
    });
  }

  function marcarActivo(el) {
    if (!el) return;

    limpiarActivo();
    limpiarUltimoGuardadoVisual();

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

  /* =========================================================
     TEXTO
     ========================================================= */

  function textoVersiculo(el) {
    if (!el) return "";

    const txt = el.querySelector(".txt");

    if (txt) {
      return (txt.innerText || txt.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const clon = el.cloneNode(true);

    clon
      .querySelectorAll("button, i, svg, .icono-nota, .nota, .pluma, .acciones, .btn")
      .forEach(n => n.remove());

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

      // Corrección SOLO móvil: evita que "Júntense / Juntense" suene como "Yúntense".
      .replace(/\bJúntense\b/g, ES_MOVIL ? "húntense" : "Júntense")
      .replace(/\bjúntense\b/g, ES_MOVIL ? "húntense" : "júntense")
      .replace(/\bJuntense\b/g, ES_MOVIL ? "húntense" : "Juntense")
      .replace(/\bjuntense\b/g, ES_MOVIL ? "húntense" : "juntense")
      .replace(/\bJunténse\b/g, ES_MOVIL ? "húntense" : "Junténse")
      .replace(/\bjunténse\b/g, ES_MOVIL ? "húntense" : "junténse")
       
      .replace(/;/g, "; ")
      .replace(/:/g, ": ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* =========================================================
     LECTURA VERSÍCULO POR VERSÍCULO
     ========================================================= */

  function hablarVersiculo(texto, miToken, alTerminar) {
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

      // Este error aparece cuando nosotros cancelamos una lectura.
      if (e?.error === "interrupted") return;

      console.warn("Biblia TTS error:", e?.error || e);

      estado = "pausado";
      setBoton("pausado");
      detenerKeepAlive();
      pausarArpaBiblia();
    };

    window.__bibliaTTSUtterance = u;

    try {
      speechSynthesis.speak(u);
    } catch (e) {
      console.warn("No se pudo iniciar Biblia TTS:", e);

      estado = "pausado";
      setBoton("pausado");
      detenerKeepAlive();
      pausarArpaBiblia();
    }

    setTimeout(() => {
      try {
        speechSynthesis.resume();
      } catch {}
    }, 80);
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

    guardarUltimoVersiculoTTS(v);
     marcarActivo(v.el);

    requestAnimationFrame(() => {
      try {
        v.el.scrollIntoView({
          behavior: ES_MOVIL ? "auto" : "smooth",
          block: "center"
        });
      } catch {}
    });

    hablarVersiculo(v.texto, miToken, () => {
      indiceActual++;

      setTimeout(() => {
        leerActual(miToken);
      }, ES_MOVIL ? 25 : 60);
    });
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

    try {
      speechSynthesis.cancel();
    } catch {}

    estado = "leyendo";
    setBoton("leyendo");
    iniciarKeepAlive();
    iniciarArpaBiblia();

    setTimeout(() => {
      leerActual(miToken);
    }, ES_MOVIL ? 80 : 140);
  }

  function pausarBibliaTTS() {
    if (estado !== "leyendo") return;

    estado = "pausado";
    setBoton("pausado");
    detenerKeepAlive();
    pausarArpaBiblia();

    try {
      speechSynthesis.pause();
    } catch {
      try {
        speechSynthesis.cancel();
      } catch {}
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
        try {
          speechSynthesis.resume();
        } catch {}
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

    try {
      speechSynthesis.cancel();
    } catch {}

    if (limpiar) {
      limpiarActivo();
      restaurarUltimoVersiculoTTS({ scroll: false });
    }

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

    const idxGuardado = obtenerIndiceUltimoGuardadoTTS();

    reproducirDesde(
      Number.isFinite(idxGuardado) ? idxGuardado : 0
    );
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
      } else {
        setTimeout(() => {
          restaurarUltimoVersiculoTTS({ scroll: false });
        }, 300);
      }
    });

    window.addEventListener("beforeunload", () => {
      detenerBibliaTTS(true);
    });

    window.detenerBibliaTTS = detenerBibliaTTS;
    window.reproducirBibliaDesdeInicio = () => reproducirDesde(0);
         programarRestaurarUltimoTTS();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBibliaTTS);
  } else {
    initBibliaTTS();
  }
})();
