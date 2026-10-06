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
    .va-editor-toggle{white-space:nowrap;flex:0 0 auto;}
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
    .va-editor-handle[hidden]{display:none!important;}
    .va-editor-guide{position:absolute;background:#8796a680;pointer-events:none;z-index:39;}
    .va-editor-guide.centrada{background:#e22332;}
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
export function aplicarCajaTexto({stage, target, backTarget, state, fontPx, defaultUnderline}) {
  if (!stage || !target) return;
  instalarEstilos();
  target.classList.add('va-editor-content');
  if (defaultUnderline != null) target.style.textDecoration = defaultUnderline ? 'underline' : 'none';
  if (state.separateUnderline) {
    for (const node of [target, backTarget].filter(Boolean)) {
      for (let el=node; el && el!==stage; el=el.parentElement) el.style.textDecoration='none';
    }
  }
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
function posicionarControles(c) {
  const sr = c.opts.stage.getBoundingClientRect(), tr = c.opts.target.getBoundingClientRect();
  if (!sr.width) return;
  const factor = c.opts.stage.offsetWidth / sr.width;
  Object.assign(c.outline.style, {left:`${(tr.left-sr.left)*factor}px`,top:`${(tr.top-sr.top)*factor}px`,width:`${tr.width*factor}px`,height:`${tr.height*factor}px`});
  c.outline.hidden = activo !== c;
  c.guideX.hidden = c.guideY.hidden = activo !== c || c.editing;
  c.guideX.classList.toggle('centrada', Math.abs((tr.left + tr.width/2 - sr.left)/sr.width - .5) < .008);
  c.guideY.classList.toggle('centrada', Math.abs((tr.top + tr.height/2 - sr.top)/sr.height - .5) < .008);
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
  if (c.editButton) {
    c.editButton.classList.toggle('activo', on);
    c.editButton.setAttribute('aria-pressed', String(on));
    c.editButton.title = on ? 'Mover o cambiar tamaño del cuadro' : 'Editar palabras y saltos de línea';
  }
  for (const h of c.outline.children) h.hidden = on;
  if (!on) { c.range = null; c.opts.onSelectionChange?.(null); }
  posicionarControles(c);
}
function guardarRango(c) {
  const sel = window.getSelection();
  if (sel?.rangeCount && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    if (c.editing && c.opts.target.contains(range.commonAncestorContainer)) {
      c.range = range.cloneRange(); actualizarSeleccion(c);
    }
  } else if (sel?.rangeCount && c.opts.target.contains(sel.anchorNode)) {
    c.range = null; c.opts.onSelectionChange?.(null);
  }
}
function actualizarSeleccion(c) {
  if (!c.range) return;
  const node = c.range.startContainer;
  const el = node.nodeType === 3 ? node.parentElement : node;
  const css = getComputedStyle(el), root = getComputedStyle(c.opts.target);
  const rgb = css.color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  c.opts.onSelectionChange?.({
    size: parseFloat(css.fontSize) / parseFloat(root.fontSize) * c.opts.baseFontSize,
    bold: Number(css.fontWeight) >= 600, italic: css.fontStyle === 'italic',
    underline: tieneSubrayado(el, c.opts.stage),
    upper: css.textTransform === 'uppercase', color: rgb ? '#' + rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('') : css.color, font: css.fontFamily
  });
}
function formatear(c, property, value) {
  if (property === 'textDecoration') normalizarSubrayado(c);
  const range = c.range.cloneRange();
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
  actualizarSeleccion(c);
}
export function aplicarFormatoSeleccion(stage, property, value) {
  const c = stage?.__vaEditor;
  if (!c?.editing || !c.range || c.range.collapsed || !c.opts.target.contains(c.range.commonAncestorContainer)) return false;
  if (property === 'fontSize') value = `${Number(value) / c.opts.baseFontSize}em`;
  formatear(c, property, value); return true;
}
export function restaurarControlesTexto(stage) {
  const c = stage?.__vaEditor;
  if (c?.range) { c.range=null; c.opts.onSelectionChange?.(null); }
}
export function desactivarEditorTexto(stage) {
  const c=stage?.__vaEditor;if(!c)return;
  c.editing=false;c.range=null;c.disabled=true;c.points.clear();c.gesture=null;
  if(activo===c)activo=null;
  c.outline.hidden=c.guideX.hidden=c.guideY.hidden=true;
  c.opts.target.contentEditable='false';
  c.editButton?.style.setProperty('display','none','important');c.resize.disconnect();
}
export function aplicarSubrayadoTexto(stage, on) {
  const c=stage?.__vaEditor;
  if(!c || c.disabled)return;
  c.range=document.createRange();c.range.selectNodeContents(c.opts.target);
  formatear(c,'textDecoration',on?'underline':'none');
  c.range=null;c.opts.onSelectionChange?.(null);
  window.getSelection()?.removeAllRanges();
}
function normalizarSubrayado(c) {
  const target=c.opts.target, before=c.range.cloneRange();
  before.selectNodeContents(target);before.setEnd(c.range.startContainer,c.range.startOffset);
  const start=before.toString().length, end=start+c.range.toString().length;
  const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT), nodes=[];
  while(walker.nextNode())nodes.push({node:walker.currentNode,under:tieneSubrayado(walker.currentNode.parentElement,c.opts.stage)});
  for(const el of [target,...target.querySelectorAll('*')])el.style.textDecoration='none';
  for(const {node,under} of nodes){
    const span=document.createElement('span');span.style.textDecoration=under?'underline':'none';
    node.parentNode.insertBefore(span,node);span.appendChild(node);
  }
  const range=document.createRange();let offset=0,first=false;
  for(const {node} of nodes){
    const length=node.textContent.length;
    if(!first && start<=offset+length){range.setStart(node,Math.max(0,start-offset));first=true;}
    if(first && end<=offset+length){range.setEnd(node,Math.max(0,end-offset));break;}
    offset+=length;
  }
  c.range=range;c.opts.state.separateUnderline=true;
  aplicarCajaTexto(c.opts);
}
export function seleccionarPalabraEnPunto(target, x, y) {
  let range = document.caretRangeFromPoint?.(x,y);
  if (!range && document.caretPositionFromPoint) {
    const p=document.caretPositionFromPoint(x,y);
    if(p){range=document.createRange();range.setStart(p.offsetNode,p.offset);}
  }
  if(!range || range.startContainer.nodeType!==3 || !target.contains(range.startContainer)) return false;
  const node=range.startContainer, text=node.textContent, word=/[\p{L}\p{N}\p{M}'’_-]/u;
  let start=range.startOffset,end=start;
  if(!word.test(text[start]||'') && start>0) start=end=start-1;
  if(!word.test(text[start]||'')) return false;
  while(start>0 && word.test(text[start-1]))start--;
  while(end<text.length && word.test(text[end]))end++;
  range.setStart(node,start);range.setEnd(node,end);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);return true;
}
function tieneSubrayado(el, stage) {
  for (let node=el; node && stage.contains(node); node=node.parentElement) {
    const css=getComputedStyle(node);
    if (css.textDecorationLine?.includes('underline') || css.textDecoration?.includes('underline')) return true;
  }
  return false;
}
export function alternarFormatoSeleccion(stage, property, on, off) {
  const c = stage?.__vaEditor;
  if (!c?.editing || !c.range || c.range.collapsed || !c.opts.target.contains(c.range.commonAncestorContainer)) return false;
  const node = c.range.startContainer, el = node.nodeType === 3 ? node.parentElement : node;
  const current = getComputedStyle(el)[property] || '';
  const enabled = property === 'fontWeight' ? Number(current) >= 600 : property === 'textDecoration' ? tieneSubrayado(el,c.opts.stage) : current.includes(on);
  return aplicarFormatoSeleccion(stage, property, enabled ? off : on);
}
function crearControles(c) {
  const host = c.opts.controlHost;
  if (host) {
    const b = document.createElement('button'); b.type='button'; b.textContent='Editar';
    b.className='va-editor-toggle'; b.dataset.html2canvasIgnore='true';
    for (const [key,value] of [['width','auto'],['min-width','0'],['max-width','none'],['padding','0 8px']]) b.style.setProperty(key,value,'important');
    b.onpointerdown=e=>{guardarRango(c);e.preventDefault();};
    b.onclick=()=>{const open=activo===c;activar(c);editar(c,open ? !c.editing : false);if(c.editing)c.opts.target.focus();};
    host.appendChild(b); c.editButton=b;
  }
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
      if (c.opts.controlsRoot?.contains(e.target)) { guardarRango(c); return; }
      if(activo===c&&!c.opts.stage.contains(e.target)){
        c.outline.hidden=true;c.guideX.hidden=true;c.guideY.hidden=true;activo=null;
      }
    });
    opts.stage.addEventListener('pointermove',e=>moverGesto(c,e));
    opts.stage.addEventListener('pointerup',e=>terminarGesto(c,e));
    opts.stage.addEventListener('pointercancel',e=>terminarGesto(c,e));
  }
  c.disabled=false;c.editButton?.style.removeProperty('display');c.resize.observe(opts.stage);
  if (c.opts.target !== opts.target) c.range=null;
  c.opts=opts;aplicarCajaTexto(opts);
  if(!opts.target.__vaEditorReady){
    opts.target.__vaEditorReady=true;
    opts.target.setAttribute('aria-label','Cuadro de texto de la imagen');opts.target.spellcheck=false;
    opts.target.addEventListener('pointerdown',e=>{activar(c);iniciarGesto(c,e);});
    opts.target.addEventListener('pointerdown',e=>{
      c.touch=e.pointerType==='touch';
      const sel=window.getSelection();c.tapHadSelection=sel&&!sel.isCollapsed&&c.opts.target.contains(sel.anchorNode);
    });
    opts.target.addEventListener('click',e=>{
      activar(c);e.stopPropagation();
      if (c.editing && c.touch && !c.tapHadSelection && window.getSelection()?.isCollapsed) seleccionarPalabraEnPunto(c.opts.target,e.clientX,e.clientY);
    });
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
      if(tieneSubrayado(node.parentElement,stage)){ctx.beginPath();ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,px/18);ctx.moveTo(x,y+descent/2);ctx.lineTo(x+r.width,y+descent/2);ctx.stroke();ctx.strokeStyle=outline;ctx.lineWidth=stroke*zoom;}
    };
    for(let i=0;i<node.textContent.length;i++){
      range.setStart(node,i);range.setEnd(node,i+1);const r=range.getBoundingClientRect();
      if(anterior&&Math.abs(r.top-anterior.top)>px*.2){flush(i);start=i;}anterior=r;
    }
    flush(node.textContent.length);
  }
}
