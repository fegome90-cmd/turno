import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
let run=0;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function setup(){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=1440;
 const calls=[];let current=null;
 window.history={get state(){return current;},pushState(state){calls.push(['push',state]);current=state;},replaceState(state){calls.push(['replace',state]);current=state;},back(){calls.push(['back']);}};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?history=${++run}`);await pause(250);
 const q=s=>window.document.querySelector(s);
 const click=async s=>{assert.ok(q(s),s);q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await pause(2);};
 const pop=state=>{const event=new window.Event('popstate');event.state=state;window.dispatchEvent(event);};
 return {window,q,click,calls,pop,pushes:()=>calls.filter(([kind])=>kind==='push').length};
}
test('initial load replaces the first history entry and never pushes',async()=>{
 const a=await setup();
 assert.equal(a.calls[0][0],'replace');
 assert.equal(a.pushes(),0);
});
test('opening a task pushes one entry and re-rendering does not duplicate it',async()=>{
 const a=await setup();
 await a.click('[data-action="open-shift"]');
 assert.equal(a.pushes(),1);
 assert.equal(a.calls.at(-1)[1].selected.id,'task-1');
 await a.click('[data-action="filter-all"]');
 assert.equal(a.pushes(),1);
});
test('document title names the open task and Home',async()=>{
 const a=await setup();
 await a.click('[data-action="open-shift"]');
 assert.equal(a.window.document.title,'Tarea 1 · Turno');
 await a.click('[data-action="home"]');
 assert.equal(a.window.document.title,'Inicio · Turno');
});
test('popstate to the Home state returns to Home without pushing another entry',async()=>{
 const a=await setup();
 await a.click('[data-action="open-shift"]');
 const before=a.pushes();
 a.pop({view:'home',selected:null,archiveId:null});await pause(2);
 assert.ok(a.q('main.home'));
 assert.equal(a.pushes(),before);
});
test('popstate to a task state restores that task without pushing during its render',async()=>{
 const a=await setup();
 await a.click('[data-action="open-shift"]');
 await a.click('[data-action="home"]');
 const before=a.pushes();
 a.pop({view:'workspace',selected:{kind:'task',id:'task-2'},archiveId:null});await pause(2);
 assert.equal(a.q('#title').value,'Revisar insumos');
 assert.equal(a.window.document.title,'Revisar insumos · Turno');
 assert.equal(a.pushes(),before);
});
const home={view:'home',selected:null,archiveId:null};
const fill=(a,s,value,extra={})=>{const el=a.q(s);el.value=value;const ev=new a.window.Event('input',{bubbles:true});Object.assign(ev,extra);el.dispatchEvent(ev);};
test('Back with the More options menu or a dialog open closes it and keeps the view and history aligned',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 await a.click('[data-action="more"]');assert.equal(a.q('#more-options').hasAttribute('hidden'),false);
 const before=a.pushes();a.pop(home);await pause(5);
 assert.equal(a.q('#more-options').hasAttribute('hidden'),true);
 assert.equal(a.q('#title').value,'Tarea 1');
 assert.equal(a.pushes(),before+1);assert.equal(a.window.history.state.selected.id,'task-1');
 await a.click('[data-action="rename-bed:bed-1"]');assert.ok(a.q('#modal').open);
 a.pop(home);await pause(5);
 assert.equal(a.q('#modal').open,false);assert.equal(a.q('#title').value,'Tarea 1');
 assert.equal(a.pushes(),before+2);assert.equal(a.window.history.state.selected.id,'task-1');
});
test('Back while a completion save is pending keeps the view and restores the history entry',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const check=a.q('[data-check="task-2"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await pause(5);
 const before=a.pushes();a.pop(home);await pause(5);
 assert.equal(a.q('.greeting'),null);assert.equal(a.q('#title').value,'Tarea 1');
 assert.equal(a.pushes(),before+1);assert.equal(a.window.history.state.selected.id,'task-1');
 await pause(500);assert.equal(a.q('[data-check="task-2"]').checked,true);
});
test('Back with unsaved changes: Volver keeps one entry, Descartar goes back once and applies the target',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 fill(a,'#body','Sin guardar');
 const start=a.pushes();
 a.pop(home);await pause(5);
 assert.ok(a.q('#modal').open);assert.equal(a.pushes(),start+1);
 await a.click('#modal [data-action="dismiss"]');
 assert.equal(a.q('#body').value,'Sin guardar');assert.equal(a.pushes(),start+1);
 assert.equal(a.window.history.state.selected.id,'task-1');
 a.pop(home);await pause(5);assert.equal(a.pushes(),start+2);
 const backs=a.calls.filter(([k])=>k==='back').length;
 await a.click('#modal [data-action="discard-navigation"]');
 assert.equal(a.calls.filter(([k])=>k==='back').length,backs+1);
 a.pop(home);await pause(5);
 assert.ok(a.q('.greeting'));assert.equal(a.pushes(),start+2);
});
test('IME composition: Enter while composing neither saves nor is cancelled, and line breaks are normalised at compositionend',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 fill(a,'#title','Tarea 1 editada');
 const enter=new a.window.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';enter.isComposing=true;enter.keyCode=229;
 a.q('#title').dispatchEvent(enter);await pause(400);
 assert.equal(enter.defaultPrevented,false);
 assert.doesNotMatch(a.q('#save-feedback').textContent,/Guardado en esta demostración/);
 fill(a,'#title','かな\n',{isComposing:true});
 assert.equal(a.q('#title').value,'かな\n');
 a.q('#title').dispatchEvent(new a.window.Event('compositionend',{bubbles:true}));
 assert.equal(a.q('#title').value,'かな ');
});
