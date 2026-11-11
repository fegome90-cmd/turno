# Revisión independiente · Fase 2A (modo especificación + calidad)

Revisor: agente Sonnet 5.5, distinto del implementador. Fecha 09/11/2026. Árbol: HEAD `2d1ad50` + cambios sin commit (3 archivos modificados y los nuevos listados por `git status`). Ningún archivo de producto, v5 ni `docs/` fue editado por mí; salidas solo en `evidence/2A/review/`. Mutaciones solo en la copia `/tmp/claude-0/-home-user/8cf68a13-dfaf-5a28-abd6-4aeff82e78d1/scratchpad/v6-2a-mutants`.

## Veredicto: APPROVE_PHASE (con 6 WARN de huecos de oráculo y 3 SUGGEST; ningún BLOCK)

Todos los gates repetidos por mí dan 0. Las 30 filas conservan los valores esperados de v5 (única diferencia: D7). La lógica de dominio y el adaptador son semánticamente idénticos a v5 salvo D7. El código del store hace lo que dice OWNERSHIP.md. Los WARN son pruebas que no detectan mutaciones plausibles (el código actual es correcto); conviene cerrarlos con pruebas pequeñas antes de 4A. No autorizo backend, publicación ni merge.

## Hallazgos

### BLOCK
Ninguno.

### WARN
- **W1 · El borrador temporal crudo no se prueba tras fallo/conflicto/respuesta tardía.** `tests/unit/store.test.ts:79` (fallo), conflicto y respuesta tardía solo afirman `draft.title/body`; ninguno afirma `temporal`. OWNERSHIP.md (fila `temporal`) cita esas pruebas como evidencia: sobre-afirma. Mutación N11 (el `catch` de `persist` en `src/app/store.ts:65` resetea `temporal`) SOBREVIVE (60/60). Esperado: una prueba que edite `temporal.date='31/02/2026'`, fuerce fallo/conflicto y compruebe el texto crudo intacto. El código actual es correcto (el `catch` solo notifica).
- **W2 · `select` no está probado para `temporal` ni `errors`.** `src/app/store.ts:100-111`. N28 (no reiniciar `temporal` al cambiar de selección: fugaría fecha/hora de una tarea a otra) y N26 (conservar `errors` previos) SOBREVIVEN.
- **W3 · Detección de `trim()` en el texto crudo: cubierta a medias.** La prueba `tests/unit/validation.test.ts:43` (título «sin trim») en realidad afirma que `'  10  '` es válido (el trim de validación es lo que v5 hace); detecta quitar ese trim (M8 del implementador y mi comprobación) y que `applyTemporalDraft` no muta el crudo. Pero N30 (`setTemporalField` recorta el crudo en el store, `src/app/store.ts:122`) SOBREVIVE, y N31 (quitar trim de `duration` en `applyTemporalDraft`) también. El título de la prueba contradice su contenido; el WARN de 1B pedía detectar el trim en el crudo, y el punto del store no está cubierto. Solución: afirmar vía store que tras `setTemporalField('estimate','  10  ')` el crudo es `'  10  '`, y cubrir las cuatro claves en `applyTemporalDraft`.
- **W4 · «Vacío no es cero» sin oráculo en `applyTemporalDraft`.** N19 (`estimate: ... || '0'`, `src/domain/draft-state.ts:21`) SOBREVIVE. v5 tampoco lo prueba, pero es invariante del contrato (EXECUTION/Global Constraints) y el plan lo pide para minutos `''`. Agregar `expect(applyTemporalDraft(task, {...raw, estimate:''}).estimate).toBe('')`.
- **W5 · Cableado `startApp -> session.dispose()` sin oráculo.** `src/app/bootstrap.tsx:65`. N32 (quitar `session.dispose()`) SOBREVIVE (111/111 unit+component). La fuga de 1B (suscripción al notification-store) se cuenta en `store.test.ts` sobre `createSession`/`createTurnoStore`, pero la prueba de 20 ciclos del arranque real (`tests/component/session-lifecycle.test.tsx`) solo cuenta listeners de `matchMedia`. El implementador lo admite en LOG (Paso 4). Pendiente: contar suscripciones del notification-store en el ciclo real (inyectar o espiar).
- **W6 · Ruta de nota del store sin pruebas.** `saveNote` (`src/app/store.ts:151-172`) no aparece en ningún test de store; N29 (respuesta tardía de nota pisa el borrador siempre) SOBREVIVE. Los otros pasos de EXTRA-STATE-AUTHORITY se prueban solo sobre tareas.

### SUGGEST
- **S1 · `createSession` y `createTurnoStore` se apartan de la firma del PLAN §4.** `src/app/create-session.ts:12-17`: el plan dice `createSession({port, random, now})` -> `{store, homeSubtitle, dispose}`; la implementación no tiene `now`, hace `port` opcional, añade `preferredName`/`notifications` y devuelve además `port` y `preferredName`. `createTurnoStore(port, notifications)` agrega el segundo parámetro (el plan: `createTurnoStore(port)`). Son ampliaciones compatibles (los tests de 1A siguen verdes y el cambio está justificado por D12 y la fuga de 1B), pero no están registradas como decisión del orquestador. Recomiendo anotar la enmienda del plan; `now` se necesitará en 4A (Agenda «Hoy») y puede añadirse entonces. El store también omite «filtros» del plan §4 (no son de 2A).
- **S2 · `persist` descarta en silencio una acción mientras hay otra en curso** (`src/app/store.ts:61`). Sin aviso ni cola; lo prueba solo para doble `saveTask`. Aceptable para 2A (evita doble mutación) pero 4A debe deshabilitar controles por `busy`, o la persona perderá acciones sin explicación. También afecta a `load()`.
- **S3 · Oráculos más débiles que mutaciones de adaptador.** N1b (el adaptador acepta `24:00`, `preview-adapter.ts` TIME) y N16 (`openShift` fecha UTC en vez de `localDate()`) SOBREVIVEN. v5 tampoco las prueba y el plan pide `24:00` solo para validación de editor, que sí está cubierto (N1 detectada). Añadir un caso a PREVIEW-14 (`24:00` rechazado) es barato.

## 1. Gates repetidos por mí (cwd `prototypes/frontend-v6`, Node 24.22.1)

| Gate | Comando | Código | Resultado | Log (SHA256 prefijo 16) |
|---|---|---|---|---|
| install | `npm ci --ignore-scripts` | 0 | ok | `gates/npm-ci.log` be55103f09ab7440 |
| audit-total | `npm audit --include=dev --json` | 0 | v2, 0/0/0/0/0 total 0 | `gates/audit-total.json` 7a89042b7a831336 |
| audit-runtime | `npm audit --omit=dev --json` | 0 | v2, total 0 | `gates/audit-runtime.json` 7a89042b7a831336 |
| typecheck | `npm run typecheck` | 0 | ok | da70ef7787d8a61f |
| lint | `npm run lint` | 0 | oxlint `--deny-warnings` ok | 478f9c8b04f56f44 |
| test:unit | `npm run test:unit` | 0 | 6 archivos, 60/60 | 7cde55bcaf023bd6 |
| test:component | `npm run test:component` | 0 | 5 archivos, 51/51 | b4a19d5e685b8242 |
| build | `npm run build` | 0 | ok | 28e7bf72b5bbeca0 |
| dist/preview.html | `sha256sum` | - | **ae271fd0a7f084b0e3583969f70ad448af637dca2c634a369e981eb17ee6d343** (igual que el del implementador: build reproducible) | `gates/dist-preview.sha256` |
| check:portable | `npm run check:portable` | 0 | `status: PASS`, `failures: []`, 0 errores de consola | 722b9a7ab912b996 |
| measure:bundle | `npm run measure:bundle` | 0 | 1.106.242 B bruto (v5: 1.086.162, ratio 1,018), gzip 729.360 (v5 756.192, 0,965); `budgetWarning: false` | 6a48bdc8799229e7 |
| test:e2e x3 | `npm run test:e2e` | 0, 0, 0 | 16/16 en cada corrida | 5710924f…, 32b78190…, aa35fe17… |

Tras el e2e: `git status` sobre `evidence/1A` y `evidence/1B` vacío; el hash de `git ls-files -s` de esas rutas (261 archivos) es idéntico antes y después (`624efd95…`). `package.json` y lock sin cambios; `docs/` y `frontend-v5` sin cambios. Orquestación: `run-review-gates.sh`, `gates/summary.txt`.

Observación: el SHA de `dist/preview.html` difiere del de G1B (`7771a12a…`); el aumento de +10,6 KB viene de que `startApp` importa `createSession`, que importa adaptador, dominio y `zustand/vanilla`. Comportamiento visible sin cambios (e2e y portable verdes). Evaluación en la sección 6.

## 2. Fidelidad de paridad (30 filas)

Comparé cada test v5 (`preview/validation/draft/polish/emil-skills`) con su test v6 línea a línea. Valores esperados, número de aserciones y regex de error coinciden; las pruebas portadas usan `expect` en lugar de `assert`. D7 es la única diferencia de texto.

| Fila | Test v6 (archivo) | Veredicto |
|---|---|---|
| DRAFT-01..03 | draft.test.ts | idéntico (3/3) |
| EMIL-SKILLS-07 | preview.test.ts | equivalente: `code==='SIMULATED_CONFLICT'`, mensaje sin guardar/borrador, turno sigue activo; reescrito sin predicado pero con las mismas condiciones |
| POLISH-08 | format.test.ts | idéntico + 3 casos añadidos (fin de año, marzo, bisiesto) |
| POLISH-09 | format.test.ts | idéntico + 2 añadidos |
| POLISH-10 | format.test.ts | idéntico (etiquetas, orden, `completed`, no muta) + caso DST Chile 06/09/2026 |
| POLISH-11 | format.test.ts | idéntico |
| PREVIEW-01 | format.test.ts | idéntico (6 aserciones) |
| PREVIEW-02 | preview.test.ts | idéntico + dos instancias aisladas + espías red/almacenamiento |
| PREVIEW-03 | preview.test.ts | idéntico + 1/300/301 y 10.000/10.001 y HTML literal |
| PREVIEW-04..08 | preview.test.ts | idénticos |
| PREVIEW-09 | preview.test.ts | idéntico con D7 (`/cama/i` -> `/lista/i`) + lista de otro turno con el texto exacto «La lista no pertenece al turno.» |
| PREVIEW-10, 11 | preview.test.ts | idénticos |
| PREVIEW-12 | preview.test.ts | D7 (`Cama 3` -> `Lista 3`), resto igual |
| PREVIEW-13..15 | preview.test.ts | idénticos |
| PREVIEW-16, 17 | preview.test.ts | D7 (`Cama norte` -> `Lista norte`; `Cama 2` -> `Lista 2`), resto igual |
| PREVIEW-18..20 | preview.test.ts | idénticos |
| VALIDATION-01 | validation.test.ts | idéntico + minutos y 23:59/24:00 + trim |
| VALIDATION-02 | validation.test.ts | idéntico + 29/02/2028, 29/02/2027, 31/02 crudo, 1/300/301, 10.000/10.001 |

Filas más débiles o con faltante: **ninguna**. Todos los `requirementId` aparecen como prefijo de nombre de test. Nota: los `targetCases` del mapa canónico son marcadores («`ID (caso de prueba por crear)`»); la correspondencia real es por prefijo de ID (el orquestador debe actualizarlos). `grep -rni cama src tests` -> 0 coincidencias (oráculo D7 cumplido; IDs `bed-1`, `Bed`, `renameBed` conservados).

Diff semántico dominio/adaptador vs v5: `format.ts`, `validation.ts`, `draft-state.ts` y `preview-adapter.ts` son transcripciones fieles: mismos mensajes, límites (300, 10.000, 1440), regex de hora y minutos, orden de claves de error (`time, estimate, performed, duration`), `parseDate` con `T12:00:00Z` y round-trip ISO, `nextCalendarDate` con `setUTCFullYear`, orden de agenda por `'9999'`/`'99'`, versión `old.version + 1`, chequeo de versión antes que validación, códigos `SIMULATED_CONFLICT|FAILURE`, `closeShift` idempotente. Únicas diferencias: tipos y D7 (semillas `Lista 1/2`, `Lista no encontrada.`, `La lista no pertenece al turno.`). Sin cambios de semántica.

## 3. Casos extra del plan: presentes y con el valor correcto

| Caso | Dónde | Estado |
|---|---|---|
| 29/02/2028 válido, 29/02/2027 inválido | validation.test.ts (VALIDATION-02 añadido) | si |
| 31/02/2026 conservado crudo con error | validation.test.ts, draft.test.ts (DRAFT-02) | si |
| 23:59 válido, 24:00 inválido (mensaje v5) | validation.test.ts (editor); N1 detectada | si (adaptador no: S3) |
| minutos `''`,`'0'`,`'1440'` válidos; `'-1'`,`'1.5'`,`'1441'` inválidos con mensaje exacto | validation.test.ts | si |
| Santiago vs medianoche UTC, fin de mes/año, bisiesto | format.test.ts | si |
| DST Chile sin +24 h | format.test.ts (06/09/2026 03:30Z -> 05/09; mutación +24 h detectada) | si |
| Títulos 1/300/301 | preview.test.ts y validation.test.ts | si |
| Cuerpo 10.000/10.001 y HTML literal | preview.test.ts, validation.test.ts (título `<b>Literal</b>` en PREVIEW-03) | si |
| Lista de otro turno rechazada | preview.test.ts (PREVIEW-09 añadido) | si |
| Cierre repetido | PREVIEW-15 | si |
| Turno nuevo vacío | PREVIEW-07 | si |
| Archivo de solo lectura | PREVIEW-10, PREVIEW-20 | si |
| Dos instancias aisladas | PREVIEW-02 añadido | si |
| Detección de `trim()` | VALIDATION-01 añadido | parcial (W3) |
| `TemporalField` usa el dominio | temporal-field.test.tsx (`toBe` de identidad de función) | si |

## 4. Autoridad y ciclo de vida

- OWNERSHIP.md vs `src/app/store.ts`: dueños de `snapshot` (solo vía `persist`/`apply`, líneas 54-58, 140-147), `selection` (`select`), `draft`/`temporal` (edición o respuesta de la misma entidad con `revision` intacta, 144 y 167), `errors`, `busy` y espejo `noticeCount` (225-227) coinciden con el código. `Route` solo está tipado (reconocido en la tabla; es de 2B).
- Una mutación del adaptador por acción: `persist` ignora la llamada si `busy` (línea 61); probado con `saveTask` y `closeShift`; N17 detectada.
- Fallo/conflicto conservan snapshot y borrador de título (probado; N3, N4, N12, N21 detectadas); el temporal no está probado (W1).
- Respuesta tardía de otra selección: éxito y fallo cubiertos con promesas controladas; N9 detectada.
- 20 ciclos: `createSession` y `createTurnoStore` con contador de suscripciones vuelven a 0 (N10 detectada); el cableado `startApp` no (W5).
- Sin red ni persistencia: `grep` de `fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|WebSocket|EventSource|sendBeacon` en `src/` (salvo `src/test`) = 0 coincidencias; espías en store y adaptador con 0 llamadas.
- Sin optimistic updates: `busy` solo; el snapshot no cambia mientras la promesa está pendiente (probado).

## 5. Mis mutaciones (35 distintas de M1-M9; copia aislada, `unit`)

Script `mutate.py`; resultados `mutations-a/b/c.json`; logs en `mutation-logs/`. CAUGHT = la suite unit falla.

| ID | Mutación | Resultado |
|---|---|---|
| N1 | validación de hora acepta 24:00 | CAUGHT |
| N1b | adaptador acepta 24:00 | SURVIVED (S3) |
| N2 | límite de cuerpo del adaptador `>=10000` | CAUGHT |
| N2b | límite de cuerpo del editor 10001 | CAUGHT |
| N3 | versión no incrementa al guardar | CAUGHT |
| N4 | chequeo de conflicto omitido | CAUGHT |
| N5 | `saveTask` permite archivo | CAUGHT |
| N5b | `renameBed` permite archivo | CAUGHT |
| N6 | renombrar a nombre duplicado fusiona tareas | CAUGHT |
| N7 | `saveNote` conserva `shiftId` | CAUGHT |
| N8 | `groupAgenda` muta el orden de entrada | CAUGHT |
| N9 | respuesta tardía sobrescribe la selección nueva | CAUGHT |
| N10 | `dispose` no libera la suscripción | CAUGHT |
| N11 | fallo resetea `temporal` crudo | **SURVIVED** (W1) |
| N12 | fallo resetea el borrador al snapshot | CAUGHT |
| N13 | `load` devuelve la referencia interna | CAUGHT |
| N14 | `createTask` acepta lista de otro turno | CAUGHT |
| N15 | cierre repetido lanza | CAUGHT |
| N16 | `openShift` usa fecha UTC | SURVIVED (S3) |
| N17 | `persist` permite doble mutación | CAUGHT |
| N18 | minutos aceptan decimales | CAUGHT |
| N19 | `estimate` vacío se aplica como `'0'` | **SURVIVED** (W4) |
| N20 | `parseDate` no valida el día (31/02) | CAUGHT |
| N21 | cualquier error resetea borrador y temporal | CAUGHT |
| N22 | `renameBed` cambia el id | CAUGHT |
| N23 | título escapa HTML | CAUGHT |
| N24 | límite de título 299 | CAUGHT |
| N25 | `busy` no se libera tras fallo | CAUGHT |
| N26 | `select` conserva `errors` previos | **SURVIVED** (W2) |
| N27 | código `SIMULATED_CONFLICT` cambiado | CAUGHT |
| N28 | `select` no reinicia `temporal` | **SURVIVED** (W2) |
| N29 | `saveNote` tardío pisa el borrador siempre | **SURVIVED** (W6) |
| N30 | `setTemporalField` recorta el crudo | **SURVIVED** (W3) |
| N31 | sin trim de `duration` al aplicar | SURVIVED (W3) |
| N32 | `startApp` no llama `session.dispose()` | **SURVIVED** (W5; unit + component) |

Total: 35 mutaciones, 25 detectadas, 10 sobreviven (todas por huecos de oráculo; el código de producto es correcto). Las 9 del implementador no se repitieron; solo verifiqué que M8/M9 se corresponden con las pruebas citadas.

## 6. Desviaciones evaluadas

- **`parseDate` lanza (v5) vs `string|null` del plan.** No es una desviación de implementación: PREVIEW-01 (`assert.throws`), DRAFT-02 (`applyTemporalDraft` lanza) y VALIDATION-02 dependen de que lance con los mensajes de v5, y el mismo plan exige «conservar valores esperados» y «portar sin cambiar semántica». Es una imprecisión del plan: la firma indica el tipo de retorno, no la excepción. Cambiarla a no lanzar rompería la paridad. Acción: enmendar el plan (`string|null`, lanza `Error` con el texto v5 si el formato o el día no son válidos); el comentario del código ya lo documenta. No hay que corregir código.
- **Firma de `createSession`/`createTurnoStore`.** Ver S1: ampliación compatible, sin `now`; registrar en el plan.
- **Bundle +10,6 KB (+0,97 %) con comportamiento igual.** Aceptable: entra por la cadena de importación (adaptador + dominio + zustand) en un bootstrap que el plan manda construir una vez; ratio 1,018 frente a v5, lejos de la alerta 2x; e2e y portable verdes sobre el nuevo SHA. Es código muerto hasta 4A (la UI de Inicio no usa el store), como pidió el brief. El criterio de rendimiento de 1A se midió sobre otro artefacto: no se repitió aquí.
- **Pruebas/ayudantes no listados** (`temporal-field.test.tsx`, `session-lifecycle.test.tsx`, `src/test/{fixtures,network-spy}.ts`): cubren requisitos de 2A; aceptables. `src/test/network-spy.ts` queda en `src/` pero solo lo importan pruebas (no entra al bundle).
- **Contrato estructurado de auditoría** (`context`/`risks`): no se generó; los JSON nativos de npm están completos y con 0 hallazgos. El validador es del orquestador.

## 7. Calidad de código

- Sin `any` (grep de `any`/`as any` en `src` y `tests`: solo 2 palabras en comentarios de e2e de 1B); oxlint `no-explicit-any` en verde.
- Sin `skip`/`only`/`xit`; sin tolerancias cambiadas (`vitest.config.ts`, `playwright.config.ts` sin diff); `git diff` solo toca 3 archivos de `src`.
- Sin optimistic updates; sin dominio de backend inventado; dependencias sin cambios.
- Tipos de §4: `Priority`, `Shift`, `Bed`, `Task`, `QuickNote`, `Snapshot`, `TemporalDraft`, `FieldErrors`, `Selection`, `Route`, `TurnoPort` (9 métodos) y `PreviewPort` (`failNext('error'|'conflict')`) coinciden exactamente en nombres y uniones; extras inofensivos `ShiftStatus` y `AgendaGroup`. Overload de `validateEditor` como en el plan.
- `TemporalField` ya no duplica la regla; reexporta la del dominio (identidad verificada por test).

## 8. NO verificado

- Interfaz conectada al store: no existe aún (4A); no se probó foco, IME, composición, lectores de pantalla ni QA visual de 2A (no aplica a un gate `unit`).
- Rendimiento production comparado con v5 (7A) y presupuesto de arranque de 1A sobre el nuevo SHA.
- Firefox/WebKit (`test:smoke:engines`), file:// con red bloqueada para 2A más allá de lo que cubre `check:portable` y el e2e existente.
- Los 212 IDs fuente: solo revisé las 30 filas de 2A; `check:parity` no existe.
- Reproducibilidad entre máquinas (solo este entorno); el hash coincide entre dos builds independientes en este entorno.
- Backend/host: fuera de alcance.

## Resumen para el orquestador
APPROVE_PHASE. Gates 0 en todo; SHA `ae271fd0…d6343`; 30/30 filas fieles a v5 (solo D7); 25/35 mutaciones propias detectadas, 10 sobreviven por huecos de prueba (W1-W6) que no son defectos del código. Recomendado cerrar W1, W2, W3, W5 y W6 con pruebas antes o junto con 4A; enmendar el plan (firma de `parseDate`, `createSession`).
