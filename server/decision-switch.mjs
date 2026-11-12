/**
 * Turno's read-only semantic classification switch, inspired by Amazon's
 * BEDROCK / DUAL / DECISION rollout. The outputs are candidates for review;
 * this module has no mutation tools and never sends toasts directly.
 *
 * The caller is responsible for authorization and minimization before model
 * invocation. No model output is trusted to change a Turno task.
 */
export const DECISION_MODES = Object.freeze(['GATEWAY', 'DUAL', 'DECISION']);
export const SEMANTIC_LABELS = Object.freeze([
  'NO_ACTION', 'PROPOSE_TASK', 'PROPOSE_REMINDER', 'NEEDS_REVIEW',
]);

const modes = new Set(DECISION_MODES);
const labels = new Set(SEMANTIC_LABELS);

export function readDecisionMode(env = process.env) {
  const mode = (env.TURNO_DECISION_MODE ?? 'GATEWAY').trim().toUpperCase();
  if (!modes.has(mode)) throw new Error('TURNO_DECISION_MODE inválido; usa GATEWAY, DUAL o DECISION.');
  return mode;
}

function normalize(raw, needsConfidence) {
  if (!raw || !labels.has(raw.label)) return null;
  if (needsConfidence && (!Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1)) {
    return null;
  }
  return Object.freeze({
    label: raw.label,
    ...(needsConfidence && { confidence: raw.confidence }),
  });
}

function asCandidate(result, source, threshold, needsConfidence) {
  const normalized = normalize(result, needsConfidence);
  if (!normalized || (needsConfidence && normalized.confidence < threshold)) {
    return { source, status: 'abstain', label: 'NO_ACTION' };
  }
  return {
    source,
    status: normalized.label === 'NO_ACTION' ? 'no_action' : 'candidate',
    ...normalized,
  };
}

/**
 * @param {object} options
 * @param {object} options.event - Authorized, minimized snapshot with stable id.
 * @param {'GATEWAY'|'DUAL'|'DECISION'} options.mode
 * @param {(event:object)=>Promise<object>} options.classifyWithGateway - Strands Agent adapter.
 * @param {(event:object)=>Promise<object>} options.classifyWithDecision - Local Decision API adapter.
 * @param {(record:object)=>Promise<void>|void} options.recordComparison - Metadata only.
 * @param {number} options.minConfidence - Experimental threshold (must be evaluated).
 * @returns {Promise<object>} Active result. `failed: true` only when the active classifier threw (P1-03).
 */
export async function classifySignal({
  event,
  mode = 'GATEWAY',
  classifyWithGateway,
  classifyWithDecision,
  recordComparison = () => {},
  minConfidence = 0.90,
}) {
  if (!event || typeof event.id !== 'string' || !event.id.trim()) {
    throw new Error('El evento autorizado requiere un id estable.');
  }
  if (!modes.has(mode)) throw new Error('Modo no soportado.');
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error('Umbral de confianza inválido.');
  }
  if (mode !== 'DECISION' && typeof classifyWithGateway !== 'function') {
    throw new Error('Falta el adaptador Gateway.');
  }
  if (mode !== 'GATEWAY' && typeof classifyWithDecision !== 'function') {
    throw new Error('Falta el adaptador Decision.');
  }
  if (mode === 'GATEWAY') {
    try {
      return asCandidate(await classifyWithGateway(event), 'GATEWAY', minConfidence, false);
    } catch {
      return { source: 'GATEWAY', status: 'abstain', label: 'NO_ACTION', failed: true };
    }
  }
  if (mode === 'DECISION') {
    try {
      return asCandidate(await classifyWithDecision(event), 'DECISION', minConfidence, true);
    } catch {
      return { source: 'DECISION', status: 'abstain', label: 'NO_ACTION', failed: true };
    }
  }

  // DUAL: Gateway is the ONLY active decision. Decision is shadow evaluation.
  // DUAL waits for the shadow by design (evaluation mode only); the active result is not returned earlier.
  const [a, b] = await Promise.allSettled([
    classifyWithGateway(event),
    classifyWithDecision(event),
  ]);
  // failed:true solo cuando el clasificador ACTIVO lanza (P1-03); una salida de baja confianza no es fallo.
  const active = a.status === 'fulfilled'
    ? asCandidate(a.value, 'GATEWAY', minConfidence, false)
    : { source: 'GATEWAY', status: 'abstain', label: 'NO_ACTION', failed: true };
  const shadow = b.status === 'fulfilled'
    ? asCandidate(b.value, 'DECISION', minConfidence, true)
    : { source: 'DECISION', status: 'abstain', label: 'NO_ACTION' };

  // Never log raw event, input text, patient data, credentials or session ids.
  // Telemetry must not affect the active outcome.
  try {
    await recordComparison(Object.freeze({
      eventId: event.id,
      activeLabel: active.label,
      activeStatus: active.status,
      shadowLabel: shadow.label,
      shadowStatus: shadow.status,
      agree: active.label === shadow.label && active.status === shadow.status,
    }));
  } catch { /* observational telemetry may fail independently */ }
  return active;
}
