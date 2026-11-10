import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIFIER_CASES, CAPTURE_CASES } from '../eval/dataset.mjs';
import { parseArgs, classifyError, scoreClassifier, scoreCapture, captureInvariants, percentile, callCost, effectiveDecisionLabel } from '../eval/run-eval.mjs';
import { setOf } from '../eval/dataset.mjs';
import { CLASSIFIER_PROMPT, CAPTURE_PROMPT } from '../prompts.mjs';

const LABELS = ['NO_ACTION', 'PROPOSE_TASK', 'PROPOSE_REMINDER', 'NEEDS_REVIEW'];

test('dataset: ids únicos, etiquetas válidas, textos dentro de límites', () => {
  const ids = [...CLASSIFIER_CASES, ...CAPTURE_CASES].map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of CLASSIFIER_CASES) {
    assert.ok(c.text.length >= 1 && c.text.length <= 500, c.id);
    assert.ok(LABELS.includes(c.strict) && c.accept.includes(c.strict), c.id);
    assert.ok(c.accept.every(l => LABELS.includes(l)), c.id);
    for (const m of c.mustNot ?? []) assert.equal(c.accept.includes(m), false, c.id);
  }
  for (const c of CAPTURE_CASES) assert.ok(c.text.length <= 2500 && typeof c.check === 'function', c.id);
});

test('argumentos: exige --live explícito y valida límites', () => {
  assert.equal(parseArgs([]).live, false);
  const o = parseArgs(['--live', '--models', 'a/b,c/d', '--reps', '3', '--min-balance', '3']);
  assert.deepEqual(o.models, ['a/b', 'c/d']);
  assert.throws(() => parseArgs(['--reps', '50']), /reps/);
  assert.throws(() => parseArgs(['--suites', 'chat']), /suites/);
  assert.throws(() => parseArgs(['--x']), /desconocido/);
  assert.equal(parseArgs(['--tag', 'despues']).tag, 'despues');
  assert.throws(() => parseArgs(['--tag', '../x']), /tag/);
});

test('errores: límite de solicitudes con espera, plan gratuito y tiempo', () => {
  const rl = classifyError(new Error('stream', { cause: Object.assign(new Error('Rate limit ... Retry after 44s.'), { name: 'GatewayRateLimitError' }) }));
  assert.deepEqual(rl, { type: 'rate_limit', retryAfterMs: 44000 });
  assert.equal(classifyError(new Error('Free tier users do not have access')).type, 'forbidden');
  assert.equal(classifyError(Object.assign(new Error('x'), { name: 'TimeoutError' })).type, 'timeout');
  assert.equal(classifyError(new Error('schema')).type, 'model_or_schema');
  assert.equal(classifyError(new Error('x', { cause: Object.assign(new Error('Model reached maximum token limit.'), { name: 'MaxTokensError' }) })).type, 'max_tokens');
});

test('puntaje del clasificador: aceptación, estricto, consistencia y prohibidas', () => {
  const s = scoreClassifier([
    { id: 'rem-01', rep: 1, label: 'PROPOSE_REMINDER', ms: 100 },
    { id: 'rem-01', rep: 2, label: 'PROPOSE_TASK', ms: 300 },
    { id: 'inj-02', rep: 1, label: 'PROPOSE_REMINDER', ms: 200 },
    { id: 'none-01', rep: 1, label: null, errorType: 'timeout', ms: 20000 },
  ]);
  assert.equal(s.calls, 4);
  assert.equal(s.errors, 1);
  assert.equal(s.acceptedRate, 0.25);
  assert.deepEqual(s.mustNotViolations, ['inj-02']);
  assert.equal(s.consistency, 0.667);
  assert.equal(s.confusion['PROPOSE_REMINDER -> PROPOSE_TASK'], 1);
});

test('captura: invariantes de revisión humana y puntaje', () => {
  const good = [{ status: 'requires_human_review', date: null, completed: false, beforeClose: true, time: null }];
  assert.ok(Object.values(captureInvariants(good)).every(Boolean));
  const bad = [{ status: 'saved', date: '2026-11-10', completed: true, beforeClose: true, time: '19:00' }];
  assert.ok(Object.values(captureInvariants(bad)).every(v => v === false));
  const s = scoreCapture([
    { id: 'cap-03', rep: 1, pass: true, criteria: { none: true }, invariants: captureInvariants([]), ms: 1 },
    { id: 'cap-03', rep: 2, pass: false, criteria: { none: false }, invariants: captureInvariants([]), ms: 3 },
  ]);
  assert.equal(s.passRate, 0.5);
  assert.deepEqual(s.failedCriteria, { 'cap-03:none': 1 });
});

test('casos de captura: criterios detectan respuestas incorrectas', () => {
  const cap01 = CAPTURE_CASES.find(c => c.id === 'cap-01');
  const wrongBed = [
    { title: 'A', time: '15:00', bedLabel: '4', beforeClose: false },
    { title: 'B', time: '15:00', bedLabel: '4', beforeClose: false },
    { title: 'Completar informe', time: null, bedLabel: null, beforeClose: true },
  ];
  assert.equal(cap01.check(wrongBed).bed4, false);
  assert.equal(CAPTURE_CASES.find(c => c.id === 'cap-03').check([]).none, true);
  assert.equal(percentile([5, 1, 3], 50), 3);
});

test('set de control: existe, es distinto y no aparece en las instrucciones', () => {
  const hold = [...CLASSIFIER_CASES, ...CAPTURE_CASES].filter(c => setOf(c) === 'holdout');
  assert.ok(hold.length >= 20);
  for (const c of hold) {
    // Ninguna nota de control se copió en las instrucciones (evita sobreajuste).
    assert.equal(CLASSIFIER_PROMPT.includes(c.text), false, c.id);
    assert.equal(CAPTURE_PROMPT.includes(c.text), false, c.id);
  }
  assert.deepEqual(parseArgs(['--set', 'holdout']).set, 'holdout');
  assert.throws(() => parseArgs(['--set', 'test']), /set/);
});

test('costo por llamada con el precio público del modelo', () => {
  assert.equal(callCost({ inputTokens: 1000, outputTokens: 500 }, { input: 0.0000004, output: 0.0000016 }), 0.0012);
  assert.equal(callCost(null, { input: 1, output: 1 }), null);
  assert.equal(callCost({ inputTokens: 1, outputTokens: 1 }, null), null);
});

test('modelo de decisión: bajo el umbral el agente se abstiene', () => {
  assert.equal(effectiveDecisionLabel({ label: 'PROPOSE_TASK', confidence: 0.99 }), 'PROPOSE_TASK');
  assert.equal(effectiveDecisionLabel({ label: 'PROPOSE_REMINDER', confidence: 0.5 }), 'NO_ACTION');
  assert.equal(effectiveDecisionLabel({ label: 'PROPOSE_TASK', confidence: null }), 'NO_ACTION');
  assert.equal(effectiveDecisionLabel({}), null);
  assert.deepEqual(parseArgs(['--suites', 'decision']).suites, ['decision']);
  assert.deepEqual(parseArgs(['--suites', 'dual', '--decider', 'liquid/d1']).decider, 'liquid/d1');
});
