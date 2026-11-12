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
    classifyWithGateway: async input => { calls.gateway++; return gateway ? gateway(input) : { label: 'PROPOSE_TASK' }; },
    classifyWithDecision: async input => { calls.decision++; return decision ? decision(input) : { label: 'PROPOSE_REMINDER', confidence: 1 }; },
    proposeCapture: async (input, context) => {
      calls.capture++;
      return proposeCapture ? proposeCapture(input, context) : prepareCaptureReview(input, {
        beds: context.beds,
        invoke: async () => ({ proposals: [{ title: 'Revisar material', bedLabel: 'Cama 1', time: '15:00', beforeClose: false }] }),
      });
    },
    proposeNote: async text => { notes.count++; return proposeNote(text); },
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
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', reason: 'classifier_abstain', suggestions: [] });
  assert.deepEqual((await s.capture(capture)).body, { status: 'abstain', proposals: [] });
  assert.deepEqual(s.logs.map(r => typeof r === 'string' ? r : r.outcome), ['classifier_abstain', 'request_failed']);
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
