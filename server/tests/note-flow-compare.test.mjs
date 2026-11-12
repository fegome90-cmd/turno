import test from 'node:test';
import assert from 'node:assert/strict';
import { KLM, manualFlow, proposalFlow, compareFlows, median } from '../eval/note-flow-compare.mjs';

test('operadores KLM de §3 (Card, Moran y Newell, 1980)', () => {
  assert.deepEqual({ ...KLM }, { K: 0.28, P: 1.1, B: 0.1, M: 1.35, H: 0.4 });
});

test('pasos: flujo manual 7 acciones, con propuesta 4', () => {
  assert.equal(manualFlow('Reponer guantes').steps, 7);
  assert.equal(proposalFlow().steps, 4);
});

test('tiempo: fórmula por operadores para un título de 10 caracteres', () => {
  const manual = manualFlow('x'.repeat(10)).seconds;
  const proposal = proposalFlow().seconds;
  assert.ok(Math.abs(manual - 17.15) < 1e-9, String(manual));
  assert.ok(Math.abs(proposal - 8.85) < 1e-9, String(proposal));
});

test('comparación: reducción por pasos y por tiempo, métrica registrada, meta de 20 %', () => {
  const r = compareFlows(['Reponer guantes talla M', 'Pedir formularios de traslado']);
  assert.equal(r.manual.medianSteps, 7);
  assert.equal(r.proposal.medianSteps, 4);
  assert.ok(Math.abs(r.reduction.steps - (1 - 4 / 7)) < 1e-3);
  assert.ok(r.reduction.seconds > 0.2);
  assert.equal(r.goalMet, true);
  assert.equal(r.primaryMetric, 'seconds');
  assert.equal(r.estimate, true);
  assert.match(r.method, /Card/);
});

test('sensibilidad: con clic = 2B (presionar y soltar) la reducción se recalcula', () => {
  const base = compareFlows(['Reponer guantes talla M']);
  const twoB = compareFlows(['Reponer guantes talla M'], { clickSeconds: 0.2 });
  assert.ok(twoB.manual.medianSeconds > base.manual.medianSeconds);
  assert.ok(twoB.proposal.medianSeconds > base.proposal.medianSeconds);
  // Clics: manual = 6 (Captura, campo, Pasar, lista x2, Aprobar); con revisión = 4 (Revisar, lista x2, Aprobar).
  assert.ok(Math.abs(twoB.manual.medianSeconds - base.manual.medianSeconds - 0.1 * 6) < 1e-9);
  assert.ok(Math.abs(twoB.proposal.medianSeconds - base.proposal.medianSeconds - 0.1 * 4) < 1e-9);
});

test('mediana y lista vacía', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.throws(() => compareFlows([]), /títulos/);
});
