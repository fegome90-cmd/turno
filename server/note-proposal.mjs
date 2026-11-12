import { readGatewaySettings } from './gateway-config.mjs';
import { createStrandsModel } from './model-factory.mjs';
import { NOTE_PROPOSAL_PROMPT } from './prompts.mjs';
import { assertUsableStructuredOutput } from './gateway-capture.mjs';

/**
 * R5a: extracción de una sola acción desde una nota guardada (sintética).
 * Mismas garantías que gateway-capture.mjs: un turno, sin herramientas ni memoria,
 * límites de tokens y cancelación. La salida se valida antes de usarse.
 */
const TITLE_MIN = 3;
const TITLE_MAX = 80;
const TIME_PATTERN = /\b\d{1,2}[:.]\d{2}\b/;
const DATE_PATTERN = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/;
// «15h», «15 hrs» y fechas relativas («hoy», «mañana», días de la semana) también son horario o fecha inventados.
const HOUR_PATTERN = /\b\d{1,2}\s?(?:h|hs|hrs?)\b/i;
const RELATIVE_DATE_PATTERN = /(?:^|[^\p{L}])(?:hoy|mañana|pasado mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo)(?![\p{L}])/iu;
// Una cita muy corta no respalda nada: se exige un fragmento mínimo de la nota.
const QUOTE_MIN = 8;

/**
 * Función pura. Devuelve { title, sourceQuote } o null (silencio). Nunca corrige una
 * salida dudosa: si algo no cuadra, descarta.
 */
export function validateNoteProposal(raw, noteText) {
  if (!raw || typeof raw !== 'object' || !Object.hasOwn(raw, 'action')) return null;
  const action = raw.action;
  if (!action || typeof action !== 'object' ||
      typeof action.title !== 'string' || typeof action.sourceQuote !== 'string') return null;
  const title = action.title.trim();
  const sourceQuote = action.sourceQuote.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) return null;
  if (TIME_PATTERN.test(title) || DATE_PATTERN.test(title) || HOUR_PATTERN.test(title) || RELATIVE_DATE_PATTERN.test(title)) return null;
  if (sourceQuote.length < QUOTE_MIN || typeof noteText !== 'string' || !noteText.includes(sourceQuote)) return null;
  return { title, sourceQuote };
}

export async function createStrandsNoteExtractor({ env = process.env, onMetrics } = {}) {
  const config = readGatewaySettings(env);
  if (!config.enabled) throw new Error('Extracción de notas desactivada (TURNO_AI_ENABLED=0).');
  const [{ Agent }, { z }] = await Promise.all([import('@strands-agents/sdk'), import('zod')]);
  const schema = z.object({
    action: z.object({ title: z.string(), sourceQuote: z.string() }).nullable(),
  });
  return async function extractNoteProposal(noteText) {
    if (typeof noteText !== 'string' || noteText.length < 1 || noteText.length > 500) {
      throw new Error('Nota fuera de límites para extracción.');
    }
    const agent = new Agent({
      model: await createStrandsModel(config, { maxTokens: 600, env }),
      systemPrompt: NOTE_PROPOSAL_PROMPT,
      structuredOutputSchema: schema,
      tools: [],
      printer: false,
    });
    try {
      const result = await agent.invoke(JSON.stringify({ note: noteText }), {
        cancelSignal: AbortSignal.timeout(20_000),
        limits: { turns: 1, outputTokens: 600, totalTokens: 2500, structuredOutputAttempts: 1 },
      });
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
