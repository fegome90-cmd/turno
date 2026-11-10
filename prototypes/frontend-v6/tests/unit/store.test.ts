// Store de 2A (EXTRA-STATE-AUTHORITY, EXTRA-LIFECYCLE-ASYNC). Promesas controladas; sin red ni persistencia.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import type {PreviewPort} from '../../src/adapters/turno-port';
import {createSession} from '../../src/app/create-session';
import {createTurnoStore} from '../../src/app/store';
import {createNotificationStore, type NotificationStore} from '../../src/notifications/notification-store';
import {installNetworkAndStorageSpies} from '../../src/test/network-spy';
import type {QuickNote, Task} from '../../src/domain/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

// Cuenta suscripciones activas: cada subscribe suma 1 y cada cancelación resta 1 (una sola vez).
function countingNotifications() {
  const base = createNotificationStore();
  const counter = {active: 0, subscribes: 0};
  const store: NotificationStore = {
    ...base,
    subscribe(listener) {
      counter.active += 1;
      counter.subscribes += 1;
      const unsubscribe = base.subscribe(listener);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        counter.active -= 1;
        unsubscribe();
      };
    },
  };
  return {store, counter};
}

function setup(port: PreviewPort = createPreviewAdapter()) {
  const notifications = countingNotifications();
  const store = createTurnoStore(port, notifications.store);
  return {port, store, notifications};
}

async function loadedStore() {
  const ctx = setup();
  await ctx.store.getState().load();
  return ctx;
}

const taskOf = (ctx: {store: ReturnType<typeof createTurnoStore>}, id: string): Task =>
  ctx.store.getState().snapshot!.tasks.find((task) => task.id === id)!;

describe('store de sesión · autoridad de estado', () => {
  it('EXTRA-STATE-AUTHORITY · guardado exitoso: snapshot confirmado y borrador alineado, una sola mutación', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Título nuevo');
    await ctx.store.getState().saveTask();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(taskOf(ctx, 'task-1').title).toBe('Título nuevo');
    expect(taskOf(ctx, 'task-1').version).toBe(2);
    expect(ctx.store.getState().draft?.title).toBe('Título nuevo');
    expect(ctx.store.getState().errors).toEqual({});
    expect(ctx.store.getState().busy).toBe(false);
    expect(ctx.notifications.counter.active).toBe(1);
  });

  it('EXTRA-STATE-AUTHORITY · fallo simulado: snapshot previo intacto y borrador con el texto editado; aviso de error', async () => {
    const ctx = await loadedStore();
    const before = structuredClone(ctx.store.getState().snapshot);
    ctx.port.failNext('error');
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Texto que se pierde');
    await ctx.store.getState().saveTask();
    expect(ctx.store.getState().snapshot).toEqual(before);
    expect(ctx.store.getState().draft?.title).toBe('Texto que se pierde');
    expect(ctx.store.getState().busy).toBe(false);
    expect(ctx.store.getState().noticeCount).toBe(1);
    expect(ctx.notifications.store.getState().items[0]).toMatchObject({kind: 'error'});
    expect(ctx.notifications.store.getState().items[0].message).toMatch(/simulado/);
  });

  it('EXTRA-STATE-AUTHORITY · conflicto de versión: no pisa el borrador ni confirma el guardado', async () => {
    const ctx = await loadedStore();
    const task = taskOf(ctx, 'task-1');
    // Otro actor guarda primero (sin espía): la versión del store queda obsoleta.
    await ctx.port.saveTask({...task, title: 'Versión ajena'});
    const before = structuredClone(ctx.store.getState().snapshot);
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Mi edición');
    await ctx.store.getState().saveTask();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ctx.store.getState().snapshot).toEqual(before);
    expect(ctx.store.getState().draft?.title).toBe('Mi edición');
    expect(ctx.notifications.store.getState().items[0].message).toMatch(/versión/);
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía de una selección anterior: actualiza su copia confirmada, sin tocar el borrador ni los errores actuales', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    const spy = vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Tarea A editada');
    const saving = ctx.store.getState().saveTask();
    // Mientras A se guarda, la persona abre B y deja un error en B.
    ctx.store.getState().select({kind: 'task', id: 'task-2'});
    ctx.store.getState().setDraftField('title', '');
    await ctx.store.getState().saveTask();
    expect(spy).toHaveBeenCalledTimes(1);
    const errorsBefore = structuredClone(ctx.store.getState().errors);
    expect(errorsBefore.title).toBeTruthy();
    pending.resolve({...taskOf(ctx, 'task-1'), title: 'Tarea A editada', version: 2});
    await saving;
    expect(taskOf(ctx, 'task-1').title).toBe('Tarea A editada');
    expect(ctx.store.getState().selection).toEqual({kind: 'task', id: 'task-2'});
    expect(ctx.store.getState().draft).toMatchObject({id: 'task-2', title: ''});
    expect(ctx.store.getState().errors).toEqual(errorsBefore);
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía con fallo de una selección anterior: el borrador actual y el snapshot no cambian', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'A fallida');
    const saving = ctx.store.getState().saveTask();
    ctx.store.getState().select({kind: 'task', id: 'task-3'});
    ctx.store.getState().setDraftField('body', 'Cuerpo de B');
    const before = structuredClone(ctx.store.getState().snapshot);
    pending.reject(new Error('Fallo tardío simulado.'));
    await saving;
    expect(ctx.store.getState().snapshot).toEqual(before);
    expect(ctx.store.getState().draft).toMatchObject({id: 'task-3', body: 'Cuerpo de B'});
    expect(ctx.notifications.store.getState().items.map((item) => item.message)).toEqual(['Fallo tardío simulado.']);
  });

  it('EXTRA-STATE-AUTHORITY · una sola mutación por acción: un segundo guardado mientras hay uno en curso no llama al adaptador', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    const spy = vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Una vez');
    const first = ctx.store.getState().saveTask();
    await ctx.store.getState().saveTask();
    expect(spy).toHaveBeenCalledTimes(1);
    pending.resolve({...taskOf(ctx, 'task-1'), title: 'Una vez', version: 2});
    await first;
    expect(taskOf(ctx, 'task-1').version).toBe(2);
  });

  it('EXTRA-STATE-AUTHORITY · sin actualización optimista: el snapshot no cambia mientras el guardado está pendiente', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Pendiente');
    const saving = ctx.store.getState().saveTask();
    expect(ctx.store.getState().busy).toBe(true);
    expect(taskOf(ctx, 'task-1').title).toBe('Tarea 1');
    pending.resolve({...taskOf(ctx, 'task-1'), title: 'Pendiente', version: 2});
    await saving;
    expect(ctx.store.getState().busy).toBe(false);
  });

  it('EXTRA-STATE-AUTHORITY · validación antes de mutar: título vacío no llama al adaptador y conserva el texto', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', '   ');
    await ctx.store.getState().saveTask();
    expect(spy).not.toHaveBeenCalled();
    expect(ctx.store.getState().errors.title).toBeTruthy();
    expect(ctx.store.getState().draft?.title).toBe('   ');
  });

  it('EXTRA-STATE-AUTHORITY · el store no llama a red ni a almacenamiento en carga, edición, guardado y cierre', async () => {
    const spies = installNetworkAndStorageSpies();
    const ctx = setup();
    await ctx.store.getState().load();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Sin red');
    await ctx.store.getState().saveTask();
    await ctx.store.getState().createBed('Lista nueva');
    await ctx.store.getState().closeShift('demo-shift-1');
    expect(spies.calls()).toBe(0);
    ctx.store.dispose();
  });
});

describe('ciclo de vida del store y de la sesión', () => {
  it('EXTRA-LIFECYCLE-ASYNC · 20 ciclos crear/destruir sesión: suscripción al notification-store vuelve a cero', () => {
    const notifications = countingNotifications();
    for (let cycle = 0; cycle < 20; cycle++) {
      const session = createSession({random: () => 0, port: createPreviewAdapter(), notifications: notifications.store});
      expect(notifications.counter.active).toBe(1);
      session.dispose();
      expect(notifications.counter.active).toBe(0);
    }
    expect(notifications.counter.subscribes).toBe(20);
  });

  it('EXTRA-LIFECYCLE-ASYNC · 20 ciclos del store con carga y mutación: suscripciones contadas vuelven a cero y dispose es idempotente', async () => {
    const notifications = countingNotifications();
    for (let cycle = 0; cycle < 20; cycle++) {
      const store = createTurnoStore(createPreviewAdapter(), notifications.store);
      await store.getState().load();
      await store.getState().createNote('Nota ciclo');
      expect(notifications.counter.active).toBe(1);
      store.dispose();
      store.dispose();
      expect(notifications.counter.active).toBe(0);
    }
  });

  it('EXTRA-LIFECYCLE-ASYNC · createSession pide el sorteo una sola vez y no crea el adaptador por render', () => {
    const random = vi.fn(() => 0.9);
    const session = createSession({random, notifications: countingNotifications().store});
    expect(random).toHaveBeenCalledTimes(1);
    expect(session.homeSubtitle).toBe('¿En qué te ayudo hoy?');
    expect(session.preferredName).toBe('Demo');
    session.dispose();
  });

  it('EXTRA-LIFECYCLE-ASYNC · cerrar y reabrir un turno produce una sola operación de dominio por acción', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'closeShift');
    await ctx.store.getState().closeShift('demo-shift-1');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ctx.store.getState().snapshot?.activeShiftId).toBeNull();
    await ctx.store.getState().openShift('Turno nuevo');
    expect(ctx.store.getState().snapshot?.activeShiftId).toBeTruthy();
  });
});

describe('store · cierre de WARN de la revisión 2A (temporal, selección)', () => {
  it('EXTRA-STATE-AUTHORITY · borrador temporal crudo intacto tras fallo simulado (espacios incluidos)', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('time', '09:30');
    ctx.store.getState().setTemporalField('estimate', '  12  ');
    const rawBefore = structuredClone(ctx.store.getState().temporal);
    ctx.port.failNext('error');
    await ctx.store.getState().saveTask();
    expect(ctx.store.getState().temporal).toEqual(rawBefore);
    expect(ctx.store.getState().temporal.estimate).toBe('  12  ');
    expect(taskOf(ctx, 'task-1').time).toBe('');
  });

  it('EXTRA-STATE-AUTHORITY · borrador temporal crudo intacto tras conflicto de versión', async () => {
    const ctx = await loadedStore();
    const task = taskOf(ctx, 'task-1');
    await ctx.port.saveTask({...task, title: 'Versión ajena'});
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('time', '09:30');
    ctx.store.getState().setTemporalField('performed', '10:15');
    const rawBefore = structuredClone(ctx.store.getState().temporal);
    await ctx.store.getState().saveTask();
    expect(ctx.notifications.store.getState().items[0].message).toMatch(/versión/);
    expect(ctx.store.getState().temporal).toEqual(rawBefore);
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía de la misma tarea conserva el temporal editado durante el guardado', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('time', '09:30');
    const saving = ctx.store.getState().saveTask();
    ctx.store.getState().setTemporalField('estimate', '  15  ');
    pending.resolve({...taskOf(ctx, 'task-1'), time: '09:30', version: 2});
    await saving;
    expect(ctx.store.getState().temporal.time).toBe('09:30');
    expect(ctx.store.getState().temporal.estimate).toBe('  15  ');
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía tras cambiar de tarea no toca el temporal de la nueva selección', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('time', '09:30');
    const saving = ctx.store.getState().saveTask();
    ctx.store.getState().select({kind: 'task', id: 'task-2'});
    ctx.store.getState().setTemporalField('performed', '08:00');
    const expected = structuredClone(ctx.store.getState().temporal);
    pending.resolve({...taskOf(ctx, 'task-1'), time: '09:30', version: 2});
    await saving;
    expect(ctx.store.getState().temporal).toEqual(expected);
    expect(expected).toEqual({date: '07/11/2026', time: '11:30', estimate: '20', performed: '08:00', duration: ''});
  });

  it('EXTRA-STATE-AUTHORITY · select reinicia el temporal y los errores al cambiar de tarea', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('time', '09:30');
    ctx.store.getState().setTemporalField('estimate', 'abc');
    await ctx.store.getState().saveTask();
    expect(ctx.store.getState().errors.estimate).toBeTruthy();
    ctx.store.getState().select({kind: 'task', id: 'task-2'});
    expect(ctx.store.getState().errors).toEqual({});
    expect(ctx.store.getState().temporal).toEqual({date: '07/11/2026', time: '11:30', estimate: '20', performed: '', duration: ''});
  });

  it('EXTRA-STATE-AUTHORITY · el store guarda el texto crudo de minutos sin trim; el valor aplicado sí va recortado', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('estimate', '  10  ');
    ctx.store.getState().setTemporalField('duration', '  5  ');
    expect(ctx.store.getState().temporal.estimate).toBe('  10  ');
    expect(ctx.store.getState().temporal.duration).toBe('  5  ');
    await ctx.store.getState().saveTask();
    expect(ctx.store.getState().errors).toEqual({});
    expect(taskOf(ctx, 'task-1').estimate).toBe('10');
    expect(taskOf(ctx, 'task-1').duration).toBe('5');
  });
});

describe('store · notas (saveNote) · cierre de WARN de la revisión 2A', () => {
  it('EXTRA-STATE-AUTHORITY · guardado de nota exitoso confirma la nota y alinea su borrador', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveNote');
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('body', 'Texto de nota');
    await ctx.store.getState().saveNote();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ctx.store.getState().snapshot!.notes[0]).toMatchObject({body: 'Texto de nota', version: 2});
    expect(ctx.store.getState().draft).toMatchObject({id: 'note-1', kind: 'note', body: 'Texto de nota'});
    expect(ctx.notifications.counter.active).toBe(1);
  });

  it('EXTRA-STATE-AUTHORITY · fallo al guardar nota: snapshot de la nota intacto y texto editado conservado', async () => {
    const ctx = await loadedStore();
    const before = structuredClone(ctx.store.getState().snapshot!.notes);
    ctx.port.failNext('error');
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('body', 'Se conserva');
    await ctx.store.getState().saveNote();
    expect(ctx.store.getState().snapshot!.notes).toEqual(before);
    expect(ctx.store.getState().draft).toMatchObject({id: 'note-1', body: 'Se conserva'});
    expect(ctx.notifications.store.getState().items).toHaveLength(1);
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía de nota con edición nueva: el borrador conserva el texto más reciente', async () => {
    const ctx = await loadedStore();
    const pending = deferred<QuickNote>();
    vi.spyOn(ctx.port, 'saveNote').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('body', 'A');
    const saving = ctx.store.getState().saveNote();
    ctx.store.getState().setDraftField('body', 'A más');
    pending.resolve({id: 'note-1', title: 'Notas generales', body: 'A', version: 2});
    await saving;
    expect(ctx.store.getState().draft).toMatchObject({id: 'note-1', body: 'A más'});
    expect(ctx.store.getState().snapshot!.notes[0].body).toBe('A');
  });

  it('EXTRA-STATE-AUTHORITY · respuesta tardía de nota tras cambiar de selección no toca el borrador de la nueva tarea', async () => {
    const ctx = await loadedStore();
    const pending = deferred<QuickNote>();
    vi.spyOn(ctx.port, 'saveNote').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('body', 'A');
    const saving = ctx.store.getState().saveNote();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    const expected = structuredClone(ctx.store.getState().draft);
    pending.resolve({id: 'note-1', title: 'Notas generales', body: 'A', version: 2});
    await saving;
    expect(ctx.store.getState().draft).toEqual(expected);
    expect(ctx.store.getState().draft).toMatchObject({kind: 'task', id: 'task-1'});
  });

  it('EXTRA-STATE-AUTHORITY · título de nota vacío no llama al adaptador y conserva el borrador', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveNote');
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('title', '');
    await ctx.store.getState().saveNote();
    expect(spy).not.toHaveBeenCalled();
    expect(ctx.store.getState().errors.title).toBeTruthy();
    expect(ctx.store.getState().draft?.title).toBe('');
  });
});

// 3A UI-18: completion persists the confirmed task, never the in-progress editor draft.
// Removing setCompleted or updating before port success makes these tests fail.
describe('3A UI-18 · completar desde navegación real', () => {
  it('UI-18 · éxito confirma una operación y conserva draft/raw/errores/selección', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'Borrador sin guardar');
    ctx.store.getState().setTemporalField('estimate', 'abc');
    await ctx.store.getState().saveTask();
    const {draft, temporal, errors, selection} = ctx.store.getState();
    const savedTitle = taskOf(ctx, 'task-1').title;
    const spy = vi.spyOn(ctx.port, 'saveTask');
    await ctx.store.getState().setCompleted?.('task-1', true);
    expect(taskOf(ctx, 'task-1').completed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].title).toBe(savedTitle);
    expect(ctx.store.getState()).toMatchObject({draft, temporal, errors, selection});
  });

  it.each(['error', 'conflict'] as const)('UI-18 · %s restaura confirmado sin perder draft ni seleccionar otra fila', async (failure) => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-2'});
    ctx.store.getState().setDraftField('body', 'Texto literal <sin perder>');
    const before = ctx.store.getState();
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.port.failNext(failure);
    await ctx.store.getState().setCompleted?.('task-1', true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(ctx.store.getState().snapshot).toEqual(before.snapshot);
    expect(ctx.store.getState()).toMatchObject({draft: before.draft, temporal: before.temporal, errors: before.errors, selection: before.selection, busy: false});
    expect(ctx.store.getState().noticeCount).toBe(1);
  });

  it('UI-18 · latencia no confirma antes de éxito, doble click no duplica y respuesta tardía no pisa selección nueva', async () => {
    const base = createPreviewAdapter();
    const pending = deferred<Task>();
    const saved: Task[] = [];
    const port: PreviewPort = {...base, saveTask(task) {saved.push(task); return pending.promise;}};
    const ctx = setup(port);
    await ctx.store.getState().load();
    const original = taskOf(ctx, 'task-1');
    const first = ctx.store.getState().setCompleted?.(original.id, true);
    const second = ctx.store.getState().setCompleted?.(original.id, true);
    expect(saved).toHaveLength(1);
    expect(taskOf(ctx, original.id).completed).toBe(false);
    ctx.store.getState().select({kind: 'task', id: 'task-2'});
    ctx.store.getState().setDraftField('body', 'Edición nueva');
    pending.resolve({...original, completed: true, version: original.version + 1});
    await Promise.all([first, second]);
    expect(taskOf(ctx, original.id).completed).toBe(true);
    expect(ctx.store.getState().selection).toEqual({kind: 'task', id: 'task-2'});
    expect(ctx.store.getState().draft?.body).toBe('Edición nueva');
  });

  it('UI-18 · noop y tareas de turno cerrado no consumen operación', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveTask');
    const task = taskOf(ctx, 'task-1');
    await ctx.store.getState().setCompleted?.(task.id, task.completed);
    await ctx.store.getState().setCompleted?.('no-existe', true);
    await ctx.store.getState().closeShift(task.shiftId);
    await ctx.store.getState().setCompleted?.(task.id, !task.completed);
    expect(spy).not.toHaveBeenCalled();
    expect(taskOf(ctx, task.id).completed).toBe(task.completed);
  });
});

// 4A: these assertions catch discarding metadata, eager editor completion,
// a resolved Promise<void> masquerading as success, and stale draft authority.
describe('4A · draft and explicit save authority', () => {
  it.each(['task', 'note'] as const)('4A revision baseline · late %s save recalculates dirty after a manual revert', async (kind) => {
    const ctx = await loadedStore();
    const id = kind === 'task' ? 'task-1' : 'note-1';
    ctx.store.getState().select({kind, id});
    const original = structuredClone(kind === 'task' ? taskOf(ctx, id) : ctx.store.getState().snapshot!.notes[0]!);
    const pending = deferred<Task | QuickNote>();
    if (kind === 'task') vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise as Promise<Task>);
    else vi.spyOn(ctx.port, 'saveNote').mockImplementationOnce(() => pending.promise as Promise<QuickNote>);
    ctx.store.getState().setDraftField('body', 'Cuerpo enviado');
    const saving = kind === 'task' ? ctx.store.getState().saveTask() : ctx.store.getState().saveNote();
    // Store-level defensive race only; UI-05 keeps the actual controls readOnly.
    ctx.store.getState().setDraftField('body', original.body);
    expect(ctx.store.getState().dirty).toBe(false);
    pending.resolve({...original, body: 'Cuerpo enviado', version: original.version + 1});
    expect(await saving).toMatchObject({status: 'saved', appliedToDraft: false});
    expect(ctx.store.getState().draft?.body).toBe(original.body);
    expect(ctx.store.getState().dirty).toBe(true);
  });

  it('4A completion baseline · selected clean completion remains completed after editing only body', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    await ctx.store.getState().setCompleted('task-1', true);
    expect(taskOf(ctx, 'task-1').completed).toBe(true);
    expect(ctx.store.getState().dirty).toBe(false);
    ctx.store.getState().setDraftField('body', 'Sólo notas editadas');
    expect(await ctx.store.getState().saveTask()).toMatchObject({status: 'saved'});
    expect(taskOf(ctx, 'task-1').completed).toBe(true);
  });

  it('4A draft · metadata and editor completion stay unconfirmed until one successful save', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    const spy = vi.spyOn(ctx.port, 'saveTask');
    const state = ctx.store.getState() as ReturnType<typeof ctx.store.getState> & {
      setTaskField?: (field: 'reason' | 'priority' | 'completed', value: string | boolean) => void;
      dirty?: boolean;
    };
    expect(state.setTaskField).toBeTypeOf('function');
    state.setTaskField?.('reason', 'Motivo literal <sin HTML>');
    state.setTaskField?.('priority', 'high');
    state.setTaskField?.('completed', true);
    expect(spy).not.toHaveBeenCalled();
    expect(taskOf(ctx, 'task-1')).toMatchObject({reason: 'Exámenes', priority: 'normal', completed: false});
    expect(ctx.store.getState()).toMatchObject({dirty: true});
    const result = await ctx.store.getState().saveTask();
    expect(result).toMatchObject({status: 'saved', selection: {kind: 'task', id: 'task-1'}, appliedToDraft: true});
    expect(spy).toHaveBeenCalledTimes(1);
    expect(taskOf(ctx, 'task-1')).toMatchObject({reason: 'Motivo literal <sin HTML>', priority: 'high', completed: true, version: 2});
    expect(ctx.store.getState()).toMatchObject({dirty: false});
  });

  it('4A cancel · restores every field, raw errors, completion and clean feedback without persistence', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.store.getState().setDraftField('title', 'Descartar');
    ctx.store.getState().setDraftField('body', 'Cuerpo a descartar');
    ctx.store.getState().setTemporalField('date', '31/02/2026');
    const state = ctx.store.getState() as ReturnType<typeof ctx.store.getState> & {
      setTaskField?: (field: 'reason' | 'priority' | 'completed', value: string | boolean) => void;
      cancelDraft?: () => void;
    };
    state.setTaskField?.('priority', 'high');
    state.setTaskField?.('completed', true);
    await state.saveTask();
    expect(ctx.store.getState().errors.date).toBeTruthy();
    expect(state.cancelDraft).toBeTypeOf('function');
    state.cancelDraft?.();
    expect(ctx.store.getState()).toMatchObject({dirty: false, errors: {}, saveError: '', feedback: ''});
    expect(ctx.store.getState().draft).toMatchObject({title: 'Tarea 1', body: '', reason: 'Exámenes', priority: 'normal', completed: false});
    expect(ctx.store.getState().temporal).toEqual({date: '07/11/2026', time: '', estimate: '', performed: '', duration: ''});
    expect(spy).not.toHaveBeenCalled();
  });

  it('4A outcome · clean and invalid saves never claim success or consume a failure', async () => {
    const ctx = await loadedStore();
    const spy = vi.spyOn(ctx.port, 'saveTask');
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.port.failNext('error');
    expect(await ctx.store.getState().saveTask()).toMatchObject({status: 'noop'});
    ctx.store.getState().setDraftField('title', '');
    expect(await ctx.store.getState().saveTask()).toMatchObject({status: 'invalid'});
    expect(spy).not.toHaveBeenCalled();
    ctx.store.getState().setDraftField('title', 'Guardar con fallo');
    expect(await ctx.store.getState().saveTask()).toMatchObject({status: 'error'});
    expect(ctx.store.getState()).toMatchObject({dirty: true});
    expect(taskOf(ctx, 'task-1').title).toBe('Tarea 1');
  });

  it('4A authority · a persisted older save updates snapshot without authorizing a newer draft', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('body', 'Versión enviada');
    const saving = ctx.store.getState().saveTask();
    expect(await ctx.store.getState().saveTask()).toMatchObject({status: 'busy'});
    // Store-level defensive race, not a claim that busy UI is editable (UI-05).
    ctx.store.getState().setDraftField('body', 'Edición posterior');
    pending.resolve({...taskOf(ctx, 'task-1'), body: 'Versión enviada', version: 2});
    expect(await saving).toMatchObject({status: 'saved', appliedToDraft: false});
    expect(taskOf(ctx, 'task-1').body).toBe('Versión enviada');
    expect(ctx.store.getState().draft?.body).toBe('Edición posterior');
    expect(ctx.store.getState()).toMatchObject({dirty: true});
  });

  it('4A validation · unrelated edits preserve unresolved errors and resolving dependency clears only its error', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setTemporalField('date', '');
    ctx.store.getState().setTemporalField('time', '09:30');
    ctx.store.getState().setTemporalField('estimate', 'abc');
    await ctx.store.getState().saveTask();
    expect(ctx.store.getState().errors).toMatchObject({date: expect.any(String), estimate: expect.any(String)});
    ctx.store.getState().setDraftField('body', 'No debe limpiar errores ajenos');
    expect(ctx.store.getState().errors).toMatchObject({date: expect.any(String), estimate: expect.any(String)});
    ctx.store.getState().setTemporalField('estimate', '-1');
    expect(ctx.store.getState().errors.estimate).toBeTruthy();
    ctx.store.getState().setTemporalField('time', '');
    expect(ctx.store.getState().errors.date).toBeUndefined();
    expect(ctx.store.getState().errors.estimate).toBeTruthy();
    ctx.store.getState().setTemporalField('estimate', '0');
    expect(ctx.store.getState().errors).toEqual({});
    expect(ctx.store.getState().temporal.estimate).toBe('0');
  });

  it('4A note outcome · failure is explicit and retry confirms only note fields', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('body', 'Nota literal <sin turno>');
    ctx.port.failNext('conflict');
    expect(await ctx.store.getState().saveNote()).toEqual({status: 'error'});
    expect(ctx.store.getState()).toMatchObject({dirty: true});
    expect(ctx.store.getState().draft).toEqual({id: 'note-1', kind: 'note', title: 'Notas generales', body: 'Nota literal <sin turno>'});
    expect(ctx.store.getState().snapshot!.notes[0]!.body).toBe('');
    expect(await ctx.store.getState().saveNote()).toMatchObject({status: 'saved', selection: {kind: 'note', id: 'note-1'}, appliedToDraft: true});
    expect(ctx.store.getState()).toMatchObject({dirty: false});
    expect(ctx.store.getState().snapshot!.notes[0]).toEqual({id: 'note-1', title: 'Notas generales', body: 'Nota literal <sin turno>', version: 2});
  });

  it('4A selection authority · success for a previous entity cannot clean the current entity', async () => {
    const ctx = await loadedStore();
    const pending = deferred<Task>();
    vi.spyOn(ctx.port, 'saveTask').mockImplementationOnce(() => pending.promise);
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    ctx.store.getState().setDraftField('title', 'A enviada');
    const saving = ctx.store.getState().saveTask();
    ctx.store.getState().select({kind: 'note', id: 'note-1'});
    ctx.store.getState().setDraftField('title', 'Nota B actual');
    const revision = (ctx.store.getState() as ReturnType<typeof ctx.store.getState> & {draftRevision?: number}).draftRevision;
    pending.resolve({...taskOf(ctx, 'task-1'), title: 'A enviada', version: 2});
    const result = await saving;
    expect(result).toMatchObject({status: 'saved', selection: {kind: 'task', id: 'task-1'}, appliedToDraft: false});
    expect(ctx.store.getState()).toMatchObject({draftRevision: revision, dirty: true});
    expect(ctx.store.getState().draft).toMatchObject({id: 'note-1', title: 'Nota B actual'});
  });

  it('4A dirty · restoring all confirmed values manually becomes clean without a save', async () => {
    const ctx = await loadedStore();
    ctx.store.getState().select({kind: 'task', id: 'task-1'});
    const state = ctx.store.getState() as ReturnType<typeof ctx.store.getState> & {
      setTaskField?: (field: 'reason' | 'priority' | 'completed', value: string | boolean) => void;
    };
    const spy = vi.spyOn(ctx.port, 'saveTask');
    state.setDraftField('title', 'Cambio'); state.setDraftField('body', 'Cambio');
    state.setTaskField?.('reason', 'Cambio'); state.setTaskField?.('priority', 'high'); state.setTaskField?.('completed', true);
    state.setTemporalField('estimate', '0');
    expect(ctx.store.getState()).toMatchObject({dirty: true});
    state.setDraftField('title', 'Tarea 1'); state.setDraftField('body', '');
    state.setTaskField?.('reason', 'Exámenes'); state.setTaskField?.('priority', 'normal'); state.setTaskField?.('completed', false);
    state.setTemporalField('estimate', '');
    expect(ctx.store.getState()).toMatchObject({dirty: false});
    expect(await ctx.store.getState().saveTask()).toEqual({status: 'noop'});
    expect(spy).not.toHaveBeenCalled();
  });
});
