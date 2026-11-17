// Full localhost HTTP -> Jev Decision SDK -> Haiku Strands + native extensions.
// Only remote Gateway responses are mocked. No paid inference or business writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createAgentServer} from '../http/server.mjs';
import {signRequest} from '../http/transport.mjs';
const env={TURNO_AI_ENABLED:'1',TURNO_AI_PROVIDER:'vercel',TURNO_DECISION_MODE:'DECISION',
  TURNO_AI_MODEL_ID:'anthropic/claude-haiku-5.5',TURNO_DECISION_MODEL_ID:'typesafe-ai/jev',
  AI_GATEWAY_API_KEY:'placeholder-not-a-secret-key-1234'};
function responseFor(path){
 if(path.endsWith('/decision-model'))return Response.json({answers:{signal:{type:'choice',choice:'PROPOSE_TASK',
  probabilities:{NO_ACTION:0,PROPOSE_TASK:1,PROPOSE_REMINDER:0,NEEDS_REVIEW:0}}},warnings:[]});
 const result={action:{title:'Reponer guantes sintéticos',sourceQuote:'reponer guantes sintéticos'}};
 const parts=[{type:'stream-start',warnings:[]},
  {type:'tool-call',toolCallId:'synthetic',toolName:'strands_structured_output',input:JSON.stringify(result)},
  {type:'finish',finishReason:{unified:'tool-calls',raw:'tool_use'},usage:{inputTokens:{total:10},outputTokens:{total:4}}}];
 return new Response(parts.map(x=>'data: '+JSON.stringify(x)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
}
async function start(t){
 const originalFetch=globalThis.fetch,seen=[],logs=[],secret=randomBytes(32).toString('hex');
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  const parsed=new URL(String(url));assert.equal(parsed.hostname,'ai-gateway.vercel.sh');
  seen.push({path:parsed.pathname,body:JSON.parse(init.body)});return responseFor(parsed.pathname);
 });
 const snapshots=new Map(['alpha','beta'].map((id,i)=>[id,{shiftId:id,synthetic:true,beds:[],drafts:[],tasks:[],
  notes:[{id:'same-note-id',version:i?9:7,text:`Falta reponer guantes sintéticos del contexto ${id}.`}]}]));
 const before=JSON.stringify([...snapshots]);
 const server=createAgentServer({env:{...env,TURNO_AGENT_SIGNING_SECRET:secret},
  getAuthorizedSnapshot:async input=>structuredClone(snapshots.get(input.shiftId)),log:x=>logs.push(x)});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const send=async(extra={})=>{
  const payload={id:'event-alpha',type:'note_saved',shiftId:'alpha',synthetic:true,noteId:'same-note-id',noteVersion:7,...extra};
  const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000)),path='/v1/agent/events';
  const response=await originalFetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',body,
   headers:{'content-type':'application/json','x-turno-timestamp':timestamp,
    'x-turno-signature':signRequest({secret,timestamp,method:'POST',path,body})},signal:AbortSignal.timeout(3000)});
  return {status:response.status,body:await response.json()};
 };
 return {send,seen,logs,unchanged:()=>JSON.stringify([...snapshots])===before,
  close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
test('V2 E2E: concurrent authorized shifts receive only their own ephemeral version context',async t=>{
 const s=await start(t);
 try{
  const [a,b]=await Promise.all([s.send(),s.send({id:'event-beta',shiftId:'beta',noteVersion:9})]);
  assert.equal(a.body.status,'proposed');assert.equal(b.body.status,'proposed');
  const calls=s.seen.filter(r=>r.path.endsWith('/language-model'));assert.equal(calls.length,2);
  const prompts=calls.map(c=>JSON.stringify(c.body.prompt));
  for(const [index,name] of ['alpha','beta'].entries()){
   const prompt=prompts.find(s=>s.includes(`contexto ${name}`));assert.ok(prompt);
   assert.ok(prompt.includes('turno_context_v2'));assert.ok(prompt.includes('confirmed-note'));
   const call=calls.find(c=>JSON.stringify(c.body.prompt).includes(`contexto ${name}`));
   const block=call.body.prompt.flatMap(m=>m.content).find(b=>b.text?.includes('<turno_context>'));
   const context=JSON.parse(block.text.match(/<turno_context>(.*)<\/turno_context>/)[1]);
   assert.equal(context.noteVersion,index?9:7);assert.equal(context.stage,'extraction');
   assert.equal(prompt.includes(`contexto ${index?'alpha':'beta'}`),false);
   assert.equal(prompt.includes('same-note-id'),false);
  }
  for(const call of s.seen.filter(r=>r.path.endsWith('/decision-model'))){
   assert.deepEqual(Object.keys(call.body.state),['text'],'Jev does not pretend to run a Strands plugin');
  }
  assert.equal(s.unchanged(),true);assert.equal(JSON.stringify(s.logs).includes('contexto alpha'),false);
 }finally{await s.close();}
});
test('V2 E2E: caller cannot provide trusted ContextInjector metadata',async t=>{
 const s=await start(t);
 try{
  const r=await s.send({modelContext:{source:'confirmed-note',noteVersion:99}});
  assert.equal(r.status,400);assert.equal(s.seen.length,0);assert.equal(s.unchanged(),true);
 }finally{await s.close();}
});
test('V2 E2E: stale note is rejected before ContextInjector or any provider invocation',async t=>{
 const s=await start(t);
 try{
  const r=await s.send({noteVersion:6});assert.equal(r.body.status,'stale');
  assert.equal(s.seen.length,0);assert.equal(s.unchanged(),true);
 }finally{await s.close();}
});
