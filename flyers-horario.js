import { normalizarUrlImagen, obtenerBlobImagen, urlMiniaturaImagen } from './carga-imagenes.js?v=20261110-carga-2';

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

function dibujarBaseHorario(mapa, lado, parches = []) {
  const escala = Math.min(1, lado / Math.max(mapa.width, mapa.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(mapa.width * escala));
  canvas.height = Math.max(1, Math.round(mapa.height * escala));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(mapa, 0, 0, canvas.width, canvas.height);
  for (const {x, y, ancho, alto, muestra, color} of parches) {
    const izq = Math.round(x * canvas.width);
    const arriba = Math.round(y * canvas.height);
    const w = Math.round((x + ancho) * canvas.width) - izq;
    const h = Math.round((y + alto) * canvas.height) - arriba;
    ctx.clearRect(izq, arriba, w, h);
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(izq, arriba, w, h);
    } else {
      const fuenteX = Math.max(0, Math.min(1 - ancho, muestra.x - ancho / 2));
      const fuenteY = Math.max(0, Math.min(1 - alto, muestra.y - alto / 2));
      ctx.drawImage(mapa, fuenteX * mapa.width, fuenteY * mapa.height, ancho * mapa.width, alto * mapa.height, izq, arriba, w, h);
    }
  }
  return canvas;
}

async function componer(mapa, plantilla, horario, lado, parches) {
  const canvas = dibujarBaseHorario(mapa, lado, parches);
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

function modalHorario(titulo) {
  const anterior = document.querySelector('.va-horario-dialog[open]');
  if (anterior) return null;
  const dialogo = document.createElement('dialog');
  dialogo.className = 'va-horario-dialog';
  dialogo.setAttribute('aria-labelledby', 'vaHorarioTitulo');
  dialogo.innerHTML = `<header><h2 id="vaHorarioTitulo">${esc(titulo)}</h2>
    <button type="button" class="va-horario-cerrar" aria-label="Cerrar">×</button></header>`;
  const foco = document.activeElement;
  const viewport = window.visualViewport;
  const ajustarViewport = () => {
    dialogo.style.setProperty('--va-horario-vw', viewport.width + 'px');
    dialogo.style.setProperty('--va-horario-vh', viewport.height + 'px');
    dialogo.style.setProperty('--va-horario-cx', (viewport.offsetLeft + viewport.width / 2) + 'px');
    dialogo.style.setProperty('--va-horario-cy', (viewport.offsetTop + viewport.height / 2) + 'px');
  };
  if (viewport) {
    ajustarViewport();
    viewport.addEventListener('resize', ajustarViewport);
    viewport.addEventListener('scroll', ajustarViewport);
  }
  dialogo.addEventListener('close', () => {
    viewport?.removeEventListener('resize', ajustarViewport);
    viewport?.removeEventListener('scroll', ajustarViewport);
    dialogo.remove();
    foco?.focus?.();
  });
  dialogo.querySelector('.va-horario-cerrar').onclick = () => dialogo.close();
  document.body.appendChild(dialogo);
  return dialogo;
}

export function elegirImagenHorarioFlyer(imagenes) {
  if (imagenes.length <= 1) return Promise.resolve(imagenes[0] || null);
  const dialogo = modalHorario('Elegir imagen del flyer');
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
    const {url, miniaturaUrl} = seleccion();
    img.onerror = () => { img.onerror = null; img.src = url; };
    img.src = urlMiniaturaImagen(url, miniaturaUrl);
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

function conectarFormulario(dialogo, {leer, cargar, guardar, alPintar}) {
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
      const nuevo = await componer(imagen, datos.plantilla, datos.soloFondo ? {} : datos.horario, 760, datos.parches);
      if (id !== revision || !dialogo.open) return false;
      lienzo.width = nuevo.width;
      lienzo.height = nuevo.height;
      lienzo.getContext('2d').drawImage(nuevo, 0, 0);
      lienzo.hidden = false;
      alPintar?.(form);
      const hora = datos.horario.hora;
      estado.textContent = hora.length === 5 && !FORMATO_HORA.test(hora)
        ? 'Ingresá una hora de 00:00 a 23:59.'
        : datos.aviso || '';
      const valido = !datos.aviso && horarioValido(datos.horario.dia, hora) &&
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
    form.dataset.guardando = '1';
    for (const control of form.elements) control.disabled = true;
    let valido = false;
    try {
      valido = await pintar();
      if (!valido) return;
      estado.textContent = 'Guardando…';
      await guardar(leer(form), form, mapa);
      dialogo.close();
    } catch (error) {
      estado.textContent = error.code === 'PERMISSION_DENIED' || /permission.denied/i.test(error.message)
        ? 'Firebase rechazó el guardado. Revisá el permiso de edición de horarios.'
        : error.message || 'No se pudo guardar. Probá de nuevo.';
    } finally {
      guardando = false;
      delete form.dataset.guardando;
      if (dialogo.open) {
        for (const control of form.elements) control.disabled = false;
        guardarBtn.disabled = !valido;
      }
    }
  };
  return {
    pintar,
    invalidarMapa() {
      cargaMapa = null;
      mapa?.close();
      mapa = null;
      return pintar();
    }
  };
}

export function abrirEdicionHorarioFlyer(config, guardar) {
  if (!config || !puedeEditarDiaHora()) return;
  const {plantilla, versiones} = config;
  const ultimoId = Object.keys(versiones || {}).sort().at(-1);
  const actual = versiones?.[ultimoId] || {dia: plantilla.diaInicial, hora: plantilla.horaInicial};
  const dialogo = modalHorario('Editar día y hora');
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

function campoNumero(nombre, valor, min, max, paso = '0.1') {
  return `<input name="${nombre}" type="number" value="${esc(valor)}" min="${min}" max="${max}" step="${paso}">`;
}

function bloqueCampos(tipo, bloque = {}) {
  const etiqueta = tipo === 'Dia' ? 'Día' : 'Hora';
  return `<fieldset><legend>${etiqueta}</legend>
    <label>Posición X (%)${campoNumero('x' + tipo, bloque.inactivo ? '' : bloque.x ?? '', 2, 98)}</label>
    <label>Posición Y (%)${campoNumero('y' + tipo, bloque.inactivo ? '' : bloque.y ?? '', 2, 98)}</label>
    <label>Tipografía<select name="fuente${tipo}">${FUENTES.map(fuente => `<option${fuente === bloque.fuente ? ' selected' : ''}>${fuente}</option>`).join('')}</select></label>
    <label>Peso<select name="peso${tipo}"><option value="400">Regular</option><option value="700"${bloque.peso === 700 || bloque.peso === undefined ? ' selected' : ''}>Negrita</option></select></label>
    <label>Tamaño (%)${campoNumero('tamano' + tipo, bloque.tamano ?? 7, 1, 30)}</label>
    <label>Ancho disponible (%)${campoNumero('ancho' + tipo, bloque.ancho ?? 65, 5, 100)}</label>
    <label>Alineación<select name="alineacion${tipo}">
      ${[['center', 'Centro'], ['left', 'Izquierda'], ['right', 'Derecha']].map(([valor, etiqueta]) =>
        `<option value="${valor}"${valor === bloque.alineacion ? ' selected' : ''}>${etiqueta}</option>`).join('')}
    </select></label>
    <label>Color<input type="color" name="color${tipo}" value="${esc(bloque.color || '#172a3c')}"></label>
  </fieldset>`;
}

function leerBloque(form, tipo) {
  const campo = nombre => form.elements[nombre + tipo];
  const x = campo('x').valueAsNumber;
  const y = campo('y').valueAsNumber;
  const inactivo = Number.isNaN(x) && Number.isNaN(y);
  return {
    x: inactivo ? 50 : x, y: inactivo ? 50 : y, inactivo,
    fuente: campo('fuente').value, peso: Number(campo('peso').value),
    color: campo('color').value, tamano: campo('tamano').valueAsNumber,
    ancho: campo('ancho').valueAsNumber, alineacion: campo('alineacion').value,
    ...(tipo === 'Hora' ? {omitirMinutos: form.elements.omitirMinutos.value === 'si'} : {})
  };
}

function marcoDelFlyer(lienzo) {
  const rect = lienzo.getBoundingClientRect();
  const escala = Math.min(rect.width / lienzo.width, rect.height / lienzo.height);
  const ancho = lienzo.width * escala;
  const alto = lienzo.height * escala;
  return {x: rect.left + (rect.width - ancho) / 2, y: rect.top + (rect.height - alto) / 2, ancho, alto};
}

function puntoDelFlyer(evento, lienzo) {
  const marco = marcoDelFlyer(lienzo);
  return {x: (evento.clientX - marco.x) / marco.ancho, y: (evento.clientY - marco.y) / marco.alto};
}

function conectarLimpiezaHorario(form, parches, pintar) {
  const lienzo = form.querySelector('canvas');
  const barra = form.querySelector('[data-limpieza]');
  const guia = form.querySelector('[data-marca]');
  const deshacer = form.querySelector('[data-deshacer]');
  const mensaje = barra.querySelector('[data-ayuda-limpieza]');
  const activo = () => form.elements.ubicar.value === 'Limpiar';
  let inicio, seleccion, puntero;
  const dentro = p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
  const limitar = v => Math.max(0, Math.min(1, v));
  const recuadro = (a, b) => {
    const x = limitar(b.x), y = limitar(b.y);
    return {x: Math.min(a.x, x), y: Math.min(a.y, y), ancho: Math.abs(a.x - x), alto: Math.abs(a.y - y)};
  };

  function mostrarMarca(rect) {
    guia.hidden = !rect || lienzo.hidden;
    if (guia.hidden) return;
    const marco = marcoDelFlyer(lienzo);
    const cont = guia.parentElement.getBoundingClientRect();
    Object.assign(guia.style, {
      left: (marco.x - cont.left + rect.x * marco.ancho) + 'px',
      top: (marco.y - cont.top + rect.y * marco.alto) + 'px',
      width: (rect.ancho * marco.ancho) + 'px',
      height: (rect.alto * marco.alto) + 'px'
    });
  }

  function actualizar() {
    barra.hidden = !activo();
    lienzo.classList.toggle('va-horario-canvas-limpieza', activo());
    deshacer.disabled = Boolean(form.dataset.guardando) || (!seleccion && parches.length === 0);
    mensaje.textContent = seleccion
      ? 'Tocá una zona limpia del fondo para cubrir el horario.'
      : 'Arrastrá un recuadro sobre el horario anterior.';
    mostrarMarca(activo() ? seleccion : null);
  }

  lienzo.addEventListener('pointerdown', evento => {
    if (!activo() || puntero !== undefined || form.dataset.guardando || evento.button !== 0) return;
    const punto = puntoDelFlyer(evento, lienzo);
    if (!dentro(punto)) return;
    evento.preventDefault();
    puntero = evento.pointerId;
    inicio = punto;
    lienzo.setPointerCapture(puntero);
  });
  lienzo.addEventListener('pointermove', evento => {
    if (evento.pointerId === puntero && !seleccion) mostrarMarca(recuadro(inicio, puntoDelFlyer(evento, lienzo)));
  });
  lienzo.addEventListener('pointerup', evento => {
    if (evento.pointerId !== puntero) return;
    puntero = undefined;
    const punto = puntoDelFlyer(evento, lienzo);
    if (seleccion) {
      if (!dentro(punto)) return;
      const parche = {...seleccion, muestra: punto};
      if (form.elements.relleno.value === 'color') {
        const x = Math.min(lienzo.width - 1, Math.floor(punto.x * lienzo.width));
        const y = Math.min(lienzo.height - 1, Math.floor(punto.y * lienzo.height));
        const [r, g, b, a] = lienzo.getContext('2d').getImageData(x, y, 1, 1).data;
        parche.color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
      }
      parches.push(parche);
      seleccion = null;
    } else {
      const rect = recuadro(inicio, punto);
      const marco = marcoDelFlyer(lienzo);
      if (rect.ancho * marco.ancho >= 3 && rect.alto * marco.alto >= 3) seleccion = rect;
    }
    actualizar();
    pintar();
  });
  lienzo.addEventListener('pointercancel', evento => {
    if (evento.pointerId !== puntero) return;
    puntero = undefined;
    actualizar();
  });
  deshacer.onclick = () => {
    if (seleccion) seleccion = null;
    else parches.pop();
    actualizar();
    pintar();
  };
  form.addEventListener('change', evento => {
    if (evento.target.name !== 'ubicar') return;
    if (!activo()) seleccion = null;
    actualizar();
    pintar();
  });
  return {
    actualizar,
    pendiente: () => Boolean(seleccion),
    reiniciar() {
      seleccion = null;
      parches.length = 0;
      actualizar();
    }
  };
}

async function archivoDeBaseLimpia(mapa, parches) {
  if (mapa.width * mapa.height > 16000000) throw new Error('La imagen supera el límite de 16 megapíxeles para preparar el horario.');
  const canvas = dibujarBaseHorario(mapa, Infinity, parches);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo preparar la imagen limpia.');
  return new File([blob], 'flyer-sin-horario.png', {type: 'image/png'});
}

export function abrirPreparacionHorarioFlyer(original, config, guardar) {
  if (!window.__UID || !window.__ES_ADMIN || !original) return;
  const anterior = config?.plantilla;
  const dialogo = modalHorario('Preparar día y hora');
  if (!dialogo) return;
  dialogo.classList.add('va-horario-preparacion');
  dialogo.insertAdjacentHTML('beforeend', `<form>
    <p>Quitá el horario sobre el flyer que ya está en la ficha. Si querés poner otro, ubicá solo los textos que uses.</p>
    <div class="va-horario-ubicar">
      <label><input type="radio" name="ubicar" value="Limpiar"${anterior ? '' : ' checked'}> Limpiar horario</label>
      <label><input type="radio" name="ubicar" value="Dia"${anterior ? ' checked' : ''}> Ubicar día</label>
      <label><input type="radio" name="ubicar" value="Hora"> Ubicar hora</label>
      <button type="button" data-original>Ver original</button>
    </div>
    <div class="va-horario-limpieza" data-limpieza hidden>
      <div class="va-horario-ubicar">
        <select name="relleno" aria-label="Cómo cubrir el horario">
          <option value="copiar">Copiar fondo</option><option value="color">Tomar color</option>
        </select>
        <button type="button" data-deshacer disabled>Deshacer</button>
      </div>
      <p data-ayuda-limpieza aria-live="polite"></p>
    </div>
    <div class="va-horario-preview">
      <canvas aria-label="Flyer editable" hidden></canvas><img alt="Flyer original" hidden>
      <div class="va-horario-marca" data-marca hidden></div>
    </div>
    ${camposHorario(anterior?.diaInicial, anterior?.horaInicial || '')}
    <details class="va-horario-opciones" data-estilo-horario>
      <summary>Tipografía y posición</summary>
      <div class="va-horario-bloques">
        ${bloqueCampos('Dia', anterior?.dia)}
        ${bloqueCampos('Hora', anterior?.hora)}
      </div>
      <div class="va-horario-valores">
        <label>Formato del día<select name="formatoDia"><option value="inicial">Lunes</option><option value="mayusculas">LUNES</option><option value="minusculas">lunes</option></select></label>
        <label>Formato de la hora<select name="formatoHora"><option value="dosPuntos">09:30</option><option value="sinCero">9:30</option><option value="punto">09.30</option></select></label>
        <label>Antes del día<input name="prefijoDia" type="text" maxlength="20" value="${esc(anterior?.prefijoDia || '')}"></label>
        <label>Después de la hora<input name="sufijoHora" type="text" maxlength="10" value="${esc(anterior?.sufijoHora || '')}"></label>
        <label>Minutos<select name="omitirMinutos"><option value="no">Mostrar siempre</option>
          <option value="si"${anterior?.hora.omitirMinutos ? ' selected' : ''}>Ocultar :00 en punto</option>
        </select></label>
      </div>
    </details>
    <details class="va-horario-opciones">
      <summary>Usar una imagen limpia de otro archivo</summary>
      <label>Imagen con espacios limpios<input name="archivo" type="file" accept="image/png,image/jpeg,image/webp"></label>
    </details>
    <p class="va-horario-estado" role="status">Abriendo la imagen…</p>
    <footer><button type="button" data-cancelar>Cancelar</button>
      <button type="submit" class="va-horario-primario" disabled>${anterior ? 'Guardar plantilla' : 'Guardar como nueva'}</button></footer>
  </form>`);
  const form = dialogo.querySelector('form');
  form.elements.formatoDia.value = anterior?.formatoDia || 'inicial';
  form.elements.formatoHora.value = anterior?.formatoHora || 'dosPuntos';
  const lienzo = form.querySelector('canvas');
  const originalVisible = form.querySelector('img');
  const botonOriginal = form.querySelector('[data-original]');
  const parches = [];
  const leer = form => {
    const horario = {dia: form.elements.dia.value, hora: form.elements.hora.value};
    const dia = leerBloque(form, 'Dia'), hora = leerBloque(form, 'Hora');
    const soloFondo = form.elements.ubicar.value === 'Limpiar';
    let aviso = '';
    if (limpieza.pendiente()) aviso = 'Elegí de dónde copiar el fondo o deshacé la selección.';
    else if (!anterior && !form.elements.archivo.files.length && !parches.length) aviso = 'Marcá y cubrí primero el horario anterior.';
    else if (horario.dia && dia.inactivo) aviso = 'Tocá Ubicar día y marcá dónde va el texto.';
    else if (horario.hora && hora.inactivo) aviso = 'Tocá Ubicar hora y marcá dónde van los números.';
    else if (soloFondo && (horario.dia || horario.hora)) aviso = 'Volvé a Ubicar día u hora para revisar el resultado.';
    return {
      plantilla: {
        original, dia, hora,
        baseUrl: anterior?.baseUrl || '', baseMiniaturaUrl: anterior?.baseMiniaturaUrl || '',
        formatoDia: form.elements.formatoDia.value, formatoHora: form.elements.formatoHora.value,
        prefijoDia: form.elements.prefijoDia.value, sufijoHora: form.elements.sufijoHora.value
      },
      horario, soloFondo, aviso, parches: [...parches]
    };
  };
  const controles = conectarFormulario(dialogo, {
    leer,
    async cargar(form) {
      const archivo = form.elements.archivo.files[0];
      if (!archivo) return cargarMapa(anterior?.baseUrl || original);
      if (archivo.size > 20 * 1024 * 1024) throw new Error('Elegí una imagen de hasta 20 MB.');
      const mapa = await createImageBitmap(archivo);
      try {
        if (mapa.width * mapa.height > 16000000) throw new Error('Elegí una imagen de hasta 16 megapíxeles.');
        const referencia = await cargarMapa(original);
        const proporcion = referencia.width / referencia.height;
        referencia.close();
        if (Math.abs(mapa.width / mapa.height / proporcion - 1) > .01) {
          throw new Error('La imagen limpia tiene que tener la misma proporción que el original.');
        }
        return mapa;
      } catch (error) { mapa.close(); throw error; }
    },
    async guardar(datos, form, mapa) {
      const archivo = datos.parches.length ? await archivoDeBaseLimpia(mapa, datos.parches) : form.elements.archivo.files[0];
      return guardar(datos.plantilla, datos.horario, archivo);
    },
    alPintar() {
      originalVisible.hidden = true;
      botonOriginal.textContent = 'Ver original';
      limpieza.actualizar();
    }
  });
  const limpieza = conectarLimpiezaHorario(form, parches, controles.pintar);
  lienzo.addEventListener('click', evento => {
    const tipo = form.elements.ubicar.value;
    if (tipo === 'Limpiar' || form.dataset.guardando) return;
    const {x, y} = puntoDelFlyer(evento, lienzo);
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    const porcentaje = valor => Math.max(2, Math.min(98, valor * 100)).toFixed(1);
    form.elements['x' + tipo].value = porcentaje(x);
    form.elements['y' + tipo].value = porcentaje(y);
    form.elements.ubicar.value = tipo === 'Dia' ? 'Hora' : 'Dia';
    controles.pintar();
  });
  botonOriginal.onclick = () => {
    if (!originalVisible.hidden) {
      originalVisible.hidden = true;
      controles.pintar();
      return;
    }
    originalVisible.src = original;
    originalVisible.hidden = false;
    lienzo.hidden = true;
    limpieza.actualizar();
    botonOriginal.textContent = 'Volver a la vista previa';
  };
  form.elements.archivo.addEventListener('change', () => {
    form.elements.ubicar.value = form.elements.archivo.files.length || anterior ? 'Dia' : 'Limpiar';
    limpieza.reiniciar();
    controles.invalidarMapa();
  });
  dialogo.showModal();
  limpieza.actualizar();
  controles.pintar();
}
