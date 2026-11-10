# Prueba real y segura — Strands Agents + Vercel AI Gateway

**Estado:** manual, una ejecución, únicamente texto sintético. No conecta la ficha clínica, no abre puertos, no inserta tareas, no genera recordatorios y no modifica la versión oficial. No ejecutar con datos reales.

## Modelo y proveedor

- Strands Agents (TypeScript) orquesta la extracción.
- Vercel AI Gateway realiza la inferencia **remota**, no se descargan LLM en el Mac.
- Modelo inicial: `anthropic/claude-haiku-4.5` (cambiar en `TURNO_AI_MODEL_ID` si es necesario).
- Un único turno Strands (`limits.turns=1`), máximo 600 tokens de salida, 3000 tokens totales y 30 segundos de espera; no hay tools y el agente no tiene acceso de escritura.
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

`smoke:preflight` **no usa ningún secreto ni realiza llamadas al modelo**. No crea ni modifica un archivo de credenciales. Confirmar que los cuatro comandos terminan correctamente.

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

No llamar `--live` sin haber configurado presupuesto/credencial. **Jamás pasar la clave como argumento de consola.**

## Qué debe devolver

La respuesta se valida contra el contrato Zod y se convierte en tres propuestas para aprobación humana. El informe en pantalla contiene:
- nombre del modelo utilizado, latencia y tokens si Strands los informa;
- las tres propuestas y sus banderas de revisión;
- `writes: 0`, `saved: false`;
- evaluaciones deterministas: las dos tareas de cama 4 deben llevar 15:00 sin fecha ni vínculo inventados, y el informe debe permanecer `beforeClose=true` sin hora de cierre.

Resultado `PASS` si las tres propuestas cumplen las expectativas; `REVIEW_REQUIRED` si el modelo falla algún criterio; error genérico sin stacktrace sensible en fallos de autenticación/red/esquema. La salida es solo consola del Mac; no se guarda en archivos ni se registra en Turno.

## Controles / límites conocidos

- El límite de turnos y tokens reduce consumo, pero **no equivale a un límite monetario garantizado**: aplicar también restricciones de gasto en Gateway.
- La etiqueta `synthetic` no permite detectar datos personales por sí sola. Este script **nunca acepta entrada externa**: la prueba real usa una fixture constante. No conectarlo a producción.
- La autorización dentro del script es un guard interno fijo para la fixture, **no autenticación de usuarios**. La integración final necesitará auth real del backend.
- El código usa las versiones fijadas en `server/package-lock.json` y nunca admite claves en el frontend.
- Si la clave no está disponible, el comando falla **antes** de iniciar una llamada al modelo.
- No se usan LLM locales ni Strands Decider alojado localmente.
- No desplegar el test como API/endpoint ni dejarlo programado de manera recurrente.
