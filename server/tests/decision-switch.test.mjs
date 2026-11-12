import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySignal, readDecisionMode } from '../decision-switch.mjs';

const event = Object.freeze({id:'synthetic-event-1',text:'Recuérdame completar el informe'});
const llm = async () => ({label:'PROPOSE_REMINDER'});
const decider = async () => ({label:'PROPOSE_REMINDER',confidence:0.95});

test('defaults to Gateway and rejects unknown mode', () => {
  assert.equal(readDecisionMode({}), 'GATEWAY');
  assert.equal(readDecisionMode({ TURNO_DECISION_MODE: ' dual ' }), 'DUAL');
  assert.throws(() => readDecisionMode({TURNO_DECISION_MODE:'UNKNOWN'}), /TURNO_DECISION_MODE/);
});

test('Gateway mode does not invoke Decision or write', async () => {
  const actual = await classifySignal({event,mode:'GATEWAY',classifyWithGateway:llm,classifyWithDecision:()=>{throw new Error('called shadow!')}});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(actual.status,'candidate');
});

test('DUAL compares both but returns only Gateway active result', async () => {
  const records = [];
  const actual = await classifySignal({event,mode:'DUAL',classifyWithGateway:llm,classifyWithDecision:async()=>({label:'PROPOSE_TASK',confidence:0.96}),recordComparison:x=>records.push(x)});
  assert.equal(actual.source,'GATEWAY');
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(records.length,1);
  assert.equal(records[0].agree,false);
  assert.equal(JSON.stringify(records[0]).includes(event.text),false);
});

test('DUAL shadow failure does not change Gateway result', async () => {
  const actual = await classifySignal({event,mode:'DUAL',classifyWithGateway:llm,classifyWithDecision:async()=>{throw new Error('offline')},recordComparison:()=>{throw new Error('telemetry offline')}});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal(actual.source,'GATEWAY');
});

test('DECISION mode accepts only calibrated-score-shaped candidate', async () => {
  const actual = await classifySignal({event,mode:'DECISION',classifyWithDecision:decider});
  assert.equal(actual.status,'candidate');
  assert.equal(actual.confidence,0.95);
});

test('DECISION abstains when confidence is too low', async () => {
  const actual = await classifySignal({event,mode:'DECISION',classifyWithDecision:async()=>({label:'PROPOSE_TASK',confidence:0.55})});
  assert.equal(actual.status,'abstain');
});

test('DECISION rejects output with absent confidence', async () => {
  const actual = await classifySignal({event,mode:'DECISION',classifyWithDecision:async()=>({label:'PROPOSE_TASK'})});
  assert.equal(actual.status,'abstain');
});

test('Unknown model output cannot become a candidate', async () => {
  const actual = await classifySignal({event,mode:'GATEWAY',classifyWithGateway:async()=>({label:'DELETE_ALL_TASKS'})});
  assert.equal(actual.status,'abstain');
});

test('Invalid threshold and event are rejected', async () => {
  await assert.rejects(classifySignal({event:{},classifyWithGateway:llm}),/id estable/);
  await assert.rejects(classifySignal({event,classifyWithGateway:llm,minConfidence:2}),/Umbral/);
});

// P1-03: un fallo del clasificador ACTIVO queda marcado (failed:true); un fallo de sombra o una baja confianza no.
const boom = async () => { throw new Error('offline'); };
test('P1-03: GATEWAY que lanza → failed:true, status abstain, label NO_ACTION', async () => {
  const actual = await classifySignal({event,mode:'GATEWAY',classifyWithGateway:boom,classifyWithDecision:boom});
  assert.deepEqual(actual, {source:'GATEWAY',status:'abstain',label:'NO_ACTION',failed:true});
});

test('P1-03: DECISION que lanza → failed:true', async () => {
  const actual = await classifySignal({event,mode:'DECISION',classifyWithGateway:boom,classifyWithDecision:boom});
  assert.deepEqual(actual, {source:'DECISION',status:'abstain',label:'NO_ACTION',failed:true});
});

test('P1-03: DUAL con Gateway activo caído → failed:true aunque Decision responda', async () => {
  const actual = await classifySignal({event,mode:'DUAL',classifyWithGateway:boom,classifyWithDecision:decider,recordComparison:()=>{}});
  assert.equal(actual.source,'GATEWAY');
  assert.equal(actual.status,'abstain');
  assert.equal(actual.failed,true);
});

test('P1-03: DUAL con sombra caída no marca el resultado activo como fallido', async () => {
  const actual = await classifySignal({event,mode:'DUAL',classifyWithGateway:llm,classifyWithDecision:boom,recordComparison:()=>{}});
  assert.equal(actual.label,'PROPOSE_REMINDER');
  assert.equal('failed' in actual, false);
});

test('P1-03: salida de baja confianza o inválida NO es fallo (no se marca failed)', async () => {
  const low = await classifySignal({event,mode:'DECISION',classifyWithGateway:llm,classifyWithDecision:async()=>({label:'PROPOSE_TASK',confidence:0.5})});
  assert.equal(low.status,'abstain');
  assert.equal('failed' in low, false);
  const invalid = await classifySignal({event,mode:'GATEWAY',classifyWithGateway:async()=>({label:'NO_SUCH'}),classifyWithDecision:llm});
  assert.equal('failed' in invalid, false);
});
