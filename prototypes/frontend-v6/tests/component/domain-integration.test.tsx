// Product integration: no mocked components or replacement navigation controller.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(width = 1440) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: width});
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0})}); sessions.push(session); await session.store.getState().load();
  const rendered = render(<AppProviders><App session={session}/></AppProviders>), user = userEvent.setup();
  if (width < 600) await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
  await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Ir al turno actual'}));
  await waitFor(() => expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Tarea 1'));
  return {session, user, ...rendered};
}
const dialog = () => screen.getByRole('dialog', {name: 'Editar nombre de lista'});
async function rename(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', {name: 'Editar nombre de Lista 1'}));
  return within(dialog()).getByRole('textbox', {name: 'Nombre de la lista'});
}

describe('4B T2 · domain intent and lifetime', () => {
  it('Home Start cancel returns to the initiating Home action without forwarding a click event as a focus key', async () => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
    const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0})}); sessions.push(session); await session.store.getState().load(); await session.port.closeShift('demo-shift-1'); await session.store.getState().load();
    render(<AppProviders><App session={session}/></AppProviders>); const user = userEvent.setup(), entry = within(screen.getByRole('main')).getByRole('button');
    await user.click(entry); const modal = screen.getByRole('dialog', {name: 'Iniciar turno'}); await user.click(within(modal).getByRole('button', {name: 'Cancelar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Iniciar turno'})).not.toBeInTheDocument()); await waitFor(() => expect(entry).toHaveFocus());
  });
  it('drawer action opens the domain dialog after closing navigation, then Cancel returns to the visible disclosure', async () => {
    const {user, session} = await setup(390); await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    await user.click(screen.getByRole('button', {name: 'Agregar tarea a Lista 1'}));
    const modal = await screen.findByRole('dialog', {name: 'Agregar tarea'});
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toEqual(['domain-dialog']);
    expect(within(modal).getByRole('textbox', {name: 'Título de tarea nueva'})).toHaveFocus();
    await user.click(within(modal).getByRole('button', {name: 'Cancelar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar tarea'})).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', {name: 'Abrir navegación'})).toHaveFocus());
  });
  it('global and inline task creation use the selected list while the editor node survives Cancel', async () => {
    const {user, session} = await setup(), editor = screen.getByRole('textbox', {name: 'Notas de la tarea'});
    const entry = document.querySelector<HTMLButtonElement>('[data-focus-key="create-task-inline"]')!; expect(entry).toBeEnabled(); await user.click(entry);
    let modal = screen.getByRole('dialog', {name: 'Agregar tarea'}); await user.click(within(modal).getByRole('button', {name: 'Cancelar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar tarea'})).not.toBeInTheDocument()); expect(screen.getByRole('textbox', {name: 'Notas de la tarea'})).toBe(editor);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: 'Agregar tarea'})); modal = screen.getByRole('dialog', {name: 'Agregar tarea'});
    await user.type(within(modal).getByRole('textbox', {name: 'Título de tarea nueva'}), 'Creada desde global'); await user.click(within(modal).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(session.store.getState().snapshot!.tasks.find((task) => task.title === 'Creada desde global')).toMatchObject({bedId: 'bed-1'}));
  });
  it('creating in a collapsed list expands that owning list and selects the new task', async () => {
    const {user, session} = await setup(); expect(session.store.getState().expandedBeds).not.toContain('bed-2');
    await user.click(screen.getByRole('button', {name: 'Agregar tarea a Lista 2'})); const modal = screen.getByRole('dialog', {name: 'Agregar tarea'});
    await user.type(within(modal).getByRole('textbox', {name: 'Título de tarea nueva'}), 'Visible en lista antes plegada'); await user.click(within(modal).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar tarea'})).not.toBeInTheDocument());
    expect(session.store.getState().expandedBeds).toContain('bed-2'); const task = session.store.getState().snapshot!.tasks.find((item) => item.title === 'Visible en lista antes plegada')!;
    expect(task.bedId).toBe('bed-2'); expect(session.store.getState().selection).toEqual({kind: 'task', id: task.id}); expect(screen.getByRole('button', {name: task.title})).toBeVisible();
  });
  it('a confirmed rename after a newer selection updates the snapshot but cannot close or redirect that newer intent', async () => {
    const {user, session} = await setup(), field = await rename(user); await user.clear(field); await user.type(field, 'Resultado antiguo confirmado');
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.renameBed.bind(session.port);
    vi.spyOn(session.port, 'renameBed').mockImplementation(async (...args) => {await held; return actual(...args);});
    await user.click(within(dialog()).getByRole('button', {name: 'Guardar nombre'}));
    act(() => session.store.getState().select({kind: 'task', id: 'task-2'})); await act(async () => {release();});
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(session.store.getState().snapshot!.beds[0]!.label).toBe('Resultado antiguo confirmado'); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-2'}); expect(dialog()).toBeInTheDocument(); expect(field).toHaveValue('Resultado antiguo confirmado');
  });
  it('a request already persisted after unmount cannot push a route or select the new entity', async () => {
    const {user, session, unmount} = await setup(), push = vi.spyOn(window.history, 'pushState');
    await user.click(screen.getByRole('button', {name: 'Agregar tarea a Lista 1'})); const modal = screen.getByRole('dialog', {name: 'Agregar tarea'});
    await user.type(within(modal).getByRole('textbox', {name: 'Título de tarea nueva'}), 'Persistida sin continuación');
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.createTask.bind(session.port);
    vi.spyOn(session.port, 'createTask').mockImplementation(async (...args) => {await held; return actual(...args);});
    await user.click(within(modal).getByRole('button', {name: 'Crear'})); const before = push.mock.calls.length; unmount(); await act(async () => {release();});
    await waitFor(() => expect(session.store.getState().busy).toBe(false)); expect(session.store.getState().snapshot!.tasks.some((task) => task.title === 'Persistida sin continuación')).toBe(true); expect(push).toHaveBeenCalledTimes(before); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'});
  });
  it('a reopened rename owns a fresh raw value and error state', async () => {
    const {user} = await setup(); let field = await rename(user); await user.clear(field); await user.type(field, '   '); fireEvent.submit(dialog().querySelector('form')!); await within(dialog()).findByRole('alert');
    await user.click(within(dialog()).getByRole('button', {name: 'Cancelar'})); await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Editar nombre de lista'})).not.toBeInTheDocument());
    field = await rename(user); expect(field).toHaveValue('Lista 1'); expect(field).not.toHaveAttribute('aria-invalid', 'true'); expect(within(dialog()).queryByRole('alert')).not.toBeInTheDocument();
  });
  it('composition does not submit a partially composed name', async () => {
    const {user, session} = await setup(), field = await rename(user), save = vi.spyOn(session.port, 'renameBed');
    fireEvent.compositionStart(field); fireEvent.change(field, {target: {value: '夜班'}}); fireEvent.submit(dialog().querySelector('form')!); expect(save).not.toHaveBeenCalled(); expect(field).toHaveValue('夜班');
    fireEvent.compositionEnd(field); fireEvent.submit(dialog().querySelector('form')!); await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
  it('busy Escape is vetoed and duplicate submit cannot duplicate a rename', async () => {
    const {user, session} = await setup(), field = await rename(user); await user.clear(field); await user.type(field, 'Una sola confirmación');
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.renameBed.bind(session.port);
    const save = vi.spyOn(session.port, 'renameBed').mockImplementation(async (...args) => {await held; return actual(...args);});
    fireEvent.submit(dialog().querySelector('form')!); await user.keyboard('{Escape}'); fireEvent.submit(dialog().querySelector('form')!); expect(dialog()).toBeInTheDocument(); expect(save).toHaveBeenCalledTimes(1); expect(field).toHaveAttribute('readonly');
    await act(async () => {release();}); await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Editar nombre de lista'})).not.toBeInTheDocument());
  });
});
