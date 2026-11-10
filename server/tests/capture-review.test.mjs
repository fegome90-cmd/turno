import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCaptureReview, proposalsForReview, validateCaptureInput } from '../capture-review.mjs';

const input = {
  shiftId: 'demo-shift',
  synthetic: true,
  text: 'Revisar tarea pendiente A (15:00, cama 4); Revisar tarea pendiente B (15:00, cama 4); Completar informe (antes del cierre)',
};
const raw = { proposals: [
  {title:'Revisar tarea pendiente A',bedLabel:'Cama 4',time:'15:00',beforeClose:false},
  {title:'Revisar tarea pendiente B',bedLabel:'Cama 4',time:'15:00',beforeClose:false},
  {title:'Completar informe',bedLabel:null,time:null,beforeClose:true},
]};

test('tres tareas quedan en revisión; ninguna tiene fecha inventada', async () => {
  const output = await prepareCaptureReview(input, { invoke: async () => raw, beds:[{id:'bed-1',label:'Cama 1'}] });
  assert.equal(output.status,'review_required');
  assert.equal(output.proposals.length,3);
  assert.ok(output.proposals.every(x=>x.status==='requires_human_review' && x.date===null));
  assert.deepEqual(output.proposals[0].reviewFlags,['resolve_bed','confirm_date']);
  assert.equal(output.proposals[2].beforeClose,true);
  assert.equal(output.proposals[2].time,null);
  assert.equal(Object.keys(output.proposals[0]).includes('save'),false);
});

test('vincula la cama solo cuando hay coincidencia única', () => {
  assert.equal(proposalsForReview(raw,{beds:[{id:'b4',label:'Cama 4'}]})[0].bedId,'b4');
  assert.equal(proposalsForReview(raw,{beds:[{id:'a',label:'Cama 4'},{id:'b',label:'Cama 4'}]})[0].bedId,null);
});

test('no acepta datos reales ni datos malformados', () => {
  assert.throws(()=>validateCaptureInput({...input,synthetic:false}),/sintéticos/);
  assert.throws(()=>validateCaptureInput({...input,text:''}),/Captura/);
  assert.throws(()=>validateCaptureInput({...input,shiftId:'../x'}),/shiftId/);
});

test('no acepta inventar hora para cierre ni tiempos inválidos', () => {
  assert.throws(()=>proposalsForReview({proposals:[{title:'Informe',bedLabel:null,time:'18:00',beforeClose:true}]}),/antes del cierre/);
  assert.throws(()=>proposalsForReview({proposals:[{title:'A',bedLabel:null,time:'25:00',beforeClose:false}]}),/Horario/);
});

test('sin invocador, no intenta guardar ni ejecutar', async () => {
  await assert.rejects(prepareCaptureReview(input,{}),/Strands/);
});

import { assertUsableStructuredOutput } from '../gateway-capture.mjs';

test('Strands: acepta toolUse con salida estructurada completada', () => {
  const parsed={ proposals: [] };
  assert.equal(assertUsableStructuredOutput({stopReason:'toolUse',structuredOutput:parsed}),parsed);
});

test('Strands: descarta salidas incompletas aunque vengan con JSON parcial', () => {
  const partial={ proposals: [] };
  for (const stopReason of [
    'cancelled','limitTurns','limitTotalTokens','limitOutputTokens',
    'limitStructuredOutputAttempts','contentFiltered','guardrailIntervened',
    'refusal','interrupt','checkpoint','unknown',
  ]) {
    assert.throws(
      () => assertUsableStructuredOutput({stopReason,structuredOutput:partial}),
      /no completó/,
      stopReason,
    );
  }
  assert.throws(
    () => assertUsableStructuredOutput({stopReason:'toolUse',structuredOutput:undefined}),
    /no completó/,
  );
});
