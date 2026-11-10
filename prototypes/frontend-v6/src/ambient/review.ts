// Contrato de captura: prepara la revisión sin inferencia ni llamadas a modelos.
import type {ReviewedTaskInput, Snapshot, Task} from '../domain/types';
import {displayDate, parseDate} from '../domain/format';

export type ReviewDraft = {
  localId: string;
  title: string;
  bedId: string;
  date: string;
  time: string;
  beforeClose: boolean;
};

export type AmbientSuggestion = {
  id: string;
  kind: 'shared-slot' | 'before-close';
  title: string;
  detail: string;
  taskIds: string[];
};

export function newReviewDraft(localId: string, title = ''): ReviewDraft {
  return {localId, title, bedId: '', date: '', time: '', beforeClose: false};
}

export function reviewInput(draft: ReviewDraft, snapshot: Snapshot | null): {value?: ReviewedTaskInput; error?: string} {
  const shift = snapshot?.shifts.find((item) => item.id === snapshot.activeShiftId && item.status === 'open');
  if (!shift) return {error: 'No hay un turno abierto para guardar.'};
  const title = draft.title.trim();
  if (!title || title.length > 300) return {error: 'El título debe contener entre 1 y 300 caracteres.'};
  if (draft.bedId && !snapshot?.beds.some((bed) => bed.id === draft.bedId && bed.shiftId === shift.id)) {
    return {error: 'Selecciona una lista válida del turno.'};
  }
  const date = draft.date.trim();
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return {error: 'Fecha inválida.'};
    try {parseDate(displayDate(date));} catch {return {error: 'Fecha inválida.'};}
  }
  if (draft.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return {error: 'Hora inválida.'};
  if (draft.time && !date) return {error: 'Confirma una fecha antes de guardar una hora.'};
  if (draft.beforeClose && (date || draft.time)) {
    return {error: '«Antes del cierre» no debe tener una fecha ni hora programada.'};
  }
  return {value: {
    shiftId: shift.id, title, bedId: draft.bedId || null,
    date: date || null, time: draft.time, beforeClose: draft.beforeClose,
  }};
}

export function collectAmbientSuggestions(snapshot: Snapshot | null): AmbientSuggestion[] {
  if (!snapshot?.activeShiftId || !snapshot.shifts.some((shift) => shift.id === snapshot.activeShiftId && shift.status === 'open')) return [];
  const pending = snapshot.tasks.filter((task) => task.shiftId === snapshot.activeShiftId && !task.completed);
  const bySlot = new Map<string, Task[]>();
  for (const task of pending) {
    // Los horarios no confirmados no producen conclusiones.
    if (!task.bedId || !task.date || !task.time) continue;
    const key = JSON.stringify([task.bedId, task.date, task.time]);
    const list = bySlot.get(key) || [];
    list.push(task);
    bySlot.set(key, list);
  }
  const suggestions: AmbientSuggestion[] = [];
  for (const [key, tasks] of bySlot) {
    if (tasks.length < 2) continue;
    const [bedId, date, time] = JSON.parse(key) as [string, string, string];
    const label = snapshot.beds.find((bed) => bed.id === bedId)?.label ?? 'Lista sin nombre';
    const ids = tasks.map((task) => task.id).sort();
    suggestions.push({
      id: 'shared:' + snapshot.activeShiftId + ':' + bedId + ':' + date + ':' + time + ':' + ids.join(':'),
      kind: 'shared-slot',
      title: 'Tareas en el mismo horario',
      detail: `${tasks.length} tareas pendientes en ${label}, ${displayDate(date)} a las ${time}. Podrían requerir coordinación; esto no demuestra duplicidad.`,
      taskIds: ids,
    });
  }
  const closeTasks = pending.filter((task) => task.beforeClose === true);
  if (closeTasks.length) {
    const ids = closeTasks.map((task) => task.id).sort();
    suggestions.push({
      id: 'before-close:' + snapshot.activeShiftId + ':' + ids.join(':'),
      kind: 'before-close',
      title: 'Pendientes antes del cierre',
      detail: `${closeTasks.length} ${closeTasks.length === 1 ? 'tarea sigue pendiente' : 'tareas siguen pendientes'} con la condición «antes del cierre».`,
      taskIds: ids,
    });
  }
  return suggestions;
}
