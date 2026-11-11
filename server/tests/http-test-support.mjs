import { randomBytes } from 'node:crypto';
import { PassThrough } from 'node:stream';
import { signRequest } from '../http/transport.mjs';

export const secret = randomBytes(32).toString('hex');
export const now = 1_800_000_000_000;
const path = '/v1/agent/events';

// Exercise the public node:http request listener without binding a socket.
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
