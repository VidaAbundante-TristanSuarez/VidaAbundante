// biblia.audio.js
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Si no existe el modal de audio, no hacemos nada
  if (!document.getElementById("modalAudio")) return;

  // ================= MODAL 3: AUDIO (BIBLIA) =================
  let __audioTextoOriginal = "";

  // ✅ URL Worker: el Worker llama al TTS con arpa
  const AUDIO_WEBAPP_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";
  const AUDIO_R2_UPLOAD_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

// ✅ Biblia Crear Imagen: SIEMPRE Standard seco, sin arpa y sin Firebase Function
const AUDIO_VOZ_BIBLIA = "es-US-Standard-B";

// ✅ Devocionales: Wavenet + arpa, pasando por Firebase Function
const AUDIO_VOZ_DEVOCIONAL = "es-US-Wavenet-B";

const AUDIO_LIMITE_COLAB_DIA = 3;

window.__audioCacheLocal = window.__audioCacheLocal || {
  texto: "",
  voiceName: "",
  audioBase64: ""
};

function audioEsAdmin() {
  return !!window.__ES_ADMIN;
}

function audioEsColaborador() {
  return !!window.__ES_COLABORADOR;
}

function audioPuedeGenerar() {
  return audioEsAdmin() || audioEsColaborador();
}

async function audioActualizarEstadoInicial() {
  const estado = document.getElementById("audioEstado");
  if (!estado) return;

  if (audioEsAdmin()) {
    estado.textContent = "Listo para previsualizar.";
    return;
  }

  if (audioEsColaborador()) {
    const restantes = await window.vaLeerRestantesUsoColaborador?.(
      "audioBiblia",
      AUDIO_LIMITE_COLAB_DIA
    );

    estado.textContent = `Listo para previsualizar. Te quedan ${restantes ?? 0} audios reales hoy.`;
    return;
  }

  estado.textContent = "No tenés permiso para generar audio.";
}
  
  // ✅ Fonética (no pisa si ya existe)
  window.__FONETICA = window.__FONETICA || {};
  if (!window.__FONETICA["Joiada"]) window.__FONETICA["Joiada"] = "Joíada";

  function audioNumeroATexto(n) {
  n = Number(n);

  const especiales = {
    0: "cero",
    1: "uno",
    2: "dos",
    3: "tres",
    4: "cuatro",
    5: "cinco",
    6: "seis",
    7: "siete",
    8: "ocho",
    9: "nueve",
    10: "diez",
    11: "once",
    12: "doce",
    13: "trece",
    14: "catorce",
    15: "quince",
    16: "dieciséis",
    17: "diecisiete",
    18: "dieciocho",
    19: "diecinueve",
    20: "veinte",
    21: "veintiuno",
    22: "veintidós",
    23: "veintitrés",
    24: "veinticuatro",
    25: "veinticinco",
    26: "veintiséis",
    27: "veintisiete",
    28: "veintiocho",
    29: "veintinueve",
    30: "treinta"
  };

  if (especiales[n]) return especiales[n];

  const decenas = {
    40: "cuarenta",
    50: "cincuenta",
    60: "sesenta",
    70: "setenta",
    80: "ochenta",
    90: "noventa"
  };

  if (n < 100) {
    const d = Math.floor(n / 10) * 10;
    const u = n % 10;

    return u
      ? `${decenas[d]} y ${especiales[u]}`
      : decenas[d];
  }

  if (n === 100) return "cien";

  if (n < 200) {
    return `ciento ${audioNumeroATexto(n - 100)}`;
  }

  return String(n);
}

function audioNormalizarLibrosNumerados(txt = "") {
  return String(txt || "")
    .replace(/\b1\s+Juan\b/gi, "Primera de Juan")
    .replace(/\b2\s+Juan\b/gi, "Segunda de Juan")
    .replace(/\b3\s+Juan\b/gi, "Tercera de Juan")

    .replace(/\b1\s+Pedro\b/gi, "Primera de Pedro")
    .replace(/\b2\s+Pedro\b/gi, "Segunda de Pedro")

    .replace(/\b1\s+Corintios\b/gi, "Primera de Corintios")
    .replace(/\b2\s+Corintios\b/gi, "Segunda de Corintios")

    .replace(/\b1\s+Tesalonicenses\b/gi, "Primera de Tesalonicenses")
    .replace(/\b2\s+Tesalonicenses\b/gi, "Segunda de Tesalonicenses")

    .replace(/\b1\s+Timoteo\b/gi, "Primera de Timoteo")
    .replace(/\b2\s+Timoteo\b/gi, "Segunda de Timoteo")

    .replace(/\b1\s+Samuel\b/gi, "Primera de Samuel")
    .replace(/\b2\s+Samuel\b/gi, "Segunda de Samuel")

    .replace(/\b1\s+Reyes\b/gi, "Primera de Reyes")
    .replace(/\b2\s+Reyes\b/gi, "Segunda de Reyes")

    .replace(/\b1\s+Crónicas\b/gi, "Primera de Crónicas")
    .replace(/\b2\s+Crónicas\b/gi, "Segunda de Crónicas");
}

function audioNormalizarReferenciasBiblicas(txt = "") {
  let out = audioNormalizarLibrosNumerados(txt);

  const libros = [
    "Génesis", "Genesis", "Éxodo", "Exodo", "Levítico", "Levitico",
    "Números", "Numeros", "Deuteronomio", "Josué", "Josue", "Jueces",
    "Rut", "Samuel", "Reyes", "Crónicas", "Cronicas", "Esdras",
    "Nehemías", "Nehemias", "Ester", "Job", "Salmos", "Salmo",
    "Proverbios", "Eclesiastés", "Eclesiastes", "Cantares", "Isaías",
    "Isaias", "Jeremías", "Jeremias", "Lamentaciones", "Ezequiel",
    "Daniel", "Oseas", "Joel", "Amós", "Amos", "Abdías", "Abdias",
    "Jonás", "Jonas", "Miqueas", "Nahúm", "Nahum", "Habacuc",
    "Sofonías", "Sofonias", "Hageo", "Zacarías", "Zacarias",
    "Malaquías", "Malaquias", "Mateo", "Marcos", "Lucas", "Juan",
    "Hechos", "Romanos", "Corintios", "Gálatas", "Galatas", "Efesios",
    "Filipenses", "Colosenses", "Tesalonicenses", "Timoteo", "Tito",
    "Filemón", "Filemon", "Hebreos", "Santiago", "Pedro", "Judas",
    "Apocalipsis"
  ];

  const librosRegex = libros.join("|");

  // Ej: Juan 1:3 / Mateo 9:14-17
  out = out.replace(
    new RegExp(`\\b(${librosRegex})\\s+(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?\\b`, "gi"),
    (m, libro, cap, v1, v2) => {
      const capTxt = audioNumeroATexto(cap);
      const v1Txt = audioNumeroATexto(v1);

      if (v2) {
        return `${libro} ${capTxt} del ${v1Txt} al ${audioNumeroATexto(v2)}`;
      }

      return `${libro} ${capTxt} ${v1Txt}`;
    }
  );

  // Ej: Mateo 9 del 14 al 17
  out = out.replace(
    new RegExp(`\\b(${librosRegex})\\s+(\\d{1,3})\\s+del\\s+(\\d{1,3})\\s+al\\s+(\\d{1,3})\\b`, "gi"),
    (m, libro, cap, v1, v2) => {
      return `${libro} ${audioNumeroATexto(cap)} del ${audioNumeroATexto(v1)} al ${audioNumeroATexto(v2)}`;
    }
  );

  return out;
}

function audioPrepararTextoParaTTS(txt = "") {
  let out = String(txt || "")
    .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  out = audioNormalizarReferenciasBiblicas(out);

  Object.entries(window.__FONETICA || {}).forEach(([buscar, reemplazo]) => {
    if (!buscar || !reemplazo) return;

    out = out.replace(
      new RegExp(`\\b${buscar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
      reemplazo
    );
  });

  return out;
}

function audioContextoActual() {
  const modalImagen = document.getElementById("modalPersonalizar");

  // ✅ Devocionales usa el mismo modal, pero marcado como modo-devocional
  if (
    window.__AUDIO_ORIGEN === "devocional" ||
    window.__DEVOCIONAL_AUDIO_ACTIVO === true ||
    modalImagen?.classList.contains("modo-devocional")
  ) {
    return "devocional";
  }

  // ✅ Por defecto: Biblia / Crear Imagen
  return "biblia";
}

function audio_getTextoDesdePreview() {
  const el = document.getElementById("previewTexto");
  return (el ? (el.innerText || el.textContent || "") : "").trim();
}

function audioTextoBaseActual() {
  const contexto = audioContextoActual();
  const ta = document.getElementById("textoAudio");

  // ✅ DEVOCIONALES:
  // Si devocionales ya armó el texto y lo puso en el textarea,
  // NO lo pisamos con previewTexto.
  if (contexto === "devocional") {
    const textoYaArmado = (ta?.value || "").trim();

    if (textoYaArmado) return textoYaArmado;

    if (typeof window.armarTextoAudioDevocional === "function") {
      const armado = String(window.armarTextoAudioDevocional() || "").trim();
      if (armado) return armado;
    }

    if (typeof window.devArmarTextoAudio === "function") {
      const armado = String(window.devArmarTextoAudio() || "").trim();
      if (armado) return armado;
    }

    return "";
  }

  // ✅ BIBLIA:
  // Acá sí tomamos el texto visible de la imagen.
  return audio_getTextoDesdePreview().trim();
}
  
function audioLimpiarEstadoViejoSiCambioTexto(textoNuevo = "") {
  const nuevo = String(textoNuevo || "").trim();
  const pendienteTexto = String(window.__pendingAudio?.texto || "").trim();
  const cacheTexto = String(window.__audioCacheLocal?.texto || "").trim();

  const coincidePendiente = nuevo && pendienteTexto && nuevo === pendienteTexto;
  const coincideCache = nuevo && cacheTexto && nuevo === cacheTexto;

  if (coincidePendiente || coincideCache) return;

  window.__audioBase64 = null;
  window.__pendingAudio = null;

  window.__audioCacheLocal = {
    texto: "",
    voiceName: "",
    audioBase64: ""
  };

  const audio = document.getElementById("audioPreview");
  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch (_) {}
  }
}

  // ✅ Abrir modal
window.abrirModalAudio = () => {
  const modal = document.getElementById("modalAudio");
  const ta = document.getElementById("textoAudio");
  const estado = document.getElementById("audioEstado");
  const audio = document.getElementById("audioPreview");

  if (!modal || !ta) return;

  const contexto = audioContextoActual();
  const textoActual = audioTextoBaseActual();

  audioLimpiarEstadoViejoSiCambioTexto(textoActual);

  if (audio) {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch (_) {}
  }

  // ✅ Biblia: sincroniza desde previewTexto.
  // ✅ Devocionales: conserva el texto armado que ya venía en textarea.
  __audioTextoOriginal = textoActual || "";

  if (textoActual) {
    ta.value = textoActual;
  } else if (contexto === "biblia") {
    ta.value = "";
  }

  if (estado) {
    estado.textContent = contexto === "devocional"
      ? "Preparando audio devocional..."
      : "Preparando audio de Biblia...";
  }

  audioActualizarEstadoInicial();

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
};
  // ✅ Cerrar modal
  window.cerrarModalAudio = () => {
    const modal = document.getElementById("modalAudio");
    if (!modal) return;
    try { window.speechSynthesis?.cancel(); } catch(e){}
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  };

  // ✅ Restaurar texto
  window.restaurarTextoAudio = () => {
    const ta = document.getElementById("textoAudio");
    if (!ta) return;
    ta.value = __audioTextoOriginal || "";
  };

  // ✅ Previa real
window.escucharPreviaAudio = async () => {
  const ta = document.getElementById("textoAudio");
  const estado = document.getElementById("audioEstado");
  const audio = document.getElementById("audioPreview");

  if (!ta || !audio) return;

  if (!audioPuedeGenerar()) {
    if (estado) estado.textContent = "⚠️ Solo admin o colaborador puede generar audio.";
    return;
  }

  const texto = (ta.value || "").trim();

  if (!texto) {
    if (estado) estado.textContent = "⚠️ No hay texto para previsualizar.";
    return;
  }

  const contexto = audioContextoActual();

  // ✅ Biblia: Standard seco, sin arpa, sin Function, aunque sea admin.
  const esBibliaSeco = contexto === "biblia";

  // ✅ Devocionales: Wavenet + arpa por Function.
  const esDevocionalArpa = contexto === "devocional";

  const textoLimpio = esDevocionalArpa
    ? audioPrepararTextoParaTTS(texto)
    : texto
        .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();

  const voiceName = esBibliaSeco
    ? AUDIO_VOZ_BIBLIA
    : (window.__AUDIO_VOICE_NAME || AUDIO_VOZ_DEVOCIONAL);

  const cache = window.__audioCacheLocal || {};

  const puedeReutilizar =
    cache.texto === textoLimpio &&
    cache.voiceName === voiceName &&
    cache.contexto === contexto &&
    cache.audioBase64;

  try {
    window.__audioBase64 = null;

    if (puedeReutilizar) {
      window.__audioBase64 = cache.audioBase64;

      const bytes = Uint8Array.from(atob(cache.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const localUrl = URL.createObjectURL(blob);

      audio.src = localUrl;
      audio.load();
      await audio.play();

      if (estado) {
        estado.textContent = "✅ Reproduciendo audio ya generado. No se descontó otro uso.";
      }

      return;
    }

    let restantesAntes = null;

    // ✅ Límite diario SOLO para colaboradores, no para admin.
    if (!audioEsAdmin() && audioEsColaborador()) {
      restantesAntes = await window.vaLeerRestantesUsoColaborador?.(
        esBibliaSeco ? "audioBiblia" : "audioDevocional",
        AUDIO_LIMITE_COLAB_DIA
      );

      if (Number(restantesAntes || 0) <= 0) {
        if (estado) {
          estado.textContent = `⚠️ Llegaste al límite diario de ${AUDIO_LIMITE_COLAB_DIA} audios. Podés volver a usarlo mañana.`;
        }
        return;
      }
    }

    if (estado) {
      estado.textContent = esBibliaSeco
        ? "🎧 Generando voz Standard sin arpa..."
        : "🎧 Generando previa devocional con arpa...";
    }

    const body = esBibliaSeco
      ? {
          action: "ttsSeco",
          texto: textoLimpio,
          voiceName,
          languageCode: "es-US"
        }
      : {
          action: "tts",
          texto: textoLimpio,
          voiceName
        };

    const r = await fetch(AUDIO_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw new Error(data?.error || "Error HTTP " + r.status);
    }

    if (!data.audioBase64) {
      throw new Error("No devolvió audioBase64");
    }

    window.__audioBase64 = data.audioBase64;

    // ✅ Registrar uso solo después de que Google devolvió audio real.
    if (!audioEsAdmin() && audioEsColaborador()) {
      try {
        const consumo = await window.vaConsumirUsoColaborador?.(
          esBibliaSeco ? "audioBiblia" : "audioDevocional",
          AUDIO_LIMITE_COLAB_DIA,
          {
            caracteres: textoLimpio.length,
            contexto,
            voiceName
          }
        );

        if (estado) {
          estado.textContent = `✅ Audio generado. Te quedan ${consumo?.restantes ?? 0} audios hoy.`;
        }
      } catch (limiteErr) {
        if (estado) {
          estado.textContent = "⚠️ " + (limiteErr?.message || "No pude registrar el uso diario.");
        }
        return;
      }
    }

    window.__audioCacheLocal = {
      texto: textoLimpio,
      voiceName,
      contexto,
      audioBase64: data.audioBase64
    };

    const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const localUrl = URL.createObjectURL(blob);

    audio.src = localUrl;
    audio.load();
    await audio.play();

    if (estado) {
      estado.textContent = esBibliaSeco
        ? "✅ Voz Standard reproduciendo."
        : "✅ Previa devocional reproduciendo.";
    }

  } catch (e) {
    console.error(e);
    if (estado) {
      estado.textContent = "❌ No se pudo generar la previa real.";
    }
  }
};

  // ✅ Confirmar (no sube todavía)
  window.finalizarYSubirAudio = async () => {
    const estado = document.getElementById("audioEstado");
    const ta = document.getElementById("textoAudio");
    if (!ta) return;

    const texto = (ta.value || "").trim();
    if (!texto) {
      if (estado) estado.textContent = "⚠️ Pegá o escribí el texto antes de confirmar.";
      return;
    }
    if (!window.__audioBase64) {
      if (estado) estado.textContent = "⚠️ Primero generá la previa.";
      return;
    }

const textoFinalAudio = audioPrepararTextoParaTTS
  ? audioPrepararTextoParaTTS(texto)
  : texto;

window.__pendingAudio = {
  texto: textoFinalAudio,
  audioBase64: window.__audioBase64,
  ts: Date.now()
};
    if (estado) estado.textContent = "✅ Audio confirmado. Volvé a la imagen para finalizar.";
  };

  // ✅ Botón "Abrir audio" del modal de imagen
  const b = document.getElementById("btnAbrirAudio");
  if (b) {
    b.type = "button";
    b.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.abrirModalAudio?.();
    };
  }

window.__lastAudioUrl = "";
window.__lastAudioTs = 0;
window.__lastAudioTexto = "";

window.subirPendingAudioAFirebase = async ({ subirIglesia = false } = {}) => {
  if (!window.__UID) throw new Error("No hay uid");

  const p = window.__pendingAudio;
  if (!p?.audioBase64) throw new Error("No hay audio pendiente");

  const ts = p.ts || Date.now();
  const fileName = `audio_biblia_${ts}.mp3`;

  const r = await fetch(AUDIO_R2_UPLOAD_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64: p.audioBase64,
      fileName,
      contentType: "audio/mpeg",
      folder: subirIglesia ? "audios_iglesia" : "audios_biblia"
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data?.url) {
    throw new Error(data?.error || "No pude subir el audio a R2.");
  }

  const url = data.url;

  // ✅ CLAVE:
  // No guardamos en panelAudiosPersonal porque tus reglas lo están bloqueando.
  // La URL queda unida a la imagen desde biblia.js.
  window.__lastAudioUrl = url;
  window.__lastAudioTs = ts;
  window.__lastAudioTexto = p.texto || "";

  window.__pendingAudio = null;

  console.log("✅ Audio Biblia subido a R2:", url);

  return url;
};
});
