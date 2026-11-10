import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySignal, readDecisionMode } from '../decision-switch.mjs';

const event = Object.freeze({id:'synthetic-event-1',text:'Recuérdame completar el informe'});
const llm = async () => ({label:'PROPOSE_REMINDER'});
const decider = async () => ({label:'PROPOSE_REMINDER',confidence:0.95});

test('defaults to OpenCode and rejects unknown mode', () => {
  assert.equal(readDecisionMode({}), 'OPENCODE');
  assert.equal(readDecisionMode({ TURNO_DECISION_MODE: ' dual ' }), 'DUAL');
  assert.throws(() => readDecisionMode({TURNO_DECISION_MODE:'UNKNOWN'}), /TURNO_DECISION_MODE/);
});

test('OpenCode mode does not invoke Decider or write', async () => {
  const actual = await classifySignal({event,mode:'OPENCODE',classifyWithOpenCode:llm,classifyWithDecider:()=>{throw new Error('called shadow!')}});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(actual.status,'candidate');
});

test('DUAL compares both but returns only OpenCode active result', async () => {
  const records = [];
  const actual = await classifySignal({event,mode:'DUAL',classifyWithOpenCode:llm,classifyWithDecider:async()=>({label:'PROPOSE_TASK',confidence:0.96}),recordComparison:x=>records.push(x)});
  assert.equal(actual.source,'OPENCODE');
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(records.length,1);
  assert.equal(records[0].agree,false);
  assert.equal(JSON.stringify(records[0]).includes(event.text),false);
});

test('DUAL shadow failure does not change OpenCode result', async () => {
  const actual = await classifySignal({event,mode:'DUAL',classifyWithOpenCode:llm,classifyWithDecider:async()=>{throw new Error('offline')},recordComparison:()=>{throw new Error('telemetry offline')}});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(actual.source,'OPENCODE');
});

test('DECIDER mode accepts only calibrated-score-shaped candidate', async () => {
  const actual = await classifySignal({event,mode:'DECIDER',classifyWithDecider:decider});
  assert.equal(actual.status,'candidate');
  assert.equal(actual.confidence,0.95);
});

test('DECIDER abstains when confidence is too low', async () => {
  const actual = await classifySignal({event,mode:'DECIDER',classifyWithDecider:async()=>({label:'PROPOSE_TASK',confidence:0.55})});
  assert.equal(actual.status,'abstain');
});

test('DECIDER rejects output with absent confidence', async () => {
  const actual = await classifySignal({event,mode:'DECIDER',classifyWithDecider:async()=>({label:'PROPOSE_TASK'})});
  assert.equal(actual.status,'abstain');
});

test('Unknown model output cannot become a candidate', async () => {
  const actual = await classifySignal({event,mode:'OPENCODE',classifyWithOpenCode:async()=>({label:'DELETE_ALL_TASKS'})});
  assert.equal(actual.status,'abstain');
});

test('Invalid threshold and event are rejected', async () => {
  await assert.rejects(classifySignal({event:{},classifyWithOpenCode:llm}),/id estable/);
  await assert.rejects(classifySignal({event,classifyWithOpenCode:llm,minConfidence:2}),/Umbral/);
});
