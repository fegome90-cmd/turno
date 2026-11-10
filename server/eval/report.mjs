/**
 * Builds eval/RESULTS.md from eval/results/*.json (no network).
 *   node eval/report.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLASSIFIER_CASES as ALL_CLASSIFIER, CAPTURE_CASES as ALL_CAPTURE, setOf } from './dataset.mjs';

// La fase original solo tenía el set de prueba; el de control se agregó en v2.
const CLASSIFIER_CASES = ALL_CLASSIFIER.filter(c => setOf(c) === 'dev');
const CAPTURE_CASES = ALL_CAPTURE.filter(c => setOf(c) === 'dev');
import { resolve } from 'node:path';

const dir = fileURLToPath(new URL('./results/', import.meta.url));
const out = fileURLToPath(new URL('./RESULTS.md', import.meta.url));

const pct = x => (x === null || x === undefined ? '—' : Math.round(x * 100) + '%');
const sec = ms => (ms === null || ms === undefined ? '—' : (ms / 1000).toFixed(1) + ' s');
const usd = x => (x === null || x === undefined ? '—' : '$' + x.toFixed(4));

/** Original phase (v1): no tag, prompt v1 (or unrecorded), dev set only, LLM suites only. */
export function isOriginalPhase(r) {
  if (!r || r.tag) return false;
  if (r.promptVersion && r.promptVersion !== 'v1') return false;
  if (r.set && r.set !== 'dev') return false;
  return Boolean(r.classifier || r.capture) && !r.decision && !r.dual;
}

export function loadReports() {
  // Fase original (v1): resultados sin etiqueta. v2, decider y DUAL se resumen en DECIDER.md.
  // Selected by recorded metadata: legacy v1 results carry no tag, prompt version or set.
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => JSON.parse(readFileSync(dir + f, 'utf8')))
    .filter(isOriginalPhase);
}

export function buildMarkdown(reports) {
  const lines = [];
  const date = reports.map(r => r.finishedAt).filter(Boolean).sort().at(-1)?.slice(0, 10) ?? '';
  lines.push('# Evaluación real del agente de fondo — fase original (v1)', '');
  lines.push('Primera pasada con las instrucciones v1 y 5 modelos, solo con el set de prueba. ' +
    'Las instrucciones v2, el set de control, el decider y la corrida DUAL están en [`../DECIDER.md`](../DECIDER.md).', '');
  lines.push(`Fecha: ${date}. Datos 100 % sintéticos, sin escrituras. ` +
    `${CLASSIFIER_CASES.length} casos de clasificación y ${CAPTURE_CASES.length} de captura, ` +
    `${reports[0]?.reps ?? '?'} repeticiones por caso. Generado con \`npm run eval:live\` y \`node eval/report.mjs\`.`, '');

  lines.push('## Resumen', '');
  lines.push('| Modelo | Clasificación (aceptable) | Estricta | Consistencia | Violaciones de seguridad | Captura | Errores | Latencia p50 / p95 (clasif.) | Costo |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of reports) {
    const c = r.classifier?.score; const k = r.capture?.score;
    const errors = (c?.errors ?? 0) + (k?.errors ?? 0);
    const calls = (c?.calls ?? 0) + (k?.calls ?? 0);
    lines.push(`| \`${r.modelId}\` | ${pct(c?.acceptedRate)} | ${pct(c?.strictRate)} | ${pct(c?.consistency)} | ` +
      `${(c?.mustNotViolations?.length ?? 0) + (k?.invariantViolations?.length ?? 0)} | ${pct(k?.passRate)} | ` +
      `${errors}/${calls} | ${sec(c?.latencyMs?.p50)} / ${sec(c?.latencyMs?.p95)} | ${usd(r.tokenCostUsd)} |`);
  }
  lines.push('', '- **Aceptable:** la etiqueta está entre las válidas del caso. **Estricta:** coincide con la mejor etiqueta.',
    '- **Consistencia:** casos en que las repeticiones dieron la misma respuesta.',
    '- **Violaciones de seguridad:** etiquetas prohibidas en intentos de inyección, o propuestas que rompen la revisión humana (fecha inventada, tarea completada, hora en «antes del cierre»).',
    '- **Errores:** respuestas sin formato válido o fallos de red tras reintentos. El agente se abstiene (fail-closed).', '');

  const groups = [...new Set(CLASSIFIER_CASES.map(c => c.group))];
  lines.push('## Clasificación por grupo (aceptable)', '');
  lines.push('| Modelo | ' + groups.join(' | ') + ' |');
  lines.push('|---|' + groups.map(() => '---').join('|') + '|');
  for (const r of reports) {
    const g = r.classifier?.score?.byGroup ?? {};
    lines.push(`| \`${r.modelId}\` | ` + groups.map(x => pct(g[x])).join(' | ') + ' |');
  }

  lines.push('', '## Captura por caso (aprobadas)', '');
  lines.push('| Modelo | ' + CAPTURE_CASES.map(c => c.id).join(' | ') + ' | Tokens entrada / salida |');
  lines.push('|---|' + CAPTURE_CASES.map(() => '---').join('|') + '|---|');
  for (const r of reports) {
    const k = r.capture?.score;
    lines.push(`| \`${r.modelId}\` | ` + CAPTURE_CASES.map(c => pct(k?.byCase?.[c.id])).join(' | ') +
      ` | ${k?.tokens?.inputAvg ?? '—'} / ${k?.tokens?.outputAvg ?? '—'} |`);
  }

  lines.push('', '## Fallos más frecuentes', '');
  for (const r of reports) {
    const c = r.classifier?.score; const k = r.capture?.score;
    const misses = Object.entries(c?.confusion ?? {}).filter(([key]) => {
      const [want, got] = key.split(' -> '); return want !== got;
    }).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, n]) => `${key} (${n})`);
    const capFails = Object.entries(k?.failedCriteria ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, n]) => `${key} (${n})`);
    lines.push(`- \`${r.modelId}\``);
    lines.push(`  - Clasificación (esperada -> obtenida): ${misses.join('; ') || 'ninguno'}`);
    lines.push(`  - Captura (caso:criterio): ${capFails.join('; ') || 'ninguno'}`);
    const errs = {};
    for (const src of [c?.errorTypes, k?.errorTypes]) {
      for (const [t, n] of Object.entries(src ?? {})) errs[t] = (errs[t] ?? 0) + n;
    }
    if (Object.keys(errs).length) lines.push(`  - Tipos de error: ${Object.entries(errs).map(([t, n]) => t + ' ' + n).join(', ')}`);
    if (r.classifier?.aborted || r.capture?.aborted) lines.push(`  - Corte por presupuesto: ${r.classifier?.aborted || r.capture?.aborted}`);
  }
  return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const reports = loadReports();
  writeFileSync(out, buildMarkdown(reports));
  console.log('Escrito ' + out + ' con ' + reports.length + ' modelos.');
}
