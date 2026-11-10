import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, evaluateSyntheticReview } from '../live-smoke.mjs';

const fixtureProposals = [
  {title:'Revisar tarea pendiente A',time:'15:00',bedLabel:'Cama 4',bedId:null,date:null,status:'requires_human_review',beforeClose:false},
  {title:'Revisar tarea pendiente B',time:'15:00',bedLabel:'Cama 4',bedId:null,date:null,status:'requires_human_review',beforeClose:false},
  {title:'Completar informe',time:null,bedLabel:null,bedId:null,date:null,status:'requires_human_review',beforeClose:true},
];

test('la prueba LIVE usa exactamente el texto sintético aprobado', () => {
  assert.equal(FIXTURE.synthetic, true);
  assert.equal(FIXTURE.shiftId,'demo-shift');
  assert.ok(FIXTURE.text.includes('Revisar tarea pendiente A'));
  assert.ok(FIXTURE.text.includes('Completar informe'));
  assert.equal(Object.isFrozen(FIXTURE),true);
});

test('criterio de aceptación identifica las tres tareas', () => {
  assert.ok(Object.values(evaluateSyntheticReview({proposals:fixtureProposals})).every(Boolean));
});

test('detecta tareas omitidas y fechas inventadas', () => {
  assert.equal(evaluateSyntheticReview({proposals:fixtureProposals.slice(0,2)}).exactlyThree,false);
  const bad = structuredClone(fixtureProposals);
  bad[0].date = '2026-11-10';
  assert.equal(evaluateSyntheticReview({proposals:bad}).aCorrect,false);
});

test('detecta aprobación faltante y hora ficticia de cierre', () => {
  const bad = structuredClone(fixtureProposals);
  bad[1].status='saved';
  bad[2].time='19:30';
  const r=evaluateSyntheticReview({proposals:bad});
  assert.equal(r.allNeedHumanReview,false);
  assert.equal(r.closeCorrect,false);
});
