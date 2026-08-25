/* =========================================================
   BIBLIA TTS - speechSynthesis local + respaldo APK
   PC / PWA / APK
   - Voz web primero, para conservar la voz más natural.
   - En APK, si la voz web no arranca, usa respaldo nativo Android.
   - Marcado visual antes de hablar, para que no se atrase.
   - Arpa de fondo desbloqueada por toque y arranque más rápido.
   ========================================================= */

(() => {
  "use strict";

  const ES_MOVIL =
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "") ||
    window.innerWidth <= 760;

const TTS_LANG = "es-US";

/*
  No bajamos velocidad.
  Solo acercamos el tono a algo más natural.
*/
const TTS_RATE = ES_MOVIL ? 1.05 : 0.98;
const TTS_PITCH = ES_MOVIL ? 0.94 : 0.92;
const TTS_VOLUME = 1;

  /* =========================================================
     ARPA DE FONDO
     ========================================================= */

  const USAR_ARPA_BIBLIA = true;
  const BIBLIA_ARPA_URL = "./audio/arpa-biblia.mp3";
  const BIBLIA_ARPA_VOLUME = ES_MOVIL ? 0.16 : 0.10;

  let bibliaArpaAudio = null;
  let bibliaArpaFadeTimer = null;
  let bibliaArpaDesbloqueada = false;

  function getBibliaArpaAudio() {
    if (!USAR_ARPA_BIBLIA) return null;
    if (bibliaArpaAudio) return bibliaArpaAudio;

    bibliaArpaAudio = new Audio(BIBLIA_ARPA_URL);
    bibliaArpaAudio.loop = true;
    bibliaArpaAudio.preload = "auto";
    bibliaArpaAudio.volume = 0;

    try {
      bibliaArpaAudio.load();
    } catch {}

    return bibliaArpaAudio;
  }

  function desbloquearArpaBibliaPorToque() {
    if (!USAR_ARPA_BIBLIA) return;
    if (bibliaArpaDesbloqueada) return;

    bibliaArpaDesbloqueada = true;

    try {
      const audio = getBibliaArpaAudio();
      if (!audio) return;

      audio.muted = true;
      audio.volume = 0;

      const p = audio.play();

      const terminar = () => {
        try {
          audio.muted = false;

          if (estado !== "leyendo") {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
          }
        } catch {}
      };

      if (p && typeof p.then === "function") {
        p.then(terminar).catch(() => {
          try {
            audio.muted = false;
          } catch {}
        });
      } else {
        terminar();
      }
    } catch (e) {
      console.warn("No se pudo desbloquear arpa Biblia:", e);
    }
  }

  function iniciarArpaBiblia() {
    if (!USAR_ARPA_BIBLIA) return;

    try {
      const audio = getBibliaArpaAudio();
      if (!audio) return;

      clearInterval(bibliaArpaFadeTimer);
      audio.muted = false;

      if (audio.volume <= 0) {
        audio.volume = Math.min(BIBLIA_ARPA_VOLUME, 0.06);
      }

      const subirVolumen = () => {
        clearInterval(bibliaArpaFadeTimer);

        bibliaArpaFadeTimer = setInterval(() => {
          try {
            audio.volume = Math.min(BIBLIA_ARPA_VOLUME, audio.volume + 0.02);

            if (audio.volume >= BIBLIA_ARPA_VOLUME) {
              clearInterval(bibliaArpaFadeTimer);
            }
          } catch {
            clearInterval(bibliaArpaFadeTimer);
          }
        }, 60);
      };

      const p = audio.play();

      if (p && typeof p.then === "function") {
        p.then(subirVolumen).catch((e) => {
          console.warn("El navegador bloqueó el arpa Biblia:", e);
        });
      } else {
        subirVolumen();
      }
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
        try {
          audio.volume = Math.max(0, audio.volume - 0.025);

          if (audio.volume <= 0.001) {
            clearInterval(bibliaArpaFadeTimer);
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 0;
          }
        } catch {
          clearInterval(bibliaArpaFadeTimer);
        }
      }, 50);
    } catch (e) {
      console.warn("No se pudo detener arpa Biblia:", e);
    }
  }

  /* =========================================================
     ESTADO
     ========================================================= */

  let versos = [];
  let indiceActual = 0;

  // Versículo elegido tocándolo cuando el reproductor todavía está detenido.
  // No reproduce hasta tocar Play.
  let versiculoInicioElegidoId = "";
  let pausaReubicada = false;

  let estado = "detenido"; // detenido | leyendo | pausado
  let tokenLectura = 0;
  let keepAliveTimer = null;

  const LS_BIBLIA_TTS_ULTIMO = "va_biblia_tts_ultimo_v1";

  function qsa(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function getBtn() {
    return document.getElementById("btnBibliaTTS");
  }

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

    try {
      el.scrollIntoView({
        behavior: ES_MOVIL ? "auto" : "smooth",
        block: "center"
      });
    } catch {}

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
        if (
          estado === "leyendo" &&
          window.speechSynthesis &&
          speechSynthesis.speaking &&
          !speechSynthesis.paused
        ) {
          speechSynthesis.resume();
        }
      } catch {}
    }, 4000);
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
     VOZ WEB / VOZ APK RESPALDO
     ========================================================= */

  function bibliaTTSEsAPK() {
    try {
      return (
        window.__VIDA_ANDROID_APK__ === true ||
        /VidaAbundanteAndroidApp/i.test(navigator.userAgent || "") ||
        new URLSearchParams(location.search || "").get("apk") === "1" ||
        localStorage.getItem("vida_abundante_android_apk") === "1"
      );
    } catch {
      return false;
    }
  }

  const bibliaTTSNativoCallbacks = {};

  function bibliaTTSNativoDisponible() {
    try {
      if (!bibliaTTSEsAPK()) return false;
      if (!window.AndroidVida) return false;
      if (typeof window.AndroidVida.hablarBibliaNativo !== "function") return false;

      if (typeof window.AndroidVida.ttsBibliaDisponible === "function") {
        return window.AndroidVida.ttsBibliaDisponible() === true;
      }

      return true;
    } catch {
      return false;
    }
  }

  window.vaBibliaTTSEventoNativo = function(tipo, utteranceId, error) {
    try {
      const id = String(utteranceId || "");
      const cb = bibliaTTSNativoCallbacks[id];

      if (!cb) return;

      if (tipo === "start") {
        return;
      }

      delete bibliaTTSNativoCallbacks[id];

      if (cb.token !== tokenLectura) return;

      if (tipo === "end") {
        if (estado !== "leyendo") return;

        if (typeof cb.alTerminar === "function") {
          cb.alTerminar();
        }

        return;
      }

      if (tipo === "error") {
        console.warn("Biblia TTS nativo error:", error || "");

        estado = "pausado";
        setBoton("pausado");
        detenerKeepAlive();
        pausarArpaBiblia();
      }
    } catch (e) {
      console.warn("Error recibiendo TTS nativo:", e);
    }
  };

  function hablarVersiculoNativo(limpio, miToken, alTerminar) {
    if (!bibliaTTSNativoDisponible()) return false;

    const id =
      "biblia_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    bibliaTTSNativoCallbacks[id] = {
      token: miToken,
      alTerminar
    };

    try {
      window.AndroidVida.hablarBibliaNativo(limpio, id);
      return true;
    } catch (e) {
      delete bibliaTTSNativoCallbacks[id];
      console.warn("No pude usar TTS nativo:", e);
      return false;
    }
  }

  function detenerBibliaTTSNativo() {
    try {
      if (
        window.AndroidVida &&
        typeof window.AndroidVida.detenerBibliaNativo === "function"
      ) {
        window.AndroidVida.detenerBibliaNativo();
      }
    } catch {}
  }

  function speechSynthesisDisponible() {
    return (
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function"
    );
  }

function elegirVozSuaveBiblia() {
  try {
    if (!speechSynthesisDisponible()) return null;

    const voces = speechSynthesis.getVoices?.() || [];
    if (!voces.length) return null;

    const normalizar = (valor) => {
      return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/_/g, "-")
        .trim();
    };

    /*
      Solo aceptamos voces de español de Estados Unidos.
      Nunca se selecciona voluntariamente una voz es-ES.
    */
    const vocesEstadosUnidos = voces.filter((voz) => {
      const idioma = normalizar(voz.lang);
      return idioma === "es-us";
    });

    if (!vocesEstadosUnidos.length) {
      return null;
    }

    /*
      speechSynthesis no informa directamente si una voz
      es masculina o femenina. Por eso la reconocemos por
      los nombres conocidos de voces masculinas es-US.
    */
    const nombresMasculinos = [
      "alonso",
      "standard-b",
      "standard-c",
      "wavenet-b",
      "wavenet-c",
      "neural2-b",
      "neural2-c",
      "studio-b",
      "news-d",
      "news-e",
      "polyglot-1",
      "male",
      "masculino"
    ];

    const vozMasculina = vocesEstadosUnidos.find((voz) => {
      const nombre = normalizar(
        `${voz.name || ""} ${voz.voiceURI || ""}`
      );

      return nombresMasculinos.some((clave) =>
        nombre.includes(clave)
      );
    });

    if (vozMasculina) {
      return vozMasculina;
    }

    /*
      Si no hay una masculina identificable,
      conserva la voz original Google Español de EE. UU.
    */
    const vozGoogleEstadosUnidos = vocesEstadosUnidos.find((voz) => {
      const nombre = normalizar(voz.name);

      return (
        nombre.includes("google espanol de estados unidos") ||
        nombre.includes("google us spanish") ||
        (
          nombre.includes("google") &&
          nombre.includes("spanish")
        )
      );
    });

    if (vozGoogleEstadosUnidos) {
      return vozGoogleEstadosUnidos;
    }

    /*
      Último respaldo: cualquier voz que sea realmente es-US.
      Nunca Pablo, Helena ni voces es-ES.
    */
    return vocesEstadosUnidos[0] || null;

  } catch {
    return null;
  }
}

try {
  if (speechSynthesisDisponible()) {
    speechSynthesis.onvoiceschanged = () => {
      elegirVozSuaveBiblia();
    };
  }
} catch {}

  function hablarVersiculo(texto, miToken, alTerminar) {
    const limpio = prepararTextoBibliaParaVoz(texto);

    if (!limpio) {
      if (typeof alTerminar === "function") alTerminar();
      return;
    }

    let termino = false;
    let comenzoWeb = false;
    let usoNativo = false;

    const terminarUnaVez = () => {
      if (termino) return;
      termino = true;

      if (miToken !== tokenLectura) return;
      if (estado !== "leyendo") return;

      if (typeof alTerminar === "function") alTerminar();
    };

    const usarNativoComoRespaldo = () => {
      if (termino) return false;
      if (usoNativo) return true;
      if (miToken !== tokenLectura) return false;
      if (estado !== "leyendo") return false;

      usoNativo = hablarVersiculoNativo(limpio, miToken, terminarUnaVez);
      return usoNativo;
    };

    if (!speechSynthesisDisponible()) {
      if (!usarNativoComoRespaldo()) {
        console.warn("No hay lector de voz disponible.");
        estado = "pausado";
        setBoton("pausado");
        detenerKeepAlive();
        pausarArpaBiblia();
      }
      return;
    }

    const u = new SpeechSynthesisUtterance(limpio);

u.lang = TTS_LANG;
u.rate = TTS_RATE;
u.pitch = TTS_PITCH;
u.volume = TTS_VOLUME;

const vozSuave = elegirVozSuaveBiblia();
if (vozSuave) {
  u.voice = vozSuave;
  u.lang = vozSuave.lang || TTS_LANG;
}

    u.onstart = () => {
      comenzoWeb = true;
    };

    u.onend = () => {
      terminarUnaVez();
    };

    u.onerror = (e) => {
      if (miToken !== tokenLectura) return;

      // Este error aparece cuando nosotros cancelamos una lectura.
      if (e?.error === "interrupted" || e?.error === "canceled") return;

      console.warn("Biblia TTS web error:", e?.error || e);

      if (bibliaTTSEsAPK() && usarNativoComoRespaldo()) {
        return;
      }

      estado = "pausado";
      setBoton("pausado");
      detenerKeepAlive();
      pausarArpaBiblia();
    };

    window.__bibliaTTSUtterance = u;

    try {
      speechSynthesis.cancel();
    } catch {}

    setTimeout(() => {
      try {
        if (miToken !== tokenLectura) return;
        if (estado !== "leyendo") return;

        speechSynthesis.speak(u);

        setTimeout(() => {
          try {
            speechSynthesis.resume();
          } catch {}
        }, 80);

        setTimeout(() => {
          try {
            speechSynthesis.resume();
          } catch {}
        }, 350);

        /*
          En Android WebView a veces speechSynthesis queda colgado:
          el botón queda en play/pausa pero no avanza ni suena.
          Si pasa eso, recién ahí usamos el respaldo nativo.
        */
        if (bibliaTTSEsAPK()) {
          setTimeout(() => {
            try {
              if (termino) return;
              if (miToken !== tokenLectura) return;
              if (estado !== "leyendo") return;

              const webPareceViva = comenzoWeb || speechSynthesis.speaking;

              if (!webPareceViva) {
                try {
                  speechSynthesis.cancel();
                } catch {}

                usarNativoComoRespaldo();
              }
            } catch {}
          }, 1200);
        }
      } catch (e) {
        console.warn("No se pudo iniciar Biblia TTS web:", e);

        if (bibliaTTSEsAPK() && usarNativoComoRespaldo()) {
          return;
        }

        estado = "pausado";
        setBoton("pausado");
        detenerKeepAlive();
        pausarArpaBiblia();
      }
    }, 40);
  }

  /* =========================================================
     LECTURA VERSÍCULO POR VERSÍCULO
     ========================================================= */

  function continuarEnCapituloSiguiente(miToken) {
    if (miToken !== tokenLectura) return;
    if (estado !== "leyendo") return;

    const libroAntes =
      String(document.getElementById("libro")?.value || "");

    const capAntes =
      String(document.getElementById("capitulo")?.value || "");

    if (typeof window.capituloSiguiente !== "function") {
      detenerBibliaTTS(true);
      return;
    }

    /*
      Llamamos directamente a la navegación de Biblia.
      No simulamos un click, así el listener que frena el audio
      en cambios manuales no interrumpe el avance automático.
    */
    window.capituloSiguiente();

    setTimeout(() => {
      if (miToken !== tokenLectura) return;
      if (estado !== "leyendo") return;

      const libroDespues =
        String(document.getElementById("libro")?.value || "");

      const capDespues =
        String(document.getElementById("capitulo")?.value || "");

      /*
        Si no cambió libro/capítulo, estábamos en Apocalipsis 22
        o no había capítulo siguiente.
      */
      if (
        libroDespues === libroAntes &&
        capDespues === capAntes
      ) {
        detenerBibliaTTS(true);
        return;
      }

      versos = obtenerVersos();
      indiceActual = 0;
      versiculoInicioElegidoId = "";

      if (!versos.length) {
        detenerBibliaTTS(true);
        return;
      }

      leerActual(miToken);
    }, ES_MOVIL ? 140 : 110);
  }

  function leerActual(miToken) {
    if (miToken !== tokenLectura) return;
    if (estado !== "leyendo") return;

    if (indiceActual >= versos.length) {
      continuarEnCapituloSiguiente(miToken);
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

    hablarVersiculo(v.texto, miToken, () => {
      indiceActual++;

      setTimeout(() => {
        leerActual(miToken);
      }, ES_MOVIL ? 35 : 70);
    });
  }

  /* =========================================================
     CONTROL GENERAL
     ========================================================= */

  function reproducirDesde(indice = 0) {
    pausaReubicada = false;
    versos = obtenerVersos();

    if (!versos.length) {
      detenerBibliaTTS(true);
      return;
    }

    indiceActual = Math.max(0, Math.min(Number(indice) || 0, versos.length - 1));

    tokenLectura++;
    const miToken = tokenLectura;

    detenerBibliaTTSNativo();

    try {
      if (speechSynthesisDisponible()) {
        speechSynthesis.cancel();
      }
    } catch {}

    estado = "leyendo";
    setBoton("leyendo");
    iniciarKeepAlive();
    iniciarArpaBiblia();

    // Marcado y voz casi inmediato. Así no arranca la voz antes que el resaltado.
    setTimeout(() => {
      leerActual(miToken);
    }, 35);
  }

  function pausarBibliaTTS() {
    if (estado !== "leyendo") return;

    estado = "pausado";
    setBoton("pausado");
    detenerKeepAlive();
    pausarArpaBiblia();
    detenerBibliaTTSNativo();

    try {
      if (speechSynthesisDisponible()) {
        speechSynthesis.pause();
      }
    } catch {
      try {
        speechSynthesis.cancel();
      } catch {}
    }
  }

  function continuarBibliaTTS() {
    if (estado !== "pausado") return;

    if (pausaReubicada) {
      pausaReubicada = false;
      reproducirDesde(indiceActual);
      return;
    }

    estado = "leyendo";
    setBoton("leyendo");
    iniciarKeepAlive();
    iniciarArpaBiblia();

    try {
      if (speechSynthesisDisponible() && speechSynthesis.paused) {
        speechSynthesis.resume();

        setTimeout(() => {
          try {
            speechSynthesis.resume();
          } catch {}
        }, 120);

        return;
      }
    } catch {}

    reproducirDesde(indiceActual);
  }

  function detenerBibliaTTS(limpiar = true) {
    tokenLectura++;
    estado = "detenido";
    versiculoInicioElegidoId = "";
    pausaReubicada = false;
    detenerKeepAlive();
    detenerArpaBiblia();
    detenerBibliaTTSNativo();

    try {
      if (speechSynthesisDisponible()) {
        speechSynthesis.cancel();
      }
    } catch {}

    if (limpiar) {
      limpiarActivo();
      restaurarUltimoVersiculoTTS({ scroll: false });
    }

    setBoton("detenido");
  }

  function togglePlayPausa() {
    desbloquearArpaBibliaPorToque();

    if (estado === "leyendo") {
      pausarBibliaTTS();
      return;
    }

    if (estado === "pausado") {
      continuarBibliaTTS();
      return;
    }

    versos = obtenerVersos();

    const idxElegido =
      versiculoInicioElegidoId
        ? versos.findIndex(
            v => v.id === versiculoInicioElegidoId
          )
        : -1;

    reproducirDesde(
      idxElegido >= 0 ? idxElegido : 0
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

    const elegido = versos[idx];
    versiculoInicioElegidoId = elegido?.id || "";

    /*
      DETENIDO:
      tocar un versículo SOLO elige desde dónde empezará Play.
      No arranca el audio.
    */
    if (estado === "detenido") {
      indiceActual = idx;
      marcarActivo(el);
      setBoton("detenido");
      return;
    }

    /*
      PAUSADO:
      elegimos otro punto, pero seguimos pausados.
      Al tocar Play comenzará desde este versículo.
    */
    if (estado === "pausado") {
      tokenLectura++;
      detenerBibliaTTSNativo();

      try {
        if (speechSynthesisDisponible()) {
          speechSynthesis.cancel();
        }
      } catch {}

      indiceActual = idx;
      pausaReubicada = true;
      marcarActivo(el);
      pausarArpaBiblia();
      setBoton("pausado");
      return;
    }

    /*
      LEYENDO:
      después de haber arrancado con Play sí permitimos
      tocar otro versículo para saltar y reproducir desde ahí.
    */
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
      versiculoInicioElegidoId = "";
      detenerBibliaTTS(true);
    }
  }

  /* =========================================================
     INICIO
     ========================================================= */

  let bibliaTTSInitOK = false;
  let bibliaTTSInitIntentos = 0;

  function initBibliaTTS() {
    if (bibliaTTSInitOK) return;

    const btn = getBtn();

    if (!btn) {
      bibliaTTSInitIntentos++;

      if (bibliaTTSInitIntentos <= 80) {
        setTimeout(initBibliaTTS, 250);
      }

      return;
    }

    bibliaTTSInitOK = true;

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
        versiculoInicioElegidoId = "";
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

  function arrancarInitBibliaTTS() {
    setTimeout(initBibliaTTS, 0);
    setTimeout(initBibliaTTS, 400);
    setTimeout(initBibliaTTS, 1200);
    setTimeout(initBibliaTTS, 2500);
  }

  document.addEventListener("pointerdown", () => {
    if (!bibliaTTSInitOK) {
      initBibliaTTS();
    }

    desbloquearArpaBibliaPorToque();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", arrancarInitBibliaTTS);
  } else {
    arrancarInitBibliaTTS();
  }

  window.addEventListener("load", arrancarInitBibliaTTS);
})();