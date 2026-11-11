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

Objeto estricto, sin campos adicionales:

```json
{"id":"endpoint-event","type":"note_saved","shiftId":"demo-shift","synthetic":true}
```

`id` y `shiftId`: 1–80 caracteres alfanuméricos, guion o guion bajo. Tipos
admitidos: `note_saved`, `drafts_ready`, `shift_close_attempt`. El único turno
piloto es `demo-shift`; camas, borradores y nota se obtienen de
`http/snapshots.mjs`, nunca del cuerpo. `note_saved` clasifica la nota fija;
los otros dos eventos conservan las reglas deterministas del motor existente.

HTTP 200: `{"status":"proposed","suggestions":[...]}` o
`{"status":"abstain","suggestions":[]}`. Todas las sugerencias conservan
`actions:["review","dismiss"]` y `requiresApproval:true`.

Se reserva cada `id` antes de invocar el motor. Repetirlo devuelve 401 genérico
sin una segunda llamada al modelo. Se conserva durante 601 segundos, cubriendo
el máximo de vigencia de una firma futura válida. Máximo 10000 IDs: caché llena
rechaza con 429 sin expulsar IDs vigentes. Un error o timeout tras la admisión
también consume el ID y el cupo; no reintentes automáticamente eventos fallidos.

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
hasta que termine el proveedor. Los proveedores conservan sus límites originales
(20 s clasificación, 30 s captura); el plazo HTTP no garantiza cancelar una
solicitud upstream ni evitar su costo. Las respuestas cierran la conexión.

Replay y rate limit son **en memoria, por proceso**: reiniciar borra su estado.
No usar varias réplicas sin un almacén compartido de replay/cupos. Este piloto
no se despliega ni demuestra disponibilidad/costos del proveedor real.

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
   limpiados con `redactSecrets`.

Pruebas sin sockets ni inferencia: `npm test` (inyecta clasificadores y ejercita
el listener público de `node:http` con streams). Pendientes: backend real, QA de
interfaz, revisión de privacidad y configuración de presupuesto del proveedor.
