// Real HTTP + engine + Jev AI SDK + Haiku Strands/VercelModel.
// Only the remote Gateway wire response is synthetic. Never calls a paid provider.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createAgentServer} from '../http/server.mjs';
import {signRequest} from '../http/transport.mjs';
import {readGatewaySettings} from '../gateway-config.mjs';
import {createRemoteDecisionClassifier} from '../decision-provider.mjs';

const note='Falta reponer guantes sintéticos.';
const environment={TURNO_AI_ENABLED:'1',TURNO_SYNTHETIC_ONLY:'1',TURNO_AI_PROVIDER:'vercel',
  TURNO_DECISION_MODE:'DECISION',TURNO_AI_MODEL_ID:'anthropic/claude-haiku-5.5',
  TURNO_DECISION_MODEL_ID:'typesafe-ai/jev',AI_GATEWAY_API_KEY:'placeholder-not-a-secret-key-1234'};
const event={id:'wire-1',type:'note_saved',shiftId:'wire-shift',synthetic:true,noteId:'note-1',noteVersion:1};
const snapshot={shiftId:'wire-shift',synthetic:true,beds:[],drafts:[],tasks:[],notes:[{id:'note-1',version:1,text:note}]};
const proposal={action:{title:'Reponer guantes sintéticos',sourceQuote:'reponer guantes sintéticos'}};

function decisionResponse(label,usage=true){
  return Response.json({answers:{signal:{type:'choice',choice:label,probabilities:Object.fromEntries(['NO_ACTION','PROPOSE_TASK','PROPOSE_REMINDER','NEEDS_REVIEW'].map(key=>[key,key===label?1:0]))}},
    ...(usage?{usage:{inputTokens:7,outputTokens:0}}:{}),warnings:[]});
}
function haikuResponse(){
  const parts=[{type:'stream-start',warnings:[]},
    {type:'tool-call',toolCallId:'synthetic-call',toolName:'strands_structured_output',input:JSON.stringify(proposal)},
    {type:'finish',finishReason:{unified:'tool-calls',raw:'tool_use'},
      usage:{inputTokens:{total:11,noCache:11,cacheRead:0,cacheWrite:0},outputTokens:{total:6,text:6,reasoning:0}}}];
  return new Response(parts.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),
    {headers:{'content-type':'text/event-stream'}});
}

for(const label of ['PROPOSE_TASK','PROPOSE_REMINDER']){
  test(`pack Gateway E2E: Jev ${label} with Haiku 5.5 extraction only when eligible`,async t=>{
    const originalFetch=globalThis.fetch,requests=[],logs=[];
    t.mock.method(globalThis,'fetch',async(url,init)=>{
      const address=new URL(String(url)),headers=new Headers(init?.headers);
      assert.equal(address.hostname,'ai-gateway.vercel.sh','no other provider or network destination is allowed');
      if(address.pathname.endsWith('/decision-model')){
        requests.push({kind:'decision',id:headers.get('ai-model-id')});
        return decisionResponse(label);
      }
      assert.ok(address.pathname.endsWith('/language-model'));
      requests.push({kind:'extract',id:headers.get('ai-language-model-id')});
      return haikuResponse();
    });
    const secret=randomBytes(32).toString('hex');
    const server=createAgentServer({env:{...environment,TURNO_AGENT_SIGNING_SECRET:secret},
      getAuthorizedSnapshot:async()=>structuredClone(snapshot),log:r=>logs.push(r)});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    try{
      const body=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000)),path='/v1/agent/events';
      const response=await originalFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',body,
        headers:{'content-type':'application/json','x-turno-timestamp':timestamp,
          'x-turno-signature':signRequest({secret,timestamp,method:'POST',path,body})},signal:AbortSignal.timeout(3000)});
      const output=await response.json();assert.equal(response.status,200);
      if(label==='PROPOSE_TASK'){
        assert.equal(output.status,'proposed');assert.equal(output.suggestions[0].title,proposal.action.title);
        assert.deepEqual(requests,[{kind:'decision',id:'typesafe-ai/jev'},{kind:'extract',id:'anthropic/claude-haiku-5.5'}]);
        assert.deepEqual(output.suggestions[0].actions,['review','dismiss']);
        const extraction=logs.find(r=>r.kind==='model_metrics'&&r.stage==='extraction');
        assert.equal(extraction?.modelCalls,1);assert.equal(extraction?.inputTokens,11);
      }else{
        assert.equal(output.status,'abstain');assert.equal(output.reason,'label_PROPOSE_REMINDER');
        assert.deepEqual(requests,[{kind:'decision',id:'typesafe-ai/jev'}]);
      }
      const decision=logs.find(r=>r.kind==='model_metrics'&&r.stage==='decision');
      assert.ok(decision,'decision model must be measured as well as Strands generative calls');
      assert.equal(decision.inputTokens,7);assert.equal(decision.outputTokens,0);
      assert.equal(JSON.stringify(logs).includes(note),false);
      assert.equal(JSON.stringify(logs).includes(environment.AI_GATEWAY_API_KEY),false);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  });
}

test('pack Gateway: selected models are preserved without changing the global rollout mode',()=>{
  const explicit=readGatewaySettings(environment),defaults=readGatewaySettings({});
  assert.equal(explicit.provider,'vercel');assert.equal(explicit.modelId,'anthropic/claude-haiku-5.5');
  assert.equal(explicit.decisionModelId,'typesafe-ai/jev');assert.equal(explicit.decisionMode,'DECISION');
  assert.equal(defaults.decisionMode,'GATEWAY');assert.equal(defaults.enabled,false);
});

test('pack Gateway: Jev emits unknown usage as null, never invented zero tokens',async t=>{
  t.mock.method(globalThis,'fetch',async()=>decisionResponse('NO_ACTION',false));
  const classify=await createRemoteDecisionClassifier({env:environment}),records=[];
  const result=await classify({id:'no-usage',text:note,synthetic:true},{onMetrics:r=>records.push(r)});
  assert.equal(result.label,'NO_ACTION');assert.equal(records.length,1);
  assert.equal(records[0].inputTokens,null);assert.equal(records[0].outputTokens,null);
});


test('pack Gateway: Jev cancellation reaches the actual AI SDK transport, no retry',async t=>{
  const controller=new AbortController(),records=[];let calls=0,observed;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    assert.equal(new URL(String(url)).hostname,'ai-gateway.vercel.sh');
    calls++;observed=init.signal;
    controller.abort();
    init.signal.throwIfAborted();
    throw new Error('unreachable');
  });
  const classify=await createRemoteDecisionClassifier({env:environment});
  await assert.rejects(classify({id:'cancel-jev',text:note,synthetic:true},
    {signal:controller.signal,onMetrics:r=>records.push(r)}));
  assert.equal(observed.aborted,true);assert.equal(calls,1);
  assert.equal(records.length,1);assert.equal(records[0].stopReason,'cancelled');
  assert.equal(JSON.stringify(records).includes(note),false);
});

test('pack Gateway: failed Jev request produces bounded metrics without provider error text',async t=>{
  let calls=0;const records=[];
  t.mock.method(globalThis,'fetch',async()=>{
    calls++;return Response.json({error:{message:'synthetic private provider detail'}},{status:500});
  });
  const classify=await createRemoteDecisionClassifier({env:environment});
  await assert.rejects(classify({id:'failed-jev',text:note,synthetic:true},{onMetrics:r=>records.push(r)}));
  assert.equal(calls,1);assert.equal(records[0].modelErrors,1);assert.equal(records[0].stopReason,'error');
  assert.equal(JSON.stringify(records).includes('private'),false);
});
