import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtDcQ2DhgMpLsn4FCdF82QNstfvAjguQ4",
  authDomain: "vidaabundante-f118a.firebaseapp.com",
  projectId: "vidaabundante-f118a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// LOGIN EMAIL
window.login = () => {
  signInWithEmailAndPassword(
    auth,
    email.value,
    password.value
  ).catch(e => alert(e.message));
};

// LOGIN GOOGLE
window.loginGoogle = () => {
  signInWithRedirect(auth, new GoogleAuthProvider());
};

// SI YA ESTÁ LOGUEADO → APP
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = "app.html";
  }
});
