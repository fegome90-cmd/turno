import {createPreviewAdapter} from './preview-adapter.mjs';
import {validateEditor} from './validation.mjs';
import {createMotion} from './motion.mjs';
import {chooseHomeSubtitle} from './home-subtitle.mjs';
import {displayDate,groupAgenda,ZONE} from './format.mjs';
import {createTemporalDraft,applyTemporalDraft} from './draft-state.mjs';
const adapter=createPreviewAdapter({delay:220});
const motion=createMotion(window.matchMedia?.bind(window));
// One selection per page visit; returning Home or rendering panels cannot change it.
const homeSubtitle=chooseHomeSubtitle();
let inputModality='keyboard',renderedView=null;
const renderedParts=new Map();
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<img class="icon" src="./assets/icons/${name}.svg" alt="" aria-hidden="true">`;
const btn=(label,action,iconName='',cls='',attrs='')=>`<button type="button" class="${cls}" data-action="${action}" ${attrs}>${iconName?icon(iconName):''}<span>${esc(label)}</span></button>`;
let data,view='home',selected=null,draft=null,dirty=false,busy=false,inspector=true,tab='task',filter='all',query='',archiveId=null,error='',feedback='',pendingNavigation=null,rawTemporal=null,overlay=null,returnFocus=null;
let fieldErrors={};
const expanded=new Set(['bed-1']);
const expandedProperties=new Set();
const active=()=>data?.shifts.find(s=>s.id===data.activeShiftId);
const shift=()=>data?.shifts.find(s=>s.id===(archiveId||data.activeShiftId));
const selectedIsNote=()=>selected?.kind==='note';
const readonly=()=>!selectedIsNote()&&Boolean(archiveId);
const tasks=()=>data.tasks.filter(t=>t.shiftId===(archiveId||data.activeShiftId));
const visibleTasks=()=>tasks().filter(t=>(filter!=='pending'||!t.completed)&&(!query||`${t.title} ${t.reason}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
function notify(message, kind = 'status') {
 const live = $(kind === 'error' ? '#live-error' : '#live');
 $(kind === 'error' ? '#live' : '#live-error').textContent = '';
 live.textContent = message;
 $('#dismiss-feedback').hidden = false;
 motion.enter($('#notification'), 'feedback', inputModality);
}
function clearNotification() {
 const restore=$('#notification').contains(document.activeElement);
 motion.cancelWithin($('#notification'));
 $('#live').textContent = $('#live-error').textContent = '';
 $('#dismiss-feedback').hidden = true;
 if(restore)($('#modal').open?$('#modal [data-action="dismiss"]'):$('#main'))?.focus();
}
const findSelected=()=>selected ? data[selectedIsNote()?'notes':'tasks'].find(x=>x.id===selected.id) : null;
function select(kind,id){fieldErrors={};selected={kind,id};draft=structuredClone(findSelected());rawTemporal=createTemporalDraft(draft);dirty=false;error='';feedback='';view=kind==='note'?'notes':'workspace';tab='task';render();}
function focusKey(element){return element?.id?{id:element.id}:element?.dataset?.action?{action:element.dataset.action}:element?.dataset?.focus?{focus:element.dataset.focus}:element?.dataset?.check?{check:element.dataset.check}:null;}
function restoreFocus(key){
 if(!key)return;
 const scope=$('#modal').open?$('#modal'):$('#app');
 const found=key.id?scope.querySelector('#'+key.id):[...scope.querySelectorAll(key.action?'[data-action]':key.check?'[data-check]':'[data-focus]')].find(e=>key.action?e.dataset.action===key.action:key.check?e.dataset.check===key.check:e.dataset.focus===key.focus);
 if(found&&!found.closest('[hidden], [inert]'))found.focus();
 else if(key.check)$('#main')?.focus();
}

function closeModal(){motion.cancelAll();const m=$('#modal');const wasOpen=m.open;if(wasOpen)m.close();m.replaceChildren();overlay=null;if(wasOpen){render();restoreFocus(returnFocus);}returnFocus=null;}
function modal(title,body,footer=''){const origin=focusKey(document.activeElement);closeModal();returnFocus=origin;const m=$('#modal');m.className='';m.innerHTML=`<div class="dialog-heading"><h2 id="dialog-title">${esc(title)}</h2>${btn('Cerrar','dismiss','x','icon-button')}</div>${body}<div class="dialog-actions">${footer}</div>`;m.showModal();motion.enter(m,'dialog',inputModality);}
function requestNavigation(fn){if(busy)return;if(dirty){pendingNavigation=fn;modal('Hay cambios sin guardar','<p>Tu borrador todavía no se ha guardado en esta demostración.</p>',btn('Volver','dismiss')+btn('Descartar cambios','discard-navigation')+btn('Guardar y continuar','save-navigation','','primary'));}else{closeModal();fn();}}
function bedLabel(t){return data.beds.find(b=>b.id===t?.bedId)?.label||'Sin cama';}
function navigation(){const s=shift();const vt=visibleTasks();return `
 <div class="brand">${btn('Inicio','home','','brand-button',`aria-label="Turno · Inicio"`)}<img src="./assets/flor-negro-512.png" class="brand-flower" alt=""></div>
 <div class="nav-scroll">
 ${btn('Inicio','home','house',view==='home'?'nav-item selected':'nav-item')}
 ${btn(active()?'Abrir turno':'Iniciar turno','open-shift','play','nav-item shift-button')}
 ${btn('Agregar tarea','add-task','plus','nav-item',!active()?'disabled aria-describedby="task-hint"':'')}
 ${!active()?'<p id="task-hint" class="nav-hint">Inicia un turno para agregar tareas.</p>':''}
 ${view!=='home'&&s?`<div class="shift-context"><strong>${esc(s.label)}</strong><span>${displayDate(s.date)} · ${s.status==='closed'?'Archivado':'Abierto'}</span></div>
 <label class="search-label">${icon('search')}<input type="search" id="search" placeholder="Buscar en este turno" value="${esc(query)}" aria-label="Buscar tareas"></label>
 <div class="filter-row">${btn('Todas','filter-all','','filter '+(filter==='all'?'active':''),'aria-pressed="'+(filter==='all')+'"')}${btn('Pendientes','filter-pending','','filter '+(filter==='pending'?'active':''),'aria-pressed="'+(filter==='pending')+'"')}</div>`:''}
 <div class="section-heading">${btn('Notas rápidas','notes','notebook-pen','section-title')}${btn('Agregar nota rápida','add-note','plus','icon-button')}</div>
 ${(view==='notes')?data.notes.map(n=>btn(n.title,'note:'+n.id,'file-pen-line','tree-task '+(selected?.id===n.id?'current':''))).join(''):''}
 ${view!=='home'&&s?`<div class="section-heading bed-heading"><span>Camas</span>${!archiveId?btn('Agregar cama','add-bed','plus','icon-button'):''}</div>
 <div id="task-tree">${data.beds.filter(b=>b.shiftId===s.id).map(b=>{const inBed=vt.filter(t=>t.bedId===b.id);const isOpen=expanded.has(b.id)||query;return `<section class="bed-group"><div class="bed-line">${btn(b.label,'bed:'+b.id,isOpen?'chevron-down':'chevron-right','bed-toggle',`aria-expanded="${!!isOpen}" aria-controls="group-${b.id}"`)}${!archiveId?btn('Editar nombre de '+b.label,'rename-bed:'+b.id,'pencil','icon-button subtle',`aria-label="${esc('Editar nombre de '+b.label)}"`)+btn('Agregar tarea a '+b.label,'add-task:'+b.id,'plus','icon-button subtle'):''}</div><div id="group-${b.id}" ${!isOpen?'hidden':''}>${isOpen?inBed.map(taskRow).join(''):''}</div></section>`;}).join('')}${vt.filter(t=>!t.bedId).map(taskRow).join('')}${vt.length===0?`<p class="nav-hint">${query?'Sin coincidencias para «'+esc(query)+'».':filter==='pending'?'No hay tareas pendientes.':'Este turno todavía no tiene tareas.'}</p>${query||filter==='pending'?btn('Limpiar filtros','clear-filters','','nav-item'):''}`:''}</div>`:''}
 </div>
 <div class="nav-footer">${btn('Turnos anteriores','archive','archive','nav-item')}${active()?btn('Cerrar turno','close-shift','power','nav-item'):''}${btn('Demostración local','demo','settings','nav-item demo-button')}<p>Datos sintéticos · Se reinician al recargar</p></div>`;}
function taskRow(t){return `<div class="task-row ${selected?.id===t.id?'current':''}"><input type="checkbox" data-check="${t.id}" aria-label="${esc((t.completed?'Reabrir ':'Completar ')+t.title)}" ${t.completed?'checked':''} ${archiveId||busy?'disabled':''}><button type="button" data-action="task:${t.id}" class="task-select ${t.completed?'completed':''}" ${selected?.id===t.id?'aria-current="true"':''}>${esc(t.title)}</button></div>`;}
function toolbar(){return `<header class="toolbar"><div>${btn('Abrir navegación','navigation','panel-left','icon-button mobile-navigation')}${view!=='home'?`<span class="breadcrumb">${archiveId?'Archivo · ':''}${selectedIsNote()?'Notas rápidas':draft?esc(bedLabel(draft))+' <span>/</span> '+esc(draft.reason||'Tareas'):esc(shift()?.label||'Turno')}</span>`:''}</div><div>${btn(inspector&&view!=='home'?'Ocultar Tiempo':'Mostrar Tiempo','toggle-inspector','clock','icon-button',`aria-expanded="${inspector&&view!=='home'}"`)}${btn('Más opciones','more','ellipsis','icon-button')}</div></header>`;}
function center(){if(view==='home')return `<main id="main" tabindex="-1" class="home"><div class="greeting"><h1>${data.profile.preferredName?'Hola, '+esc(data.profile.preferredName)+'.':'Hola.'}</h1><p>${esc(homeSubtitle)}</p></div></main>`;
 if(view==='archive')return `<main id="main" tabindex="-1" class="archive-view"><h1>Turnos anteriores</h1><p class="muted">Consulta de solo lectura. Los pendientes se conservan.</p><div class="archive-list">${data.shifts.filter(s=>s.status==='closed').map(s=>btn(s.label+' · '+displayDate(s.date),'archive-shift:'+s.id,'archive','archive-link')).join('')||'<p class="empty">Todavía no hay turnos cerrados.</p>'}</div></main>`;
 if(!draft)return `<main id="main" tabindex="-1" class="empty-workspace"><h1>${view==='notes'?'Notas rápidas':esc(shift()?.label||'Turno')}</h1><p>${view==='notes'?'Selecciona una nota o crea una nueva.':'Selecciona una tarea o agrega la primera.'}</p>${!archiveId?btn(view==='notes'?'Crear nota':'Agregar tarea',view==='notes'?'add-note':'add-task','plus','primary'):''}</main>`;
 return `<main id="main" tabindex="-1" class="editor ${selectedIsNote()?'note-editor':''}">
 ${archiveId?'<div class="archive-notice">Turno archivado · Solo lectura. Los pendientes se conservan.</div>':''}
 <form id="editor-form" aria-describedby="save-feedback save-error"><div class="title-line">${!selectedIsNote()?`<input type="checkbox" id="editor-completed" aria-label="Tarea completada" ${draft.completed?'checked':''} ${readonly()||busy?'disabled':''}>`:''}<h1><input id="title" aria-label="Título de ${selectedIsNote()?'nota':'tarea'}" value="${esc(draft.title)}" maxlength="300" required ${readonly()||busy?'readonly':''}></h1>${!selectedIsNote()&&!archiveId?btn('Agregar tarea','add-task','plus','add-inline'):''}</div>
 ${!selectedIsNote()?`<div class="metadata"><span>${esc(bedLabel(draft))}</span><span class="dot">·</span><label class="sr-only" for="reason">Motivo</label><input id="reason" aria-label="Motivo" value="${esc(draft.reason)}" placeholder="Motivo" maxlength="80" ${readonly()||busy?'readonly':''}><span class="dot">·</span><select id="priority" aria-label="Prioridad" ${readonly()||busy?'disabled':''}>${[['normal','Normal'],['high','Alta'],['low','Baja']].map(([v,l])=>`<option value="${v}" ${v===draft.priority?'selected':''}>${l}</option>`).join('')}</select></div>`:'<p class="note-caption">Una nota independiente de tus turnos y camas.</p>'}
 <label class="notes-heading" for="body">${selectedIsNote()?'Escritura':'Notas'}</label><textarea id="body" placeholder="Escribe aquí…" maxlength="10000" ${readonly()||busy?'readonly':''}>${esc(draft.body)}</textarea>
 <div class="save-footer"><div><p id="save-error" class="error">${esc(error)}</p><p id="save-feedback" class="save-feedback">${esc(feedback||(dirty?'Cambios sin guardar':readonly()?'Solo lectura':'Guardado en memoria de demostración'))}</p></div>${!readonly()?`<div class="save-actions">${btn('Cancelar','cancel-draft','','',!dirty||busy?'disabled':'')}<button type="submit" class="primary" ${!dirty||busy?'disabled':''}>${busy?'Guardando…':'Guardar'}</button></div>`:''}</div></form></main>`;}
function fieldRow(id,label,ic,value,content){return `<details class="property"><summary data-focus="property-${id}" aria-controls="property-content-${id}" aria-expanded="false">${icon(ic)}<span>${label}</span><span class="property-value" id="value-${id}">${esc(value)}</span>${icon('chevron-down').replace('class="icon"', 'class="icon disclosure-chevron"')}</summary><div id="property-content-${id}" class="property-content" inert aria-hidden="true">${content}</div></details>`;}
const field=(id,label,value,placeholder='',type='text')=>`<label for="${id}">${label}</label><input id="${id}" data-field="${id}" type="${type}" value="${esc(value)}" placeholder="${placeholder}" ${readonly()||busy?'disabled':''} ${type==='number'?'min="0" max="1440" step="1"':''}>`;
function inspectorContent(){let contents='';if(tab==='agenda')contents=agenda();else if(view==='home'||!draft)contents='<div class="note-inspector"><p>Selecciona una tarea</p><p class="muted">Abre una tarea del turno para ver sus fechas y tiempos. En Agenda puedes consultar la lista completa.</p></div>';else if(selectedIsNote())contents='<div class="note-inspector"><p>Nota rápida</p><p class="muted">Esta nota no pertenece a un turno ni tiene fechas de tarea.</p></div>';else contents=`
 ${fieldRow('date','Fecha','calendar-days',displayDate(draft.date),field('date','Día / mes / año',rawTemporal?.date??'','DD/MM/AAAA')+'<p>Una fecha sin hora no programa un aviso.</p>')}
 ${fieldRow('time','Hora prevista','clock',draft.time||'Añadir',field('time','Hora local · 24 h',rawTemporal?.time??'','HH:mm')+`<p>${ZONE}</p>`)}
 ${fieldRow('estimate','Estimación','timer',draft.estimate!==''?draft.estimate+' min':'Añadir',field('estimate','Minutos estimados',rawTemporal?.estimate??'','0','number'))}
 ${fieldRow('reminder','Recordatorio','bell','Sin programar','<p>Los avisos se solicitan explícitamente en ChatGPT. Esta demostración no envía ni programa recordatorios.</p>')}
 ${fieldRow('performed','Realización','circle-check',draft.performed||'Sin registrar',field('performed','Hora realizada · 24 h',rawTemporal?.performed??'','HH:mm')+'<p>Entrada manual. Marcar hecha no rellena esta hora.</p>')}
 ${fieldRow('duration','Duración registrada','timer',draft.duration!==''?draft.duration+' min':'Sin registrar',field('duration','Total manual de prueba · minutos',rawTemporal?.duration??'','0','number')+'<p>Control visual provisional. El modelo de intervalos se definirá al integrar.</p>')}
 ${fieldRow('activity','Actividad','rotate-ccw-clock','',`<p>Versión local ${draft.version}. No hay historial remoto conectado.</p>`)}
 `;
return `<div class="inspector-heading"><div><h2 id="time-title">Tiempo</h2><p class="inspector-subtitle">Fechas y contexto del turno</p></div>${btn('Cerrar Tiempo','close-inspector','x','icon-button')}</div>
 <div class="inspector-tabs" role="tablist" aria-label="Vista temporal">${['task','agenda'].map(key=>`<button type="button" role="tab" id="tab-${key}" aria-selected="${tab===key}" tabindex="${tab===key?0:-1}" aria-controls="time-panel-${key}" data-action="tab-${key}">${key==='task'?'Tarea':'Agenda'}</button>`).join('')}<span class="tab-indicator ${tab==='agenda'?'at-agenda':''}" aria-hidden="true"></span></div>
 ${['task','agenda'].map(key=>`<div id="time-panel-${key}" role="tabpanel" aria-labelledby="tab-${key}" tabindex="0" ${tab!==key?'hidden inert':''}>${tab===key?contents:''}</div>`).join('')}`;}
function agenda(){
 const groups=groupAgenda(tasks());
 const pending=tasks().filter(task=>!task.completed).length;
 return `<div class="agenda"><div class="agenda-overview"><p class="agenda-caption">${esc(shift()?.label||'Sin turno activo')}</p><p class="agenda-count">${tasks().length} ${tasks().length===1?'tarea':'tareas'} · ${pending} ${pending===1?'pendiente':'pendientes'}</p></div>
 ${groups.map((group,index)=>`<section class="agenda-group" aria-labelledby="agenda-group-${index}"><div class="agenda-group-heading"><h3 id="agenda-group-${index}">${esc(group.label)}</h3>${group.date&&['Hoy','Mañana'].includes(group.label)?`<span>${displayDate(group.date)}</span>`:''}</div><div class="agenda-items">${group.tasks.map(t=>`<button type="button" class="agenda-task ${t.completed?'is-completed':''} ${selected?.id===t.id?'current':''}" data-action="task:${t.id}" ${selected?.id===t.id?'aria-current="true"':''}><span class="agenda-time">${esc(t.time||'Sin hora')}</span><span class="agenda-detail"><span class="agenda-title">${esc(t.title)}</span><small>${esc(bedLabel(t))}${t.completed?' · Completada':''}</small></span>${t.completed?icon('circle-check'):''}</button>`).join('')}</div></section>`).join('')||`<div class="agenda-empty">${icon('calendar-days')}<p>No hay tareas en este turno.</p><span>${active()&&!archiveId?'Agrega una tarea. Aparecerá aquí aunque no tenga fecha.':'Las tareas con y sin fecha aparecerán aquí.'}</span>${active()&&!archiveId?btn('Agregar tarea','add-task','plus'):''}</div>`}
 <p class="agenda-zone">${ZONE}<br>Lista del turno · Sin avisos programados</p></div>`;
}
function selectTab(next, modality=inputModality) {
 if(tab===next)return;
 const marker=$('.tab-indicator');
 const previous=marker?.getBoundingClientRect?.();
 tab=next;
 render();
 motion.tabIndicator($('.tab-indicator'),previous,modality);
}

function drawerBody(){return `<h2 id="dialog-title" class="sr-only">${overlay==='navigation-drawer'?'Navegación':'Tiempo'}</h2>${overlay==='navigation-drawer'?`<div class="drawer-close">${btn('Cerrar navegación','dismiss','x','icon-button')}</div><nav aria-label="Navegación móvil">${navigation()}</nav>`:inspectorContent()}`;}
function updateRegion(key,element,markup){if(renderedParts.get(key)!==markup){motion.cancelWithin(element);element.innerHTML=markup;renderedParts.set(key,markup);}}
function updateWorkspacePart(key,selector,markup){if(renderedParts.get(key)===markup)return;const old=$('.workspace').querySelector(selector);if(old){motion.cancelWithin(old);old.outerHTML=markup;}else $('.workspace').insertAdjacentHTML('beforeend',markup);renderedParts.set(key,markup);}
function syncControls(){
 for(const check of document.querySelectorAll('[data-check]'))check.checked=Boolean(data.tasks.find(t=>t.id===check.dataset.check)?.completed);
 if(!draft||!$('#editor-form'))return;
 const values={title:draft.title,body:draft.body,reason:draft.reason,...rawTemporal};
 for(const [id,value] of Object.entries(values)){const input=$('#'+id);if(input&&input.value!==String(value??''))input.value=String(value??'');}
 if($('#editor-completed'))$('#editor-completed').checked=Boolean(draft.completed);
 if($('#priority'))for(const option of $('#priority').options)option.selected=option.value===draft.priority;
 if($('#save-error'))$('#save-error').textContent=error;
 if($('#save-feedback'))$('#save-feedback').textContent=feedback||(dirty?'Cambios sin guardar':readonly()?'Solo lectura':'Guardado en memoria de demostración');
 const submit=$('#editor-form button[type="submit"]'),cancel=$('[data-action="cancel-draft"]');
 if(submit)submit.disabled=!dirty||busy;
 if(cancel)cancel.disabled=!dirty||busy;
}
function render(){
 if(!data)return;
 const focused=document.activeElement,key=focusKey(focused),selection=focused?.selectionStart;
 const properties=[...document.querySelectorAll('.property')];
 if(properties.length){expandedProperties.clear();for(const property of properties)if(property.hasAttribute('open'))expandedProperties.add(property.querySelector('summary').dataset.focus);}
 const opened=[...expandedProperties];
 const scroll={navigation:$('.nav-scroll')?.scrollTop||0,inspector:$('.inspector')?.scrollTop||0};
 const viewChanged=renderedView!==null&&renderedView!==view;
 if(!$('.shell')){$('#app').innerHTML='<div class="shell"><nav class="navigation" aria-label="Navegación principal"></nav><div class="workspace"></div><aside class="inspector" aria-label="Tiempo"></aside></div>';renderedParts.clear();}
 $('.shell').className=`shell ${view==='home'?'home-shell':''} ${inspector&&view!=='home'?'with-inspector':''}`;
 updateRegion('navigation',$('.navigation'),overlay==='navigation-drawer'?'':navigation());
 updateWorkspacePart('toolbar','.toolbar',toolbar());
 updateWorkspacePart('center','#main',center());
 $('.inspector').hidden=!(inspector&&view!=='home');
 updateRegion('inspector',$('.inspector'),overlay==='time-drawer'?'':inspectorContent());
 if(overlay&&$('#modal').open)updateRegion('drawer',$('#modal'),drawerBody());
 syncControls();
 syncFieldErrors();
 for(const id of opened)document.querySelector(`[data-focus="${id}"]`)?.parentElement.setAttribute('open','');
 for(const property of document.querySelectorAll('.property'))motion.syncDisclosure(property);
 if($('.nav-scroll'))$('.nav-scroll').scrollTop=scroll.navigation;
 if($('.inspector'))$('.inspector').scrollTop=scroll.inspector;
 restoreFocus(key);
 if(typeof selection==='number')try{document.activeElement?.setSelectionRange(selection,selection);}catch{}
 if(viewChanged){motion.cancelAll();motion.enter($('#main'),'screen',inputModality);}
 renderedView=view;
}

function updateDirty(){
 // Keep submitted errors until the corresponding constraint is actually resolved.
 // Validate dependencies too (time can require date), but do not flag untouched fields early.
 const current=validateEditor(draft,rawTemporal,selectedIsNote());
 fieldErrors=Object.fromEntries(Object.keys(fieldErrors).filter(id=>current[id]).map(id=>[id,current[id]]));
 syncFieldErrors();dirty=true;error='';feedback='Cambios sin guardar';
 $('#save-feedback')&&($('#save-feedback').textContent=feedback);
 $('#save-error')&&($('#save-error').textContent='');
 const save=$('#editor-form button[type="submit"]');if(save)save.disabled=false;
 const cancel=$('[data-action="cancel-draft"]');if(cancel)cancel.disabled=false;
}
function readTemporal(){if(!selectedIsNote())draft=applyTemporalDraft(draft,rawTemporal);}
function syncFieldErrors(){
 for(const input of document.querySelectorAll('#editor-form input, #editor-form textarea, [data-field]')){
  const id='field-error-'+input.id, message=fieldErrors[input.id];
  let hint=$('#'+id);
  if(message){
   if(!hint){hint=document.createElement('span');hint.id=id;hint.className='field-error error';input.insertAdjacentElement('afterend',hint);}
   hint.textContent=message;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby',id);
  }else{input.removeAttribute('aria-invalid');if(input.getAttribute('aria-describedby')===id)input.removeAttribute('aria-describedby');hint?.remove();}
 }
}
function focusFirstInvalid(){
 const id=Object.keys(fieldErrors)[0];if(!id)return;
 // A pending-navigation dialog must finish closing before a field can receive focus.
 if($('#modal').open&&!overlay)return;
 if(Object.hasOwn(rawTemporal||{},id)){
  tab='task';
  if(window.innerWidth<1000){if(overlay!=='time-drawer')drawer('time-drawer');else render();}
  else{inspector=true;render();}
  const details=$('#'+id)?.closest('.property');
  if(details){expandedProperties.add(details.querySelector('summary').dataset.focus);motion.disclosure(details,true,'keyboard');}
 }
 $('#'+id)?.focus();
}
async function save(){
 if(!draft||readonly()||busy)return !dirty;
 fieldErrors=validateEditor(draft,rawTemporal,selectedIsNote());
 if(Object.keys(fieldErrors).length){error=Object.values(fieldErrors)[0];clearNotification();render();focusFirstInvalid();return false;}
 try{readTemporal();busy=true;render();const result=selectedIsNote()?await adapter.saveNote(draft):await adapter.saveTask(draft);data=await adapter.load();draft=result;rawTemporal=createTemporalDraft(draft);dirty=false;feedback='Guardado en esta demostración.';error='';notify(feedback);return true;}
 catch(e){error=e.code==='SIMULATED_CONFLICT'?'Conflicto simulado. Tu borrador se conserva. Vuelve a guardar para reintentar.':e.message;notify(error,'error');return false;}
 finally{busy=false;render();}
}

function openFirstTask(){view='workspace';archiveId=null;const first=data.tasks.find(t=>t.shiftId===data.activeShiftId);if(first)select('task',first.id);else{selected=draft=null;render();}}
function drawer(kind){const origin=focusKey(document.activeElement);closeModal();returnFocus=origin;overlay=kind;if(kind==='time-drawer'&&!draft)tab='agenda';render();const m=$('#modal');m.className='drawer '+kind;m.innerHTML=drawerBody();renderedParts.set('drawer',drawerBody());syncFieldErrors();m.showModal();motion.enter(m,'drawer',inputModality);}
function inputModal(kind,bedId){const labels={task:['Agregar tarea','Título de tarea nueva'],bed:['Agregar cama','Nombre de cama'],note:['Nueva nota rápida','Título de nota nueva'],shift:['Iniciar turno','Nombre del turno']};const [title,label]=labels[kind];modal(title,`<form id="create-form" data-kind="${kind}" data-bed="${esc(bedId||'')}"><label for="new-title">${label}</label><input id="new-title" aria-describedby="create-error" required maxlength="300" placeholder="${kind==='bed'?'Cama 3':kind==='shift'?'Turno de noche':''}"><p class="muted">Solo contenido de prueba, sin datos de pacientes.</p><p class="error" id="create-error" role="alert"></p><div class="dialog-actions">${btn('Cancelar','dismiss')}<button class="primary" type="submit">${kind==='shift'?'Iniciar':'Crear'}</button></div></form>`);$('#new-title').focus();}
function renameBedModal(id) {
 const bed=data.beds.find(item=>item.id===id);
 if(!bed||archiveId)return;
 modal('Editar nombre de grupo', `<form id="rename-bed-form" data-bed="${esc(id)}"><label for="bed-name">Nombre del grupo o cama</label><input id="bed-name" value="${esc(bed.label)}" required maxlength="300" aria-describedby="bed-name-hint rename-bed-error"><p id="bed-name-hint" class="muted">Las tareas permanecen en este grupo. Solo cambia su nombre en esta demostración.</p><p id="rename-bed-error" class="error" role="alert"></p><div class="dialog-actions">${btn('Cancelar','dismiss')}<button type="submit" class="primary">Guardar nombre</button></div></form>`);
 $('#bed-name').focus();
}
function validateNameInput(input,hint,label){
 input.removeAttribute('aria-invalid');hint.textContent='';hint.setAttribute('role','alert');
 if(input.value.trim()&&input.value.length<=300)return true;
 hint.textContent=label+': escribe de 1 a 300 caracteres.';hint.removeAttribute('role');input.setAttribute('aria-invalid','true');input.focus();return false;
}
async function renameBed(event) {
 event.preventDefault();
 if(busy||archiveId)return;
 const form=event.target;
 const input=form.querySelector('#bed-name');
 const bed=data.beds.find(item=>item.id===form.dataset.bed);
 if(!bed||bed.shiftId!==data.activeShiftId)return;
 // A no-op does not consume a failure fixture or mutate the domain.
 if(input.value.trim()===bed.label){closeModal();return;}
 if(!validateNameInput(input,form.querySelector('#rename-bed-error'),'Nombre del grupo'))return;
 const buttons=[...$('#modal').querySelectorAll('button')];
 busy=true;input.readOnly=true;buttons.forEach(button=>button.disabled=true);
 form.querySelector('#rename-bed-error').textContent='';
 try{
  await adapter.renameBed(bed.id,input.value);
  data=await adapter.load();
  closeModal();
  notify('Nombre del grupo guardado en esta demostración.');
 }catch(e){
  form.querySelector('#rename-bed-error').textContent=e.message;
 }finally{
  busy=false;
  if(form.isConnected){input.readOnly=false;buttons.forEach(button=>button.disabled=false);}
  render();
 }
}
async function handle(action){if(busy)return;
 const [type,id]=action.split(':');
 switch(type){
 case 'home':return requestNavigation(()=>{view='home';archiveId=null;selected=draft=null;render();});
 case 'open-shift':return requestNavigation(()=>{active()?openFirstTask():inputModal('shift');});
 case 'notes':return requestNavigation(()=>{archiveId=null;if(data.notes.length)select('note',data.notes[0].id);else{view='notes';draft=selected=null;render();}});
 case 'task':return requestNavigation(()=>{if(data.tasks.some(t=>t.id===id))select('task',id);});
 case 'note':return requestNavigation(()=>{archiveId=null;select('note',id);});
 case 'add-task':if(!active())return;return requestNavigation(()=>inputModal('task',id||(!archiveId?draft?.bedId:null)));
 case 'add-bed':if(!active())return;return requestNavigation(()=>inputModal('bed'));
 case 'rename-bed':if(archiveId||!data.beds.some(bed=>bed.id===id&&bed.shiftId===data.activeShiftId))return;return requestNavigation(()=>{
  // This action stays on the same task: honor an explicit discard before opening.
  if(draft){draft=structuredClone(findSelected());rawTemporal=createTemporalDraft(draft);dirty=false;error=feedback='';render();}
  renameBedModal(id);
 });
 case 'add-note':return requestNavigation(()=>inputModal('note'));
 case 'bed':expanded.has(id)?expanded.delete(id):expanded.add(id);return render();
 case 'clear-filters':query='';filter='all';render();$('#search')?.focus();return;
 case 'filter-all':filter='all';return render();
 case 'filter-pending':filter='pending';return render();
 case 'cancel-draft':fieldErrors={};draft=structuredClone(findSelected());rawTemporal=createTemporalDraft(draft);dirty=false;error=feedback='';return render();
 case 'navigation':return drawer('navigation-drawer');
 case 'toggle-inspector':if(window.innerWidth<1000||view==='home')return drawer('time-drawer');inspector=!inspector;render();if(inspector)motion.enter($('.inspector'),'drawer',inputModality);return;
 case 'close-inspector':if($('#modal').open)return closeModal();inspector=false;render();$('[data-action="toggle-inspector"]')?.focus();return;
 case 'tab-task':case 'tab-agenda':return selectTab(type==='tab-task'?'task':'agenda');
 case 'clear-feedback':return clearNotification();
 case 'archive':return requestNavigation(()=>{view='archive';selected=draft=null;archiveId=null;render();});
 case 'archive-shift':return requestNavigation(()=>{archiveId=id;const first=tasks()[0];if(first)select('task',first.id);else{view='workspace';selected=draft=null;render();}});
 case 'close-shift':return requestNavigation(()=>{const count=data.tasks.filter(t=>t.shiftId===data.activeShiftId&&!t.completed).length;modal('Cerrar turno',`<p><strong>${count} ${count===1?'tarea pendiente':'tareas pendientes'}</strong> ${count===1?'se conservará':'se conservarán'} en el archivo.</p><p>No se completarán ni pasarán al siguiente turno. Este prototipo no tiene avisos conectados.</p><p class="error" id="close-error" role="alert"></p>`,btn('Volver','dismiss')+btn('Cerrar y archivar','confirm-close','','primary'));});
 case 'confirm-close':busy=true;$('#modal button[data-action="confirm-close"]').disabled=true;try{await adapter.closeShift(data.activeShiftId);data=await adapter.load();closeModal();archiveId=null;selected=draft=null;view='home';notify('Turno archivado en esta demostración. Los pendientes se conservan.');}catch(e){$('#close-error').textContent=e.code==='SIMULATED_CONFLICT'?'Conflicto simulado. El turno sigue abierto. Vuelve a pulsar «Cerrar y archivar».':e.message;}finally{busy=false;const retry=$('#modal [data-action="confirm-close"]');if(retry)retry.disabled=false;render();}return;
 case 'more':return modal('Más opciones',active()?btn('Cerrar turno','close-shift','power','nav-item'):'<p>Sin acciones adicionales.</p>');
 case 'demo':return modal('Demostración local','<p>Esta interfaz usa datos sintéticos y memoria temporal. Al recargar se restablece el ejemplo. No hay conexión con Supabase, ChatGPT ni avisos.</p><p>Prueba la recuperación de la siguiente acción de demostración:</p>',btn('Simular fallo','simulate-error')+btn('Simular conflicto','simulate-conflict'));
 case 'simulate-error':case 'simulate-conflict':adapter.failNext(type==='simulate-error'?'error':'conflict');closeModal();notify('La próxima acción de demostración simulará un fallo.');return;
 case 'dismiss':pendingNavigation=null;return closeModal();
 case 'discard-navigation':{const next=pendingNavigation;pendingNavigation=null;fieldErrors={};dirty=false;closeModal();next?.();return;}
 case 'save-navigation':{const saved=await save(),next=pendingNavigation;pendingNavigation=null;closeModal();if(saved)next?.();else focusFirstInvalid();return;}
 }
}
async function create(event){event.preventDefault();if(busy)return;const f=event.target,kind=f.dataset.kind,title=$('#new-title').value,bed=f.dataset.bed||null;if(!validateNameInput($('#new-title'),$('#create-error'),kind==='bed'||kind==='shift'?'Nombre':'Título'))return;const submit=f.querySelector('[type="submit"]');submit.disabled=true;busy=true;try{let item;if(kind==='task')item=await adapter.createTask(title,bed);if(kind==='bed')item=await adapter.createBed(title);if(kind==='note')item=await adapter.createNote(title);if(kind==='shift')item=await adapter.openShift(title);data=await adapter.load();closeModal();archiveId=null;if(kind==='task'){expanded.add(bed);select('task',item.id);}else if(kind==='note')select('note',item.id);else if(kind==='bed'){expanded.add(item.id);view='workspace';render();}else openFirstTask();notify('Creado en esta demostración.');}catch(e){$('#create-error').textContent=e.message;submit.disabled=false;}finally{busy=false;render();}}
document.documentElement.dataset.inputModality='keyboard';
document.addEventListener('pointerdown',()=>{inputModality='pointer';document.documentElement.dataset.inputModality='pointer';},true);
document.addEventListener('keydown',()=>{inputModality='keyboard';document.documentElement.dataset.inputModality='keyboard';motion.cancelAll();},true);
document.addEventListener('click',e=>{
 const summary=e.target.closest('.property > summary');
 if(summary){e.preventDefault();motion.disclosure(summary.parentElement,!summary.parentElement.hasAttribute('open'),inputModality);return;}
 const b=e.target.closest('[data-action]');if(b)handle(b.dataset.action);
});
document.addEventListener('toggle',e=>{
 const details=e.target;
 if(!details.matches?.('.property')||!details.isConnected)return;
 motion.syncDisclosure(details);
 const key=details.querySelector('summary').dataset.focus;
 details.hasAttribute('open')?expandedProperties.add(key):expandedProperties.delete(key);
},true);
document.addEventListener('submit',e=>{if(e.target.id==='editor-form'){e.preventDefault();save();}if(e.target.id==='create-form')create(e);if(e.target.id==='rename-bed-form')renameBed(e);});
document.addEventListener('input',e=>{const t=e.target;if(['new-title','bed-name'].includes(t.id)){t.removeAttribute('aria-invalid');const hint=$('#'+(t.id==='new-title'?'create-error':'rename-bed-error'));if(hint)hint.textContent='';return;}if(t.id==='search'){query=t.value;const pos=t.selectionStart;render();$('#search')?.focus();try{$('#search')?.setSelectionRange(pos,pos);}catch{}return;}if(!draft||readonly()||busy)return;if(['title','body','reason','priority'].includes(t.id)){draft[t.id]=t.value;updateDirty();}if(t.dataset.field){rawTemporal[t.dataset.field]=t.value;updateDirty();}});
document.addEventListener('change',e=>{
 const t=e.target;
 if(busy){if(t.dataset.check)t.checked=Boolean(data.tasks.find(task=>task.id===t.dataset.check)?.completed);return;}
 if(t.id==='priority'){draft.priority=t.value;updateDirty();}
 if(t.id==='editor-completed'){draft.completed=t.checked;updateDirty();}
 if(t.dataset.check){
  const id=t.dataset.check;
  const completionFocus=focusKey(document.activeElement);
  t.checked=Boolean(data.tasks.find(task=>task.id===id)?.completed);
  requestNavigation(async()=>{
   busy=true;render();
   try{
    const task=data.tasks.find(item=>item.id===id);
    await adapter.saveTask({...task,completed:!task.completed});data=await adapter.load();
    if(selected?.id===id){draft=structuredClone(findSelected());rawTemporal=createTemporalDraft(draft);}
    notify('Estado guardado en la demostración. Los avisos no se modifican.');
   }catch(e){notify(e.message,'error');error=e.message;}
   finally{busy=false;render();if(completionFocus?.check&&(!document.activeElement?.isConnected||document.activeElement===document.body||document.activeElement.dataset?.check===completionFocus.check))restoreFocus(completionFocus);}
  });
 }
});
document.addEventListener('keydown',e=>{
 if(e.target.getAttribute('role')==='tab'&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
  e.preventDefault();
  const keys=['task','agenda'];
  const current=keys.indexOf(tab);
  const next=e.key==='Home'?'task':e.key==='End'?'agenda':keys[(current+(e.key==='ArrowRight'?1:-1)+keys.length)%keys.length];
  selectTab(next,'keyboard');$('#tab-'+tab)?.focus();
 }
});
$('#modal').addEventListener('cancel',e=>{e.preventDefault();if(!busy){pendingNavigation=null;closeModal();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
async function init(){try{data=await adapter.load();render();}catch(e){$('#app').innerHTML=`<main><h1>No se pudo cargar</h1><p>${esc(e.message)}</p></main>`;}}
init();
