import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDrafts, analyzeAmbientEvent } from '../ambient-engine.mjs';

const base = {
  shiftId:'shift-1',
  beds:[{id:'bed-1',label:'Cama 1'}, {id:'bed-2',label:'Cama 2'}],
  drafts:[
    {id:'a',title:'Revisar tarea pendiente A',bedLabel:'Cama 4',bedId:null,time:'15:00',date:null},
    {id:'b',title:'Revisar tarea pendiente B',bedLabel:'Cama 4',bedId:null,time:'15:00',date:null},
    {id:'c',title:'Completar informe',beforeClose:true,completed:false}
  ]
};
const event = {id:'event-1',type:'drafts_ready',shiftId:'shift-1',synthetic:true};
const settings = {enabled:true,syntheticOnly:true,decisionMode:'GATEWAY'};
const isAuthorized = async () => true;
const getAuthorizedSnapshot = async () => base;
test('dos tareas de cama 4 y 15:00 producen revisión, no guardado', () => {
  const output=inspectDrafts(base);
  assert.deepEqual(output.map(x=>x.kind),['resolve-bed','resolve-date','shared-slot']);
  assert.equal(output.some(x=>x.kind==='before-close'),false);
  assert.ok(output.every(x=>x.requiresApproval && !x.actions.includes('save')));
});
test('antes del cierre no se convierte en horario ni bloquea el cierre',()=>{
  const output=inspectDrafts({...base,closing:true});
  assert.equal(output.at(-1).kind,'before-close');
  assert.equal(output.at(-1).channel,'toast');
  assert.equal(base.drafts[2].time,undefined);
});
test('falta callback de autorización: falla cerrado',async()=>{
  await assert.rejects(analyzeAmbientEvent({event,settings,getAuthorizedSnapshot}),/callbacks/);
});
test('rechaza datos no sintéticos',async()=>{
  await assert.rejects(analyzeAmbientEvent({event:{...event,synthetic:false},settings,isAuthorized,getAuthorizedSnapshot}),/sintéticos/);
});
test('rechaza lectura no autorizada y snapshot de otro turno',async()=>{
  await assert.rejects(analyzeAmbientEvent({event,settings,isAuthorized:async()=>false,getAuthorizedSnapshot}),/no autorizado/);
  await assert.rejects(analyzeAmbientEvent({event,settings,isAuthorized,getAuthorizedSnapshot:async()=>({...base,shiftId:'other'})}),/ajeno/);
});
test('eventos de propuestas no invocan modelos',async()=>{
  const actual=await analyzeAmbientEvent({event,settings,isAuthorized,getAuthorizedSnapshot,
    classifyWithGateway:()=>{throw new Error('LLM no permitido');}});
  assert.equal(actual.suggestions.length,3);
});
test('el agente apagado no lee datos',async()=>{
  const actual=await analyzeAmbientEvent({event,settings:{enabled:false},isAuthorized:()=>{throw new Error('called')},getAuthorizedSnapshot:()=>{throw new Error('called')}});
  assert.deepEqual(actual,{status:'disabled',suggestions:[]});
});
test('nota usa clasificación sintética y solo crea sugerencia',async()=>{
  const noteEvent={...event,type:'note_saved'};
  const noteSnapshot={...base,noteText:'Acuerda revisar informe antes del cierre'};
  let called=0;
  const actual=await analyzeAmbientEvent({event:noteEvent,settings,isAuthorized,
    getAuthorizedSnapshot:async()=>noteSnapshot,
    classifyWithGateway:async x=>{called++;assert.deepEqual(Object.keys(x).sort(),['id','synthetic','text']);return {label:'PROPOSE_TASK'};}});
  assert.equal(called,1); assert.equal(actual.suggestions[0].channel,'inbox');
  assert.equal(actual.suggestions[0].requiresApproval,true);
});
test('no clasificar texto grande ni clases no permitidas',async()=>{
  const actual=await analyzeAmbientEvent({event:{...event,type:'note_saved'},settings,isAuthorized,getAuthorizedSnapshot:async()=>({...base,noteText:'a'.repeat(501)}),
    classifyWithGateway:()=>{throw new Error('no debería llamar a red')}});
  assert.equal(actual.status,'abstain');
});
