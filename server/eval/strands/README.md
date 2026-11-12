# Deterministic Strands Evals adapter — required for complete verification

This adapter does not host Turno, call Bedrock, call an LLM judge, replace Jev, or route Haiku outside Vercel AI Gateway. Production remains Node/Strands + Vercel Gateway. `Equals` checks declared case contracts without inference. Python is evaluation-only.

## Setup (evaluation environment)

From `server/`, use a Python 3.12 virtual environment outside the repository:

```sh
python3.12 -m venv /tmp/turno-evals
/tmp/turno-evals/bin/python -m pip install -r eval/strands/requirements.lock
/tmp/turno-evals/bin/python -m unittest discover -s eval/strands -p 'test_*.py' -v
TURNO_AI_ENABLED=0 node eval/run-note-eval.mjs --holdout > /tmp/turno-note-report.json
node eval/strands/export-manifest.mjs > /tmp/turno-contract.json
node eval/strands/prepare-report.mjs /tmp/turno-note-report.json > /tmp/turno-observed.json
/tmp/turno-evals/bin/python eval/strands/verify_report.py \
  --manifest /tmp/turno-contract.json --report /tmp/turno-observed.json
```

Pin: Strands Evals 1.9.0; transitive packages are pinned in `requirements.lock`. No Python dependency is added to the Node runtime. The synthetic CI workflow installs this isolated environment and runs the check. Missing SDK fails visibly; there is no local stand-in pretending to be Strands Evals.

## Contract and boundaries

The manifest comes from the corpus, separately from the report. The adapter ignores self-reported `pass`, `goalMet` and summary totals. It requires all expected IDs exactly once, exact statuses (including explicitly declared alternatives), no mutation, zero model calls on stale/unauthorized cases, and existing keyword checks. It uses the existing Node `contentWords` for the declared near-duplicate alternative rather than inventing a second Spanish tokenizer in Python.

The full pack verifier and CI require this check; missing Python/SDK is BLOCKED rather than a partial PASS. Run `STRANDS_EVALS_PYTHON=/absolute/path/to/venv/bin/python npm run verify:evals`.

The verdict is strict per-case: any failed case makes this diagnostic comparison `FAIL`. It is **not the product promotion gate**: R5 may accept >=5/6 useful titles plus its negative gates. This adapter does not override that policy. Both statuses must be reported when they differ.

The prepared JSON is an observation, not cryptographic evidence of provider execution. The checker does not prove semantic faithfulness, real-user utility, billing, or robustness beyond the supplied cases. It does not alter the main evaluator or repair its outputs.

## Recorded replay at base 8b96b7b

Offline oracle: 22/22, PASS. The already-recorded `r5-note-DECISION-2026-11-12-holdout-run3.json` re-scores 21/22, strict FAIL, agreeing with its per-case result. `task-04` says “Actualiza” rather than the required literal “actualizar”. The declared `dup-01` alternative is respected. No new model call was made and the keyword rule was not relaxed.

## Sources checked

- https://strandsagents.com/docs/user-guide/evals-sdk/quickstart/
- https://strandsagents.com/docs/user-guide/evals-sdk/evaluators/
- Installed package signatures and executed `Equals.evaluate(EvaluationData(...))` on Python 3.12.
