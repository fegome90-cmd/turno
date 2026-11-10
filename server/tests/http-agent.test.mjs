import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentServer } from '../http/server.mjs';
import { prepareCaptureReview } from '../capture-review.mjs';
import { invoke, secret, now } from './http-test-support.mjs';

const event = { id: 'endpoint-event', type: 'note_saved', shiftId: 'demo-shift', synthetic: true };
const capture = { shiftId: 'demo-shift', synthetic: true, text: 'Revisar material sintético.' };
function setup({ mode = 'GATEWAY', enabled = true, gateway, decision, proposeCapture, ...options } = {}) {
  const calls = { gateway: 0, decision: 0, capture: 0 };
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
    ...options,
  });
  const handler = server.listeners('request')[0];
  return { calls, logs, server, handler, event: input => invoke(handler, { body: JSON.stringify(input) }), capture: input => invoke(handler, { url: '/v1/agent/capture', body: JSON.stringify(input) }) };
}

for (const mode of ['GATEWAY', 'DUAL', 'DECISION']) {
  test(`events use ${mode} and only review/dismiss; snapshot never comes from the caller`, async () => {
    const s = setup({ mode });
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
    assert.deepEqual(s.logs, mode === 'DUAL' ? [{ eventId: event.id, activeLabel: 'PROPOSE_TASK', shadowLabel: 'PROPOSE_REMINDER', agree: false }] : []);
  });
}

for (const [name, input] of [
  ['non-synthetic', { ...event, synthetic: false }],
  ['unknown shift', { ...event, shiftId: 'unknown-shift' }],
  ['unknown event', { ...event, type: 'save_task' }],
  ['browser snapshot', { ...event, snapshot: { noteText: 'untrusted' } }],
  ['missing id', { type: 'note_saved', shiftId: 'demo-shift', synthetic: true }],
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
});

test('DUAL logging contains only four metadata fields, not the authorized note', async () => {
  let note;
  const s = setup({ mode: 'DUAL', gateway: input => { note = input.text; return { label: 'PROPOSE_TASK' }; } });
  await s.event(event);
  assert.ok(note.includes('sintético'));
  assert.equal(JSON.stringify(s.logs).includes(note), false);
  assert.deepEqual(Object.keys(s.logs[0]), ['eventId', 'activeLabel', 'shadowLabel', 'agree']);
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
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', suggestions: [] });
  assert.deepEqual((await s.capture(capture)).body, { status: 'abstain', proposals: [] });
  assert.deepEqual(s.logs, ['request_failed']);
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

for (const type of ['drafts_ready', 'shift_close_attempt']) {
  test(`${type} keeps deterministic behavior without classifiers`, async () => {
    const s = setup();
    const response = await s.event({ ...event, type });
    assert.equal(response.body.status, 'proposed');
    assert.ok(response.body.suggestions.length > 0);
    assert.equal(s.calls.gateway + s.calls.decision, 0);
    assert.ok(response.body.suggestions.every(p => p.requiresApproval && p.actions.join(',') === 'review,dismiss'));
  });
}

test('timed-out work retains per-shift exclusion and suppresses late DUAL logs', async () => {
  let release;
  const s = setup({ mode: 'DUAL', timeoutMs: 5, gateway: () => new Promise(r => { release = r; }) });
  assert.deepEqual((await s.event(event)).body, { status: 'abstain', suggestions: [] });
  assert.equal((await s.capture(capture)).status, 429);
  release({ label: 'PROPOSE_TASK' });
  await new Promise(r => setImmediate(r));
  assert.deepEqual(s.logs, ['request_timeout']);
});
