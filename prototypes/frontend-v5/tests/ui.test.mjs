import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
let run=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(width=1440){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=width;
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?test=${++run}`);await waitForAppReady(window.document);
 const q=s=>window.document.querySelector(s),click=async s=>{assert.ok(q(s),s);q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await sleep(2);};
 const fill=(s,value)=>{const e=q(s);assert.ok(e,s);e.value=value;e.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=async()=>{q('#editor-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);};
 return {q,click,fill,submit,window};
}
test('home has greeting, one state summary action and no date input',async()=>{const a=await setup();assert.match(a.q('h1').textContent,/Hola, Demo/);assert.equal(a.q('main .home-summary button').dataset.action,'open-shift');assert.equal(a.q('main input'),null);});
test('temporal draft survives folding beds and invalid save',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#date','31/02/2026');await a.click('[data-action="bed:bed-1"]');assert.equal(a.q('#date').value,'31/02/2026');await a.submit();assert.equal(a.q('#date').value,'31/02/2026');assert.match(a.q('#save-error').textContent,/fecha/);});
test('mobile drawer contains only one temporal control instance',async()=>{const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="toggle-inspector"]');assert.equal(a.window.document.querySelectorAll('#date').length,1);assert.ok(a.q('#modal #date'));});
test('mobile bed fold updates visible drawer',async()=>{const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="navigation"]');assert.ok(a.q('#modal [data-action="task:task-1"]'));await a.click('#modal [data-action="bed:bed-1"]');assert.equal(a.q('#modal [data-action="task:task-1"]'),null);});
test('editing is locked during pending save',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Saved');a.q('#editor-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));assert.ok(a.q('#body').hasAttribute('readonly'));await sleep(500);});
test('unsaved selection cancellation keeps draft',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Keep me');await a.click('[data-action="task:task-2"]');assert.ok(a.q('#modal').open);await a.click('#modal [data-action="dismiss"]');assert.equal(a.q('#body').value,'Keep me');assert.equal(a.q('#title').value,'Tarea 1');});
test('save error keeps body and is not successful save',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Kept');await a.click('[data-action="demo"]');await a.click('[data-action="simulate-error"]');await a.submit();assert.equal(a.q('#body').value,'Kept');assert.match(a.q('#save-error').textContent,/simulado/);assert.doesNotMatch(a.q('#save-feedback').textContent,/Guardado en esta/);});
test('title and body markup are rendered as text',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#title','<img src=x onerror=alert(1)>');a.fill('#body','</textarea><script>bad()</script>');await a.submit();assert.equal(a.q('#title').value,'<img src=x onerror=alert(1)>');assert.equal(a.q('#body').value,'</textarea><script>bad()</script>');assert.equal(a.window.document.querySelectorAll('script').length,1);});
test('new task is editable after confirmed create',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="add-task"]');a.fill('#new-title','Nueva tarea');a.q('#create-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);assert.equal(a.q('#title').value,'Nueva tarea');assert.equal(a.q('#body').hasAttribute('readonly'),false);});
test('close archives pending tasks and new shift starts empty',async()=>{const a=await setup();await a.click('[data-action="close-shift"]');assert.match(a.q('#modal').textContent,/4 tareas pendientes/);await a.click('[data-action="confirm-close"]');await sleep(500);await a.click('[data-action="archive"]');await a.click('[data-action="archive-shift:demo-shift-1"]');assert.ok(a.q('.archive-notice'));assert.ok(a.q('#body').hasAttribute('readonly'));await a.click('[data-action="open-shift"]');a.fill('#new-title','Turno siguiente');a.q('#create-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);assert.equal(a.q('.task-row'),null);assert.match(a.q('main').textContent,/Turno siguiente/);});
test('mobile raw temporal field is saved after drawer dismissal',async()=>{const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="toggle-inspector"]');a.fill('#modal #date','08/11/2026');await a.click('#modal [data-action="close-inspector"]');await a.submit();assert.equal(a.q('#date').value,'08/11/2026');assert.match(a.q('#save-feedback').textContent,/Guardado en esta/);});
test('native Escape cancel closes drawer and restores background navigation',async()=>{const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="navigation"]');const modal=a.q('#modal');modal.dispatchEvent(new a.window.Event('cancel',{cancelable:true}));assert.equal(modal.open,false);assert.ok(a.q('#app .navigation [data-action="open-shift"]'));});
test('saved task can switch selection without draft warning',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Saved task body');await a.submit();await a.click('[data-action="task:task-2"]');assert.equal(a.q('#title').value,'Revisar insumos');assert.ok(!a.q('#modal').open);});
test('Home greeting node survives opening and closing Time',async()=>{const a=await setup();const home=a.q('main.home');await a.click('[data-action="toggle-inspector"]');assert.ok(a.q('main.home')===home,'Home node must remain mounted');await a.click('#modal [data-action="close-inspector"]');assert.ok(a.q('main.home')===home,'Home node must remain mounted');assert.match(home.textContent,/Hola, Demo/);});
test('filter preserves current editor and navigation scroll position',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');const main=a.q('main');a.q('.nav-scroll').scrollTop=87;await a.click('[data-action="filter-pending"]');assert.ok(a.q('main')===main,'Editor node must remain mounted');assert.equal(a.q('.nav-scroll').scrollTop,87);});
test('pointer animates a view change but not routine filter updates',async()=>{const a=await setup();const calls=[];a.window.HTMLElement.prototype.animate=function(frames,options){calls.push({element:this,frames,options});return {cancel(){},finished:Promise.resolve()};};a.window.document.dispatchEvent(new a.window.Event('pointerdown',{bubbles:true}));await a.click('[data-action="open-shift"]');assert.equal(calls.length,1);assert.equal(calls[0].options.duration,150);await a.click('[data-action="filter-pending"]');assert.equal(calls.length,1);a.window.document.body.dispatchEvent(new a.window.Event('keydown',{bubbles:true}));await a.click('[data-action="home"]');assert.equal(calls.length,1);assert.match(a.q('main.home').textContent,/Hola, Demo/);delete a.window.HTMLElement.prototype.animate;});
test('Cancel resets all visible controls and save status after direct edits',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#title','SHOULD BE DISCARDED');a.fill('#date','31/02/2026');a.fill('#body','Discard body');a.q('#editor-completed').checked=true;a.q('#editor-completed').dispatchEvent(new a.window.Event('change',{bubbles:true}));await a.click('[data-action="cancel-draft"]');assert.equal(a.q('#title').value,'Tarea 1');assert.equal(a.q('#date').value,'07/11/2026');assert.equal(a.q('#body').value,'');assert.equal(a.q('#editor-completed').checked,false);assert.ok(a.q('#editor-form [type="submit"]').disabled);assert.ok(a.q('[data-action="cancel-draft"]').disabled);assert.doesNotMatch(a.q('#save-feedback').textContent,/Cambios sin guardar/);await a.click('[data-action="home"]');assert.ok(!a.q('#modal').open);});
test('failed sidebar completion restores confirmed checkbox state',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="demo"]');await a.click('[data-action="simulate-error"]');const check=a.q('[data-check="task-1"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await sleep(500);assert.equal(a.q('[data-check="task-1"]').checked,false);});
test('cancelling draft navigation restores sidebar checkbox state',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Keep draft');const check=a.q('[data-check="task-2"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await a.click('#modal [data-action="dismiss"]');assert.equal(a.q('[data-check="task-2"]').checked,false);assert.equal(a.q('#body').value,'Keep draft');});

test('Time from Home selects Agenda; Task without a selection explains its empty state',async()=>{const a=await setup();await a.click('[data-action="toggle-inspector"]');assert.equal(a.q('#tab-agenda').getAttribute('aria-selected'),'true');assert.ok(a.q('#time-panel-agenda .agenda'));await a.click('#tab-task');assert.match(a.q('#time-panel-task').textContent,/Selecciona una tarea/);assert.equal(a.q('#time-panel-task .agenda'),null);});
test('tabs retain raw temporal draft and open disclosure across panel replacement',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-focus="property-date"]');a.fill('#date','31/02/2026');await a.click('#tab-agenda');assert.ok(a.q('#time-panel-task').hasAttribute('hidden'));await a.click('#tab-task');assert.equal(a.q('#date').value,'31/02/2026');assert.ok(a.q('#date').closest('details').hasAttribute('open'));assert.equal(a.q('#date').closest('.property-content').hasAttribute('inert'),false);assert.ok(!a.q('#modal').open);});
test('tabs have distinct related panels and roving keyboard wraps without animating content',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');const key=async name=>{const e=new a.window.Event('keydown',{bubbles:true,cancelable:true});e.key=name;a.q('[role="tab"][aria-selected="true"]').dispatchEvent(e);await sleep(2);};for(const tab of a.window.document.querySelectorAll('[role="tab"]'))assert.ok(a.q('#'+tab.getAttribute('aria-controls')));await key('ArrowLeft');assert.equal(a.q('#tab-agenda').getAttribute('tabindex'),'0');assert.equal(a.q('#time-panel-agenda').hasAttribute('hidden'),false);await key('ArrowRight');assert.equal(a.q('#tab-task').getAttribute('aria-selected'),'true');await key('End');assert.equal(a.q('#tab-agenda').getAttribute('aria-selected'),'true');await key('Home');assert.equal(a.q('#tab-task').getAttribute('aria-selected'),'true');});
test('pointer tabs animate marker only and routine render does not replay it',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');const calls=[],animations=[];const proto=a.window.HTMLElement.prototype;const oldRect=proto.getBoundingClientRect;proto.getBoundingClientRect=function(){return {left:this.classList.contains('at-agenda')?120:0,width:120};};proto.animate=function(frames,options){const animation={cancelled:false,cancel(){this.cancelled=true;}};calls.push({element:this,frames,options});animations.push(animation);return animation;};try{a.window.document.dispatchEvent(new a.window.Event('pointerdown',{bubbles:true}));await a.click('#tab-agenda');assert.equal(calls.length,1);assert.ok(calls[0].element.classList.contains('tab-indicator'));assert.equal(calls[0].options.duration,150);assert.equal(a.q('#time-panel-agenda').hasAttribute('hidden'),false);await a.click('[data-action="filter-pending"]');assert.equal(calls.length,1);a.window.document.body.dispatchEvent(new a.window.Event('keydown',{bubbles:true}));assert.ok(animations[0].cancelled);await a.click('#tab-task');assert.equal(calls.length,1);}finally{delete proto.animate;proto.getBoundingClientRect=oldRect;}});
test('native disclosure toggle synchronizes open state and inert without animation',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');const details=a.q('#date').closest('details');details.setAttribute('open','');details.dispatchEvent(new a.window.Event('toggle',{bubbles:true}));assert.equal(details.hasAttribute('open'),true);assert.equal(a.q('#property-content-date').hasAttribute('inert'),false);details.removeAttribute('open');details.dispatchEvent(new a.window.Event('toggle',{bubbles:true}));assert.equal(details.hasAttribute('open'),false);assert.ok(a.q('#property-content-date').hasAttribute('inert'));});
test('Agenda includes undated tasks regardless of navigation filter and shows selected completed state',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.q('#editor-completed').checked=true;a.q('#editor-completed').dispatchEvent(new a.window.Event('change',{bubbles:true}));await a.submit();await a.click('[data-action="filter-pending"]');await a.click('#tab-agenda');assert.match(a.q('.agenda').textContent,/Sin fecha/);assert.match(a.q('.agenda').textContent,/Preparar educación/);const current=a.q('.agenda-task[data-action="task:task-1"]');assert.equal(current.getAttribute('aria-current'),'true');assert.ok(current.classList.contains('is-completed'));assert.match(current.textContent,/Completada/);});
test('visible feedback uses one live announcement and can be dismissed without losing a draft',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Saved');await a.submit();assert.match(a.q('#notification #live').textContent,/Guardado/);assert.match(a.q('.toast-message').textContent,/Guardado/);assert.equal(a.q('.toast-list').getAttribute('aria-live'),null);assert.equal(a.q('#live').classList.contains('sr-only'),true);assert.equal(a.q('#save-feedback').getAttribute('role'),null);a.fill('#body','New draft');await a.click('.toast-close');assert.equal(a.q('#live').textContent,'');assert.equal(a.q('#body').value,'New draft');assert.equal(a.q('[type="submit"]').disabled,false);});
test('validation is associated with the invalid field without duplicate live alert',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#date','31/02/2026');await a.submit();assert.equal(a.q('#live-error').textContent,'');assert.match(a.q('#field-error-date').textContent,/fecha/);assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');assert.equal(a.q('#date').getAttribute('aria-describedby'),'field-error-date');assert.equal(a.q('#live').textContent,'');assert.equal(a.q('#save-error').getAttribute('role'),null);assert.equal(a.q('#date').value,'31/02/2026');});
test('rapid repeated checkbox change commits once without an artificial conflict',async()=>{const a=await setup();await a.click('[data-action="open-shift"]');for(let i=0;i<2;i++){const check=a.q('[data-check="task-1"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));}assert.equal(a.q('[data-check="task-1"]').disabled,true);await sleep(500);assert.equal(a.q('[data-check="task-1"]').checked,true);assert.equal(a.q('[data-check="task-1"]').disabled,false);assert.equal(a.q('#live-error').textContent,'');assert.match(a.q('#property-content-activity').textContent,/Versión local 2/);});
test('empty shift Agenda offers a useful no-date hint without making tasks or a calendar',async()=>{const a=await setup();await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await sleep(500);await a.click('[data-action="open-shift"]');a.fill('#new-title','Vacío');a.q('#create-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);await a.click('#tab-agenda');assert.match(a.q('.agenda-empty').textContent,/aunque no tenga fecha/);assert.ok(a.q('.agenda-empty [data-action="add-task"]'));assert.equal(a.q('.agenda-task'),null);await a.click('#tab-task');assert.match(a.q('#time-panel-task').textContent,/Selecciona una tarea/);});

test('dismissing focused feedback restores a safe focus target without stealing unrelated focus',async()=>{
 const a=await setup();
 await a.click('[data-action="open-shift"]');a.fill('#body','Focus test');await a.submit();
 let focused=a.q('.toast-close'),mainFocus=0;
 Object.defineProperty(a.window.document,'activeElement',{configurable:true,get:()=>focused});
 a.q('#main').focus=()=>{mainFocus++;focused=a.q('#main');};
 await a.click('.toast-close');
 assert.equal(mainFocus,1);assert.equal(focused,a.q('#main'));
 a.fill('#body','Another save');await a.submit();focused=a.q('#body');await a.click('.toast-close');assert.equal(mainFocus,1);
});

test('rename group is keyboard-labelled, prefills its name and updates navigation, metadata and Agenda',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 assert.equal(a.q('[data-action="rename-bed:bed-1"]').getAttribute('aria-label'),'Editar nombre de Cama 1');
 await a.click('[data-action="rename-bed:bed-1"]');assert.equal(a.q('#bed-name').value,'Cama 1');
 assert.equal(a.q('#bed-name').getAttribute('maxlength'),'300');assert.ok(a.q('label[for="bed-name"]'));
 a.fill('#bed-name','Cama norte');a.q('#rename-bed-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));
 await sleep(500);assert.ok(!a.q('#modal').open);
 assert.match(a.q('[data-action="bed:bed-1"]').textContent,/Cama norte/);
 assert.match(a.q('.metadata').textContent,/Cama norte/);
 assert.equal(a.q('[data-action="rename-bed:bed-1"]').getAttribute('aria-label'),'Editar nombre de Cama norte');
 await a.click('#tab-agenda');assert.match(a.q('.agenda-task[data-action="task:task-1"]').textContent,/Cama norte/);
 assert.match(a.q('.agenda-task[data-action="task:task-4"]').textContent,/Cama 2/);
});
test('cancelling rename leaves group and task selection unchanged',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="rename-bed:bed-1"]');
 a.fill('#bed-name','Discarded');await a.click('#modal [data-action="dismiss"]');
 assert.match(a.q('[data-action="bed:bed-1"]').textContent,/Cama 1/);assert.equal(a.q('#title').value,'Tarea 1');
});
test('invalid rename keeps entered value and error in the open modal',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="rename-bed:bed-1"]');
 a.fill('#bed-name','   ');a.q('#rename-bed-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));
 await sleep(500);assert.ok(a.q('#modal').open);assert.equal(a.q('#bed-name').value,'   ');
 assert.match(a.q('#rename-bed-error').textContent,/Nombre de la cama/);assert.equal(a.q('#rename-bed-form [type="submit"]').disabled,false);
 assert.match(a.q('[data-action="bed:bed-1"]').textContent,/Cama 1/);
});
test('rename failure preserves name draft and repeated submit is blocked while pending',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-error"]');
 await a.click('[data-action="rename-bed:bed-1"]');a.fill('#bed-name','Nombre recuperable');
 for(let i=0;i<2;i++)a.q('#rename-bed-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(a.q('#rename-bed-form [type="submit"]').disabled,true);
 await sleep(500);assert.ok(a.q('#modal').open);assert.equal(a.q('#bed-name').value,'Nombre recuperable');assert.match(a.q('#rename-bed-error').textContent,/simulado/);
 assert.match(a.q('[data-action="bed:bed-1"]').textContent,/Cama 1/);
 a.q('#rename-bed-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));await sleep(500);
 assert.ok(!a.q('#modal').open);assert.match(a.q('[data-action="bed:bed-1"]').textContent,/Nombre recuperable/);
});
test('renaming a group respects dirty task cancellation and explicit discard',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Keep until explicitly discarded');a.fill('#date','31/02/2026');
 await a.click('[data-action="rename-bed:bed-1"]');assert.equal(a.q('#bed-name'),null);
 await a.click('#modal [data-action="dismiss"]');assert.equal(a.q('#body').value,'Keep until explicitly discarded');assert.equal(a.q('#date').value,'31/02/2026');
 await a.click('[data-action="rename-bed:bed-1"]');await a.click('[data-action="discard-navigation"]');
 assert.equal(a.q('#bed-name').value,'Cama 1');assert.equal(a.q('#body').value,'');assert.equal(a.q('#date').value,'07/11/2026');
 await a.click('#modal [data-action="dismiss"]');assert.equal(a.q('#editor-form [type="submit"]').disabled,true);
});
test('rename noop does not consume a pending simulated failure or announce a change',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-error"]');
 await a.click('[data-action="rename-bed:bed-1"]');a.fill('#bed-name',' Cama 1 ');a.q('#rename-bed-form').dispatchEvent(new a.window.Event('submit',{bubbles:true,cancelable:true}));
 await sleep(20);assert.ok(!a.q('#modal').open);assert.doesNotMatch(a.q('#live').textContent,/Nombre de la cama guardado/);
 a.fill('#body','Test saved failure');await a.submit();assert.match(a.q('#live-error').textContent,/simulado/);
});
test('archived view does not expose editable group controls',async()=>{
 const a=await setup();await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await sleep(500);
 await a.click('[data-action="archive"]');await a.click('[data-action="archive-shift:demo-shift-1"]');
 assert.equal(a.q('[data-action^="rename-bed:"]'),null);assert.ok(a.q('#body').hasAttribute('readonly'));
});

test('invalid save-and-continue never opens rename or loses raw draft; next navigation is independent',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Preserve on failure');a.fill('#date','31/02/2026');
 await a.click('[data-action="rename-bed:bed-1"]');await a.click('[data-action="save-navigation"]');await sleep(500);
 assert.equal(a.q('#bed-name'),null);assert.ok(!a.q('#modal').open);assert.equal(a.q('#body').value,'Preserve on failure');assert.equal(a.q('#date').value,'31/02/2026');
 await a.click('[data-action="home"]');await a.click('[data-action="discard-navigation"]');assert.ok(a.q('main.home'));assert.equal(a.q('#bed-name'),null);
});
test('successful save-and-continue opens rename after saving the task draft',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Save before rename');
 await a.click('[data-action="rename-bed:bed-1"]');await a.click('[data-action="save-navigation"]');await sleep(500);
 assert.equal(a.q('#bed-name').value,'Cama 1');assert.equal(a.q('#body').value,'Save before rename');
 await a.click('#modal [data-action="dismiss"]');await a.click('[data-action="task:task-2"]');assert.ok(!a.q('#modal').open);
 await a.click('[data-action="task:task-1"]');assert.equal(a.q('#body').value,'Save before rename');
});

test('only Home subtitle varies per load; name and subtitle remain stable through Time and navigation',async()=>{
 const originalRandom=Math.random;let samples=0,a;
 try{Math.random=()=>{samples++;return .99;};a=await setup();}finally{Math.random=originalRandom;}
 const initial=a.q('.greeting p').textContent;
 assert.equal(initial,'¿En qué te ayudo hoy?');assert.equal(a.q('.greeting h1').textContent,'Hola, Demo.');assert.equal(samples,1);
 await a.click('[data-action="toggle-inspector"]');await a.click('#modal [data-action="close-inspector"]');
 assert.equal(a.q('.greeting p').textContent,initial);
 await a.click('[data-action="open-shift"]');await a.click('[data-action="home"]');
 assert.equal(a.q('.greeting p').textContent,initial);assert.equal(a.q('.greeting h1').textContent,'Hola, Demo.');
 assert.equal(a.q('.greeting p').getAttribute('aria-live'),null);
});
test('home summary reports the open shift and its pending count, and the greeting stays stable through Time and navigation',async()=>{
 const a=await setup();
 const summary=()=>a.q('main .home-summary p').textContent;
 const initial=summary();assert.equal(initial,'Turno de día · 4 pendientes');
 assert.equal(a.q('main .home-summary button').textContent,'Ir al turno actual');
 assert.equal(a.q('.greeting h1').textContent,'Hola, Demo.');
 await a.click('[data-action="toggle-inspector"]');await a.click('#modal [data-action="close-inspector"]');
 assert.equal(summary(),initial);
 await a.click('[data-action="open-shift"]');await a.click('[data-action="home"]');
 assert.equal(summary(),initial);assert.equal(a.q('.greeting h1').textContent,'Hola, Demo.');
});
test('home summary uses singular pending copy and the start action when no shift is open',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const id of ['task-1','task-2','task-3']){const input=a.q(`[data-check="${id}"]`);input.checked=true;input.dispatchEvent(new a.window.Event('change',{bubbles:true}));await waitFor(()=>{const el=a.q(`[data-check="${id}"]`);return el.checked&&!el.disabled;});}
 await a.click('[data-action="home"]');
 assert.equal(a.q('main .home-summary p').textContent,'Turno de día · 1 pendiente');
 await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await waitFor(()=>!a.q('#modal').open);
 assert.equal(a.q('main .home-summary p').textContent,'No hay un turno abierto.');
 assert.equal(a.q('main .home-summary button').textContent,'Iniciar turno');
});

test('new field validation does not discard previously unread stacked feedback',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Saved');await a.submit();
 const card=a.q('.toast-item');a.fill('#date','31/02/2026');await a.submit();
 assert.equal(a.q('.toast-item'),card);assert.match(a.q('#field-error-date').textContent,/fecha/);
});

// Wait for the app to finish an adapter round trip instead of a fixed sleep: completing or saving
// costs two 220 ms adapter waits (save + reload), so a fixed 500 ms left ~60 ms of margin.
async function waitFor(condition,{timeout=3000,interval=20}={}){const end=Date.now()+timeout;for(;;){if(condition())return;if(Date.now()>end)throw new Error('waitFor timed out: '+condition);await new Promise(r=>setTimeout(r,interval));}}

// The app loads through the preview adapter (220 ms); wait until it has rendered instead of a fixed 250 ms.
async function waitForAppReady(document,{timeout=3000}={}){const end=Date.now()+timeout;while(!document.querySelector('#app .shell, #app main')){if(Date.now()>end)throw new Error('app did not finish loading');await new Promise(r=>setTimeout(r,10));}}
