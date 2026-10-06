// Utilidades compartidas por las dos pantallas. No requiere librerías nuevas.
const pendientes = new Map();
const blobs = new Map();
const MAX_BLOBS = 6;
const MAX_BYTES = 24 * 1024 * 1024;
let bytesEnMemoria = 0;
let guardarUsoRemoto = null;

const claveUso = () => `va_fondos_uso_v1_${window.__UID || 'visitante'}`;
const claveFondo = url => {
  try { return new URL(url, location.href).href; } catch { return String(url); }
};
function leerUso() {
  try { return JSON.parse(localStorage.getItem(claveUso()) || '{}') || {}; }
  catch { return {}; }
}
export function configurarUsoFondos(guardar) { guardarUsoRemoto = guardar; }
export function combinarUsoFondos(remoto) {
  const uso = leerUso();
  for (const seccion of ['biblia', 'devocionales']) {
    uso[seccion] ||= {};
    for (const [url, fecha] of Object.entries(remoto?.[seccion] || {})) {
      uso[seccion][url] = Math.max(Number(uso[seccion][url]) || 0, Number(fecha) || 0);
    }
  }
  try { localStorage.setItem(claveUso(), JSON.stringify(uso)); } catch {}
}
export function ordenarFondos(lista, seccion) {
  const uso = leerUso()[seccion] || {};
  return [...lista].sort((a, b) => (Number(uso[claveFondo(a)]) || 0) - (Number(uso[claveFondo(b)]) || 0));
}
export function registrarUsoFondo(url, seccion) {
  const uso = leerUso();
  uso[seccion] ||= {};
  const key = claveFondo(url);
  const fecha = Math.max(Date.now(), ...Object.values(uso[seccion]).map(x => (Number(x) || 0) + 1));
  uso[seccion][key] = fecha;
  try { localStorage.setItem(claveUso(), JSON.stringify(uso)); } catch {}
  // Un registro por selección, sin volver a escribir la configuración completa.
  try { Promise.resolve(guardarUsoRemoto?.(seccion, key, fecha)).catch(() => {}); } catch {}
}
export function urlFondoSeguro(url, workerUrl) {
  const abs = new URL(url, location.href);
  const worker = new URL(workerUrl);
  if (/^(blob:|data:)/i.test(url) || abs.origin === location.origin || abs.origin === worker.origin) return url;
  worker.searchParams.set('url', abs.href);
  worker.searchParams.set('nombre', 'fondo.png');
  worker.searchParams.set('descargar', '0');
  return worker.href;
}
export async function cargarFondoBlob(url) {
  const key = claveFondo(url);
  if (blobs.has(key)) {
    const blob = blobs.get(key);
    blobs.delete(key); blobs.set(key, blob);
    return URL.createObjectURL(blob);
  }
  if (!pendientes.has(key)) {
    const tarea = (async () => {
      let cache;
      try { cache = await caches.open('va-fondos-imagen-v1'); } catch {}
      let respuesta = await cache?.match(key);
      if (!respuesta) {
        respuesta = await fetch(key, { cache: 'force-cache' });
        if (!respuesta.ok) throw new Error(`Fondo no disponible (HTTP ${respuesta.status})`);
        if (cache && respuesta.type !== 'opaque') {
          const copia = respuesta.clone();
          // La escritura de caché no retrasa el fondo elegido.
          (async () => {
            await cache.put(key, copia);
            const keys = await cache.keys();
            for (const old of keys.slice(0, Math.max(0, keys.length - 24))) await cache.delete(old);
          })().catch(() => {});
        }
      }
      const blob = await respuesta.blob();
      if (!blob.size) throw new Error('El fondo se recibió vacío.');
      if (blob.size <= MAX_BYTES) {
        blobs.set(key, blob); bytesEnMemoria += blob.size;
        while (blobs.size > MAX_BLOBS || bytesEnMemoria > MAX_BYTES) {
          const primera = blobs.keys().next().value;
          bytesEnMemoria -= blobs.get(primera).size; blobs.delete(primera);
        }
      }
      return blob;
    })().finally(() => pendientes.delete(key));
    pendientes.set(key, tarea);
  }
  return URL.createObjectURL(await pendientes.get(key));
}
export function prepararMiniaturas(cont) {
  cont.__vaFondosObserver?.disconnect();
  let observer;
  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.vaSrc; observer.unobserve(img);
      }
    }, { root: cont, rootMargin: '180px', threshold: 0 });
    cont.__vaFondosObserver = observer;
  }
  return (img, url, indice) => {
    img.decoding = 'async'; img.loading = indice < 4 ? 'eager' : 'lazy';
    img.fetchPriority = indice < 4 ? 'high' : 'low';
    img.dataset.vaSrc = url;
    if (indice < 4 || !observer) img.src = url;
    else observer.observe(img);
  };
}

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
let activo = null;
function instalarEstilos() {
  if (document.getElementById('va-editor-style')) return;
  const style = document.createElement('style');
  style.id = 'va-editor-style';
  style.textContent = `
    .va-editor-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0;color:#172535;background:#eff6ff;padding:8px;border-radius:12px;font:14px Arial,sans-serif;}
    .va-editor-tools button,.va-editor-tools select,.va-editor-tools input{font:inherit;color:#172535;background:#fff;border:1px solid #8ba7c5;border-radius:8px;padding:6px;min-height:34px;}
    .va-editor-tools input[type=number]{width:65px;}.va-editor-tools input[type=color]{width:38px;padding:2px;}
    .va-editor-tools button.activo{background:#c7e3ff;border-color:#236dc0;}.va-editor-tools select{max-width:140px;}
    .va-editor-hint{flex-basis:100%;font-size:12px;line-height:1.35;color:#263e56;}
    .va-editor-content{overflow-wrap:anywhere!important;min-width:0;outline:none;}
    .va-editor-content div,.va-editor-content p{max-width:100%;line-height:inherit;}
    .va-editor-content span{line-height:inherit;}
    .va-editor-content span[style*="font-"]{line-height:1.25;}
    .va-editor-content:not(.va-editor-back) span{-webkit-text-fill-color:currentColor;}
    .va-editor-back{pointer-events:none;}
    .va-editor-content[contenteditable=true]{touch-action:auto;user-select:text!important;-webkit-user-select:text!important;cursor:text!important;}
    .va-editor-content .preview-biblia-cita{white-space:normal!important;display:inline!important;}
    .va-editor-outline{position:absolute;z-index:40;border:1px solid #2374dc;pointer-events:none;box-sizing:border-box;}
    .va-editor-handle{position:absolute!important;padding:0!important;border:2px solid #2374dc!important;border-radius:5px!important;background:#fff!important;width:18px!important;height:18px!important;min-width:0!important;min-height:0!important;pointer-events:auto;touch-action:none;}
    .va-editor-guide{position:absolute;background:#e22332;pointer-events:none;z-index:39;}
    .va-editor-guide.vertical{top:0;bottom:0;width:1px;left:50%;}.va-editor-guide.horizontal{left:0;right:0;height:1px;top:50%;}
    .va-editor-overlay[hidden]{display:none!important;}
    .va-rich-highlight{background:var(--va-rich-highlight-color,transparent);box-shadow:var(--va-rich-highlight-spread,0px) 0 0 var(--va-rich-highlight-color,transparent),calc(-1 * var(--va-rich-highlight-spread,0px)) 0 0 var(--va-rich-highlight-color,transparent);border-radius:999px;box-decoration-break:clone;-webkit-box-decoration-break:clone;}
  `;
  document.head.appendChild(style);
}
function copiarHTMLSeguro(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const permitidos = new Set(['SPAN','DIV','P','BR','B','STRONG','I','EM','U']);
  function limpiar(root) {
    for (const el of [...root.children]) {
      if (['SCRIPT','STYLE','IFRAME','OBJECT','IMG','SVG'].includes(el.tagName)) { el.remove(); continue; }
      limpiar(el);
      if (!permitidos.has(el.tagName)) { el.replaceWith(...el.childNodes); continue; }
      const css = el.style;
      const guardado = {};
      for (const p of ['fontSize','fontFamily','fontWeight','fontStyle','textDecoration','textTransform','color','marginTop','width']) {
        const value = css[p];
        if (value && !/url\(|expression|javascript|var\(/i.test(value)) guardado[p] = value;
      }
      const clases = [...el.classList].filter(c => /^(preview-biblia-|preview-text-ref$|va-rich-highlight$)/.test(c));
      if (el.classList.contains('dev-f1-resaltado-lineas')) clases.push('va-rich-highlight');
      for (const a of [...el.attributes]) el.removeAttribute(a.name);
      el.className = clases.join(' ');
      Object.assign(el.style, guardado);
    }
  }
  limpiar(template.content);
  return template.innerHTML;
}
export function aplicarCajaTexto({stage, target, backTarget, state, fontPx}) {
  if (!stage || !target) return;
  instalarEstilos();
  target.classList.add('va-editor-content');
  if (backTarget) {
    backTarget.classList.add('va-editor-content', 'va-editor-back');
    if (fontPx) backTarget.style.fontSize = `${fontPx}px`;
  }
  if (state.html != null && target.__vaRichHTML !== state.html) {
    target.innerHTML = copiarHTMLSeguro(state.html);
    target.__vaRichHTML = state.html;
  }
  if (fontPx) target.style.fontSize = `${fontPx}px`;
  if (backTarget && state.html != null) {
    backTarget.innerHTML = target.innerHTML;
    for (const el of backTarget.querySelectorAll('*')) { el.style.removeProperty('color'); }
  }
  if (!state.geometry) return;
  const sr = stage.getBoundingClientRect();
  const sw = stage.offsetWidth || sr.width;
  const sh = stage.offsetHeight || sr.height;
  if (!sw || !sh || !sr.width) return;
  for (const node of [target, backTarget].filter(Boolean)) {
    let ancestor = node.parentElement;
    while (ancestor && ancestor !== stage) { ancestor.style.overflow = 'visible'; ancestor = ancestor.parentElement; }
    Object.assign(node.style, {position:'absolute', width:`${state.width * sw}px`, maxWidth:'none', margin:'0', padding:'0', right:'auto', bottom:'auto'});
    const pr = (node.offsetParent || stage).getBoundingClientRect();
    const ratio = sw / sr.width;
    node.style.left = `${state.x * sw - (pr.left - sr.left) * ratio}px`;
    node.style.top = `${state.y * sh - (pr.top - sr.top) * ratio}px`;
    node.style.transformOrigin = 'center';
    node.style.transform = `translate(-50%, -50%) scale(${state.zoom})`;
  }
}
function inicializarGeometria(c) {
  const s = c.opts.state;
  const sr = c.opts.stage.getBoundingClientRect(), tr = c.opts.target.getBoundingClientRect();
  if (!sr.width || !sr.height) return;
  if (!s.geometry) {
    s.x = (tr.left + tr.width / 2 - sr.left) / sr.width;
    s.y = (tr.top + tr.height / 2 - sr.top) / sr.height;
    s.width = tr.width / sr.width; s.zoom = 1;
  }
}
function recordarHTML(c) {
  c.opts.state.html = copiarHTMLSeguro(c.opts.target.innerHTML);
  // Conservar los nodos y la selección mientras se escribe o se aplica formato.
  c.opts.target.__vaRichHTML = c.opts.state.html;
  c.opts.state.changed = true;
  if (c.opts.backTarget) {
    c.opts.backTarget.innerHTML = c.opts.state.html;
    for (const el of c.opts.backTarget.querySelectorAll('*')) el.style.removeProperty('color');
  }
  inicializarGeometria(c);
  c.opts.state.geometry = true;
  aplicarCajaTexto(c.opts); limitarCaja(c);
  c.opts.onChange?.(); posicionarControles(c);
}
function posicionarControles(c, guias = false) {
  const sr = c.opts.stage.getBoundingClientRect(), tr = c.opts.target.getBoundingClientRect();
  if (!sr.width) return;
  const factor = c.opts.stage.offsetWidth / sr.width;
  Object.assign(c.outline.style, {left:`${(tr.left-sr.left)*factor}px`,top:`${(tr.top-sr.top)*factor}px`,width:`${tr.width*factor}px`,height:`${tr.height*factor}px`});
  c.outline.hidden = activo !== c;
  c.guideX.hidden = !(guias && Math.abs((tr.left + tr.width/2 - sr.left)/sr.width - .5) < .008);
  c.guideY.hidden = !(guias && Math.abs((tr.top + tr.height/2 - sr.top)/sr.height - .5) < .008);
}
function activar(c) {
  if (activo && activo !== c) { activo.outline.hidden = true; activo.guideX.hidden = true; activo.guideY.hidden = true; }
  activo = c; inicializarGeometria(c); posicionarControles(c);
}
function editar(c, on) {
  c.editing = on;
  c.opts.target.contentEditable = String(on);
  c.opts.target.style.touchAction = on ? 'auto' : 'none';
  c.opts.target.style.cursor = on ? 'text' : 'move';
  c.editButton.classList.toggle('activo', on);
  c.moveButton.classList.toggle('activo', !on);
  if (on) { activar(c); c.opts.target.focus(); }
}
function guardarRango(c) {
  const sel = window.getSelection();
  if (sel?.rangeCount && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    if (c.opts.target.contains(range.commonAncestorContainer)) c.range = range.cloneRange();
  }
}
function formatear(c, property, value) {
  editar(c, true);
  const range = c.range?.cloneRange() || document.createRange();
  if (!c.range || !c.opts.target.contains(range.commonAncestorContainer)) range.selectNodeContents(c.opts.target);
  if (range.collapsed) return;
  const span = document.createElement('span');
  span.style[property] = value;
  span.appendChild(range.extractContents()); range.insertNode(span);
  if (property === 'fontSize' && /em$/.test(value)) {
    const rootPx = parseFloat(getComputedStyle(c.opts.target).fontSize);
    const parentPx = parseFloat(getComputedStyle(span.parentElement).fontSize) || rootPx;
    span.style.fontSize = `${parseFloat(value) * rootPx / parentPx}em`;
  }
  range.selectNodeContents(span);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); c.range = range.cloneRange();
  // Un estilo seleccionado vence al formato heredado de palabras ya editadas.
  for (const el of span.querySelectorAll('*')) el.style.removeProperty(property.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()));
  recordarHTML(c);
}
function crearControles(c) {
  const tools = document.createElement('div');
  tools.className = 'va-editor-tools'; tools.dataset.html2canvasIgnore = 'true';
  c.opts.stage.insertAdjacentElement('beforebegin', tools); c.tools = tools;
  const boton = (label, title, action) => {
    const b = document.createElement('button'); b.type='button'; b.textContent=label; b.title=title;
    b.addEventListener('pointerdown',e=>{ guardarRango(c); e.preventDefault(); });
    b.onclick = action; tools.appendChild(b); return b;
  };
  c.moveButton = boton('Mover','Arrastrar o cambiar el tamaño del cuadro',()=>editar(c,false));
  c.editButton = boton('Editar','Seleccionar palabras y cambiar saltos de línea',()=>editar(c,true));
  const size = document.createElement('input'); size.type='number';size.min='5';size.max='400';size.step='1';size.value='100';
  size.setAttribute('aria-label','Tamaño de las palabras seleccionadas, en porcentaje');size.title='Tamaño de la selección (%)';
  size.onchange=()=>formatear(c,'fontSize',`${clamp(Number(size.value)||100,5,400)/100}em`);tools.appendChild(size);
  const toggles = [['B','Negrita','fontWeight','800','400'],['I','Cursiva','fontStyle','italic','normal'],['U','Subrayar','textDecoration','underline','none'],['Aa','Mayúsculas','textTransform','uppercase','none']];
  for (const [label,title,prop,on,off] of toggles) boton(label,title,e=>{
    const range=c.range; const node=range?.startContainer; const el=node?.nodeType===3?node.parentElement:node;
    const actual=el?getComputedStyle(el)[prop]:'';
    formatear(c,prop,actual===on?off:on);
  });
  const font = document.createElement('select');font.setAttribute('aria-label','Fuente de las palabras seleccionadas');
  for (const name of ['Fuente…','Roboto','Arial','Georgia','Montserrat','Lora','Playfair Display','DM Serif Display','Dancing Script','Great Vibes','Oswald','Bebas Neue','Merriweather']) {
    const o=document.createElement('option');o.textContent=name;o.value=name==='Fuente…'?'':name;font.appendChild(o);
  }
  font.onchange=()=>{if(font.value)formatear(c,'fontFamily',font.value);};tools.appendChild(font);
  const color = document.createElement('input');color.type='color';color.value='#000000';color.setAttribute('aria-label','Color de las palabras seleccionadas');
  color.onchange=()=>formatear(c,'color',color.value);tools.appendChild(color);
  boton('Centrar','Centrar el cuadro horizontal y verticalmente',()=>{
    activar(c);Object.assign(c.opts.state,{x:.5,y:.5,geometry:true,changed:true});
    aplicarCajaTexto(c.opts);posicionarControles(c,true);c.opts.onChange?.();
  });
  const hint=document.createElement('span');hint.className='va-editor-hint';
  hint.textContent='Mover: arrastrá el texto; esquinas o dos dedos para escalar, laterales para cambiar el ancho. Editar: seleccioná palabras o cambiá los saltos de línea.';tools.appendChild(hint);
  for(const [key,cls] of [['outline','va-editor-outline'],['guideX','va-editor-guide vertical'],['guideY','va-editor-guide horizontal']]){
    const div=document.createElement('div');div.className=`${cls} va-editor-overlay`;div.dataset.html2canvasIgnore='true';div.hidden=true;c[key]=div;c.opts.stage.appendChild(div);
  }
  for(const [name,x,y] of [['nw',0,0],['ne',100,0],['sw',0,100],['se',100,100],['w',0,50],['e',100,50]]){
    const h=document.createElement('button');h.type='button';h.className='va-editor-handle';h.setAttribute('aria-label',name==='w'||name==='e'?'Cambiar ancho de texto':'Escalar texto');
    h.style.left=`${x}%`;h.style.top=`${y}%`;h.style.transform='translate(-50%,-50%)';
    h.onpointerdown=e=>iniciarGesto(c,e,name);c.outline.appendChild(h);
  }
  c.resize=new ResizeObserver(()=>{
    aplicarCajaTexto(c.opts);posicionarControles(c);
  });c.resize.observe(c.opts.stage);
}
function iniciarGesto(c,e,handle='move') {
  if (c.editing && handle==='move' && c.points.size===0) return;
  if (e.button && e.pointerType==='mouse') return;
  e.preventDefault();e.stopPropagation();activar(c);
  e.currentTarget.setPointerCapture?.(e.pointerId);
  c.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  c.gesture={handle,point:{x:e.clientX,y:e.clientY},start:{...c.opts.state}};
  if(c.points.size===2){
    const [a,b]=[...c.points.values()];c.gesture.distance=Math.hypot(b.x-a.x,b.y-a.y);
    c.gesture.mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};c.gesture.handle='pinch';
  }
}
function limitarCaja(c) {
  const s=c.opts.state, sr=c.opts.stage.getBoundingClientRect();
  const bounds=c.opts.bounds || {left:0,right:1,top:0,bottom:1};
  let tr=c.opts.target.getBoundingClientRect();
  const fit=Math.min(1,(sr.width*(bounds.right-bounds.left)-4)/tr.width,(sr.height*(bounds.bottom-bounds.top)-4)/tr.height);
  if(fit<1 && fit>0){s.zoom*=fit;aplicarCajaTexto(c.opts);tr=c.opts.target.getBoundingClientRect();}
  s.x=clamp(s.x,bounds.left+tr.width/(2*sr.width),bounds.right-tr.width/(2*sr.width));
  s.y=clamp(s.y,bounds.top+tr.height/(2*sr.height),bounds.bottom-tr.height/(2*sr.height));
  if(Math.abs(s.x-.5)<.008)s.x=.5;if(Math.abs(s.y-.5)<.008)s.y=.5;
  aplicarCajaTexto(c.opts);
}
function moverGesto(c,e) {
  if(!c.points.has(e.pointerId)||!c.gesture)return;
  e.preventDefault();c.points.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const g=c.gesture,s=c.opts.state,sr=c.opts.stage.getBoundingClientRect();
  s.geometry=true;s.changed=true;
  if(c.points.size===2 && g.distance){
    const[a,b]=[...c.points.values()];s.zoom=clamp(g.start.zoom*Math.hypot(b.x-a.x,b.y-a.y)/Math.max(1,g.distance),.1,8);
    s.x=g.start.x+((a.x+b.x)/2-g.mid.x)/sr.width;s.y=g.start.y+((a.y+b.y)/2-g.mid.y)/sr.height;
  }else if(g.handle==='move'){
    s.x=g.start.x+(e.clientX-g.point.x)/sr.width;s.y=g.start.y+(e.clientY-g.point.y)/sr.height;
  }else if(g.handle==='w'||g.handle==='e'){
    const sign=g.handle==='e'?1:-1;
    s.width=clamp(g.start.width+sign*2*(e.clientX-g.point.x)/(sr.width*g.start.zoom),.08,1/g.start.zoom);
  }else if(g.handle!=='pinch'){
    const center={x:sr.left+g.start.x*sr.width,y:sr.top+g.start.y*sr.height};
    const before=Math.hypot(g.point.x-center.x,g.point.y-center.y);
    s.zoom=clamp(g.start.zoom*Math.hypot(e.clientX-center.x,e.clientY-center.y)/Math.max(1,before),.1,8);
  }
  aplicarCajaTexto(c.opts);limitarCaja(c);posicionarControles(c,true);c.opts.onChange?.();
}
function terminarGesto(c,e){
  if(!c.points.has(e.pointerId))return;c.points.delete(e.pointerId);
  if(c.points.size){const[id,p]=[...c.points][0];c.gesture={handle:'move',point:{...p},start:{...c.opts.state}};}
  else{c.gesture=null;posicionarControles(c,false);c.opts.onChange?.();}
}
export function montarEditorTexto(opts) {
  if(!opts.stage||!opts.target)return;
  instalarEstilos();
  let c=opts.stage.__vaEditor;
  if(!c){
    c={opts,points:new Map(),range:null,editing:false};opts.stage.__vaEditor=c;crearControles(c);
    document.addEventListener('selectionchange',()=>{if(activo===c)guardarRango(c);});
    document.addEventListener('pointerdown',e=>{
      if(activo===c&&!c.opts.stage.contains(e.target)&&!c.tools.contains(e.target)){
        c.outline.hidden=true;c.guideX.hidden=true;c.guideY.hidden=true;activo=null;
      }
    });
    opts.stage.addEventListener('pointermove',e=>moverGesto(c,e));
    opts.stage.addEventListener('pointerup',e=>terminarGesto(c,e));
    opts.stage.addEventListener('pointercancel',e=>terminarGesto(c,e));
  }
  c.opts=opts;aplicarCajaTexto(opts);
  if(!opts.target.__vaEditorReady){
    opts.target.__vaEditorReady=true;
    opts.target.setAttribute('aria-label','Cuadro de texto de la imagen');opts.target.spellcheck=false;
    opts.target.addEventListener('pointerdown',e=>{activar(c);iniciarGesto(c,e);});
    opts.target.addEventListener('click',e=>{activar(c);e.stopPropagation();});
    opts.target.addEventListener('input',()=>{inicializarGeometria(c);recordarHTML(c);});
    opts.target.addEventListener('paste',e=>{
      if(!c.editing)return;e.preventDefault();
      const value=e.clipboardData?.getData('text/plain')||'';
      const sel=window.getSelection();if(!sel?.rangeCount)return;
      const range=sel.getRangeAt(0);range.deleteContents();
      const fragment=document.createDocumentFragment();
      value.replace(/\r/g,'').split('\n').forEach((line,i)=>{if(i)fragment.appendChild(document.createElement('br'));fragment.appendChild(document.createTextNode(line));});
      const last=fragment.lastChild;range.insertNode(fragment);if(last){range.setStartAfter(last);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}recordarHTML(c);
    });
  }
  editar(c,c.editing);posicionarControles(c);
}

// Canvas nativo de Android: usa las posiciones tipográficas medidas por el navegador.
// Sólo se usa este camino cuando hay un cuadro editado; los diseños previos mantienen su render.
export function dibujarCajaTexto(ctx, {stage, target, state, fontPx, color, outline, stroke=1, highlight='', spread=0}) {
  aplicarCajaTexto({stage,target,state,fontPx});
  const sr=stage.getBoundingClientRect();
  if(highlight){
    const rangos=[];
    for(const span of target.querySelectorAll('.va-rich-highlight,.dev-f1-resaltado-lineas')){
      const range=document.createRange();range.selectNodeContents(span);
      for(const r of range.getClientRects()) if(r.width) rangos.push(r);
    }
    ctx.fillStyle=highlight;
    for(const r of rangos){
      ctx.beginPath();
      const args=[r.left-sr.left-spread,r.top-sr.top-2,r.width+2*spread,r.height+4];
      if(ctx.roundRect)ctx.roundRect(...args,Math.min(14,r.height/2));else ctx.rect(...args);
      ctx.fill();
    }
  }
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
    const cs=getComputedStyle(node.parentElement);const zoom=state.geometry?state.zoom:1;
    const px=parseFloat(cs.fontSize)*zoom;
    ctx.font=`${cs.fontStyle} ${cs.fontWeight} ${px}px ${cs.fontFamily}`;
    ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.lineJoin='round';
    ctx.fillStyle=cs.color||color;ctx.strokeStyle=outline;ctx.lineWidth=stroke*zoom;
    const metrics=ctx.measureText('Mg');
    const ascent=metrics.fontBoundingBoxAscent||px*.9,descent=metrics.fontBoundingBoxDescent||px*.2;
    // Agrupamos caracteres de la misma línea para conservar ligaduras y kerning.
    const range=document.createRange();let start=0;let anterior=null;
    const flush=end=>{
      if(end<=start)return;range.setStart(node,start);range.setEnd(node,end);const r=range.getBoundingClientRect();
      let text=node.textContent.slice(start,end);if(cs.textTransform==='uppercase')text=text.toLocaleUpperCase('es');
      const x=r.left-sr.left,y=r.top-sr.top+(r.height-ascent-descent)/2+ascent;
      if(stroke)ctx.strokeText(text,x,y);ctx.fillText(text,x,y);
      if(cs.textDecorationLine.includes('underline')){ctx.beginPath();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,px/18);ctx.moveTo(x,y+descent/2);ctx.lineTo(x+r.width,y+descent/2);ctx.stroke();ctx.strokeStyle=outline;ctx.lineWidth=stroke*zoom;}
    };
    for(let i=0;i<node.textContent.length;i++){
      range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();
      if(anterior&&Math.abs(r.top-anterior.top)>px*.2){flush(i);start=i;}anterior=r;
    }
    flush(node.textContent.length);
  }
}
