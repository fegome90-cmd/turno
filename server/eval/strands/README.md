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

The manifest comes from the corpus, separately from the report. The adapter ignores self-reported `pass`, `goalMet` and summary totals. It requires every expected ID exactly once per repetition (`reps` 1 to 10, rows carry `rep`), exact statuses (including explicitly declared alternatives), no mutation, zero model calls on stale/unauthorized cases, and existing keyword checks. It uses the existing Node `contentWords` for the declared near-duplicate alternative rather than inventing a second Spanish tokenizer in Python.

The full pack verifier and CI require this check; missing Python/SDK is BLOCKED rather than a partial PASS. Run `STRANDS_EVALS_PYTHON=/absolute/path/to/venv/bin/python npm run verify:evals`.

The verdict is strict per-case: any failed case makes this diagnostic comparison `FAIL`. It is **not the product promotion gate**: R5 may accept >=5/6 useful titles plus its negative gates. This adapter does not override that policy. Both statuses must be reported when they differ.

The prepared JSON is an observation, not cryptographic evidence of provider execution. The checker does not prove semantic faithfulness, real-user utility, billing, or robustness beyond the supplied cases. It does not alter the main evaluator or repair its outputs.

## Sets and repetitions

`export-manifest.mjs --set` selects the corpus: `holdout` (default, 22 cases, the CI set), `extended` (50 = holdout + 28 extended) and `extended-probe` (56 = extended + 6 abstain probes). The manifest records its `set`.

Multi-rep reports (for example a live run with 3 repetitions) are verified with the same contract:

- every manifest case must appear exactly `reps` times, with distinct `rep` numbers 1..reps; unknown IDs, duplicates or missing repetitions are `BLOCKED`;
- a case passes only if all its repetitions pass (pass^k); `passAny` (pass@k) is also reported;
- `flaky` lists cases with mixed outcomes; `runsPassed/runsTotal` counts repetitions;
- the verdict is `PASS` only if every case passes every repetition.

Verify an existing report without running the offline eval:

```sh
VERIFY_REPORT=/absolute/path/run.json VERIFY_SET=extended-probe \
  STRANDS_EVALS_PYTHON=/absolute/path/venv/bin/python npm run verify:evals
```

`VERIFY_REPORT` and `VERIFY_SET` must be given together. Without them, CI runs the offline holdout as before.

## Current facts

- Offline holdout (CI, deterministic, no model calls): 22/22, PASS.
- Keyword rule: a task title passes when each `expectTitleIncludes` keyword matches by stem, using Turno's `contentWords`. For example `actualizar` matches the title "Actualiza", so the earlier `task-04` failure no longer applies.
- Reference live run `run3-56x3.json` (56 cases x 3 repetitions, extended-probe set, read-only, not committed): 55/56 cases pass, runs 165/168, flaky `[]`, only `ext-22` fails (3 of 3 repetitions), verdict FAIL. This is a diagnostic result, not the product promotion gate.

## Sources checked

- https://strandsagents.com/docs/user-guide/evals-sdk/quickstart/
- https://strandsagents.com/docs/user-guide/evals-sdk/evaluators/
- Installed package signatures and executed `Equals.evaluate(EvaluationData(...))` on Python 3.12.
