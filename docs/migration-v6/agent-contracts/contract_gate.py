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
AUDIT_COMMANDS = {'audit-total': 'npm audit --include=dev --json', 'audit-runtime': 'npm audit --omit=dev --json'}
TASK_ORDER = ('0', '1A', '1B', '2A', '2B', '3A', '4A', '4B', '5A', '6A', '7A', '7B')
CLOSURE_FIELDS = ('task', 'preparationTask', 'integrationTasks', 'closureEvidenceKinds', 'finalTargetTests')
SOURCE_FIELDS = ('requirementId', 'sourceSha', 'sourceFile', 'sourceTest')
MIGRATION_CONTROL_IDS = {'EXTRA-LIFECYCLE-ASYNC', 'EXTRA-STATE-AUTHORITY', 'EXTRA-NATIVE-EDIT', 'EXTRA-PERFORMANCE-FLOWS', 'EXTRA-OFFLINE-ARTIFACT', 'EXTRA-ROLLBACK-PHASE'}

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
        if reference and ('integrationTasks' in reference or 'finalTargetTests' in reference) and any(row.get(k) != reference.get(k) for k in CLOSURE_FIELDS):
            errors.append(f"Changed canonical closure contract: {row.get('requirementId')}")
        if row.get('status') not in {'planned', 'verified', 'replaced-by-behavior', 'blocked'}:
            errors.append(f"Invalid parity status: {row.get('requirementId')}")
    return errors

def artifact_errors(root, record):
    path = contained(root, record.get('artifact'))
    if path is None or not path.is_file():
        return ['Evidence artifact is absent or escapes the artifact root.']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    return [] if digest == record.get('artifactSha256') else ['Evidence artifact SHA256 mismatch.']

def check_migration_risks(brief, report, risks):
    """Bind additional controls to their existing phase gate and evidence class."""
    if report.get('decision') not in {'READY_FOR_REVIEW', 'APPROVE_PHASE', 'APPROVE_FINAL'}:
        return []
    errors = []
    final = report.get('stage') == 'final'
    assigned = set(brief.get('additionalRequirements', []))
    expected = {g['id']: g for g in brief.get('gates', [])}
    actual = {g.get('id'): g for g in report.get('gates', [])}
    for risk in risks:
        required = risk['final'] if final else risk['tasks'].get(brief.get('taskId'), [])
        if not required:
            continue
        rid = risk['id']
        if rid not in assigned:
            errors.append(f'Required migration control omitted from brief: {rid}')
        for evidence in required:
            gid, kind = evidence['gate'], evidence['kind']
            spec, gate = expected.get(gid, {}), actual.get(gid, {})
            if spec.get('required') is not True or spec.get('kind') != kind:
                errors.append(f'Migration control gate missing or wrong class: {rid} {gid}')
            if gate.get('kind') != kind or gate.get('status') != 'PASS' or rid not in gate.get('testCases', []):
                errors.append(f'Migration control lacks passing evidence in its required gate: {rid} {gid}')
    return errors

def check_dependency_audits(brief, report, root, dependency_root):
    """Fail closed on npm v2 audit evidence; exceptions never turn findings green."""
    errors = []
    ready = report.get('decision') != 'STOP'
    product_tasks = {'1A', '1B', '2A', '2B', '3A', '4A', '4B', '5A', '6A', '7A', '7B'}
    mandatory = brief.get('taskId') in product_tasks or report.get('stage') == 'final'
    specs = {g.get('id'): g for g in brief.get('gates', [])}
    gates = {g.get('id'): g for g in report.get('gates', [])}
    artifacts = [gates[gid].get('artifact') for gid in AUDIT_COMMANDS if gid in gates and gates[gid].get('status') in {'PASS', 'FAIL'}]
    if len(artifacts) == 2 and artifacts[0] == artifacts[1]:
        errors.append('Total and runtime dependency audits require separate artifacts.')
    for gid, command in AUDIT_COMMANDS.items():
        spec, gate = specs.get(gid, {}), gates.get(gid, {})
        if ready and mandatory and (spec.get('required') is not True or spec.get('kind') != 'nonvisual' or not gate):
            errors.append(f'Required dependency audit omitted or downgraded: {gid}')
        if not gate:
            continue
        if gate.get('command') != command or spec.get('command') != command or gate.get('kind') != 'nonvisual':
            errors.append(f'Incorrect dependency audit command/class: {gid}')
        if gate.get('status') in {'NOT RUN', 'BLOCKED'}:
            if not gate.get('reason'):
                errors.append(f'Unexecuted audit must explain infrastructure blocker: {gid}')
            continue
        prefix = f'Dependency audit {gid}: '
        if gate.get('sha') != report.get('headSha') or gate.get('treeDigest') != report.get('treeDigest'):
            errors.append(prefix + 'stale commit/tree context.')
        context = gate.get('context', {})
        if not isinstance(context, dict):
            errors.append(prefix + 'context must be an object.')
            continue
        if context.get('cwd') != 'prototypes/frontend-v6' or any(not isinstance(context.get(k), str) or not context[k].strip() for k in ('nodeVersion', 'npmVersion', 'registry', 'observedAt')):
            errors.append(prefix + 'missing execution context.')
        for name, key in [('package.json', 'packageSha256'), ('package-lock.json', 'lockSha256')]:
            path = contained(dependency_root, 'prototypes/frontend-v6/' + name) if dependency_root is not None else None
            if path is None or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != context.get(key):
                errors.append(prefix + 'current manifest/lock identity missing or different: ' + name)
        problems = artifact_errors(root, gate)
        errors.extend(prefix + problem for problem in problems)
        if problems:
            continue
        try:
            payload = read(contained(root, gate.get('artifact')))
        except (ValueError, OSError):
            errors.append(prefix + 'invalid JSON is infrastructure failure, not audit PASS/FAIL.')
            continue
        if not isinstance(payload, dict) or payload.get('error') or payload.get('auditReportVersion') != 2:
            errors.append(prefix + 'npm error or unsupported audit output; use BLOCKED.')
            continue
        findings = payload.get('vulnerabilities')
        metadata = payload.get('metadata')
        counts = metadata.get('vulnerabilities') if isinstance(metadata, dict) else None
        severities = ('info', 'low', 'moderate', 'high', 'critical')
        if not isinstance(findings, dict) or not isinstance(counts, dict) or any(type(counts.get(k)) is not int or counts[k] < 0 for k in (*severities, 'total')):
            errors.append(prefix + 'missing/invalid vulnerability inventory.')
            continue
        malformed = any(not isinstance(v, dict) or v.get('name') != name or v.get('severity') not in severities or not isinstance(v.get('via'), list) or not v['via'] or not isinstance(v.get('nodes'), list) or not v['nodes'] for name, v in findings.items())
        if malformed or counts['total'] != len(findings) or any(counts[k] != sum(v.get('severity') == k for v in findings.values() if isinstance(v, dict)) for k in severities):
            errors.append(prefix + 'inconsistent vulnerability inventory/counts.')
            continue
        has_findings = bool(findings)
        if type(gate.get('exitCode')) is not int or gate['exitCode'] != (1 if has_findings else 0) or gate.get('status') != ('FAIL' if has_findings else 'PASS'):
            errors.append(prefix + 'status/exit contradict native findings; vulnerabilities cannot PASS.')
        risks = gate.get('risks')
        if not isinstance(risks, list) or any(not isinstance(r, dict) for r in risks):
            errors.append(prefix + 'explicit risk inventory required (empty when clean).')
            continue
        names = [r.get('package') for r in risks]
        if any(not isinstance(n, str) for n in names) or len(set(n for n in names if isinstance(n, str))) != len(names) or set(n for n in names if isinstance(n, str)) != set(findings):
            errors.append(prefix + 'risks must cover each vulnerable package exactly once.')
        for risk in risks:
            if risk.get('disposition') not in {'unresolved', 'accepted'} or any(not isinstance(risk.get(k), str) or not risk[k].strip() for k in ('justification', 'owner')):
                errors.append(prefix + 'risk needs disposition, justification and owner.')
            if risk.get('disposition') == 'accepted' and not risk.get('acceptanceEvidence'):
                errors.append(prefix + 'accepted risk lacks explicit approval evidence; still FAIL.')
    return errors

def validate(brief, report, matrix, baseline, root, observed_sha=None, observed_changes=None, observed_tree=None, risks=None, dependency_root=None):
    errors = check_inventory(matrix, baseline)
    decision = report.get('decision')
    ready = decision in {'READY_FOR_REVIEW', 'APPROVE_PHASE', 'APPROVE_FINAL'}
    if ready and brief.get('taskId') not in TASK_ORDER:
        errors.append('Unknown taskId cannot produce a ready/approval decision.')
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
        canonical = {r['requirementId']: r for r in baseline}
        by_id = {r['requirementId']: r for r in matrix}
        if (not wanted and not brief.get('additionalRequirements')) or not wanted.issubset(by_id):
            errors.append('Assigned requirement set is empty or unknown.')
        if report.get('stage') != 'final' and brief.get('taskId') in TASK_ORDER:
            for candidate in matrix:
                reference = canonical.get(candidate['requirementId'], {})
                if reference.get('task') in TASK_ORDER and candidate.get('status') in {'verified', 'replaced-by-behavior'} and TASK_ORDER.index(reference['task']) > TASK_ORDER.index(brief['taskId']):
                    errors.append(f"Future requirement marked closed before phase {reference['task']}: {candidate['requirementId']}")
        all_executed = {c for gate in gates if gate.get('status') == 'PASS' for c in gate.get('testCases', [])}
        for additional in brief.get('additionalRequirements', []):
            if not isinstance(additional, str) or not additional.startswith('EXTRA-') or additional not in all_executed:
                errors.append(f'Additional requirement is not executed: {additional}')
        for rid in wanted:
            row = by_id.get(rid, {})
            contract = canonical.get(rid, {})
            if 'integrationTasks' in contract:
                closure = contract.get('task')
                current = brief.get('taskId')
                if report.get('stage') != 'final' and (current not in TASK_ORDER or closure not in TASK_ORDER or TASK_ORDER.index(current) < TASK_ORDER.index(closure)):
                    errors.append(f'Requirement cannot close before integrated phase {closure}: {rid}')
            if row.get('status') not in {'verified', 'replaced-by-behavior'}:
                errors.append(f'Requirement not closed: {rid}')
            if row.get('status') == 'replaced-by-behavior' and (not row.get('rationale') or not row.get('reviewEvidence')):
                errors.append(f'Behavior replacement needs rationale and review: {rid}')
            targets = row.get('targetTests', [])
            cases = row.get('targetCases', [])
            if not targets or not cases:
                errors.append(f'Missing test target or testcase: {rid}')
            final_targets = contract.get('finalTargetTests', []) if report.get('stage') == 'final' else []
            for test in list(dict.fromkeys(targets + final_targets)):
                path = contained(root, test)
                if path is None or not path.is_file():
                    errors.append(f'Target test absent: {rid} {test}')
            relevant = [actual.get(i, {}) for i in row.get('evidence', [])]
            if not relevant or not all(g.get('status') == 'PASS' and g.get('sha') == report.get('headSha') for g in relevant):
                errors.append(f'No passing fresh evidence: {rid}')
            for kind in contract.get('closureEvidenceKinds', []):
                matching = [g for g in relevant if g.get('status') == 'PASS' and g.get('kind') == kind and set(cases).issubset(set(g.get('testCases', [])))]
                if kind == 'browser':
                    matching = [g for g in matching if g.get('scope') == 'product-integration' and set(contract.get('integrationTasks', [])).issubset(set(g.get('integrationTasks', [])))]
                if not matching:
                    errors.append(f'Requirement lacks {kind} product integration evidence: {rid}')
            executed = {c for gate in relevant for c in gate.get('testCases', [])}
            if not set(cases).issubset(executed):
                errors.append(f'Target cases not present in execution results: {rid}')
    errors += check_dependency_audits(brief, report, root, dependency_root)
    errors += check_migration_risks(brief, report, risks or [])
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
            risks = read(Path(__file__).resolve().parents[1] / 'migration-risks.json')
            if len(risks) != len(MIGRATION_CONTROL_IDS) or {r['id'] for r in risks} != MIGRATION_CONTROL_IDS:
                raise ValueError('Canonical migration control map is incomplete or changed.')
            errors = validate(brief, report, matrix, baseline, args.root, observed_sha=sha, observed_changes=changes, observed_tree=tree, risks=risks, dependency_root=args.git_root)
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
