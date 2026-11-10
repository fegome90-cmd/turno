import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectAmbientEvent} from '../src/ambient-policy.mjs';

const tasks=[
  {id:'A',bedId:null,bedLabel:'Cama 4',title:'Revisar tarea pendiente A',time:'15:00',date:null,completed:false},
  {id:'B',bedId:null,bedLabel:'Cama 4',title:'Revisar tarea pendiente B',time:'15:00',date:null,completed:false},
  {id:'C',bedId:null,title:'Completar informe',time:'',date:null,constraint:'before-close',completed:false},
];
const fixture={source:'synthetic',id:'evt-1',kind:'task_saved',beds:[{id:'bed-1',label:'Cama 1'},{id:'bed-2',label:'Cama 2'}],tasks};

test('shared time and unlinked bed yield review-only hints, never duplicate deletion',()=>{
  const actual=inspectAmbientEvent(fixture);
  assert.deepEqual(actual.map(x=>x.code),['VERIFY_SHARED_TIME','LINK_BED','CONFIRM_DATE']);
  assert.deepEqual(actual[0].taskIds,['A','B']);
  assert.equal(actual.every(x=>x.requiresReview===true),true);
  assert.equal(actual.some(x=>/duplicad[ao]|eliminar/i.test(x.message)),false);
});
test('a same-time task in another bed is not treated as a collision',()=>{
  const different={...fixture,tasks:[tasks[0],{...tasks[1],bedLabel:'Cama 3'}]};
  assert.equal(inspectAmbientEvent(different).some(x=>x.code==='VERIFY_SHARED_TIME'),false);
});
test('a completion constraint produces a close review but no synthetic hour',()=>{
  const actual=inspectAmbientEvent({...fixture,kind:'shift_close_attempt'});
  const close=actual.find(x=>x.code==='BEFORE_CLOSE_PENDING');
  assert.deepEqual(close.taskIds,['C']);
  assert.equal(close.message.includes('15:00'),false);
});
test('finished before-close tasks produce no close reminder',()=>{
  const actual=inspectAmbientEvent({...fixture,kind:'shift_close_attempt',tasks:tasks.map(x=>({...x,completed:true}))});
  assert.equal(actual.some(x=>x.code==='BEFORE_CLOSE_PENDING'),false);
});
test('never mutates the snapshot or creates an action command',()=>{
  const source=structuredClone(fixture);
  const actual=inspectAmbientEvent(fixture);
  assert.deepEqual(fixture,source);
  assert.equal(actual.every(x=>Object.keys(x).sort().join('|')==='code|id|message|requiresReview|taskIds'),true);
});
test('rejects real or malformed events before any analysis',()=>{
  assert.throws(()=>inspectAmbientEvent({...fixture,source:'clinical'}),/sintéticos/);
  assert.throws(()=>inspectAmbientEvent({...fixture,tasks:'arbitrary'}),/tasks/);
});
