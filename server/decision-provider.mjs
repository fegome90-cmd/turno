import { readGatewaySettings, assertSyntheticEvent } from './gateway-config.mjs';
import { DECISION_INSTRUCTIONS, DECISION_CRITERIA, sortKeysDeep } from './prompts.mjs';

/** Decisión cerrada REMOTA mediante Vercel AI Gateway (no Strands Decider local). */
export async function createRemoteDecisionClassifier({ env = process.env } = {}) {
  const settings = readGatewaySettings(env);
  if (!settings.enabled) throw new Error('TURNO_AI_ENABLED debe ser 1 para crear el clasificador.');
  const { experimental_decide: decide, gateway: defaultGateway, createGateway } = await import('ai');
  // Use the key from the validated env, not only process.env; without a key, OIDC via the default provider.
  const key = typeof env.AI_GATEWAY_API_KEY === 'string' ? env.AI_GATEWAY_API_KEY.trim() : '';
  const gateway = key ? createGateway({ apiKey: key }) : defaultGateway;
  // options.signal (P1-03): cancelación del llamador; se combina con el límite de 20 s.
  return async function classifyWithDecision(event, { signal } = {}) {
    assertSyntheticEvent(event, settings);
    if (typeof event.text !== 'string' || event.text.length < 1 || event.text.length > 500) {
      throw new Error('Entrada de clasificación fuera de límites.');
    }
    const result = await decide({
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
      abortSignal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
    });
    const answer = result?.answers?.signal;
    const label = answer?.choice;
    // Los modelos de decisión no siempre entregan probabilidades comparables.
    const p = answer?.probabilities;
    const confidence = Number.isFinite(answer?.confidence) ? answer.confidence
      : (p && !Array.isArray(p) && Number.isFinite(p[label]) ? p[label] : null);
    return { label, confidence };
  };
}
