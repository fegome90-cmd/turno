// Adaptador de demo en memoria. Portado de v5 src/preview-adapter.mjs.
// D7 (GLOSARIO.md): el término v5 del grupo de tareas pasa a «Lista» en el texto visible. Los nombres internos (Bed, bedId, renameBed) y los IDs no cambian.
// Sin red, sin almacenamiento: cada instancia guarda su propio estado.
import {displayDate, localDate, parseDate} from '../domain/format';
import type {Bed, QuickNote, Shift, Snapshot, Task} from '../domain/types';
import type {PreviewPort} from './turno-port';

export type PreviewOptions = {delay?: number; preferredName?: string};

type Failure = 'error' | 'conflict';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const clone = <T>(value: T): T => structuredClone(value);

const titled = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 300) {
    throw new Error('Escribe un título de 1 a 300 caracteres.');
  }
  return value.trim();
};

function validateTask(task: Task): Task {
  const title = titled(task.title);
  if (typeof task.body !== 'string' || task.body.length > 10000) throw new Error('Notas: máximo 10.000 caracteres.');
  if (task.date) parseDate(displayDate(task.date));
  for (const value of [task.time, task.performed]) {
    if (value && !TIME.test(value)) throw new Error('Usa una hora válida de 24 horas: HH:mm.');
  }
  if (task.time && !task.date) throw new Error('Agrega una fecha antes de indicar una hora.');
  if (task.beforeClose && (task.date || task.time)) throw new Error('Antes del cierre no tiene fecha ni hora programada.');
  for (const value of [task.estimate, task.duration]) {
    if (value !== '' && (!/^\d+$/.test(String(value)) || Number(value) > 1440)) {
      throw new Error('Usa minutos entre 0 y 1440.');
    }
  }
  if (!['normal', 'high', 'low'].includes(task.priority)) throw new Error('Prioridad no válida.');
  return {...task, title};
}

function seed(preferredName: string): Snapshot {
  return {
    profile: {preferredName},
    activeShiftId: 'demo-shift-1',
    shifts: [{id: 'demo-shift-1', label: 'Turno de día', date: '2026-11-07', status: 'open'}],
    beds: [
      {id: 'bed-1', shiftId: 'demo-shift-1', label: 'Lista 1'},
      {id: 'bed-2', shiftId: 'demo-shift-1', label: 'Lista 2'},
    ],
    notes: [{id: 'note-1', title: 'Notas generales', body: '', version: 1}],
    tasks: [
      {id: 'task-1', shiftId: 'demo-shift-1', bedId: 'bed-1', title: 'Tarea 1', body: '', reason: 'Exámenes', priority: 'normal', date: '2026-11-07', time: '', estimate: '', performed: '', duration: '', completed: false, version: 1},
      {id: 'task-2', shiftId: 'demo-shift-1', bedId: 'bed-1', title: 'Revisar insumos', body: '', reason: 'Organización', priority: 'normal', date: '2026-11-07', time: '11:30', estimate: '20', performed: '', duration: '', completed: false, version: 1},
      {id: 'task-3', shiftId: 'demo-shift-1', bedId: 'bed-1', title: 'Preparar educación', body: '', reason: 'Preparación', priority: 'normal', date: null, time: '', estimate: '', performed: '', duration: '', completed: false, version: 1},
      {id: 'task-4', shiftId: 'demo-shift-1', bedId: 'bed-2', title: 'Revisar material', body: '', reason: 'Organización', priority: 'high', date: '2026-11-07', time: '14:00', estimate: '', performed: '', duration: '', completed: false, version: 1},
    ],
  };
}

export function createPreviewAdapter({delay = 0, preferredName = 'Demo'}: PreviewOptions = {}): PreviewPort {
  let failure: Failure | null = null;
  let sequence = 10;
  const state = seed(preferredName);

  const current = (): Shift => {
    const shift = state.shifts.find((item) => item.id === state.activeShiftId && item.status === 'open');
    if (!shift) throw new Error('Inicia un turno para continuar.');
    return shift;
  };

  async function wait(): Promise<void> {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (failure) {
      const kind = failure;
      failure = null;
      const error = new Error(
        kind === 'conflict'
          ? 'Conflicto simulado. No se aplicó el cambio. Vuelve a intentar la acción.'
          : 'Fallo simulado de conexión. No se aplicó el cambio. Vuelve a intentar la acción.',
      ) as Error & {code?: string};
      error.code = kind === 'conflict' ? 'SIMULATED_CONFLICT' : 'SIMULATED_FAILURE';
      throw error;
    }
  }

  return {
    async load() {
      await wait();
      return clone(state);
    },
    failNext(kind) {
      failure = kind;
    },
    async saveTask(task) {
      await wait();
      const index = state.tasks.findIndex((item) => item.id === task.id);
      if (index < 0) throw new Error('Tarea no encontrada.');
      const old = state.tasks[index];
      if (state.shifts.find((shift) => shift.id === old.shiftId)?.status !== 'open') {
        throw new Error('Este turno está cerrado y es de solo lectura.');
      }
      if (old.version !== task.version) throw new Error('La versión cambió. Tu borrador se conserva.');
      if (task.shiftId !== old.shiftId || task.bedId !== old.bedId) throw new Error('Relación de tarea no válida.');
      const valid = validateTask(task);
      state.tasks[index] = {...valid, version: old.version + 1};
      return clone(state.tasks[index]);
    },
    async saveNote(note: QuickNote) {
      await wait();
      const index = state.notes.findIndex((item) => item.id === note.id);
      if (index < 0) throw new Error('Nota no encontrada.');
      if (note.version !== state.notes[index].version) throw new Error('La versión cambió.');
      if (typeof note.body !== 'string' || note.body.length > 10000) throw new Error('Notas: máximo 10.000 caracteres.');
      // Construye una nota nueva: los campos ajenos (shiftId, bedId) no entran.
      state.notes[index] = {id: note.id, title: titled(note.title), body: note.body, version: note.version + 1};
      return clone(state.notes[index]);
    },
    async createNote(title) {
      await wait();
      const note: QuickNote = {id: `note-${++sequence}`, title: titled(title), body: '', version: 1};
      state.notes.push(note);
      return clone(note);
    },
    async createBed(label) {
      await wait();
      const shift = current();
      const bed: Bed = {id: `bed-${++sequence}`, label: titled(label), shiftId: shift.id};
      state.beds.push(bed);
      return clone(bed);
    },
    async renameBed(id, label) {
      await wait();
      const bed = state.beds.find((item) => item.id === id);
      if (!bed) throw new Error('Lista no encontrada.');
      if (state.shifts.find((shift) => shift.id === bed.shiftId)?.status !== 'open') {
        throw new Error('Este turno está cerrado y es de solo lectura.');
      }
      // La etiqueta es presentación: los IDs estables mantienen cada tarea en su lista, aunque dos nombres coincidan.
      bed.label = titled(label);
      return clone(bed);
    },
    async createReviewedTask(input) {
      await wait();
      const shift = current();
      if (input.shiftId !== shift.id) throw new Error('La propuesta no pertenece al turno activo.');
      if (input.bedId && !state.beds.some((bed) => bed.id === input.bedId && bed.shiftId === shift.id)) {
        throw new Error('La lista no pertenece al turno.');
      }
      const task: Task = validateTask({
        id: `task-${sequence + 1}`, shiftId: shift.id,
        bedId: input.bedId, title: input.title, body: '', reason: '',
        priority: 'normal', date: input.date, time: input.time,
        estimate: '', performed: '', duration: '', completed: false,
        beforeClose: input.beforeClose, version: 1,
      });
      // Única escritura: validamos todo antes de agregar la tarea.
      sequence += 1;
      state.tasks.push(task);
      return clone(task);
    },
    async createTask(title, bedId = null) {
      await wait();
      const shift = current();
      if (bedId && !state.beds.some((bed) => bed.id === bedId && bed.shiftId === shift.id)) {
        throw new Error('La lista no pertenece al turno.');
      }
      const task: Task = {
        id: `task-${++sequence}`,
        shiftId: shift.id,
        bedId,
        title: titled(title),
        body: '',
        reason: '',
        priority: 'normal',
        date: null,
        time: '',
        estimate: '',
        performed: '',
        duration: '',
        completed: false,
        version: 1,
      };
      state.tasks.push(task);
      return clone(task);
    },
    async closeShift(id) {
      await wait();
      const shift = state.shifts.find((item) => item.id === id);
      if (!shift) throw new Error('Turno no encontrado.');
      if (shift.status === 'closed') return clone(shift);
      if (id !== state.activeShiftId) throw new Error('Turno no activo.');
      shift.status = 'closed';
      state.activeShiftId = null;
      return clone(shift);
    },
    async openShift(label) {
      await wait();
      if (state.activeShiftId) throw new Error('Ya hay un turno abierto.');
      const shift: Shift = {id: `shift-${++sequence}`, label: titled(label), date: localDate(), status: 'open'};
      state.shifts.push(shift);
      state.activeShiftId = shift.id;
      return clone(shift);
    },
  };
}
