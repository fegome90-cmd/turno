// Datos sintéticos de la demo (valores de v5 tests). Sin datos de pacientes.
import type {Task} from '../domain/types';
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    shiftId: 'demo-shift-1',
    bedId: 'bed-1',
    title: 'Tarea 1',
    body: '',
    reason: 'Exámenes',
    priority: 'normal',
    date: '2026-11-07',
    time: '',
    estimate: '',
    performed: '',
    duration: '',
    completed: false,
    version: 1,
    ...overrides,
  };
}
