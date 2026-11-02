import { necesidadesParaMensaje, listadoColecta, mensajeSugeridoColecta } from './colectas.js?v=20261102-colectas-11';
const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const puede=()=>!!window.__UID&&!!(window.__ES_ADMIN||window.__ES_COLABORADOR);
const sugeridosColecta=()=>[{id:'colecta_invitacion',titulo:'Colecta: invitación a colaborar',texto:mensajeSugeridoColecta()},{id:'colecta_recordatorio',titulo:'Colecta: recordar lo que falta',texto:mensajeSugeridoColecta({},true)}];
const defecto=()=>[{id:'saludo',titulo:'Saludo y bendición',texto:'Hola hermano, Dios te bendiga.'},...sugeridosColecta()];

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

export function crearMensajesHermanos({obtenerHermanos,obtenerColectas=async()=>[]}){
  const marcados=new Set(),cuentas=new Map();let sesion=null,modal=null,editar=null,uidSeleccion=window.__UID;
  let colectasDisponibles=[],uidColectas='',revisionCarga=0;
  const clave=uid=>'va-mensajes-hermanos-v1:'+uid;
  const claveSesion=()=> 'va-wpp-hermanos-sesion-v1:'+window.__UID;
  const leer=(storage,key)=>{try{return JSON.parse(storage.getItem(key)||'null');}catch{return null;}};
  const listaValida=items=>Object.values(items||{}).filter(p=>p&&typeof p.id==='string'&&typeof p.titulo==='string'&&typeof p.texto==='string').map(p=>({id:p.id,titulo:p.titulo,texto:p.texto}));
  function estado(){
    const uid=String(window.__UID||'');if(!cuentas.has(uid)){
      const local=leer(localStorage,clave(uid));
      const datos={uid,items:local?listaValida(local.items):defecto(),modificado:Number(local?.modificado)||0,pendiente:!!local?.pendiente,sugeridosVersion:Number(local?.sugeridosVersion)||0,cola:Promise.resolve()};
      if(!local)datos.sugeridosVersion=1;
      migrarSugeridos(datos);cuentas.set(uid,datos);guardarLocal(datos);
      if(puede())cargarNube(datos);
    }
    return cuentas.get(uid);
  }
  function guardarLocal(datos){
    try{localStorage.setItem(clave(datos.uid),JSON.stringify({items:datos.items,modificado:datos.modificado,pendiente:datos.pendiente,sugeridosVersion:datos.sugeridosVersion}));return true;}
    catch{estadoTexto('No se pudo guardar en este dispositivo.');return false;}
  }
  function estadoTexto(texto){const el=modal?.querySelector('#hMensajeEstado');if(el)el.textContent=texto;}
  async function cargarNube(datos){
    const api=window.__FB_API,db=window.__FB?.db;if(!api?.get||!db)return;
    try{
      const snap=await api.get(api.ref(db,`usuarios/${datos.uid}/mensajesHermanos`)),remoto=snap.val();
      if(remoto&&Number(remoto.modificado)>datos.modificado&&!datos.pendiente){
        datos.items=listaValida(remoto.items);datos.modificado=Number(remoto.modificado);datos.sugeridosVersion=Number(remoto.sugeridosVersion)||0;migrarSugeridos(datos);guardarLocal(datos);
        if(window.__UID===datos.uid&&modal&&!modal.hidden)renderPlantillas();
      }else if(datos.pendiente)sincronizar(datos);
    }catch{if(modal&&!modal.hidden)estadoTexto('Los mensajes guardados en este dispositivo siguen disponibles.');}
  }
  function sincronizar(datos){
    const api=window.__FB_API,db=window.__FB?.db,version=datos.modificado;
    const payload={modificado:version,sugeridosVersion:datos.sugeridosVersion,items:Object.fromEntries(datos.items.map(p=>[p.id,{...p}]))};
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
    try{sessionStorage.setItem(claveSesion(),JSON.stringify({ids:sesion.contactos.map(h=>h.id),indice:sesion.indice,texto:sesion.texto,plantilla:sesion.plantilla,colecta:sesion.colecta||null,listado:sesion.listado||'',abiertos:[...sesion.abiertos]}));}catch{}
  }
  function contactos(ids){
    return ids.map(id=>obtenerHermanos().find(h=>h.id===id)).filter(Boolean).map(h=>({id:h.id,nombre:`${h.nombre||''} ${h.apellido||''}`.trim()||'Sin nombre',telefono:h.telefono||'',numero:numeroWhatsApp(h.telefono)}));
  }
  function migrarSugeridos(datos){
    if(datos.sugeridosVersion>=1)return;
    for(const p of sugeridosColecta())if(!datos.items.some(it=>it.id===p.id))datos.items.push(p);
    datos.sugeridosVersion=1;
  }
  function textoCompleto(){return [sesion?.texto?.trim(),sesion?.colecta?String(sesion.listado||'').trim():''].filter(Boolean).join('\n\n');}
  function mensajeListo(){return !!textoCompleto()&&(!sesion?.colecta||!!String(sesion.listado||'').trim());}
  function puedeSiguiente(){return !!sesion&&sesion.indice<sesion.contactos.length-1&&(sesion.colecta?.modo==='asignado'||mensajeListo());}
  function actualizarEnvio(){
    if(!modal||!sesion)return;
    modal.querySelector('#hMensajeAbrir').disabled=!sesion.contactos.length||!mensajeListo();
    modal.querySelector('#hMensajeSiguiente').disabled=!puedeSiguiente();
  }
  function textoDePlantilla(p){
    const base=sugeridosColecta().find(it=>it.id===p.id);
    return sesion?.colecta&&base&&p.texto===base.texto?mensajeSugeridoColecta(sesion.colecta.datos,p.id==='colecta_recordatorio'):p.texto;
  }
  function opcionesListado(sinSeleccion=false){
    const a=sesion?.colecta;
    return {modo:a?.modo||'pendientes',costos:!!a?.costos,hermanoId:sesion?.contactos[sesion.indice]?.id||'',seleccion:sinSeleccion?null:a?.seleccion};
  }
  function regenerarListado(){
    if(!sesion?.colecta)return;
    sesion.listado=listadoColecta(sesion.colecta.datos,opcionesListado());
    const area=modal?.querySelector('#hMensajeListado');if(area)area.value=sesion.listado;
    actualizarEnvio();guardarSesion();
  }
  function renderAdjunto(){
    if(!modal||!sesion)return;
    const a=sesion.colecta,abierto=!!(a||sesion.adjuntoAbierto),panel=modal.querySelector('#hMensajeColectaPanel');
    panel.hidden=!abierto;modal.querySelector('#hMensajeAdjuntarColecta').setAttribute('aria-expanded',String(abierto));
    modal.querySelector('#hMensajeAdjuntarColecta').textContent=a?'Cambiar colecta':'Adjuntar colecta';
    if(!abierto)return;
    const disponibles=[...colectasDisponibles];if(a&&!disponibles.some(c=>c.id===a.id))disponibles.push({id:a.id,...a.datos});
    const select=modal.querySelector('#hMensajeColectaSelect');select.innerHTML='<option value="">Elegí una colecta</option>'+disponibles.map(c=>`<option value="${escapar(c.id)}">${escapar(c.titulo)}${c.estado==='cerrada'?' (cerrada)':''}</option>`).join('');select.value=a?.id||'';
    modal.querySelector('#hMensajeColectaOpciones').hidden=!a;
    if(!a)return;
    modal.querySelector('#hMensajeColectaModo').value=a.modo;modal.querySelector('#hMensajeColectaCostos').checked=!!a.costos;
    const elegibles=necesidadesParaMensaje(a.datos,opcionesListado(true)),seleccion=a.seleccion===null?null:new Set(a.seleccion||[]);
    modal.querySelector('#hMensajeColectaNecesidades').innerHTML=elegibles.map(n=>`<label><input type="checkbox" data-necesidad="${escapar(n.id)}" ${!seleccion||seleccion.has(n.id)?'checked':''} onchange="hMarcarNecesidadColecta(this.dataset.necesidad,this.checked)"><span><strong>${escapar(n.concepto)}</strong><small>${escapar(new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(n.cantidadMensaje))} ${escapar(n.unidad||'unidades')}${n.asignadoNombre?' · Asignado a '+escapar(n.asignadoNombre):''}</small></span></label>`).join('');
    modal.querySelector('#hMensajeListado').value=sesion.listado||'';
    modal.querySelector('#hMensajeColectaAviso').textContent=elegibles.length?'':a.modo==='asignado'?'No hay necesidades pendientes asignadas a este hermano. Podés elegir otro listado.':'No quedan necesidades por cubrir. Podés elegir la lista completa.';
  }
  function capturarColecta(c,anterior=null){
    const aportes=Object.fromEntries(Object.entries(c.aportes||{}).map(([id,a])=>[id,{necesidadId:a.necesidadId,cantidad:a.cantidad,recibido:a.recibido}]));
    return {id:c.id,datos:{titulo:c.titulo||'Colecta',objetivo:c.objetivo||'',detalle:c.detalle||'',fecha:c.fecha||'',necesidades:structuredClone(c.necesidades||{}),aportes},modo:anterior?.modo||'pendientes',costos:!!anterior?.costos,seleccion:anterior?.seleccion??null};
  }
  async function cargarColectas(){
    const uid=window.__UID,revision=++revisionCarga;
    const lista=await obtenerColectas();
    if(uid!==window.__UID||!puede()||revision!==revisionCarga)return false;
    colectasDisponibles=Object.values(lista||{}).filter(c=>c&&c.id&&c.titulo).sort((a,b)=>(a.estado==='cerrada')-(b.estado==='cerrada')||String(b.fecha||'').localeCompare(String(a.fecha||'')));
    uidColectas=uid;return true;
  }
  window.hAdjuntarColecta=async()=>{
    if(!puede()||!sesion||sesion.uid!==window.__UID)return;
    const actual=sesion;sesion.adjuntoAbierto=true;renderAdjunto();
    const aviso=modal.querySelector('#hMensajeColectaAviso');aviso.textContent='Cargando colectas…';
    try{
      if(!await cargarColectas()||sesion!==actual||modal.hidden)return;
      aviso.textContent=colectasDisponibles.length?'':'Todavía no hay colectas creadas.';renderAdjunto();
      if(!sesion.colecta&&colectasDisponibles.length===1)window.hElegirColectaMensaje(colectasDisponibles[0].id);
      else modal.querySelector('#hMensajeColectaSelect').focus();
    }catch{if(sesion===actual)aviso.textContent='No se pudieron cargar las colectas. Intentá de nuevo.';}
  };
  window.hElegirColectaMensaje=id=>{
    if(!puede()||!sesion||sesion.uid!==window.__UID)return;
    if(!id){sesion.colecta=null;sesion.listado='';sesion.adjuntoAbierto=true;renderAdjunto();actualizarEnvio();guardarSesion();return;}
    const c=colectasDisponibles.find(c=>c.id===id);if(!c)return;
    const anterior=sesion.colecta,p=estado().items.find(p=>p.id===sesion.plantilla);
    const predeterminado=p&&sugeridosColecta().some(it=>it.id===p.id&&it.texto===p.texto);
    const actualizarSaludo=predeterminado&&(sesion.texto===p.texto||(anterior&&sesion.texto===mensajeSugeridoColecta(anterior.datos,p.id==='colecta_recordatorio')));
    sesion.colecta=capturarColecta(c);sesion.adjuntoAbierto=true;
    if(actualizarSaludo)sesion.texto=textoDePlantilla(p);
    else if(!sesion.texto.trim()||sesion.texto==='Hola hermano, Dios te bendiga.')sesion.texto=mensajeSugeridoColecta(c);
    regenerarListado();renderSesion();guardarSesion();
  };
  window.hQuitarColectaMensaje=()=>{
    if(!sesion)return;revisionCarga++;sesion.colecta=null;sesion.listado='';sesion.adjuntoAbierto=false;renderAdjunto();actualizarEnvio();guardarSesion();
  };
  window.hModoColectaMensaje=modo=>{
    if(!sesion?.colecta||!['pendientes','completo','asignado'].includes(modo))return;
    sesion.colecta.modo=modo;sesion.colecta.seleccion=null;regenerarListado();renderAdjunto();
  };
  window.hCostosColectaMensaje=incluir=>{if(!sesion?.colecta)return;sesion.colecta.costos=!!incluir;regenerarListado();};
  window.hMarcarNecesidadColecta=(id,marcar)=>{
    const a=sesion?.colecta;if(!a)return;
    const elegibles=necesidadesParaMensaje(a.datos,opcionesListado(true));
    if(!elegibles.some(n=>n.id===id))return;
    const ids=new Set(a.seleccion??elegibles.map(n=>n.id));if(marcar)ids.add(id);else ids.delete(id);a.seleccion=[...ids];regenerarListado();
  };
  window.hUsarSaludoColecta=()=>{
    if(!sesion?.colecta)return;sesion.texto=mensajeSugeridoColecta(sesion.colecta.datos);modal.querySelector('#hMensajeTexto').value=sesion.texto;actualizarEnvio();guardarSesion();
  };
  window.hEditarListadoColecta=texto=>{if(!sesion?.colecta)return;sesion.listado=texto;actualizarEnvio();guardarSesion();};
  window.hActualizarColectaMensaje=async()=>{
    if(!puede()||!sesion?.colecta)return;
    const actual=sesion,id=sesion.colecta.id,aviso=modal.querySelector('#hMensajeColectaAviso');aviso.textContent='Actualizando listado…';
    try{
      if(!await cargarColectas()||sesion!==actual||modal.hidden)return;
      const c=colectasDisponibles.find(c=>c.id===id);if(!c){aviso.textContent='Esta colecta ya no está disponible.';return;}
      sesion.colecta=capturarColecta(c,sesion.colecta);regenerarListado();renderAdjunto();
    }catch{if(sesion===actual)aviso.textContent='No se pudo actualizar el listado. Se conserva el texto que tenías.';}
  };

  function asegurarModal(){
    if(modal)return modal;
    modal=document.createElement('div');modal.id='hMensajesModal';modal.className='h-mensajes-overlay';modal.hidden=true;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','hMensajesTitulo');
    modal.innerHTML=`<div class="h-mensajes-card"><div class="h-mensajes-head"><h3 id="hMensajesTitulo">Mensaje a hermanos</h3><button type="button" onclick="hCerrarMensajes()" aria-label="Cerrar mensajes">×</button></div><div class="h-mensajes-cuerpo"><div id="hMensajeDestinatario"></div><div id="hMensajeRecorrido" class="h-mensajes-recorrido" aria-label="Destinatarios"></div><p id="hMensajeAviso" role="status"></p><label for="hMensajePlantilla">Mensajes predeterminados</label><div class="h-mensajes-plantillas"><select id="hMensajePlantilla" onchange="hElegirMensaje(this.value)"></select><button type="button" onclick="hNuevoMensaje()">+ Nuevo</button><button id="hMensajeEditar" type="button" onclick="hEditarMensaje()">Editar</button><button id="hMensajeBorrar" type="button" onclick="hBorrarMensaje()" aria-label="Borrar mensaje predeterminado">Borrar</button></div><div id="hMensajeEditor" hidden><label for="hMensajeNombre">Título del mensaje</label><input id="hMensajeNombre" maxlength="100"><div class="h-mensajes-editor-acciones"><button type="button" onclick="hGuardarMensaje()">Guardar mensaje</button><button type="button" onclick="hCancelarEdicionMensaje()">Cancelar</button></div></div><label for="hMensajeTexto">Mensaje</label><textarea id="hMensajeTexto" rows="6" oninput="hCambiarTextoMensaje(this.value)"></textarea><div class="h-mensajes-adjuntar"><button id="hMensajeAdjuntarColecta" type="button" onclick="hAdjuntarColecta()" aria-expanded="false"><i class="fa-solid fa-list-check" aria-hidden="true"></i> Adjuntar colecta</button></div><section id="hMensajeColectaPanel" class="h-mensajes-colecta" hidden><div class="h-colecta-adjunto-head"><strong>Colecta adjunta</strong><button type="button" onclick="hQuitarColectaMensaje()" aria-label="Quitar colecta adjunta">×</button></div><label for="hMensajeColectaSelect">Colecta</label><select id="hMensajeColectaSelect" onchange="hElegirColectaMensaje(this.value)"></select><div id="hMensajeColectaOpciones" hidden><label for="hMensajeColectaModo">Qué listado compartimos</label><select id="hMensajeColectaModo" onchange="hModoColectaMensaje(this.value)"><option value="pendientes">Lo que falta cubrir</option><option value="completo">Lista completa</option><option value="asignado">Asignado a este hermano</option></select><label class="h-colecta-costos"><input id="hMensajeColectaCostos" type="checkbox" onchange="hCostosColectaMensaje(this.checked)"> Incluir costos aproximados</label><div id="hMensajeColectaNecesidades" class="h-colecta-adjunto-necesidades"></div><div class="h-colecta-adjunto-acciones"><button type="button" onclick="hUsarSaludoColecta()">Usar mensaje sugerido</button><button type="button" onclick="hActualizarColectaMensaje()">Actualizar listado</button></div><label for="hMensajeListado">Listado que adjuntamos (editable)</label><textarea id="hMensajeListado" rows="5" oninput="hEditarListadoColecta(this.value)"></textarea></div><p id="hMensajeColectaAviso" role="status"></p></section><div id="hMensajeEstado" class="h-mensajes-estado" role="status"></div></div><div class="h-mensajes-envio"><button id="hMensajeAnterior" type="button" onclick="hMoverMensaje(-1)">‹ Anterior</button><button id="hMensajeAbrir" type="button" onclick="hAbrirChatMensaje()"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Abrir WhatsApp</button><button id="hMensajeSiguiente" type="button" onclick="hMoverMensaje(1,true)">Siguiente ›</button></div><p class="h-mensajes-ayuda">Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.</p></div>`;
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
    modal.querySelector('#hMensajeSiguiente').disabled=!h||!puedeSiguiente();
    const abrir=modal.querySelector('#hMensajeAbrir');abrir.disabled=!h||!mensajeListo();abrir.innerHTML=`<i class="fa-brands fa-whatsapp" aria-hidden="true"></i> ${h&&sesion.abiertos.has(h.id)?'Abrir de nuevo':'Abrir WhatsApp'}`;
    modal.querySelector('.h-mensajes-ayuda').textContent=sesion.abiertos.size?`${sesion.abiertos.size} de ${total} chats abiertos. Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.`:'Al volver de WhatsApp, seguí con el próximo hermano. Los mensajes se envían desde cada chat.';
    renderPlantillas();renderAdjunto();
  }
  function abrirSesion(nueva,aviso=''){
    asegurarModal();modal.__foco=document.activeElement;sesion={listado:'',colecta:null,adjuntoAbierto:false,...nueva};editar=null;
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
    abrirSesion({uid:window.__UID,contactos:validos,indice:Math.min(Math.max(0,Number(guardado.indice)||0),validos.length-1),texto:String(guardado.texto||''),plantilla:String(guardado.plantilla||''),colecta:guardado.colecta||null,listado:String(guardado.listado||''),adjuntoAbierto:!!guardado.colecta,abiertos:new Set(guardado.abiertos||[])});
  };
  window.hCerrarMensajes=function(){if(!modal)return;guardarSesion();modal.hidden=true;document.body.classList.remove('h-mensajes-abierto');modal.__foco?.focus();actualizar();};
  window.hCambiarTextoMensaje=function(texto){if(!sesion)return;sesion.texto=texto;guardarSesion();actualizarEnvio();};
  window.hElegirMensaje=function(id){if(!puede()||!sesion||sesion.uid!==window.__UID)return;const p=estado().items.find(p=>p.id===id);sesion.plantilla=p?.id||'';if(p)sesion.texto=textoDePlantilla(p);editar=null;modal.querySelector('#hMensajeEditor').hidden=true;estadoTexto('');renderSesion();guardarSesion();};
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
  window.hIrAMensaje=function(indice){if(!sesion)return;const i=Number(indice);if(!Number.isInteger(i)||!sesion.contactos[i])return;sesion.indice=i;if(sesion.colecta?.modo==='asignado'){sesion.colecta.seleccion=null;regenerarListado();}renderSesion();guardarSesion();};
  window.hMoverMensaje=function(paso,abrir=false){if(!sesion)return;const i=sesion.indice+paso;if(!sesion.contactos[i])return;window.hIrAMensaje(i);if(abrir)window.hAbrirChatMensaje();};
  window.hAbrirChatMensaje=function(){
    if(!puede()||!sesion||sesion.uid!==window.__UID||!mensajeListo())return;
    const h=sesion.contactos[sesion.indice];if(!h)return;
    const actual=obtenerHermanos().find(x=>x.id===h.id),numero=numeroWhatsApp(actual?.telefono);
    if(!numero){estadoTexto('Revisá el teléfono del contacto antes de abrir WhatsApp.');return;}
    sesion.abiertos.add(h.id);guardarSesion();renderSesion();
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoCompleto())}`,'_blank','noopener,noreferrer');
  };
  window.hMarcarContacto=function(id,marcar){if(!puede())return;if(marcar)marcados.add(id);else marcados.delete(id);actualizar();};
  window.hMarcarContactosVisibles=function(){
    if(!puede())return;const checks=[...document.querySelectorAll('#hermanosLista .h-contacto-check')],marcar=checks.some(el=>!el.checked);
    for(const el of checks){el.checked=marcar;if(marcar)marcados.add(el.dataset.id);else marcados.delete(el.dataset.id);}actualizar();
  };
  window.hLimpiarContactos=function(){marcados.clear();document.querySelectorAll('.h-contacto-check').forEach(el=>el.checked=false);actualizar();};
  function actualizar(){
    if(uidSeleccion!==window.__UID){marcados.clear();uidSeleccion=window.__UID;colectasDisponibles=[];uidColectas='';revisionCarga++;if(sesion&&sesion.uid!==window.__UID){sesion=null;if(modal){modal.hidden=true;document.body.classList.remove('h-mensajes-abierto');}}}
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
