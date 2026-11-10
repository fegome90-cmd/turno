import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionClassifier} from '../src/decisions-api.mjs';
const env={AI_GATEWAY_API_KEY:'fake-key',TURNO_AGENT_MODEL:'google/gemini-2.5-flash'};

test('Decision API uses the remote Vercel decisionModel with a fixed choice catalog',async()=>{
  let input, selected;
  const classify=await createDecisionClassifier({env,loadModules:async()=>({
    gateway:{decisionModel:id=>(selected=id)},
    decide:async args=>{input=args;return {answers:{intent:{choice:'PROPOSE_TASK',confidence:0.97}}};},
  })});
  const result=await classify({source:'synthetic',text:'Completar informe'});
  assert.deepEqual(result,{label:'PROPOSE_TASK',confidence:0.97});
  assert.equal(selected,'typesafe-ai/jev');
  assert.equal(input.state,'Completar informe');
  assert.deepEqual(Object.keys(input.questions.intent.criteria),['NO_ACTION','PROPOSE_TASK','PROPOSE_REMINDER','NEEDS_REVIEW']);
  assert.equal(JSON.stringify(input).includes(env.AI_GATEWAY_API_KEY),false);
});
test('invalid remote answer never becomes a candidate',async()=>{
  const classify=await createDecisionClassifier({env,loadModules:async()=>({
    gateway:{decisionModel:()=>({})},
    decide:async()=>({answers:{intent:{choice:'DELETE',confidence:1}}}),
  })});
  await assert.rejects(()=>classify({source:'synthetic',text:'Completar informe'}),/choice/);
});
