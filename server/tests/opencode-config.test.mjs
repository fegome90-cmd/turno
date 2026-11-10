import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpenCodeSettings } from '../opencode-config.mjs';

const base = {
  OPENCODE_API_KEY: 'fictitious-test-token',
  OPENCODE_MODE: 'zen',
  OPENCODE_MODEL_ID: 'glm-5.3',
};

test('rechaza ausencia de API key sin imprimirla', () => {
  assert.throws(() => readOpenCodeSettings({ ...base, OPENCODE_API_KEY: '' }), /OPENCODE_API_KEY/);
});

test('la configuración expuesta nunca incluye la API key', () => {
  const settings = readOpenCodeSettings(base);
  assert.deepEqual(settings, { mode: 'zen', modelId: 'glm-5.3' });
  assert.equal(JSON.stringify(settings).includes(base.OPENCODE_API_KEY), false);
  assert.equal(Object.isFrozen(settings), true);
});

test('rechaza espacios accidentales en la clave', () => {
  assert.throws(() => readOpenCodeSettings({ ...base, OPENCODE_API_KEY: ' fictitious-test-token ' }), /OPENCODE_API_KEY/);
});

test('rechaza modo o modelo inválido', () => {
  assert.throws(() => readOpenCodeSettings({ ...base, OPENCODE_MODE: 'other' }), /OPENCODE_MODE/);
  assert.throws(() => readOpenCodeSettings({ ...base, OPENCODE_MODEL_ID: '' }), /OPENCODE_MODEL_ID/);
});

test('OpenCode Go no expone un sessionId global desde el entorno', () => {
  const settings = readOpenCodeSettings({ ...base, OPENCODE_MODE: 'go', OPENCODE_SESSION_ID: 'global-session-should-be-ignored' });
  assert.deepEqual(settings, { mode: 'go', modelId: 'glm-5.3' });
});
