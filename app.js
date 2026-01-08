import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// 🔧 CONFIGURACIÓN CORRECTA
const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  databaseURL: "https://vidaabundante-f118a-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-f118a",
  storageBucket: "vidaabundante-f118a.firebasestorage.app",
  messagingSenderId: "288400700394",
  appId: "1:288400700394:web:006e75400a073edaec3893"
};

// 🔥 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 🔐 LOGIN EMAIL
window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      // NO hacemos nada acá, onAuthStateChanged se encarga
    })
    .catch(e => alert(e.message));
};

// 🔐 LOGIN GOOGLE (REDIRECCIÓN)
window.loginGoogle = function () {
  const provider = new GoogleAuthProvider();
  signInWithRedirect(auth, provider);
};

// 🔁 CUANDO VUELVE DE GOOGLE
getRedirectResult(auth)
  .then(result => {
    if (result && result.user) {
      set(ref(db, "users/" + result.user.uid), {
        email: result.user.email,
        role: "user"
      });
    }
  })
  .catch(error => {
    if (error) alert(error.message);
  });

// ✅ SI YA ESTÁ LOGUEADO → IR A LA APP
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "app.html";
  }
});
