#!/usr/bin/env bash
set -u
export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH
cd /home/user/turno/prototypes/frontend-v6
OUT=evidence/2A/review/gates
S=$OUT/summary.txt; : > $S
run() { local name="$1"; shift; "$@" > "$OUT/$name.log" 2>&1; local c=$?; echo "$name | $* | exit=$c" | tee -a $S; }
run npm-ci npm ci --ignore-scripts
npm audit --include=dev --json > $OUT/audit-total.json 2> $OUT/audit-total.err; echo "audit-total | exit=$?" | tee -a $S
npm audit --omit=dev --json > $OUT/audit-runtime.json 2> $OUT/audit-runtime.err; echo "audit-runtime | exit=$?" | tee -a $S
run typecheck npm run typecheck
run lint npm run lint
run test-unit npm run test:unit
run test-component npm run test:component
run build npm run build
sha256sum dist/preview.html | tee $OUT/dist-preview.sha256 | tee -a $S
run check-portable npm run check:portable
run measure-bundle npm run measure:bundle
for i in 1 2 3; do run test-e2e-run$i npm run test:e2e; done
git -C /home/user/turno ls-files -s prototypes/frontend-v6/evidence/1A prototypes/frontend-v6/evidence/1B | sha256sum | tee -a $S
git -C /home/user/turno status --short prototypes/frontend-v6/evidence/1A prototypes/frontend-v6/evidence/1B | tee -a $S
echo DONE | tee -a $S
