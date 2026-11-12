import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentServer } from '../http/server.mjs';
import { prepareCaptureReview } from '../capture-review.mjs';
import { invoke, secret, now } from './http-test-support.mjs';

const event = { id: 'endpoint-event', type: 'note_saved', shiftId: 'demo-shift', synthetic: true, noteId: 'note-1', noteVersion: 1 };
const proposeNoteFake = async () => ({ action: { title: 'Reponer carro de insumos sintético', sourceQuote: 'Falta reponer el carro de insumos sintético' } });
const capture = { shiftId: 'demo-shift', synthetic: true, text: 'Revisar material sintético.' };
function setup({ mode = 'GATEWAY', enabled = true, gateway, decision, proposeCapture, proposeNote = proposeNoteFake, ...options } = {}) {
  const calls = { gateway: 0, decision: 0, capture: 0 };
  const notes = { count: 0 };
  const logs = [];
  const server = createAgentServer({
    env: { TURNO_AGENT_SIGNING_SECRET: secret, TURNO_AI_ENABLED: enabled ? '1' : '0', TURNO_DECISION_MODE: mode, VERCEL: '1' },
    now: () => now,
    log: record => logs.push(record),
    classifyWithGateway: async (input, options) => { calls.gateway++; return gateway ? gateway(input, options) : { label: 'PROPOSE_TASK' }; },
    classifyWithDecision: async (input, options) => { calls.decision++; return decision ? decision(input, options) : { label: 'PROPOSE_REMINDER', confidence: 1 }; },
    proposeCapture: async (input, context) => {
      calls.capture++;
      return proposeCapture ? proposeCapture(input, context) : prepareCaptureReview(input, {
        beds: context.beds,
        invoke: async () => ({ proposals: [{ title: 'Revisar material', bedLabel: 'Cama 1', time: '15:00', beforeClose: false }] }),
      });
    },
    proposeNote: async (text, options) => { notes.count++; return proposeNote(text, options); },
    ...options,
  });
  const handler = server.listeners('request')[0];
  return { calls, notes, logs, server, handler, event: input => invoke(handler, { body: JSON.stringify(input) }), capture: input => invoke(handler, { url: '/v1/agent/capture', body: JSON.stringify(input) }) };
}

for (const mode of ['GATEWAY', 'DUAL', 'DECISION']) {
  test(`events use ${mode} and only review/dismiss; snapshot never comes from the caller`, async () => {
    const s = setup({ mode, decision: () => ({ label: 'PROPOSE_TASK', confidence: 1 }) });
    const response = await s.event(event);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, 'proposed');
    assert.equal(response.body.suggestions.length, 1);
    for (const suggestion of response.body.suggestions) {
      assert.deepEqual(suggestion.actions, ['review', 'dismiss']);
      assert.equal(suggestion.requiresApproval, true);
    }
    assert.equal(s.calls.gateway, mode === 'DECISION' ? 0 : 1);
    assert.equal(s.calls.decision, mode === 'GATEWAY' ? 0 : 1);
    assert.equal(s.notes.count, 1);
    const dual = s.logs.filter(r => 'activeLabel' in r);
    assert.deepEqual(dual, mode === 'DUAL' ? [{ eventId: event.id, activeLabel: 'PROPOSE_TASK', shadowLabel: 'PROPOSE_TASK', agree: true }] : []);
    assert.equal(s.logs.filter(r => 'outcome' in r).length, 1);
  });
}

for (const [name, input] of [
  ['non-synthetic', { ...event, synthetic: false }],
  ['unknown shift', { ...event, shiftId: 'unknown-shift' }],
  ['unknown event', { ...event, type: 'save_task' }],
  ['browser snapshot', { ...event, snapshot: { noteText: 'untrusted' } }],
  ['missing id', { type: 'note_saved', shiftId: 'demo-shift', synthetic: true }],
  ['text in the body', { ...event, text: 'Falta reponer guantes.' }],
  ['noteText in the body', { ...event, noteText: 'Falta reponer guantes.' }],
  ['missing noteVersion', { id: 'endpoint-event', type: 'note_saved', shiftId: 'demo-shift', synthetic: true, noteId: 'note-1' }],
  ['missing noteId', { id: 'endpoint-event', type: 'note_saved', shiftId: 'demo-shift', synthetic: true, noteVersion: 1 }],
  ['noteVersion zero', { ...event, noteVersion: 0 }],
  ['noteVersion fractional', { ...event, noteVersion: 1.5 }],
  ['noteVersion above limit', { ...event, noteVersion: 1_000_001 }],
  ['noteVersion as string', { ...event, noteVersion: '1' }],
  ['invalid noteId', { ...event, noteId: 'nota con espacios' }],
  ['noteId on drafts_ready', { id: 'endpoint-event', type: 'drafts_ready', shiftId: 'demo-shift', synthetic: true, noteId: 'note-1' }],
  ['invalid id type', { ...event, id: 1 }],
  ['array input', []],
]) {
  test(`strict events reject ${name} without consuming event id or shift quota`, async () => {
    const s = setup({ rateLimit: 1 });
    const response = await s.event(input);
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { error: 'invalid_request' });
    assert.deepEqual(s.calls, { gateway: 0, decision: 0, capture: 0 });
    assert.deepEqual(s.logs, []);
    assert.equal((await s.event(event)).body.status, 'proposed');
  });
}

test('unauthorized requests do not consume a valid event id or quota', async () => {
  const s = setup({ rateLimit: 1 });
  const rejected = await invoke(s.handler, { body: JSON.stringify(event), signed: false });
  assert.equal(rejected.status, 401);
  assert.deepEqual(s.calls, { gateway: 0, decision: 0, capture: 0 });
  assert.deepEqual(s.logs, []);
  assert.equal((await s.event(event)).body.status, 'proposed');
});

test('simultaneous copies of an event classify exactly once', async () => {
  const s = setup();
  const responses = await Promise.all([s.event(event), s.event(event)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 401]);
  assert.equal(s.calls.gateway, 1);
  assert.equal(s.notes.count, 1);
});

test('DUAL logging contains only four metadata fields, not the authorized note', async () => {
  let note;
  const s = setup({ mode: 'DUAL', gateway: input => { note = input.text; return { label: 'PROPOSE_TASK' }; } });
  await s.event(event);
  assert.ok(note.includes('sintético'));
  assert.equal(JSON.stringify(s.logs).includes(note), false);
  assert.deepEqual(Object.keys(s.logs[0]), ['eventId', 'activeLabel', 'shadowLabel', 'agree']);
  assert.equal(JSON.stringify(s.logs).includes('Falta reponer'), false);
});

test('replayed event returns generic 401 and is not classified twice', async () => {
  const s = setup();
  assert.equal((await s.event(event)).status, 200);
  const repeat = await s.event(event);
  assert.equal(repeat.status, 401);
  assert.deepEqual(repeat.body, { error: 'unauthorized' });
  assert.equal(s.calls.gateway, 1);
});

test('per-shift quota covers both endpoints and resets after the window', async () => {
  let clock = now;
  const s = setup({ rateLimit: 1, now: () => clock });
  await s.event(event);
  assert.equal((await s.capture(capture)).status, 429);
  assert.equal(s.calls.capture, 0);
  clock += 60_001;
  assert.equal((await s.capture(capture)).body.status, 'review_required');
});

test('AI off returns 503 for both routes with zero provider calls; health stays available', async () => {
  const s = setup({ enabled: false });
  for (const response of [await s.event(event), await s.capture(capture)]) {
    assert.equal(response.status, 503);
    assert.deepEqual(response.body, { error: 'ai_disabled' });
  }
  assert.deepEqual(s.calls, { gateway: 0, decision: 0, capture: 0 });
  const health = await invoke(s.handler, { method: 'GET', url: '/healthz', signed: false });
  assert.deepEqual(health.body, { ok: true, aiEnabled: false, decisionMode: 'GATEWAY', modelId: 'anthropic/claude-haiku-5.5' });
});

test('model failure abstains without note text, errors, snapshots or signing material in logs', async () => {
  const s = setup({ gateway: input => { throw new Error(input.text + secret); }, proposeCapture: input => { throw new Error(input.text + secret); } });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', reason: 'classifier_failed', suggestions: [] });
  assert.deepEqual((await s.capture(capture)).body, { status: 'abstain', proposals: [] });
  assert.deepEqual(s.logs.map(r => typeof r === 'string' ? r : r.outcome), ['classifier_failed', 'request_failed']);
  assert.equal(JSON.stringify(s.logs).includes(capture.text), false);
  assert.equal(JSON.stringify(s.logs).includes(secret), false);
});

for (const mode of ['GATEWAY', 'DUAL', 'DECISION']) test(`capture in ${mode} uses server beds and returns human-review proposals, never writes`, async () => {
  const s = setup({ mode });
  const response = await s.capture(capture);
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'review_required');
  assert.equal(response.body.shiftId, capture.shiftId);
  const [proposal] = response.body.proposals;
  assert.equal(proposal.bedId, 'bed-1');
  assert.equal(proposal.status, 'requires_human_review');
  assert.equal(proposal.completed, false);
  assert.equal(proposal.date, null);
  assert.deepEqual(proposal.actions, ['review', 'dismiss']);
  assert.equal(proposal.requiresApproval, true);
  assert.deepEqual(s.calls, { gateway: 0, decision: 0, capture: 1 });
});

for (const invalid of [{ ...capture, synthetic: false }, { ...capture, shiftId: 'missing' }, { ...capture, text: '' }, { ...capture, text: 'x'.repeat(2501) }, { ...capture, beds: [] }]) {
  test('capture rejects invalid input without quota or provider side effects', async () => {
    const s = setup({ rateLimit: 1 });
    assert.equal((await s.capture(invalid)).status, 400);
    assert.equal(s.calls.capture, 0);
    assert.equal((await s.capture(capture)).body.status, 'review_required');
  });
}

test('drafts_ready keeps deterministic behavior without model calls', async () => {
  const s = setup();
  const response = await s.event({ id: event.id, shiftId: event.shiftId, synthetic: true, type: 'drafts_ready' });
  assert.equal(response.body.status, 'proposed');
  assert.deepEqual(response.body.suggestions.map(x => x.kind), ['resolve-bed', 'resolve-date']);
  assert.equal(s.calls.gateway + s.calls.decision + s.calls.capture, 0);
  assert.equal(s.notes.count, 0);
  assert.ok(response.body.suggestions.every(p => p.requiresApproval && p.actions.join(',') === 'review,dismiss'));
});

test('shift_close_attempt is rejected as an unknown event type', async () => {
  const s = setup();
  const response = await s.event({ id: event.id, shiftId: event.shiftId, synthetic: true, type: 'shift_close_attempt' });
  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: 'invalid_request' });
  assert.equal(s.calls.gateway + s.calls.decision + s.calls.capture + s.notes.count, 0);
});

test('drafts_ready with clean drafts abstains with no suggestions', async () => {
  const clean = { shiftId: 'demo-shift', synthetic: true, beds: [{ id: 'bed-1', label: 'Cama 1' }],
    drafts: [{ id: 'c', title: 'Completar informe', completed: false }], notes: [], tasks: [] };
  const s = setup({ getAuthorizedSnapshot: () => clean });
  const response = await s.event({ id: event.id, shiftId: event.shiftId, synthetic: true, type: 'drafts_ready' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'abstain', reason: 'no_suggestions', suggestions: [] });
});

test('timed-out work retains per-shift exclusion and suppresses late DUAL logs', async () => {
  let release;
  const s = setup({ mode: 'DUAL', timeoutMs: 5, gateway: () => new Promise(r => { release = r; }) });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', suggestions: [] });
  assert.equal((await s.capture(capture)).status, 429);
  release({ label: 'PROPOSE_TASK' });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(s.logs, ['request_timeout']);
});

// P1-03: procesamiento por turno + nota + versión, liberación en fallo/cancelación y decisiones que sí quedan marcadas.
const snapshotWith = (tasks = []) => input => ({ shiftId: input.shiftId, synthetic: true, beds: [], drafts: [],
  notes: [{ id: 'note-1', version: 1, text: 'Falta reponer el carro de insumos sintético.' }], tasks });
const otherShift = { ...event, id: 'endpoint-event-2', shiftId: 'other-shift' };
const second = { ...event, id: 'endpoint-event-3' };

test('P1-03: la misma nota y versión en dos turnos se procesan ambas', async () => {
  const s = setup({ getAuthorizedSnapshot: snapshotWith() });
  assert.equal((await s.event(event)).body.status, 'proposed');
  assert.equal((await s.event(otherShift)).body.status, 'proposed');
  assert.equal(s.notes.count, 2);
});

test('P1-03: un extractor que lanza libera la marca; otro evento de la misma versión se procesa de nuevo', async () => {
  let n = 0;
  const s = setup({ getAuthorizedSnapshot: snapshotWith(), proposeNote: async () => { if (++n === 1) throw new Error('fallo'); return proposeNoteFake(); } });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', reason: 'extraction_failed', suggestions: [] });
  assert.equal((await s.event(second)).body.status, 'proposed');
  assert.equal(s.notes.count, 2);
});

test('P1-03: clasificador activo que lanza → classifier_failed y un nuevo evento reintenta', async () => {
  let n = 0;
  const s = setup({ getAuthorizedSnapshot: snapshotWith(), gateway: async () => { if (++n === 1) throw new Error('red'); return { label: 'PROPOSE_TASK' }; } });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', reason: 'classifier_failed', suggestions: [] });
  assert.equal((await s.event(second)).body.status, 'proposed');
});

for (const [name, opts, expected] of [
  ['propuesta', {}, 'proposed'],
  ['etiqueta NO_ACTION', { gateway: async () => ({ label: 'NO_ACTION' }) }, 'abstain'],
  ['duplicado', { getAuthorizedSnapshot: snapshotWith([{ id: 't', title: 'Reponer carro de insumos sintético', completed: false }]) }, 'abstain'],
]) {
  test(`P1-03: decisión ${name} queda marcada: un nuevo evento de la misma versión es already_processed`, async () => {
    const s = setup({ getAuthorizedSnapshot: snapshotWith(), ...opts });
    assert.equal((await s.event(event)).body.status, expected);
    assert.deepEqual((await s.event(second)).body, { status: 'abstain', reason: 'already_processed', suggestions: [] });
  });
}

test('P1-03: el deadline HTTP cancela la inferencia: el extractor recibe abort, la respuesta es el 200 vacío y la misma versión se procesa de nuevo', async () => {
  let hang = true;
  let seenSignal;
  let finishedCancel;
  const cancelled = new Promise(r => { finishedCancel = r; });
  const s = setup({ timeoutMs: 5, getAuthorizedSnapshot: snapshotWith(),
    proposeNote: (text, options = {}) => {
      if (!hang) return proposeNoteFake();
      seenSignal = options.signal;
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => { reject(new Error('cancelled')); finishedCancel(); }, { once: true });
      });
    } });
  const timedOut = await s.event(event);
  assert.equal(timedOut.status, 200);
  assert.deepEqual(timedOut.body, { status: 'abstain', suggestions: [] });
  await Promise.race([cancelled, new Promise(r => setTimeout(r, 200))]);
  await new Promise(r => setImmediate(r));
  assert.equal(seenSignal?.aborted, true, 'el extractor debe recibir una señal que se aborta con el deadline');
  hang = false;
  assert.equal((await s.event(second)).body.status, 'proposed');
});

test('P1-03: el deadline HTTP también cancela el clasificador activo; tras cancelar, la versión se procesa de nuevo', async () => {
  let hang = true;
  let seenSignal;
  const s = setup({ timeoutMs: 5, getAuthorizedSnapshot: snapshotWith(),
    gateway: (input, options) => {
      if (!hang) return { label: 'PROPOSE_TASK' };
      seenSignal = options?.signal;
      return new Promise((_, reject) => {
        options?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
      });
    } });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', suggestions: [] });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(seenSignal?.aborted, true, 'el clasificador debe recibir la señal del deadline');
  hang = false;
  assert.equal((await s.event(second)).body.status, 'proposed');
});
