import { normalizarUrlImagen, urlMiniaturaImagen } from './carga-imagenes.js?v=20261109-medios-1';

const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lista=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[]);
const urlValida=v=>normalizarUrlImagen(v);

// Las notas antiguas guardan números; las nuevas conservan libro/capítulo por versículo.
export function referenciasDePublicacion(item={}){
  const salida=[],vistos=new Set();
  function agregar(libro,capitulo,versiculo){
    libro=String(libro||'').trim();capitulo=Number(capitulo);versiculo=Number(versiculo);
    if(!libro||!Number.isInteger(capitulo)||!Number.isInteger(versiculo)||capitulo<1||versiculo<1)return;
    const id=`${libro}_${capitulo}_${versiculo}`;if(vistos.has(id))return;
    vistos.add(id);salida.push({libro,capitulo,versiculo,id});
  }
  for(const id of lista(item.seleccionOrden)){
    const partes=String(id).split('_'),v=partes.pop(),c=partes.pop();agregar(partes.join('_'),c,v);
  }
  for(const v of lista(item.versiculosDetalle))agregar(v.libro||v.Libro||item.libro,v.capitulo||v.Capitulo||item.capitulo,v.versiculo||v.Versiculo);
  for(const v of lista(item.versiculos)){
    if(v&&typeof v==='object')agregar(v.libro||v.Libro||item.libro,v.capitulo||v.Capitulo||item.capitulo,v.versiculo||v.Versiculo);
    else agregar(item.libro,item.capitulo,v);
  }
  // Referencias heredadas: «Juan 3:16-18 y 4:2; Salmos 23:1».
  const gruposCompletos=new Set(salida.map(r=>r.libro+'_'+r.capitulo));
  {
    for(const grupo of String(item.ref||item.referencia||'').split(';')){
      const match=grupo.trim().match(/^(.+?)\s+(\d+:.*)$/);if(!match)continue;
      for(const tramo of match[2].matchAll(/(\d+)\s*:\s*([\d\s,–-]+)/g)){
        if(gruposCompletos.has(match[1]+'_'+Number(tramo[1])))continue;
        for(const rango of tramo[2].split(',')){
          const m=rango.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);if(!m)continue;
          const desde=Number(m[1]),hasta=Number(m[2]||m[1]);
          if(hasta<desde||hasta-desde>200)continue;
          for(let n=desde;n<=hasta;n++)agregar(match[1],tramo[1],n);
        }
      }
    }
  }
  return salida;
}

function comprimirVersiculos(numeros){
  const valores=[...new Set(numeros)].sort((a,b)=>a-b),rangos=[];
  for(let i=0;i<valores.length;i++){
    const primero=valores[i];let ultimo=primero;
    while(valores[i+1]===ultimo+1)ultimo=valores[++i];
    rangos.push(primero===ultimo?String(primero):`${primero}-${ultimo}`);
  }
  return rangos.join(',');
}

export function referenciasHTML(item={},opciones={}){
  instalar();const refs=referenciasDePublicacion(item);if(!refs.length)return '';
  let enlaces=refs.map(r=>({destino:r,rango:String(r.versiculo)}));
  if(opciones.agruparPorCapitulo){
    const grupos=new Map();
    for(const r of refs){
      const key=r.libro+'_'+r.capitulo;
      if(!grupos.has(key))grupos.set(key,{...r,versiculos:[]});
      grupos.get(key).versiculos.push(r.versiculo);
    }
    enlaces=[...grupos.values()].map(g=>{
      const numeros=[...new Set(g.versiculos)].sort((a,b)=>a-b);
      return {destino:{...g,id:`${g.libro}_${g.capitulo}_${numeros[0]}`,versiculo:numeros[0],versiculos:numeros},rango:comprimirVersiculos(numeros)};
    });
  }
  return `<nav class="va-referencias${opciones.lineaUnica?' va-referencias-linea':''}"${opciones.lineaUnica?' tabindex="0"':''} aria-label="Versículos incluidos">${enlaces.map(({destino:r,rango})=>{
    const href='#versiculo/'+encodeURIComponent(r.libro)+'/'+r.capitulo+'/'+r.versiculo;
    return `<a href="${escapar(href)}" data-va-versiculo="${escapar(JSON.stringify(r))}" title="Abrir ${escapar(r.libro)} ${r.capitulo}:${rango}">${escapar(r.libro)} <b>${r.capitulo}:${rango}</b></a>`;
  }).join('')}</nav>`;
}

export function disenosDeImagen(item={}){
  const mapa=item.disenosImagen||{},orden=lista(item.disenosOrden).map(String),salida=[],vistos=new Set();
  for(const id of [...orden,...Object.keys(mapa)]){
    const d=mapa[id];if(!d||vistos.has(id))continue;
    const url=urlValida(d.url||d.imagenUrl);if(!url)continue;
    vistos.add(id);salida.push({...d,id,url});
  }
  if(!salida.length){const url=urlValida(item.url||item.imagenUrl||item.shareUrl);if(url)salida.push({id:'original',url,disenoImagen:item.disenoImagen||null,fecha:Number(item.fecha)||0});}
  return salida;
}

// Función pura que también se usa dentro de la transacción de Firebase.
export function agregarDisenoImagen(item,diseno){
  const anteriores=disenosDeImagen(item),mapa={};
  for(const d of anteriores)mapa[d.id]=d;
  mapa[diseno.id]={...diseno};
  const orden=[...new Set([...anteriores.map(d=>d.id),diseno.id])];
  const portada=orden.includes(item.disenoPortadaId)?item.disenoPortadaId:orden[0];
  const principal=mapa[portada];
  return {disenosImagen:mapa,disenosOrden:orden,disenoPortadaId:portada,url:principal.url,imagenUrl:principal.url,disenoImagen:principal.disenoImagen||null};
}

export function combinarDisenosImagen(anterior={},nuevo={}){
  const mapa={},orden=[];
  for(const d of [...disenosDeImagen(anterior),...disenosDeImagen(nuevo)]){
    if(!mapa[d.id])orden.push(d.id);mapa[d.id]=d;
  }
  const portada=nuevo.disenoPortadaId||anterior.disenoPortadaId||orden[0],d=mapa[portada]||mapa[orden[0]];
  return d?{disenosImagen:mapa,disenosOrden:orden,disenoPortadaId:d.id,url:d.url,imagenUrl:d.url,disenoImagen:d.disenoImagen||null}:{};
}

export function carruselImagenHTML(item={},clave=''){
  instalar();const disenos=disenosDeImagen(item);if(!disenos.length)return '';
  return `<section class="va-carrusel-imagen ${disenos.length>1?'va-varios-disenos':''}" data-va-carrusel="${escapar(clave)}" data-diseno-activo="0" aria-label="Diseños de la publicación">
    <div class="va-disenos-rail" tabindex="0" aria-label="Deslizar diseños">${disenos.map((d,i)=>`<figure class="va-diseno-slide" data-diseno-id="${escapar(d.id)}" data-va-imagen-host><img data-va-imagen data-va-src="${escapar(urlMiniaturaImagen(d.url,d.miniaturaUrl))}" data-va-original="${escapar(d.url)}" alt="Diseño ${i+1} de ${disenos.length}" loading="lazy" decoding="async" draggable="false"></figure>`).join('')}</div>
    ${disenos.length>1?'<div class="va-disenos-navegar"><button type="button" data-va-paso="-1" aria-label="Diseño anterior" disabled>‹</button><span class="va-disenos-contador" aria-live="polite">1 / '+disenos.length+'</span><button type="button" data-va-paso="1" aria-label="Diseño siguiente">›</button></div>':''}
  </section>`;
}

export function disenoActivoDeCard(item,card){
  const index=Number(card?.querySelector('[data-va-carrusel]')?.dataset.disenoActivo)||0;
  return disenosDeImagen(item)[index]||disenosDeImagen(item)[0]||null;
}

function actualizar(rail){
  const box=rail.closest('[data-va-carrusel]'),slides=[...rail.children];if(!box||!slides.length)return;
  const index=slides.reduce((mejor,el,i)=>Math.abs(el.offsetLeft-rail.scrollLeft)<Math.abs(slides[mejor].offsetLeft-rail.scrollLeft)?i:mejor,0);
  box.dataset.disenoActivo=String(index);
  const contador=box.querySelector('.va-disenos-contador');if(contador)contador.textContent=`${index+1} / ${slides.length}`;
  for(const b of box.querySelectorAll('[data-va-paso]'))b.disabled=Number(b.dataset.vaPaso)<0?index===0:index===slides.length-1;
}

let instalado=false;
function instalar(){
  if(instalado)return;instalado=true;
  const style=document.createElement('style');style.id='va-publicaciones-css';
  style.textContent=`
    .va-referencias{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;margin:0;max-height:112px;overflow:auto;scrollbar-width:thin}
    .va-referencias a{display:inline-flex;align-items:center;gap:5px;border:1px solid #9bbad65c;background:#f0f8ffd9;color:#245274!important;border-radius:999px;padding:5px 9px;font:500 12px/1.35 Arial,sans-serif;text-decoration:none;white-space:nowrap;transition:background .15s}
    .va-referencias a:hover,.va-referencias a:focus-visible{background:#cee9ff;outline:2px solid #5b91ba;outline-offset:1px}
    .va-referencias.va-referencias-linea{flex-wrap:nowrap;align-items:center;min-width:0;width:100%;max-width:100%;box-sizing:border-box;max-height:none;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain}
    .va-referencias-linea>a{flex:0 0 auto}
    .va-carrusel-imagen{position:relative;min-width:0;width:100%;overflow:hidden}
    .va-disenos-rail{position:relative;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;overscroll-behavior-x:contain;touch-action:pan-x pan-y;cursor:grab}
    .va-disenos-rail.va-arrastrando{scroll-snap-type:none;cursor:grabbing;user-select:none}
    .va-diseno-slide{margin:0;flex:0 0 100%;min-width:0;scroll-snap-align:start;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;background:#f6f9fc}
    .va-carrusel-imagen .va-diseno-slide img{display:block;width:100%;height:auto;max-height:78vh;object-fit:contain;border-radius:0;pointer-events:none}
    .va-disenos-navegar{display:flex;justify-content:center;align-items:center;gap:14px;padding:6px;background:#f0f8ff;color:#34526b;font:600 12px Arial}
    .va-disenos-navegar button{border:0;border-radius:50%;background:#d6eaff;color:#284e70;width:30px;height:30px;padding:0;font:24px Arial;cursor:pointer}.va-disenos-navegar button:disabled{opacity:.3;cursor:default}
    .va-versiculo-destino{outline:2px solid #70a8d7!important;outline-offset:-2px;animation:va-versiculo-pulso 1s ease 2}@keyframes va-versiculo-pulso{50%{box-shadow:inset 0 0 0 4px #a7d8ff80}}
    body.oscuro .va-referencias a{background:#223e52;color:#e5f5ff!important}body.oscuro .va-disenos-navegar{background:#233c50;color:#e5f5ff}
  `;document.head.appendChild(style);
  document.addEventListener('click',e=>{
    const clickedRail=e.target.closest?.('.va-disenos-rail');
    if(clickedRail?.dataset.ignorarClick==='1'){delete clickedRail.dataset.ignorarClick;e.preventDefault();e.stopImmediatePropagation();return;}
    const link=e.target.closest?.('a[data-va-versiculo]');
    if(link&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){
      if(typeof window.vaAbrirVersiculoReferencia!=='function')return;
      e.preventDefault();e.stopPropagation();
      try{link.dispatchEvent(new CustomEvent('va-referencia-navegar',{bubbles:true}));window.vaAbrirVersiculoReferencia(JSON.parse(link.dataset.vaVersiculo));}catch{}
      return;
    }
    const button=e.target.closest?.('[data-va-paso]');if(!button)return;
    e.preventDefault();e.stopPropagation();const box=button.closest('[data-va-carrusel]'),rail=box.querySelector('.va-disenos-rail');
    const index=Math.max(0,Math.min(rail.children.length-1,(Number(box.dataset.disenoActivo)||0)+Number(button.dataset.vaPaso)));
    rail.scrollTo({left:rail.children[index].offsetLeft,behavior:'smooth'});
  },true);
  document.addEventListener('scroll',e=>{if(e.target.classList?.contains('va-disenos-rail'))actualizar(e.target);},true);
  document.addEventListener('keydown',e=>{
    const rail=e.target;
    if(!rail.classList?.contains('va-disenos-rail')&&!rail.classList?.contains('va-referencias-linea'))return;
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();rail.scrollBy({left:(e.key==='ArrowRight'?1:-1)*rail.clientWidth,behavior:'smooth'});
  });
  let arrastre=null;
  document.addEventListener('pointerdown',e=>{
    const rail=e.target.closest?.('.va-disenos-rail');if(!rail||e.pointerType!=='mouse'||e.button!==0)return;
    arrastre={rail,id:e.pointerId,x:e.clientX,scroll:rail.scrollLeft,movido:false};
  });
  document.addEventListener('pointermove',e=>{
    if(!arrastre||arrastre.id!==e.pointerId)return;const a=arrastre;
    if(Math.abs(e.clientX-a.x)>5){a.movido=true;a.rail.classList.add('va-arrastrando');a.rail.setPointerCapture?.(e.pointerId);}
    if(a.movido){e.preventDefault();a.rail.scrollLeft=a.scroll+a.x-e.clientX;}
  },{passive:false});
  const soltar=e=>{if(!arrastre||arrastre.id!==e.pointerId)return;const a=arrastre;arrastre=null;a.rail.classList.remove('va-arrastrando');if(a.movido){a.rail.dataset.ignorarClick='1';setTimeout(()=>delete a.rail.dataset.ignorarClick,0);actualizar(a.rail);const i=Number(a.rail.parentElement.dataset.disenoActivo)||0;a.rail.scrollTo({left:a.rail.children[i].offsetLeft,behavior:'smooth'});}};
  document.addEventListener('pointerup',soltar);document.addEventListener('pointercancel',soltar);
}
