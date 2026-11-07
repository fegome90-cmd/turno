// Node/LinkeDOM and declared CSS only, not browser rendering or native fullscreen.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {parse} from 'cssomnom';
const wait=ms=>new Promise(r=>setTimeout(r,ms));let run=0;
async function setup(width=900){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=width;window.matchMedia=()=>({matches:false,addEventListener(){}});
 let focused=window.document.body;
 Object.defineProperty(window.document,'activeElement',{configurable:true,get:()=>focused});
 window.HTMLElement.prototype.focus=function(){if(!this.disabled)focused=this;};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{configurable:true,get(){return this.hasAttribute('selected');},set(v){if(v)for(const o of this.parentElement?.querySelectorAll('option')||[])if(o!==this)o.removeAttribute('selected');this.toggleAttribute('selected',Boolean(v));}});
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?viewport=${++run}`);await wait(250);
 const q=s=>window.document.querySelector(s),event=(node,type)=>node.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}));
 const click=async s=>{assert.ok(q(s),s);q(s).focus();event(q(s),'click');await wait(2);};
 const fill=(s,v)=>{q(s).value=v;event(q(s),'input');};
 const resize=(w,t='resize')=>{window.innerWidth=w;event(t==='resize'?window:window.document,t);};
 return {window,q,event,click,fill,resize};
}
test('fluid shell, centered editor and archive share bounded declared sizing',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8'),sheet=parse(css);
 const rule=s=>[...sheet.cssRules].find(r=>r.selectorText===s)?.style;
 assert.equal(rule('.shell').width,'100%');assert.equal(rule('.editor form').width,'100%');
 assert.equal(rule('.editor form')['max-width'],'76ch');assert.equal(rule('.editor form')['margin-inline'],'auto');
 assert.equal(rule('.editor:has(.archive-notice)')['grid-template-columns'],'minmax(0,76ch)');
 assert.equal(rule('.editor:has(.archive-notice)')['justify-content'],'center');assert.equal(rule('.archive-notice').width,'100%');
 assert.match(css,/@media\(max-width:999px\)/);assert.match(css,/@media\(max-width:699px\)/);
});
test('Time fullscreen docking preserves raw errors, focus, scroll and body through cycles',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');a.fill('#body','Borrador');
 await a.click('[data-action="toggle-inspector"]');a.fill('#date','31/02/2026');a.event(a.q('#editor-form'),'submit');await wait(5);
 const body=a.q('#body'),main=a.q('#main');a.q('#date').focus();a.q('#modal').scrollTop=73;a.resize(1600,'fullscreenchange');
 assert.equal(a.q('#modal').open,false);assert.ok(a.q('.inspector #date'));assert.equal(a.q('#date').value,'31/02/2026');
 assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');assert.equal(a.window.document.activeElement,a.q('#date'));
 assert.equal(a.q('.inspector').scrollTop,73);assert.equal(a.q('#notification').hasAttribute('data-suspended'),false);
 for(const w of [1440,1024,1000,999,768,700,699,390,320,1920,900,1600])a.resize(w);
 assert.equal(a.q('#body'),body);assert.equal(a.q('#main'),main);assert.equal(body.value,'Borrador');assert.equal(a.q('#date').value,'31/02/2026');
 assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');assert.equal(a.window.document.querySelectorAll('#date').length,1);
});
test('navigation restores content, scroll and focus at 699 to 700',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');a.fill('#body','Mantener');await a.click('[data-action="navigation"]');
 a.q('#modal .nav-scroll').scrollTop=87;a.q('#modal [data-action="bed:bed-1"]').focus();a.resize(699);assert.equal(a.q('#modal').open,true);
 a.resize(700);assert.equal(a.q('#modal').open,false);assert.ok(a.q('.navigation [data-action="task:task-1"]'));
 assert.equal(a.q('.navigation .nav-scroll').scrollTop,87);assert.equal(a.window.document.activeElement,a.q('.navigation [data-action="bed:bed-1"]'));
 assert.equal(a.q('#body').value,'Mantener');assert.equal(a.q('#notification').hasAttribute('data-suspended'),false);
});
test('Agenda docks at 1000 but remains in drawer at 999',async()=>{
 const a=await setup(768);await a.click('[data-action="open-shift"]');await a.click('[data-action="toggle-inspector"]');await a.click('#tab-agenda');
 a.resize(999);assert.equal(a.q('#modal').open,true);a.resize(1000);assert.equal(a.q('#modal').open,false);
 assert.equal(a.q('.inspector #tab-agenda').getAttribute('aria-selected'),'true');assert.equal(a.window.document.activeElement,a.q('#tab-agenda'));assert.ok(a.q('.inspector .agenda'));
});
test('narrowing moves focus from hidden inline columns to their visible buttons',async()=>{
 const a=await setup(1440);await a.click('[data-action="open-shift"]');a.q('#date').focus();a.resize(999);assert.equal(a.window.document.activeElement,a.q('[data-action="toggle-inspector"]'));
 a.q('.navigation [data-action="home"]').focus();a.resize(699);assert.equal(a.window.document.activeElement,a.q('[data-action="navigation"]'));
});
test('confirmation and unsaved draft survive resize and fullscreen events',async()=>{
 const a=await setup(1440);await a.click('[data-action="open-shift"]');a.fill('#body','Pendiente');await a.click('[data-action="home"]');
 const modal=a.q('#modal'),content=modal.innerHTML;for(const w of [390,1920,768,1440])a.resize(w,'fullscreenchange');
 assert.equal(modal.open,true);assert.equal(modal.innerHTML,content);assert.equal(a.q('#body').value,'Pendiente');assert.equal(a.q('#notification').hasAttribute('data-suspended'),true);
 await a.click('[data-action="dismiss"]');assert.equal(a.q('#body').value,'Pendiente');
});
test('Home keeps Time overlay and greeting identity on wide screens',async()=>{
 const a=await setup(390),main=a.q('#main'),greeting=a.q('.greeting h1').textContent;await a.click('[data-action="toggle-inspector"]');a.resize(1920,'fullscreenchange');
 assert.equal(a.q('#modal').open,true);assert.equal(a.q('.inspector').hidden,true);assert.equal(a.q('#main'),main);await a.click('[data-action="close-inspector"]');assert.equal(a.q('.greeting h1').textContent,greeting);
});
test('explicit hidden inspector keeps preference and its open mobile drawer',async()=>{
 const a=await setup(1440);await a.click('[data-action="open-shift"]');await a.click('.inspector [data-action="close-inspector"]');a.resize(900);
 await a.click('[data-action="toggle-inspector"]');a.resize(1600);assert.equal(a.q('#modal').open,true);assert.equal(a.q('.inspector').hidden,true);assert.ok(a.q('#modal #date'));
 await a.click('[data-action="close-inspector"]');assert.equal(a.q('.shell').classList.contains('with-inspector'),false);
});
test('docking preserves theme, filters, selected task and expanded property',async()=>{
 const a=await setup(390);await a.click('[data-action="open-shift"]');await a.click('[data-action="navigation"]');await a.click('#modal [data-action="more"]');
 const select=a.q('#theme-preference');for(const o of select.options)o.selected=o.value==='dark';a.event(select,'change');await a.click('#modal [data-action="filter-pending"]');a.resize(1440);
 assert.equal(a.window.document.documentElement.dataset.theme,'dark');assert.equal(a.q('[data-action="filter-pending"]').getAttribute('aria-pressed'),'true');
 a.resize(900);await a.click('[data-action="toggle-inspector"]');await a.click('[data-focus="property-duration"]');a.q('#duration').focus();a.resize(1440);
 assert.equal(a.q('#duration').closest('.property').hasAttribute('open'),true);assert.equal(a.q('#title').value,'Tarea 1');assert.equal(a.window.document.activeElement,a.q('#duration'));
});
test('same-band pixel and fullscreen events do not remount controls',async()=>{
 const a=await setup(1440);await a.click('[data-action="open-shift"]');const date=a.q('#date'),body=a.q('#body');a.q('.inspector').scrollTop=51;
 for(const w of [1920,1920,1600,1440,1024,1000]){a.resize(w);a.resize(w,'fullscreenchange');}
 assert.equal(a.q('#date'),date);assert.equal(a.q('#body'),body);assert.equal(a.q('.inspector').scrollTop,51);assert.equal(a.window.document.querySelectorAll('#date').length,1);
});
test('temporal-only dirty transition preserves body, form, scroll and current save state',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="toggle-inspector"]');await a.click('[data-focus="property-date"]');
 const body=a.q('#body'),form=a.q('#editor-form');body.scrollTop=47;a.fill('#date','31/02/2026');a.resize(1000);
 assert.equal(a.q('#body'),body);assert.equal(a.q('#editor-form'),form);assert.equal(body.scrollTop,47);assert.equal(a.q('#date').value,'31/02/2026');
 assert.equal(a.q('[type="submit"]').disabled,false);assert.match(a.q('#save-feedback').textContent,/Cambios sin guardar/);
});
