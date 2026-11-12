// Propuesta de tarea desde una nota guardada (R5b). El navegador nunca envía texto de nota ni llama a un modelo:
// solo recibe la forma aprobada por el backend (R5a) y la valida antes de mostrarla.
export type NoteProposal = {
  id: string;
  kind: 'note-task';
  title: string;
  sourceQuote: string;
  noteId: string;
  noteVersion: number;
};

export type NoteProposalSource = {
  proposeFromNote(input: {noteId: string; noteVersion: number}, signal: AbortSignal): Promise<NoteProposal | null>;
};

const MAX_TITLE = 80;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// Solo la forma exacta de R5a: estado «proposed», una sugerencia inline, aprobación obligatoria y acciones
// «review» y «dismiss». Cualquier otra respuesta (abstención, obsoleta, error) devuelve null.
export function parseNoteProposalResponse(json: unknown): NoteProposal | null {
  if (!isRecord(json) || json.status !== 'proposed') return null;
  const {noteId, noteVersion, suggestions} = json;
  if (typeof noteId !== 'string' || !Number.isInteger(noteVersion) || !Array.isArray(suggestions) || suggestions.length !== 1) return null;
  const item = suggestions[0];
  if (!isRecord(item)) return null;
  const {id, kind, title, sourceQuote, channel, actions, requiresApproval} = item;
  if (kind !== 'note-task' || channel !== 'inline' || requiresApproval !== true) return null;
  if (!Array.isArray(actions) || actions.length !== 2 || actions[0] !== 'review' || actions[1] !== 'dismiss') return null;
  if (item.noteId !== noteId || item.noteVersion !== noteVersion || id !== `note:${noteId}:${noteVersion}`) return null;
  if (typeof title !== 'string' || !title.trim() || title.length > MAX_TITLE) return null;
  if (typeof sourceQuote !== 'string') return null;
  return {id, kind: 'note-task', title, sourceQuote, noteId, noteVersion: noteVersion as number};
}
