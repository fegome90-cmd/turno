// Store de sesión (2A). Dueños (ver evidence/2A/OWNERSHIP.md):
// - snapshot confirmado: copia del adaptador; solo cambia tras una respuesta exitosa (sin optimistic updates).
// - selección y ruta: estado de UI de este store.
// - borrador crudo y temporal: estado de edición de este store; solo lo cambian las acciones de edición o una
//   respuesta exitosa de la misma entidad que sigue seleccionada sin ediciones nuevas.
// - avisos: notification-store (D12). Aquí solo se publican errores y se refleja su conteo (lectura).
import {createStore} from 'zustand/vanilla';
import type {StoreApi} from 'zustand';
import type {TurnoPort} from '../adapters/turno-port';
import {createTemporalDraft, applyTemporalDraft} from '../domain/draft-state';
import {validateEditor} from '../domain/validation';
import type {Bed, FieldErrors, QuickNote, Selection, Shift, Snapshot, Task, TemporalDraft} from '../domain/types';
import type {NotificationStore} from '../notifications/notification-store';

export type EditDraft = {id: string; kind: 'task' | 'note'; title: string; body: string};

export type TurnoState = {
  snapshot: Snapshot | null;
  selection: Selection;
  draft: EditDraft | null;
  temporal: TemporalDraft;
  errors: FieldErrors;
  busy: boolean;
  noticeCount: number;
  load(): Promise<void>;
  select(selection: Selection): void;
  setDraftField(field: 'title' | 'body', value: string): void;
  setTemporalField(field: keyof TemporalDraft, value: string): void;
  saveTask(): Promise<void>;
  saveNote(): Promise<void>;
  createNote(title: string): Promise<void>;
  createTask(title: string, bedId?: string | null): Promise<void>;
  createBed(label: string): Promise<void>;
  renameBed(id: string, label: string): Promise<void>;
  closeShift(id: string): Promise<void>;
  openShift(label: string): Promise<void>;
};

export type TurnoStore = StoreApi<TurnoState> & {dispose(): void};

const EMPTY_TEMPORAL: TemporalDraft = {date: '', time: '', estimate: '', performed: '', duration: ''};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : 'Ocurrió un error.');

export function createTurnoStore(port: TurnoPort, notifications: NotificationStore): TurnoStore {
  // Revisión del borrador: cualquier edición del usuario la incrementa. Una respuesta tardía solo reemplaza
  // el borrador si la revisión no cambió desde que empezó el guardado.
  let revision = 0;
  let disposed = false;

  const store = createStore<TurnoState>()((set, get) => {
    const notify = (error: unknown) => notifications.notify(messageOf(error), 'error');

    const patchSnapshot = (change: (snapshot: Snapshot) => Snapshot) => {
      const snapshot = get().snapshot;
      if (snapshot) set({snapshot: change(snapshot)});
    };

    // Una sola llamada al adaptador por acción: si ya hay una mutación en curso, la acción no hace nada.
    async function persist<T>(call: () => Promise<T>, apply: (result: T) => void): Promise<void> {
      if (get().busy) return;
      set({busy: true});
      try {
        apply(await call());
      } catch (error) {
        notify(error);
      } finally {
        set({busy: false});
      }
    }

    const draftFor = (selection: Selection, snapshot: Snapshot | null): EditDraft | null => {
      if (!selection || !snapshot) return null;
      if (selection.kind === 'task') {
        const task = snapshot.tasks.find((item) => item.id === selection.id);
        return task ? {id: task.id, kind: 'task', title: task.title, body: task.body} : null;
      }
      const note = snapshot.notes.find((item) => item.id === selection.id);
      return note ? {id: note.id, kind: 'note', title: note.title, body: note.body} : null;
    };

    const replaceTask = (snapshot: Snapshot, saved: Task): Snapshot => ({
      ...snapshot,
      tasks: snapshot.tasks.map((item) => (item.id === saved.id ? saved : item)),
    });

    return {
      snapshot: null,
      selection: null,
      draft: null,
      temporal: EMPTY_TEMPORAL,
      errors: {},
      busy: false,
      noticeCount: notifications.getState().items.length,

      async load() {
        await persist(() => port.load(), (snapshot) => set({snapshot}));
      },

      select(selection) {
        revision += 1;
        const snapshot = get().snapshot;
        const task =
          selection?.kind === 'task' && snapshot ? snapshot.tasks.find((item) => item.id === selection.id) : undefined;
        set({
          selection,
          draft: draftFor(selection, snapshot),
          temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,
          errors: {},
        });
      },

      setDraftField(field, value) {
        const draft = get().draft;
        if (!draft) return;
        revision += 1;
        set({draft: {...draft, [field]: value}});
      },

      setTemporalField(field, value) {
        revision += 1;
        set({temporal: {...get().temporal, [field]: value}});
      },

      async saveTask() {
        const {snapshot, selection, draft, temporal} = get();
        if (!snapshot || selection?.kind !== 'task' || !draft) return;
        const task = snapshot.tasks.find((item) => item.id === selection.id);
        if (!task) return;
        const candidate: Task = {...task, title: draft.title, body: draft.body};
        const errors = validateEditor(candidate, temporal, false);
        if (Object.keys(errors).length > 0) {
          set({errors});
          return;
        }
        const payload = applyTemporalDraft(candidate, temporal);
        const startedAt = revision;
        await persist(
          () => port.saveTask(payload),
          (saved) => {
            patchSnapshot((current) => replaceTask(current, saved));
            const now = get();
            // Solo se reemplaza el borrador si la persona no ha editado ni cambiado la selección durante el guardado.
            if (revision === startedAt && now.selection?.id === saved.id) {
              set({draft: draftFor(now.selection, get().snapshot), temporal: createTemporalDraft(saved), errors: {}});
            }
          },
        );
      },

      async saveNote() {
        const {snapshot, selection, draft} = get();
        if (!snapshot || selection?.kind !== 'note' || !draft) return;
        const note = snapshot.notes.find((item) => item.id === selection.id);
        if (!note) return;
        const candidate: QuickNote = {...note, title: draft.title, body: draft.body};
        const errors = validateEditor(candidate, null, true);
        if (Object.keys(errors).length > 0) {
          set({errors});
          return;
        }
        const startedAt = revision;
        await persist(
          () => port.saveNote(candidate),
          (saved) => {
            patchSnapshot((current) => ({...current, notes: current.notes.map((item) => (item.id === saved.id ? saved : item))}));
            if (revision === startedAt && get().selection?.id === saved.id) {
              set({draft: {id: saved.id, kind: 'note', title: saved.title, body: saved.body}, errors: {}});
            }
          },
        );
      },

      async createNote(title) {
        await persist(
          () => port.createNote(title),
          (note) => patchSnapshot((current) => ({...current, notes: [...current.notes, note]})),
        );
      },

      async createTask(title, bedId = null) {
        await persist(
          () => port.createTask(title, bedId),
          (task) => patchSnapshot((current) => ({...current, tasks: [...current.tasks, task]})),
        );
      },

      async createBed(label) {
        await persist(
          () => port.createBed(label),
          (bed: Bed) => patchSnapshot((current) => ({...current, beds: [...current.beds, bed]})),
        );
      },

      async renameBed(id, label) {
        await persist(
          () => port.renameBed(id, label),
          (bed: Bed) => patchSnapshot((current) => ({...current, beds: current.beds.map((item) => (item.id === bed.id ? bed : item))})),
        );
      },

      async closeShift(id) {
        await persist(
          () => port.closeShift(id),
          (shift: Shift) =>
            patchSnapshot((current) => ({
              ...current,
              shifts: current.shifts.map((item) => (item.id === shift.id ? shift : item)),
              activeShiftId: current.activeShiftId === shift.id ? null : current.activeShiftId,
            })),
        );
      },

      async openShift(label) {
        await persist(
          () => port.openShift(label),
          (shift: Shift) =>
            patchSnapshot((current) => ({...current, shifts: [...current.shifts, shift], activeShiftId: shift.id})),
        );
      },
    };
  });

  // Espejo de solo lectura del conteo de avisos. El dueño es el notification-store.
  const unsubscribe = notifications.subscribe(() => {
    if (!disposed) store.setState({noticeCount: notifications.getState().items.length});
  });

  return Object.assign(store, {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  });
}
