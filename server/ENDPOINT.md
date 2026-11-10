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

Los contratos de rutas, fixtures y arranque se completan con la integración del motor.
