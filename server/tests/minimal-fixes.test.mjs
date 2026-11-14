import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NOTE_GOALS } from '../eval/note-goals.mjs';
import { titleMeetsCaseRequirements, oracleClients, runNoteEval, strictPass, rejudge } from '../eval/run-note-eval.mjs';

// Literal expected values test the real evaluator, NOT language-model quality.
const criterion = terms => ({ expectTitleIncludes:['enviar'], requiredExactTerms:terms });
const literalCases = [
  ['correct name', 'Enviar inventario a Paola', ['Paola'], true],
  ['wrong final vowel', 'Enviar inventario a Paolo', ['Paola'], false],
  ['wrong internal vowel', 'Enviar inventario a Paula', ['Paola'], false],
  ['plural-like wrong name', 'Enviar inventario a Paolas', ['Paola'], false],
  ['name missing', 'Enviar inventario', ['Paola'], false],
  ['case and punctuation', 'ENVIAR inventario a PAOLA.', ['Paola'], true],
  ['NFC equivalent accent', 'Enviar archivo a Jose\u0301', ['José'], true],
  ['accent is not discarded', 'Enviar archivo a Jose', ['José'], false],
  ['exact room', 'Enviar kits a sala 3', ['sala 3'], true],
  ['different room', 'Enviar kits a sala 4', ['sala 3'], false],
  ['room number prefix', 'Enviar kits a sala 30', ['sala 3'], false],
  ['number elsewhere', 'Enviar 3 kits a sala 4', ['sala 3'], false],
  ['phrase order', 'Enviar 3 a sala', ['sala 3'], false],
  ['whitespace normalization', 'Enviar kits a SALA\u00a0 3.', ['sala 3'], true],
  ['exact product code', 'Enviar kit AB-12', ['AB-12'], true],
  ['code punctuation matters', 'Enviar kit AB/12', ['AB-12'], false],
  ['code digit suffix matters', 'Enviar kit AB-120', ['AB-12'], false],
  ['battery size', 'Enviar pilas AA', ['AA'], true],
  ['battery size suffix', 'Enviar pilas AAA', ['AA'], false],
  ['multiple exact terms', 'Enviar kits a Paola en sala 3', ['Paola','sala 3'], true],
  ['one exact term absent', 'Enviar kits a Paola', ['Paola','sala 3'], false],
  ['no exact constraints keeps legacy', 'Enviar kits', [], true],
  ['invalid criterion string', 'Enviar a Paola', 'Paola', false],
  ['empty exact term is not evidence', 'Enviar a Paola', [''], false],
];
for (const [name,title,terms,want] of literalCases) {
  test('M1: ' + name, () => assert.equal(titleMeetsCaseRequirements(title,criterion(terms)),want));
}

test('M1: published goals corpus protects Paola without test-only annotation', () => {
  const c=NOTE_GOALS.find(c=>c.id==='go-07');
  assert.equal(titleMeetsCaseRequirements('Corregir inventario semanal y enviarlo a Paolo',c),false);
  assert.equal(titleMeetsCaseRequirements(c.expectedTitle,c),true);
});

test('M1: one critical error must not hide behind the aggregate 5/6 goal', async () => {
  const clients=oracleClients(NOTE_GOALS);
  const original=clients.extractNoteProposal;
  clients.extractNoteProposal=async text => {
    const response=await original(text);
    if (text===NOTE_GOALS.find(c=>c.id==='go-07').text) response.action.title='Corregir inventario semanal y enviarlo a Paolo';
    return response;
  };
  const r=await runNoteEval({cases:NOTE_GOALS,clients,maxCalls:60});
  assert.equal(r.cases.find(c=>c.id==='go-07').pass,false);
  assert.equal(r.summary.usefulTitles.goalMet,true,'aggregate usefulness alone still passes');
  assert.equal(strictPass(r),false,'critical identity error must block the rubric gate');
  assert.equal(strictPass(rejudge(r,NOTE_GOALS)),false,'rejudging must not erase the critical error');
});

const cwd=fileURLToPath(new URL('../',import.meta.url));
function cli(args) {
  const result=spawnSync(process.execPath,['eval/run-note-eval.mjs',...args],{
    cwd,encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,env:{...process.env,TURNO_AI_ENABLED:'0'},
  });
  assert.equal(result.error,undefined);
  return {exit:result.status,report:JSON.parse(result.stdout)};
}
test('M2: old default reproduces truncation rather than pretending 56 cases ran', () => {
  const {exit,report}=cli(['--extended','--probe']);
  assert.equal(exit,0); // Existing default behaviour, not an approval.
  assert.equal(report.summary.cases,40);
  assert.equal(report.summary.expectedCases,56);
  assert.equal(report.aborted,'max_calls');
});
test('M2: 120 logical calls cover 56 cases while strict keeps ext-22 visible', () => {
  const {exit,report}=cli(['--extended','--probe','--mode','DECISION','--max-calls','120','--strict']);
  assert.equal(exit,1);
  assert.equal(report.summary.cases,56);
  assert.equal(report.aborted,null);
  assert.equal(report.summary.modelCalls.total,78);
  assert.deepEqual(report.cases.filter(c=>!c.pass).map(c=>c.id),['ext-22']);
});
test('M2: 350 logical calls cover three repetitions without concealing the old failure', () => {
  const {exit,report}=cli(['--extended','--probe','--mode','DECISION','--reps','3','--max-calls','350','--strict']);
  assert.equal(exit,1);
  assert.equal(report.summary.cases,168);
  assert.equal(report.aborted,null);
  assert.equal(report.summary.modelCalls.total,234);
  assert.deepEqual(report.cases.filter(c=>!c.pass).map(c=>c.id),['ext-22','ext-22','ext-22']);
});
test('M2: 20 correct oracle cases still pass the executable rubric gate', () => {
  const {exit,report}=cli(['--goals','--strict']);
  assert.equal(exit,0);
  assert.equal(report.summary.passed,20);
});
