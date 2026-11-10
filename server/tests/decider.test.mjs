import test from 'node:test';
import assert from 'node:assert/strict';
import { sortKeysDeep, DECISION_CRITERIA, DECISION_INSTRUCTIONS } from '../prompts.mjs';
import { readGatewaySettings } from '../gateway-config.mjs';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';
import { SEMANTIC_LABELS } from '../decision-switch.mjs';
import { CLASSIFIER_CASES, setOf } from '../eval/dataset.mjs';

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
  assert.equal(readGatewaySettings({}).decisionMinConfidence, 0.9);
  assert.equal(readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: '0.8' }).decisionMinConfidence, 0.8);
  assert.throws(() => readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: '1.5' }), /MIN_CONFIDENCE/);
  assert.throws(() => readGatewaySettings({ TURNO_DECISION_MIN_CONFIDENCE: 'alto' }), /MIN_CONFIDENCE/);
});

test('el motor aplica el umbral configurado en modo DECISION', async () => {
  const run = threshold => analyzeAmbientEvent({
    event: { id: 'e1', type: 'note_saved', shiftId: 's1', synthetic: true },
    settings: readGatewaySettings({ TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'x', TURNO_DECISION_MODE: 'DECISION',
      TURNO_DECISION_MIN_CONFIDENCE: threshold }),
    isAuthorized: async () => true,
    getAuthorizedSnapshot: async () => ({ shiftId: 's1', synthetic: true, noteText: 'Falta reponer guantes.' }),
    classifyWithDecision: async () => ({ label: 'PROPOSE_TASK', confidence: 0.85 }),
  });
  assert.equal((await run('0.8')).status, 'proposed');
  assert.equal((await run('0.9')).status, 'abstain');
});
