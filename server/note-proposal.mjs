import {createTurnoExtensions} from './strands-extensions.mjs';
import { invocationSignal, attachLifecycleMetrics } from './strands-runtime.mjs';
import { readGatewaySettings } from './gateway-config.mjs';

// Medido en vivo (12-11-2026): una extracción correcta usa 276–569 tokens de salida;
// con 600, 3 de 26 se cortaban (MaxTokensError). 1200 deja margen sin abrir la puerta a respuestas largas.
export const NOTE_OUTPUT_TOKENS = 1200;
export const NOTE_TOTAL_TOKENS = 5000;
// Turn 1 may be prose; turn 2 is the forced structured retry. Per-call cap stays NOTE_OUTPUT_TOKENS.
export const NOTE_LIMITS = Object.freeze({
  turns: 2,
  structuredOutputAttempts: 2,
  outputTokens: 2 * NOTE_OUTPUT_TOKENS,
  totalTokens: NOTE_TOTAL_TOKENS,
});
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
  const [sdk, { z }] = await Promise.all([import('@strands-agents/sdk'), import('zod')]);
  const {Agent} = sdk;
  const schema = z.object({
    action: z.object({ title: z.string(), sourceQuote: z.string() }).nullable(),
  });
  return async function extractNoteProposal(noteText, {signal, modelContext, onMetrics: callMetrics = onMetrics} = {}) {
    signal?.throwIfAborted();
    if (typeof noteText !== 'string' || noteText.length < 1 || noteText.length > 500) {
      throw new Error('Nota fuera de límites para extracción.');
    }
    const extensions = createTurnoExtensions({stage:'extraction', modelContext, signal});
    const agent = new Agent({
      ...extensions,
      model: await createStrandsModel(config, { maxTokens: NOTE_OUTPUT_TOKENS, env }),
      systemPrompt: NOTE_PROPOSAL_PROMPT,
      structuredOutputSchema: schema,
      tools: [],
      printer: false,
    });
    const observer = attachLifecycleMetrics(agent, sdk, callMetrics);
    let result;
    try {
      signal?.throwIfAborted();
      result = await agent.invoke(JSON.stringify({ note: noteText }), {
        cancelSignal: invocationSignal(signal, 20_000),
        limits: NOTE_LIMITS,
      });
      signal?.throwIfAborted();
      const structuredOutput = assertUsableStructuredOutput(result);
      return schema.parse(structuredOutput);
    } finally {
      observer.finish(result, signal);
      await agent.shutdown();
    }
  };
}
