// Portado de v5 tests/preview.test.mjs (PREVIEW-02..20) y tests/emil-skills.test.mjs (EMIL-SKILLS-07).
// D7: el término visible del grupo de tareas pasa a «Lista» (ver evidence/2A/LOG.md). Los IDs y nombres internos (`bed-1`, `Bed`) no cambian.
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import {installNetworkAndStorageSpies} from '../../src/test/network-spy';
import type {QuickNote, Task} from '../../src/domain/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

const firstTask = async (adapter: ReturnType<typeof createPreviewAdapter>): Promise<Task> => (await adapter.load()).tasks[0];

describe('adaptador de vista previa', () => {
  it('PREVIEW-02 · snapshots are detached', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    snapshot.tasks[0].title = 'mutated';
    expect((await adapter.load()).tasks[0].title).not.toBe('mutated');
  });

  it('PREVIEW-02 · añadido: dos instancias del adaptador no comparten estado', async () => {
    const first = createPreviewAdapter();
    const second = createPreviewAdapter();
    const task = await firstTask(first);
    await first.saveTask({...task, title: 'Solo en la primera'});
    await first.createBed('Lista solo primera');
    expect((await second.load()).tasks[0].title).toBe('Tarea 1');
    expect((await second.load()).beds).toHaveLength(2);
    expect((await second.load()).activeShiftId).toBe('demo-shift-1');
  });

  it('PREVIEW-02 · añadido: el adaptador no llama a red ni a almacenamiento', async () => {
    const spies = installNetworkAndStorageSpies();
    try {
      const adapter = createPreviewAdapter();
      const task = await firstTask(adapter);
      await adapter.saveTask({...task, title: 'Sin red'});
      await adapter.createTask('Nueva');
      await adapter.closeShift('demo-shift-1');
      expect(spies.calls()).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('PREVIEW-03 · save accepts literal title and increments version', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    const updated = await adapter.saveTask({...task, title: '<b>Literal</b>'});
    expect(updated.title).toBe('<b>Literal</b>');
    expect(updated.version).toBe(task.version + 1);
  });

  it('PREVIEW-03 · añadido: título de 1 y 300 caracteres se guarda; 301 se rechaza sin cambiar el estado', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    const one = await adapter.saveTask({...task, title: 'J'});
    expect(one.title).toBe('J');
    const long = await adapter.saveTask({...one, title: 'x'.repeat(300)});
    expect(long.title).toHaveLength(300);
    const before = await adapter.load();
    await expect(adapter.saveTask({...long, title: 'x'.repeat(301)})).rejects.toThrow(/título/i);
    expect(await adapter.load()).toEqual(before);
  });

  it('PREVIEW-03 · añadido: cuerpo de 10.000 se guarda y 10.001 se rechaza; HTML en el cuerpo se guarda literal', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    const prefix = '<script>x</script>';
    const ok = await adapter.saveTask({...task, body: prefix + 'a'.repeat(10000 - prefix.length)});
    expect(ok.body.length).toBe(10000);
    expect(ok.body.startsWith(prefix)).toBe(true);
    await expect(adapter.saveTask({...ok, body: 'a'.repeat(10001)})).rejects.toThrow(/10\.000/);
  });

  it('PREVIEW-04 · save rejects blank title without changing state', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    await expect(adapter.saveTask({...snapshot.tasks[0], title: '  '})).rejects.toThrow(/título/i);
    expect(await adapter.load()).toEqual(snapshot);
  });

  it('PREVIEW-05 · version conflict preserves confirmed state', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    await adapter.saveTask({...task, title: 'First'});
    await expect(adapter.saveTask({...task, title: 'Second'})).rejects.toThrow(/versión/i);
    expect((await adapter.load()).tasks[0].title).toBe('First');
  });

  it('PREVIEW-06 · simulated failed save does not commit', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    adapter.failNext('error');
    await expect(adapter.saveTask({...task, title: 'Lost'})).rejects.toThrow(/simulado/i);
    expect((await adapter.load()).tasks[0].title).toBe(task.title);
  });

  it('PREVIEW-07 · close preserves pending tasks and notes; opening is empty', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    await adapter.closeShift(snapshot.activeShiftId as string);
    const closed = await adapter.load();
    expect(closed.activeShiftId).toBeNull();
    expect(closed.tasks).toEqual(snapshot.tasks);
    expect(closed.notes).toEqual(snapshot.notes);
    expect(closed.shifts[0].status).toBe('closed');
    const next = await adapter.openShift('Turno de noche');
    const reopened = await adapter.load();
    expect(reopened.tasks.filter((task) => task.shiftId === next.id)).toHaveLength(0);
    expect(reopened.beds.filter((bed) => bed.shiftId === next.id)).toHaveLength(0);
  });

  it('PREVIEW-08 · quick note has no shift or bed fields', async () => {
    const adapter = createPreviewAdapter();
    const note = await adapter.createNote('Nota general');
    expect('shiftId' in note).toBe(false);
    expect('bedId' in note).toBe(false);
  });

  it('PREVIEW-09 · cannot create a task without an open shift or cross-link a bed', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    await expect(adapter.createTask('Ejemplo', 'wrong')).rejects.toThrow(/lista/i);
    await adapter.closeShift(snapshot.activeShiftId as string);
    await expect(adapter.createTask('Ejemplo')).rejects.toThrow(/turno/i);
  });

  it('PREVIEW-09 · añadido: una lista de otro turno se rechaza', async () => {
    const adapter = createPreviewAdapter();
    await adapter.closeShift('demo-shift-1');
    await adapter.openShift('Turno nuevo');
    await expect(adapter.createTask('Ejemplo', 'bed-1')).rejects.toThrow('La lista no pertenece al turno.');
  });

  it('PREVIEW-10 · archive is read only', async () => {
    const adapter = createPreviewAdapter();
    const snapshot = await adapter.load();
    await adapter.closeShift(snapshot.activeShiftId as string);
    await expect(adapter.saveTask({...snapshot.tasks[0], title: 'Changed'})).rejects.toThrow(/cerrado/i);
  });

  it('PREVIEW-11 · only one active shift in preview', async () => {
    const adapter = createPreviewAdapter();
    await expect(adapter.openShift('Duplicate')).rejects.toThrow(/abierto/i);
  });

  it('PREVIEW-12 · new bed and task are linked to active shift', async () => {
    const adapter = createPreviewAdapter();
    const bed = await adapter.createBed('Lista 3');
    const task = await adapter.createTask('Nueva tarea', bed.id);
    expect(task.bedId).toBe(bed.id);
    expect(task.shiftId).toBe(bed.shiftId);
  });

  it('PREVIEW-13 · note save is independent and ignores foreign linkage fields', async () => {
    const adapter = createPreviewAdapter();
    const note = (await adapter.load()).notes[0];
    const foreign = {...note, body: 'Texto general', shiftId: 'wrong'};
    const saved: QuickNote = await adapter.saveNote(foreign);
    expect(saved.body).toBe('Texto general');
    expect('shiftId' in saved).toBe(false);
  });

  it('PREVIEW-14 · time requires date and accepts 24-hour format', async () => {
    const adapter = createPreviewAdapter();
    const task = await firstTask(adapter);
    await expect(adapter.saveTask({...task, date: null, time: '10:30'})).rejects.toThrow(/fecha/);
    await expect(adapter.saveTask({...task, time: '25:00'})).rejects.toThrow(/hora/);
    const saved = await adapter.saveTask({...task, time: '23:59'});
    expect(saved.time).toBe('23:59');
  });

  it('PREVIEW-15 · close repetition preserves the same result', async () => {
    const adapter = createPreviewAdapter();
    const id = (await adapter.load()).activeShiftId as string;
    const first = await adapter.closeShift(id);
    expect(await adapter.closeShift(id)).toEqual(first);
  });

  it('PREVIEW-16 · renameBed changes only the label and preserves IDs, shift and all task relations', async () => {
    const adapter = createPreviewAdapter();
    const before = await adapter.load();
    const result = await adapter.renameBed('bed-1', 'Lista norte');
    const after = await adapter.load();
    expect(result).toEqual({...before.beds[0], label: 'Lista norte'});
    expect(after.tasks).toEqual(before.tasks);
    expect(after.beds[1]).toEqual(before.beds[1]);
    expect(after.beds[0].id).toBe('bed-1');
    expect(after.beds[0].shiftId).toBe(before.beds[0].shiftId);
  });

  it('PREVIEW-17 · duplicate group names do not merge stable identities or task membership', async () => {
    const adapter = createPreviewAdapter();
    const before = await adapter.load();
    await adapter.renameBed('bed-1', 'Lista 2');
    const after = await adapter.load();
    expect(after.beds.map((bed) => bed.label)).toEqual(['Lista 2', 'Lista 2']);
    expect(after.beds.map((bed) => bed.id)).toEqual(['bed-1', 'bed-2']);
    expect(after.tasks).toEqual(before.tasks);
  });

  it('PREVIEW-18 · renameBed rejects invalid labels and missing groups without changing the snapshot', async () => {
    const adapter = createPreviewAdapter();
    const before = await adapter.load();
    for (const label of ['  ', 'x'.repeat(301)]) {
      await expect(adapter.renameBed('bed-1', label)).rejects.toThrow(/título/i);
    }
    await expect(adapter.renameBed('missing', 'Nueva')).rejects.toThrow(/encontrada/);
    expect(await adapter.load()).toEqual(before);
  });

  it('PREVIEW-19 · renameBed failure leaves label and relationships unchanged; retry can succeed', async () => {
    const adapter = createPreviewAdapter();
    const before = await adapter.load();
    adapter.failNext('error');
    await expect(adapter.renameBed('bed-1', 'Recuperado')).rejects.toThrow(/simulado/);
    expect(await adapter.load()).toEqual(before);
    await adapter.renameBed('bed-1', 'Recuperado');
    expect((await adapter.load()).beds[0].label).toBe('Recuperado');
  });

  it('PREVIEW-20 · archived group cannot be renamed even after opening a new active shift', async () => {
    const adapter = createPreviewAdapter();
    await adapter.closeShift('demo-shift-1');
    await adapter.openShift('Nuevo turno');
    const before = await adapter.load();
    await expect(adapter.renameBed('bed-1', 'No cambiar')).rejects.toThrow(/solo lectura/);
    expect(await adapter.load()).toEqual(before);
  });

  it('EMIL-SKILLS-07 · simulated adapter conflict identifies its type without prescribing Save', async () => {
    const adapter = createPreviewAdapter();
    adapter.failNext('conflict');
    const error = await adapter.closeShift('demo-shift-1').then(
      () => null,
      (caught: Error & {code?: string}) => caught,
    );
    expect(error?.code).toBe('SIMULATED_CONFLICT');
    expect(error?.message).not.toMatch(/guardar|borrador/i);
    expect((await adapter.load()).activeShiftId).toBe('demo-shift-1');
  });
});
