import {createTurnoExtensions} from './strands-extensions.mjs';
import { invocationSignal, attachLifecycleMetrics } from './strands-runtime.mjs';
import { readGatewaySettings } from './gateway-config.mjs';
import { createStrandsModel } from './model-factory.mjs';
import { CAPTURE_PROMPT } from './prompts.mjs';
import { prepareCaptureReview, validateCaptureInput } from './capture-review.mjs';

/**
 * Ephemeral Strands Agent (Vercel AI Gateway by default; see model-providers.mjs).
 * - One model turn, no tools and no chat memory
 * - Request-wide token limits + abort signal
 * - Only synthetic inputs; never writes to Turno
 * - Credentials come from the server environment only
 */
const SUCCESS_STOP_REASONS = new Set(['toolUse', 'endTurn', 'stopSequence']);

/**
 * A cancelled, filtered or budget-exhausted run must never be considered a
 * successful extraction, even if the SDK carried partial structured output.
 * Strands returns 'toolUse' when its structured-output tool succeeds.
 */
export function assertUsableStructuredOutput(result) {
  if (!result || !SUCCESS_STOP_REASONS.has(result.stopReason) ||
      result.structuredOutput === undefined) {
    throw new Error('Strands no completó una salida estructurada válida.');
  }
  return result.structuredOutput;
}

export async function createStrandsCapture({ env = process.env, onMetrics } = {}) {
  const config = readGatewaySettings(env);
  if (!config.enabled) throw new Error('Captura inteligente desactivada (TURNO_AI_ENABLED=0).');
  const [sdk, { z }] = await Promise.all([import('@strands-agents/sdk'), import('zod')]);
  const {Agent} = sdk;
  const schema = z.object({
    proposals: z.array(z.object({
      title: z.string(),
      bedLabel: z.string().nullable(),
      time: z.string().nullable(),
      beforeClose: z.boolean(),
    })).max(10),
  });
  return async function propose(input, { isAuthorized, beds = [], signal, onMetrics: callMetrics = onMetrics } = {}) {
    signal?.throwIfAborted();
    // Validate strictly BEFORE any model invocation, even in an isolated harness.
    validateCaptureInput(input);
    if (typeof isAuthorized !== 'function' || await isAuthorized(input) !== true) {
      throw new Error('Captura sin autorización del backend.');
    }
    return prepareCaptureReview(input, {
      beds,
      invoke: async ({ inputText, instruction }) => {
        const extensions = createTurnoExtensions({stage:'capture', modelContext:{source:'capture-input'}, signal});
        const agent = new Agent({
          ...extensions,
          model: await createStrandsModel(config, { maxTokens: 1200, env }),
          systemPrompt: CAPTURE_PROMPT,
          structuredOutputSchema: schema,
          tools: [],
          printer: false,
        });
        const observer = attachLifecycleMetrics(agent, sdk, callMetrics);
        let result;
        try {
          signal?.throwIfAborted();
          result = await agent.invoke(JSON.stringify({ instruction, text: inputText }), {
            // Enforced at Strands level. Gateway could still use internal routing/failover.
            cancelSignal: invocationSignal(signal, 30_000),
            limits: {
              turns: 1,
              outputTokens: 1200,
              totalTokens: 4000,
              structuredOutputAttempts: 1,
            },
          });
          signal?.throwIfAborted();
          const structuredOutput = assertUsableStructuredOutput(result);
          return schema.parse(structuredOutput);
        } finally {
          observer.finish(result, signal);
          await agent.shutdown();
        }
      },
    });
  };
}
