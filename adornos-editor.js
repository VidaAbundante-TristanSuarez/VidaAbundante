// Posición y tamaño del adorno independientes de la caja de texto.
const editores=new WeakMap();
const acotar=(n,a,b)=>Math.max(a,Math.min(b,n));

function instalarEstilos(){
  if(document.getElementById('va-adornos-editor-css'))return;
  const style=document.createElement('style');style.id='va-adornos-editor-css';
  style.textContent='.va-adorno-visual{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}.va-adorno-imagen{position:absolute!important;display:block!important;max-width:none!important;max-height:none!important;margin:0!important;padding:0!important;border:0;object-fit:contain;transform:translate(-50%,-50%);pointer-events:none}.va-adorno-control{position:absolute;z-index:40;transform:translate(-50%,-50%);box-sizing:border-box;cursor:move;touch-action:none;user-select:none;border:1px dashed #347ab7;background:transparent;border-radius:3px;pointer-events:auto}.va-adorno-control[hidden]{display:none!important}.va-adorno-manija{position:absolute;width:24px;height:24px;padding:0!important;min-width:24px!important;min-height:24px!important;border:0!important;background:transparent!important;border-radius:0!important;touch-action:none;transform:translate(-50%,-50%);cursor:nwse-resize;box-shadow:none!important}.va-adorno-manija::after{content:"";display:block;width:11px;height:11px;margin:auto;background:#fff;border:2px solid #347ab7;border-radius:50%;box-sizing:border-box}.va-adorno-manija[data-esquina="ne"],.va-adorno-manija[data-esquina="sw"]{cursor:nesw-resize}';
  document.head.appendChild(style);
}

function dimensiones(c){
  const r=c.stage.getBoundingClientRect();
  const ratio=c.img.naturalWidth/Math.max(1,c.img.naturalHeight)||4;
  const max=Math.min(.96,.96*r.height*ratio/Math.max(1,r.width));
  return {r,ratio,max:Math.max(.025,max)};
}

function dibujar(c,avisar=false,usuario=false){
  if(!c.img.complete || !c.img.naturalWidth || !c.stage.clientWidth)return;
  const {r,ratio,max}=dimensiones(c),s=c.opts.state;
  if(!s.inicializado){
    const inicial=Number(c.opts.defaultWidth)||.7;
    const altoInicial=(Number(c.opts.initialMaxHeight)||.12)*r.height;
    s.width=Math.min(inicial,altoInicial*ratio/r.width,max);
    s.x=.5;s.y=.97-(s.width*r.width/ratio/r.height)/2;s.inicializado=true;
  }
  s.width=acotar(Number(s.width)||.3,.025,max);
  const h=s.width*r.width/ratio/r.height;
  s.x=acotar(Number.isFinite(s.x)?s.x:.5,s.width/2,1-s.width/2);
  s.y=acotar(Number.isFinite(s.y)?s.y:.9,h/2,1-h/2);
  const estilo={left:s.x*100+'%',top:s.y*100+'%',width:s.width*100+'%',height:h*100+'%'};
  Object.assign(c.img.style,estilo);
  c.img.style.opacity=String(acotar(Number(c.opts.opacity??1),0,1));
  Object.assign(c.control.style,estilo);
  c.control.hidden=!c.opts.interactive;
  if(avisar)c.opts.onChange?.({...s},usuario);
}

function punto(e){return {x:e.clientX,y:e.clientY};}
function medio(points){const [a,b]=[...points.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)};}
function comenzar(c,handle=''){
  const s=c.opts.state;
  if(c.points.size>1){const mid=medio(c.points);c.gesture={...s,mid,handle:'pinch'};}
  else {const p=[...c.points.values()][0];c.gesture={...s,point:p,handle};}
}
function abajo(c,e){
  if(!c.opts.interactive || (e.pointerType==='mouse' && e.button!==0))return;
  e.preventDefault();e.stopPropagation();
  c.points.set(e.pointerId,punto(e));
  c.control.setPointerCapture?.(e.pointerId);
  comenzar(c,e.target.closest('[data-esquina]')?.dataset.esquina||'move');
}
function mover(c,e){
  if(!c.points.has(e.pointerId)||!c.gesture)return;
  e.preventDefault();e.stopPropagation();c.points.set(e.pointerId,punto(e));
  const g=c.gesture,s=c.opts.state,{r}=dimensiones(c);
  if(c.points.size>1){
    const mid=medio(c.points);
    if(!g.mid){comenzar(c);return;}
    s.width=g.width*mid.d/Math.max(1,g.mid.d);
    s.x=g.x+(mid.x-g.mid.x)/r.width;s.y=g.y+(mid.y-g.mid.y)/r.height;
  }else if(g.handle==='move'){
    s.x=g.x+(e.clientX-g.point.x)/r.width;s.y=g.y+(e.clientY-g.point.y)/r.height;
  }else{
    const cx=r.left+g.x*r.width,cy=r.top+g.y*r.height;
    const antes=Math.hypot(g.point.x-cx,g.point.y-cy);
    s.width=g.width*Math.hypot(e.clientX-cx,e.clientY-cy)/Math.max(1,antes);
  }
  s.editado=true;dibujar(c,true,true);
}
function soltar(c,e){
  if(!c.points.has(e.pointerId))return;
  c.points.delete(e.pointerId);
  if(c.points.size)comenzar(c,'move');else c.gesture=null;
  if(c.control.hasPointerCapture?.(e.pointerId))c.control.releasePointerCapture(e.pointerId);
}

function crear(stage){
  instalarEstilos();
  const visual=document.createElement('div');visual.className='va-adorno-visual';
  const img=document.createElement('img');img.className='va-adorno-imagen';
  img.dataset.vaAdornoImage='1';img.crossOrigin='anonymous';img.decoding='async';img.alt='';img.draggable=false;
  visual.appendChild(img);stage.appendChild(visual);
  const control=document.createElement('div');control.className='va-adorno-control';
  control.setAttribute('data-html2canvas-ignore','true');control.setAttribute('role','group');
  control.setAttribute('aria-label','Mover y cambiar el tamaño del adorno');control.tabIndex=0;control.hidden=true;
  for(const [name,x,y] of [['nw',0,0],['ne',100,0],['sw',0,100],['se',100,100]]){
    const h=document.createElement('button');h.type='button';h.className='va-adorno-manija';h.dataset.esquina=name;
    h.setAttribute('aria-label','Cambiar tamaño del adorno');h.style.left=x+'%';h.style.top=y+'%';control.appendChild(h);
  }
  stage.appendChild(control);
  const c={stage,img,visual,control,opts:{},points:new Map(),gesture:null,promise:Promise.resolve(),token:0,error:null};
  control.addEventListener('pointerdown',e=>abajo(c,e));
  control.addEventListener('pointermove',e=>mover(c,e));
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(ev,e=>soltar(c,e));
  control.addEventListener('contextmenu',e=>e.preventDefault());
  control.addEventListener('keydown',e=>{
    const s=c.opts.state,{r}=dimensiones(c),d=e.shiftKey?10:2;
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='ArrowLeft')s.x-=d/r.width;if(e.key==='ArrowRight')s.x+=d/r.width;
    if(e.key==='ArrowUp')s.y-=d/r.height;if(e.key==='ArrowDown')s.y+=d/r.height;
    if(e.key==='+')s.width*=1.05;if(e.key==='-')s.width/=1.05;
    s.editado=true;dibujar(c,true,true);
  });
  if(typeof ResizeObserver==='function'){c.resize=new ResizeObserver(()=>dibujar(c));c.resize.observe(stage);}
  editores.set(stage,c);return c;
}

export function actualizarAdorno(stage,opts={}){
  if(!stage)return Promise.resolve();
  const c=editores.get(stage)||crear(stage);c.opts=opts;
  const key=opts.resourceKey||opts.url||'';
  if(!opts.url){
    c.token++;c.visual.hidden=true;c.control.hidden=true;c.img.removeAttribute('src');
    c.promise=Promise.resolve();c.error=null;return c.promise;
  }
  c.visual.hidden=false;
  if(opts.state.source!==key){
    Object.assign(opts.state,{source:key,inicializado:false,editado:false});
  }
  if(c.img.getAttribute('src')===opts.url && !c.error){dibujar(c);return c.promise;}
  const token=++c.token;c.error=null;
  c.promise=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>fin(new Error('No pude cargar el adorno. Volvé a intentarlo.')),12000);
    function fin(error){
      clearTimeout(timer);
      if(token!==c.token){resolve();return;}
      c.img.onload=c.img.onerror=null;
      if(error){c.error=error;reject(error);return;}
      dibujar(c,true,false);resolve();
    }
    c.img.onload=()=>fin();c.img.onerror=()=>fin(new Error('No pude cargar el adorno. Volvé a intentarlo.'));
    c.img.src=opts.url;
  });
  c.promise.catch(()=>{});return c.promise;
}

export function activarAdorno(stage,activo){const c=editores.get(stage);if(c){c.opts.interactive=!!activo;c.control.hidden=!activo||!c.opts.url;}}
export async function esperarAdorno(stage){
  const c=editores.get(stage);if(!c)return;
  let trabajo;
  do{trabajo=c.promise;try{await trabajo;}catch(e){if(trabajo===c.promise)throw e;}}while(trabajo!==c.promise);
  if(c.error)throw c.error;
}
