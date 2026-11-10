import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuggestionGate} from '../src/suggestion-gate.mjs';

const hint={code:'VERIFY_SHARED_TIME',id:'rule:overlap:A,B',taskIds:['A','B'],message:'Revisar coincidencia de horario.',requiresReview:true};
test('first suggestion is visible but the same event is idempotent',()=>{
  const gate=createSuggestionGate({now:()=>1000,cooldownMs:5000});
  assert.deepEqual(gate.filter('evt1',[hint]),[hint]);
  assert.deepEqual(gate.filter('evt1',[hint]),[]);
});
test('different events cannot spam the same hint inside cooldown',()=>{
  let tick=1000;
  const gate=createSuggestionGate({now:()=>tick,cooldownMs:5000});
  assert.equal(gate.filter('evt1',[hint]).length,1);
  tick=2000;
  assert.deepEqual(gate.filter('evt2',[hint]),[]);
  tick=6001;
  assert.equal(gate.filter('evt3',[hint]).length,1);
});
test('invalid or non-reviewable suggestions are discarded',()=>{
  const gate=createSuggestionGate({now:()=>1000});
  assert.deepEqual(gate.filter('evt',[{...hint,requiresReview:false},{...hint,id:''}]),[]);
});
