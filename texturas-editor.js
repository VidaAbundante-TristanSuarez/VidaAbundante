import { cargarImagenDecodificada, indicarCargaPreview } from "./imagen-editor.js?v=20261111-editores-1";

// Mismo dibujo en Biblia, Devocionales, preview y PNG. Sin servicios externos.
const recursos = new Map();
const pendientes = new Map();
const capas = new WeakMap();
const limitar = (n, min, max) => Math.max(min, Math.min(max, n));
const modos = new Set(['auto', 'marco', 'completa', 'repetir', 'cubrir']);
const opacidadInicial = .22;

function normalizarOpacidad(valor) {
  const n = Number(valor ?? opacidadInicial);
  return Number.isFinite(n) ? limitar(n, 0, 4) : opacidadInicial;
}

export function ajustarSeleccionTexturas(estado, urls, enfocada = estado.texturaActiva) {
  estado.texturasUrls = urls;
  estado.texturaUrl = urls[0] || null;
  estado.texturaActiva = urls.includes(enfocada) ? enfocada : estado.texturaUrl;
}

export function alternarTextura(estado, url) {
  const urls = estado.texturasUrls || [];
  if (!url || urls.includes(url)) {
    ajustarSeleccionTexturas(estado, url ? urls.filter(actual => actual !== url) : []);
    return;
  }
  ajustarSeleccionTexturas(estado, [url, ...urls], url);
  ajustarOpacidadTextura(estado, opacidadTexturaActiva(estado));
}

export function prepararTexturasDiseno(estado, urlSegura, intensidadAnterior = opacidadInicial) {
  const urls = estado.texturasUrls || [];
  const individuales = Array.isArray(estado.texturasOpacidades) ? estado.texturasOpacidades : null;
  const valores = new Map(individuales?.filter(item => item?.url).map(item => [item.url, item.opacidad]));
  return {
    urls: urls.map(urlSegura),
    opacidades: individuales ? urls.map(url => normalizarOpacidad(valores.get(url) ?? intensidadAnterior)) : undefined,
    intensidad: normalizarOpacidad(intensidadAnterior),
    ajuste: estado.texturaAjuste || 'auto',
    escala: estado.texturaEscala || 100
  };
}

export function ajustarOpacidadTextura(estado, opacidad) {
  if (!estado.texturaActiva) return;
  const anterior = Array.isArray(estado.texturasOpacidades) ? estado.texturasOpacidades : [];
  estado.texturasOpacidades = [
    ...anterior.filter(item => item?.url && item.url !== estado.texturaActiva),
    {url: estado.texturaActiva, opacidad: normalizarOpacidad(opacidad)}
  ];
}

export function opacidadTexturaActiva(estado, intensidadAnterior = opacidadInicial) {
  const anterior = Array.isArray(estado.texturasOpacidades) ? estado.texturasOpacidades : [];
  return normalizarOpacidad(anterior.find(item => item?.url === estado.texturaActiva)?.opacidad ?? intensidadAnterior);
}

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function analizarImagen(source) {
  const c = lienzo(128, 128), ctx = c.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(source, 0, 0, 128, 128);
  const data = ctx.getImageData(0, 0, 128, 128).data;
  let transparentes = 0;
  const histograma = new Uint32Array(256);
  for (let i=0; i<data.length; i+=4) {
    if (data[i+3] < 245) transparentes++;
    if (data[i+3] > 3) histograma[data[i+3]]++;
  }
  const usaAlpha = transparentes > 128 * 128 * .01;
  let borde=0, centro=0, nb=0, nc=0;
  for (let y=0; y<128; y++) for (let x=0; x<128; x++) {
    const i=(y*128+x)*4;
    const tinta = data[i+3]/255 * (usaAlpha ? 1 : 1-(data[i]+data[i+1]+data[i+2])/765);
    if (x<25 || x>102 || y<25 || y>102) { borde+=tinta; nb++; }
    if (x>44 && x<83 && y>44 && y<83) { centro+=tinta; nc++; }
  }
  let total=histograma.reduce((a,b)=>a+b,0), acumulado=0, alpha95=255;
  for (let a=0; a<256; a++) {
    acumulado+=histograma[a];
    if (total && acumulado>=total*.95) { alpha95=a; break; }
  }
  c.width=c.height=0;
  return {
    marco: borde/nb>.10 && centro/nc < (borde/nb)*.22,
    // Recuperar archivos exportados con todo su canal alfa casi invisible.
    alphaBase: usaAlpha && alpha95<96 ? Math.min(8,180/Math.max(8,alpha95)) : 1
  };
}

export async function cargarTextura(url, opciones = {}) {
  const src=new URL(url, location.href).href;
  const maxSize=limitar(Number(opciones.maxSize)||2048,512,4096);
  const conservar=opciones.cache!==false;
  const key=src+'|'+maxSize;
  if (conservar && recursos.has(key)) {
    const recurso=recursos.get(key); recursos.delete(key); recursos.set(key,recurso);
    return recurso;
  }
  if (pendientes.has(key)) return pendientes.get(key);
  const trabajo=cargarImagenDecodificada(src,{
    cors:true, mensaje:'No pude cargar una textura. Volvé a intentarlo.'
  }).then(img=>{
    try {
      const factor=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));
      const source=lienzo(img.naturalWidth*factor,img.naturalHeight*factor);
      source.getContext('2d').drawImage(img,0,0,source.width,source.height);
      const recurso={source,...analizarImagen(source),realzada:null,realce:0};
      if(conservar)recursos.set(key,recurso);
      // La caché no retiene todas las texturas grandes de la galería.
      while (recursos.size>4) recursos.delete(recursos.keys().next().value);
      return recurso;
    } catch { throw new Error('No pude preparar una textura. Comprobá que la imagen permita su uso.'); }
  }).finally(()=>pendientes.delete(key));
  pendientes.set(key,trabajo);
  return trabajo;
}

function imagenConIntensidad(recurso, intensidad) {
  const fuerza=Math.max(1,intensidad), alphaGain=recurso.alphaBase*fuerza;
  if (alphaGain===1) return recurso.source;
  if (recurso.realzada && recurso.realce===fuerza) return recurso.realzada;
  const source=recurso.source, c=recurso.realzada || lienzo(source.width,source.height);
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height), p=pixels.data;
  const contraste=Math.pow(fuerza,.6);
  for (let i=0;i<p.length;i+=4) {
    if (!p[i+3]) continue;
    p[i+3]=Math.min(255,Math.round(p[i+3]*alphaGain));
    for (let ch=0;ch<3;ch++) p[i+ch]=Math.max(0,255-(255-p[i+ch])*contraste);
  }
  ctx.putImageData(pixels,0,0);
  recurso.realzada=c; recurso.realce=fuerza;
  return c;
}

function geometriaMarco(img,w,h,escala) {
  const sw=img.width,sh=img.height;
  const sx=[0,Math.round(sw*.22),Math.round(sw*.78),sw];
  const sy=[0,Math.round(sh*.22),Math.round(sh*.78),sh];
  // Las cuatro esquinas comparten UNA escala: las flores no se aplastan.
  const factor=Math.min(w/sw,h/sh)*escala;
  const ajuste=Math.min(1,(w*.42)/(sx[1]*factor),(h*.42)/(sy[1]*factor));
  const dx=sx[1]*factor*ajuste,dy=sy[1]*factor*ajuste;
  const xx=[0,dx,w-dx,w],yy=[0,dy,h-dy,h];
  return {sx,sy,xx,yy,dx,dy};
}

function dibujarMarco(ctx,img,w,h,escala) {
  const {sx,sy,xx,yy}=geometriaMarco(img,w,h,escala);
  for (let y=0;y<3;y++) for (let x=0;x<3;x++) {
    ctx.drawImage(img,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],
      xx[x],yy[y],xx[x+1]-xx[x],yy[y+1]-yy[y]);
  }
}

function dibujarUna(ctx,recurso,w,h,ajuste,escala,intensidad) {
  const img=imagenConIntensidad(recurso,intensidad);
  const modo=ajuste==='auto' ? (recurso.marco ? 'marco' : 'completa') : ajuste;
  if (modo==='marco') { dibujarMarco(ctx,img,w,h,escala); return; }
  if (modo==='repetir') {
    const tile=Math.min(w,h)*.5*escala;
    const tw=tile,th=tile*img.height/img.width;
    for(let y=0;y<h;y+=th) for(let x=0;x<w;x+=tw) ctx.drawImage(img,x,y,tw,th);
    return;
  }
  if (modo==='cubrir') {
    const factor=Math.max(w/img.width,h/img.height)*escala;
    const dw=img.width*factor,dh=img.height*factor;
    ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
    return;
  }
  // Completa muestra el archivo entero; el ajuste Marco conserva las esquinas.
  const dw=w*escala,dh=h*escala;
  ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
}

export function dibujarTexturas(ctx,imagenes,w,h,opciones={}) {
  if (!imagenes.length) return;
  const ajuste=modos.has(opciones.ajuste) ? opciones.ajuste : 'auto';
  const escala=limitar(Number(opciones.escala)||100,25,250)/100;
  const capa=lienzo(w,h), dibujo=capa.getContext('2d');
  // Igual que CSS: la primera textura elegida es la capa superior.
  ctx.save();
  if (!opciones.opacidades) {
    // Los diseños que guardaban una opacidad global mantienen su composición.
    const intensidad=normalizarOpacidad(opciones.intensidad);
    if (intensidad) {
      for (let i=imagenes.length-1;i>=0;i--) {
        if (imagenes[i]) dibujarUna(dibujo,imagenes[i],w,h,ajuste,escala,intensidad);
      }
      ctx.globalAlpha=Math.min(1,intensidad);
      ctx.drawImage(capa,0,0,w,h);
    }
    ctx.restore();
    capa.width=capa.height=0;
    return;
  }
  for (let i=imagenes.length-1;i>=0;i--) {
    const opacidad=normalizarOpacidad(opciones.opacidades?.[i] ?? opciones.intensidad);
    if (!imagenes[i] || !opacidad) continue;
    dibujo.clearRect(0,0,w,h);
    dibujarUna(dibujo,imagenes[i],w,h,ajuste,escala,opacidad);
    ctx.globalAlpha=Math.min(1,opacidad);
    ctx.drawImage(capa,0,0,w,h);
  }
  ctx.restore();
  capa.width=capa.height=0;
}

export function actualizarCapaTexturas(layer,opciones={}) {
  if (!layer) return Promise.resolve();
  const urls=Array.isArray(opciones.urls) ? opciones.urls : [];
  const opacidades=urls.map((url,i)=>url ? normalizarOpacidad(opciones.opacidades?.[i] ?? opciones.intensidad) : 0);
  const w=opciones.width||1080,h=opciones.height||1080;
  const key=JSON.stringify([urls,opacidades,!!opciones.opacidades,w,h,opciones.ajuste||'auto',opciones.escala||100,opciones.maxResourceSize]);
  let estado=capas.get(layer);
  if (!estado) { estado={token:0,key:'',promise:Promise.resolve(),error:null,margenes:{left:0,right:0,top:0,bottom:0}}; capas.set(layer,estado); }
  if (estado.key===key) return estado.promise;
  estado.key=key; estado.error=null;
  const token=++estado.token;
  layer.style.backgroundImage='none'; layer.style.opacity='1';
  layer.style.mixBlendMode='normal'; layer.style.filter='none';
  const avisar=mensaje=>{if (opciones.avisar) indicarCargaPreview(layer.parentElement,'texturas',mensaje);};
  if (!opacidades.some(Boolean)) {
    estado.margenes={left:0,right:0,top:0,bottom:0};
    layer.replaceChildren();
    delete layer.dataset.texturasEstado;
    avisar('');
    layer.style.display='none'; estado.promise=Promise.resolve(); return estado.promise;
  }
  layer.style.display='block';
  layer.dataset.texturasEstado='cargando';
  avisar('Cargando textura…');
  const pintar = imagenes => {
    const canvas = lienzo(w, h);
    canvas.dataset.vaTexturas = '1';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', pointerEvents: 'none'});
    dibujarTexturas(canvas.getContext('2d'), imagenes, canvas.width, canvas.height, opciones);
    layer.replaceChildren(canvas);
    layer.dataset.texturasEstado = 'listo';
  };
  estado.promise=Promise.all(urls.map((url,i)=>opacidades[i] ? cargarTextura(url,{
    maxSize:opciones.maxResourceSize,cache:opciones.cacheRecursos!==false
  }) : null)).then(imagenes=>{
    if (estado.token!==token) return;
    const margenes={left:0,right:0,top:0,bottom:0};
    for (const recurso of imagenes) {
      if (!recurso) continue;
      if (opciones.ajuste!=='marco' && !(recurso.marco && (!opciones.ajuste || opciones.ajuste==='auto'))) continue;
      const g=geometriaMarco(recurso.source,w,h,limitar(Number(opciones.escala)||100,25,250)/100);
      margenes.left=margenes.right=Math.max(margenes.left,g.dx*1.05/w+.01);
      margenes.top=margenes.bottom=Math.max(margenes.top,g.dy*.6/h+.01);
    }
    estado.margenes=margenes;
    pintar(imagenes);
    avisar('');
  }).catch(error=>{
    if (estado.token===token) {
      estado.error=error; estado.key=''; layer.dataset.texturasEstado='error';
      avisar('No se pudo cargar la textura.');
    }
    throw error;
  });
  // El error se muestra al intentar continuar/exportar; evitar rechazos sin manejar.
  estado.promise.catch(()=>{});
  return estado.promise;
}

export async function esperarCapaTexturas(layer) {
  if (!layer) return;
  let estado=capas.get(layer);
  while (estado) {
    const trabajo=estado.promise;
    try { await trabajo; } catch (error) { if (trabajo===estado.promise) throw error; }
    if (estado.error) throw estado.error;
    if (trabajo===estado.promise) return;
    estado=capas.get(layer);
  }
}

export function margenesTexturas(layer) {
  return capas.get(layer)?.margenes || {left:0,right:0,top:0,bottom:0};
}

function prepararPasoTextura(grupo, alCambiar) {
  const campo = grupo.querySelector('input');
  const [menos, mas] = grupo.querySelectorAll('button');
  const min = Number(campo.min);
  const max = Number(campo.max);
  let confirmado;

  function mostrar(numero, deshabilitado = false) {
    confirmado = limitar(Math.round(numero), min, max);
    campo.value = String(confirmado);
    campo.disabled = deshabilitado;
    menos.disabled = deshabilitado || confirmado === min;
    mas.disabled = deshabilitado || confirmado === max;
  }

  function cambiar(numero) {
    const anterior = confirmado;
    mostrar(Number.isFinite(numero) ? numero : anterior);
    if (confirmado !== anterior) alCambiar(confirmado);
  }

  menos.onclick = () => cambiar(confirmado - 5);
  mas.onclick = () => cambiar(confirmado + 5);
  campo.onchange = () => cambiar(campo.valueAsNumber);
  return mostrar;
}

export function montarControlesTextura(input, {
  ajuste = 'auto', escala = 100, opacidad = opacidadInicial, activa = false,
  onChange, onOpacidad
} = {}) {
  if (!input) return;
  const fila = input.parentElement;
  fila.classList.add('va-textura-fila');
  input.closest('#bibliaDisenoFondos,#dev2DisenoPanel')?.classList.add('va-texturas-panel');

  if (!fila.__vaControlesTextura) {
    const box = document.createElement('div');
    box.className = 'va-textura-controles';
    box.innerHTML = `
      <label class="va-textura-ajuste">Ajuste
        <select aria-label="Ajuste de textura">
          <option value="auto">Automático</option>
          <option value="marco">Marco</option>
          <option value="completa">Completa</option>
          <option value="repetir">Repetir</option>
          <option value="cubrir">Cubrir</option>
        </select>
      </label>
      ${[['Opacidad', 0, 400], ['Escala', 25, 250]].map(([nombre, min, max]) => `
        <div class="va-textura-paso" role="group" aria-label="${nombre} de textura">
          <span>${nombre}</span>
          <div class="va-textura-paso-botones">
            <button type="button" aria-label="Bajar ${nombre.toLowerCase()} de textura">−</button>
            <label class="va-textura-porcentaje">
              <input type="number" inputmode="numeric" min="${min}" max="${max}" step="1" aria-label="${nombre} de textura en porcentaje">
              <span aria-hidden="true">%</span>
            </label>
            <button type="button" aria-label="Subir ${nombre.toLowerCase()} de textura">+</button>
          </div>
        </div>`).join('')}
    `;
    fila.appendChild(box);
    const select = box.querySelector('select');
    const [opacidadGrupo, escalaGrupo] = box.querySelectorAll('.va-textura-paso');
    const controles = {select, escala: 100};
    const notificar = () => controles.onChange?.({ajuste: select.value, escala: controles.escala});
    controles.mostrarOpacidad = prepararPasoTextura(opacidadGrupo, valor => controles.onOpacidad?.(valor / 100));
    controles.mostrarEscala = prepararPasoTextura(escalaGrupo, valor => {
      controles.escala = valor;
      notificar();
    });
    select.onchange = notificar;
    fila.__vaControlesTextura = controles;
  }

  const controles = fila.__vaControlesTextura;
  controles.onChange = onChange;
  controles.onOpacidad = onOpacidad;
  controles.select.value = modos.has(ajuste) ? ajuste : 'auto';
  controles.escala = limitar(Number(escala) || 100, 25, 250);
  controles.mostrarOpacidad(normalizarOpacidad(opacidad) * 100, !activa);
  controles.mostrarEscala(controles.escala);

  if (document.getElementById('va-estilos-texturas')) return;
  const style = document.createElement('style');
  style.id = 'va-estilos-texturas';
  style.textContent = `
    .va-texturas-panel .va-textura-fila{display:flex!important;justify-content:center;height:auto!important;overflow:visible!important;padding:4px 0}
    .va-textura-controles{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:6px 12px;font:600 12px/1.2 Arial,sans-serif;color:#234}
    .va-textura-paso,.va-textura-controles .va-textura-ajuste{display:flex!important;flex-direction:row!important;align-items:center;gap:5px;white-space:nowrap;margin:0!important}
    .va-textura-ajuste select{width:110px;max-width:110px;height:32px;border:1px solid #c6d9e7;border-radius:8px;background:#fff;color:#234;font:12px Arial}
    .va-textura-paso-botones{display:flex;align-items:center;gap:2px;border:1px solid #c6d9e7;border-radius:9px;background:#fff}
    .va-textura-paso-botones button{display:grid;place-items:center;width:30px;min-width:30px;height:30px;padding:0;border:0;border-radius:8px;background:#e5f2fc;color:#224e70;font:700 16px/1 Arial;cursor:pointer}
    .va-textura-paso-botones button:disabled{opacity:.38;cursor:default}
    :is(#modalPersonalizar,#modalDevFase2) .va-textura-opcion[aria-current=true],.va-galeria-cuadricula button[aria-current=true]{box-shadow:inset 0 0 0 3px #2876b6;outline:2px solid #2876b6;outline-offset:-2px}
    :is(#modalPersonalizar,#modalDevFase2) .va-textura-porcentaje{display:flex!important;flex-direction:row!important;align-items:center;gap:0!important;margin:0!important;padding:0 3px 0 0!important;font-size:11px;color:#234}
    :is(#modalPersonalizar,#modalDevFase2) .va-textura-porcentaje input{width:25px!important;min-width:0!important;height:24px!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;background:transparent!important;color:inherit!important;text-align:right;font:inherit;appearance:textfield}
    .va-textura-porcentaje input::-webkit-inner-spin-button,.va-textura-porcentaje input::-webkit-outer-spin-button{appearance:none;margin:0}
    body.oscuro .va-textura-controles,body.oscuro :is(#modalPersonalizar,#modalDevFase2) .va-textura-porcentaje{color:#e6f2ff}
    body.oscuro .va-textura-paso-botones,body.oscuro .va-textura-ajuste select{background:#263e52;border-color:#57748b;color:#e6f2ff}
    #modalPersonalizar #bibliaDisenoFondos.va-texturas-panel.tab-textura{height:auto;min-height:0;overflow:visible}
    @media(max-width:520px){
      .va-textura-controles{display:grid;grid-template-columns:auto auto}
      .va-textura-controles .va-textura-ajuste{grid-column:1/-1;justify-self:center}
    }
    @media(max-width:355px){
      .va-textura-paso{flex-direction:column!important;gap:3px}
    }
  `;
  document.head.appendChild(style);
}
