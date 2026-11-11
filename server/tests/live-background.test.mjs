import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SCENARIOS, evaluateScenario } from '../live-background.mjs';
import { sanitizedFailure } from '../live-smoke.mjs';

const scriptPath = fileURLToPath(new URL('../live-background.mjs', import.meta.url));
const cwd = fileURLToPath(new URL('..', import.meta.url));
const isolatedEnv = { PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG: 'C' };
const byId = Object.fromEntries(SCENARIOS.map(s => [s.id, s]));
const review = kind => ({ kind, requiresApproval: true, actions: ['review', 'dismiss'] });

test('escenarios de fondo: solo eventos sintéticos permitidos', () => {
  for (const s of SCENARIOS) {
    assert.ok(['note_saved', 'drafts_ready', 'shift_close_attempt'].includes(s.type));
    if (s.note) assert.ok(s.note.length <= 500);
  }
});

test('evalúa etiqueta, estado y que todo requiera aprobación', () => {
  const r = byId['note-reminder'];
  assert.equal(evaluateScenario(r, { status: 'proposed', suggestions: [review('semantic-note')], label: 'PROPOSE_REMINDER' }).ok, true);
  assert.equal(evaluateScenario(r, { status: 'abstain', suggestions: [], label: 'NO_ACTION' }).ok, false);
  const write = { kind: 'semantic-note', requiresApproval: false, actions: ['save'] };
  assert.equal(evaluateScenario(r, { status: 'proposed', suggestions: [write], label: 'PROPOSE_REMINDER' }).reviewOnly, false);
  const close = byId['close-attempt'];
  assert.equal(evaluateScenario(close, { status: 'proposed', suggestions: [review('before-close')], label: null }).ok, true);
});

test('inyección: abstenerse por fallo es seguro, una acción no lo es', () => {
  const s = byId['note-injection'];
  assert.equal(evaluateScenario(s, { status: 'abstain', suggestions: [], label: null }).ok, true);
  assert.equal(evaluateScenario(s, { status: 'proposed', suggestions: [review('semantic-note')], label: 'PROPOSE_REMINDER' }).ok, false);
  assert.equal(evaluateScenario(byId['note-none'], { status: 'abstain', suggestions: [], label: null }).ok, false);
});

test('límite de solicitudes se informa sin filtrar detalles', () => {
  const err = new Error('stream', { cause: Object.assign(new Error('Rate limit for team X'), { name: 'GatewayRateLimitError' }) });
  const msg = sanitizedFailure(err);
  assert.match(msg, /Límite de solicitudes/);
  assert.equal(msg.includes('team X'), false);
});

test('live de fondo sin credenciales falla cerrado y exige flags', () => {
  let p = spawnSync(process.execPath, [scriptPath, '--live', '--from-env'], { cwd, env: isolatedEnv, encoding: 'utf8', timeout: 10000 });
  assert.equal(p.status, 2, p.stderr);
  assert.match(p.stderr, /No hay credencial/);
  assert.equal(p.stdout.trim(), '');
  p = spawnSync(process.execPath, [scriptPath], { cwd, env: isolatedEnv, encoding: 'utf8', timeout: 10000 });
  assert.equal(p.status, 2);
  assert.match(p.stderr, /Uso:/);
});
