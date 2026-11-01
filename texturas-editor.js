// Mismo dibujo en Biblia, Devocionales, preview y PNG. Sin servicios externos.
const recursos = new Map();
const pendientes = new Map();
const capas = new WeakMap();
const limitar = (n, min, max) => Math.max(min, Math.min(max, n));
const modos = new Set(['auto', 'marco', 'completa', 'repetir', 'cubrir']);

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
  const trabajo=new Promise((resolve,reject)=>{
    const img=new Image(); img.crossOrigin='anonymous'; img.decoding='async';
    const timer=setTimeout(()=>fin(new Error('No pude cargar una textura. Volvé a intentarlo.')),12000);
    function fin(error) {
      clearTimeout(timer); img.onload=img.onerror=null;
      if (error) { reject(error); return; }
      try {
        const factor=Math.min(1,maxSize/Math.max(img.naturalWidth,img.naturalHeight));
        const source=lienzo(img.naturalWidth*factor,img.naturalHeight*factor);
        source.getContext('2d').drawImage(img,0,0,source.width,source.height);
        const recurso={source,...analizarImagen(source),realzada:null,realce:0};
        if(conservar)recursos.set(key,recurso);
        // La caché no retiene todas las texturas grandes de la galería.
        while (recursos.size>4) recursos.delete(recursos.keys().next().value);
        resolve(recurso);
      } catch { reject(new Error('No pude preparar una textura. Comprobá que la imagen permita su uso.')); }
    }
    img.onload=()=>fin(); img.onerror=()=>fin(new Error('No pude cargar una textura. Volvé a intentarlo.'));
    img.src=src;
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
  const intensidad=limitar(Number(opciones.intensidad ?? .22)||0,0,4);
  if (!imagenes.length || !intensidad) return;
  const ajuste=modos.has(opciones.ajuste) ? opciones.ajuste : 'auto';
  const escala=limitar(Number(opciones.escala)||100,25,250)/100;
  const grupo=lienzo(w,h),gctx=grupo.getContext('2d');
  // Igual que CSS: la primera textura elegida es la capa superior.
  [...imagenes].reverse().forEach(img=>dibujarUna(gctx,img,w,h,ajuste,escala,intensidad));
  ctx.save(); ctx.globalAlpha=Math.min(1,intensidad);
  ctx.drawImage(grupo,0,0,w,h); ctx.restore();
  grupo.width=grupo.height=0;
}

export function actualizarCapaTexturas(layer,opciones={}) {
  if (!layer) return Promise.resolve();
  const urls=Array.isArray(opciones.urls) ? opciones.urls.filter(Boolean) : [];
  const w=opciones.width||1080,h=opciones.height||1080;
  const key=JSON.stringify([urls,w,h,opciones.ajuste||'auto',opciones.escala||100,opciones.intensidad??.22]);
  let estado=capas.get(layer);
  if (!estado) { estado={token:0,key:'',promise:Promise.resolve(),error:null,margenes:{left:0,right:0,top:0,bottom:0}}; capas.set(layer,estado); }
  if (estado.key===key) return estado.promise;
  estado.key=key; estado.error=null;
  const token=++estado.token;
  layer.style.backgroundImage='none'; layer.style.opacity='1';
  layer.style.mixBlendMode='normal'; layer.style.filter='none';
  layer.replaceChildren();
  if (!urls.length || Number(opciones.intensidad)===0) {
    estado.margenes={left:0,right:0,top:0,bottom:0};
    layer.style.display='none'; estado.promise=Promise.resolve(); return estado.promise;
  }
  layer.style.display='block';
  estado.promise=Promise.all(urls.map(url=>cargarTextura(url,{
    maxSize:opciones.maxResourceSize,cache:opciones.cacheRecursos!==false
  }))).then(imagenes=>{
    if (estado.token!==token) return;
    const margenes={left:0,right:0,top:0,bottom:0};
    for (const recurso of imagenes) {
      if (opciones.ajuste!=='marco' && !(recurso.marco && (!opciones.ajuste || opciones.ajuste==='auto'))) continue;
      const g=geometriaMarco(recurso.source,w,h,limitar(Number(opciones.escala)||100,25,250)/100);
      margenes.left=margenes.right=Math.max(margenes.left,g.dx*1.05/w+.01);
      margenes.top=margenes.bottom=Math.max(margenes.top,g.dy*.6/h+.01);
    }
    const cambio=JSON.stringify(margenes)!==JSON.stringify(estado.margenes);
    estado.margenes=margenes;
    const canvas=lienzo(w,h);
    canvas.dataset.vaTexturas='1'; canvas.setAttribute('aria-hidden','true');
    Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',pointerEvents:'none'});
    dibujarTexturas(canvas.getContext('2d'),imagenes,w,h,opciones);
    layer.replaceChildren(canvas); layer.dataset.texturasEstado='listo';
    if (cambio) opciones.onReady?.();
  }).catch(error=>{
    if (estado.token===token) { estado.error=error; estado.key=''; layer.dataset.texturasEstado='error'; }
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

export function montarControlesTextura(input,{ajuste='auto',escala=100,intensidad=.22,onChange}={}) {
  if (!input) return;
  Object.assign(input.parentElement.style,{display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'center',height:'auto',minHeight:'16px',overflow:'visible'});
  input.closest('#bibliaDisenoFondos,#dev2DisenoPanel')?.classList.add('va-texturas-panel');
  input.min='0'; input.max='4'; input.step='.01';
  input.value=String(limitar(Number(intensidad)||0,0,4));
  input.setAttribute('aria-label','Intensidad de textura');
  input.title='Intensidad de textura';
  let box=input.parentElement.querySelector('.va-textura-controles');
  if (!box) {
    box=document.createElement('div'); box.className='va-textura-controles';
    box.innerHTML='<label>Ajuste <select aria-label="Ajuste de textura"><option value="auto">Automático</option><option value="marco">Marco</option><option value="completa">Completa</option><option value="repetir">Repetir</option><option value="cubrir">Cubrir</option></select></label><label>Escala <input type="range" min="25" max="250" step="1" aria-label="Escala de textura"></label>';
    input.parentElement.appendChild(box);
    const titulo=document.createElement('span'); titulo.className='va-textura-intensidad'; titulo.textContent='Intensidad';
    input.insertAdjacentElement('beforebegin',titulo);
    const output=document.createElement('output'); output.className='va-textura-valor';
    input.insertAdjacentElement('afterend',output);
    input.addEventListener('input',()=>{output.value=Math.round(Number(input.value)*100)+'%';});
  }
  const select=box.querySelector('select'),range=box.querySelector('input');
  select.value=modos.has(ajuste) ? ajuste : 'auto'; range.value=String(escala);
  input.parentElement.querySelector('output.va-textura-valor').value=Math.round(Number(input.value)*100)+'%';
  select.onchange=range.oninput=()=>onChange?.({ajuste:select.value,escala:Number(range.value)});
  if (!document.getElementById('va-estilos-texturas')) {
    const style=document.createElement('style'); style.id='va-estilos-texturas';
    style.textContent='.va-textura-controles{display:flex;flex:1 0 100%;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap}.va-textura-controles label{display:flex;align-items:center;gap:5px;font:500 11px Arial;color:#234}.va-textura-controles select{max-width:115px;min-height:26px;border:1px solid #ccdce5;border-radius:8px;background:#fff;color:#123;font:12px Arial}.va-textura-controles input{width:105px!important;min-width:65px;max-width:30vw}.va-textura-intensidad,.va-textura-valor{font:11px Arial;color:#234;white-space:nowrap}.va-textura-valor{min-width:30px}.dev2-slider-row:has(.va-textura-controles),.biblia-slider-row:has(.va-textura-controles){display:flex;flex-wrap:wrap;align-items:center;gap:5px;justify-content:center}.dev2-slider-row:has(.va-textura-controles)>input,.biblia-slider-row:has(.va-textura-controles)>input{flex:1;min-width:70px;max-width:220px}';
    document.head.appendChild(style);
    style.textContent+='#modalPersonalizar #bibliaDisenoFondos.va-texturas-panel.tab-textura{height:auto;min-height:0;overflow:visible}';
  }
}
