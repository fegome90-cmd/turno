# Encargo de la fase 2A · implementador

Fecha: 09/11/2026. Autorización: orden del dueño «Si» a seguir con 2A tras G1B aprobado (`68b5dc9`), con el reparto «orquestas, haiku ejecuta y sonnet testea». Alcance: solo 2A. Sin push, PR ni 2B.

## Lee completo antes de escribir

1. `docs/migration-v6/agent-contracts/prompts/00-contract.md` y `10-implementer.md`.
2. `docs/migration-v6/PLAN.md`: «Global Constraints», sección 4 «Estructura y contratos» (tipos compartidos, `TurnoPort`, `PreviewPort` exactos), «Fase 2A» completa, y en la sección 2 D3, D7, D11.
3. `docs/migration-v6/EXECUTION_LESSONS.md`: EXTRA-LIFECYCLE-ASYNC y EXTRA-STATE-AUTHORITY.
4. `docs/migration-v6/GLOSARIO.md` (D7) y `docs/migration-v6/phase-1b/EXECUTION-1B.md` (estado de 1B).
5. Fuentes v5 que se portan (solo lectura): `src/format.mjs`, `src/validation.mjs`, `src/draft-state.mjs`, `src/preview-adapter.mjs` y sus pruebas `tests/preview.test.mjs`, `tests/validation.test.mjs`, `tests/draft.test.mjs`, las pruebas de fechas/Agenda de `tests/polish.test.mjs` y la de conflicto simulado de `tests/emil-skills.test.mjs`.
6. Filas de la matriz con `task: "2A"` en `docs/migration-v6/parity-map.json` (30 filas: DRAFT-01..03, EMIL-SKILLS-07, POLISH-08..11, PREVIEW-01..20, VALIDATION-01..02). Cada una tiene `targetTests` y `targetCases`: úsalos como destino exacto.

## Entorno

Igual que 1B: repositorio `/home/user/turno`, rama `claude/confident-galileo-rahzv6`, base `68b5dc9`; solo `prototypes/frontend-v6/**`. En cada comando: `export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH`. Un worker. Sin dependencias nuevas (zustand ya está en el lock).

## Qué se hace

Archivos del PLAN: `src/domain/{types,format,validation,draft-state}.ts`, `src/adapters/{turno-port,preview-adapter}.ts`, `src/app/{create-session,store}.ts` (amplía `create-session.ts` de 1A sin romper `startApp` ni sus pruebas); pruebas `tests/unit/{format,validation,draft,preview,store}.test.ts`.

1. **Portar las pruebas primero**, con el ID de la matriz en el nombre (`test('PREVIEW-05 · …')`) y los mismos valores esperados de v5. Única excepción de texto (D7): en textos visibles, «Cama/cama» pasa a «Lista/lista» (por ejemplo `Lista 1`, `La lista no pertenece al turno.`, `Lista no encontrada.`). Los nombres internos (`Bed`, `bedId`, `renameBed`, ids `bed-1`) no cambian. Registra en LOG.md cada texto cambiado por D7, con su original.
2. **Casos exactos añadidos por el plan** (en las pruebas que correspondan): `29/02/2028` válido, `29/02/2027` inválido, `31/02/2026` conservado como texto crudo con error; `23:59` válido y `24:00` inválido; minutos `''`, `'0'`, `'1440'` válidos y `'-1'`, `'1.5'`, `'1441'` inválidos con el mensaje v5; límites UTC/Santiago a medianoche, fin de mes/año, bisiesto y una fecha de cambio de horario de Chile, sin sumar 24 h para «mañana»; títulos de 1/300/301 caracteres, cuerpo de 10.000/10.001; texto con HTML guardado literal; lista de otro turno rechazada; cierre repetido con el mismo resultado; turno nuevo vacío; archivo de solo lectura; dos instancias del adaptador sin estado compartido. Además: `TemporalField` de 1B debe usar `validation.ts` del dominio, y una prueba debe detectar `trim()` en el texto crudo de minutos (WARN de 1B).
3. **Store y autoridad (EXTRA-STATE-AUTHORITY):** tabla de dueños en `evidence/2A/OWNERSHIP.md` (snapshot confirmado: adaptador → store; borrador crudo: store de edición; selección/ruta: store de UI; avisos: notification-store). Zustand guarda UI y copias confirmadas; sin actualizaciones optimistas. Pruebas con promesas controladas: guardado OK, fallo, conflicto y respuesta tardía de una selección anterior; tras fallo/conflicto el snapshot conserva sus valores y el borrador conserva el texto que se editaba; una sola mutación del adaptador por acción.
4. **Ciclo de vida (EXTRA-LIFECYCLE-ASYNC):** `createSession` una vez por bootstrap; 20 ciclos crear/destruir sesión y store con suscripciones contadas que vuelven a cero (incluye la suscripción al notification-store, la fuga que sobrevivió en 1B).
5. **Sin red ni persistencia:** espía `fetch`, `XMLHttpRequest`, `localStorage`, `sessionStorage` e `indexedDB` en las pruebas de store/adaptador: cero llamadas.

## Pasos y evidencia (`prototypes/frontend-v6/evidence/2A/LOG.md`, comando + código + resumen por paso)

1. Pruebas escritas; `npm run test:unit -- format validation draft preview store` debe FALLAR por funciones faltantes/aserción, no por entorno (`red-unit.log`).
2. Portar la lógica sin cambiar semántica. GREEN (`green-unit.log`).
3. Mutaciones en una copia (scratchpad), registrar detectada/sobrevive: fecha validada en UTC; «mañana» como +24 h; conflicto que pisa el borrador; fallo que confirma el guardado; snapshot compartido (sin clonar); renombrar que cambia el id; nota con `shiftId`; `trim()` en minutos; suscripción no liberada.
4. Gates completos: audit total y runtime (0, código 0), typecheck, lint, `test:unit`, `test:component`, build + `sha256sum dist/preview.html`, `check:portable`, `test:e2e` completo 3 veces. `dist/preview.html` no debe cambiar de comportamiento (el Inicio sigue con datos estáticos; no conectes aún la UI al store salvo lo imprescindible, y si cambia el SHA explica por qué).
5. Tabla en `evidence/2A/PARITY-2A.md`: cada una de las 30 filas → prueba v6 → resultado. No edites `parity-map.json` (eso es del orquestador).
6. Sin commit. Reporte común: READY_FOR_REVIEW o STOP, con cada gate (comando, código, artefacto, SHA256) y desviaciones.

## Prohibido

Editar fuera de `prototypes/frontend-v6/`; tocar v5 o `docs/`; `skip`, borrar aserciones, cambiar valores esperados de v5 (salvo D7, registrado), subir tolerancias; dependencias nuevas; red o persistencia; inventar dominio de backend; marcar PASS sin ejecutar.
