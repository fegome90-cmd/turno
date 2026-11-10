// Puerto de dominio (PLAN §4). Ningún SDK de backend: la demo en memoria lo implementa.
import type {Bed, QuickNote, ReviewedTaskInput, Shift, Snapshot, Task} from '../domain/types';

export type TurnoPort = {
  load(): Promise<Snapshot>;
  saveTask(task: Task): Promise<Task>;
  saveNote(note: QuickNote): Promise<QuickNote>;
  createNote(title: string): Promise<QuickNote>;
  createBed(label: string): Promise<Bed>;
  renameBed(id: string, label: string): Promise<Bed>;
  createTask(title: string, bedId?: string | null): Promise<Task>;
  createReviewedTask(input: ReviewedTaskInput): Promise<Task>;
  closeShift(id: string): Promise<Shift>;
  openShift(label: string): Promise<Shift>;
};

// Solo para controles Demo: fuerza el siguiente fallo simulado de una operación.
export type PreviewPort = TurnoPort & {failNext(kind: 'error' | 'conflict'): void};
