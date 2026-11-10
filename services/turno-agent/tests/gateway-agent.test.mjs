import test from 'node:test';
import assert from 'node:assert/strict';
import {createGatewayClassifier} from '../src/gateway-agent.mjs';

const env={AI_GATEWAY_API_KEY:'synthetic-secret',TURNO_AGENT_MODEL:'google/gemini-2.5-flash'};

test('creates a real Strands Agent shape around the Vercel Gateway model', async () => {
  let config, prompt;
  const loadModules=async()=>({
    Agent:class {constructor(c){config=c;}async invoke(p){prompt=p;return {structuredOutput:{label:'PROPOSE_TASK'}};}},
    VercelModel:class {constructor(c){this.options=c;}},
    gateway:id=>({modelId:id}),
    z:{object:v=>v, enum:v=>({allowed:v})},
  });
  const classify=await createGatewayClassifier({env,loadModules});
  const result=await classify({source:'synthetic',text:'Recordar completar el informe'});
  assert.deepEqual(result,{label:'PROPOSE_TASK'});
  assert.equal(config.model.options.provider.modelId,'google/gemini-2.5-flash');
  assert.ok(config.structuredOutputSchema.label.allowed.includes('PROPOSE_TASK'));
  assert.equal(config.tools?.length??0,0);
  assert.ok(config.systemPrompt.includes('No diagnostiques'));
  assert.equal(JSON.parse(prompt).text,'Recordar completar el informe');
  assert.equal(prompt.includes(env.AI_GATEWAY_API_KEY),false);
});
test('rejects model output outside permitted fixed catalog',async()=>{
  const loadModules=async()=>({
    Agent:class {async invoke(){return {structuredOutput:{label:'DELETE_ALL'}};}},
    VercelModel:class {},gateway:()=>({}),z:{object:v=>v,enum:v=>v},
  });
  const classify=await createGatewayClassifier({env,loadModules});
  await assert.rejects(()=>classify({source:'synthetic',text:'Una nota sintética'}),/label/);
});
test('rejects real or empty input before contacting the model',async()=>{
  let called=0;
  const loadModules=async()=>{called++;return {};};
  await assert.rejects(()=>createGatewayClassifier({env:{},loadModules}),/AI_GATEWAY_API_KEY|VERCEL_OIDC_TOKEN/);
  assert.equal(called,0);
});
