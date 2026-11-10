/**
 * Turno's read-only semantic classification switch, inspired by Amazon's
 * BEDROCK / DUAL / DECIDER rollout. The outputs are candidates for review;
 * this module has no mutation tools and never sends toasts directly.
 *
 * The caller is responsible for authorization and minimization before model
 * invocation. No model output is trusted to change a Turno task.
 */
export const DECISION_MODES = Object.freeze(['OPENCODE', 'DUAL', 'DECIDER']);
export const SEMANTIC_LABELS = Object.freeze([
  'NO_ACTION', 'PROPOSE_TASK', 'PROPOSE_REMINDER', 'NEEDS_REVIEW',
]);

const modes = new Set(DECISION_MODES);
const labels = new Set(SEMANTIC_LABELS);

export function readDecisionMode(env = process.env) {
  const mode = (env.TURNO_DECISION_MODE ?? 'OPENCODE').trim().toUpperCase();
  if (!modes.has(mode)) throw new Error('TURNO_DECISION_MODE inválido; usa OPENCODE, DUAL o DECIDER.');
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
 * @param {'OPENCODE'|'DUAL'|'DECIDER'} options.mode
 * @param {(event:object)=>Promise<object>} options.classifyWithOpenCode - Strands Agent adapter.
 * @param {(event:object)=>Promise<object>} options.classifyWithDecider - Local Decider API adapter.
 * @param {(record:object)=>Promise<void>|void} options.recordComparison - Metadata only.
 * @param {number} options.minConfidence - Experimental threshold (must be evaluated).
 */
export async function classifySignal({
  event,
  mode = 'OPENCODE',
  classifyWithOpenCode,
  classifyWithDecider,
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
  if (mode !== 'DECIDER' && typeof classifyWithOpenCode !== 'function') {
    throw new Error('Falta el adaptador OpenCode.');
  }
  if (mode !== 'OPENCODE' && typeof classifyWithDecider !== 'function') {
    throw new Error('Falta el adaptador Decider.');
  }
  if (mode === 'OPENCODE') {
    try {
      return asCandidate(await classifyWithOpenCode(event), 'OPENCODE', minConfidence, false);
    } catch {
      return { source: 'OPENCODE', status: 'abstain', label: 'NO_ACTION' };
    }
  }
  if (mode === 'DECIDER') {
    try {
      return asCandidate(await classifyWithDecider(event), 'DECIDER', minConfidence, true);
    } catch {
      return { source: 'DECIDER', status: 'abstain', label: 'NO_ACTION' };
    }
  }

  // DUAL: OpenCode is the ONLY active decision. Decider is shadow evaluation.
  const [a, b] = await Promise.allSettled([
    classifyWithOpenCode(event),
    classifyWithDecider(event),
  ]);
  const active = a.status === 'fulfilled'
    ? asCandidate(a.value, 'OPENCODE', minConfidence, false)
    : { source: 'OPENCODE', status: 'abstain', label: 'NO_ACTION' };
  const shadow = b.status === 'fulfilled'
    ? asCandidate(b.value, 'DECIDER', minConfidence, true)
    : { source: 'DECIDER', status: 'abstain', label: 'NO_ACTION' };

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
