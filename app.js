import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBZegbOl9gQTR6JAQokEc8YmVtbbcdr8ik",
  authDomain: "vidaabundante-82bbe.firebaseapp.com",
  databaseURL: "https://vidaabundante-82bbe-default-rtdb.firebaseio.com",
  projectId: "vidaabundante-82bbe",
  storageBucket: "vidaabundante-82bbe.appspot.com",
  messagingSenderId: "975960147046",
  appId: "1:975960147046:web:79345d4baff3d8c82059a7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// 🔐 LOGIN EMAIL
window.login = function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("✅ Bienvenido");
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
      alert("✅ Bienvenido con Google");
    }
  })
  .catch(error => {
    if (error) alert(error.message);
  });
