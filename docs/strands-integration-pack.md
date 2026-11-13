# Turno — Complete Strands integration pack v2

Base: PR #4, `8b96b7b8cc8bafb2163c0075b91eee6d08dda922`.
This replaces the partial pack. No push, merge, deployment or live configuration change.

## Four delivered components

| Component | Integration | Verification |
|---|---|---|
| Lifecycle Hooks | Native before/after model hooks for Strands; allowlisted Decision API metrics for Jev | Existing and new SDK/HTTP tests |
| Strands Evals | Python 3.12 / 1.9.0 deterministic Equals; required by full verification and added CI step | 11 unit tests, 22-case offline oracle, missing-SDK rejection |
| ContextInjector | Native SDK plugin on classification, extraction and capture Agent instances | Actual VercelModel wire tests, isolated concurrent contexts, non-persistence, fail-closed guard |
| Cedar Authorization | Native SDK intervention, local WASM policy engine; policy permits only internal structured output | Actual tool executor deny tests, policy validation, one-call limit, mutation tests |

## Provider and model invariants

Vercel AI Gateway remains the provider. Jev `typesafe-ai/jev` classifies in the explicit DECISION test profile; Haiku `anthropic/claude-haiku-5.5` extracts the action. No credentials, model IDs, existing fallback list, GATEWAY default, AI-disabled default, or user data settings changed. Jev uses Decision API directly: it has no Strands Agent/tool loop, so claiming that ContextInjector or Cedar runs inside Jev would be incorrect. Its existing input/output bounds and cancellation remain.

## Context boundary

The backend authorizes and validates the note/version before producing `{source:"confirmed-note", noteVersion}`. The injection contains only a fixed schema marker, stage, source enum, synthetic/review-only booleans and a bounded version integer. No shift ID, note ID, task title, bed label, entire snapshot or private attribute is added. Direct synthetic harnesses are explicitly labelled synthetic-harness; capture is capture-input. The injected block is ephemeral in SDK message history, not a promise about provider retention.

Native ContextInjector skips failed callbacks by default. The next input transformer requires the native renderer to have run and the exact injected block to be present. Missing/skipped/reordered injection fails before the model; a forged block in note text cannot satisfy the renderer counter. The renderer returns precomputed, validated data; no remote retrieval or free text is interpolated.

## Authorization boundary

Cedar principal is the application capability `User::"turno-synthetic-agent"`, not an end-user identity. The only allowed action is `strands_structured_output`, resource `agent`, ready context, allowed stage, synthetic/review-only mode, first call only. All other tool actions have an explicit forbid. The policy context is a trusted application closure, not tool arguments or note content. `onError:'deny'`; malformed/missing policy or missing dependencies prevents a usable agent. No business tool or write permission is added. Cedar does not replace HMAC, user authorization, snapshot permissions or human approval.

## Structured output with null

Cedar's context cannot hold JSON `null`, so a valid structured output such as `{action:null}` (the extractor's abstention) or a capture proposal with `bedLabel: null` or `time: null` was denied before the policy ran, and the call failed as `Strands no completó una salida estructurada válida`. The fix keeps the policy and the real output unchanged: `NullSafeCedarAuthorization` lets Cedar evaluate a null-free copy of the tool input (`cedarSafeInput`), since the policy never inspects input. The note extractor now allows one forced structured retry after prose (`NOTE_LIMITS`: 2 turns, 2 structured attempts, 2400 output tokens, 5000 total tokens); the capture limits are unchanged. Metrics and eval call records gain `structuredOutputPresent`, and extract calls also record `stopReason` and `turns`; none carry text.

## Dependencies

SDK stays 1.24.0. Add exact optional SDK peers as runtime dependencies: `@cedar-policy/cedar-wasm@4.14.0` and `@cedar-policy/mcp-schema-generator-wasm@0.6.1`. Both are local WASM engines; no AWS service, Bedrock inference or account is used. Fresh `npm ci --ignore-scripts` is required. Python dependencies remain evaluation-only and pinned separately.

## Verification contract

Full verification requires the Python evaluator environment; absence is BLOCKED (exit 2), not a successful partial run. GitHub Actions now includes the deterministic Evals step. The remote CI workflow itself is not claimed executed until the pack is applied/pushed and GitHub runs it. Tests are synthetic: localhost HTTP is real, SDK adapters and native extensions are real, remote Gateway responses are mocked. No browser/React v6 E2E or live-model quality claim.

Re-scored with the current stem rule (be9c08f), the historical holdout run is 22/22 in both the JS rejudge and Strands Evals. It checks evaluator compatibility with old outputs, NOT live accuracy after adding context. Release and real-data gates remain unchanged.

## Audit

The verification package records native allow/deny behavior, context isolation, missing-context closure, cancellation, mutation tests, whole-suite runs, dependency audit, secret scan, clean-base application, SHA-256 readback and source preservation. No independent reviewer identity is claimed. ContextInjector and Cedar are implemented, not deferred. Memory, GoalLoop and new business tools are outside the requested four-component scope.
