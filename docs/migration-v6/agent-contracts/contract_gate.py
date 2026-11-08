#!/usr/bin/env python3
"""Read-only contract checks. Never runs report commands or changes a repository."""
import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys

STATUSES = {'PASS', 'FAIL', 'BLOCKED', 'NOT RUN'}
KINDS = {'nonvisual', 'browser', 'visual', 'manual-at', 'host'}
FINAL_GATES = {**dict.fromkeys(['typecheck','lint','unit','component','build','bundle','parity'],'nonvisual'), **dict.fromkeys(['portable','chromium','firefox','webkit'],'browser'), 'visual':'visual', **dict.fromkeys(['manual-touch','manual-screenreader','manual-ime'],'manual-at')}
SOURCE_FIELDS = ('requirementId', 'sourceSha', 'sourceFile', 'sourceTest')

def relative(path):
    return isinstance(path, str) and bool(path) and '\\' not in path and not PurePosixPath(path).is_absolute() and not any(x in ('.', '..') for x in path.split('/'))

def contained(root, name):
    if not relative(name):
        return None
    root = Path(root).resolve()
    target = (root / name).resolve()
    return target if target.is_relative_to(root) else None

def scope_errors(changed, allowed):
    errors = []
    if not allowed or any(not relative(p) or not p.startswith('prototypes/frontend-v6/') for p in allowed):
        errors.append('Allowed scope must be explicit and confined to prototypes/frontend-v6/.')
    for path in changed:
        if not relative(path) or not any(fnmatch.fnmatchcase(path, pattern) for pattern in allowed):
            errors.append(f'Change outside scope: {path}')
    return errors

def check_inventory(matrix, baseline):
    errors = []
    if not isinstance(matrix, list) or not isinstance(baseline, list):
        return ['Parity inputs must be arrays.']
    if len(matrix) != 212 or len(baseline) != 212:
        errors.append('Both parity inventories must contain exactly 212 rows.')
    ids = [r.get('requirementId') for r in matrix]
    source_ids = [r.get('requirementId') for r in baseline]
    if len(set(ids)) != len(ids) or len(set(source_ids)) != len(source_ids):
        errors.append('Duplicate requirement ID.')
    if set(ids) != set(source_ids):
        errors.append('The exact baseline requirement IDs must be preserved.')
    original = {r['requirementId']: r for r in baseline}
    for row in matrix:
        reference = original.get(row.get('requirementId'))
        if reference and any(row.get(k) != reference.get(k) for k in SOURCE_FIELDS):
            errors.append(f"Changed baseline identity: {row.get('requirementId')}")
        if row.get('status') not in {'planned', 'verified', 'replaced-by-behavior', 'blocked'}:
            errors.append(f"Invalid parity status: {row.get('requirementId')}")
    return errors

def artifact_errors(root, record):
    path = contained(root, record.get('artifact'))
    if path is None or not path.is_file():
        return ['Evidence artifact is absent or escapes the artifact root.']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return [] if digest == record.get('artifactSha256') else ['Evidence artifact SHA256 mismatch.']

def validate(brief, report, matrix, baseline, root, observed_sha=None, observed_changes=None, observed_tree=None):
    errors = check_inventory(matrix, baseline)
    decision = report.get('decision')
    ready = decision in {'READY_FOR_REVIEW', 'APPROVE_PHASE', 'APPROVE_FINAL'}
    if decision not in {'STOP', 'READY_FOR_REVIEW', 'APPROVE_PHASE', 'APPROVE_FINAL'}:
        errors.append('Unknown decision.')
    if report.get('stage') not in {'phase', 'final'} or (decision == 'APPROVE_FINAL' and report.get('stage') != 'final'):
        errors.append('Final approval requires final scope; stage must be explicit.')
    if report.get('taskId') != brief.get('taskId'):
        errors.append('Task identity differs.')
    for name in ('baseSha', 'headSha'):
        if not re.fullmatch('[a-f0-9]{40}', str(brief.get(name, ''))):
            errors.append(f'Full SHA required: {name}')
    if report.get('headSha') != brief.get('headSha') or (ready and observed_sha != report.get('headSha')):
        errors.append('The report must match the current observed HEAD.')
    if ready and (not re.fullmatch('[a-f0-9]{64}',str(report.get('treeDigest',''))) or report.get('treeDigest') != observed_tree):
        errors.append('Current working tree digest is absent or different.')
    if ready and (brief.get('mode') != 'execute' or brief.get('executionAuthorized') is not True or not brief.get('acceptanceEvidence')):
        errors.append('Preparation or missing execution authorization cannot produce a ready decision.')
    if decision == 'STOP' and not report.get('blocker'):
        errors.append('STOP must name the blocker and smallest next step.')
    errors += scope_errors(observed_changes if observed_changes is not None else report.get('changedFiles', []), brief.get('allowedPaths', []))
    required = brief.get('gates', [])
    gates = report.get('gates', [])
    expected = {g['id']: g for g in required}
    actual = {g.get('id'): g for g in gates}
    if len(expected) != len(required) or len(actual) != len(gates) or set(expected) != set(actual):
        errors.append('Every declared gate needs exactly one result; no extra gates or duplicates.')
    for gate in gates:
        spec = expected.get(gate.get('id'), {})
        if gate.get('kind') not in KINDS or gate.get('kind') != spec.get('kind'):
            errors.append(f"Evidence class mismatch: {gate.get('id')}")
        if gate.get('command') != spec.get('command'):
            errors.append(f"Command differs from brief: {gate.get('id')}")
        if gate.get('status') not in STATUSES:
            errors.append('Invalid gate status.')
        if ready and spec.get('required') and gate.get('status') != 'PASS':
            errors.append(f"Required gate not PASS: {gate.get('id')}")
        if gate.get('status') == 'PASS':
            if gate.get('sha') != report.get('headSha') or gate.get('exitCode') != 0 or gate.get('treeDigest') != report.get('treeDigest'):
                errors.append(f"PASS lacks fresh SHA or exit zero: {gate.get('id')}")
            errors += artifact_errors(root, gate)
    if ready:
        if not isinstance(report.get('implementer'),str) or not report['implementer'].strip():
            errors.append('Implementer identity is required for independent review.')
        tdd = report.get('tdd', {})
        if tdd.get('redReason') != 'behavior':
            errors.append('A setup/import failure does not prove behavioral RED.')
        for key in ('redArtifact', 'greenArtifact'):
            path = contained(root, tdd.get(key))
            if path is None or not path.is_file():
                errors.append(f'TDD evidence missing: {key}')
        required_reviews = brief.get('requiredReviews', [])
        reviews = report.get('reviews', [])
        if len({r.get('role') for r in reviews}) != len(reviews):
            errors.append('Duplicate review role.')
        for role in required_reviews:
            review = next((r for r in reviews if r.get('role') == role), {})
            if review.get('status') != 'PASS' or review.get('sha') != report.get('headSha') or not review.get('reviewer') or review.get('treeDigest') != report.get('treeDigest'):
                errors.append(f'Missing fresh independent review: {role}')
            if review.get('reviewer') == report.get('implementer'):
                errors.append('Implementer cannot approve their own work.')
            errors += artifact_errors(root, review)
        if decision in {'APPROVE_PHASE', 'APPROVE_FINAL'} and not {'spec', 'quality'}.issubset(set(required_reviews)):
            errors.append('Approval requires specification and quality review gates.')
        if report.get('stage') == 'final':
            for gate_id, kind in FINAL_GATES.items():
                spec = expected.get(gate_id, {})
                if spec.get('required') is not True or spec.get('kind') != kind:
                    errors.append(f'Final acceptance gate missing or downgraded: {gate_id}')
            wanted = set(r['requirementId'] for r in baseline)
            if decision != 'APPROVE_FINAL':
                errors.append('Final stage needs an explicit final decision.')
            if not {'spec', 'quality'}.issubset(set(required_reviews)):
                errors.append('Final approval needs spec and quality reviews.')
        else:
            wanted = set(brief.get('requirements', []))
        by_id = {r['requirementId']: r for r in matrix}
        if (not wanted and not brief.get('additionalRequirements')) or not wanted.issubset(by_id):
            errors.append('Assigned requirement set is empty or unknown.')
        all_executed = {c for gate in gates if gate.get('status') == 'PASS' for c in gate.get('testCases', [])}
        for additional in brief.get('additionalRequirements', []):
            if not isinstance(additional, str) or not additional.startswith('EXTRA-') or additional not in all_executed:
                errors.append(f'Additional requirement is not executed: {additional}')
        for rid in wanted:
            row = by_id.get(rid, {})
            if row.get('status') not in {'verified', 'replaced-by-behavior'}:
                errors.append(f'Requirement not closed: {rid}')
            if row.get('status') == 'replaced-by-behavior' and (not row.get('rationale') or not row.get('reviewEvidence')):
                errors.append(f'Behavior replacement needs rationale and review: {rid}')
            targets = row.get('targetTests', [])
            cases = row.get('targetCases', [])
            if not targets or not cases:
                errors.append(f'Missing test target or testcase: {rid}')
            for test in targets:
                path = contained(root, test)
                if path is None or not path.is_file():
                    errors.append(f'Target test absent: {rid} {test}')
            relevant = [actual.get(i, {}) for i in row.get('evidence', [])]
            if not relevant or not all(g.get('status') == 'PASS' and g.get('sha') == report.get('headSha') for g in relevant):
                errors.append(f'No passing fresh evidence: {rid}')
            executed = {c for gate in relevant for c in gate.get('testCases', [])}
            if not set(cases).issubset(executed):
                errors.append(f'Target cases not present in execution results: {rid}')
    return errors

def read(path):
    return json.loads(Path(path).read_text())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', required=True)
    parser.add_argument('--matrix', required=True)
    parser.add_argument('--brief')
    parser.add_argument('--report')
    parser.add_argument('--root', default='.')
    parser.add_argument('--git-root')
    args = parser.parse_args()
    try:
        matrix, baseline = read(args.matrix), read(args.baseline)
        if not args.brief and not args.report:
            errors = check_inventory(matrix, baseline)
            purpose = 'inventory only; no execution, visual QA or parity completion certified'
        else:
            if not args.brief or not args.report:
                raise ValueError('--brief and --report must be supplied together')
            brief, report = read(args.brief), read(args.report)
            sha, changes, tree = None, None, None
            if args.git_root:
                def git(*cmd):
                    return subprocess.check_output(['git', '-C', args.git_root, *cmd], text=True).strip()
                sha = git('rev-parse', 'HEAD')
                paths = git('diff', '--name-only', brief['baseSha'], '--').splitlines()
                paths += git('ls-files', '--others', '--exclude-standard').splitlines()
                changes = sorted(set(paths))
                names = subprocess.check_output(['git','-C',args.git_root,'ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
                digest = hashlib.sha256()
                for name in sorted(set(n for n in names if n)):
                    path = Path(args.git_root) / name
                    data = os.readlink(path).encode() if path.is_symlink() else (path.read_bytes() if path.is_file() else b'<absent>')
                    digest.update(name.encode()+b'\0'+hashlib.sha256(data).digest())
                tree = digest.hexdigest()
            errors = validate(brief, report, matrix, baseline, args.root, observed_sha=sha, observed_changes=changes, observed_tree=tree)
            if report.get('decision') != 'STOP' and not args.git_root:
                errors.append('No --git-root: fresh HEAD and scope are not independently observed.')
            purpose = 'metadata and artifact integrity only; inspect actual logs, behavior and independent reviews'
        print(json.dumps({'status':'FAIL' if errors else 'PASS','scope':purpose,'errors':errors},ensure_ascii=False,indent=2))
        return 1 if errors else 0
    except (OSError, ValueError, KeyError, TypeError, subprocess.CalledProcessError) as exc:
        print(json.dumps({'status':'BLOCKED','error':str(exc)},ensure_ascii=False))
        return 2
if __name__ == '__main__':
    sys.exit(main())
