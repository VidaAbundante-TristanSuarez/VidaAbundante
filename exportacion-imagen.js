// La calidad de salida se elige al descargar; la preview conserva su tamaño.
let seleccionPendiente=null;

export function dimensionesExportacion(formato='vertical',ancho=1080){
  const width=ancho===2160?2160:1080;
  return {width,height:formato==='cuadrado'?width:width*16/9};
}

function estilos(){
  if(document.getElementById('va-exportacion-css'))return;
  const style=document.createElement('style');style.id='va-exportacion-css';
  style.textContent=`
    .va-exportacion-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:18px;background:#152b405e;box-sizing:border-box}
    .va-exportacion-dialog{position:relative;width:min(100%,340px);padding:24px 18px 18px;border:1px solid #d3e5ed;border-radius:22px;background:#f4fcff;color:#173347;font:500 15px Arial,sans-serif;box-shadow:0 12px 42px #0003;box-sizing:border-box}
    .va-exportacion-dialog h2{margin:0 30px 18px 0;font-size:19px;line-height:1.3;color:inherit}
    .va-exportacion-dialog .va-exportacion-cerrar{position:absolute;right:10px;top:9px;width:32px;height:32px;min-width:0;padding:0;border:0;border-radius:50%;background:#fff;color:#173347;font:24px Arial;cursor:pointer}
    .va-exportacion-dialog .va-exportacion-opcion{display:flex;flex-direction:column;gap:5px;width:100%;margin:9px 0 0;padding:15px 17px;border:1px solid #c7dfe9;border-radius:15px;background:#dff2ff;color:#173347;text-align:left;font:inherit;cursor:pointer;box-sizing:border-box}
    .va-exportacion-opcion strong{font-size:15px}.va-exportacion-opcion span{font-size:13px;opacity:.8}
    .va-exportacion-dialog button:hover{background:#c8e7ff}.va-exportacion-dialog button:focus-visible{outline:3px solid #347bbd;outline-offset:2px}
    .va-exportacion-dialog p{margin:0;text-align:center;font-size:16px;font-weight:600}
    body.oscuro .va-exportacion-dialog{background:#182b39;color:#f4fcff;border-color:#355264}
    body.oscuro .va-exportacion-opcion{background:#28485c;color:#fff;border-color:#4c6e81}
  `;
  document.head.appendChild(style);
}

export function elegirResolucionImagen(formato='vertical'){
  if(seleccionPendiente)return seleccionPendiente;
  estilos();
  const previo=document.activeElement,overlay=document.createElement('div');
  overlay.className='va-exportacion-overlay';
  const box=document.createElement('section');box.className='va-exportacion-dialog';
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','va-exportacion-titulo');
  box.innerHTML='<button type="button" class="va-exportacion-cerrar" aria-label="Cerrar">×</button><h2 id="va-exportacion-titulo">Descargar imagen</h2>';
  for(const [ancho,label] of [[1080,'Normal'],[2160,'Alta resolución']]){
    const size=dimensionesExportacion(formato,ancho),button=document.createElement('button');
    button.type='button';button.className='va-exportacion-opcion';button.dataset.ancho=String(ancho);
    button.innerHTML=`<strong>${label}</strong><span>${size.width} × ${size.height} px · PNG</span>`;box.appendChild(button);
  }
  overlay.appendChild(box);document.body.appendChild(overlay);
  seleccionPendiente=new Promise(resolve=>{
    function cerrar(valor){
      document.removeEventListener('keydown',tecla,true);overlay.remove();seleccionPendiente=null;
      if(previo?.isConnected)previo.focus?.({preventScroll:true});resolve(valor);
    }
    function tecla(e){
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrar(null);return;}
      if(e.key==='Tab'){
        const botones=[...box.querySelectorAll('button')],i=botones.indexOf(document.activeElement);
        e.preventDefault();botones[(i+(e.shiftKey?-1:1)+botones.length)%botones.length].focus();
      }
    }
    box.querySelector('.va-exportacion-cerrar').onclick=()=>cerrar(null);
    for(const button of box.querySelectorAll('[data-ancho]'))button.onclick=()=>cerrar(Number(button.dataset.ancho));
    overlay.addEventListener('click',e=>{if(e.target===overlay)cerrar(null);});
    document.addEventListener('keydown',tecla,true);box.querySelector('[data-ancho]').focus({preventScroll:true});
  });
  return seleccionPendiente;
}

export async function conProgresoExportacion(trabajo){
  estilos();
  const overlay=document.createElement('div');overlay.className='va-exportacion-overlay';
  overlay.innerHTML='<div class="va-exportacion-dialog" role="status" aria-live="polite"><p>Preparando imagen…</p></div>';
  document.body.appendChild(overlay);
  try{
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    return await trabajo();
  }finally{overlay.remove();}
}
