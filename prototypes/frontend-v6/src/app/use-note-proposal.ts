// Estado de la propuesta de tarea bajo la nota seleccionada (R5b-T10). Vive en la app, no en el store.
// Una petición se cancela al cambiar de nota, al editar otra vez, al desmontar o a los 20 s. Una respuesta solo se
// pinta si la nota y la versión siguen vigentes y no fue descartada.
import {useEffect, useRef, useState, type MutableRefObject} from 'react';
import type {NoteProposal, NoteProposalSource} from '../adapters/note-proposals';

const TIMEOUT_MS = 20_000;
type Ticket = {controller: AbortController; timer: ReturnType<typeof setTimeout>};
export type ShownProposal = {noteId: string; noteVersion: number; proposal: NoteProposal};
type Pending = MutableRefObject<Ticket | null>;

const releaseTicket = (pending: Pending, ticket: Ticket) => {
  clearTimeout(ticket.timer);
  if (pending.current === ticket) pending.current = null;
};
const cancelRequest = (pending: Pending) => {
  const ticket = pending.current;
  if (!ticket) return;
  releaseTicket(pending, ticket);
  ticket.controller.abort();
};
const keyOf = (noteId: string, noteVersion: number) => `${noteId}:${noteVersion}`;

export function useNoteProposal({source, selectedNoteId, draftRevision, current}: {
  source: NoteProposalSource | undefined;
  selectedNoteId: string | null;
  draftRevision: number;
  current: {noteId: string; version: number} | null;
}) {
  const [shown, setShown] = useState<ShownProposal | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const pending = useRef<Ticket | null>(null);

  // Cambiar de nota o editar el borrador invalida cualquier petición y retira la propuesta visible.
  const scope = `${selectedNoteId ?? ''}\u0000${draftRevision}`;
  const [seenScope, setSeenScope] = useState(scope);
  if (seenScope !== scope) {
    setSeenScope(scope);
    setShown(null);
  }
  useEffect(() => {cancelRequest(pending);}, [scope]);
  useEffect(() => () => cancelRequest(pending), []);

  const request = (noteId: string, noteVersion: number) => {
    if (!source) return;
    cancelRequest(pending);
    const controller = new AbortController();
    const ticket: Ticket = {controller, timer: setTimeout(() => {releaseTicket(pending, ticket); controller.abort();}, TIMEOUT_MS)};
    pending.current = ticket;
    source.proposeFromNote({noteId, noteVersion}, controller.signal).then((proposal) => {
      if (controller.signal.aborted || pending.current !== ticket) return;
      releaseTicket(pending, ticket);
      if (proposal && proposal.noteId === noteId && proposal.noteVersion === noteVersion) setShown({noteId, noteVersion, proposal});
    }, () => {
      // Error o rechazo: silencio. No hay aviso ni reintento.
      if (pending.current === ticket) releaseTicket(pending, ticket);
    });
  };

  const visible = shown && current && shown.noteId === selectedNoteId && shown.noteId === current.noteId && shown.noteVersion === current.version
    && !hidden.includes(keyOf(shown.noteId, shown.noteVersion)) ? shown : null;
  // Descartar y «Revisar tarea» ocultan esta versión durante la sesión; una versión nueva puede proponer de nuevo.
  const hide = (item: ShownProposal) => {
    const key = keyOf(item.noteId, item.noteVersion);
    setHidden((list) => (list.includes(key) ? list : [...list, key]));
    setShown(null);
  };
  return {visible, request, hide};
}
