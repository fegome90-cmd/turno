/**
 * Review-only boundary. The model proposes text and scheduling hints;
 * Turno's authenticated backend remains the only component allowed to save.
 */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TITLE_LIMIT = 300;
const INPUT_LIMIT = 2500;

/** Accepts HH:MM or H:MM (24 h). Anything else returns null. */
export function normalizeTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const out = hh + ':' + m[2];
  return HHMM.test(out) ? out : null;
}

// Formas en que el texto fuente puede escribir una hora: «15:00», «15.00», «9:00»,
// «15h», «15 h», «15hs», «15 hrs», «a las 15». Un número de cama («cama 15») no cuenta.
const SOURCE_HOUR_FORMS = [
  /(?<!\d)(\d{1,2})\s?(?:[:.]|h)\s?(\d{2})(?!\d)/gi,
  /\ba\s+las?\s+(\d{1,2})(?!\d)(?:\s?[:.]\s?(\d{2})(?!\d))?/gi,
  /(?<!\d)(\d{1,2})\s?h(?:oras?|rs?|s)?\b/gi,
];

/** True when the source text writes this HH:MM hour. Written minutes must agree; unwritten minutes only support :00 («a las 15» ≠ 15:30). */
function sourceHasTime(sourceText, time) {
  const hour = Number(time.slice(0, 2));
  const minutes = time.slice(3);
  return SOURCE_HOUR_FORMS.some(re => [...sourceText.matchAll(re)].some(m =>
    Number(m[1]) === hour && (m[2] === undefined ? minutes === '00' : m[2] === minutes)));
}

export function validateCaptureInput(input) {
  if (!input || input.synthetic !== true) throw new Error('Piloto limitado a datos sintéticos.');
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > INPUT_LIMIT) {
    throw new Error('Captura inválida o demasiado extensa.');
  }
  if (!/^[\w-]{1,80}$/.test(input.shiftId || '')) throw new Error('Falta shiftId válido.');
  return { text: input.text.trim(), shiftId: input.shiftId };
}

export function proposalsForReview(raw, context) {
  if (!raw || !Array.isArray(raw.proposals) || raw.proposals.length > 10) {
    throw new Error('Propuestas con formato inválido.');
  }
  const beds = Array.isArray(context?.beds) ? context.beds : [];
  const sourceText = typeof context?.sourceText === 'string' ? context.sourceText : null;
  return Object.freeze(raw.proposals.map((p, i) => {
    if (!p || typeof p.title !== 'string' || !p.title.trim() || p.title.length > TITLE_LIMIT) {
      throw new Error('Título de propuesta inválido.');
    }
    if (p.bedLabel != null && (typeof p.bedLabel !== 'string' || p.bedLabel.length > 100)) {
      throw new Error('Etiqueta de cama inválida.');
    }
    if (p.time != null && typeof p.time !== 'string') throw new Error('Horario inválido.');
    // «9:00» -> «09:00». Una hora que no se entiende no tumba la captura: queda
    // vacía y marcada para confirmar. Nunca se inventa una hora.
    const normalized = normalizeTime(p.time);
    const timeUnclear = typeof p.time === 'string' && p.time.trim() !== '' && normalized === null;
    if (p.beforeClose !== true && p.beforeClose !== false) throw new Error('Condición de cierre inválida.');
    if (p.beforeClose && normalized) throw new Error('No atribuir hora a «antes del cierre».');
    // P2-02: una hora válida que el texto fuente no escribe tampoco se atribuye; se pide confirmación.
    const timeMissingFromSource = normalized !== null && sourceText !== null && !sourceHasTime(sourceText, normalized);
    const time = timeMissingFromSource ? null : normalized;
    const needsTimeConfirmation = timeUnclear || timeMissingFromSource;
    const bedLabel = p.bedLabel?.trim() || null;
    const matching = bedLabel ? beds.filter(b => b.label === bedLabel) : [];
    const linkedBedId = matching.length === 1 ? matching[0].id : null;
    return Object.freeze({
      proposalId: 'proposal-' + (i + 1),
      title: p.title.trim(),
      bedLabel,
      bedId: linkedBedId,
      time,
      // Texto original de una hora ilegible, solo para que la persona la confirme; nunca se usa como hora.
      timeText: needsTimeConfirmation ? p.time.trim().slice(0, TITLE_LIMIT) : null,
      date: null, // Never infer the date from time or today's clock.
      beforeClose: p.beforeClose,
      completed: false,
      status: 'requires_human_review',
      reviewFlags: Object.freeze([
        ...(bedLabel && !linkedBedId ? ['resolve_bed'] : []),
        ...(time ? ['confirm_date'] : []),
        ...(needsTimeConfirmation ? ['confirm_time'] : []),
      ]),
    });
  }));
}

/** Takes an injectable Strands caller; never saves to any app database. */
export async function prepareCaptureReview(input, { invoke, beds = [] }) {
  const safe = validateCaptureInput(input);
  if (typeof invoke !== 'function') throw new Error('Agente Strands no disponible.');
  const raw = await invoke({
    inputText: safe.text,
    instruction: 'Extract tasks only, no writes. Preserve unresolved timing and bed references.',
  });
  return Object.freeze({
    status: 'review_required',
    shiftId: safe.shiftId,
    proposals: proposalsForReview(raw, { beds, sourceText: safe.text }),
  });
}
