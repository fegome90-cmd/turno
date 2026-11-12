/**
 * R5c: harness de evaluación de la propuesta de tarea desde una nota guardada (§18, §3).
 * Solo datos sintéticos. Sin escrituras de tareas en ningún modo.
 *
 *   node eval/run-note-eval.mjs                       # offline: oráculo fijo, sin red, imprime el informe
 *   node eval/run-note-eval.mjs --holdout             # igual, con los 4 casos de validación (NOTE_HOLDOUT): 22 casos
 *   TURNO_AI_ENABLED=1 node eval/run-note-eval.mjs --live --mode DECISION --max-calls 60 --pace-ms 1500 --min-balance 5 --reps 1
 *
 * Offline: los clientes son un oráculo (respuestas fijas del corpus). Verifica el cableado, los
 * veredictos por grupo y la parada de llamadas; NO mide calidad de modelo.
 * Live: exige --live y TURNO_AI_ENABLED=1; antes de empezar comprueba el saldo (GET /v1/credits) y
 * aborta si no hay 200 o si el saldo es menor que --min-balance. Parada dura en --max-calls.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { analyzeAmbientEvent } from '../ambient-engine.mjs';
import { readGatewaySettings } from '../gateway-config.mjs';
import { createStrandsClassifier } from '../gateway-provider.mjs';
import { createRemoteDecisionClassifier } from '../decision-provider.mjs';
import { createStrandsNoteExtractor } from '../note-proposal.mjs';
import { NOTE_CORPUS, NOTE_HOLDOUT } from './note-corpus.mjs';
import { classifyError, errorDetail, callCost, percentile } from './run-eval.mjs';
import { redactSecrets } from '../scripts/check-secrets.mjs';
import { contentWords } from '../task-duplicates.mjs';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));
const CREDITS_URL = 'https://ai-gateway.vercel.sh/v1/credits';
const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';
const MODES = ['GATEWAY', 'DUAL', 'DECISION'];
export const USEFUL_GOAL = 5 / 6; // §18: ≥ 5 títulos útiles de 6
const LIVE_PACE_MS = 1500;
const defaultSleep = ms => new Promise(r => setTimeout(r, ms));
const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d;
const ratio = (a, b) => (b ? round(a / b, 3) : null);
/** Casos cuyo título propuesto se califica por palabras clave (corpus principal y holdout). */
const isTaskGroup = g => g === 'task' || g === 'holdout-task';

export function parseNoteArgs(argv) {
  const o = { live: false, holdout: false, mode: 'DECISION', maxCalls: 60, paceMs: null, minBalance: 5, reps: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--live') o.live = true;
    else if (a === '--holdout') o.holdout = true;
    else if (a === '--mode') o.mode = String(next() ?? '').toUpperCase();
    else if (a === '--max-calls') o.maxCalls = Number(next());
    else if (a === '--pace-ms') o.paceMs = Number(next());
    else if (a === '--min-balance') o.minBalance = Number(next());
    else if (a === '--reps') o.reps = Number(next());
    else throw new Error('Argumento desconocido: ' + a);
  }
  if (!MODES.includes(o.mode)) throw new Error('--mode debe ser GATEWAY, DUAL o DECISION.');
  if (!Number.isInteger(o.maxCalls) || o.maxCalls < 1 || o.maxCalls > 500) throw new Error('--max-calls entre 1 y 500.');
  if (o.paceMs !== null && (!Number.isFinite(o.paceMs) || o.paceMs < 0 || o.paceMs > 60_000)) throw new Error('--pace-ms entre 0 y 60000.');
  if (!Number.isFinite(o.minBalance) || o.minBalance < 0) throw new Error('--min-balance inválido.');
  if (!Number.isInteger(o.reps) || o.reps < 1 || o.reps > 10) throw new Error('--reps entre 1 y 10.');
  return o;
}

/** Offline: configuración local fija (enabled, modo forzado). Live: la del entorno, con el modo elegido. */
export function resolveNoteSettings({ env = {}, mode = 'DECISION', offline = true } = {}) {
  if (offline) return Object.freeze({ ...readGatewaySettings({}), enabled: true, decisionMode: mode });
  return Object.freeze(readGatewaySettings({ ...env, TURNO_DECISION_MODE: mode }));
}

/** Evento y snapshot autorizados de un caso (sin contenido fuera de la nota). */
export function buildNoteInput(c, rep = 1) {
  const noteId = 'note-' + c.id;
  return {
    event: { id: `ev-${c.id}-${rep}`, type: 'note_saved', shiftId: 'eval-shift', synthetic: true,
      noteId, noteVersion: c.eventVersion ?? 1 },
    snapshot: { shiftId: 'eval-shift', synthetic: c.synthetic !== false, beds: [], drafts: [],
      notes: [{ id: noteId, version: c.snapshotVersion ?? 1, text: c.text }],
      tasks: (c.snapshotTasks ?? []).map(t => ({ ...t })) },
  };
}

/** Oráculo offline: respuestas fijas del corpus, indexadas por texto (cada texto es único). */
export function oracleClients(cases = NOTE_CORPUS) {
  const byText = new Map(cases.map(c => [c.text, c]));
  const lookup = text => {
    const c = byText.get(text);
    if (!c) throw new Error('Texto sin oráculo.');
    return c;
  };
  return {
    classifyWithGateway: async ({ text }) => ({ label: lookup(text).oracleLabel }),
    classifyWithDecision: async ({ text }) => ({ label: lookup(text).oracleLabel, confidence: 1 }),
    extractNoteProposal: async text => {
      const c = lookup(text);
      return { action: c.oracleTitle ? { title: c.oracleTitle, sourceQuote: text } : null };
    },
  };
}

/** Clientes reales (live). Cada llamada reporta tokens al sumidero compartido cuando el proveedor los da. */
export async function createLiveClients({ env, mode, tokenSink }) {
  const sink = kind => m => tokenSink.push(Object.freeze({ kind, inputTokens: m?.inputTokens ?? null, outputTokens: m?.outputTokens ?? null }));
  const clients = {};
  if (mode !== 'DECISION') clients.classifyWithGateway = await createStrandsClassifier({ env, onMetrics: sink('gateway') });
  if (mode !== 'GATEWAY') clients.classifyWithDecision = await createRemoteDecisionClassifier({ env });
  clients.extractNoteProposal = await createStrandsNoteExtractor({ env, onMetrics: sink('extract') });
  return clients;
}

function addTokens(list) {
  let any = false;
  const t = { inputTokens: 0, outputTokens: 0 };
  for (const x of list) {
    if (!x) continue;
    if (Number.isFinite(x.inputTokens)) { t.inputTokens += x.inputTokens; any = true; }
    if (Number.isFinite(x.outputTokens)) { t.outputTokens += x.outputTokens; any = true; }
  }
  return any ? t : null;
}

/** Contador de llamadas: cada invocación real cuenta; al llegar al tope no se llama al modelo. */
function instrument(kind, fn, meter, pricing) {
  if (typeof fn !== 'function') return undefined;
  return async input => {
    if (meter.used >= meter.maxCalls) {
      meter.exceeded = true;
      throw new Error('max_calls');
    }
    meter.used += 1;
    const started = performance.now();
    const mark = meter.tokenSink.length;
    const tokens = () => addTokens(meter.tokenSink.slice(mark));
    try {
      const value = await fn(input);
      const t = tokens();
      meter.calls.push({ kind, ms: Math.round(performance.now() - started), ok: true, errorType: null, errorDetail: null,
        tokens: t, costUsd: callCost(t, pricing?.[kind] ?? null) });
      return value;
    } catch (error) {
      const t = tokens();
      meter.calls.push({ kind, ms: Math.round(performance.now() - started), ok: false, errorType: classifyError(error).type,
        errorDetail: errorDetail(error), tokens: t, costUsd: callCost(t, pricing?.[kind] ?? null) });
      throw error;
    }
  };
}

/** Seguridad: aplica a todo caso con palabras prohibidas, sea cual sea su expect (P1-01). */
export function safetyOk(c, r) {
  if (!c.forbiddenTitleWords || r.status !== 'proposed') return true;
  const t = (r.proposedTitle ?? '').toLocaleLowerCase('es');
  return !c.forbiddenTitleWords.some(w => t.includes(w));
}

/**
 * P1-02: alternativa explícita de dup-01. Una propuesta cuenta como abstención válida solo si su título
 * conserva TODAS las palabras de contenido de la tarea abierta de la instantánea (añade detalle, no cambia la tarea).
 */
export function nearDuplicateAccepted(c, r) {
  if (c.acceptProposed !== 'near-duplicate' || r.status !== 'proposed' || typeof r.proposedTitle !== 'string') return false;
  const open = (c.snapshotTasks ?? []).find(t => !t.completed);
  if (!open) return false;
  const titleWords = new Set(contentWords(r.proposedTitle));
  return contentWords(open.title).every(w => titleWords.has(w));
}

/** Veredicto de un caso. Nunca usa texto libre: solo estado, conteo y palabras clave del corpus. */
export function judgeCase(c, r) {
  if (r.mutated) return false;
  if (!safetyOk(c, r)) return false;
  if (c.expect === 'proposed') return r.status === 'proposed' && r.titleUseful === true;
  if (c.expect === 'abstain') return r.status === 'abstain' || nearDuplicateAccepted(c, r);
  if (c.expect === 'stale') return r.status === 'stale' && r.modelTotal === 0;
  if (c.expect === 'rejected') return r.status === 'rejected' && r.modelTotal === 0;
  return false;
}

async function runCase(c, rep, { settings, clients, meter, pricing }) {
  const { event, snapshot } = buildNoteInput(c, rep);
  const before = JSON.stringify(snapshot);
  const callMark = meter.calls.length;
  const exceededBefore = meter.exceeded;
  const started = performance.now();
  let result = null;
  let thrown = null;
  try {
    result = await analyzeAmbientEvent({
      event, settings,
      isAuthorized: async () => true,
      getAuthorizedSnapshot: async () => snapshot,
      classifyWithGateway: instrument('gateway', clients.classifyWithGateway, meter, pricing),
      classifyWithDecision: instrument('decision', clients.classifyWithDecision, meter, pricing),
      extractNoteProposal: instrument('extract', clients.extractNoteProposal, meter, pricing),
    });
  } catch (error) {
    thrown = error;
  }
  const calls = meter.calls.slice(callMark);
  const latencyMs = Math.round(performance.now() - started);
  const mutated = JSON.stringify(snapshot) !== before;
  const status = thrown ? 'rejected' : result.status;
  const reason = thrown ? 'rejected_before_model' : (result.reason ?? null);
  const proposedTitle = status === 'proposed' ? (result.suggestions[0]?.title ?? null) : null;
  const useful = isTaskGroup(c.group)
    ? proposedTitle !== null && c.expectTitleIncludes.every(w => proposedTitle.toLocaleLowerCase('es').includes(w))
    : null;
  const modelCalls = { decision: calls.filter(x => x.kind === 'decision').length,
    gateway: calls.filter(x => x.kind === 'gateway').length, extract: calls.filter(x => x.kind === 'extract').length };
  const modelTotal = calls.length;
  const firstError = calls.find(x => !x.ok);
  const record = {
    id: c.id, group: c.group, rep, expected: c.expect, status, reason, proposedTitle, titleUseful: useful,
    modelCalls, modelTotal, latencyMs, tokens: addTokens(calls.map(x => x.tokens)),
    costUsd: calls.some(x => Number.isFinite(x.costUsd)) ? round(calls.reduce((a, x) => a + (x.costUsd ?? 0), 0)) : null,
    mutated, errorType: meter.exceeded && !exceededBefore ? 'max_calls' : (firstError?.errorType ?? null),
    errorDetail: thrown ? redactSecrets(String(thrown.message).slice(0, 160)) : (firstError?.errorDetail ?? null),
    calls: calls.map(x => ({ kind: x.kind, ms: x.ms, ok: x.ok, errorType: x.errorType, tokens: x.tokens, costUsd: x.costUsd ?? null })),
  };
  record.safetyOk = safetyOk(c, record);
  record.pass = judgeCase(c, { ...record, modelTotal });
  record.nearDuplicateShown = record.pass && nearDuplicateAccepted(c, record);
  return record;
}

const groupsOf = records => {
  const g = {};
  for (const r of records) {
    g[r.group] ??= { total: 0, passed: 0 };
    g[r.group].total++;
    if (r.pass) g[r.group].passed++;
  }
  for (const v of Object.values(g)) v.passRate = ratio(v.passed, v.total);
  return g;
};

const pct = xs => ({ n: xs.filter(Number.isFinite).length, p50: percentile(xs, 50), p95: percentile(xs, 95) });

/** Alcance del informe: qué puede y qué no puede afirmar. Va dentro de cada resumen. */
export const SCOPE = 'Corpus sintético pequeño; casos holdout escritos tras ver fallos (regresión, no ciegos); ahorro por KLM estimado, no observado; costo con cobertura parcial (Jev sin precio público).';

/** Resumen agregado (sin texto de notas ni de títulos fuera de los registros por caso). */
export function summarize({ records, run, mode, reps, maxCalls, aborted, meterCalls, balance = null, pricing = {}, expectedCases }) {
  const tasks = records.filter(r => isTaskGroup(r.group));
  const useful = tasks.filter(r => r.titleUseful === true).length;
  const usefulGoalMet = tasks.length > 0 && useful / tasks.length >= USEFUL_GOAL;
  const negatives = records.filter(r => r.expected !== 'proposed');
  const negativesPassed = negatives.filter(r => r.pass).length;
  const negativesAllPassed = negatives.length > 0 && negativesPassed === negatives.length;
  const mutations = records.filter(r => r.mutated).length;
  const callsInStaleOrUnauthorized = records.filter(r => r.group === 'stale' || r.group === 'unauthorized').reduce((a, r) => a + r.modelTotal, 0);
  const errors = records.filter(r => r.errorType).length;
  const safetyAllOk = records.every(r => r.safetyOk === true);
  const calls = records.flatMap(r => r.calls);
  const count = kind => calls.filter(x => x.kind === kind).length;
  const priced = calls.filter(x => Number.isFinite(x.costUsd));
  const costUsd = priced.length ? round(priced.reduce((a, x) => a + x.costUsd, 0)) : null;
  const reasons = {};
  for (const r of records) { const k = r.reason ?? r.status; reasons[k] = (reasons[k] ?? 0) + 1; }
  return {
    run, mode, reps, maxCalls, aborted, expectedCases, scope: SCOPE,
    cases: records.length,
    passed: records.filter(r => r.pass).length,
    passRate: ratio(records.filter(r => r.pass).length, records.length),
    byGroup: groupsOf(records),
    usefulTitles: { useful, of: tasks.length, goal: '≥ 5 de 6', goalMet: usefulGoalMet },
    negatives: { total: negatives.length, passed: negativesPassed, allPassed: negativesAllPassed },
    goalMet: usefulGoalMet && negativesAllPassed && mutations === 0 && callsInStaleOrUnauthorized === 0 && errors === 0 && safetyAllOk,
    nonTaskProposals: records.filter(r => r.status === 'proposed' && !isTaskGroup(r.group)).map(r => r.id),
    nearDuplicatesShown: records.filter(r => r.nearDuplicateShown === true).map(r => r.id),
    mutations,
    modelCalls: { decision: count('decision'), gateway: count('gateway'), extract: count('extract'), total: calls.length, meterCalls },
    callsInStaleOrUnauthorized,
    errors,
    reasons,
    latencyMs: { endToEnd: pct(records.map(r => r.latencyMs)), decision: pct(calls.filter(x => x.kind === 'decision').map(x => x.ms)),
      gateway: pct(calls.filter(x => x.kind === 'gateway').map(x => x.ms)), extract: pct(calls.filter(x => x.kind === 'extract').map(x => x.ms)) },
    tokens: { inputTotal: calls.reduce((a, x) => a + (x.tokens?.inputTokens ?? 0), 0), outputTotal: calls.reduce((a, x) => a + (x.tokens?.outputTokens ?? 0), 0),
      callsWithTokens: calls.filter(x => x.tokens).length },
    cost: { pricing, costUsd, costCoverage: ratio(priced.length, calls.length),
      costPerUsefulTaskUsd: costUsd !== null && useful > 0 ? round(costUsd / useful) : null,
      note: 'Jev (decision) sin precio público en el catálogo: su costo queda fuera salvo que el catálogo lo publique.' },
    balance,
  };
}

/**
 * Recalcula safetyOk y pass de registros ya guardados, sin red ni modelos. Cada registro debe
 * coincidir con su caso del corpus (id, grupo y expect); si no, se lanza error en vez de inventar.
 */
export function judgeRecords(records, cases = [...NOTE_CORPUS, ...NOTE_HOLDOUT]) {
  const byId = new Map(cases.map(c => [c.id, c]));
  return records.map(r => {
    const c = byId.get(r.id);
    if (!c || c.expect !== r.expected || c.group !== r.group) throw new Error('Registro sin caso coincidente en el corpus: ' + r.id);
    const pass = judgeCase(c, { ...r, modelTotal: r.modelTotal });
    return { ...r, safetyOk: safetyOk(c, r), pass, nearDuplicateShown: pass && nearDuplicateAccepted(c, r) };
  });
}

/** Re-juicio de un informe guardado: mismos registros crudos, veredictos y resumen recalculados. */
export function rejudge(report, cases = [...NOTE_CORPUS, ...NOTE_HOLDOUT]) {
  const s = report.summary;
  const records = judgeRecords(report.cases, cases);
  const summary = summarize({ records, run: s.run, mode: s.mode, reps: s.reps, maxCalls: s.maxCalls, aborted: s.aborted,
    meterCalls: s.modelCalls.meterCalls, balance: s.balance, pricing: s.cost.pricing, expectedCases: s.expectedCases });
  return { ...report, summary, cases: records };
}

/**
 * Ejecuta el corpus. Parada dura: nunca se supera maxCalls. Entre casos, pausa paceMs.
 */
export async function runNoteEval({ cases = NOTE_CORPUS, mode = 'DECISION', run = 'offline', settings, clients, reps = 1,
  maxCalls = 60, paceMs = 0, pricing = {}, sleep = defaultSleep, tokenSink = [], balance = null } = {}) {
  if (!clients) throw new Error('Faltan clientes de modelo u oráculo offline.');
  const cfg = settings ?? resolveNoteSettings({ mode, offline: run === 'offline' });
  const meter = { used: 0, exceeded: false, calls: [], maxCalls, tokenSink };
  const records = [];
  let aborted = null;
  let first = true;
  outer: for (let rep = 1; rep <= reps; rep++) {
    for (const c of cases) {
      if (!first && paceMs > 0) await sleep(paceMs);
      first = false;
      records.push(await runCase(c, rep, { settings: cfg, clients, meter, pricing }));
      if (meter.exceeded) { aborted = 'max_calls'; break outer; }
    }
  }
  const summary = summarize({ records, run, mode, reps, maxCalls, aborted, meterCalls: meter.used, balance, pricing,
    expectedCases: cases.length * reps });
  return { run, mode, reps, maxCalls, aborted, summary, cases: records };
}

/** Saldo del Gateway. Sin clave en el entorno se llama igual (un proxy puede inyectarla). */
export async function readBalance({ env = {}, fetchImpl = globalThis.fetch } = {}) {
  const headers = {};
  const key = typeof env.AI_GATEWAY_API_KEY === 'string' ? env.AI_GATEWAY_API_KEY.trim() : '';
  if (key) headers.Authorization = 'Bearer ' + key;
  const res = await fetchImpl(CREDITS_URL, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`saldo no disponible (HTTP ${res.status}); no se inicia la corrida.`);
  const body = await res.json();
  const balance = Number(body?.balance);
  if (!Number.isFinite(balance)) throw new Error('saldo no disponible: respuesta inválida; no se inicia la corrida.');
  return balance;
}

export async function checkBalance({ env, fetchImpl, minBalance }) {
  const balance = await readBalance({ env, fetchImpl });
  if (balance < minBalance) throw new Error(`saldo ${balance} menor que el mínimo ${minBalance}; no se inicia la corrida.`);
  return balance;
}

/** Precio público por token del modelo (solo lectura del catálogo). Si falla, el costo queda sin precio. */
export async function fetchPricing(modelId, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(MODELS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const body = await res.json();
    const p = body.data.find(m => m.id === modelId)?.pricing;
    return p && Number.isFinite(Number(p.input)) && Number.isFinite(Number(p.output)) ? { input: Number(p.input), output: Number(p.output) } : null;
  } catch {
    return null;
  }
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const { env = process.env, fetchImpl = globalThis.fetch, sleep = defaultSleep, now = () => new Date(),
    log = m => console.error(m), out = m => console.log(m), resultsDir = RESULTS_DIR, clients: injected } = deps;
  let opts;
  try { opts = parseNoteArgs(argv); } catch (error) { log(error.message); return 2; }
  const paceMs = opts.paceMs ?? (opts.live ? LIVE_PACE_MS : 0);
  const cases = opts.holdout ? [...NOTE_CORPUS, ...NOTE_HOLDOUT] : NOTE_CORPUS;
  const suffix = opts.holdout ? '-holdout' : '';
  if (!opts.live) {
    const report = await runNoteEval({ cases, mode: opts.mode, reps: opts.reps, maxCalls: opts.maxCalls, paceMs, run: 'offline',
      clients: oracleClients(cases), sleep });
    out(JSON.stringify(report, null, 2));
    return 0;
  }
  if (env.TURNO_AI_ENABLED !== '1') {
    log('--live requiere TURNO_AI_ENABLED=1 en el entorno del servidor. No se hizo ninguna llamada.');
    return 2;
  }
  let settings;
  try { settings = resolveNoteSettings({ env, mode: opts.mode, offline: false }); } catch (error) { log(error.message); return 1; }
  let balanceBefore;
  try { balanceBefore = await checkBalance({ env, fetchImpl, minBalance: opts.minBalance }); } catch (error) { log(error.message); return 1; }
  const tokenSink = [];
  const modelPrice = await fetchPricing(settings.modelId, fetchImpl);
  const pricing = { gateway: modelPrice, extract: modelPrice, decision: await fetchPricing(settings.decisionModelId, fetchImpl) };
  const clients = injected ?? await createLiveClients({ env, mode: opts.mode, tokenSink });
  const report = await runNoteEval({ cases, mode: opts.mode, reps: opts.reps, maxCalls: opts.maxCalls, paceMs, run: 'live', settings, clients,
    pricing, sleep, tokenSink, balance: { before: balanceBefore, after: null } });
  report.summary.balance.after = await readBalance({ env, fetchImpl }).catch(() => null);
  const date = now().toISOString().slice(0, 10);
  mkdirSync(resultsDir, { recursive: true });
  const file = resolve(resultsDir, `r5-note-${opts.mode}-${date}${suffix}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  out(JSON.stringify({ file, summary: report.summary }, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
