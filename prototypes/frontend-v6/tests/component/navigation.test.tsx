import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import fs from 'node:fs';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {resolveReturnFocus} from '../../src/components/OverlayCoordinator';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => { sessions.splice(0).forEach((s) => s.dispose()); vi.restoreAllMocks(); });
async function setup(width = 1440) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, value: width, writable: true});
  const session = createSession({random: () => 0}); sessions.push(session);
  await session.store.getState().load();
  const result = render(<AppProviders><App session={session} /></AppProviders>);
  return {...result, session, user: userEvent.setup()};
}

describe('3A · navegación real sobre store/puerto', () => {
  it('TOKENS-02 · marca accesible, Home estable y un único main', async () => {
    const ctx = await setup();
    expect(screen.getByRole('button', {name: 'Turno · Inicio'})).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('heading', {name: 'Hola, Demo.'})).toBeInTheDocument();
    const subtitle = screen.getByText('¿Qué haremos hoy?');
    await ctx.user.click(screen.getByRole('button', {name: 'Más opciones'}));
    await ctx.user.selectOptions(screen.getByLabelText('Apariencia'), 'dark');
    expect(screen.getByText('¿Qué haremos hoy?')).toBe(subtitle);
  });

  it('DESIGN-AUDIT-02 · checkbox label nativo no activa botón de fila y UI-18 usa fallo real', async () => {
    const {session, user} = await setup();
    await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Revisar insumos'}));
    const selectionBefore = structuredClone(session.store.getState().selection);
    expect(selectionBefore).toEqual({kind: 'task', id: 'task-2'});
    const check = screen.getByRole('checkbox', {name: 'Completar Tarea 1'});
    const label = check.closest('label');
    expect(label).not.toBeNull();
    expect(label!.querySelectorAll('input,button')).toHaveLength(1);
    const spy = vi.spyOn(session.port, 'saveTask');
    session.port.failNext('error');
    await user.click(check);
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(check).not.toBeChecked();
    expect(session.store.getState().selection).toEqual(selectionBefore);
    await user.click(check);
    await waitFor(() => expect(check).toBeChecked());
    expect(session.store.getState().selection).toEqual(selectionBefore);
  });

  it('DESIGN-COMPLETE-03/04/05 · disclosure no modal con controles, Escape y click destino conectado', async () => {
    const {user} = await setup();
    await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Ir al turno actual'}));
    const more = screen.getByRole('button', {name: 'Más opciones'});
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Apariencia')).toBeNull();
    await user.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const select = screen.getByLabelText('Apariencia');
    expect(select.closest('[aria-modal="true"]')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText('Datos sintéticos · Se reinician al recargar')).toBeInTheDocument();
    await user.click(select);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(more).toHaveAttribute('aria-expanded', 'false'));
    expect(more).toHaveFocus();
    await user.click(more);
    const target = screen.getByRole('button', {name: 'Lista 2'});
    fireEvent.focusIn(target);
    expect(target.isConnected).toBe(true);
    await user.click(target);
    expect(target).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('Inicio omite contexto y limpia selección y draft después de una navegación autorizada', async () => {
    const {session, user} = await setup();
    const nav = within(screen.getByRole('navigation', {name: 'Principal'}));
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(nav.getByRole('button', {name: 'Tarea 1'}));
    await user.click(nav.getByRole('button', {name: 'Inicio'}));
    expect(document.querySelector('.toolbar-title')).toHaveTextContent(/^$/);
    expect(session.store.getState()).toMatchObject({selection: null, draft: null, dirty: false, view: 'home'});
  });

  it('INTERFACE-SKILLS-17 · Demo solo dentro de Más opciones, arma fallo del puerto real', async () => {
    const {session, user} = await setup();
    expect(screen.queryByRole('button', {name: 'Demo local: datos sintéticos'})).toBeNull();
    await user.click(screen.getByRole('button', {name: 'Más opciones'}));
    await user.click(screen.getByRole('button', {name: 'Demo local: datos sintéticos'}));
    const dialog = screen.getByRole('dialog', {name: 'Demostración local'});
    const fail = vi.spyOn(session.port, 'failNext');
    await user.click(within(dialog).getByRole('button', {name: 'Simular fallo'}));
    expect(fail).toHaveBeenCalledExactlyOnceWith('error');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Demostración local'})).toBeNull());
  });

  it('Demo desde navegación móvil reemplaza drawer y regresa al trigger visible', async () => {
    const {session, user} = await setup(390);
    const trigger = screen.getByRole('button', {name: 'Abrir navegación'});
    await user.click(trigger);
    await user.click(screen.getByRole('button', {name: 'Más opciones'}));
    await user.click(screen.getByRole('button', {name: 'Demo local: datos sintéticos'}));
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).not.toContain('navigation');
    expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull();
    const demo = screen.getByRole('dialog', {name: 'Demostración local'});
    await user.click(within(demo).getByRole('button', {name: 'Cerrar'}));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('INTERFACE-SKILLS-18 · scroll cue solo si queda contenido inferior', async () => {
    await setup();
    const scroll = screen.getByTestId('nav-scroll');
    Object.defineProperties(scroll, {scrollHeight: {value: 500, configurable: true}, clientHeight: {value: 200, configurable: true}, scrollTop: {value: 0, writable: true, configurable: true}});
    fireEvent.scroll(scroll);
    expect(scroll).toHaveClass('has-more');
    scroll.scrollTop = 300; fireEvent.scroll(scroll);
    expect(scroll).not.toHaveClass('has-more');
  });

  it('UI-12 · Escape cierra navegación móvil, sin cerrar capa inferior al salir de Más opciones', async () => {
    const {user} = await setup(390);
    const trigger = screen.getByRole('button', {name: 'Abrir navegación'});
    await user.click(trigger);
    expect(screen.getByRole('dialog', {name: 'Navegación'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Más opciones'}));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', {name: 'Navegación'})).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('EXTRA-NATIVE-EDIT · retorno rechaza trigger oculto/ancestro oculto', async () => {
    const {container} = await setup();
    const target = document.createElement('button'); target.dataset.focusKey = 'hidden-test';
    container.append(target); target.hidden = true;
    expect(resolveReturnFocus('hidden-test')).toBe(false);
    target.hidden = false; container.style.display = 'none';
    expect(resolveReturnFocus('hidden-test')).toBe(false);
  });
});

// The drawer must not resurrect when a transient overlay becomes a permanent column.
// Removing the docking reconciliation would leave an obsolete layer in the single store.
describe('3A · reconciliación de capas al dockear', () => {
  it('abrir navegación 390→700→390 elimina capa al dockear y no reabre drawer', async () => {
    const {session, user} = await setup(390);
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toContain('navigation');
    actResize(700);
    await waitFor(() => expect(session.store.getState().overlays.layers.map((layer) => layer.id)).not.toContain('navigation'));
    actResize(390);
    expect(screen.queryByRole('dialog', {name: 'Navegación'})).toBeNull();
    expect(screen.getByRole('button', {name: 'Abrir navegación'})).toHaveAttribute('aria-expanded', 'false');
  });

  it('dockear navegación cierra su disclosure, sin una capa more fantasma', async () => {
    const {session, user} = await setup(390);
    await user.click(screen.getByRole('button', {name: 'Abrir navegación'}));
    await user.click(screen.getByRole('button', {name: 'Más opciones'}));
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toEqual(['navigation','more']);
    actResize(700);
    await waitFor(() => expect(session.store.getState().overlays.layers).toEqual([]));
    expect(screen.getByRole('button', {name: 'Más opciones'})).toHaveAttribute('aria-expanded','false');
  });

  it('Tiempo workspace999→1000→999 no resucita; Inicio sigue overlay en ancho', async () => {
    const {session, user} = await setup(999);
    await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toContain('time');
    actResize(1000);
    await waitFor(() => expect(session.store.getState().overlays.layers.map((layer) => layer.id)).not.toContain('time'));
    actResize(999);
    expect(screen.queryByRole('dialog', {name: 'Tiempo'})).toBeNull();
    await user.click(within(screen.getByRole('navigation', {name: 'Principal'})).getByRole('button', {name: 'Inicio'}));
    await user.click(screen.getByRole('button', {name: 'Mostrar Tiempo'}));
    actResize(1440);
    expect(screen.getByRole('dialog', {name: 'Tiempo'})).toBeInTheDocument();
    expect(session.store.getState().overlays.layers.map((layer) => layer.id)).toContain('time');
  });
});

function actResize(width: number) {
  act(() => {window.innerWidth = width; window.dispatchEvent(new Event('resize'));});
}

// Technical slots deliberately do not close editor/Agenda identities.
describe('3A EXTRA-NATIVE-EDIT · slots técnicos', () => {
  it('un único campo, valor y selección sobreviven docking; Enter de composición no guarda', async () => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 999, writable: true});
    const session = createSession({random: () => 0}); sessions.push(session);
    await session.store.getState().load(); session.store.getState().setView('workspace');
    const {LayoutHarness} = await import('../../src/harness/LayoutHarness');
    const {OverlayProvider} = await import('../../src/components/OverlayCoordinator');
    render(<AppProviders><OverlayProvider store={session.store}><LayoutHarness session={session}/></OverlayProvider></AppProviders>);
    const body = screen.getByRole('textbox', {name: 'Borrador técnico'}) as HTMLTextAreaElement;
    fireEvent.change(body, {target: {value: 'Crudo literal <sin cambio>'}});
    body.focus(); body.setSelectionRange(3, 8);
    actResize(1000); actResize(999); actResize(700); actResize(699); actResize(1440);
    expect(screen.getByRole('textbox', {name: 'Borrador técnico'})).toBe(body);
    expect(body.value).toBe('Crudo literal <sin cambio>');
    expect([body.selectionStart,body.selectionEnd]).toEqual([3,8]);
    const title = screen.getByRole('textbox', {name: 'Título técnico'});
    fireEvent.keyDown(title, {key: 'Enter', isComposing: true});
    fireEvent.keyDown(title, {key: 'Enter', keyCode: 229});
    expect(screen.getByLabelText('Guardados técnicos')).toHaveTextContent('0');
    fireEvent.keyDown(title, {key: 'Enter'});
    expect(screen.getByLabelText('Guardados técnicos')).toHaveTextContent('1');
  });
});

it('EXTRA-NATIVE-EDIT · fullscreen ausente/denegado conserva slots y explica fallback', async () => {
  Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1000, writable: true});
  const session = createSession({random: () => 0}); sessions.push(session);
  await session.store.getState().load(); session.store.getState().setView('workspace');
  const {LayoutHarness} = await import('../../src/harness/LayoutHarness');
  const {OverlayProvider} = await import('../../src/components/OverlayCoordinator');
  render(<AppProviders><OverlayProvider store={session.store}><LayoutHarness session={session}/></OverlayProvider></AppProviders>);
  const body = screen.getByRole('textbox', {name: 'Borrador técnico'});
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', {name: 'Pantalla completa de ensayo'}));
  expect(screen.getByRole('status', {name: 'Estado de pantalla completa'})).toHaveTextContent('Pantalla completa no está disponible. Puedes seguir trabajando.');
  expect(screen.getByRole('textbox', {name: 'Borrador técnico'})).toBe(body);
  Object.defineProperty(document.documentElement, 'requestFullscreen', {configurable:true,value:vi.fn().mockRejectedValue(new Error('Denied'))});
  await user.click(screen.getByRole('button', {name: 'Pantalla completa de ensayo'}));
  await waitFor(() => expect(screen.getByRole('status', {name: 'Estado de pantalla completa'})).toHaveTextContent('No se pudo abrir pantalla completa. Puedes seguir trabajando.'));
  expect(screen.getByRole('textbox', {name: 'Borrador técnico'})).toBe(body);
  Reflect.deleteProperty(document.documentElement,'requestFullscreen');
});

it('EXTRA-NATIVE-EDIT · ocultar columna Tiempo no roba foco de edición exterior', async () => {
  Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1000, writable: true});
  const session = createSession({random: () => 0}); sessions.push(session);
  await session.store.getState().load(); session.store.getState().setView('workspace');
  const {LayoutHarness} = await import('../../src/harness/LayoutHarness');
  const {OverlayProvider} = await import('../../src/components/OverlayCoordinator');
  render(<AppProviders><OverlayProvider store={session.store}><LayoutHarness session={session}/></OverlayProvider></AppProviders>);
  const body = screen.getByRole('textbox', {name: 'Borrador técnico'});
  body.focus();
  actResize(999);
  await waitFor(() => expect(document.getElementById('time-panel')).toHaveAttribute('hidden'));
  await waitFor(() => expect(body).toHaveFocus());
});


it('3A · navegación repetida conserva salto al contenido de v5', () => {
  const html = fs.readFileSync('preview.html','utf8');
  const source = new DOMParser().parseFromString(html,'text/html');
  const first = source.body.querySelector('a[href="#main"]');
  expect(first).not.toBeNull();
  expect(first?.textContent).toBe('Saltar al contenido');
  expect(first?.nextElementSibling?.id).toBe('root');
});

// Icon audit I1/I2/I4: source geometry and contextual sizes are project contracts,
// not an instruction to increase all strokes or use one size everywhere.
describe('3A · fidelidad iconográfica auditada', () => {
  it('I1 · prioridad conserva flecha ascendente14 y texto Prioridad Alta', async () => {
    const {user} = await setup();
    const nav = within(screen.getByRole('navigation', {name: 'Principal'}));
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    await user.click(nav.getByRole('button', {name: 'Lista 2'}));
    const badge = document.querySelector('.priority-badge')!;
    expect(badge).toHaveTextContent('Prioridad Alta');
    const glyph = badge.querySelector('svg')!;
    expect(glyph).toHaveAttribute('aria-hidden','true');
    expect(glyph).toHaveAttribute('width','14');
    expect(glyph).toHaveAttribute('height','14');
    expect(glyph.querySelector('path')).toHaveAttribute('d','M12 19V5m-6 6 6-6 6 6');
  });

  it.each(['Lista 1','Editar nombre de Lista 1','Agregar tarea a Lista 1'])('I4 · acción de fila %s conserva glifo20',async (name) => {
    const {user} = await setup();
    const nav = within(screen.getByRole('navigation', {name: 'Principal'}));
    await user.click(nav.getByRole('button', {name: 'Ir al turno actual'}));
    const glyph = nav.getByRole('button', {name}).querySelector('svg');
    expect(glyph).toHaveAttribute('width','20');
    expect(glyph).toHaveAttribute('height','20');
  });

  it('I4 · Demo usa engranaje20 sin alterar footer16',async () => {
    const {user} = await setup();
    await user.click(screen.getByRole('button',{name:'Más opciones'}));
    expect(screen.getByRole('button',{name:'Demo local: datos sintéticos'}).querySelector('svg')).toHaveAttribute('width','20');
  });

  it('I2 · cierre de drawer muestra X20 decorativa con nombre accesible específico',async () => {
    const {user} = await setup(390);
    await user.click(screen.getByRole('button',{name:'Abrir navegación'}));
    const close = screen.getByRole('button',{name:'Cerrar navegación'});
    expect(close).toHaveTextContent(/^$/);
    expect(close.querySelector('svg')).toHaveAttribute('width','20');
    expect(close.querySelector('svg')).toHaveAttribute('aria-hidden','true');
  });
});

it.each(['pointer','keyboard'] as const)('3A · al estrechar columna con Más opciones abierto por %s no queda capa huérfana y foco vuelve visible', async (method) => {
  const {session, user} = await setup(700);
  const trigger = screen.getByRole('button',{name:'Más opciones'});
  if (method === 'keyboard') {trigger.focus(); await user.keyboard('{Enter}');} else await user.click(trigger);
  const appearance = screen.getByLabelText('Apariencia');
  appearance.focus();
  expect(session.store.getState().overlays.layers.map((layer)=>layer.id)).toEqual(['more']);
  actResize(699);
  await waitFor(()=>expect(session.store.getState().overlays.layers).toEqual([]));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Abrir navegación'})).toHaveFocus());
  expect(session.store.getState().selection).toBeNull();
});
