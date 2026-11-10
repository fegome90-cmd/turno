# Internal agent HTTP endpoint
Branch: `feat/internal-agent-http` from `claude/eloquent-cerf-yg547a`; delivery: one PR to `feature/opencode-secure-config`, never merge or deploy.
Runner: Node >=22, `node:test`; synthetic fixtures and injected classifiers only.

## Specs
S1. "Parte de la rama `feature/opencode-secure-config` si el PR fegome90-cmd/turno#6 ya está integrado; si no, parte de `claude/eloquent-cerf-yg547a`. Crea tu propia rama. Abre un PR hacia `feature/opencode-secure-config` y no lo integres."
S2. "Un servidor HTTP mínimo con node:http, sin dependencias nuevas, en server/http/. Es un servicio interno que llama el backend de Turno, nunca el navegador." "POST /v1/agent/events → valida el evento, llama a analyzeAmbientEvent y responde { status, suggestions }." "POST /v1/agent/capture → { shiftId, synthetic: true, text } y responde las propuestas de captura para revisión." "GET /healthz → { ok, aiEnabled, decisionMode, modelId }. Sin secretos y sin llamar al modelo."
S3. "Firma HMAC-SHA256 del cuerpo y una marca de tiempo, con el secreto TURNO_AGENT_SIGNING_SECRET leído del entorno." "Comparación en tiempo constante. Rechaza desfases de más de 5 minutos." "Protección contra repetición por id de evento." "Sin CORS." "401 genérico ante cualquier falla, sin detalles."
S4. "Proveedor de snapshot con la interfaz getAuthorizedSnapshot(event). Para el piloto, impleméntalo como un almacén de turnos sintéticos de prueba (fixtures en el servidor) que solo acepta synthetic: true. Deja la interfaz lista para conectar después el backend real."
S5. "Cuerpo JSON de 16 KB como máximo, solo Content-Type application/json, validación estricta del esquema." "Límite de solicitudes por shiftId y tiempo máximo por solicitud." "Si TURNO_AI_ENABLED=0, responde 503 sin llamar al modelo." "Si el modelo falla, devuelve abstención (fail-closed), nunca un error con stack trace."
S6. "Nunca registres el texto de las notas, los snapshots, claves ni encabezados de autorización." "En DUAL, registra solo { eventId, activeLabel, shadowLabel, agree }, como ya hace recordComparison." "Usa redactSecrets de scripts/check-secrets.mjs para cualquier mensaje de error."
S7. "`serve`: arranca el servidor, por defecto en 127.0.0.1." "`smoke:endpoint:env`: opcional; firma una solicitud de prueba con un evento sintético fijo contra un servidor local y valida la respuesta." "Documentación en server/ENDPOINT.md: contrato de cada ruta, cómo firmar, variables de entorno, errores, y cómo debe llamarlo el backend de Turno."
S8. "Con node:test, inyectando clasificadores falsos. Deben cubrir:" "firma inválida, ausente o vencida;" "repetición del mismo evento;" "cuerpo demasiado grande o tipo de contenido incorrecto;" "datos no sintéticos o shiftId desconocido;" "tipo de evento no permitido;" "TURNO_AI_ENABLED=0;" "falla del modelo con abstención;" "los modos GATEWAY, DUAL y DECISION;" "que ninguna sugerencia incluya acciones distintas de review/dismiss;" "que los registros no contengan el texto de la nota."
S9. "Deben seguir pasando: npm run check, npm test, npm run check:secrets y el CI de .github/workflows/turno-ambient-pilot.yml."
S10. "Lo que ya existe (no cambies su comportamiento)" "Solo datos sintéticos. No conectes datos clínicos reales ni la base de datos de Turno." "No agregues rutas que guarden, completen o borren tareas, ni que envíen notificaciones." "No pongas claves en archivos, tests, commits ni en la salida de consola. No crees un .env versionado." "No despliegues nada ni cambies los modelos por defecto." "No toques el frontend (prototypes/). Mostrar las sugerencias en la interfaz es otra tarea."
S11. "El servidor arranca con `npm run serve`." "Las rutas cumplen el contrato documentado en server/ENDPOINT.md." "Todas las pruebas nuevas y existentes pasan." "Hay un PR abierto hacia feature/opencode-secure-config con un resumen de lo hecho, lo verificado y lo que queda pendiente (conectar el backend real, QA de interfaz, revisión de privacidad)."

## Tasks
T1 | S3,S5,S6,S8,S10 | inline: cohesive signed transport, no independent writer unit | done | commit: 765e8a1; RED missing module; GREEN 12/12 focused and 84/84 suite; Risk: item 2 (service authentication).
T2 | S2,S4-S8,S10,S11 | inline: engine integration depends on T1 | done | commits: 432ca2b, dad07ae; RED missing module and upload timeout; GREEN 42/42 focused, 114/114 suite, startup probe; Risk: item 2 (authorized snapshot boundary).
T3 | S1-S11 | independent gentle-ai-verify, then native review if due | in_progress | evidence: self-checks PASS; independent verification pending; Risk: item 2.
T4 | S1,S9,S11 | parent: publish authorized branch, open PR, observe CI | pending | commit/PR: pending.

## Log
L1. Original request (verbatim):

Contexto
Repositorio: fegome90-cmd/turno. Carpeta del agente: server/ (Node ≥ 22, ESM, dependencias fijadas en server/package-lock.json).
Parte de la rama `feature/opencode-secure-config` si el PR fegome90-cmd/turno#6 ya está integrado; si no, parte de `claude/eloquent-cerf-yg547a`. Crea tu propia rama. Abre un PR hacia `feature/opencode-secure-config` y no lo integres.

Turno es un gestor de tareas de turno. El agente de fondo ya existe, pero no está conectado a nada: no hay endpoint HTTP ni proceso que lo llame. Tu tarea es programar ese endpoint para poder montarlo. Lee primero server/README.md, server/DECIDER.md, server/LIVE_SMOKE.md y docs/live-smoke-audit-2026-11-10.md.

Lo que ya existe (no cambies su comportamiento)
- server/ambient-engine.mjs → analyzeAmbientEvent({ event, settings, isAuthorized, getAuthorizedSnapshot, classifyWithGateway, classifyWithDecision, recordComparison }) devuelve { status: 'disabled'|'proposed'|'abstain', suggestions }.
  - Eventos permitidos: note_saved, drafts_ready, shift_close_attempt. El evento lleva { id, type, shiftId, synthetic: true }.
  - El snapshot lo entrega el backend: { shiftId, synthetic: true, beds: [{id,label}], drafts: [...], noteText }. Nunca debe venir del navegador.
  - Las sugerencias son siempre solo `review`/`dismiss`, con requiresApproval: true.
- server/gateway-capture.mjs → createStrandsCapture({ env, onMetrics }) devuelve propose(input, { isAuthorized, beds }). Convierte texto libre en propuestas que requieren revisión humana y nunca guarda.
- server/gateway-provider.mjs → createStrandsClassifier({ env, onMetrics }) (LLM, por defecto anthropic/claude-haiku-5.5, respaldo deepseek/deepseek-v4.1-flash).
- server/decision-provider.mjs → createRemoteDecisionClassifier({ env }) (decider typesafe-ai/jev).
- server/decision-switch.mjs → modos GATEWAY / DUAL / DECISION (variable TURNO_DECISION_MODE). En DUAL, recordComparison recibe solo metadatos.
- server/gateway-config.mjs → readGatewaySettings(env). Nunca devuelve secretos. TURNO_AI_ENABLED=0 por defecto.
- Resguardos de secretos: npm run check:secrets, tests/no-secrets.test.mjs y el hook .githooks/pre-commit (actívalo con: git config core.hooksPath .githooks).

Qué construir
1. Un servidor HTTP mínimo con node:http, sin dependencias nuevas, en server/http/. Es un servicio interno que llama el backend de Turno, nunca el navegador. Rutas:
   - POST /v1/agent/events → valida el evento, llama a analyzeAmbientEvent y responde { status, suggestions }.
   - POST /v1/agent/capture → { shiftId, synthetic: true, text } y responde las propuestas de captura para revisión.
   - GET /healthz → { ok, aiEnabled, decisionMode, modelId }. Sin secretos y sin llamar al modelo.
2. Autenticación de servicio a servicio:
   - Firma HMAC-SHA256 del cuerpo y una marca de tiempo, con el secreto TURNO_AGENT_SIGNING_SECRET leído del entorno.
   - Comparación en tiempo constante. Rechaza desfases de más de 5 minutos.
   - Protección contra repetición por id de evento.
   - Sin CORS.
   - 401 genérico ante cualquier falla, sin detalles.
3. Proveedor de snapshot con la interfaz getAuthorizedSnapshot(event). Para el piloto, impleméntalo como un almacén de turnos sintéticos de prueba (fixtures en el servidor) que solo acepta synthetic: true. Deja la interfaz lista para conectar después el backend real.
4. Límites y fallos:
   - Cuerpo JSON de 16 KB como máximo, solo Content-Type application/json, validación estricta del esquema.
   - Límite de solicitudes por shiftId y tiempo máximo por solicitud.
   - Si TURNO_AI_ENABLED=0, responde 503 sin llamar al modelo.
   - Si el modelo falla, devuelve abstención (fail-closed), nunca un error con stack trace.
5. Registros:
   - Nunca registres el texto de las notas, los snapshots, claves ni encabezados de autorización.
   - En DUAL, registra solo { eventId, activeLabel, shadowLabel, agree }, como ya hace recordComparison.
   - Usa redactSecrets de scripts/check-secrets.mjs para cualquier mensaje de error.
6. Scripts npm:
   - `serve`: arranca el servidor, por defecto en 127.0.0.1.
   - `smoke:endpoint:env`: opcional; firma una solicitud de prueba con un evento sintético fijo contra un servidor local y valida la respuesta.
7. Documentación en server/ENDPOINT.md: contrato de cada ruta, cómo firmar, variables de entorno, errores, y cómo debe llamarlo el backend de Turno.

Pruebas (obligatorias, sin red)
Con node:test, inyectando clasificadores falsos. Deben cubrir:
- firma inválida, ausente o vencida;
- repetición del mismo evento;
- cuerpo demasiado grande o tipo de contenido incorrecto;
- datos no sintéticos o shiftId desconocido;
- tipo de evento no permitido;
- TURNO_AI_ENABLED=0;
- falla del modelo con abstención;
- los modos GATEWAY, DUAL y DECISION;
- que ninguna sugerencia incluya acciones distintas de review/dismiss;
- que los registros no contengan el texto de la nota.
Deben seguir pasando: npm run check, npm test, npm run check:secrets y el CI de .github/workflows/turno-ambient-pilot.yml.

Restricciones
- Solo datos sintéticos. No conectes datos clínicos reales ni la base de datos de Turno.
- No agregues rutas que guarden, completen o borren tareas, ni que envíen notificaciones.
- No pongas claves en archivos, tests, commits ni en la salida de consola. No crees un .env versionado.
- No despliegues nada ni cambies los modelos por defecto.
- No toques el frontend (prototypes/). Mostrar las sugerencias en la interfaz es otra tarea.
- Si necesitas inferencia real para probar: hace falta AI_GATEWAY_API_KEY en el entorno del servidor. Detrás de un proxy HTTPS, ejecuta Node con NODE_USE_ENV_PROXY=1. Usa siempre los eventos sintéticos fijos.

Terminado cuando
- El servidor arranca con `npm run serve`.
- Las rutas cumplen el contrato documentado en server/ENDPOINT.md.
- Todas las pruebas nuevas y existentes pasan.
- Hay un PR abierto hacia feature/opencode-secure-config con un resumen de lo hecho, lo verificado y lo que queda pendiente (conectar el backend real, QA de interfaz, revisión de privacidad).

L2. GitHub CLI grant: user selected “Autorizar GitHub CLI para este trabajo” for target-bound reads/fetch/push/PR, no merge/deploy. PR #6 OPEN (not merged); base selected accordingly. Working tree initially clean. Hook enabled. Node v24.15.0, npm 11.12.1. RDD on (global). Explorer mwb53eii-1-dcsw maps integration seams; no writer trigger (integration depends on transport). Single requested PR may exceed 400 lines; keep cohesive reviewable commits rather than compressing tests.
L3. T1 committed as 765e8a1 (264 authored lines). First full-suite attempt: 80/84, four existing SDK checks failed because node_modules was absent. Installed exact lock with npm ci --ignore-scripts --no-audit --no-fund; then npm run check, npm test (84/84), npm run check:secrets PASS. Slice boundary is the implementation parent, not origin/main: inherited PR #6 work is outside this task's candidate. T2 begins; no provider inference or external data used.
L4. T2 complete: timeout correction 432ca2b (131 authored lines); integration dad07ae (447 authored lines, cohesive routes/tests/docs unit slightly above advisory 400-line slice; single PR requested). Focused 42/42, full suite 114/114, syntax, secret scan and demo PASS. npm audit: zero vulnerabilities. Actual npm run serve on loopback: health 200 and signed fixed synthetic event 503 with IA off; child shut down, no inference. Optional smoke script omitted. Existing engine/provider behavior and frontend untouched. User separately authorized creation/application of exact status:approved and type:feature labels and an issue linked with Refs, no automatic closure. Repo ADMIN permission, issues/blank issues enabled, no templates, duplicate search empty.
L5. Assessment on committed range 5516336..dad07ae escalated item 2, requires independent verifier; native assess could not select untracked ODD document. Resolve intended-untracked selection, then assess normalized range. PR comparison currently also includes inherited unmerged PR #6 (48 files, 33372 additions); our review boundary excludes that inherited work.
