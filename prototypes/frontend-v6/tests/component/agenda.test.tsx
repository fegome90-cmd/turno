import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks(); vi.useRealTimers();});
async function setup() {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  const random = vi.fn(() => 0);
  const session = createSession({random}); sessions.push(session); await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  return {session, random, user: userEvent.setup(), nav: within(screen.getByRole('navigation', {name: 'Principal'}))};
}
const agenda = () => within(screen.getByRole('tabpanel', {name: 'Agenda'}));

describe('4A Agenda · confirmed shift tasks and stable Home', () => {
  it('UI-41 · Home summary follows the real confirmed pending count without changing greeting', async () => {
    const {session, user, nav, random} = await setup();
    expect(screen.getByText('Turno de día · 4 pendientes')).toBeInTheDocument();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    await user.click(screen.getByRole('checkbox', {name: 'Tarea completada'})); await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().dirty).toBe(false));
    await user.click(nav.getByRole('button', {name: 'Inicio'}));
    expect(screen.getByText('Turno de día · 3 pendientes')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Hola, Demo.'})).toBeInTheDocument(); expect(random).toHaveBeenCalledTimes(1);
  });

  it('UI-25 · completed selected task and undated tasks remain in Agenda independently of pending navigation filter', async () => {
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    await user.click(screen.getByRole('checkbox', {name: 'Tarea completada'}));
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().dirty).toBe(false));
    await user.click(nav.getByRole('button', {name: 'Pendientes'}));
    expect(nav.queryByRole('button', {name: 'Tarea 1'})).toBeNull();
    await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    expect(agenda().getByRole('heading', {name: 'Sin fecha'})).toBeInTheDocument();
    expect(agenda().getByRole('button', {name: /Preparar educación/})).toBeInTheDocument();
    const completed = agenda().getByRole('button', {name: /Tarea 1.*Completada/});
    expect(completed).toHaveAttribute('aria-current', 'true'); expect(completed).toHaveClass('is-completed');
    expect(agenda().getByText('4 tareas · 3 pendientes')).toBeInTheDocument();
  });

  it('DESIGN-AUDIT-03/04 INTERFACE-SKILLS-25 · priority appears only after successful Save and disappears after lowering it', async () => {
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'high');
    await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    expect(agenda().getByRole('button', {name: /Tarea 1/})).not.toHaveAccessibleName(/Prioridad Alta/);
    session.port.failNext('error'); await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(agenda().getByRole('button', {name: /Tarea 1/})).not.toHaveAccessibleName(/Prioridad Alta/);
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(agenda().getByRole('button', {name: /Tarea 1/})).toHaveAccessibleName(/Prioridad Alta/));
    expect(agenda().getByRole('button', {name: /Tarea 1/}).querySelector('svg[aria-hidden=true]')).not.toBeNull();
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'low'); await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(agenda().getByRole('button', {name: /Tarea 1/})).not.toHaveAccessibleName(/Prioridad Alta/));
  });

  it('Agenda civil groups · date-only, Tomorrow and undated groups stay civil and task selection returns to the editor', async () => {
    vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(new Date('2026-11-07T12:00:00Z'));
    const {session, user, nav} = await setup();
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    session.store.getState().setTemporalField('date', '08/11/2026'); await session.store.getState().saveTask();
    await user.click(screen.getByRole('tab', {name: 'Agenda'}));
    expect(agenda().getByRole('heading', {name: 'Hoy'})).toBeInTheDocument();
    expect(agenda().getByRole('heading', {name: 'Mañana'})).toBeInTheDocument();
    expect(agenda().getByRole('heading', {name: 'Sin fecha'})).toBeInTheDocument();
    expect(agenda().getByText(/America\/Santiago/)).toBeInTheDocument();
    await user.click(agenda().getByRole('button', {name: /Preparar educación/}));
    expect(screen.getByRole('textbox', {name: 'Título de tarea'})).toHaveValue('Preparar educación');
    expect(session.store.getState().selection).toEqual({kind: 'task', id: 'task-3'});
  });

  it('UI-14/20/40 VIEWPORT-07 · opening Time on Home selects Agenda without replacing greeting or choosing another subtitle', async () => {
    const {user, random, nav} = await setup();
    const greeting = screen.getByRole('heading', {name: 'Hola, Demo.'});
    const subtitle = screen.getByText('¿Qué haremos hoy?');
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    expect(screen.getByRole('tab', {name: 'Agenda'})).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('main.home h1')).toBe(greeting);
    expect(screen.getByText('¿Qué haremos hoy?')).toBe(subtitle);
    expect(agenda().getByRole('button', {name: /Preparar educación/})).toBeInTheDocument();
    await user.click(screen.getByRole('tab', {name: 'Tarea'}));
    expect(screen.getByText('Selecciona una tarea')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Cerrar Tiempo'}));
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'})); await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    await user.click(nav.getByRole('button', {name: 'Inicio'}));
    expect(screen.getByRole('heading', {name: 'Hola, Demo.'})).toBeInTheDocument();
    expect(screen.getByText('¿Qué haremos hoy?')).toBeInTheDocument(); expect(random).toHaveBeenCalledTimes(1);
  });
});
