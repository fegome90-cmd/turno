# PR #4 · Ejecución real controlada con Vercel AI Gateway

**Estado:** pack Strands v2 publicado en la rama del PR para revisión; el piloto permanece en borrador. **Publicar el código no autoriza por sí solo gasto en inferencia, integración a `main`, despliegue ni datos reales.**

## Objetivo del siguiente agente

Ejecutar una prueba **real** y trazable del recorrido `nota sintética -> Jev -> Haiku 5.5 -> propuesta para revisión`, conservando la autorización humana y cero escrituras de tareas. No sustituir esta prueba por mocks ni anunciarla como realizada hasta observar llamadas en Gateway Logs.

**Proveedor y modelos fijos:** Vercel AI Gateway; decider `typesafe-ai/jev` por la Decision API (`DECISION`); extractor `anthropic/claude-haiku-5.5` por Strands `VercelModel`. El decider no ejecuta plugins de Strands; ContextInjector y Cedar operan en Haiku. El runtime se mantiene sin herramientas de negocio y sin modificación de tareas.

## Puerta antes de hacer cualquier llamada facturable

1. Confirmar SHA/PR y que el pack está instalado (ver `docs/strands-integration-pack.md`); correr `cd server && npm ci --ignore-scripts --no-audit --no-fund && npm run check && npm test && npm run test:pack` y Strands Evals (Python 3.12, ver `server/eval/strands/README.md`). Confirmar CI verde. Si falla, detener.
2. Comprobar la **cuenta y equipo de Vercel correctos**. El conector `@Vercel` y la CLI local pueden estar autenticados en cuentas diferentes; no atribuir el acceso de una a otra. Revisar `vercel whoami`, `vercel project list` y la identidad del equipo/clave. No copiar secretos a logs, código o chat.
3. Confirmar un presupuesto vigente y autorizado (equipo, proyecto o clave según método de autenticación) y saldo suficiente. Inspeccionar mediante `vercel ai-gateway budgets list --json` y `vercel ai-gateway api-keys inspect <ID> --json` si se utiliza clave. La consulta de saldo sola no comprueba un límite de gasto. **BYOK puede facturarse por separado y escapar al presupuesto del Gateway.** No crear/modificar claves o presupuestos sin autorización explícita.
4. Disponer de autenticación de backend: `AI_GATEWAY_API_KEY` en entorno seguro o `VERCEL_OIDC_TOKEN` en un runtime Vercel vinculado, no en el frontend. Nunca imprimir valores. Si no hay clave/token adecuado o el presupuesto no está verificado, devolver `BLOCKED` y detenerse. No solicitar al usuario pegar una clave en el chat.
5. Confirmar que los modelos siguen disponibles en el catálogo `/v1/models` y el ID exacto en la configuración. No activar fallbacks alternativos para esta comparación. Solo fixtures sintéticas incluidas en el repositorio; **prohibidos datos clínicos reales**.

## Ejecución solicitada — solo después de cumplir la puerta

Desde un backend aislado con credencial segura ya configurada:

```bash
cd server
TURNO_AI_ENABLED=1 \
TURNO_SYNTHETIC_ONLY=1 \
TURNO_AI_PROVIDER=vercel \
TURNO_DECISION_MODE=DECISION \
TURNO_AI_MODEL_ID=anthropic/claude-haiku-5.5 \
TURNO_AI_FALLBACK_MODELS='' \
TURNO_DECISION_MODEL_ID=typesafe-ai/jev \
node eval/run-note-eval.mjs --live --mode DECISION --holdout \
  --max-calls 40 --pace-ms 1500 --min-balance 5 --reps 1
```

La evaluación usa 22 casos sintéticos y un límite interno de 40 llamadas instrumentadas, con abortado antes de excederlo. **No constituye un límite monetario estricto ni prueba que el Gateway no haga reintentos internos.** Si se necesita primero una prueba de conectividad de solo un caso, usar `--max-calls 2` y declarar `PARTIAL/ABORTED`, no `PASS` del corpus completo.

El script escribe un informe en `server/eval/results/`. Revisar y redactar todo antes de agregarlo al repositorio; preferir adjuntar un resumen pequeño al PR. La medición de tokens/costo de Jev puede ser parcial: comprobar el gasto en los registros reales de Gateway, no inferirlo de un campo ausente.

## Evidencia y criterios de cierre

El agente ejecutor deberá responder en el PR con: SHA ejecutado; método de autenticación **sin secretos**; hora de la prueba; IDs exactos de modelos; número de solicitudes efectivas y modelo que respondió; resultados por caso, abstenciones, falsos positivos, latencias y tokens informados; costo total y presupuestos consultados; `writes: 0`; estado de los plugins de Haiku; enlaces a registros de Gateway cuando estén disponibles. Etiquetar explícitamente `PASS`, `FAIL` o `BLOCKED` por prueba.

Una propuesta incorrecta **no** debe corregirse maquillando el corpus, el prompt o las aserciones para lograr 100 %. Evaluar por separado calidad de inferencia, seguridad, idempotencia, cancelación y UX. No habilitar herramientas de escritura, no activar tráfico real, no guardar o completar tareas automáticamente.

## Limitaciones ya verificadas

- El pack v2 superó pruebas offline y E2E de backend con tráfico externo simulado. Esto **no** verifica inferencia real de los dos modelos.
- React v6 todavía no consume `/v1/agent/events` ni `/v1/agent/capture`. No declarar E2E de producto completo mientras no exista ese puente.
- En una ejecución local de navegador del 12-11-2026, 226/227 pruebas aprobaron; un test de primer pintado (`offline-theme.spec.ts`) tenía una condición de carrera. Con espera explícita mediante `expect.poll()` pasó, pero esa corrección no se incorporó aquí.
- La comprobación estricta de una corrida histórica marcaba `task-04` como FAIL por la diferencia literal «Actualiza»/«actualizar». Ya no aplica: desde be9c08f los títulos se juzgan por raíz de palabra, y el re-juicio de la corrida holdout guardada da 22/22 con `task-04` aprobado. Conservar la evidencia original.
- Una corrida live 56x3 sobre 00fdf1e dio 165/168 con 0 errores técnicos; solo ext-22 falla (3 de 3). Los resultados completos no se guardan en el repositorio hasta resolver D4.

**No merge ni despliegue automático.** Cerrar con `REPLY` trazable y esperar la decisión de integración a producto por separado.
