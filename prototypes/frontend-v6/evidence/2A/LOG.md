# Log de ejecución · Fase 2A (frontend-v6)

Implementador: agente Claude (Haiku 5.5). Encargo: `docs/migration-v6/phase-2a/BRIEF-2A.md`. Rama `claude/confident-galileo-rahzv6`.
HEAD al empezar: `2d1ad501941a354f037904050723a8db5aff925b` (commit del brief; base de la fase `68b5dc9`). Árbol limpio al empezar. Sin commit, push ni PR.
Entorno: Node v24.22.1, npm 11.19.1, un worker (`--maxWorkers=1 --no-file-parallelism`). Cada comando empieza con `export PATH=/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/node24/node-v24.22.1-linux-x64/bin:$PATH`.
Referencia previa: `dist/preview.html` SHA256 `7771a12a42cf510e4feb4e29d1dcd542820c84a553e8fd44e101efe468dab892` (G1B).
Dependencias: sin cambios en `package.json` ni lock. `zustand` 5.1.0 ya estaba declarado.

## Paso 0 · Lectura y estado inicial

- Leídos: brief, contrato común, 10-implementer, PLAN (Global Constraints, §2 D3/D7/D11, §4, Fase 2A, §8), EXECUTION_LESSONS (EXTRA-LIFECYCLE-ASYNC, EXTRA-STATE-AUTHORITY), GLOSARIO, EXECUTION-1B, fuentes v5 y las 30 filas `task: "2A"` de `parity-map.json` (solo lectura).
- Las 30 filas: DRAFT-01..03, EMIL-SKILLS-07, POLISH-08..11, PREVIEW-01..20, VALIDATION-01..02; `targetTests` = format/validation/draft/preview.test.ts.
- Estado v6 previo: `src/app/create-session.ts` (sorteo del subtítulo, 1A/1B), `src/domain/home-subtitle.ts`, `src/components/TemporalField.tsx` con validación propia (a migrar a `src/domain/validation.ts`), `src/notifications/notification-store.ts` (D12). No existe aún `src/domain/{types,format,validation,draft-state}.ts`, adaptadores ni `src/app/store.ts`.

## Paso 1 · Pruebas escritas primero (RED por comportamiento)

- Creados `src/domain/{types,format,validation,draft-state}.ts`, `src/adapters/{turno-port,preview-adapter}.ts`, `src/app/store.ts` (tipos definitivos del store y firmas) y `src/test/{fixtures,network-spy}.ts`. Las firmas lanzan `2A RED: <nombre> no implementado`: stubs sin comportamiento, no módulos ausentes.
- Pruebas portadas de v5 con su ID de matriz como prefijo: `tests/unit/format.test.ts` (PREVIEW-01, POLISH-08..11), `validation.test.ts` (VALIDATION-01..02), `draft.test.ts` (DRAFT-01..03), `preview.test.ts` (PREVIEW-02..20, EMIL-SKILLS-07), `store.test.ts` (EXTRA-STATE-AUTHORITY ×9, EXTRA-LIFECYCLE-ASYNC ×4) y `tests/component/temporal-field.test.tsx` (TEMPORAL-FIELD-DOMAIN ×2).
- Casos añadidos del plan 2A dentro de esas suites (29/02/2028, 24:00, minutos límite, 300/301, 10.000/10.001, DST Chile, WARN 1B de trim, dos instancias, red/almacenamiento cero).
- Comando: `npm run test:unit -- format validation draft preview store`. Código 1. Log `evidence/2A/red-unit.log`: 57 fallidos de 57 (5 archivos). Todos los errores son `2A RED: ... no implementado` o `session.dispose is not a function` (contrato nuevo de `createSession`), más aserciones. Ningún error de import, instalación o entorno (verificado con grep: solo 1 coincidencia genérica, la de `session.dispose`).
- Comando: `npx vitest run --project component tests/component/temporal-field.test.tsx --maxWorkers=1 --no-file-parallelism`. Código 1. Log `evidence/2A/red-component-temporal.log`: 1 fallido (`validateTemporal` de TemporalField no es la función de dominio: `Object.is` falla), 1 pasa (regresión: el mensaje de 1.5 ya existe en 1B).

## Paso 2 · Portar la lógica sin cambiar semántica (GREEN)

- Implementado: `src/domain/format.ts` (parseDate, displayDate, localDate, nextCalendarDate, groupAgenda), `src/domain/validation.ts` (validateTemporal, validateEditor con overload), `src/domain/draft-state.ts` (createTemporalDraft, applyTemporalDraft), `src/adapters/preview-adapter.ts` (createPreviewAdapter con los métodos de TurnoPort y failNext), `src/app/store.ts` (store zustand/vanilla con dueños por campo y persist de una mutación), `src/app/create-session.ts` (createSession amplía 1A: `port`, `notifications`, `dispose`; `random` se llama una vez).
- `src/app/bootstrap.tsx`: el cleanup de `startApp` llama `session.dispose()` (libera la suscripción al notification-store). Sigue creando la sesión una vez y no conecta la UI al store.
- `src/components/TemporalField.tsx`: la regla sale del componente y se importa desde `src/domain/validation.ts`; se reexporta `validateTemporal` y `TemporalKind` (WARN de 1B cerrado por el punto de dominio).
- Decisión de diseño: `validateTemporal` recorta espacios (trim) como v5. El borrador crudo no se modifica; `applyTemporalDraft` produce el valor recortado.
- Decisión: `parseDate` mantiene el lanzamiento de v5 para formato/fecha inexistente y devuelve `null` para vacío. La firma `string|null` del plan se cumple.
- Store, dueños: snapshot (copia confirmada del adaptador), selección/ruta (store UI), borrador y temporal crudos (store de edición), errores (store de edición), avisos (notification-store; el store solo refleja `noticeCount`). Tabla completa en `evidence/2A/OWNERSHIP.md`.

### Comandos y resultados

- `npm run test:unit -- format validation draft preview store` código 0, 57/57 (`evidence/2A/green-unit.log`). Repetido tras cambiar comentarios de D7: 57/57 (`green-unit-2.log`).
- `npm run test:component` código 0, 50/50 (`evidence/2A/green-component.log`).
- `npm run typecheck`: código 2 la primera vez (`typecheck-1.log`: `flush` sin uso en tests/unit/store.test.ts, TS6133). Corregido quitando el helper no usado. Código 0 (`typecheck-2.log`).
- `npm run lint`: código 1 la primera vez (`lint-1.log`, misma causa, no-unused-vars). Corregido. Código 0 (`lint-2.log`).

### Bug de prueba corregido (no de producto)

- `store.test.ts`: la prueba de red/almacenamiento llamaba `ctx.store.getState().dispose()`; `dispose` está en el store, no en su estado. Corregido a `ctx.store.dispose()`. Fallo previo: `TypeError: ... dispose is not a function` (`green-unit.log`).

## Cambios de texto D7 (GLOSARIO.md: «Cama» → «Lista»)

Original v5 → v6 (solo en textos visibles y en las pruebas que los afirman; IDs, `bed-1`, `Bed`, `bedId`, `renameBed` y `createBed` no cambian):

| Ubicación | Original v5 | v6 |
|---|---|---|
| Semilla del adaptador: nombre de lista 1 | `Cama 1` | `Lista 1` |
| Semilla del adaptador: nombre de lista 2 | `Cama 2` | `Lista 2` |
| Error de `renameBed` si no existe | `Cama no encontrada.` | `Lista no encontrada.` |
| Error de `createTask` con lista de otro turno | `La cama no pertenece al turno.` | `La lista no pertenece al turno.` |
| Prueba PREVIEW-09 (regex del error) | `/cama/i` | `/lista/i` |
| Prueba PREVIEW-12 (nombre creado) | `'Cama 3'` | `'Lista 3'` |
| Prueba PREVIEW-16 (nombre nuevo) | `'Cama norte'` (×2) | `'Lista norte'` (×2) |
| Prueba PREVIEW-17 (nombre duplicado) | `'Cama 2'` (×2 en la prueba y su aserción) | `'Lista 2'` |
| Prueba PREVIEW-09 añadida (lista de otro turno) | — | texto nuevo con «Lista» |

Búsqueda de oráculo tras el cambio: `grep -rni cama src tests` → 0 coincidencias (se reescribieron dos comentarios que citaban el término v5).

## Paso 3 · Mutaciones en copia (scratchpad)

- Copia de trabajo: `/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/2A-mut/fe` (src, tests y configs de la fase; `node_modules` enlazado). El árbol del producto no se tocó; tras cada mutación se restaura el archivo y se verifica `diff -r` con el producto (idéntico).
- Script: `evidence/2A/mutations/run-mutations.mjs`. Por cada mutación aplica un reemplazo único (comprobado: exactamente 1 coincidencia), ejecuta `npx vitest run --project unit --maxWorkers=1 --no-file-parallelism format validation draft preview store` y restaura.
- Resultados (`evidence/2A/mutations/results.json`; logs `M*.log`). Cada una sale con código 1 (detectada):

| Mutación | Descripción | Resultado | Pruebas que la detectan (muestra) |
|---|---|---|---|
| M1 fecha validada en UTC | `today` de la agenda = UTC | DETECTED (2 fallos) | POLISH-10; «Mañana» con cambio de horario |
| M1b variante de zona | `localDate` ignora la hora dada | DETECTED (4) | POLISH-08 y añadido; POLISH-10 |
| M2 «mañana» como +24 h | `tomorrow = localDate(now + 24 h)` | DETECTED (1) | solo el caso añadido de cambio de horario de Chile (06/09/2026) |
| M3 conflicto pisa el borrador | en el `catch` de `persist`, el borrador vuelve al snapshot | DETECTED (3) | «conflicto de versión», «fallo simulado», «respuesta tardía con fallo» |
| M4 fallo confirma el guardado | `saveTask` aplica el payload al snapshot si falla | DETECTED (3) | «fallo simulado», «conflicto», «respuesta tardía con fallo» |
| M5 snapshot compartido | `load` devuelve la referencia interna | DETECTED (2) | PREVIEW-02 «snapshots are detached»; conflicto |
| M6 renombrar cambia el id | `renameBed` regenera `bed.id` desde el nombre | DETECTED (2) | PREVIEW-16; PREVIEW-17 |
| M7 nota con shiftId | `saveNote` conserva campos ajenos | DETECTED (1) | PREVIEW-13 |
| M8 trim() en minutos | `validateTemporal` sin recorte del texto crudo | DETECTED (1) | VALIDATION-01 añadido (WARN 1B) |
| M9 suscripción no liberada | `dispose` no llama a `unsubscribe` | DETECTED (2) | EXTRA-LIFECYCLE-ASYNC (20 ciclos de sesión y de store) |

Ninguna mutación sobrevive. Todas se ejecutaron en la copia, no en el producto.

## Paso 4 · Pruebas añadidas tras GREEN (lifecycle del arranque real)

- `tests/component/session-lifecycle.test.tsx`: `EXTRA-LIFECYCLE-ASYNC · 20 ciclos de montaje y desmontaje` con `startApp` bajo StrictMode: sin nodos residuales y listeners de tema balanceados. Código 0 (`green-lifecycle-component.log`).
- Honestidad: esta prueba pasó a la primera (es guarda, no RED funcional). No detecta la fuga de la suscripción al notification-store (la cuentan los 20 ciclos de `store.test.ts`, mutación M9).

## Paso 5 · Gates completos sobre el árbol final

Árbol final: `src/`, `tests/`, `scripts/` (huella sha256 de los archivos ordenados: `ab8dcfa8af87890c4260cd9cd75753169357d7b15556d4d4bdbf93df226a662f`). `package.json` `bc79b9b319d409d7cefeef981f52c8ef0a1ab2daf10de7cc737fc1b114936cb2`, `package-lock.json` `63673cd3cc34ecfea5d4c92a30c42388fe79644d08d6637f04c070dfd8d79280` (sin cambios). Script: `evidence/2A/run-gates.sh` (`static` y `e2e <n>`). Resumen: `evidence/2A/gates/summary.txt`. Hashes en `evidence/2A/SHA256SUMS.txt`.

| Gate | Comando (cwd `prototypes/frontend-v6`) | Clase | Código | Artefacto | SHA256 (prefijo) |
|---|---|---|---|---|---|
| audit-total | `npm audit --include=dev --json` | nonvisual (estructurado) | 0 | `evidence/2A/audit-total.audit.json` | 7a89042b7a831336 |
| audit-runtime | `npm audit --omit=dev --json` | nonvisual (estructurado) | 0 | `evidence/2A/audit-runtime.audit.json` | 7a89042b7a831336 |
| typecheck | `npm run typecheck` | nonvisual | 0 | `evidence/2A/gates/typecheck.log` | da70ef7787d8a61f |
| lint | `npm run lint` | nonvisual | 0 | `evidence/2A/gates/lint.log` | 478f9c8b04f56f44 |
| test:unit | `npm run test:unit` | unit | 0 | `evidence/2A/gates/test-unit.log` (60/60) | 58ce79a05c509c9c |
| test:unit verbose | `npx vitest run --project unit --reporter=verbose` | unit | 0 | `evidence/2A/gates/test-unit-verbose.log` (60 ✓) | 12a12b73e0d36257 |
| test:component | `npm run test:component` | component (jsdom) | 0 | `evidence/2A/gates/test-component.log` (51/51) | 0dc9cba19d00449d |
| build | `npm run build` | build | 0 | `evidence/2A/gates/build.log` | 65e2db7692e1b990 |
| dist/preview.html | `sha256sum dist/preview.html` | build | — | `evidence/2A/dist-preview.sha256` | ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343 |
| check:portable | `npm run check:portable` | browser file:// sin red | 0 (`status: PASS`, `failures: []`) | `evidence/2A/gates/check-portable.log` | 722b9a7ab912b996 |
| measure:bundle | `npm run measure:bundle` | informativo | 0 | `evidence/2A/gates/measure-bundle.log` | 6a48bdc8799229e7 |
| test:e2e run 1 | `npm run test:e2e` | browser chromium | 0 (16 passed) | `evidence/2A/gates/test-e2e-run1.log` | ab7fc9db86e81001 |
| test:e2e run 2 | `npm run test:e2e` | browser chromium | 0 (16 passed) | `evidence/2A/gates/test-e2e-run2.log` | 9d42d07a0ca1e2cc |
| test:e2e run 3 | `npm run test:e2e` | browser chromium | 0 (16 passed) | `evidence/2A/gates/test-e2e-run3.log` | c7a37ee61e3f81c9 |

Notas de gates:
- Auditorías: ambas con `auditReportVersion: 2` y `metadata.vulnerabilities` = 0 en info/low/moderate/high/critical/total. Stderr vacío. Son el JSON nativo de npm; no se generó el bloque estructurado `context`/`risks` del contrato común (ver límites).
- E2E: 16/16 en las tres corridas, en el mismo árbol final; `dist/preview.html` no se reconstruyó entre corridas (SHA igual antes y después).
- `check:parity` no existe en `package.json` (script de la fase 1A, no implementado): NOT RUN, no forma parte de los gates de 2A del brief.
- El bundle sube 1,095,642 → 1,106,242 bytes (+10,600 bruto; gzip 725,886 → 729,360). Causa: `startApp` importa `createSession`, que ahora importa el adaptador, el dominio y `zustand/vanilla`. La UI de Inicio sigue con datos estáticos; el comportamiento visible no cambia y `check:portable` y el e2e lo confirman. Por eso el SHA de `dist/preview.html` cambia de `7771a12a…` (G1B) a `ae271fd0…`.

## Paso 6 · Tabla de paridad

- `evidence/2A/PARITY-2A.md`: 30/30 filas con PASS en `test-unit-verbose.log` (la ejecución final). Ninguna fila sin prueba. `parity-map.json` no se editó (sigue sin cambios en git).
- Cada fila está en el archivo que su `targetTests` nombra (`format`, `validation`, `draft`, `preview`).
- Casos añadidos del plan: llevan el ID de la fila más cercana y aparecen en la misma celda.

## Desviaciones frente al brief

1. `createSession` amplía su firma (`port`, `notifications`) y devuelve `port`, `store` y `dispose`; `startApp` llama a `dispose` al desmontar. Los campos previos (`preferredName`, `homeSubtitle`) no cambian.
2. Se añadieron `tests/component/temporal-field.test.tsx` (enlace de TemporalField con el dominio), `tests/component/session-lifecycle.test.tsx` (20 ciclos del arranque real) y los auxiliares `src/test/fixtures.ts` y `src/test/network-spy.ts`. El brief solo listaba `tests/unit/*`; estos cubren requisitos de 2A ya citados.
3. Las pruebas v5 con `node:test` y `assert` se portaron a `vitest` con `expect`. Los valores esperados son los de v5, salvo D7.
4. `parseDate` mantiene el lanzamiento de v5 para formato o fecha inexistente. El plan lo describe como `string|null`; el tipo de retorno se cumple.
5. La ruta (`Route`: vista, archivo) está tipada en `types.ts` pero el store solo modela la selección. La navegación es de 2B. La tabla de dueños describe esta frontera.
6. Sin UI conectada al store, como pide el brief. `startApp` sigue con datos estáticos.
7. El SHA de `dist/preview.html` cambia (ver Paso 5). El cambio se explica por la cadena de importación, no por un cambio de comportamiento.
8. Dos fallos de gate de la primera pasada (typecheck y lint por una variable no usada en pruebas) se corrigieron y se registran; ambos gates se repitieron en verde.
9. El contrato estructurado de auditoría (`context`, `risks`, validador `contract_gate.py`) no se produjo ni se ejecutó: el validador revisa el informe del orquestador, no el de implementación. Los JSON nativos de npm están en su lugar.
