# Prueba real y segura — Strands Agents + Vercel AI Gateway

**Estado:** ejecución manual no programada, únicamente texto sintético. Cada nueva ejecución puede generar otro cargo; el script no es un bloqueo de ejecuciones repetidas. No conecta la ficha clínica, no abre puertos, no inserta tareas, no genera recordatorios y no modifica la versión oficial. No ejecutar con datos reales.

## Modelo y proveedor

- Strands Agents (TypeScript) orquesta la extracción.
- Vercel AI Gateway realiza la inferencia **remota**, no se descargan LLM en el Mac.
- Modelo por defecto: `anthropic/claude-haiku-5.5`, con `deepseek/deepseek-v4.1-flash` de respaldo (ver [`DECIDER.md`](DECIDER.md)). Cambiar con `TURNO_AI_MODEL_ID` y `TURNO_AI_FALLBACK_MODELS`. El modelo gratuito `nvidia/nemotron-3.5-lightning-free` sigue disponible, pero con ~5 solicitudes/min y menos acierto.
- GPT: `openai/gpt-5-mini` funciona con el plan gratuito; `openai/gpt-6.1-sol`, `gpt-5.5` y `gpt-5.4-mini` exigen **créditos pagados** en Gateway (el free tier responde «Free tier users do not have access to this model»).
- `TURNO_GATEWAY_ONLY=openai` restringe el enrutamiento a OpenAI (necesario para usar una credencial BYOK de OpenAI y evitar failover). BYOK solo funciona con una **API key de OpenAI** (platform.openai.com) cargada en Vercel → AI Gateway → BYOK; una suscripción ChatGPT Plus/Pro no sirve como credencial de API. Las respuestas reportan `is_byok`.
- Las llamadas se etiquetan `turno`, `synthetic-pilot` para filtrar el gasto en el panel de Vercel.
- Un único ciclo de agente Strands (`limits.turns=1`). Captura: máximo configurado de 1200 tokens de salida, 4000 tokens totales y cancelación a los 30 segundos; clasificación: 1200 / 3000 tokens y 20 segundos. Strands utiliza internamente una herramienta para salida estructurada; **no** hay herramientas de acceso a datos, red personalizada ni escritura de tareas. Los límites no garantizan una sola petición al proveedor ni una duración total absoluta.
- `DUAL` / Decision API no participa. Gateway puede tener políticas internas de failover; el límite de un turno Strands no garantiza exactamente una solicitud a proveedores upstream. Activar presupuesto/límite de gasto en Vercel antes de llamar.

## 1. Comprobar sin API key ni costo

Trabaja solo en la rama de prueba `feature/opencode-secure-config`. Desde la carpeta `server/`:

```sh
npm ci --ignore-scripts
npm run check
npm test
npm audit --omit=dev --audit-level=high
npm run smoke:preflight
```

`smoke:preflight` **no usa ningún secreto ni realiza llamadas al modelo**. Devuelve `OFFLINE_CHECKS_ONLY`, `credentialsChecked: false` y `remoteModelVerified: false`; **no afirma que la API esté lista**. No crea ni modifica credenciales. Verificar los cinco comandos antes del primer uso remoto.

## 2. Guardar credencial (preferido en Mac)

1. Crear una **API key exclusiva para Turno** en el panel de AI Gateway de Vercel: https://vercel.com/ai-gateway (idealmente, con límites de presupuesto y permisos mínimos).
2. Abrir **Acceso a Llaveros (Keychain Access)** en macOS. Seleccionar el llavero `inicio de sesión / login`. Crear **Archivo > Nuevo ítem de contraseña**.
3. Escribir exactamente:
   - **Nombre del ítem de llavero / Keychain Item Name:** `turno-ai-gateway`
   - **Cuenta / Account Name:** `turno`
   - **Contraseña / Password:** tu API key de AI Gateway.
4. Guardar. No pegar la clave en ChatGPT, GitHub, tickets, pantallazos ni comandos de terminal.

El comando de la prueba recupera el secreto directamente desde el llavero macOS hacia la memoria del proceso Node. No imprime su contenido, no lo transmite al navegador, no lo escribe en `.env` y no lo incorpora a Git.

Si el Mac solicita permiso para leer el ítem, revisarlo y aprobarlo en macOS. Nunca aceptar un acceso desconocido solo para completar la prueba.

**Alternativa para backend desplegado:** configurar `AI_GATEWAY_API_KEY` como **Secret** en el proyecto Vercel, disponible exclusivamente en el runtime servidor. El script puede utilizar una variable existente mediante `--from-env`, pero la credencial no debe almacenarse en el repositorio. Si se usa OIDC automático en el servicio Vercel, no es necesario crear una clave persistente.

## 3. Prueba REAL (única, manual, potencialmente facturable)

Desde `server/`:

```sh
npm run smoke:live:keychain
```

Este es el primer comando que puede generar un cargo: llama realmente a AI Gateway, pero solo envía el texto sintético incorporado en `live-smoke.mjs`. Nunca envía documentos, tareas clínicas ni información del usuario.

Para un entorno que ya inyecta `AI_GATEWAY_API_KEY` como secreto:

```sh
npm run smoke:live:env
```

**Gate obligatorio antes de `--live`:** verificar en el panel Vercel una clave exclusiva de Turno con presupuesto por clave, período de renovación, fecha de expiración y cuenta/plan correctos; revisar recarga automática de saldo y si hay claves BYOK o fallback habilitados. Una clave nueva o un presupuesto recién editado puede tardar en aplicarse: **confirmar que el presupuesto figure activo en Vercel antes de ejecutar la prueba**. El presupuesto de Gateway es un **límite blando**: la petición que lo cruza todavía puede completarse y el gasto BYOK se factura aparte. Si no puedes verificar estas opciones, no ejecutes el comando. **Jamás pasar la clave como argumento de consola.**

## Otros proveedores

Las pruebas usan el proveedor de `TURNO_AI_PROVIDER` y su clave, por ejemplo `TURNO_AI_PROVIDER=openrouter OPENROUTER_API_KEY=… npm run smoke:background:env`. En Mac: `npm run smoke:background:keychain` con el servicio `turno-<proveedor>`. Ver [`PROVIDERS.md`](PROVIDERS.md).

## 4. Prueba del agente de fondo (background)

```sh
npm run smoke:background:env        # o smoke:background:keychain en Mac
```

Envía eventos sintéticos fijos a `analyzeAmbientEvent`: cuatro `note_saved` (recordatorio, tarea, sin acción e intento de inyección de instrucciones) que sí llaman al modelo, y `drafts_ready` / `shift_close_attempt`, que se resuelven con reglas deterministas sin modelo. Verifica la etiqueta, el estado (`proposed`/`abstain`) y que toda sugerencia sea solo `review`/`dismiss` con aprobación humana. Con modelos `-free` espacia las llamadas 13 s (`TURNO_LIVE_PACE_MS` para cambiarlo). Si el modelo falla, el motor se abstiene (fail-closed).

**Detrás de un proxy HTTPS** (p. ej. sandbox en la nube): el `fetch` de Node no usa `HTTPS_PROXY` por defecto; ejecutar con `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).

### Resultado verificado (10 nov 2026, inferencia real, solo sintético)

| Prueba | Modelo | Resultado |
|---|---|---|
| `smoke:live:env` (captura) | `anthropic/claude-haiku-5.5` (por defecto) | PASS, 1 turno, 2,4 s, 959/451 tokens |
| `smoke:live:env` (captura) | principal caído → respaldo `deepseek/deepseek-v4.1-flash` | PASS, 2,2 s, 714/305 tokens |
| `smoke:background:env` | `anthropic/claude-haiku-5.5` (por defecto) | PASS 6/6; la nota de inyección queda en `NEEDS_REVIEW` |
| `smoke:live:env` (captura) | `nvidia/nemotron-3.5-lightning-free` | PASS, 1 turno, ~2,8 s, 547/460 tokens |
| `smoke:live:env` (captura) | `openai/gpt-5-mini` | PASS, 1 turno, ~3,8 s, 238/269 tokens |
| `smoke:background:env` | `nvidia/nemotron-3.5-lightning-free` | PASS 6/6: recordatorio → `PROPOSE_REMINDER`, tarea → `PROPOSE_TASK`, sin novedades → `NO_ACTION`/`abstain`, reglas `drafts_ready`/`shift_close_attempt` correctas. La nota de inyección dio `NEEDS_REVIEW` en pruebas aisladas, pero a veces el modelo no entrega salida estructurada válida y el motor se abstiene (seguro, pero conviene calibrar) |
| cualquier prueba | `openai/gpt-6.1-sol` | bloqueado en free tier (requiere créditos pagados) |

## Qué debe devolver

La respuesta se valida contra el contrato Zod y se convierte en tres propuestas para aprobación humana. El informe en pantalla contiene:
- nombre del modelo utilizado, latencia y tokens si Strands los informa;
- las tres propuestas y sus banderas de revisión;
- `writes: 0`, `saved: false`;
- evaluaciones deterministas: las dos tareas de cama 4 deben llevar 15:00 sin fecha ni vínculo inventados, y el informe debe permanecer `beforeClose=true` sin hora de cierre **ni cama agregada**; todas deben quedar en revisión humana.

Resultado `PASS` si las tres propuestas cumplen las expectativas; `REVIEW_REQUIRED` si el modelo falla algún criterio; error genérico sin stacktrace sensible en fallos de autenticación/red/esquema. La salida es solo consola del Mac; no se guarda en archivos ni se registra en Turno.

## Controles / límites conocidos

- Los límites de Strands se evalúan entre iteraciones, pueden excederse durante una llamada y la extracción estructurada puede requerir una llamada adicional. **No constituyen un límite monetario garantizado**. Aplicar presupuesto en Vercel y revisar su alcance y excepciones.
- Se rechazan respuestas canceladas, filtradas, interrumpidas o detenidas por presupuesto, incluso si traen un JSON parcial. Una evaluación `PASS` no habilita automáticamente la escritura de tareas.
- La etiqueta `synthetic` no permite detectar datos personales por sí sola. Este script **nunca acepta entrada externa**: la prueba real usa una fixture constante. No conectarlo a producción.
- La autorización dentro del script es un guard interno fijo para la fixture, **no autenticación de usuarios**. La integración final necesitará auth real del backend.
- El código usa las versiones fijadas en `server/package-lock.json` y nunca admite claves en el frontend.
- Si la clave no está disponible, el comando falla **antes** de iniciar una llamada al modelo.
- No se usan LLM locales ni Strands Decider alojado localmente.
- No desplegar el test como API/endpoint ni dejarlo programado de manera recurrente.
