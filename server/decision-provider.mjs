import { readGatewaySettings, assertSyntheticEvent } from './gateway-config.mjs';

/** Decisión cerrada REMOTA mediante Vercel AI Gateway (no Strands Decider local). */
export async function createRemoteDecisionClassifier({ env = process.env } = {}) {
  const settings = readGatewaySettings(env);
  if (!settings.enabled) throw new Error('TURNO_AI_ENABLED debe ser 1 para crear el clasificador.');
  const [{ experimental_decide: decide }, { gateway }] = await Promise.all([
    import('ai'), import('@ai-sdk/gateway'),
  ]);
  return async function classifyWithDecision(event) {
    assertSyntheticEvent(event, settings);
    if (typeof event.text !== 'string' || event.text.length < 1 || event.text.length > 500) {
      throw new Error('Entrada de clasificación fuera de límites.');
    }
    const result = await decide({
      model: gateway.decisionModel(settings.decisionModelId),
      state: { text: event.text },
      questions: {
        signal: {
          type: 'choice',
          instructions: 'Clasifica una nota personal sintética de un gestor de tareas. No diagnostiques, ni actúes. Si es ambiguo, elige NEEDS_REVIEW.',
          criteria: {
            NO_ACTION: 'No expresa ninguna tarea ni solicitud de recordatorio.',
            PROPOSE_TASK: 'Expresa una tarea pendiente sin solicitar notificación.',
            PROPOSE_REMINDER: 'Solicita explícitamente un recordatorio o aviso.',
            NEEDS_REVIEW: 'Contenido ambiguo, condicional, negado o insuficiente.',
          },
        },
      },
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20_000),
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
