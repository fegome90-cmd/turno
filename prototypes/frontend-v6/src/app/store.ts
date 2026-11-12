// Store de sesión (2A). Dueños (ver evidence/2A/OWNERSHIP.md):
// - snapshot confirmado: copia del adaptador; solo cambia tras una respuesta exitosa (sin optimistic updates).
// - selección y ruta: estado de UI de este store.
// - borrador crudo y temporal: estado de edición de este store; solo lo cambian las acciones de edición o una
//   respuesta exitosa de la misma entidad que sigue seleccionada sin ediciones nuevas.
// - avisos: notification-store (D12). Aquí solo se publican errores y se refleja su conteo (lectura).
import {createStore} from 'zustand/vanilla';
import {EMPTY_OVERLAYS, overlayReducer, type OverlayState, type OverlayAction} from '../components/OverlayCoordinator';
import type {StoreApi} from 'zustand';
import type {TurnoPort} from '../adapters/turno-port';
import {createTemporalDraft, applyTemporalDraft} from '../domain/draft-state';
import {validateEditor} from '../domain/validation';
import type {Bed, FieldErrors, Priority, QuickNote, ReviewedTaskInput, Selection, Shift, Snapshot, Task, TemporalDraft} from '../domain/types';
import type {NotificationStore} from '../notifications/notification-store';

export type EditDraft = {id: string; kind: 'task'; title: string; body: string; reason: string; priority: Priority; completed: boolean; beforeClose: boolean}
  | {id: string; kind: 'note'; title: string; body: string};
export type SaveResult = {status: 'saved'; selection: NonNullable<Selection>; revision: number; appliedToDraft: boolean}
  | {status: 'invalid' | 'error' | 'busy' | 'noop'};

// Persistence confirms data, not permission to navigate or close a caller's dialog.
export type DomainResult<T> = {status: 'saved'; entity: T}
  | {status: 'error'; message: string; code?: string}
  | {status: 'invalid'; field: 'title' | 'label'; message: string}
  | {status: 'busy' | 'noop'};
type DomainFailure = Exclude<DomainResult<never>, {status: 'saved'}>;


export type TurnoState = {
  snapshot: Snapshot | null;
  archiveId: string | null;
  setArchiveId(id: string | null): void;
  view: 'home' | 'workspace' | 'notes' | 'archive';
  filter: 'all' | 'pending';
  query: string;
  setQuery(query: string): void;
  expandedBeds: string[];
  inspectorHidden: boolean;
  timeTab: 'task' | 'agenda';
  expandedProperties: string[];
  overlays: OverlayState;
  setView(view: TurnoState['view']): void;
  setFilter(filter: TurnoState['filter']): void;
  toggleBed(id: string): void;
  setInspectorHidden(hidden: boolean): void;
  setTimeTab(tab: 'task' | 'agenda'): void;
  setPropertyExpanded(id: string, expanded: boolean): void;
  dispatchOverlay(action: OverlayAction): void;
  selection: Selection;
  draft: EditDraft | null;
  temporal: TemporalDraft;
  errors: FieldErrors;
  dirty: boolean;
  draftRevision: number;
  saveError: string;
  feedback: string;
  busy: boolean;
  noticeCount: number;
  load(): Promise<void>;
  select(selection: Selection): void;
  setDraftField(field: 'title' | 'body', value: string): void;
  setTaskField(field: 'reason' | 'priority' | 'completed' | 'beforeClose', value: string | boolean): void;
  setTemporalField(field: keyof TemporalDraft, value: string): void;
  cancelDraft(): void;
  saveTask(): Promise<SaveResult>;
  setCompleted(id: string, completed: boolean): Promise<void>;
  saveNote(): Promise<SaveResult>;
  createNote(title: string): Promise<DomainResult<QuickNote>>;
  createTask(title: string, bedId?: string | null): Promise<DomainResult<Task>>;
  createReviewedTask(input: ReviewedTaskInput): Promise<DomainResult<Task>>;
  createBed(label: string): Promise<DomainResult<Bed>>;
  renameBed(id: string, label: string): Promise<DomainResult<Bed>>;
  closeShift(id: string): Promise<DomainResult<Shift>>;
  openShift(label: string): Promise<DomainResult<Shift>>;
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
    async function persist<T>(call: () => Promise<T>, apply: (result: T) => void): Promise<DomainResult<T>> {
      if (get().busy) return {status: 'busy'};
      set({busy: true});
      try {
        const entity = await call();
        apply(entity);
        return {status: 'saved', entity: structuredClone(entity)};
      } catch (error) {
        notify(error);
        let code: string | undefined;
        try {const value = (error as {code?: unknown} | null)?.code; if (typeof value === 'string') code = value;} catch { /* An optional foreign error code cannot replace the original failure. */ }
        return {status: 'error', message: messageOf(error), ...(code ? {code} : {})};
      } finally {
        set({busy: false});
      }
    }

    const nameFailure = (value: string, field: 'title' | 'label', label: string): DomainFailure | null => {
      if (get().busy) return {status: 'busy'};
      if (typeof value !== 'string' || !value.trim() || value.length > 300) return {status: 'invalid', field, message: `${label}: escribe de 1 a 300 caracteres.`};
      return null;
    };

    const draftFor = (selection: Selection, snapshot: Snapshot | null): EditDraft | null => {
      if (!selection || !snapshot) return null;
      if (selection.kind === 'task') {
        const task = snapshot.tasks.find((item) => item.id === selection.id);
        return task ? {id: task.id, kind: 'task', title: task.title, body: task.body, reason: task.reason, priority: task.priority, completed: task.completed, beforeClose: task.beforeClose === true} : null;
      }
      const note = snapshot.notes.find((item) => item.id === selection.id);
      return note ? {id: note.id, kind: 'note', title: note.title, body: note.body} : null;
    };

    const replaceTask = (snapshot: Snapshot, saved: Task): Snapshot => ({
      ...snapshot,
      tasks: snapshot.tasks.map((item) => (item.id === saved.id ? saved : item)),
    });

    const candidateFor = (draft: EditDraft, snapshot: Snapshot): Task | QuickNote | null => {
      if (draft.kind === 'note') {
        const note = snapshot.notes.find((item) => item.id === draft.id);
        return note ? {...note, title: draft.title, body: draft.body} : null;
      }
      const task = snapshot.tasks.find((item) => item.id === draft.id);
      return task ? {...task, title: draft.title, body: draft.body, reason: draft.reason, priority: draft.priority, completed: draft.completed, beforeClose: draft.beforeClose} : null;
    };
    const errorsFor = (draft: EditDraft, temporal: TemporalDraft): FieldErrors => {
      const snapshot = get().snapshot;
      const candidate = snapshot && candidateFor(draft, snapshot);
      if (!candidate) return {};
      return draft.kind === 'note' ? validateEditor(candidate as QuickNote, null, true) : validateEditor(candidate as Task, temporal, false);
    };
    const dirtyFor = (draft: EditDraft, temporal: TemporalDraft): boolean => {
      const snapshot = get().snapshot;
      const original = draftFor({kind: draft.kind, id: draft.id}, snapshot);
      if (!original || JSON.stringify(draft) !== JSON.stringify(original)) return true;
      if (draft.kind === 'note') return false;
      return JSON.stringify(temporal) !== JSON.stringify(createTemporalDraft(snapshot?.tasks.find((item) => item.id === draft.id)));
    };
    const edit = (draft: EditDraft, temporal: TemporalDraft) => {
      revision += 1;
      const current = errorsFor(draft, temporal);
      const errors = Object.fromEntries(Object.keys(get().errors).filter((key) => current[key as keyof FieldErrors]).map((key) => [key, current[key as keyof FieldErrors]]));
      const dirty = dirtyFor(draft, temporal);
      set({draft, temporal, errors, dirty, draftRevision: revision, saveError: '', feedback: dirty ? 'Cambios sin guardar' : ''});
    };

    return {
      snapshot: null,
      archiveId: null,
      setArchiveId(id) {
        const snapshot = get().snapshot;
        const archiveId = id && snapshot?.shifts.some((shift) => shift.id === id && shift.status === 'closed') ? id : null;
        if (archiveId === get().archiveId) return;
        revision += 1;
        set({archiveId, selection: null, draft: null, temporal: EMPTY_TEMPORAL, errors: {}, dirty: false, draftRevision: revision, saveError: '', feedback: ''});
      },
      view: 'home',
      filter: 'all',
      query: '',
      setQuery: (query) => set({query}),
      expandedBeds: ['bed-1'],
      inspectorHidden: false,
      timeTab: 'task',
      expandedProperties: [],
      overlays: EMPTY_OVERLAYS,
      setView: (view) => set({view}),
      setFilter: (filter) => set({filter}),
      toggleBed: (id) => set((state) => ({expandedBeds: state.expandedBeds.includes(id) ? state.expandedBeds.filter((key) => key !== id) : [...state.expandedBeds, id]})),
      setInspectorHidden: (inspectorHidden) => set({inspectorHidden}),
      setTimeTab: (timeTab) => set({timeTab}),
      setPropertyExpanded: (id, expanded) => {
        const ids = get().expandedProperties;
        if (ids.includes(id) === expanded) return;
        set({expandedProperties: expanded ? [...ids, id] : ids.filter((key) => key !== id)});
      },
      dispatchOverlay: (action) => set((state) => ({overlays: overlayReducer(state.overlays, action)})),
      selection: null,
      draft: null,
      temporal: EMPTY_TEMPORAL,
      errors: {},
      dirty: false,
      draftRevision: revision,
      saveError: '',
      feedback: '',
      busy: false,
      noticeCount: notifications.getState().items.length,

      async load() {
        await persist(() => port.load(), (snapshot) => {set({snapshot}); get().setArchiveId(get().archiveId);});
      },

      select(selection) {
        revision += 1;
        const snapshot = get().snapshot;
        const task =
          selection?.kind === 'task' && snapshot ? snapshot.tasks.find((item) => item.id === selection.id) : undefined;
        set({
          selection,
          archiveId: selection?.kind === 'note' ? null : task ? (snapshot?.shifts.find((shift) => shift.id === task.shiftId)?.status === 'closed' ? task.shiftId : null) : selection ? null : get().archiveId,
          draft: draftFor(selection, snapshot),
          temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,
          errors: {},
          dirty: false,
          draftRevision: revision,
          saveError: '',
          feedback: '',
          timeTab: 'task',
        });
      },

      setDraftField(field, value) {
        const draft = get().draft;
        if (!draft) return;
        edit({...draft, [field]: value}, get().temporal);
      },

      setTaskField(field, value) {
        const draft = get().draft;
        if (draft?.kind !== 'task') return;
        if (field === 'completed' && typeof value === 'boolean') edit({...draft, completed: value}, get().temporal);
        if (field === 'beforeClose' && typeof value === 'boolean') edit({...draft, beforeClose: value}, get().temporal);
        if (field === 'reason' && typeof value === 'string') edit({...draft, reason: value}, get().temporal);
        if (field === 'priority' && ['normal', 'high', 'low'].includes(String(value))) edit({...draft, priority: value as Priority}, get().temporal);
      },

      setTemporalField(field, value) {
        const draft = get().draft;
        if (draft?.kind !== 'task') return;
        edit(draft, {...get().temporal, [field]: value});
      },

      cancelDraft() {
        revision += 1;
        const {selection, snapshot} = get();
        const task = selection?.kind === 'task' ? snapshot?.tasks.find((item) => item.id === selection.id) : undefined;
        set({draft: draftFor(selection, snapshot), temporal: task ? createTemporalDraft(task) : EMPTY_TEMPORAL,
          errors: {}, dirty: false, draftRevision: revision, saveError: '', feedback: ''});
      },

      async saveTask() {
        const {snapshot, selection, draft, temporal} = get();
        if (!snapshot || selection?.kind !== 'task' || draft?.kind !== 'task') return {status: 'noop'};
        const task = snapshot.tasks.find((item) => item.id === selection.id);
        if (!task || !snapshot.shifts.some((shift) => shift.id === task.shiftId && shift.status === 'open')) return {status: 'noop'};
        const candidate = candidateFor(draft, snapshot) as Task;
        const errors = validateEditor(candidate, temporal, false);
        if (Object.keys(errors).length > 0) {
          set({errors, saveError: Object.values(errors)[0] ?? ''});
          return {status: 'invalid'};
        }
        if (get().busy) return {status: 'busy'};
        if (!get().dirty) return {status: 'noop'};
        const payload = applyTemporalDraft(candidate, temporal);
        const startedAt = revision;
        let appliedToDraft = false;
        const result = await persist(
          () => port.saveTask(payload),
          (saved) => {
            patchSnapshot((current) => replaceTask(current, saved));
            const now = get();
            // Solo se reemplaza el borrador si la persona no ha editado ni cambiado la selección durante el guardado.
            if (revision === startedAt && now.selection?.kind === 'task' && now.selection.id === saved.id) {
              appliedToDraft = true;
              set({draft: draftFor(now.selection, get().snapshot), temporal: createTemporalDraft(saved), errors: {}, dirty: false, saveError: '', feedback: 'Guardado en esta demostración.'});
            } else if (now.draft?.kind === 'task' && now.draft.id === saved.id) {
              // The confirmed baseline changed even though a newer edit owns the draft.
              const dirty = dirtyFor(now.draft, now.temporal);
              set({dirty, feedback: dirty ? 'Cambios sin guardar' : ''});
            }
          },
        );
        if (result.status === 'error' && revision === startedAt) set({saveError: result.message});
        return result.status === 'saved' ? {status: 'saved', selection, revision: startedAt, appliedToDraft} : {status: result.status};
      },

      async setCompleted(id, completed) {
        const snapshot = get().snapshot;
        const task = snapshot?.tasks.find((item) => item.id === id);
        if (!task || task.completed === completed) return;
        if (!snapshot?.shifts.some((shift) => shift.id === task.shiftId && shift.status === 'open')) return;
        const startedAt = revision;
        // Completion acts on the confirmed task, not the unrelated raw editor draft.
        // persist supplies the same one-operation lock used by every other mutation.
        await persist(
          () => port.saveTask({...task, completed}),
          (saved) => {
            patchSnapshot((current) => replaceTask(current, saved));
            const now = get();
            if (now.draft?.kind !== 'task' || now.draft.id !== saved.id) return;
            if (revision === startedAt && !now.dirty) {
              // A clean selected editor must reflect this confirmation; otherwise a
              // later body-only save would silently reopen the completed task.
              set({draft: draftFor(now.selection, get().snapshot)});
            } else {
              const dirty = dirtyFor(now.draft, now.temporal);
              set({dirty, feedback: dirty ? 'Cambios sin guardar' : ''});
            }
          },
        );
      },

      async saveNote() {
        const {snapshot, selection, draft} = get();
        if (!snapshot || selection?.kind !== 'note' || draft?.kind !== 'note') return {status: 'noop'};
        const note = snapshot.notes.find((item) => item.id === selection.id);
        if (!note) return {status: 'noop'};
        const candidate: QuickNote = {...note, title: draft.title, body: draft.body};
        const errors = validateEditor(candidate, null, true);
        if (Object.keys(errors).length > 0) {
          set({errors, saveError: Object.values(errors)[0] ?? ''});
          return {status: 'invalid'};
        }
        if (get().busy) return {status: 'busy'};
        if (!get().dirty) return {status: 'noop'};
        const startedAt = revision;
        let appliedToDraft = false;
        const result = await persist(
          () => port.saveNote(candidate),
          (saved) => {
            patchSnapshot((current) => ({...current, notes: current.notes.map((item) => (item.id === saved.id ? saved : item))}));
            if (revision === startedAt && get().selection?.kind === 'note' && get().selection?.id === saved.id) {
              appliedToDraft = true;
              set({draft: {id: saved.id, kind: 'note', title: saved.title, body: saved.body}, errors: {}, dirty: false, saveError: '', feedback: 'Guardado en esta demostración.'});
            } else {
              const now = get();
              if (now.draft?.kind === 'note' && now.draft.id === saved.id) {
                const dirty = dirtyFor(now.draft, now.temporal);
                set({dirty, feedback: dirty ? 'Cambios sin guardar' : ''});
              }
            }
          },
        );
        if (result.status === 'error' && revision === startedAt) set({saveError: result.message});
        return result.status === 'saved' ? {status: 'saved', selection, revision: startedAt, appliedToDraft} : {status: result.status};
      },

      async createNote(title) {
        const failure = nameFailure(title, 'title', 'Título'); if (failure) return failure;
        return persist(
          () => port.createNote(title),
          (note) => patchSnapshot((current) => ({...current, notes: [...current.notes, note]})),
        );
      },

      async createTask(title, bedId = null) {
        const failure = nameFailure(title, 'title', 'Título'); if (failure) return failure;
        return persist(
          () => port.createTask(title, bedId),
          (task) => patchSnapshot((current) => ({...current, tasks: [...current.tasks, task]})),
        );
      },

      async createReviewedTask(input) {
        const snapshot = get().snapshot;
        const shift = snapshot?.shifts.find((item) => item.id === snapshot.activeShiftId && item.status === 'open');
        if (!shift || get().archiveId || input.shiftId !== shift.id) {
          return {status: 'error', message: 'La revisión ya no pertenece a un turno abierto.'};
        }
        if (input.bedId && !snapshot?.beds.some((bed) => bed.id === input.bedId && bed.shiftId === shift.id)) {
          return {status: 'error', message: 'La lista no pertenece al turno activo.'};
        }
        return persist(
          () => port.createReviewedTask(input),
          (task) => patchSnapshot((current) => ({...current, tasks: [...current.tasks, task]})),
        );
      },

      async createBed(label) {
        const failure = nameFailure(label, 'label', 'Nombre'); if (failure) return failure;
        return persist(
          () => port.createBed(label),
          (bed: Bed) => patchSnapshot((current) => ({...current, beds: [...current.beds, bed]})),
        );
      },

      async renameBed(id, label) {
        const failure = nameFailure(label, 'label', 'Nombre de la lista'); if (failure) return failure;
        const snapshot = get().snapshot, bed = snapshot?.beds.find((item) => item.id === id);
        if (bed && snapshot?.shifts.some((shift) => shift.id === bed.shiftId && shift.status === 'open') && label.trim() === bed.label) return {status: 'noop'};
        return persist(
          () => port.renameBed(id, label),
          (bed: Bed) => patchSnapshot((current) => ({...current, beds: current.beds.map((item) => (item.id === bed.id ? bed : item))})),
        );
      },

      async closeShift(id) {
        if (get().busy) return {status: 'busy'};
        return persist(
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
        const failure = nameFailure(label, 'label', 'Nombre'); if (failure) return failure;
        return persist(
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
