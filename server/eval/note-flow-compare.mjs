/**
 * R5c: comparador de flujo manual frente a la propuesta de tarea (§3).
 * Estimación por operadores KLM (Card, Moran y Newell, 1980, CACM 23(7)). K = 0,28 s (mecanógrafo medio no
 * secretarial), P = 1,1 s (apuntar), B = 0,1 s (presionar o soltar botón; un clic usa P + B aquí, como en §3),
 * M = 1,35 s (preparación mental), H = 0,4 s (cambiar a teclado). Sensibilidad: clic = P + 2B (0,2 s).
 * Es una estimación del modelo sobre los pasos reales de prototypes/frontend-v6 (AssistanceDialog y
 * NoteProposal). NO es una prueba con personas.
 *
 *   node eval/note-flow-compare.mjs                # títulos esperados del corpus (offline)
 *   node eval/note-flow-compare.mjs --from <json>  # títulos útiles propuestos de un informe live
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { NOTE_CORPUS, NOTE_HOLDOUT } from './note-corpus.mjs';
import { isTaskGroup, titleHasKeywords } from './run-note-eval.mjs';
import { NOTE_EXTENDED } from './note-extended.mjs';

export const KLM = Object.freeze({ K: 0.28, P: 1.1, B: 0.1, M: 1.35, H: 0.4 });
export const GOAL_REDUCTION = 0.2;
const METHOD = 'Estimación KLM (Card, Moran y Newell, 1980): K 0,28 s, P 1,1 s, B 0,1 s, M 1,35 s, H 0,4 s. Modelo, no prueba con personas.';

const seconds = (ops, titleChars, { K, P, B, M, H, click }) => {
  // ops: 'M' | 'H' | 'C' (clic = P + click) | 'T' (teclear titleChars caracteres a K)
  let s = 0;
  for (const op of ops) {
    if (op === 'M') s += M;
    else if (op === 'H') s += H;
    else if (op === 'C') s += P + click;
    else if (op === 'P') s += P;
    else if (op === 'T') s += K * titleChars;
  }
  return s;
};

// Pasos físicos (un paso = una acción visible): el campo de título cuenta como un paso de escritura.
const MANUAL = Object.freeze([
  { name: 'Abrir Captura', ops: ['M', 'C'] },
  { name: 'Foco en «Tareas para revisar»', ops: ['C', 'H'] },
  { name: 'Escribir el título', ops: ['M', 'T'] },
  { name: 'Pasar a revisión', ops: ['M', 'C'] },
  { name: 'Abrir «Lista»', ops: ['M', 'C'] },
  { name: 'Elegir lista', ops: ['C'] },
  { name: 'Aprobar y guardar', ops: ['M', 'C'] },
]);
const PROPOSAL = Object.freeze([
  { name: 'Revisar tarea', ops: ['M', 'C'] },
  { name: 'Abrir «Lista»', ops: ['M', 'C'] },
  { name: 'Elegir lista', ops: ['C'] },
  { name: 'Aprobar y guardar', ops: ['M', 'C'] },
]);

function flow(steps, titleChars, opts) {
  const total = steps.reduce((a, s) => a + seconds(s.ops, titleChars, opts), 0);
  return { steps: steps.length, seconds: Math.round(total * 1000) / 1000 };
}

export function manualFlow(title, { clickSeconds = KLM.B } = {}) {
  return flow(MANUAL, [...title].length, { ...KLM, click: clickSeconds });
}

export function proposalFlow({ clickSeconds = KLM.B } = {}) {
  return flow(PROPOSAL, 0, { ...KLM, click: clickSeconds });
}

export function median(xs) {
  if (!xs.length) throw new Error('Se requiere al menos un valor.');
  const v = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function compareFlows(titles, { clickSeconds = KLM.B } = {}) {
  if (!Array.isArray(titles) || titles.length === 0) throw new Error('Lista de títulos vacía.');
  const manuals = titles.map(t => manualFlow(t, { clickSeconds }));
  const proposal = proposalFlow({ clickSeconds });
  const manual = { medianSteps: median(manuals.map(m => m.steps)), medianSeconds: round3(median(manuals.map(m => m.seconds))) };
  const prop = { medianSteps: proposal.steps, medianSeconds: proposal.seconds };
  const reduction = {
    steps: round3(1 - prop.medianSteps / manual.medianSteps),
    seconds: round3(1 - prop.medianSeconds / manual.medianSeconds),
  };
  const metricsMeetingGoal = Object.entries(reduction).filter(([, v]) => v >= GOAL_REDUCTION).map(([k]) => k);
  return {
    estimate: true,
    method: METHOD,
    titles: titles.length,
    clickSeconds,
    manual,
    proposal: prop,
    reduction,
    primaryMetric: 'seconds',
    metricsMeetingGoal,
    goalMet: metricsMeetingGoal.length > 0,
  };
}

function round3(x) { return Math.round(x * 1000) / 1000; }

/** Títulos útiles de un informe live (propuestas que la persona aprobaría) o títulos esperados del corpus. */
export function titlesFromReport(report) {
  // Si el caso existe en el corpus, se re-juzga con la regla actual (raíz de palabra) en vez de
  // confiar en el titleUseful guardado; si no existe, se usa el valor guardado.
  const corpus = new Map([...NOTE_CORPUS, ...NOTE_HOLDOUT, ...NOTE_EXTENDED].map(c => [c.id, c]));
  const usefulNow = r => {
    const c = corpus.get(r.id);
    return c && Array.isArray(c.expectTitleIncludes) ? titleHasKeywords(r.proposedTitle, c.expectTitleIncludes) : r.titleUseful === true;
  };
  const useful = report.cases.filter(r => isTaskGroup(r.group) && usefulNow(r)).map(r => r.proposedTitle);
  if (!useful.length) throw new Error('El informe no tiene títulos útiles.');
  return useful;
}

export function main(argv = process.argv.slice(2), { readFile = p => readFileSync(p, 'utf8'), out = m => console.log(m) } = {}) {
  let from = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') from = argv[++i];
    else throw new Error('Argumento desconocido: ' + argv[i]);
  }
  const source = from ? 'live' : 'corpus';
  const titles = from ? titlesFromReport(JSON.parse(readFile(resolve(from)))) : NOTE_CORPUS.filter(c => c.group === 'task').map(c => c.expectedTitle);
  const result = compareFlows(titles);
  const sensitivity = compareFlows(titles, { clickSeconds: 2 * KLM.B });
  out(JSON.stringify({ source, ...result, sensitivity: { clickSeconds: 2 * KLM.B, reduction: sensitivity.reduction, goalMet: sensitivity.goalMet } }, null, 2));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main();
}
