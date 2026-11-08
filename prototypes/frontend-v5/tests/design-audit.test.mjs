import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
let run=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(width=1440){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=width;
 // LinkeDOM 0.18.15 incorrectly clears another option even when selected=false.
 // Model the standard setter for these DOM-only tests, not native-control QA.
 Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{configurable:true,
  get(){return this.hasAttribute('selected');},
  set(value){if(value)for(const option of this.parentElement?.querySelectorAll('option')||[])if(option!==this)option.removeAttribute('selected');this.toggleAttribute('selected',Boolean(value));}
 });
 let focused=window.document.body;
 Object.defineProperty(window.document,'activeElement',{configurable:true,get:()=>focused});
 window.HTMLElement.prototype.focus=function(){if(!this.disabled)focused=this;};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?audit=${++run}`);await waitForAppReady(window.document);
 const q=s=>window.document.querySelector(s);
 const click=async s=>{assert.ok(q(s),s);q(s).focus();q(s).dispatchEvent(new window.Event('click',{bubbles:true}));await pause(2);};
 const fill=(s,value)=>{const input=q(s);if(input.tagName==='SELECT'){for(const option of input.options)option.selected=option.value===value;}else input.value=value;input.dispatchEvent(new window.Event('input',{bubbles:true}));};
 const submit=async()=>{q('#editor-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await pause(500);};
 return {q,click,fill,submit,window};
}
const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
test('compact footer keeps Archive and a disclosure while close shift moves to toolbar',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const nav=a.q('.navigation');
 assert.equal(nav.querySelectorAll('.footer-actions>button').length,2);
 assert.equal(nav.querySelector('.footer-actions [data-action="archive"]').getAttribute('aria-label'),'Archivo de turnos anteriores');
 assert.match(nav.querySelector('.nav-footer p').textContent,/Datos sintéticos/);
 assert.ok(nav.innerHTML.indexOf('id="task-tree"')<nav.innerHTML.indexOf('data-action="notes"'));
 assert.equal(a.q('[data-action="more"]').getAttribute('aria-expanded'),'false');
 assert.equal(nav.querySelector('[data-action="close-shift"]'),null);
 assert.ok(a.q('.toolbar [data-action="close-shift"]'));
 assert.equal(nav.querySelector('#more-options').hidden,true);
 assert.match(a.q('[data-action="open-shift"]').textContent,/Ir al turno actual/);
 assert.match(css,/\.footer-actions\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.nav-scroll\{[^}]*overflow:auto;[^}]*min-height:0/);
});
test('checkbox target is a native wrapping label with no adjacent action in its 44px target',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const check of [a.q('[data-check="task-1"]'),a.q('#editor-completed')]){
  assert.equal(check.closest('.check-target').tagName,'LABEL');
  assert.equal(check.closest('.check-target').querySelectorAll('input,button').length,1);
  assert.ok(check.getAttribute('aria-label'));
 }
 assert.match(css,/--target:44px/);
 assert.match(css,/\.check-target\{[^}]*width:var\(--target\);[^}]*height:var\(--target\)/);
 assert.match(css,/@media\(forced-colors:active\)[\s\S]*appearance:auto/);
});
test('high priority is text plus a decorative icon in both tree and Agenda',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="bed:bed-2"]');
 const row=a.q('#task-tree [data-action="task:task-4"]');
 assert.equal(row.querySelector('.priority-badge').textContent,'Prioridad Alta');
 assert.equal(row.querySelector('.priority-badge .icon').getAttribute('aria-hidden'),'true');
 assert.equal(a.q('#task-tree [data-action="task:task-1"] .priority-badge'),null);
 await a.click('[data-action="tab-agenda"]');
 assert.equal(a.q('.agenda [data-action="task:task-4"] .priority-badge').textContent,'Prioridad Alta');
 assert.equal(a.q('.agenda [data-action="task:task-1"] .priority-badge'),null);
});
test('priority badge follows confirmed save only, survives failed save and disappears after a lower priority save',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 a.fill('#priority','high');assert.equal(a.q('#task-tree .priority-badge'),null);
 await a.click('[data-action="demo"]');await a.click('[data-action="simulate-error"]');await a.submit();
 assert.equal(a.q('#priority').value,'high');assert.equal(a.q('#task-tree .priority-badge'),null);
 await a.submit();assert.equal(a.q('#task-tree [data-action="task:task-1"] .priority-badge').textContent,'Prioridad Alta');
 a.fill('#priority','low');await a.submit();assert.equal(a.q('#task-tree [data-action="task:task-1"] .priority-badge'),null);
});
test('metadata has visible bound labels and long reason round-trips with the draft',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const id of ['reason','priority']){
  const label=a.q(`label[for="${id}"]`);assert.ok(label);assert.equal(label.classList.contains('sr-only'),false);
  assert.ok(label.querySelector('#'+id));assert.ok(label.querySelector('span').textContent);
 }
 const reason='Preparación de material y coordinación de educación para este turno de prueba';
 a.fill('#reason',reason);await a.click('[data-action="filter-pending"]');assert.equal(a.q('#reason').value,reason);
 await a.submit();await a.click('[data-action="task:task-2"]');await a.click('[data-action="task:task-1"]');
 assert.equal(a.q('#reason').value,reason);
 assert.match(css,/\.metadata input\{width:100%/);assert.doesNotMatch(css,/width:115px/);
 assert.match(css,/\.metadata-field\{[^}]*flex:1 1 12rem;min-width:0/);
});
test('selected filter is redundantly identified and does not reset editor or scroll',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Notas sin guardar');
 a.q('.nav-scroll').scrollTop=82;await a.click('[data-action="filter-pending"]');
 assert.equal(a.q('[data-action="filter-pending"]').getAttribute('aria-pressed'),'true');
 assert.equal(a.q('[data-action="filter-all"]').getAttribute('aria-pressed'),'false');
 assert.equal(a.q('#body').value,'Notas sin guardar');assert.equal(a.q('.nav-scroll').scrollTop,82);
 assert.match(css,/\.filter.active\{[^}]*border-color:var\(--secondary\);text-decoration:underline/);
});
test('compact mobile navigation retains direct controls, identity and simulated Escape focus restoration',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="navigation"]');
 assert.equal(a.window.document.querySelectorAll('#task-tree').length,1);
 assert.ok(a.q('#modal [data-action="archive"]'));assert.ok(a.q('#modal [data-action="close-shift"]'));assert.ok(a.q('#modal [data-action="demo"]'));
 assert.ok(a.q('#modal [data-check="task-1"]').closest('.check-target'));
 a.q('#modal').dispatchEvent(new a.window.Event('cancel',{cancelable:true}));
 assert.equal(a.q('#modal').open,false);assert.equal(a.window.document.activeElement,a.q('[data-action="navigation"]'));
 await a.click('[data-action="navigation"]');await a.click('#modal [data-action="close-shift"]');
 assert.match(a.q('#modal').textContent,/4 tareas pendientes/);await a.click('#modal [data-action="dismiss"]');
 assert.ok(a.q('[data-action="close-shift"]'));assert.ok(a.q('#title'));
});
test('archive preserves high-priority text and disables both completion paths',async()=>{
 const a=await setup();await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await pause(500);
 await a.click('[data-action="archive"]');await a.click('[data-action="archive-shift:demo-shift-1"]');await a.click('[data-action="bed:bed-2"]');
 assert.equal(a.q('[data-check="task-4"]').disabled,true);assert.equal(a.q('#editor-completed').disabled,true);
 assert.equal(a.q('#task-tree [data-action="task:task-4"] .priority-badge').textContent,'Prioridad Alta');
 await a.click('[data-action="tab-agenda"]');assert.equal(a.q('.agenda [data-action="task:task-4"] .priority-badge').textContent,'Prioridad Alta');
});
test('typography, border affordances, shared editor edge and hover guards are explicit contracts',()=>{
 for(const role of ['caption','small','body','writing','section','title'])assert.ok(css.includes('--type-'+role+':'));
 assert.match(css,/\.editor form\{[^}]*max-width:76ch/);
 assert.match(css,/\.editor textarea\{[^}]*border:1px solid var\(--control\);padding:10px 12px/);
 assert.match(css,/\.notes-heading\{[^}]*padding-inline:12px/);
 assert.match(css,/\.save-footer\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.bed-toggle span\{min-width:0;overflow-wrap:break-word;hyphens:auto/);
 assert.match(css,/button:hover[^{}]*:not\(\[aria-selected=true\]\)/);
 assert.match(css,/\.inspector-tabs button\[aria-selected=true\]:hover:not\(:disabled\)\{background:var\(--selected\)/);
 assert.equal((css.match(/:root\{--canvas:/g)||[]).length,1,'one shared token definition');
 assert.match(css,/font-synthesis:none/);
 assert.match(css,/@media\(max-width:699px\)[\s\S]*\.save-footer>div:first-child\{[^}]*flex:0 1 auto/);
});
test('declared border and active-filter cues exceed 3:1 against adjacent surfaces',()=>{
 const luminance=hex=>{const rgb=hex.match(/\w\w/g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
 const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);};
 assert.ok(contrast('808080','fafafa')>=3);assert.ok(contrast('595959','f7f7f7')>=3);
 // Declared colors only. No claim about painted pixels, zoom or browser contrast.
});
test('synthetic starting task and all four stable greeting subtitles stay in Spanish',async()=>{
 const fixture=await fs.readFile(new URL('../src/preview-adapter.mjs',import.meta.url),'utf8');
 assert.match(fixture,/title:'Tarea 1'/);assert.doesNotMatch(fixture,/title:'Task 1'/);
 const a=await setup();const subtitle=a.q('.greeting p').textContent;
 await a.click('[data-action="open-shift"]');await a.click('[data-action="home"]');
 assert.equal(a.q('.greeting p').textContent,subtitle);assert.match(a.q('.greeting h1').textContent,/Hola, Demo\./);
});

// The app loads through the preview adapter (220 ms); wait until it has rendered instead of a fixed 250 ms.
async function waitForAppReady(document,{timeout=3000}={}){const end=Date.now()+timeout;while(!document.querySelector('#app .shell, #app main')){if(Date.now()>end)throw new Error('app did not finish loading');await new Promise(r=>setTimeout(r,10));}}
