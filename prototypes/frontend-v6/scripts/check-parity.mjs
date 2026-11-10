// Integrity of the execution matrix against the canon, not a functional parity gate.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
let rows = [];
const contractFields = ['sourceSha', 'sourceFile', 'sourceTest', 'task', 'targetBehavior', 'preparationTask', 'integrationTasks', 'closureEvidenceKinds', 'integrationRationale', 'finalTargetTests'];
const evidenceKinds = {unit: 'nonvisual', component: 'nonvisual', browser: 'browser', visual: 'visual', 'manual-at': 'manual-at'};
const strings = (value) => Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.trim());
const localFile = (relative) => {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) return false;
  const file = path.resolve(root, relative);
  // realpath also rejects a symlink that escapes the project.
  try {
    return file.startsWith(root + path.sep) && fs.realpathSync(file).startsWith(fs.realpathSync(root) + path.sep) && fs.statSync(file).isFile();
  } catch {
    return false;
  }
};
try {
  const canon = JSON.parse(fs.readFileSync(path.resolve(root, '../../docs/migration-v6/parity-map.json'), 'utf8'));
  rows = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] ?? path.join(root, 'docs/parity-map.json')), 'utf8'));
  if (!Array.isArray(rows)) throw new Error('Matrix must be an array of requirements');
  const canonical = new Map(canon.map((row) => [row.requirementId, row]));
  if (rows.length !== canonical.size || new Set(rows.map((row) => row?.requirementId)).size !== canonical.size) errors.push('Requirement identities are missing or duplicated');
  for (const row of rows) {
    const id = row?.requirementId;
    const source = canonical.get(id);
    if (!source) {errors.push(`Unknown requirement identity: ${id}`); continue;}
    for (const field of contractFields) {
      if (field === 'targetBehavior' && row.status === 'replaced-by-behavior') continue;
      if (JSON.stringify(row[field]) !== JSON.stringify(source[field])) errors.push(`${id}: canonical contract changed (${field})`);
    }
    if (!strings(row.targetTests) || (row.status !== 'replaced-by-behavior' && row.targetTests.some((target) => !source.targetTests.includes(target)))) errors.push(`${id}: invalid target tests`);
    if (typeof row.targetBehavior !== 'string' || !row.targetBehavior.trim()) errors.push(`${id}: missing target behavior`);
    if (!strings(row.targetCases)) errors.push(`${id}: missing target cases`);
    if (row.status === 'planned') {
      if (!Array.isArray(row.evidence) || row.evidence.length !== 0) errors.push(`${id}: planned requirement has evidence`);
    } else if (row.status === 'blocked') {
      if (typeof row.rationale !== 'string' || !row.rationale.trim()) errors.push(`${id}: blocked requirement needs a rationale`);
      if (!Array.isArray(row.evidence) || row.evidence.some((item) => typeof item !== 'string' || !item.trim())) errors.push(`${id}: invalid blocked evidence metadata`);
    } else if (row.status === 'verified' || row.status === 'replaced-by-behavior') {
      if (row.status === 'replaced-by-behavior' && (typeof row.rationale !== 'string' || !row.rationale.trim())) errors.push(`${id}: behavior replacement needs a rationale`);
      if (!strings(row.evidence) || !strings(row.targetTests) || row.targetTests.some((target) => !localFile(target))) errors.push(`${id}: closed target/evidence is missing`);
      if (strings(row.evidence)) {
        const kinds = row.evidence.map((kind) => evidenceKinds[kind]);
        if (kinds.includes(undefined)) errors.push(`${id}: unknown evidence kind`);
        for (const kind of source.closureEvidenceKinds) {
          if (!kinds.includes(kind)) errors.push(`${id}: evidence does not cover required ${kind} closure`);
        }
      }
      if (!localFile(row.reviewEvidence)) errors.push(`${id}: review evidence file is missing or outside the project`);
      if (!/^[a-f0-9]{40}$/.test(row.executionSourceSha ?? '') || typeof row.verificationScope !== 'string' || !row.verificationScope.trim()) errors.push(`${id}: closed evidence needs an execution SHA and scope`);
    } else {
      errors.push(`${id}: invalid status ${row.status}`);
    }
  }
} catch (error) {
  errors.push(String(error.message));
}
console.log(JSON.stringify({
  status: errors.length ? 'INVALID' : 'VALID',
  scope: 'matrix integrity only; stored evidence and functional parity are not re-evaluated',
  functionalParity: 'NOT_EVALUATED',
  requirements: Array.isArray(rows) ? rows.length : 0,
  planned: Array.isArray(rows) ? rows.filter((row) => row?.status === 'planned').length : 0,
  verified: Array.isArray(rows) ? rows.filter((row) => row?.status === 'verified').length : 0,
  blocked: Array.isArray(rows) ? rows.filter((row) => row?.status === 'blocked').length : 0,
  replacedByBehavior: Array.isArray(rows) ? rows.filter((row) => row?.status === 'replaced-by-behavior').length : 0,
  pending: Array.isArray(rows) ? rows.filter((row) => row?.status === 'planned' || row?.status === 'blocked').length : 0,
  errors,
}, null, 2));
process.exitCode = errors.length ? 1 : 0;
