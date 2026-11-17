// CEDAR-NULL: structured outputs containing JSON null must survive Cedar, and Cedar must still deny.
// Only the remote AI Gateway is mocked (globalThis.fetch). No live model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as sdk from '@strands-agents/sdk';
import {CedarAuthorization} from '@strands-agents/sdk/vended-interventions/cedar';
import * as extensions from '../strands-extensions.mjs';
import * as noteProposal from '../note-proposal.mjs';
import {createStrandsCapture} from '../gateway-capture.mjs';
import {analyzeAmbientEvent} from '../ambient-engine.mjs';
import {attachLifecycleMetrics, sanitizeModelMetrics} from '../strands-runtime.mjs';
import {runNoteEval, createLiveClients, buildNoteInput} from '../eval/run-note-eval.mjs';
import {NOTE_CORPUS} from '../eval/note-corpus.mjs';

const env = {TURNO_AI_ENABLED:'1', TURNO_SYNTHETIC_ONLY:'1', TURNO_AI_PROVIDER:'vercel',
  TURNO_AI_MODEL_ID:'anthropic/claude-haiku-5.5', AI_GATEWAY_API_KEY:'placeholder-not-a-secret-key-1234'};
const policies = readFileSync(new URL('../policies/turno-readonly.cedar', import.meta.url), 'utf8');
const note = 'Falta reponer guantes sintéticos del carro de la sala 2.';

// ---- Mocked AI Gateway (SSE, AI SDK stream parts) -------------------------------------------
const usage = {inputTokens:{total:12,noCache:12,cacheRead:0,cacheWrite:0}, outputTokens:{total:7,text:7,reasoning:0}};
function sse(parts) {
  return new Response(parts.map(x => 'data: ' + JSON.stringify(x) + '\n\n').join(''),
    {headers:{'content-type':'text/event-stream'}});
}
const structuredReply = output => sse([{type:'stream-start',warnings:[]},
  {type:'tool-call',toolCallId:'synthetic-call',toolName:'strands_structured_output',input:JSON.stringify(output)},
  {type:'finish',finishReason:{unified:'tool-calls',raw:'tool_use'},usage}]);
const textReply = text => sse([{type:'stream-start',warnings:[]},
  {type:'text-start',id:'t1'}, {type:'text-delta',id:'t1',delta:text}, {type:'text-end',id:'t1'},
  {type:'finish',finishReason:{unified:'stop',raw:'end_turn'},usage}]);
function mockGateway(t, replies) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'ai-gateway.vercel.sh');
    calls.push({body: JSON.parse(init.body)});
    const next = replies[Math.min(calls.length - 1, replies.length - 1)];
    return next();
  });
  return calls;
}

// ---- a. Note extractor and ambient path with {action:null} --------------------------------------
test('a: note extractor resolves the null abstention from a real Strands tool call', async t => {
  const calls = mockGateway(t, [() => structuredReply({action:null})]);
  const extract = await noteProposal.createStrandsNoteExtractor({env});
  assert.deepEqual(await extract(note), {action:null});
  assert.equal(calls.length, 1);
});

test('a: ambient analysis reports no_proposal, not extraction_failed, for a null abstention', async t => {
  mockGateway(t, [() => structuredReply({action:null})]);
  const extract = await noteProposal.createStrandsNoteExtractor({env});
  const result = await analyzeAmbientEvent({
    event:{id:'event-null', type:'note_saved', shiftId:'shift-null', synthetic:true, noteId:'note-null', noteVersion:1},
    settings:{enabled:true, syntheticOnly:true, decisionMode:'GATEWAY'},
    isAuthorized: async () => true,
    getAuthorizedSnapshot: async () => ({shiftId:'shift-null', synthetic:true, beds:[], drafts:[], tasks:[],
      notes:[{id:'note-null', version:1, text:note}]}),
    classifyWithGateway: async () => ({label:'PROPOSE_TASK'}),
    extractNoteProposal: extract,
  });
  assert.deepEqual(result, {status:'abstain', reason:'no_proposal', suggestions:[]});
});

// ---- b. Text on turn 1, forced structured call on turn 2 ----------------------------------------
test('b: text on turn 1 then forced structured null on turn 2 resolves {action:null} with two model calls', async t => {
  const calls = mockGateway(t, [() => textReply('Nada que extraer.'), () => structuredReply({action:null})]);
  const extract = await noteProposal.createStrandsNoteExtractor({env});
  assert.deepEqual(await extract(note), {action:null});
  assert.equal(calls.length, 2);
  const forced = JSON.stringify(calls[1].body.toolChoice ?? null);
  assert.ok(forced.includes('strands_structured_output'), 'second call must force strands_structured_output: ' + forced);
});

test('b: note extraction limits allow one forced structured retry and are exported', () => {
  assert.deepEqual(noteProposal.NOTE_LIMITS, {turns:2, structuredOutputAttempts:2,
    outputTokens:2 * noteProposal.NOTE_OUTPUT_TOKENS, totalTokens:5000});
  assert.equal(noteProposal.NOTE_OUTPUT_TOKENS, 1200);
});

// ---- c. Capture with null bedLabel and time --------------------------------------------------------
test('c: capture keeps null bedLabel and time and returns review_required', async t => {
  mockGateway(t, [() => structuredReply({proposals:[{title:'Reponer guantes', bedLabel:null, time:null, beforeClose:false}]})]);
  const capture = await createStrandsCapture({env});
  const result = await capture({text:'Reponer guantes', shiftId:'demo-shift', synthetic:true},
    {isAuthorized: async () => true, beds: []});
  assert.equal(result.status, 'review_required');
  const proposal = JSON.stringify(result).includes('"bedLabel":null') && JSON.stringify(result).includes('"time":null');
  assert.ok(proposal, 'nulls must be preserved in the returned proposal: ' + JSON.stringify(result).slice(0, 300));
});

// ---- d. Cedar still denies -------------------------------------------------------------------------
function nullSafeCedar() {
  return new extensions.NullSafeCedarAuthorization({policies, principal:{type:'User', id:'turno-synthetic-agent'},
    contextEnricher: () => ({synthetic:true, review_only:true, stage:'extraction', context_ready:true}), onError:'deny'});
}
const fakeEvent = (name, input, agent = {appState: new Map()}) =>
  ({agent, invocationState:{}, toolUse:{name, input, toolUseId:'test'}});

test('d: NullSafeCedarAuthorization is the real CedarAuthorization subclass used by the pack', () => {
  const ex = extensions.createTurnoExtensions({stage:'extraction'});
  assert.ok(ex.interventions[0] instanceof extensions.NullSafeCedarAuthorization);
  assert.ok(ex.interventions[0] instanceof CedarAuthorization);
});

test('d: a tool other than strands_structured_output is denied even with null input', () => {
  const result = nullSafeCedar().beforeToolCall(fakeEvent('shell_exec', {cmd:null}));
  assert.equal(result.type, 'deny');
});

test('d: the structured output tool with null input is allowed once', () => {
  const cedar = nullSafeCedar();
  const agent = {appState: new Map()};
  assert.equal(cedar.beforeToolCall(fakeEvent('strands_structured_output', {action:null}, agent)).type, 'proceed');
});

test('d: policy call_count == 1 still denies a second structured output call in the same invocation', () => {
  const cedar = nullSafeCedar();
  const agent = {appState: new Map()};
  assert.equal(cedar.beforeToolCall(fakeEvent('strands_structured_output', {action:null}, agent)).type, 'proceed');
  assert.equal(cedar.beforeToolCall(fakeEvent('strands_structured_output', {action:null}, agent)).type, 'deny');
});

test('d: the caller event and real tool input are not changed by the Cedar view', () => {
  const cedar = nullSafeCedar();
  const event = fakeEvent('strands_structured_output', {action:null, nested:{x:null}});
  cedar.beforeToolCall(event);
  assert.deepEqual(event.toolUse.input, {action:null, nested:{x:null}});
});

// ---- e. cedarSafeInput -------------------------------------------------------------------------
test('e: cedarSafeInput drops null and undefined object keys at any depth', () => {
  assert.deepEqual(extensions.cedarSafeInput({a:null, b:{c:null, d:1, e:{f:undefined, g:'x'}}, h:undefined}),
    {b:{d:1, e:{g:'x'}}});
});

test('e: cedarSafeInput drops null array items and keeps other arrays intact', () => {
  assert.deepEqual(extensions.cedarSafeInput({list:[null, 1, {k:null, z:0}, [null, false]]}),
    {list:[1, {z:0}, [false]]});
});

test('e: cedarSafeInput keeps falsy non-null values and never mutates its input', () => {
  const original = {zero:0, empty:'', no:false, nil:null, arr:[null, '']};
  const snapshot = structuredClone(original);
  const out = extensions.cedarSafeInput(original);
  assert.deepEqual(out, {zero:0, empty:'', no:false, arr:['']});
  assert.deepEqual(original, snapshot);
  assert.notEqual(out, original);
});

// ---- f. Diagnostics -------------------------------------------------------------------------------
class OfflineModel extends sdk.Model {
  getConfig(){return {modelId:'turno-offline-test'};}
  updateConfig(){}
  async *stream(){
    yield new sdk.ModelMessageStartEvent({role:'assistant'});
    yield new sdk.ModelContentBlockStartEvent({});
    yield new sdk.ModelContentBlockDeltaEvent({delta:{type:'textDelta',text:'synthetic response'}});
    yield new sdk.ModelContentBlockStopEvent({});
    yield new sdk.ModelMessageStopEvent({stopReason:'endTurn'});
    yield new sdk.ModelMetadataEvent({usage:{inputTokens:5,outputTokens:2,totalTokens:7}});
  }
}

test('f: metrics record includes structuredOutputPresent as a boolean', async () => {
  const agent = new sdk.Agent({model:new OfflineModel(), tools:[], printer:false});
  const records = [];
  const observer = attachLifecycleMetrics(agent, sdk, r => records.push(r));
  try {
    const result = await agent.invoke('synthetic input');
    observer.finish(result);
    assert.equal(records[0].structuredOutputPresent, false);
    assert.equal(typeof records[0].structuredOutputPresent, 'boolean');
  } finally { await agent.shutdown(); }
});

test('f: structuredOutputPresent is true only when the result carries structured output', () => {
  const agent = {addHook: () => () => {}};
  const records = [];
  const observer = attachLifecycleMetrics(agent, {BeforeModelCallEvent:class{}, AfterModelCallEvent:class{}},
    r => records.push(r));
  observer.finish({stopReason:'toolUse', structuredOutput:{action:null}});
  assert.equal(records[0].structuredOutputPresent, true);
  assert.equal(sanitizeModelMetrics({stopReason:'endTurn', structuredOutputPresent:'yes'}).structuredOutputPresent, false);
  assert.equal(sanitizeModelMetrics({structuredOutputPresent:true}).structuredOutputPresent, true);
});

test('f: eval extract call records carry stopReason, turns and structuredOutputPresent', async t => {
  mockGateway(t, [() => structuredReply({action:null})]);
  const tokenSink = [];
  const clients = await createLiveClients({env, mode:'GATEWAY', tokenSink});
  clients.classifyWithGateway = async () => ({label:'PROPOSE_TASK'});
  const c = NOTE_CORPUS.find(x => x.group === 'task');
  const settings = {enabled:true, syntheticOnly:true, decisionMode:'GATEWAY'};
  const report = await runNoteEval({cases:[c], clients, tokenSink, settings, run:'live', mode:'GATEWAY'});
  assert.equal(report.cases[0].reason, 'no_proposal', JSON.stringify(report.cases[0]).slice(0, 300));
  const extract = report.cases[0].calls.find(x => x.kind === 'extract');
  assert.ok(extract, 'extract entry present');
  assert.equal(extract.stopReason, 'toolUse');
  assert.equal(extract.turns, 1);
  assert.equal(extract.structuredOutputPresent, true);
  const gateway = report.cases[0].calls.find(x => x.kind === 'gateway');
  assert.equal(Object.hasOwn(gateway, 'stopReason'), false, 'diagnostics are extract-only');
  assert.ok(buildNoteInput(c));
});
