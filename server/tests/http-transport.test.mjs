import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { createHttpHandler, signRequest } from '../http/transport.mjs';

const secret = randomBytes(32).toString('hex');
const now = 1_800_000_000_000;
const path = '/v1/agent/events';

// Exercise the public request listener using streams, without binding a socket.
export async function invoke(handler, { body = '{}', url = path, method = 'POST', headers = {}, signed = true, timestamp = String(now / 1000) } = {}) {
  const req = new PassThrough();
  req.method = method;
  req.url = url;
  req.headers = { 'content-type': 'application/json', ...headers };
  if (signed) {
    req.headers['x-turno-timestamp'] ??= timestamp;
    req.headers['x-turno-signature'] ??= signRequest({ secret, timestamp, method, path: url, body });
  }
  let resolve;
  const result = new Promise(r => { resolve = r; });
  const res = {
    writableEnded: false,
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; },
    end(data) { this.writableEnded = true; resolve({ status: this.status, headers: this.headers, body: JSON.parse(data) }); },
  };
  const work = handler(req, res);
  req.end(body);
  const response = await result;
  await work;
  return response;
}

function setup(options = {}) {
  let calls = 0;
  const handler = createHttpHandler({
    secret, now: () => now, health: () => ({ ok: true }),
    handle: async () => { calls++; return { status: 'proposed', suggestions: [] }; },
    ...options,
  });
  return { handler, calls: () => calls };
}

for (const [name, options] of [
  ['missing signature', { signed: false }],
  ['invalid signature', { headers: { 'x-turno-signature': '0'.repeat(64) } }],
  ['expired signature', { timestamp: String(now / 1000 - 301) }],
  ['future signature', { timestamp: String(now / 1000 + 301) }],
  ['malformed timestamp', { timestamp: 'not-a-time' }],
  ['browser origin', { headers: { origin: 'https://example.invalid' } }],
]) {
  test(`transport rejects ${name} without details or work`, async () => {
    const s = setup();
    const response = await invoke(s.handler, options);
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: 'unauthorized' });
    assert.equal(s.calls(), 0);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  });
}

test('signature covers exact bytes, route and method; five-minute boundary is accepted', async () => {
  const s = setup();
  const signature = signRequest({ secret, timestamp: String(now / 1000), method: 'POST', path, body: '{}' });
  const altered = await invoke(s.handler, { body: '{ }', headers: { 'x-turno-signature': signature } });
  assert.equal(altered.status, 401);
  const swapped = await invoke(s.handler, { url: '/v1/agent/capture', headers: { 'x-turno-signature': signature } });
  assert.equal(swapped.status, 401);
  assert.equal((await invoke(s.handler, { timestamp: String(now / 1000 - 300) })).status, 200);
  assert.equal(s.calls(), 1);
});

for (const [name, options, status, error] of [
  ['oversized body', { body: 'x'.repeat(16 * 1024 + 1) }, 413, 'body_too_large'],
  ['wrong media type', { headers: { 'content-type': 'text/plain' } }, 415, 'unsupported_media_type'],
  ['malformed JSON', { body: '{' }, 400, 'invalid_request'],
]) {
  test(`transport rejects ${name}`, async () => {
    const s = setup();
    const response = await invoke(s.handler, options);
    assert.equal(response.status, status);
    assert.deepEqual(response.body, { error });
    assert.equal(s.calls(), 0);
  });
}

test('health is model-free, no CORS/preflight, no mutation routes', async () => {
  const s = setup();
  const health = await invoke(s.handler, { method: 'GET', url: '/healthz', signed: false });
  assert.deepEqual(health.body, { ok: true });
  for (const [method, url] of [['OPTIONS', path], ['DELETE', path], ['POST', '/tasks']]) {
    assert.equal((await invoke(s.handler, { method, url })).status, 404);
  }
  assert.equal(s.calls(), 0);
});

test('deadline returns abstention, suppresses raw errors and late responses', async () => {
  const logs = [];
  const s = setup({ timeoutMs: 5, log: value => logs.push(value), handle: () => new Promise(() => {}) });
  const response = await invoke(s.handler);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'abstain', suggestions: [] });
  assert.deepEqual(logs, ['request_timeout']);
  const failure = setup({ log: value => logs.push(value), handle: () => { throw new Error('sensitive note contents'); } });
  assert.deepEqual((await invoke(failure.handler)).body, { status: 'abstain', suggestions: [] });
  assert.equal(JSON.stringify(logs).includes('sensitive'), false);
});
