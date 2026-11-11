# Phase 2B ledger: docs/migration-v6/PLAN.md

Base: e0133a47fb5c70be27ae966c1e0aa4cfd3ad2a0b. Isolated clone; local branch work/phase2b-indexed-history.
Pre-flight: history owns browser indices; the injected guard owns busy/overlay/dirty decisions; application/store owns selection/drafts; hook owns listener lifecycle. No product navigation integration until 4A/4B.

Task 1: complete: controlador, RED 15/15 → GREEN 20/20; compensación, callbacks, entradas externas, reattach y cola de última intención.
Task 2: complete: hook, RED sin listener → GREEN; StrictMode + 20 montajes, una suscripción y cleanup exacto, título sin entrada adicional.
Task 3: complete: harness técnico y 22 casos E2E descubiertos; unit99/component56 y tipos/lint/build/auditorías en verde. Código commit 4f88fca285d8955cf36415674c1f0d5596c06e12. Chromium BLOCKED, no ejecutado de nuevo por restricción observada por revisor.
Ruling: el harness se construye aparte en dist-history para probar file/HTTP sin reemplazar Home: no confundirlo con integración de producto: el coste si está mal es evidencia no válida de producto; no se promueven requisitos HISTORY.
Ruling: una entrada externa sin índices fiables corta el segmento propio: no inventar deltas ni reemplazar entradas ajenas: el coste si está mal es no restaurar rutas antiguas del segmento previo; no se afirma protección exterior/host.
Final review: solicitada a Astra sobre 3c25f6d; pendiente. No se aprueba la propia implementación.

Final: fixed stale popstate overwriting a newer intent: five replay/user-traversal races RED→GREEN, controller25/25 and suite 99/99, component 56/56. Runtime commit 7b6d3e9 independently repeated by reviewer; test-only supplement 4f88fca pending browser 22 cases.

Final: fixed Mac file-document interception in tests only, commit4234a8e: exact file URL + same local HTTP origin, policy2RED→5GREEN; unit104/104/component56/56; 24 E2E pending repeated Mac QA. Runtime and HTML hashes unchanged.

Final: fixed close-phase focus ownership in harness72459f5. Passive Mac trace proves new route was presented while old popup still trapped focus; resume now waits for public close-complete cleanup. Component asynchronous branch RED→GREEN; unit105/component57, types/lint/build PASS. Browser oracle unchanged, additionally checked before old response. Blob protocol mismatch fixed in dba92f9, RED→GREEN6. Final browser and independent review pending.

Final verification: Mac72459f5 focal24/24 and full40/40×3 PASS, no skipped/retries/flaky;105unit57component/types/lint/build/portable/audits0. Independent reviewer PASS plus5 suspended-close probes. Technical evidence complete; orchestration reconciles30 unit requirements and retains allHISTORY planned; final snapshot review and checker precede phase approval.
