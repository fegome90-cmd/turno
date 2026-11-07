import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const css=()=>fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
test('colour values live in :root tokens; no hex literal appears outside :root',async()=>{
 const text=await css();
 const outside=text.replace(/:root\{[^}]*\}/g,'');
 assert.deepEqual(outside.match(/#[0-9a-fA-F]{3,8}\b/g),null);
 for(const token of ['--accent-solid:#111','--on-accent:#fff','--backdrop:#0005','--shadow-dialog:0 0 0 1px #0000001f,0 12px 32px #00000024'])assert.ok(text.includes(token),token);
});
test('font sizes use the rem type scale; only font-size:0 stays literal',async()=>{
 const text=await css();
 assert.deepEqual(text.match(/font-size:\d+px/g),null);
 assert.match(text,/--text-xs:\.75rem;--text-sm:\.8125rem;--text-md:\.875rem;--text-base:1rem;--text-lg:1\.25rem;--text-2xl:2rem;--text-writing:1\.1875rem/);
 assert.match(text,/\.brand-button span\{font-size:0\}/);
});
test('the selected treatment is one shared rule set and no black filled row remains',async()=>{
 const text=await css();
 const treatment='background:var\\(--selected\\);color:var\\(--ink\\);box-shadow:inset 3px 0 0 var\\(--ink\\);border-radius:var\\(--radius-control\\);border-start-start-radius:0;border-end-start-radius:0';
 for(const selector of ['\\.nav-item\\.selected','\\.task-row\\.current','\\.tree-task\\.current'])assert.match(text,new RegExp(selector+'\\{'+treatment+'\\}'));
 assert.match(text,/\.agenda-task\.current\{background:var\(--selected\);color:var\(--ink\);box-shadow:inset 3px 0 0 var\(--ink\);border-radius:var\(--radius-control\);border-start-start-radius:0;border-end-start-radius:0\}/);
 assert.match(text,/\.filter\.active\{background:var\(--selected\);font-weight:600;box-shadow:inset 0 -2px 0 var\(--ink\)\}/);
 for(const selector of ['.nav-item.selected','.task-row.current','.tree-task.current','.agenda-task.current'])assert.equal(text.includes(selector+'{background:#111'),false);
 assert.doesNotMatch(text,/border-left-color|border-left:3px solid transparent|border-left:2px solid transparent/);
});
