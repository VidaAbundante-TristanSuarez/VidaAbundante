const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const urlSegura=valor=>{try{const u=new URL(String(valor||''),location.href);return ['https:','http:','blob:'].includes(u.protocol)?u.href:'';}catch{return '';}};
let modal=null,foco=null;

export function botonAdjuntosHTML(archivos=[],{etiqueta='PDF',titulo='PDF adjuntos',descargar='subidos'}={}){
  const documentos=archivos.filter(a=>urlSegura(a?.url)).map(a=>({url:urlSegura(a.url),fileName:String(a.fileName||'Documento.pdf'),detalle:String(a.detalle||'')}));
  if(!documentos.length)return '';
  const payload=esc(JSON.stringify({documentos,titulo,descargar}));
  return `<div class="va-adjuntos-acceso" onclick="event.stopPropagation()"><button type="button" class="va-adjuntos-boton" data-va-adjuntos="${payload}" onclick="vaAbrirAdjuntos(this)" aria-label="${esc(etiqueta)}: ver ${documentos.length} adjunto${documentos.length===1?'':'s'}" aria-haspopup="dialog"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i> ${esc(etiqueta)}</button></div>`;
}

function cerrar(){
  if(!modal)return;modal.hidden=true;document.body.classList.remove('va-adjuntos-abiertos');modal.querySelector('.va-adjuntos-lista').replaceChildren();foco?.focus();
}
function asegurarModal(){
  if(modal)return modal;
  modal=document.createElement('div');modal.id='vaAdjuntosModal';modal.className='va-adjuntos-overlay';modal.hidden=true;
  modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','vaAdjuntosTitulo');
  modal.innerHTML='<div class="va-adjuntos-card"><div class="va-adjuntos-head"><h3 id="vaAdjuntosTitulo">PDF adjuntos</h3><button type="button" onclick="vaCerrarAdjuntos()" aria-label="Cerrar adjuntos">×</button></div><div class="va-adjuntos-lista"></div></div>';
  modal.addEventListener('click',e=>{if(e.target===modal)cerrar();});
  document.addEventListener('keydown',e=>{
    if(modal.hidden)return;
    if(e.key==='Escape'){e.preventDefault();cerrar();}
    if(e.key==='Tab'){
      const els=[...modal.querySelectorAll('a,button:not(:disabled)')];
      if(!modal.contains(document.activeElement)){e.preventDefault();els[0]?.focus();}
      else if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}
      else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}
    }
  });document.body.appendChild(modal);return modal;
}
window.vaCerrarAdjuntos=cerrar;
window.vaAbrirAdjuntos=function(btn){
  let datos;try{datos=JSON.parse(btn.dataset.vaAdjuntos);}catch{return;}
  if(!Array.isArray(datos.documentos))return;
  asegurarModal();foco=btn;
  modal.querySelector('#vaAdjuntosTitulo').textContent=String(datos.titulo||'PDF adjuntos');
  modal.querySelector('.va-adjuntos-lista').innerHTML=datos.documentos.filter(a=>urlSegura(a.url)).map(a=>`<div class="va-documento"><i class="fa-solid fa-file-pdf" aria-hidden="true"></i><div class="va-documento-nombre"><strong title="${esc(a.fileName)}">${esc(a.fileName)}</strong>${a.detalle?`<small>${esc(a.detalle)}</small>`:''}</div><div class="va-documento-acciones"><a href="${esc(urlSegura(a.url))}" target="_blank" rel="noopener noreferrer" aria-label="Abrir ${esc(a.fileName)}">Abrir</a><button type="button" data-url="${esc(urlSegura(a.url))}" data-nombre="${esc(a.fileName)}" data-modo="${datos.descargar==='comp'?'comp':'subidos'}" onclick="vaDescargarAdjunto(this)" aria-label="Descargar ${esc(a.fileName)}"><i class="fa-solid fa-download" aria-hidden="true"></i> Descargar</button></div></div>`).join('');
  modal.hidden=false;document.body.classList.add('va-adjuntos-abiertos');modal.querySelector('[aria-label="Cerrar adjuntos"]').focus();
};
window.vaDescargarAdjunto=async function(btn){
  if(btn.disabled)return;
  if(btn.dataset.modo!=='comp'&&typeof window.subidosDescargarAdjunto==='function')return window.subidosDescargarAdjunto(btn);
  if(typeof window.compDescargarUrl!=='function')return;
  btn.disabled=true;
  try{await window.compDescargarUrl(btn.dataset.url,btn.dataset.nombre);}
  finally{btn.disabled=false;}
};
