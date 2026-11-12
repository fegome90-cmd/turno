import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDrafts, analyzeAmbientEvent } from '../ambient-engine.mjs';

const base = {
  shiftId:'shift-1', synthetic:true,
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
  assert.deepEqual(output.map(x=>x.kind),['resolve-bed','resolve-date']);
  assert.ok(output.every(x=>x.requiresApproval && !x.actions.includes('save')));
});
test('inspectDrafts nunca devuelve shared-slot, before-close ni canal toast', () => {
  const sharedSlot = {...base, drafts:[
    {id:'a',title:'Revisar A',bedLabel:'Cama 1',bedId:'bed-1',time:'15:00',date:'2026-11-12'},
    {id:'b',title:'Revisar B',bedLabel:'Cama 1',bedId:'bed-1',time:'15:00',date:'2026-11-12'},
    {id:'c',title:'Completar informe',beforeClose:true,completed:false}
  ]};
  for (const output of [inspectDrafts(sharedSlot), inspectDrafts({...sharedSlot, closing:true})]) {
    assert.deepEqual(output, []);
  }
  const mixed = inspectDrafts({...base, closing:true});
  assert.deepEqual(mixed.map(x=>x.kind),['resolve-bed','resolve-date']);
  assert.ok(mixed.every(x=>x.channel==='inbox'));
});
test('resolve-date no inventa la hora en el título', () => {
  const output = inspectDrafts({shiftId:'shift-1', beds:[], drafts:[
    {id:'a',title:'Revisar A',time:'08:00',date:null},
    {id:'b',title:'Revisar B',time:'15:00',date:null}
  ]});
  const [item] = output;
  assert.equal(item.kind,'resolve-date');
  assert.equal(item.title,'Confirmar fecha de tareas con hora');
  assert.doesNotMatch(item.title,/\d{2}:\d{2}/);
  assert.match(item.detail,/08:00, 15:00/);
});
test('drafts_ready sin sugerencias se abstiene', async () => {
  const clean = {...base, drafts:[{id:'c',title:'Completar informe',completed:false}], beds:[]};
  const actual = await analyzeAmbientEvent({event,settings,isAuthorized,getAuthorizedSnapshot:async()=>clean});
  assert.deepEqual(actual,{status:'abstain',suggestions:[],reason:'no_suggestions'});
});
test('shift_close_attempt no está autorizado en el motor', async () => {
  await assert.rejects(analyzeAmbientEvent({event:{...event,type:'shift_close_attempt'},settings,isAuthorized,getAuthorizedSnapshot}),/Tipo de evento no autorizado/);
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
test('rechaza un snapshot no acreditado como sintético por el backend',async()=>{
  await assert.rejects(analyzeAmbientEvent({event,settings,isAuthorized,
    getAuthorizedSnapshot:async()=>({...base,synthetic:false})}),/no acreditada como sintética/);
});
test('eventos de borradores no invocan modelos ni extractor',async()=>{
  const calls={gateway:0,decision:0,comparison:0,extract:0};
  const actual=await analyzeAmbientEvent({event,settings,isAuthorized,getAuthorizedSnapshot,
    classifyWithGateway:async()=>{calls.gateway++;throw new Error('LLM no permitido');},
    classifyWithDecision:async()=>{calls.decision++;throw new Error('LLM no permitido');},
    recordComparison:()=>{calls.comparison++;},
    extractNoteProposal:async()=>{calls.extract++;throw new Error('LLM no permitido');}});
  assert.equal(actual.suggestions.length,2);
  assert.deepEqual(calls,{gateway:0,decision:0,comparison:0,extract:0});
});
test('el agente apagado no lee datos',async()=>{
  const actual=await analyzeAmbientEvent({event,settings:{enabled:false},isAuthorized:()=>{throw new Error('called')},getAuthorizedSnapshot:()=>{throw new Error('called')}});
  assert.deepEqual(actual,{status:'disabled',suggestions:[]});
});
test('nota usa clasificación sintética; el texto sale del snapshot, no del evento',async()=>{
  const noteEvent={...event,type:'note_saved',noteId:'note-1',noteVersion:1};
  const noteSnapshot={...base,notes:[{id:'note-1',version:1,text:'Acuerda revisar informe antes del cierre'}],tasks:[]};
  let called=0;
  const actual=await analyzeAmbientEvent({event:noteEvent,settings,isAuthorized,
    getAuthorizedSnapshot:async()=>noteSnapshot,
    classifyWithGateway:async x=>{called++;assert.deepEqual(Object.keys(x).sort(),['id','synthetic','text']);return {label:'PROPOSE_TASK'};},
    extractNoteProposal:async()=>({action:{title:'Revisar informe',sourceQuote:'revisar informe antes del cierre'}})});
  assert.equal(called,1); assert.equal(actual.status,'proposed');
  assert.equal(actual.suggestions[0].channel,'inline');
  assert.equal(actual.suggestions[0].requiresApproval,true);
});
test('no clasificar texto grande ni clases no permitidas',async()=>{
  const noteEvent={...event,type:'note_saved',noteId:'note-1',noteVersion:1};
  const actual=await analyzeAmbientEvent({event:noteEvent,settings,isAuthorized,getAuthorizedSnapshot:async()=>({...base,notes:[{id:'note-1',version:1,text:'a'.repeat(501)}],tasks:[]}),
    classifyWithGateway:()=>{throw new Error('no debería llamar a red')}});
  assert.equal(actual.reason,'too_long');
  assert.equal(actual.status,'abstain');
});
