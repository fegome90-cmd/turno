import test from 'node:test';
import assert from 'node:assert/strict';
import {createStrandsNoteExtractor} from '../note-proposal.mjs';
import {createStrandsClassifier} from '../gateway-provider.mjs';
import {createStrandsCapture} from '../gateway-capture.mjs';

const env={TURNO_AI_ENABLED:'1',TURNO_SYNTHETIC_ONLY:'1',TURNO_AI_PROVIDER:'vercel',
  TURNO_AI_MODEL_ID:'anthropic/claude-haiku-5.5',AI_GATEWAY_API_KEY:'placeholder-not-a-secret-key-1234'};
const note='Falta reponer guantes sintéticos.';
const outputs={extraction:{action:{title:'Reponer guantes sintéticos',sourceQuote:'reponer guantes sintéticos'}},
  classification:{label:'PROPOSE_TASK'},capture:{proposals:[]}};
function wireResponse(output){
  const parts=[{type:'stream-start',warnings:[]},
    {type:'tool-call',toolCallId:'synthetic-call',toolName:'strands_structured_output',input:JSON.stringify(output)},
    {type:'finish',finishReason:{unified:'tool-calls',raw:'tool_use'},
      usage:{inputTokens:{total:12,noCache:12,cacheRead:0,cacheWrite:0},outputTokens:{total:7,text:7,reasoning:0}}}];
  return new Response(parts.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
}
for(const stage of ['classification','extraction','capture']){
 test(`V2 wire: native context is present on ${stage} without changing Haiku Gateway routing`,async t=>{
  const seen=[];
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(new URL(String(url)).hostname,'ai-gateway.vercel.sh');
    assert.equal(new Headers(init.headers).get('ai-language-model-id'),'anthropic/claude-haiku-5.5');
    seen.push(JSON.parse(init.body));return wireResponse(outputs[stage]);
  });
  const options={modelContext:{source:'confirmed-note',noteVersion:3}};
  if(stage==='classification') await (await createStrandsClassifier({env}))({id:'e',synthetic:true,text:note},options);
  if(stage==='extraction') await (await createStrandsNoteExtractor({env}))(note,options);
  if(stage==='capture') await (await createStrandsCapture({env}))({shiftId:'shift-synthetic',synthetic:true,text:note},{isAuthorized:async()=>true});
  assert.equal(seen.length,1);
  const sent=JSON.stringify(seen[0].prompt);
  assert.ok(sent.includes('turno_context_v2'),'native ContextInjector content must reach the real VercelModel transport');
  assert.ok(sent.includes(stage));
  if(stage!=='capture') assert.ok(sent.includes('noteVersion'));
  assert.equal(sent.includes('shift-synthetic'),false,'internal identity is not model context');
 });
}
