import {createTurnoExtensions} from './strands-extensions.mjs';
import { invocationSignal, attachLifecycleMetrics } from './strands-runtime.mjs';
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
  const [sdk, { z }] = await Promise.all([import('@strands-agents/sdk'), import('zod')]);
  const {Agent} = sdk;
  const schema = z.object({ label: z.enum(['NO_ACTION','PROPOSE_TASK','PROPOSE_REMINDER','NEEDS_REVIEW']) });
  return async function classifyWithGateway(event, {signal, modelContext, onMetrics: callMetrics = onMetrics} = {}) {
    signal?.throwIfAborted();
    assertSyntheticEvent(event, settings);
    if (typeof event.text !== 'string' || event.text.length < 1 || event.text.length > 500) {
      throw new Error('Entrada de clasificación fuera de límites.');
    }
    // Agent por invocación: sin conversación o historial entre turnos.
    const extensions = createTurnoExtensions({stage:'classification', modelContext, signal});
    const agent = new Agent({
      ...extensions,
      model: await createStrandsModel(settings, { maxTokens: 1200, env }),
      systemPrompt: CLASSIFIER_PROMPT,
      structuredOutputSchema: schema,
      tools: [],
      printer: false,
    });
    const observer = attachLifecycleMetrics(agent, sdk, callMetrics);
    let result;
    try {
      signal?.throwIfAborted();
      result = await agent.invoke(JSON.stringify({ text: event.text }), {
        cancelSignal: invocationSignal(signal, 20_000),
        limits: { turns: 1, outputTokens: 1200, totalTokens: 3000, structuredOutputAttempts: 1 },
      });
      // Igual que la captura: cancelado, filtrado o sin salida estructurada = fallo (el motor se abstiene).
      signal?.throwIfAborted();
      const structuredOutput = assertUsableStructuredOutput(result);
      return schema.parse(structuredOutput);
    } finally {
      observer.finish(result, signal);
      await agent.shutdown();
    }
  };
}
