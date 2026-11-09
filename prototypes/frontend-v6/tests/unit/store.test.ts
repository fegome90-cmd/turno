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
