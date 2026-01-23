// ================= FIREBASE =================

// IMPORTS FIREBASE
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

// IMPORTA ESTADO GLOBAL
import {
  uid,
  marcados,
  notas
} from "./estado.js";

// ================= CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a"
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

// ================= AUTH =================
onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (uid) {
    onValue(ref(db, "marcados/" + uid), s => {
      marcados = s.val() || {};
    });

    onValue(ref(db, "notas/" + uid), s => {
      notas = s.val() || {};
    });
  }
});

// ================= LOGOUT =================
window.logout = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

// ================= NOTAS =================
window.guardarNota = () => {
  if (!uid) return;
  const notaTexto = document.getElementById("notaTexto");
  const grupoActual = window.grupoActual;
  if (!grupoActual) return;

  set(ref(db, `notas/${uid}/${grupoActual}`), notaTexto.value);
};
