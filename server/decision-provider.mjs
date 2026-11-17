import { readGatewaySettings, assertSyntheticEvent } from './gateway-config.mjs';
import { invocationSignal, sanitizeModelMetrics } from './strands-runtime.mjs';
import { DECISION_INSTRUCTIONS, DECISION_CRITERIA, sortKeysDeep } from './prompts.mjs';

/**
 * Dos métricas independientes de Jev, solo para evaluación.
 * - labelProbability: answers.signal.probabilities[choice] (lo que el Gateway entrega en la respuesta).
 * - typesafeConfidence: providerMetadata.typesafe.confidence.signal. El Gateway valida `answers` con un
 *   esquema que solo conserva type/choice/probabilities y descarta cualquier otro campo, así que una
 *   «confidence» dentro de la respuesta nunca llega; providerMetadata sí se transmite sin cambios.
 *   Ruta confirmada con una llamada real (13-11-2026).
 * confidence conserva el valor que el umbral ha usado siempre (la probabilidad de la etiqueta):
 * no se cambia el umbral en el mismo paquete que la medición.
 */
export function decisionConfidence(answer, providerMetadata) {
  const label = answer?.choice;
  const probabilities = answer?.probabilities;
  const labelProbability = probabilities && !Array.isArray(probabilities) && Number.isFinite(probabilities[label])
    ? probabilities[label] : null;
  const raw = providerMetadata?.typesafe?.confidence?.signal;
  const typesafeConfidence = Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : null;
  return { confidence: labelProbability, labelProbability, typesafeConfidence };
}

/** Decisión cerrada REMOTA mediante Vercel AI Gateway (no Strands Decider local). */
export async function createRemoteDecisionClassifier({ env = process.env } = {}) {
  const settings = readGatewaySettings(env);
  if (!settings.enabled) throw new Error('TURNO_AI_ENABLED debe ser 1 para crear el clasificador.');
  const { experimental_decide: decide, gateway: defaultGateway, createGateway } = await import('ai');
  // Use the key from the validated env, not only process.env; without a key, OIDC via the default provider.
  const key = typeof env.AI_GATEWAY_API_KEY === 'string' ? env.AI_GATEWAY_API_KEY.trim() : '';
  const gateway = key ? createGateway({ apiKey: key }) : defaultGateway;
  return async function classifyWithDecision(event, {signal, onMetrics} = {}) {
    signal?.throwIfAborted();
    assertSyntheticEvent(event, settings);
    if (typeof event.text !== 'string' || event.text.length < 1 || event.text.length > 500) {
      throw new Error('Entrada de clasificación fuera de límites.');
    }
    const started = performance.now();
    let result;
    try {
      result = await decide({
        model: gateway.decisionModel(settings.decisionModelId),
        state: sortKeysDeep({ text: event.text }),
        questions: sortKeysDeep({
          signal: {
            type: 'choice',
            instructions: DECISION_INSTRUCTIONS,
            criteria: DECISION_CRITERIA,
          },
        }),
        maxRetries: 0,
        abortSignal: invocationSignal(signal, 20_000),
      });
      signal?.throwIfAborted();
      const answer = result?.answers?.signal;
      const label = answer?.choice;
      // Ambas señales quedan disponibles para evaluar Jev, sin alterar el umbral vigente.
      return { label, ...decisionConfidence(answer, result?.providerMetadata) };
    } finally {
      if (typeof onMetrics === 'function') {
        try {
          Promise.resolve(onMetrics(sanitizeModelMetrics({
            modelCalls:1, modelErrors:result ? 0 : 1,
            inputTokens:result?.usage?.inputTokens, outputTokens:result?.usage?.outputTokens,
            durationMs:Math.round(performance.now()-started),
            stopReason:signal?.aborted ? 'cancelled' : result ? 'completed' : 'error',
          }))).catch(() => {});
        } catch { /* Metrics never change the decision. */ }
      }
    }
  };
}
