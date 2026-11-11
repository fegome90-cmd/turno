#!/usr/bin/env bash
# Gates 2A en orden, desde prototypes/frontend-v6, concurrencia 1. Registra el código real de cada comando.
# Uso: run-gates.sh static|e2e <n>
set -u
export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH
cd /home/user/turno/prototypes/frontend-v6
OUT=evidence/2A/gates
mkdir -p "$OUT"
run() { local name="$1"; shift; "$@" > "$OUT/$name.log" 2>&1; local code=$?; echo "$name | $* | exit=$code | log=$OUT/$name.log" | tee -a "$OUT/summary.txt"; return $code; }
if [ "${1:-static}" = "static" ]; then
  npm audit --include=dev --json > evidence/2A/audit-total.audit.json 2> evidence/2A/audit-total.stderr.log; echo "audit-total | npm audit --include=dev --json | exit=$? | artifact=evidence/2A/audit-total.audit.json" | tee -a "$OUT/summary.txt"
  npm audit --omit=dev --json > evidence/2A/audit-runtime.audit.json 2> evidence/2A/audit-runtime.stderr.log; echo "audit-runtime | npm audit --omit=dev --json | exit=$? | artifact=evidence/2A/audit-runtime.audit.json" | tee -a "$OUT/summary.txt"
  run typecheck npm run typecheck
  run lint npm run lint
  run test-unit npm run test:unit
  run test-component npm run test:component
  run build npm run build
  sha256sum dist/preview.html | tee evidence/2A/dist-preview.sha256 | tee -a "$OUT/summary.txt"
  run check-portable npm run check:portable
  run measure-bundle npm run measure:bundle
else
  run "test-e2e-run$2" npm run test:e2e
fi
