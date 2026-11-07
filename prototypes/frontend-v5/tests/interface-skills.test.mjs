import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
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
 await import(`../src/app.mjs?skills=${++run}`);await pause(250);
 const q=s=>window.document.querySelector(s);
 const click=async s=>{assert.ok(q(s),s);q(s).focus();q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await pause(2);};
 const fill=(s,value)=>{q(s).value=value;q(s).dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=async(id='editor-form')=>{q('#'+id).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pause(500);};
 return {q,click,fill,submit,window,pause};
}
test('closed temporal validation identifies and opens the first invalid field',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 a.fill('#performed','29:99');a.fill('#estimate','-3');await a.submit();
 assert.equal(a.q('#estimate').getAttribute('aria-invalid'),'true');
 assert.match(a.q('#estimate').getAttribute('aria-describedby'),/field-error-estimate/);
 assert.ok(a.q('#estimate').closest('details').hasAttribute('open'));
 assert.equal(a.window.document.activeElement,a.q('#estimate'));
 assert.match(a.q('#field-error-performed').textContent,/Hora realizada/);
 assert.equal(a.q('#live-error').textContent,'');
 a.fill('#estimate','3');a.fill('#performed','20:00');await a.submit();
 assert.equal(a.q('#estimate').hasAttribute('aria-invalid'),false);
 assert.match(a.q('#save-feedback').textContent,/Guardado/);
});
test('mobile validation brings the invalid field into the visible Time drawer',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');
 await a.click('[data-action="toggle-inspector"]');a.fill('#date','31/02/2026');
 await a.click('[data-action="close-inspector"]');await a.submit();
 assert.ok(a.q('#modal').open);assert.ok(a.q('#modal #date'));
 assert.equal(a.window.document.activeElement,a.q('#modal #date'));
 assert.equal(a.q('#modal #date').getAttribute('aria-invalid'),'true');
 assert.equal(a.q('#modal #date').getAttribute('aria-describedby'),'field-error-date');
 assert.match(a.q('#modal #field-error-date').textContent,/fecha/);
 assert.equal(a.q('#date').value,'31/02/2026');
});
test('closing desktop Time returns focus to its visible trigger',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 await a.click('[data-action="close-inspector"]');
 assert.equal(a.window.document.activeElement,a.q('[data-action="toggle-inspector"]'));
 assert.ok(a.q('.inspector').hidden);
});
test('checkbox completion restores its focus identity on success and failure',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const fail of [false,true]){
  if(fail){await a.click('[data-action="demo"]');await a.click('[data-action="simulate-error"]');}
  const check=a.q('[data-check="task-1"]');check.focus();check.checked=!check.checked;
  check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await pause(500);
  assert.equal(a.window.document.activeElement,a.q('[data-check="task-1"]'));
 }
});
test('completing the last focused pending checkbox has a safe fallback',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="filter-pending"]');
 const check=a.q('[data-check="task-1"]');check.focus();check.checked=true;
 check.dispatchEvent(new a.window.Event('change',{bubbles:true}));await pause(500);
 assert.equal(a.q('[data-check="task-1"]'),null);
 assert.equal(a.window.document.activeElement,a.q('#main'));
});
test('close shift failure can be retried in the same dialog',async()=>{
 const a=await setup();await a.click('[data-action="demo"]');await a.click('[data-action="simulate-error"]');
 await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await pause(500);
 assert.ok(a.q('#modal').open);assert.equal(a.q('[data-action="confirm-close"]').disabled,false);
 await a.click('[data-action="confirm-close"]');await pause(500);assert.equal(a.q('#modal').open,false);
});
test('simulated conflict offers retry without reloading or dropping the draft',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Conservar');
 await a.click('[data-action="demo"]');await a.click('[data-action="simulate-conflict"]');await a.submit();
 assert.doesNotMatch(a.q('#save-error').textContent,/Recarga/);
 assert.match(a.q('#save-error').textContent,/Vuelve a guardar/);assert.equal(a.q('#body').value,'Conservar');
 await a.submit();assert.match(a.q('#save-feedback').textContent,/Guardado/);
});
test('filtered empty state escapes query and clears filters without dropping draft',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Borrador');
 a.fill('#search','<desconocido>');assert.match(a.q('#task-tree').textContent,/<desconocido>/);
 await a.click('[data-action="clear-filters"]');assert.equal(a.q('#search').value,'');
 assert.ok(a.q('[data-check="task-1"]'));assert.equal(a.q('#body').value,'Borrador');
});
test('note body uses its visible label as its accessible name',async()=>{
 const a=await setup();await a.click('[data-action="notes"]');
 assert.equal(a.q('label[for="body"]').textContent,'Escritura');
 assert.equal(a.q('#body').hasAttribute('aria-label'),false);
});
test('mobile input, wrapping and overlay CSS constraints are explicit',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/@media\(max-width:999px\)[\s\S]*font-size:var\(--type-body\)/);
 assert.match(css,/dialog,\.drawer,\.nav-scroll\{overscroll-behavior:contain/);
 assert.match(css,/\.task-select,\.agenda-task\{line-height:1\.4/);
});
test('renaming an empty group name identifies the field and permits correction',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="rename-bed:bed-1"]');
 a.fill('#bed-name','   ');await a.submit('rename-bed-form');
 assert.equal(a.q('#bed-name').getAttribute('aria-invalid'),'true');
 assert.equal(a.window.document.activeElement,a.q('#bed-name'));
 assert.match(a.q('#rename-bed-error').textContent,/Nombre del grupo/);
 a.fill('#bed-name','Nombre corregido');await a.submit('rename-bed-form');assert.equal(a.q('#modal').open,false);
});
test('creating an empty title identifies the field and permits correction',async()=>{
 const a=await setup();await a.click('[data-action="add-task"]');
 a.fill('#new-title','   ');await a.submit('create-form');
 assert.equal(a.q('#new-title').getAttribute('aria-invalid'),'true');
 assert.equal(a.q('#new-title').getAttribute('aria-describedby'),'create-error');
 assert.equal(a.window.document.activeElement,a.q('#new-title'));
 a.fill('#new-title','Título corregido');await a.submit('create-form');assert.equal(a.q('#title').value,'Título corregido');
});
test('invalid save-and-continue closes confirmation and returns to the invalid field',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');
 await a.click('[data-action="toggle-inspector"]');a.fill('#date','31/02/2026');await a.click('[data-action="close-inspector"]');
 await a.click('[data-action="task:task-2"]');await a.click('[data-action="save-navigation"]');await pause(50);
 assert.equal(a.q('#title').value,'Tarea 1');assert.ok(a.q('#modal').open);
 assert.equal(a.window.document.activeElement,a.q('#modal #date'));
 assert.equal(a.q('#modal #date').getAttribute('aria-invalid'),'true');
 assert.equal(a.q('#modal #date').getAttribute('aria-describedby'),'field-error-date');
 assert.match(a.q('#modal #field-error-date').textContent,/fecha/);
});
test('checkbox completion does not steal focus from a newer input',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const check=a.q('[data-check="task-1"]');check.focus();check.checked=true;
 check.dispatchEvent(new a.window.Event('change',{bubbles:true}));
 a.q('#search').focus();await pause(500);
 assert.equal(a.window.document.activeElement,a.q('#search'));
});
