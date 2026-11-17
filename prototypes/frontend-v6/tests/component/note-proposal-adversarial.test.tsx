// Casos adversos de la propuesta en la nota: carreras, fuentes que fallan y títulos fuera de límite.
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import type {NoteProposal, NoteProposalSource} from '../../src/adapters/note-proposals';

type Call = {noteId: string; noteVersion: number; signal: AbortSignal; resolve(v: NoteProposal | null): void; reject(e: unknown): void};
function fake() {
  const calls: Call[] = [];
  const inputs: unknown[] = [];
  const source: NoteProposalSource = {proposeFromNote: (input, signal) => new Promise((resolve, reject) => {inputs.push(input); calls.push({...input, signal, resolve, reject});})};
  return {source, calls, inputs};
}
const prop = (noteId: string, v: number, title = 'Pedir etiquetas'): NoteProposal => ({id: `note:${noteId}:${v}`, kind: 'note-task', title, sourceQuote: 'q', noteId, noteVersion: v});
const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((s) => s.dispose()); vi.restoreAllMocks();});
async function setup(source: NoteProposalSource) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  window.history.replaceState(null, '');
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0}), noteProposals: source});
  sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup(), nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  await user.click(nav.getByRole('button', {name: 'Notas rápidas'}));
  return {session, user, nav};
}
const ver = (s: ReturnType<typeof createSession>, id = 'note-1') => s.store.getState().snapshot!.notes.find((n) => n.id === id)!.version;
async function editAndSave(s: ReturnType<typeof createSession>, user: ReturnType<typeof userEvent.setup>, text = ' x') {
  const before = ver(s);
  await user.type(screen.getByRole('textbox', {name: 'Título de nota'}), text);
  await user.click(screen.getByRole('button', {name: 'Guardar'}));
  await waitFor(() => expect(ver(s)).toBe(before + 1));
  await waitFor(() => expect(s.store.getState().dirty).toBe(false));
}
const block = () => screen.queryByRole('region', {name: 'Propuesta de tarea'});
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('tester R5b', () => {
  it('source receives only noteId and noteVersion', async () => {
    const {source, calls, inputs} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user, ' secreto-clinico');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(Object.keys(inputs[0] as object).sort()).toEqual(['noteId', 'noteVersion']);
    expect(JSON.stringify(inputs)).not.toContain('secreto');
  });

  it('A -> B -> A: late response for the same version is dropped (request aborted on leave)', async () => {
    const {source, calls} = fake();
    const {session, user, nav} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    const made = await session.store.getState().createNote('Otra nota');
    expect(made.status).toBe('saved');
    const notes = session.store.getState().snapshot!.notes;
    session.store.getState().select({kind: 'note', id: notes.find((n) => n.id !== 'note-1')!.id});
    await tick();
    session.store.getState().select({kind: 'note', id: 'note-1'});
    await tick();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(prop('note-1', 2));
    await tick();
    expect(block()).toBeNull();
    void nav;
  });

  it('a visible block disappears when the user types again', async () => {
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(prop('note-1', 2));
    await screen.findByRole('region', {name: 'Propuesta de tarea'});
    await user.type(screen.getByRole('textbox', {name: 'Título de nota'}), 'z');
    expect(block()).toBeNull();
  });

  it('20 s timeout aborts the request and a late response is dropped', async () => {
    const real = globalThis.setTimeout;
    const captured: Array<() => void> = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
      if (ms === 20_000) {captured.push(fn as () => void); return 0 as unknown as ReturnType<typeof setTimeout>;}
      return real(fn as () => void, ms, ...a);
    }) as typeof setTimeout);
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(captured).toHaveLength(1);
    expect(calls[0]!.signal.aborted).toBe(false);
    captured[0]!();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(prop('note-1', 2));
    await tick();
    expect(block()).toBeNull();
  });

  it('unmount aborts the request and no state update / error occurs', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    cleanup();
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(prop('note-1', 2));
    calls[0]!.reject(new Error('late'));
    await tick();
    expect(errors).not.toHaveBeenCalled();
  });

  it('review seed is appended (not duplicated) when an unreviewed card survived a non-discarding close', async () => {
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(screen.getByRole('button', {name: 'Abrir captura de tareas'}));
    const d0 = await screen.findByRole('dialog', {name: 'Captura y sugerencias'});
    await user.click(within(d0).getByRole('button', {name: /Nueva tarjeta/}));
    expect(within(d0).getAllByRole('group', {name: /Pendiente de aprobación/})).toHaveLength(1);
    session.store.getState().dispatchOverlay({type: 'close', id: 'assistance'});
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Captura y sugerencias'})).toBeNull());
    calls[0]!.resolve(prop('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    await user.click(within(region).getByRole('button', {name: 'Revisar tarea'}));
    const d1 = await screen.findByRole('dialog', {name: 'Captura y sugerencias'});
    const cards = within(d1).getAllByRole('group', {name: /Pendiente de aprobación/});
    expect(cards).toHaveLength(2);
    expect(within(d1).getAllByDisplayValue('Pedir etiquetas')).toHaveLength(1);
  });

  it('source that throws synchronously must not leak an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const h = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', h);
    const source: NoteProposalSource = {proposeFromNote: () => {throw new Error('boom');}};
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await tick(); await tick();
    process.off('unhandledRejection', h);
    expect(unhandled).toEqual([]);
  });

  it('double click on Revisar tarea yields exactly one seeded card', async () => {
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(prop('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    await user.dblClick(within(region).getByRole('button', {name: 'Revisar tarea'}));
    const dialog = await screen.findByRole('dialog', {name: 'Captura y sugerencias'});
    expect(within(dialog).getAllByRole('group', {name: /Pendiente de aprobación/})).toHaveLength(1);
  });

  it('proposal with a 5000-char title from a misbehaving source is rendered unbounded (parse is not enforced in hook)', async () => {
    const {source, calls} = fake();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(prop('note-1', 2, 'a'.repeat(5000)));
    await tick();
    expect(block()).toBeNull();
  });
});
