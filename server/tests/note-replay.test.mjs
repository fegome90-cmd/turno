// Offline replay of note_saved over a real listening socket: signed requests,
// injected fakes for every model call, and no provider or network access.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentServer } from '../http/server.mjs';
import { signRequest } from '../http/transport.mjs';
import { secret, now } from './http-test-support.mjs';

const NOTE_TEXT = 'Falta reponer el carro de insumos sintético de la sala 2.';

async function start(options = {}) {
  const logs = [];
  const calls = { classify: 0, extract: 0 };
  const server = createAgentServer({
    env: { TURNO_AGENT_SIGNING_SECRET: secret, TURNO_AI_ENABLED: '1', TURNO_DECISION_MODE: 'GATEWAY', VERCEL: '1' },
    now: () => now,
    log: record => logs.push(record),
    classifyWithGateway: async () => { calls.classify++; return options.label ?? { label: 'PROPOSE_TASK' }; },
    proposeNote: async () => { calls.extract++; return options.raw ?? { action: { title: 'Reponer carro de insumos sintético', sourceQuote: 'Falta reponer el carro de insumos sintético' } }; },
    ...options.server,
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const send = async (body, { signed = true, timestamp = String(now / 1000) } = {}) => {
    const raw = JSON.stringify(body);
    const headers = { 'content-type': 'application/json' };
    if (signed) {
      headers['x-turno-timestamp'] = timestamp;
      headers['x-turno-signature'] = signRequest({ secret, timestamp, method: 'POST', path: '/v1/agent/events', body: raw });
    }
    const response = await fetch(`http://127.0.0.1:${port}/v1/agent/events`, { method: 'POST', headers, body: raw });
    return { status: response.status, body: await response.json() };
  };
  return { send, logs, calls, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}

const noteEvent = (overrides = {}) => ({
  id: 'replay-1', type: 'note_saved', shiftId: 'demo-shift', synthetic: true, noteId: 'note-1', noteVersion: 1, ...overrides,
});

test('replay: propose once, then replay, same-version and stale events are silenced', async () => {
  const s = await start();
  try {
    const first = await s.send(noteEvent());
    assert.equal(first.status, 200);
    assert.equal(first.body.status, 'proposed');
    assert.equal(first.body.suggestions.length, 1);
    assert.equal(first.body.suggestions[0].channel, 'inline');

    assert.deepEqual(await s.send(noteEvent()), { status: 401, body: { error: 'unauthorized' } });
    assert.equal((await s.send(noteEvent({ id: 'replay-2' }))).body.reason, 'already_processed');
    assert.equal((await s.send(noteEvent({ id: 'replay-3', noteVersion: 2 }))).body.reason, 'stale_version');
    assert.deepEqual(s.calls, { classify: 1, extract: 1 });
    assert.equal(JSON.stringify(s.logs).includes(NOTE_TEXT), false);
  } finally { await s.close(); }
});

test('replay: reminder and review labels abstain without extraction', async () => {
  for (const label of ['PROPOSE_REMINDER', 'NEEDS_REVIEW', 'NO_ACTION']) {
    const s = await start({ label: { label } });
    try {
      const response = await s.send(noteEvent());
      assert.deepEqual(response.body, { status: 'abstain', reason: `label_${label}`, suggestions: [] });
      assert.equal(s.calls.extract, 0);
    } finally { await s.close(); }
  }
});

test('replay: a proposed note is not duplicated and a text body is rejected', async () => {
  const s = await start();
  try {
    assert.deepEqual((await s.send(noteEvent({ id: 'replay-dup' }))).body.status, 'proposed');
    assert.equal((await s.send(noteEvent({ id: 'replay-x', text: NOTE_TEXT }))).status, 400);
  } finally { await s.close(); }
  const dup = await start({ raw: { action: { title: 'Revisar informe sintético', sourceQuote: 'Falta reponer el carro de insumos sintético' } } });
  try {
    const response = await dup.send(noteEvent());
    assert.equal(response.body.reason, 'duplicate');
    assert.equal(dup.calls.extract, 1);
  } finally { await dup.close(); }
});
