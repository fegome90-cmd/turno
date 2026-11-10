# Turno: Ambient Strands Agent through Vercel AI Gateway

**Status:** experiment only; plan-and-execute request authorizes work on an isolated branch, not merge or deployment.

## Intent

Turno helps people remember operational commitments without becoming a second EHR or a chatbot. All suggestions are quiet, reviewable, and cannot write tasks themselves.

## Goals

- Strands Agents SDK is the runtime; all language models are remote APIs, no local models.
- Vercel AI Gateway authenticates in the backend using OIDC or `AI_GATEWAY_API_KEY`.
- AWS-inspired three-way switch: `GATEWAY`, `DUAL`, `DECISIONS`. In DUAL, Strands is active; Decision API only shadows.
- Four deterministic warning codes: overlapping hour and bed, unresolved bed, time without date, and a pending before-close obligation.
- Fixed notification copy, bounded synthetic input, no unreviewed writes.
- Human acknowledgement precedes any eventual mutation by the authoritative app backend.

## Exclusions

No chat, no local LLM, no patient data, no EHR data, no clinical priority inference, no public HTTP endpoint, no persistent backend, no deployment. Frontend v6 remains unchanged in this gate.

## Design

The isolated Node server package builds an `Agent` with `VercelModel({provider: gateway(modelId)})` and a strict Zod label enum. The model has no tools with mutation privileges. Deterministic rules precede any semantic classification; a decision model only chooses from a fixed label catalog. A separate presentation gate deduplicates and rate-limits suggestions. Low confidence, invalid results and exceptions produce abstention, not permission to act.

## Approaches considered

- OpenCode community adapter: more integration and credential handling; not selected as default.
- Vercel AI Gateway with official Strands model adapter: **selected**, to centralize remote inference and OIDC.
- Direct OpenAI SDK: viable fallback, not needed for this experiment.

## Security

All credentials are runtime-only backend secrets. Model data flow refuses non-synthetic input until Turno has authentication, consent and tenant isolation. The `synthetic` flag is a deliberate test gate, not privacy compliance.

## Acceptance

23 synthetic offline tests must pass. Two tasks at 15:00 in unlinked cama 4 are not merged; missing date and bed require review; the incomplete report appears when closing; shadow disagreements never affect the active result; no output contains a write command.

## Primary references

- https://strandsagents.com/docs/user-guide/sdk/model-providers/vercel/
- https://strandsagents.com/blog/amazon-saves-millions-replacing-sonnet-with-strands-decider/
- https://vercel.com/docs/ai-gateway/authentication-and-byok
- https://vercel.com/changelog/openai-decisions-api-now-available-on-ai-gateway
