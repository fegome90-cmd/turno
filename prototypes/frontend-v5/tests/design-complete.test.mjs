// DOM/state and declared CSS contracts only. This file does not render the UI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {parse} from 'cssomnom';
import {createTheme} from '../src/theme.mjs';
import {createPreviewAdapter} from '../src/preview-adapter.mjs';
const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let run=0;
function mediaFixture(initial=false){
 const listeners=new Set();
 const media={matches:initial,addEventListener(type,fn){if(type==='change')listeners.add(fn);}};
 return {media,set(value){media.matches=value;for(const fn of listeners)fn();}};
}
async function setup({width=1440,dark=false,name}={}){
 const {window}=parseHTML(await fs.readFile(new URL('../index.html',import.meta.url),'utf8'));
 window.innerWidth=width;
 const system=mediaFixture(dark);
 window.matchMedia=query=>query==='(prefers-color-scheme: dark)'?system.media:{matches:false,addEventListener(){}};
 let focused=window.document.body;
 Object.defineProperty(window.document,'activeElement',{configurable:true,get:()=>focused});
 window.HTMLElement.prototype.focus=function(){if(!this.disabled)focused=this;};
 window.HTMLElement.prototype.showModal=function(){this.open=true;this.setAttribute('open','');};
 window.HTMLElement.prototype.close=function(){this.open=false;this.removeAttribute('open');};
 // LinkeDOM's option setter is not a native select implementation.
 Object.defineProperty(window.HTMLOptionElement.prototype,'selected',{configurable:true,get(){return this.hasAttribute('selected');},set(value){if(value)for(const other of this.parentElement?.querySelectorAll('option')||[])if(other!==this)other.removeAttribute('selected');this.toggleAttribute('selected',Boolean(value));}});
 if(name){const meta=window.document.createElement('meta');meta.name='turno-preview-name';meta.content=name;window.document.head.append(meta);}
 globalThis.window=window;globalThis.document=window.document;
 await import(`../src/app.mjs?complete=${++run}`);await wait(250);
 const q=selector=>window.document.querySelector(selector);
 const event=(node,type,extras={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,extras);node.dispatchEvent(e);return e;};
 const click=async selector=>{assert.ok(q(selector),selector);q(selector).focus();event(q(selector),'click');await wait(2);};
 const fill=(selector,value)=>{q(selector).value=value;event(q(selector),'input');};
 const appearance=value=>{for(const option of q('#theme-preference').options)option.selected=option.value===value;event(q('#theme-preference'),'change');};
 return {q,event,click,fill,appearance,window,system};
}
test('theme defaults to system, tracks changes and explicit choices survive system changes',()=>{
 const {document}=parseHTML('<html></html>'),system=mediaFixture(true),changes=[];
 const theme=createTheme({root:document.documentElement,matchMedia:()=>system.media,onChange:state=>changes.push(state)});
 assert.equal(document.documentElement.dataset.theme,'dark');assert.equal(theme.preference,'system');
 system.set(false);assert.equal(document.documentElement.dataset.theme,'light');
 assert.equal(theme.setPreference('dark'),true);system.set(false);assert.equal(document.documentElement.dataset.theme,'dark');
 assert.equal(theme.setPreference('invalid'),false);assert.equal(theme.preference,'dark');
 theme.setPreference('system');assert.equal(document.documentElement.dataset.theme,'light');
 assert.ok(changes.length>=4);
});
test('no matchMedia still gives a usable explicit dark mode',()=>{
 const {document}=parseHTML('<html></html>');const theme=createTheme({root:document.documentElement});
 assert.equal(document.documentElement.dataset.theme,'light');theme.setPreference('dark');assert.equal(document.documentElement.dataset.theme,'dark');
});
test('more options is a nonmodal disclosure with bound controls, toggling and Escape focus return',async()=>{
 const a=await setup();
 assert.equal(a.q('#more-options').hidden,true);assert.ok(a.q('.toolbar [data-action="close-shift"]'));
 assert.equal(a.q('.navigation [data-action="close-shift"]'),null);
 await a.click('[data-action="more"]');assert.equal(a.q('#more-options').hidden,false);
 assert.equal(a.q('[data-action="more"]').getAttribute('aria-expanded'),'true');assert.equal(Boolean(a.q('#modal').open),false);
 assert.ok(a.q('label[for="theme-preference"]'));assert.ok(a.q('#more-options [data-action="demo"]'));
 assert.match(a.q('#more-options').textContent,/Datos sintéticos/);
 a.q('#theme-preference').focus();const e=a.event(a.q('#theme-preference'),'keydown',{key:'Escape'});
 assert.equal(e.defaultPrevented,true);assert.equal(a.q('#more-options').hidden,true);
 assert.equal(a.window.document.activeElement,a.q('[data-action="more"]'));
 await a.click('[data-action="more"]');assert.equal(a.q('#more-options').hidden,false);await a.click('[data-action="more"]');assert.equal(a.q('#more-options').hidden,true);
});
test('outside click and tabbing outside close the disclosure without a focus trap',async()=>{
 const a=await setup();await a.click('[data-action="more"]');await a.click('.brand-button');
 assert.equal(a.q('#more-options').hidden,true);
 await a.click('[data-action="more"]');a.q('[data-action="toggle-inspector"]').focus();a.event(a.q('[data-action="toggle-inspector"]'),'focusin');
 assert.equal(a.q('#more-options').hidden,true);assert.equal(a.window.document.activeElement,a.q('[data-action="toggle-inspector"]'));
});
test('closing on focus keeps the pending click target connected and actionable',async()=>{
 const a=await setup();await a.click('[data-action="open-shift"]');await a.click('[data-action="more"]');
 const target=a.q('[data-action="bed:bed-2"]');target.focus();a.event(target,'focusin');
 assert.equal(target.isConnected,true);a.event(target,'click');await wait(2);
 assert.equal(a.q('[data-action="bed:bed-2"]').getAttribute('aria-expanded'),'true');
});
test('theme changes retain the editor node, raw invalid draft and field error state',async()=>{
 const a=await setup({dark:true});assert.equal(a.window.document.documentElement.dataset.theme,'dark');
 assert.equal(a.q('meta[name="theme-color"]').content,'#171817');
 await a.click('[data-action="open-shift"]');a.fill('#body','Un borrador sin guardar');a.fill('#date','31/02/2026');
 a.event(a.q('#editor-form'),'submit');await wait(10);assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');
 const body=a.q('#body'),error=a.q('#field-error-date').textContent;
 await a.click('[data-action="more"]');a.appearance('light');
 assert.equal(a.window.document.documentElement.dataset.theme,'light');assert.equal(a.q('meta[name="theme-color"]').content,'#ffffff');
 assert.equal(a.q('#body'),body);assert.equal(body.value,'Un borrador sin guardar');assert.equal(a.q('#date').value,'31/02/2026');
 assert.equal(a.q('#field-error-date').textContent,error);assert.equal(a.q('#date').getAttribute('aria-invalid'),'true');
 a.system.set(true);assert.equal(a.window.document.documentElement.dataset.theme,'light');
 a.appearance('system');assert.equal(a.window.document.documentElement.dataset.theme,'dark');
});
test('mobile dropdown Escape does not close the navigation drawer, demo returns to disclosure trigger',async()=>{
 const a=await setup({width:390});await a.click('[data-action="open-shift"]');a.fill('#body','Mantener');
 await a.click('[data-action="navigation"]');await a.click('#modal [data-action="more"]');
 a.appearance('dark');assert.equal(a.q('#modal').open,true);
 a.event(a.q('#theme-preference'),'keydown',{key:'Escape'});assert.equal(a.q('#modal').open,true);assert.equal(a.q('#more-options').hidden,true);
 await a.click('#modal [data-action="more"]');assert.equal(a.q('#more-options').hidden,false);a.event(a.q('#theme-preference'),'keydown',{key:'Escape'});
 await a.click('#modal [data-action="more"]');a.q('#modal').dispatchEvent(new a.window.Event('cancel',{cancelable:true}));
 assert.equal(a.q('#modal').open,true);assert.equal(a.q('#more-options').hidden,true);
 await a.click('#modal [data-action="more"]');await a.click('#more-options [data-action="demo"]');
 assert.match(a.q('#modal').textContent,/Demostración local/);await a.click('[data-action="dismiss"]');
 assert.equal(a.q('#modal').open,false);assert.equal(a.q('#body').value,'Mantener');
 assert.equal(a.window.document.activeElement,a.q('[data-action="navigation"]'));
});
test('custom preview profile greets by name while public fixtures remain generic',async()=>{
 const sample='Persona de prueba';const adapter=createPreviewAdapter({preferredName:sample});assert.equal((await adapter.load()).profile.preferredName,sample);
 const a=await setup({name:sample});assert.equal(a.q('.greeting h1').textContent,'Hola, '+sample+'.');
 const greeting=a.q('.greeting h1').textContent,subtitle=a.q('.greeting p').textContent;
 await a.click('[data-action="open-shift"]');assert.equal(a.q('[data-action="open-shift"]').textContent,'Ir al turno actual');await a.click('[data-action="home"]');
 assert.equal(a.q('.greeting h1').textContent,greeting);assert.equal(a.q('.greeting p').textContent,subtitle);
 assert.equal((await createPreviewAdapter().load()).profile.preferredName,'Demo');
});
function tokens(selector){const body=css.slice(css.indexOf(selector+'{')+selector.length+1).split('}')[0];return Object.fromEntries([...body.matchAll(/(--[\w-]+):([^;}]*)/g)].map(m=>[m[1],m[2]]));}
function luminance(hex){const full=hex.slice(1).length===3?hex.slice(1).split('').map(x=>x+x).join(''):hex.slice(1);const rgb=full.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const [hi,lo]=[luminance(a),luminance(b)].sort((a,b)=>b-a);return(hi+.05)/(lo+.05);}
test('actual light and dark tokens meet declared text, field-border, filter and focus contrast contracts',()=>{
 const light=tokens(':root');
 for(const theme of [light,{...light,...tokens(':root[data-theme=dark]')}]){
  for(const background of ['--canvas','--sidebar','--field','--selected','--hover','--pressed']){
   for(const foreground of ['--ink','--secondary'])assert.ok(contrast(theme[foreground],theme[background])>=4.5,`${foreground} / ${background}`);
   assert.ok(contrast(theme['--ink'],theme[background])>=3,'focus '+background);
  }
  for(const background of ['--solid','--solid-hover','--solid-pressed','--selected-hover'])assert.ok(contrast(theme['--on-solid'],theme[background])>=4.5,'solid '+background);
  for(const background of ['--canvas','--field']){
   assert.ok(contrast(theme['--control'],theme[background])>=3,'control border '+background);
   assert.ok(contrast(theme['--error'],theme[background])>=4.5,'error '+background);
   assert.ok(contrast(theme['--error-border'],theme[background])>=3,'error border '+background);
  }
  assert.ok(contrast(theme['--secondary'],theme['--sidebar'])>=3,'active filter border');
 }
});
test('six semantic rem roles, two radii, one editor edge and no unused font assets',async()=>{
 const light=tokens(':root'),roles=Object.keys(light).filter(key=>key.startsWith('--type-'));
 assert.equal(roles.length,6);assert.ok(roles.every(key=>/^[\d.]+rem$/.test(light[key])));
 assert.equal(light['--type-title'],'2.125rem');assert.equal(light['--type-section'],'1.25rem');assert.equal(light['--type-caption'],'.8125rem');
 assert.match(css,/\.brand-button\{[^}]*font-size:var\(--type-section\)/);
 assert.match(css,/\.shift-button\{border-color:transparent/);
 assert.doesNotMatch(css,/font-size:\s*[\d.]+px|72ch/);
 for(const declaration of css.matchAll(/border-radius:([^;}]+)/g))assert.ok(/^(?:0|var\(--radius-(?:control|panel)\))(?: (?:0|var\(--radius-(?:control|panel)\)))*$/.test(declaration[1]),declaration[1]);
 const fonts=await fs.readdir(new URL('../assets/fonts/',import.meta.url));assert.equal(fonts.length,5);
 for(const file of fonts)assert.ok(css.includes(file));
 for(const license of ['SourceSans3-OFL.txt','SourceSerifPro-OFL.txt'])assert.ok((await fs.readFile(new URL('../licenses/'+license,import.meta.url),'utf8')).includes('SIL OPEN FONT LICENSE'));
});
test('complete CSS parses with no repeated selector in the same conditional context',()=>{
 const sheet=parse(css),seen=new Set();let count=0;
 function visit(rules,context='root'){
  for(const rule of rules){count++;if(rule.selectorText){const key=context+'|'+rule.selectorText;assert.equal(seen.has(key),false,key);seen.add(key);}
   if(rule.cssRules)visit(rule.cssRules,context+'|'+(rule.conditionText||rule.cssText.split('{')[0]));}
 }
 visit(sheet.cssRules);assert.ok(count>250);
 assert.match(css,/\.icon\{[^}]*background-color:currentColor/);
 assert.match(css,/\.nav-item\.selected\{background:var\(--solid\);color:var\(--on-solid\)\}/);
 assert.match(css,/button\.primary\{background:var\(--solid\);color:var\(--on-solid\)/);
 assert.match(css,/dialog\{[^}]*background:var\(--canvas\)/);
});
test('dark mode survives failed save, retry, archive confirmation and read-only task controls',async()=>{
 const a=await setup({dark:true});await a.click('[data-action="open-shift"]');a.fill('#body','Guardar en oscuro');
 await a.click('[data-action="more"]');await a.click('#more-options [data-action="demo"]');await a.click('[data-action="simulate-error"]');
 assert.equal(a.window.document.activeElement,a.q('[data-action="more"]'));
 a.event(a.q('#editor-form'),'submit');await wait(500);assert.match(a.q('#save-error').textContent,/Fallo simulado/);assert.equal(a.q('#body').value,'Guardar en oscuro');
 a.event(a.q('#editor-form'),'submit');await wait(500);assert.match(a.q('#save-feedback').textContent,/Guardado/);
 await a.click('.toolbar [data-action="close-shift"]');assert.equal(a.q('#modal').open,true);await a.click('[data-action="confirm-close"]');await wait(500);
 await a.click('[data-action="archive"]');await a.click('[data-action="archive-shift:demo-shift-1"]');
 assert.equal(a.window.document.documentElement.dataset.theme,'dark');assert.equal(a.q('#editor-completed').disabled,true);
 assert.equal(a.q('#body').hasAttribute('readonly'),true);assert.equal(a.q('#body').value,'Guardar en oscuro');
});
