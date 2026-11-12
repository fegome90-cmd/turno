import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';

const settings = { enabled: true, syntheticOnly: true, decisionMode: 'GATEWAY' };
const isAuthorized = async () => true;
const noteSnapshot = (overrides = {}) => ({
  shiftId: 'shift-1', synthetic: true, beds: [], drafts: [],
  notes: [{ id: 'note-1', version: 2, text: 'Falta reponer guantes sintéticos.' }],
  tasks: [{ id: 'task-1', title: 'Revisar informe sintético', completed: false }],
  ...overrides,
});
const noteEvent = { id: 'event-n1', type: 'note_saved', shiftId: 'shift-1', synthetic: true, noteId: 'note-1', noteVersion: 2 };
const proposal = { action: { title: 'Reponer guantes sintéticos', sourceQuote: 'Falta reponer guantes sintéticos' } };

function run({ event = noteEvent, snapshot = noteSnapshot(), gateway = async () => ({ label: 'PROPOSE_TASK' }),
  decision, extract = async () => proposal, ...rest } = {}) {
  const calls = { gateway: 0, decision: 0, extract: 0 };
  const records = [];
  const marks = [];
  const promise = analyzeAmbientEvent({
    event, settings, isAuthorized, getAuthorizedSnapshot: async () => snapshot,
    classifyWithGateway: async (input, options) => { calls.gateway++; return gateway(input, options); },
    classifyWithDecision: async (input, options) => { calls.decision++; return decision ? decision(input, options) : { label: 'NO_ACTION', confidence: 1 }; },
    extractNoteProposal: async (text, options) => { calls.extract++; return extract(text, options); },
    onMetrics: record => records.push(record),
    markProcessed: (noteId, version) => marks.push([noteId, version]),
    ...rest,
  });
  return { promise, calls, records, marks };
}

test('nota propuesta: una sola sugerencia inline con trazabilidad exacta', async () => {
  const { promise, calls } = run();
  assert.deepEqual(await promise, {
    status: 'proposed', noteId: 'note-1', noteVersion: 2,
    suggestions: [{
      id: 'note:note-1:2', kind: 'note-task', title: 'Reponer guantes sintéticos',
      sourceQuote: 'Falta reponer guantes sintéticos', noteId: 'note-1', noteVersion: 2,
      channel: 'inline', actions: ['review', 'dismiss'], requiresApproval: true,
    }],
  });
  assert.deepEqual(calls, { gateway: 1, decision: 0, extract: 1 });
});

test('nota inexistente: abstención sin modelo', async () => {
  const { promise, calls } = run({ event: { ...noteEvent, noteId: 'otra' } });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'note_not_found', suggestions: [] });
  assert.deepEqual(calls, { gateway: 0, decision: 0, extract: 0 });
});

test('versión distinta de la confirmada: stale sin modelo', async () => {
  const { promise, calls } = run({ event: { ...noteEvent, noteVersion: 1 } });
  assert.deepEqual(await promise, { status: 'stale', reason: 'stale_version', suggestions: [] });
  assert.deepEqual(calls, { gateway: 0, decision: 0, extract: 0 });
});

for (const [name, text] of [['vacía', ''], ['solo espacios', '  \n\t '], ['de 501 caracteres', 'a'.repeat(501)]]) {
  test(`nota ${name}: abstención antes del modelo`, async () => {
    const { promise, calls } = run({ snapshot: noteSnapshot({ notes: [{ id: 'note-1', version: 2, text }] }) });
    const reason = text.trim() === '' ? 'empty' : 'too_long';
    assert.deepEqual(await promise, { status: 'abstain', reason, suggestions: [] });
    assert.deepEqual(calls, { gateway: 0, decision: 0, extract: 0 });
  });
}

test('nota de exactamente 500 caracteres sí se clasifica', async () => {
  const { promise } = run({ snapshot: noteSnapshot({ notes: [{ id: 'note-1', version: 2, text: 'a'.repeat(500) }] }),
    extract: async () => ({ action: null }) });
  assert.equal((await promise).reason, 'no_proposal');
});

test('mismo noteId y versión ya procesados: already_processed sin modelo', async () => {
  const seen = [];
  const { promise, calls } = run({ alreadyProcessed: (noteId, version) => { seen.push([noteId, version]); return true; } });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'already_processed', suggestions: [] });
  assert.deepEqual(seen, [['note-1', 2]]);
  assert.deepEqual(calls, { gateway: 0, decision: 0, extract: 0 });
});

test('la nota se marca como procesada una sola vez antes de clasificar', async () => {
  const { promise, marks } = run();
  await promise;
  assert.deepEqual(marks, [['note-1', 2]]);
});

for (const [label, expected] of [['NO_ACTION', 'label_NO_ACTION'], ['PROPOSE_REMINDER', 'label_PROPOSE_REMINDER'], ['NEEDS_REVIEW', 'label_NEEDS_REVIEW']]) {
  test(`la etiqueta ${label} se abstiene y no pide extracción`, async () => {
    const { promise, calls, records } = run({ gateway: async () => ({ label }) });
    assert.deepEqual(await promise, { status: 'abstain', reason: expected, suggestions: [] });
    assert.equal(calls.extract, 0);
    assert.equal(records[0].outcome, expected);
  });
}

test('el clasificador que falla se abstiene (classifier_failed) y no pide extracción', async () => {
  const { promise, calls } = run({ gateway: async () => { throw new Error('red caída'); } });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'classifier_failed', suggestions: [] });
  assert.equal(calls.extract, 0);
});

test('sin propuesta válida (cero acciones o cita inválida): silencio', async () => {
  for (const extract of [async () => ({ action: null }), async () => ({ action: { title: 'Reponer', sourceQuote: 'no está en la nota' } })]) {
    const { promise } = run({ extract });
    assert.deepEqual(await promise, { status: 'abstain', reason: 'no_proposal', suggestions: [] });
  }
});

test('error del extractor: abstención cerrada, sin texto en la respuesta', async () => {
  const { promise, records } = run({ extract: async () => { throw new Error('texto de la nota: guantes'); } });
  const result = await promise;
  assert.deepEqual(result, { status: 'abstain', reason: 'extraction_failed', suggestions: [] });
  assert.equal(JSON.stringify(records).includes('guantes'), false);
});

for (const [name, title] of [['mayúsculas y espacios internos', 'Reponer   GUANTES   sintéticos'], ['espacios al borde', '  Reponer guantes sintéticos ']]) {
  test(`tarea abierta ya presente (${name}): abstención duplicada`, async () => {
    const snapshot = noteSnapshot({ tasks: [{ id: 't', title, completed: false }] });
    const { promise } = run({ snapshot, extract: async () => ({ action: { title: 'Reponer guantes sintéticos', sourceQuote: 'Falta reponer guantes sintéticos' } }) });
    assert.deepEqual(await promise, { status: 'abstain', reason: 'duplicate', suggestions: [] });
  });
}

test('comparación de duplicados: NFC y acentos equivalentes cuentan como iguales', async () => {
  const snapshot = noteSnapshot({ tasks: [{ id: 't', title: 'Reponer guantes sintéticos', completed: false }] });
  const { promise } = run({ snapshot });
  assert.equal((await promise).reason, 'duplicate');
});

test('una tarea completada no bloquea la propuesta', async () => {
  const snapshot = noteSnapshot({ tasks: [{ id: 't', title: 'Reponer guantes sintéticos', completed: true }] });
  const { promise } = run({ snapshot });
  assert.equal((await promise).status, 'proposed');
});

test('métricas: un registro por nota, sin texto, títulos ni citas', async () => {
  const { promise, records } = run();
  await promise;
  assert.equal(records.length, 1);
  assert.deepEqual(Object.keys(records[0]).sort(), ['durationMs', 'eligible', 'eventId', 'haikuCalled', 'jevCalled', 'outcome']);
  assert.deepEqual({ ...records[0], durationMs: 0 }, { eventId: 'event-n1', eligible: true, jevCalled: true, haikuCalled: true, outcome: 'proposed', durationMs: 0 });
  const serialized = JSON.stringify(records);
  for (const forbidden of ['guantes', 'sintétic', 'Reponer', 'Falta', 'Revisar']) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test('métricas en abstenciones previas al modelo: eligible=false y sin llamadas', async () => {
  const { promise, records } = run({ event: { ...noteEvent, noteVersion: 9 } });
  await promise;
  assert.deepEqual({ ...records[0], durationMs: 0 }, { eventId: 'event-n1', eligible: false, jevCalled: false, haikuCalled: false, outcome: 'stale_version', durationMs: 0 });
});

test('la nota sin noteId o versión válidos se rechaza como evento no autorizado', async () => {
  await assert.rejects(run({ event: { ...noteEvent, noteVersion: 0 } }).promise, /Evento de nota inválido/);
  await assert.rejects(run({ event: { ...noteEvent, noteId: undefined } }).promise, /Evento de nota inválido/);
});

test('el snapshot sin notas o tareas válidas falla cerrado', async () => {
  await assert.rejects(run({ snapshot: noteSnapshot({ tasks: undefined }) }).promise, /Snapshot de turno inválido/);
});

test('P1-02: "en la sala 2" con tarea abierta "Reponer guantes talla M" se propone (detalle distinto, no duplicado)', async () => {
  const text = 'Falta reponer guantes talla M en la sala 2.';
  const snapshot = noteSnapshot({ notes: [{ id: 'note-1', version: 2, text }], tasks: [{ id: 't', title: 'Reponer guantes talla M', completed: false }] });
  const { promise } = run({ snapshot, extract: async () => ({ action: { title: 'Reponer guantes talla M en la sala 2', sourceQuote: 'reponer guantes talla M en la sala 2' } }) });
  const result = await promise;
  assert.equal(result.status, 'proposed');
  assert.equal(result.suggestions[0].title, 'Reponer guantes talla M en la sala 2');
});

test('P1-02: el mismo conjunto de palabras con la tarea abierta se abstiene como duplicado', async () => {
  const text = 'Falta reponer guantes talla M.';
  const snapshot = noteSnapshot({ notes: [{ id: 'note-1', version: 2, text }], tasks: [{ id: 't', title: 'Reponer guantes talla M', completed: false }] });
  const { promise } = run({ snapshot, extract: async () => ({ action: { title: 'Reponer guantes talla M', sourceQuote: 'reponer guantes talla M' } }) });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'duplicate', suggestions: [] });
});

test('R5c-FIX: otra talla con la misma tarea abierta sigue proponiéndose', async () => {
  const text = 'Falta reponer guantes talla L en la sala 2.';
  const snapshot = noteSnapshot({ notes: [{ id: 'note-1', version: 2, text }], tasks: [{ id: 't', title: 'Reponer guantes talla M', completed: false }] });
  const { promise } = run({ snapshot, extract: async () => ({ action: { title: 'Reponer guantes talla L', sourceQuote: 'reponer guantes talla L en la sala 2' } }) });
  const result = await promise;
  assert.equal(result.status, 'proposed');
  assert.equal(result.suggestions[0].title, 'Reponer guantes talla L');
});

// P1-03: marca de procesado. Decidido = se mantiene; fallo, excepción o cancelación = releaseProcessed.
const releasing = () => { const released = []; return { released, releaseProcessed: (noteId, version) => released.push([noteId, version]) }; };

test('P1-03: clasificador activo que lanza → classifier_failed y libera la marca', async () => {
  const { released, releaseProcessed } = releasing();
  const { promise } = run({ gateway: async () => { throw new Error('red'); }, releaseProcessed });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'classifier_failed', suggestions: [] });
  assert.deepEqual(released, [['note-1', 2]]);
});

test('P1-03: extractor que lanza → extraction_failed y libera la marca', async () => {
  const { released, releaseProcessed } = releasing();
  const { promise } = run({ extract: async () => { throw new Error('fallo'); }, releaseProcessed });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'extraction_failed', suggestions: [] });
  assert.deepEqual(released, [['note-1', 2]]);
});

test('P1-03: excepción inesperada después de marcar → libera la marca y relanza', async () => {
  const { released, releaseProcessed } = releasing();
  const { promise } = run({ settings: { ...settings, decisionMinConfidence: 2 }, releaseProcessed });
  await assert.rejects(promise, /Umbral de confianza inválido/);
  assert.deepEqual(released, [['note-1', 2]]);
});

test('P1-03: cancelación durante la extracción → cancelled, libera la marca y el extractor recibe la señal', async () => {
  const { released, releaseProcessed } = releasing();
  const controller = new AbortController();
  let received;
  const { promise } = run({ signal: controller.signal, releaseProcessed,
    extract: async (text, options) => { received = options?.signal; controller.abort(); return proposal; } });
  assert.deepEqual(await promise, { status: 'abstain', reason: 'cancelled', suggestions: [] });
  assert.equal(received, controller.signal);
  assert.deepEqual(released, [['note-1', 2]]);
});

for (const [name, opts, reason] of [
  ['propuesta', {}, 'proposed'],
  ['etiqueta NO_ACTION', { gateway: async () => ({ label: 'NO_ACTION' }) }, 'label_NO_ACTION'],
  ['baja confianza (no es fallo)', { decision: () => ({ label: 'PROPOSE_TASK', confidence: 0.1 }), settings: { ...settings, decisionMode: 'DECISION' } }, 'classifier_abstain'],
  ['sin propuesta válida', { extract: async () => ({ action: null }) }, 'no_proposal'],
  ['duplicado', { snapshot: noteSnapshot({ notes: [{ id: 'note-1', version: 2, text: 'Falta reponer guantes sintéticos.' }], tasks: [{ id: 't', title: 'Reponer guantes sintéticos', completed: false }] }) }, 'duplicate'],
  ['extracción no disponible', { extractNoteProposal: undefined }, 'extraction_unavailable'],
]) {
  test(`P1-03: decisión ${name} conserva la marca (no se libera)`, async () => {
    const { released, releaseProcessed } = releasing();
    const { promise } = run({ ...opts, releaseProcessed });
    const result = await promise;
    assert.equal(result.reason ?? result.status, reason);
    assert.deepEqual(released, []);
  });
}
