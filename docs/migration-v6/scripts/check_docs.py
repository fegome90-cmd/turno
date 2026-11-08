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
DOC_ONLY_EXCEPTIONS = {'README.md', 'prototypes/frontend-v5/docs/MIGRACION_REACT.md'}

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
    for blob in blobs:
        rel = blob['path']
        path = (ROOT / rel).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file():
            errors.append(f'Absent or invalid baseline file: {rel}')
            continue
        data = path.read_bytes()
        sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if rel not in DOC_ONLY_EXCEPTIONS and sha != blob['sha']:
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
    plan_ids = re.findall(r'\*\*([A-Z]+(?:-[A-Z]+)*-\d+) · tarea', plan)
    if len(plan_ids) != 212 or set(plan_ids) != {r['requirementId'] for r in matrix}:
        errors.append('Plan annex and JSON requirement IDs differ.')
    markdown = sorted(DOCS.rglob('*.md')) + [ROOT / p for p in DOC_ONLY_EXCEPTIONS]
    links = 0
    for path in markdown:
        text = path.read_text()
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
                          'sourceTestFiles': 16, 'scope': 'documentation/source inventory only',
                          'errors': errors}, ensure_ascii=False, indent=2))
        sys.exit(1 if errors else 0)
    except (OSError, ValueError, KeyError, TypeError, SyntaxError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'error': str(exc)}, ensure_ascii=False))
        sys.exit(2)
