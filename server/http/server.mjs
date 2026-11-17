import { createServer } from 'node:http';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';
import { readGatewaySettings } from '../gateway-config.mjs';
import { createHttpHandler, HttpError, SIGNATURE_WINDOW_MS } from './transport.mjs';
import { getAuthorizedSnapshot as fixtureSnapshot } from './snapshots.mjs';
import { sanitizeModelMetrics } from '../strands-runtime.mjs';

const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const EVENT_TYPES = new Set(['note_saved', 'drafts_ready']);
const BASE_KEYS = ['id', 'type', 'shiftId', 'synthetic'];
// note_saved carries only the confirmed note reference. The browser never sends text.
const NOTE_KEYS = [...BASE_KEYS, 'noteId', 'noteVersion'];
const CAPTURE_KEYS = ['shiftId', 'synthetic', 'text'];
const invalid = () => { throw new HttpError(400, 'invalid_request'); };

function validate(input, capture) {
  const isNote = !capture && !!input && typeof input === 'object' && input.type === 'note_saved';
  const keys = capture ? CAPTURE_KEYS : isNote ? NOTE_KEYS : BASE_KEYS;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== keys.length || !keys.every(k => Object.hasOwn(input, k)) ||
      input.synthetic !== true || typeof input.shiftId !== 'string' || !ID.test(input.shiftId)) invalid();
  if (capture) {
    if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 2500) invalid();
    return;
  }
  if (typeof input.id !== 'string' || !ID.test(input.id) || !EVENT_TYPES.has(input.type)) invalid();
  if (isNote && (typeof input.noteId !== 'string' || !ID.test(input.noteId) ||
      !Number.isInteger(input.noteVersion) || input.noteVersion < 1 || input.noteVersion > 1_000_000)) invalid();
}

export function positiveInteger(raw, fallback, max) {
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(String(raw)) || Number(raw) < 1 || Number(raw) > max) throw new Error('invalid_endpoint_configuration');
  return Number(raw);
}

/** Caduca turnos inactivos sin liberar jamás un turno ocupado. */
export function sweepIdleShifts(shifts, time, ttl) {
  for (const [id, state] of shifts) {
    if (!state.busy && time - state.lastUsed >= ttl) shifts.delete(id);
  }
}

/** Injectable public node:http server; classifiers are initialized only on first use. */
export function createAgentServer({
  env = process.env, now = Date.now, log = () => {}, getAuthorizedSnapshot = fixtureSnapshot,
  classifyWithGateway, classifyWithDecision, proposeCapture, proposeNote,
  rateLimit = positiveInteger(env.TURNO_AGENT_RATE_LIMIT, 10, 1000),
  timeoutMs = positiveInteger(env.TURNO_AGENT_TIMEOUT_MS, 10_000, 30_000),
} = {}) {
  const settings = readGatewaySettings(env);
  const secret = env.TURNO_AGENT_SIGNING_SECRET;
  if (settings.enabled && (typeof secret !== 'string' || Buffer.byteLength(secret) < 32)) {
    throw new Error('invalid_endpoint_configuration');
  }
  let gateway, decision, capture;
  const gatewayCall = classifyWithGateway ?? (async (input, options) => {
    gateway ??= import('../gateway-provider.mjs').then(m => m.createStrandsClassifier({ env }));
    return (await gateway)(input, options);
  });
  const decisionCall = classifyWithDecision ?? (async (input, options) => {
    decision ??= import('../decision-provider.mjs').then(m => m.createRemoteDecisionClassifier({ env }));
    return (await decision)(input, options);
  });
  const captureCall = proposeCapture ?? (async (input, context) => {
    capture ??= import('../gateway-capture.mjs').then(m => m.createStrandsCapture({ env }));
    return (await capture)(input, context);
  });
  let noteExtractor;
  const noteCall = proposeNote ?? (async (text, options) => {
    noteExtractor ??= import('../note-proposal.mjs').then(m => m.createStrandsNoteExtractor({ env }));
    return (await noteExtractor)(text, options);
  });
  const seen = new Map();
  // Confirmed note versions already sent to the classifier (same TTL policy as seen).
  const processed = new Map();
  const shifts = new Map();
  const safeLog = record => { try { log(record); } catch { /* Telemetry is non-authoritative. */ } };
  const handler = createHttpHandler({
    secret, now, timeoutMs, log: safeLog,
    health: () => ({ ok: true, aiEnabled: settings.enabled, decisionMode: settings.decisionMode, modelId: settings.modelId }),
    handle: async (input, path, signal) => {
      const modelMetrics = stage => record => {
        if (!signal.aborted) safeLog({kind:'model_metrics', stage, ...sanitizeModelMetrics(record)});
      };
      const isCapture = path === '/v1/agent/capture';
      validate(input, isCapture);
      if (!settings.enabled) throw new HttpError(503, 'ai_disabled');
      const snapshot = await getAuthorizedSnapshot(input);
      if (!snapshot || snapshot.synthetic !== true || snapshot.shiftId !== input.shiftId) invalid();
      // No asynchronous boundary between replay check and reservation.
      const time = now();
      for (const [id, expires] of seen) if (expires < time) seen.delete(id);
      for (const [key, expires] of processed) if (expires < time) processed.delete(key);
      sweepIdleShifts(shifts, time, 2 * SIGNATURE_WINDOW_MS + 1000);
      if (!isCapture && seen.has(input.id)) throw new HttpError(401, 'unauthorized');
      const state = shifts.get(input.shiftId) ?? { start: time, count: 0, busy: false, lastUsed: time };
      if (time - state.start >= 60_000) { state.start = time; state.count = 0; }
      state.lastUsed = time;
      if (state.busy || state.count >= rateLimit || (!isCapture && seen.size >= 10_000)) {
        throw new HttpError(429, 'rate_limited');
      }
      if (signal.aborted) throw new HttpError(408, 'request_timeout');
      state.count++;
      state.busy = true;
      shifts.set(input.shiftId, state);
      // Future-dated valid signatures can remain usable for ten minutes.
      if (!isCapture) seen.set(input.id, time + 2 * SIGNATURE_WINDOW_MS + 1000);
      try {
        if (isCapture) {
          const result = await captureCall(input, { isAuthorized: async () => true, beds: snapshot.beds, signal, onMetrics: modelMetrics('capture') });
          if (signal.aborted) return {status:'abstain', proposals:[]};
          if (result?.status !== 'review_required' || result.shiftId !== input.shiftId || !Array.isArray(result.proposals)) {
            throw new Error('invalid_capture_result');
          }
          return { status: result.status, shiftId: result.shiftId, proposals: result.proposals.map(proposal => ({
            ...proposal, actions: ['review', 'dismiss'], requiresApproval: true,
          })) };
        }
        // P1-03: la marca es por turno + nota + versión. El deadline HTTP (signal) cancela la inferencia.
        const key = (noteId, version) => input.shiftId + ':' + noteId + ':' + version;
        return await analyzeAmbientEvent({
          event: input, settings, isAuthorized: async () => true,
          getAuthorizedSnapshot: async () => snapshot,
          classifyWithGateway: (event, options) => gatewayCall(event, {...options, onMetrics:modelMetrics('classification')}),
          classifyWithDecision: (event, options) => decisionCall(event, {...options, onMetrics:modelMetrics('decision')}),
          recordComparison: ({ eventId, activeLabel, shadowLabel, agree }) => {
            if (!signal.aborted) safeLog({ eventId, activeLabel, shadowLabel, agree });
          },
          extractNoteProposal: (text, options) => noteCall(text, {...options, onMetrics:modelMetrics('extraction')}),
          alreadyProcessed: (noteId, version) => processed.has(key(noteId, version)),
          markProcessed: (noteId, version) => {
            processed.set(key(noteId, version), now() + 2 * SIGNATURE_WINDOW_MS + 1000);
          },
          releaseProcessed: (noteId, version) => { processed.delete(key(noteId, version)); },
          signal,
          onMetrics: record => { if (!signal.aborted) safeLog(record); },
        });
      } finally {
        // Keep exclusion until upstream settles, even if the HTTP deadline won.
        state.busy = false;
      }
    },
  });
  const server = createServer({ requestTimeout: timeoutMs, headersTimeout: timeoutMs, maxHeaderSize: 8192 }, handler);
  server.maxConnections = 32;
  server.keepAliveTimeout = 1000;
  return server;
}
