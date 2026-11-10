import { createHmac, timingSafeEqual } from 'node:crypto';
import { redactSecrets } from '../scripts/check-secrets.mjs';

export const MAX_BODY_BYTES = 16 * 1024;
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
const paths = new Set(['/v1/agent/events', '/v1/agent/capture']);

export class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; }
}

export function signRequest({ secret, timestamp, method, path, body }) {
  return createHmac('sha256', secret).update(`${timestamp}.${method}.${path}.`).update(body).digest('hex');
}

function authenticate(req, body, secret, now) {
  const timestamp = req.headers['x-turno-timestamp'];
  const signature = req.headers['x-turno-signature'];
  if (!secret || req.headers.origin !== undefined || typeof timestamp !== 'string' ||
      !/^\d{10}$/.test(timestamp) || Math.abs(now() - Number(timestamp) * 1000) > SIGNATURE_WINDOW_MS ||
      typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new HttpError(401, 'unauthorized');
  }
  const expected = signRequest({ secret, timestamp, method: req.method, path: req.url, body });
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    throw new HttpError(401, 'unauthorized');
  }
}

async function readBody(req, signal) {
  // Parameters other than UTF-8 are intentionally not accepted.
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'unsupported_media_type');
  }
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large');
  const chunks = [];
  let length = 0;
  const onAbort = () => req.destroy();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for await (const chunk of req) {
      length += chunk.length;
      if (length > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

function send(res, status, body) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** Public node:http listener. No request/provider text ever reaches the logger. */
export function createHttpHandler({ secret, health, handle, now = Date.now, timeoutMs = 10_000, log = () => {} }) {
  const safeLog = code => { try { log(redactSecrets(code)); } catch { /* Logging cannot change authorization. */ } };
  return async (req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') return send(res, 200, health());
    if (req.method !== 'POST' || !paths.has(req.url)) return send(res, 404, { error: 'not_found' });
    const controller = new AbortController();
    const empty = () => req.url.endsWith('/capture')
      ? { status: 'abstain', proposals: [] } : { status: 'abstain', suggestions: [] };
    let authenticated = false;
    let timer;
    const work = (async () => {
      const raw = await readBody(req, controller.signal);
      authenticate(req, raw, secret, now);
      authenticated = true;
      let payload;
      try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
      catch { throw new HttpError(400, 'invalid_request'); }
      return handle(payload, req.url, controller.signal);
    })();
    try {
      const result = await Promise.race([work, new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new HttpError(authenticated ? 200 : 408, 'request_timeout'));
          controller.abort();
        }, timeoutMs);
      })]);
      send(res, 200, result);
    } catch (error) {
      if (error instanceof HttpError && error.status !== 200) {
        send(res, error.status, { error: redactSecrets(error.message) });
      } else {
        safeLog(error instanceof HttpError ? 'request_timeout' : 'request_failed');
        send(res, 200, empty());
      }
    } finally {
      clearTimeout(timer);
    }
  };
}
