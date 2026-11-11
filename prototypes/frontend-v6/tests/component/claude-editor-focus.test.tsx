// JSDOM does not blur a newly disabled button. The store subscriber below
// delivers that browser boundary observed on native Chromium349 (H2), without
// substituting product navigation, persistence, editor state or focus targets.
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(note = false) {
  Object.defineProperty(window, 'innerWidth', {value: 1440, configurable: true, writable: true});
  window.history.replaceState(null, '');
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0})}); sessions.push(session);
  await session.store.getState().load();
  const view = render(<AppProviders><App session={session}/></AppProviders>), user = userEvent.setup();
  await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: note ? 'Notas rápidas' : 'Ir al turno actual'}));
  const field = screen.getByRole('textbox', {name: note ? 'Texto de la nota' : 'Notas de la tarea'});
  const before = (field as HTMLTextAreaElement).value;
  await user.type(field, ' Cambio de prueba');
  return {...view, user, session, field, before};
}
function blurDisabledButton(session: ReturnType<typeof createSession>) {
  return session.store.subscribe((state) => {
    if (!state.busy && state.dirty) return;
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.closest('.save-actions')) active.blur();
  });
}
describe('Claude H2 · editor action focus at the native disabled-button boundary', () => {
  for (const note of [false, true]) for (const action of ['Guardar', 'Cancelar'] as const) {
    it(`${note ? 'note' : 'task'} ${action} returns keyboard entry to writing without changing the textarea node`, async () => {
      const {session, user, field, before} = await setup(note), stop = blurDisabledButton(session);
      try {
        await user.click(screen.getByRole('button', {name: action}));
        await waitFor(() => expect(session.store.getState().dirty).toBe(false));
        await waitFor(() => expect(field).toHaveFocus());
        expect(screen.getByRole('textbox', {name: note ? 'Texto de la nota' : 'Notas de la tarea'})).toBe(field);
        expect(field).toHaveValue(action === 'Guardar' ? before + ' Cambio de prueba' : before);
      } finally {stop();}
    });
  }
  it('a newer external focus during a held save is not stolen', async () => {
    const {session, user} = await setup(), stop = blurDisabledButton(session);
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;});
    const actual = session.port.saveTask.bind(session.port);
    vi.spyOn(session.port, 'saveTask').mockImplementation(async (...args) => {await held; return actual(...args);});
    try {
      await user.click(screen.getByRole('button', {name: 'Guardar'}));
      const search = screen.getByRole('searchbox', {name: 'Buscar tareas'}); search.focus();
      await act(async () => {release();}); await waitFor(() => expect(session.store.getState().busy).toBe(false));
      expect(search).toHaveFocus();
    } finally {stop();}
  });
  it('a newer revision during held save retains its raw body and receives no old action focus', async () => {
    const {session, user, field} = await setup(), stop = blurDisabledButton(session);
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;});
    const actual = session.port.saveTask.bind(session.port);
    vi.spyOn(session.port, 'saveTask').mockImplementation(async (...args) => {await held; return actual(...args);});
    try {
      await user.click(screen.getByRole('button', {name: 'Guardar'}));
      const focus = vi.spyOn(field, 'focus');
      act(() => session.store.getState().setDraftField('body', 'Edición posterior intacta'));
      await act(async () => {release();}); await waitFor(() => expect(session.store.getState().busy).toBe(false));
      expect(field).toHaveValue('Edición posterior intacta'); expect(focus).not.toHaveBeenCalled();
    } finally {stop();}
  });
  it('unmount during held save cannot focus the disconnected textarea', async () => {
    const {session, user, field, unmount} = await setup(), stop = blurDisabledButton(session);
    let release!: () => void; const held = new Promise<void>((resolve) => {release = resolve;});
    const actual = session.port.saveTask.bind(session.port);
    vi.spyOn(session.port, 'saveTask').mockImplementation(async (...args) => {await held; return actual(...args);});
    try {
      await user.click(screen.getByRole('button', {name: 'Guardar'}));
      const focus = vi.spyOn(field, 'focus'); unmount();
      await act(async () => {release();}); await waitFor(() => expect(session.store.getState().busy).toBe(false));
      expect(field.isConnected).toBe(false); expect(focus).not.toHaveBeenCalled();
    } finally {stop();}
  });
  it('a newer focus after Cancel takes precedence over its queued return', async () => {
    const {session, field} = await setup(), stop = blurDisabledButton(session);
    const cancel = screen.getByRole('button', {name: 'Cancelar'});
    const search = screen.getByRole('searchbox', {name: 'Buscar tareas'});
    try {
      act(() => {cancel.focus(); fireEvent.click(cancel); search.focus();});
      await act(async () => {await Promise.resolve();});
      expect(search).toHaveFocus(); expect(field).not.toHaveFocus();
    } finally {stop();}
  });
  it('Enter from a focused title keeps that field instead of redirecting to the body', async () => {
    const {session, user} = await setup(), stop = blurDisabledButton(session);
    try {
      const title = screen.getByRole('textbox', {name: 'Título de tarea'});
      await user.click(title); await user.keyboard('{Enter}');
      await waitFor(() => expect(session.store.getState().dirty).toBe(false)); expect(title).toHaveFocus();
    } finally {stop();}
  });
});
