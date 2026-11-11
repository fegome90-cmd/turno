// Regression checks exercise App, the store and the real in-memory port.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(archived = false) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  window.history.replaceState(null, '');
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0})}); sessions.push(session);
  await session.store.getState().load();
  if (archived) {
    await session.store.getState().closeShift('demo-shift-1');
    await session.store.getState().openShift('Turno B activo');
  }
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup(), nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  return {session, user, nav};
}
describe('Claude review · domain flow regressions', () => {
  it('F2: closing while reading archive A names active B and only closes B', async () => {
    const {session, user, nav} = await setup(true), before = structuredClone(session.store.getState().snapshot!);
    await user.click(nav.getByRole('button', {name: 'Archivo de turnos anteriores'}));
    await user.click(screen.getByRole('button', {name: /^Turno de día ·/}));
    expect(session.store.getState().archiveId).toBe('demo-shift-1');
    const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'});
    expect(dialog).toHaveTextContent('Turno B activo');
    expect(dialog).toHaveTextContent('0 tareas pendientes');
    expect(dialog).not.toHaveTextContent('Turno de día');
    await user.click(within(dialog).getByRole('button', {name: 'Cerrar y archivar'}));
    await waitFor(() => expect(session.store.getState().snapshot!.activeShiftId).toBeNull());
    expect(session.store.getState().snapshot!.shifts.find((shift) => shift.id === before.activeShiftId)?.status).toBe('closed');
    expect(session.store.getState().snapshot!.shifts.find((shift) => shift.id === 'demo-shift-1')).toEqual(before.shifts.find((shift) => shift.id === 'demo-shift-1'));
    expect(session.store.getState().snapshot!.tasks).toEqual(before.tasks);
  });
  it('F3: creating a list from Notes clears note selection in workspace without losing the note', async () => {
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Notas rápidas'}));
    expect(session.store.getState().selection?.kind).toBe('note');
    const before = structuredClone(session.store.getState().snapshot!.notes);
    await user.click(nav.getByRole('button', {name: 'Agregar lista'}));
    const dialog = screen.getByRole('dialog', {name: 'Agregar lista'});
    await user.type(within(dialog).getByRole('textbox', {name: 'Nombre de lista'}), 'Lista desde notas');
    await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(session.store.getState().view).toBe('workspace'));
    expect(session.store.getState().selection).toBeNull();
    expect(session.store.getState().draft).toBeNull();
    expect(screen.queryByRole('textbox', {name: 'Título de nota'})).not.toBeInTheDocument();
    expect(session.store.getState().snapshot!.notes).toEqual(before);
    expect(session.store.getState().snapshot!.beds.some((bed) => bed.label === 'Lista desde notas')).toBe(true);
    await user.click(nav.getByRole('button', {name: 'Notas rápidas'}));
    expect(screen.getByRole('textbox', {name: 'Título de nota'})).toHaveValue(before[0]!.title);
  });
  it('F3: creating a list in workspace retains an existing task selection', async () => {
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    const selected = session.store.getState().selection;
    expect(selected?.kind).toBe('task');
    await user.click(nav.getByRole('button', {name: 'Agregar lista'}));
    const dialog = screen.getByRole('dialog', {name: 'Agregar lista'});
    await user.type(within(dialog).getByRole('textbox', {name: 'Nombre de lista'}), 'Conservar tarea');
    await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar lista'})).not.toBeInTheDocument());
    expect(session.store.getState().selection).toEqual(selected);
    expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Tarea 1');
  });
  it('H1: a fresh request permits creation again after a previous request succeeded', async () => {
    const {session, user, nav} = await setup();
    const create = vi.spyOn(session.port, 'createNote');
    for (const name of ['Primera nota nueva', 'Segunda nota nueva']) {
      await user.click(nav.getByRole('button', {name: 'Agregar nota rápida'}));
      const dialog = screen.getByRole('dialog', {name: 'Nueva nota rápida'});
      await user.type(within(dialog).getByRole('textbox', {name: 'Título de nota nueva'}), name);
      await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
      await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Nueva nota rápida'})).not.toBeInTheDocument());
      expect(screen.getByRole('textbox', {name: 'Título de nota'})).toHaveValue(name);
    }
    expect(create).toHaveBeenCalledTimes(2);
  });
  it('H1: a saved request cannot create again while its dialog remains mounted after a newer editor revision', async () => {
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(nav.getByRole('button', {name: 'Agregar tarea'}));
    const dialog = screen.getByRole('dialog', {name: 'Agregar tarea'}), form = dialog.querySelector('form')!;
    await user.type(within(dialog).getByRole('textbox', {name: 'Título de tarea nueva'}), 'Una sola creación');
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;});
    const actual = session.port.createTask.bind(session.port), create = vi.spyOn(session.port, 'createTask').mockImplementation(async (...args) => {await held; return actual(...args);});
    fireEvent.submit(form);
    act(() => session.store.getState().setDraftField('body', 'Revisión posterior protegida'));
    await act(async () => {release();});
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox', {name: 'Título de tarea nueva'})).toHaveAttribute('readonly');
    expect(within(dialog).getByRole('button', {name: 'Crear'})).toBeDisabled();
    expect(within(dialog).getByRole('button', {name: 'Cancelar'})).toBeEnabled();
    expect(session.store.getState().snapshot!.tasks.filter((task) => task.title === 'Una sola creación')).toHaveLength(1);
    fireEvent.submit(form);
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(create).toHaveBeenCalledTimes(1);
    expect(session.store.getState().draft?.body).toBe('Revisión posterior protegida');
  });
});
