import { assertSyntheticEvent } from './gateway-config.mjs';
import { classifySignal } from './decision-switch.mjs';

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
}) {
  if (!settings || !settings.enabled) return { status:'disabled', suggestions:[] };
  assertSyntheticEvent(event, settings);
  if (!['drafts_ready','note_saved','shift_close_attempt'].includes(event.type)) {
    throw new Error('Tipo de evento no autorizado.');
  }
  if (typeof isAuthorized !== 'function' || typeof getAuthorizedSnapshot !== 'function') {
    throw new Error('Faltan callbacks de autenticación y lectura del backend.');
  }
  if (await isAuthorized(event) !== true) throw new Error('Acceso no autorizado.');
  const snapshot = await getAuthorizedSnapshot(event);
  if (!snapshot || snapshot.shiftId !== event.shiftId) throw new Error('Snapshot ajeno al turno.');
  if (event.type !== 'note_saved') {
    return { status:'proposed', suggestions: inspectDrafts({
      shiftId: event.shiftId, drafts: snapshot.drafts,
      beds: snapshot.beds, closing: event.type === 'shift_close_attempt'
    }) };
  }
  const text = snapshot.noteText;
  if (typeof text !== 'string' || text.length < 1 || text.length > 500) {
    return { status:'abstain', suggestions:[] };
  }
  const classification = await classifySignal({
    event: { id:event.id, text, synthetic:true },
    mode: settings.decisionMode, classifyWithGateway, classifyWithDecision, recordComparison,
  });
  if (classification.status !== 'candidate') return { status:'abstain', suggestions:[] };
  return { status:'proposed', suggestions:[suggestion(
    'note:'+event.id,'semantic-note','Revisar posible tarea o recordatorio',
    'La nota parece contener una acción pendiente. Revisa antes de guardar.',[], 'inbox'
  )] };
}
