// biblia.audio.js
document.addEventListener("DOMContentLoaded", () => {
  // ✅ Si no existe el modal de audio, no hacemos nada
  if (!document.getElementById("modalAudio")) return;

  // ================= MODAL 3: AUDIO (BIBLIA) =================
  let __audioTextoOriginal = "";

  // ✅ URL Cloud Function
  const AUDIO_WEBAPP_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ttsAudio";

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
    if (estado) estado.textContent = "Listo para previsualizar.";

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

    const texto = (ta.value || "").trim();
    if (!texto) {
      if (estado) estado.textContent = "⚠️ No hay texto para previsualizar.";
      return;
    }

    const textoLimpio = texto
      .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    try {
      window.__audioBase64 = null;
      if (estado) estado.textContent = "🎧 Generando previa real…";

      const r = await fetch(AUDIO_WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoLimpio })
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Error HTTP " + r.status);
      if (!data.audioBase64) throw new Error("No devolvió audioBase64");

      window.__audioBase64 = data.audioBase64;

      const bytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const localUrl = URL.createObjectURL(blob);

      audio.src = localUrl;
      audio.load();
      await audio.play();

      if (estado) estado.textContent = "✅ Previa reproduciendo.";
    } catch (e) {
      console.error(e);
      if (estado) estado.textContent = "❌ No se pudo generar la previa real.";
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

  // ✅ Subir a Firebase (cuando finalizás la imagen)
  window.__lastAudioUrl = "";
  window.__lastAudioTs  = 0;

  window.subirPendingAudioAFirebase = async ({ subirIglesia = false } = {}) => {
    if (!window.__UID) throw new Error("No hay uid");

    const p = window.__pendingAudio;
    if (!p?.audioBase64) throw new Error("No hay audio pendiente");

    const { db, storage } = window.__FB || {};
    const { ref, set, sRef, uploadBytes, getDownloadURL } = window.__FB_API || {};
    if (!db || !storage || !ref || !set || !sRef || !uploadBytes || !getDownloadURL) {
      throw new Error("Firebase no está listo (cargá biblia.js antes de biblia.audio.js)");
    }

    const bytes = Uint8Array.from(atob(p.audioBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });

    const ts = p.ts || Date.now();
    const fileName = `audio_${ts}.mp3`;

    const storagePath = subirIglesia
      ? `audios_iglesia/${window.__UID}/${fileName}`
      : `audios_personal/${window.__UID}/${fileName}`;

    const storageRef = sRef(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: "audio/mpeg" });
    const url = await getDownloadURL(storageRef);

    const dbPath = subirIglesia
      ? `panelAudiosIglesia/${window.__UID}/${ts}`
      : `panelAudiosPersonal/${window.__UID}/${ts}`;

    await set(ref(db, dbPath), { url, storagePath, fecha: ts, origen: "biblia" });

    window.__lastAudioUrl = url;
    window.__lastAudioTs = ts;

    window.__pendingAudio = null;
    return url;
  };
});
