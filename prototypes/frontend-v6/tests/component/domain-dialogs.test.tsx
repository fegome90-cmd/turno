// 4B workflows exercise the real App/session/port. The frozen preparation
// baseline is preserved in Git. T2 connects creation/rename; close/archive
// remain explicit RED until T3, not skipped or counted as implemented.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(noActive = false, delay = 0) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay})}); sessions.push(session);
  await session.store.getState().load();
  if (noActive) {await session.port.closeShift('demo-shift-1'); await session.store.getState().load();}
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup(), nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  if (!noActive) await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
  return {session, user, nav};
}
const modal = (name: string) => screen.getByRole('dialog', {name});
const renameName = 'Editar nombre de lista'; // D7: the existing project uses Lista, not Cama.
const guardName = 'Hay cambios sin guardar';
const currentBody = () => screen.getByRole('textbox', {name: 'Notas de la tarea'});

function expectAssociatedError(field: HTMLElement, expected: RegExp) {
  const ids = [field.getAttribute('aria-describedby'), field.getAttribute('aria-errormessage')].filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  expect(ids.length).toBeGreaterThan(0);
  const error = ids.map((id) => document.getElementById(id)).find((node) => node && expected.test(node.textContent ?? '') && /escribe de 1 a 300 caracteres/i.test(node.textContent ?? ''));
  expect(error).toBeDefined(); expect(error!).toBeVisible();
}


describe('4B prepared RED · real domain workflows', () => {
  it('UI-09 INTERFACE-SKILLS-12 · create validates, preserves failure draft, retries and selects an editable task', async () => {
    const {session, user, nav} = await setup();
    const entry = nav.getByRole('button', {name: 'Agregar tarea a Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal('Agregar tarea'), field = within(dialog).getByRole('textbox', {name: 'Título de tarea nueva'}), create = within(dialog).getByRole('button', {name: 'Crear'});
    await user.type(field, '   '); fireEvent.submit(dialog.querySelector('form')!); await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true')); expect(field).toHaveValue('   '); expect(field).toHaveFocus(); expectAssociatedError(field, /Título/i); await user.clear(field);
    await user.type(field, 'Tarea literal <sin HTML>'); session.port.failNext('error'); await user.click(create);
    await waitFor(() => expect(create).toBeEnabled()); expect(dialog).toBeInTheDocument(); expect(field).toHaveValue('Tarea literal <sin HTML>'); expect(session.store.getState().snapshot!.tasks).toHaveLength(4);
    await user.click(create); await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar tarea'})).not.toBeInTheDocument());
    const task = session.store.getState().snapshot!.tasks.find((item) => item.title === 'Tarea literal <sin HTML>')!;
    expect(task).toMatchObject({bedId: 'bed-1', shiftId: 'demo-shift-1', completed: false}); expect(session.store.getState().selection).toEqual({kind: 'task', id: task.id});
    expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue(task.title); expect(currentBody()).not.toHaveAttribute('readonly');
  });

  it('4B create list · duplicate literal list names receive distinct IDs without changing existing task links', async () => {
    const {session, user, nav} = await setup(), before = structuredClone(session.store.getState().snapshot!.tasks);
    const entry = nav.getByRole('button', {name: 'Agregar lista'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal('Agregar lista'); await user.type(within(dialog).getByRole('textbox', {name: 'Nombre de lista'}), 'Lista 1'); await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(session.store.getState().snapshot!.beds).toHaveLength(3));
    const duplicate = session.store.getState().snapshot!.beds.filter((bed) => bed.label === 'Lista 1'); expect(duplicate).toHaveLength(2); expect(new Set(duplicate.map((bed) => bed.id)).size).toBe(2); expect(session.store.getState().snapshot!.tasks).toEqual(before);
  });

  it('UI-10 preparation · quick-note creation is independent of an open shift', async () => {
    const {session, user, nav} = await setup(true), entry = nav.getByRole('button', {name: 'Agregar nota rápida'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal('Nueva nota rápida'); await user.type(within(dialog).getByRole('textbox', {name: 'Título de nota nueva'}), 'Nota global literal'); await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(screen.getByRole('textbox', {name: 'Título de nota'})).toHaveValue('Nota global literal'));
    const note = session.store.getState().snapshot!.notes.find((item) => item.title === 'Nota global literal')!; expect(note).not.toHaveProperty('shiftId'); expect(note).not.toHaveProperty('bedId'); expect(session.store.getState().snapshot!.activeShiftId).toBeNull();
  });

  it('UI-10/29/42 · no active shift offers Start and a new shift has no new tasks or lists while global notes survive', async () => {
    const {session, user, nav} = await setup(true), notes = structuredClone(session.store.getState().snapshot!.notes);
    const entry = nav.getByRole('button', {name: 'Iniciar turno'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal('Iniciar turno'); await user.type(within(dialog).getByRole('textbox', {name: 'Nombre del turno'}), 'Turno personal'); await user.click(within(dialog).getByRole('button', {name: 'Iniciar'}));
    await waitFor(() => expect(session.store.getState().snapshot!.activeShiftId).not.toBeNull()); const snapshot = session.store.getState().snapshot!, id = snapshot.activeShiftId!;
    expect(id).not.toBe('demo-shift-1'); expect(snapshot.tasks.filter((task) => task.shiftId === id)).toEqual([]); expect(snapshot.beds.filter((bed) => bed.shiftId === id)).toEqual([]); expect(snapshot.notes).toEqual(notes);
    await user.click(screen.getByRole('tab', {name: 'Agenda'})); expect(screen.getByRole('tabpanel', {name: 'Agenda'})).toHaveTextContent('aunque no tenga fecha');
  });

  it('UI-31/33/34 INTERFACE-SKILLS-11 EMIL-SKILLS-09 · rename invalid and failed values stay correctible, then update the same list everywhere', async () => {
    const {session, user, nav} = await setup(), tasks = structuredClone(session.store.getState().snapshot!.tasks), entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal(renameName), field = within(dialog).getByRole('textbox', {name: 'Nombre de la lista'}), submit = within(dialog).getByRole('button', {name: 'Guardar nombre'}); expect(field).toHaveValue('Lista 1'); expect(field).toHaveFocus();
    await user.clear(field); await user.type(field, '   '); fireEvent.submit(dialog.querySelector('form')!); await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true')); expect(field).toHaveValue('   '); expect(field).toHaveFocus(); expectAssociatedError(field, /Nombre de la lista/i);
    const literal = 'Lista <noche> · 夜班 · '.repeat(14).trim(); fireEvent.change(field, {target: {value: literal}}); session.port.failNext('error'); await user.click(submit); await waitFor(() => expect(submit).toBeEnabled()); expect(field).toHaveValue(literal); expect(dialog).toBeInTheDocument(); expect(session.store.getState().snapshot!.beds[0]!.label).toBe('Lista 1');
    await user.click(submit); await waitFor(() => expect(screen.queryByRole('dialog', {name: renameName})).not.toBeInTheDocument());
    expect(session.store.getState().snapshot!.beds.find((bed) => bed.id === 'bed-1')).toMatchObject({id: 'bed-1', shiftId: 'demo-shift-1', label: literal}); expect(session.store.getState().snapshot!.tasks).toEqual(tasks); expect(document.querySelector('.metadata-context')).toHaveTextContent(literal); expect(nav.getByRole('button', {name: `Editar nombre de ${literal}`})).toBeEnabled();
    await user.click(screen.getByRole('tab', {name: 'Agenda'})); expect(within(screen.getByRole('tabpanel', {name: 'Agenda'})).getAllByText(literal).length).toBeGreaterThan(0);
  });

  it('UI-32 · Cancel and unchanged rename preserve selection, graph and the next failure fixture', async () => {
    const {session, user, nav} = await setup(), before = structuredClone(session.store.getState().snapshot), selected = session.store.getState().selection;
    const entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry);
    let dialog = modal(renameName); await user.type(within(dialog).getByRole('textbox', {name: 'Nombre de la lista'}), ' sin confirmar'); await user.click(within(dialog).getByRole('button', {name: 'Cancelar'})); expect(session.store.getState().snapshot).toEqual(before); expect(session.store.getState().selection).toEqual(selected);
    const rename = vi.spyOn(session.port, 'renameBed'); session.port.failNext('error'); await user.click(entry); dialog = modal(renameName); const unchanged = within(dialog).getByRole('textbox', {name: 'Nombre de la lista'}); await user.clear(unchanged); await user.type(unchanged, ' Lista 1 '); await user.click(within(dialog).getByRole('button', {name: 'Guardar nombre'})); await waitFor(() => expect(screen.queryByRole('dialog', {name: renameName})).not.toBeInTheDocument()); expect(rename).not.toHaveBeenCalled(); await expect(session.port.createNote('Failure fixture probe')).rejects.toThrow(/Fallo simulado/);
  });

  it('UI-35 · dirty rename Volver preserves the editor, explicit discard opens rename on the same task', async () => {
    const {session, user, nav} = await setup(), editor = currentBody(); await user.type(editor, 'Borrador protegido'); await user.click(screen.getByRole('button', {name: /^Fecha/})); const raw = screen.getByLabelText('Día / mes / año'); await user.clear(raw); await user.type(raw, '31/02/2026');
    const entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry);
    await user.click(within(modal(guardName)).getByRole('button', {name: 'Volver'})); await waitFor(() => expect(screen.queryByRole('dialog', {name: guardName})).not.toBeInTheDocument()); expect(editor).toHaveValue('Borrador protegido'); expect(raw).toHaveValue('31/02/2026'); expect(session.store.getState().dirty).toBe(true);
    await user.click(entry); await user.click(within(modal(guardName)).getByRole('button', {name: 'Descartar cambios'})); await waitFor(() => expect(modal(renameName)).toBeInTheDocument()); expect(editor).toHaveValue(''); expect(raw).toHaveValue('07/11/2026'); expect(session.store.getState().dirty).toBe(false); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-1'});
  });

  it('UI-38 INTERFACE-SKILLS-13 · invalid Save and continue never opens rename or consumes a later independent intention', async () => {
    const {session, user, nav} = await setup(); await user.click(screen.getByRole('button', {name: /^Estimación/})); const raw = screen.getByLabelText('Minutos estimados'); await user.type(raw, 'abc');
    const entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry); await user.click(within(modal(guardName)).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: guardName})).not.toBeInTheDocument()); expect(screen.queryByRole('dialog', {name: renameName})).not.toBeInTheDocument(); expect(raw).toHaveValue('abc'); expect(raw).toHaveAttribute('aria-invalid', 'true'); expect(raw).toHaveFocus();
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'})); expect(modal(guardName)).toBeInTheDocument(); await user.click(within(modal(guardName)).getByRole('button', {name: 'Descartar cambios'})); await waitFor(() => expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Revisar insumos')); expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-2'}); expect(screen.queryByRole('dialog', {name: renameName})).not.toBeInTheDocument();
  });

  it('UI-39 · successful Save and continue confirms the task before opening rename', async () => {
    const {session, user, nav} = await setup(); await user.type(currentBody(), 'Guardado antes de renombrar'); const save = vi.spyOn(session.port, 'saveTask');
    const entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry); await user.click(within(modal(guardName)).getByRole('button', {name: 'Guardar y continuar'}));
    await waitFor(() => expect(modal(renameName)).toBeInTheDocument()); expect(save).toHaveBeenCalledTimes(1); expect(session.store.getState().snapshot!.tasks.find((task) => task.id === 'task-1')!.body).toBe('Guardado antes de renombrar'); expect(session.store.getState().dirty).toBe(false);
  });

  it('EMIL-SKILLS-06 INTERFACE-SKILLS-06 UI-10 · close conflict retries in the same dialog and preserves archived pending tasks', async () => {
    const {session, user} = await setup(), before = structuredClone(session.store.getState().snapshot!);
    const entry = screen.getByRole('button', {name: 'Cerrar turno'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal('Cerrar turno'), confirm = within(dialog).getByRole('button', {name: 'Cerrar y archivar'}); expect(dialog).toHaveTextContent('4 tareas pendientes'); session.port.failNext('conflict'); await user.click(confirm);
    await waitFor(() => expect(confirm).toBeEnabled()); expect(dialog).toBeInTheDocument(); const error = within(dialog).getByRole('alert'); expect(error).toHaveTextContent(/turno sigue abierto/i); expect(error).toHaveTextContent('Cerrar y archivar'); expect(error).not.toHaveTextContent(/guardar|borrador/i); expect(session.store.getState().snapshot!.activeShiftId).toBe('demo-shift-1'); expect(session.store.getState().snapshot!.tasks).toEqual(before.tasks);
    await user.click(confirm); await waitFor(() => expect(session.store.getState().snapshot!.activeShiftId).toBeNull()); expect(session.store.getState().snapshot!.tasks).toEqual(before.tasks); expect(session.store.getState().snapshot!.shifts[0]!.status).toBe('closed'); expect(session.store.getState().snapshot!.notes).toEqual(before.notes);
  });

  it('DESIGN-AUDIT-08 UI-37 · archive disables both completion paths and exposes no rename control', async () => {
    const {session, user, nav} = await setup(true), before = structuredClone(session.store.getState().snapshot!), entry = nav.getByRole('button', {name: 'Archivo de turnos anteriores'}); expect(entry).toBeEnabled(); await user.click(entry);
    expect(screen.getByRole('heading', {name: 'Turnos anteriores'})).toBeInTheDocument(); await user.click(screen.getByRole('button', {name: /^Turno de día ·/})); await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveAttribute('readonly'); expect(currentBody()).toHaveAttribute('readonly'); expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled(); expect(nav.getByRole('checkbox', {name: 'Completar Tarea 1'})).toBeDisabled();
    expect(screen.getByRole('navigation', {name: 'Principal'}).querySelectorAll('button[aria-label^="Editar nombre de "]')).toHaveLength(0); expect(session.store.getState().snapshot).toEqual(before);
  });

  it('UI-34 · pending rename locks its field and rapid repeated submit persists exactly once', async () => {
    const {session, user, nav} = await setup(), entry = nav.getByRole('button', {name: 'Editar nombre de Lista 1'}); expect(entry).toBeEnabled(); await user.click(entry);
    const dialog = modal(renameName), field = within(dialog).getByRole('textbox', {name: 'Nombre de la lista'}), submit = within(dialog).getByRole('button', {name: 'Guardar nombre'});
    await user.clear(field); await user.type(field, 'Nombre confirmado una vez');
    let release!: () => void; const pending = new Promise<void>((resolve) => {release = resolve;}); const actual = session.port.renameBed.bind(session.port);
    const rename = vi.spyOn(session.port, 'renameBed').mockImplementation(async (...args) => {await pending; return actual(...args);});
    await user.dblClick(submit); expect(rename).toHaveBeenCalledTimes(1); expect(field).toHaveAttribute('readonly'); expect(submit).toBeDisabled(); expect(within(dialog).getByRole('button', {name: 'Cancelar'})).toBeDisabled();
    await act(async () => {release();}); await waitFor(() => expect(session.store.getState().snapshot!.beds.find((bed) => bed.id === 'bed-1')!.label).toBe('Nombre confirmado una vez')); expect(rename).toHaveBeenCalledWith('bed-1', 'Nombre confirmado una vez');
  });
});
