const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cantidad=v=>{const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;};
const formato=v=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(v);
const pesos=centavos=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(centavos/100);
const puede=()=>!!window.__UID&&!!(window.__ES_ADMIN||window.__ES_COLABORADOR);
const entradas=obj=>Object.entries(obj||{}).map(([id,it])=>({...it,id}));

export function resumenColecta(colecta={}){
  const aportes=entradas(colecta.aportes),necesidades=entradas(colecta.necesidades);
  const filas=necesidades.map(n=>{
    const relacionados=aportes.filter(a=>a.necesidadId===n.id),prometido=relacionados.reduce((t,a)=>t+cantidad(a.cantidad),0),recibido=relacionados.reduce((t,a)=>t+cantidad(a.recibido),0);
    return {...n,costoCentavos:Math.round(cantidad(n.cantidad)*cantidad(n.precioCentavos)),prometido,recibido,faltaCubrir:Math.max(0,cantidad(n.cantidad)-prometido),faltaRecibir:Math.max(0,cantidad(n.cantidad)-recibido)};
  });
  const necesidadesCentavos=filas.reduce((t,n)=>t+n.costoCentavos,0);
  const otrosCentavos=entradas(colecta.presupuestos).reduce((t,p)=>t+Math.round(cantidad(p.cantidad)*cantidad(p.precioCentavos)),0);
  const totalCentavos=necesidadesCentavos+otrosCentavos;
  return {filas,totalCentavos,necesidadesCentavos,otrosCentavos,pendientes:filas.filter(n=>n.faltaCubrir>0).length,porRecibir:filas.filter(n=>n.faltaRecibir>0).length,aportes:aportes.length};
}

export function csvColecta(colecta={}){
  const celda=v=>{let s=String(v??'');if(typeof v==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  const rows=[['Colecta',colecta.titulo||''],['Fecha',colecta.fecha||''],[],['Sección','Concepto','Hermano / asignado','Necesitás','Prometido','Recibido','Falta cubrir','Falta recibir','Unidad','Cantidad presupuesto','Costo unitario ARS','Subtotal ARS','Detalle']];
  const resumen=resumenColecta(colecta);
  for(const n of resumen.filas)rows.push(['Necesidad',n.concepto,n.asignadoNombre||'',n.cantidad,n.prometido,n.recibido,n.faltaCubrir,n.faltaRecibir,n.unidad,'',cantidad(n.precioCentavos)/100,n.costoCentavos/100,n.nota||'']);
  for(const a of entradas(colecta.aportes)){const n=(colecta.necesidades||{})[a.necesidadId]||{};rows.push(['Aporte',n.concepto||'',a.nombre,'',a.cantidad,a.recibido,'','',n.unidad||'','','','',a.nota||'']);}
  for(const p of entradas(colecta.presupuestos))rows.push(['Presupuesto',p.concepto,'','','','','','','',p.cantidad,p.precioCentavos/100,Math.round(p.cantidad*p.precioCentavos)/100,[p.proveedor,p.nota].filter(Boolean).join(' · ')]);
  rows.push(['Total estimado ARS','','','','','','','','','','',resumen.totalCentavos/100]);
  return '\uFEFF'+rows.map(r=>r.map(celda).join(';')).join('\r\n');
}

export function necesidadesParaMensaje(colecta={},opciones={}){
  const modo=opciones.modo||'pendientes',seleccion=Array.isArray(opciones.seleccion)?new Set(opciones.seleccion):null;
  return resumenColecta(colecta).filas.filter(n=>{
    if(modo==='asignado'&&(!opciones.hermanoId||n.asignadoId!==opciones.hermanoId))return false;
    return (modo==='completo'?cantidad(n.cantidad)>0:n.faltaCubrir>0)&&(!seleccion||seleccion.has(n.id));
  }).map(n=>({...n,cantidadMensaje:modo==='completo'?cantidad(n.cantidad):n.faltaCubrir}));
}

export function listadoColecta(colecta={},opciones={}){
  const filas=necesidadesParaMensaje(colecta,opciones);if(!filas.length)return '';
  return ['Listado de necesidades · '+String(colecta.titulo||'Colecta'),...filas.map(n=>{
    const costo=opciones.costos&&n.precioCentavos>0?' (aprox. '+pesos(Math.round(n.cantidadMensaje*n.precioCentavos))+')':'';
    return '• '+formato(n.cantidadMensaje)+' '+String(n.unidad||'unidades')+' — '+String(n.concepto||'')+costo;
  })].join('\n');
}

export function mensajeSugeridoColecta(colecta={},recordatorio=false){
  const titulo=String(colecta.titulo||'nuestra colecta').trim(),objetivo=String(colecta.objetivo||colecta.detalle||'').trim().replace(/[.!]+$/,'');
  if(recordatorio)return `Buenas, hermanos, ¡Dios los bendiga! 🙏\n\nSeguimos preparando «${titulo}».${objetivo?' Nuestro objetivo es '+objetivo+'.':''}\nLes compartimos las necesidades que todavía faltan cubrir. Gracias por cada aporte, por sus oraciones y por acompañarnos en la obra del Señor.`;
  return `Buenas, hermanos, ¡Dios los bendiga! 🙏\n\nEstamos organizando «${titulo}».${objetivo?' Nuestro objetivo es '+objetivo+'.':''}\nLes compartimos el listado de lo que vamos a estar precisando. Sabemos que somos bendecidos al bendecir y ser de bendición.\n\nAgradecemos la oportunidad de compartir con ustedes el honor de aportar a la obra del Señor. ¡Gracias por acompañarnos con amor!`;
}

export function crearColectas({obtenerHermanos}){
  let cache={},actual='',escucha=null,uidEscucha='',estado='inicio',error='',modal=null,edicion=null,guardando=false;
  const cont=()=>document.getElementById('colectasApp');
  const api=()=>window.__FB_API||{};
  const db=()=>window.__FB?.db;
  function mensajeError(e){return /permission|denied/i.test(e?.code||e?.message||'')?'Falta habilitar el acceso a Colectas para administradores y colaboradores.':'No se pudo guardar. Tus datos siguen en el formulario; intentá de nuevo.';}
  function accion(tipo,id='',grupo=''){
    return `<button type="button" data-id="${esc(id)}" data-grupo="${esc(grupo)}" onclick="vaColectaEditarFila('${tipo}',this.dataset.id,this.dataset.grupo)" aria-label="Editar ${esc(tipo)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button><button type="button" data-id="${esc(id)}" data-grupo="${esc(grupo)}" onclick="vaColectaBorrarFila(this.dataset.grupo,this.dataset.id)" aria-label="Borrar ${esc(tipo)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>`;
  }
  function tabla(titulos,filas,vacio){return filas.length?`<div class="colecta-tabla-scroll"><table><thead><tr>${titulos.map(t=>`<th scope="col">${t}</th>`).join('')}</tr></thead><tbody>${filas.join('')}</tbody></table></div>`:`<p class="colecta-vacia">${vacio}</p>`;}
  function render(){
    const root=cont();if(!root)return;
    if(!puede()){root.innerHTML='';cerrar();return;}
    const c=cache[actual];
    if(!c){
      root.innerHTML=`<div class="colectas-head"><div><h3>Colectas y presupuestos</h3><p>Aportes, necesidades y costos por objetivo.</p></div><button type="button" onclick="vaColectaNueva()">+ Nueva colecta</button></div>${estado==='cargando'?'<p class="colecta-vacia">Cargando colectas…</p>':''}${error?`<p class="colecta-error" role="alert">${esc(error)}</p><button type="button" onclick="vaColectasReintentar()">Reintentar</button>`:''}<div class="colectas-lista">${Object.entries(cache).sort((a,b)=>Number(b[1].creado)-Number(a[1].creado)).map(([id,it])=>{const r=resumenColecta(it);return `<button type="button" class="colecta-ficha" data-id="${esc(id)}" onclick="vaColectaAbrir(this.dataset.id)"><span>${it.estado==='cerrada'?'Cerrada':'En curso'}${it.fecha?' · '+esc(it.fecha):''}</span><strong>${esc(it.titulo)}</strong><small>${r.aportes} aportes · ${r.pendientes} necesidades por cubrir</small><b>${pesos(r.totalCentavos)} estimados</b></button>`;}).join('')||(!error&&estado!=='cargando'?'<p class="colecta-vacia">Creá una colecta para organizar lo que se necesita y lo que aporta cada hermano.</p>':'')}</div>`;
      return;
    }
    const r=resumenColecta(c),necesidades=r.filas;
    root.innerHTML=`<div class="colectas-head"><button type="button" onclick="vaColectaAbrir('')" aria-label="Volver a las colectas">‹</button><div><h3>${esc(c.titulo)}</h3><p>${esc(c.fecha||'Sin fecha')} · ${c.estado==='cerrada'?'Cerrada':'En curso'}</p></div><button type="button" onclick="vaColectaEditar()">Editar</button><button type="button" onclick="vaColectaDescargar()" title="Descargar planilla CSV"><i class="fa-solid fa-download" aria-hidden="true"></i> Planilla</button></div>${c.objetivo?`<p class="colecta-objetivo"><strong>Objetivo:</strong> ${esc(c.objetivo)}</p>`:''}${c.detalle?`<p class="colecta-detalle">${esc(c.detalle)}</p>`:''}<div class="colecta-resumen"><div><strong>${r.aportes}</strong><span>Aportes anotados</span></div><div><strong>${r.pendientes}</strong><span>Necesidades por cubrir</span></div><div><strong>${r.porRecibir}</strong><span>Necesidades por recibir</span></div><div><strong>${pesos(r.totalCentavos)}</strong><span>Presupuesto estimado</span></div></div><section class="colecta-seccion"><div class="colecta-seccion-head"><h4>Lo que necesitamos</h4><button type="button" onclick="vaColectaEditarFila('necesidad')">+ Necesidad</button></div>${tabla(['Concepto','Necesitás','Costo aprox.','Asignado a','Prometido','Recibido','Falta cubrir','Falta recibir',''],necesidades.map(n=>`<tr><td><strong>${esc(n.concepto)}</strong><small>${esc(n.nota||'')}</small></td><td>${formato(n.cantidad)} ${esc(n.unidad||'')}</td><td>${n.precioCentavos?pesos(n.costoCentavos):'Sin estimar'}</td><td>${esc(n.asignadoNombre||'Sin asignar')}</td><td>${formato(n.prometido)}</td><td>${formato(n.recibido)}</td><td class="${n.faltaCubrir?'colecta-pendiente':''}">${formato(n.faltaCubrir)}</td><td>${formato(n.faltaRecibir)}</td><td class="colecta-fila-acciones">${accion('necesidad',n.id,'necesidades')}</td></tr>`),'Anotá primero los artículos o recursos necesarios.')}</section><section class="colecta-seccion"><div class="colecta-seccion-head"><h4>Lo que aporta cada hermano</h4><button type="button" onclick="vaColectaEditarFila('aporte')" ${necesidades.length?'':'disabled'}>+ Aporte</button></div>${tabla(['Hermano','Aporta','Prometido','Recibido','Observación',''],entradas(c.aportes).map(a=>`<tr><td>${esc(a.nombre)}</td><td>${esc(c.necesidades?.[a.necesidadId]?.concepto||'')}</td><td>${formato(a.cantidad)}</td><td>${formato(a.recibido)}</td><td>${esc(a.nota||'')}</td><td class="colecta-fila-acciones">${accion('aporte',a.id,'aportes')}</td></tr>`),'Todavía no se anotaron aportes.')}</section><section class="colecta-seccion"><div class="colecta-seccion-head"><h4>Otros costos y presupuestos</h4><button type="button" onclick="vaColectaEditarFila('presupuesto')">+ Costo</button></div>${tabla(['Concepto','Proveedor','Cantidad','Costo unitario','Subtotal',''],entradas(c.presupuestos).map(p=>`<tr><td>${esc(p.concepto)}<small>${esc(p.nota||'')}</small></td><td>${esc(p.proveedor||'')}</td><td>${formato(p.cantidad)}</td><td>${pesos(p.precioCentavos)}</td><td>${pesos(Math.round(p.cantidad*p.precioCentavos))}</td><td class="colecta-fila-acciones">${accion('presupuesto',p.id,'presupuestos')}</td></tr>`),'Agregá los costos adicionales a las necesidades.')}<p class="colecta-total">Necesidades: ${pesos(r.necesidadesCentavos)} · Otros costos: ${pesos(r.otrosCentavos)}<br>Total estimado: <strong>${pesos(r.totalCentavos)}</strong></p></section>${window.__ES_ADMIN?'<button type="button" class="colecta-borrar" onclick="vaColectaBorrar()">Borrar colecta</button>':''}`;
  }
  function asegurarModal(){
    if(modal)return modal;
    modal=document.createElement('div');modal.className='colecta-modal';modal.id='colectaModal';modal.hidden=true;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','colectaFormTitulo');
    modal.addEventListener('click',e=>{if(e.target===modal&&!guardando)cerrar();});modal.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!guardando){e.preventDefault();cerrar();}
      if(e.key==='Tab'){const els=[...modal.querySelectorAll('input,textarea,select,button:not(:disabled)')].filter(el=>el.getClientRects().length);if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===els.at(-1)){e.preventDefault();els[0]?.focus();}}
    });document.body.appendChild(modal);return modal;
  }
  function input(nombre,label,valor='',tipo='text',extras=''){return `<label>${label}<input name="${nombre}" type="${tipo}" value="${esc(valor)}" ${extras}></label>`;}
  function nombreHermano(id,nombreAnterior=''){
    if(!id)return '';
    const h=obtenerHermanos().find(h=>h.id===id);
    return h?`${h.nombre||''} ${h.apellido||''}`.trim():String(nombreAnterior||'Contacto no disponible');
  }
  function opcionesHermanos(id='',nombre=''){
    const hermanos=obtenerHermanos();
    const antiguo=id&&!hermanos.some(h=>h.id===id)?`<option value="${esc(id)}" selected>${esc(nombre||'Contacto no disponible')}</option>`:'';
    return '<option value="">Sin asignar</option>'+antiguo+hermanos.map(h=>`<option value="${esc(h.id)}" ${h.id===id?'selected':''}>${esc(`${h.nombre||''} ${h.apellido||''}`.trim())}</option>`).join('');
  }
  function renderBorradores(){
    const host=modal?.querySelector('#colectaNecesidadesBorrador');if(!host||!edicion)return;
    host.innerHTML=edicion.necesidades.map((n,i)=>`<div class="colecta-necesidad-borrador" data-id="${esc(n.id)}"><div class="colecta-seccion-head"><strong>Necesidad ${i+1}</strong><button type="button" data-id="${esc(n.id)}" onclick="vaColectaQuitarBorrador(this.dataset.id)" aria-label="Quitar necesidad ${i+1}">×</button></div><label>Qué vamos a necesitar<input data-campo="concepto" value="${esc(n.concepto||'')}" required></label><div class="colecta-borrador-campos"><label>Cantidad<input data-campo="cantidad" type="number" min="0.01" step="any" value="${esc(n.cantidad||1)}" oninput="vaColectaActualizarCostoBorrador(this)" required></label><label>Unidad<input data-campo="unidad" value="${esc(n.unidad||'unidades')}"></label><label>Costo aprox. por unidad (ARS)<input data-campo="precio" type="number" min="0" step="0.01" value="${cantidad(n.precioCentavos)/100}" oninput="vaColectaActualizarCostoBorrador(this)"></label><label>Asignado a<select data-campo="asignadoId">${opcionesHermanos(n.asignadoId,n.asignadoNombre)}</select></label></div><small class="colecta-borrador-subtotal">Costo aproximado: <span>${pesos(Math.round(cantidad(n.cantidad)*cantidad(n.precioCentavos)))}</span></small></div>`).join('')||'<p class="colecta-vacia">Agregá lo que vamos a requerir para esta colecta.</p>';
  }
  function leerBorradores(){
    if(!edicion?.necesidades)return;
    for(const row of modal.querySelectorAll('.colecta-necesidad-borrador')){
      const n=edicion.necesidades.find(n=>n.id===row.dataset.id);if(!n)continue;
      const v=campo=>row.querySelector(`[data-campo="${campo}"]`).value;
      n.concepto=v('concepto').trim();n.cantidad=cantidad(v('cantidad'));n.unidad=v('unidad').trim()||'unidades';
      n.precioCentavos=Math.round(cantidad(v('precio'))*100);n.asignadoId=v('asignadoId');n.asignadoNombre=nombreHermano(n.asignadoId,n.asignadoNombre);
    }
  }
  function limpiarBorrador(n,ahora){
    const {id,...datos}=n;
    return {...datos,concepto:String(n.concepto||'').trim(),cantidad:cantidad(n.cantidad),unidad:n.unidad||'unidades',precioCentavos:cantidad(n.precioCentavos),asignadoId:n.asignadoId||'',asignadoNombre:n.asignadoNombre||'',actualizado:ahora};
  }
  function combinarNecesidades(c,ed,ahora){
    const originales=ed.originalNecesidades||{},necesidades={...c.necesidades},ids=new Set(ed.necesidades.map(n=>n.id));
    for(const id of Object.keys(originales)){
      if(ids.has(id))continue;
      if(entradas(c.aportes).some(a=>a.necesidadId===id))return {error:'Una necesidad tiene aportes anotados. Conservála o mové los aportes antes de quitarla.'};
      delete necesidades[id];
    }
    const normalizar=n=>({concepto:n.concepto||'',cantidad:cantidad(n.cantidad),unidad:n.unidad||'unidades',precioCentavos:cantidad(n.precioCentavos),asignadoId:n.asignadoId||'',asignadoNombre:n.asignadoNombre||''});
    for(const n of ed.necesidades){
      const antes=originales[n.id];
      if(!antes){necesidades[n.id]=limpiarBorrador(n,ahora);continue;}
      const viejo=normalizar(antes),nuevo=normalizar(n),delta=Object.fromEntries(Object.entries(nuevo).filter(([k,v])=>v!==viejo[k]));
      if(!Object.keys(delta).length)continue;
      if(!necesidades[n.id])return {error:'Una necesidad fue quitada por otro editor. Abrí la colecta de nuevo para continuar.'};
      necesidades[n.id]={...necesidades[n.id],...delta,actualizado:ahora};
    }
    return {valor:necesidades};
  }
  window.vaColectaAgregarBorrador=()=>{
    if(!puede()||edicion?.tipo!=='colecta'||edicion.uid!==window.__UID)return;
    leerBorradores();const id='n_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
    edicion.necesidades.push({id,concepto:'',cantidad:1,unidad:'unidades',precioCentavos:0,asignadoId:'',asignadoNombre:''});renderBorradores();
    modal.querySelector('.colecta-necesidad-borrador:last-child input')?.focus();
  };
  window.vaColectaQuitarBorrador=id=>{
    if(!puede()||edicion?.uid!==window.__UID)return;
    if(edicion.id&&entradas(cache[edicion.id]?.aportes).some(a=>a.necesidadId===id)){alert('Esta necesidad tiene aportes anotados. Editalos o quitálos antes de borrar la necesidad.');return;}
    leerBorradores();edicion.necesidades=edicion.necesidades.filter(n=>n.id!==id);renderBorradores();
  };
  window.vaColectaActualizarCostoBorrador=input=>{
    const row=input.closest('.colecta-necesidad-borrador');if(!row)return;
    const q=cantidad(row.querySelector('[data-campo="cantidad"]').value),precio=cantidad(row.querySelector('[data-campo="precio"]').value);
    row.querySelector('.colecta-borrador-subtotal span').textContent=pesos(Math.round(q*precio*100));
  };

  function abrirForm(titulo,html,datos){
    asegurarModal();edicion={...datos,colectaId:datos.colectaId||actual,uid:window.__UID};
    if(datos.tipo==='colecta'){const originales=datos.id?(cache[datos.id]?.necesidades||{}):{};edicion.originalNecesidades=structuredClone(originales);edicion.necesidades=entradas(originales);}modal.__foco=document.activeElement;
    modal.innerHTML=`<div class="colecta-form-card"><div class="colectas-head"><h3 id="colectaFormTitulo">${titulo}</h3><button type="button" onclick="vaColectaCerrarForm()" aria-label="Cerrar formulario">×</button></div><form id="colectaForm" onsubmit="vaColectaGuardar(event)"><div class="colecta-form-scroll">${html}${datos.tipo==='colecta'?'<section class="colecta-necesidades-editor"><div class="colecta-seccion-head"><h4>Lista de necesidades</h4><button type="button" onclick="vaColectaAgregarBorrador()">+ Necesidad</button></div><div id="colectaNecesidadesBorrador"></div><button type="button" class="colecta-add-final" onclick="vaColectaAgregarBorrador()">+ Agregar otra necesidad</button></section>':''}<p id="colectaFormError" class="colecta-error" role="alert"></p></div><div class="colecta-form-acciones"><button type="button" onclick="vaColectaCerrarForm()">Cancelar</button><button type="submit">Guardar</button></div></form></div>`;
    if(datos.tipo==='colecta')renderBorradores();
    modal.hidden=false;document.body.classList.add('colecta-modal-abierto');modal.querySelector('input,select,textarea')?.focus();
  }
  function cerrar(){if(!modal||guardando)return;modal.hidden=true;document.body.classList.remove('colecta-modal-abierto');modal.__foco?.focus();}
  function errorForm(texto){const el=modal?.querySelector('#colectaFormError');if(el){el.textContent=texto;if(texto)el.scrollIntoView({block:'nearest'});}}
  async function mostrar(){
    if(!puede())return;
    if(uidEscucha===window.__UID&&escucha){render();return;}
    escucha?.();uidEscucha=window.__UID;cache={};actual='';estado='cargando';error='';render();
    if(!db()||!api().onValue){estado='error';error='Todavía no se pudo conectar. Intentá de nuevo.';render();return;}
    const uid=window.__UID;
    escucha=api().onValue(api().ref(db(),'colectasIglesia'),snap=>{
      if(window.__UID!==uid||!puede())return;cache=snap.val()||{};estado='listo';error='';render();
    },e=>{if(window.__UID!==uid)return;estado='error';error=/permission|denied/i.test(e?.code||e?.message||'')?mensajeError(e):'No se pudieron cargar las colectas. Intentá de nuevo.';render();});
  }
  window.vaColectasReintentar=()=>{escucha?.();escucha=null;uidEscucha='';mostrar();};
  window.vaColectaAbrir=id=>{if(!puede())return;actual=id;render();};
  window.vaColectaCerrarForm=cerrar;
  window.vaColectaNueva=()=>{if(!puede())return;abrirForm('Nueva colecta',input('titulo','Nombre de la colecta o evento','','text','required maxlength="150"')+input('fecha','Fecha','','date')+input('objetivo','Objetivo: para qué vamos a reunirlo','','text','required')+'<label>Detalle<textarea name="detalle" rows="3"></textarea></label>',{tipo:'colecta',id:''});};
  window.vaColectaEditar=()=>{
    if(!puede()||!cache[actual])return;const c=cache[actual];
    abrirForm('Editar colecta',input('titulo','Nombre de la colecta o evento',c.titulo,'text','required maxlength="150"')+input('fecha','Fecha',c.fecha||'','date')+input('objetivo','Objetivo: para qué vamos a reunirlo',c.objetivo||'')+`<label>Detalle<textarea name="detalle" rows="3">${esc(c.detalle||'')}</textarea></label><label>Estado<select name="estado"><option value="abierta">En curso</option><option value="cerrada" ${c.estado==='cerrada'?'selected':''}>Cerrada</option></select></label>`,{tipo:'colecta',id:actual});
  };
  window.vaColectaEditarFila=(tipo,id='',grupo='')=>{
    if(!puede()||!cache[actual])return;
    const grupos={necesidad:'necesidades',aporte:'aportes',presupuesto:'presupuestos'};grupo=grupos[tipo];if(!grupo)return;
    const c=cache[actual],it=c[grupo]?.[id]||{};let html='';
    if(tipo==='necesidad')html=input('concepto','Qué necesitamos',it.concepto||'','text','required')+input('cantidad','Cantidad necesaria',it.cantidad||1,'number','min="0.01" step="any" required')+input('unidad','Unidad (por ejemplo: paquetes, kilos o pesos)',it.unidad||'unidades')+input('precio','Costo aproximado por unidad (ARS)',cantidad(it.precioCentavos)/100,'number','min="0" step="0.01"')+`<label>Asignado a<select name="asignadoId">${opcionesHermanos(it.asignadoId,it.asignadoNombre)}</select></label>`+input('nota','Observación',it.nota||'');
    if(tipo==='aporte'){
      if(!Object.keys(c.necesidades||{}).length)return;
      html=`<label>Hermano<select name="hermanoId" onchange="vaColectaElegirHermano(this)"><option value="">Escribir un nombre</option>${obtenerHermanos().map(h=>`<option value="${esc(h.id)}" ${h.id===it.hermanoId?'selected':''}>${esc(`${h.nombre||''} ${h.apellido||''}`.trim())}</option>`).join('')}</select></label>`+input('nombre','Nombre del hermano',it.nombre||'','text','required')+`<label>Qué aporta<select name="necesidadId" required>${entradas(c.necesidades).map(n=>`<option value="${esc(n.id)}" ${n.id===it.necesidadId?'selected':''}>${esc(n.concepto)} (${esc(n.unidad||'unidades')})</option>`).join('')}</select></label>`+input('cantidad','Cantidad prometida',it.cantidad||1,'number','min="0.01" step="any" required')+input('recibido','Cantidad ya recibida',it.recibido||0,'number','min="0" step="any" required')+input('nota','Observación',it.nota||'');
    }
    if(tipo==='presupuesto')html=input('concepto','Concepto del presupuesto',it.concepto||'','text','required')+input('proveedor','Proveedor / presupuesto de',it.proveedor||'')+input('cantidad','Cantidad',it.cantidad||1,'number','min="0.01" step="any" required')+input('precio','Costo unitario estimado (ARS)',(it.precioCentavos||0)/100,'number','min="0" step="0.01" required')+input('nota','Observación',it.nota||'');
    abrirForm((id?'Editar ':'Agregar ')+tipo,html,{tipo,id,grupo});
  };
  window.vaColectaElegirHermano=select=>{const h=obtenerHermanos().find(h=>h.id===select.value);if(h)select.form.elements.nombre.value=`${h.nombre||''} ${h.apellido||''}`.trim();};
  window.vaColectaGuardar=async e=>{
    e.preventDefault();if(guardando||!puede()||!edicion||edicion.uid!==window.__UID)return;
    const form=e.target,datos=Object.fromEntries(new FormData(form)),ed={...edicion},ahora=Date.now();let valor;
    if(ed.tipo==='colecta'){
      if(!datos.titulo?.trim()){errorForm('Completá el objetivo de la colecta.');return;}
      valor={titulo:datos.titulo.trim(),fecha:datos.fecha||'',detalle:datos.detalle.trim(),objetivo:String(datos.objetivo||'').trim(),estado:datos.estado||'abierta',actualizado:ahora};
    }else{
      const n=cantidad(datos.cantidad);if(n<=0){errorForm('La cantidad debe ser mayor a cero.');return;}
      valor={cantidad:n,nota:datos.nota.trim(),actualizado:ahora};
      if(ed.tipo==='necesidad'){if(!datos.concepto.trim()){errorForm('Completá qué se necesita.');return;}const precio=cantidad(datos.precio);if(precio<0){errorForm('El costo no puede ser negativo.');return;}const asignadoId=datos.asignadoId||'',anterior=cache[ed.colectaId]?.necesidades?.[ed.id]||{};Object.assign(valor,{concepto:datos.concepto.trim(),unidad:datos.unidad.trim()||'unidades',precioCentavos:Math.round(precio*100),asignadoId,asignadoNombre:nombreHermano(asignadoId,anterior.asignadoNombre)});}
      if(ed.tipo==='aporte'){
        const recibido=cantidad(datos.recibido);if(!datos.nombre.trim()||!cache[ed.colectaId]?.necesidades?.[datos.necesidadId]){errorForm('Completá el hermano y qué aporta.');return;}
        if(recibido<0||recibido>n){errorForm('Lo recibido debe estar entre cero y lo prometido.');return;}
        Object.assign(valor,{hermanoId:datos.hermanoId||'',nombre:datos.nombre.trim(),necesidadId:datos.necesidadId,recibido});
      }
      if(ed.tipo==='presupuesto'){const precio=cantidad(datos.precio);if(!datos.concepto.trim()||precio<0){errorForm('Revisá el concepto y el costo.');return;}Object.assign(valor,{concepto:datos.concepto.trim(),proveedor:datos.proveedor.trim(),precioCentavos:Math.round(precio*100)});}
    }
    if(ed.tipo==='colecta'){
      leerBorradores();ed.necesidades=structuredClone(edicion.necesidades);ed.originalNecesidades=edicion.originalNecesidades;
      for(const n of ed.necesidades){if(!String(n.concepto||'').trim()||cantidad(n.cantidad)<=0||cantidad(n.precioCentavos)<0){errorForm('Revisá el concepto, la cantidad y el costo de cada necesidad.');return;}}
    }
    guardando=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);errorForm('');
    try{
      if(!db()||!api().set)throw new Error('Sin conexión');
      if(ed.tipo==='colecta'){
        if(ed.id){let motivo='La colecta ya no está disponible';const r=await api().runTransaction(api().ref(db(),`colectasIglesia/${ed.id}`),c=>{if(!c)return;const necesidades=combinarNecesidades(c,ed,ahora);if(necesidades.error){motivo=necesidades.error;return;}return {...c,...valor,necesidades:necesidades.valor};});if(!r.committed)throw new Error(motivo);}
        else{const destino=api().push(api().ref(db(),'colectasIglesia'));await api().set(destino,{...valor,necesidades:Object.fromEntries(ed.necesidades.map(n=>[n.id,limpiarBorrador(n,ahora)])),creado:ahora,creadoPor:window.__UID});actual=destino.key;}
      }else{
        const destino=ed.id?api().ref(db(),`colectasIglesia/${ed.colectaId}/${ed.grupo}/${ed.id}`):api().push(api().ref(db(),`colectasIglesia/${ed.colectaId}/${ed.grupo}`));await api().set(destino,valor);
      }
      guardando=false;cerrar();render();
    }catch(err){errorForm(err?.message?.startsWith('La colecta')||err?.message?.startsWith('Una necesidad')?err.message:mensajeError(err));}
    finally{guardando=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };
  window.vaColectaBorrarFila=async(grupo,id)=>{
    if(!puede()||!cache[actual]||!['necesidades','aportes','presupuestos'].includes(grupo)||!cache[actual][grupo]?.[id])return;
    if(grupo==='necesidades'&&entradas(cache[actual].aportes).some(a=>a.necesidadId===id)){alert('Esta necesidad tiene aportes anotados. Editalos o quitálos antes de borrar la necesidad.');return;}
    if(!confirm('¿Borrar este registro de la colecta?'))return;
    try{await api().remove(api().ref(db(),`colectasIglesia/${actual}/${grupo}/${id}`));}catch(e){alert(mensajeError(e));}
  };
  window.vaColectaBorrar=async()=>{if(!window.__UID||!window.__ES_ADMIN||!cache[actual])return;if(!confirm('¿Borrar esta colecta con todos sus registros?'))return;try{await api().remove(api().ref(db(),`colectasIglesia/${actual}`));actual='';render();}catch(e){alert(mensajeError(e));}};
  window.vaColectaDescargar=()=>{
    if(!puede()||!cache[actual])return;
    const c=cache[actual],url=URL.createObjectURL(new Blob([csvColecta(c)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=(c.titulo||'Colecta').replace(/[\\/:*?"<>|]/g,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  async function listar(){
    if(!puede())throw new Error('Sin permiso');
    if(uidEscucha===window.__UID&&estado==='listo')return entradas(cache);
    const uid=window.__UID;if(!api().get||!db())throw new Error('Sin conexión');
    const snap=await api().get(api().ref(db(),'colectasIglesia'));
    if(uid!==window.__UID||!puede())throw new Error('La cuenta cambió');
    return entradas(snap.val()||{});
  }
  return {mostrar,listar};
}
