# Turno — auditoría adversarial del smoke test Strands + Vercel AI Gateway

**Fecha:** 10 de noviembre de 2026 (Chile).  
**Rama:** `feature/opencode-secure-config` — PR #4 (draft; no merge).  
**Alcance:** ejecución `server/live-smoke.mjs`, `gateway-capture.mjs`, evaluación de propuestas, límites del SDK, configuración de secretos, documentación y pruebas sin llamadas a modelos.  
**Veredicto:** **PASS para preflight offline y validación estática reforzada; HOLD para primera inferencia real y cualquier uso con datos clínicos.**

## Evidencia ejecutada

> **Histórico:** esta sección describe el estado antes de la primera inferencia real (modelo `anthropic/claude-haiku-4.5`, 40/40 tests, sin `--live`). El estado actual está en el anexo al final.

- Mac conectado, Node.js **26.12.1**: `npm run check`, `npm test` (**40/40**), `npm run smoke:preflight`, `npm audit --omit=dev --audit-level=high` (**0 vulnerabilidades reportadas**).
- Mac conectado, Node.js **22.23.4**: `node --test tests/*.test.mjs` (**40/40**).
- El preflight devuelve `OFFLINE_CHECKS_ONLY`, `credentialsChecked:false`, `remoteModelVerified:false`, `requests:0`.
- Prueba negativa sin credenciales (`--live --from-env` en ambiente aislado): termina con código 2 y sin salida de propuestas. No hay invocación remota.
- GitHub: `.env` no está en el árbol versionado; existe solamente `server/.env.example`. CI ejecuta pruebas sintéticas y no inyecta secretos.
- No se leyó Keychain ni se consultó su contenido; no se ejecutó `--live`, no se consumieron créditos ni se desplegó un endpoint.

**Importante:** las pruebas de contratos usan resultados sintéticos. No demuestran que el modelo `anthropic/claude-haiku-4.5` produzca correctamente el esquema ni que la credencial de AI Gateway sea válida.

## Hallazgos y reparación

| Ref | Severidad | Hallazgo reproducido | Estado |
|---|---|---|---|
| A-01 | Alta | Preflight reportaba `ready:true` sin validar clave, API ni modelo remoto | **Corregido**: estado offline explícito sin afirmación de readiness remoto |
| A-02 | Alta | El evaluador daba PASS incluso si el modelo asignaba `Cama 8` al informe | **Corregido**: exige informe sin cama, sin hora y sin fecha; valida flags de las tareas |
| A-03 | Alta | El llamador solo rechazaba `cancelled`, pero podía interpretar respuestas parciales de `limitTurns`, `contentFiltered`, etc. | **Corregido**: solo acepta estados de finalización compatibles y objeto estructurado presente |
| A-04 | Media | `limits.turns=1` se describía como un solo pedido al proveedor; Strands puede reintentar la herramienta de salida estructurada y los límites de tokens no son instantáneos | **Documentado**: un ciclo Strands no garantiza una sola petición upstream ni un costo máximo |
| A-05 | Media | Política de costos dependía de un presupuesto no verificable desde el script | **Gate manual**: requiere clave específica, presupuesto y revisar auto top-up, BYOK y fallback antes del primer pedido |
| A-06 | Alta / pendiente | No se verificó una petición remota real ni la configuración efectiva de presupuesto y autenticación de Vercel | **HOLD** hasta aprobación y ejecución manual con secreto en Keychain o backend |
| A-07 | Alta / pendiente | La marca `synthetic:true` no valida anonimización ni autoriza datos reales | **HOLD**: runner usa fixture constante; integración a Turno real requiere controles propios de autorización y privacidad |

**Distinción:** A-05 y A-06 no se resuelven declarando otra prueba verde. La seguridad del costo depende de configuraciones externas y de la ruta de facturación usada.

## Decisiones de seguridad verificables

1. **Secreto:** para Mac, servicio `turno-ai-gateway` y cuenta `turno` en Keychain; `security find-generic-password` recupera el valor solo cuando el usuario ejecuta el comando `--live --from-keychain`. El secreto no se almacena en código, GitHub ni la salida de consola. Para despliegue, usar un secreto de backend u OIDC.
2. **Datos:** entrada remota fijada a las tres tareas sintéticas. No admite un archivo, un prompt por argumento de terminal ni información del usuario. `isAuthorized` del runner es un guard específico de fixture, no autenticación real de producción.
3. **Acciones:** sin herramientas de escritura ni conexión a base de datos. Strands sí utiliza internamente una herramienta de salida estructurada; no es una herramienta de modificación de Turno.
4. **Fallas:** entradas fuera de contrato, respuestas incompletas, falta de credenciales, cancelación y agotamiento del límite no deben generar una aprobación automática.
5. **Métricas:** latencia y uso de tokens si el SDK los devuelve, sin registrar secretos. No hay telemetría adicional ni endpoint HTTP creado por el runner.
6. **Costo:** presupuesto de clave de Vercel es un límite blando; una solicitud que supera el umbral puede completarse. BYOK puede facturarse aparte. No afirmar gasto cero hasta completar un pedido y contrastarlo con el panel de AI Gateway.

## Gates antes de la primera inferencia facturable

- [x] Datos de entrada fijos y sintéticos.
- [x] Cero herramientas de escritura, cero endpoints de la app y revisión humana.
- [x] Preflight offline no afirma conectividad.
- [x] Fallos explícitos ante respuestas parciales y guardrails.
- [x] `npm test` PASS en Node 22 y 26; audit npm sin alertas reportadas en la instalación evaluada.
- [ ] **Verificación del presupuesto de una API key exclusiva para Turno**, incluidas recargas automáticas/BYOK/fallback.
- [ ] **Credencial guardada en Keychain o en un backend con acceso controlado**, sin compartirla en chat ni GitHub.
- [ ] **Ejecución manual del comando `npm run smoke:live:keychain`**, revisión del resultado y observación del cargo real en Gateway.
- [ ] Para conectar la funcionalidad al producto: contrato de autenticación, snapshot autorizado, políticas de privacidad y QA de interfaz; fuera del smoke test.

## Referencias primarias

- Strands Vercel model: https://strandsagents.com/docs/user-guide/sdk/model-providers/vercel/
- Strands structured output: https://strandsagents.com/docs/user-guide/sdk/agents/structured-output-behavior/
- Strands lifecycle and cancellation: https://strandsagents.com/docs/user-guide/sdk/agents/lifecycle-controls/
- Vercel AI Gateway budget policy: https://vercel.com/docs/ai-gateway/observability-and-spend/budgets
- Vercel budget nuances (BYOK and crossing request): https://vercel.com/academy/ai-gateway/set-a-budget
- Test operator runbook: [server/LIVE_SMOKE.md](../server/LIVE_SMOKE.md)

## Anexo: inferencia real desde una sesión en la nube (misma fecha, más tarde)

Ejecutado desde una sesión de Claude Code en la nube, con la clave de AI Gateway guardada como **secreto de red del entorno**: el proxy la inyecta en cada pedido a `ai-gateway.vercel.sh`, y no queda en archivos, comandos, GitHub ni la salida de consola. El acceso de red estuvo limitado a ese host.

| Ref | Estado tras el anexo |
|---|---|
| A-06 | **Parcial.** Se verificaron peticiones remotas reales y el cobro en Gateway (`/v1/credits`: unos US$0,50 en toda la evaluación). La ruta Keychain en el Mac (`smoke:live:keychain`) **no** se ejecutó; solo puede hacerlo el dueño en su equipo. |
| A-05 | **Abierto.** No se verificó desde aquí la configuración de presupuesto, recarga automática ni límites de la clave en el panel de Vercel. Los modelos BYOK (DeepSeek, Meta, TypeSafe AI) se cobran en esas cuentas, fuera del presupuesto del Gateway. |
| A-07 | **Sin cambios (HOLD).** Todo se ejecutó con datos sintéticos fijos. |

Evidencia (ver `server/DECIDER.md` y `server/eval/results/`):

- `smoke:live:env` y `smoke:background:env` con el modelo por defecto `anthropic/claude-haiku-5.5`: **PASS**, también con los criterios estrictos de A-02.
- Respaldo `deepseek/deepseek-v4.1-flash` verificado con el modelo principal caído: **PASS**.
- Evaluación de 48 notas y 14 textos sintéticos, con 3 repeticiones y un set de control no usado para ajustar. Corrida `DUAL` con el decider `typesafe-ai/jev`.
- La salida estructurada parcial (A-03) se rechaza también en el clasificador, no solo en la captura.
- Resguardos contra secretos en el repositorio: escáner, test, paso de CI y hook de pre-commit.

Gates actualizados:

- [x] Inferencia real verificada con datos sintéticos (desde la nube, con secreto de entorno).
- [ ] Verificación del presupuesto de la clave de Turno en el panel de Vercel (A-05).
- [ ] Ejecución de `npm run smoke:live:keychain` en el Mac del dueño.
- [ ] Integración al producto: autenticación, snapshot autorizado, privacidad y QA de interfaz.
