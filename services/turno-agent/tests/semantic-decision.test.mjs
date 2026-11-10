import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySemantic} from '../src/semantic-decision.mjs';
const event={source:'synthetic',id:'note-1',text:'Recuerda el informe'};
const generative=async()=>({label:'PROPOSE_TASK'});
const decisions=async()=>({label:'PROPOSE_REMINDER',confidence:0.96});

test('GATEWAY invokes Strands primary and never the shadow',async()=>{
  const actual=await classifySemantic({event,mode:'GATEWAY',generative,decisions:()=>{throw new Error('shadow called');}});
  assert.deepEqual(actual,{status:'candidate',source:'GATEWAY',label:'PROPOSE_TASK'});
});
test('DUAL keeps Strands as authority even if decision model disagrees',async()=>{
  const records=[];
  const actual=await classifySemantic({event,mode:'DUAL',generative,decisions,record:x=>records.push(x)});
  assert.deepEqual(actual,{status:'candidate',source:'GATEWAY',label:'PROPOSE_TASK'});
  assert.deepEqual(records,[{eventId:'note-1',activeLabel:'PROPOSE_TASK',shadowLabel:'PROPOSE_REMINDER',agree:false}]);
  assert.equal(JSON.stringify(records).includes(event.text),false);
});
test('DUAL remains operational when shadow errors and metrics fail',async()=>{
  const actual=await classifySemantic({event,mode:'DUAL',generative,decisions:async()=>{throw new Error('offline')},record:()=>{throw new Error('metrics') }});
  assert.equal(actual.label,'PROPOSE_TASK');
});
test('DECISIONS requires sufficiently confident choice',async()=>{
  const actual=await classifySemantic({event,mode:'DECISIONS',decisions});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(actual.status,'candidate');
  const abstain=await classifySemantic({event,mode:'DECISIONS',decisions:async()=>({label:'PROPOSE_TASK',confidence:0.51})});
  assert.equal(abstain.status,'abstain');
  assert.equal(abstain.label,'NEEDS_REVIEW');
});
test('invalid label, missing classifier, and real input fail closed',async()=>{
  assert.equal((await classifySemantic({event,mode:'GATEWAY',generative:async()=>({label:'DELETE_EVERYTHING'})})).status,'abstain');
  await assert.rejects(classifySemantic({event,mode:'GATEWAY'}),/generative/);
  await assert.rejects(classifySemantic({event:{...event,source:'clinical'},mode:'GATEWAY',generative}),/sintético/);
});
