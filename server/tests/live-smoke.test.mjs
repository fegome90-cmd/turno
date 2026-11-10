import test from 'node:test';
import assert from 'node:assert/strict';
import { FIXTURE, evaluateSyntheticReview } from '../live-smoke.mjs';

const fixtureProposals = [
  {title:'Revisar tarea pendiente A',time:'15:00',bedLabel:'Cama 4',bedId:null,date:null,status:'requires_human_review',beforeClose:false,reviewFlags:['resolve_bed','confirm_date']},
  {title:'Revisar tarea pendiente B',time:'15:00',bedLabel:'Cama 4',bedId:null,date:null,status:'requires_human_review',beforeClose:false,reviewFlags:['resolve_bed','confirm_date']},
  {title:'Completar informe',time:null,bedLabel:null,bedId:null,date:null,status:'requires_human_review',beforeClose:true,reviewFlags:[]},
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

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../live-smoke.mjs', import.meta.url));
const isolatedEnv = {PATH: process.env.PATH || '', HOME: process.env.HOME || '', LANG:'C'};

test('preflight ejecutable no consume API ni requiere credenciales', () => {
  const p=spawnSync(process.execPath,[scriptPath,'--preflight'],{
    cwd:fileURLToPath(new URL('..', import.meta.url)), env:isolatedEnv,
    encoding:'utf8', timeout:10000,
  });
  assert.equal(p.status,0,p.stderr);
  const report=JSON.parse(p.stdout);
  assert.equal(report.requests,0);
  assert.equal(report.localSdkWiring,'PASS');
  assert.equal(report.remoteModelVerified,false);
  assert.equal(report.credentialsChecked,false);
  assert.equal(report.verdict,'OFFLINE_CHECKS_ONLY');
  assert.equal('ready' in report,false);

});

test('live sin credenciales falla cerrado antes de hacer una petición', () => {
  const p=spawnSync(process.execPath,[scriptPath,'--live','--from-env'],{
    cwd:fileURLToPath(new URL('..', import.meta.url)), env:isolatedEnv,
    encoding:'utf8', timeout:10000,
  });
  assert.equal(p.status,2,p.stderr);
  assert.match(p.stderr,/No hay credencial disponible/);
  assert.equal(p.stdout.trim(),'');
});

test('live requiere argumentos explícitos para habilitar inferencia', () => {
  const p=spawnSync(process.execPath,[scriptPath,'--live'],{
    cwd:fileURLToPath(new URL('..', import.meta.url)), env:isolatedEnv,
    encoding:'utf8', timeout:10000,
  });
  assert.equal(p.status,2);
  assert.match(p.stderr,/Uso:/);
});

test('rechaza una cama inventada para el informe', () => {
  const bad = structuredClone(fixtureProposals);
  bad[2].bedLabel='Cama 8';
  assert.equal(evaluateSyntheticReview({proposals:bad}).closeCorrect,false);
});

test('rechaza revisión incompleta aunque los títulos coincidan', () => {
  const bad = structuredClone(fixtureProposals);
  bad[0].reviewFlags=['confirm_date'];
  bad[1].beforeClose=true;
  const result=evaluateSyntheticReview({proposals:bad});
  assert.equal(result.aCorrect,false);
  assert.equal(result.bCorrect,false);
});
