# Tabla de paridad · Fase 2A

Fuente: 30 filas `task: "2A"` de `docs/migration-v6/parity-map.json` (solo lectura; no editado). Resultado: `evidence/2A/gates/test-unit-verbose.log` (ejecución final, `dist/preview.html` SHA256 `ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343`). Las pruebas añadidas por el plan llevan el ID de la fila más cercana y se marcan «añadido».

| # | requirementId | Fuente v5 (test) | Destino v6 (archivo · prueba) | Estado |
|---|---|---|---|---|
| 1 | DRAFT-01 | raw temporal draft retains edits before validation and across re-render | `unit/draft.test.ts` · DRAFT-01 · raw temporal draft retains edits before validation and across re-render | PASS |
| 2 | DRAFT-02 | invalid temporal text survives validation failure | `unit/draft.test.ts` · DRAFT-02 · invalid temporal text survives validation failure | PASS |
| 3 | DRAFT-03 | applying temporal fields does not mutate source entity | `unit/draft.test.ts` · DRAFT-03 · applying temporal fields does not mutate source entity | PASS |
| 4 | EMIL-SKILLS-07 | simulated adapter conflict identifies its type without prescribing Save | `unit/preview.test.ts` · EMIL-SKILLS-07 · simulated adapter conflict identifies its type without prescribing Save | PASS |
| 5 | POLISH-08 | civil date is evaluated in Santiago rather than UTC at midnight boundaries | `unit/format.test.ts` · POLISH-08 · civil date is evaluated in Santiago rather than UTC at midnight boundaries<br>`unit/format.test.ts` · POLISH-08 · añadido: fin de mes, fin de año y bisiesto se evalúan en Santiago | PASS |
| 6 | POLISH-09 | tomorrow calendar arithmetic handles month/year/leap boundaries without 24-hour assumptions | `unit/format.test.ts` · POLISH-09 · tomorrow calendar arithmetic handles month/year/leap boundaries without 24-hour assumptions<br>`unit/format.test.ts` · POLISH-09 · añadido: 28/02 de año no bisiesto pasa a 01/03 | PASS |
| 7 | POLISH-10 | agenda groups Hoy, Mañana, later dates and undated tasks without mutating data | `unit/format.test.ts` · POLISH-10 · agenda groups Hoy, Mañana, later dates and undated tasks without mutating data<br>`unit/format.test.ts` · POLISH-10 · añadido: «Mañana» es el día civil siguiente aunque el cambio de horario de Chile tenga 23 h | PASS |
| 8 | POLISH-11 | agenda handles empty and only-undated lists, including empty date strings | `unit/format.test.ts` · POLISH-11 · agenda handles empty and only-undated lists, including empty date strings | PASS |
| 9 | PREVIEW-01 | date-only is dd/mm/yyyy and leap days validated | `unit/format.test.ts` · PREVIEW-01 · date-only is dd/mm/yyyy and leap days validated | PASS |
| 10 | PREVIEW-02 | snapshots are detached | `unit/preview.test.ts` · PREVIEW-02 · snapshots are detached<br>`unit/preview.test.ts` · PREVIEW-02 · añadido: dos instancias del adaptador no comparten estado<br>`unit/preview.test.ts` · PREVIEW-02 · añadido: el adaptador no llama a red ni a almacenamiento | PASS |
| 11 | PREVIEW-03 | save accepts literal title and increments version | `unit/preview.test.ts` · PREVIEW-03 · save accepts literal title and increments version<br>`unit/preview.test.ts` · PREVIEW-03 · añadido: título de 1 y 300 caracteres se guarda; 301 se rechaza sin cambiar el estado<br>`unit/preview.test.ts` · PREVIEW-03 · añadido: cuerpo de 10.000 se guarda y 10.001 se rechaza; HTML en el cuerpo se guarda literal | PASS |
| 12 | PREVIEW-04 | save rejects blank title without changing state | `unit/preview.test.ts` · PREVIEW-04 · save rejects blank title without changing state | PASS |
| 13 | PREVIEW-05 | version conflict preserves confirmed state | `unit/preview.test.ts` · PREVIEW-05 · version conflict preserves confirmed state | PASS |
| 14 | PREVIEW-06 | simulated failed save does not commit | `unit/preview.test.ts` · PREVIEW-06 · simulated failed save does not commit | PASS |
| 15 | PREVIEW-07 | close preserves pending tasks and notes; opening is empty | `unit/preview.test.ts` · PREVIEW-07 · close preserves pending tasks and notes; opening is empty | PASS |
| 16 | PREVIEW-08 | quick note has no shift or bed fields | `unit/preview.test.ts` · PREVIEW-08 · quick note has no shift or bed fields | PASS |
| 17 | PREVIEW-09 | cannot create a task without an open shift or cross-link a bed | `unit/preview.test.ts` · PREVIEW-09 · cannot create a task without an open shift or cross-link a bed<br>`unit/preview.test.ts` · PREVIEW-09 · añadido: una lista de otro turno se rechaza | PASS |
| 18 | PREVIEW-10 | archive is read only | `unit/preview.test.ts` · PREVIEW-10 · archive is read only | PASS |
| 19 | PREVIEW-11 | only one active shift in preview | `unit/preview.test.ts` · PREVIEW-11 · only one active shift in preview | PASS |
| 20 | PREVIEW-12 | new bed and task are linked to active shift | `unit/preview.test.ts` · PREVIEW-12 · new bed and task are linked to active shift | PASS |
| 21 | PREVIEW-13 | note save is independent and ignores foreign linkage fields | `unit/preview.test.ts` · PREVIEW-13 · note save is independent and ignores foreign linkage fields | PASS |
| 22 | PREVIEW-14 | time requires date and accepts 24-hour format | `unit/preview.test.ts` · PREVIEW-14 · time requires date and accepts 24-hour format | PASS |
| 23 | PREVIEW-15 | close repetition preserves the same result | `unit/preview.test.ts` · PREVIEW-15 · close repetition preserves the same result | PASS |
| 24 | PREVIEW-16 | renameBed changes only the label and preserves IDs, shift and all task relations | `unit/preview.test.ts` · PREVIEW-16 · renameBed changes only the label and preserves IDs, shift and all task relations | PASS |
| 25 | PREVIEW-17 | duplicate group names do not merge stable identities or task membership | `unit/preview.test.ts` · PREVIEW-17 · duplicate group names do not merge stable identities or task membership | PASS |
| 26 | PREVIEW-18 | renameBed rejects invalid labels and missing groups without changing the snapshot | `unit/preview.test.ts` · PREVIEW-18 · renameBed rejects invalid labels and missing groups without changing the snapshot | PASS |
| 27 | PREVIEW-19 | renameBed failure leaves label and relationships unchanged; retry can succeed | `unit/preview.test.ts` · PREVIEW-19 · renameBed failure leaves label and relationships unchanged; retry can succeed | PASS |
| 28 | PREVIEW-20 | archived group cannot be renamed even after opening a new active shift | `unit/preview.test.ts` · PREVIEW-20 · archived group cannot be renamed even after opening a new active shift | PASS |
| 29 | VALIDATION-01 | validation distinguishes fields in the same semantic family | `unit/validation.test.ts` · VALIDATION-01 · validation distinguishes fields in the same semantic family<br>`unit/validation.test.ts` · VALIDATION-01 · añadido: minutos vacío, 0 y 1440 válidos; -1, 1.5 y 1441 inválidos con el mensaje de v5<br>`unit/validation.test.ts` · VALIDATION-01 · añadido: 23:59 válido y 24:00 inválido con el mensaje de v5<br>`unit/validation.test.ts` · VALIDATION-01 · añadido (WARN 1B): la validación recorta el texto de minutos, el crudo conserva sus espacios y el valor aplicado no los tiene | PASS |
| 30 | VALIDATION-02 | civil date validation, date dependency, valid boundaries and note isolation | `unit/validation.test.ts` · VALIDATION-02 · civil date validation, date dependency, valid boundaries and note isolation<br>`unit/validation.test.ts` · VALIDATION-02 · añadido: 29/02/2028 válido, 29/02/2027 inválido y 31/02/2026 conservado como texto crudo con error<br>`unit/validation.test.ts` · VALIDATION-02 · añadido: título de 1 y 300 caracteres válido; 301 inválido; cuerpo 10.000 válido y 10.001 inválido<br>`unit/validation.test.ts` · VALIDATION-02 · añadido: validateTemporal expone la regla de minutos y hora de v5 | PASS |

Resumen: 30/30 filas con PASS en la ejecución final.

## Reconciliación del 09/11/2026

Esta tabla histórica se contrasta ahora con la copia de ejecución `docs/parity-map.json` del frontend-v6: 30 filas verified no visuales con targetTests y targetCases exactos extraídos de resultados ejecutados, no marcadores. El canon raíz `docs/migration-v6/parity-map.json` se conserva inmutable. Véase `docs/EXECUTION-2A-RECONCILIATION.md` y `evidence/2A/reconciliation-20261109/`. No se cierra interfaz ni HISTORY.
