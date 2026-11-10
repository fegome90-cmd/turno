import {afterEach, describe, expect, it, vi} from 'vitest';
import {createSession} from '../../src/app/create-session';
import type {TurnoState} from '../../src/app/store';
import type {Bed, QuickNote, Shift, Task} from '../../src/domain/types';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup() {const session = createSession({random: () => 0}); sessions.push(session); await session.store.getState().load(); return session;}
function entity<T>(result: unknown): T {expect(result).toMatchObject({status: 'saved', entity: expect.any(Object)}); return (result as {entity: T}).entity;}
function deferred() {let release!: () => void; const promise = new Promise<void>((resolve) => {release = resolve;}); return {promise, release};}
const archive = (state: TurnoState) => state as TurnoState & {archiveId: string | null; setArchiveId(id: string | null): void};

describe('4B T1 · confirmed domain results', () => {
  it.each([
    ['task', (s: TurnoState) => s.createTask('Literal <task>', 'bed-1')],
    ['bed', (s: TurnoState) => s.createBed('Lista 1')],
    ['note', (s: TurnoState) => s.createNote('Nota global')],
    ['rename', (s: TurnoState) => s.renameBed('bed-1', 'Lista nueva')],
    ['close', (s: TurnoState) => s.closeShift('demo-shift-1')],
  ] as const)('%s returns an authoritative confirmed entity without selecting or cleaning the current draft', async (_kind, perform) => {
    const session = await setup(), store = session.store; store.getState().select({kind: 'task', id: 'task-1'}); store.getState().setDraftField('body', 'Draft conservado'); store.getState().setTemporalField('estimate', 'abc');
    const before = {selection: store.getState().selection, draft: structuredClone(store.getState().draft), temporal: {...store.getState().temporal}, revision: store.getState().draftRevision};
    const saved = entity<{id: string}>(await perform(store.getState())); expect(saved.id).toBeTruthy(); expect(store.getState().selection).toEqual(before.selection); expect(store.getState().draft).toEqual(before.draft); expect(store.getState().temporal).toEqual(before.temporal); expect(store.getState().draftRevision).toBe(before.revision);
  });

  it('open returns the newly confirmed shift and retains global notes without copying old lists/tasks', async () => {
    const session = await setup(), store = session.store; await store.getState().closeShift('demo-shift-1'); const notes = structuredClone(store.getState().snapshot!.notes);
    const shift = entity<Shift>(await store.getState().openShift('Turno siguiente')); expect(shift.id).not.toBe('demo-shift-1'); expect(store.getState().snapshot!.activeShiftId).toBe(shift.id); expect(store.getState().snapshot!.beds.filter((bed) => bed.shiftId === shift.id)).toEqual([]); expect(store.getState().snapshot!.tasks.filter((task) => task.shiftId === shift.id)).toEqual([]); expect(store.getState().snapshot!.notes).toEqual(notes);
  });

  it('duplicate labels return distinct IDs and result mutation cannot alias the confirmed snapshot', async () => {
    const session = await setup(), store = session.store; const first = entity<Bed>(await store.getState().createBed('Duplicada')); const second = entity<Bed>(await store.getState().createBed('Duplicada'));
    expect(first.id).not.toBe(second.id); first.label = 'Mutación exterior'; expect(store.getState().snapshot!.beds.find((bed) => bed.id === first.id)!.label).toBe('Duplicada'); expect((await session.port.load()).beds.find((bed) => bed.id === first.id)!.label).toBe('Duplicada');
  });

  it('conflict returns its machine code and message without changing the graph', async () => {
    const session = await setup(), before = structuredClone(session.store.getState().snapshot); session.port.failNext('conflict');
    expect(await session.store.getState().renameBed('bed-1', 'No confirmado')).toMatchObject({status: 'error', code: 'SIMULATED_CONFLICT', message: expect.stringMatching(/Conflicto simulado/)}); expect(session.store.getState().snapshot).toEqual(before); expect(session.store.getState().busy).toBe(false);
  });

  it('invalid input returns a named field without consuming a pending failure', async () => {
    const session = await setup(); const call = vi.spyOn(session.port, 'createTask'); session.port.failNext('error');
    expect(await session.store.getState().createTask('   ')).toMatchObject({status: 'invalid', field: 'title', message: expect.any(String)}); expect(call).not.toHaveBeenCalled();
    expect(await session.store.getState().createTask('Intento válido')).toMatchObject({status: 'error', code: 'SIMULATED_FAILURE'});
  });

  it('runtime non-string input is an explicit invalid result rather than a rejected promise', async () => {
    const session = await setup(), call = vi.spyOn(session.port, 'createNote');
    await expect(session.store.getState().createNote(null as unknown as string)).resolves.toMatchObject({status: 'invalid', field: 'title'}); expect(call).not.toHaveBeenCalled(); expect(session.store.getState().busy).toBe(false);
  });

  it('trim-noop rename neither calls the port nor emits a notice or consumes a failure', async () => {
    const session = await setup(); const call = vi.spyOn(session.port, 'renameBed'); const count = session.store.getState().noticeCount; session.port.failNext('error');
    expect(await session.store.getState().renameBed('bed-1', ' Lista 1 ')).toEqual({status: 'noop'}); expect(call).not.toHaveBeenCalled(); expect(session.store.getState().noticeCount).toBe(count);
    expect(await session.store.getState().createNote('Prueba real')).toMatchObject({status: 'error', code: 'SIMULATED_FAILURE'});
  });

  it('busy is explicit and a delayed create does not overwrite a new selection or edit', async () => {
    const session = await setup(), store = session.store, wait = deferred(), original = session.port.createTask.bind(session.port); const call = vi.spyOn(session.port, 'createTask').mockImplementation(async (...args) => {await wait.promise; return original(...args);});
    store.getState().select({kind: 'task', id: 'task-1'}); const pending = store.getState().createTask('Una nueva', 'bed-1'); expect(await store.getState().createTask('Duplicado', 'bed-1')).toEqual({status: 'busy'}); expect(call).toHaveBeenCalledTimes(1);
    store.getState().select({kind: 'task', id: 'task-2'}); store.getState().setDraftField('body', 'Revisión posterior'); store.getState().setTemporalField('estimate', 'abc'); expect(await store.getState().saveTask()).toMatchObject({status: 'invalid'}); const errors = {...store.getState().errors}; const revision = store.getState().draftRevision; wait.release(); entity<Task>(await pending);
    expect(store.getState().selection).toEqual({kind: 'task', id: 'task-2'}); expect(store.getState().draft?.body).toBe('Revisión posterior'); expect(store.getState().temporal.estimate).toBe('abc'); expect(store.getState().draftRevision).toBe(revision); expect(store.getState().dirty).toBe(true); expect(store.getState().errors).toEqual(errors);
  });

  it('an archived list remains readonly after another shift is open, even for trim-noop', async () => {
    const session = await setup(), store = session.store; await store.getState().closeShift('demo-shift-1'); await store.getState().openShift('Otro turno'); const before = structuredClone(store.getState().snapshot);
    expect(await store.getState().renameBed('bed-1', ' Lista 1 ')).toMatchObject({status: 'error'}); expect(store.getState().snapshot).toEqual(before);
  });

  it('quick-note saved result is global and detached', async () => {
    const session = await setup(); await session.store.getState().closeShift('demo-shift-1'); const note = entity<QuickNote>(await session.store.getState().createNote('Independiente')); expect(note).not.toHaveProperty('shiftId'); expect(note).not.toHaveProperty('bedId'); note.body = 'No debe filtrar'; expect(session.store.getState().snapshot!.notes.find((item) => item.id === note.id)!.body).toBe('');
  });
});

describe('4B T1 · one archive context', () => {
  it('starts with no archive and refuses open, unknown or obsolete archive IDs', async () => {
    const session = await setup(), store = session.store; expect(store.getState()).toHaveProperty('archiveId', null);
    archive(store.getState()).setArchiveId('demo-shift-1'); expect(archive(store.getState()).archiveId).toBeNull(); archive(store.getState()).setArchiveId('missing'); expect(archive(store.getState()).archiveId).toBeNull();
    await store.getState().closeShift('demo-shift-1'); archive(store.getState()).setArchiveId('demo-shift-1'); expect(archive(store.getState()).archiveId).toBe('demo-shift-1');
    vi.spyOn(session.port, 'load').mockImplementation(async () => ({...(await createSnapshotWithoutArchive(session)), shifts: [], tasks: [], beds: []})); await store.getState().load(); expect(archive(store.getState()).archiveId).toBeNull();
  });

  it('selection derives a single owner context and notes leave archive without changing confirmed data', async () => {
    const session = await setup(), store = session.store; await store.getState().closeShift('demo-shift-1'); await store.getState().openShift('Nuevo'); const active = entity<Task>(await store.getState().createTask('Tarea activa'));
    archive(store.getState()).setArchiveId('demo-shift-1'); store.getState().select({kind: 'task', id: 'task-1'}); expect(archive(store.getState()).archiveId).toBe('demo-shift-1');
    store.getState().select({kind: 'task', id: active.id}); expect(archive(store.getState()).archiveId).toBeNull(); archive(store.getState()).setArchiveId('demo-shift-1'); store.getState().select({kind: 'note', id: 'note-1'}); expect(archive(store.getState()).archiveId).toBeNull();
  });

  it('switching archive context cannot retain an unrelated selected draft', async () => {
    const session = await setup(), store = session.store; expect(store.getState()).toHaveProperty('archiveId', null); await store.getState().closeShift('demo-shift-1'); await store.getState().openShift('Nuevo');
    store.getState().select({kind: 'note', id: 'note-1'}); store.getState().setDraftField('body', 'Borrador global'); archive(store.getState()).setArchiveId('demo-shift-1'); expect(archive(store.getState()).archiveId).toBe('demo-shift-1'); expect(store.getState().selection).toBeNull(); expect(store.getState().draft).toBeNull();
    store.getState().select({kind: 'task', id: 'task-1'}); expect(archive(store.getState()).archiveId).toBe('demo-shift-1'); archive(store.getState()).setArchiveId(null); expect(store.getState().selection).toBeNull(); expect(store.getState().draft).toBeNull(); expect(store.getState().dirty).toBe(false);
  });
});
async function createSnapshotWithoutArchive(session: ReturnType<typeof createSession>) {return structuredClone(session.store.getState().snapshot!);}
