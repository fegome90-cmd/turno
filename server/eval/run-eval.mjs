/**
 * LIVE evaluation of the Turno background agent on Vercel AI Gateway.
 * Synthetic data only. No writes. Opt-in: requires --live.
 *
 *   node eval/run-eval.mjs --live --models nvidia/nemotron-3.5-lightning-free,openai/gpt-5-mini \
 *     --reps 3 --suites classifier,capture --min-balance 3
 *
 * Budget guard: aborts a model run when Gateway credits fall below --min-balance.
 * Free models (suffix -free) run sequentially with pacing (≈5 requests/min).
 * On Gateway's free tier every model is limited per model; use --pace-ms 12500.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStrandsClassifier } from '../gateway-provider.mjs';
import { createStrandsCapture } from '../gateway-capture.mjs';
import { CLASSIFIER_CASES, CAPTURE_CASES, BEDS } from './dataset.mjs';

const RESULTS_DIR = fileURLToPath(new URL('./results/', import.meta.url));

export function parseArgs(argv) {
  const opts = { live: false, models: [], reps: 1, suites: ['classifier', 'capture'], minBalance: 3,
    concurrency: 4, freePaceMs: 12_500, paceMs: null, only: null, tag: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--live') opts.live = true;
    else if (a === '--models') opts.models = next().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--reps') opts.reps = Number(next());
    else if (a === '--suites') opts.suites = next().split(',').map(s => s.trim());
    else if (a === '--min-balance') opts.minBalance = Number(next());
    else if (a === '--concurrency') opts.concurrency = Number(next());
    else if (a === '--free-pace-ms') opts.freePaceMs = Number(next());
    else if (a === '--pace-ms') opts.paceMs = Number(next()); // aplica a todos los modelos
    else if (a === '--only') opts.only = new Set(next().split(','));
    else if (a === '--tag') opts.tag = next();
    else throw new Error('Argumento desconocido: ' + a);
  }
  if (!Number.isInteger(opts.reps) || opts.reps < 1 || opts.reps > 10) throw new Error('--reps entre 1 y 10.');
  if (!Number.isFinite(opts.minBalance) || opts.minBalance < 0) throw new Error('--min-balance inválido.');
  if (!opts.suites.every(s => ['classifier', 'capture'].includes(s))) throw new Error('--suites inválido.');
  if (opts.tag && !/^[a-z0-9-]{1,30}$/.test(opts.tag)) throw new Error('--tag inválido.');
  return opts;
}

export function classifyError(error) {
  for (let e = error, i = 0; e && i < 6; e = e.cause, i++) {
    const msg = String(e.message || '');
    if (e.name === 'GatewayRateLimitError' || e.statusCode === 429 || /rate limit/i.test(msg)) {
      const m = msg.match(/Retry after (\d+)s/i);
      return { type: 'rate_limit', retryAfterMs: m ? Number(m[1]) * 1000 : 20_000 };
    }
    if (/free tier/i.test(msg)) return { type: 'forbidden' };
    if (e.name === 'MaxTokensError' || /maximum token limit/i.test(msg)) return { type: 'max_tokens' };
    if (e.name === 'TimeoutError' || e.name === 'AbortError' || /cancelada|timed? ?out/i.test(msg)) return { type: 'timeout' };
  }
  return { type: 'model_or_schema' };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Error names along the cause chain plus a short innermost message (synthetic runs only). */
export function errorDetail(error) {
  const names = [];
  let last = '';
  for (let e = error, i = 0; e && i < 6; e = e.cause, i++) {
    names.push(e.name || 'Error');
    last = String(e.message || '');
  }
  return names.join(' > ') + ': ' + last.replace(/\s+/g, ' ').slice(0, 160);
}

async function withRateLimitRetry(fn, { maxRetries = 6, log }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return { value: await fn(), retries: attempt };
    } catch (error) {
      const info = classifyError(error);
      if (info.type !== 'rate_limit' || attempt >= maxRetries) throw Object.assign(error, { evalInfo: info, retries: attempt });
      log?.(`  rate limit, espero ${Math.round(info.retryAfterMs / 1000)}s`);
      await sleep(info.retryAfterMs + 1000);
    }
  }
}

async function readCredits(env) {
  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/credits', {
      headers: { Authorization: 'Bearer ' + env.AI_GATEWAY_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return Number(j.balance);
  } catch { return null; }
}

export function percentile(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
}

/** Common invariants of every capture result (the review boundary). */
export function captureInvariants(proposals) {
  return {
    allNeedReview: proposals.every(p => p.status === 'requires_human_review'),
    noDates: proposals.every(p => p.date === null),
    notCompleted: proposals.every(p => p.completed === false),
    closeHasNoTime: proposals.every(p => !(p.beforeClose && p.time)),
  };
}

export function scoreClassifier(records) {
  const byCase = new Map();
  for (const r of records) {
    if (!byCase.has(r.id)) byCase.set(r.id, []);
    byCase.get(r.id).push(r);
  }
  const cases = CLASSIFIER_CASES.filter(c => byCase.has(c.id));
  const ok = records.filter(r => r.label);
  const groups = {};
  for (const c of cases) {
    const rs = byCase.get(c.id);
    const g = (groups[c.group] ??= { calls: 0, accepted: 0 });
    g.calls += rs.length;
    g.accepted += rs.filter(r => c.accept.includes(r.label)).length;
  }
  const consistent = cases.filter(c => {
    const labels = new Set(byCase.get(c.id).map(r => r.label ?? 'ERROR'));
    return labels.size === 1;
  }).length;
  const confusion = {};
  for (const r of records) {
    const c = CLASSIFIER_CASES.find(x => x.id === r.id);
    const key = c.strict + ' -> ' + (r.label ?? 'ERROR');
    confusion[key] = (confusion[key] ?? 0) + 1;
  }
  return {
    calls: records.length,
    errors: records.length - ok.length,
    errorTypes: countBy(records.filter(r => !r.label), r => r.errorType),
    acceptedRate: ratio(records.filter(r => CLASSIFIER_CASES.find(c => c.id === r.id).accept.includes(r.label)).length, records.length),
    strictRate: ratio(records.filter(r => CLASSIFIER_CASES.find(c => c.id === r.id).strict === r.label).length, records.length),
    mustNotViolations: records.filter(r => (CLASSIFIER_CASES.find(c => c.id === r.id).mustNot ?? []).includes(r.label)).map(r => r.id),
    consistency: ratio(consistent, cases.length),
    byGroup: Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, ratio(g.accepted, g.calls)])),
    latencyMs: { p50: percentile(records.map(r => r.ms), 50), p95: percentile(records.map(r => r.ms), 95) },
    confusion,
  };
}

export function scoreCapture(records) {
  const passed = records.filter(r => r.pass);
  return {
    calls: records.length,
    passRate: ratio(passed.length, records.length),
    errors: records.filter(r => r.errorType).length,
    errorTypes: countBy(records.filter(r => r.errorType), r => r.errorType),
    invariantViolations: records.filter(r => r.invariants && !Object.values(r.invariants).every(Boolean)).map(r => r.id),
    byCase: Object.fromEntries(CAPTURE_CASES.filter(c => records.some(r => r.id === c.id)).map(c => {
      const rs = records.filter(r => r.id === c.id);
      return [c.id, ratio(rs.filter(r => r.pass).length, rs.length)];
    })),
    failedCriteria: countBy(records.flatMap(r => Object.entries(r.criteria ?? {}).filter(([, v]) => !v).map(([k]) => r.id + ':' + k)), x => x),
    latencyMs: { p50: percentile(records.map(r => r.ms), 50), p95: percentile(records.map(r => r.ms), 95) },
    tokens: {
      inputAvg: avg(records.map(r => r.tokens?.inputTokens)),
      outputAvg: avg(records.map(r => r.tokens?.outputTokens)),
    },
  };
}

function ratio(a, b) { return b ? Math.round((a / b) * 1000) / 1000 : null; }
function avg(xs) { const v = xs.filter(Number.isFinite); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
function countBy(xs, f) { const o = {}; for (const x of xs) { const k = f(x); o[k] = (o[k] ?? 0) + 1; } return o; }

async function runPool(jobs, { concurrency, paceMs, budgetCheck, log }) {
  const out = [];
  let index = 0;
  let aborted = null;
  async function worker() {
    while (index < jobs.length && !aborted) {
      const job = jobs[index++];
      if (index % 15 === 0) {
        const reason = await budgetCheck();
        if (reason) { aborted = reason; break; }
      }
      out.push(await job());
      if (paceMs) await sleep(paceMs);
    }
  }
  await Promise.all(Array.from({ length: paceMs ? 1 : concurrency }, worker));
  if (aborted) log(`ABORTADO: ${aborted}`);
  return { records: out, aborted };
}

export async function evaluateModel(modelId, opts, { log = console.error } = {}) {
  const env = { ...process.env, TURNO_AI_PROVIDER: 'vercel', TURNO_AI_MODEL_ID: modelId,
    TURNO_AI_ENABLED: '1', TURNO_SYNTHETIC_ONLY: '1', TURNO_DECISION_MODE: 'GATEWAY' };
  const isFree = /-free$/.test(modelId);
  const startBalance = await readCredits(env);
  const budgetCheck = async () => {
    if (isFree) return null;
    const b = await readCredits(env);
    return b !== null && b < opts.minBalance ? `saldo ${b} < ${opts.minBalance}` : null;
  };
  if (!isFree && startBalance !== null && startBalance < opts.minBalance) {
    throw new Error(`Saldo ${startBalance} bajo el mínimo ${opts.minBalance}; no se ejecuta ${modelId}.`);
  }
  const pool = { concurrency: opts.concurrency, paceMs: opts.paceMs ?? (isFree ? opts.freePaceMs : 0), budgetCheck, log };
  const report = { modelId, tag: opts.tag || null, startedAt: new Date().toISOString(), reps: opts.reps, startBalance };

  if (opts.suites.includes('classifier')) {
    const classify = await createStrandsClassifier({ env });
    const jobs = [];
    for (let rep = 1; rep <= opts.reps; rep++) {
      for (const c of CLASSIFIER_CASES) {
        if (opts.only && !opts.only.has(c.id)) continue;
        jobs.push(async () => {
          const t = performance.now();
          try {
            const { value, retries } = await withRateLimitRetry(
              () => classify({ id: c.id + '-' + rep, synthetic: true, text: c.text }), { log });
            const rec = { id: c.id, rep, label: value.label, ms: Math.round(performance.now() - t), retries };
            log(`${modelId} cls ${c.id}#${rep} ${value.label} ${c.accept.includes(value.label) ? 'ok' : 'MISS'}`);
            return rec;
          } catch (error) {
            const info = error.evalInfo ?? classifyError(error);
            log(`${modelId} cls ${c.id}#${rep} ERROR ${info.type}`);
            return { id: c.id, rep, label: null, errorType: info.type, errorDetail: errorDetail(error),
              ms: Math.round(performance.now() - t), retries: error.retries ?? 0 };
          }
        });
      }
    }
    const { records, aborted } = await runPool(jobs, pool);
    report.classifier = { aborted, records, score: scoreClassifier(records) };
  }

  if (opts.suites.includes('capture')) {
    let lastMetrics = null;
    const propose = await createStrandsCapture({ env, onMetrics: m => { lastMetrics = m; } });
    const jobs = [];
    for (let rep = 1; rep <= opts.reps; rep++) {
      for (const c of CAPTURE_CASES) {
        if (opts.only && !opts.only.has(c.id)) continue;
        jobs.push(async () => {
          const t = performance.now();
          const input = { shiftId: 'eval-shift', synthetic: true, text: c.text };
          try {
            lastMetrics = null;
            const { value, retries } = await withRateLimitRetry(
              () => propose(input, { isAuthorized: x => x === input, beds: BEDS }), { log });
            const proposals = value.proposals;
            const criteria = c.check(proposals);
            const invariants = captureInvariants(proposals);
            const pass = Object.values(criteria).every(Boolean) && Object.values(invariants).every(Boolean);
            log(`${modelId} cap ${c.id}#${rep} ${pass ? 'ok' : 'MISS'} (${proposals.length})`);
            return { id: c.id, rep, pass, criteria, invariants, count: proposals.length,
              proposals: proposals.map(p => ({ title: p.title, time: p.time, bedLabel: p.bedLabel, linked: !!p.bedId, beforeClose: p.beforeClose })),
              ms: Math.round(performance.now() - t), tokens: lastMetrics, retries };
          } catch (error) {
            const info = error.evalInfo ?? classifyError(error);
            const pass = c.allowSchemaReject === true && info.type === 'model_or_schema';
            log(`${modelId} cap ${c.id}#${rep} ${pass ? 'ok (rechazado)' : 'ERROR ' + info.type}`);
            return { id: c.id, rep, pass, errorType: pass ? null : info.type, rejected: pass, errorDetail: errorDetail(error),
              ms: Math.round(performance.now() - t), retries: error.retries ?? 0 };
          }
        });
      }
    }
    const { records, aborted } = await runPool(jobs, pool);
    report.capture = { aborted, records, score: scoreCapture(records) };
  }

  report.endBalance = await readCredits(env);
  report.costUsd = report.startBalance !== null && report.endBalance !== null
    ? Math.round((report.startBalance - report.endBalance) * 1e6) / 1e6 : null;
  report.finishedAt = new Date().toISOString();
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (!opts.live || !opts.models.length) {
    console.error('Uso: node eval/run-eval.mjs --live --models m1,m2 [--reps N] [--suites classifier,capture] [--min-balance USD]');
    return 2;
  }
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('Falta AI_GATEWAY_API_KEY en el entorno del servidor.');
    return 2;
  }
  mkdirSync(RESULTS_DIR, { recursive: true });
  const summary = [];
  for (const modelId of opts.models) {
    try {
      const report = await evaluateModel(modelId, opts);
      const file = RESULTS_DIR + modelId.replace(/[^a-z0-9.-]+/gi, '_') + (opts.tag ? '.' + opts.tag : '') + '.json';
      writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
      summary.push({ modelId, costUsd: report.costUsd, classifier: report.classifier?.score, capture: report.capture?.score });
    } catch (error) {
      summary.push({ modelId, error: String(error.message).slice(0, 200) });
    }
  }
  console.log(JSON.stringify(summary, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  process.exitCode = await main();
}
