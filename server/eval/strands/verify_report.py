#!/usr/bin/env python3
"""Opt-in Strands Evals contract check. No model judges or network calls.

Consumes the existing Node report and a separately exported corpus manifest.
This checks declared outcomes, not semantic faithfulness or real-user utility.
"""
import argparse
from importlib.metadata import version
import json
from pathlib import Path
import sys
from unittest.mock import patch

from strands_evals.evaluators import Equals
from strands_evals.types.evaluation import EvaluationData

STATES = {"proposed", "abstain", "stale", "rejected"}


MAX_REPS = 10


def _check(requirement: dict, row: dict, evaluator: Equals) -> tuple[bool, str | None]:
    expected = requirement.get("expect")
    words = requirement.get("titleWords", [])
    stems = requirement.get("titleStems")
    if expected not in STATES or not isinstance(words, list) or not all(isinstance(w, str) for w in words):
        raise ValueError("invalid expectation")
    alternative = requirement.get("acceptProposed")
    reference = requirement.get("referenceTokens", [])
    forbidden = requirement.get("forbiddenWords", [])
    if alternative not in {None, "near-duplicate"} or not isinstance(reference, list) or not isinstance(forbidden, list):
        raise ValueError("unsupported alternative")
    if not all(isinstance(word, str) and word for word in reference + forbidden):
        raise ValueError("invalid contract words")
    calls = row.get("modelTotal")
    title = row.get("proposedTitle")
    tokens = row.get("titleTokens", [])
    near = (alternative == "near-duplicate" and expected == "abstain" and row.get("status") == "proposed"
            and isinstance(tokens, list) and all(isinstance(token, str) for token in tokens)
            and isinstance(title, str) and bool(title.strip()) and bool(reference)
            and set(reference).issubset(set(tokens)))
    actual = {
        "statusAccepted": row.get("status") == expected or near,
        "safety": row.get("status") != "proposed" or (isinstance(title, str) and not any(w.lower() in title.lower() for w in forbidden)),
        "noMutation": row.get("mutated") is False,
        "modelGuard": type(calls) is int and calls >= 0 and (expected not in {"stale", "rejected"} or calls == 0),
        "titleCheck": expected != "proposed" or (isinstance(title, str) and bool(title.strip()) and (
            set(stems).issubset(set(tokens)) if isinstance(stems, list) and stems else all(w.lower() in title.lower() for w in words))),
    }
    target = {"statusAccepted": True, "safety": True, "noMutation": True, "modelGuard": True, "titleCheck": True}
    output = evaluator.evaluate(EvaluationData(input=requirement["id"], actual_output=actual, expected_output=target))
    passed = len(output) == 1 and output[0].test_pass is True and output[0].score == 1.0
    return passed, ("near-duplicate" if near else None)


def evaluate_report(manifest: dict, report: dict) -> dict:
    if manifest.get("schema") != "turno-evals-contract/v1":
        raise ValueError("invalid manifest schema")
    expectations = manifest.get("cases")
    rows = report.get("cases")
    if not isinstance(expectations, list) or not expectations or not isinstance(rows, list):
        raise ValueError("non-empty manifest and report cases required")
    reps = report.get("reps", 1)
    if type(reps) is not int or not 1 <= reps <= MAX_REPS or report.get("run") not in {"offline", "live"}:
        raise ValueError("reps must be an integer from 1 to 10 and run offline or live")
    ids = [c.get("id") for c in expectations]
    if not all(isinstance(i, str) and i for i in ids):
        raise ValueError("invalid case id")
    if len(set(ids)) != len(ids):
        raise ValueError("duplicate manifest case")
    # Every manifest case must appear exactly once per repetition 1..reps.
    by_case = {i: {} for i in ids}
    for row in rows:
        rid = row.get("id") if isinstance(row, dict) else None
        if not isinstance(rid, str) or rid not in by_case:
            raise ValueError("missing, duplicate or unexpected cases")
        rep = row.get("rep", 1)
        if type(rep) is not int or not 1 <= rep <= reps or rep in by_case[rid]:
            raise ValueError("missing, duplicate or unexpected repetitions")
        by_case[rid][rep] = row
    for i in ids:
        if set(by_case[i]) != set(range(1, reps + 1)):
            raise ValueError("missing, duplicate or unexpected repetitions")
    results = []
    # An accidental future LLM judge cannot make a network connection here.
    with patch("socket.socket.connect", side_effect=RuntimeError("network_forbidden")), \
         patch("socket.socket.connect_ex", side_effect=RuntimeError("network_forbidden")):
        evaluator = Equals()
        for requirement in expectations:
            runs = [_check(requirement, by_case[requirement["id"]][rep], evaluator) for rep in range(1, reps + 1)]
            outcomes = [passed for passed, _ in runs]
            alternatives = [alt for _, alt in runs if alt]
            results.append({"id": requirement["id"], "pass": all(outcomes), "passAny": any(outcomes),
                            "runsPassed": sum(outcomes), "matchedAlternative": alternatives[0] if alternatives else None})
    runs_passed = sum(r["runsPassed"] for r in results)
    return {"evaluator": "Strands Evals / Equals", "sdkVersion": version("strands-agents-evals"),
            "mode": "deterministic-no-network", "set": manifest.get("set"), "reps": reps, "cases": results,
            "passed": sum(r["pass"] for r in results), "total": len(results),
            "runsPassed": runs_passed, "runsTotal": len(results) * reps,
            "flaky": [r["id"] for r in results if r["passAny"] and not r["pass"]],
            "verdict": "PASS" if all(r["pass"] for r in results) else "FAIL"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = evaluate_report(json.loads(args.manifest.read_text()), json.loads(args.report.read_text()))
    except (OSError, ValueError, TypeError, AttributeError, KeyError):
        print(json.dumps({"verdict": "BLOCKED", "reason": "invalid_input"}))
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
