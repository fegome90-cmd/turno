#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PY=${STRANDS_EVALS_PYTHON:-}
[[ -n "$PY" && -x "$PY" ]] || { echo "BLOCKED: STRANDS_EVALS_PYTHON must point to the evaluation venv" >&2; exit 2; }
"$PY" -c 'import sys; from importlib.metadata import version; assert sys.version_info >= (3,12); assert version("strands-agents-evals") == "1.9.0"' || { echo "BLOCKED: Python >=3.12 and Strands Evals 1.9.0 required" >&2; exit 2; }
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
export TURNO_AI_ENABLED=0
export TURNO_SYNTHETIC_ONLY=1
"$PY" -m unittest discover -s eval/strands -p 'test_*.py' -v
node eval/run-note-eval.mjs --holdout > "$OUT/report.json"
node eval/strands/export-manifest.mjs > "$OUT/manifest.json"
node eval/strands/prepare-report.mjs "$OUT/report.json" > "$OUT/observed.json"
"$PY" eval/strands/verify_report.py --manifest "$OUT/manifest.json" --report "$OUT/observed.json"
