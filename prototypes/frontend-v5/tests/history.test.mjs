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
 assert.equal(a.window.document.title,'Task 1 · Turno');
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
