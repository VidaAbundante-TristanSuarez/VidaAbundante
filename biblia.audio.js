// biblia.audio.js
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Si no existe el modal de audio, no hacemos nada
  if (!document.getElementById("modalAudio")) return;

  // ================= MODAL 3: AUDIO (BIBLIA) =================
  let __audioTextoOriginal = "";

  // ✅ URL Worker: el Worker llama al TTS con arpa
  const AUDIO_WEBAPP_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";
  const AUDIO_R2_UPLOAD_URL = "https://subir-imagen-r2.vidaabundante-tristansuarez.workers.dev";

 const AUDIO_VOZ_ADMIN = "es-US-Wavenet-B";
const AUDIO_VOZ_COLAB = "es-US-Standard-B";
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

  function audio_getTextoDesdePreview() {
    const el = document.getElementById("previewTexto");
    return (el ? (el.innerText || "") : "").trim();
  }

  // ✅ Abrir modal
  window.abrirModalAudio = () => {
    const modal = document.getElementById("modalAudio");
    const ta = document.getElementById("textoAudio");
    const estado = document.getElementById("audioEstado");
    const audio = document.getElementById("audioPreview");
    if (!modal || !ta) return;

    if (audio) audio.removeAttribute("src");
  if (estado) estado.textContent = "Preparando audio...";
audioActualizarEstadoInicial();

    // ✅ guardar original + autocompletar si estaba vacío
    __audioTextoOriginal = (ta.value || "").trim() || audio_getTextoDesdePreview();
    if (!ta.value.trim()) ta.value = __audioTextoOriginal;

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

  const textoLimpio = texto
    .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const esColabSeco = !audioEsAdmin() && audioEsColaborador();

  const voiceName = esColabSeco
    ? AUDIO_VOZ_COLAB
    : (window.__AUDIO_VOICE_NAME || AUDIO_VOZ_ADMIN);

  const cache = window.__audioCacheLocal || {};

  const puedeReutilizar =
    cache.texto === textoLimpio &&
    cache.voiceName === voiceName &&
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

if (esColabSeco) {
  restantesAntes = await window.vaLeerRestantesUsoColaborador?.(
    "audioBiblia",
    AUDIO_LIMITE_COLAB_DIA
  );

  if (Number(restantesAntes || 0) <= 0) {
    if (estado) {
      estado.textContent = `⚠️ Llegaste al límite diario de ${AUDIO_LIMITE_COLAB_DIA} audios. Podés volver a usarlo mañana.`;
    }
    return;
  }

  if (estado) {
    estado.textContent = `🎧 Generando voz seca... Te quedan ${restantesAntes} audios hoy.`;
  }
} else if (estado) {
  estado.textContent = "🎧 Generando previa real con arpa...";
}

    const body = esColabSeco
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

    if (esColabSeco) {
  try {
    const consumo = await window.vaConsumirUsoColaborador?.(
      "audioBiblia",
      AUDIO_LIMITE_COLAB_DIA
    );

    if (estado) {
      estado.textContent = `✅ Voz seca generada. Te quedan ${consumo?.restantes ?? 0} audios hoy.`;
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
      audioBase64: data.audioBase64
    };

    const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const localUrl = URL.createObjectURL(blob);

    audio.src = localUrl;
    audio.load();
    await audio.play();

    if (estado) {
      estado.textContent = esColabSeco
        ? "✅ Voz seca reproduciendo."
        : "✅ Previa reproduciendo.";
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

    window.__pendingAudio = { texto, audioBase64: window.__audioBase64, ts: Date.now() };
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
