// biblia.audio.js
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Si no existe el modal de audio, no hacemos nada
  if (!document.getElementById("modalAudio")) return;

  // ================= MODAL 3: AUDIO (BIBLIA) =================
  let __audioTextoOriginal = "";
  let __audioTextoEditado = false;

  // ✅ URL Worker: el Worker llama al TTS con arpa
  const AUDIO_WEBAPP_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";
  const AUDIO_R2_UPLOAD_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

// ✅ Biblia Crear Imagen: SIEMPRE Standard seco, sin arpa y sin Firebase Function
const AUDIO_VOZ_BIBLIA = "es-US-Standard-B";

// ✅ Devocionales: Wavenet + arpa, pasando por Firebase Function
const AUDIO_VOZ_DEVOCIONAL = "es-US-Wavenet-B";

// ✅ Comentarios de prédica: segunda voz masculina, español de EE.UU.
const AUDIO_VOZ_COMENTARIO_PREDICA = "es-US-Wavenet-C";

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

  const contexto = audioContextoActual();

  const tipoUso =
    contexto === "predica"
      ? "audioPredica"
      : contexto === "devocional"
        ? "audioDevocional"
        : "audioBiblia";

  const mensajeListo =
    contexto === "predica"
      ? "Listo para previsualizar el audio de la prédica."
      : contexto === "devocional"
        ? "Listo para previsualizar el audio devocional."
        : "Listo para previsualizar el audio de Biblia.";

  if (audioEsAdmin()) {
    estado.textContent = mensajeListo;
    return;
  }

  if (audioEsColaborador()) {
    const restantes = await window.vaLeerRestantesUsoColaborador?.(
      tipoUso,
      AUDIO_LIMITE_COLAB_DIA
    );

    estado.textContent =
      `${mensajeListo} Te quedan ${restantes ?? 0} audios hoy.`;

    return;
  }

  estado.textContent = "No tenés permiso para generar audio.";
}

  // ✅ Fonética (no pisa si ya existe)
  window.__FONETICA = window.__FONETICA || {};
  if (!window.__FONETICA["Joiada"]) window.__FONETICA["Joiada"] = "Joíada";

  // Evita que la voz Wavenet pronuncie “Yeicob”.
  if (!window.__FONETICA["Jacob"]) window.__FONETICA["Jacob"] = "Jacób";
  if (!window.__FONETICA["jacob"]) window.__FONETICA["jacob"] = "jacób";

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
    30: "treinta",
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
    .replace(/[*•▪●■□◆◇▶►◼◻]/g, "")
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

// =========================================================
// TEXTOS LARGOS: DIVIDIR SIN SUPERAR EL LÍMITE DE GOOGLE TTS
// Google acepta como máximo 5000 bytes por solicitud.
// Usamos 4300 bytes para dejar margen con tildes y signos.
// =========================================================
const AUDIO_TTS_MAX_BYTES = 1800;

function audioCantidadBytes(texto = "") {
  return new TextEncoder().encode(String(texto || "")).length;
}

function audioPartirUnidadPorBytes(unidad = "", maxBytes = AUDIO_TTS_MAX_BYTES) {
  const palabras = String(unidad || "").trim().split(/\s+/).filter(Boolean);
  const partes = [];
  let actual = "";

  palabras.forEach(palabra => {
    const candidato = actual ? `${actual} ${palabra}` : palabra;

    if (audioCantidadBytes(candidato) <= maxBytes) {
      actual = candidato;
      return;
    }

    if (actual) {
      partes.push(actual);
      actual = "";
    }

    /*
      Caso muy raro: una sola “palabra” supera el límite.
      La cortamos por caracteres sin romper Unicode.
    */
    if (audioCantidadBytes(palabra) > maxBytes) {
      let trozo = "";

      for (const caracter of palabra) {
        const nuevo = trozo + caracter;

        if (audioCantidadBytes(nuevo) > maxBytes) {
          if (trozo) partes.push(trozo);
          trozo = caracter;
        } else {
          trozo = nuevo;
        }
      }

      if (trozo) actual = trozo;
    } else {
      actual = palabra;
    }
  });

  if (actual) partes.push(actual);
  return partes;
}

function audioPartirTextoPorBytes(texto = "", maxBytes = AUDIO_TTS_MAX_BYTES) {
  const limpio = String(texto || "").trim();

  if (!limpio) return [];
  if (audioCantidadBytes(limpio) <= maxBytes) return [limpio];

  /*
    Primero intentamos respetar finales de oración.
    Si una oración sola es demasiado larga, se divide por palabras.
  */
  const unidades =
    limpio.match(/[^.!?;:\n]+[.!?;:\n]*/g) || [limpio];

  const partes = [];
  let actual = "";

  unidades.forEach(unidadBruta => {
    const unidad = String(unidadBruta || "").trim();
    if (!unidad) return;

    const subPartes =
      audioCantidadBytes(unidad) > maxBytes
        ? audioPartirUnidadPorBytes(unidad, maxBytes)
        : [unidad];

    subPartes.forEach(subParte => {
      const candidato = actual ? `${actual} ${subParte}` : subParte;

      if (audioCantidadBytes(candidato) <= maxBytes) {
        actual = candidato;
      } else {
        if (actual) partes.push(actual);
        actual = subParte;
      }
    });
  });

  if (actual) partes.push(actual);

  return partes.filter(Boolean);
}

function audioBase64ABytes(base64 = "") {
  const binario = atob(String(base64 || ""));
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes;
}

function audioQuitarId3Inicial(bytes) {
  if (
    !bytes ||
    bytes.length < 10 ||
    bytes[0] !== 0x49 ||
    bytes[1] !== 0x44 ||
    bytes[2] !== 0x33
  ) {
    return bytes;
  }

  const tamano =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);

  const inicioAudio = 10 + tamano;

  return inicioAudio < bytes.length
    ? bytes.slice(inicioAudio)
    : bytes;
}

function audioBytesABase64(bytes) {
  let binario = "";
  const paso = 0x8000;

  for (let i = 0; i < bytes.length; i += paso) {
    const trozo = bytes.subarray(i, Math.min(i + paso, bytes.length));
    binario += String.fromCharCode(...trozo);
  }

  return btoa(binario);
}

function audioUnirMp3Base64(listaBase64 = []) {
  const partes = listaBase64
    .filter(Boolean)
    .map((base64, indice) => {
      const bytes = audioBase64ABytes(base64);

      /*
        Conservamos la cabecera ID3 del primer archivo.
        En los siguientes la quitamos para evitar cortes raros.
      */
      return indice === 0
        ? bytes
        : audioQuitarId3Inicial(bytes);
    });

  const total = partes.reduce((suma, bytes) => suma + bytes.length, 0);
  const unido = new Uint8Array(total);

  let offset = 0;

  partes.forEach(bytes => {
    unido.set(bytes, offset);
    offset += bytes.length;
  });

  return audioBytesABase64(unido);
}

async function audioPedirParteTTS({
  texto = "",
  action = "ttsSeco",
  voiceName = AUDIO_VOZ_BIBLIA,
  intento = 0
} = {}) {
  const body =
    action === "tts"
      ? {
          action: "tts",
          texto,
          voiceName
        }
      : {
          action: "ttsSeco",
          texto,
          voiceName,
          languageCode: "es-US"
        };

  const r = await fetch(AUDIO_WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const mensaje = String(
      data?.error ||
      data?.detail ||
      "Error HTTP " + r.status
    );

    /*
      Seguridad extra:
      la Function que agrega el arpa puede envolver el texto
      con SSML u otros datos y superar el límite aunque la parte
      original esté por debajo de 5000 bytes.

      Si ocurre, dividimos esa parte nuevamente.
      El arpa queda solo en el primer subfragmento.
    */
    const esErrorPorLargo =
      /5000 bytes|longer than the limit|INVALID_ARGUMENT/i.test(
        mensaje
      );

    if (
      esErrorPorLargo &&
      intento < 5 &&
      audioCantidadBytes(texto) > 500
    ) {
      const limiteNuevo = Math.max(
        500,
        Math.floor(
          audioCantidadBytes(texto) / 2
        )
      );

      const subPartes =
        audioPartirTextoPorBytes(
          texto,
          limiteNuevo
        );

      if (subPartes.length > 1) {
        const audios = [];

        for (let i = 0; i < subPartes.length; i++) {
          const subAction =
            i === 0
              ? action
              : "ttsSeco";

          const audioParte =
            await audioPedirParteTTS({
              texto: subPartes[i],
              action: subAction,
              voiceName,
              intento: intento + 1
            });

          audios.push(audioParte);
        }

        return audioUnirMp3Base64(
          audios
        );
      }
    }

    throw new Error(mensaje);
  }

  if (!data.audioBase64) {
    throw new Error(
      "No devolvió audioBase64"
    );
  }

  return data.audioBase64;
}

/*
  La prédica completa se genera en Firebase.
  Allí se divide, alterna las dos voces, se recodifica como un
  único MP3 válido y recién después se mezcla el arpa una sola vez.
*/
async function audioPedirPredicaCompletaTTS({
  texto = "",
  segmentos = []
} = {}) {
  const body = {
    action: "ttsPredica",
    texto: String(texto || "").trim(),
    segmentos: Array.isArray(segmentos) ? segmentos : [],
    voiceNameScripture: AUDIO_VOZ_DEVOCIONAL,
    voiceNameComment: AUDIO_VOZ_COMENTARIO_PREDICA,

    // Evita reutilizaciones accidentales de una generación anterior.
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`
  };

  const r = await fetch(AUDIO_WEBAPP_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache"
    },
    body: JSON.stringify(body)
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(
      String(
        data?.error ||
        data?.detail ||
        "Error HTTP " + r.status
      )
    );
  }

  if (!data.audioBase64) {
    throw new Error(
      "Firebase no devolvió el audio completo de la prédica."
    );
  }

  return data.audioBase64;
}

function audioContextoActual() {
  const modalImagen = document.getElementById("modalPersonalizar");

  // ✅ Prédicas: Wavenet + arpa
  if (window.__AUDIO_ORIGEN === "predica") {
    return "predica";
  }

  // ✅ Devocionales: Wavenet + arpa
  if (
    window.__AUDIO_ORIGEN === "devocional" ||
    window.__DEVOCIONAL_AUDIO_ACTIVO === true ||
    modalImagen?.classList.contains("modo-devocional")
  ) {
    return "devocional";
  }

  // ✅ Biblia y notas: voz Standard seca
  return "biblia";
}

function audio_getTextoDesdePreview() {
  const el = document.getElementById("previewTexto");
  return (el ? (el.innerText || el.textContent || "") : "").trim();
}

function audioTextoBaseActual() {
  const contexto = audioContextoActual();
  const ta = document.getElementById("textoAudio");

  // ✅ PRÉDICAS:
  if (contexto === "predica") {
    return String(
      window.__AUDIO_PREDICA_TEXTO || ""
    ).trim();
  }

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
  return audio_getTextoDesdePreview().trim();
}

function audioResetAudioGeneradoActual() {
  window.__audioBase64 = null;
  window.__pendingAudio = null;

  window.__audioCacheLocal = {
    texto: "",
    textoOriginal: "",
    voiceName: "",
    contexto: "",
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

function audioLimpiarEstadoViejoSiCambioTexto(textoNuevo = "") {
  const nuevoOriginal = String(textoNuevo || "").trim();
  const nuevoTTS = audioPrepararTextoParaTTS(nuevoOriginal);

  const pendienteTexto = String(window.__pendingAudio?.texto || "").trim();
  const pendienteTextoOriginal = String(window.__pendingAudio?.textoOriginal || "").trim();

  const cacheTexto = String(window.__audioCacheLocal?.texto || "").trim();
  const cacheTextoOriginal = String(window.__audioCacheLocal?.textoOriginal || "").trim();

  const coincidePendiente =
    nuevoOriginal &&
    (
      nuevoOriginal === pendienteTexto ||
      nuevoTTS === pendienteTexto ||
      nuevoOriginal === pendienteTextoOriginal ||
      nuevoTTS === pendienteTextoOriginal
    );

  const coincideCache =
    nuevoOriginal &&
    (
      nuevoOriginal === cacheTexto ||
      nuevoTTS === cacheTexto ||
      nuevoOriginal === cacheTextoOriginal ||
      nuevoTTS === cacheTextoOriginal
    );

  if (coincidePendiente || coincideCache) return;

  audioResetAudioGeneradoActual();
}

function audioPredicaBloquesDesdeTexto(textoActual = "") {
  const raw = String(textoActual || "")
    .replace(/\r/g, "")
    .trim();

  if (!raw) return [];

  const bloquesDobles = raw
    .split(/\n\s*\n+/)
    .map(x => String(x || "").trim())
    .filter(Boolean);

  if (bloquesDobles.length > 1) {
    return bloquesDobles;
  }

  return raw
    .split(/\n+/)
    .map(x => String(x || "").trim())
    .filter(Boolean);
}

function audioPredicaNormalizarParaComparar(txt = "") {
  return audioPrepararTextoParaTTS(txt)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[*•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/[^\wáéíóúüñ\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function audioPredicaTextoFueEditado(textoActual = "") {
  if (audioContextoActual() !== "predica") return false;

  // Si el usuario tocó el textarea, para Regenerar ese texto es la fuente real.
  if (__audioTextoEditado) return true;

  const actual = audioPredicaNormalizarParaComparar(textoActual);
  const original = audioPredicaNormalizarParaComparar(
    window.__AUDIO_PREDICA_TEXTO || ""
  );

  if (!actual || !original) return false;

  return actual !== original;
}

function audioSegmentosPredicaSeguros(textoActual = "", textoLimpio = "") {
  const segmentosBase = Array.isArray(window.__AUDIO_PREDICA_SEGMENTOS)
    ? window.__AUDIO_PREDICA_SEGMENTOS.filter(s => s && String(s.texto || "").trim())
    : [];

  const bloquesEditados = audioPredicaBloquesDesdeTexto(textoActual)
    .map(txt => audioPrepararTextoParaTTS(txt))
    .filter(Boolean);

  const fueEditado = audioPredicaTextoFueEditado(textoActual);

  /*
    Si el usuario corrigió el textarea, el audio DEBE salir de ese texto.
    Si se conservaron la misma cantidad de bloques, mantenemos además
    qué bloques usan voz bíblica y cuáles voz de comentario.
  */
  if (fueEditado && bloquesEditados.length) {
    if (
      segmentosBase.length &&
      bloquesEditados.length === segmentosBase.length
    ) {
      return bloquesEditados.map((texto, i) => ({
        tipo:
          segmentosBase[i]?.tipo === "comentario"
            ? "comentario"
            : "biblia",
        texto
      }));
    }

    const textoEditadoCompleto = audioPrepararTextoParaTTS(
      textoLimpio || textoActual || ""
    );

    return textoEditadoCompleto
      ? [{ tipo: "biblia", texto: textoEditadoCompleto }]
      : [];
  }

  // Si NO fue editado, conservamos exactamente los segmentos originales.
  if (segmentosBase.length) {
    return segmentosBase
      .map(seg => ({
        tipo: seg.tipo === "comentario" ? "comentario" : "biblia",
        texto: audioPrepararTextoParaTTS(seg.texto || "")
      }))
      .filter(s => s.texto);
  }

  const texto = audioPrepararTextoParaTTS(textoLimpio || textoActual || "");
  return texto
    ? [{ tipo: "biblia", texto }]
    : [];
}

function audioHookLimpiarCacheAlEditarTextarea(ta) {
  if (!ta || ta.__audioClearCacheHooked) return;

  ta.__audioClearCacheHooked = true;

  ta.addEventListener("input", () => {
    const contexto = audioContextoActual();

    /*
      PRÉDICA:
      mientras el usuario corrige el texto NO frenamos el audio,
      NO borramos el src y NO cambiamos el mensaje de estado.
      Solo marcamos que, cuando toque Regenerar/Escucha previa,
      hay que crear un audio nuevo desde el textarea actual.
    */
    if (contexto === "predica") {
      __audioTextoEditado = true;
      return;
    }

    // Biblia / devocionales conservan el comportamiento anterior.
    audioResetAudioGeneradoActual();
  });
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

audioHookLimpiarCacheAlEditarTextarea(ta);
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

  // Recién abierto: todavía no hay cambios manuales en este textarea.
  __audioTextoEditado = false;

  if (estado) {
    estado.textContent =
      contexto === "predica"
        ? "Preparando audio de la prédica..."
        : contexto === "devocional"
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
    if (estado) {
      estado.textContent = "⚠️ Solo admin o colaborador puede generar audio.";
    }
    return;
  }

const texto = (ta.value || "").trim();

if (!texto) {
  if (estado) estado.textContent = "⚠️ No hay texto para previsualizar.";
  return;
}

audioLimpiarEstadoViejoSiCambioTexto(texto);

const contexto = audioContextoActual();

  // Biblia y notas usan Standard seca.
  const esBibliaSeco = contexto === "biblia";

  // Devocionales y prédicas usan Wavenet con arpa.
  const esPredicaArpa = contexto === "predica";
  const esDevocionalArpa = contexto === "devocional";

  const tipoUsoAudio =
    esPredicaArpa
      ? "audioPredica"
      : esBibliaSeco
        ? "audioBiblia"
        : "audioDevocional";

  const textoLimpio = audioPrepararTextoParaTTS(texto);

  const voiceName = esBibliaSeco
    ? AUDIO_VOZ_BIBLIA
    : (window.__AUDIO_VOICE_NAME || AUDIO_VOZ_DEVOCIONAL);

  const cache = window.__audioCacheLocal || {};

  const puedeReutilizar =
    !__audioTextoEditado &&
    cache.texto === textoLimpio &&
    String(cache.textoOriginal || "").trim() === texto &&
    cache.voiceName === voiceName &&
    cache.contexto === contexto &&
    cache.audioBase64;

  try {
    window.__audioBase64 = null;

    if (puedeReutilizar) {
      window.__audioBase64 = cache.audioBase64;

      const bytes = Uint8Array.from(
        atob(cache.audioBase64),
        c => c.charCodeAt(0)
      );

      const blob = new Blob([bytes], {
        type: "audio/mpeg"
      });

      const localUrl = URL.createObjectURL(blob);

      audio.src = localUrl;
      audio.load();
      await audio.play();

      if (estado) {
        estado.textContent =
          "✅ Reproduciendo audio ya generado. No se descontó otro uso.";
      }

      return;
    }

    let restantesAntes = null;

    // Límite diario solo para colaboradores.
    if (!audioEsAdmin() && audioEsColaborador()) {
      restantesAntes =
        await window.vaLeerRestantesUsoColaborador?.(
          tipoUsoAudio,
          AUDIO_LIMITE_COLAB_DIA
        );

      if (Number(restantesAntes || 0) <= 0) {
        if (estado) {
          estado.textContent =
            `⚠️ Llegaste al límite diario de ${AUDIO_LIMITE_COLAB_DIA} audios. Podés volver a usarlo mañana.`;
        }
        return;
      }
    }

    if (estado) {
      estado.textContent =
        esBibliaSeco
          ? "🎧 Generando voz Standard sin arpa..."
          : esPredicaArpa
            ? "🎧 Generando audio de la prédica con arpa..."
            : "🎧 Generando previa devocional con arpa...";
    }

    let audioBase64Final = "";

    if (esPredicaArpa) {
      if (estado) {
        estado.textContent =
          "🎧 Generando la prédica completa. Las citas y los comentarios usarán voces distintas...";
      }

const segmentosPredica = audioSegmentosPredicaSeguros(
  texto,
  textoLimpio
);

const textoPredicaSeguro = segmentosPredica
  .map(s => s.texto)
  .filter(Boolean)
  .join("\n\n")
  .trim() || textoLimpio;

audioBase64Final =
  await audioPedirPredicaCompletaTTS({
    texto: textoPredicaSeguro,
    segmentos: segmentosPredica
  });

    } else if (esDevocionalArpa) {
      /*
        El devocional completo también queda a cargo de Firebase.
        Si alguna vez es largo, Firebase lo une correctamente antes
        de devolverlo.
      */
      audioBase64Final =
        await audioPedirParteTTS({
          texto: textoLimpio,
          action: "tts",
          voiceName
        });

    } else {
      /*
        Biblia y notas conservan la voz seca directa.
        Normalmente son textos breves; si superan el límite se
        dividen como antes.
      */
      const partesTexto =
        audioPartirTextoPorBytes(textoLimpio);

      const audiosPartes = [];

      for (let i = 0; i < partesTexto.length; i++) {
        if (estado && partesTexto.length > 1) {
          estado.textContent =
            `🎧 Generando parte ${i + 1} de ${partesTexto.length}...`;
        }

        const audioParte =
          await audioPedirParteTTS({
            texto: partesTexto[i],
            action: "ttsSeco",
            voiceName
          });

        audiosPartes.push(audioParte);
      }

      audioBase64Final =
        audiosPartes.length === 1
          ? audiosPartes[0]
          : audioUnirMp3Base64(audiosPartes);
    }

    const data = {
      audioBase64: audioBase64Final
    };

    window.__audioBase64 = audioBase64Final;

    // Registrar uso solo cuando el audio fue generado de verdad.
    if (!audioEsAdmin() && audioEsColaborador()) {
      try {
        const consumo =
          await window.vaConsumirUsoColaborador?.(
            tipoUsoAudio,
            AUDIO_LIMITE_COLAB_DIA,
            {
              caracteres: textoLimpio.length,
              contexto,
              voiceName
            }
          );

        if (estado) {
          estado.textContent =
            `✅ Audio generado. Te quedan ${consumo?.restantes ?? 0} audios hoy.`;
        }
      } catch (limiteErr) {
        if (estado) {
          estado.textContent =
            "⚠️ " +
            (
              limiteErr?.message ||
              "No pude registrar el uso diario."
            );
        }
        return;
      }
    }

    window.__audioCacheLocal = {
      texto: textoLimpio,
      textoOriginal: texto,
      voiceName,
      contexto,
      audioBase64: data.audioBase64
    };

    // Este audio corresponde exactamente al texto que se acaba de generar.
    __audioTextoEditado = false;

    const bytes = Uint8Array.from(
      atob(data.audioBase64),
      c => c.charCodeAt(0)
    );

    const blob = new Blob([bytes], {
      type: "audio/mpeg"
    });

    const localUrl = URL.createObjectURL(blob);

    audio.src = localUrl;
    audio.load();
    await audio.play();

    if (estado) {
      estado.textContent =
        esBibliaSeco
          ? "✅ Voz Standard reproduciendo."
          : esPredicaArpa
            ? "✅ Audio de la prédica reproduciendo."
            : "✅ Previa devocional reproduciendo.";
    }

  } catch (e) {
    console.error(e);

    if (estado) {
      const mensaje = String(e?.message || "");

      estado.textContent =
        mensaje.includes("5000 bytes")
          ? "❌ El texto sigue siendo demasiado largo para el servicio de voz."
          : "❌ No se pudo generar la previa real.";
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

const textoFinalAudio = audioPrepararTextoParaTTS(texto);

window.__pendingAudio = {
  texto: textoFinalAudio,
  textoOriginal: texto,
  audioBase64: window.__audioBase64,
  contexto: audioContextoActual(),
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
  const contexto = String(
    p.contexto ||
    window.__AUDIO_ORIGEN ||
    "biblia"
  ).trim();

  const prefijo =
    contexto === "predica"
      ? "audio_predica"
      : contexto === "devocional"
        ? "audio_devocional"
        : contexto === "nota"
          ? "audio_nota"
          : "audio_biblia";

  const fileName = `${prefijo}_${ts}.mp3`;

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

  console.log("✅ Audio subido a R2:", url);

  return url;
};

// =========================================================
// 🎧 AUDIO DE NOTAS + TÍTULO DINÁMICO DEL MODAL
// =========================================================

/*
  Conservamos la función original que toma
  el texto desde Crear imagen o Devocionales.
*/
const vaAudioTextoBaseAnterior =
  audioTextoBaseActual;

/*
  Cuando el audio viene desde una nota,
  usamos el texto preparado por biblia.js.
*/
audioTextoBaseActual = function() {
  if (window.__AUDIO_ORIGEN === "nota") {
    return String(
      window.__AUDIO_NOTA_TEXTO || ""
    ).trim();
  }

  if (window.__AUDIO_ORIGEN === "predica") {
    return String(
      window.__AUDIO_PREDICA_TEXTO || ""
    ).trim();
  }

  return vaAudioTextoBaseAnterior();
};

function vaAudioCambiarTituloModal(
  texto = "🎧 Audio de Biblia"
) {
  const modal =
    document.getElementById("modalAudio");

  const card =
    modal?.querySelector(".modal-card");

  const cabecera =
    card?.firstElementChild;

  const titulo =
    cabecera?.querySelector(
      "b, strong, h2, h3"
    );

  if (titulo) {
    titulo.textContent = texto;
  }
}

/*
  Modificamos la apertura sin borrar
  el funcionamiento que ya tenías.
*/
const vaAbrirModalAudioAnterior =
  window.abrirModalAudio;

window.abrirModalAudio = function() {
  const origen = String(
    window.__AUDIO_ORIGEN || ""
  );

  vaAbrirModalAudioAnterior?.();

  const modalImagen =
    document.getElementById(
      "modalPersonalizar"
    );

  const esDevocional =
    origen === "devocional" ||
    window.__DEVOCIONAL_AUDIO_ACTIVO === true ||
    modalImagen?.classList.contains(
      "modo-devocional"
    );

  /*
    PRÉDICA:
    Wavenet con arpa y audio anterior si ya existe.
  */
  if (origen === "predica") {
    vaAudioCambiarTituloModal(
      "🎧 Audio de la prédica"
    );

    const audio =
      document.getElementById(
        "audioPreview"
      );

    const urlExistente =
      String(
        window.__AUDIO_PREDICA_URL || ""
      ).trim();

    if (audio && urlExistente) {
      audio.src = urlExistente;
      audio.load();
    }

    [0, 180, 550].forEach(ms => {
      setTimeout(() => {
        if (
          window.__AUDIO_ORIGEN !== "predica"
        ) {
          return;
        }

        const estado =
          document.getElementById(
            "audioEstado"
          );

        if (!estado) return;

        estado.textContent =
          urlExistente
            ? "Esta prédica ya tiene audio. Podés escucharlo o generar uno nuevo."
            : "Listo para previsualizar el audio de la prédica.";
      }, ms);
    });

    return;
  }

  /*
    NOTA:
    conserva la voz seca de Biblia.
  */
  if (origen === "nota") {
    vaAudioCambiarTituloModal(
      "🎧 Audio de la nota"
    );

    const audio =
      document.getElementById(
        "audioPreview"
      );

    const urlExistente =
      String(
        window.__AUDIO_NOTA_URL || ""
      ).trim();

    if (audio && urlExistente) {
      audio.src = urlExistente;
      audio.load();
    }

    [0, 180, 550].forEach(ms => {
      setTimeout(() => {
        if (
          window.__AUDIO_ORIGEN !== "nota"
        ) {
          return;
        }

        const estado =
          document.getElementById(
            "audioEstado"
          );

        if (!estado) return;

        estado.textContent =
          urlExistente
            ? "Esta nota ya tiene audio. Podés escucharlo o generar uno nuevo."
            : "Listo para previsualizar el audio de la nota.";
      }, ms);
    });

    return;
  }

  if (esDevocional) {
    vaAudioCambiarTituloModal(
      "🎧 Audio devocional"
    );
  } else {
    vaAudioCambiarTituloModal(
      "🎧 Audio de Biblia"
    );
  }
};

/*
  Al cerrar, limpiamos el contexto específico.
*/
const vaCerrarModalAudioAnterior =
  window.cerrarModalAudio;

window.cerrarModalAudio = function() {
  const origenCerrado = String(
    window.__AUDIO_ORIGEN || ""
  );

  vaCerrarModalAudioAnterior?.();

  if (origenCerrado === "nota") {
    window.__AUDIO_ORIGEN = "";
    window.__AUDIO_NOTA_ID = "";
    window.__AUDIO_NOTA_TEXTO = "";
    window.__AUDIO_NOTA_URL = "";
    window.__AUDIO_NOTA_ORIGEN_LISTA = "";
  }

  if (origenCerrado === "predica") {
    window.__AUDIO_ORIGEN = "";
    window.__AUDIO_PREDICA_ID = "";
    window.__AUDIO_PREDICA_TEXTO = "";
    window.__AUDIO_PREDICA_SEGMENTOS = [];
    window.__AUDIO_PREDICA_FECHA = "";
    window.__AUDIO_PREDICA_URL = "";
  }
};

/*
  El botón Correcto:
  - en notas, guarda el audio en la nota;
  - en prédicas, guarda el audio en la prédica;
  - en Biblia/Devocionales conserva el flujo original.
*/
const vaFinalizarAudioAnterior =
  window.finalizarYSubirAudio;

window.finalizarYSubirAudio =
  async function() {
    const origen = String(
      window.__AUDIO_ORIGEN || ""
    );

    if (
      origen !== "nota" &&
      origen !== "predica"
    ) {
      return await vaFinalizarAudioAnterior?.();
    }

    const estado =
      document.getElementById(
        "audioEstado"
      );

    const textarea =
      document.getElementById(
        "textoAudio"
      );

    const texto = String(
      textarea?.value || ""
    ).trim();

    if (!texto) {
      if (estado) {
        estado.textContent =
          origen === "predica"
            ? "⚠️ La prédica no tiene texto para el audio."
            : "⚠️ Escribí o pegá el texto del audio.";
      }
      return;
    }

    if (origen === "predica" && __audioTextoEditado) {
      if (estado) {
        estado.textContent =
          "⚠️ Terminaste de editar el texto. Tocá Regenerar y después Correcto.";
      }
      return;
    }

    if (!window.__audioBase64) {
      if (estado) {
        estado.textContent =
          "⚠️ Primero tocá Escucha previa o Regenerar.";
      }
      return;
    }

    const textoFinalAudio =
      audioPrepararTextoParaTTS(texto);

    /*
      PRÉDICA
    */
    if (origen === "predica") {
      const idPredica = String(
        window.__AUDIO_PREDICA_ID || ""
      ).trim();

      if (!idPredica) {
        if (estado) {
          estado.textContent =
            "⚠️ No encontré la prédica.";
        }
        return;
      }

      window.__pendingAudio = {
        texto: textoFinalAudio,
        textoOriginal: texto,
        audioBase64: window.__audioBase64,
        contexto: "predica",
        ts: Date.now()
      };

      try {
        if (estado) {
          estado.textContent =
            "⏳ Guardando audio en la prédica...";
        }

        const url =
          await window
            .subirPendingAudioAFirebase({
              subirIglesia: true
            });

        if (
          typeof window.subidosGuardarAudioPredica !==
          "function"
        ) {
          throw new Error(
            "No está disponible el guardado de audio para prédicas."
          );
        }

        await window.subidosGuardarAudioPredica({
          id: idPredica,
          url,
          texto: textoFinalAudio
        });

        window.__AUDIO_PREDICA_URL = url;

        if (estado) {
          estado.textContent =
            "✅ Audio guardado en la prédica.";
        }

        setTimeout(() => {
          window.cerrarModalAudio?.();
        }, 500);

      } catch (error) {
        console.error(
          "Error guardando audio de prédica:",
          error
        );

        if (estado) {
          estado.textContent =
            "❌ " +
            (
              error?.message ||
              "No pude guardar el audio."
            );
        }
      }

      return;
    }

    /*
      NOTA
    */
    const idNota = String(
      window.__AUDIO_NOTA_ID || ""
    ).trim();

    if (!idNota) {
      if (estado) {
        estado.textContent =
          "⚠️ No encontré la nota.";
      }
      return;
    }

    window.__pendingAudio = {
      texto: textoFinalAudio,
      textoOriginal: texto,
      audioBase64: window.__audioBase64,
      contexto: "nota",
      ts: Date.now()
    };

    try {
      if (estado) {
        estado.textContent =
          "⏳ Guardando audio en la nota...";
      }

      const url =
        await window
          .subirPendingAudioAFirebase({
            subirIglesia: false
          });

      if (
        typeof window.vaGuardarAudioNota !==
        "function"
      ) {
        throw new Error(
          "No está disponible el guardado de audio para notas."
        );
      }

      await window.vaGuardarAudioNota({
        id: idNota,
        url,
        texto: textoFinalAudio
      });

      window.__AUDIO_NOTA_URL = url;

      if (estado) {
        estado.textContent =
          "✅ Audio guardado en la nota.";
      }

      setTimeout(() => {
        window.cerrarModalAudio?.();
      }, 500);

    } catch (error) {
      console.error(
        "Error guardando audio de nota:",
        error
      );

      if (estado) {
        estado.textContent =
          "❌ " +
          (
            error?.message ||
            "No pude guardar el audio."
          );
      }
    }
  };

/*
  El botón de audio de Crear imagen
  debe indicar claramente que viene
  desde Biblia y no desde una nota.
*/
const vaBtnAbrirAudio =
  document.getElementById(
    "btnAbrirAudio"
  );

if (vaBtnAbrirAudio) {
  vaBtnAbrirAudio.onclick = event => {
    event.preventDefault();
    event.stopPropagation();

    const modalImagen =
      document.getElementById(
        "modalPersonalizar"
      );

    const esDevocional =
      window.__DEVOCIONAL_AUDIO_ACTIVO ===
        true ||
      modalImagen?.classList.contains(
        "modo-devocional"
      );

    window.__AUDIO_ORIGEN =
      esDevocional
        ? "devocional"
        : "biblia";

    window.abrirModalAudio?.();
  };
}
  
});