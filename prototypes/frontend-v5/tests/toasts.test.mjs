import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs/promises';
import {createToasts} from '../src/toasts.mjs';
import {MOTION} from '../src/motion.mjs';
const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function setup({pointer=false, reduce=false, raf=true}={}) {
 const {window}=parseHTML(html),doc=window.document;
 let focused=doc.body, restored=0, modality=pointer?'pointer':'keyboard', changed;
 Object.defineProperty(doc,'activeElement',{get:()=>focused});
 window.HTMLElement.prototype.focus=function(){focused=this;};
 const frames=new Map();let frameId=0;
 window.requestAnimationFrame=raf?callback=>{frames.set(++frameId,callback);return frameId;}:undefined;
 window.cancelAnimationFrame=id=>frames.delete(id);
 const media={matches:reduce,addEventListener(type,callback){changed=callback;}};
 const root=doc.querySelector('#notification'),list=root.querySelector('.toast-list');
 const controller=createToasts({root,matchMedia:()=>media,getModality:()=>modality,restoreFocus(){restored++;doc.body.focus();}});
 const key=(value,attrs={})=>{modality='keyboard';doc.documentElement.dataset.inputModality='keyboard';const event=new window.Event('keydown',{bubbles:true,cancelable:true});event.key=value;Object.assign(event,attrs);(doc.activeElement||doc.body).dispatchEvent(event);return event;};
 const click=el=>el.dispatchEvent(new window.Event('click',{bubbles:true}));
 const q=s=>doc.querySelector(s),all=s=>[...doc.querySelectorAll(s)];
 return {window,doc,root,list,q,all,controller,key,click,frames,get restored(){return restored;},reduce(){media.matches=true;changed();},flush(){for(const [id,cb] of [...frames]){frames.delete(id);cb();}}};
}

test('expanded stack retains distinct messages and labels severity without a live list',()=>{
 const a=setup();a.controller.notify('Uno');a.controller.notify('Dos','error');
 assert.deepEqual(a.all('.toast-message').map(n=>n.textContent),['Uno','Dos']);
 assert.equal(a.q('.toast-region').hidden,false);assert.equal(a.q('.toast-count').textContent,'2');
 assert.equal(a.q('#live-error').textContent,'Dos');assert.equal(a.q('#live').textContent,'');
 assert.equal(a.q('.toast-list').getAttribute('aria-live'),null);
 assert.equal(a.q('.toast-card[data-kind=error] .toast-label').textContent,'No se pudo completar');
});
test('duplicates reuse the same DOM node and make a repeated announcement distinct',()=>{
 const a=setup();const id=a.controller.notify('Guardado');const item=a.q('.toast-item');
 assert.equal(a.controller.notify('Guardado'),id);assert.equal(a.all('.toast-item').length,1);
 assert.equal(a.q('.toast-item'),item);assert.match(a.q('.toast-repeat').textContent,/2/);
 assert.equal(a.q('#live').textContent,'Guardado Repetido 2 veces.');
});
test('untrusted message text is not HTML',()=>{
 const a=setup();a.controller.notify('<img src=x onerror=alert(1)>');
 assert.equal(a.q('.toast-message').children.length,0);assert.match(a.q('.toast-message').textContent,/<img/);
});
test('notify never steals focus and messages persist beyond the animation window',async()=>{
 const a=setup({pointer:true});a.doc.body.focus();a.controller.notify('Persistente','error');
 await sleep(MOTION.toast+30);assert.equal(a.all('.toast-item').length,1);assert.equal(a.doc.activeElement,a.doc.body);
});
test('close of a focused middle toast moves to the following close button',()=>{
 const a=setup();for(const s of ['Uno','Dos','Tres'])a.controller.notify(s);
 const [first,middle,last]=a.all('.toast-close');middle.focus();a.click(middle);
 assert.equal(a.doc.activeElement,last);assert.equal(a.all('.toast-item').length,2);
 a.click(last);assert.equal(a.doc.activeElement,first);a.click(first);assert.equal(a.restored,1);
});
test('closing a toast without focus does not move unrelated focus',()=>{
 const a=setup();a.controller.notify('Uno');a.doc.body.focus();a.click(a.q('.toast-close'));assert.equal(a.restored,0);
});
test('pointer dismissal becomes inert immediately and removes after the 300ms exit',async()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');const item=a.q('.toast-item');a.click(a.q('.toast-close'));
 assert.equal(item.getAttribute('aria-hidden'),'true');assert.equal(item.hasAttribute('inert'),true);
 assert.equal(item.isConnected,true);await sleep(MOTION.toast+30);assert.equal(item.isConnected,false);
});
test('repeat during exit reverses on the same card and cancels stale removal',async()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');const item=a.q('.toast-item');a.click(a.q('.toast-close'));
 a.controller.notify('Uno');assert.equal(a.q('.toast-item'),item);assert.equal(item.hasAttribute('inert'),false);
 assert.equal(a.q('.toast-card').hasAttribute('data-closing'),false);
 await sleep(MOTION.toast+30);assert.equal(item.isConnected,true);assert.equal(a.q('.toast-count').textContent,'1');
});
test('keyboard and initial reduced motion dismiss synchronously',()=>{
 for(const config of [{},{pointer:true,reduce:true},{pointer:true,raf:false}]){
  const a=setup(config);a.controller.notify('Uno');a.click(a.q('.toast-close'));assert.equal(a.all('.toast-item').length,0);
 }
});
test('keyboard interruption removes pending exits and cancels pending FLIP frames',()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');a.q('.toast-item').getBoundingClientRect=()=>({top:30});
 a.controller.notify('Dos');a.click(a.q('.toast-close'));a.key('Tab');
 assert.equal(a.all('[data-closing]').length,0);assert.equal(a.all('.toast-item').length,1);assert.equal(a.frames.size,0);
 assert.equal(a.q('.toast-item').style.transform,'none');
});
test('enabling reduced motion settles every pending exit immediately',()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');a.click(a.q('.toast-close'));a.reduce();
 assert.equal(a.all('.toast-item').length,0);assert.equal(a.q('.toast-region').hidden,true);
});
test('FLIP captures painted position before layout mutation and cancels old frames',()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');const item=a.q('.toast-item');let calls=0;
 item.getBoundingClientRect=()=>({top:++calls===1?50:20});
 a.controller.notify('Dos');assert.equal(item.style.transform,'translateY(30px)');assert.equal(a.frames.size,1);
 a.controller.notify('Tres');assert.equal(a.frames.size,0);assert.equal(item.style.transform,'none');
 a.flush();assert.equal(item.style.transform,'none');
});
test('shortcut focuses latest without automatic focus, Escape closes only within stack',()=>{
 const a=setup();a.controller.notify('Uno');a.controller.notify('Dos');
 a.key('Escape');assert.equal(a.all('.toast-item').length,2);
 const event=a.key('t',{altKey:true});assert.equal(event.defaultPrevented,true);assert.equal(a.doc.activeElement,a.all('.toast-close').at(-1));
 a.key('Escape');assert.equal(a.all('.toast-item').length,1);
});
test('modal suspension hides controls and defers a new announcement until it closes',()=>{
 const a=setup();a.controller.notify('Previo');a.controller.setSuspended(true);a.controller.notify('Mientras modal','error');
 assert.equal(a.q('.toast-region').hasAttribute('inert'),true);assert.equal(a.q('.toast-region').getAttribute('aria-hidden'),'true');assert.equal(a.root.hasAttribute('data-suspended'),true);assert.equal(a.q('#live-error').textContent,'');
 a.key('t',{altKey:true});assert.equal(a.doc.activeElement,a.doc.body);
 a.controller.setSuspended(false);assert.equal(a.q('.toast-region').hidden,false);assert.equal(a.q('.toast-region').hasAttribute('inert'),false);assert.equal(a.root.hasAttribute('data-suspended'),false);assert.equal(a.q('#live-error').textContent,'Mientras modal');
});
test('clear and modal interruptions cannot revive a removed toast',async()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');a.click(a.q('.toast-close'));a.controller.setSuspended(true);a.controller.clear();a.controller.setSuspended(false);
 await sleep(MOTION.toast+30);assert.equal(a.all('.toast-item').length,0);assert.equal(a.q('#live').textContent,'');
});
test('new arrivals preserve scroll while reading, but follow latest when already at bottom',()=>{
 const a=setup();a.controller.notify('Uno');
 Object.defineProperties(a.list,{scrollHeight:{configurable:true,value:1000},clientHeight:{value:200}});
 a.list.scrollTop=100;a.controller.notify('Dos');assert.equal(a.list.scrollTop,100);
 a.list.scrollTop=800;a.controller.notify('Tres');assert.equal(a.list.scrollTop,1000);
 a.q('.toast-close').focus();a.list.scrollTop=800;a.controller.notify('Cuatro');assert.equal(a.list.scrollTop,800);
});
test('a long stack retains errors and has an explicit scroll budget, not eviction',()=>{
 const a=setup();for(let i=0;i<30;i++)a.controller.notify('Error '+i,'error');assert.equal(a.all('.toast-item').length,30);
 assert.match(css,/\.toast-list\{[^}]*max-height:min\(40dvh,420px\)[^}]*overflow-y:auto/);
});
test('CSS gates transform and opacity motion, preserves screen durations and readable controls',()=>{
 assert.equal(MOTION.toast,300);assert.equal(MOTION.screen,150);assert.equal(MOTION.dialog,240);assert.equal(MOTION.drawer,260);
 assert.match(css,/@starting-style\{html\[data-input-modality=pointer\] \.notification:not\(\[data-suspended\]\) \.toast-card/);
 assert.match(css,/@media\(prefers-reduced-motion:no-preference\)/);
 assert.match(css,/\.toast-close\{[^}]*min-width:44px;min-height:44px/);
 assert.doesNotMatch(css,/@keyframes|transition:\s*all|transition:[^;}]*height/);
});

test('first duplicate height change retargets neighbouring cards through FLIP',()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');a.controller.notify('Dos');
 const neighbour=a.q('.toast-item');let reads=0;
 neighbour.getBoundingClientRect=()=>({top:++reads===1?80:60});
 a.controller.notify('Dos');assert.equal(neighbour.style.transform,'translateY(20px)');
 a.flush();assert.equal(neighbour.style.transform,'none');
});

test('modal suspension disables entry transitions without toggling list display',()=>{
 const a=setup({pointer:true});a.controller.setSuspended(true);a.controller.notify('Nuevo');
 assert.equal(a.q('.toast-region').hidden,false);assert.equal(a.q('.toast-region').hasAttribute('inert'),true);
 assert.equal(a.frames.size,0);
 assert.match(css,/\.notification\[data-suspended\] \.toast-region\{visibility:hidden\}/);
 assert.match(css,/\.notification\[data-suspended\] \.toast-card\{transition:none;transform:none;opacity:1\}/);
});
test('bottom scroll adjustment is measured as part of the FLIP mutation',()=>{
 const a=setup({pointer:true});a.controller.notify('Uno');
 Object.defineProperties(a.list,{scrollHeight:{configurable:true,value:1000},clientHeight:{value:200}});
 a.list.scrollTop=800;const item=a.q('.toast-item');
 item.getBoundingClientRect=()=>({top:100-a.list.scrollTop});
 a.controller.notify('Dos');assert.equal(item.style.transform,'translateY(200px)');
});

test('dismissing the latest announcement clears its live text without removing other cards',()=>{
 const a=setup();a.controller.notify('Previo');a.controller.notify('Error','error');a.click(a.all('.toast-close').at(-1));
 assert.equal(a.q('#live-error').textContent,'');assert.equal(a.all('.toast-item').length,1);
});
