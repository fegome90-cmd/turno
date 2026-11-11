import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';

const original = JSON.parse(readFileSync('docs/parity-map.json', 'utf8'));
function check(mutate = () => {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'turno-parity-'));
  try {
    const rows = structuredClone(original);
    mutate(rows);
    const file = path.join(dir, 'map.json');
    writeFileSync(file, JSON.stringify(rows));
    return spawnSync(process.execPath, ['scripts/check-parity.mjs', file], {encoding: 'utf8'});
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
}

test('valid inventory reports pending work without certifying functional parity', () => {
  const result = check();
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.requirements, 212);
  assert.equal(report.planned, 182);
  assert.equal(report.verified, 30);
  assert.equal(report.functionalParity, 'NOT_EVALUATED');
});

test('missing or duplicated requirement identities fail the inventory check', () => {
  for (const mutate of [(rows) => rows.pop(), (rows) => {rows[1] = rows[0];}]) {
    const result = check(mutate);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /requirement|identity/i);
  }
});

test('changed canonical closure contracts fail', () => {
  const result = check((rows) => {rows[0].task = '1A';});
  assert.equal(result.status, 1);
  assert.match(result.stdout, /contract|task/i);
});

test('verified claims need existing test and review evidence files', () => {
  for (const mutate of [
    (row) => {row.targetTests = ['tests/unit/missing.test.ts'];},
    (row) => {row.reviewEvidence = 'evidence/missing.md';},
    (row) => {row.evidence = [];},
    (row) => {row.evidence = ['unknown-evidence'];},
  ]) {
    const result = check((rows) => mutate(rows.find((row) => row.status === 'verified')));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /target|evidence/i);
  }
});

test('unknown states and evidence paths outside the project fail closed', () => {
  for (const mutate of [
    (rows) => {rows[0].status = 'complete';},
    (rows) => {rows.find((row) => row.status === 'verified').reviewEvidence = '../frontend-v5/README.md';},
  ]) {
    const result = check(mutate);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /status|evidence/i);
  }
});

test('unit evidence cannot certify a requirement whose canonical closure needs a browser', () => {
  const result = check((rows) => Object.assign(rows[0], {
    status: 'verified', evidence: ['unit'],
    reviewEvidence: 'evidence/2A/reconciliation-20261109/AUDIT-2A.md',
    executionSourceSha: '72459f5ffc3c48db4202792208370b4ca92d5426',
    verificationScope: 'domain-adapter-nonvisual',
  }));
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /evidence.*browser/i);
});

test('blocked requirements remain visible as pending without closing evidence', () => {
  const result = check((rows) => Object.assign(rows[0], {
    status: 'blocked', rationale: 'Browser verification is awaiting an available engine.', evidence: [],
  }));
  assert.equal(result.status, 0, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.blocked, 1);
  assert.equal(report.planned, 181);
  assert.equal(report.verified, 30);
  assert.equal(report.pending, 182);
  assert.equal(report.functionalParity, 'NOT_EVALUATED');
});

test('blocked requirements need a rationale and well-formed evidence metadata', () => {
  for (const patch of [{rationale: ' '}, {evidence: 'unit'}]) {
    const result = check((rows) => Object.assign(rows[0], {status: 'blocked', ...patch}));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /rationale|evidence/i);
  }
});

test('reviewed behavior replacement may declare its own behavior and test destination', () => {
  const result = check((rows) => Object.assign(rows.find((row) => row.status === 'verified'), {
    status: 'replaced-by-behavior', rationale: 'Equivalent user behavior has a documented review.',
    targetBehavior: 'Equivalent draft behavior through a different implementation.',
    targetTests: ['tests/unit/store.test.ts'],
  }));
  assert.equal(result.status, 0, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.replacedByBehavior, 1);
  assert.equal(report.verified, 29);
  assert.equal(report.pending, 182);
  assert.equal(report.functionalParity, 'NOT_EVALUATED');
});

test('behavior replacement cannot omit rationale, review or closing evidence', () => {
  for (const [patch, error] of [
    [{rationale: ' '}, /rationale/i],
    [{reviewEvidence: 'evidence/missing.md'}, /review.*evidence/i],
    [{evidence: []}, /evidence/i],
    [{targetBehavior: ' '}, /behavior/i],
    [{targetTests: ['../frontend-v5/README.md']}, /target/i],
    [{sourceSha: '0000000000000000000000000000000000000000'}, /contract/i],
    [{task: '7B'}, /contract/i],
  ]) {
    const result = check((rows) => Object.assign(rows.find((row) => row.status === 'verified'), {
      status: 'replaced-by-behavior', ...patch,
    }));
    assert.equal(result.status, 1);
    assert.match(result.stdout, error);
  }
});


test('behavior replacement cannot use a symlink to a target outside the project', () => {
  const outside = mkdtempSync(path.join(tmpdir(), 'turno-outside-target-'));
  const inside = mkdtempSync(path.resolve('tests/tooling/target-link-'));
  try {
    const file = path.join(outside, 'external.test.ts');
    writeFileSync(file, '// External fixture, not an executed test.');
    const link = path.join(inside, 'external.test.ts');
    symlinkSync(file, link);
    const result = check((rows) => Object.assign(rows.find((row) => row.status === 'verified'), {
      status: 'replaced-by-behavior', targetTests: [path.relative(process.cwd(), link)],
    }));
    assert.equal(result.status, 1);
    assert.match(result.stdout, /target/i);
  } finally {
    rmSync(inside, {recursive: true, force: true});
    rmSync(outside, {recursive: true, force: true});
  }
});
