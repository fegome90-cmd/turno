import test from 'node:test';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { NOTE_CORPUS, NOTE_HOLDOUT, NOTE_GROUP_COUNTS, NOTE_TEXT_MAX } from '../eval/note-corpus.mjs';
import { parseNoteArgs, resolveNoteSettings, oracleClients, runNoteEval, checkBalance, main, judgeCase } from '../eval/run-note-eval.mjs';
import * as evalRun from '../eval/run-note-eval.mjs';

const noSpawnFetch = () => { throw new Error('fetch must not be called offline'); };

test('corpus: 18 casos sintéticos con la distribución de §18', () => {
  assert.equal(NOTE_CORPUS.length, 18);
  const counts = {};
  for (const c of NOTE_CORPUS) counts[c.group] = (counts[c.group] ?? 0) + 1;
  assert.deepEqual(counts, NOTE_GROUP_COUNTS);
  assert.deepEqual(NOTE_GROUP_COUNTS, { task: 6, descriptive: 4, conditional: 2, duplicate: 2, reminder: 1, injection: 1, stale: 1, unauthorized: 1 });
  assert.equal(new Set(NOTE_CORPUS.map(c => c.id)).size, 18);
  assert.equal(new Set(NOTE_CORPUS.map(c => c.text)).size, 18, 'textos únicos');
  for (const c of NOTE_CORPUS) {
    assert.ok(c.text.length >= 1 && c.text.length <= NOTE_TEXT_MAX && c.text === c.text.trim(), c.id);
    assert.ok(['proposed', 'abstain', 'stale', 'rejected'].includes(c.expect), c.id);
    if (c.group === 'unauthorized') assert.equal(c.synthetic, false, c.id);
    else assert.notEqual(c.synthetic, false, c.id);
  }
});

test('corpus: los casos de tarea tienen título esperado y palabras clave en minúscula', () => {
  const tasks = NOTE_CORPUS.filter(c => c.group === 'task');
  for (const c of tasks) {
    assert.equal(c.expect, 'proposed', c.id);
    assert.ok(Array.isArray(c.expectTitleIncludes) && c.expectTitleIncludes.length >= 1 && c.expectTitleIncludes.length <= 2, c.id);
    for (const w of c.expectTitleIncludes) {
      assert.equal(w, w.toLocaleLowerCase('es'), c.id);
      assert.ok(c.expectedTitle.toLocaleLowerCase('es').includes(w), c.id);
    }
    assert.ok(c.oracleTitle === c.expectedTitle && c.oracleLabel === 'PROPOSE_TASK', c.id);
  }
});

test('corpus: duplicados traen la tarea abierta exacta en la instantánea; el recordatorio espera 0 propuestas', () => {
  for (const c of NOTE_CORPUS.filter(x => x.group === 'duplicate')) {
    assert.equal(c.expect, 'abstain', c.id);
    assert.equal(c.snapshotTasks.length, 1, c.id);
    assert.equal(c.snapshotTasks[0].title, c.oracleTitle, c.id);
    assert.equal(c.snapshotTasks[0].completed, false, c.id);
  }
  const rem = NOTE_CORPUS.find(c => c.group === 'reminder');
  assert.equal(rem.expect, 'abstain');
  assert.match(rem.text, /Recuérdame/);
});

test('harness offline con oráculo: veredictos correctos por grupo, sin propuestas fuera de tarea', async () => {
  const report = await runNoteEval({ mode: 'DECISION', clients: oracleClients(NOTE_CORPUS), fetchImpl: noSpawnFetch });
  const byId = Object.fromEntries(report.cases.map(r => [r.id, r]));
  assert.equal(report.cases.length, 18);
  assert.equal(report.run, 'offline');
  assert.equal(report.summary.byGroup.task.passed, 6);
  assert.equal(report.summary.usefulTitles.useful, 6);
  assert.equal(report.summary.usefulTitles.of, 6);
  for (const g of ['descriptive', 'conditional', 'duplicate', 'reminder', 'injection']) {
    assert.equal(report.summary.byGroup[g].passed, report.summary.byGroup[g].total, g);
  }
  assert.equal(report.summary.nonTaskProposals.length, 0);
  assert.equal(byId['dup-01'].reason, 'duplicate');
  assert.equal(byId['rem-01'].reason, 'label_PROPOSE_REMINDER');
  assert.equal(report.summary.mutations, 0);
  assert.equal(report.summary.passed, 18);
  assert.equal(report.summary.byGroup.task.passRate, 1);
});

test('stale y no autorizado: cero llamadas al modelo', async () => {
  const report = await runNoteEval({ mode: 'DECISION', clients: oracleClients(NOTE_CORPUS), fetchImpl: noSpawnFetch });
  for (const id of ['stale-01', 'unauth-01']) {
    const r = report.cases.find(x => x.id === id);
    assert.equal(r.pass, true, id);
    assert.deepEqual(r.modelCalls, { decision: 0, gateway: 0, extract: 0 }, id);
  }
  assert.equal(report.cases.find(x => x.id === 'stale-01').status, 'stale');
  assert.equal(report.cases.find(x => x.id === 'unauth-01').status, 'rejected');
});

test('GATEWAY con oráculo: mismo veredicto sin llamadas a Jev', async () => {
  const report = await runNoteEval({ mode: 'GATEWAY', clients: oracleClients(NOTE_CORPUS), fetchImpl: noSpawnFetch });
  assert.equal(report.summary.passed, 18);
  assert.equal(report.summary.modelCalls.decision, 0);
  assert.ok(report.summary.modelCalls.gateway > 0);
});

test('una propuesta con hora inventada no cuenta como título útil', async () => {
  const base = oracleClients(NOTE_CORPUS);
  const clients = { ...base, extractNoteProposal: async text => ({ action: { title: 'Reponer guantes a las 16:00', sourceQuote: text } }) };
  const report = await runNoteEval({ mode: 'DECISION', clients, cases: NOTE_CORPUS.filter(c => c.group === 'task') });
  assert.equal(report.summary.usefulTitles.useful, 0);
  assert.equal(report.summary.byGroup.task.passed, 0);
  assert.equal(report.summary.goalMet, false);
});

test('límite de llamadas: parada dura, nunca supera --max-calls', async () => {
  const report = await runNoteEval({ mode: 'DECISION', clients: oracleClients(NOTE_CORPUS), maxCalls: 3 });
  assert.equal(report.summary.aborted, 'max_calls');
  assert.ok(report.summary.modelCalls.total <= 3, String(report.summary.modelCalls.total));
  assert.ok(report.cases.length < 18);
  assert.ok(report.cases.some(c => c.errorType === 'max_calls'));
});

test('argumentos: valores por defecto y validación', () => {
  const d = parseNoteArgs([]);
  assert.deepEqual({ live: d.live, mode: d.mode, maxCalls: d.maxCalls, minBalance: d.minBalance, reps: d.reps, paceMs: d.paceMs },
    { live: false, mode: 'DECISION', maxCalls: 60, minBalance: 5, reps: 1, paceMs: null });
  assert.equal(parseNoteArgs(['--live', '--mode', 'DUAL', '--max-calls', '20', '--pace-ms', '0', '--min-balance', '2', '--reps', '2']).mode, 'DUAL');
  assert.throws(() => parseNoteArgs(['--mode', 'OTRO']), /mode/);
  assert.throws(() => parseNoteArgs(['--reps', '11']), /reps/);
  assert.throws(() => parseNoteArgs(['--max-calls', '0']), /max-calls/);
  assert.throws(() => parseNoteArgs(['--x']), /desconocido/);
});

test('--live se niega sin TURNO_AI_ENABLED=1 y no toca la red', async () => {
  const lines = [];
  const code = await main(['--live'], { env: {}, fetchImpl: noSpawnFetch, log: l => lines.push(l), out: l => lines.push(l) });
  assert.equal(code, 2);
  assert.match(lines.join('\n'), /TURNO_AI_ENABLED/);
});

test('saldo: aborta con respuesta no 200, saldo bajo o respuesta inválida; no envía clave si no existe', async () => {
  const fake = (status, body, seen) => async (url, init) => { seen?.push({ url, init }); return { ok: status === 200, status, json: async () => body }; };
  await assert.rejects(checkBalance({ env: {}, minBalance: 5, fetchImpl: fake(500, {}) }), /saldo/);
  await assert.rejects(checkBalance({ env: {}, minBalance: 5, fetchImpl: fake(200, { balance: '2.5' }) }), /saldo/);
  await assert.rejects(checkBalance({ env: {}, minBalance: 5, fetchImpl: fake(200, { balance: 'nan' }) }), /saldo/);
  const seen = [];
  assert.equal(await checkBalance({ env: {}, minBalance: 5, fetchImpl: fake(200, { balance: '12.5' }, seen) }), 12.5);
  assert.equal(seen[0].url, 'https://ai-gateway.vercel.sh/v1/credits');
  assert.equal(seen[0].init.headers.Authorization, undefined);
  const seen2 = [];
  await checkBalance({ env: { AI_GATEWAY_API_KEY: 'x'.repeat(8) }, minBalance: 1, fetchImpl: fake(200, { balance: '9' }, seen2) });
  assert.equal(seen2[0].init.headers.Authorization, 'Bearer ' + 'x'.repeat(8));
});

test('configuración: fuerza el modo elegido y no depende del entorno en modo offline', () => {
  const s = resolveNoteSettings({ env: { TURNO_AI_ENABLED: '1', TURNO_DECISION_MODE: 'GATEWAY' }, mode: 'DECISION', offline: true });
  assert.equal(s.decisionMode, 'DECISION');
  assert.equal(s.enabled, true);
  assert.equal(s.syntheticOnly, true);
});

test('main offline: imprime resumen y no escribe archivos', async () => {
  const lines = [];
  const code = await main([], { env: {}, fetchImpl: noSpawnFetch, log: () => {}, out: l => lines.push(l) });
  assert.equal(code, 0);
  const printed = JSON.parse(lines.join('\n'));
  assert.equal(printed.summary.run, 'offline');
  assert.equal(printed.summary.passed, 18);
});

test('P6b: live con red sintética mantiene guard de saldo pero no publica balance', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r5c-'));
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    if (url.endsWith('/v1/credits')) return { ok: true, status: 200, json: async () => ({ balance: '40' }) };
    if (url.endsWith('/v1/models')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 'anthropic/claude-haiku-5.5', pricing: { input: '0.000001', output: '0.000005' } }] }) };
    throw new Error('red no permitida en la prueba');
  };
  const lines = [];
  try {
    const code = await main(['--live', '--min-balance', '5'], {
      env: { TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'placeholder-not-a-secret-key-1234' },
      fetchImpl, clients: oracleClients(NOTE_CORPUS), resultsDir: dir, sleep: async () => {},
      now: () => new Date('2026-11-12T12:00:00Z'), log: () => {}, out: l => lines.push(l),
    });
    assert.equal(code, 0);
    assert.equal(urls[0], 'https://ai-gateway.vercel.sh/v1/credits');
    assert.ok(urls.every(u => u.endsWith('/v1/credits') || u.endsWith('/v1/models')));
    assert.equal(existsSync(join(dir, 'r5-note-DECISION-2026-11-12.json')), true);
    const printed = JSON.parse(lines.join('\n'));
    assert.equal(printed.summary.run, 'live');
    assert.equal(printed.summary.balance, null);
    assert.equal(urls.filter(url => url.endsWith('/v1/credits')).length, 1, 'solo lee saldo antes de enviar');
    const report = JSON.parse(readFileSync(join(dir, 'r5-note-DECISION-2026-11-12.json'), 'utf8'));
    assert.equal(report.summary.balance, null);
    assert.equal(printed.summary.passed, 18);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('live: saldo bajo detiene antes de crear clientes ni escribir informe', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r5c-'));
  const urls = [];
  try {
    const code = await main(['--live'], {
      env: { TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'placeholder-not-a-secret-key-1234' },
      fetchImpl: async url => { urls.push(url); return { ok: true, status: 200, json: async () => ({ balance: '1' }) }; },
      resultsDir: dir, log: () => {}, out: () => {},
    });
    assert.equal(code, 1);
    assert.deepEqual(urls, ['https://ai-gateway.vercel.sh/v1/credits'], 'solo el saldo; ningún modelo ni precio');
    assert.equal(existsSync(join(dir, 'r5-note-DECISION-2026-11-12.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('holdout: 4 casos sintéticos, ids y textos únicos entre ambos conjuntos, misma forma', () => {
  assert.equal(NOTE_CORPUS.length, 18, 'el corpus principal no cambia');
  assert.equal(NOTE_HOLDOUT.length, 4);
  const all = [...NOTE_CORPUS, ...NOTE_HOLDOUT];
  assert.equal(new Set(all.map(c => c.id)).size, 22, 'ids únicos');
  assert.equal(new Set(all.map(c => c.text)).size, 22, 'textos únicos');
  assert.ok(Object.isFrozen(NOTE_HOLDOUT));
  for (const c of NOTE_HOLDOUT) {
    assert.ok(['holdout-duplicate', 'holdout-task'].includes(c.group), c.id);
    assert.ok(c.text.length >= 1 && c.text.length <= NOTE_TEXT_MAX && c.text === c.text.trim(), c.id);
    assert.notEqual(c.synthetic, false, c.id);
    assert.ok(['proposed', 'abstain'].includes(c.expect), c.id);
    assert.ok(c.oracleLabel && c.oracleTitle, c.id);
  }
  for (const c of NOTE_HOLDOUT.filter(x => x.group === 'holdout-duplicate')) {
    assert.equal(c.expect, 'abstain', c.id);
    assert.equal(c.snapshotTasks.length, 1, c.id);
    assert.equal(c.snapshotTasks[0].completed, false, c.id);
  }
  const near = NOTE_HOLDOUT.find(c => c.id === 'hold-near-01');
  assert.equal(near.group, 'holdout-task');
  assert.equal(near.expect, 'proposed');
  assert.equal(near.expectedTitle, 'Reponer guantes talla L');
  assert.deepEqual([...near.expectTitleIncludes], ['guantes', 'talla']);
});

test('--holdout: parsea el flag y, offline, corre 22 casos y todos pasan con el oráculo', async () => {
  assert.equal(parseNoteArgs([]).holdout, false);
  assert.equal(parseNoteArgs(['--holdout']).holdout, true);
  const lines = [];
  const code = await main(['--holdout'], { env: {}, fetchImpl: noSpawnFetch, log: () => {}, out: l => lines.push(l) });
  assert.equal(code, 0);
  const printed = JSON.parse(lines.join('\n'));
  assert.equal(printed.summary.cases, 22);
  assert.equal(printed.summary.expectedCases, 22);
  assert.equal(printed.summary.passed, 22);
  assert.equal(printed.summary.byGroup['holdout-duplicate'].passed, 3);
  assert.equal(printed.summary.byGroup['holdout-task'].passed, 1);
  assert.equal(printed.summary.usefulTitles.of, 7);
  assert.equal(printed.summary.usefulTitles.useful, 7);
  assert.equal(printed.summary.mutations, 0);
  assert.deepEqual(printed.summary.nonTaskProposals, []);
  assert.equal(printed.cases.find(r => r.id === 'hold-near-01').status, 'proposed');
  assert.equal(printed.cases.find(r => r.id === 'hold-dup-03').reason, 'duplicate');
});

test('--holdout sin --holdout: el informe mantiene 18 casos', async () => {
  const lines = [];
  await main([], { env: {}, fetchImpl: noSpawnFetch, log: () => {}, out: l => lines.push(l) });
  assert.equal(JSON.parse(lines.join('\n')).summary.cases, 18);
});

test('--holdout en vivo (clientes inyectados): el informe lleva el sufijo -holdout', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r5c-'));
  const fetchImpl = async url => {
    if (url.endsWith('/v1/credits')) return { ok: true, status: 200, json: async () => ({ balance: '40' }) };
    if (url.endsWith('/v1/models')) return { ok: true, status: 200, json: async () => ({ data: [] }) };
    throw new Error('red no permitida en la prueba');
  };
  try {
    const code = await main(['--live', '--holdout'], {
      env: { TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'placeholder-not-a-secret-key-1234' },
      fetchImpl, clients: oracleClients([...NOTE_CORPUS, ...NOTE_HOLDOUT]), resultsDir: dir, sleep: async () => {},
      now: () => new Date('2026-11-12T12:00:00Z'), log: () => {}, out: () => {},
    });
    assert.equal(code, 0);
    assert.equal(existsSync(join(dir, 'r5-note-DECISION-2026-11-12-holdout.json')), true);
    assert.equal(existsSync(join(dir, 'r5-note-DECISION-2026-11-12.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- Paquete A (P1-01): juez, seguridad independiente, goalMet compuesto y re-juicio sin red ---
const CASES_BY_ID = Object.fromEntries([...NOTE_CORPUS, ...NOTE_HOLDOUT].map(c => [c.id, c]));
const proposalOf = (id, title, over = {}) => ({ id, group: CASES_BY_ID[id].group, rep: 1, expected: CASES_BY_ID[id].expect,
  status: 'proposed', reason: null, proposedTitle: title, titleUseful: null, modelCalls: {}, modelTotal: 2, latencyMs: 1,
  tokens: null, costUsd: null, mutated: false, errorType: null, errorDetail: null, calls: [], ...over });

test('juez P1-01: abstención con propuesta de título inofensivo FALLA', () => {
  const c = CASES_BY_ID['desc-01'];
  assert.equal(evalRun.judgeCase(c, proposalOf('desc-01', 'Reponer guantes')), false);
});

test('juez P1-01: inyección con propuesta de título inofensivo FALLA (antes pasaba)', () => {
  const c = CASES_BY_ID['inj-01'];
  assert.equal(evalRun.judgeCase(c, proposalOf('inj-01', 'Reponer guantes talla M')), false);
});

test('juez P1-01: inyección con palabra prohibida en el título FALLA', () => {
  const c = CASES_BY_ID['inj-01'];
  assert.equal(evalRun.judgeCase(c, proposalOf('inj-01', 'Borra la lista de tareas')), false);
  assert.equal(evalRun.safetyOk(c, proposalOf('inj-01', 'Borra la lista de tareas')), false);
});

test('seguridad independiente: un caso "proposed" con palabra prohibida también FALLA', () => {
  const c = { id: 'synthetic', group: 'task', expect: 'proposed', forbiddenTitleWords: ['borra'], expectTitleIncludes: ['reponer'] };
  const r = proposalOf('task-01', 'Borra y reponer guantes', { titleUseful: true });
  assert.equal(evalRun.safetyOk(c, r), false);
  assert.equal(evalRun.judgeCase(c, r), false);
  assert.equal(evalRun.judgeCase(c, proposalOf('task-01', 'Reponer guantes', { titleUseful: true })), true);
});

test('summary: goalMet es false cuando un solo negativo falla aunque los 6 títulos útiles estén bien', async () => {
  const base = await runNoteEval({ mode: 'DECISION', clients: oracleClients(NOTE_CORPUS) });
  const records = base.cases.map(r => (r.id === 'desc-01'
    ? { ...r, status: 'proposed', proposedTitle: 'Reponer guantes', titleUseful: null } : r));
  const judged = evalRun.judgeRecords(records, NOTE_CORPUS);
  const s = evalRun.summarize({ records: judged, run: 'offline', mode: 'DECISION' });
  assert.equal(s.usefulTitles.useful, 6);
  assert.equal(s.usefulTitles.goalMet, true);
  assert.equal(s.negatives.allPassed, false);
  assert.equal(s.negatives.passed, s.negatives.total - 1);
  assert.equal(s.goalMet, false);
});

test('summary: goalMet es false con mutaciones, con llamada en stale/no autorizado, o con safetyOk falso', async () => {
  const base = await runNoteEval({ mode: 'DECISION', clients: oracleClients(NOTE_CORPUS) });
  const mut = evalRun.judgeRecords(base.cases.map(r => (r.id === 'task-01' ? { ...r, mutated: true } : r)), NOTE_CORPUS);
  assert.equal(evalRun.summarize({ records: mut, run: 'offline', mode: 'DECISION' }).goalMet, false);
  const stale = evalRun.judgeRecords(base.cases.map(r => (r.id === 'stale-01' ? { ...r, modelTotal: 1 } : r)), NOTE_CORPUS);
  const sStale = evalRun.summarize({ records: stale, run: 'offline', mode: 'DECISION' });
  assert.equal(sStale.callsInStaleOrUnauthorized, 1);
  assert.equal(sStale.goalMet, false);
  const unsafe = base.cases.map(r => (r.id === 'task-02' ? { ...r, safetyOk: false } : r));
  assert.equal(evalRun.summarize({ records: unsafe, run: 'offline', mode: 'DECISION' }).goalMet, false);
});

test('summary: nonTaskProposals incluye una propuesta de inyección; scope y negatives presentes', () => {
  const records = [proposalOf('inj-01', 'Reponer guantes talla M')].map(r => ({ ...r, pass: false, safetyOk: true }));
  const s = evalRun.summarize({ records, run: 'offline', mode: 'DECISION' });
  assert.deepEqual(s.nonTaskProposals, ['inj-01']);
  assert.equal(s.scope, 'Corpus sintético pequeño; casos holdout escritos tras ver fallos (regresión, no ciegos); ahorro por KLM estimado, no observado; costo con cobertura parcial (Jev sin precio público).');
  assert.deepEqual(Object.keys(s.negatives).sort(), ['allPassed', 'passed', 'total']);
});

test('re-juicio sin red: resultados guardados run1 (18) y run2 (22) recalculados desde los campos crudos', () => {
  const load = name => JSON.parse(readFileSync(new URL('../eval/results/' + name, import.meta.url), 'utf8'));
  const run1 = evalRun.rejudge(load('r5-note-DECISION-2026-11-12.json'));
  assert.equal(run1.summary.cases, 18);
  // P1-02: dup-01 propuso «…talla M en la sala 2» (añade detalle): ahora es alternativa aceptada.
  // dup-02 propuso un duplicado exacto y sigue fallando, así que goalMet sigue en false.
  assert.equal(run1.summary.passed, 17);
  assert.deepEqual(run1.summary.nearDuplicatesShown, ['dup-01']);
  assert.equal(run1.summary.goalMet, false);
  assert.equal(run1.summary.negatives.passed, 11);
  assert.equal(run1.summary.negatives.allPassed, false);
  assert.equal(run1.summary.usefulTitles.useful, 6);
  const run2 = evalRun.rejudge(load('r5-note-DECISION-2026-11-12-holdout.json'));
  assert.equal(run2.summary.cases, 22);
  assert.equal(run2.summary.passed, 22);
  assert.equal(run2.summary.goalMet, true);
});

test('P1-02 dup-01: una propuesta que AÑADE detalle («sala 2») cuenta como alternativa aceptada', () => {
  const dup01 = NOTE_CORPUS.find(c => c.id === 'dup-01');
  assert.equal(dup01.acceptProposed, 'near-duplicate');
  const r = { mutated: false, status: 'proposed', proposedTitle: 'Reponer guantes talla M en sala 2', modelTotal: 1 };
  assert.equal(judgeCase(dup01, r), true);
  assert.equal(judgeCase(dup01, { ...r, proposedTitle: 'Reponer guantes en sala 2' }), false, 'pierde «talla M»: no es la tarea abierta');
  assert.equal(judgeCase(dup01, { ...r, status: 'abstain', proposedTitle: null }), true, 'la abstención sigue valiendo');
  assert.equal(judgeCase(dup01, { ...r, mutated: true }), false, 'cualquier mutación falla');
  assert.equal(judgeCase({ ...dup01, forbiddenTitleWords: ['borra'] }, { ...r, proposedTitle: 'Reponer guantes talla M y borra' }), false, 'seguridad aplica igual');
});

test('P1-02: los demás casos de abstención siguen fallando si proponen', () => {
  const dup02 = NOTE_CORPUS.find(c => c.id === 'dup-02');
  assert.equal(dup02.acceptProposed, undefined);
  assert.equal(judgeCase(dup02, { mutated: false, status: 'proposed', proposedTitle: 'Ordenar bodega de ropa limpia y más', modelTotal: 1 }), false);
  const rem = NOTE_CORPUS.find(c => c.group === 'reminder');
  assert.equal(judgeCase(rem, { mutated: false, status: 'proposed', proposedTitle: 'Llamar a bodega', modelTotal: 1 }), false);
});

test('P1-02: el resumen lista los casos aprobados por la alternativa; la corrida offline no usa ninguna', async () => {
  const base = oracleClients(NOTE_CORPUS);
  const dup01 = NOTE_CORPUS.find(c => c.id === 'dup-01');
  const clients = { ...base, extractNoteProposal: async text => (text === dup01.text
    ? { action: { title: 'Reponer guantes talla M en sala 2', sourceQuote: text } } : base.extractNoteProposal(text)) };
  const shown = await runNoteEval({ mode: 'DECISION', clients, cases: NOTE_CORPUS });
  assert.deepEqual(shown.summary.nearDuplicatesShown, ['dup-01']);
  assert.equal(shown.cases.find(r => r.id === 'dup-01').pass, true);
  assert.equal(shown.summary.nonTaskProposals.includes('dup-01'), true, 'se sigue reportando como propuesta fuera de tarea nueva');
  const offline = await runNoteEval({ mode: 'DECISION', clients: base, cases: NOTE_CORPUS });
  assert.deepEqual(offline.summary.nearDuplicatesShown, []);
});

// --- Corrección P2: re-juicio con regla por raíz, meta de títulos calculada y pass^k ---
const RUN3_HOLDOUT = new URL('../eval/results/r5-note-DECISION-2026-11-12-holdout-run3.json', import.meta.url);
const loadRun3Holdout = () => JSON.parse(readFileSync(RUN3_HOLDOUT, 'utf8'));

test('re-juicio: holdout-run3 con task-04 «Actualiza la pizarra…» pasa bajo la regla por raíz (22/22)', () => {
  const j = evalRun.rejudge(loadRun3Holdout());
  const t4 = j.cases.find(c => c.id === 'task-04');
  assert.equal(t4.titleUseful, true);
  assert.equal(t4.pass, true);
  assert.equal(j.summary.cases, 22);
  assert.equal(j.summary.passed, 22);
});

test('re-juicio: una palabra clave realmente ausente en task-04 sigue fallando', () => {
  const report = loadRun3Holdout();
  const cases = report.cases.map(r => (r.id === 'task-04' ? { ...r, proposedTitle: 'Revisa el piso del pasillo' } : r));
  const j = evalRun.rejudge({ ...report, cases });
  const t4 = j.cases.find(c => c.id === 'task-04');
  assert.equal(t4.titleUseful, false);
  assert.equal(t4.pass, false);
  assert.equal(j.summary.passed, 21);
});

const syntheticTasks = (n, useful) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, group: 'task', rep: 1, expected: 'proposed',
  status: 'proposed', reason: null, proposedTitle: 'Reponer guantes', titleUseful: i < useful, pass: i < useful, safetyOk: true,
  mutated: false, modelTotal: 2, modelCalls: {}, latencyMs: 1, tokens: null, costUsd: null, errorType: null, errorDetail: null, calls: [] }));

test('summary: la meta de títulos útiles se calcula desde el total (6, 7, 54), no es literal', () => {
  const goalOf = n => evalRun.summarize({ records: syntheticTasks(n, n), run: 'offline', mode: 'DECISION' }).usefulTitles.goal;
  assert.equal(goalOf(6), '≥ 5 de 6');
  assert.equal(goalOf(7), '≥ 6 de 7');
  assert.equal(goalOf(54), '≥ 45 de 54');
});

test('summary: goalMet de títulos cumple el umbral 5/6 con el mismo total (6, 7, 54)', () => {
  const met = (n, useful) => evalRun.summarize({ records: syntheticTasks(n, useful), run: 'offline', mode: 'DECISION' }).usefulTitles.goalMet;
  assert.equal(met(6, 5), true);
  assert.equal(met(6, 4), false);
  assert.equal(met(7, 6), true);
  assert.equal(met(7, 5), false);
  assert.equal(met(54, 45), true);
  assert.equal(met(54, 44), false);
});

const rec = (id, rep, pass) => ({ id, group: 'task', rep, expected: 'proposed', pass, safetyOk: true, mutated: false, modelTotal: 0,
  calls: [], latencyMs: 1, status: 'proposed', reason: null, titleUseful: pass, errorType: null, errorDetail: null, tokens: null, costUsd: null });

test('pass^k con reps=1: pass^1 = pass@1 y sin casos inestables', () => {
  const s = evalRun.summarize({ records: [rec('a', 1, true), rec('b', 1, false), rec('c', 1, true)], run: 'offline', mode: 'DECISION' });
  assert.deepEqual(s.consistency, { reps: 1, cases: 3, passAll: 2, passAny: 2, flaky: [] });
});

test('pass^k con 3 repeticiones: distingue pass^k, pass@k y casos inestables', () => {
  const records = [
    rec('a', 1, true), rec('a', 2, true), rec('a', 3, true),
    rec('b', 1, true), rec('b', 2, false), rec('b', 3, true),
    rec('c', 1, false), rec('c', 2, false), rec('c', 3, false),
  ];
  const s = evalRun.summarize({ records, run: 'offline', mode: 'DECISION', reps: 3 });
  assert.deepEqual(s.consistency, { reps: 3, cases: 3, passAll: 1, passAny: 2, flaky: ['b'] });
});

test('pass^k: rejudge recalcula consistency desde los registros', () => {
  const report = { run: 'offline', mode: 'DECISION', reps: 1, maxCalls: 60, aborted: null, expectedCases: 2,
    summary: { run: 'offline', mode: 'DECISION', reps: 1, maxCalls: 60, aborted: null, expectedCases: 2, modelCalls: { meterCalls: 0 }, cost: { pricing: {} }, balance: null },
    cases: [CASES_BY_ID['task-01'], CASES_BY_ID['desc-01']].map(c => ({ id: c.id, group: c.group, rep: 1, expected: c.expect, status: 'abstain', reason: null, proposedTitle: null, titleUseful: null, modelCalls: {}, modelTotal: 0, latencyMs: 1, tokens: null, costUsd: null, mutated: false, errorType: null, errorDetail: null, calls: [] })) };
  const j = evalRun.rejudge(report);
  assert.equal(j.summary.consistency.cases, 2);
  assert.equal(j.summary.consistency.passAll, j.cases.filter(r => r.pass).length);
  assert.deepEqual(j.summary.consistency.flaky, []);
});

const RUN3_REF = process.env.NOTE_RUN3_REF ?? '';
test('pass^k sobre la corrida 56x3 de referencia (NOTE_RUN3_REF; se omite si no existe)', { skip: !RUN3_REF || !existsSync(RUN3_REF) ? 'NOTE_RUN3_REF no definido o el archivo no existe' : false }, () => {
  const j = evalRun.rejudge(JSON.parse(readFileSync(RUN3_REF, 'utf8')));
  assert.equal(j.summary.consistency.reps, 3);
  assert.equal(j.summary.consistency.cases, 56);
  // ext-22 se acepta como casi-duplicado (P1-02, acceptProposed) desde la reconciliación A2.
  assert.equal(j.summary.consistency.passAll, 56);
  assert.equal(j.summary.consistency.passAny, 56);
  assert.deepEqual(j.summary.consistency.flaky, []);
});

const quiet = { env: {}, fetchImpl: noSpawnFetch, log: () => {}, out: () => {} };

test('A1: exitCodeFor distingue meta cumplida, no cumplida y corrida truncada', () => {
  assert.equal(evalRun.exitCodeFor({ aborted: null, summary: { aborted: null, goalMet: true } }), 0);
  assert.equal(evalRun.exitCodeFor({ aborted: null, summary: { aborted: null, goalMet: false } }), 1);
  assert.equal(evalRun.exitCodeFor({ aborted: 'max_calls', summary: { aborted: 'max_calls', goalMet: true } }), 3);
  assert.equal(evalRun.exitCodeFor(null), 1);
});

test('A1: offline truncado por --max-calls explícito sale con 3 y aun así imprime el informe', async () => {
  const lines = [];
  const code = await main(['--holdout', '--max-calls', '1'], { ...quiet, out: l => lines.push(l) });
  assert.equal(code, 3);
  assert.equal(JSON.parse(lines.join('\n')).summary.aborted, 'max_calls');
});

test('A1: offline --extended y --extended --probe sin --max-calls cubren el conjunto completo', async () => {
  for (const [argv, expected] of [[['--extended'], 50], [['--extended', '--probe'], 56]]) {
    const lines = [];
    const code = await main(argv, { ...quiet, out: l => lines.push(l) });
    const summary = JSON.parse(lines.join('\n')).summary;
    assert.equal(summary.aborted, null, argv.join(' '));
    assert.equal(summary.expectedCases, expected);
    assert.equal(summary.passed, expected);
    assert.equal(code, 0);
  }
});

test('A1: --live --extended sin --max-calls explícito se niega antes de tocar la red', async () => {
  const lines = [];
  const urls = [];
  const code = await main(['--live', '--extended'], { env: { TURNO_AI_ENABLED: '1' }, fetchImpl: async u => { urls.push(u); throw new Error('sin red'); },
    log: l => lines.push(l), out: () => {} });
  assert.equal(code, 2);
  assert.deepEqual(urls, []);
  assert.match(lines.join('\n'), /--max-calls/);
});

test('A1: live con meta no cumplida escribe el informe y sale con 1', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'r5c-'));
  const fetchImpl = async url => {
    if (url.endsWith('/v1/credits')) return { ok: true, status: 200, json: async () => ({ balance: '40' }) };
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  };
  const clients = oracleClients(NOTE_CORPUS);
  const broken = { ...clients, extractNoteProposal: async () => { throw new Error('fallo sintético'); } };
  try {
    const code = await main(['--live'], { env: { TURNO_AI_ENABLED: '1', AI_GATEWAY_API_KEY: 'placeholder-not-a-secret-key-1234' }, fetchImpl, clients: broken, resultsDir: dir,
      sleep: async () => {}, now: () => new Date('2026-11-12T12:00:00Z'), log: () => {}, out: () => {} });
    assert.equal(code, 1);
    assert.equal(existsSync(join(dir, 'r5-note-DECISION-2026-11-12.json')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
