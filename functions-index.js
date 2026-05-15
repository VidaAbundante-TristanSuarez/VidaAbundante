const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const cors = require("cors")({ origin: true });

const { onRequest } = require("firebase-functions/v2/https");
const textToSpeech = require("@google-cloud/text-to-speech");

const ttsClient = new textToSpeech.TextToSpeechClient();

/* ================================
   TTS + ARPA
   ÚNICA FUNCIÓN QUE QUEDA EN FIREBASE
================================ */

function normalizarVersiculosMayus(texto) {
  if (!texto) return texto;

  let t = String(texto).toLowerCase();

  t = t.replace(/(^|[.!?]\s+)([a-záéíóúñü])/g, (m, sep, letra) => {
    return sep + letra.toUpperCase();
  });

  const especiales = {
    "jehova": "Jehová",
    "jesus": "Jesús",
    "jerusalen": "Jerusalén",
    "juda": "Judá",
    "seir": "Seír",
    "amon": "Amón",
    "cronicas": "Crónicas",
    "genesis": "Génesis",
    "exodo": "Éxodo",
    "levitico": "Levítico",
    "salmos": "Salmos",
    "proverbios": "Proverbios",
    "isaias": "Isaías",
    "jeremias": "Jeremías",
    "ezequiel": "Ezequiel"
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

function escapeXml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function prepararTextoSSML(texto) {
  if (!texto) return "<speak></speak>";

  let t = limpiarTextoParaTTS(texto)
    .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Corrección fonética puntual
  t = t.replace(/\bsepare\b/gi, "cepare");

  // Referencias bíblicas: 3:16-18 -> 3 del 16 al 18
  t = t.replace(/(\d+)\s*[: ]\s*(\d+)\s*-\s*(\d+)/g, (m, cap, a, b) => {
    const A = Number(a);
    const B = Number(b);

    if (!Number.isFinite(A) || !Number.isFinite(B)) {
      return `${cap} ${a} ${b}`;
    }

    if (B === A + 1) return `${cap} ${A} y ${B}`;

    return `${cap} del ${A} al ${B}`;
  });

  // Referencias bíblicas: 3:16,17 -> 3 16 y 17
  t = t.replace(/(\d+)\s*:\s*(\d+)\s*,\s*(\d+)\b/g, "$1 $2 y $3");

  // Referencias bíblicas: 3:16,17,18 -> 3 16, 17 y 18
  t = t.replace(/(\d+)\s*:\s*(\d+(?:\s*,\s*\d+)+)/g, (m, cap, lista) => {
    const nums = lista.split(",").map(s => s.trim()).filter(Boolean);

    if (nums.length === 2) {
      return `${cap} ${nums[0]} y ${nums[1]}`;
    }

    const last = nums.pop();
    return `${cap} ${nums.join(", ")} y ${last}`;
  });

  // Referencia normal: 3:16 -> 3 16
  t = t.replace(/(\d+)\s*:\s*(\d+)/g, "$1 $2");

  // Evita romper SSML con caracteres especiales
  t = escapeXml(t);

  // Preguntas y exclamaciones con un poquito de expresividad
  t = t.replace(/¿([^?]+)\?/g, '<prosody pitch="+2st">$1</prosody>?');
  t = t.replace(/¡([^!]+)!/g, '<prosody pitch="+1st" volume="+2dB">$1</prosody>!');

  // Pausas
  t = t
    .replace(/([,])/g, '$1<break time="180ms"/>')
    .replace(/([;:])/g, '$1<break time="260ms"/>')
    .replace(/([.!])(?!\d)/g, '$1<break time="450ms"/>')
    .replace(/([?])/g, '$1<break time="550ms"/>')
    .replace(/([!])/g, '$1<break time="550ms"/>');

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

async function medirDuracionAudio(audioPath) {
  const probe = await runFFmpeg([
    "-i", audioPath,
    "-f", "null",
    "-"
  ]).catch(err => {
    // ffmpeg muchas veces devuelve error en null output,
    // pero igual trae la duración en stderr.
    return err;
  });

  const txt = String(probe?.stderr || probe?.message || probe || "");
  const m = txt.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i);

  if (!m) return 0;

  return (
    Number(m[1]) * 3600 +
    Number(m[2]) * 60 +
    Number(m[3])
  );
}

async function mezclarConBackground(audioBuffer) {
  const bgPath = path.join(__dirname, "background.mp3");

  // Si no existe background.mp3, devuelve solo la voz.
  if (!fs.existsSync(bgPath)) {
    return audioBuffer;
  }

  const tmp = os.tmpdir();
  const now = Date.now();

  const voicePath = path.join(tmp, `voz_${now}.mp3`);
  const musicPath = path.join(tmp, `arpa_${now}.mp3`);
  const outPath = path.join(tmp, `mix_${now}.mp3`);

  fs.writeFileSync(voicePath, audioBuffer);

  try {
    const durSec = await medirDuracionAudio(voicePath);

    // ✅ Mejora del arpa:
    // antes el fade in tardaba 3 segundos.
    // ahora entra casi enseguida y la voz arranca apenas después.
    const voiceDelayMs = 350;
    const preludeSec = voiceDelayMs / 1000;

    const totalDur = Math.max(0.8, (durSec || 0) + preludeSec);
    const fadeOutDur = 3;
    const fadeOutStart = Math.max(0, totalDur - fadeOutDur);

    // 1) Preparamos el arpa:
    // - loop
    // - volumen un poco más presente
    // - fade in muy corto
    // - duración total igual a voz + pequeño preámbulo
    await runFFmpeg([
      "-y",
      "-stream_loop", "-1",
      "-i", bgPath,
      "-t", String(totalDur || 600),
      "-filter:a",
      `volume=0.24,afade=t=in:st=0:d=0.35,afade=t=out:st=${fadeOutStart}:d=${fadeOutDur}`,
      "-c:a", "libmp3lame",
      "-b:a", "224k",
      musicPath
    ]);

    // 2) Mezclamos:
    // - la voz entra 350ms después para que se alcance a oír el arpa
    // - el arpa baja cuando habla la voz
    await runFFmpeg([
      "-y",
      "-i", musicPath,
      "-i", voicePath,
      "-filter_complex",
      `[1:a]adelay=${voiceDelayMs}|${voiceDelayMs},highpass=f=90,lowpass=f=7000,acompressor=threshold=-18dB:ratio=2.5:attack=15:release=180,asplit=2[voice_sc][voice_mix];[0:a][voice_sc]sidechaincompress=threshold=0.03:ratio=10:attack=25:release=900:makeup=1[bgduck];[bgduck][voice_mix]amix=inputs=2:duration=longest:dropout_transition=2,volume=1.05`,
      "-c:a", "libmp3lame",
      "-b:a", "224k",
      outPath
    ]);

    return fs.readFileSync(outPath);

  } finally {
    try { if (fs.existsSync(voicePath)) fs.unlinkSync(voicePath); } catch (e) {}
    try { if (fs.existsSync(musicPath)) fs.unlinkSync(musicPath); } catch (e) {}
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) {}
  }
}

exports.ttsAudio = onRequest(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "512MiB",

    // ✅ Seguridad de costo:
    // si algo se dispara, no permite muchas instancias a la vez.
    maxInstances: 2
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({
            ok: false,
            error: "Use POST"
          });
        }

        const texto = String(req.body?.texto || "").trim();

        if (!texto) {
          return res.status(400).json({
            ok: false,
            error: "Falta texto"
          });
        }

        const ssml = prepararTextoSSML(normalizarVersiculosMayus(texto));

        const voiceName = String(
          req.body?.voiceName ||
          "es-US-Neural2-B"
        );

        const request = {
          input: { ssml },
          voice: {
            languageCode: "es-US",
            name: voiceName,
            ssmlGender: "MALE"
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 0.88,
            pitch: -1
          }
        };

        const [response] = await ttsClient.synthesizeSpeech(request);

        const voiceBuffer = Buffer.from(response.audioContent, "binary");
        const mixedBuffer = await mezclarConBackground(voiceBuffer);

        return res.status(200).json({
          ok: true,
          audioBase64: mixedBuffer.toString("base64")
        });

      } catch (e) {
        console.error("ttsAudio error:", e);

        return res.status(500).json({
          ok: false,
          error: String(e?.message || e)
        });
      }
    });
  }
);
