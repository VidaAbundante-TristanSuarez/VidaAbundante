import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  projectId: "vidaabundante-f118a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ DOM
const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");

// LOGIN EMAIL
window.login = async () => {
  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    alert("Completá email y contraseña.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert(e.message);
  }
};

// ✅ LOGIN GOOGLE CON POPUP
window.loginGoogle = async () => {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (e) {
    alert(e.message);
  }
};

// SI YA ESTÁ LOGUEADO → APP
onAuthStateChanged(auth, (user) => {
  if (user) {
    localStorage.setItem("VA_ENTRADA_OK", "1");
    localStorage.removeItem("VA_SIN_LOGIN_OK");
    window.location.replace("/VidaAbundante/?loginOk=1");
  }
});
