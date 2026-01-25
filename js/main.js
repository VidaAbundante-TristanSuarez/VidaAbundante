import { state } from "./estado.js";
import {
  escucharAuth,
  escucharMarcados,
  escucharNotas,
  logout,
  guardarNota
} from "./firebase.js";
import { mostrarTexto } from "./biblia.js";

// ================= AUTH =================
escucharAuth(
  user => {
    state.uid = user.uid;

    escucharMarcados(state.uid, data => {
      state.marcados = data;
      mostrarTexto();
    });

    escucharNotas(state.uid, data => {
      state.notas = data;
    });
  },
  () => {
    state.uid = null;
    state.marcados = {};
    state.notas = {};
  }
);

// ================= GUARDAR NOTA DESDE UI =================
setInterval(() => {
  if (state.notaPendiente && state.uid) {
    guardarNota(
      state.uid,
      state.notaPendiente.grupo,
      state.notaPendiente.texto
    );
    state.notaPendiente = null;
  }
}, 500);

// ================= LOGOUT =================
window.logout = () => {
  logout().then(() => (window.location.href = "login.html"));
};
