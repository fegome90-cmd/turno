import test from 'node:test';
import assert from 'node:assert/strict';
import { sortKeysDeep, DECISION_CRITERIA, DECISION_INSTRUCTIONS } from '../prompts.mjs';
import { readGatewaySettings } from '../gateway-config.mjs';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';
import { SEMANTIC_LABELS } from '../decision-switch.mjs';
import { decisionConfidence } from '../decision-provider.mjs';
import { CLASSIFIER_CASES, setOf } from '../eval/dataset.mjs';

test('Jev: probabilidad de etiqueta y confianza TypeSafe por separado; el umbral sigue usando la probabilidad', () => {
  const answer = { choice: 'PROPOSE_TASK', probabilities: { PROPOSE_TASK: 0.91, NEEDS_REVIEW: 0.09 } };
  assert.deepEqual(decisionConfidence(answer, { typesafe: { confidence: { signal: 0.68 } } }),
    { confidence: 0.91, labelProbability: 0.91, typesafeConfidence: 0.68 });
  assert.deepEqual(decisionConfidence(answer, undefined),
    { confidence: 0.91, labelProbability: 0.91, typesafeConfidence: null });
  assert.deepEqual(decisionConfidence({ choice: 'PROPOSE_TASK', probabilities: {} }, { typesafe: { confidence: { signal: 0 } } }),
    { confidence: null, labelProbability: null, typesafeConfidence: 0 });
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -0.1, 1.5, '0.7', null]) {
    assert.equal(decisionConfidence(answer, { typesafe: { confidence: { signal: bad } } }).typesafeConfidence, null, String(bad));
  }
  // Un campo «confidence» dentro de la respuesta NO es la confianza de TypeSafe.
  assert.equal(decisionConfidence({ ...answer, confidence: 0.5 }, undefined).typesafeConfidence, null);
});

test('Jev por el camino real del Gateway: confidence en answers se descarta; providerMetadata llega', async t => {
  const { createRemoteDecisionClassifier } = await import('../decision-provider.mjs');
  let body = null;
  t.mock.method(globalThis, 'fetch', async url => {
    if (!String(url).endsWith('/decision-model')) throw new Error('solo se espera la Decision API');
    return Response.json(body);
  });
  const env = { TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'vercel', TURNO_DECISION_MODE: 'DECISION',
    TURNO_AI_MODEL_ID: 'anthropic/claude-haiku-5.5', TURNO_DECISION_MODEL_ID: 'typesafe-ai/jev',
    AI_GATEWAY_API_KEY: 'placeholder-not-a-secret-key-1234' };
  const classify = await createRemoteDecisionClassifier({ env });
  const event = { id: 'jev-meta-01', text: 'Falta reponer guantes sintéticos.', synthetic: true };
  body = { answers: { signal: { type: 'choice', choice: 'PROPOSE_TASK', confidence: 0.5,
    probabilities: { NO_ACTION: 0.03, PROPOSE_TASK: 0.91, PROPOSE_REMINDER: 0.02, NEEDS_REVIEW: 0.04 } } },
    providerMetadata: { typesafe: { confidence: { signal: 0.68 } } }, warnings: [] };
  assert.deepEqual(await classify(event),
    { label: 'PROPOSE_TASK', confidence: 0.91, labelProbability: 0.91, typesafeConfidence: 0.68 });
  body = { answers: { signal: { type: 'choice', choice: 'PROPOSE_TASK', confidence: 0.5,
    probabilities: { NO_ACTION: 0.03, PROPOSE_TASK: 0.91, PROPOSE_REMINDER: 0.02, NEEDS_REVIEW: 0.04 } } }, warnings: [] };
  assert.deepEqual(await classify(event),
    { label: 'PROPOSE_TASK', confidence: 0.91, labelProbability: 0.91, typesafeConfidence: null },
    'sin providerMetadata no hay confianza TypeSafe, aunque la respuesta traiga «confidence»');
});

test('claves ordenadas a todo nivel (el orden cambió probabilidades en el blog)', () => {
  const out = sortKeysDeep({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 2 } });
  assert.equal(JSON.stringify(out), '{"a":{"c":2,"d":[{"y":2,"z":1}]},"b":1}');
});

test('un criterio por etiqueta, con NO_ACTION como opción «ninguna»', () => {
  assert.deepEqual(Object.keys(DECISION_CRITERIA).sort(), [...SEMANTIC_LABELS].sort());
  for (const text of Object.values(DECISION_CRITERIA)) {
    const sentences = text.split(/\. /).length;
    assert.ok(sentences <= 2, text);
  }
  assert.match(DECISION_CRITERIA.NO_ACTION, /^Ninguna de las anteriores/);
  for (const c of CLASSIFIER_CASES.filter(x => setOf(x) === 'holdout')) {
    assert.equal(JSON.stringify(DECISION_CRITERIA).includes(c.text), false, c.id);
    assert.equal(DECISION_INSTRUCTIONS.includes(c.text), false, c.id);
  }
});

test('umbral configurable y validado', () => {
  assert.equal(readGatewaySettings({}).decisionMinConfidence, 0); // ajustado con la corrida DUAL
  assert.equal(readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: '0.8' }).decisionMinConfidence, 0.8);
  assert.throws(() => readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: '1.5' }), /MIN_CONFIDENCE/);
  assert.throws(() => readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: 'alto' }), /MIN_CONFIDENCE/);
});

test('el motor aplica el umbral configurado en modo DECISION', async () => {
  const run = threshold => analyzeAmbientEvent({
    event: { id: 'e1', type: 'note_saved', shiftId: 's1', synthetic: true, noteId: 'n1', noteVersion: 1 },
    settings: readGatewaySettings({ TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'x', TURNO_DECISION_MODE: 'DECISION',
      TURNO_DECISION_MIN_CONFIDENCE: threshold }),
    isAuthorized: async () => true,
    getAuthorizedSnapshot: async () => ({ shiftId: 's1', synthetic: true, tasks: [],
      notes: [{ id: 'n1', version: 1, text: 'Falta reponer guantes.' }] }),
    classifyWithDecision: async () => ({ label: 'PROPOSE_TASK', confidence: 0.85 }),
    extractNoteProposal: async () => ({ action: { title: 'Reponer guantes', sourceQuote: 'Falta reponer guantes' } }),
  });
  assert.equal((await run('0.8')).status, 'proposed');
  assert.equal((await run('0.9')).reason, 'classifier_abstain');
});

test('DUAL y DECISION exigen credencial del Gateway aunque el LLM use otro proveedor', () => {
  const base = { TURNO_AI_ENABLED: '1', TURNO_AI_PROVIDER: 'openai', OPENAI_API_KEY: 'x' };
  // Solo el LLM: basta la clave del proveedor elegido.
  assert.equal(readGatewaySettings({ ...base, TURNO_DECISION_MODE: 'GATEWAY' }).decisionAuthMode, null);
  for (const mode of ['DUAL', 'DECISION']) {
    assert.throws(() => readGatewaySettings({ ...base, TURNO_DECISION_MODE: mode }), /AI_GATEWAY_API_KEY/);
    assert.equal(readGatewaySettings({ ...base, TURNO_DECISION_MODE: mode, AI_GATEWAY_API_KEY: 'y' }).decisionAuthMode, 'api-key');
    assert.equal(readGatewaySettings({ ...base, TURNO_DECISION_MODE: mode, VERCEL: '1' }).decisionAuthMode, 'oidc');
  }
  // Apagado no exige nada.
  assert.doesNotThrow(() => readGatewaySettings({ TURNO_AI_PROVIDER: 'openai', TURNO_DECISION_MODE: 'DECISION' }));
});
