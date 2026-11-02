const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const puede=()=>!!window.__UID&&!!(window.__ES_ADMIN||window.__ES_COLABORADOR);
const defecto=()=>[{id:'saludo',titulo:'Saludo y bendición',texto:'Hola hermano, Dios te bendiga.'}];

export function numeroWhatsApp(valor=''){
  const raw=String(valor).trim();let n=raw.replace(/\D/g,'');
  if(raw.startsWith('00'))n=n.slice(2);
  if(/^549\d{10}$/.test(n))return n;
  if(/^54\d{10}$/.test(n))return '549'+n.slice(2);
  if(raw.startsWith('+')||raw.startsWith('00'))return /^[1-9]\d{7,14}$/.test(n)?n:'';
  n=n.replace(/^0+/,'');
  if(n.length===12)n=n.replace(/^(\d{2,4})15(\d{6,8})$/,'$1$2').replace(/^15(?=\d{10}$)/,'');
  return /^\d{10}$/.test(n)?'549'+n:'';
}

export function crearMensajesHermanos({obtenerHermanos}){
  const marcados=new Set(),cuentas=new Map();let sesion=null,modal=null,editar=null,uidSeleccion=window.__UID;
  const clave=uid=>'va-mensajes-hermanos-v1:'+uid;
  const claveSesion=()=> 'va-wpp-hermanos-sesion-v1:'+window.__UID;
  const leer=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const listaValida=items=>Object.values(items||{}).filter(p=>p&&typeof p.id==='string'&&typeof p.titulo==='string'&&typeof p.texto==='string').map(p=>({id:p.id,titulo:p.titulo,texto:p.texto}));
  function estado(){
    const uid=String(window.__UID||'');if(!cuentas.has(uid)){
      const local=leer(localStorage,clave(uid));
      const datos={uid,items:local?listaValida(local.items):defecto(),modificado:Number(local?.modificado)||0,pendiente:!!local?.pendiente,cola:Promise.resolve()};
      cuentas.set(uid,datos);
      if(puede())cargarNube(datos);
    }
    return cuentas.get(uid);
  }
  function guardarLocal(datos){
    try{localStorage.setItem(clave(datos.uid),JSON.stringify({items:datos.items,modificado:datos.modificado,pendiente:datos.pendiente}));return true;}
    catch{estadoTexto('No se pudo guardar en este dispositivo.');return false;}
  }
  function estadoTexto(texto){const el=modal?.querySelector('#hMensajeEstado');if(el)el.textContent=texto;}
  async function cargarNube(datos){
    const api=window.__FB_API,db=window.__FB?.db;if(!api?.get||!db)return;
    try{
      const snap=await api.get(api.ref(db,`usuarios/${datos.uid}/mensajesHermanos`)),remoto=snap.val();
      if(remoto&&Number(remoto.modificado)>datos.modificado&&!datos.pendiente){
        datos.items=listaValida(remoto.items);datos.modificado=Number(remoto.modificado);guardarLocal(datos);
        if(window.__UID===datos.uid&&modal&&!modal.hidden)renderPlantillas();
      }else if(datos.pendiente)sincronizar(datos);
    }catch{if(modal&&!modal.hidden)estadoTexto('Los mensajes guardados en este dispositivo siguen disponibles.');}
  }
  function sincronizar(datos){
    const api=window.__FB_API,db=window.__FB?.db,version=datos.modificado;
    const payload={modificado:version,items:Object.fromEntries(datos.items.map(p=>[p.id,{...p}]))};
    if(!api?.set||!db){estadoTexto('Guardado en este dispositivo.');return;}
    datos.cola=datos.cola.catch(()=>{}).then(async()=>{
      try{
        await api.set(api.ref(db,`usuarios/${datos.uid}/mensajesHermanos`),payload);
        if(datos.modificado===version){datos.pendiente=false;guardarLocal(datos);if(window.__UID===datos.uid)estadoTexto('Mensaje guardado.');}
      }catch{if(window.__UID===datos.uid)estadoTexto('Guardado en este dispositivo; falta sincronizar con tu cuenta.');}
    });
  }
  function guardarPlantillas(){const datos=estado();datos.modificado=Math.max(Date.now(),datos.modificado+1);datos.pendiente=true;guardarLocal(datos);sincronizar(datos);}
  function guardarSesion(){
    if(!sesion||!sesion.contactos.length)return;
    try{sessionStorage.setItem(claveSesion(),JSON.stringify({ids:sesion.contactos.map(h=>h.id),indice:sesion.indice,texto:sesion.texto,plantilla:sesion.plantilla,abiertos:[...sesion.abiertos]}));}catch{}
  }
  function contactos(ids){
    return ids.map(id=>obtenerHermanos().find(h=>h.id===id)).filter(Boolean).map(h=>({id:h.id,nombre:`${h.nombre||''} ${h.apellido||''}`.trim()||'Sin nombre',telefono:h.telefono||'',numero:numeroWhatsApp(h.telefono)}));
  }
  function asegurarModal(){
    if(modal)return modal;
    modal=document.createElement('div');modal.id='hMensajesModal';modal.className='h-mensajes-overlay';modal.hidden=true;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','hMensajesTitulo');
    modal.innerHTML=`<div class="h-mensajes-card"><div class="h-mensajes-head"><h3 id="hMensajesTitulo">Mensaje a hermanos</h3><button type="button" onclick="hCerrarMensajes()" aria-label="Cerrar mensajes">×</button></div><div class="h-mensajes-cuerpo"><div id="hMensajeDestinatario"></div><div id="hMensajeRecorrido" class="h-mensajes-recorrido" aria-label="Destinatarios"></div><p id="hMensajeAviso" role="status"></p><label for="hMensajePlantilla">Mensajes predeterminados</label><div class="h-mensajes-plantillas"><select id="hMensajePlantilla" onchange="hElegirMensaje(this.value)"></select><button type="button" onclick="hNuevoMensaje()">+ Nuevo</button><button id="hMensajeEditar" type="button" onclick="hEditarMensaje()">Editar</button><button id="hMensajeBorrar" type="button" onclick="hBorrarMensaje()" aria-label="Borrar mensaje predeterminado">Borrar</button></div><div id="hMensajeEditor" hidden><label for="hMensajeNombre">Título del mensaje</label><input id="hMensajeNombre" maxlength="100"><div class="h-mensajes-editor-acciones"><button type="button" onclick="hGuardarMensaje()">Guardar mensaje</button><button type="button" onclick="hCancelarEdicionMensaje()">Cancelar</button></div></div><label for="hMensajeTexto">Mensaje</label><textarea id="hMensajeTexto" rows="6" oninput="hCambiarTextoMensaje(this.value)"></textarea><div id="hMensajeEstado" class="h-mensajes-estado" role="status"></div></div><div class="h-mensajes-envio"><button id="hMensajeAnterior" type="button" onclick="hMoverMensaje(-1)">‹ Anterior</button><button id="hMensajeAbrir" type="button" onclick="hAbrirChatMensaje()"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Abrir WhatsApp</button><button id="hMensajeSiguiente" type="button" onclick="hMoverMensaje(1,true)">Siguiente ›</button></div><p class="h-mensajes-ayuda">Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.</p></div>`;
    modal.addEventListener('click',e=>{if(e.target===modal)window.hCerrarMensajes();});
    modal.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();window.hCerrarMensajes();}
      if(e.key==='Tab'){
        const items=[...modal.querySelectorAll('button:not(:disabled),select,input,textarea')].filter(el=>el.getClientRects().length);
        if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1)?.focus();}
        else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0]?.focus();}
      }
    });
    document.body.appendChild(modal);return modal;
  }
  function renderPlantillas(){
    if(!modal||!sesion)return;
    const select=modal.querySelector('#hMensajePlantilla'),datos=estado();
    if(!datos.items.some(p=>p.id===sesion.plantilla))sesion.plantilla='';
    select.innerHTML='<option value="">Mensaje libre</option>'+datos.items.map(p=>`<option value="${escapar(p.id)}">${escapar(p.titulo)}</option>`).join('');select.value=sesion.plantilla;
    modal.querySelector('#hMensajeEditar').disabled=!sesion.plantilla;modal.querySelector('#hMensajeBorrar').disabled=!sesion.plantilla;
  }
  function renderSesion(){
    if(!modal||!sesion)return;
    const h=sesion.contactos[sesion.indice],total=sesion.contactos.length;
    modal.querySelector('#hMensajeDestinatario').innerHTML=h?`<strong>${escapar(h.nombre)}</strong><span>${escapar(h.telefono)} · ${sesion.indice+1} de ${total}</span>`:'<span>Marcá contactos para iniciar el recorrido por WhatsApp.</span>';
    modal.querySelector('#hMensajeRecorrido').innerHTML=sesion.contactos.map((h,i)=>`<button type="button" data-indice="${i}" onclick="hIrAMensaje(this.dataset.indice)" aria-pressed="${i===sesion.indice}">${escapar(h.nombre)}${sesion.abiertos.has(h.id)?' ✓':''}</button>`).join('');
    modal.querySelector('#hMensajeTexto').value=sesion.texto;
    modal.querySelector('#hMensajeAnterior').disabled=!h||sesion.indice===0;
    modal.querySelector('#hMensajeSiguiente').disabled=!h||sesion.indice>=total-1||!sesion.texto.trim();
    const abrir=modal.querySelector('#hMensajeAbrir');abrir.disabled=!h||!sesion.texto.trim();abrir.innerHTML=`<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${h&&sesion.abiertos.has(h.id)?'Abrir de nuevo':'Abrir WhatsApp'}`;
    modal.querySelector('.h-mensajes-ayuda').textContent=sesion.abiertos.size?`${sesion.abiertos.size} de ${total} chats abiertos. Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.`:'Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.';
    renderPlantillas();
  }
  function abrirSesion(nueva,aviso=''){
    asegurarModal();modal.__foco=document.activeElement;sesion=nueva;editar=null;
    modal.querySelector('#hMensajeEditor').hidden=true;modal.querySelector('#hMensajeAviso').textContent=aviso;
    modal.hidden=false;document.body.classList.add('h-mensajes-abierto');renderSesion();guardarSesion();
    modal.querySelector('#hMensajeTexto').focus();
  }
  window.hAbrirMensajesHermanos=function(id=''){
    if(!puede())return;
    const todos=contactos(id?[id]:[...marcados]),validos=todos.filter(h=>h.numero),sinTelefono=todos.filter(h=>!h.numero);
    const datos=estado(),plantilla=datos.items[0];
    abrirSesion({uid:window.__UID,contactos:validos,indice:0,texto:plantilla?.texto||'',plantilla:plantilla?.id||'',abiertos:new Set()},sinTelefono.length?`Revisá el teléfono de: ${sinTelefono.map(h=>h.nombre).join(', ')}. No se incluyeron en el recorrido.`:'');
  };
  window.hContinuarMensajes=function(){
    if(!puede())return;
    const guardado=leer(sessionStorage,claveSesion());if(!guardado)return;
    const validos=contactos(guardado.ids||[]).filter(h=>h.numero);if(!validos.length)return;
    abrirSesion({uid:window.__UID,contactos:validos,indice:Math.min(Math.max(0,Number(guardado.indice)||0),validos.length-1),texto:String(guardado.texto||''),plantilla:String(guardado.plantilla||''),abiertos:new Set(guardado.abiertos||[])});
  };
  window.hCerrarMensajes=function(){if(!modal)return;guardarSesion();modal.hidden=true;document.body.classList.remove('h-mensajes-abierto');modal.__foco?.focus();actualizar();};
  window.hCambiarTextoMensaje=function(texto){if(!sesion)return;sesion.texto=texto;guardarSesion();modal.querySelector('#hMensajeAbrir').disabled=!sesion.contactos.length||!texto.trim();modal.querySelector('#hMensajeSiguiente').disabled=sesion.indice>=sesion.contactos.length-1||!texto.trim();};
  window.hElegirMensaje=function(id){if(!puede()||!sesion||sesion.uid!==window.__UID)return;const p=estado().items.find(p=>p.id===id);sesion.plantilla=p?.id||'';if(p)sesion.texto=p.texto;editar=null;modal.querySelector('#hMensajeEditor').hidden=true;estadoTexto('');renderSesion();guardarSesion();};
  window.hNuevoMensaje=function(){if(!puede()||!sesion||sesion.uid!==window.__UID)return;editar={id:''};modal.querySelector('#hMensajeNombre').value='';modal.querySelector('#hMensajeEditor').hidden=false;modal.querySelector('#hMensajeNombre').focus();};
  window.hEditarMensaje=function(){if(!puede()||!sesion||sesion.uid!==window.__UID)return;const p=estado().items.find(p=>p.id===sesion.plantilla);if(!p)return;editar={id:p.id};modal.querySelector('#hMensajeNombre').value=p.titulo;modal.querySelector('#hMensajeEditor').hidden=false;modal.querySelector('#hMensajeNombre').focus();};
  window.hCancelarEdicionMensaje=function(){editar=null;modal.querySelector('#hMensajeEditor').hidden=true;};
  window.hGuardarMensaje=function(){
    if(!puede()||!editar||!sesion||sesion.uid!==window.__UID)return;
    const titulo=modal.querySelector('#hMensajeNombre').value.trim(),texto=sesion.texto.trim();
    if(!titulo||!texto){estadoTexto('Completá el título y el mensaje.');return;}
    const datos=estado(),id=editar.id||'m_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7),p={id,titulo,texto};
    const i=datos.items.findIndex(p=>p.id===id);if(i<0)datos.items.push(p);else datos.items[i]=p;
    sesion.plantilla=id;editar=null;modal.querySelector('#hMensajeEditor').hidden=true;guardarPlantillas();renderPlantillas();guardarSesion();
  };
  window.hBorrarMensaje=function(){if(!puede()||!sesion||sesion.uid!==window.__UID)return;const datos=estado(),p=datos.items.find(p=>p.id===sesion.plantilla);if(!p||!confirm(`¿Borrar el mensaje «${p.titulo}»?`))return;datos.items=datos.items.filter(item=>item.id!==p.id);sesion.plantilla='';editar=null;modal.querySelector('#hMensajeEditor').hidden=true;guardarPlantillas();renderPlantillas();guardarSesion();};
  window.hIrAMensaje=function(indice){if(!sesion)return;const i=Number(indice);if(!Number.isInteger(i)||!sesion.contactos[i])return;sesion.indice=i;renderSesion();guardarSesion();};
  window.hMoverMensaje=function(paso,abrir=false){if(!sesion)return;const i=sesion.indice+paso;if(!sesion.contactos[i])return;window.hIrAMensaje(i);if(abrir)window.hAbrirChatMensaje();};
  window.hAbrirChatMensaje=function(){
    if(!puede()||!sesion||sesion.uid!==window.__UID||!sesion.texto.trim())return;
    const h=sesion.contactos[sesion.indice];if(!h)return;
    const actual=obtenerHermanos().find(x=>x.id===h.id),numero=numeroWhatsApp(actual?.telefono);
    if(!numero){estadoTexto('Revisá el teléfono del contacto antes de abrir WhatsApp.');return;}
    sesion.abiertos.add(h.id);guardarSesion();renderSesion();
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(sesion.texto)}`,'_blank','noopener,noreferrer');
  };
  window.hMarcarContacto=function(id,marcar){if(!puede())return;if(marcar)marcados.add(id);else marcados.delete(id);actualizar();};
  window.hMarcarContactosVisibles=function(){
    if(!puede())return;const checks=[...document.querySelectorAll('#hermanosLista .h-contacto-check')],marcar=checks.some(el=>!el.checked);
    for(const el of checks){el.checked=marcar;if(marcar)marcados.add(el.dataset.id);else marcados.delete(el.dataset.id);}actualizar();
  };
  window.hLimpiarContactos=function(){marcados.clear();document.querySelectorAll('.h-contacto-check').forEach(el=>el.checked=false);actualizar();};
  function actualizar(){
    if(uidSeleccion!==window.__UID){marcados.clear();uidSeleccion=window.__UID;if(sesion&&sesion.uid!==window.__UID){sesion=null;if(modal){modal.hidden=true;document.body.classList.remove('h-mensajes-abierto');}}}
    const ids=new Set(obtenerHermanos().map(h=>h.id));for(const id of marcados)if(!ids.has(id))marcados.delete(id);
    const contador=document.getElementById('hContactosCantidad');if(contador)contador.textContent=`${marcados.size} seleccionado${marcados.size===1?'':'s'}`;
    const envio=document.getElementById('hContactosEnviar');if(envio)envio.disabled=!marcados.size||!puede();
    const limpiar=document.getElementById('hContactosLimpiar');if(limpiar)limpiar.disabled=!marcados.size;
    const continuar=document.getElementById('hContactosContinuar'),guardado=leer(sessionStorage,claveSesion());if(continuar)continuar.hidden=!puede()||!guardado?.ids?.length;
  }
  return {
    barraHTML:()=>`<div class="h-contactos-mensajes"><button type="button" onclick="hMarcarContactosVisibles()">Marcar visibles</button><span id="hContactosCantidad">0 seleccionados</span><button id="hContactosLimpiar" type="button" onclick="hLimpiarContactos()" disabled>Limpiar</button><button id="hContactosEnviar" type="button" onclick="hAbrirMensajesHermanos()" disabled><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Mensaje</button><button type="button" onclick="hAbrirMensajesHermanos()" title="Administrar mensajes predeterminados">Mensajes guardados</button><button id="hContactosContinuar" type="button" onclick="hContinuarMensajes()" hidden>Continuar mensajes</button></div>`,
    marcaHTML:h=>`<label class="h-contacto-marca" title="Seleccionar ${escapar((h.nombre||'')+' '+(h.apellido||''))}"><input type="checkbox" class="h-contacto-check" data-id="${escapar(h.id)}" ${marcados.has(h.id)?'checked':''} onchange="hMarcarContacto(this.dataset.id,this.checked)" aria-label="Seleccionar ${escapar((h.nombre||'')+' '+(h.apellido||''))}"></label>`,
    actualizar
  };
}
