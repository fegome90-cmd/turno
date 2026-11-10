# G0 — Turno | Public product and applicant profile
**Stage:** draft for review (2026-11-10). **This is not proof of product availability or OpenAI partnership.**

## Product identity

**Name:** Turno

**Category:** Independent personal task, notes and shift organizer. Intended for professionals across disciplines, not restricted to nursing. Turno is not a clinical record system or a decision-support system for diagnosis or treatment.

**Core value:** Help one person capture, review and recover their own commitments during a work shift without requiring a chat interface. Human approval is required before saving reviewed tasks.

**Current evidence:** The React v6 prototype on [PR #5](https://github.com/fegome90-cmd/turno/pull/5) shows lists, tasks, notes, time context and human-reviewed task capture. The current capture flow parses literal lines only, **not natural-language inference**. It uses synthetic data in session memory and is not a released or deployed multiuser product. Evidence asset: [real screenshot](./assets/turno-capture-review-v6-synthetic.png) generated from this PR with three synthetic task titles.

**Future direction (not available):** Strands Agents would produce optional contextual suggestions rather than running a chatbot. Each eligible user would authorize their own ChatGPT connection for plan use only if OpenAI approves the application and the runtime / token custody model. No user can be charged for the specific privilege of using their ChatGPT plan through an approved SIWC integration. Background use would require independent express consent.

**Public source repository:** https://github.com/fegome90-cmd/turno

**Public-facing product microsite source:** [index.html](./index.html). It is static and dependency-free. **A published public website URL has NOT been verified**; a GitHub code URL does not count as a deployed product website.

**Draft privacy text:** [privacy.html](./privacy.html) (NOT a live legal policy; owner, contact, host and future data processing must be verified before publication).

**OpenAI affiliation:** None asserted. Do not claim partner status, OAuth client approval, or user-plan access.

## Applicant identity — OWNER ACTION REQUIRED

The application form must reflect the actual legal person or organization responsible for Turno. **Do not infer identity from a GitHub username, prior profile information or employer.**

| Field | State | Decision required |
| --- | --- | --- |
| Applicant / controller name | NOT CONFIRMED | Legal name of individual or legal entity responsible |
| Capacity / title | NOT CONFIRMED | Owner, maintainer or officially authorized representative |
| Company / organization | NOT CONFIRMED | Accurate legal entity or independent project designation, as accepted by OpenAI |
| Contact email | NOT CONFIRMED | Durable project email with inbox ownership; not an unverified personal address |
| Support and privacy contact | NOT CONFIRMED | Verified reachable channel and request-handling process |
| Product website URL | NOT PUBLISHED | Deploy this microsite to controlled HTTPS origin and verify it loads publicly |
| Hosting provider and region | UNDECIDED | Name the real provider and data flows before publishing privacy text |
| Privacy/terms publication | DRAFT | Legal and factual review with actual controller, contacts, scope and retention |
| Official OpenAI SIWC approval | NOT REQUESTED HERE | Remains G1 gate; do not place sign-in button yet |

## Intended responses for OpenAI G1 (English)

**Application name:** Turno

**Website:** [Use the actual HTTPS URL only after live verification; NOT the GitHub branch URL]

**Repository:** https://github.com/fegome90-cmd/turno

**Capabilities requested:** Sign in with ChatGPT, plus separately authorized ChatGPT plan usage for eligible individual accounts. The latter request is conditional on supported runtime architecture and partner approval.

**Product description (ready to review; not a claim of authorization):**

Turno is an independent task and work-shift organizer intended for individual professionals across disciplines. Its current React prototype demonstrates task lists, personal notes, time context, and human-reviewed capture with synthetic information only. The prototype has no production user authentication, persistent backend, or connected AI feature. Our proposed future capability is an optional, non-conversational Strands Agents service that surfaces contextual suggestions for human approval without writing tasks automatically or providing clinical decisions. We want each eligible user to control their own ChatGPT connection and usage, without pooling accounts or transferring the developer's subscription, and to enable background activity only with express consent. We are seeking guidance and partner eligibility for a remotely hosted, multiuser web product, particularly approved OAuth client registration, user-controlled runtime, credential custody, privacy requirements and the conditions under which an individual ChatGPT subscription could be used. Users would not need to pay us or upgrade Turno to use ChatGPT plan access if approved.

**Category / compliance framing:** Not an EHR; no storage of real patient-identifiable clinical data in the pilot. Not affiliated with any hospital or OpenAI.

## G0 exclusions

- No OAuth endpoint, credentials or registration code.
- No collecting emails or installing analytics on the informational microsite.
- No clinical or patient information and no imported real shift notes.
- No claims about partner acceptance, model testing or security certification.
- No publication of the developer's personal name, employer or email without explicit selection.
- No merging into app/frontend/LLM branches owned by other workstreams.

## Primary references

- [Official SIWC website integration requirements](https://developers.openai.com/siwc/website)
- [Official SIWC Terms, effective 2026-11-04](https://openai.com/policies/sign-in-with-chatgpt-terms/)
- [Official Chilean Law 21.719, delayed effectiveness 2026-12-01](https://www.bcn.cl/leychile/Navegar?idNorma=1209272)

This is a product readiness document, not legal advice or an assertion of approval.
