# Turno: piloto de agente ambiental remoto (sin chatbot)

Estado: **experimental** en rama `feature/opencode-secure-config`. No hay despliegue, backend clínico ni persistencia conectada. El motor de sugerencias no crea, elimina, completa ni cambia tareas; tampoco envía recordatorios. El análisis recibe eventos **solo después de autorización en el backend** y devuelve propuestas para una futura bandeja o toast.

## Arquitectura

- **Strands Agents SDK TypeScript** es el orquestador generativo.
- **Vercel AI Gateway** es el proveedor de inferencia remota por defecto: `anthropic/claude-haiku-5.5`, con `deepseek/deepseek-v4.1-flash` de respaldo y `typesafe-ai/jev` como decider. Fueron elegidos en la evaluación real; ver [`DECIDER.md`](DECIDER.md).
- Otros proveedores de Strands se eligen con `TURNO_AI_PROVIDER`: OpenAI, Anthropic, Google, Bedrock, OpenRouter, Fireworks, Nebius, OVHcloud, Crusoe y OrcaRouter. Ver [`PROVIDERS.md`](PROVIDERS.md). No se descargan ni ejecutan modelos locales.
- **Vercel Decision API** mediante `typesafe-ai/jev` es el decider remoto opcional para categorías cerradas (modos `DUAL` y `DECISION`; ver `DECIDER.md`). **No** es Strands Decider de AWS, que requeriría infraestructura propia; solo imitamos su patrón de evaluación en paralelo.
- Reglas deterministas identifican problemas verificables de camas/fechas/horarios, sin invocar modelos.
- El servicio interno `node:http` se arranca con `npm run serve`. Expone eventos y captura firmados con HMAC, solo sobre fixtures sintéticas del servidor; no debe llamarlo el navegador. Contrato, variables y límites: [`ENDPOINT.md`](ENDPOINT.md). La conexión al backend real sigue pendiente.

## API keys seguras

En un despliegue propio de **Vercel**, preferir **OIDC automático**. No configurar `AI_GATEWAY_API_KEY` en ese caso; el SDK usa el token de proyecto. Fuera de Vercel, crear una clave de AI Gateway limitada para el piloto, con presupuesto y posibilidad de revocación, y guardarla como **Secret** del backend. Nunca usar `VITE_` ni `NEXT_PUBLIC_` para una clave, ni exponerla al navegador o a un repositorio.

Para ejecución local del **servidor** (no inferencia local):

```sh
cp server/.env.example server/.env
chmod 600 server/.env
# En tu Mac edita server/.env, nunca lo publiques ni lo pegues en chat.
cd server
npm ci --ignore-scripts
npm run check
npm test
npm run demo
```

El comando `demo` y los tests usan **datos sintéticos y no hacen peticiones facturables**. `npm install` sí descarga dependencias npm. `node --env-file=.env` permite cargar configuración al ejecutar un programa del servidor; no hace falta hacerlo para `test` ni `demo`.

Variables configuradas en `server/.env.example`:
- `TURNO_AI_ENABLED=0`: apagado por defecto. Cambiar a 1 solo para pruebas sintéticas explícitas con autenticación del backend.
- `TURNO_SYNTHETIC_ONLY=1`: obligatorio, el piloto rechaza configurarlo en 0 y rechaza eventos no sintéticos.
- `TURNO_AI_MODEL_ID`: modelo del LLM. Con `TURNO_AI_PROVIDER=vercel` (defecto) usa el formato del Gateway (`proveedor/modelo`, p. ej. `anthropic/claude-haiku-5.5`). Con un proveedor directo se envía tal cual a ese proveedor, así que va su propio id (p. ej. `gpt-5-mini` con `openai`). Ver `PROVIDERS.md`.
- `TURNO_DECISION_MODEL_ID`: modelo de decisión, siempre por Vercel AI Gateway (formato del Gateway), en los modos `DUAL` y `DECISION`.
- `TURNO_DECISION_MODE=GATEWAY` (inferencia Strands), `DUAL` (Strands activo, Decision API solo sombra), o `DECISION` (clasificador remoto activo con abstención bajo confianza desconocida o baja).

**Atención a costos:** `DUAL` puede generar dos solicitudes facturables por nota. Las reglas deterministas no necesitan modelos. Usar un presupuesto por proyecto o clave y mantener `TURNO_AI_ENABLED=0` en producción hasta validar.

## Entradas y salidas

`ambient-engine.mjs` exporta `analyzeAmbientEvent({ event, settings, isAuthorized, getAuthorizedSnapshot, ...classifiers })`. El consumidor backend debe comprobar la identidad antes de entregar un snapshot autoritativo del turno; nunca confiar en una lista de tareas enviada por el navegador. Solo se aceptan los eventos `drafts_ready`, `note_saved`, `shift_close_attempt`. Además de la marca del evento, el snapshot debe estar identificado como sintético por el backend (`snapshot.synthetic === true`). Es una barrera de prueba, no detección automática de datos clínicos. Una nota enviada al clasificador se limita a 500 caracteres sintéticos.

### Propuesta de tarea desde una nota guardada (R5a)

Tras `note_saved`, el servidor lee la nota confirmada del snapshot autorizado y, solo si el clasificador devuelve `PROPOSE_TASK`, pide al modelo configurado (por defecto Haiku; `note-proposal.mjs`, prompt `NOTE_PROPOSAL_PROMPT`, versión `n1`) una única acción con título corto y cita textual exacta de la nota. `validateNoteProposal` descarta lo que no cumple: cita que no aparece en la nota, título con hora o fecha, o más de una acción. Si algo falla, la respuesta es silencio. La propuesta se muestra inline bajo la nota y no se guarda: la persona revisa, edita o descarta. Recordatorios (`PROPOSE_REMINDER`) y notas que requieren revisión (`NEEDS_REVIEW`) se abstienen. Las pruebas usan clasificadores y extractor inyectados; ninguna llama a un proveedor. El detalle de códigos está en `ENDPOINT.md`.

El motor devuelve objetos `suggestions` con `actions: ['review','dismiss']`; no tiene acceso a una función `saveTask`. Para la captura libre ya existe el extractor `gateway-capture.mjs`, que construye un agente Strands independiente con salida estructurada. El módulo `capture-review.mjs` valida las propuestas y obliga a revisión humana; **no guarda tareas**. La fecha permanece sin completar hasta que el usuario la confirme y las camas solo se vinculan por coincidencia única. El frontend v5 disponible en la rama sigue siendo un prototipo aislado.

## Validación

`npm test`: reglas y contrato de autorización, interruptor de doble ejecución y construcción de Strands/Vercel SDK sin peticiones remotas.
`npm run demo`: imprime alertas basadas en tres tareas sintéticas: falta confirmar fecha para las 15:00; cama 4 no está vinculada al turno de demostración; coincidencia de horario; informe pendiente al cerrar. Ninguna advertencia supone duplicación ni inventa una hora.

**Pendiente:** integración en backend autenticado de Turno, toasts accesibles y la prueba `smoke:live:keychain` en el Mac del dueño. La inferencia real ya se probó con datos sintéticos desde la nube (ver `DECIDER.md` y el anexo de la auditoría).

Referencias: [Strands VercelModel](https://strandsagents.com/docs/user-guide/sdk/model-providers/vercel/), [Vercel Decision API](https://vercel.com/i/ai-gateway-decision-api-use-cases), [AWS pattern](https://strandsagents.com/blog/amazon-saves-millions-replacing-sonnet-with-strands-decider/).

## Revisión de dependencias (10 de noviembre de 2026)

Se separó `@ai-sdk/gateway@3` (compatible con la interfaz LanguageModelV3 de `VercelModel`) de `ai@7` (Decision API remota, con proveedor Gateway V4 interno). El grafo reproducible está fijado en `package-lock.json`. Se actualizó Zod a 4.6.7 por una alerta alta de seguridad.

Después, desde la nube y con inferencia real: **72/72 tests PASS** en Node 22.23.4 y pruebas reales PASS (ver `DECIDER.md` y el anexo de la auditoría). Antes, verificado en Mac (10 de noviembre de 2026): **40/40 tests PASS** en Node 26.12.1 y Node 22.23.4; `npm run check` PASS; preflight `OFFLINE_CHECKS_ONLY`; `npm audit --omit=dev --audit-level=high` reportó **0 vulnerabilidades** en la instalación probada. Esas pruebas sin red de la Mac NO verifican credenciales, conectividad al modelo ni inferencia remota; tampoco prueban un servicio desplegado. La auditoría adversarial y los gates restantes están en [docs/live-smoke-audit-2026-11-10.md](../docs/live-smoke-audit-2026-11-10.md).

## Resguardos de seguridad (secretos)

Ninguna clave va al repositorio. Las credenciales viven en el gestor de secretos del servidor, en el Llavero de macOS o en el panel de Vercel (BYOK). Para que eso no dependa de acordarse, hay cuatro resguardos:

1. **Escáner** (`npm run check:secrets`): revisa los archivos versionados. Falla si encuentra un `.env` real (solo se permite `.env.example`), una variable de credencial con valor en `.env.example` o texto con forma de clave (OpenAI, Anthropic, Vercel, AWS, Google, GitHub, Slack, claves privadas, tokens Bearer, `*_API_KEY=` con valor literal). Nunca imprime el valor: solo el archivo, la línea y el tipo.
2. **Test**: `tests/no-secrets.test.mjs` corre el escáner dentro de `npm test`.
3. **CI**: el workflow lo ejecuta antes de instalar dependencias, también en cada pull request.
4. **Hook de pre-commit** (opcional, por clon): bloquea el commit antes de que la clave llegue a GitHub.

   ```sh
   git config core.hooksPath .githooks
   ```

Además, los errores que guarda la evaluación (`eval/results/`) se limpian de claves y URLs antes de escribirse.

Si una clave llegó a subirse, borrarla del archivo no basta: hay que **revocarla** en el panel del proveedor y crear otra.
