// Real product integration. Technical history harness results cannot close these
// guards, completion intents or focus-ownership behaviors.
import {act, fireEvent, render, renderHook, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {OverlayProvider} from '../../src/components/OverlayCoordinator';
import {useProductNavigation} from '../../src/navigation/use-product-navigation';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(width = 1440, selected = false) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: width});
  window.history.replaceState(null, '');
  const session = createSession({random: () => 0}); sessions.push(session); await session.store.getState().load();
  if (selected) {session.store.getState().setView('workspace'); session.store.getState().select({kind: 'task', id: 'task-1'});}
  render(<AppProviders><App session={session}/></AppProviders>);
  return {session, user: userEvent.setup(), nav: within(screen.getByRole('navigation', {name: 'Principal', hidden: width < 700}))};
}
const taskTitle = () => screen.getByRole('textbox', {name: 'Título de tarea'});
const body = () => screen.getByRole('textbox', {name: 'Notas de la tarea'});
const confirmation = () => screen.getByRole('dialog', {name: 'Hay cambios sin guardar'});

describe('4A integrated history and guards', () => {
  it('HISTORY-01/02/03 · initial replace, one push per real route, no push for rerender and live title', async () => {
    const push = vi.spyOn(window.history, 'pushState');
    const {session, user, nav} = await setup();
    expect(window.history.state).toMatchObject({idx: 0, view: 'home', selected: null});
    expect(document.title).toBe('Inicio · Turno'); expect(push).not.toHaveBeenCalled();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    expect(taskTitle()).toHaveValue('Tarea 1'); expect(push).toHaveBeenCalledTimes(1);
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'})); expect(push).toHaveBeenCalledTimes(2);
    act(() => session.store.getState().setFilter('pending')); expect(push).toHaveBeenCalledTimes(2);
    await user.clear(taskTitle()); await user.type(taskTitle(), 'Título actual');
    expect(document.title).toBe('Título actual · Turno');
  });

  it('UI-06 · cancelling a dirty selection preserves route and body without saving', async () => {
    const {session, user, nav} = await setup(1440, true); const save = vi.spyOn(session.port, 'saveTask');
    await user.type(body(), 'Borrador actual'); await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Volver'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    expect(body()).toHaveValue('Borrador actual'); expect(taskTitle()).toHaveValue('Tarea 1');
    expect(session.store.getState().dirty).toBe(true); expect(save).not.toHaveBeenCalled();
  });

  it('Home guard · Volver retains draft; explicit discard then clears selection and draft', async () => {
    const {session, user, nav} = await setup(1440, true);
    await user.type(body(), 'Conservar hasta decidir'); await user.click(nav.getByRole('button', {name: 'Inicio'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Volver'}));
    await waitFor(() => expect(body()).toHaveValue('Conservar hasta decidir'));
    await user.click(nav.getByRole('button', {name: 'Inicio'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(screen.getByRole('heading', {name: 'Hola, Demo.'})).toBeInTheDocument());
    expect(session.store.getState()).toMatchObject({selection: null, draft: null, dirty: false, view: 'home'});
    expect(document.title).toBe('Inicio · Turno');
  });

  it('Guardar y continuar · one successful current save precedes modal close and destination', async () => {
    const {session, user, nav} = await setup(1440, true); const save = vi.spyOn(session.port, 'saveTask');
    await user.type(body(), 'Guardar antes de salir'); await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(taskTitle()).toHaveValue('Revisar insumos'));
    expect(save).toHaveBeenCalledTimes(1);
    expect(session.store.getState().snapshot!.tasks[0]!.body).toBe('Guardar antes de salir');
    expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull();
  });

  it('invalid save-and-continue · closes without navigating and reveals the real invalid Time field', async () => {
    const {session, user, nav} = await setup(1440, true); const save = vi.spyOn(session.port, 'saveTask');
    await user.click(screen.getByRole('button', {name: /^Estimación/})); await user.type(screen.getByLabelText('Minutos estimados'), 'abc');
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(screen.getByLabelText('Minutos estimados')).toHaveFocus());
    expect(taskTitle()).toHaveValue('Tarea 1'); expect(session.store.getState().dirty).toBe(true);
    expect(screen.getByLabelText('Minutos estimados')).toHaveValue('abc'); expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull();
  });

  it('UI-19 · sidebar completion must ask before dirty draft and Volver restores the confirmed checkbox', async () => {
    const {session, user} = await setup(1440, true); const save = vi.spyOn(session.port, 'saveTask');
    await user.type(body(), 'Borrador protegido');
    await user.click(screen.getByRole('checkbox', {name: 'Completar Revisar insumos'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Volver'}));
    await waitFor(() => expect(screen.getByRole('checkbox', {name: 'Completar Revisar insumos'})).not.toBeChecked());
    expect(body()).toHaveValue('Borrador protegido'); expect(save).not.toHaveBeenCalled();
    expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'});
  });

  it('explicit drawer route · one click opens the requested task instead of being consumed as Back', async () => {
    const {user} = await setup(390);
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    await user.click(screen.getByRole('button', {name: 'Ir al turno actual'}));
    await waitFor(() => expect(taskTitle()).toHaveValue('Tarea 1'));
    expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull();
  });

  it('batched routes · TASK then HOME and duplicate TASK preserve the final intention and exact push count', async () => {
    const {user, nav, session} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    const push = vi.spyOn(window.history, 'pushState');
    const task = nav.getByRole('button', {name: 'Revisar insumos'}), home = nav.getByRole('button', {name: 'Inicio'});
    act(() => {fireEvent.click(task); fireEvent.click(home);});
    expect(session.store.getState()).toMatchObject({view: 'home', selection: null}); expect(push).toHaveBeenCalledTimes(2);
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); push.mockClear();
    const next = nav.getByRole('button', {name: 'Revisar insumos'});
    act(() => {fireEvent.click(next); fireEvent.click(next);});
    expect(taskTitle()).toHaveValue('Revisar insumos'); expect(push).toHaveBeenCalledTimes(1);
  });
});

describe('4A focus authority · independent review repros', () => {
  it('queued validation focus must not override a newer editor intention before delivery', async () => {
    const {user} = await setup(1440, true);
    await user.click(screen.getByRole('button', {name: /^Estimación/})); await user.type(screen.getByLabelText('Minutos estimados'), 'abc');
    const pending: VoidFunction[] = [];
    const queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {pending.push(callback);});
    await act(async () => {fireEvent.submit(document.getElementById('editor-form')!); await Promise.resolve();});
    expect(pending.length).toBeGreaterThan(0); queue.mockRestore();
    const input = body(); act(() => {input.focus(); fireEvent.change(input, {target: {value: 'Una edición más reciente'}});});
    expect(input).toHaveFocus(); act(() => {for (const callback of pending) callback();}); expect(input).toHaveFocus();
  });

  it('same-turn newer edit before validation delivery keeps its focus without mocking the queue', async () => {
    const {user} = await setup(1440, true);
    await user.click(screen.getByRole('button', {name: /^Estimación/})); await user.type(screen.getByLabelText('Minutos estimados'), 'abc');
    const input = body();
    await act(async () => {fireEvent.submit(document.getElementById('editor-form')!); input.focus(); fireEvent.change(input, {target: {value: 'Edición nueva en el mismo turno'}}); await Promise.resolve();});
    expect(input).toHaveFocus();
  });
});

// Controlled browser transport: real ProductApp/controller/guard, with traversal and
// popstate delivered separately. These are adversarial component interleavings, not native QA.
function controlledHistory() {
  const entries: unknown[] = [null], events: unknown[] = [], held: number[] = [];
  let index = 0, hold = false;
  const move = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= entries.length) return;
    index = next; events.push(entries[index]);
  };
  vi.spyOn(window.history, 'state', 'get').mockImplementation(() => entries[index]);
  const replace = vi.spyOn(window.history, 'replaceState').mockImplementation((data) => {entries[index] = structuredClone(data);});
  const push = vi.spyOn(window.history, 'pushState').mockImplementation((data) => {entries.splice(index + 1); entries.push(structuredClone(data)); index++;});
  const go = vi.spyOn(window.history, 'go').mockImplementation((delta = 0) => {if (hold) held.push(delta); else move(delta);});
  return {
    entries, push, replace, go, get index() {return index;},
    move,
    holdGo() {hold = true;},
    releaseGo() {hold = false; while (held.length) move(held.shift()!);},
    flush() {let count = 0; while (events.length) {if (++count > 30) throw new Error('history loop'); window.dispatchEvent(new PopStateEvent('popstate', {state: events.shift()}));}},
  };
}
async function historyAtMiddle() {
  const browser = controlledHistory(), context = await setup();
  await context.user.click(context.nav.getByRole('button', {name: 'Ir al turno actual'}));
  await context.user.click(context.nav.getByRole('button', {name: 'Revisar insumos'}));
  act(() => {browser.move(-1); browser.flush();});
  expect(taskTitle()).toHaveValue('Tarea 1'); expect(browser.index).toBe(1); expect(browser.entries).toHaveLength(3);
  return {...context, browser};
}

const replayFields = [
  {field: 'body', label: 'Notas de la tarea', value: 'Nueva edición después de aprobar'},
  {field: 'title', label: 'Título de tarea', value: 'Título posterior'},
  {field: 'reason', label: 'Motivo', value: 'Nuevo contexto'},
  {field: 'priority', label: 'Prioridad', value: 'high'},
  {field: 'completed', label: 'Tarea completada', value: ''},
  {field: 'date', label: 'Día / mes / año', value: '03/05/2026', property: /^Fecha/},
  {field: 'time', label: 'Hora local · 24 h', value: '12:34', property: /^Hora prevista/},
  {field: 'estimate', label: 'Minutos estimados', value: '009', property: /^Estimación/},
  {field: 'performed', label: 'Hora realizada · 24 h', value: '13:35', property: /^Realización/},
  {field: 'duration', label: 'Total manual de prueba · minutos', value: '010', property: /^Duración registrada/},
];

describe('4A product Back/Forward · controlled transport', () => {
  it.each([-1, 1])('cancel then discard preserves the original direction %i and Forward stack', async (direction) => {
    const {user, browser, session} = await historyAtMiddle();
    await user.type(body(), 'Borrador actual'); const pushes = browser.push.mock.calls.length;
    act(() => {browser.move(direction); browser.flush();});
    expect(browser.index).toBe(1); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'});
    await user.click(within(confirmation()).getByRole('button', {name: 'Volver'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    expect(body()).toHaveValue('Borrador actual'); expect(session.store.getState().dirty).toBe(true);
    act(() => {browser.move(direction); browser.flush();});
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(browser.go.mock.calls.length).toBeGreaterThan(2));
    act(() => browser.flush());
    expect(session.store.getState()).toMatchObject(direction === -1 ? {view: 'home', selection: null, dirty: false} : {selection: {kind: 'task', id: 'task-2'}, dirty: false});
    expect(browser.index).toBe(1 + direction); expect(browser.entries).toHaveLength(3); expect(browser.push).toHaveBeenCalledTimes(pushes);
  });

  it.each([-1, 1])('busy blocks traversal %i and preserves Forward without an extra confirmation', async (direction) => {
    const {user, browser, session} = await historyAtMiddle();
    let resolve!: () => Promise<void>;
    const original = session.port.saveTask.bind(session.port);
    vi.spyOn(session.port, 'saveTask').mockImplementationOnce((value) => new Promise((done) => {resolve = async () => done(await original(value));}));
    await user.type(body(), 'Guardando'); await user.click(screen.getByRole('button', {name: 'Guardar'}));
    expect(body()).toHaveAttribute('readonly'); expect(screen.getByLabelText('Prioridad')).toBeDisabled(); expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled();
    const lockedBody = (body() as HTMLTextAreaElement).value; await user.type(body(), 'ignored while busy'); expect(body()).toHaveValue(lockedBody);
    expect(taskTitle()).toHaveAttribute('readonly'); expect(screen.getByLabelText('Motivo')).toHaveAttribute('readonly');
    for (const id of ['date', 'time', 'estimate', 'performed', 'duration']) expect(document.getElementById(id)).toBeDisabled();
    act(() => {browser.move(direction); browser.flush();});
    expect(browser.index).toBe(1); expect(taskTitle()).toHaveValue('Tarea 1'); expect(browser.entries).toHaveLength(3); expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull();
    await act(async () => {await resolve();});
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    act(() => {browser.move(1); browser.flush();}); expect(taskTitle()).toHaveValue('Revisar insumos');
  });

  it.each(replayFields.flatMap((field) => [-1, 1].flatMap((direction) => ['save', 'discard'].flatMap((decision) => ['before-move', 'before-pop'].map((boundary) => ({...field, direction, decision, boundary}))))))('new $field edit revokes $decision replay $direction at $boundary', async ({field, label, value, property, direction, decision, boundary}) => {
    const {user, browser, session} = await historyAtMiddle();
    if (property) await user.click(screen.getByRole('button', {name: property}));
    act(() => {fireEvent.change(body(), {target: {value: 'Borrador aprobado'}});});
    act(() => {browser.move(direction); browser.flush();});
    if (boundary === 'before-move') browser.holdGo();
    const goCount = browser.go.mock.calls.length;
    await user.click(within(confirmation()).getByRole('button', {name: decision === 'save' ? 'Guardar y continuar' : 'Descartar cambios'}));
    await waitFor(() => expect(browser.go.mock.calls.length).toBeGreaterThan(goCount));
    expect(session.store.getState().busy).toBe(false); expect(taskTitle()).toHaveValue('Tarea 1');
    act(() => {const control = screen.getByLabelText(label); if (field === 'completed') fireEvent.click(control); else fireEvent.change(control, {target: {value}});});
    const draft = structuredClone(session.store.getState().draft), temporal = structuredClone(session.store.getState().temporal);
    act(() => {browser.releaseGo(); browser.flush();});
    expect(session.store.getState().draft).toEqual(draft); expect(session.store.getState().temporal).toEqual(temporal);
    expect(session.store.getState()).toMatchObject({selection: {kind: 'task', id: 'task-1'}, dirty: true});
    expect(browser.index).toBe(1); expect(browser.entries).toHaveLength(3); expect(browser.push).toHaveBeenCalledTimes(2);
  });
});

describe('4A guard integrations beyond row navigation', () => {
  it('failed save-and-continue closes without navigating, discarding or clearing the draft', async () => {
    const {user, nav, session} = await setup(1440, true);
    await user.type(body(), 'Conservar tras error'); session.port.failNext('error');
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    expect(body()).toHaveValue('Conservar tras error'); expect(taskTitle()).toHaveValue('Tarea 1');
    expect(session.store.getState().dirty).toBe(true); expect(session.store.getState().saveError).not.toBe('');
    expect(session.store.getState().snapshot!.tasks[0]!.body).toBe('');
  });

  it('note save-and-continue uses the explicit note result, not a task save', async () => {
    const {user, nav, session} = await setup();
    await user.click(nav.getByRole('button', {name: 'Notas rápidas'}));
    const noteSave = vi.spyOn(session.port, 'saveNote'), taskSave = vi.spyOn(session.port, 'saveTask');
    await user.type(screen.getByRole('textbox', {name: 'Texto de la nota'}), 'Nota por guardar');
    await user.click(nav.getByRole('button', {name: 'Inicio'}));
    await user.click(within(confirmation()).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(session.store.getState().view).toBe('home'));
    expect(noteSave).toHaveBeenCalledTimes(1); expect(taskSave).not.toHaveBeenCalled();
    expect(session.store.getState().snapshot!.notes[0]!.body).toBe('Nota por guardar');
  });

  it('sidebar checkbox inside drawer executes its guarded intention once without selecting its row', async () => {
    const {user, session} = await setup(390, true);
    await user.type(body(), 'Borrador antes del drawer');
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    await user.click(screen.getByRole('checkbox', {name: 'Completar Revisar insumos'}));
    await waitFor(() => expect(confirmation()).toBeInTheDocument());
    expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull();
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(session.store.getState().snapshot!.tasks[1]!.completed).toBe(true));
    expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'});
    expect(body()).toHaveValue('');
  });

  it('Agenda destination inside Time drawer waits for the guard and then selects the requested task', async () => {
    const {user, session} = await setup(390, true);
    await user.type(body(), 'Borrador desde Agenda');
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    await user.click(within(screen.getByRole('tabpanel', {name: 'Agenda'})).getByRole('button', {name: /Revisar insumos/}));
    await waitFor(() => expect(confirmation()).toBeInTheDocument());
    expect(screen.queryByRole('dialog', {name: 'Tiempo'})).toBeNull();
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(taskTitle()).toHaveValue('Revisar insumos'));
    expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-2'});
  });

  it('Back and Escape consume only the top drawer before a later Back asks about the draft', async () => {
    const {user, session, browser} = await historyAtMiddle();
    await user.type(body(), 'Draft debajo de capa');
    act(() => {window.innerWidth = 390; window.dispatchEvent(new Event('resize'));});
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    act(() => {browser.move(-1); browser.flush();});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull());
    expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull();
    expect(body()).toHaveValue('Draft debajo de capa'); expect(browser.index).toBe(1);
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'})); await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull());
    expect(session.store.getState().dirty).toBe(true); expect(browser.index).toBe(1);
    act(() => {browser.move(-1); browser.flush();}); expect(confirmation()).toBeInTheDocument();
  });

  it('beforeunload warns only while the real product draft is dirty', async () => {
    const {user} = await setup(1440, true);
    const clean = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
    await user.type(body(), 'Salir requiere aviso');
    const dirty = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('button', {name: 'Cancelar'}));
    const cancelled = new Event('beforeunload', {cancelable: true}); window.dispatchEvent(cancelled); expect(cancelled.defaultPrevented).toBe(false);
  });
});


describe('4A replay supersession and completion lock', () => {
  it.each([-1, 1])('opposite traversal supersedes an approved replay %i without stranding the next route', async (direction) => {
    const {user, browser, session, nav} = await historyAtMiddle();
    act(() => {fireEvent.change(body(), {target: {value: 'Descartar antes del replay'}}); browser.move(direction); browser.flush();});
    const calls = browser.go.mock.calls.length;
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(browser.go.mock.calls.length).toBeGreaterThan(calls));
    act(() => {browser.move(-direction); browser.flush();});
    expect(browser.index).toBe(1); expect(taskTitle()).toHaveValue('Tarea 1');
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-2'});
    expect(browser.index).toBe(2); expect(browser.entries).toHaveLength(3);
  });

  it.each([-1, 1])('HISTORY-07 · completion save blocks traversal %i and retains its Forward entry', async (direction) => {
    const {user, browser, session} = await historyAtMiddle();
    let resolve!: () => Promise<void>; const original = session.port.saveTask.bind(session.port);
    vi.spyOn(session.port, 'saveTask').mockImplementationOnce((value) => new Promise((done) => {resolve = async () => done(await original(value));}));
    await user.click(screen.getByRole('checkbox', {name: 'Completar Revisar insumos'}));
    expect(session.store.getState().busy).toBe(true); expect(body()).toHaveAttribute('readonly');
    act(() => {browser.move(direction); browser.flush();});
    expect(browser.index).toBe(1); expect(browser.entries).toHaveLength(3); expect(taskTitle()).toHaveValue('Tarea 1');
    await act(async () => {await resolve();}); await waitFor(() => expect(session.store.getState().busy).toBe(false));
    act(() => {browser.move(1); browser.flush();}); expect(taskTitle()).toHaveValue('Revisar insumos');
    expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeChecked();
  });
});


describe('4A independent T5 review regressions', () => {
  it.each(['Volver', 'Escape'])('cancelling with %s restores the visible origin', async (method) => {
    const {user, nav} = await setup(1440, true); await user.type(body(), 'Draft protegido');
    const origin = nav.getByRole('button', {name: 'Revisar insumos'}); await user.click(origin);
    if (method === 'Volver') await user.click(within(confirmation()).getByRole('button', {name: 'Volver'})); else await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    await waitFor(() => expect(origin).toHaveFocus());
  });

  it('approved completion queued at close-complete cannot execute after unmount', async () => {
    const session = createSession({random: () => 0}); sessions.push(session); await session.store.getState().load();
    session.store.getState().setView('workspace'); session.store.getState().select({kind: 'task', id: 'task-1'}); session.store.getState().setDraftField('body', 'Dirty draft');
    window.history.replaceState(null, ''); const save = vi.spyOn(session.port, 'saveTask');
    const hook = renderHook(() => useProductNavigation(session.store, {onInvalid() {}, onNewIntent() {}}), {wrapper: ({children}) => <OverlayProvider store={session.store}>{children}</OverlayProvider>});
    act(() => hook.result.current.requestCompletion('task-2', true)); act(() => hook.result.current.discard());
    const queued: VoidFunction[] = [], queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {queued.push(callback);});
    act(() => hook.result.current.dialogClosed()); queue.mockRestore(); expect(queued.length).toBeGreaterThan(0);
    hook.unmount(); await act(async () => {queued.forEach((callback) => callback()); await Promise.resolve();}); expect(save).not.toHaveBeenCalled();
  });

  it('explicit navigation is not stranded when the closing drawer docks in the same batch', async () => {
    const {user, session} = await setup(390); await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    const destination = screen.getByRole('button', {name: 'Ir al turno actual'});
    act(() => {destination.click(); window.innerWidth = 700; window.dispatchEvent(new Event('resize'));});
    await waitFor(() => expect(session.store.getState()).toMatchObject({view: 'workspace', selection: {kind: 'task', id: 'task-1'}})); expect(taskTitle()).toHaveValue('Tarea 1');
  });

  it('Agenda intention is not stranded when the closing Time drawer docks in the same batch', async () => {
    const {user, session} = await setup(999, true); await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'})); await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    const destination = within(screen.getByRole('tabpanel', {name: 'Agenda'})).getByRole('button', {name: /Revisar insumos/});
    act(() => {destination.click(); window.innerWidth = 1000; window.dispatchEvent(new Event('resize'));});
    await waitFor(() => expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-2'})); expect(taskTitle()).toHaveValue('Revisar insumos');
  });
});

describe('4A cancellation focus authority', () => {
  it('a second Back cancels the open confirmation and restores its origin without replay', async () => {
    const {user, browser, nav, session} = await historyAtMiddle(); await user.type(body(), 'Draft protegido');
    const origin = nav.getByRole('button', {name: 'Revisar insumos'}); await user.click(origin); expect(confirmation()).toBeInTheDocument();
    act(() => {browser.move(-1); browser.flush();});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    await waitFor(() => expect(origin).toHaveFocus()); expect(browser.index).toBe(1); expect(session.store.getState().dirty).toBe(true);
  });

  it('queued cancel return never steals a newer exterior focus intention', async () => {
    const {user, nav} = await setup(1440, true); await user.type(body(), 'Draft protegido');
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    const queued: VoidFunction[] = [], queue = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {queued.push(callback);});
    act(() => {fireEvent.click(within(confirmation()).getByRole('button', {name: 'Volver'}));}); queue.mockRestore();
    const search = screen.getByRole('searchbox', {name: 'Buscar tareas'}); act(() => search.focus());
    await act(async () => {for (const callback of queued) callback(); await Promise.resolve();}); expect(search).toHaveFocus();
  });
});

describe('4A guarded completion focus identity', () => {
  it('after discarding a draft, completion returns to its still-visible checkbox', async () => {
    const {user} = await setup(1440, true); await user.type(body(), 'Descartar antes de completar');
    const checkbox = screen.getByRole('checkbox', {name: 'Completar Revisar insumos'}); await user.click(checkbox);
    await user.click(within(confirmation()).getByRole('button', {name: 'Descartar cambios'}));
    await waitFor(() => expect(checkbox).toBeChecked()); await waitFor(() => expect(checkbox).toHaveFocus());
  });
});

describe('4A Escape routing before focus handoff', () => {
  it('a mounted top guard receives Escape even when the event still originates in a docked column', async () => {
    const {user, nav} = await setup(1440, true); await user.type(body(), 'Draft protegido');
    const origin = nav.getByRole('button', {name: 'Revisar insumos'}); await user.click(origin); expect(confirmation()).toBeInTheDocument();
    // Deliberately dispatch from the prior owner: a component interleaving, not a physical gesture claim.
    act(() => {fireEvent.keyDown(origin, {key: 'Escape', code: 'Escape'});});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Hay cambios sin guardar'})).toBeNull());
    expect(body()).toHaveValue('Draft protegido'); await waitFor(() => expect(origin).toHaveFocus());
  });
});
