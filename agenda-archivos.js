import { normalizarUrlImagen } from './carga-imagenes.js?v=20261102-agenda-imagenes-8';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tipo=a=>{
  const mime=String(a.mimeType||a.type||'').toLowerCase(),nombre=String(a.fileName||a.name||a.url||'').split(/[?#]/)[0];
  if(mime.startsWith('image/')||/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(nombre))return 'imagen';
  if(mime.startsWith('video/')||/\.(mp4|webm|mov)$/i.test(nombre))return 'video';
  if(mime.startsWith('audio/')||/\.(mp3|m4a|wav|ogg)$/i.test(nombre))return 'audio';
  if(mime==='application/pdf'||/\.pdf$/i.test(nombre))return 'pdf';
  return 'archivo';
};
const icono=t=>({imagen:'fa-image',video:'fa-file-video',audio:'fa-headphones',pdf:'fa-file-pdf',archivo:'fa-file-lines'}[t]);

export function ordenarArchivosPorPortada(archivos=[],url=''){
  if(!url)return [...archivos];
  const indice=archivos.findIndex(a=>normalizarUrlImagen(a.archivo?.url||a.url)===normalizarUrlImagen(url));
  return indice>0?[archivos[indice],...archivos.slice(0,indice),...archivos.slice(indice+1)]:[...archivos];
}

export function crearGestorArchivosAgenda(){
  const host=document.getElementById('subidosGestorArchivos'),input=document.getElementById('subidosArchivo');
  if(!host||!input)return null;
  const portadaInput=document.getElementById('subidosPortadaArchivo');
  let existentes=[],pendientes=[],elegida='',portadaInicialId='',manual=false,elegidaEn=0,bloqueado=false;
  const todos=()=>[...existentes,...pendientes];
  const firma=f=>[f.name,f.size,f.lastModified,f.type].join('|');
  const aviso=texto=>{const e=document.getElementById('subidosArchivosAviso');if(e)e.textContent=texto;};
  function limpiar(){for(const p of pendientes)if(p.preview)URL.revokeObjectURL(p.preview);pendientes=[];}
  function predeterminada(){
    if(!todos().some(a=>a.id===elegida&&a.tipo==='imagen'))elegida=portadaInicialId||todos().find(a=>a.tipo==='imagen')?.id||'';
  }
  function pintarPortada(){
    const a=todos().find(a=>a.id===elegida),preview=document.getElementById('subidosPortadaPreview'),nombre=document.getElementById('subidosPortadaNombre');
    if(preview)preview.innerHTML=a?`<img data-va-imagen src="${esc(a.preview||a.url)}" alt="${esc(a.nombre)}" decoding="async">`:'<div class="subidos-portada-vacia"><i class="fa-regular fa-image" aria-hidden="true"></i><span>Carátula</span></div>';
    if(nombre)nombre.textContent=a?.nombre||'Sin imagen seleccionada';
    for(const tile of host.querySelectorAll('[data-archivo]')){
      const activo=tile.dataset.archivo===elegida;tile.classList.toggle('es-portada',activo);
      const btn=tile.querySelector('[data-elegir-portada]');if(btn)btn.setAttribute('aria-pressed',String(activo));
      const badge=tile.querySelector('.subidos-portada-badge');if(badge)badge.hidden=!activo;
    }
  }
  function pintar(){
    predeterminada();
    const lista=todos(),count=document.getElementById('subidosArchivosCantidad');
    if(count)count.textContent=`${lista.length} ${lista.length===1?'archivo':'archivos'}${pendientes.length?' · '+pendientes.length+' por subir':''}`;
    host.innerHTML=lista.length?lista.map((a,i)=>{
      const media=a.tipo==='imagen'?`<img data-va-imagen src="${esc(a.preview||a.url)}" alt="${esc(a.nombre)}" loading="${i<4?'eager':'lazy'}" decoding="async" draggable="false">`:`<i class="fa-solid ${icono(a.tipo)}" aria-hidden="true"></i>`;
      return `<article class="subidos-archivo-tile${a.id===elegida?' es-portada':''}" data-archivo="${esc(a.id)}"><div class="subidos-archivo-thumb" data-va-imagen-host>${a.tipo==='imagen'?`<button type="button" data-elegir-portada="${esc(a.id)}" aria-label="Usar ${esc(a.nombre)} como carátula" aria-pressed="${a.id===elegida}" ${bloqueado?'disabled':''}>${media}</button>`:media}<span class="subidos-portada-badge" ${a.id===elegida?'':'hidden'}><i class="fa-solid fa-star" aria-hidden="true"></i> Carátula</span>${a.file?`<button type="button" class="subidos-quitar-pendiente" data-quitar="${esc(a.id)}" aria-label="Quitar ${esc(a.nombre)}" ${bloqueado?'disabled':''}>×</button>`:''}</div><strong title="${esc(a.nombre)}">${esc(a.nombre)}</strong><small data-estado-archivo>${a.file?'Por subir':'Guardado'}</small></article>`;
    }).join(''):'<div class="subidos-archivos-vacio"><i class="fa-solid fa-images" aria-hidden="true"></i><span>Agregá imágenes, videos, audio o PDF</span></div>';
    pintarPortada();
  }
  function elegir(id){
    if(bloqueado||!todos().some(a=>a.id===id&&a.tipo==='imagen'))return;
    elegida=id;manual=true;elegidaEn=Date.now();pintarPortada();
  }
  function agregar(files,comoPortada=false){
    if(bloqueado)return;
    const firmas=new Set(pendientes.map(a=>firma(a.file)));let primera='',rechazados=0;
    for(const file of files){
      const t=tipo(file);if(t==='archivo'||(comoPortada&&t!=='imagen')){rechazados++;continue;}
      const repetida=pendientes.find(a=>firma(a.file)===firma(file));
      if(firmas.has(firma(file))){if(!primera&&repetida)primera=repetida.id;continue;}
      const id='nuevo_'+(crypto.randomUUID?.()||Date.now()+'_'+Math.random());
      pendientes.push({id,file,tipo:t,nombre:file.name,preview:t==='imagen'?URL.createObjectURL(file):''});firmas.add(firma(file));if(!primera)primera=id;
    }
    if(comoPortada&&primera){elegida=primera;manual=true;elegidaEn=Date.now();}
    aviso(rechazados?'Algunos archivos no tienen un formato compatible.':'');pintar();
  }
  input.addEventListener('change',()=>{agregar([...input.files]);input.value='';});
  portadaInput?.addEventListener('change',()=>{agregar([...portadaInput.files],true);portadaInput.value='';});
  host.addEventListener('click',e=>{
    const elegirBtn=e.target.closest('[data-elegir-portada]');if(elegirBtn){elegir(elegirBtn.dataset.elegirPortada);return;}
    const quitar=e.target.closest('[data-quitar]');if(!quitar||bloqueado)return;
    const p=pendientes.find(p=>p.id===quitar.dataset.quitar);if(p?.preview)URL.revokeObjectURL(p.preview);
    pendientes=pendientes.filter(p=>p.id!==quitar.dataset.quitar);if(elegida===quitar.dataset.quitar){elegida='';manual=false;elegidaEn=0;}pintar();
  });
  const drop=document.getElementById('subidosZonaArchivos');
  drop?.addEventListener('dragover',e=>{e.preventDefault();if(!bloqueado)drop.classList.add('arrastrando');});
  drop?.addEventListener('dragleave',e=>{if(!drop.contains(e.relatedTarget))drop.classList.remove('arrastrando');});
  drop?.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('arrastrando');agregar([...(e.dataTransfer?.files||[])]);});
  document.getElementById('subidosVerPortada')?.addEventListener('click',()=>{
    if(bloqueado)return;const a=todos().find(a=>a.id===elegida);if(!a)return;
    if(typeof window.compAbrirMedia==='function')window.compAbrirMedia(a.preview||a.url,'imagen',a.nombre);
    else window.open(a.preview||a.url,'_blank','noopener');
  });
  return {
    reiniciar(archivos=[],portadaUrl=''){
      limpiar();existentes=archivos.map((a,i)=>({id:'guardado_'+i,url:normalizarUrlImagen(a.url),nombre:a.fileName||'Archivo '+(i+1),tipo:tipo(a)}));
      elegida=existentes.find(a=>a.url===normalizarUrlImagen(portadaUrl)&&a.tipo==='imagen')?.id||'';portadaInicialId=elegida;manual=false;elegidaEn=0;aviso('');pintar();
    },
    pendientes:()=>pendientes.map(p=>({id:p.id,file:p.file})),
    seleccion:()=>{const a=todos().find(a=>a.id===elegida);return {id:a?.id||'',url:a?.url||'',manual,elegidaEn};},
    bloquear(valor){bloqueado=!!valor;for(const b of host.querySelectorAll('button'))b.disabled=bloqueado;if(!bloqueado)for(const p of pendientes){const tile=[...host.querySelectorAll('[data-archivo]')].find(el=>el.dataset.archivo===p.id);if(tile){tile.querySelector('[data-estado-archivo]').textContent='Por subir';tile.classList.remove('archivo-listo');}}},
    estadoArchivo(id,texto){const tile=[...host.querySelectorAll('[data-archivo]')].find(el=>el.dataset.archivo===id);if(tile){tile.querySelector('[data-estado-archivo]').textContent=texto;tile.classList.toggle('archivo-listo',texto==='Subido');}},
    vaciar(){limpiar();existentes=[];elegida='';portadaInicialId='';manual=false;elegidaEn=0;pintar();}
  };
}
