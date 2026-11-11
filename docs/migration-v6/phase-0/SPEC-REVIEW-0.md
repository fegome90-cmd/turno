# Revisión de especificación · fase 0, tarea 0.4 (primer punto) · SEGUNDA PASADA

Revisor independiente, solo lectura. Fuente: `origin/frontend/fix-fullscreen-reflow-v8` en `71bcd3d` (worktree desechable, eliminado). Diff revisado: `08ec7e4..71bcd3d`.

## Veredicto: CONFORME CON OBSERVACIONES

Los dos bloqueantes (F-01, F-02) están resueltos. Quedan restos menores de redacción, sin efecto sobre el contrato.

## Comprobaciones repetidas

- `python3 -I check_docs.py`: PASS, `errors: []` (7 JSON, 26 Markdown, 126 enlaces, 212 requisitos, 16 archivos, 6 controles). `unittest`: 79 OK. `contract_gate.py` (sin brief): PASS, código 0. El checker comprueba también el Anexo B contra la matriz.
- Diff de `parity-map.json` comparado campo a campo con `08ec7e4`: mismos 212 IDs en el mismo orden; ningún `status`, `sourceTest`, `sourceFile`, `sourceSha`, `evidence` ni `requirementId` cambió.
  - Las 13 filas D7 (UI-31 a 36, UI-39, INTERFACE-SKILLS-11 y 24, PREVIEW-09, 12, 16, 17) cambian solo `rationale`; INTERFACE-SKILLS-24 cambia además `targetBehavior`.
  - TOASTS-02 cambia solo `rationale` y `targetBehavior`.
  - VIEWPORT-11 cambia `task` (6A a 4A), `preparationTask` (3A), `integrationTasks`, `integrationRationale`, `targetTests`, `targetBehavior` y `rationale`. Esos campos son la reasignación pedida y coinciden con los de VIEWPORT-10; el `status` sigue `planned`.
  - Ninguna otra fila cambió.
- Anexo B regenerado: ISK-24, TOASTS-02 y VIEWPORT-11 (ahora «tarea 4A») reflejan los nuevos textos y destinos (diff de PLAN).

## Estado de cada hallazgo

| ID | Estado | Evidencia |
|---|---|---|
| F-01 | Resuelto | Regla D7 para la matriz en `PLAN.md` (sección 2, tras las precisiones) que lista las 13 filas y aclara que «Cama»/`Bed` es concepto interno; `rationale` de las 13 filas lo indica; `targetBehavior` de ISK-24 ahora dice «task groups are «lista»…»; PLAN:241, 243 y 316 aclarados; oráculo de D7 en `ACCEPTANCE.md` («G2A/G4A/G4B: ningún texto visible ni del adaptador contiene «cama»»). Observación O-1 abajo. |
| F-02 | Resuelto | `G0-RECORD.md`: casilla de revisiones desmarcada; línea «Revisiones de 0.4: pendientes…» y «Sin marcar» actualizada. |
| F-03 | Resuelto | Casilla de autorización con la glosa «Resuelto como NO autorizada: alcance = cerrar G0 y parar». Es [x] con significado explícito. |
| F-04 | Resuelto | B0 y B2 de `G0-RECORD.md` citan la conversación, la pregunta y la respuesta, declaran «sin enlace» y dejan el diff disponible para revisión humana. |
| F-05 | Resuelto | Casilla HEAD/base con la nota «verificado en 0.1 sobre `0712b4c`; se repite sobre el HEAD que firme el dueño». |
| F-06 | Parcial | Corregidos: PLAN sección 2 («Precisiones aceptadas por el dueño (D1–D9)»), PLAN 5 fase 0, ACCEPTANCE (estado, título, registro, `Por cada D1–D9`), ADR:3, G0-RECORD (D1–D9 y casilla), FASE_0:23. Siguen en pie: `FASE_0.md:3` («no aprueba el plan ni las seis precisiones»), `ACCEPTANCE.md:43` («cubrir las seis») y `PLAN.md:13` («no se atribuyen a decisiones ya aprobadas»; no estaba en el diff). Ver O-2. |
| F-07 | Resuelto | `G0-RECORD.md` fila de ejecución 0.1–0.3 ya dice «corregidas en `08ec7e4`»; la fila de validación documental se rotula histórica; `FASE_0.md:3` ya refleja que la fase está en ejecución. |
| F-08 | Resuelto | TOASTS-02 describe agrupado, contador «2» y anuncio diferenciado, y remite a D4/5A (el nodo DOM puede sustituirse si el resultado observable es igual). Coherente con PLAN 5A. |
| F-09 | Resuelto | VIEWPORT-11 reasignado a 4A con los destinos y la dependencia de VIEWPORT-10, y `targetBehavior` igual a la fuente. |
| F-10 | Resuelto | `ACCEPTANCE.md` tiene columna «Oráculo y gate» para D7 (G2A/G4A/G4B), D8 (G7A, y gate propio de la fase de identidad) y D9 (G6A). |
| F-11 | Resuelto | `README.md` (punto 8 del orden de lectura) y `FASE_0.md` (archivos y responsabilidades) listan GLOSARIO y design-audit. |
| F-12 | Resuelto | PLAN 6A: «pestañas150 (el token CSS `--motion-tabs:180ms` de v5 no se usa y no se copia)». |
| F-13 | Resuelto | `AUDIT_REPORT.md`: nota «Resuelto después por decisiones del dueño (D7–D9)». |
| F-14 | Resuelto | Cambio en `EXECUTION_LESSONS.md` (EXTRA-NATIVE-EDIT) dentro del diff; sin otros efectos. |
| F-15 | Sin cambios (opcional) | Acordado. |

## Observaciones nuevas o residuales

| ID | Sev | Archivo:línea | Hallazgo | Corrección |
|---|---|---|---|---|
| O-1 | SUGGEST | `ACCEPTANCE.md` (fila D7, columna oráculo) | «Ningún texto visible… contiene «cama»» choca con el glosario, donde el usuario puede llamar «Cama 3» a una lista. | Precisar «ningún texto fijo de la interfaz o semilla del adaptador; los nombres puestos por la persona usuaria quedan libres». |
| O-2 | WARN (menor) | `FASE_0.md:3`, `ACCEPTANCE.md:43`, `PLAN.md:13` | Restos de «las seis» y de «no se atribuyen a decisiones ya aprobadas». | Cambiar a D1–D9 y matizar PLAN:13. |
| O-3 | SUGGEST | `G0-RECORD.md:46` (B1) | Aún dice «Revisar ADR y D1–D6». Es la acción histórica del bloqueo, pero puede confundir. | Opcional: «D1–D9». |
| O-4 | SUGGEST | `G0-RECORD.md` (B0) | Aceptación registrada como "sin revisar línea a línea el diff": coherente con README:226, pero la revisión humana del diff sigue pendiente. | Mantener visible hasta la firma. |

Los fixes no introdujeron cambios de comportamiento ni tocaron IDs, estados, `sourceTest` ni filas ajenas. No verifiqué suite v5 ni navegador (fuera de alcance de este punto); la revisión de calidad sigue pendiente.

---

# HISTORIAL · primera pasada (HEAD 08ec7e4)

(Veredicto de entonces: NO CONFORME.)

Revisor: subagente independiente (solo lectura). Fuente revisada: `origin/frontend/fix-fullscreen-reflow-v8`, HEAD `08ec7e4` (worktree desechable, ya eliminado). Fecha: 08/11/2026.
Alcance: PLAN, ADR-001, ACCEPTANCE, FASE_0, GLOSARIO, HOST-BOUNDARY, G0-RECORD, EXECUTION-0, README, EXECUTION_LESSONS, migration-risks.json, parity-map.json, design-audit/{README,AUDIT_REPORT}.md, contra `prototypes/frontend-v5` (src, tests).

## Veredicto: NO CONFORME

Dos bloqueantes, ambos de corrección documental rápida: (1) D7 aceptada pero sin trazabilidad en la matriz de 212 filas ni en ninguna fase del plan; (2) casilla de G0-RECORD marcada sin la evidencia que exige la tarea 0.4. El resto son observaciones. Las 212 identidades, los 6 controles EXTRA y HOST-BOUNDARY están conformes.

## Hallazgos

| ID | Sev | Archivo:línea | Criterio / fuente | Hallazgo | Corrección propuesta |
|---|---|---|---|---|---|
| F-01 | BLOCK | `parity-map.json` filas UI-31, UI-32, UI-33, UI-34, UI-35, UI-36, UI-39, INTERFACE-SKILLS-11, INTERFACE-SKILLS-24, PREVIEW-09, PREVIEW-12, PREVIEW-16, PREVIEW-17; `PLAN.md:57,67,241,243,316,318`; `GLOSARIO.md:10`; `ACCEPTANCE.md:30` | D7 («Lista» única excepción de texto). Fuente: `tests/ui.test.mjs`, `interface-skills.test.mjs`, `preview.test.mjs` | Las 13 filas cuyo test fuente aserta literales «Cama/cama» («Editar nombre de Cama 1», «Nombre de la cama», «Editar nombre de cama», «esta cama», datos «Cama 1/2/norte», error `/cama/i`) tienen la justificación genérica «Preservar el comportamiento; cambiar únicamente selectors…», que prohíbe cambiar texto. INTERFACE-SKILLS-24 tiene `targetBehavior` = «beds are cama…», literalmente contrario a D7. Cero filas del JSON mencionan «Lista», D7 o GLOSARIO. Ninguna fase (2A adaptador/semillas, 4A, 4B BedDialogs) ni oráculo de ACCEPTANCE dice dónde se aplica o prueba el cambio. PLAN 241/243/316/318 usan «cama» sin aclarar que es el concepto `Bed` (identificador interno) y no el texto de interfaz. GLOSARIO enumera «Camas/Cama 1/Agregar cama» pero no las demás cadenas de v5: «Sin cama» (`app.mjs:52`), «Nombre de cama» (218), «Editar nombre de cama» y «Nombre de la cama» (222, 239), «Nombre de la cama guardado en esta demostración» (247), «Cama no encontrada.» y el error de createTask (`preview-adapter.mjs:33,42`), semillas «Cama 1/2» (:6). | Añadir regla en PLAN sección 3 y D7 de ACCEPTANCE: las filas que aserten «cama» se portan con el equivalente «lista» (cierre `replaced-by-behavior` con justificación, o nota en `rationale` de esas 13 filas sin tocar IDs ni estado). Añadir oráculo de D7 (p. ej. ninguna cadena visible o accesible de v6 contiene «cama» salvo datos del usuario; semillas «Lista N»). Asignar el cambio a 2A (adaptador/errores) y 4A/4B (diálogos). Completar la tabla del glosario con las cadenas citadas. Aclarar en PLAN 241–318 que `Bed` es identificador interno. |
| F-02 | BLOCK | `G0-RECORD.md:78` y `:87` | FASE_0 tarea 0.4 (`FASE_0.md:82-85`): «Una edición posterior obliga a repetir checks/revisión afectados» | La casilla «Revisiones de especificación y calidad emitidas, hallazgos bloqueantes resueltos» está marcada [x]. Su evidencia son commits (`340424b`, `077b986`, `81544e1`, `1d03821`) previos a D7–D9 (`8d237fd`, `08ec7e4`), que modificaron PLAN, ADR, FASE_0 y ACCEPTANCE. No hay informe enlazado de ninguna revisión de especificación o calidad de la fase 0, y la que prescribe 0.4 es esta, aún sin cerrar. La revisión de calidad no ha ocurrido. | Desmarcar hasta que existan este informe (con bloqueantes resueltos) y el informe de calidad, y enlazarlos como evidencia. |
| F-03 | WARN | `G0-RECORD.md:79`, `:88` frente a `:98` (B4), `ACCEPTANCE.md:39` | FASE_0 Gate G0: «autorización de ejecución explícita» | La casilla «Autorización de implementación … resueltos» está [x] con la evidencia «cerrar G0 y parar», mientras B4 dice que crear `frontend-v6` requiere una nueva autorización. Marcada, puede leerse como autorización concedida. | Reformular («resuelto: NO autorizada; alcance = cerrar G0 y parar») o dejar sin marcar hasta que exista el encargo. |
| F-04 | WARN | `G0-RECORD.md:32` frente a `:73`, `:94`; `FASE_0.md:84`; `ACCEPTANCE.md:43` | Aceptación con «cita o enlace verificable» | Línea 32: el diff de `baseline-files.json` «sigue pendiente de revisión humana»; README:226 dice que esa revisión «es la aprobación real». Línea 94 y la casilla 73 dan el rebaseline por «aceptado por el dueño» sin cita ni enlace. Lo mismo para la disposición de B2. | Registrar cita/enlace de la aceptación (o decir «declarada en conversación, sin enlace») y reconciliar con la revisión humana pendiente del diff. |
| F-05 | WARN | `G0-RECORD.md:72`, `:90` frente a `EXECUTION-0.md` (0.1) | Coherencia casilla/evidencia | La casilla HEAD/base/delta está sin marcar «hasta que haya encargo de v6», pero la tarea 0.1 ya verificó HEAD/base/delta en `0712b4c` (PASS). Esa verificación quedó atrás (HEAD actual `08ec7e4`). Desmarcada es lo correcto, pero la razón escrita no coincide con la evidencia. | Explicar que se rehace sobre el HEAD firmado; reverificar `git diff --stat 0f534df..HEAD -- prototypes/frontend-v5` y `check_docs.py` sobre el commit final antes de G0. |
| F-06 | WARN | `PLAN.md:13`, `:59`, `:181`; `FASE_0.md:3`, `:23`; `ACCEPTANCE.md:11`, `:43`, `:45`; `ADR-001.md:3`; `G0-RECORD.md:19`, `:76` | D1–D9 consistentes | Restos de «seis precisiones / D1–D6»: PLAN:181 pide «acordar las seis precisiones de la sección 2» (ahora hay nueve); PLAN:13 dice que las precisiones «no se atribuyen a decisiones ya aprobadas» y la sección 2 mantiene «recomendadas para aceptar» sin marcar 1–6 como aceptadas, mientras 7–9 sí; ACCEPTANCE:11 titula «Seis precisiones por decidir» (ya decididas); :43 y :45 limitan el registro a D1–D6; ADR:3 solo dice D1–D6 aceptadas (la :36 dice D1–D9); G0-RECORD:19 y :76 igual. | Unificar en «D1–D9» y marcar 1–6 como «aceptada 08/11/2026» en PLAN sección 2; ajustar título y registro de ACCEPTANCE; corregir ADR:3 y G0-RECORD:19/76; matizar PLAN:13. |
| F-07 | WARN | `G0-RECORD.md:36`, `:28` | Registro sin datos desfasados | Fila 36: «0.3 con 4 inconsistencias … se corrigen antes de 0.4»; `EXECUTION-0.md` ya las da por corregidas (08ec7e4). Fila 28: «5 JSON, 18 Markdown, 101 enlaces» frente a lo actual (7/26/119 en `check_docs.py`). | Actualizar la fila 36; rotular la 28 como histórica o actualizar cifras. |
| F-08 | WARN | `parity-map.json` TOASTS-02 (también `PLAN.md` Anexo B, ~línea 1192) | `targetBehavior` no cambia el comportamiento en silencio | Fuente: duplicados reutilizan el mismo nodo, contador «2» y anuncio «Guardado Repetido 2 veces.». `targetBehavior`/`rationale` son los de edición (caret/undo/IME, «una sola instancia interactiva») y omiten el agrupado y el anuncio diferenciado. La fase 5A sí lo cubre en texto (PLAN:~333, «agrupar duplicado … anunciar repetición diferenciada»), pero la fila no. | Corregir `targetBehavior` y `rationale` de TOASTS-02 (sin tocar ID, estado ni `sourceTest`) para incluir deduplicación, contador y anuncio. |
| F-09 | WARN | `parity-map.json` VIEWPORT-11 (Anexo B ~línea 1625) | Ídem; tarea y destino correctos | Fuente: la transición «solo temporal» con borrador sucio conserva cuerpo, formulario, scroll y estado de guardado (resize a 1000). La fila está en tarea 6A con `motion-policy`/`motion.spec` y rationale de WAAPI: parece una clasificación automática por la palabra «transition». El comportamiento real depende de 4A/editor. | Reasignar destino y rationale a la familia de VIEWPORT-10 (editor/responsive, 4A), o justificar 6A. |
| F-10 | SUGGEST | `ACCEPTANCE.md:28-32` | Oráculo/gate por decisión | D1–D6 tienen test/oráculo y gate; D7–D9 no. D9 queda cubierto por PLAN 6A (valores de `motion.mjs`); D7 y D8 no tienen criterio comprobable (D8 solo vive en PLAN:396). | Añadir columna de oráculo/gate a D7–D9 (D7 por F-01). |
| F-11 | SUGGEST | `README.md` (orden de lectura), `FASE_0.md:9-16,20-26` | Entradas de fase 0 completas | Ni README ni FASE_0 listan `GLOSARIO.md`, `design-audit/` ni D7–D9, aunque G0-RECORD:18 lo declara entrada adicional. | Añadirlos a las tablas de entradas y al orden de lectura. |
| F-12 | SUGGEST | `PLAN.md:346` | D9: duraciones idénticas a v5 | Los valores copiados coinciden con `src/motion.mjs` (150/240/260/220/150/180/300; drawer `cubic-bezier(0.32,0.72,0,1)`). Pero `styles.css:7` define `--motion-tabs:180ms`, variable muerta frente a los 150 del JS (ya anotado en `AUDIT_REPORT.md:72`). | Anotar en 6A que el valor de pestañas es 150 ms y que el token CSS de 180 ms no se copia. |
| F-13 | SUGGEST | `design-audit/AUDIT_REPORT.md:9,46-49` | Estado no contradictorio | Texto de la primera ronda sin marcar como superado (coherencia «D1 a D6», cuatro puntos, «el dueño debe decidir» sobre .97/120 ms, ya resuelto por D9). La «actualización» posterior no declara resueltos esos puntos. | Añadir una línea «Resuelto por D7–D9» en la actualización. |
| F-14 | SUGGEST | `EXECUTION_LESSONS.md` (EXTRA-NATIVE-EDIT) | Coherencia con mapa/plan | Dice «Gates G3/G4A/G7B» y omite 1B, pese a que el texto lo asigna a 1B y mapa y PLAN:212 lo evalúan en 1B (chromium). | Añadir G1B. |
| F-15 | SUGGEST | `HOST-BOUNDARY.md:8,14`; `PLAN.md:21` | D7 (producto general) | «servicio clínico» y «datos de pacientes» como únicos ejemplos. Es coherente con el README de v5 («datos reales de pacientes»), pero el enfoque general admite redactar «datos personales o de salud». | Opcional. |

## Qué verifiqué (y cómo)

- `python3 -I docs/migration-v6/scripts/check_docs.py` sobre 08ec7e4: PASS, errors `[]` (7 JSON, 26 Markdown, 119 enlaces, 212 requisitos, 16 archivos, 6 controles). Además `unittest discover` (79 OK) y `contract_gate.py` sin brief (errors `[]`, código 0).
- parity-map.json, comprobación propia (no solo el checker): 212 filas, 212 IDs únicos, 16 archivos con los recuentos esperados (ui 43, interface-skills 33, toasts 22, preview 20, …); los 212 `sourceTest` aparecen literalmente en el archivo de test v5 correspondiente; todos `planned`, `evidence: []`, un único `sourceSha` (`0f534df`); ninguna fila sin `targetTests`/`targetCases`.
- Revisión de contenido: 175 filas con `targetBehavior` = `sourceTest` (literal); leí las 37 restantes (todas, no una muestra de 20) y las 13 de «cama». Solo TOASTS-02 y VIEWPORT-11 (F-08/F-09) pierden comportamiento; los reemplazos de INTERFACE-SKILLS-15/27/31 y UI-24 (SVG inline, Collapsible, bundle sin red) conservan el resultado observable con justificación.
- Tareas de 1A (7 filas: DESIGN-COMPLETE-01/02, HOME-SUBTITLE-01..03, TOKENS-01, UI-01) coinciden con PLAN («siete identidades 1A»); PREVIEW (20) y VALIDATION/DRAFT en 2A.
- Barrido de restos contradictorios en todos los .md/.json de docs/migration-v6: sin «Menu» como contenedor de Más opciones (solo `role=menu` prohibido en PLAN:62 y fuentes de v5), sin next-themes como decisión (solo como alternativa descartada y en el antecedente histórico rotulado de v5), sin «120 ms»/«.97» en PLAN (solo en el informe de la auditoría como hallazgo histórico), sin duraciones distintas de v5 en PLAN:346 (comparado con `motion.mjs` y `styles.css`), «no cambiar textos» con excepción D7 en PLAN:57 y GLOSARIO:20. La «pulsación» de v5 es solo cambio de color con `transition:none` (`styles.css:245-247`), como dice PLAN:353.
- D1–D9 en PLAN secciones 2/5, ADR (:31, :36), ACCEPTANCE, FASE_0:71 y GLOSARIO: contenido consistente salvo los restos de F-06. D4 (Sonner con adaptador, brecha bloquea 5A) y D5 (Chromium obligatorio; Paper/Impeccable en 3A–4B sin valor de cierre) coinciden entre PLAN:63-65 y ACCEPTANCE.
- EXTRA (6): cada control de `migration-risks.json` coincide con EXECUTION_LESSONS y con los «Controles incorporados» de PLAN. LIFECYCLE-ASYNC 1B/2A/2B (PLAN:212,231,250); STATE-AUTHORITY 2A/4A (231,288); NATIVE-EDIT 1B/3A/4A/7B con `manual-ime` como `manual-at` (212,268,288,384); PERFORMANCE 1A/7A (189,365); OFFLINE 1A/7A (189,365); ROLLBACK fase 0 `baseline`/`nonvisual` y 7A `chromium` (167,365). Clases de evidencia coherentes (unit/component = nonvisual, navegador = browser, IME = manual-at); todos `planned`. Único desajuste: F-14.
- HOST-BOUNDARY: coincide con D6 (demo autónoma, host/backend en encargo aparte); las cinco capas H son las de PLAN sección 6 (puntos 1–5); `TurnoPort` presentado como «contrato local propuesto, no API verificada»; sin endpoints, versiones ni nombres de backend inventados; host real y contrato backend NOT RUN.
- G0-RECORD: todas las SHA citadas existen (`536c511`, `077b986`, `ee34b76`, `340424b`, `81544e1`, `1d03821`, `0f534df`, `70167c2`, `7141568`). Reconstruí `preview.html` con `build_preview.py`: 1.086.162 bytes, SHA256 `29e80f24c70e342b18b2f3f4023a4cf55e7e2dbb782292a5d57be5314c713c37` (64 caracteres), idéntico al registrado. Casillas correctamente marcadas: baseline (con reservas F-04), 212 identidades, HTML de referencia, disposición de riesgos/navegador. Correctamente sin marcar: aceptación de plan/ADR (firma) y HEAD/base (con F-05). Problemáticas: F-02 y F-03.

## No verificado

No repetí la suite v5 completa ni el navegador (alcance documental; evidencia de EXECUTION-0 y G0-RECORD aceptada solo en lo que el checker y el build reproducen). No verifiqué las URL externas de CASOS_REALES.md, REACT_RESEARCH.md ni PREFLIGHT.md. No evalué la revisión de calidad (segundo punto de 0.4).
