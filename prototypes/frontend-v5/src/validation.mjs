import {parseDate} from './format.mjs';

// UI-only error locations. The preview adapter remains the final data validator.
export function validateEditor(draft, temporal, note = false) {
  const errors = {};
  if (!draft.title?.trim() || draft.title.length > 300) errors.title = 'Escribe un título de 1 a 300 caracteres.';
  if (typeof draft.body !== 'string' || draft.body.length > 10000) errors.body = 'Notas: usa como máximo 10.000 caracteres.';
  if (note) return errors;
  let date;
  try { date = parseDate(temporal.date); } catch (error) { errors.date = error.message; }
  const time = String(temporal.time).trim();
  if (time && !date && !errors.date) errors.date = 'Agrega una fecha antes de indicar una hora.';
  for (const [key, label] of [['time', 'Hora prevista'], ['estimate', 'Estimación'], ['performed', 'Hora realizada'], ['duration', 'Duración registrada']]) {
    const value = String(temporal[key] ?? '').trim();
    if (!value) continue;
    if (key === 'time' || key === 'performed') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) errors[key] = `${label}: usa una hora de 24 horas, por ejemplo 14:30.`;
    } else if (!/^\d+$/.test(value) || Number(value) > 1440) {
      errors[key] = `${label}: usa minutos enteros entre 0 y 1440.`;
    }
  }
  return errors;
}
