import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';
import { createAgentServer } from '../http/server.mjs';
import { signRequest } from '../http/transport.mjs';

const text = 'Falta reponer guantes sintéticos.';
const raw = {action:{title:'Reponer guantes sintéticos',sourceQuote:'reponer guantes sintéticos'}};
const event = {id:'pack-event',type:'note_saved',shiftId:'pack-shift',synthetic:true,noteId:'note-1',noteVersion:1};
const snapshot = {shiftId:event.shiftId,synthetic:true,beds:[],drafts:[],notes:[{id:'note-1',version:1,text}],tasks:[]};
const settings = {enabled:true,syntheticOnly:true,decisionMode:'GATEWAY'};
const run = options => analyzeAmbientEvent({event,settings,isAuthorized:async()=>true,
  getAuthorizedSnapshot:async()=>structuredClone(snapshot),
  classifyWithGateway:async()=>({label:'PROPOSE_TASK'}),extractNoteProposal:async()=>raw,...options});

test('pack: caller cancellation signal reaches both model stages', async()=>{
  const c = new AbortController(); let classifierSignal, extractorSignal;
  const result = await run({signal:c.signal,
    classifyWithGateway:async(_input,options)=>{classifierSignal=options?.signal;return {label:'PROPOSE_TASK'};},
    extractNoteProposal:async(_text,options)=>{extractorSignal=options?.signal;return raw;}});
  assert.equal(result.status,'proposed');
  assert.equal(classifierSignal,c.signal);
  assert.equal(extractorSignal,c.signal);
});

test('pack: cancellation before processing invokes no model', async()=>{
  const c = new AbortController();c.abort();let calls=0;
  const result = await run({signal:c.signal,classifyWithGateway:async()=>{calls++;return {label:'PROPOSE_TASK'};}});
  assert.equal(calls,0);assert.equal(result.reason,'cancelled');
});

test('pack: cancellation between stages prevents new extraction', async()=>{
  const c = new AbortController();let extracted=0;
  const result = await run({signal:c.signal,classifyWithGateway:async()=>{c.abort();return {label:'PROPOSE_TASK'};},
    extractNoteProposal:async()=>{extracted++;return raw;}});
  assert.equal(extracted,0);assert.equal(result.reason,'cancelled');
});

test('pack: late extractor output cannot become a proposal', async()=>{
  const c = new AbortController();
  const result = await run({signal:c.signal,extractNoteProposal:async()=>{c.abort();return raw;}});
  assert.equal(result.status,'abstain');assert.equal(result.reason,'cancelled');assert.deepEqual(result.suggestions,[]);
});

async function start(options={}) {
  const secret=randomBytes(32).toString('hex'), logs=[];
  const server=createAgentServer({
    env:{VERCEL:'1',TURNO_AI_ENABLED:'1',TURNO_AGENT_SIGNING_SECRET:secret},
    getAuthorizedSnapshot:async()=>structuredClone(snapshot),
    classifyWithGateway:async()=>({label:'PROPOSE_TASK'}),proposeNote:async()=>raw,
    log:r=>logs.push(r),...options,
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=`http://127.0.0.1:${server.address().port}`;
  const send=async(payload,{signed=true,path='/v1/agent/events'}={})=>{
    const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
    const headers={'content-type':'application/json'};
    if(signed){headers['x-turno-timestamp']=timestamp;headers['x-turno-signature']=signRequest({secret,timestamp,method:'POST',path,body});}
    const response=await fetch(address+path,{method:'POST',headers,body,signal:AbortSignal.timeout(2000)});
    return {status:response.status,body:await response.json()};
  };
  return {send,logs,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}

test('pack E2E: signed request, proposal, replay, stale and unauthenticated boundaries',async()=>{
  let classified=0,extracted=0;
  const s=await start({classifyWithGateway:async()=>{classified++;return {label:'PROPOSE_TASK'};},proposeNote:async()=>{extracted++;return raw;}});
  try {
    assert.equal((await s.send(event,{signed:false})).status,401);
    const result=await s.send(event);
    assert.equal(result.body.status,'proposed');assert.equal(result.body.suggestions.length,1);
    assert.deepEqual(result.body.suggestions[0].actions,['review','dismiss']);assert.equal(result.body.suggestions[0].requiresApproval,true);
    assert.equal((await s.send(event)).status,401);
    assert.equal((await s.send({...event,id:'again'})).body.reason,'already_processed');
    assert.equal((await s.send({...event,id:'stale',noteVersion:2})).body.status,'stale');
    assert.equal(classified,1);assert.equal(extracted,1);
    assert.equal(JSON.stringify(s.logs).includes(text),false);
  } finally {await s.close();}
});

test('pack E2E: HTTP deadline cancels model work and never starts a late extractor',async()=>{
  let release,signal;let extracted=0;
  const s=await start({timeoutMs:50,classifyWithGateway:async(_input,options)=>{
    signal=options?.signal;return new Promise(resolve=>{release=resolve;});
  },proposeNote:async()=>{extracted++;return raw;}});
  try {
    const response=await s.send(event);
    assert.deepEqual(response.body,{status:'abstain',suggestions:[]});
    assert.ok(release,'classifier was entered');
    assert.equal(signal?.aborted,true);
    release({label:'PROPOSE_TASK'});await delay(10);
    assert.equal(extracted,0);
    const next=await s.send({id:'after-timeout',type:'drafts_ready',shiftId:event.shiftId,synthetic:true});
    assert.equal(next.body.reason,'no_suggestions');
  } finally {release?.({label:'NO_ACTION'});await delay(5);await s.close();}
});

test('pack E2E: metrics are allowlisted and never contain provider text',async()=>{
  const s=await start({classifyWithGateway:async(_input,options)=>{
    options?.onMetrics?.({modelCalls:1,inputTokens:8,outputTokens:2,stopReason:'endTurn',noteText:text,secret:'not-a-credential'});
    return {label:'PROPOSE_TASK'};
  }});
  try {
    const result=await s.send(event);assert.equal(result.body.status,'proposed');
    const metric=s.logs.find(r=>r.kind==='model_metrics');assert.ok(metric);
    assert.equal(metric.stage,'classification');assert.equal(metric.modelCalls,1);
    assert.equal(Object.hasOwn(metric,'noteText'),false);assert.equal(Object.hasOwn(metric,'secret'),false);
    assert.equal(JSON.stringify(s.logs).includes(text),false);
  } finally {await s.close();}
});


test('pack E2E: capture receives the HTTP deadline and discards late output',async()=>{
  let release,signal;
  const s=await start({timeoutMs:50,proposeCapture:async(_input,options)=>{
    signal=options.signal;return new Promise(resolve=>{release=resolve;});
  }});
  try{
    const result=await s.send({shiftId:event.shiftId,synthetic:true,text}, {path:'/v1/agent/capture'});
    assert.deepEqual(result.body,{status:'abstain',proposals:[]});assert.equal(signal?.aborted,true);
    release({status:'review_required',shiftId:event.shiftId,proposals:[]});await delay(10);
    const next=await s.send({id:'after-capture-timeout',type:'drafts_ready',shiftId:event.shiftId,synthetic:true});
    assert.equal(next.body.reason,'no_suggestions');
  }finally{release?.({status:'review_required',shiftId:event.shiftId,proposals:[]});await delay(5);await s.close();}
});
