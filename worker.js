const ORIGENES_PERMITIDOS = [
  "https://vidaabundante-tristansuarez.github.io",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://127.0.0.1:5500"
];

const PUBLIC_BASE_URL = "https://pub-f0843badb1194dc79fd37b3a5526e273.r2.dev";

const GOOGLE_VISION_URL = "https://vision.googleapis.com/v1/images:annotate";
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// ✅ SOLO el TTS queda en Firebase Functions porque ahí está la voz + arpa + ffmpeg.
const TTS_FUNCTION_URL = "https://us-central1-vidaabundante-f118a.cloudfunctions.net/ttsAudio";

// ✅ Video / archivos grandes por Worker
const MAX_VIDEO_BYTES_DEFAULT = 80 * 1024 * 1024; // 80 MB

function headersCors(request) {
  const origen = request.headers.get("Origin") || "";

  const allowOrigin = ORIGENES_PERMITIDOS.includes(origen)
    ? origen
    : "https://vidaabundante-tristansuarez.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Expose-Headers": "Content-Type, Content-Length, Content-Disposition",
    "Access-Control-Max-Age": "86400"
  };
}

function responderJson(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  });
}

function limpiarNombre(nombre = "archivo") {
  return String(nombre || "archivo")
    .trim()
    .replace(/[\r\n"]/g, "_")
    .replace(/[\/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 160) || "archivo";
}

function limpiarFolder(folder = "subidos") {
  return String(folder || "subidos")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.\./g, "")
    .replace(/[^a-zA-Z0-9/_-]/g, "_")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .slice(0, 120) || "subidos";
}

function limpiarBase64(base64) {
  const s = String(base64 || "").trim();
  if (s.includes(",")) return s.split(",").pop().trim();
  return s.replace(/\s/g, "");
}

function base64ToBytes(base64) {
  const limpio = limpiarBase64(base64);
  const binario = atob(limpio);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes;
}

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(bin);
}

function textoABase64(txt) {
  const bytes = new TextEncoder().encode(String(txt || ""));
  return bytesToBase64(bytes);
}

function base64ATexto(base64) {
  return new TextDecoder().decode(base64ToBytes(base64));
}

function encodeGithubPath(path) {
  return String(path || "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

/* =========================
   OCR GOOGLE VISION
   ✅ SIN FIREBASE FUNCTIONS
========================= */

async function manejarOCRGoogleVision(payload, env, cors) {
  const imageBase64 = String(payload.imageBase64 || "").trim();

  if (!imageBase64) {
    return responderJson({
      ok: false,
      error: "Falta imageBase64"
    }, 400, cors);
  }

  const apiKey = String(env.GOOGLE_VISION_API_KEY || "").trim();

  if (!apiKey) {
    return responderJson({
      ok: false,
      error: "Falta secret GOOGLE_VISION_API_KEY en Cloudflare Worker"
    }, 500, cors);
  }

  const body = {
    requests: [
      {
        image: {
          content: limpiarBase64(imageBase64)
        },
        features: [
          {
            type: "TEXT_DETECTION",
            maxResults: 1
          }
        ],
        imageContext: {
          languageHints: ["es"]
        }
      }
    ]
  };

  let upstream;

  try {
    upstream = await fetch(`${GOOGLE_VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return responderJson({
      ok: false,
      error: "No pude conectar con Google Vision",
      detail: String(e?.message || e)
    }, 502, cors);
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return responderJson({
      ok: false,
      error: data?.error?.message || `Google Vision devolvió HTTP ${upstream.status}`,
      detail: data,
      upstreamStatus: upstream.status
    }, upstream.status, cors);
  }

  const respuesta = data?.responses?.[0] || {};

  if (respuesta?.error) {
    return responderJson({
      ok: false,
      error: respuesta.error.message || "Google Vision devolvió error",
      detail: respuesta.error
    }, 500, cors);
  }

  const text =
    respuesta?.fullTextAnnotation?.text ||
    respuesta?.textAnnotations?.[0]?.description ||
    "";

  if (!String(text || "").trim()) {
    return responderJson({
      ok: false,
      error: "No se detectó texto en la imagen"
    }, 422, cors);
  }

  return responderJson({
    ok: true,
    text: String(text || "").trim()
  }, 200, cors);
}

/* =========================
   TTS SECO GOOGLE DIRECTO
   ✅ Para colaboradores: voz Standard sin arpa
========================= */

function limpiarTextoTTS(txt = "") {
  return String(txt || "")
    .replace(/[•▪●■□◆◇▶►◼◻]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function languageCodeDesdeVoiceName(voiceName = "es-US-Standard-B") {
  const m = String(voiceName || "").match(/^([a-z]{2}-[A-Z]{2})-/);
  return m ? m[1] : "es-US";
}

async function manejarTTSGoogleSeco(payload, env, cors) {
  const texto = limpiarTextoTTS(payload.texto || payload.text || "");

  if (!texto) {
    return responderJson({
      ok: false,
      error: "Falta texto"
    }, 400, cors);
  }

const apiKey = String(env.GOOGLE_TTS_API_KEY || "").trim();

  if (!apiKey) {
    return responderJson({
      ok: false,
      error: "Falta GOOGLE_TTS_API_KEY en Cloudflare Worker"
    }, 500, cors);
  }

  const voiceName = String(payload.voiceName || "es-US-Standard-B").trim();
  const languageCode = String(
    payload.languageCode ||
    languageCodeDesdeVoiceName(voiceName)
  ).trim();

  const body = {
    input: {
      text: texto
    },
    voice: {
      languageCode,
      name: voiceName
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: Number(payload.speakingRate || 0.95),
      pitch: Number(payload.pitch || 0),
      volumeGainDb: Number(payload.volumeGainDb || 0)
    }
  };

  let upstream;

  try {
    upstream = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (e) {
    return responderJson({
      ok: false,
      error: "No pude conectar con Google Text-to-Speech",
      detail: String(e?.message || e)
    }, 502, cors);
  }

  const data = await upstream.json().catch(() => ({}));

  if (!upstream.ok) {
    return responderJson({
      ok: false,
      error: data?.error?.message || `Google TTS devolvió HTTP ${upstream.status}`,
      detail: data,
      upstreamStatus: upstream.status
    }, upstream.status, cors);
  }

  if (!data.audioContent) {
    return responderJson({
      ok: false,
      error: "Google TTS no devolvió audioContent",
      detail: data
    }, 500, cors);
  }

  return responderJson({
    ok: true,
    audioBase64: data.audioContent,
    voiceName,
    seco: true
  }, 200, cors);
}

/* =========================
   TTS CON ARPA
   ✅ SE MANTIENE EN FIREBASE FUNCTIONS
========================= */

async function reenviarJsonAFirebase(endpoint, payload, cors) {
  let upstream;

  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return responderJson({
      ok: false,
      error: "No pude conectar con Firebase Function",
      detail: String(e?.message || e),
      endpoint
    }, 502, cors);
  }

  const raw = await upstream.text().catch(() => "");

  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    data = { raw };
  }

  if (!upstream.ok) {
    return responderJson({
      ok: false,
      error: data?.error || data?.detail || `Firebase Function devolvió HTTP ${upstream.status}`,
      detail: data?.detail || data?.raw || raw || "",
      upstreamStatus: upstream.status
    }, upstream.status, cors);
  }

  return responderJson(data, 200, cors);
}

/* =========================
   AUDIO DEVOCIONAL A GITHUB
   ✅ SIN FIREBASE FUNCTIONS
========================= */

async function manejarAudioGithub(payload, env, cors) {
  const audioBase64 = limpiarBase64(payload.audioBase64 || "");

  if (!audioBase64) {
    return responderJson({
      ok: false,
      error: "Falta audioBase64"
    }, 400, cors);
  }

  const token = String(env.GITHUB_TOKEN || "").trim();

  if (!token) {
    return responderJson({
      ok: false,
      error: "Falta GITHUB_TOKEN en Cloudflare Worker"
    }, 500, cors);
  }

  const repo = String(payload.repo || "Vida-Abundante/playlist-audio").trim();
  const folder = limpiarFolder(payload.folder || "devocionales");
  const fileName = limpiarNombre(payload.fileName || `devocional_${Date.now()}.mp3`);
  const title = String(payload.title || "Devocional").trim();

  const audioPath = `${folder}/${fileName}`;
  const jsonPath = "devocionales.json";

  const ghHeaders = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "VidaAbundante-Worker"
  };

  // =====================
  // 1) SUBIR / ACTUALIZAR MP3
  // =====================
  let shaAudio = null;

  const getAudio = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeGithubPath(audioPath)}`,
    {
      method: "GET",
      headers: ghHeaders
    }
  );

  if (getAudio.status === 200) {
    const j = await getAudio.json().catch(() => ({}));
    shaAudio = j.sha || null;
  }

  const bodyAudio = {
    message: `Subir audio ${fileName}`,
    content: audioBase64
  };

  if (shaAudio) bodyAudio.sha = shaAudio;

  const putAudio = await fetch(
    `https://api.github.com/repos/${repo}/contents/${encodeGithubPath(audioPath)}`,
    {
      method: "PUT",
      headers: {
        ...ghHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyAudio)
    }
  );

  const putAudioJson = await putAudio.json().catch(() => ({}));

  if (!putAudio.ok) {
    return responderJson({
      ok: false,
      error: "GitHub PUT audio falló",
      detail: putAudioJson?.message || putAudio.statusText || putAudio.status
    }, 500, cors);
  }

  const downloadUrl = putAudioJson?.content?.download_url || "";

  // =====================
  // 2) LEER devocionales.json
  // =====================
  let shaJson = null;
  let list = [];

  const getJson = await fetch(
    `https://api.github.com/repos/${repo}/contents/${jsonPath}`,
    {
      method: "GET",
      headers: ghHeaders
    }
  );

  if (getJson.status === 200) {
    const j = await getJson.json().catch(() => ({}));
    shaJson = j.sha || null;

    try {
      const raw = base64ATexto(j.content || "");
      list = JSON.parse(raw) || [];
    } catch (_) {
      list = [];
    }

    if (!Array.isArray(list)) list = [];
  } else if (getJson.status === 404) {
    list = [];
  } else {
    const t = await getJson.text().catch(() => "");

    return responderJson({
      ok: false,
      error: "No pude leer devocionales.json",
      detail: t || getJson.status
    }, 500, cors);
  }

  // =====================
  // 3) INSERTAR AL INICIO
  // =====================
  const newItem = {
    title: title || "Devocional",
    file: fileName
  };

  list = list.filter(x => x?.file !== fileName);
  list.unshift(newItem);

  const jsonBase64 = textoABase64(JSON.stringify(list, null, 2));

  const bodyJson = {
    message: `Actualizar ${jsonPath}`,
    content: jsonBase64
  };

  if (shaJson) bodyJson.sha = shaJson;

  const putJson = await fetch(
    `https://api.github.com/repos/${repo}/contents/${jsonPath}`,
    {
      method: "PUT",
      headers: {
        ...ghHeaders,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyJson)
    }
  );

  const putJsonRes = await putJson.json().catch(() => ({}));

  if (!putJson.ok) {
    return responderJson({
      ok: false,
      error: "GitHub PUT devocionales.json falló",
      detail: putJsonRes?.message || putJson.statusText || putJson.status
    }, 500, cors);
  }

  return responderJson({
    ok: true,
    url: downloadUrl,
    fileName,
    jsonUpdated: true
  }, 200, cors);
}

/* =========================
   SUBIDA R2 BASE64
   ✅ Imágenes, prédicas, devocionales, audios chicos
========================= */

async function manejarSubidaBase64(payload, env, cors) {
  const fileBase64 = limpiarBase64(payload.fileBase64 || "");
  const fileName = limpiarNombre(payload.fileName || `archivo_${Date.now()}`);
  const contentType = String(payload.contentType || "application/octet-stream").trim();
  const folder = limpiarFolder(payload.folder || "subidos");

  if (!fileBase64) {
    return responderJson({
      ok: false,
      error: "Falta fileBase64"
    }, 400, cors);
  }

  if (!env.VIDA_ABUNDANTE_R2) {
    return responderJson({
      ok: false,
      error: "Falta binding VIDA_ABUNDANTE_R2"
    }, 500, cors);
  }

  let bytes;

  try {
    bytes = base64ToBytes(fileBase64);
  } catch (_) {
    return responderJson({
      ok: false,
      error: "fileBase64 inválido"
    }, 400, cors);
  }

  const key = `${folder}/${Date.now()}_${fileName}`;

  await env.VIDA_ABUNDANTE_R2.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  const publicUrl = `${PUBLIC_BASE_URL}/${key}`;

  return responderJson({
    ok: true,
    url: publicUrl,
    publicUrl,
    key,
    fileName,
    contentType,
    sizeBytes: bytes.byteLength
  }, 200, cors);
}

/* =========================
   SUBIDA R2 DIRECTA
   ✅ Para video / archivos grandes, sin base64
   ✅ Preparado para 80 MB
========================= */

async function manejarSubidaDirectaArchivo(request, env, cors) {
  if (!env.VIDA_ABUNDANTE_R2) {
    return responderJson({
      ok: false,
      error: "Falta binding VIDA_ABUNDANTE_R2"
    }, 500, cors);
  }

  let form;

  try {
    form = await request.formData();
  } catch (_) {
    return responderJson({
      ok: false,
      error: "No pude leer FormData"
    }, 400, cors);
  }

  const file =
    form.get("file") ||
    form.get("video") ||
    form.get("archivo");

  if (!file || typeof file.arrayBuffer !== "function") {
    return responderJson({
      ok: false,
      error: "Falta archivo real en FormData"
    }, 400, cors);
  }

  const destino = limpiarFolder(form.get("destino") || "ediciones");
  const folderParam = String(form.get("folder") || "").trim();

  const contentType =
    String(form.get("contentType") || file.type || "application/octet-stream").trim();

  const esVideo = contentType.startsWith("video/");

  const folder = limpiarFolder(
    folderParam ||
    (esVideo ? `videos/${destino}` : destino)
  );

  const maxBytes = Number(env.MAX_VIDEO_BYTES || MAX_VIDEO_BYTES_DEFAULT);

  if (file.size && file.size > maxBytes) {
    return responderJson({
      ok: false,
      error: `Archivo demasiado grande. Máximo: ${Math.round(maxBytes / 1024 / 1024)} MB.`
    }, 413, cors);
  }

  const fileName = limpiarNombre(file.name || `archivo_${Date.now()}`);
  const key = `${folder}/${Date.now()}_${fileName}`;

  const body =
    typeof file.stream === "function"
      ? file.stream()
      : await file.arrayBuffer();

  await env.VIDA_ABUNDANTE_R2.put(key, body, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  const publicUrl = `${PUBLIC_BASE_URL}/${key}`;

  return responderJson({
    ok: true,
    url: publicUrl,
    publicUrl,
    key,
    fileName,
    contentType,
    sizeBytes: Number(file.size || 0),
    destino,
    subidaDirecta: true
  }, 200, cors);
}

/* =========================
   DESCARGA / PROXY R2
   ✅ SIN FIREBASE FUNCTIONS
========================= */

async function manejarDescargaProxy(request, env, cors) {
  const urlActual = new URL(request.url);

  const urlArchivo = String(urlActual.searchParams.get("url") || "").trim();
  const nombre = limpiarNombre(urlActual.searchParams.get("nombre") || "archivo");
  const descargar = String(urlActual.searchParams.get("descargar") || "") === "1";

  if (!urlArchivo) {
    return responderJson({
      ok: false,
      error: "Falta url"
    }, 400, cors);
  }

  let target;

  try {
    target = new URL(urlArchivo);
  } catch (_) {
    return responderJson({
      ok: false,
      error: "URL inválida"
    }, 400, cors);
  }

  const publicBase = new URL(PUBLIC_BASE_URL);

  if (target.origin !== publicBase.origin) {
    return responderJson({
      ok: false,
      error: "Origen no permitido"
    }, 403, cors);
  }

  const key = decodeURIComponent(target.pathname.replace(/^\/+/, ""));

  if (!key) {
    return responderJson({
      ok: false,
      error: "Key vacía"
    }, 400, cors);
  }

  if (!env.VIDA_ABUNDANTE_R2) {
    return responderJson({
      ok: false,
      error: "Falta binding VIDA_ABUNDANTE_R2"
    }, 500, cors);
  }

  const obj = await env.VIDA_ABUNDANTE_R2.get(key);

  if (!obj) {
    return responderJson({
      ok: false,
      error: "Archivo no encontrado en R2",
      key
    }, 404, cors);
  }

  const headers = new Headers(cors);

  obj.writeHttpMetadata(headers);

  headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=3600");

  headers.set(
    "Content-Disposition",
    `${descargar ? "attachment" : "inline"}; filename="${nombre}"`
  );

  if (obj.size) {
    headers.set("Content-Length", String(obj.size));
  }

  return new Response(obj.body, {
    status: 200,
    headers
  });
}

/* =========================
   PEDIDOS DE ORACIÓN
   ✅ SIN FIREBASE FUNCTIONS
========================= */

let PEDIDO_FIREBASE_TOKEN_CACHE = {
  accessToken: "",
  exp: 0
};

function pedidoBytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(bin);
}

function pedidoBase64UrlFromBase64(b64) {
  return String(b64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pedidoBase64UrlJson(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  return pedidoBase64UrlFromBase64(pedidoBytesToBase64(bytes));
}

function pedidoBase64UrlArrayBuffer(buffer) {
  return pedidoBase64UrlFromBase64(pedidoBytesToBase64(new Uint8Array(buffer)));
}

function pedidoPemToArrayBuffer(pem) {
  const b64 = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes.buffer;
}

function pedidoFirebaseDbUrl(env, path) {
  const base = String(env.FIREBASE_DB_URL || "")
    .trim()
    .replace(/\/+$/g, "");

  if (!base) {
    throw new Error("Falta FIREBASE_DB_URL en Cloudflare Worker");
  }

  const limpio = String(path || "")
    .replace(/^\/+|\/+$/g, "");

  const encoded = limpio
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  return `${base}/${encoded}.json`;
}

async function pedidoFirebaseAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);

  if (
    PEDIDO_FIREBASE_TOKEN_CACHE.accessToken &&
    PEDIDO_FIREBASE_TOKEN_CACHE.exp > now + 60
  ) {
    return PEDIDO_FIREBASE_TOKEN_CACHE.accessToken;
  }

  const raw = String(env.FIREBASE_SERVICE_ACCOUNT || "").trim();

  if (!raw) {
    throw new Error("Falta FIREBASE_SERVICE_ACCOUNT en Cloudflare Worker");
  }

  let sa;

  try {
    sa = JSON.parse(raw);
  } catch (_) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT no es JSON válido");
  }

  if (!sa.client_email || !sa.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT incompleto");
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const unsigned = `${pedidoBase64UrlJson(header)}.${pedidoBase64UrlJson(claim)}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pedidoPemToArrayBuffer(sa.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${pedidoBase64UrlArrayBuffer(signature)}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok || !data.access_token) {
    throw new Error(data?.error_description || data?.error || "No pude obtener token Firebase");
  }

  PEDIDO_FIREBASE_TOKEN_CACHE = {
    accessToken: data.access_token,
    exp: now + Number(data.expires_in || 3600)
  };

  return data.access_token;
}

async function pedidoFirebaseRequest(env, path, method = "GET", body = undefined) {
  const token = await pedidoFirebaseAccessToken(env);

  const r = await fetch(pedidoFirebaseDbUrl(env, path), {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await r.text().catch(() => "");

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!r.ok) {
    throw new Error(
      typeof data === "string"
        ? data
        : data?.error || `Firebase RTDB HTTP ${r.status}`
    );
  }

  return data;
}

function pedidoFirebaseGet(env, path) {
  return pedidoFirebaseRequest(env, path, "GET");
}

function pedidoFirebasePut(env, path, value) {
  return pedidoFirebaseRequest(env, path, "PUT", value);
}

function pedidoFirebasePost(env, path, value) {
  return pedidoFirebaseRequest(env, path, "POST", value);
}

function limpiarRefPedidoOracion(refPedido) {
  return String(refPedido || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fechaArgentinaPedidoOracion() {
  return new Date().toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires"
  });
}

async function manejarPedidoOracion(payload, env, cors) {
  const refPedido = String(payload.ref || payload.refPedido || "").trim();

  let hermanoId = String(payload.hermanoId || "").trim();
  let token = String(payload.token || "").trim();

  const pedido = String(payload.pedido || "").trim();

  if (!pedido) {
    return responderJson({
      ok: false,
      error: "Pedido vacío"
    }, 400, cors);
  }

  if (refPedido) {
    const refLimpia = limpiarRefPedidoOracion(refPedido);

    const linkData = await pedidoFirebaseGet(env, `linksPedidosOracion/${refLimpia}`);

    if (!linkData) {
      return responderJson({
        ok: false,
        error: "Link no válido"
      }, 404, cors);
    }

    if (linkData.activo === false) {
      return responderJson({
        ok: false,
        error: "Link desactivado"
      }, 403, cors);
    }

    hermanoId = String(linkData.hermanoId || "").trim();
    token = String(linkData.token || "").trim();

    if (!hermanoId || !token) {
      return responderJson({
        ok: false,
        error: "Link incompleto"
      }, 400, cors);
    }
  }

  if (!hermanoId || !token) {
    return responderJson({
      ok: false,
      error: "Faltan datos"
    }, 400, cors);
  }

  const hermano = await pedidoFirebaseGet(env, `hermanos/${hermanoId}`);

  if (!hermano) {
    return responderJson({
      ok: false,
      error: "Hermano no encontrado"
    }, 404, cors);
  }

  if (!hermano.tokenPedido || hermano.tokenPedido !== token) {
    return responderJson({
      ok: false,
      error: "Token inválido"
    }, 403, cors);
  }

  const fecha = fechaArgentinaPedidoOracion();

  const anterior = String(hermano.pedidosOracion || "").trim();

  const nuevoBloque = [
    `📅 ${fecha}`,
    pedido
  ].join("\n");

  const pedidosActualizados = anterior
    ? `${anterior}\n\n${nuevoBloque}`
    : nuevoBloque;

  await pedidoFirebasePut(
    env,
    `hermanos/${hermanoId}/pedidosOracion`,
    pedidosActualizados
  );

  await pedidoFirebasePost(
    env,
    `historialPedidosOracion/${hermanoId}`,
    {
      pedido,
      fecha,
      ts: Date.now(),
      refPedido: refPedido || ""
    }
  );

  return responderJson({
    ok: true
  }, 200, cors);
}

/* =========================
   ROUTER PRINCIPAL
========================= */

export default {
  async fetch(request, env) {
    const cors = headersCors(request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    try {
      // ✅ GET = descargar/proxy desde R2
      if (request.method === "GET") {
        return await manejarDescargaProxy(request, env, cors);
      }

      if (request.method !== "POST") {
        return responderJson({
          ok: false,
          error: "Método no permitido"
        }, 405, cors);
      }

      const contentType = request.headers.get("Content-Type") || "";

      // ✅ POST con FormData = archivo real / video grande
      if (contentType.includes("multipart/form-data")) {
        return await manejarSubidaDirectaArchivo(request, env, cors);
      }

      const payload = await request.json().catch(() => ({}));

      // ✅ OCR Google Vision por Worker
      if (payload.action === "ocr" || payload.imageBase64) {
        return await manejarOCRGoogleVision(payload, env, cors);
      }

      // ✅ TTS seco: colaboradores, voz Standard sin arpa
if (payload.action === "ttsSeco" || payload.ttsSeco === true) {
  return await manejarTTSGoogleSeco(payload, env, cors);
}

// ✅ TTS con arpa: admin, sigue en Firebase Functions intencionalmente
if (payload.action === "tts" || payload.texto || payload.voiceName) {
  return await reenviarJsonAFirebase(TTS_FUNCTION_URL, payload, cors);
}
      // ✅ Subida audio devocional a GitHub: ahora por Worker, sin Function
      if (payload.action === "audioGithub" || payload.audioBase64) {
        return await manejarAudioGithub(payload, env, cors);
      }

     // ✅ Pedido de oración público: ahora por Worker, sin Firebase Functions.
     if (payload.action === "pedidoOracion" || payload.pedido) {
       return await manejarPedidoOracion(payload, env, cors);
      }
      
      // ✅ R2 base64: imágenes, prédicas, devocionales, archivos chicos
      if (payload.action === "r2" || payload.fileBase64) {
        return await manejarSubidaBase64(payload, env, cors);
      }

      return responderJson({
        ok: false,
        error: "Payload no reconocido"
      }, 400, cors);

    } catch (e) {
      return responderJson({
        ok: false,
        error: String(e?.message || e)
      }, 500, cors);
    }
  }
};
