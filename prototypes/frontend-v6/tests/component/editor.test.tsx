import {readFileSync} from 'node:fs';
// Product integration, not a slot fixture. Missing fields, eager persistence,
// swallowed failures, IME cancellation and a lost draft must fail these tests.
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import type {Task} from '../../src/domain/types';

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals();});
async function setup(note = false) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  const session = createSession({random: () => 0}); sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup();
  const nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  await user.click(nav.getByRole('button', {name: note ? 'Notas rápidas' : 'Ir al turno actual'}));
  await user.click(nav.getByRole('button', {name: note ? 'Notas generales' : 'Tarea 1'}));
  return {session, user, nav};
}
const title = () => screen.getByRole('textbox', {name: 'Título de tarea'});
const body = () => screen.getByRole('textbox', {name: 'Notas de la tarea'});

describe('4A editor · actual task and note forms', () => {
  it('INTERFACE-SKILLS-29/30 · title Enter submits a dirty form once and clean Enter is a no-op', async () => {
    const {session, user} = await setup();
    const spy = vi.spyOn(session.port, 'saveTask');
    await user.click(title()); await user.keyboard('{Enter}');
    expect(spy).not.toHaveBeenCalled();
    await user.clear(title()); await user.type(title(), 'Título con Enter'); await user.keyboard('{Enter}');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(title()).toHaveValue('Título con Enter');
    expect(screen.getByRole('button', {name: 'Guardar'})).toBeDisabled();
  });

  it('HISTORY-10 · composing Enter and keyCode229 are not cancelled and line breaks normalize after composition', async () => {
    const {session} = await setup(); const spy = vi.spyOn(session.port, 'saveTask');
    const input = title();
    fireEvent.compositionStart(input);
    fireEvent.change(input, {target: {value: 'Texto\ncompuesto'}});
    expect(input).toHaveValue('Texto\ncompuesto');
    const composing = new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true, isComposing: true});
    fireEvent(input, composing); expect(composing.defaultPrevented).toBe(false);
    fireEvent.compositionEnd(input);
    expect(input).toHaveValue('Texto compuesto');
    const legacy = new KeyboardEvent('keydown', {key: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true});
    fireEvent(input, legacy); expect(legacy.defaultPrevented).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(input, {target: {value: 'Texto\npegado'}});
    expect(input).toHaveValue('Texto pegado');
  });

  it('DESIGN-AUDIT-02/04/05 · native editor checkbox and metadata are drafts until confirmed Save', async () => {
    const {session, user, nav} = await setup();
    const spy = vi.spyOn(session.port, 'saveTask');
    const check = screen.getByRole('checkbox', {name: 'Tarea completada'});
    expect(check.closest('label')!.querySelectorAll('input,button')).toHaveLength(1);
    await user.clear(screen.getByLabelText('Motivo')); await user.type(screen.getByLabelText('Motivo'), 'Contexto <literal>');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'high'); await user.click(check);
    expect(spy).not.toHaveBeenCalled();
    expect(nav.getByRole('button', {name: 'Tarea 1'})).not.toHaveTextContent('Alta');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]![0]).toMatchObject({reason: 'Contexto <literal>', priority: 'high', completed: true});
    expect(nav.getByRole('button', {name: /Tarea 1.*Prioridad Alta/})).toHaveTextContent('Alta');
  });

  it('UI-07 INTERFACE-SKILLS-07 · conflict retains body, no false success, retry succeeds', async () => {
    const {session, user} = await setup();
    await user.type(body(), 'Borrador que no se pierde'); session.port.failNext('conflict');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().busy).toBe(false));
    expect(body()).toHaveValue('Borrador que no se pierde');
    expect(document.getElementById('save-error')).toHaveTextContent(/Conflicto|versión/);
    expect(document.getElementById('save-feedback')).not.toHaveTextContent('Guardado en esta demostración.');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(document.getElementById('save-feedback')).toHaveTextContent('Guardado en esta demostración.'));
  });

  it('UI-17 · Cancel restores title body reason priority completion and clean controls', async () => {
    const {user} = await setup();
    await user.clear(title()); await user.type(title(), 'Descartar'); await user.type(body(), 'Descartar');
    await user.clear(screen.getByLabelText('Motivo')); await user.type(screen.getByLabelText('Motivo'), 'Descartar');
    await user.selectOptions(screen.getByLabelText('Prioridad'), 'high');
    await user.click(screen.getByRole('checkbox', {name: 'Tarea completada'}));
    await user.click(screen.getByRole('button', {name: 'Cancelar'}));
    expect(title()).toHaveValue('Tarea 1'); expect(body()).toHaveValue('');
    expect(screen.getByLabelText('Motivo')).toHaveValue('Exámenes'); expect(screen.getByLabelText('Prioridad')).toHaveValue('normal');
    expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).not.toBeChecked();
    expect(screen.getByRole('button', {name: 'Guardar'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancelar'})).toBeDisabled();
  });

  it('UI-05 · pending Save locks actual controls and rapid repeated submit mutates once', async () => {
    const {session, user} = await setup();
    let resolve!: (task: Task) => void;
    const pending = new Promise<Task>((done) => {resolve = done;});
    const spy = vi.spyOn(session.port, 'saveTask').mockImplementationOnce(() => pending);
    await user.type(body(), 'Enviada');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    expect(title()).toHaveAttribute('readonly'); expect(body()).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Motivo')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Prioridad')).toBeDisabled();
    expect(screen.getByRole('checkbox', {name: 'Tarea completada'})).toBeDisabled();
    await user.type(body(), ' texto bloqueado'); expect(body()).toHaveValue('Enviada');
    fireEvent.submit(document.getElementById('editor-form')!); expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => resolve({...spy.mock.calls[0]![0], version: 2}));
    expect(body()).not.toHaveAttribute('readonly');
  });

  it('UI-08 · title and body markup remain literal through Save and reselection', async () => {
    const {user, nav} = await setup();
    fireEvent.change(title(), {target: {value: '<img src=x onerror=alert(1)>'}});
    fireEvent.change(body(), {target: {value: '<script>not executed</script>'}});
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(screen.getByRole('button', {name: 'Guardar'})).toBeDisabled());
    expect(document.querySelector('script:not([type=module])')).toBeNull();
    expect(nav.getByRole('button', {name: '<img src=x onerror=alert(1)>'})).toBeInTheDocument();
    await user.click(nav.getByRole('button', {name: 'Revisar insumos'}));
    await user.click(nav.getByRole('button', {name: '<img src=x onerror=alert(1)>'}));
    expect(title()).toHaveValue('<img src=x onerror=alert(1)>');
    expect(body()).toHaveValue('<script>not executed</script>');
  });

  it('INTERFACE-SKILLS-09 EMIL-SKILLS-04 · note has a visible body label and no task properties', async () => {
    const {user, session} = await setup(true);
    expect(screen.queryByLabelText('Motivo')).toBeNull(); expect(screen.queryByLabelText('Prioridad')).toBeNull();
    expect(screen.queryByRole('checkbox', {name: 'Tarea completada'})).toBeNull();
    const noteTitle = screen.getByRole('textbox', {name: 'Título de nota'});
    const noteBody = screen.getByRole('textbox', {name: 'Texto de la nota'});
    await user.clear(noteTitle); await user.click(screen.getByRole('button', {name: 'Guardar'}));
    expect(noteTitle).toHaveAttribute('aria-invalid', 'true');
    await user.type(noteBody, 'No borra el error de título'); expect(noteTitle).toHaveAttribute('aria-invalid', 'true');
    await user.type(noteTitle, 'Nota válida'); expect(noteTitle).not.toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByRole('button', {name: 'Guardar'}));
    await waitFor(() => expect(session.store.getState().dirty).toBe(false));
    expect(session.store.getState().snapshot!.notes[0]!.body).toBe('No borra el error de título');
  });
});


describe('4A declared CSS parity contracts, not native rendering', () => {
  const styles = ['global', 'layout', 'editor', 'time-panel'].map((name) => readFileSync(`src/styles/${name}.css`, 'utf8')).join('\n');
  it('INTERFACE-SKILLS-28 · imported styles never declare anywhere wrapping', () => {
    expect(styles).not.toMatch(/overflow-wrap\s*:\s*anywhere/);
  });
  it('EMIL-SKILLS-14 · touch manipulation is scoped to controls without global selection suppression', () => {
    expect(styles).toMatch(/button\s*,\s*summary\s*,\s*input\[type=checkbox\]\s*\{[^}]*touch-action\s*:\s*manipulation/);
    expect(styles).not.toMatch(/touch-action\s*:\s*none/);
    expect(styles).not.toMatch(/(?:body|html|\*)\s*\{[^}]*user-select\s*:\s*none/);
  });
  it('EMIL-SKILLS-16 · active feedback exists after hover and disables transition while pressed', () => {
    expect(styles).toMatch(/button:not\(:disabled\):active\s*\{[^}]*transition\s*:\s*none/);
    expect(styles.lastIndexOf(':active')).toBeGreaterThan(styles.indexOf('button.primary:hover'));
  });
});

describe('Editorial column · approved option 1', () => {
  it('keeps a stable title control and exposes context when it becomes empty', async () => {
    const {user} = await setup(); const original = title();
    await user.clear(original);
    expect(title()).toBe(original); expect(title()).toHaveAttribute('placeholder', 'Escribe un título…');
    const label = document.querySelector('label[for="title"]'); expect(label).not.toHaveClass('visually-hidden');
    expect(title()).toHaveAccessibleName('Título de tarea'); expect(screen.getByRole('main')).toHaveAttribute('data-editor-layout', 'editorial');
  });
  it('keeps validation contextual without repeating its same message in the footer', async () => {
    const {session} = await setup(); const original = body();
    fireEvent.change(title(), {target: {value: '   '}}); fireEvent.change(body(), {target: {value: 'Borrador conservado'}});
    await act(async () => {fireEvent.submit(document.getElementById('editor-form')!); await Promise.resolve();});
    const error = session.store.getState().errors.title!; expect(error).toBeTruthy(); expect(screen.getAllByText(error, {exact: true})).toHaveLength(1);
    expect(body()).toBe(original); expect(body()).toHaveValue('Borrador conservado'); expect(title()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Editorial title resize regression', () => {
  it('refits a changed width without another edit, preserving node, value and selection', async () => {
    const observers: {callback: ResizeObserverCallback}[] = [], frames: FrameRequestCallback[] = [];
    class Observer {callback: ResizeObserverCallback; constructor(callback: ResizeObserverCallback) {this.callback = callback; observers.push(this);} observe() {} unobserve() {} disconnect() {}}
    vi.stubGlobal('ResizeObserver', Observer);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {frames.push(callback); return frames.length;});
    const {session} = await setup(); const control = title() as HTMLTextAreaElement; let requiredHeight = 134;
    Object.defineProperty(control, 'scrollHeight', {configurable: true, get: () => requiredHeight});
    fireEvent.change(control, {target: {value: 'Título largo '.repeat(20)}}); control.focus(); control.setSelectionRange(3, 9);
    expect(control.style.height).toBe('134px'); const value = control.value; requiredHeight = 319;
    act(() => {for (const observer of observers) observer.callback([{target: control, contentRect: {width: 200}} as unknown as ResizeObserverEntry], observer as unknown as ResizeObserver); for (const callback of frames.splice(0)) callback(0);});
    expect(control.style.height).toBe('319px'); expect(title()).toBe(control); expect(control.value).toBe(value); expect([control.selectionStart, control.selectionEnd]).toEqual([3, 9]); expect(session.store.getState().dirty).toBe(true);
    vi.unstubAllGlobals();
  });
});

it('EMIL-SKILLS-16 · the rendered current Agenda has pressed feedback after its hover rule', () => {
  const css = readFileSync('src/styles/time-panel.css', 'utf8');
  expect(css).toMatch(/\.agenda-task\.current:not\(:disabled\):active\s*\{[^}]*background:var\(--pressed\)/);
  expect(css.indexOf('.agenda-task.current:not(:disabled):active')).toBeGreaterThan(css.indexOf('.agenda-task.current:hover:not(:disabled)'));
});
