#!/usr/bin/env bash
# Default (CI): offline holdout run (22 cases) checked against the 22-case manifest.
# Optional: VERIFY_REPORT=<run.json> VERIFY_SET=holdout|extended|extended-probe
#   checks an existing report (e.g. a live multi-rep run) against that set's manifest instead.
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
if [[ -n "${VERIFY_REPORT:-}" || -n "${VERIFY_SET:-}" ]]; then
  [[ -n "${VERIFY_REPORT:-}" && -n "${VERIFY_SET:-}" ]] || { echo "BLOCKED: VERIFY_REPORT and VERIFY_SET must be given together" >&2; exit 2; }
  [[ -f "$VERIFY_REPORT" ]] || { echo "BLOCKED: VERIFY_REPORT is not a file" >&2; exit 2; }
  node eval/strands/export-manifest.mjs --set "$VERIFY_SET" > "$OUT/manifest.json"
  node eval/strands/prepare-report.mjs "$VERIFY_REPORT" > "$OUT/observed.json"
  "$PY" eval/strands/verify_report.py --manifest "$OUT/manifest.json" --report "$OUT/observed.json"
  exit 0
fi
node eval/run-note-eval.mjs --holdout > "$OUT/report.json"
node eval/strands/export-manifest.mjs > "$OUT/manifest.json"
node eval/strands/prepare-report.mjs "$OUT/report.json" > "$OUT/observed.json"
"$PY" eval/strands/verify_report.py --manifest "$OUT/manifest.json" --report "$OUT/observed.json"
