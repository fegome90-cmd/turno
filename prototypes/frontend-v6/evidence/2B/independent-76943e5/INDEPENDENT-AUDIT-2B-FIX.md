# Independent audit of the 2B history race correction

Date: 2026-11-09. Base: fd777bfb1656dc55114e170e14474ba5ee70c481.
Reviewed final commit: `76943e5db6cf203e8f2738391f4318523c63ad7b`, tree `f70a1a19b28d5dd2cedae789d07c1568ed4dc2ab`. Its three changed source blobs match the audited SHA-256 values below. Publication to GitHub was not verified by this audit.

Reviewed candidate: source and tests frozen at approximately 06:28 UTC in the isolated implementation checkout. Audit work ran on a separate copy. The implementer's checkout was not edited by the auditor.

## Verdict

No remaining blocking defect was found in the reviewed controller/hook/harness scope after the final correction. The independent non-browser checks pass. This is **not an approval to close the phase**: the corrected source still needs its real-browser gate in an authorized environment. The existing historical Mac results cannot be transferred to this revision.

## Findings and resolution

1. **Pre-existing: interrupted approved replay stalls subsequent navigation.** Independently reproduced on fd777bf in both directions. An opposite traversal reaches the visible source while a stale replay event is ignored; the previous controller left its replay marker alive. The next push remained queued. The fix settles the replay when the source is reached, preserving a queued newer intent. Both independent cases pass.
2. **Pre-existing: a new edit can be lost after save/discard approval.** Independently reproduced with the real React technical harness and simulated controlled history. Eight cases cover title/body, save/discard, and holding either the actual replay movement or its popstate delivery. All eight failed on fd777bf and pass on the final candidate. New edits explicitly revoke approval through cancelPending; restoration does not apply a route, clear the new text, create a compensating push, or destroy Forward. A subsequent attempted departure prompts again.
3. **Pre-existing: React batching loses the last route or duplicates an entry.** The independent real-hook cases TASK→HOME and TASK→TASK failed on fd777bf and pass on the final source, with title and history assertions.
4. **Incomplete initial fix: readRoute returning a fresh equivalent object.** Two additional independent tests kept failing in the first candidate because reference inequality was mistaken for a synchronous route change. The final hook compares a copied snapshot by route values. Both cases now pass.
5. **Introduced regression, fixed before final snapshot: normalized setter bailout.** A valid applyRoute:void that keeps React state unchanged left the initial fix's projection and document title on a route the UI did not show. This test passes on fd777bf, failed on the first candidate, and passes on the final source. The hook now requests its own commit to reconcile the projection. No return-value handshake or signature change was required.

The final hook retains applyRoute(route): void, latest committed callbacks, and StrictMode lifecycle behavior. The harness still waits for the modal's close-complete boundary before resuming. No browser-focus conclusion is inferred from JSDOM.

## Independent execution

Canonical final candidate, separately copied and executed:

- TypeScript: PASS.
- Lint: PASS.
- Unit suite: 111/111 PASS.
- Component suite: 81/81 PASS.
- Product build: PASS.
- Technical history harness build: PASS.
- Installed dependency versions: npm ls --depth=0 PASS. Dependencies were copied from the lock-based implementation installation, not freshly installed by this auditor.
- E2E discovery: 60 scenarios in 3 files. This is discovery only, not execution.

Additional audit artifacts:

- Independent React/harness suite: 13/13 PASS on final source. Twelve expose original or initially unresolved defects; the thirteenth is the introduced bailout regression described above. Ten of these scenarios were incorporated into the versioned regression suite, and the other cases have corresponding versioned hook tests. Do not add these counts to canonical tests as if all were distinct coverage.
- Independent pure controller interruption checks: 2/2 PASS.
- Deterministic model stress: 10,000 mixed immediate/deferred history schedules end navigable, and another 10,000 preserve the visible route after draft cancellation before testing liveness. These are bounded synthetic schedules, not an exhaustive proof or real-browser evidence.
- Source/test directory comparison after execution: no differences between the audited final snapshot and the implementation checkout.

## Exact source identity

SHA-256:

- src/navigation/history-controller.ts: e9b91be35a16abfd4fe64f2008f7a25197d402c2ce706f7986410470a85964d2
- src/navigation/use-history.ts: 66d37846f258202919845734ffd23067d460394e5f538b140082555d49021363
- src/harness/HistoryHarness.tsx: 7f74e7a68d658312d97ee5e2430f6b8dab7657875e3a1229cb579a80b08e5306

Built artifacts:

- Product preview SHA-256: ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343. Identical to the prior product build; the controller remains outside product integration.
- Technical history harness SHA-256: fb6c2b83f65a4b64b0ec5aecdbae8f28daa9f953c37d6b9e5217f5832d6606a5.

## Integration contract and remaining gate

The new integration note correctly requires every new draft/title/temporal-field edit to call controller.cancelPending() synchronously before updating its draft. Save completion still needs its independent revision/generation checks. This obligation must be carried into the future 4A/4B consumers; testing this harness does not implement those consumers.

The implementer reported Chromium launch blocked by `socket() failed: Operation not permitted`, before opening any page, including the permitted expanded execution attempt. The auditor did not retry that restricted action. No E2E or browser-dependent portable check is certified for this correction, and no APPROVE_PHASE, merge, or deploy is authorized by this report. Host ChatGPT, VoiceOver, IME, Firefox/WebKit, human visual review, and product HISTORY integration remain outside this result.

## Evidence files

The sibling audit folder contains original red logs, intermediate-candidate failures, final canonical gate logs, the independent executable tests, deterministic stress scripts, a full source/test SHA-256 list, and final E2E discovery output. The report and those artifacts can be copied into the implementation evidence package without modifying source or tests.
