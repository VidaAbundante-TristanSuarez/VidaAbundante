const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
admin.initializeApp();

// ✅ GEN 2
const { onRequest } = require("firebase-functions/v2/https");

// ===== OCR (Vision) =====
const vision = require("@google-cloud/vision");
const client = new vision.ImageAnnotatorClient();

exports.ocrDevocional = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

      const imageBase64 = req.body?.imageBase64;
      if (!imageBase64) return res.status(400).json({ error: "Falta imageBase64" });

      const [result] = await client.textDetection({ image: { content: imageBase64 } });

      const text =
        result?.fullTextAnnotation?.text ||
        (result?.textAnnotations?.[0]?.description || "");

      return res.json({ text });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e?.message || e) });
    }
  });
});

// ===== TTS (Text-to-Speech) =====
const textToSpeech = require("@google-cloud/text-to-speech");
const ttsClient = new textToSpeech.TextToSpeechClient();

function normalizarVersiculosMayus(texto) {
  if (!texto) return texto;

  let t = String(texto).toLowerCase();
  t = t.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (m, sep, letra) => sep + letra.toUpperCase());

  const especiales = {
    "jehova":"Jehová","jesus":"Jesús","jerusalen":"Jerusalén",
    "juda":"Judá","seir":"Seír","amon":"Amón",
    "cronicas":"Crónicas","genesis":"Génesis","exodo":"Éxodo",
    "levitico":"Levítico","salmos":"Salmos","proverbios":"Proverbios",
    "isaias":"Isaías","jeremias":"Jeremías","ezequiel":"Ezequiel"
  };

  Object.keys(especiales).forEach(k => {
    const r = new RegExp(`\\b${k}\\b`, "g");
    t = t.replace(r, especiales[k]);
  });

  return t;
}

function limpiarTextoParaTTS(input) {
  let t = String(input || "");
  t = t.normalize("NFKC");
  t = t.replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, "");
  t = t.replace(/\u00A0/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function prepararTextoSSML(texto) {
  if (!texto) return "<speak></speak>";

  let t = limpiarTextoParaTTS(texto)
    .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  t = t.replace(/\bsepare\b/gi, "cepare");

  t = t.replace(/(\d+)\s*[: ]\s*(\d+)\s*-\s*(\d+)/g, (m, cap, a, b) => {
    const A = Number(a), B = Number(b);
    if (!Number.isFinite(A) || !Number.isFinite(B)) return `${cap} ${a} ${b}`;
    if (B === A + 1) return `${cap} ${A} y ${B}`;
    return `${cap} del ${A} al ${B}`;
  });

  t = t.replace(/(\d+)\s*:\s*(\d+)\s*,\s*(\d+)\b/g, "$1 $2 y $3");

  t = t.replace(/(\d+)\s*:\s*(\d+(?:\s*,\s*\d+)+)/g, (m, cap, lista) => {
    const nums = lista.split(",").map(s => s.trim()).filter(Boolean);
    if (nums.length === 2) return `${cap} ${nums[0]} y ${nums[1]}`;
    const last = nums.pop();
    return `${cap} ${nums.join(", ")} y ${last}`;
  });

  t = t.replace(/(\d+)\s*:\s*(\d+)/g, "$1 $2");

  t = t
    .replace(/([,])/g, '$1<break time="180ms"/>')
    .replace(/([;:])/g, '$1<break time="260ms"/>')
    .replace(/([.!])(?!\d)/g, '$1<break time="450ms"/>')
    .replace(/([?¿])\s*/g, '$1<break time="500ms"/>')
    .replace(/([!¡])\s*/g, '$1<break time="500ms"/>');

  return `<speak><p>${t}</p></speak>`;
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function mezclarConBackground(audioBuffer) {
  const bgPath = path.join(__dirname, "background.mp3");

  // ✅ si no existe la música, devolvemos la voz sola
  if (!fs.existsSync(bgPath)) {
    return audioBuffer;
  }

  const tmp = os.tmpdir();
  const now = Date.now();

  const voicePath = path.join(tmp, `voz_${now}.mp3`);
  const mixedBgPath = path.join(tmp, `bgmix_${now}.mp3`);
  const outPath = path.join(tmp, `mix_${now}.mp3`);

  fs.writeFileSync(voicePath, audioBuffer);

  try {
    // =========================================================
    // 1) Medir duración de la voz con ffmpeg (stderr)
    // =========================================================
    const probe = await runFFmpeg([
      "-i", voicePath,
      "-f", "null",
      "-"
    ]).catch(err => {
      // ffmpeg devuelve error en null output a veces; igual revisamos stderr
      return err;
    });

    const probeText =
      String(probe?.stderr || probe?.message || probe || "");

    const m = probeText.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);

    let durSec = 0;
    if (m) {
      durSec =
        Number(m[1]) * 3600 +
        Number(m[2]) * 60 +
        Number(m[3]);
    }

    // ✅ fade out de 3s, pero evitando valores negativos
    const fadeOutDur = 3;
    const fadeOutStart = Math.max(0, durSec - fadeOutDur);

    // =========================================================
    // 2) Preparar SOLO la música:
    //    - loop infinito
    //    - volumen bajo
    //    - fade in 3s
    //    - fade out 3s al final de la voz
    //    - cortar exactamente a la duración de la voz
    // =========================================================
    await runFFmpeg([
      "-y",
      "-stream_loop", "-1",
      "-i", bgPath,
      "-t", String(Math.max(0.1, durSec || 600)),
      "-filter:a",
      `volume=0.07,afade=t=in:st=0:d=3,afade=t=out:st=${fadeOutStart}:d=${fadeOutDur}`,
      "-c:a", "libmp3lame",
      "-b:a", "224k",
      mixedBgPath
    ]);

    // =========================================================
    // 3) Mezclar música + voz con ducking
    //    [0:a] = música ya preparada
    //    [1:a] = voz
    // =========================================================
    await runFFmpeg([
      "-y",
      "-i", mixedBgPath,
      "-i", voicePath,
      "-filter_complex",
      "[0:a][1:a]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=800:makeup=1[bgduck];[bgduck][1:a]amix=inputs=2:duration=shortest:dropout_transition=2,volume=1.1",
      "-c:a", "libmp3lame",
      "-b:a", "224k",
      outPath
    ]);

    return fs.readFileSync(outPath);

  } finally {
    try { if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath); } catch(e){}
    try { if (fs.existsSync(mixedBgPath)) fs.unlinkSync(mixedBgPath); } catch(e){}
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch(e){}
  }
}

exports.ttsAudio = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Use POST" });
      }

      const texto = String(req.body?.texto || "").trim();
      if (!texto) {
        return res.status(400).json({ error: "Falta texto" });
      }

      const ssml = prepararTextoSSML(normalizarVersiculosMayus(texto));
      const voiceName = String(req.body?.voiceName || "es-US-Neural2-B");

      const request = {
        input: { ssml },
        voice: {
          languageCode: "es-US",
          name: voiceName,
          ssmlGender: "MALE"
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: 0.9,
          pitch: 0
        }
      };

      const [response] = await ttsClient.synthesizeSpeech(request);

      // ✅ voz sola en buffer
      const voiceBuffer = Buffer.from(response.audioContent, "binary");

      // ✅ mezclar con background.mp3
      const mixedBuffer = await mezclarConBackground(voiceBuffer);

      // ✅ devolver base64 del audio final
      const audioBase64 = mixedBuffer.toString("base64");

      return res.json({ audioBase64 });

    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e?.message || e) });
    }
  });
});

// ================================
// GITHUB UPLOAD (DEVOCIONALES) + ACTUALIZA devocionales.json ✅ SECRET
// ================================
exports.subirAudioDevocionalGithub = onRequest(
  { secrets: ["GITHUB_TOKEN"] },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

        const {
          audioBase64 = "",
          fileName = "",
          folder = "devocionales",
          repo = "",
          // ✅ para el JSON:
          title = "" // ejemplo: "10/01"
        } = req.body || {};

        if (!audioBase64) return res.status(400).json({ error: "Falta audioBase64" });

        const REPO_DEFAULT = repo || "Vida-Abundante/playlist-audio";
        const FOLDER_DEFAULT = folder || "devocionales";
        const JSON_PATH = "devocionales.json";

        const token = process.env.GITHUB_TOKEN;
        if (!token) return res.status(500).json({ error: "Falta secret GITHUB_TOKEN" });

        const safe = (s) => String(s || "")
          .trim()
          .replace(/[\/\\:*?"<>|]/g, "_")
          .replace(/\s+/g, "_")
          .slice(0, 80);

        const finalName = safe(fileName) || `devocional_${Date.now()}.mp3`;
        const audioPath = `${FOLDER_DEFAULT}/${finalName}`;

        const ghHeaders = {
          "Authorization": `token ${token}`,
          "Accept": "application/vnd.github+json"
        };

        // =====================
        // 1) SUBIR/ACTUALIZAR MP3
        // =====================
        let shaAudio = null;
        const getAudio = await fetch(`https://api.github.com/repos/${REPO_DEFAULT}/contents/${audioPath}`, {
          method: "GET",
          headers: ghHeaders
        });

        if (getAudio.status === 200) {
          const j = await getAudio.json();
          shaAudio = j.sha;
        }

        const bodyAudio = {
          message: `Subir audio ${finalName}`,
          content: String(audioBase64).trim()
        };
        if (shaAudio) bodyAudio.sha = shaAudio;

        const putAudio = await fetch(`https://api.github.com/repos/${REPO_DEFAULT}/contents/${audioPath}`, {
          method: "PUT",
          headers: { ...ghHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(bodyAudio)
        });

        const putAudioJson = await putAudio.json().catch(() => ({}));
        if (!putAudio.ok) {
          return res.status(500).json({
            error: "GitHub PUT audio falló",
            detail: putAudioJson?.message || putAudio.statusText || putAudio.status
          });
        }

        const downloadUrl = putAudioJson?.content?.download_url || "";

        // =====================
        // 2) LEER devocionales.json
        // =====================
        let shaJson = null;
        let list = [];

        const getJson = await fetch(`https://api.github.com/repos/${REPO_DEFAULT}/contents/${JSON_PATH}`, {
          method: "GET",
          headers: ghHeaders
        });

        if (getJson.status === 200) {
          const j = await getJson.json();
          shaJson = j.sha;

          const raw = Buffer.from(j.content || "", "base64").toString("utf8");
          try { list = JSON.parse(raw) || []; } catch { list = []; }
          if (!Array.isArray(list)) list = [];
        } else if (getJson.status === 404) {
          list = [];
        } else {
          const t = await getJson.text().catch(() => "");
          return res.status(500).json({ error: "No pude leer devocionales.json", detail: t || getJson.status });
        }

        // =====================
        // 3) INSERTAR AL INICIO (para que aparezca arriba)
        // =====================
        const newItem = {
          title: String(title || "").trim() || "Devocional",
          file: finalName
        };

        // (opcional) evitar duplicados por file
        list = list.filter(x => x?.file !== finalName);
        list.unshift(newItem);

        const jsonString = JSON.stringify(list, null, 2);
        const jsonBase64 = Buffer.from(jsonString, "utf8").toString("base64");

        const bodyJson = { message: `Actualizar ${JSON_PATH}`, content: jsonBase64 };
        if (shaJson) bodyJson.sha = shaJson;

        const putJson = await fetch(`https://api.github.com/repos/${REPO_DEFAULT}/contents/${JSON_PATH}`, {
          method: "PUT",
          headers: { ...ghHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(bodyJson)
        });

        const putJsonRes = await putJson.json().catch(() => ({}));
        if (!putJson.ok) {
          return res.status(500).json({
            error: "GitHub PUT devocionales.json falló",
            detail: putJsonRes?.message || putJson.statusText || putJson.status
          });
        }

        return res.json({ ok: true, url: downloadUrl, fileName: finalName, jsonUpdated: true });

      } catch (e) {
        console.error(e);
        return res.status(500).json({ error: String(e?.message || e) });
      }
    });
  }
);

// ================================
// HACER ADMIN  ✅ SECRET
// ================================
exports.hacerAdmin = onRequest(
  { secrets: ["ADMIN_KEY"] },
  async (req, res) => {
    try {
      const { uid, clave } = req.body || {};
      if (clave !== process.env.ADMIN_KEY) return res.status(403).json({ error: "No autorizado" });
      if (!uid) return res.status(400).json({ error: "Falta uid" });

      await admin.auth().setCustomUserClaims(uid, { admin: true });
      await admin.database().ref(`admins/${uid}`).set(true);

      return res.json({ ok: true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: String(e?.message || e) });
    }
  }
);

// ================================
// DEVOCIONAL PNG PROXY (Descargar/Compartir como archivo) ✅
// ================================
exports.devocionalPng = onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "GET") return res.status(405).send("Use GET");

      const storagePath = String(req.query?.path || "").trim();
      const fileName = String(req.query?.name || "devocional.png").trim();

      if (!storagePath) return res.status(400).send("Missing path");

      const bucket = admin.storage().bucket(); // bucket del proyecto
      const file = bucket.file(storagePath);

      const [exists] = await file.exists();
      if (!exists) return res.status(404).send("Not found");

      const [buf] = await file.download();

      res.set("Content-Type", "image/png");
      res.set("Content-Disposition", `attachment; filename="${fileName.replace(/"/g, "")}"`);
      return res.status(200).send(buf);
    } catch (e) {
      console.error("devocionalPng error:", e);
      return res.status(500).send("Error");
    }
  });
});
