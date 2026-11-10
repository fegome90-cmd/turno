// T3 product flows, using the real in-memory adapter and the indexed navigation consumer.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(pending = 4) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440}); window.history.replaceState(null, '');
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0})}); sessions.push(session); await session.store.getState().load();
  const tasks = session.store.getState().snapshot!.tasks;
  for (const task of tasks.slice(pending)) await session.store.getState().setCompleted(task.id, true);
  const view = render(<AppProviders><App session={session}/></AppProviders>), user = userEvent.setup(), nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); return {session, user, nav, ...view};
}
async function closeShift(user: ReturnType<typeof userEvent.setup>) {
  const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry);
  const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'}); await user.click(within(dialog).getByRole('button', {name: 'Cerrar y archivar'}));
  await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Cerrar turno'})).not.toBeInTheDocument());
}
async function archive(user: ReturnType<typeof userEvent.setup>, nav: ReturnType<typeof within>) {
  await user.click(nav.getByRole('button', {name: 'Archivo de turnos anteriores'})); expect(screen.getByRole('heading', {name: 'Turnos anteriores'})).toBeInTheDocument();
  await user.click(screen.getByRole('button', {name: /^Turno de día ·/})); await waitFor(() => expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Tarea 1'));
}


function controlledHistory() {
  const entries: unknown[] = [null], events: unknown[] = []; let index = 0;
  const move = (delta: number) => {const target = index + delta; if (target < 0 || target >= entries.length) return; index = target; events.push(entries[index]);};
  vi.spyOn(window.history, 'state', 'get').mockImplementation(() => entries[index]);
  vi.spyOn(window.history, 'replaceState').mockImplementation((data) => {entries[index] = structuredClone(data);});
  vi.spyOn(window.history, 'pushState').mockImplementation((data) => {entries.splice(index + 1); entries.push(structuredClone(data)); index++;});
  vi.spyOn(window.history, 'go').mockImplementation((delta = 0) => move(delta));
  return {move, flush() {let count = 0; while (events.length) {if (++count > 30) throw Error('Unexpected traversal loop'); window.dispatchEvent(new PopStateEvent('popstate', {state: events.shift()}));}}};
}
describe('4B T3 · close, start and archived ownership', () => {
  it('a real close/start/archive cycle preserves old pending tasks and global notes while a new shift starts empty', async () => {
    const {session, user, nav} = await setup(), before = structuredClone(session.store.getState().snapshot!); await closeShift(user);
    expect(session.store.getState()).toMatchObject({view: 'home', selection: null, draft: null, dirty: false, archiveId: null}); expect(screen.getByRole('main')).toHaveTextContent('No hay un turno abierto.');
    await user.click(within(screen.getByRole('main')).getByRole('button', {name: 'Iniciar turno'})); const dialog = screen.getByRole('dialog', {name: 'Iniciar turno'});
    await user.type(within(dialog).getByRole('textbox', {name: 'Nombre del turno'}), 'Siguiente turno vacío'); await user.click(within(dialog).getByRole('button', {name: 'Iniciar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Iniciar turno'})).not.toBeInTheDocument()); const snapshot = session.store.getState().snapshot!, nextId = snapshot.activeShiftId!;
    expect(snapshot.tasks).toEqual(before.tasks); expect(snapshot.notes).toEqual(before.notes); expect(snapshot.tasks.filter((task) => task.shiftId === nextId)).toEqual([]); expect(snapshot.beds.filter((bed) => bed.shiftId === nextId)).toEqual([]);
    await archive(user, nav); expect(session.store.getState().archiveId).toBe('demo-shift-1'); expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveAttribute('readonly'); expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled(); expect(nav.getByRole('checkbox', {name: 'Completar Tarea 1'})).toBeDisabled();
    expect(screen.getByRole('main')).toHaveTextContent('Turno archivado · Solo lectura. Los pendientes se conservan.'); expect(document.querySelectorAll('button[aria-label^="Editar nombre de "]')).toHaveLength(0);
    await user.click(screen.getByRole('tab', {name: 'Agenda'})); const agenda = within(screen.getByRole('tabpanel', {name: 'Agenda'})); expect(agenda.getByRole('button', {name: /Tarea 1/})).toBeInTheDocument(); expect(agenda.getByRole('button', {name: /Revisar material.*Prioridad Alta/})).toBeInTheDocument(); expect(agenda.queryByText('Siguiente turno vacío')).not.toBeInTheDocument(); await user.click(nav.getByRole('button', {name: 'Lista 2'})); expect(nav.getByRole('button', {name: /Revisar material.*Prioridad Alta/})).toBeInTheDocument(); expect(nav.getByRole('checkbox', {name: 'Completar Revisar material'})).toBeDisabled();
    await user.click(nav.getByRole('button', {name: 'Agregar tarea'}));
    const create = screen.getByRole('dialog', {name: 'Agregar tarea'}); await user.type(within(create).getByRole('textbox', {name: 'Título de tarea nueva'}), 'Global en el nuevo turno'); await user.click(within(create).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar tarea'})).not.toBeInTheDocument()); expect(session.store.getState().snapshot!.tasks.find((task) => task.title === 'Global en el nuevo turno')).toMatchObject({shiftId: nextId, bedId: null}); expect(session.store.getState().archiveId).toBeNull(); expect(session.store.getState().snapshot!.tasks.filter((task) => task.shiftId === 'demo-shift-1')).toEqual(before.tasks);
  });
  it('one pending task uses singular Home and close copy, and Volver preserves the open shift', async () => {
    const {session, user, nav} = await setup(1); await user.click(nav.getByRole('button', {name: 'Inicio'})); expect(screen.getByRole('main')).toHaveTextContent('Turno de día · 1 pendiente'); expect(screen.getByRole('main')).not.toHaveTextContent('1 pendientes');
    const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry); const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'}); expect(dialog).toHaveTextContent('1 tarea pendiente se conservará'); expect(dialog).not.toHaveTextContent('1 tareas pendientes');
    await user.click(within(dialog).getByRole('button', {name: 'Volver'})); await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Cerrar turno'})).not.toBeInTheDocument()); expect(session.store.getState().snapshot!.activeShiftId).toBe('demo-shift-1'); expect(entry).toHaveFocus();
  });
  it('closing from Home keeps the same route and restores focus to the newly available Start action', async () => {
    const {session, user, nav} = await setup(); await user.click(nav.getByRole('button', {name: 'Inicio'})); const push = vi.spyOn(window.history, 'pushState'), count = push.mock.calls.length;
    await closeShift(user); expect(session.store.getState().view).toBe('home'); expect(push).toHaveBeenCalledTimes(count);
    await waitFor(() => expect(within(screen.getByRole('main')).getByRole('button', {name: 'Iniciar turno'})).toHaveFocus());
  });
  it('dirty close goes through the existing guard and invalid Save cannot open close or lose temporal raw', async () => {
    const {session, user} = await setup(); await user.click(screen.getByRole('button', {name: /^Estimación/})); const raw = screen.getByLabelText('Minutos estimados'); await user.type(raw, 'abc');
    const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry); let guard = screen.getByRole('dialog', {name: 'Hay cambios sin guardar'}); await user.click(within(guard).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).not.toBeInTheDocument()); expect(screen.queryByRole('dialog', {name: 'Cerrar turno'})).not.toBeInTheDocument(); expect(raw).toHaveValue('abc'); expect(raw).toHaveFocus(); expect(session.store.getState().dirty).toBe(true);
    await user.click(entry); guard = screen.getByRole('dialog', {name: 'Hay cambios sin guardar'}); await user.click(within(guard).getByRole('button', {name: 'Descartar cambios'})); await waitFor(() => expect(screen.getByRole('dialog', {name: 'Cerrar turno'})).toBeInTheDocument()); expect(raw).toHaveValue(''); expect(session.store.getState().dirty).toBe(false);
  });
  it('a pending close locks both decisions and Escape, and a repeated confirmation persists once', async () => {
    const {session, user} = await setup(); const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry); const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'});
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.closeShift.bind(session.port); const close = vi.spyOn(session.port, 'closeShift').mockImplementation(async (...args) => {await held; return actual(...args);});
    const confirm = within(dialog).getByRole('button', {name: 'Cerrar y archivar'}); await user.dblClick(confirm); expect(close).toHaveBeenCalledTimes(1); expect(confirm).toBeDisabled(); expect(within(dialog).getByRole('button', {name: 'Volver'})).toBeDisabled(); await user.keyboard('{Escape}'); expect(dialog).toBeInTheDocument();
    await act(async () => {release();}); await waitFor(() => expect(session.store.getState().view).toBe('home')); expect(session.store.getState().snapshot!.activeShiftId).toBeNull();
  });
  it('a confirmed close after a newer editor revision cannot clear that newer draft or navigate Home', async () => {
    const {session, user} = await setup(); const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry); const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'});
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.closeShift.bind(session.port); vi.spyOn(session.port, 'closeShift').mockImplementation(async (...args) => {await held; return actual(...args);});
    await user.click(within(dialog).getByRole('button', {name: 'Cerrar y archivar'})); act(() => session.store.getState().setDraftField('body', 'Intención posterior retenida')); await act(async () => {release();}); await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(session.store.getState().snapshot!.activeShiftId).toBeNull(); expect(session.store.getState().view).toBe('workspace'); expect(session.store.getState().draft?.body).toBe('Intención posterior retenida'); expect(dialog).toBeInTheDocument();
  });
  it('a close already initiated may persist after unmount but never pushes Home', async () => {
    const {session, user, unmount} = await setup(); const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry); const dialog = screen.getByRole('dialog', {name: 'Cerrar turno'}), push = vi.spyOn(window.history, 'pushState');
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;}), actual = session.port.closeShift.bind(session.port); vi.spyOn(session.port, 'closeShift').mockImplementation(async (...args) => {await held; return actual(...args);});
    await user.click(within(dialog).getByRole('button', {name: 'Cerrar y archivar'})); const count = push.mock.calls.length; unmount(); await act(async () => {release();}); await waitFor(() => expect(session.store.getState().busy).toBe(false)); expect(session.store.getState().snapshot!.activeShiftId).toBeNull(); expect(push).toHaveBeenCalledTimes(count); expect(session.store.getState().view).toBe('workspace');
  });
  it('archive route context survives Back/Forward between a closed task and a global note', async () => {
    const history = controlledHistory(), {session, user, nav} = await setup(); await closeShift(user); await archive(user, nav);
    await user.click(nav.getByRole('button', {name: 'Notas rápidas'})); expect(session.store.getState().view).toBe('notes'); expect(session.store.getState().archiveId).toBeNull();
    act(() => {history.move(-1); history.flush();}); expect(session.store.getState().archiveId).toBe('demo-shift-1'); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'}); expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveAttribute('readonly');
    act(() => {history.move(1); history.flush();}); expect(session.store.getState().archiveId).toBeNull(); expect(screen.getByRole('textbox', {name: 'Título de nota'})).not.toHaveAttribute('readonly');
  });
  it('archived temporal and editor controls cannot mutate the owner while quick-note creation remains global', async () => {
    const {session, user, nav} = await setup(); await closeShift(user); await archive(user, nav); const before = structuredClone(session.store.getState().snapshot!.tasks);
    await user.click(screen.getByRole('button', {name: /^Fecha/})); const date = screen.getByLabelText('Día / mes / año'); expect(date).toBeDisabled(); fireEvent.change(date, {target: {value: '01/01/2030'}});
    expect(session.store.getState().temporal.date).toBe('07/11/2026'); expect(session.store.getState().dirty).toBe(false); expect(nav.getByRole('button', {name: 'Agregar tarea'})).toBeDisabled(); expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled();
    await user.click(nav.getByRole('button', {name: 'Agregar nota rápida'})); const dialog = screen.getByRole('dialog', {name: 'Nueva nota rápida'}); await user.type(within(dialog).getByRole('textbox', {name: 'Título de nota nueva'}), 'Nota desde archivo'); await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(screen.getByRole('textbox', {name: 'Título de nota'})).toHaveValue('Nota desde archivo')); const note = session.store.getState().snapshot!.notes.find((item) => item.title === 'Nota desde archivo')!;
    expect(note).not.toHaveProperty('shiftId'); expect(note).not.toHaveProperty('bedId'); expect(session.store.getState().archiveId).toBeNull(); expect(session.store.getState().snapshot!.tasks).toEqual(before);
  });
  it('close from the navigation drawer opens only the close layer and Volver returns to the visible navigation disclosure', async () => {
    const {session, user} = await setup(); act(() => {window.innerWidth = 390; window.dispatchEvent(new Event('resize'));});
    const trigger = screen.getByRole('button', {name: 'Abrir navegación'}); await user.click(trigger); const drawer = screen.getByRole('dialog', {name: 'Navegación'}); await user.click(within(drawer).getByRole('button', {name: 'Cerrar turno'}));
    const dialog = await screen.findByRole('dialog', {name: 'Cerrar turno'}); expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toEqual(['domain-dialog']); await user.click(within(dialog).getByRole('button', {name: 'Volver'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Cerrar turno'})).not.toBeInTheDocument()); await waitFor(() => expect(trigger).toHaveFocus()); expect(session.store.getState().snapshot!.activeShiftId).toBe('demo-shift-1');
  });

});
