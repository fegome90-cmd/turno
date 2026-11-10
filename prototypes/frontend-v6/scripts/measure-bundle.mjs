// Informational size measurement: raw and gzip bytes of the candidate versus the v5 reference preview.
// It is not a performance PASS. It warns when the candidate exceeds 2x the reference raw size.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const target = process.argv[2] ?? 'dist/preview.html';
const reference = process.argv[3] ?? '../frontend-v5/preview.html';
const RATIO_WARNING = 2;

function measure(file) {
  const bytes = fs.readFileSync(path.resolve(file));
  return {file, rawBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes, {level: 9}).length};
}

const candidate = measure(target);
const ref = measure(reference);
const ratio = candidate.rawBytes / ref.rawBytes;
const warning = ratio > RATIO_WARNING;
const result = {
  candidate,
  reference: ref,
  rawRatio: Number(ratio.toFixed(3)),
  gzipRatio: Number((candidate.gzipBytes / ref.gzipBytes).toFixed(3)),
  budgetWarning: warning,
  note: 'Informativo. No es un PASS de rendimiento; el criterio de rendimiento está en evidence/1A/perf-shell.json.',
};
console.log(JSON.stringify(result, null, 2));
if (warning) console.warn(`AVISO: el candidato supera ${RATIO_WARNING}x el bruto de la referencia v5.`);
