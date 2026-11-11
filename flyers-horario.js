import { normalizarUrlImagen, obtenerBlobImagen, urlMiniaturaImagen } from './carga-imagenes.js?v=20261110-carga-2';
import { colorEnCanvas, crearDialogoEditor, dibujarCajaTexto, esperarFuentesPreview, fuentesEditorImagen } from './imagen-editor.js?v=20261111-editores-1';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const FUENTES = ['Arial', 'Alegreya', 'Abril Fatface', 'Bebas Neue', 'Caveat', 'Cinzel', 'Cormorant',
  'Courgette', 'Dancing Script', 'DM Serif Display', 'Great Vibes', 'Josefin Sans', 'Lexend',
  'Libre Baskerville', 'Lobster', 'Lora', 'Merriweather', 'Montserrat', 'Oswald', 'Playfair Display', 'Poppins', 'Roboto'];
const HORAS = Array.from({length: 24}, (_, h) => String(h).padStart(2, '0'));
const MINUTOS = Array.from({length: 60}, (_, m) => String(m).padStart(2, '0'));
const FORMATO_HORA = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
const VISTAS = new Map();
const VISTAS_PENDIENTES = new Set();
let observador;
const esc = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esFlyer = ed => /^(flyers?|volantes?)$/i.test(String(ed?.rama || ed?.categoria || ed?.tipoEdicion || 'flyers').trim());

function horarioValido(dia, hora) {
  return (dia === '' || DIAS.includes(dia)) && (hora === '' || FORMATO_HORA.test(hora));
}

function bloqueValido(bloque) {
  return bloque && FUENTES.includes(bloque.fuente) && [400, 700].includes(bloque.peso) &&
    ['center', 'left', 'right'].includes(bloque.alineacion || 'center') &&
    /^#[0-9a-f]{6}$/i.test(bloque.color) && [bloque.x, bloque.y, bloque.tamano, bloque.ancho].every(Number.isFinite) &&
    bloque.x >= 2 && bloque.x <= 98 && bloque.y >= 2 && bloque.y <= 98 &&
    bloque.tamano >= 1 && bloque.tamano <= 30 && bloque.ancho >= 5 && bloque.ancho <= 100;
}

function coincideUrl(primera, segunda) {
  return normalizarUrlImagen(primera) === normalizarUrlImagen(segunda);
}

function plantillaValida(p) {
  return p?.id && normalizarUrlImagen(p.original) && normalizarUrlImagen(p.baseUrl) &&
    horarioValido(p.diaInicial, p.horaInicial) && bloqueValido(p.dia) && bloqueValido(p.hora);
}

export function configuracionHorarioFlyer(edicion, url) {
  if (!edicion?.horariosPorImagen || !esFlyer(edicion) || !normalizarUrlImagen(url)) return null;
  const entrada = Object.entries(edicion.horariosPorImagen).find(([, dato]) => coincideUrl(dato?.plantilla?.original, url));
  if (!entrada) return null;
  const [clave, dato] = entrada;
  return plantillaValida(dato.plantilla) ? {...dato, clave} : null;
}

export function versionesHorarioFlyer(edicion) {
  const resultado = [];
  for (const config of Object.values(edicion?.horariosPorImagen || {})) {
    for (const [id, horario] of Object.entries(config?.versiones || {})) {
      if (!horarioValido(horario?.dia, horario?.hora)) continue;
      const plantilla = config.plantilla?.id === horario.plantillaId
        ? config.plantilla
        : config.plantillasAnteriores?.[horario.plantillaId];
      if (plantillaValida(plantilla)) resultado.push({id, plantilla, horario});
    }
  }
  return resultado.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function puedeEditarDiaHora() {
  return Boolean(window.__UID && (window.__ES_ADMIN || window.__ES_COLABORADOR));
}

function textoDia(dia, formato) {
  if (formato === 'mayusculas') return dia.toLocaleUpperCase('es');
  if (formato === 'minusculas') return dia.toLocaleLowerCase('es');
  return dia;
}

function textoHora(hora, formato, omitirMinutos) {
  if (omitirMinutos && hora.endsWith(':00')) hora = hora.slice(0, 2);
  if (formato === 'sinCero') return hora.replace(/^0/, '');
  if (formato === 'punto') return hora.replace(':', '.');
  return hora;
}

async function cargarMapa(url) {
  return createImageBitmap(await obtenerBlobImagen(url, 'flyer.png', {esperaDirecta: 12000}));
}

async function cargarMapaPlantilla(plantilla, usarMiniatura) {
  if (usarMiniatura && plantilla.baseMiniaturaUrl) {
    try {
      return await cargarMapa(plantilla.baseMiniaturaUrl);
    } catch {
      // Si falta la miniatura, todavía podemos componer sobre la base original.
    }
  }
  return cargarMapa(plantilla.baseUrl);
}

async function pintarBloque(ctx, bloque, texto, prefijos, ancho, alto, sufijos = []) {
  if (!bloqueValido(bloque)) return;
  const x = ancho * bloque.x / 100;
  const y = alto * bloque.y / 100;
  const alineacion = bloque.alineacion || 'center';
  const espacioRestante = {left: ancho - x, right: x, center: 2 * Math.min(x, ancho - x)};
  const espacio = Math.min(ancho * bloque.ancho / 100, espacioRestante[alineacion]);
  const fuente = px => `${bloque.peso} ${px}px "${bloque.fuente}"`;
  const solicitado = Math.min(ancho * bloque.tamano / 100, 2 * Math.min(y, alto - y));
  if (bloque.fuente !== 'Arial') {
    const cargadas = await document.fonts.load(fuente(solicitado), texto + ' ' + prefijos.join(' '));
    if (!cargadas.length) throw new Error(`La fuente ${bloque.fuente} todavía no está disponible.`);
  }
  ctx.font = fuente(solicitado);
  const anchoMayor = valores => Math.max(0, ...valores.map(valor => ctx.measureText(valor).width));
  const maximo = anchoMayor(prefijos) + anchoMayor(sufijos);
  ctx.font = fuente(solicitado * Math.min(1, espacio / Math.max(1, maximo)));
  ctx.fillStyle = bloque.color;
  ctx.textAlign = alineacion;
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x, y);
}

function colorHsl(r, g, b) {
  const maximo = Math.max(r, g, b), minimo = Math.min(r, g, b);
  const croma = maximo - minimo;
  const luz = (maximo + minimo) / 510;
  if (!croma) return {tono: 0, saturacion: 0, luz, croma};
  const sector = maximo === r ? (g - b) / croma :
    maximo === g ? 2 + (b - r) / croma : 4 + (r - g) / croma;
  return {
    tono: (60 * sector + 360) % 360,
    saturacion: croma / (255 - Math.abs(maximo + minimo - 255)),
    luz, croma
  };
}

function reemplazarColorImagen(ctx, ancho, alto, origen, destino) {
  if (origen === destino) return;
  const deHex = color => colorHsl(...[1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)));
  const tomado = deHex(origen);
  const nuevo = deHex(destino);
  const neutro = tomado.croma < 19 && tomado.saturacion < .22;
  const imagen = ctx.getImageData(0, 0, ancho, alto);
  const datos = imagen.data;
  for (let i = 0; i < datos.length; i += 4) {
    if (!datos[i + 3]) continue;
    const actual = colorHsl(datos[i], datos[i + 1], datos[i + 2]);
    const diferenciaTono = ((actual.tono - tomado.tono + 540) % 360) - 180;
    const mezcla = neutro
      ? limitar((.28 - Math.abs(actual.luz - tomado.luz)) / .15, 0, 1) *
        limitar((30 - actual.croma) / 12, 0, 1)
      : limitar((44 - Math.abs(diferenciaTono)) / 20, 0, 1) *
        limitar((actual.croma - 2) / Math.max(2, Math.min(12, tomado.croma - 2)), 0, 1);
    if (!mezcla) continue;

    // Conservar el relieve del color elegido, incluso en sombras y luces.
    const diferenciaLuz = actual.luz - tomado.luz;
    const luz = diferenciaLuz < 0
      ? nuevo.luz * actual.luz / tomado.luz
      : nuevo.luz + (1 - nuevo.luz) * diferenciaLuz / Math.max(.001, 1 - tomado.luz);
    const saturacion = nuevo.saturacion
      ? limitar(nuevo.saturacion + (actual.saturacion - tomado.saturacion) * .55, 0, 1) : 0;
    const tono = (nuevo.tono + (neutro ? 0 : diferenciaTono / 4) + 360) % 360;
    const amplitud = saturacion * Math.min(luz, 1 - luz);
    const canal = posicion => {
      const k = (posicion + tono / 30) % 12;
      return 255 * (luz - amplitud * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };
    datos[i] += (canal(0) - datos[i]) * mezcla;
    datos[i + 1] += (canal(8) - datos[i + 1]) * mezcla;
    datos[i + 2] += (canal(4) - datos[i + 2]) * mezcla;
  }
  ctx.putImageData(imagen, 0, 0);
}

function dibujarBaseHorario(mapa, lado, retoques = [], canvas = document.createElement('canvas')) {
  const escala = Math.min(1, lado / Math.max(mapa.width, mapa.height));
  canvas.width = Math.max(1, Math.round(mapa.width * escala));
  canvas.height = Math.max(1, Math.round(mapa.height * escala));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(mapa, 0, 0, canvas.width, canvas.height);
  for (const retoque of retoques) {
    if (retoque.origen) {
      reemplazarColorImagen(ctx, canvas.width, canvas.height, retoque.origen, retoque.destino);
      continue;
    }
    const {x, y, ancho, alto, color} = retoque;
    const izq = Math.round(x * canvas.width);
    const arriba = Math.round(y * canvas.height);
    const w = Math.round((x + ancho) * canvas.width) - izq;
    const h = Math.round((y + alto) * canvas.height) - arriba;
    ctx.fillStyle = color;
    ctx.fillRect(izq, arriba, w, h);
  }
  return canvas;
}

async function componer(mapa, plantilla, horario, lado) {
  const canvas = dibujarBaseHorario(mapa, lado);
  const ctx = canvas.getContext('2d');
  const {width, height} = canvas;
  if (horario.dia && !plantilla.dia.inactivo) {
    const dia = valor => (plantilla.prefijoDia || '') + textoDia(valor, plantilla.formatoDia);
    await pintarBloque(ctx, plantilla.dia, dia(horario.dia), DIAS.map(dia), width, height);
  }
  if (horario.hora && !plantilla.hora.inactivo) {
    const hora = valor => textoHora(valor, plantilla.formatoHora, plantilla.hora.omitirMinutos);
    const sufijo = plantilla.sufijoHora || '';
    await pintarBloque(ctx, plantilla.hora, hora(horario.hora) + sufijo,
      HORAS.map(h => hora(`${h}:01`).slice(0, -2)), width, height, MINUTOS.map(m => m + sufijo));
  }
  return canvas;
}

async function imagenProgramada(plantilla, horario, miniatura) {
  const clave = JSON.stringify([plantilla.id, plantilla.baseUrl, horario.dia, horario.hora, miniatura]);
  if (!VISTAS.has(clave)) {
    const tarea = (async () => {
      const mapa = await cargarMapaPlantilla(plantilla, miniatura);
      try {
        const canvas = await componer(mapa, plantilla, horario, miniatura ? 520 : Infinity);
        return miniatura ? canvas.toDataURL('image/webp', .88) : canvas.toDataURL('image/png');
      } finally { mapa.close(); }
    })();
    VISTAS.set(clave, tarea);
    tarea.catch(() => { if (VISTAS.get(clave) === tarea) VISTAS.delete(clave); });
    const maximo = miniatura ? 18 : 2;
    const clavesTipo = [...VISTAS.keys()].filter(k => k.endsWith(`,${miniatura}]`));
    for (const vieja of clavesTipo.slice(0, Math.max(0, clavesTipo.length - maximo))) VISTAS.delete(vieja);
  }
  return VISTAS.get(clave);
}

export function activarMiniaturasHorario(root) {
  const cargar = async imagen => {
    try {
      const datos = JSON.parse(imagen.dataset.horarioFlyer);
      const vista = await imagenProgramada(datos.plantilla, datos.horario, !imagen.hasAttribute('data-horario-completo'));
      if (imagen.isConnected) imagen.src = vista;
    } catch {
      imagen.alt = imagen.hasAttribute('data-horario-completo')
        ? 'No se pudo cargar el horario actualizado'
        : 'Abrí el flyer para ver el horario actualizado';
    }
  };
  if (typeof IntersectionObserver === 'function') {
    observador ||= new IntersectionObserver(entries => {
      for (const {target, isIntersecting} of entries) {
        if (!isIntersecting) continue;
        observador.unobserve(target);
        VISTAS_PENDIENTES.delete(target);
        cargar(target);
      }
    }, {rootMargin: '140px'});
  }
  for (const imagen of VISTAS_PENDIENTES) {
    if (!imagen.isConnected) {
      observador.unobserve(imagen);
      VISTAS_PENDIENTES.delete(imagen);
    }
  }
  for (const imagen of root.querySelectorAll('img[data-horario-flyer]:not([data-horario-listo])')) {
    imagen.dataset.horarioListo = '1';
    if (observador) {
      VISTAS_PENDIENTES.add(imagen);
      observador.observe(imagen);
    } else cargar(imagen);
  }
}

export async function urlConHorarioFlyer(version, original) {
  return version ? imagenProgramada(version.plantilla, version.horario, false) : original;
}

export function elegirImagenHorarioFlyer(imagenes) {
  if (imagenes.length <= 1) return Promise.resolve(imagenes[0] || null);
  const dialogo = crearDialogoEditor('Elegir imagen');
  if (!dialogo) return Promise.resolve(null);
  dialogo.insertAdjacentHTML('beforeend', `<form>
    <label>Imagen<select name="imagen">${imagenes.map((imagen, i) =>
      `<option value="${i}">${esc(imagen.etiqueta)}</option>`).join('')}</select></label>
    <div class="va-horario-preview"><img alt="Imagen elegida"></div>
    <footer><button type="button" data-cancelar>Cancelar</button><button type="submit" class="va-horario-primario">Continuar</button></footer>
  </form>`);
  const form = dialogo.querySelector('form');
  const img = form.querySelector('img');
  const seleccion = () => imagenes[Number(form.elements.imagen.value)];
  const mostrar = () => {
    const elegida = seleccion();
    const {url, miniaturaUrl, version} = elegida;
    img.onerror = () => { img.onerror = null; img.src = url; };
    img.src = urlMiniaturaImagen(url, miniaturaUrl);
    if (version) {
      imagenProgramada(version.plantilla, version.horario, true).then(vista => {
        if (img.isConnected && seleccion() === elegida) img.src = vista;
      }).catch(() => {});
    }
  };
  return new Promise(resolve => {
    let elegida = null;
    dialogo.addEventListener('close', () => resolve(elegida), {once:true});
    form.elements.imagen.onchange = mostrar;
    form.querySelector('[data-cancelar]').onclick = () => dialogo.close();
    form.onsubmit = evento => {
      evento.preventDefault();
      elegida = seleccion();
      dialogo.close();
    };
    dialogo.showModal();
    mostrar();
  });
}

function selectorDia(dia = '') {
  return `<select name="dia">
    <option value="">Sin día</option>
    ${DIAS.map(valor => `<option${valor === dia ? ' selected' : ''}>${valor}</option>`).join('')}
  </select>`;
}

function camposHorario(dia, hora, mostrarDia = true, mostrarHora = true) {
  if (!mostrarDia && !mostrarHora) return '';
  return `<div class="va-horario-valores">
    ${mostrarDia ? `<label>Día${selectorDia(dia)}</label>` : ''}
    ${mostrarHora ? `<label>Hora<input name="hora" type="text" inputmode="numeric" autocomplete="off" maxlength="5"
      placeholder="HH:mm" pattern="${FORMATO_HORA.source}" value="${esc(hora)}"></label>` : ''}
  </div>`;
}

function conectarFormulario(dialogo, {leer, cargar, guardar}) {
  const form = dialogo.querySelector('form');
  const lienzo = form.querySelector('canvas');
  const estado = form.querySelector('[role="status"]');
  const guardarBtn = form.querySelector('button[type="submit"]');
  let cargaMapa, mapa, revision = 0, guardando = false;
  const cerrar = () => {
    if (!guardando) dialogo.close();
  };
  dialogo.querySelector('.va-horario-cerrar').onclick = cerrar;
  dialogo.addEventListener('cancel', e => { if (guardando) e.preventDefault(); });
  dialogo.addEventListener('close', () => { revision++; mapa?.close(); mapa = null; });
  form.querySelector('[data-cancelar]')?.addEventListener('click', cerrar);

  async function pintar() {
    const id = ++revision;
    guardarBtn.disabled = true;
    const datos = leer(form);
    try {
      if (!cargaMapa) {
        const tarea = cargar(form).then(resultado => {
          if (tarea !== cargaMapa || !dialogo.open) {
            resultado.close();
            throw new Error('La imagen de la vista previa cambió.');
          }
          mapa = resultado;
          return resultado;
        }).catch(error => {
          if (tarea === cargaMapa) cargaMapa = null;
          throw error;
        });
        cargaMapa = tarea;
      }
      const imagen = await cargaMapa;
      const nuevo = await componer(imagen, datos.plantilla, datos.horario, 760);
      if (id !== revision || !dialogo.open) return false;
      lienzo.width = nuevo.width;
      lienzo.height = nuevo.height;
      lienzo.getContext('2d').drawImage(nuevo, 0, 0);
      lienzo.hidden = false;
      const hora = datos.horario.hora;
      estado.textContent = hora.length === 5 && !FORMATO_HORA.test(hora)
        ? 'Ingresá una hora de 00:00 a 23:59.'
        : '';
      const valido = horarioValido(datos.horario.dia, hora) &&
        bloqueValido(datos.plantilla.dia) && bloqueValido(datos.plantilla.hora);
      guardarBtn.disabled = guardando || !valido;
      return valido;
    } catch (error) {
      if (id === revision && dialogo.open) {
        estado.textContent = error.message || 'No pude preparar la vista previa.';
        lienzo.hidden = true;
      }
      return false;
    }
  }

  form.elements.hora?.addEventListener('input', ({target}) => {
    const digitos = target.value.replace(/[^0-9]/g, '').slice(0, 4);
    const hora = digitos.length > 2 ? digitos.slice(0, 2) + ':' + digitos.slice(2) : digitos;
    if (hora === target.value) return;
    const posicion = target.value.slice(0, target.selectionStart).replace(/[^0-9]/g, '').length;
    target.value = hora;
    const cursor = posicion > 2 ? posicion + 1 : posicion;
    target.setSelectionRange(cursor, cursor);
  });
  form.addEventListener('input', evento => {
    if (evento.target.type !== 'file') pintar();
  });
  form.onsubmit = async evento => {
    evento.preventDefault();
    if (guardando || guardarBtn.disabled) return;
    guardando = true;
    for (const control of form.elements) control.disabled = true;
    let valido = false;
    try {
      valido = await pintar();
      if (!valido) return;
      estado.textContent = 'Guardando…';
      await guardar(leer(form));
      dialogo.close();
    } catch (error) {
      estado.textContent = error.code === 'PERMISSION_DENIED' || /permission.denied/i.test(error.message)
        ? 'Firebase rechazó el guardado. Revisá el permiso de edición de horarios.'
        : error.message || 'No se pudo guardar. Probá de nuevo.';
    } finally {
      guardando = false;
      if (dialogo.open) {
        for (const control of form.elements) control.disabled = false;
        guardarBtn.disabled = !valido;
      }
    }
  };
  return {pintar};
}

export function abrirEdicionHorarioFlyer(config, guardar) {
  if (!config || !puedeEditarDiaHora()) return;
  const {plantilla, versiones} = config;
  const ultimoId = Object.keys(versiones || {}).sort().at(-1);
  const actual = versiones?.[ultimoId] || {dia: plantilla.diaInicial, hora: plantilla.horaInicial};
  const dialogo = crearDialogoEditor('Editar día y hora');
  if (!dialogo) return;
  dialogo.insertAdjacentHTML('beforeend', `<form>
    ${camposHorario(actual.dia, actual.hora, !plantilla.dia.inactivo, !plantilla.hora.inactivo)}
    <div class="va-horario-preview"><canvas aria-label="Vista previa del flyer" hidden></canvas></div>
    <p class="va-horario-estado" role="status">Preparando vista previa…</p>
    <footer>
      ${!plantilla.dia.inactivo || !plantilla.hora.inactivo ? '<button type="button" data-quitar>Quitar horario</button>' : ''}
      <button type="submit" class="va-horario-primario" disabled>Guardar como nueva</button>
    </footer>
  </form>`);
  const {pintar} = conectarFormulario(dialogo, {
    leer: form => ({plantilla, horario: {dia: form.elements.dia?.value || '', hora: form.elements.hora?.value || ''}}),
    cargar: () => cargarMapaPlantilla(plantilla, true),
    guardar: datos => guardar({...datos.horario, plantillaId: plantilla.id})
  });
  const form = dialogo.querySelector('form');
  form.querySelector('[data-quitar]')?.addEventListener('click', () => {
    if (form.elements.dia) form.elements.dia.value = '';
    if (form.elements.hora) form.elements.hora.value = '';
    pintar();
  });
  dialogo.showModal();
  pintar();
}

const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

const marcasTexto = [
  ['nw', -1, -1, 'la esquina superior izquierda'],
  ['n',   0, -1, 'el centro superior'],
  ['ne',  1, -1, 'la esquina superior derecha'],
  ['w',  -1,  0, 'el centro izquierdo'],
  ['e',   1,  0, 'el centro derecho'],
  ['sw', -1,  1, 'la esquina inferior izquierda'],
  ['s',   0,  1, 'el centro inferior'],
  ['se',  1,  1, 'la esquina inferior derecha']
];

export function abrirEditorImagenEdicion({titulo, rama, tipos, imagen}, guardar) {
  if (!window.__UID || !window.__ES_ADMIN) return;
  const dialogo = crearDialogoEditor('Editar imagen');
  if (!dialogo) return;
  dialogo.classList.add('va-edicion-imagen-dialog');
  dialogo.insertAdjacentHTML('beforeend', `<form>
    <div class="va-horario-valores">
      <label>Título<input name="titulo" required></label>
      <label>Tipo de edición<select name="rama"></select></label>
    </div>
    <div class="va-edicion-herramientas">
      <button type="button" data-tapar aria-pressed="true"><i class="fa-regular fa-square" aria-hidden="true"></i> Tapar zona</button>
      <button type="button" data-agregar-texto><i class="fa-solid fa-plus" aria-hidden="true"></i> Texto</button>
      <button type="button" data-cambiar-color aria-pressed="false"><i class="fa-solid fa-palette" aria-hidden="true"></i> Cambiar color</button>
      <button type="button" data-deshacer title="Deshacer retoque" aria-label="Deshacer retoque" disabled><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
    </div>
    <p class="va-horario-estado" role="status">Abriendo la imagen…</p>
    <div class="va-edicion-herramientas" data-reemplazo hidden>
      <span class="va-edicion-color-origen" aria-label="Color tomado de la imagen"></span>
      <input type="color" name="colorNuevo" aria-label="Color de reemplazo" title="Color de reemplazo">
      <button type="button" data-color-destino title="Tomar el reemplazo de la imagen" aria-label="Tomar el reemplazo de la imagen"><i class="fa-solid fa-eye-dropper" aria-hidden="true"></i></button>
      <button type="button" data-aplicar-color>Aplicar color</button>
    </div>
    <div class="va-edicion-escena" data-herramienta="tapar" hidden>
      <canvas aria-label="Vista previa de la imagen"></canvas>
      <div class="va-horario-marca" data-marca hidden></div>
    </div>
    <div class="va-edicion-texto-controles" data-controles-texto hidden>
      <div class="va-edicion-herramientas" role="group" aria-label="Estilo de texto">
        <button type="button" data-formato="negrita" title="Negrita" aria-label="Negrita"><b aria-hidden="true">B</b></button>
        <button type="button" data-formato="cursiva" title="Cursiva" aria-label="Cursiva"><em aria-hidden="true">I</em></button>
        <button type="button" data-formato="subrayado" title="Subrayado" aria-label="Subrayado"><u aria-hidden="true">U</u></button>
        <input type="color" name="color" aria-label="Color del texto" title="Color del texto">
        <button type="button" data-color-texto title="Tomar color del texto de la imagen" aria-label="Tomar color del texto de la imagen"><i class="fa-solid fa-eye-dropper" aria-hidden="true"></i></button>
        <button type="button" data-quitar-texto title="Quitar cuadro de texto" aria-label="Quitar cuadro de texto"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
      </div>
      <div class="va-edicion-fuentes" role="group" aria-label="Fuentes"></div>
    </div>
    <footer><button type="button" data-cancelar>Cancelar</button>
      <button type="submit" class="va-horario-primario" disabled>Guardar como nueva</button>
    </footer>
  </form>`);

  const form = dialogo.querySelector('form');
  form.elements.titulo.value = titulo;
  for (const tipo of tipos) form.elements.rama.add(new Option(tipo.label, tipo.id));
  form.elements.rama.value = rama;
  const escena = form.querySelector('.va-edicion-escena');
  const lienzo = escena.querySelector('canvas');
  const ctx = lienzo.getContext('2d');
  const marca = escena.querySelector('[data-marca]');
  const estado = form.querySelector('[role="status"]');
  const tapar = form.querySelector('[data-tapar]');
  const agregar = form.querySelector('[data-agregar-texto]');
  const cambiarColor = form.querySelector('[data-cambiar-color]');
  const deshacer = form.querySelector('[data-deshacer]');
  const panelColor = form.querySelector('[data-reemplazo]');
  const muestra = panelColor.querySelector('.va-edicion-color-origen');
  const tomarDestino = panelColor.querySelector('[data-color-destino]');
  const aplicarColor = panelColor.querySelector('[data-aplicar-color]');
  const controles = form.querySelector('[data-controles-texto]');
  const cuentagotas = controles.querySelector('[data-color-texto]');
  const fuentes = controles.querySelector('.va-edicion-fuentes');
  const formatos = [...controles.querySelectorAll('[data-formato]')];
  const botonGuardar = form.querySelector('button[type="submit"]');
  const retoques = [];
  const cajas = [];
  let mapa, activa, seleccion, gesto, colorPendiente;
  let herramienta = 'tapar';
  let guardando = false;

  const cambiosImagen = () => retoques.length > 0 || cajas.some(caja => caja.texto.innerText.trim());
  const cambiandoColor = () => ['color-origen', 'color-destino', 'reemplazo'].includes(herramienta);
  const metaActual = () => ({titulo: form.elements.titulo.value.trim(), rama: form.elements.rama.value});
  const puedeCerrar = () => { if (!guardando) dialogo.close(); };
  dialogo.querySelector('.va-horario-cerrar').onclick = puedeCerrar;
  form.querySelector('[data-cancelar]').onclick = puedeCerrar;
  dialogo.addEventListener('cancel', e => { if (guardando) e.preventDefault(); });

  function actualizarGuardar() {
    const meta = metaActual();
    const imagenModificada = cambiosImagen();
    const metadatosModificados = meta.titulo !== titulo || meta.rama !== rama;
    botonGuardar.textContent = !imagenModificada && metadatosModificados ? 'Guardar cambios' : 'Guardar como nueva';
    botonGuardar.disabled = guardando || !mapa || !!seleccion || !!colorPendiente || !meta.titulo || !meta.rama ||
      (!imagenModificada && !metadatosModificados);
  }

  function actualizarHerramienta() {
    escena.dataset.herramienta = herramienta;
    tapar.setAttribute('aria-pressed', String(herramienta === 'tapar'));
    cuentagotas.setAttribute('aria-pressed', String(herramienta === 'color'));
    cambiarColor.setAttribute('aria-pressed', String(cambiandoColor()));
    panelColor.hidden = !colorPendiente;
    if (colorPendiente) {
      muestra.style.backgroundColor = colorPendiente.origen;
      form.elements.colorNuevo.value = colorPendiente.destino;
      aplicarColor.disabled = colorPendiente.origen === colorPendiente.destino;
      tomarDestino.setAttribute('aria-pressed', String(herramienta === 'color-destino'));
    }
    deshacer.disabled = !seleccion && !colorPendiente && !retoques.length;
    const indicaciones = {
      color: 'Tocá el color que querés usar en el texto.',
      'color-origen': 'Tocá el color que querés cambiar.',
      'color-destino': 'Tocá el color de reemplazo en la imagen.',
      reemplazo: 'Elegí el reemplazo y tocá Aplicar color.',
      tapar: seleccion ? 'Tocá el color de la imagen con el que querés cubrir el recuadro.' :
        'Arrastrá un recuadro sobre el día o la hora.'
    };
    estado.textContent = indicaciones[herramienta] || '';
    actualizarGuardar();
  }

  function repintar() {
    const vista = colorPendiente && herramienta !== 'color-destino' ? [...retoques, colorPendiente] : retoques;
    dibujarBaseHorario(mapa, 880, vista, lienzo);
  }

  function aplicarCaja(caja, bordeInferior) {
    if (!escena.clientHeight) return;
    const {nodo, texto, x, ancho, tamano, color, fuente} = caja;
    nodo.style.left = x * 100 + '%';
    nodo.style.width = ancho * 100 + '%';
    texto.style.fontSize = Math.max(1, tamano * escena.clientWidth) + 'px';
    texto.style.fontFamily = fuente;
    texto.style.color = color;
    texto.style.fontWeight = caja.negrita ? '700' : '400';
    texto.style.fontStyle = caja.cursiva ? 'italic' : 'normal';
    texto.style.textDecoration = caja.subrayado ? 'underline' : 'none';

    const alto = Math.min(1, nodo.offsetHeight / escena.clientHeight);
    caja.y = limitar(bordeInferior == null ? caja.y : bordeInferior - alto, 0, 1 - alto);
    nodo.style.top = caja.y * 100 + '%';
  }

  function mostrarMarca(rect) {
    marca.hidden = !rect;
    if (!rect) return;
    marca.style.left = rect.x * 100 + '%';
    marca.style.top = rect.y * 100 + '%';
    marca.style.width = rect.ancho * 100 + '%';
    marca.style.height = rect.alto * 100 + '%';
  }

  function seleccionar(caja) {
    if (colorPendiente) {
      colorPendiente = null;
      repintar();
    }
    activa = caja;
    seleccion = null;
    herramienta = 'texto';
    mostrarMarca(null);
    for (const item of cajas) item.nodo.classList.toggle('activa', item === caja);
    controles.hidden = !caja;
    if (caja) {
      form.elements.color.value = caja.color;
      for (const boton of formatos) boton.setAttribute('aria-pressed', String(!!caja[boton.dataset.formato]));
      for (const boton of fuentes.children) boton.setAttribute('aria-pressed', String(caja.fuente === boton.dataset.fuente));
    }
    actualizarHerramienta();
  }

  for (const fuente of fuentesEditorImagen) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = fuente.nombre;
    boton.dataset.fuente = fuente.css;
    boton.style.fontFamily = fuente.css;
    boton.onclick = () => {
      activa.fuente = fuente.css;
      aplicarCaja(activa);
      seleccionar(activa);
    };
    fuentes.append(boton);
  }
  fuentes.addEventListener('wheel', e => {
    if (!e.deltaY || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault();
    fuentes.scrollLeft += e.deltaY;
  }, {passive: false});

  for (const boton of formatos) boton.onclick = () => {
    const formato = boton.dataset.formato;
    activa[formato] = !activa[formato];
    aplicarCaja(activa);
    seleccionar(activa);
  };
  form.elements.color.oninput = () => {
    activa.color = form.elements.color.value;
    aplicarCaja(activa);
  };
  cuentagotas.onclick = () => {
    if (!activa) return;
    herramienta = herramienta === 'color' ? 'texto' : 'color';
    actualizarHerramienta();
  };
  controles.querySelector('[data-quitar-texto]').onclick = () => {
    cajas.splice(cajas.indexOf(activa), 1);
    activa.nodo.remove();
    seleccionar(cajas.at(-1));
  };

  agregar.onclick = () => {
    if (!mapa) return;
    const recuadro = retoques.findLast(item => !item.origen);
    const ancho = recuadro ? limitar(recuadro.ancho, .18, .95) : .6;
    const caja = {
      x: recuadro ? Math.min(recuadro.x, 1 - ancho) : .2,
      y: recuadro ? Math.min(recuadro.y, .9) : .43,
      ancho, tamano: .065, color: '#172a3c', fuente: fuentesEditorImagen[0].css
    };
    const nodo = document.createElement('div');
    nodo.className = 'va-edicion-caja';
    nodo.innerHTML = `<div role="textbox" aria-label="Texto en la imagen" aria-multiline="true" contenteditable="true" spellcheck="false" data-placeholder="Escribí acá"></div>
      ${marcasTexto.map(([lado, horizontal, vertical, etiqueta]) => `
        <button type="button" data-ajustar="${lado}" tabindex="-1" aria-label="Cambiar tamaño desde ${etiqueta}"
          style="left:${(horizontal + 1) * 50}%;top:${(vertical + 1) * 50}%"></button>`).join('')}
      <button type="button" data-mover aria-label="Mover cuadro" title="Mover cuadro"><i class="fa-solid fa-arrows-up-down-left-right" aria-hidden="true"></i></button>`;
    caja.nodo = nodo;
    caja.texto = nodo.querySelector('[role="textbox"]');
    caja.texto.onfocus = () => seleccionar(caja);
    caja.texto.onpaste = e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    };
    caja.texto.ondrop = e => e.preventDefault();
    caja.texto.oninput = () => {
      aplicarCaja(caja);
      actualizarGuardar();
    };
    cajas.push(caja);
    escena.append(nodo);
    aplicarCaja(caja);
    seleccionar(caja);
    caja.texto.focus({preventScroll: true});
  };

  tapar.onclick = () => {
    if (herramienta === 'tapar' && cajas.length && !seleccion) {
      seleccionar(cajas.at(-1));
      return;
    }
    seleccionar(null);
    herramienta = 'tapar';
    actualizarHerramienta();
  };
  cambiarColor.onclick = () => {
    const cancelar = cambiandoColor();
    seleccionar(null);
    herramienta = cancelar ? 'tapar' : 'color-origen';
    actualizarHerramienta();
  };
  form.elements.colorNuevo.oninput = () => {
    if (!colorPendiente) return;
    colorPendiente.destino = form.elements.colorNuevo.value;
    herramienta = 'reemplazo';
    repintar();
    actualizarHerramienta();
  };
  tomarDestino.onclick = () => {
    herramienta = herramienta === 'color-destino' ? 'reemplazo' : 'color-destino';
    repintar();
    actualizarHerramienta();
  };
  aplicarColor.onclick = () => {
    retoques.push(colorPendiente);
    colorPendiente = null;
    herramienta = 'tapar';
    repintar();
    actualizarHerramienta();
  };
  deshacer.onclick = () => {
    if (colorPendiente) {
      colorPendiente = null;
      herramienta = 'tapar';
    } else if (seleccion) seleccion = null;
    else retoques.pop();
    mostrarMarca(null);
    repintar();
    actualizarHerramienta();
  };

  function punto(evento, dentro = true) {
    const r = escena.getBoundingClientRect();
    const x = (evento.clientX - r.left) / r.width;
    const y = (evento.clientY - r.top) / r.height;
    return dentro ? {x: limitar(x, 0, 1), y: limitar(y, 0, 1)} : {x, y};
  }
  function rectangulo(a, b) {
    return {x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      ancho: Math.abs(a.x - b.x), alto: Math.abs(a.y - b.y)};
  }

  function ajustarCaja(caja, original, marca, dx, dy) {
    const [, horizontal, vertical] = marca;
    const anchoMaximo = horizontal < 0 ? original.x + original.ancho : 1 - original.x;
    caja.ancho = original.ancho;
    caja.tamano = original.tamano;

    if (horizontal && vertical) {
      const ancho = escena.clientWidth * original.ancho;
      const alto = escena.clientHeight * original.alto;
      // Proyectar el arrastre sobre la diagonal para mantener la proporción.
      const avance = dx * horizontal * escena.clientWidth * ancho + dy * vertical * escena.clientHeight * alto;
      const factor = limitar(1 + avance / (ancho ** 2 + alto ** 2),
        Math.max(.08 / original.ancho, .016 / original.tamano),
        Math.min(anchoMaximo / original.ancho, .34 / original.tamano));
      caja.ancho *= factor;
      caja.tamano *= factor;
    } else if (horizontal) {
      caja.ancho = limitar(original.ancho + dx * horizontal, .08, anchoMaximo);
    } else {
      caja.tamano = limitar(original.tamano * (1 + dy * vertical / original.alto), .016, .34);
    }

    caja.x = horizontal < 0 ? original.x + original.ancho - caja.ancho : original.x;
    caja.y = original.y;
    aplicarCaja(caja, vertical < 0 ? original.y + original.alto : undefined);
  }

  escena.addEventListener('pointerdown', evento => {
    if (!mapa || guardando || gesto || evento.button !== 0) return;
    if (cambiandoColor()) {
      if (herramienta === 'reemplazo') return;
      evento.preventDefault();
      const color = colorEnCanvas(lienzo, ctx, evento);
      if (herramienta === 'color-origen') colorPendiente = {origen: color, destino: color};
      else colorPendiente.destino = color;
      herramienta = 'reemplazo';
      repintar();
      actualizarHerramienta();
      return;
    }
    if (herramienta === 'color' || (herramienta === 'tapar' && seleccion)) {
      evento.preventDefault();
      const color = colorEnCanvas(lienzo, ctx, evento);
      if (herramienta === 'color') {
        activa.color = color;
        aplicarCaja(activa);
        seleccionar(activa);
      } else {
        retoques.push({...seleccion, color});
        seleccion = null;
        mostrarMarca(null);
        repintar();
        actualizarHerramienta();
      }
      return;
    }

    let caja, marca, original;
    if (herramienta !== 'tapar') {
      const nodo = evento.target.closest('.va-edicion-caja');
      if (!nodo || evento.target.closest('[role="textbox"]')) return;
      caja = cajas.find(item => item.nodo === nodo);
      if (!caja) return;
      const lado = evento.target.closest('[data-ajustar]')?.dataset.ajustar;
      marca = marcasTexto.find(([id]) => id === lado);
      seleccionar(caja);
      original = {...caja, alto: nodo.offsetHeight / escena.clientHeight};
    }
    evento.preventDefault();
    gesto = {id: evento.pointerId, inicio: punto(evento, !caja), caja, marca, original};
    escena.setPointerCapture(evento.pointerId);
  });

  escena.addEventListener('pointermove', evento => {
    if (!gesto || gesto.id !== evento.pointerId) return;
    const {inicio, caja, marca, original} = gesto;
    const actual = punto(evento, !caja);
    if (!caja) {
      mostrarMarca(rectangulo(inicio, actual));
      return;
    }
    const dx = actual.x - inicio.x, dy = actual.y - inicio.y;
    if (marca) {
      ajustarCaja(caja, original, marca, dx, dy);
      return;
    }
    caja.x = limitar(original.x + dx, 0, 1 - caja.ancho);
    caja.y = original.y + dy;
    aplicarCaja(caja);
  });

  function terminarGesto(evento) {
    if (!gesto || gesto.id !== evento.pointerId) return;
    if (!gesto.caja) {
      const rect = rectangulo(gesto.inicio, punto(evento));
      seleccion = evento.type === 'pointerup' && rect.ancho * escena.clientWidth >= 4 && rect.alto * escena.clientHeight >= 4
        ? rect : null;
      mostrarMarca(seleccion);
    }
    gesto = null;
    actualizarHerramienta();
  }
  escena.addEventListener('pointerup', terminarGesto);
  escena.addEventListener('pointercancel', terminarGesto);

  const ajustarTexto = () => cajas.forEach(caja => aplicarCaja(caja));
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(ajustarTexto) : null;
  resize?.observe(escena);
  dialogo.addEventListener('close', () => {
    resize?.disconnect();
    mapa?.close();
  }, {once: true});

  form.addEventListener('input', actualizarGuardar);
  form.addEventListener('change', actualizarGuardar);
  form.onsubmit = async evento => {
    evento.preventDefault();
    if (guardando || botonGuardar.disabled) return;
    guardando = true;
    const meta = metaActual();
    const imagenModificada = cambiosImagen();
    for (const control of form.elements) control.disabled = true;
    escena.inert = true;
    estado.textContent = 'Guardando…';
    try {
      let archivo = null;
      if (imagenModificada) {
        if (mapa.width * mapa.height > 16000000) throw new Error('La imagen supera el límite de 16 megapíxeles.');
        await esperarFuentesPreview(escena);
        const salida = dibujarBaseHorario(mapa, Infinity, retoques);
        const contexto = salida.getContext('2d');
        const rect = escena.getBoundingClientRect();
        contexto.scale(salida.width / rect.width, salida.height / rect.height);
        for (const caja of cajas) dibujarCajaTexto(contexto, {stage: escena, target: caja.texto, aplicar: false});
        const blob = await new Promise(resolve => salida.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('No se pudo guardar la imagen.');
        archivo = new File([blob], 'edicion.png', {type: 'image/png'});
      }
      await guardar({...meta, archivo});
      dialogo.close();
    } catch (error) {
      for (const control of form.elements) control.disabled = false;
      escena.inert = false;
      guardando = false;
      actualizarHerramienta();
      estado.textContent = error?.message || 'No se pudo guardar la edición.';
    }
  };

  tapar.disabled = agregar.disabled = cambiarColor.disabled = true;
  dialogo.showModal();
  (async () => {
    const cargada = await cargarMapa(await urlConHorarioFlyer(imagen.version, imagen.url));
    if (!dialogo.open) {
      cargada.close();
      return;
    }
    mapa = cargada;
    escena.style.setProperty('--va-edicion-relacion', String(mapa.width / mapa.height));
    repintar();
    escena.hidden = false;
    tapar.disabled = agregar.disabled = cambiarColor.disabled = false;
    actualizarHerramienta();
  })().catch(error => {
    estado.textContent = error?.message || 'No se pudo abrir la imagen.';
  });
}
