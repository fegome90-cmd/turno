# Turno Ambient Strands Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create an isolated server-only ambient suggestion engine using Strands Agents + remote Vercel AI Gateway and human review.

**Architecture:** Pure deterministic policy and presentation gate; Strands for classification of synthetic free text; Decision API optional comparison in shadow. No frontend connection without authentication.

**Tech Stack:** Node 24+, `@strands-agents/sdk`, `ai`, `zod`, native `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-10-ambient-strands-gateway-design.md`

## Global Constraints

No local LLM, no data identified to patients, no chatbot, no direct writes, no public HTTP endpoint, no secrets in the frontend, no automatic deploy or merge.

## Review Focus

- Same-time same-bed distinct tasks must never be merged (Task 2).
- Unlinked bed cannot be assigned by inference (Task 2).
- Clock time without date needs human review (Task 2).
- Shadow model failure or disagreement must not change the primary result (Task 3).
- Duplicate events must not spam toasts (Task 2).

---

### Task 1: Provider and secure configuration

**Files:** `services/turno-agent/{package.json,.env.example,.gitignore,src/config.mjs,src/gateway-agent.mjs,tests/config.test.mjs,tests/gateway-agent.test.mjs}`.

**Interfaces:** `readGatewayConfig(env)`, `createGatewayClassifier({env,loadModules})`.

- [x] Write tests for credential absence, no secret output, allowlisted model IDs and Strands/Vercel wiring.
- [x] Execute RED tests before source modules exist.
- [x] Implement no-tool Strands Agent with Zod structured label.
- [x] Run focused tests: 7/7 PASS locally, using fake remote modules; no network.
- [x] Commit isolated backend code; no app changes.

### Task 2: Deterministic suggestions

**Files:** `src/ambient-policy.mjs`, `src/suggestion-gate.mjs` plus matching unit tests.

**Interfaces:** `inspectAmbientEvent(event)`, `createSuggestionGate({now,cooldownMs}).filter(eventId,proposals)`.

- [x] Write tests for task overlap, bed linking, date confirmation, closure, no mutation and deduplication.
- [x] Execute RED tests before modules exist.
- [x] Implement bounded read-only policy and quiet presentation gate.
- [x] Run focused tests: 9/9 PASS locally.
- [x] Include code in experimental branch, with no write interface.

### Task 3: AWS-style rollout switch and Decision API shadow

**Files:** `src/semantic-decision.mjs`, `src/decisions-api.mjs`, `src/demo.mjs`, matching tests and README.

**Interfaces:** `classifySemantic({event,mode,generative,decisions,record,minConfidence})`, `createDecisionClassifier({env,loadModules})`.

- [x] Write tests for three modes, shadow disagreements, abstentions and invalid responses.
- [x] Execute RED tests.
- [x] Implement switch; only structured labels leave the model boundary.
- [x] Run complete local suite: 23/23 PASS; syntax checks PASS; deterministic demo PASS.
- [ ] Verify real Strands/AI SDK installation and API inference: blocked by unavailable dependency registry and no owner credential; do not claim PASS.
- [ ] Deploy authenticated API + UI integration: out of scope until Turno has an authenticated backend.

## Release decision

**HOLD** for real-provider and UI integration. No production merge. This plan and tested core can be reviewed in an isolated GitHub branch.
