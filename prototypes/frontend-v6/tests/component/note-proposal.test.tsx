// Propuesta inline bajo una nota guardada (R5b). El origen de prueba no existe en la demo.
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {App} from '../../src/app/App';
import {AppProviders} from '../../src/app/AppProviders';
import {createSession} from '../../src/app/create-session';
import {createPreviewAdapter} from '../../src/adapters/preview-adapter';
import type {NoteProposal, NoteProposalSource} from '../../src/adapters/note-proposals';

type PendingCall = {noteId: string; noteVersion: number; signal: AbortSignal; resolve(value: NoteProposal | null): void; reject(error: unknown): void};

// Origen de propuestas falso: solo para estas pruebas; nunca se conecta en la demo.
function fakeNoteProposalSource() {
  const calls: PendingCall[] = [];
  const source: NoteProposalSource = {
    proposeFromNote: (input, signal) => new Promise<NoteProposal | null>((resolve, reject) => {
      calls.push({...input, signal, resolve, reject});
    }),
  };
  return {source, calls};
}

const proposalFor = (noteId: string, noteVersion: number, title = 'Solicitar etiquetas de despacho'): NoteProposal => ({
  id: `note:${noteId}:${noteVersion}`, kind: 'note-task', title,
  sourceQuote: 'Solicitar etiquetas de despacho antes de las 18:00', noteId, noteVersion,
});

const sessions: ReturnType<typeof createSession>[] = [];
afterEach(() => {cleanup(); sessions.splice(0).forEach((session) => session.dispose()); vi.restoreAllMocks();});

async function setup(source?: NoteProposalSource) {
  Object.defineProperty(window, 'innerWidth', {configurable: true, writable: true, value: 1440});
  window.history.replaceState(null, '');
  const session = createSession({random: () => 0, port: createPreviewAdapter({delay: 0}), ...(source ? {noteProposals: source} : {})});
  sessions.push(session);
  await session.store.getState().load();
  render(<AppProviders><App session={session}/></AppProviders>);
  const user = userEvent.setup(), nav = within(screen.getByRole('navigation', {name: 'Principal'}));
  await user.click(nav.getByRole('button', {name: 'Notas rápidas'}));
  return {session, user, nav};
}

const noteVersion = (session: ReturnType<typeof createSession>, id = 'note-1') =>
  session.store.getState().snapshot!.notes.find((note) => note.id === id)!.version;

async function editAndSave(session: ReturnType<typeof createSession>, user: ReturnType<typeof userEvent.setup>, text = ' revisada') {
  const before = noteVersion(session);
  await user.type(screen.getByRole('textbox', {name: 'Título de nota'}), text);
  await user.click(screen.getByRole('button', {name: 'Guardar'}));
  await waitFor(() => expect(noteVersion(session)).toBe(before + 1));
  await waitFor(() => expect(session.store.getState().dirty).toBe(false));
}

const block = () => screen.queryByRole('region', {name: 'Propuesta de tarea'});

describe('propuesta inline bajo una nota guardada', () => {
  it('muestra el título tras guardar, sin notificación y sin mover el foco', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({noteId: 'note-1', noteVersion: 2});
    const notices = session.notifications.getState().items.length, focused = document.activeElement;
    calls[0]!.resolve(proposalFor('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    expect(within(region).getByText('¿Agregar “Solicitar etiquetas de despacho” a tareas?')).toBeInTheDocument();
    expect(within(region).getByRole('button', {name: 'Revisar tarea'})).toBeInTheDocument();
    expect(within(region).getByRole('button', {name: 'Descartar'})).toBeInTheDocument();
    expect(session.notifications.getState().items.length).toBe(notices);
    expect(document.activeElement).toBe(focused);
  });

  it('no pinta una respuesta si la persona editó la nota después de guardar', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.type(screen.getByRole('textbox', {name: 'Título de nota'}), ' otra vez');
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(proposalFor('note-1', 2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
  });

  it('descarta una respuesta de versión anterior cuando la nota se guardó de nuevo', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    await editAndSave(session, user, ' de nuevo');
    await waitFor(() => expect(calls).toHaveLength(2));
    // Respuesta tardía de la versión 2 aunque su petición ya no sea la vigente.
    calls[0]!.resolve(proposalFor('note-1', 2, 'Versión vieja'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
    calls[1]!.resolve(proposalFor('note-1', 3, 'Versión nueva'));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    expect(within(region).getByText(/Versión nueva/)).toBeInTheDocument();
  });

  it('no pinta una respuesta si la persona seleccionó otra nota', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user, nav} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    await user.click(nav.getByRole('button', {name: 'Agregar nota rápida'}));
    const dialog = screen.getByRole('dialog', {name: 'Nueva nota rápida'});
    await user.type(within(dialog).getByRole('textbox', {name: 'Título de nota nueva'}), 'Otra nota');
    await user.click(within(dialog).getByRole('button', {name: 'Crear'}));
    await waitFor(() => expect(session.store.getState().selection?.id).not.toBe('note-1'));
    expect(calls[0]!.signal.aborted).toBe(true);
    calls[0]!.resolve(proposalFor('note-1', 2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
  });

  it('una respuesta nula o rechazada no muestra nada ni avisa', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    const notices = session.notifications.getState().items.length;
    calls[0]!.resolve(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
    expect(session.notifications.getState().items.length).toBe(notices);

    await editAndSave(session, user, ' tercera');
    await waitFor(() => expect(calls).toHaveLength(2));
    calls[1]!.reject(new Error('proveedor no disponible'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
    expect(session.notifications.getState().items.length).toBe(notices);
  });

  it('Descartar oculta la propuesta y una versión nueva puede proponer de nuevo', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(proposalFor('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    await user.click(within(region).getByRole('button', {name: 'Descartar'}));
    expect(block()).toBeNull();
    await editAndSave(session, user, ' con cambio');
    await waitFor(() => expect(calls).toHaveLength(2));
    calls[1]!.resolve(proposalFor('note-1', 3, 'Revisar etiquetas'));
    const again = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    expect(within(again).getByText(/Revisar etiquetas/)).toBeInTheDocument();
  });

  it('Revisar tarea abre la captura con una sola tarjeta prellenada y oculta el bloque', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(proposalFor('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    const before = session.store.getState().snapshot!.tasks.length;
    await user.click(within(region).getByRole('button', {name: 'Revisar tarea'}));
    const dialog = await screen.findByRole('dialog', {name: 'Captura y sugerencias'});
    const cards = within(dialog).getAllByRole('group', {name: /Pendiente de aprobación/});
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(within(card).getByRole('textbox', {name: 'Título'})).toHaveValue('Solicitar etiquetas de despacho');
    expect(within(card).getByLabelText('Fecha')).toHaveValue('');
    expect(within(card).getByLabelText('Hora')).toHaveValue('');
    expect(within(card).getByRole('combobox', {name: 'Lista'})).toHaveValue('');
    expect(session.store.getState().snapshot!.tasks.length).toBe(before);
    expect(block()).toBeNull();
    await user.selectOptions(within(card).getByRole('combobox', {name: 'Lista'}), 'bed-1');
    await user.click(within(card).getByRole('button', {name: 'Aprobar y guardar'}));
    await waitFor(() => expect(session.store.getState().snapshot!.tasks.length).toBe(before + 1));
    expect(session.store.getState().snapshot!.tasks.at(-1)).toMatchObject({title: 'Solicitar etiquetas de despacho', date: null, time: ''});
  });

  it('cerrar la revisión sin aprobar no crea tareas', async () => {
    const {source, calls} = fakeNoteProposalSource();
    const {session, user} = await setup(source);
    await editAndSave(session, user);
    await waitFor(() => expect(calls).toHaveLength(1));
    calls[0]!.resolve(proposalFor('note-1', 2));
    const region = await screen.findByRole('region', {name: 'Propuesta de tarea'});
    const before = session.store.getState().snapshot!.tasks.length;
    await user.click(within(region).getByRole('button', {name: 'Revisar tarea'}));
    const dialog = await screen.findByRole('dialog', {name: 'Captura y sugerencias'});
    await user.click(within(dialog).getByRole('button', {name: 'Cerrar captura y sugerencias'}));
    await user.click(within(dialog).getByRole('button', {name: 'Descartar y cerrar'}));
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Captura y sugerencias'})).not.toBeInTheDocument());
    expect(session.store.getState().snapshot!.tasks.length).toBe(before);
  });

  it('una sesión sin origen (demo) no llama a nada ni muestra propuestas al guardar', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const {session, user} = await setup();
    await editAndSave(session, user);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(block()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
