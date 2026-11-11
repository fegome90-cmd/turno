import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
import {createMotion, MOTION} from '../src/motion.mjs';
import {createPreviewAdapter} from '../src/preview-adapter.mjs';

let run=0;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function setup(width=1440){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=width;
 let focused=window.document.body;
 Object.defineProperty(window.document,'activeElement',{configurable:true,get:()=>focused});
 window.HTMLElement.prototype.focus=function(){if(!this.disabled)focused=this;};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?emil=${++run}`);await waitForAppReady(window.document);
 const q=s=>window.document.querySelector(s);
 const click=async s=>{assert.ok(q(s),s);q(s).focus();q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await pause(2);};
 const fill=(s,value)=>{q(s).value=value;q(s).dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=async(id='editor-form')=>{q('#'+id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await waitForIdle(window.document);};
 return {q,click,fill,submit,window};
}

test('editing unrelated notes preserves all unresolved temporal errors',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 a.fill('#date','31/02/2026');a.fill('#performed','25:00');await a.submit();
 a.fill('#body','Material de práctica, sin datos reales.');
 assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');
 assert.equal(a.q('#performed').getAttribute('aria-invalid'),'true');
 assert.match(a.q('#field-error-date').textContent,/fecha/);
 assert.match(a.q('#field-error-performed').textContent,/24 horas/);
 assert.equal(a.q('#body').value,'Material de práctica, sin datos reales.');
});
test('invalid-to-invalid retains its error and correction clears only resolved errors',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 a.fill('#estimate','-1');a.fill('#performed','99:00');await a.submit();
 a.fill('#estimate','1441');assert.equal(a.q('#estimate').getAttribute('aria-invalid'),'true');
 a.fill('#estimate','1440');assert.equal(a.q('#estimate').hasAttribute('aria-invalid'),false);
 assert.equal(a.q('#performed').getAttribute('aria-invalid'),'true');
 a.fill('#performed','23:59');assert.equal(a.q('#performed').hasAttribute('aria-invalid'),false);
 await a.submit();assert.match(a.q('#save-feedback').textContent,/Guardado/);
});
test('changing a dependent time clears a date-required error without a new submit',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 a.fill('#date','');a.fill('#time','13:00');await a.submit();
 assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');
 a.fill('#time','');assert.equal(a.q('#date').hasAttribute('aria-invalid'),false);
});
test('note title validation survives body edits and ends when the title is valid',async()=>{
 const a=await setup();await a.click('[data-action="notes"]');a.fill('#title','   ');await a.submit();
 a.fill('#body','Una nota de prueba.');assert.equal(a.q('#title').getAttribute('aria-invalid'),'true');
 a.fill('#title','Organización');assert.equal(a.q('#title').hasAttribute('aria-invalid'),false);
});
test('mobile temporal errors survive closing Time and editing the draft',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');
 await a.click('[data-action="toggle-inspector"]');a.fill('#date','31/02/2026');
 await a.click('[data-action="close-inspector"]');await a.submit();
 await a.click('[data-action="close-inspector"]');a.fill('#body','Borrador móvil');
 await a.click('[data-action="toggle-inspector"]');
 assert.equal(a.q('#modal #date').getAttribute('aria-invalid'),'true');
 assert.equal(a.q('#body').value,'Borrador móvil');
});
test('closing conflict names Close and archive, keeps the shift open, and retries',async()=>{
 const a=await setup();await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-conflict"]');
 await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await waitFor(()=>a.q('#close-error')?.textContent);
 assert.match(a.q('#close-error').textContent,/turno sigue abierto/);
 assert.match(a.q('#close-error').textContent,/Cerrar y archivar/);
 assert.doesNotMatch(a.q('#close-error').textContent,/guardar|borrador/i);
 assert.equal(a.q('[data-action="confirm-close"]').disabled,false);
 await a.click('[data-action="confirm-close"]');await waitForIdle(a.window.document);
 assert.equal(a.q('#modal').open,false);assert.equal(a.q('[data-action="close-shift"]'),null);
});
test('simulated adapter conflict identifies its type without prescribing Save',async()=>{
 const adapter=createPreviewAdapter();adapter.failNext('conflict');
 await assert.rejects(adapter.closeShift('demo-shift-1'),e=>e.code==='SIMULATED_CONFLICT'&&!/guardar|borrador/i.test(e.message));
 assert.equal((await adapter.load()).activeShiftId,'demo-shift-1');
});
test('one pending task has singular copy in Agenda and close confirmation',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const id of ['task-1','task-2','task-3']){
  const input=a.q(`[data-check="${id}"]`);input.checked=true;
  input.dispatchEvent(new a.window.Event('change',{bubbles:true}));await waitForIdle(a.window.document);
 }
 await a.click('[data-action="tab-agenda"]');assert.match(a.q('.agenda-count').textContent,/4 tareas · 1 pendiente$/);
 await a.click('[data-action="close-shift"]');assert.match(a.q('#modal strong').textContent,/^1 tarea pendiente$/);
});
test('plausible long multilingual labels remain literal and retain identity',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="rename-bed:bed-1"]');
 const label='Preparación y revisión de material · 王秀英 · Seán O\'Brien · <organización>';
 a.fill('#bed-name',label);await a.submit('rename-bed-form');
 assert.equal(a.q('[data-action="bed:bed-1"] span').textContent,label);
 assert.equal(a.q('[data-action="bed:bed-1"] organización'),null);
 assert.ok(a.q('[data-action="task:task-1"]'));
});
test('schema-backed title extremes round-trip through the actual adapter',async()=>{
 const adapter=createPreviewAdapter();
 for(const title of ['J','Coordinación de material de simulación · '.repeat(8).slice(0,300),'<script>ejemplo</script>']){
  const task=await adapter.createTask(title);assert.equal(task.title,title.trim());
 }
 await assert.rejects(adapter.createTask('Revisión de material '.repeat(20)),/300/);
});
test('documented v5 motion values are the single timing source',()=>{
 assert.deepEqual(MOTION,{screen:150,dialog:240,drawer:260,disclosure:220,tabs:150,feedback:180,toast:300,easing:'cubic-bezier(0.22, 1, 0.36, 1)',indicatorEasing:'cubic-bezier(0.77, 0, 0.175, 1)',drawerEasing:'cubic-bezier(0.32, 0.72, 0, 1)'});
});
test('rapid feedback retargets from current painted state before cancellation',()=>{
 const calls=[],cancels=[];
 const node={ownerDocument:{defaultView:{getComputedStyle:()=>({opacity:'0.91',transform:'matrix(1, 0, 0, 1, 0, 2)'})}},animate(frames,options){calls.push({frames,options});return {cancel(){cancels.push(true);}};}};
 const motion=createMotion();motion.enter(node,'feedback','pointer');motion.enter(node,'feedback','pointer');
 assert.equal(cancels.length,1);assert.equal(calls[1].frames[0].opacity,'0.91');
 assert.equal(calls[1].frames[0].transform,'matrix(1, 0, 0, 1, 0, 2)');
 assert.deepEqual(Object.keys(calls[1].frames[0]).sort(),['opacity','transform']);
});
test('viewport safe areas opt in without disabling user zoom',async()=>{
 const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/viewport-fit=cover/);assert.match(html,/interactive-widget=resizes-content/);
 assert.doesNotMatch(html,/user-scalable\s*=\s*no|maximum-scale/);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 for(const edge of ['top','right','bottom','left'])assert.ok(css.includes(`env(safe-area-inset-${edge}, 0px)`));
 assert.match(css,/\.drawer nav\s*\{[^}]*min-height:0/);
});
test('touch changes target controls and coarse pointers without suppressing text selection globally',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/button,summary,input\[type=checkbox\]\s*\{[^}]*touch-action:manipulation/);
 assert.match(css,/@media\s*\(pointer:coarse\)[\s\S]*font-size:var\(--type-body\)/);
 assert.doesNotMatch(css,/(?:body|html|\*)\s*\{[^}]*user-select:none/);
 assert.doesNotMatch(css,/touch-action:none/);
 assert.match(css,/button:not\(:disabled\):active/);
 assert.match(css,/\.agenda-count\s*\{[^}]*font-variant-numeric:tabular-nums/);
});
test('long labels reserve trailing controls rather than truncating their identity',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.bed-line>\.icon-button\s*\{[^}]*flex-shrink:0/);
 assert.match(css,/\.shift-context strong,\.metadata>span:first-child,\.tree-task span,\.archive-link span\s*\{[^}]*overflow-wrap:break-word/);
});
test('active backgrounds win the inherited hover cascade for ordinary and selected controls',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 // Same pseudo-class/negation specificity, with the active declaration later.
 // This is a cascade contract, not a computed-style assertion in a real browser.
 const pairs=[
  ['button:hover:not(:disabled):not(.selected):not(.active):not(.current):not(.primary)',
   'button:not(:disabled):active:not(.selected):not(.active):not(.current):not(.primary)'],
  ['.filter.active:hover:not(:disabled)','.filter.active:not(:disabled):active'],
  ['.tree-task.current:hover:not(:disabled)','.tree-task.current:not(:disabled):active'],
  ['button.primary:hover:not(:disabled)','button.primary:not(:disabled):active'],
 ];
 for(const [hover,active] of pairs){
  assert.ok(css.includes(hover),hover);assert.ok(css.includes(active),active);
  assert.ok(css.indexOf(active)>css.indexOf(hover),`${active} must follow ${hover}`);
 }
 assert.match(css,/button:not\(:disabled\):active\{[^}]*transition:none/);
});

// The app loads through the preview adapter (220 ms); wait until it has rendered instead of a fixed 250 ms.
async function waitForAppReady(document,{timeout=3000}={}){const end=Date.now()+timeout;while(!document.querySelector('#app .shell')){if(Date.now()>end)throw new Error('app did not finish loading: '+(document.querySelector('#app main')?.textContent||'no render'));await new Promise(r=>setTimeout(r,10));}}

// Wait for the app to finish an adapter round trip instead of a fixed sleep: completing or saving
// costs two 220 ms adapter waits (save + reload), so a fixed 500 ms left ~60 ms of margin.
async function waitFor(condition,{timeout=3000,interval=20}={}){const end=Date.now()+timeout;for(;;){if(condition())return;if(Date.now()>end)throw new Error('waitFor timed out: '+condition);await new Promise(r=>setTimeout(r,interval));}}

// No adapter round trip is still pending: the controls the app disables while it waits (Save not
// reading "Guardando…", Close and archive, Create, Save name, checkboxes outside the archive) are
// enabled again or gone. Used instead of fixed sleeps after save, complete, create, rename or close.
function appIdle(document){
 const save=document.querySelector('#editor-form button[type="submit"]');
 if(save?.textContent.includes('Guardando'))return false;
 for(const selector of ['#modal [data-action="confirm-close"]','#create-form [type="submit"]','#rename-bed-form [type="submit"]'])if(document.querySelector(selector)?.disabled)return false;
 if(!document.querySelector('.archive-notice')&&[...document.querySelectorAll('[data-check]')].some(check=>check.disabled))return false;
 return true;
}
function waitForIdle(document){return waitFor(()=>appIdle(document));}
