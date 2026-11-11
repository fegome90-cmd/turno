// Real App + store + port. A missing panel, eager error cleanup, raw coercion or
// a duplicated temporal input must fail, independently of the technical harness.
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});
async function setup(width = 1440) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: width});
  const session = createSession({random: () => 0}); sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup();
  if (width < 700) await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
  const nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
  if (width < 700) await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
  await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
  return {session, user};
}
async function property(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', {name: new RegExp(`^${label}(?: ·|$)`)}));
}

describe('4A TimePanel · submitted errors and one raw draft', () => {
  it('EMIL-SKILLS-01/02/03 · errors survive unrelated edits and resolve only when their constraints resolve', async () => {
    const {user} = await setup();
    await property(user, 'Fecha'); await property(user, 'Hora prevista'); await property(user, 'Estimación');
    const date = screen.getByLabelText('Día / mes / año');
    const time = screen.getByLabelText('Hora local · 24 h');
    const estimate = screen.getByLabelText('Minutos estimados');
    await user.clear(date); await user.type(time, '09:30'); await user.type(estimate, 'abc');
    expect(estimate).not.toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    expect(date).toHaveAttribute('aria-invalid', 'true'); expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await user.type(screen.getByRole('textbox', {name: 'Notas de la tarea'}), 'Mantener errores');
    expect(date).toHaveAttribute('aria-invalid', 'true'); expect(estimate).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(estimate, {target: {value: '-1'}}); expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await user.clear(time); expect(date).not.toHaveAttribute('aria-invalid', 'true');
    expect(estimate).toHaveAttribute('aria-invalid', 'true');
    await user.clear(estimate); await user.type(estimate, '0'); expect(estimate).not.toHaveAttribute('aria-invalid', 'true');
  });

  it.each(['abc', '-1', '1.5', '1441', '', '0'])('UI-21 · raw minutes %j survive blur, tabs and closing/reopening property', async (raw) => {
    const {user} = await setup(); await property(user, 'Estimación');
    const input = screen.getByLabelText('Minutos estimados');
    if (raw) await user.type(input, raw);
    await user.tab();
    await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    await user.click(screen.getByRole('tab', {name: 'Tarea'}));
    expect(screen.getByLabelText('Minutos estimados')).toBe(input);
    expect(input).toHaveValue(raw);
    await property(user, 'Estimación'); await property(user, 'Estimación');
    expect(input).toHaveValue(raw); expect(document.querySelectorAll('#estimate')).toHaveLength(1);
  });

  it('UI-03/11 EMIL-SKILLS-05 · mobile drawer keeps one input and raw error after dismiss and body edit', async () => {
    const {session, user} = await setup(390);
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    await property(user, 'Estimación');
    const input = screen.getByLabelText('Minutos estimados'); await user.type(input, 'abc');
    // Domain validation is submitted from the form after dismissing the drawer.
    await user.click(screen.getByRole('button', {name: /Cerrar tiempo/i}));
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(screen.getByRole('dialog', {name: 'Tiempo'})).toBeVisible());
    expect(input).toHaveAttribute('aria-invalid', 'true'); expect(input).toHaveValue('abc');
    expect(document.querySelectorAll('#estimate')).toHaveLength(1);
    await user.click(screen.getByRole('button', {name: /Cerrar tiempo/i}));
    await user.type(screen.getByRole('textbox', {name: 'Notas de la tarea'}), 'Edición ajena');
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    expect(input).toHaveValue('abc'); expect(session.store.getState().errors.estimate).toBeTruthy();
  });

  it('INTERFACE-SKILLS-02/03 · validation reveals a hidden temporal field and closing Time returns visible focus', async () => {
    const {session, user} = await setup();
    await property(user, 'Estimación'); await user.type(screen.getByLabelText('Minutos estimados'), '1441');
    await user.click(screen.getByRole('button', {name: 'Cerrar Tiempo'}));
    expect(session.store.getState().inspectorHidden).toBe(true);
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(screen.getByLabelText('Minutos estimados')).toHaveFocus());
    expect(session.store.getState().inspectorHidden).toBe(false);
    await user.click(screen.getByRole('button', {name: 'Cerrar Tiempo'}));
    expect(screen.getByRole('button', {name: 'Mostrar Tiempo'})).toHaveFocus();
  });

  it('UI-11 · raw zero is saved after the mobile drawer is dismissed and remains distinct from empty', async () => {
    const {session, user} = await setup(390);
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    await property(user, 'Estimación'); await user.type(screen.getByLabelText('Minutos estimados'), '0');
    await user.click(screen.getByRole('button', {name: 'Cerrar Tiempo'}));
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().dirty).toBe(false));
    expect(session.store.getState().snapshot!.tasks[0]!.estimate).toBe('0');
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    expect(screen.getByLabelText('Minutos estimados')).toHaveValue('0');
  });

  it('tabs and Collapsible · keyboard wraps, panel associations hold and closing moves focus out of hidden content', async () => {
    const {user, session} = await setup();
    const task = screen.getByRole('tab', {name: 'Tarea'});
    const agenda = screen.getByRole('tab', {name: 'Agenda'});
    task.focus(); await user.keyboard('{ArrowLeft}');
    expect(agenda).toHaveFocus(); expect(agenda).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}'); expect(task).toHaveFocus();
    await user.keyboard('{End}'); expect(agenda).toHaveFocus();
    await user.click(task); await property(user, 'Estimación');
    const input = screen.getByLabelText('Minutos estimados'); input.focus();
    const trigger = screen.getByRole('button', {name: /^Estimación ·/});
    const panelId = trigger.getAttribute('aria-controls');
    expect(document.getElementById(panelId!)).toContainElement(input);
    act(() => session.store.getState().setPropertyExpanded('estimate', false));
    expect(input.closest('.property-content')).toHaveAttribute('inert');
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(panelId!)).toHaveAttribute('inert');
    expect(document.getElementById(task.getAttribute('aria-controls')!)).toHaveAttribute('aria-labelledby', task.id);
  });
});
