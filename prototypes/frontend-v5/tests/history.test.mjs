import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
let run=0;
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function setup(){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=1440;
 const calls=[];
 const entries=[];let index=-1;
 const fire=()=>setTimeout(()=>{const event=new window.Event('popstate');event.state=entries[index]??null;window.dispatchEvent(event);},0);
 const move=n=>{const target=index+n;if(target<0||target>=entries.length)return;index=target;fire();};
 window.history={get state(){return entries[index]??null;},get length(){return entries.length;},
  pushState(state){calls.push(['push',state]);entries.splice(index+1);entries.push(state);index++;},
  replaceState(state){calls.push(['replace',state]);if(index<0){entries.push(state);index=0;}else entries[index]=state;},
  back(){calls.push(['back']);move(-1);},go(n){calls.push(['go',n]);move(n);}};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?history=${++run}`);await pause(250);
 const q=s=>window.document.querySelector(s);
 const click=async s=>{assert.ok(q(s),s);q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await pause(2);};
 const pop=state=>{const event=new window.Event('popstate');event.state=state;window.dispatchEvent(event);};
 // User-level Back/Forward: move the stack like the browser does, without recording an app call.
 return {window,q,click,calls,pop,pushes:()=>calls.filter(([kind])=>kind==='push').length,userBack:async()=>{move(-1);await pause(20);},userForward:async()=>{move(1);await pause(20);},nav:{get index(){return index;},get length(){return entries.length;},entries}};
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
const fill=(a,s,value,extra={})=>{const el=a.q(s);el.value=value;const ev=new a.window.Event('input',{bubbles:true});Object.assign(ev,extra);el.dispatchEvent(ev);};
async function threeEntries(){
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="task:task-2"]');
 assert.equal(a.nav.length,3);await a.userBack();
 assert.equal(a.q('#title').value,'Tarea 1');assert.equal(a.nav.index,1);
 return a;
}
test('Back with the More options menu or a dialog open closes it and keeps every Forward entry',async()=>{
 const a=await threeEntries();const pushes=a.pushes();
 await a.click('[data-action="more"]');assert.equal(a.q('#more-options').hasAttribute('hidden'),false);
 await a.userBack();
 assert.equal(a.q('#more-options').hasAttribute('hidden'),true);assert.equal(a.q('#title').value,'Tarea 1');
 assert.equal(a.nav.index,1);assert.equal(a.nav.length,3);assert.equal(a.pushes(),pushes);
 await a.click('[data-action="rename-bed:bed-1"]');assert.ok(a.q('#modal').open);
 await a.userBack();
 assert.equal(a.q('#modal').open,false);assert.equal(a.nav.index,1);assert.equal(a.nav.length,3);
 await a.userForward();
 assert.equal(a.q('#title').value,'Revisar insumos');assert.equal(a.pushes(),pushes);
});
test('Back while a completion save is pending keeps the view and the Forward entries',async()=>{
 const a=await threeEntries();const pushes=a.pushes();
 const check=a.q('[data-check="task-2"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await pause(5);
 await a.userBack();
 assert.equal(a.q('.greeting'),null);assert.equal(a.q('#title').value,'Tarea 1');
 assert.equal(a.nav.index,1);assert.equal(a.nav.length,3);assert.equal(a.pushes(),pushes);
 await pause(500);assert.equal(a.q('[data-check="task-2"]').checked,true);
 await a.userForward();assert.equal(a.q('#title').value,'Revisar insumos');
});
test('unsaved changes: Volver stays put, Descartar repeats the original Back once, no entries are added or lost',async()=>{
 const a=await threeEntries();const pushes=a.pushes();
 fill(a,'#body','Sin guardar');
 await a.userBack();
 assert.ok(a.q('#modal').open);assert.equal(a.nav.index,1);
 await a.click('#modal [data-action="dismiss"]');
 assert.equal(a.q('#body').value,'Sin guardar');assert.equal(a.nav.index,1);
 await a.userBack();assert.ok(a.q('#modal').open);
 await a.click('#modal [data-action="discard-navigation"]');await pause(20);
 assert.ok(a.q('.greeting'));assert.equal(a.nav.index,0);assert.equal(a.nav.length,3);assert.equal(a.pushes(),pushes);
});
test('unsaved changes on Forward: Descartar repeats the Forward move, not a Back',async()=>{
 const a=await threeEntries();
 fill(a,'#body','Sin guardar');
 await a.userForward();
 assert.ok(a.q('#modal').open);assert.equal(a.nav.index,1);assert.equal(a.q('#title').value,'Tarea 1');
 await a.click('#modal [data-action="discard-navigation"]');await pause(20);
 assert.equal(a.nav.index,2);assert.equal(a.q('#title').value,'Revisar insumos');
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
