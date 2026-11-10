# Turno: piloto de agente ambiental remoto (sin chatbot)

Estado: **experimental** en rama `feature/opencode-secure-config`. No hay despliegue, backend clínico ni persistencia conectada. El motor de sugerencias no crea, elimina, completa ni cambia tareas; tampoco envía recordatorios. El análisis recibe eventos **solo después de autorización en el backend** y devuelve propuestas para una futura bandeja o toast.

## Arquitectura

- **Strands Agents SDK TypeScript** es el orquestador generativo.
- **Vercel AI Gateway** es el proveedor de inferencia remota (por defecto `anthropic/claude-haiku-4.5`). No se descargan ni ejecutan modelos locales.
- **Vercel Decision API** mediante `microsoft/microsoft-decision-1` es el clasificador remoto opcional para categorías cerradas. **No** es Strands Decider de AWS, que requeriría infraestructura propia; solo imitamos su patrón de evaluación en paralelo.
- Reglas deterministas identifican problemas verificables de camas/fechas/horarios, sin invocar modelos.
- No se expone una ruta HTTP; este módulo se integrará detrás del backend autenticado de Turno cuando exista su contrato.

## API keys seguras

En un despliegue propio de **Vercel**, preferir **OIDC automático**. No configurar `AI_GATEWAY_API_KEY` en ese caso; el SDK usa el token de proyecto. Fuera de Vercel, crear una clave de AI Gateway limitada para el piloto, con presupuesto y posibilidad de revocación, y guardarla como **Secret** del backend. Nunca usar `VITE_` ni `NEXT_PUBLIC_` para una clave, ni exponerla al navegador o a un repositorio.

Para ejecución local del **servidor** (no inferencia local):

```sh
cp server/.env.example server/.env
chmod 600 server/.env
# En tu Mac edita server/.env, nunca lo publiques ni lo pegues en chat.
cd server
npm install --ignore-scripts
npm run check
npm test
npm run demo
```

El comando `demo` y los tests usan **datos sintéticos y no hacen peticiones facturables**. `npm install` sí descarga dependencias npm. `node --env-file=.env` permite cargar configuración al ejecutar un programa del servidor; no hace falta hacerlo para `test` ni `demo`.

Variables configuradas en `server/.env.example`:
- `TURNO_AI_ENABLED=0`: apagado por defecto. Cambiar a 1 solo para pruebas sintéticas explícitas con autenticación del backend.
- `TURNO_SYNTHETIC_ONLY=1`: obligatorio, el piloto rechaza configurarlo en 0 y rechaza eventos no sintéticos.
- `TURNO_AI_MODEL_ID` y `TURNO_DECISION_MODEL_ID`: modelos remotos mediante Gateway.
- `TURNO_DECISION_MODE=GATEWAY` (inferencia Strands), `DUAL` (Strands activo, Decision API solo sombra), o `DECISION` (clasificador remoto activo con abstención bajo confianza desconocida o baja).

**Atención a costos:** `DUAL` puede generar dos solicitudes facturables por nota. Las reglas deterministas no necesitan modelos. Usar un presupuesto por proyecto o clave y mantener `TURNO_AI_ENABLED=0` en producción hasta validar.

## Entradas y salidas

`ambient-engine.mjs` exporta `analyzeAmbientEvent({ event, settings, isAuthorized, getAuthorizedSnapshot, ...classifiers })`. El consumidor backend debe comprobar la identidad antes de entregar un snapshot autoritativo del turno; nunca confiar en una lista de tareas enviada por el navegador. Solo se aceptan los eventos `drafts_ready`, `note_saved`, `shift_close_attempt`. Además de la marca del evento, el snapshot debe estar identificado como sintético por el backend (`snapshot.synthetic === true`). Es una barrera de prueba, no detección automática de datos clínicos. Una nota enviada al clasificador se limita a 500 caracteres sintéticos.

El motor devuelve objetos `suggestions` con `actions: ['review','dismiss']`; no tiene acceso a una función `saveTask`. Para la captura libre se debe añadir después un extractor de borradores de tareas con Zod y revisión explícita; este paso no debe mezclar inferencia con persistencia. El frontend v5 disponible en la rama sigue siendo un prototipo aislado.

## Validación

`npm test`: reglas y contrato de autorización, interruptor de doble ejecución y construcción de Strands/Vercel SDK sin peticiones remotas.
`npm run demo`: imprime alertas basadas en tres tareas sintéticas: falta confirmar fecha para las 15:00; cama 4 no está vinculada al turno de demostración; coincidencia de horario; informe pendiente al cerrar. Ninguna advertencia supone duplicación ni inventa una hora.

**Pendiente:** revisión efectiva de dependencias instaladas en CI, integración en backend autenticado de Turno, toasts accesibles, calibración y prueba facturable mínima con una credencial guardada por el usuario. No se ha probado inferencia real.

Referencias: [Strands VercelModel](https://strandsagents.com/docs/user-guide/sdk/model-providers/vercel/), [Vercel Decision API](https://vercel.com/i/ai-gateway-decision-api-use-cases), [AWS pattern](https://strandsagents.com/blog/amazon-saves-millions-replacing-sonnet-with-strands-decider/).
