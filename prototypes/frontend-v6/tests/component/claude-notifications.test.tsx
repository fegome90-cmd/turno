import {readFileSync} from 'node:fs';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import {createNotificationStore} from '../../src/notifications/notification-store';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup({load = true, width = 1440} = {}) {
  Object.defineProperty(window, 'innerWidth', {value: width, configurable: true, writable: true});
  window.history.replaceState(null, '');
  const notifications = createNotificationStore();
  const session = createSession({random: () => 0, notifications, port: createPreviewAdapter({delay: 0})});
  sessions.push(session);
  if (load) await session.store.getState().load();
  return {session, notifications, user: userEvent.setup()};
}
const show = (session: ReturnType<typeof createSession>) => render(<AppProviders><App session={session}/></AppProviders>);

describe('Claude F1 · product errors are visible using the session notification owner', () => {
  it.each([false, true])('a failed completion from confirmed completed=%s reports an error and retains the confirmed checkbox', async (completed) => {
    const {session, user} = await setup();
    if (completed) await session.store.getState().setCompleted('task-1', true);
    show(session);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: 'Ir al turno actual'}));
    const check = screen.getByRole('checkbox', {name: `${completed ? 'Reabrir' : 'Completar'} Tarea 1`});
    session.port.failNext('error');
    await user.click(check);
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(check).toHaveProperty('checked', completed);
    expect(session.store.getState().snapshot!.tasks.find((task) => task.id === 'task-1')!.completed).toBe(completed);
    const notices = screen.getByRole('region', {name: 'Avisos'});
    expect(within(notices).getByText(/Fallo simulado/)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/Fallo simulado/);
    await user.click(check);
    await waitFor(() => expect(check).toHaveProperty('checked', !completed));
  });

  it('shows an initial load error emitted before the product mounts', async () => {
    const {session} = await setup({load: false});
    session.port.failNext('error');
    await session.store.getState().load();
    expect(session.store.getState().snapshot).toBeNull();
    show(session);
    expect(within(screen.getByRole('region', {name: 'Avisos'})).getByText(/Fallo simulado/)).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(/Fallo simulado/);
  });

  it('defers errors while a domain modal is open and restores the same notice when it closes', async () => {
    const {session, user, notifications} = await setup();
    show(session);
    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(screen.getByRole('button', {name: 'Agregar lista'}));
    const dialog = screen.getByRole('dialog', {name: 'Agregar lista'});
    act(() => {notifications.notify('Error pendiente de anunciar', 'error');});
    const region = document.querySelector<HTMLElement>('[data-notification-root]')!;
    expect(region).not.toBeVisible();
    expect(region).toHaveAttribute('inert');
    expect(document.getElementById('live-error')).not.toHaveTextContent('Error pendiente de anunciar');
    await user.click(within(dialog).getByRole('button', {name: 'Cancelar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Agregar lista'})).not.toBeInTheDocument());
    await waitFor(() => expect(region).toBeVisible());
    expect(screen.getByRole('alert')).toHaveTextContent('Error pendiente de anunciar');
    expect(notifications.getState().items).toHaveLength(1);
  });

  it('preserves notice wrapping and passes background pointers while keeping dismissal interactive', async () => {
    const {session, notifications} = await setup();
    const style = document.createElement('style');
    style.textContent = readFileSync('src/notifications/notifications.css', 'utf8');
    document.head.append(style);
    try {
      show(session); act(() => {notifications.notify('Error' + 'Largo'.repeat(60), 'error');});
      const message = screen.getByRole('region', {name: 'Avisos'}).querySelector('[data-notice-message]')!;
      expect(getComputedStyle(message).overflowWrap).toBe('break-word');
      expect(getComputedStyle(screen.getByRole('region', {name: 'Avisos'})).pointerEvents).toBe('none');
      expect(getComputedStyle(screen.getByRole('button', {name: 'Cerrar aviso'})).pointerEvents).toBe('auto');
    } finally {style.remove();}
  });

  it('dismisses the last notice by keyboard to main, without a disconnected focus target', async () => {
    const {session, notifications, user} = await setup();
    show(session);
    act(() => {notifications.notify('Fallo visible', 'error');});
    await user.keyboard('{Alt>}t{/Alt}');
    expect(screen.getByRole('button', {name: 'Cerrar aviso'})).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(notifications.getState().items).toHaveLength(0);
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
