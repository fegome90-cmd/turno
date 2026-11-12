import test from 'node:test';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { NOTE_CORPUS, NOTE_GROUP_COUNTS, NOTE_TEXT_MAX } from '../eval/note-corpus.mjs';
import { parseNoteArgs, resolveNoteSettings, oracleClients, runNoteEval, checkBalance, main } from '../eval/run-note-eval.mjs';

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

test('live con clientes inyectados y red falsa: saldo antes y después, informe escrito, sin red real', async () => {
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
    assert.deepEqual(printed.summary.balance, { before: 40, after: 40 });
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
