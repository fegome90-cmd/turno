// Portado de v5 src/draft-state.mjs. El borrador temporal conserva el texto crudo hasta validar.
import {displayDate, parseDate} from './format';
import type {Task, TemporalDraft} from './types';

export function createTemporalDraft(task?: Task | null): TemporalDraft {
  return {
    date: task?.date ? displayDate(task.date) : '',
    time: task?.time || '',
    estimate: task?.estimate ?? '',
    performed: task?.performed || '',
    duration: task?.duration ?? '',
  };
}

// Devuelve una copia nueva; lanza si la fecha cruda no existe. No muta `task`.
export function applyTemporalDraft(task: Task, raw: TemporalDraft): Task {
  return {
    ...task,
    date: parseDate(raw.date),
    time: raw.time.trim(),
    estimate: String(raw.estimate).trim(),
    performed: raw.performed.trim(),
    duration: String(raw.duration).trim(),
  };
}
