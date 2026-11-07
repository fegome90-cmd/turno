import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseHTML} from 'linkedom';
function specificity(selector){const normalized=selector.replace(/:not\(([^)]+)\)/g,'$1');return (normalized.match(/#[\w-]+/g)||[]).length*100+(normalized.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g)||[]).length*10+(normalized.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+/g,'').match(/\b[a-z]+\b/gi)||[]).length;}
function styleFor(css,element){const result={};for(const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)){for(const selector of match[1].trim().split(',')){if(selector.startsWith('@'))continue;let matches=false;try{matches=element.matches(selector.replaceAll(':hover','[data-hover]'));}catch{}if(!matches)continue;const weight=specificity(selector);for(const declaration of match[2].split(';')){const [key,...vals]=declaration.split(':');if(!['color','background','background-color'].includes(key.trim()))continue;const property=key.trim()==='background'?'background-color':key.trim();if(!result[property]||weight>=result[property].weight)result[property]={value:vals.join(':').trim(),weight};}}}return Object.fromEntries(Object.entries(result).map(([k,v])=>[k,v.value]));}
test('selected Home retains dark background with white foreground on hover',async()=>{const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');const {document}=parseHTML('<button class="nav-item selected" data-hover>Inicio</button>');const result=styleFor(css,document.querySelector('button'));assert.equal(result.color,'#fff');assert.ok(['#111','#222','#292929'].includes(result['background-color']),JSON.stringify(result));});
test('primary action retains contrasting dark hover',async()=>{const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');const {document}=parseHTML('<button class="primary" data-hover>Guardar</button>');const result=styleFor(css,document.querySelector('button'));assert.equal(result.color,'#fff');assert.equal(result['background-color'],'#333');});
test('active filter keeps selected background on hover',async()=>{const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');const {document}=parseHTML('<button class="filter active" data-hover>Pendientes</button>');const result=styleFor(css,document.querySelector('button'));assert.equal(result['background-color'],'var(--selected)');});

test('live notification regions remain mounted and are not hidden while empty',async()=>{
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const html=await fs.readFile(new URL('../index.html',import.meta.url),'utf8');
 const {document}=parseHTML(html);
 for(const id of ['live','live-error']){
  const live=document.getElementById(id);
  assert.ok(live);assert.equal(live.hasAttribute('hidden'),false);assert.equal(live.classList.contains('sr-only'),true);
 }
 assert.doesNotMatch(css,/\.notification\s+p:empty\s*\{[^}]*display\s*:\s*none/);
});
