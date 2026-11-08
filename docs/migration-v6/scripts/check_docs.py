#!/usr/bin/env python3
"""Validate documentation and source inventory without running product or browser."""
import ast
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlparse

DOCS = Path(__file__).resolve().parents[1]
ROOT = DOCS.parents[1]
SOURCE_SHA = '0f534df9bd5b012b4ec21c202a055e1e913bcab5'
SOURCE_TREE = '3003fe5b2b5dd7d7620564a1ec1e75df510ca06a'
DOC_ONLY_EXCEPTIONS = {'README.md', 'prototypes/frontend-v5/docs/MIGRACION_REACT.md', 'prototypes/frontend-v5/README.md', 'prototypes/frontend-v5/docs/MOTION_V6.md'}
APPROVED_DELTA_FIELDS = {'path', 'baselineSha', 'sha', 'commit', 'reason', 'approval'}

TASK_ORDER = ('0', '1A', '1B', '2A', '2B', '3A', '4A', '4B', '5A', '6A', '7A', '7B')
TEST_CREATION_TASKS = {
    **dict.fromkeys(['tests/unit/home-subtitle.test.ts', 'tests/component/theme-home.test.tsx', 'tests/e2e/offline-theme.spec.ts'], '1A'),
    **dict.fromkeys(['tests/unit/format.test.ts', 'tests/unit/validation.test.ts', 'tests/unit/draft.test.ts', 'tests/unit/preview.test.ts'], '2A'),
    **dict.fromkeys(['tests/unit/history-controller.test.ts', 'tests/e2e/history.spec.ts'], '2B'),
    **dict.fromkeys(['tests/component/navigation.test.tsx', 'tests/e2e/responsive.spec.ts', 'tests/e2e/overlays.spec.ts'], '3A'),
    **dict.fromkeys(['tests/component/editor.test.tsx', 'tests/component/time-panel.test.tsx', 'tests/component/agenda.test.tsx', 'tests/e2e/editor.spec.ts'], '4A'),
    **dict.fromkeys(['tests/component/domain-dialogs.test.tsx', 'tests/e2e/shift-lifecycle.spec.ts'], '4B'),
    **dict.fromkeys(['tests/unit/notification-store.test.ts', 'tests/component/notifications.test.tsx', 'tests/e2e/notifications.spec.ts'], '5A'),
    **dict.fromkeys(['tests/unit/motion-policy.test.ts', 'tests/e2e/motion.spec.ts'], '6A'),
    'tests/e2e/accessibility.spec.ts': '7A',
}

def render_parity_annex(matrix):
    lines = ['# Anexo B · Matriz inicial de paridad', '',
             '**212 requisitos fuente; todos planned para React, sin evidencia v6.** `tarea` indica el primer cierre planificado con el comportamiento completo integrado; preparación/harness no cierra la identidad. Destinos bajo `prototypes/frontend-v6/`, aún por crear. El checker preserva el contrato de cierre del canon y exige la clase de evidencia aplicable, además del SHA/árbol y testcases. Repetir al cierre final toda evidencia afectada por cambios posteriores.', '']
    from itertools import groupby
    for filename, rows in groupby(matrix, key=lambda r: r['sourceFile']):
        rows = list(rows)
        lines.extend(['', f'## {Path(filename).name} ({len(rows)})', ''])
        for row in rows:
            lines.extend([f'- **{row["requirementId"]} · tarea {row["task"]} · {row["status"]}**',
                          f'  Fuente: {row["sourceTest"]}',
                          '  Destino: ' + ', '.join('`' + x + '`' for x in row['targetTests']) + '.',
                          f'  Preparación: {row["preparationTask"]}; integración: ' + ', '.join(row['integrationTasks']) + '; evidencia de cierre: ' + ', '.join(row['closureEvidenceKinds']) + '.',
                          f'  Dependencia: {row["integrationRationale"]}'])
            if row.get('finalTargetTests'):
                lines.append('  Regresión final: ' + ', '.join('`' + x + '`' for x in row['finalTargetTests']) + '.')
            if row['targetBehavior'] != row['sourceTest']:
                lines.extend([f'  Resultado de v6: {row["targetBehavior"]}', f'  Equivalencia propuesta: {row["rationale"]}'])
    return '\n'.join(lines) + '\n'

def check_assignments(matrix, plan, brief):
    errors = []
    for row in matrix:
        rid, task, prep = row['requirementId'], row.get('task'), row.get('preparationTask')
        tasks, kinds = row.get('integrationTasks'), row.get('closureEvidenceKinds')
        if task not in TASK_ORDER or prep not in TASK_ORDER or TASK_ORDER.index(prep) > TASK_ORDER.index(task):
            errors.append(f'Invalid preparation/closure task: {rid}')
            continue
        if not isinstance(tasks, list) or not tasks or tasks[-1] != task or len(set(tasks)) != len(tasks) or any(t not in TASK_ORDER or TASK_ORDER.index(t) > TASK_ORDER.index(task) for t in tasks):
            errors.append(f'Invalid integration dependencies: {rid}')
        if not isinstance(kinds, list) or not kinds or len(set(kinds)) != len(kinds) or any(k not in {'nonvisual', 'browser', 'visual', 'manual-at'} for k in kinds) or not row.get('integrationRationale'):
            errors.append(f'Missing closure evidence/rationale: {rid}')
        for target in row['targetTests']:
            created = TEST_CREATION_TASKS.get(target)
            if created is None or TASK_ORDER.index(created) > TASK_ORDER.index(task):
                errors.append(f'Target test not available at closure: {rid} {target}')
        final_targets = row.get('finalTargetTests', [])
        if not isinstance(final_targets, list) or len(set(final_targets)) != len(final_targets) or any(target not in TEST_CREATION_TASKS for target in final_targets):
            errors.append(f'Invalid final regression targets: {rid}')
    if '# Anexo B' not in plan or plan[plan.index('# Anexo B'):] != render_parity_annex(matrix):
        errors.append('Plan annex differs from canonical matrix task/targets/integration contract.')
    expected = [r['requirementId'] for r in matrix if r['task'] == '1A']
    if brief.get('requirements') != expected:
        errors.append('Brief 1A must exactly match the canonical 1A closure subset.')
    deferred = [{'requirementId': r['requirementId'], 'closureTask': r['task']} for r in matrix if r['preparationTask'] == '1A' and r['task'] != '1A']
    if brief.get('deferredRequirements') != deferred:
        errors.append('Brief 1A deferred integration obligations differ from canonical matrix.')
    return errors


def check():
    errors = []
    json_files = sorted(DOCS.rglob('*.json'))
    parsed = {p: json.loads(p.read_text()) for p in json_files}
    matrix = parsed[DOCS / 'parity-map.json']
    manifest = parsed[DOCS / 'baseline-files.json']
    if manifest['sourceSha'] != SOURCE_SHA or manifest['sourceTreeSha'] != SOURCE_TREE:
        errors.append('Unexpected source commit/tree in baseline manifest.')
    blobs = manifest['blobs']
    if len(blobs) != 83 or len({x['path'] for x in blobs}) != 83:
        errors.append('Baseline must contain 83 distinct blob paths.')
    # Approved deltas: test-harness-only changes accepted by the owner (for example a fixed sleep
    # replaced by a wait on the same observable condition). Product code and assets never qualify,
    # and the requirement identities (test names) must stay the same; that is checked below.
    baseline_sha = {x['path']: x['sha'] for x in blobs}
    deltas = {}
    for delta in manifest.get('approvedDeltas', []):
        rel = delta.get('path', '')
        if set(delta) != APPROVED_DELTA_FIELDS or not all(isinstance(delta[k], str) and delta[k].strip() for k in APPROVED_DELTA_FIELDS):
            errors.append(f'Approved delta needs exactly {sorted(APPROVED_DELTA_FIELDS)}: {rel}')
        elif not (rel.startswith('prototypes/frontend-v5/tests/') and rel.endswith('.test.mjs')):
            errors.append(f'Approved delta outside v5 test files: {rel}')
        elif baseline_sha.get(rel) != delta['baselineSha']:
            errors.append(f'Approved delta does not start from the baseline blob: {rel}')
        elif rel in deltas:
            errors.append(f'Duplicate approved delta: {rel}')
        else:
            deltas[rel] = delta
    # When a Git checkout is available, tie each delta to a real commit in this history that holds
    # exactly that blob. This pins provenance; it does not replace the human review of the diff to
    # baseline-files.json, which is the actual approval.
    if deltas and (ROOT / '.git').exists():
        import subprocess
        def git(*args):
            return subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, text=True)
        for rel, delta in deltas.items():
            commit = delta['commit']
            if git('merge-base', '--is-ancestor', commit, 'HEAD').returncode != 0:
                errors.append(f'Approved delta commit is not in this history: {rel} {commit}')
            elif git('rev-parse', f'{commit}:{rel}').stdout.strip() != delta['sha']:
                errors.append(f'Approved delta blob differs from its commit: {rel}')
    for blob in blobs:
        rel = blob['path']
        path = (ROOT / rel).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            errors.append(f'Absent or invalid baseline file: {rel}')
            continue
        data = path.read_bytes()
        sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if rel not in DOC_ONLY_EXCEPTIONS and sha != blob['sha'] and not (rel in deltas and sha == deltas[rel]['sha']):
            errors.append(f'Original product/test/asset changed: {rel}')
    if len(matrix) != 212 or len({r['requirementId'] for r in matrix}) != 212:
        errors.append('Expected exactly 212 distinct requirement IDs.')
    identities = {(r['sourceFile'], r['sourceTest']) for r in matrix}
    source_files = {r['sourceFile'] for r in matrix}
    if len(source_files) != 16 or len(identities) != 212:
        errors.append('Expected 212 source identities from 16 test files.')
    found = set()
    pattern = re.compile(r"\btest\(\s*((?:'(?:[^'\\]|\\.)*')|(?:\"(?:[^\"\\]|\\.)*\"))\s*,")
    for rel in source_files:
        for match in pattern.finditer((ROOT / rel).read_text()):
            found.add((rel, ast.literal_eval(match.group(1))))
    if found != identities:
        errors.append(f'Source inventory mismatch: missing={sorted(found-identities)}, unknown={sorted(identities-found)}')
    for row in matrix:
        if row['sourceSha'] != SOURCE_SHA or row['status'] != 'planned' or row['evidence']:
            errors.append(f'Unexpected source/status/evidence: {row["requirementId"]}')
        if not row.get('targetTests') or not row.get('targetCases') or not row.get('targetBehavior'):
            errors.append(f'Missing planned target: {row["requirementId"]}')
    plan = (DOCS / 'PLAN.md').read_text()
    risks = parsed[DOCS / 'migration-risks.json']
    sys.path.insert(0, str(DOCS / 'agent-contracts'))
    from contract_gate import MIGRATION_CONTROL_IDS, KINDS
    risk_ids = {r['id'] for r in risks}
    if len(risks) != len(MIGRATION_CONTROL_IDS) or risk_ids != MIGRATION_CONTROL_IDS:
        errors.append('Canonical migration control map is incomplete or duplicated.')
    lessons = (DOCS / 'EXECUTION_LESSONS.md').read_text()
    cases = (DOCS / 'CASOS_REALES.md').read_text()
    for risk in risks:
        if risk['id'] not in plan or risk['id'] not in lessons:
            errors.append(f'Migration control is not integrated in plan/method: {risk["id"]}')
        if risk.get('status') != 'planned' or not risk.get('targetTests') or not risk.get('oracle'):
            errors.append(f'Invalid planned migration control: {risk["id"]}')
        if not risk.get('sources') or any(url not in cases for url in risk['sources']):
            errors.append(f'Migration control source absent from studied cases: {risk["id"]}')
        entries = risk.get('final', []) + [e for task in risk.get('tasks', {}).values() for e in task]
        if not entries or any(not e.get('gate') or e.get('kind') not in KINDS for e in entries):
            errors.append(f'Migration control evidence class missing: {risk["id"]}')
    brief = parsed[DOCS / 'agent-contracts/examples/brief-1A.json']
    expected_extras = {r['id'] for r in risks if '1A' in r['tasks']}
    if not expected_extras.issubset(set(brief.get('additionalRequirements', []))):
        errors.append('Example 1A omits required migration controls.')
    errors += check_assignments(matrix, plan, brief)
    plan_ids = re.findall(r'\*\*([A-Z]+(?:-[A-Z]+)*-\d+) · tarea', plan)
    if len(plan_ids) != 212 or set(plan_ids) != {r['requirementId'] for r in matrix}:
        errors.append('Plan annex and JSON requirement IDs differ.')
    markdown = sorted(DOCS.rglob('*.md')) + [ROOT / p for p in DOC_ONLY_EXCEPTIONS]
    links = 0
    for path in markdown:
        text = path.read_text()
        if any(line.startswith("+") for line in text.splitlines()):
            errors.append(f"Unrendered patch marker in {path.relative_to(ROOT)}")
        for target in re.findall(r'\[[^\]\n]*\]\(([^)\s]+)\)', text):
            parsed_url = urlparse(target)
            if parsed_url.scheme or target.startswith('#'):
                continue
            links += 1
            dest = (path.parent / unquote(parsed_url.path)).resolve()
            if not dest.is_relative_to(ROOT) or not dest.exists():
                errors.append(f'Broken local link in {path.relative_to(ROOT)}: {target}')
            elif re.fullmatch(r'L\d+(?:-L\d+)?', parsed_url.fragment) and dest.is_file():
                maximum = int(parsed_url.fragment.split('L')[-1])
                if maximum > len(dest.read_text().splitlines()):
                    errors.append(f'Invalid line anchor: {target}')
    return errors, len(json_files), len(markdown), links

if __name__ == '__main__':
    try:
        errors, json_count, md_count, links = check()
        print(json.dumps({'status': 'FAIL' if errors else 'PASS', 'jsonFiles': json_count,
                          'markdownFiles': md_count, 'localLinks': links, 'requirements': 212,
                          'sourceTestFiles': 16, 'migrationControls': 6, 'scope': 'documentation/source inventory only',
                          'errors': errors}, ensure_ascii=False, indent=2))
        sys.exit(1 if errors else 0)
    except (OSError, ValueError, KeyError, TypeError, SyntaxError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'error': str(exc)}, ensure_ascii=False))
        sys.exit(2)
