// ================= FIREBASE SDKs =================
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

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ================= AUTH STATE =================
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    console.log("Usuario autenticado:", uid);
  } else {
    uid = null;
    console.log("Usuario no autenticado");
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

