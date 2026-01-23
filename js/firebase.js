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

// ================= FIREBASE CONFIG =================

const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ================= DOM (SE CARGA CON DEFER) =================

const libroSel = document.getElementById("libro");
const capSel = document.getElementById("capitulo");
const texto = document.getElementById("texto");
const titulo = document.getElementById("titulo");
const notaBox = document.getElementById("notaBox");
const notaTexto = document.getElementById("notaTexto");
const loginModal = document.getElementById("loginModal");

// ================= AUTH =====================================

onAuthStateChanged(auth, user => {
  uid = user ? user.uid : null;

  if (uid) {
    onValue(ref(db, "marcados/" + uid), s => {
      marcados = s.val() || {};
      mostrarTexto();
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


// ================= EXPONER GLOBAL =================
window.db = db;
window.ref = ref;
window.set = set;
window.remove = remove;
window.onValue = onValue;



