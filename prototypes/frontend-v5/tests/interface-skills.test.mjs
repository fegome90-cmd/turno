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
  if(fail){await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-error"]');}
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
 const a=await setup();await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-error"]');
 await a.click('[data-action="close-shift"]');await a.click('[data-action="confirm-close"]');await pause(500);
 assert.ok(a.q('#modal').open);assert.equal(a.q('[data-action="confirm-close"]').disabled,false);
 await a.click('[data-action="confirm-close"]');await pause(500);assert.equal(a.q('#modal').open,false);
});
test('simulated conflict offers retry without reloading or dropping the draft',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Conservar');
 await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-conflict"]');await a.submit();
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
 assert.equal(a.q('label[for="body"]').textContent,'Texto de la nota');
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
 assert.match(a.q('#rename-bed-error').textContent,/Nombre de la cama/);
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

test('icons are CSS masks painted with currentColor so forced-colors mode keeps them visible',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const icon=a.q('.nav-item .icon');
 assert.equal(icon.localName,'i');assert.equal(icon.getAttribute('aria-hidden'),'true');
 assert.match(icon.getAttribute('style'),/-webkit-mask-image:url\('\.\/assets\/icons\/[a-z-]+\.svg'\);mask-image:url\(/);
 assert.equal(a.q('img.icon'),null);
 assert.match(a.q('details.property summary .disclosure-chevron').className,/^icon disclosure-chevron$/);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.icon\{[^}]*display:inline-block[^}]*background-color:currentColor[^}]*mask:center\/contain no-repeat/);
 assert.match(css,/@media \(forced-colors:active\)\{\.icon\{forced-color-adjust:none;background-color:CanvasText\}button \.icon,summary \.icon\{background-color:ButtonText\}button:disabled \.icon\{background-color:GrayText\}\}/);
 assert.doesNotMatch(css,/\.icon[^{}]*\{[^}]*filter:/);
});
test('toolbar keeps its trailing actions from being pushed out by a long bed name',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.toolbar>div\{display:flex;align-items:center;gap:8px;min-width:0\}/);
 assert.match(css,/\.toolbar>div:first-child\{flex:1 1 auto;min-width:0\}\.toolbar>div:last-child\{flex-shrink:0\}/);
});
test('demo controls live in the More options menu, hidden until it is opened',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const menu=a.q('#more-options');assert.ok(menu.hasAttribute('hidden'));
 assert.ok(menu.querySelector('[data-action="demo"]'));
 assert.match(menu.textContent,/Datos sintéticos · Se reinician al recargar/);
 assert.ok(a.q('.nav-footer [data-action="archive"]'));
 await a.click('[data-action="more"]');
 assert.equal(a.q('#more-options').hasAttribute('hidden'),false);
 assert.equal(a.q('[data-action="more"]').getAttribute('aria-expanded'),'true');
});
test('sidebar task tree shows a scroll cue only while more content is below',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const nav=a.q('.nav-scroll');let top=0;
 Object.defineProperties(nav,{scrollTop:{get:()=>top,set:value=>{top=value;},configurable:true},scrollHeight:{value:500,configurable:true},clientHeight:{value:200,configurable:true}});
 // LinkeDOM delivers only bubbling events to document capture listeners; browsers deliver scroll either way.
 nav.dispatchEvent(new a.window.Event('scroll',{bubbles:true}));
 assert.equal(nav.classList.contains('has-more'),true);
 top=300;nav.dispatchEvent(new a.window.Event('scroll',{bubbles:true}));
 assert.equal(nav.classList.contains('has-more'),false);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.nav-scroll\.has-more\{-webkit-mask-image:linear-gradient\(to bottom,var\(--ink\) calc\(100% - 40px\),transparent\);mask-image:linear-gradient\(to bottom,var\(--ink\) calc\(100% - 40px\),transparent\)\}/);
});
test('mobile-native rules stop tap flash, text inflation and iOS press callouts',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/html\{-webkit-tap-highlight-color:transparent;-webkit-text-size-adjust:100%;text-size-adjust:100%\}/);
 assert.match(css,/button,summary\{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none\}/);
});
test('CSS motion stays under 300ms and never transitions all properties',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/transition:all/);
 for(const [,ms] of css.matchAll(/(\d+)ms/g))assert.ok(Number(ms)<=300,ms+'ms');
});
test('reduced motion keeps colour transitions and only removes smooth scrolling',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const reduce=css.match(/@media ?\(prefers-reduced-motion:reduce\)\{[^{}]*(\{[^}]*\}[^{}]*)*\}/)[0];assert.match(reduce,/\*\{scroll-behavior:auto!important\}/);assert.doesNotMatch(reduce,/transition/);
 assert.doesNotMatch(css,/prefers-reduced-motion:reduce\)\{\*\{transition:none/);
});

test('Motivo and Prioridad are named by visible wrapping labels with no fixed widths',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 assert.match(a.q('#reason').closest('label').textContent,/Motivo/);
 assert.match(a.q('#priority').closest('label').textContent,/Prioridad/);
 assert.equal(a.q('#reason').hasAttribute('aria-label'),false);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/width:115px/);
 assert.equal(a.q('#reason').getAttribute('placeholder'),'Ej.: Exámenes');
 assert.doesNotMatch(css,/\.metadata (input|select)\{[^}]*(?<!-)width:\d+px/);
});
test('title is a wrapping textarea: Enter adds no line and pasted newlines become spaces',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const title=a.q('#title');assert.equal(title.localName,'textarea');assert.equal(title.value,'Tarea 1');
 const enter=new a.window.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';title.dispatchEvent(enter);
 assert.equal(enter.defaultPrevented,true);
 a.fill('#title','Uno\nDos');assert.equal(a.q('#title').value,'Uno Dos');
 a.fill('#title','Revisión');await a.submit();assert.equal(a.q('#title').value,'Revisión');
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const rule=css.match(/\.title-line #title\{[^}]*resize:none[^}]*\}/)[0];for(const d of ['field-sizing:content','overflow-wrap:break-word','hyphens:manual','line-height:1.2'])assert.ok(rule.includes(d),d);
});
test('renamed copy: beds are cama, task notes and quick-note bodies have specific labels, shift entry names the current shift',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 assert.equal(a.q('label[for="body"]').textContent,'Notas de la tarea');
 assert.equal(a.q('[data-action="open-shift"]').textContent,'Ir al turno actual');
 await a.click('[data-action="rename-bed:bed-1"]');
 assert.equal(a.q('#modal h2').textContent,'Editar nombre de cama');
 assert.equal(a.q('label[for="bed-name"]').textContent,'Nombre de la cama');
 assert.match(a.q('#bed-name-hint').textContent,/esta cama/);
});
test('high priority is named in the task row and agenda while normal priority is not',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="bed:bed-2"]');
 assert.match(a.q('[data-action="task:task-4"]').textContent,/Alta/);
 assert.equal(a.q('[data-action="task:task-1"]').textContent.includes('Alta'),false);
 await a.click('[data-action="tab-agenda"]');
 assert.match(a.q('.agenda-task[data-action="task:task-4"]').textContent,/Alta/);
 assert.equal(a.q('.agenda-task[data-action="task:task-1"]').textContent.includes('Alta'),false);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.ok(a.q('.agenda-task[data-action="task:task-4"] .priority-badge .icon[aria-hidden="true"]'));
});
test('every completion checkbox sits in a 44px label hit area and one change completes the task once',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 for(const check of a.window.document.querySelectorAll('[data-check]'))assert.equal(check.parentElement.matches('label.check-target'),true);
 const check=a.q('[data-check="task-1"]');check.checked=true;check.dispatchEvent(new a.window.Event('change',{bubbles:true}));
 await new Promise(r=>setTimeout(r,500));
 assert.equal(a.q('[data-check="task-1"]').checked,true);
 assert.match(a.q('#property-content-activity').textContent,/Versión local 2/);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.check-target\{[^}]*width:var\(--target\)[^}]*height:var\(--target\)/);assert.match(css,/--target:44px/);
});
test('disclosure summaries rely on the native open state without duplicate ARIA',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const summary=a.q('[data-focus="property-date"]');
 assert.equal(summary.hasAttribute('aria-expanded'),false);assert.equal(summary.hasAttribute('aria-controls'),false);
 const content=a.q('#property-content-date');
 assert.equal(content.hasAttribute('aria-hidden'),false);assert.equal(content.hasAttribute('inert'),true);
});
test('long words wrap with break-word, never anywhere',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/overflow-wrap:anywhere/);
});

test('Enter in the title saves a dirty draft through the form submit path and inserts no line',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 assert.equal(a.q('#reason').getAttribute('placeholder'),'Ej.: Exámenes');
 a.fill('#title','Título con Enter');
 const enter=new a.window.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';a.q('#title').dispatchEvent(enter);
 assert.equal(enter.defaultPrevented,true);
 await new Promise(r=>setTimeout(r,500));
 assert.match(a.q('#save-feedback').textContent,/Guardado/);
 assert.equal(a.q('#title').value,'Título con Enter');
});
test('Enter in a clean title does not submit anything',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');
 const enter=new a.window.Event('keydown',{bubbles:true,cancelable:true});enter.key='Enter';a.q('#title').dispatchEvent(enter);
 await new Promise(r=>setTimeout(r,500));
 assert.doesNotMatch(a.q('#save-feedback').textContent,/Guardado en esta demostración/);
});

test('every rendered icon resolves against index.html to a file on disk, and the stylesheet never references icon URLs',async()=>{
 const {existsSync}=await import('node:fs');const {fileURLToPath}=await import('node:url');
 const indexUrl=new URL('../index.html',import.meta.url);
 const names=new Set();
 const collect=a=>{for(const el of a.window.document.querySelectorAll('i.icon')){const m=(el.getAttribute('style')||'').match(/mask-image:url\('([^']+)'\)/);assert.ok(m,el.outerHTML);names.add(m[1]);}};
 const a=await setup();collect(a);
 await a.click('[data-action="open-shift"]');collect(a);
 await a.click('[data-action="tab-agenda"]');collect(a);
 await a.click('[data-action="tab-task"]');collect(a);
 await a.click('[data-action="notes"]');collect(a);
 await a.click('[data-action="archive"]');collect(a);
 await a.click('[data-action="more"]');collect(a);
 const m=setup(390).then(async b=>{await b.click('[data-action="open-shift"]');await b.click('[data-action="navigation"]');collect(b);});
 await m;
 assert.ok(names.size>=8,[...names].join(' '));
 for(const src of names)assert.equal(existsSync(fileURLToPath(new URL(src,indexUrl))),true,src);
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.doesNotMatch(css,/assets\/icons/);
 assert.doesNotMatch(css,/--icon/);
});
