# Servicio interno del agente (piloto sintético)

Solo el backend de Turno debe llamar este servicio. No hay CORS, persistencia,
notificaciones ni conexión a datos clínicos. No publiques el puerto en Internet.
El transporte firmado no reemplaza la autenticación de usuarios del backend.

## Firma de servicio a servicio

Inyectá `TURNO_AGENT_SIGNING_SECRET` desde el gestor de secretos del servidor.
Nunca lo pases por argumentos, archivos versionados o navegador. Usá al menos
32 bytes aleatorios y el mismo secreto en ambos servicios.

Cada POST lleva `Content-Type: application/json` (opcionalmente `charset=utf-8`),
`X-Turno-Timestamp` (Unix **segundos**, diez dígitos) y `X-Turno-Signature`
(HMAC-SHA256 hexadecimal minúscula, 64 caracteres). La entrada exacta es:

```text
timestamp.METHOD./ruta.BYTES_DEL_CUERPO
```

El punto tras la ruta es parte del prefijo. Firmá los mismos bytes UTF-8 que
mandás, sin volver a serializar el JSON. El método y la ruta también quedan
vinculados para impedir trasladar una firma entre endpoints. Por ejemplo,
en el backend Node (sin imprimir cuerpo, firma ni secreto):

```js
import { createHmac } from 'node:crypto';
const path = '/v1/agent/events';
const body = JSON.stringify({ id: 'endpoint-smoke', type: 'drafts_ready', shiftId: 'demo-shift', synthetic: true });
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = createHmac('sha256', process.env.TURNO_AGENT_SIGNING_SECRET)
  .update(`${timestamp}.POST.${path}.`).update(body).digest('hex');
// Enviar body sin modificar y estos encabezados por el canal privado del backend.
const headers = { 'content-type': 'application/json', 'x-turno-timestamp': timestamp, 'x-turno-signature': signature };
```

Se admiten hasta ±300 segundos de desfase. Cualquier falla de firma, marca de
tiempo, secreto ausente u origen de navegador devuelve el mismo 401
`{"error":"unauthorized"}`. No se agregan encabezados CORS; OPTIONS y rutas
no declaradas devuelven 404. El cuerpo se limita a 16 384 bytes, aun por chunks.

## Fallos del transporte

| HTTP | Cuerpo | Significado |
|---|---|---|
| 400 | `{"error":"invalid_request"}` | JSON/UTF-8 inválido |
| 401 | `{"error":"unauthorized"}` | Autenticación rechazada |
| 404 | `{"error":"not_found"}` | Ruta o método no admitido |
| 408 | `{"error":"request_timeout"}` | Plazo agotado durante la recepción |
| 413 | `{"error":"body_too_large"}` | Más de 16 KB |
| 415 | `{"error":"unsupported_media_type"}` | Tipo de contenido incorrecto |

El plazo cubre recepción y ejecución. Una ejecución autenticada que excede
el plazo devuelve abstención sin stack trace. Los registros de fallos contienen
solo códigos fijos pasados por `redactSecrets`, nunca mensajes del proveedor.

## Arranque y configuración

Desde `server/`: `npm ci --ignore-scripts` y `npm run serve`. Por defecto escucha
en `127.0.0.1:8787`, con IA apagada. No carga `.env` automáticamente; inyectá
el entorno desde el proceso backend/gestor de secretos. Sin secreto y con IA
apagada, el health funciona pero ningún POST puede autenticarse.

| Variable | Valor por defecto / uso |
|---|---|
| `TURNO_AGENT_SIGNING_SECRET` | Sin valor; obligatorio con IA activa, mínimo 32 bytes |
| `TURNO_AGENT_HOST` | `127.0.0.1`; cambiar solo para una red interna controlada |
| `TURNO_AGENT_PORT` | `8787`, entero 1–65535 |
| `TURNO_AGENT_RATE_LIMIT` | `10` solicitudes por turno y ventana de 60 s; máximo 1000 |
| `TURNO_AGENT_TIMEOUT_MS` | `10000` ms para recepción y ejecución; máximo 30000 |
| `TURNO_AI_ENABLED` | `0`; `1` habilita IA y exige autenticación del proveedor |
| `TURNO_SYNTHETIC_ONLY` | Siempre activo; `0` se rechaza |
| `TURNO_DECISION_MODE` | `GATEWAY`, `DUAL` o `DECISION` |
| `TURNO_AI_MODEL_ID` | `anthropic/claude-haiku-5.5`, sin cambios |
| `TURNO_AI_FALLBACK_MODELS` | `deepseek/deepseek-v4.1-flash`, sin cambios |
| `TURNO_DECISION_MODEL_ID` | `typesafe-ai/jev`, sin cambios |
| `AI_GATEWAY_API_KEY` | Solo entorno servidor; alternativa OIDC como antes |
| `NODE_USE_ENV_PROXY` | `1` si se usa inferencia real detrás de un proxy HTTPS |

La prueba opcional `smoke:endpoint:env` no se agregó: el ejemplo de firma usa
`drafts_ready`, que es determinista y no llama al modelo. No ejecutamos inferencia
real ni se requiere una credencial de modelo para las pruebas automatizadas.

## Rutas

### `GET /healthz`

Sin firma y sin inferencia. Devuelve exactamente:

```json
{"ok":true,"aiEnabled":false,"decisionMode":"GATEWAY","modelId":"anthropic/claude-haiku-5.5"}
```

`ok` significa proceso HTTP disponible, no credenciales/proveedor verificados.
No incluye claves ni snapshots. Con IA activa informa el modo configurado;
`modelId` sigue identificando el LLM configurado, también en `DECISION`.

### `POST /v1/agent/events`

Objeto estricto, sin campos adicionales. Para `drafts_ready`:

```json
{"id":"endpoint-event","type":"drafts_ready","shiftId":"demo-shift","synthetic":true}
```

Para `note_saved` (R5a) el cuerpo solo referencia la nota confirmada:

```json
{"id":"endpoint-event","type":"note_saved","shiftId":"demo-shift","synthetic":true,"noteId":"note-1","noteVersion":1}
```

`id`, `shiftId` y `noteId`: 1–80 caracteres alfanuméricos, guion o guion bajo.
`noteVersion`: entero de 1 a 1 000 000. Tipos admitidos: `note_saved`,
`drafts_ready`. `shift_close_attempt` se retiró en D3 y devuelve 400 como cualquier tipo desconocido. El único turno piloto es `demo-shift`.
El navegador **nunca** envía texto de nota: `text`, `noteText` o cualquier otro
campo extra en `note_saved` devuelve 400. El servidor lee la nota y su versión
desde `notes` del snapshot autorizado (`http/snapshots.mjs`), junto con `tasks`
y las camas. `drafts_ready` conserva reglas deterministas sobre borradores. Las reglas de tareas guardadas (compartir horario y pendientes antes del cierre) viven en el frontend (D3).

HTTP 200 en `note_saved`:

- `{"status":"proposed","noteId":"note-1","noteVersion":1,"suggestions":[{"id":"note:note-1:1","kind":"note-task","title":"…","sourceQuote":"…","noteId":"note-1","noteVersion":1,"channel":"inline","actions":["review","dismiss"],"requiresApproval":true}]}`:
  una sola acción, con cita textual de la nota. El cliente la descarta si la nota
  cambió (R5b).
- `{"status":"stale","reason":"stale_version","suggestions":[]}`: la versión del
  evento no es la confirmada en el snapshot. No llama al modelo.
- `{"status":"abstain","reason":"<código>","suggestions":[]}`: silencio.

Códigos de abstención, en el orden en que se evalúan:

| Código | Cuándo |
|---|---|
| `note_not_found` | El `noteId` no está en el snapshot autorizado |
| `empty` | La nota queda vacía tras recortar espacios |
| `too_long` | Más de 500 caracteres |
| `already_processed` | Ese turno, `noteId` y versión ya tienen una decisión registrada (ver «Semántica de procesamiento») |
| `label_NO_ACTION` | El clasificador no ve nada pendiente |
| `label_PROPOSE_REMINDER` | Recordatorio explícito: no hay sistema de alarmas (C2) |
| `label_NEEDS_REVIEW` | Ambigua, condicional o clínica: no se propone (C3) |
| `classifier_abstain` | Salida inválida o confianza baja del clasificador (no es un fallo) |
| `classifier_failed` | El clasificador activo lanzó error: la marca se libera y una nueva entrega reintenta |
| `cancelled` | Se canceló la inferencia (deadline HTTP): la marca se libera |
| `no_proposal` | El extractor no devolvió una acción con cita exacta, o devolvió cero o más de una |
| `extraction_failed` | Error del extractor (el mensaje no se devuelve ni se registra); la marca se libera |
| `duplicate` | El título propuesto tiene exactamente el mismo conjunto de palabras importantes que una tarea abierta (sin distinguir mayúsculas ni tildes; artículos y preposiciones se ignoran; ordena/ordenar cuentan como la misma palabra). Un detalle extra, como «en la sala 2», no es duplicado. Las tareas completadas no bloquean |

Solo `PROPOSE_TASK` pide extracción. Un título con hora o fecha
(`15:00`, `9.30`, `12/11`) se descarta; no se corrige.

`drafts_ready` responde `{"status":"proposed","suggestions":[...]}` con `actions:["review","dismiss"]` y `requiresApproval:true`, o
`{"status":"abstain","reason":"no_suggestions","suggestions":[]}` cuando no hay sugerencias. Sus tipos son `resolve-bed` y `resolve-date`; no hay `shared-slot` ni `before-close`.

Se reserva cada `id` antes de invocar el motor. Repetirlo devuelve 401 genérico
sin una segunda llamada al modelo. En `note_saved`, además, la clave
`turno:noteId:noteVersion` se marca antes de clasificar
(ver «Semántica de procesamiento»). Máximo 10000 IDs de evento: caché llena
rechaza con 429 sin expulsar IDs vigentes. Un error o timeout tras la admisión
también consume el ID de evento y el cupo; no reintentes automáticamente eventos fallidos.

### `POST /v1/agent/capture`

Objeto estricto:

```json
{"shiftId":"demo-shift","synthetic":true,"text":"Revisar material sintético."}
```

`text`: 1–2500 caracteres, no vacío tras recortar espacios. El backend es
responsable de enviar solo texto sintético; `synthetic:true` **no detecta ni
anonimiza** datos personales. Las camas se leen de la fixture del servidor.

HTTP 200: `{"status":"review_required","shiftId":"demo-shift","proposals":[...]}`.
Se conserva el contrato de captura existente (sin fecha inventada, sin completar,
estado `requires_human_review`) y se agregan `actions:["review","dismiss"]` y
`requiresApproval:true` en esta frontera HTTP, sin cambiar el extractor existente.
En falla o timeout: `{"status":"abstain","proposals":[]}`. Captura siempre usa
el LLM, incluso en `DECISION`. No tiene ID de evento: no ofrece deduplicación;
el backend no debe reintentar automáticamente una captura.

### Errores de aplicación

| HTTP | Cuerpo | Efecto |
|---|---|---|
| 400 | `{"error":"invalid_request"}` | Esquema, datos no sintéticos o turno desconocido; no consume cupo |
| 401 | `{"error":"unauthorized"}` | Evento repetido; no consume otro cupo |
| 429 | `{"error":"rate_limited"}` | Cupo agotado, turno ocupado o caché de replay llena |
| 503 | `{"error":"ai_disabled"}` | IA apagada; no lee snapshot ni llama al proveedor |

Los límites por turno son compartidos entre captura y eventos. Solo se admite
una ejecución a la vez por turno; si vence el plazo HTTP, el turno sigue ocupado
hasta que termine el proveedor. La señal HTTP se combina con los límites propios
(20 s clasificación/extracción, 30 s captura) y llega a Strands o al AI SDK de Jev.
La cancelación es cooperativa: no garantiza que el proveedor ya haya detenido el
trabajo ni que no lo cobre. Las respuestas cierran la conexión.

Replay, versiones procesadas y rate limit son **en memoria, por proceso**: reiniciar borra su estado.
No usar varias réplicas sin un almacén compartido de replay/cupos. Este piloto
no se despliega ni demuestra disponibilidad/costos del proveedor real.

`/v1/agent/capture` no lleva `id` de evento: una solicitud firmada interceptada puede
reenviarse mientras su firma siga dentro de la ventana de validez (±5 min respecto
al reloj del servidor). Es de solo lectura y comparte la cuota por turno, así que
el impacto está acotado a consumo de capacidad y llamadas. Si alguna vez modifica
estado, añadir un identificador único con protección anti-replay como la de
`/v1/agent/events`.

## Semántica de procesamiento

- Una decisión (propuesta, `label_*`, `classifier_abstain` por baja confianza, `no_proposal`,
  `duplicate`, `extraction_unavailable`) se registra como máximo una vez por turno + nota + versión
  durante 601 segundos. Un segundo evento de esa misma versión devuelve `already_processed`.
- Un fallo (`classifier_failed`, `extraction_failed`), una excepción o una cancelación (`cancelled`)
  liberan la marca: el mismo texto puede volver a procesarse.
- No hay reintento automático. Para recuperarse, guarda la nota de nuevo (nueva versión) o reenvía el evento.
- El deadline HTTP (`TURNO_AGENT_TIMEOUT_MS`, 10 s por defecto) solicita cancelación en `/v1/agent/events` y `/v1/agent/capture`. Una desconexión del cliente antes de completar la respuesta también aborta la señal. El límite propio de captura sigue siendo 30 s; rige la señal que aborte primero.
  La respuesta sigue siendo el `200` vacío `{"status":"abstain","suggestions":[]}`; un resultado tardío no registra métricas ni comparaciones.

## Integración posterior del backend

1. Autenticar y autorizar al usuario en el backend, nunca en el navegador.
2. Mantener el secreto fuera del cliente y firmar cada cuerpo desde el backend.
3. Usar IDs únicos; presentar resultados solo para revisión humana.
4. Sustituir `getAuthorizedSnapshot(event)` en `createAgentServer` por una lectura
   backend autorizada, manteniendo identidad de turno y la barrera sintética.
   Conectar datos reales requiere otro alcance y revisión de privacidad.
5. No enviar cuerpos, snapshots, firmas, headers ni errores crudos a logs.
   En `DUAL` el adaptador registra únicamente
   `{ eventId, activeLabel, shadowLabel, agree }`; fallos usan códigos fijos
   limpiados con `redactSecrets`. Cada `note_saved` produce un registro de
   métricas `{ eventId, eligible, classifierCalled, haikuCalled, outcome, durationMs }`:
   sin nota, título ni cita. `classifierCalled` indica que se llamó al clasificador de
   etiqueta (en `GATEWAY` es el adaptador Gateway; en `DECISION`, Jev; en `DUAL`, ambos);
   `haikuCalled` indica que se llamó al extractor.

Métricas por llamada: `{ kind: "model_metrics", stage, modelCalls, modelErrors, turns, inputTokens, outputTokens, durationMs, stopReason }`. `stage` es `decision`, `classification`, `extraction` o `capture`. Solo números no negativos y códigos de parada permitidos; no texto, títulos, citas, claves ni errores de proveedor. Un uso no informado es `null`, no cero. Jev usa métricas de Decision API; Haiku usa hooks y `AgentResult.metrics`. Los fallos del registro no alteran el resultado.

Pruebas sin inferencia remota: `npm test`; incluye streams y sockets localhost.
`npm run test:pack` prueba además los SDK reales con transporte Gateway simulado. Pendientes: backend real, QA de
interfaz, revisión de privacidad y configuración de presupuesto del proveedor.

## Strands extensions (pack v2)

Each generative Agent has the native ContextInjector and CedarAuthorization. Context is a validated, ephemeral allowlist: stage/source/synthetic/reviewOnly and confirmed note version. Internal IDs and other note/task contents are not injected. HTTP rejects caller-supplied extra context fields. Missing native injection fails closed before model invocation through a required-context input guard.

Cedar grants only the SDK internal `strands_structured_output` action, once, for a ready synthetic review-only context. All business/tool actions are explicitly forbidden, including accidentally added tools. The principal identifies this application capability; it is not user authentication or tenant authorization. The existing backend and human-review controls remain mandatory. Jev's Decision API has no Strands tool loop; these extensions apply to the generative Strands Agents, not a fictitious Jev plugin.

Run `npm run test:pack` for native SDK, transport and authorization regressions. Complete verification also requires `npm run verify:evals` with `STRANDS_EVALS_PYTHON` set. No automatic inference or release follows these checks.
