import { assertSyntheticEvent } from './gateway-config.mjs';
import { classifySignal } from './decision-switch.mjs';
import { validateNoteProposal } from './note-proposal.mjs';

const NOTE_ID = /^[a-zA-Z0-9_-]{1,80}$/;
const NOTE_TEXT_MAX = 500;
const abstain = reason => ({ status: 'abstain', reason, suggestions: [] });
const counted = (fn, onCall) => typeof fn === 'function'
  ? async input => { onCall(); return fn(input); } : fn;

/** Comparación exacta tras normalizar: NFC, recorte, espacios colapsados y minúsculas. */
export function normalizeTaskTitle(title) {
  return title.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

function suggestion(id, kind, title, detail, taskIds = [], channel = 'inbox') {
  return Object.freeze({ id, kind, title, detail, taskIds, channel,
    actions: ['review','dismiss'], requiresApproval: true });
}

/** Reglas de dominio: verificables sin modelo, sin acceso a datos reales. */
export function inspectDrafts({ shiftId, drafts, beds = [], closing = false }) {
  if (typeof shiftId !== 'string' || !Array.isArray(drafts) || !Array.isArray(beds)) {
    throw new Error('Snapshot de turno inválido.');
  }
  const knownBeds = new Set(beds.map(b => b.id));
  const proposed = [];
  const missingBedLabels = new Set();
  const missingDateIds = [];
  const slots = new Map();
  const pendingCloseIds = [];
  for (const task of drafts) {
    if (!task || !/^[a-zA-Z0-9_-]{1,80}$/.test(task.id || '') ||
      typeof task.title !== 'string' || task.title.length > 300) {
      throw new Error('Tarea sintética inválida.');
    }
    if (task.bedLabel && (!task.bedId || !knownBeds.has(task.bedId))) missingBedLabels.add(task.bedLabel);
    if (task.time && !task.date) missingDateIds.push(task.id);
    if (task.time && task.bedLabel) {
      const key = [task.date || 'fecha-pendiente',task.time,task.bedLabel].join('|');
      const current = slots.get(key) || []; current.push(task.id); slots.set(key,current);
    }
    if (closing && task.beforeClose && !task.completed) pendingCloseIds.push(task.id);
  }
  if (missingBedLabels.size > 0) {
    proposed.push(suggestion('bed:'+shiftId,'resolve-bed','Vincular cama antes de guardar',
      [...missingBedLabels].join(', ')+' no está asociada al turno.'));
  }
  if (missingDateIds.length) {
    proposed.push(suggestion('date:'+shiftId,'resolve-date','Confirmar fecha de las 15:00',
      'Hay tareas con hora definida, pero sin fecha confirmada.',missingDateIds));
  }
  for (const [slot, ids] of slots) {
    if (ids.length > 1) proposed.push(suggestion('slot:'+shiftId+':'+slot,'shared-slot',
      'Tareas con el mismo horario','Revisar juntas; esto no demuestra que estén duplicadas.',ids));
  }
  if (pendingCloseIds.length) {
    proposed.push(suggestion('close:'+shiftId,'before-close','Pendientes antes del cierre',
      'Hay una tarea sin completar que estaba prevista antes del cierre.',pendingCloseIds,'toast'));
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
  if (!['drafts_ready','note_saved','shift_close_attempt'].includes(event.type)) {
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
    return { status:'proposed', suggestions: inspectDrafts({
      shiftId: event.shiftId, drafts: snapshot.drafts,
      beds: snapshot.beds, closing: event.type === 'shift_close_attempt'
    }) };
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

  const key = normalizeTaskTitle(action.title);
  if (snapshot.tasks.some(t => t && !t.completed && typeof t.title === 'string' && normalizeTaskTitle(t.title) === key)) {
    return abstain('duplicate');
  }
  return { status:'proposed', noteId:note.id, noteVersion:note.version, suggestions:[Object.freeze({
    id:'note:'+note.id+':'+note.version, kind:'note-task', title:action.title, sourceQuote:action.sourceQuote,
    noteId:note.id, noteVersion:note.version, channel:'inline', actions:['review','dismiss'], requiresApproval:true,
  })] };
}
