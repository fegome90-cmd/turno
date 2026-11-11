import { readGatewaySettings, assertSyntheticEvent } from './gateway-config.mjs';
import { createStrandsModel } from './model-factory.mjs';
import { CLASSIFIER_PROMPT } from './prompts.mjs';
import { assertUsableStructuredOutput } from './gateway-capture.mjs';

/**
 * Strands es el agente principal. El proveedor (Vercel AI Gateway por defecto)
 * solo suministra inferencia remota. No hay tools de escritura, ni frontend, ni sesión compartida.
 */
export async function createStrandsClassifier({ env = process.env, onMetrics } = {}) {
  const settings = readGatewaySettings(env);
  if (!settings.enabled) throw new Error('TURNO_AI_ENABLED debe ser 1 para crear el agente.');
  const [{ Agent }, { z }] = await Promise.all([import('@strands-agents/sdk'), import('zod')]);
  const schema = z.object({ label: z.enum(['NO_ACTION','PROPOSE_TASK','PROPOSE_REMINDER','NEEDS_REVIEW']) });
  return async function classifyWithGateway(event) {
    assertSyntheticEvent(event, settings);
    if (typeof event.text !== 'string' || event.text.length < 1 || event.text.length > 500) {
      throw new Error('Entrada de clasificación fuera de límites.');
    }
    // Agent por invocación: sin conversación o historial entre turnos.
    const agent = new Agent({
      model: await createStrandsModel(settings, { maxTokens: 1200, env }),
      systemPrompt: CLASSIFIER_PROMPT,
      structuredOutputSchema: schema,
      tools: [],
      printer: false,
    });
    try {
      const result = await agent.invoke(JSON.stringify({ text: event.text }), {
        cancelSignal: AbortSignal.timeout(20_000),
        limits: { turns: 1, outputTokens: 1200, totalTokens: 3000, structuredOutputAttempts: 1 },
      });
      // Igual que la captura: cancelado, filtrado o sin salida estructurada = fallo (el motor se abstiene).
      const structuredOutput = assertUsableStructuredOutput(result);
      if (typeof onMetrics === 'function') {
        const usage = result.metrics?.toJSON?.()?.accumulatedUsage;
        try {
          onMetrics(Object.freeze({
            inputTokens: Number.isFinite(usage?.inputTokens) ? usage.inputTokens : null,
            outputTokens: Number.isFinite(usage?.outputTokens) ? usage.outputTokens : null,
          }));
        } catch { /* Observability cannot change the model result. */ }
      }
      return schema.parse(structuredOutput);
    } finally {
      await agent.shutdown();
    }
  };
}
