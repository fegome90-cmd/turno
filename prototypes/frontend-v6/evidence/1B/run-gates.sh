#!/usr/bin/env bash
# Gates 1B en orden, desde prototypes/frontend-v6, concurrencia 1. Registra código real de cada comando.
set -u
export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH
cd /home/user/turno/prototypes/frontend-v6
OUT=evidence/1B/gates
mkdir -p "$OUT"
run() { local name="$1"; shift; "$@" > "$OUT/$name.log" 2>&1; local code=$?; echo "$name | $* | exit=$code | log=$OUT/$name.log"; }
npm audit --include=dev --json > evidence/1B/audit-total.audit.json 2> evidence/1B/audit-total.stderr.log; echo "audit-total | npm audit --include=dev --json | exit=$? | artifact=evidence/1B/audit-total.audit.json"
npm audit --omit=dev --json > evidence/1B/audit-runtime.audit.json 2> evidence/1B/audit-runtime.stderr.log; echo "audit-runtime | npm audit --omit=dev --json | exit=$? | artifact=evidence/1B/audit-runtime.audit.json"
run typecheck npm run typecheck
run lint npm run lint
run test-unit npm run test:unit
run test-component npm run test:component
run build npm run build
run check-portable npm run check:portable
run measure-bundle npm run measure:bundle
for i in 1 2 3; do run "test-e2e-run$i" npm run test:e2e; done
sha256sum dist/preview.html
