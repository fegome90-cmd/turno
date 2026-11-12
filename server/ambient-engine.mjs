import { assertSyntheticEvent } from './gateway-config.mjs';
import { classifySignal } from './decision-switch.mjs';
import { validateNoteProposal } from './note-proposal.mjs';
import { isCoveredByOpenTask } from './task-duplicates.mjs';

const NOTE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const NOTE_TEXT_MAX = 500;
const abstain = reason => ({ status: 'abstain', reason, suggestions: [] });
const counted = (fn, onCall) => typeof fn === 'function'
  ? async input => { onCall(); return fn(input); } : fn;

/** Comparación exacta tras normalizar: NFC, recorte, espacios colapsados y minúsculas. */
export function normalizeTaskTitle(title) {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function suggestion(id, kind, title, detail, taskIds = []) {
  return Object.freeze({ id, kind, title, detail, taskIds, channel: 'inbox',
    actions: ['review','dismiss'], requiresApproval: true });
}

/**
 * Reglas de borradores sin modelo y sin acceso a datos reales.
 * Las reglas de tareas guardadas (repeticiones, cierre) viven en el frontend (D3).
 */
export function inspectDrafts({ shiftId, drafts, beds = [] }) {
  if (typeof shiftId !== 'string' || !Array.isArray(drafts) || !Array.isArray(beds)) {
    throw new Error('Snapshot de turno inválido.');
  }
  const knownBeds = new Set(beds.map(b => b.id));
  const proposed = [];
  const missingBedLabels = new Set();
  const missingDateIds = [];
  const missingDateTimes = new Set();
  for (const task of drafts) {
    if (!task || !/^[a-zA-Z0-9_-]{1,80}$/.test(task.id || '') ||
      typeof task.title !== 'string' || task.title.length > 300) {
      throw new Error('Tarea sintética inválida.');
    }
    if (task.bedLabel && (!task.bedId || !knownBeds.has(task.bedId))) missingBedLabels.add(task.bedLabel);
    if (task.time && !task.date) {
      missingDateIds.push(task.id);
      missingDateTimes.add(task.time);
    }
  }
  if (missingBedLabels.size > 0) {
    proposed.push(suggestion('bed:'+shiftId,'resolve-bed','Vincular cama antes de guardar',
      [...missingBedLabels].join(', ')+' no está asociada al turno.'));
  }
  if (missingDateIds.length) {
    const times = [...missingDateTimes].sort().join(', ');
    proposed.push(suggestion('date:'+shiftId,'resolve-date','Confirmar fecha de tareas con hora',
      'Hay tareas con hora ('+times+') pero sin fecha confirmada.',missingDateIds));
  }
  return proposed;
}

/**
 * Punto de entrada para un worker con disparadores del backend.
 * Backend debe proveer autorización y snapshot autoritativo (no payload cliente).
 * No escribe tareas ni envía notificaciones por sí mismo.
 */
export async function analyzeAmbientEvent({
  event, settings, isAuthorized, getAuthorizedSnapshot,
  classifyWithGateway, classifyWithDecision, recordComparison,
  extractNoteProposal, alreadyProcessed = () => false, markProcessed = () => {}, onMetrics,
}) {
  if (!settings || !settings.enabled) return { status:'disabled', suggestions:[] };
  assertSyntheticEvent(event, settings);
  if (!['drafts_ready','note_saved'].includes(event.type)) {
    throw new Error('Tipo de evento no autorizado.');
  }
  if (event.type === 'note_saved' && (typeof event.noteId !== 'string' || !NOTE_ID.test(event.noteId) ||
      !Number.isInteger(event.noteVersion) || event.noteVersion < 1 || event.noteVersion > 1_000_000)) {
    throw new Error('Evento de nota inválido.');
  }
  if (typeof isAuthorized !== 'function' || typeof getAuthorizedSnapshot !== 'function') {
    throw new Error('Faltan callbacks de autenticación y lectura del backend.');
  }
  if (await isAuthorized(event) !== true) throw new Error('Acceso no autorizado.');
  const snapshot = await getAuthorizedSnapshot(event);
  if (!snapshot || snapshot.shiftId !== event.shiftId) throw new Error('Snapshot ajeno al turno.');
  if (snapshot.synthetic !== true) throw new Error('Fuente de datos no acreditada como sintética.');
  if (event.type !== 'note_saved') {
    const suggestions = inspectDrafts({ shiftId: event.shiftId, drafts: snapshot.drafts, beds: snapshot.beds });
    return suggestions.length > 0 ? { status:'proposed', suggestions } : abstain('no_suggestions');
  }
  return reviewNote(event, snapshot, settings, {
    classifyWithGateway, classifyWithDecision, recordComparison, extractNoteProposal, alreadyProcessed, markProcessed,
  }, onMetrics);
}

/**
 * Orden fijo: nota/versión → vacía → más de 500 → ya procesada → clasificador → solo
 * PROPOSE_TASK pide extracción → validación → duplicado exacto. Cualquier fallo se abstiene.
 * Emite un único registro sin contenido (solo contadores y el motivo).
 */
async function reviewNote(event, snapshot, settings, callbacks, onMetrics) {
  const started = performance.now();
  const flags = { eligible: false, jevCalled: false, haikuCalled: false };
  let outcome = 'error';
  try {
    const result = await decideNote(event, snapshot, settings, callbacks, flags);
    outcome = result.status === 'proposed' ? 'proposed' : result.reason;
    return result;
  } finally {
    if (typeof onMetrics === 'function') {
      try {
        onMetrics(Object.freeze({
          eventId: event.id, eligible: flags.eligible, jevCalled: flags.jevCalled, haikuCalled: flags.haikuCalled,
          outcome, durationMs: Math.round(performance.now() - started),
        }));
      } catch { /* Observability cannot change the decision. */ }
    }
  }
}

async function decideNote(event, snapshot, settings, callbacks, flags) {
  const { classifyWithGateway, classifyWithDecision, recordComparison, extractNoteProposal, alreadyProcessed, markProcessed } = callbacks;
  if (!Array.isArray(snapshot.notes) || !Array.isArray(snapshot.tasks)) throw new Error('Snapshot de turno inválido.');
  const note = snapshot.notes.find(n => n && n.id === event.noteId);
  if (!note) return abstain('note_not_found');
  if (note.version !== event.noteVersion) return { status:'stale', reason:'stale_version', suggestions:[] };
  if (typeof note.text !== 'string' || note.text.trim() === '') return abstain('empty');
  if (note.text.length > NOTE_TEXT_MAX) return abstain('too_long');
  if (alreadyProcessed(note.id, note.version) === true) return abstain('already_processed');

  flags.eligible = true;
  markProcessed(note.id, note.version);
  const classification = await classifySignal({
    event: { id:event.id, text:note.text, synthetic:true },
    mode: settings.decisionMode,
    classifyWithGateway: counted(classifyWithGateway, () => { flags.jevCalled = true; }),
    classifyWithDecision: counted(classifyWithDecision, () => { flags.jevCalled = true; }),
    recordComparison,
    ...(Number.isFinite(settings.decisionMinConfidence) && { minConfidence: settings.decisionMinConfidence }),
  });
  if (classification.status !== 'candidate' || classification.label !== 'PROPOSE_TASK') {
    return abstain(classification.status === 'abstain' ? 'classifier_abstain' : `label_${classification.label}`);
  }
  if (typeof extractNoteProposal !== 'function') return abstain('extraction_unavailable');

  flags.haikuCalled = true;
  let raw;
  try { raw = await extractNoteProposal(note.text); } catch { return abstain('extraction_failed'); }
  const action = validateNoteProposal(raw, note.text);
  if (!action) return abstain('no_proposal');

  if (isCoveredByOpenTask(action.title, snapshot.tasks)) return abstain('duplicate');
  return { status:'proposed', noteId:note.id, noteVersion:note.version, suggestions:[Object.freeze({
    id:'note:'+note.id+':'+note.version, kind:'note-task', title:action.title, sourceQuote:action.sourceQuote,
    noteId:note.id, noteVersion:note.version, channel:'inline', actions:['review','dismiss'], requiresApproval:true,
  })] };
}
