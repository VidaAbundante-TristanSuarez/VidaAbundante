// ================= IMPORTS FIREBASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import {
  getStorage,
  ref as refStorage,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a"
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ================= AUTH =================
export function escucharAuth(onLogin, onLogout) {
  onAuthStateChanged(auth, user => {
    if (user) onLogin(user);
    else onLogout();
  });
}

// ================= DATA =================
export function escucharMarcados(uid, callback) {
  return onValue(ref(db, `marcados/${uid}`), snap => {
    callback(snap.val() || {});
  });
}

export function escucharNotas(uid, callback) {
  return onValue(ref(db, `notas/${uid}`), snap => {
    callback(snap.val() || {});
  });
}

export function guardarNota(uid, grupo, texto) {
  return set(ref(db, `notas/${uid}/${grupo}`), texto);
}

export function marcarVersiculo(uid, id, color) {
  return set(ref(db, `marcados/${uid}/${id}`), { color });
}

export function desmarcarVersiculo(uid, id) {
  return remove(ref(db, `marcados/${uid}/${id}`));
}

// ================= LOGOUT =================
export function logout() {
  return signOut(auth);
}

/**
 * Sube una imagen a Firebase Storage y guarda la URL en Realtime Database
 * @param {Blob} blob - Imagen generada en canvas
 * @param {string} panel - "personal" o "iglesia"
 */

export async function subirImagenFirebase(blob, panel = "personal") {
  if (!auth.currentUser) {
    alert("Debes iniciar sesión para subir imágenes");
    return null; // ❌ Retornamos null si no hay usuario
  }

  const uid = auth.currentUser.uid;
  const timestamp = Date.now(); // para que cada archivo sea único
  const nombreArchivo = `imagen_${timestamp}.png`;
  const path = `${panel}/${uid}/${nombreArchivo}`; // ruta en Storage

  const storageRef = refStorage(storage, path);

  try {
    // Subir la imagen
    await uploadBytes(storageRef, blob);

    // Obtener URL pública
    const url = await getDownloadURL(storageRef);

    // Guardar URL en la base de datos
    const dbPath = `imagenes/${panel}/${uid}/${timestamp}`;
    await set(ref(db, dbPath), { url, timestamp });

    // ✅ Retornar la URL para usarla inmediatamente
    return url;
  } catch (error) {
    console.error("Error subiendo la imagen:", error);
    alert("No se pudo subir la imagen. Reintenta.");
    return null; // Retornamos null si hay error
  }
}

