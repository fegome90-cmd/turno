# Proveedores de modelos (Strands Agents TypeScript)

El agente de fondo usa la interfaz `Model` de Strands, así que el proveedor se cambia solo con variables de entorno del **servidor**. No hace falta tocar código. Lista según la [documentación de Strands](https://strandsagents.com/docs/user-guide/sdk/model-providers/) (SDK TypeScript 1.24).

```sh
TURNO_AI_PROVIDER=openrouter OPENROUTER_API_KEY=... TURNO_AI_MODEL_ID=openai/gpt-5-mini \
  npm run smoke:background:env
```

| `TURNO_AI_PROVIDER` | Clase Strands | Variable de clave | Host | Modelo por defecto |
|---|---|---|---|---|
| `vercel` (defecto) | `VercelModel` + `@ai-sdk/gateway` | `AI_GATEWAY_API_KEY` (u OIDC en Vercel) | ai-gateway.vercel.sh | `anthropic/claude-haiku-5.5` (respaldo: `deepseek/deepseek-v4.1-flash`) |
| `openai` | `OpenAIModel` (`api: 'chat'`) | `OPENAI_API_KEY` | api.openai.com | `gpt-5-mini` |
| `anthropic` | `AnthropicModel` | `ANTHROPIC_API_KEY` | api.anthropic.com | `claude-haiku-4-5` |
| `google` | `GoogleModel` | `GOOGLE_API_KEY` o `GEMINI_API_KEY` | generativelanguage.googleapis.com | `gemini-2.5-flash` |
| `bedrock` | `BedrockModel` | credenciales AWS o `AWS_BEARER_TOKEN_BEDROCK` (+ `AWS_REGION`) | bedrock-runtime.&lt;región&gt;.amazonaws.com | `global.anthropic.claude-haiku-4-5-20251001-v1:0` |
| `openrouter` | `OpenAIModel` + baseURL | `OPENROUTER_API_KEY` | openrouter.ai | `openai/gpt-5-mini` |
| `fireworks` | `OpenAIModel` + baseURL | `FIREWORKS_API_KEY` | api.fireworks.ai | `accounts/fireworks/models/deepseek-v3p1-terminus` |
| `nebius` | `OpenAIModel` + baseURL | `NEBIUS_API_KEY` | api.tokenfactory.nebius.com | `deepseek-ai/DeepSeek-R1-0528` |
| `ovhcloud` | `OpenAIModel` + baseURL | `OVHCLOUD_API_KEY` | oai.endpoints.kepler.ai.cloud.ovh.net | `Meta-Llama-3_3-70B-Instruct` |
| `crusoe` | `OpenAIModel` + baseURL | `CRUSOE_API_KEY` | api.inference.crusoecloud.com | `zai/GLM-5.2` |
| `orcarouter` | `OpenAIModel` + baseURL | `ORCAROUTER_API_KEY` | api.orcarouter.ai | `orcarouter/auto` |

`TURNO_AI_MODEL_ID` cambia el modelo dentro del proveedor. Por ejemplo:
- `openai/gpt-6.1-sol` con `vercel` (requiere créditos pagados en Gateway);
- `gpt-6.1-sol` con `openai` directo;
- un modelo `...:free` con `openrouter`.

## Reglas comunes a todos los proveedores

- Mismo agente: 1 turno, sin herramientas, salida estructurada (Zod), límites de tokens y tiempo, `maxRetries: 0` donde el cliente lo permite.
- La clave se lee del entorno del servidor y se entrega en memoria al SDK. La configuración solo guarda el **nombre** de la variable (`keyEnv`), nunca su valor.
- Si falta la clave del proveedor elegido, todo falla **antes** de cualquier solicitud. El OIDC de Vercel solo sirve para `vercel`.
- `TURNO_GATEWAY_ONLY` y las etiquetas de gasto solo aplican a `vercel`. `TURNO_AI_REASONING_EFFORT` aplica a GPT-5+, GPT-6 y o* (vía `vercel` u `openai`).
- `TURNO_DECISION_MODE=DUAL|DECISION` sigue usando la Decision API de Vercel y requiere credencial de Gateway.
- Keychain en macOS: servicio `turno-ai-gateway` para Vercel y `turno-<proveedor>` para el resto (cuenta `turno`).
- Paquetes opcionales fijados en `package-lock.json`: `openai`, `@anthropic-ai/sdk`, `@google/genai`. Bedrock usa `@aws-sdk/client-bedrock-runtime`, que ya incluye el SDK.

## Estado de verificación (10 nov 2026)

- **Inferencia real:** solo a través de `vercel`, incluidos los modelos con BYOK (DeepSeek, Meta, TypeSafe AI). La comparación completa y el modelo elegido están en [`DECIDER.md`](DECIDER.md).
- **Resto de proveedores:** probado sin red. Construcción del modelo con clave de relleno (`tests/model-providers.test.mjs`), `smoke:preflight` y fallo cerrado sin clave. **Falta la prueba real** con la clave de cada servicio.
- **Antes de una prueba real en un entorno con lista de hosts permitidos:** autorizar el host de la tabla.
