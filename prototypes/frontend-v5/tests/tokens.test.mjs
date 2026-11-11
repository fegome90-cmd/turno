import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const css=()=>fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
test('the shared solid and on-solid tokens are defined on :root for light and dark themes',async()=>{
 const text=await css();
 assert.match(text,/:root\{[^}]*--solid:#111[^}]*--on-solid:#fff/);
 assert.match(text,/:root\[data-theme=dark\]\{[^}]*--solid:#f2f3f0[^}]*--on-solid:#171817/);
});
test('the brand label keeps its visually hidden text rule',async()=>{
 const text=await css();
 assert.match(text,/\.brand-button span\{font-size:0\}/);
});
