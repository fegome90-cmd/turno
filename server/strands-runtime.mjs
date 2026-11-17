// Small Strands lifecycle adapter. Never record prompts, outputs, errors or credentials.
const STOP_REASONS = new Set(['endTurn','toolUse','stopSequence','cancelled','limitTurns',
  'limitTotalTokens','limitOutputTokens','limitStructuredOutputAttempts','contentFiltered',
  'guardrailIntervened','refusal','interrupt','checkpoint','completed','error','unknown']);
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function invocationSignal(signal, timeoutMs) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function sanitizeModelMetrics(raw = {}) {
  return Object.freeze({
    modelCalls: count(raw.modelCalls), modelErrors: count(raw.modelErrors), turns: count(raw.turns),
    inputTokens: count(raw.inputTokens), outputTokens: count(raw.outputTokens),
    durationMs: count(raw.durationMs), stopReason: STOP_REASONS.has(raw.stopReason) ? raw.stopReason : 'unknown',
    structuredOutputPresent: raw.structuredOutputPresent === true,
  });
}

/** One observer per invocation; native hooks count attempts, not application guesses. */
export function attachLifecycleMetrics(agent, {BeforeModelCallEvent, AfterModelCallEvent}, onMetrics) {
  if (typeof onMetrics !== 'function') return {finish() {}};
  let modelCalls = 0, modelErrors = 0, finished = false;
  const started = performance.now();
  const cleanups = [
    agent.addHook(BeforeModelCallEvent, () => {modelCalls++;}),
    agent.addHook(AfterModelCallEvent, event => {if (event.error !== undefined) modelErrors++;}),
  ];
  return {finish(result, signal) {
    if (finished) return;
    finished = true;
    for (const cleanup of cleanups) cleanup();
    // Instrumentation must neither change a result nor expose provider data.
    try {
      const m = result?.metrics?.toJSON?.();
      const record = sanitizeModelMetrics({modelCalls, modelErrors, turns:m?.cycleCount,
        inputTokens:m?.accumulatedUsage?.inputTokens, outputTokens:m?.accumulatedUsage?.outputTokens,
        durationMs:Math.round(performance.now()-started),
        stopReason:signal?.aborted ? 'cancelled' : result?.stopReason ?? 'error',
        structuredOutputPresent:result?.structuredOutput !== undefined});
      Promise.resolve(onMetrics(record)).catch(() => {});
    } catch { /* Non-authoritative telemetry. */ }
  }};
}
