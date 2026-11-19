import {ref, query, orderByChild, equalTo, endAt, limitToFirst, onValue, get, update} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const opciones = [
  ["publica", "Pública"],
  ["sesion", "Solo con sesión iniciada"],
  ["privada", "Solo yo"]
];

export function nivelPublicacion(item) {
  return String(item?.audiencia || "").startsWith("uid:") ? "privada" : item?.audiencia === "sesion" ? "sesion" : "publica";
}
export function puedeVerPublicacion(item, uid = window.__FB?.auth?.currentUser?.uid) {
  const audiencia = item?.audiencia;
  return audiencia == null || audiencia === "publica" ||
    Boolean(uid && (audiencia === "sesion" || audiencia === "uid:" + uid));
}
export function audienciaPublicacion(nivel, propietario) {
  if (nivel === "privada") {
    if (!propietario || propietario !== window.__UID) throw new Error("«Solo yo» está disponible para tus publicaciones.");
    return "uid:" + propietario;
  }
  return nivel === "sesion" ? nivel : "publica";
}

export async function verificarAccesoPublicacion(db, ruta, audiencia) {
  if (audiencia === "publica" || audiencia == null) return;
  try {
    await get(query(ref(db, ruta), limitToFirst(1)));
  } catch (error) {
    if (/permission.denied/i.test(error.code || error.message || "")) return;
    throw error;
  }
  throw new Error("Activá las reglas de visibilidad de Firebase para guardar con acceso restringido.");
}

function consultas(db, ruta, uid) {
  const base = ref(db, ruta);
  const porAudiencia = orderByChild("audiencia");
  const lista = [query(base, porAudiencia, endAt(false)), query(base, porAudiencia, equalTo("publica"))];
  if (uid) lista.push(query(base, porAudiencia, equalTo("sesion")), query(base, porAudiencia, equalTo("uid:" + uid)));
  return lista;
}

function combinar(partes, uid) {
  return Object.fromEntries(Object.entries(Object.assign({}, ...partes))
    .filter(([, item]) => puedeVerPublicacion(item, uid)));
}

export function escucharPublicaciones(db, ruta, recibir, error = console.error) {
  let cancelar = [];
  let generacion = 0;
  const dejarAuth = onAuthStateChanged(window.__FB.auth, usuario => {
    const actual = ++generacion;
    cancelar.forEach(fn => fn());
    const uid = usuario?.uid || "";
    const lista = consultas(db, ruta, uid);
    const partes = new Array(lista.length);
    const pendientes = new Set(lista.keys());
    const entregar = (indice, datos) => {
      if (actual !== generacion) return;
      partes[indice] = datos;
      pendientes.delete(indice);
      if (!pendientes.size) recibir(combinar(partes, uid));
    };
    recibir({}, false);
    cancelar = lista.map((q, indice) => onValue(q, snap => entregar(indice, snap.val()), err => {
      entregar(indice, {});
      error(err);
    }));
  });
  return () => {
    generacion++;
    dejarAuth();
    cancelar.forEach(fn => fn());
  };
}

export async function leerPublicaciones(db, ruta) {
  await window.__FB.auth.authStateReady?.();
  const uid = window.__FB.auth.currentUser?.uid || "";
  const partes = await Promise.all(consultas(db, ruta, uid).map(async q => (await get(q)).val()));
  return combinar(partes, uid);
}

export function campoVisibilidad(id, valor = "publica", permiteSoloYo = true) {
  return `<label class="va-campo-audiencia">Visibilidad <select id="${id}">
    ${opciones.map(([clave, texto]) => `<option value="${clave}"${clave === valor ? " selected" : ""}${clave === "privada" && !permiteSoloYo ? " disabled" : ""}>${texto}</option>`).join("")}
  </select></label>`;
}

export function visibilidadEnLote({ancla, db, ruta, items, titulo, propietario, campoPropietario}) {
  if (!ancla?.isConnected || !window.__UID || ancla.parentElement.querySelector('[data-audiencia-ruta="' + ruta + '"]')) return;
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn-primary va-boton-audiencia";
  boton.dataset.audienciaRuta = ruta;
  boton.textContent = "Visibilidad";
  ancla.before(boton);
  boton.onclick = () => {
    const uid = window.__UID;
    const publicaciones = items();
    const dialogo = document.createElement("dialog");
    dialogo.className = "va-dialogo-audiencia";
    dialogo.innerHTML = `<h3>Visibilidad de publicaciones</h3>
      <label><input type="checkbox" data-todas> Marcar todas</label>
      <div data-lista></div>
      ${campoVisibilidad("vaVisibilidadLote", "sesion")}
      <p role="status"></p>
      <footer><button type="button" data-cerrar>Cerrar</button><button type="button" data-aplicar disabled>Aplicar</button></footer>`;
    const lista = dialogo.querySelector("[data-lista]");
    const marcar = dialogo.querySelector("[data-todas]");
    const aplicar = dialogo.querySelector("[data-aplicar]");
    const cerrar = dialogo.querySelector("[data-cerrar]");
    const estado = dialogo.querySelector("[role=status]");
    const nivel = dialogo.querySelector("select");
    const filas = publicaciones.map(item => {
      const label = document.createElement("label");
      const check = document.createElement("input");
      check.type = "checkbox";
      label.append(check, document.createTextNode((titulo(item) || "Sin título") + " · " + opciones.find(([v]) => v === nivelPublicacion(item))[1]));
      lista.append(label);
      return {item, check};
    });
    const marcadas = () => filas.filter(({check}) => check.checked);
    const actualizar = () => {
      const elegidas = marcadas();
      aplicar.disabled = !elegidas.length;
      marcar.checked = !!filas.length && elegidas.length === filas.length;
      marcar.indeterminate = !!elegidas.length && !marcar.checked;
      nivel.options[2].disabled = elegidas.some(({item}) => (propietario(item) || uid) !== uid);
      if (nivel.value === "privada" && nivel.options[2].disabled) nivel.value = "sesion";
    };
    marcar.onchange = () => { filas.forEach(({check}) => { check.checked = marcar.checked; }); actualizar(); };
    lista.onchange = actualizar;
    cerrar.onclick = () => dialogo.close();
    dialogo.addEventListener("close", () => dialogo.remove());
    aplicar.onclick = async () => {
      const seleccion = marcadas();
      const controles = [...dialogo.querySelectorAll("input, button, select")];
      const valores = controles.map(control => control.disabled);
      controles.forEach(control => { control.disabled = true; });
      const impedirCerrar = e => e.preventDefault();
      dialogo.addEventListener("cancel", impedirCerrar);
      estado.textContent = "Guardando…";
      try {
        if (uid !== window.__UID) throw new Error("La sesión cambió. Volvé a abrir este panel.");
        const cambios = {};
        for (const {item} of seleccion) {
          const audiencia = audienciaPublicacion(nivel.value, propietario(item) || uid);
          cambios[`${ruta}/${item.id}/audiencia`] = audiencia;
          if (ruta === "ediciones" && audiencia !== "publica") {
            cambios[`compartidos/edicion_${item.id}`] = null;
            if (item.refPublica) cambios[`edicionesRefs/${item.refPublica}/titulo`] = null;
          }
          if (nivel.value === "privada" && !propietario(item)) cambios[`${ruta}/${item.id}/${campoPropietario}`] = uid;
        }
        await verificarAccesoPublicacion(db, ruta, Object.values(cambios)[0]);
        await update(ref(db), cambios);
        dialogo.close();
        window.mostrarToast?.("Visibilidad actualizada");
      } catch (error) {
        estado.textContent = error.message || "No se pudo cambiar la visibilidad.";
        controles.forEach((control, i) => { control.disabled = valores[i]; });
      } finally {
        dialogo.removeEventListener("cancel", impedirCerrar);
      }
    };
    if (!filas.length) estado.textContent = "Todavía no hay publicaciones.";
    document.body.append(dialogo);
    dialogo.showModal();
  };
}
