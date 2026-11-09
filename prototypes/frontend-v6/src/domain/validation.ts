// Portado de v5 src/validation.mjs. Localizaciones de error solo para la UI; el adaptador sigue validando.
import {parseDate} from './format';
import type {FieldErrors, QuickNote, Task, TemporalDraft} from './types';

export type TemporalKind = 'time' | 'minutes';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Regla v5: hora 24 h HH:MM; minutos enteros 0–1440; vacío es válido y no es cero. Devuelve null si es válido.
// El texto se valida recortado (trim) de espacios de los extremos; el valor crudo del borrador no cambia.
export function validateTemporal(kind: TemporalKind, label: string, raw: string): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (kind === 'time') return TIME.test(value) ? null : `${label}: usa una hora de 24 horas, por ejemplo 14:30.`;
  return !/^\d+$/.test(value) || Number(value) > 1440 ? `${label}: usa minutos enteros entre 0 y 1440.` : null;
}

export function validateEditor(draft: Task, temporal: TemporalDraft, note?: false): FieldErrors;
export function validateEditor(draft: QuickNote, temporal: TemporalDraft | null, note: true): FieldErrors;
export function validateEditor(draft: Task | QuickNote, temporal: TemporalDraft | null, note = false): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.title?.trim() || draft.title.length > 300) errors.title = 'Escribe un título de 1 a 300 caracteres.';
  if (typeof draft.body !== 'string' || draft.body.length > 10000) {
    errors.body = 'Notas: usa como máximo 10.000 caracteres.';
  }
  if (note || temporal === null) return errors;

  let date: string | null = null;
  try {
    date = parseDate(temporal.date);
  } catch (error) {
    errors.date = (error as Error).message;
  }
  const time = String(temporal.time).trim();
  if (time && !date && !errors.date) errors.date = 'Agrega una fecha antes de indicar una hora.';

  const fields = [
    ['time', 'Hora prevista', 'time'],
    ['estimate', 'Estimación', 'minutes'],
    ['performed', 'Hora realizada', 'time'],
    ['duration', 'Duración registrada', 'minutes'],
  ] as const;
  for (const [key, label, kind] of fields) {
    const message = validateTemporal(kind, label, temporal[key]);
    if (message) errors[key] = message;
  }
  return errors;
}
